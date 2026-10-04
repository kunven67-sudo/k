// Smartphone (7.15 x 14.7 x 0.78 cm), lying screen-up. Aluminium frame, glass front + back.
// Real ways in: the USB-C charging port (watch out for the tongue in the middle) and the
// speaker / mic holes on the bottom edge. Inside: the big battery (warm when charging), the
// logic board with the chips, the camera module, the loudspeaker and the vibration motor.
// The screen really works: it shows the real time.
import * as THREE from 'three';
import { Thing, panel } from '../thing.js';
import { defMat, colorMat, drawTexture } from '../../core/materials.js';
import { sfx, vol3d, loop } from '../../core/audio.js';

const PW = 0.0715, PH = 0.0078, PL = 0.147, F = 0.0012; // width, height, length, frame thickness

export function buildPhone(game, pos, rotY = 0) {
  const ph = new Thing({ name: 'Phone', type: 'dynamic', density: 1, pos, rot: [0, rotY, 0], surface: 'glass', icon: '📱', spawnId: 'phone', tags: ['electronic', 'enterable'] });
  const xin = PW / 2 - F, zin = PL / 2 - F;
  const frameMat = defMat('phoneFrame', () => new THREE.MeshStandardMaterial({ color: 0x3b4048, metalness: 1, roughness: 0.3 }));
  const backMat = defMat('phoneBack', () => new THREE.MeshPhysicalMaterial({ color: 0x1d2a3a, roughness: 0.25, metalness: 0.2, clearcoat: 1, side: THREE.DoubleSide }));
  // back glass + front glass/screen
  ph.rbox([PW, 0.0008, PL], [0, 0.0004, 0], backMat, 0.0003, { density: 2500, cut: 'back glass' });
  ph.rbox([PW, 0.0008, PL], [0, PH - 0.0004, 0], defMat('phoneGlass', () => new THREE.MeshPhysicalMaterial({ color: 0x050608, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide })), 0.0003, { density: 2500 });
  // the live screen (a texture drawn every few seconds)
  const screenCanvas = document.createElement('canvas'); screenCanvas.width = 256; screenCanvas.height = 540;
  const screenTex = new THREE.CanvasTexture(screenCanvas); screenTex.colorSpace = THREE.SRGBColorSpace;
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 0, roughness: 0.1 });
  const sg = new THREE.PlaneGeometry(PW - 0.004, PL - 0.006); sg.rotateX(-Math.PI / 2);
  ph.geo(sg, [0, PH + 0.00005, 0], screenMat, { collide: false });
  // frame: 4 aluminium sides. Bottom edge has the USB-C port + speaker & mic holes.
  ph.box([F, PH - 0.0016, PL], [-PW / 2 + F / 2, PH / 2, 0], frameMat, { density: 2700 });
  ph.box([F, PH - 0.0016, PL], [PW / 2 - F / 2, PH / 2, 0], frameMat, { density: 2700 });
  ph.box([PW - 2 * F, PH - 0.0016, F], [0, PH / 2, -PL / 2 + F / 2], frameMat, { density: 2700 });
  const y0 = 0.0008, y1 = PH - 0.0008;
  const spk = [], mic = [];
  for (let i = 0; i < 6; i++) spk.push([0.009 + i * 0.0022, 0.0032, 0.009 + i * 0.0022 + 0.0012, 0.0044]);
  for (let i = 0; i < 2; i++) mic.push([-0.012 - i * 0.0022, 0.0032, -0.012 - i * 0.0022 + 0.0012, 0.0044]);
  panel(ph, { axis: 'z', at: PL / 2 - F / 2, rect: [-PW / 2 + F, y0, PW / 2 - F, y1], thick: F, m: frameMat,
    holes: [[-0.0042, 0.0026, 0.0042, 0.0052], ...spk, ...mic], o: { density: 2700 } });
  // side buttons
  ph.box([0.0008, 0.002, 0.016], [-PW / 2 - 0.0003, PH / 2, -0.035], frameMat, { collide: false });
  ph.box([0.0008, 0.002, 0.011], [PW / 2 + 0.0003, PH / 2, -0.03], frameMat, { collide: false });
  ph.box([0.0008, 0.002, 0.011], [PW / 2 + 0.0003, PH / 2, -0.016], frameMat, { collide: false });
  // camera bump on the back (outside) + lenses
  ph.rbox([0.03, 0.0015, 0.03], [-0.0175, -0.0006, -0.052], backMat, 0.004, { density: 2500, cut: 'back glass' });
  for (const [x, z] of [[-0.0245, -0.0445], [-0.0245, -0.0595], [-0.0105, -0.052]]) {
    ph.cyl(0.0058, 0.0018, [x, -0.0012, z], 'chrome', { density: 2500, cut: 'back glass' });
    ph.cyl(0.0046, 0.0002, [x, -0.0022, z], 'lens', { collide: false, cut: 'back glass' });
  }

  // ---------- inside ----------
  // USB-C port: metal shell + the tongue in the middle (real: only ~1 mm of space above/below it)
  ph.box([0.0088, 0.0003, 0.007], [0, 0.0054, zin - 0.0035], 'steel', { density: 7800 });
  ph.box([0.0088, 0.0003, 0.007], [0, 0.0024, zin - 0.0035], 'steel', { density: 7800 });
  ph.box([0.0066, 0.0007, 0.0045], [0, 0.0039, zin - 0.0045], colorMat(0x1a1a1a, 0.6), { density: 2000 });
  // battery (the biggest thing inside)
  const battMat = defMat('phoneBatt', () => new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.5, metalness: 0.4 }));
  ph.rbox([0.062, 0.0042, 0.072], [0.0015, 0.0008 + 0.0021, 0.022], battMat, 0.001, { density: 2500, warm: 1 });
  ph.box([0.04, 0.00005, 0.02], [0.0015, 0.0051, 0.022], drawLabelMat(), { collide: false });
  // logic board (top) with shielded chips
  ph.box([0.05, 0.0009, 0.05], [0.006, 0.0018, -0.045], 'pcb', { density: 1800 });
  ph.box([0.013, 0.0012, 0.013], [0.012, 0.0028, -0.04], 'steel', { density: 3000, hot: 0.5 }); // SoC shield
  ph.box([0.01, 0.001, 0.008], [0.016, 0.0027, -0.058], 'chip', { density: 2000 });
  ph.box([0.008, 0.001, 0.008], [0.022, 0.0027, -0.026], 'chip', { density: 2000 });
  for (let i = 0; i < 10; i++) ph.box([0.0012, 0.0006, 0.0006], [0.0 + (i % 5) * 0.003, 0.0026, -0.025 - Math.floor(i / 5) * 0.003], colorMat(0xb08d57, 0.5), { collide: false });
  // camera module (from inside you see the lens barrels sitting over the image sensor)
  for (const [x, z] of [[-0.0245, -0.0445], [-0.0245, -0.0595], [-0.0105, -0.052]]) {
    ph.cyl(0.0052, 0.0042, [x, 0.0028, z], 'darkAlu', { density: 2700 });
    ph.cyl(0.0035, 0.0002, [x, 0.0050, z], 'lens', { collide: false });
  }
  // loudspeaker + vibration motor at the bottom
  ph.box([0.016, 0.0035, 0.01], [0.017, 0.0026, zin - 0.009], colorMat(0x2a2c30, 0.7), { density: 2000 });
  ph.box([0.012, 0.0002, 0.007], [0.017, 0.0045, zin - 0.009], colorMat(0x5a5e66, 0.5), { collide: false, group: 'speaker', pivot: [0.017, 0.0045, zin - 0.009] });
  ph.box([0.03, 0.0032, 0.008], [-0.018, 0.0024, zin - 0.01], 'steel', { density: 5000, group: 'taptic', pivot: [-0.018, 0.0024, zin - 0.01] });
  // flex cables
  ph.box([0.006, 0.0001, 0.02], [-0.006, 0.0052, -0.012], colorMat(0xd09a3a, 0.5), { collide: false });
  ph.box([0.005, 0.0001, 0.03], [0.026, 0.0012, 0.04], colorMat(0xd09a3a, 0.5), { collide: false });

  ph.build(game.engine.scene);
  ph.enclosure = new THREE.Box3(new THREE.Vector3(-xin, 0.0008, -zin), new THREE.Vector3(xin, PH - 0.0008, zin));
  ph.screen = { canvas: screenCanvas, tex: screenTex, mat: screenMat, t: 0 };
  ph.battery = 0.64; ph.charging = false; ph.ringT = 0; ph.wake = 0;
  ph.behaviors.push(phoneBehavior);
  if (!game.phone) game.phone = ph;
  drawScreen(ph);
  return ph;
}

