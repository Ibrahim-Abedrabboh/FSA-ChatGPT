"""Run the existing assertions against runner.py during the local port.

The package-shaped proxies direct test imports and monkeypatches to names in
the flattened runner. This is a differential harness, not a runtime dependency.
"""

from __future__ import annotations

import importlib.util
import os
import sys
import types
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
RUNNER = ROOT / "claude-runner" / "runner.py"
spec = importlib.util.spec_from_file_location("claude_runner", RUNNER)
assert spec and spec.loader
runner = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = runner
spec.loader.exec_module(runner)


class Proxy(types.ModuleType):
    def __init__(self, name: str, prefix: str):
        super().__init__(name)
        super().__setattr__("_prefix", prefix)
        super().__setattr__("__path__", [])

    def __getattr__(self, attr: str):
        key = self._key(attr)
        if hasattr(runner, key):
            return getattr(runner, key)
        raise AttributeError(key)

    def __setattr__(self, attr: str, value) -> None:
        if attr.startswith("__") or attr == "_prefix":
            super().__setattr__(attr, value)
        else:
            key = self._key(attr)
            if hasattr(runner, key):
                setattr(runner, key, value)
            else:
                super().__setattr__(attr, value)

    def _key(self, attr: str) -> str:
        if self._prefix == "nodes_claude_reference_resize" and attr in {
            "_decode", "_ImageError", "_is_gray", "_Picture", "_resize"
        }:
            return "nodes_edit_image__" + attr
        return self._prefix + "__" + attr


names = (
    "", "config", "store", "engine", "engine.model", "engine.binary",
    "engine.services", "engine.jsrunner", "engine.executor", "nodes",
    "nodes.core", "nodes.http_request", "nodes.data_table",
    "nodes.google_drive", "nodes.edit_image", "nodes.llm",
    "nodes.claude_reference_resize", "runtime", "app", "cli", "flows",
)
for name in names:
    fullname = "midas_a7" + ("." + name if name else "")
    proxy = Proxy(fullname, name.replace(".", "_"))
    sys.modules[fullname] = proxy
    if "." in fullname:
        parent, child = fullname.rsplit(".", 1)
        setattr(sys.modules[parent], child, proxy)

sys.modules["midas_a7.flows"].__path__ = [str(ROOT / "src" / "midas_a7" / "flows")]

code_root = Path(os.environ.get("MIDAS_RUNNER_TEST_CODE", "/private/tmp/midas-a7-runner-test-code"))
runner.runner_extract_code(code_root)
for name, flow in runner.FLOWS.items():
    legacy_code = code_root / name / "code"
    legacy_code.mkdir(exist_ok=True)
    for node, text in runner.CODE[name].items():
        (legacy_code / runner.CODE_FILES[name][node]).write_text(text, encoding="utf-8")
    fullname = "midas_a7.flows." + name
    module = types.ModuleType(fullname)
    module.FLOW = flow
    module.__file__ = str(code_root / name / "__init__.py")
    sys.modules[fullname] = module
    setattr(sys.modules["midas_a7.flows"], name, module)


if __name__ == "__main__":
    raise SystemExit(pytest.main(sys.argv[1:] or ["-q", "tests/py"]))
