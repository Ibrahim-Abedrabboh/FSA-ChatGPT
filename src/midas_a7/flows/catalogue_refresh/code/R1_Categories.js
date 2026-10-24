// Catalogue refresh · R1 Categories (16 Oct 2026). Code only.
// The scene-relevant Accessories categories of the public Midas Kuwait site, with the "kind" written to the A7 catalogue
// (A7 step 10 compares kinds by their last word). robots.txt (read 16 Oct 2026): Crawl-delay 10 s, and query strings with "="
// are disallowed, so only page 1 of each category is read (the site's default order) and "R2 Read listing" waits 10 s between pages.
const BASE = 'https://midasfurniture.com/en/accessories/';
const CATEGORIES = [
  ['lighting/table-lamps', 'table lamp'], ['lighting/floor-lamps', 'floor lamp'], ['lighting/hanging-and-ceiling-lamps', 'ceiling lamp'],
  ['lighting/wall-lamp', 'wall lamp'], ['soft-furnishings/cushions', 'cushion'], ['soft-furnishings/throws', 'throw'],
  ['soft-furnishings/rugs', 'rug'], ['soft-furnishings/bedding-set', 'bedding set'], ['wall-decor/wall-arts', 'wall art'],
  ['wall-decor/mirrors', 'mirror'], ['wall-decor/wall-clock', 'wall clock'], ['decor-accessories/vases-and-pots', 'vase'],
  ['decor-accessories/flowers', 'artificial plant'], ['decor-accessories/candle-holders', 'candle holder'],
  ['decor-accessories/photo-frames', 'photo frame'], ['table-accessories/deco-figurines-and-objects', 'decor object'],
  ['table-accessories/table-runners', 'table runner'], ['table-accessories/clocks', 'table clock'], ['kitchen-and-dining/trays', 'tray']
];
return CATEGORIES.map(([path, kind]) => ({ json: { path, kind, url: BASE + path + '.html' } }));
