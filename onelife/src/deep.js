// Smaller than a virus: the worlds you can't see with light anymore.
// Molecules (real DNA shape) -> atoms (the real crystal of the sand grain you stood on: quartz)
// -> inside one atom (almost all empty) -> the nucleus (silicon: 14 protons + 14 neutrons)
// -> inside a proton (3 quarks + the gluon field) -> below anything ever measured -> the Planck length -> past it.
import * as THREE from 'three';
import { cellRand } from './noise.js';

export const REALMS = [
  { id: 'molecules', name: 'Molecules', hi: 1e-7, lo: 3e-10, bg: 0x1c1f24, fog: 0.012 },
  { id: 'atoms', name: 'Atoms - inside the sand grain (quartz crystal)', hi: 3e-10, lo: 4e-13, bg: 0x05040c, fog: 0.004 },
  { id: 'atom', name: 'Inside one atom - it is almost all empty', hi: 4e-13, lo: 3e-15, bg: 0x020208, fog: 0.0008 },
  { id: 'nucleus', name: 'The nucleus - 14 protons, 14 neutrons', hi: 3e-15, lo: 4e-17, bg: 0x0b0302, fog: 0.004 },
  { id: 'quarks', name: 'Inside a proton - quarks and the gluon field', hi: 4e-17, lo: 1e-20, bg: 0x030006, fog: 0.003 },
  { id: 'foam', name: 'Smaller than anything ever measured', hi: 1e-20, lo: 1.6e-35 / 1.8, bg: 0x000000, fog: 0.004 },
  { id: 'floor', name: 'Below the Planck length - size stops meaning anything', hi: 1.6e-35 / 1.8, lo: 1e-60, bg: 0x000000, fog: 0.003 },
];
export const realmFor = k => { for (let i = 0; i < REALMS.length; i++) if (k > REALMS[i].lo) return i; return REALMS.length - 1; };

let glowTex;
function glow() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.2, 'rgba(255,255,255,0.6)'); r.addColorStop(0.5, 'rgba(255,255,255,0.15)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return glowTex = new THREE.CanvasTexture(c);
}
const pointsMat = (size, opacity = 0.9) => new THREE.PointsMaterial({ size, userData: { ms: size }, map: glow(), vertexColors: true, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });

export class Deep {
  constructor(scene) {
    this.group = new THREE.Group(); this.group.visible = false; scene.add(this.group);
    this.realm = -1; this.items = null; this.t = 0;
    this.light = new THREE.HemisphereLight(0xdfe6ff, 0x30302a, 0.55); this.key = new THREE.DirectionalLight(0xffffff, 1.3); this.key.position.set(0.4, 1, 0.3);
    this.lights = new THREE.Group(); this.lights.add(this.light, this.key); this.lights.visible = false; scene.add(this.lights);
  }
  // build the world for realm i around q=0. unit = typical size (meters)
  enter(i, seed, dir) {
    if (this.items) { this.group.remove(this.items.pivot); this.items.root.traverse(o => { o.geometry?.dispose(); }); }
    this.realm = i; const R = REALMS[i];
    // things you shrink toward (atom, nucleus, quarks) appear in front of where you're looking
    const pivot = new THREE.Group(); this.group.add(pivot);
    if (dir && ['atom', 'nucleus', 'quarks'].includes(R.id)) pivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
    const root = new THREE.Group(); pivot.add(root);
    this.items = { root, pivot, update: () => {} };
    const build = { molecules, atoms, atom, nucleus, quarks, foam, floor }[R.id];
    build(this.items, seed * 31 + i);
    return R;
  }
  update(dt, k, q) {
    this.t += dt;
    this.group.position.set(-q.x / k, -q.y / k, -q.z / k); this.group.scale.setScalar(1 / k);
    this.items?.update(this.t, k, q, dt);
    this.group.traverse(o => { if (o.isPoints) o.material.size = o.material.userData.ms / k; });
  }
}

