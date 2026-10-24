"""Tests for the Midas Stylist schema and engine. No network, no model, no paid call.

Fixtures marked SYNTHETIC are invented to exercise one rule each.
The fixture marked BOARD uses only what the C01-C02 node states
(Magnific board 'Midas · 29 September casework · Working copy', read 15 Oct 2026).
"""
import sys
from datetime import date
from pathlib import Path

import pytest
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "reference"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import original_schema as orig  # noqa: E402
from stylist_engine import check_plan  # noqa: E402
from stylist_schema import PROFILES, Piece, StylingRequest, Surface, Weights  # noqa: E402

D = date(2026, 9, 28)


def midas(id, name, category, **kw):
    base = dict(id=id, name=name, role="midas_support", category=category, sku="1" + id,
                catalogue_photo=f"catalogue/{id}.webp", retrieved_on=D, availability="in_stock")
    base.update(kw)
    return Piece(**base)


def hero(**kw):
    base = dict(id="h", name="Hero sofa", role="hero", category="sofa")
    base.update(kw)
    return Piece(**base)


# ------------------------------------------------ original schema: gaps are real
def test_original_accepts_non_hex_digits():
    item = dict(id="a", name="a", style="Modern", visual_weight="Heavy", silhouette="Mixed",
                primary_material="Leather", color_hex="#GGGGGG", color_role="Dominant (60%)")
    assert orig.FurnitureItem(**item).color_hex == "#GGGGGG"  # gap: not a colour


def test_original_does_not_enforce_weight_total():
    cfg = orig.StylistWeightConfig(style_match_weight=100, scale_balance_weight=100,
                                   silhouette_flow_weight=100, material_limit_weight=100,
                                   color_ratio_weight=100)
    assert sum(cfg.model_dump().values()) == 500  # gap: the '*' validator does nothing


def test_original_cannot_say_unknown():
    with pytest.raises(ValidationError):
        orig.FurnitureItem(id="a", name="a", color_hex="#000000", color_role="Accent (10%)",
                           style="Modern", visual_weight="Heavy", silhouette="Mixed",
                           primary_material=None)  # forces a guess for every field


# ------------------------------------------------ new schema
def test_hex_must_be_hex():
    with pytest.raises(ValidationError):
        hero(colour_hex="#GGGGGG", basis={"colour_hex": "vendor_stated"})
    with pytest.raises(ValidationError):
        hero(colour_hex="brown", basis={"colour_hex": "vendor_stated"})
    assert hero(colour_hex="#8b5e3c", basis={"colour_hex": "vendor_stated"}).colour_hex == "#8B5E3C"


def test_photo_hex_is_an_estimate():
    with pytest.raises(ValidationError):
        hero(colour_hex="#8B5E3C", basis={"colour_hex": "observed_in_photo"})


def test_filled_tag_needs_basis():
    with pytest.raises(ValidationError, match="no basis"):
        hero(visual_weight="heavy")


def test_unknown_is_allowed():
    assert hero().visual_weight is None


def test_midas_piece_needs_provenance():
    with pytest.raises(ValidationError, match="sku"):
        Piece(id="t", name="Table", role="midas_support", category="centre-table")


def test_generic_cannot_carry_sku():
    with pytest.raises(ValidationError, match="generic"):
        Piece(id="v", name="Vase", role="generic_context", category="vase", sku="999")


def test_exactly_one_hero():
    with pytest.raises(ValidationError, match="exactly one hero"):
        StylingRequest(pieces=[hero(), hero(id="h2")])


def test_duplicate_piece_ids_rejected():
    with pytest.raises(ValidationError, match="unique"):
        StylingRequest(pieces=[hero(), midas("t", "T", "centre-table"), midas("t", "T", "centre-table")])


def test_style_must_be_on_menu():
    with pytest.raises(ValidationError):
        hero(style="Modern", basis={"style": "estimated_from_photo"})


def test_weights_bounds_and_zero():
    with pytest.raises(ValidationError):
        Weights(scale_proportion=105)
    with pytest.raises(ValidationError):
        Weights(**{k: 0 for k in Weights().model_dump()})
    assert abs(sum(Weights(scale_proportion=90).normalised().values()) - 1) < 1e-9


