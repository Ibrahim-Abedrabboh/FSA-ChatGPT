"""Shared services handed to every node handler."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import httpx

from ..config import Credentials, Settings
from ..store import Store
from .binary import BinaryStore
from .jsrunner import JsRunner


@dataclass
class Services:
    settings: Settings
    store: Store
    js: JsRunner
    binaries: BinaryStore
    credentials: Credentials
    schemas: dict[str, dict[str, Any]]
    http: httpx.AsyncClient
    # In-process client for this service's own webhooks (set once the web app exists).
    self_http: httpx.AsyncClient | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    def route(self, url: str) -> tuple[httpx.AsyncClient, str]:
        """Calls to this service's own addresses (incl. the former n8n host) stay in process."""
        for base in (self.settings.public_base_url, *self.settings.self_aliases):
            if base and (url == base or url.startswith(base + "/")) and self.self_http is not None:
                return self.self_http, url[len(base):] or "/"
        return self.http, url
