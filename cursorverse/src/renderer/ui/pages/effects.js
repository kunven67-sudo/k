import { h, section, slider, toggle, chips, colorInput, row } from '../lib.js';
import { state, set } from '../state.js';
import { FxEngine, TRAILS, CLICKS, IDLES, EMOJI_CHOICES } from '../../../shared/effects.mjs';

export default {
  id: 'effects', title: 'Effects', emoji: '✨',
  render(main) {
    const s = state.settings;
    const live = state.info.platform === 'win32' && s.effectsEnabled;

    // preview box with its own effect engine
    const box = h('div', { class: 'preview-box darkbg', style: { height: '220px', cursor: 'crosshair' } });
    const canvas = h('canvas', { style: { position: 'absolute', inset: '0', width: '100%', height: '100%' } });
    box.append(canvas, h('div', { style: { color: '#777', pointerEvents: 'none' } }, live ? 'Effects are live on your whole screen already 😎' : 'Move and click in here ✨'));
    const fx = new FxEngine(canvas);
    const cfg = () => ({ trail: state.settings.trail, click: state.settings.click, idle: state.settings.idle });
    fx.setConfig(live ? { trail: { enabled: false }, click: { enabled: false }, idle: { enabled: false } } : cfg());
    let raf = 0;
    let last = performance.now();
    const loop = (now) => { fx.frame(Math.min(0.05, (now - last) / 1000)); last = now; raf = requestAnimationFrame(loop); };
    const ro = new ResizeObserver(() => { const r = box.getBoundingClientRect(); fx.resize(r.width, r.height, devicePixelRatio); });
    ro.observe(box);
    raf = requestAnimationFrame(loop);
    box.addEventListener('pointermove', (e) => { const r = box.getBoundingClientRect(); fx.move(e.clientX - r.left, e.clientY - r.top); });
    box.addEventListener('pointerdown', (e) => { const r = box.getBoundingClientRect(); fx.click(e.clientX - r.left, e.clientY - r.top); });
    const refresh = () => { if (!live) fx.setConfig(cfg()); };

    const upd = (key, patch) => { set({ [key]: patch }); refresh(); };

    const block = (key, title, list, extra) => {
      const c = s[key];
      const body = h('div', { class: 'stack' });
      const draw = () => {
        const cur = state.settings[key];
        body.replaceChildren(
          toggle({ label: `${title} on`, checked: cur.enabled, onChange: (v) => { upd(key, { enabled: v }); draw(); } }),
          chips({ small: true, value: cur.type, options: list.map((t) => ({ value: t.id, label: t.name, emoji: t.emoji })), onChange: (v) => { upd(key, { type: v }); draw(); } }),
          row(
            colorInput({ label: 'Color', value: cur.color, onChange: (v) => upd(key, { color: v }) }),
            key !== 'idle' ? toggle({ label: 'Rainbow 🌈', checked: cur.rainbow, onChange: (v) => upd(key, { rainbow: v }) }) : null,
          ),
          (cur.type === 'emoji') ? h('div', {}, h('small', {}, 'Emoji'), chips({ small: true, value: cur.emoji, options: EMOJI_CHOICES.map((e) => ({ value: e, label: e })), onChange: (v) => { upd(key, { emoji: v }); draw(); } })) : null,
          ...extra(cur),
        );
      };
      draw();
      void c;
      return section(title, body);
    };

    main.append(
      h('div', { class: 'page-head' },
        h('div', {}, h('h2', {}, '✨ Effects'), h('p', {}, 'Trails behind your cursor, effects when you click, and a little something when you stop moving.')),
        toggle({ big: true, label: 'All effects', checked: s.effectsEnabled, onChange: (v) => set({ effectsEnabled: v }) })),
      section('🧪 Test area', box),
      h('div', { class: 'grid2' },
        block('trail', '🌠 Trail', TRAILS, (c) => [
          slider({ label: 'Length', min: 0.2, max: 3, step: 0.1, value: c.length, format: (v) => `${v}x`, onInput: (v) => upd('trail', { length: v }) }),
          slider({ label: 'Size', min: 0.3, max: 3, step: 0.1, value: c.size, format: (v) => `${v}x`, onInput: (v) => upd('trail', { size: v }) }),
          slider({ label: 'Amount', min: 0.2, max: 3, step: 0.1, value: c.amount, format: (v) => `${v}x`, onInput: (v) => upd('trail', { amount: v }) }),
        ]),
        block('click', '💥 Click effect', CLICKS, (c) => [
          slider({ label: 'Size', min: 0.3, max: 3, step: 0.1, value: c.size, format: (v) => `${v}x`, onInput: (v) => upd('click', { size: v }) }),
        ]),
        block('idle', '💤 When you stop moving', IDLES, (c) => [
          slider({ label: 'Show after', min: 0.5, max: 30, step: 0.5, value: c.delay, format: (v) => `${v}s`, onInput: (v) => upd('idle', { delay: v }) }),
        ]),
        section('⚡ Performance',
          toggle({ label: 'Low power mode', desc: 'Fewer particles and 30 fps backgrounds, good for laptops and games', checked: s.lowPower, onChange: (v) => set({ lowPower: v }) }),
          h('p', { class: 'hint' }, 'Tip: in 🎯 Apps you can make effects show only in the apps you pick, so they never get in the way of a game.')),
      ),
    );
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  },
  onSettings() {},
};
