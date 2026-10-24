/* Midas Virtual Studio — client page for studio draft A6 (14 Oct 2026).
   Copy of the pipeline 3 page. Changes for A6: A6 addresses; every request waits for the studio team's go
   before images are made, and the page keeps checking while it waits; Re-generate is not offered,
   because A6 has it switched off; client wording has no internal or provider names.
   14 Oct 2026, owner go: while a request waits, the studio team can give the go or stop it from the
   waiting view. That uses the OWNER key, a different key from the studio key; it is read from its own
   field for one call and the field is then cleared. It is never stored, put in an address or logged here.
   Plain JavaScript, no build step. Everything in this file is public:
   never put the studio key, a token or an API key here. The key is typed into the page,
   kept in memory only and sent as a request header. */

const STUDIO_CONFIG = {
  keyHeader: 'X-Midas-Key',
  submitUrl: 'https://ibrahimnewaeon.app.n8n.cloud/webhook/claude-midas-vton-a6',
  statusUrl: 'https://ibrahimnewaeon.app.n8n.cloud/webhook/claude-midas-vton-a6-status',
  fileUrl: 'https://ibrahimnewaeon.app.n8n.cloud/webhook/claude-midas-vton-a6-file',
  /* The studio team's go or stop for a waiting request. Accepts the OWNER key only. */
  decisionUrl: 'https://ibrahimnewaeon.app.n8n.cloud/webhook/claude-midas-vton-a6-decision',
  /* Empty: A6 has its re-generate address switched off, so the page does not offer Re-generate. */
  regenerateUrl: '',
  maxImages: 4,
  maxFileBytes: 25 * 1024 * 1024,
  /* limitOneMs / limitManyMs: how long to wait for the images once production runs. Past the limit the
     page stops checking and offers "Check again". waitEveryMs: how often to check while the request
     waits for the studio team's go; time spent waiting does not count toward the limit. */
  poll: { firstMs: 30000, everyMs: 15000, waitEveryMs: 60000, limitOneMs: 1200000, limitManyMs: 2700000, maxFailures: 3 },
  mock: false
};

