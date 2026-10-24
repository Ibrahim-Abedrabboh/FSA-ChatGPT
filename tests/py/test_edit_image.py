"""Edit Image (n8n editImage 1.1, multiStep) with Pillow: GraphicsMagick parity, binary metadata, and the frozen
stage-06 Code nodes (18e3 Clean background, 18h Check files) reading the BMP/JPEG/WebP files this node writes.

The parity values were taken from GraphicsMagick 1.3.42 Q16 run the way n8n runs it
(gm convert -background transparent [-quality Q] - -orient TopLeft <steps> FORMAT:-) on the stage-06 fixtures.
"""

from __future__ import annotations

import hashlib
import io
import struct
from pathlib import Path

import pytest
from PIL import Image, JpegImagePlugin

from conftest import link, make_flow, run_flow
from midas_a7.engine.executor import Execution
from midas_a7.engine.model import flow_from_definition
from midas_a7.flows import a7_main
from midas_a7.nodes.edit_image import _geometry_size, _parse_color, render

FIX = Path(__file__).resolve().parents[1] / "claude-midas-a7-stage-06" / "fixtures"
CODE_DIR = Path(a7_main.__file__).with_name("code")


def fixture(name: str) -> bytes:
    return (FIX / name).read_bytes()


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def resize(w, h, option="ignoreAspectRatio"):
    return [{"operation": "resize", "width": w, "height": h, "resizeOption": option}]


ROTATE0 = [{"operation": "rotate", "rotate": 0, "backgroundColor": "#ffffff"}]


def bmp_header(b: bytes) -> dict:
    off, head = struct.unpack_from("<II", b, 10)
    w, h, planes, bits, comp, size, xp, yp, ncol, nimp = struct.unpack_from("<iiHHIIiiII", b, 18)
    return {"magic": b[:2], "file_size": struct.unpack_from("<I", b, 2)[0], "offset": off, "head": head, "w": w, "h": h,
            "planes": planes, "bits": bits, "comp": comp, "size": size, "ppm": (xp, yp), "colors": ncol}


# ---------- GraphicsMagick parity ----------
def test_bmp_from_png_master_matches_graphicsmagick():
    out = render(fixture("master_2048.png"), resize(1125, 1125), "bmp", None)
    hd = bmp_header(out)
    # gm writes a 24-bit BI_RGB, bottom-up BMP with a 40-byte header; 2925 px/m (75*39) when the unit is not known.
    assert hd == {"magic": b"BM", "file_size": 3798054, "offset": 54, "head": 40, "w": 1125, "h": 1125, "planes": 1,
                  "bits": 24, "comp": 0, "size": 3376 * 1125, "ppm": (2925, 2925), "colors": 0}
    im = Image.open(io.BytesIO(out)).convert("RGB")
    # GraphicsMagick's Lanczos result across the product's left and top edges (ringing included).
    row = [(255, 255, 255)] * 6 + [(253, 253, 252), (255, 255, 255), (211, 209, 207), (141, 135, 130), (152, 147, 142)] + [(150, 145, 140)] * 6
    col = [(255, 255, 255)] * 7 + [(253, 253, 253), (255, 255, 255), (178, 175, 171), (143, 138, 133), (151, 146, 141)] + [(150, 145, 140)] * 6
    assert [im.getpixel((x, 600)) for x in range(126, 143)] == row
    assert [im.getpixel((600, y)) for y in range(328, 346)] == col


def test_bmp_from_jpeg_master_matches_graphicsmagick():
    im = Image.open(io.BytesIO(render(fixture("master_2000.jpg"), resize(1125, 1125), "bmp", None))).convert("RGB")
    row = [(255, 255, 255)] * 6 + [(254, 254, 254), (255, 255, 255), (249, 249, 248), (154, 150, 146), (148, 143, 139)] + [(150, 145, 141)] * 6
    col = [(255, 255, 255), (255, 255, 255), (254, 255, 255), (255, 255, 255), (254, 255, 255), (254, 255, 255), (254, 255, 254),
           (253, 252, 253), (255, 255, 255), (201, 200, 197), (140, 135, 132), (152, 147, 143), (150, 145, 140), (151, 145, 139),
           (150, 145, 140), (149, 145, 141), (150, 145, 140), (150, 145, 141)]
    assert [im.getpixel((x, 600)) for x in range(126, 143)] == row
    assert [im.getpixel((600, y)) for y in range(328, 346)] == col


