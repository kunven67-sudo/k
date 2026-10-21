import { h, section, toggle, toast, button } from '../lib.js';
import { state, set } from '../state.js';
import { cursorCanvas } from '../components.js';
import { nav } from '../nav.js';
import { resolveDef } from '../../../shared/cursor-render.mjs';
import { BUILTIN_PRESETS } from '../../../shared/presets.mjs';

const cv = window.cv;

export default {
  id: 'home', title: 'Home', emoji: '🏠',
  render(main) {
    const s = state.settings;
    const def = resolveDef(s.cursor.id, state.customDefs);
    const info = state.info;
    const notWin = info.platform !== 'win32';

    main.append(
      h('div', { class: 'page-head' }, h('div', {}, h('h2', {}, 'Yo bro 👋 welcome to CursorVerse'), h('p', {}, 'Your cursor, effects, sounds, music and voice control, all in one place.'))),
      notWin ? h('div', { class: 'warn-box' }, '👀 You are not on Windows, so the system-wide cursor, typing sounds everywhere and voice control are in preview mode. Everything else works.') : null,
      info.platform === 'win32' && !info.nativeOk ? h('div', { class: 'bad-box' }, `😤 Windows cursor control failed to load: ${info.nativeError || 'unknown error'}`) : null,
      h('div', { class: 'card home-hero' },
        h('div', { class: 'preview-box checker', style: { width: '150px', height: '150px' } }, cursorCanvas(s.cursor.id, s.cursor, 128, 'always')),
        h('div', { style: { flex: 1 } },
          h('small', {}, 'Current cursor'),
          h('h2', { style: { margin: '2px 0 10px' } }, def.name),
          h('div', { class: 'row' },
            button('🖱️ Change cursor', () => nav.go('cursors'), 'primary'),
            button('🎨 Customize', () => nav.go('customize')),
            button('🎲 Random combo', async () => { await cv.presets.random(); toast('🎲 Random combo applied!', 'good'); }),
          ),
        ),
      ),
      h('div', { class: 'home-toggles' },
        section(null, toggle({ big: true, label: '🖱️ Custom cursor', desc: s.cursor.enabled ? 'On' : 'Off: your normal cursor is back', checked: s.cursor.enabled, onChange: (v) => set({ cursor: { enabled: v } }) })),
        section(null, toggle({ big: true, label: '✨ Trails & clicks', desc: 'Effects that follow your mouse', checked: s.effectsEnabled, onChange: (v) => set({ effectsEnabled: v }) })),
        section(null, toggle({ big: true, label: '🔊 Typing sounds', desc: `Pack: ${s.sounds.pack}`, checked: s.sounds.enabled, onChange: (v) => set({ sounds: { enabled: v } }) })),
        section(null, toggle({ big: true, label: '🎤 Voice control', desc: 'Say "click" to click', checked: s.voice.enabled, onChange: (v) => set({ voice: { enabled: v } }) })),
      ),
      h('div', { style: { height: '16px' } }),
      section('⚡ Quick presets',
        h('div', { class: 'chips' }, BUILTIN_PRESETS.map((p) => h('button', {
          class: 'chip', onclick: async () => { await cv.presets.apply(p); toast(`${p.emoji} ${p.name} on!`, 'good'); },
        }, p.emoji, p.name)))),
      section('🎯 Where it works',
        h('p', {}, s.target.mode === 'all' ? 'Everywhere on your PC 🌍' : `Only in: ${s.target.apps.map((a) => a.name || a.exe).join(', ') || '(no apps picked yet)'}`),
        button('Change', () => nav.go('apps'))),
      section('⌨️ Hotkeys (work anywhere)',
        h('div', { class: 'list' }, Object.entries({
          toggleCursor: 'Cursor on/off', toggleEffects: 'Effects on/off', toggleSounds: 'Sounds on/off', toggleVoice: 'Voice on/off',
          toggleMusic: 'Play / pause music', nextTrack: 'Next song', random: 'Random combo', openApp: 'Open this window',
        }).map(([k, label]) => h('div', { class: 'item' }, h('span', { class: 'grow' }, label), h('span', { class: 'kbd' }, (s.hotkeys[k] || 'none').replace('CommandOrControl', 'Ctrl')))))),
    );
  },
};
