"""The web service: the same webhook addresses and contracts the n8n workflows had.

    /webhook/<path>                 every webhook node of every flow (same paths as in n8n)
    /webhook-waiting/<execution>    resume link of a run parked at a Wait node (go 1 / go 2)
    /health                         readiness and which credentials are configured (never values)
"""

from __future__ import annotations

import asyncio
import contextlib
import hmac
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response as RawResponse

from .config import Credentials, MissingCredential, Settings
from .engine.binary import BinaryStore
from .engine.executor import Executor, Response
from .engine.jsrunner import JsRunner
from .engine.model import Flow, Item, NodeDef, load_flow
from .engine.services import Services
from .nodes import all_handlers
from .runtime import Runtime, redact_headers
from .store import Store, load_schemas

log = logging.getLogger(__name__)

FLOW_PACKAGES = ("a7_main", "owner_bridge", "owner_read", "owner_analysis", "analysis_only", "model_tests", "catalogue_refresh")
MAX_BODY_BYTES = 64 * 1024 * 1024

# One-off recovery webhooks of 18 Oct 2026, written for a single n8n run id
# (claude-a7-20261017230527-1i4fxz). That run does not exist in this service's fresh database,
# so they are not exposed. Their nodes stay in the flow untouched; nothing else reaches them.
RETIRED_WEBHOOKS = {("POST", "a7/approved-blind-recovery"), ("POST", "a7/approved-package-recovery")}


def load_flows() -> dict[str, Flow]:
    flows = [load_flow(f"midas_a7.flows.{pkg}") for pkg in FLOW_PACKAGES]
    return {f.id: f for f in flows}


def build_services(settings: Settings) -> Services:
    store = Store(settings.database_url)
    return Services(
        settings=settings, store=store, js=JsRunner(), binaries=BinaryStore(store), credentials=Credentials(),
        schemas=load_schemas(settings.data_tables_path), http=httpx.AsyncClient(follow_redirects=False),
    )


def webhook_table(flows: dict[str, Flow]) -> dict[tuple[str, str], tuple[Flow, NodeDef]]:
    table: dict[tuple[str, str], tuple[Flow, NodeDef]] = {}
    for flow in flows.values():
        for node in flow.webhook_nodes():
            method = str(node.parameters.get("httpMethod", "GET")).upper()
            path = str(node.parameters.get("path", "")).strip("/")
            key = (method, path)
            if key in RETIRED_WEBHOOKS:
                continue
            if key in table:
                raise RuntimeError(f"webhook {method} {path} is defined twice")
            table[key] = (flow, node)
    return table


async def request_item(request: Request, path: str) -> tuple[Item, list[tuple[str, bytes, str | None, str | None]]]:
    """The item an n8n webhook node outputs, plus the uploaded files (stored once the run has an id)."""
    headers = {k.lower(): v for k, v in request.headers.items()}
    query = dict(request.query_params)
    body: Any = {}
    files: list[tuple[str, bytes, str | None, str | None]] = []
    ctype = headers.get("content-type", "")
    if ctype.startswith("multipart/form-data"):
        form = await request.form(max_files=100, max_fields=1000)
        fields: dict[str, Any] = {}
        per_name: dict[str, int] = {}
        uploads = [(k, v) for k, v in form.multi_items() if hasattr(v, "read")]
        multi = {k for k, _ in uploads if sum(1 for kk, _ in uploads if kk == k) > 1}
        for key, value in form.multi_items():
            if hasattr(value, "read"):
                name = key[:-2] if key.endswith("[]") else key
                if key in multi:
                    idx = per_name.get(name, 0)
                    per_name[name] = idx + 1
                    name = f"{name}{idx}"
                data = await value.read()
                files.append((name, data, value.content_type, value.filename))
            else:
                if key in fields:
                    prev = fields[key]
                    fields[key] = (prev if isinstance(prev, list) else [prev]) + [value]
                else:
                    fields[key] = value
        body = fields
    else:
        raw = await request.body()
        if raw:
            if "json" in ctype:
                try:
                    body = json.loads(raw)
                except json.JSONDecodeError:
                    body = {}
            elif ctype.startswith("application/x-www-form-urlencoded"):
                form = await request.form()
                body = {k: v for k, v in form.items()}
    item: Item = {"json": {
        "headers": redact_headers(headers), "params": {}, "query": query, "body": body,
        "webhookUrl": f"{request.app.state.settings.public_base_url}/webhook/{path}", "executionMode": "production",
    }}
    return item, files


