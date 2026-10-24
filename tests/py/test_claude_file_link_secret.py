"""BE-6, PR A: file links get their own secret (FILE_LINK_SECRET), so rotating it no longer touches resume links, and the other
way round. Without the variable nothing changes. Links signed before it was set (with RESUME_SIGNING_SECRET) still open.
Proposal: claude-outputs/claude-midas-a7-be-6-file-links-proposal-2026-10-22.md (owner's ok, 22 Oct 2026)."""

from __future__ import annotations

import hashlib
import hmac
from contextlib import asynccontextmanager

import httpx

from midas_a7.app import create_app
from midas_a7.config import Settings
from midas_a7.nodes.google_drive import file_signature, new_file_id, view_link

PNG = bytes.fromhex("89504e470d0a1a0a") + b"\0" * 64
RESUME, FILES = "resume-secret-for-tests", "file-link-secret-for-tests"


@asynccontextmanager
async def service(monkeypatch, resume: str = RESUME, files: str | None = None):
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://a7.test")
    monkeypatch.setenv("RESUME_SIGNING_SECRET", resume)
    if files is None:
        monkeypatch.delenv("FILE_LINK_SECRET", raising=False)
    else:
        monkeypatch.setenv("FILE_LINK_SECRET", files)
    app = create_app(Settings(database_url="sqlite://"))
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="https://a7.test") as client:
            yield app, client


def stored_file(app) -> str:
    fid = new_file_id()
    app.state.services.store.file_create(fid, "white_master.png", "image/png", None, PNG, hashlib.sha256(PNG).hexdigest(), None)
    return fid


def link(fid: str, secret: str) -> str:
    return f"/files/{fid}/view?sig={file_signature(secret, fid)}"


async def test_without_the_variable_links_are_unchanged(monkeypatch):
    async with service(monkeypatch) as (app, client):
        fid = stored_file(app)
        assert view_link(app.state.services, fid) == f"https://a7.test{link(fid, RESUME)}", "same bytes as before PR A"
        assert (await client.get(link(fid, RESUME))).status_code == 200


async def test_with_the_variable_new_links_use_it_and_old_links_still_open(monkeypatch):
    async with service(monkeypatch, files=FILES) as (app, client):
        fid = stored_file(app)
        assert view_link(app.state.services, fid) == f"https://a7.test{link(fid, FILES)}"
        assert (await client.get(link(fid, FILES))).status_code == 200
        assert (await client.get(link(fid, RESUME))).status_code == 200, "a link signed before the variable was set"
        assert (await client.get(link(fid, "some-other-secret"))).status_code == 404
        assert (await client.get(f"/files/{fid}/view")).status_code == 404


async def test_rotating_the_resume_secret_leaves_file_links_working(monkeypatch):
    async with service(monkeypatch, files=FILES) as (app, client):
        fid = stored_file(app)
        made = link(fid, FILES)
    async with service(monkeypatch, resume="a-rotated-resume-secret", files=FILES) as (app, client):
        app.state.services.store.file_create(fid, "white_master.png", "image/png", None, PNG, hashlib.sha256(PNG).hexdigest(), None)
        assert (await client.get(made)).status_code == 200
        assert (await client.get(link(fid, RESUME))).status_code == 404, "links signed with the old resume secret stop, as before"


async def test_resume_links_keep_the_resume_secret(monkeypatch):
    async with service(monkeypatch, files=FILES) as (app, _):
        runtime = app.state.runtime
        expected = hmac.new(RESUME.encode(), b"resume:42", hashlib.sha256).hexdigest()
        assert runtime.signature("42") == expected and runtime.signature_ok("42", expected)


async def test_health_says_whether_it_is_set_and_never_its_value(monkeypatch):
    async with service(monkeypatch) as (_, client):
        assert (await client.get("/health")).json()["configured"]["fileLinkSecret"] is False
    async with service(monkeypatch, files=FILES) as (_, client):
        body = (await client.get("/health")).text
        assert '"fileLinkSecret":true' in body.replace(" ", "") and FILES not in body and RESUME not in body


def test_without_the_runtime_the_file_link_secret_still_comes_first():
    """A caller that sets only the resume secret (as the file-store tests do) still signs with FILE_LINK_SECRET when set."""
    from types import SimpleNamespace

    from midas_a7.nodes.google_drive import signing_secret
    svc = SimpleNamespace(extra={"signing_secret": RESUME}, settings=SimpleNamespace(file_link_secret=FILES, resume_secret=RESUME))
    assert signing_secret(svc) == FILES
    svc.settings.file_link_secret = ""
    assert signing_secret(svc) == RESUME
