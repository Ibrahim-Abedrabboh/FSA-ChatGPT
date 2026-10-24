"""Write every prompt the A7 service sends to a model into one document, verbatim, from the flow packages.

    python tools/extract_prompt_catalog.py [output.md]

Fixed texts are read from the node parameters, or, where they live inside a Code node, from the string literal
itself (evaluated by Node, so escapes come out exactly as sent). Prompts that are assembled per job are listed
with the node that builds them; real examples of those are in the run report of run 4f80c2bf.
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from midas_a7.engine.model import load_flow  # noqa: E402

FLOWS = {
    "a7_main": "Claude · Midas A7 (the job pipeline)",
    "analysis_only": "A7 · Source analysis only (the owner site's \"understand the source\" step)",
    "model_tests": "A7 · Model tests per stage (the owner page \"Testing models per stage\")",
}
RUN_REPORT = "claude-outputs/claude-midas-a7-run-reports/2026-10-20-run-4f80c2bf-prompts.md"

# Prompts assembled per job: (flow, model node) -> (builder node, field, where a real example is).
BUILT = {
    ("a7_main", "09 Conflict check"): ("08 Locks and freedoms", "conflict_ticket", "not called in run 4f80c2bf (no conflict to classify)"),
    ("a7_main", "11 Stylist plans the scenes"): ("11a Plan ticket", "plan_request", f"{RUN_REPORT}, section 1"),
    ("a7_main", "11c Plan critic"): ("11b Stylist check", "critic_request", f"{RUN_REPORT}, section 2"),
    ("a7_main", "15g Send to Google"): ("13 Compile (prompt) and 15f Build request (request body)", "body", f"{RUN_REPORT}, section 3"),
    ("a7_main", "16 Critic review"): ("16a Review ticket", "rv.critic_text", f"{RUN_REPORT}, section 4"),
    ("a7_main", "16x Blind count"): ("16a Review ticket", "rv.blind_text", f"{RUN_REPORT}, section 5"),
    ("a7_main", "16xb Blind count fallback (OpenAI)"): ("16a Review ticket", "rv.blind_text", "same text as 16x Blind count"),
    ("analysis_only", "09 Conflict check"): ("Prepare analysis conflict ticket", "conflict_ticket", "none recorded"),
}

# Model calls whose fixed prompt lives inside a Code node rather than in the node's parameters.
TEXT_IN_CODE = {("a7_main", "03b Eye fallback (OpenAI)"): "fixed, in code",
                ("model_tests", "A · Gemini 3.8 Flash · current prompt"): "fixed, in code (\"current\")",
                ("model_tests", "B · gpt-6.1-sol · enhanced prompt"): "fixed, in code (\"enhanced v3\")",
                ("model_tests", "C · Gemini 3.8 Flash · enhanced prompt"): "fixed, in code (\"enhanced v3\")",
                ("model_tests", "D · Gemini 3.5 Flash · enhanced prompt"): "fixed, in code (\"enhanced v3\")",
                ("model_tests", "E · Claude Opus 5.5 · enhanced prompt"): "fixed, in code (\"enhanced v3\")"}
WHITE_MASTER_SHA = "dc59e36de544aebff026163447bea435d0322b7e8f65d1ff55824daa9c1b949e"

# Fixed prompts that live inside Code nodes: (flow, code file, JS expression locating the literal, label).
IN_CODE = [
    ("a7_main", "Recovery_Fallback_request.js", "text", "03b Eye fallback (OpenAI gpt-6.1-sol): photo-reader prompt"),
    ("model_tests", "Build_model_test.js", "CUR", "Model tests: \"current\" Eye prompt (arm A)"),
    ("model_tests", "Build_model_test.js", "ENH", "Model tests: \"enhanced v3\" Eye prompt (arms B, C, D, E)"),
]

JS_LITERAL = r"""
const fs = require('fs');
const [file, name] = process.argv.slice(1);
const src = fs.readFileSync(file, 'utf8');
const re = name === 'text' ? /text:("(?:[^"\\]|\\.)*")/g : new RegExp('const ' + name + '=("(?:[^"\\\\]|\\\\.)*")', 'g');
const out = [];
let m;
// A double-quoted JS string literal is JSON once its \' escapes are plain quotes; parse it, never execute it.
while ((m = re.exec(src)) !== null) out.push(JSON.parse(m[1].replace(/\\'/g, "'")));
process.stdout.write(JSON.stringify(out));
"""


def literals(path: Path, name: str) -> list[str]:
    res = subprocess.run(["node", "-e", JS_LITERAL, str(path), name], capture_output=True, text=True, check=True)
    return json.loads(res.stdout)


def sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def block(text: str) -> str:
    fence = "````" if "```" in text else "```"
    return f"{fence}text\n{text}\n{fence}\n"


def model_of(node) -> str:
    m = node.parameters.get("modelId")
    return m.get("value") if isinstance(m, dict) else (m or "")


def fixed_fields(node) -> list[tuple[str, str]]:
    p, out = node.parameters, []
    if isinstance(p.get("text"), str):
        out.append(("prompt (sent with the image)" if p.get("resource") == "image" else "prompt", p["text"]))
    for v in (p.get("responses") or {}).get("values", []):
        out.append(("user message", v.get("content", "")))
    for v in (p.get("messages") or {}).get("values", []):
        out.append(("user message", v.get("content", "")))
    opts = p.get("options") or {}
    if isinstance(opts.get("instructions"), str):
        out.append(("instructions (system)", opts["instructions"]))
    if isinstance(opts.get("system"), str):
        out.append(("system", opts["system"]))
    return out


def image_model() -> str:
    rows = json.loads((ROOT / "src/midas_a7/data/seeds/eso9cF84jXYIGu5S.json").read_text())["rows"]
    approved = sorted((r for r in rows if r.get("status") == "approved"), key=lambda r: r.get("priority") or 99)
    return approved[0]["model_id"] if approved else "from the model registry"


def white_master_prompt() -> str:
    """The real white-master prompt of run 4f80c2bf, as stored in the run report (verified by its sha256)."""
    report = (ROOT / RUN_REPORT).read_text(encoding="utf-8")
    start = report.index("**Per-run message, the white master prompt**")
    m = re.search(r"\n(`{3,4})text\n(.*?)\n\1\n", report[start:], flags=re.DOTALL)
    text = m.group(2)
    if sha(text) != WHITE_MASTER_SHA:
        raise SystemExit("the white-master prompt in the run report no longer matches its recorded sha256")
    return text


def main() -> int:
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "claude-outputs" / "claude-midas-a7-prompts-catalogue-2026-10-20.md"
    lines: list[str] = []
    w = lines.append
    manifest = json.loads((ROOT / "src/midas_a7/flows/manifest.json").read_text())
    versions = {m["package"]: m["versionId"][:8] for m in manifest}
    w("# Midas A7: every prompt sent to a model\n")
    w("Generated by `tools/extract_prompt_catalog.py` from the flow packages the Python service runs "
      f"(A7 `{versions['a7_main']}`, source analysis `{versions['analysis_only']}`, model tests `{versions['model_tests']}`). "
      "Fixed texts are copied exactly, with their SHA-256; nothing is paraphrased. Texts that are assembled for each job "
      "are named with the node that builds them; real, word-for-word examples are in "
      f"`{RUN_REPORT}`.\n")
    rows: list[str] = []
    sections: list[str] = []
    for pkg, title in FLOWS.items():
        flow = load_flow(f"midas_a7.flows.{pkg}")
        sections.append(f"\n## {title}\n")
        for node in flow.nodes.values():
            calls_model = node.kind in ("openAi", "googleGemini", "anthropic")
            url = str(node.parameters.get("url", ""))
            if node.kind == "httpRequest" and any(h in url for h in ("api.openai.com/v1/responses", "googleapis.com/v1beta/interactions")) \
                    and "input_tokens" not in url and not url.lstrip("=").strip().startswith("https://generativelanguage.googleapis.com/v1beta/interactions/"):
                calls_model = True
            if not calls_model or node.name.startswith("Blind ·"):
                continue
            provider = {"openAi": "OpenAI", "googleGemini": "Google Gemini", "anthropic": "Anthropic"}.get(node.kind, "HTTP")
            model = model_of(node) or (f"{image_model()} (from the model registry)" if "googleapis" in url else "gpt-6.1-sol")
            image = "yes" if node.parameters.get("resource") == "image" or "googleapis" in url or "Eye fallback" in node.name or "· " in node.name else "no"
            sections.append(f"\n### {node.name}\n")
            sections.append(f"- Provider and model: {provider}, `{model}`\n- Images attached: {image}\n")
            built = BUILT.get((pkg, node.name))
            fixed = [(k, v) for k, v in fixed_fields(node) if not (isinstance(v, str) and v.startswith("="))]
            dynamic = [(k, v) for k, v in fixed_fields(node) if isinstance(v, str) and v.startswith("=")]
            for k, v in dynamic:
                src = f"built per job by `{built[0]}` (field `{built[1]}`)" if built else "built per job"
                sections.append(f"- {k[0].upper() + k[1:]}: {src}. Expression `{v}`.\n")
                if built:
                    sections.append(f"- Real example: {built[2]}.\n")
            if node.kind == "httpRequest":
                if built:
                    sections.append(f"- Request body: built per job by `{built[0]}`. Real example: {built[2]}.\n")
                else:
                    sections.append("- Request body: built in code; the fixed prompt it carries is listed under \"Fixed prompts inside code\" below.\n")
            for k, v in fixed:
                sections.append(f"\n**{k[0].upper() + k[1:]}** ({len(v)} characters, sha256 `{sha(v)}`):\n\n")
                sections.append(block(v))
            kind = TEXT_IN_CODE.get((pkg, node.name)) or (
                "fixed" if fixed and not dynamic and node.kind != "httpRequest" else "fixed + per job" if fixed else "per job")
            rows.append(f"| {title.split(' (')[0]} | {node.name} | {provider} `{model}` | {kind} |")
    w("## Summary\n")
    w("| Flow | Model call | Provider and model | Text |\n|---|---|---|---|")
    lines.extend(rows)
    w("")
    w("The two one-off recovery paths (`Blind · …`, `Package · …`) are not served by the Python service and are left out.\n")
    lines.extend(sections)
    w("\n## Image generation: the real white-master prompt of run 4f80c2bf\n")
    w("`13 Compile` writes one prompt per output from the contract, the approved plan and the shot, and `15f Build request` "
      "sends it to Google with the vendor photo (text first, then the image; 1:1, 2K). A white master gets one call; each "
      "scene gets an empty-room call and then a placement call, each with its own compiled prompt. This is the prompt the "
      "first end-to-end run sent for its white master, word for word (stored in the vault and the operations table; "
      f"sha256 `{WHITE_MASTER_SHA}`):\n")
    w(block(white_master_prompt()))
    w("\n## Fixed prompts inside code\n")
    for pkg, file, name, label in IN_CODE:
        path = ROOT / "src/midas_a7/flows" / pkg / "code" / file
        texts = [t for t in literals(path, name) if len(t) > 200]
        for t in texts[:1]:
            w(f"\n### {label}\n\nFrom `src/midas_a7/flows/{pkg}/code/{file}` ({len(t)} characters, sha256 `{sha(t)}`):\n")
            w(block(t))
    # Which flows share the same Eye prompt (by checksum).
    eye = {}
    for pkg, title in FLOWS.items():
        for node in load_flow(f"midas_a7.flows.{pkg}").nodes.values():
            if node.name.startswith("03 Eye") and isinstance(node.parameters.get("text"), str):
                eye.setdefault(sha(node.parameters["text"]), []).append(f"{title.split(' (')[0]} · {node.name}")
    for pkg, file, name, label in IN_CODE:
        for t in [t for t in literals(ROOT / "src/midas_a7/flows" / pkg / "code" / file, name) if len(t) > 200][:1]:
            eye.setdefault(sha(t), []).append(label.split(":")[0])
    note = ["\n## Which Eye prompt runs where\n", "| Text (sha256, first 12) | Characters | Used by |", "|---|---|---|"]
    lengths = {}
    for pkg in FLOWS:
        for node in load_flow(f"midas_a7.flows.{pkg}").nodes.values():
            if isinstance(node.parameters.get("text"), str):
                lengths[sha(node.parameters["text"])] = len(node.parameters["text"])
    for h, users in eye.items():
        note.append(f"| `{h[:12]}` | {lengths.get(h, '—')} | {'; '.join(users)} |")
    at = lines.index("## Summary\n")
    lines[at:at] = note + [""]
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {target.relative_to(ROOT)} ({target.stat().st_size} bytes, {len(rows)} model calls)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
