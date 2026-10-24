"""Settings and credentials, read from the environment only. No secret is stored in the repo."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
PACKAGE_DIR = Path(__file__).resolve().parent


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


@dataclass(frozen=True)
class HeaderCredential:
    header: str
    value: str


@dataclass(frozen=True)
class Settings:
    database_url: str = field(default_factory=lambda: _env("DATABASE_URL", "sqlite:///./midas_a7.db"))
    # Public address of this service; resume URLs and webhook URLs are built from it.
    public_base_url: str = field(default_factory=lambda: _env("PUBLIC_BASE_URL", "http://localhost:8080").rstrip("/"))
    # Addresses the flows still name for their own webhooks (the former n8n host). Calls to them stay in process.
    self_aliases: tuple[str, ...] = field(default_factory=lambda: tuple(
        a.strip().rstrip("/") for a in _env("SELF_BASE_ALIASES", "https://ibrahimnewaeon.app.n8n.cloud").split(",") if a.strip()))
    resume_secret: str = field(default_factory=lambda: _env("RESUME_SIGNING_SECRET"))
    # Signs the private file links (BE-6, PR A). While it is not set, file links keep using RESUME_SIGNING_SECRET.
    file_link_secret: str = field(default_factory=lambda: _env("FILE_LINK_SECRET"))
    schedules_enabled: bool = field(default_factory=lambda: _env("SCHEDULES_ENABLED", "false").lower() == "true")
    data_tables_path: Path = field(default_factory=lambda: Path(_env("DATA_TABLES_PATH", str(PACKAGE_DIR / "data" / "data-tables.json"))))
    seeds_dir: Path = field(default_factory=lambda: Path(_env("SEEDS_DIR", str(PACKAGE_DIR / "data" / "seeds"))))


# Credential names used by the flows -> environment variables holding their values.
HEADER_CREDENTIALS = {
    # Owner site (Netlify) <-> this service, both directions. Same value as the site's A7_READ_AUTHORIZATION.
    "A7 GPT bridge inbound": ("A7_BRIDGE_HEADER_NAME", "Authorization", "A7_BRIDGE_HEADER_VALUE"),
    # Main intake and analysis-only intake.
    "Claude · Midas client header": ("MIDAS_CLIENT_HEADER_NAME", "X-Midas-Key", "MIDAS_CLIENT_HEADER_VALUE"),
    # Owner decision intake.
    "Claude · Midas owner header": ("MIDAS_OWNER_HEADER_NAME", "X-Midas-Owner-Key", "MIDAS_OWNER_HEADER_VALUE"),
}

API_KEYS = {
    "openAiApi": "OPENAI_API_KEY",
    "googlePalmApi": "GEMINI_API_KEY",
    "anthropicApi": "ANTHROPIC_API_KEY",
}


class MissingCredential(Exception):
    pass


class Credentials:
    """Looks up a node's credential by the name it had in n8n, else by its type."""

    def header(self, name: str) -> HeaderCredential:
        spec = HEADER_CREDENTIALS.get(name)
        if not spec:
            raise MissingCredential(f"Unknown header credential '{name}'")
        header_env, header_default, value_env = spec
        value = _env(value_env)
        if not value:
            raise MissingCredential(f"Credential '{name}' is not configured (set {value_env})")
        return HeaderCredential(_env(header_env, header_default), value)

    def api_key(self, cred_type: str) -> str:
        env = API_KEYS.get(cred_type)
        if not env:
            raise MissingCredential(f"Unknown credential type '{cred_type}'")
        value = _env(env)
        if not value:
            raise MissingCredential(f"Credential '{cred_type}' is not configured (set {env})")
        return value

    def configured(self) -> dict[str, bool]:
        """Which credentials are set, for /health. Never returns values."""
        out = {name: bool(_env(spec[2])) for name, spec in HEADER_CREDENTIALS.items()}
        out.update({t: bool(_env(env)) for t, env in API_KEYS.items()})
        # Not a secret, but an organisation-level Anthropic key is useless without it, so /health says whether it is set.
        out["anthropicWorkspaceId"] = bool(_env("ANTHROPIC_WORKSPACE_ID").strip())
        # File links have their own secret once it is set (BE-6); until then they use the resume secret.
        out["fileLinkSecret"] = bool(_env("FILE_LINK_SECRET"))
        return out
