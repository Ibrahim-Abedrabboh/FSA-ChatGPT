"""The flows' Google Drive nodes, backed by this service's own file store (Drive dropped, owner, 20 Oct 2026).

The 13 Drive nodes keep their parameters and output shapes: folder create, file upload and file download.
Files live in the `files` table; `webViewLink` is a signed link to /files/<id>/view on this service. Folder ids
from "04 Settings" (the old Drive root folders) are accepted as plain parent names; nothing is read from Google.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import secrets
from datetime import timezone
from typing import Any

from ..engine.executor import NodeContext, NodeError
from ..engine.model import Item

FOLDER_MIME = "application/vnd.google-apps.folder"
NOT_FOUND = "The resource you are requesting could not be found"


def new_file_id() -> str:
    """Drive-like id: 33 characters of [A-Za-z0-9_-], which the flows' id checks accept."""
    return "1" + secrets.token_urlsafe(24)


def signing_secret(services: Any) -> str:
    """The secret new file links are signed with: FILE_LINK_SECRET when set, else the resume secret (BE-6, PR A)."""
    secret = (services.extra.get("file_link_secret") or services.settings.file_link_secret
              or services.extra.get("signing_secret") or services.settings.resume_secret)
    if not secret:
        raise NodeError("File links cannot be signed: neither FILE_LINK_SECRET nor RESUME_SIGNING_SECRET is set")
    return secret


def accepted_secrets(services: Any) -> list[str]:
    """The secrets a file link may be signed with: the current one, and the resume secret links were signed with before."""
    accepted = services.extra.get("file_link_secrets_accepted")
    if accepted:
        return [s for s in accepted if s]
    secret = services.extra.get("signing_secret", "")
    return [secret] if secret else []


def file_signature(secret: str, file_id: str) -> str:
    return hmac.new(secret.encode(), f"file:{file_id}".encode(), hashlib.sha256).hexdigest()


def view_link(services: Any, file_id: str) -> str:
    sig = file_signature(signing_secret(services), file_id)
    return f"{services.settings.public_base_url}/files/{file_id}/view?sig={sig}"


def _iso(dt) -> str:
    return dt.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _file_resource(services: Any, row: dict[str, Any]) -> dict[str, Any]:
    """The Drive v3 file fields the flows read (id, name, webViewLink, sha256Checksum) plus the usual neighbours."""
    out: dict[str, Any] = {"kind": "drive#file", "id": row["id"], "name": row["name"], "mimeType": row["mime_type"]}
    if row.get("parent_id"):
        out["parents"] = [row["parent_id"]]
    out["webViewLink"] = view_link(services, row["id"])
    if not row.get("is_folder"):
        out.update({"size": str(row["size"]), "md5Checksum": row.get("md5"), "sha256Checksum": row.get("sha256"),
                    "originalFilename": row["name"]})
    out["createdTime"] = out["modifiedTime"] = _iso(row["created_at"])
    return out


async def _one(ctx: NodeContext, item: Item, p: Any) -> Item:
    store = ctx.services.store
    resource = p.get("resource", "file")
    operation = p.get("operation", "create" if resource == "folder" else "upload")
    if resource == "folder" and operation == "create":
        name = str(p.get("name") or "Untitled")
        row = await asyncio.to_thread(store.file_create, new_file_id(), name, FOLDER_MIME, p.rl("folderId") or None, None)
        res = _file_resource(ctx.services, row)
        return {"json": {k: res[k] for k in ("kind", "id", "name", "mimeType")}}
    if resource == "file" and operation == "upload":
        key = p.get("inputDataFieldName") or "data"
        ref = (item.get("binary") or {}).get(key)
        if not ref:
            raise NodeError(f"This operation expects the node's input data to contain a binary file '{key}', but none was found")
        data = await ctx.services.binaries.get(ref)
        name = str(p.get("name") or ref.get("fileName") or "Untitled")
        mime = ref.get("mimeType") or "application/octet-stream"
        row = await asyncio.to_thread(store.file_create, new_file_id(), name, mime, p.rl("folderId") or None, data,
                                      hashlib.sha256(data).hexdigest(), hashlib.md5(data).hexdigest())
        return {"json": _file_resource(ctx.services, row)}
    if resource == "file" and operation == "download":
        file_id = str(p.rl("fileId") or "")
        row = await asyncio.to_thread(store.file_get, file_id) if file_id else None
        if not row or row.get("is_folder") or row.get("data") is None:
            raise NodeError(NOT_FOUND, description=f"File not found: {file_id}", http_code="404")
        prop = (p.get("options") or {}).get("binaryPropertyName") or "data"
        stored = await ctx.services.binaries.put(ctx.execution.id, bytes(row["data"]), row["mime_type"], row["name"])
        return {"json": item.get("json", {}), "binary": {**(item.get("binary") or {}), prop: stored}}
    raise NodeError(f"Drive operation '{resource}.{operation}' is not supported")


async def google_drive(ctx: NodeContext):
    params = await ctx.params()
    out: list[Item] = []
    for item, p in zip(ctx.items, params):
        try:
            out.append(await _one(ctx, item, p))
        except NodeError as exc:
            if not ctx.continue_on_fail:
                raise
            out.append({"json": {"error": str(exc)}})
    return [out]


HANDLERS = {"googleDrive": google_drive}
