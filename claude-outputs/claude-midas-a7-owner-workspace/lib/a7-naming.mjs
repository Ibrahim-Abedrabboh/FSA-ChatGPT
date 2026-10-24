// Automatic naming for saved work. Every product (case) gets a short reference CAT-YYMM-NN that is assigned once,
// by the server, when its first version is saved: CAT is a category code, YYMM the month in Asia/Amman time and NN a
// running number per owner, category and month. Display only: the technical IDs that A7, n8n and the budget ledger
// use (owner-<uuid>, claude-a7-<uuid>) are unchanged. The same keyword rules are applied to existing records by the
// 20261019180000_a7_naming migration; tests keep the two in step.
export const CATEGORIES = [
  ['OFF', 'office', 'Office furniture', 'office piece'],
  ['LGT', 'lamp|lighting|chandelier|pendant|sconce|ceiling light|wall light|floor light|table light', 'Lighting', 'light'],
  ['TEX', 'towel|bathrobe|robe|rug|carpet|cushion|pillow|throw|curtain|textile|linen|bedding|duvet|blanket|quilt|bed sheet', 'Textiles', 'textile'],
  ['DIN', 'dining|buffet|sideboard|serving trolley', 'Dining', 'dining piece'],
  ['BED', 'bed|mattress|headboard|nightstand|night stand|dresser|wardrobe|chest of drawers', 'Bedroom', 'bedroom piece'],
  ['SOF', 'sofa|sectional|couch|loveseat|love seat|chaise|ottoman|recliner|pouf|settee', 'Sofas and seating', 'sofa'],
  ['CHR', 'chair|stool|bench', 'Chairs', 'chair'],
  ['TAB', 'table|desk|console|nesting', 'Tables', 'table'],
  ['STO', 'cabinet|shelf|shelves|bookcase|tv unit|storage|cupboard|display unit', 'Storage', 'storage piece'],
  ['ACC', 'vase|dish|bowl|tray|mirror|clock|frame|candle|decor|figurine|accessor|plate|dinnerware|ashtray|jewel|bookend|wall art|painting|flower|sculpture|ornament|basket', 'Accessories', 'accessory'],
];
export const GENERAL = ['GEN', '', 'General', 'product'];
const BY_CODE = new Map([...CATEGORIES, GENERAL].map(row => [row[0], row]));
export function categoryCode(...texts) {
  const text = texts.filter(value => typeof value === 'string').join(' ').toLowerCase();
  for (const [code, pattern] of CATEGORIES) if (new RegExp(pattern).test(text)) return code;
  return GENERAL[0];
}
export const categoryLabel = code => (BY_CODE.get(code) || GENERAL)[2];
export const categorySingular = code => (BY_CODE.get(code) || GENERAL)[3];
export const formatRef = (prefix, n) => `${prefix}-${String(n).padStart(2, '0')}`;
export const isRef = value => typeof value === 'string' && /^[A-Z]{3}-\d{4}-\d{2,}$/.test(value);
// "ABALI DINING TABLE - WHITE" -> "Abali Dining Table — White"; product types such as "sofa" -> "Sofa".
export function niceName(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 110);
  if (!text) return '';
  const cased = text === text.toUpperCase() ? text.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (m, a, b) => a + b.toUpperCase()) : text[0].toUpperCase() + text.slice(1);
  return cased.replace(/\s-\s/g, ' — ');
}
