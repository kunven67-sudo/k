/* AI Play - TYPING ✍️: the AI types real text into the game, letter by letter.
 *   - text boxes: its own name, number guesses (it narrows them down from "too high / too low"),
 *     math answers, passwords it spotted in the story, text-adventure commands, answers...
 *   - typing games: it types the words it sees on screen
 *   - the coach (Gemini) picks what to type when it's on (riddles, smart commands), and you can
 *     tell it too: type hello
 * After it types, it watches what happens (right? wrong? nothing?) and remembers what worked.
 */
'use strict';

AIP.Typist = (function () {
  const U = AIP.util;
  const G = AIP.gemini;
  const GOOD_RX = /\b(correct|right!|that'?s right|yes!|well done|good job|great job|nice|awesome|welcome|nice to meet|unlocked|access granted|you got it|you guessed|got it|success|solved|bingo|perfect|level up|you win|you won)\b/i;
  const BAD_RX = /\b(wrong|incorrect|invalid|nope|not (it|right|correct|quite)|try again|unknown|don'?t (understand|know)|can'?t|cannot|error|denied|huh|not a (valid|command|word|number)|i don'?t see|no such|nothing happens|you can'?t|not allowed)\b|^\s*no\b/i;
  const NUM_HIGH_RX = /too (high|big|large)|go lower|guess lower|lower than|smaller than|less than|it'?s below|\blower\b|\bsmaller\b/i;
  const NUM_LOW_RX = /too (low|small)|go higher|guess higher|higher than|bigger than|greater than|more than|it'?s above|\bhigher\b|\bbigger\b/i;
  const CLUE_RX = /\b(?:password|pass ?code|secret code|code|pin|secret word|passphrase|key ?word|magic word|the answer)\s*(?:is|was|=|:)\s*["'“‘]?([A-Za-z0-9][\w-]{0,23})["'”’]?/i;
  const DIRS = ['north', 'south', 'east', 'west', 'up', 'down', 'northeast', 'northwest', 'southeast', 'southwest'];
  const W = (s) => new RegExp('\\b(' + s + ')\\b', 'ig');
  const TAKE_RX = W('key|sword|lamp|lantern|torch|coin|coins|gold|gem|jewel|map|book|note|letter|food|apple|bread|potion|rope|knife|dagger|shield|ring|scroll|bottle|stick|axe|flashlight|card|crystal|treasure|wand|staff|matches|candle|feather|shell|bone|flower|mushroom|orb|amulet|crown|compass');
  const OPEN_RX = W('door|chest|box|gate|drawer|cabinet|hatch|trapdoor|window|locker|safe|cupboard|crate|bag|sack');
  const READ_RX = W('note|letter|sign|book|scroll|map|plaque|inscription|poster|diary|journal');
  const TALK_RX = W('owl|guard|wizard|witch|merchant|king|queen|girl|boy|robot|stranger|knight|troll|goblin|dragon|elf|dwarf|ghost|shopkeeper|villager|old man|old woman|man|woman');
  const LOOK_RX = W('table|desk|painting|statue|bed|mirror|fountain|tree|altar|rug|carpet|fireplace|shelf|bookshelf|well|lever|button|switch|hole|footprints|machine|computer|panel|chest');
  const SUBMIT_BTN_RX = /\b(submit|go|ok|okay|enter|guess|send|check|answer|done|confirm|next|save|continue|login|log in|unlock|try|start|play|run|say)\b/i;
  const KIND_WORD = { name: 'name box', number: 'guess box', answer: 'answer box', password: 'password box', command: 'command box', chat: 'chat box', text: 'text box', email: 'email box', search: 'search box' };

  // "what is 7 x 5?" -> 35 (only + - x / with 2-3 numbers)
  function solveMath(text) {
    const t = String(text).toLowerCase().replace(/plus/g, '+').replace(/minus/g, '-').replace(/times|multiplied by/g, 'x').replace(/divided by/g, '/').replace(/[×*]/g, 'x').replace(/÷/g, '/');
    const m = /(-?\d+(?:\.\d+)?)\s*([+\-x/])\s*(-?\d+(?:\.\d+)?)(?:\s*([+\-x/])\s*(-?\d+(?:\.\d+)?))?\s*(?:=|\?|$)/.exec(t);
    if (!m) return null;
    const op = (a, o, b) => (o === '+' ? a + b : o === '-' ? a - b : o === 'x' ? a * b : b === 0 ? NaN : a / b);
    let a = +m[1], b = +m[3], r;
    if (m[4]) { const c = +m[5]; r = (m[4] === 'x' || m[4] === '/') && (m[2] === '+' || m[2] === '-') ? op(a, m[2], op(b, m[4], c)) : op(op(a, m[2], b), m[4], c); } else r = op(a, m[2], b);
    if (!isFinite(r)) return null;
    return { q: m[0].replace(/\s*[=?]\s*$/, '').trim(), a: String(Math.round(r * 100) / 100) };
  }

  class Typist {
    constructor(session) {
      this.s = session;
      this.job = null;
      this.state = new Map();  // field "signature" -> what it tried there
      this.playerQueue = [];
      this.coachPlan = null;   // {box, text, enter, at}
      this.ctxFields = [];     // the text boxes the coach was told about (by number)
      this.history = [];       // 'typed "50" in "Your guess" -> "Too high!"'
      this.tgWords = new Map(); this.tgOffUntil = 0;
    }
    get mem() {
      const st = this.s.brain.stats;
      return st.typing || (st.typing = { worked: {}, failed: {}, clues: [], submit: {}, tg: { works: false, submit: null, fails: 0 }, cmds: {}, typed: 0 });
    }
    get active() { return !!this.job; }
    // a "try again" that showed up right after it typed is the game answering, not a game over
    feedbackOver() { const P = this.s.senses.phrase; return !!(this.lastTypedAt && P && P.over && P.overSince >= this.lastTypedAt - 50 && P.overSince - this.lastTypedAt < 8000); }
    cancel() { if (this.job) this.endJob(); this.s.hands && this.s.hands.stopTyping(); }
    // the game ended (won / died) while it was waiting to see what its typing did
    onEnd(end) {
      const J = this.job;
      if (J && J.phase === 'judge') this.finish(end === 'win' ? 'good' : 'changed', end === 'win' ? 'WON' : '');
      else this.cancel();
    }
    sig(f) { return f.kind + ':' + (f.label || '').toLowerCase().replace(/\d+/g, '#').slice(0, 40); }
    fieldState(f) {
      const k = this.sig(f);
      if (!this.state.has(k)) this.state.set(k, { sig: k, tries: 0, neutral: 0, bad: 0, until: 0, done: false, tried: [], guess: null, askedAt: 0, waitUntil: 0, lastTyped: '' });
      return this.state.get(k);
    }

    /* ---------- the player said: type hello ---------- */
    playerText(text) {
      const t = String(text).trim().slice(0, 120);
      if (!t) return;
      this.playerQueue.push(t);
      const c = CLUE_RX.exec('password is ' + t);
      if (c) this.addClue(c[1]);
    }
    addClue(word) {
      const m = this.mem;
      if (word && m.clues.indexOf(word) < 0) { m.clues.push(word); if (m.clues.length > 20) m.clues.shift(); }
    }
    /* ---------- the coach said what to type ---------- */
    fromCoach(t, reason) {
      if (!t || !t.text || typeof t.text !== 'string' || !t.text.trim()) { if (reason === 'type') this.coachDeclinedAt = performance.now(); return; }
      const box = Number.isInteger(t.box) ? t.box : (t.box == null ? 0 : parseInt(t.box, 10));
      this.coachPlan = { box: isFinite(box) ? box : 0, text: t.text.slice(0, 120), enter: t.enter !== false, at: performance.now() };
      if (box < 0) this.coachTyping = true;
    }
    // the list of boxes the coach sees (numbered)
    describeFields(obs) {
      const fields = (obs && obs.fields) || [];
      this.ctxFields = fields.slice();
      if (!fields.length) return '';
      return fields.map((f, i) => '[' + i + '] ' + (KIND_WORD[f.kind] || 'text box') + ' "' + (f.label || '').slice(0, 50) + '"' + (f.value ? ' (has "' + f.value.slice(0, 30) + '")' : ' (empty)') + ' at (' + f.x.toFixed(2) + ', ' + f.y.toFixed(2) + ')').join('; ');
    }

    /* ---------- every tick: should I type something? ---------- */
    step(obs, now) {
      const s = this.s;
      if (s.phase !== 'play') return false;
      if (this.job) return this.runJob(obs, now);
      const fields = obs.fields || [];
      // 1) you told it what to type
      if (this.playerQueue.length) {
        const text = this.playerQueue.shift();
        const f = fields.find((x) => x.focused) || fields.find((x) => !/email|search/.test(x.kind)) || fields[0] || null;
        s.voice.say(f ? 'typePlayer' : 'typeNoBox', { text }, 3);
        this.start({ f, text, why: 'you told me to', from: 'player', submit: true }, obs, now);
        return true;
      }
      // 2) the coach picked something (a box, or just the keyboard for typing games)
      const cp = this.coachPlan;
      if (cp && now - cp.at < 9000) {
        this.coachPlan = null;
        let f = cp.box >= 0 ? this.ctxFields[cp.box] || fields[cp.box] || null : null;
        if (f && !f.el.isConnected) f = fields.find((x) => x.kind === f.kind) || null;
        if (f || cp.box < 0) {
          const fs = f && this.fieldState(f);
          if (!fs || !(fs.tried.slice(-3).indexOf(cp.text) >= 0 && fs.bad)) {
            this.start({ f, text: cp.text, why: 'coach 🧠', from: 'coach', submit: cp.enter }, obs, now);
            return true;
          }
        }
      }
      // 3) a text box is waiting for something
      const f = this.pickField(obs, now);
      if (f) {
        const plan = this.decide(f, obs, now);
        if (plan && plan.wait) { s.hands.releaseAll(); s.reason = '⌨️ thinking what to type in the ' + (KIND_WORD[f.kind] || 'text box') + '…'; return true; }
        if (plan && plan.text) { this.start(Object.assign({ f, submit: true }, plan), obs, now); return true; }
      }
      // 4) a typing game: type the words on screen
      return this.typingGame(obs, now);
    }

    pickField(obs, now) {
      const s = this.s, fields = obs.fields || [];
      if (!fields.length || obs.winVisible || (obs.gameOverVisible && !this.feedbackOver())) return null;
      const order = { command: 0, number: 1, answer: 2, password: 3, name: 4, text: 5, chat: 6, email: 9, search: 9 };
      const busy = (obs.motionAmt || 0) > Math.max(0.004, s.motionEMA * 1.5) && !obs.menuish;
      let best = null, bs = Infinity;
      for (const f of fields) {
        if (f.kind === 'email' || f.kind === 'search') continue;
        const st = this.fieldState(f);
        if (now < st.until || st.done) continue;
        // a box that's already filled in (not by me) - leave it, except a default name like "Player1"
        if (f.value && f.value !== st.lastTyped && !(f.kind === 'name' && !st.tries)) continue;
        // chat-ish boxes in a busy action game: only now and then, for fun
        if ((f.kind === 'chat' || f.kind === 'text') && busy && !U.chance(0.02)) continue;
        let score = (order[f.kind] != null ? order[f.kind] : 5) - (f.focused ? 3 : 0) + f.y;
        if (f.kind === 'password' && (this.mem.clues.length || this.findClue((s.senses.textBits || []).map((b) => b.s).concat((s.brain.stats.storyLines || []).slice(-15))))) score -= 4;
        if (score < bs) { bs = score; best = f; }
      }
      return best;
    }

    /* ---------- deciding WHAT to type ---------- */
    decide(f, obs, now) {
      const s = this.s, st = this.fieldState(f), mem = this.mem, ai = s.ai;
      const texts = (s.senses.textBits || []).map((b) => b.s);
      const all = texts.concat((s.brain.stats.storyLines || []).slice(-15), s.game.notes || []);
      const question = texts.filter((t) => /\?\s*$|=\s*\??\s*$/.test(t) && t.length < 200).pop() || '';
      // 🧠 the coach decides (it can solve riddles, write smart commands...)
      if (G.usable() && f.kind !== 'name') {
        const situation = U.hashStr(this.sig(f) + '|' + texts.slice(-6).join('|'));
        if (st.askedFor !== situation) {
          st.askedFor = situation; st.waitUntil = now + 8000; st.askedAt = now;
          s.coach.queue.unshift({ reason: 'type', text: 'A text box needs typing: ' + this.describeFields(obs) + '. Decide exactly what to type and fill "type" (box number + text).' + (this.history.length ? ' What it typed before: ' + this.history.slice(-4).join('; ') : '') });
          return { wait: true };
        }
        if (now < st.waitUntil && !(this.coachDeclinedAt > st.askedAt)) return { wait: true };
      }
      // 🧠 remembered from last time (answers: for this exact question)
      const memKey = this.memKeyFor(f);
      const known = mem.worked[memKey];
      if (known && f.kind !== 'number' && !solveMath(question) && st.tried.slice(-3).indexOf(known) < 0) return { text: known, why: 'I remember this one', line: 'typeRemember', memKey };
      const failed = new Set((mem.failed[memKey] || []).concat(st.tried.slice(-12)));
      const fresh = (list) => list.find((x) => x && !failed.has(x));
      switch (f.kind) {
        case 'name': {
          const short = f.max && f.max <= 3 || /initial/i.test(f.label);
          let n = short ? ai.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() : ai.name;
          if (f.max) n = n.slice(0, f.max);
          return { text: n, why: 'that\'s my name', line: 'typeName' };
        }
        case 'number': {
          const math = solveMath(question) || texts.map(solveMath).find(Boolean);
          if (math && st.tried.indexOf(math.a) < 0) return { text: math.a, why: 'math! ' + math.q + ' = ' + math.a, line: 'typeMath', vars: { q: math.q } };
          const g = st.guess || (st.guess = this.range(f, all));
          if (g.lo > g.hi) { st.guess = this.range(f, all); return this.decide(f, obs, now); }
          const n = Math.floor((g.lo + g.hi) / 2);
          g.last = n;
          return { text: String(n), why: 'guessing between ' + g.lo + ' and ' + g.hi, line: 'typeGuess' };
        }
        case 'password': {
          const clue = this.findClue(all);
          const pick = fresh([clue].concat(mem.clues.slice().reverse(), ['password', '1234', 'open sesame', '0000', 'letmein', ai.name.toLowerCase()]));
          if (!pick) { st.until = now + 60000; return null; }
          return { text: pick, why: pick === clue ? 'I saw a clue: "' + clue + '"' : 'guessing passwords', line: pick === clue ? 'typeClue' : 'typePassword' };
        }
        case 'command': {
          const cmd = this.adventure(st, texts, now);
          return cmd ? { text: cmd, why: 'exploring', line: 'typeCmd' } : null;
        }
        case 'answer': case 'text': case 'chat': {
          const math = solveMath(question) || texts.map(solveMath).find(Boolean);
          if (math) return { text: math.a, why: 'math! ' + math.q + ' = ' + math.a, line: 'typeMath', vars: { q: math.q }, math: true };
          const quoted = texts.map((t) => /(?:type|spell|write|enter)\s+(?:the\s+word\s+|this:?\s+)?["'“‘]([^"'”’]{1,30})["'”’]/i.exec(t) || /(?:type|spell)\s*:\s*([A-Za-z][A-Za-z ]{0,29})$/i.exec(t)).find(Boolean);
          if (quoted && !failed.has(quoted[1])) return { text: quoted[1], why: 'the game said to type it', line: 'typeAnswer', memKey };
          const clue = this.findClue(all);
          if (clue && !failed.has(clue) && /answer|code|password|secret/i.test(f.label + ' ' + question)) return { text: clue, why: 'I saw a clue: "' + clue + '"', line: 'typeClue', memKey };
          if (f.kind === 'chat' || (f.kind === 'text' && !question)) {
            if (st.tries >= 1) { st.done = true; return null; }
            const hi = f.kind === 'chat' ? U.pick(['hi! im ' + ai.name, 'hello from ' + ai.name + ' :)', ai.catchphrase || 'hi!']) : ai.name;
            return { text: hi, why: f.kind === 'chat' ? 'saying hi' : 'filling it in', line: f.kind === 'chat' ? 'typeChat' : 'typeName' };
          }
          // a question it can't really answer without the coach -> a baby-brain guess
          const yesNo = /^\s*(is|are|do|does|did|can|will|would|should|have|has|was|were)\b/i.test(question);
          const color = /colou?r/i.test(question) ? U.pick(['blue', 'red', 'green']) : null;
          const pick = fresh([yesNo ? 'yes' : null, color, yesNo ? 'no' : null, U.pick(['42', 'banana']), 'idk', 'robot', ai.name.toLowerCase()]);
          if (!pick || st.tries >= 5) { st.until = now + 45000; st.tries = 0; return null; }
          return { text: pick, why: 'best guess (my baby brain doesn\'t know this one)', line: 'typeAnswer', memKey };
        }
        default: return null;
      }
    }
    question() { return (this.s.senses.textBits || []).map((b) => b.s).filter((t) => /\?\s*$|=\s*\??\s*$/.test(t) && t.length < 200).pop() || ''; }
    memKeyFor(f) { const q = this.question(), sig = this.sig(f); return /answer|text/.test(f.kind) && q ? sig + '|' + U.hashStr(q) : sig; }
    range(f, texts) {
      let lo = 1, hi = 100;
      try { if (f.el.min !== '' && isFinite(+f.el.min)) lo = +f.el.min; if (f.el.max !== '' && isFinite(+f.el.max)) hi = +f.el.max; } catch (e) { /* ignore */ }
      for (const t of texts.slice().reverse()) {
        const m = /between\s+(-?\d+)\s+and\s+(-?\d+)/i.exec(t) || /from\s+(-?\d+)\s+to\s+(-?\d+)/i.exec(t) || (/number|guess|pick/i.test(t) && /(-?\d+)\s*(?:-|–|to)\s*(-?\d+)/.exec(t));
        if (m && +m[2] > +m[1]) { lo = +m[1]; hi = +m[2]; break; }
      }
      return { lo, hi, last: null, lo0: lo, hi0: hi };
    }
    findClue(texts) {
      for (const t of texts.slice().reverse()) { const m = CLUE_RX.exec(t); if (m && !/^(is|was|the|a|an|to)$/i.test(m[1])) return m[1]; }
      return null;
    }
    // 🗺️ text adventures: look around, go places, grab stuff
    adventure(st, texts, now) {
      const mem = this.mem, t = this.s.ai.traits;
      const desc = texts.filter((x) => x.length >= 35 && !/^\s*>/.test(x) && !BAD_RX.test(x)).pop();
      if (desc) this.room = desc;
      const room = this.room || texts.join(' ');
      const rk = U.hashStr(room.slice(0, 200));
      st.rooms = st.rooms || {};
      const tried = st.rooms[rk] || (st.rooms[rk] = []);
      const cands = [];
      const add = (cmd, v) => { if (!cands.some((c) => c.cmd === cmd)) cands.push({ cmd, v }); };
      if (!st.tried.length) add('look', 3);
      if (st.tried.indexOf('help') < 0 && st.tries >= 1) add('help', 1.2);
      const low = room.toLowerCase();
      const bareDirs = mem.cmds.__bareDirs;
      DIRS.forEach((d) => { if (new RegExp('\\b' + d + '\\b').test(low)) add(bareDirs ? d : 'go ' + d, 1.5 + t.bravery); });
      const each = (rx, f) => { rx.lastIndex = 0; let m; while ((m = rx.exec(low))) f(m[1].toLowerCase()); };
      each(TAKE_RX, (n) => add('take ' + n, 1.6 + t.curiosity * 0.5));
      each(OPEN_RX, (n) => add('open ' + n, 1.5 + t.curiosity * 0.5));
      each(READ_RX, (n) => add('read ' + n, 1.2 + t.curiosity));
      each(TALK_RX, (n) => add('talk to ' + n, 1.1 + t.chattiness));
      each(LOOK_RX, (n) => add('examine ' + n, 0.9 + t.curiosity));
      add('inventory', 0.4);
      DIRS.slice(0, 4).forEach((d) => add(bareDirs ? d : 'go ' + d, 0.3 * t.bravery));
      let best = null, bv = -Infinity;
      for (const c of cands) {
        let v = c.v + Math.random() * 0.6 * (0.5 + t.silliness);
        v -= 2.5 * tried.filter((x) => x === c.cmd).length;
        v -= 0.9 * st.tried.slice(-12).filter((x) => x === c.cmd).length; // (not the same thing over and over)
        const verb = c.cmd.split(' ')[0];
        const rec = mem.cmds[c.cmd] || 0, vrec = mem.cmds['verb:' + verb] || 0;
        v += 0.4 * rec + 0.3 * vrec;
        if (v > bv) { bv = v; best = c.cmd; }
      }
      if (best) tried.push(best);
      return best;
    }

    /* ---------- doing the typing ---------- */
    start(plan, obs, now) {
      const s = this.s, f = plan.f || null, h = s.hands;
      let el = f ? f.el : null;
      // typing games sometimes hide a text box that catches the keys - type into that one
      if (!el) { try { const ae = h.doc && h.doc.activeElement; if (ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName)) el = ae; } catch (e) { /* ignore */ } }
      const st = f ? this.fieldState(f) : null;
      const text = String(plan.text);
      if (f) this.lastTypedAt = now; // (only text boxes - in a typing game a GAME OVER is a real game over)
      const e = s.heart.e, t = s.ai.traits;
      const delay = (f ? 105 : 80) * (1 + 0.35 * e.scared - 0.25 * Math.max(e.mad, e.excited)) * (1.15 - 0.3 * t.competitive);
      const typo = f && plan.from !== 'player' && f.kind !== 'number' ? 0.01 + 0.035 * t.silliness : 0;
      h.releaseAll();
      if (st) { st.tries++; st.lastTyped = text; st.tried.push(text); if (st.tried.length > 30) st.tried.shift(); }
      this.job = { f, el, st, text, word: plan.word || text, wordSize: plan.wordSize || 0, memKey: plan.memKey || (f ? this.memKeyFor(f) : null), from: plan.from, plan, phase: 'typing', t0: now, kind: f ? f.kind : 'keys', before: this.snapshot(obs, el), submitTries: 0 };
      const J = this.job;
      if (plan.line) s.voice.say(plan.line, Object.assign({ text, name: s.ai.name }, plan.vars || {}), 2);
      if (f || plan.from !== 'game') s.app.chat('typed', text + (f ? '  → ' + (KIND_WORD[f.kind] || 'text box') : '  → keyboard'));
      s.reason = '⌨️ typing "' + text.slice(0, 30) + '"' + (f ? ' into the ' + (KIND_WORD[f.kind] || 'text box') : '') + ' - ' + (plan.why || 'let\'s see');
      h.typeText(text, el, { delay, typo, clear: !!(f && f.value) }).then((res) => {
        if (this.job !== J) return;
        J.typed = !!res;
        if (res && res.typos && U.chance(0.6)) s.voice.say('typeTypo', {}, 1);
        J.phase = 'typed'; J.at = performance.now();
      });
      this.mem.typed = (this.mem.typed || 0) + 1;
    }
    snapshot(obs, el) {
      const s = this.s;
      return { texts: this.countTexts(), score: obs.score, fields: (obs.fields || []).length, wins: s.brain.stats.wins || 0 };
    }
    countTexts() { const m = new Map(); for (const b of this.s.senses.textBits || []) m.set(b.s, (m.get(b.s) || 0) + 1); return m; }
    watchDom() {
      const J = this.job, h = this.s.hands;
      J.muts = 0;
      try {
        const w = h.win, d = h.doc;
        J.mo = new w.MutationObserver((list) => { for (const m of list) if (!(J.el && (m.target === J.el || J.el.contains(m.target)))) J.muts++; });
        J.mo.observe(d.body, { subtree: true, childList: true, characterData: true, attributes: true });
      } catch (e) { /* ignore */ }
    }
    endJob() { const J = this.job; if (J && J.mo) try { J.mo.disconnect(); } catch (e) { /* ignore */ } this.job = null; }

    runJob(obs, now) {
      const J = this.job, s = this.s, h = s.hands;
      if (J.phase === 'typing') {
        if (now - J.t0 > 25000) { h.stopTyping(); this.endJob(); return false; }
        return true;
      }
      if (J.phase === 'typed') {
        if (!J.typed) { this.endJob(); return false; } // the box went away while typing
        if (!J.f) { J.phase = 'judge'; J.at = now; this.watchDom(); return true; } // typing game: maybe it counts right away
        if (J.plan.submit === false) { this.finish('changed', ''); return true; }
        this.watchDom();
        this.submit(J, obs);
        J.phase = 'judge'; J.at = now;
        return true;
      }
      // judging what happened
      const res = this.judge(J, obs, now);
      if (!res) return true; // still watching
      if (res === 'retry') return true;
      this.finish(res.kind, res.reply);
      return true;
    }
    submit(J, obs) {
      const s = this.s, h = s.hands, mem = this.mem;
      J.submitTries++;
      const how = mem.submit[J.st.sig];
      const viaButton = J.submitTries > 1 || how === 'button' || (J.el && J.el.tagName === 'TEXTAREA' && how !== 'enter');
      if (viaButton) {
        const b = this.submitButton(J, obs);
        if (b) { h.clickElement(b.el); J.how = 'button'; s.reason = '⌨️ clicking "' + b.text + '" to send it'; return; }
      }
      h.submit(J.el); J.how = 'enter';
      s.reason = '⌨️ pressing Enter to send it';
    }
    submitButton(J, obs) {
      const btns = (obs.buttons || []).filter((b) => b.el.isConnected);
      if (!btns.length || !J.f) return null;
      const vw = obs.vw || 1, vh = obs.vh || 1;
      let best = null, bs = Infinity;
      for (const b of btns) {
        const d = Math.hypot(b.x / vw - J.f.x, (b.y / vh - J.f.y) * 1.5);
        const v = d - (SUBMIT_BTN_RX.test(b.text) ? 0.25 : 0) + (b.prio < 0.3 ? 0.4 : 0);
        if (v < bs) { bs = v; best = b; }
      }
      return bs < 0.6 ? best : null;
    }
    judge(J, obs, now) {
      const s = this.s, wait = now - J.at;
      const now2 = this.countTexts(), echo = J.text.toLowerCase();
      const newTexts = [...now2.keys()].filter((t) => now2.get(t) > (J.before.texts.get(t) || 0) && t.length < 300 && !(t.toLowerCase().indexOf(echo) >= 0 && t.length <= echo.length + 4));
      const scoreUp = obs.score != null && J.before.score != null && obs.score > J.before.score;
      const won = (s.brain.stats.wins || 0) > J.before.wins || obs.winVisible;
      if (!J.f) {
        // ⌨️ typing game: did the word go away / points?
        const still = (s.senses.typingWords(this.strongCue()) || []).some((w) => w.s === J.word && w.size >= (J.wordSize || 0) * 0.8);
        if (scoreUp || won || (!still && wait > 150)) return { kind: 'good', reply: '' };
        if (wait < 380) return null;
        const seq = this.mem.tg.submit ? [this.mem.tg.submit] : ['Space', 'Enter'];
        if (J.submitTries < seq.length) { s.hands.tap(seq[J.submitTries]); J.lastSubmit = seq[J.submitTries]; J.submitTries++; J.at = now; return 'retry'; }
        return { kind: 'nothing', reply: '' };
      }
      const fieldGone = !J.el.isConnected || !(obs.fields || []).some((f) => f.el === J.el);
      let valueNow = '';
      try { valueNow = String(J.el.value != null ? J.el.value : J.el.textContent || ''); } catch (e) { /* ignore */ }
      const cleared = valueNow !== J.text;
      const reacted = J.muts > 0 || newTexts.length || cleared || fieldGone || scoreUp || won || (obs.changedFrac || 0) > 0.3;
      if (wait < 700 || (!reacted && wait < 1600) || (reacted && !newTexts.length && wait < 1100)) return null;
      if (!reacted) {
        // Enter did nothing? try the button next to it once
        if (J.submitTries < 2 && this.submitButton(J, obs)) { this.submit(J, obs); J.at = now; return 'retry'; }
        return { kind: 'nothing', reply: '' };
      }
      // what did the game say back? (new text first; if it reused the same text box, read that)
      let reply = newTexts.join(' | ');
      if (!reply && J.muts) reply = (s.senses.textBits || []).map((b) => b.s).filter((t) => t.length < 160 && (GOOD_RX.test(t) || BAD_RX.test(t) || NUM_HIGH_RX.test(t) || NUM_LOW_RX.test(t))).join(' | ');
      if (won || scoreUp) return { kind: 'good', reply };
      if (J.kind === 'number' && J.st.guess && J.st.guess.last != null) {
        if (/too (high|big|large)/i.test(reply)) return { kind: 'high', reply };
        if (/too (low|small)/i.test(reply)) return { kind: 'low', reply };
        if (NUM_HIGH_RX.test(reply) && !NUM_LOW_RX.test(reply)) return { kind: 'high', reply };
        if (NUM_LOW_RX.test(reply) && !NUM_HIGH_RX.test(reply)) return { kind: 'low', reply };
      }
      if (BAD_RX.test(reply) && !GOOD_RX.test(reply)) return { kind: 'bad', reply };
      if (GOOD_RX.test(reply) || (fieldGone && (obs.changedFrac || 0) > 0.2)) return { kind: 'good', reply };
      return { kind: 'changed', reply };
    }

    // 🧠 learn from it + feel something + say something
    finish(kind, reply) {
      const J = this.job, s = this.s, mem = this.mem, now = performance.now();
      this.endJob();
      const st = J.st;
      const short = (reply || '').replace(/\s+/g, ' ').slice(0, 90);
      this.history.push('typed "' + J.text.slice(0, 40) + '"' + (J.f ? ' in the ' + (KIND_WORD[J.kind] || 'box') : '') + ' -> ' + (short ? '"' + short + '"' : kind));
      if (this.history.length > 10) this.history.shift();
      s.recentEvents.push(Math.round((now - (s.sessT0 || now)) / 1000) + 's typed "' + J.text.slice(0, 30) + '" -> ' + (short || kind));
      if (s.recentEvents.length > 14) s.recentEvents.shift();
      if (!J.f) { if (J.from === 'game' || J.from === 'coach') this.finishTypingGame(J, kind, now); return; }
      if (J.how && (kind !== 'nothing')) mem.submit[st.sig] = J.how;
      const isCmd = J.kind === 'command';
      if (isCmd) {
        const verb = J.text.split(' ')[0];
        const v = kind === 'bad' ? -1 : kind === 'nothing' ? -0.3 : 1;
        mem.cmds[J.text] = U.clamp((mem.cmds[J.text] || 0) + v, -3, 3);
        mem.cmds['verb:' + verb] = U.clamp((mem.cmds['verb:' + verb] || 0) + v * 0.5, -3, 3);
        // "go north" not understood? some games only want "north"
        if (kind === 'bad' && /^go /.test(J.text) && (mem.cmds['verb:go'] || 0) <= -1) mem.cmds.__bareDirs = true;
      }
      switch (kind) {
        case 'high': case 'low': {
          const g = st.guess;
          if (kind === 'high') g.hi = g.last - 1; else g.lo = g.last + 1;
          s.heart.feel('curious', 0.08, 'guessing game');
          s.voice.say(kind === 'high' ? 'typeHigh' : 'typeLow', { text: J.text }, 1);
          st.until = now + 500;
          break;
        }
        case 'good': {
          st.neutral = 0; st.bad = 0; st.until = now + 900;
          if (J.kind === 'number') st.guess = null; // next round starts fresh
          if (J.kind === 'name' || J.kind === 'chat') st.done = true;
          if ((/password|answer|text/.test(J.kind) || J.from === 'player') && !J.plan.math) mem.worked[J.memKey] = J.text;
          if (J.kind === 'password' && !mem.cracked) { mem.cracked = true; s.diary('typing', 'Cracked the password in ' + s.game.name + ': "' + J.text + '" 🔐'); }
          s.heart.feel('proud', 0.25, 'typed the right thing'); s.heart.feel('happy', 0.2, 'typed the right thing'); s.heart.feel('bored', -0.2);
          s.pendingFb = Math.max(s.pendingFb || 0, 0.6);
          if (!isCmd || U.chance(0.3)) s.voice.say('typeGood', { text: J.text }, 2);
          break;
        }
        case 'bad': {
          st.bad++; st.until = now + 1200;
          if (!J.plan.math && J.kind !== 'command') { (mem.failed[J.memKey] = mem.failed[J.memKey] || []).push(J.text); if (mem.failed[J.memKey].length > 30) mem.failed[J.memKey].shift(); }
          if (mem.worked[J.memKey] === J.text) delete mem.worked[J.memKey];
          s.heart.feel('mad', 0.06 + 0.06 * s.ai.traits.temper, 'typed the wrong thing'); s.heart.feel('determined', 0.1, 'gonna get it');
          if (!isCmd || U.chance(0.3)) s.voice.say('typeBad', { text: J.text }, 1);
          if (st.bad >= 8) { st.until = now + 40000; st.bad = 0; }
          break;
        }
        case 'changed': {
          st.neutral = 0; st.until = now + 900;
          s.heart.feel('bored', -0.12); s.heart.feel('curious', 0.06, 'seeing what happens');
          if (J.kind === 'name') { st.done = true; if (!mem.namedOnce) { mem.namedOnce = true; s.diary('typing', 'Typed my name into ' + s.game.name + ' ✍️'); } }
          if (isCmd && short && U.chance(0.25)) s.voice.say('story', {}, 0);
          break;
        }
        default: { // nothing happened
          st.neutral++;
          st.until = now + Math.min(120000, 4000 * Math.pow(2, st.neutral));
          if (J.kind === 'name') st.done = true; // (the game probably wants the Start button next)
          if (st.neutral === 2) s.voice.say('typeNothing', {}, 1);
        }
      }
      s.app.coachUpdated && s.app.coachUpdated(s);
    }
    finishTypingGame(J, kind, now) {
      const s = this.s, tg = this.mem.tg;
      const w = this.tgWords.get(J.text) || { tries: 0, at: 0 };
      w.tries++; w.at = now; this.tgWords.set(J.text, w);
      if (kind === 'good') {
        if (!tg.works) { tg.works = true; s.voice.say('typingGame', {}, 2); }
        tg.fails = 0;
        tg.submit = J.lastSubmit || null;
        s.heart.feel('excited', 0.06, 'typing game'); s.heart.feel('proud', 0.04, 'typed it');
        this.tgWords.delete(J.text);
      } else {
        tg.fails = (tg.fails || 0) + 1;
        if (tg.fails >= 3) { tg.fails = 0; tg.works = false; this.tgOffUntil = now + 45000; s.voice.say('typeNothing', {}, 1); }
      }
    }

    // ⌨️ typing games (no text box): type the word on screen
    typingGame(obs, now) {
      const s = this.s;
      if (now < this.tgOffUntil || obs.menuish || obs.gameOverVisible || obs.winVisible || this.s.reading) return false;
      const cue = this.mem.tg.works || this.coachTyping || s.senses.typingCue || /typ(e|ing)|wpm|keyboard|spell/i.test(s.game.name);
      if (!cue) return false;
      const all = s.senses.typingWords(this.strongCue()) || [];
      const big = Math.max(0, ...all.map((w) => w.size));
      const words = all.filter((w) => { const r = this.tgWords.get(w.s); return (!r || r.tries < 2 || now - r.at > 15000) && w.size >= big * 0.6; });
      if (!words.length) return false;
      // falling words: the lowest one first (it's about to hit the ground!) - otherwise the biggest one
      const ys = words.map((w) => w.y);
      const falling = words.length >= 3 && Math.max(...ys) - Math.min(...ys) > 0.15;
      words.sort((a, b) => (falling ? b.y - a.y : b.size - a.size || Math.abs(a.x - 0.5) - Math.abs(b.x - 0.5)));
      const w = words[0];
      const r = this.tgWords.get(w.s);
      const text = r && r.tries >= 1 ? w.s.toLowerCase() : w.s; // 2nd try: lowercase
      this.start({ f: null, text, word: w.s, wordSize: w.size, why: falling ? 'that word is about to land!' : 'typing game!', from: 'game', submit: true }, obs, now);
      return true;
    }
    // a typing TEST (type the whole sentence)? then it types sentences too, and doesn't "read and skip" them
    strongCue() {
      const s = this.s;
      return !!(this.mem.tg.works || /wpm|typing (test|speed|race|game)|type ?racer/i.test(s.game.name) || (s.senses.textBits || []).some((b) => b.s.length < 80 && /\bwpm\b|words? per minute|typing (test|speed|race)|start typing|type the (text|sentence|words?)/i.test(b.s)));
    }
  }
  Typist.solveMath = solveMath;
  return Typist;
})();
