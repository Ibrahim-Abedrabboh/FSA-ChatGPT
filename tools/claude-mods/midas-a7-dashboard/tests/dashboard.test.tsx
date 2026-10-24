import { expect, test } from 'claude-code/testing'
import { age, healthView, logsView, statusView } from '../hooks/summarize'

const SIG = 'e'.repeat(64)
const HEALTH = JSON.stringify({ status: 'ok', flows: { a: 1, b: 2 }, configured: { openAiApi: true, anthropicWorkspaceId: false } })
const STATUS = JSON.stringify({
  database: 'ok', counts: { success: 4, waiting: 1, error: 1 },
  running: [], waiting: [{ id: 7, flow: 'Claude · Midas A7 (stages 01–07)', status: 'waiting', ageSeconds: 360, waitKind: 'webhook' }],
  failed: [{ id: 3, flow: 'Claude · Midas A7 (stages 01–07)', status: 'error', ageSeconds: 7200, failedNode: 'Budget · 03 · Ticket', message: 'budget_identity_missing' }],
})

test('health: up with flow count; a missing credential is named, never a value', () => {
  const h = healthView(200, HEALTH)
  expect(h.ok).toBe(true)
  expect(h.line).toBe('Up · 2 flows · 1 credential(s) missing')
  expect(h.missing).toEqual(['anthropicWorkspaceId'])
  expect(healthView(0, '').line).toBe('Not reached')
  expect(healthView(502, 'bad gateway').ok).toBe(false)
})

test('status: each answer the service can give reads in plain words', () => {
  expect(statusView(0, '', false).state).toBe('no_secret')
  expect(statusView(404, '', true).state).toBe('not_deployed')
  expect(statusView(403, '', true).state).toBe('refused')
  expect(statusView(503, JSON.stringify({ database: 'unreachable' }), true).line).toBe('Database unreachable: the service cannot read its runs')
  expect(statusView(503, JSON.stringify({ code: 503, message: 'The status page needs A7_BRIDGE_HEADER_VALUE.' }), true).line).toContain('no bridge secret')
  expect(statusView(0, '', true, true).line).toContain('not https')
  const crashed = statusView(200, JSON.stringify({ database: 'ok', counts: { crashed: 1 }, running: [], waiting: [],
    failed: [{ id: 12, flow: 'Claude · Midas A7 (stages 01–07)', status: 'crashed', ageSeconds: 10800, failedNode: null, message: 'process stopped while the run was active' }] }), true)
  expect(crashed.runs[0]?.note).toBe('process stopped while the run was active')
  const s = statusView(200, STATUS, true)
  expect(s.state).toBe('ok')
  expect(s.counts).toBe('success 4 · waiting 1 · error 1')
  expect(s.runs.map(r => `${r.id} ${r.flow} ${r.status} ${r.age} ${r.note}`)).toEqual([
    '7 A7 run waiting 6m waits (webhook)', '3 A7 run error 2h at Budget · 03 · Ticket: budget_identity_missing'])
})

test('log lines are masked by The Shield rules and only the last ones are kept', () => {
  const out = [...Array.from({ length: 20 }, (_, i) => `line ${i}`), `GET /files/1${'a'.repeat(32)}/view?sig=${SIG} 200`].join('\n')
  const l = logsView(0, out, '')
  expect(l.lines.length).toBe(12)
  expect(l.lines.some(x => x.includes(SIG))).toBe(false)
  expect(l.lines[11]).toContain('sig=<redacted>')
  expect(logsView(1, '', 'Unauthorized. Please login with `railway login`').line).toContain('railway login')
  expect(logsView(null, '', '').line).toBe('Railway CLI not available here')
  expect(age(45)).toBe('45s')
  expect(age(null)).toBe('?')
})

test('the pane shows service, runs and logs; the secret goes only to /status, never to the pane or status line', async ($, on) => {
  const secret = 'bridge-' + 'x'.repeat(20)
  const statusLines: string[] = []
  const sent: { url: string; headers: string }[] = []
  on('command.register', () => ({ value: { command: 'a7-dashboard' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('clock.every', () => ({ value: undefined }))
  on('clock.now', () => ({ value: Date.UTC(2026, 9, 22, 10, 0, 0) }))
  on('ui.status', (_, e) => { statusLines.push(JSON.stringify(e)); return { value: undefined } })
  on('env.get', (_, e) => ({ value: ({ A7_BRIDGE_HEADER_VALUE: secret } as Record<string, string>)[e.name] }))
  on('http.fetch', (_, e) => ({ value: (sent.push({ url: e.url, headers: JSON.stringify(e.init?.headers ?? {}) }), e.url.endsWith('/health')) ? { status: 200, ok: true, headers: {}, text: HEALTH }
    : { status: e.init?.headers?.Authorization === secret ? 200 : 403, ok: true, headers: {}, text: STATUS } }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: 'Starting service\nready', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.run', () => ({ text: '' }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'a7-dashboard', args: '' } as Parameters<typeof $.command.run>[0])
  const ui = await $.ui.mount({ plugin: 'midas-a7-dashboard', component: 'Pane', requestId: 'midas-a7-dashboard', surface: 'desktop',
    props: { title: 'A7 dashboard', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } })
  expect((await ui.find({ type: 'Text', text: /^Up · 2 flows/ }))?.text).toBe('Up · 2 flows · 1 credential(s) missing')
  expect((await ui.find({ type: 'Text', text: /Budget · 03 · Ticket/ }))?.text).toContain('#3 A7 run · error')
  expect((await ui.find({ type: 'Text', text: /^ready$/ }))?.text).toBe('ready')
  expect(await ui.find({ type: 'Text', text: new RegExp(secret) })).toBe(undefined)
  expect(statusLines.length > 0 && statusLines.every(line => !line.includes(secret))).toBe(true)
  expect(sent.filter(r => r.headers.includes(secret)).map(r => r.url)).toEqual(sent.filter(r => r.url.endsWith('/status')).map(r => r.url))
  expect(sent.some(r => r.url.endsWith('/status'))).toBe(true)
  await ui.unmount()
})

test('with a plain http service address the secret is not sent at all', async ($, on) => {
  const secret = 'bridge-' + 'y'.repeat(20)
  const sent: string[] = []
  on('command.register', () => ({ value: { command: 'a7-dashboard' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('clock.every', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 0 }))
  on('ui.status', () => ({ value: undefined }))
  on('env.get', (_, e) => ({ value: ({ A7_BRIDGE_HEADER_VALUE: secret, A7_SERVICE_URL: 'http://a7.example.test' } as Record<string, string>)[e.name] }))
  on('http.fetch', (_, e) => { sent.push(e.url + JSON.stringify(e.init?.headers ?? {})); return { value: { status: 200, ok: true, headers: {}, text: HEALTH } } })
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: 'not linked', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.run', () => ({ text: '' }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'a7-dashboard', args: '' } as Parameters<typeof $.command.run>[0])
  expect(sent.some(x => x.includes(secret) || x.includes('/status'))).toBe(false)
})
