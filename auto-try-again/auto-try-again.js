// Auto "Try again" clicker 😴
// Paste this into the browser console (F12 -> Console) on the tab that shows
// the "Try again" button, then leave that tab open while you sleep.
// It waits until the reset time it finds on the page (e.g. "resets at 1 PM"),
// then clicks "Try again". If it can't find a time, it just tries every few minutes.
(() => {
  if (window.__autoTryAgain) { window.__autoTryAgain.stop(); }

  const CHECK_EVERY_MS = 30 * 1000;        // look at the page every 30 seconds
  const FALLBACK_RETRY_MS = 5 * 60 * 1000; // no time found? click at most every 5 min
  const MAX_CLICKS = 50;                   // safety cap so it never goes wild
  const BUTTON_TEXT = /^\s*(try again|retry)\s*$/i;

  let clicks = 0;
  let lastClick = 0;

  const badge = document.createElement('div');
  badge.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:2147483647;' +
    'background:#111;color:#fff;font:13px system-ui,sans-serif;padding:8px 12px;' +
    'border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.4);cursor:pointer;max-width:280px';
  badge.title = 'Click to stop';
  document.body.appendChild(badge);
  const say = (msg) => { badge.textContent = '😴 Auto try-again: ' + msg + ' (click to stop)'; };

  function findButton() {
    return [...document.querySelectorAll('button, a, [role="button"]')]
      .find((el) => BUTTON_TEXT.test(el.textContent || '') && !el.disabled);
  }

  // Finds things like "1 PM", "1:00 pm", "13:00" next to words like reset/until/at.
  function findResetTime() {
    const text = document.body.innerText || '';
    const m = text.match(/(?:reset|resets|until|after|at)[^\d]{0,20}(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const ap = (m[3] || '').toLowerCase().replace(/\./g, '');
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    if (h > 23 || min > 59) return null;
    const t = new Date();
    t.setHours(h, min, 0, 0);
    // If that time passed more than 12h ago, the page means tomorrow (e.g. 10 PM now, "resets at 2 AM").
    if (t.getTime() < Date.now() - 12 * 60 * 60 * 1000) t.setDate(t.getDate() + 1);
    return t;
  }

  function tick() {
    if (clicks >= MAX_CLICKS) { say('hit the ' + MAX_CLICKS + '-click cap, stopped'); return stop(); }
    const btn = findButton();
    if (!btn) { say('waiting… no "Try again" button right now'); return; }

    const reset = findResetTime();
    const now = Date.now();
    if (reset && now < reset.getTime() + 30 * 1000) {
      say('will click at ' + reset.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
      return;
    }
    if (now - lastClick < FALLBACK_RETRY_MS) {
      say('clicked ' + clicks + 'x, next try in ' + Math.ceil((FALLBACK_RETRY_MS - (now - lastClick)) / 60000) + ' min');
      return;
    }
    btn.click();
    clicks++;
    lastClick = now;
    say('clicked "Try again" 🎉 (' + clicks + 'x)');
    console.log('[auto-try-again] clicked at', new Date().toLocaleTimeString());
  }

  const timer = setInterval(tick, CHECK_EVERY_MS);
  function stop() { clearInterval(timer); badge.remove(); delete window.__autoTryAgain; }
  badge.onclick = stop;
  window.__autoTryAgain = { stop };
  tick();
})();
