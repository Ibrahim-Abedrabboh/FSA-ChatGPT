# --- Runner-specific wiring. Appended once by the one-time builder. ---
# This section is ordinary editable Python in runner.py after the build.

import argparse as _runner_argparse
import os as _runner_os
import re as _runner_re
import subprocess as _runner_subprocess
import sys as _runner_sys
from urllib.parse import urlsplit as _runner_urlsplit
from sqlalchemy import create_engine as _runner_create_engine, inspect as _runner_inspect, text as _runner_text

STICKY_NOTES = RUNNER_MANIFEST["a7_main_uploaded"]["stickyNotes"]
PENDING_PROMPTS = {name: text for name, text in REFERENCE_TEXT.items() if "/pending/" in name}
STYLIST_REFERENCE = {name: text for name, text in REFERENCE_TEXT.items() if "stylist-skill/" in name}
PROMPT_CATALOG = {
    "a7_main": RUNNER_MANIFEST["a7_main_uploaded"]["modelCalls"],
    **{name: details.get("modelCalls", []) for name, details in RUNNER_MANIFEST["other_flows"].items()},
}
HTTP_MODEL_CALLS = {
    "a7_main": (
        ("03b Eye fallback (OpenAI)", "Recovery · Fallback request", "OpenAI Responses", "fixed prompt in builder"),
        ("15g Send to Google", "15f Build request", "Google image", "body compiled at 13 Compile"),
        ("15k Ask Google", "15f Build request", "Google image", "status poll for the same request"),
        ("Blind · OpenAI once", "Blind · Build request", "OpenAI Responses", "per-job blind prompt"),
    ),
    "model_tests": (
        ("B · gpt-6.1-sol · enhanced prompt", "Build model test", "OpenAI Responses", "test-arm prompt"),
    ),
}
for _package, _calls in HTTP_MODEL_CALLS.items():
    for _node, _builder, _provider, _note in _calls:
        PROMPT_CATALOG[_package].append({
            "node": _node, "type": "n8n-nodes-base.httpRequest", "provider": _provider,
            "model": "from request body", "options": "from request body", "fields": [],
            "builderNode": _builder, "builderField": "jsCode", "note": _note,
            "builderSha256": _runner_hashlib.sha256(CODE[_package][_builder].encode("utf-8")).hexdigest(),
        })
EXPORT_DEFAULT_NODES = {
    "Recovery · Parse route", "Receipt · Restore accepted input", "Recovery · Continue preserved reader?",
    "Recovery · Preserved reader ready", "Recovery · Saved answer available?",
    "Recovery · Use saved reader result", "Blind · Settings recovery?", "Blind · Saved answer?",
    "Package · Read run", "Package · Read vault", "Package · Settings recovery?",
    "Source continuation requested?", "Check source continuation", "Source proof accepted?",
    "Confirmed source evidence", "Hold unverified source continuation",
}


def runner_prepare_js(link_modules: bool = False) -> _RunnerPath:
    """Materialize only Node's runtime files, with content checked on each use."""
    contents = "".join(JS_RUNTIME[name] for name in sorted(JS_RUNTIME))
    digest = _runner_hashlib.sha256(contents.encode("utf-8")).hexdigest()
    root = _RunnerPath(_runner_os.environ.get(
        "MIDAS_RUNNER_HOME", str(_RunnerPath.home() / ".cache" / "midas-a7-runner" / digest)))
    root.mkdir(parents=True, exist_ok=True)
    for name, text in JS_RUNTIME.items():
        path = root / name
        if path.exists():
            if _runner_hashlib.sha256(path.read_bytes()).hexdigest() != _runner_hashlib.sha256(text.encode()).hexdigest():
                raise RuntimeError(f"JS runtime cache mismatch: {name}")
        else:
            path.write_text(text, encoding="utf-8")
    modules = _runner_os.environ.get("MIDAS_JS_NODE_MODULES")
    if link_modules and modules and not (root / "node_modules").exists():
        (root / "node_modules").symlink_to(_RunnerPath(modules).resolve(), target_is_directory=True)
    return root / "runner.mjs"


