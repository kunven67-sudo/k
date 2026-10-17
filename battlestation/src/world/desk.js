import * as THREE from 'three';
import { mesh, box, boxMM, cyl, slab, tube } from './build.js';
import { pbr, paint, canvasTex, smudgeTex } from './materials.js';
import { buildKeyboard } from './keyboard.js';
import { buildMouse } from './mouse.js';
import { buildMonitor } from './monitor.js';
import { buildTower } from './pctower.js';
import { Cable } from './cable.js';
import { buildChair } from './chair.js';

// The battlestation: L-shaped desk in the corner of the stream room.
// Built in a local frame where you sit facing -z, +x is your right, origin = front edge of the
// desk right in front of you at floor level. The whole thing is then turned to face the west wall.
export const DESK_ORIGIN = new THREE.Vector3(0.75, 0, 1.2);
export const DESK_ROT = Math.PI / 2;
export const TOP = 0.74;

export async function buildDesk(ctx) {
  const g = new THREE.Group();
  g.name = 'desk';
  g.position.copy(DESK_ORIGIN);
  g.rotation.y = DESK_ROT;
  ctx.scene.add(g);
  const D = { group: g };
  const toWorld = (x, z) => new THREE.Vector3(x, 0, z).applyAxisAngle(_up, DESK_ROT).add(DESK_ORIGIN);
  const collide = (x0, z0, x1, z1, y0, y1) => {
    const a = toWorld((x0 + x1) / 2, (z0 + z1) / 2);
    ctx.physics.add({ x: a.x, z: a.z, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, y0, y1, rot: DESK_ROT });
  };

  // ---- desk -------------------------------------------------------------------
  const wood = await pbr('oak_veneer_01', { color: 0x6b5644, roughness: 0.75, normal: 0.6, rotate: Math.PI / 2 });
  const metal = paint(0x111214, 0.45, 0.7);
  const topMain = mesh(boxMM(-0.6, TOP - 0.025, -0.75, 1.2, TOP, 0), wood, { parent: g, name: 'desktop' });
  const topRet = mesh(boxMM(0.6, TOP - 0.025, 0, 1.2, TOP, 1.2), wood, { parent: g, name: 'desktop' });
  ctx.interact.block(topMain); ctx.interact.block(topRet);
  // steel frame + legs
  for (const [x, z0, z1] of [[-0.56, -0.7, -0.05], [1.16, -0.7, -0.05]]) {
    mesh(boxMM(x - 0.03, 0, z0, x + 0.03, 0.03, z1), metal, { parent: g });
    mesh(boxMM(x - 0.025, 0.03, (z0 + z1) / 2 - 0.035, x + 0.025, TOP - 0.025, (z0 + z1) / 2 + 0.035), metal, { parent: g });
  }
  mesh(boxMM(0.62, 0, 1.12, 1.18, 0.03, 1.18), metal, { parent: g });
  mesh(boxMM(0.875, 0.03, 1.115, 0.925, TOP - 0.025, 1.185), metal, { parent: g });
  mesh(boxMM(-0.55, TOP - 0.085, -0.4, 1.15, TOP - 0.025, -0.36), metal, { parent: g }); // cross beam
  collide(-0.6, -0.75, 1.2, 0, 0.0, TOP);
  collide(0.6, 0, 1.2, 1.2, 0.0, TOP);
  // full desk mat
  const matTex = canvasTex(512, 256, (c, w, h) => {
    c.fillStyle = '#1b1c20'; c.fillRect(0, 0, w, h);
    const im = c.getImageData(0, 0, w, h);
    for (let i = 0; i < im.data.length; i += 4) { const n = (Math.random() - 0.5) * 10; im.data[i] += n; im.data[i + 1] += n; im.data[i + 2] += n; }
    c.putImageData(im, 0, 0);
    c.strokeStyle = '#2c2d33'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
  });
  matTex.wrapS = matTex.wrapT = THREE.ClampToEdgeWrapping;
  const deskMat = mesh(slab(0.9, 0.4, 0.003, 0.012, 0.0008), new THREE.MeshStandardMaterial({ map: matTex, roughness: 0.92 }), { parent: g });
  deskMat.position.set(0.17, TOP, -0.21);
  // remap slab UVs to 0..1
  { const p = deskMat.geometry.attributes.position, uv = deskMat.geometry.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 0.9 + 0.5, p.getZ(i) / 0.4 + 0.5); uv.needsUpdate = true; }

  // ---- keyboard + mouse -----------------------------------------------------------
  const kb = buildKeyboard(ctx);
  kb.group.position.set(0.075, TOP + 0.003 + 0.019, -0.2);
  g.add(kb.group);
  D.keyboard = kb;
  const mouse = buildMouse();
  mouse.group.position.set(0.43, TOP + 0.0035, -0.17);
  g.add(mouse.group);
  D.mouse = mouse;
  D.mouseHome = mouse.group.position.clone();

  // ---- monitors -------------------------------------------------------------------
  const mon1 = buildMonitor({ inches: 27, res: [1600, 900], name: 'monitor1' });
  mon1.group.position.set(0, TOP - mon1.group.userData.footY, -0.47);
  mon1.group.rotation.x = -0.04;
  g.add(mon1.group);
  const mon2 = buildMonitor({ inches: 24, res: [1280, 720], name: 'monitor2' });
  mon2.group.position.set(0.66, TOP - mon2.group.userData.footY, -0.37);
  mon2.group.rotation.y = -0.62;
  g.add(mon2.group);
  D.monitors = [mon1, mon2];
  // webcam on top of the main monitor
  const camBody = mesh(box(0.09, 0.028, 0.026, 0.01), paint(0x0e0e10, 0.4), { parent: mon1.group });
  camBody.position.set(0, mon1.Hh / 2 + 0.006 + 0.018, 0.006);
  const lens = mesh(cyl(0.008, 0.008, 0.004, 24), new THREE.MeshStandardMaterial({ color: 0x050508, roughness: 0.05, metalness: 0.5 }), { parent: camBody, rot: [Math.PI / 2, 0, 0], pos: [0, 0, 0.013] });
  void lens;

  // ---- PC tower on the side desk ------------------------------------------------------
  const tower = buildTower(ctx);
  tower.group.position.set(0.9, TOP + 0.012, 0.3);
  g.add(tower.group);
  D.tower = tower;

  // ---- internet box (modem + router) ---------------------------------------------------
  D.router = buildRouter(g);
  D.router.group.position.set(1.0, TOP, 0.9);
  D.router.group.rotation.y = -Math.PI / 2;

  // wall sockets + power strip
  const wallPlate = paint(0xf6f6f4, 0.45);
  const coaxPlate = new THREE.Group();
  mesh(box(0.07, 0.115, 0.008, 0.002), wallPlate, { parent: coaxPlate });
  mesh(cyl(0.006, 0.006, 0.014, 16), paint(0xc9b037, 0.3, 1), { parent: coaxPlate, rot: [Math.PI / 2, 0, 0], pos: [0, 0, 0.008] });
  coaxPlate.position.set(1.196, 0.3, 1.0);
  coaxPlate.rotation.y = -Math.PI / 2;
  g.add(coaxPlate);
  const strip = new THREE.Group();
  mesh(box(0.33, 0.04, 0.055, 0.01), paint(0x1a1a1c, 0.5), { parent: strip });
  const stripLed = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2200, emissiveIntensity: 1.5 });
  mesh(new THREE.BoxGeometry(0.008, 0.008, 0.005), stripLed, { parent: strip, pos: [0.15, 0.021, 0] });
  strip.position.set(0.95, 0.02, 0.62);
  strip.rotation.y = Math.PI / 2;
  g.add(strip);
  const outlet = mesh(box(0.07, 0.115, 0.008, 0.002), wallPlate, { parent: g, pos: [1.196, 0.3, 0.4], rot: [0, -Math.PI / 2, 0] });
  void outlet;

  // ---- cables ---------------------------------------------------------------------------
  const R = D.router;
  const rw = (v) => R.group.localToWorld(v.clone());
  g.updateMatrixWorld(true);
  const gl = (v) => g.worldToLocal(rw(v));
  D.cables = {};
  D.cables.routerPower = new Cable(g, {
    from: new THREE.Vector3(0.95, 0.03, 0.62 + 0.12), via: [new THREE.Vector3(1.15, 0.05, 0.85), new THREE.Vector3(1.17, TOP - 0.05, 0.98)],
    in: gl(R.ports.power), out: gl(R.ports.power).add(new THREE.Vector3(0.06, -0.18, 0.05)), inDir: new THREE.Vector3(0, 0, -1).applyQuaternion(R.group.quaternion),
    plug: 'barrel', radius: 0.0026, sag: 0.04,
  });
  D.cables.wan = new Cable(g, {
    from: new THREE.Vector3(1.19, 0.3, 1.0), via: [new THREE.Vector3(1.12, 0.32, 1.0), new THREE.Vector3(1.16, TOP - 0.06, 1.02)],
    in: gl(R.ports.wan), out: gl(R.ports.wan).add(new THREE.Vector3(0.07, -0.2, 0.0)), inDir: new THREE.Vector3(0, 0, -1).applyQuaternion(R.group.quaternion),
    plug: 'coax', radius: 0.0032, color: 0xf2f2f0, plugColor: 0xc9b037, sag: 0.05,
  });
  const towerBack = (v) => g.worldToLocal(tower.group.localToWorld(v.clone()));
  D.cables.ethernet = new Cable(g, {
    from: gl(R.ports.lan), via: [gl(R.ports.lan).add(new THREE.Vector3(0.05, -0.02, -0.1)), new THREE.Vector3(1.1, TOP + 0.02, 0.3)],
    in: towerBack(tower.ethPort.position.clone()), out: towerBack(tower.ethPort.position.clone()).add(new THREE.Vector3(0.08, -0.25, -0.05)),
    inDir: new THREE.Vector3(0, 0, 1), plug: 'rj45', radius: 0.0024, color: 0x2a6fdb, plugColor: 0xd8e6f5, sag: 0.03,
  });
  D.cables.pcPower = new Cable(g, {
    from: new THREE.Vector3(0.95, 0.03, 0.62 - 0.12), via: [new THREE.Vector3(1.12, 0.1, 0.4), new THREE.Vector3(1.15, TOP - 0.04, 0.12)],
    in: towerBack(tower.psuSock.position.clone()), out: towerBack(tower.psuSock.position.clone()).add(new THREE.Vector3(0.1, -0.35, -0.1)),
    inDir: new THREE.Vector3(0, 0, 1), plug: 'iec', radius: 0.0042, sag: 0.05,
  });
  // monitor + peripheral cables (always plugged, just for looks)
  const deco = [
    [[0, TOP + 0.05, -0.53], [0.1, TOP + 0.005, -0.66], [0.6, TOP + 0.005, -0.7], [0.9, TOP + 0.08, 0.07]],
    [[0.62, TOP + 0.05, -0.47], [0.75, TOP + 0.005, -0.66], [0.92, TOP + 0.09, 0.07]],
    [[0.075, TOP + 0.02, -0.27], [0.1, TOP + 0.005, -0.5], [0.5, TOP + 0.005, -0.68], [0.88, TOP + 0.1, 0.07]],
  ];
  for (const pts of deco) mesh(tube(pts, 0.0026, 64), new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.6 }), { parent: g });

  // ---- mic arm, headphones, ring light ----------------------------------------------------
  D.mic = buildMicArm(g);
  const hp = buildHeadphoneStand(g);
  hp.position.set(-0.47, TOP, -0.33);
  D.ringLight = buildRingLight(g);
  D.ringLight.group.position.set(-0.86, 0, -0.42);
  D.ringLight.group.rotation.y = 0.75;
  collide(-1.0, -0.56, -0.72, -0.28, 0, 1.6);

  // ---- acoustic foam on the wall behind ------------------------------------------------
  buildFoam(g);

  // ---- LED glow behind the monitors + under the desk -------------------------------------
  const wallGlow = new THREE.RectAreaLight(0x4b6bff, 0, 1.0, 0.25);
  wallGlow.position.set(0.15, TOP + 0.2, -0.6);
  g.add(wallGlow); // area lights shine along their local -z: straight at the wall
  wallGlow.rotation.set(0.35, 0, 0);
  const underGlow = new THREE.RectAreaLight(0x4b6bff, 0, 1.6, 0.05);
  underGlow.position.set(0.3, TOP - 0.03, -0.05);
  underGlow.rotation.set(-Math.PI / 2, 0, 0);
  g.add(underGlow);
  const ledStripMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x4b6bff, emissiveIntensity: 3 });
  mesh(new THREE.BoxGeometry(1.2, 0.006, 0.01), ledStripMat, { parent: g, pos: [0.15, TOP + 0.02, -0.72], cast: false });
  D.led = { wallGlow, underGlow, mat: ledStripMat, on: true, hue: 0.62, mode: 'cycle' };

  // ---- the chair -------------------------------------------------------------------------
  D.chair = await buildChair(ctx);
  D.chair.group.position.copy(toWorld(0, 0.4));
  D.chair.group.rotation.y = DESK_ROT;
  D.chair.basePos = D.chair.group.position.clone();
  ctx.scene.add(D.chair.group);

  D.toWorld = toWorld;
  D.update = (dt, t, pcOn) => {
    kb.update(dt, pcOn);
    mouse.update(dt, t);
    tower.update(dt, ctx.pcLoad || 0);
    for (const c of Object.values(D.cables)) c.update(dt);
    const led = D.led;
    if (led.mode === 'cycle') led.mat.emissive.setHSL((led.hue + t * 0.03) % 1, 0.9, 0.5);
    const lit = led.on ? 1 : 0;
    led.mat.emissiveIntensity = 3 * lit;
    led.wallGlow.color.copy(led.mat.emissive); led.wallGlow.intensity = 14 * lit;
    led.underGlow.color.copy(led.mat.emissive); led.underGlow.intensity = 9 * lit;
    D.ringLight.update(dt);
    for (const m of D.monitors) m.update(dt);
  };
  return D;
}
const _up = new THREE.Vector3(0, 1, 0);

