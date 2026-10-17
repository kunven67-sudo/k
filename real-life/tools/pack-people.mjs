// Packs the Quaternius Ultimate Modular Men/Women (CC0) glTFs into small GLBs for the game:
//   people/<sex>-<outfit>.glb  meshes + skeleton, no animations
//   people/anims-<sex>.glb     skeleton + the 24 animations (shared by every body of that sex)
// Usage: node tools/pack-people.mjs <srcDir with men/ and women/> <outDir>
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup, weld, resample, quantize } from '@gltf-transform/functions';
import fs from 'node:fs';
import path from 'node:path';

const [src, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const io = new NodeIO();
function dropOrphans(doc) {
  for (const acc of doc.getRoot().listAccessors()) if (acc.listParents().every((p) => p.propertyType === 'Root')) acc.dispose();
}

const SETS = { men: 'm', women: 'f' };

for (const [dir, sex] of Object.entries(SETS)) {
  const files = fs.readdirSync(path.join(src, dir)).filter((f) => f.endsWith('.gltf'));
  let animDone = false;
  for (const f of files) {
    const name = path.basename(f, '.gltf').toLowerCase().replace(/_/g, '-');
    const doc = await io.read(path.join(src, dir, f));
    if (!animDone) {
      const a = await io.read(path.join(src, dir, f));
      for (const m of a.getRoot().listMeshes()) m.dispose();
      for (const n of a.getRoot().listNodes()) if (n.getMesh()) n.setMesh(null);
      dropOrphans(a);
      await a.transform(resample(), prune({ keepLeaves: true }), dedup());
      await io.write(path.join(out, `anims-${sex}.glb`), a);
      animDone = true;
    }
    for (const an of doc.getRoot().listAnimations()) {
      for (const smp of an.listSamplers()) smp.dispose();
      for (const ch of an.listChannels()) ch.dispose();
      an.dispose();
    }
    dropOrphans(doc);
    await doc.transform(prune({ keepLeaves: true }), dedup(), weld(), quantize({ quantizeNormal: 8, quantizePosition: 14 }));
    await io.write(path.join(out, `${sex}-${name}.glb`), doc);
  }
}
for (const f of fs.readdirSync(out)) console.log(f, (fs.statSync(path.join(out, f)).size / 1024).toFixed(0) + 'KB');
