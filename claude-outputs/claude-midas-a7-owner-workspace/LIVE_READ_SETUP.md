# Read integration deployment setup

17 October 2026, Asia/Amman.

- Owner preview project now uses codex/a7-owner-read-status, with the same build base directory and commands.
- Dedicated read bridge G4cLxmwbkCxmCbQF is active in Ibrahim's personal n8n project; GET /webhook/a7/owner-read only.
- Its execution settings do not retain successful, failed, or manual execution payloads, to avoid storing Authorization request headers.
- The owner reports saving matching Authorization values in n8n and Netlify. The Netlify dashboard confirms A7_READ_AUTHORIZATION is marked secret and includes Functions scope; the value is not read or recorded here.
- Ten local tests, syntax checks and build passed. Live data checks are performed after this deployment.
- Existing A7 job workflows and data were not modified. There are no submission, approval, retry, model-provider or upload operations in the new bridge.