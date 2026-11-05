// ALTS chat-box extras (1.5.0). Runs after page.js, only on claude.ai:
// emoji + sticker button, Send later (pings you when the limit is back), quick buttons,
// Fix that, Fresh chat (handoff), long-chat warning, autocorrect.
// Plain DOM only, like page.js.
(() => {
  const A = window.__alts;
  if (location.hostname !== 'claude.ai' || !A || A.extras) return;
  A.extras = true;
  const { mk, send, FONT, box, toast, composer, putText, attach, ours } = A;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const R = () => document.documentElement;
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const BTN = { font: '600 12px ' + FONT, padding: '4px 10px', borderRadius: '999px', border: '1px solid #3a3a44', background: '#1f1f25e6',
    color: '#d6d6de', cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: '18px' };
  const ROUND = { width: '30px', height: '30px', borderRadius: '50%', border: '1px solid #3a3a44', background: '#1f1f25', color: '#d6d6de',
    cursor: 'pointer', font: '16px/1 "Segoe UI Emoji","Segoe UI",sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0' };
  const tag = e => { e.dataset.alts = '1'; return e; };
  const hover = (b, on, off) => { b.addEventListener('mouseenter', () => Object.assign(b.style, on)); b.addEventListener('mouseleave', () => Object.assign(b.style, off)); return b; };

  // the chat box's outer frame (the rounded box around the text)
  function frame(c) {
    let f = c, r = c.getBoundingClientRect();
    for (let i = 0, e = c.parentElement; i < 8 && e && e !== document.body; i++, e = e.parentElement) {
      const q = e.getBoundingClientRect();
      if (q.width > r.width + 160 || q.height > r.height + 260) break;
      f = e;
    }
    return f;
  }

  // keep where the caret was, so clicking our buttons doesn't lose it
  let saved = null;
  document.addEventListener('selectionchange', () => {
    const c = composer(), s = getSelection();
    if (c && s.rangeCount && c.contains(s.anchorNode)) saved = s.getRangeAt(0).cloneRange();
  });
  function insert(text) {
    const c = composer();
    if (!c) return;
    c.focus();
    if (saved && c.contains(saved.startContainer)) { const s = getSelection(); s.removeAllRanges(); s.addRange(saved); }
    if (c.tagName === 'TEXTAREA') {
      const a = c.selectionStart, b = c.selectionEnd;
      c.setRangeText(text, a, b, 'end');
      c.dispatchEvent(new Event('input', { bubbles: true }));
    } else document.execCommand('insertText', false, text);
  }
  const boxText = c => (c.tagName === 'TEXTAREA' ? c.value : c.innerText || '').replace(/ /g, ' ').trim();

  function sendNow(c) {
    const f = frame(c).parentElement || document.body;
    const b = [...f.querySelectorAll('button')].find(x => !ours(x) && !x.disabled && /send/i.test(x.getAttribute('aria-label') || ''));
    if (b) { b.click(); return true; }
    c.focus();
    c.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    return true;
  }
  async function say(text) {
    let c = null;
    for (let i = 0; i < 60 && !c; i++) { c = composer(); if (!c) await sleep(250); }
    if (!c) { toast('Couldn\'t find the chat box.'); return false; }
    putText(c, text);
    await sleep(250);
    return sendNow(c);
  }

  // ---------- the bar: round buttons left of the box + quick buttons above it ----------
  const side = tag(mk('div', { position: 'fixed', zIndex: '2147483646', display: 'none', flexDirection: 'column', gap: '6px' }));
  const top = tag(mk('div', { position: 'fixed', zIndex: '2147483646', display: 'none', gap: '6px', flexWrap: 'nowrap', overflowX: 'auto', scrollbarWidth: 'none' }));
  const warn = tag(mk('div', { position: 'fixed', zIndex: '2147483646', display: 'none', gap: '8px', alignItems: 'center', background: '#3a2a12', color: '#ffd9a0',
    border: '1px solid #6b4a1a', borderRadius: '999px', padding: '4px 6px 4px 12px', font: '600 12px ' + FONT }));
  function round(txt, title, fn) {
    const b = tag(hover(mk('button', ROUND, txt), { background: '#2a2a33', color: '#fff' }, { background: '#1f1f25', color: '#d6d6de' }));
    b.title = title;
    b.addEventListener('mousedown', e => e.preventDefault()); // keep the caret in the chat box
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); fn(b); });
    return b;
  }
  function chip(txt, title, fn, menu) {
    const b = tag(hover(mk('button', BTN, txt), { borderColor: '#5a5a66', color: '#fff' }, { borderColor: '#3a3a44', color: '#d6d6de' }));
    b.title = title;
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); fn(b); });
    if (menu) b.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); menu(b); });
    return b;
  }
  const laterBtn = round('⏰', 'Send later: saves what you typed. When your limit is back, ALTS pings you and you press Send.', () => later());
  side.append(
    round('\u{1F600}', 'Emoji + stickers', b => pickerToggle()),
    laterBtn,
    round('↻', 'Fresh chat: Claude writes a handoff, then a new chat picks it up (saves usage)', () => fresh()));
  const badge = tag(mk('div', { position: 'absolute', top: '-4px', right: '-4px', minWidth: '16px', height: '16px', borderRadius: '8px', background: '#d97757', color: '#fff',
    font: '700 10px/16px ' + FONT, textAlign: 'center', padding: '0 4px', display: 'none', boxSizing: 'border-box' }));
  laterBtn.style.position = 'relative';
  laterBtn.append(badge);

  const DEFAULT_QUICK = ['Fix that: redo your last reply better, no mistakes', 'Keep going', 'Explain that simpler', 'Picture first: show me a picture of it before you build it'];
  function drawQuick() {
    top.textContent = '';
    for (const q of store.get('alts-quick', DEFAULT_QUICK)) {
      const label = q.split(':')[0].slice(0, 28);
      top.append(chip(label, q + '\n(click = send it, right-click = remove)', () => say(q), () => {
        if (confirm('Remove the quick button "' + label + '"?')) { store.set('alts-quick', store.get('alts-quick', DEFAULT_QUICK).filter(x => x !== q)); drawQuick(); }
      }));
    }
    top.append(chip('+', 'Add a quick button for something you say a lot', () => {
      const c = composer(), now = c ? boxText(c) : '';
      const t = prompt('What should this button send?', now);
      if (t && t.trim()) { store.set('alts-quick', [...store.get('alts-quick', DEFAULT_QUICK), t.trim().slice(0, 2000)]); drawQuick(); }
    }));
  }
  drawQuick();

  let lastPos = '';
  function place() {
    if (!R() || !document.body) return;
    if (!side.isConnected) { R().append(side, top, warn); lastPos = ''; } // first time, or the page wiped it
    const c = composer();
    const show = c && document.visibilityState === 'visible' && !document.querySelector('[role="dialog"]');
    if (!show) { side.style.display = top.style.display = warn.style.display = 'none'; return; }
    const r = frame(c).getBoundingClientRect();
    const pos = [r.left, r.top, r.width].map(Math.round).join();
    side.style.display = 'flex';
    top.style.display = store.get('alts-quick-off', false) ? 'none' : 'flex';
    if (pos === lastPos) return;
    lastPos = pos;
    const leftRoom = r.left > 48;
    Object.assign(side.style, leftRoom ? { left: (r.left - 40) + 'px', top: Math.max(8, r.bottom - 102) + 'px', flexDirection: 'column' }
      : { left: (r.left + 4) + 'px', top: Math.max(8, r.top - 72) + 'px', flexDirection: 'row' });
    Object.assign(top.style, { left: (r.left + (leftRoom ? 0 : 110)) + 'px', top: Math.max(8, r.top - 34) + 'px', maxWidth: (r.width - (leftRoom ? 0 : 110)) + 'px' });
    Object.assign(warn.style, { left: (r.left) + 'px', top: Math.max(8, r.top - 66) + 'px' });
    if (picker && picker.isConnected) placePicker();
  }
  setInterval(place, 400);
  addEventListener('resize', () => { lastPos = ''; place(); });

  // ---------- emoji + stickers ----------
  let picker = null, emoji = null, stickers = null, ptab = 'emoji';
  A.emojiData = d => {
    emoji = (d.emoji || '').split('\n').filter(Boolean).map(l => { const [e, n, g] = l.split('\t'); return { e, n, g }; });
    stickers = d.stickers || [];
    if (picker && picker.isConnected) drawPicker();
  };
  A.stickerFile = async d => {
    const c = composer();
    if (!c || !d || !d.b64) { toast('Couldn\'t load that sticker.'); return; }
    const bin = atob(d.b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const ok = await attach(c, [new File([u], d.name || 'sticker.png', { type: 'image/png' })]);
    if (!ok) toast('The sticker didn\'t attach. Try Win+V > Stickers instead.');
  };
  function placePicker() {
    const c = composer();
    if (!c) return;
    const r = frame(c).getBoundingClientRect();
    Object.assign(picker.style, { left: Math.max(8, Math.min(innerWidth - 360, r.left)) + 'px', top: Math.max(8, r.top - 446) + 'px' });
  }
  function pickerToggle() {
    if (picker && picker.isConnected) { picker.remove(); return; }
    picker = tag(mk('div', { position: 'fixed', zIndex: '2147483647', width: '350px', height: '400px', background: '#1b1b20', border: '1px solid #2c2c35', borderRadius: '14px',
      boxShadow: '0 14px 44px rgba(0,0,0,.55)', display: 'flex', flexDirection: 'column', font: '13px ' + FONT, color: '#ececf1', overflow: 'hidden' }));
    const tabs = mk('div', { display: 'flex', gap: '4px', padding: '8px' });
    for (const [k, t] of [['emoji', 'Emoji'], ['stick', 'Stickers']]) {
      const b = mk('button', { flex: '1', border: '0', borderRadius: '8px', padding: '6px', font: '600 12.5px ' + FONT, cursor: 'pointer', background: ptab === k ? '#2a2a33' : 'transparent', color: ptab === k ? '#fff' : '#9a9aa6' }, t);
      b.dataset.k = k;
      b.addEventListener('click', () => { ptab = k; [...tabs.children].forEach(x => { x.style.background = x.dataset.k === ptab ? '#2a2a33' : 'transparent'; x.style.color = x.dataset.k === ptab ? '#fff' : '#9a9aa6'; }); drawPicker(); });
      tabs.append(b);
    }
    const q = mk('input', { margin: '0 8px 6px', padding: '7px 10px', borderRadius: '8px', border: '1px solid #2c2c35', background: '#222229', color: '#ececf1', font: '13px ' + FONT, outline: 'none' });
    q.placeholder = 'Search (like "skull")';
    q.addEventListener('input', () => drawPicker());
    q.addEventListener('keydown', e => { if (e.key === 'Escape') picker.remove(); e.stopPropagation(); });
    const grid = mk('div', { flex: '1', overflowY: 'auto', padding: '0 8px 8px' });
    picker.append(tabs, q, grid);
    picker._q = q; picker._grid = grid;
    R().append(picker);
    placePicker();
    if (!emoji) send({ t: 'emoji-data' });
    drawPicker();
    q.focus();
  }
  function drawPicker() {
    const grid = picker._grid, q = picker._q.value.trim().toLowerCase();
    grid.textContent = '';
    if (!emoji) { grid.append(mk('div', { color: '#9a9aa6', padding: '30px', textAlign: 'center' }, 'Loading...')); return; }
    if (ptab === 'emoji') {
      const recent = store.get('alts-emoji-recent', []);
      const list = q ? emoji.filter(x => x.n.includes(q)).slice(0, 300) : [...recent.map(e => ({ e, n: 'recent', g: 'Recent' })), ...emoji];
      let g = null, row = null;
      for (const x of list) {
        if (!q && x.g !== g) { g = x.g; grid.append(mk('div', { color: '#9a9aa6', font: '600 11.5px ' + FONT, margin: '8px 2px 4px' }, g)); row = null; }
        if (!row) { row = mk('div', { display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: '2px' }); grid.append(row); }
        const c = hover(mk('div', { font: '23px/1 "Segoe UI Emoji",sans-serif', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '7px', cursor: 'pointer' }, x.e),
          { background: '#2a2a33' }, { background: 'transparent' });
        c.title = x.n;
        c.addEventListener('mousedown', e => e.preventDefault());
        c.addEventListener('click', () => { insert(x.e); store.set('alts-emoji-recent', [x.e, ...store.get('alts-emoji-recent', []).filter(y => y !== x.e)].slice(0, 16)); });
        row.append(c);
      }
      if (!list.length) grid.append(mk('div', { color: '#9a9aa6', padding: '30px', textAlign: 'center' }, 'Nothing matches.'));
    } else {
      const row = mk('div', { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px', marginTop: '4px' });
      for (const s of stickers.filter(s => !q || s.name.includes(q))) {
        const c = hover(mk('div', { aspectRatio: '1', borderRadius: '9px', background: '#24242b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }),
          { background: '#2f2f38' }, { background: '#24242b' });
        const im = mk('img', { width: '80%', height: '80%', objectFit: 'contain', pointerEvents: 'none' });
        im.src = s.thumb;
        c.append(im);
        c.title = s.name + ' (sends it as a picture)';
        c.addEventListener('mousedown', e => e.preventDefault());
        c.addEventListener('click', () => send({ t: 'sticker-get', file: s.file, mine: !!s.mine }));
        row.append(c);
      }
      grid.append(row);
      grid.append(mk('div', { color: '#9a9aa6', font: '11.5px ' + FONT, margin: '10px 2px' }, 'Your own stickers: copy any picture, press Win+V, then ☺ on it.'));
    }
  }
  document.addEventListener('mousedown', e => { if (picker && picker.isConnected && !picker.contains(e.target) && !ours(e.target)) picker.remove(); }, true);

  // ---------- Send later ----------
  const LK = 'alts-later';
  const limited = u => !!u && (u.s >= 100 || u.w >= 100);
  const backAt = u => {
    const t = u && (u.w >= 100 ? u.wr : u.sr);
    const d = t ? new Date(t) : null;
    return d && !isNaN(d) ? d.toLocaleString([], { weekday: d - Date.now() > 86400000 ? 'short' : undefined, hour: 'numeric', minute: '2-digit' }) : '';
  };
  function drawBadge() { const n = store.get(LK, []).length; badge.style.display = n ? 'block' : 'none'; badge.textContent = n; }
  drawBadge();
  function later() {
    const c = composer();
    const text = c ? boxText(c) : '';
    if (!text) { showLater(); return; }
    const list = store.get(LK, []);
    list.push({ id: Date.now().toString(36), text, url: location.href, at: Date.now() });
    store.set(LK, list);
    putText(c, '');
    drawBadge();
    const u = A.lastUsage, b = backAt(u);
    toast('Saved for later (' + list.length + ' waiting). ' + (limited(u) ? 'Your limit is back' + (b ? ' at ' + b : ' soon') + ': ALTS will ping you.' : 'Press ⏰ to send it.'));
  }
  function showLater(title) {
    const list = store.get(LK, []);
    const b = box(title || 'Send later');
    if (!list.length) { b.say('Nothing saved. Type a message, then press ⏰ to keep it for when your limit is back.'); b.button('Close', false, () => b.close()); return; }
    const u = A.lastUsage;
    b.say(limited(u) ? 'Limit still on' + (backAt(u) ? ' until ' + backAt(u) : '') + '. These wait here:' : list.length + ' saved. Press Send:');
    b.list.style.display = 'block';
    for (const m of list) {
      const row = mk('div', { display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '8px 0', borderTop: '1px solid #2a2a32' });
      const t = mk('div', { flex: '1', color: '#ececf1', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '60px', overflow: 'hidden' }, m.text);
      const go = mk('button', BTN, 'Send');
      go.addEventListener('click', () => { b.close(); sendSaved(m.id); });
      const del = mk('button', Object.assign({}, BTN, { color: '#ff8b8b' }), '✕');
      del.title = 'Delete';
      del.addEventListener('click', () => { store.set(LK, store.get(LK, []).filter(x => x.id !== m.id)); row.remove(); drawBadge(); });
      row.append(t, go, del);
      b.list.append(row);
    }
    b.button('Close', false, () => b.close());
  }
  async function sendSaved(id) {
    const m = store.get(LK, []).find(x => x.id === id);
    if (!m) return;
    if (m.url.split('?')[0] !== location.href.split('?')[0]) {
      sessionStorage.setItem('alts-send-next', id);
      location.href = m.url;
      return;
    }
    if (await say(m.text)) { store.set(LK, store.get(LK, []).filter(x => x.id !== id)); drawBadge(); }
  }
  setTimeout(() => { const id = sessionStorage.getItem('alts-send-next'); if (id) { sessionStorage.removeItem('alts-send-next'); setTimeout(() => sendSaved(id), 1500); } }, 500);
  let wasLimited = store.get('alts-was-limited', false);
  addEventListener('alts-usage', e => {
    const u = e.detail, now = limited(u);
    if (now) {
      warn.textContent = '';
      warn.append(mk('span', null, 'Limit hit' + (backAt(u) ? ': back at ' + backAt(u) : '') + '. Type + press ⏰ and ALTS pings you.'));
      warn.style.display = 'flex';
    } else if (wasLimited || warn.textContent.startsWith('Limit')) { warn.style.display = 'none'; warn.textContent = ''; }
    if (wasLimited && !now && store.get(LK, []).length) {
      send({ t: 'ping', text: 'Your limit is back! ' + store.get(LK, []).length + ' saved message(s) ready.' });
      try { // a little two-note chime
        const ac = new AudioContext();
        [660, 880].forEach((f, i) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0.18, ac.currentTime + i * 0.18); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.18 + 0.35); o.connect(g).connect(ac.destination); o.start(ac.currentTime + i * 0.18); o.stop(ac.currentTime + i * 0.18 + 0.4); });
      } catch (er) {}
      showLater('Your limit is back!');
    }
    wasLimited = now;
    store.set('alts-was-limited', now);
  });

  // ---------- Fresh chat (handoff) + long-chat warning ----------
  const HANDOFF = 'save everything: write a full handoff of this chat (what we did, what is left, files, branches, how to test) so a new chat can continue it, then say "saved"';
  const busy = () => [...document.querySelectorAll('button[aria-label]')].some(b => /^stop/i.test(b.getAttribute('aria-label')) && b.getClientRects().length);
  async function fresh() {
    const b = box('Fresh chat');
    b.say('Claude writes a handoff here first, then a new chat opens that already knows what you were doing. Long chats eat usage fast; this saves a lot.');
    b.button('Do it', true, async () => {
      b.clear().say('Asking Claude for the handoff...').progress(0.1);
      b.button('Stop', false, () => { stop = true; b.close(); });
      let stop = false;
      await say(HANDOFF);
      const t0 = Date.now();
      await sleep(4000);
      while (!stop && Date.now() - t0 < 15 * 60000) {
        if (!busy()) { await sleep(2500); if (!busy()) break; }
        b.say('Claude is writing the handoff... (' + Math.round((Date.now() - t0) / 1000) + ' s)').progress(Math.min(0.85, 0.1 + (Date.now() - t0) / 240000));
        await sleep(2000);
      }
      if (stop) return;
      b.say('Opening the new chat...').progress(0.95);
      sessionStorage.setItem('alts-fresh', '1');
      location.href = location.pathname.startsWith('/code') ? '/code' : '/new';
    });
    b.button('Cancel', false, () => b.close());
  }
  if (sessionStorage.getItem('alts-fresh')) {
    sessionStorage.removeItem('alts-fresh');
    (async () => {
      let c = null;
      for (let i = 0; i < 80 && !c; i++) { c = composer(); if (!c) await sleep(250); }
      if (c) { putText(c, 'Pick up where the last chat stopped: read the handoff you just saved, then tell me where we are.'); toast('New chat ready. Press Enter.'); }
    })();
  }
  setInterval(() => {
    const n = A.lastCount, key = 'alts-longwarn:' + location.pathname;
    if (!n || n.words < 45000 || sessionStorage.getItem(key) || limited(A.lastUsage)) return;
    sessionStorage.setItem(key, '1');
    warn.textContent = '';
    const go = mk('button', Object.assign({}, BTN, { background: '#d97757', color: '#fff', border: '0' }), '↻ Fresh chat');
    go.addEventListener('click', () => { warn.style.display = 'none'; fresh(); });
    const x = mk('button', Object.assign({}, BTN, { border: '0', background: 'transparent', color: '#ffd9a0' }), '✕');
    x.addEventListener('click', () => { warn.style.display = 'none'; });
    warn.append(mk('span', null, 'Long chat (' + Math.round(n.words / 1000) + 'k words): every message costs more usage.'), go, x);
    warn.style.display = 'flex';
  }, 15000);

  // ---------- autocorrect while typing (common slips, Ctrl+Z undoes it) ----------
  const FIX = { teh: 'the', adn: 'and', taht: 'that', thsi: 'this', wiht: 'with', becuase: 'because', becasue: 'because', beacuse: 'because', dont: 'don\'t', cant: 'can\'t',
    wont: 'won\'t', doesnt: 'doesn\'t', didnt: 'didn\'t', isnt: 'isn\'t', wasnt: 'wasn\'t', arent: 'aren\'t', couldnt: 'couldn\'t', shouldnt: 'shouldn\'t', wouldnt: 'wouldn\'t',
    im: 'I\'m', ive: 'I\'ve', youre: 'you\'re', theyre: 'they\'re', thats: 'that\'s', whats: 'what\'s', theres: 'there\'s', hes: 'he\'s', 
    i: 'I', recieve: 'receive', recieved: 'received', seperate: 'separate', definately: 'definitely', definatly: 'definitely', defintely: 'definitely', wierd: 'weird',
    untill: 'until', tommorow: 'tomorrow', tomorow: 'tomorrow', alot: 'a lot', realy: 'really', reall: 'really', beleive: 'believe', freind: 'friend', freinds: 'friends',
    goverment: 'government', enviroment: 'environment', occured: 'occurred', begining: 'beginning', accross: 'across', adress: 'address', basicly: 'basically',
    beutiful: 'beautiful', calender: 'calendar', comming: 'coming', diffrent: 'different', embarass: 'embarrass', existance: 'existence', finaly: 'finally',
    foward: 'forward', happend: 'happened', immediatly: 'immediately', knowlege: 'knowledge', neccessary: 'necessary', necesary: 'necessary', noticable: 'noticeable',
    probly: 'probably', probaly: 'probably', publically: 'publicly', remeber: 'remember', rember: 'remember', sucess: 'success', suprise: 'surprise', thier: 'their',
    togehter: 'together', truely: 'truly', wich: 'which', writting: 'writing', yesterady: 'yesterday', somthing: 'something', someting: 'something',
    becuz: 'because', realistc: 'realistic', relaistic: 'realistic', grapics: 'graphics', grahpics: 'graphics', updat: 'update',
    upgarde: 'upgrade', settigns: 'settings', setings: 'settings', downlaod: 'download', dowload: 'download', intresting: 'interesting', compter: 'computer' };
  const AUTO_OFF = 'alts-autocorrect-off';
  document.addEventListener('keydown', e => {
    if (store.get(AUTO_OFF, false) || e.ctrlKey || e.altKey || e.metaKey || !(e.key === ' ' || e.key === 'Enter' || /^[.,!?;:]$/.test(e.key))) return;
    const c = composer();
    if (!c || !c.contains(document.activeElement) && c !== document.activeElement || c.tagName === 'TEXTAREA') return;
    const s = getSelection();
    if (!s.isCollapsed || !s.anchorNode || s.anchorNode.nodeType !== 3) return;
    const node = s.anchorNode, end = s.anchorOffset, before = node.data.slice(0, end);
    const m = before.match(/(^|[^\w'])([A-Za-z]+)$/);
    if (!m) return;
    const w = m[2], lw = w.toLowerCase(), fix = FIX[lw];
    if (!fix || fix === lw) return;
    let out = fix;
    if (w[0] === w[0].toUpperCase() && fix[0] !== 'I') out = fix[0].toUpperCase() + fix.slice(1);
    const r = document.createRange();
    r.setStart(node, end - w.length);
    r.setEnd(node, end);
    s.removeAllRanges();
    s.addRange(r);
    document.execCommand('insertText', false, out); // one undo step: Ctrl+Z gives the old word back
  }, true);
  // red squiggles + right-click fixes from the built-in spell checker
  setInterval(() => { const c = composer(); if (c && c.getAttribute('spellcheck') !== 'true') c.setAttribute('spellcheck', 'true'); }, 3000);

  A.laterList = () => showLater();
})();
