# n8n baseline (frozen production export)

Date: 20 Oct 2026. Read-only export; n8n untouched (only get/search/read calls were made; nothing was updated, executed, published or archived).

This folder freezes the production n8n workflows, the data-table schemas they use, and three reference tables (configuration the pipeline needs; no run history).

## Workflows

One file per workflow, `<workflowId>.json`, with exactly these keys taken verbatim from the n8n workflow object: `id, name, versionId, activeVersionId, active, settings, nodes, connections`. Dropped: pinData, staticData, shared, meta, tags, scopes and everything else. Credentials appear only as `{id, name}` references; no secret values are stored.

| id | name | active | versionId | activeVersionId | nodes | sha256 |
|---|---|---|---|---|---|---|
| 1cgZc9rmBOrPdKIe | Claude · Midas A7 (stages 01–07) | true | 4669b0d7-fc52-4b76-94a7-63fd52a0ae58 | 4669b0d7-fc52-4b76-94a7-63fd52a0ae58 | 362 | 0c132239a154901d378a3b396b6897c15037717a41701957ed1b6802f20bbb61 |
| Mo9c5GmTcx0K79F7 | A7 · Owner submission and approval bridge | true | b41c6e1d-ad38-403a-939c-dd4802f7cd06 | b41c6e1d-ad38-403a-939c-dd4802f7cd06 | 14 | 405387bf24b65ecca97cad66d2f2bdb1dac4cd4fbabf329088414162d6e7ec2e |
| G4cLxmwbkCxmCbQF | A7 · Owner status and history (read only) | true | ba566aef-6402-4400-b5ee-509c25afa8e1 | ba566aef-6402-4400-b5ee-509c25afa8e1 | 6 | 70cca2010f686427739316f40699bc2546f4f75e44637c03a84ba41b2eca85ac |
| AOTL7OVYtXLLs1L1 | A7 · Owner source analysis bridge | true | f2d2a5cc-363d-4f57-a145-e8e2a896bc63 | f2d2a5cc-363d-4f57-a145-e8e2a896bc63 | 5 | f614d73574a70459802a8f113bcb975baf7961876e8cd1118a5dbf368f0ab7bd |
| AMdtt1fFwHln4DB8 | A7 · Source analysis only | true | eabd2f38-3e47-416a-8ed6-c9efc81429f7 | eabd2f38-3e47-416a-8ed6-c9efc81429f7 | 46 | 0342211591b54fc4efc7725148c66ef0b2b305d5f45e98651e2e734b62ce31df |
| jYkKQ2NOreSG0t97 | A7 · Model tests per stage (owner page) | true | d6a59452-b4f8-4e9e-a718-3830610a31f0 | d6a59452-b4f8-4e9e-a718-3830610a31f0 | 13 | 8a81aac9fded423692f8a27c0f4f5aa36025c2dc13fc7d77a48b48483f58d09f |
| mGgKxO0638I77meF | Claude · Midas catalogue refresh | false | 040930df-bf70-42eb-a404-49cd92b04b6a | null | 19 | 0777cb83c1c0ba8c69654255380205e5cd9c97fbba01ee4be7f222ef23ccf83b |

Note: `mGgKxO0638I77meF` (Catalogue refresh) is an unpublished draft (`active: false`, `activeVersionId: null`).

## Data tables

`data-tables.json`: `{"tables":[{id,name,columns:[{name,type}]}]}` for the 7 data tables used by `dataTable` nodes in these workflows (l0roUCBwIQL3h9Eq runs, Tyn4UT6BmIYMHAYl vault, lwJbRv4TVqlFTILl catalogue, AgXKkFbIj5dQAnvn handling profiles v2, eso9cF84jXYIGu5S model registry, cw86pzlOSjKSrU01 operations, OpszBn1IWmYzWftI identity). Columns are in n8n column order (the `index` field; the API lists them alphabetically). n8n system columns `id`, `createdAt`, `updatedAt` are NOT listed in the schema; every row carries them.

| file | sha256 |
|---|---|
| data-tables.json | f98fc7fc234f6ac1c06c87ae43a24dfa30508ade15cf1b3b619a06ddf8c451e5 |

## Seeds (reference data)

`seeds/<tableId>.json`: `{"table_id","name","rows":[...]}` with rows exactly as returned by n8n (id, createdAt, updatedAt kept), ordered by id.

| file | table | rows | sha256 |
|---|---|---|---|
| seeds/eso9cF84jXYIGu5S.json | Claude Midas A7 model registry | 2 | dd766b824985dd616e875db9f02fa7cf47d15613d095c6770d145b90a6754c91 |
| seeds/AgXKkFbIj5dQAnvn.json | Claude Midas A7 handling profiles v2 | 44 | d0754b67a405ac88004ab298226f016db4a4ef0f14b7c67c01eb140d1a758df0 |
| seeds/lwJbRv4TVqlFTILl.json | Claude Midas A7 catalogue | 428 | 662ef89a1e91bdca224ed48efbf02716dfa86ea7b946779028ad76e28d10da4c |

Runs, vault, operations and identity tables were deliberately not exported.
