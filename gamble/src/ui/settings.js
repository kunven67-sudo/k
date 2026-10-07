// Settings overlay: a card table. Green baize, padded oxblood rail, clay-chip tabs. Every key of
// DEFAULT_SETTINGS has a control; changes apply live (settings.set emits 'settings:changed').
// It is an overlay only — the world behind keeps running (no pause rule).
//
//   import { openSettings } from './ui/settings.js';
//   const s = openSettings(engine, { onClose }); s.close();

import { el } from '../core/util.js';
import { t, onLanguageChange } from '../core/i18n.js';
import { settings, DEFAULT_SETTINGS } from '../core/settings.js';
import { detectedTier } from '../core/quality.js';
import { bus } from '../core/events.js';
import './strings.js';
import { ensureStyles } from './styles.js';
import { overlay, chipTabs, row, toggle, slider, segmented, button, toast, showCard } from './kit.js';
import { uiSound } from './sfx.js';

// Text scale is a CSS variable every UI reads; keep it in sync from anywhere settings change.
const applyTextScale = () => document.documentElement.style.setProperty('--text-scale', String(settings.get('textScale')));
applyTextScale();
bus.on('settings:changed', ({ key }) => key === 'textScale' && applyTextScale());

const pct = (v) => `${Math.round(v * 100)}%`;

// Which control each setting gets. Order inside a tab = order on the felt.
const TABS = [
  {
    id: 'graphics',
    icon: 'graphics',
    keys: [
      ['quality', 'seg', ['auto', 'low', 'medium', 'high', 'ultra']],
      ['resolutionScale', 'slider', { min: 0.5, max: 1.5, step: 0.05, format: pct }],
      ['fov', 'slider', { min: 50, max: 90, step: 1, format: (v) => `${v}°` }],
      ['bloom', 'toggle'],
      ['filmGrain', 'toggle'],
      ['motionBlur', 'toggle'],
      ['lensEffects', 'toggle'],
    ],
  },
  {
    id: 'audio',
    icon: 'audio',
    keys: ['masterVolume', 'musicVolume', 'sfxVolume', 'ambienceVolume', 'voiceVolume', 'uiVolume'].map((k) => [k, 'slider', { min: 0, max: 1, step: 0.01, format: pct }]),
  },
  {
    id: 'controls',
    icon: 'controls',
    keys: [
      ['mouseSensitivity', 'slider', { min: 0.2, max: 3, step: 0.05, format: (v) => `${v.toFixed(2)}×` }],
      ['invertY', 'toggle'],
      ['touchStyle', 'seg', ['joysticks', 'tap']],
    ],
    extra: keyList,
  },
  { id: 'content', icon: 'content', keys: [['swearFilter', 'toggle'], ['blood', 'toggle'], ['subtitles', 'toggle'], ['npcVoices', 'seg', ['tts', 'gibberish', 'text']]] },
  {
    id: 'voice',
    icon: 'voice',
    keys: [['micEnabled', 'toggle'], ['micMode', 'seg', ['open', 'push']], ['voiceTalkToNpcs', 'toggle'], ['realVoiceOut', 'toggle'], ['nameTags', 'toggle']],
    note: 'voice.online',
  },
  { id: 'language', icon: 'language', keys: [['language', 'seg', ['en', 'es']]] },
  {
    id: 'access',
    icon: 'access',
    keys: [['textScale', 'slider', { min: 0.85, max: 1.5, step: 0.05, format: pct }], ['reduceFlashing', 'toggle'], ['devOverlay', 'toggle']],
  },
];

// Sanity check during development: every setting must be reachable from the table.
const covered = new Set(TABS.flatMap((tab) => tab.keys.map((k) => k[0])));
for (const k of Object.keys(DEFAULT_SETTINGS)) if (!covered.has(k)) console.warn(`[ui/settings] no control for "${k}"`);

// Keyboard reference card on the Controls tab.
const KEYS = [
  ['keys.move', ['W', 'A', 'S', 'D']],
  ['keys.sprint', ['Shift']],
  ['keys.jump', ['Space']],
  ['keys.crouch', ['C']],
  ['keys.interact', ['E']],
  ['keys.use', ['F']],
  ['keys.phone', ['P']],
  ['keys.pockets', ['I']],
  ['keys.emote', ['G']],
  ['keys.flop', ['R']],
  ['keys.talk', ['T']],
  ['keys.camera', ['X']],
  ['keys.menu', ['Esc']],
];
function keyList() {
  return el('div', {}, [
    el('div', { class: 'gx-subhead', text: t('ui.keys.title').toUpperCase() }),
    el('div', { class: 'gx-keys' }, KEYS.map(([k, caps]) => el('div', { class: 'gx-key' }, [el('span', { text: t(`ui.${k}`) }), el('span', {}, caps.map((c) => el('kbd', { text: c })))]))),
  ]);
}

