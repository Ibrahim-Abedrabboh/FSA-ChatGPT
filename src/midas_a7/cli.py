"""Command line: serve the API, seed reference tables, run a flow by hand, check the flows.

    midas-a7 serve                      # web service (PORT, default 8080)
    midas-a7 check                      # every node of every flow has a handler
    midas-a7 seed                       # load reference tables into an empty database
    midas-a7 run catalogue_refresh      # run a flow from its manual trigger, wait for it to finish
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import re
import sys

from .config import Settings


def _check() -> int:
    from .app import load_flows
    from .nodes import all_handlers

    handlers = all_handlers()
    missing: dict[str, list[str]] = {}
    for flow in load_flows().values():
        for node in flow.nodes.values():
            if node.kind not in handlers:
                missing.setdefault(node.kind, []).append(f"{flow.name} / {node.name}")
    for kind, where in sorted(missing.items()):
        print(f"no handler for '{kind}': {len(where)} node(s), e.g. {where[0]}")
    print("all node types handled" if not missing else f"{len(missing)} node type(s) without a handler")
    return 1 if missing else 0


async def _seed() -> int:
    from .app import build_services
    from .nodes.data_table import seed_reference_tables

    svc = build_services(Settings())
    try:
        print(json.dumps(await seed_reference_tables(svc)))
    finally:
        await svc.http.aclose()
        await svc.js.close()
    return 0


async def _run(package: str) -> int:
    from .app import build_services
    from .engine.executor import Executor
    from .engine.model import load_flow
    from .nodes import all_handlers
    from .runtime import Runtime

    svc = build_services(Settings())
    flow = load_flow(f"midas_a7.flows.{package}")
    trigger = next((n for n in flow.trigger_nodes() if n.kind == "manualTrigger"), None)
    if trigger is None:
        print(f"{package} has no manual trigger", file=sys.stderr)
        return 2
    runtime = Runtime(svc, Executor(svc, all_handlers()), {flow.id: flow})
    try:
        await runtime.run_trigger(flow, trigger, [{"json": {}}], wait_for_response=False)
        await runtime.drain(timeout_s=3 * 3600)
    finally:
        await svc.http.aclose()
        await svc.js.close()
    return 0


class _RedactSecrets(logging.Filter):
    """Query strings carry resume and file-link signatures and, on Google calls, the API key; keep them out of every log line."""

    PATTERN = re.compile(r"([?&](?:signature|sig|key|api_key|apikey|token|access_token)=)[^&\s\"']+", re.IGNORECASE)

    @classmethod
    def redact(cls, text: str) -> str:
        return cls.PATTERN.sub(r"\1<redacted>", text)

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = self.redact(record.msg)
        if isinstance(record.args, tuple):
            record.args = tuple(self.redact(a) if isinstance(a, str) else a for a in record.args)
        return True


def configure_logging() -> None:
    logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    # httpx logs every request URL at INFO; Google calls carry the API key in the query (as n8n sends it).
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    redact = _RedactSecrets()
    logging.getLogger("uvicorn.access").addFilter(redact)  # uvicorn's loggers do not propagate to the root
    for handler in logging.getLogger().handlers:  # everything the service logs itself
        handler.addFilter(redact)


def main(argv: list[str] | None = None) -> int:
    configure_logging()
    parser = argparse.ArgumentParser(prog="midas-a7")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("serve")
    sub.add_parser("check")
    sub.add_parser("seed")
    run = sub.add_parser("run")
    run.add_argument("package", help="flow package, e.g. catalogue_refresh")
    args = parser.parse_args(argv)
    if args.cmd == "serve":
        import uvicorn
        from .app import create_app
        uvicorn.run(create_app(), host="0.0.0.0", port=int(os.environ.get("PORT", "8080")), proxy_headers=True,
                    forwarded_allow_ips="*", log_level=os.environ.get("LOG_LEVEL", "info").lower())
        return 0
    if args.cmd == "check":
        return _check()
    if args.cmd == "seed":
        return asyncio.run(_seed())
    if args.cmd == "run":
        return asyncio.run(_run(args.package))
    return 2


if __name__ == "__main__":
    sys.exit(main())
