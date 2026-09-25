// Backpack, hotbar, crafting panel, held-item models, eating/equipping and build mode.
import * as THREE from 'three';
import { ITEMS, RECIPES, item } from './items.js';
import { ui } from '../core/ui.js';
import { input } from '../core/input.js';
import { sfx } from '../core/audio.js';
import { unlock } from './achievements.js';
import { G } from './state.js';
import { attack, updateCombat } from './combat.js';

const SLOTS = 25, HOTBAR = 8;
const $ = (id) => document.getElementById(id);

export class Inventory {
  constructor() {
    this.slots = new Array(SLOTS).fill(null);
    this.sel = 0;
    this.armor = null;
    this.tab = 'Tools';
    this.heldId = null;
    this.buildGhost = null;
    this.buildYaw = 0;
    this.stash = null;
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'KeyI') {
        if (G.mode === 'play' || G.mode === 'inventory') { e.preventDefault(); this.toggle(); }
      }
      if (e.code === 'Escape' && G.mode === 'inventory') this.toggle(false);
    });
  }

  clear() { this.slots.fill(null); this.sel = 0; this.armor = null; this.stash = null; this.renderHotbar(); this.updateHeld(); }

  serialize() { return { slots: this.slots, sel: this.sel, armor: this.armor, stash: this.stash }; }
  load(d) { this.slots = d.slots || new Array(SLOTS).fill(null); this.sel = d.sel || 0; this.armor = d.armor || null; this.stash = d.stash || null; this.renderHotbar(); this.updateHeld(); }

  count(id) { return this.slots.reduce((n, s) => n + (s && s.id === id ? s.count : 0), 0); }
  has(req) { return Object.entries(req).every(([id, n]) => this.count(id) >= n); }

  add(id, n = 1, quiet = false) {
    const def = item(id);
    const stackable = def.type !== 'tool' && def.type !== 'weapon' && def.type !== 'armor';
    let left = n;
    if (stackable) {
      for (const s of this.slots) if (s && s.id === id && s.count < 99) { const k = Math.min(99 - s.count, left); s.count += k; left -= k; if (!left) break; }
    }
    while (left > 0) {
      const i = this.slots.indexOf(null);
      if (i < 0) { ui.toast('🎒 Backpack full!'); break; }
      if (stackable) { const k = Math.min(99, left); this.slots[i] = { id, count: k }; left -= k; }
      else { this.slots[i] = { id, count: 1, dur: def.dur ? 1 : undefined }; left--; }
    }
    if (!quiet && n - left > 0) { ui.toast(`${def.icon} +${n - left} <b>${def.name}</b>`, 2200); sfx('pickup'); }
    this.renderHotbar();
    this.updateHeld();
    return left;
  }

  remove(id, n = 1) {
    let left = n;
    for (let i = this.slots.length - 1; i >= 0 && left > 0; i--) {
      const s = this.slots[i];
      if (s && s.id === id) { const k = Math.min(s.count, left); s.count -= k; left -= k; if (s.count <= 0) this.slots[i] = null; }
    }
    this.renderHotbar();
    this.updateHeld();
    return n - left;
  }

  selected() { return this.slots[this.sel]; }

  renderHotbar() {
    const arr = [];
    for (let i = 0; i < HOTBAR; i++) {
      const s = this.slots[i];
      arr.push(s ? { icon: item(s.id).icon, count: s.count, dur: s.dur } : null);
    }
    ui.hotbar(arr, this.sel);
  }

  // Remove everything that's too big to hold at germ size (restored later).
  stashForMicro() {
    const kept = [], stash = [];
    this.slots.forEach((s) => { if (!s) return; const d = item(s.id); if ((d.type === 'weapon' || d.type === 'tool' || d.type === 'armor' || d.type === 'build') && !d.micro) stash.push(s); else if (d.micro || d.type === 'food' || d.type === 'key') kept.push(s); else stash.push(s); });
    this.stash = stash;
    this.slots = new Array(SLOTS).fill(null);
    kept.forEach((s, i) => { this.slots[i] = s; });
    if (this.armor && !item(this.armor).micro) this.armor = null;
    this.renderHotbar(); this.updateHeld();
    return stash.length;
  }
  restoreStash() {
    if (!this.stash) return;
    this.stash.forEach((s) => { const i = this.slots.indexOf(null); if (i >= 0) this.slots[i] = s; });
    this.stash = null;
    this.renderHotbar(); this.updateHeld();
  }

  // ---------------------------------------------------------------- held item visuals
  updateHeld() {
    const P = G.player;
    if (!P) return;
    const s = this.selected();
    const id = s ? s.id : null;
    if (id === this.heldId) return;
    this.heldId = id;
    const def = id ? item(id) : null;
    P.rig.hold(def && (def.type === 'tool' || def.type === 'weapon') ? heldMesh(id) : null);
  }

  // ---------------------------------------------------------------- panel
  canCraftHere(needs) {
    const lvl = G.level;
    if (needs === 'micro') return lvl && lvl.id === 'micro';
    if (!lvl || lvl.id !== 'yard') return false;
    if (needs === 'workbench') return lvl.nearStructure && lvl.nearStructure('workbench', G.player.body.pos, 12);
    return true;
  }

  toggle(force) {
    const open = force !== undefined ? force : G.mode !== 'inventory';
    if (open && G.mode !== 'play') return;
    if (open) {
      G.mode = 'inventory';
      this.cancelBuild();
      input.exitLock();
      this.tab = G.level && G.level.id === 'micro' ? 'Germ' : this.tab === 'Germ' ? 'Tools' : this.tab;
      this.renderPanel();
      $('inventory').classList.remove('hidden');
      sfx('click');
    } else {
      $('inventory').classList.add('hidden');
      if (G.mode === 'inventory') G.mode = 'play';
      input.requestLock();
    }
  }

  renderPanel() {
    const grid = $('inv-grid');
    grid.innerHTML = '';
    this.slots.forEach((s, i) => {
      const d = document.createElement('div');
      d.className = 'slot' + (i === this.sel ? ' sel' : '');
      d.innerHTML = `${i < HOTBAR ? `<span class="k">${i + 1}</span>` : ''}${s ? item(s.id).icon : ''}${s && s.count > 1 ? `<span class="c">${s.count}</span>` : ''}`;
      d.onmouseenter = () => this.detail(s);
      d.onclick = () => {
        // click: swap into the selected hotbar slot / select it
        if (i < HOTBAR) { this.sel = i; }
        else if (s) { const t = this.slots[this.sel]; this.slots[this.sel] = s; this.slots[i] = t; }
        this.renderPanel(); this.renderHotbar(); this.updateHeld();
      };
      d.oncontextmenu = (e) => { e.preventDefault(); if (s) this.use(i); this.renderPanel(); };
      grid.appendChild(d);
    });
    const note = $('craft-note');
    const lvlId = G.level ? G.level.id : '';
    note.textContent = lvlId === 'house' || lvlId === 'phone' ? '— you can only craft outside' : '';
    const cats = lvlId === 'micro' ? ['Germ'] : ['Tools', 'Weapons', 'Survival', 'Build'];
    if (!cats.includes(this.tab)) this.tab = cats[0];
    $('craft-tabs').innerHTML = cats.map((c) => `<button class="${c === this.tab ? 'on' : ''}" data-tab="${c}">${c}</button>`).join('');
    $('craft-tabs').querySelectorAll('button').forEach((b) => { b.onclick = () => { this.tab = b.dataset.tab; this.renderPanel(); sfx('click'); }; });
    const list = $('craft-list');
    list.innerHTML = '';
    RECIPES.filter((r) => r.cat === this.tab).forEach((r) => {
      const def = item(r.id);
      const ok = this.has(r.req) && this.canCraftHere(r.needs);
      const reqHtml = Object.entries(r.req).map(([id, n]) => `<span class="${this.count(id) >= n ? 'ok' : 'no'}">${item(id).icon} ${item(id).name} ${this.count(id)}/${n}</span>`).join(' &nbsp; ');
      const where = r.needs === 'workbench' ? ' &middot; <i>needs a Workbench nearby</i>' : '';
      const d = document.createElement('div');
      d.className = 'recipe' + (ok ? '' : ' cant');
      d.innerHTML = `<div class="ic">${def.icon}</div><div><div class="nm">${def.name}${r.count ? ` x${r.count}` : ''}</div><div class="req">${reqHtml}${where}</div><div class="desc">${def.desc}</div></div>`;
      d.onclick = () => this.craft(r);
      list.appendChild(d);
    });
    this.detail(this.selected());
  }

  detail(s) {
    const el = $('inv-detail');
    if (!s) { el.innerHTML = this.armor ? `Wearing: <b>${item(this.armor).name}</b>` : 'Hover an item to see what it is. Right-click to use / eat / wear.'; return; }
    const d = item(s.id);
    el.innerHTML = `<b>${d.icon} ${d.name}</b><br>${d.desc}${d.dmg ? `<br>Damage ${d.dmg}` : ''}${d.heal ? `<br>Heals ${d.heal}` : ''}${d.armor ? `<br>Armor ${Math.round(d.armor * 100)}%` : ''}`;
  }

  craft(r) {
    if (!this.canCraftHere(r.needs)) {
      sfx('error');
      ui.toast(r.needs === 'workbench' ? '🛠️ You need to stand near a <b>Workbench</b>.' : r.needs === 'micro' ? 'Only at germ size.' : 'You can only craft <b>outside</b>.');
      return;
    }
    if (!this.has(r.req)) { sfx('error'); ui.toast('Not enough materials.'); return; }
    for (const [id, n] of Object.entries(r.req)) this.remove(id, n);
    this.add(r.id, r.count || 1, true);
    sfx('craft');
    G.stats.crafted++;
    const def = item(r.id);
    ui.toast(`${def.icon} Crafted <b>${def.name}</b>!`);
    if (r.id === 'axe') { unlock('firstaxe'); G.flags.craftedAxe = true; }
    if (def.type === 'weapon' && !def.micro) unlock('armed');
    if (def.micro) unlock('microcraft');
    if (G.level && G.level.onCraft) G.level.onCraft(r.id);
    this.renderPanel();
  }

  use(i = this.sel) {
    const s = this.slots[i];
    if (!s) return;
    const d = item(s.id);
    const P = G.player;
    if (d.type === 'food') {
      if (P.health >= P.maxHealth) { ui.toast('You\'re already at full health.'); return; }
      P.heal(d.heal);
      this.remove(s.id, 1);
      sfx(s.id === 'dew' ? 'drink' : 'eat');
      ui.toast(`${d.icon} +${d.heal} health`);
    } else if (d.type === 'armor') {
      this.armor = this.armor === s.id ? null : s.id;
      sfx('place');
      ui.toast(this.armor ? `${d.icon} Wearing <b>${d.name}</b>` : 'Took off armour.');
    } else if (d.type === 'build') {
      this.startBuild(s.id);
    }
  }

  armorMul() { return this.armor ? 1 - item(this.armor).armor : 1; }

  // ---------------------------------------------------------------- build mode
  startBuild(id) {
    const lvl = G.level;
    if (!lvl || !lvl.placeStructure) { ui.toast('You can only build outside.'); return; }
    this.cancelBuild();
    this.buildId = id;
    this.buildGhost = lvl.structureGhost(id);
    lvl.scene.add(this.buildGhost);
    ui.toast(`${item(id).icon} <b>Build mode</b>: left click to place, R to rotate, B to cancel`, 4000);
  }
  cancelBuild() {
    if (this.buildGhost) { this.buildGhost.parent && this.buildGhost.parent.remove(this.buildGhost); this.buildGhost = null; this.buildId = null; }
  }

  // ---------------------------------------------------------------- per-frame input
  update(dt) {
    updateCombat(dt);
    if (G.mode !== 'play' || !G.player || G.player.mode === 'dead') return;
    for (let i = 0; i < HOTBAR; i++) if (input.wasPressed(`Digit${i + 1}`)) { this.sel = i; this.renderHotbar(); this.updateHeld(); this.cancelBuild(); }
    if (input.isDown('AltLeft') && input.wheel()) { this.sel = (this.sel + (input.wheel() > 0 ? 1 : HOTBAR - 1)) % HOTBAR; this.renderHotbar(); this.updateHeld(); }
    if (input.wasPressed('KeyF')) this.use();
    const s = this.selected();
    if (input.wasPressed('KeyB')) {
      if (this.buildGhost) this.cancelBuild();
      else if (s && item(s.id).type === 'build') this.startBuild(s.id);
      else ui.toast('Select a buildable item (craft one in the Build tab) and press B.');
    }
    if (this.buildGhost) {
      const P = G.player;
      if (input.wasPressed('KeyR')) this.buildYaw += Math.PI / 4;
      const fwd = new THREE.Vector3(Math.sin(P.camYaw), 0, Math.cos(P.camYaw));
      const p = P.body.pos.clone().addScaledVector(fwd, 5);
      p.y = G.level.world.surfaceBelow(p.x, P.body.pos.y + 3, p.z);
      if (!Number.isFinite(p.y)) p.y = P.body.pos.y;
      this.buildGhost.position.copy(p);
      this.buildGhost.rotation.y = P.camYaw + this.buildYaw;
      if (input.mousePressed(0)) {
        G.level.placeStructure(this.buildId, p, this.buildGhost.rotation.y);
        this.remove(this.buildId, 1);
        sfx('place');
        unlock('builder');
        if (!this.count(this.buildId)) this.cancelBuild();
      }
      return;
    }
    if (input.mousePressed(0) && input.locked) attack(s ? s.id : null, this);
  }

  wearTool(slot) {
    if (!slot || slot.dur === undefined) return;
    const d = item(slot.id);
    slot.dur -= 1 / (d.dur || 100);
    if (slot.dur <= 0) {
      const i = this.slots.indexOf(slot);
      if (i >= 0) this.slots[i] = null;
      ui.toast(`${d.icon} Your <b>${d.name}</b> broke!`);
      sfx('crunch');
      this.updateHeld();
    }
    this.renderHotbar();
  }
}