function control(key, kind, opt) {
  const value = settings.get(key);
  const set = (v) => settings.set(key, v);
  if (kind === 'toggle') return toggle(value, set, { on: t('ui.set.on'), off: t('ui.set.off') });
  if (kind === 'slider') return slider({ ...opt, value, onChange: set });
  // Segmented: option labels are '<key>.<value>' strings ('quality.auto', 'language.es', ...).
  const options = opt.map((v) => ({ value: v, label: t(`ui.${key}.${v}`) }));
  return segmented(options, value, set);
}

let openInstance = null;

/** Opens the settings table over whatever is on screen. Returns {close}. */
export function openSettings(engine, { onClose } = {}) {
  if (openInstance) return openInstance;
  ensureStyles();
  const root = engine?.uiRoot || document.getElementById('ui-root');
  let active = 'graphics';
  const controls = new Map(); // key -> control element (for external changes / reset)

  const close = () => {
    if (!openInstance) return;
    openInstance = null;
    offLang();
    offChange();
    window.removeEventListener('keydown', onKey, true);
    uiSound('ui.back');
    ov.close();
    onClose?.();
  };
  const ov = overlay(root, { onDismiss: close, className: 'gx-settings' });
  const table = el('div', { class: 'gx-table', role: 'dialog', 'aria-modal': 'true' });
  ov.el.appendChild(table);

  let tabs;
  let body;
  function renderBody() {
    controls.clear();
    const tab = TABS.find((x) => x.id === active);
    const section = el('div', { class: 'gx-section' });
    if (tab.id === 'graphics') {
      section.appendChild(el('div', { class: 'gx-note', text: t('ui.quality.detected', { tier: t(`ui.quality.${detectedTier}`) }) }));
    }
    for (const [key, kind, opt] of tab.keys) {
      const c = control(key, kind, opt);
      controls.set(key, c);
      section.appendChild(row(t(`ui.${key}`), t(`ui.${key}.desc`), c));
    }
    if (tab.extra) section.appendChild(tab.extra());
    if (tab.note) section.appendChild(el('div', { class: 'gx-note', text: t(`ui.${tab.note}`) }));
    body.replaceChildren(section);
    body.scrollTop = 0;
  }

  function render() {
    tabs = chipTabs(TABS.map((x) => ({ id: x.id, icon: x.icon, label: t(`ui.tab.${x.id}`) })), (id) => {
      active = id;
      renderBody();
    });
    tabs.select(active);
    body = el('div', { class: 'gx-body' });
    const reset = button(
      t('ui.set.reset'),
      async () => {
        const ok = await showCard(root, {
          title: t('ui.set.reset'),
          body: t('ui.set.resetConfirm'),
          suit: '♣',
          actions: [
            { label: t('ui.menu.quitNo'), value: false, ghost: true },
            { label: t('ui.set.reset'), value: true },
          ],
        });
        if (!ok) return;
        settings.reset();
        render();
        toast(root, t('ui.set.resetDone'));
      },
      { ghost: true },
    );
    const felt = el('div', { class: 'gx-felt' }, [
      el('div', { class: 'gx-head' }, [el('div', { class: 'gx-kicker', text: t('ui.set.subtitle').toUpperCase() }), el('h1', { class: 'gx-title', text: t('ui.set.title') })]),
      tabs,
      body,
      el('div', { class: 'gx-foot' }, [reset, button(t('ui.set.done'), close, { sound: 'ui.confirm' })]),
    ]);
    table.replaceChildren(felt);
    renderBody();
  }
  render();

  // Live language switch: rebuild every label in place, keep the open tab.
  const offLang = onLanguageChange(() => render());
  // Keep controls in sync if something else changes a setting while we're open (e.g. F3).
  const offChange = bus.on('settings:changed', ({ key, value }) => {
    if (key !== 'language') controls.get(key)?.setValue?.(value);
  });
  // Q / E or PageUp / PageDown switch tabs when focus isn't in a slider.
  const onKey = (e) => {
    if (!openInstance || e.target?.type === 'range') return;
    if (e.code === 'KeyQ' || e.code === 'PageUp') tabs.cycle(-1);
    else if (e.code === 'KeyE' || e.code === 'PageDown') tabs.cycle(1);
    else return;
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey, true);
  uiSound('ui.whoosh', { gain: 0.6 });
  setTimeout(() => tabs.querySelector('[aria-selected="true"]')?.focus({ preventScroll: true }), 80);

  openInstance = { close, el: ov.el };
  return openInstance;
}
