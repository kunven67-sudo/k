// Download Poly Haven (CC0) models/textures/sky into a raw folder: node tools/fetch.mjs <rawDir>
import fs from 'node:fs'; import path from 'node:path';
const raw = process.argv[2]; fs.mkdirSync(raw, { recursive: true });
const MODELS = ['boulder_01', 'rock_moss_set_01', 'namaqualand_stones_01', 'stone_01', 'rock_07', 'grass_medium_01', 'grass_bermuda_01', 'dandelion_01', 'fern_02', 'shrub_01', 'celandine_01', 'nettle_plant', 'tree_stump_01', 'dead_tree_trunk', 'bark_debris_01', 'pine_tree_01', 'street_rat', 'moss_01'];
const TEX = { aerial_grass_rock: '2k', forest_ground_04: '1k', rocky_terrain_02: '1k', brown_mud_leaves_01: '1k', coast_sand_01: '1k', rock_boulder_cracked: '1k', brown_mud: '1k' };
const get = async (u, f) => { if (fs.existsSync(f)) return; const r = await fetch(u); if (!r.ok) throw new Error(u + ' ' + r.status); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); };
for (const id of MODELS) {
  const j = await (await fetch('https://api.polyhaven.com/files/' + id)).json();
  const g = j.gltf['1k'].gltf, dir = path.join(raw, 'ph', id);
  await get(g.url, path.join(dir, id + '.gltf'));
  for (const [rel, inc] of Object.entries(g.include)) await get(inc.url, path.join(dir, rel));
  console.log('model', id);
}
for (const [id, res] of Object.entries(TEX)) {
  const j = await (await fetch('https://api.polyhaven.com/files/' + id)).json();
  for (const [k, key] of [['diff', 'Diffuse'], ['nor', 'nor_gl'], ['rough', 'Rough'], ['disp', 'Displacement']]) {
    const m = j[key]; if (!m) continue; await get(m[res].jpg.url, path.join(raw, 'tex', `${id}_${k}.jpg`));
  }
  console.log('tex', id);
}
const h = await (await fetch('https://api.polyhaven.com/files/kloofendal_48d_partly_cloudy_puresky')).json();
await get(h.hdri['2k'].hdr.url, path.join(raw, 'sky.hdr')); console.log('sky');
