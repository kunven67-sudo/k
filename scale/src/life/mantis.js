// The praying mantis (European mantis, Mantis religiosa: common in California gardens).
// Adult female: about 7 cm long, 2.5 g, leaf green.
//
// Real body: a triangular head that turns almost all the way around, two big compound eyes (the
// small black "pupil" you see is a real optical effect, it always seems to look at you), three tiny
// simple eyes, long antennae, a long neck-like prothorax, spiked raptorial front legs that fold like
// a jackknife (with the black-and-white eye spot on the inside of each front coxa that this species
// has), four thin walking legs, leathery forewings over a long segmented abdomen, two cerci at the tip.
//
// Real behavior (nothing random, everything has a reason):
//  - It hunts by ambush. It sees MOVEMENT: a still thing is hard for it to notice unless it's close.
//  - The head turns first, in quick jerks, then the body.
//  - It sways side to side like a leaf in the wind while it waits and while it creeps closer.
//  - It strikes when prey is in reach: the front legs shoot out and snap back in about 1/20 of a second.
//  - It eats things smaller than itself; hunger decides how much it cares. A full mantis grooms and rests.
//  - Something much bigger that comes close gets the threat display (rears up, wings out, front legs
//    up and open, abdomen curled), and if it keeps coming, the mantis walks away.
import * as THREE from 'three';
import { phys, std } from '../render/materials.js';
import * as TX from '../render/textures.js';
import { clamp, damp, angDiff, hash3 } from '../core/util.js';
import { bus } from '../core/events.js';
import { input } from '../core/input.js';
import { Creature, Leg, segmentGeo } from './creature.js';
import { CATALOG } from '../props/catalog.js';

const L = 0.07; // body length (m)
const FORE_REACH = 0.0108 + 0.0145 + 0.0074; // coxa + femur + tibia, fully stretched out (m)
const RIDE = 0.0105; // thorax height above the ground
const PRO_PITCH = 0.55; // the prothorax is held raised
const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _m = new THREE.Matrix4();

const cache = new Map();
const once = (k, f) => (cache.has(k) ? cache.get(k) : (cache.set(k, f()), cache.get(k)));

