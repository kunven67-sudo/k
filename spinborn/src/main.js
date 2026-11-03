// SPINBORN main: space room, wheel, lever console, mirror, menus (GS3 kit on PC, panels in VR), the game loop.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Wheel3D, glowTexture } from './wheel3d.js';
import { Panel, menuPanel, Interact, KeyboardPanel, theme } from './ui3d.js';
import { Audio } from './audio.js';
import { MemePop, wait } from './meme3d.js';
import { createBrain, READY_COMMENTS, runScore } from './brain.js';
import { runFlow, newCharacter, tierLabel } from './flow.js';
import { Character } from './character.js';
import { drawCard, drawExplain, cardScene } from './card.js';
import { loadFonts, drawText, wrap, FONT, roundRect, fmtYears } from './text.js';
import { Store } from './save.js';
import { XRInput } from './xr.js';

const S = Store.settings();
const audio = new Audio('assets/');
audio.vol.music = S.music; audio.vol.sfx = S.sfx;
const ui = document.getElementById('ui');
const isQuest = /OculusBrowser|Quest/i.test(navigator.userAgent);

// ---------------- renderer + scene ----------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
function pixelRatio() { return S.quality === 'low' ? 0.75 : S.quality === 'high' ? Math.min(2, devicePixelRatio) : Math.min(1.5, devicePixelRatio); }
renderer.setPixelRatio(pixelRatio()); renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local-floor');
if (renderer.xr.setFoveation) renderer.xr.setFoveation(0.6);
document.getElementById('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x020308);
const pmrem = new THREE.PMREMGenerator(renderer);
const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.03, 300);
const rig = new THREE.Group(); rig.add(camera); scene.add(rig);
const PC_CAM = new THREE.Vector3(0, 1.62, 1.05);
camera.position.copy(PC_CAM); camera.lookAt(0, 1.9, -3.8);
scene.add(new THREE.HemisphereLight(0x8fa8ff, 0x140c18, 1.1));
const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(2, 5, 3); scene.add(key);

