# Owner site settings (Netlify environment variables)

**Local Phase 1 source update, 24 Oct 2026:** The proposed owner-site code now requires an explicit bare HTTPS `A7_ENGINE_BASE_URL`. An unset or invalid value makes A7 calls fail closed. This source has not been deployed or switched on either site. The 18–20 Oct live-setting snapshot below describes the earlier deployed code; its n8n fallback and rollback instructions do not apply to this Phase 1 source. For a later rollback, redeploy the previous owner-site version and set its engine address according to that version's runbook. Do not infer that deleting the variable in the new version switches to n8n.

Checked 18 Oct 2026 on both Netlify projects; `midas-a7-owner-preview` checked again on 20 Oct 2026 when the A7 engine switch was set. A change takes effect only after the next deploy.
Set them under Netlify → Site configuration → Environment variables, scope **Functions**, context **Production**.
Any value other than exactly `true` counts as off (the two address and key settings are not switches).

| Setting | What it does when `true` | When off or missing | `midas-a7-owner-preview` now | `claude-final-midas-a7` now | Recommended |
|---|---|---|---|---|---|
| `A7_READ_AUTHORIZATION` (secret) | The key the site uses to reach its configured A7 engine. Not a switch. The engine's `A7_BRIDGE_HEADER_VALUE` must hold the same value | Nothing can reach A7: no jobs, no analysis, no job list | Set (production) | Set (production) | **Keep set.** Rotate only with the corresponding engine credential |
| `A7_ENGINE_BASE_URL` | Not a switch: the bare HTTPS origin every A7 call goes to (jobs, connection, actions, projects, reader recovery, source analysis, model tests) | In the Phase 1 source, A7 calls are refused until configured. Invalid values are refused | **Set** (production, 20 Oct 2026; historical snapshot) | Off (missing; historical snapshot) | For local Phase 1 testing, use an HTTPS origin for the runner. Neither live site has been switched to this source |
| `A7_OWNER_ACTIONS_ENABLED` | Owner can send jobs, make plan/image decisions and use reader recovery | Every owner action is refused (`owner_actions_not_enabled`) | **On** | **On** | **On.** Emergency stop for all owner actions |
| `A7_PAID_BUDGET_GUARDS_READY` | Paid work may start (submissions, decisions, analysis) | All paid processing pauses; only "stop" still works. Since 22 Oct 2026 the ledger also refuses new reservations, so a run already past Go 1 holds at its next paid call | **On** (all contexts) | **On** (production) | **On.** Emergency stop for spending. On the preview site, limiting it to Production would match the other site (optional) |
| `A7_ANALYSIS_READY` | Source analysis (Analyze, Recover) is connected | Analysis shows "not connected"; nothing is read or charged | **On** (production) | **Off** (missing) | Preview: **on**. Final: **keep off** until the studio has a source-confirmation step |
| `A7_OWNER_TEST_ALL_SCOPES` | Owner test mode: any scope the server accepts can be sent with a provisional estimate, still capped by the job ceiling | Only the verified scope (one product photo, one White BK, square 2K) can be sent | **On** (all four contexts, set 19 Oct 2026 09:24 UTC; seen 20 Oct) | Not used by this site's code | **On only while testing**, then remove it. Each test job can spend up to its ceiling |
| `A7_BRIDGE_MULTI_REFERENCE` | Jobs with more than one saved photo may be sent (up to 12 files, 14 MB in total, exactly one product photo, at most one room photo; specification files allowed; the site checks this before sending) | A job with more than one photo is refused (`bridge_single_reference`) | **On** (all contexts, 19 Oct 2026, with owner bridge version 13714add) | Off (missing) | **On** while the owner bridge forwards every file (n8n `Mo9c5GmTcx0K79F7`, published 19 Oct 2026). Turn it off if that bridge is rolled back |

Not listed: the database, Netlify Identity and Blobs are connected by Netlify itself and have no switch here.
The A7 engine has its own switches that are not Netlify settings: in n8n, the readers and the paid workflows; on the Python service (Railway project `midas-a7`), `SCHEDULES_ENABLED` and the provider keys, listed in `claude-outputs/claude-midas-a7-python-service-runbook-2026-10-20.md`.

## Typical combinations

- **Normal running:** `READ_AUTHORIZATION` set, `OWNER_ACTIONS_ENABLED` on, `PAID_BUDGET_GUARDS_READY` on, `ANALYSIS_READY` on (preview), the rest off.
- **On the Python service (preview site since 20 Oct 2026):** as normal plus `A7_ENGINE_BASE_URL` set to the service origin.
- **Rollback from a later runner cutover:** redeploy the previous owner-site version and follow the cutover runbook. Deleting `A7_ENGINE_BASE_URL` from the Phase 1 code leaves A7 unavailable.
- **Testing every feature (preview only):** as normal plus `A7_OWNER_TEST_ALL_SCOPES=true`. Remove it after testing.
- **Stop all spending now:** set `A7_PAID_BUDGET_GUARDS_READY` to anything other than `true` (or delete it) and redeploy. Waiting runs can still be stopped.
- **Stop everything the owner can do:** also turn off `A7_OWNER_ACTIONS_ENABLED`.
