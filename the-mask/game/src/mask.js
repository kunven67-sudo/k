// THE MASK - the mask itself: a carved cartoon face shell (low-poly, flat facets), painted teal marks,
// brass rim, and a little brass clock in the forehead whose hands show the loop time.
import * as THREE from 'three';
import { toon, PAL } from './toon.js';

const W = 0.086, TOP = 0.072, CHIN = 0.112, THICK = 0.0065;
const EYES = [{ x: -0.034, y: 0.003, rot: -0.17 }, { x: 0.034, y: 0.003, rot: 0.17 }];
const EYE_A = 0.0195, EYE_B = 0.0098;

function halfWidth(v) {
  if (v >= 0) { const t = Math.min(1, v / TOP); return W * Math.pow(1 - Math.pow(t, 2.4), 1 / 2.4); }
  const t = Math.min(1, -v / CHIN);
  return W * Math.sqrt(1 - t * t) * (1 - 0.32 * t);
}
function outlineFn(x, y) { // < 0 inside the mask
  if (y > TOP) return Math.abs(x) + (y - TOP);
  if (y < -CHIN) return Math.abs(x) + (-CHIN - y);
  return Math.abs(x) - halfWidth(y);
}
function eyeFn(x, y) { // > 0 inside an eye hole
  let best = -1e9;
  for (const e of EYES) {
    const dx = x - e.x, dy = y - e.y, c = Math.cos(e.rot), s = Math.sin(e.rot);
    const r = Math.hypot((dx * c + dy * s) / EYE_A, (-dx * s + dy * c) / EYE_B);
    best = Math.max(best, (1 - r) * EYE_B);
  }
  return best;
}
const g = (x, s) => Math.exp(-(x / s) * (x / s));
export function surfaceZ(x, y) {
  let z = 0.048 * (1 - (x / 0.1) ** 2) - 0.016 * ((y + 0.012) / 0.1) ** 2;
  const t = Math.min(1, Math.max(0, (0.012 - y) / 0.062)); // nose: grows from the brow to the tip
  const tipFade = y < -0.05 ? g(y + 0.05, 0.007) : 1;
  z += 0.021 * Math.pow(t, 1.25) * g(x, 0.0095 + 0.007 * t) * tipFade;
  z += 0.0055 * g(y - 0.024, 0.009) * (1 - Math.min(1, Math.abs(x) / 0.07)); // brow
  z += 0.005 * (g(x - 0.042, 0.016) + g(x + 0.042, 0.016)) * g(y + 0.032, 0.014); // cheekbones
  z += 0.004 * g(x, 0.02) * g(y + 0.098, 0.012); // chin
  z -= 0.004 * g(x, 0.016) * g(y + 0.074, 0.005); // lip line dip
  return z;
}

/* paint: the teal marks are a texture on the shell (u,v from x,y) */
const PX0 = -0.1, PX1 = 0.1, PY0 = -0.125, PY1 = 0.085;
function paintTexture() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const k = c.getContext('2d');
  const X = (x) => (x - PX0) / (PX1 - PX0) * S, Y = (y) => (1 - (y - PY0) / (PY1 - PY0)) * S, L = (d) => d / (PX1 - PX0) * S;
  k.fillStyle = '#f1e7d0'; k.fillRect(0, 0, S, S);
  // faint warm blush on the cheeks
  for (const sx of [-1, 1]) {
    const gr = k.createRadialGradient(X(sx * 0.05), Y(-0.04), 0, X(sx * 0.05), Y(-0.04), L(0.03));
    gr.addColorStop(0, 'rgba(214,120,92,0.35)'); gr.addColorStop(1, 'rgba(214,120,92,0)');
    k.fillStyle = gr; k.fillRect(0, 0, S, S);
  }
  const teal = '#2c8c87', dark = '#1d5f5c';
  // eye rings
  for (const e of EYES) {
    k.save(); k.translate(X(e.x), Y(e.y)); k.rotate(-e.rot);
    k.strokeStyle = teal; k.lineWidth = L(0.0042);
    k.beginPath(); k.ellipse(0, 0, L(EYE_A + 0.0042), L(EYE_B + 0.0042), 0, 0, Math.PI * 2); k.stroke();
    k.restore();
  }
  // tear stripes: one long, one short under each eye
  for (const e of EYES) {
    for (const [off, len, w] of [[0, 0.068, 0.0052], [Math.sign(e.x) * 0.009, 0.042, 0.0034]]) {
      const x = e.x + off, y0 = e.y - EYE_B - 0.006;
      k.fillStyle = off === 0 ? teal : dark;
      k.beginPath();
      k.moveTo(X(x - w / 2), Y(y0)); k.lineTo(X(x + w / 2), Y(y0));
      k.lineTo(X(x + w * 0.15), Y(y0 - len)); k.lineTo(X(x - w * 0.15), Y(y0 - len)); k.closePath(); k.fill();
      k.beginPath(); k.arc(X(x), Y(y0 - len - 0.004), L(w * 0.55), 0, Math.PI * 2); k.fill();
    }
  }
  // mouth: a short closed line
  k.strokeStyle = dark; k.lineWidth = L(0.0032); k.lineCap = 'round';
  k.beginPath(); k.moveTo(X(-0.016), Y(-0.073)); k.quadraticCurveTo(X(0), Y(-0.0765), X(0.016), Y(-0.073)); k.stroke();
  // chin diamond
  k.fillStyle = teal; k.beginPath();
  k.moveTo(X(0), Y(-0.088)); k.lineTo(X(0.006), Y(-0.095)); k.lineTo(X(0), Y(-0.102)); k.lineTo(X(-0.006), Y(-0.095)); k.closePath(); k.fill();
  // brass inlay line along the brow
  k.strokeStyle = '#c99032'; k.lineWidth = L(0.0024);
  k.beginPath(); k.moveTo(X(-0.07), Y(0.03)); k.quadraticCurveTo(X(0), Y(0.016), X(0.07), Y(0.03)); k.stroke();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

