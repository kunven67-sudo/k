// ALTS phone sign-in helper. Runs in every page of an account, only does something on claude.ai:
// - on the sign-in page it asks ALTS for a QR code and shows it in a small card
// - when the phone sends a Gmail / code, ALTS calls __altsPhone.email(...) / .code(...) and this types
//   them into Claude's own sign-in page (the normal "Continue with email" way)
// - when the page leaves the sign-in page, it tells ALTS (so the phone can say "Signed in")
// Plain DOM only (no innerHTML) like page.js.
(() => {
  if (location.hostname !== 'claude.ai' || window.__altsPhone) return;
  const send = m => { try { window.chrome.webview.postMessage(JSON.stringify(m)); } catch (e) {} };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const FONT = '"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif';
  const mk = (tag, css, txt) => { const e = document.createElement(tag); Object.assign(e.style, css || {}); if (txt != null) e.textContent = txt; return e; };
  const onLogin = () => /^\/(login|signup|magic-link)/.test(location.pathname);
  const vis = el => !!(el && el.isConnected && !el.disabled && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  const state = (step, note) => send({ t: 'phone-state', kind: step || '', text: note || '' });

  // ---------- the QR card ----------
  let card = null, hidden = false;
  function showQR(d) {
    if (!onLogin() || hidden) return;
    if (card) card.remove();
    card = mk('div', { position: 'fixed', right: '20px', bottom: '20px', zIndex: '2147483647', width: '250px', boxSizing: 'border-box',
      background: '#1b1b20', color: '#ececf1', font: '13px/1.45 ' + FONT, borderRadius: '14px', padding: '14px 16px 12px',
      boxShadow: '0 14px 44px rgba(0,0,0,.45)', border: '1px solid #2a2a32', textAlign: 'center' });
    card.dataset.alts = '1';
    const head = mk('div', { fontWeight: '650', fontSize: '15px', color: '#fff', margin: '0 22px 8px' }, 'Sign in with your phone');
    card.append(head);
    if (d.error) {
      card.append(mk('div', { color: '#ef9a9a' }, d.error));
    } else {
      const img = mk('img', { display: 'block', width: '200px', height: '200px', maxWidth: 'none', margin: '0 auto', borderRadius: '8px', background: '#fff',
        padding: '6px', boxSizing: 'border-box', imageRendering: 'pixelated' });
      img.src = d.png;
      img.alt = 'QR code';
      card.append(img,
        mk('div', { color: '#a3a3ae', marginTop: '8px' }, 'Scan with your phone camera. Phone and PC on the same Wi-Fi.'),
        mk('div', { color: '#a3a3ae', marginTop: '4px' }, 'If Windows asks to allow ALTS, press Allow.'),
        mk('div', { color: '#6f6f7a', marginTop: '6px', fontSize: '11.5px', wordBreak: 'break-all' }, d.url));
    }
    const x = mk('button', { position: 'absolute', top: '6px', right: '6px', left: 'auto', width: '26px', height: '26px', minWidth: '0', margin: '0',
      background: 'transparent', border: '0', borderRadius: '6px', color: '#8a8a94', font: '18px/26px ' + FONT, cursor: 'pointer', padding: '0',
      boxShadow: 'none', textAlign: 'center' }, '\u00d7');
    x.title = 'Hide';
    x.onclick = () => { hidden = true; card.remove(); card = null; };
    card.append(x);
    document.documentElement.append(card);
  }

  // ---------- typing into Claude's sign-in page ----------
  const inputs = () => [...document.querySelectorAll('input')].filter(i => vis(i) && !i.closest('[data-alts]') && !/^(hidden|checkbox|radio|submit|button)$/i.test(i.type));
  const findEmail = () => inputs().find(i => i.type === 'email' || /email/i.test([i.name, i.id, i.placeholder, i.autocomplete, i.getAttribute('aria-label')].join(' ')));
  const codeBoxes = () => inputs().filter(i => i !== findEmail() && (i.autocomplete === 'one-time-code' || i.inputMode === 'numeric' ||
    /code|otp|verif|token/i.test([i.name, i.id, i.placeholder, i.getAttribute('aria-label')].join(' ')) || i.maxLength === 1));
  const buttons = () => [...document.querySelectorAll('button, [role=button], input[type=submit]')].filter(b => vis(b) && !b.closest('[data-alts]'));
  const textOf = b => ((b.textContent || b.value || b.getAttribute('aria-label') || '') + '').replace(/\s+/g, ' ').trim();
  const pick = re => buttons().find(b => re.test(textOf(b)) && !/google|apple|sso|single sign/i.test(textOf(b)));

  function setVal(el, v) {
    const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    el.focus();
    d.set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function submit(el, re) {
    const b = pick(re);
    if (b) { b.click(); return; }
    if (el && el.form && el.form.requestSubmit) { el.form.requestSubmit(); return; }
    if (el) ['keydown', 'keypress', 'keyup'].forEach(t => el.dispatchEvent(new KeyboardEvent(t, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true })));
  }

  async function email(addr) {
    let box = null;
    for (let i = 0; i < 40 && !(box = findEmail()); i++) {
      if (i === 4) { const more = pick(/continue with email|use email|email/i); if (more) more.click(); } // a page that hides the box behind a button
      await sleep(250);
    }
    if (!box) { state('email', 'Couldn’t find the email box on the Claude page. Is the PC on the sign-in page?'); return; }
    setVal(box, addr);
    await sleep(200);
    submit(box, /continue with email|^continue$|send (me )?(a )?(code|link)|^next$|log ?in|sign ?in/i);
    state('code', 'ALTS typed your Gmail. Waiting for Claude to send the code...');
    for (let i = 0; i < 60; i++) {
      await sleep(250);
      if (codeBoxes().length) { state('code', 'Claude sent the code. Type it here.'); return; }
      const err = [...document.querySelectorAll('[role=alert], [aria-live]')].map(e => e.textContent.trim()).find(Boolean);
      if (err && i > 8) { state('code', 'Claude says: ' + err.slice(0, 160)); return; }
    }
    state('code', 'Check Gmail for the code. If the PC shows a checkbox (are you human), click it on the PC.');
  }

  async function code(c) {
    let boxes = [];
    for (let i = 0; i < 20 && !(boxes = codeBoxes()).length; i++) await sleep(250);
    if (!boxes.length) {
      const only = inputs().filter(i => i !== findEmail());
      if (only.length === 1) boxes = only;
    }
    if (!boxes.length) { state('code', 'Couldn’t find the code box on the Claude page. Try the link from the email instead.'); return; }
    if (boxes.length > 1 && boxes.every(b => b.maxLength === 1)) {
      [...c].slice(0, boxes.length).forEach((ch, i) => setVal(boxes[i], ch)); // one box per digit
    } else {
      setVal(boxes[0], c);
    }
    await sleep(250);
    submit(boxes[boxes.length - 1], /verify|confirm|continue|sign ?in|log ?in|submit|^next$/i);
    state('wait', 'ALTS typed the code. Signing in...');
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      if (!onLogin()) return; // the path watcher below reports "done"
    }
    const err = [...document.querySelectorAll('[role=alert], [aria-live]')].map(e => e.textContent.trim()).find(Boolean);
    state('code', err ? 'Claude says: ' + err.slice(0, 160) : 'Still on the sign-in page. Check the code and try again.');
  }

  window.__altsPhone = { qr: showQR, email, code };

  // ---------- watch the page (Claude moves between pages without reloading) ----------
  let wasLogin = null;
  function tick() {
    const now = onLogin();
    if (now !== wasLogin) {
      if (now) { hidden = false; send({ t: 'phone-login' }); }
      else {
        if (card) { card.remove(); card = null; }
        send({ t: 'phone-left' }); // ALTS only cares when a phone sign-in was going on
      }
      wasLogin = now;
    }
  }
  const start = () => { tick(); setInterval(tick, 1000); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
