// Your character (seen in third-person) + your first-person arms with the sci-fi watch.
// Fully customizable: body, age, skin, face, eyes, hair, clothes, height and build.
import * as THREE from 'three';
import { HumanModel } from '../human/model.js';

export const LOOK_DEFAULT = {
  skin: '#c68a64', eyes: '#4a3121', hair: '#2b1d14', hairStyle: 'short',
  top: '#2f3b52', topStyle: 'hoodie', pants: '#2b2f36', pantsStyle: 'jeans', shoes: '#e9e9e9',
  height: 1.0, build: 1.0, face: 'round', gender: 0.5, age: 14, seed: 7,
};
export const SKIN_TONES = ['#f3d2b8', '#e8b892', '#c68a64', '#a0663f', '#7a4a2a', '#4f2f1c'];
export const HAIR_STYLES = ['short', 'buzz', 'curly', 'long', 'ponytail', 'bald'];
export const BODY_TYPES = { boy: 1, girl: 0, 'in-between': 0.5 };

function mat(color, rough = 0.7, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra }); }

// your look -> a realistic human (see js/human)
export function humanLook(L) {
  return {
    gender: L.gender ?? 0.5, age: L.age ?? 14, skin: L.skin, eyes: L.eyes, hair: L.hair, hairStyle: L.hairStyle,
    top: L.top, topStyle: L.topStyle === 'shirt' ? 'tee' : L.topStyle, pants: L.pants, pantsStyle: L.pantsStyle || 'jeans',
    shoes: L.shoes, build: L.build, face: L.face, height: L.height, seed: L.seed ?? 7,
  };
}

// Your character in third person: a realistic human with the sci-fi watch on the left wrist.
export class Avatar {
  constructor(look = LOOK_DEFAULT) {
    this.look = { ...LOOK_DEFAULT, ...look };
    this.human = new HumanModel(humanLook(this.look));
    this.root = this.human.root;
    this.addWatch();
  }
  setLook(look) { this.look = { ...this.look, ...look }; this.human.setLook(humanLook(this.look)); this.addWatch(); }
  addWatch() {
    const h = this.human, b = h.sk.byName['lowerarm02.L'];
    const u = b.userData, axis = u.tail.clone().sub(u.head).normalize();
    const w = new THREE.Group();
    w.position.copy(u.tail).sub(u.head).addScaledVector(axis, -0.03);
    w.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.029, 0.022, 24, 1, true), mat('#15171c', 0.5, { side: THREE.DoubleSide }));
    w.add(band);
    // the face sits on the back of the wrist
    const dors = h.dorsal.L.clone().addScaledVector(axis, -h.dorsal.L.dot(axis)).normalize().applyQuaternion(w.quaternion.clone().invert());
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.018, 0.008, 6), mat('#0a1a24', 0.2, { emissive: 0x4ef2ff, emissiveIntensity: 0.6, metalness: 0.6 }));
    face.position.copy(dors).multiplyScalar(0.031); face.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dors);
    w.add(face); this.watchFace = face;
    b.add(w); this.watch = w;
  }
  animate(dt, speed, grounded, crouch) { this.human.animate(dt, speed, grounded, crouch); }
}