def test_delivery_files_are_byte_identical_to_graphicsmagick():
    """The A7 chain 18f/18g/18f9 and the read-backs 18g1/18g2/18g3: same bytes as gm for the same input."""
    pix = render(fixture("master_2048.png"), resize(1125, 1125), "bmp", None)
    assert sha(pix) == "2fd8786c9144ee71301a99dabe8191e73377a5b2a6e24059b1981c7a4294386c"
    expected = {
        ("jpeg", 92): ("9727c0e9ede9575190df9f44ca58cacdcdd297556421a6a34b37649601d1b921",
                       "b7fdc0110e24ddadc960dcecd8dd82daa6ace410d4710248874819fc9324e553"),
        ("webp", None): ("ba2c382263eb5e9c76f32ef7d69ceb40e2b04d6782fad7dd06297f2fd7f1518d",
                         "4bb1a811dcf6ad29114ebfca6ef9c6cd6d596dc53ac7b23be184009c49ad145a"),
        ("jpeg", 100): ("2d988bd56c33dbfd27543be241ce1f839c746352c21475f8ca2ddea85de445de",
                        "c88a780d02e30c1d2048d93f4f8cfc89e16dffbbb79db1d7205dbbef09fd8235"),
    }
    for (fmt, quality), (file_sha, readback_sha) in expected.items():
        made = render(pix, resize(1125, 1125), fmt, quality)  # same size: no resampling, a re-encode
        assert sha(made) == file_sha, (fmt, quality)
        assert sha(render(made, ROTATE0, "bmp", None)) == readback_sha, (fmt, quality)


def test_jpeg_settings_follow_graphicsmagick():
    pix = render(fixture("master_2048.png"), resize(1125, 1125), "bmp", None)
    for quality, sampling in ((92, 0), (100, 0), (90, 0), (89, 2), (None, 2)):
        out = render(pix, ROTATE0, "jpeg", quality)
        im = Image.open(io.BytesIO(out))
        ref = io.BytesIO()
        Image.open(io.BytesIO(pix)).save(ref, "JPEG", quality=quality or 75)
        assert im.quantization == Image.open(ref).quantization  # libjpeg's tables for the quality (default 75)
        assert JpegImagePlugin.get_sampling(im) == sampling  # 4:4:4 at quality 90 and above, else 4:2:0
        assert "progressive" not in im.info
    # JFIF density as gm writes it: from a BMP (pixels per metre) in dots per cm; from a PNG without pHYs 72 dpi.
    from_bmp = render(pix, ROTATE0, "jpeg", 92)
    assert from_bmp[11:18] == b"\x01\x01\x02\x00\x1d\x00\x1d"  # 2925 px/m -> 29 per cm
    from_png = render(fixture("master_1000.png"), resize(500, 500), "jpeg", 92)
    assert from_png[11:18] == b"\x01\x01\x01\x00\x48\x00\x48"


def test_bmp_rows_are_bottom_up_and_padded():
    im = Image.new("RGB", (3, 2), (255, 255, 255))
    im.putpixel((0, 0), (10, 20, 30))  # top-left
    im.putpixel((2, 1), (40, 50, 60))  # bottom-right
    buf = io.BytesIO()
    im.save(buf, "PNG")
    out = render(buf.getvalue(), ROTATE0, "bmp", None)
    hd = bmp_header(out)
    assert (hd["w"], hd["h"], hd["bits"], hd["size"]) == (3, 2, 24, 24)  # rows of 9 bytes padded to 12
    rows = [out[54 + i * 12:54 + (i + 1) * 12] for i in range(2)]
    assert rows[0][6:9] == bytes((60, 50, 40)) and rows[0][9:] == b"\x00\x00\x00"  # first row stored = bottom row, BGR
    assert rows[1][0:3] == bytes((30, 20, 10))