// ---------- molecules: DNA double helices (2 nm wide, a turn every 3.4 nm), proteins, water ----------
function dnaGeo(turns, seed) {
  const r = cellRand(seed, 1, 2), parts = [], RAD = 1e-9, PITCH = 3.4e-9, n = turns * 10.5;
  const colA = new THREE.Color(0xd9dde3), colB = new THREE.Color(0xb6bcc6);
  const posA = [], posB = [];
  for (let i = 0; i <= n; i++) {
    const t = i / 10.5 * Math.PI * 2, y = i * PITCH / 10.5;
    posA.push(new THREE.Vector3(Math.cos(t) * RAD, y, Math.sin(t) * RAD));
    posB.push(new THREE.Vector3(Math.cos(t + 2.4) * RAD, y, Math.sin(t + 2.4) * RAD)); // minor + major groove (real 2.4 rad offset)
  }
  const tube = (pts) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 3, 0.25e-9, 8, false);
  parts.push(tube(posA), tube(posB));
  for (let i = 0; i < posA.length; i += 1) {
    const a = posA[i], b = posB[i], mid = a.clone().lerp(b, 0.5), len = a.distanceTo(b);
    const c = new THREE.CylinderGeometry(0.16e-9, 0.16e-9, len * 0.9, 6); c.rotateZ(Math.PI / 2);
    const m = new THREE.Matrix4().lookAt(a, b, new THREE.Vector3(0, 1, 0)); c.rotateY(Math.PI / 2); c.applyMatrix4(m); c.translate(mid.x, mid.y, mid.z);
    parts.push(c);
  }
  const g = mergeParts(parts); g.translate(0, -n * PITCH / 21, 0); return g;
}
function mergeParts(parts) {
  let n = 0; for (const p of parts) n += (p.index ? p.index.count : p.attributes.position.count);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (let p of parts) { if (p.index) p = p.toNonIndexed(); if (!p.attributes.normal) p.computeVertexNormals(); pos.set(p.attributes.position.array, o * 3); nor.set(p.attributes.normal.array, o * 3); o += p.attributes.position.count; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); return g;
}
function blobGeo(seed, r0) {
  const g = new THREE.IcosahedronGeometry(r0, 4), p = g.attributes.position, v = new THREE.Vector3(), r = cellRand(seed, 4, 4);
  const a = [r() * 9, r() * 9, r() * 9, r() * 9];
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); const n = Math.sin(v.x * 3 + a[0]) * Math.sin(v.y * 4 + a[1]) * 0.18 + Math.sin(v.z * 7 + a[2]) * Math.cos(v.x * 6 + a[3]) * 0.1 + Math.sin(v.y * 13 + v.x * 11) * 0.03; v.multiplyScalar(r0 * (1 + n)); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
}
function molecules(I, seed) {
  const r = cellRand(seed, 5, 5), root = I.root;
  const mat = new THREE.MeshStandardMaterial({ color: 0xcfd3d8, roughness: 0.55, metalness: 0.05 });
  const things = [];
  for (let i = 0; i < 26; i++) {
    const g = dnaGeo(6 + Math.floor(r() * 10), seed + i), m = new THREE.Mesh(g, mat);
    m.position.set((r() - 0.5) * 220e-9, (r() - 0.5) * 120e-9, (r() - 0.5) * 220e-9); m.rotation.set(r() * 6, r() * 6, r() * 6);
    root.add(m); things.push({ m, w: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.05) });
  }
  for (let i = 0; i < 70; i++) {
    const m = new THREE.Mesh(blobGeo(seed * 7 + i, (2.5 + r() * 7) * 1e-9), mat);
    m.position.set((r() - 0.5) * 200e-9, (r() - 0.5) * 110e-9, (r() - 0.5) * 200e-9); root.add(m);
    things.push({ m, w: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.3) });
  }
  // water molecules everywhere (0.28 nm): as a fine shimmering cloud
  const N = 9000, P = new Float32Array(N * 3), C = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { P.set([(r() - 0.5) * 160e-9, (r() - 0.5) * 90e-9, (r() - 0.5) * 160e-9], i * 3); const l = 0.35 + r() * 0.3; C.set([l, l, l], i * 3); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(P, 3)); pg.setAttribute('color', new THREE.BufferAttribute(C, 3));
  const pts = new THREE.Points(pg, pointsMat(0.6e-9, 0.5)); root.add(pts);
  I.update = (t, k, q, dt) => { for (const o of things) { o.m.rotation.x += o.w.x * dt; o.m.rotation.y += o.w.y * dt; } pts.material.userData.ms = Math.max(0.6e-9, k * 0.05); };
}

