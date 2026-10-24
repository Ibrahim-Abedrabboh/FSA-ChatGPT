import type { EngineInterface, Register } from 'claude-code'

// The Briefer: every system prompt in this repo carries the A7 plan state and hard stops,
// read from a file the repo keeps current, so a new session starts where the last one stopped.
const BRIEF_PATH = 'claude-outputs/claude-midas-a7-briefing.md'
const MAX_CHARS = 6000
const SECTION_ID = 'midas-a7-briefer:brief'

// Used when the briefing file is missing (another repo, or an old checkout).
const FALLBACK = [
  '# Midas A7: session briefing (fallback)',
  `The briefing file ${BRIEF_PATH} was not found. Read CLAUDE.md and`,
  'claude-outputs/claude-midas-a7-audit-and-automation-plan-2026-10-21.md before acting.',
  'Hard stops: no paid call without the owner\'s go and a cap; never retry the image call;',
  'flow changes only as patches in tools/n8n_to_flow.py; no secrets anywhere;',
  'never merge, deploy, delete, publish or switch an engine yourself.',
].join('\n')

let brief = FALLBACK

async function load($: EngineInterface): Promise<string> {
  try {
    const trimmed = (await $.fs.read(BRIEF_PATH)).trim()
    if (!trimmed) return FALLBACK
    return trimmed.length > MAX_CHARS ? trimmed.slice(0, MAX_CHARS) + '\n[briefing cut at 6,000 characters]' : trimmed
  } catch {
    return FALLBACK
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    brief = await load($)
    await $.command.register({
      name: 'a7-brief',
      description: 'Show the Midas A7 briefing this session runs with, read again from the repo',
    })
    return next(e)
  })

  on('command.run', { command: 'a7-brief' }, async $ => {
    brief = await load($)
    return { text: brief }
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    const sections = composed.sections.filter(s => s.id !== SECTION_ID)
    return { sections: [...sections, { id: SECTION_ID, text: brief, scope: 'session' as const }] }
  })
}
