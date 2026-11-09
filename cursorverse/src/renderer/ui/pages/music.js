import { h, section, slider, toggle, button, chips, confirmBox } from '../lib.js';
import { state, set } from '../state.js';
import { nav } from '../nav.js';
import { TRACKS, GENRES } from '../../../shared/music-tracks.mjs';

const cv = window.cv;
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default {
  id: 'music', title: 'Music', emoji: '🎵',
  render(main) {
    const m = state.settings.music;
    const np = h('div');
    const listBox = h('div');

    const drawNowPlaying = () => {
      const st = state.music;
      const g = GENRES.find((x) => x.id === st.genre);
      np.replaceChildren(h('div', { class: 'now-playing' },
        h('div', { class: `np-art${st.playing ? ' spin' : ''}` }, g?.emoji || (st.genre === 'mine' ? '⭐' : '🎵')),
        h('div', { style: { flex: 1 } },
          h('small', {}, st.playing ? 'Now playing' : 'Paused'),
          h('h2', { style: { margin: '2px 0' } }, st.name || 'Nothing yet'),
          h('small', {}, g?.name || (st.genre === 'mine' ? 'My music' : '')),
          h('div', { class: 'progress' }, h('div', { style: { width: `${st.duration ? Math.min(100, (st.position / st.duration) * 100) : 0}%` } })),
          h('small', {}, st.duration ? `${fmt(st.position)} / ${fmt(st.duration)}` : ''),
          h('div', { class: 'big-controls', style: { marginTop: '8px' } },
            button('⏮', () => cv.music.cmd({ action: 'prev' })),
            button(st.playing ? '⏸' : '▶', () => cv.music.cmd({ action: 'toggle' }), 'primary'),
            button('⏭', () => cv.music.cmd({ action: 'next' })),
            h('span', { style: { width: '10px' } }),
            chips({
              small: true, value: [state.settings.music.shuffle ? 'shuffle' : null].filter(Boolean), multi: true,
              options: [{ value: 'shuffle', label: 'Shuffle', emoji: '🔀' }],
              onChange: (v) => { set({ music: { shuffle: v.includes('shuffle') } }); drawNowPlaying(); },
            }),
            chips({
              small: true, value: state.settings.music.repeat,
              options: [{ value: 'all', label: 'Repeat all', emoji: '🔁' }, { value: 'one', label: 'Repeat one', emoji: '🔂' }, { value: 'off', label: 'No repeat', emoji: '➡️' }],
              onChange: (v) => { set({ music: { repeat: v } }); drawNowPlaying(); },
            })))));
    };

    const trackRow = (t, user) => h('div', {
      class: `item${state.music.track === t.id ? ' active' : ''}`, style: { cursor: 'pointer' },
      onclick: () => { cv.music.cmd({ action: 'select', track: t.id, play: true }); set({ music: { track: t.id } }); },
    },
    h('span', {}, state.music.track === t.id && state.music.playing ? '🔊' : '▶'),
    h('span', { class: 'grow' }, t.name),
    user ? button('🗑️', async (e) => {
      e.stopPropagation();
      if (!(await confirmBox('Remove song?', `Remove "${t.name}" from CursorVerse? (Your original file stays where it was.)`, 'Remove'))) return;
      await cv.library.remove(t.file);
      await set({ music: { userTracks: state.settings.music.userTracks.filter((x) => x.id !== t.id) } });
      nav.refresh();
    }, 'small') : null);

    const drawList = () => listBox.replaceChildren(
      ...GENRES.map((g) => section(`${g.emoji} ${g.name}`, h('div', { class: 'list' }, TRACKS.filter((t) => t.genre === g.id).map((t) => trackRow(t, false))))),
      section('⭐ My music',
        h('div', { class: 'list' }, state.settings.music.userTracks.map((t) => trackRow(t, true))),
        h('div', { style: { marginTop: '10px' } }, button('➕ Add songs (MP3, WAV, OGG, M4A, FLAC)', async () => {
          const files = await cv.library.import('music', true);
          if (!files.length) return;
          await set({ music: { userTracks: [...state.settings.music.userTracks, ...files.map((f) => ({ id: `user-${f.id}`, name: f.name, file: f.file }))] } });
          nav.refresh();
        }, 'primary'))),
    );

    drawNowPlaying();
    drawList();
    main.append(
      h('div', { class: 'page-head' }, h('div', {}, h('h2', {}, '🎵 Music'), h('p', {}, 'Keeps playing when you close the window. Built-in songs are made live by CursorVerse, so they are all original.'))),
      h('div', { class: 'grid2' },
        section(null, np),
        section('🎚️ Settings',
          slider({ label: 'Music volume', min: 0, max: 1, step: 0.01, value: m.volume, format: (v) => `${Math.round(v * 100)}%`, onInput: (v) => set({ music: { volume: v } }) }),
          h('div', { style: { marginTop: '10px' } }, toggle({ label: 'Play music when CursorVerse starts', checked: m.autoplay, onChange: (v) => set({ music: { autoplay: v } }) })))),
      h('div', { style: { height: '16px' } }),
      listBox,
    );
    this.drawNowPlaying = drawNowPlaying;
    this.drawList = drawList;
  },
  onMusic() {
    this.drawNowPlaying?.();
    const key = `${state.music.track}|${state.music.playing}`;
    if (key !== this.lastKey) { this.lastKey = key; this.drawList?.(); }
  },
};