// stars + nebula + platform (dark space like his videos)
(function buildSpace() {
  const n = 3200, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 60 + Math.random() * 60, s = Math.sqrt(1 - u * u);
    pos[i * 3] = Math.cos(th) * s * r; pos[i * 3 + 1] = u * r * 0.7 + 10; pos[i * 3 + 2] = Math.sin(th) * s * r;
    const c = new THREE.Color().setHSL(0.55 + Math.random() * 0.2, 0.5, 0.65 + Math.random() * 0.35); col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const dot = document.createElement('canvas'); dot.width = dot.height = 32; const dg = dot.getContext('2d'); const gr = dg.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); dg.fillStyle = gr; dg.fillRect(0, 0, 32, 32);
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.45, map: new THREE.CanvasTexture(dot), vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true }));
  scene.add(stars);
  const fog = document.createElement('canvas'); fog.width = fog.height = 256; const fg = fog.getContext('2d'); const fgr = fg.createRadialGradient(128, 128, 0, 128, 128, 128);
  fgr.addColorStop(0, 'rgba(255,255,255,0.5)'); fgr.addColorStop(1, 'rgba(255,255,255,0)'); fg.fillStyle = fgr; fg.fillRect(0, 0, 256, 256);
  const ft = new THREE.CanvasTexture(fog);
  [[-30, 12, -60, 0x3a2a8a, 60], [34, 6, -55, 0x7a1f5a, 52], [0, 26, -70, 0x1f4a8a, 70], [-50, -5, -20, 0x2a5a6a, 50], [55, 20, 10, 0x4a1a6a, 60], [0, -20, -40, 0x101a4a, 70]].forEach(([x, y, z, c, s]) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ft, color: c, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.position.set(x, y, z); sp.scale.set(s, s, 1); scene.add(sp);
  });
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.7, 0.12, 64), new THREE.MeshStandardMaterial({ color: 0x15171d, metalness: 0.8, roughness: 0.35, envMap }));
  plat.position.y = -0.06; scene.add(plat);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.02, 8, 96), new THREE.MeshBasicMaterial({ color: 0x5f7dff, toneMapped: false }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.005; scene.add(ring);
  const grid = new THREE.Mesh(new THREE.RingGeometry(0.6, 2.4, 64, 1), new THREE.MeshBasicMaterial({ color: 0x2a3a7a, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
  grid.rotation.x = -Math.PI / 2; grid.position.y = 0.004; scene.add(grid);
})();

// ---------------- wheel + board ----------------
const WHEEL_POS = new THREE.Vector3(0, 1.9, -3.8);
const wheel = new Wheel3D({ radius: 1.55, envMap, audio, onTick: (slow) => audio.tick(slow) });
wheel.group.position.copy(WHEEL_POS); scene.add(wheel.group);
wheel.setWheel({ id: 'idle', q: 'SPINBORN', color: 'rainbow', slices: 'SPINBORN'.split('').map(ch => ({ label: ch, w: 1 })) }, Array(8).fill(1));
let idleSpin = true;

const board = new Panel({ w: 3.6, h: 0.98, ppm: 420, name: 'board' });
board.state = { q: 'SPINBORN', a: '', sub: '', gold: false };
board.render = (g, W, H) => {
  const st = board.state;
  g.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(g, 0, 0, W, H, 40); g.fill();
  g.textAlign = 'center';
  g.font = `800 96px ${FONT}`; const lines = wrap(g, st.q, W - 120).slice(0, 2);
  const lh = 104, top = lines.length > 1 ? 112 : 150;
  lines.forEach((l, i) => drawText(g, l, W / 2, top + i * lh, { size: 96, weight: 800, align: 'center', color: '#fff' }));
  const lw = Math.min(W - 120, Math.max(...lines.map(l => (g.font = `800 96px ${FONT}`, g.measureText(l).width))));
  const uy = top + (lines.length - 1) * lh + 30;
  g.fillStyle = 'rgba(200,200,200,0.75)'; g.fillRect(W / 2 - lw / 2, uy, lw, 8);
  if (st.sub) drawText(g, st.sub, W / 2, uy + 64, { size: 50, weight: 700, align: 'center', color: st.gold ? '#ffd24a' : '#9fc0ff' });
  if (st.a) { g.font = `600 58px ${FONT}`; const al = wrap(g, st.a, W - 140).slice(0, 2); al.forEach((l, i) => drawText(g, l, W / 2, uy + (st.sub ? 130 : 84) + i * 64, { size: 58, weight: 600, align: 'center', color: '#fff' })); }
};
board.set = (q, a = '', sub = '', gold = false) => { board.state = { q, a, sub, gold }; board.draw(); };
board.mesh.position.set(0, 4.05, -3.86); scene.add(board.mesh); board.draw();

// comment bubble (like the TikTok reply bubble)
const bubble = new Panel({ w: 1.55, h: 0.42, ppm: 400, name: 'bubble' });
bubble.text = '';
bubble.render = (g, W, H) => {
  if (!bubble.text) return;
  g.fillStyle = 'rgba(255,255,255,0.95)'; roundRect(g, 0, 0, W, H, 34); g.fill();
  g.fillStyle = '#3d7cf0'; g.beginPath(); g.arc(70, 84, 40, 0, Math.PI * 2); g.fill();
  drawText(g, 'Y', 70, 98, { size: 44, weight: 800, align: 'center', color: '#fff' });
  drawText(g, 'Reply to your comment', 130, 66, { size: 30, weight: 700, color: '#6a7280' });
  g.font = `600 40px ${FONT}`; wrap(g, bubble.text, W - 160).slice(0, 2).forEach((l, i) => drawText(g, l, 130, 118 + i * 46, { size: 40, weight: 600, color: '#111' }));
};
bubble.mesh.position.set(-2.55, 3.55, -3.55); bubble.mesh.rotation.y = 0.45; scene.add(bubble.mesh); bubble.show(false);

const toastP = new Panel({ w: 2.6, h: 0.26, ppm: 400, name: 'toast' }); toastP.text = '';
toastP.render = (g, W, H) => { if (!toastP.text) return; g.fillStyle = 'rgba(10,12,18,0.85)'; roundRect(g, 0, 0, W, H, 40); g.fill(); drawText(g, toastP.text, W / 2, H / 2 + 2, { size: 46, weight: 700, align: 'center', base: 'middle', color: toastP.color || '#fff', maxW: W - 60 }); };
toastP.mesh.position.set(0, 0.42, -3.5); scene.add(toastP.mesh); toastP.show(false);
let toastTimer = 0;
function toast(t, color, ms = 1800) { toastP.text = t; toastP.color = color; toastP.draw(); toastP.show(true); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastP.show(false), ms); }

const chanceTag = new Panel({ w: 1.1, h: 0.2, ppm: 400, name: 'chance' }); chanceTag.text = '';
chanceTag.render = (g, W, H) => { g.fillStyle = 'rgba(0,0,0,0.82)'; roundRect(g, 0, 0, W, H, 30); g.fill(); drawText(g, chanceTag.text, W / 2, H / 2 + 2, { size: 34, weight: 700, align: 'center', base: 'middle', color: '#fff', maxW: W - 40 }); };
chanceTag.mesh.renderOrder = 20; scene.add(chanceTag.mesh); chanceTag.show(false);

// ---------------- console + lever ----------------
const consoleG = new THREE.Group(); consoleG.position.set(0, 0, -0.62); scene.add(consoleG);
const deskMat = new THREE.MeshStandardMaterial({ color: 0x1c1f26, metalness: 0.75, roughness: 0.3, envMap });
const desk = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.06, 0.42), deskMat); desk.position.set(0, 0.92, 0); desk.rotation.x = 0.32; consoleG.add(desk);
const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.9, 16), deskMat); stem.position.set(0, 0.45, 0.04); consoleG.add(stem);
const leverBase = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.2), new THREE.MeshStandardMaterial({ color: 0x9aa0aa, metalness: 1, roughness: 0.25, envMap }));
leverBase.position.set(0.5, 0.98, 0.02); consoleG.add(leverBase);
const leverPivot = new THREE.Group(); leverPivot.position.set(0.5, 1.02, 0.02); consoleG.add(leverPivot);
const leverArm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.42, 12), new THREE.MeshStandardMaterial({ color: 0xd0d4dc, metalness: 1, roughness: 0.2, envMap }));
leverArm.position.y = 0.21; leverPivot.add(leverArm);
const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 24, 16), new THREE.MeshStandardMaterial({ color: 0xd41f2a, metalness: 0.2, roughness: 0.25, envMap, emissive: 0x3a0005 }));
knob.position.y = 0.43; leverPivot.add(knob);
const knobGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(128), color: 0xff4050, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
knobGlow.scale.set(0.26, 0.26, 1); knob.add(knobGlow);
let leverAngle = 0, leverGrab = null, leverWaiting = null, leverFired = false;
const LEVER_DOWN = 1.15;

