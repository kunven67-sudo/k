import { h, section, slider, toggle, colorInput, chips, button, row, throttle } from '../lib.js';
import { state, set, mergePatch } from '../state.js';
import { cursorCanvas, cssCursor } from '../components.js';
import { ANIMATIONS, DEFAULT_CURSOR_SETTINGS, resolveDef } from '../../../shared/cursor-render.mjs';

let previewBg = 'checker';

export default {
  id: 'customize', title: 'Customize', emoji: '🎨',
  render(main) {
    let c = state.settings.cursor;
    const def = resolveDef(c.id, state.customDefs);
    const big = cursorCanvas(c.id, c, 160, 'always');
    const testArea = h('div', { class: 'test-area checker' }, 'Move your mouse in here to test it 👆');
    const refreshTest = throttle(() => { try { testArea.style.cursor = cssCursor(c.id, c); } catch { /* ignore */ } }, 150);
    refreshTest();

    // collect every tweak and send them together, so fast slider moves never lose one
    let pending = {};
    const flush = throttle(() => { const p = pending; pending = {}; set({ cursor: p }); }, 120);
    const push = (patch) => { pending = mergePatch(pending, patch); flush(); };
    const upd = (patch) => {
      c = { ...c, ...patch, glow: { ...c.glow, ...(patch.glow || {}) }, outline: { ...c.outline, ...(patch.outline || {}) } };
      big.update(c.id, c);
      refreshTest();
      push(patch);
    };

    const box = h('div', { class: `preview-box ${previewBg}`, style: { height: '220px' } }, big);
    const bgChips = h('div');
    const drawBgChips = () => bgChips.replaceChildren(chips({
      small: true, value: previewBg,
      options: [{ value: 'checker', label: 'Checker' }, { value: 'darkbg', label: 'Dark' }, { value: 'split-bg', label: 'Light/Dark' }],
      onChange: (v) => { previewBg = v; box.className = `preview-box ${v}`; drawBgChips(); },
    }));
    drawBgChips();

    const colorModeBox = h('div');
    const drawColorMode = () => colorModeBox.replaceChildren(
      chips({
        value: c.colorMode,
        options: [{ value: 'original', label: 'Original', emoji: '🎨' }, { value: 'tint', label: 'Tint', emoji: '🖌️' }, { value: 'rainbow', label: 'Rainbow (animated)', emoji: '🌈' }],
        onChange: (v) => { upd({ colorMode: v }); drawColorMode(); },
      }),
      c.colorMode === 'tint' ? h('div', { style: { marginTop: '8px' } }, colorInput({ label: 'Tint color', value: c.tint, onChange: (v) => upd({ tint: v }) })) : null,
    );
    drawColorMode();

    const animBox = h('div');
    const drawAnim = () => animBox.replaceChildren(chips({
      value: c.anim,
      options: ANIMATIONS.filter((a) => a.id !== 'rainbow').map((a) => ({ value: a.id, label: a.name })),
      onChange: (v) => { upd({ anim: v }); drawAnim(); },
    }));
    drawAnim();

    const r = c.replace;
    const replaceToggle = (key, label, desc) => toggle({ label, desc, checked: r[key], onChange: (v) => set({ cursor: { replace: { [key]: v } } }) });

    main.append(
      h('div', { class: 'page-head' },
        h('div', {}, h('h2', {}, '🎨 Customize'), h('p', {}, `Tweaking: ${def.name}. Changes apply live.`)),
        button('↩️ Reset tweaks', () => {
          const { id, replace, linkBadge, enabled } = state.settings.cursor;
          set({ cursor: { ...DEFAULT_CURSOR_SETTINGS, id, replace, linkBadge, enabled } });
          setTimeout(() => main.dispatchEvent(new Event('rerender')), 50);
        })),
      h('div', { class: 'grid2' },
        h('div', {},
          section('👀 Preview', box, h('div', { style: { marginTop: '10px' } }, bgChips), h('div', { style: { marginTop: '12px' } }, testArea),
            h('p', { class: 'hint' }, 'The test box shows a still copy; the real cursor on Windows keeps its animation.')),
          section('📏 Size',
            slider({ label: 'Cursor size', min: 16, max: 128, step: 2, value: c.size, format: (v) => `${v}px`, onInput: (v) => upd({ size: v }) }),
            h('p', { class: 'hint' }, 'Windows default is 32. CursorVerse scales it up on high-DPI screens automatically.')),
          section('🧩 Which cursors to replace',
            h('div', { class: 'stack' },
              replaceToggle('normal', 'Normal arrow', 'The one you see most'),
              replaceToggle('link', 'Link hand', 'When you hover links and buttons'),
              toggle({ label: 'Show a link badge', desc: 'Little ↗ bubble so you can still tell when you are on a link', checked: c.linkBadge, onChange: (v) => set({ cursor: { linkBadge: v } }) }),
              replaceToggle('text', 'Text I-beam', 'Off keeps the thin text cursor for typing'),
              replaceToggle('busy', 'Loading / busy', 'Adds a little spinner badge'),
              replaceToggle('precision', 'Crosshair', 'Used by paint and screenshot apps'),
              replaceToggle('help', 'Help cursor', 'The arrow with a question mark'))),
        ),
        h('div', {},
          section('🌈 Color',
            colorModeBox,
            h('div', { class: 'stack', style: { marginTop: '12px' } },
              slider({ label: 'Hue shift', min: 0, max: 359, value: c.hue, format: (v) => `${v}°`, onInput: (v) => upd({ hue: v }) }),
              slider({ label: 'Saturation', min: 0, max: 250, value: c.saturation, format: (v) => `${v}%`, onInput: (v) => upd({ saturation: v }) }),
              slider({ label: 'Brightness', min: 30, max: 200, value: c.brightness, format: (v) => `${v}%`, onInput: (v) => upd({ brightness: v }) }))),
          section('💡 Glow',
            toggle({ label: 'Glow', checked: c.glow.enabled, onChange: (v) => upd({ glow: { enabled: v } }) }),
            row(colorInput({ label: 'Glow color', value: c.glow.color, onChange: (v) => upd({ glow: { color: v } }) }),
              slider({ label: 'Glow size', min: 1, max: 20, value: c.glow.size, onInput: (v) => upd({ glow: { size: v } }) }))),
          section('✏️ Outline',
            toggle({ label: 'Outline', desc: 'Makes any cursor easy to see on any background', checked: c.outline.enabled, onChange: (v) => upd({ outline: { enabled: v } }) }),
            row(colorInput({ label: 'Outline color', value: c.outline.color, onChange: (v) => upd({ outline: { color: v } }) }),
              slider({ label: 'Thickness', min: 1, max: 6, step: 0.5, value: c.outline.width, onInput: (v) => upd({ outline: { width: v } }) }))),
          section('🎬 Animation',
            h('p', { class: 'hint' }, 'Adds movement on top of the cursor. Animated cursors keep their own animation too.'),
            animBox,
            h('div', { style: { marginTop: '10px' } }, slider({ label: 'Animation speed', min: 0.25, max: 3, step: 0.25, value: c.animSpeed, format: (v) => `${v}x`, onInput: (v) => upd({ animSpeed: v }) }))),
        ),
      ),
    );
    const again = () => { main.replaceChildren(); this.render(main); };
    main.addEventListener('rerender', again, { once: true });
  },
};
