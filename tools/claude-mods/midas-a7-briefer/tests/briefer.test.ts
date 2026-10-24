import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const START = { cwd: '/repo', surface: 'terminal', isInteractive: true } as const
const COMPOSE = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], tools: [], outputStyle: null, traits: [] }
const ENGINE_PROMPT = { sections: [{ id: 'intro', text: 'engine intro', scope: 'shared' as const }] }

function engine(on: Parameters<TestBody>[1], brief: string | null) {
  on('command.register', () => ({ value: { command: 'a7-brief' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('fs.read', () => (brief === null ? { deny: 'ENOENT: no such file' } : { value: brief }))
  on('prompt.compose', () => ENGINE_PROMPT)
}

test('the briefing file is added last, after the engine sections', async ($, on) => {
  engine(on, '# Midas A7: session briefing\nPhase 0 waits for the owner.')
  await $.session.start(START)
  const { sections } = await $.prompt.compose(COMPOSE)
  expect(sections[0]?.id).toBe('intro')
  const last = sections[sections.length - 1]
  expect(last?.id).toBe('midas-a7-briefer:brief')
  expect(last?.scope).toBe('session')
  expect(last?.text).toContain('Phase 0 waits for the owner.')
})

test('a missing briefing file falls back to the built-in hard stops', async ($, on) => {
  engine(on, null)
  await $.session.start(START)
  const { sections } = await $.prompt.compose(COMPOSE)
  expect(sections[sections.length - 1]?.text).toContain('briefing (fallback)')
})

test('a long briefing is cut at 6,000 characters', async ($, on) => {
  engine(on, 'x'.repeat(9000))
  await $.session.start(START)
  const { sections } = await $.prompt.compose(COMPOSE)
  const text = sections[sections.length - 1]?.text ?? ''
  expect(text.length < 6100).toBe(true)
  expect(text).toContain('cut at 6,000 characters')
})
