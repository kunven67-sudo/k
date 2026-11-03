// SPINBORN character: anime VRM body (boy = Seed-san by VirtualCast, girl = pixiv's VRoid sample) changed by the wheels: race skin + horns/wings/halo/tail/ears,
// height, aura glow, weapon in hand, armor tint. Used by the mirror next to the wheel and by the end card.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { PowerFX, powerLook, shellMat } from './power.js';
import { combatTier } from './flow.js';


// race -> look. skin = new skin color, parts = extra pieces
const LOOK = {
  skin: {}, hybrid: {},
  god: { skin: '#f3d9a6', parts: ['halo', 'glow'], glow: '#ffe28a' }, devil: { skin: '#b3262b', parts: ['horns', 'tail', 'batwings'], hornColor: '#2a1214' },
  angel: { skin: '#fbe3d0', parts: ['wings', 'halo'] }, deviant: { skin: '#8a7c96', parts: ['spikes'] }, eternal: { skin: '#f6dcae', parts: ['glow', 'halo'], glow: '#fff1c0' },
  symbiote: { skin: '#121218', parts: ['eyesWhite'] }, skrull: { skin: '#5d9b4c', parts: ['ears'] }, kree: { skin: '#4a74c9', parts: [] },
  amazon: { skin: '#c98c5e', parts: [] }, atlantean: { skin: '#9fd0c6', parts: ['fins'] }, titan: { skin: '#b59a86', parts: [] },
  asgardian: { skin: '#f2cfb0', parts: ['glow'], glow: '#9fd4ff' }, viltrumite: { skin: '#f0c6a0', parts: [] }, kryptonian: { skin: '#f3cba8', parts: ['cape'], cape: '#c8102e' },
  martian: { skin: '#3f9e52', parts: [] }, otsutsuki: { skin: '#f4f1ee', parts: ['smallhorns'], hornColor: '#e8e2da' }, namekian: { skin: '#5fb04f', parts: ['antennae', 'ears'] },
  saiyan: { skin: '#f0c49c', parts: ['tail'], tailColor: '#6a3f22' }, quincy: { skin: '#f6d6bd', parts: ['cape'], cape: '#f2f2f2' },
  arrancar: { skin: '#f1ece8', parts: ['smallhorns'], hornColor: '#f5f2ea' }, hollow: { skin: '#e9e4de', parts: ['horns'], hornColor: '#f3efe6' }, shinigami: { skin: '#f3cfb2', parts: ['cape'], cape: '#15151a' },
  dragon: { skin: '#3d8f4a', parts: ['horns', 'batwings', 'tail'], hornColor: '#e8dcc0', tailColor: '#2f7a3c', wingColor: '#2b6e38' },
  phoenix: { skin: '#f08a2c', parts: ['wings', 'glow'], wingColor: '#ff7a1a', glow: '#ff9a2a' }, leviathan: { skin: '#2f7d8f', parts: ['fins'] }, kraken: { skin: '#7a3f7a', parts: [] },
  cerberus: { skin: '#3a3434', parts: ['ears'] }, golem: { skin: '#8f8f8a', parts: [] }, slime: { skin: '#58d66a', parts: [], clear: 0.72 },
  lich: { skin: '#a9b8c8', parts: ['glow', 'smallhorns'], glow: '#7cf3ff', hornColor: '#2a2f38' }, vampire: { skin: '#f3eeee', parts: ['cape'], cape: '#5a0b14' },
  werewolf: { skin: '#7a5a3e', parts: ['ears', 'tail'], tailColor: '#5a3f2a' }, ghoul: { skin: '#9aa39b', parts: [] }, spirit: { skin: '#bfe7ff', parts: ['glow'], clear: 0.6, glow: '#bfe7ff' },
  ghost: { skin: '#e8f2ff', parts: [], clear: 0.5 }, zombie: { skin: '#7f9a6e', parts: [] }, skeleton: { skin: '#ece6d6', parts: [] },
  medusa: { skin: '#6aa35a', parts: [] }, cyclops: { skin: '#c9a184', parts: [] }, minotaur: { skin: '#6b4a32', parts: ['horns'], hornColor: '#efe6d0' },
  centaur: { skin: '#e8b994', parts: [] }, fairy: { skin: '#ffd9ec', parts: ['fairywings', 'ears'] }, darkelf: { skin: '#6c5a7c', parts: ['ears'] },
  elf: { skin: '#f6dcc4', parts: ['ears'] }, ogre: { skin: '#8a9a52', parts: [] }, orc: { skin: '#5f8f3e', parts: ['ears'] },
  dwarf: { skin: '#e9b996', parts: [] }, hobbit: { skin: '#f0c39c', parts: [] }, gnome: { skin: '#f3c9a6', parts: ['ears'] }, goblin: { skin: '#6fa83c', parts: ['ears'] }
};

