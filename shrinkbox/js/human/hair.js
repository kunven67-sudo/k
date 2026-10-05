// Hair: ~1000-1500 hair cards grown from the scalp. Each card is a lock of ~22 strands drawn in
// the shader (they taper and thin out toward the tips). The cards follow a real flow (away from the
// part, combed back at the hairline, falling with gravity), stay outside the head and lie flat on
// it in layers. Shading uses a stretched (anisotropic) highlight like real hair.
// Styles: short, curly, long, ponytail (buzz + bald are just the scalp in the skin shader).
import * as THREE from 'three';
import { humanData } from './data.js';
import { topology } from './body.js';
import { skinRegions } from './regions.js';
import { NOISE_GLSL } from './skin.js';
import { rng } from '../core/noise.js';

const STYLES = {
  short: { cards: 1900, len: [0.045, 0.075], segs: 6, width: 0.01, gravity: 0.35, part: 0.028, curl: 0, lift: 0.005, hug: 1 },
  curly: { cards: 2100, len: [0.05, 0.085], segs: 10, width: 0.009, gravity: 0.15, part: 0.0, curl: 1, lift: 0.014, hug: 0.6 },
  long: { cards: 2300, len: [0.3, 0.42], segs: 14, width: 0.012, gravity: 1.0, part: 0.0, curl: 0, lift: 0.005, hug: 1 },
  ponytail: { cards: 1900, len: [0.09, 0.14], segs: 8, width: 0.01, gravity: 0.1, part: 0.0, curl: 0, lift: 0.003, tie: true, hug: 1 },
};

