import { workflow, node, trigger } from '@n8n/workflow-sdk';

// Claude · Test 8 photo check (scratch, 17 Oct 2026). Downloads Drive > Testing/Test 8/main.jpg and gives bytes, pixel size and SHA-256. Free; writes nothing.
const start = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Start', parameters: {} } });

const download = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Download Test 8 photo',
    parameters: { resource: 'file', operation: 'download', fileId: { __rl: true, mode: 'id', value: '1wqXIWE7v1GKIUJJ2nthpzX3biLSbR67Y' }, options: { binaryPropertyName: 'files' } },
    credentials: { googleDriveOAuth2Api: { id: 'NA6JT99b4IrTLmzl', name: 'Claude · Midas Drive' } }
  }
});

const hash = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Hash and size',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `function sha256(bytes) {
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  let H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const l = bytes.length, nb = ((l + 9 + 63) >> 6) << 6, m = new Uint8Array(nb);
  m.set(bytes); m[l] = 0x80; const bits = l * 8;
  for (let i = 0; i < 8; i++) m[nb - 1 - i] = Math.floor(bits / Math.pow(2, 8 * i)) & 0xff;
  const W = new Array(64), r = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < nb; o += 64) {
    for (let t = 0; t < 16; t++) W[t] = (m[o+4*t] << 24) | (m[o+4*t+1] << 16) | (m[o+4*t+2] << 8) | m[o+4*t+3];
    for (let t = 16; t < 64; t++) { const s0 = r(W[t-15],7) ^ r(W[t-15],18) ^ (W[t-15] >>> 3), s1 = r(W[t-2],17) ^ r(W[t-2],19) ^ (W[t-2] >>> 10); W[t] = (W[t-16] + s0 + W[t-7] + s1) | 0; }
    let [a,b,c,d,e,f,g,h] = H;
    for (let t = 0; t < 64; t++) {
      const T1 = (h + (r(e,6) ^ r(e,11) ^ r(e,25)) + ((e & f) ^ (~e & g)) + K[t] + W[t]) | 0;
      const T2 = ((r(a,2) ^ r(a,13) ^ r(a,22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + T1) | 0; d = c; c = b; b = a; a = (T1 + T2) | 0;
    }
    H = [H[0]+a,H[1]+b,H[2]+c,H[3]+d,H[4]+e,H[5]+f,H[6]+g,H[7]+h].map(x => x | 0);
  }
  return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}
function size(b) {
  if (b[0] === 0x89 && b[1] === 0x50) return { w: (b[16]<<24|b[17]<<16|b[18]<<8|b[19])>>>0, h: (b[20]<<24|b[21]<<16|b[22]<<8|b[23])>>>0, type: 'png' };
  let i = 2;
  while (i < b.length - 9) {
    if (b[i] !== 0xff) { i++; continue; }
    const mk = b[i+1];
    if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) return { h: b[i+5]*256 + b[i+6], w: b[i+7]*256 + b[i+8], type: 'jpeg' };
    if (mk === 0xd8 || mk === 0x01 || (mk >= 0xd0 && mk <= 0xd7)) { i += 2; continue; }
    i += 2 + b[i+2]*256 + b[i+3];
  }
  return { w: null, h: null, type: 'unknown' };
}
const buf = await this.helpers.getBinaryDataBuffer(0, 'files');
const b = new Uint8Array(buf);
const s = size(b);
return [{ json: { label: 'Testing/Test 8/main.jpg', id: '1wqXIWE7v1GKIUJJ2nthpzX3biLSbR67Y', bytes: b.length, width: s.w, height: s.h, type: s.type, sha256: sha256(b) } }];`
    }
  }
});

export default workflow('claude-t8-photo-check', 'Claude · Test 8 photo check (scratch)')
  .add(start)
  .to(download.to(hash));
