// Game console (Series X style tower). 15.1 x 30.1 x 15.1 cm. Everything inside is real:
// top vent grille (4 mm holes - fall in when tiny), 130 mm fan, giant heat sink with 55 fins,
// split motherboard with the APU + RAM chips, vertical disc drive with a spinning disc + laser,
// and a power supply at the bottom (DANGER: high voltage capacitors). Back vents + real ports.
import * as THREE from 'three';
import { Thing, panel, grille, tubeWall, lathe } from '../thing.js';
import { defMat, colorMat } from '../../core/materials.js';
import { R } from '../../core/physics.js';
import { loop, vol3d, sfx } from '../../core/audio.js';

const W = 0.151, D = 0.151, H = 0.301, B = 0.01, T = 0.0025; // size, stand height, wall thickness
const TOP = B + H;

export function buildXbox(game, pos, rotY = 0) {
  const x = new Thing({ name: 'Xbox', type: 'dynamic', density: 1, pos, rot: [0, rotY, 0], surface: 'plastic', icon: '🎮', spawnId: 'xbox', tags: ['electronic', 'enterable'] });
  const xin = W / 2 - T, zin = D / 2 - T;
  const greenMat = colorMat(0x2f9a3a, 0.6);
  // --- shell ---
  x.cyl(0.062, B, [0, B / 2, 0], 'rubber', { density: 1200 });
  x.box([W, T, D], [0, B + T / 2, 0], 'xboxBlack', { density: 1200 });
  x.box([T, H, D], [-W / 2 + T / 2, B + H / 2, 0], 'xboxBlack', { density: 1200, cut: 'side panel' });
  x.box([T, H, D], [W / 2 - T / 2, B + H / 2, 0], 'xboxBlack', { density: 1200 });
  // front: vertical disc slot + USB port + power button
  panel(x, { axis: 'z', at: D / 2 - T / 2, rect: [-xin, B + T, xin, TOP], thick: T, m: 'xboxBlack',
    holes: [[0.0445, 0.07, 0.0480, 0.205], [-0.055, 0.03, -0.043, 0.0345]], o: { density: 1200 } });
  // back: lower panel with real ports, upper part is a vent grille
  panel(x, { axis: 'z', at: -D / 2 + T / 2, rect: [-xin, B + T, xin, 0.13], thick: T, m: 'xboxBlack',
    holes: [[-0.05, 0.03, -0.036, 0.0345], [-0.025, 0.03, -0.013, 0.0345], [-0.025, 0.045, -0.013, 0.0495], [0.0, 0.025, 0.016, 0.038], [0.03, 0.028, 0.048, 0.04]], o: { density: 1200 } });
  grille(x, { axis: 'z', at: -D / 2 + T / 2, rect: [-xin, 0.13, xin, TOP], bar: 0.002, gap: 0.0036, thick: T, m: 'xboxBlack', o: { density: 1200 } });
  // top: the big vent grille (4.2 mm holes)
  grille(x, { axis: 'y', at: TOP - T / 2, rect: [-xin, -zin, xin, zin], bar: 0.0018, gap: 0.0042, thick: T, m: 'xboxBlack', o: { density: 1200 } });
  // the green ring you see through the top holes
  const ring = new THREE.RingGeometry(0.03, 0.068, 48); ring.rotateX(-Math.PI / 2);
  x.geo(ring, [0, TOP - T - 0.004, 0], greenMat, { collide: false });
  // power button + LED (front, top-left)
  x.cyl(0.006, 0.0015, [-0.05, 0.285, D / 2 + 0.0005], 'plasticBlack', { rot: [Math.PI / 2, 0, 0], collide: false });
  x.cyl(0.0045, 0.001, [-0.05, 0.285, D / 2 + 0.0013], defMat('xboxLed', () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0 })), { rot: [Math.PI / 2, 0, 0], collide: false });
  // port details (metal inside the holes)
  x.box([0.013, 0.004, 0.012], [-0.043, 0.032, -D / 2 + 0.008], 'steel', { collide: false });
  x.box([0.011, 0.004, 0.012], [-0.019, 0.032, -D / 2 + 0.008], 'steel', { collide: false });
  x.box([0.011, 0.004, 0.012], [-0.019, 0.047, -D / 2 + 0.008], 'steel', { collide: false });

  // --- POWER SUPPLY (bottom) ---  enclosure has vent slots on top so you can get in. Careful.
  const psuTop = 0.058;
  panel(x, { axis: 'y', at: psuTop, rect: [-xin, -zin, xin, zin], thick: 0.0012, m: 'steel',
    holes: [[-0.05, -0.06, -0.044, -0.02], [-0.03, -0.06, -0.024, -0.02], [-0.01, -0.06, -0.004, -0.02], [0.03, 0.02, 0.06, 0.03]] });
  x.box([0.12, 0.0016, 0.12], [0, B + T + 0.003, 0], 'pcb');
  const hv = [];
  hv.push(x.cyl(0.011, 0.034, [-0.035, B + T + 0.021, 0.03], 'capBlue', { hv: true }));
  hv.push(x.cyl(0.008, 0.026, [-0.012, B + T + 0.017, 0.035], 'capBlue', { hv: true }));
  hv.push(x.cyl(0.008, 0.026, [0.005, B + T + 0.017, 0.035], 'capBlue', { hv: true }));
  const coil = new THREE.TorusGeometry(0.011, 0.0055, 12, 32); coil.rotateX(Math.PI / 2);
  hv.push(x.geo(coil, [0.035, B + T + 0.01, 0.025], 'copperCoil', { collide: 'hull', hv: true }));
  x.box([0.022, 0.02, 0.022], [0.035, B + T + 0.014, -0.025], colorMat(0xd8c890, 0.7), { hv: true }); // transformer
  x.box([0.022, 0.012, 0.004], [0.035, B + T + 0.026, -0.025], 'copperCoil', { collide: false });
  for (let i = 0; i < 6; i++) x.box([0.002, 0.03, 0.04], [-0.05 + i * 0.005, B + T + 0.019, -0.035], 'alu');
  for (let i = 0; i < 4; i++) x.box([0.008, 0.012, 0.004], [-0.052 + i * 0.01, B + T + 0.01, -0.012], 'chip');
  for (const p of hv) p.hv = true;

  // --- DISC DRIVE (vertical, behind the front slot) ---
  const dx0 = 0.03, dx1 = 0.066, dy0 = 0.064, dy1 = 0.206, dz0 = -0.064, dz1 = D / 2 - T - 0.001;
  x.box([0.0008, dy1 - dy0, dz1 - dz0], [dx0, (dy0 + dy1) / 2, (dz0 + dz1) / 2], 'steel');
  x.box([0.0008, dy1 - dy0, dz1 - dz0], [dx1, (dy0 + dy1) / 2, (dz0 + dz1) / 2], 'steel');
  x.box([dx1 - dx0, 0.0008, dz1 - dz0], [(dx0 + dx1) / 2, dy1, (dz0 + dz1) / 2], 'steel');
  x.box([dx1 - dx0, 0.0008, dz1 - dz0], [(dx0 + dx1) / 2, dy0, (dz0 + dz1) / 2], 'steel');
  x.box([dx1 - dx0, dy1 - dy0, 0.0008], [(dx0 + dx1) / 2, (dy0 + dy1) / 2, dz0], 'steel');
  const discMat = defMat('disc', () => new THREE.MeshPhysicalMaterial({ color: 0xd9dde3, metalness: 1, roughness: 0.12, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [200, 700] }));
  const discC = [0.0475, 0.135, 0.0045];
  x.cyl(0.06, 0.0012, discC, discMat, { rot: [0, 0, Math.PI / 2], group: 'disc', pivot: discC, seg: 64 });
  x.cyl(0.0075, 0.0014, discC, colorMat(0xbfc4ca, 0.5), { rot: [0, 0, Math.PI / 2], group: 'disc', pivot: discC, collide: false });
  x.cyl(0.011, 0.016, [dx1 - 0.008, discC[1], discC[2]], 'darkAlu', { rot: [0, 0, Math.PI / 2] }); // spindle motor
  // laser sled on two rails
  x.cyl(0.0012, 0.12, [0.039, 0.135, -0.05], 'steel', { collide: false });
  x.cyl(0.0012, 0.12, [0.039, 0.135, 0.055], 'steel', { collide: false });
  x.box([0.007, 0.02, 0.11], [0.039, 0.1, 0.0025], 'darkAlu', { group: 'sled', pivot: [0.039, 0.1, 0.0025], collide: false });
  x.cyl(0.002, 0.001, [0.0355, 0.1, 0.0025], 'lens', { rot: [0, 0, Math.PI / 2], group: 'sled', collide: false });

  // --- MAIN BOARD (vertical, split board design) + APU + RAM + HEAT SINK ---
  const bx = -0.028;
  x.box([0.0016, 0.175, 0.136], [bx, 0.1525, 0], 'pcb');
  x.box([0.003, 0.042, 0.042], [bx - 0.0023, 0.15, 0], 'chip', { hot: 1 }); // APU (gets HOT)
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2, rr = 0.038;
    x.box([0.0012, 0.012, 0.014], [bx - 0.0014, 0.15 + Math.sin(a) * rr, Math.cos(a) * rr * 1.25], 'chip');
  }
  // heat sink: copper vapor chamber + aluminium fins (2 mm gaps - you can walk between them)
  x.box([0.005, 0.08, 0.12], [bx - 0.0062, 0.15, 0], 'copper', { hot: 1 });
  const finX0 = bx - 0.0087, finX1 = -W / 2 + T + 0.0015;
  for (let z = -0.064; z <= 0.0641; z += 0.0024) {
    x.box([finX0 - finX1, 0.13, 0.0004], [(finX0 + finX1) / 2, 0.165, z], 'alu', { hot: 0.6, shadow: false });
  }
  for (const zz of [-0.03, 0, 0.03]) x.cyl(0.003, 0.12, [bx - 0.012, 0.165, zz], 'copper', { collide: false });
  // other side of the board: SSD chips, small caps, a ribbon cable to the disc drive
  x.box([0.0015, 0.02, 0.025], [bx + 0.0015, 0.2, -0.03], 'chip');
  x.box([0.0015, 0.018, 0.018], [bx + 0.0015, 0.2, 0.0], 'chip');
  x.box([0.0015, 0.014, 0.014], [bx + 0.0015, 0.12, 0.04], 'chip');
  for (let i = 0; i < 8; i++) x.cyl(0.0025, 0.006, [bx + 0.004, 0.1 + i * 0.008, -0.055], 'darkAlu', { rot: [0, 0, Math.PI / 2] });
  x.box([0.058, 0.0005, 0.03], [0.001, 0.09, 0.03], colorMat(0xd6a640, 0.6), { collide: false }); // ribbon cable
  // chassis brace in the middle
  x.box([0.004, 0.004, D - 2 * T], [0, 0.24, 0], 'darkAlu');

  // --- FAN (130 mm, under the top grille) ---
  const fy = 0.28, fh = 0.026;
  tubeWall(x, { r: 0.065, h: fh, thick: 0.003, y: fy, seg: 28, m: 'plasticBlack' });
  // shroud plate so all air goes through the fan
  panel(x, { axis: 'y', at: fy - fh / 2, rect: [-xin, -zin, xin, zin], holes: [[-0.0645, -0.0645, 0.0645, 0.0645]], thick: 0.002, m: 'plasticBlack' });
  for (let i = 0; i < 4; i++) { // motor struts
    const a = i * Math.PI / 2 + Math.PI / 4;
    x.box([0.045, 0.003, 0.004], [Math.cos(a) * 0.044, fy - fh / 2 + 0.002, Math.sin(a) * 0.044], 'plasticBlack', { rot: [0, -a, 0] });
  }
  const hub = [0, fy, 0];
  x.cyl(0.023, fh * 0.85, hub, 'plasticBlack', { group: 'fan', pivot: hub });
  x.cyl(0.012, 0.001, [0, fy + fh * 0.43, 0], defMat('fanSticker', () => new THREE.MeshStandardMaterial({ color: 0x2f9a3a, roughness: 0.5 })), { group: 'fan', collide: false });
  const blades = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, 0)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.55, 0, 0)));
    const b = x.box([0.04, 0.0012, 0.024], [Math.cos(a) * 0.044, fy, Math.sin(a) * 0.044], 'plasticBlack', { rot: [q.x, q.y, q.z, q.w], group: 'fan', pivot: hub });
    b.baseAngle = a; b.baseQuat = q.clone(); blades.push(b);
  }

  x.build(game.engine.scene);
  x.enclosure = new THREE.Box3(new THREE.Vector3(-xin, B + T, -zin), new THREE.Vector3(xin, TOP - T, zin));
  x.zones = {
    psu: new THREE.Box3(new THREE.Vector3(-xin, B + T, -zin), new THREE.Vector3(xin, psuTop, zin)),
    fan: { y0: fy - fh / 2 - 0.002, y1: fy + fh / 2 + 0.002, r: 0.065 },
  };
  x.temp = 24; x.fanAngle = 0; x.fanSpeed = 0; x.discSpeed = 0; x.sledT = 0;
  x.blades = blades;
  x.behaviors.push(xboxBehavior);
  game.interactables.push({
    name: () => (x.on ? 'Turn Xbox off' : 'Turn Xbox on'), thing: x, local: new THREE.Vector3(-0.05, 0.285, D / 2), radius: 0.03,
    use: () => setPower(x, !x.on, game),
  });
  return x;
}

