# Owner API foundation

The code in `netlify/functions/` provides a protected `GET /api/owner/me` route. It uses Netlify Identity's server-side `getUser()` and requires the `owner` role. It returns no private job data and sets `Cache-Control: no-store`.

The current frontend remains a synthetic mock. It does not call the route. To activate Identity, a separate preview Netlify project must be created, configured as invite-only, and deployed with the package dependency installed. Neither existing production site is an auth test target.

Run `npm test` for pure authorization checks and `npm run build` for static output. `package-lock.json` pins the dependency graph. Identity itself still requires testing on a Netlify Deploy Preview.
