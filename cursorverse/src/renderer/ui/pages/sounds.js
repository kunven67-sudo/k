import { h, section, slider, toggle, button, row, toast } from '../lib.js';
import { nav } from '../nav.js';
import { state, set } from '../state.js';
import { SOUND_PACKS, SOUND_CATEGORIES, renderPack } from '../../../shared/sound-packs.mjs';

const cv = window.cv;
let actx = null;
const cache = new Map();

async function previewPack(id, role = 'key', count = 5) {
  actx ||= new AudioContext();
  if (actx.state === 'suspended') await actx.resume();
  const pack = SOUND_PACKS.find((p) => p.id === id);
  if (!pack) return;
  if (!cache.has(id)) cache.set(id, renderPack(pack));
  const bufs = await cache.get(id);
  const vol = actx.createGain();
  vol.gain.value = state.settings.sounds.volume;
  vol.connect(actx.destination);
  for (let i = 0; i < count; i++) {
    const list = bufs[i === count - 1 && count > 1 ? 'enter' : role];
    const src = actx.createBufferSource();
    src.buffer = list[Math.floor(Math.random() * list.length)];
    src.connect(vol);
    src.start(actx.currentTime + i * 0.13);
  }
}

export default {
  id: 'sounds', title: 'Sounds', emoji: '🔊',
  render(main) {
    const s = state.settings.sounds;
    const hookPlays = state.info.platform === 'win32' && s.enabled;

    const packCard = (p) => h('div', {
      class: `item${s.pack === p.id ? ' active' : ''}`, style: { cursor: 'pointer' },
      onclick: (e) => {
        set({ sounds: { pack: p.id } });
        previewPack(p.id, 'key', 4);
        main.querySelectorAll('.item.active').forEach((x) => x.classList.remove('active'));
        e.currentTarget.classList.add('active');
      },
    },
    h('span', { style: { fontSize: '22px' } }, p.emoji),
    h('span', { class: 'grow' }, h('b', {}, p.name), h('br'), h('small', {}, p.desc)),
    button('▶', (e) => { e.stopPropagation(); previewPack(p.id, 'key', 5); }, 'small'));

    const custom = s.custom;
    const customRole = (role, label) => h('div', { class: 'item' },
      h('span', { class: 'grow' }, label, ': ', h('small', {}, custom[role] ? custom[role].split('/').pop().replace(/^[0-9a-f]+-/, '') : 'uses the key sound')),
      button(custom[role] ? 'Change' : 'Add', async () => {
        const [f] = await cv.library.import('sound');
        if (f) { await set({ sounds: { custom: { [role]: f.file } } }); nav.refresh(); }
      }, 'small'),
      custom[role] ? button('✖', async () => { cv.library.remove(custom[role]); await set({ sounds: { custom: { [role]: null } } }); nav.refresh(); }, 'small') : null);

    main.append(
      h('div', { class: 'page-head' },
        h('div', {}, h('h2', {}, '🔊 Typing sounds'), h('p', {}, 'A sound every time you press a key, in every app (or just the ones you pick in 🎯 Apps).')),
        toggle({ big: true, label: 'Typing sounds', checked: s.enabled, onChange: (v) => set({ sounds: { enabled: v } }) })),
      h('div', { class: 'warn-box' }, '🔒 CursorVerse only notices that a key was pressed so it can play a sound. It never saves or sends what you type.'),
      h('div', { class: 'grid2' },
        section('🎚️ Settings',
          h('div', { class: 'stack' },
            slider({ label: 'Volume', min: 0, max: 1, step: 0.01, value: s.volume, format: (v) => `${Math.round(v * 100)}%`, onInput: (v) => set({ sounds: { volume: v } }) }),
            slider({ label: 'Pitch variety', min: 0, max: 0.3, step: 0.01, value: s.pitchVariation, format: (v) => `${Math.round(v * 100)}%`, onInput: (v) => set({ sounds: { pitchVariation: v } }) }),
            toggle({ label: 'Key release sound', desc: 'A tiny sound when you let go of a key too', checked: s.keyUp, onChange: (v) => set({ sounds: { keyUp: v } }) }),
            toggle({ label: 'Mouse click sounds', desc: 'Play a sound when you click', checked: s.mouseClicks, onChange: (v) => set({ sounds: { mouseClicks: v } }) }))),
        section('⌨️ Try it',
          h('textarea', {
            class: 'text', rows: 4, placeholder: 'Type here to hear your sounds...',
            onkeydown: (e) => {
              if (hookPlays || e.repeat) return;
              const role = e.key === ' ' ? 'space' : e.key === 'Enter' ? 'enter' : e.key === 'Backspace' ? 'backspace' : 'key';
              if (s.pack !== 'custom') previewPack(s.pack, role, 1);
            },
          }),
          h('p', { class: 'hint' }, hookPlays ? 'The real sounds play from Windows, exactly like in other apps.' : 'Preview sounds play here.')),
      ),
      h('div', { style: { height: '16px' } }),
      ...SOUND_CATEGORIES.map((c) => section(`${c.emoji} ${c.name}`, h('div', { class: 'list' }, SOUND_PACKS.filter((p) => p.cat === c.id).map(packCard)))),
      section('🎙️ Your own sounds',
        h('p', {}, 'Add your own MP3/WAV/OGG files. Add a few key sounds and CursorVerse picks a random one each press.'),
        h('div', { class: `item${s.pack === 'custom' ? ' active' : ''}`, style: { cursor: 'pointer' }, onclick: () => { if (!custom.key.length) { toast('Add at least one key sound first 👇', 'bad'); return; } set({ sounds: { pack: 'custom' } }); nav.refresh(); } },
          h('span', { style: { fontSize: '22px' } }, '⭐'), h('span', { class: 'grow' }, h('b', {}, 'Use my sounds'), h('br'), h('small', {}, `${custom.key.length} key sound${custom.key.length === 1 ? '' : 's'}`))),
        h('div', { class: 'list', style: { marginTop: '10px' } },
          ...custom.key.map((rel, i) => h('div', { class: 'item' }, h('span', { class: 'grow' }, `Key sound ${i + 1}: `, h('small', {}, rel.split('/').pop().replace(/^[0-9a-f]+-/, ''))),
            button('✖', async () => { cv.library.remove(rel); await set({ sounds: { custom: { key: custom.key.filter((k) => k !== rel) } } }); nav.refresh(); }, 'small'))),
          row(button('➕ Add key sounds', async () => {
            const files = await cv.library.import('sound', true);
            if (files.length) { await set({ sounds: { custom: { key: [...custom.key, ...files.map((f) => f.file)] } } }); nav.refresh(); }
          })),
          customRole('space', 'Space bar'), customRole('enter', 'Enter'), customRole('backspace', 'Backspace'))),
    );
  },
};
