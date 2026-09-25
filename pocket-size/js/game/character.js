// Procedural humanoid (the player) with a joint hierarchy and a blended, physically-flavoured
// animation system: idle breathing, walk/run cycles, jumps, climbing, carrying, attacks, swimming...
import * as THREE from 'three';
import * as TX from '../core/textures.js';

const damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));

function capsule(r, len, mat, seg = 12) {
  const g = new THREE.CapsuleGeometry(r, len, 6, seg);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function sphere(r, mat, ws = 20, hs = 14) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// A limb segment hanging down from its joint: returns { joint, mesh }.
function segment(parent, x, y, z, r, len, mat, r2) {
  const joint = new THREE.Group();
  joint.position.set(x, y, z);
  parent.add(joint);
  let mesh;
  if (r2 !== undefined) {
    const g = new THREE.CylinderGeometry(r, r2, len, 14, 1);
    mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    const capTop = sphere(r, mat, 14, 10); capTop.position.y = len / 2; mesh.add(capTop);
    const capBot = sphere(r2, mat, 14, 10); capBot.position.y = -len / 2; mesh.add(capBot);
  } else {
    mesh = capsule(r, len, mat);
  }
  mesh.position.y = -len / 2;
  joint.add(mesh);
  return { joint, mesh };
}

export function createCharacterMaterials() {
  const skinTex = TX.skin({ color: 0xd9a37f });
  const shirt = TX.fabric({ color: 0x6d7b8a, color2: 0x5a6674, pattern: 'plain', weave: 110, seed: 31 });
  const pj = TX.fabric({ color: 0x2f4f86, color2: 0x1c2c4d, pattern: 'plaid', weave: 90, seed: 32 });
  return {
    skin: new THREE.MeshPhysicalMaterial({ ...skinTex, roughness: 0.6, sheen: 0.3, sheenColor: new THREE.Color(0xffc9b0), sheenRoughness: 0.5, normalScale: new THREE.Vector2(0.3, 0.3) }),
    shirt: new THREE.MeshPhysicalMaterial({ ...shirt, roughness: 0.95, sheen: 0.6, sheenColor: new THREE.Color(0x9fb0c0), sheenRoughness: 0.8 }),
    pants: new THREE.MeshPhysicalMaterial({ ...pj, roughness: 0.9, sheen: 0.7, sheenColor: new THREE.Color(0x7090d0), sheenRoughness: 0.8 }),
    sock: new THREE.MeshPhysicalMaterial({ color: 0xe9e6df, roughness: 1, sheen: 0.8, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.9 }),
    hair: new THREE.MeshPhysicalMaterial({ color: 0x3b2718, roughness: 0.55, sheen: 1, sheenColor: new THREE.Color(0x8a6040), sheenRoughness: 0.35 }),
    eyeWhite: new THREE.MeshPhysicalMaterial({ color: 0xf4f1ea, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }),
    iris: new THREE.MeshPhysicalMaterial({ color: 0x4a2f1c, roughness: 0.2, clearcoat: 1 }),
    pupil: new THREE.MeshBasicMaterial({ color: 0x050505 }),
    brow: new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.9 }),
    lip: new THREE.MeshStandardMaterial({ color: 0xb87466, roughness: 0.5 }),
  };
}

export class CharacterRig {
  constructor(mats = createCharacterMaterials()) {
    this.mats = mats;
    this.root = new THREE.Group();       // placed at the feet, rotated to face direction
    this.body = new THREE.Group();       // offset for lying down / leaning
    this.root.add(this.body);
    this.j = {};
    this.cur = {};
    this.phase = 0;
    this.blinkT = 2;
    this.actionT = 0;
    this.action = null;
    this.build();
  }