// Procedural models for held tools/weapons (sized for a 1.8-unit person).
const heldCache = new Map();
export function heldMesh(id) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.9 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x8d8a84, roughness: 0.85 });
  const fiber = new THREE.MeshStandardMaterial({ color: 0xb5a26b, roughness: 1 });
  const g = new THREE.Group();
  const stick = (len, r = 0.035, mat = wood) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, len, 8), mat); m.position.y = len / 2 - 0.15; m.castShadow = true; g.add(m); return m; };
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; g.add(m); return m; };
  switch (id) {
    case 'axe': stick(0.8); add(new THREE.DodecahedronGeometry(0.13, 0), stone, 0.08, 0.6, 0).scale.set(1.4, 1, 0.5); add(new THREE.TorusGeometry(0.05, 0.015, 6, 12), fiber, 0, 0.6, 0, Math.PI / 2); break;
    case 'pickaxe': stick(0.8); add(new THREE.ConeGeometry(0.06, 0.5, 6), stone, 0.15, 0.62, 0, 0, 0, -Math.PI / 2); add(new THREE.ConeGeometry(0.06, 0.3, 6), stone, -0.12, 0.62, 0, 0, 0, Math.PI / 2); break;
    case 'spear': stick(1.5, 0.03, new THREE.MeshStandardMaterial({ color: 0x6d8f3a, roughness: 0.8 })); add(new THREE.ConeGeometry(0.06, 0.22, 6), stone, 0, 1.4, 0); break;
    case 'club': stick(0.7); add(new THREE.DodecahedronGeometry(0.17, 1), stone, 0, 0.6, 0); break;
    case 'thorn_sword': stick(0.25, 0.04); add(new THREE.ConeGeometry(0.07, 0.95, 8), new THREE.MeshPhysicalMaterial({ color: 0x7a3a2a, roughness: 0.4, clearcoat: 0.6 }), 0, 0.6, 0); add(new THREE.BoxGeometry(0.25, 0.04, 0.06), wood, 0, 0.12, 0); break;
    case 'rapier': stick(0.2, 0.035); add(new THREE.ConeGeometry(0.03, 1.2, 6), new THREE.MeshStandardMaterial({ color: 0x3a2a24, roughness: 0.3, metalness: 0.3 }), 0, 0.72, 0); add(new THREE.TorusGeometry(0.08, 0.012, 6, 16), new THREE.MeshStandardMaterial({ color: 0xc9a45c, metalness: 1, roughness: 0.3 }), 0, 0.12, 0, Math.PI / 2); break;
    case 'hammer': stick(0.85); add(new THREE.ConeGeometry(0.12, 0.45, 8), new THREE.MeshPhysicalMaterial({ color: 0x2a1a10, roughness: 0.3, clearcoat: 1 }), 0.12, 0.7, 0, 0, 0, -Math.PI / 2); break;
    case 'bow': add(new THREE.TorusGeometry(0.45, 0.025, 6, 24, Math.PI), wood, 0, 0.3, 0, 0, Math.PI / 2, Math.PI / 2); add(new THREE.CylinderGeometry(0.004, 0.004, 0.9, 4), fiber, 0, 0.3, 0.02); break;
    case 'torch': {
      stick(0.6);
      const flame = add(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb040 }), 0, 0.5, 0);
      flame.scale.set(1, 1.6, 1);
      const l = new THREE.PointLight(0xff9a40, 30, 18, 2); l.position.y = 0.55; g.add(l);
      g.userData.flame = flame; g.userData.light = l;
      break;
    }
    case 'parasol': stick(1.0, 0.025); add(new THREE.ConeGeometry(0.75, 0.25, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0x5e8a2f, roughness: 0.7, side: THREE.DoubleSide }), 0, 0.95, 0); break;
    case 'diatom_blade': stick(0.2, 0.04, new THREE.MeshStandardMaterial({ color: 0x3a7a8a })); add(new THREE.OctahedronGeometry(0.12, 0), new THREE.MeshPhysicalMaterial({ color: 0x9ff4ff, roughness: 0.05, transparent: true, opacity: 0.7, emissive: 0x2aa0c0, emissiveIntensity: 0.6 }), 0, 0.6, 0).scale.set(0.6, 4, 0.3); break;
    case 'whip': { const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.1, 0.5, 0.1), new THREE.Vector3(-0.1, 1.0, 0.3), new THREE.Vector3(0.15, 1.4, 0.2)]); add(new THREE.TubeGeometry(c, 20, 0.02, 5), new THREE.MeshStandardMaterial({ color: 0xb05aff, emissive: 0x5a20a0, emissiveIntensity: 0.8 }), 0, 0, 0); break; }
    case 'blaster': add(new THREE.BoxGeometry(0.12, 0.14, 0.4), new THREE.MeshStandardMaterial({ color: 0xff7ad0, emissive: 0x802060, emissiveIntensity: 0.6, roughness: 0.3 }), 0, 0.05, 0.12); add(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 10), new THREE.MeshStandardMaterial({ color: 0x9fffd0, emissive: 0x30ff90, emissiveIntensity: 1 }), 0, 0.07, 0.35, Math.PI / 2); break;
    default: stick(0.6); break;
  }
  g.rotation.x = Math.PI / 2 - 0.2;
  return g;
}
