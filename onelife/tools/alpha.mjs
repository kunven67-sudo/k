// Poly Haven plants keep their see-through mask in a separate Alpha map: bake it into the colour texture.
import fs from 'node:fs'; import path from 'node:path'; import sharp from 'sharp';
const raw = process.argv[2];
for (const id of ['grass_bermuda_01', 'grass_medium_01', 'dandelion_01', 'fern_02', 'shrub_01', 'celandine_01', 'nettle_plant', 'moss_01']) {
  const j = await (await fetch('https://api.polyhaven.com/files/' + id)).json();
  if (!j.Alpha) { console.log('no alpha', id); continue; }
  const dir = path.join(raw, 'ph', id), gf = path.join(dir, id + '.gltf'), g = JSON.parse(fs.readFileSync(gf, 'utf8'));
  const a = Buffer.from(await (await fetch(j.Alpha['1k'].jpg.url)).arrayBuffer());
  for (const m of g.materials) {
    const ti = m.pbrMetallicRoughness?.baseColorTexture?.index; if (ti == null) continue;
    const img = g.images[g.textures[ti].source]; if (img.uri.endsWith('_rgba.png')) continue;
    const diff = path.join(dir, img.uri), { width, height } = await sharp(diff).metadata();
    const alpha = await sharp(a).resize(width, height).greyscale().raw().toBuffer();
    const out = img.uri.replace(/\.[a-z]+$/, '_rgba.png');
    await sharp(diff).removeAlpha().joinChannel(alpha, { raw: { width, height, channels: 1 } }).png().toFile(path.join(dir, out));
    img.uri = out; img.mimeType = 'image/png'; m.alphaMode = 'MASK'; m.alphaCutoff = 0.5; m.doubleSided = true;
  }
  fs.writeFileSync(gf, JSON.stringify(g)); console.log('alpha', id);
}
