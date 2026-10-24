"""Phase 1 baseline past Go 1: the image call, Go 2, the package and a scene, on the mocked service (no paid call).

Run 1591 ends at Go 1, so these runs use the harness's made-up answers past it (claude_a7_harness: a stand-in image, a
passing blind count and review, in-stock Midas pages). The same three kinds of test as test_claude_phase1_baseline.py:
plain tests pin what Phase 1 must keep; `test_today_*` tests describe a gap as it behaves now (the Phase 1 PR that closes
it replaces them); each gap is a strict xfail, so the PR that fixes it must remove the marker. Where the design leaves a
choice open (claude-outputs/claude-midas-a7-phase-1-design-2026-10-22.md), every option satisfies the test.
"""

from __future__ import annotations

import base64
import io
import json
import os
import random
import re

import httpx
import pytest
from claude_a7_harness import a7_service, blind_count_answer, image_answer, stand_in_image
from midas_a7.engine.executor import Executor
from PIL import Image

VAULT_TABLE = "Tyn4UT6BmIYMHAYl"  # Claude Midas A7 vault


def span(png: bytes) -> float:
    """The share (%) of the frame's width that the product spans, measured on the file. The stand-in block is grey 220 with
    a blurred edge; 240 is about the middle of that edge, so the blur does not widen the reading."""
    im = Image.open(io.BytesIO(png)).convert("L")
    box = im.point(lambda v: 255 if v < 240 else 0).getbbox()
    return round((box[2] - box[0]) / im.size[0] * 100, 1)


def noise(side: int) -> bytes:
    """A PNG of random pixels: it does not compress, so its size is about side x side x 3 bytes."""
    out = io.BytesIO()
    Image.frombytes("RGB", (side, side), os.urandom(side * side * 3)).save(out, "PNG")
    return out.getvalue()


def reserved_first(calls: list[tuple[str, str, str | None]]) -> bool:
    """Each provider call has a reserve of its own before it: by the n-th provider call at least n reserves were made."""
    reserves = paid = 0
    for host, path, _ in calls:
        if path.endswith("/api/a7/budget/reserve"):
            reserves += 1
        elif host.startswith(("api.", "generativelanguage.")):
            paid += 1
            if reserves < paid:
                return False
    return True


def package(row: dict) -> dict:
    p = row["package"]
    return json.loads(p) if isinstance(p, str) else p


# ---------- what Phase 1 keeps ----------

async def test_go1_leads_to_one_image_call_a_review_and_the_white_go2(monkeypatch):
    async with a7_service(monkeypatch) as a7:
        await a7.to_go2()
        assert a7.outside.image_calls() == 1
        assert sorted(a7.outside.reserves()[2:]) == ["15g Send to Google", "16 Critic review", "16x Blind count"]
        assert reserved_first(a7.outside.calls), "every paid call reserves budget before it is sent (rule 22)"
        ctx = await a7.context()
        assert ctx["gate"] == "go2" and ctx["allowed"] == ["approve", "stop", "repair"]
        assert ctx["review"]["result"] == "passed" and "not an approval" in ctx["decisionNeeded"], "a passed review is never an approval (rule 15)"


async def test_approving_the_white_master_makes_the_package_and_the_first_scene_reaches_its_go2(monkeypatch):
    async with a7_service(monkeypatch) as a7:
        await a7.to_scene_go2()
        files = {d["label"].rsplit("_", 2)[-2] + "_" + d["label"].rsplit("_", 1)[-1]: d["px"] for d in (await a7.context())["deliveries"]}
        assert files["1125_v1.jpg"] == files["1125_v1.webp"] == "1125x1125", "delivery is 1125x1125 JPG and WebP (rule 19)"
        assert a7.row()["package"] and package(a7.row())["outcome"] != "hold"
        assert a7.outside.image_calls() == 3, "the white master, the empty room and the placement: one call each, none retried"
        assert reserved_first(a7.outside.calls)
        assert any(h == "midasfurniture.com" for h, _, _ in a7.outside.calls), "planned pieces are checked on their live Midas page"
        assert "owner-approved catalogue master" in json.dumps(a7.outside.image_requests[-1])


