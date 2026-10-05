// Accretion: grow from a clump of rock into a planet, a star, a black hole.
import * as THREE from 'three';
import { Galaxy } from './world/galaxy.js';
import { World } from './world/world.js';
import { Renderer } from './render/renderer.js';
import { Input, ChaseCamera } from './game/controls.js';
import { HUD } from './ui/hud.js';
import { Rumble } from './audio/audio.js';
import * as F from './core/format.js';
import { STAGES, STAGE_INDEX, TIME_BASE, M_SUN } from './core/constants.js';
import { clamp, blackbody } from './core/phys.js';

const SAVE_KEY = 'accretion-save-v1';
const SET_KEY = 'accretion-settings-v1';

function loadJSON(k) {
  try {
    const s = localStorage.getItem(k);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}
function saveJSON(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ }
}
function removeKey(k) {
  try { localStorage.removeItem(k); } catch { /* storage unavailable */ }
}

const $ = (id) => document.getElementById(id);

class Game {
  constructor() {
    this.settings = { quality: 'medium', sens: 1, invert: false, volume: 0.8, hints: true, ...(loadJSON(SET_KEY) || {}) };
    this.saveData = loadJSON(SAVE_KEY);
    if (this.saveData && this.saveData.v !== 1) this.saveData = null;
    this.canvas = $('view');
    this.newWorld(this.saveData);
    this.renderer = new Renderer(this.canvas, this.galaxy, this.settings);
    this.input = new Input(this.canvas, this.settings);
    this.cam = new ChaseCamera();
    this.hud = new HUD();
    this.audio = new Rumble();
    this.audio.volume = this.settings.volume;
    this.state = 'title';
    this.frame = { vx: 0, vy: 0, vz: 0 };
    this.target = null;
    this.aim = null;
    this.markers = [];
    this.damage = 0;
    this.saveTimer = 20;
    this.eatAcc = { n: 0, m: 0, t: 0 };
    this.stormWarn = 0;
    this.snWarn = 0;
    this.hudOn = true;
    this.forceSky = true;
    this.last = performance.now();
    this.markerTimer = 0;
    this.feedMass = 0;
    this.titleSpin = 0;
    this.bindUI();
    window.addEventListener('resize', () => { this.renderer.resize(); this.hud.resize(); });
    window.addEventListener('beforeunload', () => this.save());
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.state === 'playing' && this.wasLocked) this.pause();
      this.wasLocked = !!document.pointerLockElement;
    });
    this.cam.update(this.world.player, this.renderer.cameraScale(this.world.player), 0.016, { snap: true });
    requestAnimationFrame((t) => this.loop(t));
  }

  newWorld(save) {
    const seed = save?.seed ?? ((Math.random() * 1e9) | 0);
    this.galaxy = new Galaxy(seed);
    if (save) World.restoreGalaxyState(this.galaxy, save);
    this.world = new World(this.galaxy, { quality: this.settings.quality });
    if (save) {
      this.world.time = save.time || 0;
      Object.assign(this.world.stats, save.stats || {});
      this.world.spawnPlayer({ ...save.player });
    } else {
      this.world.spawnPlayer();
    }
  }

  // ---------------------------------------------------------------- UI wiring

  bindUI() {
    $('btn-continue').hidden = !this.saveData;
    $('btn-begin').textContent = this.saveData ? 'New galaxy' : 'Begin';
    $('btn-begin').addEventListener('click', () => {
      if (this.saveData) {
        removeKey(SAVE_KEY);
        this.saveData = null;
        this.resetGalaxy();
      }
      this.play();
    });
    $('btn-continue').addEventListener('click', () => this.play());
    const toggle = (id, other) => {
      const el = $(id);
      el.hidden = !el.hidden;
      if (other) $(other).hidden = true;
    };
    $('btn-controls').addEventListener('click', () => toggle('panel-controls', 'panel-settings'));
    $('btn-settings').addEventListener('click', () => toggle('panel-settings', 'panel-controls'));
    $('btn-resume').addEventListener('click', () => this.resume());
    $('btn-p-controls').addEventListener('click', () => { this.movePanels(); toggle('panel-controls', 'panel-settings'); });
    $('btn-p-settings').addEventListener('click', () => { this.movePanels(); toggle('panel-settings', 'panel-controls'); });
    $('btn-restart').addEventListener('click', () => { $('confirm-row').hidden = false; });
    $('btn-restart-no').addEventListener('click', () => { $('confirm-row').hidden = true; });
    $('btn-restart-yes').addEventListener('click', () => {
      removeKey(SAVE_KEY);
      $('confirm-row').hidden = true;
      this.resetGalaxy();
      this.resume();
    });
    $('btn-reform').addEventListener('click', () => this.reform());

    const s = this.settings;
    $('set-quality').value = s.quality;
    $('set-sens').value = s.sens;
    $('set-invert').checked = s.invert;
    $('set-volume').value = s.volume;
    $('set-hints').checked = s.hints;
    $('set-quality').addEventListener('change', (e) => {
      s.quality = e.target.value;
      saveJSON(SET_KEY, s);
      this.save();
      location.reload();
    });
    $('set-sens').addEventListener('input', (e) => { s.sens = +e.target.value; saveJSON(SET_KEY, s); });
    $('set-invert').addEventListener('change', (e) => { s.invert = e.target.checked; saveJSON(SET_KEY, s); });
    $('set-volume').addEventListener('input', (e) => { s.volume = +e.target.value; this.audio.setVolume(s.volume); saveJSON(SET_KEY, s); });
    $('set-hints').addEventListener('change', (e) => { s.hints = e.target.checked; saveJSON(SET_KEY, s); this.applyHints(); });
    this.applyHints();
  }

  applyHints() {
    const k = document.querySelector('.keys');
    if (k) k.hidden = !this.settings.hints;
  }

  movePanels() {
    const host = $('pause-panels');
    if ($('panel-controls').parentElement !== host) {
      host.appendChild($('panel-controls'));
      host.appendChild($('panel-settings'));
    }
  }

  restorePanels() {
    const host = document.querySelector('#title .screen-inner');
    host.appendChild($('panel-controls'));
    host.appendChild($('panel-settings'));
    $('panel-controls').hidden = true;
    $('panel-settings').hidden = true;
  }

  resetGalaxy() {
    this.renderer.dispose?.();
    for (const v of this.renderer.views.values()) this.renderer.disposeView(v);
    this.renderer.views.clear();
    for (const d of this.renderer.disks.values()) d.dispose();
    this.renderer.disks.clear();
    this.renderer.fx.clear();
    this.newWorld(null);
    // the sky belongs to the galaxy, so rebuild the renderer's sky for the new one
    this.renderer.scene.remove(this.renderer.sky.systemPoints);
    this.renderer.sky = new (this.renderer.sky.constructor)(this.renderer.gl, this.galaxy, this.renderer.shared, this.renderer.quality);
    this.renderer.sky.onSwap = (tex) => { this.renderer.scene.background = tex; };
    this.renderer.scene.add(this.renderer.sky.systemPoints);
    this.forceSky = true;
    this.target = null;
    this.cam.update(this.world.player, this.renderer.cameraScale(this.world.player), 0.016, { snap: true });
    this.snapExposure = true;
  }

  play() {
    $('title').hidden = true;
    this.restorePanels();
    this.state = 'playing';
    this.input.enabled = true;
    this.hud.show(this.hudOn);
    this.audio.start();
    this.audio.setVolume(this.settings.volume);
    const p = this.world.player;
    if (!this.introShown) {
      this.introShown = true;
      this.hud.showCard(p.stage, this.saveData ? 'Welcome back' : 'You begin as');
      this.hud.log(`In the ${this.world.field.env.label.toLowerCase()} of ${this.galaxy.startSystem.name}`, 'info');
      this.hud.log('Click the view to steer with the mouse', 'info');
    }
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.enabled = false;
    this.input.releaseLock();
    $('pause').hidden = false;
    $('confirm-row').hidden = true;
    this.save();
  }

  resume() {
    $('pause').hidden = true;
    this.restorePanels();
    this.state = 'playing';
    this.input.enabled = true;
    this.last = performance.now();
  }

  reform() {
    $('death').hidden = true;
    const prev = this.deathMass || 1e15;
    this.renderer.fx.clear();
    this.world.rebirth(prev);
    this.target = null;
    this.state = 'playing';
    this.input.enabled = true;
    this.cam.update(this.world.player, this.renderer.cameraScale(this.world.player), 0.016, { snap: true });
    this.snapExposure = true;
    this.forceSky = true;
    this.hud.showCard(this.world.player.stage, 'Re-formed as');
    this.save();
  }

  // testing aid (from the browser console): jump straight to a mass, e.g. game.become(6e24)
  become(mass, opts = {}) {
    const w = this.world, p = w.player;
    p.mass = mass;
    if (opts.comp) p.comp = { ...opts.comp };
    p.compact = opts.compact ?? null;
    p.heat = opts.heat ?? 0;
    p.swell = 1;
    p.updateRadius();
    for (const b of w.bodies) if (b.role === 'field' || b.role === 'fragment') b.alive = false;
    w.flushDead();
    w.core = null;
    w.rebuildAttractors();
    w.field.update(0, true);
    this.cam.update(p, this.renderer.cameraScale(p), 0.016, { snap: true });
    this.snapExposure = true;
  }

  save() {
    if (!this.world?.player?.alive) return;
    saveJSON(SAVE_KEY, this.world.serialize());
  }

  // ---------------------------------------------------------------- frame

  loop(t) {
    requestAnimationFrame((tt) => this.loop(tt));
    let dt = (t - this.last) / 1000;
    this.last = t;
    if (!(dt > 0)) dt = 0.016;
    dt = Math.min(dt, 0.05);
    try {
      this.step(dt);
    } catch (err) {
      this.showError(err);
      throw err;
    }
  }

  showError(err) {
    if (this.errShown) return;
    this.errShown = true;
    const el = document.createElement('div');
    el.id = 'error';
    el.textContent = `Something went wrong: ${err?.message || err}`;
    document.body.appendChild(el);
  }

  step(dt) {
    const w = this.world;
    const inp = this.input;
    if (this.state === 'playing') {
      this.handleInput(dt);
      w.update(dt);
      this.processEvents();
      this.saveTimer -= dt;
      if (this.saveTimer <= 0) { this.saveTimer = 25; this.save(); }
    } else {
      w.events.length = 0;
      if (this.state === 'title') {
        // slow drift around you on the title screen
        this.cam.yaw += dt * 0.04;
      }
    }
    const p = w.player;
    if (p.alive) this.frame = w.referenceFrame(p.x, p.y, p.z, p);
    this.cam.update(p, this.renderer.cameraScale(p), dt, { boost: w.input.boost && w.input.level > 0, warp: w.warp });
    this.damage = Math.max(this.damage - dt * 0.8, w.tidalStress * 1.2, 0);
    this.stormWarn -= dt;
    this.snWarn -= dt;
    this.renderer.sync(w, this.cam, dt, {
      damage: this.damage,
      forceSky: this.forceSky,
      snap: this.snapExposure,
      frame: this.frame,
      feed: this.feedMass,
    });
    this.forceSky = false;
    this.snapExposure = false;
    this.feedMass = Math.max(0, this.feedMass - dt * 0.5);
    this.renderer.render();

    if (this.state === 'playing' || this.state === 'paused') {
      this.updateMarkers(dt);
      this.hud.update(dt, w, this);
      if (this.hudOn) this.hud.draw(w, this, (x, y, z) => this.project(x, y, z));
    }
    this.audio.update({
      stage: p.stage,
      star: p.isStar,
      compact: !!p.compact,
      jet: w.input.level,
      boost: w.input.boost,
      stress: w.tidalStress,
      ablate: w.heatLoss,
      paused: this.state !== 'playing',
    });
    inp.endFrame();
    const loading = $('loading');
    if (loading && !loading.classList.contains('done')) {
      loading.classList.add('done');
      setTimeout(() => loading.remove(), 900);
    }
  }

  handleInput(dt) {
    const inp = this.input, w = this.world, cam = this.cam;
    cam.look(inp.mouseDX, inp.mouseDY, this.settings.sens, this.settings.invert);
    // arrow keys can also look around
    const ak = 1.6 * dt;
    if (inp.down('ArrowLeft')) cam.yaw += ak;
    if (inp.down('ArrowRight')) cam.yaw -= ak;
    if (inp.down('ArrowUp')) cam.pitch = clamp(cam.pitch + ak, -1.5, 1.5);
    if (inp.down('ArrowDown')) cam.pitch = clamp(cam.pitch - ak, -1.5, 1.5);
    if (inp.wheel) cam.zoomBy(inp.wheel);
    if (inp.hit('Equal') || inp.hit('NumpadAdd')) cam.zoomBy(-2);
    if (inp.hit('Minus') || inp.hit('NumpadSubtract')) cam.zoomBy(2);
    const f = cam.forward, r = cam.right, u = cam.up;
    let tx = 0, ty = 0, tz = 0;
    if (inp.down('KeyW')) { tx += f.x; ty += f.y; tz += f.z; }
    if (inp.down('KeyS')) { tx -= f.x; ty -= f.y; tz -= f.z; }
    if (inp.down('KeyD')) { tx += r.x; ty += r.y; tz += r.z; }
    if (inp.down('KeyA')) { tx -= r.x; ty -= r.y; tz -= r.z; }
    if (inp.down('Space')) { tx += u.x; ty += u.y; tz += u.z; }
    if (inp.down('KeyC') || inp.down('ControlLeft')) { tx -= u.x; ty -= u.y; tz -= u.z; }
    const l = Math.hypot(tx, ty, tz);
    w.input.thrust = l > 0 ? { x: tx / l, y: ty / l, z: tz / l } : { x: 0, y: 0, z: 0 };
    w.input.level = l > 0 ? 1 : 0;
    w.input.boost = inp.down('ShiftLeft') || inp.down('ShiftRight');
    w.input.brake = inp.down('KeyX');
    w.input.pull = inp.down('KeyE');
    w.input.target = this.target && this.target.alive ? this.target : null;
    if (inp.hit('KeyT')) {
      if (this.target && (!this.aim || this.aim === this.target)) this.target = null;
      else if (this.aim) { this.target = this.aim; this.audio.blip(); }
    }
    if (inp.hit('Tab')) this.lockNearestFood();
    if (inp.hit('Period')) w.setWarp(w.warpIndex + 1);
    if (inp.hit('Comma')) w.setWarp(w.warpIndex - 1);
    if (inp.hit('KeyH')) { this.hudOn = !this.hudOn; this.hud.show(this.hudOn); }
    if (inp.hit('Enter')) this.hud.hideCard();
    if (inp.hit('Escape') || inp.hit('KeyP')) this.pause();
  }

  lockNearestFood() {
    const p = this.world.player;
    let best = null, bd = Infinity;
    for (const b of this.world.bodies) {
      if (!b.alive || b === p || b.role === 'fragment') continue;
      if (b.mass > p.mass * 0.9 || b.mass < p.mass * 0.004 || (b.compact && !p.compact)) continue;
      const d = p.distTo(b);
      if (d < bd) { bd = d; best = b; }
    }
    if (best) { this.target = best; this.audio.blip(); }
  }

  // screen position in CSS pixels
  project(x, y, z) {
    const cam = this.renderer.camera;
    const S = this.cam.S;
    const v = new THREE.Vector3((x - this.cam.pos.x) / S, (y - this.cam.pos.y) / S, (z - this.cam.pos.z) / S);
    const dist = v.length();
    v.applyMatrix4(cam.matrixWorldInverse);
    const behind = v.z > 0;
    const ndc = v.clone().applyMatrix4(cam.projectionMatrix);
    const W = window.innerWidth, H = window.innerHeight;
    let sx = (ndc.x * 0.5 + 0.5) * W, sy = (-ndc.y * 0.5 + 0.5) * H;
    if (behind) { sx = W - sx; sy = H - sy; }
    const on = !behind && sx > 0 && sx < W && sy > 0 && sy < H;
    return { x: sx, y: sy, on, dx: (sx - W / 2) * (behind ? -1 : 1), dy: (sy - H / 2) * (behind ? -1 : 1), dist };
  }

  updateMarkers(dt) {
    this.markerTimer -= dt;
    const w = this.world, p = w.player;
    if (!p.alive) { this.markers = []; return; }
    const H = window.innerHeight;
    const focalCss = (H * 0.5) / Math.tan((this.renderer.camera.fov * Math.PI) / 360);
    if (this.markerTimer <= 0) {
      this.markerTimer = 0.1;
      // what's under the crosshair?
      const fwd = this.cam.forward;
      let best = null, bestScore = Infinity;
      const food = [], danger = [];
      for (const b of w.bodies) {
        if (!b.alive || b === p || b.role === 'fragment') continue;
        const dx = b.x - this.cam.pos.x, dy = b.y - this.cam.pos.y, dz = b.z - this.cam.pos.z;
        const d = Math.hypot(dx, dy, dz);
        const cos = (dx * fwd.x + dy * fwd.y + dz * fwd.z) / d;
        const ang = Math.acos(clamp(cos, -1, 1));
        const angR = Math.atan(this.renderer.visualRadius(b) / d);
        const score = ang - angR;
        if (score < 0.06 && score < bestScore && d < p.rEff * 4000 + b.rEff * 50) { bestScore = score; best = b; }
        const dp = p.distTo(b);
        if ((b.mass > p.mass || (b.compact && !p.compact)) && dp < p.rEff * 90 + b.rEff * 3) danger.push([dp, b]);
        else if (b.mass > p.mass * 0.03 && b.mass <= p.mass && dp < p.rEff * 70) food.push([dp, b]);
      }
      this.aim = best;
      food.sort((a, b) => a[0] - b[0]);
      danger.sort((a, b) => a[0] - b[0]);
      const m = [];
      if (this.target && this.target.alive) m.push({ body: this.target, kind: 'lock', label: 'LOCK' });
      if (best && best !== this.target) m.push({ body: best, kind: 'aim' });
      for (const [, b] of danger.slice(0, 4)) if (b !== best && b !== this.target) m.push({ body: b, kind: 'tick', label: 'BIGGER' });
      for (const [, b] of food.slice(0, 6)) if (b !== best && b !== this.target) m.push({ body: b, kind: 'tick' });
      this.markers = m;
    }
    // projected radii (needed every frame for brackets)
    for (const mk of this.markers) {
      const b = mk.body;
      const d = Math.hypot(b.x - this.cam.pos.x, b.y - this.cam.pos.y, b.z - this.cam.pos.z);
      mk.vr = this.renderer.visualRadius(b);
      mk.r = (mk.vr / d) * focalCss;
    }
  }

  // ---------------------------------------------------------------- events

  processEvents() {
    const w = this.world, p = w.player, hud = this.hud;
    let jetEvent = null, ablate = null;
    for (const e of w.events) {
      switch (e.type) {
        case 'impact': {
          const rel = e.rel;
          if (e.fragment) {
            this.eatAcc.n++;
            this.eatAcc.m += e.gain;
            if (rel > 0.0005) this.spawnImpact(e, 0.5);
          } else {
            this.spawnImpact(e, 1);
            if (rel > 0.001) {
              const pct = (e.gain / Math.max(p.mass - e.gain, 1)) * 100;
              if (e.ejecta > e.mass * 0.5) hud.log(`Hit ${e.name} too fast: blasted off ${F.percent(e.ejecta / p.mass, 1)} of yourself`, 'bad');
              else hud.log(`Swallowed ${e.label.toLowerCase()} ${e.name} (+${pct.toFixed(pct < 1 ? 2 : 1)}%)`, rel > 0.08 ? 'big' : 'food');
              if (e.life) hud.log(e.life === 2 ? 'That world held a civilisation' : 'That world was alive', 'big');
            }
          }
          const size = clamp(Math.sqrt(rel) * 1.6 + Math.min(e.energy, 3) * 0.1, 0, 1.1);
          if (size > 0.03) {
            this.audio.impact(size, e.ejecta > 0 ? clamp(e.ejecta / e.mass, 0, 1) : 0);
            this.cam.addShake(size * 0.9);
          }
          if (e.ejecta > e.mass * 0.3) this.damage = Math.min(1, this.damage + 0.5);
          if (p.compact) this.feedMass = Math.min(1, this.feedMass + Math.sqrt(rel) * 2);
          break;
        }
        case 'disrupt':
          hud.log(`Tearing ${e.name} apart`, 'info');
          break;
        case 'shatter':
          if (e.mass > p.mass * 0.01) {
            hud.log(`${e.name} broke up into a debris stream`, 'big');
            this.spawnPuff(e.body, 1);
          }
          break;
        case 'moon':
          hud.log('Captured a moon. It will slowly spiral in (hold E to pull)', 'big');
          break;
        case 'stripped':
          this.spawnStrip(e.from, e.depth);
          break;
        case 'jet':
          jetEvent = e;
          break;
        case 'ablate':
          ablate = e;
          break;
        case 'storm':
          this.stormWarn = 6;
          this.stormText = e.comet ? 'Comet swarm incoming: they hit hard, match their speed to eat them' : 'Asteroid swarm incoming';
          hud.log(e.comet ? 'Comet swarm detected' : 'Asteroid swarm detected', 'bad');
          break;
        case 'sn-warning':
          this.snWarn = 16;
          this.snText = `Neutrino burst from ${e.name}: a supernova is coming`;
          hud.log(`Neutrinos detected from ${e.name} (${F.distance(e.dist)} away)`, 'bad');
          break;
        case 'supernova':
          this.renderer.flash = e.self ? 3 : 1.4;
          this.renderer.finalPass.uniforms.uFlashColor.value.setRGB(0.85, 0.9, 1.0);
          this.audio.cataclysm();
          this.cam.addShake(e.self ? 1.5 : 0.6);
          this.spawnShell(e.x, e.y, e.z);
          if (e.self) {
            hud.log(e.toBH ? 'Your core collapsed into a black hole' : 'Your core collapsed into a neutron star', 'big');
          } else hud.log(`${e.name} exploded as a supernova`, 'bad');
          break;
        case 'blast-hit':
          if (e.frac > 0.001) {
            hud.log(`Supernova blast wave hit you: lost ${F.percent(e.frac, 1)}`, 'bad');
            this.damage = 1;
            this.cam.addShake(1);
            this.audio.impact(1, 0.8);
          } else hud.log('The supernova blast wave washed over you', 'info');
          break;
        case 'stage': {
          const to = e.to;
          if (e.from < 0) break;
          const st = STAGES[to];
          const major = to === STAGE_INDEX.reddwarf || STAGES[to].compact;
          if (to === STAGE_INDEX.reddwarf && e.up) {
            this.renderer.flash = 2;
            this.renderer.finalPass.uniforms.uFlashColor.value.setRGB(1, 0.75, 0.45);
            hud.log('Hydrogen fusion ignited: you are a star', 'big');
          } else if (to === STAGE_INDEX.browndwarf) {
            hud.log('Deuterium fusion flickers to life in your core', 'big');
          } else if (e.up) {
            hud.log(`You are now a ${st.name.toLowerCase()}`, 'big');
          } else {
            hud.log(`You shrank back to a ${st.name.toLowerCase()}`, 'bad');
          }
          if (e.up) {
            hud.showCard(to, major ? 'Transformation' : 'New stage');
            this.audio.swell(major);
            this.save();
          }
          break;
        }
        case 'core-start':
          hud.log('Your core has started fusing heavier elements. Collapse is coming.', 'bad');
          break;
        case 'core-stage':
          hud.log(`Core now fusing ${e.el.toLowerCase()}`, 'info');
          break;
        case 'collapse':
          this.renderer.flash = 1.5;
          this.audio.cataclysm();
          hud.log('Too heavy: you collapsed into a black hole', 'big');
          break;
        case 'life':
          hud.log(e.level === 2 ? 'A civilisation has risen on your world. Look at the night side.' : 'Life has appeared in your oceans', 'big');
          break;
        case 'life-lost':
          hud.log('The life on your world is gone', 'bad');
          break;
        case 'warp':
          if (e.auto) hud.log(`Time warp dropped: ${e.reason || 'something is close'}`, 'info');
          else hud.log(e.level > 1 ? `Time warp ×${e.level}` : 'Normal time', 'info');
          break;
        case 'warp-blocked':
          hud.log(`Can't warp faster: ${e.reason || 'too close to something big'}`, 'bad');
          break;
        case 'nebula-feed':
          this.eatAcc.m += e.gain;
          break;
        case 'death':
          this.onDeath(e);
          break;
        case 'reborn':
          hud.log(`Re-formed near ${e.sys}`, 'info');
          break;
        default:
          break;
      }
    }
    w.events.length = 0;
    if (jetEvent) this.spawnJet(jetEvent);
    if (ablate) this.spawnTail(ablate);
    // summarise small stuff
    this.eatAcc.t += 1 / 60;
    if (this.eatAcc.t > 2.5) {
      if (this.eatAcc.m > p.mass * 0.004) hud.log(`Accreted debris (+${F.percent(this.eatAcc.m / p.mass, 1)})`, 'food');
      this.eatAcc = { n: 0, m: 0, t: 0 };
    }
  }

  onDeath(e) {
    this.state = 'dead';
    this.input.enabled = false;
    this.input.releaseLock();
    this.deathMass = e.mass;
    this.renderer.flash = 1.2;
    this.renderer.finalPass.uniforms.uFlashColor.value.setRGB(1, 0.5, 0.35);
    this.audio.cataclysm();
    this.spawnPuff({ x: e.x, y: e.y, z: e.z, vx: this.world.player.vx, vy: this.world.player.vy, vz: this.world.player.vz, radius: this.world.player.radius, comp: this.world.player.comp }, 2);
    const s = this.world.stats;
    $('death-cause').textContent = e.cause;
    $('death-stats').innerHTML = [
      ['Mass at death', F.massFriendly(e.mass)],
      ['Peak mass', F.massFriendly(s.peakMass)],
      ['Bodies eaten', s.eaten.toLocaleString('en-US')],
      ['Biggest meal', F.massShort(s.biggestMeal || 0)],
      ['Star systems eaten', String(s.systemsEaten)],
      ['Deaths', String(s.deaths)],
    ].map(([a, b]) => `<div><span>${a}</span>${b}</div>`).join('');
    setTimeout(() => { if (this.state === 'dead') $('death').hidden = false; }, 1800);
    removeKey(SAVE_KEY);
  }

  // ---------------------------------------------------------------- effects

  compColor(c) {
    if (c.gas > 0.5) return [0.75, 0.68, 0.55];
    if (c.ice > 0.4) return [0.7, 0.76, 0.82];
    if (c.iron > 0.5) return [0.35, 0.34, 0.33];
    return [0.32, 0.29, 0.26];
  }

  spawnImpact(e, scale) {
    const p = this.world.player, fx = this.renderer.fx;
    const R = this.renderer.visualRadius(p);
    const d = e.dir;
    const n = Math.round(clamp(4 + 70 * Math.sqrt(e.rel), 3, 80) * scale);
    const col = this.compColor(e.body.comp || p.comp);
    const hot = clamp(e.energy * 0.8, 0, 1);
    const vScale = R / TIME_BASE;
    for (let i = 0; i < n; i++) {
      const j = randUnit();
      // spray out of the hemisphere facing the impact
      let ox = d.x + j.x * 0.8, oy = d.y + j.y * 0.8, oz = d.z + j.z * 0.8;
      const l = Math.hypot(ox, oy, oz) || 1;
      ox /= l; oy /= l; oz /= l;
      const sp = (0.6 + Math.random() * 2.6) * vScale * (0.6 + hot);
      const glow = Math.random() < hot * 0.7 || p.isStar || p.compact;
      const c = glow ? blackbody(1200 + hot * 2500 + (p.isStar ? 3000 : 0)) : col;
      fx.spawn({
        x: p.x + d.x * R * 1.01, y: p.y + d.y * R * 1.01, z: p.z + d.z * R * 1.01,
        vx: p.vx + ox * sp, vy: p.vy + oy * sp, vz: p.vz + oz * sp,
        life: 0.8 + Math.random() * 1.8,
        size: R * (glow ? 0.025 : 0.05) * (0.5 + Math.random()) * clamp(0.6 + e.rel * 6, 0.6, 3),
        grow: glow ? 0.6 : 2.2,
        r: c[0] * (glow ? 2.5 : 1), g: c[1] * (glow ? 2.5 : 1), b: c[2] * (glow ? 2.5 : 1), a: glow ? 1 : 0.85,
        glow, drag: 0.6,
      });
    }
  }

  spawnPuff(b, scale) {
    const fx = this.renderer.fx;
    const R = b.radius || this.renderer.visualRadius(this.world.player);
    const col = this.compColor(b.comp || { rock: 1, iron: 0, ice: 0, gas: 0 });
    const vScale = R / TIME_BASE;
    for (let i = 0; i < 40 * scale; i++) {
      const j = randUnit();
      const sp = (0.2 + Math.random()) * vScale * 1.5;
      fx.spawn({
        x: b.x + j.x * R, y: b.y + j.y * R, z: b.z + j.z * R,
        vx: (b.vx || 0) + j.x * sp, vy: (b.vy || 0) + j.y * sp, vz: (b.vz || 0) + j.z * sp,
        life: 2 + Math.random() * 2, size: R * 0.3 * (0.5 + Math.random()), grow: 3,
        r: col[0], g: col[1], b: col[2], a: 0.5, glow: false, drag: 0.3,
      });
    }
  }

  spawnJet(e) {
    const w = this.world, p = w.player, fx = this.renderer.fx;
    const R = this.renderer.visualRadius(p);
    const vScale = p.rEff / TIME_BASE;
    const n = Math.round((e.boost ? 7 : 3) * (this.settings.quality === 'low' ? 0.5 : 1));
    if (p.compact === 'bh') {
      // relativistic jets shoot along the spin axis, both ways
      const ax = Math.sin(p.tilt), ay = Math.cos(p.tilt);
      for (let i = 0; i < n * 2; i++) {
        const s = i % 2 ? 1 : -1;
        const j = randUnit();
        const sp = (14 + Math.random() * 10) * vScale;
        fx.spawn({
          x: p.x + ax * s * R * 1.5, y: p.y + ay * s * R * 1.5, z: p.z,
          vx: p.vx + (ax * s + j.x * 0.03) * sp, vy: p.vy + (ay * s + j.y * 0.03) * sp, vz: p.vz + j.z * 0.03 * sp,
          life: 1.2, size: p.rEff * 0.08, grow: 2.5, r: 0.6, g: 0.75, b: 1.6, a: 1, glow: true,
        });
      }
      return;
    }
    const star = p.isStar;
    const gas = p.comp.gas > 0.4 && !star;
    for (let i = 0; i < n; i++) {
      const j = randUnit();
      let dx = e.x + j.x * 0.25, dy = e.y + j.y * 0.25, dz = e.z + j.z * 0.25;
      const l = Math.hypot(dx, dy, dz) || 1;
      dx /= l; dy /= l; dz /= l;
      const sp = (2.5 + Math.random() * 3) * vScale * (e.boost ? 1.6 : 1);
      // plumes leave from a few vents on the side facing away from your thrust
      const vent = randUnit();
      const sx = e.x + vent.x * 0.25, sy = e.y + vent.y * 0.25, sz = e.z + vent.z * 0.25;
      const sl = Math.hypot(sx, sy, sz) || 1;
      const ox = p.x + (sx / sl) * R, oy = p.y + (sy / sl) * R, oz = p.z + (sz / sl) * R;
      let c, glow, size;
      if (star) { c = blackbody(p.starTemp * 0.9); glow = true; size = R * 0.12; }
      else if (gas) { c = [0.8, 0.75, 0.68]; glow = Math.random() < 0.3; size = R * 0.08; }
      else {
        glow = Math.random() < 0.35;
        c = glow ? blackbody(1300 + Math.random() * 500) : [0.22, 0.2, 0.19];
        size = R * (glow ? 0.03 : 0.07);
      }
      fx.spawn({
        x: ox, y: oy, z: oz,
        vx: p.vx + dx * sp, vy: p.vy + dy * sp, vz: p.vz + dz * sp,
        life: 0.7 + Math.random() * 0.9, size: size * (0.6 + Math.random() * 0.8), grow: glow ? 1.2 : 3,
        r: c[0] * (glow ? 2.2 : 1), g: c[1] * (glow ? 2.2 : 1), b: c[2] * (glow ? 2.2 : 1),
        a: glow ? 1 : 0.7, glow, drag: 0.4,
      });
    }
  }

  spawnTail(e) {
    const p = this.world.player, fx = this.renderer.fx, s = e.source;
    if (!s) return;
    const R = this.renderer.visualRadius(p);
    let ux = p.x - s.x, uy = p.y - s.y, uz = p.z - s.z;
    const l = Math.hypot(ux, uy, uz) || 1;
    ux /= l; uy /= l; uz /= l;
    const vScale = R / TIME_BASE;
    const n = Math.min(6, Math.ceil(e.rate * 300));
    for (let i = 0; i < n; i++) {
      const j = randUnit();
      const ion = e.ice > 0 && Math.random() < 0.5;
      const sp = (ion ? 6 : 2.5) * vScale * (0.6 + Math.random() * 0.8);
      const c = ion ? [0.35, 0.6, 1.2] : e.ice > 0 ? [0.9, 0.9, 0.85] : [1.4, 0.6, 0.25];
      fx.spawn({
        x: p.x + (j.x - ux) * R * 0.9, y: p.y + (j.y - uy) * R * 0.9, z: p.z + (j.z - uz) * R * 0.9,
        vx: p.vx + (ux + j.x * 0.15) * sp, vy: p.vy + (uy + j.y * 0.15) * sp, vz: p.vz + (uz + j.z * 0.15) * sp,
        life: 1.5 + Math.random() * 1.5, size: R * (ion ? 0.12 : 0.2), grow: 3.5,
        r: c[0], g: c[1], b: c[2], a: ion ? 0.6 : 0.35, glow: true,
      });
    }
  }

  spawnStrip(src, depth) {
    const p = this.world.player, fx = this.renderer.fx;
    const R = this.renderer.visualRadius(p);
    let ux = src.x - p.x, uy = src.y - p.y, uz = src.z - p.z;
    const l = Math.hypot(ux, uy, uz) || 1;
    ux /= l; uy /= l; uz /= l;
    const vScale = R / TIME_BASE;
    const n = Math.ceil(2 + depth * 8);
    const col = this.compColor(p.comp);
    for (let i = 0; i < n; i++) {
      const j = randUnit();
      const side = Math.random() < 0.7 ? 1 : -1;
      const sp = (1.5 + Math.random() * 3) * vScale;
      const glow = Math.random() < 0.3;
      const c = glow ? blackbody(1500) : col;
      fx.spawn({
        x: p.x + (ux * side + j.x * 0.3) * R, y: p.y + (uy * side + j.y * 0.3) * R, z: p.z + (uz * side + j.z * 0.3) * R,
        vx: p.vx + ux * side * sp, vy: p.vy + uy * side * sp, vz: p.vz + uz * side * sp,
        life: 1.6, size: R * 0.06, grow: 2.5, r: c[0] * (glow ? 2 : 1), g: c[1] * (glow ? 2 : 1), b: c[2] * (glow ? 2 : 1), a: 0.8, glow, drag: 0,
      });
    }
  }

  spawnShell(x, y, z) {
    const fx = this.renderer.fx;
    const sp = 9000;
    for (let i = 0; i < 500; i++) {
      const j = randUnit();
      const k = 0.85 + Math.random() * 0.3;
      const hot = Math.random();
      const c = hot < 0.5 ? [1.6, 0.35, 0.45] : hot < 0.8 ? [0.4, 1.0, 1.1] : [1.6, 1.5, 1.4];
      fx.spawn({
        x, y, z, vx: j.x * sp * k, vy: j.y * sp * k, vz: j.z * sp * k,
        life: 14, size: 2e6, grow: 40, r: c[0], g: c[1], b: c[2], a: 0.7, glow: true,
      });
    }
  }
}

function randUnit() {
  const z = Math.random() * 2 - 1;
  const t = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return { x: r * Math.cos(t), y: z, z: r * Math.sin(t) };
}

function boot() {
  try {
    window.game = new Game();
  } catch (err) {
    const el = document.createElement('div');
    el.id = 'error';
    el.textContent = `Accretion could not start: ${err?.message || err}. It needs a browser with WebGL 2.`;
    document.body.appendChild(el);
    const l = $('loading');
    if (l) l.remove();
    throw err;
  }
}

// let the loading text paint before the heavy galaxy generation
requestAnimationFrame(() => setTimeout(boot, 30));

export { M_SUN };