// ---- materials ----------------------------------------------------------------------------------
function mats() {
  return once('mantis', () => {
    const skin = TX.generate('mantisSkin', 128, (u, v) => {
      const n = TX.fbm(u, v, { freq: 6, oct: 4, seed: 501 });
      const streak = TX.fbm(u * 0.25, v, { freq: 16, oct: 2, seed: 502 });
      const d = 0.86 + n * 0.22;
      return [0.3 * d + streak * 0.05, 0.5 * d + streak * 0.05, 0.14 * d, n * 0.4 + streak * 0.2, 0.5];
    }, { normalStrength: 1.2 });
    const wingT = (() => {
      const cv = document.createElement('canvas');
      cv.width = 128;
      cv.height = 512;
      const c = cv.getContext('2d');
      const gr = c.createLinearGradient(0, 0, 128, 0);
      gr.addColorStop(0, '#5c8c2a');
      gr.addColorStop(0.5, '#7aaa3a');
      gr.addColorStop(1, '#6a9a30');
      c.fillStyle = gr;
      c.fillRect(0, 0, 128, 512);
      // Veins: long ones along the wing, short cross-veins between them (real wing venation pattern).
      c.strokeStyle = 'rgba(40,70,20,0.55)';
      c.lineWidth = 2;
      for (const x of [22, 46, 70, 94]) {
        c.beginPath();
        c.moveTo(x, 0);
        c.bezierCurveTo(x + 6, 170, x - 6, 340, x + 4, 512);
        c.stroke();
      }
      c.lineWidth = 1;
      for (let y = 10; y < 512; y += 14) {
        for (const [x0, x1] of [[22, 46], [46, 70], [70, 94]]) {
          c.beginPath();
          c.moveTo(x0, y + (x0 % 7));
          c.lineTo(x1, y + 5 + (x1 % 5));
          c.stroke();
        }
      }
      // The pale stripe along the front edge of the forewing.
      c.fillStyle = 'rgba(200,230,140,0.35)';
      c.fillRect(0, 0, 10, 512);
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const hindT = (() => {
      const cv = document.createElement('canvas');
      cv.width = 256;
      cv.height = 256;
      const c = cv.getContext('2d');
      c.fillStyle = 'rgba(190,220,170,0.55)';
      c.fillRect(0, 0, 256, 256);
      c.strokeStyle = 'rgba(60,90,40,0.6)';
      for (let i = 0; i < 14; i++) {
        c.beginPath();
        c.moveTo(0, 128);
        c.lineTo(256, (i / 13) * 256);
        c.stroke();
      }
      for (let r = 30; r < 260; r += 22) {
        c.beginPath();
        c.arc(0, 128, r, -1.2, 1.2);
        c.stroke();
      }
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    return {
      body: phys({ map: skin.map, normalMap: skin.normalMap, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4 }, { detail: 'chitin' }),
      leg: phys({ color: 0x9cc060, map: skin.map, roughness: 0.48, clearcoat: 0.3, clearcoatRoughness: 0.4 }, { detail: 'chitin' }),
      eye: phys({ color: 0xa8c870, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }, { detail: 'chitin' }),
      pupil: std({ color: 0x050805, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      ocellus: std({ color: 0xe8d070, roughness: 0.2 }),
      mouth: std({ color: 0x6a4a22, roughness: 0.45 }, { detail: 'chitin' }),
      spine: std({ color: 0x2f3a1a, roughness: 0.4 }, { detail: 'chitin' }),
      wing: std({ map: wingT, transparent: true, opacity: 0.94, side: THREE.DoubleSide, roughness: 0.55, depthWrite: true }, { detail: 'chitin' }),
      hind: std({ map: hindT, transparent: true, opacity: 0.7, side: THREE.DoubleSide, roughness: 0.4, depthWrite: false }, { detail: 'glass' }),
      spot: std({ color: 0x0b0b0b, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      spotRing: std({ color: 0xe8ecd8, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    };
  });
}

// A long body part as a surface of revolution along +Z from 0 to len, radius from r(t).
function pod(len, r, segs = 24, radial = 14, flatY = 1) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    pts.push(new THREE.Vector2(Math.max(0, r(t)), t * len));
  }
  const g = new THREE.LatheGeometry(pts, radial);
  g.rotateX(Math.PI / 2); // +Y -> +Z
  if (flatY !== 1) g.scale(1, flatY, 1);
  g.computeVertexNormals();
  return g;
}

function mesh(geo, mat, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// ---- model --------------------------------------------------------------------------------------
function buildMantis(c) {
  const M = mats();
  const root = new THREE.Group();
  const J = {}; // joints we animate

  const thorax = new THREE.Group();
  thorax.position.set(0, RIDE, 0);
  root.add(thorax);
  J.thorax = thorax;
  // Meso + metathorax (where the wings and walking legs attach).
  mesh(pod(0.013, (t) => 0.0021 * Math.pow(Math.sin(Math.PI * (0.08 + 0.84 * t)), 0.55), 16, 12, 0.85), M.body, thorax, 0, 0, -0.0065);

  // Abdomen: 8 segments, wider toward the back (a female), curving slightly down, flattened.
  const abd = new THREE.Group();
  abd.position.set(0, 0.0002, 0.0058);
  thorax.add(abd);
  J.abdomen = abd;
  const abdGeo = pod(0.033, (t) => {
    const base = 0.0019 + 0.0015 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.08 + t * 1.0)), 0.7);
    const seg = 1 - 0.035 * Math.pow(Math.abs(Math.sin(t * Math.PI * 8)), 6);
    return base * seg * (t > 0.9 ? Math.max(0, (1 - t) / 0.1) ** 0.55 : 1);
  }, 48, 14, 0.62);
  // Slight downward curve toward the tip.
  const ap = abdGeo.attributes.position;
  for (let i = 0; i < ap.count; i++) ap.setY(i, ap.getY(i) - (ap.getZ(i) / 0.033) ** 2 * 0.0018);
  abdGeo.computeVertexNormals();
  mesh(abdGeo, M.body, abd);
  for (const s of [-1, 1]) {
    const cercus = mesh(segmentGeo(0.003, 0.00028, 0.00008, 5), M.leg, abd, s * 0.0006, -0.0016, 0.0325);
    cercus.rotation.set(Math.PI / 2 + 0.25, 0, s * 0.3);
  }

  // Wings: leathery green forewings folded over the abdomen (right over left), hind wings under them.
  const wings = new THREE.Group();
  wings.position.set(0, 0.0024, -0.0035);
  thorax.add(wings);
  J.wings = [];
  const foreShape = new THREE.Shape();
  foreShape.moveTo(0, 0);
  foreShape.bezierCurveTo(0.0032, 0.004, 0.0034, 0.024, 0.0018, 0.034);
  foreShape.bezierCurveTo(0.0008, 0.0352, -0.0004, 0.034, -0.0006, 0.031);
  foreShape.bezierCurveTo(-0.0012, 0.02, -0.0010, 0.006, 0, 0);
  const foreGeo = new THREE.ShapeGeometry(foreShape, 18);
  // Lay it flat along +Z, bend the outer edge down so it hugs the abdomen.
  foreGeo.rotateX(Math.PI / 2);
  {
    const p = foreGeo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, -Math.pow(Math.max(0, p.getX(i)), 2) * 120 - Math.pow(Math.max(0, p.getZ(i) - 0.024), 2) * 6);
    foreGeo.computeVertexNormals();
    // UVs: across x, along z.
    const uv = foreGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 0.0012) / 0.0048, p.getZ(i) / 0.035);
  }
  const hindShape = new THREE.Shape();
  hindShape.moveTo(0, 0);
  hindShape.bezierCurveTo(0.012, 0.004, 0.02, 0.016, 0.0185, 0.03);
  hindShape.bezierCurveTo(0.012, 0.034, 0.002, 0.032, 0, 0.028);
  hindShape.lineTo(0, 0);
  const hindGeo = new THREE.ShapeGeometry(hindShape, 14);
  hindGeo.rotateX(Math.PI / 2);
  {
    const p = hindGeo.attributes.position, uv = hindGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 0.02, p.getZ(i) / 0.034);
  }
  for (const s of [-1, 1]) {
    const pivotH = new THREE.Group();
    pivotH.position.set(s * 0.0004, -0.0002, 0);
    wings.add(pivotH);
    const h = mesh(hindGeo, M.hind, pivotH);
    h.scale.set(s * 0.18, 1, 1); // folded like a fan
    h.castShadow = false;
    const pivotF = new THREE.Group();
    pivotF.position.set(s * 0.0005, s > 0 ? 0.00025 : 0, 0);
    wings.add(pivotF);
    const f = mesh(foreGeo, M.wing, pivotF);
    f.scale.set(s, 1, 1);
    J.wings.push({ s, fore: pivotF, hind: pivotH, hindMesh: h });
  }

  // Prothorax: the long "neck", raised. Front legs and head attach at its front end.
  const pro = new THREE.Group();
  pro.position.set(0, 0.0006, -0.0058);
  pro.rotation.x = PRO_PITCH;
  thorax.add(pro);
  J.pro = pro;
  const proGeo = pod(0.0205, (t) => {
    // Wider at the back, thin in the middle, widened again where the front legs attach.
    const back = 0.0015 * Math.exp(-((t - 0.05) ** 2) / 0.02);
    const front = 0.0017 * Math.exp(-((t - 0.88) ** 2) / 0.006);
    return Math.max(0.0011, back, front) * (t > 0.97 ? (1 - t) / 0.03 : 1) * (t < 0.02 ? 0.6 + t * 20 : 1);
  }, 40, 12, 0.85);
  proGeo.rotateY(Math.PI); // along -Z
  mesh(proGeo, M.body, pro);

  // Head: a rounded triangle (wide at the eyes, narrow at the mouth), turning on a short neck.
  const headYaw = new THREE.Group();
  headYaw.position.set(0, 0.0004, -0.0208);
  pro.add(headYaw);
  const headPitch = new THREE.Group();
  headPitch.rotation.x = -PRO_PITCH - 0.35;
  headYaw.add(headPitch);
  J.headYaw = headYaw;
  J.headPitch = headPitch;
  const hg = new THREE.SphereGeometry(1, 28, 20);
  {
    const p = hg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      // Narrow toward the bottom (the mouth), flat front-to-back.
      const narrow = 1 - Math.max(0, -y) * 0.62;
      x *= narrow;
      p.setXYZ(i, x * 0.0031, y * 0.0024, z * 0.0015 - 0.0012);
    }
    hg.computeVertexNormals();
  }
  mesh(hg, M.body, headPitch);
  // Compound eyes on the top corners, bulging out.
  J.eyes = [];
  for (const s of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.00122, 20, 14), M.eye, headPitch, s * 0.0026, 0.0011, -0.0010);
    eye.scale.set(0.95, 1.15, 1);
    // The pseudopupil: a black dot that sits where the eye points at whoever is looking.
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.00028, 12), M.pupil);
    pupil.castShadow = false;
    headPitch.add(pupil);
    J.eyes.push({ eye, pupil, r: 0.00122 });
  }
  // Three simple eyes (ocelli) between the antennae.
  for (const [x, y] of [[0, 0.0016], [-0.0006, 0.0012], [0.0006, 0.0012]]) mesh(new THREE.SphereGeometry(0.00022, 8, 6), M.ocellus, headPitch, x, y, -0.0024);
  // Mouthparts: mandibles and palps.
  J.mandibles = [];
  for (const s of [-1, 1]) {
    const mand = new THREE.Group();
    mand.position.set(s * 0.00045, -0.0021, -0.0018);
    headPitch.add(mand);
    const mm = mesh(new THREE.ConeGeometry(0.00045, 0.0011, 6), M.mouth, mand, 0, -0.0004, 0);
    mm.rotation.z = s * 0.4;
    J.mandibles.push({ g: mand, s });
    const palp = mesh(segmentGeo(0.0016, 0.00016, 0.0001, 5), M.mouth, headPitch, s * 0.0009, -0.0016, -0.0017);
    palp.rotation.set(-0.3, 0, s * 2.7);
  }
  // Antennae: long, thin, sweeping up and out.
  J.antennae = [];
  for (const s of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      pts.push(new THREE.Vector3(s * (0.0005 + t * 0.01), 0.0019 + Math.sin(t * 1.6) * 0.012, -0.0022 - t * 0.016 + t * t * 0.008));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const a = mesh(new THREE.TubeGeometry(curve, 24, 0.00009, 5, false), M.leg, headPitch);
    a.castShadow = false;
    J.antennae.push(a);
  }

  // Raptorial front legs: coxa, femur (with two rows of spines), tibia (spines + hook), tarsus.
  // Chain of joints; each bone points down (-Y) at angle 0, positive angles swing it forward.
  J.fore = [];
  const coxaLen = 0.0108, femLen = 0.0145, tibLen = 0.0074, tarLen = 0.0058;
  const down = (g) => g.rotateX(Math.PI); // geometry built along +Y -> along -Y
  for (const s of [-1, 1]) {
    const base = new THREE.Group();
    base.position.set(s * 0.0013, -0.0009, -0.0172);
    pro.add(base);
    const coxa = new THREE.Group();
    base.add(coxa);
    const cg = down(segmentGeo(coxaLen, 0.00095, 0.0008, 10, 1, 0.7));
    mesh(cg, M.body, coxa);
    // The eye spot on the inner face of the coxa (black with a pale ring).
    const ring = mesh(new THREE.CircleGeometry(0.00062, 16), M.spotRing, coxa, -s * 0.00066, -0.0028, 0);
    ring.rotation.y = -s * Math.PI / 2;
    ring.castShadow = false;
    const spot = mesh(new THREE.CircleGeometry(0.00044, 16), M.spot, coxa, -s * 0.00068, -0.0028, 0);
    spot.rotation.y = -s * Math.PI / 2;
    spot.castShadow = false;
    const fem = new THREE.Group();
    fem.position.set(0, -coxaLen, 0);
    coxa.add(fem);
    const fg = down(segmentGeo(femLen, 0.00125, 0.0007, 12, 1, 0.55));
    mesh(fg, M.body, fem);
    // Two rows of spines along the inner/lower edge of the femur.
    const spineGeo = new THREE.ConeGeometry(0.00012, 0.0009, 5);
    spineGeo.translate(0, 0.00045, 0);
    for (let i = 0; i < 9; i++) {
      for (const row of [-1, 1]) {
        const sp = mesh(spineGeo, M.spine, fem, row * 0.00028, -0.0018 - i * 0.0013, -0.00085);
        sp.rotation.x = -Math.PI / 2 - 0.35;
        sp.scale.setScalar(i % 3 === 0 ? 1.3 : 0.8);
        sp.castShadow = false;
      }
    }
    const tib = new THREE.Group();
    tib.position.set(0, -femLen, 0);
    fem.add(tib);
    mesh(down(segmentGeo(tibLen, 0.00055, 0.00034, 8, 1, 0.6)), M.body, tib);
    for (let i = 0; i < 7; i++) {
      const sp = mesh(spineGeo, M.spine, tib, 0, -0.0009 - i * 0.00085, -0.0004);
      sp.rotation.x = -Math.PI / 2 - 0.5;
      sp.scale.setScalar(0.7);
      sp.castShadow = false;
    }
    const hook = mesh(new THREE.ConeGeometry(0.00018, 0.0013, 6), M.spine, tib, 0, -tibLen - 0.0004, -0.0002);
    hook.rotation.x = -0.9;
    const tar = new THREE.Group();
    tar.position.set(0, -tibLen + 0.0006, 0.0002);
    tib.add(tar);
    mesh(down(segmentGeo(tarLen, 0.00018, 0.0001, 5)), M.leg, tar);
    const pose = { coxa: 0.5, fem: 2.6, tib: -0.45, tar: 0.3, spread: 0.08 };
    J.fore.push({ s, base, coxa, fem, tib, tar, pose: { ...pose } });
  }

  // Walking legs (IK): middle pair reaches forward, hind pair back. Diagonal pairs step together.
  root.userData.legs = [
    new Leg({ hip: [-0.0016, RIDE - 0.0007, -0.0042], rest: [-0.0175, 0, -0.0105], femur: 0.012, tibia: 0.0112, tarsus: 0.0075, side: -1, group: 0, mats: M, radius: [0.00048, 0.00034, 0.00022] }),
    new Leg({ hip: [0.0016, RIDE - 0.0007, -0.0042], rest: [0.0175, 0, -0.0105], femur: 0.012, tibia: 0.0112, tarsus: 0.0075, side: 1, group: 1, mats: M, radius: [0.00048, 0.00034, 0.00022] }),
    new Leg({ hip: [-0.0017, RIDE - 0.0008, 0.0035], rest: [-0.0215, 0, 0.0235], femur: 0.0158, tibia: 0.0168, tarsus: 0.0095, side: -1, group: 1, mats: M, radius: [0.0005, 0.00034, 0.00022] }),
    new Leg({ hip: [0.0017, RIDE - 0.0008, 0.0035], rest: [0.0215, 0, 0.0235], femur: 0.0158, tibia: 0.0168, tarsus: 0.0095, side: 1, group: 0, mats: M, radius: [0.0005, 0.00034, 0.00022] }),
  ];
  root.userData.joints = J;
  return root;
}

