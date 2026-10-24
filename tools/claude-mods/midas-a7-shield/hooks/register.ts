import type { Register } from 'claude-code'
import { redact } from './redact'

// The Shield: every row the session stores (tool results, notes, the model's own text) is masked before it is kept,
// so a key or token printed by a command never reaches the transcript or the next request (CLAUDE.md rule 1).
type Block = { type: string; text?: string; content?: unknown; [key: string]: unknown }

function maskBlock(block: Block): Block {
  if (block.type === 'text' && typeof block.text === 'string') {
    const text = redact(block.text)
    return text === block.text ? block : { ...block, text }
  }
  if (block.type === 'tool_result') {
    if (typeof block.content === 'string') {
      const content = redact(block.content)
      return content === block.content ? block : { ...block, content }
    }
    if (Array.isArray(block.content)) {
      const inner = (block.content as Block[]).map(maskBlock)
      return inner.some((b, i) => b !== (block.content as Block[])[i]) ? { ...block, content: inner } : block
    }
  }
  return block
}

let masked = 0

export const register: Register = on => {
  on('session.append', async ($, e, next) => {
    const content = e.message.content as unknown as Block[] | undefined
    if (!Array.isArray(content)) return next(e)
    const blocks = content.map(maskBlock)
    if (blocks.every((b, i) => b === content[i])) return next(e)
    masked++
    $.ui.status(`shield: masked secrets in ${masked} row${masked === 1 ? '' : 's'}`)
    return next({ ...e, message: { ...e.message, content: blocks as unknown as typeof e.message.content } })
  })
}
