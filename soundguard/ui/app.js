'use strict';
// SOUNDGUARD window. Talks to the SOUNDGUARD background app over 127.0.0.1 with a secret token.

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const VIEW = qs.get('view') || 'main';
let TOKEN = '';
{
  const m = /(?:^#|&)t=([0-9a-f]+)/.exec(location.hash);
  if (m) { TOKEN = m[1]; try { sessionStorage.setItem('sgt', TOKEN); } catch (e) {} history.replaceState(null, '', location.pathname + location.search); }
  else { try { TOKEN = sessionStorage.getItem('sgt') || ''; } catch (e) {} }
}

function post(msg) { try { window.chrome.webview.postMessage(msg); } catch (e) {} }

async function api(path, body) {
  const opt = { headers: { 'X-SG-Token': TOKEN }, cache: 'no-store' };
  if (body) { opt.method = 'POST'; opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  const r = await fetch('/api/' + path, opt);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

let S = null;          // last state
let fastUntil = 0;     // poll faster right after a click
let ready = false;
const live = { out: 0, in: 0, outShow: 0, inShow: 0, outHeard: 0, inHeard: 0 };

async function act(a, extra) {
  fastUntil = Date.now() + 4000;
  try {
    const r = await api('do', Object.assign({ act: a }, extra || {}));
    if (!r.ok && r.error) toast(r.error);
    setTimeout(poll, 150);
    return r;
  } catch (e) { toast('SOUNDGUARD stopped answering. Close this window and open it again.'); return { ok: false }; }
}

function toast(t) {
  const el = $('toast'); el.textContent = t; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 4200);
}

// ---------- polling ----------
let polling = false;
async function poll() {
  if (polling) return; polling = true;
  try { S = await api('state'); render(); }
  catch (e) { if (VIEW === 'popup') post('close'); }
  finally { polling = false; }
}
function loop() { poll(); setTimeout(loop, Date.now() < fastUntil ? 300 : 1000); }

async function livePoll() {
  if (VIEW === 'main' && S && S.mode !== 'setup' && !document.hidden) {
    try { const r = await api('live'); live.out = r.out; live.in = r.in; } catch (e) {}
    if (dev3d) dev3d.setLevels(live.out, S.micTest && S.micTest.running && S.micTest.phase === 'record' ? Math.max(S.micTest.level || 0, live.in) : live.in);
  }
  setTimeout(livePoll, 66);
}

// ---------- helpers ----------
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (v) => Math.round((v || 0) * 100);
function lvl01(peak) { // amplitude -> 0..1 on a -60..0 dB scale (quiet mics still show up)
  if (!peak || peak <= 0.001) return 0;
  const db = 20 * Math.log10(peak);
  return Math.max(0, Math.min(1, (db + 60) / 60));
}
function fmtTime(ms) {
  const d = new Date(ms), now = new Date();
  const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return t;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + t;
}
function icon(id) { return `<svg><use href="#${id}"/></svg>`; }
function chip(cls, txt) { return `<span class="chip ${cls}"><i></i>${esc(txt)}</span>`; }
function setHTML(el, html) { if (el._h !== html) { el.innerHTML = html; el._h = html; } }

// ---------- render ----------
let lastTitle = '';
function render() {
  if (!S) return;
  if (S.mode === 'setup') return renderSetup();
  if (VIEW === 'popup') return renderPopup();
  const st = S.status || { level: 'ok', title: '', sub: '' };
  document.body.className = 'lvl-' + st.level + (VIEW === 'popup' ? ' view-popup' : '') + (has3d ? ' has3d' : '');
  $('ver').textContent = 'v' + S.version + (S.mode === 'demo' ? ' preview' : '');
  if (st.title !== lastTitle) {
    const h = $('title'); h.textContent = st.title; h.classList.remove('swap'); void h.offsetWidth; h.classList.add('swap');
    lastTitle = st.title;
  }
  $('sub').textContent = st.sub;
  $('kicker').textContent = { ok: 'WATCHING', warn: 'HEADS UP', bad: 'NEEDS YOU', fixing: 'FIXING' }[st.level] || 'WATCHING';
  const auto = S.settings && S.settings.autoFix;
  $('watchPill').classList.toggle('off', !auto);
  $('watchTxt').textContent = auto ? 'Auto-fix on' : 'Auto-fix off';
  renderAlert();
  feed3D(st);
  renderOut();
  renderIn();
  renderEvents();
  renderForever();
  renderSettings();
  if (!ready) { ready = true; document.body.classList.remove('booting'); post('ready'); boot3D('dev3d', 'rack'); }
}

function renderAlert() {
  const el = $('alert');
  let html = '', cls = '';
  if (S.needRestart) {
    cls = 'bad';
    html = `<div class="a-ic">${icon('i-restart')}</div><div class="a-txt"><b>Your sound driver is stuck.</b> Only a PC restart fixes it. Do it when you're done playing. I'll never restart by myself.</div>
      <div class="a-btns"><button class="btn danger" data-act="restartNow">Restart now</button>${S.tv ? `<button class="btn" data-act="useTV">${icon('i-tv')}<span>Use TV sound</span></button>` : ''}</div>`;
  } else if (S.micMissing) {
    cls = 'warn';
    html = `<svg class="plug-anim" viewBox="0 0 92 34"><rect x="56" y="7" width="34" height="20" rx="4" fill="#1a2028" stroke="#3a4552"/><circle cx="62" cy="17" r="4.5" fill="#0a0d10" stroke="#ffb648" stroke-width="1.5"/><g class="plug"><rect x="2" y="12" width="30" height="10" rx="3" fill="#cfd6de"/><rect x="32" y="15" width="28" height="4" rx="1.5" fill="#e9eef2"/><rect x="40" y="15" width="2" height="4" fill="#7b8794"/><rect x="47" y="15" width="2" height="4" fill="#7b8794"/><rect x="53" y="15" width="2" height="4" fill="#7b8794"/></g></svg>
      <div class="a-txt"><b>Your mic isn't detected.</b> Pull the headphone plug out and push it <b>all the way</b> back in, until it clicks.</div>`;
  } else if (S.micBlocked) {
    cls = 'warn';
    html = `<div class="a-ic">${icon('i-warn')}</div><div class="a-txt"><b>Windows is blocking apps from your mic.</b> Press Fix now and I'll turn it back on.</div>`;
  }
  if (!html) { el.hidden = true; el._h = ''; return; }
  el.className = 'alert ' + cls; el.hidden = false; setHTML(el, html);
}

const OUT_IC = { muted: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m16 9.5 5 5m0-5-5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  on: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' };
const IN_IC = { muted: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M4 4l16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  on: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' };

function renderOut() {
  const d = S.out;
  let nm = d ? d.name : 'No sound device', ad = d ? d.adapter : 'Plug your headphones in all the way';
  if (d && d.jackKnown && d.jackIn && /headphone/i.test(d.name)) { nm = 'Headphones'; ad = d.adapter + (d.front ? ' · front jack' : ' · back jack'); }
  else if (d && d.bus === 'usb') { nm = 'USB headphones'; }
  $('outName').textContent = nm; $('outName').title = d ? d.name : '';
  $('outAdapter').textContent = ad;
  const c = [];
  if (d) {
    if (S.outFrozen) c.push(chip('bad', 'FROZEN'));
    else if (live.outHeard > Date.now() - 2500) c.push(chip('ok', 'SOUND FLOWING'));
    if (d.muted) c.push(chip('bad', 'MUTED'));
    if (d.jackKnown) c.push(d.jackIn ? chip('ok', 'PLUGGED IN') : chip('warn', 'NOTHING IN THE JACK'));
    if (d.bus === 'usb') c.push(chip('ok', 'USB ADAPTER'));
    if (d.bus === 'hdmi' || d.form === 9) c.push(chip('', 'TV / HDMI'));
    if (S.outComm && S.outComm.id !== d.id) c.push(chip('warn', 'CALLS → ' + S.outComm.name.toUpperCase()));
  } else c.push(chip('bad', 'NOTHING FOUND'));
  setHTML($('outChips'), c.join(''));
  vol('out', d);
  renderSoundTest();
}

function renderIn() {
  const d = S.in;
  $('inName').textContent = d ? d.name : (S.micMissing ? 'Mic not detected' : 'No mic');
  $('inAdapter').textContent = d ? d.adapter : 'Push the plug all the way in';
  const c = [];
  if (S.micMissing) c.push(chip('bad', 'NOT DETECTED'));
  if (S.micBlocked) c.push(chip('bad', 'BLOCKED BY WINDOWS'));
  if (d) {
    if (d.muted) c.push(chip('bad', 'MUTED'));
    else if (live.inHeard > Date.now() - 2500) c.push(chip('ok', 'HEARING YOU'));
    else if (!S.micBlocked) c.push(chip('ok', 'READY'));
    if (d.bus === 'usb') c.push(chip('ok', 'USB ADAPTER'));
    if (S.settings && !S.settings.liveMic) c.push(chip('', 'LIVE LEVEL OFF'));
  } else if (!S.micMissing) c.push(chip('bad', 'NOTHING FOUND'));
  setHTML($('inChips'), c.join(''));
  vol('in', d);
  renderMicTest();
}

const dragging = { out: false, in: false };
function vol(k, d) {
  const r = $(k + 'Vol'), n = $(k + 'VolNum'), m = $(k + 'Mute');
  r.disabled = !d; m.disabled = !d;
  if (!d) { n.textContent = '-'; r.style.setProperty('--p', '0%'); return; }
  if (!dragging[k]) { r.value = pct(d.volume); r.style.setProperty('--p', pct(d.volume) + '%'); n.textContent = pct(d.volume) + '%'; }
  const ic = (k === 'out' ? OUT_IC : IN_IC)[d.muted ? 'muted' : 'on'];
  if (m._ic !== ic) { m.innerHTML = ic; m._ic = ic; }
  m.classList.toggle('muted', !!d.muted);
  m.title = d.muted ? 'Unmute' : 'Mute';
}
for (const k of ['out', 'in']) {
  const r = $(k + 'Vol');
  r.addEventListener('pointerdown', () => { dragging[k] = true; });
  r.addEventListener('input', () => { r.style.setProperty('--p', r.value + '%'); $(k + 'VolNum').textContent = r.value + '%'; });
  r.addEventListener('change', async () => {
    const d = S && S[k]; if (d) await act('volume', { id: d.id, v: r.value / 100 });
    dragging[k] = false;
  });
  r.addEventListener('pointerup', () => setTimeout(() => { dragging[k] = false; }, 600));
  $(k + 'Mute').addEventListener('click', () => { const d = S && S[k]; if (d) act('mute', { id: d.id, on: !d.muted }); });
  $(k + 'Pick').addEventListener('click', () => openPicker(k));
}

function renderSoundTest() {
  const t = S.soundTest || {}, b = $('soundTestBtn'), res = $('soundTestRes');
  b.disabled = !S.out || t.running;
  let h = '';
  if (t.running) h = `<div class="row2"><span class="wave"><i></i><i></i><i></i><i></i><i></i></span> Playing a test sound...</div>`;
  else if (t.done && t.sound) {
    const s = t.sound;
    if (s.error) h = `<span class="bad">${esc(s.error)}</span>`;
    else if (!s.sent) h = `<span class="bad">Windows couldn't send the sound. Fixing it now...</span>`;
    else if (t.answer === 'yes') h = `<span class="good">Your headphones work.</span>`;
    else if (t.answer === 'no') h = `<span class="warn">Windows sent it (${pct(s.peak)}%), so it's the plug or the headphones. Push the plug in all the way, try the green hole on the back, check the volume wheel on the cable.</span>`;
    else h = `<div class="row2">Windows sent it (<b>${pct(s.peak)}%</b>). Did you hear it?
      <button class="btn" data-act="heard" data-on="1">Yes</button><button class="btn" data-act="heard" data-on="0">No</button></div>`;
  }
  setHTML(res, h);
}

function renderMicTest() {
  const t = S.micTest || {}, b = $('micTestBtn'), res = $('micTestRes');
  b.disabled = !S.in || t.running;
  let h = '';
  if (t.running && t.phase === 'record') {
    const left = Math.max(1, 4 - Math.floor((Date.now() - t.at) / 1000));
    h = `<div class="row2"><span class="count">${left}</span> <b>Talk now.</b> Say anything.</div>`;
  } else if (t.running) h = `<div class="row2"><span class="wave"><i></i><i></i><i></i><i></i><i></i></span> Playing it back so you hear yourself...</div>`;
  else if (t.done && t.mic) {
    const m = t.mic;
    if (m.blocked) h = `<span class="bad">Windows blocked the mic (privacy settings). Press Fix now.</span>`;
    else if (m.error) h = `<span class="bad">${esc(m.error)}</span>`;
    else if (m.peak >= 0.05) h = `<span class="good">Your mic works. Loudest: ${pct(m.peak)}%.</span>`;
    else if (m.peak >= 0.008) h = `<span class="warn">Your mic is really quiet (${pct(m.peak)}%). Talk closer, or the mic is going bad.</span>`;
    else h = `<span class="bad">Your mic heard nothing. Check the mute switch on the cable and push the plug all the way in. If that doesn't help, the mic wire is broken.</span>`;
  }
  setHTML(res, h);
}

let evSeen = 0;
function renderEvents() {
  const ev = (S.events || []).slice().reverse();
  const key = ev.length + ':' + (ev[0] ? ev[0].t : 0);
  if ($('events')._k === key) return;
  $('events')._k = key;
  const newest = ev[0] ? ev[0].t : 0;
  $('events').innerHTML = ev.map((e) => `<li class="${esc(e.kind)}${e.t > evSeen && evSeen ? ' fresh' : ''}"><div class="t">${esc(fmtTime(e.t))}</div><div class="x">${esc(e.text)}</div></li>`).join('');
  if (ev[0] && evSeen && ev[0].t > evSeen && (ev[0].kind === 'fix' || ev[0].kind === 'good')) { radar.blip(ev[0].kind); sfx('relay', 0.55); }
  evSeen = Math.max(evSeen, newest) || 1;
  $('eventsEmpty').hidden = ev.length > 0;
  $('logCount').textContent = ev.length ? ev.length + (ev.length === 1 ? ' thing' : ' things') : '';
}

function renderForever() {
  const dr = S.driver || {}, i = dr.info || {};
  $('drvName').textContent = i.name || 'Unknown';
  $('drvVer').textContent = i.version || '-';
  $('drvDate').textContent = i.date || '-';
  $('drvProv').textContent = i.provider || '-';
  const model = (i.model || '').replace(/^Dell Inc\.?\s*/i, '');
  $('drvDell').hidden = !dr.dellNewest;
  $('drvDell').textContent = !dr.dellNewest ? '' : i.version === dr.dellNewest
    ? `Dell's newest sound driver for the ${model} is ${dr.dellNewest}. That's the one you already have, so Dell has nothing newer. Windows Update might.`
    : `Dell's newest sound driver for the ${model} is ${dr.dellNewest}. You have ${i.version || 'something else'}.`;
  const btn = $('drvBtn');
  btn.disabled = dr.checking || dr.installing;
  btn.classList.toggle('spin', !!dr.checking);
  let h = '';
  if (dr.checking) h = 'Asking Windows Update. This can take a minute or two...';
  else if (dr.installing) h = 'Installing the new driver. Your sound can cut out for a few seconds...';
  else if (dr.installed) h = `<span class="good">Installed.</span> ${dr.reboot ? 'Restart your PC when you\'re done playing to finish it.' : ''}`;
  else if (dr.error) h = `<span class="bad">Windows Update said: ${esc(dr.error)}</span>`;
  else if (dr.checked && !(dr.found || []).length) h = `Windows Update has <b>no newer sound driver</b> for your exact PC (checked ${esc(fmtTime(dr.checkedAt))}). The USB adapter below is the real fix.`;
  else if ((dr.found || []).length) h = 'Windows Update has these. Install when you\'re not playing:' + dr.found.map((f) => `<div class="drv-item"><div><b>${esc(f.title)}</b><br><span class="note">${esc(f.version || '')} ${esc(f.date || '')}</span></div><button class="btn primary" data-act="driverInstall" data-id="${esc(f.id)}">Install</button></div>`).join('');
  setHTML($('drvRes'), h);
  const usb = (S.devs || []).find((d) => d.bus === 'usb' && d.state === 'active');
  setHTML($('usbState'), usb ? `<span class="chip ok"><i></i>FOUND: ${esc(usb.name.toUpperCase())} (${esc(usb.adapter.toUpperCase())})</span>` : '<span class="chip"><i></i>NO USB ADAPTER PLUGGED IN RIGHT NOW</span>');
}

function renderSettings() {
  document.querySelectorAll('[data-set]').forEach((el) => {
    if (el._busy) return;
    el.checked = !!(S.settings && S.settings[el.dataset.set]);
  });
  const su = $('swStartup');
  if (!su._busy) su.checked = !!S.startsWithWindows;
  $('aboutLine').textContent = `SOUNDGUARD ${S.version}. Bug log: %LOCALAPPDATA%\\SoundGuard\\debug.log`;
}

document.querySelectorAll('[data-set]').forEach((el) => el.addEventListener('change', async () => {
  el._busy = true; await act('setting', { id: el.dataset.set, on: el.checked }); el._busy = false;
}));
$('swStartup').addEventListener('change', async (e) => {
  const el = e.target; el._busy = true;
  const r = await act('startup', { on: el.checked });
  if (!r.ok) el.checked = !el.checked;
  el._busy = false;
});

// ---------- clicks ----------
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const a = b.dataset.act;
  if (a === 'restartNow') return confirmBox('Restart your PC now?', 'Save your stuff first. The PC restarts in 15 seconds.', () => act('restartNow'));
  if (a === 'heard') return act('heard', { on: b.dataset.on === '1' });
  if (a === 'driverInstall') return confirmBox('Install the new sound driver?', "Do this when you're not playing. Sound can cut out for a few seconds and you'll need a restart after (you pick when).", () => act('driverInstall', { id: b.dataset.id }));
  act(a);
});
$('fixBtn').addEventListener('click', async () => {
  const b = $('fixBtn'); b.classList.add('spin'); b.disabled = true;
  radar.burst();
  await act('fix');
  setTimeout(() => { b.classList.remove('spin'); b.disabled = false; }, 2200);
});
$('soundTestBtn').addEventListener('click', () => act('testSound'));
$('micTestBtn').addEventListener('click', () => act('testMic'));
$('drvBtn').addEventListener('click', () => act('driverCheck'));
$('openSound').addEventListener('click', () => act('openSound'));
$('clearLog').addEventListener('click', () => act('clearLog'));
$('uninstall').addEventListener('click', () => confirmBox('Remove SOUNDGUARD?', 'It stops fixing your sound and won\'t start with Windows anymore.', async () => {
  const r = await act('uninstall'); if (r.ok) toast('Removing SOUNDGUARD... bye bro.');
}));

// tabs
function setTab(t) {
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  for (const p of ['home', 'forever', 'settings']) $('page-' + p).hidden = p !== t;
  moveInk();
}
function moveInk() {
  const b = document.querySelector('#tabs button.on'), ink = $('tabInk');
  if (b) { ink.style.left = b.offsetLeft + 10 + 'px'; ink.style.width = b.offsetWidth - 20 + 'px'; }
}
document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
window.addEventListener('resize', moveInk);

// picker
function openPicker(k) {
  if (!S) return;
  const flow = k === 'out' ? 'out' : 'in';
  const cur = S[k] ? S[k].id : '';
  const list = (S.devs || []).filter((d) => d.flow === flow && d.state === 'active');
  $('pickerTitle').textContent = flow === 'out' ? 'Where should sound go?' : 'Which mic?';
  $('pickerList').innerHTML = list.length ? list.map((d) => `<button class="pick${d.id === cur ? ' cur' : ''}" data-id="${esc(d.id)}">${icon(flow === 'out' ? (d.bus === 'hdmi' || d.form === 9 ? 'i-tv' : 'i-hp') : 'i-mic')}<span>${esc(d.name)}<small>${esc(d.adapter)}${d.id === cur ? ' · in use' : ''}</small></span></button>`).join('') : '<p class="note">Nothing else plugged in.</p>';
  $('picker').hidden = false;
}
$('pickerList').addEventListener('click', (e) => {
  const b = e.target.closest('.pick'); if (!b) return;
  $('picker').hidden = true;
  if (!b.classList.contains('cur')) act('default', { id: b.dataset.id });
});
$('pickerClose').addEventListener('click', () => { $('picker').hidden = true; });
$('picker').addEventListener('click', (e) => { if (e.target === $('picker')) $('picker').hidden = true; });

function confirmBox(title, text, yes) {
  $('confirmTitle').textContent = title; $('confirmText').textContent = text; $('confirm').hidden = false;
  $('confirmYes').onclick = () => { $('confirm').hidden = true; yes(); };
  $('confirmNo').onclick = () => { $('confirm').hidden = true; };
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { $('picker').hidden = true; $('confirm').hidden = true; } });

// ---------- first run ----------
function renderSetup() {
  document.body.className = 'lvl-ok';
  $('app').hidden = true; $('setup').hidden = false;
  const s = S.setup || {};
  if (s.update) {
    $('setupTitle').textContent = `Update SOUNDGUARD from v${s.running} to v${S.version}.`;
    if (!$('installBtn')._busy) $('installTxt').textContent = 'Update SOUNDGUARD';
  }
  if (!ready) { ready = true; post('ready'); boot3D('dev3d2', 'setupRack', true); }
}
$('installBtn').addEventListener('click', async () => {
  const b = $('installBtn'); b._busy = true; b.disabled = true; b.classList.add('spin');
  $('installTxt').textContent = 'Turning on...';
  const r = await act('install');
  if (!r.ok) {
    b._busy = false; b.disabled = false; b.classList.remove('spin');
    $('installTxt').textContent = 'Try again';
    $('setupNote').innerHTML = esc(r.error || 'It didn\'t work.') + ' Press the button again and press <b>Yes</b> when Windows asks.';
  } else $('installTxt').textContent = 'On! Opening...';
});

// ---------- restart popup ----------
function renderPopup() {
  document.body.className = 'view-popup';
  $('popup').hidden = false;
  $('popTV').hidden = !S.tv;
  if (!S.needRestart && ready) { post('close'); return; }
  if (!ready) { ready = true; post('ready'); }
}
async function popDo(a) { await act(a); post('close'); }
$('popRestart').addEventListener('click', () => popDo('restartNow'));
$('popLater').addEventListener('click', () => popDo('restartLater'));
$('popX').addEventListener('click', () => popDo('restartLater'));
$('popTV').addEventListener('click', () => popDo('useTV'));

// ---------- radar + meters (one animation loop) ----------
const radar = (() => {
  const cvs = [$('radar'), $('radar2')];
  let ang = 0, last = performance.now(), blipT = -9, blipA = 0, burstT = -9, blipKind = 'fix';
  const outBars = new Float32Array(72), inBars = new Float32Array(48);
  function css(v) { return getComputedStyle(document.body).getPropertyValue(v).trim() || '#3fe197'; }
  function draw(cv, t, dt) {
    if (!cv || !cv.offsetParent) return;
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 4;
    const st = css('--st'), cyan = css('--cyan'), lime = css('--lime');
    // rings
    c.lineWidth = 1;
    for (const f of [0.98, 0.74, 0.5]) { c.strokeStyle = 'rgba(255,255,255,0.07)'; c.beginPath(); c.arc(cx, cy, R * f, 0, 7); c.stroke(); }
    // ticks
    for (let i = 0; i < 120; i++) {
      const a = i / 120 * Math.PI * 2, long = i % 10 === 0;
      c.strokeStyle = long ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)';
      c.beginPath(); c.moveTo(cx + Math.cos(a) * R * 0.98, cy + Math.sin(a) * R * 0.98);
      c.lineTo(cx + Math.cos(a) * R * (long ? 0.92 : 0.95), cy + Math.sin(a) * R * (long ? 0.92 : 0.95)); c.stroke();
    }
    // sweep
    const bad = document.body.classList.contains('lvl-bad');
    const g = c.createConicGradient ? c.createConicGradient(ang - 1.2, cx, cy) : null;
    if (g) {
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.19, hexA(st, bad ? 0.30 : 0.22)); g.addColorStop(0.191, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, R * 0.97, 0, 7); c.fill();
    }
    c.strokeStyle = hexA(st, 0.9); c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(ang) * R * 0.97, cy + Math.sin(ang) * R * 0.97); c.stroke();
    // output ring (cyan) + mic ring (lime)
    const lo = lvl01(live.outShow), li = lvl01(live.inShow);
    bars(c, outBars, cx, cy, R * 0.76, R * 0.2, lo, cyan, t, 1.7);
    bars(c, inBars, cx, cy, R * 0.52, R * 0.15, li, lime, t, 2.3);
    // fix blip
    const bt = t - blipT;
    if (bt < 1.6) {
      const r = R * (0.3 + bt * 0.55), a = 1 - bt / 1.6;
      c.strokeStyle = hexA(blipKind === 'good' ? css('--green') : cyan, a); c.lineWidth = 2;
      c.beginPath(); c.arc(cx, cy, r, 0, 7); c.stroke();
      c.fillStyle = hexA(st, a); c.beginPath(); c.arc(cx + Math.cos(blipA) * R * 0.86, cy + Math.sin(blipA) * R * 0.86, 4, 0, 7); c.fill();
    }
    const ut = t - burstT;
    if (ut < 1.2) {
      for (let k = 0; k < 3; k++) {
        const p = ut - k * 0.18; if (p < 0 || p > 0.9) continue;
        c.strokeStyle = hexA(st, (0.9 - p) * 0.8); c.lineWidth = 2;
        c.beginPath(); c.arc(cx, cy, R * (0.2 + p * 0.9), 0, 7); c.stroke();
      }
    }
  }
  function bars(c, arr, cx, cy, r0, len, level, col, t, wob) {
    const n = arr.length;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 - Math.PI / 2;
      const target = level > 0 ? level * (0.45 + 0.55 * Math.abs(Math.sin(i * 1.7 + t * wob * 3) * Math.cos(i * 0.6 - t * wob))) : 0;
      arr[i] = Math.max(target, arr[i] * 0.86);
      const l = 2 + arr[i] * len;
      c.strokeStyle = arr[i] > 0.02 ? hexA(col, 0.35 + arr[i] * 0.65) : 'rgba(255,255,255,0.08)';
      c.lineWidth = 2.2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      c.lineTo(cx + Math.cos(a) * (r0 + l), cy + Math.sin(a) * (r0 + l)); c.stroke();
    }
  }
  function hexA(col, a) {
    const m = /^#([0-9a-f]{6})$/i.exec(col.trim());
    if (!m) return col;
    const n = parseInt(m[1], 16);
    return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
  }
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const t = now / 1000;
    const bad = document.body.classList.contains('lvl-bad');
    ang = (ang + dt * (bad ? 2.6 : 1.45)) % (Math.PI * 2);
    live.outShow = Math.max(live.out, live.outShow * 0.9);
    live.inShow = Math.max(live.in, live.inShow * 0.9);
    if (live.out > 0.003) live.outHeard = Date.now();
    if (live.in > 0.03) live.inHeard = Date.now();
    for (const cv of cvs) draw(cv, t, dt);
    meters(t);
    requestAnimationFrame(frame);
  }
  return {
    start() { requestAnimationFrame(frame); },
    blip(kind) { blipT = performance.now() / 1000; blipA = ang; blipKind = kind; },
    burst() { burstT = performance.now() / 1000; },
  };
})();

