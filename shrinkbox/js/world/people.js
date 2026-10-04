// Tiny people. They live in a hidden village inside the bedroom wall (and you can spawn more).
// They act like real people: they notice you, get scared of giants, calm down if you're nice,
// talk (typed chat or your microphone), and you can gently pick them up, carry them and put
// them down. Real voices via the browser's speech engine (higher pitch for tiny people).
import * as THREE from 'three';
import { R, world, groups, G } from '../core/physics.js';
import { Mover } from '../player/mover.js';
import { rng } from '../core/noise.js';

const NAMES = ['Pip', 'Wren', 'Milo', 'Tansy', 'Bram', 'Juniper', 'Odo', 'Fern', 'Clove', 'Rook', 'Hazel', 'Tobin', 'Sorrel', 'Nim', 'Ivy', 'Barnaby', 'Poppy', 'Quill', 'Moss', 'Lark'];
const PERSONALITIES = ['friendly', 'shy', 'grumpy', 'curious', 'brave'];
const SKINS = ['#f3d2b8', '#e8b892', '#c68a64', '#a0663f', '#7a4a2a', '#4f2f1c'];
const HAIRS = ['#2b1d14', '#5a3a1e', '#a8743a', '#d9b26a', '#1a1a1a', '#8a8a8a', '#7a2a1a'];
const CLOTHES = ['#6b8f4e', '#8a5a3c', '#b5651d', '#4e6b8f', '#7a4f7a', '#a63d3d', '#c9b06b', '#3f5f5a'];

