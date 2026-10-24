"""Phase 1.6 (FL-10, owner's go 22 Oct 2026): shrink a scene reference photo in code, without AI, before the image call.

The scene request sends every reference inline. When they are above the request size set in 04 Settings (max_inline_mb),
19g Scene references asks the engine, through the Code-node helper `this.helpers.midasResizeReference(ref, longSide)`, to
shrink each reference whose long side is above 2048 px to a 2048 px long side. The Code-node runner has no image library,
so the work is done here, with the same Pillow code the Edit Image node uses (nodes/edit_image.py: EXIF orientation applied
first, GraphicsMagick's Lanczos resize). Nothing is cropped and the aspect ratio is kept; an image already at or below
2048 px is never touched. The result is written as JPEG quality 90 (4:4:4); a picture with transparency is laid on white
first, because a JPEG has none. The ICC colour profile is kept; the other EXIF data is not.
"""

from __future__ import annotations

import hashlib
import io
from typing import Any

from PIL import Image

from .edit_image import _decode, _ImageError, _is_gray, _Picture, _resize

LONG_SIDE_PX = 2048
JPEG_QUALITY = 90
MAX_PIXELS = 50_000_000  # larger files are left as they are (never decoded): one decode must not take the whole service's memory


def _jpeg(pic: _Picture, quality: int) -> bytes:
    """JPEG at `quality`, 4:4:4 at 90 and above (as the Edit Image node writes it), with the ICC profile and no other EXIF data.
    Optimised Huffman tables first; a picture whose file would not fit Pillow's buffer for that (very noisy, e.g. a test pattern)
    is written without them."""
    out = pic.im.convert("RGB")
    if pic.gray and _is_gray(out):
        out = out.convert("L")
    extra: dict[str, Any] = {"icc_profile": pic.icc} if pic.icc else {}
    for optimize in (True, False):
        buf = io.BytesIO()
        try:
            out.save(buf, "JPEG", quality=quality, subsampling=0 if quality >= 90 else 2, optimize=optimize, **extra)
        except OSError:
            if not optimize:
                raise
            continue
        return buf.getvalue()
    raise AssertionError("unreachable")


def resize_reference(data: bytes, long_side: int = LONG_SIDE_PX, quality: int = JPEG_QUALITY) -> dict[str, Any]:
    """Shrink `data` to `long_side` px on its long side, or say why it was left as it is.

    Returns {"resized": False, "px": [w, h], "bytes": n, "why": ...} when nothing changed, else {"resized": True,
    "from_px", "to_px", "from_bytes", "to_bytes", "sha256", "mime": "image/jpeg", "data": <jpeg bytes>}.
    """
    if long_side < 1:
        raise ValueError("the long side must be at least 1 px")
    try:
        with Image.open(io.BytesIO(data)) as probe:  # reads the header only
            w, h = probe.size
    except (OSError, ValueError, Image.DecompressionBombError) as exc:
        return {"resized": False, "px": None, "bytes": len(data), "why": f"The image could not be read ({exc})"}
    if w * h > MAX_PIXELS:
        return {"resized": False, "px": [w, h], "bytes": len(data),
                "why": f"it has {w * h} pixels, above the {MAX_PIXELS} this step decodes"}
    try:
        pic = _decode(data)
    except _ImageError as exc:
        return {"resized": False, "px": None, "bytes": len(data), "why": str(exc)}
    w, h = pic.im.size
    if max(w, h) <= long_side:
        return {"resized": False, "px": [w, h], "bytes": len(data), "why": f"its long side is {max(w, h)} px, not above {long_side} px"}
    _resize(pic, long_side, long_side, "onlyIfLarger")
    if pic.matte:
        flat = Image.new("RGB", pic.im.size, (255, 255, 255))
        flat.paste(pic.im, mask=pic.im.getchannel("A"))
        pic.im = flat
    out = _jpeg(pic, quality)
    return {"resized": True, "from_px": [w, h], "to_px": list(pic.im.size), "from_bytes": len(data), "to_bytes": len(out),
            "sha256": hashlib.sha256(out).hexdigest(), "mime": "image/jpeg", "data": out}
