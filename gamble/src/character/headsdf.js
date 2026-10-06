// Head sculpt: facial layout + a signed distance field built from smooth-blended primitives
// (cranium, cheek mass, jaw, chin, muzzle, cheekbones, fat cheeks, brow ridge, nose, lips,
// eye sockets, lid shells around the eyeballs, mouth slit, neck, jowls, double chin).
// headmesh.js shoots a warped direction grid from PROJ (a point inside the head) onto this
// field to build the head mesh.
//
// Head unit space: origin at the head centre (half way chin -> crown), +Y up, +Z forward,
// +X = the character's left, chin -> crown = HEAD_UNIT metres at scale 1.

import { clamp } from '../core/util.js';

const { sqrt, abs, min, max, atan2, hypot, sin, cos, PI } = Math;
const D2R = PI / 180;
const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const HEAD_UNIT = 0.32;
export const JAW_BIND_OPEN = 0;
/** Projection centre of the head grid (unit space). */
export const PROJ = [0, -0.035, -0.008];

// ---- SDF helpers -------------------------------------------------------------------------------
function ellipsoid(px, py, pz, rx, ry, rz) {
  const k0 = sqrt((px / rx) ** 2 + (py / ry) ** 2 + (pz / rz) ** 2);
  const k1 = sqrt((px / (rx * rx)) ** 2 + (py / (ry * ry)) ** 2 + (pz / (rz * rz)) ** 2);
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -min(rx, ry, rz);
}
function capsule(px, py, pz, ax, ay, az, bx, by, bz, r) {
  const pax = px - ax;
  const pay = py - ay;
  const paz = pz - az;
  const bax = bx - ax;
  const bay = by - ay;
  const baz = bz - az;
  const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1);
  return hypot(pax - bax * h, pay - bay * h, paz - baz * h) - r;
}
export function smin(a, b, k) {
  const h = max(k - abs(a - b), 0) / k;
  return min(a, b) - h * h * k * 0.25;
}
function smax(a, b, k) {
  return -smin(-a, -b, k);
}

// ---- layout ------------------------------------------------------------------------------------

/** Facial layout (unit space) from params. Shared by the sculpt, rig, weights and face paint. */
export function faceLayout(p) {
  const old = clamp((p.age - 35) / 50, 0, 1);
  const fw = 0.9 + 0.2 * p.faceWidth + 0.06 * p.fat;
  const jw = 0.84 + 0.3 * p.jaw + 0.08 * p.fat;
  const mw = 0.86 + 0.28 * p.mouthWidth;
  const eyeR = 0.0232 * (0.9 + 0.2 * p.eyeSize);
  const L = {
    old, fw, jw, mw, fat: p.fat,
    eyeR,
    lidT: 0.0024,
    eyeSep: (0.0485 + 0.007 * (p.eyeSpacing - 0.5)) * (0.94 + 0.06 * fw),
    eyeY: -0.008,
    eyeZ: 0.072 - (eyeR - 0.0232) * 0.5,
    tilt: (p.eyeTilt - 0.5) * 16 * D2R,
    lidUpper: (27 - 11 * p.lids - 4 * old) * D2R,
    lidLower: (25 + 2 * old) * D2R,
    lidHalfW: 60 * D2R,
    browY: 0.024 + 0.003 * p.browRidge,
    noseTipY: -0.052 - 0.01 * (0.5 - p.noseTip) - 0.004 * old,
    noseTipZ: 0.128 + 0.014 * p.noseSize + 0.004 * old,
    noseW: 0.85 + 0.3 * p.noseWidth,
    noseS: 0.85 + 0.3 * p.noseSize + 0.08 * old,
    bridge: p.noseBridge,
    mouthY: -0.094 - 0.003 * old,
    mouthZ: 0.106,
    mouthHalfW: 0.033 * mw,
    lipT: 0.7 + 0.6 * p.lips,
    chin: p.chin,
    cheeks: p.cheeks,
    cheekbones: p.cheekbones,
    browRidge: p.browRidge,
    jawP: p.jaw,
    earSize: 0.86 + 0.32 * p.ears + 0.1 * old,
    earOut: (8 + 26 * p.earsOut) * D2R,
    neck: null, // filled by setNeck() from the body seam
  };
  // Mouth slit in projection-cone coordinates (see headmesh.js: one grid row runs along it).
  L.mouthElev = atan2(L.mouthY - PROJ[1], L.mouthZ - PROJ[2]);
  L.mouthAz = atan2(L.mouthHalfW, L.mouthZ - PROJ[2] - 0.004);
  L.eyes = [1, -1].map((side) => ({
    side,
    c: [side * L.eyeSep, L.eyeY, L.eyeZ],
    // Eye frame: looks forward, opening turned slightly outward.
    yaw: side * 9 * D2R,
  }));
  return L;
}

