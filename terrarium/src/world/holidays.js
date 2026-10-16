// Real-date holidays: Halloween (October), Christmas (December), New Year (Jan 1-7), Valentine's (Feb 1-14).
import * as THREE from 'three';
import { std, glow } from './materials.js';
import { makeRng } from '../core/util.js';

export function currentHoliday(d = new Date()) {
  const m = d.getMonth(), day = d.getDate();
  if (m === 9) return 'halloween';
  if (m === 11) return 'christmas';
  if (m === 0 && day <= 7) return 'newyear';
  if (m === 1 && day <= 14) return 'valentine';
  return null;
}

function pumpkin(scale, lit) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), std(0xe36d14, 0.6));
  body.scale.set(1, 0.78, 1);
  body.castShadow = true;
  g.add(body);
  for (let i = 0; i < 8; i++) {
    const rib = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), std(0xd8620f, 0.65));
    rib.scale.set(0.35, 0.8, 0.35);
    const a = (i / 8) * Math.PI * 2;
    rib.position.set(Math.cos(a) * 0.72, 0, Math.sin(a) * 0.72);
    g.add(rib);
  }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.35, 6), std(0x4a5a2a, 0.8));
  stem.position.y = 0.85; stem.rotation.z = 0.2;
  g.add(stem);
  if (lit) {
    const face = glow(0xffa030, 2.5);
    for (const x of [-0.35, 0.35]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.2, 3), face); e.position.set(x, 0.18, 0.9); e.rotation.x = Math.PI / 2; g.add(e); }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.1), face); mouth.position.set(0, -0.22, 0.92); g.add(mouth);
  }
  g.scale.setScalar(scale);
  return g;
}

export function buildHolidays(world) {
  const kind = currentHoliday();
  if (!kind) return null;
  const r = makeRng(31);
  const lights = [];
  const flick = [];
  const add = (obj, parent) => { parent.add(obj); return obj; };
  if (kind === 'halloween') {
    // lab: carved pumpkins on the workbench, chem table, by the cage; cobwebs; orange string lights
    for (const [x, y, z, s] of [[-3.2, 0.98, -5.4, 0.12], [1.5, 0.93, 5.3, 0.1], [2.6, 0.12, 1.6, 0.18], [-1.7, 0.12, 1.6, 0.15], [5.2, 0.94, 1.4, 0.06]]) {
      const p = add(pumpkin(s, true), world.lab); p.position.set(x, y + s * 0.7, z); p.rotation.y = r() * 1 - 0.5 + Math.PI * (z < 0 ? 0 : 1);
      const l = new THREE.PointLight(0xff8a20, 0.8, 2.2, 2); l.position.set(x, y + s, z + (z < 0 ? 0.2 : -0.2)); world.lab.add(l); flick.push(l);
    }
    // string lights along the ceiling pipe
    for (let i = 0; i < 28; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), glow(i % 2 ? 0xff7a10 : 0xb050ff, 2.2));
      b.position.set(-6.5 + i * 0.48, 2.95 - Math.abs(Math.sin(i * 0.9)) * 0.08, -1.2);
      world.lab.add(b); lights.push(b);
    }
    // cobwebs in corners
    const webMat = new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    for (const [x, z, ry] of [[-6.95, -5.95, 0.785], [6.95, -5.95, -0.785], [6.95, 5.95, -2.35]]) {
      const geo = new THREE.BufferGeometry(); const v = [];
      for (let i = 0; i < 7; i++) { const a = (i / 6) * Math.PI / 2; v.push(0, 0, 0, Math.cos(a) * 0.8, -Math.sin(a) * 0.8, 0); }
      for (let k = 1; k < 5; k++) for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI / 2, b = ((i + 1) / 6) * Math.PI / 2, rr = k * 0.17; v.push(Math.cos(a) * rr, -Math.sin(a) * rr, 0, Math.cos(b) * rr, -Math.sin(b) * rr, 0); }
      geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      const web = new THREE.LineSegments(geo, webMat); web.position.set(x, 3.15, z); web.rotation.y = ry; world.lab.add(web);
    }
    // street: porch pumpkins + a scarecrow-ish ghost on the lawn
    for (const [x, z, s] of [[1.2, 6.8, 0.25], [-1.2, 6.8, 0.2], [-1.6, 7.1, 0.14], [-24, 5.6, 0.3], [16, 4, 0.25]]) {
      const p = add(pumpkin(s, true), world.street); p.position.set(x, 3.4 + s * 0.75, z);
    }
    const ghost = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0xf4f4f4, side: THREE.DoubleSide, roughness: 0.9 }));
    ghost.position.set(-5, 3.4 + 0.8, 9);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), std(0xf4f4f4, 0.9)); head.position.y = 0.85; ghost.add(head);
    for (const x of [-0.1, 0.1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), std(0x111111, 0.5)); e.position.set(x, 0.9, 0.28); ghost.add(e); }
    world.street.add(ghost);
  } else if (kind === 'christmas') {
    const tree = new THREE.Group();
    for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.7 - i * 0.14, 0.7, 12), std(0x1f5a2a, 0.8)); c.position.y = 0.5 + i * 0.4; c.castShadow = true; tree.add(c); }
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), glow(0xffd040, 3)); star.position.y = 2.1; tree.add(star);
    for (let i = 0; i < 24; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), glow([0xff3030, 0x30ff60, 0x3080ff, 0xffd040][i % 4], 2)); const a = i * 2.4, h = 0.3 + (i / 24) * 1.5; b.position.set(Math.cos(a) * (0.62 - h * 0.28), h, Math.sin(a) * (0.62 - h * 0.28)); tree.add(b); lights.push(b); }
    tree.position.set(-1.5, 3.4, -4.5); world.house.add(tree);
    const t2 = tree.clone(); t2.scale.setScalar(0.5); t2.position.set(-6, 0, 4.5); world.lab.add(t2);
    for (let i = 0; i < 6; i++) { const gift = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.25), std([0xc02020, 0x2050c0, 0x20a040][i % 3], 0.6)); gift.position.set(-1.5 + (r() - 0.5) * 1.2, 3.5, -4.5 + (r() - 0.5) * 1.2); world.house.add(gift); }
  } else if (kind === 'newyear') {
    for (let i = 0; i < 30; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), glow([0xffd040, 0xffffff, 0x60c0ff][i % 3], 2.5)); b.position.set(-6.5 + i * 0.45, 2.95, 1.0); world.lab.add(b); lights.push(b); }
  } else if (kind === 'valentine') {
    for (let i = 0; i < 12; i++) {
      const h = new THREE.Group();
      const s1 = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), glow(0xff3070, 1.5));
      const s2 = s1.clone(); s1.position.x = -0.04; s2.position.x = 0.04;
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.12, 12), glow(0xff3070, 1.5)); c.rotation.z = Math.PI; c.position.y = -0.06;
      h.add(s1, s2, c); h.position.set(-6 + i, 2.7, -1.2); world.lab.add(h); lights.push(h);
    }
  }
  return {
    kind,
    update(dt, time, night) {
      for (const l of flick) l.intensity = 0.6 + Math.sin(time * 13 + l.position.x) * 0.15 + Math.random() * 0.1;
      void night;
      lights.forEach((b, i) => { const m = b.material || (b.children[0] && b.children[0].material); if (m && m.emissiveIntensity !== undefined) m.emissiveIntensity = 1.4 + Math.sin(time * 3 + i) * 0.9; });
    },
  };
}
