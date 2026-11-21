// You: the suited body you see in third person, its moves, and your injuries.
import * as THREE from 'three';

export const PARTS = ['head', 'torso', 'armL', 'armR', 'legL', 'legR'];
export const PART_NAMES = { head: 'Head', torso: 'Chest', armL: 'Left arm', armR: 'Right arm', legL: 'Left leg', legR: 'Right leg' };

export class Body {
  constructor() { this.reset(); }
  reset() {
    this.hp = {}; this.bleed = {}; this.broken = {}; this.burn = {}; this.lost = {};
    for (const p of PARTS) { this.hp[p] = 100; this.bleed[p] = 0; this.broken[p] = false; this.burn[p] = 0; }
    this.blood = 100; this.dead = false; this.cause = ''; this.heartStop = 0; this.log = []; this.infected = 0;
  }
  hurt(part, dmg, kind, cause) {
    if (this.dead || dmg <= 0) return;
    if (this.lost[part]) part = 'torso'; // nothing left there: it hits the stump / body
    this.hp[part] = Math.max(0, this.hp[part] - dmg);
    // cut all the way through: the limb (and the suit on it) comes off
    if (kind === 'cut' && this.hp[part] <= 0 && part !== 'torso' && !this.lost[part]) {
      this.lost[part] = true; if (part !== 'head') this.bleed[part] += part.startsWith('leg') ? 0.5 : 0.35; // real: a lost limb kills in minutes without a tourniquet this.log.push(PART_NAMES[part] + ' cut off');
      this.onLose?.(part, dmg);
      if (part === 'head') { this.die(cause + ' - head cut off'); return; }
    }
    if (kind === 'blunt' && dmg > 18) this.bleed[part] += dmg * 0.012;
    if (kind === 'cut') this.bleed[part] += dmg * 0.03;
    if (kind === 'burn') this.burn[part] = Math.min(100, this.burn[part] + dmg);
    if (kind === 'break' || (kind === 'blunt' && dmg > 34 && /leg|arm/.test(part) && Math.random() < 0.6)) {
      if (!this.broken[part] && /leg|arm/.test(part)) { this.broken[part] = true; this.log.push(`${PART_NAMES[part]} broken`); this.bleed[part] += 0.25; }
    }
    if (this.hp.head <= 0) this.die(cause + (kind === 'burn' ? '' : ' - fatal head injury'));
    else if (this.hp.torso <= 0) this.die(cause + ' - chest crushed');
    this.lastCause = cause;
  }
  die(cause) { if (this.dead) return; this.dead = true; this.cause = cause; }
  get health() {
    if (this.dead) return 0;
    const h = this.hp, parts = h.head * 0.24 + h.torso * 0.36 + (h.armL + h.armR) * 0.06 + (h.legL + h.legR) * 0.14;
    return Math.max(0, Math.min(parts, 100 - (100 - this.blood) * 1.4));
  }
  get legs() { const b = this.broken, l = this.lost; return (b.legL || l.legL ? 1 : 0) + (b.legR || l.legR ? 1 : 0); }
  get bleeding() { return PARTS.reduce((a, p) => a + this.bleed[p], 0); }
  update(dt) {
    if (this.dead) return;
    for (const p of PARTS) {
      if (this.bleed[p] > 0) { this.blood -= this.bleed[p] * dt; this.bleed[p] = Math.max(0, this.bleed[p] - dt * (this.broken[p] ? 0.004 : 0.012)); }
      if (this.burn[p] > 40) this.hp[p] = Math.max(0, this.hp[p] - dt * (this.burn[p] - 40) * 0.01);
    }
    if (this.heartStop > 0) { this.heartStop -= dt; this.blood -= dt * 3.2; if (this.heartStop <= 0) this.log.push('Heart started again'); }
    // infection from bacteria in an open wound: slowly gets worse, eats at you
    if (this.infected > 0) { this.infected = Math.min(1, this.infected + dt * 0.004); this.hp.torso = Math.max(0, this.hp.torso - dt * this.infected * 0.9); if (this.hp.torso <= 0) this.die('Infection - soil bacteria got into an open wound'); }
    if (this.blood < 40) this.die((this.lastCause || 'Injuries') + ' - bled out');
    if (this.hp.head <= 0 || this.hp.torso <= 0) this.die(this.lastCause || 'Injuries');
  }
}

