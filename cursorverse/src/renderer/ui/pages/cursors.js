import { h, chips, toast, button, confirmBox } from '../lib.js';
import { state, set, refreshMyCursors } from '../state.js';
import { cursorCanvas } from '../components.js';
import { nav } from '../nav.js';
import { CURSORS, CATEGORIES } from '../../../shared/cursor-library.mjs';

const cv = window.cv;
let tab = 'all';
let query = '';

export default {
  id: 'cursors', title: 'Cursors', emoji: '🖱️',
  render(main) {
    const s = state.settings;
    const grid = h('div', { class: 'gallery' });

    const fill = () => {
      grid.replaceChildren();
      const q = query.trim().toLowerCase();
      if (tab === 'mine') {
        grid.append(
          h('div', { class: 'cur-card', onclick: () => nav.go('editor', { mode: 'draw' }) }, h('div', { style: { fontSize: '40px', height: '64px', display: 'grid', placeItems: 'center' } }, '✏️'), h('div', { class: 'name' }, 'Draw a new one')),
          h('div', { class: 'cur-card', onclick: () => nav.go('editor', { mode: 'upload' }) }, h('div', { style: { fontSize: '40px', height: '64px', display: 'grid', placeItems: 'center' } }, '🖼️'), h('div', { class: 'name' }, 'Upload PNG / GIF')),
        );
        for (const rec of state.myCursors) {
          if (q && !rec.name.toLowerCase().includes(q)) continue;
          grid.append(card(rec.id, rec.name, rec.frames.length > 1, [
            button('✏️', (e) => { e.stopPropagation(); nav.go('editor', { edit: rec.id }); }, 'small'),
            button('🗑️', async (e) => {
              e.stopPropagation();
              if (!(await confirmBox('Delete cursor?', `"${rec.name}" will be gone for good.`, 'Delete'))) return;
              await cv.myCursors.remove(rec.id);
              await refreshMyCursors();
              fill();
            }, 'small'),
          ]));
        }
        return;
      }
      for (const c of CURSORS) {
        if (tab !== 'all' && c.cat !== tab) continue;
        if (q && !c.name.toLowerCase().includes(q) && !c.id.includes(q)) continue;
        grid.append(card(c.id, c.name, c.animated));
      }
      if (!grid.children.length) grid.append(h('p', { class: 'muted' }, 'Nothing matches that search 🤷'));
    };

    const card = (id, name, anim, extra = []) => {
      const cfg = { ...s.cursor, id, size: 64, anim: 'none', colorMode: 'original', glow: { enabled: false }, outline: { enabled: false }, hue: 0, saturation: 100, brightness: 100 };
      const canvas = cursorCanvas(id, cfg, 64, 'static');
      const el = h('div', {
        class: `cur-card${s.cursor.id === id ? ' selected' : ''}`, title: `${name}${anim ? ' (animated)' : ''}`,
        onclick: () => {
          set({ cursor: { id } });
          grid.querySelectorAll('.cur-card.selected').forEach((x) => x.classList.remove('selected'));
          el.classList.add('selected');
          toast(`🖱️ ${name} applied!`, 'good', 1500);
        },
      }, h('div', { class: 'split-bg', style: { padding: '4px' } }, canvas), h('div', { class: 'name' }, name), anim ? h('span', { class: 'badge' }, 'ANIM') : null,
      extra.length ? h('div', { class: 'row', style: { gap: '4px' } }, extra) : null);
      canvas.hoverTarget(el);
      return el;
    };

    const tabs = [{ value: 'all', label: `All (${CURSORS.length})`, emoji: '💯' }, ...CATEGORIES.map((c) => ({ value: c.id, label: c.name, emoji: c.emoji })), { value: 'mine', label: `My Cursors (${state.myCursors.length})`, emoji: '⭐' }];
    const tabBox = h('div');
    const drawTabs = () => tabBox.replaceChildren(chips({ options: tabs, value: tab, onChange: (v) => { tab = v; drawTabs(); fill(); } }));
    drawTabs();

    main.append(
      h('div', { class: 'page-head' },
        h('div', {}, h('h2', {}, '🖱️ Pick your cursor'), h('p', {}, 'Click one to use it. Hover to see it move. Tweak colors and animations in 🎨 Customize.')),
        h('input', { class: 'text', style: { width: '240px' }, placeholder: '🔍 Search cursors...', value: query, oninput: (e) => { query = e.target.value; fill(); } })),
      tabBox,
      h('div', { style: { height: '8px' } }),
      grid,
    );
    fill();
  },
  onMyCursors() { nav.go('cursors'); },
};
