// The player's body: limbs that come off and grow back (bone -> meat -> skin).
// Works on the real Mixamo-rigged soldier model. Each vertex knows which body part it belongs to (aSeg)
// and how far down the limb it sits (aAlong, 0 = shoulder/hip, 1 = fingertips/toes).
import * as THREE from 'three';
import { Body } from './physics.js';

export const SEG = { body: 0, lUpper: 1, lFore: 2, rUpper: 3, rFore: 4, lThigh: 5, lShin: 6, rThigh: 7, rShin: 8, head: 9 };
// limb -> [upper bone, lower bone, end bone, segs when cut at upper, segs when cut at lower, cap radius upper/lower (m)]
export const LIMBS = {
  lArm: { up: 'LeftArm', low: 'LeftForeArm', end: 'LeftHand', tip: 'LeftHandMiddle3', upper: [1, 2], lower: [2], r: [0.055, 0.042], name: 'left arm' },
  rArm: { up: 'RightArm', low: 'RightForeArm', end: 'RightHand', tip: 'RightHandMiddle3', upper: [3, 4], lower: [4], r: [0.055, 0.042], name: 'right arm' },
  lLeg: { up: 'LeftUpLeg', low: 'LeftLeg', end: 'LeftFoot', tip: 'LeftToeBase', upper: [5, 6], lower: [6], r: [0.08, 0.055], name: 'left leg' },
  rLeg: { up: 'RightUpLeg', low: 'RightLeg', end: 'RightFoot', tip: 'RightToeBase', upper: [7, 8], lower: [8], r: [0.08, 0.055], name: 'right leg' },
};
const BONE_SEG = [
  [/LeftForeArm|LeftHand/, 2], [/LeftArm/, 1], [/RightForeArm|RightHand/, 4], [/RightArm/, 3],
  [/LeftLeg|LeftFoot|LeftToe/, 6], [/LeftUpLeg/, 5], [/RightLeg|RightFoot|RightToe/, 8], [/RightUpLeg/, 7], [/Head/, 9],
];

export const REGROW_TIME = 3.0;
const bn = n => n.replace(/^mixamorig\d*:?/, '').replace(/_\d+$/, ''); // seconds: bone 0-1, meat 1-2, skin 2-3

export function loadLayerTextures() {
  const L = new THREE.TextureLoader();
  const t = n => { const x = L.load('assets/tex/' + n); x.wrapS = x.wrapT = THREE.RepeatWrapping; return x; };
  return { muscle: t('muscle_diff.jpg'), bone: t('bone_diff.jpg') };
}

// GLSL: triplanar sample + small value noise
const COMMON = /* glsl */`
uniform sampler2D uMuscle; uniform sampler2D uBoneTex; uniform float uBlood;
varying float vSegT; varying float vAlong; varying vec3 vLoc; varying float vHide; varying float vSeg; varying float vBare;
vec3 tri(sampler2D t, vec3 p, vec3 n){ vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x+w.y+w.z+1e-4);
  return texture2D(t,p.yz).rgb*w.x + texture2D(t,p.zx).rgb*w.y + texture2D(t,p.xy).rgb*w.z; }
float hsh(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
float vnoise(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hsh(i),hsh(i+vec3(1,0,0)),f.x),mix(hsh(i+vec3(0,1,0)),hsh(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hsh(i+vec3(0,0,1)),hsh(i+vec3(1,0,1)),f.x),mix(hsh(i+vec3(0,1,1)),hsh(i+vec3(1,1,1)),f.x),f.y),f.z); }
`;