const BASE = { boy: 'assets/anime/AvatarSample_C.vrm', girl: 'assets/anime/AvatarSample_B.vrm' };
const WEAPON_FILE = { sword: 'sword_1handed', sword2: 'sword_2handed', dagger: 'dagger', axe: 'axe_1handed', axe2: 'axe_2handed', hammer: 'axe_2handed',
  staff: 'staff', wand: 'wand', book: 'spellbook_open', crossbow: 'crossbow_2handed', bow: 'crossbow_2handed', shield: 'shield_round', whip: 'dagger', fist: null, gun: null, none: null };
const HIDE_PARTS = /robo_arm|backpack|anim_logo|armgear/i;   // Seed-san's robot arm + backpack
const SKIN_MAT = /skin|body_bake/i;

const vrmLoader = new GLTFLoader(); vrmLoader.register(p => new VRMLoaderPlugin(p));
const vrmCache = new Map();
function loadVRM(url) {
  // a fresh copy each time (VRM objects can't be shared between two characters)
  return new Promise((res, rej) => vrmLoader.load(url, g => res(g.userData.vrm), undefined, rej));
}

// poses on the normalized humanoid (rotations in radians, x = forward/back, z = sideways)
const POSES = {
  Idle: { leftUpperArm: [0, 0, -1.2], rightUpperArm: [0, 0, 1.2], leftLowerArm: [0, -0.28, 0], rightLowerArm: [0, 0.28, 0], spine: [0.03, 0, 0], neck: [0.04, 0, 0] },
  Hero: { leftUpperArm: [0, -0.25, -1.05], rightUpperArm: [0, 0.25, 1.05], leftLowerArm: [0, -1.25, 0], rightLowerArm: [0, 1.25, 0], leftUpperLeg: [0, 0, 0.13], rightUpperLeg: [0, 0, -0.13], spine: [-0.06, 0, 0], neck: [-0.06, 0.15, 0], fist: 1 },
  Cast: { leftUpperArm: [0, -0.2, -1.1], rightUpperArm: [0, 1.35, -0.12], rightLowerArm: [0, 0.12, 0], leftLowerArm: [0, -0.4, 0], spine: [0, -0.18, 0], neck: [0, 0.18, 0], leftUpperLeg: [0, 0, 0.1], rightUpperLeg: [0, 0, -0.1] },
  Sword: { leftUpperArm: [0, -0.2, -1.15], rightUpperArm: [0, 0.55, 1.0], rightLowerArm: [0, 1.0, 0], leftLowerArm: [0, -0.3, 0], spine: [0, 0.2, 0], neck: [0, -0.18, 0], leftUpperLeg: [0.22, 0, 0.13], rightUpperLeg: [-0.18, 0, -0.13], rightLowerLeg: [0.25, 0, 0], fist: 1 },
  PowerUp: { leftUpperArm: [0, 0.38, -1.3], rightUpperArm: [0, -0.38, 1.3], leftLowerArm: [0, -0.55, 0], rightLowerArm: [0, 0.55, 0], leftUpperLeg: [-0.1, 0, 0.17], rightUpperLeg: [-0.1, 0, -0.17], leftLowerLeg: [0.22, 0, 0], rightLowerLeg: [0.22, 0, 0], spine: [-0.08, 0, 0], chest: [-0.12, 0, 0], neck: [-0.22, 0, 0], head: [-0.18, 0, 0], fist: 1 },
  Weak: { leftUpperArm: [0.1, 0, -1.3], rightUpperArm: [0.1, 0, 1.3], leftLowerArm: [0, -0.15, 0], rightLowerArm: [0, 0.15, 0], spine: [0.16, 0, 0], neck: [0.2, 0, 0], head: [0.15, 0, 0] },
  Dead: { leftUpperArm: [0, 0, -1.38], rightUpperArm: [0, 0, 1.38], spine: [0.42, 0, 0], neck: [0.5, 0, 0], head: [0.3, 0, 0.2] }
};
const ANIM_ALIAS = { Cheer: 'Hero', Spellcast_Raise: 'Cast', '2H_Melee_Idle': 'Sword', Death_A_Pose: 'Dead', Idle: 'Idle' };

