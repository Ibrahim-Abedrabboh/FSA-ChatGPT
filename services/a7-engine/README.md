# A7 engine (source analysis)

A small FastAPI service that can stand in for the n8n source-analysis path:
the bridge `POST /webhook/a7/owner-analyze` (n8n bridge workflow) and the
"A7 · Source analysis only" workflow (`AMdtt1fFwHln4DB8`) behind it. It keeps
the contract the owner site already calls, so a later site change can point
one site at it with an environment variable and keep n8n as the rollback.

This is stage one. The site has not been switched. This branch does not change
the site, n8n, Netlify or Railway.

## What it does

```
site (productionReader.run)
  │  multipart: payload (JSON) + files (<role>-<referenceId>), Authorization
  ▼
POST /webhook/a7/owner-analyze
  1. Header auth, constant-time compare with A7_ENGINE_AUTHORIZATION
  2. Intake (bridge + analysis rules, same error codes)
  3. Duplicate guard (same requestId waits or replays; another request for a running draft holds)
  4. For each reader, in order: 03 Eye → 05 Second count → 06 Room reader (room photo only) → 09 Conflict check
       Ticket   operationKey = "a7:" + sha256(canonical(slot)); requestSha256 over n8n parameters, state, file hashes
       Reserve  POST {budget origin}/api/a7/budget/reserve   (no valid permit → hold, nothing sent)
       Read     provider call; one retry after 5 s on error, inside the same reservation
       Receipt  usage from provider token counts; receiptRef; complete answer envelope
       Settle   POST {budget origin}/api/a7/budget/settle    (not completed + preserved → hold)
  5. 200 {http_status, accepted:true, receiptId, draftId, clientRunId, runId, sourceSha256,
          referenceFingerprint, roomSha256, intentFingerprint, readers:[{node,status,operationKey,receiptRef}]}
     or 409 {http_status:409, error:"analysis_outcome_uncertain", accepted:false}
```

The response only points into the site's ledger. As with n8n, the site rebuilds
the facts from the preserved provider answers (`verifiedAnalysisAnswers`) and its
`recover()` reads the same `a7_paid_operations` rows, so it works the same for
runs made by either engine.

### Layout

| Path | Purpose |
| --- | --- |
| `app/main.py` | Routes `/webhook/a7/owner-analyze` and `/health`, auth, multipart parsing |
| `app/intake.py` | Bridge and analysis intake rules (`invalid_analysis_intake`, `invalid_analysis_file`, `analysis_source_mismatch`) |
| `app/ledger.py` | Ports of the n8n Ticket/Permit/Receipt/Restore helpers (`operationSlot`, `providerUsage`, `answerEnvelope`, …) |
| `app/budget.py` | Injectable budget client (`BudgetClient` protocol, `HttpBudgetClient`) |
| `app/pipeline.py` | The reserve → read → settle chain and hold rules |
| `app/idempotency.py` | Per-process duplicate guard |
| `app/readers/` | One module per node: `eye_03.py`, `second_count_05.py`, `room_06.py`, `conflict_09.py` |
| `app/prompts/` | Prompts copied verbatim from `analysis-reader-prompts-live.md` (`tools/extract_prompts.py`) |
| `app/providers/` | Provider interface, `FakeProvider` (tests), Gemini/Anthropic/OpenAI REST clients |
| `app/canonical.py` | JavaScript-compatible `JSON.stringify` and the site's `canonical` |

### Readers, models and providers

Same as the live n8n workflow and the site's `CALL_POLICY`:

| Node | Provider / model | Input | Output limit | Reservation bound |
| --- | --- | --- | --- | --- |
| 03 Eye reads the product photo | Google Gemini `models/gemini-3.8-flash` | product photo + prompt v3 | 16000 | 1048576 in / 16000 out |
| 05 Second count | Anthropic `claude-sonnet-5-5` | product photo + prompt | 1500 | 1048576 in / 1500 out |
| 06 Room reader (room photo only) | Google Gemini `models/gemini-3.8-flash` | room photo + prompt | 8000 | 1048576 in / 8000 out |
| 09 Conflict check | OpenAI `gpt-6-luna` (Responses API, `json_object`, `store:false`) | conflict ticket JSON + instructions | 2000 | 1050000 in / 2000 out |

