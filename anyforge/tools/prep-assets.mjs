// Turns the raw downloads (CC0 textures, skies, sounds; three.js example models) into the small files the game ships.
// Usage: node tools/prep-assets.mjs <raw download folder>
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, textureCompress, resample } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const RAW = path.resolve(process.argv[2] || '/tmp/claude-0/af-dl');
const OUT = path.resolve('assets');
for (const d of ['tex', 'sky', 'models', 'sfx']) fs.mkdirSync(path.join(OUT, d), { recursive: true });
const only = process.argv[3] || 'all';

/* ---------- textures: color (1024), normal (512), packed AO/rough/metal (512) ---------- */
const TEX = {
  paint: { acg: 'Metal055A' }, alu: { acg: 'Metal032' }, iron: { acg: 'Metal046B' }, tread: { ph: 'metal_plate' },
  plastic: { acg: 'Plastic010' }, rubber: { acg: 'Rubber004' }, planks: { ph: 'oak_wood_planks' }, plywood: { ph: 'plywood' },
  concrete: { ph: 'concrete_floor_worn_001' }, brick: { ph: 'brick_wall_02' }, fabric: { acg: 'Fabric030' },
  grass: { ph: 'grass_ground' }, pad: { ph: 'brushed_concrete' }, asphalt: { ph: 'asphalt_02' }
};
async function packArm(ao, rough, metal, size) {
  const load = async (f, fill) => f && fs.existsSync(f)
    ? sharp(f).resize(size, size).greyscale().raw().toBuffer()
    : Buffer.alloc(size * size, fill);
  const [a, r, m] = await Promise.all([load(ao, 255), load(rough, 160), load(metal, 0)]);
  const px = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) { px[i * 3] = a[i]; px[i * 3 + 1] = r[i]; px[i * 3 + 2] = m[i]; }
  return sharp(px, { raw: { width: size, height: size, channels: 3 } });
}
async function textures() {
  for (const [name, src] of Object.entries(TEX)) {
    let col, nrm, arm;
    if (src.ph) {
      const d = path.join(RAW, 'tex', src.ph);
      col = path.join(d, 'col.jpg'); nrm = path.join(d, 'nrm.jpg');
      arm = sharp(path.join(d, 'arm.jpg')).resize(512, 512);
    } else {
      const d = path.join(RAW, 'tex', src.acg), p = (s) => path.join(d, `${src.acg}_1K-JPG_${s}.jpg`);
      col = p('Color'); nrm = p('NormalGL');
      arm = await packArm(p('AmbientOcclusion'), p('Roughness'), p('Metalness'), 512);
    }
    const big = name === 'grass' || name === 'pad' || name === 'asphalt' ? 1024 : 1024;
    await sharp(col).resize(big, big).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(OUT, 'tex', name + '_c.jpg'));
    await sharp(nrm).resize(512, 512).jpeg({ quality: 88, mozjpeg: true }).toFile(path.join(OUT, 'tex', name + '_n.jpg'));
    await arm.jpeg({ quality: 85, mozjpeg: true }).toFile(path.join(OUT, 'tex', name + '_a.jpg'));
    console.log('tex', name);
  }
}

/* ---------- skies: sharp background (tone mapped JPG) + small HDR for lighting ---------- */
const SKY = { day: 'kloofendal_48d_partly_cloudy_puresky', sunset: 'qwantani_sunset_puresky', night: 'qwantani_night_puresky' };
async function skies() {
  for (const [name, id] of Object.entries(SKY)) {
    await sharp(path.join(RAW, 'sky', id + '.tm.jpg'), { limitInputPixels: false }).resize(4096, 2048)
      .jpeg({ quality: name === 'night' ? 80 : 74, mozjpeg: true }).toFile(path.join(OUT, 'sky', name + '.jpg'));
    fs.copyFileSync(path.join(RAW, 'sky', id + '.1k.hdr'), path.join(OUT, 'sky', name + '.hdr'));
    console.log('sky', name);
  }
}

