// Shared machinery for the worlds past the city: planets you can stand on (analytic spheres), things to eat
// (Body = same interface as the bugs, so biting, webbing, wrapping and feeding all just work), glowing dots +
// name labels so you can find things that are too far to see, cruise flight, landing on planets, star heat,
// eating huge bodies one bite-sized chunk at a time.
import * as THREE from 'three';
import { CollisionWorld } from '../core/collide.js';
import { clamp, rand, sizeText } from '../core/util.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
let BID = 1;

// game mass of something L metres across (density 1 = same as your body)
export const massOf = (Lm, density = 1) => 150 * Lm * Lm * Lm * density;

// ------------------------------------------------------------------ walkable spheres
export class SphereSet {
  constructor() { this.list = []; }
  add(b) { this.list.push(b); }
  remove(b) { const i = this.list.indexOf(b); if (i >= 0) this.list.splice(i, 1); }
  probe(o, d, far, size) {
    let best = null;
    for (const b of this.list) {
      if (!b.walkable || b.state === 'eaten') continue;
      const r = b.L * 0.5; if (size > r * 1.3) continue;
      _v.subVectors(o, b.pos);
      const bb = _v.dot(d), cc = _v.lengthSq() - r * r, disc = bb * bb - cc;
      if (disc < 0) continue;
      const sq = Math.sqrt(disc);
      let t = -bb - sq; if (t < 0) t = -bb + sq;
      if (t < 0 || t > far || (best && t >= best.distance)) continue;
      const p = o.clone().addScaledVector(d, t);
      best = { point: p, normal: p.clone().sub(b.pos).normalize(), distance: t, body: b, tag: b.kind };
    }
    return best;
  }
  closest(p, maxD, size) {
    let best = null;
    for (const b of this.list) {
      if (!b.walkable || b.state === 'eaten') continue;
      const r = b.L * 0.5; if (size > r * 1.3) continue;
      _v.subVectors(p, b.pos); const dl = _v.length(); if (dl < 1e-12) continue;
      const dist = Math.abs(dl - r);
      if (dist > maxD || (best && dist >= best.distance)) continue;
      const n = _v.clone().divideScalar(dl);
      best = { point: b.pos.clone().addScaledVector(n, r), normal: n, distance: dist, body: b };
    }
    return best;
  }
}

// ------------------------------------------------------------------ something you can eat
// def: { kind, name, latin, fact, passive (doesn't fight), walk (you can stand on it when it's big enough),
//        chunk (eaten in bites), burn (star: hurts you close up until webbed), density, power, color, glow }
export class Body {
  constructor(sys, def, pos, L, opts = {}) {
    this.sys = sys; this.id = BID++;
    this.kind = def.kind; this.def = def;
    this.L = L;
    this.mass = opts.mass ?? massOf(L * sys.unit, def.density ?? 1);
    this.hp = this.maxHp = opts.hp ?? (def.hp ?? 100);
    this.pos = pos.clone(); this.up = new THREE.Vector3(0, 1, 0); this.fwd = new THREE.Vector3(1, 0, 0);
    this.vel = new THREE.Vector3();
    this.state = 'idle'; this.mode = 'idle';
    this.stuck = 0; this.wrapped = false; this.venom = 0; this.eatenFrac = 0;
    this.walkable = !!def.walk; this.t = rand(0, 100);
    this.orbit = opts.orbit || null;      // { center: Body|Vector3, r, w (rad/s), a (angle), tilt }
    this.spin = opts.spin ?? 0.02;
    this.model = { root: opts.mesh || new THREE.Group(), anim() {} };
    this.root = new THREE.Group(); this.root.add(this.model.root);
    this.root.scale.setScalar(L);
    this.root.position.copy(this.pos);
    sys.scene.add(this.root);
    this.dotColor = new THREE.Color(def.color ?? 0xffffff);
    this.dotBright = def.glow ?? 0.6;
    this.update0 = opts.update || null;
  }
  get alive() { return this.state !== 'dead' && this.state !== 'eaten'; }
  get helpless() {
    if (this.wrapped || this.state === 'dead' || this.state === 'paralyzed') return true;
    if (this.def.burn) return this.stuck > 0;          // a star has to be smothered in silk first
    if (this.def.passive) return true;                 // planets, moons, rocks don't fight back
    return this.stuck > 0;
  }
  get R() { return this.L * 0.5; }
  hurt(dmg, venom = 0) {
    if (!this.alive) return;
    if (this.def.passive && !this.def.burn) { this.hp -= dmg * 0.5; if (this.hp <= 0) this.hp = 1; return; } // rocks don't die from bites, you eat them
    this.hp -= dmg; this.venom += venom;
    if (this.hp <= 0) { this.state = 'dead'; this.hp = 0; return; }
    if (this.venom > this.hp * 0.6 && !this.def.passive) this.state = 'paralyzed';
  }
  webbed(amount) { this.stuck = Math.max(this.stuck, amount); }
  remove() { this.state = 'eaten'; this.root.removeFromParent(); this.sys.removed(this); }
  // eat a piece of something much bigger than you: it gets smaller, you get the mass
  takeChunk(m) {
    const before = this.mass;
    this.mass = Math.max(0, this.mass - m);
    if (this.mass < before * 0.04 || this.mass <= m * 0.25) { this.remove(); return true; }
    this.L *= Math.cbrt(this.mass / before);
    this.root.scale.setScalar(this.L);
    return false;
  }
  update(dt, P) {
    this.t += dt;
    if (this.state === 'eaten') return;
    if (this.stuck > 0) this.stuck = Math.max(0, this.stuck - dt * 0.05);
    if (this.orbit && !this.wrapped && this.stuck <= 0 && this.state !== 'dead') {
      const O = this.orbit; O.a += O.w * dt;
      const c = O.center.isVector3 ? O.center : O.center.pos;
      this.pos.set(Math.cos(O.a) * O.r, Math.sin(O.a) * O.r * Math.sin(O.tilt || 0), Math.sin(O.a) * O.r * Math.cos(O.tilt || 0)).add(c);
    }
    if (this.spin) this.model.root.rotation.y += this.spin * dt;
    if (this.update0) this.update0(this, dt, P);
    this.root.position.copy(this.pos);
  }
}