/** Neck ellipse (unit space) matching the body's neck seam ring. */
export function setNeck(L, { y, W, F, B, cz, ty = 0 }) {
  L.neck = { y, W, F, B, cz, ty };
}
/** Seam height (unit space) at azimuth az (front of the neck sits lower). */
export function neckSeamY(nk, az) {
  const c = Math.cos(az);
  return nk.y + nk.ty * (c > 0 ? c : c * 0.35);
}

/** Eye opening test in the eye's angular frame. Returns >0 inside the opening (radians). */
export function eyeOpening(L, e, h, v) {
  // h: horizontal angle (+ = toward the temple), v: vertical angle (+ = up).
  const w = h < 0 ? L.lidHalfW * 0.84 : L.lidHalfW; // inner corner (toward the nose) is shorter
  const u = clamp(h / w, -1, 1);
  const tilt = L.tilt * u;
  const vv = v - tilt;
  const up = L.lidUpper * Math.pow(max(0, 1 - u * u), 0.62) * (1 - 0.12 * u);
  const lo = L.lidLower * Math.pow(max(0, 1 - u * u), 0.85) * (1 + 0.1 * u);
  return min(up - vv, vv + lo, w - abs(h));
}

/** Angles (h, v) of a unit-space point around eye e. */
export function eyeAngles(L, e, x, y, z) {
  const dx = x - e.c[0];
  const dy = y - e.c[1];
  const dz = z - e.c[2];
  // Rotate by -yaw about Y so the eye frame looks along +Z.
  const cy = cos(e.yaw);
  const sy = sin(e.yaw);
  const lx = dx * cy - dz * sy;
  const lz = dx * sy + dz * cy;
  const h = atan2(lx, lz) * e.side; // + toward the temple
  const v = atan2(dy, hypot(lx, lz));
  return [h, v, hypot(dx, dy, dz)];
}

// ---- face loft ---------------------------------------------------------------------------------
// The face and jaw are a loft of superellipse cross-sections (like edge loops a modeller would
// draw): half width W, front F and back B (z) and front squareness n per height. Smooth
// Catmull-Rom interpolation between keys gives clean planes with no blob seams.
const LOFT_KEYS = [
  // y,      W,     F,     B,     n
  [0.12, 0.07, 0.06, -0.08, 2.0],
  [0.075, 0.104, 0.098, -0.1, 2.2],
  [0.035, 0.11, 0.104, -0.1, 2.4],
  [0.0, 0.111, 0.099, -0.1, 2.7],
  [-0.03, 0.11, 0.103, -0.095, 2.6],
  [-0.06, 0.103, 0.107, -0.088, 2.2],
  [-0.088, 0.093, 0.107, -0.078, 2.0],
  [-0.114, 0.083, 0.101, -0.062, 2.0],
  [-0.136, 0.064, 0.097, -0.03, 2.0],
  [-0.153, 0.04, 0.088, 0.0, 2.0],
  [-0.166, 0.016, 0.068, 0.028, 2.0],
];

function makeLoft(L) {
  const { fw, jw, fat, old } = L;
  const keys = LOFT_KEYS.map(([y, W, F, B, n]) => {
    // Upper face scales with face width, lower face with the jaw; fat fills the cheeks and
    // jaw; age drops the jowls; the chin slider moves the chin forward.
    const up = sstep(-0.1, -0.04, y);
    let w = W * (up * fw + (1 - up) * jw * (0.93 + 0.07 * fw));
    w += fat * 0.013 * sstep(-0.16, -0.11, y) * sstep(0.02, -0.04, y);
    w += L.cheeks * 0.006 * Math.exp(-(((y + 0.062) / 0.025) ** 2));
    w += old * 0.006 * Math.exp(-(((y + 0.122) / 0.018) ** 2));
    let f = F + fat * 0.006 * sstep(0.0, -0.06, y);
    if (y < -0.125) f += 0.012 * (L.chin - 0.5) + 0.004 * fat;
    if (y < -0.145) w += 0.01 * (L.jawP - 0.5);
    return [y, w, f, B, n];
  });
  const N = keys.length;
  return (y, out) => {
    // Catmull-Rom over the key list (clamped at the ends).
    let i = 0;
    while (i < N - 2 && keys[i + 1][0] > y) i++;
    const k0 = keys[max(0, i - 1)];
    const k1 = keys[i];
    const k2 = keys[i + 1];
    const k3 = keys[min(N - 1, i + 2)];
    const t = clamp((k1[0] - y) / (k1[0] - k2[0]), 0, 1);
    const t2 = t * t;
    const t3 = t2 * t;
    for (let c = 1; c < 5; c++) {
      const p0 = k0[c];
      const p1 = k1[c];
      const p2 = k2[c];
      const p3 = k3[c];
      out[c - 1] = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    }
    return out;
  };
}

