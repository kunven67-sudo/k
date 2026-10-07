// Boot screen 1: content warning. Typeset like the first page of a printed program: engraved
// rules, a row of hand-drawn line icons, and the virtual-money promise set apart in gold.
// Any key / click / tap continues. The EN/ES switch in the corner changes language in place.

import { el, injectStyle } from '../../core/util.js';
import { t, onLanguageChange } from '../../core/i18n.js';
import { settings } from '../../core/settings.js';
import '../strings.js';
import { uiSound } from '../sfx.js';
import { isTouch } from '../kit.js';

const CSS = /* css */ `
.bw { position: absolute; inset: 0; display: grid; place-items: center; grid-template-columns: minmax(0,1fr); overflow: hidden; box-sizing: border-box;
  padding: calc(20px + var(--safe-top)) calc(20px + var(--safe-right)) calc(20px + var(--safe-bottom)) calc(20px + var(--safe-left));
  background: radial-gradient(80% 70% at 50% 45%, #1a1311 0%, #0b0807 60%, #030202 100%); color: #e9dcc0; font-size: calc(16px * var(--text-scale));
  cursor: pointer; opacity: 0; transition: opacity .8s ease; }
.bw.in { opacity: 1; } .bw.out { opacity: 0; transition-duration: .5s; }
.bw::before { content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .5;
  background: repeating-linear-gradient(0deg, rgba(255,255,255,.012) 0 1px, transparent 1px 3px); }
.bw-inner { position: relative; width: min(720px, 100%); text-align: center; }
.bw-kicker { font: 400 .8em/1 var(--font-display); letter-spacing: .5em; color: #b99c63; opacity: 0; animation: bwUp .9s .2s ease forwards; }
.bw-title { margin: 14px 0 0; font: 700 clamp(2.2em, 7vw, 3.6em)/1 var(--font-casino); letter-spacing: .01em; color: #f4e6c4; opacity: 0; animation: bwUp 1s .35s ease forwards; }
.bw-rule { display: flex; align-items: center; gap: 14px; margin: 22px auto 24px; width: min(420px, 80%); color: #b99c63; opacity: 0; animation: bwIn 1s .6s ease forwards; }
.bw-rule::before, .bw-rule::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, transparent, #b99c63); }
.bw-rule::after { background: linear-gradient(270deg, transparent, #b99c63); }
.bw-rule span { font: 400 14px/1 var(--font-casino); }
.bw-icons { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px 22px; margin: 0 auto 26px; }
.bw-icon { width: 76px; display: flex; flex-direction: column; align-items: center; gap: 8px; opacity: 0; animation: bwUp .7s ease forwards; }
.bw-icon svg { width: 34px; height: 34px; fill: none; stroke: #e2cf9c; stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }
.bw-icon span { font: 500 .68em/1.2 var(--font-ui); letter-spacing: .12em; text-transform: uppercase; color: #a99878; }
.bw-body { max-width: 34em; margin: 0 auto; font: 400 1.12em/1.6 var(--font-casino); color: #d9ccb0; text-wrap: balance; opacity: 0; animation: bwUp 1s 1.1s ease forwards; }
.bw-money { display: inline-block; margin: 20px auto 0; padding: 12px 22px; border: 1px solid #b99c6377; border-radius: 3px; opacity: 0; animation: bwUp 1s 1.4s ease forwards;
  font: 400 1.05em/1.3 var(--font-display); letter-spacing: .2em; color: #f2d688; background: linear-gradient(180deg, rgba(242,214,140,.06), transparent); }
.bw-disc { margin-top: 18px; font: italic 400 .92em/1.4 var(--font-casino); color: #8f8168; opacity: 0; animation: bwUp 1s 1.6s ease forwards; }
.bw-go { position: absolute; left: 0; right: 0; bottom: calc(26px + var(--safe-bottom)); text-align: center; font: 400 .85em/1 var(--font-display); letter-spacing: .4em; color: #cbb489;
  opacity: 0; animation: bwIn 1s 2.2s ease forwards, bwPulse 2.4s 3.2s ease-in-out infinite; }
.bw-lang { position: absolute; top: calc(16px + var(--safe-top)); right: calc(16px + var(--safe-right)); display: flex; gap: 4px; z-index: 2; }
.bw-lang button { all: unset; cursor: pointer; padding: 7px 11px; border-radius: 999px; font: 600 .72em/1 var(--font-ui); letter-spacing: .1em; color: #a99878; border: 1px solid transparent; }
.bw-lang button[aria-pressed="true"] { color: #f2d688; border-color: #b99c6388; }
.bw-lang button:focus-visible { border-color: #f2d688; }
@keyframes bwUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes bwIn { to { opacity: 1; } }
@keyframes bwPulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
@media (max-width: 640px) { .bw-icons { gap: 14px 6px; } .bw-icon { width: 92px; } .bw-body { font-size: 1.02em; } .bw-money { letter-spacing: .12em; } }
@media (max-height: 560px) { .bw-icons { display: none; } .bw-rule { margin: 12px auto; } }
`;

