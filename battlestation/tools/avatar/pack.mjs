// Packs the Blender export into the game-ready avatar: repainted outfit textures, WebP images,
// sane alpha modes. Usage: node tools/avatar/pack.mjs <raw.glb> <texdir> <out.glb>
import { NodeIO } from '@gltf-transform/core';
import { EXTTextureWebP } from '@gltf-transform/extensions';
import { textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';
import fs from 'node:fs';

const [, , raw, texdir, out] = process.argv;
const io = new NodeIO().registerExtensions([EXTTextureWebP]);
const doc = await io.read(raw);
const root = doc.getRoot();

for (const t of root.listTextures()) {
  const n = t.getName();
  const f = `${texdir}/${n}.png`;
  if (fs.existsSync(f)) { t.setImage(new Uint8Array(fs.readFileSync(f))); t.setMimeType('image/png'); console.log('replaced', n); }
}
for (const m of root.listMaterials()) {
  const n = m.getName();
  if (/eyebrow|eyelash|short02/.test(n)) { m.setAlphaMode('MASK'); m.setAlphaCutoff(0.35); }
  else m.setAlphaMode('OPAQUE');
  m.setDoubleSided(/eyebrow|eyelash|short02/.test(n));
}
await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 88, resize: [2048, 2048] }));
await io.write(out, doc);
console.log('wrote', out, (fs.statSync(out).size / 1e6).toFixed(2), 'MB');
