import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "api"))
from claude_main import app  # noqa: E402

client = TestClient(app)
HERO = {"id": "h", "name": "Sofa", "role": "hero", "category": "sofa", "visual_weight": "heavy",
        "silhouette": "angular", "texture": "rough", "dimensions_cm": {"width": 240},
        "basis": {"visual_weight": "vendor_stated", "silhouette": "vendor_stated", "texture": "vendor_stated",
                  "dimensions_cm": "vendor_stated"}}
TABLE = {"id": "t", "name": "Round table", "role": "midas_support", "category": "centre-table", "sku": "160218",
         "catalogue_photo": "cat/t.webp", "retrieved_on": "2026-09-28", "availability": "in_stock",
         "visual_weight": "light", "silhouette": "curved", "texture": "smooth", "dimensions_cm": {"width": 150},
         "basis": {"visual_weight": "catalogue_stated", "silhouette": "catalogue_stated",
                   "texture": "catalogue_stated", "dimensions_cm": "catalogue_stated"},
         "purpose": "surface", "rests_on": "floor"}


def test_valid_request():
    r = client.post("/api/v1/stylist/check", json={"pieces": [HERO, TABLE]})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] in {"plan_ready", "plan_ready_with_warnings", "needs_information"}
    assert "not an approval" in body["score_label"]


def test_invalid_request_is_422_with_reason():
    bad = dict(TABLE, sku=None)
    r = client.post("/api/v1/stylist/check", json={"pieces": [HERO, bad]})
    assert r.status_code == 422
    assert "sku" in r.text


def test_menus():
    assert len(client.get("/api/v1/stylist/menus").json()["styles"]) == 10
