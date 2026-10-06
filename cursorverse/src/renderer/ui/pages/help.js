import { h, section, button } from '../lib.js';
import { set } from '../state.js';
import { PAGE_HELP, HOW_TO } from '../help-data.js';
import { helpBody, startTour } from '../help-ui.js';
import { botPanel, setHelpMode } from '../help-mode.js';
import { nav } from '../nav.js';

let query = '';

export default {
  id: 'help', title: 'Help', emoji: '❓',
  render(main) {
    const results = h('div');
    const fill = () => {
      const q = query.trim().toLowerCase();
      const hit = (...texts) => !q || texts.join(' ').toLowerCase().includes(q);
      const how = HOW_TO.filter(([qq, a]) => hit(qq, a));
      const pages = Object.entries(PAGE_HELP).filter(([, p]) => hit(p.title, p.what, ...p.items.flat()));
      results.replaceChildren(
        how.length ? section('🙋 How do I...?', h('div', { class: 'list' }, how.map(([qq, a]) => h('details', { class: 'item', style: { display: 'block' }, open: !!q },
          h('summary', { style: { cursor: 'pointer', fontWeight: 700 } }, qq), h('p', { style: { margin: '8px 0 2px' } }, a))))) : null,
        ...pages.map(([id, p]) => section(p.title, helpBody(id), button(`Go to ${p.title}`, () => nav.go(id), 'small'))),
        !how.length && !pages.length ? h('p', { class: 'muted' }, 'Nothing found 🤷 Try a different word.') : null,
      );
    };
    fill();
    main.append(
      h('div', { class: 'page-head' },
        h('div', {}, h('h2', {}, '❓ Help'), h('p', {}, 'What everything does and where to find it.')),
        button('🎓 Take the tour', () => startTour(() => set({ tourDone: true })), 'primary')),
      h('div', { class: 'grid2', style: { marginBottom: '16px' } },
        section('🤖 Ask the help bot', botPanel()),
        section('🔵 Help mode',
          h('p', {}, 'Turn it on and everything you can click gets a blue outline. Click anything and it tells you what it does, without doing it.'),
          button('❓ Turn on help mode', () => setHelpMode(true), 'primary'),
          h('p', { class: 'hint' }, 'It is also at the top of every page: ❓ Help mode. Press Esc to exit.'))),
      h('input', { class: 'text', style: { maxWidth: '420px', marginBottom: '14px' }, placeholder: '🔍 Search help, like "voice" or "normal cursor"', value: query, oninput: (e) => { query = e.target.value; fill(); } }),
      results,
    );
  },
};
