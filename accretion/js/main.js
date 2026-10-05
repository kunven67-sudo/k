// Accretion: grow from a clump of rock into a planet, a star, a black hole.
import * as THREE from 'three';
import { Galaxy } from './world/galaxy.js';
import { World } from './world/world.js';
import { Renderer } from './render/renderer.js';
import { Input, ChaseCamera } from './game/controls.js';
import { HUD } from './ui/hud.js';
import { Rumble } from './audio/audio.js';
import { Saves, makeCode, readCode } from './game/saves.js';
import { FXSpawner } from './game/effects.js';
import * as F from './core/format.js';
import { FORM, M_SUN, M_EARTH, WARP_LEVELS, DEEP_LEVELS } from './core/constants.js';
import { clamp, tierOf } from './core/phys.js';
import { LIFE_STAGES } from './world/life.js';
import { probe as probeAt } from './world/planet.js';
import { installSheets } from './ui/sheets.js';
import { Goals } from './ui/goals.js';
import { Tips } from './ui/tips.js';
import { Book } from './ui/book.js';
import { Scope } from './ui/scope.js';
import { GalaxyMap } from './ui/map.js';
import { Galaxy as GalaxyClass } from './world/galaxy.js';

const $ = (id) => document.getElementById(id);

const DEFAULT_SETTINGS = {
  quality: 'high', sens: 1, invert: false, volume: 0.8, hints: true,
  flash: false, shake: true, big: false, cb: false, hud: 'full',
};

