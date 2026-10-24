// Procedural bugs + small animals, built at body length 1 (+Z forward, +Y up, origin on the ground under the body).
// Each builder returns { root, body, legs: [{pivot, side, i}], wings: [], antennae: [], tail?, anim(t, speed, mode) }.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const cache = {};
function mat(key, opt) {
  if (cache[key]) return cache[key];
  const m = new THREE.MeshPhysicalMaterial({ roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.25, ...opt });
  cache[key] = m; return m;
}
function ell(rx, ry, rz, x = 0, y = 0, z = 0, ws = 18, hs = 12) { const g = new THREE.SphereGeometry(1, ws, hs); g.scale(rx, ry, rz); g.translate(x, y, z); return g; }
// tapered tube from a to b
function seg(a, b, r0, r1, rs = 6) {
  const d = new THREE.Vector3().subVectors(b, a), L = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, L, rs, 1);
  g.translate(0, L / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  g.applyQuaternion(q); g.translate(a.x, a.y, a.z);
  return g;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// a leg as one mesh: hip at the origin of its pivot, segments bent outward + down to the ground
function legGeo(side, reach, height, thick, kneeUp = 0.35, back = 0) {
  const hip = V(0, 0, 0), knee = V(side * reach * 0.42, height * (1 + kneeUp), back * 0.3), ankle = V(side * reach * 0.86, height * 0.25, back * 0.75), foot = V(side * reach, -height + 0.004, back);
  return mergeGeometries([seg(hip, knee, thick, thick * 0.85), seg(knee, ankle, thick * 0.8, thick * 0.55), seg(ankle, foot, thick * 0.5, thick * 0.25)]);
}
function addLegs(root, M, defs, gaitPhase) {
  const legs = [];
  defs.forEach((d, i) => {
    for (const side of [-1, 1]) {
      const pv = new THREE.Group(); pv.position.set(side * d.x, d.y, d.z);
      const m = new THREE.Mesh(legGeo(side, d.reach, d.y, d.t, d.kneeUp ?? 0.35, d.back || 0), M);
      pv.add(m); root.add(pv);
      legs.push({ pivot: pv, side, i, phase: (gaitPhase ? gaitPhase(i, side) : ((i + (side > 0 ? 1 : 0)) % 2) * Math.PI), baseY: d.y, swing: d.swing || 0.45 });
    }
  });
  return legs;
}
function animLegs(legs, t, speed, amt = 1) {
  const w = t * (6 + speed * 14);
  for (const L of legs) {
    const s = Math.sin(w + L.phase);
    L.pivot.rotation.y = s * L.swing * amt * L.side;
    L.pivot.rotation.z = Math.max(0, Math.cos(w + L.phase)) * 0.25 * amt * L.side;
  }
}
function wingTex(kind) {
  const k = 'wing_' + kind; if (cache[k]) return cache[k];
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256; const x = cv.getContext('2d');
  x.clearRect(0, 0, 128, 256);
  x.beginPath(); x.ellipse(64, 128, 54, 122, 0, 0, Math.PI * 2);
  if (kind === 'moth') {
    const gr = x.createLinearGradient(0, 0, 128, 256); gr.addColorStop(0, '#8a7458'); gr.addColorStop(0.5, '#5e4c3a'); gr.addColorStop(1, '#9a8466');
    x.fillStyle = gr; x.fill();
    x.fillStyle = 'rgba(40,30,20,0.5)'; for (let i = 0; i < 6; i++) { x.beginPath(); x.ellipse(40 + Math.random() * 50, 40 + i * 34, 10, 4, 0.4, 0, 7); x.fill(); }
    x.strokeStyle = 'rgba(30,22,14,0.6)'; x.lineWidth = 2; x.beginPath(); x.moveTo(20, 60); x.quadraticCurveTo(70, 120, 110, 80); x.stroke();
  } else {
    x.fillStyle = 'rgba(210,220,230,0.28)'; x.fill();
    x.strokeStyle = 'rgba(40,30,25,0.75)'; x.lineWidth = 2.2;
    for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(64, 8); x.quadraticCurveTo(64 + (i - 2.5) * 22, 120, 64 + (i - 2.5) * 16, 240); x.stroke(); }
    x.beginPath(); x.moveTo(20, 110); x.lineTo(108, 150); x.stroke();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  cache[k] = t; return t;
}
function wing(kind, w, l) {
  const m = new THREE.MeshPhysicalMaterial({ map: wingTex(kind), transparent: true, alphaTest: kind === 'moth' ? 0.4 : 0.02, depthWrite: kind === 'moth', side: THREE.DoubleSide, roughness: kind === 'moth' ? 0.9 : 0.15, iridescence: kind === 'moth' ? 0 : 0.8, iridescenceIOR: 1.3 });
  const g = new THREE.PlaneGeometry(w, l); g.rotateX(-Math.PI / 2); g.translate(0, 0, -l / 2);
  return new THREE.Mesh(g, m);
}

// ------------------------------------------------------------------ flies (fruit fly + house fly)
function fly(o) {
  const root = new THREE.Group();
  const bodyM = mat('fly' + o.body, { color: o.body, roughness: 0.55, clearcoat: 0.4 });
  const eyeM = mat('flyeye' + o.eye, { color: o.eye, roughness: 0.2, clearcoat: 1, sheen: 1, sheenColor: new THREE.Color(o.eye) });
  const geos = [ell(0.17, 0.17, 0.2, 0, 0.3, 0.12), ell(0.15, 0.14, 0.28, 0, 0.28, -0.3)];
  const body = new THREE.Mesh(mergeGeometries(geos), bodyM); root.add(body);
  const head = new THREE.Mesh(ell(0.13, 0.12, 0.1, 0, 0.32, 0.38), bodyM); root.add(head);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(ell(0.085, 0.11, 0.08, s * 0.1, 0.33, 0.39), eyeM); root.add(e); }
  if (o.stripes) { const sm = mat('flystripe', { color: 0x15151a, roughness: 0.7 }); for (const s of [-1, 0, 1]) root.add(new THREE.Mesh(ell(0.02, 0.172, 0.18, s * 0.06, 0.305, 0.12), sm)); }
  const legM = mat('flyleg' + o.body, { color: new THREE.Color(o.body).multiplyScalar(0.6), roughness: 0.7, clearcoat: 0 });
  const legs = addLegs(root, legM, [{ x: 0.08, y: 0.24, z: 0.2, reach: 0.32, t: 0.016 }, { x: 0.1, y: 0.24, z: 0.08, reach: 0.38, t: 0.016 }, { x: 0.08, y: 0.24, z: -0.04, reach: 0.4, t: 0.016, back: -0.15 }],
    (i, s) => ((i % 2) ^ (s > 0 ? 1 : 0)) * Math.PI);
  const wings = [];
  for (const s of [-1, 1]) { const w = wing('fly', 0.3, o.wingLen || 0.75); w.position.set(s * 0.1, 0.42, 0.12); w.rotation.y = s * 0.35; root.add(w); wings.push({ m: w, side: s }); }
  return { root, body, legs, wings, anim(t, speed, mode) {
    if (mode === 'fly') { for (const w of wings) { w.m.rotation.z = w.side * (0.6 + Math.sin(t * 190) * 0.9); w.m.rotation.y = w.side * 0.25; } for (const L of legs) { L.pivot.rotation.z = L.side * -0.5; } }
    else { for (const w of wings) { w.m.rotation.z = w.side * 0.05; w.m.rotation.y = w.side * 0.35; } animLegs(legs, t, speed, speed > 0.01 ? 1 : 0.1); }
  } };
}