def test_bmp_with_transparency_is_32_bit_with_masks():
    im = Image.new("RGBA", (40, 30), (255, 255, 255, 255))
    im.paste((120, 90, 60, 128), (10, 10, 30, 20))
    buf = io.BytesIO()
    im.save(buf, "PNG")
    out = render(buf.getvalue(), resize(20, 15), "bmp", None)
    hd = bmp_header(out)
    assert (hd["head"], hd["bits"], hd["comp"], hd["offset"]) == (108, 32, 3, 122)  # BITMAPV4HEADER, BI_BITFIELDS
    assert struct.unpack_from("<IIIII", out, 54) == (0x00FF0000, 0x0000FF00, 0x000000FF, 0xFF000000, 1)
    # Bytes per pixel B, G, R, A; colour stored without premultiplying.
    back = Image.open(io.BytesIO(render(buf.getvalue(), ROTATE0, "bmp", None)))
    assert back.mode == "RGBA" and back.getpixel((15, 15)) == (120, 90, 60, 128)


def test_resize_geometry_flags_match_graphicsmagick():
    # Sizes gm gave for a 2048 x 1536 picture.
    assert _geometry_size(2048, 1536, 3000, 1000, ">") == (1333, 1000)
    assert _geometry_size(2048, 1536, 600, 600, "^") == (800, 600)
    assert _geometry_size(2048, 1536, 50, 50, "%") == (1024, 768)
    assert _geometry_size(2048, 1536, 500, 500, "@") == (577, 433)
    assert _geometry_size(2048, 1536, 500, 500, "<") == (2048, 1536)
    assert _geometry_size(2048, 1536, 1125, 1125, "!") == (1125, 1125)
    assert Image.open(io.BytesIO(render(fixture("master_2048x1536.png"), resize(500, 500, "maximumArea"), "png", None))).size == (577, 433)


def test_rotate_quarter_turns_are_clockwise_and_colours_use_opacity():
    im = Image.new("RGB", (4, 2), (255, 255, 255))
    im.putpixel((0, 0), (255, 0, 0))
    buf = io.BytesIO()
    im.save(buf, "PNG")
    out = Image.open(io.BytesIO(render(buf.getvalue(), [{"operation": "rotate", "rotate": 90, "backgroundColor": "#ffffff"}], "png", None)))
    assert out.size == (2, 4) and out.getpixel((1, 0)) == (255, 0, 0)  # top-left goes to top-right
    assert _parse_color("#ffffff") == (255, 255, 255, 255)
    assert _parse_color("#ffffffff") == (255, 255, 255, 0)  # GraphicsMagick: the 4th byte is opacity
    assert _parse_color("#00000000") == (0, 0, 0, 255)


# ---------- the node ----------
def edit_node(name, params, pos=(200, 0), **extra):
    return {"name": name, "type": "n8n-nodes-base.editImage", "typeVersion": 1.1, "position": list(pos), "parameters": params, **extra}


def start_node():
    return {"name": "Start", "type": "n8n-nodes-base.manualTrigger", "typeVersion": 1, "position": [0, 0], "parameters": {}}


MAKE_JPG = {  # 18f Make jpg
    "operation": "multiStep", "dataPropertyName": "clean",
    "operations": {"operations": [{"operation": "resize", "width": "={{ $json.pk.cfg.size_px }}",
                                   "height": "={{ $json.pk.cfg.size_px }}", "resizeOption": "ignoreAspectRatio"}]},
    "options": {"destinationKey": "jpg", "fileName": "={{ $json.pk.files[0].file_name }}", "format": "jpeg",
                "quality": "={{ $json.pk.cfg.jpg_quality }}"},
}


