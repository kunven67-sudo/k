// Telling people to do things ("follow me", "stop", "go to the bakery", "dance").
// They understand the command, decide honestly whether they want to (based on
// who they are, how they feel and how you've treated them), say so, and if
// they agree they really do it. If they can't (in your hand, stuck on a roof,
// inside the terrarium) they tell you why.
import * as THREE from 'three';

const pick = (a) => a[(Math.random() * a.length) | 0];
const has = (t, re) => re.test(t);

const PLACES = ['bakery', 'pharmacy', 'hardware', 'pet shop', 'diner', 'bank', 'police', 'grocery', 'park', 'pond', 'fountain', 'home'];

// what you told them to do, or null if it isn't a command
export function parseCommand(text) {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ')} `;
  if (has(t, / (follow me|come with me|come along|walk with me|follow) /)) return { kind: 'follow' };
  if (has(t, / (come here|come over|over here|come to me|get over here) /)) return { kind: 'come' };
  if (has(t, / (stop|stay|wait|stand still|don't move|dont move|freeze|halt|stay here) /)) return { kind: 'stop' };
  if (has(t, / (go away|leave me alone|get lost|shoo|leave|run away|scram|get out) /)) return { kind: 'leave' };
  if (has(t, / (dance|dancing|bust a move) /)) return { kind: 'dance' };
  if (has(t, / (wave|say hi|wave at me) /)) return { kind: 'wave' };
  if (has(t, / (clap|applaud) /)) return { kind: 'clap' };
  if (has(t, / (cheer|celebrate|be happy) /)) return { kind: 'cheer' };
  if (has(t, / (laugh|lol|haha) /) && has(t, / (laugh) /)) return { kind: 'laugh' };
  if (has(t, / (sit|sit down) /)) return { kind: 'sit' };
  const go = t.match(/ (?:go|walk|run|head) (?:to|over to|back to)? ?(?:the |your )?([a-z ]+?) $/) || t.match(/ go (home) /);
  if (go) {
    const place = PLACES.find((p) => go[1].includes(p) || (p === 'home' && go[1].includes('house')));
    if (place) return { kind: 'goto', place };
  }
  return null;
}

// can they physically do it right now? (a reason if not)
function cannot(h, cmd) {
  const moving = ['follow', 'come', 'leave', 'goto'].includes(cmd.kind);
  if (h.state === 'held') return moving ? 'I can\'t, I\'m in your HAND!' : null;
  if (h.state === 'jar') return 'I\'m stuck in a JAR!';
  if (h.state === 'caged') return moving ? 'I can\'t get out of this glass box!' : null;
  if (h.state === 'stranded' && moving) return 'I can\'t, I\'m stuck up here! Get me down first.';
  if (h.state === 'village' && moving) return 'I\'d better stay in Wallton. It\'s not safe out there for someone my size.';
  if (['hurt', 'flying', 'dead', 'away'].includes(h.state)) return '...';
  if (moving && !h.agent) return 'I can\'t get there from here.';
  return null;
}

// do they want to? honest yes or no (with why)
export function decide(h, cmd, { player }) {
  const no = cannot(h, cmd);
  if (no) return { ok: false, text: no };
  const e = h.emotion, p = h.profile.personality || {};
  const m = h.memory ?? { kind: 0, mean: 0 };
  const youBig = player && player.scale > h.scale * 3;
  const harmless = ['wave', 'dance', 'clap', 'cheer', 'laugh', 'stop', 'sit'].includes(cmd.kind);
  if (h.isCop && h.copBusy) return { ok: false, text: 'Nice try. You\'re coming with me.' };
  if (h.isParent && !h.tiny && cmd.kind !== 'wave' && cmd.kind !== 'dance' && cmd.kind !== 'laugh') {
    return { ok: false, text: pick(['I\'m your parent, I don\'t take orders from you.', 'Excuse me? No.', 'Nice try, kiddo.']) };
  }
  let will = 0.25 + (p.friendliness ?? 0.5) * 0.5 + (m.kind ?? 0) * 0.1 - (m.mean ?? 0) * 0.25 - e.anger * 0.6 + (harmless ? 0.25 : 0) + (Math.random() - 0.5) * 0.25;
  // a giant telling you what to do: you do it (out of fear)
  const afraid = youBig && e.fear > 0.4;
  if (afraid) will += 0.6;
  if (cmd.kind === 'leave' && (e.fear > 0.5 || m.mean > 0)) will += 0.5; // happy to get away from you
  if (will < 0.45) {
    if (m.mean > 1) return { ok: false, text: pick(['No way. Not after what you did.', 'Why would I do anything for YOU?', 'Forget it.']) };
    if (e.anger > 0.5) return { ok: false, text: pick(['No! Leave me alone.', 'Not happening.']) };
    return { ok: false, text: pick(['Nah, I don\'t want to.', 'Hmm... no thanks.', 'I\'d rather not.', 'Maybe later.']) };
  }
  const yes = {
    follow: ['Okay, I\'ll follow you.', 'Lead the way!', 'Sure, where are we going?'],
    come: ['Coming!', 'On my way.', 'Okay, okay.'],
    stop: ['Okay, I\'ll wait here.', 'Alright, staying put.'],
    leave: ['Fine, I\'m going!', 'Gladly!', 'Okay, bye!'],
    dance: ['Haha, okay!', 'Watch this!', 'You asked for it!'],
    wave: ['Hi! *waves*', '*waves*'],
    clap: ['*clap clap clap*', 'Bravo!'],
    cheer: ['Woo-hoo!', 'Yay!'],
    laugh: ['Hahaha!', 'Haha, okay.'],
    sit: ['I\'ll just crouch here, there\'s no chair.', 'Okay.'],
    goto: [`Okay, I'll go to the ${cmd.place}.`, `Sure, heading to the ${cmd.place}.`],
  }[cmd.kind];
  return { ok: true, text: afraid ? pick(['O-okay! Please don\'t hurt me!', 'Y-yes! Right away!']) : pick(yes) };
}

const CLIPS = {
  dance: ['dancing_silly', 'dancing_neutral', 'dancing_cool', 'dancing_affective'],
  wave: ['wave_01', 'wave_02'],
  clap: ['claphands_01', 'claphands_02'],
  cheer: ['cheer_01', 'cheer_02', 'cheer_03'],
  laugh: ['gestic_laugh_loud', 'gestic_laugh_extreme'],
  sit: ['crouch_idle'],
};

// start doing it
export function startOrder(h, cmd, { player, places }) {
  h.order = null;
  if (CLIPS[cmd.kind]) {
    h.agent?.resetMoveTarget();
    if (h.state === 'walking') h.state = 'idle';
    h.timer = 6;
    h.character.play(pick(CLIPS[cmd.kind]));
    h.order = { kind: 'pause', t: 8, player };
    return;
  }
  h.order = { ...cmd, t: cmd.kind === 'follow' ? 300 : cmd.kind === 'stop' ? 45 : 90, player, places, think: 0 };
  if (cmd.kind === 'leave') {
    const f = player.feet, here = h.position;
    const q = h.nav.randomPoint((r) => Math.hypot(r.x - f.x, r.z - f.z) > Math.hypot(here.x - f.x, here.z - f.z) + 8 && Math.abs(r.y - here.y) < 0.6);
    if (q) h.goTo(q, { run: h.emotion.fear > 0.5 });
    h.order = null;
  }
  if (cmd.kind === 'stop') { h.agent?.resetMoveTarget(); h.state = 'idle'; }
}

// carry on doing it; true while the order is in charge (instead of their routine)
export function runOrder(h, dt) {
  const o = h.order;
  if (!o) return false;
  if (!['idle', 'walking'].includes(h.state) || h.tiny !== (o.wasTiny ?? h.tiny)) { h.order = null; return false; }
  o.wasTiny ??= h.tiny;
  o.t -= dt;
  const player = o.player;
  const f = player?.feet;
  const faceYou = () => { if (f) h.faceYaw = Math.atan2(f.x - h.position.x, f.z - h.position.z); };
  if (o.t <= 0) {
    if (o.kind === 'follow') h.speech?.say(h, pick(['Okay, I\'ve got things to do. Bye!', 'I\'m heading off now.']));
    h.order = null;
    return false;
  }
  if (o.kind === 'pause') return true; // doing the gesture
  if (o.kind === 'stop') {
    if (h.state === 'walking') { h.agent?.resetMoveTarget(); h.state = 'idle'; }
    faceYou();
    if (h.faceYaw !== undefined) { let d = h.faceYaw - h.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); h.yaw += d * (1 - Math.exp(-dt * 4)); }
    return true;
  }
  o.think -= dt;
  const d = f ? Math.hypot(f.x - h.position.x, f.z - h.position.z) : 0;
  if (o.kind === 'follow' || o.kind === 'come') {
    if (d > 60 || Math.abs(f.y - h.position.y) > 4) {
      h.speech?.say(h, 'You\'re too far away, I lost you!');
      h.order = null;
      return false;
    }
    // stay a little behind you (scaled to whoever's bigger)
    const keep = 1.3 * Math.max(h.scale, Math.min(player.scale, 3));
    if (d < keep) {
      if (h.state === 'walking') { h.agent?.resetMoveTarget(); h.state = 'idle'; }
      faceYou();
      if (o.kind === 'come') { h.order = { kind: 'stop', t: 20, player, think: 0 }; }
    } else if (o.think <= 0) {
      o.think = 0.5;
      const toMe = new THREE.Vector3(h.position.x - f.x, 0, h.position.z - f.z).normalize().multiplyScalar(keep * 0.8);
      h.goTo(f.clone().add(toMe), { run: d > 6 });
    }
    if (h.state === 'idle' && h.faceYaw !== undefined) { let a = h.faceYaw - h.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); h.yaw += a * (1 - Math.exp(-dt * 4)); }
    return true;
  }
  if (o.kind === 'goto') {
    if (!o.spot) {
      const P = o.places || [];
      const name = o.place;
      o.spot = name === 'home' ? (h.home || null)
        : P.find((s) => (s.name || '').toLowerCase() === name) || null;
      if (!o.spot) { h.speech?.say(h, 'Where is that, even?'); h.order = null; return false; }
      h.spot = o.spot;
      if (!h.goTo(o.spot.p)) { h.speech?.say(h, 'I can\'t get there from here.'); h.order = null; return false; }
    }
    // the everyday brain handles the walk and what they do on arrival
    if (h.state === 'idle') { h.order = null; return false; }
    return true;
  }
  h.order = null;
  return false;
}
