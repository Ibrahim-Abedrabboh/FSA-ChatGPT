/* Midas Virtual Studio — client page, draft 2 for "Claude · Midas A7" (16 Oct 2026, F3).
   Copied from claude-outputs/claude-midas-a7-page, which stays unchanged.
   Kept from that page (owner, 16 Oct 2026, 04:16): all nine image shapes in one grouped list, sent as bare values such as "4:5";
   White BK is always one square image; the views decide a Lifestyle request's images; the number of images shows before submit.
   Changed here (owner decisions, 16 Oct 2026): Human presence, Camera view and Series are offered for Lifestyle only
   (scope.camera, scope.series, styling.human). Left side and Right side cameras are "Coming later". Every Left side image of a
   series is listed as not made, because this page sends one photo and the studio never invents an unseen side.
   Plants, Mood / Vibes and Midas supporting pieces are "Coming later" and are never sent.
   16 Oct 2026, 11:45 (owner decisions D8 and D12): Lifestyle + Category template is the white catalogue image and a hero (2 images);
   a wide view and a close-up only when chosen in Views. The two series (Three views, Views by light) are "Coming later" until the
   page takes photos of the product's other sides: shown, never selectable, never sent.
   NOT CONNECTED: A7 has no sign-in or status address for this page yet, so the addresses are empty and mock mode is always on.
   Plain JavaScript, no build step. Everything in this file is public:
   never put an access code, token or API key here. */

const STUDIO_CONFIG = {
  signInUrl: '',             // not connected (see above)
  submitUrl: '',
  statusUrl: '',
  maxImages: 4,
  maxFileBytes: 25 * 1024 * 1024,
  poll: { firstMs: 30000, everyMs: 15000, limitOneMs: 480000, limitManyMs: 1200000, maxFailures: 3 },
  mock: true                 // keep true until the page is connected to A7 and checked
};

/* Short timings used only in mock mode, so every state can be seen in seconds. */
const MOCK_POLL = { firstMs: 2500, everyMs: 1500, limitOneMs: 9000, limitManyMs: 12000, maxFailures: 3 };

/* Every client-visible string lives here so the page can be translated later.
   Option VALUES (for example "Wide view") are sent to the studio and must not be translated;
   only their labels under `options` are. */
