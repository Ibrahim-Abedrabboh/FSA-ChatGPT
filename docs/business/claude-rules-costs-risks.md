# Rules, costs and risks

*Business documentation · status as of 22 Oct 2026 (checked against commit `b286045`)*

## Rules the studio always follows

These are owner decisions. The software is built to keep them.

1. **You approve twice:** the plan (Go 1) and the image (Go 2). Nothing is released without your Go 2.
2. **No guessing.** If a photo doesn't show a part clearly, the job stops and asks for a better photo.
3. **Midas pieces only.** Room scenes use Midas accessories that are in stock now, with pre-order excluded.
4. **Fixed sizes.** The catalogue image is 1125×1125, made from a larger master without AI resizing.
5. **At most two repairs per image,** each one ordered by you, then the job holds.
6. **Sizes read from photos are estimates.** They are never shown as fact.
7. **Customers see plain words:** "Generated image", "Approved by the studio". They never see tool or vendor names, promised delivery times or sizes.
8. **No secrets in files.** Keys are set only by you, in the service settings.

## Costs and spending controls

- **Every paid step reserves money first** on the owner site's budget ledger. If the money cannot be reserved, the step does not run.
- **Unclear outcomes count as spent and are never retried,** so nothing is paid twice by accident.
- **Limits:**
  - each job has a ceiling between USD 0.25 and 10.00;
  - at most 20 image calls per day;
  - each test run has its own cap that you set (for example USD 3.00, stop and report at USD 2.40).
- **Emergency off switches** on the owner site stop all spending (`A7_PAID_BUDGET_GUARDS_READY`) or all owner actions (`A7_OWNER_ACTIONS_ENABLED`).
- **Example cost.** The full run on 20 Oct cost about USD 0.164: USD 0.063 for the image and USD 0.101 for reading and checks. These are estimates from usage, not invoices.

## Risks

| Risk | Impact | What is in place or planned |
|---|---|---|
| Image drifts from the real product (shape, colour, framing) | Wrong product shown to customers | Automatic check plus your Go 2; at most two repairs; "Approved" only from you |
| New engine not proven on a paid run | Jobs may stop on the preview site | Supervised USD 3 run after the Anthropic fix; rollback to n8n is one setting |
| Access key visible in old n8n run records | Security exposure | Delete those runs and rotate the key (needs your approval) |
| Duplicate and inconsistent owner screens | Wrong screen used, slower work | Choose one flow, retire the rest, one shared design |
| Tests drift without anyone noticing | Broken behaviour shipped | Since 21 Oct (PR #79) every suite runs automatically; a Claude Code guard holds commits until they pass |
| Small catalogue (428 of about 2,082) | Fewer styling options | Turn on the weekly refresh |
| No business baseline (volume, cost per image by hand, time saved) | Value can't be shown | Agree a baseline before scaling |