// ---------- a light-weight human model (few meshes, so dozens of people stay fast) ----------
const geoCache = {};
function g(key, make) { return geoCache[key] || (geoCache[key] = make()); }
function limbGeo(r0, r1, len) {
  const c = new THREE.CylinderGeometry(r1, r0, len, 10, 1); c.translate(0, -len / 2, 0);
  const a = new THREE.SphereGeometry(r0, 10, 6), b = new THREE.SphereGeometry(r1, 10, 6); b.translate(0, -len, 0);
  return mergeSimple([c, a, b]);
}
function mergeSimple(list) {
  const out = new THREE.BufferGeometry(), pos = [], nor = [];
  for (const geo of list) { const gg = geo.index ? geo.toNonIndexed() : geo; pos.push(...gg.attributes.position.array); nor.push(...gg.attributes.normal.array); }
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return out;
}
export class PersonModel {
  constructor(look) {
    const M = (c, r = 0.75) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
    const skin = M(look.skin, 0.6), top = M(look.top, 0.9), pants = M(look.pants, 0.9), hair = M(look.hair, 0.8), shoes = M(look.shoes, 0.6);
    this.root = new THREE.Group();
    const body = new THREE.Group(); this.root.add(body); this.body = body;
    const torsoGeo = g('torso', () => { const t = new THREE.CylinderGeometry(0.18, 0.15, 0.52, 14); t.scale(1, 1, 0.62); t.translate(0, 0.26, 0); const ch = new THREE.SphereGeometry(0.18, 14, 8); ch.scale(1, 0.5, 0.62); ch.translate(0, 0.52, 0); return mergeSimple([t, ch]); });
    const torso = new THREE.Mesh(torsoGeo, top); torso.position.y = 0.92; body.add(torso);
    const headGeo = g('head', () => { const h = new THREE.SphereGeometry(0.105, 18, 12); h.scale(1, 1.12, 1.05); const n = new THREE.CylinderGeometry(0.05, 0.055, 0.12, 10); n.translate(0, -0.13, 0); const nose = new THREE.ConeGeometry(0.016, 0.04, 6); nose.rotateX(Math.PI / 2.2); nose.translate(0, -0.005, 0.11); return mergeSimple([h, n, nose]); });
    const head = new THREE.Group(); head.position.y = 1.71; body.add(head); this.head = head;
    head.add(new THREE.Mesh(headGeo, skin));
    const eyesGeo = g('eyes', () => { const l = new THREE.SphereGeometry(0.014, 8, 6); l.translate(-0.037, 0.025, 0.095); const r = new THREE.SphereGeometry(0.014, 8, 6); r.translate(0.037, 0.025, 0.095); return mergeSimple([l, r]); });
    head.add(new THREE.Mesh(eyesGeo, M('#111', 0.2)));
    const hairGeo = g('hair' + look.hairStyle, () => {
      const cap = new THREE.SphereGeometry(0.113, 16, 10, 0, Math.PI * 2, 0, look.hairStyle === 'long' ? 1.75 : 1.4); cap.scale(1, 1.12, 1.08); cap.rotateX(-0.25); cap.translate(0, 0.012, 0);
      if (look.hairStyle === 'long') { const b = new THREE.CapsuleGeometry(0.09, 0.16, 4, 10); b.scale(1.15, 1, 0.6); b.translate(0, -0.1, -0.06); return mergeSimple([cap, b]); }
      return cap;
    });
    if (look.hairStyle !== 'bald') head.add(new THREE.Mesh(hairGeo, hair));
    const mouth = new THREE.Mesh(g('mouth', () => new THREE.BoxGeometry(0.03, 0.006, 0.01)), M('#7a3a34')); mouth.position.set(0, -0.05, 0.095); head.add(mouth); this.mouth = mouth;
    this.legs = []; this.arms = [];
    for (const sx of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(sx * 0.095, 0.93, 0); body.add(hip);
      hip.add(new THREE.Mesh(g('thigh', () => limbGeo(0.075, 0.058, 0.42)), pants));
      const knee = new THREE.Group(); knee.position.y = -0.42; hip.add(knee);
      knee.add(new THREE.Mesh(g('shin', () => limbGeo(0.056, 0.045, 0.4)), pants));
      const shoe = new THREE.Mesh(g('shoe', () => { const b = new THREE.BoxGeometry(0.1, 0.08, 0.26); b.translate(0, -0.44, 0.05); return b; }), shoes); knee.add(shoe);
      this.legs.push({ hip, knee });
      const sh = new THREE.Group(); sh.position.set(sx * 0.22, 1.45, 0); body.add(sh);
      sh.add(new THREE.Mesh(g('upper', () => limbGeo(0.055, 0.045, 0.29)), top));
      const el = new THREE.Group(); el.position.y = -0.29; sh.add(el);
      el.add(new THREE.Mesh(g('fore', () => limbGeo(0.044, 0.034, 0.25)), top));
      el.add(new THREE.Mesh(g('hand', () => { const b = new THREE.BoxGeometry(0.055, 0.09, 0.03); b.translate(0, -0.3, 0); return b; }), skin));
      sh.rotation.z = sx * 0.08;
      this.arms.push({ sh, el, sx });
    }
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.walk = 0;
  }
  animate(dt, speed, state, t) {
    this.walk += dt * Math.min(10, speed * 3.4);
    const sw = Math.min(1, speed / 1.2);
    const a = Math.sin(this.walk) * 0.6 * sw;
    const L = this.legs, A = this.arms;
    if (state === 'held') {
      // dangling + kicking in your hand
      L[0].hip.rotation.x = Math.sin(t * 7) * 0.4; L[1].hip.rotation.x = -Math.sin(t * 7) * 0.4;
      L[0].knee.rotation.x = 0.6; L[1].knee.rotation.x = 0.6;
      A[0].sh.rotation.z = -1.2 + Math.sin(t * 5) * 0.3; A[1].sh.rotation.z = 1.2 - Math.sin(t * 5) * 0.3;
      return;
    }
    L[0].hip.rotation.x = a; L[1].hip.rotation.x = -a;
    L[0].knee.rotation.x = Math.max(0, -Math.sin(this.walk + 1.2)) * 0.9 * sw; L[1].knee.rotation.x = Math.max(0, Math.sin(this.walk + 1.2)) * 0.9 * sw;
    A[0].sh.rotation.x = -a * 0.8; A[1].sh.rotation.x = a * 0.8;
    A[0].sh.rotation.z = -0.08; A[1].sh.rotation.z = 0.08;
    if (state === 'wave') { A[1].sh.rotation.z = 2.6; A[1].sh.rotation.x = 0; A[1].el.rotation.z = Math.sin(t * 8) * 0.5; }
    else A[1].el.rotation.z = 0;
    if (state === 'sit') { L[0].hip.rotation.x = -1.5; L[1].hip.rotation.x = -1.5; L[0].knee.rotation.x = 1.5; L[1].knee.rotation.x = 1.5; this.body.position.y = -0.45; A[0].sh.rotation.x = -0.4; A[1].sh.rotation.x = -0.4; }
    else if (state === 'cower') { L[0].knee.rotation.x = 1.6; L[1].knee.rotation.x = 1.6; L[0].hip.rotation.x = -1.4; L[1].hip.rotation.x = -1.4; this.body.position.y = -0.45; A[0].sh.rotation.x = -2.2; A[1].sh.rotation.x = -2.2; }
    else this.body.position.y = Math.abs(Math.cos(this.walk)) * 0.02 * sw;
  }
}

