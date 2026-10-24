import test from "node:test";
import assert from "node:assert/strict";
import { ownerStatus, noStoreJson } from "../lib/owner-auth.mjs";

test("only an authenticated owner is allowed", () => {
  assert.equal(ownerStatus(null), 401);
  assert.equal(ownerStatus({ roles: [] }), 403);
  assert.equal(ownerStatus({ roles: ["member"] }), 403);
  assert.equal(ownerStatus({ roles: ["member", "owner"] }), 200);
});

test("responses cannot be cached", async () => {
  const response = noStoreJson({ ok: true });
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), { ok: true });
});
