"""A7 analysis engine: a drop-in replacement for the n8n source-analysis path.

POST /webhook/a7/owner-analyze  same multipart contract as the n8n bridge
GET  /health                    liveness and configuration flags (no values)
"""

from __future__ import annotations

import hmac
import logging
from typing import Any, Awaitable, Callable

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.datastructures import UploadFile

from . import __version__
from .budget import BudgetClient, HttpBudgetClient
from .config import Settings
from .idempotency import RequestRegistry
from .intake import MAX_FILES, MAX_TOTAL_BYTES, IntakeError, UploadedFile, validate
from .pipeline import Pipeline
from .providers import Provider, providers_from_settings

log = logging.getLogger("a7engine")
NO_STORE = {"Cache-Control": "no-store"}
# Multipart framing on top of the 36 MiB of files the bridge accepts.
MAX_REQUEST_BYTES = MAX_TOTAL_BYTES + 2 * 1024 * 1024


def _json(body: dict[str, Any], status: int) -> JSONResponse:
    return JSONResponse(body, status_code=status, headers=NO_STORE)


def missing_configuration(settings: Settings, budget_injected: bool, provider_injected: bool) -> list[str]:
    missing = []
    if not settings.engine_authorization:
        missing.append("A7_ENGINE_AUTHORIZATION")
    if not budget_injected and not settings.budget_authorization:
        missing.append("A7_BUDGET_AUTHORIZATION")
    if not provider_injected and settings.provider_mode != "live":
        # Fake answers must never be settled into a real ledger: fake mode serves /health only.
        missing.append("A7_PROVIDER_MODE")
    elif not provider_injected:
        for name, value in (("GEMINI_API_KEY", settings.gemini_api_key), ("ANTHROPIC_API_KEY", settings.anthropic_api_key), ("OPENAI_API_KEY", settings.openai_api_key)):
            if not value:
                missing.append(name)
    return missing


def authorized(expected: str, actual: str) -> bool:
    if not expected or len(actual) > 4096:
        return False
    return hmac.compare_digest(actual.encode("utf-8"), expected.encode("utf-8"))


def create_app(
    settings: Settings | None = None,
    budget: BudgetClient | None = None,
    provider: Provider | None = None,
    clock: Callable[[], float] | None = None,
    sleep: Callable[[float], Awaitable[Any]] | None = None,
) -> FastAPI:
    settings = settings or Settings.from_env()
    missing = missing_configuration(settings, budget is not None, provider is not None)
    budget = budget or HttpBudgetClient(settings.budget_authorization, settings.budget_timeout_s)
    provider = provider or providers_from_settings(settings)
    extra: dict[str, Any] = {}
    if clock is not None:
        extra["clock"] = clock
    if sleep is not None:
        extra["sleep"] = sleep
    pipeline = Pipeline(settings, budget, provider, **extra)
    registry = RequestRegistry(settings.idempotency_ttl_s, **({"clock": clock} if clock else {}))

    app = FastAPI(title="A7 analysis engine", version=__version__, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.pipeline = pipeline
    app.state.registry = registry

    @app.get("/health")
    async def health() -> JSONResponse:
        return _json({"status": "ok", "service": "a7-engine", "version": __version__, "configured": not missing,
                      "providerMode": settings.provider_mode}, 200)

    @app.post("/webhook/a7/owner-analyze")
    async def owner_analyze(request: Request) -> JSONResponse:
        if missing:
            return _json({"error": "engine_not_configured"}, 503)
        if not authorized(settings.engine_authorization, request.headers.get(settings.auth_header, "")):
            return _json({"error": "unauthorized"}, 403)
        length = request.headers.get("content-length")
        if length is not None and (not length.isdigit() or int(length) > MAX_REQUEST_BYTES):
            return _json({"error": "invalid_analysis_file"}, 413)
        if not request.headers.get("content-type", "").startswith("multipart/form-data"):
            return _json({"error": "invalid_analysis_intake"}, 400)
        try:
            form = await request.form(max_files=MAX_FILES, max_fields=32)
        except Exception:  # noqa: BLE001 - malformed or oversized multipart
            return _json({"error": "invalid_analysis_intake"}, 400)
        payload: Any = None
        files: list[UploadedFile] = []
        try:
            for name, value in form.multi_items():
                if isinstance(value, UploadFile):
                    data = await value.read()
                    files.append(UploadedFile(name=value.filename or "", mime=(value.content_type or "").split(";")[0].strip(), data=data))
                elif name == "payload":
                    payload = value
            intake = validate(payload, files)
        except IntakeError as error:
            return _json({"error": error.code}, error.status)
        finally:
            await form.close()
        outcome = await registry.run(intake, lambda: pipeline.run(intake))
        return _json(outcome.body, outcome.status_code)

    return app


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
app = create_app()
