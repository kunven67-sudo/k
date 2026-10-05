// Converts MakeHuman's CC0 data (base mesh, default skeleton + weights, body-shape and expression
// targets) into one compact gzip'd binary the game embeds: shrinkbox/assets/human.bin
//
//   node tools/human-convert.mjs <makehuman/data dir>
//
// Source: https://github.com/makehumancommunity/makehuman (assets released as CC0 1.0).
// Positions/deltas are stored in MakeHuman units (decimeters) quantized to 0.1 mm.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = process.argv[2];
if (!DATA) { console.error('usage: node tools/human-convert.mjs <makehuman/data dir>'); process.exit(1); }
const Q = 1000; // quantization: 1 unit = 0.001 dm = 0.1 mm

// ---------- mesh ----------
const V = [], VT = [], faces = []; let group = null;
for (const l of fs.readFileSync(path.join(DATA, '3dobjs/base.obj'), 'utf8').split('\n')) {
  if (l.startsWith('v ')) { const p = l.trim().split(/\s+/); V.push([+p[1], +p[2], +p[3]]); }
  else if (l.startsWith('vt ')) { const p = l.trim().split(/\s+/); VT.push([+p[1], +p[2]]); }
  else if (l.startsWith('g ')) group = l.slice(2).trim();
  else if (l.startsWith('f ')) faces.push({ g: group, c: l.slice(2).trim().split(/\s+/).map((t) => { const [v, vt] = t.split('/'); return [+v - 1, +vt - 1]; }) });
}
const NV = V.length;
// groups we render (eyelash -1/-2 strips merge into one group per side)
const RENDER = { body: 'body', 'helper-tights': 'tights', 'helper-skirt': 'skirt', 'helper-hair': 'hair',
  'helper-l-eyelashes-1': 'lashL', 'helper-l-eyelashes-2': 'lashL', 'helper-r-eyelashes-1': 'lashR', 'helper-r-eyelashes-2': 'lashR',
  'helper-tongue': 'tongue', 'helper-upper-teeth': 'teethUp', 'helper-lower-teeth': 'teethLo', 'helper-l-eye': 'eyeL', 'helper-r-eye': 'eyeR' };
const rkey = new Map(), rsrc = [], ruv = [], groups = {};
for (const f of faces) {
  const gname = RENDER[f.g]; if (!gname) continue;
  const ids = f.c.map(([v, vt]) => { const k = v * 65536 + vt; let i = rkey.get(k); if (i === undefined) { i = rsrc.length; rkey.set(k, i); rsrc.push(v); ruv.push(VT[vt]); } return i; });
  const tris = (groups[gname] ||= []);
  if (ids.length === 4) tris.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]); else tris.push(...ids);
}
const NR = rsrc.length;
if (NR >= 65536) throw new Error('too many render verts');

// ---------- skeleton ----------
const skel = JSON.parse(fs.readFileSync(path.join(DATA, 'rigs/default.mhskel'), 'utf8'));
const W = JSON.parse(fs.readFileSync(path.join(DATA, 'rigs/default_weights.mhw'), 'utf8')).weights;
// keep the body bones; all face bones fold into "head" (faces move with expression targets instead)
const KEEP = (n) => /^(root|spine0[1-5]|neck0[1-3]|head|clavicle|shoulder01|upperarm0[12]|lowerarm0[12]|wrist|metacarpal[1-4]|finger[1-5]-[1-3]|pelvis|upperleg0[12]|lowerleg0[12]|foot|toe[1-5]-1)(\.[LR])?$/.test(n);
const boneNames = Object.keys(skel.bones);
const keptOf = (n) => { while (n && !KEEP(n)) n = skel.bones[n].parent; return n; };
// topological order (parents first)
const order = []; const seen = new Set();
const visit = (n) => { if (seen.has(n)) return; const p = skel.bones[n].parent; if (p) visit(p); seen.add(n); if (KEEP(n)) order.push(n); };
boneNames.forEach(visit);
const bidx = new Map(order.map((n, i) => [n, i]));
// joints referenced by kept bones (+ eye centers for the eyeballs)
const jointNames = [];
const jidx = (j) => { let i = jointNames.indexOf(j); if (i < 0) { i = jointNames.length; jointNames.push(j); } return i; };
const bones = order.map((n) => {
  const b = skel.bones[n];
  return { name: n, parent: b.parent ? bidx.get(keptOf(b.parent)) : -1, head: jidx(b.head), tail: jidx(b.tail), plane: skel.planes[b.rotation_plane].map(jidx) };
});
const anchors = {};
for (const n of ['eye.L', 'eye.R', 'jaw']) anchors[n] = { head: jidx(skel.bones[n].head), tail: jidx(skel.bones[n].tail) };
const jointVerts = jointNames.map((j) => skel.joints[j]);

