"""Cross-check with the owner site's real JavaScript (no network).

The site builds the payload with its own quote and intent, the engine runs against
the fake budget API, and then the site's quoteCall, normalizeAnswer,
verifiedAnalysisAnswers, observationFromVerifiedAnswers and analysisReceipt are run
on exactly what the engine sent and answered. Skipped when Node or the workspace is
not available.
"""

from __future__ import annotations

import json
import pathlib
import shutil
import subprocess
import uuid

import pytest

from tests.conftest import PNG, ROOM_PNG, Job, sha

ENGINE = pathlib.Path(__file__).resolve().parents[1]
WORKSPACE = ENGINE.parents[1] / "claude-outputs" / "claude-midas-a7-owner-workspace"
SCRIPT = ENGINE / "tests" / "js" / "crosscheck.mjs"
NODE = shutil.which("node")

pytestmark = pytest.mark.skipif(not NODE or not (WORKSPACE / "lib" / "a7-budget.mjs").exists(), reason="node or owner workspace not available")


def node(mode: str, data: dict, tmp_path: pathlib.Path) -> dict:
    path = tmp_path / f"{mode}.json"
    path.write_text(json.dumps(data))
    result = subprocess.run([NODE, str(SCRIPT), str(WORKSPACE), mode, str(path)], capture_output=True, text=True, timeout=60)
    assert result.returncode == 0, result.stderr[-2000:]
    return json.loads(result.stdout)


@pytest.mark.parametrize("room", [False, True])
def test_engine_output_passes_the_site_javascript(harness, tmp_path, room):
    draft = str(uuid.uuid4())
    source = {"draftId": draft, "clientRunId": "owner-" + draft, "runId": "claude-a7-" + draft, "sourceSha256": sha(PNG),
              "roomSha256": sha(ROOM_PNG) if room else None, "referenceFingerprint": "c" * 64, "budgetLimitUsd": 5}
    request_id = str(uuid.uuid4())
    samples = [{"b": 5, "a": 3.18, "c": [1.0, 0.25, None, True, "é\n\"x\""]}, {"z": {"y": 1e-7, "x": 1e21, "w": -0.5}}]
    prepared = node("prepare", {"source": source, "requestId": request_id, "canonicalSamples": samples}, tmp_path)

    # JS-compatible serialisation used for every hash the site recomputes.
    from app.canonical import canonical, js_stringify
    assert [canonical(s) for s in samples] == prepared["canonical"]
    assert [js_stringify(s) for s in samples] == prepared["stringify"]

    quote, intent = prepared["quote"], prepared["intent"]
    payload = {"purpose": "source_analysis_only", "draftId": draft, "clientRunId": source["clientRunId"], "runId": source["runId"],
               "requestId": request_id, "sourceSha256": source["sourceSha256"], "roomSha256": source["roomSha256"],
               "referenceFingerprint": source["referenceFingerprint"], "quoteFingerprint": quote["fingerprint"],
               "intentFingerprint": intent["fingerprint"], "maxCostUsd": quote["maxCostUsd"], "budgetLimitUsd": 5,
               "instructions": "Keep the two units separate", "budgetOrigin": "https://claude-final-midas-a7.netlify.app"}
    files = [("product-" + str(uuid.uuid4()), PNG, "image/png")] + ([("room-" + str(uuid.uuid4()), ROOM_PNG, "image/png")] if room else [])
    h = harness()
    r = h.post(Job(payload, files))
    assert r.status_code == 200, r.text
    reserves = [req for a, _o, req in h.budget.calls if a == "reserve"]
    settles = [req for a, _o, req in h.budget.calls if a == "settle"]
    verified = node("verify", {"source": source, "intent": intent, "ownerId": h.budget.owner_id, "reserves": reserves,
                               "settles": settles, "response": r.json()}, tmp_path)
    assert all(q["ok"] for q in verified["quotes"]), verified["quotes"]
    assert [q["reserve"] for q in verified["quotes"]] == [h.budget.operations[x["operationKey"]]["reserved_micro_usd"] for x in reserves]
    assert sum(q["reserve"] for q in verified["quotes"]) == round(quote["totalMicroUsd"])
    assert verified["operationKeys"] == [x["operationKey"] for x in reserves]
    assert verified["observation"]["eyeCount"] == 2 and verified["observation"]["secondCount"] == 2
    assert verified["observation"]["category"] == "Sofa"
    if room:
        assert verified["roomObservation"]["sourceSha256"] == source["roomSha256"]
        assert verified["roomObservation"]["roomType"] == "Living room"
    else:
        assert verified["roomObservation"] is None
