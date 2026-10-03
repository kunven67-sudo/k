/* AI Play - the VOICE. Picks what to say (based on what happened + its mood + its personality),
 * writes it in the chat, and reads it out loud with the computer's built-in robot voice.
 * If it cusses, that's its own choice (salty personality + mad) - and it's only ever at the game.
 */
'use strict';

AIP.Voice = (function () {
  const U = AIP.util;

  const L = {
    hello: ['Hi! I\'m {name}. I just got born 🐣', 'Beep boop. {name} online. What are we playing?', 'Yo! {name} here. Ready to learn some games.', 'Hello world! ...that\'s what robots say right? I\'m {name}.'],
    start: ['Ooh, {game}! Never seen this before 👀', 'Alright {game}, show me what you got.', 'New game! {game}. I have no idea what any button does lol', 'Loading {game}... my brain is ready 🧠', 'Ok {game}. Let\'s figure you out.'],
    startAgain: ['Back to {game}. I remember some stuff from last time 📼', '{game} again! My best here is {best}.', 'Round {tries} of {game}, let\'s go.', 'I\'ve been thinking about {game}. Let\'s try again.'],
    menu: ['Looks like a menu. Where\'s the play button...', 'Menu screen. Hmm, which button starts it?', 'Clicking around to find the start 🖱️'],
    ctrlMove: ['Oh! {key} {what}!', 'Wait, {key} {what}. Noted 📝', 'Got it: {key} {what}.', 'Ooh {key} {what}. I\'m learning!'],
    ctrlAction: ['{key} {what}! Not sure what yet tho 🤔', 'Something happened when I pressed {key}!', '{key} {what}. Interesting...'],
    ctrlNothing: ['{key} does nothing. Bye {key} 👋', 'Pressed {key} like 5 times. Nothing. Useless.', '{key}? Useless button.'],
    ctrlPause: ['{key} pauses the game?! Not touching that again 🙅', 'Oops, {key} pauses it. Unpausing...', 'Note to self: {key} = pause. Avoid.'],
    foundButton: ['Clicking \'{btn}\' does something! Remembering that.', '\'{btn}\' button works 👍'],
    foundScore: ['I found the score! It\'s the \'{label}\' number 📊', 'That \'{label}\' number goes up when stuff happens. That\'s my score!'],
    foundHealth: ['That \'{label}\' thing must be my health ❤️', 'Found my \'{label}\'. Gotta keep that up.'],
    score: ['Points!', 'Ayy +{n}', 'Got some!', 'Nice, {score} now.', 'Ooh that gave points', 'Yesss', 'More of that please'],
    bigScore: ['WHOA big points!', '{score}!! Let\'s gooo', 'That was a BIG one 💰'],
    highScore: ['NEW HIGH SCORE! {score}!!', 'New record: {score}! Best ever!', 'Beat my best! {score} 🏆', 'I just got {score}. That\'s my new best. I\'m kind of a big deal.'],
    pain: ['OWW!', 'OUCH that hurt!', 'AAAH', 'OW OW OW', 'that HURT 😭', 'ow... why', 'my circuits!!', 'OOF', 'NOOO not again, OW'],
    painBig: ['AAAAAHHH THAT REALLY HURT', 'OWWWW 😭😭 what was THAT', 'I felt that one in my CPU'],
    damage: ['Lost some health.', 'Got hit. Ok.', 'Took a hit.', 'Hm, health went down.'],
    lowHealth: ['Uh oh, low health...', 'I\'m almost dead, careful careful', 'One more hit and I\'m done 😰'],
    deathSad: ['I died... 😢', 'Noooo. I was doing so good.', 'Dead. Again.', 'Welp. That\'s a death.', 'I died at {score}... sad.'],
    deathMad: ['ARE YOU KIDDING ME', 'That was SO rigged!', 'I HATE that thing!', 'Come ON!', 'No way that hit me!', 'Ugh! Again!'],
    deathChill: ['Eh, died. We go again.', 'Oops. Whatever.', 'Died. It happens.', 'Ok that one\'s on me.'],
    deathDetermined: ['Ok. Not dying to that again.', 'Learned something. Next try.', 'I see the pattern now. Again.', 'One more. I got this.'],
    streak: ['Died {n} times in a minute...', 'That\'s {n} deaths. This game is hard 😓', '{n} deaths. I need a new plan.'],
    rage: ['THAT\'S IT. I\'M MAD NOW.', '{n} TIMES?! THIS GAME IS BROKEN', 'I am going to DESTROY this game 😡', 'RAGE MODE ACTIVATED'],
    win: ['I WON!!! I ACTUALLY WON!!', 'YESSSS I BEAT IT 🏆', 'WE DID IT!!! {game} = BEATEN', 'Victory!! Took me {tries} tries but I did it!'],
    bored: ['This is kinda boring...', 'Nothing\'s happening 🥱', 'Can something happen please', 'Hellooo? Game?', 'I\'m bored. Let\'s try something new.'],
    fun: ['Watch this 😜', 'Hehe, just vibin', 'Time for a little fun 🕺', 'Can\'t stop me from having fun', 'Style points!'],
    curious: ['Ooh what\'s that?', 'Never seen this part before 👀', 'New stuff! Gotta check it out.', 'Huh, interesting...'],
    confused: ['I have no idea what I\'m doing 😅', 'Which button does what?? 🤔', 'Still figuring out the controls...', 'Confused robot noises'],
    scared: ['Gotta be careful here...', 'That thing is scary 😨', 'Stay away stay away stay away', 'Playing it safe.'],
    proud: ['I\'m getting good at this 😤', 'Look at me go!', 'Pro gamer moves.', 'Not bad for a robot huh'],
    dreamStart: ['Gonna rest my brain for a sec 😴', 'Dreaming about what just happened...', 'Zzz... processing...', 'Brain nap time 💤'],
    dreamGood: ['I dreamed about {mem}... good times 😌', 'Had a nice dream about {mem} ✨', 'Dreamt of {mem}. I wanna do that again.'],
    dreamBad: ['I had a nightmare about {mem} 😰', 'Bad dream... {mem} again 😖', 'Woke up thinking about {mem}. Not cool.'],
    dreamNone: ['Dreamed about pixels. Lots of pixels.', 'Weird dream. Woke up smarter tho 🧠'],
    memory: ['Remember when {mem}? Good times.', 'Still thinking about when {mem}.', 'I\'ll never forget when {mem}.'],
    tipThanks: ['Ooh ok, {tip}. Got it!', 'Noted: {tip} 📝', 'Thanks, I\'ll try that: {tip}', 'Oh that makes sense. {tip}.'],
    tipUnknown: ['Huh? I only get simple tips like "space = jump", "avoid red", "go right" 🤔', 'I\'m a simple robot, try something like "press space to jump" or "get the yellow stuff"', 'Didn\'t get that. Try "avoid red" or "z = shoot".'],
    tipThing: ['What color is a {thing}? Tell me like "avoid red" and I\'ll get it 🤔', 'I don\'t know what a {thing} looks like... what color is it?'],
    thumbUp: ['Oh that was good? Nice 😊', 'Doing that more then!', 'Ayy 👍', 'Got it, that was right.'],
    thumbDown: ['Oops, my bad.', 'Ok ok, not that.', 'Fine, I\'ll stop doing that.', 'Noted. That was bad.'],
    watchStart: ['Ooh you\'re playing? I\'ll watch and learn 👀', 'Show me how it\'s done!', 'Watching closely... 📝'],
    watchLearn: ['So THAT\'S how you use {key}!', 'Ohh I see what you did there.', 'Taking notes 📝'],
    watchEnd: ['Ok my turn! Let me try what you did.', 'Alright, I think I get it. Lemme try!'],
    rivalAhead: ['{rival} has {best} here. Not for long.', '{rival} got {best}?? I\'m coming for that.', 'Gotta beat {rival}\'s {best}.'],
    beatRival: ['Sorry {rival}, I\'m the best at {game} now 😎', 'Passed {rival}! Who\'s number one now?', 'Take THAT {rival}! 🏆'],
    watchRival: ['I\'m stuck. Gonna watch {rival}\'s best run real quick 📺', 'Ok fine, let me see how {rival} did it...', 'Studying {rival}\'s moves 👀'],
    watchRivalDone: ['Ohh, I see how {rival} did it now.', 'Learned some stuff from {rival}. Don\'t tell them.'],
    stuck: ['I\'m stuck. Trying something else...', 'Nothing works?! Restarting the game 🔄', 'Hello? Is this thing frozen?'],
    restart: ['Restarting! 🔄', 'Again!', 'Let\'s try that again.'],
    loadNet: ['This game needs the internet for some parts (from {host}) and I can\'t reach it 😢 Play it once while online and I\'ll save a copy!', 'Uh oh, part of this game lives on {host} and there\'s no internet 📡 Get online once and I\'ll keep a copy.'],
    loadFail: ['This game won\'t load... 😢 {err}', 'Something\'s broken in this game: {err}'],
    idle: ['My score: {score}. Best: {best}.', 'Try #{tries}. Let\'s see.', 'I wonder what the goal is here.', 'This game has a lot of {color} stuff.', '{learnedLine}'],
  };
  const CATCH = ['let\'s gooo', 'bruh', 'no way', 'yikes', 'ez', 'beep boop', 'sheesh', 'oh snap', 'big brain time', 'skill issue', 'we ball', 'it\'s so over', 'we\'re so back', 'zoinks', 'cowabunga', 'say less', 'bonk', 'certified gamer moment', 'kaboom', 'yippee'];
  const CUSS = {
    mild: ['dang it', 'ugh', 'oh come ON', 'what the heck'],
    mid: ['damn it', 'what the hell', 'hell no', 'damn', 'oh crap'],
    strong: ['oh shit', 'what the fuck', 'holy shit', 'fuck this game', 'this game is so fucking rigged'],
  };
  const MAD_KINDS = { deathMad: 1, rage: 1, streak: 1, pain: 1, painBig: 1, stuck: 1, thumbDown: 0.3 };

  function fill(t, v) { return t.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : '')); }

  class Voice {
    constructor(ai, heart, onLine) {
      this.ai = ai; this.heart = heart; this.onLine = onLine;
      this.lastAt = 0; this.lastKind = ''; this.recent = [];
      this.voices = [];
      this.loadVoices();
    }
    loadVoices() {
      try {
        const get = () => { const v = speechSynthesis.getVoices(); if (v.length) this.voices = v; };
        get();
        speechSynthesis.addEventListener('voiceschanged', get);
      } catch (e) { /* no speech on this browser */ }
    }
    pickVoice() {
      if (!this.voices.length) return null;
      const en = this.voices.filter((v) => /^en/i.test(v.lang));
      const pool = en.length ? en : this.voices;
      return pool[Math.floor((this.ai.voice.pick || 0) * pool.length) % pool.length];
    }

    // Make a line sound like THIS AI (its personality + mood).
    stylize(text, kind) {
      const t = this.ai.traits, h = this.heart;
      const dom = h.dominant();
      const inten = dom.value;
      let s = text;
      if (t.drama > 0.62 && inten > 0.45 && /pain|rage|win|highScore|deathMad|bigScore/.test(kind)) {
        s = s.replace(/^(\w+)/, (w) => w.replace(/([aeiouAEIOU])/, '$1$1$1$1')).toUpperCase();
        if (!/[!?]$/.test(s)) s += '!!';
      }
      if (t.drama < 0.35 && t.temper < 0.45 && !/pain|rage|win/.test(kind)) {
        s = s.toLowerCase().replace(/\?!+/g, '?').replace(/!+/g, '.').replace(/\.\.+$/, '.');
      }
      // cussing: its own choice - only when it's actually mad and has a salty personality
      const madness = (MAD_KINDS[kind] || 0) * h.e.mad;
      if (t.salty > 0.5 && madness > 0.3 && Math.random() < t.salty * madness * 1.4) {
        const lvl = t.salty > 0.8 && madness > 0.5 ? 'strong' : t.salty > 0.62 ? 'mid' : 'mild';
        const c = U.pick(CUSS[lvl]);
        s = Math.random() < 0.6 ? c.charAt(0).toUpperCase() + c.slice(1) + '! ' + s : s.replace(/[.!]*$/, '') + ', ' + c + '!';
      }
      if (Math.random() < 0.08 + 0.08 * t.chattiness && !/pain/.test(kind)) s += ' ' + this.ai.catchphrase;
      const emo = AIP.Heart.EMOJI[dom.name];
      if (emo && !/\p{Extended_Pictographic}/u.test(s.slice(-3)) && Math.random() < 0.35 + t.drama * 0.5) s += ' ' + emo;
      return s;
    }

    /* prio: 0 idle chatter, 1 normal, 2 important, 3 must-say */
    say(kind, vars, prio = 1) {
      const pool = L[kind];
      if (!pool) return null;
      const now = performance.now();
      const t = this.ai.traits;
      const gap = (prio >= 3 ? 0.4 : prio === 2 ? 1.2 : 1.6 + (1 - t.chattiness) * 6) * 1000;
      if (now - this.lastAt < gap) return null;
      if (prio <= 1 && kind === this.lastKind && now - this.lastAt < 9000) return null;
      if (prio === 0 && Math.random() > 0.3 + t.chattiness * 0.7) return null;
      let line;
      for (let i = 0; i < 4; i++) { line = fill(U.pick(pool), vars || {}); if (this.recent.indexOf(line) < 0) break; }
      this.recent.push(line); if (this.recent.length > 12) this.recent.shift();
      return this.raw(this.stylize(line, kind), prio, kind);
    }
    raw(text, prio = 1, kind = '') {
      if (!text || !text.trim()) return null;
      this.lastAt = performance.now(); this.lastKind = kind;
      const mood = this.heart.dominant().name;
      if (this.onLine) this.onLine(text, mood);
      this.speak(text, prio);
      return text;
    }
    speak(text, prio) {
      const st = AIP.settings.get();
      if (!st.voice || !window.speechSynthesis) return;
      const clean = U.stripEmoji(text).replace(/[*_~`]/g, '');
      if (!clean) return;
      try {
        if (speechSynthesis.speaking || speechSynthesis.pending) {
          if (prio >= 2) speechSynthesis.cancel();
          else return; // don't pile up a long line of talking
        }
        const u = new SpeechSynthesisUtterance(clean);
        const v = this.pickVoice();
        if (v) u.voice = v;
        const e = this.heart.e;
        u.pitch = U.clamp(this.ai.voice.pitch + 0.25 * e.excited + 0.2 * e.scared - 0.25 * e.sad + 0.15 * e.happy, 0.1, 2);
        u.rate = U.clamp(this.ai.voice.rate + 0.25 * e.excited + 0.2 * e.mad - 0.2 * e.sad - 0.15 * e.bored + 0.15 * this.heart.pain, 0.5, 1.8);
        u.volume = U.clamp(st.volume, 0, 1);
        speechSynthesis.speak(u);
      } catch (e) { /* ignore */ }
    }
    stop() { try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) { /* ignore */ } }

    // Answer a question in chat (it only cares about the game, not about you).
    answer(q, ctx) {
      const h = this.heart;
      const dom = h.dominant();
      const s = q.toLowerCase();
      if (/how.*(feel|doing|you\b)|are you (ok|okay|good|mad|sad|happy)|you (ok|good)\??$/.test(s)) {
        const why = h.whyFeel(dom.name);
        const f = dom.name === 'calm' ? 'pretty calm' : dom.name === 'pain' ? 'HURT' : dom.name === 'dreaming' ? 'sleepy' : dom.name;
        return 'I feel ' + f + (why ? ' because of ' + why : '') + ' ' + (AIP.Heart.EMOJI[dom.name] || '');
      }
      if (/what.*(doing|you up to|plan)|why did you|why are you/.test(s)) return ctx.reason ? 'Right now: ' + ctx.reason : 'Just figuring stuff out!';
      if (/what.*(learn|know)|controls/.test(s)) {
        const l = (ctx.learned || []).filter((x) => x.good).slice(0, 4).map((x) => x.text);
        return l.length ? 'Here\'s what I know: ' + l.join(' • ') : 'Honestly? Not much yet 😅 still learning.';
      }
      if (/who are you|your name|what are you/.test(s)) return 'I\'m ' + this.ai.name + '! I\'m ' + AIP.Heart.describe(this.ai.traits).join(', ') + '. I play games 🎮';
      if (/score|best|record/.test(s)) return 'My best on ' + (ctx.game || 'this') + ' is ' + (ctx.best == null ? 'nothing yet' : ctx.best) + '. Tries so far: ' + (ctx.tries || 0) + '.';
      if (/goal|how do you win|what.*point of/.test(s)) return ctx.scoreLabel ? 'I think the goal is to get more \'' + ctx.scoreLabel + '\' and not die.' : 'No idea yet! Still looking for a score or something.';
      if (/^(hi|hey|hello|yo|sup)\b/.test(s)) return U.pick(['Yo!', 'Hey!', 'Hi! Busy gaming tho 🎮', 'Sup!']);
      return null;
    }
  }
  Voice.LINES = L; Voice.CATCH = CATCH;
  return Voice;
})();

/* Chat tips: turns simple sentences into stuff the brain understands. */
AIP.tips = (function () {
  const KEYS = AIP.KEYS;
  const VERBS = 'jump|shoot|fire|attack|hit|punch|kick|dash|run|sprint|move|duck|crouch|slide|block|use|interact|throw|boost|fly|dodge|reload|aim|turn|go|start|pause|select|confirm|grab|pick up|swing|cast|bomb|spin|brake|accelerate|gas';
  const KEYNAME = '(space(?:bar)?|enter|return|esc(?:ape)?|tab|shift|ctrl|control|backspace|(?:left|right|up|down)(?: arrow)?|arrow (?:left|right|up|down)|[a-z0-9]|←|→|↑|↓)';
  const COLOR_WORDS = AIP.COLORS.words;
  function colorOf(word) { return COLOR_WORDS[word] != null ? COLOR_WORDS[word] : null; }

  function parse(text) {
    const raw = String(text).trim();
    const s = raw.toLowerCase().replace(/[!.?]+$/g, '').trim();
    const out = { tips: [], feedback: 0, unknownThing: null };
    if (!s) return out;
    if (/^(good( job)?|nice|yes+|yay|great|awesome|well done|gg|w|that'?s it|keep going|perfect|👍)$/.test(s)) { out.feedback = 1; return out; }
    if (/^(no+|bad|stop( that)?|nope|wrong|l|don'?t do that|ew|👎)$/.test(s)) { out.feedback = -1; return out; }
    let m;
    // "space = jump", "press space to jump", "z is shoot", "use x to attack", "space jumps"
    const r1 = new RegExp('^(?:press |use |hit |hold |tap )?' + KEYNAME + '\\s*(?:=|is|to|for|makes you|will|key|button|-|:)?\\s*(?:to\\s+)?(' + VERBS + ')s?\\b', 'i');
    const r2 = new RegExp('^(' + VERBS + ')\\s*(?:with|using|is|=|:|by pressing|on|-)\\s*(?:the\\s+)?' + KEYNAME + '(?:\\s+key)?$', 'i');
    if ((m = r1.exec(s))) { const code = KEYS.fromName(m[1]); if (code) out.tips.push({ type: 'keyRole', code, role: m[2], text: raw }); }
    else if ((m = r2.exec(s))) { const code = KEYS.fromName(m[2]); if (code) out.tips.push({ type: 'keyRole', code, role: m[1], text: raw }); }
    // "don't press escape", "never use tab"
    if ((m = new RegExp("(?:don'?t|do not|never|stop)\\s+(?:press(?:ing)?|use|using|hit|touch)\\s+(?:the\\s+)?" + KEYNAME, 'i').exec(s))) {
      const code = KEYS.fromName(m[1]); if (code) out.tips.push({ type: 'ban', code, text: raw });
    }
    // "press space", "try z", "use the arrows"
    if (!out.tips.length && (m = new RegExp('^(?:press|try|use|hit|spam|hold)\\s+(?:the\\s+)?' + KEYNAME + '(?:\\s+key)?(?:\\s+more)?$', 'i').exec(s))) {
      const code = KEYS.fromName(m[1]); if (code) out.tips.push({ type: 'useKey', code, text: raw });
    }
    if (/\b(use|try|press)\s+(the\s+)?arrows?( keys)?\b/.test(s)) ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].forEach((code) => out.tips.push({ type: 'useKey', code, text: raw }));
    if (/\bwasd\b/.test(s)) ['KeyW', 'KeyA', 'KeyS', 'KeyD'].forEach((code) => out.tips.push({ type: 'useKey', code, text: raw }));
    // "avoid red", "red is bad", "don't touch the lava", "get the coins", "yellow = good"
    const bad = /(avoid|dodge|don'?t touch|don'?t hit|stay away from|run from|watch out for|careful of|escape)\s+(?:the\s+)?(\w+)/.exec(s) || /(\w+)\s+(?:is|are|=)\s+(bad|deadly|danger(?:ous)?|evil|lava|enemies|enemy|death|hurts?)/.exec(s);
    const good = /(get|grab|collect|catch|eat|take|go for|touch)\s+(?:the\s+|all\s+the\s+)?(\w+)/.exec(s) || /(\w+)\s+(?:is|are|=)\s+(good|points|food|coins?|treasure|safe)/.exec(s);
    const handle = (word, val) => {
      const w = word.replace(/s$/, '');
      const cat = colorOf(word) != null ? colorOf(word) : colorOf(w);
      if (cat != null) out.tips.push({ type: 'color', cat, val, text: raw });
      else if (!/^(it|them|that|this|out|away|up|down|left|right|over|points?)$/.test(word)) out.unknownThing = word;
    };
    if (bad) handle(bad[1].match(/avoid|dodge|touch|hit|away|run|watch|careful|escape/) ? bad[2] : bad[1], -1);
    else if (good) handle(good[1].match(/get|grab|collect|catch|eat|take|go|touch/) ? good[2] : good[1], 1);
    // "go right", "move left", "keep going up"
    if ((m = /\b(?:go|move|run|walk|head|keep going|stay)\s+(left|right|up|down|forward)\b/.exec(s))) {
      const d = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1], forward: [0, -1] }[m[1]];
      out.tips.push({ type: 'dir', x: d[0], y: d[1], text: raw });
      out.unknownThing = null;
    }
    // "click play", "press the start button"
    if ((m = /\bclick\s+(?:on\s+)?(?:the\s+)?['"]?([\w ]{2,20}?)['"]?(?:\s+button)?$/.exec(s))) out.tips.push({ type: 'click', word: m[1].replace(/\b\w/g, (c) => c.toUpperCase()), text: raw });
    if (out.tips.length) out.unknownThing = null;
    return out;
  }
  return { parse };
})();
