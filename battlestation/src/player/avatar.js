import * as THREE from 'three';
import { gltfRaw } from '../world/models.js';
import { tex } from '../world/materials.js';

// Your body: a MakeHuman character (CC0) with a full finger rig. Everything is posed in code:
// sitting, walking, lying in bed, two-bone arm IK, and every finger solved to touch a target.
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
const Y = new THREE.Vector3(0, 1, 0);

const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const TIP = { thumb: 0.026, index: 0.022, middle: 0.023, ring: 0.022, pinky: 0.019 };

export class Avatar {
  static async load(ctx) {
    const gltf = await gltfRaw('avatar.glb');
    const a = new Avatar(ctx, gltf);
    await a.setupMaterials();
    return a;
  }

  constructor(ctx, gltf) {
    this.ctx = ctx;
    this.root = gltf.scene;
    this.root.name = 'avatar';
    this.bones = {};
    this.meshes = {};
    this.root.traverse(o => {
      if (o.isBone) this.bones[o.name] = o;
      if (o.isMesh) { this.meshes[o.material.name.replace('Player.', '')] = o; o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true; }
    });
    this.rest = {};
    for (const [n, b] of Object.entries(this.bones)) this.rest[n] = { q: b.quaternion.clone(), p: b.position.clone() };
    this.root.updateMatrixWorld(true);
    this.restWorldQ = {};
    for (const [n, b] of Object.entries(this.bones)) this.restWorldQ[n] = b.getWorldQuaternion(new THREE.Quaternion());
    this.restPelvis = this.bones.pelvis.getWorldPosition(new THREE.Vector3());
    // eye position in head space
    const eyes = this.meshes['high-poly'];
    const eb = new THREE.Box3().setFromObject(eyes).getCenter(new THREE.Vector3());
    this.eyeLocal = this.bones.head.worldToLocal(eb.clone()).add(new THREE.Vector3(0, 0, 0.0)); // between the eyes
    this.eyeLocal.y += 0.0; // eye line
    // lengths
    this.len = {};
    for (const side of ['l', 'r']) {
      this.len['upper_' + side] = this.bones['lowerarm_' + side].position.length();
      this.len['lower_' + side] = this.bones['hand_' + side].position.length();
    }
    this.flexSign = {};
    this.headHidden = false;
    ctx.scene.add(this.root);
    this.computeHandFrames();
    this.outfit = { sleeves: 'long', top: 0x232428, pants: 'joggers', pantsColor: 0x5b5d61, shoes: true, skin: 'light', watch: true };
  }

