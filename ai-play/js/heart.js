/* AI Play - the HEART. Feelings + personality.
 *
 * Nobody picks how the AI feels - not you, not a setting. Its feelings come from what happens
 * to it in the game, filtered through its own personality (which it's born with, randomly, and
 * which slowly changes from its experiences - like a person). Its feelings then change how it
 * plays: mad = reckless, scared = careful, bored = tries random stuff, happy = shows off...
 *
 * Pain mode (a setting, OFF by default) lets getting hit HURT: a pain meter, yelling, mood
 * drops, and getting scared + careful around what hurt it. (It acts hurt - it's still code.)
 */
'use strict';

AIP.Heart = (function () {
  const U = AIP.util;
  const EMOS = ['happy', 'sad', 'mad', 'scared', 'bored', 'proud', 'confused', 'excited', 'curious', 'surprised', 'determined', 'relieved'];
  const EMOJI = { happy: '😄', sad: '😢', mad: '😡', scared: '😨', bored: '😴', proud: '😤', confused: '🤔', excited: '🤩', curious: '🧐', surprised: '😲', determined: '😠', relieved: '😮‍💨', pain: '🤕', calm: '🙂', dreaming: '💤' };
  const COLOR = { happy: '#ffd84a', sad: '#5aa9ff', mad: '#ff3b3b', scared: '#b06cff', bored: '#8c8aa8', proud: '#ff9a1f', confused: '#2fe0c8', excited: '#ff4fd8', curious: '#19f6ff', surprised: '#fff07a', determined: '#ff6a3d', relieved: '#7dff9a', pain: '#ff1744' };
  const TRAITS = ['bravery', 'temper', 'drama', 'chattiness', 'patience', 'curiosity', 'silliness', 'salty', 'optimism', 'competitive', 'pride'];
  const TRAIT_WORDS = {
    bravery: ['careful', 'brave'], temper: ['chill', 'hot-headed'], drama: ['calm', 'dramatic'], chattiness: ['quiet', 'chatty'],
    patience: ['impatient', 'patient'], curiosity: ['focused', 'curious'], silliness: ['serious', 'silly'], salty: ['clean-mouthed', 'salty'],
    optimism: ['gloomy', 'optimistic'], competitive: ['laid-back', 'competitive'], pride: ['humble', 'show-off'],
  };
  // How fast each feeling fades (seconds)
  const FADE = { happy: 25, sad: 30, mad: 16, scared: 10, bored: 45, proud: 40, confused: 20, excited: 7, curious: 25, surprised: 3, determined: 35, relieved: 6 };

  function newTraits() { const t = {}; TRAITS.forEach((k) => { t[k] = U.bell(); }); return t; }
  function describe(traits) {
    const list = TRAITS.map((k) => ({ k, d: traits[k] - 0.5 })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    return list.slice(0, 3).map(({ k, d }) => TRAIT_WORDS[k][d > 0 ? 1 : 0]);
  }

  class Heart {
    constructor(ai) {
      this.ai = ai;
      this.t = ai.traits;
      this.e = {};
      EMOS.forEach((k) => { this.e[k] = this.base(k); });
      this.e.confused = 0.35; this.e.curious = Math.max(this.e.curious, 0.45);
      this.pain = 0;
      this.why = {};
      this.deaths = [];
      this.sinceNovel = 0;
      this.dreaming = false;
      this.imp = {};
    }
    // feelings that just changed (since the last time the mind asked)
    takeImpulses() { const i = this.imp; this.imp = {}; return i; }
    base(k) {
      const t = this.t;
      return {
        happy: 0.18 + 0.22 * t.optimism, sad: 0.04 + 0.06 * (1 - t.optimism), mad: 0.02 + 0.06 * t.temper, scared: 0.02 + 0.05 * (1 - t.bravery),
        bored: 0.04, proud: 0.04 + 0.1 * t.pride, confused: 0.04, excited: 0.06 + 0.12 * t.drama, curious: 0.12 + 0.3 * t.curiosity,
        surprised: 0, determined: 0.06 + 0.2 * t.patience * t.competitive, relieved: 0,
      }[k] || 0;
    }
    feel(k, amt, why) {
      if (!amt) return;
      const k2 = (0.55 + 0.9 * this.t.drama) * (amt > 0 ? 1 : 0.8);
      const before = this.e[k];
      this.e[k] = U.clamp(this.e[k] + amt * k2, 0, 1);
      // remember the jolt (the mind uses these to learn what it LIKES doing)
      if (this.e[k] !== before) this.imp[k] = (this.imp[k] || 0) + (this.e[k] - before);
      if (amt > 0 && why) this.why[k] = { text: why, at: Date.now() };
    }
    drift(trait, amt) { this.t[trait] = U.clamp(this.t[trait] + amt, 0.02, 0.98); }

    /* What happened -> how it feels about it. ctx: { painMode, healthFrac, novelty, staticTime } */
    react(events, ctx) {
      const t = this.t;
      const out = []; // feelings worth saying out loud
      const hasDamage = events.some((e) => e.type === 'damage');
      for (const ev of events) {
        if (ev.type === 'flash' && hasDamage) continue; // the red flash IS the hit - don't hurt twice
        switch (ev.type) {
          case 'score': {
            const s = U.clamp(ev.size == null ? 0.4 : ev.size, 0.05, 1);
            this.feel('happy', 0.08 + 0.14 * s * (0.6 + t.optimism), 'I got points');
            this.feel('excited', 0.1 * s * (0.5 + t.drama), 'points!!');
            this.feel('bored', -0.25); this.feel('sad', -0.05); this.feel('confused', -0.05);
            break;
          }
          case 'highscore':
            this.feel('proud', 0.45 * (0.6 + t.pride), 'new high score'); this.feel('happy', 0.25, 'new high score'); this.feel('excited', 0.3, 'new high score');
            this.drift('pride', 0.006); this.drift('optimism', 0.004);
            break;
          case 'damage':
          case 'flash': {
            const a = ev.type === 'flash' ? 0.25 * (ev.size || 0.5) : U.clamp(ev.amount || 0.3, 0.05, 1);
            if (ctx.painMode) {
              this.pain = U.clamp(this.pain + 0.3 + a * 0.7, 0, 1);
              this.feel('scared', (0.14 + a * 0.4) * (1.3 - t.bravery), 'that HURT');
              this.feel('sad', 0.1 + 0.12 * (1 - t.optimism) * a, 'getting hurt');
              this.feel('mad', 0.14 * t.temper * (1 + a), 'getting hit');
              this.drift('bravery', -0.003);
              out.push({ kind: 'pain', amount: a });
            } else if (ev.type === 'damage') {
              this.feel('mad', 0.04 * t.temper, 'losing health'); this.feel('sad', 0.03, 'losing health');
              out.push({ kind: 'damage', amount: a });
            }
            break;
          }
          case 'heal': case 'refill':
            if (ctx.healthFrac != null && ctx.healthFrac < 0.6) { this.feel('relieved', 0.4, 'got health back'); this.feel('scared', -0.3); }
            this.pain = Math.max(0, this.pain - 0.2);
            break;
          case 'death': {
            const now = performance.now();
            this.deaths.push(now);
            this.deaths = this.deaths.filter((d) => now - d < 60000);
            const streak = this.deaths.length;
            this.feel('sad', 0.22 * (1.15 - t.optimism), 'I died');
            this.feel('mad', 0.18 * t.temper * (1 + (streak - 1) * 0.35), streak >= 3 ? 'dying over and over' : 'I died');
            this.feel('determined', 0.15 * t.patience * (1 + streak * 0.15), 'I want to do better');
            this.feel('happy', -0.3); this.feel('excited', -0.3); this.feel('scared', -0.25);
            this.drift('temper', streak >= 3 ? 0.004 : 0.001);
            this.drift('optimism', -0.002);
            if (streak >= 3 && now - (this.streakSaidAt || -1e9) > 25000) {
              this.streakSaidAt = now;
              this.drift('patience', t.patience > 0.5 ? 0.003 : -0.003);
              out.push({ kind: streak >= 4 && this.e.mad > 0.55 ? 'rage' : 'streak', n: streak });
            }
            break;
          }
          case 'win':
            this.feel('happy', 1, 'I WON'); this.feel('proud', 0.6, 'I won'); this.feel('excited', 0.7, 'I won'); this.feel('surprised', 0.3);
            this.drift('optimism', 0.02); this.drift('bravery', 0.01); this.drift('pride', 0.01);
            break;
          case 'learnedControl':
            this.feel('proud', 0.1, 'figuring out the controls'); this.feel('happy', 0.06); this.feel('confused', -0.22); this.feel('curious', 0.04);
            break;
          case 'uselessKey': this.feel('confused', 0.03); break;
          case 'thumbUp': this.feel('happy', 0.1, 'doing something right'); this.feel('proud', 0.08, 'doing something right'); this.feel('confused', -0.05); break;
          case 'thumbDown': this.feel(t.temper * t.salty > 0.3 ? 'mad' : 'sad', 0.07, 'messing up'); this.feel('confused', 0.05); break;
          case 'tip': this.feel('curious', 0.06, 'a new tip'); this.feel('confused', -0.08); break;
          case 'rivalAhead': this.feel('determined', 0.25 * t.competitive, 'a rival has a better score'); this.feel('mad', 0.08 * t.competitive * t.temper); break;
          case 'beatRival': this.feel('proud', 0.4 * (0.5 + t.competitive), 'beating a rival'); this.feel('happy', 0.2); this.drift('competitive', 0.004); break;
          case 'nightmare': if (ctx.painMode) this.feel('scared', 0.12, 'a bad dream'); this.feel('sad', 0.05); break;
          case 'goodDream': this.feel('happy', 0.08, 'a good dream'); this.feel('relieved', 0.1); break;
          case 'stuck': this.feel('mad', 0.08 * t.temper, 'being stuck'); this.feel('bored', 0.12, 'being stuck'); this.feel('confused', 0.12, 'being stuck'); break;
          case 'gameStart': this.feel('excited', 0.2, 'a new game'); this.feel('curious', 0.25, 'a new game'); break;
          case 'ideaWorked': this.feel('proud', 0.3, 'my idea worked'); this.feel('happy', 0.2, 'my idea worked'); this.feel('bored', -0.2); break;
          case 'ideaFailed': if (t.silliness > 0.55) this.feel('happy', 0.08, 'a silly idea'); else { this.feel('confused', 0.06); this.feel('mad', 0.04 * t.temper); } break;
          case 'likedThing': this.feel('happy', 0.12, 'doing what I like'); break;
          case 'goalPicked': this.feel('determined', 0.25, 'my new goal'); this.feel('excited', 0.12, 'my new goal'); break;
          case 'goalDone': this.feel('proud', 0.5, 'reaching my goal'); this.feel('relieved', 0.35); this.feel('happy', 0.3, 'reaching my goal'); this.drift('pride', 0.005); this.drift('optimism', 0.004); break;
          case 'goalGiveUp': this.feel('sad', 0.1, 'giving up for now'); this.feel('relieved', 0.2); this.feel('mad', -0.2); break;
          case 'milestone': this.feel('proud', 0.2, 'finishing a mission'); this.feel('happy', 0.12); break;
          default: break;
        }
      }
      return out;
    }

    // Called every tick: feelings fade back to normal, and slow feelings build up.
    update(dt, ctx) {
      const t = this.t;
      const fadeMul = { sad: 1.5 - t.optimism, mad: 1.5 - t.patience, scared: 0.8 + (1 - t.bravery) * 0.6 };
      for (const k of EMOS) {
        const tau = FADE[k] * (fadeMul[k] || 1);
        const b = this.base(k);
        this.e[k] += (b - this.e[k]) * (1 - Math.exp(-dt / tau));
      }
      this.pain *= Math.exp(-dt / 4);
      if (!ctx.painMode) this.pain = 0;
      if (this.dreaming) return;
      // boredom: nothing new + nothing happening
      const nov = ctx.novelty == null ? 0.5 : ctx.novelty;
      this.sinceNovel = nov > 0.3 ? 0 : this.sinceNovel + dt;
      if (ctx.staticTime > 2 || this.sinceNovel > 6) this.feel('bored', dt * 0.05 * (1.4 - t.patience), 'nothing happening');
      if (nov > 0.5) { this.feel('curious', dt * 0.06 * (0.4 + t.curiosity), 'seeing new stuff'); this.feel('bored', -dt * 0.15); }
      if (nov > 0.9 && ctx.bigChange) this.feel('surprised', 0.15, 'something new popped up');
      // low health = scary (more if pain mode is on)
      if (ctx.healthFrac != null && ctx.healthFrac < 0.34) this.feel('scared', dt * (ctx.painMode ? 0.16 : 0.07) * (1.3 - t.bravery), 'low health');
      if (ctx.noControlsYet) this.feel('confused', dt * 0.02, "not knowing the controls");
    }

    dominant() {
      if (this.dreaming) return { name: 'dreaming', value: 1 };
      if (this.pain > 0.45) return { name: 'pain', value: this.pain };
      let best = 'happy', bv = -1;
      for (const k of EMOS) {
        const v = this.e[k] - this.base(k) * 0.6;
        if (v > bv) { bv = v; best = k; }
      }
      if (this.e[best] < 0.22) return { name: 'calm', value: 0.2 };
      return { name: best, value: this.e[best] };
    }
    whyFeel(k) { const w = this.why[k]; return w ? w.text : null; }

    // HOW FEELINGS CHANGE PLAY (the AI's own mood + personality decide this, not settings)
    mods(painMode) {
      const e = this.e, t = this.t;
      const rage = e.mad * t.temper;
      return {
        temp: U.clamp(0.42 + 0.6 * e.mad + 0.45 * e.bored + 0.25 * e.excited - 0.25 * e.determined - 0.2 * e.scared + 0.2 * (1 - t.patience), 0.18, 1.6),
        explore: U.clamp(0.025 + 0.1 * e.bored + 0.08 * rage + 0.05 * e.curious * t.curiosity + 0.04 * e.confused - 0.03 * e.scared, 0.01, 0.3),
        stick: U.clamp(0.25 + 0.4 * e.determined + 0.3 * e.scared - 0.35 * rage - 0.2 * e.bored, 0, 1),
        fear: U.clamp(1 + 2 * e.scared * (1.3 - t.bravery) + (painMode ? 1.2 * this.pain + 0.4 : 0) - 0.7 * rage, 0.3, 4),
        instinct: U.clamp(0.8 + 0.4 * e.determined + 0.3 * e.scared - 0.3 * e.bored, 0.4, 1.6),
        curiosity: U.clamp(0.25 + 0.75 * t.curiosity * (0.5 + e.curious) + 0.3 * e.bored, 0.1, 1.5),
        confused: e.confused,
        bored: e.bored,
        patience: t.patience,
        // "reaction time" - sad/scared/bored = slower, mad/excited/determined = faster
        reaction: U.clamp(115 * (1 + 0.6 * e.sad + 0.4 * e.scared * (1 - t.bravery) + 0.35 * e.bored - 0.35 * e.mad - 0.3 * e.excited - 0.2 * e.determined), 55, 260),
        fun: U.clamp((e.happy * 0.5 + e.bored * 0.9 + e.proud * 0.4 + e.excited * 0.2) * (0.25 + t.silliness) - e.scared * 0.6 - this.pain, 0, 1.5),
        // how much "I like doing this" steers it, and how much it wants to invent something new
        whim: U.clamp(0.3 + 0.5 * e.bored + 0.4 * e.happy + 0.3 * t.silliness - 0.4 * e.scared - 0.25 * e.determined, 0, 1.5),
        create: U.clamp(0.1 + 0.6 * e.bored + 0.35 * t.curiosity * (0.5 + e.curious) + 0.3 * t.silliness * e.happy + 0.3 * e.confused - 0.5 * e.scared - this.pain, 0, 1.5),
      };
    }

    // How the face should look right now.
    face() {
      const e = this.e;
      const dom = this.dominant().name;
      return {
        dom,
        eyeOpen: this.dreaming ? 0.05 : U.clamp(0.85 + 0.35 * e.scared + 0.3 * e.surprised - 0.45 * e.bored - 0.25 * e.sad + 0.15 * e.excited - 0.3 * e.mad * 0.5, 0.15, 1.3),
        brow: U.clamp(-1.2 * e.mad - 0.4 * e.determined + 0.9 * e.sad + 0.9 * e.scared + 0.5 * e.confused, -1, 1),
        mouth: U.clamp(1.1 * e.happy + 0.6 * e.proud + 0.6 * e.excited + 0.3 * e.relieved - 1.1 * e.sad - 0.7 * e.mad - 0.6 * e.scared - 0.3 * e.bored - this.pain * 1.2, -1, 1),
        open: U.clamp(0.9 * e.surprised + 0.6 * e.excited + 0.6 * e.scared * e.scared + this.pain * 0.8 + (e.mad > 0.7 ? 0.4 : 0), 0, 1),
        tears: e.sad > 0.5 || this.pain > 0.7,
        sweat: e.scared > 0.45,
        anger: e.mad > 0.5,
        sparkle: e.proud > 0.5 || e.happy > 0.8,
        question: e.confused > 0.5,
        zzz: this.dreaming || e.bored > 0.75,
        pain: this.pain,
        anim: this.dreaming ? 'float' : this.pain > 0.5 ? 'shake' : dom === 'mad' && e.mad > 0.6 ? 'shake' : dom === 'scared' ? 'tremble' : (dom === 'happy' || dom === 'excited' || dom === 'proud') && this.dominant().value > 0.5 ? 'bounce' : dom === 'bored' || dom === 'sad' ? 'sway' : '',
        glow: COLOR[dom] || '#19f6ff',
      };
    }
  }
  Heart.EMOS = EMOS; Heart.EMOJI = EMOJI; Heart.COLOR = COLOR; Heart.TRAITS = TRAITS; Heart.TRAIT_WORDS = TRAIT_WORDS;
  Heart.newTraits = newTraits; Heart.describe = describe;
  return Heart;
})();