export class Character {
  constructor() { this.root = new THREE.Group(); this.root.name = 'character'; this.ready = false; this.t = Math.random() * 10; this.pose = POSES.Idle; this.partList = []; }

  async build(C, { pose = 'Idle' } = {}) {
    const gender = C.gender === 'girl' ? 'girl' : 'boy';
    if (this.gender !== gender) {
      const vrm = await loadVRM(BASE[gender]);
      if (this.vrm) { this.root.remove(this.vrm.scene); VRMUtils.deepDispose(this.vrm.scene); }
      VRMUtils.rotateVRM0(vrm);                       // face +z like everything else
      this.vrm = vrm; this.gender = gender; this.model = vrm.scene; this.vrm0 = vrm.meta && String(vrm.meta.metaVersion) === '0';
      vrm.scene.traverse(o => {
        o.frustumCulled = false;
        if (o.isMesh) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          if (HIDE_PARTS.test(o.name) || mats.every(m => HIDE_PARTS.test(m.name))) o.visible = false;
          // each character loads its own copy of the model, so its materials are already its own (cloning them loses the textures)
          for (const m of mats) { m.userData.wasTransparent = m.transparent; m.userData.baseOpacity = m.opacity; m.userData.baseDepthWrite = m.depthWrite; }
        }
      });
      this.skinMats = []; vrm.scene.traverse(o => { if (o.isMesh) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) if (SKIN_MAT.test(m.name)) { m.userData.baseColor = m.color.clone(); m.userData.baseShade = m.shadeColorFactor ? m.shadeColorFactor.clone() : null; this.skinMats.push(m); } });
      this.eyeMats = []; vrm.scene.traverse(o => { if (o.isMesh) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) if (/iris|eye_?iris|EyeIris/i.test(m.name) || /_EYE/.test(m.name) && /Iris/i.test(m.name)) this.eyeMats.push(m); });
      if (vrm.springBoneManager) this.springs = [...vrm.springBoneManager.joints].map(j => ({ j, dir: j.settings.gravityDir.clone(), pow: j.settings.gravityPower }));
      this.fx = new PowerFX(1.7); this.root.add(this.fx.group);
      this.hairMats = []; vrm.scene.traverse(o => { if (o.isMesh) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) if (/hair/i.test(m.name)) { m.userData.baseColor = m.color.clone(); m.userData.baseShade = m.shadeColorFactor ? m.shadeColorFactor.clone() : null; m.userData.baseEm = m.emissive ? m.emissive.clone() : null; this.hairMats.push(m); } });
      // glow shells around the real body (thin bright edge + wide soft glow), hidden until you're strong
      this.shells = [];
      vrm.scene.traverse(o => { if (!o.isSkinnedMesh || !o.visible || o.userData.isShell) return;
        const base = Array.isArray(o.material) ? o.material[0] : o.material; if (/EYE|FACE|Eye|Mouth|Brow|lash/i.test(base.name)) return;
        const hair = /hair/i.test(base.name);
        for (const [th, k] of (hair ? [[0.02, 0.6]] : [[0.006, 1.0], [0.028, 0.45]])) {
        const sh = new THREE.SkinnedMesh(o.geometry, shellMat('#ffffff', th, k, base.map, base.alphaTest || 0.5)); sh.userData.isShell = true; sh.bind(o.skeleton, o.bindMatrix); sh.frustumCulled = false; sh.renderOrder = 4; sh.visible = false;
        if (o.morphTargetInfluences) { sh.morphTargetInfluences = o.morphTargetInfluences; sh.morphTargetDictionary = o.morphTargetDictionary; } o.add(sh); this.shells.push(sh); } });
      this.root.add(vrm.scene);
      this.applyPose(POSES.Idle, 1); vrm.update(0); vrm.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(vrm.scene); this.baseHeight = ((box.max.y - box.min.y) / (vrm.scene.getWorldScale(new THREE.Vector3()).y || 1)) || 1.6;
      const H = this.baseHeight;
      const hb = vrm.humanoid.getRawBoneNode('head'), cb = vrm.humanoid.getRawBoneNode('chest') || vrm.humanoid.getRawBoneNode('spine');
      const hp = vrm.scene.worldToLocal(hb.getWorldPosition(new THREE.Vector3())), cp = vrm.scene.worldToLocal(cb.getWorldPosition(new THREE.Vector3()));
      this.headBox = new THREE.Box3().setFromCenterAndSize(hp.clone().add(new THREE.Vector3(0, H * 0.06, 0.005)), new THREE.Vector3(H * 0.125, H * 0.15, H * 0.135));
      this.bodyBox = new THREE.Box3().setFromCenterAndSize(cp.clone().add(new THREE.Vector3(0, H * 0.02, 0)), new THREE.Vector3(H * 0.2, H * 0.26, H * 0.12));
      const wrap = (bone) => { const w = new THREE.Group(); const m = new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(vrm.scene.matrixWorld); m.decompose(w.position, w.quaternion, w.scale); bone.add(w); return w; };
      this.headWrap = wrap(hb); this.bodyWrap = wrap(cb);
      this.handR = vrm.humanoid.getNormalizedBoneNode('rightHand');
      this.lastKey = null; this.weaponKind = null;
    }
    await this.apply(C);
    this.play(ANIM_ALIAS[pose] || pose);
    this.ready = true;
    return this;
  }

  play(name) { this.pose = POSES[ANIM_ALIAS[name] || name] || POSES.Idle; }

  applyPose(P, k = 1) {
    const h = this.vrm.humanoid; const f0 = this.vrm0 ? -1 : 1; // VRM 0.x rigs face the other way
    if (this.weak && P === POSES.Idle) P = POSES.Weak;
    if (this.powered && P === POSES.Idle) P = POSES.PowerUp;
    for (const n of ['leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm', 'spine', 'chest', 'neck', 'head', 'leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg']) {
      const b = h.getNormalizedBoneNode(n); if (!b) continue; const r = P[n] || [0, 0, 0];
      b.rotation.set(r[0] * k * f0, r[1] * k, r[2] * k * f0);
    }
    const curl = P.fist ? 1 : 0.25;
    for (const side of ['left', 'right']) for (const f of ['Index', 'Middle', 'Ring', 'Little']) for (const j of ['Proximal', 'Intermediate', 'Distal']) {
      const b = h.getNormalizedBoneNode(side + f + j); if (b) b.rotation.z = (side === 'left' ? -1 : 1) * curl * 1.2 * f0;
    }
  }

  lookFor(C) {
    const key = (C.raceLook && C.raceLook !== 'hybrid') ? C.raceLook : (C.parents ? keyOf(C.parents[0]) : 'skin');
    const L = LOOK[key] || {};
    if (C.parents) { const L2 = LOOK[keyOf(C.parents[1])] || {}; return { ...L2, ...L, parts: [...new Set([...(L.parts || []), ...(L2.parts || [])])] }; }
    return L;
  }

  apply(C) {
    const L = this.lookFor(C);
    const tier = combatTier(C); const look = powerLook(C, tier); this.lookP = look;
    this.weak = look.level === 0;
    // skin: only a light tint of the race color (anime skin stays anime)
    const sk = L.skin ? new THREE.Color(L.skin) : null;
    for (const m of this.skinMats) {
      m.color.copy(m.userData.baseColor); if (sk) m.color.lerp(sk.clone().multiplyScalar(1.3), 0.32);
      if (m.userData.baseShade) { m.shadeColorFactor.copy(m.userData.baseShade); if (sk) m.shadeColorFactor.lerp(sk.clone().multiplyScalar(0.7), 0.35); }
    }
    const clear = L.clear ? Math.max(0.55, L.clear) : 1;
    this.vrm.scene.traverse(o => { if (o.isMesh) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      const u = m.userData; const was = !!u.wasTransparent;
      m.transparent = clear < 1 || was; m.opacity = (u.baseOpacity ?? 1) * clear; m.depthWrite = clear < 1 ? false : (u.baseDepthWrite ?? true); m.needsUpdate = true; } });
    // glowing eyes for strong / holy / evil
    for (const m of this.eyeMats) { if (m.emissive) { m.emissive.set(look.level >= 3 || look.evil || look.holy ? look.eyes : '#000000'); if ('emissiveIntensity' in m) m.emissiveIntensity = look.level >= 3 ? 1.6 : 0.8; } }
    // hair floats up when the power is huge
    if (this.springs) for (const s of this.springs) { if (look.level >= 3) { s.j.settings.gravityDir.set(0, 1, 0); s.j.settings.gravityPower = 0.18 + (look.level - 3) * 0.12; } else { s.j.settings.gravityDir.copy(s.dir); s.j.settings.gravityPower = s.pow; } }
    // real height
    const inches = C.height || 66;
    const s = Math.max(0.05, (inches * 0.0254) / this.baseHeight);
    if (Math.abs(this.vrm.scene.scale.x - s) > 1e-4) {
      this.vrm.scene.scale.setScalar(s); this.vrm.scene.updateMatrixWorld(true);
      const sb = this.vrm.springBoneManager; if (sb) { sb.setInitState(); sb.reset(); }
    }
    this.heightM = this.baseHeight * s;
    // race pieces (halo, horns, energy wings)
    for (const o of this.partList) { o.parent && o.parent.remove(o); o.traverse(m => { if (m.geometry) m.geometry.dispose(); }); }
    this.partList = [];
    const parts = new Set((L.parts || []).filter(p => ['halo', 'horns', 'smallhorns', 'wings', 'batwings', 'fairywings'].includes(p)));
    if (C.transformation && /Demon|Dragon/.test(C.transformation)) parts.add('horns');
    for (const p of parts) {
      const f = PARTS[p]; if (!f) continue;
      const obj = f({ ...L, look }, this.headBox, this.bodyBox); if (!obj) continue;
      (obj.userData.on === 'spine' ? this.bodyWrap : this.headWrap).add(obj); this.partList.push(obj);
    }
    // hair: gold + glowing for golden forms, tinted + faint glow at high power
    for (const m of this.hairMats) {
      m.color.copy(m.userData.baseColor); if (m.userData.baseShade) m.shadeColorFactor.copy(m.userData.baseShade); if (m.userData.baseEm) m.emissive.copy(m.userData.baseEm);
      if (!m.userData.baseMap) m.userData.baseMap = m.map || null;
      if (look.hair) {
        m.map = brightMap(m.userData.baseMap) || m.userData.baseMap;
        m.color.set(look.hair); if (m.shadeColorFactor) m.shadeColorFactor.set('#d88a12'); if (m.emissive) m.emissive.set('#7a4a00');
      } else if (m.userData.baseMap !== undefined) m.map = m.userData.baseMap;
      else if (look.level >= 3 && m.emissive) m.emissive.copy(new THREE.Color(look.col).multiplyScalar(0.22));
      m.needsUpdate = true;
    }
    // body outline glow
    for (const sh of this.shells) { sh.visible = look.level >= 2; sh.material.uniforms.col.value.set(look.level >= 3 ? look.col : look.col); sh.material.uniforms.k.value = (sh.material.uniforms.thick.value < 0.01 ? 1 : 0.45) * [0, 0, 0.5, 1, 1.25][look.level]; }
    this.powered = look.level >= 3;
    // the power look
    this.fx.set(look, this.heightM);
    if (this.aura) { this.aura.parent && this.aura.parent.remove(this.aura); this.aura = null; }
    return this.setWeapon(C);
  }

  async setWeapon(C) {
    const kind = weaponKind(C.weapon);
    if (this.weaponKind === kind) return;
    this.weaponKind = kind;
    if (this.weapon) { this.weapon.parent && this.weapon.parent.remove(this.weapon); this.weapon = null; }
    const file = WEAPON_FILE[kind]; if (!file || !this.handR) return;
    try {
      const g = await loadGLTF(`assets/kaykit/weapons/${file}.gltf`);
      if (this.weaponKind !== kind) return;
      const w = g.scene.clone(true);
      const b = new THREE.Box3().setFromObject(w); const len = Math.max(b.max.y - b.min.y, 0.001);
      const holder = new THREE.Group(); holder.add(w);
      const want = /sword2|axe2|staff|hammer/.test(kind) ? 1.05 : kind === 'dagger' || kind === 'wand' ? 0.38 : 0.8; // meters
      w.scale.setScalar(want / len);
      w.position.y = -(b.min.y) * w.scale.x - 0.06;
      holder.scale.setScalar(1 / (this.vrm.scene.scale.x || 1));
      // normalized right hand: fingers = -X, thumb side = +Z. Rest the blade down + a bit forward, like holding it at your side
      holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-0.86, 0.05, 0.5).normalize());
      holder.position.set(-0.06, -0.012, 0.012);
      this.handR.add(holder); this.weapon = holder;
    } catch (e) { /* weapon model missing: fists */ }
  }

  update(dt) {
    if (!this.vrm) return;
    this.t += dt;
    this.applyPose(this.pose, 1);
    const h = this.vrm.humanoid;
    const ch = h.getNormalizedBoneNode('chest'); if (ch) ch.rotation.x += Math.sin(this.t * 1.6) * 0.02;       // breathing
    const hd = h.getNormalizedBoneNode('head'); if (hd) hd.rotation.y += Math.sin(this.t * 0.45) * 0.12;
    const em = this.vrm.expressionManager;
    if (em) {
      const yell = this.powered && this.pose === POSES.Idle;
      const blink = !yell && (this.t % 4.2) < 0.14 ? 1 : 0; em.setValue('blink', blink);
      em.setValue('relaxed', yell || this.pose === POSES.Dead ? 0 : this.weak ? 0 : 0.25);
      em.setValue('angry', yell ? 1 : 0); em.setValue('aa', yell ? 0.85 + Math.sin(this.t * 11) * 0.12 : 0);
      em.setValue('sad', this.weak && this.pose === POSES.Idle ? 0.35 : 0);
    }
    if (this.shells) for (const sh of this.shells) if (sh.visible) sh.material.uniforms.t.value = this.t;
    this.vrm.update(dt);
    if (this.fx) this.fx.update(dt); for (const o of this.partList) if (o.userData.tick) o.userData.tick(dt);
  }
}