The 09 message is built like n8n's "Prepare analysis conflict ticket": the raw
03/05/(06) answers as JSON strings, `instructions` from the payload, and empty
`conflicts`/`unknowns`.

## Environment variables (names only)

Required on Railway:

| Name | Meaning |
| --- | --- |
| `A7_ENGINE_AUTHORIZATION` | Value the site sends in `Authorization` (today the site sends its `A7_READ_AUTHORIZATION`) |
| `A7_BUDGET_AUTHORIZATION` | Value sent to the site's `/api/a7/budget/*` (the site compares it with its `A7_READ_AUTHORIZATION`) |
| `GEMINI_API_KEY` | Google AI key for 03 and 06 |
| `ANTHROPIC_API_KEY` | Anthropic key for 05 |
| `OPENAI_API_KEY` | OpenAI key for 09 |

Optional (defaults match n8n):

| Name | Default |
| --- | --- |
| `A7_BUDGET_ORIGINS` | `https://claude-final-midas-a7.netlify.app` (comma-separated `budgetOrigin` values allowed) |
| `A7_BUDGET_FALLBACK_ORIGIN` | `https://midas-a7-owner-preview.netlify.app` |
| `A7_BUDGET_TIMEOUT_S` | `20` |
| `A7_PROVIDER_TIMEOUT_S` | `120` (per call, also capped by the run deadline) |
| `A7_READER_RETRIES` / `A7_READER_RETRY_DELAY_S` | `1` / `5` |
| `A7_RUN_DEADLINE_S` | `295` (no new reservation after it; an open one is still settled) |
| `A7_MIN_STAGE_S` | `10` (no new reservation when less run time remains) |
| `A7_IDEMPOTENCY_TTL_S` | `3600` |
| `A7_ENGINE_AUTH_HEADER` | `authorization` |
| `A7_PROVIDER_MODE` | `live` (any other value serves `/health` only and refuses analysis) |
| `A7_GEMINI_BASE_URL`, `A7_ANTHROPIC_BASE_URL`, `A7_OPENAI_BASE_URL` | public API endpoints |

Missing required values make the webhook answer `503 {"error":"engine_not_configured"}`
before any budget or provider call. `/health` reports `configured: true|false`, never values.
No secret is logged or returned.

## How the site would switch (separate change, not in this branch)

Proposed change to `lib/a7-understanding-production.mjs` in `productionReader.run`:

```js
const base=(Netlify.env.get('A7_ANALYSIS_BASE_URL')||'https://ibrahimnewaeon.app.n8n.cloud').replace(/\/+$/,'');
response=await fetch(base+'/webhook/a7/owner-analyze',{method:'POST',headers:{Authorization:auth},body:form,redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
```

* Unset (default): n8n, exactly as today.
* Set on one site (e.g. `claude-final-midas-a7`) to the Railway URL: that site uses the engine.
* Rollback: unset the variable and redeploy the site. Nothing else changes; ledger rows from
  either engine are read the same way, and a draft already read by one engine cannot be paid
  again by the other (same operation keys, see "Idempotency" below).

`A7_READ_AUTHORIZATION` stays the header value, so `A7_ENGINE_AUTHORIZATION` on Railway is set to
the same value. Budget calls go back to the site named in `budgetOrigin` when it is on
`A7_BUDGET_ORIGINS`, otherwise to the owner-preview ledger, like n8n.

## Railway deploy (owner steps)

1. Railway → New project → Deploy from GitHub repo → this repository, branch to deploy.
2. Service settings → Source → Root Directory: `services/a7-engine`. If the config file is not
   picked up, set Config-as-code path to `services/a7-engine/railway.json`. It builds the
   `Dockerfile` (Python 3.12, uvicorn, one worker) with health check `/health`.
