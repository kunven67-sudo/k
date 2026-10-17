// Portal Gun: an unofficial Rick and Morty fan game. Part 1: the Smith house.
import * as THREE from './three.js';
import { Pipeline } from './render/pipeline.js';
import { Sky } from './render/sky.js';
import { LAYER_OVERLAY } from './render/kit.js';
import { makeCanvas, canvasTexture } from './render/materials.js';
import { PhysicsWorld } from './core/physics.js';
import { Input } from './core/input.js';
import { audio } from './core/audio.js';
import { music } from './core/music.js';
import { loadSettings, saveSettings } from './core/settings.js';
import { Interact } from './game/interact.js';
import { buildHouse } from './game/house.js';
import { Player } from './game/player.js';
import { PortalGun } from './game/gun.js';
import { Environment } from './game/env.js';
import { PortalSystem } from './game/portals.js';
import { NPC, IdleChatter } from './game/npc.js';
import { Cruiser } from './game/cruiser.js';
import { TV } from './game/tv.js';
import { Story } from './game/story.js';
import { Dialogue } from './game/dialogue.js';
import { mortyAsleep } from './game/toons.js';
import { HUD } from './ui/hud.js';
import { Menu } from './ui/menu.js';
import { store, pick, clamp, damp } from './util.js';

const SAVE_KEY = 'portalgun.save.v1';
const NIGHT_TINT = new THREE.Color(0.6, 0.66, 0.9);
const DAY_TINT = new THREE.Color(1, 1, 1);
const PORTAL_COST = 0.08;

const DIAL = [
  { code: 'C-137', name: 'Here (C-137)', note: 'Linked portals: shoot two, walk through one', kind: 'here' },
  { code: '35-C', name: 'Dimension 35-C', note: 'Unlocks in Part 2', kind: 'locked' },
  { code: 'CRNBRG', name: 'Cronenberg World', note: 'Unlocks in Part 2', kind: 'locked' },
  { code: 'CTDL', name: 'Citadel of Ricks', note: 'Unlocks in Part 2', kind: 'locked' },
  { code: 'B+C', name: 'Blips and Chitz', note: 'Unlocks in Part 2', kind: 'locked' },
  { code: 'B00B', name: 'Boob World', note: 'Totally going this time', kind: 'boob' },
];

// Rick's nonsense catchphrases (from the show)
const CATCHPHRASES = ['Wubba lubba dub dub!', "And that's the waaaay the news goes!", 'Hit the sack, Jack!', 'Uh oh, somersault jump!', 'Grass tastes bad!', 'Rikki-tikki-tavi, biatch!'];

const MORTY_CHATTER = [
  "Aw geez, Rick, I'm so tired.",
  'Rick, w-what are we doing today? Nothing dangerous, right?',
  "I-I-I think I'm still half asleep.",
  'Can we please not almost die today? Just one day?',
  "Rick, Mom's gonna kill me if I miss school again.",
  'Why does the garage always smell like that, Rick?',
];