const deskPanel = new Panel({ w: 0.78, h: 0.26, ppm: 512, name: 'desk' });
deskPanel.render = (g, W, H) => { g.fillStyle = 'rgba(8,10,14,0.92)'; roundRect(g, 0, 0, W, H, 28); g.fill(); };
function layoutDesk() {
  deskPanel.clearButtons();
  const W = deskPanel.cw;
  deskPanel.button('fast', 20, 22, (W - 80) / 3, 88, 'Fast', () => { S.fast = !S.fast; Store.saveSettings(S); layoutDesk(); }, { on: S.fast, size: 34 });
  deskPanel.button('auto', 40 + (W - 80) / 3, 22, (W - 80) / 3, 88, 'Auto spin', () => { S.auto = !S.auto; Store.saveSettings(S); layoutDesk(); if (S.auto && leverWaiting) pullLever(0.8); }, { on: S.auto, size: 30 });
  deskPanel.button('menu', 60 + 2 * (W - 80) / 3, 22, (W - 80) / 3, 88, 'Menu', () => openPause(), { size: 34 });
  deskPanel.draw();
}
deskPanel.mesh.position.set(-0.18, 0.955, -0.62); deskPanel.mesh.rotation.x = -Math.PI / 2 + 0.32; scene.add(deskPanel.mesh); layoutDesk();

// ---------------- mirror pedestal ----------------
const mirrorG = new THREE.Group(); mirrorG.position.set(-2.75, 0, -3.0); mirrorG.rotation.y = 0.55; scene.add(mirrorG);
const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.25, 48), deskMat); ped.position.y = 0.125; mirrorG.add(ped);
const pedRing = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.015, 8, 64), new THREE.MeshBasicMaterial({ color: 0x8fb0ff, toneMapped: false }));
pedRing.rotation.x = Math.PI / 2; pedRing.position.y = 0.255; mirrorG.add(pedRing);
const character = new Character(); character.root.position.y = 0.25; mirrorG.add(character.root);
mirrorG.visible = false;
let mirrorBusy = null, mirrorAgain = false;
function updateMirror(C) {
  if (!S.mirror && !forceMirror) { mirrorG.visible = false; return; }
  mirrorG.visible = true;
  if (mirrorBusy) { mirrorAgain = true; return; }
  mirrorBusy = character.build(C).then(() => {
    C.skinHex = character.lookFor(C).skin || '#e8b994';
    if (xin) xin.dress(C);
  }).catch(e => console.warn('mirror', e)).finally(() => { mirrorBusy = null; if (mirrorAgain) { mirrorAgain = false; updateMirror(C); } });
}
let forceMirror = false;

// ---------------- meme pop-up ----------------
const meme = new MemePop({ audio, camera }); meme.group.position.set(0, 1.85, -2.35); scene.add(meme.group); meme.attachFlash(camera);

// ---------------- input ----------------
const interact = new Interact(camera, scene);
interact.add(knob, { onClick: () => pullLever(1), onHover: () => { knobHot = true; }, onOut: () => { knobHot = false; } });
interact.add(wheel.disc, { onHover: (hit) => showChance(hit), onOut: () => chanceTag.show(false) });
let knobHot = false;
const mouse = new THREE.Vector2(-9, -9); let mouseMoved = false;
renderer.domElement.addEventListener('pointermove', e => { mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); mouseMoved = true; });
renderer.domElement.addEventListener('pointerdown', async () => { await audio.unlock(); if (meme.state === 'in') { meme.skip = true; return; } interact.click('mouse'); });
addEventListener('keydown', async (e) => {
  await audio.unlock();
  if (e.target && e.target.tagName === 'INPUT') return;
  if (e.code === 'Space' || e.code === 'Enter') { if (meme.state === 'in') meme.skip = true; else if (leverWaiting) { pullLever(1); e.preventDefault(); } }
  if (e.code === 'KeyF') { S.fast = !S.fast; Store.saveSettings(S); layoutDesk(); toast(S.fast ? 'Fast spins ON' : 'Fast spins OFF'); }
  if (e.code === 'Escape' && mode === 'spin' && !htmlOpen()) openPause();
});
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