// ------------------------------------------------------------------ moth (rests with wings folded like a tent)
function moth() {
  const root = new THREE.Group();
  const fur = mat('mothfur', { color: 0x6e5a44, roughness: 0.95, clearcoat: 0, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x9a8a70) });
  const body = new THREE.Mesh(mergeGeometries([ell(0.11, 0.11, 0.16, 0, 0.18, 0.18), ell(0.09, 0.09, 0.3, 0, 0.16, -0.22)]), fur); root.add(body);
  root.add(new THREE.Mesh(ell(0.08, 0.08, 0.07, 0, 0.19, 0.36), fur));
  const ant = mat('mothant', { color: 0x4a3a28, roughness: 0.8 });
  const antennae = [];
  for (const s of [-1, 1]) { const a = new THREE.Mesh(seg(V(s * 0.03, 0.22, 0.4), V(s * 0.16, 0.36, 0.62), 0.008, 0.004), ant); root.add(a); antennae.push(a); }
  const legs = addLegs(root, ant, [{ x: 0.05, y: 0.12, z: 0.22, reach: 0.2, t: 0.012 }, { x: 0.06, y: 0.12, z: 0.12, reach: 0.22, t: 0.012 }, { x: 0.05, y: 0.12, z: 0.02, reach: 0.22, t: 0.012 }]);
  const wings = [];
  for (const s of [-1, 1]) { const w = wing('moth', 0.62, 0.9); w.position.set(s * 0.04, 0.26, 0.32); root.add(w); wings.push({ m: w, side: s }); }
  return { root, body, legs, wings, antennae, anim(t, speed, mode) {
    if (mode === 'fly') for (const w of wings) { w.m.rotation.z = w.side * (Math.sin(t * 38) * 1.0 + 0.2); w.m.rotation.y = w.side * 0.6; }
    else { for (const w of wings) { w.m.rotation.z = w.side * -0.55; w.m.rotation.y = w.side * 0.18; } animLegs(legs, t, speed, speed > 0.01 ? 1 : 0); }
  } };
}

