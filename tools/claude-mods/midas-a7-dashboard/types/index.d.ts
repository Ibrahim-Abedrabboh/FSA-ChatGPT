export type Health = { reached: boolean; ok: boolean; line: string; missing: string[] }
export type RunLine = { id: number; flow: string; status: string; age: string; note: string }
export type Status = { state: 'ok' | 'no_secret' | 'refused' | 'not_deployed' | 'unreachable'; line: string; counts: string; runs: RunLine[] }
export type Logs = { state: 'ok' | 'unavailable'; line: string; lines: string[] }
export type View = { checkedAt: string; health: Health; status: Status; logs: Logs }

declare module 'claude-code' {
  interface PluginState {
    'midas-a7-dashboard': { view: View | null }
  }
}
