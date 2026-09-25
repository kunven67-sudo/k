// DOM-side UI: HUD bars, objectives, prompts, subtitles (with voice), toasts, fades, letterbox,
// eyelids, chapter cards, mash meter, hotbar, death screen.
import { speak, stopSpeaking, sfx } from './audio.js';
import { getSettings } from './settings.js';

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let hpShown = 1;
let subToken = 0;

export const ui = {
  $,
  wait,

  loading(p, text) {
    $('load-fill').style.width = `${Math.round(p * 100)}%`;
    if (text) $('load-text').textContent = text;
  },
  setTip(t) { $('load-tip').textContent = t; },
  hideLoading() { $('loading').classList.add('hidden'); },

  showHud(on) { $('hud').classList.toggle('hidden', !on); },

  objective(text, chapter) {
    const el = $('obj-text');
    if (chapter !== undefined) $('obj-chapter').textContent = chapter;
    if (el.textContent === text) return;
    el.textContent = text;
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    if (text) sfx('notify', { vol: 0.5 });
  },

  health(h, max) {
    const f = Math.max(0, h / max);
    $('hp-fill').style.width = `${f * 100}%`;
    if (f < hpShown) $('hp-ghost').style.width = `${hpShown * 100}%`;
    hpShown = f;
    requestAnimationFrame(() => { $('hp-ghost').style.width = `${f * 100}%`; });
  },
  stamina(s) { $('st-fill').style.width = `${Math.max(0, s) * 100}%`; },
  heat(h, show) {
    $('heat-row').classList.toggle('on', !!show);
    $('heat-fill').style.width = `${Math.max(0, Math.min(1, h)) * 100}%`;
  },
  sunWarning(on) { $('sun-warning').classList.toggle('hidden', !on); },

  prompt(html) {
    const el = $('prompt');
    if (!html) { el.classList.add('hidden'); return; }
    if (el.innerHTML !== html) el.innerHTML = html;
    el.classList.remove('hidden');
  },

  mash(frac, label = 'MASH E') {
    const el = $('mash');
    if (frac === null || frac === undefined) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    $('mash-label').textContent = label;
    $('mash-fill').style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
  },

  crosshair(on) { $('crosshair').classList.toggle('hidden-soft', !on); },

  boss(name, frac) {
    const el = $('boss');
    if (name === null) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    $('boss-name').textContent = name;
    $('boss-fill').style.width = `${Math.max(0, frac) * 100}%`;
  },

  toast(text, ms = 3200) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = text;
    $('toasts').appendChild(el);
    while ($('toasts').children.length > 5) $('toasts').firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, ms);
  },

  achievement(icon, title) {
    const el = $('achv-pop');
    el.innerHTML = `<div class="ic">${icon}</div><div><div class="l">ACHIEVEMENT UNLOCKED</div><div class="t">${title}</div></div>`;
    el.classList.add('on');
    sfx('achievement');
    clearTimeout(this._achT);
    this._achT = setTimeout(() => el.classList.remove('on'), 4200);
  },

  // Subtitled, voiced line. Resolves when both the reading time and the speech are done.
  async say(text, { speaker = '', min = 0, voice = true, pitch, rate } = {}) {
    const token = ++subToken;
    const show = getSettings().subtitles;
    if (show) {
      $('sub-speaker').textContent = speaker;
      $('sub-text').textContent = text;
      $('subtitle').classList.remove('hidden');
    }
    const readMs = Math.max(min, 1400 + text.length * 55);
    let spoken = Promise.resolve();
    if (voice) {
      spoken = new Promise((res) => {
        const ok = speak(text, { pitch, rate, onend: res });
        if (!ok) res();
        setTimeout(res, readMs + 6000); // safety if onend never fires
      });
    }
    await Promise.all([wait(readMs), spoken]);
    if (token === subToken) $('subtitle').classList.add('hidden');
  },
  clearSubtitle() { subToken++; $('subtitle').classList.add('hidden'); stopSpeaking(); },

  letterbox(on) { $('letterbox').classList.toggle('on', on); },

  fade(to, ms = 800) {
    const el = $('fade');
    el.style.transition = `opacity ${ms}ms ease`;
    el.style.opacity = to;
    return wait(ms);
  },
  fadeInstant(to) { const el = $('fade'); el.style.transition = 'none'; el.style.opacity = to; },

  // 0 = eyes closed, 1 = fully open
  eyelids(open, ms = 600) {
    const h = `${(1 - open) * 52}vh`;
    document.querySelectorAll('#eyelids .lid').forEach((l) => {
      l.style.transition = `height ${ms}ms ease-in-out`;
      l.style.height = h;
    });
    return wait(ms);
  },

  chapterCard(num, title) {
    const el = $('chapter-card');
    $('cc-num').textContent = num;
    $('cc-title').textContent = title;
    el.classList.remove('hidden');
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(this._ccT);
    this._ccT = setTimeout(() => el.classList.add('hidden'), 4600);
  },

  skipHint(on) { $('skip-hint').classList.toggle('hidden', !on); },

  hotbar(slots, selected) {
    const el = $('hotbar');
    el.innerHTML = '';
    if (!slots || slots.every((x) => !x)) return;
    slots.forEach((s, i) => {
      const d = document.createElement('div');
      d.className = 'slot' + (i === selected ? ' sel' : '');
      d.innerHTML = `<span class="k">${i + 1}</span>${s ? s.icon : ''}${s && s.count > 1 ? `<span class="c">${s.count}</span>` : ''}${s && s.dur !== undefined ? `<span class="dur"><i style="width:${Math.round(s.dur * 100)}%"></i></span>` : ''}`;
      el.appendChild(d);
    });
  },

  fps(v) {
    const el = $('fps');
    el.classList.toggle('hidden', !getSettings().showFps);
    if (getSettings().showFps) el.textContent = `${v | 0} FPS`;
  },

  death(cause, text, count, onRetry) {
    $('death-cause').textContent = cause;
    $('death-text').textContent = text;
    $('death-count').textContent = count;
    $('death').classList.remove('hidden');
    const btn = $('btn-retry');
    btn.onclick = () => { $('death').classList.add('hidden'); onRetry(); };
  },
  hideDeath() { $('death').classList.add('hidden'); },

  lock(show, title = 'Click to play') {
    $('lock').classList.toggle('hidden', !show);
    document.querySelector('#lock .lock-title').textContent = title;
  },
};
