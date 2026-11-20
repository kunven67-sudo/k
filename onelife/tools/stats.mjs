import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import fs from 'node:fs'; import path from 'node:path';
const raw = process.argv[2], io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const id of fs.readdirSync(path.join(raw, 'ph'))) {
  const doc = await io.read(path.join(raw, 'ph', id, id + '.gltf')); const r = doc.getRoot();
  let tris = 0; for (const m of r.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3;
  const nodes = r.listNodes().filter(n => n.getMesh()).map(n => n.getName());
  const bb = (await import('@gltf-transform/core')).getBounds(r.listScenes()[0]);
  console.log(id, Math.round(tris), 'meshes', nodes.length, 'size', bb.max.map((v, i) => (v - bb.min[i]).toFixed(2)).join('x'), nodes.slice(0, 6).join(','));
}