@pytest.mark.parametrize("answer", [lambda r, b: (_ for _ in ()).throw(httpx.ConnectError("no answer")),
                                    lambda r, b: httpx.Response(503, json={"error": {"message": "unavailable"}})],
                         ids=["no answer", "server error without a request id"])
async def test_an_uncertain_image_outcome_holds_and_is_never_sent_again(monkeypatch, answer):
    async with a7_service(monkeypatch) as a7:
        await a7.submit()
        a7.outside.answers["image"] = answer
        await a7.decide("go")
        row = a7.row()
        assert row["status"] == "hold" and "not sent again" in row["hold_reason"]
        assert a7.outside.image_calls() == 1, "the image call is never retried (rule 22)"
        assert all(e["status"] != "error" for e in a7.executions())


# ---------- 1.2: a held package (FL-4) ----------

async def held_package(a7) -> None:
    """Go 1, then approve a master whose saved webp shows a grey halo, so the package holds. Checked on the package record,
    not on the run's status, which the 1.2 change turns into a Go 2 decision."""
    a7.outside.image = stand_in_image(sharp=True)
    await a7.to_go2()
    await a7.decide("approve")
    pk = package(a7.row())
    assert pk["outcome"] == "hold" and "grey halo" in pk["problem"], pk.get("problem")


async def test_a_held_package_opens_a_go2_decision(monkeypatch):
    """Phase 1.2 (FL-4): a package held only by the background rule offers deliver as exception, repair or stop at go 2."""
    async with a7_service(monkeypatch) as a7:
        await held_package(a7)
        row, ctx = a7.row(), await a7.context()
        assert row["status"] == "awaiting_go_2" and row["hold_reason"] == ""
        assert ctx["gate"] == "go2" and ctx["allowed"] == ["approve", "stop", "repair"]
        assert "package" in ctx["decisionNeeded"] and "exception" in ctx["decisionNeeded"] and "grey halo" in ctx["decisionNeeded"]
        assert ctx["candidate"], "the approved master can be opened beside the decision (the Phase 0 rule)"
        assert a7.outside.image_calls() == 1, "opening the decision makes no paid call"


async def test_deliver_as_exception_delivers_the_package_and_the_scene_starts(monkeypatch):
    async with a7_service(monkeypatch) as a7:
        await held_package(a7)
        await a7.decide("approve", note="the halo is not visible at 100%")
        pk = package(a7.row())
        assert pk["outcome"] == "white_package_ready"
        assert pk["owner_exception"]["note"] == "the halo is not visible at 100%"
        assert any("grey halo" in x for x in pk["owner_exception"]["accepted"]), pk["owner_exception"]
        assert {f["format"] for f in pk["files"] if f.get("drive_file_id")} == {"jpg", "webp"}, "both files are saved"
        assert a7.row()["status"] == "awaiting_go_2" and "scene" in (await a7.context())["decisionNeeded"], "the first scene reaches its go 2"
        assert a7.outside.image_calls() == 3, "the white master, the empty room and the placement: no call for the exception itself"
        assert reserved_first(a7.outside.calls)
        assert any(d["label"].endswith("_white_1125_v1.webp") for d in (await a7.context())["deliveries"])


async def test_a_package_delivered_as_exception_is_never_a_reviewed_catalogue_release(monkeypatch):
    async with a7_service(monkeypatch) as a7:
        await held_package(a7)
        await a7.decide("approve")
        releases = [json.loads(e["payload"]) for e in a7.store.dt_select(VAULT_TABLE) if e["kind"] == "package_release"]
        assert releases, "the package release is in the vault"
        for rel in releases:
            assert rel["classification"] != "reviewed_owner_approved" and rel["catalogue_eligible"] is False
        decisions = [json.loads(e["payload"]) for e in a7.store.dt_select(VAULT_TABLE) if e["kind"] == "go2_decision"]
        last = decisions[-1]
        assert last["kind"] == "package" and last["release"] is None and last["exception"]["by"] == "owner", "the audit record names the exception"


