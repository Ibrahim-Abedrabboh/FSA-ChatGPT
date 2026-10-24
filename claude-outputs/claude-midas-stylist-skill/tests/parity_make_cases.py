"""Make random styling requests, run the Python engine, save inputs + expected outputs.
The JS n8n node is then run on the same inputs by parity_check.js. Synthetic data only."""
import json
import random
import sys
from dataclasses import asdict
from pathlib import Path

from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "reference"))
from stylist_engine import check_plan  # noqa: E402
from stylist_schema import STYLE_MENU, StylingRequest  # noqa: E402

rng = random.Random(20261015)
CATS = ["sofa", "centre-table", "side-table", "lamp", "mirror", "chair", "rug", "vase"]
FIN = [("wood", "oak"), ("wood", "walnut"), ("wood", "ash"), ("metal", "brass"), ("metal", "chrome"),
       ("metal", "black metal"), ("glass", "clear glass"), ("fabric", "linen"), ("stone", "marble")]


def maybe(p, v):
    return v if rng.random() < p else None


def piece(i, role, cat):
    p = {"id": f"p{i}", "name": f"Piece {i}", "role": role, "category": cat}
    if role == "midas_support":
        p.update(sku=f"1{i:05d}", catalogue_photo=f"cat/{i}.webp", retrieved_on="2026-09-28",
                 availability=rng.choice(["in_stock", "pre_order", "out_of_stock", "not_confirmed"]))
    basis = {}
    tags = {
        "style": maybe(0.6, rng.choice(STYLE_MENU[:4])),
        "visual_weight": maybe(0.7, rng.choice(["light", "medium", "heavy"])),
        "silhouette": maybe(0.6, rng.choice(["angular", "curved", "mixed"])),
        "texture": maybe(0.6, rng.choice(["smooth", "medium", "rough"])),
        "dimensions_cm": maybe(0.6, {"width": rng.choice([60, 80, 100, 120, 160, 200, 240])}),
        "colour_hex": maybe(0.2, rng.choice(["#8B5E3C", "#ffffff", "#GGGGGG"])),
    }
    if rng.random() < 0.6:
        fins = rng.sample(FIN, rng.randint(1, 2))
        tags["finishes"] = [{"family": f, "name": n, **({"undertone": rng.choice(["warm", "cool", "neutral"])}
                                                        if f == "wood" and rng.random() < 0.8 else {})} for f, n in fins]
    for k, v in tags.items():
        if v is not None:
            p[k] = v
            if rng.random() < 0.99:  # occasionally leave the basis out -> invalid
                basis[k] = rng.choice(["vendor_stated", "catalogue_stated", "estimated_from_photo"])
    p["basis"] = basis
    if role != "hero" and rng.random() < 0.8:
        p["purpose"], p["rests_on"] = "use", rng.choice(["floor", "wall", "table"])
    return p


def request():
    n = rng.randint(2, 5)
    pieces = [piece(0, "hero", rng.choice(CATS[:3] + ["chair"]))]
    for i in range(1, n):
        role = rng.choice(["midas_support", "midas_support", "generic_context"])
        pieces.append(piece(i, role, rng.choice(CATS)))
    if rng.random() < 0.03:
        pieces[1]["role"] = "hero"  # invalid: two heroes
    if rng.random() < 0.03 and pieces[1]["role"] == "midas_support":
        pieces[1].pop("sku")  # invalid: Midas without SKU
    req = {"pieces": pieces, "output": rng.choice(["lifestyle", "lifestyle", "website_package", "white_background"]),
           "max_midas_pieces": rng.choice([1, 2, 3])}
    if rng.random() < 0.6:
        roles = rng.sample(["dominant_60", "secondary_30", "accent_10"], rng.randint(1, 3))
        req["surfaces"] = [{"name": r, "colour": "x", "role": r,
                            **({"area_share": rng.choice([0.05, 0.1, 0.3, 0.6, 0.9])} if rng.random() < 0.7 else {})}
                           for r in roles]
    if rng.random() < 0.3:
        req["weights"] = {"style_cohesion": rng.randint(0, 40), "scale_proportion": rng.randint(0, 40)}
    else:
        req["profile"] = rng.choice(["balanced", "strict_match", "eclectic_designer"])
    return req


def run(req):
    try:
        r = asdict(check_plan(StylingRequest(**req)))
        r["excluded"] = [list(x) for x in r["excluded"]]
        return r
    except ValidationError:
        return {"status": "invalid_input"}


cases = [{"input": (q := request()), "expected": run(q)} for _ in range(int(sys.argv[1]) if len(sys.argv) > 1 else 2000)]
Path(sys.argv[2] if len(sys.argv) > 2 else "parity_cases.json").write_text(json.dumps(cases))
from collections import Counter  # noqa: E402
print("cases:", len(cases), dict(Counter(c["expected"]["status"] for c in cases)))
