"""Midas Stylist rule engine. Draft, 15 Oct 2026.

Runs BEFORE any render. Pure code: no model call, no paid call.
It filters supporting pieces, checks eight pillars, and returns a plan status.
The score is a rule-based styling-fit figure for ranking candidate plans.
It is a judgement encoded as rules, not a measurement, and never an approval.
It never goes to the client page.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Literal, Optional

from stylist_schema import (FinishFamily, PaletteRole, Piece, Role, Silhouette, StylingRequest,
                            Texture, Undertone, VisualWeight)

Result = Literal["pass", "partial", "fail", "unknown"]
VALUE = {"pass": 1.0, "partial": 0.5, "fail": 0.0}
MIN_COVERAGE = 0.6          # share of weight that must be evaluable before a score is given
TABLE_TO_SOFA = (0.5, 0.75)  # rule of thumb (about two thirds); owner to confirm


def _half_up(x: float) -> int:
    return math.floor(round(x, 9) + 0.5)


def _pct(x: float) -> str:
    return f"{_half_up(x * 100)}%"


@dataclass
class PillarResult:
    pillar: str
    result: Result
    reason: str
    fix: Optional[str] = None


@dataclass
class PlanCheck:
    status: Literal["plan_ready", "plan_ready_with_warnings", "plan_needs_change", "needs_information"]
    pillars: list[PillarResult]
    kept: list[str]
    excluded: list[tuple[str, str]]
    score: Optional[int]
    coverage: float
    score_label: str = "Styling fit (rule-based judgement, not a measurement; not an approval)"
    critique: dict = field(default_factory=dict)


# ---------------------------------------------------------------- filtering
def select_pieces(req: StylingRequest) -> tuple[list[Piece], list[tuple[str, str]]]:
    hero = req.hero
    kept, excluded = [hero], []
    midas_used = 0
    for p in req.pieces:
        if p is hero:
            continue
        if req.output == "white_background":
            excluded.append((p.id, "white background output shows the product alone"))
            continue
        if p.category == hero.category:
            excluded.append((p.id, f"same kind as the product ({p.category})"))
            continue
        if p.role is Role.MIDAS_SUPPORT:
            if p.availability.value == "out_of_stock":
                excluded.append((p.id, f"out of stock as read on {p.retrieved_on}"))
                continue
            if midas_used >= req.max_midas_pieces:
                excluded.append((p.id, f"over the limit of {req.max_midas_pieces} Midas pieces"))
                continue
            midas_used += 1
        kept.append(p)
    return kept, excluded


# ---------------------------------------------------------------- pillars
def _known(pieces, attr):
    return [p for p in pieces if getattr(p, attr) is not None]


def scale_proportion(pieces: list[Piece], hero: Piece) -> PillarResult:
    known = _known(pieces, "visual_weight")
    notes, results = [], []
    if len(known) >= 2:
        heavy = [p for p in known if p.visual_weight is VisualWeight.HEAVY]
        light = [p for p in known if p.visual_weight is VisualWeight.LIGHT]
        if len(heavy) >= 2 and not light:
            results.append("fail")
            notes.append(f"{len(heavy)} heavy pieces and nothing light: the group will look crowded")
        elif len(heavy) >= 2:
            results.append("partial")
            notes.append("two heavy pieces, partly offset by a light one")
        else:
            results.append("pass")
            notes.append("visual weight is balanced")
    tables = [p for p in pieces if p is not hero and "table" in p.category]
    if "sofa" in hero.category and hero.dimensions_cm and hero.dimensions_cm.width:
        for t in tables:
            if t.dimensions_cm and t.dimensions_cm.width:
                r = t.dimensions_cm.width / hero.dimensions_cm.width
                ok = TABLE_TO_SOFA[0] <= r <= TABLE_TO_SOFA[1]
                results.append("pass" if ok else "partial")
                notes.append(f"{t.name} is {_pct(r)} of the sofa width"
                             + ("" if ok else " (rule of thumb: about half to three quarters)"))
    if not results:
        return PillarResult("scale_proportion", "unknown", "visual weight and sizes not confirmed")
    worst = min(results, key=lambda r: VALUE[r])
    fix = None if worst == "pass" else "swap one heavy piece for a leggy or glass one, or resize the table"
    return PillarResult("scale_proportion", worst, "; ".join(notes), fix)


def silhouette_lines(pieces: list[Piece]) -> PillarResult:
    known = {p.silhouette for p in _known(pieces, "silhouette")}
    if len(_known(pieces, "silhouette")) < 2:
        return PillarResult("silhouette_lines", "unknown", "silhouettes not confirmed")
    if Silhouette.MIXED in known or {Silhouette.ANGULAR, Silhouette.CURVED} <= known:
        return PillarResult("silhouette_lines", "pass", "straight and curved lines balance each other")
    if known == {Silhouette.ANGULAR}:
        return PillarResult("silhouette_lines", "partial", "all angular: the room may feel rigid",
                            "add one rounded piece: a round table, a curved lamp or an oval mirror")
    return PillarResult("silhouette_lines", "partial", "all curved: shapes may read as soft or busy",
                        "anchor with one straight-lined piece")


def materials_finishes(pieces: list[Piece]) -> PillarResult:
    hard = [(f.family, f.name.lower(), f.undertone) for p in pieces for f in p.finishes
            if f.family in (FinishFamily.WOOD, FinishFamily.METAL)]
    if not hard:
        return PillarResult("materials_finishes", "unknown", "wood and metal finishes not confirmed")
    distinct = {(fam, name) for fam, name, _ in hard}
    wood_tones = {u for fam, _, u in hard if fam is FinishFamily.WOOD and u is not None}
    if len(distinct) > 3:
        return PillarResult("materials_finishes", "fail",
                            f"{len(distinct)} different wood/metal finishes; the limit is 3",
                            "drop or swap the piece that adds the fourth finish")
    if {Undertone.WARM, Undertone.COOL} <= wood_tones:
        return PillarResult("materials_finishes", "partial", "warm and cool wood undertones are mixed",
                            "keep wood undertones the same even if darkness differs")
    return PillarResult("materials_finishes", "pass", f"{len(distinct)} finish(es), undertones consistent")


def colour_distribution(req: StylingRequest) -> PillarResult:
    if req.output == "white_background":
        return PillarResult("colour_distribution", "unknown", "no scene on a white background")
    if not req.surfaces:
        return PillarResult("colour_distribution", "unknown", "room surfaces not planned yet")
    roles = {s.role for s in req.surfaces}
    missing = [r.value for r in PaletteRole if r not in roles]
    if missing:
        return PillarResult("colour_distribution", "partial", f"no surface carries {', '.join(missing)}",
                            "give one surface or textile each role: 60 dominant, 30 secondary, 10 accent")
    if all(s.area_share is not None for s in req.surfaces):
        share = {r: sum(s.area_share for s in req.surfaces if s.role is r) for r in PaletteRole}
        bands = {PaletteRole.DOMINANT: (0.45, 0.75), PaletteRole.SECONDARY: (0.15, 0.45),
                 PaletteRole.ACCENT: (0.03, 0.20)}
        off = [f"{r.value} at {_pct(share[r])}" for r, (lo, hi) in bands.items() if not lo <= share[r] <= hi]
        if off:
            return PillarResult("colour_distribution", "partial", "split is off: " + ", ".join(off),
                                "rebalance the rug, curtains or cushions; never recolour the product")
        return PillarResult("colour_distribution", "pass", "roughly 60/30/10 across the planned surfaces")
    return PillarResult("colour_distribution", "pass", "all three roles present; shares not estimated")


def texture_contrast(pieces: list[Piece]) -> PillarResult:
    known = {p.texture for p in _known(pieces, "texture")}
    if len(_known(pieces, "texture")) < 2:
        return PillarResult("texture_contrast", "unknown", "textures not confirmed")
    if {Texture.SMOOTH, Texture.ROUGH} <= known:
        return PillarResult("texture_contrast", "pass", "smooth and textured surfaces sit together")
    return PillarResult("texture_contrast", "partial", f"only {', '.join(sorted(t.value for t in known))} surfaces",
                        "add one contrasting texture: linen or boucle against glass or lacquer, or the reverse")


def function_practicality(req: StylingRequest, pieces: list[Piece]) -> PillarResult:
    if req.output == "white_background":
        return PillarResult("function_practicality", "unknown", "no scene on a white background")
    support = [p for p in pieces if p.role is not Role.HERO]
    if not support:
        return PillarResult("function_practicality", "unknown", "no supporting pieces planned")
    lacking = [p.name for p in support if not (p.purpose and p.rests_on)]
    if lacking:
        return PillarResult("function_practicality", "partial",
                            "no purpose or support surface for: " + ", ".join(lacking),
                            "give every supporting piece a use and a surface it stands on")
    return PillarResult("function_practicality", "pass", "every supporting piece has a use and a surface")


def focal_point(pieces: list[Piece], hero: Piece) -> PillarResult:
    rank = {VisualWeight.LIGHT: 0, VisualWeight.MEDIUM: 1, VisualWeight.HEAVY: 2}
    support = [p for p in pieces if p is not hero]
    if not support:
        return PillarResult("focal_point", "pass", "the product stands alone")
    rivals = []
    for p in support:
        if hero.visual_weight and p.visual_weight and rank[p.visual_weight] > rank[hero.visual_weight]:
            rivals.append(f"{p.name} is visually heavier")
        hw = hero.dimensions_cm.width if hero.dimensions_cm else None
        pw = p.dimensions_cm.width if p.dimensions_cm else None
        if hw and pw and pw > hw:
            rivals.append(f"{p.name} is wider ({_half_up(pw)} vs {_half_up(hw)} cm)")
    if rivals:
        return PillarResult("focal_point", "partial", "; ".join(rivals),
                            "keep the product the clear subject: smaller support, or move it back")
    if hero.visual_weight is None and not (hero.dimensions_cm and hero.dimensions_cm.width):
        return PillarResult("focal_point", "unknown", "product weight and size not confirmed")
    return PillarResult("focal_point", "pass", "nothing outweighs the product")


def style_cohesion(req: StylingRequest, pieces: list[Piece]) -> PillarResult:
    styles = {p.style for p in _known(pieces, "style")}
    if len(_known(pieces, "style")) < 2:
        return PillarResult("style_cohesion", "unknown", "styles not confirmed")
    if len(styles) == 1:
        return PillarResult("style_cohesion", "pass", f"one style: {next(iter(styles))}")
    if len(styles) == 2:
        return PillarResult("style_cohesion", "partial", "two styles: " + " + ".join(sorted(styles)),
                            "fine for an eclectic brief; for a strict brief pick the requested style")
    return PillarResult("style_cohesion", "fail", f"{len(styles)} styles in one scene",
                        "cut to the requested style plus at most one accent style")


# ---------------------------------------------------------------- main
def check_plan(req: StylingRequest) -> PlanCheck:
    hero = req.hero
    pieces, excluded = select_pieces(req)
    pillars = [
        scale_proportion(pieces, hero),
        silhouette_lines(pieces),
        materials_finishes(pieces),
        colour_distribution(req),
        texture_contrast(pieces),
        function_practicality(req, pieces),
        focal_point(pieces, hero),
        style_cohesion(req, pieces),
    ]
    w = req.active_weights().normalised()
    known = [p for p in pillars if p.result != "unknown"]
    cov_raw = sum(w[p.pillar] for p in known)
    coverage = math.floor(round(cov_raw * 1000, 6) + 0.5) / 1000  # half-up; float noise removed first
    score = None
    if known and coverage >= MIN_COVERAGE:
        score = math.floor(round(100 * sum(w[p.pillar] * VALUE[p.result] for p in known) / cov_raw, 9) + 0.5)

    results = {p.result for p in pillars}
    if coverage < MIN_COVERAGE:
        status = "needs_information"
    elif "fail" in results:
        status = "plan_needs_change"
    elif "partial" in results:
        status = "plan_ready_with_warnings"
    else:
        status = "plan_ready"

    critique = {
        "the_win": [p.reason for p in pillars if p.result == "pass"][:2],
        "the_conflict": [p.reason for p in pillars if p.result in ("fail", "partial")],
        "the_fix": [p.fix for p in pillars if p.fix and p.result in ("fail", "partial")],
        "not_confirmed": [p.pillar for p in pillars if p.result == "unknown"],
    }
    return PlanCheck(status, pillars, [p.id for p in pieces], excluded, score, coverage, critique=critique)
