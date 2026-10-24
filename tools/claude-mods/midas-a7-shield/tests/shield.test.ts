import { expect, test } from 'claude-code/testing'
import { redact } from '../hooks/redact'

// Fake secrets, built from pieces so no scanner mistakes this file for a leak.
const fake = (prefix: string, n: number, ch = 'x') => prefix + ch.repeat(n)
const ANTHROPIC = fake('sk-' + 'ant-api03-', 40)
const OPENAI = fake('sk-' + 'proj-', 40)
const GOOGLE = fake('AI' + 'za', 35, 'Q')
const BEARER = fake('ey', 30, 'J')
const SIG = 'd'.repeat(64)

test('provider keys, bearer tokens and Midas header values are masked; their names stay', async () => {
  const text = [
    `ANTHROPIC_API_KEY=${ANTHROPIC}`,
    `openai ${OPENAI}`,
    `url https://generativelanguage.googleapis.com/v1/models?key=${GOOGLE}`,
    `Authorization: Bearer ${BEARER}`,
    `"X-Midas-Key": "${fake('mk', 20)}"`,
    `X-Midas-Owner-Key: ${fake('ok', 20)}`,
    `https://midas-a7-production.up.railway.app/files/1${'a'.repeat(32)}/view?sig=${SIG}`,
    `A7_BRIDGE_HEADER_VALUE=${fake('br', 24)}`,
    `postgresql+psycopg://midas:${fake('pw', 12)}@127.0.0.1:5432/a7test`,
    `{"password": "${fake('p', 10)}"}`,
  ].join('\n')
  const out = redact(text)
  for (const secret of [ANTHROPIC, OPENAI, GOOGLE, BEARER, SIG, fake('mk', 20), fake('ok', 20), fake('br', 24), fake('pw', 12), fake('p', 10)]) {
    expect(out.includes(secret)).toBe(false)
  }
  expect(out).toContain('ANTHROPIC_API_KEY=<redacted>')
  expect(out).toContain('Bearer <redacted>')
  expect(out).toContain('sig=<redacted>')
  expect(out).toContain('X-Midas-Owner-Key: <redacted>')
  expect(out).toContain('postgresql+psycopg://midas:<redacted>@127.0.0.1')
})

test('ordinary work output is left alone', async () => {
  const text = 'commit 6437817 · sha256 ' + 'a'.repeat(64) + ' · ANTHROPIC_WORKSPACE_ID is set · GET /health 200 · owner-' + 'b'.repeat(8)
  expect(redact(text)).toBe(text)
})

test('a stored tool result is masked before it is kept, and a clean row passes unchanged', async ($, on) => {
  const kept: unknown[] = []
  on('session.append', (_, e, next) => { kept.push(e.message.content); return next(e) })
  on('ui.status', () => ({ value: undefined }))
  await $.session.append({ message: { type: 'user', role: 'user', content: [{ type: 'text', text: `token here: Bearer ${BEARER}` }] }, door: 'tool-result', origin: { kind: 'tool', tool: 'Bash' }, uuid: 'row-1' })
  await $.session.append({ message: { type: 'user', role: 'user', content: [{ type: 'text', text: 'nothing secret' }] }, door: 'tool-result', origin: { kind: 'tool', tool: 'Bash' }, uuid: 'row-2' })
  const first = JSON.stringify(kept[0])
  expect(first.includes(BEARER)).toBe(false)
  expect(first).toContain('Bearer <redacted>')
  expect(JSON.stringify(kept[1])).toContain('nothing secret')
})