export class SpaceBodies {
  constructor(zone) {
    this.zone = zone; this.game = zone.game; this.scene = zone.scene; this.unit = zone.unit;
    this.list = []; this.silkPower = 1;
    // far away bodies are glowing dots (planets as seen from space, stars, galaxies)
    const N = 4096;
    this.dotPos = new Float32Array(N * 3); this.dotCol = new Float32Array(N * 3); this.dotSize = new Float32Array(N);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.dotPos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.dotCol, 3)); g.setAttribute('size', new THREE.BufferAttribute(this.dotSize, 1));
    g.setDrawRange(0, 0);
    this.dots = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`attribute float size; attribute vec3 color; varying vec3 vC; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size; }`,
      fragmentShader: /* glsl */`varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; float a = 1.0 - smoothstep(0.0, 1.0, r); a = a * a; float core = 1.0 - smoothstep(0.0, 0.25, r); gl_FragColor = vec4(vC * (a + core * 2.0), 1.0); }`,
    }));
    this.dots.frustumCulled = false; this.dots.renderOrder = 3;
    this.scene.add(this.dots);
  }
  add(def, pos, L, opts) { const b = new Body(this, def, pos, L, opts); this.list.push(b); if (def.walk) this.zone.spheres.add(b); return b; }
  removed(b) { this.zone.spheres.remove(b); if (this.zone.onEaten) this.zone.onEaten(b); }
  update(dt) {
    const G = this.game, P = G.player && G.state !== 'dead' ? G.player : null;
    this.silkPower = P ? (P.sp.stats.silk || 1) * (1 + 0.15 * P.evo.silk) : 1;
    for (const b of this.list) b.update(dt, P);
    this.list = this.list.filter(b => b.state !== 'eaten');
    // dots for the ones too small to see on screen
    const cam = G.camera, cp = cam.position;
    const H = G.renderer.size().h, k = H * 0.5 / Math.tan(cam.fov * Math.PI / 360);
    this.dots.position.copy(cp); this.dots.updateMatrixWorld();
    let n = 0;
    for (const b of this.list) {
      if (n >= 4096) break;
      const d = _v.subVectors(b.pos, cp); const dist = d.length();
      if (dist < 1e-9) continue;
      const px = b.L / dist * k;            // how big it is on screen (pixels)
      if (px > 6 || !b.dotBright) continue;
      const a = clamp(1 - (px - 2) / 4, 0, 1);
      // put the dot just inside the far plane if needed so it never gets clipped away
      const far = cam.far * 0.95; if (dist > far) d.multiplyScalar(far / dist);
      this.dotPos[n * 3] = d.x; this.dotPos[n * 3 + 1] = d.y; this.dotPos[n * 3 + 2] = d.z;
      const br = b.dotBright * a * (b === (G.actions.lock && G.actions.lock.c) ? 2.5 : 1);
      this.dotCol[n * 3] = b.dotColor.r * br; this.dotCol[n * 3 + 1] = b.dotColor.g * br; this.dotCol[n * 3 + 2] = b.dotColor.b * br;
      this.dotSize[n] = clamp(3 + Math.log10(1 + b.L / Math.max(P ? P.s : 1, 1e-12)) * 2.2, 3, 9) * (b.def.burn ? 1.6 : 1);
      n++;
    }
    const g = this.dots.geometry; g.setDrawRange(0, n);
    for (const k2 of ['position', 'color', 'size']) g.attributes[k2].needsUpdate = true;
  }
  near(p, r, filter) { const out = []; for (const c of this.list) if (c.state !== 'eaten' && c.pos.distanceTo(p) < r + c.L * 0.5 && (!filter || filter(c))) out.push(c); return out; }
  nearest(p, r, filter) { let best = null, bd = r; for (const c of this.list) { if (c.state === 'eaten' || (filter && !filter(c))) continue; const d = c.pos.distanceTo(p) - c.L * 0.5; if (d < bd) { bd = d; best = c; } } return best; }
  raycast(o, d, far, minL = 0) {
    let best = null, bt = far;
    for (const c of this.list) {
      if (c.state === 'eaten' || c.L < minL) continue;
      const oc = _v2.subVectors(c.pos, o), t = oc.dot(d);
      if (t < 0 || t > bt) continue;
      // a little bigger than the body so small far things are easy to aim at
      const r = c.L * 0.55 + t * 0.012;
      if (oc.lengthSq() - t * t < r * r) { bt = t; best = c; }
    }
    return best ? { c: best, t: bt } : null;
  }
}

