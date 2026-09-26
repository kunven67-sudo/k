// Inside the phone: a pixelated digital world of circuit-board streets and app-icon towers,
// patrolled by viruses. The Call app doesn't work, and the two "restore size" wires are fakes.
import * as THREE from 'three';
import { World } from '../core/physics.js';
import * as TX from '../core/textures.js';
import { ui } from '../core/ui.js';
import { sfx, playMusic, loop, setReverb } from '../core/audio.js';
import { Creature } from '../game/creature.js';
import { unlock } from '../game/achievements.js';
import { G } from '../game/state.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

class Virus extends Creature {
  constructor(color = 0xff2a6a, big = false) {
    super({ name: big ? 'Trojan' : 'Virus', hp: big ? 60 : 22, radius: big ? 1.4 : 0.8, height: big ? 2.8 : 1.6, speed: big ? 5 : 7, damage: big ? 18 : 10, deathCause: 'virus', flying: true });
    this.isVirus = true;
    this.aggroRange = 18; this.leashRange = 40;
    this.attackRange = this.body.radius + 1.1;
    this.attackDelay = 1.2;
    const s = big ? 1.7 : 1;
    const core = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.4, flatShading: true });
    const spikeM = new THREE.MeshStandardMaterial({ color: 0x220011, emissive: color, emissiveIntensity: 0.3, flatShading: true });
    this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 * s, 0), core);
    this.core.position.y = 0.9 * s;
    this.group.add(this.core);
    const ico = new THREE.IcosahedronGeometry(0.55 * s, 0);
    const pos = ico.attributes.position;
    const dirs = new Set();
    for (let i = 0; i < pos.count; i++) dirs.add(`${pos.getX(i).toFixed(2)},${pos.getY(i).toFixed(2)},${pos.getZ(i).toFixed(2)}`);
    for (const d of dirs) {
      const [x, y, z] = d.split(',').map(Number);
      const dir = V(x, y, z).normalize();
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.1 * s, 0.45 * s, 4), spikeM);
      sp.position.copy(dir.clone().multiplyScalar(0.65 * s));
      sp.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
      this.core.add(sp);
    }
    const eyeM = new THREE.MeshBasicMaterial({ color: 0xffffff });
    [-1, 1].forEach((k) => { const e = new THREE.Mesh(new THREE.BoxGeometry(0.14 * s, 0.14 * s, 0.05), eyeM); e.position.set(0.17 * k * s, 0.1 * s, 0.52 * s); this.core.add(e); });
    this.registerFlash();
    this.loot = [];
  }
  animate(dt) {
    this.core.rotation.y += dt * 2.5;
    this.core.rotation.x = Math.sin(G.time * 3 + this.home.x) * 0.3;
    this.core.position.y = 0.9 + Math.sin(G.time * 4 + this.home.z) * 0.15;
    if (Math.random() < dt * 0.3) sfx('virus', { pos: this.body.pos, ref: 6, vol: 0.5 });
  }
  onAttack() { sfx('glitch', { pos: this.body.pos, vol: 0.6 }); if (G.post) G.post.fx.glitch = Math.min(1, G.post.fx.glitch + 0.4); }
}

