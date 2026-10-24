/* Midas Virtual Studio: client page, draft 3 for "Claude · Midas A7" (17 Oct 2026, Phase 5).
   Copied in logic from claude-outputs/claude-midas-a7-page-2, which stays unchanged, byte for byte. New structure and design:
   a closed screen (sign-in) that opens into three leaves: I The piece, II The setting, III The plan (which becomes the result).
   Phase 5 changes:
   - P5.1: the result view reads the result contract in result-contract.md ("midas-result/1"). In mock mode it reads a mock of
     that contract. A7 has no result address yet; the A7 side is a proposal only.
   - P5.2: every option was checked against A7's "01 Intent & scope" code (read only). Added because 01 reads them: SKU,
     dimensions, pieces in the photo (item.inventory), about the product (item.description) and instructions for the studio
     (instructions). "Hero item or focus" is "Coming later" and no longer sent: 01 lists metadata.hero as not used.
   - P5.3 (F4): not chosen in the start prompt, so the room photo and photos of other sides stay "Coming later" (as draft 2).
   Kept from draft 2 (owner decisions of 16 Oct 2026): views → images (D8), the two series "Coming later" (D12), camera views,
   human presence, Plants / Mood / Midas supporting pieces "Coming later", nine image shapes sent as bare values.
   NOT CONNECTED: mock mode is always on and the page's Content-Security-Policy has connect-src 'none'.
   Plain JavaScript, no build step. Everything in this file is public: never put an access code, token or API key here. */

const STUDIO_CONFIG = {
  signInUrl: '',             // not connected
  submitUrl: '',
  statusUrl: '',
  maxFileBytes: 25 * 1024 * 1024,
  poll: { firstMs: 30000, everyMs: 15000, limitOneMs: 480000, limitManyMs: 1200000, maxFailures: 3 },
  mock: true                 // keep true until the page is connected and checked, with the owner's go
};

/* Short timings used only in mock mode, so every state can be seen in seconds. */
const MOCK_POLL = { firstMs: 2000, everyMs: 1200, limitOneMs: 9000, limitManyMs: 12000, maxFailures: 3 };

/* Every client-visible string lives here so the page can be translated (an Arabic draft is in strings-ar.draft.js,
   not loaded: it needs a native review before use). Option VALUES are sent to the studio and are never translated. */
const STRINGS = {
  meta: { lang: 'en', dir: 'ltr', title: 'Midas Virtual Studio' },
  a11y: { skip: 'Skip to the studio' },
  brand: { mark: 'MIDAS', sub: 'Virtual Studio' },
  rail: { brandLabel: 'Midas Virtual Studio', notes: 'How it works', new: 'New request' },
  auth: { signOut: 'Sign out', signedOut: 'You are signed out.' },
  leaf: { piece: 'The piece', setting: 'The setting', fold: 'Fold', unfold: 'Open' },
  signin: {
    kicker: 'Studio images of your product, made from one photo',
    title: 'The studio is closed to visitors. Bring your code.',
    lead: 'Sign in with the access code from your studio contact. Then describe one product and the setting you want.',
    label: 'Access code', show: 'Show code', submit: 'Open the studio', busy: 'Opening…',
    openMock: 'Open the studio',
    hint: 'Your studio contact gives you this code.',
    empty: 'Enter your access code.',
    network: 'The sign-in could not be reached. Check your connection and try again.',
    resume: 'Sign in to continue your request.',
    welcome: 'Signed in as {name}.'
  },
  session: { usage: '{used} of {limit} images used this month' },
  labels: {
    original: 'Your photo', generated: 'Generated image',
    reference: 'Request reference', copy: 'Copy', copied: 'Reference copied.',
    copyFailed: 'The reference could not be copied. Select it and copy it by hand.',
    on: 'On', off: 'Off', later: 'Coming later', auto: 'Automatic from your photo',
    studioChoice: 'Studio choice', none: 'None', error: 'Error:'
  },
  units: { mb: '{n} MB', kb: '{n} KB', min: 'min', sec: 's' },
  ws: {
    title: 'The studio',
    laterOutcomes: ['New Composition', 'Create with this item', 'Edit a result'],
    laterOutcomesNote: 'New Composition, Create with this item and Edit a result are coming later.',
    draftSaved: 'Draft saved on this device at {time}.',
    draftIdle: 'Your draft is saved on this device as you go, without the photo.',
    confirmNewTitle: 'Start a new request?', confirmNewBody: 'The choices in your current draft will be cleared. A request you already sent stays under Earlier requests on this device.',
    confirmNewKeep: 'Keep my draft', confirmNewGo: 'Start new',
    submit: 'Send to the studio', sending: 'Sending…',
    hintNoPhoto: 'Add a product photo in The piece to send this request.',
    hintBusy: 'One request at a time. You can send another when this one is ready for review.',
    errorsTitle: 'Before you send, fix this:',
    required: 'Required', added: 'Added', optional: 'Optional',
    setForWebsite: '{v}, set for Website',
    aspectLabel: 'Image shape',
    notOnWhite: 'Not used on white',
    detailsCount: '{n} added',
    piecesCount: '{n} listed',
    sections: {
      photo: 'Product photo', item: 'The item', pieces: 'Pieces in the photo', faithful: 'Keep faithful',
      outcome: 'Outcome', view: 'Views', series: 'Series', camera: 'Camera view',
      aspect: 'Proportions', resolution: 'Resolution', atmosphere: 'Room atmosphere',
      lighting: 'Lighting', wall: 'Wall paint', floor: 'Floor', touches: 'Finishing touches', instructions: 'Instructions for the studio'
    },
    tagIdle: 'Nothing sent yet', tagProduction: 'In production', tagUnconfirmed: 'Not confirmed', tagNotFound: 'Not found',
    recentTitle: 'Earlier requests on this device',
    recentNote: 'Kept on this device only. Not shared across devices.',
    recentEmpty: 'Requests you send are listed here, on this device only.'
  },
  plan: {
    title: 'The plan', titleResult: 'The result',
    framesLabel: 'Images in this request',
    leadNoPhoto: 'Each frame is one image in this request, drawn at its proportions. Add a product photo to send it.',
    lead: 'Each frame is one image in this request, drawn at its proportions and set with the wall, floor and light you chose.',
    frameCaption: 'Image {n}, {name}',
    studioSet: 'Set by the studio',
    sampleNote: 'Shown with a sample Midas product, the FAUVA reception chair (SKU 169741), until you add your photo.',
    yourNote: 'Shown with your photo, placed by this page to preview the plan. The studio makes the real images.',
    facts: { outcome: 'Outcome', images: 'Images', shape: 'Proportions', resolution: 'Resolution', atmosphere: 'Setting', touches: 'Finishing touches' }
  },
  dock: { go: 'See the plan', count: '{n} in this request' },
  refs: {
    room: 'Room photo', roomNote: 'Your own room as the setting, lit as photographed.',
    sides: 'Photos of other sides', sidesNote: 'Needed for left side and right side views, and for the series.'
  },
  item: {
    department: 'Department', category: 'Category', subCategory: 'Sub-category',
    taxonomyNote: 'Categories follow the Midas Kuwait English catalogue as it was on 29 September 2026.',
    sku: 'SKU', skuHint: 'The product code, if it has one.',
    dimensions: 'Dimensions', dimensionsHint: 'For example 220 x 95 x 80 cm (width x depth x height).',
    about: 'About the product', aboutHint: 'Facts the photo does not show, for example what the legs are made of.',
    dropTitle: 'Add a product photo', dropHint: 'Drag a file here, or choose one from your device',
    photoHelp: 'JPG, PNG or WebP, up to 25 MB. Use a clear photo that shows the whole product.',
    replace: 'Replace', remove: 'Remove',
    removed: 'Photo removed.', added: 'Photo added: {name}.',
    errType: '{name} is not a JPG, PNG or WebP image.',
    errSize: '{name} is larger than 25 MB.',
    errMissing: 'Add a product photo.',
    errNoType: '{name} has no file type. Save it as JPG, PNG or WebP and add it again.',
    onlyOne: 'Only one photo is used. {name} was taken.',
    thumbAlt: 'Your product photo, {name}'
  },
  pieces: {
    hint: 'If the photo shows a set, list each kind of piece and how many, for example 4 chairs. The studio keeps that count.',
    add: 'Add a piece', remove: 'Remove', name: 'Piece', count: 'How many',
    rowLabel: 'Piece {n}',
    errCount: 'Enter a number from 1 to 199 for "{name}".'
  },
  scope: {
    websiteNote: 'A Website package is always four images: catalogue on white, hero, wide and detail. The views, square proportions and 2K resolution are set for you.',
    expectWhite: 'Expect 1 image: the white catalogue image, always square.',
    expectViews: {
      'Category template': 'Expect 2 images: the white catalogue image first, then a hero image.',
      'Wide view': 'Expect 2 images: the white catalogue image first, then a wide view.',
      'Close-up': 'Expect 2 images: the white catalogue image first, then a close-up.',
      'Wide view + close-up': 'Expect 3 images: the white catalogue image first, then a wide view and a close-up, in one room.'
    },
    expectWebsite: 'Expect 4 images: catalogue on white, hero, wide and detail.',
    viewWhiteNote: 'Views do not apply on white: White BK makes the white catalogue image only.',
    cameraWhiteNote: 'Camera views and series apply to Lifestyle images only.',
    cameraLaterNote: 'Left side and Right side are coming later. They need a photo of that side; this page takes one photo for now.',
    seriesLaterNote: 'Three views and Views by light are coming later. Each needs photos of the product\'s other sides.',
    seriesNotes: { 'Single image': 'One image for each view you choose, after the white catalogue image.' },
    aspectWhite: 'The white catalogue image is always square (1:1).',
    aspectScene: 'Scene images use this shape. The white catalogue image is always square.',
    imageNames: { catalogue: 'catalogue on white', hero: 'hero', wide: 'wide view', detail: 'close-up' },
    options: {
      'Lifestyle': { title: 'Lifestyle', body: 'Your product in a styled room, after a white catalogue image.' },
      'White BK': { title: 'White BK', body: 'One clean catalogue image on white.' },
      'Website': { title: 'Website', body: 'A set of four: catalogue on white, hero, wide and detail.' }
    }
  },
  prefs: {
    studioChoice: 'Let the studio choose', studioChoiceNote: 'The studio picks the lighting, wall paint and floor.',
    whiteNote: 'Wall paint and floor are not used on a white background, so they are hidden for White BK.'
  },
  sug: {
    plants: 'Plants', plantsNote: 'Natural accents in the scene.',
    human: 'Human presence', humanNote: 'At most one person, beside or behind the item, never in front of it. Off by default.',
    humanWebNote: 'Human presence applies to Lifestyle images only.',
    catalogue: 'Choosing Midas supporting pieces', catalogueNote: 'For now the studio may place up to three Midas pieces from the current catalogue, or none.',
    mood: 'Mood', moodNote: 'One mood for the whole scene.',
    whiteNote: 'Finishing touches are not used on a white background, so they are hidden for White BK.',
    faithfulNote: 'Say what must stay true to your product. Leave a field empty if you are not sure; the studio does not guess colour or material.',
    color: 'Confirmed colour', material: 'Confirmed material',
    hero: 'Hero item or focus', heroNote: 'Choosing which piece leads the image.',
    locks: 'Details to preserve', locksHint: 'One detail on each line, up to 160 characters, for example the brass trim on the arms.',
    mustNot: 'Things to exclude', mustNotHint: 'One item on each line, up to 80 characters, for example a table that appears in your photo.',
    errLockLine: 'A detail to preserve is longer than 160 characters: "{start}…". Split it into shorter lines.',
    errExcludeLine: 'A thing to exclude is longer than 80 characters: "{start}…". Shorten it.',
    instructionsHint: 'Anything else the studio should know, in a few sentences.',
    budget: '{n} of {max} characters used by your instructions and details to preserve.',
    errBudget: 'Your instructions and details to preserve are too long together. Shorten them by {n} characters.'
  },
  review: { images: '{n} image', imagesMany: '{n} images' },
  submit: {
    network: 'Your request could not be sent. Check your connection and try again. Trying again cannot start a second request.',
    tryAgain: 'Try again',
    limit: '{message} {used} of {limit} images used this month.',
    refused: 'The request was refused.'
  },
  progress: {
    titleRunning: 'In production.', titleStopped: 'No result yet.', titleUnknown: 'Request not found.',
    received: 'Request received', production: 'In production', ready: 'Ready for review',
    productionNote: 'Images are made one after another. A correction adds time.',
    stateDone: 'Done', stateNow: 'Now', stateWaiting: 'Waiting', stateUnconfirmed: 'Not confirmed',
    receivedAt: 'Received at {time}', elapsed: 'Time elapsed: {time}',
    soFar: 'So far {x} of {n} images are ready. The request is not complete yet.',
    timeout: 'No result has arrived. The request may have stopped. The studio team can check it using your request reference.',
    unreachable: 'The result could not be checked. Your request may still be in production. Check your connection, then check again.',
    checkAgain: 'Check again',
    back: 'Back to your brief',
    announceRunning: 'Request received. In production.',
    announceReady: 'Your result is ready for review.'
  },
  results: {
    titleReady: 'Ready for review.', titlePartial: 'Partly ready.', titleHold: 'On hold.',
    titleApproved: 'Approved.', titlePartApproved: 'Partly approved.',
    allOne: 'The image passed the studio\'s automatic checks. It is awaiting the studio\'s decision.',
    allMany: 'All {n} images passed the studio\'s automatic checks. They are awaiting the studio\'s decision.',
    someApproved: '{a} of {n} images have the studio\'s approval. Each image below shows where it stands.',
    allApproved: 'Every image has the studio\'s approval.',
    partial: '{x} of {n} images passed the automatic checks or were approved. The rest need attention.',
    hold: 'No image is ready. {reason}',
    holdNoReason: 'No image passed the automatic checks.',
    holdOther: 'No image is ready to use. Each image below shows where it stands.',
    notMadeOne: '1 image was not made.', notMadeMany: '{k} images were not made.',
    packageComplete: 'Package complete', packageIncomplete: 'Package incomplete',
    packageWhy: 'A package is complete when every image in it has the studio\'s approval.',
    viewLabel: 'Show', single: 'Results only', side: 'Results beside your photo',
    noOriginal: 'Your original photo is no longer held in this tab, so it cannot be shown beside the results.',
    imageTitle: 'Image {n}', imageTitleView: 'Image {n}, {view}',
    views: { wide: 'wide view', close: 'close-up', catalogue: 'catalogue on white', hero: 'hero', detail: 'close-up (detail)' },
    cameras: { 'Full frontal': 'full frontal', 'Left side': 'left side', '45° right': '45° right', 'Right side': 'right side' },
    lights: { day: 'daylight', warm: 'golden afternoon', night: 'warm evening', studio: 'light chosen by the studio' },
    state: {
      in_production: 'In production', passed_checks: 'Passed automatic checks', on_hold: 'On hold', not_made: 'Not made',
      changes_requested: 'The studio has asked for changes', not_approved: 'Not approved by the studio', unread: 'Decision not readable'
    },
    awaiting: 'Awaiting the studio\'s decision.',
    reasonHold: 'Why it is on hold:', reasonNotMade: 'Why it was not made:', reasonChanges: 'The studio\'s note:',
    notMadeFallback: 'The studio did not make this image.',
    reasonHoldFallback: 'The studio is checking this image.',
    unreadDecision: 'The studio\'s decision for this image could not be read. Ask the studio team, using your request reference.',
    decidedOn: 'Recorded on {date}.',
    generatedAlt: 'Generated image {n} for {file}', originalAlt: 'Your original photo, {file}',
    expired: 'This image link has expired. Ask the studio team for the file, using your request reference.',
    noImage: 'No image was saved for this one.',
    open: 'Open full size', download: 'Download',
    checksAll: 'Automatic checks: all {n} passed', checksSome: 'Automatic checks: {x} of {n} not passed',
    checkNames: {
      inventory_count: 'Piece count', identity_shape: 'Shape and identity', excluded_absent: 'Exclusions respected',
      no_text_or_layout: 'Clean frame', client_rules: 'Your instructions', colour_material: 'Colour and material',
      details: 'Details', scene_match: 'Scene', lighting: 'Lighting',
      category_checks: 'Product type checks', catalogue_items: 'Midas supporting pieces'
    },
    checkResults: { pass: 'Pass', partial: 'Partial', fail: 'Fail', unknown: 'Unknown' },
    details: 'Request details', detailsSummary: 'Notes from the studio', detailsViews: 'Website package views',
    detailsViewsLine: 'Ready: {ready}. Missing: {missing}.', detailsLimits: 'Limitations', detailsPieces: 'Midas supporting pieces used',
    change: 'Request a change', newItem: 'Start a new item'
  },
  recent: {
    check: 'Check result',
    meta: '{outcome}, {count}, {time}',
    status: {
      sent: 'In production when last checked', ready: 'Ready for review', partial: 'Partly ready', hold: 'On hold',
      unknown: 'Not found', approved: 'Approved', part_approved: 'Partly approved'
    }
  },
  notes: {
    title: 'How the studio works', close: 'Close',
    stepsTitle: 'Five steps',
    steps: [
      { title: 'The piece', body: 'Add one photo of your product and the facts you know: SKU, dimensions, pieces, colour and material.' },
      { title: 'The setting', body: 'Choose the outcome, the views, the camera view and the proportions. Set the light, wall paint and floor, or let the studio choose.' },
      { title: 'The plan', body: 'Each image in the request appears as a frame. Check the plan, then send it.' },
      { title: 'Review', body: 'Each image goes through the studio\'s automatic checks, then the studio decides. Every label says where an image stands.' },
      { title: 'Deliver', body: 'Open each image at full size or download it. To adjust a result, request a change and send again.' }
    ],
    outcomesTitle: 'Outcomes you can request',
    outcomes: [
      ['Lifestyle, 2 or 3 images', 'A white catalogue image first, then one image for each view you choose. All images share one room, arrangement and light.'],
      ['White BK, 1 image', 'Clean catalogue imagery on white, always square.'],
      ['Website, 4 images', 'Catalogue on white, hero, wide and detail. Square, set for you.']
    ],
    labelsTitle: 'What each label means',
    labelsLead: 'Every result carries its status in words. Approval labels appear only after the studio records its decision.',
    labels: [
      ['Generated image', 'On every picture the studio makes.'],
      ['Passed automatic checks', 'The image met the studio\'s checks and is awaiting the studio\'s decision.'],
      ['On hold', 'The image needs attention. The reason is shown.'],
      ['Not made', 'The studio did not make this image. The reason is shown in plain words.'],
      ['Approved', 'The studio approved the image after its checks.'],
      ['Approved by the studio', 'The studio approved the image on its own decision.'],
      ['The studio has asked for changes', 'The studio wants the image adjusted. Its note is shown.'],
      ['Package complete', 'Every image in the request has the studio\'s approval. Until then the package shows as incomplete.'],
      ['Coming later', 'Shown so you know it is planned. It cannot be chosen yet and is never sent.']
    ],
    faqTitle: 'Questions',
    faq: [
      { q: 'What do I need to start?', a: 'An access code and one product photo. Your studio contact gives you the code. The photo can be JPG, PNG or WebP, up to 25 MB.' },
      { q: 'How many images will I receive?', a: 'The plan shows every image before you send. Lifestyle gives 2 images for a hero, a wide view or a close-up, and 3 for a wide view and a close-up. White BK gives 1. Website always gives 4.' },
      { q: 'How long does a request take?', a: 'The studio does not quote a completion time. Images are made one after another, and a correction adds time. While a request is in production, the page shows the time elapsed.' },
      { q: 'Can I close the page and come back?', a: 'Your draft is saved on this device, without the photo, and so is the list of requests you sent. Neither is shared across devices. You sign in again when you return.' },
      { q: 'What if a result is not right?', a: 'Choose Request a change. Your brief opens again with the same choices, so you can adjust it and send a new request.' }
    ]
  },
  options: {
    view: { 'Category template': 'Category template', 'Wide view': 'Wide view', 'Close-up': 'Close-up', 'Wide view + close-up': 'Wide view and close-up' },
    camera: { 'Reference view': 'As photographed', 'Full frontal': 'Full frontal', '45° right': '45° right', 'Left side': 'Left side', 'Right side': 'Right side' },
    series: { 'Single image': 'Single image', 'Three views': 'Three views', 'Views by light': 'Views by light' },
    aspect: { standard: 'Standard for category (square 1:1)', '1:1': 'Square 1:1', '4:5': 'Portrait 4:5', '3:4': 'Portrait 3:4', '2:3': 'Portrait 2:3', '9:16': 'Portrait 9:16', '5:4': 'Landscape 5:4', '4:3': 'Landscape 4:3', '3:2': 'Landscape 3:2', '16:9': 'Landscape 16:9' },
    aspectGroups: { square: 'Square', portrait: 'Portrait', landscape: 'Landscape' },
    resolution: { 'Standard for category': 'Standard for category', '2K': '2K', '4K': '4K' },
    resolutionShort: { 'Standard for category': 'Standard', '2K': '2K', '4K': '4K' },
    lighting: { 'Soft daylight': 'Soft daylight', 'Golden afternoon': 'Golden afternoon', 'Warm evening': 'Warm evening' },
    wall: { 'White': 'White', 'Ivory': 'Ivory', 'Sand': 'Sand', 'Greige': 'Greige', 'Taupe': 'Taupe', 'Sage': 'Sage', 'Charcoal': 'Charcoal', 'Terracotta': 'Terracotta' },
    floor: { 'Light oak': 'Light oak', 'Dark walnut': 'Dark walnut', 'Limestone': 'Limestone', 'Marble': 'Marble' }
  },
  mock: {
    title: 'Mock mode: no request is sent.',
    signin: 'Sign-in', submit: 'Sending', result: 'Result', dir: 'Direction',
    clientName: 'Demo client',
    picture: 'Mock picture {n}',
    dirOptions: { ltr: 'Left to right', rtl: 'Right to left (layout check)' },
    signinOptions: { skip: 'Skipped (preview)', limit: 'Accepted, with a limit', nolimit: 'Accepted, no limit', denied: 'access_denied', off: 'access_off', network: 'Network failure' },
    submitOptions: { accepted: 'Accepted', duplicate: 'duplicate', limit: 'limit_reached', tryagain: 'try_again', network: 'Network failure', bad: 'bad_request', denied: 'access_denied' },
    resultOptions: {
      passed: 'All passed checks', arriving: 'Arriving one by one', partial: 'One on hold', hold: 'All on hold',
      not_made: 'One not made', approved: 'All approved', approved_studio: 'Approved, one by the studio',
      approved_some: 'Some approved', approved_open: 'All approved, package open', changes: 'Changes asked',
      rejected: 'Not approved', bad_label: 'Unreadable decision', website_complete: 'Website, complete',
      website_incomplete: 'Website, incomplete', expired: 'Image link expired', never: 'Not finished until timeout',
      unknown: 'unknown_request', signedout: 'Signed out mid-run', unreachable: 'Address unreachable'
    }
  }
};

