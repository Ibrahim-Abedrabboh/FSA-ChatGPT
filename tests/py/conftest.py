"""Shared fixtures: an in-memory store, the JS sidecar and a Services object for node handlers."""

from __future__ import annotations

import httpx
import pytest

from midas_a7.config import Credentials, Settings
from midas_a7.engine.binary import BinaryStore
from midas_a7.engine.executor import Execution, Executor
from midas_a7.engine.jsrunner import JsRunner
from midas_a7.engine.model import flow_from_definition
from midas_a7.engine.services import Services
from midas_a7.nodes import all_handlers
from midas_a7.store import Store, load_schemas


@pytest.fixture
async def services(monkeypatch):
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://a7.test")
    settings = Settings(database_url="sqlite://")
    store = Store(settings.database_url)
    js = JsRunner()
    http = httpx.AsyncClient()
    svc = Services(settings=settings, store=store, js=js, binaries=BinaryStore(store), credentials=Credentials(),
                   schemas=load_schemas(settings.data_tables_path), http=http)
    yield svc
    await js.close()
    await http.aclose()


@pytest.fixture
def executor(services):
    return Executor(services, all_handlers())


def make_flow(nodes: list[dict], connections: dict, settings: dict | None = None):
    """Build a Flow from n8n-style node dicts; code nodes may give 'jsCode' inline."""
    return flow_from_definition({"id": "test", "name": "test", "nodes": nodes, "connections": connections,
                                 "settings": settings or {"executionOrder": "v1"}})


def link(*pairs: tuple) -> dict:
    """link(("A", "B"), ("IF", "C", 1)) -> n8n connections; third value is the source output index."""
    out: dict = {}
    for p in pairs:
        src, dst = p[0], p[1]
        oi = p[2] if len(p) > 2 else 0
        ii = p[3] if len(p) > 3 else 0
        main = out.setdefault(src, {"main": []})["main"]
        while len(main) <= oi:
            main.append([])
        main[oi].append({"node": dst, "type": "main", "index": ii})
    return out


async def run_flow(executor, flow, trigger_items, trigger="Start"):
    ex = Execution(id="1", flow_id=flow.id)
    await executor.start(flow, ex, flow.nodes[trigger], trigger_items)
    return ex
