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
    level.scene.userData.post = level.post || null;
    G.renderer.toneMappingExposure = (level.post && level.post.exposure) || 1;
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
    if (!input.locked) input.requestLock();
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
    this.house.openFrontDoor();
    G.player.mode = 'walk';
    G.player.health = G.player.maxHealth;
    this.checkpoint('house', 'deskPhone');
    playMusic('wonder');
    this.beginPlay();
    await ui.fade(0, 900);
    await ui.say('Whatever did this to me is outside.', { speaker: 'You' });
    ui.toast('SuckBot knocked the draft stopper away from the front door.', 5000);
    this.objective('Get outside — squeeze under the front door in the living room');
  },

  async goOutside(entry = 'outside', spawn = null) {
    this.current = entry === 'survival' || G.flags.bushFled ? 'survival' : 'outside';
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
    await this.levels.yard.arrive(entry, spawn);
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

  // ---------------------------------------------------------------- the ending: full size
  async finale() {
    ui.showHud(false);
    G.inventory.restoreStash();
    const { createYard } = await import('../scenes/yard.js');
    if (!this.levels.yard) {
      document.getElementById('loading').classList.remove('hidden');
      ui.loading(0.3, 'Growing back...');
      await nextFrame();
      this.levels.yard = await createYard(this);
      document.getElementById('loading').classList.add('hidden');
    }
    const Y = this.levels.yard;
    if (this.levels.micro && this.levels.micro.onExit) this.levels.micro.onExit();
    this.setLevel(Y);
    Y.setOvercast(false);
    Y.startAmbience();
    const P = G.player;
    const { Dog } = await import('./houseCreatures.js');
    const dog = new Dog({ fur: 6 });
    dog.state = 'ending';
    dog.pose = 1;
    Y.scene.add(dog.group);
    const spot = new THREE.Vector3(860, 0, -200);
    spot.y = Y.world.ground(spot.x, spot.z);
    P.spawn(spot, -Math.PI / 2);
    P.mode = 'locked'; P.lockFreeze = true;
    P.object.scale.setScalar(96);
    G.mode = 'cutscene';
    playMusic('finale');
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const dogFrom = V(120, 0, -120), dogTo = V(spot.x - 110, 0, spot.z + 30);
    dog.body.pos.copy(dogFrom); dog.yaw = Math.atan2(dogTo.x - dogFrom.x, dogTo.z - dogFrom.z);
    const dogTick = (dt) => { dog.animate(dt, P); dog.sync(dt); };
    G.endingTick = dogTick;
    await G.director.play(async (c) => {
      c.cut(spot.clone().add(V(40, 25, 40)), spot.clone().add(V(0, 5, 0)), 60);
      await ui.fade(0, 1400);
      document.getElementById('fade').style.background = '#000';
      c.move(spot.clone().add(V(260, 190, 180)), spot.clone().add(V(0, 120, 0)), 6, { path: [spot.clone().add(V(120, 60, 120))] });
      await c.say('I\'m... back. I\'m normal again.', { speaker: 'You', pitch: 1.1 });
      await c.say('The grass is just grass. The bush is just a bush. Everything is... normal.', { speaker: 'You' });
      sfx('bark', { count: 3 });
      c.cut(V(spot.x - 260, 90, spot.z + 160), V(spot.x - 60, 40, spot.z), 55);
      c.tween(4.5, (k) => { dog.body.pos.lerpVectors(dogFrom, dogTo, k); dog.body.vel.set(dogTo.x - dogFrom.x, 0, dogTo.z - dogFrom.z).normalize().multiplyScalar(k < 0.95 ? 14 : 0); dog.pose = 1; }, 'linear');
      await c.say('Biscuit! Hey, buddy!', { speaker: 'You', pitch: 1.1 });
      await c.wait(2.2);
      dog.body.vel.set(0, 0, 0);
      P.rig.trigger('wave', 1.4);
      c.cut(spot.clone().add(V(-90, 150, 120)), spot.clone().add(V(0, 140, 0)), 50);
      sfx('notify'); sfx('notify', { delay: 0.5 });
      await c.wait(0.8);
      await c.say('...Is that my phone?', { speaker: 'You' });
      ui.toast('📱 <b>FlickFeed</b>: 5 new videos posted for you', 5000);
      await c.say('...Maybe just one video.', { speaker: 'You', rate: 0.95 });
      c.move(spot.clone().add(V(600, 400, 600)), spot.clone().add(V(0, 100, 0)), 6);
      await c.wait(3);
      await ui.fade(1, 1800);
    });
    G.endingTick = null;
    Y.scene.remove(dog.group);
    P.object.scale.setScalar(1);
    P.lockFreeze = false;
    unlock('fullsize');
    this.checkpoint('yard', 'survival');
    this.showEnding();
  },

  showEnding() {
    G.mode = 'ending';
    input.exitLock();
    ui.showHud(false);
    const s = G.stats;
    const mins = Math.floor(s.playTime / 60), secs = Math.floor(s.playTime % 60);
    const el = document.getElementById('ending');
    el.innerHTML = `<div class="end-title">FULL SIZE</div><div class="end-sub">You made it back. For now.</div>
      <div class="end-stats"><span>Time played</span><span>${mins}m ${secs}s</span><span>Deaths</span><span>${s.deaths}</span><span>Ways to die discovered</span><span>${deathsDiscovered().size}/${DEATHS.length}</span>
      <span>Bugs defeated</span><span>${s.bugs}</span><span>Grass cut</span><span>${s.grass}</span><span>Items crafted</span><span>${s.crafted}</span></div>
      <div class="roll"><div class="roll-inner">
        <h4>POCKET SIZE</h4><p>An original game about being very, very small.</p>
        <h4>STORY &amp; IDEA</h4><p>The player who dreamed it up</p>
        <h4>CODE, ART, SOUND &amp; MUSIC</h4><p>Generated entirely from code by Claude</p>
        <h4>STARRING</h4><p>You, at 1.8 centimetres</p><p>Biscuit the golden retriever</p><p>SuckBot 3000</p><p>The Brood Mother (if you found her)</p><p>A tardigrade who was just minding its business</p>
        <h4>ENGINE</h4><p>Three.js</p>
        <h4>NO BUGS WERE HARMED</h4><p>...okay, quite a lot of bugs were harmed.</p>
        <h4>THANK YOU FOR PLAYING</h4></div></div>
      <button class="mbtn primary" id="btn-end-menu" style="text-align:center;margin-top:24px">Back to Menu</button>`;
    el.classList.remove('hidden');
    ui.fade(0, 1200);
    document.getElementById('btn-end-menu').onclick = () => { el.classList.add('hidden'); this.quitToMenu(); };
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
    P.climb = null;
    P.mode = 'walk';
    P.sleeping = false;
    ui.mash(null); ui.boss(null);
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
      if (!this.levels.yard || G.level !== this.levels.yard) { await this.goOutside('respawn', spawn); return; }
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
    if (G.endingTick) G.endingTick(dt);
    if (G.level === this.house) this.houseStory.update(dt);
    else if (G.level && G.level.story) G.level.story(dt);
    // inventory, hotbar, combat & building outside of the house
    G.inventory.update(dt);
  },
};