function drawLabelMat() {
  return defMat('battLabel', () => new THREE.MeshStandardMaterial({ map: drawTexture(256, 128, (c, w, h) => {
    c.fillStyle = '#20232a'; c.fillRect(0, 0, w, h); c.fillStyle = '#d8dce2'; c.font = 'bold 18px sans-serif';
    c.fillText('Li-ion Polymer Battery', 10, 30); c.font = '13px sans-serif';
    c.fillText('3.85V  4352mAh  16.75Wh', 10, 56); c.fillText('Do not puncture or heat', 10, 80); c.fillText('⚠  🔥  ♻', 10, 108);
  }, 'battLabelTex'), roughness: 0.6 }));
}

export function drawScreen(ph) {
  const c = ph.screen.canvas.getContext('2d'), w = c.canvas.width, h = c.canvas.height;
  const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#1b2d55'); g.addColorStop(1, '#5a2a63');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  const now = new Date();
  c.fillStyle = '#fff'; c.textAlign = 'center';
  c.font = '600 18px sans-serif';
  c.fillText(now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }), w / 2, 90);
  c.font = '200 84px sans-serif';
  c.fillText(now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M/i, ''), w / 2, 175);
  c.font = '14px sans-serif'; c.textAlign = 'left';
  c.fillText(`${Math.round(ph.battery * 100)}%${ph.charging ? ' ⚡' : ''}`, w - 60, 22);
  if (ph.notification) {
    c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.roundRect(12, 230, w - 24, 70, 14); c.fill();
    c.fillStyle = '#fff'; c.font = 'bold 14px sans-serif'; c.fillText(ph.notification.from, 24, 255);
    c.font = '13px sans-serif'; c.fillText(ph.notification.text.slice(0, 34), 24, 278);
  }
  ph.screen.tex.needsUpdate = true;
}

