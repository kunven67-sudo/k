// The game: owns the renderer, input, audio, UI, the current zone and the player, and runs the main loop.
import * as THREE from 'three';
import { Renderer } from '../core/render.js';
import { Input } from '../core/input.js';
import { CamRig } from './camera.js';
import { Player } from './player.js';
import { loadSettings, saveSettings } from './settings.js';
import { loadMeta, saveMeta, saveRun, loadRun, deleteRun } from './save.js';
import { Audio } from './audio.js';
import { Hud } from '../ui/hud.js';
import { Menus } from '../ui/menus.js';
import { Fx } from './fx.js';
import { Webs } from './webs.js';
import { Actions } from './actions.js';
import { Growth } from './growth.js';
import { Story } from './story.js';
import { Wanted } from './wanted.js';
import { Babies } from './babies.js';
import { ZONES, ZONE_ORDER } from '../world/zones.js';
import { chitinTick, setRim } from '../spider/body.js';
import { clamp, sizeText } from '../core/util.js';

export class Game {
  constructor(canvas, q) {
    this.q = q;
    this.canvas = canvas;
    this.settings = loadSettings();
    this.meta = loadMeta();
    this.renderer = new Renderer(canvas);
    if (this.settings.quality && this.settings.quality !== this.renderer.qSetting) this.renderer.setQuality(this.settings.quality);
    if (q.get('q')) this.renderer.setQuality(q.get('q'));
    this.input = new Input(canvas);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.001, 1000);
    this.cam = new CamRig(this.camera);
    this.audio = new Audio(this);
    this.fx = new Fx(this);
    this.webs = new Webs(this);
    this.hud = new Hud(this);
    this.menus = new Menus(this);
    this.actions = new Actions(this);
    this.growth = new Growth(this);
    this.story = new Story(this);
    this.wanted = new Wanted(this);
    this.babies = new Babies(this);
    this.state = 'boot';
    this.time = 0; this.runTime = 0;
    this.zone = null; this.zones = {};
    this.player = null;
    this.controlsOn = false;
    this.timeScale = 1; this.slowmo = 0;
    this.stats = this.freshStats();
    this.applySettings();
    this.input.onLockChange = (l) => { if (!l && this.state === 'play' && !this.menus.open) this.pause(); };
    window.__game = this;
  }

  freshStats() { return { eaten: 0, humans: 0, biomass: 0, molts: 0, planets: 0, stars: 0, galaxies: 0, universes: 0, maxWanted: 0, startedAt: Date.now(), eatenList: {}, notes: {} }; }
  get difficulty() { return this.settings.difficulty; }
  get realistic() { return this.settings.difficulty === 'realistic'; }

  applySettings() {
    const s = this.settings;
    this.cam.sens = 0.0022 * s.sens; this.cam.invertY = s.invertY; this.cam.fovBase = s.fov; this.cam.uprightMode = s.upright;
    this.audio.applyVolumes();
    if (this.player) this.player.setFear(s.fear);
    this.hud.applyToggles && this.hud.applyToggles();
    saveSettings(s);
  }

  // ------------------------------------------------------------------ zones
  async getZone(id) {
    if (!this.zones[id]) {
      const Z = ZONES[id];
      const z = new Z(this);
      this.zones[id] = z;
      await z.build();
    }
    return this.zones[id];
  }
  async enterZone(id, opts = {}) {
    const old = this.zone;
    const z = await this.getZone(id);
    if (old && old !== z) old.exit && old.exit();
    this.zone = z;
    if (!this.fill) { this.fill = new THREE.PointLight(0xc8d4ff, 0, 1, 2); }
    if (this.fill.parent !== z.scene) z.scene.add(this.fill);
    this.renderer.setView(z.scene, this.camera);
    if (this.player) this.player.attach(z.scene);
    z.enter(opts);
    this.webs.attach(z.scene);
    this.fx.attach(z.scene);
    this.babies.attach(z.scene);
    this.audio.zoneChanged(z);
    this.hud.zoneChanged(z);
    // drop zones we can never go back to (frees GPU memory on 2 GB cards)
    const idx = ZONE_ORDER.indexOf(id);
    for (const k of Object.keys(this.zones)) if (ZONE_ORDER.indexOf(k) < idx - 1 && k !== id) { this.zones[k].dispose && this.zones[k].dispose(); delete this.zones[k]; }
  }

  // ray / closest-point against the current zone, filtered by the spider's size (zone units)
  probe(o, d, far, size) { return this.zone ? this.zone.collision.raycast(o, d, far, size) : null; }
  closest(p, maxD, size) { return this.zone ? this.zone.collision.closest(p, maxD, size) : null; }

  // ------------------------------------------------------------------ run lifecycle
  async newRun({ species = 'widow', difficulty, skipIntro = false } = {}) {
    if (difficulty) { this.settings.difficulty = difficulty; saveSettings(this.settings); }
    deleteRun();
    this.stats = this.freshStats();
    this.runTime = 0;
    this.meta.runs++; saveMeta(this.meta);
    for (const k of Object.keys(this.zones)) { this.zones[k].dispose && this.zones[k].dispose(); delete this.zones[k]; }
    this.player = new Player(this, species);
    this.player.sizeM = 0.004;
    this.wanted.reset(); this.babies.reset(); this.story.reset(); this.growth.reset();
    this.hud.loading('Specimen 8', 0.1);
    await this.enterZone('halvern', { start: true });
    this.hud.loading(null);
    this.story.play('injection');
    if (skipIntro) this.story.endCut();
  }

  // dev/test: jump to a world at a size (metres)
  async debugJump(zoneId, sizeM) {
    const p = this.player; if (!p) return;
    if (sizeM > 0) { p.sizeM = p.targetSize = sizeM; }
    this.story.flags.escaped = true;
    if (zoneId !== this.zone.id) await this.enterZone(zoneId, { from: this.zone.id });
    this.startPlay();
  }

  // everything you eat goes in this run's list and the bestiary (which survives death)
  recordEat(kind, def) {
    this.stats.eatenList[kind] = (this.stats.eatenList[kind] || 0) + 1;
    const B = this.meta.bestiary;
    const e = B[kind] || (B[kind] = { name: def.name, latin: def.latin || '', fact: def.fact || '', count: 0, first: Date.now() });
    e.count++;
    this.meta.totalEaten++;
    if (!e.toldNew) { e.toldNew = true; this.hud.toast('New in your bestiary: ' + def.name, 2.2); }
    clearTimeout(this._metaT); this._metaT = setTimeout(() => saveMeta(this.meta), 1500);
  }

  async continueRun() {
    const r = loadRun();
    if (!r) return this.newRun();
    this.stats = { ...this.freshStats(), ...r.stats };
    this.runTime = r.runTime || 0;
    this.player = new Player(this, r.species || 'widow');
    Object.assign(this.player, { sizeM: r.sizeM, hp: r.hp, hunger: r.hunger, molt: r.molt, silk: 1, powers: r.powers || {}, evo: r.evo || this.player.evo, mutationPoints: r.mp || 0 });
    this.player.applyPowerLooks();
    this.settings.difficulty = r.difficulty || this.settings.difficulty;
    this.wanted.reset(); this.babies.reset(r.babies || 0); this.story.reset(r.story);
    this.hud.loading('Waking up in your lair', 0.2);
    await this.enterZone(r.zone || 'halvern', { lair: r.lair });
    this.hud.loading(null);
    this.startPlay();
  }

  saveAtLair(lair) {
    const p = this.player;
    const ok = saveRun({ species: p.speciesId, sizeM: p.sizeM, hp: p.hp, hunger: p.hunger, molt: p.molt, powers: p.powers, evo: p.evo, mp: p.mutationPoints,
      zone: this.zone.id, lair: lair ? { pos: lair.pos.toArray(), up: lair.up.toArray() } : null, stats: this.stats, runTime: this.runTime,
      difficulty: this.settings.difficulty, babies: this.babies.count, story: this.story.saveState() });
    this.hud.toast(ok ? 'Rested. Saved at your lair.' : 'Could not save (browser storage is full or blocked)');
  }

  startPlay() {
    this.state = 'play';
    this.controlsOn = true;
    this.menus.closeAll();
    this.hud.show(true);
    this.input.lock();
  }
  pause() {
    if (this.state !== 'play') return;
    this.state = 'paused'; this.controlsOn = false;
    this.menus.pause();
  }
  resume() {
    if (this.state !== 'paused') return;
    this.menus.closeAll();
    this.state = 'play'; this.controlsOn = true;
    this.input.lock();
  }

  die(cause) {
    if (this.state === 'dead' || !this.player) return;
    const p = this.player;
    p.mode = 'dead';
    this.state = 'dead'; this.controlsOn = false;
    this.meta.deaths++;
    this.meta.deathsBy[cause] = (this.meta.deathsBy[cause] || 0) + 1;
    this.meta.lastDeath = { cause, size: p.sizeM, zone: this.zone.id, at: Date.now() };
    this.recordBest();
    saveMeta(this.meta);
    deleteRun();
    this.audio.death();
    this.slowmo = 1.5;
    setTimeout(() => { this.input.unlock(); this.menus.death(cause); }, 1600);
  }

  recordBest() {
    const p = this.player; if (!p) return;
    if (p.sizeM > this.meta.bestSize) { this.meta.bestSize = p.sizeM; this.meta.bestZone = this.zone.id; }
    this.meta.totalEaten += 0;
  }

  trophy(id, title) {
    if (this.meta.trophies[id]) return;
    this.meta.trophies[id] = { t: title, at: Date.now() }; saveMeta(this.meta);
    this.hud.trophy(title);
  }

  // ------------------------------------------------------------------ main loop
  start() {
    // test mode: the page steps the game itself (window.__advance) instead of running on real time
    if (this.q.get('manual')) {
      window.__advance = (sec, dt = 1 / 30) => { const n = Math.max(1, Math.round(sec / dt)); for (let i = 0; i < n; i++) this.tick(dt, i === n - 1); };
      window.__render = () => this.tick(1e-4, true);
      this.tick(1 / 60, true);
      return;
    }
    let last = performance.now();
    const frame = () => {
      requestAnimationFrame(frame);
      const now = performance.now();
      let dt = Math.min(0.05, (now - last) / 1000); last = now;
      this.renderer.trackFrame(dt);
      this.tick(dt);
    };
    requestAnimationFrame(frame);
  }

  tick(dtReal, draw = true) {
    // slow motion (danger sense, deaths, big moments)
    let ts = this.timeScale;
    if (this.slowmo > 0) { this.slowmo -= dtReal; ts *= 0.25; }
    if (this.timeSlow > 0) { this.timeSlow -= dtReal; ts *= 0.35; } // black-hole time slow power (world slows, you don't)
    const dt = dtReal * ts;
    this.time += dtReal;
    chitinTick(this.time);
    const inp = this.input;
    if (this.state === 'play' || this.state === 'dead' || this.state === 'cutscene' || this.state === 'evolve' || this.state === 'transition' || this.state === 'caught') {
      if (this.state === 'play') this.runTime += dtReal;
      const p = this.player;
      if (this.state === 'play' && inp.locked) this.cam.look(inp.mouse.dx, inp.mouse.dy);
      if (inp.mouse.wheel && this.state === 'play') this.cam.zoom = clamp(this.cam.zoom * (inp.mouse.wheel > 0 ? 1.12 : 1 / 1.12), 0.45, 3.2);
      if (this.state === 'play') this.actions.update(dtReal, inp);
      if (p && p.mode !== 'dead' && p.mode !== 'molt' && p.mode !== 'held') p.update(this.state === 'play' ? (this.timeSlow > 0 ? dtReal : dt) : dt, inp, this.cam);
      else if (p) { p.body.position.copy(p.pos); p.rig.update(dt, 0); }
      if (this.zone) this.zone.update(dt, dtReal);
      this.growth.update(dt);
      this.webs.update(dt);
      this.fx.update(dt);
      this.wanted.update(dt);
      this.babies.update(dt);
      this.story.update(dtReal);
      if (p) {
        const s = p.s;
        const focus = new THREE.Vector3().copy(p.pos).addScaledVector(p.up, s * 0.3);
        this.cam.update(dtReal, focus, p.up, s * this.settings.camDist, (o, d, far) => this.probe(o, d, far, s), this.zone.view || {});
        // fill light just above the camera (a photographer's trick: the spider never vanishes into the dark)
        if (this.fill) { this.fill.position.copy(this.camera.position).addScaledVector(p.up, s * 1.5); this.fill.distance = s * 40; this.fill.intensity = (this.zone.fill ?? 0.6) * s * s * 9; }
        // rim strength: strong outside at night, gentle in lit rooms, cool blue-white
        const dark = this.zone.rimAmount ? this.zone.rimAmount(this.camera.position) : 0.3;
        setRim(0.32 * dark, 0.4 * dark, 0.55 * dark);
        // depth of field: strong macro blur when tiny, gentle tilt-shift when huge
        const sm = p.sizeM;
        const macro = sm < 0.05 ? 1 : sm < 0.5 ? 0.6 : sm < 50 ? 0.25 : sm < 5e3 ? 0.55 : 0.2;
        const focusD = this.cam.mode === 'cinematic' ? this.camera.position.distanceTo(p.pos) : this.cam.curDist;
        if (this.dofOverride) this.renderer.setDOF(...this.dofOverride);
        else this.renderer.setDOF(this.zone.dof === false ? 0 : macro, focusD, s * (sm < 0.05 ? 2.2 : 4.5));
        if (this.renderer.aoPass) this.renderer.aoPass.configuration.aoRadius = s * 0.9;
        this.renderer.grade.uniforms.get('vision').value += ((p.vision ? 1 : 0) - this.renderer.grade.uniforms.get('vision').value) * Math.min(1, dtReal * 6);
      }
      this.hud.update(dtReal);
    } else if (this.state === 'menu' || this.state === 'paused') {
      if (this.zone && this.state === 'paused') { /* frozen world */ }
      if (this.menuScene) this.menuScene.update(dtReal);
    }
    this.audio.update(dtReal);
    // render
    if (!draw) { inp.endFrame(); return; }
    if (this.state === 'menu' && this.menuScene) {
      this.renderer.setView(this.menuScene.scene, this.menuScene.camera);
      this.renderer.render(dtReal);
    } else if (this.zone) {
      if (this.renderer.scene !== this.zone.scene) this.renderer.setView(this.zone.scene, this.camera);
      this.renderer.render(dtReal);
    }
    this.hud.frame && this.hud.frame(dtReal);
    inp.endFrame();
  }
}