async def test_node_adds_the_file_and_keeps_the_other_binaries(services, executor):
    pix = render(fixture("master_2048.png"), resize(1125, 1125), "bmp", None)
    clean = await services.binaries.put("1", pix, "image/bmp", "sofa_clean.bmp")
    other = await services.binaries.put("1", b"hello", "text/plain", "note.txt")
    pk = {"cfg": {"size_px": 1125, "jpg_quality": 92}, "files": [{"format": "jpg", "file_name": "sofa_white_1125_v1.jpg"}]}
    flow = make_flow([start_node(), edit_node("18f Make jpg", MAKE_JPG, onError="continueRegularOutput")], link(("Start", "18f Make jpg")))
    ex = await run_flow(executor, flow, [{"json": {"pk": pk}, "binary": {"clean": clean, "note": other}}])
    assert ex.status == "success", ex.error
    [item] = ex.latest_output("18f Make jpg")
    assert item["json"] == {"pk": pk} and item["pairedItem"] == {"item": 0}
    assert list(item["binary"]) == ["clean", "note", "jpg"]
    assert item["binary"]["clean"] == clean and item["binary"]["note"] == other
    jpg = item["binary"]["jpg"]
    # n8n: format sets fileExtension "jpeg" and mimeType, then prepareBinaryData(buffer) sniffs the bytes ("jpg").
    assert {k: jpg[k] for k in ("mimeType", "fileExtension", "fileName", "fileType", "data")} == {
        "mimeType": "image/jpeg", "fileExtension": "jpg", "fileName": "sofa_white_1125_v1.jpg", "fileType": "image",
        "data": "filesystem-v2"}
    data = await services.binaries.get(jpg)
    assert jpg["bytes"] == len(data) and sha(data) == "9727c0e9ede9575190df9f44ca58cacdcdd297556421a6a34b37649601d1b921"


async def test_node_without_destination_overwrites_the_source_and_renames_it(services, executor):
    src = await services.binaries.put("1", fixture("master_1000.png"), "image/png", "master.png")
    params = {"operation": "multiStep", "operations": {"operations": [{"operation": "resize", "width": 500, "height": 500,
                                                                       "resizeOption": "ignoreAspectRatio"}]},
              "options": {"format": "bmp"}}
    flow = make_flow([start_node(), edit_node("E", params)], link(("Start", "E")))
    ex = await run_flow(executor, flow, [{"json": {}, "binary": {"data": src}}])
    out = ex.latest_output("E")[0]["binary"]["data"]
    assert out["fileName"] == "master.bmp" and out["mimeType"] == "image/bmp" and out["fileExtension"] == "bmp"
    assert out["id"] != src["id"] and bmp_header(await services.binaries.get(out))["w"] == 500


async def test_numeric_strings_work_and_bad_values_fail_like_n8n(services, executor):
    src = await services.binaries.put("1", fixture("master_1000.png"), "image/png", "m.png")
    good = {"operation": "multiStep", "operations": {"operations": [{"operation": "resize", "width": "250", "height": " 250 ",
                                                                     "resizeOption": "ignoreAspectRatio"}]},
            "options": {"format": "webp", "destinationKey": "w"}}
    bad = {**good, "operations": {"operations": [{"operation": "resize", "width": "abc", "height": 250}]}}
    flow = make_flow([start_node(), edit_node("Good", good), edit_node("Bad", bad, (200, 200))],
                     link(("Start", "Good"), ("Start", "Bad")))
    ex = await run_flow(executor, flow, [{"json": {}, "binary": {"data": src}}])
    w = ex.latest_output("Good")[0]["binary"]["w"]
    assert w["mimeType"] == "image/webp" and Image.open(io.BytesIO(await services.binaries.get(w))).size == (250, 250)
    assert ex.status == "error" and ex.error["message"] == 'The value of "width" must be a number'


async def test_continue_on_fail_gives_the_n8n_error_item(services, executor):
    flow = make_flow([start_node(), edit_node("18f Make jpg", MAKE_JPG, onError="continueRegularOutput")], link(("Start", "18f Make jpg")))
    pk = {"cfg": {"size_px": 1125, "jpg_quality": 92}, "files": [{"format": "jpg", "file_name": "a.jpg"}]}
    other = await services.binaries.put("1", b"x", "text/plain", "x.txt")
    ex = await run_flow(executor, flow, [{"json": {"pk": pk}, "binary": {"other": other}}, {"json": {"pk": pk}}])
    assert ex.status == "success"
    assert ex.latest_output("18f Make jpg") == [
        {"json": {"error": "The item has no binary field 'clean' [item 0]"}, "pairedItem": {"item": 0}},
        {"json": {"error": "This operation expects the node's input data to contain a binary file 'clean', but none was found [item 1]"},
         "pairedItem": {"item": 1}},
    ]
    flow2 = make_flow([start_node(), edit_node("E", {**MAKE_JPG, "options": {**MAKE_JPG["options"], "format": "heic"}})],
                      link(("Start", "E")))
    ex2 = await run_flow(executor, flow2, [{"json": {"pk": pk}, "binary": {"clean": other}}])
    assert ex2.status == "error" and ex2.error["message"].startswith("Invalid image format: heic. Valid formats are: bmp, gif, jpeg")