export function buildHair(shape, sk, style, color, seed) {
  const S = STYLES[style]; if (!S) return null;
  const H = humanData(), reg = skinRegions(), T = topology('body');
  const P = shape.pos, r = rng(seed * 31 + 7);
  const V = (v) => new THREE.Vector3(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
  const headJ = sk.byName.head.userData.head;
  // scalp triangles + area
  const tris = []; let total = 0;
  for (let i = 0; i < T.stri.length; i += 3) {
    const a = T.stri[i], b = T.stri[i + 1], c = T.stri[i + 2];
    const m = Math.max(reg.scalp[a], reg.scalp[b], reg.scalp[c]); if (m < 0.25) continue;
    const pa = V(a), pb = V(b), pc = V(c);
    const area = pb.clone().sub(pa).cross(pc.clone().sub(pa)).length() / 2;
    total += area; tris.push({ a, b, c, pa, pb, pc, area, m, acc: total });
  }
  if (!tris.length) return null;
  // the skull as an ellipsoid fitted to the scalp
  const pts = [...new Set(tris.flatMap((t) => [t.a, t.b, t.c]))].map(V);
  const bb = new THREE.Box3().setFromPoints(pts);
  const ctr = new THREE.Vector3((bb.min.x + bb.max.x) / 2, bb.max.y - (bb.max.x - bb.min.x) * 0.62, (bb.min.z + bb.max.z) / 2 - 0.004);
  const rad = new THREE.Vector3((bb.max.x - bb.min.x) / 2 + 0.002, bb.max.y - ctr.y + 0.002, (bb.max.z - bb.min.z) / 2 + 0.002);
  const ellN = (p) => new THREE.Vector3((p.x - ctr.x) / (rad.x * rad.x), (p.y - ctr.y) / (rad.y * rad.y), (p.z - ctr.z) / (rad.z * rad.z)).normalize();
  const ellK = (p) => Math.hypot((p.x - ctr.x) / rad.x, (p.y - ctr.y) / rad.y, (p.z - ctr.z) / rad.z);
  const push = (p, off) => { const k = ellK(p), want = 1 + off; if (k < want) p.sub(ctr).multiplyScalar(want / k).add(ctr); };
  const front = bb.max.z, tie = new THREE.Vector3(ctr.x, ctr.y - rad.y * 0.15, ctr.z - rad.z * 1.02);
  // geometry buffers
  const N = S.segs, cards = S.cards;
  const pos = new Float32Array(cards * (N + 1) * 2 * 3), uv = new Float32Array(cards * (N + 1) * 2 * 2), tan = new Float32Array(cards * (N + 1) * 2 * 4), nrm = new Float32Array(cards * (N + 1) * 2 * 3), cid = new Float32Array(cards * (N + 1) * 2);
  const idx = [];
  const down = new THREE.Vector3(0, -1, 0), back = new THREE.Vector3(0, 0, -1);
  let vi = 0, made = 0;
  for (let c = 0; c < cards * 3 && made < cards; c++) {
    // area-weighted random root, sparser at the hairline
    const x = r() * total; let lo = 0, hi = tris.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (tris[mid].acc < x) lo = mid + 1; else hi = mid; }
    const t = tris[lo];
    let u1 = r(), u2 = r(); if (u1 + u2 > 1) { u1 = 1 - u1; u2 = 1 - u2; }
    const sm = reg.scalp[t.a] * (1 - u1 - u2) + reg.scalp[t.b] * u1 + reg.scalp[t.c] * u2;
    if (r() > THREE.MathUtils.smoothstep(sm, 0.25, 0.8)) continue;
    const root = t.pa.clone().addScaledVector(t.pb.clone().sub(t.pa), u1).addScaledVector(t.pc.clone().sub(t.pa), u2);
    const layer = r();
    const n0 = ellN(root);
    // flow: away from the part line, combed back at the front, down at the sides/back
    let flow;
    if (S.tie) flow = tie.clone().sub(root);
    else {
      const side = root.x - (ctr.x + S.part);
      flow = new THREE.Vector3(Math.sign(side || 1) * (0.4 + Math.min(1, Math.abs(side) / 0.04)), -0.3, -0.25);
      const nearFront = THREE.MathUtils.smoothstep(root.z, front - 0.05, front - 0.005);
      flow.lerp(new THREE.Vector3(Math.sign(side || 1) * 0.3, 0.15, -1), nearFront * (style === 'long' ? 0.3 : 0.75));
      if (root.z < ctr.z - rad.z * 0.3) flow.add(new THREE.Vector3(0, -0.6, -0.2));
    }
    flow.addScaledVector(n0, -flow.dot(n0)).normalize();
    const len = THREE.MathUtils.lerp(S.len[0], S.len[1], r()) * (S.tie ? 1 : THREE.MathUtils.lerp(0.45, 1, THREE.MathUtils.smoothstep(sm, 0.3, 0.95))); // finer, shorter hairs at the hairline
    const step = len / N;
    const p = root.clone().addScaledVector(n0, 0.0006);
    let d = n0.clone().multiplyScalar(0.12).add(flow).normalize();
    const frontStrand = root.z > ctr.z + rad.z * 0.1 && Math.abs(root.x - ctr.x) > rad.x * 0.35;
    const off = 0.004 + layer * S.lift;
    const width = S.width * (0.75 + r() * 0.5);
    const base = vi;
    const curlPh = r() * 6.28, curlR = 0.6 + r() * 0.5;
    const tieDone = { v: false };
    for (let i = 0; i <= N; i++) {
      if (i > 0) {
        const en = ellN(p);
        const along = i / N;
        if (S.tie && !tieDone.v) {
          const toTie = tie.clone().sub(p); if (toTie.length() < step * 1.2) tieDone.v = true;
          d.lerp(toTie.normalize(), 0.55);
        } else if (S.tie) d.lerp(down.clone().addScaledVector(back, 0.25), 0.35);
        else {
          d.addScaledVector(flow, 0.25);
          const below = THREE.MathUtils.smoothstep(ctr.y - p.y, -rad.y * 0.1, rad.y * 0.5); // past the widest part of the head
          d.addScaledVector(down, S.gravity * (along * 0.5 + below * 2.5));
          if (S.curl) { const a = curlPh + i * 1.35; d.addScaledVector(new THREE.Vector3(Math.cos(a), Math.sin(a) * 0.5, Math.sin(a)).cross(d), 0.55 * curlR); }
        }
        // lie along the head while close to it (hair is combed flat, not standing up)
        const kk = ellK(p);
        if ((kk < 1.12 || !S.curl) && p.y > ctr.y - rad.y * 0.35) { const nn = ellN(p); const dn = d.dot(nn); d.addScaledVector(nn, -dn * S.hug).addScaledVector(nn, 0.04); }
        d.normalize();
        p.addScaledVector(d, step);
        if (!(S.tie && tieDone.v)) push(p, off / Math.max(rad.x, 0.05));
        // long hair: falls behind the shoulders, or in front of them for strands near the face
        if (style === 'long' && p.y < ctr.y - rad.y * 0.8) {
          if (frontStrand) p.z = Math.max(p.z, ctr.z + rad.z * 0.55); else p.z = Math.min(p.z, ctr.z - rad.z * 0.7);
          if (p.y < ctr.y - rad.y * 1.2) p.x = ctr.x + (p.x - ctr.x) * 0.985 + Math.sign(p.x - ctr.x) * 0.0015;
        }
        void en;
      }
      const en2 = ellN(p);
      const w = new THREE.Vector3().crossVectors(d, en2); if (w.lengthSq() < 1e-8) w.set(1, 0, 0); w.normalize();
      const hw = width * 0.5 * (1 - 0.35 * (i / N));
      for (const sgn of [-1, 1]) {
        const q = p.clone().addScaledVector(w, hw * sgn).sub(headJ);
        pos.set([q.x, q.y, q.z], vi * 3); uv.set([sgn < 0 ? 0 : 1, i / N], vi * 2); tan.set([d.x, d.y, d.z, 1], vi * 4); nrm.set([en2.x, en2.y, en2.z], vi * 3); cid[vi] = (c % 997) / 997;
        vi++;
      }
      if (i > 0) { const a = base + (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    made++;
  }
  const g = new THREE.BufferGeometry();
  const nV = vi;
  g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, nV * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm.subarray(0, nV * 3), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv.subarray(0, nV * 2), 2));
  g.setAttribute('tangent', new THREE.BufferAttribute(tan.subarray(0, nV * 4), 4));
  g.setAttribute('aCard', new THREE.BufferAttribute(cid.subarray(0, nV), 1));
  g.setIndex(idx);
  const mesh = new THREE.Mesh(g, createHairMaterial(color, style));
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  mesh.name = 'hair';
  void H;
  return mesh;
}

export function createHairMaterial(color, style) {
  const c = new THREE.Color(color);
  const mat = new THREE.MeshPhysicalMaterial({
    color: c, roughness: 0.42, anisotropy: 0.85, anisotropyRotation: 0, side: THREE.DoubleSide, alphaTest: 0.4,
    specularIntensity: 0.55, specularColor: c.clone().lerp(new THREE.Color(1, 1, 1), 0.18), sheen: 0.08, sheenRoughness: 0.5, sheenColor: c.clone().multiplyScalar(1.2),
  });
  mat.alphaToCoverage = true;
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute float aCard; varying float vCard; varying vec2 vHairUv;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCard = aCard; vHairUv = uv;');
    sh.fragmentShader = `varying float vCard; varying vec2 vHairUv;\n${NOISE_GLSL}\n` + sh.fragmentShader
      .replace('#include <alphatest_fragment>', `
      {
        float v = vHairUv.y, x = vHairUv.x * 22.0, a = 0.0, lum = 0.0;
        for (int k = -1; k <= 1; k++) {
          float cell = floor(x) + float(k); vec3 h = sk_hash(vec3(cell, vCard * 997.0, 5.0));
          float len = 0.7 + 0.3 * h.z;
          float c = cell + 0.5 + (h.x - 0.5) * 0.8 + sin(v * 9.0 + h.y * 6.28) * 0.25;
          float w = mix(0.6, 0.2, clamp(v / len, 0.0, 1.0));
          float s = smoothstep(w, w * 0.35, abs(x - c)) * step(v, len);
          if (s > a) { a = s; lum = h.y; }
        }
        diffuseColor.a *= a;
        // roots darker, a little strand-to-strand color variation
        diffuseColor.rgb *= (0.88 + 0.24 * lum) * mix(0.62, 1.0, smoothstep(0.0, 0.35, v)) * (0.92 + 0.16 * vCard);
      }
      #include <alphatest_fragment>`);
  };
  mat.customProgramCacheKey = () => 'mh-hair-' + (style === 'long' ? 'l' : 's');
  return mat;
}
