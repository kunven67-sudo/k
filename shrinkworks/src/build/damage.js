// Crashes, breaking, glass shattering and explosions.
import * as THREE from 'three';
import { R, world, events, owners, G, groups, toV, fromQ } from '../core/physics.js';
import { scene } from '../core/render.js';
import { MATS, partMaterial } from '../core/mats.js';
import { bodies, removePart, detachPart, partWorld, constructOf, bodyPose } from './core.js';
import { game } from '../game.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const lastSound = new Map(); // collider pair -> time
let breaksThisStep = 0;

// glass shards are real little physics pieces that clatter around, then fade
const shards = [];
const shardGeo = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.09, 0, 0.02, 0.03, 0.11, 0, 0, 0, 0, 0.03, 0.11, 0, 0.09, 0, 0.02], 3));
  g.computeVertexNormals();
  return g;
})();
export function shatter(p, at) {
  const m = MATS[p.mat] || MATS.glass;
  const center = at || partWorld(p, new THREE.Vector3());
  const v = p.body.rb.velocityAtPoint(center);
  const sz = p.size;
  const n = Math.min(14, 4 + Math.round(sz.x * sz.y * 8 + sz.z * 4));
  const mat = partMaterial(p.mat, p.color);
  for (let i = 0; i < n; i++) {
    const off = new THREE.Vector3((Math.random() - 0.5) * sz.x, (Math.random() - 0.5) * sz.y, (Math.random() - 0.5) * sz.z).applyQuaternion(p.quat);
    const { pos, quat } = bodyPose(p.body);
    const wp = off.add(p.pos).applyQuaternion(quat).add(pos);
    const rb = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(wp.x, wp.y, wp.z)
      .setLinvel(v.x + (Math.random() - 0.5) * 3, v.y + Math.random() * 2, v.z + (Math.random() - 0.5) * 3)
      .setAngvel({ x: Math.random() * 10, y: Math.random() * 10, z: Math.random() * 10 }));
    const c = world.createCollider(R.ColliderDesc.cuboid(0.045, 0.05, 0.012).setDensity(600).setFriction(0.5)
      .setCollisionGroups(groups(G.DEBRIS, G.WORLD | G.PARTS)), rb);
    const mesh = new THREE.Mesh(shardGeo, mat);
    mesh.castShadow = true;
    const s = 0.7 + Math.random() * 1.2;
    mesh.scale.setScalar(s);
    scene.add(mesh);
    shards.push({ rb, c, mesh, t: 5 + Math.random() * 3 });
  }
  while (shards.length > 120) killShard(shards.shift());
  game.sound(p.def.popSound ? 'pop' : 'glass', center, 1);
  if (p.def.popSound) game.fx.sparks(center, 6, 3, 0xffffff);
  removePart(p);
}
function killShard(s) { world.removeRigidBody(s.rb); scene.remove(s.mesh); }
export function updateShards(dt) {
  for (let i = shards.length - 1; i >= 0; i--) {
    const s = shards[i];
    s.t -= dt;
    const t = s.rb.translation(), r = s.rb.rotation();
    s.mesh.position.set(t.x, t.y, t.z);
    s.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    if (s.t < 1) s.mesh.scale.multiplyScalar(0.94);
    if (s.t <= 0) { killShard(s); shards.splice(i, 1); }
  }
}

export function breakPart(p, at) {
  if (p.dead || breaksThisStep > 8) return;
  breaksThisStep++;
  const m = MATS[p.mat];
  if ((m && m.fragile) || p.def.fragile) { shatter(p, at); return; }
  if (p.def.explosive && p.props.impact) { game.detonate(p); return; }
  const here = at || partWorld(p, new THREE.Vector3());
  game.fx.sparks(here, m && m.sound === 'metal' ? 16 : 4, 5, m && m.sound === 'metal' ? 0xffc070 : 0xd8c8a8);
  game.fx.dust(here, 4, 0.5);
  game.sound('crack', here, 0.9);
  p.hp = 0.6;
  if (p.body.parts.size > 1) detachPart(p);
}

