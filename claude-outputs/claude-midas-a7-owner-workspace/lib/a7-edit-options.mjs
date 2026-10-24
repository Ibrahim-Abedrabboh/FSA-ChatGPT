// The edit options panel (edit-options.js) is a browser script; its lists and its parser are reused here so
// the server accepts exactly what the panel can produce.
import '../edit-options.js';
const {parseCode}=globalThis.a7EditOptions;
export function editOptionsOf(code){return parseCode(code);}
