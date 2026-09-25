// GERM SIZE: so small that the world becomes a dark, glowing void - basically space. You float
// among bacteria, bacteriophages, paramecia, rotifers, a giant amoeba and a tardigrade. Your
// weapons are gone; you craft new ones from diatom glass, cellulose and protein.
import * as THREE from 'three';
import { World } from '../core/physics.js';
import * as TX from '../core/textures.js';
import { getPreset } from '../core/settings.js';
import { ui } from '../core/ui.js';
import { sfx, loop, playMusic, setReverb } from '../core/audio.js';
import { mulberry32 } from '../core/noise.js';
import { Creature } from '../game/creature.js';
import { G } from '../game/state.js';
import { unlock } from '../game/achievements.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Standard material + a fresnel rim glow: the dark-field microscope look.
function rimMat(color, rim, { opacity = 1, emissive = 0.15, wobble = 0 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0, transparent: opacity < 1, opacity, emissive: color, emissiveIntensity: emissive, depthWrite: opacity >= 1 });
  const rimC = new THREE.Color(rim);
  m.userData.time = { value: 0 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = { value: rimC };
    sh.uniforms.uTime = m.userData.time;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uRim;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float fres = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.5);
        totalEmissiveRadiance += uRim * fres * 1.6;`);
    if (wobble > 0) {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float wob = sin(position.x * 1.3 + uTime * 1.7) * sin(position.y * 1.1 + uTime * 1.3) * sin(position.z * 1.2 + uTime * 2.1);
          transformed += normal * wob * ${wobble.toFixed(3)};`);
    }
  };
  m.customProgramCacheKey = () => `rim${rim}${wobble}${opacity}`;
  return m;
}

class Microbe extends Creature {
  constructor(o) {
    super({ ...o, flying: true, deathCause: 'microbe' });
    this.knockback = 4;
    this.wander = V();
    this.wT = 0;
    this.face = new THREE.Quaternion();
    this.bob = Math.random() * 10;
  }
  brain(dt, level, player) {
    const pp = player.body.pos.clone().add(V(0, 0.9, 0));
    const me = this.body.pos.clone().add(V(0, this.body.height / 2, 0));
    const d = me.distanceTo(pp);
    this.attackCd = Math.max(0, this.attackCd - dt);
    const ok = player.mode !== 'dead';
    let target, speed;
    if (ok && (d < this.aggroRange || this.aggro) && this.home.distanceTo(pp) < this.leashRange) { target = pp; speed = this.speed; this.state = 'chase'; }
    else {
      this.state = 'wander'; this.aggro = false;
      this.wT -= dt;
      if (this.wT <= 0) { this.wT = 2 + Math.random() * 3; this.wander.set(this.home.x + (Math.random() - 0.5) * 30, this.home.y + (Math.random() - 0.5) * 20, this.home.z + (Math.random() - 0.5) * 30); }
      target = this.wander; speed = this.speed * 0.35;
    }
    const dir = target.clone().sub(me);
    const len = dir.length();
    if (len > 0.1) dir.multiplyScalar(1 / len);
    const k = 1 - Math.exp(-2.5 * dt);
    this.body.vel.lerp(dir.multiplyScalar(len > this.attackRange * 0.6 ? speed : 0), k);
    if (this.state === 'chase' && d < this.attackRange + 0.9 && this.attackCd <= 0) {
      this.attackCd = this.attackDelay ?? 1.2;
      this.onAttack && this.onAttack(player);
      const kb = pp.clone().sub(me).normalize().multiplyScalar(6);
      player.damage(this.dmg, 'microbe', kb);
    }
  }
  physics(dt, world) {
    world.move(this.body, dt);
  }
  sync(dt) {
    this.group.position.copy(this.body.pos);
    const v = this.body.vel;
    if (v.lengthSq() > 0.05) {
      const m = new THREE.Matrix4().lookAt(V(), v.clone().normalize(), V(0, 1, 0));
      const q = new THREE.Quaternion().setFromRotationMatrix(m);
      this.face.slerp(q, 1 - Math.exp(-4 * dt));
    }
    this.group.quaternion.copy(this.face);
    if (this.hitFlash > 0) {
      this.hitFlash = Math.max(0, this.hitFlash - dt * 5);
      for (const mm of this.flashMats) mm.emissive.copy(mm.userData.baseEmissive).lerp(new THREE.Color(0xff3020), this.hitFlash);
    }
  }
  update(dt, level, player) {
    if (this.dead) {
      this.deathT += dt;
      this.group.scale.multiplyScalar(Math.exp(-dt * 4));
      return this.deathT < 1.2;
    }
    if (!G.aiPaused && player) this.brain(dt, level, player);
    else this.body.vel.multiplyScalar(0.95);
    this.physics(dt, level.world);
    level.pushOut && level.pushOut(this.body, this.body.radius);
    this.animate && this.animate(dt);
    this.sync(dt);
    return true;
  }
}

