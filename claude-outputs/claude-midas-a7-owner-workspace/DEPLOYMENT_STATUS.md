# Owner preview deployment

Verified 17 October 2026, Asia/Amman. This record supersedes the earlier mock-only status in AUTH_FOUNDATION.md, INTEGRATION.md, and VERIFICATION.md.

- Project: midas-a7-owner-preview (46f574fa-3262-494a-8362-895323cd5a3e).
- URL: https://midas-a7-owner-preview.netlify.app/
- Source branch: codex/a7-owner-preview-deploy.
- Base directory: claude-outputs/claude-midas-a7-owner-workspace.
- Build: npm run build; publish: dist; Node: 24.
- Identity enabled, registration invite-only, email confirmation required.
- Login and invite acceptance use the Identity HTTP endpoints on the server so credentials and tokens are never persisted in browser storage. Cookies are Secure, HttpOnly, SameSite=Lax. The Identity SDK handles invitation callback parsing and same-origin validation.
- Owner HTML, scripts, and API require the owner role. Invalid/non-owner sessions are denied.
- Local checks: 5 tests passed; build passed.
- Live checks: login 200; /owner/, /owner/index.html, /owner/app.js and /api/owner/me return 401 signed out; cross-origin session POST returns 403; Identity settings show disable_signup=true.
- Owner invitation sent through the dashboard. Owner role and authenticated sign-in require verification before declaring the full flow tested.
- The workspace uses sample jobs. A7, OpenAI, Gemini, live uploads, persistent job records and job creation remain unconnected.

To stop access, remove the owner role or disable the Identity account in the dashboard. Roles in existing JWTs can remain valid until next login/refresh or expiration; server API checks read the current user record. No API secrets are required for this sample preview.

## Final access verification

The dashboard shows owner role for abd.rabo.940@gmail.com (Identity user 15f5223b-4a6d-4f75-ba7b-426046d5fcad). Role changes apply on the next login/token refresh. A live invalid login returned 401, and a forged owner JWT was rejected with 401. The user must complete password creation through the invitation; successful owner sign-in is not yet verified.
