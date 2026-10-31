// ALTS page helper. Runs in every page of an account, but only does anything on claude.ai:
// Save chat, Save all, Continue on another account, pins, jump to top/bottom, message + word counter
// and the usage bar.
// It talks to ALTS with postMessage; ALTS answers by calling window.__alts.<name>(...).
// Plain DOM only (no innerHTML, no style attributes) so a strict page can't block it.
(() => {
  if (location.hostname !== 'claude.ai' || window.__alts) return;
  const send = m => { try { window.chrome.webview.postMessage(JSON.stringify(m)); } catch (e) {} };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const R = () => document.documentElement; // ALTS adds this before the page exists, so always look it up
  const FONT = '"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif';
  const mk = (tag, css, txt) => { const e = document.createElement(tag); Object.assign(e.style, css || {}); if (txt != null) e.textContent = txt; return e; };
  const ours = el => !!(el && el.closest && el.closest('[data-alts]'));

  // ---------- the little box in the corner ----------
  let panel = null;
  function box(title) {
    if (panel) panel.close();
    const p = mk('div', { position: 'fixed', right: '20px', bottom: '20px', zIndex: '2147483647', width: '360px', boxSizing: 'border-box',
      background: '#1b1b20', color: '#ececf1', font: '13.5px/1.45 ' + FONT, borderRadius: '14px', padding: '16px 18px',
      boxShadow: '0 14px 44px rgba(0,0,0,.5)', border: '1px solid #2a2a32', textAlign: 'left' });
    p.dataset.alts = '1';
    const head = mk('div', { fontWeight: '650', fontSize: '15px', marginBottom: '4px', color: '#fff' }, title);
    const msg = mk('div', { color: '#a3a3ae', wordBreak: 'break-word' });
    const bar = mk('div', { height: '6px', background: '#24242b', borderRadius: '3px', marginTop: '12px', overflow: 'hidden', display: 'none' });
    const fill = mk('div', { height: '100%', width: '0%', background: '#d97757', transition: 'width .25s' });
    const list = mk('div', { marginTop: '10px', maxHeight: '260px', overflowY: 'auto', display: 'none' });
    const btns = mk('div', { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px' });
    bar.append(fill);
    p.append(head, msg, bar, list, btns);
    R().append(p);
    const api = {
      el: p, list,
      say(t) { msg.textContent = t; return api; },
      progress(f) { bar.style.display = 'block'; fill.style.width = Math.round(Math.max(0, Math.min(1, f)) * 100) + '%'; return api; },
      done(ok) { bar.style.display = 'block'; fill.style.width = '100%'; fill.style.background = ok === false ? '#ef5b5b' : '#3dbe8b'; return api; },
      clear() { btns.textContent = ''; return api; },
      button(label, main, fn) {
        const b = mk('button', { font: '600 13px ' + FONT, padding: '8px 13px', borderRadius: '9px', cursor: 'pointer',
          border: main ? '1px solid #ececf1' : '1px solid #3a3a44', background: main ? '#ececf1' : 'transparent', color: main ? '#141417' : '#ececf1' }, label);
        b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); fn(b); });
        btns.append(b);
        return b;
      },
      close() { p.remove(); if (panel === api) panel = null; }
    };
    panel = api;
    return api;
  }
  function toast(t) {
    const b = box('ALTS').say(t);
    b.button('OK', false, () => b.close());
    setTimeout(() => { if (panel === b) b.close(); }, 4500);
  }

  // ---------- finding the chat ----------
  let scMemo = null, scAt = 0;
  function scroller(cached) {
    if (cached && scMemo && scMemo.isConnected && Date.now() - scAt < 15000) return scMemo;
    const page = document.scrollingElement || R();
    let sc = null, best = 0;
    for (const e of document.querySelectorAll('body *')) {
      if (ours(e) || e.clientHeight < 200 || e.scrollHeight - e.clientHeight < 150) continue;
      if (!/(auto|scroll|overlay)/.test(getComputedStyle(e).overflowY)) continue;
      const s = e.clientWidth * e.scrollHeight;
      if (s > best) { best = s; sc = e; }
    }
    // the page can look taller than the chat box just because of hidden bits; keep the box if it holds most of the text
    if (!sc || (page.scrollHeight - page.clientHeight > 150 && page.clientWidth * page.scrollHeight > best &&
        (sc.innerText || '').length < (document.body.innerText || '').length * 0.5)) sc = page;
    scMemo = sc; scAt = Date.now();
    return sc;
  }
  const rootOf = sc => sc === (document.scrollingElement || R()) ? (document.querySelector('main') || document.body) : sc;
  const go = (sc, top) => sc.scrollTo({ top, behavior: 'instant' });

  // Waits until the page stops changing (or max ms).
  const settle = (quiet = 400, max = 6000) => new Promise(res => {
    let t = setTimeout(done, quiet);
    const hard = setTimeout(done, max);
    const mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(done, quiet); });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    function done() { mo.disconnect(); clearTimeout(t); clearTimeout(hard); res(); }
  });

  // "Load later messages" / "Load earlier messages": keep pressing until none are left.
  const LOAD = /^(load|show|view) (earlier|later|older|newer|previous|more)( messages)?\b/i;
  const loaders = which => [...document.querySelectorAll('button,[role="button"],a')].filter(b => {
    if (ours(b) || b.disabled || !b.getClientRects().length) return false;
    const t = (b.innerText || b.textContent).trim();
    if (!LOAD.test(t)) return false;
    if (which === 'up') return /earlier|older|previous/i.test(t);
    if (which === 'down') return /later|newer|more/i.test(t);
    return true;
  });
  async function loadAll(state, which) {
    let clicks = 0;
    for (let calm = 0, i = 0; calm < 2 && i < 4000 && !state.stop; i++) {
      const bs = loaders(which);
      if (!bs.length) { calm++; await settle(500, 1500); continue; }
      calm = 0;
      for (const b of bs) { try { b.click(); clicks++; } catch (e) {} }
      if (state.tick) state.tick('Loading the whole chat... (pressed Load ' + clicks + (clicks === 1 ? ' time)' : ' times)'));
      await settle(350, 8000);
    }
    return clicks;
  }

  // Folded parts (commands that ran, files changed, thinking): open them all so the save has everything.
  async function expandAll(root, state) {
    const seen = new WeakSet();
    let opened = 0;
    for (let round = 0; round < 60 && !state.stop; round++) {
      const fresh = [...root.querySelectorAll('[aria-expanded="false"]:not([aria-haspopup])')].filter(b =>
        !seen.has(b) && !ours(b) && b.getClientRects().length && !b.closest('header,nav,aside,[role="menu"],[role="listbox"],[role="toolbar"],form'));
      if (!fresh.length) break;
      for (const b of fresh) { seen.add(b); try { b.click(); opened++; } catch (e) {} }
      if (state.tick) state.tick('Opening folded parts... (' + opened + ')');
      await settle(300, 5000);
      if (opened > 5000) break;
    }
    return opened;
  }

  // ---------- Save chat ----------
  const toDataURL = blob => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(''); r.readAsDataURL(blob); });
  async function inlineImages(clone, state) {
    const imgs = [...clone.querySelectorAll('img')];
    let done = 0, i = 0;
    const one = async img => {
      const src = img.getAttribute('src') || '';
      img.removeAttribute('srcset');
      img.removeAttribute('loading');
      if (!src || src.startsWith('data:')) return;
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 15000);
        const r = await fetch(new URL(src, location.href).href, { credentials: 'include', signal: ctl.signal });
        clearTimeout(t);
        if (r.ok) { const d = await toDataURL(await r.blob()); if (d) img.setAttribute('src', d); }
      } catch (e) {}
    };
    const worker = async () => { while (i < imgs.length && !state.stop) { const img = imgs[i++]; await one(img); done++; if (state.tick && done % 5 === 0) state.tick('Saving pictures... ' + done + ' / ' + imgs.length); } };
    await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
    return imgs.length;
  }
  // fonts and pictures inside the CSS point at claude.ai, so the saved file still finds them when you're online
  const absolute = (css, base) => css.replace(/url\((['"]?)([^'")]+)\1\)/g, (m, q, u) => {
    if (/^(data:|blob:|#)/.test(u)) return m;
    try { return 'url("' + new URL(u, base).href + '")'; } catch (e) { return m; }
  });
  async function cssText() {
    const out = [];
    const sheets = [...document.styleSheets, ...(document.adoptedStyleSheets || [])];
    for (const sh of sheets) {
      const base = sh.href || location.href;
      try { out.push(absolute([...sh.cssRules].map(r => r.cssText).join('\n'), base)); }
      catch (e) {
        if (sh.href) { try { const r = await fetch(sh.href, { credentials: 'include' }); if (r.ok) out.push(absolute(await r.text(), base)); } catch (e2) {} }
      }
    }
    return out.join('\n');
  }
  function chatTitle() {
    const t = (document.title || '').replace(/\s*[|\-–]\s*Claude.*$/i, '').trim();
    return t || 'Chat';
  }
  const lines = root => root.innerText.split('\n').map(s => s.replace(/\s+$/, ''));
  const words = s => (s.match(/\S+/g) || []).length;

  async function snapshot(state) {
    const sc = scroller();
    const root = rootOf(sc);
    if (state.tick) state.tick('Loading the whole chat...');
    await loadAll(state);
    go(sc, 0);
    await loadAll(state, 'up');
    await expandAll(root, state);
    await loadAll(state);
    const text = lines(rootOf(scroller())).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (state.tick) state.tick('Saving how it looks...');
    const clone = R().cloneNode(true);
    clone.querySelectorAll('script,noscript,iframe,object,embed,[data-alts],link[rel="preload"],link[rel="modulepreload"],link[rel="prefetch"],link[rel="stylesheet"],style').forEach(n => n.remove());
    clone.querySelectorAll('a[href]').forEach(a => { try { a.setAttribute('href', new URL(a.getAttribute('href'), location.href).href); } catch (e) {} });
    const head = clone.querySelector('head') || clone.insertBefore(document.createElement('head'), clone.firstChild);
    const meta = document.createElement('meta');
    meta.setAttribute('charset', 'utf-8');
    head.insertBefore(meta, head.firstChild);
    const st = document.createElement('style');
    st.textContent = await cssText();
    head.append(st);
    const t = head.querySelector('title') || head.appendChild(document.createElement('title'));
    t.textContent = chatTitle() + ' (saved)';
    const pics = await inlineImages(clone, state);
    const html = '<!doctype html>\n' + clone.outerHTML;
    const d = new Date();
    const md = '# ' + chatTitle() + '\n\nLink: ' + location.href + '\nSaved: ' + d.toString() + '\nWords: ' + words(text) +
      (state.stop ? '\nStopped early: yes' : '') + '\n\n---\n\n' + text + '\n';
    return { title: chatTitle(), url: location.href, html, md, pics, words: words(text) };
  }

  let saving = null;
  async function save(opts) {
    opts = opts || {};
    if (saving) return;
    const state = { stop: false };
    saving = state;
    const b = opts.quiet ? null : box('Save chat');
    if (b) { b.say('Getting the whole chat...').progress(0.05); b.button('Stop', false, () => { state.stop = true; }); }
    state.tick = t => { if (b) b.say(t); if (opts.onTick) opts.onTick(t); };
    try {
      const s = await snapshot(state);
      if (b) { b.clear().say('Writing the file...').progress(0.9); }
      send({ t: 'save', why: opts.why || 'save', title: s.title, url: s.url, html: s.html, md: s.md, words: s.words, pics: s.pics, stopped: state.stop });
    } catch (e) {
      if (b) { b.clear().say('Couldn\'t save this chat: ' + (e && e.message || e)).done(false); b.button('Close', false, () => b.close()); }
      send({ t: 'save-failed', why: opts.why || 'save', error: String(e && e.message || e) });
    }
    saving = null;
  }
  // ALTS wrote the file
  function saved(r) {
    if (r.why === 'all') { allStep(r); return; }
    if (r.why === 'continue') return;
    const b = panel && panel.el.isConnected ? panel.clear() : box('Save chat');
    if (!r.ok) { b.say('Couldn\'t write the file: ' + (r.error || 'unknown')).done(false); b.button('Close', false, () => b.close()); return; }
    b.say('Saved: ' + r.words.toLocaleString() + ' words, ' + r.pics + ' pictures.' + (r.uploaded ? ' Also in Claude\'s memory.' : r.uploadError ? ' (Memory upload failed: ' + r.uploadError + ')' : '')).done(true);
    b.button('Open it', true, () => send({ t: 'open-saved', file: r.html }));
    b.button('Show folder', false, () => send({ t: 'open-folder', file: r.html }));
    b.button('Close', false, () => b.close());
  }

  // ---------- Save all (every chat in the list on the left) ----------
  const KEY = 'alts-save-all';
  const readAll = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const writeAll = v => { try { if (v) sessionStorage.setItem(KEY, JSON.stringify(v)); else sessionStorage.removeItem(KEY); } catch (e) {} };
  const CHAT_LINK = /\/(code\/session_[A-Za-z0-9]+|chat\/[0-9a-f-]{36})(\/|$|\?)/;
  async function chatLinks() {
    const found = new Map();
    const collect = () => document.querySelectorAll('a[href]').forEach(a => { const h = a.href; if (CHAT_LINK.test(new URL(h).pathname + '/')) found.set(h.split(/[?#]/)[0], 1); });
    collect();
    // the list loads more as it scrolls
    const lists = [...new Set([...document.querySelectorAll('a[href]')].filter(a => CHAT_LINK.test(new URL(a.href).pathname + '/')).map(a => {
      let p = a.parentElement; while (p && p !== document.body) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight + 20) return p; p = p.parentElement; } return null;
    }).filter(Boolean))];
    for (const l of lists) {
      for (let i = 0, last = -1, still = 0; i < 200 && still < 3; i++) {
        l.scrollTo({ top: l.scrollHeight, behavior: 'instant' });
        await settle(400, 2000);
        collect();
        if (found.size === last) still++; else { still = 0; last = found.size; }
      }
    }
    return [...found.keys()];
  }
  async function saveAll() {
    const links = await chatLinks();
    if (!links.length) { toast('No chats found in the list on the left.'); return; }
    writeAll({ links, i: 0, ok: 0, failed: 0 });
    allNext();
  }
  function allBox(s) {
    const b = box('Save all chats');
    b.say('Chat ' + Math.min(s.i + 1, s.links.length) + ' of ' + s.links.length + '...').progress(s.i / s.links.length);
    b.button('Stop', false, () => { writeAll(null); b.clear().say('Stopped. Saved ' + s.ok + ' chats.').done(true); b.button('Close', false, () => b.close()); });
    return b;
  }
  function allNext() {
    const s = readAll();
    if (!s) return;
    if (s.i >= s.links.length) {
      writeAll(null);
      const b = box('Save all chats').say('Done: saved ' + s.ok + ' of ' + s.links.length + ' chats' + (s.failed ? ' (' + s.failed + ' failed)' : '') + '.').done(true);
      b.button('Show folder', true, () => send({ t: 'open-folder' }));
      b.button('Close', false, () => b.close());
      return;
    }
    const target = s.links[s.i];
    if (location.href.split(/[?#]/)[0] !== target) { location.assign(target); return; }
    allBox(s);
    // wait for the chat to show up, then save it
    (async () => {
      for (let i = 0, last = -1, still = 0; i < 60 && still < 3; i++) {
        await sleep(500);
        const n = (rootOf(scroller()).innerText || '').length;
        if (n > 200 && n === last) still++; else { still = 0; last = n; }
      }
      const b = panel;
      save({ quiet: true, why: 'all', onTick: t => { if (b && b === panel) b.say('Chat ' + (s.i + 1) + ' of ' + s.links.length + ': ' + t); } });
    })();
  }
  function allStep(r) {
    const s = readAll();
    if (!s) return;
    s.i++;
    if (r.ok) s.ok++; else s.failed++;
    writeAll(s);
    allNext();
  }

  // ---------- the chat box ----------
  function composer() {
    const all = [...document.querySelectorAll('textarea,[contenteditable="true"]')].filter(e => !ours(e) && e.getClientRects().length);
    if (!all.length) return null;
    return all.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
  }
  function putText(c, text) {
    c.focus();
    if (c.tagName === 'TEXTAREA') {
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      set.call(c, text);
      c.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      document.execCommand('selectAll', false);
      document.execCommand('insertText', false, text);
    }
  }
  const mediaCount = () => document.querySelectorAll('img[src^="blob:"],img[src^="data:"]').length;
  async function attach(c, files) {
    const before = mediaCount();
    const shows = () => mediaCount() > before || files.some(f => (document.body.innerText || '').includes(f.name));
    const dt = () => { const d = new DataTransfer(); files.forEach(f => d.items.add(f)); return d; };
    c.focus();
    c.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt(), bubbles: true, cancelable: true }));
    await settle(400, 2500);
    if (shows()) return true;
    const input = [...document.querySelectorAll('input[type="file"]')].find(i => !ours(i) && !i.disabled);
    if (input) {
      input.files = dt().files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await settle(400, 2500);
      if (shows()) return true;
    }
    c.dispatchEvent(new DragEvent('drop', { dataTransfer: dt(), bubbles: true, cancelable: true }));
    await settle(400, 2500);
    return shows();
  }

  // ---------- Continue on another account (this side: put it in the new chat) ----------
  async function continueWith(p) {
    let c = null;
    for (let i = 0; i < 80 && !c; i++) { c = composer(); if (!c) await sleep(250); }
    if (!c) { toast('Couldn\'t find the chat box. The text is copied: paste it with Ctrl+V.'); try { await navigator.clipboard.writeText(p.text); } catch (e) {} return; }
    putText(c, p.text);
    let ok = true;
    if (p.md) ok = await attach(c, [new File([p.md], p.name, { type: 'text/markdown' })]);
    const b = box('Continue');
    b.say(ok ? 'Ready. The old chat is attached. Press Enter to start.' : 'The message is ready, but the file didn\'t attach. ' + (p.saved ? 'It\'s saved on your PC: ' + p.saved : '')).done(ok);
    b.button('OK', true, () => { b.close(); c.focus(); });
  }

  // ---------- Pins: select text, press Pin ----------
  const pinKey = () => 'alts-pins:' + location.pathname;
  const getPins = () => { try { return JSON.parse(localStorage.getItem(pinKey()) || '[]'); } catch (e) { return []; } };
  const setPins = v => { try { localStorage.setItem(pinKey(), JSON.stringify(v)); } catch (e) {} };
  let pill = null;
  const dropPill = () => { if (pill) { pill.remove(); pill = null; } };
  document.addEventListener('mouseup', e => {
    if (ours(e.target)) return;
    setTimeout(() => {
      dropPill();
      const sel = getSelection();
      const t = sel && !sel.isCollapsed ? sel.toString().trim() : '';
      if (t.length < 3 || t.length > 600) return;
      const n = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
      if (!n || n.closest('textarea,[contenteditable="true"]')) return;
      const r = sel.getRangeAt(0).getBoundingClientRect();
      pill = mk('button', { position: 'fixed', left: Math.min(innerWidth - 80, r.right + 6) + 'px', top: Math.max(6, r.top - 34) + 'px', zIndex: '2147483647',
        font: '600 12.5px ' + FONT, padding: '6px 11px', borderRadius: '8px', border: '1px solid #3a3a44', background: '#1b1b20', color: '#ececf1',
        cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,0,0,.4)' }, 'Pin');
      pill.dataset.alts = '1';
      pill.addEventListener('mousedown', ev => ev.preventDefault());
      pill.addEventListener('click', () => {
        const all = getPins();
        if (!all.some(p => p.text === t)) all.push({ text: t, at: Date.now() });
        setPins(all);
        dropPill();
        toast('Pinned. Open Pins in ALTS to jump back to it.');
      });
      R().append(pill);
    }, 0);
  }, true);
  document.addEventListener('scroll', dropPill, true);
  async function findText(t) {
    getSelection().removeAllRanges();
    if (window.find(t, false, false, true)) return true;
    await loadAll({}, null);
    getSelection().removeAllRanges();
    return window.find(t, false, false, true);
  }
  function pins() {
    const b = box('Pins');
    const all = getPins();
    b.list.textContent = '';
    b.list.style.display = all.length ? 'block' : 'none';
    b.say(all.length ? all.length + (all.length === 1 ? ' pin' : ' pins') + ' in this chat.' : 'No pins in this chat yet. Select some text and press Pin.');
    all.slice().reverse().forEach(p => {
      const row = mk('div', { display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '8px 0', borderTop: '1px solid #2a2a32' });
      const txt = mk('div', { flex: '1', color: '#ececf1', fontSize: '12.5px', maxHeight: '54px', overflow: 'hidden' }, p.text);
      const goB = mk('button', { font: '600 12px ' + FONT, padding: '5px 10px', borderRadius: '7px', border: '1px solid #3a3a44', background: 'transparent', color: '#ececf1', cursor: 'pointer' }, 'Go');
      const del = mk('button', { font: '600 12px ' + FONT, padding: '5px 8px', borderRadius: '7px', border: '1px solid #3a3a44', background: 'transparent', color: '#ff8b8b', cursor: 'pointer' }, 'Remove');
      goB.addEventListener('click', async () => { const ok = await findText(p.text); if (!ok) b.say('Couldn\'t find it in the chat anymore.'); });
      del.addEventListener('click', () => { setPins(getPins().filter(x => x.text !== p.text)); row.remove(); });
      row.append(txt, goB, del);
      b.list.append(row);
    });
    b.button('Close', false, () => b.close());
  }

  // ---------- Top / Bottom ----------
  async function jump(where) {
    const sc = scroller();
    if (where === 'top') { go(sc, 0); await loadAll({}, 'up'); go(scroller(), 0); }
    else { go(sc, sc.scrollHeight); await loadAll({}, 'down'); const s2 = scroller(); go(s2, s2.scrollHeight); }
  }

  // ---------- counter + usage ----------
  let lastCount = '';
  setInterval(() => {
    if (document.visibilityState !== 'visible' || !document.body) return;
    const t = rootOf(scroller(true)).textContent || '';
    const you = (t.match(/You said:/g) || []).length, claude = (t.match(/Claude responded:/g) || []).length;
    const c = JSON.stringify([you + claude, words(t), loaders().length > 0]);
    if (c !== lastCount) { lastCount = c; send({ t: 'count', msgs: you + claude, words: words(t), more: loaders().length > 0 }); }
  }, 6000);
  async function usage() {
    try {
      const orgs = await (await fetch('/api/organizations', { credentials: 'include' })).json();
      for (const o of Array.isArray(orgs) ? orgs : []) {
        if (!o || !o.uuid) continue;
        const r = await fetch('/api/organizations/' + o.uuid + '/usage', { credentials: 'include' });
        if (!r.ok) continue;
        const j = await r.json();
        const pick = k => j && j[k] && typeof j[k].utilization === 'number' ? j[k] : null;
        const s = pick('five_hour'), w = pick('seven_day');
        if (s || w) { send({ t: 'usage', s: s ? s.utilization : -1, w: w ? w.utilization : -1, sr: s ? s.resets_at || '' : '', wr: w ? w.resets_at || '' : '' }); return; }
      }
    } catch (e) {}
  }
  setInterval(usage, 5 * 60 * 1000);

  window.__alts = { save, saved, saveAll, continueWith, pins, jump, toast };
  const start = () => { send({ t: 'hello' }); usage(); if (readAll()) setTimeout(allNext, 1500); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