def runner_setup() -> None:
    path = runner_prepare_js(link_modules=True)
    if not (path.parent / "node_modules").exists():
        _runner_subprocess.run(["npm", "ci", "--omit=dev"], cwd=path.parent, check=True)


config__PACKAGE_DIR = _RunnerPath("__embedded__")
config__REPO_ROOT = _RunnerPath(__file__).resolve().parent.parent
engine_jsrunner__RUNNER = runner_prepare_js()


_runner_original_route = engine_services__Services.route


def _runner_route(self: engine_services__Services, url: str):
    """Never let a request for the former n8n host leave this process."""
    client, routed = _runner_original_route(self, url)
    if _runner_urlsplit(url).hostname == "ibrahimnewaeon.app.n8n.cloud" and client is self.http:
        raise engine_executor__NodeError("Former n8n host cannot be called externally")
    return client, routed


engine_services__Services.route = _runner_route
app__RETIRED_WEBHOOKS = (set() if _runner_os.environ.get("RECOVERY_WEBHOOKS_ENABLED", "false").lower() == "true"
                         else {("POST", "a7/approved-blind-recovery"),
                               ("POST", "a7/approved-package-recovery")})


def engine_model__load_flow(module_name: str) -> engine_model__Flow:  # noqa: F811
    """Load one of the seven flow definitions embedded in this file."""
    package = module_name.rsplit(".", 1)[-1]
    if package not in FLOWS:
        raise ModuleNotFoundError(module_name)
    return engine_model__flow_from_definition(FLOWS[package])


def nodes__all_handlers() -> dict[str, engine_executor__Handler]:  # noqa: F811
    handlers: dict[str, engine_executor__Handler] = {}
    for group in (nodes_core__HANDLERS, nodes_http_request__HANDLERS,
                  nodes_data_table__HANDLERS, nodes_google_drive__HANDLERS,
                  nodes_edit_image__HANDLERS, nodes_llm__HANDLERS):
        handlers.update(group)
    return handlers


def store__load_schemas(path: _RunnerPath) -> dict[str, dict]:  # noqa: F811
    """Use an explicit schema file when supplied; otherwise use embedded data."""
    text = path.read_text(encoding="utf-8") if path.is_file() else DATA_TABLES_JSON
    raw = _runner_json.loads(text)
    return {table["id"]: table for table in raw["tables"]}


def nodes_data_table__seed_reference_tables_sync(store: store__Store, schemas: dict[str, dict],  # noqa: F811
                                                  seeds_dir: _RunnerPath,
                                                  table_ids: tuple[str, ...] = nodes_data_table__SEEDED_TABLES) -> dict[str, int]:
    """Seed the same frozen rows, allowing a caller's explicit seed override."""
    loaded: dict[str, int] = {}
    for table_id in table_ids:
        schema = schemas.get(table_id)
        path = seeds_dir / f"{table_id}.json"
        text = path.read_text(encoding="utf-8") if path.is_file() else DATA_SEEDS.get(table_id)
        if schema is None or text is None:
            loaded[table_id] = 0
            continue
        rows = _runner_json.loads(text).get("rows", [])
        loaded[table_id] = store.dt_seed(table_id, rows, [column["name"] for column in schema["columns"]])
    return loaded


