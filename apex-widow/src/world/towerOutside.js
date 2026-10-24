// The outside of the VOSS tower: curtain-wall facade for the locked floors (with fake rooms behind the glass), the
// glass of the floors you can walk in (breakable panes), the roof with the helipad, HVAC, water tank, mast, the
// big VOSS BIOGENETICS sign and the black helicopter.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Batch, Kit } from './kit.js';
import { makeFacadeMaterial, setBld } from './facade.js';
import { HALF, PLAYABLE, elev, floorH, ROOF, CORE, STAIR, CEIL_H, AROUND, finish, wall, doorLeaf } from './tower.js';

export function buildFacade(scene) {
  const geos = [];
  for (let n = 2; n <= 48; n++) {
    if (PLAYABLE.includes(n)) continue;
    const y0 = elev(n), h = floorH(n);
    for (let side = 0; side < 4; side++) {
      const g = new THREE.PlaneGeometry(HALF * 2, h);
      g.translate(0, h / 2, 0);
      const rot = [Math.PI, Math.PI / 2, 0, -Math.PI / 2][side];
      g.rotateY(rot);
      const off = new THREE.Vector3(0, y0, 0);
      if (side === 0) off.z = -HALF; else if (side === 1) off.x = HALF; else if (side === 2) off.z = HALF; else off.x = -HALF;
      g.translate(off.x, off.y, off.z);
      geos.push(g);
    }
  }
  const geo = mergeGeometries(geos);
  setBld(geo, 3, 7.31, 4.2, 0);
  const m = new THREE.Mesh(geo, makeFacadeMaterial({ instanced: false }));
  m.receiveShadow = true; m.name = 'towerFacade';
  scene.add(m);
  return m;
}

// breakable glass of the playable floors (drawn as one mesh per floor, collision is analytic)
export class TowerGlass {
  constructor(scene) {
    this.scene = scene; this.floors = {};
    this.mat = new THREE.MeshPhysicalMaterial({ color: 0xc8d4dc, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.12, depthWrite: false,
      side: THREE.DoubleSide, envMapIntensity: 1.6, specularIntensity: 1, ior: 1.52 });
  }
  addFloor(n, panes) {
    const F = { n, panes, mesh: null, y0: elev(n), h: n === 1 ? 8.0 : CEIL_H };
    this.floors[n] = F; this.rebuild(F);
  }
  rebuild(F) {
    if (F.mesh) { F.mesh.geometry.dispose(); F.mesh.removeFromParent(); }
    const gs = [];
    for (const p of F.panes) {
      if (p.broken) continue;
      const g = new THREE.PlaneGeometry(p.w, p.h - 0.1); g.translate(0, p.h / 2, 0); g.rotateY(p.rot);
      g.translate(p.x, p.y0, p.z); gs.push(g);
    }
    if (!gs.length) return;
    F.mesh = new THREE.Mesh(mergeGeometries(gs), this.mat); F.mesh.renderOrder = 3;
    this.scene.add(F.mesh);
  }
  paneAt(F, side, a) { // a = coordinate along the face
    let best = null, bd = 1e9;
    for (const p of F.panes) { if (p.side !== side) continue; const c = side % 2 === 0 ? p.x : p.z; const d = Math.abs(c - a); if (d < bd) { bd = d; best = p; } }
    return bd < 0.8 ? best : null;
  }
  // analytic collision: the 4 glass planes of every built floor
  probe(o, d, far, size) {
    let best = null;
    for (const k in this.floors) {
      const F = this.floors[k];
      for (let side = 0; side < 4; side++) {
        const ax = side % 2 === 0 ? 'z' : 'x', plane = side === 0 ? -HALF : side === 1 ? HALF : side === 2 ? HALF : -HALF;
        const dv = d[ax]; if (Math.abs(dv) < 1e-9) continue;
        const t = (plane - o[ax]) / dv;
        if (t < 0 || t > far || (best && t >= best.distance)) continue;
        const px = o.x + d.x * t, py = o.y + d.y * t, pz = o.z + d.z * t;
        if (py < F.y0 || py > F.y0 + F.h) continue;
        const along = ax === 'z' ? px : pz;
        if (Math.abs(along) > HALF) continue;
        const p = this.paneAt(F, side, along);
        if (!p || p.broken) continue;
        const n = new THREE.Vector3(); n[ax] = dv > 0 ? -1 : 1;
        best = { point: new THREE.Vector3(px, py, pz), normal: n, distance: t, tag: 'glass', pane: p, floor: F };
      }
    }
    return best;
  }
  breakPane(F, p) { if (p.broken) return false; p.broken = true; this.rebuild(F); return true; }
}

