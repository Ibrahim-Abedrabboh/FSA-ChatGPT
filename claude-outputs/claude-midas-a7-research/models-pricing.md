# Models and pricing research for the Midas image pipeline

Date checked: 2026-10-14 (all pages read on this date, public pages only, no sign-up, no paid calls).
Method: raw pages fetched and read directly (Google, OpenAI, Anthropic and fal.ai docs). Where a page showed an "updated" date it is given. fal.ai pages show no publication or update date.
Labels used: VERIFIED = read on the primary page. INFERENCE = my calculation or judgement from verified facts. NOT VERIFIED = could not confirm.

## 0. Things that change what you do (read first)

1. VERIFIED. "gemini-nano-banana-2.1" is an exact, official model id. But the official product name is "Gemini Nano Banana 2.1" (also "Nano Banana 2.1"), not "Nano Banana Pro 2.1". It is the Flash-tier, "more efficient counterpart" to Nano Banana Pro. Nano Banana Pro is a different model (`gemini-3-pro-image`). There is no "Pro 2.1". Tell the client the name differs.
   - Source: https://ai.google.dev/gemini-api/docs/models/gemini-nano-banana-2.1 (page "Last updated 2026-10-06 UTC"); https://ai.google.dev/gemini-api/docs/image-generation (Last updated 2026-10-09).
2. VERIFIED. OpenAI announced on 2026-10-14 (today) that gpt-4o, gpt-4o-mini, gpt-4.1 and gpt-4.1-mini are removed from the API on 2027-01-14. Recommended replacement per OpenAI: gpt-6-luna. The pipeline's gpt-4.1 and gpt-4o steps need a migration plan.
   - Source: https://developers.openai.com/api/docs/deprecations (section "2026-10-14: GPT-4 series model deprecations").
3. VERIFIED. Google marked `gemini-3.1-flash-image` (Nano Banana 2) as deprecated on 2026-10-06 (no shutdown date). Google says use `gemini-nano-banana-2.1` for new projects.
   - Source: https://ai.google.dev/gemini-api/docs/changelog (entry "October 6, 2026").
4. VERIFIED. Gemini image models (2.1, 3.1 Flash Image, 3 Pro Image) do not support structured output or function calling. They are image generators only.
5. VERIFIED. All three vendors (OpenAI, Anthropic, Google) say in their own docs that object counting is approximate. Only Google documents a grounding output format (bounding boxes and points). See section 5.
6. Price changes already scheduled: Gemini 3.8 Flash / 3.6 Flash prices double on 2027-01-01; Gemini 4 Argon prices double on 2026-12-01. See section 4.

## 1. Question 1: Nano Banana "2.1"

### 1.1 Exact ids found

| Product name (official) | Provider | Exact id | Status | Release | Source | Checked |
|---|---|---|---|---|---|---|
| Gemini Nano Banana 2.1 | Google Gemini API / AI Studio | `gemini-nano-banana-2.1` | Stable (GA) | 2026-10-06 | https://ai.google.dev/gemini-api/docs/changelog ; https://ai.google.dev/gemini-api/docs/models/gemini-nano-banana-2.1 | 2026-10-14 |
| Gemini Nano Banana 2.1 | Google Vertex AI (now "Gemini Enterprise Agent Platform") | `gemini-nano-banana-2.1` | GA, release date Oct 6, 2026, region: global only | 2026-10-06 | https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/nano-banana-2-1 (Last updated 2026-10-13) | 2026-10-14 |
| Nano Banana 2.1 Edit | fal.ai | `google/nano-banana-2.1/edit` (text-to-image sibling: `google/nano-banana-2.1`) | live endpoint | not shown on page | https://fal.ai/models/google/nano-banana-2.1/edit/llms.txt | 2026-10-14 |
| Nano Banana Pro (for comparison) | Google | `gemini-3-pro-image` | Stable | page says latest update Nov 2025 | https://ai.google.dev/gemini-api/docs/models/gemini-3-pro-image | 2026-10-14 |
| Nano Banana 2 (previous) | Google | `gemini-3.1-flash-image` | Stable but deprecated (no shutdown date) | Feb 2026 | changelog above | 2026-10-14 |
| Nano Banana 2 Lite | Google | `gemini-3.1-flash-lite-image` | Stable, 1K only | not checked | https://ai.google.dev/gemini-api/docs/image-generation | 2026-10-14 |

