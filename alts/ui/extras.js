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

  // ---------- the bar: round buttons left of the chat box (nothing sits over claude.ai's own stuff) ----------
  const side = tag(mk('div', { position: 'fixed', zIndex: '2147483646', display: 'none', flexDirection: 'column', gap: '6px' }));
  function round(txt, title, fn) {
    const b = tag(hover(mk('button', ROUND, txt), { background: '#2a2a33', color: '#fff' }, { background: '#1f1f25', color: '#d6d6de' }));
    b.title = title;
    b.addEventListener('mousedown', e => e.preventDefault()); // keep the caret in the chat box
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); fn(b); });
    return b;
  }
  const laterBtn = round('\u23F0', 'Send later: saves what you typed. When your limit is back, ALTS pings you and you press Send.', () => later());
  const quickBtn = round('\u26A1', 'Quick buttons: things you say a lot, one click sends them', b => quickToggle(b));
  side.append(
    round('\u{1F600}', 'Emoji + stickers', b => pickerToggle()),
    quickBtn,
    laterBtn,
    round('\u21BB', 'Fresh chat: Claude writes a handoff, then a new chat picks it up (saves usage)', () => fresh()));
  const badge = tag(mk('div', { position: 'absolute', top: '-4px', right: '-4px', minWidth: '16px', height: '16px', borderRadius: '8px', background: '#d97757', color: '#fff',
    font: '700 10px/16px ' + FONT, textAlign: 'center', padding: '0 4px', display: 'none', boxSizing: 'border-box' }));
  laterBtn.style.position = 'relative';
  laterBtn.append(badge);

  // ---------- quick buttons (the lightning button) ----------
  const DEFAULT_QUICK = ['Fix that: redo your last reply better, no mistakes', 'Keep going', 'Explain that simpler', 'Picture first: show me a picture of it before you build it'];
  let qmenu = null;
  function quickToggle(btn) {
    if (qmenu && qmenu.isConnected) { qmenu.remove(); return; }
    qmenu = tag(mk('div', { position: 'fixed', zIndex: '2147483647', width: '270px', maxHeight: '380px', overflowY: 'auto', background: '#1b1b20', border: '1px solid #2c2c35',
      borderRadius: '12px', padding: '6px', boxShadow: '0 14px 44px rgba(0,0,0,.55)', font: '13px ' + FONT, color: '#ececf1', boxSizing: 'border-box' }));
    drawQuick();
    R().append(qmenu);
    const r = btn.getBoundingClientRect(), h = qmenu.getBoundingClientRect().height;
    Object.assign(qmenu.style, { left: Math.min(innerWidth - 280, r.right + 8) + 'px', top: Math.max(8, Math.min(innerHeight - h - 8, r.bottom - h)) + 'px' });
  }
  function drawQuick() {
    qmenu.textContent = '';
    qmenu.append(mk('div', { color: '#9a9aa6', font: '600 11.5px ' + FONT, padding: '4px 8px 6px' }, 'Quick buttons (click = send it)'));
    const item = (txt, title, fn) => {
      const b = hover(mk('button', { flex: '1', minWidth: '0', textAlign: 'left', border: '0', background: 'transparent', color: '#ececf1', font: '13px ' + FONT, padding: '7px 8px',
        borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, txt), { background: '#2a2a33' }, { background: 'transparent' });
      b.title = title;
      b.addEventListener('mousedown', e => e.preventDefault());
      b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); fn(); });
      return b;
    };
    for (const q of store.get('alts-quick', DEFAULT_QUICK)) {
      const row = mk('div', { display: 'flex', alignItems: 'center', gap: '2px' });
      const x = hover(mk('button', { border: '0', background: 'transparent', color: '#7d7d88', width: '26px', height: '26px', flex: '0 0 26px', borderRadius: '7px', cursor: 'pointer', font: '12px ' + FONT }, '\u2715'),
        { color: '#ff8b8b', background: '#2a2a33' }, { color: '#7d7d88', background: 'transparent' });
      x.title = 'Remove this one';
      x.addEventListener('click', e => { e.stopPropagation(); store.set('alts-quick', store.get('alts-quick', DEFAULT_QUICK).filter(y => y !== q)); drawQuick(); });
      row.append(item(q.split(':')[0].slice(0, 44), q, () => { qmenu.remove(); say(q); }), x);
      qmenu.append(row);
    }
    qmenu.append(item('+ Add one', 'Add a quick button for something you say a lot', () => {
      const c = composer(), now = c ? boxText(c) : '';
      const t = prompt('What should this button send?', now);
      if (t && t.trim()) { store.set('alts-quick', [...store.get('alts-quick', DEFAULT_QUICK), t.trim().slice(0, 2000)]); drawQuick(); }
    }));
  }
  document.addEventListener('mousedown', e => { if (qmenu && qmenu.isConnected && !qmenu.contains(e.target) && e.target !== quickBtn) qmenu.remove(); }, true);

  let lastPos = '';
  function place() {
    if (!R() || !document.body) return;
    if (!side.isConnected) { R().append(side); lastPos = ''; } // first time, or the page wiped it
    const c = composer();
    const show = c && document.visibilityState === 'visible' && !document.querySelector('[role="dialog"]');
    if (!show) { side.style.display = 'none'; return; }
    const r = frame(c).getBoundingClientRect();
    const pos = [r.left, r.top, r.bottom, r.width].map(Math.round).join();
    side.style.display = 'flex';
    if (pos === lastPos) return;
    lastPos = pos;
    const leftRoom = r.left > 48;
    Object.assign(side.style, leftRoom ? { left: (r.left - 40) + 'px', top: Math.max(8, r.bottom - 138) + 'px', flexDirection: 'column' }
      : { left: (r.left + 4) + 'px', top: Math.max(8, r.top - 38) + 'px', flexDirection: 'row' });
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
    Object.assign(picker.style, { left: Math.max(8, Math.min(innerWidth - 360, r.left)) + 'px', top: Math.max(8, r.top - 412) + 'px' });
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
    laterBtn.style.boxShadow = now ? '0 0 0 2px #ef5b5b' : '';
    laterBtn.title = now ? 'Limit hit' + (backAt(u) ? ', back at ' + backAt(u) : '') + '. Type your message, press this, and ALTS pings you when it\'s back.'
      : 'Send later: saves what you typed. When your limit is back, ALTS pings you and you press Send.';
    if (now && !wasLimited) toast('Limit hit' + (backAt(u) ? ' (back at ' + backAt(u) + ')' : '') + '. Type your message and press \u23F0: ALTS pings you when it\'s back.');
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
    const b = box('Long chat');
    b.say('This chat has ' + Math.round(n.words / 1000) + 'k words: every message now costs a lot more usage.');
    b.button('\u21BB Fresh chat', true, () => { b.close(); fresh(); });
    b.button('Not now', false, () => b.close());
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

// ---------- Files panel (claude.ai/code): a Download button for files claude.ai can't show (.exe, .zip...) ----------
// claude.ai's panel only shows pictures + text. ALTS watches how the page loads a file you open there
// (once), then asks the same way for any file and saves it (through the Safe Lane: no Windows warning).
(() => {
  const A = window.__alts;
  if (location.hostname !== 'claude.ai' || !A || A.filesPanel) return;
  A.filesPanel = true;
  const { mk, send, FONT, toast } = A;
  const TK = 'alts-filetpl';
  const recent = []; // the page's latest requests
  const note = r => { recent.push(Object.assign({ t: Date.now() }, r)); if (recent.length > 80) recent.shift(); };
  const bodyText = b => typeof b === 'string' ? b : (b instanceof URLSearchParams ? b.toString() : null);
  const headersObj = h => { const o = {}; try { new Headers(h || {}).forEach((v, k) => { o[k] = v; }); } catch (e) {} return o; };
  const of = window.fetch;
  window.fetch = function (input, init) {
    try {
      const req = input instanceof Request ? input : null;
      note({ url: String(req ? req.url : input), method: ((init && init.method) || (req && req.method) || 'GET').toUpperCase(),
        body: bodyText(init && init.body), headers: headersObj((init && init.headers) || (req && req.headers)) });
    } catch (e) {}
    return of.apply(this, arguments);
  };
  const xo = XMLHttpRequest.prototype.open, xs = XMLHttpRequest.prototype.send, xh = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (m, u) { this.__a = { method: String(m).toUpperCase(), url: String(new URL(u, location.href)), headers: {} }; return xo.apply(this, arguments); };
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) { if (this.__a) this.__a.headers[k.toLowerCase()] = v; return xh.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function (b) { if (this.__a) note(Object.assign({ body: bodyText(b) }, this.__a)); return xs.apply(this, arguments); };

  const dec = s => { try { return decodeURIComponent(s); } catch (e) { return s; } };
  // the panel = the box with the "Filter files" search
  function panel() {
    const inp = [...document.querySelectorAll('input')].find(i => /filter files/i.test(i.placeholder || '') && i.getClientRects().length);
    if (!inp) return null;
    let p = inp.parentElement;
    for (let i = 0; i < 8 && p && rowsIn(p, inp).length < 2; i++) p = p.parentElement;
    return p ? { el: p, inp } : null;
  }
  // every name in the tree, top to bottom, with how far right it starts (= how deep it is)
  function rowsIn(p, inp) {
    const out = [], left = inp.getBoundingClientRect().left - 30;
    const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) {
      const t = n.data.trim();
      if (!t || t.length > 200 || A.ours(n.parentElement)) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      const r = rg.getBoundingClientRect();
      if (!r.width || r.left < left) continue;
      out.push({ n, t, x: r.left, y: r.top, r });
    }
    return out.sort((a, b) => a.y - b.y);
  }
  // "claude-memory/send/ALTS.exe" for a row, from the rows above it that sit further left
  function treePath(rows, i) {
    const parts = [rows[i].t];
    let x = rows[i].x;
    for (let j = i - 1; j >= 0; j--) if (rows[j].x < x - 4) { parts.unshift(rows[j].t); x = rows[j].x; }
    return parts.join('/');
  }
  const tpl = () => { try { return JSON.parse(localStorage.getItem(TK)); } catch (e) { return null; } };

  // learn: right after you open a file, find the request that named it
  function learn(dpath, name, since) {
    for (const r of recent.filter(r => r.t >= since - 50)) {
      for (const [field, text] of [['url', dec(r.url)], ['body', r.body || '']]) {
        const at = text.indexOf(name);
        if (at < 0) continue;
        // the full path as the request wrote it ends with the tree path's tail
        let start = at;
        while (start > 0 && !/["'=?&\s]/.test(text[start - 1])) start--;
        const full = text.slice(start, at + name.length);
        if (!full.endsWith(dpath.split('/').slice(-2).join('/')) && full !== name && !full.endsWith('/' + name)) continue;
        const t = { method: r.method, url: r.url, body: r.body, headers: r.headers, path: full, dpath, field };
        try { localStorage.setItem(TK, JSON.stringify(t)); } catch (e) {}
        send({ t: 'filelearn', url: r.method + ' ' + r.url.replace(/[?#].*$/, '') + ' (' + field + ')' });
        return t;
      }
    }
    return null;
  }
  // the real path for a tree path, from what was learned
  function realPath(t, dpath) {
    const a = t.dpath.split('/'), b = t.path.split('/');
    let k = 0;
    while (k < a.length && k < b.length && a[a.length - 1 - k] === b[b.length - 1 - k]) k++;
    const prefix = b.slice(0, b.length - k).join('/');
    const tailOld = a.slice(0, a.length - k); // tree folders the real path doesn't spell out
    let d = dpath.split('/');
    if (tailOld.length && d.slice(0, tailOld.length).join('/') === tailOld.join('/')) d = d.slice(tailOld.length);
    return (prefix ? prefix + '/' : '') + d.join('/');
  }
  const swap = (s, from, to) => s == null ? s : s.split(from).join(to).split(encodeURIComponent(from)).join(encodeURIComponent(to))
    .split(encodeURIComponent(from).replace(/%2F/g, '/')).join(encodeURIComponent(to).replace(/%2F/g, '/'));
  function b64(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  function pickContent(j, real) { // the file inside a JSON answer: a content/data field first, else the biggest string
    let best = null, named = null, enc = '';
    const walk = (o, d) => {
      if (d > 6 || !o || typeof o !== 'object') return;
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === 'string') {
          if (/encoding/i.test(k)) { enc = v; continue; }
          if (v === real || /(^|\/)[^/]*$/.test(v) && v.endsWith(real.split('/').pop()) && v.length < 600) continue; // that's the name, not the file
          if (/^(content|contents|data|body|bytes|file|text|base64)$/i.test(k) && (!named || v.length > named.length)) named = v;
          if (!best || v.length > best.length) best = v;
        } else walk(v, d + 1);
      }
    };
    walk(j, 0);
    const v = named != null ? named : best;
    if (v == null) return null;
    if (/base64/i.test(enc) || (v.length > 64 && /^[A-Za-z0-9+/=\s]+$/.test(v))) { try { return b64(v.replace(/\s+/g, '')); } catch (e) {} }
    return new TextEncoder().encode(v);
  }
  // ALTS writes the file into Downloads itself: the page sends it over in pieces.
  const pend = {};
  const mb = n => (n / 1048576).toFixed(n < 1048576 ? 2 : 1) + ' MB';
  function b64of(u) { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
  async function hand(bytes, name, chipEl) {
    const id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    pend[id] = chipEl;
    send({ t: 'fsave-start', id, name, size: bytes.length });
    const CH = 512 * 1024;
    for (let o = 0; o < bytes.length; o += CH) {
      send({ t: 'fsave-part', id, b64: b64of(bytes.subarray(o, Math.min(bytes.length, o + CH))) });
      chipEl.textContent = 'Saving ' + Math.round(Math.min(1, (o + CH) / bytes.length) * 100) + '%';
      await new Promise(r => setTimeout(r, 0));
    }
    send({ t: 'fsave-end', id });
  }
  A.fileSaved = r => {
    const c = r && pend[r.id];
    if (!c) return;
    delete pend[r.id];
    delete c.dataset.busy;
    if (r.ok) {
      c.dataset.saved = r.path;
      c.textContent = '\u2714 Saved (' + mb(r.size) + ') \u00b7 Show';
      c.style.background = '#2f9e6b';
      c.title = 'In Downloads: ' + r.path + ' (click = show it in its folder)';
      setTimeout(() => c.remove(), 25000);
    } else {
      c.textContent = '\u2B07 Download';
      toast('Couldn\'t save it: ' + (r.error || 'unknown') + '. Tell Claude what this says.');
    }
  };
  async function download(dpath, name, chipEl) {
    const t = tpl();
    if (!t) { toast('First open any picture in this list once (so ALTS learns how to get files), then press Download again.'); return; }
    const real = realPath(t, dpath);
    chipEl.textContent = 'Downloading...';
    chipEl.dataset.busy = '1';
    try {
      const init = { method: t.method, credentials: 'include', headers: Object.fromEntries(Object.entries(t.headers || {}).filter(([k]) => !/^(content-length|cookie|host)$/i.test(k))) };
      if (t.body != null && t.method !== 'GET' && t.method !== 'HEAD') init.body = swap(t.body, t.path, real);
      const r = await of(swap(t.url, t.path, real), init);
      if (!r.ok) throw new Error('claude.ai said ' + r.status);
      const ct = r.headers.get('content-type') || '';
      let bytes;
      if (/json/i.test(ct)) { bytes = pickContent(await r.json(), real); if (!bytes) throw new Error('no file in the answer'); }
      else bytes = new Uint8Array(await r.arrayBuffer());
      await hand(bytes, name, chipEl);
      send({ t: 'filelearn', url: 'got ' + name + ' (' + bytes.length + ' bytes), handing it to ALTS' });
    } catch (e) {
      chipEl.textContent = '\u2B07 Download';
      delete chipEl.dataset.busy;
      send({ t: 'filelearn', url: 'download failed: ' + (e && e.message || e) });
      toast('Couldn\'t download it: ' + (e && e.message || e) + '. Open a picture in the list once more (ALTS re-learns), then try again. If it still fails, tell Claude what this says.');
    }
  }
  let chip = null;
  document.addEventListener('click', e => {
    const p = panel();
    if (!p || !p.el.contains(e.target) || A.ours(e.target)) return;
    const rows = rowsIn(p.el, p.inp);
    const i = rows.findIndex(r => e.clientY >= r.r.top - 6 && e.clientY <= r.r.bottom + 6 && e.clientX >= r.r.left - 40);
    if (i < 0 || !/\.[A-Za-z0-9]{1,8}$/.test(rows[i].t)) return; // a folder
    const name = rows[i].t, dpath = treePath(rows, i), since = Date.now();
    setTimeout(() => learn(dpath, name, since), 2500); // whatever the page asked for when you opened it
    if (chip) chip.remove();
    const pr = p.el.getBoundingClientRect(), rr = rows[i].r;
    chip = mk('button', { position: 'fixed', zIndex: '2147483647', left: Math.min(innerWidth - 150, pr.right - 140) + 'px', top: (rr.top - 4) + 'px',
      font: '600 12px ' + FONT, padding: '4px 10px', borderRadius: '999px', border: '0', background: '#d97757', color: '#fff', cursor: 'pointer',
      boxShadow: '0 4px 14px rgba(0,0,0,.35)' }, '⬇ Download');
    chip.dataset.alts = '1';
    chip.title = 'Save ' + name + ' to your Downloads folder';
    const mine = chip;
    chip.addEventListener('click', ev => {
      ev.stopPropagation();
      if (mine.dataset.saved) send({ t: 'fsave-show', path: mine.dataset.saved });
      else if (!mine.dataset.busy) download(dpath, name, mine);
    });
    A.R ? A.R().append(chip) : document.documentElement.append(chip);
    setTimeout(() => { if (mine.isConnected && mine.textContent === '⬇ Download') mine.remove(); }, 15000);
  }, true);
  addEventListener('scroll', () => { if (chip && chip.textContent === '⬇ Download') chip.remove(); }, true);
})();