// Front leg poses: angles from straight down (+ = swung forward), in the body's frame.
const POSES = {
  rest: { coxa: 0.5, fem: 2.6, tib: -0.45, tar: 0.3, spread: 0.08 },
  ready: { coxa: 0.75, fem: 2.45, tib: -0.15, tar: 0.4, spread: 0.1 },
  strike: { coxa: 1.25, fem: 1.75, tib: 1.55, tar: 1.4, spread: 0.05 },
  hold: { coxa: 0.95, fem: 2.2, tib: -0.25, tar: 0.2, spread: 0.12 },
  threat: { coxa: 1.6, fem: 3.0, tib: 1.2, tar: 1.4, spread: 0.55 },
  groom: { coxa: 1.05, fem: 2.75, tib: 0.25, tar: 0.6, spread: 0.02 },
};

// ---- species ------------------------------------------------------------------------------------
export const MANTIS_DEF = {
  id: 'mantis', name: 'Praying mantis', brand: 'Live insect', category: 'Pets & bugs', material: 'chitin',
  size: L, mass: 0.0025, ride: RIDE, price: 14.99,
  // Body colliders (model space, facing -Z): thorax + abdomen, then the raised neck + head.
  shapes: [
    { t: 'cap', r: 0.0036, h: 0.016, p: [0, RIDE + 0.0004, 0.0135], rot: [Math.PI / 2, 0, 0] },
    { t: 'cap', r: 0.0026, h: 0.0085, p: [0, RIDE + 0.0062, -0.0145], rot: [-(Math.PI / 2 - PRO_PITCH), 0, 0] },
  ],
  build: () => {
    const m = buildMantis();
    // Static pose for product photos: legs planted around it.
    const legs = m.userData.legs;
    for (const l of legs) {
      for (const msh of l.meshes) m.add(msh);
      const foot = l.rest.clone();
      const ankle = new THREE.Vector3(foot.x * 0.8, l.len[2] * 0.25, foot.z * 0.8 + (foot.z > 0 ? 0 : 0));
      const knee = new THREE.Vector3();
      solveKneeStatic(l.hip, ankle, l.len[0], l.len[1], new THREE.Vector3(l.side * 0.6, 1, 0).normalize(), knee);
      placeSeg(l.meshes[0], l.hip, knee, l.len[0]);
      placeSeg(l.meshes[1], knee, ankle, l.len[1]);
      placeSeg(l.meshes[2], ankle, foot, l.len[2]);
    }
    applyForePoses(m.userData.joints, 0);
    return m;
  },
  spawn: (game, opts) => new Mantis(game, opts),
};