class Bacterium extends Microbe {
  constructor() {
    super({ name: 'Bacillus', hp: 30, radius: 1.1, height: 1.6, speed: 6.5, damage: 8 });
    this.aggroRange = 22; this.leashRange = 90; this.attackRange = 1.8;
    this.loot = [['protein', 1], ['flagellum', 1]]; this.lootChance = 0.85;
    const m = rimMat(0x1f6a3a, 0x7affb0, { opacity: 0.9 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, 2.2, 8, 16), m);
    body.rotation.x = Math.PI / 2; body.position.y = 0.8; this.group.add(body);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ color: 0xa0ffcf }));
    inner.position.set(0, 0.8, 0.3); this.group.add(inner);
    this.tail = [];
    let parent = this.group; let pos = V(0, 0.8, -1.8);
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Group(); s.position.copy(pos); parent.add(s);
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.8, 5), new THREE.MeshBasicMaterial({ color: 0x7affb0, transparent: true, opacity: 0.7 }));
      seg.rotation.x = Math.PI / 2; seg.position.z = -0.4; s.add(seg);
      this.tail.push(s); parent = s; pos = V(0, 0, -0.8);
    }
    this.registerFlash();
  }
  animate(dt) { const t = G.time * 9 + this.bob; this.tail.forEach((s, i) => { s.rotation.y = Math.sin(t - i * 0.7) * 0.35; s.rotation.x = Math.cos(t * 0.8 - i * 0.6) * 0.2; }); }
}

class Phage extends Microbe {
  constructor() {
    super({ name: 'Bacteriophage', hp: 25, radius: 0.9, height: 2.4, speed: 9, damage: 12 });
    this.aggroRange = 26; this.leashRange = 100; this.attackRange = 1.8; this.attackDelay = 1.4;
    this.loot = [['protein', 2]]; this.lootChance = 0.8;
    const m = rimMat(0x3a1a5a, 0xd08aff);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0), m); head.position.set(0, 1.2, 0.9); head.rotation.x = Math.PI / 2; this.group.add(head);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.6, 8), m); tail.rotation.x = Math.PI / 2; tail.position.set(0, 1.2, -0.3); this.group.add(tail);
    this.legs = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const leg = new THREE.Group(); leg.position.set(0, 1.2, -1.1); this.group.add(leg);
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 4), m); l.position.set(Math.cos(a) * 0.5, Math.sin(a) * 0.5, -0.4); l.rotation.set(Math.sin(a) * 0.9 + Math.PI / 2, 0, -Math.cos(a) * 0.9); leg.add(l);
      this.legs.push(leg);
    }
    this.registerFlash();
  }
  animate() { this.legs.forEach((l, i) => { l.rotation.z = Math.sin(G.time * 6 + i) * 0.3; }); }
}

