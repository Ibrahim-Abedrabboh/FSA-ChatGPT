"""Phase 1.6 (FL-10): the engine helper that shrinks a scene reference in code, without AI (nodes/claude_reference_resize.py)."""

from __future__ import annotations

import hashlib
import io

import pytest
from conftest import link, make_flow, run_flow
from midas_a7.nodes.claude_reference_resize import resize_reference
from PIL import Image


def png(size: tuple[int, int], mode: str = "RGB", color=(180, 120, 60)) -> bytes:
    out = io.BytesIO()
    Image.new(mode, size, color).save(out, "PNG")
    return out.getvalue()


@pytest.mark.parametrize("size", [(2048, 2048), (2048, 1000), (900, 2048), (64, 48)])
def test_an_image_at_or_below_2048_px_is_left_as_it_is(size):
    res = resize_reference(png(size))
    assert res["resized"] is False and res["px"] == list(size) and "data" not in res


def test_a_wide_image_keeps_its_aspect_and_gets_a_2048_px_long_side():
    data = png((4000, 1000))
    res = resize_reference(data)
    assert res["resized"] is True and res["from_px"] == [4000, 1000] and res["to_px"] == [2048, 512]
    im = Image.open(io.BytesIO(res["data"]))
    assert im.format == "JPEG" and im.size == (2048, 512)
    assert res["from_bytes"] == len(data) and res["to_bytes"] == len(res["data"])
    assert res["sha256"] == hashlib.sha256(res["data"]).hexdigest() and res["mime"] == "image/jpeg"


def test_a_tall_image_keeps_its_aspect():
    res = resize_reference(png((1500, 3000)))
    assert res["to_px"] == [1024, 2048]


def test_transparency_is_laid_on_white():
    res = resize_reference(png((3000, 3000), "RGBA", (0, 0, 0, 0)))
    im = Image.open(io.BytesIO(res["data"])).convert("RGB")
    assert min(im.getpixel((1024, 1024))) >= 250, "a transparent picture becomes white, not black"


def test_the_exif_orientation_is_applied_before_measuring():
    out = io.BytesIO()
    exif = Image.Exif()
    exif[0x0112] = 6  # stored landscape, shown turned a quarter: portrait
    Image.new("RGB", (3000, 1500), (90, 90, 90)).save(out, "JPEG", exif=exif.tobytes())
    res = resize_reference(out.getvalue())
    assert res["from_px"] == [1500, 3000] and res["to_px"] == [1024, 2048]


def test_a_file_that_is_not_an_image_is_left_as_it_is():
    res = resize_reference(b"not an image at all")
    assert res["resized"] is False and res["px"] is None and res["why"]


# ---------- the helper as a Code node calls it (this.helpers.midasResizeReference) ----------
RESIZE_CODE = """
const out = [];
for (const key of ['big', 'small']) {
  const res = await this.helpers.midasResizeReference($input.first().binary[key], 2048);
  out.push({ json: { key, resized: res.resized, to_px: res.to_px || res.px, sha256: res.sha256 || '' }, binary: res.resized ? { data: res.binary } : undefined });
}
return out;
"""


async def test_a_code_node_shrinks_a_stored_reference_through_the_engine(executor, services):
    big, small = png((2600, 1300)), png((800, 600))
    refs = {k: await services.binaries.put("1", v, "image/png", f"{k}.png") for k, v in (("big", big), ("small", small))}
    flow = make_flow([
        {"name": "Start", "type": "n8n-nodes-base.manualTrigger", "typeVersion": 1, "parameters": {}},
        {"name": "Resize", "type": "n8n-nodes-base.code", "typeVersion": 2, "parameters": {"jsCode": RESIZE_CODE}},
    ], link(("Start", "Resize")))
    ex = await run_flow(executor, flow, [{"json": {}, "binary": refs}])
    assert ex.status == "success", ex.error
    first, second = ex.latest_output("Resize")
    assert first["json"]["resized"] is True and first["json"]["to_px"] == [2048, 1024]
    data = await services.binaries.get(first["binary"]["data"])
    assert hashlib.sha256(data).hexdigest() == first["json"]["sha256"] and Image.open(io.BytesIO(data)).size == (2048, 1024)
    assert second["json"]["resized"] is False and second["json"]["to_px"] == [800, 600] and "binary" not in second
    assert await services.binaries.get(refs["big"]) == big, "the original file is kept as it was"


async def test_a_failed_helper_rejects_in_the_code_node(executor):
    code = ("let why = '';\ntry { await this.helpers.midasResizeReference({ id: 'bin:missing' }, 2048); } "
            "catch (e) { why = String(e.message); }\nreturn [{ json: { why } }];")
    flow = make_flow([
        {"name": "Start", "type": "n8n-nodes-base.manualTrigger", "typeVersion": 1, "parameters": {}},
        {"name": "Resize", "type": "n8n-nodes-base.code", "typeVersion": 2, "parameters": {"jsCode": code}},
    ], link(("Start", "Resize")))
    ex = await run_flow(executor, flow, [{"json": {}}])
    assert ex.status == "success", ex.error
    assert "not found" in ex.latest_output("Resize")[0]["json"]["why"]


def test_an_image_with_too_many_pixels_is_never_decoded(monkeypatch):
    """Review finding (22 Oct 2026): one decode must not take the service's memory; the header is read, the pixels are not."""
    import midas_a7.nodes.claude_reference_resize as mod
    monkeypatch.setattr(mod, "MAX_PIXELS", 3000 * 1000 - 1)
    monkeypatch.setattr(mod, "_decode", lambda data: (_ for _ in ()).throw(AssertionError("decoded")))
    res = mod.resize_reference(png((3000, 1000)))
    assert res["resized"] is False and res["px"] == [3000, 1000] and "pixels" in res["why"]


async def test_a_late_helper_answer_never_reaches_the_runner_that_replaced_it():
    """Review finding (22 Oct 2026): when a Code node is stopped (time limit) while its helper still runs, the runner restarts and
    numbers its callbacks from 1 again. The late answer must not resolve the next run's request with the same number."""
    import asyncio

    from midas_a7.engine.jsrunner import JsError, JsRunner

    code = "const r = await this.helpers.midasResizeReference({ id: 'x' }, 1); return [{ json: { r } }];"
    js = JsRunner(timeout_s=1.0)

    async def slow(_):
        await asyncio.sleep(1.5)
        return {"who": "the stopped run"}

    async def own(_):
        await asyncio.sleep(1.2)
        return {"who": "this run"}
    try:
        with pytest.raises(JsError):
            await js.call("code", callbacks={"resizeReference": slow}, code=code, items=[{"json": {}}], binaries={})
        js._timeout = 5.0
        res = await js.call("code", callbacks={"resizeReference": own}, code=code, items=[{"json": {}}], binaries={})
        assert res["items"][0]["json"]["r"] == {"who": "this run"}
    finally:
        await js.close()