function solveKneeStatic(hip, target, a, b, pole, out) {
  const u = target.clone().sub(hip);
  let d = u.length();
  u.normalize();
  d = clamp(d, Math.abs(a - b) + 1e-6, a + b - 1e-6);
  const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
  const v = pole.clone().addScaledVector(u, -pole.dot(u)).normalize();
  return out.copy(hip).addScaledVector(u, a * cosA).addScaledVector(v, a * Math.sqrt(1 - cosA * cosA));
}
function placeSeg(mesh, a, b, len) {
  const d = b.clone().sub(a);
  const l = d.length();
  mesh.position.copy(a);
  mesh.quaternion.setFromUnitVectors(UP, d.divideScalar(l));
  mesh.scale.set(1, l / len, 1);
}
function applyForePoses(J) {
  for (const f of J.fore) {
    const p = f.pose;
    // Body-frame angles -> joint angles (the prothorax is raised by PRO_PITCH).
    f.base.rotation.set(0, 0, f.s * p.spread);
    f.coxa.rotation.x = p.coxa - PRO_PITCH;
    f.fem.rotation.x = p.fem - p.coxa;
    f.tib.rotation.x = p.tib - p.fem;
    f.tar.rotation.x = p.tar - p.tib;
  }
}

export class Mantis extends Creature {
  constructor(game, opts = {}) {
    super(game, MANTIS_DEF, opts);
    this.J = this.model.userData.joints;
    this.state = 'ambush';
    this.stateT = 0;
    // How hungry it is right now (0 full .. 1 starving). A new mantis hasn't eaten for a while.
    this.hunger = opts.hunger ?? 0.55;
    this.turnRate = 2.6;
    this.stepTime = 1.15;
    this.stepLen = 0.2;
    this.head = { yaw: 0, pitch: 0, wantYaw: 0, wantPitch: 0 };
    this.foreK = 10;
    this.poseName = 'rest';
    this.strikeCooldown = 0;
    this.prey = null;
    this.struggle = 0;
    this.lastSeenT = -99;
    this.lastSeen = new THREE.Vector3();
    this.lunge = 0;
    this.threatAmt = 0;
    this.groomT = 0;
    this.idleT = 0;
    this.biteT = 0;
    this._chest = new THREE.Vector3();
    this._look = new THREE.Vector3();
    applyForePoses(this.J);
  }

