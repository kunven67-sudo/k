// Real ants. They live in nests at fixed places in the land and walk trails out to food and back (~3 cm/s).
// They do NOT know where you are: an ant only notices you when its antennae touch you or you walk onto its trail / nest.
// - you are small (up to ~3x an ant): it grabs and bites, every couple of seconds, and gives up after a while or if you get away
// - you are full size and stand on a nest: the colony swarms out and climbs your legs and bites (stings, not deadly)
// - F kicks the ant in front of you; big you can step on them
import * as THREE from 'three';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

const hash = (a, b, s) => { let h = (a * 374761393 + b * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; h ^= h >>> 16; return (h >>> 0) / 4294967296; };

export class Ants {
  constructor(macro, gltf, land, seed, hooks) {
    this.land = land; this.seed = seed; this.hooks = hooks; this.len = 0.005; // a worker ant: 5 mm
    const src = gltf.scene, box = new THREE.Box3().setFromObject(src), size = box.getSize(new THREE.Vector3());
    const s = this.len / Math.max(size.x, size.z);
    const mat = new THREE.MeshPhysicalMaterial({ color: 0x1b120d, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.25, sheen: 0.3, sheenColor: new THREE.Color(0x4a2a18) });
    src.traverse(o => { if (o.isMesh) { o.material = mat; o.castShadow = true; o.frustumCulled = false; } });
    this.pool = [];
    for (let i = 0; i < 16; i++) {
      const root = new THREE.Group(), m = skClone(src); m.scale.setScalar(s); m.position.y = -box.min.y * s; if (size.x > size.z) m.rotation.y = -Math.PI / 2; root.add(m);
      const mix = new THREE.AnimationMixer(m), A = {}; for (const c of gltf.animations) A[c.name] = mix.clipAction(c); A.walk?.play();
      root.visible = false; macro.add(root);
      this.pool.push({ root, mix, A, used: false, x: 0, z: 0, yaw: 0 });
    }
  }
  // nests: one chance per 5 m square, only where there's soil (not bare rock)
  nestsNear(x, z, r) {
    const out = [], C = 5, s = this.seed;
    for (let i = Math.floor((x - r) / C); i <= Math.floor((x + r) / C); i++) for (let j = Math.floor((z - r) / C); j <= Math.floor((z + r) / C); j++) {
      if (hash(i, j, s) > 0.45) continue;
      const nx = (i + 0.2 + hash(i, j, s + 1) * 0.6) * C, nz = (j + 0.2 + hash(i, j, s + 2) * 0.6) * C;
      if (this.land.cover(nx, nz)[0] > 0.45) continue;
      out.push({ id: i * 7919 + j, x: nx, z: nz, trails: [0, 1, 2].map(t => ({ a: hash(i, j, s + 10 + t) * 6.283, len: 0.8 + hash(i, j, s + 20 + t) * 2.2 })) });
    }
    return out;
  }
  // Y = { P, k, body, moving, dead } ; me in meters. ground(x,z) -> y
  update(dt, Y, ground) {
    const k = Y.k, me = Y.P, you = 1.8 * k, H = this.hooks;
    const view = Math.min(6, Math.max(0.12, you * 30));
    const on = !Y.deep && k > 2e-5;
    if (!on) { for (const a of this.pool) { a.root.visible = false; a.used = false; } return; }
    const nests = this.nestsNear(me.x, me.z, view + 3).sort((p, q) => Math.hypot(p.x - me.x, p.z - me.z) - Math.hypot(q.x - me.x, q.z - me.z)); // closest nests get their ants first
    // give every nearby trail its ants (same ants come back: their spot on the trail is from the clock, not random)
    const slots = [];
    for (const n of nests) for (let t = 0; t < 3; t++) for (let q = 0; q < 2; q++) slots.push({ n, t, q });
    let ai = 0;
    for (const sl of slots) {
      if (ai >= this.pool.length) break;
      const tr = sl.n.trails[sl.t], key = sl.n.id * 10 + sl.t * 2 + sl.q;
      const a = this.pool[ai++];
      if (a.key !== key) Object.assign(a, { key, mode: 'trail', grip: 0, calm: 0, biteT: 1 + Math.random(), climb: null, hp: 1, x: sl.n.x, z: sl.n.z });
      a.used = true; a.nest = sl.n; a.tr = tr; a.q = sl.q;
    }
    for (; ai < this.pool.length; ai++) { this.pool[ai].used = false; this.pool[ai].root.visible = false; this.pool[ai].key = null; }
    const onNest = nests.find(n => Math.hypot(n.x - me.x, n.z - me.z) < 0.3);
    let attackers = 0;
    for (const a of this.pool) {
      if (!a.used) continue;
      if (a.hp <= 0) { a.deadT = (a.deadT || 0) + dt; a.root.visible = a.deadT < 20; a.root.position.set(a.x - Y.O.x, ground(a.x, a.z) - Y.O.y, a.z - Y.O.z); a.root.scale.set(1, 0.3, 1); continue; }
      a.root.scale.set(1, 1, 1); a.calm = Math.max(0, a.calm - dt);
      const dx = me.x - a.x, dz = me.z - a.z, d = Math.hypot(dx, dz);
      const touch = this.len * 1.4 + you * 0.3; // antennae reach + your body
      let tx, tz, speed = 0.03;
      if (a.mode === 'trail') {
        // walk out along the trail to the food and back, wiggling the way real ants do
        const T = (performance.now() / 1000 / (a.tr.len / 0.03) + a.q * 0.5 + (a.key % 7) * 0.13) % 2, out = T < 1, f = out ? T : 2 - T;
        const wob = Math.sin(f * 40 + a.key) * 0.03 * a.tr.len;
        tx = a.nest.x + Math.cos(a.tr.a) * a.tr.len * f - Math.sin(a.tr.a) * wob; tz = a.nest.z + Math.sin(a.tr.a) * a.tr.len * f + Math.cos(a.tr.a) * wob;
        speed = 0.05; // catch up to its spot on the trail
        // notice you only by touch (or when you stomp on the nest)
        if (!Y.body.dead && a.calm <= 0 && (d < touch || (onNest && Math.hypot(a.nest.x - onNest.x, a.nest.z - onNest.z) < 0.01 && d < 0.6))) {
          a.mode = you < this.len * 3 ? 'attack' : you > this.len * 40 ? 'climb' : 'trail'; a.modeT = 0;
          if (a.mode === 'attack') H.message('An ant touched you with its antennae. It knows you are food now.', 'antnotice');
          if (a.mode === 'climb') H.message('You are standing on an ant nest. They are coming up your legs.', 'antclimb');
        }
      }
      if (a.mode === 'attack') {
        a.modeT += dt; attackers++;
        tx = me.x; tz = me.z; speed = 0.045;
        // they track you by smell + touch only up close; get away or wait it out and they give up
        if (d > this.len * 10 || a.modeT > 14 || you > this.len * 4 || Y.body.dead || attackers > 3) { a.mode = 'trail'; a.calm = 18; }
        else if (d < this.len * 0.6 + you * 0.3) {
          speed = 0; a.biteT -= dt; H.hold(0.35);
          if (a.biteT <= 0) {
            a.biteT = 1.6 + Math.random() * 1.4; a.A.bite?.reset().play(); setTimeout(() => a.A.bite?.fadeOut(0.2), 350);
            const rel = Math.min(25, Math.max(0.2, this.len / you));
            const parts = rel > 3 ? ['legL', 'legR', 'armL', 'armR', 'legL', 'legR', 'torso', 'head'] : ['legL', 'legR', 'armL', 'armR'];
            const p = parts[Math.floor(Math.random() * parts.length)], spray = Math.random() < 0.2;
            H.hit(p, spray ? rel * 2.5 : rel * 5, spray ? 'burn' : 'cut', spray ? 'Sprayed with formic acid by an ant' : 'Bitten by an ant', Math.min(2, rel * 0.3), Math.atan2(-dx, -dz), spray);
          }
        }
      }
      if (a.mode === 'climb') {
        a.modeT += dt;
        if (!a.climb) { tx = me.x; tz = me.z; speed = 0.04; if (d < you * 0.12) a.climb = { side: Math.random() < 0.5 ? 'L' : 'R', h: 0, off: Math.random() * 6.28 }; }
        else {
          // crawling up your leg
          a.climb.h = Math.min(0.5, a.climb.h + dt * 0.012 / (you * 0.1));
          const p = H.legPoint(a.climb.side, a.climb.h, a.climb.off); a.x = p.x; a.z = p.z;
          a.root.visible = true; a.root.position.set(p.x - Y.O.x, p.y - Y.O.y, p.z - Y.O.z); a.root.rotation.set(-Math.PI / 2, 0, a.climb.off); a.mix.update(dt);
          a.biteT -= dt;
          if (a.biteT <= 0) { a.biteT = 2 + Math.random() * 2.5; H.hit(a.climb.side === 'L' ? 'legL' : 'legR', 0.5 + Math.random() * 0.5, 'cut', 'Ant bites', 0.05, 0, false); H.message('Ant bites. They sting like hell, but they can\'t really hurt something your size. Run or jump to shake them off.', 'antsting'); }
          // running or jumping shakes them off
          if ((Y.speedBH > 1.8 || Y.inAir) && Math.random() < dt * 1.5) { a.climb = null; a.mode = 'trail'; a.calm = 25; }
          if (a.modeT > 40) { a.climb = null; a.mode = 'trail'; a.calm = 25; }
          continue;
        }
      }
      // steer + walk
      const want = Math.atan2(tx - a.x, tz - a.z), dist = Math.hypot(tx - a.x, tz - a.z);
      const dy = ((want - a.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; a.yaw += dy * Math.min(1, dt * 8);
      const v = Math.min(speed, dist / Math.max(dt, 1e-3));
      a.x += Math.sin(a.yaw) * v * dt; a.z += Math.cos(a.yaw) * v * dt;
      if (a.A.walk) a.A.walk.timeScale = Math.max(0.15, v / 0.03 * 1.4);
      // big you can step on them
      if (you > this.len * 12 && d < you * 0.08 && Y.moving) { a.hp = 0; a.deadT = 0; H.squash(); }
      a.mix.update(dt); a.root.visible = true; a.root.rotation.set(0, a.yaw, 0);
      a.root.position.set(a.x - Y.O.x, ground(a.x, a.z) - Y.O.y, a.z - Y.O.z);
    }
  }
  // F: kick the ant closest in front of you
  kick(Y, facing) {
    const you = 1.8 * Y.k; let best = null, bd = Infinity;
    for (const a of this.pool) { if (!a.used || a.hp <= 0) continue; const d = Math.hypot(a.x - Y.P.x, a.z - Y.P.z); if (d < bd) { bd = d; best = a; } }
    if (!best || bd > this.len * 1.2 + you * 0.6) return false;
    const rel = you / this.len; // a kick from something your size vs. an ant
    best.x += Math.sin(facing) * (this.len * 2 + you); best.z += Math.cos(facing) * (this.len * 2 + you);
    if (Math.random() < Math.min(0.9, rel * 0.25)) { best.hp = 0; best.deadT = 0; return 'killed'; }
    best.mode = 'trail'; best.calm = 6 + rel * 10; return 'kicked';
  }
}
