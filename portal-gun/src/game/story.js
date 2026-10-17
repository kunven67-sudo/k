// Part 1: the night Rick drags Morty out of bed, and the morning after.
import * as THREE from '../three.js';
import { audio } from '../core/audio.js';
import { music } from '../core/music.js';
import { pick } from '../util.js';

export const MISSIONS = [
  { id: 'butter', text: 'Pass the butter (talk to the Butter Robot in the kitchen)' },
  { id: 'refill', text: 'Refill your portal gun at the workbench in the garage' },
  { id: 'portal', text: 'Shoot two portals and walk through one' },
  { id: 'tv', text: 'Watch Interdimensional Cable (sit on the couch)' },
  { id: 'poopy', text: 'Say hi to Mr. Poopybutthole in the front yard' },
  { id: 'fly', text: 'Take the Space Cruiser for a spin' },
];

export class Story {
  constructor(game) {
    this.game = game;
    this.stage = 'title';
    this.step = null;
    this.done = new Set();
    this.secretBoob = false;
    this.flightTimer = 0;
    this.rantStarted = false;
    this.partDone = false;
  }

  save() {
    return { stage: this.stage === 'intro' ? 'intro' : 'free', done: [...this.done], boob: this.secretBoob, partDone: this.partDone };
  }

  load(data) {
    this.done = new Set(data?.done || []);
    this.secretBoob = !!data?.boob;
    this.partDone = !!data?.partDone;
  }

  objectives() {
    const g = this.game;
    if (this.stage === 'intro') {
      const map = {
        wake: 'Wake up Morty (his room is the door next to you)',
        garage: 'Drag Morty to the garage (downstairs, through the kitchen)',
        ship: 'Get in the Space Cruiser',
        fly: 'Fly out of the garage (W to go, mouse to steer)',
        rant: 'Keep flying',
      };
      return this.step && map[this.step] ? [{ text: map[this.step] }] : [];
    }
    if (this.stage === 'free') {
      const list = MISSIONS.map((m) => ({ text: m.text, done: this.done.has(m.id) }));
      if (this.secretBoob) list.push({ text: 'Secret: tried to go to Boob World', done: true, secret: true });
      if (g.cutscene) return [];
      return list;
    }
    return [];
  }

  complete(id) {
    if (this.stage !== 'free' || this.done.has(id)) return;
    this.done.add(id);
    const m = MISSIONS.find((x) => x.id === id);
    if (m) {
      audio.objective();
      this.game.hud.toast(`Mission done: ${m.text.split(' (')[0]}`);
    }
    this.game.saveGame();
    if (!this.partDone && MISSIONS.every((x) => this.done.has(x.id))) {
      this.partDone = true;
      setTimeout(() => this.finishPart(), 2500);
    }
  }

  async finishPart() {
    const g = this.game;
    g.hud.showCard('Part 1 complete!', 'More dimensions are coming in Part 2. Keep messing around until then.', 6);
    audio.objective();
    await g.say([
      ['rick', "Not bad. Not bad at all. *burp* You're almost as good at being me as I am."],
      ['morty', 'W-wait, Rick, so what now?'],
      ['rick', 'Now? Now we wait for the next part, Morty. The dial will open up. Infinite dimensions, Morty. Infinite!'],
    ]);
    g.saveGame();
  }

  // ---------------------------------------------------------------- the intro
  async startIntro() {
    const g = this.game;
    this.stage = 'intro';
    this.step = 'wake';
    g.cutscene = true;
    g.setTime('night');
    music.play('night');
    g.house.garage.set(false);
    g.house.garage.t = 0;
    g.house.mortyDoor.set(false, true);
    g.house.mortyDoor.t = 0;
    g.fluid = 1;
    g.cruiser.place(g.spots.shipHome, Math.PI);
    g.placeFamily('night');
    g.player.mode = 'walk';
    g.player.teleport(g.house.spawn.intro.pos, g.house.spawn.intro.yaw);
    g.player.pitch = -0.05;
    g.portals.clearAll(true);
    await g.hud.fade(1, 0.01);
    g.hud.showCard('Late at night…', 'The Smith house', 3);
    await sleep(2400);
    g.hud.fade(0, 1.5);
    g.cutscene = false;
    await sleep(600);
    await g.say([['rick', "*burp* Okay. Okay okay okay. Time to get the kid."]]);
  }

  async wakeMorty() {
    const g = this.game;
    if (this.step !== 'wake') return;
    this.step = 'waking';
    g.cutscene = true;
    g.mortySleep.setAwake(true);
    await g.say([
      ['rick', 'Morty! Morty, wake up! Come on, get up. You gotta come with me, Morty!'],
      ['morty', "R-Rick? What's going on? It's, like, the middle of the night!"],
      ['rick', 'I got a *burp* surprise for you, Morty. Come on, come on, move it!'],
      ['morty', 'Aw geez... okay, okay, I-I-I\'m coming!'],
    ]);
    g.mortySleep.hide();
    const m = g.morty;
    m.setVisible(true);
    m.setSit(false);
    m.placeAt(g.spots.mortyWake, -Math.PI / 2);
    m.mode = 'follow';
    m.trail.length = 0;
    this.step = 'garage';
    g.cutscene = false;
    g.saveGame();
  }