  async setupMaterials() {
    const m = this.meshes;
    const body = m.body;
    const skinMap = body.material.map;
    const skin = new THREE.MeshPhysicalMaterial({ map: skinMap, roughness: 0.52, metalness: 0, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.85, 0.45, 0.35), specularIntensity: 0.45 });
    this.coverMask = { value: new THREE.Vector3(1, 0, 1) };
    skin.onBeforeCompile = (s) => {
      s.uniforms.coverMask = this.coverMask;
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 color;\nvarying float vCover;\nuniform vec3 coverMask;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCover = dot(color.rgb, coverMask);');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vCover;')
        .replace('void main() {', 'void main() {\nif (vCover > 0.5) discard;');
    };
    body.material = skin;
    this.skinMat = skin;
    // clothes: tintable top, jeans or joggers bottom
    const fleece = await tex('textures/knitted_fleece_nor_gl.webp', false).catch(() => null);
    const melange = await tex('textures/jogging_melange_Diffuse.webp', true).catch(() => null);
    for (const k of ['male_casualsuit02', 'male_casualsuit06']) {
      const old = m[k].material;
      const mat = new THREE.MeshStandardMaterial({ map: old.map, normalMap: old.normalMap, roughness: 0.92, metalness: 0 });
      const u = { topColor: { value: new THREE.Color(this.outfitDefault?.top ?? 0x232428) }, pantsColor: { value: new THREE.Color(0x5b5d61) }, joggers: { value: 1 }, melange: { value: melange }, detailN: { value: fleece } };
      mat.userData.u = u;
      const longSuit = k === 'male_casualsuit02';
      mat.onBeforeCompile = (s) => {
        Object.assign(s.uniforms, u);
        s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vSuitUv;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvSuitUv = uv;');
        s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
          varying vec2 vSuitUv; uniform vec3 topColor, pantsColor; uniform float joggers; uniform sampler2D melange;`)
          .replace('#include <map_fragment>', `#include <map_fragment>
          bool isTop = ${longSuit ? '(vSuitUv.y < 0.425 || vSuitUv.x > 0.73)' : '(vSuitUv.y < 0.42)'};
          if (isTop) diffuseColor.rgb *= topColor * 1.25;
          else if (joggers > 0.5) {
            float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
            vec3 mel = texture2D(melange, vSuitUv * 9.0).rgb;
            diffuseColor.rgb = pantsColor * mel * (0.75 + 0.5 * smoothstep(0.05, 0.6, lum));
          }`);
      };
      m[k].material = mat;
    }
    for (const k of ['eyebrow001', 'eyelashes01', 'short02']) {
      const mt = m[k].material;
      mt.transparent = false; mt.alphaTest = 0.4; mt.alphaToCoverage = true; mt.side = THREE.DoubleSide; mt.roughness = 0.7;
    }
    m['high-poly'].material.roughness = 0.12;
    this.applyOutfit();
    this.buildWatch();
  }

  applyOutfit(o = {}) {
    Object.assign(this.outfit, o);
    const f = this.outfit;
    const long = f.sleeves === 'long';
    this.meshes.male_casualsuit02.visible = long;
    this.meshes.male_casualsuit06.visible = !long;
    this.coverMask.value.set(long ? 1 : 0, long ? 0 : 1, f.shoes ? 1 : 0);
    this.meshes.shoes06.visible = f.shoes;
    for (const k of ['male_casualsuit02', 'male_casualsuit06']) {
      const u = this.meshes[k].material.userData.u;
      u.topColor.value.set(f.top); u.pantsColor.value.set(f.pantsColor); u.joggers.value = f.pants === 'joggers' ? 1 : 0;
    }
    const tones = { light: 0xffffff, tan: 0xd9b090, brown: 0x9a6a4a, dark: 0x5e3e2c };
    this.skinMat.color.set(tones[f.skin] || 0xffffff);
    if (this.watch) this.watch.visible = !!f.watch;
  }

  buildWatch() {
    // simple smartwatch on the left wrist
    const g = new THREE.Group();
    // band around the wrist (hole along the forearm = bone +Y), face on the back of the wrist
    const fr = this.handFrame.l;
    const basis = new THREE.Matrix4().makeBasis(fr.thumb.clone(), new THREE.Vector3(0, 1, 0), fr.back.clone());
    g.quaternion.setFromRotationMatrix(basis);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.027, 0.0055, 8, 32), new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.8 }));
    strap.rotation.x = Math.PI / 2;
    strap.scale.set(1.15, 0.85, 1);
    g.add(strap);
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.04, 0.011), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1, metalness: 0.6, emissive: 0x112233, emissiveIntensity: 0.4 }));
    face.position.set(0, 0, 0.024);
    g.add(face);
    g.position.set(0, -0.03, 0);
    this.bones.hand_l.add(g);
    this.watch = g;
  }

  hideHead(hide) {
    this.headHidden = hide;
    const s = hide ? 0.001 : 1;
    this.bones.head.scale.setScalar(s);
    for (const k of ['high-poly', 'eyebrow001', 'eyelashes01', 'short02']) this.meshes[k].visible = !hide;
  }

  computeHandFrames() {
    this.handFrame = {};
    for (const side of ['l', 'r']) {
      const b = this.bones;
      const h = b['hand_' + side].getWorldPosition(new THREE.Vector3());
      const mid = b['middle_01_' + side].getWorldPosition(new THREE.Vector3());
      const ind = b['index_01_' + side].getWorldPosition(new THREE.Vector3());
      const pin = b['pinky_01_' + side].getWorldPosition(new THREE.Vector3());
      const fwd = mid.sub(h).normalize();
      const thumbSide = ind.sub(pin).normalize();
      // back of the hand: right hand = fwd x thumbSide, left = thumbSide x fwd
      const back = side === 'r' ? new THREE.Vector3().crossVectors(fwd, thumbSide) : new THREE.Vector3().crossVectors(thumbSide, fwd);
      back.normalize();
      const thumb = new THREE.Vector3().crossVectors(back, fwd).normalize().multiplyScalar(side === 'r' ? 1 : -1);
      // store the frame in hand-bone local space
      const inv = b['hand_' + side].getWorldQuaternion(new THREE.Quaternion()).invert();
      this.handFrame[side] = { fwd: fwd.applyQuaternion(inv), back: back.applyQuaternion(inv), thumb: thumb.applyQuaternion(inv) };
    }
  }

  // ---------- core posing helpers ----------
  reset() {
    for (const [n, b] of Object.entries(this.bones)) { b.quaternion.copy(this.rest[n].q); b.position.copy(this.rest[n].p); }
    if (this.headHidden) this.bones.head.scale.setScalar(0.001);
    this.root.updateMatrixWorld(true);
  }

  setWorldQuat(bone, q) {
    // NB: q may be one of the shared temporaries, so use a private one here
    bone.parent.getWorldQuaternion(_qp);
    bone.quaternion.copy(_qp.invert().multiply(q));
    bone.updateMatrixWorld(true);
  }

  // rotate a bone (minimal turn) so its +Y axis points along worldDir
  pointBone(name, worldDir) {
    const b = this.bones[name];
    b.getWorldQuaternion(_q);
    const cur = _v.copy(Y).applyQuaternion(_q);
    const r = _q2.setFromUnitVectors(cur, _v2.copy(worldDir).normalize());
    this.setWorldQuat(b, r.multiply(_q));
  }

  // turn a bone by a world-space rotation
  rotateWorld(name, axis, angle) {
    const b = this.bones[name];
    b.getWorldQuaternion(_q);
    const r = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    this.setWorldQuat(b, r.multiply(_q));
  }

  pos(name, out = new THREE.Vector3()) { return this.bones[name].getWorldPosition(out); }

  // two-bone IK: wrist to target, elbow pushed toward pole direction
  armIK(side, target, pole) {
    const S = this.pos('upperarm_' + side);
    const a = this.len['upper_' + side], b = this.len['lower_' + side];
    const dvec = target.clone().sub(S);
    let d = dvec.length();
    d = Math.min(d, (a + b) * 0.998);
    d = Math.max(d, Math.abs(a - b) + 0.01);
    const dir = dvec.normalize();
    const along = (a * a - b * b + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, a * a - along * along));
    const pp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
    const E = S.clone().addScaledVector(dir, along).addScaledVector(pp, h);
    this.pointBone('upperarm_' + side, E.clone().sub(S));
    const E2 = this.pos('lowerarm_' + side);
    this.pointBone('lowerarm_' + side, S.clone().addScaledVector(dir, d).sub(E2));
    // forearm twist follows the hand a bit (done after hand orientation)
  }

  // orient the hand: fingers along fwd, back of the hand facing back
  orientHand(side, fwd, back) {
    const b = this.bones['hand_' + side];
    const f = this.handFrame[side];
    b.getWorldQuaternion(_q);
    const f0 = f.fwd.clone().applyQuaternion(_q), b0 = f.back.clone().applyQuaternion(_q);
    const M0 = new THREE.Matrix4().makeBasis(f0, b0, f0.clone().cross(b0).normalize());
    const fT = fwd.clone().normalize();
    const bT = back.clone().sub(fT.clone().multiplyScalar(back.dot(fT))).normalize();
    const MT = new THREE.Matrix4().makeBasis(fT, bT, fT.clone().cross(bT).normalize());
    const R = new THREE.Quaternion().setFromRotationMatrix(MT.multiply(M0.transpose()));
    this.setWorldQuat(b, R.multiply(_q));
    // share some of the twist with the forearm so the wrist doesn't look snapped
  }

  // ---------- fingers ----------
  fingerBones(side, f) { return [1, 2, 3].map(i => this.bones[`${f}_0${i}_${side}`]); }

  // fingertip position for pose params without touching the scene graph
  tipFor(side, f, spread, c1, c2) {
    const [b1, b2, b3] = this.fingerBones(side, f);
    const handW = b1.parent.matrixWorld;
    const r1 = this.rest[b1.name].q, r2 = this.rest[b2.name].q, r3 = this.rest[b3.name].q;
    const sign = this.flex(side, f);
    const q1 = _qa.copy(r1).multiply(_qx.setFromEuler(_e.set(sign * c1, 0, spread)));
    _m.compose(b1.position, q1, _one);
    _m2.multiplyMatrices(handW, _m);
    const q2 = _qb.copy(r2).multiply(_qx.setFromEuler(_e.set(sign * c2, 0, 0)));
    _m.compose(b2.position, q2, _one);
    _m2.multiply(_m);
    const q3 = _qc.copy(r3).multiply(_qx.setFromEuler(_e.set(sign * c2 * (f === 'thumb' ? 0.9 : 0.72), 0, 0)));
    _m.compose(b3.position, q3, _one);
    _m2.multiply(_m);
    return _tip.set(0, TIP[f], 0).applyMatrix4(_m2);
  }

  applyFinger(side, f, spread, c1, c2) {
    const [b1, b2, b3] = this.fingerBones(side, f);
    const sign = this.flex(side, f);
    b1.quaternion.copy(this.rest[b1.name].q).multiply(_qx.setFromEuler(_e.set(sign * c1, 0, spread)));
    b2.quaternion.copy(this.rest[b2.name].q).multiply(_qx.setFromEuler(_e.set(sign * c2, 0, 0)));
    b3.quaternion.copy(this.rest[b3.name].q).multiply(_qx.setFromEuler(_e.set(sign * c2 * (f === 'thumb' ? 0.9 : 0.72), 0, 0)));
    b1.updateMatrixWorld(true);
  }

  // which way around local X curls the finger toward the palm (worked out once from the rest pose)
  flex(side, f) {
    const k = side + f;
    if (this.flexSign[k] !== undefined) return this.flexSign[k];
    const [b1] = this.fingerBones(side, f);
    const hand = b1.parent;
    hand.updateMatrixWorld(true);
    const palm = this.handFrame[side].back.clone().negate().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()));
    if (f === 'thumb') { const fw = this.handFrame[side].fwd.clone().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion())); palm.add(fw.multiplyScalar(0.5)).normalize(); }
    this.flexSign[k] = 1;
    const t0 = this.tipFor(side, f, 0, 0, 0).clone();
    const t1 = this.tipFor(side, f, 0, 0.4, 0.4).clone();
    this.flexSign[k] = t1.sub(t0).dot(palm) > 0 ? 1 : -1;
    return this.flexSign[k];
  }

  // Solve one finger so its tip lands on target (world). Returns the remaining error in meters.
  solveFinger(side, f, target, guess) {
    const p = guess || { s: 0, c1: 0.3, c2: 0.5 };
    const lim = f === 'thumb' ? { s: [-0.6, 0.6], c1: [-0.4, 1.0], c2: [-0.2, 1.2] } : { s: [-0.3, 0.3], c1: [-0.25, 1.4], c2: [0, 1.6] };
    let best = this.tipFor(side, f, p.s, p.c1, p.c2).distanceTo(target);
    let step = 0.25;
    for (let it = 0; it < 7; it++) {
      let improved = false;
      for (const key of ['c1', 'c2', 's']) {
        for (const dir of [1, -1]) {
          const old = p[key];
          p[key] = THREE.MathUtils.clamp(old + dir * step, lim[key][0], lim[key][1]);
          const e = this.tipFor(side, f, p.s, p.c1, p.c2).distanceTo(target);
          if (e < best - 1e-5) { best = e; improved = true; break; }
          p[key] = old;
        }
      }
      if (!improved) step *= 0.5;
      if (best < 0.0015) break;
    }
    this.applyFinger(side, f, p.s, p.c1, p.c2);
    return { err: best, p };
  }

  // relaxed finger curl (when nothing to touch)
  relaxFingers(side, curl = 0.35) {
    for (const f of FINGERS) this.applyFinger(side, f, 0, f === 'thumb' ? 0.1 : curl * 0.7, curl);
  }

  // eye point (ignores the head being shrunk for first person)
  eyeWorld(out = new THREE.Vector3()) {
    const h = this.bones.head;
    h.getWorldQuaternion(_q);
    return h.getWorldPosition(out).add(_v.copy(this.eyeLocal).applyQuaternion(_q));
  }

  // generic: orient a bone so its rest "forward"/"up" (world, captured at load) match targets
  orientBone(name, fwdT, upT) {
    const b = this.bones[name];
    if (!this.frames) this.frames = {};
    if (!this.frames[name]) {
      // capture in rest pose: avatar faces +z, up is +y
      const inv = this.restWorldQ[name].clone().invert();
      this.frames[name] = { fwd: new THREE.Vector3(0, 0, 1).applyQuaternion(inv), up: new THREE.Vector3(0, 1, 0).applyQuaternion(inv) };
    }
    const f = this.frames[name];
    b.getWorldQuaternion(_q);
    const f0 = f.fwd.clone().applyQuaternion(_q), u0 = f.up.clone().applyQuaternion(_q);
    const M0 = new THREE.Matrix4().makeBasis(f0, u0, f0.clone().cross(u0).normalize());
    const fT = fwdT.clone().normalize();
    const uT = upT.clone().sub(fT.clone().multiplyScalar(upT.dot(fT))).normalize();
    const MT = new THREE.Matrix4().makeBasis(fT, uT, fT.clone().cross(uT).normalize());
    const R = new THREE.Quaternion().setFromRotationMatrix(MT.multiply(M0.transpose()));
    this.setWorldQuat(b, R.multiply(_q));
  }
}
const _qp = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qc = new THREE.Quaternion(), _qx = new THREE.Quaternion();
const _e = new THREE.Euler(), _one = new THREE.Vector3(1, 1, 1), _tip = new THREE.Vector3();
export { FINGERS };