class Game {
  constructor() {
    this.saves = new Saves();
    this.settings = { ...DEFAULT_SETTINGS, ...(this.saves.getSettings() || {}) };
    this.profile = this.saves.getProfile();
    this.applyComfort();
    this.canvas = $('view');
    const latest = this.saves.latest();
    this.continueSlot = latest ? latest.id : null;
    const save = latest ? this.saves.load(latest.id) : null;
    this.newWorld(save, save ? { mode: save.mode || 'survival', challenge: save.challenge || null } : { mode: 'survival' });
    if (!save) this.continueSlot = null;
    this.renderer = new Renderer(this.canvas, this.galaxy, this.settings);
    this.input = new Input(this.canvas, this.settings);
    this.cam = new ChaseCamera();
    this.hud = new HUD();
    this.hud.setMode(this.settings.hud);
    this.hud.show(false);
    this.audio = new Rumble();
    this.audio.volume = this.settings.volume;
    this.fx = new FXSpawner(this);
    this.state = 'title';
    this.frame = { vx: 0, vy: 0, vz: 0 };
    this.target = null;
    this.aim = null;
    this.markers = [];
    this.damage = 0;
    this.saveTimer = 30;
    this.eatAcc = { n: 0, m: 0, t: 0 };
    this.stormWarn = 0;
    this.snWarn = 0;
    this.forceSky = true;
    this.last = performance.now();
    this.markerTimer = 0;
    this.feedMass = 0;
    this.newMode = 'survival';
    this.bindUI();
    this.goals = new Goals(this);
    this.tips = new Tips(this);
    this.book = new Book(this);
    this.scope = new Scope(this);
    this.map = new GalaxyMap(this);
    this.renderMap = (dt) => this.map.render(dt);
    installSheets(this, { goals: this.goals, book: this.book, scope: this.scope, map: this.map });
    this.onEvent = (e) => { this.goals.onEvent(e); this.tips.onEvent(e); this.book.onEvent(e); };
    const ef = this.everyFrame;
    this.everyFrame = (dt) => { ef?.(dt); this.goals.update(dt); this.tips.update(dt); this.book.update(dt); };
    this.onPlayStart = (fresh) => { if (fresh && this.tutorialOn) this.tips.startTutorial(); };
    window.addEventListener('resize', () => { this.renderer.resize(); this.hud.resize(); });
    window.addEventListener('beforeunload', () => this.autosave());
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.state === 'playing' && this.wasLocked && !this.sheet) this.pause();
      this.wasLocked = !!document.pointerLockElement;
    });
    this.snapCamera();
    requestAnimationFrame((t) => this.loop(t));
  }

  // ---------------------------------------------------------------- worlds

  newWorld(save, opts = {}) {
    const seed = save?.galaxy?.seed ?? ((Math.random() * 1e9) | 0);
    this.galaxy = new Galaxy(seed);
    if (save) this.galaxy.restore(save.galaxy);
    this.mode = opts.mode || 'survival';
    this.challenge = opts.challenge || null;
    this.world = new World(this.galaxy, { quality: this.settings.quality, sandbox: this.mode === 'sandbox' });
    this.world.mode = this.mode;
    if (save) {
      this.world.time = save.time || 0;
      Object.assign(this.world.stats, save.stats || {});
      this.world.spawnPlayer({ ...save.player, modules: save.modules });
      if (save.sandbox) Object.assign(this.world, save.sandbox);
    } else {
      const start = typeof opts.start === 'function' ? opts.start(this.galaxy) : opts.start;
      this.world.spawnPlayer(start || null);
      if (opts.name) this.world.player.name = opts.name;
    }
    this.challengeDone = !!save?.challengeDone;
    this.challengeFailed = false;
    this.formStart = { form: this.world.player.form, mass: save?.formStart?.mass ?? this.world.player.mass };
    this.waypoint = save?.waypoint && this.map ? this.map.findRec(save.waypoint) : null;
    this.markedNear = null;
    this.markTimer = 0;
    this.world.lastForm = this.world.player.form;
  }

  // throw away this galaxy and make (or load) another
  switchWorld(save, opts) {
    this.newWorld(save, opts);
    this.renderer.setGalaxy(this.galaxy);
    this.target = null;
    this.markers = [];
    this.forceSky = true;
    this.snapCamera();
  }

  snapCamera() {
    this.cam.update(this.world.player, this.renderer.cameraScale(this.world.player), 0.016, { snap: true });
    this.snapExposure = true;
  }

  saveMeta() {
    const p = this.world.player;
    return {
      name: p.name, form: FORM[p.form]?.name || p.typeLabel, mass: F.massShort(p.mass),
      age: F.yearsShort(Math.max(0, this.world.years - (p.born || 0))), mode: this.mode,
      life: this.world.life?.stage ? LIFE_STAGES[this.world.life.stage].name : null,
    };
  }

  snapshot() {
    const d = this.world.serialize();
    d.mode = this.mode;
    d.challenge = this.challenge;
    d.formStart = this.formStart;
    d.challengeDone = !!this.challengeDone;
    if (this.waypoint) d.waypoint = this.waypoint.id;
    if (this.mode === 'sandbox') d.sandbox = { invincible: this.world.invincible, sandboxTime: this.world.sandboxTime, sandboxHazards: this.world.sandboxHazards };
    return d;
  }

  autosave() {
    if (this.state === 'title' || !this.world?.player?.alive) return;
    this.saves.save('auto', this.snapshot(), this.saveMeta());
    this.continueSlot = 'auto';
  }

  saveSettings() {
    this.saves.setSettings(this.settings);
  }

  applyComfort() {
    const b = document.body.classList;
    b.toggle('big-text', !!this.settings.big);
    b.toggle('cb', !!this.settings.cb);
    b.toggle('calm', !!this.settings.flash);
    this.hud?.readColors();
  }

  // ---------------------------------------------------------------- UI wiring

  bindUI() {
    const s = this.settings;
    $('btn-continue').hidden = !this.continueSlot;
    $('btn-continue').addEventListener('click', () => this.play());
    const panels = ['panel-new', 'panel-saves', 'panel-controls', 'panel-settings'];
    const toggle = (id) => {
      const el = $(id);
      const open = el.hidden;
      for (const p of panels) $(p).hidden = true;
      el.hidden = !open;
      if (id === 'panel-saves' && open) this.renderSlots();
    };
    $('btn-new').addEventListener('click', () => toggle('panel-new'));
    $('btn-load').addEventListener('click', () => toggle('panel-saves'));
    $('btn-controls').addEventListener('click', () => toggle('panel-controls'));
    $('btn-settings').addEventListener('click', () => toggle('panel-settings'));
    this.togglePanel = toggle;

    // new game
    for (const m of document.querySelectorAll('.mode')) {
      m.addEventListener('click', () => {
        this.newMode = m.dataset.mode;
        for (const o of document.querySelectorAll('.mode')) {
          o.classList.toggle('on', o === m);
          o.setAttribute('aria-checked', o === m ? 'true' : 'false');
        }
        $('chal-wrap').hidden = this.newMode !== 'challenge';
        this.renderChallenges?.();
      });
    }
    $('btn-start').addEventListener('click', () => this.startNew());

    // saves
    $('btn-code-make').addEventListener('click', async () => {
      $('code-note').textContent = 'Packing...';
      try {
        $('backup-code').value = await makeCode(this.snapshot());
        $('code-note').textContent = 'Code ready. Copy it somewhere safe.';
      } catch (err) { $('code-note').textContent = `Could not make a code: ${err.message}`; }
    });
    $('btn-code-copy').addEventListener('click', () => {
      const ta = $('backup-code');
      const done = () => { $('code-note').textContent = 'Copied.'; };
      navigator.clipboard?.writeText(ta.value).then(done, () => { ta.select(); $('code-note').textContent = 'Press Ctrl+C to copy.'; });
      if (!navigator.clipboard) { ta.select(); $('code-note').textContent = 'Press Ctrl+C to copy.'; }
    });
    $('btn-code-import').addEventListener('click', async () => {
      try {
        const data = await readCode($('backup-code').value);
        this.loadData(data);
        $('code-note').textContent = 'World restored.';
      } catch (err) { $('code-note').textContent = err.message; }
    });

    // pause
    $('btn-resume').addEventListener('click', () => this.resume());
    $('btn-p-saves').addEventListener('click', () => { this.movePanels(); toggle('panel-saves'); });
    $('btn-p-controls').addEventListener('click', () => { this.movePanels(); toggle('panel-controls'); });
    $('btn-p-settings').addEventListener('click', () => { this.movePanels(); toggle('panel-settings'); });
    $('btn-p-goals').addEventListener('click', () => { this.resume(); this.openSheet?.('goals'); });
    $('btn-quit').addEventListener('click', () => { $('quit-row').hidden = false; });
    $('btn-quit-no').addEventListener('click', () => { $('quit-row').hidden = true; });
    $('btn-quit-yes').addEventListener('click', () => this.toTitle());
    $('btn-reform').addEventListener('click', () => this.reform());
    $('btn-death-title').addEventListener('click', () => this.toTitle());

    // settings
    $('set-quality').value = s.quality;
    $('set-sens').value = s.sens;
    $('set-invert').checked = s.invert;
    $('set-volume').value = s.volume;
    $('set-hints').checked = s.hints;
    $('set-flash').checked = s.flash;
    $('set-shake').checked = s.shake;
    $('set-big').checked = s.big;
    $('set-cb').checked = s.cb;
    $('set-quality').addEventListener('change', (e) => {
      s.quality = e.target.value;
      this.saveSettings();
      this.autosave();
      location.reload();
    });
    $('set-sens').addEventListener('input', (e) => { s.sens = +e.target.value; this.saveSettings(); });
    $('set-invert').addEventListener('change', (e) => { s.invert = e.target.checked; this.saveSettings(); });
    $('set-volume').addEventListener('input', (e) => { s.volume = +e.target.value; this.audio.setVolume(s.volume); this.saveSettings(); });
    $('set-hints').addEventListener('change', (e) => { s.hints = e.target.checked; this.saveSettings(); this.applyHints(); });
    for (const [id, key] of [['set-flash', 'flash'], ['set-shake', 'shake'], ['set-big', 'big'], ['set-cb', 'cb']]) {
      $(id).addEventListener('change', (e) => { s[key] = e.target.checked; this.saveSettings(); this.applyComfort(); });
    }
    this.applyHints();
  }

  applyHints() {
    const k = document.querySelector('.keys');
    if (k) k.hidden = !this.settings.hints;
  }

  renderSlots() {
    const host = $('slots');
    host.innerHTML = '';
    const inGame = this.state !== 'title' && this.world.player.alive;
    for (const sl of this.saves.list()) {
      const row = document.createElement('div');
      row.className = 'slot';
      const label = sl.id === 'auto' ? 'Autosave' : `Slot ${sl.id.slice(4)}`;
      const m = sl.meta;
      const info = document.createElement('div');
      info.innerHTML = `<div>${label}${m ? ` · ${esc(m.name || '')}` : ''}</div><div class="meta">${m ? `${esc(m.form)} · ${esc(m.mass)} · age ${esc(m.age)}${m.life ? ` · ${esc(m.life)}` : ''} · ${esc(m.mode)} · ${new Date(m.date).toLocaleString()}` : 'Empty'}</div>`;
      const acts = document.createElement('div');
      acts.className = 'acts';
      const mk = (txt, fn, dis = false, cls = '') => {
        const b = document.createElement('button');
        b.className = `btn small ${cls}`;
        b.textContent = txt;
        b.disabled = dis;
        b.addEventListener('click', fn);
        acts.appendChild(b);
      };
      if (sl.id !== 'auto') mk('Save here', () => { this.saves.save(sl.id, this.snapshot(), this.saveMeta()); this.renderSlots(); }, !inGame);
      mk('Load', () => { const d = this.saves.load(sl.id); if (d) this.loadData(d); }, !m);
      mk('Delete', () => { this.saves.remove(sl.id); if (this.continueSlot === sl.id) this.continueSlot = null; this.renderSlots(); }, !m, 'danger');
      row.append(info, acts);
      host.appendChild(row);
    }
  }

  loadData(data) {
    this.switchWorld(data, { mode: data.mode || 'survival', challenge: data.challenge || null });
    this.onWorldLoaded?.();
    this.play(true);
  }

  movePanels() {
    const host = $('pause-panels');
    for (const id of ['panel-saves', 'panel-controls', 'panel-settings']) {
      if ($(id).parentElement !== host) host.appendChild($(id));
    }
  }

  restorePanels() {
    const host = document.querySelector('#title .screen-inner');
    for (const id of ['panel-new', 'panel-saves', 'panel-controls', 'panel-settings']) {
      host.appendChild($(id));
      $(id).hidden = true;
    }
  }

  startNew() {
    const mode = this.newMode;
    const name = $('new-name').value.trim();
    const chal = mode === 'challenge' ? this.selectedChallenge : null;
    if (mode === 'challenge' && !chal) { $('new-note').textContent = 'Pick a challenge first.'; return; }
    const opts = { mode, name: name || null, challenge: chal ? chal.id : null, start: chal?.start || null };
    this.switchWorld(null, opts);
    if (mode === 'sandbox') { this.world.invincible = true; this.world.sandboxTime = true; this.world.sandboxHazards = false; }
    chal?.setup?.(this);
    this.tutorialOn = $('new-tutorial').checked;
    this.onWorldLoaded?.();
    this.play(true);
  }

  play(fresh = false) {
    $('title').hidden = true;
    $('pause').hidden = true;
    $('death').hidden = true;
    this.restorePanels();
    this.state = 'playing';
    this.input.enabled = true;
    this.hud.setMode(this.settings.hud);
    this.audio.start();
    this.audio.setVolume(this.settings.volume);
    const p = this.world.player;
    if (!this.introShown || fresh) {
      this.introShown = true;
      this.hud.showCard(p.form, fresh ? 'You begin as' : 'Welcome back');
      const host = this.world.hostSystem();
      this.hud.log(host ? `In the ${this.world.field.env.label.toLowerCase()} of ${host.name}` : this.world.field.env.label, 'info');
      this.hud.log('Click the view to steer with the mouse', 'info');
      this.onPlayStart?.(fresh);
    }
    this.autosave();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.enabled = false;
    this.input.releaseLock();
    $('pause').hidden = false;
    $('quit-row').hidden = true;
    this.autosave();
  }

  resume() {
    $('pause').hidden = true;
    this.restorePanels();
    this.state = 'playing';
    this.input.enabled = true;
    this.last = performance.now();
  }

  toTitle() {
    this.autosave();
    $('pause').hidden = true;
    $('death').hidden = true;
    this.restorePanels();
    this.closeSheet?.();
    this.state = 'title';
    this.input.enabled = false;
    this.input.releaseLock();
    this.hud.show(false);
    $('title').hidden = false;
    $('btn-continue').hidden = !this.continueSlot;
    if (this.continueSlot) {
      const d = this.saves.load(this.continueSlot);
      if (d) this.switchWorld(d, { mode: d.mode, challenge: d.challenge });
    }
  }

  reform() {
    $('death').hidden = true;
    if (this.ended) { this.toTitle(); return; }
    const prev = this.deathMass || 1e15;
    this.renderer.fx.clear();
    this.world.rebirth(prev);
    this.formStart = { form: this.world.player.form, mass: this.world.player.mass };
    this.target = null;
    this.state = 'playing';
    this.input.enabled = true;
    this.snapCamera();
    this.forceSky = true;
    this.hud.showCard(this.world.player.form, 'Re-formed as');
    this.autosave();
  }

  // testing aid (from the browser console): jump straight to a mass, e.g. game.become(6e24)
  become(mass, opts = {}) {
    const w = this.world, p = w.player;
    p.mass = mass;
    if (opts.comp) p.comp = { rock: 0, iron: 0, ice: 0, carbon: 0, gas: 0, ...opts.comp };
    if (opts.comp) p.diet = { ...p.comp };
    p.compact = opts.compact ?? null;
    p.heat = opts.heat ?? 0;
    p.phase = opts.phase ?? null;
    p.swell = 1;
    p.updateRadius();
    for (const b of w.bodies) if (b.role === 'field' || b.role === 'fragment') b.alive = false;
    w.flushDead();
    w.core = null;
    w.rebuildAttractors();
    w.field.update(0, true);
    this.snapCamera();
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

  // the sim runs while playing (tools that cover the screen pause it)
  get simRunning() {
    return this.state === 'playing' && !this.sheetPauses;
  }

  step(dt) {
    const w = this.world;
    const inp = this.input;
    if (this.state === 'playing') {
      this.handleKeys(dt);
      if (this.simRunning) {
        this.handleInput(dt);
        w.update(dt);
        this.processEvents();
        this.fx.closeUp(dt);
        this.saveTimer -= dt;
        if (this.saveTimer <= 0) { this.saveTimer = 30; this.autosave(); }
      } else {
        w.events.length = 0;
      }
    } else {
      w.events.length = 0;
      if (this.state === 'title') this.cam.yaw += dt * 0.04;
    }
    this.everyFrame?.(dt);
    const p = w.player;
    if (p.alive) this.frame = w.referenceFrame(p.x, p.y, p.z, p);
    if (this.cam.mode !== 'chase') this.checkView();
    this.updateCutaway(dt);
    this.cam.update(p, this.renderer.cameraScale(p), dt, { boost: w.input.boost && w.input.level > 0, warp: w.deep ? 1 : w.warp });
    this.damage = Math.max(this.damage - dt * 0.8, w.tidalStress * 1.2, 0);
    this.stormWarn -= dt;
    this.snWarn -= dt;
    if (!this.mapOpen) {
      this.renderer.sync(w, this.cam, dt, {
        damage: this.damage,
        forceSky: this.forceSky,
        snap: this.snapExposure,
        frame: this.frame,
        feed: this.feedMass,
        game: this,
      });
      this.forceSky = false;
      this.snapExposure = false;
      this.renderer.render();
    } else this.renderMap?.(dt);
    this.feedMass = Math.max(0, this.feedMass - dt * 0.5);

    if (this.state === 'playing' || this.state === 'paused') {
      this.updateMarkers(dt);
      this.hud.update(dt, w, this);
      if (this.hud.mode !== 'off' && !this.sheet) this.hud.draw(w, this, (x, y, z) => this.project(x, y, z));
      else if (!this.mapOpen) this.hud.ctx.clearRect(0, 0, this.hud.el.overlay.width, this.hud.el.overlay.height);
    }
    this.audio.update({
      stage: tierOf(p.form),
      star: p.isStar,
      compact: !!p.compact,
      jet: this.simRunning ? w.input.level : 0,
      boost: w.input.boost,
      stress: this.simRunning ? w.tidalStress : 0,
      ablate: this.simRunning ? w.heatLoss : 0,
      paused: !this.simRunning,
      life: w.life,
      world: w,
    });
    inp.endFrame();
    const loading = $('loading');
    if (loading && !loading.classList.contains('done')) {
      loading.classList.add('done');
      setTimeout(() => loading.remove(), 900);
    }
  }

  // keys that work even while a tool is open
  handleKeys() {
    const inp = this.input;
    if (inp.hit('Escape')) {
      if (this.sheet) this.closeSheet();
      else if (this.photoOn) this.togglePhoto?.();
      else this.pause();
      return;
    }
    if (inp.hit('KeyP') && !this.sheet) { this.pause(); return; }
    const sheetKeys = { KeyI: 'info', KeyM: 'map', KeyL: 'scope', KeyJ: 'book', KeyG: 'goals', KeyZ: 'sandbox' };
    for (const [k, name] of Object.entries(sheetKeys)) {
      if (inp.hit(k)) {
        if (this.sheet === name) this.closeSheet();
        else this.openSheet?.(name);
      }
    }
    if (this.sheet) return;
    if (inp.hit('KeyF')) this.togglePhoto?.();
    if (inp.hit('KeyH')) {
      const order = ['full', 'minimal', 'off'];
      this.settings.hud = order[(order.indexOf(this.hud.mode) + 1) % 3];
      this.hud.setMode(this.settings.hud);
      this.saveSettings();
    }
    if (inp.hit('KeyV')) this.cycleView?.();
    if (inp.hit('KeyK')) this.toggleCutaway?.();
    if (inp.hit('KeyN')) this.cycleVision?.();
    if (inp.hit('Enter')) this.hud.hideCard();
  }

  handleInput(dt) {
    const inp = this.input, w = this.world, cam = this.cam;
    if (this.photoOn) { this.photoInput?.(dt); w.input.level = 0; return; }
    cam.look(inp.mouseDX, inp.mouseDY, this.settings.sens, this.settings.invert);
    const ak = (1.6 * dt) / 0.0022;
    if (inp.down('ArrowLeft')) cam.look(-ak, 0, 1, false);
    if (inp.down('ArrowRight')) cam.look(ak, 0, 1, false);
    if (inp.down('ArrowUp')) cam.look(0, -ak, 1, false);
    if (inp.down('ArrowDown')) cam.look(0, ak, 1, false);
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
    // thrusting pulls you out of deep time
    if (w.deep && (l > 0 || w.input.brake)) w.setDeep(0);
    if (inp.hit('KeyT')) {
      if (this.target && (!this.aim || this.aim === this.target)) this.target = null;
      else if (this.aim) { this.target = this.aim; this.audio.blip(); }
    }
    if (inp.hit('Tab')) this.lockNearestFood();
    if (inp.hit('Period')) this.timeFaster();
    if (inp.hit('Comma')) this.timeSlower();
  }

  // one time axis: normal, warp x10..x10,000, then deep time
  timeFaster() {
    const w = this.world;
    if (w.deep) { if (w.deep < DEEP_LEVELS.length + 1) w.setDeep(w.deep + 1); return; }
    if (w.warpIndex < WARP_LEVELS.length - 1) {
      const before = w.warpIndex;
      w.setWarp(w.warpIndex + 1);
      if (w.warpIndex !== before) return;
      // warp is blocked by something close: deep time can still work if you're calm in orbit
      if (w.maxWarpIndex() > before) return;
    }
    w.setDeep(1);
  }

  timeSlower() {
    const w = this.world;
    if (w.deep) { w.setDeep(w.deep - 1); return; }
    w.setWarp(w.warpIndex - 1);
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
      // your course and the systems you marked
      const g = this.galaxy;
      if (this.waypoint) {
        const q = GalaxyClass.localOf(this.waypoint, w.O);
        const d = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z);
        if (d < 2e12) { this.hud.log(`You've reached ${g.nameOf(this.waypoint)}`, 'info'); this.waypoint = null; }
        else m.push({ body: { ...q, alive: true, mass: 0, rEff: 0, radius: 0, name: g.nameOf(this.waypoint) }, kind: 'course', label: `${g.nameOf(this.waypoint)} \u00b7 ${F.distance(d)}` });
      }
      this.markTimer = (this.markTimer || 0) - 1;
      if (this.markTimer <= 0) {
        this.markTimer = 30;
        this.markedNear = [];
        for (const [id, st] of g.state) {
          if (!st.marked || (this.waypoint && this.waypoint.id === id)) continue;
          const rec = this.map.findRec(id);
          if (rec) this.markedNear.push(rec);
        }
      }
      for (const rec of this.markedNear || []) {
        const q = GalaxyClass.localOf(rec, w.O);
        const d = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z);
        if (d > 2e12 && d < 200 * 9.4607e12) m.push({ body: { ...q, alive: true, mass: 0, rEff: 0, radius: 0, name: g.nameOf(rec) }, kind: 'mark', label: `${g.nameOf(rec)} \u00b7 ${F.distance(d)}` });
      }
      this.markers = m;
    }
    for (const mk of this.markers) {
      const b = mk.body;
      const d = Math.hypot(b.x - this.cam.pos.x, b.y - this.cam.pos.y, b.z - this.cam.pos.z);
      mk.vr = this.renderer.visualRadius(b);
      mk.r = (mk.vr / d) * focalCss;
    }
  }

  // ---------------------------------------------------------------- events

  flash(amount, r, g, b) {
    const k = this.settings.flash ? 0.15 : 1;
    this.renderer.flash = Math.max(this.renderer.flash, amount * k);
    this.renderer.finalPass.uniforms.uFlashColor.value.setRGB(r, g, b);
  }

  shake(a) {
    if (this.settings.shake) this.cam.addShake(a);
  }

  processEvents() {
    const w = this.world, p = w.player, hud = this.hud, fx = this.fx;
    let jetEvent = null, ablate = null;
    for (const e of w.events) {
      this.onEvent?.(e);
      switch (e.type) {
        case 'impact': {
          const rel = e.rel;
          if (!p.isStar && !p.compact && (rel > 0.002 || (!e.fragment && rel > 0.0004))) this.renderer.addHit(p, e.dir, rel, e.energy);
          if (e.fragment) {
            this.eatAcc.n++;
            this.eatAcc.m += e.gain;
            if (rel > 0.0005) fx.spawnImpact(e, 0.5);
          } else {
            fx.spawnImpact(e, 1);
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
            this.shake(size * 0.9);
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
            fx.spawnPuff(e.body, 1);
          }
          break;
        case 'moon':
          if (e.born) hud.log(`Debris clumped into a new moon: ${e.body.name}`, 'big');
          else hud.log(`Captured ${e.body.name} as a moon. Hold E to pull it in`, 'big');
          break;
        case 'stripped':
          fx.spawnStrip(e.from, e.depth);
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
        case 'rogue':
          hud.log(`A rogue planet, ${e.name}, is drifting past${e.bigger ? ': it is bigger than you' : ''}`, e.bigger ? 'bad' : 'info');
          break;
        case 'sn-warning':
          this.snWarn = 16;
          this.snText = `Neutrino burst from ${e.name}: a supernova is coming`;
          hud.log(`Neutrinos detected from ${e.name} (${F.distance(e.dist)} away)`, 'bad');
          break;
        case 'supernova':
          this.flash(e.self ? 3 : 1.4, 0.85, 0.9, 1.0);
          this.audio.cataclysm();
          this.shake(e.self ? 1.5 : 0.6);
          fx.spawnShell(e.x, e.y, e.z);
          if (e.self) {
            if (!e.ia) hud.log(e.toBH ? 'Your core collapsed into a black hole' : 'Your core collapsed into a neutron star', 'big');
          } else hud.log(`${e.name} exploded as a supernova`, 'bad');
          break;
        case 'distant-supernova':
          hud.log(`${e.name} went supernova ${F.nice(e.ly)} light-years away`, e.ly < 50 ? 'bad' : 'info');
          if (e.ly < 300) this.flash(0.4, 0.9, 0.92, 1);
          break;
        case 'star-died':
          hud.log(`${e.name} shed its outer layers as a ${e.kind}`, 'info');
          break;
        case 'blast-hit':
          if (e.frac > 0.001) {
            hud.log(`Supernova blast wave hit you: lost ${F.percent(e.frac, 1)}`, 'bad');
            this.damage = 1;
            this.shake(1);
            this.audio.impact(1, 0.8);
          } else hud.log('The supernova blast wave washed over you', 'info');
          break;
        case 'grb':
          hud.log(`Gamma-ray burst from ${Math.round(e.dist).toLocaleString('en-US')} light-years away`, 'bad');
          this.flash(0.6, 0.8, 0.85, 1);
          break;
        case 'magnetar-flare':
          hud.log(`Giant flare from the magnetar ${e.name}`, 'bad');
          this.flash(0.5, 0.75, 0.85, 1);
          break;
        case 'flyby':
          if (!e.deep) hud.log('A passing star stirred up the comets at the edge of your system', 'info');
          break;
        case 'stage': {
          const to = e.to;
          if (!e.from) break;
          const st = FORM[to];
          if (!st) break;
          this.formStart = { form: to, mass: p.mass };
          const major = to === 'reddwarf' && e.up || st.compact;
          if (to === 'reddwarf' && e.up) {
            this.flash(2, 1, 0.75, 0.45);
            hud.log('Hydrogen fusion ignited: you are a star', 'big');
          } else if (to === 'browndwarf') {
            hud.log('Deuterium fusion flickers to life in your core', 'big');
          } else if (e.up) {
            hud.log(`You are now ${article(st.name)} ${st.name.toLowerCase()}`, 'big');
          } else {
            hud.log(`You changed into ${article(st.name)} ${st.name.toLowerCase()}`, 'info');
          }
          hud.showCard(to, major ? 'Transformation' : e.up ? 'New stage' : 'You changed');
          if (e.up) this.audio.swell(major);
          this.autosave();
          break;
        }
        case 'giant':
          hud.log(e.super ? 'Your core ran out of hydrogen: you are swelling into a red supergiant' : 'Your core ran out of hydrogen: you are swelling into a red giant', 'big');
          this.audio.swell(true);
          break;
        case 'planetary-nebula':
          hud.log(`You puffed off your outer layers (${F.massShort(e.lost)}) as a planetary nebula`, 'big');
          fx.spawnShell(e.x, e.y, e.z, 0.15);
          this.flash(0.8, 0.6, 0.9, 1.0);
          break;
        case 'gas-capture':
          hud.log('Runaway gas accretion: you are pulling in the disk’s hydrogen', 'big');
          break;
        case 'core-start':
          hud.log('Your core has started fusing heavier elements. Collapse is coming.', 'bad');
          break;
        case 'core-stage':
          hud.log(`Core now fusing ${e.el.toLowerCase()}`, 'info');
          break;
        case 'collapse':
          this.flash(1.5, 0.8, 0.85, 1);
          this.audio.cataclysm();
          hud.log(e.to === 'bh' ? 'Too heavy: you collapsed into a black hole' : 'Your crushed rock gave way: you collapsed into a neutron star', 'big');
          break;
        case 'life':
          hud.log(e.name === 'Microbes' ? 'Life began on your world' : `Life on your world: ${e.name.toLowerCase()}`, 'life');
          hud.showLifeCard(e.stage);
          break;
        case 'life-wake':
          hud.log('A mind has woken up on your world. Time slows down so you can watch.', 'life');
          break;
        case 'life-lost':
          if (e.end) hud.log(`All life on your world died: ${e.why}`, 'bad');
          break;
        case 'extinction':
          hud.log(`Mass extinction: ${e.pct}% of species died`, 'bad');
          break;
        case 'deflect':
          if (!e.deep) hud.log(`Your civilisation pushed ${e.name} off course`, 'life');
          break;
        case 'deflect-failed':
          hud.log(`Your civilisation tried and failed to deflect ${e.name}`, 'bad');
          break;
        case 'colony':
          hud.log(`A colony was founded on ${e.name}`, 'life');
          break;
        case 'moon-life':
          hud.log(`Life appeared in the hidden ocean of ${e.name}`, 'life');
          break;
        case 'warp':
          if (e.auto) hud.log(`Time warp dropped: ${e.reason || 'something is close'}`, 'info');
          else if (!w.deep) hud.log(e.level > 1 ? `Time warp ×${e.level}` : 'Normal time', 'info');
          break;
        case 'warp-blocked':
          hud.log(`Can't warp faster: ${e.reason || 'too close to something big'}`, 'bad');
          break;
        case 'deep':
          if (e.level > 0) hud.log(`Deep time: 1 second = ${F.years(e.rate)}`, 'big');
          else hud.log('Back to normal time', 'info');
          break;
        case 'deep-blocked':
          hud.log(`No deep time: ${e.reason}`, 'bad');
          break;
        case 'arrive':
          hud.log(`Arriving at ${e.name}`, 'info');
          break;
        case 'system-changed':
          if (e.to === 'rg') hud.log(`${e.name} has become a red giant`, 'bad');
          else if (e.to === 'wd') hud.log(`${e.name} is now a white dwarf`, 'info');
          break;
        case 'nebula-feed':
          this.eatAcc.m += e.gain;
          break;
        case 'evaporated':
          this.onEnd();
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
    if (jetEvent) fx.spawnJet(jetEvent);
    if (ablate) fx.spawnTail(ablate);
    this.eatAcc.t += 1 / 60;
    if (this.eatAcc.t > 2.5) {
      if (this.eatAcc.m > p.mass * 0.004) hud.log(`Accreted debris (+${F.percent(this.eatAcc.m / p.mass, 1)})`, 'food');
      this.eatAcc = { n: 0, m: 0, t: 0 };
    }
  }

  deathStats(mass) {
    const s = this.world.stats;
    const life = this.world.life;
    return [
      ['Mass at the end', F.massFriendly(mass)],
      ['Peak mass', F.massFriendly(s.peakMass)],
      ['Bodies eaten', s.eaten.toLocaleString('en-US')],
      ['Biggest meal', F.massShort(s.biggestMeal || 0)],
      ['Star systems eaten', String(s.systemsEaten)],
      ['Highest life', life && life.peak ? LIFE_STAGES[life.peak].name : 'None'],
      ['Time played', F.clock(s.timePlayed)],
      ['Deaths', String(s.deaths)],
    ].map(([a, b]) => `<div><span>${a}</span>${b}</div>`).join('');
  }

  onDeath(e) {
    this.state = 'dead';
    this.input.enabled = false;
    this.input.releaseLock();
    this.closeSheet?.();
    this.deathMass = e.mass;
    this.ended = false;
    this.flash(1.2, 1, 0.5, 0.35);
    this.audio.cataclysm();
    const pl = this.world.player;
    this.fx.spawnPuff({ x: e.x, y: e.y, z: e.z, vx: pl.vx, vy: pl.vy, vz: pl.vz, radius: pl.radius, comp: pl.comp }, 2);
    $('death-eyebrow').textContent = e.total ? 'Nothing was left' : 'Your world came apart';
    $('death-title').textContent = e.total ? 'Exploded' : 'Shattered';
    $('death-cause').textContent = e.cause;
    $('death-lede').textContent = 'A chunk of what you were is still out there. The galaxy remembers everything you ate.';
    $('btn-reform').textContent = 'Re-form from the debris';
    $('death-stats').innerHTML = this.deathStats(e.mass);
    setTimeout(() => { if (this.state === 'dead') $('death').hidden = false; }, 1800);
    this.saves.remove('auto');
    this.continueSlot = this.saves.latest()?.id || null;
  }

  // the end of time: your black hole evaporated
  onEnd() {
    const p = this.world.player;
    this.state = 'dead';
    this.ended = true;
    this.input.enabled = false;
    this.input.releaseLock();
    p.alive = false;
    this.flash(1, 1, 1, 1);
    $('death-eyebrow').textContent = `${F.years(13.8e9 + this.world.years)} after the Big Bang`;
    $('death-title').textContent = 'The last light';
    $('death-cause').textContent = 'You evaporated in a final flash of Hawking radiation. No stars are left, and no black holes. The universe is dark and cold, and will stay that way forever.';
    $('death-lede').textContent = 'You watched the universe end.';
    $('btn-reform').textContent = 'Begin again';
    $('death-stats').innerHTML = this.deathStats(p.mass);
    this.onEvent?.({ type: 'universe-end' });
    setTimeout(() => { $('death').hidden = false; }, 2500);
    this.saves.remove('auto');
  }

  // V: chase, free orbit, low orbit, surface (only where they make sense)
  cycleView() {
    const p = this.world.player;
    const solid = !p.isStar && !p.compact && p.comp.gas < 0.3;
    const modes = ['chase', 'orbit'];
    if (!p.compact) modes.push('low');
    if (solid) modes.push('surface');
    const i = modes.indexOf(this.cam.mode);
    const next = modes[(i + 1) % modes.length];
    const star = this.world.renderer ? null : this.renderer.lightsFor(this.world, p.x, p.y, p.z, p).l0;
    this.cam.setMode(next, p, star ? { x: star.x - p.x, y: star.y - p.y, z: star.z - p.z } : null);
    this.viewName = { chase: 'Chase', orbit: 'Free orbit', low: 'Low orbit', surface: 'Surface' }[next];
    this.hud.log(`View: ${this.viewName}${next === 'low' ? ' (scroll to change height)' : next === 'surface' ? ' (look up)' : next === 'orbit' ? ' (scroll far out to see your system)' : ''}`, 'info');
  }

  // N: see in other kinds of light
  cycleVision() {
    const names = ['Visible', 'Infrared', 'X-ray', 'Radio'];
    this.vision = ((this.vision || 0) + 1) % 4;
    this.visionName = names[this.vision];
    this.renderer.finalPass.uniforms.uVision.value = this.vision;
    const what = ['', 'warm things glow, cold dust turns see-through', 'only the hottest things show: coronae, neutron stars, black-hole disks', 'pulsars, jets and the glow of the galaxy'][this.vision];
    this.hud.log(`Vision: ${this.visionName}${what ? ` (${what})` : ''}`, 'info');
    if (!this.viewName) this.viewName = 'Chase';
  }

  // K: see inside yourself
  toggleCutaway() {
    const p = this.world.player;
    if (!this.cutOn && p.compact === 'bh') { this.hud.log('Nothing inside an event horizon can ever be seen, not even by you', 'info'); return; }
    this.cutOn = !this.cutOn;
    $('probe').hidden = !this.cutOn;
    if (this.cutOn) {
      this.cutTimer = 0;
      if (!this.probeBound) {
        this.probeBound = true;
        $('probe-depth').addEventListener('input', () => { this.cutTimer = 0; });
        $('probe-depth').addEventListener('keydown', (e) => e.stopPropagation());
      }
      this.hud.log('Cutaway: a wedge of you is drawn removed. Drag the probe to read the temperature and pressure inside.', 'info');
    } else this.renderer.cut = null;
  }

  updateCutaway(dt) {
    if (!this.cutOn) return;
    const p = this.world.player;
    if (p.compact === 'bh' || !p.alive) { this.toggleCutaway(); return; }
    this.cutTimer -= dt;
    if (this.cutTimer > 0) return;
    this.cutTimer = 0.5;
    const pm = this.world.planet;
    const struct = pm.structure();
    const temps = struct.layers.map((L, i) => probeAt(p, pm, ((i > 0 ? struct.layers[i - 1].r1 : 0) + L.r1) / 2).T);
    const f = 1 - +$('probe-depth').value;
    const q = probeAt(p, pm, f);
    const key = struct.layers.map((L) => `${L.name}${L.r1.toFixed(3)}`).join('|') + temps.map((t) => Math.round(t / 50)).join(',');
    const prev = this.renderer.cut;
    this.renderer.cut = { struct, temps, probe: f, ver: prev && prev.key === key ? prev.ver : (prev?.ver || 0) + 1, key };
    $('probe-out').innerHTML = `<dt>Depth</dt><dd>${F.distance(q.depthKm)}</dd><dt>Layer</dt><dd>${q.layer.name}</dd><dt>Temperature</dt><dd>${F.temperature(q.T)}</dd><dt>Pressure</dt><dd>${q.P > 1e4 ? `${F.sci(q.P, 1)} bar` : `${F.nice(q.P)} bar`}</dd>`;
  }

  // forms change: drop views that no longer make sense
  checkView() {
    const p = this.world.player;
    const m = this.cam.mode;
    if ((m === 'surface' && (p.isStar || p.compact || p.comp.gas >= 0.3)) || (m === 'low' && p.compact)) {
      this.cam.setMode('chase', p);
      this.viewName = 'Chase';
    }
  }

  viewLabel() {
    return this.viewName ? `View: ${this.viewName}${this.visionName && this.visionName !== 'Visible' ? ` · ${this.visionName}` : ''}` : '';
  }
}

function article(name) {
  return /^[aeiou]/i.test(name) ? 'an' : 'a';
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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

export { M_SUN, M_EARTH, Game };
