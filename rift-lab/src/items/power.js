// Real electricity. Nothing electric works out in the wild until you bring power:
// a gas generator (pull-start, burns real fuel), or solar panels charging a battery
// station (only when the real sun is shining on them). Things plug in automatically
// when their cord reaches a free outlet (you'll see the cord). Plug in too much and the
// breaker trips. Lamps light up the night for real.

import * as THREE from 'three';
import { clamp, smoothstep } from '../core/noise.js';

const CORD = { default: 1.8, 'fridge-kelvin': 1.6, 'stove-kelvin': 1.2 };
const LIGHT_POOL = 6;

export class PowerGrid {
  constructor({ items, scene, clock, sky, world, audio, camera, onMessage }) {
    this.items = items;
    this.scene = scene;
    this.clock = clock;
    this.sky = sky;
    this.world = world;
    this.audio = audio;
    this.camera = camera;
    this.onMessage = onMessage || (() => {});
    this.solveT = 0;
    this.links = [];            // { from: item, to: item, outlet: idx, kind }
    this.cords = new Map();     // key -> mesh
    this.cordGroup = new THREE.Group();
    this.cordGroup.name = 'cords';
    scene.add(this.cordGroup);
    this.lights = [];
    for (let i = 0; i < LIGHT_POOL; i++) {
      const l = new THREE.PointLight(0xffc98a, 0, 14, 2);
      l.castShadow = false;
      scene.add(l);
      this.lights.push(l);
    }
    this.engine = null;
    this.cordMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.7 });
    this.cordMatOrange = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.6 });
  }

  // ---------- state helpers ----------
  st(item) {
    item.state ||= {};
    const s = item.state;
    const src = item.def?.source;
    if (src?.kind === 'generator') { s.fuel ??= 0; s.running ??= false; s.tripped ??= false; }
    if (src?.kind === 'battery') { s.charge ??= src.wh * 0.8; s.on ??= true; s.tripped ??= false; }
    if (item.itemId === 'gascan') s.fuel ??= 18.9;
    if (item.def?.power) s.on ??= !hasSwitch(item); // fridges are always on; lamps start switched off
    return s;
  }

  isSource(it) { return !!it.def?.source; }
  powered(it) { return !!it.state?.powered; }

  sourceLive(it) {
    const s = this.st(it), src = it.def.source;
    if (src.kind === 'generator') return s.running && !s.tripped && s.fuel > 0;
    if (src.kind === 'battery') return s.on && !s.tripped && s.charge > 1;
    if (src.kind === 'strip') { const up = this.links.find((l) => l.from === it); return up ? this.sourceLive(up.to) : false; }
    return false;
  }

  rootSource(it) {
    if (it.def.source.kind !== 'strip') return it;
    const up = this.links.find((l) => l.from === it);
    return up ? this.rootSource(up.to) : null;
  }

  worldPoint(it, local) {
    const b = it.bodies.main, t = b.translation(), r = b.rotation();
    return new THREE.Vector3(...local).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w)).add(new THREE.Vector3(t.x, t.y, t.z));
  }

  cordPoint(it) {
    // the cord leaves from the back, near the bottom
    const b = it.bounds;
    return this.worldPoint(it, [0, b.min.y + 0.06, b.min.z + 0.03]);
  }

  // ---------- connecting things ----------
  solve() {
    const items = this.items.items;
    const sources = items.filter((it) => this.isSource(it));
    const links = [];
    const used = new Map(); // source -> Set(outlet index)
    const take = (src, devPoint, reach) => {
      let best = null;
      for (const s of sources) {
        if (s.def.source.kind === 'strip' && reach !== null && s === devPoint.self) continue;
        const outs = s.def.source.outlets;
        for (let i = 0; i < outs.length; i++) {
          if (used.get(s)?.has(i)) continue;
          const p = this.worldPoint(s, outs[i]);
          const d = p.distanceTo(devPoint.p);
          if (d <= reach && (!best || d < best.d)) best = { s, i, d, p };
        }
      }
      return best;
    };
    // strips first (they plug into real sources only: no daisy-chaining)
    for (const strip of sources.filter((s) => s.def.source.kind === 'strip')) {
      const p = strip.position;
      let best = null;
      for (const s of sources) {
        if (s.def.source.kind === 'strip') continue;
        s.def.source.outlets.forEach((o, i) => {
          if (used.get(s)?.has(i)) return;
          const q = this.worldPoint(s, o), d = q.distanceTo(p);
          if (d <= strip.def.source.reach && (!best || d < best.d)) best = { s, i, d };
        });
      }
      if (best) { (used.get(best.s) || used.set(best.s, new Set()).get(best.s)).add(best.i); links.push({ from: strip, to: best.s, outlet: best.i, kind: 'strip' }); }
    }
    this.links = links; // so strips resolve their upstream while devices connect
    // devices
    for (const dev of items.filter((it) => it.def?.power)) {
      const reach = CORD[dev.itemId] ?? CORD.default;
      const best = take(null, { p: this.cordPoint(dev), self: dev }, reach);
      if (best) { (used.get(best.s) || used.set(best.s, new Set()).get(best.s)).add(best.i); links.push({ from: dev, to: best.s, outlet: best.i, kind: 'device' }); }
    }
    // solar panels -> nearest battery station within 6 m
    for (const panel of items.filter((it) => it.itemId === 'solarpanel')) {
      let best = null;
      for (const s of sources) {
        if (s.def.source.kind !== 'battery') continue;
        const d = s.position.distanceTo(panel.position);
        if (d < 6 && (!best || d < best.d)) best = { s, d };
      }
      if (best) links.push({ from: panel, to: best.s, outlet: -1, kind: 'solar' });
    }
    this.links = links;
  }

  // ---------- each frame ----------
  update(dt, hands) {
    const items = this.items.items;
    for (const it of items) this.st(it);
    this.solveT -= dt;
    if (this.solveT <= 0) { this.solveT = 0.25; this.solve(); }

    const gameHours = (dt * this.clock.rate) / 3600;
    // loads per root source
    const load = new Map();
    for (const it of items) if (it.state) it.state.powered = false;
    for (const l of this.links) {
      if (l.kind !== 'device') continue;
      const root = this.rootSource(l.to);
      if (!root || !this.sourceLive(root)) continue;
      const dev = l.from;
      dev.state.powered = true;
      if (dev.state.on) load.set(root, (load.get(root) || 0) + draw(dev));
    }
    // sources: fuel, battery, overloads
    for (const it of items) {
      if (!this.isSource(it)) continue;
      const s = it.state, src = it.def.source;
      const w = load.get(it) || 0;
      s.load = w;
      if (w > src.watts && !s.tripped && this.sourceLive(it)) {
        s.tripped = true;
        this.onMessage(`${it.def.name}: breaker tripped (too much plugged in: ${Math.round(w)} W of ${src.watts} W). Click the breaker to reset.`);
        this.audio.ui?.('click');
      }
      if (src.kind === 'generator' && s.running) {
        s.fuel = Math.max(0, s.fuel - gameHours * (0.35 + 1.25 * (w / src.watts)));
        if (s.fuel <= 0) { s.running = false; this.onMessage('The generator ran out of gas and stopped.'); }
      }
      if (src.kind === 'battery') {
        let solarW = 0;
        for (const l of this.links) if (l.kind === 'solar' && l.to === it) solarW += this.solarWatts(l.from);
        s.solarW = solarW;
        s.charge = clamp(s.charge + gameHours * (solarW * 0.9 - (this.sourceLive(it) ? w : 0)), 0, src.wh);
        if (s.charge <= 1 && s.on) this.onMessage('The SunStack battery is empty.');
      }
    }
    // pouring gas: hold a gas can right by the generator's fuel cap
    if (hands?.held?.item?.itemId === 'gascan') {
      const can = hands.held.item;
      for (const gen of items.filter((x) => x.def?.source?.kind === 'generator')) {
        const cap = this.worldPoint(gen, [-0.12, 0.6, 0.05]);
        if (can.position.distanceTo(cap) < 0.65 && can.state.fuel > 0 && gen.state.fuel < gen.def.source.tank) {
          const amt = Math.min(dt * 0.3, can.state.fuel, gen.def.source.tank - gen.state.fuel);
          can.state.fuel -= amt;
          gen.state.fuel += amt;
          this.pourT = (this.pourT || 0) + dt;
          if (this.pourT > 0.35) { this.pourT = 0; this.audio.burst?.({ dur: 0.3, freq: 600, q: 0.8, gain: 0.05, buffer: this.audio.brown }); }
          if (gen.state.fuel >= gen.def.source.tank - 0.01) this.onMessage('Generator tank full (15 L).');
        }
      }
    }
    this.updateLights();
    this.updateCords();
    this.updateSounds();
  }

  solarWatts(panel) {
    const part = panel.spec.parts.find((p) => p.solar);
    const r = panel.bodies.main.rotation();
    const n = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(...part.rot.map((d) => d * Math.PI / 180))).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w));
    const sun = this.sky.sunDir;
    const facing = Math.max(0, n.dot(sun));
    const atmo = smoothstep(0.0, 0.25, sun.y);
    return 400 * facing * atmo * (1 - 0.75 * this.sky.cloudCover);
  }

  // ---------- use (mouse only) ----------
  use(item, part) {
    const s = this.st(item);
    const kind = part.use;
    if (kind === 'switch') {
      if (item.def.source?.kind === 'generator') {
        if (s.running) { s.running = false; this.onMessage('Generator off.'); this.audio.ui?.('click'); }
        else this.onMessage('Pull the starter cord to start it (the handle on the side).');
        return true;
      }
      if (item.def.source?.kind === 'battery') { s.on = !s.on; this.audio.ui?.('click'); this.onMessage(`SunStack outlets ${s.on ? 'on' : 'off'} · ${Math.round(s.charge / item.def.source.wh * 100)}% charged`); return true; }
      if (item.def.power) {
        s.on = !s.on;
        this.audio.tone?.({ freq: 2400, freqEnd: 1800, dur: 0.03, gain: 0.08, type: 'square' });
        if (s.on && !s.powered) this.onMessage('Click... nothing. It needs power: put it near a generator or a SunStack (its cord is about 1.8 m long).');
        return true;
      }
    }
    if (kind === 'pullstart') {
      this.audio.burst?.({ dur: 0.35, freq: 1500, q: 0.6, gain: 0.12, attack: 0.02 });
      if (s.fuel <= 0.05) { this.onMessage('It sputters... no gas in the tank. Hold a gas can by the fuel cap to fill it.'); return true; }
      // cold engines don't always catch on the first pull
      if (Math.random() < 0.55) { s.running = true; s.tripped = false; this.onMessage('The generator starts and settles into a steady roar.'); }
      else this.onMessage('Sputter... try pulling again.');
      return true;
    }
    if (kind === 'breaker') { if (s.tripped) { s.tripped = false; this.onMessage('Breaker reset.'); } this.audio.ui?.('click'); return true; }
    if (kind === 'fuel') { this.onMessage(`Fuel: ${s.fuel.toFixed(1)} of 15 L. Hold a gas can here to pour.`); return true; }
    return false;
  }

  // ---------- visuals ----------
  updateLights() {
    const cam = this.camera.position;
    const emitters = [];
    for (const it of this.items.items) {
      const s = it.state;
      if (!s || !it.def?.power || !it.lights?.length) continue;
      let on = s.powered && s.on && !s.bulbBroken;
      let interior = false;
      if (it.itemId === 'fridge-kelvin') {
        // the light inside comes on when a door is open
        const m = it.bodies.main.rotation();
        const qm = new THREE.Quaternion(m.x, m.y, m.z, m.w);
        interior = ['doorL', 'doorR'].some((n) => { const r = it.bodies[n]?.rotation(); return r && qm.angleTo(new THREE.Quaternion(r.x, r.y, r.z, r.w)) > 0.15; });
        on = s.powered && interior;
      }
      for (const L of it.lights) {
        setGlow(L.mesh, on);
        if (on) {
          const p = new THREE.Vector3(...L.offset).applyMatrix4(L.mesh.parent.matrixWorld);
          emitters.push({ p, lumens: L.lumens, color: L.color, d: p.distanceTo(cam) });
        }
      }
      for (const g of Object.values(it.groups)) g.traverse((o) => { if (o.isMesh && o.material.userData?.shade) setGlow(o, on && !interior, 0.35); });
    }
    emitters.sort((a, b) => a.d - b.d);
    this.lights.forEach((l, i) => {
      const e = emitters[i];
      if (!e) { l.intensity = 0; return; }
      l.position.copy(e.p);
      l.color.setHex(e.color);
      l.intensity = e.lumens / (4 * Math.PI) * 0.8; // candela from lumens, a bit lost in the shade
    });
  }

  updateCords() {
    const seen = new Set();
    for (const l of this.links) {
      const key = `${l.from.uid}>${l.to.uid}:${l.outlet}`;
      seen.add(key);
      const a = l.kind === 'solar' ? l.from.position.clone().add(new THREE.Vector3(0, 0.3, 0)) : l.kind === 'strip' ? l.from.position.clone().add(new THREE.Vector3(0, 0.03, 0)) : this.cordPoint(l.from);
      const b = l.outlet >= 0 ? this.worldPoint(l.to, l.to.def.source.outlets[l.outlet]) : l.to.position.clone().add(new THREE.Vector3(0, 0.2, 0));
      let c = this.cords.get(key);
      if (c && c.a.distanceTo(a) < 0.01 && c.b.distanceTo(b) < 0.01) continue;
      if (c) { this.cordGroup.remove(c.mesh); c.mesh.geometry.dispose(); }
      const mesh = cordMesh(a, b, (x, z) => this.world.height(x, z), l.kind === 'strip' ? this.cordMatOrange : this.cordMat);
      this.cordGroup.add(mesh);
      this.cords.set(key, { a, b, mesh });
    }
    for (const [key, c] of this.cords) {
      if (!seen.has(key)) { this.cordGroup.remove(c.mesh); c.mesh.geometry.dispose(); this.cords.delete(key); }
    }
  }

  updateSounds() {
    const a = this.audio;
    if (!a.ctx) return;
    const cam = this.camera.position;
    let gen = null, d = Infinity;
    for (const it of this.items.items) {
      if (it.def?.source?.kind === 'generator' && it.state?.running) { const dd = it.position.distanceTo(cam); if (dd < d) { d = dd; gen = it; } }
    }
    if (gen && !this.engine) this.engine = makeEngine(a);
    if (this.engine) {
      const target = gen ? 0.32 / (1 + (d / 4) ** 2) : 0;
      const loadF = gen ? (gen.state.load || 0) / gen.def.source.watts : 0;
      this.engine.gain.gain.setTargetAtTime(target, a.ctx.currentTime, 0.3);
      this.engine.osc.frequency.setTargetAtTime(58 - loadF * 6, a.ctx.currentTime, 0.5);
      if (!gen && this.engine.gain.gain.value < 0.001) { this.engine.stop(); this.engine = null; }
    }
  }

  dispose() {
    this.scene.remove(this.cordGroup);
    for (const l of this.lights) this.scene.remove(l);
    this.engine?.stop();
  }
}

