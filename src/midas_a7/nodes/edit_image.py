"""Edit Image node (n8n-nodes-base.editImage, typeVersion 1.1) with Pillow, as the A7 flows use it.

n8n (packages/nodes-base/nodes/EditImage/EditImage.node.ts) drives GraphicsMagick through the `gm` npm module:

    gm convert -background transparent [-quality Q] - -orient TopLeft <steps> FORMAT:-

with EXIF auto-orientation applied first. This module reproduces what GraphicsMagick does for the steps the flows
use (checked against GraphicsMagick 1.3.42 Q16 and its 1.3.46 source, coders/{bmp,jpeg,webp}.c, magick/resize.c):

- resize `WxH!` (and the other geometry flags): Lanczos when shrinking a full-colour opaque picture, done in
  floating point in GraphicsMagick's pass order, so pixels match GraphicsMagick to within 1 level. GraphicsMagick
  switches to its Mitchell filter for palette/grey sources, pictures with transparency and enlargements; Pillow has
  no Mitchell filter, so those cases use its bicubic filter (close, not identical).
- rotate: quarter turns are exact; the remainder (not used by the flows) is a bilinear rotation on the background.
  A rotation of 0 (the flows' "to pixels" steps) leaves the picture unchanged: the step is a format conversion.
- jpeg: the encoder settings GraphicsMagick uses (quality default 75, 4:4:4 chroma at quality 90 and above, else
  4:2:0, optimised Huffman tables, one channel for a grey source) and its JFIF density, which gives byte-identical
  files for the same pixels.
- webp: libwebp lossy at quality 75 (GraphicsMagick's default), method 4: byte-identical.
- bmp: what GraphicsMagick writes for a full-colour picture: 24-bit BI_RGB rows bottom-up, padded to 4 bytes, a
  40-byte header (108/124 bytes when the source carries colour information), or 32-bit BI_BITFIELDS (B, G, R, A
  bytes) with a version 4 header when the picture has transparency. The A7 Code nodes 18e3 and 18h parse these.
  (GraphicsMagick writes an 8-bit palette BMP for a grey or palette source that is not resampled; those nodes
  cannot read that kind, so a 24-bit file is written instead: same pixel values.)

Output binary metadata follows the node: the other binaries of the item are kept, the destination key gets
fileExtension/mimeType from the format, the file name from options.fileName, then the type sniffed from the new
bytes (n8n calls prepareBinaryData(buffer) without a name or type: jpeg -> image/jpeg, "jpg").
"""

from __future__ import annotations

import asyncio
import copy
import io
import math
import struct
from dataclasses import dataclass
from typing import Any

from PIL import Image, ImageChops, ImageColor, ImageMath, ImageOps, UnidentifiedImageError

from ..engine.executor import NodeContext, NodeError
from ..engine.model import Item

VALID_FORMATS = ("bmp", "gif", "jpeg", "png", "tiff", "tif", "webp")
# Parameter defaults n8n fills into each multiStep entry (and the single-operation parameters).
STEP_DEFAULTS: dict[str, dict[str, Any]] = {
    "resize": {"width": 500, "height": 500, "resizeOption": "maximumArea"},
    "rotate": {"rotate": 0, "backgroundColor": "#ffffffff"},
}
NUMERIC_PARAMS = {"resize": ("width", "height"), "rotate": ("rotate",)}
RESIZE_FLAGS = {"ignoreAspectRatio": "!", "minimumArea": "^", "onlyIfSmaller": "<", "onlyIfLarger": ">", "percent": "%"}
GM_DEFAULT_QUALITY = 75
GM_DEFAULT_PPM = 75 * 39  # BMP pixels per metre when the resolution unit is not known
_GRAY_MODES = ("1", "L", "LA", "La", "I", "I;16", "I;16L", "I;16B", "I;16N", "F")
_PALETTE_MODES = ("1", "L", "P", "I", "I;16", "I;16L", "I;16B", "I;16N")
_ALPHA_MODES = ("RGBA", "RGBa", "LA", "La", "PA")


class _ImageError(Exception):
    pass