let xin = null;
function setupXR() {
  xin = new XRInput(renderer, rig);
  xin.onSelect = (side, down) => {
    audio.unlock();
    if (!down) return;
    if (meme.state === 'in') { meme.skip = true; return; }
    interact.click(side);
  };
}
setupXR();

function showChance(hit) {
  if (!S.chance || wheel.spinning || !wheel.weights.length) { chanceTag.show(false); return; }
  const local = wheel.group.worldToLocal(hit.point.clone());
  const i = wheel.sliceAtLocal(local.x, local.y); if (i < 0) { chanceTag.show(false); return; }
  const total = wheel.weights.reduce((a, b) => a + b, 0);
  const pct = wheel.weights[i] / total * 100;
  const txt = `${wheel.slices[i].label} · ${pct < 0.1 ? pct.toFixed(2) : pct.toFixed(1)}% chance`;
  if (chanceTag.text !== txt) { chanceTag.text = txt; chanceTag.draw(); }
  chanceTag.mesh.position.copy(hit.point).add(new THREE.Vector3(0, 0.14, 0.12));
  chanceTag.mesh.quaternion.copy(wheel.group.quaternion);
  chanceTag.show(true);
}

function pullLever(power = 1) {
  if (!leverWaiting || leverFired) return;
  leverFired = true; audio.lever(); leverAngle = LEVER_DOWN;
  const r = leverWaiting; leverWaiting = null; r(power);
}
function waitLever() {
  leverFired = false;
  return new Promise(res => {
    leverWaiting = res;
    if (S.auto) setTimeout(() => { if (leverWaiting === res) pullLever(0.8); }, S.fast ? 350 : 700);
  });
}

// ---------------- the game ----------------
let mode = 'title', C = null, brain = null, recapLog = [];
const io = {
  async spin(def, idx, weights, ctx) {
    idleSpin = false;
    const sub = ctx.sub || (def.gold ? 'GOLDEN SPIN' : '');
    board.set(def.q, '', sub, def.gold);
    wheel.setWheel(def, weights);
    if (def.gold) { audio.golden(); toast('GOLDEN SPIN: only the top slices!', '#ffd24a', 2200); await wait(500); }
    const power = await waitLever();
    await wheel.spinTo(idx, { fast: S.fast, power });
    const res = def.slices[idx];
    board.set(def.q, res.label, sub, def.gold);
    audio.reveal(def.gold || (def.tiered && idx >= def.slices.length * 0.8));
    const pick = new Set([idx]); while (pick.size < Math.min(24, def.slices.length)) pick.add(Math.floor(Math.random() * def.slices.length));
    const labels = [...pick].sort((a, b) => a - b);
    recapLog.push({ q: def.q, sub, color: def.color, gold: !!def.gold, labels: labels.map(i => def.slices[i].label), w: labels.map(i => weights[i]), r: labels.indexOf(idx) });
    await wait(S.fast ? 380 : 950);
  },
  async react(e) {
    const d = brain.decide(e);
    if (!d) return;
    if (d.flash && S.flash !== 'off') { await meme.flashbang(S.flash === 'soft' ? 0.55 : 1); }
    else if (d.flash) await meme.flashbang(0);
    const last = recapLog[recapLog.length - 1]; if (last) (last.memes = last.memes || []).push({ ...d, C: undefined });
    await meme.show(d);
  },
  async number(title, years, label) {
    const t0 = performance.now();
    while (performance.now() - t0 < (S.fast ? 500 : 1300)) { board.set(title, fmtYears(Math.floor(Math.random() * years * 1.3) + 1), label); audio.tick(0.5); await wait(70); }
    board.set(title, fmtYears(years), label); audio.reveal(false); await wait(S.fast ? 300 : 800);
  },
  note(t) { toast(t); },
  mirror(c) { updateMirror(c); }
};

async function play(gender) {
  await audio.unlock();
  C = newCharacter(gender, ''); brain = createBrain(); recapLog = [];
  audio.playMusic('music_spin');
  const comment = await askComment();
  C.comment = comment;
  bubble.text = comment || '(no comment)'; bubble.draw(); bubble.show(true);
  mode = 'spin'; forceMirror = false;
  mirrorG.visible = S.mirror; if (S.mirror) updateMirror(C);
  await io.react({ type: 'comment', text: comment });
  await runFlow(C, io);
  const sc = runScore(C);
  audio.playMusic(sc > 0.6 ? 'music_intense' : 'music_spin');
  await io.react({ type: 'end', score: sc, short: C.spins < 26 });
  C.recap = recapLog;
  if (!Store.saveChar(C)) { C.recap = recapLog.map(r => ({ ...r, labels: r.labels.slice(0, 6), w: r.w.slice(0, 6), r: Math.min(r.r, 5) })); Store.saveChar(C); }
  await showCard(C);
}

