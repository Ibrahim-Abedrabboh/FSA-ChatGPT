"""Client for the site's budget API (``netlify/functions/a7-budget.mjs``).

n8n calls ``POST {origin}/api/a7/budget/reserve`` and ``.../settle`` with the JSON
``budgetRequest`` as body, the shared ``Authorization`` header, a 20 s timeout, no
redirects, and treats any transport failure or non-200 answer as "no permission" or
"settlement uncertain". This client keeps those rules; it never raises.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

import httpx


@dataclass
class BudgetReply:
    status_code: int | None
    body: Any


class BudgetClient(Protocol):
    async def reserve(self, origin: str, request: dict[str, Any]) -> BudgetReply: ...

    async def settle(self, origin: str, request: dict[str, Any]) -> BudgetReply: ...


class HttpBudgetClient:
    def __init__(self, authorization: str, timeout_s: float = 20.0, transport: httpx.AsyncBaseTransport | None = None):
        self._authorization = authorization
        self._timeout = timeout_s
        self._transport = transport

    async def _post(self, origin: str, action: str, request: dict[str, Any]) -> BudgetReply:
        if not self._authorization:
            return BudgetReply(None, {"error": "budget_not_configured"})
        url = origin.rstrip("/") + "/api/a7/budget/" + action
        try:
            async with httpx.AsyncClient(timeout=self._timeout, follow_redirects=False, transport=self._transport) as client:
                response = await client.post(url, json=request, headers={"Authorization": self._authorization})
        except (httpx.HTTPError, OSError):
            return BudgetReply(None, None)
        try:
            body = response.json()
        except ValueError:
            body = None
        return BudgetReply(response.status_code, body)

    async def reserve(self, origin: str, request: dict[str, Any]) -> BudgetReply:
        return await self._post(origin, "reserve", request)

    async def settle(self, origin: str, request: dict[str, Any]) -> BudgetReply:
        return await self._post(origin, "settle", request)