/* ---------- geometry: grid -> clip along the outline + eye holes -> shell with rim ---------- */
function buildShell() {
  const V = []; let tris = [];
  const NX = 34, NY = 40;
  const id = (i, j) => i * (NY + 1) + j;
  for (let i = 0; i <= NX; i++) for (let j = 0; j <= NY; j++) {
    const x = -0.1 + 0.2 * i / NX, y = -0.125 + 0.21 * j / NY;
    V.push([x, y]);
  }
  for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
    const a = id(i, j), b = id(i + 1, j), c = id(i + 1, j + 1), d = id(i, j + 1);
    if ((i + j) % 2) tris.push([a, b, c], [a, c, d]); else tris.push([a, b, d], [b, c, d]);
  }
  const clip = (fn) => {
    const cache = new Map();
    const pt = (a, b) => {
      const key = a < b ? a + '_' + b : b + '_' + a;
      if (cache.has(key)) return cache.get(key);
      let lo = 0, hi = 1; const A = V[a], B = V[b], sa = fn(A[0], A[1]) > 0;
      for (let k = 0; k < 28; k++) { const m = (lo + hi) / 2; if ((fn(A[0] + (B[0] - A[0]) * m, A[1] + (B[1] - A[1]) * m) > 0) === sa) lo = m; else hi = m; }
      const t = (lo + hi) / 2; V.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]);
      cache.set(key, V.length - 1); return V.length - 1;
    };
    const out = [];
    for (const t of tris) {
      const ins = t.map((i) => fn(V[i][0], V[i][1]) <= 0), n = ins.filter(Boolean).length;
      if (n === 3) { out.push(t); continue; }
      if (n === 0) continue;
      let r = 0; for (; r < 3; r++) if (ins[r] !== ins[(r + 1) % 3] && ins[r] !== ins[(r + 2) % 3]) break;
      const a = t[r], b = t[(r + 1) % 3], c = t[(r + 2) % 3], pab = pt(a, b), pca = pt(c, a);
      if (ins[r]) out.push([a, pab, pca]); else out.push([pab, b, c], [pab, c, pca]);
    }
    tris = out;
  };
  clip(outlineFn); clip(eyeFn);
  // drop slivers made by the cut (they shade badly with flat facets)
  tris = tris.filter(([a, b, c]) => Math.abs((V[b][0] - V[a][0]) * (V[c][1] - V[a][1]) - (V[c][0] - V[a][0]) * (V[b][1] - V[a][1])) > 2e-8);

  const P3 = V.map(([x, y]) => [x, y, surfaceZ(x, y)]);
  const uvOf = ([x, y]) => [(x - PX0) / (PX1 - PX0), (y - PY0) / (PY1 - PY0)];
  // front (flat facets)
  const fp = [], fuv = [];
  for (const t of tris) for (const i of t) { fp.push(...P3[i]); fuv.push(...uvOf(V[i])); }
  const front = new THREE.BufferGeometry();
  front.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  front.setAttribute('uv', new THREE.Float32BufferAttribute(fuv, 2));
  front.computeVertexNormals();
  // back: the same surface pushed in, winding flipped
  const bp = [];
  for (const [a, b, c] of tris) for (const i of [a, c, b]) { const p = P3[i]; bp.push(p[0] * 0.985, p[1] * 0.99, p[2] - THICK); }
  const back = new THREE.BufferGeometry();
  back.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
  back.computeVertexNormals();
  // rim along every boundary edge
  const cnt = new Map();
  for (const t of tris) for (let e = 0; e < 3; e++) { const a = t[e], b = t[(e + 1) % 3]; const k = a < b ? a + '_' + b : b + '_' + a; cnt.set(k, (cnt.get(k) || 0) + 1); }
  const rp = [];
  for (const t of tris) for (let e = 0; e < 3; e++) {
    const a = t[e], b = t[(e + 1) % 3]; const k = a < b ? a + '_' + b : b + '_' + a;
    if (cnt.get(k) !== 1) continue;
    const A = P3[a], B = P3[b], A2 = [A[0] * 0.985, A[1] * 0.99, A[2] - THICK], B2 = [B[0] * 0.985, B[1] * 0.99, B[2] - THICK];
    rp.push(...A, ...A2, ...B2, ...A, ...B2, ...B);
  }
  const rim = new THREE.BufferGeometry();
  rim.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
  rim.computeVertexNormals();
  return { front, back, rim };
}