// ---------------- card ----------------
const cardPanel = new Panel({ w: 1.3, h: 1.3 * 1600 / 1080, ppm: 830.77, name: 'card' });
const cardCanvas = document.createElement('canvas'), explainCanvas = document.createElement('canvas');
cardPanel.render = (g, W, H) => { g.drawImage(cardPanel.page === 0 ? cardCanvas : explainCanvas, 0, 0, W, H); };
cardPanel.mesh.position.set(0, 1.78, -2.1); scene.add(cardPanel.mesh); cardPanel.show(false);
let cardRT = null, pendingArt = null;
async function renderCardArt(C) {
  const ch = new Character(); await ch.build(C, { pose: C.dead ? 'Death_A_Pose' : pickPose(C) });
  ch.update(0.5); ch.update(0.5);
  const { scene: cs, cam } = cardScene(C, ch);
  return new Promise(res => { pendingArt = { cs, cam, ch, res }; });
}
function pickPose(C) { const w = C.weapon || ''; if (C.powers.length && Math.random() < 0.5) return 'Spellcast_Raise'; if (/sword|axe|hammer|blade/i.test(w)) return '2H_Melee_Idle'; return 'Cheer'; }
function doPendingArt() {
  if (!pendingArt) return;
  const { cs, cam, ch, res } = pendingArt; pendingArt = null;
  if (!cardRT) cardRT = new THREE.WebGLRenderTarget(1080, 1600, { colorSpace: THREE.SRGBColorSpace });
  const xrOn = renderer.xr.enabled; renderer.xr.enabled = false;
  renderer.setRenderTarget(cardRT); renderer.render(cs, cam); renderer.setRenderTarget(null);
  renderer.xr.enabled = xrOn;
  const px = new Uint8Array(1080 * 1600 * 4); renderer.readRenderTargetPixels(cardRT, 0, 0, 1080, 1600, px);
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1600; const g = c.getContext('2d'); const img = g.createImageData(1080, 1600);
  for (let y = 0; y < 1600; y++) img.data.set(px.subarray((1599 - y) * 4320, (1600 - y) * 4320), y * 4320);
  g.putImageData(img, 0, 0);
  res(c);
}
let cardC = null, explainPages = 1;
async function showCard(c) {
  mode = 'card'; cardC = c; idleSpin = true;
  audio.playMusic('music_card');
  board.set(c.dead ? 'Your run is over' : 'Your character', c.dead ? c.death : c.worldLabel ? `World: ${c.worldLabel}` : '', '');
  const art = await renderCardArt(c);
  drawCard(cardCanvas, c, art); explainPages = drawExplain(explainCanvas, c, 0);
  cardPanel.page = 0; cardPanel.draw(); cardPanel.show(true);
  if (inXR()) cardPanel.mesh.position.set(-0.1, 1.5, -1.45); else cardPanel.mesh.position.set(-0.34, 1.6, -0.72);
  bubble.show(false);
  cardMenu();
}
function cardMenu() {
  const items = [
    { label: cardPanel.page === 0 ? 'What everything does' : 'Show the card', onClick: () => { cardPanel.page = cardPanel.page === 0 ? 1 : 0; explainPage = 0; if (cardPanel.page) drawExplain(explainCanvas, cardC, 0); cardPanel.draw(); cardMenu(); } },
  ];
  if (cardPanel.page === 1 && explainPages > 1) items.push({ label: `Next page (${explainPage + 1}/${explainPages})`, onClick: () => { explainPage = (explainPage + 1) % explainPages; drawExplain(explainCanvas, cardC, explainPage); cardPanel.draw(); cardMenu(); } });
  items.push({ label: 'Recap of the run', sub: 'A fast replay of every spin + meme', onClick: () => recap(cardC, false) });
  if (!inXR()) {
    items.push({ label: 'Save the card picture', onClick: () => savePicture() });
    items.push({ label: 'Save the recap as a video', onClick: () => recap(cardC, true) });
  }
  items.push({ label: 'New character', primary: true, onClick: () => { cardPanel.show(false); genderMenu(); } });
  items.push({ label: 'Back to the menu', onClick: () => { cardPanel.show(false); titleMenu(); } });
  showMenu({ title: cardC.dead ? 'DEAD' : (cardC.title || 'Your character'), sub: cardC.dead ? cardC.death : `${cardC.race}${cardC.worldLabel ? ' · ' + cardC.worldLabel : ''}. The worlds open in Part 2: this character is saved and waits there.`, items, side: true });
}
let explainPage = 0;
function savePicture() {
  const a = document.createElement('a'); a.download = `SPINBORN ${(cardC.title || 'card').replace(/[^\w ]/g, '')}.png`;
  a.href = (cardPanel.page === 0 ? cardCanvas : explainCanvas).toDataURL('image/png'); a.click();
  toast('Saved to your Downloads');
}