// every physics step: hits strong enough to make noise, break parts, set off barrels or hurt people
export function handleContacts(time) {
  breaksThisStep = 0;
  // what you hold never breaks in your hand (your hand pushes it hard into whatever is in the way); thrown, it can
  const held = game.heldBodies ? game.heldBodies() : null;
  const touched = game.handTouching ? game.handTouching() : null;
  events.drainContactForceEvents((e) => {
    const h1 = e.collider1(), h2 = e.collider2(), f = e.totalForceMagnitude();
    const o1 = owners.get(h1), o2 = owners.get(h2);
    for (const [o, other] of [[o1, o2], [o2, o1]]) {
      if (!o) continue;
      if (o.kind === 'part') {
        const p = o.ref;
        if (p.dead) continue;
        if (p.def.explosive && p.props.impact && f > Math.max(9000, p.body.rb.mass() * 98.1 * 25)) { game.detonate(p); continue; }
        // your hands push things around but never rip glued parts off (reaching through a gadget fast would break it)
        if (game.settings.breaking && p.breakAt && f > p.breakAt && !(held && held.has(p.body)) && !(touched && touched.has(p.body)) && !(other && other.kind === 'hand')) {
          // where did it get hit: close enough to use the part's own spot
          breakPart(p);
          continue;
        }
      } else if (o.kind === 'human' && o.ref.impact) {
        o.ref.impact(f, other);
      }
    }
    // crash sound: once per pair, louder for harder hits
    const key = h1 < h2 ? h1 * 65536 + h2 : h2 * 65536 + h1;
    const last = lastSound.get(key) || -1;
    if (time - last > 0.18) {
      lastSound.set(key, time);
      const src = (o1 && o1.kind === 'part') ? o1.ref : (o2 && o2.kind === 'part') ? o2.ref : null;
      if (src && !src.dead) {
        const m = MATS[src.mat];
        const vol = Math.min(1, Math.log10(Math.max(1, f / Math.max(200, src.body.rb.mass() * 20))) * 0.55 + 0.15);
        game.sound(m ? m.sound : 'soft', partWorld(src, _v), vol);
      }
    }
  });
  if (lastSound.size > 4000) lastSound.clear();
}

/* ---------------- explosions ---------------- */
const pending = [];
export function detonate(p, delay = 0) {
  if (p.dead || p.st.boom) return;
  p.st.boom = true;
  pending.push({ p, t: delay });
}
export function updateExplosions(dt, ctx) {
  for (let i = pending.length - 1; i >= 0; i--) {
    const e = pending[i];
    e.t -= dt;
    if (e.t > 0) continue;
    pending.splice(i, 1);
    if (e.p.dead) continue;
    explode(partWorld(e.p, new THREE.Vector3()), e.p.props.power || 60, e.p, ctx);
  }
}
export function explode(at, power, src, ctx) {
  const radius = 4 + power * 0.09, push = 10 + power * 0.32;
  if (src && !src.dead) removePart(src);
  game.fx.explosion(at, 0.6 + power / 90);
  game.sound('boom', at, 1);
  ctx.flash(at, power);
  ctx.shake(Math.max(0, 1 - ctx.playerPos.distanceTo(at) / (radius * 4)) * (0.4 + power / 120));
  const hitParts = [];
  for (const b of [...bodies]) {
    if (b.frozen) continue;
    const c = b.rb.worldCom();
    _v.set(c.x - at.x, c.y - at.y, c.z - at.z);
    const d = _v.length();
    if (d > radius + (b.radius || 1)) continue;
    const f = Math.pow(Math.max(0, 1 - Math.max(0, d - (b.radius || 0.5) * 0.5) / radius), 1.3);
    if (f <= 0) continue;
    _v.normalize().y += 0.35;
    const m = b.rb.mass();
    const dv = push * f * Math.min(1, 350 / Math.max(1, m)) + push * f * 0.15;
    b.rb.applyImpulse({ x: _v.x * dv * m, y: _v.y * dv * m, z: _v.z * dv * m }, true);
    b.rb.applyTorqueImpulse({ x: (Math.random() - 0.5) * m * dv, y: (Math.random() - 0.5) * m * dv, z: (Math.random() - 0.5) * m * dv }, true);
    for (const p of b.parts) {
      const pw = partWorld(p, _v2);
      const pd = pw.distanceTo(at);
      if (pd < radius * 0.55) hitParts.push([p, pd]);
    }
  }
  // close parts rip off (glass shatters, other barrels go off a moment later: chain reactions)
  hitParts.sort((a, b) => a[1] - b[1]);
  let n = 0;
  for (const [p, d] of hitParts) {
    if (p.dead) continue;
    if (p.def.explosive) { detonate(p, 0.08 + Math.random() * 0.18); continue; }
    const m = MATS[p.mat];
    if ((m && m.fragile) || p.def.fragile) { shatter(p); continue; }
    if (game.settings.breaking && n < 18 && Math.random() < 1.15 - d / (radius * 0.55) - (m ? m.strength / 25 : 0)) { detachPart(p); n++; }
  }
  ctx.blastHumans(at, radius, push);
  ctx.blastPlayer(at, radius, push);
}
