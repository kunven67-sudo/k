// Turns the downloaded sources (assets_src/) into small game assets (assets/): GLB + WebP.
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { textureCompress, dedup, prune, weld, simplify, resample } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const SRC = 'assets_src/ph', OUT = 'assets';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
fs.mkdirSync(`${OUT}/models`, { recursive: true });
fs.mkdirSync(`${OUT}/textures`, { recursive: true });
fs.mkdirSync(`${OUT}/skies`, { recursive: true });
const only = process.argv[2];

// models
for (const id of fs.readdirSync(`${SRC}/models`)) {
  if (only && only !== id) continue;
  const out = `${OUT}/models/${id}.glb`;
  if (fs.existsSync(out) && !only) continue;
  const doc = await io.read(`${SRC}/models/${id}/${id}.gltf`);
  let tris = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? 0) / 3;
  await MeshoptSimplifier.ready;
  const ratio = tris > 30000 ? Math.max(0.15, 30000 / tris) : 1;
  const steps = [dedup(), weld()];
  if (ratio < 1) steps.push(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.0008 }));
  steps.push(prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 85, resize: [1024, 1024] }));
  await doc.transform(...steps);
  let after = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) after += (p.getIndices()?.getCount() ?? 0) / 3;
  await io.write(out, doc);
  console.log(id, Math.round(tris), '->', Math.round(after), 'tris', (fs.statSync(out).size / 1e6).toFixed(2), 'MB');
}

// textures
for (const id of fs.readdirSync(`${SRC}/textures`)) {
  if (only && only !== id) continue;
  for (const f of fs.readdirSync(`${SRC}/textures/${id}`)) {
    const out = `${OUT}/textures/${id}_${f.replace('.jpg', '.webp')}`;
    if (fs.existsSync(out) && !only) continue;
    const q = f.startsWith('nor') ? 90 : 82;
    await sharp(`${SRC}/textures/${id}/${f}`).resize(2048, 2048, { fit: 'inside', withoutEnlargement: true }).webp({ quality: q }).toFile(out);
  }
}
console.log('textures done');

// skies (window view): 4096 wide is plenty for what fits through a window
for (const f of fs.readdirSync(`${SRC}/skies`)) {
  const out = `${OUT}/skies/${f.replace('.jpg', '.webp')}`;
  if (fs.existsSync(out) && !only) continue;
  await sharp(`${SRC}/skies/${f}`, { limitInputPixels: false }).resize(4096, 2048).webp({ quality: 86 }).toFile(out);
}
console.log('skies done');
