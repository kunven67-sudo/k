// Turn raw Poly Haven downloads into small game-ready files: node tools/process.mjs <rawDir> <outDir>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress, meshopt, simplify, weld, compactPrimitive } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp'; import fs from 'node:fs'; import path from 'node:path';
const [raw, out, ...only] = process.argv.slice(2);
// name: [polyhaven id, ratio, mode('scan' = position-only weld for rock scans), texture size]
const PH = {
  boulder: ['boulder_01', 0.1, 'scan', 1024], rocks: ['rock_moss_set_01', 0.15, 'scan', 1024], stones: ['namaqualand_stones_01', 0.06, 'scan', 1024],
  pebble: ['stone_01', 0.025, 'scan', 1024], rock: ['rock_07', 0.15, 'scan', 1024], grass: ['grass_medium_01', 0.3, 0, 1024], grassb: ['grass_bermuda_01', 1, 0, 1024],
  dandelion: ['dandelion_01', 0.12, 0, 1024], fern: ['fern_02', 1, 0, 1024], shrub: ['shrub_01', 0.06, 0, 1024], celandine: ['celandine_01', 1, 0, 1024],
  nettle: ['nettle_plant', 0.2, 0, 1024], stump: ['tree_stump_01', 0.15, 0, 1024], log: ['dead_tree_trunk', 0.08, 0, 1024],
  bark: ['bark_debris_01', 0.04, 'scan', 1024], rat: ['street_rat', 0.15, 'scan', 1024], moss: ['moss_01', 1, 0, 512],
};
await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
fs.mkdirSync(path.join(out, 'models'), { recursive: true });
for (const [name, [id, ratio, mode, tex]] of Object.entries(PH)) {
  if (only.length && !only.includes(name)) continue;
  const doc = await io.read(path.join(raw, 'ph', id, id + '.gltf'));
  const steps = [dedup(), prune()];
  if (ratio < 1 && mode === 'scan') {
    for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
      const idx = new Uint32Array(p.getIndices().getArray()), pos = p.getAttribute('POSITION').getArray();
      const key = new Map(), remap = new Uint32Array(pos.length / 3), first = [], up = [];
      for (let i = 0; i < pos.length / 3; i++) {
        const k = Math.round(pos[i * 3] * 1e4) + ',' + Math.round(pos[i * 3 + 1] * 1e4) + ',' + Math.round(pos[i * 3 + 2] * 1e4);
        let u = key.get(k); if (u === undefined) { u = first.length; key.set(k, u); first.push(i); up.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); }
        remap[i] = u;
      }
      const [si] = MeshoptSimplifier.simplify(idx.map(i => remap[i]), new Float32Array(up), 3, Math.floor(idx.length * ratio / 3) * 3, 0.05);
      p.getIndices().setArray(si.map(u => first[u])); compactPrimitive(p);
    }
  } else if (ratio < 1) steps.unshift(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.1, lockBorder: false }));
  await doc.transform(...steps, textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex], quality: 82 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  let tris = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
  const file = path.join(out, 'models', name + '.glb'); await io.write(file, doc);
  console.log(name, (fs.statSync(file).size / 1e6).toFixed(2) + 'MB', tris + ' tris');
}
// textures -> webp
fs.mkdirSync(path.join(out, 'tex'), { recursive: true });
for (const f of fs.readdirSync(path.join(raw, 'tex'))) {
  const big = f.startsWith('aerial_grass_rock') ? 2048 : 1024;
  await sharp(path.join(raw, 'tex', f)).resize(big, big).webp({ quality: f.includes('_nor') ? 90 : 82 }).toFile(path.join(out, 'tex', f.replace('.jpg', '.webp')));
}
fs.copyFileSync(path.join(raw, 'sky.hdr'), path.join(out, 'tex', 'sky.hdr'));
console.log('textures done');