// ------------------------------------------------------------------ cricket
function cricket() {
  const root = new THREE.Group();
  const M = mat('cricket', { color: 0x6a4a28, roughness: 0.45, clearcoat: 0.7 });
  const D = mat('cricketd', { color: 0x3a2814, roughness: 0.5, clearcoat: 0.5 });
  const body = new THREE.Mesh(mergeGeometries([ell(0.11, 0.11, 0.13, 0, 0.17, 0.3), ell(0.12, 0.12, 0.16, 0, 0.18, 0.12), ell(0.12, 0.11, 0.3, 0, 0.17, -0.22)]), M); root.add(body);
  root.add(new THREE.Mesh(ell(0.12, 0.04, 0.32, 0, 0.27, -0.12), D)); // folded wings on the back
  for (const s of [-1, 1]) root.add(new THREE.Mesh(seg(V(s * 0.03, 0.18, -0.5), V(s * 0.08, 0.2, -0.78), 0.008, 0.004), D)); // cerci
  const antennae = [];
  for (const s of [-1, 1]) { const a = new THREE.Mesh(mergeGeometries([seg(V(s * 0.03, 0.22, 0.42), V(s * 0.3, 0.32, 1.1), 0.006, 0.003), seg(V(s * 0.3, 0.32, 1.1), V(s * 0.55, 0.2, 1.6), 0.003, 0.0015)]), D); root.add(a); antennae.push(a); }
  const legs = addLegs(root, D, [{ x: 0.06, y: 0.12, z: 0.3, reach: 0.22, t: 0.02 }, { x: 0.08, y: 0.12, z: 0.15, reach: 0.26, t: 0.02 }]);
  // huge jumping hind legs
  const hind = [];
  for (const s of [-1, 1]) {
    const pv = new THREE.Group(); pv.position.set(s * 0.1, 0.17, 0.0);
    const g = mergeGeometries([seg(V(0, 0, 0), V(s * 0.12, 0.2, -0.4), 0.05, 0.03), seg(V(s * 0.12, 0.2, -0.4), V(s * 0.18, -0.16, -0.36), 0.02, 0.012)]);
    pv.add(new THREE.Mesh(g, M)); root.add(pv); hind.push({ pivot: pv, side: s });
  }
  return { root, body, legs, antennae, anim(t, speed, mode) {
    animLegs(legs, t, speed, speed > 0.01 ? 1 : 0.05);
    for (const h of hind) h.pivot.rotation.x = mode === 'jump' ? -0.9 : 0;
    for (const a of antennae) a.rotation.y = Math.sin(t * 3 + a.id) * 0.08;
  } };
}

