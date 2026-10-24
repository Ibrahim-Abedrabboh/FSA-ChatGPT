// FileReader creates data: URLs, which the owner's image CSP already permits.
// Decode before accepting a source so a mislabeled or corrupt file is reported clearly.
window.a7PreviewImage = {
  read(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('image_read_failed'));
      reader.onabort = () => reject(new Error('image_read_aborted'));
      reader.onload = () => {
        if (typeof reader.result !== 'string' || !reader.result.startsWith('data:image/')) {
          reject(new Error('image_read_failed')); return;
        }
        const image = new Image();
        image.onload = () => resolve(reader.result);
        image.onerror = () => reject(new Error('image_decode_failed'));
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  },
  // The owner backend stores JPEG, PNG or WebP up to 3 MB. A photo that already fits is kept byte for byte.
  // A larger photo, or one the browser can open in another format (HEIC in Safari, AVIF), is redrawn in this
  // browser: WebP first when it may be transparent, otherwise JPEG on white, at the largest of a few sizes that
  // fits. Nothing is uploaded here. Rejects with image_unreadable or image_too_large.
  async fit(file) {
    const MAX_BYTES = 3 * 1024 * 1024, KEEP = ['image/jpeg', 'image/png', 'image/webp'];
    if (!file || !file.size) throw new Error('image_unreadable');
    if (KEEP.includes(file.type) && file.size <= MAX_BYTES) return { file, reduced: null };
    let bitmap;
    try { bitmap = await createImageBitmap(file); } catch { throw new Error('image_unreadable'); }
    const encode = (canvas, type) => new Promise(resolve => canvas.toBlob(resolve, type, 0.92));
    const base = (file.name || 'photo').replace(/\.[^.]+$/, '');
    try {
      for (const side of [4096, 3200, 2400, 2000, 1600]) {
        const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d');
        let blob = null;
        if (file.type !== 'image/jpeg') {
          context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          blob = await encode(canvas, 'image/webp');
          if (blob?.type !== 'image/webp') blob = null;   // a browser that cannot write WebP returns PNG
        }
        if (!blob || blob.size > MAX_BYTES) {
          context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          blob = await encode(canvas, 'image/jpeg');
        }
        if (blob && blob.size <= MAX_BYTES && KEEP.includes(blob.type)) {
          const fitted = new File([blob], base + (blob.type === 'image/webp' ? '.webp' : '.jpg'), { type: blob.type });
          return { file: fitted, reduced: { fromBytes: file.size, fromType: file.type || 'unknown', fromSize: [bitmap.width, bitmap.height], toBytes: blob.size, toType: blob.type, toSize: [canvas.width, canvas.height] } };
        }
      }
    } finally { bitmap.close?.(); }
    throw new Error('image_too_large');
  },
  // One line for the page, e.g. "Reduced from a 7.4 MB HEIC (4032×3024) to a 2.6 MB JPEG (3200×2400) to fit the 3 MB limit."
  describe(result) {
    const r = result?.reduced; if (!r) return '';
    const mb = bytes => (bytes / 1048576).toFixed(1) + ' MB', kind = type => (String(type).split('/')[1] || 'image').toUpperCase();
    return `${result.file.name}: reduced from a ${mb(r.fromBytes)} ${kind(r.fromType)} (${r.fromSize.join('×')}) to a ${mb(r.toBytes)} ${kind(r.toType)} (${r.toSize.join('×')}) to fit the 3 MB limit.`;
  }
};
