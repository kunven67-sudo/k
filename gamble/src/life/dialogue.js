// Speech bubble + reply choices, pinned above a speaker's head in the 3D view.
//
//   const d = openDialogue({ engine, anchor: () => worldPos, name, text, choices: [{label, onPick}] })
//   d.update()   (each frame, keeps the bubble on the speaker)   d.close()
//
// The bubble types itself out; choices appear when it's done. Number keys 1-9 pick a choice,
// Esc / walking away closes it. Looks like a comic bubble on cheap paper, not a game menu.

import * as THREE from 'three';
import { injectStyle, el } from '../core/util.js';
import { sfx } from './sounds.js';

injectStyle(
  'life-dialogue',
  `
.lf-dlg{position:absolute;left:0;top:0;z-index:30;pointer-events:none;font-family:var(--font-ui);
  transform:translate(-50%,-100%);width:min(340px,78vw);will-change:transform}
.lf-bub{position:relative;background:#fbf8f1;color:#17140f;border-radius:18px 18px 18px 18px;
  padding:12px 15px 13px;font-size:15px;line-height:1.38;letter-spacing:.005em;
  box-shadow:0 1px 0 rgba(255,255,255,.7) inset,0 10px 26px rgba(0,0,0,.38),0 2px 4px rgba(0,0,0,.25);
  background-image:radial-gradient(120% 90% at 20% 0%,#fffdf8 0%,#f5efe2 70%,#ece4d2 100%);
  animation:lfPop .28s cubic-bezier(.2,1.4,.4,1) both;transform-origin:30% 100%}
.lf-bub:after{content:'';position:absolute;left:28%;bottom:-11px;width:22px;height:16px;
  background:#efe8d8;clip-path:polygon(0 0,100% 0,15% 100%);filter:drop-shadow(0 3px 2px rgba(0,0,0,.2))}
.lf-name{display:block;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;
  color:#8a6a26;margin-bottom:3px}
.lf-txt{min-height:1.4em}
.lf-txt .lf-c{opacity:0}
.lf-choices{position:absolute;left:0;top:100%;display:flex;flex-direction:column;gap:7px;margin-top:20px;pointer-events:auto;align-items:flex-start}
.lf-ch{all:unset;cursor:pointer;display:flex;gap:10px;align-items:center;padding:9px 15px 9px 9px;
  border-radius:999px;background:rgba(14,12,10,.82);color:#f3ead8;font-size:14.5px;font-weight:500;
  box-shadow:0 6px 16px rgba(0,0,0,.35),0 0 0 1px rgba(216,178,90,.28) inset;backdrop-filter:blur(6px);
  -webkit-backdrop-filter:blur(6px);opacity:0;transform:translateY(6px);
  animation:lfIn .32s ease-out forwards;transition:background .15s,box-shadow .15s}
.lf-ch:hover,.lf-ch:focus-visible{background:rgba(30,24,16,.92);box-shadow:0 6px 18px rgba(0,0,0,.4),0 0 0 1.5px var(--gold) inset}
.lf-k{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;font-size:11.5px;font-weight:700;
  background:radial-gradient(circle at 35% 30%,#f6d88a,#b38a35);color:#2a1d06;box-shadow:0 0 0 2px #2a1d06 inset,0 0 0 3px #d8b25a inset}
.lf-ch.dim{opacity:.55!important}
@keyframes lfPop{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes lfIn{to{opacity:1;transform:none}}
@media (pointer:coarse){.lf-bub{font-size:16px}.lf-ch{font-size:16px;padding:12px 18px 12px 10px}}
`,
);

const _v = new THREE.Vector3();

export function openDialogue({ engine, anchor, name, text, choices = [], onClose }) {
  const root = el('div', { class: 'lf-dlg' });
  root.style.pointerEvents = 'none'; // #ui-root children default to auto; only the choices take clicks
  const nameEl = el('span', { class: 'lf-name' }, [name || '']);
  const txt = el('div', { class: 'lf-txt' });
  const bub = el('div', { class: 'lf-bub' }, [nameEl, txt]);
  const list = el('div', { class: 'lf-choices' });
  root.append(bub, list);
  (engine.uiRoot || document.body).appendChild(root);

  let closed = false;
  let typing = null;

  // Type the line out character by character (blips are quiet paper ticks).
  function setText(line, then) {
    clearInterval(typing);
    txt.textContent = '';
    const spans = [...line].map((ch) => {
      const s = el('span', { class: 'lf-c' }, [ch]);
      txt.appendChild(s);
      return s;
    });
    let i = 0;
    typing = setInterval(() => {
      for (let k = 0; k < 2 && i < spans.length; k++, i++) spans[i].style.opacity = 1;
      if (i % 6 === 0) sfx('ui.type', { bus: 'ui', gain: 0.15, rate: 0.9 + Math.random() * 0.2 });
      if (i >= spans.length) {
        clearInterval(typing);
        then?.();
      }
    }, 28);
  }

  function setChoices(items) {
    list.textContent = '';
    items.forEach((c, i) => {
      const b = el('button', { class: 'lf-ch' + (c.dim ? ' dim' : '') }, [el('span', { class: 'lf-k' }, [String(i + 1)]), c.label]);
      b.style.animationDelay = `${i * 70}ms`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        pick(i);
      });
      list.appendChild(b);
    });
    current = items;
  }
  let current = [];

  function pick(i) {
    const c = current[i];
    if (!c || closed) return;
    sfx('ui.click', { bus: 'ui' });
    c.onPick?.(api);
  }

  const onKey = (e) => {
    if (closed) return;
    if (e.code === 'Escape') close();
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= current.length) pick(n - 1);
  };
  window.addEventListener('keydown', onKey);

  function close() {
    if (closed) return;
    closed = true;
    clearInterval(typing);
    window.removeEventListener('keydown', onKey);
    root.style.transition = 'opacity .25s';
    root.style.opacity = '0';
    setTimeout(() => root.remove(), 260);
    onClose?.();
  }

  /** Say another line; replaces the choices with `next` once typed (or closes after `holdMs`). */
  function say(line, next = [], holdMs = 2600) {
    list.textContent = '';
    current = [];
    setText(line, () => {
      if (next.length) setChoices(next);
      else setTimeout(close, holdMs);
    });
  }

  function update() {
    if (closed) return;
    const cam = engine.camera;
    const p = anchor?.();
    if (!p || !cam) return;
    _v.copy(p).project(cam);
    const behind = _v.z > 1;
    const w = engine.width || innerWidth;
    const h = engine.height || innerHeight;
    // Keep it on screen even if the speaker drifts toward the edges.
    const bw = root.offsetWidth || 300;
    const x = Math.min(w - bw * 0.7 - 10, Math.max(bw * 0.3 + 10, (_v.x * 0.5 + 0.5) * w));
    const y = Math.min(h * 0.5, Math.max(bub.offsetHeight + 24, (-_v.y * 0.5 + 0.5) * h));
    root.style.transform = `translate(${x}px,${y}px) translate(-30%,-100%)`;
    root.style.visibility = behind ? 'hidden' : 'visible';
  }

  const api = { say, close, update, setChoices, get closed() { return closed; } };
  say(text, choices);
  update();
  return api;
}