  describe() {
    const pl = this.game.player;
    const r = pl.height / this.size;
    const mood = this.state === 'eat' ? 'eating' : this.state === 'threat' ? 'threatened' : this.hunger > 0.7 ? 'starving' : this.hunger > 0.35 ? 'hungry' : 'full';
    const what = r < 1.1 ? 'you look like food to it' : r > 2.2 ? 'you look like a threat to it' : 'it is wary of you';
    return `Praying mantis · ${mood} · ${what}`;
  }

  headWorld(out) {
    return this.J.headPitch.getWorldPosition(out);
  }

  _set(state) {
    if (this.state === state) return;
    this.state = state;
    this.stateT = 0;
  }

  think(dt) {
    const pl = this.game.player;
    const Lb = this.size;
    this.stateT += dt;
    this.strikeCooldown = Math.max(0, this.strikeCooldown - dt);
    // Hunger grows over about 15 minutes from full to starving.
    if (this.state !== 'eat') this.hunger = Math.min(1, this.hunger + dt / 900);
    this.wantSpeed = 0;

    // ---- senses: where are you, how big are you to it, are you moving?
    const head = this.headWorld(_v3);
    const chest = _v.copy(pl.feet).addScaledVector(UP, pl.height * 0.55);
    const dist = head.distanceTo(chest);
    const vs = Math.hypot(pl.vel.x, pl.vel.y, pl.vel.z) / Math.max(1e-6, pl.height);
    const moving = vs > 0.08 || Math.abs(pl.sizeRate) > 0.05;
    const ratio = pl.height / Lb;
    const sees = !pl.dead && dist < Lb * 60 && this.canSee(head, chest, pl.height, moving, { still: Lb * 0.9 / Math.max(dist, 1e-6) > 1 ? 0 : 0.5 });
    if (sees) {
      this.lastSeen.copy(chest);
      this.lastSeenT = this.t;
    }
    const recentlySeen = this.t - this.lastSeenT < 4;
    const toYaw = Math.atan2(-(this.lastSeen.x - this.pos.x), -(this.lastSeen.z - this.pos.z));
    const off = angDiff(this.yaw, toYaw);

    // ---- what it does
    if (this.state === 'eat') return this._eat(dt, pl);
    if (this.state === 'strike') return this._strike(dt, pl, chest);

    const isPrey = ratio > 0.035 && ratio < 1.1 && !pl.dead;
    const isThreat = ratio > 2.2;
    let look = recentlySeen ? this.lastSeen : null;

    if (recentlySeen && isThreat && dist < pl.height * 0.75 + Lb * 2.5) {
      // Something huge is close: threat display, then back off if it keeps coming.
      if (this.state !== 'threat' && this.state !== 'flee') this._set('threat');
      if (this.state === 'threat' && this.stateT > 2.5 && dist < pl.height * 0.45 + Lb * 1.2) this._set('flee');
    } else if (this.state === 'threat' || this.state === 'flee') {
      if (this.stateT > 2) this._set('ambush');
    } else if (recentlySeen && isPrey && this.hunger > 0.25) {
      const inFront = Math.abs(off) < 0.45;
      const shoulder = this._shoulder(_v2);
      const dShoulder = shoulder.distanceTo(chest);
      // In reach of its front legs (plus the little lunge it does), and it can see you.
      if (sees && inFront && dShoulder < FORE_REACH * this.scale * 0.92 + pl.radius && this.strikeCooldown <= 0) {
        this._set('strike');
        this.strikeHit = false;
        this.strikeAim = null;
        return this._strike(dt, pl, chest);
      }
      this._set(dist < Lb * 9 ? 'stalk' : 'track');
    } else if (!recentlySeen && this.hunger > 0.75) {
      if (this.state !== 'wander') this._set('wander');
    } else if (this.state !== 'groom' || this.stateT > 6) {
      // Nothing going on: wait in ambush, and groom from time to time (after meals and every ~45 s).
      const groomDue = this.t - this.groomT > 45;
      this._set(groomDue && !recentlySeen ? 'groom' : 'ambush');
      if (this.state === 'groom') this.groomT = this.t;
    }

    switch (this.state) {
      case 'track':
        this.targetYaw = Math.abs(off) > 0.25 ? toYaw : this.yaw;
        this._pose('ready');
        break;
      case 'stalk': {
        // Creep in slowly, swaying; stop to turn if it's off to the side.
        this.targetYaw = toYaw;
        this._pose('ready');
        if (Math.abs(off) < 0.35 && dist > Lb * 0.35) this.wantSpeed = Lb * 0.22;
        break;
      }
      case 'threat':
        this.targetYaw = toYaw;
        this._pose('threat', 14);
        break;
      case 'flee':
        this.targetYaw = toYaw + Math.PI;
        this._pose('rest');
        if (Math.abs(angDiff(this.yaw, this.targetYaw)) < 0.6) this.wantSpeed = Lb * 1.2;
        look = null;
        break;
      case 'wander': {
        // Searching for food: walk, and turn when something's in the way. Turns are decided by where
        // it is (the same spot always gives the same choice), not by dice.
        this._pose('rest');
        if (this.blocked > 0.2) {
          this.targetYaw = this.yaw + (hash3(Math.floor(this.pos.x * 50), Math.floor(this.pos.z * 50), 7) > 0.5 ? 1.4 : -1.4);
          this.blocked = 0;
        } else if (Math.floor(this.t / 6) !== this._wanderSeg) {
          this._wanderSeg = Math.floor(this.t / 6);
          this.targetYaw = this.yaw + (hash3(Math.floor(this.pos.x * 30), Math.floor(this.pos.z * 30), this._wanderSeg) - 0.5) * 1.6;
        }
        if (Math.abs(angDiff(this.yaw, this.targetYaw)) < 0.5) this.wantSpeed = Lb * 0.5;
        break;
      }
      case 'groom':
        this._pose('groom', 6);
        look = null;
        break;
      default:
        this._pose('rest');
    }
    this.lookAt = look ? this._look.copy(look) : null;
    this.lunge = damp(this.lunge, 0, 8, dt);
  }

