// Things that are alive or moving around you, at every size:
// - ants (real CC0 model, walk + bite): wander, smell you when you're small, chase + bite (mandibles cut, formic acid burns)
// - bacteria that really swim (run-and-tumble, like E. coli + soil Bacillus), bump you, and get into open wounds
// - bacteriophages (viruses) that drift and latch onto bacteria to infect them (they hunt bacteria, not you)
// - wind sway for plants, Brownian jiggle for grains (shader patches)
import * as THREE from 'three';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

export const LIFE_T = { value: 0 };

// shader: things shake from molecules hitting them (Brownian motion), grains just a little, bacteria wobble + wave their flagella
export function jiggle(mat, amp, swim = false) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    sh.uniforms.uT = LIFE_T;
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  float hh = fract(sin(dot(instanceMatrix[3].xyz * 1e3, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  transformed += vec3(sin(uT * (3.1 + hh * 4.0) + hh * 40.0), sin(uT * (2.3 + hh * 3.0) + hh * 17.0) * 0.6, cos(uT * (2.7 + hh * 5.0) + hh * 9.0)) * ${amp.toFixed(4)};
  ${swim ? 'transformed.z += sin(transformed.x * 2.5 - uT * 18.0 + hh * 6.0) * 0.12 * smoothstep(1.2, 2.2, abs(transformed.x));' : ''}
#endif`);
  };
  mat.customProgramCacheKey = () => 'jig' + amp + swim;
  return mat;
}
// shader: plants bend in the wind, more at the top, each one on its own rhythm
export function sway(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    sh.uniforms.uT = LIFE_T;
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  float sw = fract(sin(dot(instanceMatrix[3].xyz * 7.0, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  float bend = max(position.y, 0.0); bend *= bend;
  transformed.x += (sin(uT * 1.7 + sw * 20.0) * 0.6 + sin(uT * 4.1 + sw * 7.0) * 0.25) * bend * 0.09;
  transformed.z += cos(uT * 1.3 + sw * 13.0) * bend * 0.06;
#endif`);
  };
  mat.customProgramCacheKey = () => 'sway' + (prev ? 'p' : '');
}

export class Life {
  constructor(macro, antGltf, bacteriumGeo, phageGeo, hooks) {
    this.macro = macro; this.hooks = hooks; this.t = 0;
    // ---- ants: a real worker ant is ~5 mm long ----
    const src = antGltf.scene; const box = new THREE.Box3().setFromObject(src), size = new THREE.Vector3(); box.getSize(size);
    this.antLen = 0.005; const s = this.antLen / Math.max(size.x, size.z);
    src.traverse(o => { if (o.isMesh) { o.material = new THREE.MeshPhysicalMaterial({ color: 0x1b120d, roughness: 0.32, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.25, sheen: 0.3, sheenColor: new THREE.Color(0x4a2a18) }); o.castShadow = true; o.frustumCulled = false; } });
    this.ants = [];
    for (let i = 0; i < 0; i++) { // old ants: replaced by ants.js
      const root = new THREE.Group(), m = skClone(src); m.scale.setScalar(s); m.position.y = -box.min.y * s; root.add(m);
      // the model faces +Y or +Z depending on export: face it along +Z
      if (size.x > size.z) m.rotation.y = -Math.PI / 2;
      const mix = new THREE.AnimationMixer(m), A = {};
      for (const c of antGltf.animations) A[c.name] = mix.clipAction(c);
      A.walk?.play();
      root.visible = false; macro.add(root);
      this.ants.push({ root, mix, A, x: 0, z: 0, y: 0, yaw: Math.random() * 6.28, sp: 0, alive: false, hp: 1, biteT: 0, mood: 'wander', turnT: 0 });
    }
    // ---- swimming bacteria + phages (real meshes, few, only near you) ----
    const bm = jiggle(new THREE.MeshStandardMaterial({ color: 0xa9bb88, roughness: 0.35, transparent: true, opacity: 0.92 }), 0.02, true);
    this.bugs = []; for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(bacteriumGeo(i % 4 + 1, true), bm); m.visible = false; macro.add(m); this.bugs.push({ m, x: 0, y: 0, z: 0, dir: new THREE.Vector3(1, 0, 0), run: 0, phages: 0, infected: 0 }); }
    const vm = new THREE.MeshStandardMaterial({ color: 0xc9ccd2, roughness: 0.3, metalness: 0.2 });
    this.phages = []; for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(phageGeo(), vm); m.visible = false; macro.add(m); this.phages.push({ m, x: 0, y: 0, z: 0, on: null, off: new THREE.Vector3() }); }
  }
  // ground(x,z) -> y ; you = {P, k, O, body, avatar}
  update(dt, Y, ground) {
    this.t += dt; LIFE_T.value = this.t;
    const k = Y.k, me = Y.P, youLen = 1.8 * k;
    const place = (o, x, y, z) => o.position.set(x - Y.O.x, y - Y.O.y, z - Y.O.z);
    // ===== ants: around you when you're between ~a person and a dust mite =====
    const antsOn = false;
    for (const a of this.ants) {
      if (!antsOn) { a.root.visible = false; a.alive = false; continue; }
      const dx = a.x - me.x, dz = a.z - me.z, d = Math.hypot(dx, dz);
      const range = Math.max(0.08, youLen * 6);
      if (!a.alive || d > range * 1.6) { // a new ant walks in at the edge of what you can see
        const ang = Math.random() * 6.28, r = range * (0.5 + Math.random() * 0.9);
        Object.assign(a, { x: me.x + Math.cos(ang) * r, z: me.z + Math.sin(ang) * r, yaw: Math.random() * 6.28, alive: true, hp: 1, mood: 'wander', biteT: 0 });
      }
      if (a.hp <= 0) { a.root.visible = true; a.mix.update(0); place(a.root, a.x, ground(a.x, a.z), a.z); a.root.scale.y = 0.35; continue; }
      a.root.scale.y = 1;
      // smell + see you: ants go for anything smaller than ~4x their size that moves near them
      const big = youLen / this.antLen;
      if (big < 4 && d < this.antLen * 14 && !Y.body.dead) a.mood = 'hunt'; else if (a.mood === 'hunt' && (d > this.antLen * 22 || big >= 4)) a.mood = 'wander';
      let want = a.yaw, speed = 0.03; // real ants walk ~3 cm/s
      if (a.mood === 'hunt') { want = Math.atan2(-dx, -dz); speed = 0.045; }
      else { a.turnT -= dt; if (a.turnT <= 0) { a.turnT = 0.5 + Math.random() * 2; a.wander = (Math.random() - 0.5) * 2.4; } want = a.yaw + a.wander * dt * 3; }
      let dy = ((want - a.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; a.yaw += dy * Math.min(1, dt * 6);
      const reach = this.antLen * 0.55 + youLen * 0.25;
      if (a.mood === 'hunt' && d < reach) {
        speed = 0; a.biteT -= dt;
        if (a.biteT <= 0) {
          a.biteT = 0.9 + Math.random() * 0.6; a.A.bite?.reset().play(); setTimeout(() => a.A.bite?.fadeOut(0.2), 350);
          // mandible force is the same for the ant; what it does depends on how big you are next to it
          const rel = Math.min(25, Math.max(0.15, this.antLen / youLen));
          const parts = ['legL', 'legR', 'legL', 'legR', 'armL', 'armR', 'torso', 'head'], p = parts[Math.floor(Math.random() * (rel > 3 ? 8 : 6))];
          const spray = Math.random() < 0.3;
          this.hooks.hit(p, spray ? rel * 3.2 : rel * 4.5, spray ? 'burn' : 'cut', spray ? 'Sprayed with formic acid by an ant' : 'Bitten by an ant', Math.min(2.5, rel * 0.35), Math.atan2(dx, dz), spray);
        }
      }
      a.sp += (speed - a.sp) * Math.min(1, dt * 8);
      a.x += Math.sin(a.yaw) * a.sp * dt; a.z += Math.cos(a.yaw) * a.sp * dt;
      // you can squash ants when you're big enough and step on them
      if (big > 12 && d < youLen * 0.12 && Y.moving) { a.hp = 0; this.hooks.squash(); }
      a.A.walk && (a.A.walk.timeScale = a.sp / 0.03 * 1.4);
      a.mix.update(dt); a.root.visible = true; place(a.root, a.x, ground(a.x, a.z), a.z); a.root.rotation.y = a.yaw;
    }
    // ===== swimming bacteria (1 - 4 um): run 1 s, tumble, run again; real speed ~30 body lengths/s =====
    const bugsOn = k < 3e-5 && k > 4e-8 && !Y.deep, bugR = Math.max(2e-5, youLen * 9);
    for (const b of this.bugs) {
      if (!bugsOn) { b.m.visible = false; b.live = false; continue; }
      if (!b.live || Math.hypot(b.x - me.x, b.z - me.z) > bugR * 1.5) {
        const ang = Math.random() * 6.28, r = bugR * (0.3 + Math.random() * 0.7);
        Object.assign(b, { x: me.x + Math.cos(ang) * r, z: me.z + Math.sin(ang) * r, y: me.y + 1e-6 + Math.random() * youLen * 3, live: true, run: Math.random(), infected: 0, phages: 0 });
        b.dir.set(Math.random() - 0.5, (Math.random() - 0.5) * 0.3, Math.random() - 0.5).normalize();
      }
      b.run -= dt;
      if (b.run <= 0) { b.run = 0.4 + Math.random() * 1.4; b.dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 3).add(new THREE.Vector3(0, (Math.random() - 0.5) * 0.4, 0)).normalize(); }
      const v = b.infected > 0 ? 3e-6 : 2.5e-5; // an infected cell slows down (the virus is taking over)
      b.x += b.dir.x * v * dt; b.z += b.dir.z * v * dt; b.y = Math.max(ground(b.x, b.z) + 0.6e-6, b.y + b.dir.y * v * dt);
      if (b.infected > 0) { b.infected += dt; if (b.infected > 14) { b.live = false; this.hooks.message?.('That bacterium just burst open. Hundreds of new viruses came out of it.', 'burst'); } }
      // it bumps into you (bacteria don't bite, but at your size they shove you around)
      const dd = Math.hypot(b.x - me.x, b.y - (me.y + youLen * 0.5), b.z - me.z);
      if (dd < Math.max(youLen * 0.8, 2.5e-6)) { this.hooks.bump(b.dir, Math.min(1.5, 2e-6 / youLen)); b.dir.negate(); if (Y.body.bleeding > 0.02) this.hooks.infect(); }
      b.m.visible = true; place(b.m, b.x, b.y, b.z); b.m.scale.setScalar(1e-6); b.m.lookAt(b.m.position.clone().add(b.dir)); b.m.rotateY(Math.PI / 2);
    }
    // ===== phages: drift, find a bacterium, land on it and inject =====
    const phOn = k < 2e-6 && k > 4e-8 && !Y.deep;
    for (const p of this.phages) {
      if (!phOn) { p.m.visible = false; p.live = false; continue; }
      if (!p.live || (!p.on && Math.hypot(p.x - me.x, p.z - me.z) > bugR)) { const ang = Math.random() * 6.28, r = bugR * 0.15 * (0.3 + Math.random()); Object.assign(p, { x: me.x + Math.cos(ang) * r, z: me.z + Math.sin(ang) * r, y: me.y + Math.random() * youLen * 2, live: true, on: null }); }
      if (p.on && p.on.live) { p.x = p.on.x + p.off.x; p.y = p.on.y + p.off.y; p.z = p.on.z + p.off.z; }
      else {
        p.on = null; const j = 1.2e-6; p.x += (Math.random() - 0.5) * j * dt * 8; p.y += (Math.random() - 0.5) * j * dt * 8; p.z += (Math.random() - 0.5) * j * dt * 8;
        for (const b of this.bugs) if (b.live && Math.hypot(b.x - p.x, b.y - p.y, b.z - p.z) < 1.6e-6) { p.on = b; p.off.set(p.x - b.x, p.y - b.y, p.z - b.z).setLength(0.5e-6); b.phages++; if (!b.infected) b.infected = 0.01; break; }
        if (!p.on) for (const b of this.bugs) if (b.live) { const dd = Math.hypot(b.x - p.x, b.y - p.y, b.z - p.z); if (dd < 6e-6) { p.x += (b.x - p.x) / dd * 1.5e-6 * dt; p.y += (b.y - p.y) / dd * 1.5e-6 * dt; p.z += (b.z - p.z) / dd * 1.5e-6 * dt; } }
      }
      p.m.visible = true; place(p.m, p.x, p.y, p.z); p.m.scale.setScalar(1e-7);
    }
  }
}
