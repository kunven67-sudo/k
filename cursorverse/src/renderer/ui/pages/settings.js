import { h, section, toggle, button, toast, confirmBox, colorInput, row } from '../lib.js';
import { state, set } from '../state.js';
import { nav } from '../nav.js';

const cv = window.cv;

const THEMES = [
  { id: 'neon', name: 'Dark Neon', emoji: '🌃', style: { background: 'linear-gradient(135deg,#0b0a1a,#2b0f5e)', color: '#00e5ff', boxShadow: '0 0 14px #7c5cff66' } },
  { id: 'glass', name: 'Glassy / Frosted', emoji: '🧊', style: { background: 'linear-gradient(135deg,rgba(255,255,255,.35),rgba(124,196,255,.25)), #3a4a78', color: '#fff' } },
  { id: 'pixel', name: 'Pixel Retro', emoji: '👾', style: { background: '#262640', color: '#ffcc00', boxShadow: '4px 4px 0 #000', fontFamily: "'Press Start 2P', monospace", fontSize: '10px' } },
];

const HOTKEY_NAMES = {
  toggleCursor: 'Cursor on/off', toggleEffects: 'Effects on/off', toggleSounds: 'Typing sounds on/off', toggleVoice: 'Voice control on/off',
  toggleMusic: 'Play / pause music', nextTrack: 'Next song', random: 'Random combo', openApp: 'Open CursorVerse',
};

// Turns a keydown into an Electron accelerator like "CommandOrControl+Alt+C".
function accelFromEvent(e) {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null;
  let key = e.code;
  let m;
  if ((m = /^Key([A-Z])$/.exec(key))) key = m[1];
  else if ((m = /^Digit(\d)$/.exec(key))) key = m[1];
  else if (/^F\d{1,2}$/.test(key)) { /* keep */ } else {
    key = { Space: 'Space', Enter: 'Enter', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown', Insert: 'Insert', Delete: 'Delete', Minus: '-', Equal: '=', Backquote: '`' }[key];
    if (!key) return null;
  }
  const mods = [e.ctrlKey && 'CommandOrControl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super'].filter(Boolean);
  if (!mods.length && !/^F\d{1,2}$/.test(key)) return null; // a bare letter would break normal typing
  return [...mods, key].join('+');
}

export default {
  id: 'settings', title: 'Settings', emoji: '⚙️',
  render(main) {
    const s = state.settings;
    const info = state.info;
    const failBox = h('div');
    cv.hotkeys.status().then((fails) => {
      if (fails.length) failBox.replaceChildren(h('div', { class: 'warn-box' }, `😬 Another app already uses: ${fails.map((f) => HOTKEY_NAMES[f] || f).join(', ')}. Pick a different combo for those.`));
    });

    const hotkeyRow = (k) => {
      const input = h('input', {
        class: 'text', readOnly: true, value: (s.hotkeys[k] || '').replace('CommandOrControl', 'Ctrl'), placeholder: 'none', style: { maxWidth: '220px' },
        onfocus: (e) => { e.target.value = 'Press keys...'; },
        onblur: (e) => { e.target.value = (state.settings.hotkeys[k] || '').replace('CommandOrControl', 'Ctrl'); },
        onkeydown: (e) => {
          e.preventDefault();
          const acc = accelFromEvent(e);
          if (!acc) return;
          set({ hotkeys: { [k]: acc } });
          e.target.value = acc.replace('CommandOrControl', 'Ctrl');
          e.target.blur();
          setTimeout(() => nav.refresh(), 300);
        },
      });
      return h('div', { class: 'item' }, h('span', { class: 'grow' }, HOTKEY_NAMES[k]), input,
        button('✖', () => { set({ hotkeys: { [k]: '' } }); setTimeout(() => nav.refresh(), 100); }, 'small'));
    };

    main.append(
      h('div', { class: 'page-head' }, h('div', {}, h('h2', {}, '⚙️ Settings'))),
      section('🎨 Theme',
        h('div', { class: 'theme-grid' }, THEMES.map((t) => h('div', {
          class: `theme-card${s.theme === t.id ? ' selected' : ''}`, style: t.style,
          onclick: async () => { await set({ theme: t.id }); nav.refresh(); },
        }, h('div', { style: { fontSize: '26px' } }, t.emoji), h('b', {}, t.name)))),
        h('div', { class: 'row', style: { marginTop: '12px' } },
          colorInput({ label: 'Accent color', value: s.accent || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00e5ff', onChange: (v) => set({ accent: v }) }),
          button('Use theme color', () => { set({ accent: '' }); setTimeout(() => nav.refresh(), 50); }, 'small'))),
      section('⌨️ Hotkeys (work in every app)', failBox,
        h('p', { class: 'hint' }, 'Click a box and press your combo. Use Ctrl or Alt with it so it does not steal normal typing. Ctrl+Shift+S/R/N are skipped by default because lots of apps already use them.'),
        h('div', { class: 'list' }, Object.keys(HOTKEY_NAMES).map(hotkeyRow))),
      section('🚀 Startup',
        h('div', { class: 'stack' },
          toggle({ label: 'Start with Windows', desc: 'Your cursor is ready as soon as your PC turns on', checked: s.startWithWindows, onChange: (v) => set({ startWithWindows: v }) }),
          toggle({ label: 'Start hidden in the tray', desc: 'When it starts with Windows, do not pop the window up', checked: s.startHidden, onChange: (v) => set({ startHidden: v }) }),
          toggle({ label: 'Closing the window keeps it running', desc: 'X hides it to the tray so cursor, sounds and music keep going', checked: s.closeToTray, onChange: (v) => set({ closeToTray: v }) }))),
      section('🧯 Fix stuff',
        row(
          button('🖱️ Put my normal cursor back', async () => { await cv.cursor.restore(); toast('Normal cursor is back ✅', 'good'); nav.refresh(); }),
          button('📂 Open my CursorVerse folder', () => cv.app.openDataFolder()),
          button('♻️ Reset everything', async () => {
            if (!(await confirmBox('Reset everything?', 'All settings go back to default. Your own cursors and files stay.', 'Reset'))) return;
            await cv.settings.reset();
            location.reload();
          }, 'danger'),
          button('🚪 Quit CursorVerse', () => cv.app.quit(), 'danger'))),
      section('ℹ️ About',
        h('div', { class: 'list' },
          h('div', { class: 'item' }, h('span', { class: 'grow' }, 'Version'), h('b', {}, info.version)),
          h('div', { class: 'item' }, h('span', { class: 'grow' }, 'Windows cursor control'), h('b', {}, info.platform !== 'win32' ? 'not on Windows' : info.nativeOk ? '✅ working' : `❌ ${info.nativeError || 'failed'}`)),
          h('div', { class: 'item' }, h('span', { class: 'grow' }, 'Key & click listener (sounds, effects)'), h('b', {}, info.hookOk ? '✅ working' : '❌ unavailable')),
          h('div', { class: 'item' }, h('span', { class: 'grow' }, 'Ads blocked this session'), h('b', {}, String(info.adblockCount || 0)))),
        h('p', { class: 'hint' }, 'CursorVerse never saves or sends your keystrokes or voice. Sounds and voice commands are handled on your PC only.')),
    );
  },
};
