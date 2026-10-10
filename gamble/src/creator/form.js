// The DMV application form on a clipboard: the creator's whole UI.
// Numbered form sections (accordion, one open at a time) generated from HUMAN_PARAM_SCHEMA:
// ranges become ink-tick scales, enums become check-box grids, colours become fabric swatches,
// bools become Yes/No boxes. Values are written in "blue ink". Mutates `model` in place and calls
// hooks.change(kind, key) so the state can debounce rebuilds.
//
//   const form = createForm(model, hooks);  uiRoot.append(form.el);  form.refresh();

import { el } from '../core/util.js';
import { t, onLanguageChange } from '../core/i18n.js';
import { PARAM_INDEX, SKIN_RAMP } from '../character/schema.js';
import { uiSound, vary } from '../ui/sfx.js';
import { injectFormStyle } from './formstyle.js';

// Which schema params live in which form section (order = print order on the form).
export const SECTIONS = [
  { id: 'body', key: 'secBody', params: ['height', 'fat', 'muscle', 'shoulders', 'chest', 'waist', 'hips', 'belly', 'legs', 'handSize', 'walkStyle'] },
  { id: 'face', key: 'secFace', params: ['faceWidth', 'jaw', 'chin', 'cheeks', 'cheekbones', 'noseSize', 'noseWidth', 'noseBridge', 'noseTip', 'ears', 'earsOut', 'browRidge', 'lips', 'mouthWidth'] },
  { id: 'eyes', key: 'secEyes', params: ['eyeColor', 'heterochromia', 'eyeColor2', 'eyeSize', 'eyeSpacing', 'eyeTilt', 'lids', 'browThickness', 'browArch'] },
  { id: 'hair', key: 'secHair', params: ['hairStyle', 'hairColor', 'gray', 'hairVolume'] },
  { id: 'beard', key: 'secBeard', params: ['facialHair', 'stubble'] },
  { id: 'skin', key: 'secSkin', params: ['skinTone', 'undertone', 'freckles', 'moles', 'birthmark', 'acne', 'wrinkles', 'scar', 'blush', 'bodyHair'] },
  { id: 'clothes', key: 'secClothes', params: ['top', 'topColor', 'print', 'bottom', 'bottomColor', 'shoes', 'shoesColor', 'outer', 'outerColor', 'hat', 'hatColor', 'glasses', 'hearingAid', 'wear', 'dirtiness'] },
  { id: 'voice', key: 'secVoice', params: ['voicePitch', 'voiceRate'] },
];

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const skinGradient = () => `linear-gradient(90deg, ${SKIN_RAMP.map(hex).join(',')})`;

