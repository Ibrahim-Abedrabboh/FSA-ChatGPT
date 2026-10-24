import test from "node:test";
import assert from "node:assert/strict";
import { setSession, clearSession, readCredentials } from "../lib/session.mjs";
import handler from "../netlify/functions/session.mjs";
test("session cookies stay server-only and clear together", () => {
  const written = [], removed = [];
  const cookies = { set: value => written.push(value), delete: value => removed.push(value) };
  setSession(cookies, { access_token: "access", refresh_token: "refresh" });
  assert.deepEqual(written.map(c => c.name), ["nf_jwt", "nf_refresh"]);
  for (const cookie of written) { assert.equal(cookie.httpOnly, true); assert.equal(cookie.secure, true); assert.equal(cookie.sameSite, "Lax"); }
  clearSession(cookies); assert.equal(removed.length, 2);
  assert.throws(() => setSession(cookies, { access_token: "access" }));
});
test("reject invalid and oversized credentials at the server boundary", async () => {
  const req = value => new Request("https://preview.example/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
  await assert.rejects(readCredentials(req({ action: "login", email: "bad", password: "pw" })));
  await assert.rejects(readCredentials(req({ action: "invite", token: "valid-invite-token", password: "short" })));
  await assert.rejects(readCredentials(req({ action: "login", email: "owner@example.com", password: "x".repeat(257) })));
  assert.equal((await readCredentials(req({ action: "login", email: "owner@example.com", password: "valid-password" }))).action, "login");
});
test("session endpoint rejects foreign or absent origins before any Identity call", async () => {
  for (const origin of [null, "https://attacker.example"]) {
    const headers = origin ? { Origin: origin } : {};
    const response = await handler(new Request("https://preview.example/api/session", { method: "POST", headers }), {});
    assert.equal(response.status, 403);
  }
});
