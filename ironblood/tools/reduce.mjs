// shrink a film-quality scanned tree into a game-ready one
// usage: node reduce.mjs in.gltf out.glb cardKeep cardScale trunkRatio
import fs from 'fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, compactPrimitive } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
const [,, inp, out, keepS, scaleS, trunkS] = process.argv;
const keep = +keepS, scaleK = +scaleS, trunkRatio = +trunkS;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inp);
let rnd = 12345; const rand = () => (rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
  const mat = prim.getMaterial();
  if (!mat || mat.getAlphaMode() === 'OPAQUE') continue;
  // leaf/twig cards: find each card (connected vertices), keep a few, grow them
  const idx = prim.getIndices().getArray(), pos = prim.getAttribute('POSITION');
  const nV = pos.getCount(), parent = new Int32Array(nV); for (let i = 0; i < nV; i++) parent[i] = i;
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  for (let t = 0; t < idx.length; t += 3) { const a = find(idx[t]), b = find(idx[t + 1]), c = find(idx[t + 2]); parent[b] = a; parent[c] = a; }
  // group triangles by card, keep a random few, and store them in random order
  // (so a far-away tree can draw just the first part of the list and still look even)
  const byCard = new Map();
  for (let t = 0; t < idx.length; t += 3) { const r = find(idx[t]); let l = byCard.get(r); if (!l) { l = []; byCard.set(r, l); } l.push(t); }
  const kept = [...byCard.keys()].filter(() => rand() < keep);
  for (let i = kept.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [kept[i], kept[j]] = [kept[j], kept[i]]; }
  const P = pos.getArray();
  const newIdx = [], remap = new Int32Array(nV).fill(-1), order = [];
  for (const r of kept) for (const t of byCard.get(r)) for (let j = 0; j < 3; j++) { const v = idx[t + j]; if (remap[v] < 0) { remap[v] = order.length; order.push(v); } newIdx.push(remap[v]); }
  // centroid per kept card, scale its vertices out from it
  const cen = new Map();
  for (const v of order) { const r = find(v); let c = cen.get(r); if (!c) { c = [0, 0, 0, 0]; cen.set(r, c); } c[0] += P[v * 3]; c[1] += P[v * 3 + 1]; c[2] += P[v * 3 + 2]; c[3]++; }
  for (const name of prim.listSemantics()) {
    const acc = prim.getAttribute(name), src = acc.getArray(), size = acc.getElementSize();
    const dst = new src.constructor(order.length * size);
    order.forEach((v, i) => { for (let k = 0; k < size; k++) dst[i * size + k] = src[v * size + k]; });
    if (name === 'POSITION') order.forEach((v, i) => { const c = cen.get(find(v)); for (let k = 0; k < 3; k++) { const m = c[k] / c[3]; dst[i * 3 + k] = m + (dst[i * 3 + k] - m) * scaleK; } });
    const nacc = doc.createAccessor().setType(acc.getType()).setArray(dst).setBuffer(acc.getBuffer());
    prim.setAttribute(name, nacc);
  }
  prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(newIdx)).setBuffer(prim.getIndices().getBuffer()));
  // alpha cutout instead of blending: sorts correctly and casts proper shadows
  mat.setAlphaMode('MASK').setAlphaCutoff(0.4);
  const cardMap = JSON.parse(process.env.CARD_MAP || '{}');
  const png = cardMap[mat.getName()] || process.env.CARD_TEX;
  if (png) {
    // the scan's card color is a JPG with no see-through part: swap in color + alpha merged into one PNG
    const t = doc.createTexture(mat.getName() + '_rgba').setImage(fs.readFileSync(png)).setMimeType('image/png').setURI(mat.getName() + '_rgba.png');
    mat.setBaseColorTexture(t);
  }
  console.log(mesh.getName(), mat.getName(), 'cards kept ->', newIdx.length / 3, 'tris');
}
await MeshoptSimplifier.ready;
// trunks and bark: real simplification (only the solid parts), shape kept
for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
  if (p.getMaterial()?.getAlphaMode() !== 'OPAQUE') continue;
  const pos = p.getAttribute('POSITION').getArray(), idx = p.getIndices().getArray();
  const src = idx instanceof Uint32Array ? idx : new Uint32Array(idx);
  const target = Math.max(300, Math.floor(src.length * trunkRatio / 3) * 3);
  const [res] = MeshoptSimplifier.simplify(src, pos, 3, target, +(process.env.ERR || 0.01), ['LockBorder']);
  p.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(res)).setBuffer(p.getIndices().getBuffer()));
}
for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) { for (const sem of p.listSemantics()) if (sem.startsWith('COLOR_')) p.setAttribute(sem, null); compactPrimitive(p); }
await doc.transform(prune(), dedup());
let tot = 0;
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tot += p.getIndices().getCount() / 3;
console.log('TOTAL tris', Math.round(tot));
await io.write(out, doc);