async def test_repair_at_the_package_decision_makes_one_new_image_and_returns_to_go2(monkeypatch):
    async with a7_service(monkeypatch) as a7:
        await held_package(a7)
        await a7.decide("repair", note="show the whole set with space around it")
        ctx = await a7.context()
        assert a7.outside.image_calls() == 2, "one new image, never a retry of the first"
        assert a7.row()["status"] == "awaiting_go_2" and ctx["round"] == 2 and "white master" in ctx["decisionNeeded"]
        assert "repair" in ctx["allowed"], "one repair is left"


async def test_a_package_problem_other_than_the_background_rule_stays_a_hold(monkeypatch):
    """A master smaller than 1125 px is never upscaled: 18e holds, and no exception is offered for it."""
    async with a7_service(monkeypatch) as a7:
        a7.outside.image = stand_in_image(size=1000)
        await a7.to_go2()
        await a7.decide("approve")
        row = a7.row()
        assert row["status"] == "hold" and "1125" in row["hold_reason"], row["hold_reason"]
        assert (await a7.context())["allowed"] == []


async def test_the_exception_does_not_carry_over_to_a_repaired_image(monkeypatch):
    """Repair at the package decision, approve the new image: its package is checked afresh and asks again, with its own problem."""
    async with a7_service(monkeypatch) as a7:
        await held_package(a7)
        a7.outside.image = stand_in_image(span=0.74, sharp=True)
        await a7.decide("repair", note="a little more space around the set")
        assert a7.row()["status"] == "awaiting_go_2" and (await a7.context())["round"] == 2
        await a7.decide("approve")
        ctx = await a7.context()
        assert a7.row()["status"] == "awaiting_go_2" and "package" in ctx["decisionNeeded"], "the new image's package asks again"
        assert package(a7.row())["outcome"] == "hold" and not package(a7.row()).get("owner_exception")
        assert ctx["allowed"] == ["approve", "stop", "repair"] and ctx["round"] == 2, "one repair is still left"
        assert a7.outside.image_calls() == 2


async def test_stop_at_the_package_decision_ends_the_job(monkeypatch):
    async with a7_service(monkeypatch) as a7:
        await held_package(a7)
        await a7.decide("stop")
        assert a7.row()["status"] == "stopped_by_owner"
        assert package(a7.row())["outcome"] == "hold" and a7.outside.image_calls() == 1
        assert (await a7.context())["allowed"] == []


# ---------- 1.3: fit only a whole product; 76% on delivery (FL-5) ----------

async def approve_white(a7, solid_span: float, box: tuple[int, int, int, int], cropped: bool = False) -> None:
    a7.outside.image = stand_in_image(span=solid_span)
    a7.outside.answers["blind-count"] = lambda r, b: blind_count_answer(box=box, cropped=cropped)
    await a7.to_go2()
    await a7.decide("approve")


async def test_a_white_master_at_about_90_percent_is_delivered_at_76_percent(monkeypatch):
    """Rule 20 on the delivered file (Phase 1.3, FL-5): a whole product framed at about 90% is fitted to 76% +/- 3."""
    async with a7_service(monkeypatch) as a7:
        await approve_white(a7, 0.90, (300, 50, 700, 950))
        pk = package(a7.row())
        assert pk["outcome"] == "white_package_ready" and pk["white_clean"]["fit"]["done"] is True
        assert 73 <= span(await a7.delivered("_white_1125_v1.jpg")) <= 79