def check_header_auth(node: NodeDef, request: Request) -> Response | None:
    if node.parameters.get("authentication", "none") != "headerAuth":
        return None
    cred = (node.credentials.get("httpHeaderAuth") or {}).get("name", "")
    try:
        expected = Credentials().header(cred)
    except MissingCredential:
        return Response(status=500, body={"code": 500, "message": "No authentication data defined on node!"})
    got = request.headers.get(expected.header)
    if not got or not hmac.compare_digest(got.encode(), expected.value.encode()):
        return Response(status=403, body={"code": 403, "message": "Authorization data is wrong!"})
    return None


def to_http(resp: Response) -> RawResponse:
    headers = dict(resp.headers or {})
    if resp.raw is not None:
        return RawResponse(content=resp.raw, status_code=resp.status, headers=headers, media_type=resp.content_type)
    return JSONResponse(content=resp.body if resp.body is not None else {}, status_code=resp.status, headers=headers)


# ---------- schedules ----------
_DAYS = 7


def next_weekly(rule: dict[str, Any], tz: str, after: datetime) -> datetime:
    """Next firing of an n8n Schedule rule of field 'weeks' (the only kind the flows use)."""
    zone = ZoneInfo(tz)
    local = after.astimezone(zone)
    days = [int(d) for d in rule.get("triggerAtDay") or [0]]
    hour, minute = int(rule.get("triggerAtHour", 0)), int(rule.get("triggerAtMinute", 0))
    for add in range(0, _DAYS + 1):
        day = (local + timedelta(days=add)).replace(hour=hour, minute=minute, second=0, microsecond=0)
        js_dow = (day.weekday() + 1) % 7  # n8n: 0 = Sunday
        if js_dow in days and day > local:
            return day
    return local + timedelta(days=_DAYS)


async def scheduler(app: FastAPI) -> None:
    runtime: Runtime = app.state.runtime
    settings: Settings = app.state.settings
    next_runs: dict[str, datetime] = {}
    while True:
        try:
            await runtime.resume_due()
            if settings.schedules_enabled:
                now = datetime.now(ZoneInfo("UTC"))
                for flow in runtime.flows.values():
                    tz = flow.settings.get("timezone") or "UTC"
                    for node in flow.trigger_nodes():
                        if node.kind != "scheduleTrigger":
                            continue
                        for idx, rule in enumerate((node.parameters.get("rule") or {}).get("interval") or []):
                            if rule.get("field") != "weeks":
                                continue
                            key = f"{flow.id}:{node.name}:{idx}"
                            due = next_runs.setdefault(key, next_weekly(rule, tz, now))
                            if now >= due:
                                next_runs[key] = next_weekly(rule, tz, now + timedelta(minutes=1))
                                log.info("schedule %s fired", key)
                                await runtime.run_trigger(flow, node, [{"json": {"timestamp": now.isoformat()}}], False)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("scheduler pass failed")
        await asyncio.sleep(30)