function buildClock() {
  const clock = new THREE.Group();
  const brass = toon({ color: PAL.brass }), brassD = toon({ color: PAL.brassDark }), face = toon({ color: 0xfaf3e2 });
  const ink = toon({ color: PAL.ink }), tealM = toon({ color: PAL.teal });
  const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.0195, 0.021, 0.008, 18), brass);
  bezel.rotation.x = Math.PI / 2; clock.add(bezel);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0168, 0.0016, 6, 24), brassD); ring.position.z = 0.0041; clock.add(ring);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.0158, 24), face); dial.position.z = 0.0042; clock.add(dial);
  for (let i = 0; i < 12; i++) {
    const big = i % 3 === 0;
    const tick = new THREE.Mesh(new THREE.BoxGeometry(big ? 0.0022 : 0.0012, big ? 0.0042 : 0.0026, 0.0008), big ? tealM : ink);
    const a = i / 12 * Math.PI * 2; tick.position.set(Math.sin(a) * 0.0128, Math.cos(a) * 0.0128, 0.0046); tick.rotation.z = -a; clock.add(tick);
  }
  const hand = (len, w, mat, z) => {
    const pivot = new THREE.Group(); pivot.position.z = z;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.0009), mat); m.position.y = len * 0.42; pivot.add(m);
    clock.add(pivot); return pivot;
  };
  const hourH = hand(0.0085, 0.0022, ink, 0.0049), minH = hand(0.0125, 0.0015, ink, 0.0054), loopH = hand(0.0135, 0.0009, tealM, 0.0059);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.002, 10), brass); cap.rotation.x = Math.PI / 2; cap.position.z = 0.0062; clock.add(cap);
  clock.userData.set = (date, loopFrac) => {
    const h = date.getHours() % 12 + date.getMinutes() / 60, m = date.getMinutes() + date.getSeconds() / 60;
    hourH.rotation.z = -h / 12 * Math.PI * 2; minH.rotation.z = -m / 60 * Math.PI * 2;
    loopH.rotation.z = -loopFrac * Math.PI * 2;
  };
  return clock;
}

export function buildMask() {
  const { front, back, rim } = buildShell();
  const group = new THREE.Group(); group.name = 'the-mask';
  const paint = paintTexture();
  const mFront = new THREE.Mesh(front, toon({ map: paint }));
  const mBack = new THREE.Mesh(back, toon({ color: 0x3a2a26 }));
  const mRim = new THREE.Mesh(rim, toon({ color: PAL.brass }));
  for (const m of [mFront, mBack, mRim]) { m.castShadow = true; m.receiveShadow = true; group.add(m); }
  const clock = buildClock();
  const cy = 0.047, cz = surfaceZ(0, cy);
  const dzdy = (surfaceZ(0, cy + 0.001) - surfaceZ(0, cy - 0.001)) / 0.002;
  clock.position.set(0, cy, cz + 0.0015);
  clock.rotation.x = Math.atan(dzdy); // tilt with the forehead
  group.add(clock);
  group.userData.update = (date, loopFrac) => clock.userData.set(date, loopFrac);
  return group;
}