// ---------- dialogue: rule-based, personality + mood aware ----------
function pick(r, list) { return list[Math.floor(r() * list.length)]; }
export function reply(p, text, ctx) {
  const r = p.rand, t = text.toLowerCase().trim();
  const giant = ctx.ratio > 3, scared = p.fear > 0.55;
  const name = p.name;
  const has = (...w) => w.some((x) => new RegExp(`\\b${x}`).test(t));
  p.talked = (p.talked || 0) + 1;
  if (has('hi', 'hello', 'hey', 'yo', 'wsp', 'sup', 'howdy')) {
    if (scared) return pick(r, ['P-please don\'t hurt me!', '...h-hello? You\'re SO big.', 'Stay back! ...hi.']);
    return pick(r, [`Hi! I'm ${name}.`, `Oh! Hello there. Name's ${name}.`, p.personality === 'grumpy' ? `What do you want? ...I'm ${name}.` : `Hey hey! ${name}, nice to meet you!`]);
  }
  if (has('your name', 'who are you', 'whats your name', "what's your name")) return `I'm ${name}. ${p.personality === 'shy' ? '...that\'s all.' : 'I live in the wall village.'}`;
  if (has('sorry', "won't hurt", 'wont hurt', 'not going to hurt', 'friend', 'safe', 'calm')) { p.fear = Math.max(0, p.fear - 0.3); p.trust = Math.min(1, p.trust + 0.2); return scared ? pick(r, ['...you promise?', 'O-okay. I believe you. A little.']) : pick(r, ['Thanks. That helps.', 'Okay, friend.', 'Good. You seem nice.']); }
  if (has('how are you', 'you good', 'you ok', 'how r u')) return scared ? 'Honestly? Terrified. A giant is talking to me.' : pick(r, ['Pretty good! Found a whole cracker crumb today.', 'Tired. Hauling a pea up a ladder is hard work.', 'I\'m alright. The wall gets cold at night though.']);
  if (has('live', 'home', 'house', 'village', 'wall')) return pick(r, ['We live inside the wall. Between the studs. Nobody big ever looks in here.', 'The village is behind the baseboard. There\'s a little hole by the floor.', 'Our houses are made of matchboxes. Mine has a bottle-cap table!']);
  if (has('scared', 'afraid', 'fear')) return giant ? 'Wouldn\'t you be? You could step on me by accident!' : 'Not of you. You\'re our size! Spiders scare me though.';
  if (has('put me down', 'put you down', 'down')) return ctx.held ? 'YES please, gently!' : 'I\'m already on the ground...';
  if (has('follow', 'come with', 'come here')) { if (p.trust > 0.4 || !giant) { p.follow = true; return pick(r, ['Okay, lead the way!', 'Sure, I\'ll come.']); } return 'I don\'t know you well enough for that.'; }
  if (has('stop', 'stay', 'wait')) { p.follow = false; return 'Okay, I\'ll stay here.'; }
  if (has('food', 'hungry', 'eat')) return pick(r, ['A single crumb feeds me for a day. Sugar crystals are like candy boulders.', 'We collect crumbs from under the bed. Don\'t tell.', 'One grain of rice is like a whole loaf of bread for us.']);
  if (has('shrink', 'watch', 'tiny', 'small', 'big', 'grow')) return ctx.sameSize ? 'Wait... you were HUGE a minute ago. How did you do that?!' : pick(r, ['How did you get so big? Or... are we small?', 'You have a watch that changes size? That\'s impossible.', 'Can you make ME big for a day?']);
  if (has('spider', 'mite', 'bug', 'ant')) return pick(r, ['Dust mites are harmless, they can\'t even see. Spiders are the real monsters.', 'An ant carried my lunch away once. It was stronger than me!']);
  if (has('joke', 'funny')) return pick(r, ['Why don\'t tiny people play hide and seek? ...because we\'re ALWAYS hiding.', 'What do you call a giant who\'s nice? A big deal.']);
  if (has('love', 'cool', 'nice', 'awesome', 'cute')) { p.trust = Math.min(1, p.trust + 0.15); return pick(r, ['Aw, thanks!', 'You\'re not so bad yourself.', p.personality === 'grumpy' ? 'Hmph. ...thanks.' : 'That\'s really kind!']); }
  if (has('stupid', 'dumb', 'hate', 'ugly', 'shut up', 'loser')) { p.fear = Math.min(1, p.fear + 0.2); p.trust = Math.max(0, p.trust - 0.3); return p.personality === 'brave' ? 'Say that again, giant!' : pick(r, ['That\'s mean.', 'Rude.', '...why would you say that?']); }
  if (has('age', 'old are you')) return `I'm ${20 + Math.floor(r() * 40)}. That\'s old for us... just kidding, same as you.`;
  if (has('family', 'mom', 'dad', 'kids', 'brother', 'sister')) return pick(r, ['My sister lives two studs over.', 'My family has lived in this wall for three generations.', 'My kids think the outside is made of carpet. They\'re not wrong.']);
  if (t.endsWith('?')) return pick(r, ['Hmm, I don\'t know.', 'Good question!', 'No idea, honestly.', 'Ask the elder, she knows everything.']);
  return scared ? pick(r, ['...', 'Please just let me go home.', 'Uh huh.']) : pick(r, ['Huh. Interesting.', 'Okay!', 'Ha, really?', 'I see.', 'Tell me more.']);
}

