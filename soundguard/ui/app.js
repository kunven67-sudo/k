'use strict';
// SoundGuard window: talks to the SoundGuard engine on 127.0.0.1.

let T = new URLSearchParams(location.search).get('t');
try {
  if (T) sessionStorage.setItem('sgt', T); else T = sessionStorage.getItem('sgt');
} catch (e) {}
history.replaceState(null, '', '/');

const $ = (id) => document.getElementById(id);
const api = async (p, body) => {
  const r = await fetch(p, {
    method: body ? 'POST' : 'GET',
    headers: { 'X-SG-Token': T || '', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
};
const doCmd = (cmd, extra) => api('/api/do', Object.assign({ cmd }, extra || {}));
const pct = (v) => Math.round((v || 0) * 100);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let S = null; // last state
let live = { o: 0, i: 0, s: [] };

/* ---------- nav ---------- */
document.querySelectorAll('.nav').forEach((b) => b.addEventListener('click', () => showPage(b.dataset.p)));
function showPage(p) {
  document.querySelectorAll('.nav').forEach((x) => x.classList.toggle('on', x.dataset.p === p));
  document.querySelectorAll('.page').forEach((x) => x.classList.toggle('show', x.id === 'p-' + p));
  if (p === 'log') { $('logDot').classList.add('hidden'); seenLog = S && S.log.length ? S.log[0].t : seenLog; }
}

/* ---------- toast + modal ---------- */
let toastT;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.remove('hidden');
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), 3200);
}
function ask(title, text, yes) {
  return new Promise((res) => {
    $('mTitle').textContent = title; $('mText').textContent = text; $('mYes').textContent = yes || 'Yes';
    $('modal').classList.remove('hidden');
    const done = (v) => { $('modal').classList.add('hidden'); $('mYes').onclick = $('mNo').onclick = null; res(v); };
    $('mYes').onclick = () => done(true); $('mNo').onclick = () => done(false);
  });
}

/* ---------- ring (60 lights around the shield) ---------- */
const SEGS = 60;
(function buildRing() {
  const g = $('segs');
  let h = '';
  for (let i = 0; i < SEGS; i++) {
    const a = (i / SEGS) * 360;
    h += `<rect class="seg" x="146.5" y="14" width="7" height="22" rx="3.5" transform="rotate(${a} 150 150)"/>`;
  }
  g.innerHTML = h;
})();
const segEls = Array.from(document.querySelectorAll('.seg'));
let litNow = -1;

/* ---------- LED bars + waveform ---------- */
function buildLeds(el, n) { el.innerHTML = '<i></i>'.repeat(n); return Array.from(el.children); }
const oLeds = buildLeds($('oLeds'), 28), iLeds = buildLeds($('iLeds'), 28);
function setLeds(els, v) {
  const n = Math.round(Math.min(1, v * 1.25) * els.length);
  els.forEach((e, k) => {
    const on = k < n;
    if (e._on !== on) { e._on = on; e.className = on ? (k > els.length * .85 ? 'on r' : k > els.length * .65 ? 'on y' : 'on') : ''; }
  });
}

function Wave(canvas) {
  const hist = new Array(140).fill(0);
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0;
  function size() {
    const r = canvas.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    w = Math.max(1, r.width * d); h = Math.max(1, r.height * d);
    canvas.width = w; canvas.height = h;
  }
  return {
    push(v) { hist.push(v); hist.shift(); },
    draw(rgb) {
      if (!w || canvas.width !== Math.round(canvas.getBoundingClientRect().width * (window.devicePixelRatio || 1))) size();
      ctx.clearRect(0, 0, w, h);
      const mid = h * .44, bw = w / hist.length;
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, `rgba(${rgb},0.05)`); grad.addColorStop(.75, `rgba(${rgb},0.55)`); grad.addColorStop(1, `rgba(${rgb},1)`);
      ctx.fillStyle = grad;
      for (let k = 0; k < hist.length; k++) {
        const a = Math.max(1.5, Math.min(1, hist[k] * 1.6) * mid * .95);
        ctx.fillRect(k * bw + bw * .2, mid - a, bw * .6, a * 2);
      }
      ctx.fillStyle = `rgba(${rgb},0.25)`;
      ctx.fillRect(0, mid - .5, w, 1);
    },
  };
}
const oWave = Wave($('oWave')), iWave = Wave($('iWave'));

