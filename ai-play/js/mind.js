/* AI Play - the MIND 💖💡🎯: what it LIKES, its own creative IDEAS, and the GOALS it picks itself.
 *
 * Nobody sets any of this - not you, not a setting:
 *  💖 LIKES: whatever it was doing when it felt good (jumping, exploring, clicking 'Like', reading the
 *     story...) it starts to like, and it does more of what it likes. It gets a bit tired of doing
 *     the same thing forever, so it mixes it up. Its taste carries over between games.
 *  💡 IDEAS: when it's bored, stuck, or just feeling creative, it invents a move (a combo, a dash,
 *     a timed pounce, a detour to somewhere new...), tries it, and keeps the ones that work - and
 *     names them. The coach can suggest ideas too; it decides itself whether it likes them.
 *  🎯 GOALS: from its personality + what it learned about the game it picks what IT wants: beat
 *     the game, hunt trophies, beat its best, explore, see the story, or just have fun. It sticks
 *     with a goal until it gets it, takes a break when it's too hard, and when it's done what it
 *     wanted (and it's getting bored) it can decide it's done with the game.
 */
'use strict';

AIP.Mind = (function () {
  const U = AIP.util;
  const KEYS = AIP.KEYS;
  const ADJ = ['Zoom', 'Sneaky', 'Turbo', 'Wobbly', 'Patient', 'Mega', 'Spicy', 'Ninja', 'Cosmic', 'Lazy', 'Chaos', 'Smooth', 'Bouncy', 'Sideways', 'Gremlin', 'Galaxy', 'Rocket', 'Noodle'];
  const NOUN = { combo: ['Combo', 'Mash', 'Chord'], seq: ['Dash', 'Shuffle', 'Run'], hold: ['Charge', 'Hold', 'Power-Up'], rhythm: ['Beat', 'Tap Dance', 'Drumroll'], waitgo: ['Pounce', 'Ambush', 'Wait-and-Go'], mirror: ['Flip', 'Reverse'], route: ['Adventure', 'Scout', 'Detour'], turn: ['Spin-and-Go', 'U-Turn', 'Look-Around'], button: ['Poke', 'Click'], weird: ['Experiment', 'Mystery Key'], fun: ['Dance', 'Party'], coach: ['Plan'] };
  const GOAL_ICON = { beat: '🏁', trophies: '🏆', highscore: '📈', explore: '🗺️', story: '📖', fun: '😜' };
  const GOAL_WORD = { beat: 'beat the game', trophies: 'get trophies', highscore: 'beat my best', explore: 'explore everything', story: 'see how the story ends', fun: 'just have fun' };
  const SIT_TAGS = ['points', 'explore', 'story', 'typing', 'menu', 'idea', 'fun', 'trophy', 'win', 'hurt'];
  const generic = (tag) => tag.split(':')[0];

  class Mind {
    constructor(session) {
      this.s = session;
      this.tr = {};            // eligibility trace: what it was just doing
      this.joyBase = 0;
      this.exp = null;         // the idea it's trying right now (an experiment)
      this.nextCreate = 0;
      this.goalCheckAt = 0;
      this.rEMA = 0;           // normal reward per second (to judge ideas against)
      this.tagCache = new Map(); this.tagCacheAt = 0;
      this.mods = null;
      this.sessT0 = performance.now();
      this.boredSince = 0;
      this.coachIdeaPending = null;
    }
    get B() { return this.s.brain; }
    get S() { return this.s.brain.stats; }
    get t() { return this.s.ai.traits; }

    /* ---------- start: load what it remembers + hook into the brain ---------- */
    load() {
      const S = this.S;
      S.likes = S.likes || {};
      S.ideas = S.ideas || [];
      S.goals = S.goals || { cur: null, done: [], resting: {}, log: [] };
      S.goals.resting = S.goals.resting || {}; S.goals.done = S.goals.done || []; S.goals.log = S.goals.log || [];
      S.facts = S.facts || { canWinHint: 0, won: false, trophyTotal: 0, hasScore: false, seenProgress: false, playMs: 0 };
      S.visits = S.visits || new Array(16).fill(0);
      this.s.ai.likes = this.s.ai.likes || {};
      this.B.likeOf = (a) => this.likeOfAction(a);
      this.B.btnBias = (text) => this.btnBias(text);
      this.goalsDoneHere = 0;
    }

    /* ======================= 💖 LIKES ======================= */
    prior(tag) {
      const t = this.t, g = generic(tag);
      const p = { explore: (t.curiosity - 0.5) * 0.5, points: (t.competitive - 0.5) * 0.4, story: (t.patience - 0.5) * 0.3 + (t.drama - 0.5) * 0.2,
        jump: (t.silliness - 0.5) * 0.2 + 0.05, combo: (t.silliness - 0.5) * 0.2 + (t.curiosity - 0.5) * 0.15, fun: (t.silliness - 0.5) * 0.4, typing: (t.chattiness - 0.5) * 0.3,
        menu: -0.1, wait: -0.12 + (t.patience - 0.5) * 0.2, trophy: (t.pride - 0.5) * 0.4 + 0.1, idea: (t.curiosity - 0.5) * 0.25 + (t.silliness - 0.5) * 0.15,
        hurt: -0.3 + (t.bravery - 0.5) * 0.2, win: 0.3, look: (t.curiosity - 0.5) * 0.15 }[g] || 0;
      const cross = this.s.ai.likes[g];
      return U.clamp(p + (cross ? 0.4 * cross.v : 0), -0.6, 0.6);
    }
    like(tag) {
      const L = this.S.likes[tag];
      if (!L) return this.prior(tag) * 0.5;
      return L.v - (L.v > 0 ? L.fat || 0 : 0);
    }
    likeOfAction(a) {
      if (!a || !this.mods) return 0;
      const now = performance.now();
      if (now - this.tagCacheAt > 2000) { this.tagCache.clear(); this.tagCacheAt = now; }
      let tags = this.tagCache.get(a.id);
      if (!tags) { tags = this.B.tagsOf(a); this.tagCache.set(a.id, tags); }
      if (!tags.length) return 0;
      let sum = 0;
      for (const tg of tags) sum += this.like(tg);
      const g = this.S.goals.cur;
      const goalWhim = !g ? 1 : { fun: 1.5, explore: 1.2, trophies: 0.9, story: 1, beat: 0.55, highscore: 0.55 }[g.kind] || 1;
      return U.clamp(sum / Math.sqrt(tags.length) * this.mods.whim * goalWhim * 0.7, -0.8, 0.8);
    }
    btnBias(text) {
      const tx = String(text || '').toLowerCase().slice(0, 20);
      let b = 0.8 * this.like('btn:' + tx);
      const g = this.S.goals.cur;
      // hunting trophies? peek at the trophy list once in a while
      if (g && g.kind === 'trophies' && /troph|achiev|goals|badges|awards/.test(tx) && performance.now() - (this.peekedAt || -1e9) > 120000) b += 1.5;
      return b;
    }
    wordsFor(tag) {
      const B = this.B;
      if (/^move:/.test(tag)) return 'going ' + { l: 'left', r: 'right', u: 'up', d: 'down' }[tag.slice(5)];
      if (/^act:/.test(tag)) { const code = tag.slice(4), c = B.controls[code]; return 'pressing ' + KEYS.label(code) + (c && c.tip ? ' (' + c.tip.replace(/\s*\(coach.*$/, '') + ')' : ''); }
      if (/^btn:/.test(tag)) return "clicking '" + tag.slice(4) + "'";
      if (/^idea:/.test(tag)) { const i = this.S.ideas.find((x) => x.id === tag.slice(5)); return i ? 'my move ' + i.name : 'my own ideas'; }
      return { move: 'running around', jump: 'jumping', act: 'pressing buttons', look: 'looking around', click: 'clicking', scroll: 'scrolling', btn: 'clicking buttons', aim: 'moving the mouse',
        combo: 'doing combos', wait: 'chilling', points: 'getting points', explore: 'exploring new places', story: 'reading the story', typing: 'typing stuff', menu: 'menus',
        idea: 'trying my own ideas', fun: 'goofing around', trophy: 'trophy hunting', win: 'winning', hurt: 'getting hurt' }[tag] || tag;
    }
    // what it's doing right now, as tags
    tagsNow(events, obs) {
      const s = this.s, B = this.B, out = [];
      const d = s.lastDecision;
      if (s.mode === 'ai' && d && B.actions[d.slot]) out.push(...this.B.tagsOf(B.actions[d.slot]).slice(0, 3));
      if (d && d.mouse && d.mouse.t === 'btn' && d.mouse.text) out.push('btn:' + String(d.mouse.text).toLowerCase().slice(0, 20));
      if (events.some((e) => e.type === 'score')) out.push('points');
      if ((B.noveltyNow || 0) >= 0.7 && !obs.menuish) out.push('explore');
      if (s.reading) out.push('story');
      if (s.typist && s.typist.active) out.push('typing');
      if (obs.menuish) out.push('menu');
      if (events.some((e) => e.type === 'damage')) out.push('hurt');
      if (B.routine) out.push(B.routine.ideaId ? 'idea:' + B.routine.ideaId : 'fun', B.routine.ideaId ? 'idea' : 'fun');
      return [...new Set(out)].slice(0, 7);
    }

    /* ---------- every tick ---------- */
    tick(dt, events, obs, now) {
      const s = this.s, S = this.S, t = this.t;
      if (!obs || !obs.ok || s.mode !== 'ai') { s.heart.takeImpulses(); return; }
      S.facts.playMs = (S.facts.playMs || 0) + dt * 1000;
      // 1) how good did that feel? (the jolts in its feelings)
      const imp = s.heart.takeImpulses();
      const I = (k) => imp[k] || 0;
      let joy = I('happy') + I('excited') + 0.6 * I('proud') + 0.5 * I('relieved') + 0.3 * I('curious') + 0.2 * I('surprised')
        - 0.8 * Math.max(0, I('bored')) + 0.4 * Math.max(0, -I('bored')) - I('sad') - 0.6 * Math.max(0, I('mad')) * (1 - 0.5 * t.silliness) - Math.max(0, I('scared')) * (1 - 0.5 * t.bravery);
      if (s.heart.e.bored > 0.5) joy -= 0.02 * dt * (s.heart.e.bored - 0.5);
      for (const e of events) if (e.type === 'trophy' || e.type === 'win') joy += 0.5; else if (e.type === 'milestone' || e.type === 'highscore') joy += 0.3;
      this.joyBase += (joy - this.joyBase) * 0.01;
      const rel = joy - this.joyBase;
      if (this.exp) this.exp.joy += rel;
      // 2) what was it doing? (recent things get the credit)
      const cur = this.tagsNow(events, obs);
      for (const k in this.tr) { this.tr[k] *= Math.exp(-dt / 1.5); if (this.tr[k] < 0.05) delete this.tr[k]; }
      for (const tg of cur) this.tr[tg] = 1;
      for (const tg in this.tr) {
        const tr = this.tr[tg];
        const L = S.likes[tg] || (S.likes[tg] = { v: this.prior(tg), n: 0, fat: 0, said: 0 });
        const lr = tr * Math.max(0.03, 1 / (L.n + 8));
        L.v = U.clamp(L.v + lr * 4 * rel, -1, 1);
        L.n += tr * dt;
        // doing the same liked thing nonstop gets a little old (so it mixes things up)
        if (cur.indexOf(tg) >= 0) { if (L.v > 0) L.fat = Math.min(0.6, (L.fat || 0) + dt * 0.012 * (1.25 - t.patience)); } else L.fat = (L.fat || 0) * Math.exp(-dt / 40);
        if (!L.said && L.n > 8 && L.v > 0.45 && this.sayOk(now)) { L.said = 1; s.voice.say('likeFound', { act: this.wordsFor(tg) }, 2); s.heart.react([{ type: 'likedThing' }], {}); this.noteLike(tg, true); }
        else if (!L.said && L.n > 8 && L.v < -0.4 && this.sayOk(now)) { L.said = -1; s.voice.say('dislikeFound', { act: this.wordsFor(tg) }, 1); this.noteLike(tg, false); }
      }
      // keep the likes list small (forget the weakest unimportant ones)
      const keys = Object.keys(S.likes);
      if (keys.length > 60) { keys.sort((a, b) => Math.abs(S.likes[a].v) * S.likes[a].n - Math.abs(S.likes[b].v) * S.likes[b].n); for (const k of keys.slice(0, keys.length - 50)) delete S.likes[k]; }
      // 3) where it goes on screen (so "route" ideas can go somewhere new)
      const me = this.B.self;
      if (me.conf > 0.4 && me.camera < 0.5) { const cell = Math.min(3, Math.floor(me.x * 4)) + 4 * Math.min(3, Math.floor(me.y * 4)); S.visits[cell] = (S.visits[cell] || 0) + dt; }
      // 4) the idea it's trying: is it over? how did it go?
      this.checkExperiment(obs, events, now);
      // 5) goals: facts + progress every ~2 s
      if (now >= this.goalCheckAt) { this.goalCheckAt = now + 2000; this.updateFacts(obs); this.goalTick(now); }
      if (s.heart.e.bored > 0.7) { if (!this.boredSince) this.boredSince = now; } else this.boredSince = 0;
    }
    sayOk(now) { if (now - (this.saidAt || 0) < 9000) return false; this.saidAt = now; return true; }
    noteLike(tag, good) {
      const f = this.S.flags || (this.S.flags = {});
      f.likeDiary = (f.likeDiary || 0) + 1;
      if (f.likeDiary <= 4) this.s.diary('like', (good ? 'I really like ' : "I don't like ") + this.wordsFor(tag) + ' in ' + this.s.game.name + (good ? ' 💖' : ' 😒'));
    }
    // its taste carries over to other games (a little)
    saveTaste() {
      const ai = this.s.ai;
      for (const k in this.S.likes) {
        const L = this.S.likes[k];
        if (L.n < 5) continue;
        const g = generic(k);
        const X = ai.likes[g] || (ai.likes[g] = { v: 0, n: 0 });
        X.v = U.clamp(X.v + 0.05 * (L.v - X.v), -1, 1); X.n += 1;
      }
      // who it enjoys being slowly shapes who it is
      const lk = (g) => (ai.likes[g] ? ai.likes[g].v : 0);
      if (lk('explore') > 0.4) this.s.heart.drift('curiosity', 0.002);
      if (lk('fun') > 0.4 || lk('idea') > 0.4) this.s.heart.drift('silliness', 0.002);
      if (lk('points') > 0.4) this.s.heart.drift('competitive', 0.002);
    }
    favorite() {
      let best = null, bv = 0.3;
      for (const k in this.S.likes) { const L = this.S.likes[k]; if (L.n > 6 && L.v > bv && k !== 'win') { bv = L.v; best = k; } }
      return best;
    }

    /* ======================= reward + mood shaping ======================= */
    intrinsic(events, obs) {
      if (!this.mods) return 0;
      let r = 0;
      const sit = this.tagsNow(events, obs).filter((x) => SIT_TAGS.indexOf(generic(x)) >= 0);
      for (const tg of sit) r += 0.12 * this.mods.whim * this.like(tg);
      const g = this.S.goals.cur, B = this.B;
      if (g) {
        if (g.kind === 'explore') r += 0.12 * (B.noveltyNow || 0);
        for (const e of events) {
          if (e.type === 'trophy' && g.kind === 'trophies') r += 1.5;
          if ((e.type === 'progress' || e.type === 'milestone') && (g.kind === 'beat' || g.kind === 'story')) r += 0.6;
          if (e.type === 'score' && g.kind === 'highscore') r += 0.15;
        }
      }
      return U.clamp(r, -0.3, 2);
    }
    noteReward(r, dt) { this.rEMA += ((r / Math.max(0.02, dt)) - this.rEMA) * Math.min(1, dt / 10); if (this.exp) { this.exp.r += r; this.exp.dt += dt; } }
    adjustMods(m) {
      this.mods = m;
      const g = this.S.goals.cur;
      if (!g) return m;
      if (g.kind === 'beat' || g.kind === 'highscore') { m.temp *= 0.85; m.explore *= 0.7; }
      if (g.kind === 'explore') { m.curiosity *= 1.3; m.create *= 1.3; }
      if (g.kind === 'trophies') m.create *= 1.4;
      if (g.kind === 'fun') { m.whim *= 1.4; m.create *= 1.5; }
      return m;
    }

    /* ======================= 💡 IDEAS ======================= */
    keysByKind() {
      const B = this.B;
      const ok = Object.keys(B.controls).filter((c) => c.indexOf('m:') !== 0 && KEYS.map[c] && (B.controls[c].status === 'useful' || B.controls[c].status === 'starred') && !this.s.pauseKeys.has(c));
      const look = Object.keys(B.controls).filter((c) => /^m:look-[lr]$/.test(c) && B.controls[c].status === 'useful');
      return { all: ok, dirs: ok.filter((c) => B.isMoveKey(c)), acts: ok.filter((c) => !B.isMoveKey(c) && Math.hypot(B.controls[c].gx, B.controls[c].gy) <= 0.4), look };
    }
    situation(obs, now) {
      const s = this.s;
      if ((obs.staticTime || 0) > 4 || s.stuckFor > 4) return 'stuck';
      if (now - s.ep.lastDamageAt < 3000) return 'danger';
      if (s.heart.e.bored > 0.45) return 'bored';
      return 'open';
    }
    // when it feels like it, it tries an idea (reuse a good one / tweak one / invent a new one)
    maybeCreate(obs, mods, dt, now, force) {
      const s = this.s, B = this.B;
      if (s.mode !== 'ai' || s.phase !== 'play' || B.routine || B.lab || this.exp || s.reading || s.take || (s.typist && s.typist.active)) return false;
      if (obs.menuish || obs.gameOverVisible || (obs.choices && obs.choices.length) || now < this.nextCreate) return false;
      if (now - (s.loadedAt || now) < 6000) return false;
      const sit = this.situation(obs, now);
      const g = this.S.goals.cur;
      const goalCreate = !g ? 1 : { fun: 1.5, trophies: 1.4, explore: 1.3, beat: sit === 'stuck' ? 1.6 : 0.8, highscore: 0.8, story: 0.7 }[g.kind] || 1;
      const fresh = this.S.ideas.filter((i) => i.kind !== 'fun').length < 3 ? 2 : 1; // new game = lots of ideas to try
      const urge = (0.15 + mods.create) * goalCreate * fresh * (sit === 'stuck' ? 3 : sit === 'bored' ? 1.6 : 1) * (1 + 0.6 * Math.max(0, this.like('idea')));
      if (!force && !U.chance(urge * dt * 0.05)) return false;
      if (this.coachIdeaPending) { const ci = this.coachIdeaPending; this.coachIdeaPending = null; return this.tryIdea(ci, obs, now, 'coach'); }
      const ks = this.keysByKind();
      const ideas = this.S.ideas;
      const t = this.t;
      // a move I already know works here?
      const keepers = ideas.filter((i) => i.status === 'keeper' && (i.situ === sit || sit === 'open' || i.situ === 'open'));
      if (keepers.length && U.chance(0.45 + 0.3 * t.patience - 0.25 * t.curiosity)) {
        const pick = this.softPick(keepers, (i) => i.score + this.like('idea:' + i.id));
        if (pick) { if (this.sayOk(now)) s.voice.say('ideaReuse', { idea: pick.name }, 1); return this.tryIdea(pick, obs, now); }
      }
      // tweak one that sort of worked?
      const tweakable = ideas.filter((i) => (i.status === 'keeper' || i.status === 'meh') && i.kind !== 'fun' && i.kind !== 'button');
      if (tweakable.length && U.chance(0.35)) {
        const parent = U.pick(tweakable);
        const child = this.mutate(parent, ks);
        if (child) { if (this.sayOk(now)) s.voice.say('ideaMutate', { idea: parent.name }, 1); return this.tryIdea(child, obs, now); }
      }
      const idea = this.invent(sit, ks, obs);
      if (!idea) { this.nextCreate = now + 4000; return false; }
      return this.tryIdea(idea, obs, now);
    }
    softPick(list, score) {
      let z = 0;
      const w = list.map((x) => { const v = Math.exp(U.clamp(score(x), -3, 3) * 1.5); z += v; return v; });
      let r = Math.random() * z;
      for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; }
      return list[list.length - 1];
    }
    name(kind) {
      const used = new Set(this.S.ideas.map((i) => i.name));
      for (let i = 0; i < 8; i++) { const n = 'the ' + U.pick(ADJ) + ' ' + U.pick(NOUN[kind] || ['Move']); if (!used.has(n)) return n; }
      return 'the ' + U.pick(ADJ) + ' ' + U.pick(NOUN[kind] || ['Move']) + ' ' + (this.S.ideas.length + 1);
    }
    describe(steps) {
      return steps.map((st) => st.mouse ? (st.mouse.t === 'look' ? 'look ' + (st.mouse.dx < 0 ? 'left' : st.mouse.dx > 0 ? 'right' : st.mouse.dy < 0 ? 'up' : 'down') : st.mouse.t === 'btn' ? "click '" + (st.mouse.text || 'a button') + "'" : 'click') + (st.n > 1 ? ' x' + st.n : '')
        : st.keys && st.keys.length ? st.keys.map(KEYS.label).join('+') + (st.n > 1 ? ' (hold ' + st.n + ')' : '') : 'wait' + (st.n > 1 ? ' ' + st.n : '')).join(' → ').slice(0, 90);
    }
    // 🎨 make up something new (what kind depends on its personality + mood + the moment)
    invent(sit, ks, obs) {
      const t = this.t, B = this.B, s = this.s, e = s.heart.e;
      const cam = B.self.camera > 0.5;
      const opp = (code) => { const d = B.moveDir(code); return ks.dirs.find((k) => { const d2 = B.moveDir(k); return d2[0] * d[0] + d2[1] * d[1] < -0.3; }); };
      const unclicked = (obs.buttons || []).filter((b) => b.el.isConnected && b.prio >= 0.3 && !(b.text.toLowerCase() in B.buttonValue));
      const untested = KEYS.order.filter((c) => (!B.controls[c] || B.controls[c].status === 'new') && !/Escape|Tab|ControlLeft/.test(c) && !s.pauseKeys.has(c));
      const W = {
        combo: ks.all.length >= 2 ? 0.5 + t.curiosity : 0,
        seq: ks.all.length >= 2 ? 0.4 + t.patience * 0.6 : 0,
        hold: ks.acts.length ? 0.25 + t.patience * 0.5 : 0,
        rhythm: ks.acts.length ? 0.25 + t.silliness * 0.8 : 0,
        waitgo: ks.all.length ? (0.2 + t.patience * 0.4 + t.bravery * 0.3) * (sit === 'danger' ? 2 : 1) : 0,
        route: (cam ? ks.look.length && ks.dirs.length : ks.dirs.length && B.self.conf > 0.3) ? (0.4 + t.curiosity * 0.8) * (sit === 'stuck' ? 2.2 : 1) : 0,
        button: unclicked.length ? (0.2 + t.curiosity * 0.6) * (sit === 'stuck' ? 2 : 1) : 0,
        weird: untested.length ? (0.12 + t.curiosity * 0.3) * (sit === 'stuck' ? 2.5 : 1) : 0,
        fun: (0.2 + t.silliness * 0.8) * (sit === 'bored' ? 1.5 : 1) * (sit === 'danger' ? 0.2 : 1) * (obs.healthFrac != null && obs.healthFrac < 0.5 ? 0.1 : 1),
      };
      for (const k in W) W[k] *= 1 + 0.5 * Math.max(-0.8, this.like('ideakind:' + k));
      let z = 0; for (const k in W) z += W[k];
      if (z <= 0) return null;
      let r = Math.random() * z, kind = 'fun';
      for (const k in W) { r -= W[k]; if (r <= 0) { kind = k; break; } }
      const R = (a, b) => U.randi(a, b);
      let steps = [];
      const two = () => { const a = U.pick(ks.all); const rest = ks.all.filter((x) => x !== a && !(B.isMoveKey(x) && B.isMoveKey(a) && opp(a) === x)); return rest.length ? [a, U.pick(rest)] : null; };
      switch (kind) {
        case 'combo': { const k = two(); if (!k) return null; if (ks.all.length > 2 && U.chance(0.25 * t.silliness)) { const third = ks.all.find((x) => k.indexOf(x) < 0 && opp(k[0]) !== x); if (third) k.push(third); } steps = [{ keys: k, n: R(5, 12) }]; break; }
        case 'seq': for (let i = 0, n = R(3, 5); i < n; i++) steps.push({ keys: [U.pick(ks.all)], n: R(2, 8) }); break;
        case 'hold': steps = [{ keys: [U.pick(ks.acts)], n: R(10, 22) }, { keys: [], n: 2 }]; break;
        case 'rhythm': { const a = U.pick(ks.acts); for (let i = 0, n = R(5, 9); i < n; i++) steps.push({ keys: [a], n: 1, gap: true }); break; }
        case 'waitgo': steps = [{ keys: [], n: R(3, 9) }, { keys: [U.pick(ks.acts.length && U.chance(0.6) ? ks.acts : ks.all)], n: R(2, 4) }, { keys: ks.dirs.length ? [U.pick(ks.dirs)] : [], n: R(3, 6) }]; break;
        case 'route': {
          if (cam) {
            const lk = U.pick(ks.look);
            const fwd = ks.dirs.find((c) => /forward|walk|run/i.test((B.controls[c].tip || ''))) || ks.dirs.find((c) => c === 'KeyW' || c === 'ArrowUp') || U.pick(ks.dirs);
            steps = [{ id: lk, mouse: { t: 'look', dx: (lk === 'm:look-l' ? -1 : 1) * 80, dy: 0 }, n: R(3, 7) }, { keys: [fwd], n: R(14, 26) }];
            kind = 'turn';
          } else {
            // go to the part of the screen it's been to the LEAST
            const V = this.S.visits;
            let bc = 0; for (let i = 1; i < 16; i++) if ((V[i] || 0) < (V[bc] || 0) || ((V[i] || 0) === (V[bc] || 0) && Math.random() < 0.3)) bc = i;
            const tx = (bc % 4 + 0.5) / 4, ty = (Math.floor(bc / 4) + 0.5) / 4;
            const want = [tx - B.self.x, ty - B.self.y];
            const ranked = ks.dirs.map((c) => { const d = B.moveDir(c); return [c, d[0] * want[0] + d[1] * want[1]]; }).filter((x) => x[1] > 0.02).sort((a, b) => b[1] - a[1]);
            if (!ranked.length) return null;
            const keys = ranked.length > 1 && ranked[1][1] > ranked[0][1] * 0.5 ? [ranked[0][0], ranked[1][0]] : [ranked[0][0]];
            steps = [{ keys, n: R(14, 28) }];
          }
          break;
        }
        case 'button': { const b = U.pick(unclicked); steps = [{ id: 'm:btn', mouse: { t: 'btn', text: b.text }, n: 1 }, { keys: [], n: 6 }]; break; } // (the button is found again by its text - never save page elements)
        case 'weird': { const k = U.pick(untested.slice(0, 12)); if (!k) return null; steps = [{ keys: [k], n: R(3, 6) }, { keys: [], n: 3 }, { keys: [k], n: 2 }]; break; }
        default: { // a built-in fun move (dance / spin / spam), judged like any idea
          const kindF = U.pick(ks.dirs.length >= 2 ? ['dance', 'spam', 'spin'] : ks.acts.length ? ['spam'] : ks.look.length ? ['spin'] : []);
          if (!kindF) return null;
          let idea = this.S.ideas.find((i) => i.kind === 'fun' && i.fun === kindF);
          if (!idea) { idea = this.newIdea('fun', [], sit, 'me'); idea.fun = kindF; idea.name = 'the ' + U.pick(ADJ) + ' ' + { dance: 'Dance', spam: 'Button Party', spin: 'Spin' }[kindF]; idea.desc = kindF; }
          return idea;
        }
      }
      if (!steps.length) return null;
      const idea = this.newIdea(kind, steps, sit, 'me');
      return idea;
    }
    newIdea(kind, steps, situ, from) {
      return { id: U.uid().slice(0, 8), name: this.name(kind), kind, steps, situ, from, desc: this.describe(steps), tries: 0, score: 0, joy: 0, status: 'new', t: Date.now() };
    }
    mutate(p, ks) {
      const steps = JSON.parse(JSON.stringify((p.steps || []).map((st) => Object.assign({}, st, { mouse: st.mouse && st.mouse.t === 'btn' ? null : st.mouse }))));
      if (!steps.length) return null;
      const B = this.B, how = U.pick(['time', 'time', 'swap', 'mirror', 'add']);
      if (how === 'time') steps.forEach((st) => { st.n = U.clamp(Math.round((st.n || 1) * U.rand(0.5, 1.7)), 1, 30); });
      else if (how === 'swap' && ks.all.length) { const st = U.pick(steps.filter((x) => x.keys && x.keys.length) || []); if (st) st.keys[U.randi(0, st.keys.length - 1)] = U.pick(ks.all); }
      else if (how === 'mirror') {
        let changed = false;
        steps.forEach((st) => { (st.keys || []).forEach((k, i) => { if (!B.isMoveKey(k)) return; const d = B.moveDir(k); const o = ks.dirs.find((c) => { const d2 = B.moveDir(c); return d2[0] * d[0] + d2[1] * d[1] < -0.3; }); if (o) { st.keys[i] = o; changed = true; } }); if (st.mouse && st.mouse.t === 'look') { st.mouse.dx = -st.mouse.dx; st.id = st.id === 'm:look-l' ? 'm:look-r' : st.id === 'm:look-r' ? 'm:look-l' : st.id; changed = true; } });
        if (!changed) return null;
      } else if (how === 'add' && ks.all.length) steps.push({ keys: [U.pick(ks.all)], n: U.randi(2, 6) });
      const c = this.newIdea(p.kind, steps, p.situ, 'mutation');
      c.parent = p.id;
      c.name = p.name.replace(/\s+(2\.0|Turbo|Reverse|Remix|Deluxe)$/, '') + ' ' + U.pick(how === 'mirror' ? ['Reverse'] : ['2.0', 'Turbo', 'Remix', 'Deluxe']);
      return c;
    }
    tryIdea(idea, obs, now, from) {
      const s = this.s, B = this.B;
      let ok;
      if (idea.kind === 'fun' && idea.fun) { const r = B.startRoutine(idea.fun); ok = !!B.routine; if (ok) { B.routine.ideaId = idea.id; B.routine.why = r.why; B.routine.name = idea.name; } }
      else {
        // buttons are remembered by their text: find the real one on screen right now
        const live = Object.assign({}, idea, { steps: (idea.steps || []).map((st) => {
          if (!st.mouse || st.mouse.t !== 'btn') return st;
          const b = (obs.buttons || []).find((x) => x.el.isConnected && x.text === st.mouse.text);
          return b ? Object.assign({}, st, { mouse: { t: 'btn', el: b.el, text: b.text } }) : { keys: [], n: 1 };
        }) });
        ok = B.runIdea(live);
      }
      if (!ok) { this.nextCreate = now + 3000; return false; }
      s.hands.releaseAll();
      if (this.S.ideas.indexOf(idea) < 0) {
        this.S.ideas.push(idea);
        if (this.S.ideas.length > 40) { const i = this.S.ideas.findIndex((x) => x.status === 'dropped') >= 0 ? this.S.ideas.findIndex((x) => x.status === 'dropped') : this.S.ideas.findIndex((x) => x.status !== 'keeper'); if (i >= 0) this.S.ideas.splice(i, 1); }
      }
      this.exp = { idea, t0: now, until: 0, r: 0, dt: 0, joy: 0, big: 0, dmg: 0, died: 0, nov0: s.ep.novel, static0: obs.staticTime || 0, hash0: B.hashState(obs), rate0: this.rEMA };
      if (idea.kind === 'fun' && this.sayOk(now)) s.voice.say('fun', {}, 1);
      else if (idea.status === 'new' && this.sayOk(now)) s.voice.say(from === 'coach' ? 'coachIdeaYes' : 'ideaStart', { idea: idea.name, desc: idea.desc }, 1);
      s.reason = (idea.kind === 'fun' ? '😜 ' : '💡 ') + "trying " + (idea.status === 'keeper' ? 'my move ' : 'my idea ') + idea.name + (idea.desc && idea.kind !== 'fun' ? ' (' + idea.desc + ')' : '');
      this.nextCreate = now + U.rand(5000, 12000) * (1.4 - this.t.curiosity * 0.6);
      return true;
    }
    // did the idea work? (more points than usual, something new, got unstuck, a trophy, felt good...)
    checkExperiment(obs, events, now) {
      const X = this.exp;
      if (!X) return;
      const s = this.s, B = this.B;
      for (const e of events) {
        if (e.type === 'trophy' || e.type === 'win') X.big += 3;
        else if (e.type === 'milestone' || e.type === 'progress' || e.type === 'highscore') X.big += 1;
        else if (e.type === 'damage') X.dmg += 1;
        else if (e.type === 'gameOver' || e.type === 'healthZero' || (e.type === 'death' && e.soft)) X.died += 1;
      }
      const running = B.routine && B.routine.ideaId === X.idea.id;
      if (running) return;
      if (!X.until) { X.until = now + 1500; return; }
      if (now < X.until) return;
      this.exp = null;
      const I = X.idea;
      const sec = Math.max(0.5, X.dt);
      const unstuck = X.static0 > 4 && ((obs.staticTime || 0) < 1 || B.hashState(obs) !== X.hash0) ? 1 : 0;
      const outcome = U.clamp(2 * (X.r / sec - X.rate0) + 0.05 * (s.ep.novel - X.nov0) + 1.5 * X.joy + X.big + unstuck - 0.5 * X.dmg - 1.5 * X.died, -3, 4);
      I.score = I.tries ? 0.7 * I.score + 0.3 * outcome : outcome;
      I.joy = (I.joy || 0) * 0.7 + X.joy * 0.3;
      I.tries++;
      if (unstuck) I.unstuck = (I.unstuck || 0) + 1;
      const was = I.status;
      if (I.tries >= 2 && I.score > 0.35) I.status = 'keeper';
      else if (I.tries >= 3 && I.score < -0.1) I.status = 'dropped';
      else if (I.status === 'new' || (I.status === 'keeper' && I.score < 0.1)) I.status = 'meh';
      // likes: inventing itself can become something it enjoys
      const tg = 'ideakind:' + I.kind, L = this.S.likes[tg] || (this.S.likes[tg] = { v: 0, n: 0, fat: 0, said: 1 });
      L.v = U.clamp(L.v + 0.15 * U.clamp(outcome, -1, 1.5), -1, 1); L.n += 1;
      if (I.status === 'keeper' && was !== 'keeper') {
        s.heart.react([{ type: 'ideaWorked' }], {});
        if (I.kind !== 'fun') s.voice.say('ideaWorked', { idea: I.name, desc: I.desc }, 2);
        const f = this.S.flags || (this.S.flags = {});
        f.ideaDiary = (f.ideaDiary || 0) + 1;
        if (I.kind !== 'fun' && f.ideaDiary <= 6) s.diary('idea', 'Invented ' + I.name + ' in ' + s.game.name + ': ' + I.desc + '. It works! 💡');
        B.addMemory('idea', 'inventing ' + I.name, 0.7);
        // a mutation that beats its parent replaces it
        if (I.parent) { const P = this.S.ideas.find((x) => x.id === I.parent); if (P && I.score > P.score + 0.2 && P.status === 'keeper') P.status = 'meh'; }
        // one-chord moves become a real move the brain can pick any time
        if (I.steps.length === 1 && I.steps[0].keys && I.steps[0].keys.length >= 2) {
          const id = 'k:' + I.steps[0].keys.join('+');
          const slot = B.ensureAction(id, { keys: I.steps[0].keys.slice(), label: I.name.replace(/^the /, '') }, true);
          if (slot >= 0) { B.actions[slot].fromIdea = true; B.actions[slot].label = I.name.replace(/^the /, ''); }
        }
      } else if (I.status === 'dropped' && was !== 'dropped') {
        s.heart.react([{ type: 'ideaFailed' }], {});
        if (I.kind !== 'fun' && this.sayOk(now)) s.voice.say('ideaFailed', { idea: I.name }, 1);
      } else if (I.status === 'meh' && was === 'new' && I.kind !== 'fun' && U.chance(0.3) && this.sayOk(now)) s.voice.say('ideaMeh', { idea: I.name }, 0);
      // the coach's idea worked? then it trusts the coach's ideas a bit more (or less)
      if (this.coachIdeaFrom === I.id) { this.coachIdeaFrom = null; const S = this.S; S.coachTrust = U.clamp((S.coachTrust == null ? 0.5 : S.coachTrust) + 0.1 * Math.sign(outcome), 0, 1); }
    }
    // stuck for a while? try something creative before the old "click the middle + press Enter"
    unstick(obs, now) { return this.maybeCreate(obs, this.mods || this.s.heart.mods(false), 0.1, now, true); }
    // the coach suggests an idea - it decides itself if it likes it
    coachIdea(p) {
      if (!p || !p.steps || !p.steps.length) return;
      const s = this.s, t = this.t, e = s.heart.e, S = this.S;
      const B = this.B;
      const steps = p.steps.slice(0, 6).map((st) => {
        const keys = (st.keys || []).map((k) => (KEYS.map[k] ? k : KEYS.fromName(k))).filter(Boolean).slice(0, 3);
        return { keys, n: U.clamp(Math.round((Number(st.ms) || 300) / ((this.mods && this.mods.reaction) || 120)), 1, 30) };
      }).filter((st) => st.keys.length || st.n);
      if (!steps.length) return;
      const idea = this.newIdea('coach', steps, 'open', 'coach');
      if (p.name) idea.name = 'the ' + String(p.name).replace(/^the\s+/i, '').slice(0, 30);
      let match = 0;
      for (const st of steps) for (const k of st.keys) { const a = B.actions[B.slotOf('k:' + k)]; if (a) for (const tg of B.tagsOf(a)) match += this.like(tg); }
      const trust = S.coachTrust == null ? 0.5 : S.coachTrust;
      const stuck = (s.lastObs && s.lastObs.staticTime > 4) ? 1 : 0;
      const yes = 1.2 * match + 0.8 * (t.curiosity - 0.5) + 1.0 * (trust - 0.5) - 0.9 * (t.pride - 0.5) - 0.6 * e.mad * t.temper + 0.5 * stuck + U.rand(-0.3, 0.3) > -0.1;
      if (yes) { this.coachIdeaPending = idea; this.coachIdeaFrom = idea.id; this.nextCreate = 0; }
      else { s.voice.say('coachIdeaNo', { idea: idea.name }, 1); if (U.chance(0.5)) this.nextCreate = 0; }
      (S.coachIdeas = S.coachIdeas || []).push({ name: idea.name, desc: idea.desc, yes, t: Date.now() });
      if (S.coachIdeas.length > 12) S.coachIdeas.shift();
    }
    gameFacts(f) {
      if (!f) return;
      const F = this.S.facts;
      if (typeof f.can_win === 'boolean') F.canWinHint = f.can_win ? 1 : -1;
      if (Number.isFinite(f.trophy_total) && f.trophy_total > 0) F.trophyTotal = Math.max(F.trophyTotal || 0, Math.min(500, f.trophy_total));
    }

    /* ======================= 🎯 GOALS ======================= */
    updateFacts(obs) {
      const F = this.S.facts, B = this.B, s = this.s;
      if (obs.score != null) F.hasScore = true;
      if ((obs.readouts || []).some((r) => r.kind === 'progress')) F.seenProgress = true;
      if ((B.stats.wins || 0) > 0) F.won = true;
      const tro = B.stats.trophies;
      if (tro) F.trophyTotal = Math.max(F.trophyTotal || 0, tro.list.length);
      const tr = (obs.readouts || []).find((r) => /troph|achiev|badge/i.test(r.label) && r.max);
      if (tr) F.trophyTotal = Math.max(F.trophyTotal || 0, tr.max);
      if ((obs.buttons || []).some((b) => /troph|achiev/i.test(b.text))) F.trophyBtn = true;
      // "Trophies (3/31)" / "Achievements 4 / 12" -> how many exist
      for (const t of (this.s.senses.textBits || []).map((b) => b.s).concat((obs.buttons || []).map((b) => b.text))) {
        const m = /(troph|achiev|badge)\w*\s*\(?\s*(\d+)\s*\/\s*(\d+)/i.exec(t);
        if (m && +m[3] > 0 && +m[3] < 500) F.trophyTotal = Math.max(F.trophyTotal || 0, +m[3]);
      }
      F.storyN = (B.stats.storyLines || []).length;
      void s;
    }
    canWin() {
      const F = this.S.facts;
      if (F.won) return 1;
      let c = 0.5 + (F.seenProgress ? 0.2 : 0) + 0.3 * (F.canWinHint || 0);
      // a score, game overs, no levels, never won = probably an endless arcade game
      if (F.hasScore && !F.seenProgress && this.B.stats.episodes >= 2) c -= 0.2;
      if (!F.hasScore && !F.seenProgress && (F.storyN || 0) < 3 && (F.playMs || 0) > 300000) c -= 0.35; // 5 min and nothing to "win" (like AItok)
      return U.clamp(c, 0, 1);
    }
    trophyCount() { const t = this.B.stats.trophies; return t ? Object.keys(t.got || {}).length : 0; }
    wants() {
      const t = this.t, e = this.s.heart.e, F = this.S.facts, B = this.B;
      const L = (g) => this.like(g);
      const cw = this.canWin();
      const troTotal = F.trophyTotal || 0, got = this.trophyCount();
      const trophiesExist = troTotal > 0 || got > 0 || F.trophyBtn;
      const left = troTotal ? Math.max(0, troTotal - got) / troTotal : 0.5;
      const whim = () => U.rand(-0.08, 0.08) * (0.5 + t.silliness);
      const playTags = ['move', 'jump', 'act', 'combo', 'idea', 'fun'].map(L);
      return {
        beat: (F.won ? 0.12 * t.pride : cw * (0.35 + 0.3 * t.competitive + 0.25 * t.patience + 0.15 * t.optimism) + 0.2 * e.determined + 0.2 * L('win')) + whim(),
        trophies: trophiesExist && !(troTotal && got >= troTotal) ? 0.2 + 0.35 * t.pride + 0.2 * t.curiosity + 0.25 * left + (F.won ? 0.2 : 0) + 0.3 * L('trophy') + whim() : -1,
        highscore: F.hasScore ? 0.15 + 0.4 * t.competitive + 0.3 * L('points') + whim() : -1,
        explore: 0.15 + 0.4 * t.curiosity + 0.3 * e.curious + 0.4 * L('explore') - 0.4 * (this.noveltyDone ? 1 : 0) + whim(),
        story: (F.storyN || 0) >= 3 ? 0.15 + 0.35 * t.patience + 0.4 * L('story') + whim() : -1,
        fun: 0.15 + 0.45 * t.silliness + 0.3 * e.bored + 0.2 * e.happy + 0.35 * (1 - cw) + 0.4 * Math.max(...playTags) + whim(),
      };
    }
    // it picks what it wants (and sticks with it unless something else REALLY calls to it)
    chooseGoal(reason) {
      const s = this.s, G = this.S.goals, t = this.t, B = this.B;
      const ep = B.stats.episodes;
      const W = this.wants();
      for (const k in G.resting) { if (ep < G.resting[k]) W[k] = -1; else { delete G.resting[k]; W[k] += 0.15 * s.heart.e.determined; this.comeback = k; } }
      for (const k of G.done) if (k !== 'trophies' && k !== 'highscore') W[k] = Math.min(W[k], k === 'fun' ? 0.2 : 0.1);
      let best = 'fun', bv = -Infinity;
      for (const k in W) if (W[k] > bv) { bv = W[k]; best = k; }
      const cur = G.cur;
      if (cur && cur.status === 'active') {
        if (best === cur.kind) { cur.want = bv; return; }
        if (bv < (W[cur.kind] == null ? -1 : W[cur.kind]) + 0.15 + 0.25 * t.patience) return; // keep my goal
      }
      const prev = cur && cur.status === 'active' ? cur.kind : null;
      G.cur = this.newGoal(best, bv, reason);
      G.log.push({ t: Date.now(), kind: best, what: prev ? 'switched from ' + prev : 'picked' });
      if (G.log.length > 30) G.log.shift();
      const vars = this.goalVars(G.cur);
      if (this.comeback === best) { s.voice.say('goalBack', vars, 2); this.comeback = null; }
      else if (prev) s.voice.say('goalSwitch', vars, 2);
      else s.voice.say(best === 'fun' && this.canWin() < 0.35 ? 'goalNoWin' : 'goal_' + best, vars, 2);
      s.heart.react([{ type: 'goalPicked' }], {});
      const f = this.S.flags || (this.S.flags = {});
      f.goalDiary = (f.goalDiary || 0) + 1;
      if (f.goalDiary <= 8) s.diary('goal', 'My goal in ' + s.game.name + ': ' + GOAL_WORD[best] + ' ' + GOAL_ICON[best] + ' (' + G.cur.why + ')');
      s.app.mindUpdated && s.app.mindUpdated(s);
    }
    newGoal(kind, want, reason) {
      const t = this.t, B = this.B, F = this.S.facts;
      const g = { kind, want, status: 'active', since: Date.now(), ep0: B.stats.episodes, frust: 0, why: this.whyGoal(kind), wins0: B.stats.wins || 0, got0: this.trophyCount(), best0: B.stats.best, story0: (B.stats.storyLines || []).length, joy: 0, playMs0: F.playMs || 0, reason };
      if (kind === 'trophies') {
        const total = F.trophyTotal || 0, got = g.got0;
        g.target = total ? Math.min(total, Math.max(got + 1, Math.round(total * (0.15 + 0.55 * t.pride * t.patience)))) : got + 1 + Math.round(2 * t.pride);
      }
      if (kind === 'highscore') g.target = B.stats.best ? Math.ceil(B.stats.best * (1.1 + 0.3 * t.competitive)) : 1;
      return g;
    }
    whyGoal(kind) {
      const t = this.t, F = this.S.facts, top = (k) => t[k] > 0.6;
      switch (kind) {
        case 'beat': return top('competitive') ? "I'm competitive and this game can be beaten" : top('patience') ? "I'm patient, I'll get there" : 'I wanna see the ending';
        case 'trophies': return F.won ? 'I beat it, so now: trophies' : top('pride') ? 'I like showing off my trophies' : 'there are trophies to get';
        case 'highscore': return top('competitive') ? 'I always want a higher score' : 'I can do better than ' + U.fmt(this.B.stats.best);
        case 'explore': return top('curiosity') ? "I'm curious about everything" : 'I want to see what else is here';
        case 'story': return 'I want to know how the story ends';
        default: return this.canWin() < 0.35 ? "this game doesn't really have an ending" : top('silliness') ? "I'm silly, I just wanna mess around" : 'just vibing';
      }
    }
    goalVars(g) {
      return { goal: GOAL_WORD[g.kind] + ' ' + GOAL_ICON[g.kind], game: this.s.game.name, n: g.target ? g.target - g.got0 : 3, best: U.fmt(this.B.stats.best), why: g.why };
    }
    progress(g) {
      const B = this.B;
      switch (g.kind) {
        case 'beat': return (B.stats.wins || 0) > g.wins0 ? 1 : this.S.facts.seenProgress ? 0.3 : 0;
        case 'trophies': return g.target ? U.clamp((this.trophyCount() - g.got0) / Math.max(1, g.target - g.got0), 0, 1) : 0;
        case 'highscore': return g.target ? U.clamp((B.stats.best || 0) / g.target, 0, 1) : 0;
        case 'explore': return U.clamp((B.stats.episodes - g.ep0) / 4 + (this.noveltyDone ? 1 : 0), 0, 1);
        case 'story': return U.clamp(((B.stats.storyLines || []).length - g.story0) / 20, 0, 1) * 0.9 + ((B.stats.wins || 0) > g.wins0 ? 0.1 : 0);
        case 'fun': return U.clamp(((this.S.facts.playMs || 0) - g.playMs0) / 300000, 0, 1);
        default: return 0;
      }
    }
    goalTick(now) {
      const G = this.S.goals, s = this.s;
      if (!G.cur || G.cur.status !== 'active') {
        // first time in a game: figure it out a bit before deciding what it wants
        if ((this.S.facts.playMs || 0) > (this.B.stats.episodes ? 5000 : 45000) || this.B.stats.episodes > 0) this.chooseGoal('start');
        return;
      }
      const g = G.cur;
      g.joy = (g.joy || 0) * 0.98 + this.joyBase * 0.02;
      const p = this.progress(g);
      const done = g.kind === 'beat' ? p >= 1 : g.kind === 'story' ? p >= 0.99 : g.kind === 'fun' ? p >= 1 && g.joy > -0.001 : p >= 1;
      if (done) return this.goalDone(g);
      if (now - (this.lastChoose || 0) > 90000) { this.lastChoose = now; this.chooseGoal('check'); }
    }
    goalDone(g) {
      const s = this.s, G = this.S.goals;
      g.status = 'done'; g.doneAt = Date.now();
      if (G.done.indexOf(g.kind) < 0) G.done.push(g.kind);
      G.log.push({ t: Date.now(), kind: g.kind, what: 'done' }); if (G.log.length > 30) G.log.shift();
      this.goalsDoneHere++;
      s.heart.react([{ type: 'goalDone' }], {});
      s.voice.say('goalDone', this.goalVars(g), 3);
      s.diary('goal', 'GOAL DONE in ' + s.game.name + ': ' + GOAL_WORD[g.kind] + ' ' + GOAL_ICON[g.kind] + ' ✅');
      this.B.addMemory('goal', 'reaching my goal: ' + GOAL_WORD[g.kind], 0.9);
      const gs = AIP.squad.gameStats(s.ai, s.game.id);
      gs.goalsDone = (gs.goalsDone || 0) + 1;
      if (g.kind === 'beat') gs.beaten = true;
      G.cur = null;
      this.chooseGoal('after');
      s.app.mindUpdated && s.app.mindUpdated(s);
    }
    // after every try: frustration, giving up for a while, or deciding it's done with the game
    onEpisodeEnd(kind, info) {
      const G = this.S.goals, t = this.t, s = this.s, e = s.heart.e;
      this.saveTaste();
      const g = G.cur;
      if (g && g.status === 'active') {
        if (info.newBest || kind === 'win') g.frust *= 0.4;
        else if (kind === 'death') g.frust += 0.08 * (1.3 - t.optimism) * (1 + 0.3 * Math.max(0, (s.heart.deaths || []).length - 1));
        else g.frust += 0.03;
        if (g.kind === 'explore' && info.novel != null) { this.novelHist = (this.novelHist || []).concat(info.novel).slice(-4); if (this.novelHist.length >= 3 && this.novelHist.every((n) => n < 4)) this.noveltyDone = true; }
        const limit = 0.45 + 0.6 * t.patience + 0.3 * e.determined;
        if (g.frust > limit && g.kind !== 'fun') {
          g.status = 'resting';
          G.resting[g.kind] = this.B.stats.episodes + U.randi(3, 10);
          G.log.push({ t: Date.now(), kind: g.kind, what: 'taking a break' }); if (G.log.length > 30) G.log.shift();
          s.heart.react([{ type: 'goalGiveUp' }], {});
          s.voice.say('goalGiveUp', this.goalVars(g), 2);
          s.diary('goal', 'Taking a break from "' + GOAL_WORD[g.kind] + '" in ' + s.game.name + '. Too hard right now 😮‍💨');
          G.cur = null;
          this.chooseGoal('gave up');
        } else this.chooseGoal('episode');
      } else this.chooseGoal('episode');
      // done with this game? (its own choice: it did what it wanted and now it's bored of it)
      const W = this.wants();
      const maxWant = Math.max(...Object.values(W));
      const playedMin = (performance.now() - this.sessT0) / 60000;
      const boredLong = this.boredSince && performance.now() - this.boredSince > 120000;
      if (this.goalsDoneHere > 0 && playedMin > 3 && (maxWant < 0.25 + 0.2 * (1 - e.bored) || boredLong) && e.bored > 0.45 && !s.keepGoingAt) return 'stop';
      return null;
    }
    // you asked it to keep going - it decides
    askContinue() {
      const s = this.s, e = s.heart.e;
      const fav = this.favorite();
      const yes = e.happy + (fav ? this.like(fav) : 0) + 0.3 * this.t.patience - 0.5 * e.bored + U.rand(-0.2, 0.3) > 0.35;
      s.voice.say(yes ? 'keepGoingYes' : 'keepGoingNo', { act: fav ? this.wordsFor(fav) : 'it' }, 3);
      return yes;
    }

    /* ======================= words for the UI / chat / coach ======================= */
    topLikes(n, sign) {
      return Object.keys(this.S.likes).filter((k) => this.S.likes[k].n > 4 && !/^ideakind:/.test(k) && (sign > 0 ? this.S.likes[k].v > 0.15 : this.S.likes[k].v < -0.15))
        .sort((a, b) => sign * (this.S.likes[b].v - this.S.likes[a].v)).slice(0, n);
    }
    goalLabel() { const g = this.S.goals.cur; if (!g) return null; return GOAL_ICON[g.kind] + ' ' + GOAL_WORD[g.kind] + (g.kind === 'trophies' && g.target ? ' ' + (this.trophyCount()) + '/' + g.target : ''); }
    describeLikes() {
      const yes = this.topLikes(3, 1).map((k) => this.wordsFor(k)), no = this.topLikes(2, -1).map((k) => this.wordsFor(k));
      if (!yes.length && !no.length) return "I'm still figuring out what I like here 🤔";
      return (yes.length ? 'I like ' + yes.join(', ') + ' 💖' : '') + (no.length ? (yes.length ? '. ' : '') + "I don't like " + no.join(', ') + ' 😒' : '');
    }
    describeGoal() {
      const g = this.S.goals.cur;
      if (!g) return "I haven't picked a goal yet. Still figuring this game out 🤔";
      return 'My goal: ' + GOAL_WORD[g.kind] + ' ' + GOAL_ICON[g.kind] + ', because ' + g.why + '. ' + Math.round(this.progress(g) * 100) + '% there.';
    }
    keepers() { return this.S.ideas.filter((i) => i.status === 'keeper' && i.kind !== 'fun'); }
    forCoach() {
      const g = this.S.goals.cur;
      const lines = [];
      lines.push('ITS OWN GOAL (it chose it, respect it): ' + (g ? GOAL_WORD[g.kind] + ' - because ' + g.why + (g.kind === 'trophies' && g.target ? ' (wants ' + g.target + ', has ' + this.trophyCount() + ')' : '') : 'not picked yet'));
      const yes = this.topLikes(4, 1).map((k) => this.wordsFor(k)), no = this.topLikes(3, -1).map((k) => this.wordsFor(k));
      lines.push('IT LIKES: ' + (yes.join(', ') || '?') + '. DISLIKES: ' + (no.join(', ') || '?'));
      const k = this.keepers().slice(-4).map((i) => i.name + ' = ' + i.desc);
      if (k.length) lines.push('MOVES IT INVENTED (they work): ' + k.join('; '));
      return lines.join('\n');
    }
  }
  Mind.GOAL_ICON = GOAL_ICON; Mind.GOAL_WORD = GOAL_WORD;
  return Mind;
})();
