// Downloads + compresses every asset the game uses into assets/ (git-ignored).
//   node tools/fetch_assets.mjs [textures|space|people|music|sfx|all]
// Sources (all free to use):
//   Poly Haven textures  - CC0                       https://polyhaven.com
//   Solar System Scope   - CC BY 4.0 (credited)       https://www.solarsystemscope.com/textures/
//   Quaternius people/cars - CC0 (from the REAL LIFE branch of this repo)
//   Kevin MacLeod music  - CC BY 4.0 (credited)       https://incompetech.com
//   Kenney audio         - CC0                        https://kenney.nl
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import sharp from 'sharp';

const what = process.argv[2] || 'all';
const RAW = 'assets/_raw';
fs.mkdirSync(RAW, { recursive: true });

async function get(url, file) {
  const bad = (f) => { if (!fs.existsSync(f) || fs.statSync(f).size < 1000) return true; const h = fs.readFileSync(f).subarray(0, 64).toString('latin1'); return /<html|<!doctype/i.test(h); };
  if (!bad(file)) return file;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let i = 0; i < 4; i++) {
    try { execSync(`curl -sSL --fail -A "Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0 Safari/537.36" -o "${file}" "${url}"`, { stdio: 'pipe' }); } catch (e) {}
    if (!bad(file)) return file;
    await new Promise(r => setTimeout(r, 2000 * 2 ** i));
  }
  throw new Error('download failed ' + url);
}

// ---------------------------------------------------------------- textures (Poly Haven, CC0)
// id -> [outName, size, keep arm?]
const TEX = {
  painted_plaster_wall: ['plaster', 1024],
  grey_tiles: ['labfloor', 1024],
  long_white_tiles: ['walltile', 1024],
  polystyrene: ['ceiling', 512],
  concrete_wall_008: ['concrete', 1024],
  concrete_floor_02: ['concretefloor', 1024],
  metal_plate: ['diamondplate', 1024],
  metal_plate_02: ['darkmetal', 1024],
  box_profile_metal_sheet: ['ribmetal', 1024],
  laminate_floor_02: ['laminate', 1024],
  rectangular_parquet: ['parquet', 1024],
  slab_tiles: ['blackmarble', 1024],
  terrazzo_tiles: ['terrazzo', 1024],
  poly_wool_herringbone: ['carpet', 1024],
  fabric_leather_02: ['leather', 1024],
  anti_skid_tiles: ['kitchentile', 1024],
  rubber_tiles: ['rubbertile', 1024],
  asphalt_02: ['asphalt', 1024],
  concrete_pavement_02: ['sidewalk', 1024],
  brick_wall_02: ['brick', 1024],
  brushed_concrete: ['brushedconcrete', 1024],
  square_tiles_03: ['smalltile', 512],
};
async function textures() {
  fs.mkdirSync('assets/tex', { recursive: true });
  for (const [id, [name, size]] of Object.entries(TEX)) {
    const out = `assets/tex/${name}_col.webp`;
    if (fs.existsSync(out)) continue;
    const files = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
    const pick = (k) => files[k]?.['1k']?.jpg?.url || files[k]?.['1k']?.png?.url;
    const maps = { col: pick('Diffuse'), nrm: pick('nor_gl'), arm: pick('arm'), rough: pick('Rough'), ao: pick('AO') };
    for (const [k, url] of Object.entries(maps)) {
      if (!url) continue;
      const raw = await get(url, `${RAW}/tex/${id}_${k}${path.extname(url)}`);
      const q = k === 'nrm' ? 92 : 82;
      if (k === 'rough' && maps.arm) continue;
      if (k === 'ao' && maps.arm) continue;
      const o = `assets/tex/${name}_${k === 'rough' ? 'arm' : k}.webp`;
      if (k === 'rough') {
        // build an ARM-like map: R = AO (or white), G = roughness, B = 0 metal
        const r = await sharp(raw).resize(size, size).greyscale().raw().toBuffer();
        let ao = null;
        if (maps.ao) ao = await sharp(await get(maps.ao, `${RAW}/tex/${id}_ao.jpg`)).resize(size, size).greyscale().raw().toBuffer();
        const buf = Buffer.alloc(size * size * 3);
        for (let i = 0; i < size * size; i++) { buf[i * 3] = ao ? ao[i] : 255; buf[i * 3 + 1] = r[i]; buf[i * 3 + 2] = 0; }
        await sharp(buf, { raw: { width: size, height: size, channels: 3 } }).webp({ quality: q }).toFile(o);
      } else {
        await sharp(raw).resize(size, size).webp({ quality: q }).toFile(o);
      }
    }
    console.log('tex', name);
  }
}