// LED meters
const SEG = 32;
const meterState = { out: { el: null, peak: 0, peakT: 0 }, in: { el: null, peak: 0, peakT: 0 } };
for (const k of ['out', 'in']) {
  const el = $(k + 'Meter'); el.innerHTML = '<span></span>'.repeat(SEG); meterState[k].el = el;
}
function meters(t) {
  if (VIEW !== 'main' || !S || S.mode === 'setup') return;
  for (const k of ['out', 'in']) {
    const m = meterState[k], segs = m.el.children;
    let v = lvl01(k === 'out' ? live.outShow : (S.micTest && S.micTest.running && S.micTest.phase === 'record' ? Math.max(S.micTest.level, live.inShow) : live.inShow));
    const on = Math.round(v * SEG);
    if (on >= m.peak || t - m.peakT > 1.1) { m.peak = on; m.peakT = t; }
    for (let i = 0; i < SEG; i++) {
      const s = segs[i];
      const want = i < on ? (i >= SEG * 0.95 ? 'on max' : i >= SEG * 0.8 ? 'on hot' : 'on') : (i === m.peak - 1 && m.peak > 1 ? 'peak' : '');
      if (s._c !== want) { s.className = want; s._c = want; }
    }
    m.el.classList.toggle('dead', !S[k]);
  }
}