export function createForm(model, hooks) {
  injectFormStyle();
  const binders = []; // () => void, re-read model into controls (rebuilt with the sheet)
  const fixed = []; // binders for controls that survive rebuilds (applicant block)
  let open = 'body';
  let lastSlideSound = 0;

  const root = el('div', { class: 'dmv' });
  const board = el('div', { class: 'dmv-board' });
  const clip = el('div', { class: 'dmv-clip' }, [el('div', { class: 'dmv-clip-ring' })]);
  const paper = el('div', { class: 'dmv-paper' });
  board.append(clip, paper);
  root.append(board);

  const tickSound = () => {
    const now = performance.now();
    if (now - lastSlideSound > 70) {
      lastSlideSound = now;
      uiSound('ui.slider', { rate: vary(0.1), gain: 0.5 });
    }
  };

  // ---- controls ---------------------------------------------------------------------------
  function rangeControl(def, get, set) {
    const input = el('input', { type: 'range', min: def.min, max: def.max, step: def.step ?? (def.max - def.min) / 100, class: 'dmv-range' });
    if (def.key === 'skinTone') input.style.setProperty('--track', skinGradient());
    input.addEventListener('input', () => {
      set(parseFloat(input.value));
      tickSound();
    });
    binders.push(() => (input.value = get()));
    return input;
  }

  function enumControl(def, get, set, color = false) {
    const wrap = el('div', { class: color ? 'dmv-swatches' : 'dmv-checks' });
    const boxes = def.options.map((o) => {
      const b = el('button', { class: color ? 'dmv-swatch' : 'dmv-check', type: 'button', title: o.label });
      if (color) b.style.setProperty('--c', hex(o.hex));
      else b.append(el('span', { class: 'box' }), el('span', { class: 'lbl', text: o.label }));
      b.addEventListener('click', () => {
        set(o.value);
        uiSound('ui.click', { rate: vary() });
        sync();
      });
      wrap.append(b);
      return [o.value, b];
    });
    const sync = () => boxes.forEach(([v, b]) => b.classList.toggle('on', get() === v));
    binders.push(sync);
    return wrap;
  }

  function boolControl(get, set) {
    return enumControl({ options: [{ value: true, label: t('creator.yes') }, { value: false, label: t('creator.no') }] }, get, set);
  }

  function paramRow(key, n) {
    const def = PARAM_INDEX.get(key);
    if (!def) return null;
    const get = () => model.params[key];
    const set = (v) => {
      model.params[key] = v;
      hooks.change('param', key);
    };
    let ctl;
    if (def.type === 'range') ctl = rangeControl(def, get, set);
    else if (def.type === 'color') ctl = enumControl(def, get, set, true);
    else if (def.type === 'bool') ctl = boolControl(get, set);
    else ctl = enumControl(def, get, set);
    const row = el('div', { class: `dmv-field t-${def.type}` }, [el('label', {}, [el('i', { text: `${n}.` }), def.label]), ctl]);
    if (key === 'eyeColor2') binders.push(() => row.classList.toggle('muted', !model.params.heterochromia));
    return row;
  }

  // ---- header + applicant block -----------------------------------------------------------
  const first = el('input', { class: 'dmv-ink', maxlength: 16, autocomplete: 'off', spellcheck: 'false' });
  const last = el('input', { class: 'dmv-ink', maxlength: 18, autocomplete: 'off', spellcheck: 'false' });
  first.addEventListener('input', () => { model.first = first.value; hooks.change('name'); });
  last.addEventListener('input', () => { model.last = last.value; hooks.change('name'); });
  const ageOut = el('span', { class: 'dmv-ink dmv-age' });
  const ageRange = el('input', { type: 'range', min: 21, max: 90, step: 1, class: 'dmv-range' });
  ageRange.addEventListener('input', () => {
    model.age = model.params.age = parseInt(ageRange.value, 10);
    ageOut.textContent = model.age;
    tickSound();
    hooks.change('param', 'age');
  });
  fixed.push(() => {
    first.value = model.first;
    last.value = model.last;
    ageRange.value = model.age;
    ageOut.textContent = model.age;
  });

  const stamp = (cls, text, fn, sound = 'ui.confirm') => {
    const b = el('button', { class: `dmv-stamp ${cls}`, type: 'button', text });
    b.addEventListener('click', () => {
      uiSound(sound, { rate: vary() });
      fn();
    });
    return b;
  };

  // ---- voice block ------------------------------------------------------------------------
  const voiceSel = el('div', { class: 'dmv-voices' });
  function renderVoices() {
    const voices = hooks.voices();
    voiceSel.replaceChildren();
    if (!voices.length) {
      voiceSel.append(el('div', { class: 'dmv-note', text: t('creator.voiceNone') }));
      return;
    }
    const opts = [{ voiceURI: '', name: t('creator.voiceDefault') }, ...voices];
    for (const v of opts) {
      const b = el('button', { type: 'button', class: 'dmv-check' }, [el('span', { class: 'box' }), el('span', { class: 'lbl', text: v.name.replace(/\s*\(.*\)$/, '') })]);
      b.classList.toggle('on', (model.voiceURI || '') === v.voiceURI);
      b.addEventListener('click', () => {
        model.voiceURI = v.voiceURI;
        uiSound('ui.click', { rate: vary() });
        renderVoices();
        hooks.preview();
      });
      voiceSel.append(b);
    }
  }

  // ---- build the whole sheet (also on language change) ------------------------------------
  const sectionEls = new Map();
  function build() {
    binders.length = 0;
    paper.replaceChildren();
    sectionEls.clear();
    paper.append(
      el('header', { class: 'dmv-head' }, [
        el('div', { class: 'dmv-seal' }, [el('span', { text: 'NV' })]),
        el('div', {}, [el('div', { class: 'dmv-dept', text: t('creator.dept') }), el('div', { class: 'dmv-sub', text: t('creator.state') })]),
        el('div', { class: 'dmv-formno', text: t('creator.formNo') }),
      ]),
      el('h1', { class: 'dmv-title', text: t('creator.formTitle') }),
      el('section', { class: 'dmv-sec open dmv-applicant' }, [
        el('h2', {}, [el('b', { text: 'A' }), t('creator.applicant')]),
        el('div', { class: 'dmv-names' }, [
          el('div', { class: 'dmv-field' }, [el('label', {}, [el('i', { text: '1.' }), t('creator.last')]), last]),
          el('div', { class: 'dmv-field' }, [el('label', {}, [el('i', { text: '2.' }), t('creator.first')]), first]),
        ]),
        el('div', { class: 'dmv-field dmv-agerow' }, [el('label', {}, [el('i', { text: '3.' }), t('creator.age'), ageOut]), ageRange, el('div', { class: 'dmv-note', text: t('creator.ageNote') })]),
        el('div', { class: 'dmv-actions' }, [
          stamp('ghost', t('creator.randomName'), () => hooks.randomName(), 'ui.paper'),
          stamp('ghost', t('creator.randomAll'), () => hooks.randomAll(), 'ui.card-flip'),
        ]),
      ]),
    );
    let n = 4;
    SECTIONS.forEach((s, i) => {
      const body = el('div', { class: 'dmv-sec-body' });
      for (const k of s.params) {
        const row = paramRow(k, n);
        if (row) { body.append(row); n++; }
      }
      if (s.id === 'voice') {
        body.append(
          el('div', { class: 'dmv-field' }, [el('label', {}, [el('i', { text: `${n++}.` }), t('creator.voiceSystem')]), voiceSel]),
          el('div', { class: 'dmv-actions' }, [stamp('ghost', `▶ ${t('creator.voicePreview')}`, () => hooks.preview(), 'ui.click')]),
        );
        renderVoices();
      }
      const shuffle = el('button', { class: 'dmv-shuffle', type: 'button', title: t('creator.randomSection'), text: t('creator.randomSection') });
      shuffle.addEventListener('click', (e) => {
        e.stopPropagation();
        uiSound('ui.card-flip', { rate: vary() });
        hooks.randomSection(s);
      });
      const head = el('h2', { tabindex: 0 }, [el('b', { text: String.fromCharCode(66 + i) }), el('span', { text: t(`creator.${s.key}`) }), shuffle, el('span', { class: 'chev' })]);
      const sec = el('section', { class: 'dmv-sec' }, [head, body]);
      const toggle = () => {
        open = open === s.id ? null : s.id;
        uiSound('ui.paper', { rate: vary(), gain: 0.7 });
        syncOpen();
        if (open) setTimeout(() => sec.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
        hooks.section?.(open);
      };
      head.addEventListener('click', toggle);
      head.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle()));
      sectionEls.set(s.id, sec);
      paper.append(sec);
    });
    const photoBtn = stamp('photo', t('creator.takePhoto'), () => hooks.photo(), 'ui.confirm');
    paper.append(
      el('footer', { class: 'dmv-foot' }, [
        el('div', { class: 'dmv-sign' }, [el('span', { class: 'sig', text: `${model.first} ${model.last}` }), el('label', { text: `✕ ${t('creator.signHere')}` })]),
        photoBtn,
        el('div', { class: 'dmv-office', text: t('creator.office') }),
      ]),
    );
    binders.push(() => (paper.querySelector('.sig').textContent = `${model.first} ${model.last}`.trim()));
    syncOpen();
    refresh();
  }

  function syncOpen() {
    for (const [id, sec] of sectionEls) sec.classList.toggle('open', id === open);
  }

  function refresh() {
    for (const b of fixed) b();
    for (const b of binders) b();
  }

  build();
  const offLang = onLanguageChange(build);
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.addEventListener?.('voiceschanged', renderVoices);

  return {
    el: root,
    refresh,
    /** Open a section by id (dev / screenshots). */
    open(id) { open = id; syncOpen(); sectionEls.get(id)?.scrollIntoView({ block: 'start' }); hooks.section?.(id); },
    setBusy(b) { root.classList.toggle('busy', b); },
    hide(h) { root.classList.toggle('away', h); },
    destroy() {
      offLang?.();
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.removeEventListener?.('voiceschanged', renderVoices);
      root.remove();
    },
  };
}