// per-vertex top-4 weights after folding removed bones into their kept ancestor
const acc = Array.from({ length: NV }, () => new Map());
for (const [bn, list] of Object.entries(W)) {
  const k = bidx.get(keptOf(bn)); if (k === undefined) continue;
  for (const [v, w] of list) acc[v].set(k, (acc[v].get(k) || 0) + w);
}
const skinIdx = new Uint8Array(NV * 4), skinW = new Uint8Array(NV * 4);
for (let v = 0; v < NV; v++) {
  const e = [...acc[v].entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const s = e.reduce((t, x) => t + x[1], 0);
  if (!s) { skinIdx[v * 4] = bidx.get('root'); skinW[v * 4] = 255; continue; }
  let left = 255;
  e.forEach(([b, w], i) => { const q = i === e.length - 1 ? left : Math.round(w / s * 255); skinIdx[v * 4 + i] = b; skinW[v * 4 + i] = q; left -= q; });
}

// ---------- targets ----------
const TDIR = path.join(DATA, 'targets');
const list = [];
const add = (rel, name) => { if (fs.existsSync(path.join(TDIR, rel))) list.push({ rel, name }); };
for (const g of ['female', 'male']) for (const a of ['child', 'young', 'old']) for (const m of ['minmuscle', 'averagemuscle', 'maxmuscle']) for (const w of ['minweight', 'averageweight', 'maxweight'])
  add(`macrodetails/universal-${g}-${a}-${m}-${w}.target`, `u/${g}-${a}-${m}-${w}`);
for (const r of ['african', 'asian', 'caucasian']) for (const g of ['female', 'male']) for (const a of ['child', 'young', 'old']) add(`macrodetails/${r}-${g}-${a}.target`, `r/${r}-${g}-${a}`);
for (const f of fs.readdirSync(path.join(TDIR, 'expression/units/caucasian')).sort()) add(`expression/units/caucasian/${f}`, `x/${f.replace('.target', '')}`);
for (const d of ['nose', 'mouth', 'eyes', 'chin', 'cheek', 'forehead', 'head', 'ears', 'eyebrows', 'neck', 'torso', 'hip', 'buttocks', 'stomach']) {
  for (const f of fs.readdirSync(path.join(TDIR, d)).sort()) if (f.endsWith('.target') && !/pregnant|navel/.test(f)) add(`${d}/${f}`, `d/${f.replace('.target', '')}`);
}
for (const f of fs.readdirSync(path.join(TDIR, 'armslegs')).sort()) if (/hand-(fingers|scale)|foot-scale\./.test(f)) add(`armslegs/${f}`, `d/${f.replace('.target', '')}`);

const tparts = []; const targets = [];
for (const t of list) {
  const rows = fs.readFileSync(path.join(TDIR, t.rel), 'utf8').split('\n').filter((l) => l && l[0] !== '#').map((l) => l.trim().split(/\s+/).map(Number)).sort((a, b) => a[0] - b[0]);
  if (!rows.length) { targets.push({ n: t.name, k: 0 }); continue; }
  const k = rows.length, buf = Buffer.alloc(k * 8); let o = 0, prev = 0;
  for (const r of rows) { buf.writeUInt16LE(r[0] - prev, o); prev = r[0]; o += 2; }
  for (let c = 1; c <= 3; c++) { let pv = 0; for (const r of rows) { const q = Math.round(r[c] * Q); buf.writeInt16LE(Math.max(-32768, Math.min(32767, q - pv)), o); pv = q; o += 2; } }
  targets.push({ n: t.name, k }); tparts.push(buf);
}

// ---------- pack ----------
const posQ = new Int16Array(NV * 3); V.forEach((p, i) => { for (let c = 0; c < 3; c++) posQ[i * 3 + c] = Math.round(p[c] * Q); });
const src = Uint16Array.from(rsrc);
const uv = new Uint16Array(NR * 2); ruv.forEach(([u, v], i) => { uv[i * 2] = Math.round(u * 65535); uv[i * 2 + 1] = Math.round(v * 65535); });
const gnames = Object.keys(groups); const idxAll = []; const gmeta = {};
for (const g of gnames) { gmeta[g] = [idxAll.length, groups[g].length]; idxAll.push(...groups[g]); }
const index = Uint16Array.from(idxAll);
const jv = []; const jmeta = jointVerts.map((l) => { const o = jv.length; jv.push(...l); return [o, l.length]; });
const jointIdx = Uint16Array.from(jv);

const sections = { posQ, src, uv, index, skinIdx, skinW, jointIdx, targets: Buffer.concat(tparts) };
const meta = { version: 1, q: Q, nv: NV, nr: NR, groups: gmeta, bones, joints: jmeta, jointNames, anchors, targets, sections: {} };
let off = 0; const blobs = [];
for (const [k, a] of Object.entries(sections)) {
  const b = Buffer.from(a.buffer, a.byteOffset, a.byteLength); const pad = (4 - (b.length % 4)) % 4;
  meta.sections[k] = [off, b.length]; blobs.push(b, Buffer.alloc(pad)); off += b.length + pad;
}
const json = Buffer.from(JSON.stringify(meta)); const jpad = (4 - ((8 + json.length) % 4)) % 4;
const head = Buffer.alloc(8); head.write('MHB1', 0); head.writeUInt32LE(json.length + jpad, 4);
const raw = Buffer.concat([head, json, Buffer.alloc(jpad, 32), ...blobs]);
const gz = zlib.gzipSync(raw, { level: 9 });
fs.mkdirSync(path.join(here, '../assets'), { recursive: true });
fs.writeFileSync(path.join(here, '../assets/human.bin'), gz);
console.log(`verts ${NV}, render verts ${NR}, tris ${index.length / 3}, bones ${bones.length}, joints ${jointNames.length}, targets ${targets.length}`);
console.log(`groups ${gnames.map((g) => `${g}:${groups[g].length / 3}`).join(' ')}`);
console.log(`raw ${(raw.length / 1048576).toFixed(2)} MB -> gzip ${(gz.length / 1048576).toFixed(2)} MB`);
