// Where the A7 webhooks are served (20 Oct 2026, Python fast track).
// Unset: the n8n host the site has always used, so nothing changes. Set A7_ENGINE_BASE_URL to the Python
// service's origin (currently https://midas-a7-production.up.railway.app) to send every A7 call there; unset it to go back.
// Only a bare https origin is used (no path, query, fragment or credentials). Any other value is ignored with a
// warning and calls stay on the n8n host, so a bad setting can never send owner data to an unexpected address.
export const N8N_ORIGIN = 'https://ibrahimnewaeon.app.n8n.cloud';

export function a7Origin(env = globalThis.Netlify?.env) {
  const raw = String(env?.get?.('A7_ENGINE_BASE_URL') ?? '').trim();
  if (!raw) return N8N_ORIGIN;
  let url = null;
  try { url = new URL(raw); } catch { /* reported below */ }
  if (!url || url.protocol !== 'https:' || url.username || url.password || !['', '/'].includes(url.pathname) || url.search || url.hash) {
    console.warn('A7_ENGINE_BASE_URL is not a bare https origin; using the n8n host');
    return N8N_ORIGIN;
  }
  return url.origin;
}

export const a7Webhook = (path, env) => `${a7Origin(env)}/webhook/${path}`;
