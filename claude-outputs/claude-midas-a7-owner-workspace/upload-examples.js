// Contextual upload guides: real photos from earlier Studio work (the Previous work archive) with
// "helpful / avoid" notes, opened beside the matching upload field. Nothing is uploaded or analyzed,
// and archive photos are never presented as results for the current request.
(() => {
  const $ = id => document.getElementById(id);
  const dialog = $('exampleGuideDialog');
  if (!dialog) return;
  const base = location.pathname.startsWith('/owner/') ? '/owner/previous-work/img/' : 'previous-work/img/';
  const photo = key => `${base}${key}-f.webp`;
  const KIND = { helpful: 'Helpful input', avoid: 'Avoid', result: 'Archive result' };
  const guides = {
    product: {
      title: 'Primary product photo',
      intro: 'Use a clear source photo to establish the product or complete set. This original remains the identity reference.',
      photos: [
        { key: 'n228', kind: 'helpful', caption: 'Complete set in one frame on a plain ground, every piece and edge visible.' },
        { key: 'seven-p2-sourcefile-preview', kind: 'avoid', caption: 'Pieces cropped at the frame edge and a marked-out table mixed into the photo.' }
      ],
      helpful: ['Show the full item or coherent set in one frame.', 'Keep the outline, finish, hardware and legs visible.', 'Use a sharp, evenly lit image with little perspective distortion.'],
      avoid: ['Cropping off a required piece or important edge.', 'Using a room scene as the only product identity photo.', 'Combining separate products into one unclear collage.']
    },
    side: {
      title: 'Side and detail views',
      intro: 'Add optional views of the same product to reveal details that the main photo does not show. They do not add to the physical piece count.',
      photos: [
        { key: 'seven-st-sourcefile-preview', kind: 'helpful', caption: 'An angled view shows the full top pattern.' },
        { key: 'seven-st-whitefile-preview', kind: 'helpful', caption: 'A level view of the same table shows the leg geometry.' }
      ],
      helpful: ['Keep each view tied to the same product or set.', 'Label left and right as you face the product front.', 'Use close-ups for source-visible details such as seams or hardware.'],
      avoid: ['Treating another angle or a swatch inset as another piece.', 'Mirroring the product or relabeling sides from memory.', 'Adding unrelated products to the source views.']
    },
    room: {
      title: 'Room reference',
      intro: 'Use this when you want the product placed in a particular room. The photo guides the room and its fixed features.',
      photos: [
        { key: 'i118', kind: 'helpful', caption: 'Room photo with windows, door, walls and enough floor to judge placement.' },
        { key: 'i117', kind: 'result', caption: 'The same room after placement, from the archive. Architecture and camera were kept.' }
      ],
      helpful: ['Show the room from the angle and area you want to preserve.', 'Include windows, doors, built-ins and enough floor to understand placement.', 'Use one image with straight walls and readable room boundaries.'],
      avoid: ['A tight detail that hides the room layout.', 'A room image that is actually intended only as a style mood.', 'Assuming dimensions or fit from a photo alone.']
    },
    inspiration: {
      title: 'Inspiration reference',
      intro: 'Use this to show a mood, palette, lighting character or material direction. It guides styling; it does not establish product facts.',
      photos: [
        { key: 'l-twilight', kind: 'helpful', caption: 'Lighting mood: cool twilight outside, warm pools of light inside.' },
        { key: 'e205', kind: 'helpful', caption: 'Colour and architecture: a saturated warm palette around an arched window.' }
      ],
      helpful: ['Choose a reference with the mood or colours you want.', 'Point to the part that inspires you: palette, lighting or material feel.', 'Keep it separate from the product image and the room to preserve.'],
      avoid: ['Expecting exact colour matching from a screen image.', 'Using a look reference to change the product design.', 'Mixing several conflicting moods without saying which matters most.']
    },
    styling: {
      title: 'Styling and Midas supporting pieces',
      intro: 'Show the product’s intended role and the kind of supporting Midas pieces that suit it. The product itself stays the visual and identity anchor.',
      photos: [
        { key: 'accessory-a2-s1-result-preview', kind: 'result', caption: 'Accessory as the hero: supporting pieces stay quiet and out of its way.' },
        { key: 'lifestyle-c5-l1-result-preview', kind: 'result', caption: 'Sofa as the hero with one supporting centre table and clear space around it.' }
      ],
      helpful: ['Name the product’s role: hero or supporting piece.', 'Choose a few related pieces by shape, finish and scale.', 'Describe placement and preserve clear space around important details.'],
      avoid: ['Letting accessories obscure the product.', 'Treating pasted links or SKUs as imported or availability-checked.', 'Adding saleable pieces that were not selected or source-backed.']
    }
  };
  const LIMIT = 'Photos come from earlier Studio work in Previous work. They show the kind of input or direction that helps; they are not results for this request and do not approve any product.';
  let lastTrigger = null;
  const make = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
  const fillList = (list, items) => list.replaceChildren(...items.map(text => make('li', '', text)));
  function renderPhotos(guide) {
    const box = $('exampleGuideArtwork');
    box.className = 'example-guide-artwork example-guide-photos' + (guide.photos.length === 1 ? ' is-single' : '');
    box.replaceChildren(...guide.photos.map(item => {
      const figure = make('figure', 'guide-photo is-' + item.kind), image = document.createElement('img');
      image.src = photo(item.key); image.alt = item.caption; image.loading = 'lazy'; image.decoding = 'async';
      const caption = make('figcaption');
      caption.append(make('span', 'guide-photo-kind', KIND[item.kind]), make('span', '', item.caption));
      figure.append(image, caption); return figure;
    }));
  }
  for (const trigger of document.querySelectorAll('[data-example-guide]')) {
    trigger.addEventListener('click', () => {
      const guide = guides[trigger.dataset.exampleGuide];
      if (!guide) return;
      lastTrigger = trigger;
      $('exampleGuideTitle').textContent = guide.title;
      $('exampleGuideIntro').textContent = guide.intro;
      renderPhotos(guide);
      fillList($('exampleGuideHelpful'), guide.helpful);
      fillList($('exampleGuideAvoid'), guide.avoid);
      $('exampleGuideLimit').textContent = LIMIT;
      dialog.showModal();
    });
  }
  $('closeExampleGuide').addEventListener('click', () => dialog.close());
  $('exampleGuideArchive')?.addEventListener('click', () => {
    lastTrigger = null; dialog.close();
    document.querySelector('.views-drawer[open]')?.close();
    const section = $('previousWorkSection'); section?.scrollIntoView({ block: 'start' }); section?.querySelector('h2')?.focus({ preventScroll: true });
  });
  dialog.addEventListener('close', () => lastTrigger?.focus());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
})();
