'use strict';
const TOKEN = location.hash.slice(1);
const $ = s => document.querySelector(s);
const TB = 'windows-11-taskbar-styler', SM = 'windows-11-start-menu-styler';
let cat = null, st = null, sec = 'taskbar', working = null;

const SECS = {
  taskbar: { title: 'Taskbar', sub: 'Pick a look. Click it and your real taskbar changes in a second or two.' },
  start: { title: 'Start menu', sub: 'Pick a look for the Start menu. Open Start to see it.' },
  anim: { title: 'Animations', sub: 'Make windows, menus and folders move. Turn on as many as you want.' },
  fun: { title: 'Fun stuff', sub: 'Extra stuff for your desktop and mouse.' },
};

async function api(cmd, body = {}) {
  const r = await fetch('/api/' + cmd, { method: 'POST', headers: { 'X-DV': TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('DeskVerse lost its connection, close and reopen it');
  const j = await r.json();
  if (j.status) setStatus(j.status);
  if (j.error) throw new Error(j.error);
  return j;
}

function niceBusy(s) {
  if (!s) return 'Working';
  const names = { [TB]: 'taskbar looks', [SM]: 'Start menu looks' };
  (cat?.mods || []).forEach(m => names[m.id] = m.name);
  return s.replace(/(Downloading|Installing) (\S+)$/, (_, a, id) => a + ' ' + (names[id] || id));
}

let toastT;
function toast(text, bad) {
  const t = $('#toast');
  t.textContent = text;
  t.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.className = 'toast' + (bad ? ' bad' : ''), bad ? 6000 : 2600);
}

function setStatus(s) {
  st = s;
  const wh = s.wh || {};
  const chip = $('#whchip');
  chip.textContent = wh.ok ? 'Windhawk ' + (wh.version || '') + ' ready' : wh.installed ? 'Windhawk needs attention' : 'Windhawk not installed';
  chip.className = 'chip' + (wh.ok ? ' ok' : '');
  chip.title = wh.why || '';
  $('#banner').hidden = !!wh.installed;
  $('#ver').textContent = 'DeskVerse ' + (s.version || '');
  renderNow();
  if (!working) markOn();
}

function themeLabel(kind, v) {
  if (!v) return 'Windows default';
  const t = cat?.themes[kind].find(x => x.v === v);
  return t ? t.label : v;
}

function renderNow() {
  if (!st || !cat) return;
  const on = (cat.mods || []).filter(m => st.mods?.[m.id]?.enabled).map(m => m.name);
  if (st.fx) on.unshift('Windows animations max');
  $('#now').innerHTML =
    `<span class="k">On your PC now</span>
     <span>Taskbar: <b>${esc(themeLabel('taskbar', st.taskbar))}</b></span>
     <span>Start: <b>${esc(themeLabel('start', st.start))}</b></span>
     <span>Animations + fun: <b>${on.length ? esc(on.join(', ')) : 'none'}</b></span>`;
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function isOn(card) {
  if (!st) return false;
  const k = card.dataset.kind, v = card.dataset.v;
  if (k === 'taskbar') return (st.taskbar || '') === v;
  if (k === 'start') return (st.start || '') === v;
  if (k === 'mod') return !!st.mods?.[v]?.enabled;
  if (k === 'fx') return !!st.fx;
  return false;
}

function markOn() {
  document.querySelectorAll('.card[data-kind]').forEach(c => c.classList.toggle('on', isOn(c)));
}

function themeCard(kind, t, i) {
  const pic = t ? `<div class="pic"><img loading="lazy" src="${t.img}" alt="" width="${t.w}" height="${t.h}"></div>`
    : `<div class="pic none">${kind === 'taskbar' ? 'The normal Windows 11 taskbar' : 'The normal Windows 11 Start menu'}</div>`;
  return `<button class="card" style="animation-delay:${Math.min(i, 14) * 35}ms" data-kind="${kind}" data-v="${t ? esc(t.v) : ''}" data-label="${esc(t ? t.label : 'Windows default')}">
    ${pic}<div class="meta"><span class="name">${esc(t ? t.label : 'Windows default')}</span><span class="tag">On</span></div></button>`;
}

function modCard(m, i) {
  const pic = m.img ? `<div class="pic"><img loading="lazy" src="${m.img}" alt=""></div>` : `<div class="pic none">No preview from the maker. Turn it on and open an app to see it.</div>`;
  return `<button class="card" style="animation-delay:${Math.min(i, 14) * 35}ms" data-kind="mod" data-v="${m.id}" data-group="${m.group || ''}" data-label="${esc(m.name)}">
    ${pic}<div class="meta"><div><div class="name">${esc(m.name)}</div><div class="by">by ${esc(m.by)}</div></div><span class="sw"></span></div>
    <p class="desc">${esc(m.desc)}</p></button>`;
}

function render() {
  const g = $('#grid'), q = $('#q').value.trim().toLowerCase();
  const S = SECS[sec];
  $('#title').textContent = S.title;
  $('#sub').textContent = S.sub;
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.sec === sec));
  g.className = 'grid ' + sec;
  const match = s => !q || s.toLowerCase().includes(q);
  let h = '', i = 0;
  if (sec === 'taskbar' || sec === 'start') {
    if (match('windows default normal')) h += themeCard(sec, null, i++);
    for (const t of cat.themes[sec]) if (match(t.label + ' ' + t.v)) h += themeCard(sec, t, i++);
  } else if (sec === 'anim') {
    if (match('windows animations max')) h += `<button class="card fxcard wide" data-kind="fx" data-v="fx" data-label="Windows animations max" style="animation-delay:0ms">
      <div class="txt"><div class="name">Windows animations max</div>
      <p class="desc">Turns on every animation Windows already has: windows fading and sliding, menus and tooltips fading, smooth list scrolling, taskbar animations, see-through glass and shadows. No Windhawk needed.</p></div><span class="sw"></span></button>`;
    i++;
    const mods = cat.mods.filter(m => m.sec === 'anim' && match(m.name + ' ' + m.desc));
    const mini = mods.filter(m => m.group === 'minimize'), rest = mods.filter(m => m.group !== 'minimize');
    if (mini.length) h += `<div class="group">Minimize style (pick one)</div>` + mini.map(m => modCard(m, i++)).join('');
    if (rest.length) h += `<div class="group">More animations</div>` + rest.map(m => modCard(m, i++)).join('');
  } else {
    h += cat.mods.filter(m => m.sec === 'fun' && match(m.name + ' ' + m.desc)).map(m => modCard(m, i++)).join('');
    if (match('lively animated wallpapers')) h += `<div class="card" style="animation-delay:${i * 35}ms" data-label="Lively">
      <div class="pic none">Thousands of moving wallpapers, made by other people. Pauses itself when you play a game.</div>
      <div class="meta"><div><div class="name">Animated wallpapers (Lively)</div><div class="by">free app from the Microsoft Store</div></div></div>
      <div class="btnrow"><button class="primary" id="lively">${st?.lively ? 'Open Lively' : 'Get Lively'}</button></div></div>`;
  }
  g.innerHTML = h || `<p class="empty">Nothing matches "${esc(q)}".</p>`;
  $('#credit').innerHTML = 'Every look and animation here is made by the Windhawk community. Screenshots come from the Windhawk styling guides, previews from each mod\'s maker. DeskVerse just switches them on your PC.';
  markOn();
}

async function ensureWindhawk(card) {
  if (st?.wh?.installed) {
    if (!st.wh.ok) throw new Error(st.wh.why || 'Windhawk needs attention');
    return;
  }
  await run(card, () => api('windhawk/install'), 'Installing Windhawk (one time)');
}

async function run(card, fn, label) {
  let box;
  if (card) {
    box = document.createElement('div');
    box.className = 'busy';
    box.innerHTML = `<div class="spin"></div><span>${esc(label || 'Working')}</span>`;
    card.appendChild(box);
  }
  const poll = setInterval(async () => {
    try {
      const r = await fetch('/api/status', { method: 'POST', headers: { 'X-DV': TOKEN }, body: '{}' });
      const j = await r.json();
      if (box && j.status?.busy) box.lastChild.textContent = niceBusy(j.status.busy);
    } catch (e) { }
  }, 450);
  try { return await fn(); } finally { clearInterval(poll); box?.remove(); }
}

async function clickCard(card) {
  if (working) return;
  const kind = card.dataset.kind, v = card.dataset.v, label = card.dataset.label;
  if (!kind) return;
  working = card;
  try {
    if (kind === 'fx') {
      const on = !st.fx;
      await run(card, () => api('fx', { on }), 'Changing Windows animations');
      toast(on ? 'Windows animations are all on' : 'Windows animations are back how they were');
    } else {
      if (kind === 'mod' && st?.mods?.[v]?.enabled) {
        await run(card, () => api('mod', { id: v, on: false }), 'Turning off');
        toast(label + ' is off');
      } else {
        if (v || kind === 'mod') await ensureWindhawk(card);
        if (kind === 'mod') {
          const off = card.dataset.group ? cat.mods.filter(m => m.group === card.dataset.group && m.id !== v).map(m => m.id) : [];
          await run(card, () => api('mod', { id: v, on: true, off }), 'Turning on ' + label);
          toast(label + ' is on. Open or minimize a window to see it.');
        } else {
          if (!v && !(st?.wh?.ok)) { toast('That one is already on'); return; }
          await run(card, () => api('theme', { kind, v }), 'Switching to ' + label);
          toast((kind === 'taskbar' ? 'Taskbar' : 'Start menu') + ': ' + label);
        }
      }
    }
  } catch (e) {
    toast(e.message, true);
  } finally {
    working = null;
    markOn();
  }
}

$('#grid').addEventListener('click', e => {
  if (e.target.closest('#lively')) {
    api('lively').then(() => toast(st?.lively ? 'Opening Lively' : 'Opening the Microsoft Store page. Press Get, then come back.')).catch(x => toast(x.message, true));
    return;
  }
  const c = e.target.closest('.card[data-kind]');
  if (c) clickCard(c);
});
$('#nav').addEventListener('click', e => {
  const b = e.target.closest('button[data-sec]');
  if (!b || b.dataset.sec === sec) return;
  sec = b.dataset.sec;
  $('#q').value = '';
  render();
  $('main').scrollTop = 0;
  try { localStorage.setItem('dv-sec', sec); } catch (x) { }
});
$('#q').addEventListener('input', render);
$('#getwh').addEventListener('click', async () => {
  const b = $('#getwh');
  b.disabled = true; b.textContent = 'Installing Windhawk...';
  try { await api('windhawk/install'); toast('Windhawk is ready. Pick any look.'); }
  catch (e) { toast(e.message, true); }
  finally { b.disabled = false; b.textContent = 'Get Windhawk now'; }
});
$('#openwh').addEventListener('click', () => api('windhawk/open').catch(e => toast(e.message, true)));
$('#reset').addEventListener('click', () => $('#modal').hidden = false);
$('#m-no').addEventListener('click', () => $('#modal').hidden = true);
$('#m-yes').addEventListener('click', async () => {
  $('#modal').hidden = true;
  try { await api('reset'); toast('Everything is back to normal'); } catch (e) { toast(e.message, true); }
  render();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#modal').hidden = true; });

(async () => {
  try { const s = localStorage.getItem('dv-sec'); if (SECS[s]) sec = s; } catch (x) { }
  cat = await (await fetch('catalog.json')).json();
  $('#n-taskbar').textContent = cat.themes.taskbar.length;
  $('#n-start').textContent = cat.themes.start.length;
  $('#n-anim').textContent = cat.mods.filter(m => m.sec === 'anim').length + 1;
  $('#n-fun').textContent = cat.mods.filter(m => m.sec === 'fun').length + 1;
  try { await api('status'); } catch (e) { toast(e.message, true); }
  render();
})();