// ------------------------------------------------------------------ a space world
export class SpaceZone {
  constructor(game, id, name, unit) {
    this.game = game; this.id = id; this.name = name; this.unit = unit;
    this.scene = new THREE.Scene();
    this.collision = new CollisionWorld();
    this.spheres = new SphereSet(); this.collision.analytic.push(this.spheres);
    this.gravity = new THREE.Vector3();
    this.space = true;
    this.view = { minFar: 0 };
    this.cruise = 400;           // how much faster you go at full cruise
    this.aimBL = 4000;           // how far you can aim / shoot a line (body lengths)
    this.zipBL = 6000;
    this.growMul = 1;
    this.bodies = null;
    this.labels = null;
  }
  get creatures() { return this.bodies; }
  async build() {}
  baseScene({ ambient = 0.02 } = {}) {
    const S = this.scene;
    this.bodies = new SpaceBodies(this);
    this.amb = new THREE.AmbientLight(0x8090b0, ambient); S.add(this.amb);
  }
  // put the player somewhere sensible when arriving from the zone below
  placePlayer(pos, up) {
    const G = this.game, p = G.player;
    p.pos.copy(pos); p.up.copy(up || new THREE.Vector3(0, 1, 0)); p.vel.set(0, 0, 0);
    p.mode = 'space'; p.rope = null; p.zipT = null;
    G.cam.target.copy(p.pos);
    p.rig.initDone = false;
  }
  // gravity toward whatever big body you're standing on / falling to; none out in open space
  updateGravity() {
    const p = this.game.player; if (!p) return;
    let best = null, bs = 0;
    for (const b of this.spheres.list) {
      if (!b.walkable || b.state === 'eaten') continue;
      const r = b.L * 0.5; if (p.s > r * 1.3) continue;
      const d = p.pos.distanceTo(b.pos) - r;
      if (d > r * 1.5 + p.s * 6) continue;
      const k = r / Math.max(d + r, 1e-9);
      if (k > bs) { bs = k; best = b; }
    }
    this.ground = best;
    if (best) this.gravity.copy(best.pos).sub(p.pos).normalize().multiplyScalar(9.81 / this.unit * (best.def.g ?? 1));
    else this.gravity.set(0, 0, 0);
  }
  // free flying: land when you touch something you can stand on
  spaceCollide(p) {
    const s = p.s;
    const h = this.spheres.closest(p.pos, s * 0.4, s);
    if (h) {
      _v3.subVectors(p.pos, h.body.pos);
      if (_v3.length() < h.body.R + s * 0.25) { // touched (or went inside): stand on it
        p.pos.copy(h.point); p.up.copy(h.normal); p.mode = 'ground'; p.vel.set(0, 0, 0); p.rig.initDone = false;
        this.game.audio.land(p, 1);
      }
    }
  }
  update(dt, dtReal) {
    const G = this.game, p = G.player;
    this.updateGravity();
    if (p) {
      // falling with nothing pulling you = floating in space
      if (p.mode === 'air' && this.gravity.lengthSq() === 0) { p.mode = 'space'; }
      // hold jump in the air (or on a planet too small to hold you) = fly off into space
      if (p.mode === 'air' && G.controlsOn && G.input.is('jump') && p.airTime > 0.25) { p.mode = 'space'; G.hud.hint && G.story.hint('fly'); }
      if (p.mode === 'ground' && !this.ground && G.state === 'play') p.mode = 'space';
    }
    this.bodies.update(dt);
    this.heat(dt);
  }
  // stars burn you up close until they're wrapped in silk
  heat(dt) {
    const G = this.game, p = G.player; if (!p || G.state !== 'play') return;
    for (const b of this.bodies.list) {
      if (!b.def.burn || b.stuck > 0 || b.wrapped) continue;
      const d = p.pos.distanceTo(b.pos) - b.R;
      const range = b.R * 1.2 + p.s * 2;
      if (d > range) continue;
      const k = 1 - Math.max(0, d) / range;
      const resist = (p.powers.fire ? 0.35 : 1) * (p.powers.stars ? 0.3 : 1);
      p.hurt(dt * 28 * k * k * resist * (b.def.heat ?? 1), b.def.burnCause || 'burned by the Sun');
      if (Math.random() < dt * 2) G.hud.toast('It\'s burning you. Web it (right click) to smother it, then eat it.', 1.4);
    }
  }
  // name labels for the biggest / closest things on screen
  drawLabels() {
    const G = this.game, p = G.player;
    if (!this.labelEl) {
      this.labelEl = document.createElement('div');
      this.labelEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9;font-family:Bahnschrift,Segoe UI,sans-serif;font-size:11px;letter-spacing:.14em;color:rgba(233,230,225,.8);text-transform:uppercase';
      document.body.appendChild(this.labelEl);
      this.labelPool = [];
    }
    const el = this.labelEl;
    el.style.display = G.state === 'play' && G.zone === this ? '' : 'none';
    if (el.style.display === 'none' || !p) return;
    const cam = G.camera, W = innerWidth, H = innerHeight;
    const cand = [];
    for (const b of this.bodies.list) {
      if (!b.def.label) continue;
      const v = _v.copy(b.pos).project(cam); if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) continue;
      const dist = b.pos.distanceTo(p.pos);
      cand.push({ b, x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, score: b.L / Math.max(dist, 1e-9), dist });
    }
    cand.sort((a, b) => b.score - a.score);
    const show = cand.slice(0, 9);
    while (this.labelPool.length < show.length) { const d = document.createElement('div'); d.style.cssText = 'position:absolute;transform:translate(-50%,-150%);white-space:nowrap;text-shadow:0 1px 4px #000'; el.appendChild(d); this.labelPool.push(d); }
    this.labelPool.forEach((d, i) => {
      const c = show[i];
      if (!c) { d.style.display = 'none'; return; }
      d.style.display = ''; d.style.left = c.x + 'px'; d.style.top = c.y + 'px';
      const big = c.b.L * this.unit;
      d.innerHTML = `${c.b.def.name}<span style="color:rgba(140,139,144,.9);margin-left:8px">${sizeText(big)} &middot; ${sizeText(Math.max(0, c.dist - c.b.R) * this.unit)} away</span>`;
    });
  }
  exit() { if (this.labelEl) this.labelEl.style.display = 'none'; }
  dispose() {
    if (this.labelEl) this.labelEl.remove();
    this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) m.dispose(); } });
  }
}
