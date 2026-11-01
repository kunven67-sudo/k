/* ALTS for phone: the shell around the PC app's page code (page.js runs right after this).
   page.js talks to "ALTS" with window.chrome.webview.postMessage; on the phone this answers it:
   usage -> the orange pill at the top (5-hour + week, like the PC app's bars), count -> messages / words,
   save -> Download/ALTS (through the app). Tap the pill: Save this chat, Top, Bottom. */
(function () {
  if (location.hostname !== 'claude.ai' || window.__altsPhone) return;
  window.__altsPhone = true;
  let usage = null, count = null, open = false;
  window.chrome = window.chrome || {};
  window.chrome.webview = { postMessage: function (s) { let m = null; try { m = JSON.parse(s); } catch (e) { return; } onMsg(m); } };
  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = '<style>' +
    ':host{all:initial}*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
    '.pill{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:2147483600;display:flex;align-items:center;gap:8px;padding:5px 12px;border-radius:99px;background:rgba(30,30,32,.92);color:#fff;font-size:12px;font-weight:600;box-shadow:0 4px 14px rgba(0,0,0,.3);-webkit-tap-highlight-color:transparent}' +
    '.dot{width:8px;height:8px;border-radius:50%;background:#d97757}' +
    '.mini{width:34px;height:5px;border-radius:3px;background:rgba(255,255,255,.22);overflow:hidden}.mini i{display:block;height:100%;background:#d97757}' +
    '.sheet{position:fixed;left:0;right:0;bottom:0;z-index:2147483601;background:#1f1f22;color:#fff;border-radius:18px 18px 0 0;padding:18px 18px 26px;transform:translateY(105%);transition:transform .22s ease;box-shadow:0 -10px 30px rgba(0,0,0,.4)}' +
    '.sheet.on{transform:none}.h{font-size:17px;font-weight:700;margin-bottom:12px;display:flex;justify-content:space-between}.h small{font-weight:500;color:#aaa;font-size:12px}' +
    '.u{margin:10px 0}.u b{display:flex;justify-content:space-between;font-size:14px;font-weight:600}.u span{color:#aaa;font-size:12px;font-weight:500}' +
    '.bar{margin-top:6px;height:8px;border-radius:4px;background:rgba(255,255,255,.14);overflow:hidden}.bar i{display:block;height:100%;background:#d97757;border-radius:4px}' +
    '.btns{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:16px}.btns button{height:44px;border:0;border-radius:12px;background:#2e2e33;color:#fff;font-size:14px;font-weight:600}' +
    '.btns button.big{grid-column:1/-1;background:#d97757}.toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:2147483602;background:#2e2e33;color:#fff;padding:10px 16px;border-radius:12px;font-size:14px;opacity:0;transition:opacity .2s}.toast.on{opacity:1}' +
    '</style><div class="pill"><span class="dot"></span><span class="t">ALTS</span></div>' +
    '<div class="sheet"><div class="h">ALTS<small class="c"></small></div><div class="us"></div>' +
    '<div class="btns"><button class="big" data-a="save">Save this chat</button><button data-a="top">Top</button><button data-a="bottom">Bottom</button><button data-a="close">Close</button></div></div><div class="toast"></div>';
  const pill = root.querySelector('.pill'), sheet = root.querySelector('.sheet'), toastEl = root.querySelector('.toast');
  function attach() { if (!document.body) { setTimeout(attach, 100); return; } if (!host.isConnected) document.body.appendChild(host); }
  attach();
  setInterval(attach, 1500);
  function pct(v) { return v < 0 ? null : Math.round(v); }
  function when(iso) { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return ''; return 'resets ' + d.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }); }
  function paint() {
    const s = usage ? pct(usage.s) : null, w = usage ? pct(usage.w) : null;
    root.querySelector('.t').textContent = usage ? '5h ' + (s == null ? '-' : s + '%') + '  ·  Week ' + (w == null ? '-' : w + '%') : 'ALTS';
    const us = root.querySelector('.us');
    us.innerHTML = '';
    [['5-hour limit', s, usage && usage.sr], ['Weekly limit', w, usage && usage.wr]].forEach(function (x) {
      const d = document.createElement('div'); d.className = 'u';
      d.innerHTML = '<b><em style="font-style:normal"></em><span></span></b><div class="bar"><i></i></div>';
      d.querySelector('em').textContent = x[0] + ': ' + (x[1] == null ? 'not known yet' : x[1] + '%');
      d.querySelector('span').textContent = when(x[2]);
      d.querySelector('i').style.width = (x[1] || 0) + '%';
      us.appendChild(d);
    });
    root.querySelector('.c').textContent = count ? count.msgs + ' messages · ' + count.words.toLocaleString() + ' words' : '';
  }
  function toast(t) { toastEl.textContent = t; toastEl.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.classList.remove('on'); }, 2200); }
  function stamp() { const d = new Date(), z = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + '-' + z(d.getMinutes()); }
  function onMsg(m) {
    if (!m) return;
    if (m.t === 'usage') { usage = m; paint(); }
    else if (m.t === 'count') { count = m; paint(); }
    else if (m.t === 'save') {
      const name = String(m.title || 'Claude chat').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) + ' ' + stamp();
      let ok = false;
      try { ok = window.AltsPhone.save(name + '.html', m.html || ''); if (m.md) window.AltsPhone.save(name + '.md', m.md); } catch (e) { ok = false; }
      toast(ok ? 'Saved to Download/ALTS' : 'Couldn\'t save it');
    }
  }
  pill.addEventListener('click', function () { open = !open; sheet.classList.toggle('on', open); paint(); });
  root.querySelector('.btns').addEventListener('click', function (e) {
    const a = e.target && e.target.dataset && e.target.dataset.a;
    if (!a) return;
    if (a === 'close') { open = false; sheet.classList.remove('on'); return; }
    try {
      if (a === 'save') { toast('Saving...'); window.__alts.save({ why: 'save' }); }
      if (a === 'top' || a === 'bottom') window.__alts.jump(a);
    } catch (err) { toast('Not ready yet, try again in a second'); }
    open = false; sheet.classList.remove('on');
  });
})();
