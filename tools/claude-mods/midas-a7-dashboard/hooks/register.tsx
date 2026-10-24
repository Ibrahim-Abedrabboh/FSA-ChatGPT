// The Dashboard: one pane with the A7 service's health, its run status and the latest Railway log lines.
// It only reads. The bridge secret is read from the environment and sent to /status; it is never shown or stored.
import { atom, read, update } from 'claude-code'
import type { EngineInterface as Engine, Register } from 'claude-code'

import type { View } from '../types'
import { healthView, logsView, statusView } from './summarize'

const PANE = 'midas-a7-dashboard'
const DEFAULT_SERVICE = 'https://midas-a7-production.up.railway.app'
const view = atom({ plugin: 'midas-a7-dashboard', key: 'view' } as const, null as View | null)

let timer: { cancel: () => void } | null = null

async function get($: Engine, url: string, headers?: Record<string, string>) {
  try {
    const r = await $.http.fetch(url, { headers })
    return { status: r.status, text: r.text }
  } catch {
    return { status: 0, text: '' }
  }
}

async function refresh($: Engine) {
  const base = ((await $.env.get('A7_SERVICE_URL')) || DEFAULT_SERVICE).replace(/\/+$/, '')
  const secret = await $.env.get('A7_BRIDGE_HEADER_VALUE')
  const header = (await $.env.get('A7_BRIDGE_HEADER_NAME')) || 'Authorization'
  const service = (await $.env.get('A7_RAILWAY_SERVICE')) || ''
  // The secret goes only over https (or to this computer), never in clear text.
  const insecure = !/^https:\/\//.test(base) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(base)
  const [h, s] = await Promise.all([
    get($, base + '/health'),
    secret && !insecure ? get($, base + '/status', { [header]: secret }) : Promise.resolve({ status: 0, text: '' }),
  ])
  let logs
  try {
    const argv = ['railway', 'logs', '--lines', '40', ...(service ? ['--service', service] : [])]
    const r = await $.process.run(argv, { timeoutMs: 15000 })
    logs = logsView(r.exitCode, r.stdout, r.stderr)
  } catch (error) {
    logs = logsView(null, '', String((error as Error)?.message ?? ''))
  }
  const next: View = { checkedAt: new Date(await $.clock.now()).toISOString().slice(11, 19) + ' UTC', health: healthView(h.status, h.text), status: statusView(s.status, s.text, Boolean(secret), insecure), logs }
  await update($, view, () => next)
  $.ui.status(next.health.ok ? `A7 up${next.status.state === 'ok' ? ` · ${next.status.counts}` : ''}` : 'A7 not reached')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'a7-dashboard', description: 'Open the A7 dashboard pane and refresh it now' })
    timer?.cancel()
    timer = $.clock.every(60000, () => { void refresh($) })
    void refresh($)
    return next(e)
  })

  on('command.run', { command: 'a7-dashboard' }, async $ => {
    await $.ui.open({ id: PANE, title: 'A7 dashboard' })
    await refresh($)
    return { text: 'A7 dashboard opened and refreshed.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const v = await read($, view)
    if (!v) return <Text dimColor>Checking the A7 service…</Text>
    return (
      <Box flexDirection="column">
        <Text dimColor>Checked {v.checkedAt} · refreshes every minute</Text>
        <Text bold>Service</Text>
        <Text color={v.health.ok ? 'green' : 'red'}>{v.health.line}</Text>
        {v.health.missing.map(name => <Text color="yellow">missing: {name}</Text>)}
        <Text bold>Runs</Text>
        <Text color={v.status.state === 'ok' ? undefined : 'yellow'}>{v.status.line}</Text>
        {v.status.counts && <Text>{v.status.counts}</Text>}
        {v.status.runs.map(r => <Text color={r.status === 'error' || r.status === 'crashed' ? 'red' : undefined}>#{r.id} {r.flow} · {r.status} · {r.age}{r.note ? ` · ${r.note}` : ''}</Text>)}
        <Text bold>Railway logs</Text>
        <Text dimColor>{v.logs.line}</Text>
        {v.logs.lines.map(line => <Text dimColor>{line}</Text>)}
      </Box>
    )
  })
}
