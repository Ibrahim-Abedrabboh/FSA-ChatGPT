"""The flows' Drive nodes on the service's own file store (Google Drive dropped, 20 Oct 2026)."""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
from pathlib import Path

import httpx
import pytest
from conftest import link, make_flow, run_flow

from midas_a7.app import create_app
from midas_a7.config import Settings
from midas_a7.engine.model import load_flow

ROOT = Path(__file__).resolve().parents[2]
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


def drive_node(name, params, pos, **extra):
    return {"name": name, "type": "n8n-nodes-base.googleDrive", "typeVersion": 3, "position": list(pos),
            "parameters": params, **extra}


def code(name, js, pos):
    return {"name": name, "type": "n8n-nodes-base.code", "typeVersion": 2, "position": list(pos), "parameters": {"jsCode": js}}


MAKE_FILE = ("const b = await this.helpers.prepareBinaryData(Buffer.from('89504e470d0a1a0a' + '00'.repeat(64), 'hex'),"
             " 'white_master.png', 'image/png'); return [{json:{}, binary:{image:b}}];")


@pytest.fixture(autouse=True)
def signing(services):
    services.extra["signing_secret"] = "file-secret-for-tests"


async def test_folder_upload_download_round_trip(executor, services):
    flow = make_flow([
        {"name": "Start", "type": "n8n-nodes-base.manualTrigger", "typeVersion": 1, "position": [0, 0], "parameters": {}},
        code("Make", MAKE_FILE, (200, 0)),
        drive_node("Folder", {"resource": "folder", "name": "owner-1 · run-1", "driveId": {"__rl": True, "mode": "list", "value": "My Drive"},
                              "folderId": {"__rl": True, "mode": "id", "value": "1EwLz7rootfolder"}}, (400, 0)),
        code("Attach", "return [{json:{folder: $('Folder').first().json.id}, binary: $('Make').first().binary}];", (600, 0)),
        drive_node("Upload", {"inputDataFieldName": "image", "name": "={{ 'white_master_' + $json.folder.slice(0,4) + '.png' }}",
                              "driveId": {"__rl": True, "mode": "list", "value": "My Drive"},
                              "folderId": {"__rl": True, "mode": "id", "value": "={{ $json.folder }}"}, "options": {"simplifyOutput": False}}, (800, 0)),
        drive_node("Download", {"operation": "download", "fileId": {"__rl": True, "mode": "id", "value": "={{ $json.id }}"},
                                "options": {"binaryPropertyName": "data"}}, (1000, 0)),
        code("Read", "const b = await this.helpers.getBinaryDataBuffer(0, 'data'); return [{json:{n: b.length, mime: $input.first().binary.data.mimeType}}];", (1200, 0)),
    ], link(("Start", "Make"), ("Make", "Folder"), ("Folder", "Attach"), ("Attach", "Upload"), ("Upload", "Download"), ("Download", "Read")))
    ex = await run_flow(executor, flow, [{"json": {}}])
    assert ex.status == "success", ex.error
    folder = ex.latest_output("Folder")[0]["json"]
    assert folder["mimeType"] == "application/vnd.google-apps.folder" and re.fullmatch(r"[A-Za-z0-9_-]{33}", folder["id"])
    up = ex.latest_output("Upload")[0]["json"]
    assert up["parents"] == [folder["id"]] and up["name"].startswith("white_master_") and up["mimeType"] == "image/png"
    assert up["sha256Checksum"] == hashlib.sha256(PNG).hexdigest() and up["size"] == str(len(PNG))
    assert re.fullmatch(r"https://a7\.test/files/[A-Za-z0-9_-]{33}/view\?sig=[a-f0-9]{64}", up["webViewLink"])
    assert ex.latest_output("Read")[0]["json"] == {"n": len(PNG), "mime": "image/png"}


async def test_download_of_an_unknown_file(executor):
    params = {"operation": "download", "fileId": {"__rl": True, "mode": "id", "value": "1missingmissingmissing"}}
    flow = make_flow([
        {"name": "Start", "type": "n8n-nodes-base.manualTrigger", "typeVersion": 1, "position": [0, 0], "parameters": {}},
        drive_node("Download", params, (200, 0), onError="continueRegularOutput"),
    ], link(("Start", "Download")))
    ex = await run_flow(executor, flow, [{"json": {}}])
    assert ex.latest_output("Download") == [{"json": {"error": "The resource you are requesting could not be found"}}]