# ------------------------------------------------ engine: filtering
def test_filters_out_of_stock_same_kind_and_limit():
    req = StylingRequest(max_midas_pieces=1, pieces=[
        hero(),
        midas("s2", "Second sofa", "sofa"),
        midas("oos", "Vase", "vase", availability="out_of_stock"),
        midas("t1", "Table one", "centre-table"),
        midas("t2", "Lamp", "lamp"),
    ])
    r = check_plan(req)
    reasons = dict(r.excluded)
    assert "same kind" in reasons["s2"]
    assert "out of stock" in reasons["oos"]
    assert "over the limit" in reasons["t2"]
    assert r.kept == ["h", "t1"]


def test_white_background_keeps_product_alone():
    req = StylingRequest(output="white_background", pieces=[hero(), midas("t", "T", "centre-table")])
    r = check_plan(req)
    assert r.kept == ["h"]
    assert r.status == "needs_information"  # no scene to score
    assert r.score is None


# ------------------------------------------------ engine: rules (SYNTHETIC)
def tagged(id, name, category, role="midas_support", **tags):
    basis = {k: "catalogue_stated" for k in tags}
    f = midas if role == "midas_support" else (lambda i, n, c, **kw: Piece(id=i, name=n, role=role, category=c, **kw))
    return f(id, name, category, basis=basis, **tags)


def full_request(**over):
    pieces = over.pop("pieces", [
        hero(visual_weight="heavy", silhouette="angular", texture="rough", style="Japandi",
             finishes=[{"family": "wood", "name": "oak", "undertone": "warm"}],
             dimensions_cm={"width": 240}, basis={k: "vendor_stated" for k in
                                                   ("visual_weight", "silhouette", "texture", "style",
                                                    "finishes", "dimensions_cm")}),
        tagged("t", "Round table", "centre-table", visual_weight="light", silhouette="curved",
               texture="smooth", style="Japandi", dimensions_cm={"width": 160},
               finishes=[{"family": "wood", "name": "walnut", "undertone": "warm"}],
               purpose="surface for books", rests_on="floor"),
    ])
    surfaces = over.pop("surfaces", [Surface(name="walls", colour="warm ivory", role="dominant_60", area_share=0.6),
                                     Surface(name="rug", colour="sand", role="secondary_30", area_share=0.3),
                                     Surface(name="cushions", colour="sage", role="accent_10", area_share=0.1)])
    return StylingRequest(pieces=pieces, surfaces=surfaces, **over)


def test_clean_plan_is_ready_not_approved():
    r = check_plan(full_request())
    assert r.status == "plan_ready"
    assert r.score == 100
    assert "not an approval" in r.score_label
    assert "approved" not in r.status


def test_two_heavy_pieces_fail_scale():
    req = full_request(pieces=[
        hero(visual_weight="heavy", basis={"visual_weight": "vendor_stated"}),
        tagged("t", "Plinth table", "centre-table", visual_weight="heavy", purpose="x", rests_on="floor"),
    ])
    p = {x.pillar: x for x in check_plan(req).pillars}
    assert p["scale_proportion"].result == "fail"
    assert p["focal_point"].result == "pass"


def test_four_finishes_fail_and_undertone_clash_partial():
    fins = [{"family": "wood", "name": "oak", "undertone": "warm"},
            {"family": "metal", "name": "brass"},
            {"family": "metal", "name": "chrome"},
            {"family": "wood", "name": "ash", "undertone": "cool"}]
    req = full_request(pieces=[hero(finishes=fins[:2], basis={"finishes": "vendor_stated"}),
                               tagged("t", "T", "centre-table", finishes=fins[2:], purpose="x", rests_on="floor")])
    p = {x.pillar: x for x in check_plan(req).pillars}
    assert p["materials_finishes"].result == "fail"
    req2 = full_request(pieces=[hero(finishes=[fins[0]], basis={"finishes": "vendor_stated"}),
                                tagged("t", "T", "centre-table", finishes=[fins[3]], purpose="x", rests_on="floor")])
    p2 = {x.pillar: x for x in check_plan(req2).pillars}
    assert p2["materials_finishes"].result == "partial"


def test_table_ratio_rule_of_thumb():
    req = full_request(pieces=[
        hero(dimensions_cm={"width": 240}, basis={"dimensions_cm": "vendor_stated"}),
        tagged("t", "Tiny table", "centre-table", dimensions_cm={"width": 60}, purpose="x", rests_on="floor")])
    p = {x.pillar: x for x in check_plan(req).pillars}
    assert p["scale_proportion"].result == "partial"
    assert "25%" in p["scale_proportion"].reason


