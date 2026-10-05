// What people say: speech bubbles over their heads, and the lines they pick for
// what's happening to them (picked up, shaken, thrown, shrunk, a giant nearby...).
// Who they are changes how they say it: brave and hot-headed people shout back,
// shy ones beg, curious ones ask questions.
import * as THREE from 'three';

const pick = (a) => a[(Math.random() * a.length) | 0];

// moods: angry (temper/bravery high), scared (bravery low), curious, friendly
const LINES = {
  pickedUp: {
    scared: ['AAAH! Put me down!', 'No no no no...', 'Please don\'t hurt me!', 'Help! HELP!', 'Where are you taking me?!'],
    angry: ['Hey! Let go of me!', 'Put me down right now!', 'Get your huge hands off me!', 'You can\'t just grab people!'],
    curious: ['Whoa... it\'s so high up here', 'What are you going to do with me?', 'Is this real?!', 'You\'re... enormous'],
    friendly: ['Okay okay, easy... gently, please', 'Hi... um, could you put me down?', 'Please be careful with me'],
  },
  held: {
    scared: ['I don\'t want to fall...', 'Please, I have a family!', 'I\'ll do anything, just let me go', '*sobbing*'],
    angry: ['When I get down from here...!', 'This is kidnapping!', 'Somebody call the police!', 'Let. Me. GO.'],
    curious: ['How did you get so big?', 'Your hand is warm', 'I can see the whole street from here', 'What is that watch on your wrist?'],
    friendly: ['So... nice weather today?', 'You\'re not so scary, are you?', 'Can I get down now please?'],
  },
  shaken: ['STOP SHAKING ME!', 'I\'m gonna throw up...', 'Aaaaaah!', 'Stop it! STOP!', 'My head...'],
  thrown: ['AAAAAAAH!', 'NOOOOO!', 'WHYYYY!', 'Aaaaaaaa—'],
  landed: ['Ow... ow...', 'I think I broke something', 'You MONSTER!', 'Ugh... my back', '*groans*'],
  putDown: {
    scared: ['*runs away*', 'Thank you thank you thank you!', 'Get away from me!'],
    angry: ['Don\'t ever do that again!', 'You\'re a psycho!', 'I\'m telling everyone about you!'],
    curious: ['That was... actually kind of amazing', 'Can we do that again? No. Wait. No.'],
    friendly: ['Thanks for putting me down gently', 'Phew. Okay. Bye!'],
  },
  shrunk: ['What did you DO to me?!', 'Why is everything so big?!', 'Make me normal again!', 'My clothes shrank too...?', 'This can\'t be happening'],
  jar: ['Let me out!', 'I can\'t breathe in here!', 'HELP!', 'Open the lid!', 'Please... let me out'],
  giantSeen: ['Is that... a giant?!', 'RUN!', 'Oh my god, look at the size of that!', 'Everybody run!', 'Mommy!'],
  stomped: ['NO—', 'Watch your feet!', 'AAH!'],
  greet: ['Hi!', 'Hey there', 'Hello!', 'Morning!', 'Oh, hi'],
};

export function moodOf(h) {
  const p = h.profile?.personality || {};
  const e = h.emotion || {};
  if ((p.temper ?? 0.5) > 0.65 || e.anger > 0.5) return 'angry';
  if ((p.bravery ?? 0.5) < 0.35 || e.fear > 0.85) return 'scared';
  if ((p.curiosity ?? 0.5) > 0.6) return 'curious';
  if ((p.friendliness ?? 0.5) > 0.5) return 'friendly';
  return 'scared';
}

// a line for a situation, fitting this person
export function lineFor(h, situation) {
  const set = LINES[situation];
  if (!set) return null;
  if (Array.isArray(set)) return pick(set);
  return pick(set[moodOf(h)] || set.scared);
}

// Speech bubbles: HTML boxes that follow people's heads on screen.
export class Speech {
  constructor({ camera, root = document.body }) {
    this.camera = camera;
    this.layer = document.createElement('div');
    this.layer.id = 'bubbles';
    root.appendChild(this.layer);
    this.list = new Map(); // human -> { el, t }
    this.log = [];         // recent lines (tests, and the phone's chat later)
  }

  // h says text for `secs` seconds (replaces what they were saying)
  say(h, text, { secs = 3.5, shout = false } = {}) {
    if (!h || !text || h.dead) return;
    let b = this.list.get(h);
    if (!b) {
      const el = document.createElement('div');
      el.className = 'bubble';
      this.layer.appendChild(el);
      b = { el };
      this.list.set(h, b);
    }
    b.t = secs;
    b.el.textContent = text;
    b.el.classList.toggle('shout', shout || /!{1}$|[A-Z]{4,}/.test(text));
    this.log.push({ who: h.profile?.name, text });
    if (this.log.length > 50) this.log.shift();
    h.lastSaid = performance.now();
  }

  // say a fitting line, unless they just said something (cooldown in seconds)
  react(h, situation, { cooldown = 0, ...opt } = {}) {
    if (cooldown && h.lastSaid && performance.now() - h.lastSaid < cooldown * 1000) return;
    const line = lineFor(h, situation);
    if (line) this.say(h, line, opt);
  }

  update(dt) {
    const cam = this.camera;
    const w = innerWidth, hgt = innerHeight;
    const v = new THREE.Vector3();
    for (const [h, b] of this.list) {
      b.t -= dt;
      if (b.t <= 0 || h.dead || !h.alive) { b.el.remove(); this.list.delete(h); continue; }
      const head = h.character?.bones?.Bip01_Head;
      const s = h.character?.root?.getWorldScale(v).x ?? 1;
      if (head) head.getWorldPosition(v); else h.character.root.getWorldPosition(v);
      v.y += 0.28 * s;
      const dist = v.distanceTo(cam.position);
      // too far to hear them (a whisper from a 9 cm person carries a few meters)
      const hear = Math.max(3, 40 * s);
      v.project(cam);
      const show = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 && dist < hear;
      b.el.hidden = !show;
      if (!show) continue;
      b.el.style.transform = `translate(${((v.x + 1) / 2 * w).toFixed(0)}px, ${((1 - v.y) / 2 * hgt).toFixed(0)}px) translate(-50%, -100%)`;
      b.el.style.opacity = String(Math.min(1, b.t * 2));
    }
  }
}