/* ---------- models ---------- */
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
async function models() {
  await MeshoptSimplifier.ready;
  const M = [
    { src: 'Soldier.glb', out: 'soldier.glb', ratio: 1, tex: 1024, keep: ['Idle', 'Walk', 'Run'] },
    { src: 'Michelle.glb', out: 'michelle.glb', ratio: 0.55, tex: 512, keep: ['SambaDance'] },
    { src: 'readyplayer.me.glb', out: 'rpm.glb', ratio: 1, tex: 512, keep: [] },
    { src: 'Xbot.glb', out: 'xbot.glb', ratio: 0.3, tex: 256, keep: ['idle', 'walk', 'run', 'agree', 'headShake', 'sad_pose', 'sneak_pose'] },
    { src: 'hand-left.glb', out: 'hand-left.glb', ratio: 1, tex: 256, keep: [] },
    { src: 'hand-right.glb', out: 'hand-right.glb', ratio: 1, tex: 256, keep: [] }
  ];
  for (const m of M) {
    const doc = await io.read(path.join(RAW, 'raw', m.src));
    for (const a of doc.getRoot().listAnimations()) if (!m.keep.includes(a.getName())) a.dispose();
    const steps = [dedup(), prune(), resample()];
    if (m.ratio < 1) steps.push(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: m.ratio, error: 0.002 }));
    steps.push(textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [m.tex, m.tex], quality: 82 }));
    await doc.transform(...steps);
    // PNG textures with alpha (eyes, visor) keep alpha: textureCompress to jpeg drops it, so put those back as png
    await io.write(path.join(OUT, 'models', m.out), doc);
    console.log('model', m.out, (fs.statSync(path.join(OUT, 'models', m.out)).size / 1024 | 0) + ' KB');
  }
}

