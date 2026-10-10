// People at the tables: dealers (uniform, name tag, personality, hourly relief), NPC players
// (their own bankroll and personality — DESIGN golden rule 2), and the speech-bubble layer with
// optional browser speech (EN/ES through the player's voice helper).
import * as THREE from 'three';
import { createHuman, randomHumanParams } from '../../../character/index.js';
import { say } from '../../../player/voice.js';
import { injectStyle } from '../../../core/util.js';

const DEALER_NAMES = {
  f: ['Rita', 'Dee', 'Mae', 'Ines', 'Bev', 'Carla', 'Lupe', 'Jen', 'Tina', 'Marisol', 'Kim', 'Rosa'],
  m: ['Manny', 'Gus', 'Hal', 'Tony', 'Cruz', 'Ray', 'Earl', 'Danny', 'Hector', 'Phil', 'Lou', 'Vic'],
};

/** Dealer personalities: speed multiplies every animation, chat = how often they talk. */
const DEALER_TYPES = [
  { id: 'pro', speed: 1.15, chat: 0.45, warmth: 0.6 },
  { id: 'chatty', speed: 1.0, chat: 0.95, warmth: 0.9 },
  { id: 'grump', speed: 1.2, chat: 0.25, warmth: 0.2 },
  { id: 'rookie', speed: 0.85, chat: 0.6, warmth: 0.8 },
  { id: 'veteran', speed: 1.1, chat: 0.6, warmth: 0.7 },
];

export function makeDealer(rng, tier) {
  const sex = rng.pick(['m', 'f', 'm', 'f', 'x']);
  const nameSex = sex === 'x' ? rng.pick(['m', 'f']) : sex;
  const name = rng.pick(DEALER_NAMES[nameSex]);
  const params = randomHumanParams(rng, {
    uniform: 'dealer',
    sex,
    name,
    age: 23 + rng.int(0, 38),
    hat: 'none',
    glasses: rng.chance(0.18) ? rng.pick(['square', 'round', 'reading']) : 'none',
    dirtiness: 0,
    wear: 0.1,
  });
  const human = createHuman(params, { tier });
  return { human, name, type: rng.pick(DEALER_TYPES), params };
}

const NPC_TYPES = [
  // mistake: chance to deviate from basic strategy; style: how they bet.
  { id: 'regular', mistake: 0.03, style: 'flat', tip: 0.12, talk: 0.25 },
  { id: 'tourist', mistake: 0.18, style: 'hunch', tip: 0.05, talk: 0.45 },
  { id: 'drunk', mistake: 0.3, style: 'wild', tip: 0.2, talk: 0.7 },
  { id: 'nervous', mistake: 0.12, style: 'flat', tip: 0.02, talk: 0.15, neverBust: true },
  { id: 'chaser', mistake: 0.08, style: 'martingale', tip: 0.04, talk: 0.35 },
  { id: 'counter', mistake: 0.0, style: 'count', tip: 0.06, talk: 0.1 },
];

export function makeNpc(rng, tier, { min = 5 } = {}) {
  const params = randomHumanParams(rng, { hat: rng.chance(0.15) ? rng.pick(['cap', 'cowboy', 'fedora']) : 'none' });
  const human = createHuman(params, { tier });
  const type = rng.pick(NPC_TYPES);
  // Bankroll: most bring 10–40 table minimums, a few whales.
  const units = rng.chance(0.08) ? rng.int(60, 200) : rng.int(8, 40);
  return { human, params, type, bankroll: units * min, unit: min * (rng.chance(0.25) ? 2 : 1), lastBet: 0, losses: 0 };
}

/** Voice settings from the Human params (pitch/rate sliders). */
export function voiceOf(params) {
  return { pitch: 0.75 + (params?.voicePitch ?? 0.5) * 0.55, rate: 0.92 + (params?.voiceRate ?? 0.5) * 0.25, male: (params?.voicePitch ?? 0.5) < 0.5 };
}

// ---- speech bubbles ------------------------------------------------------------------------------

