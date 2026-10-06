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
  const eyeR = 0.0202 * (0.9 + 0.2 * p.eyeSize);
  const L = {
    old, fw, jw, mw, fat: p.fat,
    eyeR,
    lidT: 0.0024,
    eyeSep: (0.0425 + 0.007 * (p.eyeSpacing - 0.5)) * (0.94 + 0.06 * fw),
    eyeY: -0.008,
    eyeZ: 0.073 - (eyeR - 0.0202) * 0.5,
    tilt: (p.eyeTilt - 0.5) * 16 * D2R,
    lidUpper: (37 - 12 * p.lids - 4 * old) * D2R,
    lidLower: (25 + 2 * old) * D2R,
    lidHalfW: 60 * D2R,
    browY: 0.024 + 0.003 * p.browRidge,
    noseTipY: -0.052 - 0.01 * (0.5 - p.noseTip) - 0.004 * old,
    noseTipZ: 0.12 + 0.012 * p.noseSize + 0.004 * old,
    noseW: 0.85 + 0.3 * p.noseWidth,
    noseS: 0.85 + 0.3 * p.noseSize + 0.08 * old,
    bridge: p.noseBridge,
    mouthY: -0.094 - 0.003 * old,
    mouthZ: 0.097,
    mouthHalfW: 0.0295 * mw,
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

/** Build the head distance function for layout L. f(x,y,z) -> signed distance (unit space). */
export function headSDF(L) {
  const { fw, jw, mw, fat, old } = L;
  const nk = L.neck;
  const chinZ = 0.071 + 0.014 * (L.chin - 0.5);
  const chinY = -0.14 - 0.006 * (L.chin - 0.5);
  const jawX = (0.06 + 0.016 * L.jawP) * jw * fw * 0.92;
  const jawR = 0.021 + 0.01 * fat;
  const cbS = 0.75 + 0.5 * L.cheekbones;
  const chS = 0.65 + 0.6 * L.cheeks + 0.25 * fat;
  const browR = 0.011 + 0.007 * L.browRidge;
  const ns = L.noseS;
  const nw = L.noseW;
  const tipZ = L.noseTipZ;
  const tipY = L.noseTipY;
  const [ePx, ePy, ePz] = PROJ;
  const adam = clamp((L.jawP - 0.55) * 2.2, 0, 1) * (1 - fat * 0.6);
  return function sdf(x, y, z) {
    const ax = abs(x);
    // Cranium + face mass (the face recedes at the sides; the midline carries the profile).
    let d = ellipsoid(x, y - 0.022, z + 0.014, 0.106 * (0.97 + 0.03 * fw), 0.128, 0.12);
    d = smin(d, ellipsoid(x, y + 0.05, z - 0.0, 0.088 * fw, 0.092, 0.09), 0.035);
    // Jaw lines to the chin + chin ball + muzzle (dental arch).
    d = smin(d, capsule(ax, y, z, jawX, -0.098, -0.03, 0.014, chinY + 0.006, chinZ - 0.016, jawR), 0.035);
    d = smin(d, ellipsoid(x, y - chinY, z - chinZ, 0.022 + 0.01 * L.jawP + 0.006 * fat, 0.021 + 0.004 * fat, 0.021), 0.025);
    d = smin(d, ellipsoid(x, y + 0.083, z - 0.04, 0.046 * mw, 0.038, 0.055), 0.028);
    // Cheekbones and soft cheeks.
    d = smin(d, ellipsoid(ax - 0.054 * fw, y + 0.028, z - 0.048, 0.026 * cbS, 0.017 * cbS, 0.024 * cbS), 0.028);
    d = smin(d, ellipsoid(ax - 0.046 * fw, y + 0.07, z - 0.038, 0.03 * chS, 0.028 * chS, 0.03 * chS), 0.03);
    // Jowls (age, fat) and double chin (fat).
    if (old * (0.4 + fat) > 0.05) d = smin(d, ellipsoid(ax - 0.05 * fw, y + 0.118, z - 0.04, 0.022, 0.02, 0.022 * (0.4 + old)), 0.02);
    if (fat > 0.35) d = smin(d, ellipsoid(x, y + 0.155, z - 0.035, 0.05 * fat, 0.025 * fat, 0.04 * fat), 0.03);
    // Brow ridge.
    d = smin(d, capsule(ax, y, z, 0.011, L.browY + 0.003, 0.094, 0.054 * fw, L.browY + 0.009, 0.074, browR), 0.016);
    // Neck (elliptic column matching the body seam) blended into skull and jaw.
    if (nk) {
      const nz = z - nk.cz;
      const rz = nz > 0 ? nk.F : nk.B;
      const q = sqrt((x / nk.W) ** 2 + (nz / rz) ** 2);
      let dn = (q - 1) * min(nk.W, rz);
      dn = max(dn, y - 0.0);
      d = smin(d, dn, 0.035);
      if (adam > 0) d = smin(d, ellipsoid(x, y - (nk.y + 0.04), nz - nk.F + 0.002, 0.009, 0.014, 0.008 * adam + 0.002), 0.012);
    }
    // Eye sockets.
    for (const e of L.eyes) {
      const sx = x - e.c[0];
      const er = L.eyeR + L.lidT;
      d = smax(d, -ellipsoid(sx, y - e.c[1] - 0.002, z - e.c[2], er * 1.32, er * 1.1, er * 1.0), 0.012);
    }
    // Lid shells (eyeball + lid thickness, open in the almond) blended into the socket.
    for (const e of L.eyes) {
      const [h, v, r] = eyeAngles(L, e, x, y, z);
      const shell = r - (L.eyeR + L.lidT);
      const open = eyeOpening(L, e, h, v);
      const lid = max(shell, open * L.eyeR, (-open - 0.42) * L.eyeR, -(z - e.c[2] + 0.002));
      d = smin(d, lid, 0.0095);
    }
    // Nose: bridge, tip, wings; nostrils carved.
    const bridgeR = (0.006 + 0.003 * L.bridge) * nw;
    d = smin(d, capsule(x, y, z, 0, L.browY - 0.016, 0.097, 0, tipY + 0.012, tipZ - 0.016, bridgeR), 0.012);
    d = smin(d, ellipsoid(x, y - tipY, z - tipZ + 0.012, 0.0122 * nw * ns, 0.0115 * ns, 0.012 * ns), 0.01);
    d = smin(d, ellipsoid(ax - 0.0128 * nw * ns, y - tipY + 0.0065, z - tipZ + 0.027, 0.0085 * ns, 0.0078 * ns, 0.0095 * ns), 0.009);
    d = smax(d, -ellipsoid(ax - 0.0072 * nw * ns, y - tipY + 0.0135, z - tipZ + 0.019, 0.0042 * ns, 0.0024, 0.0058 * ns), 0.003);
    // Lips.
    const mz = L.mouthZ;
    d = smin(d, ellipsoid(x, y - L.mouthY - 0.0068, z - mz + 0.004, 0.024 * mw, 0.0058 * L.lipT, 0.0095), 0.009);
    d = smin(d, ellipsoid(x, y - L.mouthY + 0.0082, z - mz + 0.006, 0.0215 * mw, 0.0078 * L.lipT, 0.0105), 0.01);
    // Mouth slit: a thin sheet at constant elevation from PROJ (a grid row runs along it).
    {
      const qx = x - ePx;
      const qy = y - ePy;
      const qz = z - ePz;
      const az = atan2(qx, qz);
      const u = abs(az) / L.mouthAz;
      if (u < 1.15 && qz > 0.06) {
        const rr = hypot(qx, qy, qz);
        const el = atan2(qy, hypot(qx, qz));
        const eps = 0.0016 * max(0, 1 - u * u) ** 0.5;
        const slit = max(abs(el - L.mouthElev) * rr - eps, (u - 1) * 0.03, 0.074 - rr);
        d = smax(d, -slit, 0.0018);
      }
    }
    // Eyeballs themselves.
    for (const e of L.eyes) d = min(d, hypot(x - e.c[0], y - e.c[1], z - e.c[2]) - L.eyeR);
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
    P[`cheek.${s}`] = [sx * 0.05 * L.fw, -0.058, 0.082];
    P[`brow.in.${s}`] = [sx * 0.018, L.browY + 0.002, 0.1];
    P[`brow.out.${s}`] = [sx * 0.05 * L.fw, L.browY + 0.006, 0.088];
  }
  return P;
}