// hair texture turned light grey (keeps the strands) so a gold color shows bright, not brown
const brightCache = new WeakMap();
function brightMap(tex) {
  if (!tex || !tex.image) return null;
  if (brightCache.has(tex)) return brightCache.get(tex);
  const img = tex.image, c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), px = d.data;
  let lo = 255, hi = 0; for (let i = 0; i < px.length; i += 16) { const l = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11; if (px[i + 3] > 10) { lo = Math.min(lo, l); hi = Math.max(hi, l); } }
  const span = Math.max(8, hi - lo);
  for (let i = 0; i < px.length; i += 4) { const l = (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11 - lo) / span; const v = 150 + l * 105; px[i] = px[i + 1] = px[i + 2] = v; }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = tex.colorSpace; t.flipY = tex.flipY; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT; t.channel = tex.channel;
  brightCache.set(tex, t); return t;
}
const gltfCache = new Map(); const plainLoader = new GLTFLoader();
function loadGLTF(url) { if (!gltfCache.has(url)) gltfCache.set(url, new Promise((res, rej) => plainLoader.load(url, res, undefined, rej))); return gltfCache.get(url); }

// exact bounds of a skinned mesh in its bind pose (Box3.setFromObject is too loose on these rigs)
function skinnedBox(mesh) {
  const v = new THREE.Vector3(), box = new THREE.Box3(), pos = mesh.geometry.attributes.position;
  mesh.updateMatrixWorld(true); if (mesh.skeleton) mesh.skeleton.update();
  for (let i = 0; i < pos.count; i++) { mesh.getVertexPosition(i, v); v.applyMatrix4(mesh.matrixWorld); box.expandByPoint(v); }
  return box;
}
export function keyOf(race) {
  return ({ 'Dark Elf': 'darkelf', 'Ōtsutsuki': 'otsutsuki' })[race] || String(race || '').toLowerCase().replace(/[^a-z]/g, '');
}
function weaponKind(w) {
  if (!w || w === 'No weapon') return 'none';
  const s = w.toLowerCase();
  if (/greatsword|claymore|dragon bone|voidbreaker|solaris|divine executioner|2h/.test(s)) return 'sword2';
  if (/sword|katana|rapier|scimitar|saber|blade|edge|lightsaber|excalibur|soulreaper|chronoblade|godfire|eclipse/.test(s)) return 'sword';
  if (/dagger|knife|kunai|sai|stars|hidden|darts|boomerang/.test(s)) return 'dagger';
  if (/battle axe|halberd|chainsaw|glaive/.test(s)) return 'axe2';
  if (/axe|hatchet|pickaxe/.test(s)) return 'axe';
  if (/hammer|mace|club|bat|crowbar|pan|shovel|morning star|meteor|mjolnir|chicken/.test(s)) return 'hammer';
  if (/wand/.test(s)) return 'wand';
  if (/book/.test(s)) return 'book';
  if (/staff|spear|trident|scythe|nunchucks|tonfa|fan|harpoon|stick|gungnir|infinity spear|heaven|wrath/.test(s)) return 'staff';
  if (/crossbow/.test(s)) return 'crossbow';
  if (/bow/.test(s)) return 'bow';
  if (/shield/.test(s)) return 'shield';
  return 'none';
}
function armorColor(a) {
  if (/Divine|Celestial/.test(a)) return '#f2d27a'; if (/Demon|Cursed/.test(a)) return '#5a1a1a'; if (/Dragon/.test(a)) return '#2f7a3c';
  if (/Void|Cosmic|Dimensional/.test(a)) return '#3a2a6a'; if (/Energy|Spirit/.test(a)) return '#58c8ff'; return '#9aa2ac';
}
let _aura = null;
function auraTex() {
  if (_aura) return _aura;
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 140, 4, 128, 128, 127); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.32)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256); _aura = new THREE.CanvasTexture(c); return _aura;
}