3. Variables: set the five required names above (paste values in Railway; do not commit them).
4. Keep one replica (the duplicate guard is in memory; the site's ledger is the hard guard).
5. Settings → Networking → Generate domain. Open `https://<domain>/health`; expect
   `{"status":"ok","configured":true,...}`.
6. Only then, in a separate site change, set `A7_ANALYSIS_BASE_URL=https://<domain>` on one site.

## Idempotency and holds

* Every reader's operation key depends only on the draft and node (slot with output `job`,
  counters 0), so the ledger refuses a second reservation for the same draft
  (`operation_already_exists` → hold). A changed request in the same slot gets
  `operation_conflict` → hold. Nothing is paid twice.
* In memory: the same `requestId` while running waits for that run; after success it is
  answered again with no budget or provider call. Another request for a running draft holds.
* A run that the caller abandons (gateway timeout, disconnect) keeps running and settles.
* Provider failure after the retry is settled with `usage: null` (the reservation stays as
  `uncertain`), and the run holds. Nothing is resent automatically.

## Tests

```
cd services/a7-engine
python -m pip install -r requirements-dev.txt
python -m pytest -q
```

No test reaches the network. `tests/fakes.py` ports the site's reserve/settle and
`normalizeAnswer`; `tests/site_contract.py` ports `verifiedAnalysisAnswers` and
`observationFromVerifiedAnswers`. `tests/test_site_crosscheck.py` also runs the site's
real JavaScript (`quoteSourceAnalysis`, `analysisIntent`, `quoteCall`, `normalizeAnswer`,
`verifiedAnalysisAnswers`, `observationFromVerifiedAnswers`, `analysisReceipt`, `canonical`)
on exactly what the engine sent and answered; it is skipped when Node is missing. CI:
`.github/workflows/a7-engine.yml`.

## Parity checklist: not yet ported or not verified

Not ported (outside the analysis-only path):

- [ ] Fallback readers (03b Eye fallback, 06b Room fallback, 16xb Blind count fallback) and the
      reader recovery / replacement / blind / package / source-continuation budget actions.
- [ ] The main A7 workflow (11 planning onwards, Go 1/Go 2, generation, review), the status/history
      read bridge and the owner actions bridge.

Ported but not verified against live systems (this stage made no network calls):

- [ ] Real provider calls. Request shapes follow each public REST API; they were not compared with
      what n8n's Gemini, Anthropic and OpenAI nodes send (part order, default generation settings,
      Gemini thinking defaults, OpenAI message format). Model availability under these IDs on the
      owner's accounts is not checked.
- [ ] Shape of n8n node outputs. The engine uses each provider's raw REST answer; n8n's node output
      with `simplify: false` may differ (for example a `response` wrapper). The site accepts both,
      but the 09 conflict ticket embeds these answers as strings, so its exact text can differ.
- [ ] Byte-exact `requestSha256` parity with n8n. The engine hashes the same structure (n8n
      parameters, intake state, `files0…` binary keys). Not compared with a live n8n execution; a
      mismatch only makes the ledger answer `operation_conflict` (a hold) for a draft started on
      the other engine, never a second payment. Operation keys match by construction.
- [ ] The real budget API end to end (only the fake port and the site's JavaScript functions were run).
- [ ] Error statuses. n8n answers intake failures with a generic error (bridge) or 409
      `analysis_outcome_uncertain` (analysis side); the engine answers 400 with the specific code
      (`invalid_analysis_intake`, `invalid_analysis_file`, `analysis_source_mismatch`). The site treats
      both as a stopped, non-pending reading.
- [ ] Retry timing. n8n's node-level retry (once, 5 s) is approximated; the run deadline is 295 s
      against n8n's 300 s instance maximum and the bridge's 295 s wait.
- [ ] Railway proxy request duration for a ~5 minute request; the site's background reader waits 170–305 s.
- [ ] `budgetLimitUsd` is capped at 5 as in n8n intake, while the site allows job ceilings up to 10.