async def test_a_white_master_inside_the_band_keeps_its_framing(monkeypatch):
    async with a7_service(monkeypatch) as a7:
        await approve_white(a7, 0.76, (300, 120, 700, 880))
        pk = package(a7.row())
        assert pk["outcome"] == "white_package_ready" and not (pk["white_clean"].get("fit") or {}).get("done")
        assert 73 <= span(await a7.delivered("_white_1125_v1.jpg")) <= 79


async def test_a_white_master_below_the_band_holds_and_is_never_enlarged(monkeypatch):
    async with a7_service(monkeypatch) as a7:
        await approve_white(a7, 0.60, (300, 200, 700, 800))
        row, pk = a7.row(), package(a7.row())
        assert pk["outcome"] == "hold" and "below 73%" in pk["problem"] and "never enlarged" in pk["problem"]
        assert row["status"] == "hold", "a framing hold is not a background-rule decision (1.2): it stays a hold"
        assert a7.outside.image_calls() == 1


async def test_a_product_the_review_was_unsure_about_holds_instead_of_being_fitted(monkeypatch):
    """The blind count says "cropped" but its box is inside the frame: the review is unsure, so the master is not fitted."""
    async with a7_service(monkeypatch) as a7:
        await approve_white(a7, 0.90, (300, 50, 700, 950), cropped=True)
        pk = package(a7.row())
        assert pk["outcome"] == "hold" and "unsure whether the product is cut off" in pk["problem"]
        assert not (pk["white_clean"].get("fit") or {}).get("done")


async def test_an_approved_cut_off_product_holds_and_is_never_fitted(monkeypatch):
    """Rule 17: never scale a cut-off product; hold with a plain reason."""
    async with a7_service(monkeypatch) as a7:
        await a7.submit()
        a7.outside.image = stand_in_image(span=0.98)
        a7.outside.answers["blind-count"] = lambda r, b: blind_count_answer(box=(300, 0, 700, 1000), cropped=True)
        await a7.decide("go")
        assert (await a7.context())["review"]["result"] == "failed"
        await a7.decide("approve")
        row = a7.row()
        pk = package(row)
        assert pk.get("outcome") == "hold" or row["status"] == "hold", "nothing cut off is delivered"
        assert re.search(r"cut off|cropped|crop", row["hold_reason"] + " " + str(pk.get("problem", "")), re.I), \
            "the hold names the cut-off, whatever the run's status (1.2 may turn holds into a Go 2 decision)"
        assert not pk.get("white_clean", {}).get("fit", {}).get("done")
        assert a7.outside.image_calls() == 1


async def approve_unreviewed(a7, solid_span: float, box: tuple[int, int, int, int], cropped: bool = False) -> None:
    """The reviewer never answers: review again, then approve by eye. The blind count answers with `box`."""
    a7.outside.image = stand_in_image(span=solid_span)
    a7.outside.answers["blind-count"] = lambda r, b: blind_count_answer(box=box, cropped=cropped)
    await a7.submit()
    a7.outside.answers["anthropic"] = lambda r, b: httpx.Response(500, json={"error": {"message": "unavailable"}})
    await a7.decide("go")
    assert (await a7.context())["allowed"] == ["review_again", "stop"], (await a7.context())["allowed"]
    await a7.decide("review_again")
    assert "approve_unreviewed" in (await a7.context())["allowed"]
    await a7.decide("approve_unreviewed")


async def test_an_image_approved_without_a_review_is_fitted_when_its_box_is_inside_the_frame(monkeypatch):
    """1.3 follow-up: no review result, so the review's own box test decides; a safe box at about 90% is fitted to 76%."""
    async with a7_service(monkeypatch) as a7:
        await approve_unreviewed(a7, 0.90, (300, 50, 700, 950))
        pk = package(a7.row())
        assert pk["outcome"] == "white_package_ready" and pk["white_clean"]["fit"]["done"] is True, pk.get("problem")
        assert "no review result" in pk["white_clean"]["framing_rule"]["whole_in_frame"]["decided_by"]
        assert 73 <= span(await a7.delivered("_white_1125_v1.jpg")) <= 79