function buildRouter(parent) {
  const g = new THREE.Group();
  g.name = 'router';
  const body = paint(0xf1f1ef, 0.38, 0.0, { roughnessMap: smudgeTex() });
  const dark = paint(0x1a1a1c, 0.5);
  // modem/router combo: upright slim box with a vented top + two antennas
  const W = 0.2, H = 0.17, Dp = 0.055;
  mesh(box(W, H, Dp, 0.012), body, { parent: g, pos: [0, H / 2 + 0.012, 0] });
  mesh(box(W * 0.9, 0.012, Dp * 1.6, 0.005), dark, { parent: g, pos: [0, 0.006, 0] });
  for (const sx of [-1, 1]) {
    const ant = mesh(box(0.016, 0.15, 0.009, 0.004), dark, { parent: g });
    ant.position.set(sx * (W / 2 - 0.02), H + 0.012 + 0.07, -Dp / 2 + 0.006);
    ant.rotation.z = sx * -0.12;
  }
  // front LEDs: power, internet, wifi, lan
  const leds = {};
  const labels = canvasTex(256, 64, (c) => {
    c.fillStyle = '#f1f1ef'; c.fillRect(0, 0, 256, 64);
    c.fillStyle = '#8a8a8a'; c.font = 'bold 13px Arial'; c.textAlign = 'center';
    ['POWER', 'INTERNET', 'WI-FI', 'LAN'].forEach((t, i) => c.fillText(t, 32 + i * 64, 50));
  });
  labels.wrapS = labels.wrapT = THREE.ClampToEdgeWrapping;
  mesh(new THREE.PlaneGeometry(0.16, 0.04), new THREE.MeshStandardMaterial({ map: labels, roughness: 0.4 }), { parent: g, pos: [0, 0.05, Dp / 2 + 0.0005], cast: false });
  ['power', 'internet', 'wifi', 'lan'].forEach((k, i) => {
    const m = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x000000, emissiveIntensity: 2.4 });
    const l = mesh(new THREE.CircleGeometry(0.0035, 16), m, { parent: g, pos: [-0.06 + i * 0.04, 0.066, Dp / 2 + 0.0008], cast: false });
    leds[k] = { mat: m, mesh: l };
  });
  const brand = canvasTex(256, 64, (c) => { c.fillStyle = '#f1f1ef'; c.fillRect(0, 0, 256, 64); c.fillStyle = '#4a4f57'; c.font = '600 30px Arial'; c.textAlign = 'center'; c.fillText('NETLINK', 128, 42); });
  mesh(new THREE.PlaneGeometry(0.09, 0.022), new THREE.MeshStandardMaterial({ map: brand, roughness: 0.4 }), { parent: g, pos: [0, 0.14, Dp / 2 + 0.0005], cast: false });
  // back ports (local -z): power, coax WAN, LAN, reset pinhole
  const ports = {
    power: new THREE.Vector3(0.075, 0.04, -Dp / 2 - 0.004),
    wan: new THREE.Vector3(0.035, 0.04, -Dp / 2 - 0.004),
    lan: new THREE.Vector3(-0.02, 0.04, -Dp / 2 - 0.004),
    reset: new THREE.Vector3(-0.07, 0.04, -Dp / 2 - 0.001),
  };
  for (const k of ['power', 'wan', 'lan']) mesh(new THREE.BoxGeometry(0.016, 0.014, 0.004), paint(0x0b0b0b, 0.8), { parent: g, pos: [ports[k].x, ports[k].y, -Dp / 2 - 0.001] });
  mesh(cyl(0.0012, 0.0012, 0.002, 8), paint(0x000000, 1), { parent: g, pos: [ports.reset.x, ports.reset.y, -Dp / 2 - 0.0005], rot: [Math.PI / 2, 0, 0] });
  // sticker with the Wi-Fi name + password on the side
  parent.add(g);
  return { group: g, leds, ports, W, H, Dp };
}

