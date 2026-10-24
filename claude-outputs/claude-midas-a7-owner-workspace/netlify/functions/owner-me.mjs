import { noStoreJson, ownerStatus } from "../../lib/owner-auth.mjs";
import { identityRequest, setSession, clearSession } from "../../lib/session.mjs";
export default async function handler(request, context) {
  if (request.method !== "GET") return noStoreJson({ error: "method_not_allowed" }, 405);
  let token = context.cookies.get("nf_jwt");
  if (!token) return noStoreJson({ error: "unauthorized" }, 401);
  try {
    let user;
    try { user = await identityRequest(context.site.url, "/user", { headers: { Authorization: `Bearer ${token}` } }); }
    catch (error) {
      if (![401, 403].includes(error.status)) throw error;
      const refresh = context.cookies.get("nf_refresh");
      if (!refresh) { clearSession(context.cookies); return noStoreJson({ error: "unauthorized" }, 401); }
      const tokens = await identityRequest(context.site.url, "/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh }) });
      token = tokens.access_token;
      user = await identityRequest(context.site.url, "/user", { headers: { Authorization: `Bearer ${token}` } });
      setSession(context.cookies, tokens);
    }
    const status = ownerStatus({ roles: user.app_metadata?.roles });
    if (status !== 200) { clearSession(context.cookies); return noStoreJson({ error: "forbidden" }, 403); }
    return noStoreJson({ id: user.id, email: user.email, role: "owner" });
  } catch (error) {
    if (error.status && error.status < 500) { clearSession(context.cookies); return noStoreJson({ error: "unauthorized" }, 401); }
    return noStoreJson({ error: "identity_unavailable" }, 503);
  }
}
// Its own route and rate limit (it can exchange a refresh token). Other functions import the handler for their own checks.
export const config = { path: '/api/owner/me', rateLimit: { action: 'rate_limit', aggregateBy: ['domain', 'ip'], windowSize: 60, windowLimit: 30 } };