/* ---------- sounds: mono ogg, loops get a crossfaded seam ---------- */
const S = path.join(RAW, 'sfx');
const SFX = {
  ui_click: 'kenney_interfaceSounds/Audio/click_002.ogg', ui_select: 'kenney_interfaceSounds/Audio/select_001.ogg',
  ui_back: 'kenney_interfaceSounds/Audio/back_001.ogg', ui_open: 'kenney_interfaceSounds/Audio/open_001.ogg',
  ui_close: 'kenney_interfaceSounds/Audio/close_001.ogg', ui_toggle: 'kenney_interfaceSounds/Audio/toggle_001.ogg',
  ui_error: 'kenney_interfaceSounds/Audio/error_004.ogg', ui_ok: 'kenney_interfaceSounds/Audio/confirmation_001.ogg',
  attach1: '100-CC0-SFX_0/tools_01.ogg', attach2: '100-CC0-SFX_0/tools_02.ogg', attach3: '100-CC0-SFX_0/tools_03.ogg',
  snap: 'sfx_100_v2/sfx100v2_metal_hit_02.ogg', remove: '100-CC0-SFX_0/tools_04.ogg',
  metal1: 'sci-fi_sounds/Audio/impactMetal_000.ogg', metal2: 'sci-fi_sounds/Audio/impactMetal_001.ogg',
  metal3: 'sci-fi_sounds/Audio/impactMetal_002.ogg', metal4: 'sci-fi_sounds/Audio/impactMetal_004.ogg',
  wood1: '100-CC0-SFX_0/wooden_01.ogg', wood2: '100-CC0-SFX_0/wooden_02.ogg', wood3: 'sfx_100_v2/sfx100v2_wood_hit_01.ogg',
  heavy1: '100-CC0-SFX_0/slam_01.ogg', heavy2: '100-CC0-SFX_0/slam_02.ogg', heavy3: '100-CC0-SFX_0/slam_03.ogg',
  soft1: '100-CC0-SFX_0/hit_01.ogg', soft2: '100-CC0-SFX_0/hit_02.ogg',
  glass1: '100-CC0-SFX_0/glass_04.ogg', glass2: '100-CC0-SFX_0/glass_05.ogg', glass3: 'sfx_100_v2/sfx100v2_glass_02.ogg',
  boom1: 'sci-fi_sounds/Audio/lowFrequency_explosion_000.ogg', boom2: 'sci-fi_sounds/Audio/explosionCrunch_003.ogg',
  boom3: 'explosion.wav',
  punch1: 'sfx_100_v2/sfx100v2_hit_01.ogg', punch2: 'sfx_100_v2/sfx100v2_hit_02.ogg', punch3: '100-CC0-SFX_0/hit_03.ogg',
  punch4: '100-CC0-SFX_0/hit_04.ogg', crack: 'sfx_100_v2/sfx100v2_wood_hit_02.ogg', tink: 'kenney_interfaceSounds/Audio/glass_005.ogg',
  swing1: 'rpg_sound_pack/RPG Sound Pack/battle/swing.wav', swing2: 'rpg_sound_pack/RPG Sound Pack/battle/swing2.wav',
  piston: 'sfx_100_v2/sfx100v2_air_02.ogg', spring: '100-CC0-SFX_0/spring_03.ogg', button: '100-CC0-SFX_0/switch_01.ogg',
  pop: '100-CC0-SFX_0/plop_02.ogg', field: 'sci-fi_sounds/Audio/forceField_000.ogg', portal: 'sci-fi_sounds/Audio/forceField_002.ogg',
  zap: 'sci-fi_sounds/Audio/laserLarge_001.ogg', bell: '100-CC0-SFX_0/bell_01.ogg', gong: '100-CC0-SFX_0/gong_01.ogg',
  step1: 'sfx_100_v2/sfx100v2_footstep_01.ogg', step2: 'sfx_100_v2/sfx100v2_footstep_02.ogg'
};
for (let i = 1; i <= 8; i++) SFX['ouch_m' + i] = 'malevoice/slightscream-' + String([1, 3, 4, 6, 8, 9, 13, 14][i - 1]).padStart(2, '0') + '.flac';
for (const t of [1, 2, 3]) for (const k of [1, 2, 3]) SFX[`ouch_f${(t - 1) * 3 + k}`] = `rpgvoice/RPG Voice Starter Pack/Type ${t}/damaged${k}.wav`;
const LOOPS = {
  loop_thrust: 'sci-fi_sounds/Audio/thrusterFire_000.ogg', loop_motor: 'sci-fi_sounds/Audio/engineCircular_002.ogg',
  loop_hole: 'sci-fi_sounds/Audio/spaceEngineLow_000.ogg', loop_beam: 'sci-fi_sounds/Audio/spaceEngineLow_002.ogg',
  loop_wind: 'sfx_100_v2/sfx100v2_loop_ambient_02.ogg'
};
function decode(f) {
  const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-ac', '1', '-ar', '44100', '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
}
function encode(samples, out, q = 3) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', '44100', '-ac', '1', '-i', '-', '-c:a', 'libvorbis', '-q:a', String(q), out],
    { input: Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength) });
}
function trimSilence(a) {
  let s = 0, e = a.length - 1;
  while (s < e && Math.abs(a[s]) < 0.004) s++;
  while (e > s && Math.abs(a[e]) < 0.004) e--;
  return a.subarray(Math.max(0, s - 64), Math.min(a.length, e + 2205));
}
function normalize(a, peak = 0.89) {
  let m = 0; for (const v of a) m = Math.max(m, Math.abs(v));
  if (m < 1e-4) return a;
  const g = peak / m, o = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) o[i] = a[i] * g;
  return o;
}
function seamless(a, fadeSec = 0.6) {
  // last `fade` samples crossfade into the first ones, then cut them off: the loop point has no click
  const n = Math.min(Math.floor(44100 * fadeSec), Math.floor(a.length / 3));
  const out = new Float32Array(a.length - n);
  out.set(a.subarray(0, a.length - n));
  for (let i = 0; i < n; i++) {
    const t = i / n, g1 = Math.sqrt(1 - t), g2 = Math.sqrt(t);
    out[i] = a[a.length - n + i] * g1 + a[i] * g2;
  }
  return out;
}
function sounds() {
  for (const [k, f] of Object.entries(SFX)) {
    const p = path.join(S, f);
    if (!fs.existsSync(p)) { console.log('MISSING', k, f); continue; }
    encode(normalize(trimSilence(decode(p)), k.startsWith('ui_') ? 0.6 : 0.89), path.join(OUT, 'sfx', k + '.ogg'), 3);
  }
  for (const [k, f] of Object.entries(LOOPS)) encode(normalize(seamless(decode(path.join(S, f))), 0.8), path.join(OUT, 'sfx', k + '.ogg'), 2);
  console.log('sfx', Object.keys(SFX).length + Object.keys(LOOPS).length);
}

if (only === 'all' || only === 'tex') await textures();
if (only === 'all' || only === 'sky') await skies();
if (only === 'all' || only === 'models') await models();
if (only === 'all' || only === 'sfx') sounds();
let total = 0;
for (const d of ['tex', 'sky', 'models', 'sfx']) for (const f of fs.readdirSync(path.join(OUT, d))) total += fs.statSync(path.join(OUT, d, f)).size;
console.log('assets total', (total / 1048576).toFixed(1), 'MB');
