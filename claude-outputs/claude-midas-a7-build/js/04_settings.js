// Stage 04 · Settings. The owner edits these values here in n8n (15 Oct 2026).
// No access codes or keys belong here: the Google and Drive credentials are attached to their own nodes.
return [{ json: {
  // Google Drive folder that holds one folder per run. Empty = every run holds before any paid call.
  // Set 15 Oct 2026 by the owner: My Drive > Claude · Midas Drive > Claude · Midas A7 images.
  drive_root_folder_id: '1vF0lKW_qRRzUg3OMCi5a5iSvmtz-QwQw',
  // Only a model marked "approved" in the model registry table is used. Both rows start as "trial".
  image_model_policy: 'approved_only',
  // Paid image calls per UTC day, all runs together. ASSUMPTION until the owner sets it.
  daily_image_limit: 20,
  // Image size when the brief names none: 1K, 2K or 4K.
  image_size: '2K',
  // Model thinking level for images: '' = the model's default; or minimal, medium, high.
  thinking_level: '',
  // How often and how long to ask Google for the finished image (15 s x 20 = 5 minutes).
  poll_seconds: 15,
  max_polls: 20,
  // Largest total size of the reference photos sent inline, in MB. ASSUMPTION: Google does not state an inline limit for this route.
  max_inline_mb: 14,
  // Stage 05: a repair after a failed review is a paid image call. false = the owner orders each repair at go 2 (default).
  // true = up to two repairs run without asking, within the job budget the owner saw at go 1.
  auto_repair: false,
  // Framing, set by the owner 16 Oct 2026, 04:16 (replaces the hero rule of 15 Oct, 23:22, which measured the product's height).
  // Every rule measures the product's bounding box on its longest side, against the frame's side in the same direction:
  // width for a wide piece, height for a tall piece. So wide, tall and square products work the same way at any of the nine shapes.
  // White master: about 76% (about 12% white margin at each end of that side). Hero: 60-70%. Wide: 40-55%.
  // Detail: the named detail fills most of the frame; the whole product is not required.
  // Framing is a styling check, not an identity check: a miss is reported with the measured share and never fails an image on its
  // own; only count and identity defects fail it. A framing repair runs only when the owner orders it at go 2.
  // white_note_band_pct and detail_min_pct are ASSUMPTIONS (the owner gave "about 76%" and "most of the frame"); they only decide
  // when a note says the framing missed.
  framing: { measure: 'longest_side', white_margin_pct: 12, white_span_pct: 76, white_note_band_pct: [72, 80], hero_span_pct: [60, 70], wide_span_pct: [40, 55], detail_min_pct: 50 },
  // Dimensions read from photos: set by the owner 15 Oct 2026, 21:48. Default: an internal estimate only,
  // never shown to the client or written as a product fact; client-facing sizes come only from the vendor or Midas data.
  dimensions_from_photos: 'internal_estimate_only',
  // Stage 06 · Package (16 Oct 2026; owner decision 15 Oct, 21:50): after the owner's go 2 approve, the master is resized without AI
  // (n8n Edit Image) to 1125 x 1125 jpg and webp. The master stays in the vault (Drive, unchanged). Never upscaled, never stretched:
  // a master that is not square, or smaller than 1125 px, holds for the owner. jpg_quality applies to the jpg only (webp uses the tool's default).
  package: { size_px: 1125, formats: ['jpg', 'webp'], jpg_quality: 92, square_tolerance_pct: 1 },
  // Stage 07 · Scene delivery files (owner, 16 Oct 2026, 03:25): after the owner's go 2 approve on a scene, the 2048-class master stays
  // in Drive unchanged; jpg and webp are made at the image's own shape with the short side at 1125 px (1125 x 1125 for 1:1, 1125 x 1406
  // for 4:5, 2000 x 1125 for 16:9). Never stretched, cropped, padded or upscaled: a master smaller than that is held for the owner.
  // shape_tolerance_pct only decides when a note says the image is not exactly the planned shape; the files always follow the image.
  scene_delivery: { short_side_px: 1125, formats: ['jpg', 'webp'], jpg_quality: 92, shape_tolerance_pct: 2 },
  // Stage 07 · Scenes (16 Oct 2026; owner choice 01:40 "C then A"). Runs after the white master is approved and packaged.
  // Each scene: the empty room first (one paid image call), then the product placed in it (one paid image call), then the stage 05
  // review and the owner's go 2. A client room photo (room_locked) skips the empty-room call. Props are Midas pieces only (owner,
  // 15 Oct 21:50): each is re-checked on its live Midas page just before placement; one that is not confirmed in stock is left out
  // and its spot stays empty. No generic props.
  scenes: {
    enabled: true,
    architect_room_first: true,
    // Scene approval (owner, 16 Oct 2026, decision 29, as revised 06:49): each scene image keeps its own go 2, after the white master's go 2.
    // Repairs only when the owner orders one for a named scene, at most two per scene (auto_repair above stays false).
    // Views of one job (owner, 16 Oct 2026, 04:16): hero, wide and detail share one room, arrangement and light. On: the widest view
    // is made first (empty room, then placement); after the owner approves it at go 2, each closer view is made from that approved
    // image with the camera moved, so the room, the pieces and the light stay the same. No new empty room is made for those views.
    // Off: each view makes its own empty room from the same plan (the rooms may then differ).
    views_share_one_room: true,
    max_midas_pieces_per_scene: 3,
    // Camera per room family, from the owner's document "Missing in Suggested Studio Solutions" (MI 21-26).
    // 'default' is an ASSUMPTION for rooms that document does not name.
    // Framing guides go into the placement prompt only (16 Oct 2026, prompt check P1): the living-room guide names the floor; the rug
    // guide (guides_with_rug) is used only when a Midas rug is a confirmed piece of that scene. The empty room gets no guide.
    camera: {
      bedroom: { height_cm: '135', guides: 'bed bottom at about 35% of the frame height, ceiling line at about 85%', basis: 'owner document MI 21-26' },
      living: { height_cm: '110-120', guides: 'the floor meets the bottom edge of the frame', guides_with_rug: 'the rug touches the bottom edge of the frame', basis: 'owner document MI 21-26' },
      dining: { height_cm: '130', guides: '', basis: 'owner document MI 21-26' },
      default: { height_cm: '120', guides: '', basis: 'ASSUMPTION (not in the owner document)' },
      // The empty room (no product in it yet).
      rules: 'Camera level: 0 degrees pitch, roll and yaw; one-point perspective; vertical lines stay vertical; no fisheye or wide-angle distortion.',
      // Camera views (owner, 16 Oct 2026, decision 24): 0 degrees tilt for Full frontal, Left side, 45° right and Right side. The Reference
      // view follows the vendor photo's perspective, as the white master does. No fisheye in any case. "Left" and "right" are as seen by a
      // person standing in front of the product, the same as the handedness lines. View wording from the F1 Options page (builder VIEW),
      // with A7 edits: the side lines carry the side gate below, and "any side seating turns inward" is left out (A7 keeps the arrangement of image 1).
      views: {
        'Reference view': 'The camera sees the product from the same side, angle and perspective as image 1 (the vendor photo); vertical lines stay vertical; no fisheye or wide-angle distortion.',
        'Full frontal': 'A level camera facing the front of the product at natural chest height, centred: 0 degrees tilt, roll and yaw; one-point perspective; vertical lines stay vertical; no fisheye or wide-angle distortion.',
        'Left side': 'The camera moves to the product\'s left side (as seen by a person standing in front of it) at the same height: level, 0 degrees tilt and roll; vertical lines stay vertical; no fisheye or wide-angle distortion.',
        '45° right': 'The camera turns about 45 degrees to the product\'s right (as seen by a person standing in front of it) at the same height: level, 0 degrees tilt and roll; vertical lines stay vertical; no fisheye or wide-angle distortion.',
        'Right side': 'The camera moves to the product\'s right side (as seen by a person standing in front of it) at the same height: level, 0 degrees tilt and roll; vertical lines stay vertical; no fisheye or wide-angle distortion.'
      },
      // When the count cannot be read from chest height (owner example: a 12-chair dining set), the camera may be raised; the tilt stays 0.
      // min_pieces 9 (a table and 8 or more chairs) is an ASSUMPTION; the owner named the 12-chair case only.
      raise: { families: ['dining'], min_pieces: 9, text: 'The camera may be raised above chest height so that every piece stays countable; it stays level (0 degrees tilt) with vertical lines vertical.', basis: 'owner 16 Oct 2026 (decision 24); the 9-piece threshold is an ASSUMPTION' }
    },
    // Light by colour temperature, not mood words (MI 6e, 34). 4000 K is in the owner document (MI 23); 3000 K and 2700 K are ASSUMPTIONS.
    // The planner must follow the preset of each image and may not change it (owner, 16 Oct 2026, decision 23). Labels are the page's words.
    kelvin: { day: 4000, warm: 3000, night: 2700, default: 'day', basis: '4000 K from owner document MI 23; warm 3000 K and night 2700 K are assumptions',
      labels: { day: 'Daylight', warm: 'Golden afternoon', night: 'Warm evening' },
      scene: { day: 'daylight through the windows', warm: 'low, warm late-afternoon sun through the windows, with the room\'s built-in light on', night: 'evening: the windows are dark; warm light comes from the room\'s built-in light' } },
    // Lamps (owner, 16 Oct 2026, decision 23): a table lamp, a floor lamp, or anything that reads as a saleable lighting product appears only
    // when it is a Midas SKU confirmed in stock on its live page and named in the plan. Otherwise the light comes from the room's built-in light.
    built_in_light: 'the room\'s built-in light: recessed downlights, a cove light or a plain ceiling fixture, shown as part of the architecture, not as a product',
    // What may appear besides the product and the checked Midas pieces: the room shell only. ASSUMPTION: plain window treatments count as shell.
    room_shell: 'walls, floor, ceiling, skirting, windows with plain sheer curtains or blinds, doors, fixed architectural details, and built-in light (recessed downlights, a cove light or a plain ceiling fixture)',
    // Side views (owner, 16 Oct 2026, decision 27, as revised 06:49): Left side and Right side are made only when a supplied photo shows that
    // side (a reference with the "Other views / pieces" role whose label, file name or side field names that side; the owner sees it at go 1).
    // Otherwise only that image is held, with its reason; the other images continue. Unseen parts are never invented. 45° right runs normally.
    side_views: { gate: 'supplied_photo_only', basis: 'owner 16 Oct 2026, decision 27 (revised 06:49)' },
    // People (owner, 16 Oct 2026, decision 22): none by default. When the brief asks (Human presence on the page, or F1's "Human lifestyle"),
    // at most one natural adult per scene image, beside or behind the product, never in front of it or covering any piece, clearly secondary.
    people_text: 'At most one natural adult, beside or behind the product, never in front of it or covering any piece, clearly secondary.',
    // The live stock check reads each Midas product page once, 10 s apart (midasfurniture.com robots.txt crawl-delay).
    prop_check_interval_ms: 10000
  },
  settings_date: '2026-10-16'
} }];