// ---------------------------------------------------------------- space (Solar System Scope, CC BY 4.0)
const SSS = 'https://www.solarsystemscope.com/textures/download/';
const SPACE = [
  ['8k_earth_daymap.jpg', 'earth_day', 4096], ['8k_earth_nightmap.jpg', 'earth_night', 4096],
  ['8k_earth_clouds.jpg', 'earth_clouds', 2048], ['2k_earth_normal_map.tif', 'earth_nrm', 2048],
  ['2k_earth_specular_map.tif', 'earth_spec', 2048], ['2k_moon.jpg', 'moon', 2048],
  ['2k_sun.jpg', 'sun', 1024], ['2k_mercury.jpg', 'mercury', 1024], ['2k_venus_atmosphere.jpg', 'venus', 1024],
  ['2k_mars.jpg', 'mars', 2048], ['2k_jupiter.jpg', 'jupiter', 2048], ['2k_saturn.jpg', 'saturn', 2048],
  ['8k_saturn_ring_alpha.png', 'saturn_ring', 2048], ['2k_uranus.jpg', 'uranus', 1024], ['2k_neptune.jpg', 'neptune', 1024],
  ['2k_ceres_fictional.jpg', 'ceres', 512], ['2k_eris_fictional.jpg', 'eris', 512], ['2k_makemake_fictional.jpg', 'makemake', 512],
  ['8k_stars_milky_way.jpg', 'milkyway', 4096],
];
async function space() {
  fs.mkdirSync('assets/space', { recursive: true });
  for (const [f, name, w] of SPACE) {
    const out = `assets/space/${name}.webp`;
    if (fs.existsSync(out)) continue;
    const raw = await get(SSS + f, `${RAW}/space/${f}`);
    let img = sharp(raw);
    const meta = await img.metadata();
    const h = name === 'saturn_ring' ? Math.round(meta.height * w / meta.width) || 64 : w / 2;
    img = img.resize(w, Math.max(1, h), { fit: 'fill' });
    await img.webp({ quality: name.includes('nrm') ? 92 : 84, alphaQuality: 90 }).toFile(out);
    console.log('space', name);
  }
}

// ---------------------------------------------------------------- people + cars (Quaternius, CC0)
function people() {
  fs.mkdirSync('assets/humans', { recursive: true });
  fs.mkdirSync('assets/cars', { recursive: true });
  const br = 'origin/claude/quirky-bardeen-0p9dpn';
  try { execSync(`git fetch -q origin claude/quirky-bardeen-0p9dpn`, { stdio: 'ignore' }); } catch (e) {}
  const H = ['anims-m', 'anims-f', 'm-suit', 'm-worker', 'm-swat', 'm-casual-2', 'm-casual-hoodie', 'm-adventurer',
    'f-suit', 'f-worker', 'f-soldier', 'f-casual', 'f-formal'];
  for (const h of H) {
    const out = `assets/humans/${h}.glb`;
    if (!fs.existsSync(out)) execSync(`git show ${br}:real-life/assets/models/humans/${h}.glb > ${out}`);
  }
  for (const c of ['NormalCar1', 'NormalCar2', 'SUV', 'Taxi', 'Cop', 'SportsCar']) {
    const out = `assets/cars/${c}.glb`;
    if (!fs.existsSync(out)) execSync(`git show ${br}:real-life/assets/models/autos/${c}.glb > ${out}`);
  }
  console.log('people + cars ok');
}

// ---------------------------------------------------------------- music (Kevin MacLeod, CC BY 4.0)
const MUSIC = {
  tiny: 'Ossuary 6 - Air', tense: 'Unseen Horrors', city: 'Volatile Reaction', huge: 'Five Armies',
  space: 'Lightless Dawn', boss: 'Crusade - Heavy Industry', menu: 'Darkest Child', end: 'Echoes of Time v2',
};
async function music() {
  fs.mkdirSync('assets/music', { recursive: true });
  for (const [k, t] of Object.entries(MUSIC)) {
    const out = `assets/music/${k}.ogg`;
    if (fs.existsSync(out)) continue;
    try {
      const raw = await get(`https://incompetech.com/music/royalty-free/mp3-royaltyfree/${encodeURIComponent(t)}.mp3`, `${RAW}/music/${k}.mp3`);
      execSync(`ffmpeg -y -loglevel error -i "${raw}" -ac 2 -ar 48000 -c:a libopus -b:a 72k "${out}"`);
      console.log('music', k, t);
    } catch (e) { console.log('music FAILED', k, t, e.message); }
  }
}

const jobs = { textures, space, people, music };
if (what === 'all') { for (const j of Object.values(jobs)) await j(); }
else await jobs[what]();