async def test_an_image_approved_without_a_review_holds_when_its_box_reaches_the_edge(monkeypatch):
    async with a7_service(monkeypatch) as a7:
        await approve_unreviewed(a7, 0.98, (300, 0, 700, 1000))
        pk = package(a7.row())
        assert pk["outcome"] == "hold" and "cut off" in pk["problem"]
        assert not (pk["white_clean"].get("fit") or {}).get("done")


async def test_an_image_approved_without_a_review_holds_when_the_count_flags_it_cropped(monkeypatch):
    """A safe box but the blind count's "cropped" flag: unsure, as the review would say, so it holds and is never fitted."""
    async with a7_service(monkeypatch) as a7:
        await approve_unreviewed(a7, 0.90, (300, 50, 700, 950), cropped=True)
        pk = package(a7.row())
        assert pk["outcome"] == "hold" and "unsure" in pk["problem"]
        assert not (pk["white_clean"].get("fit") or {}).get("done")


# ---------- 1.6: scene references over the request size (FL-10) ----------

async def big_room_scene(a7, photo: bytes) -> None:
    """A vendor photo and a 2600 px, 19 MB empty room. With a 2.8 MB vendor photo (980 px; the owner upload allows 3 MB)
    that is about 22 MB together, above the 14 MB set for one request (04 Settings, max_inline_mb). The room is above
    2048 px, so 1.6's resize in code (long side to 2048 px) brings it under the limit. The white master and the placement
    are the harness's stand-in image."""
    white, room = a7.outside.image, noise(2600)
    a7.outside.answers["image"] = lambda r, b: (a7.outside.image_requests.append(b),
                                                image_answer(room if len(a7.outside.image_requests) == 2 else white))[1]
    await a7.submit(photo=photo)
    await a7.decide("go")
    await a7.decide("approve")


def sent_images(body: dict) -> list[bytes]:
    """The images an image request carries inline, in order (image 1 first)."""
    return [base64.b64decode(p["data"]) for p in body["input"] if p.get("type") == "image"]


def scene_trail(row: dict) -> str:
    trail = row["trail"]
    return json.dumps([t for t in (json.loads(trail) if isinstance(trail, str) else trail) if t.get("name") == "Scene references"])


async def test_scene_references_are_resized_so_the_placement_keeps_the_master(monkeypatch):
    """FL-10 (Phase 1.6): the room above 2048 px is shrunk in code to a 2048 px long side, so the placement is sent with the
    approved master; the 980 px vendor photo is sent as it was received."""
    photo = noise(980)
    async with a7_service(monkeypatch) as a7:
        await big_room_scene(a7, photo)
        row = a7.row()
        assert row["status"] == "awaiting_go_2" and "scene" in (await a7.context())["decisionNeeded"], row["hold_reason"]
        assert a7.outside.image_calls() == 3, "white master, room, placement: one call each, none repeated"
        placement = a7.outside.image_requests[-1]
        assert "owner-approved catalogue master" in json.dumps(placement)
        vendor, master, room = sent_images(placement)
        assert vendor == photo, "the vendor photo is below 2048 px, so it is sent untouched"
        assert master == a7.outside.image, "the 2048 px master is not above 2048 px, so it is sent untouched"
        im = Image.open(io.BytesIO(room))
        assert im.format == "JPEG" and im.size == (2048, 2048), "the 2600 px room is shrunk to a 2048 px long side, aspect kept"
        assert len(vendor) + len(master) + len(room) <= 14 * 1024 * 1024
        assert re.search(r"resized in code: room 2600x2600 to 2048x2048 px, \d+ to \d+ bytes", scene_trail(row)), scene_trail(row)
        assert "vendor photo" not in scene_trail(row).split("resized in code:")[1]