  _pose(name, k = 10) {
    this.poseName = name;
    this.foreK = k;
  }

  // Where the front legs attach (world).
  _shoulder(out) {
    const a = this.J.fore[0].base.getWorldPosition(out);
    const b = this.J.fore[1].base.getWorldPosition(_v3);
    return a.add(b).multiplyScalar(0.5);
  }

  _strike(dt, pl, chestIn) {
    const chest = this._chest.copy(chestIn); // own copy: shared temp vectors get reused below
    this.lookAt = this._look.copy(chest);
    this.wantSpeed = 0;
    if (this.stateT === 0 || !this.strikeAim) {
      // Aim: the legs shoot out toward where you are (forward and down to the ground if needed).
      const sh = this._shoulder(_v2);
      const local = this.model.worldToLocal(_v.copy(chest));
      const shL = this.model.worldToLocal(sh.clone());
      const fwd = -(local.z - shL.z), drop = shL.y - local.y;
      const aim = clamp(Math.atan2(fwd, drop), 0.2, 2.2);
      this.strikeAim = { coxa: aim, fem: aim + 0.04, tib: aim + 0.08, tar: aim + 0.3, spread: 0.04 };
    }
    if (this.stateT < 0.055) {
      // Out: about 1/20 of a second.
      this._pose('strikeAim', 140);
      this.lunge = Math.min(1, this.lunge + dt * 30);
    } else if (!this.strikeHit) {
      this.strikeHit = true;
      // Did the claws close on you? You're caught if you're still within the reach of its legs
      // (you might have moved in that 1/20 of a second) and in front of it.
      const sh = this._shoulder(_v2);
      const d = sh.distanceTo(chest);
      const toYaw = Math.atan2(-(chest.x - this.pos.x), -(chest.z - this.pos.z));
      const front = Math.abs(angDiff(this.yaw, toYaw)) < 0.6;
      if (!pl.dead && !pl.heldBy && front && d < FORE_REACH * this.scale + this.size * 0.06 + pl.radius * 1.5 && pl.height < this.size * 1.1) {
        this.prey = pl;
        pl.grabbed(this);
        this.struggle = 0;
        this.biteT = 0.6;
        this.heldAt = pl.height;
        this._set('eat');
        bus.emit('toast', 'A praying mantis caught you! Spam SPACE to struggle, or grow / shrink to get free');
        return;
      }
      this._pose('hold', 60);
    } else if (this.stateT > 0.35) {
      // Missed: back to waiting (it takes a moment before it can strike again).
      this.strikeCooldown = 1.2;
      this._set('track');
    }
  }