// ------------------------------------------------------------------ roof
export async function buildRoof(mats, scene, ctx) {
  const B = new Batch(mats);
  const y0 = elev(ROOF);
  for (const [x0, z0, x1, z1] of AROUND) B.box(x1 - x0, 0.3, z1 - z0, 'concrete', (x0 + x1) / 2, y0 - 0.15, (z0 + z1) / 2, 'STRUCT');
  finish(B, 'brushedconcrete', y0);
  // parapet + aluminium coping
  for (let side = 0; side < 4; side++) {
    const L = HALF * 2 + 0.3;
    const x = side === 1 ? HALF - 0.15 : side === 3 ? -HALF + 0.15 : 0, z = side === 0 ? -HALF + 0.15 : side === 2 ? HALF - 0.15 : 0;
    B.box(side % 2 ? 0.3 : L, 1.1, side % 2 ? L : 0.3, 'concrete', x, y0 + 0.55, z, 'STRUCT');
    B.box(side % 2 ? 0.36 : L + 0.06, 0.05, side % 2 ? L + 0.06 : 0.36, 'alu', x, y0 + 1.125, z, 'STRUCT');
  }
  // helipad (south half): steel deck on legs, H + circle markings
  const hx = 0, hz = -13.5, hs = 15;
  B.box(hs, 0.18, hs, 'diamond', hx, y0 + 0.9, hz, 'STRUCT');
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.box(0.3, 0.9, 0.3, 'paintYellow', hx + lx * (hs / 2 - 0.4), y0 + 0.45, hz + lz * (hs / 2 - 0.4), 'FURN');
  for (let i = 0; i < 4; i++) B.box(0.6, 0.18, 2.2, 'darkmetal', hx + hs / 2 + 0.3, y0 + 0.45 + i * 0.22, hz + 4 + i * 0.3, 'FURN'); // steps
  ctx.decals.push({ kind: 'helipad', x: hx, y: y0 + 0.992, z: hz, s: hs * 0.86 });
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.lights.push({ p: new THREE.Vector3(hx + Math.cos(a) * 6.8, y0 + 1.1, hz + Math.sin(a) * 6.8), color: 0x30ff60, i: 0.05, r: 3 }); B.box(0.12, 0.08, 0.12, 'ledGreen', hx + Math.cos(a) * 6.9, y0 + 1.03, hz + Math.sin(a) * 6.9, null); }
  // HVAC units with fans (north half)
  for (const [x, z] of [[-14, 12], [-6, 14], [12, 12], [15, 17]]) {
    B.box(4.2, 1.8, 2.6, 'greyPlastic', x, y0 + 0.9, z, 'FURN', 0, 0.06);
    for (const fx of [-1, 1]) { B.cyl(0.85, 0.85, 0.12, 'darkmetal', x + fx * 1.0, y0 + 1.86, z, 'PROP', 24); for (let b = 0; b < 4; b++) B.add(new THREE.BoxGeometry(1.5, 0.02, 0.18), 'black', { p: [x + fx * 1.0, y0 + 1.9, z], r: [0, b * 0.785, 0.2] }, null); }
    B.box(0.5, 0.5, 6, 'alu', x, y0 + 0.4, z - 4.2, 'PROP');
  }
  // old wooden water tank on a steel stand (New Halvern roofs have them)
  const wx = 15, wz = 3.5;
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.box(0.18, 3, 0.18, 'darkmetal', wx + lx * 1.4, y0 + 1.5, wz + lz * 1.4, 'FURN');
  B.box(3.4, 0.2, 3.4, 'darkmetal', wx, y0 + 3.05, wz, 'FURN');
  B.add(new THREE.CylinderGeometry(1.85, 1.95, 4.2, 28), 'wood', { p: [wx, y0 + 5.25, wz] }, 'FURN');
  for (let k = 0; k < 4; k++) B.add(new THREE.TorusGeometry(1.9, 0.035, 6, 32), 'darkmetal', { p: [wx, y0 + 3.7 + k * 1.05, wz], r: [Math.PI / 2, 0, 0] }, null);
  B.add(new THREE.ConeGeometry(2.1, 1.2, 28), 'wood', { p: [wx, y0 + 7.95, wz] }, 'FURN');
  // antenna mast with red aircraft light
  B.cyl(0.12, 0.25, 22, 'paintRed', -15, y0 + 11, -2, 'PROP', 10);
  ctx.lights.push({ p: new THREE.Vector3(-15, y0 + 22.2, -2), color: 0xff2010, i: 0.4, r: 14, blink: true });
  B.add(new THREE.SphereGeometry(0.22, 12, 8), 'ledRed', { p: [-15, y0 + 22.2, -2] }, null);
  // the stair penthouse door to the roof (the core walls at level 49 are built by buildCore) + roof light
  ctx.lights.push({ p: new THREE.Vector3(STAIR.door, y0 + 2.6, CORE.z1 + 0.5), color: 0xffd8a0, i: 0.6, r: 9 });
  // VOSS BIOGENETICS sign: steel frame on the south + north edges, letters drawn as a lit panel
  for (const side of [-1, 1]) {
    for (let i = -3; i <= 3; i++) B.box(0.15, 5.2, 0.15, 'darkmetal', i * 4, y0 + 2.6, side * (HALF - 1.0), 'PROP');
    B.box(26, 0.15, 0.15, 'darkmetal', 0, y0 + 0.6, side * (HALF - 1.0), 'PROP');
    ctx.signs.push({ x: 0, y: y0 + 3.4, z: side * (HALF - 0.9), rot: side < 0 ? Math.PI : 0 });
  }
  const g = new THREE.Group(); g.name = 'roof';
  await B.build(g);
  scene.add(g);
  return { group: g, batch: B };
}

