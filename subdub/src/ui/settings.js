// Settings: saved in this browser, applied right away.
import { h } from './dom.js';
const KEY = 'subdub-settings-v1';
export const DEFAULTS = {
  mode: 'dub',            // dub | voiceover | captions | original
  voiceVolume: 1, bgVolume: 1, volume: 1,
  capSize: 30, showCaps: true,
  fileModel: 'good',      // fast | good | best (speech reader for files)
  liveModel: 'good',      // fast | good (live)
  forceLang: '',          // '' = auto
  readSubs: true, readTop: false,
  useGpu: true,
  syncDelay: 8,
};
export function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}
export function saveSettings(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }

const LANGS = [['', 'Find out by itself'], ['ja', 'Japanese'], ['ko', 'Korean'], ['zh', 'Chinese'], ['es', 'Spanish'], ['pt', 'Portuguese'], ['fr', 'French'], ['de', 'German'], ['it', 'Italian'], ['ru', 'Russian'], ['th', 'Thai'], ['vi', 'Vietnamese'], ['id', 'Indonesian'], ['tl', 'Filipino'], ['ar', 'Arabic'], ['hi', 'Hindi']];

export function openSettings(s, { onChange, onClearDownloads, gpuInfo }) {
  const set = (k, v) => { s[k] = v; saveSettings(s); onChange?.(k, v); };
  const row = (title, help, control) => h('div', { class: 'field' }, h('div', { class: 'lab' }, h('b', {}, title), h('span', {}, help)), control);
  const seg = (k, opts) => h('div', { class: 'seg', role: 'group' }, opts.map(([v, label]) => h('button', { class: s[k] === v ? 'on' : '', onclick: (e) => { set(k, v); [...e.currentTarget.parentNode.children].forEach(b => b.classList.toggle('on', b === e.currentTarget)); } }, label)));
  const range = (k, min, max, step) => h('input', { type: 'range', min, max, step, value: s[k], oninput: (e) => set(k, +e.target.value) });
  const check = (k) => h('input', { type: 'checkbox', checked: !!s[k], onchange: (e) => set(k, e.target.checked), style: { width: '20px', height: '20px', accentColor: '#ffe14d' } });
  const modal = h('div', { class: 'modal', onclick: (e) => { if (e.target === modal) close(); } },
    h('div', { class: 'sheet', role: 'dialog', 'aria-label': 'Settings' },
      h('h2', {}, 'Settings'),
      row('Sound', 'Dub = only English voices. Voice-over = English on top. Captions = just read.', seg('mode', [['dub', 'Dub'], ['voiceover', 'Voice-over'], ['captions', 'Captions'], ['original', 'Off']])),
      row('English voices volume', '', range('voiceVolume', 0, 2, 0.05)),
      row('Music + effects volume', '', range('bgVolume', 0, 2, 0.05)),
      row('Caption size', '', range('capSize', 18, 54, 1)),
      row('Show captions', 'English text on the video', check('showCaps')),
      row('Show\'s language', 'Leave on "find out" unless it keeps guessing wrong', h('select', { onchange: (e) => set('forceLang', e.target.value) }, LANGS.map(([v, l]) => h('option', { value: v, selected: s.forceLang === v }, l)))),
      row('Speech reader (videos)', 'Best is much more accurate, but a big extra download (about 1 GB) and slower', seg('fileModel', [['fast', 'Fast'], ['good', 'Good'], ['best', 'Best']])),
      row('Speech reader (live)', 'Fast keeps up better on slower PCs', seg('liveModel', [['fast', 'Fast'], ['good', 'Good']])),
      row('Read subtitles on screen', 'Translates subtitles that aren\'t in English', check('readSubs')),
      row('Also read the top of the screen', 'Signs and second subtitles', check('readTop')),
      row('Use graphics card', gpuInfo || 'Much faster when your browser allows it', check('useGpu')),
      row('Synced window delay', 'Seconds behind the real thing (more = smoother English)', range('syncDelay', 5, 15, 1)),
      row('Downloaded brains', 'Delete them to free space (they download again next time)', h('button', { class: 'iconbtn', onclick: async (e) => { e.currentTarget.disabled = true; await onClearDownloads?.(); e.currentTarget.textContent = 'Deleted'; } }, 'Delete')),
      h('div', { class: 'field' }, h('div', { class: 'lab' }, h('b', {}, 'Keys'), h('span', {}, 'Space play/pause · ← → 10 seconds · F fullscreen · C captions · D dub on/off')), h('span')),
      h('div', { style: { display: 'flex', justifyContent: 'flex-end', marginTop: '14px' } }, h('button', { class: 'bigbtn', onclick: () => close() }, 'Done'))));
  const close = () => { modal.remove(); document.removeEventListener('keydown', esc); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc);
  document.body.append(modal);
  return close;
}