  // The spot between the closed claws (where femur and tibia of both front legs close) (world).
  _grabPoint(out) {
    const a = this.J.fore[0].tib.getWorldPosition(out);
    const b = this.J.fore[1].tib.getWorldPosition(_v3);
    a.add(b).multiplyScalar(0.5);
    // A little way down the folded tibia, inside the trap.
    return a.addScaledVector(UP, -this.size * 0.035);
  }

  _eat(dt, pl) {
    this._pose('hold', 20);
    this.wantSpeed = 0;
    if (!this.prey || this.prey.heldBy !== this) {
      this.prey = null;
      this._set('groom');
      this.groomT = this.t;
      return;
    }
    // Hold you in front of its mouth.
    const g = this._grabPoint(_v2);
    pl.holdAt(g);
    this.lookAt = this._look.copy(g);
    // Getting free: struggling (you're strong for your size), growing too big to hold, shrinking small
    // enough to slip through the spines, or shrinking the mantis.
    if (!pl.dead) {
      const strength = Math.min(2.2, Math.sqrt(pl.height / this.size) * 3.2);
      if (input.pressed('jump') || input.pressed('interact')) this.struggle += 0.11 * Math.max(0.12, strength);
      this.struggle = Math.max(0, this.struggle - dt * 0.22);
      pl.struggle = this.struggle;
      let why = null;
      if (this.struggle >= 1) why = 'You struggled free!';
      else if (pl.height > this.size * 0.9) why = 'You got too big for it to hold';
      else if (pl.height < this.heldAt * 0.3) why = 'You got so small you slipped through its spines';
      if (why) {
        this._release(pl, why);
        return;
      }
    }
    // Chewing: a bite about every second. Damage depends on how big it is compared to you.
    this.biteT -= dt;
    const chew = Math.sin(this.t * 22);
    for (const m of this.J.mandibles) m.g.rotation.z = m.s * (0.15 + chew * 0.25);
    if (this.biteT <= 0) {
      this.biteT = 1.05;
      if (!pl.dead) {
        const dmg = Math.round(7 * clamp(this.size / pl.height / 6, 0.6, 3));
        const dir = _v3.set(-Math.sin(this.yaw), 0.4, -Math.cos(this.yaw));
        pl.hurt(dmg, { cause: 'Eaten alive by a praying mantis', at: g.clone(), dir, gore: true });
        this.hunger = Math.max(0, this.hunger - 0.08);
      } else {
        // Finishing the meal.
        this.hunger = Math.max(0, this.hunger - 0.12);
        if (this.stateT > 8) this._release(pl, null);
      }
    }
  }