const CSS = `
.tbl-bubbles { position:absolute; inset:0; pointer-events:none; overflow:hidden; z-index:3; }
.tbl-bubble { position:absolute; left:0; top:0; max-width:min(240px, 60vw); padding:7px 11px 8px; border-radius:14px;
  background: linear-gradient(180deg, #fffdf6, #f1e9d6); color:#2a1c10; font: 600 13.5px/1.25 Inter, system-ui, sans-serif;
  box-shadow: 0 6px 16px rgba(0,0,0,.35), 0 0 0 1px rgba(120,90,40,.35); transform: translate(-50%, -100%);
  opacity:0; transition: opacity .25s ease; white-space: normal; text-align:center; }
.tbl-bubble.in { opacity:1; }
.tbl-bubble::after { content:''; position:absolute; left:50%; bottom:-7px; width:12px; height:12px; margin-left:-6px;
  background:#f1e9d6; transform: rotate(45deg); box-shadow: 1px 1px 0 rgba(120,90,40,.35); }
.tbl-bubble .who { display:block; font: 700 10px/1 Inter, system-ui, sans-serif; letter-spacing:.12em; text-transform:uppercase; color:#8a6a2a; margin-bottom:3px; }
.tbl-bubble.pit { background: linear-gradient(180deg, #2b2f38, #1b1e25); color:#f1e6c8; box-shadow: 0 6px 16px rgba(0,0,0,.45), 0 0 0 1px rgba(220,190,120,.35); }
.tbl-bubble.pit::after { background:#1b1e25; }
.tbl-bubble.pit .who { color:#d8b25a; }
`;

const _p = new THREE.Vector3();

export class Bubbles {
  constructor(engine) {
    this.engine = engine;
    this.list = [];
    this.el = null;
    this.speakNear = false; // TTS only when the player is at/near this table
  }

  _root() {
    if (this.el?.isConnected) return this.el;
    injectStyle('tbl-bubbles-css', CSS);
    const root = this.engine.uiRoot || document.getElementById('ui-root');
    if (!root) return null;
    this.el = document.createElement('div');
    this.el.className = 'tbl-bubbles';
    root.append(this.el);
    return this.el;
  }

  /**
   * Show a line above `anchor` (() => world Vector3) for a while; speak it when the player is at
   * the table. kind 'pit' = dark pit-boss bubble.
   */
  say(anchor, text, { who = '', voice = null, kind = '', dur = null } = {}) {
    const root = this._root();
    if (!text) return;
    // One bubble per speaker: replace their previous line.
    for (const b of this.list) if (b.anchor === anchor) b.until = 0;
    if (root) {
      const el = document.createElement('div');
      el.className = `tbl-bubble ${kind}`;
      if (who) {
        const w = document.createElement('span');
        w.className = 'who';
        w.textContent = who;
        el.append(w);
      }
      el.append(document.createTextNode(text));
      root.append(el);
      requestAnimationFrame(() => el.classList.add('in'));
      this.list.push({ el, anchor, until: performance.now() + (dur ?? 1800 + text.length * 55) });
    }
    if (this.speakNear && voice && !window.speechSynthesis?.speaking) {
      try {
        say(text, voice);
      } catch {
        /* no speech */
      }
    }
  }

  update(camera, maxDist = 8) {
    if (!this.list.length) return;
    const now = performance.now();
    const canvas = this.engine.renderer.domElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    this.list = this.list.filter((b) => {
      if (now > b.until) {
        b.el.classList.remove('in');
        setTimeout(() => b.el.remove(), 300);
        return false;
      }
      const a = b.anchor();
      const d = a.distanceTo(camera.position);
      _p.copy(a).project(camera);
      const vis = _p.z < 1 && d < maxDist && Math.abs(_p.x) < 1.1 && Math.abs(_p.y) < 1.1;
      b.el.style.display = vis ? '' : 'none';
      if (vis) {
        const x = (_p.x * 0.5 + 0.5) * w;
        const y = (-_p.y * 0.5 + 0.5) * h;
        b.el.style.left = `${Math.round(Math.min(w - 90, Math.max(90, x)))}px`;
        b.el.style.top = `${Math.round(Math.max(60, y))}px`;
      }
      return true;
    });
  }

  clear() {
    for (const b of this.list) b.el.remove();
    this.list = [];
  }

  dispose() {
    this.clear();
    this.el?.remove();
    this.el = null;
  }
}