@dataclass
class _Picture:
    """The working picture and the GraphicsMagick image state that changes how it is written."""

    im: Image.Image  # "RGB" or "RGBA"
    source_format: str
    gray: bool  # GraphicsMagick's is_grayscale: a jpeg is written with one channel
    pseudo: bool  # palette or grey source (PseudoClass): GraphicsMagick resizes it with Mitchell
    units: str | None  # "inch", "cm" or None, with x_res/y_res as GraphicsMagick reads them
    x_res: float = 72.0
    y_res: float = 72.0
    gamma: float = 0.0
    intent: int = 0  # GraphicsMagick RenderingIntent (PNG sRGB intent + 1)
    chroma: tuple[float, ...] | None = None  # (wx, wy, rx, ry, gx, gy, bx, by)
    icc: bytes | None = None
    exif: bytes | None = None

    @property
    def matte(self) -> bool:
        return self.im.mode == "RGBA"


# ---------- reading ----------
def _f32(v: float) -> float:
    """A C float literal (GraphicsMagick stores 0.6400f etc.) as a double."""
    return struct.unpack("<f", struct.pack("<f", v))[0]


_SRGB_CHROMA = tuple(_f32(v) for v in (0.3127, 0.3290, 0.6400, 0.3300, 0.3000, 0.6000, 0.1500, 0.0600))


def _resolution(fmt: str, data: bytes, info: dict[str, Any]) -> tuple[str | None, float, float]:
    """Resolution as GraphicsMagick's readers set it (default 72, unit unknown)."""
    if fmt == "BMP" and len(data) >= 46 and struct.unpack_from("<I", data, 14)[0] >= 40:
        xp, yp = struct.unpack_from("<ii", data, 38)
        return "cm", xp / 100.0, yp / 100.0
    if fmt == "PNG":
        if "dpi" in info:  # pHYs in pixels per metre; Pillow turned it into dpi
            px, py = (round(float(v) / 0.0254) for v in info["dpi"])
            return "cm", px / 100.0, py / 100.0
        if "aspect" in info:
            ax, ay = info["aspect"]
            return None, float(ax), float(ay)
    if fmt == "JPEG" and "jfif" in info:
        dx, dy = info.get("jfif_density", (1, 1))
        if dx != 1 and dy != 1:
            return {1: "inch", 2: "cm"}.get(int(info.get("jfif_unit", 0))), float(dx), float(dy)
    return None, 72.0, 72.0


def _decode(data: bytes) -> _Picture:
    try:
        src = Image.open(io.BytesIO(data))
        src.load()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise _ImageError(f"The image could not be read ({exc})") from exc
    fmt = src.format or ""
    info = dict(src.info)
    mode = src.mode
    units, xr, yr = _resolution(fmt, data, info)
    pic = _Picture(im=src, source_format=fmt, gray=mode in _GRAY_MODES, pseudo=mode in _PALETTE_MODES or fmt == "GIF",
                   units=units, x_res=xr, y_res=yr, icc=info.get("icc_profile") or None)
    if fmt == "PNG":
        if info.get("srgb") is not None:
            pic.intent = int(info["srgb"]) + 1
            pic.gamma, pic.chroma = _f32(0.45455), _SRGB_CHROMA
        else:
            pic.gamma = float(info.get("gamma") or 0.0)
            if info.get("chromaticity"):
                pic.chroma = tuple(float(v) for v in info["chromaticity"])
    # gm's autoOrient: turn the picture by its EXIF orientation (Pillow drops the tag from the EXIF it keeps).
    im = ImageOps.exif_transpose(src) or src
    exif = im.info.get("exif")
    pic.exif = exif if isinstance(exif, bytes) and exif else None
    if im.mode in ("I", "I;16", "I;16L", "I;16B", "I;16N"):
        im = im.convert("I").point(lambda v: v * (1 / 257)).convert("L")  # 16-bit grey to 8 bits
    matte = im.mode in _ALPHA_MODES or "transparency" in im.info
    pic.im = im.convert("RGBA" if matte else "RGB")
    return pic


