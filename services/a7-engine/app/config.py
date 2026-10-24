"""Runtime settings, read from environment variables only.

Secrets (authorization values, provider keys) are read here and never logged,
echoed in responses or included in ``repr``.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

# The n8n analysis workflow sends budget calls to the site named in the payload's
# ``budgetOrigin`` only when it is on this fixed list; every other job uses the
# original owner-preview ledger (CLAUDE-FINAL-README.md, "option A").
DEFAULT_BUDGET_ORIGINS = ("https://claude-final-midas-a7.netlify.app",)
DEFAULT_BUDGET_FALLBACK_ORIGIN = "https://midas-a7-owner-preview.netlify.app"


def _float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    engine_authorization: str = field(default="", repr=False)
    auth_header: str = "authorization"
    budget_authorization: str = field(default="", repr=False)
    budget_origins: tuple[str, ...] = DEFAULT_BUDGET_ORIGINS
    budget_fallback_origin: str = DEFAULT_BUDGET_FALLBACK_ORIGIN
    budget_timeout_s: float = 20.0
    provider_mode: str = "live"  # "live"; any other value serves /health only (fakes are injected in tests)
    gemini_api_key: str = field(default="", repr=False)
    anthropic_api_key: str = field(default="", repr=False)
    openai_api_key: str = field(default="", repr=False)
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    anthropic_base_url: str = "https://api.anthropic.com/v1"
    openai_base_url: str = "https://api.openai.com/v1"
    provider_timeout_s: float = 120.0
    reader_retries: int = 1
    reader_retry_delay_s: float = 5.0
    run_deadline_s: float = 295.0
    min_stage_s: float = 10.0  # no new reservation when less run time than this remains
    idempotency_ttl_s: float = 3600.0

    @classmethod
    def from_env(cls) -> "Settings":
        origins = tuple(
            o.strip().rstrip("/")
            for o in os.environ.get("A7_BUDGET_ORIGINS", ",".join(DEFAULT_BUDGET_ORIGINS)).split(",")
            if o.strip()
        )
        return cls(
            engine_authorization=os.environ.get("A7_ENGINE_AUTHORIZATION", ""),
            auth_header=os.environ.get("A7_ENGINE_AUTH_HEADER", "authorization").lower(),
            budget_authorization=os.environ.get("A7_BUDGET_AUTHORIZATION", ""),
            budget_origins=origins,
            budget_fallback_origin=os.environ.get("A7_BUDGET_FALLBACK_ORIGIN", DEFAULT_BUDGET_FALLBACK_ORIGIN).rstrip("/"),
            budget_timeout_s=_float("A7_BUDGET_TIMEOUT_S", 20.0),
            provider_mode=os.environ.get("A7_PROVIDER_MODE", "live"),
            gemini_api_key=os.environ.get("GEMINI_API_KEY", ""),
            anthropic_api_key=os.environ.get("ANTHROPIC_API_KEY", ""),
            openai_api_key=os.environ.get("OPENAI_API_KEY", ""),
            gemini_base_url=os.environ.get("A7_GEMINI_BASE_URL", cls.gemini_base_url),
            anthropic_base_url=os.environ.get("A7_ANTHROPIC_BASE_URL", cls.anthropic_base_url),
            openai_base_url=os.environ.get("A7_OPENAI_BASE_URL", cls.openai_base_url),
            provider_timeout_s=_float("A7_PROVIDER_TIMEOUT_S", 120.0),
            reader_retries=max(0, _int("A7_READER_RETRIES", 1)),
            reader_retry_delay_s=max(0.0, _float("A7_READER_RETRY_DELAY_S", 5.0)),
            run_deadline_s=_float("A7_RUN_DEADLINE_S", 295.0),
            min_stage_s=max(0.0, _float("A7_MIN_STAGE_S", 10.0)),
            idempotency_ttl_s=_float("A7_IDEMPOTENCY_TTL_S", 3600.0),
        )

    def budget_origin_for(self, budget_origin: object) -> str:
        """Same routing as the live n8n expression: a listed origin, else the fallback ledger."""
        if isinstance(budget_origin, str) and budget_origin in self.budget_origins:
            return budget_origin
        return self.budget_fallback_origin
