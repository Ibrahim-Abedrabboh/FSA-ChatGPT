// Option A (19 Oct 2026): the owner sites keep separate budget ledgers, so every job sent to A7 names the site that
// sent it. A7 calls that site's /api/a7/budget only when the address is on its own fixed list, and otherwise the
// original owner-preview ledger; a site whose address is not on that list gets a refused reservation, never a charge.
// URL is the site's main address, which Netlify provides to functions at runtime.
export function siteOrigin(env=globalThis.Netlify?.env){
 try{const u=new URL(String(env?.get?.('URL')||''));return u.protocol==='https:'?u.origin:'';}catch{return '';}
}
