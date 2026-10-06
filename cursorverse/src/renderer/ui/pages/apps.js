import { h } from '../lib.js';
import { state, set } from '../state.js';
import { targetEditor } from './target-editor.js';

export default {
  id: 'apps', title: 'Apps', emoji: '🎯',
  render(main) {
    main.append(
      h('div', { class: 'page-head' }, h('div', {}, h('h2', {}, '🎯 Where should it work?'), h('p', {}, 'Your cursor, effects and typing sounds can run everywhere, or only in the apps you pick.'))),
      targetEditor('🖱️ Cursor, effects & sounds', state.settings.target, (t) => set({ target: t }),
        'When you switch to an app that is not picked, your normal Windows cursor comes back instantly, and it swaps again when you come back.'),
      h('p', { class: 'hint' }, '🎤 Voice control has its own setting on the Voice page.'),
    );
  },
};
