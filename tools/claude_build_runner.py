"""One-time builder for the hand-maintained Midas A7 runner.

This tool reads the frozen service and flow packages. Once the generated runner
passes parity and cutover, edit runner.py directly and retire this builder.
"""

from __future__ import annotations

import ast
import hashlib
import importlib.util
import io
import json
import pprint
import tokenize
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "src" / "midas_a7"
INVENTORY = ROOT / "claude-midas-a7-runner-inventory-2026-10-23.json"
OUT = ROOT / "claude-runner" / "runner.py"
MODULES = (
    "config", "store", "engine.model", "engine.binary", "engine.services",
    "engine.jsrunner", "engine.executor", "nodes.core", "nodes.http_request",
    "nodes.data_table", "nodes.google_drive", "nodes.edit_image", "nodes.llm",
    "nodes.claude_reference_resize", "nodes", "runtime", "app", "cli",
)
PACKAGES = (
    "a7_main", "owner_bridge", "owner_read", "owner_analysis",
    "analysis_only", "model_tests", "catalogue_refresh",
)


def sha(text: str | bytes) -> str:
    return hashlib.sha256(text.encode("utf-8") if isinstance(text, str) else text).hexdigest()


def literal(text: str) -> str:
    if "'''" not in text and not text.endswith("\\"):
        return "r'''" + text + "'''"
    return repr(text)


def target_names(target: ast.expr) -> set[str]:
    if isinstance(target, ast.Name):
        return {target.id}
    if isinstance(target, (ast.Tuple, ast.List)):
        return set().union(*(target_names(x) for x in target.elts))
    return set()


def module_prefix(name: str) -> str:
    return name.replace(".", "_")


def module_symbols(module: str, tree: ast.Module) -> set[str]:
    names: set[str] = set()
    for node in tree.body:
        if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            names.add(node.name)
        elif isinstance(node, ast.Assign):
            for target in node.targets:
                names |= target_names(target)
        elif isinstance(node, ast.AnnAssign):
            names |= target_names(node.target)
    return names


def import_target(current: str, node: ast.ImportFrom) -> str:
    if node.level == 0:
        return node.module or ""
    package = ("midas_a7." + current).split(".")
    if current != "nodes":
        package = package[:-1]
    return ".".join(package[: len(package) - node.level + 1] + ([node.module] if node.module else []))


def rename_source(source: str, rename: dict[str, str], removals: list[tuple[int, int]],
                  keyword_positions: set[tuple[int, int]]) -> str:
    lines = source.splitlines(keepends=True)
    for first, last in removals:
        for number in range(first - 1, last):
            lines[number] = "\n" if lines[number].endswith("\n") else ""
    tokens = list(tokenize.generate_tokens(io.StringIO("".join(lines)).readline))
    result: list[tokenize.TokenInfo] = []
    previous: tokenize.TokenInfo | None = None
    for token in tokens:
        if (token.type == tokenize.NAME and token.string in rename
                and token.start not in keyword_positions
                and (previous is None or previous.string != ".")):
            token = token._replace(string=rename[token.string])
        result.append(token)
        if token.type not in (tokenize.NL, tokenize.NEWLINE, tokenize.INDENT, tokenize.DEDENT, tokenize.COMMENT):
            previous = token
    return tokenize.untokenize(result)