function iconTex(kind) {
  return TX.drawn('app_' + kind, 256, 256, (c, w, h) => {
    const bg = { phone: ['#35d45a', '#1fa33e'], messages: ['#46e06b', '#23b64a'], camera: ['#9aa3ad', '#5d6670'], photos: ['#ffffff', '#e8e8e8'], settings: ['#8e959e', '#5a616a'], maps: ['#8fd3ff', '#3da0e8'], feed: ['#111', '#000'], music: ['#ff5a7a', '#e0284e'], weather: ['#4aa8ff', '#1c6fe0'], clock: ['#111', '#222'] }[kind];
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff'; c.strokeStyle = '#fff'; c.lineWidth = 14; c.lineCap = 'round';
    const cx = w / 2, cy = h / 2;
    switch (kind) {
      case 'phone': c.beginPath(); c.moveTo(cx - 50, cy - 60); c.quadraticCurveTo(cx - 70, cy + 20, cx + 10, cy + 70); c.stroke(); c.fillRect(cx - 70, cy - 75, 34, 34); c.fillRect(cx + 5, cy + 50, 34, 34); break;
      case 'messages': c.beginPath(); c.ellipse(cx, cy - 5, 80, 62, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.moveTo(cx - 55, cy + 40); c.lineTo(cx - 75, cy + 80); c.lineTo(cx - 20, cy + 50); c.fill(); break;
      case 'camera': c.fillStyle = '#222'; c.fillRect(cx - 80, cy - 45, 160, 105); c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cy + 8, 38, 0, Math.PI * 2); c.fill(); c.fillStyle = '#333'; c.beginPath(); c.arc(cx, cy + 8, 24, 0, Math.PI * 2); c.fill(); break;
      case 'photos': ['#ff6b6b', '#ffb84a', '#ffe14a', '#5cd65c', '#4ab8ff', '#8a6bff', '#ff6bd6', '#ff8a4a'].forEach((col, i) => { c.save(); c.translate(cx, cy); c.rotate((i / 8) * Math.PI * 2); c.fillStyle = col; c.globalAlpha = 0.8; c.beginPath(); c.ellipse(0, -40, 22, 42, 0, 0, Math.PI * 2); c.fill(); c.restore(); }); break;
      case 'settings': for (let i = 0; i < 8; i++) { c.save(); c.translate(cx, cy); c.rotate((i / 8) * Math.PI * 2); c.fillRect(-12, -85, 24, 40); c.restore(); } c.beginPath(); c.arc(cx, cy, 55, 0, Math.PI * 2); c.fill(); c.fillStyle = '#6a717a'; c.beginPath(); c.arc(cx, cy, 25, 0, Math.PI * 2); c.fill(); break;
      case 'maps': c.fillStyle = '#e84a4a'; c.beginPath(); c.arc(cx, cy - 20, 40, Math.PI, 0); c.lineTo(cx, cy + 70); c.closePath(); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cy - 20, 15, 0, Math.PI * 2); c.fill(); break;
      case 'feed': c.fillStyle = '#25f4ee'; c.fillRect(cx - 38, cy - 70, 28, 120); c.fillStyle = '#fe2c55'; c.fillRect(cx - 30, cy - 62, 28, 120); c.fillStyle = '#fff'; c.fillRect(cx - 34, cy - 66, 28, 120); c.beginPath(); c.arc(cx - 50, cy + 50, 30, 0, Math.PI * 2); c.lineWidth = 22; c.stroke(); break;
      case 'music': c.fillRect(cx + 10, cy - 70, 16, 110); c.fillRect(cx - 50, cy - 70, 16, 110); c.fillRect(cx - 50, cy - 70, 76, 20); c.beginPath(); c.arc(cx - 58, cy + 40, 24, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(cx + 2, cy + 40, 24, 0, Math.PI * 2); c.fill(); break;
      case 'weather': c.fillStyle = '#ffd84a'; c.beginPath(); c.arc(cx + 25, cy - 25, 40, 0, Math.PI * 2); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(cx - 30, cy + 25, 35, 0, Math.PI * 2); c.arc(cx + 10, cy + 15, 42, 0, Math.PI * 2); c.arc(cx + 50, cy + 35, 28, 0, Math.PI * 2); c.fill(); break;
      case 'clock': c.beginPath(); c.arc(cx, cy, 85, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#111'; c.lineWidth = 10; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx, cy - 60); c.moveTo(cx, cy); c.lineTo(cx + 40, cy + 10); c.stroke(); break;
      default: break;
    }
  });
}

export function createPhoneWorld(story) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02030a);
  scene.fog = new THREE.FogExp2(0x040a1a, 0.012);
  const world = new World();
  world.groundFn = () => 0;
  world.groundSurface = 'digital';
  world.gravity = 34; world.terminal = 22; world.killY = -20;
  const group = new THREE.Group(); scene.add(group);
  const level = { id: 'phone', scene, world, interactables: [], creatures: [], spawns: {}, music: 'digital' };

  // Circuit-board floor with glowing traces
  const circuit = TX.drawn('circuit', 1024, 1024, (c, w, h) => {
    c.fillStyle = '#04120e'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { c.fillStyle = `rgba(20,${60 + Math.random() * 60},40,0.25)`; c.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    c.strokeStyle = '#0f5a3e'; c.lineWidth = 6;
    for (let i = 0; i < 90; i++) {
      let x = Math.floor(Math.random() * 32) * 32, y = Math.floor(Math.random() * 32) * 32;
      c.beginPath(); c.moveTo(x, y);
      for (let k = 0; k < 6; k++) { if (Math.random() < 0.5) x += (Math.random() < 0.5 ? -1 : 1) * 32 * (1 + Math.floor(Math.random() * 4)); else y += (Math.random() < 0.5 ? -1 : 1) * 32 * (1 + Math.floor(Math.random() * 4)); c.lineTo(x, y); }
      c.stroke();
      c.fillStyle = '#c9a44a'; c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 2); c.fill();
    }
    for (let i = 0; i < 40; i++) { c.fillStyle = '#111'; const x = Math.random() * w, y = Math.random() * h; c.fillRect(x, y, 60, 36); c.fillStyle = '#888'; for (let k = 0; k < 6; k++) { c.fillRect(x + 4 + k * 9, y - 6, 4, 6); c.fillRect(x + 4 + k * 9, y + 36, 4, 6); } }
  });
  circuit.wrapS = circuit.wrapT = THREE.RepeatWrapping; circuit.repeat.set(10, 10);
  const glow = TX.drawn('circuitGlow', 512, 512, (c, w, h) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#1affb0'; c.lineWidth = 2;
    for (let i = 0; i < 36; i++) { let x = Math.floor(Math.random() * 16) * 32, y = Math.floor(Math.random() * 16) * 32; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 5; k++) { if (k % 2) x += (Math.random() < 0.5 ? -64 : 64); else y += (Math.random() < 0.5 ? -64 : 64); c.lineTo(x, y); } c.stroke(); }
  });
  glow.wrapS = glow.wrapT = THREE.RepeatWrapping; glow.repeat.set(10, 10);
  const floorM = new THREE.MeshStandardMaterial({ map: circuit, emissiveMap: glow, emissive: 0x1affb0, emissiveIntensity: 1.2, roughness: 0.35, metalness: 0.4 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), floorM);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; group.add(floor);
  level.floorM = floorM;

  // Lighting: cold screen light from above, magenta/cyan accents
  scene.add(new THREE.HemisphereLight(0x5a7aff, 0x0a2a1a, 0.9));
  const key = new THREE.DirectionalLight(0xbfd6ff, 1.4);
  key.position.set(20, 60, -10); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 1, far: 200 });
  key.shadow.camera.updateProjectionMatrix();
  scene.add(key);
  const accentA = new THREE.PointLight(0xff2aa8, 400, 80, 2); accentA.position.set(-40, 10, 20); scene.add(accentA);
  const accentB = new THREE.PointLight(0x2af0ff, 400, 80, 2); accentB.position.set(55, 10, 15); scene.add(accentB);

  // Boundary: glowing screen-edge walls
  const edgeM = new THREE.MeshStandardMaterial({ color: 0x0a1030, emissive: 0x2a60ff, emissiveIntensity: 0.6, transparent: true, opacity: 0.55 });
  [[0, -60, 180, 1], [0, 60, 180, 1], [-85, 0, 1, 120], [85, 0, 1, 120]].forEach(([x, z, w, d]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 30, d), edgeM); m.position.set(x, 15, z); group.add(m);
    world.addBox(x, 15, z, w / 2 + 0.5, 15, d / 2 + 0.5, { surface: 'digital' });
  });

  // App icon towers
  const apps = [
    ['phone', 0, 14], ['messages', -20, 14], ['camera', 20, 14],
    ['photos', -20, 34], ['settings', 0, 34], ['maps', 20, 34],
    ['feed', -40, 24], ['music', -40, 44], ['weather', 40, 44], ['clock', 40, 24],
  ];
  const appPos = {};
  apps.forEach(([kind, x, z]) => {
    const t = iconTex(kind);
    const side = new THREE.MeshStandardMaterial({ map: t, roughness: 0.3, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.35 });
    const top = new THREE.MeshStandardMaterial({ color: 0x111820, roughness: 0.2, metalness: 0.6 });
    const size = 11;
    const g = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), [side, side, top, top, side, side]);
    g.position.set(x, size / 2, z); g.castShadow = true; g.receiveShadow = true;
    group.add(g);
    world.addBox(x, size / 2, z, size / 2, size / 2, size / 2, { surface: 'digital' });
    // label
    const label = TX.drawn('lbl_' + kind, 256, 64, (c, w, h) => { c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = 'bold 38px monospace'; c.textAlign = 'center'; c.fillText(kind === 'feed' ? 'FLICK' : kind.toUpperCase(), w / 2, 45); });
    const lm = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: label, transparent: true }));
    lm.position.set(x, 1.4, z - size / 2 - 0.05); lm.rotation.y = Math.PI; group.add(lm);
    appPos[kind] = V(x, 0, z);
  });
  // data rain: falling glowing bits
  const N = 1400;
  const rainG = new THREE.BufferGeometry();
  const rp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { rp[i * 3] = (Math.random() - 0.5) * 170; rp[i * 3 + 1] = Math.random() * 40; rp[i * 3 + 2] = (Math.random() - 0.5) * 120; }
  rainG.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const rain = new THREE.Points(rainG, new THREE.PointsMaterial({ color: 0x3affb0, size: 0.35, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  group.add(rain);
  // floating code panels
  for (let i = 0; i < 16; i++) {
    const tex = TX.drawn('code' + (i % 4), 256, 256, (c, w, h) => { c.fillStyle = 'rgba(0,10,20,0.6)'; c.fillRect(0, 0, w, h); c.fillStyle = '#3affb0'; c.font = '14px monospace'; for (let y = 16; y < h; y += 16) c.fillText(Array.from({ length: 22 }, () => (Math.random() < 0.5 ? '0' : '1')).join(''), 6, y); });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    m.position.set((Math.random() - 0.5) * 150, 12 + Math.random() * 14, (Math.random() - 0.5) * 100);
    m.rotation.y = Math.random() * Math.PI;
    group.add(m);
  }

  // The charging-port gate (spawn + exit portal)
  const portalM = new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  const portal = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.35, 12, 40), new THREE.MeshStandardMaterial({ color: 0x223, emissive: 0x3aa0ff, emissiveIntensity: 1.5 }));
  portal.position.set(0, 3.6, -48); group.add(portal);
  const portalFill = new THREE.Mesh(new THREE.CircleGeometry(3, 40), portalM);
  portalFill.position.copy(portal.position); group.add(portalFill);
  level.portal = { ring: portal, fill: portalFill, open: false };

  // Power core room with the two (fake) wires
  const coreM = new THREE.MeshStandardMaterial({ color: 0x151a22, metalness: 0.8, roughness: 0.3 });
  const battery = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 22), coreM);
  battery.position.set(62, 3, 14); battery.castShadow = true; group.add(battery);
  world.addBox(62, 3, 14, 7, 3, 11);
  const batLbl = TX.drawn('batlbl', 512, 128, (c, w, h) => { c.fillStyle = '#0d0f14'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff453a'; c.font = 'bold 56px monospace'; c.fillText('BATTERY 14%', 40, 85); });
  const bl = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), new THREE.MeshBasicMaterial({ map: batLbl })); bl.position.set(54.9, 3, 14); bl.rotation.y = -Math.PI / 2; group.add(bl);
  const wires = [];
  [[0xff3030, 50, 6, 'RED'], [0x3080ff, 50, 22, 'BLUE']].forEach(([col, x, z, name]) => {
    const pts = [V(x + 4.5, 3, z), V(x + 1, 2.5, z + 1), V(x - 2, 0.6, z - 1), V(x - 5, 1.8, z + 0.5)];
    const w = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.28, 8), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, emissive: col, emissiveIntensity: 0.3 }));
    w.castShadow = true; group.add(w);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffcc }));
    tip.position.copy(pts[3]); group.add(tip);
    const spark = new THREE.PointLight(0xfff0a0, 60, 10, 2); spark.position.copy(pts[3]).add(V(0, 0.5, 0)); group.add(spark);
    wires.push({ tip, spark, name, pos: pts[3], armed: 0 });
  });
  const sign = TX.drawn('wireSign', 512, 256, (c, w, h) => { c.fillStyle = '#0b0e16'; c.fillRect(0, 0, w, h); c.strokeStyle = '#ffd24a'; c.lineWidth = 8; c.strokeRect(8, 8, w - 16, h - 16); c.fillStyle = '#ffd24a'; c.font = 'bold 44px monospace'; c.textAlign = 'center'; c.fillText('SIZE_RESTORE.exe', w / 2, 90); c.font = '30px monospace'; c.fillStyle = '#fff'; c.fillText('connect wire to reboot?', w / 2, 150); c.fillStyle = '#ff5a5a'; c.fillText('(definitely safe)', w / 2, 200); });
  const sm = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshBasicMaterial({ map: sign })); sm.position.set(44, 6, 14); sm.rotation.y = -Math.PI / 2; group.add(sm);
  // terminal with the system log hint
  const term = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 1.5), new THREE.MeshStandardMaterial({ color: 0x0b1020, emissive: 0x1a4aff, emissiveIntensity: 0.4 }));
  term.position.set(36, 2, -2); term.castShadow = true; group.add(term);
  world.addBox(36, 2, -2, 1.5, 2, 0.75);

  // Viruses
  const vPos = [[-8, -22], [10, -18], [0, 0], [-30, 2], [48, -4], [30, 30]];
  vPos.forEach(([x, z], i) => {
    const v = new Virus(i % 2 ? 0xa02aff : 0xff2a6a);
    v.place(x, 0, z);
    scene.add(v.group); level.creatures.push(v);
  });
  const trojan = new Virus(0xff5a00, true);
  trojan.place(56, 0, 30); trojan.aggroRange = 14;
  scene.add(trojan.group); level.creatures.push(trojan);

  level.spawns = { start: { pos: V(0, 0, -42), yaw: 0 } };

  // ---- interactables
  const I = level.interactables;
  I.push({
    pos: V(0, 1, 14 - 6.2), radius: 3.2, label: 'Open the Phone app and call for help',
    can: () => !G.flags.calledHelp,
    action: () => level.tryCall(),
  });
  I.push({
    pos: V(36, 2, -3.2), radius: 3, label: 'Read the system log',
    action: async () => {
      sfx('click');
      ui.toast('<b>SYSTEM LOG</b><br><code>WARN magnetometer: field anomaly</code><br><code>bearing: outside // garden // near the puddle, under the flat rock</code><br><code>WARN power: 2 unregistered cables on the charge bus</code>', 12000);
      G.flags.readLog = true;
      await ui.say('Something out in the garden... under a rock.', { speaker: 'You' });
    },
  });
  wires.forEach((w) => I.push({
    pos: w.pos.clone(), radius: 3, label: () => (w.armed > 0 ? `<b style="color:#ff6a5a">Connect the ${w.name} wire? Press E again</b>` : `Connect the ${w.name} wire`),
    action: () => {
      if (w.armed > 0) { level.explode(w); return; }
      w.armed = 3;
    },
  }));
  I.push({
    pos: V(0, 1, -46), radius: 4.5, label: 'Leave the phone',
    can: () => level.portal.open,
    action: () => level.leave(),
  });

  level.waypoint = () => (G.flags.calledHelp ? (level.portal.open ? { pos: V(0, 1, -46) } : null) : { pos: V(0, 1, 7.8) });

  level.tryCall = async () => {
    G.flags.calledHelp = true;
    unlock('nosignal');
    const P = G.player;
    P.mode = 'locked';
    ui.toast('📞 <b>Calling Mom...</b>', 3500);
    sfx('dial');
    await new Promise((r) => setTimeout(r, 1900));
    sfx('dial');
    await new Promise((r) => setTimeout(r, 1900));
    sfx('fail');
    ui.toast('<b style="color:#ff6a5a">Call Failed</b><br>No Service', 4000);
    G.post.fx.glitch = 0.8;
    P.mode = 'walk';
    await ui.say('No service...', { speaker: 'You' });
    level.portal.open = true;
    story.objective('Find a way back to normal size — check the power core (east), or leave through the portal');
    ui.toast('🌀 The exit portal is open.');
  };

  level.explode = async (w) => {
    const P = G.player;
    P.mode = 'locked';
    sfx('zap'); sfx('explosion', { delay: 0.3 });
    G.post.fx.glitch = 1;
    P.shake = 3;
    const flash = new THREE.PointLight(0xffffff, 50000, 300, 2); flash.position.copy(w.pos).add(V(0, 3, 0)); scene.add(flash);
    const boom = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 1 }));
    boom.position.copy(w.pos); scene.add(boom);
    let t = 0;
    const tick = () => { t += 0.016; boom.scale.setScalar(1 + t * 60); boom.material.opacity = Math.max(0, 1 - t); flash.intensity = Math.max(0, 50000 * (1 - t)); if (t < 1.2) requestAnimationFrame(tick); else { scene.remove(boom); scene.remove(flash); } };
    tick();
    await ui.say('Uh oh.', { speaker: 'You', rate: 0.8 });
    unlock('wires');
    P.die('wires');
  };

  level.leave = async () => {
    const P = G.player;
    P.mode = 'locked';
    sfx('grow');
    G.post.fx.glitch = 1;
    await ui.fade(1, 900);
    G.post.fx.glitch = 0;
    level.hum && level.hum.stop();
    await story.exitPhone();
  };

  level.intro = async () => {
    G.post.fx.pixelate = 3.2;
    G.post.fx.scanlines = 0.06;
    G.post.fx.glitch = 1;
    G.post.fx.saturation = 1.15;
    playMusic('digital');
    setReverb(0.5);
    level.hum = loop('hum', { vol: 0.25 });
    story.placePlayer('start');
    story.checkpoint('phone', 'start');
    G.player.mode = 'locked';
    await ui.fade(0, 900);
    G.mode = 'cutscene';
    const d = G.director;
    await d.play(async (c) => {
      c.cut(V(6, 4, -34), V(0, 1.5, -42), 60);
      c.move(V(4, 2.5, -38), V(0, 1.4, -42), 4);
      await c.say('Is this... inside my phone?', { speaker: 'You', pitch: 1.05 });
      c.cut(V(0, 6, -36), V(0, 4, 14), 65);
      c.move(V(0, 8, -20), V(0, 5, 14), 5);
      await c.say('The Phone app. Maybe I can call from in here.', { speaker: 'You' });
    });
    G.post.fx.glitch = 0;
    G.player.mode = 'walk';
    story.beginPlay();
    ui.chapterCard('CHAPTER 3', 'INSIDE THE PHONE');
    story.objective('Reach the green Phone app and call for help (avoid the viruses — left click to punch)');
  };

  level.update = (dt, t) => {
    const a = rainG.attributes.position;
    for (let i = 0; i < N; i++) { let y = a.getY(i) - dt * (6 + (i % 7)); if (y < 0) y = 40; a.setY(i, y); }
    a.needsUpdate = true;
    floorM.emissiveIntensity = 1 + Math.sin(t * 2) * 0.3;
    wires.forEach((w, i) => { w.spark.intensity = Math.random() < 0.2 ? 120 : 20 + Math.sin(t * 30 + i) * 15; w.tip.visible = Math.random() > 0.1; w.armed = Math.max(0, w.armed - dt); });
    portal.rotation.z += dt * (level.portal.open ? 2 : 0.3);
    portalM.opacity = level.portal.open ? 0.55 + Math.sin(t * 5) * 0.2 : 0.12;
    if (G.post) G.post.fx.glitch = Math.max(0, G.post.fx.glitch - dt * 1.5);
  };
  level.onExit = () => { G.post.fx.pixelate = 0; G.post.fx.scanlines = 0; G.post.fx.saturation = 1.05; if (level.hum) level.hum.stop(); };
  level.post = { bloom: 0.7, threshold: 0.55, aperture: 0.6, exposure: 1.0 };
  level.lineOfSight = () => true;
  level.dispose = () => { if (level.hum) level.hum.stop(); };
  return level;
}