// ------------------------------------------------------------------ cockroach (+ the mutant hissing roach)
function roach(o = {}) {
  const root = new THREE.Group();
  const col = o.color || 0x6a2a10;
  const M = mat('roach' + col, { color: col, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12 });
  const L = mat('roachleg' + col, { color: new THREE.Color(col).multiplyScalar(0.7), roughness: 0.5, clearcoat: 0.5 });
  const flat = o.hiss ? 0.16 : 0.1;
  const parts = [ell(0.2, flat, 0.42, 0, 0.13, -0.1), ell(0.17, flat * 0.9, 0.12, 0, 0.14, 0.32)];
  if (o.hiss) for (let i = 0; i < 6; i++) parts.push(ell(0.21 - i * 0.012, 0.035, 0.06, 0, 0.17 + flat * 0.6, 0.22 - i * 0.1));
  const body = new THREE.Mesh(mergeGeometries(parts), M); root.add(body);
  if (o.hiss) for (const s of [-1, 1]) root.add(new THREE.Mesh(ell(0.03, 0.03, 0.04, s * 0.06, 0.25, 0.36), L)); // horn bumps
  root.add(new THREE.Mesh(ell(0.08, 0.06, 0.06, 0, 0.1, 0.45), L)); // head
  const antennae = [];
  for (const s of [-1, 1]) { const a = new THREE.Mesh(mergeGeometries([seg(V(s * 0.03, 0.12, 0.48), V(s * 0.28, 0.22, 1.0), 0.008, 0.004), seg(V(s * 0.28, 0.22, 1.0), V(s * 0.5, 0.18, 1.5), 0.004, 0.002)]), L); root.add(a); antennae.push(a); }
  for (const s of [-1, 1]) root.add(new THREE.Mesh(seg(V(s * 0.05, 0.12, -0.5), V(s * 0.1, 0.12, -0.62), 0.012, 0.005), L));
  const legs = addLegs(root, L, [{ x: 0.12, y: 0.09, z: 0.25, reach: 0.34, t: 0.022, swing: 0.5 }, { x: 0.15, y: 0.09, z: 0.05, reach: 0.42, t: 0.025, back: -0.05 }, { x: 0.13, y: 0.09, z: -0.15, reach: 0.48, t: 0.026, back: -0.3 }]);
  return { root, body, legs, antennae, anim(t, speed, mode) {
    animLegs(legs, t, speed * 1.5, speed > 0.005 ? 1 : 0.05);
    antennae.forEach((a, i) => { a.rotation.y = Math.sin(t * 4 + i * 2) * 0.12; a.rotation.x = Math.sin(t * 3.1 + i) * 0.06; });
    if (o.hiss && mode === 'hiss') body.scale.y = 1 + Math.sin(t * 30) * 0.04;
  } };
}

// ------------------------------------------------------------------ mealworm (segmented larva)
function worm() {
  const root = new THREE.Group();
  const M = mat('worm', { color: 0xc89048, roughness: 0.35, clearcoat: 0.8 });
  const B = mat('wormb', { color: 0x7a4a1c, roughness: 0.4, clearcoat: 0.8 });
  const segs = [];
  for (let i = 0; i < 13; i++) {
    const z = 0.48 - i * 0.078, r = 0.055 * (i < 2 ? 0.85 : i > 10 ? 0.8 : 1);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.07, 12).rotateX(Math.PI / 2), i % 2 ? M : B);
    s.position.set(0, r, z); root.add(s); segs.push(s);
  }
  return { root, body: segs[6], legs: [], anim(t, speed) { segs.forEach((s, i) => { s.position.x = Math.sin(t * 5 - i * 0.6) * 0.025 * (speed > 0.001 ? 1 : 0.3); }); } };
}