class Paramecium extends Microbe {
  constructor() {
    super({ name: 'Paramecium', hp: 60, radius: 1.6, height: 2.2, speed: 7.5, damage: 14 });
    this.aggroRange = 20; this.leashRange = 90; this.attackRange = 2.6; this.attackDelay = 1.8;
    this.loot = [['lipid', 1], ['protein', 1]];
    const m = rimMat(0x1a3a6a, 0x7ad0ff, { opacity: 0.85, wobble: 0.08 });
    this.mat = m;
    const b = new THREE.Mesh(new THREE.SphereGeometry(1.2, 24, 16), m); b.scale.set(0.9, 0.8, 2.6); b.position.y = 1.1; this.group.add(b);
    const cil = new THREE.Points(new THREE.SphereGeometry(1.25, 30, 20), new THREE.PointsMaterial({ color: 0xbfefff, size: 0.08, transparent: true, opacity: 0.7 }));
    cil.scale.copy(b.scale); cil.position.copy(b.position); this.group.add(cil); this.cil = cil;
    this.registerFlash();
  }
  animate(dt) { this.mat.userData.time.value = G.time; this.cil.rotation.z += dt * 2; }
}

class Rotifer extends Microbe {
  constructor() {
    super({ name: 'Rotifer', hp: 70, radius: 1.4, height: 3, speed: 4, damage: 10 });
    this.aggroRange = 18; this.leashRange = 60; this.attackRange = 2.4;
    this.loot = [['protein', 2], ['lipid', 1]];
    const m = rimMat(0x5a4a1a, 0xffd07a, { opacity: 0.9 });
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.3, 3.2, 16), m); b.rotation.x = -Math.PI / 2; b.position.y = 1.2; this.group.add(b);
    this.wheels = [-1, 1].map((s) => { const w = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.12, 6, 20), rimMat(0x7a6a2a, 0xffffa0)); w.position.set(0.6 * s, 1.4, 1.7); w.rotation.y = Math.PI / 2; this.group.add(w); return w; });
    this.registerFlash();
  }
  animate(dt) { this.wheels.forEach((w, i) => { w.rotation.x += dt * (i ? 10 : -10); }); }
  brain(dt, level, player) {
    super.brain(dt, level, player);
    // suction: drags you in when close
    if (this.state === 'chase') {
      const d = this.body.pos.distanceTo(player.body.pos);
      if (d < 12 && d > 2) player.body.vel.add(this.body.pos.clone().sub(player.body.pos).normalize().multiplyScalar(dt * 10));
    }
  }
}

class Tardigrade extends Microbe {
  constructor() {
    super({ name: 'Tardigrade', hp: 450, radius: 3.5, height: 5, speed: 4.2, damage: 18 });
    this.isBoss = true;
    this.aggroRange = 26; this.leashRange = 120; this.attackRange = 4.2; this.attackDelay = 1.7;
    this.loot = [['macro_shard', 1], ['protein', 4]];
    const m = rimMat(0x6a5a4a, 0xffe0b0, { opacity: 0.95, wobble: 0.05 });
    this.mat = m;
    const segs = [];
    for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(2.1 - Math.abs(i - 1.5) * 0.25, 24, 16), m); s.position.set(0, 2.4, 3 - i * 1.9); s.scale.set(1.05, 0.9, 0.85); this.group.add(s); segs.push(s); }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.2, 8, 16), rimMat(0x3a2a1a, 0xff9a6a)); mouth.position.set(0, 2.2, 5.1); this.group.add(mouth);
    this.legs = [];
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(1.6 * s, 1.4, 2.8 - i * 1.9); this.group.add(leg);
      const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1, 6, 10), m); l.position.y = -0.7; leg.add(l);
      for (let c = 0; c < 3; c++) { const cl = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 5), rimMat(0x222222, 0xffffff)); cl.position.set((c - 1) * 0.2, -1.6, 0.2); cl.rotation.x = 2.6; leg.add(cl); }
      this.legs.push({ leg, s, i });
    }
    this.registerFlash();
  }
  animate(dt) {
    this.mat.userData.time.value = G.time;
    this.legs.forEach(({ leg, s, i }) => { leg.rotation.x = Math.sin(G.time * 3 + i * 1.3 + (s > 0 ? Math.PI : 0)) * 0.5; });
    if (this.state === 'chase') ui.boss('TARDIGRADE — THE WATER BEAR', this.hp / this.maxHp);
  }
  die() { super.die(); ui.boss(null); unlock('waterbear'); ui.toast('🐻 The Water Bear is down! It dropped a <b>Macro Shard</b>!'); }
}