// helper: fall damage by how many of YOUR body heights you fell
export function fallDamage(body, bh, rough, label) {
  const s = bh - 2.2; if (s <= 0) return 0;
  const cause = (label || `Fell ${bh.toFixed(1)} body heights`) + (rough ? ' onto ' + rough : '');
  const side = Math.random() < 0.5 ? 'legL' : 'legR', other = side === 'legL' ? 'legR' : 'legL';
  body.hurt(side, s * 16 + Math.random() * 8, s > 3.5 ? 'break' : 'blunt', cause);
  body.hurt(other, s * 11, s > 5.5 ? 'break' : 'blunt', cause);
  if (s > 5) body.hurt('torso', (s - 5) * 13, 'blunt', cause);
  if (s > 6.5) body.hurt(Math.random() < 0.5 ? 'armL' : 'armR', (s - 6.5) * 18, 'break', cause);
  if (s > 8) body.hurt('head', (s - 8) * 22, 'blunt', cause);
  return s;
}

// Suit paints: main shell, dark under-suit, glow lines. (The real model's white shell / black under-suit / teal lines get repainted live.)
export const PAINTS = [
  { name: 'Red + black', main: 0xa3121a, dark: 0x0b0b0d, glow: 0xff3a1e },
  { name: 'Stealth black', main: 0x1a1c20, dark: 0x060607, glow: 0x39d2ff },
  { name: 'Factory white', main: 0xe9edf0, dark: 0x101214, glow: 0x20d8d0 },
  { name: 'Gold + black', main: 0x9c7424, dark: 0x0a0a0a, glow: 0xffb43a },
  { name: 'Gunmetal + green', main: 0x3c4248, dark: 0x0c0e0f, glow: 0x52ff6a },
  { name: 'Deep blue + silver', main: 0x12306e, dark: 0x9aa2ab, glow: 0x7ab8ff },
  { name: 'Purple + black', main: 0x4a1670, dark: 0x0a080c, glow: 0xd04aff },
];