// ------------------------------------------------------------------ ant
function ant() {
  const root = new THREE.Group();
  const M = mat('ant', { color: 0x2a1408, roughness: 0.35, clearcoat: 0.9 });
  const body = new THREE.Mesh(mergeGeometries([ell(0.1, 0.09, 0.11, 0, 0.16, 0.36), ell(0.07, 0.07, 0.18, 0, 0.16, 0.12), ell(0.04, 0.05, 0.04, 0, 0.17, -0.06), ell(0.13, 0.12, 0.2, 0, 0.17, -0.26)]), M); root.add(body);
  const antennae = [];
  for (const s of [-1, 1]) { const a = new THREE.Mesh(mergeGeometries([seg(V(s * 0.04, 0.2, 0.44), V(s * 0.06, 0.32, 0.56), 0.012, 0.01), seg(V(s * 0.06, 0.32, 0.56), V(s * 0.16, 0.24, 0.74), 0.01, 0.008)]), M); root.add(a); antennae.push(a); }
  const legs = addLegs(root, M, [{ x: 0.05, y: 0.13, z: 0.18, reach: 0.3, t: 0.016 }, { x: 0.06, y: 0.13, z: 0.11, reach: 0.34, t: 0.016 }, { x: 0.05, y: 0.13, z: 0.04, reach: 0.38, t: 0.016, back: -0.2 }]);
  return { root, body, legs, antennae, anim(t, speed) { animLegs(legs, t, speed * 3, speed > 0.001 ? 1 : 0); antennae.forEach((a, i) => a.rotation.y = Math.sin(t * 7 + i) * 0.2); } };
}

// ------------------------------------------------------------------ silverfish
function silverfish() {
  const root = new THREE.Group();
  const M = mat('silver', { color: 0xa8adb2, roughness: 0.3, metalness: 0.5, clearcoat: 1, sheen: 0.5, sheenColor: new THREE.Color(0xd8dde2) });
  const prof = [[0, -0.5], [0.06, -0.45], [0.12, -0.1], [0.14, 0.2], [0.1, 0.42], [0.0, 0.5]].map(([r, z]) => new THREE.Vector2(r, z));
  const g = new THREE.LatheGeometry(prof, 14); g.rotateX(Math.PI / 2); g.scale(1, 0.4, 1); g.translate(0, 0.06, 0);
  const body = new THREE.Mesh(g, M); root.add(body);
  const tails = [];
  for (const a of [-0.3, 0, 0.3]) { const t = new THREE.Mesh(seg(V(0, 0.06, -0.48), V(Math.sin(a) * 0.4, 0.07, -0.48 - Math.cos(a) * 0.4), 0.008, 0.002), M); root.add(t); tails.push(t); }
  const antennae = [];
  for (const s of [-1, 1]) { const a = new THREE.Mesh(seg(V(s * 0.02, 0.07, 0.48), V(s * 0.3, 0.09, 1.0), 0.008, 0.002), M); root.add(a); antennae.push(a); }
  const legs = addLegs(root, M, [{ x: 0.08, y: 0.05, z: 0.25, reach: 0.18, t: 0.012 }, { x: 0.1, y: 0.05, z: 0.12, reach: 0.2, t: 0.012 }, { x: 0.09, y: 0.05, z: 0.0, reach: 0.2, t: 0.012 }]);
  return { root, body, legs, antennae, anim(t, speed) { animLegs(legs, t, speed * 3, speed > 0.001 ? 1 : 0); body.rotation.y = Math.sin(t * 9) * 0.06 * (speed > 0.001 ? 1 : 0); } };
}

// ------------------------------------------------------------------ house centipede: 15 pairs of long banded legs
function centipede() {
  const root = new THREE.Group();
  const M = mat('centi', { color: 0x9a8a62, roughness: 0.55, clearcoat: 0.4 });
  const S = mat('centis', { color: 0x4a3a5a, roughness: 0.6 });
  const segs = [];
  for (let i = 0; i < 15; i++) {
    const z = 0.45 - i * 0.065;
    const s = new THREE.Mesh(ell(0.05, 0.035, 0.04, 0, 0.13, 0), i % 3 === 1 ? S : M); s.position.z = z; root.add(s); segs.push(s);
  }
  const legs = [];
  for (let i = 0; i < 15; i++) for (const side of [-1, 1]) {
    const pv = new THREE.Group(); pv.position.set(side * 0.04, 0.13, 0.45 - i * 0.065);
    const L = 0.35 + i * 0.03;
    const g = mergeGeometries([seg(V(0, 0, 0), V(side * L * 0.4, 0.16, 0), 0.008, 0.007), seg(V(side * L * 0.4, 0.16, 0), V(side * L, -0.125, -0.05 - i * 0.008), 0.006, 0.002)]);
    pv.add(new THREE.Mesh(g, i % 2 ? M : S)); root.add(pv);
    legs.push({ pivot: pv, side, i, phase: i * 0.55 + (side > 0 ? Math.PI : 0), swing: 0.35 });
  }
  const antennae = [];
  for (const s of [-1, 1]) { const a = new THREE.Mesh(seg(V(s * 0.02, 0.14, 0.48), V(s * 0.45, 0.2, 1.4), 0.006, 0.0015), M); root.add(a); antennae.push(a); }
  return { root, body: segs[7], legs, antennae, anim(t, speed) { animLegs(legs, t, speed * 2.5, speed > 0.001 ? 1 : 0.05); antennae.forEach((a, i) => a.rotation.y = Math.sin(t * 5 + i * 3) * 0.15); } };
}

