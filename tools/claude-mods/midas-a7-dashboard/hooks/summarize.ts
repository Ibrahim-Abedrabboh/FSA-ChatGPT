// Turns the service's answers into the few lines the pane shows. Pure functions, so the tests need no network.
import type { Health, Logs, RunLine, Status } from '../types'
import { redact } from './redact'

const SHORT: Record<string, string> = {
  'Claude · Midas A7 (stages 01–07)': 'A7 run',
  'A7 · Owner submission and approval bridge': 'owner bridge',
  'A7 · Owner status and history (read only)': 'owner read',
  'A7 · Owner source analysis bridge': 'source analysis',
  'A7 · Source analysis only': 'analysis only',
  'A7 · Model tests per stage (owner page)': 'model tests',
  'Claude · Midas catalogue refresh': 'catalogue refresh',
}

export function age(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '?'
  if (seconds < 90) return `${Math.round(seconds)}s`
  if (seconds < 5400) return `${Math.round(seconds / 60)}m`
  if (seconds < 172800) return `${Math.round(seconds / 3600)}h`
  return `${Math.round(seconds / 86400)}d`
}

// /health: up or not, and which credentials are missing (names only; the service never sends values).
export function healthView(status: number, text: string): Health {
  if (status === 0) return { reached: false, ok: false, line: 'Not reached', missing: [] }
  try {
    const body = JSON.parse(text)
    const missing = Object.entries(body.configured ?? {}).filter(([, v]) => v !== true).map(([k]) => k)
    const flows = Object.keys(body.flows ?? {}).length
    const ok = status === 200 && body.status === 'ok'
    return { reached: true, ok, line: ok ? `Up · ${flows} flows${missing.length ? ` · ${missing.length} credential(s) missing` : ' · all credentials set'}` : `Answered ${status}`, missing }
  } catch {
    return { reached: true, ok: false, line: `Answered ${status}, not readable`, missing: [] }
  }
}

function runLine(r: Record<string, unknown>): RunLine {
  // A run lost to a restart has a message and no step ("process stopped while the run was active").
  const message = redact(String(r.message ?? ''))
  const note = r.status === 'waiting' ? `waits (${String(r.waitKind ?? '?')})`
    : r.failedNode ? `at ${String(r.failedNode)}: ${message}`.slice(0, 160) : message.slice(0, 160)
  return { id: Number(r.id), flow: SHORT[String(r.flow)] ?? String(r.flow), status: String(r.status), age: age(r.ageSeconds as number), note }
}

// /status: 404 means the build that has it is not deployed yet; 403 a wrong secret; 503 either the service has no
// bridge secret or its database could not be read (src/midas_a7/app.py).
export function statusView(status: number, text: string, hasSecret: boolean, insecure = false): Status {
  const empty = { counts: '', runs: [] as RunLine[] }
  if (!hasSecret) return { state: 'no_secret', line: 'Set A7_BRIDGE_HEADER_VALUE where Claude Code runs to see runs', ...empty }
  if (insecure) return { state: 'refused', line: 'Not asked: A7_SERVICE_URL is not https, so the bridge secret is not sent', ...empty }
  if (status === 0) return { state: 'unreachable', line: 'Not reached', ...empty }
  if (status === 404) return { state: 'not_deployed', line: 'Not deployed yet (the service still runs the build without /status)', ...empty }
  if (status === 403) return { state: 'refused', line: 'Refused: the bridge secret here does not match the service', ...empty }
  if (status === 503) {
    let body: { database?: string } = {}
    try { body = JSON.parse(text) } catch { /* not JSON: the generic line below */ }
    return body.database === 'unreachable'
      ? { state: 'unreachable', line: 'Database unreachable: the service cannot read its runs', ...empty }
      : { state: 'refused', line: 'The service has no bridge secret set (A7_BRIDGE_HEADER_VALUE on Railway)', ...empty }
  }
  if (status !== 200) return { state: 'unreachable', line: `Answered ${status}`, ...empty }
  try {
    const body = JSON.parse(text)
    const counts = Object.entries(body.counts ?? {}).map(([k, v]) => `${k} ${v}`).join(' · ') || 'no runs yet'
    const runs = [...(body.running ?? []), ...(body.waiting ?? []), ...(body.failed ?? []).slice(0, 5)].map(runLine)
    return { state: 'ok', line: `Database ${body.database ?? '?'}`, counts, runs }
  } catch {
    return { state: 'unreachable', line: 'Answered 200, not readable', ...empty }
  }
}

// Railway log lines: the last `keep`, each masked by The Shield's rules and cut short.
export function logsView(exitCode: number | null, stdout: string, stderr: string, keep = 12): Logs {
  if (exitCode !== 0) {
    const why = redact((stderr || stdout).trim().split('\n').pop() ?? '').slice(0, 160)
    return { state: 'unavailable', line: why ? `Railway CLI: ${why}` : 'Railway CLI not available here', lines: [] }
  }
  const lines = stdout.split('\n').map(l => l.trimEnd()).filter(Boolean).slice(-keep).map(l => redact(l).slice(0, 200))
  return { state: 'ok', line: lines.length ? `Last ${lines.length} lines` : 'No log lines', lines }
}