// ---------- atoms: cristobalite (a form of quartz, SiO2): Si on a diamond lattice (a = 0.716 nm), O between ----------
function atoms(I, seed) {
  const a = 0.716e-9, root = I.root, si = [], ox = [];
  const basis = [[0, 0, 0], [0, .5, .5], [.5, 0, .5], [.5, .5, 0], [.25, .25, .25], [.25, .75, .75], [.75, .25, .75], [.75, .75, .25]];
  const nb = [[.25, .25, .25], [-.25, -.25, .25], [-.25, .25, -.25], [.25, -.25, -.25]];
  const n = 5;
  for (let x = -n; x < n; x++) for (let y = -n; y < n; y++) for (let z = -n; z < n; z++) for (const b of basis) {
    const p = [(x + b[0]) * a, (y + b[1]) * a, (z + b[2]) * a]; si.push(p);
    const s = (b[0] * 4 + b[1] * 4 + b[2] * 4) % 2 === 0 ? 1 : -1; // A sites bond to the 4 neighbours
    if (s > 0 && Math.abs(b[0] % 0.5) < 1e-6) for (const d of nb) ox.push([p[0] + d[0] * a * 0.5, p[1] + d[1] * a * 0.5, p[2] + d[2] * a * 0.5]);
  }
  const mk = (list, col, size, jitter) => {
    const N = list.length, P = new Float32Array(N * 3), C = new Float32Array(N * 3), c = new THREE.Color(col);
    list.forEach((p, i) => { P.set(p, i * 3); C.set([c.r, c.g, c.b], i * 3); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    const pts = new THREE.Points(g, pointsMat(size)); root.add(pts); return pts;
  };
  const sP = mk(si, 0x5f6ad8, 0.42e-9), oP = mk(ox, 0xd8553a, 0.3e-9); sP.material.opacity = oP.material.opacity = 0.55;
  // electron cloud shimmer: each atom's cloud breathes a bit (electrons are a probability, not dots)
  I.update = (t) => { sP.material.userData.ms = 0.42e-9 * (1 + Math.sin(t * 3.1) * 0.04); oP.material.userData.ms = 0.3e-9 * (1 + Math.sin(t * 3.7 + 1) * 0.05); };
  root.position.set(0.37 * a, -0.1 * a, 0.21 * a);
}

// ---------- inside one atom: electron cloud as a probability haze, nucleus 100,000x smaller in the middle ----------
function atom(I, seed) {
  const root = I.root, r = cellRand(seed, 8, 8), N = 14000, P = new Float32Array(N * 3), C = new Float32Array(N * 3);
  const R = 1.1e-10;
  for (let i = 0; i < N; i++) {
    // 1s/2s/2p/3s/3p shells of silicon: radial probability ~ r^2 e^(-2r/a)
    const shell = r(), a0 = shell < 0.15 ? 0.05 : shell < 0.55 ? 0.3 : 0.75;
    let rr = 0; for (let k = 0; k < 3; k++) rr += -Math.log(1 - r() * 0.999) * a0 / 2; rr *= R;
    const th = Math.acos(2 * r() - 1), ph = r() * Math.PI * 2;
    P.set([rr * Math.sin(th) * Math.cos(ph), rr * Math.cos(th), rr * Math.sin(th) * Math.sin(ph)], i * 3);
    const c = shell < 0.15 ? [0.5, 0.6, 1] : shell < 0.55 ? [0.45, 0.5, 0.95] : [0.35, 0.35, 0.8]; C.set(c, i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  const cloud = new THREE.Points(g, pointsMat(4e-12, 0.12)); root.add(cloud);
  const nuc = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: 0xffb070, blending: THREE.AdditiveBlending, depthWrite: false }));
  nuc.scale.setScalar(6e-15); root.add(nuc);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: 0xff7a30, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 }));
  root.add(halo);
  root.position.set(0, 0, -6e-12);
  I.update = (t, k) => {
    cloud.rotation.y = t * 0.05; cloud.material.userData.ms = Math.max(4e-12, k * 0.6);
    halo.scale.setScalar(Math.max(6e-15, k * 9)); // the suit marks where the nucleus is
  };
  I.target = new THREE.Vector3(0, 0, -6e-12);
}

