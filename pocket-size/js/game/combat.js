// Melee swings, ranged projectiles, harvesting hits, loot and floating damage numbers.
import * as THREE from 'three';
import { item } from './items.js';
import { sfx } from '../core/audio.js';
import { ui } from '../core/ui.js';
import { unlock } from './achievements.js';
import { G } from './state.js';

let cooldown = 0;
const pending = [];
const projectiles = [];
const numbers = [];

export function attack(id, inv) {
  const P = G.player;
  if (cooldown > 0 || !P || P.mode !== 'walk' || P.carry) return;
  const def = id ? item(id) : null;
  const weapon = def && (def.type === 'weapon' || def.type === 'tool') ? def : null;
  P.facing = P.camYaw;
  if (weapon && weapon.ranged) {
    if (weapon.ranged === 'arrow') {
      if (!inv.count('arrow')) { ui.toast('🏹 No arrows! Craft Thorn Arrows.'); sfx('error'); cooldown = 0.3; return; }
      inv.remove('arrow', 1);
    }
    cooldown = weapon.speed;
    P.rig.trigger('throw', 0.35);
    sfx(weapon.ranged === 'arrow' ? 'swing' : 'zap', { vol: 0.6 });
    fire(weapon, P);
    inv.wearTool(inv.selected());
    return;
  }
  cooldown = weapon ? weapon.speed : 0.42;
  P.rig.trigger(weapon ? (weapon.tool === 'axe' || weapon.tool === 'pickaxe' ? 'chop' : 'swing') : 'punch', weapon ? Math.max(0.35, weapon.speed * 0.9) : 0.32);
  sfx('swing', { vol: 0.5 });
  pending.push({ t: weapon ? Math.min(0.28, weapon.speed * 0.45) : 0.12, weapon, slot: inv.selected(), inv });
}

function resolveHit(h) {
  const P = G.player;
  const lvl = G.level;
  if (!lvl || !P) return;
  const w = h.weapon;
  const reach = w ? w.reach : 1.4;
  const dmg = w ? w.dmg : 5;
  const fwd = new THREE.Vector3(Math.sin(P.facing), 0, Math.cos(P.facing));
  const origin = P.body.pos.clone().add(new THREE.Vector3(0, 1, 0));
  let hitSomething = false;
  for (const c of lvl.creatures || []) {
    if (c.dead || c.invulnerable) continue;
    const to = new THREE.Vector3(c.body.pos.x - origin.x, 0, c.body.pos.z - origin.z);
    const d = to.length() - c.body.radius;
    if (d > reach) continue;
    const dy = (c.body.pos.y + c.body.height * 0.5) - origin.y;
    if (Math.abs(dy) > c.body.height * 0.5 + 1.5) continue;
    if (to.lengthSq() > 0.01 && to.normalize().dot(fwd) < 0.35) continue;
    const crit = Math.random() < 0.12;
    const final = Math.round(dmg * (crit ? 1.8 : 1) * (0.9 + Math.random() * 0.2));
    const killed = c.hit(final, P.body.pos);
    popNumber(c.body.pos.clone().add(new THREE.Vector3(0, c.body.height + 0.4, 0)), final, crit);
    sfx(w ? 'hit' : 'punch', { pos: c.body.pos });
    P.shake += 0.08;
    hitSomething = true;
    if (killed) onKill(c);
    break;
  }
  if (!hitSomething && lvl.harvest) {
    const point = origin.clone().addScaledVector(fwd, Math.min(reach, 1.6));
    hitSomething = lvl.harvest(point, w ? w.tool || 'weapon' : null, dmg, fwd);
  }
  if (hitSomething && w && h.slot) h.inv.wearTool(h.slot);
}

