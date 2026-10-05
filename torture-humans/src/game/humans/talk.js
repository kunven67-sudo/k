// Talking to people: T or Enter opens a chat box, you type, and whoever you're
// looking at (or holding) answers. Answers come from what you said (greeting,
// threat, compliment, question...), who they are and how they feel right now,
// and they remember how you treated them.
import * as THREE from 'three';

const pick = (a) => a[(Math.random() * a.length) | 0];
const has = (t, re) => re.test(t);

const TALK_ANIMS = { angry: ['gestic_talk_angry_01', 'gestic_talk_angry_02'], scared: ['gestic_talk_nervous_01', 'gestic_talk_nervous_02'], happy: ['gestic_talk_excited_01', 'gestic_talk_relaxed_01'], neutral: ['gestic_talk_neutral_01', 'gestic_talk_neutral_02', 'gestic_talk_neutral_03'] };

// what kind of thing you said
export function intentOf(text) {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9' ]/g, ' ')} `;
  if (has(t, / (kill|squish|crush|stomp|eat you|die|hurt|smash|step on|throw you|drop you|burn|lava) /)) return 'threat';
  if (has(t, / (sorry|apologi[sz]e|my bad|forgive) /)) return 'sorry';
  if (has(t, / (stupid|idiot|ugly|dumb|loser|shut up|hate you|weak|pathetic|worthless) /)) return 'insult';
  if (has(t, / (cute|nice|like you|love|beautiful|cool|awesome|friend|pretty|handsome|good job|thank) /)) return 'compliment';
  if (has(t, / (let you go|free you|set you free|release|put you down|unshrink|make you big|grow you) /)) return 'freedom';
  if (has(t, / (how are you|you ok|are you okay|how do you feel|feeling|how's it going|hows it going) /)) return 'how';
  if (has(t, / (name|who are you|who r u) /)) return 'name';
  if (has(t, / (job|work|do for a living) /)) return 'job';
  if (has(t, / (hungry|food|eat|thirsty|water|drink) /)) return 'needs';
  if (has(t, / (big|small|tiny|giant|shrink|huge|size|little) /)) return 'size';
  if (has(t, / (where|what is this place|town|street|lab|house) /)) return 'place';
  if (has(t, / (hi|hello|hey|yo|sup|morning|evening|greetings|hiya) /)) return 'greet';
  if (has(t, / (bye|goodbye|see you|later|cya) /)) return 'bye';
  if (has(t, / (yes|yeah|yep|sure|ok|okay) /)) return 'yes';
  if (has(t, / (no|nope|nah|never) /)) return 'no';
  if (t.trim().endsWith('?') || has(t, / (why|what|how|when|who) /)) return 'question';
  return 'other';
}

function memory(h) {
  h.memory ??= { met: false, kind: 0, mean: 0, last: '' };
  return h.memory;
}

// their answer (and how it changes them)
export function replyTo(h, text, { player, colony } = {}) {
  const e = h.emotion;
  const p = h.profile.personality;
  const m = memory(h);
  const intent = intentOf(text);
  const scared = e.fear > 0.6;
  const angry = e.anger > 0.5 || (p.temper > 0.7 && m.mean > 1);
  const tiny = h.tiny || h.scale < 0.5;
  const youBig = player && player.scale > h.scale * 3;
  const held = h.state === 'held';
  const name = h.profile.name.split(' ')[0];
  const res = (() => {
    if (h.isParent && !tiny && !held) {
      const mom = h.role === 'mom';
      const p2 = {
        greet: [mom ? 'Hi sweetie!' : 'Hey, kiddo.', 'Hi honey. Did you do your chores?'],
        how: ['Busy day. How was yours?', mom ? 'Tired, but fine. Did you eat?' : 'Work was long. Fine though.'],
        needs: ['There\'s food in the kitchen.', 'Dinner\'s at six.'],
        place: ['It\'s our house, silly.', 'Why were you in the basement so long?'],
        job: [mom ? 'I\'m a nurse, you know that.' : 'Accounting. Numbers all day.'],
        name: ['It\'s Mom!', 'Very funny.'],
        size: ['Size? Are you feeling okay?', 'What\'s that watch you keep fiddling with?'],
        threat: ['Excuse me?! Go to your room!', 'Don\'t you talk to me like that!'],
        insult: ['Watch your mouth!', 'One more word and there\'s no allowance.'],
        compliment: ['Aww, love you too!', 'Okay, what do you want?'],
        sorry: ['Thank you for saying that.', 'Apology accepted.'],
      }[intent];
      if (p2) return pick(p2);
    }
    switch (intent) {
      case 'threat':
        m.mean += 1;
        e.fear = Math.min(1, e.fear + 0.35);
        if (p.bravery > 0.7 && !held) { e.anger = Math.min(1, e.anger + 0.3); return pick(['Try it and see what happens!', 'You don\'t scare me!', 'I\'m not afraid of you!']); }
        return pick(['No! Please! I\'ll do anything!', 'Please don\'t... please...', 'Why would you do that?!', '*shaking* please no', 'I have a family!']);
      case 'insult':
        m.mean += 0.5;
        e.anger = Math.min(1, e.anger + 0.25 + p.temper * 0.2);
        e.sadness = Math.min(1, e.sadness + 0.15);
        return p.temper > 0.55 ? pick(['Look who\'s talking!', 'Says the weirdo with a shrink ray', 'Shut up yourself!', 'Wow. Real mature.']) : pick(['...that\'s mean', 'Why are you like this?', '*looks down*', 'Okay...']);
      case 'compliment':
        m.kind += 1;
        e.joy = Math.min(1, e.joy + 0.25);
        e.anger = Math.max(0, e.anger - 0.15);
        if (scared || m.mean > 2) return pick(['...is that supposed to make me feel better?', 'Uh. Thanks. Can I go now?', 'You\'re being nice now?']);
        return pick(['Aw, thanks!', 'That\'s sweet of you', 'Haha, thank you!', 'You\'re not so bad yourself']);
      case 'sorry':
        m.mean = Math.max(0, m.mean - 0.7);
        e.anger = Math.max(0, e.anger - 0.2 * (0.5 + p.friendliness));
        return p.friendliness > 0.5 ? pick(['It\'s okay... just don\'t do it again', 'Apology accepted. I think.', 'Fine. Thanks for saying it.']) : pick(['Sorry doesn\'t fix this!', 'Yeah, you should be sorry', 'Hmph.']);
      case 'freedom':
        e.joy = Math.min(1, e.joy + 0.2);
        return tiny ? pick(['Really?! Please! Make me normal again!', 'You mean it? Please let me go!', 'I\'ll believe it when I see it']) : pick(['I\'m not the one in trouble here...', 'Free from what?']);
      case 'how':
        if (held) return scared ? 'How do you THINK I feel? I\'m in your HAND!' : 'Honestly? A bit dizzy up here.';
        if (scared) return pick(['Terrified. Obviously.', 'I\'ve been better...', 'Scared out of my mind!']);
        if (angry) return pick(['Angry. Thanks to you.', 'How do you think?!']);
        if (colony?.residents?.get(h)) {
          const r = colony.residents.get(h);
          if (r.thirst < 40) return 'So thirsty... is there any clean water?';
          if (r.hunger < 40) return 'I\'m starving. Could you drop some food in?';
          return pick(['Surviving. We\'re building a camp!', 'Not bad, considering I live in a fish tank']);
        }
        return pick(['I\'m good, thanks!', 'Pretty good! You?', 'Can\'t complain', 'Fine, fine']);
      case 'name':
        m.met = true;
        return scared ? `${name}... please just let me go` : pick([`I'm ${name}.`, `${name}. Nice to meet you... I guess`, `It's ${name}. And you are?`]);
      case 'job': {
        const job = h.profile.job && h.profile.job !== 'none' ? h.profile.job : 'nothing much';
        if (tiny) return `I WAS a ${job}. Now I'm ${Math.round(h.scale * 180)} centimeters tall!`;
        return pick([`I'm a ${job}.`, `${job[0].toUpperCase()}${job.slice(1)}. It pays the bills.`]);
      }
      case 'needs':
        if (colony?.residents?.get(h)) {
          const r = colony.residents.get(h);
          return r.hunger < 50 ? 'Yes! Food! Please drop some crumbs!' : r.thirst < 50 ? 'Water... the pond is so far' : 'We\'re okay for now. Seeds would help us farm.';
        }
        return pick(['I could eat', 'I just had lunch', 'Are you offering?']);
      case 'size':
        if (tiny) return pick(['You SHRANK me! With that ray gun thing!', 'Everything is huge! A crumb is like a loaf of bread!', 'Make me big again! Please!']);
        if (youBig) return pick(['You\'re ENORMOUS!', 'How are you that big?!', 'Please watch where you step!']);
        return pick(['Size? What about it?', 'Normal size, last I checked']);
      case 'place':
        if (h.state === 'caged') return 'We\'re in a glass box. In someone\'s BASEMENT.';
        return pick(['This is our street. Quiet, usually.', 'Just around town. The shops are down the road.', 'You live in that house, don\'t you? What do you DO down there?']);
      case 'greet':
        m.met = true;
        if (scared) return pick(['H-hi...', '*nervous* hello', 'Please don\'t hurt me']);
        if (angry) return pick(['Oh. It\'s you.', 'What do you want?']);
        return pick(['Hi!', 'Hello there!', `Hey! I'm ${name}.`, 'Oh, hi!']);
      case 'bye':
        return scared ? 'Yes! Bye! Go!' : pick(['Bye!', 'See you around', 'Take care']);
      case 'yes': return pick(['Okay...', 'Right.', 'Good.']);
      case 'no': return pick(['No?', 'Why not?', 'Hmm.']);
      case 'question':
        return pick(['I don\'t know...', 'Why are you asking me?', 'Good question', 'Hmm, no idea']);
      default:
        return scared ? pick(['W-what?', 'I don\'t understand!', 'Please...']) : pick(['Huh?', 'Okay?', 'What do you mean?', 'Sure...']);
    }
  })();
  m.last = text;
  return { text: res, intent, mood: angry ? 'angry' : scared ? 'scared' : e.joy > 0.5 ? 'happy' : 'neutral' };
}

export class Talk {
  constructor({ input, camera, humans, speech, player, colony = null, getHeld = () => null, canvas = null }) {
    Object.assign(this, { input, camera, humans, speech, player, colony, getHeld, canvas });
    this.box = document.getElementById('chatbox');
    this.field = document.getElementById('chatin');
    this.logEl = document.getElementById('chatlog');
    this.open = false;
    this.pending = [];
    this.field?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.send(this.field.value); this.close(); }
      else if (e.key === 'Escape') { e.preventDefault(); this.close(); }
      e.stopPropagation();
    });
  }

  show() {
    if (!this.box || this.open) return;
    this.open = true;
    this.input.enabled = false;
    this.input.clear();
    this.box.hidden = false;
    this.field.value = '';
    document.exitPointerLock?.();
    setTimeout(() => this.field.focus(), 0);
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.input.enabled = true;
    this.box.hidden = true;
    this.field.blur();
    this.canvas?.requestPointerLock?.()?.catch?.(() => {});
  }

  // who hears you: the one in your hand, else whoever is closest to the middle of your view
  listener() {
    const held = this.getHeld();
    if (held) return held;
    const eye = this.camera.position;
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    let best = null, bestScore = Infinity;
    const v = new THREE.Vector3();
    for (const h of this.humans) {
      if (h.dead || !h.alive || h.state === 'flying' || h.state === 'away') continue;
      const head = h.character.bones.Bip01_Head;
      (head || h.character.root).getWorldPosition(v);
      const to = v.clone().sub(eye);
      const d = to.length();
      const s = Math.max(h.scale, this.player.scale);
      if (d > 8 * s + 1) continue;
      const ang = Math.acos(THREE.MathUtils.clamp(to.normalize().dot(dir), -1, 1));
      if (ang > 0.45) continue;
      const score = ang + d / (8 * s + 1) * 0.3;
      if (score < bestScore) { best = h; bestScore = score; }
    }
    return best;
  }

  addLog(who, text) {
    if (!this.logEl) return;
    const row = document.createElement('div');
    row.innerHTML = `<b></b> <span></span>`;
    row.querySelector('b').textContent = `${who}:`;
    row.querySelector('span').textContent = text;
    this.logEl.appendChild(row);
    while (this.logEl.children.length > 6) this.logEl.firstChild.remove();
    this.logEl.hidden = false;
    clearTimeout(this.logTimer);
    this.logTimer = setTimeout(() => { this.logEl.hidden = true; }, 12000);
  }

  send(text) {
    text = (text || '').trim().slice(0, 200);
    if (!text) return null;
    this.addLog('You', text);
    const h = this.listener();
    if (!h) { this.addLog('', '(nobody close enough to hear you)'); return null; }
    // a tiny voice is very quiet: big people only hear you right next to their ear
    const tinyVoice = this.player.scale < h.scale * 0.2;
    if (tinyVoice) {
      const head = (h.character.bones.Bip01_Head || h.character.root).getWorldPosition(new THREE.Vector3());
      if (head.distanceTo(this.camera.position) > 0.35 * h.scale) {
        const r = { text: pick(['Huh? Did someone say something?', '...hello? Is somebody there?', '*looks around, confused*', 'Must be the wind.']), intent: 'unheard', mood: 'neutral' };
        this.pending.push({ h, r, t: 0.8 });
        return { to: h, ...r };
      }
    }
    const r = replyTo(h, text, { player: this.player, colony: this.colony });
    // a moment to think, then answer
    this.pending.push({ h, r, t: 0.6 + Math.random() * 0.6 });
    return { to: h, ...r };
  }

  update(dt) {
    if (!this.open && (this.input.pressed('chat') || this.input.pressed('talk'))) this.show();
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      p.t -= dt;
      if (p.t > 0) continue;
      this.pending.splice(i, 1);
      if (p.h.dead) continue;
      this.speech.say(p.h, p.r.text, { secs: 4.5 });
      this.addLog(p.h.profile.name, p.r.text);
      // say it with the body too (when standing around or in your hand)
      if (['idle', 'held', 'stranded'].includes(p.h.state)) p.h.character.play(pick(TALK_ANIMS[p.r.mood] || TALK_ANIMS.neutral), { onDone: () => p.h.state === 'held' && p.h.character.play('idle_nervous_01', { loop: true }) });
      p.h.updateFace?.();
    }
  }
}
