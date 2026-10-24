# Prompt: check the local clone and report back

Run this in a Claude session **on the Mac**, in the folder `/Users/ibrahimabedrabboh/claude-midas-studio` (Claude Desktop, or `claude remote-control` in a terminal there). Paste its final report back into the cloud session. Written 20 Oct 2026.

---

You are checking a local folder for a cloud session that cannot reach this computer. The folder should be a clone of `Ibrahim-Abedrabboh/claude-midas-studio`; the cloud side has `main` at commit `73b477f` (PR #67 merged). Do not change, commit, push or delete anything. Read only.

Rules: never print the value of any secret or key. If a file looks like it holds secrets (`.env`, `.env.*`, anything with `KEY`, `SECRET`, `TOKEN`, `PASSWORD` in its name or content), report only the file path and the variable **names** it defines, never the values.

Produce one report, in this order:

1. **Is it the repo?** Output of `git remote -v`, `git branch --show-current`, `git log --oneline -3`, `git status --short`. Say whether `main` is behind, ahead of, or equal to `origin/main` (`git fetch origin main` then `git rev-list --left-right --count main...origin/main`). List local branches not on the remote (`git branch -vv`).
2. **Unpushed or uncommitted work.** For each modified, staged or untracked file: path, size, and one line on what it is. For untracked folders, list the top two levels only.
3. **Files that exist here but not on GitHub.** Compare the tree against `origin/main` (`git ls-files --others --exclude-standard` plus anything `.gitignore` hides: run `git status --ignored --short` and list the ignored paths). For each: what it is and whether it belongs in the repo, in a local-only place, or should be deleted. Expected candidates: a `.env` with the seven service variables (names only), source photos, Magnific exports, the client Excel, earlier run outputs, the historical register JSON.
4. **Secrets check.** `git log -p --all -S'sk-' --oneline | head`, and a grep over tracked files for `sk-[A-Za-z0-9]{20,}`, `AIza[0-9A-Za-z_-]{30,}`, `Bearer [A-Za-z0-9._-]{20,}`. Report only file paths and line numbers of any hit, never the matched text.
5. **Tooling present.** Versions of `python3`, `node`, `npm`, `git`, `docker` (if installed), and whether `pip install -e '.[dev]'` and `npm ci` in `src/midas_a7/engine/js` have been run (a `.venv` or `node_modules` present). Do not install anything.
6. **Tests, if the environment is ready.** If a virtualenv with the dev dependencies exists, run `python -m pytest -q tests/py` and `ruff check src tests/py tools/n8n_to_flow.py tools/extract_prompt_catalog.py`; report pass/fail counts and the first failure, if any. Skip with a note if the environment is not set up.
7. **Anything that would help the revamp.** Files or notes here that the cloud session does not have and that relate to: the Midas client Excel (product specs), vendor source photos used in past runs, Magnific Space exports, approved white masters, the owner's decisions. Paths and one-line descriptions only.

End with a short list: what to push, what to keep local, what to delete, and any question for the owner. Keep the whole report under 150 lines.