export function onKill(c) {
  G.stats.kills++;
  if (c.isBug) {
    G.stats.bugs++;
    if (G.stats.bugs >= 25) unlock('exterminator');
  }
  if (c.isVirus) { G.stats.viruses = (G.stats.viruses || 0) + 1; if (G.stats.viruses >= 5) unlock('antivirus'); }
  if (c.isSpider) unlock('spiderslayer');
  if (c.loot && G.inventory) for (const [id, n] of c.loot) if (Math.random() < (c.lootChance ?? 1)) G.inventory.add(id, n);
  if (c.onKilledByPlayer) c.onKilledByPlayer();
}

function fire(weapon, P) {
  const cam = G.camera;
  const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
  const start = P.body.pos.clone().add(new THREE.Vector3(0, 1.3, 0)).addScaledVector(dir, 0.6);
  const enzyme = weapon.ranged === 'enzyme';
  const geo = enzyme ? new THREE.SphereGeometry(0.15, 10, 8) : new THREE.CylinderGeometry(0.02, 0.02, 0.8, 5);
  const mat = enzyme ? new THREE.MeshBasicMaterial({ color: 0x7affc0 }) : new THREE.MeshStandardMaterial({ color: 0x7a3a2a });
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(start);
  if (!enzyme) m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  G.level.scene.add(m);
  projectiles.push({ m, vel: dir.multiplyScalar(enzyme ? 40 : 55), life: 2.5, dmg: weapon.dmg, gravity: enzyme ? 0 : 12, level: G.level });
}

export function popNumber(pos, n, crit = false) {
  const el = document.createElement('div');
  el.textContent = n;
  el.style.cssText = `position:fixed;z-index:25;pointer-events:none;font-weight:900;font-size:${crit ? 26 : 18}px;color:${crit ? '#ffd24a' : '#fff'};text-shadow:0 2px 4px #000;transform:translate(-50%,-50%)`;
  document.body.appendChild(el);
  numbers.push({ el, pos: pos.clone(), t: 0 });
}

export function updateCombat(dt) {
  cooldown = Math.max(0, cooldown - dt);
  for (let i = pending.length - 1; i >= 0; i--) {
    pending[i].t -= dt;
    if (pending[i].t <= 0) { resolveHit(pending[i]); pending.splice(i, 1); }
  }
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.life -= dt;
    p.vel.y -= p.gravity * dt;
    const step = p.vel.clone().multiplyScalar(dt);
    p.m.position.add(step);
    if (p.gravity) p.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.vel.clone().normalize());
    let done = p.life <= 0 || p.level !== G.level;
    if (!done) {
      for (const c of G.level.creatures || []) {
        if (c.dead || c.invulnerable) continue;
        const center = c.body.pos.clone().add(new THREE.Vector3(0, c.body.height * 0.5, 0));
        if (center.distanceTo(p.m.position) < c.body.radius + Math.max(0.4, c.body.height * 0.4)) {
          const killed = c.hit(p.dmg, p.m.position);
          popNumber(center.add(new THREE.Vector3(0, c.body.height * 0.6, 0)), p.dmg);
          sfx('hit', { pos: c.body.pos });
          if (killed) onKill(c);
          done = true;
          break;
        }
      }
      const g = G.level.world.surfaceBelow(p.m.position.x, p.m.position.y + 0.2, p.m.position.z);
      if (p.m.position.y < g) done = true;
    }
    if (done) { p.m.parent && p.m.parent.remove(p.m); p.m.geometry.dispose(); projectiles.splice(i, 1); }
  }
  const cam = G.camera;
  for (let i = numbers.length - 1; i >= 0; i--) {
    const n = numbers[i];
    n.t += dt;
    n.pos.y += dt * 1.2;
    const v = n.pos.clone().project(cam);
    if (v.z > 1 || n.t > 0.9) { n.el.remove(); numbers.splice(i, 1); continue; }
    n.el.style.left = `${(v.x * 0.5 + 0.5) * window.innerWidth}px`;
    n.el.style.top = `${(-v.y * 0.5 + 0.5) * window.innerHeight}px`;
    n.el.style.opacity = String(1 - n.t / 0.9);
  }
}
