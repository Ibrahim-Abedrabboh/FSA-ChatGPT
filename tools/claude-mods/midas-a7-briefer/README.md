# midas-a7-briefer (The Briefer)

Adds the Midas A7 session briefing to the system prompt of every Claude Code session in the claude-midas-studio repo, so each session starts knowing the current phase, the open finding IDs, who does what and the hard stops. It reads `claude-outputs/claude-midas-a7-briefing.md` from the working directory at session start (falls back to a short built-in reminder if the file is missing) and caps it at 6,000 characters. `/a7-brief` shows the briefing and re-reads the file. Keep the briefing file current in the same PR as any change to a phase, blocker or finding.