class GiantAmoeba extends Microbe {
  constructor() {
    super({ name: 'Amoeba Prime', hp: 700, radius: 6.5, height: 13, speed: 3.2, damage: 7 });
    this.isBoss = true;
    this.aggroRange = 30; this.leashRange = 140; this.attackRange = 7; this.attackDelay = 0.5;
    this.loot = [['macro_shard', 1], ['lipid', 5], ['protein', 3]];
    const m = rimMat(0x2a4a4a, 0x9affef, { opacity: 0.55, wobble: 1.4, emissive: 0.1 });
    this.mat = m;
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(6.5, 5), m); b.position.y = 6.5; this.group.add(b); this.blob = b;
    const nucleus = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), rimMat(0x4a2a6a, 0xff9aff, { emissive: 0.4 })); nucleus.position.set(1.5, 7, -1); this.group.add(nucleus);
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), new THREE.MeshBasicMaterial({ color: 0xfff0a0 }));
    shard.position.set(-1.5, 5.5, 1); this.group.add(shard); this.shard = shard;
    this.spawnT = 8;
    this.registerFlash();
  }
  animate(dt) {
    this.mat.userData.time.value = G.time;
    this.shard.rotation.y += dt * 2;
    this.blob.scale.set(1 + Math.sin(G.time * 0.9) * 0.08, 1 + Math.cos(G.time * 0.7) * 0.08, 1 + Math.sin(G.time * 1.1 + 1) * 0.08);
    if (this.state === 'chase') ui.boss('AMOEBA PRIME', this.hp / this.maxHp);
  }
  brain(dt, level, player) {
    super.brain(dt, level, player);
    if (this.state === 'chase') {
      // engulf: inside the amoeba you are slowed and digested
      const inside = this.body.pos.clone().add(V(0, 6.5, 0)).distanceTo(player.body.pos) < 7.5;
      if (inside) player.speedMul = 0.4; else player.speedMul = 1;
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = 12;
        for (let i = 0; i < 2; i++) { const b = new Bacterium(); b.place(this.body.pos.x + (Math.random() - 0.5) * 14, this.body.pos.y + 6, this.body.pos.z + (Math.random() - 0.5) * 14); b.aggro = true; level.scene.add(b.group); level.creatures.push(b); }
      }
    }
  }
  die() { super.die(); ui.boss(null); G.player.speedMul = 1; ui.toast('🧫 Amoeba Prime burst! A <b>Macro Shard</b> floats free!'); }
}