const STRINGS = {
  meta: { lang: 'en', dir: 'ltr', title: 'Midas Virtual Studio' },
  a11y: { skip: 'Skip to content' },
  brand: { mark: 'MIDAS', sub: 'Virtual Studio' },
  nav: {
    brandLabel: 'Midas Virtual Studio, back to top', primary: 'Primary',
    studio: 'The studio', how: 'How it works', outcomes: 'Outcomes', statuses: 'Review',
    questions: 'Questions', openMenu: 'Open menu', closeMenu: 'Close menu'
  },
  auth: { signOut: 'Sign out', signedOut: 'You are signed out.' },
  cta: { create: 'Create a new request', continue: 'Continue your request', how: 'See how it works' },
  hero: {
    eyebrow: 'Product imagery for Midas clients',
    line1: 'Studio images',
    line2: 'from one photo.',
    sub: 'Send the studio one photo of a furniture or home product with a short brief. Review the images that come back.',
    alt: 'A cream armchair beside a dark wood side table in a sunlit stone room. Generated image, shown for illustration.',
    tag: 'Generated image · illustrative'
  },
  how: {
    eyebrow: 'How it works', titleA: 'Five steps,', titleB: 'in plain words.',
    lead: 'You give the studio one photo and a short brief. It makes the images, checks them, and shows you the result.',
    cta: 'Open the studio →',
    steps: [
      { title: 'References', body: 'Add one photo of your product. JPG, PNG or WebP, up to 25 MB.' },
      { title: 'Direction', body: 'Choose the outcome, the views, the camera view and the proportions. Set the lighting, wall paint and floor, or let the studio choose.' },
      { title: 'Create', body: 'Check your brief and submit the request. Images are made one after another.' },
      { title: 'Review', body: 'Each image goes through the studio\'s automatic checks. You see which images passed and which are on hold, beside the photo you sent.' },
      { title: 'Deliver', body: 'Open each image at full size or download it. To adjust a result, request a change and submit again.' }
    ]
  },
  outcomes: {
    eyebrow: 'What you can request', titleA: 'Three outcomes,', titleB: 'one short brief.',
    cards: [
      { label: '2 or 3 images', title: 'Lifestyle', body: 'The item in a styled setting. Choose the views, the camera view, the lighting, wall paint and floor, or let the studio choose.', note: 'A white catalogue image first, then one image for each view you choose. All images of a request share one room and arrangement. Series of camera views are coming later.' },
      { label: '1 image', title: 'White BK', body: 'Clean catalogue imagery on a white background.', note: 'Always square (1:1). Views, camera views, series, wall paint and floor do not apply on white.' },
      { label: '4 images', title: 'Website', body: 'A package of four views: catalogue on white, hero, wide and detail.', note: 'The views and square proportions are set for you.' }
    ],
    laterLabel: 'Coming later:',
    laterText: 'Edit, Single item, Batch, New Composition and Create with this item; left side and right side camera views; the two series (Three views, Views by light); plants, mood and choosing Midas supporting pieces. You will see them in the brief, but they cannot be selected yet.'
  },
  statuses: {
    eyebrow: 'Review', titleA: 'Every image says', titleB: 'what it is.',
    lead: 'A result arrives with its status in words. You can compare each one with the photo you sent before you download it.',
    rows: [
      { name: 'Generated image', detail: 'The label on every result.' },
      { name: 'Passed automatic checks', detail: 'The image met the studio\'s checks.' },
      { name: 'On hold', detail: 'The image needs a person. The reason is shown.' },
      { name: 'Approved by the studio', detail: 'Shown only after the studio records its decision.' }
    ]
  },
  faq: {
    eyebrow: 'Questions', titleA: 'Good to know', titleB: 'before you start.',
    items: [
      { q: 'What do I need to start?', a: 'An access code and one product photo. Your studio contact gives you the code. The photo can be JPG, PNG or WebP, up to 25 MB.' },
      { q: 'How many images will I receive?', a: 'Lifestyle: the white catalogue image first, then one image for each view. Category template gives a hero (2 images in all); Wide view or Close-up gives 2; Wide view + close-up gives 3. All views share one room, arrangement and light. The two series (Three views and Views by light) are coming later: they need photos of the product\'s other sides. White BK: 1 image, always square. Website: always four: catalogue on white, hero, wide and detail. The page shows the number before you submit.' },
      { q: 'How long does a request take?', a: 'The studio does not quote a completion time. Images are made one after another, and a correction adds time. While your request is in production, the page shows the time elapsed.' },
      { q: 'Can I close the page and come back?', a: 'Your draft brief is saved on this device, without the photo. Recent requests are listed on this device too. Neither is shared across devices, and you sign in again when you return.' },
      { q: 'What if a result is not right?', a: 'Choose Request a change. The brief reopens with the same choices, so you can adjust it and submit a new request.' }
    ]
  },
  signin: {
    eyebrow: 'Sign in', titleA: 'Have your code?', titleB: 'Start your request.',
    lead: 'Sign in with your access code, then fill in a short brief for one product.',
    label: 'Access code', show: 'Show code', submit: 'Sign in', busy: 'Signing in…',
    hint: 'Your studio contact gives you this code.',
    empty: 'Enter your access code.',
    network: 'The sign-in could not be reached. Check your connection and try again.',
    resume: 'Sign in to continue your request.',
    welcome: 'Signed in as {name}.'
  },
  session: { usage: '{used} of {limit} images used this month' },
  labels: {
    original: 'Original', generated: 'Generated image',
    reference: 'Request reference', copy: 'Copy', copied: 'Reference copied.',
    copyFailed: 'The reference could not be copied. Select it and copy it by hand.',
    on: 'On', off: 'Off', later: 'Coming later', auto: 'Automatic from references',
    studioChoice: 'Studio choice', change: 'Change', none: 'None', error: 'Error:'
  },
  units: { mb: '{n} MB', kb: '{n} KB', min: 'min', sec: 's' },
  ws: {
    title: 'The studio',
    tabsLabel: 'Outcome',
    laterTabs: ['New Composition', 'Create with this item', 'Edit a result'],
    briefTitle: 'Your brief',
    draftSaved: 'Draft saved on this device at {time}',
    draftIdle: 'Your draft is saved on this device as you go.',
    confirmNewTitle: 'Start a new request?', confirmNewBody: 'The choices in your current draft will be cleared.',
    confirmNewKeep: 'Keep my draft', confirmNewGo: 'Start new',
    submit: 'Submit request', sending: 'Sending…',
    hintNoPhoto: 'Add a product photo to get started.',
    hintBusy: 'One request at a time. You can submit again when this one is ready for review.',
    errorsTitle: 'Before you submit, fix this:',
    required: 'Required', added: 'Added', optional: 'Optional',
    setForWebsite: '{v} · set for Website',
    aspectLabel: 'Image shape',
    notOnWhite: 'Not applied on white',
    setBySeries: 'Set by the series',
    detailsCount: '{n} added',
    sections: {
      photo: 'Product photo', item: 'The item', count: 'Images in this request', view: 'Views',
      series: 'Series', camera: 'Camera view',
      aspect: 'Image proportions', resolution: 'Resolution', atmosphere: 'Room atmosphere',
      lighting: 'Lighting', wall: 'Wall paint', floor: 'Floor', touches: 'Finishing touches', faithful: 'Keep faithful'
    },
    rightLabel: 'Result and recent requests',
    resultTitle: 'Result',
    tagIdle: 'Nothing sent yet', tagProduction: 'In production', tagUnconfirmed: 'Not confirmed', tagNotFound: 'Not found',
    emptyA: 'Add a product photo and', emptyB: 'choose an outcome.',
    readyA: 'Check your brief, then', readyB: 'submit your request.',
    emptyLead: 'Use a clear photo that shows the whole product. Your images appear here when the request is ready for review.',
    readyLead: 'Your images appear here when the request is ready for review.',
    stepsLabel: 'The five steps',
    steps: ['References', 'Direction', 'Create', 'Review', 'Deliver'],
    recentTitle: 'Recent requests on this device',
    recentNote: 'Kept on this device only. Not shared across devices.',
    recentEmptyTitle: 'No requests yet',
    recentEmpty: 'Requests you submit are listed here, on this device only.'
  },
  item: {
    department: 'Department', category: 'Category', subCategory: 'Sub-category',
    taxonomyNote: 'Categories follow the Midas Kuwait English catalogue as it was on 29 September 2026.',
    dropTitle: 'Add a product photo', dropHint: 'Drag a file here, or choose one from your device',
    photoHelp: 'JPG, PNG or WebP. One photo, up to 25 MB.',
    replace: 'Replace', remove: 'Remove',
    removed: 'Photo removed.', added: 'Photo added: {name}.',
    errType: '{name} is not a JPG, PNG or WebP image.',
    errSize: '{name} is larger than 25 MB.',
    errMissing: 'Add a product photo.',
    onlyOne: 'Only one photo is used. {name} was taken.',
    thumbAlt: 'Your product photo, {name}'
  },
  scope: {
    countHint: 'Each image is made on its own. The number follows the outcome and the views or the series you choose.',
    websiteNote: 'A Website package is always four views: catalogue on white, hero, wide and detail. The number of images, the views, square proportions and 2K resolution are set for you.',
    expectWhite: 'Expect 1 image: the white catalogue image, always square (1:1).',
    expectViews: {
      'Category template': 'Expect 2 images: the white catalogue image first, then a hero image.',
      'Wide view': 'Expect 2 images: the white catalogue image first, then a wide view.',
      'Close-up': 'Expect 2 images: the white catalogue image first, then a close-up.',
      'Wide view + close-up': 'Expect 3 images: the white catalogue image first, then a wide view and a close-up, in one room.'
    },
    expectWebsite: 'Expect 4 images: catalogue on white, hero, wide and detail.',
    expectSeries: {
      'Three views': 'Expect 3 of 4 images: the white catalogue image, then full frontal and 45° right, in one room and one light. The left side image is not made from this page yet.',
      'Views by light': 'Expect 7 of 10 images: the white catalogue image, then full frontal and 45° right in daylight, golden afternoon and warm evening. The three left side images are not made from this page yet.'
    },
    viewWhiteNote: 'Views do not apply on white: White BK makes the white catalogue image only.',
    viewSeriesNote: 'The view does not apply to a series: each series image shows the whole product.',
    cameraWhiteNote: 'Camera views and series apply to Lifestyle images only.',
    cameraSeriesNote: 'The camera view does not apply to a series: the series sets the camera of each image.',
    cameraLaterNote: 'Left side and Right side: coming later. Needs a photo of that side; this page takes one photo for now.',
    seriesLaterNote: 'Three views and Views by light: coming later. Each series needs photos of the product\'s other sides; this page takes one photo for now.',
    lightingSeriesNote: 'Lighting does not apply to Views by light: the series sets the light of each image (daylight, golden afternoon and warm evening).',
    seriesNotes: {
      'Single image': 'One image for each view you choose, after the white catalogue image.',
      'Three views': 'Three camera views in one room and one light: full frontal, left side and 45° right. With the white catalogue image, 4 images are asked for.',
      'Views by light': 'The same three camera views, each in daylight, golden afternoon and warm evening: 9 images. With the white catalogue image, 10 images are asked for.'
    },
    seriesSideNote: 'Each series includes the left side. This page takes one photo, so the left side images are not made yet. The studio never invents a side it cannot see.',
    aspectWhite: 'White catalogue is always 1:1',
    imageNames: { catalogue: 'Catalogue on white', hero: 'Hero', wide: 'Wide view', detail: 'Close-up (detail)' },
    lightNames: { day: 'daylight', warm: 'golden afternoon', night: 'warm evening', studio: 'light chosen by the studio' },
    cameraNames: { 'Full frontal': 'Full frontal', 'Left side': 'Left side', '45° right': '45° right', 'Right side': 'Right side' },
    imageNotMade: '{name}: not made from this page yet (needs a photo of that side)',
    countMade: '{made} of {n} made',
    countMadeOne: '{made} of the {n} images asked for will be made. The left side image is not made from this page yet: it needs a photo of that side.',
    countMadeMany: '{made} of the {n} images asked for will be made. The {k} left side images are not made from this page yet: each needs a photo of that side.',
    options: {
      'Lifestyle': { title: 'Lifestyle', body: 'The item in a styled setting' },
      'White BK': { title: 'White BK', body: 'Clean catalogue imagery' },
      'Website': { title: 'Website', body: 'A package of four views' }
    }
  },
  prefs: {
    studioChoice: 'Let the studio choose', studioChoiceNote: 'The studio picks the lighting, wall paint and floor.',
    whiteNote: 'Wall paint and floor are not applied on a white background, so they are not shown for White BK.'
  },
  sug: {
    plants: 'Plants', plantsNote: 'Natural accents in the scene. Not added for now.',
    human: 'Human presence', humanNote: 'At most one person, beside or behind the item, never in front of it. Off by default.',
    humanWebNote: 'Human presence applies to Lifestyle images only.',
    catalogue: 'Midas supporting pieces', catalogueNote: 'Choose which Midas pieces stand beside your product. For now the studio may place up to three Midas pieces from the current catalogue, or none.',
    mood: 'Mood / Vibes', moodNote: 'One mood for the whole scene.',
    whiteNote: 'Finishing touches are not applied on a white background, so they are not shown for White BK.',
    faithfulNote: 'Say what must stay true to your product. Leave a field empty if you are not sure; the studio does not guess colour or material.',
    color: 'Confirmed colour', material: 'Confirmed material', hero: 'Hero item or focus',
    locks: 'Details to preserve', locksHint: 'One detail on each line, for example the number of chairs.',
    mustNot: 'Things to exclude', mustNotHint: 'One item on each line, for example a table that appears in your photo.'
  },
  review: { images: '{n} image', imagesMany: '{n} images', imagesMade: '{made} of {n} images' },
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
    timeout: 'No result has arrived. The request may have stopped. The studio team can check it using your request reference.',
    unreachable: 'The result address could not be reached. Your request may still be in production. Check your connection, then check again.',
    checkAgain: 'Check again',
    announceRunning: 'Request received. In production.',
    announceReady: 'Your result is ready for review.'
  },
  results: {
    titleReady: 'Ready for review.', titlePartial: 'Partly ready.', titleHold: 'On hold.',
    allOne: 'The image passed the studio\'s automatic checks. It is awaiting approval.',
    allMany: 'All {n} images passed the studio\'s automatic checks. They are awaiting approval.',
    partial: '{x} of {n} images passed the automatic checks. The rest need a person.',
    hold: 'On hold. {reason}',
    holdNoReason: 'On hold. No image passed the automatic checks.',
    packageComplete: 'Package complete', packageIncomplete: 'Package incomplete',
    decisionAccepted: 'Approved by the studio', decisionChanges: 'The studio has asked for changes', decisionRejected: 'Not approved by the studio',
    decidedOn: 'Recorded on {date}.',
    viewLabel: 'View', single: 'Result only', side: 'Side by side with your photo',
    noOriginal: 'Your original photo is no longer held in this tab, so the side-by-side comparison is not available.',
    imageTitle: 'Image {n}', imageTitleView: 'Image {n}, {view}',
    views: { wide: 'wide view', close: 'close-up', catalogue: 'catalogue on white', hero: 'hero', detail: 'close-up (detail)' },
    cameras: { 'Full frontal': 'full frontal', 'Left side': 'left side', '45° right': '45° right', 'Right side': 'right side' },
    lights: { day: 'daylight', warm: 'golden afternoon', night: 'warm evening', studio: 'light chosen by the studio' },
    notMade: 'Not made', notMadeSide: 'Not made: needs a photo of the {side}.',
    notMadeOne: '1 image was not made: it needs a photo of the left side of your product.',
    notMadeMany: '{k} images were not made: each needs a photo of the left side of your product.',
    madeAllPassed: 'All {n} images made passed the studio\'s automatic checks. They are awaiting approval.',
    passed: 'Passed automatic checks', onHold: 'On hold',
    problem: 'Why it is on hold:',
    generatedAlt: 'Generated image {n} for {file}', originalAlt: 'Your original photo, {file}',
    expired: 'This image link has expired. Ask the studio team for the file using your request reference.',
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
    details: 'Request details', detailsSummary: 'Notes from the studio run', detailsViews: 'Website package views',
    detailsViewsLine: 'Passed: {passed}. Missing: {missing}.', detailsLimits: 'Limitations', detailsPieces: 'Midas supporting pieces used',
    change: 'Request a change', newItem: 'Start a new item'
  },
  recent: {
    check: 'Check result',
    meta: '{outcome} · {count} · {time}',
    status: {
      sent: 'In production when last checked', reviewed_candidate: 'Ready for review', partial: 'Partly ready', hold: 'On hold',
      unknown: 'Not found', accepted: 'Approved by the studio', changes_requested: 'The studio has asked for changes', rejected: 'Not approved by the studio'
    }
  },
  footer: {
    brand: 'Midas Virtual Studio', tagline: 'Product imagery for Midas clients, made from one photo and a short brief.',
    studioTitle: 'The studio', requestTitle: 'Your request', midasTitle: 'Midas',
    storeLink: 'midasfurniture.com', copyright: '© 2026 Midas Virtual Studio',
    imageNote: 'The hero image is generated and shown for illustration.'
  },
  options: {
    view: { 'Category template': 'Category template', 'Wide view': 'Wide view', 'Close-up': 'Close-up', 'Wide view + close-up': 'Wide view + close-up' },
    camera: { 'Reference view': 'As photographed', 'Full frontal': 'Full frontal', '45° right': '45° right', 'Left side': 'Left side', 'Right side': 'Right side' },
    series: { 'Single image': 'Single image', 'Three views': 'Three views', 'Views by light': 'Views by light' },
    aspect: { standard: 'Standard for category (Square 1:1)', '1:1': 'Square · 1:1', '4:5': 'Portrait · 4:5', '3:4': 'Portrait · 3:4', '2:3': 'Portrait · 2:3', '9:16': 'Portrait · 9:16', '5:4': 'Landscape · 5:4', '4:3': 'Landscape · 4:3', '3:2': 'Landscape · 3:2', '16:9': 'Landscape · 16:9' },
    aspectGroups: { square: 'Square', portrait: 'Portrait', landscape: 'Landscape' },
    resolution: { 'Standard for category': 'Standard for category', '2K': '2K', '4K': '4K' },
    lighting: { 'Soft daylight': 'Soft daylight', 'Golden afternoon': 'Golden afternoon', 'Warm evening': 'Warm evening' },
    wall: { 'White': 'White', 'Ivory': 'Ivory', 'Sand': 'Sand', 'Greige': 'Greige', 'Taupe': 'Taupe', 'Sage': 'Sage', 'Charcoal': 'Charcoal', 'Terracotta': 'Terracotta' },
    floor: { 'Light oak': 'Light oak', 'Dark walnut': 'Dark walnut', 'Limestone': 'Limestone', 'Marble': 'Marble' },
    resolutionShort: { 'Standard for category': 'Standard', '2K': '2K', '4K': '4K' }
  },
  mock: {
    title: 'Mock mode: no request is sent.',
    signin: 'Sign-in', submit: 'Submission', result: 'Result',
    clientName: 'Demo client',
    signinOptions: { skip: 'Skipped (preview)', limit: 'Accepted, with a limit', nolimit: 'Accepted, no limit', denied: 'access_denied', off: 'access_off', network: 'Network failure' },
    submitOptions: { accepted: 'Accepted', duplicate: 'duplicate', limit: 'limit_reached', tryagain: 'try_again', network: 'Network failure', bad: 'bad_request', denied: 'access_denied' },
    resultOptions: {
      passed: 'All images passed', partial: 'Partial', hold: 'Hold', website_complete: 'Website package complete',
      website_incomplete: 'Website package incomplete', approved: 'Approved by the studio', changes: 'Changes requested',
      rejected: 'Not approved', expired: 'Image link expired', never: 'Not finished until timeout',
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
  function bind(name, text) {
    document.querySelectorAll('[data-bind="' + name + '"]').forEach(node => { node.textContent = text; });
  }
  function announce(text) {
    const live = $('live');
    live.textContent = '';
    window.setTimeout(() => { live.textContent = text; }, 60);
  }
  function show(node, visible) { node.hidden = !visible; }
  function focusNode(node) { if (node) { try { node.focus({ preventScroll: false }); } catch (e) { node.focus(); } } }
  const timeText = ms => new Date(ms).toLocaleTimeString(STRINGS.meta.lang, { hour: '2-digit', minute: '2-digit' });
  const dateTimeText = ms => new Date(ms).toLocaleString(STRINGS.meta.lang, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  function sizeText(bytes) {
    return bytes >= 1048576 ? t('units.mb', { n: (bytes / 1048576).toFixed(1) }) : t('units.kb', { n: Math.max(1, Math.round(bytes / 1024)) });
  }
  function elapsedText(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = String(total % 60).padStart(2, '0');
    return minutes + ' ' + t('units.min') + ' ' + seconds + ' ' + t('units.sec');
  }
  function newId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
  }

  /* ------------------------------------------------------------------ storage
     localStorage: the draft brief, the request reference, recent requests. Never the access code.
     sessionStorage: the access code and the signed-in client, gone when the tab closes. */
  function area(name) {
    try { const a = window[name]; a.getItem('midas.a7p2.probe'); return a; }
    catch (e) { const mem = new Map(); return { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: k => { mem.delete(k); } }; }
  }
  const LS = area('localStorage');
  const SS = area('sessionStorage');
  const read = (a, key) => { try { const raw = a.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } };
  const write = (a, key, value) => { try { a.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full or blocked: the page still works */ } };
  const drop = (a, key) => { try { a.removeItem(key); } catch (e) { /* ignore */ } };
  const KEY = { draft: 'midas.a7p2.draft', unsent: 'midas.a7p2.unsent', pending: 'midas.a7p2.pending', recent: 'midas.a7p2.recent', code: 'midas.a7p2.code', session: 'midas.a7p2.session' };   // own keys: never mixed with the other studio pages

  /* ------------------------------------------------------------------ options (stable values sent to the studio) */
  const OPT = {
    jobs: [['new_project', true], ['edit', false], ['single_item', false]],
    work: [['one_by_one', true], ['batch', false]],
    outcomes: [['Lifestyle', true], ['White BK', true], ['Website', true], ['New Composition', false], ['Create with this item', false], ['Others', false]],
    view: ['Category template', 'Wide view', 'Close-up', 'Wide view + close-up'],
    /* Views → images (owner, 16 Oct 2026, 04:16). Each view is its own image; the white catalogue image comes first. */
    viewImages: { 'Category template': ['hero'], 'Wide view': ['wide'], 'Close-up': ['detail'], 'Wide view + close-up': ['wide', 'detail'] },   // owner D8
    /* Image shapes (owner, 16 Oct 2026, 04:16): nine shapes, sent as bare values. "standard" is sent as 1:1. */
    aspect: ['standard', '1:1', '4:5', '3:4', '2:3', '9:16', '5:4', '4:3', '3:2', '16:9'],
    aspectGroups: [['square', ['1:1']], ['portrait', ['4:5', '3:4', '2:3', '9:16']], ['landscape', ['5:4', '4:3', '3:2', '16:9']]],
    aspectFromLabel: { 'Standard for category': 'standard', 'Square · 1:1': '1:1', 'Portrait · 4:5': '4:5', 'Landscape · 16:9': '16:9' },   // drafts saved by the earlier page
    resolution: ['Standard for category', '2K', '4K'],
    lighting: ['Soft daylight', 'Golden afternoon', 'Warm evening'],
    wall: [['White', '#eeeae3'], ['Ivory', '#e7ddc8'], ['Sand', '#cfb996'], ['Greige', '#b7aea1'], ['Taupe', '#938074'], ['Sage', '#a3ad91'], ['Charcoal', '#575652'], ['Terracotta', '#b4745d']],
    floor: ['Light oak', 'Dark walnut', 'Limestone', 'Marble'],
    /* Camera views (owner, 16 Oct 2026): sent as these bare values in scope.camera, Lifestyle only. "Reference view" is the
       vendor photo's angle, labelled "As photographed". Left side and Right side need a photo of that side: shown, never sent. */
    camera: ['Reference view', 'Full frontal', '45° right'],
    cameraLater: ['Left side', 'Right side'],
    /* Series (owner, 16 Oct 2026): sent as these bare values in scope.series, Lifestyle only. The cameras and lights follow
       the studio's own plan, in its order: for each light, Full frontal, Left side, 45° right. */
    series: ['Single image'],
    seriesLater: ['Three views', 'Views by light'],   // owner D12: shown as "Coming later", never selectable, never sent
    seriesCams: ['Full frontal', 'Left side', '45° right'],
    seriesLights: ['day', 'warm', 'night'],
    lightKey: { 'Soft daylight': 'day', 'Golden afternoon': 'warm', 'Warm evening': 'night' },   // as the studio reads the lighting words
    unseenSides: ['Left side', 'Right side'],   // this page sends one photo, so these images are held by the studio, never made
    ratios: { '1:1': '1 / 1', '4:5': '4 / 5', '3:4': '3 / 4', '2:3': '2 / 3', '9:16': '9 / 16', '5:4': '5 / 4', '4:3': '4 / 3', '3:2': '3 / 2', '16:9': '16 / 9' }
  };
  const PRODUCT_ROLE = 'Product / vendor reference';
  const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const FILE_EXT = /\.(jpe?g|png|webp)$/i;

  function defaultBrief() {
    return {
      jobMode: 'new_project', workOn: 'one_by_one',
      department: '', category: '', subCategory: '',
      outcome: 'Lifestyle', view: 'Category template', camera: 'Reference view', series: 'Single image', aspect: 'standard', resolution: 'Standard for category',
      studioChoice: false, lighting: '', wallPaint: '', floor: '',
      human: false,                       // Plants, Mood and Midas supporting pieces are "Coming later": not in the brief, never sent
      color: '', material: '', hero: '', locks: '', mustNot: ''
    };
  }

  /* ------------------------------------------------------------------ state */
  const state = {
    session: null,      // { clientName, role, limit, used }
    brief: defaultBrief(),
    file: null, fileUrl: '', fileRunId: '',
    runId: '',          // reference created at Submit, kept until accepted or until the brief changes
    run: null,          // the request being watched
    result: null,
    compare: 'single',
    stage: 'empty',
    hash: '',           // which view is open; kept here so the page also works where the address cannot change (a sandboxed preview)
    sending: false,
    draftSavedAt: 0
  };

  /* ------------------------------------------------------------------ taxonomy (catalogue snapshot) */
  const taxonomy = window.MIDAS_TAXONOMY || { nodes: [] };
  const nodeById = new Map(taxonomy.nodes.map(node => [node.id, node]));
  const categoryNodes = taxonomy.nodes.filter(node => node.kind === 'category');
  const departments = categoryNodes.filter(node => !node.parentId);   // the four product departments; website sections are left out
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

  /* ------------------------------------------------------------------ brief → payload */
  const isWebsite = b => b.outcome === 'Website';
  const isWhite = b => b.outcome === 'White BK';
  const isLife = b => !isWebsite(b) && !isWhite(b);
  /* Camera view, series and human presence apply to Lifestyle only (owner, 16 Oct 2026). */
  const seriesOf = b => (isLife(b) && OPT.series.includes(b.series) ? b.series : 'Single image');
  const isSeries = b => seriesOf(b) !== 'Single image';
  /* The images a request asks for, in the studio's own order. Each entry: role (catalogue, hero, wide, detail), camera, light,
     series (true for a series image) and made (false for a side this page has no photo of: the studio holds it, never invents it).
     White BK: the white catalogue image only. Website: always four.
     Lifestyle, single image: the white catalogue image, then one image for each view, all from the chosen camera view.
     Three views: the white catalogue image, then Full frontal, Left side, 45° right (one room, one light): 4 asked for.
     Views by light: those three cameras in daylight, golden afternoon and warm evening: 9, so 10 asked for. */
  function plannedImages(b) {
    const one = (role, more) => Object.assign({ role, camera: '', light: '', series: false, made: true }, more || {});
    if (isWebsite(b)) return ['catalogue', 'hero', 'wide', 'detail'].map(role => one(role));
    if (isWhite(b)) return [one('catalogue')];
    const series = seriesOf(b);
    const chosenLight = OPT.lightKey[b.studioChoice ? '' : b.lighting] || '';   // the studio's own light keys (day, warm, night), or '' for its choice
    const out = [one('catalogue')];
    const shot = (camera, light) => one('hero', { camera, light, series: true, made: !OPT.unseenSides.includes(camera) });
    if (series === 'Three views') OPT.seriesCams.forEach(camera => out.push(shot(camera, chosenLight)));
    else if (series === 'Views by light') OPT.seriesLights.forEach(light => OPT.seriesCams.forEach(camera => out.push(shot(camera, light))));
    else {
      const camera = OPT.camera.includes(b.camera) ? b.camera : 'Reference view';
      (OPT.viewImages[b.view] || OPT.viewImages['Category template']).forEach(role => out.push(one(role, { camera, light: chosenLight })));
    }
    return out;
  }
  /* The name of a planned image in the list before submit. */
  function imageName(img) {
    if (img.series) return (STRINGS.scope.cameraNames[img.camera] || img.camera) + ', ' + (STRINGS.scope.lightNames[img.light] || STRINGS.scope.lightNames.studio);
    const base = STRINGS.scope.imageNames[img.role] || img.role;
    return img.camera && img.camera !== 'Reference view' ? base + ', ' + STRINGS.results.cameras[img.camera] : base;
  }
  function effective(b) {
    const web = isWebsite(b), white = isWhite(b), life = isLife(b);
    const series = seriesOf(b), inSeries = series !== 'Single image';
    const images = plannedImages(b);
    return {
      images, imageCount: images.length, madeCount: images.filter(img => img.made).length,
      life, series, inSeries,
      view: web ? 'Category template' : (white || inSeries ? '' : b.view),     // white and a series ignore the view: nothing is sent
      camera: life ? (inSeries ? 'Reference view' : (OPT.camera.includes(b.camera) ? b.camera : 'Reference view')) : '',   // a series sets its own cameras
      aspect: web || white || b.aspect === 'standard' ? '1:1' : b.aspect,      // bare value; the white catalogue image is always 1:1
      resolution: web ? '2K' : b.resolution,
      lighting: b.studioChoice || series === 'Views by light' ? '' : b.lighting,   // Views by light sets its own lights
      wallPaint: b.studioChoice || white ? '' : b.wallPaint,
      floor: b.studioChoice || white ? '' : b.floor,
      human: life ? !!b.human : false
    };
  }
  const lines = text => String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  /* What the page sends. Camera view, series and human presence are sent for Lifestyle only. Plants, Mood / Vibes and the
     Midas supporting pieces switch are "Coming later" and are never sent. */
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
      item: { department, category, subCategory: subLabel(), referenceType: PRODUCT_ROLE },
      preferences: { lighting: e.lighting, wallPaint: e.wallPaint, floor: e.floor, useWorkflowDefaults: !!b.studioChoice },
      metadata: {
        product_category: category || department, color: b.color.trim(), material: b.material.trim(),
        scene: b.outcome, light: e.lighting, hero: b.hero.trim(),
        locks: lines(b.locks), must_not: lines(b.mustNot),
        delivery: { image_size: '', aspect: e.aspect, resolution: e.resolution }
      },
      references: [{ name: state.file ? state.file.name : '', role: PRODUCT_ROLE }],
      clientRunId
    };
    if (e.life) payload.styling = { human: e.human };
    return payload;
  }

  /* ------------------------------------------------------------------ network
     Every call is a POST carrying access_code, as FormData or URLSearchParams, with no
     request headers of our own, so the browser sends no preflight request. */
  const REASON_BY_STATUS = { 400: 'bad_request', 401: 'access_denied', 403: 'access_off', 404: 'unknown_request', 409: 'duplicate', 429: 'limit_reached', 503: 'try_again' };
  async function post(url, body) {
    let response;
    try { response = await fetch(url, { method: 'POST', body, cache: 'no-store' }); }
    catch (error) { return { network: true }; }
    try { return { status: response.status, data: await response.json() }; }
    catch (error) { return { network: true }; }
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

  /* Mock replies. Messages are the ones the studio workflow sends. Nothing leaves the browser. */
  const mockState = { signin: params.get('signin') || 'skip', submit: params.get('submit') || 'accepted', result: params.get('result') || 'passed', jobs: new Map(), checks: new Map() };
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
  const later = value => new Promise(resolve => window.setTimeout(() => resolve(value), 350));
  function mockResult(id) {
    const fallback = [{ role: 'catalogue', camera: '', light: '', series: false, made: true }].concat(['hero', 'wide', 'detail'].map(role => ({ role, camera: 'Reference view', light: '', series: false, made: true })));
    const job = mockState.jobs.get(id) || { outcome: 'Lifestyle', planned: fallback, file: 'product.jpg' };
    let scenario = mockState.result;
    const website = job.outcome === 'Website' || scenario === 'website_complete' || scenario === 'website_incomplete';
    if (website && scenario === 'passed') scenario = 'website_complete';
    if (website && scenario === 'partial') scenario = 'website_incomplete';
    const planned = website ? ['catalogue', 'hero', 'wide', 'detail'].map(role => ({ role, camera: '', light: '', series: false, made: true })) : job.planned;   // one entry per planned image, in order
    const roles = planned.map(p => p.role);
    const count = planned.length;
    const lastMade = planned.map(p => p.made).lastIndexOf(true);
    const madeN = planned.filter(p => p.made).length;
    const names = Object.keys(STRINGS.results.checkNames);
    const allHold = scenario === 'hold';
    const images = [];
    for (let i = 0; i < count; i += 1) {
      const p = planned[i];
      const view = roles[i] === 'wide' ? 'wide' : roles[i] === 'detail' ? 'close' : '';
      if (!p.made) {   // a side with no photo: the studio holds it and makes nothing (stage 07, 16 Oct 2026); mock shape, not yet confirmed
        images.push({ shot: i + 1, status: 'not_made', view, role: roles[i], camera: p.camera, light: p.light, series: p.series, images_made: 0, image_url: '', problem: '', checks: [] });
        continue;
      }
      const held = allHold || ((scenario === 'partial' || scenario === 'website_incomplete') && i === lastMade && madeN > 1) || (scenario === 'partial' && madeN === 1);
      images.push({
        shot: i + 1, status: held ? 'hold' : 'passed', view, role: roles[i], camera: p.camera, light: p.light, series: p.series, images_made: held ? 3 : 1,
        image_url: scenario === 'expired' && i === 0 ? 'data:image/webp;base64,AAAA' : mockPicture(),
        problem: held ? 'The reviewer counted four chair legs in the product photo and three in the image.' : '',
        checks: names.map((name, k) => [name, held && k === 0 ? 'fail' : (held && k === 6 ? 'partial' : 'pass'), held && k === 0 ? 'Leg count differs from the product photo.' : 'Matches the product photo.'])
      });
    }
    const madeImages = images.filter(image => image.status !== 'not_made');
    const passed = madeImages.filter(image => image.status === 'passed').length;
    const status = passed === images.length ? 'reviewed_candidate' : (passed > 0 ? 'partial' : 'hold');   // an image not made leaves the request partly ready, never complete
    const decision = { approved: 'accepted', changes: 'changes_requested', rejected: 'rejected' }[scenario] || '';
    return {
      found: true, state: 'finished', run_id: 'var2-mock', status,
      images_made: images.reduce((sum, image) => sum + image.images_made, 0),
      image_url: (images.find(image => image.status === 'passed') || {}).image_url || '', checks: [], images,
      package: website ? { website_package: { required: roles, passed: images.filter(i => i.status === 'passed').map(i => i.role), missing: images.filter(i => i.status !== 'passed').map(i => i.role), complete: passed === 4 }, limitations: ['Mock data: these images are the page\'s hero picture, not studio results.'], catalogue: [] } : null,
      owner_decision: decision, owner_note: decision ? 'Mock note from the studio.' : '', decided_at: decision ? new Date().toISOString() : '',
      summary: 'Mock run card for ' + job.file + '\n' + (status === 'hold' ? 'No image passed the automatic checks.' : 'Run finished.') + '\nThis text stands in for the first 1,500 characters of the studio run card.',
      product_file: job.file, finished_at: new Date().toISOString()
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
      const job = { outcome: payload.scope.outcome, planned: plannedImages(state.brief), file: file.name };
      mockState.lastPayload = payload;                 // lets a tester read what would have been sent
      if (s === 'network') return later({ network: true });
      if (s === 'denied') return later(mockRefusal('access_denied', 401));
      if (s === 'bad') return later(mockRefusal('bad_request', 400));
      if (s === 'tryagain') return later(mockRefusal('try_again', 503));
      if (s === 'limit') return later(mockRefusal('limit_reached', 429, { monthly_image_limit: 500, images_used_this_month: 498 }));
      mockState.jobs.set(payload.clientRunId, job);
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
      if (s === 'never' || seen < 2) return later({ status: 200, data: { found: false, state: 'not_finished' } });
      return later({ status: 200, data: mockResult(id) });
    }
  };
  const api = MOCK ? mock : live;
  if (MOCK) window.MIDAS_STUDIO_MOCK = mockState;
  const pollCfg = () => (MOCK ? MOCK_POLL : STUDIO_CONFIG.poll);

  /* Turn any reply into one of: network failure, refusal (reason + message), or data. */
  function interpret(res) {
    if (!res || res.network || !res.data || typeof res.data !== 'object') return { kind: 'network' };
    const data = res.data;
    const reason = data.reason || (res.status >= 400 ? (REASON_BY_STATUS[res.status] || 'refused') : '');
    if (reason && data.ok !== true && data.found !== true) {
      return { kind: 'refused', reason: String(reason), message: String(data.message || t('submit.refused')), data };
    }
    return { kind: 'ok', data };
  }
  const mockPicture = () => { const hero = document.querySelector('.hero__img'); return (hero && hero.src) || 'atelier-hero.webp'; };   // mock results reuse the hero picture
  function safeImageUrl(text) {
    if (!text) return '';
    try {
      const url = new URL(String(text), window.location.href);
      if (url.protocol === 'https:') return url.href;
      if (MOCK && (url.origin === window.location.origin || url.protocol === 'file:' || url.href.startsWith('data:image/'))) return url.href;   // mock pictures only
      return '';
    } catch (error) { return ''; }
  }

  /* ------------------------------------------------------------------ static sections */
  function renderStatic() {
    $('how-steps').replaceChildren(...STRINGS.how.steps.map((step, i) => el('li', { class: 'panel steplist__item' },
      el('span', { class: 'panel__num', 'aria-hidden': 'true', text: String(i + 1).padStart(2, '0') }),
      el('div', {}, el('h3', { class: 'panel__title', text: step.title }), el('p', { class: 'panel__body', text: step.body })))));
    $('outcome-cards').replaceChildren(...STRINGS.outcomes.cards.map(card => el('article', { class: 'panel' },
      el('span', { class: 'panel__label', text: card.label }), el('h3', { class: 'panel__title', text: card.title }),
      el('p', { class: 'panel__body', text: card.body }), el('p', { class: 'panel__meta', text: card.note }))));
    $('status-rows').replaceChildren(...STRINGS.statuses.rows.map(row => el('div', { class: 'row' },
      el('span', { class: 'row__name', text: row.name }), el('span', { class: 'row__detail', text: row.detail }))));
    $('faq-list').replaceChildren(...STRINGS.faq.items.map(item => el('details', { class: 'faq' },
      el('summary', { text: item.q }), el('p', { text: item.a }))));
  }

  /* ------------------------------------------------------------------ brief controls
     Tabs, tiles and chips are radio buttons, so the keyboard and screen readers get them for free. */
  function opt(name, value, label, more) {
    const input = el('input', { type: 'radio', name, value });
    if (more && more.full) input.setAttribute('aria-label', more.full);
    if (more && more.later) input.disabled = true;                 // "Coming later": shown, never selectable, never sent
    const node = el('label', { class: 'opt' + (more && more.swatch ? ' opt--swatch' : '') + (more && more.later ? ' opt--later' : '') }, input,
      el('span', {}, more && more.swatch ? el('i', { 'aria-hidden': 'true' }) : null, label,
        more && more.later ? el('b', { class: 'tag opt__tag', text: t('labels.later') }) : null));
    if (more && more.swatch) node.style.setProperty('--swatch', more.swatch);
    return node;
  }
  function buildControls() {
    $('outcome-tabs').replaceChildren(
      ...OPT.outcomes.filter(([, on]) => on).map(([value]) => el('label', { class: 'tab' },
        el('input', { type: 'radio', name: 'outcome', value }), el('span', { class: 'tab__body', text: STRINGS.scope.options[value].title }))),
      ...STRINGS.ws.laterTabs.map(label => el('label', { class: 'tab' },                      // shown, never selectable, never sent
        el('input', { type: 'radio', name: 'outcome-later', disabled: true }),
        el('span', { class: 'tab__body' }, label, el('span', { class: 'tag', text: t('labels.later') })))));
    $('view-choices').replaceChildren(...OPT.view.map(v => opt('view', v, STRINGS.options.view[v])));
    $('series-choices').replaceChildren(...OPT.series.map(v => opt('series', v, STRINGS.options.series[v])),
      ...OPT.seriesLater.map(v => opt('series-later', v, STRINGS.options.series[v], { later: true })));   // a different name: never read, never sent
    $('camera-choices').replaceChildren(...OPT.camera.map(v => opt('camera', v, STRINGS.options.camera[v])),
      ...OPT.cameraLater.map(v => opt('camera-later', v, STRINGS.options.camera[v], { later: true })));   // a different name: never read, never sent
    fillAspect('free', state.brief.aspect);
    $('resolution-choices').replaceChildren(...OPT.resolution.map(v => opt('resolution', v, STRINGS.options.resolutionShort[v], { full: STRINGS.options.resolution[v] })));
    $('lighting-choices').replaceChildren(opt('lighting', '', t('labels.studioChoice')), ...OPT.lighting.map(v => opt('lighting', v, STRINGS.options.lighting[v])));
    $('wall-choices').replaceChildren(opt('wallPaint', '', t('labels.studioChoice')), ...OPT.wall.map(([v, hex]) => opt('wallPaint', v, STRINGS.options.wall[v], { swatch: hex })));
    $('floor-choices').replaceChildren(opt('floor', '', t('labels.studioChoice')), ...OPT.floor.map(v => opt('floor', v, STRINGS.options.floor[v])));
    fillSelect($('department'), [['', t('labels.auto')], ...departments.map(node => [node.id, node.name])], '');
  }
  const radios = name => [...document.querySelectorAll('input[type="radio"][name="' + name + '"]')];
  const radio = (name, value) => { const input = radios(name).find(node => node.value === value); if (input) input.checked = true; };
  const checkedValue = name => { const input = radios(name).find(node => node.checked); return input ? input.value : ''; };
  const lock = (name, disabled) => radios(name).forEach(node => { node.disabled = disabled; });
  /* The shape list: one select, grouped by orientation, "Standard for category" first. Disabled for White BK (always 1:1,
     shown in words) and for Website (square, set for the package). */
  function fillAspect(mode, value) {
    const select = $('aspect');
    if (mode === 'white') {
      select.replaceChildren(el('option', { value: 'white', text: t('scope.aspectWhite') }));
      select.value = 'white'; select.disabled = true;
      return;
    }
    const groups = OPT.aspectGroups.map(([group, list]) => el('optgroup', { label: STRINGS.options.aspectGroups[group] },
      ...list.map(v => el('option', { value: v, text: STRINGS.options.aspect[v] }))));
    select.replaceChildren(el('option', { value: 'standard', text: STRINGS.options.aspect.standard }), ...groups);
    select.value = mode === 'web' ? '1:1' : (OPT.aspect.includes(value) ? value : 'standard');
    select.disabled = mode === 'web';
  }

  /* Put the brief into the form. */
  function syncForm() {
    const b = state.brief, e = effective(b), web = isWebsite(b), white = isWhite(b);
    const inSeries = e.inSeries, byLight = e.series === 'Views by light';
    radio('outcome', b.outcome);
    $('department').value = departments.some(node => node.id === b.department) ? b.department : '';
    b.department = $('department').value;
    fillCategories();
    radio('view', b.view); radio('resolution', e.resolution);
    radio('series', b.series); radio('camera', b.camera);
    fillAspect(white ? 'white' : (web ? 'web' : 'free'), b.aspect);
    show($('card-view'), !web); show($('website-note'), web);
    show($('card-series'), !web); show($('card-camera'), !web);                         // Lifestyle only; locked on white, hidden for Website
    lock('series', white); show($('series-note-white'), white);
    if (white) radios('series').forEach(node => { node.checked = false; });
    show($('series-side-note'), inSeries);
    $('series-desc').textContent = white ? '' : STRINGS.scope.seriesNotes[e.series];
    show($('series-desc'), !white);
    lock('view', white || inSeries);                                                   // white and a series ignore the view
    show($('view-note'), white); show($('view-series-note'), inSeries);
    if (white || inSeries) radios('view').forEach(node => { node.checked = false; });   // shown unselected; the client's choice is kept for later
    lock('camera', white || inSeries);                                                 // a series sets the camera of each image
    show($('camera-note-white'), white); show($('camera-series-note'), inSeries);
    if (white || inSeries) radios('camera').forEach(node => { node.checked = false; });
    lock('resolution', web);                                                           // preset and locked for a Website package
    $('studio-choice').checked = b.studioChoice;
    radio('lighting', b.lighting); radio('wallPaint', b.wallPaint); radio('floor', b.floor);
    lock('lighting', b.studioChoice || byLight); lock('wallPaint', b.studioChoice); lock('floor', b.studioChoice);
    if (byLight) radios('lighting').forEach(node => { node.checked = false; });       // Views by light sets its own lights
    show($('lighting-series-note'), byLight);
    show($('card-wall'), !white); show($('card-floor'), !white); show($('white-note'), white);
    show($('touches-fields'), !white); show($('touches-white'), white);
    $('human').checked = e.life && b.human; $('human').disabled = !e.life; show($('human-web-note'), web);
    $('color').value = b.color; $('material').value = b.material; $('hero-item').value = b.hero; $('locks').value = b.locks; $('must-not').value = b.mustNot;
    document.querySelectorAll('.switch input').forEach(input => {
      input.closest('.switch').querySelector('strong').dataset.state = input.checked ? t('labels.on') : t('labels.off');
    });
    renderBrief();
  }
  /* Read the form back into the brief. */
  function readForm() {
    const b = state.brief, wasWeb = isWebsite(b), wasWhite = isWhite(b);
    const wasSeries = isSeries(b), wasByLight = seriesOf(b) === 'Views by light', wasLife = isLife(b);
    const department = $('department').value;
    if (department !== b.department) { b.department = department; b.category = ''; b.subCategory = ''; }
    else {
      const category = $('category').value;
      if (category !== b.category) { b.category = category; b.subCategory = ''; }
      else b.subCategory = $('sub-category').value;
    }
    b.outcome = checkedValue('outcome') || b.outcome;
    if (!wasWeb && !isWebsite(b)) {                      // while Website is chosen these show its fixed values, not the client's
      if (!wasWhite && !isWhite(b)) {                    // while White BK is chosen the view, the camera, the series and the shape are fixed too
        b.series = checkedValue('series') || b.series;
        if (!wasSeries && !isSeries(b)) {                // while a series is chosen the view and the camera are set by the series
          b.view = checkedValue('view') || b.view;
          b.camera = checkedValue('camera') || b.camera;
        }
        const shape = $('aspect').value;
        if (OPT.aspect.includes(shape)) b.aspect = shape;
      }
      b.resolution = checkedValue('resolution') || b.resolution;
    }
    const byLight = seriesOf(b) === 'Views by light';
    const choose = $('studio-choice').checked;
    if (choose && !b.studioChoice) { b.lighting = ''; b.wallPaint = ''; b.floor = ''; }
    else if (!choose) {
      if (!wasByLight && !byLight) b.lighting = checkedValue('lighting');   // Views by light sets its own lights; the choice is kept
      if (!isWhite(b)) { b.wallPaint = checkedValue('wallPaint'); b.floor = checkedValue('floor'); }
    }
    b.studioChoice = choose;
    if (wasLife && isLife(b)) b.human = $('human').checked;   // the switch is off and locked outside Lifestyle; the choice is kept
    b.color = $('color').value; b.material = $('material').value; b.hero = $('hero-item').value; b.locks = $('locks').value; b.mustNot = $('must-not').value;
  }
  function briefChanged() {
    forgetRunId();                      // a changed brief is a new request
    clearSubmitMessage(); show($('brief-errors'), false);
    saveDraft();
    syncForm();
    updateHero();
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
    if (!OPT.outcomes.some(([value, on]) => on && value === base.outcome)) base.outcome = 'Lifestyle';
    if (OPT.aspectFromLabel[base.aspect]) base.aspect = OPT.aspectFromLabel[base.aspect];
    for (const [key, list] of [['view', OPT.view], ['camera', OPT.camera], ['series', OPT.series], ['aspect', OPT.aspect], ['resolution', OPT.resolution]]) if (!list.includes(base[key])) base[key] = list[0];
    if (base.lighting && !OPT.lighting.includes(base.lighting)) base.lighting = '';
    if (base.floor && !OPT.floor.includes(base.floor)) base.floor = '';
    if (base.wallPaint && !OPT.wall.some(([value]) => value === base.wallPaint)) base.wallPaint = '';
    state.brief = base;
    state.draftSavedAt = Number(draft.savedAt) || 0;
  }
  const hasDraft = () => state.draftSavedAt > 0 && JSON.stringify(state.brief) !== JSON.stringify(defaultBrief());
  function resetBrief() {
    state.brief = defaultBrief(); state.draftSavedAt = 0;
    setFile(null); photoError(''); forgetRunId(); drop(LS, KEY.draft);
    clearSubmitMessage(); show($('brief-errors'), false);
    $('draft-note').textContent = t('ws.draftIdle');
    $('brief-scroll').scrollTop = 0;
    syncForm(); updateHero();
  }
  function forgetRunId() { if (state.runId) { state.runId = ''; drop(LS, KEY.unsent); } }

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
    } else { $('photo-thumb').removeAttribute('src'); }
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
    const typeOk = FILE_TYPES.includes(file.type) || (!file.type && FILE_EXT.test(file.name));
    if (!typeOk) { photoError(t('item.errType', { name: file.name })); $('photo').value = ''; return; }
    if (file.size > STUDIO_CONFIG.maxFileBytes) { photoError(t('item.errSize', { name: file.name })); $('photo').value = ''; return; }
    photoError('');
    setFile(file);
    forgetRunId(); clearSubmitMessage(); show($('brief-errors'), false); renderBrief();
    announce((files.length > 1 ? t('item.onlyOne', { name: file.name }) + ' ' : '') + t('item.added', { name: file.name }));
    focusNode($('photo-replace'));
  }

  const inProduction = () => state.stage === 'progress' && !watch.stopped;

  /* ------------------------------------------------------------------ the brief at a glance
     Each card shows its current value in its heading row, so the panel doubles as the review. */
  const imagesText = n => (n === 1 ? t('review.images', { n: 1 }) : t('review.imagesMany', { n }));
  function renderBrief() {
    const b = state.brief, e = effective(b), web = isWebsite(b), white = isWhite(b);
    const outcome = STRINGS.scope.options[b.outcome];
    const pick = value => value || t('labels.studioChoice');
    const set = (id, text) => { $(id).textContent = text; };
    set('brief-sub', outcome.title + ' · ' + outcome.body);
    set('val-photo', state.file ? t('ws.added') : t('ws.required'));
    set('val-item', [nodeName(b.department), nodeName(b.category), subLabel()].filter(Boolean).join(' / ') || t('labels.auto'));
    const short = e.madeCount < e.imageCount;                // a series with left side images: say how many are made, never hide it
    set('val-count', short ? t('scope.countMade', { made: e.madeCount, n: e.imageCount }) : String(e.imageCount));
    $('count-list').replaceChildren(...e.images.map(img => el('li', img.made ? { text: imageName(img) }
      : { class: 'imagelist__notmade', text: t('scope.imageNotMade', { name: imageName(img) }) })));
    const missing = e.imageCount - e.madeCount;
    set('count-made', short ? (missing === 1 ? t('scope.countMadeOne', { made: e.madeCount, n: e.imageCount }) : t('scope.countMadeMany', { made: e.madeCount, n: e.imageCount, k: missing })) : '');
    show($('count-made'), short);
    set('val-series', white ? t('ws.notOnWhite') : STRINGS.options.series[e.series]);
    set('val-camera', white ? t('ws.notOnWhite') : (e.inSeries ? t('ws.setBySeries') : (STRINGS.options.camera[e.camera] || '')));
    set('val-view', white ? t('ws.notOnWhite') : (e.inSeries ? t('ws.setBySeries') : STRINGS.options.view[e.view]));
    set('val-aspect', web ? t('ws.setForWebsite', { v: STRINGS.options.aspect['1:1'] }) : (white ? t('scope.aspectWhite') : STRINGS.options.aspect[b.aspect]));
    set('val-resolution', web ? t('ws.setForWebsite', { v: STRINGS.options.resolution[e.resolution] }) : STRINGS.options.resolution[e.resolution]);
    set('val-atmosphere', b.studioChoice ? t('labels.studioChoice') : '');
    set('val-lighting', e.series === 'Views by light' ? t('ws.setBySeries') : pick(STRINGS.options.lighting[e.lighting]));
    set('val-wall', pick(STRINGS.options.wall[e.wallPaint]));
    set('val-floor', pick(STRINGS.options.floor[e.floor]));
    set('val-touches', white ? t('ws.notOnWhite') : (e.human ? t('sug.human') : t('labels.none')));
    const kept = [b.color, b.material, b.hero].filter(text => text.trim()).length + lines(b.locks).length + lines(b.mustNot).length;
    set('val-faithful', kept ? t('ws.detailsCount', { n: kept }) : t('ws.optional'));

    const busy = inProduction();                             // one request at a time: no second paid request by accident
    $('submit-btn').disabled = busy || state.sending;
    set('brief-hint', busy ? t('ws.hintBusy') : !state.file ? t('ws.hintNoPhoto')
      : web ? t('scope.expectWebsite')
        : white ? t('scope.expectWhite')
          : e.inSeries ? STRINGS.scope.expectSeries[e.series]
            : (STRINGS.scope.expectViews[b.view] || STRINGS.scope.expectViews['Category template']));
    set('submit-count', short ? t('review.imagesMade', { made: e.madeCount, n: e.imageCount }) : imagesText(e.imageCount));
    const usage = usageText();
    set('brief-usage', usage); show($('brief-usage'), !!usage);

    // The empty result stage follows the brief: first the photo, then the direction.
    set('stage-a', state.file ? t('ws.readyA') : t('ws.emptyA'));
    set('stage-b', state.file ? t('ws.readyB') : t('ws.emptyB'));
    set('stage-lead', state.file ? t('ws.readyLead') : t('ws.emptyLead'));
    const now = state.file ? 1 : 0;
    $('stage-steps').replaceChildren(...STRINGS.ws.steps.map((name, i) => el('li', { class: i === now ? 'is-now' : '', 'aria-current': i === now ? 'step' : null, text: String(i + 1).padStart(2, '0') + ' ' + name })));
  }

  /* ------------------------------------------------------------------ session */
  function usageText() {
    const s = state.session;
    return s && s.limit > 0 ? t('session.usage', { used: s.used, limit: s.limit }) : '';
  }
  function renderSession() {
    const signedIn = !!state.session;
    document.body.classList.toggle('is-in', signedIn);
    bind('clientName', signedIn ? state.session.clientName : '');
    bind('usage', usageText());
    show($('view-signin'), !signedIn); show($('view-app'), signedIn);
    renderRecent(); updateHero();
    if (signedIn) renderBrief();
  }
  function saveSession() { write(SS, KEY.session, state.session); }
  const inStudio = () => document.body.classList.contains('is-studio');
  function signOut(message) {
    stopWatching();
    drop(SS, KEY.code); drop(SS, KEY.session);
    state.session = null; state.result = null; state.run = null;
    renderSession();
    const notice = $('signin-notice');
    notice.textContent = message || ''; show(notice, !!message);
    signinError('');
    if (inStudio()) focusNode($('access-code'));
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
    button.disabled = true; button.classList.add('is-busy'); button.textContent = t('signin.busy');
    const out = interpret(await api.signIn(code));
    button.disabled = false; button.classList.remove('is-busy'); button.textContent = t('signin.submit');
    if (out.kind === 'network') { signinError(t('signin.network')); focusNode(input); return; }
    if (out.kind === 'refused') { signinError(out.message); focusNode(input); return; }   // the studio's own message, nothing added
    const d = out.data;
    if (d.ok !== true) { signinError(t('signin.network')); return; }
    write(SS, KEY.code, code);                       // this tab only; gone when the tab closes
    input.value = ''; input.type = 'password'; $('show-code').checked = false;
    state.session = { clientName: String(d.client_name || ''), role: String(d.role || 'client'), limit: Number(d.monthly_image_limit) || 0, used: Number(d.images_used_this_month) || 0 };
    saveSession(); renderSession();
    enterStudio(true);
    announce(t('signin.welcome', { name: state.session.clientName }));
  }
  /* After sign-in or reload: resume a request in production, else show the brief. */
  function enterStudio(focus) {
    const pending = read(LS, KEY.pending);
    if (pending && pending.id && state.session && pending.clientName === state.session.clientName) {
      state.run = pending;
      setStage('progress');
      startWatching(false);
      if (focus) focusNode($('progress-title'));
    } else {
      setStage(state.result ? 'results' : 'empty');
      if (focus) focusNode($('brief-title'));
    }
  }
  /* The result panel shows one of three things. */
  function setStage(stage) {
    state.stage = stage;
    show($('stage-empty'), stage === 'empty'); show($('view-progress'), stage === 'progress'); show($('view-results'), stage === 'results');
    if (stage === 'empty') setTag(t('ws.tagIdle'), false);
    renderBrief();
  }
  function setTag(text, strong) {
    const tag = $('result-tag');
    tag.textContent = text;
    tag.classList.toggle('tag--ink', !!strong);
  }
  function updateHero() {
    const unfinished = hasDraft() || !!read(LS, KEY.pending);
    show($('hero-continue'), unfinished); show($('hero-how'), !unfinished);
  }

  /* ------------------------------------------------------------------ the two views: landing page and studio (#studio) */
  function go(hash) {
    closeMenu();
    state.hash = hash;
    try { window.history.pushState(null, '', hash); } catch (e) { /* a sandboxed preview: the view still switches */ }
    route(true);
  }
  function route(focus) {
    const hash = state.hash;
    const studio = hash === '#studio';
    document.body.classList.toggle('is-studio', studio);
    $('nav').classList.remove('is-hidden');
    if (studio) {
      window.scrollTo(0, 0);
      if (focus) focusNode(state.session ? $('studio-title') : $('access-code'));
    } else if (focus && hash.length > 1) {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target) { target.scrollIntoView(); if (target.hasAttribute('tabindex')) focusNode(target); }
    } else if (focus) window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------------ submit */
  function clearSubmitMessage() { const box = $('submit-message'); box.replaceChildren(); show(box, false); }
  function submitMessage(text, retry) {
    const box = $('submit-message');
    box.replaceChildren(el('p', { text: t('labels.error') + ' ' + text }),
      retry ? el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: t('submit.tryAgain'), onclick: submitRequest }) : null);
    show(box, true); focusNode(box); announce(text);
  }
  function validate() {
    const errors = [];
    if (!state.file) errors.push(t('item.errMissing'));
    else if (state.file.size > STUDIO_CONFIG.maxFileBytes) errors.push(t('item.errSize', { name: state.file.name }));
    const box = $('brief-errors');
    if (!errors.length) { show(box, false); return true; }
    photoError(errors[0]);                                   // next to the field …
    box.replaceChildren(el('h4', { text: t('ws.errorsTitle') }), el('ul', {}, ...errors.map(text => el('li', {},   // … and summarised by the button
      el('a', { href: '#card-photo', text, onclick: event => { event.preventDefault(); $('card-photo').scrollIntoView({ block: 'nearest' }); focusNode(state.file ? $('photo-replace') : $('photo')); } })))));
    show(box, true); focusNode(box);
    return false;
  }
  async function submitRequest() {
    if (state.sending || !state.session || inProduction()) return;
    clearSubmitMessage();
    if (!validate()) return;
    if (!state.runId) {                               // one reference per request, stored before sending
      state.runId = newId();
      write(LS, KEY.unsent, { id: state.runId, createdAt: Date.now() });
    }
    const id = state.runId;
    const payload = buildPayload(id);
    const button = $('submit-btn'), label = $('submit-label');
    state.sending = true; button.disabled = true; button.classList.add('is-busy'); label.textContent = t('ws.sending');
    const out = interpret(await api.submit(payload, state.file));
    state.sending = false; button.disabled = false; button.classList.remove('is-busy'); label.textContent = t('ws.submit');

    if (out.kind === 'network') { submitMessage(t('submit.network'), true); return; }           // same reference on retry
    const accepted = out.kind === 'ok' && out.data.ok === true && out.data.accepted === true;
    const duplicate = out.kind === 'refused' && out.reason === 'duplicate';                       // already received: treat as success
    if (accepted || duplicate) {
      const asked = accepted ? (Number(out.data.images_asked) || payload.scope.imageCount) : payload.scope.imageCount;
      const run = { id, acceptedAt: Date.now(), lastCheckAt: 0, imagesAsked: asked, fileName: state.file.name, outcome: payload.scope.outcome, aspect: payload.scope.aspect, clientName: state.session.clientName };
      state.run = run; state.result = null; state.fileRunId = id; state.runId = '';
      drop(LS, KEY.unsent); write(LS, KEY.pending, run);
      addRecent(run);
      if (accepted && state.session.limit > 0) { state.session.used += asked; saveSession(); bind('usage', usageText()); renderBrief(); }
      setStage('progress');
      startWatching(false);
      focusNode($('progress-title'));
      announce(t('progress.announceRunning'));
      updateHero();
      return;
    }
    if (out.kind === 'refused') {
      if (out.reason === 'access_denied' || out.reason === 'access_off') { signOut(out.message); return; }   // the draft stays saved
      if (out.reason === 'limit_reached') {
        const limit = Number(out.data.monthly_image_limit), used = Number(out.data.images_used_this_month);
        if (Number.isFinite(limit) && Number.isFinite(used)) {
          state.session.limit = limit; state.session.used = used; saveSession(); bind('usage', usageText()); renderBrief();
          submitMessage(t('submit.limit', { message: out.message, used, limit }), false);
        } else submitMessage(out.message, false);
        return;
      }
      if (out.reason === 'bad_request') console.error('[studio] The studio refused the request as incomplete. This is a fault in the page.', { reason: out.reason, message: out.message });
      submitMessage(out.message, out.reason === 'try_again');
      return;
    }
    submitMessage(t('submit.refused'), true);
  }

  /* ------------------------------------------------------------------ progress and polling
     The studio reports only "not finished" or "finished". First check after firstMs, then every
     everyMs. Each check costs the studio one workflow run, so the page never checks faster. */
  const watch = { timer: 0, clock: 0, failures: 0, token: 0, busy: false, stopped: true };
  function stopWatching() {
    watch.stopped = true; watch.token += 1;
    window.clearTimeout(watch.timer); window.clearInterval(watch.clock);
  }
  function savePending() { if (state.run && read(LS, KEY.pending)) write(LS, KEY.pending, state.run); }
  function setTimeline(received, production, ready) {
    const labels = { 'is-done': t('progress.stateDone'), 'is-now': t('progress.stateNow'), 'is-waiting': t('progress.stateWaiting'), 'is-unconfirmed': t('progress.stateUnconfirmed') };
    [['tl-received', received], ['tl-production', production], ['tl-ready', ready]].forEach(([id, cls]) => {
      const item = $(id);
      item.className = 'timeline__item ' + (cls === 'is-unconfirmed' ? 'is-waiting' : cls);
      item.querySelector('[data-role="state"]').textContent = labels[cls];
    });
  }
  function updateElapsed() {
    if (state.run) $('tl-elapsed').textContent = t('progress.elapsed', { time: elapsedText(Date.now() - state.run.acceptedAt) });
  }
  function renderProgress() {
    const run = state.run;
    $('progress-title').textContent = t('progress.titleRunning');
    setTag(t('ws.tagProduction'), true);
    bind('reference', run.id);
    $('tl-received-time').textContent = t('progress.receivedAt', { time: dateTimeText(run.acceptedAt) });
    setTimeline('is-done', 'is-now', 'is-waiting');
    show($('progress-message'), false);
    updateElapsed();
  }
  function progressProblem(text, title, retry, tag) {
    stopWatching();
    $('progress-title').textContent = title;
    setTag(tag, false);
    setTimeline('is-done', 'is-unconfirmed', 'is-waiting');
    $('progress-message-text').textContent = text;
    const again = $('progress-retry');
    again.disabled = false; again.textContent = t('progress.checkAgain'); show(again, retry);
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
    if (watch.stopped || document.hidden || !state.run) return;         // no checks while the tab is hidden
    const cfg = pollCfg(), run = state.run;
    const due = run.lastCheckAt ? run.lastCheckAt + cfg.everyMs : run.acceptedAt + cfg.firstMs;
    watch.timer = window.setTimeout(check, immediate ? 0 : Math.max(0, due - Date.now()));
  }
  async function check() {
    if (watch.stopped || watch.busy || !state.run || document.hidden) return;
    const token = watch.token, run = state.run, cfg = pollCfg();
    watch.busy = true; run.lastCheckAt = Date.now(); savePending();
    const out = interpret(await api.status(run.id));
    watch.busy = false;
    if (token !== watch.token) return;                                   // the client moved on while we waited
    if (out.kind === 'refused' && (out.reason === 'access_denied' || out.reason === 'access_off')) { signOut(out.message); return; }
    if (out.kind === 'refused' && out.reason === 'unknown_request') {
      updateRecent(run.id, 'unknown'); drop(LS, KEY.pending); updateHero();
      progressProblem(out.message, t('progress.titleUnknown'), false, t('ws.tagNotFound'));
      return;
    }
    if (out.kind !== 'ok') {                                             // unreachable, unreadable, or "try again"
      watch.failures += 1;
      if (watch.failures >= cfg.maxFailures) { progressProblem(out.kind === 'refused' ? out.message : t('progress.unreachable'), t('progress.titleStopped'), true, t('ws.tagUnconfirmed')); return; }
      scheduleCheck(false);
      return;
    }
    watch.failures = 0;
    if (out.data.found === true) { finishRun(out.data); return; }
    const limit = run.imagesAsked > 1 ? cfg.limitManyMs : cfg.limitOneMs;
    if (Date.now() - run.acceptedAt > limit) { progressProblem(t('progress.timeout'), t('progress.titleStopped'), true, t('ws.tagUnconfirmed')); return; }
    scheduleCheck(false);
  }
  function finishRun(data) {
    stopWatching();
    state.result = data;
    updateRecent(state.run.id, data.owner_decision || data.status || 'hold');
    drop(LS, KEY.pending); updateHero();
    renderResults();
    setStage('results');
    focusNode($('results-title'));
    announce(t('progress.announceReady'));
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) window.clearTimeout(watch.timer);
    else if (!watch.stopped) scheduleCheck(false);
  });

  /* ------------------------------------------------------------------ results */
  /* The words after "Image n," in a result title. A series image is named by its camera and light ("full frontal, daylight");
     a single image by its view, then its camera when it is not the vendor photo's angle. */
  function viewWord(image) {
    const R = STRINGS.results;
    const camera = R.cameras[image.camera] || '';
    if (image.series && camera) return camera + ', ' + (R.lights[image.light] || R.lights.studio);
    const key = R.views[image.role] ? image.role : image.view;
    return [R.views[key] || '', camera].filter(Boolean).join(', ');
  }
  const sideWord = image => (image.camera === 'Right side' ? STRINGS.results.cameras['Right side'] : STRINGS.results.cameras['Left side']);
  function checkList(checks) {
    const entries = (Array.isArray(checks) ? checks : []).filter(Array.isArray);
    if (!entries.length) return null;
    const bad = entries.filter(entry => String(entry[1]).toLowerCase() !== 'pass').length;
    return el('details', { class: 'details' },
      el('summary', { text: bad ? t('results.checksSome', { x: bad, n: entries.length }) : t('results.checksAll', { n: entries.length }) }),
      el('ul', {}, ...entries.map(entry => {
        const word = String(entry[1] || 'unknown').toLowerCase();
        const name = STRINGS.results.checkNames[entry[0]] || String(entry[0] || '').replace(/_/g, ' ');
        return el('li', {}, el('b', { text: name }), el('i', { class: word === 'pass' ? '' : 'is-bad', text: STRINGS.results.checkResults[word] || STRINGS.results.checkResults.unknown }),
          entry[2] ? el('span', { text: String(entry[2]) }) : null);
      })));
  }
  function shotCard(image, index, run, canCompare) {
    const ok = image.status === 'passed';
    const n = Number(image.shot) || index + 1;
    const view = viewWord(image);
    const title = el('h4', { class: 'shot__title', text: view ? t('results.imageTitleView', { n, view }) : t('results.imageTitle', { n }) });
    if (image.status === 'not_made') {   // never shown as an image: there is none
      return el('article', { class: 'shot shot--notmade' },
        el('div', { class: 'shot__head' }, title, el('span', { class: 'pill pill--none', text: t('results.notMade') })),
        el('p', { class: 'notice shot__notmade', text: t('results.notMadeSide', { side: sideWord(image) }) }));
    }
    const card = el('article', { class: 'shot' },
      el('div', { class: 'shot__head' }, title,
        el('span', { class: 'pill' + (ok ? '' : ' pill--hold'), text: ok ? t('results.passed') : t('results.onHold') })));
    const media = el('div', { class: 'shot__media' });
    if (canCompare) {
      media.append(el('figure', { class: 'shot__fig shot__fig--original' },
        el('img', { src: state.fileUrl, alt: t('results.originalAlt', { file: run.fileName }) }), el('span', { class: 'tag', text: t('labels.original') })));
    }
    const url = safeImageUrl(image.image_url);
    const links = el('p', { class: 'shot__links' });
    if (url) {
      const picture = el('img', { alt: t('results.generatedAlt', { n, file: run.fileName || '' }), loading: index === 0 ? 'eager' : 'lazy', decoding: 'async' });
      const ratio = OPT.ratios[run.aspect];
      if (ratio) picture.style.setProperty('--ratio', ratio);
      const figure = el('figure', { class: 'shot__fig' }, picture, el('span', { class: 'tag tag--ink', text: t('labels.generated') }));
      picture.addEventListener('load', () => { if (picture.naturalWidth) picture.style.setProperty('--ratio', picture.naturalWidth + ' / ' + picture.naturalHeight); });
      picture.addEventListener('error', () => {            // image links are temporary
        figure.replaceWith(el('p', { class: 'notice', text: t('results.expired') }));
        links.remove();
      });
      picture.src = url;
      media.append(figure);
      links.append(el('a', { href: url, target: '_blank', rel: 'noopener', text: t('results.open') }), el('a', { href: url, download: '', target: '_blank', rel: 'noopener', text: t('results.download') }));
    } else {
      media.append(el('p', { class: 'notice', text: t('results.noImage') }));
    }
    card.append(media);
    if (!ok && image.problem) card.append(el('p', { class: 'shot__problem' }, el('strong', { text: t('results.problem') + ' ' }), String(image.problem)));
    if (url) card.append(links);
    const checks = checkList(image.checks);
    if (checks) card.append(checks);
    return card;
  }
  function renderResults() {
    const result = state.result, run = state.run;
    if (!result || !run) return;
    bind('reference', run.id);
    const summary = String(result.summary || '');
    const secondLine = (summary.split('\n')[1] || '').trim();
    let images = (Array.isArray(result.images) ? result.images : []).filter(image => image && typeof image === 'object');
    if (!images.length && (result.image_url || result.status === 'reviewed_candidate')) {       // older reply shape: one image at the top level
      images = [{ shot: 1, status: result.status === 'reviewed_candidate' ? 'passed' : 'hold', view: '', image_url: result.image_url, problem: result.status === 'reviewed_candidate' ? '' : secondLine, checks: result.checks }];
    }
    const notMade = images.filter(image => image.status === 'not_made').length;
    const made = images.length - notMade;
    const total = images.length, passed = images.filter(image => image.status === 'passed').length;
    const status = notMade && result.status === 'reviewed_candidate' ? 'partial'   // an image not made: partly ready, never complete
      : (result.status || (total && passed === total ? 'reviewed_candidate' : passed ? 'partial' : 'hold'));
    let title, lead;
    if (status === 'reviewed_candidate') { title = t('results.titleReady'); lead = total === 1 ? t('results.allOne') : t('results.allMany', { n: total }); }
    else if (status === 'partial') {
      title = t('results.titlePartial');
      lead = notMade && passed === made ? t('results.madeAllPassed', { n: made }) : t('results.partial', { x: passed, n: made });
    }
    else {
      title = t('results.titleHold');
      const reason = secondLine || String((images.find(image => image.problem) || {}).problem || '');
      lead = reason ? t('results.hold', { reason }) : t('results.holdNoReason');
    }
    if (notMade) lead += ' ' + (notMade === 1 ? t('results.notMadeOne') : t('results.notMadeMany', { k: notMade }));
    $('results-title').textContent = title;
    $('results-lead').textContent = lead;
    setTag(STRINGS.recent.status[status] || STRINGS.recent.status.hold, status === 'reviewed_candidate');

    const pack = result.package && typeof result.package === 'object' ? result.package : null;
    const web = pack && pack.website_package && typeof pack.website_package === 'object' ? pack.website_package : null;
    const packLine = $('results-package');
    packLine.replaceChildren();
    if (web) packLine.append(el('span', { class: 'pill' + (web.complete === true ? '' : ' pill--hold'), text: web.complete === true ? t('results.packageComplete') : t('results.packageIncomplete') }));
    show(packLine, !!web);

    const decisionText = { accepted: t('results.decisionAccepted'), changes_requested: t('results.decisionChanges'), rejected: t('results.decisionRejected') }[result.owner_decision];
    const decision = $('results-decision');
    decision.replaceChildren();
    if (decisionText) {                                // shown only when the studio has recorded a decision
      const when = result.decided_at && !Number.isNaN(Date.parse(result.decided_at)) ? t('results.decidedOn', { date: new Date(result.decided_at).toLocaleDateString(STRINGS.meta.lang, { day: 'numeric', month: 'long', year: 'numeric' }) }) : '';
      decision.append(el('strong', { text: decisionText }), when ? el('p', { text: when }) : null, result.owner_note ? el('p', { text: String(result.owner_note) }) : null);
    }
    show(decision, !!decisionText);

    const canCompare = !!state.file && state.fileRunId === run.id;       // the original is the file still held in this tab
    if (!canCompare) state.compare = 'single';
    show($('compare-bar'), canCompare && total > 0); show($('compare-missing'), !canCompare && total > 0);
    $('results-grid').replaceChildren(...images.map((image, index) => shotCard(image, index, run, canCompare)));
    applyCompare();

    const body = $('results-details-body');
    body.replaceChildren();
    if (web) {
      const names = list => (Array.isArray(list) && list.length ? list.map(role => STRINGS.results.views[role] || String(role)).join(', ') : t('labels.none'));
      body.append(el('h4', { text: t('results.detailsViews') }), el('p', { text: t('results.detailsViewsLine', { passed: names(web.passed), missing: names(web.missing) }) }));
    }
    if (pack && Array.isArray(pack.catalogue) && pack.catalogue.length) {
      body.append(el('h4', { text: t('results.detailsPieces') }), el('ul', {}, ...pack.catalogue.map(piece => el('li', { text: [piece && piece.name, piece && piece.sku].filter(Boolean).join(' · ') }))));
    }
    if (pack && Array.isArray(pack.limitations) && pack.limitations.length) {
      body.append(el('h4', { text: t('results.detailsLimits') }), el('ul', {}, ...pack.limitations.map(text => el('li', { text: String(text) }))));
    }
    if (summary) body.append(el('h4', { text: t('results.detailsSummary') }), el('pre', { text: summary }));
    $('results-details').open = false;
    show($('results-details'), body.childElementCount > 0);
  }
  function applyCompare() {
    const side = state.compare === 'side';
    $('results-grid').classList.toggle('is-side', side);
    $('compare-single').setAttribute('aria-pressed', side ? 'false' : 'true');
    $('compare-side').setAttribute('aria-pressed', side ? 'true' : 'false');
  }

  /* ------------------------------------------------------------------ recent requests on this device */
  function addRecent(run) {
    const list = (read(LS, KEY.recent) || []).filter(item => item && item.id !== run.id);
    list.unshift({ id: run.id, time: run.acceptedAt, clientName: run.clientName, fileName: run.fileName, outcome: run.outcome, imageCount: run.imagesAsked, aspect: run.aspect, status: 'sent' });
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
    $('recent-count').textContent = String(mine.length);
    $('recent-list').replaceChildren(...mine.map(item => {
      const outcome = (STRINGS.scope.options[item.outcome] || {}).title || String(item.outcome || '');
      return el('div', { class: 'recent' },
        el('div', { class: 'recent__main' },
          el('p', { class: 'recent__file', text: item.fileName || '' }),
          el('p', { class: 'recent__meta', text: t('recent.meta', { outcome, count: imagesText(Number(item.imageCount) || 1), time: dateTimeText(item.time) }) }),
          el('p', { class: 'recent__ref', text: item.id })),
        el('span', { class: 'recent__status', text: STRINGS.recent.status[item.status] || STRINGS.recent.status.sent }),
        el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: t('recent.check'), 'aria-label': t('recent.check') + ': ' + (item.fileName || item.id), onclick: () => checkRecent(item) }));
    }));
    show($('recent-empty'), !mine.length); show($('recent-note'), mine.length > 0);
  }
  function checkRecent(item) {
    if (!state.session) return;
    state.run = { id: item.id, acceptedAt: Number(item.time) || Date.now(), lastCheckAt: 0, imagesAsked: Number(item.imageCount) || 1, fileName: item.fileName, outcome: item.outcome, aspect: item.aspect, clientName: item.clientName };
    state.result = null;
    write(LS, KEY.pending, state.run); updateHero();
    setStage('progress');
    startWatching(true);                                // one check now, asked for by the client
    focusNode($('progress-title'));
  }

  /* ------------------------------------------------------------------ actions */
  function copyReference() {
    const id = state.run ? state.run.id : '';
    if (!id) return;
    const done = () => announce(t('labels.copied'));
    const fail = () => announce(t('labels.copyFailed'));
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(id).then(done, fail); else fail();
  }
  function startNew() {
    stopWatching(); drop(LS, KEY.pending);
    state.run = null; state.result = null;
    resetBrief();
    setStage('empty');
  }
  const actions = {
    signout: () => signOut(''),
    create: () => {                                      // "Create a new request": a fresh brief, after asking if there is a draft
      closeMenu();
      if (!(state.session && (hasDraft() || state.file || state.run))) return true;
      const dialog = $('confirm-new');
      if (typeof dialog.showModal !== 'function') { startNew(); return true; }
      dialog.showModal();                                // an in-page dialog: browser confirm boxes are blocked in embedded previews
      return false;
    },
    continue: () => { closeMenu(); return true; },
    'copy-ref': copyReference,
    'request-change': () => { forgetRunId(); $('brief-scroll').scrollTop = 0; focusNode($('brief-title')); },   // same choices, adjust, submit again
    'new-item': () => { startNew(); focusNode($('brief-title')); }
  };

  /* ------------------------------------------------------------------ navigation capsule and menu */
  function closeMenu() {
    const menu = $('menu'), burger = $('burger');
    if (menu.hidden) return;
    menu.hidden = true; burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', t('nav.openMenu'));
    document.documentElement.style.overflow = '';
  }
  function toggleMenu() {
    const menu = $('menu'), burger = $('burger');
    if (!menu.hidden) { closeMenu(); focusNode(burger); return; }
    menu.hidden = false; burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', t('nav.closeMenu'));
    document.documentElement.style.overflow = 'hidden';
    $('nav').classList.remove('is-hidden');
  }
  function initNav() {
    const nav = $('nav'), burger = $('burger');
    burger.setAttribute('aria-label', t('nav.openMenu'));
    burger.addEventListener('click', toggleMenu);
    $('menu').addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('menu').hidden) { closeMenu(); focusNode(burger); } });
    let lastY = window.scrollY;
    window.addEventListener('scroll', () => {            // the capsule hides on the way down and returns on the way up
      const y = window.scrollY;
      const hide = y > lastY && y > 240 && $('menu').hidden && !nav.contains(document.activeElement);
      nav.classList.toggle('is-hidden', hide);
      lastY = y;
    }, { passive: true });
    nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));
    window.matchMedia('(min-width: 1100px)').addEventListener('change', event => { if (event.matches) closeMenu(); });
  }

  /* ------------------------------------------------------------------ mock bar */
  function initMock() {
    if (!MOCK) return;
    document.body.classList.add('is-mock');
    show($('mockbar'), true);
    [['mock-signin', 'signin', STRINGS.mock.signinOptions], ['mock-submit', 'submit', STRINGS.mock.submitOptions], ['mock-result', 'result', STRINGS.mock.resultOptions]].forEach(([id, key, options]) => {
      const select = $(id);
      fillSelect(select, Object.entries(options), mockState[key]);
      mockState[key] = select.value;
      select.addEventListener('change', () => { mockState[key] = select.value; });
    });
  }

  /* ------------------------------------------------------------------ start */
  function init() {
    document.documentElement.lang = STRINGS.meta.lang;      // language and direction are set from this one place
    document.documentElement.dir = STRINGS.meta.dir;
    document.title = STRINGS.meta.title;
    applyStrings(document);
    renderStatic();
    buildControls();
    initNav();
    initMock();

    loadDraft();
    const unsent = read(LS, KEY.unsent);
    state.runId = unsent && typeof unsent.id === 'string' ? unsent.id : '';
    $('draft-note').textContent = state.draftSavedAt ? t('ws.draftSaved', { time: timeText(state.draftSavedAt) }) : t('ws.draftIdle');

    // Events: the brief
    const form = $('brief-form');
    const onBrief = event => { if (event.target.type !== 'file') { readForm(); briefChanged(); } };
    form.addEventListener('input', onBrief);
    form.addEventListener('change', onBrief);
    form.addEventListener('submit', event => event.preventDefault());
    $('submit-btn').addEventListener('click', submitRequest);   // a plain button: embedded previews block form submission
    form.addEventListener('keydown', event => { if (event.key === 'Enter' && event.target.matches('input[type="text"]')) event.preventDefault(); });   // Enter in a one-line field must not send a paid request
    $('outcome-tabs').addEventListener('change', () => { readForm(); briefChanged(); });   // the tabs sit outside the form
    form.addEventListener('focusin', event => {          // on short screens Submit sticks to the bottom: keep the focused control clear of it
      const foot = form.querySelector('.ws__foot');
      if (window.getComputedStyle(foot).position !== 'sticky' || foot.contains(event.target)) return;
      const box = (event.target.closest('label') || event.target).getBoundingClientRect();
      const under = box.bottom + 12 - foot.getBoundingClientRect().top;
      if (under > 0) window.scrollBy(0, under);
      else if (box.top < 104) window.scrollBy(0, box.top - 104);
    });
    document.addEventListener('click', event => {
      const action = event.target.closest('[data-action]');
      if (action && actions[action.dataset.action] && actions[action.dataset.action](event) === false) { event.preventDefault(); return; }
      const link = event.target.closest('a[href^="#"]');   // in-page links switch the view here, so they also work where the address cannot change
      if (link && !event.defaultPrevented) { event.preventDefault(); go(link.getAttribute('href')); }
    });
    $('confirm-new-keep').addEventListener('click', () => $('confirm-new').close());
    $('confirm-new-go').addEventListener('click', () => { $('confirm-new').close(); startNew(); go('#studio'); });

    // Events: the product photo
    const dropzone = $('drop');
    $('photo').addEventListener('change', event => takeFiles(event.target.files));
    ['dragenter', 'dragover'].forEach(type => dropzone.addEventListener(type, event => { event.preventDefault(); dropzone.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach(type => dropzone.addEventListener(type, event => { event.preventDefault(); dropzone.classList.remove('is-over'); }));
    dropzone.addEventListener('drop', event => takeFiles(event.dataTransfer && event.dataTransfer.files));
    $('photo-replace').addEventListener('click', () => $('photo').click());
    $('photo-remove').addEventListener('click', () => { setFile(null); forgetRunId(); renderBrief(); announce(t('item.removed')); focusNode($('photo')); });

    // Events: sign-in, results, progress, the two views
    $('signin-form').addEventListener('submit', event => event.preventDefault());
    $('signin-submit').addEventListener('click', onSignIn);
    $('access-code').addEventListener('keydown', event => { if (event.key === 'Enter') onSignIn(event); });
    $('show-code').addEventListener('change', event => { $('access-code').type = event.target.checked ? 'text' : 'password'; });
    $('compare-single').addEventListener('click', () => { state.compare = 'single'; applyCompare(); });
    $('compare-side').addEventListener('click', () => { state.compare = 'side'; applyCompare(); });
    $('progress-retry').addEventListener('click', () => { if (state.run) startWatching(true); });
    window.addEventListener('hashchange', () => { closeMenu(); state.hash = window.location.hash; route(true); });

    // Restore the signed-in client for this tab, if any.
    const session = read(SS, KEY.session);
    if (getCode() && session && typeof session.clientName === 'string') {
      state.session = { clientName: session.clientName, role: String(session.role || 'client'), limit: Number(session.limit) || 0, used: Number(session.used) || 0 };
    }
    // Mock mode only: "Skipped (preview)" opens the studio without the sign-in, to look at the inner screens.
    if (!state.session && MOCK && mockState.signin === 'skip') {
      write(SS, KEY.code, 'mock-preview');
      state.session = { clientName: t('mock.clientName'), role: 'client', limit: 500, used: 12 };
      saveSession();
    }
    setStage('empty');
    syncForm();
    renderSession();
    if (state.session) enterStudio(false);
    else if (read(LS, KEY.pending)) { $('signin-notice').textContent = t('signin.resume'); show($('signin-notice'), true); }
    state.hash = window.location.hash;
    route(false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