async def test_real_upload_node_of_stage_04(executor, services):
    """The frozen '15n Drive upload' node, unchanged, stores the image and reports its checksum and link."""
    a7 = load_flow("midas_a7.flows.a7_main")
    node = next(n for n in a7.nodes.values() if n.name == "15n Drive upload")
    raw = {"name": node.name, "type": node.type, "typeVersion": node.type_version, "position": [400, 0], "parameters": node.parameters}
    make = ("const b = await this.helpers.prepareBinaryData(Buffer.from('89504e470d0a1a0a' + '00'.repeat(64), 'hex'), 'x.png', 'image/png');"
            " return [{json:{s04:{receipt:{image:{file_name:'owner-1_white_master_try1.png'}}, drive_folder:{id:'1folderfolderfolder'}}}, binary:{image:b}}];")
    flow = make_flow([
        {"name": "Start", "type": "n8n-nodes-base.manualTrigger", "typeVersion": 1, "position": [0, 0], "parameters": {}},
        code("Make", make, (200, 0)), raw,
    ], link(("Start", "Make"), ("Make", node.name)))
    ex = await run_flow(executor, flow, [{"json": {}}])
    up = ex.latest_output(node.name)[0]["json"]
    assert up["name"] == "owner-1_white_master_try1.png" and up["parents"] == ["1folderfolderfolder"]
    assert up["sha256Checksum"] == hashlib.sha256(PNG).hexdigest()


async def test_signed_view_route(monkeypatch):
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://a7.test")
    monkeypatch.setenv("RESUME_SIGNING_SECRET", "file-secret-for-tests")
    app = create_app(Settings(database_url="sqlite://"))
    async with app.router.lifespan_context(app):
        svc = app.state.services
        from midas_a7.nodes.google_drive import new_file_id, view_link
        fid = new_file_id()
        svc.store.file_create(fid, "white_master.png", "image/png", None, PNG, hashlib.sha256(PNG).hexdigest(), None)
        url = view_link(svc, fid)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="https://a7.test") as c:
            r = await c.get(url)
            assert r.status_code == 200 and r.content == PNG and r.headers["content-type"] == "image/png"
            assert r.headers["cache-control"] == "private, no-store" and r.headers["x-content-type-options"] == "nosniff"
            assert (await c.get(url[:-4] + "0000")).status_code == 404
            assert (await c.get(f"/files/{fid}/view")).status_code == 404
            other = new_file_id()
            assert (await c.get(url.replace(fid, other))).status_code == 404


def test_bridge_keeps_only_service_file_links():
    """The patched drive() of the owner bridge passes the service's signed links and nothing else."""
    src = (ROOT / "src/midas_a7/flows/owner_bridge/code/Safe_approval_context.js").read_text(encoding="utf-8")
    fn = src[src.index("function drive(v){"):src.index("\n}", src.index("function drive(v){")) + 2]
    good = "https://midas-a7.up.railway.app/files/1" + "a" * 32 + "/view?sig=" + "b" * 64
    cases = [good, "https://drive.google.com/file/d/abc/view", "http://midas-a7.up.railway.app/files/1aaaaaaaaaaa/view?sig=" + "b" * 64,
             good + "&x=1", "javascript:alert(1)", None]
    js = fn + "\nconsole.log(JSON.stringify(" + json.dumps(cases) + ".map(drive)));"
    out = json.loads(subprocess.run(["node", "-e", js], capture_output=True, text=True, check=True).stdout)
    assert out == [good, None, None, None, None, None]


def test_manifest_records_the_patch():
    manifest = json.loads((ROOT / "src/midas_a7/flows/manifest.json").read_text())
    bridge = next(m for m in manifest if m["package"] == "owner_bridge")
    assert [p["file"] for p in bridge["patches"]] == ["Safe_approval_context.js"]
