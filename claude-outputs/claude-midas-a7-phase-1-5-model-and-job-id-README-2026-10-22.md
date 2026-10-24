# Midas A7, Phase 1.5: the image model from the registry; job ids refused at intake (22 Oct 2026)

Written by Claude for the owner. You said "go, start 1.3 and 1.5" on 22 Oct. This changes flow behaviour on the Python service, so it waits for your review and merge. Nothing is deployed. The owner site `claude-final-midas-a7` still calls n8n, where nothing changes.

## What it fixes
- **FL-12.** The image step's budget ticket had `gemini-nano-banana-2.1` written in. Approving any other model in the model registry crashed the run there.
- **FL-2.** A job whose id was not `owner-<id>` (for example from the client page) was accepted, then crashed at its first paid step.

## What changes
- **The model comes from the registry.** The budget ticket now uses the model that step 14 picked: the approved registry row, already checked there for frames, sizes, reference limit and a dated price. The request must name that same model. The ledger reservation names it too, so the ledger prices it or refuses it.
- **Unsupported job ids are refused at intake** with the reason "Only jobs sent from the owner site can start…". This happens before anything is started or paid. This is the option the design recommended. Client-page jobs stay unsupported until that page has a place to receive results.

## What it does not do
- **It does not make a second model usable on its own.** The owner site's budget ledger (`lib/a7-budget.mjs`) still allows exactly one model for the image step: its call policy for `15g Send to Google` names only `gemini-nano-banana-2.1`, and it has a price for only that model.
  - To use another model, two things are needed: approve its registry row with complete data, and change the ledger. The ledger change has three parts: the image step's policy must accept a list of models, the new model needs a dated price, and that price must use the token limits the ticket reserves (131,072 in, 32,768 out). The ledger is a site change and needs your go.
  - Until both are done, the reservation is refused and the run holds before any call, with the general budget message ("No valid spending permission was received"). Before this PR it crashed. This refusal is checked by reading the ledger code only: the test harness's stand-in ledger grants every reservation.
- The other `Budget_*` tickets and the analysis and model-test flows are unchanged.

## Review
An independent read-only review found these points, all checked against the code:
- **Fixed:** a registry row marked "Approved" with a capital A would have stopped the run at the ticket. Step 14 accepts any case, so the ticket now reads the status the same way. A test covers it.
- **Fixed:** the docs said "add its price". The ledger's image-step policy also allows only one model and fixed token limits, so the docs now name all three parts of the ledger change.
- **Fixed:** the docs now say the change is on the Python service only.
- **Noted, not changed:** the hold for an unpriced model uses the general budget message, and the harness does not test a real ledger refusal.

## Verified (22 Oct 2026, dev container, mocked; no paid call)
- New `tests/py/test_claude_phase1_5.py` (5 tests, all pass; the fifth checks an "Approved" status in any case):
  - the default model is unchanged in the request and the reservation;
  - a second approved model (made complete in the test) is used for the call and the reservation;
  - with no approved model the run holds before any image call;
  - a `client-…` job is refused at intake with the reason, with no reservation and no paid call.
- In `tests/py/test_claude_phase1_baseline.py`, the FL-2 "today" test is replaced by a test of the refusal, and its expected-failure marker is removed.
- `python -m pytest -q`: 253 passed, 2 skipped, 4 xfailed (after the review fixes). The run 1591 replay is unchanged.
- ruff 0.8.4 clean; `midas-a7 check` reports all node types handled; regenerating the flows gives no diff; all 21 A7 suite steps pass.

## What you do
Review and merge, then deploy when no run is active.