# ---------- the frozen stage-06 Code nodes on these files ----------
def a7_slice(names: list[str], trigger: str, extra_nodes: list[dict] | None = None, flow_id: str = "a7-slice"):
    """Part of the committed A7 flow: the named nodes with their real parameters and code, the connections between
    them, and `trigger` (a manual trigger standing in for the node of that name) feeding them."""
    keep = set(names) | {trigger} | {n["name"] for n in extra_nodes or []}
    nodes = [n for n in a7_main.FLOW["nodes"] if n["name"] in names]
    real = next(n for n in a7_main.FLOW["nodes"] if n["name"] == trigger)
    nodes.append({"name": trigger, "type": "n8n-nodes-base.manualTrigger", "typeVersion": 1, "position": real["position"], "parameters": {}})
    nodes += extra_nodes or []
    conns = {}
    for src, by_type in a7_main.FLOW["connections"].items():
        if src in keep:
            conns[src] = {"main": [[c for c in (outs or []) if c["node"] in keep] for outs in by_type.get("main", [])]}
    return flow_from_definition({"id": flow_id, "name": flow_id, "nodes": nodes, "connections": conns,
                                 "settings": {"executionOrder": "v1"}}, CODE_DIR)


STAGE06_FILES = ["Master usable?", "18e2 Master to pixels", "18e3 Clean background", "Cleaned?", "18f Make jpg", "18g Make webp",
                 "18g1 jpg to pixels", "18g2 webp to pixels", "18f9 Make jpg at quality 100", "18g3 jpg100 to pixels",
                 "18h Check files"]


def package_pk(box=(300, 120, 881, 881)) -> dict:
    """The fields of 18e Check master's pk that 18e2-18h (and 18i-18n) read."""
    return {
        "ok": True, "base": "test-sofa", "version": 1, "identity_key": "photo:" + "a" * 64,
        "folder_name": "test-sofa package v1", "manifest_name": "test-sofa_manifest_v1.json",
        "cfg": {"size_px": 1125, "formats": ["jpg", "webp"], "jpg_quality": 92},
        "files": [{"format": "jpg", "file_name": "test-sofa_white_1125_v1.jpg"},
                  {"format": "webp", "file_name": "test-sofa_white_1125_v1.webp"}],
        "product_box_2d": list(box) if box else None,
        "master": {"output_id": "white_master", "drive_file_id": "drive-master-1", "folder_id": "drive-run-folder",
                   "link": "https://drive.example/master", "sha256": "b" * 64, "px": "2048x2048", "bytes": 1},
        "approval": {"by": "owner", "at": "2026-10-16T00:00:00Z", "attempt": 1},
        "spec_card": {"fields": [{"field": "Product", "value": "Sofa"}, {"field": "SKU", "value": "not confirmed"}]},
    }


async def run_stage06(services, executor, master: bytes, mime: str, pk: dict | None = None, binary_key: str = "data"):
    flow = a7_slice(STAGE06_FILES, "18e Check master")
    ref = await services.binaries.put("s06", master, mime, "master" + (".png" if mime == "image/png" else ".jpg"))
    ex = Execution(id="s06", flow_id=flow.id)
    await executor.start(flow, ex, flow.nodes["18e Check master"], [{"json": {"pk": pk or package_pk()}, "binary": {binary_key: ref}}])
    return ex


def png_bytes(im: Image.Image) -> bytes:
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return buf.getvalue()


