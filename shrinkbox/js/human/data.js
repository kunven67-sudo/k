// Loads the realistic human data (MakeHuman CC0 base mesh, skeleton, weights, body-shape and
// expression targets) that tools/human-convert.mjs packed into assets/human.bin.
import humanBin from '../../assets/human.bin';

let data = null;

async function gunzip(u8) {
  const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function loadHumanData() {
  if (data) return data;
  const raw = await gunzip(humanBin);
  const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  if (String.fromCharCode(...raw.subarray(0, 4)) !== 'MHB1') throw new Error('bad human.bin');
  const jlen = dv.getUint32(4, true);
  const meta = JSON.parse(new TextDecoder().decode(raw.subarray(8, 8 + jlen)));
  const base = 8 + jlen;
  const sec = (name, Type) => { const [o, n] = meta.sections[name]; return new Type(raw.buffer.slice(raw.byteOffset + base + o, raw.byteOffset + base + o + n)); };
  const posQ = sec('posQ', Int16Array);
  const pos = new Float32Array(posQ.length); for (let i = 0; i < posQ.length; i++) pos[i] = posQ[i] / meta.q;
  const uvQ = sec('uv', Uint16Array);
  const uv = new Float32Array(uvQ.length); for (let i = 0; i < uvQ.length; i++) uv[i] = uvQ[i] / 65535;
  const jointIdx = sec('jointIdx', Uint16Array);
  const tbytes = sec('targets', Uint8Array);
  // target directory (decoded lazily)
  const targets = new Map(); let off = 0;
  for (const t of meta.targets) { targets.set(t.n, { k: t.k, off, dec: null }); off += t.k * 8; }
  data = {
    meta, nv: meta.nv, nr: meta.nr, base: pos, uv,
    src: sec('src', Uint16Array), index: sec('index', Uint16Array),
    skinIdx: sec('skinIdx', Uint8Array), skinW: sec('skinW', Uint8Array),
    groups: meta.groups, bones: meta.bones, anchors: meta.anchors, jointNames: meta.jointNames,
    joints: meta.joints.map(([o, n]) => jointIdx.subarray(o, o + n)),
    targetNames: meta.targets.map((t) => t.n),
    // returns { idx: Uint16Array (vertex ids), d: Float32Array (dm deltas, xyz) } or null
    target(name) {
      const t = targets.get(name); if (!t || !t.k) return null;
      if (t.dec) return t.dec;
      const k = t.k, v = new DataView(tbytes.buffer, tbytes.byteOffset + t.off, k * 8);
      const idx = new Uint16Array(k), d = new Float32Array(k * 3);
      let p = 0; for (let i = 0; i < k; i++) { p += v.getUint16(i * 2, true); idx[i] = p; }
      for (let c = 0; c < 3; c++) { let q = 0; const o = k * 2 + c * k * 2; for (let i = 0; i < k; i++) { q += v.getInt16(o + i * 2, true); d[i * 3 + c] = q / meta.q; } }
      t.dec = { idx, d }; return t.dec;
    },
  };
  return data;
}

export function humanData() { if (!data) throw new Error('human data not loaded yet'); return data; }