export function makeVossSign() {
  const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 360;
  const x = cv.getContext('2d');
  x.clearRect(0, 0, 2048, 360);
  x.font = '900 230px "Arial Black","Helvetica Neue",Arial,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#ffffff'; x.fillText('VOSS', 620, 175);
  x.font = '700 120px "Arial Narrow",Arial,sans-serif'; x.fillStyle = '#d8e8ff'; x.fillText('BIOGENETICS', 1420, 190);
  // the hourglass-ish V mark
  x.fillStyle = '#ff2a20'; x.beginPath(); x.moveTo(140, 60); x.lineTo(250, 60); x.lineTo(195, 175); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(140, 290); x.lineTo(250, 290); x.lineTo(195, 175); x.closePath(); x.fill();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  mat.color.setScalar(2.4);
  return new THREE.Mesh(new THREE.PlaneGeometry(26, 26 * 360 / 2048), mat);
}

// helipad markings (circle + H) as a decal texture
export function makeHelipad(s) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; const x = cv.getContext('2d');
  x.strokeStyle = '#f0e8d0'; x.lineWidth = 22; x.beginPath(); x.arc(256, 256, 200, 0, Math.PI * 2); x.stroke();
  x.fillStyle = '#f0e8d0'; x.font = '900 260px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('H', 256, 268);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

// Voss's black helicopter (procedural): fuselage lathe, cockpit glass, tail boom, rotors that spin
export function makeHelicopter() {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: 0x08090a, roughness: 0.32, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x101820, roughness: 0.02, metalness: 0.1, transparent: true, opacity: 0.55, clearcoat: 1 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.4, metalness: 0.9 });
  const prof = [[0, -2.6], [0.55, -2.45], [0.95, -1.9], [1.1, -0.8], [1.08, 0.6], [0.85, 1.6], [0.45, 2.2], [0.1, 2.4]].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), paint); body.rotation.x = Math.PI / 2; body.scale.set(1, 1, 0.85); body.position.y = 1.4;
  const cock = new THREE.Mesh(new THREE.SphereGeometry(1.0, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2.1), glass); cock.rotation.x = Math.PI / 2; cock.position.set(0, 1.55, -1.7); cock.scale.set(0.95, 1.1, 0.8);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.42, 5.4, 16), paint); boom.rotation.x = Math.PI / 2; boom.position.set(0, 1.75, 4.6);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 0.9), paint); fin.position.set(0, 2.4, 7.1); fin.rotation.x = -0.35;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 0.5, 12), metal); hub.position.set(0, 2.75, 0.2);
  const rotor = new THREE.Group(); rotor.position.set(0, 3.0, 0.2);
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.05, 0.28), paint); b.position.x = 2.6; const arm = new THREE.Group(); arm.rotation.y = i * Math.PI / 2; arm.add(b); rotor.add(arm); }
  const tail = new THREE.Group(); tail.position.set(0.2, 2.5, 7.2);
  for (let i = 0; i < 2; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.14), paint); b.rotation.x = i * Math.PI / 2; tail.add(b); }
  const skidM = metal;
  for (const sx of [-0.9, 0.9]) {
    const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.4, 8), skidM); sk.rotation.x = Math.PI / 2; sk.position.set(sx, 0.08, 0.1);
    const s1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), skidM); s1.position.set(sx * 0.85, 0.5, -1); s1.rotation.z = sx * 0.3;
    const s2 = s1.clone(); s2.position.z = 1.1;
    g.add(sk, s1, s2);
  }
  g.add(body, cock, boom, fin, hub, rotor, tail);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData = { rotor, tail, spin: 0 };
  return g;
}