def runner_verify() -> int:
    """Check embedded source identities without network or paid calls."""
    failures: list[str] = []
    print("verify: seven flow definitions")
    if set(FLOWS) != set(CODE) or len(FLOWS) != 7:
        failures.append("flow set")
    def canonical(value):
        return _runner_json.dumps(value, sort_keys=True, ensure_ascii=False,
                                  separators=(",", ":")).encode("utf-8")
    print("verify: original node parameters and connections")
    for package, flow in FLOWS.items():
        digest = _runner_hashlib.sha256(canonical(flow)).hexdigest()
        if digest != EXPECTED_FLOW_SHA256.get(package):
            failures.append(f"{package}: executable flow definition")
    for package, baseline in BASELINES.items():
        inventory = (RUNNER_MANIFEST["a7_main_uploaded"] if package == "a7_main"
                     else RUNNER_MANIFEST["other_flows"][package])
        if len(baseline["nodes"]) != inventory["nodeCount"]:
            failures.append(f"{package}: node count")
        if _runner_hashlib.sha256(canonical(baseline["connections"])).hexdigest() != inventory["connectionsSha256"]:
            failures.append(f"{package}: connections")
        listed = {node["name"]: node for node in inventory["nodes"]}
        for node in baseline["nodes"]:
            if node["name"] not in listed:
                failures.append(f"{package}: {node['name']} missing inventory")
                continue
            digest = _runner_hashlib.sha256(canonical(node.get("parameters", {}))).hexdigest()
            if digest != listed[node["name"]]["paramsSha256"]:
                # The owner's main export writes 16 n8n defaults that the frozen
                # baseline leaves implicit. Their Code and model text are checked below.
                if package != "a7_main" or node["name"] not in EXPORT_DEFAULT_NODES:
                    failures.append(f"{package}: {node['name']} parameters")
    print("verify: fixed model-call prompts")
    for package, calls in PROMPT_CATALOG.items():
        by_name = {node["name"]: node for node in FLOWS[package]["nodes"]}
        for call in calls:
            node = by_name.get(call["node"])
            if node is None:
                failures.append(f"{package}: {call['node']} model node")
                continue
            for field in call.get("fields", []):
                value = node.get("parameters", {})
                for part in _runner_re.findall(r"[^.\[\]]+", field["path"]):
                    if isinstance(value, dict):
                        value = value.get(part)
                    elif isinstance(value, list) and part.isdigit():
                        value = value[int(part)] if int(part) < len(value) else None
                    else:
                        value = None
                if value != field.get("text"):
                    failures.append(f"{package}: {call['node']} {field['path']} prompt")
            builder = call.get("builderNode")
            if builder:
                code_text = CODE[package].get(builder)
                if code_text is None or _runner_hashlib.sha256(code_text.encode("utf-8")).hexdigest() != call["builderSha256"]:
                    failures.append(f"{package}: {builder} model request builder")
    print("verify: historical sticky notes")
    notes = {node["name"]: node for node in BASELINES["a7_main"]["nodes"]
             if node["type"].endswith(".stickyNote")}
    for note in STICKY_NOTES:
        actual = notes.get(note["name"], {}).get("parameters", {}).get("content")
        if actual != note["text"]:
            failures.append(f"sticky note: {note['name']}")
    print("verify: Code-node JavaScript")
    print("verify: inherited patch ledger")
    for index, patch in enumerate(PATCH_LEDGER):
        for side in ("original", "patched"):
            digest = _runner_hashlib.sha256(patch[side + "Text"].encode("utf-8")).hexdigest()
            if digest != patch[side + "Sha256"]:
                failures.append(f"patch {index}: {side} hash")
        if (index and patch.get("file") and PATCH_LEDGER[index - 1]["package"] == patch["package"]
                and PATCH_LEDGER[index - 1].get("file") == patch["file"]):
            if PATCH_LEDGER[index - 1]["patchedText"] != patch["originalText"]:
                failures.append(f"patch {index}: chain")
    for manifest in SOURCE_MANIFEST:
        package = manifest["package"]
        expected = dict(manifest["codeSha256"])
        filenames = CODE_FILES[package]
        for patch in manifest.get("patches", []):
            for node, filename in filenames.items():
                if filename == patch["file"]:
                    expected[node] = patch["patchedSha256"]
        for node, digest in expected.items():
            actual = _runner_hashlib.sha256(CODE[package][node].encode("utf-8")).hexdigest()
            if actual != digest:
                failures.append(f"{package}: {node}")
        if set(expected) != set(CODE[package]):
            failures.append(f"{package}: Code node set")
    print("verify: embedded flow code matches Code mapping")
    for package, flow in FLOWS.items():
        for node in flow["nodes"]:
            js = node.get("parameters", {}).get("jsCode")
            if js is not None and js != CODE[package].get(node["name"]):
                failures.append(f"{package}: {node['name']} flow/code mismatch")
    print("verify: project rules and reference files")
    if _runner_hashlib.sha256(PROJECT_RULES.encode()).hexdigest() != RUNNER_MANIFEST["repo_files"]["CLAUDE.md"]["sha256"]:
        failures.append("PROJECT_RULES")
    for path, text in REFERENCE_TEXT.items():
        expected = RUNNER_MANIFEST["repo_files"][path]["sha256"]
        if _runner_hashlib.sha256(text.encode()).hexdigest() != expected:
            failures.append(path)
    print("verify: no pinned request data")
    if any("pinData" in _runner_json.dumps(flow) for flow in FLOWS.values()):
        failures.append("pinData")
    print("verify: no embedded credential values")
    secret_pattern = _runner_re.compile(r"\b(?:sk-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{30,}|Bearer [A-Za-z0-9._~+/-]{20,})\b")
    for label, content in (("flows", FLOWS), ("baselines", BASELINES), ("code", CODE), ("seeds", DATA_SEEDS)):
        if secret_pattern.search(_runner_json.dumps(content, ensure_ascii=False)):
            failures.append(f"embedded credential value: {label}")
    print("verify: node handlers")
    if cli___check() != 0:
        failures.append("node handlers")
    for failure in failures:
        print(f"FAIL: {failure}")
    if failures:
        return 1
    print("verify: passed")
    return 0


