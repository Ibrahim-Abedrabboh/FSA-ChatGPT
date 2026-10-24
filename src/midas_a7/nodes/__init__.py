"""Node handlers by node kind. Each module exports HANDLERS = {kind: async handler}."""

from __future__ import annotations

import importlib

from ..engine.executor import Handler

_MODULES = ("core", "http_request", "data_table", "google_drive", "edit_image", "llm")


def all_handlers() -> dict[str, Handler]:
    handlers: dict[str, Handler] = {}
    for name in _MODULES:
        try:
            mod = importlib.import_module(f"{__name__}.{name}")
        except ModuleNotFoundError as exc:
            if exc.name == f"{__name__}.{name}":
                continue
            raise
        handlers.update(getattr(mod, "HANDLERS", {}))
    return handlers
