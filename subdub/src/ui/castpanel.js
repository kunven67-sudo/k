// Characters panel: every voice SUBDUB found, girl/boy switch, pick their English voice, hear it, rename them.
import { h, icon } from './dom.js';
import { ALL_VOICES, GROUPS } from '../engine/voicebank.js';
import { resample, semitones } from '../lib/resample.js';

const GROUP_NAMES = { girl: 'Girls', littlegirl: 'Little girls', woman: 'Women', boy: 'Boys', littleboy: 'Little boys', man: 'Men', deepman: 'Deep voices' };
let previewCtx = null;

export async function previewVoice(engine, v, text = "Hey! This is how I sound in English.") {
  const tts = await engine.start('tts');
  const ratio = semitones(v.shift || 0);
  const r = await tts.call('speak', { text, mix: v.mix, speed: 1 / ratio });
  previewCtx ??= new AudioContext();
  const x = resample(r.audio, r.sr * ratio, previewCtx.sampleRate);
  const ab = previewCtx.createBuffer(1, x.length, previewCtx.sampleRate); ab.copyToChannel(x, 0);
  const s = previewCtx.createBufferSource(); s.buffer = ab; s.connect(previewCtx.destination); s.start();
}

export function castPanel({ cast, engine, onVoiceChange }) {
  const root = h('div', { class: 'castlist' });
  const render = () => {
    root.textContent = '';
    const chars = cast.chars.filter(c => c.lines > 0 || c.override || c.pickedByUser).sort((a, b) => b.lines - a.lines);
    if (!chars.length) { root.append(h('div', { class: 'empty' }, 'Characters show up here as they talk. Each one gets their own English voice.')); return; }
    for (const c of chars) {
      const g = cast.gender(c), v = cast.voice(c);
      const sel = h('select', { 'aria-label': `English voice for ${c.name}`, onchange: (e) => { cast.setVoice(c, e.target.value); onVoiceChange?.(c); } },
        Object.entries(GROUPS).map(([gk, list]) => h('optgroup', { label: GROUP_NAMES[gk] }, list.map(x => h('option', { value: x.id, selected: x.id === v.id }, x.label)))));
      root.append(h('div', { class: 'char' },
        h('div', { class: 'top' },
          h('span', { class: 'sw', style: { background: c.color } }),
          h('input', { class: 'nm', value: c.name, 'aria-label': 'Character name', onchange: (e) => cast.rename(c, e.target.value.trim() || c.name) }),
          h('span', { class: 'meta' }, `${c.lines} line${c.lines === 1 ? '' : 's'}`)),
        h('div', { class: 'row' },
          h('div', { class: 'toggle', role: 'group', 'aria-label': 'Girl or boy' },
            h('button', { class: 'girl' + (g === 'girl' ? ' on' : ''), onclick: () => { if (g !== 'girl') { cast.flip(c); onVoiceChange?.(c); } } }, 'Girl'),
            h('button', { class: 'boy' + (g === 'boy' ? ' on' : ''), onclick: () => { if (g !== 'boy') { cast.flip(c); onVoiceChange?.(c); } } }, 'Boy')),
          sel,
          h('button', { class: 'play', title: 'Hear this voice', 'aria-label': 'Hear this voice', onclick: (e) => { e.currentTarget.disabled = true; previewVoice(engine, cast.voice(c), c.lastText || undefined).finally(() => (e.currentTarget.disabled = false)); } }, icon('play'))),
        c.lastText ? h('div', { class: 'last', title: c.lastText }, `"${c.lastText}"`) : null));
    }
  };
  render();
  let t = null;
  const off = cast.onChange(() => { clearTimeout(t); t = setTimeout(render, 150); });
  root.destroy = off;
  return root;
}
export { ALL_VOICES };