const _v = new THREE.Vector3();
const phoneBehavior = {
  update(ph, dt, game) {
    ph.wake = Math.max(0, ph.wake - dt);
    ph.screen.mat.emissiveIntensity = ph.wake > 0 || ph.ringT > 0 ? 1.1 : 0;
    ph.screen.t -= dt;
    if (ph.screen.t <= 0 && ph.screen.mat.emissiveIntensity > 0) { ph.screen.t = 5; drawScreen(ph); }
    // ringing: the loudspeaker pumps and the vibration motor buzzes (feel it when inside!)
    ph.ringT = Math.max(0, ph.ringT - dt);
    const ring = ph.ringT > 0;
    const k = Math.sin(game.time * 90);
    for (const m of ph.meshes?.speaker || []) m.position.y = 0.0045 + (ring ? k * 0.00015 : 0);
    for (const m of ph.meshes?.taptic || []) m.position.x = -0.018 + (ring && Math.sin(game.time * 6) > 0 ? k * 0.0003 : 0);
    if (ring && ph.body && Math.sin(game.time * 6) > 0) ph.body.applyImpulse({ x: (Math.random() - 0.5) * 0.0004, y: 0.0002, z: (Math.random() - 0.5) * 0.0004 }, true);
    const p = game.player;
    if (game.micro) return;
    const local = ph.group.worldToLocal(p.center(_v.clone()));
    if (ph.enclosure.containsPoint(local)) {
      game.inside = ph; game.insideEcho = 0.2;
      if (ring) p.shake = Math.max(p.shake, 0.8);
    }
    if (!ph.snd) ph.snd = loop('hum');
    const d = ph.position(_v).distanceTo(p.feet);
    ph.snd.set(ring && Math.sin(game.time * 6) > 0 ? vol3d(d, 0.6, p.s) * 0.5 : 0, 3.2);
    if (ring && Math.random() < dt * 4) sfx.beep(880 + Math.random() * 300, 0.12, vol3d(d, 0.3, p.s));
  },
};

// Somebody texts you: the phone lights up, buzzes and shows the message.
export function phoneNotify(game, from, text) {
  const ph = game.phone; if (!ph) return;
  ph.notification = { from, text };
  ph.wake = 8; ph.ringT = 1.2; drawScreen(ph);
  game.ui.toast(`📱 ${from}: ${text}`);
}
