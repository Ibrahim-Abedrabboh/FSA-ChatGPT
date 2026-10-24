# A7 owner workspace: authentication and API design

Status: design only, 17 October 2026 (Asia/Amman). No identity service, API, credential, deployment, or n8n workflow was changed.

## Decision

Use **Netlify Identity** for the owner workspace on a separate preview site. Set registration to **invite only**. Give the invited owner account an `owner` role in Identity app metadata. All job data and decisions require a server-side role check. The public client site remains separate.

The HTML shell may be publicly downloadable; it must contain no job data, secret, credential, or private API response. Hiding a button in the browser never grants or revokes access.

## Request path

```text
Owner browser
  → Netlify Identity session (cookies managed by Identity)
  → Netlify Function (verify session + owner role + request origin)
  → dedicated A7 owner bridge (server-to-server credential)
  → A7 run tables and decision webhook
```

The browser never receives `X-Midas-Key`, a bridge bearer token, n8n resume URL, Go token, or n8n raw row. Store runtime credentials as Netlify secret environment variables scoped to Functions. Do not put them in `netlify.toml` or client-prefixed build variables.

## API contract to implement

All endpoints are same-origin, under `/api/owner`, return `Cache-Control: no-store`, and reject unauthenticated requests with 401 and non-owner requests with 403.

| Endpoint | Use | Required checks |
|---|---|---|
| `GET /api/owner/me` | Identity and role for the UI | Session and `owner` role |
| `GET /api/owner/jobs?cursor=…&state=…` | Bounded queue | Allowlisted state, page size cap, field-by-field output |
| `GET /api/owner/jobs/:id` | One job, holds, approved files, recorded cost | Validate ID, owner role, avoid raw rows and credentials |
| `POST /api/owner/jobs/:id/decision` | Go 1, Go 2, correction, stop | Origin check, valid stage, action allowlist, expected version, idempotency key, audit event |

The decision endpoint must compare the job's current stage and version immediately before forwarding an action. A repeated request with the same idempotency key must return the previous result. A stale decision returns a conflict and refreshes the job view. Costly work must remain behind A7's own budget and owner gates.

The frontend should show a confirmation view with the exact job, image, action, and estimated cost impact before a consequential decision. That view does not replace server-side checks.

## n8n boundary

A7's current job and owner-decision webhooks use `X-Midas-Key`, and A7 is unpublished. The GPT bridge and read-only monitor are also unpublished. Before an API can be connected:

1. Confirm the owner bridge's response schemas, and use a dedicated credential rather than the client intake key.
2. Add or verify a bounded read endpoint for queue and job detail; exclude tokens, resume URLs, raw model replies, and provider credentials.
3. Verify owner decisions against the authoritative run row and audit them.
4. Define retry and revision semantics per output. A UI click must not blindly re-run a paid stage.
5. Map A7 output manifests into approved-image links with explicit access and expiry rules.

## Identity setup and validation

1. Create a separate preview Netlify project from the GitHub branch or repository. Do not repurpose either existing production site for the first auth test.
2. Enable Identity in that project's dashboard, select invite-only registration, and invite the named owner. Assign the `owner` role from the admin interface.
3. Use the `@netlify/identity` package. Handle invite/recovery callbacks on the landing page. Do not implement a second OAuth flow.
4. On every Function request, use Identity's server-side `getUser()` and check `user.roles` for `owner`. Use modern v2 Functions. For state-changing requests, verify the request origin and use CSRF protection.
5. Test on an actual Netlify Deploy Preview. Identity authentication does not work under `netlify dev`.
6. Verify invited owner login, unauthorized user denial, logout, expired session, stale role, malformed IDs, stale decisions, duplicate decisions, and upstream timeout without revealing secrets.

Role changes take effect after a token refresh or new login. For urgent revocation, revoke the session and rotate the bridge credential as appropriate; do not rely on a changed role alone.

## Outstanding inputs before activation

- Owner email address for an invitation, supplied through the Identity dashboard rather than source code.
- Netlify preview project creation and Identity settings; neither has been applied.
- Dedicated A7 bridge credential, stored only in server-side secret configuration.
- Confirmed live queue/detail and decision contracts, including per-stage action rules.
- Approved file access and retention policy.
- A controlled end-to-end test plan with an explicit spending limit before paid model calls.

## Sources

- Netlify Identity overview: https://docs.netlify.com/manage/security/secure-access-to-sites/identity/overview/
- Identity in Functions: https://docs.netlify.com/manage/security/secure-access-to-sites/identity/use-identity-in-functions/
- Identity setup: https://docs.netlify.com/manage/security/secure-access-to-sites/identity/get-started/
- Role-based access control: https://docs.netlify.com/manage/security/secure-access-to-sites/role-based-access-control/
