"""Prompts are verbatim copies of the live record, and each reader's n8n parameter
object (hashed into requestSha256) matches the pinned n8n node snapshot."""

from __future__ import annotations

import json
import pathlib
import sys

import pytest

from app.readers import CONFLICT_09, EYE_03, READERS, ROOM_06, SECOND_COUNT_05

ENGINE = pathlib.Path(__file__).resolve().parents[1]
WORKSPACE = ENGINE.parents[1] / "claude-outputs" / "claude-midas-a7-owner-workspace"
LIVE = WORKSPACE / "analysis-reader-prompts-live.md"
SNAPSHOT = WORKSPACE / "a7-analysis-node-snapshot.json"

sys.path.insert(0, str(ENGINE / "tools"))
from extract_prompts import FILES, extract  # noqa: E402


@pytest.mark.skipif(not LIVE.exists(), reason="owner workspace not available")
def test_prompt_files_are_verbatim_copies_of_the_live_record():
    live = extract(LIVE.read_text(encoding="utf-8"))
    for node, name in FILES.items():
        assert (ENGINE / "app" / "prompts" / name).read_text(encoding="utf-8") == live[node], node
    assert EYE_03.n8n_parameters["text"] == live[EYE_03.node]
    assert SECOND_COUNT_05.n8n_parameters["text"] == live[SECOND_COUNT_05.node]
    assert ROOM_06.n8n_parameters["text"] == live[ROOM_06.node]
    assert CONFLICT_09.n8n_parameters["options"]["instructions"] == live[CONFLICT_09.node]


@pytest.mark.skipif(not SNAPSHOT.exists(), reason="owner workspace not available")
def test_parameters_match_the_pinned_n8n_nodes():
    nodes = {n["name"]: n for n in json.loads(SNAPSHOT.read_text(encoding="utf-8"))["nodes"]}
    for reader in (SECOND_COUNT_05, ROOM_06):
        assert reader.n8n_parameters == nodes[reader.node]["parameters"], reader.node
    nine = json.loads(json.dumps(nodes[CONFLICT_09.node]["parameters"]).replace("$('08 Locks and freedoms').first().json", "$('Prepare analysis conflict ticket').first().json"))
    assert CONFLICT_09.n8n_parameters == nine
    # 03 uses the newer live prompt (v3); everything else is the pinned node.
    eye = dict(nodes[EYE_03.node]["parameters"])
    assert {k: v for k, v in EYE_03.n8n_parameters.items() if k != "text"} == {k: v for k, v in eye.items() if k != "text"}
    assert EYE_03.n8n_parameters["text"] != eye["text"]


@pytest.mark.skipif(not SNAPSHOT.exists(), reason="owner workspace not available")
def test_budget_tickets_match_the_pinned_n8n_tickets():
    nodes = {n["name"]: n for n in json.loads(SNAPSHOT.read_text(encoding="utf-8"))["nodes"]}
    for reader in READERS:
        code = nodes[f"Budget · {reader.stage} · Ticket"]["parameters"]["jsCode"]
        assert f'node:"{reader.node}",model:"{reader.budget_model}"' in code
        assert f"inputTokens:{reader.input_tokens},outputTokens:{reader.output_tokens}" in code
        assert f'providerUsage(it.json,"{reader.kind}")' in nodes[f"Budget · {reader.stage} · Receipt"]["parameters"]["jsCode"]