export class Avatar {
  constructor(gltf) {
    this.root = new THREE.Group();
    const model = gltf.scene;
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
    const box = new THREE.Box3().setFromObject(model), h = box.max.y - box.min.y;
    model.scale.setScalar(1.8 / h); model.position.y = -box.min.y * 1.8 / h;
    this.inner = new THREE.Group(); this.inner.add(model); this.root.add(this.inner);
    this.model = model;
    this.mixer = new THREE.AnimationMixer(model);
    const A = {}; for (const c of gltf.animations) A[c.name.toLowerCase()] = this.mixer.clipAction(c);
    // the model only has walk + run: standing still = the walk's passing pose, held, with breathing on top
    const walkClip = gltf.animations.find(c => /walk/i.test(c.name));
    A.idle = this.mixer.clipAction(walkClip.clone()); A.idle.timeScale = 0; this.idlePose = 0.25;
    A.idle2 = this.mixer.clipAction(walkClip.clone()); A.idle2.timeScale = 0; A.idle2.play(); // the two opposite steps, averaged = standing
    this.A = A; for (const k of ['idle', 'walk', 'run']) { A[k].play(); A[k].setEffectiveWeight(k === 'idle' ? 1 : 0); }
    this.bones = {}; model.traverse(o => { if (o.isBone) this.bones[o.name.replace(/^mixamorig\d*:?/, '')] = o; });
    // the paint: live recolor in the shader, keeps all the real texture detail (scratches, panel lines, shading)
    this.paintU = { uMain: { value: new THREE.Color() }, uDark: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uGlowI: { value: 1.6 }, uHeat: { value: 0 } };
    model.traverse(o => { if (o.isSkinnedMesh) this.skinned = o; });
    const NB = this.NB = this.skinned.skeleton.bones.length;
    this.boneIndex = {}; this.skinned.skeleton.bones.forEach((b, i) => this.boneIndex[b.name] = i);
    this.cutU = { value: new Array(NB).fill(0) }; // 1 = this bone's part of you is gone
    this.baseMat = this.skinned.material;
    model.traverse(o => {
      if (!o.isMesh) return;
      o.material = this.makeMat(this.cutU, false); this.suit = o.material;
    });
    this.setPaint(0);
    this.w = { idle: 1, walk: 0, run: 0 }; this.lean = 0; this.air = 0; this.deadT = 0;
    this.flinch = { x: 0, z: 0, vx: 0, vz: 0 };
  }
  // the suit material. cut = per-bone uniform; keep=false: hide cut parts (+ wound edge), keep=true: show ONLY those parts (the piece that fell off)
  makeMat(cut, keep) {
    const m = this.baseMat.clone(), NB = this.NB;
    m.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, this.paintU); sh.uniforms.uCut = cut;
        sh.vertexShader = `uniform float uCut[${NB}]; varying float vCut;\n` + sh.vertexShader.replace('#include <skinning_vertex>', `#include <skinning_vertex>
  vCut = uCut[int(skinIndex.x)] * skinWeight.x + uCut[int(skinIndex.y)] * skinWeight.y + uCut[int(skinIndex.z)] * skinWeight.z + uCut[int(skinIndex.w)] * skinWeight.w;`);
        sh.fragmentShader = 'uniform vec3 uMain, uDark, uGlow; uniform float uGlowI, uHeat; varying float vCut;\n' + sh.fragmentShader
          .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  ${keep ? 'if (vCut < 0.45) discard;' : 'if (vCut > 0.6) discard;'}`)
          .replace('#include <map_fragment>', `#include <map_fragment>
  vec3 o0 = diffuseColor.rgb; float mx0 = max(o0.r, max(o0.g, o0.b)), mn0 = min(o0.r, min(o0.g, o0.b));
  float sat0 = (mx0 - mn0) / (mx0 + 1e-4);
  float glowM = smoothstep(0.42, 0.7, sat0) * step(o0.r * 1.15, o0.b) * smoothstep(0.02, 0.08, mx0);
  float lum0 = dot(o0, vec3(0.2126, 0.7152, 0.0722));
  float shellM = smoothstep(0.06, 0.3, lum0) * (1.0 - glowM);
  vec3 under = uDark * (0.55 + lum0 * 6.0);
  vec3 shell = uMain * (0.45 + 0.7 * smoothstep(0.1, 0.85, lum0));
  diffuseColor.rgb = mix(mix(under, shell, shellM), uGlow * 0.25, glowM);
  // the cut edge: torn suit + raw wound
  float wound = ${keep ? '1.0 - smoothstep(0.45, 0.75, vCut)' : 'smoothstep(0.3, 0.6, vCut)'};
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.28, 0.012, 0.015), wound); glowM *= 1.0 - wound;`)
          .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += uGlow * glowM * uGlowI + vec3(1.0, 0.3, 0.05) * uHeat * 0.6;`);
    };
    m.customProgramCacheKey = () => 'suitpaint' + keep;
    return m;
  }
  // which bones go with each limb: cut high (whole limb) or low (below the elbow / knee)
  static CHAINS = {
    armL: [['LeftArm', 'LeftForeArm', 'LeftHand'], ['LeftForeArm', 'LeftHand']], armR: [['RightArm', 'RightForeArm', 'RightHand'], ['RightForeArm', 'RightHand']],
    legL: [['LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase'], ['LeftLeg', 'LeftFoot', 'LeftToeBase']], legR: [['RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'], ['RightLeg', 'RightFoot', 'RightToeBase']],
    head: [['neck', 'Head', 'head_end', 'headfront']],
  };
  cut(part) {
    const opts = Avatar.CHAINS[part]; if (!opts) return null;
    const names = opts[Math.floor(Math.random() * opts.length)];
    for (const n of names) if (this.boneIndex[n] != null) this.cutU.value[this.boneIndex[n]] = 1;
    return names;
  }
  pieceMaterial(names) { const u = { value: new Array(this.NB).fill(0) }; for (const n of names) if (this.boneIndex[n] != null) u.value[this.boneIndex[n]] = 1; return this.makeMat(u, true); }
  resetCuts() { this.cutU.value.fill(0); }
  // a point on you in render space (you are at the middle)
  bonePos(name, out = new THREE.Vector3()) { const b = this.bones[name]; return b ? b.getWorldPosition(out) : out.set(0, 1, 0); }
  setPaint(i) { const p = PAINTS[i] || PAINTS[0]; this.paintI = i; this.paintU.uMain.value.set(p.main); this.paintU.uDark.value.set(p.dark); this.paintU.uGlow.value.set(p.glow); }
  hit(strength = 1, dir = Math.random() * 6.28) { const s = Math.min(2.5, strength); this.flinch.vx += Math.cos(dir) * 9 * s; this.flinch.vz += Math.sin(dir) * 9 * s; }
  // speedBH = body heights / second on the ground; mode: 'normal'|'shrink'|'speed'
  update(dt, s) {
    const targ = { idle: 0, walk: 0, run: 0 };
    const v = s.speedBH;
    if (s.dead) { this.deadT += dt; }
    if (v < 0.15) targ.idle = 1; else if (v < 1.6) { targ.walk = 1; } else targ.run = 1;
    for (const k in targ) { this.w[k] += (targ[k] - this.w[k]) * Math.min(1, dt * 8); this.A[k].setEffectiveWeight(this.w[k] * (k === 'idle' ? 0.5 : 1)); }
    this.A.idle2.setEffectiveWeight(this.w.idle * 0.5);
    this.A.walk.timeScale = Math.max(0.3, v / 0.85) * (s.limp ? 0.7 : 1);
    this.A.run.timeScale = Math.min(Math.max(0.6, v / 3.2), 2.6);
    this.A.idle.time = this.idlePose; this.A.idle2.time = this.idlePose + 0.5;
    // three.js skips writing a bone when the animated pose didn't change (standing still), so the extra
    // bends below would pile up frame after frame: undo last frame's bends first.
    const B = this.bones, TW = this.tweaked || (this.tweaked = ['Spine', 'Spine01', 'Spine02', 'Head'].filter(n => B[n]).map(n => ({ b: B[n], q: B[n].quaternion.clone() })));
    for (const t of TW) t.b.quaternion.copy(t.q);
    this.mixer.update(s.dead && this.deadT > 1.2 ? 0 : dt);
    for (const t of TW) t.q.copy(t.b.quaternion);
    // procedural extras on top of the animation
    const breath = Math.sin(performance.now() / 700) * 0.025 * this.w.idle;
    if (B.Spine01) B.Spine01.rotation.x += breath;
    // flinch spring: hits jolt your chest + head, then settle
    const F = this.flinch; F.vx += (-F.x * 140 - F.vx * 14) * dt; F.vz += (-F.z * 140 - F.vz * 14) * dt; F.x += F.vx * dt; F.z += F.vz * dt;
    if (B.Spine02) { B.Spine02.rotation.x += F.x * 0.35; B.Spine02.rotation.z += F.z * 0.35; }
    if (B.Head) { B.Head.rotation.x += F.x * 0.5; B.Head.rotation.z += F.z * 0.4; }
    this.air += ((s.inAir ? 1 : 0) - this.air) * Math.min(1, dt * 6);
    const lean = Math.min(0.75, Math.max(0, (v - 3) * 0.05) + (s.fast ? 0.35 : 0));
    this.lean += (lean - this.lean) * Math.min(1, dt * 4);
    if (B.Spine) B.Spine.rotation.x += this.lean * 0.6 * (window.__leanSign ?? 1);
    if (s.limp && B.Hips) { this.inner.position.y = -Math.abs(Math.sin(performance.now() / 260)) * 0.05; } else this.inner.position.y = 0;
    // dying: collapse to the ground
    const d = Math.min(1, this.deadT / 0.9);
    this.inner.rotation.x = -d * d * Math.PI / 2 * (s.dead ? 1 : 0);
    this.inner.position.z = s.dead ? -d * 0.2 : 0;
    // glow lines show what the suit is doing: pulse when shrinking / speeding, off when you're dead
    this.paintU.uGlowI.value = s.dead ? 0 : 1.4 + (s.mode !== 'normal' ? Math.sin(performance.now() / 70) * 0.9 + 1.2 : 0);
    this.paintU.uHeat.value = s.heat;
  }
}
