"""Copy the reader prompts verbatim from the site's live prompt record.

Usage (from services/a7-engine):
    python tools/extract_prompts.py ../../claude-outputs/claude-midas-a7-owner-workspace/analysis-reader-prompts-live.md

Writes app/prompts/<node>.txt with each ```text block exactly as recorded (no
trailing newline). tests/test_prompts.py fails when the two drift apart.
"""

from __future__ import annotations

import pathlib
import re
import sys

FILES = {
    "03 Eye reads the product photo": "03_eye.txt",
    "05 Second count": "05_second_count.txt",
    "06 Room reader": "06_room_reader.txt",
    "09 Conflict check": "09_conflict_check.txt",
}


def extract(markdown: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for section in re.split(r"^## ", markdown, flags=re.M)[1:]:
        title = section.splitlines()[0].strip()
        match = re.search(r"```text\n(.*?)\n```", section, flags=re.S)
        if title in FILES and match:
            out[title] = match.group(1)
    return out


def main() -> None:
    source = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
    prompts = extract(source)
    missing = set(FILES) - set(prompts)
    if missing:
        raise SystemExit("missing prompts: " + ", ".join(sorted(missing)))
    target = pathlib.Path(__file__).resolve().parents[1] / "app" / "prompts"
    for node, name in FILES.items():
        (target / name).write_text(prompts[node], encoding="utf-8")
        print(name, len(prompts[node]))


if __name__ == "__main__":
    main()
