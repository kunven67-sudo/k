import { h, section, button, toast, prompt, confirmBox, chips } from '../lib.js';
import { state, set } from '../state.js';
import { nav } from '../nav.js';
import { cursorCanvas } from '../components.js';
import { BUILTIN_PRESETS } from '../../../shared/presets.mjs';
import { TRAILS, CLICKS } from '../../../shared/effects.mjs';
import { PACK_MAP } from '../../../shared/sound-packs.mjs';
import { TRACK_MAP } from '../../../shared/music-tracks.mjs';

const cv = window.cv;
const EMOJIS = ['⭐', '🔥', '😎', '🎮', '💀', '🌸', '⚡', '🧙', '👾', '🦆', '🍕', '💎'];

function card(p, mine) {
  const cfg = { ...state.settings.cursor, ...(p.cursor || {}) };
  const trail = TRAILS.find((t) => t.id === p.trail?.type);
  const click = CLICKS.find((t) => t.id === p.click?.type);
  return h('div', { class: 'card preset', onclick: async () => { await cv.presets.apply(p); toast(`${p.emoji} ${p.name} on!`, 'good'); } },
    h('div', { class: 'row', style: { justifyContent: 'space-between' } },
      h('span', { class: 'big-emoji' }, p.emoji),
      h('div', { class: 'split-bg', style: { padding: '3px' } }, cursorCanvas(cfg.id, { ...cfg, size: 48 }, 48, 'static'))),
    h('h3', { style: { margin: '8px 0 4px' } }, p.name),
    h('small', {}, [
      trail && `${trail.emoji} ${trail.name}`,
      click && `${click.emoji} ${click.name}`,
      p.soundPack && `🔊 ${PACK_MAP.get(p.soundPack)?.name || 'my sounds'}`,
      p.track && `🎵 ${TRACK_MAP.get(p.track)?.name || ''}`,
    ].filter(Boolean).join(' · ')),
    mine ? h('div', { style: { marginTop: '8px' } }, button('🗑️ Delete', async (e) => {
      e.stopPropagation();
      if (!(await confirmBox('Delete preset?', `"${p.name}" will be gone.`, 'Delete'))) return;
      await set({ presets: state.settings.presets.filter((x) => x.id !== p.id) });
      nav.refresh();
    }, 'small')) : null);
}

export default {
  id: 'presets', title: 'Presets', emoji: '💾',
  render(main) {
    const s = state.settings;
    let emoji = '⭐';
    const emojiBox = h('div');
    const drawEmoji = () => emojiBox.replaceChildren(chips({ small: true, value: emoji, options: EMOJIS.map((e) => ({ value: e, label: e })), onChange: (v) => { emoji = v; drawEmoji(); } }));
    drawEmoji();
    main.append(
      h('div', { class: 'page-head' },
        h('div', {}, h('h2', {}, '💾 Presets'), h('p', {}, 'Save a whole combo (cursor + effects + sounds + music + background) and switch with one click.')),
        h('div', { class: 'row' },
          button('🎲 Random combo', async () => { await cv.presets.random(); toast('🎲 Random combo!', 'good'); }),
        )),
      section('💾 Save what you have right now',
        emojiBox,
        h('div', { class: 'row', style: { marginTop: '10px' } }, button('💾 Save current as preset...', async () => {
          const name = await prompt('Name your preset', 'Like "Night Gaming"');
          if (!name) return;
          const p = {
            id: `mine-${Date.now()}`, name: name.slice(0, 40), emoji,
            cursor: s.cursor, trail: s.trail, click: s.click, idle: s.idle, effectsEnabled: s.effectsEnabled,
            soundPack: s.sounds.pack, track: state.music.track || s.music.track, background: s.background.app, theme: s.theme,
          };
          await set({ presets: [...s.presets, p] });
          toast(`💾 "${p.name}" saved!`, 'good');
          nav.refresh();
        }, 'primary'))),
      h('h3', {}, '⭐ Built in'),
      h('div', { class: 'preset-grid' }, BUILTIN_PRESETS.map((p) => card(p, false))),
      h('h3', { style: { marginTop: '20px' } }, `🧍 Mine (${s.presets.length})`),
      s.presets.length ? h('div', { class: 'preset-grid' }, s.presets.map((p) => card(p, true))) : h('p', { class: 'muted' }, 'None yet. Set things up how you like, then save it above.'),
    );
  },
};