function buildMicArm(parent) {
  const g = new THREE.Group();
  const m = paint(0x141416, 0.4, 0.6);
  const clamp = new THREE.Vector3(-0.47, TOP, -0.68);
  mesh(box(0.05, 0.06, 0.07, 0.006), m, { parent: g, pos: [clamp.x, TOP + 0.01, clamp.z] });
  const p0 = new THREE.Vector3(clamp.x, TOP + 0.05, clamp.z);
  const p1 = new THREE.Vector3(-0.42, TOP + 0.42, -0.42);
  const p2 = new THREE.Vector3(-0.27, 1.1, -0.15);
  for (const [a, b] of [[p0, p1], [p1, p2]]) {
    const len = a.distanceTo(b);
    for (const off of [-0.008, 0.008]) {
      const rod = mesh(cyl(0.006, 0.006, len, 10), m, { parent: g });
      rod.position.lerpVectors(a, b, 0.5).add(new THREE.Vector3(off, 0, 0));
      rod.quaternion.setFromUnitVectors(_up, b.clone().sub(a).normalize());
    }
    mesh(new THREE.SphereGeometry(0.014, 16, 12), m, { parent: g, pos: [b.x, b.y, b.z] });
  }
  // shock mount + mic capsule pointing at your mouth
  const mic = new THREE.Group();
  mic.position.copy(p2).add(new THREE.Vector3(0.02, -0.04, 0.03));
  mic.rotation.set(-0.35, 0.5, 0);
  mesh(cyl(0.022, 0.022, 0.13, 32), paint(0x1b1b1d, 0.35, 0.3), { parent: mic, rot: [Math.PI / 2, 0, 0] });
  const grille = canvasTex(128, 128, (c) => { c.fillStyle = '#555'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#111'; for (let y = 0; y < 128; y += 6) for (let x = 0; x < 128; x += 6) c.fillRect(x, y, 3, 3); }, false);
  grille.repeat.set(6, 3);
  mesh(new THREE.SphereGeometry(0.0235, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.9, roughness: 0.4, bumpMap: grille, bumpScale: 1.5 }), { parent: mic, pos: [0, 0, 0.065], rot: [Math.PI / 2, 0, 0] });
  mesh(new THREE.TorusGeometry(0.03, 0.003, 8, 32), m, { parent: mic });
  g.add(mic);
  parent.add(g);
  return { group: g, mic };
}

function buildHeadphoneStand(parent) {
  const g = new THREE.Group();
  const m = paint(0x16171a, 0.35, 0.7);
  mesh(cyl(0.055, 0.06, 0.012, 32), m, { parent: g, pos: [0, 0.006, 0] });
  mesh(cyl(0.007, 0.007, 0.26, 12), m, { parent: g, pos: [0, 0.14, 0] });
  mesh(box(0.11, 0.012, 0.03, 0.005), m, { parent: g, pos: [0, 0.27, 0] });
  // headphones hanging on it
  const hpMat = paint(0x0f0f11, 0.5, 0.1);
  const band = mesh(new THREE.TorusGeometry(0.085, 0.009, 10, 40, Math.PI), hpMat, { parent: g, pos: [0, 0.198, 0] });
  void band;
  for (const sx of [-1, 1]) {
    const cup = mesh(cyl(0.045, 0.045, 0.035, 32), hpMat, { parent: g, rot: [0, 0, Math.PI / 2] });
    cup.position.set(sx * 0.09, 0.17, 0);
    const pad = mesh(new THREE.TorusGeometry(0.034, 0.012, 12, 32), paint(0x1c1c1e, 0.9), { parent: g, rot: [0, Math.PI / 2, 0] });
    pad.position.set(sx * 0.07, 0.17, 0);
  }
  parent.add(g);
  return g;
}

function buildRingLight(parent) {
  const g = new THREE.Group();
  const m = paint(0x121214, 0.45, 0.5);
  // tripod
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = mesh(cyl(0.008, 0.008, 0.62, 8), m, { parent: g });
    leg.position.set(Math.cos(a) * 0.14, 0.27, Math.sin(a) * 0.14);
    leg.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
  }
  mesh(cyl(0.011, 0.011, 1.0, 12), m, { parent: g, pos: [0, 0.98, 0] });
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e6, emissiveIntensity: 0, roughness: 0.4 });
  const ring = mesh(new THREE.TorusGeometry(0.2, 0.022, 16, 64), ringMat, { parent: g, pos: [0, 1.5, 0], cast: false });
  mesh(new THREE.TorusGeometry(0.2, 0.024, 8, 64, Math.PI), m, { parent: g, pos: [0, 1.5, -0.006], rot: [0, 0, Math.PI] });
  const light = new THREE.SpotLight(0xfff1e2, 0, 4, 0.9, 0.85, 2);
  light.position.set(0, 1.5, 0.05);
  light.target.position.set(0, 1.2, 1.2);
  g.add(light, light.target);
  parent.add(g);
  const r = { group: g, ring, ringMat, light, on: false, level: 0 };
  r.update = (dt) => { r.level += ((r.on ? 1 : 0) - r.level) * Math.min(1, dt * 12); ringMat.emissiveIntensity = r.level * 3.5; light.intensity = r.level * 7; };
  return r;
}

