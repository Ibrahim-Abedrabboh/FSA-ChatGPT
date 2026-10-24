# Midas Studio project review

Business-stakeholder review of Midas Studio (the A7 workflow, the owner web app and the n8n automations). First version 20 Oct 2026.

- **Shareable private page:** https://claude.ai/artifact/ESRAtn2oxkHMVuEXtUKa3E (private; share it from the page's Share menu).
- **Source of the page:** `claude-midas-studio-review.html` in this folder. Republish to the same link by passing that URL as `url` to the Artifact tool.
- **Diagrams:** `claude-midas-studio-review-diagrams.md` (Mermaid; renders on GitHub).

The owner confirmed on 20 Oct 2026 that Midas Studio, Midas VTON, Midas Styling, Midas furniture styling and the Midas A7 workflow are one app, "Midas Studio". The Midas-AI-Chatbot repo and the Midas ad dashboard are separate projects.

## Keeping the page current (to-do for each update)

The owner asked for the page to be updated often after approval. On each update:

1. Re-read the live state:
   - **n8n:** A7 `1cgZc9rmBOrPdKIe` published versus saved version; the bridges; the A7 runs table `l0roUCBwIQL3h9Eq`.
   - **Netlify:** the current deploy of `midas-a7-owner-preview` and `claude-final-midas-a7`.
   - **GitHub:** pull requests merged since the last update, and CI on `main`.
2. Update the summary table, section 6 (outcomes), section 7 (checks) and section 8 (next actions). Move finished actions into the update log.
3. Add one row to the update log with the date and what changed.
4. Republish to the same link and commit the HTML here.

## Open items at version 1

- [ ] Rotate the `X-Midas-Key` value and remove stored n8n records that contain it; switch off pipeline 3 (`LCkfLFMQS5MjA5FQ`) and the white clean-up (`MSU2K5WKKfizCapW`); retire the A6 site (needs the owner's approval).
- [x] Publish the A7 package fix `5d280fcb` after a free test: published 20 Oct.
- [ ] Check Google usage for run `claude-a7-34b37efe` and for the two uncertain 18 Oct calls.
- [x] Bring branch `final` (PR #40) into `main`: merged into this PR on 20 Oct. The six page-3 conflicts keep `main`'s copies (draft 3 was connected as the owner studio; `final`'s variant is superseded); everything else comes from `final`.
- [ ] Choose one owner site; `claude-final-midas-a7` is 7 owner-app commits behind `main`.
- [ ] Bounded scene test, one real repair and the 7 edit checks (each needs the owner's go).
- [ ] Scenes from an approved white image (PR #61): publish A7 `ac36ba31` and the bridge's latest saved version in n8n (the owner presses Publish), merge PR #61 so the site gets the new button and migration, then run the bounded scene test with a USD 3 job budget.
