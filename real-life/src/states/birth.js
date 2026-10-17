// Getting born (master list Q33/Q50). Four parts, skippable (hold Enter):
//   1. Hospital: your eyes open for the first time. Blurry, bright, beeping. Your parents' faces.
//   2. Baby (playable): a year later, crawling around the living room. Crawl to Mom, grab your
//      bear, then pull yourself up on the couch and take your first steps while they cheer.
//   3. Flashes: snapshots of growing up (4th birthday, first day of kindergarten).
//   4. "8 YEARS LATER" -> you wake up in your bed (WorldState takes over the same world).
// The town loads in the background during the hospital part, so there's no loading screen.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { el, injectStyle } from '../core/util.js';
import { save } from '../core/save.js';
import { clock } from '../core/clock.js';
import { audio } from '../core/audio.js';
import { input } from '../core/input.js';
import { assets } from '../gfx/assets.js';
import { music } from '../audio/music/index.js';
import { Person, preloadPeople } from '../people/person.js';
import { World } from '../world/world.js';
import { Player } from '../player/player.js';
import { Hud } from '../ui/hud.js';
import { makeResidents } from '../people/residents.js';

injectStyle('birth', `
.bt-lids { position: fixed; inset: 0; pointer-events: none; z-index: 25; }
.bt-lids i { position: absolute; left: -10%; right: -10%; height: 55%; background: #000; transition: transform .9s cubic-bezier(.5,0,.3,1); border-radius: 50%; }
.bt-lids i:first-child { top: -5%; transform: translateY(0); }
.bt-lids i:last-child { bottom: -5%; transform: translateY(0); }
.bt-lids.open i:first-child { transform: translateY(-100%); }
.bt-lids.open i:last-child { transform: translateY(100%); }
.bt-card { position: fixed; inset: 0; display: grid; place-items: center; z-index: 26; pointer-events: none; color: #fff; font: 700 clamp(26px, 4vw, 46px) var(--font-round); letter-spacing: .02em;
  opacity: 0; transition: opacity .8s ease; text-shadow: 0 2px 20px rgba(0,0,0,.5); }
.bt-card.on { opacity: 1; }
.bt-card.dark { background: #000; }
.bt-goal { position: fixed; left: 22px; top: 20px; z-index: 22; padding: 10px 14px; border-radius: 12px; background: rgba(22,21,26,.66); color: #fff; font: 600 14px var(--font-ui);
  backdrop-filter: blur(6px); transition: opacity .4s; }
.bt-goal small { display: block; opacity: .7; font-weight: 500; margin-top: 2px; }
.bt-skip { position: fixed; right: 20px; bottom: 16px; z-index: 27; color: rgba(255,255,255,.7); font: 500 12.5px var(--font-ui); }
.bt-skip b { display: inline-block; padding: 1px 7px; border-radius: 5px; background: rgba(255,255,255,.9); color: #111; margin-right: 6px; }
.bt-skip i { display: inline-block; width: 60px; height: 4px; border-radius: 2px; background: rgba(255,255,255,.25); margin-left: 8px; vertical-align: 2px; overflow: hidden; }
.bt-skip i u { display: block; height: 100%; width: 0; background: #fff; }
.bt-photo { position: fixed; inset: 0; z-index: 24; pointer-events: none; display: grid; place-items: center; opacity: 0; transition: opacity .5s; }
.bt-photo.on { opacity: 1; }
.bt-photo .fr { width: min(78vw, 1000px); aspect-ratio: 16/10; border: 18px solid #f7f4ec; border-bottom-width: 64px; box-shadow: 0 0 0 100vmax rgba(0,0,0,.55), 0 20px 50px rgba(0,0,0,.5); position: relative; transform: rotate(-1.5deg); }
.bt-photo .cap { position: absolute; left: 0; right: 0; bottom: -52px; text-align: center; color: #333; font: 600 22px 'Segoe Print', 'Bradley Hand', cursive; }
.bt-flash { position: fixed; inset: 0; background: #fff; z-index: 28; pointer-events: none; opacity: 0; transition: opacity .5s ease-out; }
.bt-flash.on { opacity: 1; transition: none; }
`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class BirthState {
  constructor(engine) {
    this.engine = engine;
    this.t = 0;
    this.phase = 'hospital';
    this.skipHold = 0;
    this.objects = [];
  }

  async enter() {
    const e = this.engine;
    const life = save.life;
    if (!life) return e.go('menu');
    if (life.opening === 'done') return e.go('world');
    this.life = life;
    this.recs = makeResidents(life).filter((r) => r.family);
    this.parents = this.recs.filter((r) => r.role !== 'sibling');
    this.ui = el('div', {});
    this.lids = el('div', { class: 'bt-lids' }, [el('i'), el('i')]);
    this.card = el('div', { class: 'bt-card dark on' }, ['']);
    this.flash = el('div', { class: 'bt-flash' });
    this.skipBar = el('u');
    this.ui.append(this.lids, this.card, this.flash, el('div', { class: 'bt-skip' }, [el('b', {}, ['Enter']), 'hold to skip', el('i', {}, [this.skipBar])]));
    e.uiRoot.appendChild(this.ui);
    this.hud = new Hud(e.uiRoot);
    this.hud.dot.style.display = 'none';
    await preloadPeople();
    await assets.preload([['home', 'Bed_Single'], ['home', 'Light_Ceiling3'], ['furniture', 'bear'], ['food', 'cake-birthday']]);
    // Start building the town while the hospital plays.
    clock.reset(4, 10 * 60); // the baby part: you're 1
    this.world = new World(e);
    this.worldReady = this.world.build({ family: life.family.house, season: clock.season }).then(() => (this.worldBuilt = true));
    this._hospital();
    this._run();
  }

  // ------------------------------------------------------------------ 1. hospital
  _hospital() {
    const e = this.engine;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe8f0ee);
    const pmrem = new THREE.PMREMGenerator(e.renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.7;
    const wall = new THREE.MeshStandardMaterial({ color: 0xcfe3df, roughness: 0.9 });
    const box = (w, h, d, x, y, z, m) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z);
      scene.add(b);
      return b;
    };
    box(8, 0.1, 8, 0, 3, 0, new THREE.MeshStandardMaterial({ color: 0xf2f2ee }));
    box(8, 3, 0.1, 0, 1.5, -2.5, wall);
    box(0.1, 3, 8, -3, 1.5, 0, wall);
    box(0.1, 3, 8, 3, 1.5, 0, wall);
    box(8, 0.1, 8, 0, 0, 0, new THREE.MeshStandardMaterial({ color: 0xbfc8c4, roughness: 0.4 }));
    // Ceiling light panels (very bright, the first thing you see).
    for (const x of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      p.rotation.x = Math.PI / 2;
      p.position.set(x, 2.94, -0.6);
      scene.add(p);
    }
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.1), new THREE.MeshBasicMaterial({ color: 0xcfe8ff }));
    win.position.set(1.4, 1.7, -2.44);
    scene.add(win);
    // Heart monitor with a moving green line.
    const mc = document.createElement('canvas');
    mc.width = 256;
    mc.height = 128;
    this.monCtx = mc.getContext('2d');
    this.monTex = new THREE.CanvasTexture(mc);
    const mon = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.12), [0, 0, 0, 0, new THREE.MeshBasicMaterial({ map: this.monTex }), 0].map((m) => m || new THREE.MeshStandardMaterial({ color: 0x3a3f44 })));
    mon.position.set(-1.1, 1.75, -2.3);
    scene.add(mon);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb0b8b4, 1.4));
    const key = new THREE.DirectionalLight(0xfff4e6, 1.6);
    key.position.set(2, 3, 2);
    scene.add(key);
    // Your parents lean in. You're in Mom's arms, looking up.
    const cam = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.02, 50);
    cam.position.set(0, 1.12, 0.5);
    this.hCam = cam;
    this.faces = [];
    const [pa, pb] = this.parents;
    if (pa) {
      // Whoever just gave birth is in a hospital gown.
      const look = pa.look.sex === 'f' ? { ...pa.look, outfit: { ...pa.look.outfit, topColor: '#a9c9e4', bottomColor: '#a9c9e4' } } : pa.look;
      const p = new Person(look, pa.age, {});
      p.root.position.set(0, 0, 0);
      p.root.rotation.y = 0;
      p.pose = 'carry';
      scene.add(p.root);
      this.faces.push({ p, rec: pa });
    }
    if (pb) {
      const p = new Person(pb.look, pb.age, {});
      p.root.position.set(0.62, 0, -0.18);
      p.root.rotation.y = -0.55;
      scene.add(p.root);
      this.faces.push({ p, rec: pb });
    }
    this.hScene = scene;
    this.camLook = new THREE.Vector3(0, 2.6, -0.4); // ceiling lights first
    e.setView(scene, cam);
    e.setBlur(1);
    music.play('menu-lounge', { fade: 6, gain: 0.35 });
  }

  // ------------------------------------------------------------------ the script
  async _run() {
    const e = this.engine;
    const name = this.life.character.name;
    const kid = this.life.character.sex === 'f' ? 'girl' : 'boy';
    const [a, b] = this.faces;
    const say = (f, text, secs = 4) => {
      if (!f || this.skipped) return;
      this.hud.subtitle(f.rec.call || f.rec.name, text, secs);
      f.p.talk(Math.min(4, secs - 0.5));
    };
    const step = async (ms) => {
      if (!this.skipped) await sleep(ms);
    };
    this.engine.fade(false, 10);
    await step(1200);
    this._beeping = true;
    await step(1600);
    this.card.classList.remove('on');
    this.lids.classList.add('open');
    await step(500);
    this.lids.classList.remove('open');
    await step(600);
    this.lids.classList.add('open');
    this.lookGoal = a ? 'face' : 'ceiling';
    await step(1500);
    say(a, 'Hi... hi, baby. Oh my gosh. Look at you.', 4.5);
    await step(4800);
    say(b, `Hey there, little ${kid}. ${b?.rec.call === 'Dad' || b?.rec.call === 'Papa' ? "I'm your dad." : "I'm your mom too."} Wow.`, 4.5);
    if (b) this.lookGoal = 'both';
    await step(4800);
    say(a, `${name}. That's you. Welcome to the world, ${name}.`, 5);
    if (a) a.p.play('cry'); // happy tears
    await step(5200);
    say(b || a, b ? 'Look at those tiny hands... ' : "We're going to be just fine, you and me.", 4);
    if (b) b.p.play('laugh');
    await step(4200);
    // Fade to white, a year later.
    this.lids.classList.remove('open');
    await step(1100);
    this._beeping = false;
    await this.worldReady;
    if (this.skipped) return this._finish();
    this.card.textContent = '1 year later';
    this.card.classList.add('on');
    await step(1800);
    this._baby();
    this.card.classList.remove('on');
    this.lids.classList.add('open');
  }

  // ------------------------------------------------------------------ 2. baby (playable)
  _baby() {
    const e = this.engine;
    const w = this.world;
    this.phase = 'baby';
    e.setBlur(0.25);
    e.physics = w.physics;
    this.hScene.traverse((o) => o.geometry?.dispose());
    for (const f of this.faces) f.p.dispose();
    const couch0 = w.home.spots.find((s) => s.kind === 'couch');
    const f0 = couch0?.faceYaw ?? 0;
    // On the rug in front of the couch, looking at it (Mom is a little crawl away).
    const living = couch0 ? couch0.at.clone().add(new THREE.Vector3(Math.sin(f0) * 2.4, 0, Math.cos(f0) * 2.4)).setY(w.home.floorY + 0.02) : w.home.spawn.living.clone();
    this.player = new Player(e, w, { look: this.life.character.look, age: 1, spawn: living, yaw: f0, name: this.life.character.name });
    this.player.forceCrawl = true;
    e.setView(w.scene, this.player.camera);
    input.setPointerLock?.(true);
    // Mom on the couch, the other parent on the floor nearby, your bear on the rug.
    const couch = w.home.spots.find((s) => s.kind === 'couch');
    this.babyPeople = [];
    const [pa, pb] = this.parents;
    if (pa && couch) {
      const p = new Person(pa.look, pa.age, {});
      p.pose = 'sit';
      p.root.position.copy(couch.at).setY(couch.at.y - 0.47 * (p.height / 1.75));
      p.root.rotation.y = couch.faceYaw;
      w.scene.add(p.root);
      this.babyPeople.push({ p, rec: pa });
    }
    if (pb && couch) {
      const p = new Person(pb.look, pb.age, {});
      const f = couch.faceYaw;
      p.root.position.copy(couch.at).add(new THREE.Vector3(Math.sin(f) * 1.6 - Math.cos(f) * 1.4, 0, Math.cos(f) * 1.6 + Math.sin(f) * 1.4)).setY(w.home.floorY);
      p.root.rotation.y = f + Math.PI;
      w.scene.add(p.root);
      this.babyPeople.push({ p, rec: pb });
    }
    const bear = assets.model('furniture', 'bear', { scale: 1.6 });
    const bp = living.clone().add(new THREE.Vector3(Math.cos(f0) * 1.3, 0, -Math.sin(f0) * 1.3));
    bear.position.copy(bp).setY(w.home.floorY);
    w.scene.add(bear);
    this.bear = bear;
    this.objects.push(bear);
    this.goals = ['mom', 'bear', 'stand'];
    this.goalEl = el('div', { class: 'bt-goal' }, ['']);
    this.ui.appendChild(this.goalEl);
    this._goal();
    this._bearIt = w.interact.add({ kind: 'bear', box: new THREE.Box3().setFromCenterAndSize(bp.clone().setY(w.home.floorY + 0.15), new THREE.Vector3(0.5, 0.4, 0.5)), label: 'Grab your bear', use: () => this._grabBear() });
    this._standT = 0;
    this.hud.toast('WASD to crawl. Look around with the mouse.', 5000);
  }

  _goal() {
    const g = this.goals[0];
    const a = this.babyPeople[0];
    const txt = { mom: [`Crawl to ${a?.rec.call || 'Mom'}`, 'They\'re on the couch'], bear: ['Grab your teddy bear', 'Press E when you\'re close'], stand: ['Pull yourself up on the couch', 'Get close to the couch and hold Space'] }[g];
    if (!txt) {
      this.goalEl.style.opacity = 0;
      return;
    }
    this.goalEl.replaceChildren(txt[0], el('small', {}, [txt[1]]));
  }

  _grabBear() {
    if (this.goals[0] !== 'bear') {
      this.hud.subtitle('', '*baby noises*', 1.5);
      return;
    }
    this.world.scene.remove(this.bear);
    this.player.body.hold?.(this.bear);
    this.world.interact.remove(this._bearIt);
    this.goals.shift();
    this._goal();
    const a = this.babyPeople[0];
    if (a) {
      this.hud.subtitle(a.rec.call, 'Is that your bear? Is that Mr. Snuggles? Yes it is!', 3.5);
      a.p.talk(3);
    }
  }

  _babyUpdate(dt) {
    const p = this.player;
    p.update(dt);
    const g = this.goals[0];
    const [a, b] = this.babyPeople;
    for (const x of this.babyPeople) {
      x.p.lookAt(p.camera.position);
      x.p.update(dt);
    }
    if (g === 'mom' && a && p.position.distanceTo(a.p.root.position) < 1.3) {
      this.goals.shift();
      this._goal();
      this.hud.subtitle(a.rec.call, `Hi baby! Come here! Good job, ${this.life.character.name}!`, 3.5);
      a.p.talk(3);
      a.p.play('wave');
    }
    if (g === 'stand') {
      const couch = this.world.home.spots.find((s) => s.kind === 'couch');
      const near = couch && p.position.distanceTo(couch.at.clone().setY(p.position.y)) < 1.4;
      if (near && input.down('jump')) {
        this._standT += dt;
        this.goalEl.replaceChildren('Pulling yourself up...', el('small', {}, ['Keep holding Space']));
        if (this._standT > 1.8) this._firstSteps();
      } else this._standT = Math.max(0, this._standT - dt);
    }
    if (this._walking) {
      this._walkT += dt;
      // Wobbly first steps.
      p.camera.rotation.z = Math.sin(this._walkT * 5) * 0.06;
      if (this._walkT > 7 && !this._toFlashes) {
        this._toFlashes = true;
        this._flashes();
      }
    }
    void b;
  }

  _firstSteps() {
    this.goals.shift();
    this._goal();
    this.player.forceCrawl = false;
    this._walking = true;
    this._walkT = 0;
    this.player.controller.speedScale = 0.3;
    const [a, b] = this.babyPeople;
    const n = this.life.character.name;
    const other = b?.rec.name || 'honey';
    if (a) {
      this.hud.subtitle(a.rec.call, `${other.toUpperCase()}! Look! ${this.life.character.sex === 'f' ? "She's" : "He's"} walking!`, 3);
      a.p.play('cheer');
    }
    setTimeout(() => {
      if (b) {
        this.hud.subtitle(b.rec.call, `No way! Go ${n}! Come here, come here!`, 3.5);
        b.p.play('cheer');
      }
    }, 3000);
    this.hud.toast('Your first steps!', 3000);
  }

  // ------------------------------------------------------------------ 3. flashes
  async _flashes() {
    this.phase = 'flashes';
    const w = this.world;
    const e = this.engine;
    this.player.locked = true;
    this.goalEl?.remove();
    await e.fade(true, 700);
    for (const x of this.babyPeople || []) x.p.dispose();
    this.babyPeople = [];
    const cam = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.05, 300);
    e.setView(w.scene, cam);
    const photo = el('div', { class: 'bt-photo' }, [el('div', { class: 'fr' }, [el('div', { class: 'cap' }, [''])])]);
    this.ui.appendChild(photo);
    const shots = [
      { cap: `${this.life.character.name}'s 4th birthday`, day: 16, hour: 18.6, set: (c) => this._birthdaySet(c) },
      { cap: 'First day of kindergarten', day: 20, hour: 8, set: (c) => this._schoolSet(c) },
    ];
    for (const s of shots) {
      if (this.skipped) break;
      clock.reset(s.day, s.hour * 60);
      this._clearSet();
      s.set(cam);
      w.update(0.016, { viewer: cam.position, camera: cam });
      photo.querySelector('.cap').textContent = s.cap;
      await e.fade(false, 300);
      this.flash.classList.add('on');
      audio.play?.('phone.camera', { bus: 'ui', gain: 0.6 });
      requestAnimationFrame(() => this.flash.classList.remove('on'));
      photo.classList.add('on');
      await sleep(3600);
      photo.classList.remove('on');
      await e.fade(true, 500);
    }
    photo.remove();
    this._finish();
  }

  _clearSet() {
    for (const o of this.setObjs || []) (o.dispose ? o.dispose() : o.removeFromParent());
    this.setObjs = [];
  }

  _setPerson(look, age, pos, yaw, pose = 'stand') {
    const p = new Person(look, age, {});
    p.root.position.copy(pos);
    p.root.rotation.y = yaw;
    p.pose = pose;
    this.world.scene.add(p.root);
    for (let i = 0; i < 30; i++) p.update(0.05);
    this.setObjs.push(p);
    return p;
  }

  _birthdaySet(cam) {
    const w = this.world;
    const chairs = w.home.spots.filter((s) => s.kind === 'seat' && s.table);
    const cx = chairs.reduce((a, s) => a + s.at.x, 0) / chairs.length;
    const cz = chairs.reduce((a, s) => a + s.at.z, 0) / chairs.length;
    const fy = w.home.floorY;
    const cake = assets.model('food', 'cake-birthday', { scale: 0.9 });
    cake.position.set(cx, fy + 0.78, cz);
    w.scene.add(cake);
    this.setObjs.push(cake);
    const glow = new THREE.PointLight(0xffb060, 1.6, 3, 2);
    glow.position.set(cx, fy + 1.05, cz);
    w.scene.add(glow);
    this.setObjs.push(glow);
    // Family at the table; you behind the cake (age 4).
    const you = chairs[0];
    const all = [...this.parents, ...this.recs.filter((r) => r.role === 'sibling')];
    all.slice(0, chairs.length - 1).forEach((r, i) => {
      const s = chairs[i + 1];
      const p = this._setPerson(r.look, r.role === 'sibling' ? (r.age > 8 ? 8 : 1) : r.age, s.at.clone().setY(s.at.y - 0.47 * 1.0), s.faceYaw, 'sit');
      p.play('cheer');
    });
    this._setPerson(this.life.character.look, 4, you.at.clone().setY(you.at.y - 0.47 * 0.6), you.faceYaw, 'sit');
    const f = you.faceYaw;
    cam.position.set(cx - Math.sin(f) * 2.2 + Math.cos(f) * 0.8, fy + 1.45, cz - Math.cos(f) * 2.2 - Math.sin(f) * 0.8);
    cam.lookAt(cx, fy + 0.85, cz);
  }

  _schoolSet(cam) {
    const w = this.world;
    const door = w.home.spawn.frontDoor.clone();
    const y = 0.12;
    const kidPos = door.clone().add(new THREE.Vector3(0.3, 0, 2.2)).setY(y);
    this._setPerson(this.life.character.look, 5, kidPos, 0);
    const a = this.parents[0];
    if (a) {
      const p = this._setPerson(a.look, a.age, door.clone().add(new THREE.Vector3(-0.6, 0, 1.2)).setY(y), 0.3);
      p.play('wave');
    }
    cam.position.copy(kidPos).add(new THREE.Vector3(1.2, 1.3, 4.2));
    cam.lookAt(kidPos.x - 0.2, 1.0, kidPos.z - 0.8);
  }

  // ------------------------------------------------------------------ 4. 8 years later
  async _finish() {
    if (this._finishing) return;
    this._finishing = true;
    const e = this.engine;
    await this.worldReady;
    this._clearSet();
    this.card.textContent = '8 YEARS LATER';
    this.card.classList.add('dark', 'on');
    await e.fade(false, 10);
    music.stop({ fade: 2 });
    await sleep(this.skipped ? 1200 : 2600);
    const life = this.life;
    life.opening = 'done';
    clock.reset(32, 7 * 60);
    save.commit();
    this._handOff = true;
    if (this._bearIt) this.world.interact.remove(this._bearIt);
    for (const o of this.objects) o.removeFromParent();
    this.player?.dispose();
    this.player = null;
    e.setBlur(0);
    e.go('world', { world: this.world, wake: true }, { fadeMs: 400 });
  }

  update(dt) {
    this.t += dt;
    // Hold Enter to skip.
    if (input.keysDown?.has('Enter') || input.keysDown?.has('NumpadEnter')) this.skipHold += dt;
    else this.skipHold = Math.max(0, this.skipHold - dt * 2);
    this.skipBar.style.width = `${Math.min(100, (this.skipHold / 1.2) * 100)}%`;
    if (this.skipHold > 1.2 && !this.skipped) {
      this.skipped = true;
      this.hud.subtitle('', '', 0.01);
      this._finish();
    }
    if (this.phase === 'hospital') this._hospitalUpdate(dt);
    else if (this.phase === 'baby' && this.player) {
      this._babyUpdate(dt);
      this.world.update(dt, { viewer: this.player.position, camera: this.player.camera });
    }
    this.hud.update(dt);
  }

  fixedUpdate(step) {
    this.player?.fixedUpdate(step);
  }

  _hospitalUpdate(dt) {
    const e = this.engine;
    // Eyes slowly learn to focus.
    const focus = Math.min(1, Math.max(0, (this.t - 3) / 14));
    e.setBlur(1 - focus * 0.8);
    const cam = this.hCam;
    const [a, b] = this.faces;
    let goal = this.camLook;
    if (this.lookGoal === 'face' && a) goal = a.p.eyePosition(new THREE.Vector3());
    else if (this.lookGoal === 'both' && a && b) goal = a.p.eyePosition(new THREE.Vector3()).lerp(b.p.eyePosition(new THREE.Vector3()), 0.3);
    this._lk = (this._lk || this.camLook.clone()).lerp(goal, 1 - Math.pow(0.25, dt));
    cam.position.y = 1.12 + Math.sin(this.t * 1.3) * 0.012; // being rocked gently
    cam.position.x = Math.sin(this.t * 0.9) * 0.02;
    cam.lookAt(this._lk);
    for (const f of this.faces) {
      f.p.lookAt(cam.position);
      f.p.update(dt);
    }
    // Heart monitor.
    const c = this.monCtx;
    c.fillStyle = '#071a10';
    c.fillRect(0, 0, 256, 128);
    c.strokeStyle = '#3cff8a';
    c.lineWidth = 3;
    c.beginPath();
    for (let x = 0; x < 256; x++) {
      const ph = (x / 256 + this.t * 0.6) % 1;
      const y = 64 - (ph > 0.42 && ph < 0.46 ? (ph - 0.42) * 1200 : ph > 0.46 && ph < 0.5 ? (0.5 - ph) * 1200 - 20 : 0);
      x ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.stroke();
    this.monTex.needsUpdate = true;
    // Beep.
    if (this._beeping) {
      this._beepT = (this._beepT || 0) - dt;
      if (this._beepT <= 0) {
        this._beepT = 0.95;
        audio.play?.('store.beep', { gain: 0.25, rate: 0.36, reverb: 0.3 });
      }
    }
  }

  exit() {
    this.engine.setBlur(0);
    this.ui?.remove();
    this.hud?.dispose();
    this.player?.dispose();
    this._clearSet();
    if (!this._handOff && this.world) this.world.dispose();
  }
}
