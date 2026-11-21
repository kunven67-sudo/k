// You: the suited body you see in third person, its moves, and your injuries.
import * as THREE from 'three';

export const PARTS = ['head', 'torso', 'armL', 'armR', 'legL', 'legR'];
export const PART_NAMES = { head: 'Head', torso: 'Chest', armL: 'Left arm', armR: 'Right arm', legL: 'Left leg', legR: 'Right leg' };

export class Body {
  constructor() { this.reset(); }
  reset() {
    this.hp = {}; this.bleed = {}; this.broken = {}; this.burn = {};
    for (const p of PARTS) { this.hp[p] = 100; this.bleed[p] = 0; this.broken[p] = false; this.burn[p] = 0; }
    this.blood = 100; this.dead = false; this.cause = ''; this.heartStop = 0; this.log = [];
  }
  hurt(part, dmg, kind, cause) {
    if (this.dead || dmg <= 0) return;
    this.hp[part] = Math.max(0, this.hp[part] - dmg);
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
    const h = this.hp, parts = h.head * 0.24 + h.torso * 0.36 + (h.armL + h.armR) * 0.06 + (h.legL + h.legR) * 0.11;
    return Math.max(0, Math.min(parts, 100 - (100 - this.blood) * 1.4));
  }
  get legs() { const b = this.broken; return (b.legL ? 1 : 0) + (b.legR ? 1 : 0); }
  get bleeding() { return PARTS.reduce((a, p) => a + this.bleed[p], 0); }
  update(dt) {
    if (this.dead) return;
    for (const p of PARTS) {
      if (this.bleed[p] > 0) { this.blood -= this.bleed[p] * dt; this.bleed[p] = Math.max(0, this.bleed[p] - dt * (this.broken[p] ? 0.004 : 0.012)); }
      if (this.burn[p] > 40) this.hp[p] = Math.max(0, this.hp[p] - dt * (this.burn[p] - 40) * 0.01);
    }
    if (this.heartStop > 0) { this.heartStop -= dt; this.blood -= dt * 3.2; if (this.heartStop <= 0) this.log.push('Heart started again'); }
    if (this.blood < 40) this.die((this.lastCause || 'Injuries') + ' - bled out');
    if (this.hp.head <= 0 || this.hp.torso <= 0) this.die(this.lastCause || 'Injuries');
  }
}

// helper: fall damage by how many of YOUR body heights you fell
export function fallDamage(body, bh, rough) {
  const s = bh - 2.2; if (s <= 0) return 0;
  const cause = `Fell ${bh.toFixed(1)} body heights${rough ? ' onto ' + rough : ''}`;
  const side = Math.random() < 0.5 ? 'legL' : 'legR', other = side === 'legL' ? 'legR' : 'legL';
  body.hurt(side, s * 16 + Math.random() * 8, s > 3.5 ? 'break' : 'blunt', cause);
  body.hurt(other, s * 11, s > 5.5 ? 'break' : 'blunt', cause);
  if (s > 5) body.hurt('torso', (s - 5) * 13, 'blunt', cause);
  if (s > 6.5) body.hurt(Math.random() < 0.5 ? 'armL' : 'armR', (s - 6.5) * 18, 'break', cause);
  if (s > 8) body.hurt('head', (s - 8) * 22, 'blunt', cause);
  return s;
}

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
    this.A = A; for (const k of ['idle', 'walk', 'run']) { A[k].play(); A[k].setEffectiveWeight(k === 'idle' ? 1 : 0); }
    this.bones = {}; model.traverse(o => { if (o.isBone) this.bones[o.name.replace(/^mixamorig\d*:?/, '')] = o; });
    // suit materials: body gets a darker, tougher look; visor glows by mode
    this.visor = null;
    model.traverse(o => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      if (/visor/i.test(o.name) || /visor/i.test(o.material.name)) { this.visor = o.material; o.material.emissive = new THREE.Color(0x2ad8ff); o.material.emissiveIntensity = 1.5; }
      else { this.suit = o.material; o.material.color.multiplyScalar(0.8); o.material.metalness = 0.35; o.material.roughness = 0.55; o.material.emissive = new THREE.Color(0); }
    });
    this.w = { idle: 1, walk: 0, run: 0 }; this.lean = 0; this.air = 0; this.deadT = 0;
  }
  // speedBH = body heights / second on the ground; mode: 'normal'|'shrink'|'speed'
  update(dt, s) {
    const targ = { idle: 0, walk: 0, run: 0 };
    const v = s.speedBH;
    if (s.dead) { this.deadT += dt; }
    if (v < 0.15) targ.idle = 1; else if (v < 1.6) { targ.walk = 1; } else targ.run = 1;
    for (const k in targ) { this.w[k] += (targ[k] - this.w[k]) * Math.min(1, dt * 8); this.A[k].setEffectiveWeight(this.w[k]); }
    this.A.walk.timeScale = Math.max(0.3, v / 0.85) * (s.limp ? 0.7 : 1);
    this.A.run.timeScale = Math.min(Math.max(0.6, v / 3.2), 2.6);
    this.mixer.update(s.dead && this.deadT > 1.2 ? 0 : dt);
    // procedural extras on top of the animation
    const B = this.bones;
    this.air += ((s.inAir ? 1 : 0) - this.air) * Math.min(1, dt * 6);
    const lean = Math.min(0.75, Math.max(0, (v - 3) * 0.05) + (s.fast ? 0.35 : 0));
    this.lean += (lean - this.lean) * Math.min(1, dt * 4);
    if (B.Spine) B.Spine.rotation.x += this.lean * 0.6;
    if (B.LeftArm && this.air > 0.01) { B.LeftArm.rotation.z -= 0.9 * this.air; B.RightArm.rotation.z += 0.9 * this.air; B.LeftUpLeg.rotation.x -= 0.35 * this.air; B.RightUpLeg.rotation.x += 0.2 * this.air; }
    if (s.limp && B.Hips) { this.inner.position.y = -Math.abs(Math.sin(performance.now() / 260)) * 0.05; } else this.inner.position.y = 0;
    // dying: collapse to the ground
    const d = Math.min(1, this.deadT / 0.9);
    this.inner.rotation.x = -d * d * Math.PI / 2 * (s.dead ? 1 : 0);
    this.inner.position.z = s.dead ? -d * 0.2 : 0;
    // visor colour shows what the suit is doing
    if (this.visor) {
      const c = s.mode === 'shrink' ? [1, 0.25, 0.2] : s.mode === 'speed' ? [1, 0.75, 0.2] : s.deep ? [0.7, 0.4, 1] : [0.16, 0.85, 1];
      this.visor.emissive.setRGB(c[0], c[1], c[2]); this.visor.emissiveIntensity = s.dead ? 0 : 1.2 + (s.mode !== 'normal' ? Math.sin(performance.now() / 70) * 0.6 + 0.8 : 0);
    }
    if (this.suit) this.suit.emissive.setRGB(s.heat * 0.6, s.heat * 0.18, 0);
  }
}