// ---------- nucleus: 14 protons + 14 neutrons, each ~1.7 fm across, jiggling ----------
function nucleus(I, seed) {
  const root = I.root, r = cellRand(seed, 2, 9), list = [];
  const pm = new THREE.MeshStandardMaterial({ color: 0xff8a5c, emissive: 0x6a1d08, roughness: 0.4 });
  const nm = new THREE.MeshStandardMaterial({ color: 0x9aa4b4, emissive: 0x1a1f2a, roughness: 0.45 });
  const geo = new THREE.SphereGeometry(0.85e-15, 32, 24);
  const pts = [];
  while (pts.length < 28) { const v = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(6.2e-15); if (v.length() < 3.1e-15 && pts.every(p => p.distanceTo(v) > 1.45e-15)) pts.push(v); }
  pts.forEach((p, i) => { const m = new THREE.Mesh(geo, i % 2 ? pm : nm); m.position.copy(p); root.add(m); list.push({ m, b: p.clone(), ph: r() * 9 }); });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: 0xff6a30, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.35 })); halo.scale.setScalar(16e-15); root.add(halo);
  root.position.set(0, 0, -9e-15);
  I.update = (t) => { for (const o of list) o.m.position.set(o.b.x + Math.sin(t * 7 + o.ph) * 0.06e-15, o.b.y + Math.sin(t * 9 + o.ph * 2) * 0.06e-15, o.b.z + Math.cos(t * 8 + o.ph) * 0.06e-15); root.rotation.y = t * 0.05; };
}

// ---------- quarks: up, up, down with red/green/blue colour charge, joined by gluon flux tubes; virtual pairs pop ----------
function quarks(I, seed) {
  const root = I.root, r = cellRand(seed, 6, 1);
  const cols = [0xff3b3b, 0x3bff6a, 0x4a6bff];
  const q = cols.map((c, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: c, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.setScalar(0.25e-15); root.add(s); return s; });
  const tubes = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); root.add(m); return m; });
  const N = 1400, P = new Float32Array(N * 3), C = new Float32Array(N * 3), life = new Float32Array(N);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(P, 3)); pg.setAttribute('color', new THREE.BufferAttribute(C, 3));
  const sea = new THREE.Points(pg, pointsMat(0.04e-15, 0.8)); root.add(sea);
  const respawn = i => { const v = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(1.7e-15); P.set([v.x, v.y, v.z], i * 3); const c = new THREE.Color(cols[Math.floor(r() * 3)]); C.set([c.r, c.g, c.b], i * 3); life[i] = r() * 0.6; };
  for (let i = 0; i < N; i++) respawn(i);
  root.position.set(0, 0, -1.6e-15);
  const up = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3();
  I.update = (t, k, qq, dt) => {
    q.forEach((s, i) => { const a = t * (0.9 + i * 0.37) + i * 2.1; s.position.set(Math.cos(a) * 0.45e-15, Math.sin(a * 1.3) * 0.4e-15, Math.sin(a) * 0.45e-15); s.scale.setScalar(Math.max(0.12e-15, k * 0.5)); });
    tubes.forEach((m, i) => { const a = q[i].position, b = q[(i + 1) % 3].position; tmp.subVectors(b, a); const l = tmp.length(); m.position.copy(a).addScaledVector(tmp, 0.5); m.quaternion.setFromUnitVectors(up, tmp.normalize()); m.scale.set(0.05e-15, l, 0.05e-15); });
    for (let i = 0; i < N; i++) { life[i] -= dt; if (life[i] <= 0) respawn(i); }
    pg.attributes.position.needsUpdate = true; pg.attributes.color.needsUpdate = true; sea.material.userData.ms = Math.max(0.03e-15, k * 0.05);
  };
}

