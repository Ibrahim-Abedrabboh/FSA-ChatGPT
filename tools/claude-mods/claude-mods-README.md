# Claude Code mods for Midas Studio

Mods change how Claude Code behaves while working in this repo. They do not change the Midas app and call no paid service. Only The Dashboard reads a secret (the bridge secret, from your own shell, for `/status`).

| Folder | Nickname | What it does |
|---|---|---|
| `midas-a7-briefer/` | The Briefer | Adds `claude-outputs/claude-midas-a7-briefing.md` (plan state, open finding IDs, who does what, hard stops) to every session's system prompt. `/a7-brief` shows it |
| `midas-a7-shield/` | The Shield | Masks provider keys, bearer tokens, `X-Midas-Key` values, `sig=` links, the project's secret variables and database passwords in everything the session stores, before it reaches the transcript or the next request |
| `midas-a7-dashboard/` | The Dashboard | A pane with the service's `/health`, its run status from `/status` (needs `A7_BRIDGE_HEADER_VALUE` in your shell; never shown) and the last Railway log lines (needs the Railway CLI), masked with The Shield's rules. `/a7-dashboard` opens it |
| `midas-a7-specialist/` | The Specialist | Registers the read-only reviewer agent `midas-a7-specialist:a7-reviewer` (Opus), which checks a change against CLAUDE.md before the owner sees it (rule 12) |

Folder names follow the plugin names. Claude Code refuses plugin names that start with `claude-`, so these are the one exception to rule 13.

## Use them on your computer
From the repo root:

    claude --plugin-dir tools/claude-mods/midas-a7-briefer --plugin-dir tools/claude-mods/midas-a7-specialist --plugin-dir tools/claude-mods/midas-a7-shield --plugin-dir tools/claude-mods/midas-a7-dashboard

Or add the folders to your launcher script.

## Check them after a change

    claude plugin validate tools/claude-mods/<mod>
    claude plugin test tools/claude-mods/<mod>

## Keep the Briefer current
Update `claude-outputs/claude-midas-a7-briefing.md` in the same PR as any change to a phase, a blocker or a finding. The file must stay under 6,000 characters; past that, the Briefer cuts it.
