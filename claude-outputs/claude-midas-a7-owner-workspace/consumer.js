(() => {
  const $ = id => document.getElementById(id);
  const steps = ['product', 'room', 'review'];
  const state = { step: 'product', objectUrl: null };
  function show(step) {
    state.step = step;
    for (const name of steps) $(name + 'Step').hidden = name !== step;
    document.querySelectorAll('[data-step-label]').forEach((item, index) => {
      if (index === steps.indexOf(step)) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    $(step + 'Title').focus();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function message(text) { $('pageStatus').textContent = text; }
  function product() {
    const value = $('productRef').value.trim();
    if (!value) { message('Enter a Midas product link or SKU to continue.'); $('productRef').focus(); return false; }
    if (/^https?:/i.test(value)) {
      let url;
      try { url = new URL(value); } catch { url = null; }
      if (!url || !['midasfurniture.com','www.midasfurniture.com'].includes(url.hostname) || url.protocol !== 'https:') {
        message('Use a Midas catalogue HTTPS link or enter the SKU instead.'); $('productRef').focus(); return false;
      }
    }
    return true;
  }
  $('toRoom').addEventListener('click', () => { if (product()) { message(''); show('room'); } });
  $('backProduct').addEventListener('click', () => { message(''); show('product'); });
  $('roomFile').addEventListener('change', () => {
    const file = $('roomFile').files?.[0];
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
    $('roomPreview').hidden = true;
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      $('roomFile').value = '';
      message('Choose a JPEG, PNG or WebP room photo up to 10 MB.');
      return;
    }
    state.objectUrl = URL.createObjectURL(file);
    $('roomImage').src = state.objectUrl;
    $('roomCaption').textContent = file.name;
    $('roomPreview').hidden = false;
    message('Room photo selected locally. It has not been uploaded.');
  });
  $('toReview').addEventListener('click', () => {
    const file = $('roomFile').files?.[0];
    if (!file || !state.objectUrl) { message('Choose a room photo to continue.'); $('roomFile').focus(); return; }
    $('reviewProduct').textContent = $('productRef').value.trim();
    $('reviewRoom').textContent = file.name + ' · local only';
    $('reviewPlacement').textContent = $('placement').value.trim() || 'Not specified';
    $('reviewLocks').textContent = $('roomLocks').value.trim() || 'Photographed architecture and contents';
    $('reviewBoundary').textContent = document.querySelector('input[name="boundary"]:checked').value === 'expand' ? 'Proposed expansion; interpretation only' : 'Locked photographed room and camera';
    message(''); show('review');
  });
  $('backRoom').addEventListener('click', () => { message(''); show('room'); });
  window.addEventListener('pagehide', () => { if (state.objectUrl) URL.revokeObjectURL(state.objectUrl); });
  for (const name of steps) $(name + 'Title').tabIndex = -1;
  show('product');
})();