// ---------------- recap ----------------
let recapping = false;
async function recap(c, record) {
  if (recapping) return; recapping = true;
  closeMenus(); cardPanel.show(false);
  const log = c.recap || [];
  let rec = null, chunks = [];
  if (record && renderer.domElement.captureStream && window.MediaRecorder) {
    const vs = renderer.domElement.captureStream(30);
    try { await audio.unlock(); const dest = audio.ctx.createMediaStreamDestination(); audio.master.connect(dest); dest.stream.getAudioTracks().forEach(t => vs.addTrack(t)); } catch (e) { }
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
    rec = new MediaRecorder(vs, mime ? { mimeType: mime, videoBitsPerSecond: 6e6 } : undefined); rec.ondataavailable = e => e.data.size && chunks.push(e.data); rec.start(250);
  }
  bubble.text = c.comment || '(no comment)'; bubble.draw(); bubble.show(true);
  forceMirror = true; mirrorG.visible = true;
  const C2 = newCharacter(c.gender, c.comment); C2.race = c.race; C2.raceLook = c.raceLook; C2.parents = c.parents; C2.height = c.height; C2.weapon = c.weapon; C2.auraColor = c.auraColor; C2.armor = c.armor;
  updateMirror(C2);
  for (const e of log) {
    board.set(e.q, '', e.sub, e.gold);
    wheel.setWheel({ id: 'recap', q: e.q, color: e.color, gold: e.gold, slices: e.labels.map(l => ({ label: l })) }, e.w);
    await wheel.spinTo(e.r, { fast: true });
    board.set(e.q, e.labels[e.r], e.sub, e.gold);
    await wait(260);
    for (const m of (e.memes || [])) { if (m.flash) await meme.flashbang(S.flash === 'off' ? 0 : S.flash === 'soft' ? 0.55 : 1); await meme.show(m, { hold: 1.3 }); }
  }
  if (rec) { await wait(400); rec.stop(); await new Promise(r => rec.onstop = r); const blob = new Blob(chunks, { type: 'video/webm' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `SPINBORN recap ${(c.title || '').replace(/[^\w ]/g, '')}.webm`; a.click(); toast('Recap video saved to your Downloads'); }
  recapping = false; forceMirror = false;
  await showCard(c);
}

// ---------------- comment ----------------
function askComment() {
  return new Promise(res => {
    if (inXR()) {
      closeMenus();
      const kb = new KeyboardPanel({ suggestions: READY_COMMENTS, onDone: (t) => { kb.show(false); scene.remove(kb.mesh); kb.dispose(); res(t); } });
      kb.mesh.position.set(0, 1.3, -1.0); kb.mesh.rotation.x = -0.35; scene.add(kb.mesh);
      const blink = setInterval(() => { if (!kb.mesh.parent) clearInterval(blink); else kb.draw(); }, 500);
      return;
    }
    const sc = htmlScreen();
    sc.innerHTML = `<div class="gs3-panel sb-wide"><h1 class="gs3-title">Comment what you think you're gonna be</h1>
      <p class="gs3-sub">Like the TikTok comments. The wheel will answer.</p>
      <input class="sb-input" id="cm" maxlength="90" placeholder="I'm gonna be the best" autocomplete="off">
      <div class="gs3-menu sb-grid">${READY_COMMENTS.map((t, i) => `<button class="gs3-item" data-i="${i}">${esc(t)}</button>`).join('')}</div>
      <div class="gs3-row"><button class="gs3-btn" id="cmskip">Skip</button><button class="gs3-btn primary" id="cmok">Post</button></div></div>`;
    const inp = sc.querySelector('#cm');
    sc.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { inp.value = READY_COMMENTS[+b.dataset.i]; inp.focus(); });
    const done = (t) => { closeMenus(); res(t); };
    sc.querySelector('#cmok').onclick = () => done(inp.value.trim());
    sc.querySelector('#cmskip').onclick = () => done('');
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') done(inp.value.trim()); });
    nav = window.GS3Console ? GS3Console.nav(sc, {}) : null;
    setTimeout(() => inp.focus(), 50);
  });
}

// ---------------- menus (GS3 kit on PC, panels in VR) ----------------
let nav = null, menu3d = null, currentMenu = null;
const FAKE_XR = /[?&]vrui=1/.test(location.search); // test only: VR menus on a normal screen
function inXR() { return renderer.xr.isPresenting || FAKE_XR; }
function htmlOpen() { return !!ui.firstChild; }
function closeMenus() {
  if (nav && nav.stop) nav.stop(); nav = null; ui.innerHTML = '';
  if (menu3d) { scene.remove(menu3d.mesh); menu3d.dispose(); menu3d = null; }
}
function htmlScreen(side) { closeMenus(); const sc = document.createElement('div'); sc.className = 'gs3-screen' + (side ? ' sb-side' : ''); ui.appendChild(sc); return sc; }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
function showMenu(model) {
  currentMenu = model;
  closeMenus();
  if (inXR()) {
    menu3d = menuPanel(model, { w: 1.2 });
    if (model.side) { menu3d.mesh.position.set(1.15, 1.45, -1.55); menu3d.mesh.rotation.y = -0.45; }
    else { menu3d.mesh.position.set(0, 1.45, -1.3); }
    scene.add(menu3d.mesh);
    return;
  }
  const sc = htmlScreen(model.side);
  const panel = document.createElement('div'); panel.className = 'gs3-panel';
  panel.innerHTML = `<h1 class="gs3-title">${esc(model.title)}</h1>${model.sub ? `<p class="gs3-sub">${esc(model.sub)}</p>` : ''}<div class="gs3-menu"></div>`;
  const list = panel.querySelector('.gs3-menu');
  model.items.forEach(it => {
    const b = document.createElement('button'); b.className = 'gs3-item' + (it.primary ? ' sb-primary' : '');
    b.innerHTML = `${esc(it.label)}${it.value != null ? `<span class="gs3-value">${esc(it.value)}</span>` : ''}${it.sub ? `<small class="sb-small">${esc(it.sub)}</small>` : ''}`;
    b.onclick = () => { audio.unlock(); it.onClick && it.onClick(); };
    list.appendChild(b);
  });
  sc.appendChild(panel);
  nav = window.GS3Console ? GS3Console.nav(sc, { back: model.back }) : null;
}

function titleMenu() {
  mode = 'title'; idleSpin = true; cardPanel.show(false); bubble.show(false); mirrorG.visible = false;
  board.set('SPINBORN', 'Spin the wheels. Become whatever they say.');
  wheel.setWheel({ id: 'idle', q: 'SPINBORN', color: 'rainbow', slices: 'SPINBORN'.split('').map(ch => ({ label: ch, w: 1 })) }, Array(8).fill(1));
  const n = Store.chars().length;
  const items = [
    { label: 'New character', primary: true, onClick: () => genderMenu() },
    { label: 'My characters', value: String(n), onClick: () => charsMenu() },
    { label: 'Settings', onClick: () => settingsMenu(() => titleMenu()) }
  ];
  if (xrSupported && !inXR()) items.splice(1, 0, { label: 'Play in VR', sub: isQuest ? 'Put on the headset view' : 'Needs a VR headset', onClick: () => enterVR() });
  showMenu({ title: 'SPINBORN', sub: 'The wheel decides your race, your powers, your whole life. Then you enter the world.', items });
}
function genderMenu() {
  showMenu({ title: 'Boy or girl?', sub: 'You pick this. The wheels decide everything else.', back: () => titleMenu(), items: [
    { label: 'Boy', primary: true, onClick: () => { closeMenus(); play('boy'); } },
    { label: 'Girl', primary: true, onClick: () => { closeMenus(); play('girl'); } },
    { label: 'Back', onClick: () => titleMenu() }
  ] });
}
function charsMenu() {
  const list = Store.chars();
  const items = list.slice(0, 10).map(c => ({
    label: c.title || c.race || 'Character', sub: `${c.race}${c.parents ? ` (${c.parents.join(' + ')})` : ''} · ${c.dead ? 'DEAD' : c.worldLabel || ''}`,
    onClick: () => charMenu(c)
  }));
  items.push({ label: 'Back', onClick: () => titleMenu() });
  showMenu({ title: 'My characters', sub: list.length ? `${list.length} saved` : 'Nothing yet. Make a new character!', items, back: () => titleMenu() });
}
function charMenu(c) {
  showMenu({ title: c.title || c.race, sub: `${c.race} · ${c.dead ? c.death : c.worldLabel || ''}`, back: () => charsMenu(), items: [
    { label: 'Show the card', primary: true, onClick: () => { closeMenus(); showCard(c); } },
    { label: 'Recap of the run', onClick: () => recap(c, false) },
    { label: 'Delete', onClick: () => showMenu({ title: 'Delete this character?', sub: 'This can\'t be undone.', items: [
      { label: 'Delete', onClick: () => { Store.remove(c.id); charsMenu(); } }, { label: 'Cancel', primary: true, onClick: () => charMenu(c) }] }) },
    { label: 'Back', onClick: () => charsMenu() }
  ] });
}
function settingsMenu(back) {
  const onoff = v => (v ? 'On' : 'Off');
  const flip = (k) => () => { S[k] = !S[k]; Store.saveSettings(S); layoutDesk(); if (k === 'mirror') { mirrorG.visible = S.mirror && mode === 'spin'; if (S.mirror && C && mode === 'spin') updateMirror(C); } settingsMenu(back); };
  const cycle = (k, vals, label) => () => { S[k] = vals[(vals.indexOf(S[k]) + 1) % vals.length]; Store.saveSettings(S); apply(k); settingsMenu(back); };
  const apply = (k) => { if (k === 'music') audio.setVolume('music', S.music); if (k === 'sfx') audio.setVolume('sfx', S.sfx); if (k === 'quality') { renderer.setPixelRatio(pixelRatio()); renderer.setSize(innerWidth, innerHeight); } };
  const vol = v => Math.round(v * 100) + '%';
  showMenu({ title: 'Settings', back, items: [
    { label: 'Fast spins', value: onoff(S.fast), onClick: flip('fast') },
    { label: 'Auto spin (no lever)', value: onoff(S.auto), onClick: flip('auto') },
    { label: 'Watch yourself change (mirror)', value: onoff(S.mirror), onClick: flip('mirror') },
    { label: 'Point at a slice = % chance', value: onoff(S.chance), onClick: flip('chance') },
    { label: 'Flashbang', value: { full: 'Full', soft: 'Soft', off: 'Sound only' }[S.flash], onClick: cycle('flash', ['full', 'soft', 'off']) },
    { label: 'Music', value: vol(S.music), onClick: cycle('music', [0, 0.25, 0.45, 0.7, 1]) },
    { label: 'Sounds', value: vol(S.sfx), onClick: cycle('sfx', [0, 0.35, 0.6, 0.9, 1]) },
    ...(inXR() ? [] : [{ label: 'Graphics', value: { auto: 'Auto', low: 'Low', high: 'Ultra' }[S.quality], onClick: cycle('quality', ['auto', 'low', 'high']) }]),
    { label: 'Done', primary: true, onClick: back }
  ] });
}
function openPause() {
  if (mode !== 'spin') return;
  showMenu({ title: 'Paused', sub: 'The wheel waits for you.', back: () => closeMenus(), items: [
    { label: 'Resume', primary: true, onClick: () => closeMenus() },
    { label: 'Settings', onClick: () => settingsMenu(() => openPause()) },
    { label: 'Quit to the menu', sub: 'This run won\'t be saved', onClick: () => location.reload() }
  ] });
}

// ---------------- VR session ----------------
let xrSupported = false;
async function enterVR() {
  try {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
    await audio.unlock();
    session.addEventListener('end', () => { camera.position.copy(PC_CAM); camera.rotation.set(0, 0, 0); camera.lookAt(0, 1.9, -3.8); if (currentMenu) showMenu(currentMenu); });
    await renderer.xr.setSession(session);
    if (currentMenu) showMenu(currentMenu);
  } catch (e) { toast('VR could not start: ' + (e.message || e)); }
}

// ---------------- loop ----------------
let lastT = performance.now();
const tmpV = new THREE.Vector3();
renderer.setAnimationLoop((t, frame) => {
  const nowMs = performance.now(); const dt = Math.min(0.05, (nowMs - lastT) / 1000); lastT = nowMs; const now = nowMs / 1000;
  if (idleSpin && !wheel.spinning) wheel.angle -= dt * 0.25;
  wheel.update(dt, now); meme.update(dt); character.update(dt);
  // lever spring back + glow while waiting
  if (!leverGrab) leverAngle = Math.max(0, leverAngle - dt * 2.6);
  leverPivot.rotation.x = leverAngle;
  knobGlow.material.opacity = leverWaiting ? 0.45 + Math.sin(now * 6) * 0.25 : (knobHot ? 0.3 : 0);
  // pointer input
  if (renderer.xr.isPresenting) {
    for (const side of xin.list()) {
      const { o, d } = xin.ray(side);
      const r = interact.hover(side.handedness, o, d);
      side.laser.userData.setLength(r ? r.hit.distance : 3);
      side.laser.visible = !leverGrab || leverGrab.side !== side;
      // grab the lever with squeeze or trigger when the hand is close to the knob
      const gp = xin.gripPos(side); knob.getWorldPosition(tmpV);
      const near = gp.distanceTo(tmpV) < 0.13;
      const holding = xin.pressed(side, 1) || xin.pressed(side, 0);
      if (!leverGrab && near && holding && leverWaiting) { leverGrab = { side, y0: gp.y }; xin.pulse(side, 0.3, 30); }
      if (leverGrab && leverGrab.side === side) {
        if (!holding) leverGrab = null;
        else {
          leverAngle = Math.max(0, Math.min(LEVER_DOWN, (leverGrab.y0 - gp.y) * 4.2));
          if (leverAngle > LEVER_DOWN * 0.8) { xin.pulse(side, 0.9, 80); pullLever(1.2); leverGrab = null; }
        }
      }
    }
    xin.update(); xin.endFrame();
  } else if (mouseMoved) {
    const ray = new THREE.Raycaster(); ray.setFromCamera(mouse, camera);
    interact.hover('mouse', ray.ray.origin, ray.ray.direction);
    renderer.domElement.style.cursor = knobHot || (interact.hot.get('mouse') && interact.hot.get('mouse').button) ? 'pointer' : 'default';
  }
  if (!renderer.xr.isPresenting && !FAKE_XR && !window.__sbFreeze) { camera.position.x = PC_CAM.x + Math.sin(now * 0.3) * 0.03; camera.position.y = PC_CAM.y + Math.sin(now * 0.4) * 0.015; }
  doPendingArt();
  renderer.render(scene, camera);
});

// ---------------- boot ----------------
(async function boot() {
  await loadFonts('gs3kit/fonts/');
  board.draw(); bubble.draw(); layoutDesk(); wheel.drawDisc(-1);
  if (navigator.xr && navigator.xr.isSessionSupported) { try { xrSupported = await navigator.xr.isSessionSupported('immersive-vr'); } catch (e) { } }
  document.getElementById('loading').remove();
  titleMenu();
  window.__sb = { S, io, board, wheel, meme, brain: () => brain, C: () => C, Store, character, mode: () => mode, pullLever, renderer, scene, camera, mirrorG, updateMirror, newCharacter, showCard, interact };
})();