  async enterGarage() {
    const g = this.game;
    if (this.step !== 'garage') return;
    this.step = 'ship';
    await g.say([
      ['morty', 'Rick, w-why are we in the garage? I have a math test tomorrow!'],
      ['rick', 'Forget the test, Morty. Get in the ship.'],
    ]);
  }

  async boarded() {
    const g = this.game;
    if (this.step === 'ship') {
      this.step = 'fly';
      this.flightTimer = 0;
      music.play('flight');
      g.house.garage.set(true);
    }
  }

  async rant() {
    const g = this.game;
    this.step = 'rant';
    this.rantStarted = true;
    await g.say([
      ['rick', 'Morty, I built a *burp* neutrino bomb, Morty. It\'s in the back.'],
      ['morty', 'A WHAT?! Rick, why do you have a bomb?!'],
      ['rick', "I'm gonna drop it, Morty. Wipe the slate clean. Start the whole {fucking} planet over."],
      ['morty', "Rick, that's insane! There's people down there! Mom and Dad are down there!"],
      ['rick', 'Exactly! A fresh start, Morty! Just me, you, and your sister. A whole new human race!'],
      ['morty', "Summer?! Oh my god, Rick, that's so gross! No! No way!"],
      ['rick', '...Yeah, okay. You passed. It was a test, Morty. *burp* I\'m kidding. Mostly.'],
      ['morty', "Oh geez... I think I'm gonna throw up."],
      ['rick', "Don't puke in my ship, Morty. We're going home."],
    ]);
    await this.toMorning();
  }

  async toMorning() {
    const g = this.game;
    g.cutscene = true;
    await g.hud.fade(1, 1.2);
    g.leaveShip(true);
    g.cruiser.place(g.spots.shipHome, Math.PI);
    g.house.garage.set(false);
    g.house.garage.t = 0;
    g.setTime('day');
    music.play('house');
    this.stage = 'free';
    this.step = null;
    g.fluid = 0.25;
    g.placeFamily('breakfast');
    g.player.mode = 'walk';
    g.player.teleport(g.house.spawn.kitchen.pos, g.house.spawn.kitchen.yaw);
    g.player.pitch = -0.12;
    g.portals.clearAll(true);
    g.hud.showCard('The next morning…', '', 2.6);
    g.saveGame();
    await sleep(2200);
    g.hud.fade(0, 1.2);
    await sleep(800);
    await g.say([
      ['jerry', 'Morty, you look exhausted. Did your grandfather drag you out again last night?'],
      ['morty', 'N-no, Dad. I was just... up... studying.'],
      ['beth', "Jerry, leave him alone. Dad's spending quality time with his grandson."],
      ['jerry', 'Quality time? Beth, he is failing math!'],
      ['summer', 'Ugh. Can you guys fight quieter? I am trying to post.'],
      ['rick', "Jerry, Morty's getting a *burp* real science education. Way better than the garbage they teach at that school."],
    ]);
    await g.hud.fade(1, 0.35);
    g.placeFamily('day');
    g.cutscene = false;
    g.hud.fade(0, 0.5);
    g.hud.toast('Part 1 missions unlocked. Do them in any order!', false, 4);
  }

  // ---------------------------------------------------------------- per frame
  update(dt) {
    const g = this.game;
    if (this.stage !== 'intro') return;
    if (this.step === 'garage' && g.player.body.pos.x < -5.3 && g.player.body.pos.y < 1) this.enterGarage();
    if (this.step === 'fly' && g.player.mode === 'ship') {
      this.flightTimer += dt;
      const outside = g.cruiser.pos.z > 5 || g.cruiser.altitude() > 6;
      if ((outside && g.cruiser.altitude() > 5) || this.flightTimer > 45) {
        if (!this.rantStarted) this.rant();
      }
    }
  }

  // ---------------------------------------------------------------- gags
  async boobWorld() {
    const g = this.game;
    const first = !this.secretBoob;
    this.secretBoob = true;
    g.hud.toast('BOOB WORLD: TRIP CANCELLED', true, 3);
    const lines = pick([
      [['rick', "Eh, change of plans. Boob World's cancelled."], ['morty', 'Aw, come on, Rick! Every time!']],
      [['rick', 'Boob World? Nah. I just remembered I have... a thing.'], ['morty', 'You ALWAYS have a thing!']],
      [['rick', "We're not going to Boob World, Morty. *burp* Something came up."], ['morty', 'Something always comes up!']],
    ]);
    if (first) audio.objective();
    g.saveGame();
    await g.say(lines);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export { THREE };