def runner_extract_code(directory: _RunnerPath) -> None:
    for package, nodes in CODE.items():
        target = directory / package
        target.mkdir(parents=True, exist_ok=True)
        for node, text in nodes.items():
            (target / CODE_FILES[package][node]).write_text(text, encoding="utf-8")


def runner_prompts() -> str:
    lines = ["# Midas A7 model-call catalog", ""]
    for package, calls in PROMPT_CATALOG.items():
        for call in calls:
            lines += [f"## {package}: {call['node']}", "", f"Model: `{call.get('model', '')}`", ""]
            for field in call.get("fields", []):
                lines += [f"Field `{field['path']}` · SHA-256 `{field['sha256']}`", "", field.get("text", ""), ""]
    return "\n".join(lines)


def runner_main(argv: list[str] | None = None) -> int:
    parser = _runner_argparse.ArgumentParser(prog="runner.py")
    commands = parser.add_subparsers(dest="command", required=True)
    for command in ("serve", "check", "seed", "verify", "setup", "migrate-check"):
        commands.add_parser(command)
    commands.add_parser("run").add_argument("flow")
    commands.add_parser("extract-code").add_argument("directory")
    commands.add_parser("prompts").add_argument("--out")
    args = parser.parse_args(argv)
    if args.command in {"serve", "check", "seed", "run"}:
        old = [args.command] + ([args.flow] if args.command == "run" else [])
        return cli__main(old)
    if args.command == "verify":
        return runner_verify()
    if args.command == "setup":
        runner_setup()
        return 0
    if args.command == "extract-code":
        runner_extract_code(_RunnerPath(args.directory))
        return 0
    if args.command == "prompts":
        output = runner_prompts()
        if args.out:
            _RunnerPath(args.out).write_text(output, encoding="utf-8")
        else:
            print(output)
        return 0
    if args.command == "migrate-check":
        url = _runner_os.environ.get("DATABASE_URL")
        if not url:
            raise SystemExit("migrate-check requires DATABASE_URL")
        if url.startswith("postgres://"):
            url = "postgresql+psycopg://" + url[len("postgres://"):]
        elif url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url[len("postgresql://"):]
        engine = _runner_create_engine(url)
        try:
            tables = set(_runner_inspect(engine).get_table_names())
            required = {"executions", "binaries", "files", "dt_rows"}
            if missing := required - tables:
                raise SystemExit("migrate-check missing tables: " + ", ".join(sorted(missing)))
            with engine.connect() as connection:
                connection.execute(_runner_text("SELECT id, state FROM executions WHERE status = 'waiting' LIMIT 1")).all()
                connection.execute(_runner_text("SELECT table_id FROM dt_rows LIMIT 1")).all()
            print("migrate-check: required tables and parked state are readable")
        finally:
            engine.dispose()
        return 0
    return 2


if __name__ == "__main__":
    _runner_sys.exit(runner_main())