// ---------- 3D studio unit ----------
let dev3d = null, has3d = false;
async function boot3D(canvasId, wrapId, demo) {
  if (!window.SGDevice || VIEW !== 'main') return;
  const wrap = $(wrapId);
  wrap.hidden = false;
  if (!demo) { has3d = true; document.body.classList.add('has3d'); }
  else $('setupRadar').hidden = true;
  try {
    const d = await SGDevice.createDevice($(canvasId), { base: 'assets/' });
    dev3d = d;
    wrap.classList.add('on');
    d.on.sound = (n) => sfx(n, n === 'tick' ? 0.35 : 0.6);
    if (demo) {
      const up = S && S.setup && S.setup.update;
      d.setState({ level: 'ok', title: up ? 'UPDATE READY' : 'SOUNDGUARD', sub: up ? 'Press UPDATE SOUNDGUARD below to get version ' + S.version + '.' : 'Press TURN ON below to start guarding your headphones and mic.', auto: false, plugged: true, outDev: { volume: 0.6, muted: false }, inDev: { volume: 0.8, muted: false } });
      let t = 0;
      setInterval(() => { t += 0.05; d.setLevels(0.2 + 0.18 * Math.abs(Math.sin(t * 2.1) * Math.cos(t * 0.7)), 0.03 + 0.12 * Math.max(0, Math.sin(t * 1.3))); }, 50);
      return;
    }
    d.on.volume = (k, v, final) => {
      const dv = S && S[k];
      if (!dv) return;
      $(k + 'VolNum').textContent = Math.round(v * 100) + '%';
      if (final) act('volume', { id: dv.id, v });
    };
    d.on.mute = (k, m) => { const dv = S && S[k]; if (dv) act('mute', { id: dv.id, on: m }); };
    d.on.press = (n) => {
      if (n === 'fix') act('fix');
      else if (n === 'testOut' && S && S.out && !(S.soundTest || {}).running) act('testSound');
      else if (n === 'testIn' && S && S.in && !(S.micTest || {}).running) act('testMic');
    };
    if (S) feed3D(S.status || {});
  } catch (e) {
    console.error('3D off:', e);
    wrap.hidden = true;
    has3d = false;
    document.body.classList.remove('has3d');
    if (demo) $('setupRadar').hidden = false;
  }
}
function feed3D(st) {
  if (!dev3d || !S || S.mode === 'setup') return;
  const plugged = S.out ? (S.out.jackKnown ? S.out.jackIn : true) : false;
  dev3d.setState({
    level: st.level, title: st.title, sub: st.sub, auto: !!(S.settings && S.settings.autoFix),
    fixing: !!(S.fixing || S.outFrozen), micMissing: !!S.micMissing, needRestart: !!S.needRestart, plugged,
    testOut: !!(S.soundTest && S.soundTest.running), testIn: !!(S.micTest && S.micTest.running),
    outDev: S.out, inDev: S.in,
  });
}