/**
 * Build the head distance function for layout L. f(x,y,z) -> signed distance (unit space).
 * Sculpt order: skull + face mass, jaw (ramus + body) and chin, muzzle, cheekbones, cheeks,
 * fat/age masses, brow ridge, neck, eye sockets + lids, nose, lips, mouth slit, eyeballs.
 * Blend radii are generous on the big forms (no lumps) and tight on the features (crisp).
 */
export function headSDF(L) {
  const { fw, mw, fat } = L;
  const nk = L.neck;
  const sec = makeLoft(L);
  const S4 = [0, 0, 0, 0];
  const cbS = 0.75 + 0.5 * L.cheekbones;
  const browR = 0.008 + 0.005 * L.browRidge;
  const ns = L.noseS;
  const nw = L.noseW;
  const tipZ = L.noseTipZ;
  const tipY = L.noseTipY;
  const [ePx, ePy, ePz] = PROJ;
  const adam = clamp((L.jawP - 0.55) * 2.2, 0, 1) * (1 - fat * 0.6);
  // Nose bounding sphere (bridge top to wings).
  const noseCY = (L.browY - 0.014 + tipY) * 0.5;
  const noseBR = hypot((L.browY - 0.014 - tipY) * 0.5, tipZ - 0.1) + 0.022 * ns;
  return function sdf(x, y, z) {
    const ax = abs(x);
    // Skull: a slightly egg-shaped vault; the face/jaw loft in front and below it.
    let d = ellipsoid(x, y - 0.026, z + 0.016, 0.116 * (0.97 + 0.03 * fw), 0.13, 0.12);
    {
      const yy = clamp(y, -0.166, 0.12);
      sec(yy, S4);
      const [W, F, B, n] = S4;
      const zc = (F + B) * 0.5;
      const dep = z >= zc ? F - zc : zc - B;
      const nn = z >= zc ? n : 2;
      const q = Math.pow(Math.pow(ax / W, nn) + Math.pow(abs(z - zc) / dep, nn), 1 / nn);
      let dl = (q - 1) * min(W, dep) * 0.9;
      // Caps: fade into the skull on top; round the chin underneath.
      dl = smax(dl, y - 0.12, 0.02);
      dl = smax(dl, -0.166 - y, 0.012);
      d = smin(d, dl, 0.03);
    }
    // Cheekbones: a subtle accent on the loft.
    d = smin(d, ellipsoid(ax - 0.07 * fw, y + 0.028, z - 0.05, 0.024 * cbS, 0.013 * cbS, 0.024 * cbS), 0.03);
    // Double chin (fat).
    if (fat > 0.35) d = smin(d, ellipsoid(x, y + 0.158, z - 0.035, 0.05 * fat, 0.024 * fat, 0.042 * fat), 0.035);
    // Brow ridge (glabella -> outer brow).
    d = smin(d, capsule(ax, y, z, 0.008, L.browY - 0.002, 0.097, 0.064 * fw, L.browY + 0.005, 0.078, browR), 0.024);
    // Neck (elliptic column matching the body seam) blended into skull and jaw.
    if (nk) {
      const nz = z - nk.cz;
      const rz = nz > 0 ? nk.F : nk.B;
      const q = sqrt((x / nk.W) ** 2 + (nz / rz) ** 2);
      let dn = (q - 1) * min(nk.W, rz);
      dn = max(dn, y - 0.0);
      d = smin(d, dn, 0.04);
      if (adam > 0) d = smin(d, ellipsoid(x, y - (nk.y + 0.045), nz - nk.F + 0.002, 0.009, 0.014, 0.008 * adam + 0.002), 0.012);
    }
    // Features below only touch the surface near their bounding spheres; skipping them
    // elsewhere (smin/smax with a far primitive is a no-op) makes the grid cast ~3x faster.
    const rE0 = hypot(x - L.eyes[0].c[0], y - L.eyes[0].c[1], z - L.eyes[0].c[2]);
    const rE1 = hypot(x - L.eyes[1].c[0], y - L.eyes[1].c[1], z - L.eyes[1].c[2]);
    const nearEyes = min(rE0, rE1) - L.eyeR * 1.6 < abs(d) + 0.018;
    // Eye sockets: a shallow carve so the lids fold back smoothly into the brow and cheek.
    for (const e of nearEyes ? L.eyes : []) {
      const er = L.eyeR + L.lidT;
      d = smax(d, -ellipsoid(x - e.c[0], y - e.c[1] - 0.003, z - e.c[2] + 0.002, er * 1.3, er * 1.12, er * 1.0), 0.016);
    }
    // Lid shells (eyeball + lid thickness, open in the almond) blended into the socket.
    for (const e of nearEyes ? L.eyes : []) {
      const [h, v, r] = eyeAngles(L, e, x, y, z);
      const open = eyeOpening(L, e, h, v);
      // Lid skin thickens away from the margin so the lids roll back into the socket rim
      // instead of leaving a ring-shaped gap around the eyeball.
      const shell = r - (L.eyeR + L.lidT + L.eyeR * 0.42 * sstep(0.0, 0.75, -open));
      const lid = max(shell, open * L.eyeR, (-open - 0.9) * L.eyeR, -(z - e.c[2] + 0.004));
      d = smin(d, lid, 0.011);
    }
    // Nose: bridge, tip, wings; nostrils carved underneath.
    if (hypot(x, y - noseCY, z - 0.105) - noseBR < abs(d) + 0.016) {
      const bridgeR = (0.0058 + 0.003 * L.bridge) * nw;
      d = smin(d, capsule(x, y, z, 0, L.browY - 0.014, 0.1, 0, tipY + 0.011, tipZ - 0.014, bridgeR), 0.014);
      d = smin(d, ellipsoid(x, y - tipY, z - tipZ + 0.012, 0.0125 * nw * ns, 0.0118 * ns, 0.0122 * ns), 0.011);
      d = smin(d, ellipsoid(ax - 0.0118 * nw * ns, y - tipY + 0.0045, z - tipZ + 0.026, 0.0078 * ns, 0.0068 * ns, 0.0088 * ns), 0.013);
      d = smax(d, -ellipsoid(ax - 0.0068 * nw * ns, y - tipY + 0.0142, z - tipZ + 0.02, 0.0034 * ns, 0.0017, 0.0048 * ns), 0.0025);
    }
    // Lips.
    if (hypot(x, y - L.mouthY, z - L.mouthZ) - 0.036 * mw < abs(d) + 0.014) {
      const mz = L.mouthZ;
      d = smin(d, ellipsoid(x, y - L.mouthY - 0.0072, z - mz + 0.003, 0.026 * mw, 0.0064 * L.lipT, 0.0115), 0.011);
      d = smin(d, ellipsoid(x, y - L.mouthY + 0.0088, z - mz + 0.005, 0.0235 * mw, 0.0084 * L.lipT, 0.012), 0.012);
      // Mouth slit: a thin sheet at constant elevation from PROJ (a grid row runs along it).
      const qx = x - ePx;
      const qy = y - ePy;
      const qz = z - ePz;
      const az = atan2(qx, qz);
      const u = abs(az) / L.mouthAz;
      if (u < 1.15 && qz > 0.06) {
        const rr = hypot(qx, qy, qz);
        const el = atan2(qy, hypot(qx, qz));
        const eps = 0.0009 * max(0, 1 - u * u) ** 0.5;
        const slit = max(abs(el - L.mouthElev) * rr - eps, (u - 1) * 0.03, 0.074 - rr);
        d = smax(d, -slit, 0.0014);
      }
    }
    // Eyeballs themselves.
    d = min(d, rE0 - L.eyeR, rE1 - L.eyeR);
    return d;
  };
}

/** Head-space (unit) positions of the face bones. */
export function faceBonePositions(L) {
  const P = {};
  P.jaw = [0, -0.04, -0.032];
  P.tongue = [0, L.mouthY - 0.004, 0.06];
  P['lip.U'] = [0, L.mouthY + 0.008, L.mouthZ + 0.004];
  P['lip.D'] = [0, L.mouthY - 0.01, L.mouthZ + 0.002];
  P.nose = [0, L.noseTipY - 0.004, L.noseTipZ - 0.022];
  for (const e of L.eyes) {
    const s = e.side > 0 ? 'L' : 'R';
    const sx = e.side;
    P[`eye.${s}`] = e.c.slice();
    P[`corner.${s}`] = [sx * L.mouthHalfW, L.mouthY, L.mouthZ - 0.008];
    P[`cheek.${s}`] = [sx * 0.056 * L.fw, -0.058, 0.082];
    P[`brow.in.${s}`] = [sx * 0.018, L.browY + 0.002, 0.1];
    P[`brow.out.${s}`] = [sx * 0.054 * L.fw, L.browY + 0.006, 0.088];
  }
  return P;
}