/** Morty asleep: a flat drawing lying in his bed */
class SleepingMorty {
  constructor(scene, at) {
    this.canvas = makeCanvas(400, 600);
    this.tex = canvasTexture(this.canvas);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.88), new THREE.MeshBasicMaterial({ map: this.tex, alphaTest: 0.5, fog: true }));
    this.mesh.rotation.set(-Math.PI / 2, 0, 0);
    this.mesh.position.copy(at).add(new THREE.Vector3(0, 0.07, 0.42));
    this.mesh.layers.set(LAYER_OVERLAY);
    scene.add(this.mesh);
    this.awake = false;
    this.snore = false;
    this.t = 0;
    this.draw();
  }
  draw() {
    const g = this.canvas.getContext('2d');
    g.clearRect(0, 0, 400, 600);
    mortyAsleep(g, { snore: this.snore, awake: this.awake });
    this.tex.needsUpdate = true;
  }
  setAwake(v) {
    this.awake = v;
    this.draw();
  }
  show() {
    this.mesh.visible = true;
    this.awake = false;
    this.draw();
  }
  hide() {
    this.mesh.visible = false;
  }
  update(dt, tint) {
    if (!this.mesh.visible) return;
    this.mesh.material.color.copy(tint);
    this.t += dt;
    const s = !this.awake && Math.sin(this.t * 1.7) > 0.3;
    if (s !== this.snore) {
      this.snore = s;
      this.draw();
      if (s) audio.snore();
    }
  }
}

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.settings = loadSettings();
    this.pipe = new Pipeline(this.canvas);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, 1, 0.08, 1200);
    this.pipe.scene = this.scene;
    this.pipe.camera = this.camera;
    this.sky = new Sky();
    this.scene.add(this.sky.mesh);
    this.physics = new PhysicsWorld();
    this.interact = new Interact(this.physics);
    this.input = new Input(this.canvas);
    this.audio = audio;
    this.hud = new HUD();
    this.dialogue = new Dialogue(document.getElementById('subtitle'));
    this.dialogue.onTalk = (who, on) => this._talkAnim(who, on);
    this.gun = new PortalGun();
    this.pipe.viewScene = this.gun.scene;
    this.pipe.viewCamera = this.gun.camera;
    this.env = new Environment(this.scene, this.sky, this.gun);
    this.house = buildHouse(this);
    this.scene.add(this.house.root);
    this.house.static();
    this.player = new Player(this);
    this.portals = new PortalSystem(this);
    this.portals.maxPairs = 2;
    this.cruiser = new Cruiser(this);
    this.tv = new TV(this, this.house.anchors.tvScreen);
    this.story = new Story(this);
    this.state = 'title';
    this.cutscene = false;
    this.fluid = 1;
    this.dialIdx = 0;
    this.shootCD = 0;
    this.travelState = { cooldown: 0, ignore: null, onTeleport: (a, b, ex) => this._playerTeleported(a, b, ex) };
    this.mortyTravel = { cooldown: 0, ignore: null };
    this.fovKick = 0;
    this.drunk = 0;
    this.t = 0;
    this.spots = {
      shipHome: new THREE.Vector3(-8.75, 0, 0.2),
      mortyWake: new THREE.Vector3(-2.8, 3.1, 1.0),
    };
    this._buildCast();
    this._buildInteractions();
    this.menu = new Menu(this);
    this.applySettings();
    this.ambient = null;
    this.chatter = new IdleChatter(this, 'morty', MORTY_CHATTER, 40, 80);

    const resumeHint = document.getElementById('resume-hint');
    this.input.onLockChange = (locked) => {
      resumeHint.hidden = true;
      if (!locked && this.state === 'playing' && !this.input.dragLook) this.pause();
    };
    // the re-lock was refused (too soon after Esc): ask for one more click
    this.input.onLockError = () => {
      if (this.state === 'playing' && !this.input.dragLook) resumeHint.hidden = false;
    };
    // start the menu music on the first click anywhere
    const firstTouch = () => {
      audio.init();
      if (this.state === 'title') music.play('menu');
      removeEventListener('pointerdown', firstTouch);
      removeEventListener('keydown', firstTouch);
    };
    addEventListener('pointerdown', firstTouch);
    addEventListener('keydown', firstTouch);
    addEventListener('resize', () => this.pipe.resize(innerWidth, innerHeight));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });
    this.last = performance.now();
    this.pipe.resize(innerWidth, innerHeight);
    // a nice backdrop behind the title menu
    this.setTime('night');
    this.placeFamily('night');
    this.player.teleport(new THREE.Vector3(4, 0, 30), 0.35);
    this.player.pitch = 0.12;
    this.menu.show('title');
    document.getElementById('loading').hidden = true;
    this.hud.fade(0, 1.5);
    requestAnimationFrame(() => this.frame());
  }

  // ---------------------------------------------------------------- cast
  _buildCast() {
    const a = this.house.anchors;
    this.morty = new NPC(this, 'morty', {
      pos: new THREE.Vector3(2.9, 0, -3.5),
      name: 'Morty',
      lines: [
        [['morty', "Rick, I-I don't think I'm cut out for this stuff."], ['rick', "Nobody is, Morty. That's what makes it fun."]],
        [['morty', 'Can we go somewhere cool today? Like, actually cool?'], ['rick', "Everywhere's cool with a portal gun, Morty."]],
        [['morty', 'Aw geez, Rick. Aw geez.']],
        [['morty', 'Rick, w-what does wubba lubba dub dub even mean?'], ['rick', "Don't worry about it, Morty."]],
      ],
    });
    this.jerry = new NPC(this, 'jerry', {
      pos: a.couchSeats[0].clone(),
      name: 'Jerry',
      lines: [
        [['jerry', 'Rick, can we talk about boundaries? Rick? Are you even listening?'], ['rick', 'Nope.']],
        [['jerry', "I'm thinking of starting a podcast. Like, about life. Do you think people would listen?"], ['rick', 'Jerry, people barely listen when you talk in person.']],
        [['jerry', 'Interdimensional cable again? Fine. I was going to watch it anyway.']],
        [['jerry', "Beth says I need a hobby. I said my hobby is being a great dad. She didn't laugh."]],
      ],
    });
    this.beth = new NPC(this, 'beth', {
      pos: new THREE.Vector3(4.6, 0, -6.6),
      name: 'Beth',
      lines: [
        [['beth', 'Dad, are you staying for dinner tonight? Please say yes.'], ['rick', "Yeah, sure, sweetie. *burp* Probably."]],
        [['beth', "I've got a horse in surgery at noon. I'm a horse surgeon, Dad. It's a real job."], ['rick', "I know, honey. You're great at cutting up horses."]],
        [['beth', "Don't let Jerry get to you. He's just... Jerry."]],
      ],
    });
    this.summer = new NPC(this, 'summer', {
      pos: new THREE.Vector3(2.1, 0, -5.5),
      name: 'Summer',
      lines: [
        [['summer', 'Grandpa, can I come on the next adventure? Morty always gets to go.'], ['rick', 'Maybe next time, Summer.']],
        [['summer', "Ugh, don't look at my phone. It's private."]],
        [['summer', 'Whatever you guys did last night, Morty smells like a burnt battery.']],
      ],
    });
    this.butter = new NPC(this, 'butter', {
      pos: new THREE.Vector3(2.15, 0.78, -4.45),
      name: 'Butter Robot',
      label: () => (this.butterDone ? 'Talk to the Butter Robot' : 'Talk to the Butter Robot'),
      talkRange: 3,
    });
    this.butter.gravity = false;
    this.butter.onTalk = () => this._butterTalk();
    this.poopy = new NPC(this, 'poopy', {
      pos: new THREE.Vector3(-3.6, 0, 12.6),
      name: 'Mr. Poopybutthole',
      label: 'Talk to Mr. Poopybutthole',
    });
    this.poopy.onTalk = () => this._poopyTalk();
    this.cast = [this.morty, this.jerry, this.beth, this.summer, this.butter, this.poopy];
    this.mortySleep = new SleepingMorty(this.scene, a.mortyBed);
  }

  /** put the family where they belong for each part of the story */
  placeFamily(mode) {
    const a = this.house.anchors;
    const ch = a.chairs;
    const all = this.cast;
    for (const n of all) {
      n.mode = 'idle';
      n.setVisible(true);
    }
    if (mode === 'night') {
      // everyone's asleep: only sleeping Morty is visible
      for (const n of all) n.setVisible(false);
      this.mortySleep.show();
      this.butter.setVisible(false);
      return;
    }
    this.mortySleep.hide();
    if (mode === 'breakfast') {
      const sitAt = (n, i) => {
        n.setSit(true);
        n.placeAt(ch[i].pos, ch[i].yaw);
      };
      sitAt(this.jerry, 0);
      sitAt(this.beth, 1);
      sitAt(this.summer, 2);
      sitAt(this.morty, 3);
      this.poopy.placeAt(new THREE.Vector3(-3.6, 0, 12.6), Math.PI);
    } else {
      // regular day
      this.jerry.setSit(true);
      this.jerry.placeAt(a.couchSeats[0], -Math.PI / 2);
      this.beth.setSit(false);
      this.beth.placeAt(new THREE.Vector3(4.6, 0, -6.6), Math.PI);
      this.summer.setSit(true);
      this.summer.placeAt(ch[2].pos, ch[2].yaw);
      this.morty.setSit(false);
      this.morty.mode = 'follow';
      this.morty.placeAt(this.morty.body.pos.clone().setY(0).add(new THREE.Vector3(0.6, 0, 0.9)), 0);
      this.poopy.placeAt(new THREE.Vector3(-3.6, 0, 12.6), Math.PI);
    }
  }

  _talkAnim(who, on) {
    const map = { morty: this.morty, jerry: this.jerry, beth: this.beth, summer: this.summer, poopy: this.poopy, butter: this.butter };
    const n = map[who];
    if (n) n.sprite.talking = on;
  }

  say(lines) {
    if (typeof lines === 'string') lines = [['rick', lines]];
    return this.dialogue.play(lines);
  }

  // ---------------------------------------------------------------- interactions
  _buildInteractions() {
    const a = this.house.anchors;
    // waking Morty
    this.interact.add({
      pos: a.mortyBed.clone().add(new THREE.Vector3(0, 0.2, 0)),
      radius: 0.9,
      label: () => 'Wake up Morty',
      enabled: () => this.story.stage === 'intro' && this.story.step === 'wake' && this.mortySleep.mesh.visible,
      use: () => this.story.wakeMorty(),
    });
    // the ship
    this.interact.add({
      pos: (out) => out.copy(this.cruiser.pos).add(new THREE.Vector3(0, 1.0, 0)),
      radius: 1.8,
      range: 3.2,
      label: () => 'Get in the Space Cruiser',
      enabled: () => this.player.mode === 'walk' && !this.cutscene && (this.story.stage === 'free' || this.story.step === 'ship'),
      use: () => this.boardShip(),
    });
    // refill station
    this.interact.add({
      pos: a.refiner.position.clone().add(new THREE.Vector3(0, 0.35, 0)),
      radius: 0.7,
      label: () => (this.fluid >= 0.999 ? 'Portal fluid is full' : 'Refill portal fluid'),
      enabled: () => this.story.stage === 'free',
      use: () => {
        if (this.fluid >= 0.999) {
          audio.denied();
          return;
        }
        this.fluid = 1;
        audio.refill();
        this.gun.flash = 1;
        this.hud.toast('Portal fluid: 100%');
        this.story.complete('refill');
        if (Math.random() < 0.6) this.say([['rick', pick(['Ahh, fresh portal fluid. *burp* Smells like adventure, Morty.', "Topped off. Let's go break some laws of physics."])]]);
      },
    });
    // the couch / TV
    this.interact.add({
      pos: a.couchSeats[2].clone().add(new THREE.Vector3(0, 0.6, 0)),
      radius: 0.8,
      label: () => 'Sit down and watch Interdimensional Cable',
      enabled: () => this.player.mode === 'walk' && this.story.stage === 'free' && !this.cutscene,
      use: () => this.sitCouch(),
    });
  }

  async _butterTalk() {
    if (this.dialogue.busy && this._butterBusy) return;
    this._butterBusy = true;
    if (!this.butterDone) {
      await this.say([
        ['butter', 'What is my purpose?'],
        ['rick', 'You pass butter.'],
      ]);
      // slide the butter dish across the table
      this._butterSlide = 1;
      await this.say([
        ['butter', '...Oh my god.'],
        ['rick', 'Yeah, welcome to the club, pal.'],
      ]);
      this.butterDone = true;
      this.story.complete('butter');
    } else {
      await this.say(pick([[['butter', 'Shall I... pass more butter?'], ['rick', "That's the whole job, buddy."]], [['butter', 'I have been thinking about my existence.'], ['rick', "Don't. It doesn't help."]]]));
    }
    this._butterBusy = false;
  }

  async _poopyTalk() {
    const first = !this.story.done.has('poopy');
    if (first) {
      await this.say([
        ['poopy', "Ooo-wee! Hey there, Rick! Beautiful day to be a family friend, huh? Ooo-wee!"],
        ['rick', 'Hey, Mr. Poopybutthole.'],
        ['poopy', 'Tell Morty I said hi! Ooo-wee!'],
      ]);
      this.story.complete('poopy');
    } else {
      await this.say(pick([[['poopy', 'Ooo-wee!']], [['poopy', "Ooo-wee! I'm just standing out here, being a friend! Ooo-wee!"]], [['poopy', 'You know what they say: a portal a day keeps the... Ooo-wee, I forgot!']]]));
    }
  }

  // ---------------------------------------------------------------- ship
  boardShip() {
    this.player.mode = 'ship';
    this.cruiser.board();
    this.gun.visible = false;
    this.hud.setGunVisible(false);
    // Morty hops in too
    if (this.morty.mode === 'follow' || this.story.stage === 'intro') {
      this.morty.mode = 'ship';
      this.morty.setSit(true);
    }
    if (this.story.stage === 'intro') this.story.boarded();
    else {
      this.house.garage.set(true);
      music.play('flight');
      this._flySince = 0;
    }
  }

  leaveShip(force = false) {
    if (this.player.mode !== 'ship') return;
    if (!force) {
      if (this.story.stage === 'intro') {
        this.hud.toast("Not now, you're kind of in the middle of something", true);
        return;
      }
      if (this.cruiser.altitude() > 3.5) {
        this.hud.toast('Fly lower to get out (hold C)', true);
        audio.denied();
        return;
      }
    }
    this.cruiser.leave();
    const c = this.cruiser;
    const right = new THREE.Vector3(Math.cos(c.yaw), 0, -Math.sin(c.yaw));
    let spot = null;
    for (const side of [-1, 1]) {
      for (const d of [2.2, 3.0]) {
        const p = c.pos.clone().addScaledVector(right, side * d);
        p.y = this.physics.floorBelow(p.x, c.pos.y + 1.5, p.z, 5);
        if (!this.physics.pointBlocked(p.x, p.y + 0.5, p.z, 0.3) && !this.physics.pointBlocked(p.x, p.y + 1.5, p.z, 0.3)) {
          spot = p;
          break;
        }
      }
      if (spot) break;
    }
    if (!spot) spot = c.pos.clone().add(new THREE.Vector3(0, 2.2, 0));
    this.player.mode = 'walk';
    this.player.teleport(spot, c.yaw);
    this.player.pitch = 0;
    this.gun.visible = true;
    this.hud.setGunVisible(true);
    if (this.morty.mode === 'ship') {
      this.morty.setSit(false);
      this.morty.mode = 'follow';
      // stand next to Rick, on the side away from the ship
      const away = new THREE.Vector3(spot.x - c.pos.x, 0, spot.z - c.pos.z).normalize();
      const along = new THREE.Vector3(-away.z, 0, away.x);
      let mp = spot.clone().addScaledVector(along, 0.9);
      if (this.physics.pointBlocked(mp.x, mp.y + 0.6, mp.z, 0.25)) mp = spot.clone().addScaledVector(away, 0.9);
      this.morty.placeAt(mp, c.yaw);
    }
    if (this.story.stage === 'free') {
      music.play('house');
      if ((this._flySince || 0) > 6) this.story.complete('fly');
    }
  }

  // ---------------------------------------------------------------- couch
  sitCouch() {
    const a = this.house.anchors;
    this.player.mode = 'sit';
    const seat = a.couchSeats[2];
    this.player.body.pos.set(seat.x, 0, seat.z);
    this.player.body.vel.set(0, 0, 0);
    this.player.yaw = Math.atan2(-(a.tvScreen.pos.x - seat.x), -(a.tvScreen.pos.z - seat.z));
    this.player.pitch = -0.05;
    this.player.eye = 1.2;
    this.gun.visible = false;
    this.tv.turnOn();
    this.tv.watching = true;
    this._tvTime = 0;
    if (this.morty.mode === 'follow') {
      this.morty.mode = 'idle';
      this.morty.setSit(true);
      this.morty.placeAt(a.couchSeats[1], -Math.PI / 2);
    }
    this.say([['rick', pick(['Ahh, interdimensional cable. Infinite TV from infinite universes, Morty.', 'Alright, what garbage are other dimensions watching today?'])]]);
  }

  standUp() {
    this.player.mode = 'walk';
    this.player.eye = 1.72;
    this.player.body.pos.x -= 0.9;
    this.gun.visible = true;
    this.tv.watching = false;
    this.dialogue.stop();
    if (this.morty.sit && this.morty.mode === 'idle') {
      this.morty.setSit(false);
      this.morty.mode = 'follow';
      this.morty.placeAt(this.house.anchors.couchSeats[1].clone().add(new THREE.Vector3(-1.0, 0, 0)), -Math.PI / 2);
    }
    if ((this._tvTime || 0) > 8) this.story.complete('tv');
  }

  // ---------------------------------------------------------------- portals
  _playerTeleported(from, to, ex) {
    this.hud.flash();
    this.fovKick = 1;
    if (to.kind !== 'floor' && to.kind !== 'ceiling') this.player.yaw = Math.atan2(-ex.dir.x, -ex.dir.z);
    this.story.complete('portal');
    // Morty follows you through if he's close
    const m = this.morty;
    if (m.mode === 'follow' && !m.hidden) {
      const d = m.body.pos.distanceTo(from.center);
      if (d < 14) {
        const delay = clamp(d / 4.5, 0.5, 2.2);
        setTimeout(() => {
          if (m.mode !== 'follow' || to.state === 'dead') return;
          const e = to.exitTransform(this.physics, m.body.height);
          // he may have already walked through on his own
          if (m.body.pos.distanceTo(e.pos) < 3) return;
          const side = new THREE.Vector3(-e.dir.z, 0, e.dir.x).multiplyScalar(0.7);
          const p = e.pos.clone().add(side);
          if (this.physics.pointBlocked(p.x, p.y + 0.6, p.z, 0.25)) p.copy(e.pos);
          m.placeAt(p, Math.atan2(e.dir.x, e.dir.z));
          m.body.vel.copy(e.vel);
          if (Math.random() < 0.35) this.say([['morty', pick(['Whoa! I-I hate that feeling!', "Aw geez, my stomach's still back there!", 'Wait up, Rick!'])]]);
        }, delay * 1000);
      }
    }
  }

  onPortalPlaced(spec, kind) {
    if (kind === 'boob') {
      const p = this.portals.open(spec, { unpaired: true });
      setTimeout(() => p.close(), 750);
      this.story.boobWorld();
      return;
    }
    this.portals.open(spec);
  }

  onPortalFail() {
    this.hud.toast("The portal won't fit there", true, 1.6);
  }

  shoot() {
    const d = DIAL[this.dialIdx];
    if (this.shootCD > 0) return;
    this.shootCD = 0.4;
    if (d.kind === 'locked') {
      audio.denied();
      this.gun.dial(0);
      this.hud.toast(`${d.name} unlocks in Part 2`, true, 2.2);
      return;
    }
    const cost = d.kind === 'boob' ? PORTAL_COST * 0.5 : PORTAL_COST;
    if (this.fluid < cost - 1e-6) {
      audio.denied();
      audio.lowFluid();
      this.hud.toast('Out of portal fluid! Refill at the workbench in the garage', true, 2.6);
      if (!this.dialogue.busy) this.say([['rick', pick(["Ugh, I'm out of portal fluid.", "Empty. Great. *burp* Just great."])]]);
      return;
    }
    this.fluid = Math.max(0, this.fluid - cost);
    this.gun.fire();
    const muzzle = this.gun.muzzleWorld(this.camera);
    this.portals.shoot(muzzle, this.camera, d.kind === 'boob' ? 'boob' : 'pair');
    if (this.fluid < 0.2 && this.fluid + cost >= 0.2) {
      audio.lowFluid();
      this.hud.toast('Portal fluid is getting low', true, 2);
    }
  }

  turnDial(step) {
    this.dialIdx = (this.dialIdx + step + DIAL.length) % DIAL.length;
    this.gun.dial(step);
    audio.dial();
  }

  // ---------------------------------------------------------------- flow
  hasSave() {
    return !!store.get(SAVE_KEY, null);
  }

  saveGame() {
    if (this.state === 'title') return;
    store.set(SAVE_KEY, { story: this.story.save(), fluid: this.fluid, butter: !!this.butterDone, dial: this.dialIdx });
  }

  _begin() {
    audio.init();
    audio.applyVolumes();
    this.menu.hide();
    this.hud.show(true);
    this.state = 'playing';
    this.input.enabled = true;
    this.input.requestLock();
    this.canvas.focus();
    this._ambient();
  }

  newGame() {
    store.remove(SAVE_KEY);
    this.story = new Story(this);
    this.butterDone = false;
    this.dialIdx = 0;
    this._begin();
    this.story.startIntro();
  }

  continueGame() {
    const s = store.get(SAVE_KEY, null);
    if (!s) return this.newGame();
    this.story = new Story(this);
    this.story.load(s.story);
    this.butterDone = !!s.butter;
    this.dialIdx = s.dial || 0;
    this._begin();
    if (s.story?.stage === 'intro') {
      this.story.startIntro();
      return;
    }
    this.story.stage = 'free';
    this.setTime('day');
    music.play('house');
    this.placeFamily('day');
    this.fluid = s.fluid ?? 0.25;
    this.portals.clearAll(true);
    this.player.mode = 'walk';
    this.player.teleport(this.house.spawn.kitchen.pos, this.house.spawn.kitchen.yaw);
    this.morty.placeAt(this.house.spawn.kitchen.pos.clone().add(new THREE.Vector3(-1, 0, 1)), 0);
    this.hud.fade(0, 1);
    this.hud.toast('Welcome back!');
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.exitLock();
    this.menu.show('pause');
    if (this.dialogue.tts) speechSynthesis.pause?.();
    audio.ctx?.suspend();
    music.pauseCustom(true);
  }

  resume() {
    if (this.state !== 'paused') return;
    this.menu.hide();
    this.state = 'playing';
    audio.ctx?.resume();
    if (this.dialogue.tts) speechSynthesis.resume?.();
    music.pauseCustom(false);
    this.input.requestLock();
    this.canvas.focus();
    this.last = performance.now();
  }

  quitToTitle() {
    this.saveGame();
    this.dialogue.stop();
    this.state = 'title';
    audio.ctx?.resume();
    this.hud.show(false);
    this.input.enabled = false;
    if (this.player.mode === 'ship') this.leaveShip(true);
    if (this.player.mode === 'sit') this.standUp();
    this.cutscene = false;
    music.play('menu');
    this.setTime('night');
    this.placeFamily('night');
    this.player.teleport(new THREE.Vector3(4, 0, 30), 0.35);
    this.player.pitch = 0.12;
    this.menu.show('title');
  }

  setTime(name) {
    this.env.set(name);
    this.timeOfDay = name;
    this._ambient();
  }

  _ambient() {
    if (!audio.ctx) return;
    this.ambient?.stop();
    this.ambient = audio.loop(this.timeOfDay === 'night' ? 'crickets' : 'birds');
    this.ambient?.gain(0.6, 0.5);
    this._chirpT = 0;
  }

  applySettings() {
    const s = this.settings;
    audio.volumes.master = s.master;
    audio.volumes.music = s.music;
    audio.volumes.sfx = s.sfx;
    audio.applyVolumes();
    music.syncVolume();
    this.dialogue.mode = s.voice;
    this.dialogue.volume = s.voiceVol;
    this.player.sens = s.sens;
    this.player.invertY = s.invertY;
    this.camera.fov = s.fov;
    this.camera.updateProjectionMatrix();
    if (this.pipe.quality !== s.quality) this.pipe.setQuality(s.quality);
  }

  // ---------------------------------------------------------------- frame
  frame() {
    requestAnimationFrame(() => this.frame());
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    this.pipe.resize(innerWidth, innerHeight);
    if (this.state === 'playing') this.updatePlaying(dt);
    else this.updateIdle(dt);
    this.hud.update(dt);
    this.sky.update(this.camera, this.t);
    this.pipe.render(dt);
    this.input.endFrame();
  }

  updateIdle(dt) {
    // slow camera drift behind the title menu
    if (this.state === 'title') {
      this.player.yaw += dt * 0.03;
      this.player.applyCamera();
    }
    this.camera.updateMatrixWorld();
    this.house.update(dt);
    this.cruiser.update(dt, this.input);
    for (const n of this.cast) if (!n.hidden) n.sprite.update(dt, this.camera);
    this.mortySleep.update(dt, this.timeOfDay === 'night' ? NIGHT_TINT : DAY_TINT);
    this.gun.update(dt, this.player, false);
    this.gun.scene.visible = false;
  }

  updatePlaying(dt) {
    const inp = this.input;
    const p = this.player;
    if (inp.hit('Escape')) this.pause();
    const free = !this.cutscene;

    // ---- controls
    if (p.mode === 'walk' && free) {
      if (inp.clicked.has(0)) this.shoot();
      if (inp.wheel) this.turnDial(inp.wheel > 0 ? 1 : -1);
      if (inp.hit('KeyQ')) this.turnDial(1);
      for (let i = 0; i < DIAL.length; i++) if (inp.hit(`Digit${i + 1}`)) {
        if (this.dialIdx !== i) {
          this.gun.dial(i - this.dialIdx);
          this.dialIdx = i;
          audio.dial();
        }
      }
      if (inp.hit('KeyR')) {
        this.portals.clearAll();
        audio.click();
      }
      if (inp.hit('KeyE') && this.interact.current) this.interact.current.use();
      if (inp.hit('KeyV') && !this.dialogue.busy) this.say([['rick', pick(CATCHPHRASES)]]);
      if (inp.hit('KeyB')) audio.burp(1.1);
      if (inp.hit('KeyF')) this.drinkFlask();
    } else if (p.mode === 'ship') {
      if (inp.hit('KeyE')) this.leaveShip();
      this._flySince = (this._flySince || 0) + dt;
    } else if (p.mode === 'sit') {
      this._tvTime = (this._tvTime || 0) + dt;
      if (inp.hit('KeyD') || inp.hit('ArrowRight')) this.tv.change(1);
      if (inp.hit('KeyA') || inp.hit('ArrowLeft')) this.tv.change(-1);
      if (inp.hit('KeyE') || inp.hit('Space')) this.standUp();
      if (this._tvTime > 8 && !this.story.done.has('tv')) this.story.complete('tv');
    }
    this.shootCD -= dt;

    // ---- simulation
    if (p.mode === 'ship') {
      this.cruiser.update(dt, inp, this.settings.sens);
      p.body.pos.copy(this.cruiser.pos);
    } else {
      this.cruiser.update(dt, inp);
      p.update(dt, free ? inp : { mouseDX: inp.mouseDX, mouseDY: inp.mouseDY, axis: () => 0, key: () => false, hit: () => false });
    }
    this.travelState.cooldown -= dt;
    if (p.mode === 'walk') this.portals.checkTravel(p.body, this.travelState);
    this.portals.update(dt, p.body.pos);

    // camera
    if (p.mode === 'ship') this.cruiser.applyCamera(this.camera);
    else p.applyCamera();
    this.fovKick = Math.max(0, this.fovKick - dt * 2.5);
    this.drunk = Math.max(0, this.drunk - dt * 0.15);
    const wob = this.drunk > 0 ? Math.sin(this.t * 1.7) * 0.03 * this.drunk : 0;
    this.camera.rotation.z += wob;
    const fov = p.mode === 'sit' ? 38 : this.settings.fov + this.fovKick * 18 + (p.mode === 'ship' ? 6 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * damp(10, dt);
      this.camera.updateProjectionMatrix();
    }
    this.camera.updateMatrixWorld();
    audio.listener.x = this.camera.position.x;
    audio.listener.y = this.camera.position.y;
    audio.listener.z = this.camera.position.z;
    audio.listener.yaw = p.mode === 'ship' ? this.cruiser.yaw : p.yaw;

    // world + people
    this.house.update(dt);
    if (p.mode === 'walk' && this.morty.mode === 'follow') this.morty.recordTrail(p.body.pos);
    for (const n of this.cast) {
      if (n.hidden) continue;
      if (n === this.morty && n.mode === 'ship') {
        const seat = this.cruiser.seatWorld(this.cruiser.seatPassenger);
        n.body.pos.set(seat.x, seat.y - 0.5, seat.z);
        n.sprite.facing = this.cruiser.yaw + Math.PI;
        n.sync();
        n.sprite.speed = 0;
        n.sprite.update(dt, this.camera);
        continue;
      }
      n.update(dt);
    }
    if (this.morty.mode === 'follow') {
      this.mortyTravel.cooldown -= dt;
      this.portals.checkTravel(this.morty.body, this.mortyTravel);
    }
    this.mortySleep.update(dt, this.timeOfDay === 'night' ? NIGHT_TINT : DAY_TINT);
    this._updateButter(dt);
    this.tv.update(dt);
    this.story.update(dt);
    if (free && this.morty.mode === 'follow' && this.story.stage === 'free') this.chatter.update(dt);

    // gun
    this.gun.visible = p.mode === 'walk';
    this.gun.level = this.fluid;
    const d = DIAL[this.dialIdx];
    this.gun.setDisplay(d.code, this.fluid * 100, d.kind === 'locked');
    this.gun.update(dt, p, (inp.key('ShiftLeft') || inp.key('ShiftRight')) && p.speed > 5);

    // HUD
    const cur = p.mode === 'walk' && free ? this.interact.update(this.camera) : null;
    this.hud.setPrompt(cur ? (typeof cur.label === 'function' ? cur.label() : cur.label) : '');
    this.hud.setObjectives(this.story.objectives());
    this.hud.setDial(d.code, d.name, d.note);
    this.hud.setFluid(this.fluid);
    this.hud.setGunVisible(p.mode === 'walk');
    if (p.mode === 'ship') this.hud.setHint('<kbd>W</kbd>/<kbd>S</kbd> speed · <kbd>Mouse</kbd> steer · <kbd>Space</kbd>/<kbd>C</kbd> up/down · <kbd>Shift</kbd> boost' + (this.story.stage === 'free' ? ' · <kbd>E</kbd> get out' : ''));
    else if (p.mode === 'sit') this.hud.setHint('<kbd>A</kbd>/<kbd>D</kbd> change channel · <kbd>E</kbd> get up');
    else this.hud.setHint('<kbd>Click</kbd> portal · <kbd>Wheel</kbd> dial · <kbd>E</kbd> use · <kbd>R</kbd> close portals · <kbd>V</kbd> catchphrase');

    // ambience
    if (this.ambient?.params.chirp) {
      this._chirpT -= dt;
      if (this._chirpT <= 0) {
        this._chirpT = this.timeOfDay === 'night' ? 0.4 + Math.random() * 1.2 : 1.5 + Math.random() * 4;
        this.ambient.params.chirp();
      }
    }
    // autosave now and then
    this._saveT = (this._saveT || 0) + dt;
    if (this._saveT > 20) {
      this._saveT = 0;
      this.saveGame();
    }
  }

  _updateButter(dt) {
    // the dish slides over to Rick and back when the robot passes the butter
    const dish = this.house.anchors.butter;
    if (this._butterHome === undefined) this._butterHome = dish.position.x;
    if (this._butterSlide > 0) this._butterSlide = Math.max(0, this._butterSlide - dt * 0.7);
    dish.position.x = this._butterHome + Math.sin(Math.PI * (1 - (this._butterSlide || 0))) * (this._butterSlide > 0 ? 0.55 : 0);
  }

  drinkFlask() {
    if (this._flaskCD > this.t) return;
    this._flaskCD = this.t + 3;
    audio.gulp();
    setTimeout(() => audio.burp(1.2), 800);
    this.drunk = Math.min(1.5, this.drunk + 0.5);
    if (Math.random() < 0.35 && this.morty.mode === 'follow' && !this.dialogue.busy) {
      setTimeout(() => this.say([['morty', pick(["Rick, it's like nine in the morning!", 'Rick, maybe slow down on the flask?', 'Aw geez, Rick, not again.'])]]), 1500);
    }
  }
}

function boot() {
  try {
    const game = new Game();
    window.__game = game;
    // keep progress when the page reloads in place
    window.claude?.hot?.snapshot?.(() => ({ save: store.get(SAVE_KEY, null) }));
  } catch (err) {
    console.error(err);
    const el = document.getElementById('loading');
    el.hidden = false;
    el.textContent = "Couldn't start the game. Your browser needs WebGL 2.";
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

export { saveSettings };