def flatten() -> str:
    parsed = {name: ast.parse((PACKAGE / (name.replace(".", "/") + ("/__init__.py" if name == "nodes" else ".py"))).read_text()) for name in MODULES}
    symbols = {name: module_symbols(name, tree) for name, tree in parsed.items()}
    sections: list[str] = []
    imports: list[str] = []
    for name in MODULES:
        path = PACKAGE / (name.replace(".", "/") + ("/__init__.py" if name == "nodes" else ".py"))
        source = path.read_text(encoding="utf-8")
        tree = parsed[name]
        prefix = module_prefix(name)
        rename = {symbol: f"{prefix}__{symbol}" for symbol in symbols[name]}
        removals: list[tuple[int, int]] = []
        if name == "cli":
            removals += [(node.lineno, node.end_lineno or node.lineno) for node in tree.body
                         if isinstance(node, ast.If) and isinstance(node.test, ast.Compare)
                         and isinstance(node.test.left, ast.Name) and node.test.left.id == "__name__"]
        for node in ast.walk(tree):
            if not isinstance(node, (ast.Import, ast.ImportFrom)):
                continue
            removals.append((node.lineno, node.end_lineno or node.lineno))
            if isinstance(node, ast.ImportFrom):
                if node.module == "__future__":
                    continue
                target = import_target(name, node)
                if target.startswith("midas_a7.") or target == "midas_a7":
                    target_name = target.removeprefix("midas_a7.")
                    for alias in node.names:
                        rename[alias.asname or alias.name] = f"{module_prefix(target_name)}__{alias.name}"
                else:
                    for alias in node.names:
                        bound = alias.asname or alias.name
                        replacement = f"{prefix}__{bound}"
                        rename[bound] = replacement
                        imports.append(f"from {target} import {alias.name} as {replacement}")
            else:
                for alias in node.names:
                    bound = alias.asname or alias.name.split(".")[0]
                    replacement = f"{prefix}__{bound}"
                    rename[bound] = replacement
                    imports.append(f"import {alias.name} as {replacement}")
        keyword_positions = {(node.lineno, node.col_offset) for node in ast.walk(tree)
                             if isinstance(node, ast.keyword) and node.arg is not None}
        transformed = rename_source(source, rename, removals, keyword_positions)
        if name == "engine.executor":
            for old, new in {
                '"NodeContext"': '"engine_executor__NodeContext"',
                '"NodeOutput | WaitRequest"': '"engine_executor__NodeOutput | engine_executor__WaitRequest"',
                '"Execution"': '"engine_executor__Execution"',
                '"Params"': '"engine_executor__Params"',
            }.items():
                transformed = transformed.replace(old, new)
        # The source's package loader and dynamic handler discovery are replaced
        # with direct references to embedded constants further below.
        sections.append(f"\n# --- {path.relative_to(ROOT)} ---\n" + transformed)
    return "\n".join(dict.fromkeys(imports)) + "\n" + "\n".join(sections)