/* smooth meters: fast up, slow down */
let so = 0, si = 0, lastFrame = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  if (document.hidden || ts - lastFrame < 33) return;
  lastFrame = ts;
  const to = live.o || 0, ti = live.i || 0;
  so = to > so ? so + (to - so) * .6 : so * .86 + to * .14;
  si = ti > si ? si + (ti - si) * .6 : si * .86 + ti * .14;
  const rgb = getComputedStyle(document.body).getPropertyValue('--st-rgb').trim() || '52,240,160';
  oWave.push(so); iWave.push(si);
  oWave.draw(rgb); iWave.draw('120,200,255');
  setLeds(oLeds, so); setLeds(iLeds, si);
  const lit = Math.round(Math.min(1, so * 1.5) * SEGS);
  if (lit !== litNow) {
    for (let k = 0; k < SEGS; k++) {
      const on = k < lit, el = segEls[k];
      if (el._on !== on) { el._on = on; el.classList.toggle('on', on); }
    }
    litNow = lit;
  }
  micVerdict(ti);
}
requestAnimationFrame(frame);

/* ---------- live polling (meters) ---------- */
async function pollLive() {
  if (!document.hidden) {
    try {
      live = await api('/api/live');
      drawSessions();
    } catch (e) {}
  }
  setTimeout(pollLive, 60);
}

let sessKey = '';
function drawSessions() {
  const list = (live.s || []).filter((s) => s.a || s.p > 0.001);
  const key = list.map((s) => s.n).join('|');
  const ul = $('sessions');
  if (key !== sessKey) {
    sessKey = key;
    ul.innerHTML = list.length ? list.map((s) => `<li><span class="nm">${esc(s.n)}</span><span class="bar"><i></i></span></li>`).join('')
      : '<li class="empty">Nothing is making sound</li>';
  }
  const bars = ul.querySelectorAll('.bar i');
  list.forEach((s, k) => { if (bars[k]) bars[k].style.width = Math.min(100, s.p * 160) + '%'; });
}

/* ---------- mic verdict ---------- */
let micMax = 0, micMaxAt = 0, micHeardAt = 0, micStart = 0;
function micVerdict(v) {
  const el = $('iVerdict'), sp = el.querySelector('span');
  const now = Date.now();
  let cls = '', txt = '';
  const inDev = S && S.in;
  if (!inDev || inDev.state !== 'active') {
    cls = 'bad'; txt = inDev && inDev.state === 'disabled' ? 'Mic is turned off in Windows' : 'Mic not plugged in';
    micStart = 0;
  } else if (inDev.muted) {
    cls = 'bad'; txt = 'Mic is muted';
  } else if (!live.listen) {
    cls = ''; txt = 'Checking your mic…';
  } else {
    if (!micStart) micStart = now;
    if (v > micMax || now - micMaxAt > 5000) { micMax = v; micMaxAt = now; }
    if (v > 0.05) micHeardAt = now;
    if (now - micHeardAt < 2500) { cls = 'good'; txt = `Mic works: I can hear you (${pct(micMax)}%)`; }
    else if (micHeardAt) { cls = 'good'; txt = 'Mic works. Talk again to see it'; }
    else if (now - micStart > 8000 && micMax > 0.004) { cls = 'meh'; txt = `Barely hearing anything (${(micMax * 100).toFixed(1)}%). Push the plug in all the way, check the mute switch on the cable`; }
    else { cls = ''; txt = 'Say something to test your mic'; }
  }
  if (el._c !== cls) { el._c = cls; el.className = 'verdict ' + cls; }
  if (sp.textContent !== txt) sp.textContent = txt;
}

/* ---------- state ---------- */
let seenLog = 0, lastStatus = '', dragging = { o: false, i: false };
async function pollState() {
  try {
    S = await api('/api/state');
    render();
  } catch (e) {
    $('headline').textContent = 'SoundGuard stopped';
    $('sub').textContent = 'Close this window and open SoundGuard again.';
    document.body.className = 'st-bad';
  }
  setTimeout(pollState, 1000);
}

