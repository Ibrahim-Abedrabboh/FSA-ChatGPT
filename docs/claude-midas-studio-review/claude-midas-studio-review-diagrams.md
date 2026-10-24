# Midas Studio review: diagrams

The diagrams used in the review page (20 Oct 2026). Green means proven on real jobs, amber means proven once with manual help, red means never proven live.

## How the names relate in time

```mermaid
flowchart LR
  E["Hero-shot experiments<br/>1–4 Oct"] --> P["Studio and job-request<br/>pipelines A to 5<br/>4–5 Oct"]
  P --> V["Midas VTON<br/>Option A to A6<br/>6–14 Oct"]
  V --> A7["Midas A7 workflow<br/>14 Oct onwards"]
  A7 --> OW["Owner workspace<br/>web app, 17 Oct onwards"]
  A7 --> SAT["Support workflows<br/>analysis, bridges, tests,<br/>catalogue refresh"]
  OW --> MS(["Midas Studio<br/>(one app)"])
  SAT --> MS
```

## How the parts connect

```mermaid
flowchart TB
  O(["Owner"]) --> W["Owner web app<br/>(Netlify)"]
  W -- "jobs and approvals" --> B["Bridges<br/>(n8n)"]
  B --> A["A7 engine<br/>(n8n)"]
  A -- "reserve budget / report cost" --> W
  A --> AI["AI services<br/>Google, Anthropic, OpenAI"]
  A --> T[("Job records<br/>and catalogue")]
  A --> D[("Google Drive<br/>images")]
  A -- "live stock check" --> M["Midas website"]
  W -- "status and history" --> T
```

## The product image journey

```mermaid
flowchart TB
  S["1 Send photos and brief"] --> R["2 Read the photos<br/>AI reads and counts pieces"]
  R --> C["3 Contract<br/>what must not change"]
  C --> P["4 Styling plan<br/>in-stock Midas accessories"]
  P --> G1{"Go 1<br/>owner approves plan"}
  G1 -- "go" --> I["5 Make white master<br/>(paid image call)"]
  G1 -- "change / stop" --> P
  I --> RV["6 Automatic review<br/>16 checks against the photo"]
  RV --> G2{"Go 2<br/>owner decides"}
  G2 -- "repair (max 2)" --> I
  G2 -- "approve" --> PK["7 Package<br/>JPG + WebP + manifest, no AI"]
  G2 -- "stop" --> X(["Stopped"])
  PK --> SC["8 Room scenes<br/>empty room, place product"]
  SC --> G3{"Go 2 per scene"}
  G3 -- "approve" --> DL(["Delivery files"])
  classDef proven fill:#E7EFE9,stroke:#2F5D45,color:#242620;
  classDef partial fill:#F4ECDA,stroke:#7A5A16,color:#242620;
  classDef notyet fill:#F5E4E1,stroke:#9A3328,color:#242620;
  class S,R,C,P,G1,I,RV,G2 proven;
  class PK partial;
  class SC,G3,DL notyet;
```

## How a paid call is guarded

```mermaid
flowchart LR
  Q["Engine needs a paid call"] --> RS{"Budget reserved<br/>on the web app?"}
  RS -- "no" --> H(["Hold, nothing paid"])
  RS -- "yes" --> CALL["Call the AI service"]
  CALL --> OK{"Answer received?"}
  OK -- "yes" --> REP["Report actual cost"]
  OK -- "unclear" --> KEEP(["Keep full reservation<br/>never resend automatically"])
```
