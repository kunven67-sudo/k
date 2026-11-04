// Downloads the real (CC0, Poly Haven) kitchen: scanned textures, an indoor HDR photo for the lighting and the
// scanned objects you can pick up, then shrinks them so the Quest 3 loads them fast.
// Usage: node tools/prep-kitchen.mjs [download cache folder]
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, textureCompress } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const RAW = path.resolve(process.argv[2] || '/tmp/sw-dl');
const OUT = path.resolve('assets');
for (const d of ['tex', 'sky', 'models/real']) fs.mkdirSync(path.join(OUT, d), { recursive: true });
fs.mkdirSync(RAW, { recursive: true });

const UA = 'shrinkworks-asset-prep';
function get(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return file;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  execFileSync('curl', ['-sSfL', '-A', UA, '-o', file, url]);
  return file;
}
function info(id) { return JSON.parse(fs.readFileSync(get('https://api.polyhaven.com/files/' + id, path.join(RAW, 'info', id + '.json')), 'utf8')); }

/* ---------- textures: color, normal, packed AO/rough/metal ---------- */
const TEX = {
  // counters: one solid slab of white marble with grey veins (ambientCG Marble012, CC0)
  counter: { acg: 'Marble012', res: '2K', col: 2048, nrm: 1024 },
  cabinet: { id: 'kitchen_wood', res: '1k', col: 1024, nrm: 512 },
  floor: { id: 'laminate_floor_02', res: '1k', col: 1024, nrm: 512 },
  wall: { id: 'painted_plaster_wall', res: '1k', col: 1024, nrm: 512 },
  splash: { id: 'marble_tiles', res: '1k', col: 1024, nrm: 512 }
};
async function textures() {
  for (const [name, t] of Object.entries(TEX)) {
    if (t.acg) {
      const d = path.join(RAW, 'tex', t.acg), zip = path.join(d, 'm.zip');
      get(`https://ambientcg.com/get?file=${t.acg}_${t.res}-JPG.zip`, zip);
      execFileSync('unzip', ['-o', '-q', zip, '-d', d]);
      const p = (s) => path.join(d, `${t.acg}_${t.res}-JPG_${s}.jpg`);
      await sharp(p('Color')).resize(t.col, t.col).jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(OUT, 'tex', name + '_c.jpg'));
      await sharp(p('NormalGL')).resize(t.nrm, t.nrm).jpeg({ quality: 88, mozjpeg: true }).toFile(path.join(OUT, 'tex', name + '_n.jpg'));
      // packed: AO (none: white) / roughness / metal (none: black)
      const r = await sharp(p('Roughness')).resize(512, 512).greyscale().raw().toBuffer();
      const px = Buffer.alloc(512 * 512 * 3);
      for (let i = 0; i < 512 * 512; i++) { px[i * 3] = 255; px[i * 3 + 1] = r[i]; px[i * 3 + 2] = 0; }
      await sharp(px, { raw: { width: 512, height: 512, channels: 3 } }).jpeg({ quality: 85, mozjpeg: true }).toFile(path.join(OUT, 'tex', name + '_a.jpg'));
      console.log('tex', name, '<-', t.acg);
      continue;
    }
    const f = info(t.id), d = path.join(RAW, 'tex', t.id);
    const col = get(f.Diffuse[t.res].jpg.url, path.join(d, 'col.jpg'));
    const nrm = get(f.nor_gl[t.res].jpg.url, path.join(d, 'nrm.jpg'));
    const arm = get(f.arm[t.res].jpg.url, path.join(d, 'arm.jpg'));
    await sharp(col).resize(t.col, t.col).jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(OUT, 'tex', name + '_c.jpg'));
    await sharp(nrm).resize(t.nrm, t.nrm).jpeg({ quality: 88, mozjpeg: true }).toFile(path.join(OUT, 'tex', name + '_n.jpg'));
    await sharp(arm).resize(512, 512).jpeg({ quality: 85, mozjpeg: true }).toFile(path.join(OUT, 'tex', name + '_a.jpg'));
    console.log('tex', name, '<-', t.id);
  }
}

/* ---------- the room's light: a real indoor HDR photo (reflections + soft light) ---------- */
async function sky() {
  const f = info('lebombo');
  get(f.hdri['1k'].hdr.url, path.join(OUT, 'sky', 'room.hdr'));
  console.log('sky room.hdr <- lebombo');
}

/* ---------- scanned objects ---------- */
export const REAL = [
  'food_apple_01', 'lemon', 'food_lime_01', 'food_kiwi_01', 'food_avocado_01', 'yellow_onion', 'croissant', 'bananas',
  'wooden_cutting_board', 'wooden_bowl_01', 'wooden_spoon', 'jug_01', 'carved_wooden_plate', 'brass_pan_01', 'pot_enamel_01',
  'pliers', 'screwdriver', 'adjustable_wrench', 'magnifying_glass_01', 'measuring_tape_01', 'lightbulb_01', 'Drill_01',
  'retro_multimeter', 'vintage_flashlight', 'cardboard_box_01', 'wooden_crate_01'
];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
async function models() {
  await MeshoptSimplifier.ready;
  for (const id of REAL) {
    const f = info(id), g = f.gltf['1k'].gltf, d = path.join(RAW, 'models', id);
    const main = get(g.url, path.join(d, id + '.gltf'));
    for (const [rel, v] of Object.entries(g.include)) get(v.url, path.join(d, rel));
    const doc = await io.read(main);
    let tris = 0;
    for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3;
    const steps = [dedup(), prune(), weld()];
    if (tris > 7000) steps.push(simplify({ simplifier: MeshoptSimplifier, ratio: 7000 / tris, error: 0.0015 }));
    steps.push(textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [512, 512], quality: 80 }));
    await doc.transform(...steps);
    const out = path.join(OUT, 'models', 'real', id.toLowerCase() + '.glb');
    await io.write(out, doc);
    console.log('model', id, Math.round(tris), 'tris ->', (fs.statSync(out).size / 1024 | 0) + ' KB');
  }
}

const only = process.argv[3] || 'all';
if (only === 'all' || only === 'tex') await textures();
if (only === 'all' || only === 'sky') await sky();
if (only === 'all' || only === 'models') await models();
let total = 0;
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else total += fs.statSync(p).size; } };
walk(OUT);
console.log('assets total', (total / 1048576).toFixed(1), 'MB');