// First-person arms: your real (realistic) arms and hands. The left one lifts to show the watch
// while you shrink/grow; the right one comes up when you hold a tool.
const ARM_BONES = /^(upperarm02|lowerarm0[12]|wrist|metacarpal|finger)/;
export class ViewModel {
  constructor(look) {
    this.root = new THREE.Group();
    this.raise = 0; this.hold = 0;
    this.toolHold = new THREE.Group();
    this.root.add(this.toolHold);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    this.watchTex = new THREE.CanvasTexture(canvas); this.watchTex.colorSpace = THREE.SRGBColorSpace; this.watchCanvas = canvas;
    this.watchMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: this.watchTex, emissiveIntensity: 1.2 });
    this.setLook(look);
  }
  setLook(look) {
    if (this.human) this.human.dispose();
    const L = { ...LOOK_DEFAULT, ...look };
    const h = this.human = new HumanModel({ ...humanLook(L), detail: 'basic', shoes: 'none' });
    // only the arms: forearms, hands and sleeves (no head, body or legs in front of the camera)
    const bones = h.sk.skeleton.bones.map((b) => b.name);
    const keepTri = (geo) => {
      const idx = geo.index.array, si = geo.attributes.skinIndex.array, out = [];
      for (let i = 0; i < idx.length; i += 3) if ([0, 1, 2].every((k) => ARM_BONES.test(bones[si[idx[i + k] * 4]]))) out.push(idx[i], idx[i + 1], idx[i + 2]);
      geo.setIndex(out);
    };
    for (const m of h.parts) { keepTri(m.geometry); m.castShadow = false; m.frustumCulled = false; }
    h.eyes.forEach((e) => { e.visible = false; }); if (h.hair) h.hair.visible = false;
    // eyes at the camera, facing down -Z like the camera does
    const eyes = h.eyes[0].position.clone().add(h.eyes[1].position).multiplyScalar(0.5).add(h.sk.byName.head.userData.head);
    h.root.rotation.y = Math.PI;
    h.root.position.set(eyes.x, -eyes.y, eyes.z);
    this.root.add(h.root);
    // the watch on the left wrist, with its live screen
    const b = h.sk.byName['lowerarm02.L'], u = b.userData, axis = u.tail.clone().sub(u.head).normalize();
    const w = new THREE.Group();
    w.position.copy(u.tail).sub(u.head).addScaledVector(axis, -0.03);
    w.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
    w.add(new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.029, 0.024, 28, 1, true), mat('#15171c', 0.5, { side: THREE.DoubleSide })));
    const dors = h.dorsal.L.clone().addScaledVector(axis, -h.dorsal.L.dot(axis)).normalize().applyQuaternion(w.quaternion.clone().invert());
    const up = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dors);
    const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.021, 0.009, 6), mat('#3b4350', 0.3, { metalness: 0.9 }));
    bezel.position.copy(dors).multiplyScalar(0.031); bezel.quaternion.copy(up); w.add(bezel);
    const screen = new THREE.Mesh(new THREE.CircleGeometry(0.017, 6), this.watchMat);
    // text runs along the forearm toward the hand (3 o'clock = the hand), facing out of the wrist
    const uDir = new THREE.Vector3(0, 1, 0).addScaledVector(dors, -dors.y).normalize(), vDir = dors.clone().cross(uDir);
    screen.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(uDir, vDir, dors));
    screen.position.copy(dors).multiplyScalar(0.0358);
    w.add(screen); b.add(w);
    this.armDown = (() => { const a = h.sk.byName['upperarm01.L'].userData; const d = a.tail.clone().sub(a.head).normalize(); return Math.atan2(-d.y, Math.abs(d.x)); })();
  }
  // two-bone IK: put the wrist at `target` (skeleton space), elbow toward `pole`, then twist the
  // forearm so the back of the hand faces `face` (a point) or the direction `face` (a vector)
  ik(side, target, pole, face) {
    const B = this.human.sk.byName;
    const up = B['upperarm01.' + side], lo = B['lowerarm01.' + side], tw = B['lowerarm02.' + side], wr = B['wrist.' + side];
    const S = up.userData.head, E0 = lo.userData.head, W0 = wr.userData.head;
    const a = S.distanceTo(E0), b = E0.distanceTo(W0);
    const to = target.clone().sub(S); let d = to.length(); to.normalize();
    d = THREE.MathUtils.clamp(d, Math.abs(a - b) + 1e-4, a + b - 1e-4);
    const x = (a * a - b * b + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, a * a - x * x));
    const pp = pole.clone().addScaledVector(to, -pole.dot(to)).normalize();
    const E = S.clone().addScaledVector(to, x).addScaledVector(pp, hh), W = S.clone().addScaledVector(to, d);
    const u0 = E0.clone().sub(S).normalize(), f0 = W0.clone().sub(E0).normalize();
    const q1 = new THREE.Quaternion().setFromUnitVectors(u0, E.clone().sub(S).normalize());
    up.quaternion.copy(q1);
    const fl = W.clone().sub(E).normalize().applyQuaternion(q1.clone().invert());
    const q2 = new THREE.Quaternion().setFromUnitVectors(f0, fl);
    lo.quaternion.copy(q2);
    if (face) {
      // twist about the forearm so the back of the hand points the right way
      const q12 = q1.clone().multiply(q2);
      const dors = this.human.dorsal[side].clone().applyQuaternion(q12);
      const want = face.isVector3 && face.lengthSq() > 2 ? face.clone().sub(W) : face.clone();
      const axis = f0.clone().applyQuaternion(q12);
      const p1 = dors.addScaledVector(axis, -dors.dot(axis)).normalize(), p2 = want.addScaledVector(axis, -want.dot(axis)).normalize();
      const ang = Math.atan2(p1.clone().cross(p2).dot(axis), p1.dot(p2));
      tw.quaternion.setFromAxisAngle(f0, ang);
    }
  }
  drawWatch(text1, text2, color = '#4ef2ff') {
    const c = this.watchCanvas.getContext('2d');
    c.fillStyle = '#02060c'; c.fillRect(0, 0, 128, 128);
    c.fillStyle = color; c.textAlign = 'center'; c.font = 'bold 26px monospace'; c.fillText(text1, 64, 62);
    c.font = '14px monospace'; c.fillStyle = '#cfe'; c.fillText(text2, 64, 86);
    this.watchTex.needsUpdate = true;
  }
  update(dt, wantRaise, bob, t) {
    const h = this.human, B = h.sk.byName;
    const palm = this.palm, holding = this.toolHold.children.length > 0 || !!palm;
    this.raise += ((wantRaise ? 1 : 0) - this.raise) * Math.min(1, dt * 7);
    this.hold += ((holding ? 1 : 0) - this.hold) * Math.min(1, dt * 7);
    const r = this.raise, k = this.hold;
    for (const b of h.sk.skeleton.bones) b.quaternion.identity();
    // camera space -> skeleton space
    h.root.updateMatrix(); h.body.updateMatrix(); h.skelParent.updateMatrix();
    const toSkel = new THREE.Matrix4().multiplyMatrices(h.root.matrix, h.body.matrix).multiply(h.skelParent.matrix).invert();
    const eye = new THREE.Vector3().applyMatrix4(toSkel);
    const lerp3 = (a, b, x) => new THREE.Vector3().lerpVectors(new THREE.Vector3(...a), new THREE.Vector3(...b), x);
    const sway = new THREE.Vector3(Math.cos(bob * 0.5) * 0.004, Math.sin(bob) * 0.006, 0);
    // right wrist: out in front holding the tool, or hanging out of view; left wrist: the watch in front of your eyes
    if (palm) this.ik('R', lerp3([0.24, -0.8, 0.05], [palm.x + 0.02, palm.y - 0.035, palm.z + 0.07], k).add(sway).applyMatrix4(toSkel), new THREE.Vector3(-0.7, -1, -0.2), new THREE.Vector3(0, -1, 0));
    else this.ik('R', lerp3([0.24, -0.8, 0.05], [0.15, -0.17, -0.3], k).add(sway).applyMatrix4(toSkel), new THREE.Vector3(-0.7, -1, -0.2), new THREE.Vector3(-0.75, 0.65, 0.1));
    this.ik('L', lerp3([-0.24, -0.8, 0.05], [-0.04, -0.105, -0.27], r).applyMatrix4(toSkel), new THREE.Vector3(1, -0.45, -0.25), r > 0.01 ? eye : null);
    // fingers: wrapped around the tool / relaxed
    for (const b of h.sk.skeleton.bones) {
      const m = /^finger(\d)-(\d)\.([LR])$/.exec(b.name); if (!m) continue;
      const grip = m[3] === 'R' ? (palm ? 0.12 : 0.3 + k * 0.8) : 0.3;
      b.quaternion.setFromAxisAngle(b.userData.x, grip * h.rig.fingerSign[b.name] * (m[1] === '1' ? 0.5 : 1));
    }
    h.root.updateMatrixWorld(true);
    // the tool sits in the right palm
    const palmPos = new THREE.Vector3().setFromMatrixPosition(B['metacarpal2.R'].matrixWorld);
    this.root.worldToLocal(palmPos);
    this.toolHold.position.copy(palmPos).add(new THREE.Vector3(-0.01, 0.025, -0.03));
    this.toolHold.rotation.set(0.05, -0.12, 0);
    this.toolHold.visible = k > 0.5 && !palm;
    if ((this._scaleT = (this._scaleT || 0) - dt) <= 0) { this._scaleT = 0.5; h.updateScale(); }
    void t;
  }
}
