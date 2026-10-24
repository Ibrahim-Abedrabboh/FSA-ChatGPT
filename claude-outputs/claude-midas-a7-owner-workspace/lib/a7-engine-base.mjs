// Where the A7 runner webhooks are served. Require an explicit bare HTTPS origin.

export function a7Origin(env = globalThis.Netlify?.env) {
  const raw = String(env?.get?.('A7_ENGINE_BASE_URL') ?? '').trim();
  if (!raw) throw new Error('A7 engine not configured');
  let url = null;
  try { url = new URL(raw); } catch { /* reported below */ }
  if (!url || url.protocol !== 'https:' || url.username || url.password || !['', '/'].includes(url.pathname) || url.search || url.hash) {
    throw new Error('A7 engine not configured: A7_ENGINE_BASE_URL must be a bare https origin');
  }
  return url.origin;
}

export const a7Webhook = (path, env) => `${a7Origin(env)}/webhook/${path}`;