function buildFoam(parent) {
  // wedge acoustic foam tiles, alternating direction like a real install
  const tile = 0.3, n = 6;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  for (let i = 0; i < n; i++) { shape.lineTo((i + 0.5) * tile / n, 0.045); shape.lineTo((i + 1) * tile / n, 0.012); }
  shape.lineTo(tile, 0); shape.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: tile, bevelEnabled: false });
  geo.translate(-tile / 2, 0, -tile / 2);
  geo.rotateX(Math.PI / 2); // ridges stick out of the wall (+z), tile lies flat on it
  geo.computeVertexNormals();
  const foamTex = canvasTex(128, 128, (c) => {
    const im = c.createImageData(128, 128);
    for (let i = 0; i < im.data.length; i += 4) { const v = 120 + Math.random() * 135; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    c.putImageData(im, 0, 0);
  }, false);
  foamTex.repeat.set(4, 4);
  const mats = [new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 1, bumpMap: foamTex, bumpScale: 1.2 }), new THREE.MeshStandardMaterial({ color: 0x23252a, roughness: 1, bumpMap: foamTex, bumpScale: 1.2 })];
  const count = 7 * 3;
  const inst = [new THREE.InstancedMesh(geo, mats[0], count), new THREE.InstancedMesh(geo, mats[1], count)];
  const dummy = new THREE.Object3D();
  const c = [0, 0];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 7; col++) {
    const k = (row + col) % 2;
    dummy.position.set(-0.85 + col * tile + tile / 2, 1.28 + row * tile + tile / 2, -0.75 + 0.001);
    dummy.rotation.set(0, 0, k ? Math.PI / 2 : 0);
    dummy.updateMatrix();
    inst[k].setMatrixAt(c[k]++, dummy.matrix);
  }
  for (const [i, m] of inst.entries()) { m.count = c[i]; m.castShadow = false; m.receiveShadow = true; parent.add(m); }
}
