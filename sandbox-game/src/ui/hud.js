// Minimal realistic HUD: crosshair, hotbar, one line of tool info, small status tags.
import { hotbar, toolStatus } from '../game/tools.js';
import { BY_ID } from '../game/catalog.js';
import { getSettings } from '../settings.js';
import { physicsState } from '../engine/physics.js';
import { thumbFor } from './thumbs.js';

const $ = (id) => document.getElementById(id);
let lastSlotsKey = '';
let fpsAcc = 0, fpsFrames = 0, fpsShown = 0;
const hintQueue = [];
let hintT = 0;
const seen = loadSeen();

function loadSeen() {
  try { return new Set(JSON.parse(localStorage.getItem('rls.hints') || '[]')); } catch (_) { return new Set(); }
}
function saveSeen() { try { localStorage.setItem('rls.hints', JSON.stringify([...seen])); } catch (_) { /* ignore */ } }

// Small one-time tips ("Press B to spawn"), can be turned off in settings.
export function hint(id, text) {
  if (!getSettings().hints || seen.has(id)) return;
  seen.add(id);
  saveSeen();
  hintQueue.push(text);
}

export function showHud(v) { $('hud').classList.toggle('hidden', !v); }

export function updateHud(realDt, player) {
  // hotbar
  const key = hotbar.slots.map((s) => s.id).join(',') + '|' + hotbar.index;
  if (key !== lastSlotsKey) {
    lastSlotsKey = key;
    const bar = $('hotbar');
    bar.innerHTML = '';
    hotbar.slots.forEach((s, i) => {
      const d = document.createElement('div');
      d.className = 'slot' + (i === hotbar.index ? ' active' : '');
      const def = BY_ID[s.id];
      const img = s.kind === 'item' ? thumbFor(def) : null;
      d.innerHTML = `<span class="num">${i + 1}</span>` + (img ? `<img src="${img}" alt="">` : `<span>${def?.name || ''}</span>`);
      bar.appendChild(d);
    });
  }
  const st = toolStatus();
  $('tool-info').innerHTML = (st.looking ? `<div style="color:#cfd3d8;margin-bottom:4px">${st.looking}</div>` : '') + st.line;

  // jetpack fuel bar only while it matters
  const jp = $('jetpack');
  jp.classList.toggle('show', player.fuel < 3.15 || player.jetting);
  $('jetpack-fill').style.width = `${(player.fuel / 3.2) * 100}%`;

  // status tags
  const tags = [];
  if (player.flying) tags.push('FLY');
  if (physicsState.targetTimeScale < 1) tags.push('SLOW-MO');
  if (getSettings().godMode) tags.push('GOD MODE');
  $('status-tags').innerHTML = tags.map((t) => `<span>${t}</span>`).join('');

  // fps
  fpsAcc += realDt; fpsFrames++;
  if (fpsAcc > 0.5) { fpsShown = Math.round(fpsFrames / fpsAcc); fpsAcc = 0; fpsFrames = 0; }
  $('fps').textContent = getSettings().showFps ? `${fpsShown} FPS` : '';

  // hints
  const h = $('hint');
  if (hintT > 0) { hintT -= realDt; if (hintT <= 0) h.classList.remove('show'); }
  else if (hintQueue.length) { h.textContent = hintQueue.shift(); h.classList.add('show'); hintT = 5; }
}

export function refreshHotbar() { lastSlotsKey = ''; }
