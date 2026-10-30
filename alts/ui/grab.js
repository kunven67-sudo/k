// Grab: copies the whole chat on the open page, so it can be pasted into a chat on another account.
// ALTS runs this in the account's page when you press Grab. It scrolls the chat top to bottom and keeps
// every line in order, also when the site only draws the messages that are on screen. Plain DOM only
// (no innerHTML, no style attributes) so a strict page can't block it.
(async () => {
  if (window.__altsGrab) return;
  window.__altsGrab = 1;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const R = document.documentElement;
  const FONT = '"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif';
  const mk = (tag, css, txt) => { const e = document.createElement(tag); Object.assign(e.style, css); if (txt != null) e.textContent = txt; return e; };

  const box = mk('div', { position: 'fixed', right: '20px', bottom: '20px', zIndex: '2147483647', width: '360px', boxSizing: 'border-box',
    background: '#1b1b20', color: '#ececf1', font: '13.5px/1.45 ' + FONT, borderRadius: '14px', padding: '16px 18px',
    boxShadow: '0 14px 44px rgba(0,0,0,.5)', border: '1px solid #2a2a32', textAlign: 'left' });
  const title = mk('div', { fontWeight: '650', fontSize: '15px', marginBottom: '4px', color: '#fff' }, 'Grab');
  const msg = mk('div', { color: '#a3a3ae' }, 'Going to the start of the chat...');
  const bar = mk('div', { height: '6px', background: '#24242b', borderRadius: '3px', marginTop: '12px', overflow: 'hidden' });
  const fill = mk('div', { height: '100%', width: '0%', background: '#d97757', transition: 'width .25s' });
  const note = mk('div', { color: '#7b7b87', fontSize: '12px', marginTop: '10px', display: 'none', wordBreak: 'break-word' });
  const btns = mk('div', { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px' });
  bar.appendChild(fill);
  box.append(title, msg, bar, note, btns);
  R.appendChild(box);
  const button = (label, main, fn) => {
    const b = mk('button', { font: '600 13px ' + FONT, padding: '8px 13px', borderRadius: '9px', cursor: 'pointer',
      border: main ? '1px solid #ececf1' : '1px solid #3a3a44', background: main ? '#ececf1' : 'transparent', color: main ? '#141417' : '#ececf1' }, label);
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); fn(b); });
    btns.appendChild(b);
    return b;
  };
  let stopped = false;
  const stop = button('Stop', false, () => { stopped = true; });

  // The chat's scroll box: the biggest scrollable thing on the page (or the page itself).
  const page = document.scrollingElement || R;
  let sc = null, best = 0;
  for (const e of document.querySelectorAll('body *')) {
    if (box.contains(e) || e.clientHeight < 200 || e.scrollHeight - e.clientHeight < 150) continue;
    if (!/(auto|scroll|overlay)/.test(getComputedStyle(e).overflowY)) continue;
    const s = e.clientWidth * e.scrollHeight;
    if (s > best) { best = s; sc = e; }
  }
  if (!sc || (page.scrollHeight - page.clientHeight > 150 && page.clientWidth * page.scrollHeight > best)) sc = page;
  const root = sc === page ? (document.querySelector('main') || document.body) : sc;
  const go = top => sc.scrollTo({ top, behavior: 'instant' });

  // Long messages folded behind "Show more" get opened so nothing is cut.
  const expand = () => {
    for (const b of root.querySelectorAll('button')) {
      if (/^(show more|show full( message)?|read more|see more)$/i.test(b.textContent.trim())) { try { b.click(); } catch (e) {} }
    }
  };
  const read = () => root.innerText.split('\n').map(s => s.replace(/\s+$/, ''));
  // Joins what was on screen before with what's on screen now, without repeats.
  const merge = (A, N) => {
    if (!A.length) return N.slice();
    if (!N.length) return A;
    const n = A.length, m = N.length;
    for (let p = Math.max(0, n - m); p < n; p++) {
      if (A[p] !== N[0]) continue;
      let ok = true;
      for (let k = 1; k < n - p; k++) if (A[p + k] !== N[k]) { ok = false; break; }
      if (ok) return A.concat(N.slice(n - p));
    }
    for (let i = n - 1; i >= Math.max(0, n - 60); i--) {
      if (A[i].trim().length < 12) continue;
      const j = N.lastIndexOf(A[i]);
      if (j >= 0) return A.concat(N.slice(j + 1 + (n - 1 - i)));
    }
    return A.concat(['', '[Grab: a bit may be missing here]', ''], N);
  };
  const words = A => A.join(' ').split(/\s+/).filter(Boolean).length;

  // 1) all the way up, letting older messages load in
  let lastH = -1, still = 0;
  for (let i = 0; i < 400 && still < 4 && !stopped; i++) {
    go(0);
    await sleep(500);
    if (sc.scrollHeight === lastH && sc.scrollTop <= 1) still++; else { still = 0; lastH = sc.scrollHeight; }
  }

  // 2) quick check: if the whole chat is already drawn, top and bottom read the same = grab it in one go
  msg.textContent = 'Reading the chat...';
  let A = [], prevTop = -1, stuck = 0;
  expand();
  await sleep(600);
  const atTop = read(), h0 = sc.scrollHeight;
  go(sc.scrollHeight);
  await sleep(900);
  expand();
  await sleep(300);
  const whole = !stopped && sc.scrollHeight === h0 && read().join('\n') === atTop.join('\n');
  if (whole) A = atTop; else go(0);

  // 3) otherwise down through the whole chat, screen by screen
  for (let step = 0; step < 6000 && !stopped && !whole; step++) {
    expand();
    await sleep(step ? 320 : 700);
    A = merge(A, read());
    const max = sc.scrollHeight - sc.clientHeight;
    fill.style.width = Math.round(max > 0 ? Math.min(1, sc.scrollTop / max) * 100 : 100) + '%';
    if (step % 4 === 0) msg.textContent = 'Reading the chat... ' + words(A).toLocaleString() + ' words so far';
    if (sc.scrollTop >= max - 2) {
      await sleep(900);
      if (sc.scrollHeight - sc.clientHeight > max + 2) { go(sc.scrollTop + sc.clientHeight * 0.8); continue; }
      A = merge(A, read());
      break;
    }
    if (sc.scrollTop === prevTop) { if (++stuck >= 3) break; } else stuck = 0;
    prevTop = sc.scrollTop;
    go(sc.scrollTop + Math.max(200, sc.clientHeight * 0.8));
  }
  stop.remove();

  // 4) ready to copy (copying needs a real click, so it's a button)
  const text = A.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const count = words(A);
  const d = new Date(), pad = n => String(n).padStart(2, '0');
  const name = 'chat-' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + '.md';
  const file = '# Chat copied with ALTS Grab\n\nLink: ' + location.href + '\nCopied: ' + d.toString() + '\nWords: ' + count +
    (stopped ? '\nStopped early: yes' : '') + '\n\n---\n\n' + text + '\n';
  fill.style.width = '100%';
  fill.style.background = '#3dbe8b';
  msg.textContent = (stopped ? 'Stopped early, got ' : count < 150 ? 'Only got ' : 'Got the whole chat: ') + count.toLocaleString() +
    ' words.' + (!stopped && count < 150 ? ' Is the chat open on this page?' : ' Press Copy, switch accounts, and paste it to Claude.');
  const lines = text.split('\n').filter(s => s.trim().length > 12);
  note.textContent = 'Ends with: "' + (lines[lines.length - 1] || '').trim().slice(0, 90) + '"';
  note.style.display = 'block';
  button('Copy', true, async b => {
    try { await navigator.clipboard.writeText(file); }
    catch (e) { const t = document.createElement('textarea'); t.value = file; R.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
    b.textContent = 'Copied';
    msg.textContent = 'Copied. Switch accounts and paste it to Claude (Ctrl+V).';
  });
  button('Save as file', false, () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([file], { type: 'text/markdown' }));
    a.download = name;
    R.appendChild(a); a.click(); a.remove();
  });
  button('Close', false, () => { box.remove(); window.__altsGrab = 0; });
})();
