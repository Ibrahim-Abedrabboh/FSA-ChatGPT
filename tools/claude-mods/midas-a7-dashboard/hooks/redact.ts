// What The Shield masks (CLAUDE.md rule 1): provider keys, bearer tokens, the Midas header values, signed-link and
// key query parameters, secret environment variables and database passwords. The name stays; the value becomes <redacted>.
const MASK = '<redacted>'

const RULES: ReadonlyArray<readonly [RegExp, string]> = [
  // Provider and platform keys by their shape.
  [/\bsk-ant-[A-Za-z0-9_-]{16,}/g, MASK],
  [/\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/g, MASK],
  [/\bAIza[0-9A-Za-z_-]{35}\b/g, MASK],
  [/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/g, MASK],
  [/\bgithub_pat_[A-Za-z0-9_]{40,}\b/g, MASK],
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}\b/g, MASK],
  // Authorization headers and bearer tokens.
  [/(\bBearer\s+)[A-Za-z0-9._~+/=-]{12,}/gi, `$1${MASK}`],
  [/(\bAuthorization["']?\s*[:=]\s*["']?)(?!Bearer\b)[^\s"',;}]{8,}/gi, `$1${MASK}`],
  // The Midas client and owner header values.
  [/(\bX-Midas(?:-Owner)?-Key["']?\s*[:=]\s*["']?)[^\s"',;}]+/gi, `$1${MASK}`],
  // Signed links and keys in query strings.
  [/([?&](?:sig|signature|key|api_key|apikey|token|access_token)=)[^&\s"'<>)]+/gi, `$1${MASK}`],
  // Secret environment variables, as NAME=value or "NAME": "value".
  [/(\b(?:A7_READ_AUTHORIZATION|A7_BRIDGE_HEADER_VALUE|MIDAS_CLIENT_HEADER_VALUE|MIDAS_OWNER_HEADER_VALUE|RESUME_SIGNING_SECRET|ANTHROPIC_API_KEY|OPENAI_API_KEY|GEMINI_API_KEY|HAWK_API_KEY|NETLIFY_AUTH_TOKEN|RAILWAY_TOKEN)["']?\s*[:=]\s*["']?)[^\s"',}]+/g, `$1${MASK}`],
  // Generic secret-looking JSON fields.
  [/("(?:password|secret|client_secret|api_key|apiKey|access_token|refresh_token|private_key)"\s*:\s*")[^"]{4,}"/g, `$1${MASK}"`],
  // Passwords inside database URLs.
  [/(\b(?:postgres(?:ql)?|mysql|redis)(?:\+\w+)?:\/\/[^:\s/@]+:)[^@\s]+@/gi, `$1${MASK}@`],
]

export function redact(text: string): string {
  let out = text
  for (const [pattern, replacement] of RULES) out = out.replace(pattern, replacement)
  return out
}