Notes:
- The fal playground URL `fal.ai/models/fal-ai/nano-banana-2.1/edit` loads a shell page, but `fal.ai/models/fal-ai/nano-banana-2.1/edit/llms.txt` returns 404. Use `google/nano-banana-2.1/edit` as the fal id. Whether the `fal-ai/` form also works as an API alias is NOT VERIFIED.
- Other sites list the id (LiteLLM blog dated 2026-10-06 shows `gemini/gemini-nano-banana-2.1` and `vertex_ai/gemini-nano-banana-2.1`; ZenMux, Eden AI, LLM Gateway, Haimaker came up in search). I did not read those pages in depth. NOT VERIFIED beyond the LiteLLM blog: https://docs.litellm.ai/blog/nano_banana_2_1
- Google says Nano Banana 2.1 is "an update to Nano Banana 2 (Gemini 3.1 Flash Image)" and "the more efficient counterpart to Gemini 3 Pro Image (Nano Banana Pro)". Google calls Nano Banana Pro "the premium choice for the most complex visual tasks ... accurate brand consistency". I found no official side-by-side quality benchmark of 2.1 against Pro for product fidelity. NOT VERIFIED which is better for exact product reproduction. Test it.

### 1.2 Capabilities of gemini-nano-banana-2.1 (Google docs)

| Item | Value | Source |
|---|---|---|
| Input types | Text, Image, Video, PDF | model page |
| Reference images | Up to 14 per request (up to 10 object-fidelity images and up to 4 characters) | model page; Vertex page "Maximum images per prompt: 14" |
| Output | Image and text | model page |
| Resolutions | 1K (default), 2K, 4K. No 0.5K on 2.1 | image-generation guide |
| Aspect ratios (Gemini API) | 1:1, 1:4, 1:8, 2:3, 3:2, 3:4, 4:1, 4:3, 4:5, 5:4, 8:1, 9:16, 16:9, 21:9 (Vertex also lists 9:21) | image-generation guide table; Vertex page |
| Example pixel sizes | 1:1 = 1024x1024 / 2048x2048 / 4096x4096. 16:9 = 1376x768 / 2752x1536 / 5504x3072 (1K/2K/4K) | image-generation guide table |
| Token limits | input 131,072; output 32,768 | model page |
| Thinking | Supported; levels minimal, medium (default), high | image-generation guide |
| Grounding | Google Web and Image Search. Not Maps. | model page |
| Structured outputs, function calling, code execution, URL context, caching | Not supported | model page; Vertex page |
| Consumption | Batch supported. Flex and Priority not supported. No free tier. | model page; pricing page |
| Vertex extras | Seed, temperature, topP, topK "Not supported". Input size limit 500 MB. Inline file max 7 MB, Cloud Storage file max 30 MB. Mime types png, jpeg, webp, heic, heif | Vertex page |
| API surface in docs | Google's examples use the Interactions API: `POST https://generativelanguage.googleapis.com/v1beta/interactions` with `response_format: {type:"image", aspect_ratio, image_size}`. Whether the older `generateContent` route also works for this model is NOT VERIFIED. | image-generation guide |

Caution, a Google docs inconsistency: the image-generation guide table lists 2520 tokens for 4K output of 2.1. The pricing page says 4K consumes 3780 tokens ($0.113). Billing follows the pricing page. Treat 3780 as the billed figure.

### 1.3 Price, Google direct (Standard tier, paid; page "Last updated 2026-10-14 UTC")

Source: https://ai.google.dev/gemini-api/docs/pricing

| Model | Id | Input per 1M | Output text/thinking per 1M | Output image per 1M | Per image 1K | 2K | 4K |
|---|---|---|---|---|---|---|---|
| Nano Banana 2.1 | `gemini-nano-banana-2.1` | $1.50 (text/image/video) | $7.50 | $30.00 | $0.0336 | $0.0504 | $0.113 |
| Nano Banana 2.1 Batch | same | $0.75 | $3.75 | $15.00 | $0.0168 | $0.0252 | $0.0567 |
| Nano Banana 2 | `gemini-3.1-flash-image` | $0.50 | $3.00 | $60.00 | $0.067 | $0.101 | $0.151 (0.5K $0.045) |
| Nano Banana 2 Lite | `gemini-3.1-flash-lite-image` | $0.25 | $1.50 | $30.00 | $0.0336 (1K only) | - | - |
| Nano Banana Pro | `gemini-3-pro-image` | $2.00 (text/image) | $12.00 | $120.00 | $0.134 | $0.134 | $0.24 |
| Nano Banana Pro Batch / Flex | same | $1.00 text; image $0.0006 per image | $6.00 | - | $0.067 | $0.067 | $0.12 |

