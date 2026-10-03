/* AI Play - the app: screens, buttons, library, squad, leaderboard, diary, settings, play view. */
'use strict';

(function () {
  const U = AIP.util;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = U.esc;
  const H = AIP.Heart;

  const app = AIP.app = {
    ais: [], games: [], ai: null, session: null, hearts: {}, diaryCache: [], view: 'library', tab: 'chat',
    graphHover: null, idleDreams: 0, lastIdleDream: 0,
  };

  /* ================= start-up ================= */
  app.init = async function () {
    bindChrome();
    try { await AIP.db.open(); } catch (e) {
      toast("⚠️ Your browser is blocking saving, so the AI will forget everything when you close this. Try Chrome or Edge.");
    }
    try { app.ais = await AIP.squad.all(); } catch (e) { app.ais = []; }
    try { app.games = await AIP.db.all('games'); } catch (e) { app.games = []; }
    app.games.sort((a, b) => b.addedAt - a.addedAt);
    let seeded = false;
    try { seeded = localStorage.getItem('aiplay.seeded') === '1'; } catch (e) { /* ignore */ }
    if (!seeded && AIP.practice) {
      for (const p of AIP.practice) {
        const g = await AIP.loader.makeGame({ 'index.html': new Blob([p.html], { type: 'text/html' }) }, p.name);
        g.name = p.name; g.practice = true; g.addedAt = Date.now() - 1000 * (AIP.practice.indexOf(p) + 1);
        app.games.push(g);
        try { await AIP.db.put('games', g); } catch (e) { /* ignore */ }
      }
      try { localStorage.setItem('aiplay.seeded', '1'); } catch (e) { /* ignore */ }
    }
    let curId = null;
    try { curId = localStorage.getItem('aiplay.current'); } catch (e) { /* ignore */ }
    app.ai = app.ais.find((a) => a.id === curId) || app.ais[0] || null;
    try { app.diaryCache = app.ai ? await AIP.squad.diary(app.ai.id) : []; } catch (e) { app.diaryCache = []; }
    renderAll();
    if (!app.ai) await birthFlow(true);
    setInterval(idleDream, 20000);
  };

  function setCurrent(ai) {
    app.ai = ai;
    try { localStorage.setItem('aiplay.current', ai.id); } catch (e) { /* ignore */ }
    AIP.squad.diary(ai.id).then((d) => { app.diaryCache = d; }).catch(() => {});
    renderAll();
  }
  app.heartFor = (ai) => (app.hearts[ai.id] = app.hearts[ai.id] || new H(ai));
  function calmFace(ai) { return app.hearts[ai.id] ? app.hearts[ai.id].face() : { mouth: 0.45, brow: 0, eyeOpen: 1 }; }

  /* ================= navigation ================= */
  function show(view) {
    if (view !== 'play' && app.session) { stopSession(); }
    app.view = view;
    $$('.view').forEach((v) => v.classList.toggle('on', v.id === 'view-' + view));
    $$('.nav button').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
    if (view === 'library') renderLibrary();
    if (view === 'squad') renderSquad();
    if (view === 'board') renderBoard();
    if (view === 'diary') renderDiary();
    if (view === 'settings') renderSettings();
    window.scrollTo(0, 0);
  }
  function renderAll() {
    renderTopAi();
    if (app.view === 'library') renderLibrary();
    if (app.view === 'squad') renderSquad();
  }
  function renderTopAi() {
    const ai = app.ai;
    $('#curAi').innerHTML = ai ? '<div class="mini">' + AIP.avatar.svg(ai.look, calmFace(ai)) + '</div><span>' + esc(ai.name) + '</span>' : '<span>🐣 Make an AI</span>';
    $('#heroBot').innerHTML = ai ? AIP.avatar.svg(ai.look, Object.assign(calmFace(ai), { anim: 'float' })) : '';
    $('#heroName').textContent = ai ? ai.name : 'Your AI';
  }

  /* ================= library ================= */
  function renderLibrary() {
    const grid = $('#gameGrid');
    if (!app.games.length) { grid.innerHTML = '<div class="empty">No games yet. Add an HTML game file or folder above ☝️</div>'; return; }
    grid.innerHTML = app.games.map((g) => {
      const s = app.ai && app.ai.stats && app.ai.stats.games ? app.ai.stats.games[g.id] : null;
      const meta = s && s.tries ? 'Best ' + U.fmt(s.best) + kindWord(s.scoreKind) + ' · ' + s.tries + ' tries' : 'Never played yet';
      const thumb = g.thumb ? `style="background-image:url('${g.thumb}')"` : '';
      return `<div class="card game-card" data-id="${g.id}" tabindex="0" role="button" aria-label="Play ${esc(g.name)}">
        <div class="thumb-img" ${thumb}>${g.thumb ? '' : (g.practice ? '🎯' : '🎮')}</div>
        <button class="card-menu" data-menu="${g.id}" title="More">⋯</button>
        <span class="card-play">▶ PLAY</span>
        <div class="card-body"><div class="card-title">${esc(g.name)}</div>
        <div class="card-meta">${g.practice ? '<span class="tag">practice</span>' : ''}${g.isFolder ? '<span class="tag">folder</span>' : '<span class="tag">file</span>'}${esc(meta)}</div></div></div>`;
    }).join('');
  }
  const kindWord = (k) => (k === 'time' ? 's survived' : k === 'explore' ? ' explored' : '');

  async function addGame(g) {
    app.games.unshift(g);
    try { await AIP.db.put('games', g); } catch (e) { toast('⚠️ Could not save the game (too big?)'); }
    renderLibrary();
    toast('Added "' + g.name + '"! Click it and ' + (app.ai ? app.ai.name : 'the AI') + ' will play it 🎮');
  }
  async function gameMenu(id) {
    const g = app.games.find((x) => x.id === id);
    if (!g || !app.ai) return;
    const ai = app.ai;
    const choice = await modal(`<h2>${esc(g.name)}</h2><p class="sub">What do you wanna do?</p>
      <div class="row" style="flex-direction:column">
        <button class="btn" data-v="wipe">🧽 Give ${esc(ai.name)} a fresh copy (wipe ITS game save)</button>
        <button class="btn" data-v="forget">🧠 Make ${esc(ai.name)} forget this game</button>
        <button class="btn danger" data-v="delete">🗑️ Remove game from library</button>
        <button class="btn" data-v="">Cancel</button></div>`);
    if (!choice) return;
    const key = ai.id + '|' + g.id;
    if (choice === 'wipe') {
      const rec = await AIP.db.get('brains', key);
      if (rec) { rec.gameSave = {}; await AIP.db.put('brains', rec); }
      toast('🧽 ' + ai.name + ' gets a fresh copy of ' + g.name + ' next time.');
    } else if (choice === 'forget') {
      if (!(await confirmBox('Make ' + ai.name + ' forget everything about ' + g.name + '? Its brain for this game gets erased.'))) return;
      await AIP.db.del('brains', key); await AIP.db.del('replays', key);
      if (ai.stats && ai.stats.games) delete ai.stats.games[g.id];
      await AIP.squad.save(ai);
      toast('🧠 ' + ai.name + ' forgot ' + g.name + '.');
      renderLibrary();
    } else if (choice === 'delete') {
      if (!(await confirmBox('Remove ' + g.name + ' from the library? (Your real game file is not touched.)'))) return;
      await AIP.db.del('games', g.id);
      for (const a of app.ais) { await AIP.db.del('brains', a.id + '|' + g.id); await AIP.db.del('replays', a.id + '|' + g.id); if (a.stats && a.stats.games) delete a.stats.games[g.id]; await AIP.squad.save(a); }
      app.games = app.games.filter((x) => x.id !== g.id);
      renderLibrary();
    }
  }
  app.gamesChanged = () => { if (app.view === 'library') renderLibrary(); };

  /* ================= play ================= */
  async function play(id) {
    const g = app.games.find((x) => x.id === id);
    if (!g) return;
    if (!app.ai) { await birthFlow(true); if (!app.ai) return; }
    if (app.session) await stopSession();
    show('play');
    const ai = app.ai;
    $('#playTitle').textContent = g.name;
    $('#chatlog').innerHTML = '';
    $('#gameErrors').hidden = true;
    $('#gameErrors').textContent = '';
    $('#watchName').textContent = ai.name;
    $('#facecamName').textContent = ai.name;
    $('#whoName').textContent = ai.name;
    $('#personality').textContent = ai.name + ' is ' + H.describe(ai.traits).join(', ') + '. (Born that way, and it keeps changing from what happens to it.)';
    applyLayout();
    updateModeButtons('ai');
    app.faceKey = '';
    app.chat('sys', 'Loading ' + g.name + '…');
    const s = new AIP.Session(app, ai, g, app.heartFor(ai));
    app.session = s;
    drawGraph();
    await s.start($('#stage'), $('#vcursor'));
  }
  async function stopSession() {
    const s = app.session;
    if (!s) return;
    app.session = null;
    await s.stop();
    app.ais.forEach((a) => { if (a.id === s.ai.id) Object.assign(a, s.ai); });
    $('#stage').classList.remove('dreaming', 'watching');
  }
  function updateModeButtons(mode) {
    $('#btnMode').textContent = mode === 'pause' ? '▶️ Resume' : '⏸️ Pause';
    $('#btnWatch').textContent = mode === 'watch' ? '🤖 AI plays' : '🎮 You play';
    $('#btnWatch').classList.toggle('on', mode === 'watch');
    $('#stage').classList.toggle('watching', mode === 'watch');
  }
  function applyLayout() {
    const lay = AIP.settings.get().layout;
    $('#playWrap').classList.toggle('overlay', lay === 'overlay');
    $('#playWrap').classList.toggle('side', lay !== 'overlay');
  }

  app.chat = function (who, text, mood, ai) {
    const log = $('#chatlog');
    if (!log) return;
    const el = document.createElement('div');
    el.className = 'msg ' + who;
    if (who === 'ai') el.innerHTML = '<div class="m-who">' + esc(ai ? ai.name : 'AI') + ' ' + (H.EMOJI[mood] || '') + '</div>' + esc(text);
    else el.textContent = text;
    const box = log.parentElement.parentElement;
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    log.appendChild(el);
    while (log.children.length > 160) log.removeChild(log.firstChild);
    if (atBottom || who === 'you') box.scrollTop = box.scrollHeight;
    if (who === 'ai') {
      const b = $('#bubble');
      b.textContent = text;
      b.classList.add('show');
      clearTimeout(app.bubbleT);
      app.bubbleT = setTimeout(() => b.classList.remove('show'), 3800);
    }
  };
  app.gameErrors = function (list) {
    const box = $('#gameErrors');
    box.hidden = false;
    box.textContent = (box.textContent ? box.textContent + '\n' : '') + list.slice(0, 4).map((e) => '⚠️ game error: ' + e).join('\n');
  };
  app.diaryAdded = function (e) { if (e) { app.diaryCache.unshift(e); if (app.view === 'diary') renderDiary(); } };
  app.episodeDone = function () { drawGraph(); };

  // Called ~5x a second while playing
  app.renderPlay = function (s, obs, heavy) {
    if (app.session !== s) return;
    const h = s.heart, ai = s.ai;
    const face = h.face();
    const key = [face.dom, face.anim, face.tears, face.sweat, face.anger, face.sparkle, face.question, face.zzz, Math.round(face.eyeOpen * 6), Math.round(face.brow * 4), Math.round(face.mouth * 4), Math.round(face.open * 4), Math.round(face.pain * 4)].join('|');
    if (key !== app.faceKey) {
      app.faceKey = key;
      const svg = AIP.avatar.svg(ai.look, face);
      $('#whoBot').innerHTML = svg;
      $('#facecamBot').innerHTML = svg;
    }
    const dom = h.dominant();
    const why = h.whyFeel(dom.name);
    const moodName = { calm: 'chillin', dreaming: 'dreaming', pain: 'in PAIN' }[dom.name] || dom.name;
    $('#whoMood').innerHTML = (H.EMOJI[dom.name] || '') + ' <span style="color:' + (H.COLOR[dom.name] || 'var(--text)') + '">' + esc(moodName) + '</span>' + (why && dom.name !== 'calm' ? ' <span class="note">(' + esc(why) + ')</span>' : '');
    const pm = AIP.settings.get().painMode;
    $('#painBar').hidden = !pm;
    if (pm) $('#painFill').style.width = Math.round(h.pain * 100) + '%';
    const gs = AIP.squad.gameStats(ai, s.game.id);
    $('#whoStats').textContent = 'Try #' + (gs.tries + 1) + ' · Best ' + U.fmt(gs.best) + kindWord(gs.scoreKind) + (obs && obs.score != null ? ' · Score ' + U.fmt(obs.score) : '');
    const st = $('#stage');
    st.classList.toggle('dreaming', s.phase === 'dreaming');
    if (s.phase === 'dreaming') $('#dreamText').textContent = s.reason;
    st.classList.toggle('watching', s.mode === 'watch');
    if (app.tab === 'feel') renderMeters(h, pm);
    if (app.tab === 'think') renderThinking(s);
    if (heavy && app.tab === 'learn') renderLearned(s);
    if (heavy && app.tab === 'keys') renderKeys(s);
  };
  function renderMeters(h, pm) {
    const rows = H.EMOS.map((k) => ({ k, v: h.e[k] }));
    if (pm) rows.unshift({ k: 'pain', v: h.pain });
    $('#meters').innerHTML = rows.map((r) => `<div class="meter"><span class="m-label">${H.EMOJI[r.k] || ''} ${r.k}</span><div class="m-track"><div class="m-fill" style="width:${Math.round(r.v * 100)}%;background:${H.COLOR[r.k]}"></div></div><span class="m-val">${Math.round(r.v * 100)}</span></div>`).join('');
  }
  function renderThinking(s) {
    $('#reason').textContent = s.mode === 'watch' ? '👀 watching you play' : s.mode === 'pause' ? '⏸️ paused' : s.reason || '';
    // what it sees (+ where it thinks it is)
    const c = $('#eye'), x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(s.senses.eyeImage(), 0, 0, c.width, c.height);
    const me = s.brain.self;
    if (me.conf > 0.3) {
      x.strokeStyle = '#ff2bd6'; x.lineWidth = 2;
      x.beginPath(); x.arc(me.x * c.width, me.y * c.height, 9, 0, Math.PI * 2); x.stroke();
      x.fillStyle = '#ff2bd6'; x.font = 'bold 10px sans-serif'; x.fillText('me', me.x * c.width + 11, me.y * c.height - 6);
    }
    const held = s.hands ? [...s.hands.held] : [];
    const mouse = s.hands && s.hands.mouseDown ? ['🖱️ click'] : [];
    $('#held').innerHTML = (held.length || mouse.length ? '' : '<span class="note">not pressing anything</span>') + held.map((k) => '<span class="kbd down">' + esc(AIP.KEYS.label(k)) + '</span>').join('') + mouse.map((m) => '<span class="kbd down">' + m + '</span>').join('');
    const lv = s.brain.lastValues;
    if (!lv || s.mode !== 'ai') { $('#opinions').innerHTML = ''; return; }
    const items = lv.slots.map((slot, i) => ({ slot, v: lv.vals[i], label: s.brain.actions[slot].label })).sort((a, b) => b.v - a.v).slice(0, 7);
    const mx = Math.max(...items.map((i) => i.v)), mn = Math.min(...items.map((i) => i.v));
    const pick = s.brain.prev ? s.brain.prev.slot : -1;
    $('#opinions').innerHTML = '<div class="note">how good it thinks each move is right now:</div>' + items.map((i) => `<div class="op ${i.slot === pick ? 'pick' : ''}"><span class="op-name">${esc(i.label)}</span><span class="op-bar" style="width:${Math.round(8 + 92 * (i.v - mn) / Math.max(0.001, mx - mn))}%"></span></div>`).join('');
  }
  function renderLearned(s) {
    const items = s.brain.learned(null, s.primaryLabels());
    $('#learned').innerHTML = items.length ? items.map((l) => `<li class="${l.good ? '' : 'bad'}"><span class="ic">${l.icon}</span><span>${esc(l.text)}</span></li>`).join('') : '<li><span class="ic">🍼</span><span>Nothing yet - it just started! Give it a few seconds.</span></li>';
  }
  function renderKeys(s) {
    const C = s.brain.controls;
    const codes = Object.keys(C).filter((c) => c.indexOf('m:') !== 0).sort((a, b) => AIP.KEYS.order.indexOf(a) - AIP.KEYS.order.indexOf(b));
    $('#keylist').innerHTML = codes.length ? codes.map((code) => {
      const c = C[code];
      return `<div class="keyrow"><span class="kbd">${esc(AIP.KEYS.label(code))}</span><span class="kdesc">${esc(s.brain.controlLabel(code, c))}</span>
        <button data-star="${code}" class="${c.status === 'starred' ? 'on' : ''}" title="This key matters">⭐</button><button data-ban="${code}" class="${c.status === 'banned' ? 'on' : ''}" title="Don't use this key">🚫</button></div>`;
    }).join('') : '<p class="note">It hasn\'t tried any keys yet.</p>';
  }

  /* ---------- progress graph (score per try + best so far) ---------- */
  function graphData() {
    const s = app.session;
    if (!s) return [];
    let best = -Infinity;
    return (s.brain.stats.history || []).map((h, i) => { best = Math.max(best, h.s); return { i: i + 1, s: h.s, best, w: h.w, k: h.k }; });
  }
  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }
  function drawGraph() {
    const c = $('#graph');
    if (!c) return;
    const data = graphData();
    const dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth || 340, Hh = c.clientHeight || 210;
    c.width = W * dpr; c.height = Hh * dpr;
    const x = c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, W, Hh);
    const css = getComputedStyle(document.documentElement);
    const surf = css.getPropertyValue('--panel').trim(), s1 = css.getPropertyValue('--s1').trim(), s2 = css.getPropertyValue('--s2').trim();
    const pad = { l: 40, r: 44, t: 10, b: 22 };
    const note = $('#graphNote');
    if (!data.length) {
      x.fillStyle = '#6f6b95'; x.font = '13px sans-serif'; x.textAlign = 'center';
      x.fillText('No finished tries yet - this fills up as it plays', W / 2, Hh / 2);
      note.textContent = '';
      app.graphGeom = null;
      return;
    }
    const maxY = niceMax(Math.max(...data.map((d) => d.best)));
    const n = data.length;
    const X = (i) => pad.l + (n === 1 ? (W - pad.l - pad.r) / 2 : (i - 1) / (n - 1) * (W - pad.l - pad.r));
    const Y = (v) => pad.t + (1 - Math.max(0, v) / maxY) * (Hh - pad.t - pad.b);
    // grid + y ticks
    x.strokeStyle = 'rgba(160,150,255,.12)'; x.lineWidth = 1; x.fillStyle = '#a3a0c7'; x.font = '11px sans-serif'; x.textAlign = 'right'; x.textBaseline = 'middle';
    for (let k = 0; k <= 4; k++) {
      const v = maxY * k / 4, yy = Math.round(Y(v)) + 0.5;
      x.beginPath(); x.moveTo(pad.l, yy); x.lineTo(W - pad.r, yy); x.stroke();
      x.fillText(U.fmt(v), pad.l - 6, yy);
    }
    x.textAlign = 'center'; x.textBaseline = 'top';
    x.fillText('try 1', X(1), Hh - pad.b + 6);
    if (n > 1) x.fillText('try ' + n, X(n), Hh - pad.b + 6);
    // best-so-far (step line)
    x.strokeStyle = s2; x.lineWidth = 2; x.lineJoin = 'round'; x.lineCap = 'round';
    x.beginPath();
    data.forEach((d, k) => { if (k === 0) x.moveTo(X(d.i), Y(d.best)); else { x.lineTo(X(d.i), Y(data[k - 1].best)); x.lineTo(X(d.i), Y(d.best)); } });
    x.stroke();
    // score each try
    x.strokeStyle = s1;
    x.beginPath();
    data.forEach((d, k) => (k ? x.lineTo(X(d.i), Y(d.s)) : x.moveTo(X(d.i), Y(d.s))));
    x.stroke();
    if (n <= 70) data.forEach((d) => { x.beginPath(); x.arc(X(d.i), Y(d.s), 4, 0, Math.PI * 2); x.fillStyle = s1; x.fill(); x.lineWidth = 2; x.strokeStyle = surf; x.stroke(); });
    // end label for best
    const last = data[n - 1];
    x.fillStyle = '#ecebff'; x.font = 'bold 11px sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle';
    x.fillText('best ' + U.fmt(last.best), Math.min(X(n) + 6, W - pad.r + 2), Y(last.best));
    // hover crosshair
    const hv = app.graphHover;
    if (hv != null && data[hv]) {
      const d = data[hv];
      x.strokeStyle = 'rgba(236,235,255,.35)'; x.lineWidth = 1;
      x.beginPath(); x.moveTo(Math.round(X(d.i)) + 0.5, pad.t); x.lineTo(Math.round(X(d.i)) + 0.5, Hh - pad.b); x.stroke();
      x.beginPath(); x.arc(X(d.i), Y(d.s), 5, 0, Math.PI * 2); x.fillStyle = s1; x.fill(); x.lineWidth = 2; x.strokeStyle = surf; x.stroke();
    }
    app.graphGeom = { X, Y, n, data };
    const first5 = data.slice(0, Math.min(5, n)).reduce((a, d) => a + d.s, 0) / Math.min(5, n);
    const last5 = data.slice(-Math.min(5, n)).reduce((a, d) => a + d.s, 0) / Math.min(5, n);
    const unit = { time: 'seconds survived', explore: 'new things explored', score: 'score' }[last.k] || 'score';
    note.textContent = n >= 6 ? 'Average ' + unit + ': first 5 tries ' + U.fmt(first5) + ' → last 5 tries ' + U.fmt(last5) + (last5 > first5 * 1.1 ? ' 📈 getting better!' : last5 < first5 * 0.9 ? ' 📉 rough patch' : ' ➡️ about the same') : 'Measuring: ' + unit + '.';
    if (!$('#graphTableBox').hidden) renderGraphTable(data, unit);
  }
  function renderGraphTable(data, unit) {
    $('#graphTableBox').innerHTML = '<table><tr><th>try</th><th>' + esc(unit) + '</th><th>best so far</th></tr>' + data.slice().reverse().slice(0, 100).map((d) => `<tr><td>${d.i}</td><td>${U.fmt(d.s)}${d.w ? ' 🏆' : ''}</td><td>${U.fmt(d.best)}</td></tr>`).join('') + '</table>';
  }
  function graphHover(e) {
    const g = app.graphGeom;
    const tip = $('#gtip');
    if (!g) { tip.hidden = true; return; }
    const r = e.target.getBoundingClientRect();
    const mx = e.clientX - r.left;
    let bi = 0, bd = Infinity;
    g.data.forEach((d, k) => { const dd = Math.abs(g.X(d.i) - mx); if (dd < bd) { bd = dd; bi = k; } });
    app.graphHover = bi;
    drawGraph();
    const d = g.data[bi];
    tip.hidden = false;
    tip.style.left = g.X(d.i) + 'px';
    tip.style.top = g.Y(d.s) + 'px';
    tip.innerHTML = '<b>Try ' + d.i + '</b> · score ' + U.fmt(d.s) + (d.w ? ' 🏆' : '') + ' · best ' + U.fmt(d.best);
  }

  /* ================= squad ================= */
  function renderSquad() {
    const grid = $('#squadGrid');
    grid.innerHTML = app.ais.map((ai) => {
      const games = ai.stats && ai.stats.games ? Object.values(ai.stats.games) : [];
      const tries = games.reduce((a, g) => a + (g.tries || 0), 0);
      const words = H.describe(ai.traits);
      return `<div class="card ${app.ai && app.ai.id === ai.id ? 'current' : ''}">
        <div class="bot-big">${AIP.avatar.svg(ai.look, calmFace(ai))}</div>
        <div class="card-title">${esc(ai.name)}</div>
        <div class="traits">${words.map((w) => '<span class="tag">' + esc(w) + '</span>').join('')}</div>
        <div class="card-meta">Born ${U.timeAgo(ai.born)} · ${games.length} games · ${tries} tries${ai.stats && ai.stats.playMs ? ' · ' + Math.round(ai.stats.playMs / 60000) + ' min played' : ''}</div>
        <div class="card-meta">Says "${esc(ai.catchphrase)}" a lot</div>
        <div class="card-actions">
          ${app.ai && app.ai.id === ai.id ? '<span class="tag" style="border-color:var(--lime)">✅ current AI</span>' : `<button class="btn sm primary" data-use="${ai.id}">Use ${esc(ai.name)}</button>`}
          <button class="btn sm" data-rename="${ai.id}">✏️ Rename</button>
          <button class="btn sm danger" data-del="${ai.id}">🗑️</button>
        </div></div>`;
    }).join('') || '<div class="empty">No AIs yet. Make one! 🐣</div>';
  }
  // A new AI is born: it designs itself, picks a name, you can keep it or change it.
  async function birthFlow(first) {
    const ai = AIP.squad.birth(app.ais.map((a) => a.name));
    const words = H.describe(ai.traits);
    const tmpHeart = new H(ai);
    const html = `<div class="bot-big">${AIP.avatar.svg(ai.look, { mouth: 0.8, eyeOpen: 1.1, anim: 'bounce', sparkle: true })}</div>
      <h2>${first ? '🐣 Your first AI just got born!' : '🐣 A new AI just got born!'}</h2>
      <p>"Hi! I think my name is <b>${esc(ai.name)}</b>." <br><span class="note">It designed its own look and it's ${esc(words.join(', '))}. Keep the name or give it a new one:</span></p>
      <input id="nameInput" value="${esc(ai.name)}" maxlength="20" aria-label="Name">
      <div class="row"><button class="btn primary" data-v="keep">✨ That's my name</button>${first ? '' : '<button class="btn" data-v="">Cancel</button>'}</div>`;
    const v = new AIP.Voice(ai, tmpHeart, null);
    setTimeout(() => v.speak('Hi! I think my name is ' + ai.name, 3), 300);
    const res = await modal(html, (card) => { const i = $('#nameInput', card); i.focus(); i.select(); i.addEventListener('keydown', (e) => { if (e.key === 'Enter') card.querySelector('[data-v="keep"]').click(); }); });
    if (res !== 'keep') return null;
    const n = (app.lastModalInput || '').trim();
    if (n) ai.name = n.slice(0, 20);
    await AIP.squad.save(ai);
    app.ais.push(ai);
    setCurrent(ai);
    await AIP.squad.write(ai, null, 'born', 'I was born today! My name is ' + ai.name + '. I think I\'m ' + words.join(', ') + '.', 'excited').then(app.diaryAdded);
    toast('🐣 ' + ai.name + ' joined the squad!');
    return ai;
  }
  async function renameAi(id) {
    const ai = app.ais.find((a) => a.id === id);
    if (!ai) return;
    const res = await modal(`<div class="bot-big">${AIP.avatar.svg(ai.look, calmFace(ai))}</div><h2>Rename ${esc(ai.name)}</h2>
      <input id="nameInput" value="${esc(ai.name)}" maxlength="20" aria-label="New name"><div class="row"><button class="btn primary" data-v="ok">Save</button><button class="btn" data-v="">Cancel</button></div>`,
      (card) => { const i = $('#nameInput', card); i.focus(); i.select(); i.addEventListener('keydown', (e) => { if (e.key === 'Enter') card.querySelector('[data-v="ok"]').click(); }); });
    if (res !== 'ok') return;
    const n = (app.lastModalInput || '').trim();
    if (!n) return;
    ai.name = n.slice(0, 20);
    await AIP.squad.save(ai);
    renderAll(); renderSquad();
  }
  async function deleteAi(id) {
    const ai = app.ais.find((a) => a.id === id);
    if (!ai) return;
    if (!(await confirmBox('Delete ' + ai.name + ' forever? Its brains, diary and scores all go away.'))) return;
    await AIP.squad.remove(ai);
    app.ais = app.ais.filter((a) => a.id !== id);
    delete app.hearts[id];
    if (app.ai && app.ai.id === id) app.ai = app.ais[0] || null;
    if (app.ai) setCurrent(app.ai); else { renderAll(); renderSquad(); await birthFlow(true); }
    renderSquad();
  }

  /* ================= leaderboard ================= */
  function renderBoard() {
    const sel = $('#boardGame');
    const cur = sel.value;
    sel.innerHTML = app.games.map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join('');
    if (cur && app.games.some((g) => g.id === cur)) sel.value = cur;
    const gid = sel.value;
    if (!gid) { $('#board').innerHTML = '<div class="empty">Add a game first!</div>'; return; }
    const rows = AIP.squad.leaderboard(app.ais, gid);
    if (!rows.length) { $('#board').innerHTML = '<div class="empty">Nobody has played this one yet.</div>'; return; }
    const medal = ['🥇', '🥈', '🥉'];
    $('#board').innerHTML = '<table class="board-table"><tr><th>#</th><th>AI</th><th style="text-align:right">Best</th><th style="text-align:right">Tries</th><th style="text-align:right">Wins</th><th style="text-align:right">Time played</th></tr>' +
      rows.map((r, i) => `<tr><td>${medal[i] || i + 1}</td><td><div class="bwho"><div class="mini">${AIP.avatar.svg(r.ai.look, calmFace(r.ai))}</div>${esc(r.ai.name)}</div></td>
        <td class="num">${U.fmt(r.s.best)}${esc(kindWord(r.s.scoreKind))}</td><td class="num">${r.s.tries}</td><td class="num">${r.s.wins || 0}</td><td class="num">${Math.round((r.s.timeMs || 0) / 60000)} min</td></tr>`).join('') + '</table>';
  }

  /* ================= diary ================= */
  async function renderDiary() {
    const sel = $('#diaryAi');
    const cur = sel.value || (app.ai && app.ai.id);
    sel.innerHTML = app.ais.map((a) => `<option value="${a.id}">${esc(a.name)}'s diary</option>`).join('');
    if (cur) sel.value = cur;
    const id = sel.value;
    if (!id) { $('#diaryList').innerHTML = ''; return; }
    let list = [];
    try { list = await AIP.squad.diary(id); } catch (e) { /* ignore */ }
    $('#diaryList').innerHTML = list.length ? list.map((e) => `<div class="entry"><div class="e-mood">${H.EMOJI[e.mood] || '📝'}</div><div><div>${esc(e.text)}</div><div class="e-meta">${new Date(e.t).toLocaleString()}${e.gameName ? ' · ' + esc(e.gameName) : ''}</div></div></div>`).join('') : '<div class="empty">Nothing written yet.</div>';
  }

  /* ================= settings ================= */
  function renderSettings() {
    const st = AIP.settings.get();
    $('#setPain').checked = !!st.painMode;
    $('#setVoice').checked = !!st.voice;
    $('#setVolume').value = st.volume;
    $$('#setLayout button').forEach((b) => b.classList.toggle('on', b.dataset.v === st.layout));
  }

  /* ================= idle dreaming ================= */
  // When you're not playing, the current AI sometimes naps and replays memories of its last game.
  async function idleDream() {
    if (app.session || !app.ai || document.hidden || app.idleDreams >= 6 || app.dreamingIdle) return;
    const ai = app.ai;
    const gids = Object.keys((ai.stats && ai.stats.games) || {});
    if (!gids.length || Date.now() - app.lastIdleDream < 60000) return;
    const gid = gids.sort((a, b) => (ai.stats.games[b].timeMs || 0) - (ai.stats.games[a].timeMs || 0))[0];
    const game = app.games.find((g) => g.id === gid);
    if (!game) return;
    app.dreamingIdle = true; app.lastIdleDream = Date.now(); app.idleDreams++;
    try {
      const rec = await AIP.db.get('brains', ai.id + '|' + gid);
      if (!rec || app.session) return;
      const b = new AIP.Brain(ai.id, game);
      if (!b.load(rec)) return;
      if (app.view === 'library') $('#heroBot').innerHTML = AIP.avatar.svg(ai.look, { zzz: true, eyeOpen: 0.05, mouth: 0.2, anim: 'float' });
      const res = await b.dream(2500);
      if (app.session) return;
      const out = b.serialize();
      out.gameSave = rec.gameSave;
      await AIP.db.put('brains', out);
      const mem = res.memory ? res.memory.text : 'pixels. lots of pixels';
      toast('💤 ' + ai.name + ' took a nap and dreamed about ' + mem + ' (and got a little smarter)');
    } catch (e) { /* ignore */ } finally {
      app.dreamingIdle = false;
      renderTopAi();
    }
  }

  /* ================= small UI helpers ================= */
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(app.toastT);
    app.toastT = setTimeout(() => { t.hidden = true; }, 4200);
  }
  app.toast = toast;
  function modal(html, onOpen) {
    return new Promise((resolve) => {
      const m = $('#modal'), card = $('#modalCard');
      card.innerHTML = html;
      m.hidden = false;
      const done = (v) => {
        const i = $('#nameInput', card);
        app.lastModalInput = i ? i.value : '';
        m.hidden = true; card.innerHTML = '';
        resolve(v);
      };
      card.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => done(b.dataset.v)));
      m.onclick = (e) => { if (e.target === m && card.querySelector('[data-v=""]')) done(''); };
      if (onOpen) onOpen(card);
      else { const f = card.querySelector('[data-v]'); if (f) f.focus(); }
    });
  }
  app.modal = modal;
  function confirmBox(text) {
    return modal(`<h2>Are you sure?</h2><p>${esc(text)}</p><div class="row"><button class="btn danger" data-v="yes">Yes</button><button class="btn" data-v="">No</button></div>`).then((v) => v === 'yes');
  }

  /* ================= wiring ================= */
  function bindChrome() {
    document.addEventListener('click', (e) => {
      const v = e.target.closest('[data-view]');
      if (v) { show(v.dataset.view); return; }
      const menu = e.target.closest('[data-menu]');
      if (menu) { e.stopPropagation(); gameMenu(menu.dataset.menu); return; }
      const card = e.target.closest('.game-card');
      if (card) { play(card.dataset.id); return; }
      const use = e.target.closest('[data-use]');
      if (use) { const ai = app.ais.find((a) => a.id === use.dataset.use); if (ai) { setCurrent(ai); toast('🎮 ' + ai.name + ' is up!'); } return; }
      const ren = e.target.closest('[data-rename]');
      if (ren) { renameAi(ren.dataset.rename); return; }
      const del = e.target.closest('[data-del]');
      if (del) { deleteAi(del.dataset.del); return; }
      const tab = e.target.closest('.tabs button');
      if (tab) {
        app.tab = tab.dataset.tab;
        $$('.tabs button').forEach((b) => b.classList.toggle('on', b === tab));
        $$('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === app.tab));
        if (app.tab === 'graph') drawGraph();
        if (app.session) app.renderPlay(app.session, app.session.lastObs, true);
        return;
      }
      const star = e.target.closest('[data-star]');
      if (star && app.session) {
        const code = star.dataset.star, c = app.session.brain.keyCtl(code);
        if (c.status === 'starred') c.status = 'new';
        else { app.session.brain.applyTip({ type: 'useKey', code, text: AIP.KEYS.label(code) + ' matters' }); app.chat('you', '⭐ ' + AIP.KEYS.label(code) + ' matters'); }
        renderKeys(app.session);
        return;
      }
      const ban = e.target.closest('[data-ban]');
      if (ban && app.session) {
        const code = ban.dataset.ban, c = app.session.brain.keyCtl(code);
        if (c.status === 'banned') app.session.brain.applyTip({ type: 'unban', code, text: 'unban ' + code });
        else { app.session.brain.applyTip({ type: 'ban', code, text: "don't use " + AIP.KEYS.label(code) }); app.chat('you', "🚫 don't use " + AIP.KEYS.label(code)); }
        renderKeys(app.session);
      }
    });
    document.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('game-card')) { e.preventDefault(); play(e.target.dataset.id); }
    });
    const onPick = async (input) => {
      if (!input.files || !input.files.length) return;
      try { await addGame(await AIP.loader.fromFileList(input.files)); } catch (err) { toast('😢 ' + err.message); }
      input.value = '';
    };
    $('#pickFile').addEventListener('change', (e) => onPick(e.target));
    $('#pickFolder').addEventListener('change', (e) => onPick(e.target));
    // drag + drop anywhere
    let dragDepth = 0;
    window.addEventListener('dragenter', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { dragDepth++; $('#dropVeil').classList.add('on'); } });
    window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('#dropVeil').classList.remove('on'); });
    window.addEventListener('dragover', (e) => { e.preventDefault(); });
    window.addEventListener('drop', async (e) => {
      e.preventDefault(); dragDepth = 0; $('#dropVeil').classList.remove('on');
      if (!e.dataTransfer) return;
      try { await addGame(await AIP.loader.fromDataTransfer(e.dataTransfer)); if (app.view !== 'library') show('library'); } catch (err) { toast('😢 ' + err.message); }
    });
    $('#btnNewAi').addEventListener('click', () => birthFlow(false));
    $('#btnBack').addEventListener('click', () => show('library'));
    $('#btnMode').addEventListener('click', () => { const s = app.session; if (!s) return; const m = s.mode === 'pause' ? 'ai' : 'pause'; s.setMode(m); updateModeButtons(m); });
    $('#btnWatch').addEventListener('click', () => {
      const s = app.session; if (!s) return;
      const m = s.mode === 'watch' ? 'ai' : 'watch';
      s.setMode(m); updateModeButtons(m);
      if (m === 'watch') try { s.frame.focus(); } catch (e) { /* ignore */ }
    });
    $('#btnReload').addEventListener('click', () => { if (app.session) { app.chat('sys', '🔁 restarting the game file'); app.session.reloadGame(false); } });
    $('#btnLayout').addEventListener('click', () => { AIP.settings.set('layout', AIP.settings.get().layout === 'overlay' ? 'side' : 'overlay'); applyLayout(); setTimeout(drawGraph, 50); });
    $('#chatForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const i = $('#chatInput');
      const t = i.value.trim();
      if (!t) return;
      app.chat('you', t);
      i.value = '';
      if (app.session) app.session.tip(t);
    });
    const thumb = (v, el) => { if (!app.session) return; app.session.feedback(v); app.chat('you', v > 0 ? '👍' : '👎'); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); };
    $('#thumbUp').addEventListener('click', (e) => thumb(1, e.currentTarget));
    $('#thumbDown').addEventListener('click', (e) => thumb(-1, e.currentTarget));
    $('#addKeyForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const code = AIP.KEYS.fromName($('#addKeyInput').value);
      if (!code) { toast("🤔 Don't know that key. Try a letter, a number, space, enter, shift, or an arrow."); return; }
      if (app.session) { app.session.brain.applyTip({ type: 'useKey', code, text: AIP.KEYS.label(code) + ' matters' }); app.chat('you', '⭐ ' + AIP.KEYS.label(code) + ' matters'); renderKeys(app.session); }
      $('#addKeyInput').value = '';
    });
    $('#graph').addEventListener('mousemove', graphHover);
    $('#graph').addEventListener('mouseleave', () => { app.graphHover = null; $('#gtip').hidden = true; drawGraph(); });
    $('#graphTable').addEventListener('click', () => { const b = $('#graphTableBox'); b.hidden = !b.hidden; drawGraph(); });
    $('#boardGame').addEventListener('change', renderBoard);
    $('#diaryAi').addEventListener('change', renderDiary);
    $('#setPain').addEventListener('change', (e) => { AIP.settings.set('painMode', e.target.checked); toast(e.target.checked ? '🤕 Pain mode ON: getting hit will hurt now.' : 'Pain mode OFF'); });
    $('#setVoice').addEventListener('change', (e) => { AIP.settings.set('voice', e.target.checked); if (!e.target.checked) try { speechSynthesis.cancel(); } catch (err) { /* ignore */ } });
    $('#setVolume').addEventListener('input', (e) => AIP.settings.set('volume', parseFloat(e.target.value)));
    $$('#setLayout button').forEach((b) => b.addEventListener('click', () => { AIP.settings.set('layout', b.dataset.v); renderSettings(); }));
    window.addEventListener('resize', () => { if (app.tab === 'graph') drawGraph(); });
    window.addEventListener('beforeunload', () => { if (app.session) app.session.persist(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => app.init());
  else app.init();
})();