export function createMicro(story) {
  const preset = getPreset();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010208);
  scene.fog = new THREE.FogExp2(0x040818, 0.0065);
  const world = new World();
  world.gravity = 0; world.terminal = 99;
  world.bounds = 340;
  const level = { id: 'micro', scene, world, interactables: [], creatures: [], spawns: {}, music: 'micro', spheres: [], harvestables: [] };
  const rnd = mulberry32(4242);

  scene.add(new THREE.HemisphereLight(0x3a5aff, 0x100a20, 0.5));
  const glowLight = new THREE.PointLight(0x9ac8ff, 60, 25, 2); scene.add(glowLight);
  const key = new THREE.DirectionalLight(0xbfd0ff, 0.6); key.position.set(50, 100, -30); scene.add(key);

  // "Space": drifting plankton-stars, nebula clouds of dissolved stuff
  const N = Math.round(6000 * preset.particles);
  const sg = new THREE.BufferGeometry();
  const sp = new Float32Array(N * 3), sc = new Float32Array(N * 3);
  const palette = [new THREE.Color(0x9ac8ff), new THREE.Color(0xffd0f0), new THREE.Color(0xb0ffe0), new THREE.Color(0xffffff)];
  for (let i = 0; i < N; i++) {
    const r = 30 + Math.pow(rnd(), 0.6) * 520;
    const th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1);
    sp[i * 3] = r * Math.sin(ph) * Math.cos(th); sp[i * 3 + 1] = r * Math.cos(ph) * 0.7; sp[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    const c = palette[i % 4]; sc[i * 3] = c.r; sc[i * 3 + 1] = c.g; sc[i * 3 + 2] = c.b;
  }
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.2, vertexColors: true, map: TX.softDot('#ffffff', 'star'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  scene.add(stars);
  level.stars = stars;
  const nebCols = ['#3a2aff', '#ff2a9a', '#2affc8', '#8a4aff', '#2a8aff'];
  for (let i = 0; i < 16; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.softDot(nebCols[i % 5], 'neb' + i), transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
    const a = rnd() * Math.PI * 2, r = 250 + rnd() * 350;
    s.position.set(Math.cos(a) * r, (rnd() - 0.5) * 300, Math.sin(a) * r);
    s.scale.setScalar(250 + rnd() * 300);
    scene.add(s);
  }

  // Pollen grain "planet" and dust asteroids (solid spheres)
  const pollenM = rimMat(0x6a5a1a, 0xffe07a, { emissive: 0.08 });
  const addSphere = (c, r, mat, spikes = 0) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 4), mat); m.position.copy(c); scene.add(m);
    for (let i = 0; i < spikes; i++) { const dir = V(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(); const sp2 = new THREE.Mesh(new THREE.ConeGeometry(r * 0.08, r * 0.3, 6), mat); sp2.position.copy(c).addScaledVector(dir, r * 1.08); sp2.quaternion.setFromUnitVectors(V(0, 1, 0), dir); scene.add(sp2); }
    level.spheres.push({ c, r: r * 1.02 });
    return m;
  };
  addSphere(V(-120, 70, -30), 36, pollenM, 60);
  const dustM = rimMat(0x3a3a44, 0x9aa0c0, { emissive: 0.05 });
  for (let i = 0; i < 18; i++) addSphere(V((rnd() - 0.5) * 500, (rnd() - 0.5) * 200, (rnd() - 0.5) * 500), 3 + rnd() * 9, dustM);

  // The Growth Core at the centre (dormant until the shards return)
  const coreMat = rimMat(0x202030, 0x6a6aff, { emissive: 0.1 });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(10, 3), coreMat); scene.add(core);
  const rings = [0, 1, 2].map((i) => { const r = new THREE.Mesh(new THREE.TorusGeometry(15 + i * 3, 0.25, 8, 80), new THREE.MeshBasicMaterial({ color: 0x8a8aff, transparent: true, opacity: 0.5 })); r.rotation.set(rnd() * 3, rnd() * 3, 0); scene.add(r); return r; });
  const coreLight = new THREE.PointLight(0x8a8aff, 800, 120, 2); scene.add(coreLight);
  level.spheres.push({ c: V(0, 0, 0), r: 10.5 });
  level.core = { mesh: core, rings, light: coreLight, lit: 0 };

  // Cellulose fibre: a colossal twisted rope crossing the void (harvest cellulose from it)
  const celM = rimMat(0x2a5a2a, 0xa0ffa0, { emissive: 0.1 });
  const fibre = new THREE.CatmullRomCurve3([V(-260, -50, -170), V(-120, -20, -110), V(0, -30, -90), V(120, 10, -70), V(260, 40, -30)]);
  for (let s = 0; s < 3; s++) {
    const pts = [];
    for (let i = 0; i <= 120; i++) { const t = i / 120; const p = fibre.getPoint(t); const a = t * 40 + s * 2.1; pts.push(p.add(V(0, Math.sin(a) * 2.2, Math.cos(a) * 2.2))); }
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 1.6, 8), celM));
  }
  for (let i = 0; i <= 20; i++) level.harvestables.push({ kind: 'cellulose', pos: fibre.getPoint(i / 20), cd: 0 });

  // Diatom field: glass shells (harvest diatom glass)
  const glassM = rimMat(0x1a3a44, 0x9ff4ff, { opacity: 0.6, emissive: 0.1 });
  const diatomC = V(140, 30, 60);
  level.diatoms = [];
  for (let i = 0; i < 12; i++) {
    const g = new THREE.Group();
    const pos = diatomC.clone().add(V((rnd() - 0.5) * 70, (rnd() - 0.5) * 40, (rnd() - 0.5) * 70));
    g.position.copy(pos); g.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    const r = 3 + rnd() * 3;
    if (i % 2) { g.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, r * 0.35, 24), glassM)); for (let k = 0; k < 12; k++) { const rib = new THREE.Mesh(new THREE.BoxGeometry(0.15, r * 0.37, r), glassM); rib.rotation.y = (k / 12) * Math.PI; g.add(rib); } }
    else { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 12), glassM); b.scale.set(0.35, 0.3, 1.6); g.add(b); }
    scene.add(g);
    const d = { kind: 'diatom', pos, mesh: g, hits: 0, cd: 0 };
    level.diatoms.push(d);
    level.harvestables.push(d);
  }
  // Floating pickups: lipid droplets & ATP sparks
  level.pickups = [];
  const lipidM = new THREE.MeshPhysicalMaterial({ color: 0xffd060, roughness: 0.05, transparent: true, opacity: 0.6, clearcoat: 1, emissive: 0x302000 });
  const atpM = new THREE.MeshBasicMaterial({ color: 0x7afcff });
  const addPick = (kind, p) => {
    const m = kind === 'lipid' ? new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), lipidM) : new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), atpM);
    m.position.copy(p); scene.add(m);
    const pk = { kind, mesh: m, pos: p, taken: false, t: 0 };
    level.pickups.push(pk);
    level.interactables.push({ getPos: () => pk.pos, radius: 3, height: 3, label: kind === 'lipid' ? 'Collect lipid droplet' : 'Absorb ATP spark (+health)', can: () => !pk.taken, action: () => { pk.taken = true; m.visible = false; pk.t = 90; G.inventory.add(kind, kind === 'lipid' ? 2 : 1); } });
  };
  for (let i = 0; i < 20; i++) addPick('lipid', V((rnd() - 0.5) * 300, (rnd() - 0.5) * 120, (rnd() - 0.5) * 300));
  for (let i = 0; i < 26; i++) addPick('atp', V((rnd() - 0.5) * 300, (rnd() - 0.5) * 120, (rnd() - 0.5) * 300));
  // guaranteed starter materials near the spawn
  for (let i = 0; i < 4; i++) addPick('lipid', V(-10 + i * 6, 4, -100));

  // Macro shard #1 floats inside the diatom field
  const shardM = new THREE.MeshBasicMaterial({ color: 0xfff0a0 });
  const shard1 = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), shardM);
  shard1.position.copy(diatomC); scene.add(shard1);
  const shardHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.softDot('#fff0a0', 'shardHalo'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  shardHalo.scale.setScalar(8); shard1.add(shardHalo);
  level.shard1 = shard1;
  level.interactables.push({ getPos: () => shard1.position, radius: 4, height: 4, label: 'Take the Macro Shard', can: () => shard1.visible, action: () => { shard1.visible = false; G.inventory.add('macro_shard', 1); level.onShard(); } });
  level.interactables.push({ pos: V(0, 0, -12), getPos: () => V(0, 0, -13), radius: 6, height: 8, label: () => `Merge the Macro Shards (${G.inventory.count('macro_shard')}/3)`, can: () => G.inventory.count('macro_shard') >= 3, action: () => level.finale() });

  // ---- creatures
  const add = (c, p) => { c.place(p.x, p.y, p.z); scene.add(c.group); level.creatures.push(c); return c; };
  for (let i = 0; i < 6; i++) add(new Bacterium(), diatomC.clone().add(V((rnd() - 0.5) * 40, (rnd() - 0.5) * 20, (rnd() - 0.5) * 40)));
  for (let i = 0; i < 5; i++) add(new Bacterium(), V((rnd() - 0.5) * 260, (rnd() - 0.5) * 80, (rnd() - 0.2) * 260));
  for (let i = 0; i < 5; i++) add(new Phage(), V((rnd() - 0.5) * 260, (rnd() - 0.5) * 100, (rnd() - 0.5) * 260));
  for (let i = 0; i < 3; i++) add(new Paramecium(), V((rnd() - 0.5) * 220, (rnd() - 0.5) * 60, 40 + rnd() * 150));
  for (let i = 0; i < 2; i++) add(new Rotifer(), V(-60 + i * 120, -40, 120));
  level.tardigrade = add(new Tardigrade(), V(-150, -20, 90));
  level.amoeba = add(new GiantAmoeba(), V(20, 60, 200));
  level.tardigrade.onKilledByPlayer = () => level.onShard(true);
  level.amoeba.onKilledByPlayer = () => level.onShard(true);

  level.spawns.start = { pos: V(0, 0, -110), yaw: 0 };

  // ---- helpers
  level.pushOut = (body, r) => {
    for (const s of level.spheres) {
      const c = body.pos.clone().add(V(0, body.height / 2, 0));
      const d = c.distanceTo(s.c);
      const R = s.r + r;
      if (d < R) {
        const n = c.sub(s.c).normalize();
        body.pos.addScaledVector(n, R - d);
        const vn = body.vel.dot(n); if (vn < 0) body.vel.addScaledVector(n, -vn);
      }
    }
  };
  level.lineOfSight = () => true;
  level.harvest = (point, tool, dmg) => {
    for (const h of level.harvestables) {
      if (h.cd > G.time) continue;
      const r = h.kind === 'diatom' ? 6.5 : 4;
      if (h.pos.distanceTo(point) < r || h.pos.distanceTo(G.player.body.pos.clone().add(V(0, 1, 0))) < r) {
        h.cd = G.time + 0.9;
        if (h.kind === 'cellulose') { G.inventory.add('cellulose', 1); sfx('crunch', { vol: 0.5 }); return true; }
        if (h.kind === 'diatom' && h.mesh.visible) {
          h.hits++; G.inventory.add('diatom_glass', 1); sfx('mine');
          h.mesh.scale.multiplyScalar(0.85);
          if (h.hits >= 4) { h.mesh.visible = false; h.cd = Infinity; }
          return true;
        }
      }
    }
    return false;
  };
  level.onCraft = (id) => { if (['diatom_blade', 'whip', 'blaster'].includes(id)) level.checkObjectives(); };
  level.onShard = () => {
    const n = G.inventory.count('macro_shard');
    ui.toast(`✴️ Macro Shard <b>${n}/3</b>`, 3500);
    sfx('achievement');
    level.core.lit = n;
    level.checkObjectives();
  };
  level.checkObjectives = () => {
    const n = G.inventory.count('macro_shard');
    const armed = ['diatom_blade', 'whip', 'blaster'].some((id) => G.inventory.count(id) > 0);
    let text;
    if (!armed && n === 0) text = 'Hit the giant cellulose fibre and the glass diatoms for materials, then craft a germ-size weapon (Tab)';
    else if (n < 3) text = `Find the 3 Macro Shards (${n}/3): one in the diatom field, one on the Water Bear, one inside the giant amoeba`;
    else text = 'Bring all 3 shards to the Growth Core in the centre';
    if (text !== level.objText) { level.objText = text; story.objective(text); }
  };

  level.update = (dt, t) => {
    stars.rotation.y += dt * 0.004;
    core.rotation.y += dt * 0.2;
    rings.forEach((r, i) => { r.rotation.x += dt * (0.2 + i * 0.1); r.rotation.y += dt * 0.13; });
    const lit = level.core.lit;
    coreMat.emissiveIntensity = 0.1 + lit * 0.4 + Math.sin(t * 2) * 0.05 * (lit + 1);
    coreLight.intensity = 500 + lit * 1200 + Math.sin(t * 3) * 150;
    shard1.rotation.y += dt * 1.5; shard1.position.y = diatomC.y + Math.sin(t * 1.5);
    for (const p of level.pickups) {
      if (p.taken) { p.t -= dt; if (p.t <= 0) { p.taken = false; p.mesh.visible = true; } }
      else { p.mesh.rotation.y += dt; p.mesh.position.y = p.pos.y + Math.sin(t + p.pos.x) * 0.3; }
    }
    if (G.player && G.level === level) {
      glowLight.position.copy(G.player.body.pos).add(V(0, 3, 0));
      level.pushOut(G.player.body, G.player.body.radius);
      if (G.mode === 'play') level.checkObjectives();
    }
    // drifting "Brownian motion": everything jitters a little
    if (G.player && G.mode === 'play' && G.player.mode === 'swim') G.player.body.vel.add(V(Math.sin(t * 1.3), Math.cos(t * 0.7), Math.sin(t * 0.9 + 1)).multiplyScalar(dt * 0.4));
  };

  level.arrive = async () => {
    const P = G.player;
    G.post.fx.pixelate = 0; G.post.fx.scanlines = 0; G.post.fx.heat = 0;
    const lost = G.inventory.stashForMicro();
    story.placePlayer('start');
    P.mode = 'locked';
    playMusic('micro');
    setReverb(0.6);
    level.hum = loop('micro', { vol: 0.6 });
    story.checkpoint('micro', 'start');
    G.mode = 'cutscene';
    await ui.fade(0, 1500);
    await G.director.play(async (c) => {
      const p = P.body.pos.clone();
      c.cut(p.clone().add(V(3, 1.5, 4)), p.clone().add(V(0, 1, 0)), 50);
      G.post.dofOverride = true; G.post.focus = 5; G.post.aperture = 0.6;
      c.move(p.clone().add(V(-4, 3, -6)), p.clone().add(V(0, 1, 0)), 6);
      await c.say('Where... am I? It\'s dark. It looks like... space.', { speaker: 'You', pitch: 0.95 });
      await c.say('No. I\'m so small that I\'m smaller than a GERM. We can\'t see them... so they can\'t see us. Until now.', { speaker: 'You' });
      c.cut(p.clone().add(V(0, 4, -8)), V(0, 0, 0), 55);
      G.post.focus = 110; G.post.aperture = 0.25;
      await c.say('That glowing thing in the middle... it feels like the thing that shrank me. Only bigger. Much bigger.', { speaker: 'You' });
      if (lost) await c.say('And my weapons... they\'re gone. They\'re way too huge for me to even hold now.', { speaker: 'You' });
    });
    G.post.dofOverride = null;
    P.mode = 'swim';
    story.beginPlay();
    ui.chapterCard('CHAPTER 6', 'GERM SIZE');
    ui.toast('🫧 You\'re floating! <b>WASD</b> swim · <b>Space</b> up · <b>C</b> down · <b>Shift</b> fast', 7000);
    level.objText = null;
    level.checkObjectives();
  };
  level.respawn = () => { story.placePlayer('start'); G.player.mode = 'swim'; G.player.speedMul = 1; playMusic('micro'); level.checkObjectives(); };

  level.finale = async () => {
    const P = G.player, d = G.director;
    P.mode = 'locked';
    G.mode = 'cutscene';
    G.inventory.remove('macro_shard', 3);
    playMusic('finale');
    sfx('grow');
    await d.play(async (c) => {
      c.cut(V(0, 6, -40), V(0, 0, 0), 55);
      G.post.dofOverride = true; G.post.focus = 40; G.post.aperture = 0.3;
      await c.say('Three shards... here goes EVERYTHING.', { speaker: 'You' });
      c.tween(5, (k) => { level.core.lit = 3 + k * 10; core.scale.setScalar(1 + k * 0.6); G.post.fx.aberration = 0.0015 + k * 0.02; }, 'in');
      c.move(V(0, 3, -22), V(0, 0, 0), 5, { e: 'in' });
      await c.say('It\'s working! Everything is shrinking away — no — I\'m GROWING!', { speaker: 'You', pitch: 1.25, rate: 1.15 });
      c.tween(3, (k) => { G.camera.fov = 55 + k * 70; G.camera.updateProjectionMatrix(); stars.scale.setScalar(1 - k * 0.95); }, 'in');
      await c.wait(2.4);
      document.getElementById('fade').style.background = '#fff';
      await ui.fade(1, 900);
    }, { skippable: false });
    G.post.fx.aberration = 0.0015;
    G.post.dofOverride = null;
    if (level.hum) level.hum.stop();
    await story.finale();
  };

  level.post = { bloom: 0.9, threshold: 0.35, aperture: 0.5, exposure: 1.1 };
  level.onExit = () => { if (level.hum) level.hum.stop(); ui.boss(null); G.player.speedMul = 1; };
  return level;
}