// ---- extra body parts (simple low-poly pieces in the same style), sized from the real head (H) and body (B) boxes ----
const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, flatShading: true, ...extra });
const dims = (box) => { const s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3()); return { s, c, top: box.max.y, bot: box.min.y, front: box.max.z, back: box.min.z }; };
const PARTS = {
  horns(L, H) { const { s, c, top } = dims(H); const g = new THREE.Group();
    const evil = L.look && L.look.evil;
    const m = new THREE.MeshStandardMaterial({ color: L.hornColor || (evil ? '#160608' : '#2a2422'), roughness: 0.32, metalness: 0.25, emissive: evil ? '#3a0008' : '#000000' });
    for (const k of [-1, 1]) { const h = taperHorn(s.y * 0.5, s.x * 0.075, k, m); h.position.set(c.x + k * s.x * 0.24, top - s.y * 0.12, c.z + s.z * 0.05); g.add(h); } return g; },
  smallhorns(L, H) { const { s, c, top } = dims(H); const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: L.hornColor || '#e9e4dc', roughness: 0.4 });
    for (const k of [-1, 1]) { const h = taperHorn(s.y * 0.26, s.x * 0.045, k, m); h.position.set(c.x + k * s.x * 0.18, top - s.y * 0.06, c.z + s.z * 0.18); g.add(h); } return g; },
  spikes(L, H) { const { s, c, top } = dims(H); const g = new THREE.Group(); const m = flat('#4a3a5a');
    for (let i = -2; i <= 2; i++) { const h = new THREE.Mesh(new THREE.ConeGeometry(s.x * 0.05, s.y * 0.3, 5), m); h.position.set(c.x + i * s.x * 0.12, top + s.y * 0.04, c.z - s.z * 0.1); h.rotation.x = -0.35; h.rotation.z = -i * 0.18; g.add(h); } return g; },
  antennae(L, H) { const { s, c, top } = dims(H); const g = new THREE.Group(); const m = flat('#4f9a40');
    for (const k of [-1, 1]) { const h = new THREE.Mesh(new THREE.CylinderGeometry(s.x * 0.012, s.x * 0.02, s.y * 0.4, 5), m); h.position.set(c.x + k * s.x * 0.14, top + s.y * 0.14, c.z + s.z * 0.1); h.rotation.z = -0.3 * k; g.add(h);
      const b = new THREE.Mesh(new THREE.SphereGeometry(s.x * 0.035, 6, 4), m); b.position.set(c.x + k * s.x * 0.21, top + s.y * 0.33, c.z + s.z * 0.1); g.add(b); } return g; },
  ears(L, H) { const { s, c } = dims(H); const g = new THREE.Group(); const m = flat(L.skin || '#e8b994');
    for (const k of [-1, 1]) { const h = new THREE.Mesh(new THREE.ConeGeometry(s.y * 0.07, s.x * 0.3, 4), m); h.position.set(c.x + k * s.x * 0.56, c.y + s.y * 0.05, c.z); h.rotation.z = -1.25 * k; g.add(h); } return g; },
  fins(L, H) { const { s, c } = dims(H); const g = new THREE.Group(); const m = flat('#2f9f9a', { side: THREE.DoubleSide });
    for (const k of [-1, 1]) { const f = new THREE.Mesh(new THREE.CircleGeometry(s.y * 0.2, 3), m); f.position.set(c.x + k * s.x * 0.52, c.y, c.z - s.z * 0.05); f.rotation.y = 1.3 * k; g.add(f); } return g; },
  halo(L, H) { const { s, c, top } = dims(H); const t = new THREE.Mesh(new THREE.TorusGeometry(s.x * 0.3, s.x * 0.035, 8, 32), new THREE.MeshBasicMaterial({ color: '#ffe28a', toneMapped: false }));
    t.rotation.x = Math.PI / 2; t.position.set(c.x, top + s.y * 0.16, c.z); return t; },
  eyesWhite(L, H) { const { s, c, front } = dims(H); const g = new THREE.Group(); const m = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    for (const k of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(s.x * 0.08, 8, 6), m); e.scale.set(1.4, 0.7, 0.4); e.position.set(c.x + k * s.x * 0.18, c.y, front - s.z * 0.02); g.add(e); } return g; },
  glow() { return null; },
  cape(L, H, B) { const { s, c, top, back } = dims(B); const m = flat(L.cape || '#8a1010', { side: THREE.DoubleSide });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(s.x * 0.95, s.y * 1.55, 1, 3), m); p.position.set(c.x, top - s.y * 0.75, back - s.z * 0.06); p.rotation.x = 0.1; p.userData.on = 'spine'; return p; },
  tail(L, H, B) { const { s, c, bot, back } = dims(B); const u = s.y;
    const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -u * 0.25, -u * 0.35), new THREE.Vector3(0, -u * 0.1, -u * 0.75), new THREE.Vector3(0, u * 0.2, -u * 0.95)];
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, u * 0.05, 6), flat(L.tailColor || '#7a1a1a'));
    m.position.set(c.x, bot + u * 0.1, back); m.userData.on = 'spine'; return m; },
  wings(L, H, B) { return energyWings(L.look && L.look.holy ? '#fff1c2' : (L.wingColor || '#eaf4ff'), B, false); },
  batwings(L, H, B) { return energyWings(L.look && L.look.evil ? '#ff2338' : (L.wingColor || '#7a1020'), B, true); },
  fairywings(L, H, B) { const w = energyWings('#bff3ff', B, false); w.scale.setScalar(0.55); return w; }
};
// curved horn that gets thinner to a sharp tip
function taperHorn(len, rad, side, mat) {
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(side * len * 0.25, len * 0.45, -len * 0.1), new THREE.Vector3(side * len * 0.2, len * 0.85, -len * 0.45), new THREE.Vector3(side * len * 0.02, len * 1.0, -len * 0.85)]);
  const segs = 18, rs = 7, pos = [], idx = [];
  const frames = curve.computeFrenetFrames(segs, false);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, p = curve.getPointAt(t), r = rad * (1 - t) * (1 - t * 0.15) + 0.0005;
    for (let k = 0; k < rs; k++) { const a = (k / rs) * Math.PI * 2; const n = frames.normals[i].clone().multiplyScalar(Math.cos(a)).add(frames.binormals[i].clone().multiplyScalar(Math.sin(a)));
      pos.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r); }
  }
  for (let i = 0; i < segs; i++) for (let k = 0; k < rs; k++) { const a = i * rs + k, b = i * rs + (k + 1) % rs, c = a + rs, d = b + rs; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}