def main() -> None:
    inventory = json.loads(INVENTORY.read_text(encoding="utf-8"))
    for path, entry in inventory["repo_files"].items():
        actual = sha((ROOT / path).read_bytes())
        if actual != entry["sha256"]:
            raise SystemExit(f"inventory mismatch: {path}")
    flow_defs: dict[str, dict] = {}
    code: dict[str, dict[str, str]] = {}
    code_files: dict[str, dict[str, str]] = {}
    baselines: dict[str, dict] = {}
    for package in PACKAGES:
        folder = PACKAGE / "flows" / package
        tree = ast.parse((folder / "__init__.py").read_text(encoding="utf-8"))
        assignment = next(n for n in tree.body if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "FLOW" for t in n.targets))
        definition = ast.literal_eval(assignment.value)
        code[package] = {}
        code_files[package] = {}
        for node in definition["nodes"]:
            filename = node.get("parameters", {}).pop("jsCodeFile", None)
            if filename:
                text = (folder / "code" / filename).read_text(encoding="utf-8")
                node["parameters"]["jsCode"] = text
                code[package][node["name"]] = text
                code_files[package][node["name"]] = filename
        flow_defs[package] = definition
        baseline_path = ROOT / "n8n" / "baseline" / f"{definition['id']}.json"
        baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
        baseline.pop("pinData", None)
        baselines[package] = baseline
    patch_spec = importlib.util.spec_from_file_location("claude_legacy_flow_patches", ROOT / "tools" / "n8n_to_flow.py")
    assert patch_spec and patch_spec.loader
    patch_module = importlib.util.module_from_spec(patch_spec)
    patch_spec.loader.exec_module(patch_module)
    patch_ledger: list[dict] = []
    current: dict[tuple[str, str], str] = {}
    for package, baseline in baselines.items():
        original_by_name = {node["name"]: node for node in baseline["nodes"]}
        for node, filename in code_files[package].items():
            current[(package, filename)] = original_by_name[node]["parameters"]["jsCode"]
    for package, filename, old, new, reason in patch_module.PATCHES:
        before = current[(package, filename)]
        if before.count(old) != 1:
            raise SystemExit(f"patch source mismatch: {package}/{filename}")
        after = before.replace(old, new)
        patch_ledger.append({"package": package, "file": filename, "reason": reason,
                             "originalSha256": sha(before), "patchedSha256": sha(after),
                             "originalText": before, "patchedText": after})
        current[(package, filename)] = after
    for package, node_name, path, value, reason in patch_module.NODE_PATCHES:
        original_node = next(node for node in baselines[package]["nodes"] if node["name"] == node_name)
        parts = path.split(".")
        original_value = original_node.get("parameters", {})
        for part in parts:
            original_value = original_value.get(part) if isinstance(original_value, dict) else None
        before = json.dumps(original_value, ensure_ascii=False, sort_keys=True)
        after = json.dumps(value, ensure_ascii=False, sort_keys=True)
        patch_ledger.append({"package": package, "node": node_name, "parameter": path,
                             "reason": reason, "originalSha256": sha(before), "patchedSha256": sha(after),
                             "originalText": before, "patchedText": after})
    for package, key, value, reason in patch_module.SETTINGS_PATCHES:
        before = json.dumps(baselines[package].get("settings", {}).get(key), ensure_ascii=False, sort_keys=True)
        after = json.dumps(value, ensure_ascii=False, sort_keys=True)
        patch_ledger.append({"package": package, "setting": key,
                             "reason": reason, "originalSha256": sha(before), "patchedSha256": sha(after),
                             "originalText": before, "patchedText": after})
    if len(patch_ledger) != 62:
        raise SystemExit(f"expected 62 inherited patches, found {len(patch_ledger)}")
    for package, filenames in code_files.items():
        for node, filename in filenames.items():
            if current[(package, filename)] != code[package][node]:
                raise SystemExit(f"patched Code mismatch: {package}/{node}")
    data_root = PACKAGE / "data"
    schemas = (data_root / "data-tables.json").read_text(encoding="utf-8")
    seeds = {p.stem: p.read_text(encoding="utf-8") for p in (data_root / "seeds").glob("*.json")}
    js_root = PACKAGE / "engine" / "js"
    js = {p.name: p.read_text(encoding="utf-8") for p in js_root.iterdir() if p.name in {"runner.mjs", "package.json", "package-lock.json"}}
    project_rules = (ROOT / "CLAUDE.md").read_text(encoding="utf-8")
    prelude = [
        '"""Midas A7 single-file runner, built from the frozen seven workflows and Python service.\n\n'
        'This file is the proposed hand-maintained A7 source after cutover. Phase 1 makes no live changes.\n"""',
        "# ruff: noqa: E402",
        "from __future__ import annotations",
        "import hashlib as _runner_hashlib",
        "import json as _runner_json",
        "from pathlib import Path as _RunnerPath",
        f"PROJECT_RULES = {literal(project_rules)}",
        f"RUNNER_MANIFEST = {pprint.pformat(inventory, width=110, sort_dicts=False)}",
        f"SOURCE_MANIFEST = {pprint.pformat(json.loads((PACKAGE / 'flows' / 'manifest.json').read_text()), width=110, sort_dicts=False)}",
        f"BASELINES = {pprint.pformat(baselines, width=110, sort_dicts=False)}",
        f"EXPECTED_FLOW_SHA256 = {pprint.pformat({name: sha(json.dumps(flow, sort_keys=True, ensure_ascii=False, separators=(',', ':'))) for name, flow in flow_defs.items()}, width=110)}",
        f"PATCH_LEDGER = {pprint.pformat(patch_ledger, width=110, sort_dicts=False)}",
        f"FLOWS = {pprint.pformat(flow_defs, width=110, sort_dicts=False)}",
        f"CODE_FILES = {pprint.pformat(code_files, width=110, sort_dicts=False)}",
        "CODE = {}",
    ]
    for package, nodes in code.items():
        prelude.append(f"CODE[{package!r}] = {{}}")
        for name, text in nodes.items():
            prelude.append(f"CODE[{package!r}][{name!r}] = {literal(text)}")
    prelude += [
        f"DATA_TABLES_JSON = {literal(schemas)}",
        "DATA_SEEDS = {}",
    ]
    for name, text in seeds.items():
        prelude.append(f"DATA_SEEDS[{name!r}] = {literal(text)}")
    prelude.append("JS_RUNTIME = {}")
    for name, text in js.items():
        prelude.append(f"JS_RUNTIME[{name!r}] = {literal(text)}")
    prelude.append("REFERENCE_TEXT = {}")
    for path in inventory["repo_files"]:
        if ("model-prompts/" in path or "stylist-skill/" in path
                or path.endswith("guidance-baseline.json")):
            prelude.append(f"REFERENCE_TEXT[{path!r}] = {literal((ROOT / path).read_text(encoding='utf-8'))}")
    runtime = (ROOT / "tools" / "claude_runner_runtime.py").read_text(encoding="utf-8")
    flattened = flatten()
    # The original package assumes a three-level source tree. The standalone
    # file can live at any depth, including /app/runner.py in the image.
    flattened = flattened.replace(
        "config__Path(__file__).resolve().parents[2]",
        "config__Path(__file__).resolve().parent",
    )
    result = "\n\n".join(prelude) + "\n\n" + flattened + "\n\n" + runtime
    compile(result, str(OUT), "exec")
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(result, encoding="utf-8")
    print(f"built {OUT} ({len(result):,} characters)")


if __name__ == "__main__":
    main()