(() => {
  'use strict';

  /* ------------------------------------------------------------------ helpers */
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(window.location.search);
  const MOCK = STUDIO_CONFIG.mock === true || params.get('mock') === '1';
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');
  const WIDE = window.matchMedia('(min-width: 1240px)');   // the three leaves side by side

  function t(key, vars) {
    let node = STRINGS;
    for (const part of String(key).split('.')) node = node == null ? undefined : node[part];
    if (typeof node !== 'string') { console.warn('[studio] missing string: ' + key); return String(key); }
    return vars ? node.replace(/\{(\w+)\}/g, (m, name) => (vars[name] === undefined ? m : String(vars[name]))) : node;
  }
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attrs || {})) {
      if (value === null || value === undefined || value === false) continue;
      if (name === 'class') node.className = value;
      else if (name === 'text') node.textContent = value;
      else if (name === 'style') node.style.cssText = value;   // through the CSSOM: the page's CSP refuses style attributes
      else if (name.startsWith('on') && typeof value === 'function') node.addEventListener(name.slice(2), value);
      else node.setAttribute(name, value === true ? '' : String(value));
    }
    for (const child of children) if (child !== null && child !== undefined && child !== false) node.append(child);
    return node;
  }
  function applyStrings(root) {
    root.querySelectorAll('[data-t]').forEach(node => { node.textContent = t(node.dataset.t); });
    [['data-t-aria-label', 'aria-label'], ['data-t-alt', 'alt']].forEach(([from, to]) => {
      root.querySelectorAll('[' + from + ']').forEach(node => node.setAttribute(to, t(node.getAttribute(from))));
    });
  }
  function bind(name, text) { document.querySelectorAll('[data-bind="' + name + '"]').forEach(node => { node.textContent = text; }); }
  function announce(text) { const live = $('live'); live.textContent = ''; window.setTimeout(() => { live.textContent = text; }, 60); }
  function show(node, visible) { node.hidden = !visible; }
  function focusNode(node) { if (node) { try { node.focus({ preventScroll: false }); } catch (e) { node.focus(); } } }
  const timeText = ms => new Date(ms).toLocaleTimeString(STRINGS.meta.lang, { hour: '2-digit', minute: '2-digit' });
  const dateTimeText = ms => new Date(ms).toLocaleString(STRINGS.meta.lang, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const sizeText = bytes => (bytes >= 1048576 ? t('units.mb', { n: (bytes / 1048576).toFixed(1) }) : t('units.kb', { n: Math.max(1, Math.round(bytes / 1024)) }));
  function elapsedText(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(total / 60) + ' ' + t('units.min') + ' ' + String(total % 60).padStart(2, '0') + ' ' + t('units.sec');
  }
  function newId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
  }
  const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  /* ------------------------------------------------------------------ storage (own keys: never mixed with other drafts)
     localStorage: the draft brief, the request reference, recent requests. Never the access code.
     sessionStorage: the access code and the signed-in client, gone when the tab closes. */
  function area(name) {
    try { const a = window[name]; a.getItem('midas.a7p3.probe'); return a; }
    catch (e) { const mem = new Map(); return { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: k => { mem.delete(k); } }; }
  }
  const LS = area('localStorage');
  const SS = area('sessionStorage');
  const read = (a, key) => { try { const raw = a.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } };
  const write = (a, key, value) => { try { a.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full or blocked */ } };
  const drop = (a, key) => { try { a.removeItem(key); } catch (e) { /* ignore */ } };
  const KEY = { draft: 'midas.a7p3.draft', unsent: 'midas.a7p3.unsent', pending: 'midas.a7p3.pending', recent: 'midas.a7p3.recent', code: 'midas.a7p3.code', session: 'midas.a7p3.session' };

  /* ------------------------------------------------------------------ options (stable values sent to the studio) */
  const OPT = {
    outcomes: ['Lifestyle', 'White BK', 'Website'],
    view: ['Category template', 'Wide view', 'Close-up', 'Wide view + close-up'],
    viewImages: { 'Category template': ['hero'], 'Wide view': ['wide'], 'Close-up': ['detail'], 'Wide view + close-up': ['wide', 'detail'] },   // owner D8
    aspect: ['standard', '1:1', '4:5', '3:4', '2:3', '9:16', '5:4', '4:3', '3:2', '16:9'],
    aspectGroups: [['square', ['1:1']], ['portrait', ['4:5', '3:4', '2:3', '9:16']], ['landscape', ['5:4', '4:3', '3:2', '16:9']]],
    resolution: ['Standard for category', '2K', '4K'],
    lighting: ['Soft daylight', 'Golden afternoon', 'Warm evening'],
    wall: [['White', '#eeeae3'], ['Ivory', '#e7ddc8'], ['Sand', '#cfb996'], ['Greige', '#b7aea1'], ['Taupe', '#938074'], ['Sage', '#a3ad91'], ['Charcoal', '#575652'], ['Terracotta', '#b4745d']],
    floor: [['Light oak', '#c8a273'], ['Dark walnut', '#5b3d2a'], ['Limestone', '#d6cdb9'], ['Marble', '#e8e5df']],
    camera: ['Reference view', 'Full frontal', '45° right'],
    cameraLater: ['Left side', 'Right side'],                   // need a photo of that side: shown, never sent
    series: ['Single image'],
    seriesLater: ['Three views', 'Views by light'],             // owner D12: shown as "Coming later", never selectable, never sent
    lightKey: { 'Soft daylight': 'day', 'Golden afternoon': 'warm', 'Warm evening': 'night' },
    ratios: { '1:1': '1 / 1', '4:5': '4 / 5', '3:4': '3 / 4', '2:3': '2 / 3', '9:16': '9 / 16', '5:4': '5 / 4', '4:3': '4 / 3', '3:2': '3 / 2', '16:9': '16 / 9' },
    maxPieces: 12
  };
  const PRODUCT_ROLE = 'Product / vendor reference';
  const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    /* A7's 01 joins the instructions and the details to preserve into one text of at most 1,200 characters, instructions first.
     The page checks the joined length before sending, so no detail to preserve is cut off. */
  const INSTRUCTION_LIMIT = 1200;
  const KEEP_PREFIX = 'Details to keep exactly as in the vendor photo: ';

  function defaultBrief() {
    return {
      department: '', category: '', subCategory: '', sku: '', dimensions: '', pieces: [], about: '',
      outcome: 'Lifestyle', view: 'Category template', camera: 'Reference view', series: 'Single image', aspect: 'standard', resolution: 'Standard for category',
      studioChoice: false, lighting: '', wallPaint: '', floor: '',
      human: false,
      color: '', material: '', locks: '', mustNot: '', instructions: ''
    };
  }

  /* ------------------------------------------------------------------ state */
  const state = {
    session: null, brief: defaultBrief(),
    file: null, fileUrl: '', fileRunId: '',
    runId: '', run: null, result: null,
    compare: 'single', stage: 'plan', sending: false, draftSavedAt: 0
  };

  /* ------------------------------------------------------------------ taxonomy (catalogue snapshot, unchanged copy) */
  const taxonomy = window.MIDAS_TAXONOMY || { nodes: [] };
  const nodeById = new Map(taxonomy.nodes.map(node => [node.id, node]));
  const categoryNodes = taxonomy.nodes.filter(node => node.kind === 'category');
  const departments = categoryNodes.filter(node => !node.parentId);
  function isDescendant(node, ancestorId) {
    let parent = node.parentId;
    while (parent) { if (parent === ancestorId) return true; parent = (nodeById.get(parent) || {}).parentId || ''; }
    return false;
  }
  function pathLabel(node, rootId) {
    const parts = [node.name]; let parent = node.parentId;
    while (parent && parent !== rootId) { const ancestor = nodeById.get(parent); if (!ancestor) break; parts.unshift(ancestor.name); parent = ancestor.parentId; }
    return parts.join(' / ');
  }
  const nodeName = id => (nodeById.get(id) || {}).name || '';
  const subLabel = () => { const node = nodeById.get(state.brief.subCategory); return node ? pathLabel(node, state.brief.category) : ''; };
  function fillSelect(select, pairs, value) {
    select.replaceChildren(...pairs.map(([v, label]) => el('option', { value: v, text: label })));
    select.value = pairs.some(([v]) => v === value) ? value : pairs[0][0];
  }
  function fillCategories() {
    const b = state.brief;
    const children = categoryNodes.filter(node => b.department && node.parentId === b.department);
    if (!children.some(node => node.id === b.category)) b.category = '';
    fillSelect($('category'), [['', t('labels.auto')], ...children.map(node => [node.id, node.name])], b.category);
    $('category').disabled = !children.length;
    const descendants = categoryNodes.filter(node => b.category && isDescendant(node, b.category));
    if (!descendants.some(node => node.id === b.subCategory)) b.subCategory = '';
    fillSelect($('sub-category'), [['', t('labels.auto')], ...descendants.map(node => [node.id, pathLabel(node, b.category)])], b.subCategory);
    $('sub-category').disabled = !descendants.length;
  }

  /* ------------------------------------------------------------------ brief → plan → payload */
  const isWebsite = b => b.outcome === 'Website';
  const isWhite = b => b.outcome === 'White BK';
  const isLife = b => !isWebsite(b) && !isWhite(b);
  /* The images a request asks for, in the studio's own order (as A7's 01 plans them). With both series "Coming later",
     a Lifestyle request is the white catalogue image, then one image for each view, all from the chosen camera view. */
  function plannedImages(b) {
    const one = (role, more) => Object.assign({ role, camera: '', light: '', made: true }, more || {});
    if (isWebsite(b)) return ['catalogue', 'hero', 'wide', 'detail'].map(role => one(role));
    if (isWhite(b)) return [one('catalogue')];
    const light = OPT.lightKey[b.studioChoice ? '' : b.lighting] || '';
    const camera = OPT.camera.includes(b.camera) ? b.camera : 'Reference view';
    return [one('catalogue')].concat((OPT.viewImages[b.view] || OPT.viewImages['Category template']).map(role => one(role, { camera, light })));
  }
  function imageName(img) {
    const base = STRINGS.scope.imageNames[img.role] || img.role;
    return img.camera && img.camera !== 'Reference view' ? base + ', ' + STRINGS.results.cameras[img.camera] : base;
  }
  function effective(b) {
    const web = isWebsite(b), white = isWhite(b), life = isLife(b);
    const images = plannedImages(b);
    return {
      images, imageCount: images.length, life,
      series: 'Single image',
      view: web ? 'Category template' : (white ? '' : b.view),
      camera: life ? (OPT.camera.includes(b.camera) ? b.camera : 'Reference view') : '',
      aspect: web || white || b.aspect === 'standard' ? '1:1' : b.aspect,
      resolution: web ? '2K' : b.resolution,
      lighting: b.studioChoice || white ? '' : b.lighting,                 // 01 gives no light to the white image
      defaults: !white && !!b.studioChoice,
      wallPaint: b.studioChoice || white ? '' : b.wallPaint,
      floor: b.studioChoice || white ? '' : b.floor,
      human: life ? !!b.human : false
    };
  }
  const lines = text => String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const squash = (text, max) => String(text || '').replace(/[\u0000-\u001f]/g, ' ').split(' ').filter(Boolean).join(' ').slice(0, max);
  const validPieces = b => b.pieces.map(p => ({ item: squash(p.item, 60), count: Number(p.count) }))
    .filter(p => p.item && Number.isInteger(p.count) && p.count > 0 && p.count < 200);
  function joinedInstructions(b) {    // the text A7's 01 builds from instructions and details to preserve
    const keep = lines(b.locks).map(line => squash(line, 160)).filter(Boolean);
    return [squash(b.instructions, INSTRUCTION_LIMIT), keep.length ? KEEP_PREFIX + keep.join('; ') + '.' : '']
      .map(x => squash(x, INSTRUCTION_LIMIT)).filter(Boolean).join(' ');
  }
  /* What the page sends. Every client option is one A7's 01 reads (P5.2). Camera view, series and human presence are Lifestyle
     only; lighting is not sent for White BK. job, workOn, item.referenceType, metadata.product_category, scene, light and delivery
     are kept from draft 2's shape: 01 does not read them, and they are not client options.
     Plants, Mood, Midas supporting pieces, the hero item, the room photo and photos of other sides are "Coming later" and never sent. */
  function buildPayload(clientRunId) {
    const b = state.brief, e = effective(b);
    const department = nodeName(b.department), category = nodeName(b.category);
    const scope = { outcome: b.outcome, outcomes: [b.outcome], view: e.view, aspect: e.aspect, resolution: e.resolution, imageCount: e.imageCount };
    if (e.life) { scope.camera = e.camera; scope.series = e.series; }
    const payload = {
      job: b.outcome.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
      jobMode: 'new_project',
      workOn: 'one_by_one',
      scope,
      item: {
        department, category, subCategory: subLabel(), referenceType: PRODUCT_ROLE,
        sku: b.sku.trim(), dimensions: b.dimensions.trim(), inventory: validPieces(b), description: b.about.trim()
      },
      preferences: { lighting: e.lighting, wallPaint: e.wallPaint, floor: e.floor, useWorkflowDefaults: e.defaults },
      metadata: {
        product_category: category || department, color: b.color.trim(), material: b.material.trim(),
        scene: b.outcome, light: e.lighting,
        locks: lines(b.locks), must_not: lines(b.mustNot),
        delivery: { image_size: '', aspect: e.aspect, resolution: e.resolution }
      },
      instructions: b.instructions.trim(),
      references: [{ name: state.file ? state.file.name : '', role: PRODUCT_ROLE }],
      clientRunId
    };
    if (e.life) payload.styling = { human: e.human };
    return payload;
  }

  /* ------------------------------------------------------------------ network (live code path; not used in mock mode) */
  const REASON_BY_STATUS = { 400: 'bad_request', 401: 'access_denied', 403: 'access_off', 404: 'unknown_request', 409: 'duplicate', 429: 'limit_reached', 503: 'try_again' };
  async function post(url, body) {
    if (!url) return { network: true };
    let response;
    try { response = await fetch(url, { method: 'POST', body, cache: 'no-store' }); } catch (error) { return { network: true }; }
    try { return { status: response.status, data: await response.json() }; } catch (error) { return { network: true }; }
  }
  const getCode = () => { const code = read(SS, KEY.code); return typeof code === 'string' ? code : ''; };
  const live = {
    signIn: code => post(STUDIO_CONFIG.signInUrl, new URLSearchParams({ access_code: code })),
    submit: (payload, file) => {
      const data = new FormData();
      data.append('access_code', getCode());
      data.append('payload', JSON.stringify(payload));
      data.append('files', file, file.name);
      return post(STUDIO_CONFIG.submitUrl, data);
    },
    status: id => post(STUDIO_CONFIG.statusUrl, new URLSearchParams({ id, access_code: getCode() }))
  };

  /* ------------------------------------------------------------------ mock replies (nothing leaves the browser)
     Results follow the result contract "midas-result/1" (result-contract.md). */
  const mockState = { signin: params.get('signin') || 'skip', submit: params.get('submit') || 'accepted', result: params.get('result') || 'passed', dir: params.get('dir') || 'ltr', jobs: new Map(), checks: new Map() };
  const MOCK_MESSAGES = {
    bad_request: 'The request was incomplete.',
    access_denied: 'This access code is not recognised.',
    access_off: 'This access code is switched off. Contact the studio team.',
    try_again: 'The studio could not check this account just now. Try again shortly.',
    duplicate: 'This request was already received.',
    limit_reached: 'This account has reached its image limit for the month.',
    unknown_request: 'No request with this reference was found for this account.'
  };
  const mockRefusal = (reason, status, extra) => ({ status, data: Object.assign({ ok: false, accepted: false, found: false, reason, message: MOCK_MESSAGES[reason] }, extra || {}) });
  const later = value => new Promise(resolve => window.setTimeout(() => resolve(value), 300));
  /* A plain stand-in picture, drawn at the image's proportions and marked as a mock. It is never a studio result. */
  function mockPicture(n, aspect) {
    const [w, h] = String(aspect || '1:1').split(':').map(Number);
    const W = 600, H = Math.round(600 * (h || 1) / (w || 1));
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#122C4F"/><stop offset="1" stop-color="#0D1B2A"/></linearGradient></defs>' +
      '<rect width="100%" height="100%" fill="url(#g)"/><rect x="18" y="18" width="' + (W - 36) + '" height="' + (H - 36) + '" fill="none" stroke="#C99A47" stroke-width="2"/>' +
      '<text x="50%" y="50%" fill="#E6C17A" font-family="Georgia, serif" font-size="34" text-anchor="middle">' + t('mock.picture', { n }) + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  const CHECKS = Object.keys(STRINGS.results.checkNames);
  function mockImage(p, i, aspect, stateName, extra, job) {
    const ratio = p.role === 'catalogue' ? '1:1' : aspect;
    const base = { slot: i + 1, output_id: p.role === 'catalogue' ? 'white_master' : p.role, role: p.role, camera: p.camera, light: p.light, state: stateName, reason: '', image_url: '', client_shown_as: '', decided_at: '', note: '', checks: [] };
    if (stateName !== 'in_production' && stateName !== 'not_made') {
      base.image_url = (job && job.pictures && job.pictures[i]) || mockPicture(i + 1, ratio);
      base.checks = CHECKS.map((name, k) => [name, stateName === 'on_hold' && k === 0 ? 'fail' : 'pass', stateName === 'on_hold' && k === 0 ? 'Leg count differs from the product photo.' : 'Matches the product photo.']);
    }
    return Object.assign(base, extra || {});
  }
  function mockResult(id) {
    const fallback = [{ role: 'catalogue', camera: '', light: '' }, { role: 'hero', camera: 'Reference view', light: '' }];
    const job = mockState.jobs.get(id) || { outcome: 'Lifestyle', planned: fallback, file: 'product.jpg', aspect: '1:1' };
    let s = mockState.result;
    const web = job.outcome === 'Website' || s === 'website_complete' || s === 'website_incomplete';
    const planned = web ? ['catalogue', 'hero', 'wide', 'detail'].map(role => ({ role, camera: '', light: '' })) : job.planned;
    const aspect = web ? '1:1' : job.aspect;
    const last = planned.length - 1;
    const now = new Date().toISOString();
    const approve = label => ({ client_shown_as: label, decided_at: now });
    const holdReason = { reason: 'The piece count in the image differs from the product photo: four chair legs in the photo, three in the image.' };
    const seen = mockState.checks.get(id) || 0;
    let finished = true;
    const images = planned.map((p, i) => {
      const shot = (st, ex) => mockImage(p, i, aspect, st, ex || null, job);   // pictures drawn when the request was sent
      switch (s) {
        case 'arriving':
          if (seen < 3) { finished = false; return shot(i === 0 ? 'passed_checks' : 'in_production'); }
          return shot('passed_checks');
        case 'partial': return shot(i === last && planned.length > 1 ? 'on_hold' : (planned.length === 1 ? 'on_hold' : 'passed_checks'), i === last ? holdReason : null);
        case 'hold': return shot('on_hold', holdReason);
        case 'not_made':
          if (i === last && planned.length > 1) return shot('not_made', { reason: 'It is made from image ' + i + ' of this request, which is on hold.' });
          return i === last - 1 && i > 0 ? shot('on_hold', holdReason) : shot('passed_checks');
        case 'approved': case 'website_complete': return shot('approved', approve('Approved'));
        case 'approved_studio': return shot('approved', approve(i === last ? 'Approved by the studio' : 'Approved'));
        case 'approved_some': return i === 0 ? shot('approved', approve('Approved')) : shot('passed_checks');
        case 'approved_open': return shot('approved', approve('Approved'));
        case 'changes': return i === last ? shot('changes_requested', { decided_at: now, note: 'Please make the room a little brighter.' }) : shot('approved', approve('Approved'));
        case 'rejected': return shot('not_approved', { decided_at: now, note: 'The fabric colour is not right.' });
        case 'bad_label': return shot('approved', { client_shown_as: 'Approved by owner without an automated review', decided_at: now });
        case 'website_incomplete': return i === last ? shot('on_hold', holdReason) : shot('passed_checks');
        case 'expired': return shot('passed_checks', i === 0 ? { image_url: 'data:image/webp;base64,AAAA' } : null);
        default: return shot('passed_checks');
      }
    });
    const everyApproved = images.every(img => img.state === 'approved');
    return {
      contract: 'midas-result/1', found: true, state: finished ? 'finished' : 'not_finished',
      client_run_id: id, images_planned: planned.length, finished_at: finished ? now : '',
      package: {
        kind: web ? 'website' : (job.outcome === 'White BK' ? 'white_bk' : 'lifestyle'),
        complete: finished && everyApproved && s !== 'approved_open',
        website_views: web ? { required: planned.map(p => p.role), ready: images.filter(img => img.state === 'approved' || img.state === 'passed_checks').map(img => img.role), missing: images.filter(img => img.state !== 'approved' && img.state !== 'passed_checks').map(img => img.role) } : null,
        limitations: s === 'approved_open' ? ['The product description for this package is not ready yet.'] : ['Mock data: the pictures are stand-ins drawn by this page, not studio results.'],
        catalogue: []
      },
      images,
      summary: finished ? 'Mock notes for ' + job.file + '. This text stands in for the studio\'s notes on the request.' : ''
    };
  }
  const mock = {
    signIn: () => {
      const s = mockState.signin;
      if (s === 'network') return later({ network: true });
      if (s === 'denied') return later(mockRefusal('access_denied', 401));
      if (s === 'off') return later(mockRefusal('access_off', 403));
      return later({ status: 200, data: { ok: true, client_name: t('mock.clientName'), role: 'client', monthly_image_limit: s === 'nolimit' ? 0 : 500, images_used_this_month: s === 'nolimit' ? 0 : 12 } });
    },
    submit: (payload, file) => {
      const s = mockState.submit;
      mockState.lastPayload = payload;                  // lets a tester read what would have been sent
      if (s === 'network') return later({ network: true });
      if (s === 'denied') return later(mockRefusal('access_denied', 401));
      if (s === 'bad') return later(mockRefusal('bad_request', 400));
      if (s === 'tryagain') return later(mockRefusal('try_again', 503));
      if (s === 'limit') return later(mockRefusal('limit_reached', 429, { monthly_image_limit: 500, images_used_this_month: 498 }));
      const planned = payload.scope.outcome === 'Website' ? ['catalogue', 'hero', 'wide', 'detail'].map(role => ({ role, camera: '', light: '' })) : plannedImages(state.brief);
      const ctx = planContext(state.brief);
      mockState.jobs.set(payload.clientRunId, { outcome: payload.scope.outcome, planned, file: file.name, aspect: payload.scope.aspect,
        pictures: planned.map((img, i) => composeMock(img, i + 1, payload.scope.aspect, ctx, product)) });
      if (s === 'duplicate') return later(mockRefusal('duplicate', 409));
      return later({ status: 202, data: { ok: true, accepted: true, id: payload.clientRunId, images_asked: payload.scope.imageCount } });
    },
    status: id => {
      const s = mockState.result;
      const seen = (mockState.checks.get(id) || 0) + 1;
      mockState.checks.set(id, seen);
      if (s === 'unreachable') return later({ network: true });
      if (s === 'signedout') return later(mockRefusal('access_denied', 401));
      if (s === 'unknown') return later(mockRefusal('unknown_request', 404));
      if (s === 'never' || seen < 2) return later({ status: 200, data: { contract: 'midas-result/1', found: true, state: 'not_finished', images: [] } });
      mockState.lastResult = mockResult(id);
      return later({ status: 200, data: mockState.lastResult });
    }
  };
  const api = MOCK ? mock : live;
  if (MOCK) window.MIDAS_STUDIO_MOCK = mockState;
  const pollCfg = () => (MOCK ? MOCK_POLL : STUDIO_CONFIG.poll);

  function interpret(res) {
    if (!res || res.network || !res.data || typeof res.data !== 'object') return { kind: 'network' };
    const data = res.data;
    const reason = data.reason || (res.status >= 400 ? (REASON_BY_STATUS[res.status] || 'refused') : '');
    if (reason && data.ok !== true && data.found !== true) return { kind: 'refused', reason: String(reason), message: String(data.message || t('submit.refused')), data };
    return { kind: 'ok', data };
  }
  function safeImageUrl(text) {
    if (!text) return '';
    try {
      const url = new URL(String(text), window.location.href);
      if (url.protocol === 'https:') return url.href;
      if (MOCK && url.href.startsWith('data:image/')) return url.href;   // mock pictures only
      return '';
    } catch (error) { return ''; }
  }

  /* ------------------------------------------------------------------ the result contract (midas-result/1): reading it
     The page never decides an approval. An image shows "Approved" or "Approved by the studio" only when the studio's record
     says state "approved", carries a decision time and names one of those two labels in client_shown_as. */
  const IMAGE_STATES = ['in_production', 'passed_checks', 'on_hold', 'not_made', 'approved', 'changes_requested', 'not_approved'];
  const CLIENT_LABELS = ['Approved', 'Approved by the studio'];
  function readImage(raw, i) {
    const img = raw && typeof raw === 'object' ? raw : {};
    let st = IMAGE_STATES.includes(img.state) ? img.state : 'not_made';   // an unknown state never shows a picture
    const decided = !!img.decided_at && !Number.isNaN(Date.parse(img.decided_at));
    let label = '';
    if (st === 'approved') {
      if (decided && CLIENT_LABELS.includes(img.client_shown_as)) label = img.client_shown_as;
      else { st = 'unread'; console.warn('[studio] An approval without a readable client label was not shown as approved.', { slot: img.slot }); }
    }
    return {
      slot: Number(img.slot) || i + 1, role: String(img.role || ''), camera: String(img.camera || ''), light: String(img.light || ''),
      state: st, label, reason: String(img.reason || ''), note: String(img.note || ''),
      url: st === 'not_made' || st === 'in_production' ? '' : safeImageUrl(img.image_url),
      decidedAt: decided ? img.decided_at : '', checks: Array.isArray(img.checks) ? img.checks : []
    };
  }
  function readResult(data, expected) {
    const images = (Array.isArray(data.images) ? data.images : []).map(readImage);
    const pkg = data.package && typeof data.package === 'object' ? data.package : {};
    const finished = data.state === 'finished';
    const n = images.length;
    const count = name => images.filter(img => img.state === name).length;
    const approved = count('approved'), passed = count('passed_checks'), notMade = count('not_made');
    const everyApproved = n > 0 && approved === n;
    // Complete only when the studio says so AND every planned image is approved: an incomplete package is never shown as complete.
    const complete = finished && pkg.complete === true && everyApproved && n >= Math.max(Number(data.images_planned) || 0, Number(expected) || 0, 1);
    let status;
    if (!finished) status = 'sent';
    else if (everyApproved) status = complete ? 'approved' : 'part_approved';
    else if (approved + passed === n && n) status = 'ready';
    else if (approved + passed > 0) status = approved ? 'part_approved' : 'partial';
    else status = 'hold';
    const decided = images.filter(img => ['not_approved', 'changes_requested', 'unread'].includes(img.state)).length;
    return { finished, images, pkg, complete, status, n, approved, passed, notMade, decided, summary: String(data.summary || '') };
  }

  /* ------------------------------------------------------------------ the frames: one per image, at its proportions */
  const wallHex = v => (OPT.wall.find(([name]) => name === v) || [])[1] || '';
  const floorHex = v => (OPT.floor.find(([name]) => name === v) || [])[1] || '';
  /* The product shown in the frames. Before the client adds a photo: a sample Midas product (FAUVA reception chair, SKU 169741,
     catalogue photo from midasfurniture.com, cut out from its white background), always named as a sample. After: the client's
     own photo. When it was taken on a white background, this page cuts that background away in the browser (nothing is sent);
     otherwise the photo is shown as it is. Either way it is a preview placed by this page, never a studio image. */
  const SAMPLE = { src: 'sample/fauva-169741.webp' };
  const product = { kind: 'sample', src: SAMPLE.src, img: null, token: 0 };
  function loadImage(src) {
    return new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = reject; im.src = src; });
  }
  /* Cut away a white background that touches the photo's edges. Returns a PNG data URL, or '' when the photo is not on white
     (or the browser refuses to read the pixels). White parts inside the product are kept: only edge-connected white goes. */
  function cutOut(im) {
    try {
      const scale = Math.min(1, 640 / Math.max(im.naturalWidth, im.naturalHeight));
      const w = Math.max(1, Math.round(im.naturalWidth * scale)), h = Math.max(1, Math.round(im.naturalHeight * scale));
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      const c = canvas.getContext('2d', { willReadFrequently: true });
      c.drawImage(im, 0, 0, w, h);
      const data = c.getImageData(0, 0, w, h), px = data.data;
      const near = i => { const r = px[i], g = px[i + 1], b = px[i + 2]; const lo = Math.min(r, g, b); return lo >= 226 && Math.max(r, g, b) - lo <= 18; };
      const bg = new Uint8Array(w * h), queue = new Int32Array(w * h);
      let head = 0, tail = 0;
      const seed = (x, y) => { const k = y * w + x; if (!bg[k] && near(k * 4)) { bg[k] = 1; queue[tail++] = k; } };
      for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
      for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }
      while (head < tail) {
        const k = queue[head++], x = k % w, y = (k - x) / w;
        if (x > 0) seed(x - 1, y); if (x < w - 1) seed(x + 1, y); if (y > 0) seed(x, y - 1); if (y < h - 1) seed(x, y + 1);
      }
      if (tail / (w * h) < 0.12) return '';                  // not on a white background: show the photo as it is
      let x0 = w, y0 = h, x1 = 0, y1 = 0;
      for (let k = 0; k < w * h; k++) {
        const x = k % w, y = (k - x) / w;
        if (bg[k]) { px[k * 4 + 3] = 0; continue; }
        const edge = (x > 0 && bg[k - 1]) || (x < w - 1 && bg[k + 1]) || (y > 0 && bg[k - w]) || (y < h - 1 && bg[k + w]);
        if (edge) px[k * 4 + 3] = 150;                         // a soft edge
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      if (x1 <= x0 || y1 <= y0) return '';
      c.putImageData(data, 0, 0);
      const out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
      out.getContext('2d').drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
      return out.toDataURL('image/png');
    } catch (error) { return ''; }                             // pixels not readable here: show the photo as it is
  }
  async function prepareProduct() {
    const token = ++product.token;
    let next;
    if (!state.file) next = { kind: 'sample', src: SAMPLE.src };
    else {
      next = { kind: 'photo', src: state.fileUrl };
      try { const cut = cutOut(await loadImage(state.fileUrl)); if (cut) next = { kind: 'cut', src: cut }; } catch (error) { /* keep the photo as it is */ }
    }
    let img = null;
    try { img = await loadImage(next.src); } catch (error) { img = null; }
    if (token !== product.token) return;                     // a newer photo arrived meanwhile
    Object.assign(product, next, { img });
    renderBrief();
  }
  const productForRun = run => (run && state.fileRunId === run.id ? product : null);
  /* A frame shows the set of one planned image: wall, floor and light as chosen, the product at the scale of the view. */
  function frameSet(img, ctx, prod) {
    const set = el('div', { class: 'frame__set' });
    const scene = img.role !== 'catalogue';
    if (scene) {
      if (ctx.studio) set.classList.add('is-studio');
      if (ctx.wall) set.style.setProperty('--wall', ctx.wall);
      if (ctx.floor) set.style.setProperty('--floor', ctx.floor);
      set.dataset.light = ctx.studio ? 'studio' : (img.light || 'none');
    } else set.classList.add('is-white');
    if (prod && prod.src) {
      if (prod.kind === 'photo') set.append(el('img', { class: 'frame__photo' + (scene ? '' : ' frame__photo--white'), src: prod.src, alt: '', decoding: 'async' }));
      else set.append(el('span', { class: 'frame__floorshadow frame__floorshadow--' + img.role, 'aria-hidden': 'true' }),
        el('img', { class: 'frame__product frame__product--' + img.role + (img.camera === '45° right' ? ' is-turned' : ''), src: prod.src, alt: '', decoding: 'async' }));
    }
    return set;
  }
  /* Mock mode only: a stand-in picture drawn from the same set and product, marked "Mock picture n" on the image itself. */
  const LIGHTS = {
    day: [['rgba(255,255,240,0.50)', 0], ['rgba(255,255,240,0)', 0.58]],
    warm: [['rgba(240,168,76,0.42)', 0], ['rgba(240,168,76,0)', 0.6]],
    night: [['rgba(10,18,40,0.50)', 0], ['rgba(10,18,40,0.38)', 1]]
  };
  const PLACE = { catalogue: [0.6, 0.2], hero: [0.48, 0.12], wide: [0.24, 0.22], detail: [1.5, -0.3] };   // width share, bottom offset
  function composeMock(img, n, aspect, ctx, prod) {
    try {
      if (!prod || !prod.img || prod.kind === 'photo') return '';
      const [rw, rh] = String(img.role === 'catalogue' ? '1:1' : aspect || '1:1').split(':').map(Number);
      const W = 900, H = Math.round(900 * (rh || 1) / (rw || 1));
      const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
      const c = canvas.getContext('2d');
      if (img.role === 'catalogue') { c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H); }
      else {
        c.fillStyle = ctx.studio ? '#E4DED2' : (ctx.wall || '#DCD5C8'); c.fillRect(0, 0, W, H * 0.68);
        c.fillStyle = ctx.studio ? '#CBBFA9' : (ctx.floor || '#B9A88F'); c.fillRect(0, H * 0.68, W, H * 0.32);
      }
      const [share, bottom] = PLACE[img.role] || PLACE.hero;
      let pw = W * share, ph = pw * prod.img.naturalHeight / prod.img.naturalWidth;
      if (img.role !== 'detail' && ph > H * 0.8) { ph = H * 0.8; pw = ph * prod.img.naturalWidth / prod.img.naturalHeight; }
      const px = (W - pw) / 2, py = H - H * bottom - ph;
      c.fillStyle = 'rgba(13,27,42,0.16)';
      c.beginPath(); c.ellipse(W / 2, py + ph * 0.99, pw * 0.46, Math.max(4, ph * 0.035), 0, 0, Math.PI * 2); c.fill();
      c.drawImage(prod.img, px, py, pw, ph);
      const light = img.role === 'catalogue' || ctx.studio ? null : LIGHTS[img.light];
      if (light) { const g = c.createLinearGradient(0, 0, W, H * 0.5); light.forEach(([col, at]) => g.addColorStop(at, col)); c.fillStyle = g; c.fillRect(0, 0, W, H); }
      const label = t('mock.picture', { n });
      c.font = '500 26px Jost, sans-serif';
      const tw = c.measureText(label).width;
      c.fillStyle = 'rgba(13,27,42,0.86)'; c.fillRect(18, H - 60, tw + 28, 42);
      c.fillStyle = '#E6C17A'; c.fillText(label, 32, H - 31);
      return canvas.toDataURL('image/jpeg', 0.86);
    } catch (error) { return ''; }                             // pixels not readable here: the plain stand-in is used
  }
  function frameNode(img, n, ctx, inner, caption, prod) {
    const ratio = img.role === 'catalogue' ? '1:1' : ctx.aspect;
    const fig = el('div', { class: 'frame', role: 'listitem', style: '--ratio:' + (OPT.ratios[ratio] || '1 / 1') });
    fig.append(el('div', { class: 'frame__box' }, inner || frameSet(img, ctx, prod)), caption || el('p', { class: 'frame__cap', text: t('plan.frameCaption', { n, name: imageName(img) }) }));
    return fig;
  }
  function planContext(b) {
    const e = effective(b);
    return { aspect: e.aspect, wall: wallHex(e.wallPaint), floor: floorHex(e.floor), studio: !!b.studioChoice };
  }

  /* ------------------------------------------------------------------ static content */
  function renderStatic() {
    $('notes-steps').replaceChildren(...STRINGS.notes.steps.map(step => el('li', {}, el('strong', { text: step.title }), el('span', { text: step.body }))));
    const defs = (id, rows) => $(id).replaceChildren(...rows.flatMap(([term, def]) => [el('dt', { text: term }), el('dd', { text: def })]));
    defs('notes-outcomes', STRINGS.notes.outcomes);
    defs('notes-labels', STRINGS.notes.labels);
    $('notes-faq').replaceChildren(...STRINGS.notes.faq.map(item => el('details', { class: 'faq' }, el('summary', { text: item.q }), el('p', { text: item.a }))));
  }

  /* ------------------------------------------------------------------ brief controls (radio buttons: keyboard and screen readers for free) */
  function opt(name, value, label, more) {
    const input = el('input', { type: 'radio', name, value });
    if (more && more.full) input.setAttribute('aria-label', more.full);
    if (more && more.later) input.disabled = true;                 // "Coming later": shown, never selectable, never sent
    const node = el('label', { class: 'opt' + (more && more.swatch ? ' opt--swatch' : '') + (more && more.later ? ' opt--later' : '') }, input,
      el('span', { class: 'opt__face' }, more && more.swatch ? el('i', { 'aria-hidden': 'true' }) : null, label,
        more && more.later ? el('b', { class: 'tag tag--later opt__tag', text: t('labels.later') }) : null));
    if (more && more.swatch) node.style.setProperty('--swatch', more.swatch);
    return node;
  }
  function buildControls() {
    $('outcome-tabs').replaceChildren(
      ...OPT.outcomes.map(value => el('label', { class: 'outcome' },
        el('input', { type: 'radio', name: 'outcome', value }),
        el('span', { class: 'outcome__face' }, el('strong', { text: STRINGS.scope.options[value].title }), el('small', { text: STRINGS.scope.options[value].body })))),
      ...STRINGS.ws.laterOutcomes.map(label => el('label', { class: 'outcome outcome--later' },
        el('input', { type: 'radio', name: 'outcome-later', disabled: true }),
        el('span', { class: 'outcome__face' }, el('strong', { text: label }), el('b', { class: 'tag tag--later', text: t('labels.later') })))));
    $('view-choices').replaceChildren(...OPT.view.map(v => opt('view', v, STRINGS.options.view[v])));
    $('series-choices').replaceChildren(...OPT.series.map(v => opt('series', v, STRINGS.options.series[v])),
      ...OPT.seriesLater.map(v => opt('series-later', v, STRINGS.options.series[v], { later: true })));
    $('camera-choices').replaceChildren(...OPT.camera.map(v => opt('camera', v, STRINGS.options.camera[v])),
      ...OPT.cameraLater.map(v => opt('camera-later', v, STRINGS.options.camera[v], { later: true })));
    fillAspect('free', state.brief.aspect);
    $('resolution-choices').replaceChildren(...OPT.resolution.map(v => opt('resolution', v, STRINGS.options.resolutionShort[v], { full: STRINGS.options.resolution[v] })));
    $('lighting-choices').replaceChildren(opt('lighting', '', t('labels.studioChoice')), ...OPT.lighting.map(v => opt('lighting', v, STRINGS.options.lighting[v])));
    $('wall-choices').replaceChildren(opt('wallPaint', '', t('labels.studioChoice')), ...OPT.wall.map(([v, hex]) => opt('wallPaint', v, STRINGS.options.wall[v], { swatch: hex })));
    $('floor-choices').replaceChildren(opt('floor', '', t('labels.studioChoice')), ...OPT.floor.map(([v, hex]) => opt('floor', v, STRINGS.options.floor[v], { swatch: hex })));
    fillSelect($('department'), [['', t('labels.auto')], ...departments.map(node => [node.id, node.name])], '');
  }
  const radios = name => [...document.querySelectorAll('input[type="radio"][name="' + name + '"]')];
  const radio = (name, value) => { const input = radios(name).find(node => node.value === value); if (input) input.checked = true; };
  const checkedValue = name => { const input = radios(name).find(node => node.checked); return input ? input.value : ''; };
  const lock = (name, disabled) => radios(name).forEach(node => { node.disabled = disabled; });
  function fillAspect(mode, value) {
    const select = $('aspect');
    if (mode === 'white') {
      select.replaceChildren(el('option', { value: 'white', text: STRINGS.options.aspect['1:1'] }));
      select.value = 'white'; select.disabled = true;
      return;
    }
    const groups = OPT.aspectGroups.map(([group, list]) => el('optgroup', { label: STRINGS.options.aspectGroups[group] },
      ...list.map(v => el('option', { value: v, text: STRINGS.options.aspect[v] }))));
    select.replaceChildren(el('option', { value: 'standard', text: STRINGS.options.aspect.standard }), ...groups);
    select.value = mode === 'web' ? '1:1' : (OPT.aspect.includes(value) ? value : 'standard');
    select.disabled = mode === 'web';
  }

  /* Pieces in the photo: rows of "how many" and "piece". Rendered only when rows are added, removed or loaded. */
  function renderPieces() {
    const list = $('pieces-list');
    list.replaceChildren(...state.brief.pieces.map((piece, i) => {
      const n = i + 1;
      return el('li', { class: 'piece' }, el('div', { class: 'piece__row', role: 'group', 'aria-label': t('pieces.rowLabel', { n }) },
        el('label', { class: 'piece__count' }, el('span', { class: 'sr-only', text: t('pieces.count') }),
          el('input', { type: 'number', inputmode: 'numeric', min: '1', max: '199', step: '1', value: String(piece.count), 'data-piece': String(i), 'data-field': 'count', 'aria-label': t('pieces.count') + ', ' + t('pieces.rowLabel', { n }) })),
        el('label', { class: 'piece__name' }, el('span', { class: 'sr-only', text: t('pieces.name') }),
          el('input', { type: 'text', maxlength: '60', autocomplete: 'off', value: piece.item, placeholder: t('pieces.name'), 'data-piece': String(i), 'data-field': 'item', 'aria-label': t('pieces.name') + ', ' + t('pieces.rowLabel', { n }) })),
        el('button', { type: 'button', class: 'btn btn--text piece__remove', text: t('pieces.remove'), 'aria-label': t('pieces.remove') + ', ' + t('pieces.rowLabel', { n }),
          onclick: () => { state.brief.pieces.splice(i, 1); renderPieces(); briefChanged(); focusNode($('pieces-add')); } })));
    }));
    $('pieces-add').disabled = state.brief.pieces.length >= OPT.maxPieces;
  }

  /* Put the brief into the form. */
  function syncForm() {
    const b = state.brief, e = effective(b), web = isWebsite(b), white = isWhite(b);
    radio('outcome', b.outcome);
    $('department').value = departments.some(node => node.id === b.department) ? b.department : '';
    b.department = $('department').value;
    fillCategories();
    $('sku').value = b.sku; $('dimensions').value = b.dimensions; $('about').value = b.about;
    radio('view', b.view); radio('resolution', e.resolution);
    radio('series', 'Single image'); radio('camera', b.camera);
    fillAspect(white ? 'white' : (web ? 'web' : 'free'), b.aspect);
    show($('card-view'), !web); show($('website-note'), web);
    show($('card-series'), !web); show($('card-camera'), !web);
    lock('series', white); show($('series-note-white'), white);
    if (white) radios('series').forEach(node => { node.checked = false; });
    $('series-desc').textContent = white ? '' : STRINGS.scope.seriesNotes['Single image'];
    show($('series-desc'), !white);
    lock('view', white); show($('view-note'), white);
    if (white) radios('view').forEach(node => { node.checked = false; });
    lock('camera', white); show($('camera-note-white'), white);
    if (white) radios('camera').forEach(node => { node.checked = false; });
    lock('resolution', web);
    $('studio-choice').checked = b.studioChoice;
    radio('lighting', b.lighting); radio('wallPaint', b.wallPaint); radio('floor', b.floor);
    lock('lighting', b.studioChoice); lock('wallPaint', b.studioChoice); lock('floor', b.studioChoice);
    show($('card-wall'), !white); show($('card-floor'), !white); show($('white-note'), white);
    show($('card-lighting'), !white); show($('card-atmosphere'), !white);
    show($('touches-fields'), !white); show($('touches-white'), white);
    $('human').checked = e.life && b.human; $('human').disabled = !e.life; show($('human-web-note'), web);
    $('color').value = b.color; $('material').value = b.material; $('locks').value = b.locks; $('must-not').value = b.mustNot; $('instructions').value = b.instructions;
    document.querySelectorAll('.switch input').forEach(input => {
      input.closest('.switch').querySelector('strong').dataset.state = input.checked ? t('labels.on') : t('labels.off');
    });
    renderBrief();
  }
  /* Read the form back into the brief. */
  function readForm() {
    const b = state.brief, wasWeb = isWebsite(b), wasWhite = isWhite(b), wasLife = isLife(b);
    const department = $('department').value;
    if (department !== b.department) { b.department = department; b.category = ''; b.subCategory = ''; }
    else {
      const category = $('category').value;
      if (category !== b.category) { b.category = category; b.subCategory = ''; }
      else b.subCategory = $('sub-category').value;
    }
    b.sku = $('sku').value; b.dimensions = $('dimensions').value; b.about = $('about').value;
    document.querySelectorAll('#pieces-list input[data-piece]').forEach(input => {
      const piece = b.pieces[Number(input.dataset.piece)];
      if (!piece) return;
      if (input.dataset.field === 'item') piece.item = input.value;
      else piece.count = input.value === '' ? '' : Number(input.value);
    });
    b.outcome = checkedValue('outcome') || b.outcome;
    if (!wasWeb && !isWebsite(b)) {                      // while Website is chosen these show its fixed values
      if (!wasWhite && !isWhite(b)) {                    // while White BK is chosen the view, camera and shape are fixed too
        b.view = checkedValue('view') || b.view;
        b.camera = checkedValue('camera') || b.camera;
        const shape = $('aspect').value;
        if (OPT.aspect.includes(shape)) b.aspect = shape;
      }
      b.resolution = checkedValue('resolution') || b.resolution;
    }
    const choose = $('studio-choice').checked;
    if (isWhite(b)) { /* lighting, wall, floor and the switch are hidden on white: the client's choices are kept for later */ }
    else if (choose && !b.studioChoice) { b.lighting = ''; b.wallPaint = ''; b.floor = ''; }
    else if (!choose) {
      b.lighting = checkedValue('lighting');
      if (!isWhite(b)) { b.wallPaint = checkedValue('wallPaint'); b.floor = checkedValue('floor'); }
    }
    if (!isWhite(b)) b.studioChoice = choose;
    if (wasLife && isLife(b)) b.human = $('human').checked;
    b.color = $('color').value; b.material = $('material').value; b.locks = $('locks').value; b.mustNot = $('must-not').value; b.instructions = $('instructions').value;
  }
  function briefChanged() {
    forgetRunId();
    clearSubmitMessage(); show($('brief-errors'), false);
    saveDraft();
    syncForm();
  }
  function saveDraft() {
    state.draftSavedAt = Date.now();
    write(LS, KEY.draft, { brief: state.brief, savedAt: state.draftSavedAt });   // no file, no access code
    $('draft-note').textContent = t('ws.draftSaved', { time: timeText(state.draftSavedAt) });
  }
  function loadDraft() {
    const draft = read(LS, KEY.draft);
    if (!draft || typeof draft.brief !== 'object' || !draft.brief) return;
    const base = defaultBrief();
    for (const key of Object.keys(base)) if (typeof draft.brief[key] === typeof base[key]) base[key] = draft.brief[key];
    base.pieces = Array.isArray(base.pieces) ? base.pieces.filter(p => p && typeof p === 'object').slice(0, OPT.maxPieces)
      .map(p => ({ item: String(p.item || '').slice(0, 60), count: Number.isFinite(Number(p.count)) ? Number(p.count) : 1 })) : [];
    if (!OPT.outcomes.includes(base.outcome)) base.outcome = 'Lifestyle';
    for (const [key, list] of [['view', OPT.view], ['camera', OPT.camera], ['aspect', OPT.aspect], ['resolution', OPT.resolution]]) if (!list.includes(base[key])) base[key] = list[0];
    base.series = 'Single image';
    if (base.lighting && !OPT.lighting.includes(base.lighting)) base.lighting = '';
    if (base.floor && !OPT.floor.some(([v]) => v === base.floor)) base.floor = '';
    if (base.wallPaint && !OPT.wall.some(([v]) => v === base.wallPaint)) base.wallPaint = '';
    state.brief = base;
    state.draftSavedAt = Number(draft.savedAt) || 0;
  }
  const hasDraft = () => state.draftSavedAt > 0 && JSON.stringify(state.brief) !== JSON.stringify(defaultBrief());
  function resetBrief() {
    state.brief = defaultBrief(); state.draftSavedAt = 0;
    setFile(null); photoError(''); forgetRunId(); drop(LS, KEY.draft);
    clearSubmitMessage(); show($('brief-errors'), false);
    $('draft-note').textContent = t('ws.draftIdle');
    renderPieces(); syncForm();
  }
  function forgetRunId() { if (state.sending) return; if (state.runId) { state.runId = ''; drop(LS, KEY.unsent); } }   // never while a send is in flight

  /* ------------------------------------------------------------------ product photo */
  function setFile(file) {
    if (state.fileUrl) URL.revokeObjectURL(state.fileUrl);
    state.file = file || null;
    state.fileUrl = file ? URL.createObjectURL(file) : '';
    state.fileRunId = '';
    $('photo').value = '';
    show($('drop'), !file); show($('photo-preview'), !!file);
    if (file) {
      $('photo-thumb').src = state.fileUrl;
      $('photo-thumb').alt = t('item.thumbAlt', { name: file.name });
      $('photo-name').textContent = file.name;
      $('photo-size').textContent = sizeText(file.size);
    } else $('photo-thumb').removeAttribute('src');
    prepareProduct();
  }
  function photoError(text) {
    const node = $('photo-error');
    node.textContent = text ? t('labels.error') + ' ' + text : '';
    show(node, !!text);
    $('photo').setAttribute('aria-invalid', text ? 'true' : 'false');
  }
  function takeFiles(list) {
    const files = [...(list || [])];
    if (!files.length) return;
    const file = files[0];
    if (!file.type) { photoError(t('item.errNoType', { name: file.name })); $('photo').value = ''; return; }   // the studio registers a product photo only by its image type
    if (!FILE_TYPES.includes(file.type)) { photoError(t('item.errType', { name: file.name })); $('photo').value = ''; return; }
    if (file.size > STUDIO_CONFIG.maxFileBytes) { photoError(t('item.errSize', { name: file.name })); $('photo').value = ''; return; }
    photoError('');
    setFile(file);
    forgetRunId(); clearSubmitMessage(); show($('brief-errors'), false); renderBrief();
    announce((files.length > 1 ? t('item.onlyOne', { name: file.name }) + ' ' : '') + t('item.added', { name: file.name }));
    focusNode($('photo-replace'));
  }

  const inProduction = () => state.stage === 'progress' && !watch.stopped;

  /* ------------------------------------------------------------------ the brief at a glance: values, spines and the plan */
  const imagesText = n => (n === 1 ? t('review.images', { n: 1 }) : t('review.imagesMany', { n }));
  function renderBrief() {
    const b = state.brief, e = effective(b), web = isWebsite(b), white = isWhite(b);
    const outcome = STRINGS.scope.options[b.outcome];
    const pick = value => value || t('labels.studioChoice');
    const set = (id, text) => { $(id).textContent = text; };
    set('val-photo', state.file ? t('ws.added') : t('ws.required'));
    set('val-item', [nodeName(b.department), nodeName(b.category), subLabel()].filter(Boolean).join(' / ') || t('labels.auto'));
    set('val-pieces', validPieces(b).length ? t('ws.piecesCount', { n: validPieces(b).length }) : t('ws.optional'));
    const kept = [b.color, b.material, b.about].filter(text => text.trim()).length + lines(b.locks).length + lines(b.mustNot).length;
    set('val-faithful', kept ? t('ws.detailsCount', { n: kept }) : t('ws.optional'));
    set('val-outcome', outcome.title);
    set('outcome-desc', ''); show($('outcome-desc'), false);   // each outcome card already says what it makes
    set('val-view', white ? t('ws.notOnWhite') : STRINGS.options.view[e.view]);
    set('val-series', white ? t('ws.notOnWhite') : STRINGS.options.series[e.series]);
    set('val-camera', white ? t('ws.notOnWhite') : (STRINGS.options.camera[e.camera] || ''));
    set('val-aspect', web ? t('ws.setForWebsite', { v: STRINGS.options.aspect['1:1'] }) : (white ? t('scope.aspectWhite') : t('scope.aspectScene')));
    set('val-resolution', web ? t('ws.setForWebsite', { v: STRINGS.options.resolution[e.resolution] }) : STRINGS.options.resolution[e.resolution]);
    set('val-atmosphere', b.studioChoice ? t('labels.studioChoice') : '');
    set('val-lighting', pick(STRINGS.options.lighting[e.lighting]));
    set('val-wall', pick(STRINGS.options.wall[e.wallPaint]));
    set('val-floor', pick(STRINGS.options.floor[e.floor]));
    set('val-touches', white ? t('ws.notOnWhite') : (e.human ? t('sug.human') : t('labels.none')));
    const joined = joinedInstructions(b).length;
    set('val-instructions', b.instructions.trim() ? t('ws.added') : t('ws.optional'));
    set('instructions-hint', joined > 900 ? t('sug.budget', { n: joined, max: INSTRUCTION_LIMIT }) : t('sug.instructionsHint'));
    $('instructions-hint').classList.toggle('is-warn', joined > INSTRUCTION_LIMIT);

    // The spines of the two leaves summarise them when folded.
    set('sum-piece', [state.file ? state.file.name : t('ws.required'), nodeName(b.category) || nodeName(b.department)].filter(Boolean).join(', '));
    set('sum-setting', [outcome.title, white ? '' : STRINGS.options.view[e.view], imagesText(e.imageCount)].filter(Boolean).join(', '));

    // The plan: one frame per image.
    const ctx = planContext(b);
    $('count-list').replaceChildren(...e.images.map((img, i) => frameNode(img, i + 1, ctx, null, null, product)));
    set('plan-sample', product.kind === 'sample' ? t('plan.sampleNote') : t('plan.yourNote'));
    show($('count-made'), false);
    const facts = [
      [STRINGS.plan.facts.outcome, outcome.title],
      [STRINGS.plan.facts.images, String(e.imageCount)],
      [STRINGS.plan.facts.shape, web || white ? STRINGS.options.aspect['1:1'] : STRINGS.options.aspect[b.aspect]],
      [STRINGS.plan.facts.resolution, STRINGS.options.resolution[e.resolution]],
      [STRINGS.plan.facts.atmosphere, white ? t('ws.notOnWhite') : (b.studioChoice || !(e.lighting || e.wallPaint || e.floor) ? t('plan.studioSet') : [pick(STRINGS.options.lighting[e.lighting]), pick(STRINGS.options.wall[e.wallPaint]), pick(STRINGS.options.floor[e.floor])].join(', '))],
      [STRINGS.plan.facts.touches, white ? t('ws.notOnWhite') : (e.human ? t('sug.human') : t('labels.none'))]
    ];
    $('plan-facts').replaceChildren(...facts.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })]));
    set('plan-lead', state.file ? t('plan.lead') : t('plan.leadNoPhoto'));

    const busy = inProduction();
    $('submit-btn').disabled = busy || state.sending;
    set('brief-hint', busy ? t('ws.hintBusy') : !state.file ? t('ws.hintNoPhoto')
      : web ? t('scope.expectWebsite') : white ? t('scope.expectWhite') : (STRINGS.scope.expectViews[b.view] || STRINGS.scope.expectViews['Category template']));
    set('submit-count', imagesText(e.imageCount));
    set('dock-count', t('dock.count', { n: imagesText(e.imageCount) }));
    const usage = usageText();
    set('brief-usage', usage); show($('brief-usage'), !!usage);
  }

  /* ------------------------------------------------------------------ the leaves: fold and open */
  function setFold(name, folded) {
    const leaf = $('leaf-' + name), button = $('fold-' + name);
    leaf.classList.toggle('is-folded', folded);
    button.setAttribute('aria-expanded', folded ? 'false' : 'true');
    show($('leaf-' + name + '-body'), !folded);
  }
  const foldBoth = folded => { setFold('piece', folded); setFold('setting', folded); };

  /* ------------------------------------------------------------------ session and the closed screen */
  function usageText() { const s = state.session; return s && s.limit > 0 ? t('session.usage', { used: s.used, limit: s.limit }) : ''; }
  function renderSession() {
    const signedIn = !!state.session;
    document.body.classList.toggle('is-in', signedIn);
    bind('clientName', signedIn ? state.session.clientName : '');
    bind('usage', usageText());
    if (!signedIn) { show($('view-app'), false); show($('view-signin'), true); $('view-signin').classList.remove('is-opening'); }
    renderRecent();
    if (signedIn) renderBrief();
  }
  /* The one motion that plays by itself: the closed screen folds open. Skipped when the client prefers less motion. */
  function openScreen(animate) {
    const threshold = $('view-signin');
    const done = () => { show(threshold, false); threshold.classList.remove('is-opening'); show($('view-app'), true); document.body.classList.add('is-open'); };
    if (!animate || REDUCED.matches || threshold.hidden) { done(); return Promise.resolve(); }
    threshold.classList.add('is-opening');
    return new Promise(resolve => window.setTimeout(() => { done(); resolve(); }, 900));
  }
  function saveSession() { write(SS, KEY.session, state.session); }
  function signOut(message) {
    stopWatching();
    drop(SS, KEY.code); drop(SS, KEY.session);
    state.session = null; state.result = null; state.run = null;
    setFile(null); forgetRunId();                          // the next client in this tab never sees this photo
    document.body.classList.remove('is-open');
    renderSession();
    const notice = $('signin-notice');
    notice.textContent = message || ''; show(notice, !!message);
    signinError('');
    focusNode(MOCK && mockState.signin === 'skip' ? $('mock-open') : $('access-code'));
    announce(message || t('auth.signedOut'));
  }
  function signinError(text) {
    const node = $('signin-error');
    node.textContent = text ? t('labels.error') + ' ' + text : '';
    show(node, !!text);
    $('access-code').setAttribute('aria-invalid', text ? 'true' : 'false');
  }
  async function onSignIn(event) {
    if (event) event.preventDefault();
    const input = $('access-code'), button = $('signin-submit');
    const code = input.value.trim();
    if (!code) { signinError(t('signin.empty')); focusNode(input); return; }
    if (button.disabled) return;
    signinError(''); show($('signin-notice'), false);
    button.disabled = true; button.textContent = t('signin.busy');
    const out = interpret(await api.signIn(code));
    button.disabled = false; button.textContent = t('signin.submit');
    if (out.kind === 'network') { signinError(t('signin.network')); focusNode(input); return; }
    if (out.kind === 'refused') { signinError(out.message); focusNode(input); return; }
    const d = out.data;
    if (d.ok !== true) { signinError(t('signin.network')); return; }
    write(SS, KEY.code, code);
    input.value = ''; input.type = 'password'; $('show-code').checked = false;
    state.session = { clientName: String(d.client_name || ''), role: String(d.role || 'client'), limit: Number(d.monthly_image_limit) || 0, used: Number(d.images_used_this_month) || 0 };
    saveSession(); renderSession();
    await openScreen(true);
    enterStudio(true);
    announce(t('signin.welcome', { name: state.session.clientName }));
  }
  async function onMockOpen() {                          // mock mode, sign-in skipped: open the inner screens to look at them
    write(SS, KEY.code, 'mock-preview');
    state.session = { clientName: t('mock.clientName'), role: 'client', limit: 500, used: 12 };
    saveSession(); renderSession();
    await openScreen(true);
    enterStudio(true);
  }
  function enterStudio(focus) {
    const pending = read(LS, KEY.pending);
    if (pending && pending.id && state.session && pending.clientName === state.session.clientName) {
      state.run = pending;
      setStage('progress');
      startWatching(false);
      if (focus) focusNode($('progress-title'));
    } else {
      setStage(state.result ? 'results' : 'plan');
      if (focus) focusNode($('fold-piece'));
    }
  }
  /* Leaf III shows one of three things: the plan, production, or the result. */
  function setStage(stage) {
    state.stage = stage;
    show($('view-plan'), stage === 'plan'); show($('view-progress'), stage === 'progress'); show($('view-results'), stage === 'results');
    $('plan-title').textContent = stage === 'plan' ? t('plan.title') : t('plan.titleResult');
    if (stage === 'plan') setTag(t('ws.tagIdle'), false);
    document.body.classList.toggle('is-running', stage !== 'plan');
    renderBrief(); renderRecent();
  }
  function setTag(text, strong) { const tag = $('result-tag'); tag.textContent = text; tag.classList.toggle('tag--gold', !!strong); }

  /* ------------------------------------------------------------------ submit */
  function clearSubmitMessage() { const box = $('submit-message'); box.replaceChildren(); show(box, false); }
  function submitMessage(text, retry) {
    const box = $('submit-message');
    box.replaceChildren(el('p', { text: t('labels.error') + ' ' + text }),
      retry ? el('button', { type: 'button', class: 'btn btn--line btn--sm', text: t('submit.tryAgain'), onclick: submitRequest }) : null);
    show(box, true); focusNode(box); announce(text);
  }
  function validate() {
    const b = state.brief, errors = [];   // [text, field to focus, leaf, kind]
    if (!state.file) errors.push([t('item.errMissing'), () => $('photo'), 'piece', 'photo']);
    else if (state.file.size > STUDIO_CONFIG.maxFileBytes) errors.push([t('item.errSize', { name: state.file.name }), () => $('photo-replace'), 'piece', 'photo']);
    b.pieces.forEach((p, i) => {
      const name = squash(p.item, 60), n = Number(p.count);
      if (name && !(p.count !== '' && Number.isInteger(n) && n > 0 && n < 200)) errors.push([t('pieces.errCount', { name }), () => document.querySelector('#pieces-list input[data-piece="' + i + '"][data-field="count"]'), 'piece', 'pieces']);
    });
    // 01 cuts each detail to preserve at 160 characters and each thing to exclude at 80: never cut silently.
    const longLock = lines(b.locks).find(line => squash(line, 1000).length > 160);
    if (longLock) errors.push([t('sug.errLockLine', { start: squash(longLock, 40) }), () => $('locks'), 'piece', 'locks']);
    const longEx = lines(b.mustNot).find(line => squash(line, 1000).length > 80);
    if (longEx) errors.push([t('sug.errExcludeLine', { start: squash(longEx, 40) }), () => $('must-not'), 'piece', 'mustnot']);
    const over = joinedInstructions(b).length - INSTRUCTION_LIMIT;
    if (over > 0) errors.push([t('sug.errBudget', { n: over }), () => $('instructions'), 'setting', 'budget']);
    const first = kind => errors.find(err => err[3] === kind);
    photoError(first('photo') ? first('photo')[0] : '');                   // next to the field …
    $('pieces-error').textContent = first('pieces') ? t('labels.error') + ' ' + first('pieces')[0] : '';
    show($('pieces-error'), !!first('pieces'));
    const box = $('brief-errors');                                          // … and summarised by the button
    if (!errors.length) { show(box, false); return true; }
    box.replaceChildren(el('h4', { text: t('ws.errorsTitle') }), el('ul', {}, ...errors.map(([text, target, leaf]) => el('li', {},
      el('a', { href: '#leaf-' + leaf, text, onclick: event => { event.preventDefault(); event.stopPropagation(); setFold(leaf, false); const node = target(); if (node) { node.scrollIntoView({ block: 'center' }); focusNode(node); } } })))));
    show(box, true); focusNode(box);
    return false;
  }
  /* While a request is being sent, the brief, New request and Sign out wait: the reply must land on the request that was sent. */
  function lockWhileSending(on) {
    ['leaf-piece', 'leaf-setting'].forEach(id => { $(id).inert = on; });
    document.querySelectorAll('[data-action="new"], [data-action="signout"]').forEach(btn => { btn.disabled = on; });
  }
  async function submitRequest() {
    if (state.sending || !state.session || inProduction()) return;
    clearSubmitMessage();
    if (!validate()) return;
    if (!state.runId) { state.runId = newId(); write(LS, KEY.unsent, { id: state.runId, createdAt: Date.now() }); }
    const id = state.runId;
    const payload = buildPayload(id);
    const button = $('submit-btn'), label = $('submit-label');
    // What was sent, fixed before the wait: nothing the client does during the send can change it.
    const sent = { file: state.file, fileName: state.file.name, planned: plannedImages(state.brief), ctx: planContext(state.brief), outcome: payload.scope.outcome, aspect: payload.scope.aspect, clientName: state.session.clientName };
    state.sending = true; button.disabled = true; label.textContent = t('ws.sending'); lockWhileSending(true);
    const out = interpret(await api.submit(payload, sent.file));
    state.sending = false; button.disabled = false; label.textContent = t('ws.submit'); lockWhileSending(false);
    if (out.kind === 'network') { submitMessage(t('submit.network'), true); return; }
    const accepted = out.kind === 'ok' && out.data.ok === true && out.data.accepted === true;
    const duplicate = out.kind === 'refused' && out.reason === 'duplicate';
    if (accepted || duplicate) {
      const asked = accepted ? (Number(out.data.images_asked) || payload.scope.imageCount) : payload.scope.imageCount;
      const run = { id, acceptedAt: Date.now(), lastCheckAt: 0, imagesAsked: asked, fileName: sent.fileName, outcome: sent.outcome, aspect: sent.aspect, planned: sent.planned, ctx: sent.ctx, clientName: sent.clientName };
      state.run = run; state.result = null; state.fileRunId = id; state.runId = '';
      drop(LS, KEY.unsent); write(LS, KEY.pending, run);
      addRecent(run);
      if (accepted && state.session && state.session.limit > 0) { state.session.used += asked; saveSession(); bind('usage', usageText()); }
      if (WIDE.matches) foldBoth(true);                  // the two leaves fold away so the result has the room
      setStage('progress');
      startWatching(false);
      focusNode($('progress-title'));
      announce(t('progress.announceRunning'));
      return;
    }
    if (out.kind === 'refused') {
      if (out.reason === 'access_denied' || out.reason === 'access_off') { signOut(out.message); return; }
      if (out.reason === 'limit_reached') {
        const limit = Number(out.data.monthly_image_limit), used = Number(out.data.images_used_this_month);
        if (Number.isFinite(limit) && Number.isFinite(used)) {
          state.session.limit = limit; state.session.used = used; saveSession(); bind('usage', usageText()); renderBrief();
          submitMessage(t('submit.limit', { message: out.message, used, limit }), false);
        } else submitMessage(out.message, false);
        return;
      }
      if (out.reason === 'bad_request') console.error('[studio] The studio refused the request as incomplete. This is a fault in the page.', { reason: out.reason });
      submitMessage(out.message, out.reason === 'try_again');
      return;
    }
    submitMessage(t('submit.refused'), true);
  }

  /* ------------------------------------------------------------------ progress and checking (never faster than the poll settings) */
  const watch = { timer: 0, clock: 0, failures: 0, token: 0, busy: false, stopped: true, lastAt: 0 };   // lastAt: the last check of any request
  function stopWatching() { watch.stopped = true; watch.token += 1; window.clearTimeout(watch.timer); window.clearInterval(watch.clock); }
  function savePending() { if (state.run && read(LS, KEY.pending)) write(LS, KEY.pending, state.run); }
  function setTimeline(received, production, ready) {
    const labels = { 'is-done': t('progress.stateDone'), 'is-now': t('progress.stateNow'), 'is-waiting': t('progress.stateWaiting'), 'is-unconfirmed': t('progress.stateUnconfirmed') };
    [['tl-received', received], ['tl-production', production], ['tl-ready', ready]].forEach(([id, cls]) => {
      const item = $(id);
      item.className = 'timeline__item ' + (cls === 'is-unconfirmed' ? 'is-waiting' : cls);
      item.querySelector('[data-role="state"]').textContent = labels[cls];
    });
  }
  function updateElapsed() { if (state.run) $('tl-elapsed').textContent = t('progress.elapsed', { time: elapsedText(Date.now() - state.run.acceptedAt) }); }
  /* While in production, the frames of the plan stay on screen; an image that is already back fills its frame. */
  function renderProgressFrames(partial) {
    const run = state.run;
    const planned = Array.isArray(run.planned) && run.planned.length ? run.planned : [];
    const ctx = Object.assign({ aspect: run.aspect || '1:1' }, run.ctx || {}, { aspect: run.aspect || '1:1' });
    const ready = partial ? partial.images : [];
    $('progress-frames').replaceChildren(...planned.map((img, i) => {
      const got = ready.find(r => r.slot === i + 1);
      const shown = got && got.url && (got.state === 'passed_checks' || got.state === 'approved');   // only ready pictures, each tagged
      const node = shown ? frameNode(img, i + 1, ctx, el('figure', {}, el('img', { src: got.url, alt: t('results.generatedAlt', { n: i + 1, file: run.fileName || '' }) }), el('figcaption', { class: 'tag tag--ink', text: t('labels.generated') }))) : frameNode(img, i + 1, ctx, null, null, productForRun(run));
      node.classList.add(shown ? 'is-back' : 'is-waiting');
      return node;
    }));
    const back = ready.filter(r => r.state === 'passed_checks' || r.state === 'approved').length;
    show($('progress-sofar'), back > 0);
    $('progress-sofar').textContent = back ? t('progress.soFar', { x: back, n: planned.length || ready.length }) : '';
  }
  function renderProgress() {
    const run = state.run;
    $('progress-title').textContent = t('progress.titleRunning');
    setTag(t('ws.tagProduction'), true);
    bind('reference', run.id);
    $('tl-received-time').textContent = t('progress.receivedAt', { time: dateTimeText(run.acceptedAt) });
    setTimeline('is-done', 'is-now', 'is-waiting');
    show($('progress-message'), false); show($('progress-back'), false);
    renderProgressFrames(null);
    updateElapsed();
  }
  function progressProblem(text, title, retry, tag) {
    stopWatching();
    $('progress-title').textContent = title;
    setTag(tag, false);
    setTimeline('is-done', 'is-unconfirmed', 'is-waiting');
    $('progress-message-text').textContent = text;
    const again = $('progress-retry');
    again.disabled = false; show(again, retry);
    show($('progress-back'), true);                      // the request stopped: the brief can be changed and sent again
    show($('progress-message'), true);
    renderBrief();
    focusNode($('progress-message'));
    announce(text);
  }
  function startWatching(immediate) {
    stopWatching();
    watch.stopped = false; watch.failures = 0; watch.busy = false;
    renderProgress(); renderBrief();
    watch.clock = window.setInterval(updateElapsed, 1000);
    scheduleCheck(immediate);
  }
  function scheduleCheck(immediate) {
    window.clearTimeout(watch.timer);
    if (watch.stopped || document.hidden || !state.run) return;
    const cfg = pollCfg(), run = state.run;
    const due = run.lastCheckAt ? run.lastCheckAt + cfg.everyMs : run.acceptedAt + cfg.firstMs;
    const paced = watch.lastAt + cfg.everyMs;            // never two checks closer than everyMs, whatever was clicked
    watch.timer = window.setTimeout(check, Math.max(0, immediate ? paced - Date.now() : Math.max(due, paced) - Date.now()));
  }
  async function check() {
    if (watch.stopped || watch.busy || !state.run || document.hidden) return;
    const token = watch.token, run = state.run, cfg = pollCfg();
    watch.busy = true; run.lastCheckAt = Date.now(); watch.lastAt = run.lastCheckAt; savePending();
    const out = interpret(await api.status(run.id));
    watch.busy = false;
    if (token !== watch.token) return;
    if (out.kind === 'refused' && (out.reason === 'access_denied' || out.reason === 'access_off')) { signOut(out.message); return; }
    if (out.kind === 'refused' && out.reason === 'unknown_request') {
      updateRecent(run.id, 'unknown'); drop(LS, KEY.pending);
      progressProblem(out.message, t('progress.titleUnknown'), false, t('ws.tagNotFound'));
      return;
    }
    if (out.kind !== 'ok') {
      watch.failures += 1;
      if (watch.failures >= cfg.maxFailures) { progressProblem(out.kind === 'refused' ? out.message : t('progress.unreachable'), t('progress.titleStopped'), true, t('ws.tagUnconfirmed')); return; }
      scheduleCheck(false);
      return;
    }
    watch.failures = 0;
    if (out.data.found === true && out.data.state === 'finished') { finishRun(out.data); return; }
    if (out.data.found === true && Array.isArray(out.data.images) && out.data.images.length) renderProgressFrames(readResult(out.data, expectedOf(run)));
    const limit = run.imagesAsked > 1 ? cfg.limitManyMs : cfg.limitOneMs;
    if (Date.now() - run.acceptedAt > limit) { progressProblem(t('progress.timeout'), t('progress.titleStopped'), true, t('ws.tagUnconfirmed')); return; }
    scheduleCheck(false);
  }
  function finishRun(data) {
    stopWatching();
    state.result = data;
    updateRecent(state.run.id, readResult(data, expectedOf(state.run)).status);
    drop(LS, KEY.pending);
    renderResults();
    setStage('results');
    focusNode($('results-title'));
    announce($('results-title').textContent + ' ' + $('results-lead').textContent);   // the headline worked out, never a fixed "ready"
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) window.clearTimeout(watch.timer);
    else if (!watch.stopped) scheduleCheck(false);
  });

  /* ------------------------------------------------------------------ results */
  function viewWord(image) {
    const R = STRINGS.results;
    const camera = R.cameras[image.camera] || '';
    return [R.views[image.role] || '', camera].filter(Boolean).join(', ');
  }
  function checkList(checks) {
    const entries = checks.filter(entry => Array.isArray(entry) && Object.prototype.hasOwnProperty.call(STRINGS.results.checkNames, entry[0]));   // unknown check ids are never shown
    if (!entries.length) return null;
    const bad = entries.filter(entry => String(entry[1]).toLowerCase() !== 'pass').length;
    return el('details', { class: 'details details--checks' },
      el('summary', { text: bad ? t('results.checksSome', { x: bad, n: entries.length }) : t('results.checksAll', { n: entries.length }) }),
      el('ul', {}, ...entries.map(entry => {
        const word = String(entry[1] || 'unknown').toLowerCase();
        const name = STRINGS.results.checkNames[entry[0]] || String(entry[0] || '').replace(/_/g, ' ');
        return el('li', {}, el('b', { text: name }), el('i', { class: word === 'pass' ? '' : 'is-bad', text: STRINGS.results.checkResults[word] || STRINGS.results.checkResults.unknown }),
          entry[2] ? el('span', { text: String(entry[2]) }) : null);
      })));
  }
  function statePill(img) {
    if (img.state === 'approved') return el('span', { class: 'pill pill--approved', text: img.label });   // the studio's own label, never chosen here
    const cls = { passed_checks: 'pill--passed', on_hold: 'pill--hold', not_made: 'pill--none', changes_requested: 'pill--hold', not_approved: 'pill--none', unread: 'pill--none', in_production: 'pill--none' }[img.state] || 'pill--none';
    return el('span', { class: 'pill ' + cls, text: STRINGS.results.state[img.state] || STRINGS.results.state.on_hold });
  }
  function shotCard(img, index, run, canCompare) {
    const n = img.slot || index + 1;
    const view = viewWord(img);
    const title = el('h4', { class: 'shot__title', text: view ? t('results.imageTitleView', { n, view }) : t('results.imageTitle', { n }) });
    const ratio = img.role === 'catalogue' ? '1:1' : run.aspect;
    const card = el('article', { class: 'shot shot--' + img.state, style: '--ratio:' + (OPT.ratios[ratio] || '1 / 1') });
    const planned = (run.planned || [])[n - 1] || { role: img.role, camera: img.camera, light: img.light };
    const ctx = Object.assign({}, run.ctx || {}, { aspect: run.aspect || '1:1' });
    if (img.state === 'not_made') {                     // never shown as an image: there is none
      card.append(el('div', { class: 'frame frame--empty' }, el('div', { class: 'frame__box' }, frameSet(planned, ctx, productForRun(run)))),
        el('div', { class: 'shot__head' }, title, statePill(img)),
        el('p', { class: 'shot__reason' }, el('strong', { text: t('results.reasonNotMade') + ' ' }), img.reason || t('results.notMadeFallback')));
      return card;
    }
    const media = el('div', { class: 'shot__media' });
    if (canCompare) media.append(el('figure', { class: 'shot__fig shot__fig--original' }, el('img', { src: state.fileUrl, alt: t('results.originalAlt', { file: run.fileName }) }), el('figcaption', { class: 'tag', text: t('labels.original') })));
    const links = el('p', { class: 'shot__links' });
    if (img.url) {
      const picture = el('img', { alt: t('results.generatedAlt', { n, file: run.fileName || '' }), loading: index === 0 ? 'eager' : 'lazy', decoding: 'async' });
      const figure = el('figure', { class: 'shot__fig' }, picture, el('figcaption', { class: 'tag tag--ink', text: t('labels.generated') }));
      picture.addEventListener('error', () => { figure.replaceWith(el('p', { class: 'notice', text: t('results.expired') })); links.remove(); });
      picture.src = img.url;
      media.append(figure);
      links.append(el('a', { href: img.url, target: '_blank', rel: 'noopener', text: t('results.open') }), el('a', { href: img.url, download: '', target: '_blank', rel: 'noopener', text: t('results.download') }));
    } else media.append(el('p', { class: 'notice', text: t('results.noImage') }));
    card.append(media, el('div', { class: 'shot__head' }, title, statePill(img)));
    if (img.state === 'passed_checks') card.append(el('p', { class: 'shot__note', text: t('results.awaiting') }));
    if (img.state === 'on_hold') card.append(el('p', { class: 'shot__reason' }, el('strong', { text: t('results.reasonHold') + ' ' }), img.reason || t('results.reasonHoldFallback')));
    if ((img.state === 'changes_requested' || img.state === 'not_approved') && img.note) card.append(el('p', { class: 'shot__reason' }, el('strong', { text: t('results.reasonChanges') + ' ' }), img.note));
    if (img.state === 'unread') card.append(el('p', { class: 'shot__reason', text: t('results.unreadDecision') }));
    if (img.decidedAt && (img.state === 'approved' || img.state === 'changes_requested' || img.state === 'not_approved')) {
      card.append(el('p', { class: 'shot__note', text: t('results.decidedOn', { date: new Date(img.decidedAt).toLocaleDateString(STRINGS.meta.lang, { day: 'numeric', month: 'long', year: 'numeric' }) }) }));
    }
    if (img.url) card.append(links);
    const checks = checkList(img.checks);
    if (checks) card.append(checks);
    return card;
  }
  const expectedOf = run => (Array.isArray(run.planned) && run.planned.length) || Number(run.imagesAsked) || 0;
  function renderResults() {
    const data = state.result, run = state.run;
    if (!data || !run) return;
    bind('reference', run.id);
    const r = readResult(data, expectedOf(run));
    let title, lead;
    if (r.status === 'approved') { title = t('results.titleApproved'); lead = t('results.allApproved'); }
    else if (r.status === 'part_approved') { title = t('results.titlePartApproved'); lead = r.approved === r.n ? t('results.allApproved') : t('results.someApproved', { a: r.approved, n: r.n }); }
    else if (r.status === 'ready') { title = t('results.titleReady'); lead = r.approved ? t('results.someApproved', { a: r.approved, n: r.n }) : (r.n === 1 ? t('results.allOne') : t('results.allMany', { n: r.n })); }
    else if (r.status === 'partial') { title = t('results.titlePartial'); lead = t('results.partial', { x: r.passed + r.approved, n: r.n }); }
    else {
      title = t('results.titleHold');
      const reason = (r.images.find(img => img.reason) || {}).reason || '';
      lead = r.decided ? t('results.holdOther') : (reason ? t('results.hold', { reason }) : t('results.holdNoReason'));
    }
    if (r.notMade) lead += ' ' + (r.notMade === 1 ? t('results.notMadeOne') : t('results.notMadeMany', { k: r.notMade }));
    $('results-title').textContent = title;
    $('results-lead').textContent = lead;
    setTag(STRINGS.recent.status[r.status] || STRINGS.recent.status.hold, r.status === 'approved' || r.status === 'ready');
    $('results-package').replaceChildren(...[
      el('span', { class: 'pill ' + (r.complete ? 'pill--approved' : 'pill--hold'), text: r.complete ? t('results.packageComplete') : t('results.packageIncomplete') }),
      r.complete ? null : el('span', { class: 'pillrow__why', text: t('results.packageWhy') })].filter(Boolean));   // replaceChildren would print "null"

    const canCompare = !!state.file && state.fileRunId === run.id;
    if (!canCompare) state.compare = 'single';
    show($('compare-bar'), canCompare && r.n > 0); show($('compare-missing'), !canCompare && r.n > 0);
    $('results-grid').replaceChildren(...r.images.map((img, index) => shotCard(img, index, run, canCompare)));
    applyCompare();

    const body = $('results-details-body');
    body.replaceChildren();
    const web = r.pkg.website_views && typeof r.pkg.website_views === 'object' ? r.pkg.website_views : null;
    if (web) {
      const names = list => (Array.isArray(list) && list.length ? list.map(role => STRINGS.results.views[role] || String(role)).join(', ') : t('labels.none'));
      body.append(el('h4', { text: t('results.detailsViews') }), el('p', { text: t('results.detailsViewsLine', { ready: names(web.ready), missing: names(web.missing) }) }));
    }
    if (Array.isArray(r.pkg.catalogue) && r.pkg.catalogue.length) body.append(el('h4', { text: t('results.detailsPieces') }), el('ul', {}, ...r.pkg.catalogue.map(piece => el('li', { text: [piece && piece.name, piece && piece.sku].filter(Boolean).join(', ') }))));
    if (Array.isArray(r.pkg.limitations) && r.pkg.limitations.length) body.append(el('h4', { text: t('results.detailsLimits') }), el('ul', {}, ...r.pkg.limitations.map(text => el('li', { text: String(text) }))));
    if (r.summary) body.append(el('h4', { text: t('results.detailsSummary') }), el('p', { text: r.summary }));
    $('results-details').open = false;
    show($('results-details'), body.childElementCount > 0);
  }
  function applyCompare() {
    const side = state.compare === 'side';
    $('results-grid').classList.toggle('is-side', side);
    $('compare-single').setAttribute('aria-pressed', side ? 'false' : 'true');
    $('compare-side').setAttribute('aria-pressed', side ? 'true' : 'false');
  }

  /* ------------------------------------------------------------------ earlier requests on this device */
  function addRecent(run) {
    const list = (read(LS, KEY.recent) || []).filter(item => item && item.id !== run.id);
    list.unshift({ id: run.id, time: run.acceptedAt, clientName: run.clientName, fileName: run.fileName, outcome: run.outcome, imageCount: run.imagesAsked, aspect: run.aspect, planned: run.planned, ctx: run.ctx, status: 'sent' });
    write(LS, KEY.recent, list.slice(0, 20));
    renderRecent();
  }
  function updateRecent(id, status) {
    const list = read(LS, KEY.recent) || [];
    const item = list.find(entry => entry && entry.id === id);
    if (item) { item.status = status; write(LS, KEY.recent, list); renderRecent(); }
  }
  function renderRecent() {
    const mine = state.session ? (read(LS, KEY.recent) || []).filter(item => item && item.clientName === state.session.clientName) : [];
    $('recent-count').textContent = '(' + mine.length + ')';
    $('recent-list').replaceChildren(...mine.map(item => {
      const outcome = (STRINGS.scope.options[item.outcome] || {}).title || String(item.outcome || '');
      return el('div', { class: 'recent__row' },
        el('div', { class: 'recent__main' },
          el('p', { class: 'recent__file', text: item.fileName || '' }),
          el('p', { class: 'recent__meta', text: t('recent.meta', { outcome, count: imagesText(Number(item.imageCount) || 1), time: dateTimeText(item.time) }) }),
          el('p', { class: 'recent__ref', dir: 'ltr', text: item.id })),
        el('span', { class: 'recent__status', text: STRINGS.recent.status[item.status] || STRINGS.recent.status.sent }),
        el('button', { type: 'button', class: 'btn btn--line btn--sm', text: t('recent.check'), disabled: inProduction(), 'aria-label': t('recent.check') + ': ' + (item.fileName || item.id), onclick: () => checkRecent(item) }));
    }));
    show($('recent-empty'), !mine.length); show($('recent-note'), mine.length > 0);
  }
  function checkRecent(item) {
    if (!state.session || inProduction()) return;          // one request followed at a time
    state.run = { id: item.id, acceptedAt: Number(item.time) || Date.now(), lastCheckAt: 0, imagesAsked: Number(item.imageCount) || 1, fileName: item.fileName, outcome: item.outcome, aspect: item.aspect, planned: item.planned || [], ctx: item.ctx || {}, clientName: item.clientName };
    state.result = null;
    write(LS, KEY.pending, state.run);
    setStage('progress');
    startWatching(true);
    focusNode($('progress-title'));
  }

  /* ------------------------------------------------------------------ actions */
  function copyReference() {
    const id = state.run ? state.run.id : '';
    if (!id) return;
    const done = () => announce(t('labels.copied')), fail = () => announce(t('labels.copyFailed'));
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(id).then(done, fail); else fail();
  }
  function startNew() {
    stopWatching(); drop(LS, KEY.pending);
    state.run = null; state.result = null;
    resetBrief(); foldBoth(false);
    setStage('plan');
  }
  const actions = {
    signout: () => signOut(''),
    new: () => {
      if (!(hasDraft() || state.file || state.run)) { startNew(); focusNode($('fold-piece')); return; }
      const dialog = $('confirm-new');
      if (typeof dialog.showModal !== 'function') { startNew(); return; }
      dialog.showModal();
    },
    'copy-ref': copyReference,
    'request-change': () => {                           // same choices: the leaves open again, adjust, send again
      forgetRunId(); foldBoth(false);
      stopWatching(); state.run = null; state.result = null; drop(LS, KEY.pending);
      setStage('plan');
      focusNode($('fold-setting'));
    },
    'new-item': () => { startNew(); focusNode($('fold-piece')); }
  };

  /* ------------------------------------------------------------------ mock bar */
  function applyDir(dir) {
    document.documentElement.dir = dir === 'rtl' ? 'rtl' : STRINGS.meta.dir;
  }
  function initMock() {
    if (!MOCK) return;
    document.body.classList.add('is-mock');
    show($('mockbar'), true);
    [['mock-signin', 'signin', STRINGS.mock.signinOptions], ['mock-submit', 'submit', STRINGS.mock.submitOptions], ['mock-result', 'result', STRINGS.mock.resultOptions], ['mock-dir', 'dir', STRINGS.mock.dirOptions]].forEach(([id, key, options]) => {
      const select = $(id);
      fillSelect(select, Object.entries(options), mockState[key]);
      mockState[key] = select.value;
      select.addEventListener('change', () => { mockState[key] = select.value; if (key === 'dir') applyDir(select.value); if (key === 'signin') renderThreshold(); });
    });
    applyDir(mockState.dir);
  }
  function renderThreshold() {                          // mock mode with the sign-in skipped shows one button instead of the code field
    const skip = MOCK && mockState.signin === 'skip';
    show($('signin-form'), !skip); show($('mock-open'), skip);
  }

  /* ------------------------------------------------------------------ start */
  function init() {
    document.documentElement.lang = STRINGS.meta.lang;
    document.documentElement.dir = STRINGS.meta.dir;
    document.title = STRINGS.meta.title;
    applyStrings(document);
    renderStatic();
    buildControls();
    initMock();
    renderThreshold();

    loadDraft();
    renderPieces();
    prepareProduct();
    const unsent = read(LS, KEY.unsent);
    state.runId = unsent && typeof unsent.id === 'string' ? unsent.id : '';
    $('draft-note').textContent = state.draftSavedAt ? t('ws.draftSaved', { time: timeText(state.draftSavedAt) }) : t('ws.draftIdle');

    const form = $('brief-form');
    const onBrief = event => { if (event.target.type !== 'file' && !event.target.closest('.leaf__fold')) { readForm(); briefChanged(); } };
    form.addEventListener('input', onBrief);
    form.addEventListener('change', onBrief);
    form.addEventListener('submit', event => event.preventDefault());
    form.addEventListener('keydown', event => { if (event.key === 'Enter' && event.target.matches('input[type="text"], input[type="number"]')) event.preventDefault(); });   // Enter must not send a paid request
    $('submit-btn').addEventListener('click', submitRequest);
    $('pieces-add').addEventListener('click', () => {
      if (state.brief.pieces.length >= OPT.maxPieces) return;
      state.brief.pieces.push({ item: '', count: 1 });
      renderPieces(); briefChanged();
      focusNode(document.querySelector('#pieces-list li:last-child input[data-field="count"]'));
    });
    ['piece', 'setting'].forEach(name => $('fold-' + name).addEventListener('click', () => setFold(name, !$('leaf-' + name).classList.contains('is-folded'))));
    $('dock-go').addEventListener('click', event => { event.preventDefault(); $('leaf-plan').scrollIntoView({ block: 'start' }); focusNode($('plan-title')); });
    document.addEventListener('click', event => {
      const action = event.target.closest('[data-action]');
      if (action && actions[action.dataset.action]) { event.preventDefault(); actions[action.dataset.action](event); }
    });
    $('confirm-new-keep').addEventListener('click', () => $('confirm-new').close());
    $('confirm-new-go').addEventListener('click', () => { $('confirm-new').close(); startNew(); focusNode($('fold-piece')); });
    $('open-notes').addEventListener('click', () => { const d = $('notes'); if (typeof d.showModal === 'function') d.showModal(); });
    $('notes-close').addEventListener('click', () => $('notes').close());

    const dropzone = $('drop');
    $('photo').addEventListener('change', event => takeFiles(event.target.files));
    ['dragenter', 'dragover'].forEach(type => dropzone.addEventListener(type, event => { event.preventDefault(); dropzone.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach(type => dropzone.addEventListener(type, event => { event.preventDefault(); dropzone.classList.remove('is-over'); }));
    dropzone.addEventListener('drop', event => takeFiles(event.dataTransfer && event.dataTransfer.files));
    $('photo-replace').addEventListener('click', () => $('photo').click());
    $('photo-remove').addEventListener('click', () => { setFile(null); forgetRunId(); renderBrief(); announce(t('item.removed')); focusNode($('photo')); });

    $('signin-form').addEventListener('submit', event => event.preventDefault());
    $('signin-submit').addEventListener('click', onSignIn);
    $('mock-open').addEventListener('click', onMockOpen);
    $('access-code').addEventListener('keydown', event => { if (event.key === 'Enter') onSignIn(event); });
    $('show-code').addEventListener('change', event => { $('access-code').type = event.target.checked ? 'text' : 'password'; });
    $('compare-single').addEventListener('click', () => { state.compare = 'single'; applyCompare(); });
    $('compare-side').addEventListener('click', () => { state.compare = 'side'; applyCompare(); });
    $('progress-retry').addEventListener('click', () => { if (state.run) startWatching(true); });

    // Restore the signed-in client for this tab, if any: the screen is already open.
    const session = read(SS, KEY.session);
    if (getCode() && session && typeof session.clientName === 'string') {
      state.session = { clientName: session.clientName, role: String(session.role || 'client'), limit: Number(session.limit) || 0, used: Number(session.used) || 0 };
    }
    setStage('plan');
    syncForm();
    renderSession();
    if (state.session) { openScreen(false); enterStudio(false); }
    else if (read(LS, KEY.pending)) { $('signin-notice').textContent = t('signin.resume'); show($('signin-notice'), true); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