// ---------- quantum foam: space itself bubbling; gets more violent the deeper you go ----------
function foam(I, seed) {
  const root = I.root, r = cellRand(seed, 3, 3), N = 5000, P = new Float32Array(N * 3), C = new Float32Array(N * 3), base = [];
  for (let i = 0; i < N; i++) { const v = [(r() - 0.5), (r() - 0.5), (r() - 0.5)]; base.push(v); const l = 0.4 + r() * 0.6; C.set([l * 0.7, l * 0.75, l], i * 3); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(P, 3)); pg.setAttribute('color', new THREE.BufferAttribute(C, 3));
  const pts = new THREE.Points(pg, pointsMat(1, 0.7)); root.add(pts);
  const shells = []; const sm = new THREE.MeshBasicMaterial({ color: 0x8fa2ff, wireframe: true, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), sm); root.add(m); shells.push({ m, ph: r() * 9, p: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5) }); }
  I.update = (t, k, q) => {
    const span = k * 60, depth = Math.max(0, -Math.log10(k) - 20) / 14; // 0 at 1e-20, 1 at the Planck length
    root.position.set(q.x, q.y, q.z);
    for (let i = 0; i < N; i++) { const b = base[i], w = Math.sin(t * (3 + depth * 9) + i) * (0.02 + depth * 0.08); P[i * 3] = (b[0] + w) * span; P[i * 3 + 1] = (b[1] + w * 0.7) * span; P[i * 3 + 2] = (b[2] - w) * span; }
    pg.attributes.position.needsUpdate = true; pts.material.userData.ms = k * (0.25 + depth * 0.5);
    for (const s of shells) { const life = (Math.sin(t * (0.8 + depth * 3) + s.ph) + 1) / 2; s.m.position.copy(s.p).multiplyScalar(span * 0.8); s.m.scale.setScalar(k * (2 + life * 14)); s.m.rotation.set(t * 0.3 + s.ph, t * 0.2, 0); }
    sm.opacity = 0.05 + depth * 0.12;
  };
}

// ---------- past the Planck length: no more "space", just a grid of reality's last pixels blinking ----------
function floor(I, seed) {
  const root = I.root, r = cellRand(seed, 1, 1), n = 14, N = n * n * n, P = new Float32Array(N * 3), C = new Float32Array(N * 3), ph = [];
  let i = 0; for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) { P.set([x - n / 2, y - n / 2, z - n / 2], i * 3); ph.push(r() * 9); i++; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(P, 3)); pg.setAttribute('color', new THREE.BufferAttribute(C, 3));
  const pts = new THREE.Points(pg, pointsMat(1, 1)); root.add(pts);
  I.update = (t, k, q) => {
    root.position.set(q.x, q.y, q.z); root.scale.setScalar(k * 3);
    for (let j = 0; j < N; j++) { const on = Math.sin(t * 5 + ph[j] * 3) > 0.6 ? 1 : 0.05; C[j * 3] = on; C[j * 3 + 1] = on * (0.9 + 0.1 * Math.sin(ph[j])); C[j * 3 + 2] = on; }
    pg.attributes.color.needsUpdate = true; pts.material.userData.ms = k * 1.5;
  };
}