// glowing wings made of light feathers (anime style), slowly flapping
let _feather = null;
function featherTex() {
  if (_feather) return _feather;
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 256, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,0.0)'); gr.addColorStop(0.15, 'rgba(255,255,255,0.85)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(32, 0); g.quadraticCurveTo(64, 120, 34, 256); g.lineTo(30, 256); g.quadraticCurveTo(0, 120, 32, 0); g.fill();
  g.globalCompositeOperation = 'destination-out'; g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.5;
  for (let y = 30; y < 250; y += 9) { g.beginPath(); g.moveTo(32, y); g.lineTo(6, y - 14); g.moveTo(32, y); g.lineTo(58, y - 14); g.stroke(); }
  _feather = new THREE.CanvasTexture(c); return _feather;
}
function energyWings(color, B, sharp) {
  const { s, c, top, back } = dims(B); const u = s.y * 1.25;
  const g = new THREE.Group(); g.userData.on = 'spine';
  const mat = new THREE.MeshBasicMaterial({ map: featherTex(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
  const halves = [];
  for (const side of [-1, 1]) {
    const half = new THREE.Group(); half.position.set(c.x + side * s.x * 0.18, top - s.y * 0.22, back - s.z * 0.1); g.add(half); halves.push([half, side]);
    const n = sharp ? 9 : 13;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(u * (sharp ? 0.16 : 0.2), u * (0.55 + Math.sin(t * Math.PI) * 0.65) * (sharp ? 1.1 : 1)), mat);
      f.geometry.translate(0, f.geometry.parameters.height / 2, 0);
      const a = -0.35 + t * (sharp ? 1.45 : 1.75);                  // fan from up to out to down
      f.rotation.z = -side * (Math.PI / 2 - a) * 0.9; f.position.x = side * t * u * 0.12; f.position.y = -t * u * 0.12; f.position.z = -t * u * 0.03;
      half.add(f);
    }
  }
  let tt = Math.random() * 6;
  g.userData.tick = (dt) => { tt += dt; for (const [h, side] of halves) h.rotation.y = side * (0.55 + Math.sin(tt * 1.6) * 0.18); };
  return g;
}