const since = (ms) => {
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60);
  return h < 48 ? h + 'h ' + (m % 60) + 'm' : Math.floor(h / 24) + ' days';
};
const clock = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const dayTxt = (t) => {
  const d = new Date(t), n = new Date();
  if (d.toDateString() === n.toDateString()) return 'Today ' + clock(t);
  const y = new Date(n); y.setDate(n.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday ' + clock(t);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + clock(t);
};

function chk(ok, txt, wait) {
  return `<li class="${ok ? 'ok' : wait ? 'wait' : 'no'}"><svg><use href="#i-${ok ? 'ok' : 'x'}"/></svg>${esc(txt)}</li>`;
}
function setHTML(el, h) { if (el._h !== h) { el._h = h; el.innerHTML = h; } }
function setTxt(el, t) { if (el.textContent !== t) el.textContent = t; }

function jackChip(el, dev, plugged, isMic) {
  let cls = 'bad', txt = 'Not found';
  if (dev) {
    if (dev.state === 'disabled') { cls = 'bad'; txt = 'Turned off'; }
    else if (dev.state !== 'active' || !plugged) { cls = 'meh'; txt = 'Not plugged in'; }
    else { cls = 'good'; txt = dev.bus && dev.bus.toUpperCase() === 'USB' ? 'USB, plugged in' : 'Plugged in'; }
    const j = (dev.jacks || []).find((x) => x.plugged && x.where === 'front') || (dev.jacks || []).find((x) => x.plugged);
    if (j && j.where && cls === 'good') txt = `${j.where === 'front' ? 'Front' : 'Back'} jack`;
  }
  el.className = 'chip ' + cls;
  setHTML(el, `<i></i>${esc(txt)}`);
}

function setRange(r, v) { r.value = v; r.style.setProperty('--v', v + '%'); }

function render() {
  const s = S;
  // status colors
  const st = 'st-' + s.status;
  if (!document.body.classList.contains(st)) {
    document.body.className = st;
    const m = $('coreMark');
    $('markPath').setAttribute('d', s.status === 'ok' ? 'm8 12.3 2.8 2.8L16.2 9.6' : 'M12 8v4.6M12 15.6v.2');
    m.classList.remove('draw'); void m.getBoundingClientRect(); m.classList.add('draw');
  }
  setTxt($('headline'), s.headline);
  setTxt($('sub'), s.sub);
  setTxt($('ver'), 'v' + s.v);
  setTxt($('sFix'), String(s.fixesToday));
  setTxt($('sFixL'), s.fixesToday === 1 ? 'fix today' : 'fixes today');
  setTxt($('sEngine'), { ok: 'Moving', busy: 'In use', stuck: 'Stuck' }[s.engine] || 'Checking');
  setTxt($('sUp'), since(s.now - s.since));
  setTxt($('guardTxt'), s.pausedUntil ? 'Paused till ' + clock(s.pausedUntil) : s.status === 'bad' ? 'Needs you' : 'Guarding');

  // alert
  const al = (s.alerts || [])[0];
  $('alertBox').classList.toggle('hidden', !al);
  if (al) { setTxt($('alertTitle'), al.title); setTxt($('alertText'), al.text); }

  // headphones
  const o = s.out;
  setTxt($('oName'), o ? o.name + (o.adapter ? ' · ' + o.adapter : '') : 'No headphones found');
  jackChip($('oJack'), o, s.outPlugged, false);
  if (o && !dragging.o && o.volume >= 0) { setRange($('oVol'), pct(o.volume)); setTxt($('oVolT'), pct(o.volume) + '%'); }
  $('oMute').classList.toggle('muted', !!(o && o.muted));
  $('oMute').querySelector('use').setAttribute('href', o && o.muted ? '#i-mute' : '#i-vol');
  setHTML($('oChecks'), o ? [
    chk(s.outPlugged, s.outPlugged ? 'Plugged in' : 'Not plugged in'),
    chk(o.defMain && o.defComm, o.defMain && o.defComm ? 'Used for games, apps + calls' : 'Not the main sound device', s.settings.keepDefault),
    chk(!o.muted, o.muted ? 'Muted' : 'Not muted'),
    chk(o.volume > 0.03, 'Volume ' + pct(o.volume) + '%'),
    chk(s.engine !== 'stuck', s.engine === 'stuck' ? 'Driver stuck' : 'Sound reaches them', !s.engine),
    chk(!(s.services && s.services.Audiosrv === 'stopped'), 'Windows Audio on'),
  ].join('') : '');

  // mic
  const i = s.in;
  setTxt($('iName'), i ? i.name + (i.adapter ? ' · ' + i.adapter : '') : 'No mic found');
  jackChip($('iJack'), i, s.inPlugged, true);
  if (i && !dragging.i && i.volume >= 0) { setRange($('iVol'), pct(i.volume)); setTxt($('iVolT'), pct(i.volume) + '%'); }
  $('iMute').classList.toggle('muted', !!(i && i.muted));
  setHTML($('iChecks'), i ? [
    chk(s.inPlugged, s.inPlugged ? 'Plugged in' : 'Not plugged in'),
    chk(i.defMain && i.defComm, i.defMain && i.defComm ? 'Used by apps + Discord' : 'Not the main mic', s.settings.keepDefault),
    chk(!i.muted, i.muted ? 'Muted' : 'Not muted'),
    chk(i.volume >= s.settings.micLevel - 0.16, 'Mic level ' + pct(i.volume) + '%'),
    chk(s.privacyOK, s.privacyOK ? 'Windows lets apps use it' : 'Blocked in Windows privacy'),
  ].join('') : '');

  // activity
  const tl = s.log.map((e) => `<li class="${e.kind}"><div class="tl-top"><span class="tag">${{ fix: 'FIXED', problem: 'PROBLEM', info: 'NOTE' }[e.kind] || 'NOTE'}</span><span class="when">${dayTxt(e.t)}</span></div><div class="what">${esc(e.what)}</div>${e.did ? `<div class="did">${esc(e.did)}</div>` : ''}</li>`).join('');
  setHTML($('timeline'), tl || '<li class="empty">Nothing yet. I\'ll write here every time I fix something.</li>');
  if (s.log.length && s.log[0].t > seenLog && seenLog && !$('p-log').classList.contains('show')) $('logDot').classList.remove('hidden');
  if (!seenLog && s.log.length) seenLog = s.log[0].t;

  // fix for good
  setTxt($('drvName'), s.driver || 'Realtek driver');
  const newest = /6\.0\.1\.6122/.test(s.driver || '');
  setTxt($('drvTxt'), newest
    ? 'This 2017 driver is already the newest one there is for this PC: Dell\'s driver pack and Microsoft\'s driver catalog both stop at 6.0.1.6122. So there\'s no newer Realtek driver to install. The USB adapter is the real way around it.'
    : 'This is the sound driver Windows is using for your headphone jack.');
  const issues = s.drivers || [];
  setHTML($('drvChecks'), [
    chk(!issues.length, issues.length ? 'Needs a PC restart' : 'Working right now'),
    chk(s.engine !== 'stuck', s.engine === 'stuck' ? 'Stuck' : 'Not stuck'),
  ].join(''));
  const usb = $('usbChip');
  usb.className = 'chip ' + (s.usb ? 'good' : '');
  setHTML(usb, s.usb ? '<i></i>' + esc(s.usb) + ' in use' : 'Not plugged in');

  // settings
  document.querySelectorAll('[data-s]').forEach((c) => { c.checked = !!s.settings[c.dataset.s]; });
  $('startup').checked = !!s.startup;
  $('startup').disabled = !s.installed;
  if (document.activeElement !== $('micLevel')) { setRange($('micLevel'), pct(s.settings.micLevel)); setTxt($('micLevelT'), pct(s.settings.micLevel) + '%'); }
  fillPick($('pickOut'), s.devices.filter((d) => d.out), s.settings.outId);
  fillPick($('pickIn'), s.devices.filter((d) => !d.out && !/stereo mix/i.test(d.name)), s.settings.inId);
  setTxt($('pauseBtn'), s.pausedUntil ? 'Turn fixes back on' : 'Pause fixes for 1 hour');
  setTxt($('rights'), s.admin ? 'Running with full rights. Starts with Windows by itself.' : 'Running without full rights: open SoundGuard again and press Yes so it can restart Windows Audio and start with Windows.');
  $('restartAudio').disabled = !s.admin;
}

function fillPick(sel, devs, cur) {
  if (document.activeElement === sel) return;
  const h = '<option value="">Auto (best one)</option>' + devs.map((d) => `<option value="${esc(d.id)}">${esc(d.name)}${d.adapter ? ' · ' + esc(d.adapter) : ''}${d.state !== 'active' ? ' (' + d.state + ')' : ''}</option>`).join('');
  setHTML(sel, h);
  sel.value = cur || '';
}

/* ---------- controls ---------- */
function volSlider(rangeId, numId, key) {
  const r = $(rangeId);
  r.addEventListener('input', () => {
    dragging[key] = true;
    r.style.setProperty('--v', r.value + '%');
    $(numId).textContent = r.value + '%';
    clearTimeout(r._t);
    r._t = setTimeout(() => {
      const dev = key === 'o' ? S.out : S.in;
      if (dev) doCmd('volume', { id: dev.id, v: r.value / 100 });
    }, 60);
  });
  r.addEventListener('change', () => setTimeout(() => { dragging[key] = false; }, 1200));
}
volSlider('oVol', 'oVolT', 'o');
volSlider('iVol', 'iVolT', 'i');

$('oMute').addEventListener('click', async () => {
  if (!S || !S.out) return;
  await doCmd('mute', { id: S.out.id, on: !S.out.muted });
  toast(S.out.muted ? 'Headphones unmuted' : 'Headphones muted. I won\'t undo it for 1 hour');
});
$('iMute').addEventListener('click', async () => {
  if (!S || !S.in) return;
  await doCmd('mute', { id: S.in.id, on: !S.in.muted });
  toast(S.in.muted ? 'Mic unmuted' : 'Mic muted. I won\'t undo it for 1 hour');
});

$('testBtn').addEventListener('click', async () => {
  const b = $('testBtn');
  b.disabled = true;
  $('heard').classList.add('hidden');
  $('testMsg').textContent = '';
  let max = 0, err = '';
  for (const side of ['left', 'right']) {
    const el = side === 'left' ? $('tL') : $('tR');
    el.classList.add('lit');
    try {
      const r = await doCmd('test', { side });
      if (r.error) err = r.error; else max = Math.max(max, r.res.peak);
    } catch (e) { err = 'SoundGuard didn\'t answer'; }
    el.classList.remove('lit');
    if (err) break;
  }
  b.disabled = false;
  if (err) { $('testMsg').textContent = 'Couldn\'t play it: ' + err; return; }
  if (max <= 0.0005) {
    $('testMsg').textContent = 'Windows didn\'t send any sound to your headphones. I\'m checking the sound engine now.';
    return;
  }
  $('testMsg').textContent = `Windows sent the sound to your headphones (${pct(max)}% loud).`;
  $('heard').classList.remove('hidden');
});
document.querySelectorAll('[data-h]').forEach((b) => b.addEventListener('click', () => {
  const k = b.dataset.h;
  doCmd('heard', { key: k });
  $('heard').classList.add('hidden');
  $('testMsg').textContent = {
    both: 'Your headphones work.',
    one: 'Only one side = the plug is half in, or the cable is broken near the plug. Push it all the way in and wiggle it while you test again.',
    none: 'Windows is sending sound, so it\'s the plug or the headphones: push the plug all the way into the front jack, check the volume wheel on the headphones, or try the green jack on the back.',
  }[k];
}));

$('fixNow').addEventListener('click', async () => {
  $('fixNow').disabled = true;
  await doCmd('fixnow');
  $('fixNow').disabled = false;
  toast('Checked everything and fixed what I could');
  pollStateOnce();
});
async function pollStateOnce() { try { S = await api('/api/state'); render(); } catch (e) {} }

$('alertLater').addEventListener('click', async () => { await doCmd('later'); toast('OK. I\'ll remind you in 30 minutes'); pollStateOnce(); });
$('alertRestart').addEventListener('click', async () => {
  if (await ask('Restart your PC?', 'Your PC restarts in 20 seconds. Save your stuff first. This unsticks the sound driver.', 'Restart')) {
    await doCmd('restartPC');
    toast('Restarting in 20 seconds');
  }
});

document.querySelectorAll('[data-s]').forEach((c) => c.addEventListener('change', async () => {
  await doCmd('settings', { set: { [c.dataset.s]: c.checked } });
  pollStateOnce();
}));
$('startup').addEventListener('change', async () => {
  const r = await doCmd('startup', { on: $('startup').checked });
  if (r.error) toast(r.error);
  pollStateOnce();
});
$('micLevel').addEventListener('input', () => { const r = $('micLevel'); r.style.setProperty('--v', r.value + '%'); $('micLevelT').textContent = r.value + '%'; });
$('micLevel').addEventListener('change', async () => { await doCmd('settings', { set: { micLevel: $('micLevel').value / 100 } }); pollStateOnce(); });
$('pickOut').addEventListener('change', async () => { await doCmd('pick', { key: 'out', id: $('pickOut').value }); $('pickOut').blur(); toast('Headphones picked'); });
$('pickIn').addEventListener('change', async () => { await doCmd('pick', { key: 'in', id: $('pickIn').value }); $('pickIn').blur(); toast('Mic picked'); });
$('pauseBtn').addEventListener('click', async () => { await doCmd('pause', { on: !(S && S.pausedUntil) }); pollStateOnce(); });
$('restartAudio').addEventListener('click', async () => {
  if (!(await ask('Restart Windows Audio?', 'All sound cuts out for about 2 seconds, then comes back. Games keep running.', 'Restart it'))) return;
  $('restartAudio').disabled = true;
  const r = await doCmd('restartAudio');
  $('restartAudio').disabled = false;
  toast(r.error ? 'Couldn\'t: ' + r.error : 'Windows Audio restarted');
});
$('removeBtn').addEventListener('click', async () => {
  if (!(await ask('Remove SoundGuard?', 'It stops guarding your sound and won\'t start with Windows anymore. Your sound settings stay how they are.', 'Remove'))) return;
  const r = await doCmd('uninstall');
  toast(r.error ? 'Couldn\'t: ' + r.error : 'SoundGuard removed');
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('mNo').click(); });

pollState();
pollLive();
