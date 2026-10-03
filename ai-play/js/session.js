/* AI Play - a PLAY SESSION: one AI playing one game. This is the loop that ties it all together:
 *   eyes (senses) -> feelings (heart) -> brain picks a move -> hands press it -> voice talks
 * plus: episodes (try #1, #2...), dying, dreaming, restarting, saving, watching you play.
 */
'use strict';

AIP.Session = (function () {
  const U = AIP.util;
  const RETRY_RX = /\b(retry|try again|again|restart|play again|replay|continue|new game|play|start|ok|okay|next|resume|respawn)\b/i;

  class Session {
    constructor(app, ai, game, heart) {
      this.app = app; this.ai = ai; this.game = game; this.heart = heart;
      this.voice = new AIP.Voice(ai, heart, (text, mood) => app.chat('ai', text, mood, ai));
      this.senses = new AIP.Senses();
      this.hands = null;
      this.brain = new AIP.Brain(ai.id, game);
      this.mode = 'ai';
      this.phase = 'loading';
      this.dead = false;
      this.user = { keys: new Set(), clicked: false, look: { dx: 0, dy: 0 }, at: 0 };
      this.scoreScale = 0;
      this.motionEMA = 0.003;
      this.reason = 'loading the game...';
      this.announced = {};
      this.lastSave = performance.now();
      this.lastUI = 0;
      this.lastLearnUI = 0;
      this.thumbDone = !!game.thumb;
      this.pendingFb = 0;
      this.errorsShown = 0;
      this.gameStore = {};
      this.newEpisode();
    }

    newEpisode() {
      this.ep = { t0: performance.now(), maxScore: null, hadScore: false, damage: 0, novel: 0, beatBest: false, lowHealthSaid: false, lastDamageAt: -1e9, ended: false };
    }

    /* ---------------- start / load the game ---------------- */
    async start(stage, cursorEl) {
      this.stage = stage;
      this.hands = new AIP.Hands(cursorEl);
      let rec = null;
      try { rec = await AIP.db.get('brains', this.ai.id + '|' + this.game.id); } catch (e) { /* first time */ }
      if (rec) { this.brain.load(rec); this.gameStore = rec.gameSave || {}; }
      this.brain.stats.flags = this.brain.stats.flags || {};
      const gs = AIP.squad.gameStats(this.ai, this.game.id);
      // missing some internet parts from when it was added? try to grab them now (so next time works offline)
      try {
        const off = await AIP.loader.cacheExternals(this.game);
        if (off.changed) await AIP.db.put('games', this.game);
        this.netMissing = off.failed;
      } catch (e) { /* ignore */ }
      if (this.dead) return;
      await this.loadFrame();
      if (this.dead) return;
      const first = !this.brain.stats.episodes && !this.brain.stats.flags.started;
      this.heart.react([{ type: 'gameStart' }], { painMode: AIP.settings.get().painMode });
      if (first) {
        this.voice.say('start', { game: this.game.name }, 2);
        this.brain.stats.flags.started = true;
        this.diary('first', 'First time playing ' + this.game.name + '! No idea what any button does yet 🤷');
      } else this.voice.say('startAgain', { game: this.game.name, best: U.fmt(gs.best), tries: (gs.tries || 0) + 1 }, 2);
      this.rivalCheckAt = performance.now() + 6000;
      this.tick();
    }

    async loadFrame() {
      this.phase = 'loading';
      if (this.built) this.built.revoke();
      if (this.frame) this.frame.remove();
      let built;
      try {
        built = await AIP.loader.build(this.game, { id: this.ai.id + '-' + this.game.id.slice(-6), store: this.gameStore });
      } catch (e) {
        this.voice.say('loadFail', { err: e.message }, 3);
        this.phase = 'broken';
        return;
      }
      if (this.dead) { built.revoke(); return; }
      this.built = built;
      const f = document.createElement('iframe');
      f.className = 'game-frame';
      f.title = this.game.name;
      f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-pointer-lock');
      f.setAttribute('allow', 'autoplay; gamepad');
      this.frame = f;
      const loaded = new Promise((res) => { f.onload = res; setTimeout(res, 8000); });
      f.srcdoc = built.html;
      this.stage.insertBefore(f, this.stage.firstChild);
      await loaded;
      if (this.dead) return;
      let win;
      try { win = f.contentWindow; void win.document; } catch (e) { this.voice.say('loadFail', { err: "the game is blocking me 😢" }, 3); this.phase = 'broken'; return; }
      this.senses.attach(f);
      this.hands.attach(win);
      this.listenToPlayer(win);
      try { if (win.__aip) win.__aip.realLock = this.mode === 'watch'; } catch (e) { /* ignore */ }
      this.phase = 'play';
      this.loadedAt = performance.now();
      this.newEpisode();
    }

    // The player's REAL keyboard + mouse inside the game (used when you play and it watches).
    listenToPlayer(win) {
      const u = this.user;
      const opt = true;
      win.addEventListener('keydown', (e) => { if (e.isTrusted) { u.keys.add(e.code); u.at = performance.now(); } }, opt);
      win.addEventListener('keyup', (e) => { if (e.isTrusted) u.keys.delete(e.code); }, opt);
      win.addEventListener('mousedown', (e) => { if (e.isTrusted) { u.clicked = true; u.at = performance.now(); } }, opt);
      win.addEventListener('mousemove', (e) => { if (e.isTrusted) { u.look.dx += e.movementX || 0; u.look.dy += e.movementY || 0; } }, opt);
      win.addEventListener('blur', () => u.keys.clear());
    }

    async reloadGame(why) {
      this.saveGameStore();
      this.hands.releaseAll();
      if (why) this.voice.say('stuck', {}, 2);
      await this.loadFrame();
    }
    saveGameStore() {
      try { const a = this.frame && this.frame.contentWindow.__aip; if (a) this.gameStore = JSON.parse(JSON.stringify(a.store)); } catch (e) { /* frame gone */ }
    }

    /* ---------------- the loop ---------------- */
    tick() {
      if (this.dead) return;
      const t0 = performance.now();
      try { this.step(); } catch (e) { console.error('AI Play step error', e); }
      const painMode = AIP.settings.get().painMode;
      const mods = this.heart.mods(painMode);
      const delay = this.phase === 'play' && this.mode === 'ai' ? mods.reaction * U.rand(0.85, 1.15) : 110;
      this.timer = setTimeout(() => this.tick(), Math.max(25, delay - (performance.now() - t0)));
    }

    step() {
      const now = performance.now();
      if (this.phase === 'loading' || this.phase === 'broken' || this.phase === 'dreaming') { this.ui(now, null); return; }
      const st = AIP.settings.get();
      const obs = this.senses.sense();
      this.hands.tick();
      const dt = obs.dt || 0.1;
      if (obs.errors) this.onErrors(obs.errors, now);
      if (!obs.ok) { this.ui(now, obs); return; }
      if (this.mode === 'ai') { this.ai.stats.playMs = (this.ai.stats.playMs || 0) + dt * 1000; AIP.squad.gameStats(this.ai, this.game.id).timeMs += dt * 1000; }
      this.motionEMA += ((obs.motionAmt || 0) - this.motionEMA) * 0.05;
      // a menu = a big "Play"/"Start" button is showing (even if the background is animated),
      // or start-ish buttons on a frozen screen / with no score or health on screen
      const startBtn = obs.buttons && obs.buttons.some((b) => b.prio >= 1 && /\b(play|start|begin|new game|continue|resume|retry|try again|play again|restart)\b/i.test(b.text));
      obs.menuish = !!(startBtn || (obs.buttons && obs.buttons.some((b) => b.prio >= 1) && (obs.staticTime > 0.6 || !(obs.readouts && obs.readouts.some((r) => r.kind === 'score' || r.kind === 'health')))));

      this.announceReadouts(obs);
      const events = this.digest(obs);
      const ctx = {
        painMode: st.painMode, healthFrac: obs.hp || obs.lives ? obs.healthFrac : null, novelty: this.brain.noveltyNow,
        staticTime: obs.staticTime, bigChange: obs.changedFrac > 0.5,
        noControlsYet: now - (this.loadedAt || now) > 20000 && !Object.values(this.brain.controls).some((c) => c.status === 'useful' || c.status === 'starred'),
      };
      const feels = this.heart.react(events, ctx);
      this.heart.update(dt, ctx);
      this.talkAbout(events, feels, obs, ctx);

      if (this.phase === 'restart') { this.doRestart(obs, now); this.ui(now, obs); return; }
      if (this.mode === 'pause') { this.hands.releaseAll(); this.ui(now, obs); return; }

      const mods = this.heart.mods(st.painMode);
      let end = null;
      for (const ev of events) {
        if (ev.type === 'win') end = 'win';
        else if (!end && (ev.type === 'gameOver' || ev.type === 'healthZero')) end = 'death';
        else if (!end && ev.type === 'scoreReset' && this.ep.maxScore > 0 && now - this.ep.t0 > 3000) end = 'death';
      }
      if (!end && now - this.ep.t0 > 150000) end = 'segment';
      const reward = this.reward(obs, events, mods, st.painMode);
      const userNow = this.mode === 'watch' ? this.userSnapshot() : null;
      const decision = this.brain.step(obs, reward, !!end, mods, { mx: this.hands.mx, my: this.hands.my, user: userNow });
      this.reason = decision.reason;
      this.lastObs = obs;
      if (this.mode === 'ai' && !end) {
        this.checkPause(obs, decision, now);
        this.apply(decision);
        this.maybeHaveFun(obs, mods, dt, now);
      }
      if (this.mode === 'watch' && userNow && userNow.keys.size && U.chance(0.02)) {
        const k = [...userNow.keys][0];
        this.voice.say('watchLearn', { key: AIP.KEYS.label(k) }, 0);
      }
      this.handleNews();
      this.stuckCheck(obs, now);
      if (!this.thumbDone && now - (this.loadedAt || now) > 7000 && this.mode === 'ai') this.captureThumb();
      if (now > (this.rivalCheckAt || Infinity)) { this.rivalCheckAt = Infinity; this.rivalHello(); }
      if (now - this.lastSave > 30000) { this.lastSave = now; this.persist(); }
      if (end) this.endEpisode(end, obs);
      this.ui(now, obs);
    }

    // Raw eye events -> richer events (points size, lost a life, new high score...)
    digest(obs) {
      const ev = obs.events.slice();
      const out = [];
      const best = this.brain.stats.best;
      for (const e of ev) {
        if (e.type === 'score') {
          this.scoreScale = this.scoreScale ? this.scoreScale * 0.9 + e.delta * 0.1 : e.delta;
          e.size = U.clamp(e.delta / (this.scoreScale * 2), 0.05, 1);
        }
        if (e.type === 'damage') {
          this.ep.damage += e.amount; this.ep.lastDamageAt = performance.now();
          if (/live|heart|life/i.test(e.label || '') && e.left > 0) out.push({ type: 'death', soft: true });
        }
        out.push(e);
      }
      if (obs.score != null) {
        this.ep.hadScore = true;
        if (this.ep.maxScore == null || obs.score > this.ep.maxScore) this.ep.maxScore = obs.score;
        if (best != null && best > 0 && obs.score > best && !this.ep.beatBest && this.mode === 'ai') {
          this.ep.beatBest = true;
          out.push({ type: 'highscore' });
        }
      }
      if (this.brain.noveltyNow >= 0.99) this.ep.novel++;
      if (this.pendingFb) out.push({ type: this.pendingFb > 0 ? 'thumbUp' : 'thumbDown' });
      return out;
    }

    reward(obs, events, mods, painMode) {
      let r = 0;
      for (const e of events) {
        switch (e.type) {
          case 'score': r += U.clamp(e.delta / Math.max(1e-6, this.scoreScale), 0.1, 1.5); break;
          case 'progress': r += 0.8; break;
          case 'scoreLoss': r -= 0.3; break;
          case 'damage': r -= (0.35 + 0.65 * e.amount) * (painMode ? 1.3 : 1); break;
          case 'flash': if (!obs.hp && !obs.lives) r -= 0.25; break;
          case 'gameOver': case 'healthZero': r -= 1; break;
          case 'win': r += 2; break;
          default: break;
        }
      }
      r += 0.07 * mods.curiosity * (this.brain.noveltyNow || 0);
      if (obs.staticTime > 3) r -= 0.02;
      if (this.pendingFb) { r += this.pendingFb; this.brain.retroReward(this.pendingFb * 0.6); this.pendingFb = 0; }
      return U.clamp(r, -2, 2.5);
    }

    apply(d) {
      const h = this.hands;
      h.setKeys(d.keys);
      const m = d.mouse;
      if (this.holding && !(m && m.t === 'hold')) { h.mouseUp(); this.holding = false; }
      if (m) {
        if (m.t === 'click') h.click();
        else if (m.t === 'hold') { h.mouseDownNow(); this.holding = true; }
        else if (m.t === 'look') h.look(m.dx * U.rand(0.7, 1.3), m.dy * U.rand(0.7, 1.3));
        else if (m.t === 'goto') h.moveTo(m.x, m.y);
        else if (m.t === 'btn' && m.el) h.clickElement(m.el);
      }
      this.lastKeys = d.keys;
    }

    // Did that key just PAUSE the game? Press it again to unpause, and remember to avoid it.
    checkPause(obs, d, now) {
      const pc = this.pauseCheck;
      if (pc) {
        if (now - pc.t > 1300) {
          if ((obs.motionAmt || 0) > 0.0015 && !obs.gameOverVisible && !pc.over && this.phase === 'play' && now - this.ep.t0 > now - pc.t) {
            const c = this.brain.keyCtl(pc.code);
            c.pause += 2; c.tries = Math.max(c.tries, 2);
            this.brain.judge(pc.code, c);
          }
          this.pauseCheck = null;
        }
        if (obs.gameOverVisible || obs.events.some((e) => /gameOver|healthZero|death|scoreReset/.test(e.type))) pc.over = true;
        return;
      }
      const f = this.freshKey;
      const died = obs.gameOverVisible || obs.events.some((e) => /gameOver|healthZero|damage|death/.test(e.type)) || now - this.ep.lastDamageAt < 2500;
      if (f && !died && this.motionEMA > 0.004 && (obs.motionAmt || 0) < 0.0006 && now - f.t < 600) {
        this.pauseCheck = { code: f.code, t: now };
        this.hands.tap(f.code);
      }
      const prevKeys = this.lastKeys || [];
      const fresh = (d.keys || []).filter((k) => prevKeys.indexOf(k) < 0);
      this.freshKey = fresh.length === 1 ? { code: fresh[0], t: now } : null;
    }

    maybeHaveFun(obs, mods, dt, now) {
      if (this.brain.routine || mods.fun < 0.35) return;
      if (now - this.ep.lastDamageAt < 4000 || (obs.healthFrac != null && obs.healthFrac < 0.5)) return;
      if (!U.chance(mods.fun * dt * 0.035)) return;
      const r = this.brain.startRoutine(U.pick(['dance', 'spam', 'spin', 'wiggle']));
      this.voice.say('fun', {}, 1);
      this.reason = r.why;
    }

    stuckCheck(obs, now) {
      if (this.mode !== 'ai' || this.phase !== 'play') return;
      if (obs.staticTime < 1) { this.stuckSaid = false; return; }
      if (obs.staticTime > 12 && !this.stuckSaid) {
        this.stuckSaid = true;
        this.heart.react([{ type: 'stuck' }], { painMode: AIP.settings.get().painMode });
        this.voice.say('stuck', {}, 2);
        this.hands.clickAt(0.5, 0.5);
        setTimeout(() => !this.dead && this.hands.tap('Enter'), 400);
        setTimeout(() => !this.dead && this.hands.tap('Space'), 800);
      }
      if (obs.staticTime > 35) { this.senses.staticTime = 0; this.reloadGame(true); }
    }

    /* ---------------- talking about what happened ---------------- */
    talkAbout(events, feels, obs, ctx) {
      const v = this.voice;
      const vars = this.vars(obs);
      for (const f of feels) {
        if (f.kind === 'pain') {
          v.say(f.amount > 0.6 ? 'painBig' : 'pain', vars, 3);
          if (!this.brain.stats.flags.firstPain) { this.brain.stats.flags.firstPain = true; this.diary('pain', 'First time getting hurt in ' + this.game.name + '. It hurt. A LOT. 🤕'); }
          this.brain.addMemory('pain', 'getting hurt in ' + this.game.name, 0.6 + f.amount * 0.4);
        } else if (f.kind === 'damage') v.say('damage', vars, 1);
        else if (f.kind === 'rage') { v.say('rage', Object.assign({ n: f.n }, vars), 3); this.diary('rage', 'Got SO mad at ' + this.game.name + '. Died ' + f.n + ' times in a minute 😡'); this.brain.addMemory('rage', 'raging at ' + this.game.name, 0.8); }
        else if (f.kind === 'streak') v.say('streak', Object.assign({ n: f.n }, vars), 2);
      }
      for (const e of events) {
        if (e.type === 'score') {
          if (!this.brain.stats.flags.firstPoints && this.mode === 'ai') {
            this.brain.stats.flags.firstPoints = true;
            this.diary('points', 'Got my first points ever in ' + this.game.name + '! (' + U.fmt(obs.score) + ') 🤑');
          }
          v.say(e.size > 0.7 ? 'bigScore' : 'score', Object.assign({ n: U.fmt(e.delta) }, vars), e.size > 0.7 ? 1 : 0);
          if (e.size > 0.6) this.brain.addMemory('score', 'getting ' + U.fmt(e.delta) + ' points at once', 0.5 + e.size * 0.3);
        }
        if (e.type === 'highscore') {
          v.say('highScore', vars, 2);
          this.brain.addMemory('best', 'beating my high score in ' + this.game.name, 0.85);
        }
        if (e.type === 'death' && e.soft) this.deathLine(vars);
      }
      if (ctx.healthFrac != null && ctx.healthFrac < 0.34 && ctx.healthFrac > 0 && !this.ep.lowHealthSaid) { this.ep.lowHealthSaid = true; v.say('lowHealth', vars, 2); }
      // just chatting
      const t = this.ai.traits;
      if (this.phase === 'play' && U.chance((obs.dt || 0.1) * (0.015 + 0.05 * t.chattiness))) this.idleTalk(vars);
    }
    deathLine(vars) {
      const h = this.heart, t = this.ai.traits;
      const dom = h.dominant().name;
      let kind = 'deathSad';
      if (dom === 'mad' || h.e.mad > 0.5) kind = 'deathMad';
      else if (dom === 'determined' || h.e.determined > 0.45) kind = 'deathDetermined';
      else if (t.drama < 0.35 && t.temper < 0.45) kind = 'deathChill';
      this.voice.say(kind, vars, 2);
    }
    idleTalk(vars) {
      const dom = this.heart.dominant().name;
      const map = { bored: 'bored', curious: 'curious', confused: 'confused', scared: 'scared', proud: 'proud' };
      if (map[dom]) { this.voice.say(map[dom], vars, 0); return; }
      const mems = (this.app.diaryCache || []).filter((d) => d.aiId === this.ai.id && d.gameId === this.game.id && /best|points|win/.test(d.kind));
      if (mems.length && U.chance(0.25)) {
        const m = U.pick(mems);
        this.voice.say('memory', { mem: m.text.replace(/[!.]+\s*\S*$/u, '').toLowerCase().replace(/^i /, 'I ') }, 0);
        return;
      }
      this.voice.say('idle', vars, 0);
    }
    vars(obs) {
      const gs = AIP.squad.gameStats(this.ai, this.game.id);
      const learned = this.brain.learned().filter((l) => l.good);
      const cols = obs && obs.cat ? (() => { const c = new Array(9).fill(0); for (const k of obs.cat) c[k]++; let b = 3, bv = 0; for (let i = 3; i < 9; i++) if (c[i] > bv) { bv = c[i]; b = i; } return AIP.COLORS.names[b]; })() : 'colorful';
      return {
        name: this.ai.name, game: this.game.name, score: obs && obs.score != null ? U.fmt(obs.score) : '0', best: U.fmt(gs.best),
        tries: (gs.tries || 0) + 1, color: cols, learnedLine: learned.length ? 'Things I know: ' + U.pick(learned).text : 'Still learning the basics...',
      };
    }
    announceReadouts(obs) {
      const P = this.senses.primary, R = this.senses.readouts;
      for (const k of ['score', 'hp', 'lives']) {
        const key = P[k];
        if (!key || this.announced[k] === key) continue;
        const r = R.get(key);
        if (!r) continue;
        const firstTime = !this.announced[k];
        this.announced[k] = key;
        if (firstTime && !(this.brain.stats.flags['found_' + k])) {
          this.brain.stats.flags['found_' + k] = true;
          this.voice.say(k === 'score' ? 'foundScore' : 'foundHealth', { label: r.label }, 2);
        }
      }
    }
    handleNews() {
      const n = this.brain.newsQueue.shift();
      if (!n) return;
      const painMode = AIP.settings.get().painMode;
      if (n.type === 'control') {
        const vars = { key: AIP.KEYS.label(n.code), what: n.label };
        if (n.code.indexOf('m:') === 0) vars.key = n.code === 'm:click' ? 'Clicking' : n.code === 'm:btn' ? 'Clicking buttons' : 'Moving the mouse';
        if (n.status === 'useful') {
          this.heart.react([{ type: 'learnedControl' }], { painMode });
          this.voice.say(/moves|turns/.test(n.label) ? 'ctrlMove' : 'ctrlAction', vars, 1);
          const f = this.brain.stats.flags;
          f.ctrlDiary = (f.ctrlDiary || 0) + 1;
          if (f.ctrlDiary <= 3) this.diary('control', 'Figured out that ' + vars.key + ' ' + n.label + ' in ' + this.game.name + '.');
        } else if (n.status === 'pause') {
          this.voice.say('ctrlPause', vars, 2);
          this.hands.tap(n.code);
        } else if (n.status === 'useless') { this.heart.react([{ type: 'uselessKey' }], { painMode }); this.voice.say('ctrlNothing', vars, 0); }
      } else if (n.type === 'button') this.voice.say('foundButton', { btn: n.text }, 1);
    }
    onErrors(errs, now) {
      if (this.errorsShown > 3) return;
      const real = errs.filter((e) => !/favicon|ResizeObserver/i.test(e));
      if (!real.length) return;
      this.app.gameErrors(real);
      const net = real.find((e) => /couldn't load https?:/.test(e));
      if (net && !this.saidNet) {
        this.saidNet = true;
        let host = '';
        try { host = new URL(net.replace(/^couldn't load /, '')).host; } catch (e) { /* ignore */ }
        this.voice.say('loadNet', { host: host || 'the internet' }, 3);
      } else if (now - (this.loadedAt || now) < 8000 && this.errorsShown === 0) this.voice.say('loadFail', { err: '(' + real[0].slice(0, 70) + ')' }, 3);
      this.errorsShown++;
    }

    /* ---------------- end of a try ---------------- */
    async endEpisode(kind, obs) {
      if (this.ep.ended) return;
      this.ep.ended = true;
      const ep = this.ep;
      const now = performance.now();
      const dur = (now - ep.t0) / 1000;
      this.hands.releaseAll();
      if (this.mode !== 'ai') { this.brain.endWatchEpisode(); this.newEpisode(); return; }
      // what counts as "score" for this game: real score > time survived > new stuff explored
      const gs = AIP.squad.gameStats(this.ai, this.game.id);
      const RANK = { explore: 0, time: 1, score: 2 };
      let scoreKind = ep.hadScore ? 'score' : (kind === 'death' || this.brain.stats.deaths > 0) ? 'time' : 'explore';
      if (gs.tries && RANK[gs.scoreKind] > RANK[scoreKind]) scoreKind = gs.scoreKind;
      else if (gs.tries && RANK[gs.scoreKind] < RANK[scoreKind]) { this.brain.stats.best = null; gs.best = null; }
      const score = scoreKind === 'score' ? (ep.maxScore || 0) : scoreKind === 'time' ? Math.round(dur) : ep.novel;
      const oldBest = this.brain.stats.best;
      const newBest = this.brain.endEpisode({ score, dur, died: kind === 'death', won: kind === 'win', scoreKind }) && score > 0;
      gs.tries++; gs.best = this.brain.stats.best; gs.scoreKind = scoreKind;
      if (kind === 'win') gs.wins = (gs.wins || 0) + 1;
      const painMode = AIP.settings.get().painMode;
      const vars = Object.assign(this.vars(obs), { score: U.fmt(score), tries: gs.tries });
      const evs = [];
      if (kind === 'death') evs.push({ type: 'death' });
      if (kind === 'win') evs.push({ type: 'win' });
      if (newBest && !ep.beatBest && oldBest != null) evs.push({ type: 'highscore' });
      const feels = this.heart.react(evs, { painMode, healthFrac: obs.healthFrac });
      if (kind === 'win') {
        this.voice.say('win', vars, 3);
        this.diary('win', 'I BEAT ' + this.game.name + '!!! Took me ' + gs.tries + ' tries. Best day ever 🏆');
        this.brain.addMemory('win', 'winning ' + this.game.name, 1);
      } else if (kind === 'death') {
        this.deathLine(vars);
        this.brain.addMemory('death', 'dying in ' + this.game.name + ' at ' + U.fmt(score), 0.45);
      }
      for (const f of feels) if (f.kind === 'rage') this.voice.say('rage', Object.assign({ n: f.n }, vars), 3);
      if (newBest && oldBest != null) {
        if (!ep.beatBest) this.voice.say('highScore', vars, 2);
        this.diary('best', 'New high score in ' + this.game.name + ': ' + U.fmt(score) + '! (try #' + gs.tries + ')');
      }
      if (newBest) this.checkRivalsBeaten(score, oldBest);
      this.app.episodeDone(this);
      await this.persist();
      if (this.dead) return;
      // 💤 dream
      this.phase = 'dreaming';
      this.heart.dreaming = true;
      this.reason = 'dreaming... replaying memories to learn 💤';
      this.voice.say('dreamStart', {}, 1);
      const ms = U.clamp(1400 + this.brain.replay.size() / 8, 1400, 3800) * (kind === 'segment' ? 0.6 : 1);
      const res = await this.brain.dream(ms, (rounds) => { this.dreamRounds = rounds; });
      if (this.dead) return;
      this.heart.dreaming = false;
      if (res.memory) {
        const bad = /pain|death|rage/.test(res.memory.kind);
        this.heart.react([{ type: bad ? 'nightmare' : 'goodDream' }], { painMode });
        this.voice.say(bad ? 'dreamBad' : 'dreamGood', { mem: res.memory.text }, 2);
        if (U.chance(0.12)) this.diary('dream', (bad ? 'Had a nightmare about ' : 'Had a dream about ') + res.memory.text + '.');
      } else this.voice.say('dreamNone', {}, 1);
      await this.maybeWatchRival();
      if (this.dead) return;
      this.newEpisode();
      if (kind === 'segment') { this.phase = 'play'; return; }
      this.phase = 'restart';
      this.restart = { t0: performance.now(), next: 0, i: 0 };
      this.reason = 'restarting the game 🔄';
    }

    doRestart(obs, now) {
      const R = this.restart;
      const el = now - R.t0;
      const alive = obs.healthFrac == null || !(obs.hp || obs.lives) || obs.healthFrac > 0;
      if (el > 700 && !obs.gameOverVisible && alive && (R.i > 0 || el > 1500)) {
        this.phase = 'play';
        this.newEpisode();
        this.voice.say('restart', {}, 0);
        return;
      }
      if (el > 11000) { this.reloadGame(false); return; }
      if (now < R.next) return;
      R.next = now + 900;
      const btns = (obs.buttons || []).filter((b) => RETRY_RX.test(b.text));
      const step = R.i++ % 5;
      if (step === 0 && btns.length) { this.hands.clickElement(btns[0].el); this.reason = "clicking '" + btns[0].text + "' to try again 🔄"; }
      else if (step === 1 || (step === 0 && !btns.length)) this.hands.tap('Enter');
      else if (step === 2) this.hands.tap('Space');
      else if (step === 3) this.hands.tap('KeyR');
      else this.hands.clickAt(0.5, 0.5);
    }

    /* ---------------- rivals ---------------- */
    rivals() {
      const mine = AIP.squad.gameStats(this.ai, this.game.id).best;
      return (this.app.ais || []).filter((a) => a.id !== this.ai.id)
        .map((a) => ({ a, s: a.stats && a.stats.games && a.stats.games[this.game.id] }))
        .filter((r) => r.s && r.s.best != null && (mine == null || r.s.best > mine))
        .sort((x, y) => y.s.best - x.s.best);
    }
    rivalHello() {
      const r = this.rivals()[0];
      if (!r) return;
      this.heart.react([{ type: 'rivalAhead' }], { painMode: AIP.settings.get().painMode });
      this.voice.say('rivalAhead', { rival: r.a.name, best: U.fmt(r.s.best) }, 1);
    }
    checkRivalsBeaten(score, oldBest) {
      const passed = (this.app.ais || []).filter((a) => a.id !== this.ai.id)
        .map((a) => ({ a, b: a.stats && a.stats.games && a.stats.games[this.game.id] ? a.stats.games[this.game.id].best : null }))
        .filter((r) => r.b != null && r.b < score && (oldBest == null || r.b >= oldBest))
        .sort((x, y) => y.b - x.b);
      if (!passed.length) return;
      const r = passed[0].a;
      this.heart.react([{ type: 'beatRival' }], { painMode: AIP.settings.get().painMode });
      this.voice.say('beatRival', { rival: r.name, game: this.game.name }, 2);
      this.diary('rival', 'Beat ' + r.name + "'s score in " + this.game.name + '! 😎');
    }
    // It CHOOSES whether to swallow its pride and watch a better rival's run.
    async maybeWatchRival() {
      const st = this.brain.stats;
      if (st.episodes < 4) return;
      const h = st.history.slice(-6);
      const improving = h.length >= 2 && h[h.length - 1].s >= Math.max(...h.slice(0, -1).map((x) => x.s));
      const t = this.ai.traits;
      const want = (improving ? 0.06 : 0.35) * (1.25 - t.pride) * (0.6 + this.heart.e.determined + this.heart.e.confused * 0.5);
      if (!U.chance(want)) return;
      const r = this.rivals()[0];
      if (!r) return;
      let run = null;
      try { run = await AIP.db.get('replays', r.a.id + '|' + this.game.id); } catch (e) { /* none */ }
      if (!run) return;
      this.phase = 'dreaming';
      this.reason = '📺 watching ' + r.a.name + "'s best run";
      this.voice.say('watchRival', { rival: r.a.name }, 2);
      await U.sleep(1800);
      if (this.dead) return;
      const n = this.brain.learnFromRun(run, r.a.name);
      if (n) {
        this.voice.say('watchRivalDone', { rival: r.a.name }, 2);
        this.diary('rival', 'Watched ' + r.a.name + "'s best run on " + this.game.name + '. Learned ' + n + ' moves. Don\'t tell them 🤫');
      }
    }

    /* ---------------- you helping ---------------- */
    setMode(m) {
      if (m === this.mode) return;
      const old = this.mode;
      this.mode = m;
      this.hands && this.hands.releaseAll();
      try {
        const a = this.frame && this.frame.contentWindow.__aip;
        if (a) {
          a.realLock = m === 'watch';
          if (m !== 'watch') { try { this.frame.contentDocument.exitPointerLock(); } catch (e) { /* ignore */ } }
          else if (a.dropLock) a.dropLock();
        }
      } catch (e) { /* ignore */ }
      if (m === 'watch') { this.voice.say('watchStart', {}, 2); this.newEpisode(); }
      if (old === 'watch' && m === 'ai') {
        this.voice.say('watchEnd', {}, 2);
        if (this.brain.demos.n > 40 && !this.brain.stats.flags.watchedYou) { this.brain.stats.flags.watchedYou = true; this.diary('watch', 'Watched how ' + this.game.name + ' is played. Took notes 📝'); }
        for (let i = 0; i < 40; i++) this.brain.trainCopy(16);
        this.newEpisode();
      }
      if (this.phase === 'restart' && m !== 'ai') this.phase = 'play';
    }
    userSnapshot() {
      const u = this.user;
      const snap = { keys: new Set(u.keys), clicked: u.clicked, look: { dx: u.look.dx, dy: u.look.dy } };
      u.clicked = false; u.look.dx = 0; u.look.dy = 0;
      return snap;
    }
    feedback(v) {
      this.pendingFb = v;
      this.voice.say(v > 0 ? 'thumbUp' : 'thumbDown', {}, 2);
    }
    tip(text) {
      const p = AIP.tips.parse(text);
      const painMode = AIP.settings.get().painMode;
      if (p.feedback) { this.feedback(p.feedback); return; }
      const ans = this.voice.answer(text, { reason: this.reason, learned: this.brain.learned(null, this.primaryLabels()), game: this.game.name, best: AIP.squad.gameStats(this.ai, this.game.id).best, tries: AIP.squad.gameStats(this.ai, this.game.id).tries, scoreLabel: this.lastObs && this.lastObs.scoreLabel });
      if (!p.tips.length && ans) { this.voice.raw(ans, 2, 'answer'); return; }
      if (p.tips.length) {
        p.tips.forEach((t) => this.brain.applyTip(t));
        this.heart.react([{ type: 'tip' }], { painMode });
        this.voice.say('tipThanks', { tip: p.tips[0].text }, 3);
        return;
      }
      if (p.unknownThing) { this.voice.say('tipThing', { thing: p.unknownThing }, 3); return; }
      this.voice.say('tipUnknown', {}, 3);
    }
    primaryLabels() {
      const P = this.senses.primary, R = this.senses.readouts;
      const lab = (k) => (P[k] && R.get(P[k]) ? R.get(P[k]).label : null);
      return { score: lab('score'), hp: lab('hp'), lives: lab('lives') };
    }

    /* ---------------- saving ---------------- */
    async persist() {
      try {
        this.saveGameStore();
        const rec = this.brain.serialize();
        rec.gameSave = this.gameStore;
        await AIP.db.put('brains', rec);
        await AIP.squad.save(this.ai);
        const run = this.brain.bestRun;
        if (run && run !== this.savedRun) { await AIP.db.put('replays', Object.assign({ key: this.ai.id + '|' + this.game.id }, run)); this.savedRun = run; }
      } catch (e) { console.warn('save failed', e); }
    }
    diary(kind, text) {
      return AIP.squad.write(this.ai, this.game, kind, text, this.heart.dominant().name).then((e) => this.app.diaryAdded(e));
    }
    captureThumb() {
      this.thumbDone = true;
      try {
        const doc = this.frame.contentDocument;
        let best = null, ba = 0;
        doc.querySelectorAll('canvas').forEach((c) => { const r = c.getBoundingClientRect(); if (r.width * r.height > ba) { ba = r.width * r.height; best = c; } });
        const out = document.createElement('canvas');
        out.width = 320; out.height = 180;
        const x = out.getContext('2d');
        if (best && ba > 20000) x.drawImage(best, 0, 0, 320, 180);
        else x.drawImage(this.senses.eyeImage(), 0, 0, 320, 180);
        this.game.thumb = out.toDataURL('image/jpeg', 0.72);
        AIP.db.put('games', this.game).then(() => this.app.gamesChanged && this.app.gamesChanged());
      } catch (e) { /* tainted or gone */ }
    }

    ui(now, obs) {
      if (now - this.lastUI < 200) return;
      this.lastUI = now;
      this.app.renderPlay(this, obs, now - this.lastLearnUI > 1000 && ((this.lastLearnUI = now), true));
    }

    async stop() {
      this.dead = true;
      this.brain.stopDream = true;
      clearTimeout(this.timer);
      this.voice.stop();
      if (this.hands) this.hands.releaseAll();
      this.heart.dreaming = false;
      await this.persist();
      if (this.frame) this.frame.remove();
      if (this.built) this.built.revoke();
    }
  }
  return Session;
})();