export function regenMaterial(mat, uniforms, kind = 'cloth') {
  const m = mat.clone();
  m.defines = { ...(m.defines || {}), ...(kind === 'acc' ? { REGEN_ACC: 1 } : kind === 'keep' ? { REGEN_KEEP: 1 } : {}) };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aSeg; attribute float aAlong;
uniform float uSegT[10]; uniform float uSegStart[10]; uniform float uBare[10]; uniform float uUnit; uniform float uHideHead; uniform float uBeat;
varying float vSegT; varying float vAlong; varying vec3 vLoc; varying float vHide; varying float vSeg; varying float vBare;`)
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>
{ int si = int(aSeg + 0.5); float st = uSegT[si];
  vSeg = aSeg; vSegT = st; vAlong = (aAlong - uSegStart[si]) / max(0.001, 1.0 - uSegStart[si]);
  vHide = (st < 0.0 || (si == 9 && uHideHead > 0.5)) ? 1.0 : 0.0; vBare = uBare[si];
  if (st >= 0.0 && st < 50.0) {
    float thin = 1.0 - smoothstep(0.9, 2.0, st);          // thin bone first, then meat fills out
    float tipThin = smoothstep(0.6, 1.0, vAlong) * (1.0 - smoothstep(1.6, 2.4, st));
    transformed -= normalize(objectNormal) * (thin * 0.03 + tipThin * 0.01) * uUnit;
    float throb = smoothstep(0.4, 0.9, st) * (1.0 - smoothstep(2.4, 3.0, st));   // swells with each heartbeat
    transformed += normalize(objectNormal) * uBeat * throb * 0.006 * uUnit;
  }
  vLoc = transformed / uUnit; }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + COMMON)
      .replace('void main() {', 'void main() {\n  if (vHide > 0.5) discard;\n  float rgSkin = 1.0; float rgWet = 0.0;')
      .replace('#include <map_fragment>', `#include <map_fragment>
{ vec3 nl = normalize(cross(dFdx(vLoc), dFdy(vLoc)));
  if (vBare > 0.5) {
#ifdef REGEN_ACC
    discard; // pouches etc. flew off with the old limb
#endif
#ifndef REGEN_KEEP
    float sn = vnoise(vLoc * 9.0) * 0.6 + vnoise(vLoc * 60.0) * 0.4;   // new bare skin: the sleeve did not grow back
    diffuseColor.rgb = mix(vec3(0.36, 0.17, 0.11), vec3(0.58, 0.31, 0.21), sn);
    float vv = abs(vnoise(vLoc * 13.0) - 0.5); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.45, 0.36, 0.45), (1.0 - smoothstep(0.0, 0.02, vv)) * 0.25);
#endif
  }
  if (vSegT >= 0.0 && vSegT < 50.0) {
    vec3 mus = tri(uMuscle, vLoc * vec3(3.0, 9.0, 3.0), nl); float ml = dot(mus, vec3(0.333));
    vec3 muscle = mix(vec3(0.16, 0.012, 0.01), vec3(0.62, 0.07, 0.06), smoothstep(0.15, 0.75, ml));
    muscle = mix(muscle, vec3(0.85, 0.75, 0.62), smoothstep(0.82, 0.95, vnoise(vLoc * 38.0)) * 0.5); // fat/tendon streaks
    float bl = dot(tri(uBoneTex, vLoc * 6.0, nl), vec3(0.333));
    vec3 boneC = mix(vec3(0.55, 0.5, 0.4), vec3(0.92, 0.88, 0.78), bl);
    float toMeat = smoothstep(0.75, 1.6, vSegT);
    float vn = abs(vnoise(vLoc * vec3(10.0, 22.0, 10.0)) - 0.5);           // veins over the new muscle
    muscle = mix(muscle, vec3(0.22, 0.03, 0.12), (1.0 - smoothstep(0.0, 0.03, vn)) * 0.85);
    float sinew = smoothstep(0.86, 0.97, vnoise(vLoc * vec3(60.0, 6.0, 60.0)));  // white tendon strands
    muscle = mix(muscle, vec3(0.9, 0.84, 0.78), sinew * (1.0 - smoothstep(1.5, 2.3, vSegT)));
    vec3 inner = mix(boneC, muscle, toMeat);
    float front = (vSegT - 1.85) / 1.0;
    rgSkin = 1.0 - smoothstep(front - 0.10, front + 0.03, vAlong);
    vec3 fresh = mix(inner, diffuseColor.rgb * vec3(1.15, 0.86, 0.82), 0.7); // new pink skin right behind the front
    float edge = smoothstep(front - 0.28, front - 0.02, vAlong) * rgSkin;
    diffuseColor.rgb = mix(inner, mix(diffuseColor.rgb, fresh, edge), rgSkin);
    rgWet = (1.0 - rgSkin) * mix(0.55, 1.0, toMeat);
  }
  if (uBlood > 0.01) {
    float n = vnoise(vLoc * 7.0) * 0.65 + vnoise(vLoc * 23.0) * 0.35;
    float b = smoothstep(1.0 - uBlood * 0.55, 1.05 - uBlood * 0.55, n) * (vSeg < 0.5 || vSeg > 8.5 ? 1.0 : 0.6);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.0, 0.0), b * 0.9); rgWet = max(rgWet, b * 0.8);
  } }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.22, rgWet);`);
  };
  m.customProgramCacheKey = () => 'regen';
  return m;
}

export class RegenBody {
  constructor(gltf, layers, { physics, fx, audio, scene }) {
    this.root = gltf.scene; this.physics = physics; this.fx = fx; this.audio = audio; this.scene = scene;
    this.bones = {}; this.meshes = []; this.origMats = new Map();
    this.root.traverse(o => {
      if (o.isBone) this.bones[bn(o.name)] = o;
      if (o.isSkinnedMesh) { this.meshes.push(o); o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; }
    });
    this.uniforms = {
      uSegT: { value: new Array(10).fill(99) }, uSegStart: { value: new Array(10).fill(0) },
      uUnit: { value: 1 }, uHideHead: { value: 0 }, uBlood: { value: 0 },
      uMuscle: { value: layers.muscle }, uBoneTex: { value: layers.bone }, uBare: { value: new Array(10).fill(0) }, uBeat: { value: 0 },
    };
    this.root.updateMatrixWorld(true);
    for (const m of this.meshes) this.tagVertices(m);
    this.uniforms.uUnit.value = 1 / this.meshes[0].getWorldScale(new THREE.Vector3()).x;
    for (const m of this.meshes) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const nm = mats.map(x => { const kind = /pouch|lambert1/i.test(x.name) ? 'acc' : /boot|helmet|night|mask|face|eye/i.test(x.name) ? 'keep' : 'cloth'; const r = regenMaterial(x, this.uniforms, kind); this.origMats.set(r, x); return r; });
      m.material = Array.isArray(m.material) ? nm : nm[0];
    }
    // limb state: 'ok' | 'cut' | 'grow'
    this.limbs = {};
    for (const k in LIMBS) this.limbs[k] = { state: 'ok', level: null, t: 0, wait: 0, cap: null };
    this.blood = 0; this.regenRate = 1; this.pieces = []; this.beatT = 0; this.spurts = []; this.fxT = 0;
    this.muscleMat = new THREE.MeshStandardMaterial({ map: layers.muscle, color: 0xb02018, roughness: 0.25 });
    this.boneMat = new THREE.MeshStandardMaterial({ map: layers.bone, color: 0xf2ead6, roughness: 0.55 });
  }

  tagVertices(mesh) {
    const g = mesh.geometry, n = g.attributes.position.count;
    const si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = mesh.skeleton.bones;
    const segOf = bones.map(b => { const nm = bn(b.name); for (const [re, s] of BONE_SEG) if (re.test(nm)) return s; return 0; });
    const seg = new Float32Array(n), along = new Float32Array(n);
    // joint positions in the mesh's bind space
    const jp = name => { const i = bones.findIndex(b => bn(b.name) === name); if (i < 0) return null; return new THREE.Vector3().setFromMatrixPosition(mesh.skeleton.boneInverses[i].clone().invert()); };
    const chains = this.chains || {};
    for (const [k, L] of Object.entries(LIMBS)) {
      if (chains[k]) continue;
      const a = jp(L.up), b = jp(L.low), e = jp(L.end); if (!a || !b || !e) continue;
      const t0 = jp(L.tip), tip = t0 ? t0.clone().add(t0.clone().sub(e).multiplyScalar(0.6)) : e.clone().add(e.clone().sub(b).multiplyScalar(0.35));
      const axis = tip.clone().sub(a); const len = axis.length(); axis.normalize();
      chains[k] = { a, axis, len, lowStart: b.clone().sub(a).dot(axis) / len };
      this[k + 'LowStart'] = chains[k].lowStart;
    }
    const segLimb = { 1: 'lArm', 2: 'lArm', 3: 'rArm', 4: 'rArm', 5: 'lLeg', 6: 'lLeg', 7: 'rLeg', 8: 'rLeg' };
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      let best = 0, bw = -1;
      for (let j = 0; j < 4; j++) { const w = sw.getComponent(i, j); if (w > bw) { bw = w; best = si.getComponent(i, j); } }
      const s = segOf[best]; seg[i] = s;
      if (segLimb[s] && chains[segLimb[s]]) {
        const c = chains[segLimb[s]];
        v.fromBufferAttribute(g.attributes.position, i).applyMatrix4(mesh.bindMatrix);
        along[i] = THREE.MathUtils.clamp(v.sub(c.a).dot(c.axis) / c.len, 0, 1);
      }
    }
    g.setAttribute('aSeg', new THREE.BufferAttribute(seg, 1));
    g.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
    this.chains = chains;
  }

  // ---- state queries
  has(k) { return this.limbs[k].state === 'ok'; }
  // how much of a limb is usable: 1 = whole, 0.5 = lower part gone, 0 = gone (regrowing counts once skin is on)
  amount(k) {
    const l = this.limbs[k];
    if (l.state === 'ok') return 1;
    const done = l.state === 'grow' && l.t > REGROW_TIME * 0.75;
    if (done) return 1;
    return l.level === 'lower' ? 0.5 : 0;
  }
  missingCount() { return Object.values(this.limbs).filter(l => l.state !== 'ok').length; }

  // ---- cutting
  sever(k, level = 'upper', dir = null) {
    const L = LIMBS[k], st = this.limbs[k];
    if (st.state === 'cut' && (st.level === 'upper' || level === 'lower')) return false; // already gone
    const segs = level === 'upper' ? L.upper : L.lower;
    this.root.updateMatrixWorld(true);
    this.spawnPiece(k, segs, level, dir);
    st.state = 'cut'; st.level = level; st.t = 0; st.wait = 1.0;
    for (const s of segs) { this.uniforms.uBare.value[s] = 1; this.uniforms.uSegT.value[s] = -1; this.uniforms.uSegStart.value[s] = level === 'upper' ? 0 : this[k + 'LowStart']; }
    const bone = this.bones[level === 'upper' ? L.up : L.low];
    // stump: wet meat with the bone end in the middle
    if (st.cap) st.cap.parent.remove(st.cap);
    const unit = 1 / bone.parent.getWorldScale(_v).x, r = L.r[level === 'upper' ? 0 : 1] * unit;
    const cap = new THREE.Group();
    const meat = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), this.muscleMat); meat.scale.set(1, 0.55, 1); cap.add(meat);
    const bn = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.28, r * 0.32, r * 0.9, 10), this.boneMat); bn.position.y = r * 0.35; cap.add(bn);
    cap.position.copy(bone.position); cap.quaternion.copy(bone.quaternion); // aligned with the limb
    bone.parent.add(cap); st.cap = cap; st.capBase = r;
    const wp = bone.getWorldPosition(new THREE.Vector3());
    this.fx.blood(wp, dir || _v.set(0, 0.5, 0), 70, 4);
    this.audio.play(Math.random() < 0.5 ? 'break1' : 'break2', { pos: wp, vol: 1 });
    this.audio.play('flesh2', { pos: wp, vol: 0.8 });
    this.spurts.push({ bone, beats: 5 });
    this.onSever && this.onSever(k, level);
    return true;
  }

  // copies the cut-off part (current pose) into a loose mesh that falls on the ground
  spawnPiece(k, segs, level, dir) {
    const L = LIMBS[k], group = new THREE.Group(), pts = [];
    for (const mesh of this.meshes) {
      const g = mesh.geometry, idx = g.index, seg = g.attributes.aSeg, pos = [], uv = [], nrm = [];
      const want = i => segs.includes(Math.round(seg.getX(i)));
      const p = new THREE.Vector3();
      const tri = idx ? idx.count / 3 : g.attributes.position.count / 3;
      const groups = g.groups.length ? g.groups : [{ start: 0, count: idx ? idx.count : g.attributes.position.count, materialIndex: 0 }];
      for (const gr of groups) {
        const P = [], U = [];
        for (let t = gr.start; t < gr.start + gr.count; t += 3) {
          const a = idx ? idx.getX(t) : t, b = idx ? idx.getX(t + 1) : t + 1, c = idx ? idx.getX(t + 2) : t + 2;
          if (!(want(a) && want(b) && want(c))) continue;
          for (const i of [a, b, c]) {
            mesh.getVertexPosition(i, p); p.applyMatrix4(mesh.matrixWorld); P.push(p.x, p.y, p.z); pts.push(p.clone());
            if (g.attributes.uv) U.push(g.attributes.uv.getX(i), g.attributes.uv.getY(i));
          }
        }
        if (!P.length) continue;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
        if (U.length) geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
        geo.computeVertexNormals();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const mm = new THREE.Mesh(geo, this.origMats.get(mats[gr.materialIndex || 0]) || mats[0]);
        mm.castShadow = true; group.add(mm);
      }
    }
    if (!pts.length) return;
    const center = new THREE.Vector3(); for (const q of pts) center.add(q); center.divideScalar(pts.length);
    for (const c of group.children) c.geometry.translate(-center.x, -center.y, -center.z);
    // meat cap on the cut end
    const joint = this.bones[level === 'upper' ? L.up : L.low].getWorldPosition(new THREE.Vector3());
    const r = L.r[level === 'upper' ? 0 : 1];
    const cap = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), this.muscleMat); cap.position.copy(joint).sub(center); cap.scale.set(1, 1, 1); group.add(cap);
    const bc = new THREE.Mesh(new THREE.SphereGeometry(r * 0.32, 8, 6), this.boneMat); bc.position.copy(cap.position); group.add(bc);
    group.position.copy(center); this.scene.add(group);
    let rad = 0; for (const q of pts) rad = Math.max(rad, q.distanceTo(center));
    const body = this.physics.add(new Body(group, { radius: Math.min(0.09, rad * 0.25), mass: level === 'upper' ? 4 : 2, bounce: 0.2, friction: 0.9 }));
    body.limb = true; body.bleed = 2.5; body.joint = cap;
    const out = (dir ? dir.clone() : new THREE.Vector3((Math.random() - 0.5), 0, (Math.random() - 0.5))).setY(0).normalize();
    body.vel.copy(out.multiplyScalar(2.5 + Math.random() * 2)).setY(2.5 + Math.random() * 1.5);
    body.ang.set(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4);
    body.onLand = (b, hit) => { this.fx.pool(b.obj.position.x, b.obj.position.z, 0.35); if (hit > 3) this.audio.play('flesh1', { pos: b.obj.position, vol: 0.5 }); };
    this.pieces.push({ body, age: 0 });
    while (this.pieces.length > 24) { const old = this.pieces.shift(); this.scene.remove(old.body.obj); this.physics.remove(old.body); }
  }

  // ---- every frame, after the animation mixer
  update(dt) {
    const U = this.uniforms.uSegT.value;
    for (const [k, st] of Object.entries(this.limbs)) {
      const L = LIMBS[k];
      if (st.state === 'ok') continue;
      const segs = st.level === 'upper' ? L.upper : L.lower;
      const bone = this.bones[st.level === 'upper' ? L.up : L.low];
      if (st.state === 'cut') {
        bone.scale.setScalar(1e-4);
        st.wait -= dt * this.regenRate;
        if (st.wait <= 0) { st.state = 'grow'; st.t = 0; st.cracked = false; st.sq = 0; this.audio.play('regen', { pos: bone.getWorldPosition(_v), vol: 0.8 }); }
        continue;
      }
      // growing
      st.t += dt * this.regenRate;
      const t = st.t, g = THREE.MathUtils.smoothstep(t, 0, 1.25);
      bone.scale.setScalar(Math.max(1e-3, 0.04 + 0.96 * (1 - Math.pow(1 - g, 2))));
      for (const s of segs) U[s] = t;
      if (st.cap) { const c = Math.max(0, 1 - t / 0.7); st.cap.scale.setScalar(Math.max(1e-3, c)); }
      if (t >= REGROW_TIME) {
        st.state = 'ok'; st.level = null; bone.scale.setScalar(1);
        for (const s of segs) U[s] = 99;
        if (st.cap) { st.cap.parent.remove(st.cap); st.cap = null; }
        this.audio.play('pop', { pos: bone.getWorldPosition(_v), vol: 0.5 });
        this.onRegrown && this.onRegrown(k);
      }
    }
    // blood on the body washes away while you heal
    this.blood = Math.max(0, this.blood - dt * 0.08 * this.regenRate);
    this.uniforms.uBlood.value = this.blood;
    // heartbeat: stumps spurt and new limbs throb on each beat
    const rate = 1.25 + this.missingCount() * 0.25, prev = this.beatT % 1;
    this.beatT += dt * rate; const ph = this.beatT % 1;
    this.uniforms.uBeat.value = Math.pow(Math.max(0, Math.sin(ph * Math.PI * 2)), 6) + 0.4 * Math.pow(Math.max(0, Math.sin((ph - 0.18) * Math.PI * 2)), 6);
    if (ph < prev) {
      for (const sp of this.spurts) {
        if (sp.beats-- <= 0) continue;
        const p = sp.bone.getWorldPosition(new THREE.Vector3()), dir = p.clone().sub(sp.bone.parent.getWorldPosition(_v)).normalize();
        this.fx.blood(p, dir, 16, 4.2);
      }
      this.spurts = this.spurts.filter(s => s.beats > 0);
    }
    // regrowing limbs: steam, drips, wet sounds
    this.fxT -= dt;
    for (const [k, st] of Object.entries(this.limbs)) {
      if (st.state !== 'grow') continue;
      const L = LIMBS[k], b = this.bones[st.level === 'upper' ? L.up : L.low], end = this.bones[L.end];
      if (this.fxT <= 0) {
        const p = b.getWorldPosition(new THREE.Vector3()).lerp(end.getWorldPosition(_v), Math.random() * Math.min(1, st.t / 1.3));
        if (st.t > 0.3 && st.t < 2.6) this.fx.steam && this.fx.steam(p);
        if (st.t > 0.6 && st.t < 2.3 && Math.random() < 0.5) this.fx.blood(p, null, 1, 0.3);
      }
      if (st.t > 0.05 && !st.cracked) { st.cracked = true; this.audio.play('break1', { pos: b.getWorldPosition(_v), vol: 0.45, rate: 1.4 }); }
      st.sq = (st.sq || 0) - dt; if (st.t > 0.8 && st.t < 2.4 && st.sq <= 0) { st.sq = 0.55; this.audio.play(Math.random() < 0.5 ? 'regen' : 'flesh1', { pos: b.getWorldPosition(_v), vol: 0.4, rate: 0.8 + Math.random() * 0.4 }); }
    }
    if (this.fxT <= 0) this.fxT = 0.09;
    for (const p of this.pieces) {
      p.age += dt;
      if (p.body.bleed > 0) { p.body.bleed -= dt; if (Math.random() < 0.3) this.fx.blood(p.body.joint.getWorldPosition(_v), null, 2, 0.8); }
    }
  }
  newSuit() { this.uniforms.uBare.value.fill(0); }
  clearPieces() { for (const p of this.pieces) { this.scene.remove(p.body.obj); this.physics.remove(p.body); } this.pieces = []; }
}
const _v = new THREE.Vector3();
