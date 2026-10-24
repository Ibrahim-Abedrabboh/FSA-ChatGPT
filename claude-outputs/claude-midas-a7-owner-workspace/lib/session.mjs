export const SESSION_COOKIES = ["nf_jwt", "nf_refresh"];
export function setSession(cookies, tokens) {
  if (!tokens.access_token || !tokens.refresh_token) throw new Error("Invalid session");
  for (const [name, value] of [["nf_jwt", tokens.access_token], ["nf_refresh", tokens.refresh_token]]) {
    cookies.set({ name, value, httpOnly: true, secure: true, sameSite: "Lax", path: "/" });
  }
}
export function clearSession(cookies) {
  for (const name of SESSION_COOKIES) cookies.delete({ name, path: "/" });
}
export async function identityRequest(siteUrl, path, options = {}) {
  const response = await fetch(new URL(`/.netlify/identity${path}`, siteUrl), {
    ...options, signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) {
    const error = new Error("Identity request failed");
    error.status = response.status;
    throw error;
  }
  if (response.status === 204 || response.headers.get("content-length") === "0") return null;
  return response.json();
}
export async function readCredentials(request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("Invalid content type");
  const text = await request.text();
  if (text.length > 4096) throw new Error("Request too large");
  const input = JSON.parse(text);
  if (!input || typeof input !== "object" || typeof input.password !== "string" || input.password.length < 1 || input.password.length > 256) throw new Error("Invalid password");
  if (input.action === "invite") {
    if (typeof input.token !== "string" || !/^[a-zA-Z0-9_-]{10,2048}$/.test(input.token) || input.password.length < 12) throw new Error("Invalid invitation");
  } else if (input.action !== "login" || typeof input.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || input.email.length > 254) {
    throw new Error("Invalid login");
  }
  return input;
}