// 24x24 line icons, drawn for this screen.
const ICONS = {
  violence: 'M5 19l9-9 M14 10l3-6 3 3-6 3 M7 13l4 4 M4 20l2-2',
  blood: 'M12 3c3 4.5 6 8 6 11a6 6 0 0 1-12 0c0-3 3-6.5 6-11z M9.5 15a2.5 2.5 0 0 0 2.5 2.5',
  alcohol: 'M7 3h10l-1 7a4 4 0 0 1-8 0z M12 14v6 M8.5 21h7 M7.6 7h8.8',
  smoking: 'M3 15h14v3H3z M19 15v3 M21 15v3 M17 11c0-2 2-2 2-4s-2-2-2-4',
  language: 'M4 5h16v10H9l-5 4z M8 10h1 M11 10h1 M14 9l2 2',
  gambling: 'M4 7l8-4 8 4v10l-8 4-8-4z M12 11v10 M4 7l8 4 8-4 M8 9.5h.01 M16 9.5h.01 M12 6h.01 M8 14.5h.01 M16 15.5h.01',
};

function svg(d) {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', d);
  s.appendChild(p);
  return s;
}

/** Shows the warning in `root`; resolves when the player continues. */
export function showWarning(root) {
  injectStyle('gx-boot-warning', CSS);
  return new Promise((resolve) => {
    const node = el('div', { class: 'bw', role: 'dialog', 'aria-labelledby': 'bw-title' });
    const render = () => {
      const keys = Object.keys(ICONS);
      const lang = el('div', { class: 'bw-lang' }, ['en', 'es'].map((code) => {
        const b = el('button', { type: 'button', text: code.toUpperCase(), 'aria-pressed': String(settings.get('language') === code) });
        b.addEventListener('pointerdown', (e) => e.stopPropagation());
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          uiSound('ui.toggle');
          settings.set('language', code);
        });
        return b;
      }));
      node.replaceChildren(
        lang,
        el('div', { class: 'bw-inner' }, [
          el('div', { class: 'bw-kicker', text: t('ui.warn.kicker').toUpperCase() }),
          el('h1', { class: 'bw-title', id: 'bw-title', text: t('ui.warn.title') }),
          el('div', { class: 'bw-rule' }, [el('span', { text: '♠ ♥ ♦ ♣' })]),
          el('div', { class: 'bw-icons' }, keys.map((k, i) => el('div', { class: 'bw-icon', style: { animationDelay: `${0.75 + i * 0.07}s` } }, [svg(ICONS[k]), el('span', { text: t(`ui.warn.${k}`) })]))),
          el('p', { class: 'bw-body', text: t('ui.warn.body') }),
          el('div', { class: 'bw-money', text: t('ui.warn.body2').toUpperCase() }),
          el('div', { class: 'bw-disc', text: t('ui.warn.discretion') }),
        ]),
        el('div', { class: 'bw-go', text: (isTouch() ? t('ui.warn.continueTouch') : t('ui.warn.continue')).toUpperCase() }),
      );
    };
    render();
    const offLang = onLanguageChange(render);
    root.appendChild(node);
    requestAnimationFrame(() => requestAnimationFrame(() => node.classList.add('in')));
    const t0 = performance.now();
    const go = (e) => {
      // Ignore the first instant so a key held from the page load doesn't skip the warning.
      if (performance.now() - t0 < 700) return;
      if (e?.target?.closest?.('.bw-lang')) return;
      window.removeEventListener('keydown', go);
      node.removeEventListener('pointerdown', go);
      offLang();
      uiSound('ui.confirm');
      node.classList.add('out');
      setTimeout(() => {
        node.remove();
        resolve();
      }, 520);
    };
    window.addEventListener('keydown', go);
    node.addEventListener('pointerdown', go);
  });
}
