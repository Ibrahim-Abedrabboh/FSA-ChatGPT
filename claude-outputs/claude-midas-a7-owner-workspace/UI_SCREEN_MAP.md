# Owner Studio screen and state map

This map follows the client first-page guide while keeping the current A7 backend contract explicit. The original product reference remains the identity authority. A saved draft is not an analyzed or generated result.

| Surface | Entry and core action | Current connected state | Required empty, blocked, and recovery state |
| --- | --- | --- | --- |
| New Project | Choose one product or coherent set, add typed originals, then save | Single case and saved version APIs | Batch and collection dispatch remain draft requests; no combined product collage |
| Edit | Select a saved version or add a new original, then describe change and preservation | Saved versions and original reference reload | A generated result needs its real asset; unsupported image editing stays labelled |
| Single Product | Choose hero or secondary, then add originals and outputs | Draft saving; white-master hero is the only verified paid scope | Secondary and accessory-led composition remain draft requests |
| Source understanding | Save originals, request quote, explicitly authorize reading, inspect observations, confirm or correct | Owner source endpoint when deployed and ready | Unavailable, stale, pending receipt, conflicting readers, and corrected facts stay distinct |
| Creative direction and preferences | Combine requested outcomes, views, room direction, Midas links/SKUs and constraints | Saved direction, brief and estimate APIs | Unsupported options remain visible as requests, with paid submission disabled |
| Catalogue | Import Midas link: paste a product link or SKU; the site looks it up in the public Midas catalogue (`/api/owner/midas-import`) and the main photo becomes the primary original, other Midas photos can be added as side views | Connected on the owner site; photos then follow the normal Save draft path | Category and search links, unknown SKUs, products without a photo and the Midas placeholder image are refused with a reason; companion links stay text |
| Saved work and Jobs | Load real version and job IDs, filter, inspect recorded observations and approvals | Owner projects/jobs/approval APIs | Loading, no records, no matches, failed load, and stale approval gates |
| Results | Review sources, confirmed facts, submitted job, assets and downloads | Recorded job data and private originals | No generated download is offered without a real asset URL |
| Consumer VTON | Separate /consumer/ concept: enter a Midas link or SKU, choose a customer room photo, state placement and room boundary, review the local request | Local UI only; no approved-SKU lookup, image generation or purchase handoff API | Product approval, fit, pricing and rendered preview remain unavailable; no room photo is uploaded |

Shared state rules: Next and Back retain selected files and text in the current browser session. Saving, analysis, paid submission and approvals each have separate explicit actions. Browser reload cannot restore unsaved `File` objects; saved originals are reloaded through the owner API. The Jobs list is never populated with placeholder records.

## Guide scenario coverage

| Guide case | UI route and controls | Execution limit shown to the owner |
| --- | --- | --- |
| 12-chair dining set | New Project → one coherent set; physical inventory, Lifestyle + Variations, room and Midas companion instructions | Multi-output package is draft-only |
| Five-seat modular corner | New Project → one set; other views, five seats in inventory, New Composition + Website | Module/seat relationships are owner-supplied text until source review; package not verified |
| Two chairs, excluding table | Single Product → Hero; primary reference, exclusion in prompt and inventory | Explicit exclusion can be saved; paid lane remains white master only |
| Accessory hero | Single Product → Hero; Create with this item and Midas companion links/SKUs | Catalogue links are not imported or validated |
| Accessory secondary | Single Product → Secondary; composition and scale instructions | Secondary placement remains draft-only |
| Towels and textiles | New Project → one item/set; swatch context, supplier facts, Website views | PDF/spreadsheet intake and category package not connected |
| Restyle existing room | Edit → New item; product and room references, changes and protections | Room-preserving rendering not verified for paid submission |
| Mixed vendor batch | New Project → Collection/batch route; each item requires a separate case | No batch dispatch or per-item overrides |
| Continue accepted look | Edit → Past projects; saved version and original reloaded, direction amended | Generated asset editing requires a real result asset; none is exposed through owner API |

Visual rules: preserve the existing Midas wordmark, warm white canvas, restrained burgundy accents, serif headings, compact labels, centered content, cards and right-side reference drawer. Mobile steps support both buttons and the existing guarded swipe gesture; keyboard access never depends on swipe.

Release dependencies: the new source endpoint must be the actual current production publication; analysis requires the owner bridge, main continuation and mocked n8n checks before `A7_ANALYSIS_READY` can be enabled. Catalogue import, batch dispatch, category-specific packages, generated asset downloads and consumer VTON require separate verified APIs. No UI text should imply those are complete.

The owner reference API currently accepts only `product`, `room`, `look` and `other_view` image roles. It has no distinct companion-piece, previous-result, PDF or spreadsheet upload role. Those guide inputs remain explanatory text or visibly unavailable until a typed storage and reader contract is added. The owner jobs API returns status, history and observations, but no generated asset URL; the results view cannot safely offer downloads from status alone.