  _release(pl, why) {
    if (pl.heldBy === this) pl.released(this, _v.set(-Math.sin(this.yaw), 0.6, -Math.cos(this.yaw)).multiplyScalar(Math.sqrt(pl.height) * 0.8));
    if (why) bus.emit('toast', why);
    this.prey = null;
    this.struggle = 0;
    pl.struggle = 0;
    this.strikeCooldown = 2.5;
    this._set(why ? 'track' : 'groom');
    this.groomT = this.t;
  }

  animate(dt) {
    const J = this.J;
    const s = this.state;
    // Front legs.
    const target = this.poseName === 'strikeAim' && this.strikeAim ? this.strikeAim : POSES[this.poseName] || POSES.rest;
    for (const f of J.fore) {
      const p = f.pose;
      const k = this.foreK;
      // Grooming: one leg at a time comes up to the mouth to be cleaned.
      const groomSide = s === 'groom' && Math.floor(this.stateT / 2.5) % 2 === (f.s > 0 ? 0 : 1);
      const t = s === 'groom' && !groomSide ? POSES.rest : target;
      for (const key of ['coxa', 'fem', 'tib', 'tar', 'spread']) p[key] = damp(p[key], t[key], k, dt);
    }
    applyForePoses(J);
    // Swaying like a leaf in the wind while waiting or creeping (slow and steady).
    const swayAmt = s === 'stalk' ? 1 : s === 'ambush' || s === 'track' ? 0.55 : 0;
    this.swayK = damp(this.swayK || 0, swayAmt, 3, dt);
    const sw = Math.sin(this.t * 2 * Math.PI * 0.9) * this.swayK;
    // Threat display: rear up, wings out, abdomen curled up.
    this.threatAmt = damp(this.threatAmt, s === 'threat' ? 1 : 0, 9, dt);
    const th = this.threatAmt;
    J.thorax.position.set(sw * 0.0011, RIDE + th * 0.004, -this.lunge * 0.004);
    J.thorax.rotation.set(-th * 0.25, 0, sw * 0.09);
    J.pro.rotation.x = PRO_PITCH + th * 0.35 + (s === 'groom' ? -0.15 : 0);
    J.abdomen.rotation.x = -th * 0.55;
    for (const w of J.wings) {
      w.fore.rotation.set(-th * 0.7, 0, w.s * th * 0.9);
      w.hind.rotation.set(-th * 0.6, w.s * th * 0.2, w.s * th * 0.6);
      w.hindMesh.scale.x = w.s * (0.18 + th * 0.82);
    }
    // Head: quick jerky turns toward what it's watching (mantis heads move in little snaps).
    const H = this.head;
    if (this.lookAt) {
      const local = this.model.worldToLocal(_v.copy(this.lookAt));
      const pivot = _v2.set(0, RIDE + 0.016, -0.023);
      const d = local.sub(pivot);
      const yaw = clamp(Math.atan2(-d.x, -d.z), -1.55, 1.55);
      const pitch = clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.9, 0.7);
      if (Math.abs(yaw - H.wantYaw) > 0.07 || Math.abs(pitch - H.wantPitch) > 0.07) {
        H.wantYaw = yaw;
        H.wantPitch = pitch;
      }
    } else {
      H.wantYaw = 0;
      H.wantPitch = s === 'groom' ? -0.5 : 0;
    }
    H.yaw = damp(H.yaw, H.wantYaw, 28, dt);
    H.pitch = damp(H.pitch, H.wantPitch, 28, dt);
    J.headYaw.rotation.y = H.yaw;
    J.headPitch.rotation.x = -PRO_PITCH - 0.35 + H.pitch - th * 0.35 + (s === 'eat' ? Math.sin(this.t * 7) * 0.12 - 0.25 : 0);
    // Antennae twitch a little (they're sensing air and smells).
    for (let i = 0; i < J.antennae.length; i++) J.antennae[i].rotation.set(Math.sin(this.t * 1.7 + i) * 0.06, 0, Math.sin(this.t * 1.3 + i * 2) * 0.05);
    // The eyes' black pseudopupil: always on the side of the eye facing the camera.
    const cam = this.game.camera.position;
    for (const e of J.eyes) {
      e.eye.updateWorldMatrix(true, false);
      const c = e.eye.getWorldPosition(_v);
      const dirW = _v2.copy(cam).sub(c).normalize();
      // Into the head's space.
      const inv = _m.copy(J.headPitch.matrixWorld).invert();
      const pl = _v3.copy(c).addScaledVector(dirW, 0.001 * this.scale).applyMatrix4(inv);
      const cl = c.applyMatrix4(inv);
      const dirL = pl.sub(cl).normalize();
      e.pupil.position.copy(e.eye.position).addScaledVector(dirL, e.r * 1.06);
      e.pupil.lookAt(_v.copy(e.pupil.position).add(dirL).applyMatrix4(J.headPitch.matrixWorld));
    }
  }

  onResize() {
    if (this.prey && this.size < this.prey.height * 1.1) this._release(this.prey, 'The mantis got too small to hold you');
  }
}

CATALOG.mantis = MANTIS_DEF;
