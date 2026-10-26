// "❓ What does this do?" pop-ups and the guided tour.
import { h, modal, button } from './lib.js';
import { PAGE_HELP, TOUR } from './help-data.js';

export function helpBody(id) {
  const p = PAGE_HELP[id];
  if (!p) return null;
  return h('div', {},
    h('p', {}, p.what),
    h('div', { class: 'list' }, p.items.map(([name, what]) => h('div', { class: 'item', style: { alignItems: 'flex-start' } },
      h('b', { style: { minWidth: '150px' } }, name), h('span', {}, what)))));
}

export function showHelp(id) {
  const p = PAGE_HELP[id];
  if (!p) return;
  modal(`${p.title}: what does this do?`, helpBody(id), [['Got it 👍', null, 'primary']]);
}

export function helpButton(id) {
  return PAGE_HELP[id] ? button('❓ What does this do?', () => showHelp(id), 'small') : null;
}

// Spotlight tour: dims the screen, cuts a hole around the target, shows a bubble.
export function startTour(onDone) {
  let i = 0;
  const spot = h('div', { class: 'tour-spot' });
  const bubble = h('div', { class: 'tour-bubble card' });
  const wrap = h('div', { class: 'tour-wrap' }, spot, bubble);
  document.body.append(wrap);
  const finish = () => { wrap.remove(); window.removeEventListener('resize', draw); onDone?.(); };
  function draw() {
    const step = TOUR[i];
    const el = step.target ? document.querySelector(step.target) : null;
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
      const r = el.getBoundingClientRect();
      Object.assign(spot.style, { display: 'block', left: `${r.left - 6}px`, top: `${r.top - 6}px`, width: `${r.width + 12}px`, height: `${r.height + 12}px` });
      const right = r.right + 16 + 340 < innerWidth;
      Object.assign(bubble.style, {
        left: right ? `${r.right + 16}px` : `${Math.max(16, r.left)}px`,
        top: right ? `${Math.min(Math.max(16, r.top - 10), innerHeight - 220)}px` : `${Math.min(r.bottom + 14, innerHeight - 220)}px`,
        transform: 'none',
      });
    } else {
      spot.style.display = 'none';
      Object.assign(bubble.style, { left: '50%', top: '40%', transform: 'translate(-50%, -50%)' });
    }
    bubble.replaceChildren(
      h('small', {}, `${i + 1} / ${TOUR.length}`),
      h('h3', { style: { margin: '4px 0 8px' } }, step.title),
      h('p', { style: { margin: '0 0 12px' } }, step.text),
      h('div', { class: 'row', style: { justifyContent: 'space-between' } },
        button('Skip tour', finish, 'small'),
        h('div', { class: 'row' },
          i > 0 ? button('← Back', () => { i--; draw(); }, 'small') : null,
          button(i === TOUR.length - 1 ? 'Done 🎉' : 'Next →', () => { if (i === TOUR.length - 1) finish(); else { i++; draw(); } }, 'small primary'))),
    );
  }
  window.addEventListener('resize', draw);
  draw();
}