function hasSwitch(item) { return item.spec.parts.some((p) => p.use === 'switch'); }
function draw(dev) { return dev.def.power || 0; }

function setGlow(mesh, on, k = 1) {
  const m = mesh.material;
  if (!m.userData.own) return;
  const want = on ? k : 0;
  if (m.userData.glow === want) return;
  m.userData.glow = want;
  if (m.userData.bulb) { m.emissive.setHex(on ? 0xffd9a8 : 0x000000); m.emissiveIntensity = on ? 6 : 0; }
  else { m.emissive.copy(m.color).multiplyScalar(on ? 1 : 0); m.emissiveIntensity = want; }
}

// a sagging cable between two points, never below the ground
function cordMesh(a, b, groundAt, mat) {
  const pts = [];
  const len = a.distanceTo(b);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const p = a.clone().lerp(b, t);
    p.y -= Math.sin(Math.PI * t) * Math.min(0.6, len * 0.35);
    p.y = Math.max(p.y, groundAt(p.x, p.z) + 0.008);
    pts.push(p);
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, Math.max(8, Math.round(len * 10)), 0.0035, 5, false);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  return m;
}

function makeEngine(a) {
  const ctx = a.ctx;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = 58;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 420;
  const noise = ctx.createBufferSource();
  noise.buffer = a.brown; noise.loop = true;
  const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 900; nf.Q.value = 0.7;
  const ng = ctx.createGain(); ng.gain.value = 0.5;
  const gain = ctx.createGain(); gain.gain.value = 0;
  osc.connect(f).connect(gain);
  noise.connect(nf).connect(ng).connect(gain);
  gain.connect(a.fx);
  osc.start(); noise.start();
  return { osc, gain, stop: () => { try { osc.stop(); noise.stop(); } catch { /* */ } gain.disconnect(); } };
}
