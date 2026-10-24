# Owner page fixes from the 22 Oct paid run

*22 Oct 2026 · branch `Claude-final-midas-a7-site-fixes` · approved by the owner ("go with the order", 22 Oct 2026) · site only: nothing under `src/` changed*

During the supervised paid run on 22 Oct (`ff0aa7e5`), the owner hit three problems on the owner page. The run report describes them in sections 4.1 and 4.4: `claude-outputs/claude-midas-a7-run-reports/claude-midas-a7-supervised-run-ff0aa7e5-2026-10-22.md`. This change fixes all three, and the cosmetic double message from 4.1 item 3.

## 1. "Get estimate" stayed switched off after any edit

**What happened.**
- Any typing in the new-case form switched off "6. Get estimate", including a budget change.
- Only a save switched it back on, and the page did not say so clearly.
- The checklist told the owner to set the budget after saving, so the button stayed off.

**What changed.** An edit still throws away the old estimate, and "7. Send" stays off until there is a new one. But "6. Get estimate" stays on. When it is pressed:
- **If the form differs from the saved version,** the page says: "Your changes are not saved yet. Press 5. Save all details first, then 6. Get estimate." No estimate is asked for.
- **If the change was undone,** so the form matches the saved version again, a new estimate of the saved version is fetched without saving again. This holds for most fields. After a first change to a preference it still asks you to save, which errs on the safe side.
- **Every save records the form**, including "1. Save the photos". So an estimate never quotes a saved budget that differs from the one on screen.

The page also says this under the button as soon as something is changed.

**Why this behaviour.** The server makes the estimate from the saved version. It ties the estimate to that version's fingerprint, keeps it valid for 15 minutes, and sending needs the confirmation dialog. None of that changes. Estimating an unsaved budget would show a price for something that would not be sent. So the page asks for a save instead of estimating. No dead end remains: the button always answers, and after a save it works at once.

## 2. A saved version opened with a locked field that could not be saved

**What happened.**
- The owner reopened an earlier saved version (`GEN-2610-31`).
- Its pieces read "Four Seater Arm Sofa.", with no quantity.
- The page locked the product type and pieces, and "5. Save all details" refused the pieces. The field could not be corrected.

**Why the page locks.** A reopened version is an edit. Its product facts were confirmed, and for a sent version they belong to a job that already ran. Locking keeps an edit from quietly changing them. That reason stays.

**What changed.** On opening, the page checks the saved pieces and budget with the same rules as saving:
- **The version was never sent (and is not an edit of an approved image):** the fields are unlocked, and the page names the value to correct. Saving updates the same version and keeps its photo check. Nothing is paid.
- **The version was sent, or is an edit of an approved image:** only the refused field is unlocked. Everything else stays locked. The correction goes into the new version that the edit saves. The sent version stays exactly as recorded.
- **Valid versions:** they still open locked, as before.

## 3. Go 2 wording on a held job with no choices

**What happened.** After the package held, the job's approval record still carried the old Go 2 ticket text ("go 2: approve…"), with no choices allowed. The owner read it as "scene Go 2 ready".

**What changed.** On `/owner/` and `/owner/controls/` (and the retired studio and client pages' source), the decision text is shown only while a decision can actually be sent:
- A held job now shows "On hold:" with its recorded reason, and no decision buttons.
- A ticket that allows nothing shows only that it can no longer be answered.

## 4. The same message shown twice (report 4.1 item 3)

An answer shown beside a button was also shown in the status line at the top of the panel. That line is now hidden while the same answer shows beside the button.

## Verified

| Check | Result |
|---|---|
| `npm test` (owner workspace) | 409 tests: 408 pass, 0 fail, 1 skipped (398 tests before; 11 added) |
| New tests against the old page code | 8 of the 10 new tests fail on the old `start-connected.js` / `owner-actions.js`. The other 2 guard behaviour that must not change: a valid sent version stays locked, and an open Go 2 ticket still shows its wording and buttons |
| `npm run build` | exit 0 |
| `python -m pytest -q tests/py -k owner` | 8 passed, 252 deselected |
| Every `node` / `python3` step in `.github/workflows/a7-guidance.yml` | 21 of 21 pass |

The new tests are in `tests/start-connected-browser-flow.test.mjs` (7) and `tests/owner-actions-browser-flow.test.mjs` (3). They use the existing mocked page harness. No paid call was made.

## Review
An independent read-only review confirmed the server-side safety is unchanged: the estimate is bound to the saved version, it expires after 15 minutes, sending still needs your confirmation, and the send gate is untouched. It found four points, all checked and fixed:
1. A save of the photos only did not record the form. After it, undoing a budget change could fetch an estimate of a different saved budget than the one on screen. Fixed, with a test that fails without the fix. The check now also treats an unrecorded form as changed.
2. The form comparison left out the notes. Added. The "undone change" wording above is made exact.
3. The retired client page could still show decision text with no choices. Guarded.
4. The page accepted up to 999 pieces per line, but the server accepts up to 199, so a refused saved line could stay locked. The page now uses the server's limit.

Also noted: correcting a version that was already sent also needs "what to change" and "what to keep" filled in, as for any edit.

## Not verified

- **No browser test.** The tests run the page code in Node with mocked elements. No real browser, phone or screen reader was used.
- **Which element the owner read.** It is not proven which element showed the old Go 2 text on 22 Oct. The cause is confirmed: the approval record of a held run still holds the last Go 2 ticket's text. Every place that shows that text is now guarded.
- **The retired studio page.** The guard in `studio/app.js` has no test. That page is no longer published.
- **The comparison for "unchanged".** It reads the form fields, notes, edit texts and photos. A change it misses could at worst estimate the saved version, which is the version that would be sent. It could never send unsaved values.

## What the owner does

1. Review and merge the draft PR for this branch.
2. After the merge, Netlify builds the preview site `midas-a7-owner-preview` from `main`. Publishing it, or the `claude-final-midas-a7` site, is your step.
3. Optional: on the preview site, open a saved draft, change the budget, press "6. Get estimate" and read the message.
