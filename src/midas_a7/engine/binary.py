"""Binary files of a run (photos, images, manifests). Items carry references; bytes live in the store."""

from __future__ import annotations

import asyncio
import base64
import mimetypes
from typing import Any

FILE_TYPES = {"image": "image", "video": "video", "audio": "audio", "text": "text"}


def sniff_mime(data: bytes) -> str | None:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if data[:2] == b"BM":
        return "image/bmp"
    if data.startswith(b"%PDF"):
        return "application/pdf"
    return None


def pretty_size(n: int) -> str:
    """Same style as n8n's fileSize, e.g. '2.24 MB'."""
    if n < 1000:
        return f"{n} B"
    for unit in ("kB", "MB", "GB", "TB"):
        n_f = n / 1000.0
        if n_f < 1000 or unit == "TB":
            return f"{float(f'{n_f:.3g}'):g} {unit}"
        n = int(n_f)
    return f"{n} B"


def make_ref(binary_id: str, data: bytes, mime_type: str | None, file_name: str | None,
             file_extension: str | None = None) -> dict[str, Any]:
    mime = mime_type or sniff_mime(data) or (mimetypes.guess_type(file_name or "")[0] if file_name else None) or "application/octet-stream"
    ext = file_extension
    if not ext and file_name and "." in file_name:
        ext = file_name.rsplit(".", 1)[1].lower()
    if not ext:
        guessed = mimetypes.guess_extension(mime) or ""
        ext = {".jpe": "jpg", ".jpeg": "jpg"}.get(guessed, guessed.lstrip("."))
    ref: dict[str, Any] = {"mimeType": mime}
    major = mime.split("/", 1)[0]
    if mime == "application/json":
        ref["fileType"] = "json"
    elif mime == "application/pdf":
        ref["fileType"] = "pdf"
    elif major in FILE_TYPES:
        ref["fileType"] = FILE_TYPES[major]
    if ext:
        ref["fileExtension"] = ext
    if file_name:
        ref["fileName"] = file_name
    ref.update({"id": binary_id, "fileSize": pretty_size(len(data)), "bytes": len(data), "data": "filesystem-v2"})
    return ref


class BinaryStore:
    def __init__(self, store: Any):
        self.store = store

    async def put(self, execution_id: str, data: bytes, mime_type: str | None = None, file_name: str | None = None,
                  file_extension: str | None = None) -> dict[str, Any]:
        bid = await asyncio.to_thread(self.store.put_binary, execution_id, data, mime_type, file_name)
        return make_ref(bid, data, mime_type, file_name, file_extension)

    async def get(self, ref: dict[str, Any]) -> bytes:
        bid = (ref or {}).get("id")
        inline = (ref or {}).get("data")
        if not str(bid or "").startswith("bin:") and isinstance(inline, str) and inline != "filesystem-v2":
            return base64.b64decode(inline)  # bytes carried inline, as n8n allows
        if not bid:
            raise KeyError("binary reference has no id")
        data = await asyncio.to_thread(self.store.get_binary, bid)
        if data is None:
            raise KeyError(f"binary {bid} not found")
        return data
