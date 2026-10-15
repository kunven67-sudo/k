// Body part shapes for the soft, rounded, toy-like people ("Fall Guys but human").
// All parts are shared geometry drawn with instancing, so 40+ people cost about the same as one.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const G = {};

function capsule(r, len, radial = 10, cap = 5) {
  const g = new THREE.CapsuleGeometry(r, len, cap, radial);
  return g;
}

function sphere(r, w = 14, h = 10) { return new THREE.SphereGeometry(r, w, h); }

function at(g, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  g.applyMatrix4(m);
  return g;
}

function merge(list) {
  const clean = list.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (k !== 'position') n.deleteAttribute(k);
    return n;
  });
  // weld matching corners so the normals come out smooth (not faceted)
  const m = mergeVertices(mergeGeometries(clean, false), 1e-5);
  m.computeVertexNormals();
  return m;
}

// Half sphere cap used for hair
function cap(r, thetaLen = Math.PI * 0.55, w = 16, h = 8) {
  return new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, 0, thetaLen);
}

export function buildParts() {
  if (G.torso) return G;
  // lengths here are the "straight" part of capsules; the instance matrix stretches them to the bone length
  G.torso = capsule(0.17, 0.30, 14, 6);
  G.half = capsule(0.17, 0.10, 14, 6);
  G.pelvis = sphere(0.17, 14, 10);
  G.head = merge([sphere(0.165, 18, 14), at(sphere(0.12, 12, 8), 0, -0.06, 0.03, 1.05, 0.8, 1)]);
  G.eye = sphere(0.036, 10, 8);
  G.pupil = sphere(0.019, 8, 6);
  G.brow = new THREE.CapsuleGeometry(0.011, 0.055, 2, 6).rotateZ(Math.PI / 2);
  G.mouth = new THREE.CapsuleGeometry(0.012, 0.05, 2, 8).rotateZ(Math.PI / 2);
  G.nose = sphere(0.028, 8, 6);
  G.ear = at(sphere(0.035, 8, 6), 0, 0, 0, 0.55, 1, 0.85);
  G.upperArm = capsule(0.068, 0.15, 10, 4);
  G.forearm = capsule(0.06, 0.14, 10, 4);
  G.hand = merge([at(sphere(0.066, 10, 8), 0, 0, 0, 0.9, 1.15, 0.7), at(sphere(0.028, 6, 5), 0.05, 0.02, 0.02)]);
  G.thigh = capsule(0.088, 0.26, 10, 4);
  G.shin = capsule(0.076, 0.27, 10, 4);
  G.foot = merge([at(sphere(0.07, 10, 8), 0, 0, 0.05, 0.85, 0.65, 1.6)]);
  G.shoulder = sphere(0.088, 10, 8);
  // gore
  G.stump = merge([at(new THREE.CylinderGeometry(1, 1, 0.25, 12), 0, 0, 0), at(new THREE.CylinderGeometry(0.35, 0.35, 0.6, 8), 0, 0.3, 0)]);
  G.drop = sphere(1, 6, 4);
  G.decal = new THREE.CircleGeometry(1, 10).rotateX(-Math.PI / 2);
  G.gut = capsule(0.035, 0.08, 6, 3);
  // hair styles (caps are tilted back so the hairline sits above the eyebrows)
  const hc = (r, theta, tilt = 0.72) => cap(r, theta).rotateX(-tilt);
  G.hair_short = merge([at(hc(0.179, Math.PI * 0.5), 0, 0.01, -0.004)]);
  G.hair_buzz = merge([at(hc(0.171, Math.PI * 0.46, 0.75), 0, 0.006, -0.003)]);
  G.hair_long = merge([at(hc(0.18, Math.PI * 0.58, 0.62), 0, 0.01, -0.006), at(new THREE.CapsuleGeometry(0.15, 0.16, 4, 12), 0, -0.13, -0.085, 1.12, 1, 0.5)]);
  G.hair_spiky = merge([at(hc(0.177, Math.PI * 0.5), 0, 0.01, 0),
    ...[...Array(9)].map((_, i) => { const a = (i / 9) * Math.PI * 2; return at(new THREE.ConeGeometry(0.045, 0.12, 6), Math.cos(a) * 0.09, 0.15, Math.sin(a) * 0.09 - 0.04, 1, 1, 1, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); }),
    at(new THREE.ConeGeometry(0.05, 0.14, 6), 0, 0.2, -0.02)]);
  G.hair_bun = merge([at(hc(0.179, Math.PI * 0.5), 0, 0.01, -0.004), at(sphere(0.07, 10, 8), 0, 0.15, -0.12)]);
  G.hair_pony = merge([at(hc(0.179, Math.PI * 0.5), 0, 0.01, -0.004), at(new THREE.CapsuleGeometry(0.045, 0.16, 4, 8), 0, -0.04, -0.21, 1, 1, 1, 0.5, 0, 0)]);
  G.hair_afro = merge([at(sphere(0.22, 14, 10), 0, 0.09, -0.085)]);
  G.hair_mohawk = merge([at(hc(0.169, Math.PI * 0.4, 0.7), 0, 0.004, 0), at(new THREE.BoxGeometry(0.04, 0.12, 0.3), 0, 0.17, -0.03)]);
  G.hair_curly = merge([...[...Array(14)].map((_, i) => { const a = (i / 14) * Math.PI * 2; const b = (i % 3) * 0.25; return at(sphere(0.06, 8, 6), Math.cos(a) * 0.14 * Math.cos(b), 0.11 + b * 0.16, Math.sin(a) * 0.13 * Math.cos(b) - 0.06); }), at(hc(0.173, Math.PI * 0.5), 0, 0.01, 0)]);
  G.beard = merge([at(sphere(0.13, 12, 8, ), 0, -0.08, 0.06, 1.05, 0.75, 0.75)]);
  G.mustache = merge([at(new THREE.CapsuleGeometry(0.014, 0.06, 2, 6).rotateZ(Math.PI / 2), 0, -0.045, 0.155)]);
  G.glasses = merge([at(new THREE.TorusGeometry(0.035, 0.007, 6, 14), 0.06, 0.03, 0.158), at(new THREE.TorusGeometry(0.035, 0.007, 6, 14), -0.06, 0.03, 0.158), at(new THREE.BoxGeometry(0.05, 0.008, 0.008), 0, 0.035, 0.16)]);
  G.goggles = merge([at(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 14).rotateX(Math.PI / 2), 0.062, 0.035, 0.16), at(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 14).rotateX(Math.PI / 2), -0.062, 0.035, 0.16), at(new THREE.TorusGeometry(0.17, 0.012, 6, 24).rotateX(Math.PI / 2), 0, 0.04, 0)]);
  // hats
  G.hat_cop = merge([at(new THREE.CylinderGeometry(0.17, 0.165, 0.09, 16), 0, 0.15, 0), at(new THREE.CylinderGeometry(0.12, 0.12, 0.012, 14), 0, 0.11, 0.1, 1, 1, 0.7)]);
  G.hat_hard = merge([at(cap(0.19, Math.PI * 0.5), 0, 0.03, 0), at(new THREE.CylinderGeometry(0.22, 0.22, 0.012, 16), 0, 0.03, 0.02)]);
  G.hat_chef = merge([at(new THREE.CylinderGeometry(0.15, 0.14, 0.14, 14), 0, 0.2, 0), at(sphere(0.17, 12, 8), 0, 0.3, 0, 1, 0.6, 1)]);
  G.hat_beanie = merge([at(cap(0.185, Math.PI * 0.5), 0, 0.03, 0), at(sphere(0.04, 8, 6), 0, 0.21, 0)]);
  G.hat_cap = merge([at(cap(0.18, Math.PI * 0.5), 0, 0.02, 0), at(new THREE.CylinderGeometry(0.11, 0.11, 0.012, 14), 0, 0.03, 0.17, 1, 1, 0.75)]);
  G.hat_witch = merge([at(new THREE.ConeGeometry(0.15, 0.36, 14), 0, 0.3, 0), at(new THREE.CylinderGeometry(0.28, 0.28, 0.012, 18), 0, 0.12, 0)]);
  G.hat_crown = merge([at(new THREE.CylinderGeometry(0.13, 0.13, 0.07, 10, 1, true), 0, 0.19, 0), ...[...Array(5)].map((_, i) => { const a = (i / 5) * Math.PI * 2; return at(new THREE.ConeGeometry(0.03, 0.06, 4), Math.cos(a) * 0.12, 0.25, Math.sin(a) * 0.12); })]);
  G.hat_horns = merge([at(new THREE.ConeGeometry(0.035, 0.12, 8), 0.1, 0.17, 0, 1, 1, 1, 0, 0, -0.4), at(new THREE.ConeGeometry(0.035, 0.12, 8), -0.1, 0.17, 0, 1, 1, 1, 0, 0, 0.4)]);
  G.hat_band = merge([at(new THREE.TorusGeometry(0.168, 0.018, 6, 24).rotateX(Math.PI / 2), 0, 0.06, 0), at(sphere(0.03, 8, 6), 0, 0.08, 0.17)]);
  G.skirt = merge([at(new THREE.CylinderGeometry(0.17, 0.3, 0.32, 14, 1, true), 0, -0.1, 0)]);
  G.coat = merge([at(new THREE.CylinderGeometry(0.2, 0.27, 0.62, 14, 1, true), 0, -0.3, 0)]);
  G.pack = merge([at(new THREE.BoxGeometry(0.22, 0.26, 0.1), 0, 0, 0)]);
  for (const k of Object.keys(G)) G[k].userData.shared = true;
  return G;
}

export const PARTS = G;

export const HAIR_STYLES = ['short', 'buzz', 'long', 'spiky', 'bun', 'pony', 'afro', 'mohawk', 'curly', 'bald'];
export const HATS = ['cop', 'hard', 'chef', 'beanie', 'cap', 'witch', 'crown', 'horns', 'band'];
