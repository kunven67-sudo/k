// Downloads the CC0 Poly Haven models, textures and skies the game uses into assets_src/ph/.
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'assets_src/ph';
const MODELS = { // id: texture resolution
  ceiling_fan: '1k', desk_lamp_arm_01: '1k', potted_plant_01: '1k', potted_plant_04: '1k', pachira_aquatica_01: '1k',
  calathea_orbifolia_01: '1k', wall_clock: '1k', side_table_01: '1k', modern_wooden_cabinet: '1k',
  wooden_display_shelves_01: '1k', cardboard_box_01: '1k', throw_pillows_01: '1k', decorative_book_set_01: '1k',
  standing_picture_frame_01: '1k', hanging_picture_frame_01: '1k', hanging_picture_frame_02: '1k', dining_table: '1k',
  dining_chair_02: '1k', sofa_02: '1k', modern_coffee_table_01: '1k', rubber_duck_toy: '1k', bananas: '1k',
  food_apple_01: '1k', gaming_console: '1k', dartboard: '1k', modern_ceiling_lamp_01: '1k', multi_cleaner_bottle: '1k',
  wooden_cutting_board: '1k', alarm_clock_01: '1k',
};
const TEXTURES = {
  laminate_floor_02: '2k', painted_plaster_wall: '2k', marble_01: '2k', granite_tile: '2k', oak_veneer_01: '1k',
  knitted_fleece: '1k', jogging_melange: '1k', rough_linen: '1k', polar_fleece: '1k', curly_teddy_natural: '1k',
  terry_cloth: '1k', fabric_leather_02: '1k', kitchen_wood: '1k', white_oak_veneer: '1k',
};
const SKIES = ['courtyard', 'courtyard_night'];

async function get(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.status + ' ' + url);
      fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
      return;
    } catch (e) { if (i === 3) throw e; await new Promise(r => setTimeout(r, 2000 * 2 ** i)); }
  }
}
const api = id => fetch('https://api.polyhaven.com/files/' + id).then(r => r.json());

const jobs = [];
for (const [id, res] of Object.entries(MODELS)) jobs.push(async () => {
  const g = (await api(id)).gltf;
  if (!g || !g[res]) { console.warn('no gltf for', id); return; }
  const f = g[res].gltf;
  await get(f.url, `${OUT}/models/${id}/${id}.gltf`);
  for (const [rel, inc] of Object.entries(f.include)) await get(inc.url, `${OUT}/models/${id}/${rel}`);
});
for (const [id, res] of Object.entries(TEXTURES)) jobs.push(async () => {
  const f = await api(id);
  for (const map of ['Diffuse', 'nor_gl', 'arm']) if (f[map]) await get(f[map][res].jpg.url, `${OUT}/textures/${id}/${map}.jpg`);
});
for (const id of SKIES) jobs.push(async () => { const f = await api(id); await get(f.tonemapped.url, `${OUT}/skies/${id}.jpg`); });

let n = 0;
const pool = Array.from({ length: 6 }, async () => { while (jobs.length) { await jobs.shift()(); n++; } });
await Promise.all(pool);
console.log('fetched', n, 'assets');
