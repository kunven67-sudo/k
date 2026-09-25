// The director of the whole game: chapters, level switching, checkpoints, deaths, saves.
import * as THREE from 'three';
import { ui } from '../core/ui.js';
import { input } from '../core/input.js';
import { sfx, playMusic, stopMusic, setReverb } from '../core/audio.js';
import { G, saveGame, clearSave, unlockChapter } from './state.js';
import { Player } from './player.js';
import { recordDeath, deathInfo, deathsDiscovered, DEATHS, unlock } from './achievements.js';
import { createHouse } from '../scenes/house.js';
import { HouseStory } from './houseStory.js';
import { Inventory } from './inventory.js';

export const CHAPTERS = [
  { id: 'feed', name: 'Doomscroll' },
  { id: 'house', name: 'Big Morning' },
  { id: 'phone', name: 'Inside the Phone' },
  { id: 'outside', name: 'The Great Outdoors' },
  { id: 'survival', name: 'Small World Survival' },
  { id: 'germ', name: 'Germ Size' },
];

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

export const Story = {
  house: null,
  houseStory: null,
  levels: {},
  current: null,        // current chapter id
  menuT: 0,

  async init(progress) {
    progress(0.05, 'Growing a very large house...');
    await nextFrame();
    G.player = new Player();
    G.player.onDeath = (cause) => this.onPlayerDeath(cause);
    G.inventory = new Inventory();
    progress(0.15, 'Sanding the floorboards...');
    await nextFrame();
    this.house = createHouse(G.renderer);
    this.levels.house = this.house;
    progress(0.75, 'Waking up the dog (quietly)...');
    await nextFrame();
    this.houseStory = new HouseStory(this, this.house);
    this.setLevel(this.house);
    this.house.setTime('morning');
    progress(0.9, 'Compiling shaders...');
    await nextFrame();
    // audio becomes available on the first click; creature loops start then
    window.addEventListener('pointerdown', () => { Object.values(this.levels).forEach((l) => { if (l) l.audioReady = true; }); }, { once: true });
  },

  setLevel(level) {
    if (G.level && G.level !== level && G.level.onExit) G.level.onExit();
    G.level = level;
    G.post.setScene(level.scene, G.camera);
    if (G.player.object.parent) G.player.object.parent.remove(G.player.object);
    level.scene.add(G.player.object);
    level.audioReady = true;
    if (level.onEnter) level.onEnter();
  },

  placePlayer(spawnId) {
    const s = G.level.spawns[spawnId];
    if (!s) { console.warn('no spawn', spawnId); return; }
    G.player.spawn(s.pos.clone(), s.yaw);
  },

  beginPlay() {
    G.mode = 'play';
    ui.showHud(true);
    ui.health(G.player.health, G.player.maxHealth);
    G.inventory.renderHotbar();
    if (!input.locked) { ui.lock(true, 'Click to play'); input.requestLock(); }
  },

  objective(text) { ui.objective(text, CHAPTERS.find((c) => c.id === this.current)?.name?.toUpperCase() || ''); G.objective = text; },

  checkpoint(levelId, spawn, opts = {}) {
    G.checkpoint = { level: levelId, spawn, opts, chapter: this.current };
    G.chapter = this.current;
    saveGame();
  },

  saveIfPlaying() { if (G.mode !== 'menu' && G.checkpoint) saveGame(); },

  modalOpen() { return G.mode === 'inventory' || G.mode === 'dead' || !document.getElementById('death').classList.contains('hidden'); },

  resetRun() {
    G.flags = {};
    G.stats = { deaths: 0, kills: 0, bugs: 0, grass: 0, viruses: 0, crafted: 0, startTime: Date.now(), playTime: 0, wakeTime: 0, damageTaken: 0 };
    G.inventory.clear();
    G.player.health = G.player.maxHealth = 100;
    G.player.carry = null;
  },

  async newGame() {
    this.resetRun();
    clearSave();
    await this.startChapter('feed', true);
  },

  async continueGame(save) {
    document.getElementById('menu').classList.add('hidden');
    if (!save) return this.newGame();
    this.resetRun();
    G.flags = save.flags || {};
    G.stats = { ...G.stats, ...(save.stats || {}) };
    if (save.inventory) G.inventory.load(save.inventory);
    G.checkpoint = save.checkpoint;
    this.current = save.checkpoint?.chapter || save.chapter || 'house';
    ui.fadeInstant(1);
    await this.respawn(true);
    ui.fade(0, 900);
  },

  // Jump to the start of a chapter (new game or chapter select).
  async startChapter(id, fresh = false) {
    document.getElementById('menu').classList.add('hidden');
    if (!fresh) this.resetRun();
    this.current = id;
    unlockChapter(id);
    G.chapter = id;
    const H = this.house;
    ui.showHud(false);
    if (id === 'feed') {
      this.setLevel(H);
      await this.houseStory.playFeed();
      this.current = 'house';
      unlockChapter('house');
      await this.houseStory.playWake();
    } else if (id === 'house') {
      this.setLevel(H);
      await this.houseStory.playWake();
    } else if (id === 'phone') {
      Object.assign(G.flags, { leapt: true, seenLiving: true, airplaneLifted: true, climbedBed: true, onDesk: true });
      this.setLevel(H); H.setTime('morning');
      await this.enterPhone();
    } else if (id === 'outside') {
      Object.assign(G.flags, { leapt: true, seenLiving: true, airplaneLifted: true, climbedBed: true, onDesk: true, phoneDone: true });
      await this.goOutside();
    } else if (id === 'survival') {
      Object.assign(G.flags, { leapt: true, seenLiving: true, airplaneLifted: true, climbedBed: true, onDesk: true, phoneDone: true, outside: true, bushFled: true, overcast: true });
      await this.goOutside('survival');
    } else if (id === 'germ') {
      Object.assign(G.flags, { leapt: true, seenLiving: true, airplaneLifted: true, climbedBed: true, onDesk: true, phoneDone: true, outside: true, bushFled: true, overcast: true, craftedAxe: true });
      G.inventory.add('pebble', 6); G.inventory.add('fiber', 6);
      await this.goGerm();
    }
  },

  async enterPhone() {
    this.current = 'phone';
    unlockChapter('phone');
    ui.fadeInstant(1);
    ui.showHud(false);
    const { createPhoneWorld } = await import('../scenes/phoneWorld.js');
    if (!this.levels.phone) this.levels.phone = createPhoneWorld(this);
    this.setLevel(this.levels.phone);
    this.houseStory.stopAmbience();
    G.player.health = G.player.maxHealth;
    await this.levels.phone.intro();
  },

  async exitPhone() {
    this.current = 'house';
    G.flags.phoneDone = true;
    ui.fadeInstant(1);
    const phone = this.levels.phone;
    if (phone && phone.dispose) phone.dispose();
    this.levels.phone = null;
    G.post.fx.pixelate = 0; G.post.fx.scanlines = 0; G.post.fx.glitch = 0;
    this.setLevel(this.house);
    this.house.setTime('morning');
    this.placePlayer('deskPhone');
    G.player.mode = 'walk';
    G.player.health = G.player.maxHealth;
    this.checkpoint('house', 'deskPhone');
    playMusic('wonder');
    this.beginPlay();
    await ui.fade(0, 900);
    await ui.say('I\'m out! That was NOT a normal phone call.', { speaker: 'You' });
    await ui.say('No signal, fake wires... Forget the phone. Maybe there are answers outside.', { speaker: 'You' });
    this.objective('Get outside — squeeze under the front door in the living room');
  },

  async goOutside(entry = 'outside') {
    this.current = entry === 'survival' ? 'survival' : 'outside';
    unlockChapter('outside');
    ui.fadeInstant(1);
    ui.showHud(false);
    this.houseStory.stopAmbience();
    const { createYard } = await import('../scenes/yard.js');
    if (!this.levels.yard) {
      ui.loading(0.2, 'Growing the lawn...');
      document.getElementById('loading').classList.remove('hidden');
      await nextFrame();
      this.levels.yard = await createYard(this);
      document.getElementById('loading').classList.add('hidden');
    }
    this.setLevel(this.levels.yard);
    await this.levels.yard.arrive(entry);
  },

  async goGerm() {
    this.current = 'germ';
    unlockChapter('germ');
    ui.fadeInstant(1);
    ui.showHud(false);
    const { createMicro } = await import('../scenes/micro.js');
    if (!this.levels.micro) this.levels.micro = createMicro(this);
    this.setLevel(this.levels.micro);
    await this.levels.micro.arrive();
  },

  async backToYard(spawn) {
    this.current = 'survival';
    ui.fadeInstant(1);
    this.setLevel(this.levels.yard);
    await this.levels.yard.arrive('return', spawn);
  },

  // ---------------------------------------------------------------- death & respawn
  onPlayerDeath(cause) {
    G.stats.deaths++;
    const isNew = recordDeath(cause);
    const info = deathInfo(cause);
    G.mode = 'dead';
    ui.showHud(false);
    ui.prompt(null); ui.mash(null);
    input.exitLock();
    stopMusic(1);
    sfx('death');
    if (cause === 'sun') unlock('sunburn');
    if (cause === 'car') unlock('roadkill');
    if (cause === 'wires') unlock('wires');
    setTimeout(() => {
      ui.death(info.name, info.text, `${isNew ? 'NEW! ' : ''}WAYS TO DIE DISCOVERED: ${deathsDiscovered().size}/${DEATHS.length}`, () => this.respawn());
    }, cause === 'wires' ? 2600 : 1400);
  },

  async respawn(fromLoad = false) {
    const cp = G.checkpoint;
    ui.hideDeath();
    if (!cp) { await this.startChapter('house'); return; }
    await this.respawnAt(cp.level, cp.spawn, cp.opts || {}, fromLoad);
  },

  async respawnAt(levelId, spawn, opts = {}, fromLoad = false) {
    const P = G.player;
    P.health = P.maxHealth; P.heat = 0; P.stamina = 1;
    P.carry = null;
    P.mode = 'walk';
    P.sleeping = false;
    ui.health(P.health, P.maxHealth);
    G.post.fx.damage = 0;
    if (levelId === 'house') {
      if (G.level !== this.house) this.setLevel(this.house);
      this.house.setTime('morning');
      this.current = G.flags.phoneDone ? 'house' : (this.current === 'phone' ? 'house' : this.current || 'house');
      this.placePlayer(spawn);
      this.houseStory.onRespawn(spawn, opts);
      playMusic('wonder');
      setReverb(0.35);
      this.objective(G.objective || 'Get to your phone on the desk');
    } else if (levelId === 'phone') {
      await this.enterPhone();
      return;
    } else if (levelId === 'yard') {
      if (!this.levels.yard || G.level !== this.levels.yard) { await this.goOutside(G.flags.bushFled ? 'survival' : 'outside'); if (G.flags.bushFled) return; }
      this.levels.yard.respawn(spawn);
    } else if (levelId === 'micro') {
      if (!this.levels.micro || G.level !== this.levels.micro) { await this.goGerm(); return; }
      this.levels.micro.respawn(spawn);
    }
    this.beginPlay();
  },

  async quitToMenu() {
    this.saveIfPlaying();
    ui.clearSubtitle();
    ui.showHud(false);
    ui.hideDeath();
    ui.mash(null); ui.prompt(null); ui.boss(null);
    input.exitLock();
    G.post.fx.pixelate = 0; G.post.fx.scanlines = 0; G.post.fx.glitch = 0; G.post.fx.heat = 0; G.post.fx.damage = 0;
    if (G.level !== this.house) this.setLevel(this.house);
    this.house.setTime('morning');
    if (G.player.object.parent) G.player.object.parent.remove(G.player.object);
    G.showMenu();
  },

  // ---------------------------------------------------------------- per-frame
  update(dt) {
    if (G.mode === 'play' || G.mode === 'cutscene') G.stats.playTime += dt;
    if (G.mode === 'menu') {
      // Slow macro fly-by across the desk while the menu is open.
      this.menuT += dt;
      const t = this.menuT * 0.04;
      const cam = G.camera;
      const a = 0.75 + Math.sin(t) * 0.5;
      cam.position.set(335 + Math.sin(a) * 21, 62.5 + Math.sin(t * 0.7) * 1.5, 28 + Math.cos(a) * 21);
      cam.lookAt(333, 58.8, 27);
      cam.fov = 50; cam.updateProjectionMatrix();
      G.post.focus = cam.position.distanceTo(new THREE.Vector3(335, 59, 28));
      G.post.aperture = 1.1; G.post.maxBlur = 8;
      G.post.dofOverride = true;
      return;
    }
    if (G.mode === 'feed') {
      const b = this.houseStory.feed.update(dt);
      const L = this.house.refs.lights;
      const cam = G.camera;
      const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
      L.phoneGlow.position.copy(cam.position).addScaledVector(fwd, 10);
      L.phoneGlow.intensity = 300 + b * 900 + Math.sin(G.time * 7) * 60 * b;
      return;
    }
    if (G.post.dofOverride === true && !G.director.active && G.mode === 'play') G.post.dofOverride = null;
    if (G.level === this.house) this.houseStory.update(dt);
    else if (G.level && G.level.story) G.level.story(dt);
    // inventory, hotbar, combat & building outside of the house
    G.inventory.update(dt);
  },
};
