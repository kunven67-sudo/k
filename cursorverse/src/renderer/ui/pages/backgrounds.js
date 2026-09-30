import { h, section, slider, toggle, button, chips, toast } from '../lib.js';
import { state, set } from '../state.js';
import { nav } from '../nav.js';
import { mediaUrl } from '../components.js';
import { BACKGROUNDS } from '../../../shared/backgrounds.mjs';

const cv = window.cv;
let which = 'app';

// Tiny still thumbnail: run a background for a moment on a small canvas.
function thumb(def) {
  const c = h('canvas', { width: 180, height: 86 });
  const ctx = c.getContext('2d');
  const st = def.create(180, 86);
  let t = 0;
  for (let i = 0; i < (def.trails ? 40 : 12); i++) { t += 1 / 30; def.draw(ctx, st, 180, 86, t, 1 / 30); }
  let raf = 0;
  c.addEventListener('pointerenter', () => {
    const loop = () => { t += 1 / 60; def.draw(ctx, st, 180, 86, t, 1 / 60); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
  });
  c.addEventListener('pointerleave', () => cancelAnimationFrame(raf));
  return c;
}

export default {
  id: 'backgrounds', title: 'Backgrounds', emoji: '🌌',
  render(main) {
    const s = state.settings.background;
    const sameAsApp = which === 'browser' && s.browserSame;
    const bg = which === 'app' ? s.app : s.browser;
    const patch = (p) => set({ background: which === 'app' ? { app: p } : { browser: p } });

    const animatedGrid = h('div', { class: 'bg-grid' }, BACKGROUNDS.map((d) => h('div', {
      class: `bg-card${bg.type === 'animated' && bg.animated === d.id ? ' selected' : ''}`,
      onclick: (e) => {
        patch({ type: 'animated', animated: d.id });
        main.querySelectorAll('.bg-card.selected').forEach((x) => x.classList.remove('selected'));
        e.currentTarget.classList.add('selected');
      },
    }, thumb(d), h('div', { class: 'name' }, `${d.emoji} ${d.name}`))));

    const own = bg.file ? h('div', { class: `bg-card${bg.type !== 'animated' && bg.type !== 'none' ? ' selected' : ''}`, style: { maxWidth: '240px' }, onclick: () => patch({ type: /\.(mp4|webm|mov|m4v)$/i.test(bg.file) ? 'video' : 'image' }) },
      /\.(mp4|webm|mov|m4v)$/i.test(bg.file) ? h('video', { src: mediaUrl(bg.file), muted: true, autoplay: true, loop: true }) : h('img', { src: mediaUrl(bg.file) }),
      h('div', { class: 'name' }, '⭐ Your file')) : null;

    main.append(
      h('div', { class: 'page-head' },
        h('div', {}, h('h2', {}, '🌌 Backgrounds'), h('p', {}, 'Set a background for the app and one for the browser home page.')),
        chips({ value: which, options: [{ value: 'app', label: 'App background', emoji: '🖥️' }, { value: 'browser', label: 'Browser background', emoji: '🌐' }], onChange: (v) => { which = v; nav.refresh(); } })),
      which === 'browser' ? section(null, toggle({ label: 'Same as the app background', checked: s.browserSame, onChange: async (v) => { await set({ background: { browserSame: v } }); nav.refresh(); } })) : null,
      sameAsApp ? null : h('div', {},
        section('🎚️ Blur & dim',
          h('div', { class: 'row' },
            slider({ label: 'Blur', min: 0, max: 30, value: bg.blur, format: (v) => `${v}px`, onInput: (v) => patch({ blur: v }) }),
            slider({ label: 'Dim', min: 0, max: 90, value: bg.dim, format: (v) => `${v}%`, onInput: (v) => patch({ dim: v }) })),
          h('p', { class: 'hint' }, 'Blur and dim make text easier to read on busy pictures.')),
        section('📁 Your own picture, GIF or video',
          h('div', { class: 'row' },
            own,
            button('📂 Choose file...', async () => {
              const [f] = await cv.library.import('background');
              if (!f) return;
              if (bg.file) cv.library.remove(bg.file);
              await patch({ type: f.video ? 'video' : 'image', file: f.file });
              toast('🖼️ Background set!', 'good');
              nav.refresh();
            }, 'primary'),
            button('🚫 No background', () => { patch({ type: 'none' }); nav.refresh(); }))),
        section('✨ Animated', animatedGrid)),
    );
  },
};