/* Short timings used only in mock mode, so every state can be seen in seconds. */
const MOCK_POLL = { firstMs: 2500, everyMs: 1500, waitEveryMs: 1500, limitOneMs: 9000, limitManyMs: 12000, maxFailures: 3 };

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
  auth: { signOut: 'Sign out', signedOut: 'You are signed out. The key has been forgotten.', ownerName: 'Owner' },
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
      { title: 'Direction', body: 'Choose the outcome, the views and the proportions. Set the lighting, wall paint and floor, or let the studio choose.' },
      { title: 'Create', body: 'Check your brief and submit the request. The studio plans the images, then waits for a go from the Midas studio team before it makes them.' },
      { title: 'Review', body: 'Each image goes through the studio\'s automatic checks. You see which images passed and which are on hold, beside the photo you sent.' },
      { title: 'Deliver', body: 'Open each image at full size or download it. If an image is on hold, request a change and submit again.' }
    ]
  },
  outcomes: {
    eyebrow: 'What you can request', titleA: 'Three outcomes,', titleB: 'one short brief.',
    cards: [
      { label: '1 to 4 images', title: 'Lifestyle', body: 'The item in a styled setting. Choose the lighting, wall paint and floor, or let the studio choose.', note: 'Each image is a different scene of the same product. A white catalogue image is made first, and the scenes are made from it.' },
      { label: '1 to 4 images', title: 'White BK', body: 'Clean catalogue imagery on a pure white background, with a soft contact shadow under the product.', note: 'The first image keeps the camera angle of your photo. Wall paint and floor do not apply on white.' },
      { label: '4 images', title: 'Website', body: 'A package of four views: catalogue on white, hero, wide and detail.', note: 'The views and square proportions are set for you.' }
    ],
    laterLabel: 'Coming later:',
    laterText: 'Edit, Single item, Batch, New Composition and Create with this item. You will see them in the brief, but they cannot be selected yet.'
  },
  statuses: {
    eyebrow: 'Review', titleA: 'Every image says', titleB: 'what it is.',
    lead: 'A result arrives with its status in words. You can compare each one with the photo you sent before you download it.',
    rows: [
      { name: 'Generated image', detail: 'The label on every result.' },
      { name: 'Passed automatic checks', detail: 'The image met the studio\'s checks.' },
      { name: 'On hold', detail: 'The image needs a person. The reason is shown.' }
    ]
  },
  faq: {
    eyebrow: 'Questions', titleA: 'Good to know', titleB: 'before you start.',
    items: [
      { q: 'What do I need to start?', a: 'The studio key and one product photo. The Midas studio team gives you the key. The photo can be JPG, PNG or WebP, up to 25 MB.' },
      { q: 'How many images will I receive?', a: 'For Lifestyle you choose 1 to 4 scenes, and a white catalogue image is made first, in addition. For White BK you choose 1 to 4 views on pure white, each with a soft contact shadow under the product. A Website request is always four views: catalogue on white, hero, wide and detail.' },
      { q: 'How long does a request take?', a: 'The studio does not quote a completion time. After you submit, the studio plans the images and waits for a go from the Midas studio team. When a white catalogue image comes first, it waits for a go again before the other images. Images are made one after another, and a correction adds time. The page shows where your request is.' },
      { q: 'Can I close the page and come back?', a: 'Your draft brief is saved on this device, without the photo. Recent requests are listed on this device too. Neither is shared across devices. The studio key is not saved, so you enter it again when you return or reload the page.' },
      { q: 'What if a result is not right?', a: 'An image on hold shows the reason. Choose Request a change: the brief reopens with the same choices, so you can adjust it and submit a new request.' }
    ]
  },
  signin: {
    eyebrow: 'Studio access', titleA: 'Have the key?', titleB: 'Open the studio.',
    lead: 'Enter the studio key, then fill in a short brief for one product.',
    label: 'Studio key', show: 'Show key', submit: 'Open the studio', busy: 'Checking the key…',
    hint: 'The key the Midas studio team gave you. It is kept in memory only: it is not saved, and you enter it again after a reload.',
    empty: 'Enter the studio key.',
    badChars: 'The key contains a character that cannot be sent. Use the key exactly as you were given it.',
    refused: 'The studio did not accept this key. Check it and try again.',
    network: 'The studio could not be reached. Check your connection and try again.',
    resume: 'Enter the studio key to continue your request.',
    welcome: 'Key accepted. The studio is open.'
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
    hintBusy: 'One request at a time. You can submit again when this one is finished or stopped.',
    errorsTitle: 'Before you submit, fix this:',
    required: 'Required', added: 'Added', optional: 'Optional',
    setForWebsite: '{v} · set for Website',
    notOnWhite: 'Not applied on white',
    detailsCount: '{n} added',
    sections: {
      photo: 'Product photo', item: 'The item', count: 'Number of images', view: 'Views',
      aspect: 'Image proportions', resolution: 'Resolution', atmosphere: 'Room atmosphere',
      lighting: 'Lighting', wall: 'Wall paint', floor: 'Floor', touches: 'Finishing touches', faithful: 'Keep faithful'
    },
    rightLabel: 'Result and recent requests',
    resultTitle: 'Result',
    tagIdle: 'Nothing sent yet', tagProduction: 'In production', tagWaiting: 'Waiting for a go', tagStopped: 'Stopped', tagUnconfirmed: 'Not confirmed', tagNotFound: 'Not found',
    emptyA: 'Add a product photo and', emptyB: 'choose an outcome.',
    readyA: 'Check your brief, then', readyB: 'submit your request.',
    emptyLead: 'Use a clear photo that shows the whole product. The images appear here when they are ready.',
    readyLead: 'The images appear here when they are ready.',
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
    countHint: 'Lifestyle: the number of scenes, made in addition to the white catalogue image. White BK: the number of views on pure white.',
    websiteNote: 'A Website package is always four views: catalogue on white, hero, wide and detail. The number of images, the views, square proportions and 2K resolution are set for you.',
    expectOne: 'Expect 2 images: the white catalogue image, then 1 scene made from it.',
    expectMany: 'Expect {t} images: the white catalogue image, then {n} different scenes made from it.',
    expectAlt: 'Expect {t} images: the white catalogue image, then {n} scenes alternating between a wide view and a close-up.',
    expectWhiteOne: 'Expect 1 image on pure white, with a soft contact shadow, at the camera angle of your photo.',
    expectWhiteMany: 'Expect {n} images on pure white, each with a soft contact shadow: the first at the camera angle of your photo, then other views.',
    expectWebsite: 'Expect 4 images: catalogue on white, hero, wide and detail.',
    options: {
      'Lifestyle': { title: 'Lifestyle', body: 'The item in a styled setting' },
      'White BK': { title: 'White BK', body: 'Pure white, soft contact shadow' },
      'Website': { title: 'Website', body: 'A package of four views' }
    }
  },
  prefs: {
    studioChoice: 'Let the studio choose', studioChoiceNote: 'The studio picks the lighting, wall paint and floor.',
    whiteNote: 'Wall paint and floor are not applied on a white background, so they are not shown for White BK.'
  },
  sug: {
    plants: 'Plants', plantsNote: 'Natural accents in the scene.',
    human: 'Human presence', humanNote: 'A visible person in the scene.',
    catalogue: 'Midas supporting pieces', catalogueNote: 'Let the studio add pieces from a saved selection of Midas products.',
    mood: 'Mood / Vibes',
    whiteNote: 'Plants, people, supporting pieces and mood are not applied on a white background, so they are not shown for White BK.',
    faithfulNote: 'Say what must stay true to your product. Leave a field empty if you are not sure; the studio does not guess colour or material.',
    color: 'Confirmed colour', material: 'Confirmed material', hero: 'Hero item or focus',
    locks: 'Details to preserve', locksHint: 'One detail on each line, for example the number of chairs.',
    mustNot: 'Things to exclude', mustNotHint: 'One item on each line, for example a table that appears in your photo.'
  },
  review: { images: '{n} image', imagesMany: '{n} images' },
  submit: {
    network: 'Your request could not be sent. Check your connection and try again.',
    tryAgain: 'Try again',
    notPublished: 'The studio address was not found. The studio may be switched off. Try again later.',
    serverError: 'The studio answered with an error (HTTP {status}). Give the Midas studio team your request reference.',
    refused: 'The request was refused.'
  },
  progress: {
    titleRunning: 'In production.', titleStopped: 'No result yet.', titleStoppedByOwner: 'Stopped.',
    received: 'Request received', production: 'In production', ready: 'Ready',
    productionNote: 'The studio plans the images first, then waits for a go. Images are made one after another, and a correction adds time.',
    stateDone: 'Done', stateNow: 'Now', stateWaiting: 'Waiting', stateUnconfirmed: 'Not confirmed',
    receivedAt: 'Received at {time}', elapsed: 'Time elapsed: {time}',
    timeout: 'No result has arrived. The run may have stopped. Give the Midas studio team your request reference.',
    unreachable: 'The studio address could not be reached. Your request may still be running. Check your connection, then check again.',
    stoppedByOwner: 'This request was stopped before any image was made.',
    titleWaiting: 'Waiting for a go.', waiting: 'Waiting for a go',
    waitingNote: 'The plan is ready. Images are made after the Midas studio team gives a go. This page keeps checking while this tab is open.',
    announceWaiting: 'Your request is waiting for a go from the Midas studio team.',
    checkAgain: 'Check again',
    announceRunning: 'Request received. The studio is planning the images.',
    announceRegen: 'Re-generation started. The studio is making the image again.',
    announceReady: 'Your images are ready.'
  },
  results: {
    titleReady: 'Ready.', titlePartial: 'Partly ready.', titleHold: 'On hold.',
    allOne: 'The image passed the studio\'s automatic checks.',
    allMany: 'All {n} images passed the studio\'s automatic checks.',
    partial: '{x} of {n} images passed the automatic checks. The rest need a person.',
    hold: 'On hold. {reason}',
    holdNoReason: 'On hold. No image passed the automatic checks.',
    packageComplete: 'Package complete', packageIncomplete: 'Package incomplete',
    decisionAccepted: 'Approved by the studio', decisionChanges: 'The studio has asked for changes', decisionRejected: 'Not approved by the studio',
    decidedOn: 'Recorded on {date}.',
    viewLabel: 'View', single: 'Result only', side: 'Side by side with your photo',
    noOriginal: 'Your original photo is no longer held in this tab, so the side-by-side comparison is not available.',
    imageTitle: 'Image {n}', imageTitleView: 'Image {n}, {view}',
    views: { wide: 'wide view', close: 'close-up', catalogue: 'catalogue on white', hero: 'hero', detail: 'detail', lifestyle: 'lifestyle scene', view: 'other view on white' },
    passed: 'Passed automatic checks', onHold: 'On hold',
    problem: 'Why it is on hold:',
    madeAgain: 'Made again',
    regen: 'Re-generate', regenLabel: 'Re-generate image {n}', regenBusy: 'Starting the re-generation…',
    regenHint: 'Makes this image again with the same choices. The reason above is added as a correction. If the image it is made from is also on hold, that one is made again first. This uses paid image calls: up to 3 tries per image.',
    regenNetwork: 'The studio could not be reached, so nothing was started. Check your connection and try again.',
    regenFailed: 'The re-generation could not be started.',
    generatedAlt: 'Generated image {n} for {file}', originalAlt: 'Your original photo, {file}',
    expired: 'This image link has expired. Ask the studio team for the file using your request reference.',
    noImage: 'No image was saved for this one.',
    open: 'Open full size', download: 'Download full size',
    file: 'Download 1125 × 1125', fileBusy: 'Making the 1125 × 1125 file…', fileDone: 'Downloaded.',
    fileNetwork: 'The file address could not be reached.', fileFailed: 'The delivery file could not be made.',
    checksAll: 'Automatic checks: all {n} passed', checksSome: 'Automatic checks: {x} of {n} not passed',
    checkNames: {
      inventory_count: 'Piece count', handedness: 'Not mirrored', identity_shape: 'Shape and identity', excluded_absent: 'Exclusions respected',
      no_text_or_layout: 'Clean frame', client_rules: 'Your instructions', proportions: 'Proportions', colour_material: 'Colour and material',
      details: 'Details', no_invented_parts: 'Nothing invented', set_relations: 'Set arrangement', camera_framing: 'Camera and framing',
      scene_match: 'Scene', lighting: 'Lighting', light_contact: 'Light and contact',
      category_checks: 'Product type checks', catalogue_items: 'Midas supporting pieces'
    },
    checkResults: { pass: 'Pass', partial: 'Partial', fail: 'Fail', unknown: 'Unknown' },
    details: 'Request details', detailsSummary: 'Notes from the studio run', detailsViews: 'Website package views',
    detailsViewsLine: 'Passed: {passed}. Missing: {missing}.', detailsLimits: 'Limitations', detailsPieces: 'Midas supporting pieces used',
    change: 'Request a change', newItem: 'Start a new item'
  },
  recent: {
    check: 'Check result',
    regen: 're-generation',
    meta: '{outcome} · {count} · {time}',
    status: {
      sent: 'In progress when last checked', awaiting_go: 'Waiting for a go', stopped: 'Stopped before any image', reviewed_candidate: 'Ready', partial: 'Partly ready', hold: 'On hold',
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
    aspect: { 'Standard for category': 'Standard for category', 'Square · 1:1': 'Square · 1:1', 'Portrait · 4:5': 'Portrait · 4:5', 'Landscape · 16:9': 'Landscape · 16:9' },
    resolution: { 'Standard for category': 'Standard for category', '2K': '2K', '4K': '4K' },
    lighting: { 'Soft daylight': 'Soft daylight', 'Golden afternoon': 'Golden afternoon', 'Warm evening': 'Warm evening' },
    wall: { 'White': 'White', 'Ivory': 'Ivory', 'Sand': 'Sand', 'Greige': 'Greige', 'Taupe': 'Taupe', 'Sage': 'Sage', 'Charcoal': 'Charcoal', 'Terracotta': 'Terracotta' },
    floor: { 'Light oak': 'Light oak', 'Dark walnut': 'Dark walnut', 'Limestone': 'Limestone', 'Marble': 'Marble' },
    aspectShort: { 'Standard for category': 'Standard', 'Square · 1:1': '1:1', 'Portrait · 4:5': '4:5', 'Landscape · 16:9': '16:9' },
    resolutionShort: { 'Standard for category': 'Standard', '2K': '2K', '4K': '4K' },
    mood: { 'Automatic': 'Automatic', 'Calm & natural': 'Calm & natural', 'Warm & inviting': 'Warm & inviting', 'Refined & elegant': 'Refined & elegant', 'Bold & expressive': 'Bold & expressive' }
  },
  ownerGo: {
    summary: 'For the Midas studio team: give the go',
    lead: 'Check the plan, then give the go or stop the request. Images are made only after a go. This needs the owner key, not the studio key. The key is used for this one answer and is not kept.',
    firstTitle: 'First go: the plan',
    masterTitle: 'Second go: the white catalogue image',
    product: 'Product', inventory: 'Read from the photo', unknowns: 'Not confirmed', file: 'Photo sent',
    shotTitle: 'Image {n} · {role} · {frame}',
    setting: 'Setting', light: 'Light', presentation: 'Arrangement', props: 'Props',
    noPlan: 'The plan could not be shown here. You can still give the go or stop.',
    masterLead: 'The white catalogue image passed the automatic review. That makes it a reviewed candidate, not an approval.',
    masterNext: 'A go makes the other images: at least {n}.',
    masterMissing: 'The white catalogue image could not be shown here.',
    generated: 'Generated image',
    imageAlt: 'White catalogue image made for this request. Generated image.',
    keyLabel: 'Owner key',
    noteLabel: 'Note (optional)',
    go: 'Give the go', stop: 'Stop this request', confirmStop: 'Press again to stop',
    busy: 'Sending…',
    armedStop: 'Press "Press again to stop" within 8 seconds to stop. Nothing more is made for this request after a stop.',
    needKey: 'Enter the owner key.',
    sentGo: 'Go recorded at {time}. This page keeps checking.',
    sentStop: 'Stop recorded at {time}. Nothing more is made for this request.',
    refused: 'The owner key was refused. Nothing was recorded. The studio key does not work here.',
    network: 'The studio could not be reached. Nothing was recorded. Check your connection and try again.',
    problem: 'Not recorded: {problem}',
    unknown: 'The studio did not confirm the answer. Check the request again before trying once more.',
    roles: { catalogue: 'catalogue on white', lifestyle: 'lifestyle scene', base: 'base scene', variation: 'variation', hero: 'hero', wide: 'wide view', detail: 'detail', view: 'other view on white' },
    frames: { '1:1': 'square', '4:5': 'portrait 4:5', '16:9': 'landscape 16:9', '3:2': 'landscape 3:2', '2:3': 'portrait 2:3' }
  },
  mock: {
    title: 'Mock mode: no request is sent.',
    signin: 'Sign-in', submit: 'Submission', result: 'Result', regen: 'Re-generate', decision: 'Owner go',
    decisionOptions: { accepted: 'Recorded', denied: 'Owner key refused', problem: 'Not recorded (problem)', network: 'Network failure' },
    regenOptions: { accepted: 'Accepted', refused: 'Not possible', network: 'Network failure', denied: 'Key refused', error: 'Studio error' },
    signinOptions: { skip: 'Skipped (preview)', ok: 'Key accepted', denied: 'Key refused', network: 'Network failure' },
    submitOptions: { accepted: 'Accepted', network: 'Network failure', denied: 'Key refused', unpublished: 'Address not found', error: 'Studio error' },
    resultOptions: {
      passed: 'All images passed', partial: 'Partial', hold: 'Hold', website_complete: 'Website package complete',
      website_incomplete: 'Website package incomplete', approved: 'Approved by the studio', changes: 'Changes requested',
      rejected: 'Not approved', expired: 'Image link expired', never: 'No result until timeout',
      signedout: 'Key refused mid-run', unreachable: 'Address unreachable', waitgo: 'Waits for one go, then all passed', waitgo2: 'Waits for two goes, then all passed'
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
     localStorage: the draft brief, the request reference, recent requests. Never the studio key.
     sessionStorage: nothing. It is opened only to clear what the earlier access-code page left there. */
  function area(name) {
    try { const a = window[name]; a.getItem('midas.studio.probe'); return a; }
    catch (e) { const mem = new Map(); return { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: k => { mem.delete(k); } }; }
  }
  const LS = area('localStorage');
  const SS = area('sessionStorage');
  const read = (a, key) => { try { const raw = a.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } };
  const write = (a, key, value) => { try { a.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full or blocked: the page still works */ } };
  const drop = (a, key) => { try { a.removeItem(key); } catch (e) { /* ignore */ } };
  const KEY = { draft: 'midas.studio.draft', unsent: 'midas.studio.unsent', pending: 'midas.studio.pending', recent: 'midas.studio.recent', code: 'midas.studio.code', session: 'midas.studio.session' };

  /* ------------------------------------------------------------------ options (stable values sent to the studio) */
  const OPT = {
    jobs: [['new_project', true], ['edit', false], ['single_item', false]],
    work: [['one_by_one', true], ['batch', false]],
    outcomes: [['Lifestyle', true], ['White BK', true], ['Website', true], ['New Composition', false], ['Create with this item', false], ['Others', false]],
    view: ['Category template', 'Wide view', 'Close-up', 'Wide view + close-up'],
    aspect: ['Standard for category', 'Square · 1:1', 'Portrait · 4:5', 'Landscape · 16:9'],
    resolution: ['Standard for category', '2K', '4K'],
    lighting: ['Soft daylight', 'Golden afternoon', 'Warm evening'],
    wall: [['White', '#eeeae3'], ['Ivory', '#e7ddc8'], ['Sand', '#cfb996'], ['Greige', '#b7aea1'], ['Taupe', '#938074'], ['Sage', '#a3ad91'], ['Charcoal', '#575652'], ['Terracotta', '#b4745d']],
    floor: ['Light oak', 'Dark walnut', 'Limestone', 'Marble'],
    mood: ['Automatic', 'Calm & natural', 'Warm & inviting', 'Refined & elegant', 'Bold & expressive'],
    ratios: { 'Square · 1:1': '1 / 1', 'Portrait · 4:5': '4 / 5', 'Landscape · 16:9': '16 / 9' }
  };
  const PRODUCT_ROLE = 'Product / vendor reference';
  const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const FILE_EXT = /\.(jpe?g|png|webp)$/i;

  function defaultBrief() {
    return {
      jobMode: 'new_project', workOn: 'one_by_one',
      department: '', category: '', subCategory: '',
      outcome: 'Lifestyle', imageCount: 1, view: 'Category template', aspect: 'Standard for category', resolution: 'Standard for category',
      studioChoice: false, lighting: '', wallPaint: '', floor: '',
      plants: true, human: false, catalogue: false, mood: 'Automatic',
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
    sending: false, regenerating: false,
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
  function effective(b) {
    const web = isWebsite(b), white = isWhite(b);
    return {
      imageCount: web ? 4 : Math.min(Math.max(Number(b.imageCount) || 1, 1), STUDIO_CONFIG.maxImages),
      view: web ? 'Category template' : b.view,
      aspect: web ? 'Square · 1:1' : b.aspect,
      resolution: web ? '2K' : b.resolution,
      lighting: b.studioChoice ? '' : b.lighting,
      wallPaint: b.studioChoice || white ? '' : b.wallPaint,
      floor: b.studioChoice || white ? '' : b.floor,
      plants: white ? false : !!b.plants,
      human: white ? false : !!b.human,
      catalogue: white ? false : !!b.catalogue,
      mood: white ? 'Automatic' : b.mood
    };
  }
  /* A6, like pipeline 3, makes a white catalogue image first. Lifestyle: that image plus the scenes asked for. White BK: it is the first view. Website: always 4. */
  const plannedTotal = b => (isWebsite(b) ? 4 : (isWhite(b) ? effective(b).imageCount : effective(b).imageCount + 1));
  const lines = text => String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  function buildPayload(clientRunId) {
    const b = state.brief, e = effective(b);
    const department = nodeName(b.department), category = nodeName(b.category);
    return {
      job: b.outcome.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
      jobMode: 'new_project',
      workOn: 'one_by_one',
      scope: { outcome: b.outcome, outcomes: [b.outcome], view: e.view, aspect: e.aspect, resolution: e.resolution, imageCount: e.imageCount },
      item: { department, category, subCategory: subLabel(), referenceType: PRODUCT_ROLE },
      preferences: { lighting: e.lighting, wallPaint: e.wallPaint, floor: e.floor, useWorkflowDefaults: !!b.studioChoice },
      styling: { plants: e.plants, human: e.human, mood: e.mood, catalogue: e.catalogue },
      metadata: {
        product_category: category || department, color: b.color.trim(), material: b.material.trim(),
        scene: b.outcome, light: e.lighting, camera: e.view, hero: b.hero.trim(),
        locks: lines(b.locks), must_not: lines(b.mustNot),
        delivery: { image_size: '', aspect: e.aspect, resolution: e.resolution }
      },
      references: [{ name: state.file ? state.file.name : '', role: PRODUCT_ROLE }],
      approval: 'ask',           // A6 always stops for the studio team's go before paid images
      clientRunId
    };
  }

  /* ------------------------------------------------------------------ network
     Every call carries the studio key in a request header (STUDIO_CONFIG.keyHeader). The key lives
     in this variable only: it is never stored, never put in an address and never logged.
     A header of our own makes the browser ask the studio first (a preflight request); the studio server answers it. */
  let ownerKey = '';
  async function call(method, url, options) {
    const opts = Object.assign({}, options || {});
    const key = typeof opts.key === 'string' ? opts.key : ownerKey;   // the owner go passes its own key for one call
    delete opts.key;
    const init = Object.assign({ method, cache: 'no-store' }, opts);
    init.headers = Object.assign({}, init.headers, { [STUDIO_CONFIG.keyHeader]: key });
    let response;
    try { response = await fetch(url, init); }
    catch (error) { return { network: true }; }
    let data = null;
    try { data = await response.json(); } catch (error) { data = null; }   // a refusal from the studio server is plain text
    return { status: response.status, data };
  }
  const withQuery = (base, query) => { const url = new URL(base); Object.entries(query).forEach(([name, value]) => url.searchParams.set(name, value)); return url.href; };
  const live = {
    /* The studio has no sign-in address. One status check for a reference that does not exist proves
       the key: it costs one short workflow run and no paid call. */
    signIn: () => call('GET', withQuery(STUDIO_CONFIG.statusUrl, { id: 'key-check-' + newId() })),
    submit: (payload, file) => {
      const data = new FormData();
      data.append('payload', JSON.stringify(payload));
      data.append('files', file, file.name);
      return call('POST', STUDIO_CONFIG.submitUrl, { body: data });
    },
    status: id => call('GET', withQuery(STUDIO_CONFIG.statusUrl, { id })),
    /* The studio team's go or stop for a waiting request, sent with the OWNER key given for this call only. */
    decide: (id, decision, note, key) => call('POST', STUDIO_CONFIG.decisionUrl, { key, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(note ? { id, decision, note } : { id, decision }) }),
    /* Makes held images of a finished request again. The page sends the reference of the new request. */
    regenerate: (id, newRunId, shot) => call('POST', STUDIO_CONFIG.regenerateUrl, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, new_id: newRunId, shot }) }),
    file: async (id, shot) => {
      let response;
      try { response = await fetch(withQuery(STUDIO_CONFIG.fileUrl, { id, shot: String(shot) }), { cache: 'no-store', headers: { [STUDIO_CONFIG.keyHeader]: ownerKey } }); }
      catch (error) { return { network: true }; }
      const type = response.headers.get('content-type') || '';
      if (response.ok && type.indexOf('image/') === 0) {
        try { return { status: response.status, blob: await response.blob() }; } catch (error) { return { network: true }; }
      }
      let data = null;
      try { data = await response.json(); } catch (error) { data = null; }
      return { status: response.status, data };
    }
  };

  /* Mock replies, in the shapes A6 sends. Nothing leaves the browser. */
  const mockState = { signin: params.get('signin') || 'skip', submit: params.get('submit') || 'accepted', result: params.get('result') || 'passed', regen: params.get('regen') || 'accepted', decision: params.get('decision') || 'accepted', jobs: new Map(), checks: new Map(), gates: new Map() };
  const later = value => new Promise(resolve => window.setTimeout(() => resolve(value), 350));
  const mockRefused = () => ({ status: 403, data: null });
  const mockJob = id => mockState.jobs.get(id) || { outcome: 'Lifestyle', total: 2, view: '', file: 'product.jpg' };
  function mockRoles(job, website) {
    if (website) return ['catalogue', 'hero', 'wide', 'detail'];
    const roles = ['catalogue'];
    for (let i = 1; i < job.total; i += 1) roles.push(job.outcome === 'White BK' ? 'view' : 'lifestyle');
    return roles;
  }
  function mockResult(id) {
    const job = mockJob(id);
    let scenario = job.regenOf || mockState.result === 'waitgo' || mockState.result === 'waitgo2' ? 'passed' : mockState.result;
    const website = job.outcome === 'Website' || scenario === 'website_complete' || scenario === 'website_incomplete';
    if (website && scenario === 'passed') scenario = 'website_complete';
    if (website && scenario === 'partial') scenario = 'website_incomplete';
    const roles = mockRoles(job, website);
    const count = roles.length;
    const names = Object.keys(STRINGS.results.checkNames);
    const allHold = scenario === 'hold';
    const images = [];
    for (let i = 0; i < count; i += 1) {
      const held = allHold || ((scenario === 'partial' || scenario === 'website_incomplete') && i === count - 1 && count > 1) || (scenario === 'partial' && count === 1);
      const view = roles[i] === 'wide' ? 'wide' : roles[i] === 'detail' ? 'close' : (i === 0 ? '' : (job.view === 'both' ? ((i - 1) % 2 === 0 ? 'wide' : 'close') : job.view));
      images.push({
        shot: i + 1, status: held ? 'hold' : 'passed', regenerated: Array.isArray(job.regenShots) && job.regenShots.indexOf(i + 1) !== -1, view, role: roles[i], made_from_shot: i === 0 ? 0 : ((roles[i] === 'wide' || roles[i] === 'detail') ? 2 : 1), images_made: held ? 3 : 1,
        image_url: scenario === 'expired' && i === 0 ? 'data:image/webp;base64,AAAA' : mockPicture(),
        problem: held ? 'The reviewer counted four chair legs in the product photo and three in the image.' : '',
        checks: names.map((name, k) => [name, held && k === 0 ? 'fail' : (held && k === 6 ? 'partial' : 'pass'), held && k === 0 ? 'Leg count differs from the product photo.' : 'Matches the product photo.'])
      });
    }
    const passed = images.filter(image => image.status === 'passed').length;
    const status = passed === images.length ? 'reviewed_candidate' : (passed > 0 ? 'partial' : 'hold');
    const decision = { approved: 'accepted', changes: 'changes_requested', rejected: 'rejected' }[scenario] || '';
    return {
      found: true, state: 'finished', run_id: 'va6-mock', status,
      images_made: images.reduce((sum, image) => sum + image.images_made, 0),
      image_url: (images.find(image => image.status === 'passed') || {}).image_url || '', images,
      package: { website_package: website ? { required: roles, passed: images.filter(i => i.status === 'passed').map(i => i.role), missing: images.filter(i => i.status !== 'passed').map(i => i.role), complete: passed === 4 } : null, limitations: ['Mock data: these images are the page\'s hero picture, not studio results.'], catalogue: [] },
      owner_decision: decision, owner_note: decision ? 'Mock note from the studio.' : '', decided_at: decision ? new Date().toISOString() : '',
      summary: 'Mock run card for ' + job.file + '\n' + (status === 'hold' ? 'No image passed the automatic checks.' : 'Run finished.') + '\nThis text stands in for the first 1,500 characters of the studio run card.',
      product_file: job.file, finished_at: new Date().toISOString(), can_regenerate: status !== 'reviewed_candidate'
    };
  }
  function mockGate(id) {
    if (!mockState.gates.has(id)) mockState.gates.set(id, { goes: 0, stopped: false, since: 0, at: '', planAt: new Date().toISOString(), masterAt: '' });
    return mockState.gates.get(id);
  }
  function mockPlan(id, twoStops) {
    const job = mockJob(id);
    const shots = [{ shot: 1, role: 'catalogue', frame: '1:1', setting: 'Pure white seamless studio background and clean white floor, the product alone, with no props.', light: 'Soft, even studio light.', presentation: 'The complete product as arranged in the photo, every piece visible and countable.', supporting_props: [] }];
    for (let n = 2; n <= Math.max(2, job.total); n += 1) shots.push({ shot: n, role: 'lifestyle', frame: '16:9', setting: 'A calm living room with sand walls and a dark walnut floor.', light: 'Warm evening light from a window out of frame.', presentation: 'The pieces stand as in the photo, every piece visible.', supporting_props: ['a ceramic bowl', 'a closed book'] });
    return {
      run_id: 'va6-mock', product: 'Sofas / Sofa Sets', product_file: job.file, outcome: job.outcome,
      inventory: ['2 x sofa', '2 x armchair'], shots,
      stops: twoStops ? 'This go covers the white catalogue master. The run stops again and asks for a second go before the other image(s).' : '',
      contract: { unknowns: ['back side of each piece', 'exact dimensions'] }
    };
  }
  function mockMasterPlan() {
    return { run_id: 'va6-mock', waiting_for: 'a go for the other images, after the white catalogue master', master: { shot: 1, image_url: mockPicture(), images_made: 1 }, to_come: { image_renders: { at_least: 2, at_most: 6 } } };
  }
  const mock = {
    signIn: () => {
      const s = mockState.signin;
      if (s === 'network') return later({ network: true });
      if (s === 'denied') return later(mockRefused());
      return later({ status: 200, data: { found: false, state: 'not_finished' } });
    },
    submit: (payload, file) => {
      const s = mockState.submit;
      mockState.lastPayload = payload;                 // lets a tester read what would have been sent
      if (s === 'network') return later({ network: true });
      if (s === 'denied') return later(mockRefused());
      if (s === 'unpublished') return later({ status: 404, data: { code: 404, message: 'The requested webhook is not registered.' } });
      if (s === 'error') return later({ status: 500, data: null });
      const view = /wide/i.test(payload.scope.view) && /close/i.test(payload.scope.view) ? 'both' : /wide/i.test(payload.scope.view) ? 'wide' : /close/i.test(payload.scope.view) ? 'close' : '';
      mockState.jobs.set(payload.clientRunId, { outcome: payload.scope.outcome, total: plannedTotal(state.brief), view, file: file.name });
      mockState.checks.set(payload.clientRunId, 0);
      return later({ status: 200, data: { message: 'Workflow was started' } });
    },
    status: id => {
      const s = mockState.result;
      const seen = (mockState.checks.get(id) || 0) + 1;
      mockState.checks.set(id, seen);
      if (s === 'unreachable') return later({ network: true });
      if (s === 'signedout') return later(mockRefused());
      if (s === 'never' || seen < 2) return later({ status: 200, data: { found: false, state: 'not_finished' } });
      if (s === 'waitgo' || s === 'waitgo2') {                      // waits until a go or a stop is given in the page
        const gate = mockGate(id), need = s === 'waitgo2' ? 2 : 1;
        if (gate.stopped) return later({ status: 200, data: { found: true, state: 'stopped', run_id: 'va6-mock', plan: null, summary: '', answered_at: gate.at } });
        if (gate.goes > 0 && gate.since < 2) { gate.since += 1; return later({ status: 200, data: { found: true, state: 'started', run_id: 'va6-mock', plan: null, summary: '' } }); }
        if (gate.goes < need) {
          const master = gate.goes > 0;
          return later({ status: 200, data: {
            found: true, state: 'awaiting_go', run_id: 'va6-mock', product_file: mockJob(id).file,
            plan: master ? mockMasterPlan() : mockPlan(id, need === 2),
            summary: master ? 'The white master passed the automatic review. 2 other image(s) are made only after a second go.' : '3 image(s) planned, at most 6 with repairs. Nothing is rendered until a go is given.',
            asked_at: master ? gate.masterAt : gate.planAt, answered_at: '' } });
        }
      }
      return later({ status: 200, data: mockResult(id) });
    },
    decide: (id, decision, note, key) => {
      const s = mockState.decision;
      mockState.lastDecision = { id, decision, note, keySent: typeof key === 'string' && key.length > 0 };   // what would have been sent, without the key itself
      if (s === 'network') return later({ network: true });
      if (s === 'denied') return later(mockRefused());
      if (s === 'problem') return later({ status: 200, data: { saved: false, problem: 'No run is waiting for a go under this job id. It may already have been answered.' } });
      const gate = mockGate(id), at = new Date().toISOString();
      if (decision === 'stop') { gate.stopped = true; gate.at = at; }
      else { gate.goes += 1; gate.since = 0; gate.masterAt = new Date(Date.now() + 1).toISOString(); }
      return later({ status: 200, data: { saved: true, decision, decided_at: at } });
    },
    regenerate: (id, newRunId, shot) => {
      const s = mockState.regen;
      mockState.lastRegenerate = { id, new_id: newRunId, shot };   // lets a tester read what would have been sent
      if (s === 'network') return later({ network: true });
      if (s === 'denied') return later(mockRefused());
      if (s === 'error') return later({ status: 500, data: null });
      if (s === 'refused') return later({ status: 200, data: { ok: false, problem: 'This run was not kept for re-generation. Submit the request again instead.' } });
      mockState.jobs.set(newRunId, Object.assign({}, mockJob(id), { regenOf: id, regenShots: [shot] }));
      mockState.checks.set(newRunId, 0);
      return later({ status: 200, data: { ok: true, id: newRunId, shots: [shot] } });
    },
    file: () => new Promise(resolve => {
      const canvas = document.createElement('canvas');
      canvas.width = 1125; canvas.height = 1125;
      const context = canvas.getContext('2d');
      context.fillStyle = '#FFFFFF'; context.fillRect(0, 0, 1125, 1125);
      canvas.toBlob(blob => resolve(blob ? { status: 200, blob } : { status: 404, data: { ok: false, problem: 'The mock file could not be made.' } }), 'image/jpeg', 0.9);
    })
  };
  const api = MOCK ? mock : live;
  if (MOCK) window.MIDAS_STUDIO_MOCK = mockState;
  const pollCfg = () => (MOCK ? MOCK_POLL : STUDIO_CONFIG.poll);

  /* Turn any reply into one of: network failure, refusal (reason + message), or data.
     The studio server answers a wrong or missing key with HTTP 403 and plain text, and an unpublished workflow with HTTP 404. */
  function interpret(res) {
    if (!res || res.network) return { kind: 'network' };
    const data = res.data && typeof res.data === 'object' ? res.data : null;
    if (res.status === 401 || res.status === 403) return { kind: 'refused', reason: 'access_denied', message: t('signin.refused'), data: {} };
    if (res.status === 404 && !(data && data.problem)) return { kind: 'refused', reason: 'not_published', message: t('submit.notPublished'), data: {} };
    if (res.status >= 400 || !data) return { kind: 'refused', reason: 'studio_error', message: data && data.problem ? String(data.problem) : t('submit.serverError', { status: res.status }), data: data || {} };
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
    const node = el('label', { class: 'opt' + (more && more.swatch ? ' opt--swatch' : '') }, input,
      el('span', {}, more && more.swatch ? el('i', { 'aria-hidden': 'true' }) : null, label));
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
    const counts = [];
    for (let n = 1; n <= STUDIO_CONFIG.maxImages; n += 1) counts.push(opt('imageCount', String(n), String(n)));
    $('count-choices').replaceChildren(...counts);
    $('view-choices').replaceChildren(...OPT.view.map(v => opt('view', v, STRINGS.options.view[v])));
    $('aspect-choices').replaceChildren(...OPT.aspect.map(v => opt('aspect', v, STRINGS.options.aspectShort[v], { full: STRINGS.options.aspect[v] })));
    $('resolution-choices').replaceChildren(...OPT.resolution.map(v => opt('resolution', v, STRINGS.options.resolutionShort[v], { full: STRINGS.options.resolution[v] })));
    $('lighting-choices').replaceChildren(opt('lighting', '', t('labels.studioChoice')), ...OPT.lighting.map(v => opt('lighting', v, STRINGS.options.lighting[v])));
    $('wall-choices').replaceChildren(opt('wallPaint', '', t('labels.studioChoice')), ...OPT.wall.map(([v, hex]) => opt('wallPaint', v, STRINGS.options.wall[v], { swatch: hex })));
    $('floor-choices').replaceChildren(opt('floor', '', t('labels.studioChoice')), ...OPT.floor.map(v => opt('floor', v, STRINGS.options.floor[v])));
    $('mood-choices').replaceChildren(...OPT.mood.map(v => opt('mood', v, STRINGS.options.mood[v])));
    fillSelect($('department'), [['', t('labels.auto')], ...departments.map(node => [node.id, node.name])], '');
  }
  const radios = name => [...document.querySelectorAll('input[type="radio"][name="' + name + '"]')];
  const radio = (name, value) => { const input = radios(name).find(node => node.value === value); if (input) input.checked = true; };
  const checkedValue = name => { const input = radios(name).find(node => node.checked); return input ? input.value : ''; };
  const lock = (name, disabled) => radios(name).forEach(node => { node.disabled = disabled; });

  /* Put the brief into the form. */
  function syncForm() {
    const b = state.brief, e = effective(b), web = isWebsite(b), white = isWhite(b);
    radio('outcome', b.outcome);
    $('department').value = departments.some(node => node.id === b.department) ? b.department : '';
    b.department = $('department').value;
    fillCategories();
    radio('imageCount', String(e.imageCount)); radio('view', b.view); radio('aspect', e.aspect); radio('resolution', e.resolution);
    show($('card-count'), !web); show($('card-view'), !web); show($('website-note'), web);
    lock('aspect', web); lock('resolution', web);                                     // preset and locked for a Website package
    $('studio-choice').checked = b.studioChoice;
    radio('lighting', b.lighting); radio('wallPaint', b.wallPaint); radio('floor', b.floor);
    lock('lighting', b.studioChoice); lock('wallPaint', b.studioChoice); lock('floor', b.studioChoice);
    show($('card-wall'), !white); show($('card-floor'), !white); show($('white-note'), white);
    show($('touches-fields'), !white); show($('touches-white'), white);
    $('plants').checked = b.plants; $('human').checked = b.human; $('catalogue').checked = b.catalogue; radio('mood', b.mood);
    $('color').value = b.color; $('material').value = b.material; $('hero-item').value = b.hero; $('locks').value = b.locks; $('must-not').value = b.mustNot;
    document.querySelectorAll('.switch input').forEach(input => {
      input.closest('.switch').querySelector('strong').dataset.state = input.checked ? t('labels.on') : t('labels.off');
    });
    renderBrief();
  }
  /* Read the form back into the brief. */
  function readForm() {
    const b = state.brief, wasWeb = isWebsite(b);
    const department = $('department').value;
    if (department !== b.department) { b.department = department; b.category = ''; b.subCategory = ''; }
    else {
      const category = $('category').value;
      if (category !== b.category) { b.category = category; b.subCategory = ''; }
      else b.subCategory = $('sub-category').value;
    }
    b.outcome = checkedValue('outcome') || b.outcome;
    if (!wasWeb && !isWebsite(b)) {                      // while Website is chosen these show its fixed values, not the client's
      b.imageCount = Number(checkedValue('imageCount')) || b.imageCount;
      b.view = checkedValue('view') || b.view; b.aspect = checkedValue('aspect') || b.aspect; b.resolution = checkedValue('resolution') || b.resolution;
    }
    const choose = $('studio-choice').checked;
    if (choose && !b.studioChoice) { b.lighting = ''; b.wallPaint = ''; b.floor = ''; }
    else if (!choose) {
      b.lighting = checkedValue('lighting');
      if (!isWhite(b)) { b.wallPaint = checkedValue('wallPaint'); b.floor = checkedValue('floor'); }
    }
    b.studioChoice = choose;
    b.plants = $('plants').checked; b.human = $('human').checked; b.catalogue = $('catalogue').checked; b.mood = checkedValue('mood') || b.mood;
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
    for (const [key, list] of [['view', OPT.view], ['aspect', OPT.aspect], ['resolution', OPT.resolution], ['mood', OPT.mood]]) if (!list.includes(base[key])) base[key] = list[0];
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
    set('val-count', String(e.imageCount));
    set('val-view', STRINGS.options.view[e.view]);
    set('val-aspect', web ? t('ws.setForWebsite', { v: STRINGS.options.aspect[e.aspect] }) : STRINGS.options.aspect[e.aspect]);
    set('val-resolution', web ? t('ws.setForWebsite', { v: STRINGS.options.resolution[e.resolution] }) : STRINGS.options.resolution[e.resolution]);
    set('val-atmosphere', b.studioChoice ? t('labels.studioChoice') : '');
    set('val-lighting', pick(STRINGS.options.lighting[e.lighting]));
    set('val-wall', pick(STRINGS.options.wall[e.wallPaint]));
    set('val-floor', pick(STRINGS.options.floor[e.floor]));
    const touches = [e.plants && t('sug.plants'), e.human && t('sug.human'), e.catalogue && t('sug.catalogue'), e.mood !== 'Automatic' && STRINGS.options.mood[e.mood]].filter(Boolean);
    set('val-touches', white ? t('ws.notOnWhite') : (touches.join(' · ') || t('labels.none')));
    const kept = [b.color, b.material, b.hero].filter(text => text.trim()).length + lines(b.locks).length + lines(b.mustNot).length;
    set('val-faithful', kept ? t('ws.detailsCount', { n: kept }) : t('ws.optional'));

    const busy = inProduction();                             // one request at a time: no second paid request by accident
    $('submit-btn').disabled = busy || state.sending;
    const total = plannedTotal(b);
    set('brief-hint', busy ? t('ws.hintBusy') : !state.file ? t('ws.hintNoPhoto')
      : web ? t('scope.expectWebsite')
        : white ? (e.imageCount === 1 ? t('scope.expectWhiteOne') : t('scope.expectWhiteMany', { n: e.imageCount }))
          : e.imageCount === 1 ? t('scope.expectOne')
            : (b.view === 'Wide view + close-up' ? t('scope.expectAlt', { n: e.imageCount, t: total }) : t('scope.expectMany', { n: e.imageCount, t: total })));
    set('submit-count', imagesText(total));
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
  function saveSession() { /* nothing to store: the session and the key live in memory only */ }
  const inStudio = () => document.body.classList.contains('is-studio');
  function signOut(message) {
    stopWatching();
    ownerKey = '';                                    // forget the key
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
    const key = input.value.trim();
    if (!key) { signinError(t('signin.empty')); focusNode(input); return; }
    if (/[^\x20-\x7E]/.test(key)) { signinError(t('signin.badChars')); focusNode(input); return; }   // a header value must be plain ASCII
    if (button.disabled) return;
    signinError(''); show($('signin-notice'), false);
    button.disabled = true; button.classList.add('is-busy'); button.textContent = t('signin.busy');
    ownerKey = key;                                   // memory only: gone on reload, on sign-out and when the tab closes
    const out = interpret(await api.signIn());
    button.disabled = false; button.classList.remove('is-busy'); button.textContent = t('signin.submit');
    if (out.kind !== 'ok') {
      ownerKey = '';
      signinError(out.kind === 'network' ? t('signin.network') : out.message);
      focusNode(input);
      return;
    }
    input.value = ''; input.type = 'password'; $('show-code').checked = false;
    state.session = { clientName: t('auth.ownerName'), role: 'owner', limit: 0, used: 0 };
    renderSession();
    enterStudio(true);
    announce(t('signin.welcome'));
  }
  /* After sign-in or reload: resume a request in production, else show the brief. */
  function enterStudio(focus) {
    const pending = read(LS, KEY.pending);
    if (pending && pending.id && state.session && pending.clientName === state.session.clientName) {
      state.run = pending;
      setStage('progress');
      startWatching(pending.waiting === true);         // waiting for a go: check at once, so the go panel shows without delay
      if (focus) focusNode($('progress-title'));
    } else {
      setStage(state.result ? 'results' : 'empty');
      if (focus) focusNode($('brief-title'));
    }
  }
  /* The result panel shows one of three things: the empty stage, progress, the results. */
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
    const res = await api.submit(payload, state.file);
    state.sending = false; button.disabled = false; button.classList.remove('is-busy'); label.textContent = t('ws.submit');

    if (res && !res.network && res.status >= 200 && res.status < 300) {     // A6 answers at once, before it reads the photo
      const run = { id, acceptedAt: Date.now(), lastCheckAt: 0, imagesAsked: plannedTotal(state.brief), fileName: state.file.name, outcome: payload.scope.outcome, aspect: payload.scope.aspect, clientName: state.session.clientName };
      state.run = run; state.result = null; state.fileRunId = id; state.runId = '';
      drop(LS, KEY.unsent); write(LS, KEY.pending, run);
      addRecent(run);
      setStage('progress');
      startWatching(false);
      focusNode($('progress-title'));
      announce(t('progress.announceRunning'));
      updateHero();
      return;
    }
    const out = interpret(res);
    if (out.kind === 'network') { submitMessage(t('submit.network'), true); return; }
    if (out.reason === 'access_denied') { signOut(out.message); return; }                        // the draft stays saved
    submitMessage(out.message || t('submit.refused'), true);
  }

  /* ------------------------------------------------------------------ progress and polling
     A6 reads the photo and plans, then waits for the studio team's go before it pays for images,
     and waits again after the white catalogue image. The page keeps checking through both waits,
     more slowly while waiting, and shows the finished result.
     First check after firstMs, then every everyMs. Each check costs the studio one workflow run,
     so the page never checks faster. */
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
    const waiting = run.waiting === true;
    $('progress-title').textContent = waiting ? t('progress.titleWaiting') : t('progress.titleRunning');
    setTag(waiting ? t('ws.tagWaiting') : t('ws.tagProduction'), true);
    bind('reference', run.id);
    $('tl-received-time').textContent = t('progress.receivedAt', { time: dateTimeText(run.acceptedAt) });
    $('tl-production-label').textContent = waiting ? t('progress.waiting') : t('progress.production');
    $('tl-production-note').textContent = waiting ? t('progress.waitingNote') : t('progress.productionNote');
    setTimeline('is-done', 'is-now', 'is-waiting');
    show($('progress-message'), false);
    if (!waiting) clearOwnerGo();
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
    const every = run.waiting === true ? cfg.waitEveryMs : cfg.everyMs;              // slower while waiting for a go
    const due = run.lastCheckAt ? run.lastCheckAt + every : run.acceptedAt + cfg.firstMs;
    watch.timer = window.setTimeout(check, immediate ? 0 : Math.max(0, due - Date.now()));
  }
  async function check() {
    if (watch.stopped || watch.busy || !state.run || document.hidden) return;
    const token = watch.token, run = state.run, cfg = pollCfg();
    watch.busy = true; run.lastCheckAt = Date.now(); savePending();
    const out = interpret(await api.status(run.id));
    watch.busy = false;
    if (token !== watch.token) return;                                   // the owner moved on while we waited
    if (out.kind === 'refused' && out.reason === 'access_denied') { signOut(out.message); return; }
    if (out.kind !== 'ok') {                                             // unreachable, unreadable, or a studio error
      watch.failures += 1;
      if (watch.failures >= cfg.maxFailures) { progressProblem(out.kind === 'refused' ? out.message : t('progress.unreachable'), t('progress.titleStopped'), true, t('ws.tagUnconfirmed')); return; }
      scheduleCheck(false);
      return;
    }
    watch.failures = 0;
    const data = out.data;
    if (data.found === true && data.state === 'finished') { finishRun(data); return; }
    if (data.found === true && data.state === 'stopped') { showEnded('stopped', t('progress.stoppedByOwner'), t('progress.titleStoppedByOwner'), t('ws.tagStopped')); return; }
    if (data.found === true && data.state === 'awaiting_go') {          // A6 waits for the studio team's go: keep checking
      const first = run.waiting !== true;
      run.waiting = true; run.activeSince = Date.now(); savePending();
      updateRecent(run.id, 'awaiting_go');
      if (first) { renderProgress(); announce(t('progress.announceWaiting')); }
      updateOwnerGo(data);
      scheduleCheck(false);
      return;
    }
    clearOwnerGo();
    if (run.waiting === true) { run.waiting = false; run.activeSince = Date.now(); savePending(); updateRecent(run.id, 'sent'); renderProgress(); }
    const limit = run.imagesAsked > 1 ? cfg.limitManyMs : cfg.limitOneMs;
    if (Date.now() - (run.activeSince || run.acceptedAt) > limit) { progressProblem(t('progress.timeout'), t('progress.titleStopped'), true, t('ws.tagUnconfirmed')); return; }   // waiting time does not count
    scheduleCheck(false);
  }
  function finishRun(data) {
    stopWatching();
    clearOwnerGo();
    state.result = data;
    updateRecent(state.run.id, data.owner_decision || data.status || 'hold');
    drop(LS, KEY.pending); updateHero();
    renderResults();
    setStage('results');
    focusNode($('results-title'));
    announce(t('progress.announceReady'));
  }
  /* A request that will make nothing more: stopped before any image. */
  function showEnded(status, text, title, tag) {
    const run = state.run;
    stopWatching();
    clearOwnerGo();
    if (run) { updateRecent(run.id, status); bind('reference', run.id); }
    drop(LS, KEY.pending); updateHero();
    setStage('progress');
    if (run) renderProgress();
    progressProblem(text, title, false, tag);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) window.clearTimeout(watch.timer);
    else if (!watch.stopped) scheduleCheck(false);
  });

  /* ------------------------------------------------------------------ owner go (studio team only)
     While a request waits, the studio team answers it here. The panel shows what the go pays for:
     the plan at the first stop, the white catalogue image at the second. It needs the OWNER key,
     which is read from its field for one call; the field is cleared after every attempt. */
  const gate = { shown: '', sending: false, armed: false, armTimer: 0 };
  const listText = value => (Array.isArray(value) ? value.map(String).filter(Boolean).join('; ') : '');
  function gateKey(data) {
    const plan = data && data.plan && typeof data.plan === 'object' ? data.plan : null;
    return [plan && plan.waiting_for ? 'master' : 'plan', data.run_id || '', data.asked_at || ''].join('|');
  }
  function disarmStop() {
    gate.armed = false; window.clearTimeout(gate.armTimer);
    $('owner-stop-btn').textContent = t('ownerGo.stop');
  }
  function ownerMessage(text, isError) {
    const box = $('owner-go-message');
    box.textContent = text;
    box.classList.toggle('notice--error', !!isError);
    show(box, !!text);
    if (text) announce(text);
  }
  function clearOwnerGo() {
    gate.shown = '';
    disarmStop();
    $('owner-key').value = '';
    show($('owner-go'), false);
  }
  function planRow(label, value) {
    return value ? el('div', { class: 'ownergo__row' }, el('dt', { text: label }), el('dd', { text: value })) : null;
  }
  function renderPlan(data) {
    const plan = data.plan && typeof data.plan === 'object' ? data.plan : null;
    const nodes = [];
    if (plan && plan.waiting_for) {
      const master = plan.master && typeof plan.master === 'object' ? plan.master : {};
      const src = safeImageUrl(master.image_url);
      const next = plan.to_come && plan.to_come.image_renders ? Number(plan.to_come.image_renders.at_least) : 0;
      nodes.push(el('h4', { class: 'ownergo__title', text: t('ownerGo.masterTitle') }));
      nodes.push(src
        ? el('figure', { class: 'shot__fig ownergo__fig' }, el('img', { src, alt: t('ownerGo.imageAlt'), loading: 'lazy', referrerpolicy: 'no-referrer' }), el('span', { class: 'tag', text: t('ownerGo.generated') }))
        : el('p', { class: 'hint', text: t('ownerGo.masterMissing') }));
      nodes.push(el('p', { text: t('ownerGo.masterLead') }));
      if (next > 0) nodes.push(el('p', { text: t('ownerGo.masterNext', { n: next }) }));
      return nodes;
    }
    nodes.push(el('h4', { class: 'ownergo__title', text: t('ownerGo.firstTitle') }));
    if (data.summary) nodes.push(el('p', { text: String(data.summary) }));
    if (!plan) { nodes.push(el('p', { class: 'hint', text: t('ownerGo.noPlan') })); return nodes; }
    const unknowns = plan.contract && typeof plan.contract === 'object' ? plan.contract.unknowns : null;
    nodes.push(el('dl', { class: 'ownergo__facts' },
      planRow(t('ownerGo.product'), plan.product ? String(plan.product) : ''),
      planRow(t('ownerGo.inventory'), listText(plan.inventory)),
      planRow(t('ownerGo.unknowns'), listText(unknowns)),
      planRow(t('ownerGo.file'), plan.product_file ? String(plan.product_file) : '')));
    const shots = Array.isArray(plan.shots) ? plan.shots : [];
    if (shots.length) {
      nodes.push(el('ol', { class: 'ownergo__shots', role: 'list' }, ...shots.map((shot, i) => {
        const s = shot && typeof shot === 'object' ? shot : {};
        const frame = STRINGS.ownerGo.frames[s.frame] || String(s.frame || '');
        return el('li', { class: 'ownergo__shot' },
          el('strong', { text: t('ownerGo.shotTitle', { n: s.shot || i + 1, role: STRINGS.ownerGo.roles[s.role] || String(s.role || ''), frame }) }),
          el('dl', {},
            planRow(t('ownerGo.setting'), s.setting ? String(s.setting) : ''),
            planRow(t('ownerGo.light'), s.light ? String(s.light) : ''),
            planRow(t('ownerGo.presentation'), s.presentation ? String(s.presentation) : ''),
            planRow(t('ownerGo.props'), listText(s.supporting_props))));
      })));
    }
    if (plan.stops) nodes.push(el('p', { class: 'ownergo__stops', text: String(plan.stops) }));
    return nodes;
  }
  function updateOwnerGo(data) {
    const key = gateKey(data);
    if (key === gate.shown) return;                      // the same stop as before: keep what the owner is reading or typing
    gate.shown = key;
    disarmStop();
    $('owner-go-plan').replaceChildren(...renderPlan(data));
    show($('owner-go-form'), true);
    ownerMessage('', false);
    show($('owner-go'), true);
  }
  function setOwnerBusy(busy) {
    gate.sending = busy;
    ['owner-go-btn', 'owner-stop-btn'].forEach(id => { $(id).disabled = busy; $(id).classList.toggle('is-busy', busy); });
    $('owner-go-btn').textContent = busy ? t('ownerGo.busy') : t('ownerGo.go');
    if (!busy) disarmStop();
  }
  async function sendDecision(decision) {
    const run = state.run;
    if (!run || gate.sending) return;
    const input = $('owner-key');
    const key = input.value.trim();
    if (!key) { ownerMessage(t('ownerGo.needKey'), true); focusNode(input); return; }
    if (/[^\x20-\x7E]/.test(key)) { ownerMessage(t('signin.badChars'), true); focusNode(input); return; }
    if (decision === 'stop' && !gate.armed) {            // a stop ends the request: ask for a second press
      gate.armed = true;
      $('owner-stop-btn').textContent = t('ownerGo.confirmStop');
      ownerMessage(t('ownerGo.armedStop'), false);
      window.clearTimeout(gate.armTimer);
      gate.armTimer = window.setTimeout(() => { disarmStop(); ownerMessage('', false); }, 8000);
      return;
    }
    setOwnerBusy(true);
    ownerMessage('', false);
    const note = $('owner-note').value.trim().slice(0, 500);
    const res = await api.decide(run.id, decision, note, key);
    input.value = '';                                    // the owner key is used for this one call only
    setOwnerBusy(false);
    if (!res || res.network) { ownerMessage(t('ownerGo.network'), true); return; }
    if (res.status === 401 || res.status === 403) { ownerMessage(t('ownerGo.refused'), true); focusNode(input); return; }
    const data = res.data && typeof res.data === 'object' ? res.data : null;
    if (data && data.saved === true) {
      $('owner-note').value = '';
      show($('owner-go-form'), false);
      ownerMessage(t(decision === 'stop' ? 'ownerGo.sentStop' : 'ownerGo.sentGo', { time: timeText(Date.parse(data.decided_at) || Date.now()) }), false);
      if (state.run === run && !watch.stopped) scheduleCheck(true);   // read the new state at once
      return;
    }
    ownerMessage(data && data.problem ? t('ownerGo.problem', { problem: String(data.problem) }) : t('ownerGo.unknown'), true);
  }

  /* ------------------------------------------------------------------ results */
  function viewWord(image) {
    const key = STRINGS.results.views[image.role] ? image.role : image.view;
    return STRINGS.results.views[key] || '';
  }
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
    const card = el('article', { class: 'shot' },
      el('div', { class: 'shot__head' },
        el('h4', { class: 'shot__title', text: view ? t('results.imageTitleView', { n, view }) : t('results.imageTitle', { n }) }),
        el('span', { class: 'shot__pills' },
          image.regenerated === true ? el('span', { class: 'pill pill--plain', text: t('results.madeAgain') }) : null,
          el('span', { class: 'pill' + (ok ? '' : ' pill--hold'), text: ok ? t('results.passed') : t('results.onHold') }))));
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
    if (ok) {                                            // the 1125 x 1125 delivery file, made by the studio on request
      const note = el('p', { class: 'hint shot__filenote', role: 'status' });
      const button = el('button', { type: 'button', class: 'btn btn--ghost btn--sm shot__file', text: t('results.file') });
      button.addEventListener('click', () => downloadFile(run, n, button, note));
      card.append(button, note);
    }
    if (!ok && STUDIO_CONFIG.regenerateUrl && state.result && state.result.can_regenerate === true) {   // offered only when the studio has a re-generate address and kept what it needs
      const hintId = 'regen-hint-' + n;
      const note = el('p', { class: 'hint shot__filenote', role: 'status' });
      const button = el('button', { type: 'button', class: 'btn btn--primary btn--sm shot__regen', text: t('results.regen'), 'aria-label': t('results.regenLabel', { n }), 'aria-describedby': hintId });
      button.addEventListener('click', () => regenerate(run, n, button, note));
      card.append(el('div', { class: 'shot__again' }, button, el('p', { class: 'hint', id: hintId, text: t('results.regenHint') }), note));
    }
    const checks = checkList(image.checks);
    if (checks) card.append(checks);
    return card;
  }
  /* Re-generate: the studio makes a held image again from what it kept of the finished request.
     It is a new request with its own reference, so the earlier result stays in the recent list. */
  async function regenerate(run, shot, button, note) {
    if (state.regenerating || state.sending || !state.session || inProduction()) return;
    const id = newId();
    const buttons = [...document.querySelectorAll('.shot__regen')];
    state.regenerating = true; buttons.forEach(b => { b.disabled = true; }); button.classList.add('is-busy');
    note.textContent = t('results.regenBusy');
    const res = await api.regenerate(run.id, id, shot);
    state.regenerating = false; button.classList.remove('is-busy');
    const out = interpret(res);
    if (out.kind === 'refused' && out.reason === 'access_denied') { signOut(out.message); return; }
    const moved = state.run !== run || state.stage !== 'results';        // the owner moved on while we waited
    if (out.kind === 'ok' && out.data.ok === true) {
      const next = { id, acceptedAt: Date.now(), lastCheckAt: 0, imagesAsked: run.imagesAsked, fileName: run.fileName, outcome: run.outcome, aspect: run.aspect, clientName: run.clientName, regenOf: run.id };
      addRecent(next);                                                   // a started re-generation is always listed, so it can be found again
      if (moved) return;
      if (state.fileRunId === run.id) state.fileRunId = id;             // the photo in this tab is still the original of the new request
      state.run = next; state.result = null;
      write(LS, KEY.pending, next);
      setStage('progress');
      startWatching(false);
      focusNode($('progress-title'));
      announce(t('progress.announceRegen'));
      updateHero();
      return;
    }
    if (moved) return;
    buttons.forEach(b => { b.disabled = false; });
    const text = out.kind === 'network' ? t('results.regenNetwork')
      : out.kind === 'refused' ? out.message
        : (out.data.problem ? String(out.data.problem) : t('results.regenFailed'));
    note.textContent = t('labels.error') + ' ' + text;
    announce(text);
  }
  /* The file address needs the key header, so a plain link cannot be used: the page fetches the file and hands it to the browser. */
  async function downloadFile(run, shot, button, note) {
    if (button.disabled) return;
    button.disabled = true; note.textContent = t('results.fileBusy');
    const res = await api.file(run.id, shot);
    button.disabled = false;
    if (res && res.blob) {
      const href = URL.createObjectURL(res.blob);
      const base = String(run.fileName || '').replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 60) || 'product';
      const link = el('a', { href, download: 'midas-' + base + '-image-' + shot + '-1125.jpg' });
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 60000);
      note.textContent = t('results.fileDone');
      return;
    }
    const out = interpret(res);
    if (out.kind === 'refused' && out.reason === 'access_denied') { signOut(out.message); return; }
    note.textContent = t('labels.error') + ' ' + (out.kind === 'network' ? t('results.fileNetwork') : (out.kind === 'refused' ? out.message : t('results.fileFailed')));
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
    const total = images.length, passed = images.filter(image => image.status === 'passed').length;
    const status = result.status || (total && passed === total ? 'reviewed_candidate' : passed ? 'partial' : 'hold');
    let title, lead;
    if (status === 'reviewed_candidate') { title = t('results.titleReady'); lead = total === 1 ? t('results.allOne') : t('results.allMany', { n: total }); }
    else if (status === 'partial') { title = t('results.titlePartial'); lead = t('results.partial', { x: passed, n: total }); }
    else {
      title = t('results.titleHold');
      const reason = secondLine || String((images.find(image => image.problem) || {}).problem || '');
      lead = reason ? t('results.hold', { reason }) : t('results.holdNoReason');
    }
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
    list.unshift({ id: run.id, time: run.acceptedAt, clientName: run.clientName, fileName: run.fileName, outcome: run.outcome, imageCount: run.imagesAsked, aspect: run.aspect, regenOf: run.regenOf || '', status: 'sent' });
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
      const outcome = ((STRINGS.scope.options[item.outcome] || {}).title || String(item.outcome || '')) + (item.regenOf ? ', ' + t('recent.regen') : '');
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
    state.run = { id: item.id, acceptedAt: Number(item.time) || Date.now(), lastCheckAt: 0, imagesAsked: Number(item.imageCount) || 1, fileName: item.fileName, outcome: item.outcome, aspect: item.aspect, clientName: item.clientName, regenOf: item.regenOf || '' };
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
    if (!STUDIO_CONFIG.regenerateUrl) show($('mock-regen').closest('label'), false);   // nothing to simulate: Re-generate is not offered
    [['mock-signin', 'signin', STRINGS.mock.signinOptions], ['mock-submit', 'submit', STRINGS.mock.submitOptions], ['mock-result', 'result', STRINGS.mock.resultOptions], ['mock-regen', 'regen', STRINGS.mock.regenOptions], ['mock-decision', 'decision', STRINGS.mock.decisionOptions]].forEach(([id, key, options]) => {
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
    $('owner-go-btn').addEventListener('click', () => sendDecision('go'));
    $('owner-stop-btn').addEventListener('click', () => sendDecision('stop'));
    $('owner-key').addEventListener('keydown', event => { if (event.key === 'Enter') event.preventDefault(); });   // Enter must never send a paid go
    window.addEventListener('hashchange', () => { closeMenu(); state.hash = window.location.hash; route(true); });

    // The key is never stored, so there is no session to restore. Clear what the earlier access-code page kept in this tab.
    drop(SS, KEY.code); drop(SS, KEY.session);
    // Mock mode only: "Skipped (preview)" opens the studio without the sign-in, to look at the inner screens.
    if (MOCK && mockState.signin === 'skip') {
      ownerKey = 'mock-preview';
      state.session = { clientName: t('auth.ownerName'), role: 'owner', limit: 0, used: 0 };
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
