"""Run the guidance commands with the main flow's Code nodes from runner.py.

The copied test tree is disposable. Historical fixtures and other flow exports
stay available, while all main-flow Code-node file reads use extracted text.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GUIDANCE = ROOT / ".github" / "workflows" / "a7-guidance.yml"


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="midas-runner-node-overlay-") as temporary:
        overlay = Path(temporary)
        for name in ("n8n", "tests"):
            shutil.copytree(ROOT / name, overlay / name)
        for entry in ROOT.iterdir():
            if entry.name in {"n8n", "tests"}:
                continue
            (overlay / entry.name).symlink_to(entry)
        extracted = overlay / "extracted"
        environment = os.environ.copy()
        environment["MIDAS_RUNNER_HOME"] = str(overlay / "runtime")
        subprocess.run([sys.executable, str(ROOT / "claude-runner" / "runner.py"),
                        "extract-code", str(extracted)], env=environment, check=True)
        source = extracted / "a7_main"
        target = overlay / "n8n" / "claude-midas-a7" / "code-nodes"
        for code in source.glob("*.js"):
            (target / code.name).write_bytes(code.read_bytes())
        commands = [line.strip()[7:] for line in GUIDANCE.read_text().splitlines()
                    if line.strip().startswith("- run: ")
                    and line.strip()[7:].startswith(("node ", "python3 "))]
        failures = []
        for index, command in enumerate(commands, start=1):
            result = subprocess.run(command, shell=True, cwd=overlay, text=True,
                                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=False)
            status = "PASS" if result.returncode == 0 else "FAIL"
            print(f"{index}/{len(commands)} {status} {command}", flush=True)
            if result.returncode:
                failures.append((command, result.stdout[-1200:]))
        for command, output in failures:
            print(f"\nFAIL {command}\n{output}")
        print(f"{len(commands) - len(failures)}/{len(commands)} guidance commands passed")
        return int(bool(failures))


if __name__ == "__main__":
    raise SystemExit(main())