function setPower(x, on, game) {
  x.on = on;
  defMat('xboxLed').emissiveIntensity = on ? 3 : 0;
  if (on) { sfx.beep(660, 0.12, 0.2); setTimeout(() => sfx.beep(990, 0.18, 0.2), 140); }
  else sfx.beep(500, 0.1, 0.15);
  if (game.tv) game.tv.refresh?.();
}

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
const xboxBehavior = {
  update(x, dt, game) {
    // fan + disc spin up / down
    x.fanSpeed += ((x.on ? 1 : 0) - x.fanSpeed) * Math.min(1, dt * (x.on ? 0.6 : 0.35));
    x.discSpeed += ((x.on ? 1 : 0) - x.discSpeed) * Math.min(1, dt * 0.8);
    x.fanAngle += x.fanSpeed * 140 * dt; // ~1300 rpm
    if (x.meshes?.fan) for (const m of x.meshes.fan) m.rotation.y = -x.fanAngle;
    if (x.meshes?.disc) for (const m of x.meshes.disc) m.rotation.x += x.discSpeed * 300 * dt;
    if (x.meshes?.sled) { x.sledT += dt * x.discSpeed; for (const m of x.meshes.sled) m.position.y = 0.1 + Math.sin(x.sledT * 0.7) * 0.02 * x.discSpeed; }
    // blade colliders: solid when still (walk between them), a hazard when spinning
    const spinning = x.fanSpeed > 0.05;
    for (const b of x.blades) {
      if (!b.collider) continue;
      b.collider.setEnabled(!spinning);
      if (!spinning && Math.abs(x.fanAngle - (b._lastA ?? 0)) > 1e-4) {
        const a = b.baseAngle + x.fanAngle;
        b.collider.setTranslationWrtParent({ x: Math.cos(a) * 0.044 * x.scale, y: 0.28 * x.scale, z: Math.sin(a) * 0.044 * x.scale });
        _q.setFromAxisAngle(_up, -x.fanAngle).multiply(b.baseQuat);
        b.collider.setRotationWrtParent({ x: _q.x, y: _q.y, z: _q.z, w: _q.w });
        b._lastA = x.fanAngle;
      }
    }
    // heat: realistic APU temps (idles ~45C, games ~70C), cools off when off
    const target = x.on ? 72 : 24;
    x.temp += (target - x.temp) * Math.min(1, dt / (x.on ? 90 : 160));

    // sound: fan whoosh, loud when you're tiny and close
    if (!x.snd) x.snd = loop('fan');
    const p = game.player;
    const d = x.position(_v).distanceTo(game.macroFeet()), rs = game.realS();
    x.snd.set(x.fanSpeed * vol3d(d, 0.5 * Math.min(1, 0.02 / Math.max(rs, 0.0005)) + 0.04, rs) * 0.6, 0.6 + x.fanSpeed * 0.6);
    if (game.elsewhere) return;

    // effects on a tiny player inside
    const local = x.group.worldToLocal(p.center(_v.clone())).divideScalar(1); // group has scale applied
    if (!x.enclosure.containsPoint(local)) return;
    game.inside = x;
    const s = p.s, g = 9.81 * s;
    const lift = Math.min(3, 0.004 / Math.max(s, 1e-6)) * x.fanSpeed; // tiny = blown around
    const fz = x.zones.fan, r = Math.hypot(local.x, local.z);
    if (lift > 0.01) {
      // air is sucked up through the fan and out the top
      const up = _v.set(0, 1, 0).applyQuaternion(x.group.quaternion);
      const pull = _v.clone().set(-local.x, 0, -local.z).normalize().applyQuaternion(x.group.quaternion);
      const k = local.y > fz.y0 - 0.05 ? 1.6 : 1;
      p.extForce.addScaledVector(up, g * lift * k);
      if (r > 0.01) p.extForce.addScaledVector(pull, g * lift * 0.4);
      p.shake = Math.max(p.shake, 0.25 * x.fanSpeed);
      if (!game._windTip) { game._windTip = 1; game.ui.toast('💨 The fan is sucking you up! (realistic: tiny things get blown away)'); }
    }
    if (spinning && local.y > fz.y0 && local.y < fz.y1 && r < fz.r && r > 0.02) {
      if (!x._hitCd || game.time > x._hitCd) {
        x._hitCd = game.time + 0.35;
        p.hurt(18 * x.fanSpeed, 'fan');
        p.vel.y += Math.sqrt(2 * g * 3 * p.height / s) * s * 0.4;
        p.shake = 1;
        sfx.thud(0.8, 2.5);
        if (!game._fanTip) { game._fanTip = 1; game.ui.toast('⚠️ Fan blades! They spin ~1300 times a minute'); }
      }
    }
    // heat: touching the APU / heat sink burns
    if (x.temp > 50 && p.touching) {
      for (const c of p.touching) {
        const part = c.part;
        if (part && part.hot && game.time > (x._burnCd || 0)) {
          const hot = x.temp * part.hot;
          if (hot > 48) {
            x._burnCd = game.time + 0.5; p.hurt((hot - 45) * 0.25, 'burn');
            if (!game._burnTip) { game._burnTip = 1; game.ui.toast(`🔥 Ouch! This metal is ${Math.round(hot)}°C`); }
          }
        }
        if (part && part.hv && x.on && game.time > (x._zapCd || 0)) {
          x._zapCd = game.time + 1.2;
          p.hurt(35, 'electric shock');
          sfx.zap(0.7); game.ui.flash(0.8); p.shake = 1;
          p.vel.addScaledVector(_v.set(Math.random() - 0.5, 1, Math.random() - 0.5).normalize(), Math.sqrt(2 * g * p.height / s * 2) * s);
          if (!game._zapTip) { game._zapTip = 1; game.ui.toast('⚡ ZAP! Power supply capacitors hold ~170 volts'); }
        }
      }
    }
  },
  onScale(x) { for (const b of x.blades) b._lastA = -1; },
};
void lathe; void R;
