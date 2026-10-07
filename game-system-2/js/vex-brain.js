/* Game System 2.0 — VEX's brain.
   1. A built-in command brain (no AI, works offline) for everything Game System can do. It's checked first,
      so simple things ("play Snake", "timer 5 minutes", "go to settings") never go wrong.
   2. For questions it can't handle, the free AI (Pollinations), or your own key (Claude, OpenAI, Gemini…).
   3. Making and fixing games with the AI (always with a backup you can undo). */
(function () {
  'use strict';

  /* =====================================================================
     TEXT HELPERS
     ===================================================================== */
  var NUMS = {
    zero: 0, a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
    twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, couple: 2, few: 3
  };
  function norm(t) {
    return String(t || '').toLowerCase().replace(/[’']/g, '\'').replace(/[^a-z0-9:.,'\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  /* "hey vex, play snake" → "play snake" */
  function stripWake(t) { return t.replace(/^(hey|yo|ok|okay|hi|hello|ay|ayo)?\s*,?\s*(vex|vexx|vecs|vecks|vax|vics|becks|vix)\b[\s,!.]*/i, '').trim(); }
  /* "can you please play snake" → "play snake" (so commands work however you ask) */
  function lead(t) {
    var prev;
    do {
      prev = t;
      t = t.replace(/^(can you|could you|would you|will you|please|pls|plz|yo|hey|ok|okay|so|um|uh|i want you to|i want to|i wanna|i'?d like you to|i'?d like to|let'?s|go ahead and|just|vex)\b[\s,]*/, '');
    } while (t && t !== prev);
    return t;
  }
  /* "how do I delete a game?" is a question, not "delete a game" */
  function asking(t) { return /^(how|what|why|where|when|who|which|is|are|does|do|did|can i|could i|should i|will it|would it)\b/.test(t); }
  /* word numbers → digits: "twenty five" → "25", "two and a half" → "2.5" */
  function wordsToNums(t) {
    t = t.replace(/\b(\d+|[a-z]+) and a half\b/g, function (m, n) { var v = /^\d+$/.test(n) ? Number(n) : NUMS[n]; return v != null ? String(v + 0.5) : m; });
    t = t.replace(/\bhalf an? (hour|minute)\b/g, '0.5 $1').replace(/\ba half (hour|minute)\b/g, '0.5 $1').replace(/\bquarter of an hour\b/g, '15 minutes');
    t = t.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-](one|two|three|four|five|six|seven|eight|nine)\b/g, function (m, a, b) { return String(NUMS[a] + NUMS[b]); });
    t = t.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|couple|few)\b/g, function (m) { return String(NUMS[m]); });
    t = t.replace(/\ban? (hour|minute|second|min|sec)\b/g, '1 $1');
    return t;
  }
  /* "5 minutes", "1 hour 30 min", "1h30", "90 seconds", "an hour and a half" → ms */
  function parseDuration(text, bareUnit) {
    var t = wordsToNums(norm(text));
    var total = 0, found = false;
    var re = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds)\b/g, m;
    while ((m = re.exec(t))) {
      var n = Number(m[1]), u = m[2];
      total += n * (/^h/.test(u) ? 3600000 : /^m/.test(u) ? 60000 : 1000);
      found = true;
    }
    var hm = /\b(\d+)h(\d+)\b/.exec(t);
    if (hm) { total += Number(hm[1]) * 3600000 + Number(hm[2]) * 60000; found = true; }
    if (!found && bareUnit) {
      var b = /\b(\d+(?:\.\d+)?)\b/.exec(t);
      if (b) { total = Number(b[1]) * bareUnit; found = true; }
    }
    return found && total >= 1000 ? Math.round(total) : null;
  }
  /* "7", "7:30", "7.30", "7 30", "7am", "7:30 pm", "half past 7", "quarter to 8", "noon", "midnight" → "HH:MM" */
  function parseClock(text) {
    var t = wordsToNums(norm(text)).replace(/\b(a\.?m\.?)\b/g, 'am').replace(/\b(p\.?m\.?)\b/g, 'pm');
    if (/\bnoon\b|\bmidday\b/.test(t)) return '12:00';
    if (/\bmidnight\b/.test(t)) return '00:00';
    var h = null, mi = 0, m;
    if ((m = /\bhalf past (\d{1,2})\b/.exec(t))) { h = Number(m[1]); mi = 30; }
    else if ((m = /\bquarter past (\d{1,2})\b/.exec(t))) { h = Number(m[1]); mi = 15; }
    else if ((m = /\bquarter (?:to|till) (\d{1,2})\b/.exec(t))) { h = Number(m[1]) - 1; mi = 45; if (h < 0) h = 23; }
    else if ((m = /\b(\d{1,2})[:.](\d{2})\b/.exec(t))) { h = Number(m[1]); mi = Number(m[2]); }
    else if ((m = /\b(\d{1,2}) (\d{2})\b/.exec(t)) && Number(m[2]) < 60) { h = Number(m[1]); mi = Number(m[2]); }
    else if ((m = /\b(\d{1,2})\s*(am|pm|o'?clock)\b/.exec(t))) { h = Number(m[1]); }
    else if ((m = /\bat (\d{1,2})\b/.exec(t))) { h = Number(m[1]); }
    if (h == null || h > 23 || mi > 59) return null;
    var pm = /\bpm\b|\bin the (evening|afternoon)\b|\btonight\b/.test(t), am = /\bam\b|\bin the morning\b/.test(t);
    if (pm && h < 12) h += 12;
    if (am && h === 12) h = 0;
    if (!pm && !am && h >= 1 && h <= 6 && !/\d{2}:\d{2}/.test(t)) {
      /* "wake me at 7" means 7 in the morning; "at 3" in the afternoon is more likely than 3 at night */
      if (h <= 5 && !/wake|alarm|morning/.test(t)) h += 12;
    }
    return String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0');
  }
  var DAY_WORDS = { sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3, thursday: 4, thu: 4, thur: 4, thurs: 4, friday: 5, fri: 5, saturday: 6, sat: 6 };
  function parseDays(text) {
    var t = norm(text);
    if (/\bevery ?day\b|\bdaily\b|\beach day\b/.test(t)) return [0, 1, 2, 3, 4, 5, 6];
    if (/\bweek ?days\b|\bschool ?days\b|\bmonday (to|through|thru|-) friday\b|\bwork ?days\b/.test(t)) return [1, 2, 3, 4, 5];
    if (/\bweekends?\b/.test(t)) return [0, 6];
    var out = [];
    t.split(/[\s,]+/).forEach(function (w) { var k = w.replace(/s$/, ''); if (DAY_WORDS[k] != null && out.indexOf(DAY_WORDS[k]) < 0) out.push(DAY_WORDS[k]); });
    return out.sort();
  }

  /* fuzzy "which game did you mean" */
  function lev(a, b) {
    if (a === b) return 0;
    var m = a.length, n = b.length;
    if (!m || !n) return m + n;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur.slice();
    }
    return prev[n];
  }
  function clean(s) { return norm(s).replace(/\b(the|game|app|my)\b/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function score(q, name) {
    var a = clean(q), b = clean(name);
    if (!a || !b) return 0;
    if (a === b) return 100;
    /* one or two letters ("a", "go") only count as a whole word, or "delete a game" would match everything */
    if (a.length < 3) return b.split(' ')[0] === a ? 60 : 0;
    if (b.indexOf(a) === 0) return 90 - Math.min(20, b.length - a.length);
    if (b.indexOf(a) >= 0) return 80 - Math.min(20, b.length - a.length);
    if (a.indexOf(b) >= 0) return 70;
    var qt = a.split(' '), nt = b.split(' ');
    var hit = qt.filter(function (w) { return w.length > 1 && nt.some(function (x) { return x === w || (w.length > 3 && (x.indexOf(w) === 0 || lev(x, w) <= 1)); }); }).length;
    var tok = hit ? 40 + 30 * hit / Math.max(qt.length, nt.length) : 0;
    var d = lev(a.replace(/ /g, ''), b.replace(/ /g, ''));
    var ed = d <= Math.max(1, Math.floor(b.length / 4)) ? 75 - d * 8 : 0;
    return Math.max(tok, ed);
  }
  function findThing(q, list) {
    var ranked = list.map(function (g) { return { g: g, s: score(q, g.name) }; }).filter(function (x) { return x.s >= 45; })
      .sort(function (a, b) { return b.s - a.s || (b.g.lastPlayed || 0) - (a.g.lastPlayed || 0); });
    if (!ranked.length) return { best: null, alts: [] };
    var best = ranked[0];
    /* close scores = not sure which one (two games with the same name count too) */
    var close = ranked.filter(function (x) { return x !== best && (x.s === best.s || (best.s < 100 && best.s - x.s < 8)); });
    return { best: !close.length ? best.g : null, alts: close.length ? [best.g].concat(close.map(function (x) { return x.g; })).slice(0, 4) : [] };
  }

  /* =====================================================================
     HOW VEX TALKS (personality)
     ===================================================================== */
  var LINES = {
    hype: {
      hello: ['Yo {name}! What we doing?', 'Ayy {name}! Ready when you are.', 'What\'s good {name}?'],
      ok: ['Bet!', 'Say less.', 'On it!', 'Let\'s gooo!'],
      thanks: ['Anytime {name}!', 'Always got you bro.', 'No problem, that\'s what I\'m here for!'],
      notFound: ['Hmm, I couldn\'t find "{q}". Say the name a different way?', 'No "{q}" in your stuff, bro. Check the spelling?'],
      unknown: ['I didn\'t get that one. Say "help" to see what I can do.', 'Not sure what you mean bro. Try "help".'],
      noAi: ['I can\'t answer that offline. Turn on the free AI in Settings → VEX, or ask me to do something in Game System.']
    },
    calm: {
      hello: ['Hey {name}. What can I do for you?', 'Hi {name}. I\'m here.'],
      ok: ['Okay.', 'Done.', 'Sure thing.'],
      thanks: ['You\'re welcome, {name}.', 'Happy to help.'],
      notFound: ['I couldn\'t find "{q}". Could you say the name another way?'],
      unknown: ['I\'m not sure what you mean. You can say "help" to see what I can do.'],
      noAi: ['I can only answer that with the AI on. You can turn it on in Settings → VEX.']
    },
    sarcastic: {
      hello: ['Oh look, it\'s {name}. What now?', 'Yes {name}, your favorite assistant is listening.'],
      ok: ['Fine. Done.', 'Wow, so hard. Done.', 'Your wish, my command. Unfortunately.'],
      thanks: ['Yeah yeah, you\'re welcome.', 'I know, I\'m amazing.'],
      notFound: ['"{q}"? Never heard of it. Try again, but correctly this time.'],
      unknown: ['Cool story. I have no idea what that means. Try "help".'],
      noAi: ['Big brain questions need the AI turned on. Settings → VEX. You\'re welcome.']
    },
    pro: {
      hello: ['Hello {name}. Ready.', 'Standing by, {name}.'],
      ok: ['Done.', 'Confirmed.', 'Completed.'],
      thanks: ['You\'re welcome.'],
      notFound: ['No match for "{q}".'],
      unknown: ['Command not recognized. Say "help" for the list.'],
      noAi: ['That needs the AI. Enable it in Settings → VEX.']
    }
  };
  function personality() { return LINES[(D.settings.vexPersonality || 'hype')] ? D.settings.vexPersonality || 'hype' : 'hype'; }
  function line(key, vars) {
    var set = LINES[personality()][key] || LINES.hype[key] || [''];
    var s = set[Math.floor(Math.random() * set.length)];
    vars = Object.assign({ name: D.settings.name || 'bro' }, vars || {});
    return s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
  }
  function ok(extra) { return line('ok') + (extra ? ' ' + extra : ''); }

  /* =====================================================================
     DOING THINGS
     ===================================================================== */
  function games() { return D.list('game'); }
  function apps() { return D.list('app'); }
  function everything() { return D.list(); }
  var VIEWS = { home: 'home', library: 'library', games: 'library', apps: 'apps', saves: 'saves', stats: 'stats', settings: 'settings', options: 'settings', trophies: 'trophies', 'trophy room': 'trophies', profile: 'profile' };
  var APP_ALIASES = { music: 'gs2-music', songs: 'gs2-music', notes: 'gs2-notes', calculator: 'gs2-calculator', calc: 'gs2-calculator', drawing: 'gs2-drawing', draw: 'gs2-drawing', paint: 'gs2-drawing', gallery: 'gs2-gallery', photos: 'gs2-gallery', pictures: 'gs2-gallery', screenshots: 'gs2-gallery', video: 'gs2-video', videos: 'gs2-video', youtube: 'gs2-video', timer: 'gs2-timer', timers: 'gs2-timer', stopwatch: 'gs2-timer', alarm: 'gs2-timer', alarms: 'gs2-timer', code: 'gs2-code', coding: 'gs2-code' };
  function fmtTime(ms) { return Timers.fmtDur(ms); }
  function niceClock(hm) { return new Date(2000, 0, 1, Number(hm.slice(0, 2)), Number(hm.slice(3, 5))).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  function playedMs(range) {
    var now = new Date();
    var total = 0;
    var days = range === 'today' ? 1 : range === 'week' ? 7 : range === 'month' ? 30 : 0;
    if (!days) return everything().reduce(function (s, g) { return s + (g.playTime || 0) + (D.pendingPlay[g.id] || 0); }, 0);
    for (var i = 0; i < days; i++) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 12);
      var rec = D.days[U.dayKey(d.getTime())] || {};
      Object.keys(rec).forEach(function (k) { total += rec[k]; });
    }
    Object.keys(D.pendingPlay).forEach(function (k) { total += D.pendingPlay[k]; });
    return total;
  }

  /* send a command to the Music app (opens it in the background if needed) */
  async function music(cmd) {
    var id = 'gs2-music';
    if (!D.get(id)) return 'The Music app is gone. You can bring it back from the Apps tab.';
    var opened = false;
    if (!Win.isOpen(id)) { await Win.open(id); opened = true; await U.sleep(900); if (cmd !== 'pause') Win.minimizeAll(); }
    var reply = await new Promise(function (resolve) {
      var done = false;
      Win.dispatch(id, 'gs2remote', { cmd: cmd, reply: function (r) { done = true; resolve(r); } });
      setTimeout(function () { if (!done) resolve(null); }, opened ? 4000 : 1500);
    });
    if (reply && reply.error === 'empty') return 'Your Music app has no songs yet. Open it and add some!' + (opened ? '' : '');
    if (cmd === 'what') return reply && reply.title ? 'That\'s "' + reply.title + '".' : 'Nothing is playing right now.';
    if (!reply) return 'The Music app didn\'t answer. Try opening it once.';
    var words = { play: reply.title ? 'Playing "' + reply.title + '".' : 'Playing.', pause: 'Paused.', next: reply.title ? 'Next up: "' + reply.title + '".' : 'Next song.', prev: reply.title ? 'Going back to "' + reply.title + '".' : 'Previous song.', shuffle: reply.shuffle ? 'Shuffle is on.' : 'Shuffle is off.', louder: 'Louder.', quieter: 'Quieter.' };
    return words[cmd] || ok();
  }

  /* folders: sort games into folders by what they look like */
  var FOLDER_RULES = [
    ['Racing', /race|racing|car|drift|kart|drive|moto|bike/], ['Shooters', /gun|shoot|sniper|fps|war|aim|zombie|battle royale/],
    ['Fighting', /fight|sword|ninja|samurai|knight|boxing|brawl/], ['Space', /space|rocket|galaxy|alien|asteroid|planet|star/],
    ['Horror', /horror|ghost|haunt|scary|creepy|skull|nightmare/], ['Casino & cards', /casino|slot|poker|blackjack|card|roulette|jackpot|dice|gambl/],
    ['Puzzle', /puzzle|tetris|block|match|sudoku|maze|2048|word|quiz/], ['Sports', /soccer|football|basket|golf|tennis|ball|hockey|baseball|pong/],
    ['Building', /craft|mine|build|sandbox|city|tycoon|farm/], ['Clickers', /clicker|idle|cookie|incremental/], ['Platformers', /jump|platform|runner|dash|mario|parkour/],
    ['Music', /music|rhythm|beat|piano|dance/]
  ];
  function planSort() {
    var plan = {};
    games().forEach(function (g) {
      if (g.folder) return;
      var text = (g.name + ' ' + (g.desc || '')).toLowerCase();
      var rule = FOLDER_RULES.find(function (r) { return r[1].test(text); });
      if (rule) (plan[rule[0]] = plan[rule[0]] || []).push(g);
    });
    Object.keys(plan).forEach(function (k) { if (plan[k].length < 2 && !D.folders().some(function (f) { return f.name === k; })) delete plan[k]; });
    return plan;
  }

  /* =====================================================================
     THE COMMANDS
     Each: test(text) → match or null, run(match, text) → reply (string or {text, ...})
     ===================================================================== */
  var pending = null;   /* waiting for "yes/no" or "which one" */
  function needOk(text, run, big) {
    var mode = D.settings.vexAsk || 'big';
    if (mode === 'never' || (mode === 'big' && !big)) return run();
    pending = { kind: 'confirm', run: run };
    return { text: text, chips: ['Yes', 'No'], expect: true };
  }
  function askWhich(list, run, verb) {
    pending = { kind: 'which', list: list, run: run };
    /* same names? tell them apart */
    var labels = list.map(function (g, i) {
      var twin = list.some(function (o, j) { return j !== i && o.name === g.name; });
      if (!twin) return g.name;
      return g.name + ' (' + (g.folder ? 'in ' + g.folder : D.isApp(g) ? 'app' : g.lastPlayed ? 'played ' + U.timeAgo(g.lastPlayed) : 'added ' + U.timeAgo(g.created)) + ')';
    });
    return { text: 'Which one' + (verb ? ' should I ' + verb : '') + '? ' + labels.map(function (l, i) { return (i + 1) + '. ' + l; }).join(', ') + '.', chips: labels.map(function (l, i) { return (i + 1) + '. ' + l; }), expect: true };
  }
  /* find a game/app by name, or ask which, or say not found */
  function withThing(q, list, verb, run) {
    var f = findThing(q, list);
    if (f.best) return run(f.best);
    if (f.alts.length) return askWhich(f.alts, run, verb);
    return line('notFound', { q: q.trim() });
  }

  var CMDS = [
    /* ---- something is ringing: "stop" / "okay" turns it off ---- */
    { test: /^(stop|stop it|stop ringing|ok|okay|shut up|be quiet|quiet|silence|turn it off|i'?m up|i'?m awake|dismiss|enough)[\s!.]*$/, run: function () {
      if (!Timers.ringing()) return null;
      while (Timers.ringing()) Timers.dismissTop();
      return ok('Stopped.');
    } },

    /* ---- small talk ---- */
    { test: /^(hi|hello|hey|yo|sup|what'?s up|wassup|howdy|good (morning|afternoon|evening))\b[\s!.]*$/, run: function () { return line('hello'); } },
    { test: /^(thanks|thank you|thx|ty|appreciate it)\b|^(nice|cool|awesome|good job|great|perfect|sweet|lit)( one| bro| vex| man| dude)?[\s!.]*$/, run: function () { return line('thanks'); } },
    { test: /\b(who are you|what are you|your name|what is vex|who is vex)\b/, run: function () {
      return 'I\'m VEX, your helper inside Game System. I can open games, make folders, set timers, play music, take screenshots, make and fix games, and answer questions. Say "help" for more.';
    } },
    { test: /^(help|what can you do|commands|how do (i|you) use (you|vex)|what do you do)\b/, run: function () {
      return { text: 'Here\'s some stuff I can do:\n• "Play Snake" / "open Music" / "go to settings"\n• "Timer 5 minutes" / "alarm 7:30 on school days" / "how long is left?"\n• "Play music" / "next song" / "pause the music"\n• "Take a screenshot" / "record this" / "stop recording"\n• "Put Snake in Arcade folder" / "sort my games into folders"\n• "Favorite Snake" / "rename Snake to Snake 2"\n• "Make a game where you dodge lava" / "fix Snake"\n• "How long did I play today?" / "what\'s my level?"\n• "Change theme to lava" / "turn on simple mode"\n• "Remember that I like racing games"\nOr just ask me anything about Game System.', speak: 'I can open games and apps, set timers and alarms, control music, take screenshots and recordings, sort folders, make and fix games, and answer questions. Check the list on screen!' };
    } },
    { test: /\b(tell me a secret|got any secrets|know any secrets|what'?s the secret)\b/, run: function () {
      Trophies.event('vex-secret');
      var s = ['Secret: type ↑ ↑ ↓ ↓ ← → ← → B A on the menu. Don\'t tell anyone.', 'Secret: click the Game System logo 10 times really fast. Trust me.', 'Secret: try changing your name to VEX. I\'m flattered.'];
      return s[Math.floor(Math.random() * s.length)];
    } },
    { test: /\b(tell me a joke|tell (me )?(another|a funny) one|say something funny|make me laugh|know any jokes|another joke)\b|^jokes?[\s!.]*$/, run: function () {
      var j = ['Why did the gamer bring a ladder? To reach the next level.', 'I told my computer I needed a break. It said: "No problem, I\'ll go to sleep."', 'Why don\'t skeletons play video games? They don\'t have the guts.', 'What\'s a ghost\'s favorite game? Hide and shriek.', 'My code has no bugs. It just has surprise features.'];
      return j[Math.floor(Math.random() * j.length)];
    } },
    { test: /\bwhat('?s| is) the time\b|\bwhat time is it\b/, run: function () { return 'It\'s ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '.'; } },
    { test: /\bwhat('?s| is) (the |today'?s )?date\b|\bwhat day is (it|today)\b/, run: function () { return 'Today is ' + new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) + '.'; } },

    /* ---- the old Game System's games, still in this browser ---- */
    { test: /\b(bring|move|get|import|find|transfer|copy)( over| back| in)? (all )?(of )?(my )?(old|previous) (games|stuff|saves|apps|progress|data|game system)\b|\bold game system\b/, run: async function () {
      var found = await OldGS.scan();
      if (!found) return 'I don\'t see your old Game System in this browser. It has to be the same website and the same browser you used the old one in.';
      var fresh = found.items.filter(function (x) { return x.ok && !x.here; }).length;
      var song = found.music && !found.musicHere;
      if (!fresh && !song) return 'Your old games are already here, bro. Check your Library!';
      Vex.closeSoon();
      setTimeout(function () { OldGS.offer(false); }, 500);
      return fresh ? 'Found ' + fresh + ' of your old games and apps! Check the list and hit the button.' : 'Your old games are already here. Your old menu song isn\'t in Music yet though.';
    } },

    /* ---- making + fixing games (AI). Checked early, so the idea can say anything ("skip rope", "play music"…) ---- */
    { test: /^(make|create|build|code|generate|design) (me )?(a |an |another |one more |my own )?((new|cool|fun|simple|small|little|video|mini|web|browser|3d|2d|quick) )*(game|app)\b(.*)$/, run: function (m) {
      var kind = m[6] === 'app' ? 'app' : 'game';
      var idea = (m[7] || '').replace(/^\s*(where|about|that|with|like|called|in which|for)?\s*/, '').trim();
      if (idea.length < 3) { pending = { kind: 'idea', gameKind: kind }; return { text: 'What should the ' + kind + ' be about? Like "dodge falling lava" or "a space shooter".', expect: true }; }
      return needOk('Make a ' + kind + ' about "' + idea + '"? It takes a minute.', function () { return makeThing(idea, kind); }, true);
    } },
    { test: /^(undo|put it back|undo (the |that )?fix)\b/, noAi: true, run: function () { return undoFix(); } },
    { test: /^(fix|repair|debug)\s+(.+?)(\s+(because|it|the|so)\b(.*))?$/, run: function (m) {
      var q = m[2], problem = (m[5] || '').trim();
      if (/^(it|this|that|the game)$/.test(q)) q = Player.isPlaying() ? (D.get(Player.currentId()) || {}).name || '' : D.ui.sel && D.get(D.ui.sel) ? D.get(D.ui.sel).name : '';
      if (!q) return 'Which game should I fix?';
      return withThing(q, everything().filter(function (g) { return g.source !== 'link'; }), 'fix', function (g) {
        return needOk('Fix "' + g.name + '"? I\'ll keep a backup so you can undo it.', function () { return fixThing(g, problem); }, true);
      });
    } },

    /* ---- screenshots + recording ---- */
    { test: /\b(take|grab|snap) (a |an )?(screen ?shot|picture|pic|photo)\b|^screen ?shot\b/, run: function () { setTimeout(function () { Capture.shot(); }, Vex.panelOpen() ? 700 : 100); Vex.closeSoon(); return 'Say cheese!'; } },
    { test: /\b(stop|end|finish) (the )?record(ing)?\b/, run: function () { if (!Capture.isRecording()) return 'I\'m not recording right now.'; Capture.stopRec(); return 'Stopped. It\'s in your Gallery.'; } },
    /* only real "record" requests ("what's my record?" is not one) */
    { test: /^record\b(?! of| for)|\b(start|begin) (a |the )?(screen )?record(ing)?\b|\brecord (this|that|it|the game|my game|a video|video|me|my screen|the screen|gameplay)\b|\bclip (that|this|it)\b|\bscreen ?record\b|\b(make|take) (a |an )?(recording|video clip)\b/, run: function () { if (Capture.isRecording()) return 'Already recording! Say "stop recording" when you\'re done.'; Vex.closeSoon(); setTimeout(function () { Capture.startRec(); }, 700); return 'Recording! Say "stop recording" when you\'re done.'; } },

    /* ---- timers + alarms ---- */
    { test: /\b(how (much|long)( time)? (is )?(left|remaining)|time left|how long left|when is my timer)\b/, run: function () {
      var run = Timers.list().filter(function (t) { return t.state === 'run' || t.state === 'pause'; });
      if (!run.length) return 'No timers running.';
      return run.map(function (t) { return (t.label || 'Your timer') + ': ' + fmtTime(t.left) + (t.state === 'pause' ? ' (paused)' : '') + ' left'; }).join('. ') + '.';
    } },
    /* "stop the timer", "turn off the 7:30 alarm", "delete all alarms". A ringing alarm is only stopped (never deleted). */
    { test: /\b(stop|cancel|delete|clear|turn off|remove|disable|dismiss|silence) (.{0,24}?)(timers?|alarms?)\b/, run: function (m, t) {
      if (/\bapps?\b/.test(t)) return null;   /* "delete the timer app" */
      var alarms = /^alarm/.test(m[3]), all = /\ball\b/.test(t), del = /\b(delete|remove|clear)\b/.test(t);
      var rang = 0;
      while (Timers.ringing()) { Timers.dismissTop(); rang++; }
      if (rang && !del && !all) return ok(alarms ? 'Alarm off.' : 'Stopped.');
      var hm = /\d/.test(t) ? parseClock(t) : null;
      var mid = norm(m[2]).replace(/\d{1,2}([:.]\d{2})?\s*(am|pm)?/g, ' ').replace(/\b(the|my|all|that|this|a|an|of|minute|minutes|second|seconds|hour|hours)\b/g, ' ').replace(/\s+/g, ' ').trim();
      if (alarms) {
        var list = Timers.alarms().filter(function (a) { return a.on; });
        if (hm) list = list.filter(function (a) { return a.time === hm; });
        else if (mid) { var named = list.filter(function (a) { return a.label && norm(a.label).indexOf(mid) >= 0; }); if (named.length) list = named; }
        if (!list.length) return rang ? ok('Stopped.') : hm ? 'You don\'t have an alarm at ' + niceClock(hm) + '.' : 'You have no alarms on.';
        if (all || list.length === 1) {
          list.forEach(function (a) { if (del) Timers.removeAlarm(a.id); else Timers.editAlarm(a.id, { on: false }); });
          var what = list.length === 1 ? 'The ' + niceClock(list[0].time) + ' alarm is ' : 'All ' + list.length + ' alarms are ';
          return ok(what + (del ? 'deleted.' : 'off. You can turn ' + (list.length === 1 ? 'it' : 'them') + ' back on in the Timer app.'));
        }
        return 'You have ' + list.length + ' alarms on. Say which one, like "turn off the ' + niceClock(list[0].time) + ' alarm", or "turn off all alarms".';
      }
      var ts = Timers.list().filter(function (x) { return x.state !== 'done'; });
      if (mid) { var nt = ts.filter(function (x) { return x.label && norm(x.label).indexOf(mid) >= 0; }); if (nt.length) ts = nt; }
      if (!ts.length) return rang ? ok('Stopped.') : 'No timers running.';
      ts.forEach(function (x) { Timers.remove(x.id); });
      return ok(ts.length === 1 ? 'Timer stopped.' : 'Stopped ' + ts.length + ' timers.');
    } },
    { test: /\b(pause) (the |my )?timer\b/, run: function () { var t = Timers.list().find(function (x) { return x.state === 'run'; }); if (!t) return 'No timer running.'; Timers.pause(t.id); return ok('Timer paused.'); } },
    { test: /\b(resume|continue|unpause) (the |my )?timer\b/, run: function () { var t = Timers.list().find(function (x) { return x.state === 'pause'; }); if (!t) return 'No paused timer.'; Timers.resume(t.id); return ok('Timer going again.'); } },
    { test: /\balarms?\b|\bwake me( up)?\b/, run: function (m, t) {
      if (/\b(list|what|show|my alarms|any)\b/.test(t) && !/\d/.test(t)) {
        var on = Timers.alarms().filter(function (a) { return a.on; });
        return on.length ? 'Your alarms: ' + on.map(function (a) { return niceClock(a.time) + (a.label ? ' (' + a.label + ')' : ''); }).join(', ') + '.' : 'No alarms on.';
      }
      if (/\bapps?\b/.test(t)) return null;   /* "open the alarm app" */
      var hm = parseClock(t);
      if (!hm) {
        if (asking(t)) return null;   /* "how do alarms work?" */
        pending = { kind: 'more', prefix: 'alarm ', fits: function (x) { return !!parseClock(x); } };
        return { text: 'What time? Like "alarm 7:30 on school days".', expect: true };
      }
      /* the name: whatever comes after "called" / "for", once the time and days are taken out */
      var rest = t.replace(/\d{1,2}([:.]\d{2})?\s*(am|pm|o'?clock)?/g, ' ')
        .replace(/\b(on |every |each )?(school ?days?|week ?days?|work ?days?|weekends?|every ?day|daily|each day|(sun|mon|tue|tues|wed|wednes|thu|thur|thurs|fri|sat|satur)(day)?s?)\b/g, ' ')
        .replace(/\b(in the )?(morning|evening|afternoon|night)\b|\b(tonight|tomorrow|today)\b/g, ' ')
        .replace(/\b(half past|quarter past|quarter to|quarter till|noon|midnight|midday)\b/g, ' ')
        .replace(/\s+/g, ' ').trim();
      var lm = /\b(?:called|named|label(?:ed)?|for)\s+(?:the |a |an |my )?(.+)$/.exec(rest);
      var label = lm ? lm[1].replace(/(\s+(at|on|every))+$/, '').trim() : '';
      var days = parseDays(t);
      Timers.addAlarm({ time: hm, days: days, label: label.slice(0, 40) });
      return ok('Alarm set for ' + niceClock(hm) + (days.length === 7 ? ' every day' : days.join() === '1,2,3,4,5' ? ' on school days' : days.join() === '0,6' ? ' on weekends' : days.length ? ' on ' + days.map(function (d) { return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]; }).join(', ') : '') + (label ? ' (' + label + ')' : '') + '.');
    } },
    { test: /\b(set (a |the )?timer|timer for|timer|countdown|remind me in|count down)\b/, run: function (m, t) {
      var ms = parseDuration(t, 60000);
      if (!ms) {
        if (asking(t) || /\b(open|launch|show|go to|close|apps?)\b/.test(t)) return null;   /* "open the timer app" */
        pending = { kind: 'more', prefix: 'timer ', fits: function (x) { return !!parseDuration(x, 60000); } };
        return { text: 'How long? Like "timer 5 minutes".', expect: true };
      }
      var label = ((/\b(?:called|named|label(?:ed)?)\s+(.+)$/.exec(t) || /\bfor (?:the |my )?([a-z][a-z ]{1,30})$/.exec(t.replace(parseDurText(t), ' ').replace(/\s+/g, ' ').trim()) || [])[1] || '');
      label = label.replace(parseDurText(label), ' ').replace(/\b(timer|minutes?|seconds?|hours?)\b/g, ' ').replace(/\s+/g, ' ').trim();
      var rem = /remind me in .+? to (.+)$/.exec(t);
      if (rem) label = rem[1];
      Timers.add({ ms: ms, label: label.trim().slice(0, 40) });
      return ok('Timer set for ' + fmtTime(ms) + (label ? ' (' + label.trim() + ')' : '') + '.');
    } },
    { test: /\b(start|open) (the |a )?stop ?watch\b/, run: function () { Win.open('gs2-timer'); return 'Opening the Timer app. The stopwatch is the middle tab.'; } },

    /* ---- music ---- */
    { test: /\b(what('?s| is) (this|that) song|what song is (this|playing)|song name)\b/, run: function () { return music('what'); } },
    { test: /\b(turn (the )?(music|song) (up|down)|(music|song) (louder|quieter|softer|up|down)|(louder|quieter|softer) music)\b/, run: function (m, t) { return music(/\b(up|louder)\b/.test(t) ? 'louder' : 'quieter'); } },
    { test: /\b(pause|stop) (the )?(music|song|songs)\b|^(pause|stop) music\b/, run: function () { return music('pause'); } },
    { test: /^(next|skip)( (the |this |that )?(song|track|one))?( please)?[\s!.]*$|\b(next|skip( the| this| that)?) (song|track)\b/, run: function () { return music('next'); } },
    { test: /\b(previous|last|go back a) (song|track)\b|^previous( song)?[\s!.]*$/, run: function () { return music('prev'); } },
    { test: /^shuffle\b|\bshuffle (the |my )?(music|songs|playlist|it)\b|\b(turn|switch) (on|off) shuffle\b|\bshuffle (on|off)\b/, run: function () { return music('shuffle'); } },
    { test: /\b(play|put on|start|resume) (some |the |my )?(music|songs|tunes|beats)\b/, run: function () { return music('play'); } },

    /* ---- settings ---- */
    { test: /\b(turn|switch) (on|off) (the )?(menu music|background music)\b|\b(menu|background) music (on|off)\b/, run: function (m, t) { var on = /\bon\b/.test(t); D.settings.menuMusic = on; D.saveSettings(); App.applySettings(); return ok('Menu music ' + (on ? 'on.' : 'off.')); } },
    { test: /\b(turn|switch) (on|off) simple mode\b|\bsimple mode (on|off)\b|\b(use|go to|switch to) (simple|pro) mode\b/, run: function (m, t) { var simple = /\bsimple mode on\b|\bon simple\b|(use|go to|switch to) simple/.test(t); D.settings.mode = simple ? 'simple' : 'pro'; D.saveSettings(); App.applySettings(); App.refresh(); return ok((simple ? 'Simple' : 'Pro') + ' mode on.'); } },
    { test: /\b(turn|switch) (on|off) (the )?(sounds?|clicks)\b|\b(mute|unmute) (the )?(menu )?sounds?\b/, run: function (m, t) { var on = /\bon\b|unmute/.test(t); D.settings.sounds = on; D.saveSettings(); App.applySettings(); return ok('Menu sounds ' + (on ? 'on.' : 'off.')); } },
    { test: /\b(louder|volume up|turn (it )?up)\b/, run: function () { D.settings.volume = Math.min(1, (D.settings.volume == null ? 0.55 : D.settings.volume) + 0.15); D.saveSettings(); App.applySettings(); return ok('Louder.'); } },
    { test: /\b(quieter|volume down|turn (it )?down|softer)\b/, run: function () { D.settings.volume = Math.max(0, (D.settings.volume == null ? 0.55 : D.settings.volume) - 0.15); D.saveSettings(); App.applySettings(); return ok('Quieter.'); } },
    { test: /\b(make|create|design|build) (me )?(a |an |my own |my )?(new )?(theme|look)\b/, run: function () {
      App.go('settings');
      setTimeout(function () { var b = document.querySelector('.th-new'); if (b) { b.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(function () { b.click(); }, 400); } }, 250);
      return 'Opening the theme maker. Describe it or pick a picture!';
    } },
    { test: /\b(change|switch|set|use|put on) (the )?(theme|look)( to)? ([a-z ]+)|\b([a-z]+) theme\b/, run: function (m, t) {
      var asked = /\b(change|switch|set|use|put on|turn on)\b/.test(t);
      var want = norm(t).replace(/\b(change|switch|set|use|put on|turn on|the|theme|look|to|please|my)\b/g, ' ').replace(/\s+/g, ' ').trim();
      if (!want) return null;
      var list = Themes.list();
      var th = list.find(function (x) { return norm(x.name).indexOf(want) >= 0 || x.id === want; });
      if (!th) return asked ? 'I don\'t have a "' + want + '" theme. You have: ' + list.filter(function (x) { return !x.locked; }).map(function (x) { return x.name; }).join(', ') + '.' : null;
      if (th.locked) return th.name + ' unlocks at level ' + th.level + '. You\'re level ' + Trophies.info().level + '. Get some trophies!';
      D.settings.theme = th.id; D.saveSettings(); App.applySettings(); Trophies.event('theme', { id: th.id });
      return ok(th.name + ' theme on.');
    } },
    { test: /\b(back ?up|make a backup|save everything)\b/, run: function () { return needOk('Make a backup of everything now? It downloads a .zip file.', function () { Backup.exportAll(); return 'Making your backup. Keep that zip somewhere safe!'; }, true); } },
    { test: /^(check for )?updates?[\s!.?]*$|\b(check|look) for (an? |any )?updates?\b|\bupdate (game system|yourself|the app)\b|\bany updates?\b|\bis there an? (new )?update\b/, run: function () { App.checkUpdate(); return 'Checking for updates.'; } },

    /* ---- VEX itself ---- */
    { test: /\b(stop talking|be quiet|shut up|mute yourself|don'?t talk)\b/, noAi: true, run: function () { D.settings.vexSpeak = false; D.saveSettings(); return 'Okay, I\'ll just type from now on. Say "talk to me" to hear me again.'; } },
    { test: /^(talk to me|speak|speak up|speak out loud|use your voice|talk out loud|start talking|unmute yourself|talk again)[\s!.]*$/, run: function () { D.settings.vexSpeak = true; D.saveSettings(); return 'Alright, I\'m talking again!'; } },
    { test: /\b(stop listening|stop hearing|turn off (the )?(mic|listening))\b/, noAi: true, run: function () { Vex.setListening(false); return 'I stopped listening. Turn it back on in Settings → VEX, or press my key.'; } },
    { test: /\b(vex settings|change your voice|your settings|customi[sz]e (you|vex))\b/, run: function () { App.go('settings'); setTimeout(function () { var s = document.getElementById('set-vex'); if (s) s.scrollIntoView({ behavior: 'smooth' }); }, 200); return 'Here are my settings.'; } },

    /* ---- memory ---- */
    { test: /^(remember|don'?t forget|note) (that )?(.+)/, run: function (m, t, raw) {
      var keep = /(?:^|\b)(?:remember|don'?t forget|note)\s+(?:that\s+)?(.+)$/i.exec(raw);
      var what = (keep ? keep[1] : m[3]).replace(/[.!]+$/, '').trim();
      Vex.remember(what);
      return 'Got it, I\'ll remember: ' + what + '.';
    } },
    { test: /\bwhat do you (remember|know about me)\b|\bwhat have i told you\b/, run: function () { var mem = Vex.memories(); return mem.length ? 'I remember: ' + mem.map(function (x) { return x.text; }).join('; ') + '.' : 'Nothing yet. Say "remember that…" and I will.'; } },
    { test: /^forget (everything|all|it all)\b/, noAi: true, run: function () { return needOk('Forget everything you told me to remember?', function () { Vex.forget(); return 'Done. Fresh start.'; }, true); } },
    { test: /^forget (that )?(.+)/, noAi: true, run: function (m) { var n = Vex.forget(m[2]); return n ? 'Forgot it.' : 'I don\'t remember anything like "' + m[2] + '".'; } },

    /* ---- stats ---- */
    { test: /\bhow (long|much) (did|have) i (play|played|been playing)\b|\bplay ?time\b|\bhow much did i play\b/, run: function (m, t) {
      var range = /\btoday\b/.test(t) ? 'today' : /\bweek\b/.test(t) ? 'week' : /\bmonth\b/.test(t) ? 'month' : /\b(total|ever|all)\b/.test(t) ? 'all' : 'today';
      var ms = playedMs(range);
      var word = { today: 'today', week: 'in the last 7 days', month: 'in the last 30 days', all: 'in total' }[range];
      return 'You played ' + (ms < 60000 ? 'less than a minute' : U.fmtDuration(ms)) + ' ' + word + '.' + (range === 'today' && ms > 3 * 3600000 ? ' Maybe take a break, bro!' : '');
    } },
    { test: /\b(most played|favou?rite game|play the most|played the most)\b/, run: function () {
      var top = everything().slice().sort(function (a, b) { return (b.playTime || 0) - (a.playTime || 0); })[0];
      return top && top.playTime ? 'Your most played is ' + top.name + ' with ' + U.fmtDuration(top.playTime) + '.' : 'You haven\'t played anything yet!';
    } },
    { test: /\b(my level|what level|how many trophies|trophies do i have|my points)\b/, run: function () { var i = Trophies.info(); return 'You\'re level ' + i.level + ' (' + i.title + ') with ' + i.points + ' points and ' + i.got + ' of ' + i.total + ' trophies. ' + (i.next - i.points) + ' more points to level ' + (i.level + 1) + '.'; } },
    { test: /\bhow many (games|apps)\b/, run: function (m, t) { return /apps/.test(t) ? 'You have ' + apps().length + ' apps.' : 'You have ' + games().length + ' games.'; } },
    { test: /\b(what should i play|recommend|suggest a game|i'?m bored|give me a game)\b/, run: function () {
      var list = games();
      if (!list.length) return 'You don\'t have any games yet! Hit Add, or ask me to make one.';
      var fresh = list.filter(function (g) { return !g.lastPlayed; });
      var pick = fresh.length ? fresh[Math.floor(Math.random() * fresh.length)] : list.slice().sort(function (a, b) { return (a.lastPlayed || 0) - (b.lastPlayed || 0); })[0];
      pending = { kind: 'confirm', run: function () { Player.launch(pick.id); return 'Have fun!'; } };
      return { text: (fresh.length ? 'You never played ' + pick.name + '. ' : 'You haven\'t played ' + pick.name + ' in a while. ') + 'Want to play it?', chips: ['Yes', 'No'], expect: true };
    } },
    { test: /^(give me a |any |a )?tips?[\s!.?]*$|\bgive me a tip\b|\bany tips\b|\btip of the day\b/, run: function () {
      var tips = ['Right-click (or hold) any game for options like folders and favorites.', 'Press your screenshot key in a game to grab a picture, then use it as the game\'s cover.', 'Games with the Save Kit continue right where you left off. Hit "Make it continue" on a game to upgrade it.', 'Drag one game onto another to make a folder, like on a phone.', 'Settings → Screenshots & recording lets you pick your own keys.', 'Make a backup every week so you never lose your stuff.', 'Say "timer 10 minutes" and I\'ll ring over your game when it\'s done.'];
      return tips[Math.floor(Math.random() * tips.length)];
    } },

    /* ---- folders, favorites, rename, delete ---- */
    { test: /\b(sort|organi[sz]e|clean up|tidy) (up )?(my |the )?(games|library|stuff)( into folders)?\b/, run: function () {
      var plan = planSort();
      var keys = Object.keys(plan);
      if (!keys.length) return 'Your games look sorted already (or I can\'t tell what kind they are from their names).';
      var desc = keys.map(function (k) { return k + ' (' + plan[k].length + ')'; }).join(', ');
      return needOk('I\'d make these folders: ' + desc + '. Do it?', async function () {
        for (var i = 0; i < keys.length; i++) for (var j = 0; j < plan[keys[i]].length; j++) await D.updateGame(plan[keys[i]][j].id, { folder: keys[i] });
        Trophies.event('folder');
        App.go('library');
        return ok('Sorted into ' + keys.length + ' folder' + (keys.length === 1 ? '' : 's') + '.');
      }, true);
    } },
    { test: /^(put|move|add) (.+?) (in|into|to) (the |my |a )?(.+?)( folder)?$/, run: function (m, t) {
      if (!/folder/.test(t) && !D.folders().some(function (f) { return norm(f.name) === norm(m[5]); })) return null;
      var folder = m[5].replace(/\bfolder\b/g, '').trim();
      return withThing(m[2], games(), 'move', async function (g) { await D.updateGame(g.id, { folder: titleCase(folder).slice(0, 40) }); Trophies.event('folder'); return ok(g.name + ' is in ' + titleCase(folder) + ' now.'); });
    } },
    { test: /^(take|remove|move|get) (.+?) out of (the |its |a |my )?([a-z0-9 ]+ )?folder\b/, run: function (m) { return withThing(m[2], games(), 'take out', async function (g) { await D.updateGame(g.id, { folder: '' }); return ok(g.name + ' is out of its folder.'); }); } },
    { test: /^(?:un ?favou?rite|unstar) (.+)$|^(?:remove|take) (.+?) (?:from|off|out of) (?:my |the )?favou?rites$/, run: function (m) { var q = (m[1] || m[2]).trim(); return withThing(q, everything(), 'unfavorite', async function (g) { await D.updateGame(g.id, { fav: false }); return ok(g.name + ' is not a favorite anymore.'); }); } },
    { test: /^(?:favou?rite|star) (.+)$|^(?:add|put) (.+?) (?:to|in|into) (?:my |the )?favou?rites$|^make (.+?) (?:a |my )?favou?rite$/, run: function (m) { var q = (m[1] || m[2] || m[3]).trim(); return withThing(q, everything(), 'favorite', async function (g) { await D.updateGame(g.id, { fav: true }); return ok(g.name + ' is a favorite now.'); }); } },
    { test: /^rename (.+?) (to|as) (.+)$/, noAi: true, run: function (m) { var to = m[3].trim().slice(0, 60); return withThing(m[1], everything(), 'rename', function (g) { var old = g.name; return needOk('Rename "' + old + '" to "' + titleCase(to) + '"?', async function () { await D.updateGame(g.id, { name: titleCase(to) }); return ok('Renamed to ' + titleCase(to) + '.'); }); }); } },
    { test: /^(delete|remove|uninstall) (.+)$/, noAi: true, run: function (m) {
      var q = m[2].replace(/\b(the|game|app|please|for me)\b/g, ' ').replace(/\s+/g, ' ').trim();
      if (!q || /^(it|this|that|everything|all|all games|all my games|my games|games|all of them|a|an|one)$/.test(q)) return 'Tell me which one by name. (I won\'t delete everything, that\'s in Settings → Danger zone.)';
      return withThing(q, everything(), 'delete', function (g) { setTimeout(function () { Views.deleteGames([g.id]); }, 300); return 'Okay, check the box that popped up to make sure.'; });
    } },

    /* ---- going places ---- */
    { test: /\b(go to|open|show( me)?|take me to)( the| my)? (home|library|games|apps|saves|stats|settings|options|trophies|trophy room|profile)\b/, run: function (m) {
      var v = VIEWS[m[4]];
      if (v === 'trophies') { Trophies.open(); return 'Here\'s your trophy room.'; }
      if (v === 'profile') { Trophies.profile(); return 'Here\'s your profile.'; }
      App.go(v); return ok();
    } },
    { test: /^(search|find|look for|where is|where'?s) (for )?(.+)$/, run: function (m) {
      var q = m[3].replace(/[?!.]+$/, '').trim();
      var f = findThing(q, everything());
      if (f.best) { App.go(D.isApp(f.best) ? 'apps' : 'library'); setTimeout(function () { Views.selectGame && Views.selectGame(f.best.id); }, 200); return 'Found it: ' + f.best.name + (f.best.folder ? ' (in the ' + f.best.folder + ' folder)' : '') + '.'; }
      if (f.alts.length) return 'I found a few: ' + f.alts.map(function (g) { return g.name; }).join(', ') + '.';
      return line('notFound', { q: q });
    } },
    { test: /\b(minimi[sz]e|hide) (all )?(the )?(windows|apps)\b/, run: function () { Win.minimizeAll(); return ok(); } },
    { test: /\b(close|quit|exit) (the )?(game|this game)\b/, run: function () { if (!Player.isPlaying()) return 'No game is open.'; Player.close(); return ok('Back to the menu.'); } },
    { test: /\bnew game\b|\bstart over\b/, run: function () { return 'Pick the game on Home and hit "New game" (it deletes your progress, so I want you to click it yourself).'; } },
    { test: /\b(open|launch|start|run|play|continue|resume|load) (the )?(app )?(.+)$/, run: function (m, t) {
      /* "play snake" is a command; "how do I play snake?" and "I can't open my saves" go to the AI if nothing matches */
      var direct = /^(go )?(open|launch|start|run|play|continue|resume|load)\b/.test(t);
      if (!direct && asking(t)) return null;
      var q = m[4].replace(/\b(game|app|please|for me|now)\b/g, '').replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();
      /* "play a game" / "play something": pick one on purpose */
      if (/^(a|an|any|some|something|anything|random|a random|whatever|one)( (fun|cool|good|new|random|one|else))*$/.test(q)) {
        var all = games();
        if (!all.length) return 'You don\'t have any games yet! Hit Add, or say "make a game".';
        var pick = all[Math.floor(Math.random() * all.length)];
        Vex.closeSoon(); setTimeout(function () { Player.launch(pick.id); }, 500);
        return 'Let\'s play ' + pick.name + '!';
      }
      if (!q) return null;
      var alias = APP_ALIASES[q.replace(/\s+app$/, '')];
      if (alias && D.get(alias)) { Player.launch(alias); return ok('Opening ' + D.get(alias).name + '.'); }
      var list = m[3] || /\bapp\b/.test(m[0]) ? apps() : everything();
      var f = findThing(q, list);
      if (!f.best && !f.alts.length && !direct) return null;
      return withThing(q, list, 'open', function (g) { Vex.closeSoon(); setTimeout(function () { Player.launch(g.id); }, 500); return D.isApp(g) ? ok('Opening ' + g.name + '.') : (D.saveIndex[g.id] && g.kitAutosave ? 'Continuing ' + g.name + '. Have fun!' : 'Starting ' + g.name + '. Have fun!'); });
    } }
  ];
  function titleCase(s) { return String(s).trim().replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); }); }
  function parseDurText(t) {
    var m = /(\d+(?:\.\d+)?\s*(h|hr|hrs|hours?|m|mins?|minutes?|s|secs?|seconds?)\b\s*)+/.exec(wordsToNums(t));
    return m ? m[0] : '';
  }

  /* =====================================================================
     THE AI (free, or your own key)
     ===================================================================== */
  function keyInfo() { return U.lsGet('gs2:vexKey', null); }
  function aiMode() {
    var b = D.settings.vexBrain || 'free';
    if (b === 'key' && keyInfo() && keyInfo().key) return 'key';
    if (b === 'off') return 'off';
    return 'free';
  }
  function withTimeout(ms) { var c = new AbortController(); var t = setTimeout(function () { c.abort(); }, ms); return { signal: c.signal, done: function () { clearTimeout(t); } }; }

  /* messages: [{role: 'user'|'assistant', content}], opts: {system, max, long} → text */
  async function ai(messages, opts) {
    opts = opts || {};
    var mode = aiMode();
    if (mode === 'off') throw new Error('off');
    if (mode === 'key') return aiWithKey(messages, opts);
    return aiFree(messages, opts);
  }

  async function aiFree(messages, opts) {
    var body = { model: 'openai', messages: [{ role: 'system', content: opts.system || '' }].concat(messages), private: true, seed: (Math.random() * 1e6) | 0 };
    var to = withTimeout(opts.long ? 180000 : 45000);
    try {
      /* the OpenAI-style door first, then the simple one */
      try {
        var r = await fetch('https://text.pollinations.ai/openai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: to.signal, credentials: 'omit' });
        if (r.ok) {
          var txt = await r.text();
          try { var j = JSON.parse(txt); var c = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content; if (c) return String(c); } catch (e) { if (txt.trim()) return txt; }
        } else if (r.status === 429) throw new Error('busy');
      } catch (e) { if (e.message === 'busy' || e.name === 'AbortError') throw e; }
      var r2 = await fetch('https://text.pollinations.ai/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: to.signal, credentials: 'omit' });
      if (r2.status === 429) throw new Error('busy');
      if (!r2.ok) throw new Error('The free AI didn\'t answer (' + r2.status + ').');
      var t2 = (await r2.text()).trim();
      if (!t2) throw new Error('The free AI sent an empty answer.');
      return t2;
    } finally { to.done(); }
  }

  /* your own key. Claude goes through Anthropic's official SDK (loaded when first needed). */
  var anthropicSdk = null;
  async function claudeClient(key) {
    if (!anthropicSdk) {
      var mod = await import('https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk/+esm');
      anthropicSdk = mod.default || mod.Anthropic;
    }
    return new anthropicSdk({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 180000 });
  }
  var DEFAULT_MODELS = { anthropic: 'claude-opus-5-5', openai: 'gpt-4o-mini', gemini: 'gemini-2.5-flash', openrouter: 'openrouter/auto', custom: '' };
  async function aiWithKey(messages, opts) {
    var k = keyInfo();
    var provider = k.provider || 'anthropic';
    var model = (k.model || DEFAULT_MODELS[provider] || '').trim();
    var max = opts.max || (opts.long ? 16000 : 1500);
    if (provider === 'anthropic') {
      var Anthropic = anthropicSdk;
      var client = await claudeClient(k.key);
      Anthropic = anthropicSdk;
      model = model || 'claude-opus-5-5';
      /* newer Claude models think before answering, and thinking counts toward max_tokens: leave room */
      var req = { model: model, max_tokens: opts.max ? Math.max(opts.max, 1024) : opts.long ? 64000 : 4000, messages: messages };
      if (opts.system) req.system = opts.system;
      /* effort (how hard it thinks) only on models that have it */
      if (/^claude-(opus-[45]|fable-5|sonnet-5)/.test(model)) req.output_config = { effort: opts.long ? 'medium' : 'low' };
      /* if Claude's safety check says no, the API retries on the model Anthropic picks for that case */
      if (/^claude-(fable-5-1|opus-5-5|opus-5|sonnet-5-5)$/.test(model)) { req.betas = ['server-side-fallback-2026-07-01']; req.fallbacks = 'default'; }
      try {
        /* making or fixing a game writes a LOT: stream it, so a long answer never hits the time limit */
        var res = opts.long ? await client.beta.messages.stream(req).finalMessage() : await client.beta.messages.create(req);
        if (res.stop_reason === 'refusal') throw new Error('Claude didn\'t want to answer that one.');
        var out = res.content.filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('');
        if (!out) throw new Error('Claude sent an empty answer.');
        return out;
      } catch (e) {
        if (Anthropic && e instanceof Anthropic.AuthenticationError) throw new Error('Your Claude key didn\'t work. Check it in Settings → VEX.');
        if (Anthropic && e instanceof Anthropic.PermissionDeniedError) throw new Error('Your Claude key isn\'t allowed to use that model.');
        if (Anthropic && e instanceof Anthropic.RateLimitError) throw new Error('busy');
        if (Anthropic && e instanceof Anthropic.BadRequestError) throw new Error('Claude said the request was wrong: ' + (e.message || '').slice(0, 160));
        if (Anthropic && e instanceof Anthropic.APIConnectionError) throw new Error('Couldn\'t reach Claude. Are you online?');
        if (Anthropic && e instanceof Anthropic.APIError) throw new Error('Claude had a problem (' + (e.status || 'error') + ').');
        throw e;
      }
    }
    if (provider === 'custom' && !/^https?:\/\//i.test(String(k.url || '').trim())) throw new Error('Add your AI\'s address (starting with https://) in Settings → VEX.');
    if (!model) throw new Error('Type the model name in Settings → VEX.');
    var to = withTimeout(opts.long ? 180000 : 60000);
    try {
      if (provider === 'gemini') {
        var g = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k.key }, signal: to.signal,
          body: JSON.stringify({
            systemInstruction: opts.system ? { parts: [{ text: opts.system }] } : undefined,
            contents: messages.map(function (m) { return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }; }),
            generationConfig: { maxOutputTokens: max }
          })
        });
        if (g.status === 429) throw new Error('busy');
        var gj = await g.json().catch(function () { return {}; });
        if (!g.ok) throw new Error('Gemini said no (' + g.status + '): ' + ((gj.error && gj.error.message) || '').slice(0, 140));
        var parts = gj.candidates && gj.candidates[0] && gj.candidates[0].content && gj.candidates[0].content.parts || [];
        return parts.map(function (p) { return p.text || ''; }).join('');
      }
      var url = provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' : provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' : String(k.url || '').replace(/\/+$/, '') + '/chat/completions';
      var o = await fetch(url, {
        method: 'POST', signal: to.signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + k.key },
        /* OpenAI's newer models only take max_completion_tokens; OpenRouter and others still use max_tokens */
        body: JSON.stringify(Object.assign({ model: model, messages: [{ role: 'system', content: opts.system || '' }].concat(messages) }, provider === 'openai' ? { max_completion_tokens: max } : { max_tokens: max }))
      });
      if (o.status === 429) throw new Error('busy');
      var oj = await o.json().catch(function () { return {}; });
      if (!o.ok) throw new Error('The AI said no (' + o.status + '): ' + ((oj.error && (oj.error.message || oj.error)) || '').toString().slice(0, 140));
      return (oj.choices && oj.choices[0] && oj.choices[0].message && oj.choices[0].message.content) || '';
    } finally { to.done(); }
  }

  /* what VEX knows when the AI answers */
  function systemPrompt() {
    var st = D.settings;
    var p = personality();
    var vibe = { hype: 'You are hyped, friendly and fun, like a gamer best friend. Short sentences.', calm: 'You are calm, kind and clear.', sarcastic: 'You are playfully sarcastic and witty, but still helpful and never mean.', pro: 'You are precise and professional, very brief.' }[p];
    var list = everything().slice(0, 60).map(function (g) { return '- ' + g.name + ' (' + (D.isApp(g) ? 'app' : 'game') + (g.folder ? ', folder ' + g.folder : '') + (g.playTime ? ', played ' + U.fmtDuration(g.playTime) : '') + (g.fav ? ', favorite' : '') + ')'; }).join('\n');
    var mem = Vex.memories().map(function (m) { return '- ' + m.text; }).join('\n');
    var inf = Trophies.info();
    return [
      'You are VEX, the helper AI inside "Game System 2.0", a web app that launches and organizes games and apps. ' + vibe,
      'The user\'s name is ' + (st.name || 'bro') + '. Call them that sometimes. Keep answers to 1-3 short sentences unless they ask for more. No markdown tables. Your answers are often read out loud.',
      'You focus on Game System and games. If asked about something unrelated, give a short answer and steer back.',
      'Game System features: Home (big showcase, rows), Library (all games and apps, folders, own order, drag to move), Apps tab (Music, Notes, Calculator, Drawing, Gallery, Video, Timer, Code), Saves, Stats with the trophy room, Settings (themes, Home layouts, Simple or Pro, sounds, screenshot/record keys, VEX settings, backups, website folder). Games with the Save Kit continue where you left off; others can be upgraded with "Make it continue". Screenshots and recordings go to the Gallery. Level ' + inf.level + ' (' + inf.title + '), ' + inf.got + '/' + inf.total + ' trophies.',
      'If the user wants you to DO something in Game System that you can do, put ONE line at the very end exactly like: ACTION: {"do":"play","name":"Snake"}. Allowed "do" values: play (name), open_app (name), go (view: home|library|apps|saves|stats|settings), timer (seconds, label), alarm (time "HH:MM", days [0-6]), music (cmd: play|pause|next|prev), screenshot, record, folder (name, folder), favorite (name), theme (name), make_game (idea), fix_game (name, problem). Only use names from the list below. Never invent other actions.',
      'Their games and apps:\n' + (list || '(none yet)'),
      mem ? 'Things they asked you to remember:\n' + mem : '',
      'Now: ' + new Date().toLocaleString() + '. Screen: ' + (Player.isPlaying() ? 'playing ' + ((D.get(Player.currentId()) || {}).name || 'a game') : D.ui.view) + '.'
    ].filter(Boolean).join('\n\n');
  }

  /* run an ACTION the AI asked for (same rules as typed commands) */
  async function runAction(a) {
    if (!a || typeof a !== 'object') return null;
    var map = {
      play: function () { return a.name ? 'play ' + a.name : null; },
      open_app: function () { return a.name ? 'open app ' + a.name : null; },
      go: function () { return a.view ? 'go to ' + a.view : null; },
      timer: function () { return a.seconds ? 'timer ' + Math.round(a.seconds) + ' seconds' + (a.label ? ' called ' + a.label : '') : null; },
      alarm: function () { return a.time ? 'alarm ' + a.time + (Array.isArray(a.days) && a.days.length ? ' on ' + a.days.map(function (d) { return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][d]; }).join(' ') : '') : null; },
      music: function () { return { play: 'play music', pause: 'pause music', next: 'next song', prev: 'previous song' }[a.cmd] || null; },
      screenshot: function () { return 'take a screenshot'; },
      record: function () { return 'record this'; },
      folder: function () { return a.name && a.folder ? 'put ' + a.name + ' in ' + a.folder + ' folder' : null; },
      favorite: function () { return a.name ? 'favorite ' + a.name : null; },
      theme: function () { return a.name ? 'change theme to ' + a.name : null; },
      make_game: function () { return a.idea ? 'make a game ' + a.idea : null; },
      fix_game: function () { return a.name ? 'fix ' + a.name + (a.problem ? ' because ' + a.problem : '') : null; }
    };
    var f = map[a.do];
    var cmd = f ? f() : null;
    if (!cmd) return null;
    return runCommand(norm(cmd), true);
  }

  /* =====================================================================
     MAKING + FIXING GAMES
     ===================================================================== */
  function extractHtml(text) {
    var m = /```(?:html)?\s*\n([\s\S]*?)```/i.exec(text);
    var code = m ? m[1] : text;
    var start = code.search(/<!doctype html|<html[\s>]/i);
    if (start > 0) code = code.slice(start);
    return code.trim();
  }
  function looksComplete(html) { return /<\/html>\s*$/i.test(html) || (/<\/body>/i.test(html) && /<\/script>/i.test(html)); }

  async function makeThing(idea, kind) {
    Vex.thinking(true, 'Making your ' + kind + '…');
    try {
      var kit = await Upgrade.kitSnippet();
      var prompt = [
        'Make a complete, fun, polished ' + (kind === 'app' ? 'web app' : 'browser game') + ' in ONE single HTML file: ' + idea,
        'Rules:',
        '- Everything (HTML, CSS, JavaScript) in one file. No external files, libraries or images (draw with canvas or CSS; emoji are fine).',
        '- Works with keyboard AND touch/mouse. Looks great: dark background, bright neon colors, smooth animations.',
        kind === 'game' ? '- Has a title screen, score, game over and restart. Gets harder over time.' : '- Clear buttons and labels. Useful from the first second.',
        '- Starts in under a second and fills the whole window (resize-friendly).'
      ].concat(Upgrade.saveRules(kit, 1)).concat([
        '- Reply with ONLY the code in one ```html block, from <!DOCTYPE html> to </html>. No explanations. Never leave parts out.',
        'Also put a short catchy name for it in the <title>.'
      ]).join('\n');
      var text = await ai([{ role: 'user', content: prompt }], { system: 'You are an expert game developer who writes complete, working single-file HTML5 games and apps.', long: true });
      var html = extractHtml(text);
      if (!/<(script|canvas|body)/i.test(html)) throw new Error('The AI didn\'t send code back. Try again or say it differently.');
      var cut = !looksComplete(html);
      var name = ((/<title>([^<]{2,60})<\/title>/i.exec(html) || [])[1] || titleCase(idea).slice(0, 40)).trim();
      var files = [{ p: 'index.html', b: new Blob([html], { type: 'text/html' }), t: 'text/html' }];
      var g = await D.addGame({ name: name, entry: 'index.html', kind: kind, kindSet: true, fromVex: true, desc: 'Made by VEX: ' + idea.slice(0, 200) }, files);
      pending = { kind: 'confirm', run: function () { Player.launch(g.id); return 'Have fun!'; } };
      return { text: 'Made it! "' + g.name + '" is in your ' + (kind === 'app' ? 'Apps' : 'Library') + '.' + (cut ? ' Heads up: the AI\'s answer got cut off at the end, so it might not fully work. A smarter AI (your own key in Settings → VEX) makes bigger games.' : '') + (aiMode() === 'free' ? ' (Made with the free AI, so it\'s a simple version.)' : '') + ' Want to ' + (kind === 'app' ? 'open' : 'play') + ' it?', chips: ['Yes', 'No'], expect: true };
    } catch (e) {
      return aiErrorText(e);
    } finally {
      Vex.thinking(false);
    }
  }
  var lastFix = null;

  async function fixThing(g, problem) {
    Vex.thinking(true, 'Fixing ' + g.name + '…');
    try {
      await D.ensureLocalFiles(g);
      var files = await GS2DB.filesOf(g.id);
      var entry = files.find(function (f) { return f.p === g.entry; }) || files.find(function (f) { return U.isHtml(f.p); });
      if (!entry) throw new Error('I couldn\'t find the game\'s code.');
      var code = await entry.b.text();
      if (code.length > 180000) throw new Error('That game is too big for me to fix in one go (more than 180 KB of code). Use the code editor and "Copy errors for AI" instead.');
      var errs = Player.lastErrors ? Player.lastErrors(g.id) : [];
      var prompt = 'Fix this browser game called "' + g.name + '".\n' +
        (problem ? 'The player says: ' + problem + '\n' : '') +
        (errs.length ? 'Errors from the last time it ran:\n' + errs.slice(0, 15).join('\n') + '\n' : '') +
        (!problem && !errs.length ? 'Find and fix any bugs that would break it or make it unplayable.\n' : '') +
        'Keep everything else exactly the same (look, controls, features, the GameSystem save code if there is any). ' +
        'Reply with ONLY the complete fixed file in one ```html block from the first line to the last. Never write "rest of the code" or leave anything out.\n\n' +
        'File ' + entry.p + ':\n```html\n' + code + '\n```';
      var text = await ai([{ role: 'user', content: prompt }], { system: 'You are an expert web game developer. You fix bugs carefully without changing anything that works.', long: true });
      var fixed = extractHtml(text);
      if (!/<(script|body|canvas)/i.test(fixed)) throw new Error('The AI didn\'t send the fixed code back.');
      if (!looksComplete(fixed) || fixed.length < code.length * 0.6) throw new Error('The AI\'s answer got cut off, so I didn\'t change anything. A smarter AI (your own key in Settings → VEX) can fix bigger games.');
      /* backup first, then write */
      await GS2DB.kvSet('vexFixBackup:' + g.id, { p: entry.p, b: entry.b, t: entry.t, time: Date.now() });
      await GS2DB.putFile(g.id, entry.p, new Blob([fixed], { type: 'text/html' }), 'text/html');
      await D.updateGame(g.id, { source: g.source === 'site' ? 'local' : g.source, siteFiles: g.source === 'site' ? undefined : g.siteFiles }, { touch: true });
      lastFix = g.id;
      pending = { kind: 'confirm', run: function () { Player.launch(g.id); return 'Let\'s see if it works!'; } };
      return { text: 'Fixed "' + g.name + '"! I kept a backup, so say "undo" if it\'s worse. Want to try it?', chips: ['Yes', 'No', 'Undo'], expect: true };
    } catch (e) {
      return aiErrorText(e);
    } finally {
      Vex.thinking(false);
    }
  }
  async function undoFix() {
    var id = lastFix;
    if (!id) {
      /* find the newest backup */
      var all = D.list();
      for (var i = 0; i < all.length; i++) { var b = await GS2DB.kvGet('vexFixBackup:' + all[i].id); if (b && (!id || b.time > id.time)) id = { id: all[i].id, time: b.time }; }
      id = id && id.id;
    }
    if (!id) return 'There\'s nothing to undo.';
    var bk = await GS2DB.kvGet('vexFixBackup:' + id);
    if (!bk) return 'There\'s nothing to undo.';
    await GS2DB.putFile(id, bk.p, bk.b, bk.t || 'text/html');
    await GS2DB.kvDel('vexFixBackup:' + id);
    await D.updateGame(id, {}, { touch: true });
    lastFix = null;
    return ok('Put "' + (D.get(id) || {}).name + '" back the way it was.');
  }
  function aiErrorText(e) {
    var msg = e && e.message;
    if (msg === 'off') return line('noAi');
    if (msg === 'busy') return 'The AI is busy right now. Try again in a minute.';
    if (e && e.name === 'AbortError') return 'The AI took too long. Try again, or try something smaller.';
    if (e && /Failed to fetch|NetworkError|Load failed/i.test(msg || '')) return 'I couldn\'t reach the AI. Are you online?';
    return msg || 'Something went wrong.';
  }

  /* =====================================================================
     HANDLING WHAT YOU SAID
     ===================================================================== */
  /* the whole answer has to be yes/no: "go to settings" or "stop recording" are new commands, not answers */
  var YES = /^(yes|yeah|yea|yep|yup|ya|sure|ok|okay|do it|go|go ahead|please|bet|of course|alright|y|absolutely|let'?s go|let'?s do it)( (please|bro|vex|man|dude|sure|do it|go ahead|thanks))*[\s!.,]*$/;
  var NO = /^(no|nah|nope|cancel|stop|never ?mind|don'?t|n|nothing|forget it|not now)( (thanks|thank you|bro|vex|man|dude|please))*[\s!.,]*$/;
  async function runCommand(t, fromAi, raw) {
    var l = lead(t) || t;
    for (var i = 0; i < CMDS.length; i++) {
      var c = CMDS[i];
      if (fromAi && c.noAi) continue;   /* the AI can't delete, rename or make VEX forget things */
      var m = c.test.exec(l);
      if (!m) continue;
      var r = await c.run(m, l, raw || l);
      if (r != null) return r;
    }
    return fromAi ? null : undefined;
  }

  /* history: [{role, content}] (recent chat, for the AI) */
  async function handle(raw, history) {
    var t = stripWake(norm(raw));
    if (!t) return line('hello');
    Trophies.event('vex');
    /* answering a question VEX asked */
    if (pending) {
      var p = pending;
      if (p.kind === 'confirm') {
        if (YES.test(t)) { pending = null; return await p.run(); }
        if (/^undo\b/.test(t)) { pending = null; return undoFix(); }
        if (NO.test(t)) { pending = null; return line('ok').replace(/[.!]$/, '') + ', never mind.'; }
      } else if (p.kind === 'which') {
        var n = /^(the )?(first|1|one)\b|^1\./.test(t) ? 0 : /^(the )?(second|2|two)\b|^2\./.test(t) ? 1 : /^(the )?(third|3|three)\b|^3\./.test(t) ? 2 : /^(the )?(fourth|4|four)\b|^4\./.test(t) ? 3 : -1;
        var pick = n >= 0 ? p.list[n] : (findThing(t, p.list).best || null);
        if (pick) { pending = null; return await p.run(pick); }
        if (NO.test(t)) { pending = null; return 'Okay, never mind.'; }
      } else if (p.kind === 'idea') {
        pending = null;
        if (NO.test(t) || /^(never ?mind|no|nah|nope|cancel|forget it)\b/.test(t)) return 'Okay, maybe later.';
        return makeThing(stripWake(String(raw).trim()), p.gameKind);
      } else if (p.kind === 'more' && p.fits(t)) {
        /* "How long?" → "5 minutes" means "timer 5 minutes" */
        t = p.prefix + t;
      }
      pending = null;   /* they said something else: forget the question */
    }
    /* "I like racing games" style facts are remembered too */
    var r = await runCommand(t, false, stripWake(String(raw).trim()));
    if (r !== undefined && r !== null) return r;
    /* the AI */
    if (aiMode() === 'off') return line('unknown');
    try {
      Vex.thinking(true);
      var msgs = (history || []).slice(-10).concat([{ role: 'user', content: raw }]);
      while (msgs.length && msgs[0].role !== 'user') msgs.shift();
      var text = await ai(msgs, { system: systemPrompt() });
      var act = /^\s*ACTION:\s*(\{.*\})\s*$/m.exec(text);
      var clean = text.replace(/^\s*ACTION:.*$/m, '').trim();
      if (act) {
        var parsed = null;
        try { parsed = JSON.parse(act[1]); } catch (e) { parsed = null; }
        var done = parsed ? await runAction(parsed) : null;
        if (done && typeof done === 'object') return { text: (clean ? clean + '\n' : '') + done.text, chips: done.chips, expect: done.expect };
        if (done) return (clean ? clean + ' ' : '') + done;
      }
      return clean || line('unknown');
    } catch (e) {
      return aiErrorText(e);
    } finally {
      Vex.thinking(false);
    }
  }

  window.VexBrain = {
    handle: handle,
    ai: ai,
    aiMode: aiMode,
    keyInfo: keyInfo,
    DEFAULT_MODELS: DEFAULT_MODELS,
    reset: function () { pending = null; },
    waiting: function () { return !!pending; },
    /* for tests */
    parseDuration: parseDuration,
    parseClock: parseClock,
    parseDays: parseDays,
    findThing: findThing,
    stripWake: stripWake,
    norm: norm
  };
})();