Output tokens per image (pricing page): 2.1 uses 1120 / 1680 / 3780 tokens at 1K / 2K / 4K. Pro: input image is fixed at 560 tokens or $0.0011 per image (stated by Google).
Input image tokens for 2.1: Google's pricing page does not state a per-image figure. fal's page says "each input image is about 1,120 tokens" (fal statement, not Google's). INFERENCE: about $0.0017 per reference image at Google's $1.50 per 1M rate.
Thinking tokens are billed as output text ($7.50 per 1M for 2.1). Default thinking level is "medium". The extra cost per image is NOT VERIFIED (not quantified by Google).
Grounding with Google Search: 5,000 free requests per month (shared across Gemini 3 and newer), then $14 per 1,000.

### 1.4 Price, fal.ai (Nano Banana family)

| Model | fal id | Billing | 1K | 2K | 4K | Source |
|---|---|---|---|---|---|---|
| Nano Banana 2.1 edit | `google/nano-banana-2.1/edit` | tokens: $1.764 in, $8.823 out text, $35.294 out image per 1M | $0.040 text-to-image; $0.044 edit with two 1K inputs | $0.059; $0.063 | $0.134; $0.138 | https://fal.ai/models/google/nano-banana-2.1/edit (table on page) |
| Nano Banana Pro edit | `fal-ai/nano-banana-pro/edit` | flat per image | $0.15 | $0.15 | $0.30 ("4K outputs charged at double") | https://fal.ai/models/fal-ai/nano-banana-pro/edit/llms.txt ; https://fal.ai/pricing |
| Nano Banana 2 edit | `fal-ai/nano-banana-2/edit` | flat | $0.08 per image (per fal pricing table) | not stated | not stated | https://fal.ai/pricing |

- fal's own page says: "no flat per-image fees or surcharges for resolution, web search, or thinking" for 2.1. Each reference image adds about 1,120 input tokens (about $0.002 at fal's rate; fal says 14 refs add about $0.028). With `num_images` above 1, every image is a separate generation and the inputs are counted again.
- Pro on fal: web search adds $0.015 per request.
- INFERENCE: fal's 2.1 token rates are 1.176 times Google's ($1.764 / $1.50, $35.294 / $30, $8.823 / $7.50), about 17.6% above Google direct. fal Pro at $0.15 is about 12% above Google direct $0.134.
- fal 2.1 edit parameters (from the llms.txt page): `image_urls` (optional if video or PDF supplied; max count not stated on fal's schema, fal text says up to 14), `resolution` 1K/2K/4K, `aspect_ratio` auto plus 14 ratios, `thinking_level` minimal/medium/high, `num_images` 1-4, `seed`, `output_format`, `safety_tolerance`, `system_prompt`, `enable_web_search`, `limit_generations`.
- fal Pro edit parameters: `image_urls` required, `resolution` 1K/2K/4K, aspect ratios auto, 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16. fal text says combine up to 14 images and up to 5 people for consistency.

### 1.5 Cost comparison for one lifestyle image (2K, three reference images), INFERENCE

| Route | Approx. cost per image |
|---|---|
| fal Nano Banana Pro (current pipeline) | $0.15 flat |
| Google direct Pro | about $0.134 + 3 x $0.0011 = about $0.137 (plus thinking tokens, not quantified) |
| fal Nano Banana 2.1 | about $0.063 to $0.07 (fal's table gives $0.063 for 2K with two 1K inputs) |
| Google direct 2.1 | about $0.0504 + 3 x about $0.0017 = about $0.056 (plus thinking tokens) |

## 2. Question 2: fal.ai prices for the other pipeline models

| Model | fal id | Price | Notes | Source | Checked |
|---|---|---|---|---|---|
| Nano Banana Pro edit | `fal-ai/nano-banana-pro/edit` | $0.15 per image; 4K double ($0.30); web search +$0.015 | page says "Pricing may change in the future" | https://fal.ai/models/fal-ai/nano-banana-pro/edit/llms.txt ; https://fal.ai/pricing | 2026-10-14 |
| FLUX.2 [max] edit | `fal-ai/flux-2-max/edit` | first processed megapixel $0.07; each additional megapixel $0.03; input images count as processed megapixels | rounding rule for partial megapixels not stated. Output formats jpeg or png. Parameter `image_size`, `image_urls` required. | https://fal.ai/models/fal-ai/flux-2-max/edit/llms.txt | 2026-10-14 |
| BiRefNet v2 background removal | `fal-ai/birefnet/v2` | Page literally says "Your request will cost $0 per compute second" | NOT VERIFIED: a $0 price is probably a display placeholder. fal's pricing API needs an API key (returned 401), so I could not confirm. Treat the real price as unknown. | https://fal.ai/models/fal-ai/birefnet/v2 | 2026-10-14 |
| Bria RMBG 2.0 | `fal-ai/bria/background/remove` | $0.018 per image without a prompt; $0.03 per image with a prompt | commercially safe, trained on licensed data | https://fal.ai/models/fal-ai/bria/background/remove/llms.txt (page meta also says "$0.018/generation") | 2026-10-14 |

INFERENCE for FLUX.2 [max] edit at 2048x2048: output is 4.19 MP. With one 1 MP input image the total is about 5.2 MP, so roughly $0.07 + 4.2 x $0.03 = about $0.196. With three 1 MP inputs, about 7.2 MP, roughly $0.29. Exact billing depends on rounding that fal does not state.

Side note, seen on fal's pricing table (VERIFIED as listed, not researched): "Flux 3 Image" `blackforestlabs/flux-3/edit-image` at $0.024 per megapixel. Not evaluated.

### Storage and upload costs on fal.ai
- No upload or storage fee appears on the fal CDN, file-storage and media-expiration doc pages I read. NOT VERIFIED that none exists (absence of a price on those pages is not a guarantee).
- Retention facts (VERIFIED): request payloads (JSON) are stored 30 days by default; opt out with header `X-Fal-Store-IO: 0`. Generated media and uploaded inputs sit on the fal CDN as public URLs; lifetime is "configurable" with header `X-Fal-Object-Lifecycle-Preference: {"expiration_duration_seconds": N}`. The default media lifetime is not stated in the pages I read. Files on the Serverless `/data` volume are kept until deleted (that is a Serverless product, not needed here).
- Sources: https://fal.ai/docs/documentation/model-apis/media-expiration.md ; https://fal.ai/docs/documentation/model-apis/fal-cdn.md

## 3. Question 3: OpenAI models (Responses and Chat Completions API)

Pricing page: https://developers.openai.com/api/docs/pricing (no date shown on the page). Model pages: https://developers.openai.com/api/docs/models/<id>. Changelog: https://developers.openai.com/api/docs/changelog.
All prices are Standard tier, per 1M tokens, short context (up to 272K input tokens). Longer prompts: 2x input and cache rates and 1.5x output for the full request. Batch and Flex are 50% of Standard. Fast mode is 2x. Regional data residency adds 10%.

| Model | Exact id | Input | Cached input | Output | Released | Image input | Structured outputs | Notes |
|---|---|---|---|---|---|---|---|---|
| GPT-6 Astra | `gpt-6-astra` | $10.00 | $1.00 | $50.00 | 2026-09-03 | yes | yes | most capable; no `none` reasoning effort |
| GPT-6.1 Sol | `gpt-6.1-sol` | $2.00 | $0.10 | $10.00 | 2026-09-29 | yes | yes | "near-Astra performance at lower cost"; no `none` effort |
| GPT-6 Sol | `gpt-6-sol` | $2.00 | $0.20 | $10.00 | 2026-09-22 | yes | yes (per guide) | supports `none` effort |
| GPT-6 Luna | `gpt-6-luna` | $0.10 | $0.01 | $0.50 | 2026-09-22 | yes | yes | cheapest current; supports `none` effort; OpenAI's named replacement for gpt-4.1 and gpt-4o |
| GPT-5.6 Sol | `gpt-5.6-sol` | $4.00 | $0.40 | $20.00 | not checked | yes | yes | promo pricing through at least 2026-11-21 |
| GPT-5.6 Terra | `gpt-5.6-terra` | $2.00 | $0.20 | $12.00 | not checked | yes | yes | |
| GPT-5.6 Luna | `gpt-5.6-luna` | $0.20 | $0.02 | $1.20 | not checked | yes | yes | |
| GPT-5.4 mini | `gpt-5.4-mini` | $0.75 | $0.075 | $4.50 | 2026-03-17 snapshot | yes | yes | |
| GPT-5.4 nano | `gpt-5.4-nano` | $0.20 | $0.02 | $1.25 | not checked | yes | not checked | DEPRECATED, removal 2027-04-01 |
| GPT-4.1 (pipeline today) | `gpt-4.1` | $2.00 | $0.50 | $8.00 | Apr 2025 | yes | yes | REMOVED 2027-01-14 |
| GPT-4.1 mini | `gpt-4.1-mini` | $0.40 | $0.10 | $1.60 | Apr 2025 | yes | not checked | REMOVED 2027-01-14 |
| GPT-4o (pipeline today) | `gpt-4o` | $2.50 | $1.25 | $10.00 | snapshot 2024-08-06 | yes | yes | REMOVED 2027-01-14 |
| GPT-4o mini | `gpt-4o-mini` | $0.15 | $0.075 | $0.60 | 2024 | yes | not checked | REMOVED 2027-01-14 |

Other VERIFIED facts:
- GPT-6 family: 1,050,000 context window, 922,000 max input, 128,000 max output. Knowledge cutoff: Luna May 18 2026; Sol and Astra Apr 2026 (Sol Apr 20, 6.1 Sol and Astra Apr 30). Use the Responses API for tool calling with reasoning. These are reasoning models: reasoning tokens are billed as output tokens. `reasoning.effort` supports `none` (Luna and GPT-6 Sol only), low, medium (default), high, xhigh, max. For cheap checks set effort to `none` or `low` to keep output tokens small.
- A changelog fix on 2026-09-25 says a bug in image encoding degraded image understanding in GPT-6 Sol and GPT-6 Luna and was fixed. OpenAI advises re-running image evals made before the fix.
- Decisions API (beta, 2026-10-06): `POST /v1/decisions`, model `gpt-6-luna` only. Takes text and images and returns typed answers: `predicate` (probability 0 to 1), `choice` (one of your values), `score` (probability-weighted level). OpenAI says "about 10x faster" than the Responses API and expects GA "in the coming weeks". Its price is NOT VERIFIED (not on the pricing page I read). Source: https://developers.openai.com/api/docs/guides/decisions
- OpenAI model removals: gpt-4o and gpt-4.1 families go 2027-01-14; gpt-5.4-nano and gpt-5.1 go 2027-04-01.

### How OpenAI bills image inputs (VERIFIED rules, my arithmetic is INFERENCE)
Source: https://developers.openai.com/api/docs/guides/images-vision (Calculating costs section).
- gpt-4.1, gpt-4o (tile model): `detail: low` = 85 base tokens. `high` or `auto`: scale to fit 2048x2048, then shortest side down to 768, count 512px tiles; tokens = 85 + 170 x tiles. A 1024x1024 or 2048x2048 photo becomes 768x768 = 4 tiles = 765 tokens. Cost per image: gpt-4.1 about $0.0015; gpt-4o about $0.0019.
- GPT-5.2/5.4/5.5/5.6 and gpt-6-astra (patch model): 32px patches, patch_count = ceil(w/32) x ceil(h/32), capped by a patch budget, times a model multiplier (1.2 for gpt-5.4*, gpt-5.5, gpt-5.6-*, gpt-6-astra). `high` allows up to 2,500 patches. VERIFIED example from OpenAI: gpt-6-astra, 1024x1024, high = 1229 tokens; 2048x2048, high = 3000 tokens. `original` detail keeps the full size (up to 6000 or 65,535 px depending on model) and is advised for small-object detection and dense images. Max 1,500 images and 512 MB per request; 30,000 patches per image.
- For gpt-6-luna, gpt-6-sol and gpt-6.1-sol, the vision guide's sizing and multiplier tables do not list them. Their exact image token counts are NOT VERIFIED. If they follow the 1.2x multiplier as GPT-5.6 does, a 2048x2048 photo at high is about 3000 tokens, about $0.0003 on Luna and about $0.006 on 6.1 Sol (INFERENCE only).
- Use the official calculator for exact numbers: https://developers.openai.com/api/docs/guides/image-cost-calculator (could not load it from here).
- OpenAI "Limitations" in the same guide: "Counting: The model may give approximate counts for objects in images." and "Spatial reasoning: The model struggles with tasks requiring precise spatial localization."

## 4. Question 4: Gemini and Claude models for image review

### 4.1 Gemini text and vision models (Gemini API, Standard tier, per 1M tokens)
Source: https://ai.google.dev/gemini-api/docs/pricing (Last updated 2026-10-14) and each model page. Models list: https://ai.google.dev/gemini-api/docs/models (Last updated 2026-10-13).

| Model | Exact id | Status | Input | Cached input | Output (incl. thinking) | Image input? | Structured outputs |
|---|---|---|---|---|---|---|---|
| Gemini 4 Argon | `gemini-4-argon` | Stable (latest update Oct 2026) | $2.00 through 2026-11-30, then $4.00 | $0.10, then $0.20 | $10.00, then $20.00 | yes (text, image, video, audio, PDF) | yes |
| Gemini 3.8 Flash | `gemini-3.8-flash` | Stable (update Sept 2026) | $0.75 through 2026-12-31, then $1.50 | $0.075, then $0.15 | $3.75, then $7.50 | yes | yes; thinking levels low/medium/high (`minimal` errors) |
| Gemini 3.6 Flash | `gemini-3.6-flash` | Stable (July 2026) | $0.75, then $1.50 (same dates) | $0.075, then $0.15 | $3.75, then $7.50 | yes | yes |
| Gemini 3.5 Flash-Lite | `gemini-3.5-flash-lite` | Stable (July 2026) | $0.30 (text/image/video/audio) | $0.03 | $2.50 | yes | yes |
| Gemini 3.1 Flash-Lite | `gemini-3.1-flash-lite` | Stable (May 2026) | $0.25 (text/image/video) | $0.025 | $1.50 | yes | yes |
| Gemini 3.1 Pro Preview | `gemini-3.1-pro-preview` | Preview (Feb 2026) | $2.00 (prompts up to 200k); $4.00 above | $0.20 | $12.00 (up to 200k); $18.00 above | yes | yes |
| Gemini 3 Flash Preview | `gemini-3-flash-preview` | Preview, called "legacy Flash" | $0.50 | $0.05 | $3.00 | yes | yes |

- Batch is 50% of Standard on these models. Free tier exists for some Flash models (not Pro or Argon).
- Argon, 3.8 Flash and 3.6 Flash prices are time-limited promotional levels; budget for the "then" values from the stated dates.
- Argon context: 1,048,576 tokens; others 1,048,576 input and 65,536 output.

How Gemini bills images (VERIFIED), https://ai.google.dev/gemini-api/docs/media-resolution (Last updated 2026-10-13): for Gemini 4 and Gemini 3 models, `media_resolution` per image: low 280 tokens, medium 560, high 1120, ultra_high 2240 (per content item only). Default (unspecified) is 1120 tokens for images. Google recommends `high` (1120) for most image analysis. The older rule on the image-understanding page (258 tokens per 768px tile) applies to earlier models. At 1120 tokens, one image costs about $0.0008 on 3.8 Flash at today's rate, $0.0003 on 3.5 Flash-Lite, $0.0022 on 3.1 Pro or Argon (INFERENCE from the two verified numbers). Max 3,600 image files per request.

### 4.2 Anthropic Claude (Claude API)
Sources: https://platform.claude.com/docs/en/about-claude/pricing ; https://platform.claude.com/docs/en/about-claude/models/overview ; https://platform.claude.com/docs/en/build-with-claude/vision ; https://platform.claude.com/docs/en/build-with-claude/structured-outputs . Pages checked 2026-10-14 (the pages show no date; model pages give release dates).

| Model | Exact id | Input per 1M | Output per 1M | Cache read per 1M | Released | Notes |
|---|---|---|---|---|---|---|
| Claude Fable 5.1 | `claude-fable-5-1` | $10 | $50 | $0.25 | not checked | top tier |
| Claude Opus 5.5 | `claude-opus-5-5` | $4 | $20 | $0.20 | not checked | Anthropic's default suggestion for most workloads |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | $2 | $10 | $0.10 | 2026-09-28 | |
| Claude Haiku 5.5 | `claude-haiku-5-5` | $0.10 up to 100k-token prompts ($0.50 above) | $0.50 ($2.50 above) | $0.01 | 2026-10-07 | "for classification, extraction, routing"; 1M context |

- Batch API is 50% off. All current models accept text and image input and output text. Structured outputs (JSON schema in `output_config.format`) are GA for claude-haiku-5-5, claude-sonnet-5-5, claude-opus-5-5, claude-fable-5-1 and earlier (feature page lists them).
- Image tokens (VERIFIED): each 28x28 px patch is one token, so tokens = ceil(w/28) x ceil(h/28). Claude 4.7 and later: long edge up to 2576 px and up to 4784 tokens; bigger images are downscaled. Examples from Anthropic: 1000x1000 = 1296 tokens; 1920x1080 = 2691; 3840x2160 = 4784. INFERENCE: a 2048x2048 photo is capped near 4784 tokens, about $0.0005 on Haiku 5.5, $0.0096 on Sonnet 5.5, $0.019 on Opus 5.5.
- Claude 4.7 and later use a newer tokenizer that produces about 30% more tokens for the same text.

## 5. Question 5: counting and grounding guidance (only what the vendors state)

| Vendor | What the docs say | Source |
|---|---|---|
| Google (Gemini) | "Gemini models offer enhanced accuracy for specific use cases like object detection and segmentation." Object detection returns `box_2d` as [ymin, xmin, ymax, xmax] normalized to 0-1000; you must rescale to image size. Can be requested with a JSON schema (structured output) and custom instructions such as "Show bounding boxes of all green objects". Segmentation returns a box, a label and a polygon mask. | https://ai.google.dev/gemini-api/docs/image-understanding (Last updated 2026-09-23) |
| Google (Gemini Robotics ER 2, preview) | Pointing: JSON `[{"point":[y,x],"label":...}]` normalized 0-1000. Agentic vision page: "Complex tasks like counting or weight estimation benefit from a higher thinking level" and shows a counting prompt ("Identify and count all objects on the table"); also zoom-and-crop via code execution. Best practices: crop or zoom small objects; "query multiple times and average results for high-precision tasks". This is a robotics model in preview (`gemini-robotics-er-2-preview`, built on Gemini 3.5 Flash). Production use for product images is a judgement call. | https://ai.google.dev/gemini-api/docs/robotics-spatial ; /robotics-agentic ; /robotics-overview (Last updated 2026-09-04 and 2026-10-06) |
| OpenAI | Limitations: "Counting: The model may give approximate counts for objects in images." "Spatial reasoning: struggles with precise spatial localization." Advice: use `detail: "original"` for small-object detection and coordinate-sensitive tasks; resize and map coordinates back yourself. No official bounding-box or point output format is documented for the vision models in this guide. The Decisions API gives probabilities and choices, not counts or boxes. | https://developers.openai.com/api/docs/guides/images-vision |
| Anthropic | "Counting: Claude can give approximate counts of objects in an image but might not always be precisely accurate, especially with large numbers of small objects." Coordinates are "approximate". Claude can return bounding boxes and points; ask for absolute pixel coordinates (not normalized) in the prompt; Claude resizes images so returned coordinates refer to the resized image. | https://platform.claude.com/docs/en/build-with-claude/vision ; /vision-coordinates |

Official benchmarks: the DeepMind model cards for Gemini 3.8 Flash (published 2 Sept 2026) and Gemini 4 Argon (published 13 Oct 2026) list no counting or pointing benchmark (they list chart, long-video and PDF benchmarks). I found no official counting benchmark from OpenAI or Anthropic either. Any claim that one model counts better than another is therefore NOT VERIFIED from primary sources. https://deepmind.google/models/model-cards/gemini-3-8-flash/ ; https://deepmind.google/models/model-cards/gemini-4-argon/

Practical reading for a "blind piece count" (INFERENCE): all three vendors say counts are approximate. Only Google documents a way to make the model show its work (boxes or points as a structured list, then you count the list). A listed set of boxes can also be checked in code (for example, reject overlapping boxes) in a way a bare number cannot.

## 6. Recommendations per pipeline role (RECOMMENDATION, not verified fact)

Basis: the documented capabilities, prices and deprecations above. I have no accuracy test on your furniture images. No source gives a role-by-role benchmark. Run every candidate on a small set of your own runs where the true piece count and defects are known, before switching. Two design points follow from the numbers:
- Review cost is small compared with generation. One image costs $0.0003 to $0.02 to read, against $0.05 to $0.15 to generate. So pick for accuracy, not for token price, on the image-judging steps.
- Use different model families for the steps that check each other (planner vs plan check; reviewer vs auditor vs counter). This reduces the chance that two checks share the same blind spot. This is judgement, not a sourced fact.

| Role | Recommended first choice | Alternative | Reason |
|---|---|---|---|
| Image generator, lifestyle | Test `google/nano-banana-2.1/edit` on fal (about $0.06 at 2K) against current `fal-ai/nano-banana-pro/edit` ($0.15) | `gemini-3-pro-image` direct if fal Pro quality is needed | 2.1 is GA, 14 references, 1K/2K/4K, about 2.4x cheaper. Google calls Pro the choice for "accurate brand consistency", so do not assume 2.1 matches Pro on product fidelity. Compare on your own pieces. |
| Photo reading (vendor photo to structured description) | `gemini-3.8-flash` | `gpt-6.1-sol` or `claude-sonnet-5-5` | Gemini documents structured output with boxes and masks, so the read can include where each piece is. Replaces gpt-4.1. |
| Conflict check (brief text vs photo reading) | `gpt-6-luna` with effort `none` or `low`, Structured Outputs | `claude-haiku-5-5` or `gemini-3.5-flash-lite` | Mostly text comparison; cheapest current models; OpenAI names Luna as the gpt-4.1 replacement. |
| Look reader (read the style or reference image) | `gemini-3.8-flash` | `gpt-6.1-sol` | Cheap image reader with documented high-detail image setting (1120 tokens). |
| Scene planning (structured JSON plan) | `gpt-6.1-sol` | `claude-sonnet-5-5` | Planning with a strict schema is text reasoning; mid-price models are enough and cost cents per run. |
| Plan check | A different family from the planner: `claude-sonnet-5-5` (if the planner is OpenAI) | `gemini-3.8-flash` | Independent second opinion on the same plan. |
| Reviewer (compares original and generated image) | `gpt-6.1-sol` with `detail: original` or `high` | `gemini-4-argon` | Documented guidance: `original` detail for small, dense or spatially sensitive images. Argon is stable but its price doubles on 2026-12-01. |
| Auditor (second comparison of the two images) | `claude-sonnet-5-5` | `gemini-3.8-flash` | Different family from the reviewer. Replaces gpt-4o. Claude images cost about $0.01 at 2048 px. |
| Blind counter (counts pieces from the generated image without seeing the original count) | `gemini-3.8-flash` returning a list of `box_2d` or points (schema-constrained), count = list length | Run a second count with `gpt-6.1-sol` or `claude-sonnet-5-5`; if counts differ, hold for the owner | Only Google documents a grounding format. Counts are approximate for every vendor, so use two independent counts and never auto-pass a disagreement. Optionally try `gemini-robotics-er-2-preview`, which Google documents for counting and pointing, but it is a preview robotics model. |
| Final inspector (last check of the final image) | `gpt-6.1-sol` or `claude-opus-5-5` at high image detail | `gemini-4-argon` | One image per job, so use the strongest affordable model. Cost is cents. Result is a reviewed candidate, not an approval. |
| Description writer | `claude-sonnet-5-5` | `gpt-6.1-sol` | Writing quality task; low volume. |
| Description check | `gpt-6-luna` with effort `low` | `claude-haiku-5-5` | Cheap text check against the facts list. Replaces gpt-4o. |

Migration priority (VERIFIED dates): every step that uses gpt-4.1 or gpt-4o must move before 2027-01-14. Set Structured Outputs JSON schemas explicitly when you switch and re-test, because GPT-6 models are reasoning models (different token use and output behaviour).

## 7. What I could not verify

- A Google or fal statement of the fal id alias `fal-ai/nano-banana-2.1/edit` (only `google/nano-banana-2.1/edit` confirmed).
- Whether `generateContent` accepts `gemini-nano-banana-2.1` (Google's examples use the Interactions API only).
- Any official quality comparison of Nano Banana 2.1 vs Nano Banana Pro for exact product fidelity.
- Per-image input token count for 2.1 on Google's own pricing page (only fal's statement of about 1,120).
- The cost of thinking tokens per image for 2.1 and Pro.
- The real fal price of `fal-ai/birefnet/v2` (page shows $0 per compute second; pricing API needs a key).
- FLUX.2 [max] partial-megapixel rounding.
- fal CDN default media lifetime and whether any storage fee exists (no fee seen).
- OpenAI image token counts for gpt-6-luna, gpt-6-sol, gpt-6.1-sol (not in the vision guide's tables); Decisions API pricing; release dates for GPT-5.6 models.
- Any counting benchmark from OpenAI or Anthropic; Google model cards list none.
- The OpenAI usage-tier rate limits for your account (not needed for this note).
- Release date of Claude Fable 5.1 and Opus 5.5 (not read).

## 8. Source list (all fetched 2026-10-14)

- Google Gemini API pricing (Last updated 2026-10-14): https://ai.google.dev/gemini-api/docs/pricing
- Google models list (Last updated 2026-10-13): https://ai.google.dev/gemini-api/docs/models
- Nano Banana 2.1 model page (Last updated 2026-10-06): https://ai.google.dev/gemini-api/docs/models/gemini-nano-banana-2.1
- Image generation guide (Last updated 2026-10-09): https://ai.google.dev/gemini-api/docs/image-generation
- Gemini API changelog (entry Oct 6, 2026): https://ai.google.dev/gemini-api/docs/changelog
- Vertex AI / Agent Platform Nano Banana 2.1 (Last updated 2026-10-13): https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/nano-banana-2-1
- Gemini image understanding (Last updated 2026-09-23): https://ai.google.dev/gemini-api/docs/image-understanding
- Gemini media resolution (Last updated 2026-10-13): https://ai.google.dev/gemini-api/docs/media-resolution
- Gemini robotics spatial / agentic / overview: https://ai.google.dev/gemini-api/docs/robotics-spatial , /robotics-agentic , /robotics-overview
- Gemini model pages: https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash , /gemini-4-argon , /gemini-3.5-flash-lite , /gemini-3.6-flash , /gemini-3.1-pro-preview , /gemini-3.1-flash-lite , /gemini-3-pro-image , /gemini-3.1-flash-image
- DeepMind model cards: https://deepmind.google/models/model-cards/gemini-3-8-flash/ , https://deepmind.google/models/model-cards/gemini-4-argon/
- fal.ai: https://fal.ai/models/google/nano-banana-2.1/edit (+ /llms.txt) ; https://fal.ai/models/fal-ai/nano-banana-pro/edit (+ /llms.txt) ; https://fal.ai/models/fal-ai/flux-2-max/edit/llms.txt ; https://fal.ai/models/fal-ai/birefnet/v2 ; https://fal.ai/models/fal-ai/bria/background/remove/llms.txt ; https://fal.ai/pricing ; https://fal.ai/docs/documentation/model-apis/media-expiration.md ; https://fal.ai/docs/documentation/model-apis/fal-cdn.md
- LiteLLM blog (dated Oct 6, 2026): https://docs.litellm.ai/blog/nano_banana_2_1
- OpenAI: https://developers.openai.com/api/docs/pricing ; /models ; /models/gpt-6-luna ; /models/gpt-6.1-sol ; /models/gpt-6-astra ; /models/gpt-6-sol ; /models/gpt-5.6-luna ; /models/gpt-5.6-terra ; /models/gpt-5.4-mini ; /models/gpt-4.1 ; /models/gpt-4o ; /deprecations ; /changelog ; /guides/images-vision ; /guides/decisions ; /guides/latest-model
- Anthropic: https://platform.claude.com/docs/en/about-claude/pricing ; /about-claude/models/overview ; /models/haiku-5-5/overview ; /models/sonnet-5-5/overview ; /build-with-claude/vision ; /build-with-claude/vision-coordinates ; /build-with-claude/structured-outputs