def create_app(settings: Settings | None = None, services: Services | None = None,
               flows: dict[str, Flow] | None = None) -> FastAPI:
    settings = settings or Settings()
    flows = flows if flows is not None else load_flows()
    table = webhook_table(flows)

    @contextlib.asynccontextmanager
    async def lifespan(app: FastAPI):
        svc = services or build_services(settings)
        svc.self_http = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://self.internal", timeout=None)
        executor = Executor(svc, all_handlers())
        runtime = Runtime(svc, executor, flows)
        app.state.services = svc
        app.state.runtime = runtime
        interrupted = await asyncio.to_thread(svc.store.fail_interrupted)
        if interrupted:
            log.warning("%d run(s) were active when the service stopped and are marked crashed", interrupted)
        try:
            from .nodes.data_table import seed_reference_tables  # loaded once the data-table node exists
            seeded = await seed_reference_tables(svc)
            if any(seeded.values()):
                log.info("reference tables seeded: %s", seeded)
        except ImportError:
            log.warning("data-table node not available; reference tables not seeded")
        sched = asyncio.create_task(scheduler(app))
        try:
            yield
        finally:
            sched.cancel()
            await runtime.drain()
            await svc.self_http.aclose()
            await svc.http.aclose()
            await svc.js.close()

    app = FastAPI(title="Midas A7", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
    app.state.settings = settings
    app.state.flows = flows

    @app.get("/health")
    async def health() -> dict[str, Any]:
        return {
            "status": "ok",
            "flows": {f.name: f.version_id for f in flows.values()},
            "webhooks": sorted(f"{m} {p}" for m, p in table),
            "configured": Credentials().configured(),
        }

    @app.get("/status")
    async def status(request: Request):
        """Runs by status, active and waiting runs with their age, and the latest failures: how anyone sees a stuck run.

        Authenticated with the bridge secret the owner site already holds (Authorization = A7_BRIDGE_HEADER_VALUE).
        Shows no run state, no request data and no secret; failure messages are redacted and cut short.
        """
        try:
            expected = Credentials().header("A7 GPT bridge inbound")
        except MissingCredential:
            return JSONResponse(status_code=503, content={"code": 503, "message": "The status page needs A7_BRIDGE_HEADER_VALUE."})
        got = request.headers.get(expected.header) or ""
        if not got or not hmac.compare_digest(got.encode(), expected.value.encode()):
            return JSONResponse(status_code=403, content={"code": 403, "message": "Authorization data is wrong!"})
        from .cli import _RedactSecrets  # cli imports this module, so the filter is imported when used

        svc: Services = request.app.state.services
        try:
            summary = await asyncio.to_thread(svc.store.run_summary)
        except Exception as exc:  # the database is the first thing a stuck run points to
            log.warning("status: database read failed: %s", exc.__class__.__name__)
            return JSONResponse(status_code=503, content={"database": "unreachable"})
        names = {f.id: f.name for f in flows.values()}
        at = datetime.now(timezone.utc)

        def when(dt):
            return None if dt is None else (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc))

        def run(r: dict[str, Any]) -> dict[str, Any]:
            created, waits = when(r["created_at"]), when(r["wait_till"])
            out: dict[str, Any] = {"id": r["id"], "flow": names.get(r["flow_id"], r["flow_id"]), "status": r["status"],
                                   "ageSeconds": int((at - created).total_seconds()) if created else None,
                                   "updatedAt": when(r["updated_at"]).isoformat() if r["updated_at"] else None}
            if r["status"] == "waiting":
                out["waitKind"] = r["wait_kind"]
                out["waitTill"] = waits.isoformat() if waits else None
            if r["error"]:
                err = r["error"] if isinstance(r["error"], dict) else {"message": str(r["error"])}
                out["failedNode"] = err.get("node")
                out["message"] = _RedactSecrets.redact(str(err.get("message", "")))[:300]
            return out

        return {"database": "ok", "asOf": at.isoformat(), "counts": summary["counts"],
                **{k: [run(r) for r in summary[k]] for k in ("running", "waiting", "failed")}}

    @app.api_route("/webhook/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"])
    async def webhook(path: str, request: Request):
        path = path.strip("/")
        hit = table.get((request.method.upper(), path))
        if not hit:
            return JSONResponse(status_code=404, content={"code": 404, "message": f"The requested webhook \"{request.method} {path}\" is not registered."})
        flow, node = hit
        denied = check_header_auth(node, request)
        if denied:
            return to_http(denied)
        length = int(request.headers.get("content-length") or 0)
        if length > MAX_BODY_BYTES:
            return JSONResponse(status_code=413, content={"code": 413, "message": "Request body is too large"})
        item, files = await request_item(request, path)
        runtime: Runtime = request.app.state.runtime
        wants_response = node.parameters.get("responseMode", "onReceived") == "responseNode"
        resp = await runtime.run_trigger(flow, node, [item], wait_for_response=wants_response, files=files)
        if resp is None:
            return JSONResponse(status_code=200, content={"message": "Workflow was started"})
        return to_http(resp)

    @app.get("/files/{file_id}/view")
    async def view_file(file_id: str, request: Request):
        """A stored image or manifest, by the signed link the flows record as webViewLink."""
        from .nodes.google_drive import accepted_secrets, file_signature
        svc: Services = request.app.state.services
        sig = request.query_params.get("sig", "")
        if not any(hmac.compare_digest(file_signature(secret, file_id), sig) for secret in accepted_secrets(svc)):
            return JSONResponse(status_code=404, content={"code": 404, "message": "Not found"})
        row = await asyncio.to_thread(svc.store.file_get, file_id)
        if not row or row.get("data") is None:
            return JSONResponse(status_code=404, content={"code": 404, "message": "Not found"})
        safe_name = "".join(ch for ch in str(row["name"]) if ch.isalnum() or ch in "._- ")[:150] or "file"
        return RawResponse(content=bytes(row["data"]), media_type=row["mime_type"], headers={
            "Content-Disposition": f'inline; filename="{safe_name}"', "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
            "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox"})

    @app.api_route("/webhook-waiting/{execution_id}", methods=["GET", "POST"])
    async def webhook_waiting(execution_id: str, request: Request):
        runtime: Runtime = request.app.state.runtime
        if not execution_id.isdigit() or not runtime.signature_ok(execution_id, request.query_params.get("signature", "")):
            return JSONResponse(status_code=401, content={"code": 401, "message": "Invalid token"})
        item, _ = await request_item(request, f"../webhook-waiting/{execution_id}")
        item["json"].pop("webhookUrl", None)
        item["json"].pop("executionMode", None)
        item["json"]["query"] = {k: v for k, v in item["json"]["query"].items() if k != "signature"}
        status, body = await runtime.resume_from_webhook(execution_id, item)
        return JSONResponse(status_code=status, content=body)

    return app