# ---------- steps ----------
def _geometry_size(w: int, h: int, width: float, height: float, flag: str) -> tuple[int, int]:
    """GraphicsMagick GetMagickGeometry for "<width>x<height><flag>" (magick/utility.c)."""
    tw, th = math.floor(width + 0.5), math.floor(height + 0.5)
    if tw <= 0 or th <= 0:
        raise _ImageError(f"Invalid resize geometry {width}x{height}{flag}")
    if flag == "@":
        target, area = float(tw * th), float(w * h)
        if target <= 0.25:
            return w, h
        scale = 1.0 / math.sqrt(area / target)
        return max(1, math.floor(w * scale + 0.25)), max(1, math.floor(h * scale + 0.25))
    fw, fh = w, h
    if flag == "%":
        tw, th = math.floor(width * fw / 100.0 + 0.5), math.floor(height * fh / 100.0 + 0.5)
        fw, fh = tw, th
    if flag != "!" and (tw != fw or th != fh):
        sw, sh = tw / fw, th / fh
        scale = (sh if sw < sh else sw) if flag == "^" else (sh if sw > sh else sw)
        tw, th = max(1, math.floor(scale * fw + 0.5)), max(1, math.floor(scale * fh + 0.5))
    if flag == ">":
        tw, th = min(tw, fw), min(th, fh)
    if flag == "<":
        tw, th = max(tw, fw), max(th, fh)
    return tw, th


def _clamp(band: Image.Image) -> Image.Image:
    return ImageMath.lambda_eval(lambda e: e["min"](e["max"](e["x"], 0.0), 255.0), x=band)


def _filter_pass(bands: list[Image.Image], size: tuple[int, int], filt: int, matte: bool) -> list[Image.Image]:
    """One GraphicsMagick filter pass (HorizontalFilter or VerticalFilter) on float bands.

    With transparency the colour is weighted by opacity and divided by the summed weight again (normalize, or 1 when
    that is ~0); every pass stores clamped values, as GraphicsMagick does in its Q16 pixels.
    """
    if not matte:
        return [_clamp(b.resize(size, filt)) for b in bands]
    *rgb, a = bands
    af = ImageMath.lambda_eval(lambda e: e["a"] / 255.0, a=a)
    prem = [ImageMath.lambda_eval(lambda e: e["c"] * e["w"], c=c, w=af).resize(size, filt) for c in rgb]
    af = af.resize(size, filt)
    den = ImageMath.lambda_eval(lambda e: e["w"] + (abs(e["w"]) <= 1e-12) * (1.0 - e["w"]), w=af)
    rgb = [_clamp(ImageMath.lambda_eval(lambda e: e["p"] / e["d"], p=pm, d=den)) for pm in prem]
    return [*rgb, _clamp(ImageMath.lambda_eval(lambda e: e["w"] * 255.0, w=af))]


def _resize(pic: _Picture, width: float, height: float, option: str) -> None:
    im = pic.im
    w, h = im.size
    W, H = _geometry_size(w, h, width, height, RESIZE_FLAGS.get(option, "@"))
    if (W, H) == (w, h):
        return  # GraphicsMagick returns a clone: nothing is resampled
    mitchell = pic.pseudo or pic.matte or (W / w) * (H / h) > 1.0
    filt = Image.Resampling.BICUBIC if mitchell else Image.Resampling.LANCZOS
    # GraphicsMagick runs the cheaper pass first, in floating point (Q16) between the passes.
    first = (W, h) if W * (h + H) > H * (w + W) else (w, H)
    bands = [b.convert("F") for b in im.split()]
    bands = _filter_pass(_filter_pass(bands, first, filt, pic.matte), (W, H), filt, pic.matte)
    pic.im = Image.merge(im.mode, [b.convert("L") for b in bands])
    pic.pseudo = False  # the resized picture is full colour (DirectClass)


def _parse_color(value: Any) -> tuple[int, int, int, int]:
    """A colour as GraphicsMagick reads it: in #RRGGBBAA / #RGBA the last part is opacity, not alpha."""
    s = str(value or "").strip()
    if s.lower() in ("", "none", "transparent"):
        return (0, 0, 0, 0)
    if s.startswith("#") and len(s) in (5, 9):
        n = (len(s) - 1) // 4
        r, g, b, o = (int(s[1 + i * n:1 + (i + 1) * n] * (2 if n == 1 else 1), 16) for i in range(4))
        return (r, g, b, 255 - o)
    try:
        c = ImageColor.getrgb(s)
    except ValueError as exc:
        raise _ImageError(f"Unrecognized color '{s}'") from exc
    return (c[0], c[1], c[2], c[3] if len(c) > 3 else 255)


