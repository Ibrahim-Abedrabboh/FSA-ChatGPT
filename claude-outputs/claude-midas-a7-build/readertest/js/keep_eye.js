// Keep the first reader's answer and hand the same photo to the second reader.
const src = $('Photo found?').item.json;
const bin = $('Download photo').item.binary;
return { json: { ...src, eye_out: $json }, binary: bin };