// ------------------------------------------------------------------ gecko (house gecko: pale, spotted, sticky toes)
function gecko() {
  const root = new THREE.Group();
  const skin = mat('gecko', { color: 0xc8b088, roughness: 0.55, clearcoat: 0.3, sheen: 0.4, sheenColor: new THREE.Color(0xe8d8b8) });
  const prof = [[0, -0.02], [0.05, 0.0], [0.09, 0.08], [0.1, 0.2], [0.08, 0.3], [0.06, 0.34], [0.07, 0.4], [0.06, 0.48], [0.0, 0.52]].map(([r, z]) => new THREE.Vector2(r, z));
  const g = new THREE.LatheGeometry(prof, 16); g.rotateX(Math.PI / 2); g.scale(1, 0.6, 1); g.translate(0, 0.06, 0);
  const body = new THREE.Mesh(g, skin); root.add(body);
  const eyeM = mat('geckoeye', { color: 0x1a1a10, roughness: 0.05, clearcoat: 1 });
  for (const s of [-1, 1]) root.add(new THREE.Mesh(ell(0.022, 0.022, 0.022, s * 0.045, 0.085, 0.44), eyeM));
  // tail
  const tailPts = []; for (let i = 0; i <= 10; i++) tailPts.push(V(0, 0.05 - i * 0.002, -0.02 - i * 0.05));
  const tailCurve = new THREE.CatmullRomCurve3(tailPts);
  const tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 20, 0.04, 8), skin); root.add(tail);
  tail.geometry.computeBoundingBox();
  const legs = [];
  for (const [z, i] of [[0.3, 0], [0.06, 1]]) for (const side of [-1, 1]) {
    const pv = new THREE.Group(); pv.position.set(side * 0.07, 0.05, z);
    const gg = mergeGeometries([seg(V(0, 0, 0), V(side * 0.09, 0.03, 0.02), 0.022, 0.018), seg(V(side * 0.09, 0.03, 0.02), V(side * 0.14, -0.05, 0.05), 0.016, 0.012), ell(0.03, 0.006, 0.03, side * 0.15, -0.05, 0.06)]);
    pv.add(new THREE.Mesh(gg, skin)); root.add(pv);
    legs.push({ pivot: pv, side, i, phase: ((i + (side > 0 ? 1 : 0)) % 2) * Math.PI, swing: 0.55 });
  }
  return { root, body, legs, tail, anim(t, speed) { animLegs(legs, t, speed * 1.2, speed > 0.01 ? 1 : 0); body.rotation.y = Math.sin(t * 8) * 0.1 * (speed > 0.01 ? 1 : 0); tail.rotation.y = -Math.sin(t * 8) * 0.25 * (speed > 0.01 ? 1 : 0.2); } };
}