def _rotate(pic: _Picture, degrees: float, background: Any) -> None:
    """GraphicsMagick RotateImage: whole quarter turns (clockwise) first, then the rest up to 45 degrees."""
    angle = degrees - 360.0 * int(degrees / 360)
    if angle < -45.0:
        angle += 360.0
    turns = 0
    while angle > 45.0:
        angle -= 90.0
        turns += 1
    turns %= 4
    if turns:
        quarter = {1: Image.Transpose.ROTATE_270, 2: Image.Transpose.ROTATE_180, 3: Image.Transpose.ROTATE_90}
        pic.im = pic.im.transpose(quarter[turns])
    if math.tan(math.radians(angle) / 2.0) == 0.0 or math.sin(math.radians(angle)) == 0.0:
        return
    fill = _parse_color(background)
    if fill[3] < 255 and not pic.matte:
        pic.im = pic.im.convert("RGBA")
    pic.im = pic.im.rotate(-angle, resample=Image.Resampling.BILINEAR, expand=True,
                           fillcolor=fill if pic.matte else fill[:3])
    pic.pseudo = False


# ---------- writing ----------
def _is_gray(im: Image.Image) -> bool:
    r, g, b = im.split()[:3]
    return ImageChops.difference(r, g).getbbox() is None and ImageChops.difference(g, b).getbbox() is None


def _jfif_density(data: bytes, pic: _Picture) -> bytes:
    """Write GraphicsMagick's JFIF density (unit 1 = dpi unless the resolution is per cm; (short) x_res)."""
    if len(data) < 18 or data[2:4] != b"\xff\xe0" or data[6:11] != b"JFIF\x00":
        return data
    if not (0 <= pic.x_res < 32767 and 0 <= pic.y_res < 32767):
        return data[:13] + struct.pack(">BHH", 1, 1, 1) + data[18:]
    unit = 2 if pic.units == "cm" else 1
    return data[:13] + struct.pack(">BHH", unit, int(pic.x_res), int(pic.y_res)) + data[18:]


def _bmp_ppm(pic: _Picture) -> tuple[int, int]:
    if pic.units == "inch":
        return int(100.0 * pic.x_res / 2.54), int(100.0 * pic.y_res / 2.54)
    if pic.units == "cm":
        return int(100.0 * pic.x_res), int(100.0 * pic.y_res)
    return GM_DEFAULT_PPM, GM_DEFAULT_PPM


_BMP_INTENT = {1: 1, 4: 2, 2: 4, 3: 8}  # GraphicsMagick Saturation/Relative/Perceptual/Absolute -> LCS_GM_*