async def test_scene_references_that_fit_are_sent_untouched(monkeypatch):
    """Below the request size nothing is resized: every reference goes out byte for byte as it was received or made."""
    async with a7_service(monkeypatch) as a7:
        await a7.to_scene_go2()
        placement = a7.outside.image_requests[-1]
        vendor, master, room = sent_images(placement)
        assert master == room == a7.outside.image, "the stand-in master and room (2048 px) are sent as they were made"
        assert Image.open(io.BytesIO(vendor)).size == (64, 48) and Image.open(io.BytesIO(vendor)).format == "PNG"
        assert "resized in code" not in scene_trail(a7.row())


async def test_scene_references_still_over_the_request_size_after_resizing_hold_before_the_placement(monkeypatch):
    """With the request size set to 8 MB (04 Settings, max_inline_mb) the room is shrunk to 2048 px (about 6.5 MB, as noise
    does not compress), the 980 px vendor photo is not above 2048 px so it is never resized, and the master is left out: still
    above 8 MB, so the scene holds before the placement call (nothing is reserved, sent or paid for it)."""
    real = Executor._run_node

    async def run_node(self, flow, execution, node, inputs):
        out = await real(self, flow, execution, node, inputs)
        if node.name == "04 Settings":
            for item in out[0]:
                item["json"]["max_inline_mb"] = 8
        return out
    monkeypatch.setattr(Executor, "_run_node", run_node)
    photo = noise(980)
    async with a7_service(monkeypatch) as a7:
        await big_room_scene(a7, photo)
        row = a7.row()
        assert row["status"] == "hold", row["status"]
        assert "even after every photo above 2048 px was resized in code to 2048 px" in row["hold_reason"], row["hold_reason"]
        assert "Resizing is not built" not in row["hold_reason"]
        assert a7.outside.image_calls() == 2, "the white master and the room were made; the placement is not sent"
        assert a7.outside.reserves().count("15g Send to Google") == 2, "no budget is reserved for the placement"
        assert "resized in code: room 2600x2600 to 2048x2048 px" in scene_trail(row)
        assert "vendor photo" not in scene_trail(row).split("resized in code:")[1], "the vendor photo is not above 2048 px"


def smooth_photo(side: int = 2400) -> bytes:
    """A 2400 px JPEG of about 2.8 MB (under the owner upload's 3 MB): blurred noise at quality 94, 4:4:4."""
    rng = random.Random(16)
    small = Image.frombytes("RGB", (250, 250), bytes(rng.randrange(256) for _ in range(250 * 250 * 3)))
    out = io.BytesIO()
    small.resize((side, side), Image.BILINEAR).save(out, "JPEG", quality=94, subsampling=0)
    return out.getvalue()


async def test_a_vendor_photo_above_2048_px_is_resized_last_and_stays_image_1(monkeypatch):
    """Review finding (22 Oct 2026): the vendor photo is resized only in the second pass, after the room, and only because the
    images are still too large (here the request size is 8.5 MB). It stays image 1; the resize changes its size, never its place."""
    real = Executor._run_node

    async def run_node(self, flow, execution, node, inputs):
        out = await real(self, flow, execution, node, inputs)
        if node.name == "04 Settings":
            for item in out[0]:
                item["json"]["max_inline_mb"] = 8.5
        return out
    monkeypatch.setattr(Executor, "_run_node", run_node)
    photo = smooth_photo()
    assert len(photo) < 3 * 1024 * 1024
    async with a7_service(monkeypatch) as a7:
        await big_room_scene(a7, photo)
        row = a7.row()
        assert row["status"] == "awaiting_go_2", row["hold_reason"]
        vendor, master, room = sent_images(a7.outside.image_requests[-1])
        assert Image.open(io.BytesIO(vendor)).size == (2048, 2048) and Image.open(io.BytesIO(room)).size == (2048, 2048)
        assert master == a7.outside.image, "the master is kept: resizing the vendor photo was enough"
        resized = scene_trail(row).split("resized in code:")[1]
        assert resized.index("room 2600x2600") < resized.index("vendor photo 2400x2400 to 2048x2048 px"), resized