  build() {
    const M = this.mats;
    const j = this.j;
    const hips = new THREE.Group(); hips.position.y = 0.93; this.body.add(hips); j.hips = hips;

    // Pelvis / waistband
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), M.pants);
    pelvis.scale.set(1.05, 0.72, 0.72); pelvis.position.y = 0.02; pelvis.castShadow = true; hips.add(pelvis);

    // Spine -> chest (torso built from a lathe for a natural silhouette)
    const spine = new THREE.Group(); spine.position.y = 0.06; hips.add(spine); j.spine = spine;
    const prof = [[0.0, 0], [0.16, 0.0], [0.165, 0.08], [0.155, 0.18], [0.17, 0.3], [0.19, 0.4], [0.18, 0.46], [0.12, 0.5], [0.06, 0.52], [0.0, 0.52]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    const torsoG = new THREE.LatheGeometry(prof, 24);
    const torso = new THREE.Mesh(torsoG, M.shirt);
    torso.scale.set(1, 1, 0.66); torso.castShadow = true; torso.receiveShadow = true;
    spine.add(torso);
    j.torso = torso;
    const chest = new THREE.Group(); chest.position.y = 0.44; spine.add(chest); j.chest = chest;

    // Neck & head
    const neck = new THREE.Group(); neck.position.y = 0.05; chest.add(neck); j.neck = neck;
    const neckM = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.06, 0.12, 12), M.skin);
    neckM.position.y = 0.04; neckM.castShadow = true; neck.add(neckM);
    const head = new THREE.Group(); head.position.y = 0.11; neck.add(head); j.head = head;
    const skull = sphere(0.108, M.skin, 28, 20); skull.scale.set(0.92, 1.1, 1.0); skull.position.set(0, 0.1, 0); head.add(skull);
    const jaw = sphere(0.082, M.skin, 20, 14); jaw.scale.set(0.95, 0.8, 1.0); jaw.position.set(0, 0.035, 0.03); head.add(jaw);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.045, 10), M.skin);
    nose.rotation.x = Math.PI / 2 + 0.3; nose.position.set(0, 0.085, 0.108); head.add(nose);
    const earG = new THREE.SphereGeometry(0.026, 12, 10);
    [-1, 1].forEach((s) => { const e = new THREE.Mesh(earG, M.skin); e.scale.set(0.5, 1, 0.8); e.position.set(0.1 * s, 0.1, -0.005); head.add(e); });
    // Eyes
    j.eyes = [];
    [-1, 1].forEach((s) => {
      const eye = new THREE.Group(); eye.position.set(0.037 * s, 0.115, 0.086); head.add(eye);
      const w = sphere(0.019, M.eyeWhite, 14, 10); eye.add(w);
      const ir = new THREE.Mesh(new THREE.CircleGeometry(0.0095, 16), M.iris); ir.position.z = 0.0185; eye.add(ir);
      const pu = new THREE.Mesh(new THREE.CircleGeometry(0.0045, 12), M.pupil); pu.position.z = 0.0187; eye.add(pu);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.007, 0.01), M.brow);
      brow.position.set(0.037 * s, 0.145, 0.1); brow.rotation.z = -0.12 * s; head.add(brow);
      j.eyes.push(eye);
    });
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 16, Math.PI), M.lip);
    mouth.rotation.z = Math.PI; mouth.position.set(0, 0.052, 0.098); head.add(mouth);
    j.mouth = mouth;
    // Messy hair: a cap plus tufts
    const hair = new THREE.Group(); head.add(hair);
    const cap = sphere(0.116, M.hair, 24, 16); cap.scale.set(0.95, 1.02, 1.05); cap.position.set(0, 0.125, -0.012); hair.add(cap);
    const capCut = new THREE.Mesh(new THREE.SphereGeometry(0.117, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), M.hair);
    capCut.position.set(0, 0.13, 0.02); capCut.rotation.x = -0.35; hair.add(capCut);
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2, b = rnd() * 0.9;
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.03 + rnd() * 0.02, 0.07 + rnd() * 0.05, 6), M.hair);
      const dir = new THREE.Vector3(Math.cos(a) * Math.sin(b), Math.cos(b), Math.sin(a) * Math.sin(b) - 0.2).normalize();
      t.position.copy(dir.clone().multiplyScalar(0.11)).add(new THREE.Vector3(0, 0.13, -0.01));
      t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.8, 0.3, -0.4)).normalize());
      t.castShadow = true;
      hair.add(t);
    }
    // front fringe
    for (let i = 0; i < 6; i++) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.07, 6), M.hair);
      t.position.set(-0.06 + i * 0.024, 0.19, 0.075);
      t.rotation.set(2.3 + (i % 2) * 0.2, 0, (i - 2.5) * 0.15);
      hair.add(t);
    }

    // Arms (short sleeves over upper arm)
    ['L', 'R'].forEach((side, idx) => {
      const s = side === 'L' ? 1 : -1;
      const shoulder = new THREE.Group(); shoulder.position.set(0.2 * s, 0.0, 0); chest.add(shoulder); j['shoulder' + side] = shoulder;
      const upper = segment(shoulder, 0, 0, 0, 0.055, 0.22, M.skin, 0.045);
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.068, 0.15, 14, 1, true), M.shirt);
      sleeve.position.y = -0.03; sleeve.castShadow = true; upper.joint.add(sleeve);
      const shoulderBall = sphere(0.075, M.shirt, 14, 10); upper.joint.add(shoulderBall);
      j['upperArm' + side] = upper.joint;
      const elbow = segment(upper.joint, 0, -0.28, 0, 0.043, 0.2, M.skin, 0.035);
      j['forearm' + side] = elbow.joint;
      const hand = new THREE.Group(); hand.position.y = -0.25; elbow.joint.add(hand); j['hand' + side] = hand;
      const palm = sphere(0.045, M.skin, 14, 10); palm.scale.set(0.8, 1.15, 0.5); palm.position.y = -0.04; hand.add(palm);
      const thumb = capsule(0.013, 0.03, M.skin, 8); thumb.position.set(-0.03 * s, -0.035, 0.02); thumb.rotation.z = 0.6 * s; hand.add(thumb);
      const grip = new THREE.Group(); grip.position.set(0, -0.07, 0.02); hand.add(grip); j['grip' + side] = grip;
    });

    // Legs (pajama pants) and socked feet
    ['L', 'R'].forEach((side) => {
      const s = side === 'L' ? 1 : -1;
      const thigh = segment(hips, 0.095 * s, -0.02, 0, 0.085, 0.4, M.pants, 0.07);
      j['thigh' + side] = thigh.joint;
      const shin = segment(thigh.joint, 0, -0.44, 0, 0.066, 0.38, M.pants, 0.058);
      j['shin' + side] = shin.joint;
      const foot = new THREE.Group(); foot.position.y = -0.43; shin.joint.add(foot); j['foot' + side] = foot;
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.13, 4, 10), M.sock);
      f.rotation.x = Math.PI / 2; f.scale.set(1, 1, 0.7); f.position.set(0, -0.025, 0.05); f.castShadow = true; foot.add(f);
    });

    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }

  // Attach / detach a held mesh in the right hand.
  hold(mesh, hand = 'R') {
    const g = this.j['grip' + hand];
    while (g.children.length) g.remove(g.children[0]);
    if (mesh) g.add(mesh);
  }

  trigger(action, duration = 0.45) { this.action = action; this.actionT = 0; this.actionDur = duration; }

  // state: { speed, maxSpeed, grounded, vy, carry, climb, climbRate, glide, swim, dead, sleep, crouch, turn, lookPitch, hurt }
  update(dt, st) {
    const j = this.j;
    const T = {}; // target rotations
    const run = Math.min(1, st.speed / Math.max(0.01, st.runSpeed || 10));
    const moving = st.speed > 0.2;
    const stride = 1.0 + run * 0.9;
    this.phase += (st.speed / stride) * dt * Math.PI;
    const ph = this.phase;
    const t = performance.now() / 1000;
    const breathe = Math.sin(t * 1.6);

    // defaults (idle)
    let hipY = 0.93, hipYaw = 0, hipRoll = 0;
    T.spineX = 0.03 + breathe * 0.01; T.chestX = 0; T.neckX = 0; T.headX = -(st.lookPitch || 0) * 0.35; T.headY = 0;
    T.thighLX = 0; T.thighRX = 0; T.shinLX = 0.05; T.shinRX = 0.05; T.footLX = 0; T.footRX = 0;
    T.thighLZ = 0.03; T.thighRZ = -0.03;
    T.shLX = 0.05 + Math.sin(t * 0.9) * 0.02; T.shRX = 0.05 - Math.sin(t * 0.9) * 0.02;
    T.shLZ = 0.12; T.shRZ = -0.12; T.shLY = 0; T.shRY = 0;
    T.elLX = -0.18; T.elRX = -0.18;
    let bodyRotX = 0, bodyY = 0, bodyZ = 0;

    if (st.sleep) {
      bodyRotX = -Math.PI / 2; bodyY = 0.25; bodyZ = -0.9;
      T.shLZ = 0.25; T.shRZ = -0.25; T.headY = 0.3; T.spineX = breathe * 0.02;
    } else if (st.dead) {
      bodyRotX = -Math.PI / 2 + 0.1; bodyY = 0.22; bodyZ = -0.9;
      T.shLZ = 1.2; T.shRZ = -1.0; T.thighLZ = 0.3; T.thighRZ = -0.2; T.headY = 0.6; T.shinLX = 0.6;
    } else if (st.climb) {
      const c = this.phase * 0.0 + (this.climbPhase = (this.climbPhase || 0) + dt * (st.climbRate || 0) * 3.2);
      const a = Math.sin(c), b = Math.cos(c);
      T.shLX = -2.7 + a * 0.35; T.shRX = -2.7 - a * 0.35; T.elLX = -0.6 - Math.max(0, b) * 0.6; T.elRX = -0.6 - Math.max(0, -b) * 0.6;
      T.shLZ = 0.15; T.shRZ = -0.15;
      T.thighLX = -0.9 - a * 0.5; T.thighRX = -0.9 + a * 0.5; T.shinLX = 1.2 + a * 0.3; T.shinRX = 1.2 - a * 0.3;
      T.spineX = 0.15; T.headX = -0.5;
      bodyZ = -0.12;
    } else if (st.glide) {
      T.thighLX = -1.3; T.thighRX = -1.3; T.shinLX = 2.2; T.shinRX = 2.2; T.footLX = -0.5; T.footRX = -0.5;
      hipY = 0.5; T.spineX = 0.4; T.shLX = -0.9; T.shRX = -0.9; T.elLX = -0.8; T.elRX = -0.8; T.shLZ = 0.4; T.shRZ = -0.4;
      T.headX = -0.4;
    } else if (st.swim) {
      const s = Math.sin(t * 5), c = Math.cos(t * 2.5);
      bodyRotX = 0.9 * Math.min(1, st.speed / 4) ; bodyY = 0.8;
      T.thighLX = s * 0.45; T.thighRX = -s * 0.45; T.shinLX = 0.4 + Math.max(0, s) * 0.4; T.shinRX = 0.4 + Math.max(0, -s) * 0.4;
      T.shLX = -1.6 + c * 0.9; T.shRX = -1.6 + c * 0.9; T.shLZ = 0.6 + c * 0.6; T.shRZ = -0.6 - c * 0.6; T.elLX = -0.4; T.elRX = -0.4;
      T.headX = -0.6 * Math.min(1, st.speed / 4);
    } else if (!st.grounded) {
      const up = st.vy > 0;
      T.thighLX = up ? -0.9 : -0.35; T.thighRX = up ? -0.2 : -0.6; T.shinLX = up ? 1.3 : 0.6; T.shinRX = up ? 0.4 : 0.9;
      T.shLX = up ? -0.6 : -0.3; T.shRX = up ? -0.6 : -0.3; T.shLZ = up ? 0.4 : 0.9 + Math.sin(t * 9) * 0.15; T.shRZ = up ? -0.4 : -0.9 - Math.sin(t * 9) * 0.15;
      T.elLX = -0.5; T.elRX = -0.5; T.spineX = up ? 0.1 : -0.05;
    } else if (moving) {
      const A = 0.45 + run * 0.45;
      const sL = Math.sin(ph), sR = Math.sin(ph + Math.PI);
      const cL = Math.cos(ph), cR = Math.cos(ph + Math.PI);
      T.thighLX = -sL * A; T.thighRX = -sR * A;
      T.shinLX = 0.1 + Math.max(0, cL) * (0.7 + run * 0.8); T.shinRX = 0.1 + Math.max(0, cR) * (0.7 + run * 0.8);
      T.footLX = Math.max(0, -sL) * 0.3; T.footRX = Math.max(0, -sR) * 0.3;
      T.shLX = sL * A * 0.9; T.shRX = sR * A * 0.9;
      T.elLX = -0.25 - run * 0.9; T.elRX = -0.25 - run * 0.9;
      T.shLZ = 0.08 + run * 0.05; T.shRZ = -0.08 - run * 0.05;
      T.spineX = 0.06 + run * 0.22;
      T.headX = -0.03 - run * 0.1 - (st.lookPitch || 0) * 0.25;
      hipY = 0.93 - Math.abs(Math.cos(ph)) * (0.025 + run * 0.045) + 0.01;
      hipYaw = sL * 0.12 * A; hipRoll = Math.cos(ph) * 0.04;
    }
    if (st.crouch && st.grounded && !st.climb) {
      hipY -= 0.3; T.thighLX -= 0.9; T.thighRX -= 0.9; T.shinLX += 1.4; T.shinRX += 1.4; T.footLX -= 0.4; T.footRX -= 0.4; T.spineX += 0.3;
    }
    if (st.carry && !st.climb && !st.dead) {
      T.shLX = -2.9; T.shRX = -2.9; T.elLX = -0.35; T.elRX = -0.35; T.shLZ = 0.35; T.shRZ = -0.35; T.spineX = -0.05; T.headX = 0.1;
    }
    if (st.hurt > 0) { T.spineX -= st.hurt * 0.5; T.headX -= st.hurt * 0.4; }

    // One-shot actions layered on top (right arm).
    if (this.action) {
      this.actionT += dt / this.actionDur;
      const k = this.actionT;
      if (k >= 1) this.action = null;
      else if (this.action === 'swing' || this.action === 'chop') {
        const wind = k < 0.35 ? k / 0.35 : 1 - (k - 0.35) / 0.65;
        const strike = k < 0.35 ? 0 : Math.sin(Math.min(1, (k - 0.35) / 0.3) * Math.PI / 2);
        T.shRX = -2.4 * wind + 0.6 * strike * (1 - wind); T.shRZ = -0.3 - 0.4 * wind; T.elRX = -1.2 * wind - 0.1;
        T.spineX += 0.15 * strike; hipYaw += -0.4 * wind + 0.5 * strike * (1 - k);
      } else if (this.action === 'punch') {
        const e = Math.sin(k * Math.PI);
        T.shRX = -1.5 * e; T.elRX = -1.6 * (1 - e) - 0.05; hipYaw -= 0.5 * e; T.shLX = -0.6 * e; T.elLX = -1.8 * e;
      } else if (this.action === 'pickup') {
        const e = Math.sin(k * Math.PI);
        T.spineX += 0.9 * e; T.shRX = -0.9 * e; T.shLX = -0.9 * e; hipY -= 0.2 * e; T.thighLX -= 0.5 * e; T.thighRX -= 0.5 * e; T.shinLX += 0.8 * e; T.shinRX += 0.8 * e;
      } else if (this.action === 'throw') {
        const e = Math.sin(k * Math.PI);
        T.shRX = -2.6 + k * 3.2; T.elRX = -0.3; T.spineX += 0.2 * e;
      } else if (this.action === 'wave') {
        T.shRZ = -2.6; T.elRX = -0.3; T.shRY = Math.sin(k * 20) * 0.3;
      } else if (this.action === 'struggle') {
        const e = Math.sin(k * Math.PI * 6);
        T.spineX += 0.5 + e * 0.1; T.shLX = -1.2 + e * 0.2; T.shRX = -1.2 - e * 0.2; hipY -= 0.25; T.thighLX -= 0.6; T.thighRX -= 0.3; T.shinLX += 0.9; T.shinRX += 0.6;
      }
    }

    // Blinking
    this.blinkT -= dt;
    let eyeS = 1;
    if (this.blinkT < 0) { eyeS = 0.1; if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 4; }
    if (st.sleep || st.dead) eyeS = 0.08;
    j.eyes.forEach((e) => { e.scale.y = damp(e.scale.y, eyeS, 40, dt); });

    // Apply with damping for smooth transitions between states.
    const K = st.dead ? 6 : 14;
    const c = this.cur;
    const ap = (key, target, obj, axis) => { c[key] = damp(c[key] ?? target, target, K, dt); obj.rotation[axis] = c[key]; };
    ap('spineX', T.spineX, j.spine, 'x');
    ap('headX', T.headX, j.head, 'x'); ap('headY', T.headY, j.head, 'y');
    ap('thighLX', T.thighLX, j.thighL, 'x'); ap('thighRX', T.thighRX, j.thighR, 'x');
    ap('thighLZ', T.thighLZ, j.thighL, 'z'); ap('thighRZ', T.thighRZ, j.thighR, 'z');
    ap('shinLX', T.shinLX, j.shinL, 'x'); ap('shinRX', T.shinRX, j.shinR, 'x');
    ap('footLX', T.footLX, j.footL, 'x'); ap('footRX', T.footRX, j.footR, 'x');
    ap('shLX', T.shLX, j.shoulderL, 'x'); ap('shRX', T.shRX, j.shoulderR, 'x');
    ap('shLZ', T.shLZ, j.shoulderL, 'z'); ap('shRZ', T.shRZ, j.shoulderR, 'z');
    ap('shRY', T.shRY, j.shoulderR, 'y');
    ap('elLX', T.elLX, j.forearmL, 'x'); ap('elRX', T.elRX, j.forearmR, 'x');
    c.hipY = damp(c.hipY ?? hipY, hipY, 16, dt); j.hips.position.y = c.hipY;
    c.hipYaw = damp(c.hipYaw ?? 0, hipYaw, 12, dt); j.hips.rotation.y = c.hipYaw; j.chest.rotation.y = -c.hipYaw * 1.6;
    c.hipRoll = damp(c.hipRoll ?? 0, hipRoll, 12, dt); j.hips.rotation.z = c.hipRoll;
    c.bodyRotX = damp(c.bodyRotX ?? 0, bodyRotX, st.dead ? 5 : 8, dt); this.body.rotation.x = c.bodyRotX;
    c.bodyY = damp(c.bodyY ?? 0, bodyY, 8, dt); this.body.position.y = c.bodyY;
    c.bodyZ = damp(c.bodyZ ?? 0, bodyZ, 8, dt); this.body.position.z = c.bodyZ;
    // lean into turns
    c.lean = damp(c.lean ?? 0, -(st.turn || 0) * 0.06 * Math.min(1, st.speed / 5), 6, dt);
    this.body.rotation.z = c.lean;
    // breathing
    j.chest.scale.set(1 + breathe * 0.012, 1, 1 + breathe * 0.02);
  }
}