def test_missing_purpose_flags_function():
    req = full_request(pieces=[hero(), tagged("t", "T", "centre-table")])
    p = {x.pillar: x for x in check_plan(req).pillars}
    assert p["function_practicality"].result == "partial"


def test_colour_split_off_band():
    req = full_request(surfaces=[Surface(name="walls", colour="ivory", role="dominant_60", area_share=0.9),
                                 Surface(name="rug", colour="sand", role="secondary_30", area_share=0.05),
                                 Surface(name="pillow", colour="rust", role="accent_10", area_share=0.05)])
    p = {x.pillar: x for x in check_plan(req).pillars}
    assert p["colour_distribution"].result == "partial"


def test_unknowns_do_not_count_and_low_coverage_gives_no_score():
    r = check_plan(StylingRequest(pieces=[hero(), midas("t", "T", "centre-table", purpose="x", rests_on="floor")]))
    assert r.score is None
    assert r.status == "needs_information"
    assert "scale_proportion" in r.critique["not_confirmed"]


# ------------------------------------------------ weights only matter when pillars disagree
def test_profiles_cannot_move_a_uniform_result():
    req_scores = {name: check_plan(full_request(profile=name)).score for name in PROFILES}
    assert len(set(req_scores.values())) == 1  # all pass -> same score under every profile


def test_profiles_move_a_mixed_result():
    tags = dict(silhouette="angular")
    pieces = [hero(style="Japandi", visual_weight="heavy", texture="rough", **tags,
                   basis={k: "vendor_stated" for k in ("style", "visual_weight", "texture", "silhouette")}),
              tagged("t", "T", "centre-table", style="Modern Luxury", visual_weight="light", texture="smooth",
                     purpose="x", rests_on="floor", **tags),
              tagged("l", "L", "lamp", style="Mediterranean", visual_weight="light", texture="smooth",
                     purpose="y", rests_on="table", **tags)]
    scores = {name: check_plan(full_request(pieces=pieces, profile=name)).score for name in PROFILES}
    assert None not in scores.values()
    assert scores["strict_match"] < scores["eclectic_designer"]
    print("profile scores, three styles + all angular:", scores)


# ------------------------------------------------ BOARD fixture: real data only
def test_board_c01_c02_fixture_is_honest():
    sept11 = date(2026, 9, 11)  # 'Sources retrieved Sep 11'; year assumed 2026
    req = StylingRequest(style="Contemporary Elegance", pieces=[
        Piece(id="zura", name="Zura chair", role="hero", category="chair", sku="SKU167339",
              dimensions_cm={"width": 88, "depth": 83, "height": 72}, basis={"dimensions_cm": "catalogue_stated"}),
        Piece(id="corinne", name="Corinne coffee table", role="midas_support", category="centre-table",
              sku="SKU167885", catalogue_photo="not recorded in node", retrieved_on=sept11,
              dimensions_cm={"width": 80, "depth": 80, "height": 42},
              finishes=[{"family": "glass", "name": "black glass"}, {"family": "metal", "name": "black metal"}],
              basis={"dimensions_cm": "catalogue_stated", "finishes": "catalogue_stated"},
              purpose="surface beside the chair", rests_on="floor"),
        Piece(id="metro", name="Metro wall mirror", role="midas_support", category="mirror",
              sku="SKU167879", catalogue_photo="not recorded in node", retrieved_on=sept11,
              dimensions_cm={"width": 100, "depth": 6, "height": 100},
              finishes=[{"family": "metal", "name": "gold", "undertone": "warm"}],
              basis={"dimensions_cm": "catalogue_stated", "finishes": "catalogue_stated"},
              purpose="wall focal behind the chair", rests_on="wall"),
    ])
    r = check_plan(req)
    p = {x.pillar: x for x in r.pillars}
    # The mirror is wider than the hero chair: flagged as a possible rival, not a failure.
    assert p["focal_point"].result == "partial" and "Metro wall mirror" in p["focal_point"].reason
    # Too little is confirmed for a score: weight, silhouette, texture, style of each piece.
    assert r.score is None and r.status == "needs_information"
