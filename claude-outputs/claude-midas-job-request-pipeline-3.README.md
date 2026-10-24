# Claude · Midas job request pipeline 3

Written by Claude on 5 October 2026. Status: built and saved in n8n, **not published**, **no real (paid) run made yet**.

- n8n workflow: `Claude · Midas job request pipeline 3`, id `LCkfLFMQS5MjA5FQ`, 88 nodes
- Run log table: `Claude job runs v3`, id `wkl4qUWacp3CcDsZ`
- Form: `claude-outputs/claude-midas-job-request-3.html`
- Version 2 (`lApASRrOG1EVoQi6`) and its table were not changed.

## What version 3 adds to version 2

| Area in the project documents | Version 3 |
| --- | --- |
| Handedness | The Eye records sided parts (for example "chaise on the left"). The plan check, the reviewer and the auditor each fail a mirrored product. Other white views are also compared with the master for mirroring. |
| White first | Image 1 of every job is a white catalogue master: front, level, square. Its plan is fixed in code and cannot be changed by the stylist or the owner. |
| Lifestyle from the white master | Lifestyle images and other white views are rendered only after the master passes, with the master attached as a second reference. If the master never passes, they are not made. |
| Input routes W1 to W5 | The Eye names the kind of vendor file. Each kind adds its own rule to the prompts. W5 (drawing, specification, partial view) marks every image as a concept. |
| Cost approval and steering | After the plan is checked, the run stops and waits up to 24 hours. The plan and the count of paid calls to come are shown. The owner can change a scene, leave an image out, give a go, or stop. The form can ask for a run without this stop. |
| Batch | A batch address takes up to 10 product photos and starts one run for each. |
| 1125 x 1125 delivery | Each passed image gets a 1125 x 1125 JPEG. Other shapes are padded with white, never stretched or cropped. |
| Scoring per gate | Each image reports seven review gates plus a final-file gate, three scores, and a sentence explaining the score against the 90 to 95 target. |
| Login | The five addresses are set to header authentication. No credential is attached yet. |

## Addresses (live only after publishing)

| Purpose | Method | Path |
| --- | --- | --- |
| Send a job | POST | `/webhook/claude-midas-studio-3` |
| Send a batch | POST | `/webhook/claude-midas-studio-3-batch` |
| Ask for the plan or the result | GET | `/webhook/claude-midas-studio-3-status?id=` |
| Go, stop, accept, ask for changes, reject | POST | `/webhook/claude-midas-studio-3-decision` |
| Download a 1125 x 1125 file | GET | `/webhook/claude-midas-studio-3-file?id=&shot=` |

## Before the first real run

1. In n8n, create a credential of type **Header Auth**. Choose a header name (the form expects `X-Midas-Key` unless you change it) and a long random value.
2. Open the workflow and select that credential on the five webhook nodes: `Job request webhook`, `Job status webhook`, `Owner decision webhook`, `Batch request webhook`, `File webhook`.
3. Publish the workflow.
4. Open the form, open **Connection settings**, and enter the header name and the key. The form keeps the key in memory only.

## What was checked, and how

| Check | Result |
| --- | --- |
| Local mock runner over the real workflow file, no network: 10 scenarios, 48 assertions (lifestyle, white views, website package, go with changes, stop, 24-hour timeout, W5 concept, master that never passes, failed image call, unusable job, status, decision, file, batch) | 48 passed |
| n8n test runs with every paid node replaced by fixed test data: executions 83 to 87 | 5 succeeded |
| The real n8n image steps on test images: 40 x 50 became 900 x 1125 placed on a 1125 x 1125 canvas; file measured at 1125 x 1125 | measured by n8n, pixels not viewed |
| Form in a headless browser against a mocked server: 18 assertions (plan, go with changes, results, download, batch, reopen, key only in a header, nothing stored) | 18 passed |

## Not checked

- **No real run.** No real photo was read and no real image was made, so the handedness check, the W1 to W5 reading, the master-first quality gain and the scores are untested on real products.
- The real wait-and-resume step. In the test the wait was replaced by a fixed answer.
- The batch step starting real runs of the same workflow.
- The live addresses: the key check, and whether a browser may send the key header from another site.
- The fidelity target of 90 to 95 is not shown to be met. Scores are model judgements, not measurements.

## Limits

- The full-size master is not stored. It stays at fal.ai, and its link stops working after a while. The 1125 file is made again from that link each time it is asked for. A lasting store needs a storage credential, which this n8n account does not have.
- Reading the photo, the plan and the plan check are paid calls made before the stop. Only the image calls, reviews, audits and inspections wait for the go.
- Job type Edit and a look reference image are not built, as in version 2.
- A real acceptance rate needs owner decisions. The form records accept, ask for changes and reject in the run log.
- The run log holds three test rows (`test-pin-0001`, `test-pin-0002`). One carries an "accepted" marked as test data.

## Files

- `claude-midas-job-request-pipeline-3.workflow.json`: the workflow, importable in n8n.
- `claude-midas-job-request-pipeline-3.source.zip`: the code of each step, the build scripts and the tests.
