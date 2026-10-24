import { expect, test } from 'claude-code/testing'

test('the reviewer agent is registered read-only on session start', async ($, on) => {
  const seen: Array<Record<string, unknown>> = []
  on('agent.register', (_, e) => {
    seen.push(e as unknown as Record<string, unknown>)
    return { value: { agent: 'midas-a7-specialist:a7-reviewer' } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })

  expect(seen.length).toBe(1)
  const spec = seen[0] as { name: string; tools: string[]; disallowedTools: string[]; prompt: string; model: string }
  expect(spec.name).toBe('a7-reviewer')
  expect(spec.model).toBe('opus')
  expect(spec.tools.includes('Edit')).toBe(false)
  expect(spec.disallowedTools.includes('Edit')).toBe(true)
  expect(spec.disallowedTools.includes('Write')).toBe(true)
  expect(spec.prompt).toContain('CLAUDE.md')
  expect(spec.prompt).toContain('Never: edit files, commit, push, merge')
})
