import { verifyRequestOrigin } from "@netlify/identity";
import { ownerStatus, noStoreJson } from "../../lib/owner-auth.mjs";
import { setSession, clearSession, identityRequest, readCredentials } from "../../lib/session.mjs";

export default async function handler(request, context) {
  if (request.method !== "POST") return noStoreJson({ error: "method_not_allowed" }, 405);
  try { verifyRequestOrigin(request); } catch { return noStoreJson({ error: "origin_rejected" }, 403); }
  const siteUrl = context.site.url;
  if (new URL(request.url).pathname.endsWith("/logout")) {
    const jwt = context.cookies.get("nf_jwt");
    let revoked = true;
    if (jwt) {
      try { await identityRequest(siteUrl, "/logout", { method: "POST", headers: { Authorization: `Bearer ${jwt}` } }); }
      catch { revoked = false; }
    }
    clearSession(context.cookies);
    return noStoreJson({ ok: true, revoked });
  }
  let input;
  try { input = await readCredentials(request); }
  catch { return noStoreJson({ error: "invalid_input" }, 400); }
  try {
    const tokens = input.action === "invite"
      ? await identityRequest(siteUrl, "/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "signup", token: input.token, password: input.password }) })
      : await identityRequest(siteUrl, "/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "password", username: input.email, password: input.password }) });
    const user = await identityRequest(siteUrl, "/user", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    if (ownerStatus({ roles: user.app_metadata?.roles }) !== 200) {
      await identityRequest(siteUrl, "/logout", { method: "POST", headers: { Authorization: `Bearer ${tokens.access_token}` } });
      clearSession(context.cookies);
      return noStoreJson({ error: "owner_required" }, 403);
    }
    setSession(context.cookies, tokens);
    return noStoreJson({ ok: true });
  } catch (error) {
    const unavailable = !error.status || error.status >= 500;
    return noStoreJson({ error: unavailable ? "identity_unavailable" : "sign_in_failed" }, unavailable ? 503 : 401);
  }
}
export const config = {
  path: ["/api/session", "/api/logout"],
  rateLimit: { action: "rate_limit", aggregateBy: ["domain", "ip"], windowSize: 60, windowLimit: 10 }
};
