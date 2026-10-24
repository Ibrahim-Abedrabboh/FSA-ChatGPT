"""Midas Stylist check API (FastAPI). Draft, 15 Oct 2026.

Replaces the scoring core of the supplied main.py with the skill's engine.
Invalid input returns 422 with the reasons (FastAPI's normal validation answer),
instead of a catch-all 500. Never approves anything.

Run locally: uvicorn claude_main:app --reload   (from this folder)
"""
import sys
from dataclasses import asdict
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import RedirectResponse

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "reference"))
from stylist_engine import check_plan  # noqa: E402
from stylist_schema import AMBIENCE_MENU, PRESET_MENU, PROFILES, STYLE_MENU, StylingRequest  # noqa: E402

app = FastAPI(
    title="Midas Stylist check",
    version="0.1.0",
    description="Rule-based styling check run before rendering. The score ranks plans; it is not an approval.",
)


@app.post("/api/v1/stylist/check")
def check(request: StylingRequest) -> dict:
    result = asdict(check_plan(request))
    result["excluded"] = [list(x) for x in result["excluded"]]
    result["profile"] = "custom" if request.weights else request.profile
    return result


@app.get("/api/v1/stylist/menus")
def menus() -> dict:
    return {"styles": list(STYLE_MENU), "ambiences": list(AMBIENCE_MENU), "presets": list(PRESET_MENU),
            "profiles": {k: v.model_dump() for k, v in PROFILES.items()}}


@app.get("/", include_in_schema=False)
def docs() -> RedirectResponse:
    return RedirectResponse(url="/docs")