// ---------- real clicks (CC0 recordings, only while this window is open) ----------
const SFX = { ctx: null, buf: {} };
function sfxInit() {
  if (SFX.ctx) return;
  try { SFX.ctx = new AudioContext(); } catch (e) { return; }
  for (const n of ['sw_on', 'sw_off', 'sw_big', 'btn_down', 'btn_up', 'knob', 'tick', 'relay']) {
    fetch('assets/snd/' + n + '.mp3').then((r) => r.arrayBuffer()).then((b) => SFX.ctx.decodeAudioData(b)).then((a) => { SFX.buf[n] = a; }).catch(() => {});
  }
}
document.addEventListener('pointerdown', sfxInit, { capture: true });
function sfx(n, vol = 0.6) {
  if (!SFX.ctx || !SFX.buf[n] || (S && S.settings && S.settings.uiSounds === false)) return;
  try {
    if (SFX.ctx.state === 'suspended') SFX.ctx.resume();
    const s = SFX.ctx.createBufferSource();
    s.buffer = SFX.buf[n];
    s.playbackRate.value = 0.95 + Math.random() * 0.1;
    const g = SFX.ctx.createGain();
    g.gain.value = vol;
    s.connect(g).connect(SFX.ctx.destination);
    s.start();
  } catch (e) {}
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b && !b.disabled) sfx('btn_down', 0.45);
});
document.addEventListener('change', (e) => {
  if (e.target.matches('input[type=checkbox]')) sfx(e.target.checked ? 'sw_on' : 'sw_off', 0.6);
});

// ---------- go ----------
if (VIEW === 'popup') { document.body.className = 'view-popup'; }
setTab('home');
radar.start();
loop();
livePoll();
setInterval(() => { if (S && VIEW === 'main' && S.micTest && S.micTest.running) renderMicTest(); }, 250);
