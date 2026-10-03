/* AI Play - the COACH: the smart (Gemini) part of the AI's brain.
 *
 * The fast baby brain keeps pressing keys many times a second. Every few seconds the coach looks
 * at a screenshot, figures out what's going on, makes a plan, teaches the baby brain (what keys do,
 * which colors are good/bad), talks smarter, answers you, reads stories, reviews deaths, and only
 * grabs the controls itself when the baby brain is stuck. It decides itself how often to look.
 * No key / no internet -> the baby brain just keeps playing alone.
 */
'use strict';

AIP.Coach = (function () {
  const U = AIP.util;
  const G = AIP.gemini;
  const COLORS = AIP.COLORS.names;
  const pt = { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, what: { type: 'string' } }, required: ['x', 'y'] };
  const SCHEMA = {
    type: 'object',
    properties: {
      see: { type: 'string', description: 'one short sentence: what is on the screen right now' },
      goal: { type: 'string', description: 'the goal right now, a few words' },
      plan: { type: 'array', items: { type: 'string' }, description: 'up to 4 short steps' },
      say: { type: 'string', description: 'what the AI says out loud now, in character, max 18 words, or empty' },
      reply: { type: 'string', description: 'answer to the player if they said something, max 45 words, else empty' },
      ask: { type: 'string', description: 'a question for the player only if really needed, else empty' },
      target: Object.assign({ description: 'where on screen to move toward now (0..1 coords), omit if none' }, pt),
      click: Object.assign({ description: 'ONLY when stuck / menu / choosing a story option: where to click' }, pt),
      press: { type: 'array', items: { type: 'string' }, description: 'ONLY when stuck: keys to press now, like Space or ArrowRight' },
      keys: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, does: { type: 'string' } }, required: ['key', 'does'] }, description: 'what keys do, if fairly sure' },
      avoid_keys: { type: 'array', items: { type: 'string' } },
      good_colors: { type: 'array', items: { type: 'string', enum: COLORS } },
      bad_colors: { type: 'array', items: { type: 'string', enum: COLORS } },
      feel: { type: 'object', properties: { emotion: { type: 'string', enum: AIP.Heart.EMOS }, why: { type: 'string' } }, required: ['emotion'] },
      note: { type: 'string', description: 'something worth remembering about this game for next time, else empty' },
      story: { type: 'string', description: 'if there is story/dialogue: a one-line summary of what happened, else empty' },
      trophies: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, got: { type: 'boolean' } }, required: ['name'] } },
      stuck: { type: 'boolean', description: 'true if the reflex brain looks stuck and you should take over briefly' },
      lesson: { type: 'string', description: 'for a death review: what went wrong and what to do next time, else empty' },
    },
    required: ['see', 'goal', 'say'],
  };

  class Coach {
    constructor(session) {
      this.s = session;
      this.busy = false;
      this.lastLook = 0;
      this.lastSay = 0;
      this.plan = null;      // last plan from Gemini
      this.queue = [];       // things to look at right away: {reason, text}
      this.chatLog = [];     // recent player <-> AI messages
      this.snaps = [];       // rolling small screenshots (for death reviews)
      this.lastSnapAt = 0;
      this.lastReview = 0;
      this.deathSigs = {};
      this.wasOnline = null;
      this.studied = false;
      this.pendingAsk = '';
    }
    get on() { return G.ready(); }
    status() { return G.state(); }

    /* ---------- called every AI tick ---------- */
    tick(now, obs) {
      const usable = G.usable();
      // tell the player when the coach drops out / comes back
      if (G.ready() && this.wasOnline !== null) {
        const st = G.state().status;
        if (st === 'offline' && this.wasOnline) { this.wasOnline = false; this.s.voice.raw('My coach brain is offline 📡 so I\'m playing with just my baby brain for now.', 2, 'coach'); }
        else if (st !== 'offline' && this.wasOnline === false && usable) { this.wasOnline = true; this.s.voice.raw('Coach brain is back online 🧠✨', 2, 'coach'); }
      } else if (this.wasOnline === null && G.ready()) this.wasOnline = true;
      if (!G.ready()) return;
      if (obs && obs.ok && now - this.lastSnapAt > 1500) { this.lastSnapAt = now; const c = this.s.senses.snapshot(320, 240); if (c) { this.snaps.push({ t: now, data: c.toDataURL('image/jpeg', 0.6).split(',')[1] }); if (this.snaps.length > 3) this.snaps.shift(); } }
      if (this.busy || !usable) return;
      if (this.queue.length) { const q = this.queue.shift(); this.look(q.reason, q); return; }
      if (now - this.lastLook > this.interval(obs, now)) this.look('routine', {});
    }
    // "It decides itself": look faster when something's going on, slower when it's chill.
    interval(obs, now) {
      if (!obs || !obs.ok) return 8000;
      const s = this.s;
      if (s.brain.coach && s.brain.coach.reached) { s.brain.coach.reached = false; return 1500; } // got there - what's next?
      if (s.phase === 'studying') return 2500;
      if (obs.menuish || obs.staticTime > 3 || (obs.choices && obs.choices.length)) return 3500;
      if ((obs.healthFrac != null && obs.healthFrac < 0.4) || now - s.ep.lastDamageAt < 4000) return 4000;
      const calm = now - (s.lastScoreAt || 0) < 5000 && s.heart.e.scared < 0.3;
      return calm ? 10000 : 6500;
    }

    /* ---------- building what Gemini sees ---------- */
    context(reason, extra) {
      const s = this.s, ai = s.ai, B = s.brain, o = s.lastObs || {};
      const words = AIP.Heart.describe(ai.traits).join(', ');
      const learned = B.learned(null, s.primaryLabels()).filter((l) => l.good).slice(0, 10).map((l) => '- ' + l.text);
      const keys = B.actions.filter((a) => a && a.active && !a.mouse && a.keys.length === 1).map((a) => a.keys[0]);
      const pauseKeys = [...(s.pauseKeys || [])];
      const texts = (s.senses.textBits || []).map((b) => b.s).filter((t) => t && t.length < 160).slice(0, 25);
      const btns = (o.buttons || []).slice(0, 10).map((b) => '"' + b.text + '" at (' + (b.x / (o.vw || 1)).toFixed(2) + ', ' + (b.y / (o.vh || 1)).toFixed(2) + ')');
      const notes = (s.game.notes || []).slice(-12).map((n) => '- ' + n);
      const story = (B.stats.story || []).slice(-6).map((n) => '- ' + n);
      const tro = B.stats.trophies || { list: [], got: {} };
      const trophies = tro.list.length ? tro.list.map((t) => (tro.got[t.name] || t.got ? '[x] ' : '[ ] ') + t.name).join('; ') : (Object.keys(tro.got).length ? 'got: ' + Object.keys(tro.got).join(', ') : 'unknown');
      const recent = (s.recentEvents || []).slice(-8).join('; ');
      const salty = ai.traits.salty > 0.6 ? ' It cusses sometimes when mad (its own choice) - only ever at the game, never at people.' : ' It does not cuss.';
      const me = B.self.camera > 0.5 ? 'first-person/3D camera (it sees through its own eyes)' : 'around (' + B.self.x.toFixed(2) + ', ' + B.self.y.toFixed(2) + ') on screen' + (B.self.cat != null ? ', it is the ' + COLORS[B.self.cat] + ' thing' : '');
      const lines = [
        'GAME: "' + s.game.name + '". You are the smart coach part of ' + ai.name + "'s brain (an AI with feelings playing this game).",
        'Personality: ' + words + '. Catchphrase: "' + ai.catchphrase + '". Mood right now: ' + s.heart.dominant().name + '.' + salty,
        'WHY YOU ARE LOOKING NOW: ' + reason + (extra && extra.text ? ' - ' + extra.text : ''),
        'SCORE: ' + (o.score != null ? o.score + ' (' + (o.scoreLabel || 'score') + ')' : 'none found') + '. HEALTH: ' + (o.hp ? o.hp.value + '/' + o.hp.max : '-') + '. LIVES: ' + (o.lives ? o.lives.value : '-') + '. Best ever: ' + (B.stats.best == null ? '-' : B.stats.best) + '. Try #' + (B.stats.episodes + 1) + '.',
        'TEXT ON SCREEN: ' + (texts.length ? texts.map((t) => '"' + t + '"').join(' | ') : '(none)'),
        'BUTTONS: ' + (btns.length ? btns.join(', ') : '(none)'),
        o.choices && o.choices.length ? 'STORY CHOICES: ' + o.choices.map((c) => '"' + c.text + '"').join(', ') : '',
        'WHERE IT IS: ' + me + '.',
        'KEYS IT CAN PRESS: ' + (keys.length ? keys.join(', ') : 'still testing') + '. Other keys exist too (letters, digits, Enter, Space, Shift, arrows).' + (pauseKeys.length ? ' PAUSE keys (avoid): ' + pauseKeys.join(', ') + '.' : ''),
        'WHAT THE REFLEX BRAIN LEARNED:\n' + (learned.join('\n') || '- nothing yet'),
        'RECENT EVENTS: ' + (recent || 'nothing special'),
        'CURRENT PLAN: ' + (this.plan ? this.plan.goal + (this.plan.plan && this.plan.plan.length ? ' -> ' + this.plan.plan.join(' -> ') : '') : 'none yet'),
        'GAME NOTES FROM BEFORE:\n' + (notes.join('\n') || '- none'),
        story.length ? 'STORY SO FAR:\n' + story.join('\n') : '',
        'TROPHIES/ACHIEVEMENTS: ' + trophies + (B.stats.flags && B.stats.flags.askedTrophies ? ' (already asked the player about trophies)' : ''),
        this.chatLog.length ? 'RECENT CHAT:\n' + this.chatLog.slice(-6).join('\n') : '',
      ];
      return lines.filter(Boolean).join('\n');
    }
    system() {
      return [
        'You are the "coach" brain inside an AI that plays browser games. A fast reflex brain presses keys many times per second; you look at a screenshot every few seconds and guide it.',
        'Coordinates are 0..1 from the top-left of the screenshot.',
        'Be practical: set "target" to where it should go now (a door, a coin, an exit, away from danger). Leave "click"/"press" EMPTY unless the reflex brain is stuck, a menu/button needs clicking, the player asked for something precise, or a story choice must be picked.',
        'Teach with "keys" (what keys do) and good_colors/bad_colors only when fairly sure.',
        '"feel" is how the situation makes the AI feel (scary boss -> scared, funny thing -> happy). These are its own feelings.',
        'Speak AS the AI in first person, short, fun, like a gamer friend. Describe what you see sometimes. Don\'t repeat yourself.',
        'If the player said something: orders -> do them (target/plan) and say what you\'ll do; questions -> answer honestly from what you see and know; chat -> talk back like a friend.',
        'Story games: READ the dialogue, react to it, summarize it in "story", and pick choices on purpose (explain why). Don\'t skip story.',
        'Trophies are a separate bonus goal from winning. If you can see a trophy/achievement list, fill "trophies". If you don\'t know what trophies exist and haven\'t asked yet, you may ask the player once via "ask".',
        'Write a "note" only for genuinely new, useful facts about this game.',
      ].join('\n');
    }

    /* ---------- one look ---------- */
    async look(reason, extra) {
      if (this.busy) { this.queue.push(Object.assign({ reason }, extra)); return null; }
      this.busy = true;
      this.lastLook = performance.now();
      const s = this.s;
      try {
        const parts = [{ text: this.context(reason, extra) }];
        if (extra && extra.images) extra.images.forEach((d, i) => { parts.push({ text: i === 0 ? 'Screenshot a moment BEFORE it died:' : 'Screenshot right AFTER:' }); parts.push({ inlineData: { mimeType: 'image/jpeg', data: d } }); });
        else {
          const c = s.senses.snapshot(512, 384);
          if (c) parts.push({ inlineData: { mimeType: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.72).split(',')[1] } });
        }
        s.coachThinking = true;
        const plan = await G.generate({ system: this.system(), parts, schema: SCHEMA, temperature: 0.8, maxTokens: 900, label: reason });
        if (s.dead) return null;
        this.apply(plan, reason, extra);
        return plan;
      } catch (e) {
        if (extra && reason === 'player' && e.kind !== 'offline' && e.kind !== 'limit') s.voice.raw("My coach brain glitched (" + (e.message || 'error').slice(0, 60) + ") 😵", 2, 'coach');
        if (extra && reason === 'player' && (e.kind === 'offline' || e.kind === 'limit')) s.localTip(extra.raw || extra.text);
        return null;
      } finally {
        this.busy = false;
        s.coachThinking = false;
        if (reason === 'study') s.studyLooks = (s.studyLooks || 0) + 1;
      }
    }

    /* ---------- using the plan ---------- */
    apply(p, reason, extra) {
      const s = this.s, B = s.brain, now = performance.now();
      if (!p || typeof p !== 'object') return;
      p.at = now; p.reason = reason;
      const clamp01 = (v) => U.clamp(Number(v) || 0, 0, 1);
      const okPt = (q) => q && isFinite(q.x) && isFinite(q.y);
      this.plan = Object.assign({}, this.plan || {}, { see: p.see, goal: p.goal, plan: (p.plan || []).slice(0, 4), at: now });
      // 🎯 where to go -> the baby brain steers there
      if (okPt(p.target)) B.coach = { target: { x: clamp01(p.target.x), y: clamp01(p.target.y), what: p.target.what || p.goal }, goal: p.goal, until: now + 12000, avoid: new Set(), forward: this.forwardKeys() };
      else if (B.coach) B.coach.goal = p.goal;
      if (p.avoid_keys && p.avoid_keys.length) {
        B.coach = B.coach || { until: now + 12000, goal: p.goal };
        B.coach.avoid = new Set(p.avoid_keys.map((k) => AIP.KEYS.fromName(k) || k));
      }
      // 🎓 teach the baby brain (it keeps this even offline later)
      (p.keys || []).slice(0, 8).forEach((k) => {
        const code = AIP.KEYS.map[k.key] ? k.key : AIP.KEYS.fromName(k.key);
        if (!code || !k.does) return;
        const c = B.keyCtl(code);
        if (c.status === 'pause' || c.status === 'banned') return;
        c.tip = String(k.does).slice(0, 30) + ' (coach 🧠)';
        if (c.status === 'new' || c.status === 'useless') c.status = 'starred';
        B.ensureAction('k:' + code, { keys: [code] });
      });
      const nudge = (names, v) => (names || []).forEach((n) => { const i = COLORS.indexOf(String(n).toLowerCase()); if (i >= 0) B.assoc.prior[i] = U.clamp(B.assoc.prior[i] + v, -1.2, 1.2); });
      nudge(p.good_colors, 0.35); nudge(p.bad_colors, -0.35);
      // 💓 understanding -> feelings (its own)
      if (p.feel && p.feel.emotion && s.heart.e[p.feel.emotion] != null) s.heart.feel(p.feel.emotion, 0.22, p.feel.why || 'what it sees');
      // 📝 notes + 📖 story + 🏆 trophies
      if (p.note && p.note.length > 4) this.addNote(p.note);
      if (p.story && p.story.length > 4) { B.stats.story = B.stats.story || []; if (B.stats.story[B.stats.story.length - 1] !== p.story) { B.stats.story.push(p.story.slice(0, 160)); if (B.stats.story.length > 60) B.stats.story.shift(); } }
      if (p.trophies && p.trophies.length) s.mergeTrophies(p.trophies);
      if (p.lesson) { this.lastLesson = p.lesson; B.addMemory('lesson', p.lesson.slice(0, 80), 0.6); }
      // 🗣️ talking (the coach's smart lines) - replies to you always get said
      if (p.reply && extra && (extra.text || reason === 'player')) { s.voice.raw(p.reply, 3, 'coach'); this.chatLog.push(s.ai.name + ': ' + p.reply); }
      else if (p.say && now - this.lastSay > 4000 && p.say !== this.lastSaid) { this.lastSay = now; this.lastSaid = p.say; s.voice.raw(p.say, reason === 'death' || reason === 'story' ? 3 : 2, 'coach'); }
      if (p.ask && !this.pendingAsk) { this.pendingAsk = p.ask; s.voice.raw(p.ask, 3, 'coach'); this.chatLog.push(s.ai.name + ' asked: ' + p.ask); if (/trophi|achievement/i.test(p.ask)) B.stats.flags.askedTrophies = true; }
      if (reason === 'death' && p.lesson) s.diary('review', 'Death review in ' + s.game.name + ': ' + p.lesson);
      // 🖐️ takeover - only when stuck / menu / story choice / you asked / studying
      const o = s.lastObs || {};
      const allowed = p.stuck || o.menuish || o.staticTime > 4 || reason === 'study' || reason === 'player' || reason === 'story' || (o.choices && o.choices.length) || s.stuckFor > 8;
      if (allowed && (okPt(p.click) || (p.press && p.press.length))) s.takeover(okPt(p.click) ? { x: clamp01(p.click.x), y: clamp01(p.click.y), what: p.click.what } : null, (p.press || []).slice(0, 4));
      s.app.coachUpdated && s.app.coachUpdated(s);
    }
    forwardKeys() {
      const B = this.s.brain;
      const out = [];
      Object.keys(B.controls).forEach((code) => { const c = B.controls[code]; if (/forward|walk|run|move up|go ahead/i.test(c.tip || '')) out.push(code); });
      if (!out.length) ['KeyW', 'ArrowUp'].forEach((k) => { const c = B.controls[k]; if (c && (c.status === 'useful' || c.status === 'starred')) out.push(k); });
      return out;
    }
    addNote(n) {
      const g = this.s.game;
      g.notes = g.notes || [];
      const t = String(n).trim().slice(0, 140);
      if (g.notes.some((x) => x.toLowerCase() === t.toLowerCase())) return;
      g.notes.push(t);
      if (g.notes.length > 30) g.notes.shift();
      AIP.db.put('games', g).catch(() => {});
    }

    /* ---------- the player said something ---------- */
    playerSaid(text) {
      const line = (this.pendingAsk ? 'Player answered your question ("' + this.pendingAsk + '"): ' : 'Player: ') + text;
      this.pendingAsk = '';
      this.chatLog.push(line);
      if (this.chatLog.length > 20) this.chatLog.shift();
      this.queue.unshift({ reason: 'player', text: line, raw: text });
    }
    // 📖 new story/dialogue text appeared
    storyText(text, choices) {
      if (!G.ready()) return;
      this.queue.push({ reason: 'story', text: 'New story text: "' + text.slice(0, 400) + '"' + (choices && choices.length ? ' Choices: ' + choices.map((c) => '"' + c.text + '"').join(', ') : '') });
    }
    // 📚 study the title screen / instructions before playing
    study() {
      if (!G.ready()) return false;
      this.queue.push({ reason: 'study', text: 'The game just loaded. Read any instructions/controls/goal on screen BEFORE playing. Teach keys, write a note about the goal + controls, plan. If a "How to play"/"Controls"/"Help" button exists and you have not read it, click it. When you understand enough, click the Play/Start button (or press the key it says).' });
      return true;
    }
    // 🎬 should I look back at that death? (it decides)
    considerDeath(info) {
      if (!G.ready()) return;
      const now = performance.now();
      const B = this.s.brain;
      const sig = info.cause || 'unknown';
      this.deathSigs[sig] = (this.deathSigs[sig] || 0) + 1;
      const firstDeaths = B.stats.deaths <= 2;
      const repeat = this.deathSigs[sig] === 3 || this.deathSigs[sig] === 8;
      const bigRun = info.newBest && info.score > 0;
      const quickStreak = (this.s.heart.deaths || []).length >= 4;
      if (!(firstDeaths || repeat || bigRun || quickStreak) || now - this.lastReview < 40000) return;
      this.lastReview = now;
      const imgs = this.snaps.slice(-2).map((x) => x.data);
      this.queue.unshift({ reason: 'death', text: 'It just died' + (info.score != null ? ' with score ' + info.score : '') + (repeat ? ' - it keeps dying the same way (' + sig + ')' : '') + '. Look at what happened, explain in "lesson" what went wrong and what to do next time, teach anything useful, and react in "say".', images: imgs.length ? imgs : null });
    }

    /* ---------- 📋 report card ---------- */
    async report(summary) {
      if (!G.ready()) return null;
      const s = this.s, ai = s.ai;
      const prompt = [
        'Write a short, fun REPORT CARD for ' + ai.name + ' (an AI with feelings) after playing "' + s.game.name + '". Write it AS ' + ai.name + ' in first person, like a kid gamer. Personality: ' + AIP.Heart.describe(ai.traits).join(', ') + '.',
        'Format exactly with these lines: "Grade: <A-F>", "What I learned: ...", "Best moment: ...", "Still hard: ...", "Next goal: ...". Max 110 words total. No markdown symbols.',
        'FACTS: ' + JSON.stringify(summary),
      ].join('\n');
      try { return await G.generate({ parts: [{ text: prompt }], temperature: 0.9, maxTokens: 400, label: 'report card' }); } catch (e) { return null; }
    }
  }
  return Coach;
})();
