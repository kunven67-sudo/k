// OBJ+MTL -> GLB (flat colour materials), then dedup/weld/quantize with glTF-Transform.
import obj2gltf from 'obj2gltf';
import { NodeIO } from '@gltf-transform/core';
import { dedup, weld, prune, quantize, flatten, join } from '@gltf-transform/functions';
import fs from 'node:fs';
import path from 'node:path';
const [src, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const io = new NodeIO();
for (const f of fs.readdirSync(src).filter((f) => f.endsWith('.obj'))) {
  const glb = await obj2gltf(path.join(src, f), { binary: true });
  const doc = await io.readBinary(new Uint8Array(glb));
  for (const m of doc.getRoot().listMaterials()) { m.setMetallicFactor(0); m.setRoughnessFactor(0.8); }
  await doc.transform(dedup(), flatten(), join(), weld(), prune(), quantize({ quantizePosition: 14, quantizeNormal: 8 }));
  const name = path.basename(f, '.obj').replace(/[^A-Za-z0-9_]+/g, '_');
  await io.write(path.join(out, name + '.glb'), doc);
}
console.log(fs.readdirSync(out).length, 'files');
