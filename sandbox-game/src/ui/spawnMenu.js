// Spawn menu (B): tabs, search, picture grid. Shapes get a material picker.
import { TABS, itemsForTab, CATALOG, TOOLS } from '../game/catalog.js';
import { MATERIALS, SHAPE_MATERIALS } from '../gfx/materials.js';
import { setSlotItem, setShapeMaterial, getShapeMaterial } from '../game/tools.js';
import { renderThumbs, thumbFor } from './thumbs.js';
import { refreshHotbar } from './hud.js';

const $ = (id) => document.getElementById(id);
let tab = 'Shapes';
let onPick = null;

export function initSpawnMenu(pickCallback) {
  onPick = pickCallback;
  const tabs = $('spawn-tabs');
  for (const t of TABS) {
    const el = document.createElement('div');
    el.className = 'tab';
    el.textContent = t;
    el.onclick = () => { tab = t; $('spawn-search').value = ''; render(); };
    tabs.appendChild(el);
  }
  $('spawn-search').addEventListener('input', render);
}

export function openSpawnMenu() {
  renderThumbs(CATALOG);
  $('spawn-menu').classList.remove('hidden');
  render();
}
export function closeSpawnMenu() { $('spawn-menu').classList.add('hidden'); $('spawn-search').blur(); }
export function spawnMenuOpen() { return !$('spawn-menu').classList.contains('hidden'); }

function render() {
  const q = $('spawn-search').value.trim().toLowerCase();
  [...$('spawn-tabs').children].forEach((el) => el.classList.toggle('active', !q && el.textContent === tab));
  const grid = $('spawn-grid');
  grid.innerHTML = '';
  let items;
  if (q) items = [...CATALOG, ...TOOLS].filter((d) => d.name.toLowerCase().includes(q) || (MATERIALS[d.mat]?.name || '').toLowerCase().includes(q));
  else items = itemsForTab(tab);

  if (!q && tab === 'Shapes') {
    const row = document.createElement('div');
    row.style.cssText = 'grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:13px;color:#9aa1a9;margin-bottom:4px';
    row.innerHTML = '<span style="margin-right:6px">Material:</span>';
    const chip = (id, label) => {
      const c = document.createElement('div');
      const active = (getShapeMaterial() || null) === id;
      c.className = 'tab' + (active ? ' active' : '');
      c.textContent = label;
      c.onclick = () => { setShapeMaterial(id); render(); };
      row.appendChild(c);
    };
    chip(null, 'Default');
    for (const m of SHAPE_MATERIALS) chip(m, MATERIALS[m].name);
    grid.appendChild(row);
  }

  for (const d of items) {
    const el = document.createElement('div');
    el.className = 'item';
    const img = thumbFor(d);
    const matName = d.tool ? (d.tab === 'Weapons' ? 'Weapon' : 'Tool') : d.tab === 'Shapes' ? MATERIALS[getShapeMaterial() || d.mat].name : '';
    el.innerHTML = (img ? `<img src="${img}" alt="">` : `<div style="height:80px;display:flex;align-items:center;justify-content:center;font-size:28px;color:#f0a23b">${d.tab === 'Weapons' ? '✦' : '⚙'}</div>`)
      + `<div class="name">${d.name}</div>` + (matName ? `<div class="mat">${matName}</div>` : '');
    el.title = d.desc || '';
    el.onclick = () => {
      setSlotItem(d, { mat: d.tab === 'Shapes' ? getShapeMaterial() : null });
      refreshHotbar();
      onPick?.();
    };
    grid.appendChild(el);
  }
}
