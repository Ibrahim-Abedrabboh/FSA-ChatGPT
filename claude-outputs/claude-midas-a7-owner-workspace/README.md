# Midas A7 owner workspace

Private owner workspace deployed to https://midas-a7-owner-preview.netlify.app/.

Sign-in is invite-only through Netlify Identity. A server-verified owner role is required for all A7 data. Session cookies are Secure, HttpOnly and SameSite=Lax.

The status/history integration uses a dedicated GET-only n8n bridge. It lists recorded runs and their trail events, current stage, holds and recorded Go 1/Go 2 decisions. No submission, approval, retry, file upload or model-generation action is connected.

Run `npm ci`, `npm test`, and `npm run build`. Netlify builds this directory and publishes `dist` with Node 24. Never deploy the repository root or put credentials in static assets.

See READ_STATUS.md for setup, bounds and validation. Historical design and foundation notes describe earlier states and are superseded by READ_STATUS.md.