# The 18h outcome per master is the one GraphicsMagick gives (checked by running the same chain on gm's own 18e2
# BMP, with GraphicsMagick 1.3.42): the flat synthetic 2048 png ends with its webp at 99.52% of the background at
# 254 or more, under the 99.9% halo rule, so 18h holds it in n8n too; the jpeg master passes. A master with an
# alpha channel goes through a 32-bit BMP with colour masks (gm writes the same kind), which 18e3 reads by its masks;
# gm resizes it with its Mitchell filter (this node: bicubic) and its webp fails the halo rule as well (gm: 98.97%).
@pytest.mark.parametrize("master,mime,bits,webp_254_pct", [
    ("master_2048.png", "image/png", 24, 99.52),
    ("master_2000.jpg", "image/jpeg", 24, 100),
    ("rgba", "image/png", 32, None),
])
async def test_stage06_code_nodes_read_the_files(services, executor, master, mime, bits, webp_254_pct):
    data = png_bytes(Image.open(FIX / "master_2048.png").convert("RGBA")) if master == "rgba" else fixture(master)
    ex = await run_stage06(services, executor, data, mime)
    assert ex.status == "success", ex.error
    pix = ex.latest_output("18e2 Master to pixels")[0]["binary"]["pix"]
    assert pix["mimeType"] == "image/bmp" and pix["fileName"] == "test-sofa_pixels.bmp"
    assert bmp_header(await services.binaries.get(pix))["bits"] == bits
    wc = ex.latest_output("18e3 Clean background")[0]["json"]["pk"]["white_clean"]
    assert wc["done"] is True and wc["cleaned"] is True and "problem" not in wc, wc
    assert wc["product_box_pixels_changed"] == 0 and wc["darker_than_knee_changed"] == 0
    assert wc["background_pct"] > 40 and wc["background_255_after_pct"] >= 99
    # 18g3 hands 18h the cleaned picture, the three saved files and their three read-backs.
    assert set(ex.latest_output("18g3 jpg100 to pixels")[0]["binary"]) == {"clean", "jpg", "webp", "jpgpix", "webppix", "jpg100", "jpg100pix"}
    [h] = ex.latest_output("18h Check files")
    pk = h["json"]["pk"]
    jpg, webp = pk["files"]
    assert (jpg["mime"], jpg["px"], jpg["quality"]) == ("image/jpeg", "1125x1125", 92)
    assert (webp["mime"], webp["px"]) == ("image/webp", "1125x1125")
    for f in (jpg, webp):  # every saved file was read back from its BMP
        bc = f["background_check"]
        assert bc["px"] == "1125x1125" and bc["edge_255_pct"] == 100 and bc["darkest_edge_value"] == 255
        assert f["halo_check"]["pixels_checked"] > 100000
    assert jpg["halo_check"]["below_250"] == 0 and jpg["halo_check"]["at_254_or_more_pct"] >= 99.9
    if webp_254_pct is not None:
        assert webp["halo_check"]["at_254_or_more_pct"] == webp_254_pct
    if webp_254_pct != 100:
        assert pk["files_ok"] is False and "the saved webp file shows a grey halo" in pk["problem"] and "jpg" not in pk["problem"]
        assert "binary" not in h
        return
    assert pk["files_ok"] is True and pk.get("ok") is True, pk.get("problem")
    assert h["binary"]["jpg"]["fileName"] == "test-sofa_white_1125_v1.jpg"
    assert h["binary"]["webp"]["fileName"] == "test-sofa_white_1125_v1.webp"
    assert sha(await services.binaries.get(h["binary"]["jpg"])) == jpg["sha256"]


async def test_stage06_reads_the_edit_image_error_item(services, executor):
    # The master is not under "data": 18e2 continues with n8n's error item, and 18e3 reports its message.
    ex = await run_stage06(services, executor, fixture("master_2048.png"), "image/png", binary_key="master")
    assert ex.latest_output("18e2 Master to pixels") == [
        {"json": {"error": "The item has no binary field 'data' [item 0]"}, "pairedItem": {"item": 0}}]
    pk = ex.latest_output("18e3 Clean background")[0]["json"]["pk"]
    assert pk["ok"] is False
    assert pk["white_clean"]["problem"] == ("the master could not be turned into pixels (Edit Image gave no BMP: "
                                            "The item has no binary field 'data' [item 0])")
    assert "18f Make jpg" not in ex.run_data
