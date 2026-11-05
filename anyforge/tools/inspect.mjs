import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f); const r = doc.getRoot();
  let tris = 0;
  for (const m of r.listMeshes()) for (const p of m.listPrimitives()) { const i = p.getIndices(); tris += (i ? i.getCount() : p.getAttribute('POSITION').getCount()) / 3; }
  const skins = r.listSkins().map(s => s.listJoints().length);
  console.log('\n==', f.split('/').pop(), 'tris', tris, 'skins', skins, 'meshes', r.listMeshes().map(m=>m.getName()).join(','));
  console.log(' anims:', r.listAnimations().map(a => a.getName() + '(' + a.listChannels().length + ')').join(', '));
  console.log(' textures:', r.listTextures().map(t => { const s = t.getSize(); return t.getName() + ' ' + (s ? s.join('x') : '?') + ' ' + t.getMimeType(); }).join(' | '));
  console.log(' materials:', r.listMaterials().map(m=>m.getName()).join(','));
  const j = r.listSkins()[0]?.listJoints().map(n => n.getName());
  if (j) console.log(' joints:', j.join(' '));
}
