// Make the suit + creatures game-ready: node tools/chars.mjs
// suit = Grab3D "Sci-Fi Soldier" rigged (CC0), ant = OpenGameArt mujtaba-io ant (CC0, smoothed in Blender: tools/ant_export.py)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress, meshopt, simplify, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import fs from 'node:fs';
await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const JOBS = [
  ['../../_dl/out/suit1k.glb', 'assets/models/suit.glb', 0.3, 1024],
  ['../../_dl/out/ant.glb', 'assets/models/ant.glb', 1, 512],
  ['../../_dl/out/machine2.glb', 'assets/models/machine.glb', 1, 1024],
];
for (const [src, dst, ratio, tex] of JOBS) {
  if (!fs.existsSync(src)) { console.log('missing', src); continue; }
  const doc = await io.read(src);
  const steps = [dedup(), prune()];
  if (ratio < 1) steps.unshift(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.002, lockBorder: true }));
  
  steps.push(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await doc.transform(...steps);
  let tris = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  await io.write(dst, doc);
  console.log(dst, (fs.statSync(dst).size / 1e6).toFixed(2) + ' MB', Math.round(tris) + ' triangles', doc.getRoot().listAnimations().map(a => a.getName()).join(','));
}
