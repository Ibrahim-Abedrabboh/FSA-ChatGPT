# A7 read-only job integration

The owner frontend reads live A7 runs through a dedicated authenticated GET webhook. It cannot submit, approve, retry, or change A7 jobs.

## Resources

- Netlify project: midas-a7-owner-preview, 46f574fa-3262-494a-8362-895323cd5a3e.
- n8n read workflow: G4cLxmwbkCxmCbQF, in Ibrahim's personal project.
- Runs table: l0roUCBwIQL3h9Eq.
- History source: each run's recorded trail, with recorded Go 1/Go 2 decisions shown separately. This is not the full execution log or vault payload.
- Upstream: https://ibrahimnewaeon.app.n8n.cloud/webhook/a7/owner-read.
- Header credential: A7 GPT bridge inbound, Authorization header.

## Secret setup

Save the credential's complete Authorization value in Netlify A7_READ_AUTHORIZATION, marked secret, Functions scope, Production context. Never commit it or paste it into chat. Deploy after saving. No public n8n API key is required.

## Limits and failure behavior

The bridge reads the latest 1,001 rows to detect a 1,000-run cap. It returns pages of 50 and at most 300 history events per run, with explicit cap/truncation flags. Lists are sorted by updatedAt. Pagination reads the latest table on each request and can shift during concurrent updates; Refresh reloads the latest queue. Missing/malformed history is shown explicitly.

Netlify verifies the session and owner role before any upstream call. The upstream hostname/path are fixed. Only GET is allowed. Invalid IDs, timeouts, upstream failures and authentication failures return explicit errors. No cached or sample jobs silently replace unavailable live data.

Responses contain allowlisted IDs, timestamps, stage, status, hold/question summary, trail event names/notes, and recorded decisions. Raw rows, contracts, prompts, outputs, resume URLs and approval tokens are excluded. URLs and credential-like values are redacted from text fields. No files, costs or delivery completion are inferred from missing data.

Validation: npm test passed (10 checks), JavaScript syntax passed, npm run build passed. Live end-to-end verification depends on the connection secret and deployment. Owner sign-in was confirmed by the user in the preceding step.