// ------------------------------------------------------------------ rodents (mouse / rat): furry lathe body, ears, whiskers, tail
function furTex(col) {
  const k = 'fur' + col; if (cache[k]) return cache[k];
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d');
  const c = new THREE.Color(col);
  x.fillStyle = '#' + c.getHexString(); x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) { const l = Math.random() < 0.5 ? 255 : 0; x.strokeStyle = `rgba(${l},${l},${l},${0.06 + Math.random() * 0.08})`; const px = Math.random() * 256, py = Math.random() * 256; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (Math.random() - 0.5) * 3, py + 6 + Math.random() * 8); x.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3);
  cache[k] = t; return t;
}
function rodent(o) {
  const root = new THREE.Group();
  const fur = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: furTex(o.fur), roughness: 0.95, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(o.fur).multiplyScalar(1.6) });
  const pink = mat('rodentpink', { color: 0xd89a92, roughness: 0.6, clearcoat: 0.2, sheen: 0.3 });
  const prof = [[0, -0.42], [0.12, -0.38], [0.19, -0.2], [0.2, 0.0], [0.17, 0.16], [0.12, 0.28], [0.1, 0.34], [0.09, 0.42], [0.05, 0.52], [0.0, 0.56]].map(([r, z]) => new THREE.Vector2(r, z));
  const g = new THREE.LatheGeometry(prof, 22); g.rotateX(Math.PI / 2); g.scale(1, 0.92, 1); g.translate(0, 0.17, 0);
  const body = new THREE.Mesh(g, fur); root.add(body);
  const head = new THREE.Group(); root.add(head);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(o.ear, o.ear, 0.01, 16).rotateX(Math.PI / 2), pink); ear.position.set(s * 0.08, 0.3, 0.3); ear.rotation.y = s * 0.4; head.add(ear);
    const eye = new THREE.Mesh(ell(0.024, 0.024, 0.02, s * 0.075, 0.24, 0.4), mat('rodenteye', { color: 0x050505, roughness: 0.02, clearcoat: 1 })); head.add(eye);
  }
  const nose = new THREE.Mesh(ell(0.022, 0.018, 0.018, 0, 0.17, 0.56), pink); head.add(nose);
  const wm = new THREE.LineBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.6 });
  const wp = []; for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { wp.push(s * 0.03, 0.17, 0.54, s * (0.18 + Math.random() * 0.06), 0.15 + (i - 1.5) * 0.03, 0.5 + Math.random() * 0.06); }
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); head.add(new THREE.LineSegments(wg, wm));
  const tailPts = []; for (let i = 0; i <= 12; i++) tailPts.push(V(Math.sin(i * 0.4) * 0.04, 0.12 - i * 0.008, -0.4 - i * o.tail / 12));
  const tail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tailPts), 24, 0.022, 6), pink); root.add(tail);
  const legs = [];
  for (const [z, i] of [[0.2, 0], [-0.2, 1]]) for (const side of [-1, 1]) {
    const pv = new THREE.Group(); pv.position.set(side * 0.12, 0.1, z);
    const gg = mergeGeometries([seg(V(0, 0, 0), V(side * 0.02, -0.08, 0.02), 0.035, 0.025), ell(0.03, 0.012, 0.045, side * 0.02, -0.09, 0.04)]);
    pv.add(new THREE.Mesh(gg, i === 0 ? pink : fur)); root.add(pv);
    legs.push({ pivot: pv, side, i, phase: ((i + (side > 0 ? 1 : 0)) % 2) * Math.PI, swing: 0.4 });
  }
  return { root, body, legs, tail, head, anim(t, speed, mode) {
    const run = speed > 0.02;
    for (const L of legs) L.pivot.rotation.x = Math.sin(t * (8 + speed * 10) + L.phase) * (run ? 0.7 : 0.05);
    body.position.y = run ? Math.abs(Math.sin(t * (8 + speed * 10))) * 0.03 : 0;
    head.position.y = body.position.y; head.rotation.x = run ? 0 : Math.sin(t * 2.3) * 0.08;
    nose.scale.setScalar(1 + (run ? 0 : Math.max(0, Math.sin(t * 18)) * 0.25)); // sniffing
    tail.rotation.y = Math.sin(t * 3) * 0.25;
  } };
}

export const MODELS = {
  fruitfly: () => fly({ body: 0xb8914c, eye: 0xd8160c, wingLen: 0.8 }),
  housefly: () => fly({ body: 0x4a4a4e, eye: 0x8a2a14, stripes: true, wingLen: 0.7 }),
  moth, cricket,
  roach: () => roach({ color: 0x6a2a10 }),
  giantroach: () => roach({ color: 0x3a1a0c, hiss: true }),
  mealworm: worm, ant, silverfish, centipede, gecko,
  mouse: () => rodent({ fur: 0x8a7a6a, ear: 0.07, tail: 0.75 }),
  rat: () => rodent({ fur: 0x5a4c40, ear: 0.055, tail: 0.95 }),
};