def _encode_bmp(pic: _Picture) -> bytes:
    """GraphicsMagick's WriteBMPImage (type 4) for a full-colour picture."""
    im = pic.im
    w, h = im.size
    bits = 32 if pic.matte else 24
    stride = ((w * bits + 31) // 32) * 4
    have_color_info = bool(pic.intent or pic.icc or pic.gamma)
    head = 40
    if pic.matte or have_color_info:
        head = 124 if (pic.intent or pic.icc) else 108
    offset = 14 + head
    size = stride * h
    xp, yp = _bmp_ppm(pic)
    comp = 3 if pic.matte else 0
    out = bytearray(b"BM" + struct.pack("<III", offset + size, 0, offset))
    out += struct.pack("<IiiHHIIiiII", head, w, h, 1, bits, comp, size, xp, yp, 0, 0)
    if head > 40:
        out += struct.pack("<IIIII", 0x00FF0000, 0x0000FF00, 0x000000FF, 0xFF000000, 1)  # masks, calibrated RGB
        wx, wy, rx, ry, gx, gy, bx, by = pic.chroma or (0.0,) * 8
        k = 0x3FFFFFF
        ends = []
        for x, y in ((rx, ry), (gx, gy), (bx, by)):
            ends += [int(x * k) & 0xFFFFFFFF, int(y * k) & 0xFFFFFFFF, int(1.0 - (x + y) * k) & 0xFFFFFFFF]
        out += struct.pack("<9I", *ends) + struct.pack("<III", 0, 0, 0)  # gamma scale is never written
        if head == 124:
            out += struct.pack("<IIII", _BMP_INTENT.get(pic.intent, 0), 0, 0, 0)
    out += im.tobytes("raw", "BGRA" if pic.matte else "BGR", stride, -1)
    return bytes(out)


def _encode(pic: _Picture, fmt: str, quality: float | None) -> bytes:
    im = pic.im
    buf = io.BytesIO()
    extra: dict[str, Any] = {}
    if pic.icc:
        extra["icc_profile"] = pic.icc
    if fmt == "bmp":
        return _encode_bmp(pic)
    if fmt == "jpeg":
        q = GM_DEFAULT_QUALITY if quality is None else int(quality)
        q = max(0, min(100, q))
        if pic.exif:
            extra["exif"] = pic.exif
        out = im.convert("RGB")  # a jpeg has no transparency: GraphicsMagick writes the colour channels as they are
        if pic.gray and _is_gray(out):
            out = out.convert("L")
        out.save(buf, "JPEG", quality=q, subsampling=0 if q >= 90 else 2, optimize=True, **extra)
        return _jfif_density(buf.getvalue(), pic)
    if fmt == "webp":
        q = GM_DEFAULT_QUALITY if quality is None else int(quality)  # gm keeps the quality as a whole number
        if pic.exif:
            extra["exif"] = pic.exif
        im.save(buf, "WEBP", quality=max(0, min(100, q)), method=4, **extra)
        return buf.getvalue()
    if fmt == "png":
        q = GM_DEFAULT_QUALITY if quality is None else int(quality)
        out = im.convert("LA" if pic.matte else "L") if pic.gray and _is_gray(im) else im
        out.save(buf, "PNG", compress_level=max(0, min(9, q // 10)), **extra)
        return buf.getvalue()
    if fmt == "gif":
        im.save(buf, "GIF")
        return buf.getvalue()
    if fmt in ("tiff", "tif"):
        im.save(buf, "TIFF", **extra)
        return buf.getvalue()
    raise _ImageError(f"Writing {fmt} is not supported")


_SOURCE_FORMATS = {"JPEG": "jpeg", "PNG": "png", "WEBP": "webp", "BMP": "bmp", "GIF": "gif", "TIFF": "tiff"}


def sniff(data: bytes) -> tuple[str, str] | None:
    """(mimeType, extension) the way n8n's file-type package names a new image buffer."""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", "jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp", "webp"
    if data[:2] == b"BM":
        return "image/bmp", "bmp"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif", "gif"
    if data[:4] in (b"II*\x00", b"MM\x00*"):
        return "image/tiff", "tif"
    return None


def render(data: bytes, steps: list[dict[str, Any]], fmt: str | None, quality: float | None) -> bytes:
    """Run the steps on an image file and write it (in `fmt`, or the source format when none is set)."""
    pic = _decode(data)
    for step in steps:
        name = step.get("operation")
        if name == "resize":
            _resize(pic, step["width"], step["height"], str(step.get("resizeOption") or "maximumArea"))
        elif name == "rotate":
            _rotate(pic, step["rotate"], step.get("backgroundColor"))
    out_fmt = fmt or _SOURCE_FORMATS.get(pic.source_format)
    if not out_fmt:
        raise _ImageError(f"Writing {pic.source_format or 'this image format'} is not supported")
    return _encode(pic, out_fmt, quality)


# ---------- the node ----------
def _number(value: Any, name: str) -> float:
    """n8n's parseNumericParameter."""
    if isinstance(value, bool) or not isinstance(value, (int, float, str)) or (isinstance(value, str) and not value.strip()):
        raise NodeError(f'The value of "{name}" must be a number')
    try:
        n = float(value)
    except ValueError as exc:
        raise NodeError(f'The value of "{name}" must be a number') from exc
    if not math.isfinite(n):
        raise NodeError(f'The value of "{name}" must be a number')
    return n


def _steps(p: Any, operation: str) -> list[dict[str, Any]]:
    if operation == "multiStep":
        raw = (p.get("operations") or {}).get("operations") or []
    else:
        keys = {"resize": ("width", "height", "resizeOption"), "rotate": ("rotate", "backgroundColor")}.get(operation)
        if keys is None:
            raise NodeError(f"Edit Image operation '{operation}' is not supported by this engine")
        raw = [{"operation": operation, **{k: p.get(k) for k in keys if p.get(k) is not None}}]
    steps: list[dict[str, Any]] = []
    for entry in raw:
        name = (entry or {}).get("operation")
        if not isinstance(name, str) or not name:
            continue  # n8n skips an entry without an operation
        if name not in STEP_DEFAULTS:
            raise NodeError(f"Edit Image step '{name}' is not supported by this engine")
        step = {**STEP_DEFAULTS[name], **{k: v for k, v in entry.items() if v is not None}}
        for key in NUMERIC_PARAMS[name]:
            step[key] = _number(step.get(key), key)
        steps.append(step)
    if not raw:
        raise NodeError("Cannot read properties of undefined (reading 'operation')")
    return steps


def _source_ref(item: Item, key: Any, index: int) -> dict[str, Any]:
    """n8n's assertBinaryData."""
    if not isinstance(key, str):
        raise NodeError("Provided parameter is not a string or binary data object.")
    binary = item.get("binary")
    if binary is None:
        raise NodeError(f"This operation expects the node's input data to contain a binary file '{key}', but none was found [item {index}]",
                        "Make sure that the previous node outputs a binary file")
    ref = binary.get(key)
    if ref is None:
        raise NodeError(f"The item has no binary field '{key}' [item {index}]",
                        "Check that the parameter where you specified the input binary field name is correct, and that it "
                        "matches a field in the binary input")
    return ref


async def _edit_item(ctx: NodeContext, index: int, item: Item, p: Any) -> Item:
    operation = p.get("operation", "border")
    data_key = p.get("dataPropertyName", "data")
    options = dict(p.get("options") or {})
    dest = options.get("destinationKey") or (data_key if isinstance(data_key, str) else "data")
    steps = _steps(p, operation)
    quality = _number(options["quality"], "quality") if options.get("quality") is not None else None
    ref = _source_ref(item, data_key, index)
    try:
        data = await ctx.services.binaries.get(ref)
    except KeyError as exc:
        raise NodeError(f"The binary data of field '{data_key}' is not available [item {index}]") from exc
    fmt = options.get("format")
    if fmt is not None and fmt not in VALID_FORMATS:
        raise NodeError(f"Invalid image format: {fmt}. Valid formats are: {', '.join(VALID_FORMATS)}")
    try:
        out = await asyncio.to_thread(render, data, steps, fmt, quality)
    except _ImageError as exc:
        raise NodeError(str(exc)) from exc
    except Exception as exc:  # anything the image library throws fails the item, as gm errors do in n8n
        raise NodeError(f"The image could not be processed ({exc.__class__.__name__}: {exc})") from exc

    # The binary data of the item: the other fields stay, the destination field is copied and updated.
    binary = dict(item.get("binary") or {})
    entry: dict[str, Any] = copy.deepcopy(binary[dest]) if dest in binary else {"data": "", "mimeType": ""}
    if fmt is not None:
        entry["fileExtension"] = fmt
        entry["mimeType"] = f"image/{fmt}"
        name = entry.get("fileName")
        if isinstance(name, str) and "." in name:
            entry["fileName"] = ".".join(name.split(".")[:-1]) + "." + fmt
    if options.get("fileName") is not None:
        entry["fileName"] = options["fileName"]
    mime, ext = sniff(out) or (entry.get("mimeType") or "application/octet-stream", entry.get("fileExtension"))
    file_name = entry.get("fileName")
    stored = await ctx.services.binaries.put(ctx.execution.id, out, mime, str(file_name) if file_name else None, ext)
    binary[dest] = {**entry, **stored}
    return {"json": item.get("json", {}), "binary": binary, "pairedItem": {"item": index}}


async def edit_image(ctx: NodeContext):
    items = ctx.items
    params = await ctx.params()
    out: list[Item] = []
    for index, (item, p) in enumerate(zip(items, params)):
        try:
            out.append(await _edit_item(ctx, index, item, p))
        except Exception as exc:  # n8n catches every error of an item
            if not ctx.continue_on_fail:
                raise
            # n8n's error item: the message only; the item's binaries are not passed on.
            out.append({"json": {"error": str(exc) or exc.__class__.__name__}, "pairedItem": {"item": index}})
    return [out]


HANDLERS = {"editImage": edit_image}
