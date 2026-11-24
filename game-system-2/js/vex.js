/* Game System 2.0 — VEX, the helper.
   A glowing orb you can drag anywhere. Click it, press your keys, or just say "VEX" (after you allow the mic).
   It talks back (out loud if you want), remembers what you tell it, and does stuff in Game System for you. */
(function () {
  'use strict';
  var h = U.h;
  var I = UI.icon;

  var S = { history: [], memory: [] };   /* history: [{who: 'you'|'vex', text, t}], memory: [{text, t}] */
  var MAX_HISTORY = 3000;
  var orb = null, panel = null, msgsEl = null, inputEl = null, chipsEl = null, statusEl = null, micBtn = null;
  var open = false, busy = false;
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  function st() { return D.settings; }
  function on() { return st().vexOn !== false; }

  /* ---------------- saving (history is kept forever, in IndexedDB) ---------------- */
  var saveSoon = U.debounce(function () {
    GS2DB.kvSet('vexHistory', S.history.slice(-MAX_HISTORY)).catch(function () {});
    GS2DB.kvSet('vexMemory', S.memory).catch(function () {});
  }, 400);
  async function load() {
    try {
      var hi = await GS2DB.kvGet('vexHistory');
      var me = await GS2DB.kvGet('vexMemory');
      S.history = Array.isArray(hi) ? hi.filter(function (x) { return x && typeof x.text === 'string'; }) : [];
      S.memory = Array.isArray(me) ? me.filter(function (x) { return x && typeof x.text === 'string'; }) : [];
    } catch (e) { /* fresh */ }
  }

  /* ---------------- the orb ---------------- */
  function orbColor() {
    var c = st().vexColor || 'neon';
    if (c === 'plasma' && !Trophies.hasLevel(7)) c = 'neon';
    if (c === 'gold' && !Trophies.hasLevel(11)) c = 'neon';
    return c;
  }
  function makeOrb() {
    orb = h('button.vex-orb', { 'aria-label': 'VEX (your helper)', title: 'VEX: click to talk' },
      h('span.vo-glow'), h('span.vo-ring'), h('span.vo-ring.r2'), h('span.vo-swirl'), h('span.vo-core'), h('span.vo-eye'));
    var pos = U.lsGet('gs2:vexOrb', null);
    if (pos && isFinite(pos.x) && isFinite(pos.y)) placeOrb(pos.x, pos.y);
    var down = null, moved = false;
    orb.addEventListener('pointerdown', function (e) {
      down = { x: e.clientX, y: e.clientY, l: orb.offsetLeft, t: orb.offsetTop };
      moved = false;
      try { orb.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    orb.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (!moved && Math.hypot(dx, dy) > 6) moved = true;
      if (moved) { placeOrb(down.l + dx, down.t + dy); if (panel && open) placePanel(); }
    });
    orb.addEventListener('pointerup', function () {
      if (!down) return;
      var wasMoved = moved;
      down = null;
      if (wasMoved) { U.lsSet('gs2:vexOrb', { x: orb.offsetLeft, y: orb.offsetTop }); return; }
      toggle();
    });
    orb.addEventListener('pointercancel', function () { down = null; });
    orb.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    UI.overlayRoot().appendChild(orb);
    paintOrb();
  }
  function placeOrb(x, y) {
    var s = 58;
    x = Math.max(4, Math.min(window.innerWidth - s - 4, x));
    y = Math.max(4, Math.min(window.innerHeight - s - 4, y));
    orb.style.left = x + 'px'; orb.style.top = y + 'px'; orb.style.right = 'auto'; orb.style.bottom = 'auto';
  }
  var mood = 'idle';   /* idle | listening | thinking | talking */
  function setMood(m) { mood = m; paintOrb(); }
  function paintOrb() {
    if (!orb) return;
    orb.className = 'vex-orb mood-' + mood + ' color-' + orbColor() + (open ? ' open' : '');
    var hidden = !on() || (st().vexIdle === 'hidden' && mood === 'idle' && !open);
    orb.hidden = hidden;
    if (statusEl) statusEl.textContent = { idle: listening ? 'Listening for "VEX"' : 'Ready', listening: 'Listening…', thinking: thinkLabel || 'Thinking…', talking: 'Talking' }[mood];
  }
  var thinkLabel = '';
  function thinking(isOn, label) { thinkLabel = label || ''; setMood(isOn ? 'thinking' : (speakingNow() ? 'talking' : 'idle')); }

  /* ---------------- the chat panel ---------------- */
  function makePanel() {
    msgsEl = h('div.vp-msgs', { role: 'log', 'aria-live': 'polite' });
    inputEl = h('input.vp-input', { placeholder: 'Ask VEX anything, or tell it what to do…', maxlength: 500, 'aria-label': 'Message VEX', autocomplete: 'off' });
    chipsEl = h('div.vp-chips');
    statusEl = h('span.vp-status');
    /* type=button: otherwise letting go of the mic would also send the form, and in browsers without voice
       (where it's disabled) Enter wouldn't send at all */
    micBtn = h('button.vp-mic', { type: 'button', title: SR ? 'Hold to talk' : 'Your browser can\'t hear you (try Chrome or Edge)', 'aria-label': 'Hold to talk', disabled: !SR }, I('mic'));
    var send = h('button.vp-send', { type: 'submit', title: 'Send', 'aria-label': 'Send' }, I('arrowRight'));
    panel = h('div.vex-panel', { role: 'dialog', 'aria-label': 'VEX' },
      h('div.vp-head',
        h('span.vp-mini', h('i')),
        h('div.vp-title', h('b', 'VEX'), statusEl),
        h('button.icon-btn.sm', { title: 'VEX settings', 'aria-label': 'VEX settings', onclick: function () { close(); App.go('settings'); setTimeout(function () { var s = document.getElementById('set-vex'); if (s) s.scrollIntoView({ behavior: 'smooth' }); }, 200); } }, I('sliders')),
        h('button.icon-btn.sm', { title: 'Close (Esc)', 'aria-label': 'Close', onclick: close }, I('x'))),
      msgsEl, chipsEl,
      h('form.vp-form', { onsubmit: function (e) {
        e.preventDefault();
        var t = inputEl.value.trim();
        if (!t) return;
        if (busy) { waitHint(); return; }   /* keep what you typed until VEX is free */
        inputEl.value = '';
        ask(t);
      } }, micBtn, inputEl, send));
    /* hold the mic button to talk */
    micBtn.addEventListener('pointerdown', function (e) { e.preventDefault(); startTalk(); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { micBtn.addEventListener(ev, function () { if (talking) stopTalk(); }); });
    inputEl.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } });
    panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } });
    UI.overlayRoot().appendChild(panel);
    renderHistory();
  }
  function placePanel() {
    if (!panel || !orb) return;
    if (window.innerWidth < 620) { panel.style.left = ''; panel.style.top = ''; panel.classList.add('phone'); return; }
    panel.classList.remove('phone');
    var r = orb.getBoundingClientRect();
    var w = Math.min(400, window.innerWidth - 16), hgt = Math.min(560, window.innerHeight - 90);
    var x = r.left + r.width / 2 > window.innerWidth / 2 ? r.left - w - 10 : r.right + 10;
    x = Math.max(8, Math.min(window.innerWidth - w - 8, x));
    var y = Math.max(8, Math.min(window.innerHeight - hgt - 8, r.bottom - hgt));
    panel.style.left = x + 'px'; panel.style.top = y + 'px'; panel.style.width = w + 'px'; panel.style.height = hgt + 'px';
  }
  var shown = 60;
  function renderHistory() {
    if (!msgsEl) return;
    msgsEl.replaceChildren();
    var list = S.history.slice(-shown);
    if (S.history.length > shown) msgsEl.appendChild(h('button.vp-older', { onclick: function () { shown += 100; renderHistory(); msgsEl.scrollTop = 0; } }, 'Show older messages'));
    if (!S.history.length) msgsEl.appendChild(bubble('vex', 'Yo ' + (st().name || 'bro') + '! I\'m VEX. Ask me anything about Game System, or tell me what to do, like "play Snake", "timer 5 minutes" or "make a game". Say "help" for more.'));
    list.forEach(function (m) { msgsEl.appendChild(bubble(m.who, m.text)); });
    setChips(['What can you do?', 'Make a game', 'Play music', 'Timer 5 minutes']);
    requestAnimationFrame(function () { msgsEl.scrollTop = msgsEl.scrollHeight; });
  }
  function bubble(who, text) {
    var b = h('div.vp-msg.' + (who === 'you' ? 'you' : 'vex'));
    String(text).split('\n').forEach(function (ln, i) { if (i) b.appendChild(h('br')); b.appendChild(document.createTextNode(ln)); });
    return b;
  }
  function setChips(list) {
    if (!chipsEl) return;
    chipsEl.replaceChildren.apply(chipsEl, (list || []).map(function (c) { return h('button.chip', { onclick: function () { ask(c); } }, c); }));
  }
  function addMsg(who, text) {
    S.history.push({ who: who, text: String(text).slice(0, 8000), t: Date.now() });
    if (S.history.length > MAX_HISTORY) S.history.splice(0, S.history.length - MAX_HISTORY);
    saveSoon();
    if (msgsEl) {
      var empty = msgsEl.querySelector('.vp-msg.vex:only-child');
      if (empty && S.history.length === 1) msgsEl.replaceChildren();
      var b = bubble(who, text);
      b.classList.add('new');
      msgsEl.appendChild(b);
      msgsEl.scrollTop = msgsEl.scrollHeight;
    }
  }

  function openPanel(focus) {
    if (!on()) return;
    if (!orb) makeOrb();
    if (!panel) makePanel();
    clearTimeout(autoT);   /* opened again: an old "close after answering" must not close it */
    open = true;
    panel.hidden = false;
    var root = UI.overlayRoot();
    if (panel.parentNode !== root) root.appendChild(panel);
    if (orb.parentNode !== root) root.appendChild(orb);
    placePanel();
    panel.classList.add('show');
    paintOrb();
    pauseGame();
    if (focus !== false) setTimeout(function () { inputEl.focus(); }, 40);
    Sound.open();
  }
  function close() {
    clearTimeout(autoT);
    if (!panel || !open) return;
    open = false;
    panel.classList.remove('show');
    panel.hidden = true;
    paintOrb();
    if (!speakingNow()) resumeGame();
    /* give the keyboard back to the game */
    if (Player.isPlaying()) setTimeout(function () { Player.focusGame(); }, 30);
  }
  function toggle() { if (open) close(); else openPanel(); }
  var closeT = 0;
  /* for actions like "take a screenshot": get out of the way */
  function closeSoon() { clearTimeout(closeT); closeT = setTimeout(close, 450); }

  /* a game is running when you call VEX: pause it, and continue when VEX is done */
  var pausedGame = false;
  function pauseGame() {
    if (!Player.isPlaying() || pausedGame) return;
    var k = Player.kit();
    if (k) { try { k._pause(); pausedGame = true; } catch (e) { /* ignore */ } }
  }
  function resumeGame() {
    if (!pausedGame) return;
    pausedGame = false;
    var k = Player.kit();
    if (k) { try { k._resume(); } catch (e) { /* ignore */ } }
  }

  /* ---------------- asking ---------------- */
  function historyForAi() {
    return S.history.slice(-12, -1).map(function (m) { return { role: m.who === 'you' ? 'user' : 'assistant', content: m.text }; });
  }
  function waitHint() {
    if (statusEl) statusEl.textContent = 'One sec, still thinking…';
    if (panel) { panel.classList.remove('shake'); void panel.offsetWidth; panel.classList.add('shake'); }
  }
  /* opts.voice: you talked (wake word or hold-to-talk). In a game, VEX gets out of the way after answering. */
  async function ask(text, opts) {
    opts = opts || {};
    text = String(text || '').trim();
    if (!text) return;
    if (busy) {
      /* still answering the last one: don't lose this, park it in the box */
      if (inputEl && !inputEl.value) inputEl.value = text;
      waitHint();
      resumeListening();
      return;
    }
    clearTimeout(autoT);
    var inGame = Player.isPlaying();
    if (!open && !opts.quiet) openPanel(false);
    addMsg('you', text);
    setChips([]);
    busy = true;
    var reply;
    try { reply = await VexBrain.handle(text, historyForAi()); }
    catch (e) { console.error(e); reply = 'Oops, something broke on my side (' + (e.message || e) + ').'; }
    busy = false;
    if (reply == null) reply = 'Hmm.';
    var r = typeof reply === 'string' ? { text: reply } : reply;
    addMsg('vex', r.text);
    setChips(r.chips && r.chips.length ? r.chips : (VexBrain.waiting() ? [] : ['What can you do?', 'Give me a tip']));
    var said = st().vexSpeak !== false && !!window.speechSynthesis;
    speak(r.speak || r.text, function () {
      if (r.expect && voiceOn && st().vexWake !== 'off') listenForAnswer();
      else if (opts.voice && inGame && !r.expect) autoClose(said ? 1500 : Math.min(9000, 3000 + r.text.length * 40));
    });
    if (!open && !speakingNow()) resumeGame();
    return r;
  }
  /* after a voice question in a game: close the chat (and continue the game) unless you started typing */
  var autoT = 0;
  function autoClose(ms) {
    clearTimeout(autoT);
    autoT = setTimeout(function () {
      if (open && Player.isPlaying() && !busy && !talking && !(inputEl && inputEl.value) && document.activeElement !== inputEl) close();
    }, ms);
  }

  /* ---------------- talking out loud ---------------- */
  var voiceOn = false;
  function speakingNow() { return !!(window.speechSynthesis && speechSynthesis.speaking); }
  function pickVoice() {
    if (!window.speechSynthesis) return null;
    var list = speechSynthesis.getVoices();
    if (!list.length) return null;
    var want = st().vexVoice;
    return list.find(function (v) { return v.voiceURI === want; }) ||
      list.find(function (v) { return /^en(-|_)/i.test(v.lang) && /google|natural|neural|online/i.test(v.name); }) ||
      list.find(function (v) { return /^en/i.test(v.lang); }) || list[0];
  }
  function speakable(text) {
    return String(text).replace(/```[\s\S]*?```/g, ' (code) ').replace(/[•*_#`>]/g, ' ').replace(/https?:\/\/\S+/g, 'a link').replace(/\n+/g, '. ').replace(/\s+/g, ' ').slice(0, 600);
  }
  var curU = null;   /* the line VEX is saying right now */
  function speak(text, done) {
    if (st().vexSpeak === false || !window.speechSynthesis || !text) { resumeListening(); if (done) done(); return; }
    try {
      var u = new SpeechSynthesisUtterance(speakable(text));
      curU = u;
      speechSynthesis.cancel();
      var v = pickVoice();
      if (v) { u.voice = v; u.lang = v.lang; }
      u.rate = Number(st().vexRate) || 1.05;
      u.pitch = Number(st().vexPitch) || 1;
      u.volume = Math.min(1, (st().volume == null ? 0.6 : st().volume) * 1.4 + 0.15);
      pauseListening();
      var finished = false, guard = 0;
      var finish = function () {
        if (finished) return;
        finished = true;
        clearInterval(guard);
        /* a newer line cut this one off: the newer one carries on (and must not hear itself) */
        if (curU !== u) return;
        curU = null;
        setMood('idle');
        resumeListening();
        if (!open) resumeGame();
        if (done) done();
      };
      u.onstart = function () { if (curU === u) setMood('talking'); };
      u.onboundary = function () { if (orb) { orb.classList.remove('pulse'); void orb.offsetWidth; orb.classList.add('pulse'); } };
      u.onend = u.onerror = finish;
      /* some browsers forget to say "done" on long lines: check by hand */
      guard = setInterval(function () { if (curU !== u || (!speechSynthesis.speaking && !speechSynthesis.pending)) finish(); }, 1500);
      speechSynthesis.speak(u);
    } catch (e) { curU = null; resumeListening(); if (done) done(); }
  }

  /* ---------------- hearing you ---------------- */
  var wake = null, listening = false, wakePaused = false, restartT = 0, failCount = 0;
  var WAKE_TIGHT = /\b(hey|hi|yo|okay|ok|ay|ayo)[\s,]+(vex|vexx|vecs|vecks|vax|vics|becks)\b/i;
  var WAKE_NAME = /\b(vex|vexx|vecs|vecks|vax|vics|becks|vix)\b/i;
  function wakeRe() { return st().vexWake === 'hey' ? WAKE_TIGHT : WAKE_NAME; }
  function setListening(onOff) {
    st().vexWake = onOff ? (st().vexWake && st().vexWake !== 'off' ? st().vexWake : 'name') : 'off';
    D.saveSettings();
    if (onOff) startWake(); else stopWake();
  }
  var PLACEHOLDER = 'Ask VEX anything, or tell it what to do…';
  /* "hey vex, play snake" → "play snake" */
  function afterWake(txt) {
    var m = wakeRe().exec(txt);
    return (m ? txt.slice(m.index + m[0].length) : txt).replace(/^[\s,.!?]+/, '').trim();
  }
  function startWake() {
    if (!SR || !on() || st().vexWake === 'off' || listening || wakePaused) return;
    try {
      wake = new SR();
      wake.continuous = true;
      wake.interimResults = true;
      wake.lang = st().vexLang || navigator.language || 'en-US';
      var capturing = false, captureT = 0, wakeIdx = -1;
      var stopCapture = function () { capturing = false; clearTimeout(captureT); if (inputEl) inputEl.placeholder = PLACEHOLDER; };
      wake.onresult = function (e) {
        if (wakePaused || talking) return;
        for (var i = e.resultIndex; i < e.results.length; i++) {
          var res = e.results[i];
          var txt = res[0].transcript;
          if (capturing) {
            /* the words after "VEX": the rest of the same sentence, or the next one.
               (The browser first sends "vex" as a guess, then "vex" again as final: that's not the question yet.) */
            var said = i === wakeIdx ? afterWake(txt) : VexBrain.stripWake(txt.trim());
            if (inputEl && said) inputEl.placeholder = said;
            if (res.isFinal && said) { stopCapture(); setMood('idle'); ask(said, { voice: true }); }
            continue;
          }
          var m = wakeRe().exec(txt);
          if (!m) continue;
          var rest = afterWake(txt);
          var words = rest.split(/\s+/).filter(Boolean).length;
          /* "VEX help" counts; "...told vex about it" (VEX in the middle) needs more words to be sure */
          var before = txt.slice(0, m.index).trim();
          var atStart = !before || /^(hey|hi|yo|okay|ok|ay|ayo)$/i.test(before);
          if (res.isFinal && words >= (atStart ? 1 : 2)) { heard(); ask(rest, { voice: true }); continue; }
          if (res.isFinal || txt.trim().split(/\s+/).length <= 3) {
            /* just "VEX": listen for what comes next */
            heard();
            capturing = true;
            wakeIdx = i;
            setMood('listening');
            clearTimeout(captureT);
            captureT = setTimeout(function () { stopCapture(); setMood('idle'); }, 7000);
          }
        }
      };
      wake.onerror = function (e) {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          listening = false;
          st().vexWake = 'off'; D.saveSettings();
          UI.toast('VEX can\'t hear you: the mic is blocked. Allow it in the browser (the lock icon next to the address), then turn listening on in Settings → VEX.', { type: 'warn', timeout: 9000 });
        } else if (e.error === 'network') failCount++;
      };
      wake.onend = function () {
        listening = false;
        paintOrb();
        if (st().vexWake === 'off' || !on() || wakePaused) return;
        clearTimeout(restartT);
        restartT = setTimeout(startWake, failCount > 3 ? 15000 : 400);
      };
      wake.start();
      listening = true;
      failCount = 0;
      paintOrb();
    } catch (e) { listening = false; }
  }
  function stopWake() { clearTimeout(restartT); if (wake) { try { wake.onend = null; wake.abort(); } catch (e) { /* ignore */ } } wake = null; listening = false; paintOrb(); }
  /* while VEX talks (or you hold to talk) the "VEX" listener sleeps, so it never hears itself.
     Also stops a restart that was about to happen. */
  function pauseListening() {
    if (!SR || st().vexWake === 'off') return;
    wakePaused = true;
    clearTimeout(restartT);
    if (listening && wake) { try { wake.abort(); } catch (e) { /* ignore */ } }
  }
  function resumeListening() { if (!wakePaused) return; wakePaused = false; clearTimeout(restartT); restartT = setTimeout(startWake, 300); }
  function heard() { Sound.select(); if (!open) openPanel(false); pauseGame(); }
  /* after VEX asks "yes or no?", listen once for the answer */
  function listenForAnswer() { if (!SR) return; startTalk(true); }

  /* hold-to-talk (your key, the mic button, or holding Y on a controller) */
  var talk = null, talking = false, talkText = '';
  function startTalk(auto) {
    if (!SR) { UI.toast('Your browser can\'t hear you. Chrome or Edge can. You can still type to VEX.', { type: 'warn' }); return; }
    if (talking) return;
    if (!open) openPanel(false);
    pauseListening();
    try {
      talk = new SR();
      talk.continuous = !auto;
      talk.interimResults = true;
      talk.lang = st().vexLang || navigator.language || 'en-US';
      talkText = '';
      talk.onresult = function (e) {
        var s = '';
        for (var i = 0; i < e.results.length; i++) s += e.results[i][0].transcript;
        talkText = s;
        if (inputEl) inputEl.value = s;
        if (auto && e.results[e.results.length - 1].isFinal) stopTalk();
      };
      talk.onerror = function (e) {
        if (e.error === 'not-allowed') UI.toast('The mic is blocked. Allow it in the browser to talk to VEX.', { type: 'warn' });
      };
      talk.onend = function () { if (talking) finishTalk(); };
      talk.start();
      talking = true;
      voiceOn = true;
      setMood('listening');
      if (micBtn) micBtn.classList.add('on');
      if (auto) setTimeout(function () { if (talking && !talkText) stopTalk(); }, 6000);
    } catch (e) { talking = false; }
  }
  function stopTalk() { if (!talking) return; try { talk.stop(); } catch (e) { finishTalk(); } setTimeout(function () { if (talking) finishTalk(); }, 1200); }
  function finishTalk() {
    talking = false;
    if (micBtn) micBtn.classList.remove('on');
    setMood('idle');
    var t = talkText.trim();
    talkText = '';
    if (inputEl) inputEl.value = '';
    if (t) ask(t, { voice: true }); else resumeListening();
  }

  /* ---------------- keys ---------------- */
  function keyIs(e, combo) {
    if (!combo) return false;
    var parts = String(combo).toLowerCase().split('+');
    var key = parts.pop();
    return ((e.key || '').toLowerCase() === key || String(e.code || '').toLowerCase() === key) &&
      !!e.ctrlKey === (parts.indexOf('ctrl') >= 0) && !!e.altKey === (parts.indexOf('alt') >= 0) && !!e.shiftKey === (parts.indexOf('shift') >= 0);
  }
  /* returns true if the key was VEX's */
  function keyAction(e) {
    if (!on()) return false;
    if (keyIs(e, st().vexTalkKey)) { startTalk(); return true; }
    if (keyIs(e, st().vexChatKey)) { toggle(); return true; }
    return false;
  }
  function keyUp(e) {
    if (talking && st().vexTalkKey) {
      var k = String(st().vexTalkKey).toLowerCase().split('+').pop();
      if ((e.key || '').toLowerCase() === k || String(e.code || '').toLowerCase() === k) { stopTalk(); return true; }
    }
    return false;
  }

  /* ---------------- controller: hold Y to talk (on the menus) ---------------- */
  var padY = 0, padLoop = 0;
  function pollPad() {
    padLoop = 0;
    var list = navigator.getGamepads ? navigator.getGamepads() : [];
    var any = false, y = false;
    for (var i = 0; i < list.length; i++) { var p = list[i]; if (!p) continue; any = true; if (p.buttons[3] && p.buttons[3].pressed) y = true; }
    if (on() && !Player.isPlaying() && document.hasFocus()) {
      var now = performance.now();
      if (y && !padY) padY = now;
      else if (y && padY > 0 && now - padY > 350) { padY = -1; startTalk(); }
      else if (!y && padY) { if (padY === -1) stopTalk(); padY = 0; }
    }
    if (any) padLoop = requestAnimationFrame(pollPad);
  }

  /* ---------------- memory ---------------- */
  function remember(text) { S.memory.push({ text: String(text).slice(0, 300), t: Date.now() }); if (S.memory.length > 200) S.memory.shift(); saveSoon(); }
  function memories() { return S.memory.slice(); }
  /* forget(): everything. forget("racing"): every memory about racing. forget(text, true): just that one. */
  function forget(q, exact) {
    if (!q) { var n0 = S.memory.length; S.memory = []; saveSoon(); return n0; }
    var w = VexBrain.norm(q);
    var before = S.memory.length;
    S.memory = S.memory.filter(function (m) { return exact ? m.text !== q : VexBrain.norm(m.text).indexOf(w) < 0; });
    saveSoon();
    return before - S.memory.length;
  }
  function clearHistory() { S.history = []; saveSoon(); renderHistory(); }

  /* ---------------- the tour (first start) ---------------- */
  var STEPS = [
    { sel: null, text: 'Yo {name}! I\'m VEX, your helper. Let me show you around real quick. (You can skip this anytime.)' },
    { sel: '.tab[data-view="home"]', text: 'Home shows what you played last. Hit CONTINUE to jump right back in.' },
    { sel: '.tab[data-view="library"]', text: 'Library has ALL your games and apps. Drag them around and drop one on another to make a folder.' },
    { sel: '.tab[data-view="apps"]', text: 'Apps: Music, Notes, Gallery, Timer, Code and more. They open in windows over everything.' },
    { sel: '#btn-add', text: 'Add brings in games: files, zips, whole folders, or code from an AI.' },
    { sel: '#btn-bell', text: 'The bell tells you stuff, like when it\'s time for a backup.' },
    { sel: '#btn-profile', text: 'Your profile: your picture, your level and your trophies.' },
    { sel: '.vex-orb', text: 'And that\'s me. Click me anytime, or turn on listening in Settings and just say "VEX". Have fun!' }
  ];
  function tour() {
    if (!on()) return;
    if (!orb) makeOrb();
    close();
    var i = 0;
    var shade = h('div.vex-tour-shade');
    var spot = h('div.vex-tour-spot');
    var box = h('div.vex-tour-box', { role: 'dialog', 'aria-label': 'VEX tour' });
    document.body.appendChild(shade); document.body.appendChild(spot); document.body.appendChild(box);
    function end() { shade.remove(); spot.remove(); box.remove(); U.lsSet('gs2:vexTour', Date.now()); window.speechSynthesis && speechSynthesis.cancel(); window.removeEventListener('keydown', key, true); }
    function key(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(); } }
    window.addEventListener('keydown', key, true);
    function show() {
      var s = STEPS[i];
      var el = s.sel ? document.querySelector(s.sel) : null;
      if (el && !el.offsetParent && el !== orb) el = null;
      var text = s.text.replace('{name}', st().name || 'bro');
      box.replaceChildren(
        h('div.vt-head', h('span.vp-mini', h('i')), h('b', 'VEX'), h('span.vt-step', (i + 1) + ' / ' + STEPS.length)),
        h('p', text),
        h('div.vt-acts',
          h('button.btn.sm.ghost', { onclick: end }, 'Skip'),
          h('div.grow'),
          i ? h('button.btn.sm', { onclick: function () { i--; show(); } }, 'Back') : null,
          h('button.btn.sm.primary', { onclick: function () { if (i < STEPS.length - 1) { i++; show(); } else end(); } }, i < STEPS.length - 1 ? 'Next' : 'Let\'s go!')));
      if (el) {
        var r = el.getBoundingClientRect();
        spot.hidden = false;
        spot.style.left = (r.left - 8) + 'px'; spot.style.top = (r.top - 8) + 'px';
        spot.style.width = (r.width + 16) + 'px'; spot.style.height = (r.height + 16) + 'px';
        var bx = Math.max(12, Math.min(window.innerWidth - 352, r.left + r.width / 2 - 170));
        var by = r.bottom + 18 + 200 < window.innerHeight ? r.bottom + 18 : Math.max(12, r.top - 18 - 190);
        box.style.left = bx + 'px'; box.style.top = by + 'px'; box.style.transform = 'none';
      } else {
        spot.hidden = true;
        box.style.left = '50%'; box.style.top = '40%'; box.style.transform = 'translate(-50%, -50%)';
      }
      speak(text);
      setTimeout(function () { var b = box.querySelector('.btn.primary'); if (b) b.focus(); }, 30);
    }
    show();
  }

  /* ---------------- start ---------------- */
  async function init() {
    await load();
    if (on()) makeOrb();
    if (window.speechSynthesis && speechSynthesis.onvoiceschanged !== undefined) speechSynthesis.onvoiceschanged = function () { /* voices are ready */ };
    window.addEventListener('resize', U.debounce(function () { if (orb && orb.style.left) placeOrb(orb.offsetLeft, orb.offsetTop); if (open) placePanel(); }, 120));
    document.addEventListener('fullscreenchange', function () {
      var root = UI.overlayRoot();
      [orb, panel].forEach(function (el) { if (el && el.parentNode !== root) root.appendChild(el); });
    });
    window.addEventListener('keyup', function (e) { keyUp(e); }, true);
    window.addEventListener('gamepadconnected', function () { if (!padLoop) padLoop = requestAnimationFrame(pollPad); });
    if (navigator.getGamepads && Array.prototype.some.call(navigator.getGamepads(), Boolean)) padLoop = requestAnimationFrame(pollPad);
    D.on(function (type) {
      if (type === 'settings') {
        if (on() && !orb) makeOrb();
        paintOrb();
        if (!on()) { close(); stopWake(); }
        else if (st().vexWake !== 'off' && !listening && st().vexMicOk) startWake();
        else if (st().vexWake === 'off' && listening) stopWake();
      }
      if (type === 'trophies') paintOrb();
    });
    /* listening only starts by itself if you allowed the mic before */
    if (on() && st().vexWake && st().vexWake !== 'off' && st().vexMicOk) startWake();
  }
  /* Settings → "Allow mic": ask the browser once, then listen */
  async function allowMic() {
    if (!SR) { UI.toast('Your browser can\'t do voice. Chrome or Edge can. You can still type to VEX.', { type: 'warn' }); return false; }
    try {
      var s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach(function (t) { t.stop(); });
      st().vexMicOk = true;
      if (!st().vexWake || st().vexWake === 'off') st().vexWake = 'name';
      D.saveSettings();
      startWake();
      UI.toast('VEX is listening. Just say "VEX"!', { icon: 'mic', type: 'good' });
      return true;
    } catch (e) {
      UI.toast('The mic was blocked. Allow it with the lock icon next to the address, then try again.', { type: 'warn', timeout: 8000 });
      return false;
    }
  }

  window.Vex = {
    init: init,
    open: openPanel,
    close: close,
    toggle: toggle,
    ask: ask,
    say: function (text) { addMsg('vex', text); speak(text); },
    speak: speak,
    panelOpen: function () { return open; },
    closeSoon: closeSoon,
    thinking: thinking,
    setListening: setListening,
    isListening: function () { return listening; },
    allowMic: allowMic,
    canHear: function () { return !!SR; },
    keyAction: keyAction,
    keyUp: keyUp,
    remember: remember,
    memories: memories,
    forget: forget,
    history: function () { return S.history.slice(); },
    clearHistory: clearHistory,
    tour: tour,
    pickVoice: pickVoice,
    repaint: paintOrb
  };
})();