// ---------- a person ----------
export class Person {
  constructor(game, o) {
    const r = rng(o.seed || Math.floor(Math.random() * 1e9));
    this.rand = r;
    this.game = game;
    this.name = o.name || pick(r, NAMES);
    this.personality = o.personality || pick(r, PERSONALITIES);
    this.look = o.look || { skin: pick(r, SKINS), hair: pick(r, HAIRS), hairStyle: pick(r, ['short', 'long', 'bald', 'short']), top: pick(r, CLOTHES), pants: pick(r, CLOTHES), shoes: '#3b2a1e' };
    this.height = o.height || 0.014; // 1.4 cm tall
    this.s = this.height / 1.75;
    this.fear = this.personality === 'brave' ? 0.1 : this.personality === 'shy' ? 0.5 : 0.25;
    this.trust = this.personality === 'friendly' ? 0.4 : 0.15;
    this.model = new PersonModel(this.look);
    this.model.root.scale.setScalar(this.s);
    game.engine.scene.add(this.model.root);
    this.feet = new THREE.Vector3(...o.pos);
    this.yaw = o.yaw || r() * 6.28;
    this.vel = new THREE.Vector3();
    this.state = 'idle'; this.stateT = 0;
    this.home = this.feet.clone();
    this.target = null;
    this.held = false;
    this.voicePitch = 1.4 + r() * 0.5;
    const half = this.height / 2, rad = 0.2 * this.s;
    this.body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(this.feet.x, this.feet.y + half, this.feet.z));
    this.collider = world.createCollider(R.ColliderDesc.cylinder(half, rad).setCollisionGroups(groups(G.CREATURE, G.PLAYER | G.PROP)), this.body);
    this.collider.person = this;
    this.mover = new Mover(this.collider, groups(G.CREATURE, G.WORLD | G.PROP));
    this.grounded = false;
  }

  say(text) {
    this.lastLine = text; this.sayT = 3 + text.length * 0.05;
    this.game.ui.bubble(this, text);
    this.game.speak?.(text, this);
  }

  update(dt) {
    const g = this.game, p = g.player, t = g.time;
    this.stateT -= dt;
    if (this.held) { this.model.animate(dt, 0, 'held', t); return; }
    if (g.elsewhere) { this.model.root.visible = false; return; } this.model.root.visible = true;
    // how do I see the player?
    const toP = p.feet.clone().sub(this.feet); const dist = toP.length();
    const ratio = p.height / this.height;
    const sees = dist < this.height * 40 + p.height * 1.5;
    if (sees && ratio > 3) this.fear = Math.min(1, this.fear + dt * (this.personality === 'brave' ? 0.02 : 0.08) * Math.min(3, ratio / 10) * (1 - this.trust));
    else this.fear = Math.max(0, this.fear - dt * 0.03);
    if (sees && !this.noticed) { this.noticed = true; if (ratio > 3) this.say(this.fear > 0.4 ? pick(this.rand, ['A GIANT!', 'Hide! A giant!', 'Whoa... don\'t step on me!']) : pick(this.rand, ['Oh! Hello, big one.', 'Uh... hi?'])); else this.say(pick(this.rand, ['Hey! Who are you?', 'Hi there! Never seen you in the village.', 'Oh, a new face!'])); }
    if (!sees) this.noticed = false;
    // decide what to do
    let speed = 0, face = null;
    if (this.fear > 0.6 && ratio > 3 && dist < this.height * 25) {
      this.state = this.fear > 0.85 ? 'cower' : 'flee';
      if (this.state === 'flee') { const away = toP.clone().multiplyScalar(-1).setY(0).normalize(); this.target = this.feet.clone().addScaledVector(away, this.height * 4); speed = 1.7; }
    } else if (this.follow && dist > p.height * 1.5) {
      this.state = 'walk'; this.target = p.feet.clone(); speed = dist > p.height * 4 ? 1.6 : 1.0;
    } else if (this.talking > 0 || (sees && dist < Math.max(p.height, this.height) * 6)) {
      this.state = this.wave > 0 ? 'wave' : 'idle'; face = toP;
    } else if (this.stateT <= 0) {
      this.stateT = 2 + this.rand() * 5;
      if (this.rand() < 0.5) { this.state = 'walk'; const a = this.rand() * 6.28, d = this.height * (2 + this.rand() * 6); this.target = this.home.clone().add(new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d)); }
      else { this.state = 'idle'; this.target = null; }
    }
    this.talking = Math.max(0, (this.talking || 0) - dt);
    this.wave = Math.max(0, (this.wave || 0) - dt);
    if ((this.state === 'walk' || this.state === 'flee') && this.target) {
      const d = this.target.clone().sub(this.feet).setY(0);
      if (d.length() < this.height * 0.4) { this.state = 'idle'; this.target = null; }
      else { face = d; speed = speed || 1; }
    }
    if (face) { const want = Math.atan2(face.x, face.z); let dy = want - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw += dy * Math.min(1, dt * 6); }
    const v = speed * this.s * 1.4;
    this.vel.x = Math.sin(this.yaw) * v; this.vel.z = Math.cos(this.yaw) * v;
    this.vel.y = this.grounded ? 0 : this.vel.y - 9.81 * this.s * dt;
    const res = this.mover.move(this.feet, this.vel.clone().multiplyScalar(dt), { r: 0.2 * this.s, h: this.height, grounded: this.grounded, snap: this.grounded, stepH: 0.25 * this.height, maxSlopeCos: 0.6 });
    this.grounded = res.grounded;
    if (this.feet.y < -5) this.feet.copy(this.home);
    this.body.setNextKinematicTranslation({ x: this.feet.x, y: this.feet.y + this.height / 2, z: this.feet.z });
    this.model.root.position.copy(this.feet);
    this.model.root.rotation.y = this.yaw;
    this.model.animate(dt, speed, this.state, t);
    // mouth moves while talking
    this.sayT = Math.max(0, (this.sayT || 0) - dt);
    this.model.mouth.scale.y = this.sayT > 0 ? 1 + Math.abs(Math.sin(t * 18)) * 3 : 1;
  }

  // the shrinker works on people too
  setHeight(h) {
    this.height = h; this.s = h / 1.75;
    this.model.root.scale.setScalar(this.s);
    const groupsBits = this.collider.collisionGroups();
    world.removeCollider(this.collider, false);
    this.collider = world.createCollider(R.ColliderDesc.cylinder(h / 2, 0.2 * this.s).setCollisionGroups(groupsBits), this.body);
    this.collider.person = this;
    this.mover.self = this.collider;
    this.noticed = false;
  }

  // picked up by the player
  pickUp() {
    this.held = true; this.follow = false;
    this.collider.setEnabled(false);
    const ratio = this.game.player.height / this.height;
    this.fear = Math.min(1, this.fear + (this.trust > 0.5 ? 0.05 : 0.35));
    this.say(this.trust > 0.5 ? pick(this.rand, ['Whoa! Okay, okay, I trust you!', 'Wheee! This is so high up!']) : this.personality === 'brave' ? 'Hey! Put me down, you overgrown kid!' : pick(this.rand, ['AAAH! Put me down!', 'Please don\'t drop me!', `I'm ${Math.round(ratio)} times smaller than you, be careful!`]));
  }
  setDown(pos) {
    this.held = false; this.collider.setEnabled(true);
    this.feet.copy(pos); this.vel.set(0, 0, 0); this.grounded = false;
    this.fear = Math.max(0, this.fear - 0.15); this.trust = Math.min(1, this.trust + 0.1);
    this.say(pick(this.rand, ['Phew. Thank you.', 'Solid ground!', 'That was... actually kind of fun.', 'Thanks for being gentle.']));
  }
  remove() { this.game.engine.scene.remove(this.model.root); world.removeRigidBody(this.body); }
}
