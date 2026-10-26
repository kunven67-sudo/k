// The spider you play. Moves on ANY surface (floors, walls, ceilings, around edges), falls with gravity, drops on a
// silk line, swings on webs, zips, pounces, floats in space. Size is in metres; the zone converts to its units.
import * as THREE from 'three';
import { SPECIES } from '../spider/species.js';
import { buildSpider, applyFearMode } from '../spider/body.js';
import { SpiderRig } from '../spider/rig.js';
import { clamp, damp } from '../core/util.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion();
const _m = new THREE.Matrix4(), _gv = new THREE.Vector3();

// walking speed in body lengths / second: little spiders scurry, giants lumber (but cover huge ground)
export function walkBL(sizeM) { return clamp(7.5 * Math.pow(sizeM / 0.004, -0.11), 1.1, 9); }

export class Player {
  constructor(game, speciesId = 'widow') {
    this.game = game;
    this.speciesId = speciesId;
    this.sp = SPECIES[speciesId];
    this.sizeM = 0.004;            // body length in metres
    this.massK = 150;              // kg per m^3 of body length cubed (shape + density)
    this.pos = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);
    this.fwd = new THREE.Vector3(0, 0, 1);
    this.vel = new THREE.Vector3();
    this.mode = 'ground';          // ground | air | dangle | swing | zip | space | molt | held | dead
    this.rope = null;              // { anchor: Vector3, len }
    this.zipT = null;
    this.hp = 100; this.maxHp = 100;
    this.hunger = 0.85;            // 1 = full
    this.molt = 0;                 // 0..1, full = can molt
    this.silk = 1; this.venom = 1;
    this.thirst = 1;               // realistic mode only
    this.tired = 0;
    this.powers = {};              // id -> level
    this.evo = { venom: 0, silk: 0, body: 0, senses: 0, speed: 0 };
    this.mutationPoints = 0;
    this.soft = 0;                 // after molting: soft + weak for a while
    this.invuln = 0;
    this.lockTarget = null;
    this.vision = false;
    this.grounded = true;
    this.fallStartY = 0; this.airTime = 0;
    this.lastHurtBy = '';
    this.buildBody();
  }

  get s() { return this.sizeM / this.game.zone.unit; } // size in zone units
  // gravity the spider feels: real g when small. Big spiders get time scaled to their size (otherwise a 9 km spider
  // would hang in the air for two minutes per jump), so a jump always looks and feels like a jump.
  grav(out = _gv) { return out.copy(this.game.zone.gravity).multiplyScalar(Math.max(1, this.sizeM / 2)); }
  get mass() { return this.massK * this.sizeM ** 3; }

  buildBody(quality) {
    const old = this.body;
    const q = quality || (this.game.renderer.qName === 'low' ? 'low' : 'high');
    this.body = buildSpider(this.sp, { quality: q, hairMul: this.game.renderer.q.hair, fear: this.game.settings.fear });
    this.rig = new SpiderRig(this.body, this.sp, (o, d, far) => this.game.probe(o, d, far, this.s));
    this.rig.onStep = (L) => this.game.audio.step(this, L);
    if (old) { this.body.position.copy(old.position); this.body.quaternion.copy(old.quaternion); old.removeFromParent(); }
    this.applyPowerLooks();
  }

  setSpecies(id) { this.speciesId = id; this.sp = SPECIES[id]; this.buildBody(); this.attach(this.game.zone.scene); }
  attach(scene) { if (this.body.parent !== scene) scene.add(this.body); this.rig.initDone = false; }
  setFear(on) { applyFearMode(this.body, on); }

  applyPowerLooks() {
    const ud = this.body.userData; if (!ud.mats) return;
    const P = this.powers;
    for (const k of ['carapace', 'abdomen', 'legs']) {
      const u = ud.mats[k].userData.u;
      u.uElec.value = P.electric ? 0.6 + 0.2 * P.electric : 0;
      u.uLava.value = P.fire ? 0.5 + 0.25 * P.fire : 0;
      u.uRad.value = P.rad ? 0.6 + 0.2 * P.rad : 0;
      u.uStars.value = P.stars ? 0.5 + 0.25 * P.stars : 0;
      u.uVoid.value = P.void ? 1 : 0;
      u.uFrost.value = P.frost ? 0.6 + 0.2 * P.frost : 0;
      u.uAlien.value = P.alien ? 0.5 + 0.25 * P.alien : 0;
      u.uSoft.value = this.soft;
    }
    // armour plates + feathers are extra meshes (added once)
    if (P.armor && !ud.plates) { ud.plates = makePlates(this.sp); ud.abMesh.add(ud.plates); }
    if (P.glide && !ud.feathers) { ud.feathers = makeFeathers(this.sp); ud.body.add(ud.feathers); }
  }

  // ------------------------------------------------------------------ movement
  update(dt, input, camRig) {
    const G = this.game;
    const s = this.s;
    const zoneG = this.grav(); // zone units per s^2, scaled for big spiders
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.soft > 0) { this.soft = Math.max(0, this.soft - dt / 22); this.applySoft(); }
    // input -> wanted direction on the surface
    const F = _v, R = _v2;
    camRig.moveBasis(this.mode === 'space' ? _v3.set(0, 1, 0).applyQuaternion(camRig.frame) : this.up, F, R);
    let mx = 0, mz = 0;
    if (G.controlsOn) {
      if (input.is('forward')) mz += 1; if (input.is('back')) mz -= 1;
      if (input.is('right')) mx += 1; if (input.is('left')) mx -= 1;
    }
    const wish = new THREE.Vector3().addScaledVector(F, mz).addScaledVector(R, mx);
    const moving = wish.lengthSq() > 0.01;
    if (moving) wish.normalize();
    const sprint = G.controlsOn && input.is('sprint') && this.tired < 0.95;
    const speedBL = walkBL(this.sizeM) * (this.sp.stats.speed || 1) * (1 + 0.08 * this.evo.speed) * (sprint ? 2.0 : 1) * (this.soft > 0 ? 0.55 : 1)
      * (G.realistic && this.hunger < 0.15 ? 0.7 : 1) * (this.legsLost ? Math.max(0.4, 1 - this.legsLost * 0.12) : 1);
    const speed = speedBL * s;
    if (sprint && moving) this.tired = Math.min(1, this.tired + dt * (G.realistic ? 0.08 : 0.03)); else this.tired = Math.max(0, this.tired - dt * 0.06);

    switch (this.mode) {
      case 'ground': this._ground(dt, wish, moving, speed, zoneG, s); break;
      case 'air': this._air(dt, wish, zoneG, s, speed); break;
      case 'dangle': case 'swing': this._rope(dt, wish, zoneG, s, input); break;
      case 'zip': this._zip(dt, s); break;
      case 'space': this._space(dt, input, camRig, s, speed); break;
      default: break;
    }
    // orientation of the body: up + forward
    const fw = _v3.copy(this.fwd).addScaledVector(this.up, -this.fwd.dot(this.up));
    if (fw.lengthSq() < 1e-8) fw.copy(F);
    fw.normalize();
    const right = new THREE.Vector3().crossVectors(this.up, fw).normalize(); // +X = left in body space
    _m.makeBasis(right, this.up, fw);
    _q.setFromRotationMatrix(_m);
    this.body.quaternion.slerp(_q, 1 - Math.exp(-(this.mode === 'ground' ? 16 : 6) * dt));
    this.body.position.copy(this.pos);
    this.body.scale.setScalar(s);
    this.rig.mode = this.mode === 'ground' ? 'walk' : this.mode === 'space' ? 'space' : this.mode === 'dangle' || this.mode === 'swing' ? 'dangle' : this.mode === 'molt' ? 'molt' : 'air';
    this.rig.excite = this.lockTarget ? 1 : 0.2;
    this.rig.update(dt, speed / Math.max(s, 1e-12));
  }

  _ground(dt, wish, moving, speed, g, s) {
    const G = this.game;
    // accelerate toward the wanted velocity (tangent to the surface)
    const target = _v3.copy(wish).multiplyScalar(moving ? speed : 0);
    this.vel.lerp(target, 1 - Math.exp(-14 * dt));
    this.vel.addScaledVector(this.up, -this.vel.dot(this.up));
    if (moving) this.fwd.lerp(wish, 1 - Math.exp(-12 * dt)).normalize();
    const step = this.vel.clone().multiplyScalar(dt);
    const stepLen = step.length();
    const center = new THREE.Vector3().copy(this.pos).addScaledVector(this.up, s * 0.25);
    // 1) wall/obstacle ahead: climb onto it (concave corner)
    if (stepLen > 1e-12) {
      const dir = step.clone().divideScalar(stepLen);
      const ahead = G.probe(center, dir, s * 0.45 + stepLen, s);
      if (ahead && ahead.normal.dot(this.up) < 0.75) {
        const oldUp = this.up.clone();
        this.pos.copy(ahead.point);
        this.up.copy(ahead.normal);
        this.fwd.copy(oldUp); // walking up the wall = forward is the old up
        this.vel.set(0, 0, 0);
        return;
      }
    }
    const cand = new THREE.Vector3().copy(this.pos).add(step);
    // 2) stay on the surface under us
    const down = G.probe(_v.copy(cand).addScaledVector(this.up, s * 0.45), _v2.copy(this.up).negate(), s * 1.0, s);
    this.groundBox = down ? down.box || null : null;
    if (down) {
      this.pos.copy(down.point);
      this.up.lerp(down.normal, 1 - Math.exp(-22 * dt)).normalize();
      this.airTime = 0;
    } else if (stepLen > 1e-12) {
      // 3) the surface ended: wrap around the edge (convex corner) like a real spider
      const dir = step.clone().divideScalar(stepLen);
      const o = _v.copy(cand).addScaledVector(this.up, -s * 0.35).addScaledVector(dir, s * 0.1);
      const back = _v2.copy(dir).negate();
      const wrap = G.probe(o, back, s * 0.8, s);
      if (wrap && wrap.normal.dot(this.up) < 0.6) {
        const oldUp = this.up.clone();
        this.pos.copy(wrap.point);
        this.up.copy(wrap.normal);
        this.fwd.copy(oldUp).negate();
        this.vel.set(0, 0, 0);
      } else {
        this.startFall();
      }
    } else {
      // standing still with nothing under us (the thing we stood on got eaten / moved)
      const d2 = G.probe(_v.copy(this.pos).addScaledVector(this.up, s * 0.3), _v2.copy(this.up).negate(), s * 0.8, s);
      if (!d2) this.startFall();
    }
    // 4) don't sink into walls / table legs: push the body out
    const c2 = _v.copy(this.pos).addScaledVector(this.up, s * 0.28);
    const near = G.closest(c2, s * 0.3, s);
    if (near && near.normal.dot(this.up) < 0.5) this.pos.addScaledVector(near.normal, s * 0.3 - near.distance);
    // on ceilings / walls, gravity tries to pull you off when you're big and heavy (realistic mode)
    if (G.realistic && this.up.y < -0.3 && this.sizeM > 0.6) { if (Math.random() < dt * 0.4) this.startFall(); }
  }

  startFall() {
    this.mode = 'air';
    this.fallStartY = this.pos.y;
    this.airTime = 0;
    this.rig.mode = 'air';
  }

  _air(dt, wish, g, s, speed) {
    const G = this.game;
    this.airTime += dt;
    this.vel.addScaledVector(g, dt);
    // air drag: tiny things fall slowly (terminal speed grows with sqrt(size)); gliding falls even slower
    const vtM = Math.max((this.powers.glide ? 2.2 : 7) * Math.sqrt(Math.max(this.sizeM, 1e-6)) + 0.6, (this.powers.glide ? 6 : 25) * this.sizeM);
    const vt = vtM / G.zone.unit;
    const vs = this.vel.length();
    if (vs > vt) this.vel.multiplyScalar(vt / vs);
    this.vel.addScaledVector(wish, speed * dt * (this.powers.glide ? 2.2 : 0.9));
    // spider rights itself (up -> against gravity)
    const gUp = _v.copy(g).negate();
    if (gUp.lengthSq() > 0) { gUp.normalize(); this.up.lerp(gUp, 1 - Math.exp(-3 * dt)).normalize(); }
    const stepV = this.vel.clone().multiplyScalar(dt);
    const sl = stepV.length();
    if (sl > 1e-12) {
      const dir = stepV.clone().divideScalar(sl);
      const hit = G.probe(_v.copy(this.pos).addScaledVector(this.up, s * 0.2), dir, sl + s * 0.3, s);
      if (hit) { this.land(hit, vs); return; }
    }
    this.pos.add(stepV);
    if (this.vel.lengthSq() > 1e-12) {
      const hv = _v2.copy(this.vel).addScaledVector(this.up, -this.vel.dot(this.up));
      if (hv.lengthSq() > 1e-10) this.fwd.lerp(hv.normalize(), 1 - Math.exp(-4 * dt)).normalize();
    }
    if (G.zone.killY !== undefined && this.pos.y < G.zone.killY) G.die('fell into the dark');
  }

  land(hit, speedZone) {
    const G = this.game;
    this.pos.copy(hit.point);
    this.up.copy(hit.normal);
    this.mode = 'ground';
    const impactM = speedZone * G.zone.unit; // m/s
    // real physics: small animals can't get hurt by falling (air drag); big heavy ones break
    const safe = Math.max(9 * Math.pow(Math.max(this.sizeM, 1e-4), -0.35) + 6, 9 * this.sizeM);
    if (impactM > safe) {
      const dmg = (impactM - safe) / safe * 60 * (G.realistic ? 1.6 : 1);
      this.hurt(dmg, 'fell too far');
      G.cam.addShake(Math.min(1, dmg / 40));
    }
    G.audio.land(this, impactM);
    G.fx.dust(hit.point, hit.normal, this.s * 0.8, Math.min(1, impactM / 8));
    this.vel.set(0, 0, 0);
  }

  // ------------------------------------------------------------------ silk lines
  dropLine() { // X: hang from where you stand on a dragline and lower yourself
    if (this.mode !== 'ground') return false;
    const s = this.s;
    this.rope = { anchor: this.pos.clone().addScaledVector(this.up, s * 0.02), len: s * 0.5, lowering: true };
    this.mode = 'dangle';
    this.vel.set(0, 0, 0);
    this.pos.addScaledVector(this.up, -s * 0.6);
    this.game.webs.line(this.rope.anchor, this, 'drag');
    return true;
  }
  swingFrom(anchor) {
    const s = this.s;
    this.rope = { anchor: anchor.clone(), len: Math.max(s * 1.5, this.pos.distanceTo(anchor) * 0.92), lowering: false };
    this.mode = 'swing';
    this.game.webs.line(this.rope.anchor, this, 'swing');
  }
  releaseRope(boost = true) {
    if (!this.rope) return;
    this.game.webs.detach(this);
    this.rope = null;
    if (boost) { this.vel.multiplyScalar(1.15); this.vel.addScaledVector(this.game.zone.gravity, -0.12); }
    this.startFall();
  }
  zipTo(point, normal) {
    this.zipT = { from: this.pos.clone(), to: point.clone(), n: normal.clone(), t: 0, dur: Math.max(0.18, Math.min(0.9, this.pos.distanceTo(point) / (this.s * 40))) };
    this.mode = 'zip';
    this.game.webs.line(point, this, 'zip');
  }
  _zip(dt, s) {
    const Z = this.zipT; Z.t += dt / Z.dur;
    const e = Math.min(1, Z.t); const k = e * e * (3 - 2 * e);
    this.pos.lerpVectors(Z.from, Z.to, k);
    this.fwd.copy(Z.to).sub(Z.from).normalize();
    if (Z.t >= 1) { this.pos.copy(Z.to); this.up.copy(Z.n); this.mode = 'ground'; this.game.webs.detach(this); this.vel.set(0, 0, 0); this.zipT = null; }
  }
  _rope(dt, wish, g, s, input) {
    const G = this.game, R = this.rope;
    this.vel.addScaledVector(g, dt);
    // pumping the swing / steering
    this.vel.addScaledVector(wish, walkBL(this.sizeM) * s * dt * 1.5);
    this.vel.multiplyScalar(Math.exp(-0.25 * dt));
    if (R.lowering) {
      // W climbs back up the line, S / X lowers
      if (G.controlsOn && input.is('forward')) R.len = Math.max(s * 0.4, R.len - walkBL(this.sizeM) * s * dt * 1.5);
      else if (G.controlsOn && (input.is('back') || input.is('drop'))) R.len += walkBL(this.sizeM) * s * dt * 3.5;
      else R.len += walkBL(this.sizeM) * s * dt * 0.6;
    }
    const next = this.pos.clone().addScaledVector(this.vel, dt);
    const toA = next.clone().sub(R.anchor);
    const d = toA.length();
    if (d > R.len) {
      next.copy(R.anchor).addScaledVector(toA.divideScalar(d), R.len);
      const radial = toA; // normalized
      const vr = this.vel.dot(radial);
      if (vr > 0) this.vel.addScaledVector(radial, -vr);
    }
    // touching something? land on it
    const dir = next.clone().sub(this.pos); const dl = dir.length();
    if (dl > 1e-12) {
      const hit = G.probe(this.pos, dir.divideScalar(dl), dl + s * 0.35, s);
      if (hit && (R.lowering || hit.normal.dot(this.up) > -0.3)) { G.webs.detach(this); this.rope = null; this.land(hit, this.vel.length()); return; }
    }
    this.pos.copy(next);
    // body hangs head-up toward the anchor
    const toAnchor = _v.copy(R.anchor).sub(this.pos).normalize();
    this.up.lerp(toAnchor, 1 - Math.exp(-6 * dt)).normalize();
    const hv = _v2.copy(this.vel).addScaledVector(this.up, -this.vel.dot(this.up));
    if (hv.lengthSq() > 1e-12) this.fwd.lerp(hv.normalize(), 1 - Math.exp(-3 * dt)).normalize();
  }

  // free flight (space zones): the serum lets you swim through vacuum
  _space(dt, input, camRig, s, speed) {
    const G = this.game;
    const look = _v.set(0, 0, -1).applyQuaternion(G.camera.quaternion);
    const right = _v2.crossVectors(look, _v3.set(0, 1, 0).applyQuaternion(camRig.frame)).normalize();
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(G.camera.quaternion);
    const w = new THREE.Vector3();
    if (G.controlsOn) {
      if (input.is('forward')) w.add(look); if (input.is('back')) w.sub(look);
      if (input.is('right')) w.add(right); if (input.is('left')) w.sub(right);
      if (input.is('jump')) w.add(camUp); if (input.down.has('ControlLeft')) w.sub(camUp);
    }
    if (w.lengthSq() > 0) w.normalize();
    // cruise: hold sprint + a direction and you build up to a huge speed (space is big)
    const cruising = G.controlsOn && input.is('sprint') && w.lengthSq() > 0;
    this.cruise = cruising ? Math.min(1, (this.cruise || 0) + dt * 0.35) : Math.max(0, (this.cruise || 0) - dt * 1.5);
    const spd = speed * 3.2 * (1 + this.cruise * this.cruise * (G.zone.cruise || 0));
    if (this.cruise > 0.05) camRig.fovKick = Math.max(camRig.fovKick, this.cruise * 16);
    this.vel.lerp(w.multiplyScalar(spd), 1 - Math.exp(-(this.cruise > 0.5 ? 1.5 : 3) * dt));
    // gravity from big bodies near you
    if (G.zone.spaceGravity) this.vel.add(G.zone.spaceGravity(this.pos, s).multiplyScalar(dt));
    this.pos.addScaledVector(this.vel, dt);
    if (G.zone.spaceCollide) G.zone.spaceCollide(this, dt);
    if (this.mode !== 'space') return;
    if (this.vel.lengthSq() > 1e-12) this.fwd.lerp(_v.copy(this.vel).normalize(), 1 - Math.exp(-4 * dt)).normalize();
    this.up.lerp(camUp, 1 - Math.exp(-3 * dt)).normalize();
  }

  jump(toward) {
    const G = this.game, s = this.s;
    if (this.mode !== 'ground') return false;
    const g = this.grav().length() || 9.8 / G.zone.unit * Math.max(1, this.sizeM / 2);
    const hBL = 2.2 * (this.sp.stats.jump || 1) * (1 + 0.1 * this.evo.body);
    const v = Math.sqrt(2 * g * hBL * s);
    let dir = this.fwd.clone();
    if (toward) dir = toward.clone().sub(this.pos).normalize();
    this.vel.copy(this.up).multiplyScalar(v * 0.75).addScaledVector(dir, v * (toward ? 1.25 : 0.9));
    this.pos.addScaledVector(this.up, s * 0.05);
    this.startFall();
    G.audio.jump(this);
    return true;
  }

  dodge(dirSide) {
    if (this.mode !== 'ground' || this.dodgeCD > 0) return;
    const s = this.s;
    const right = new THREE.Vector3().crossVectors(this.fwd, this.up).normalize();
    this.vel.addScaledVector(right, dirSide * walkBL(this.sizeM) * s * 3.5);
    this.invuln = 0.35; this.dodgeCD = 0.6;
  }

  // ------------------------------------------------------------------ health
  hurt(amount, by, from) {
    if (this.invuln > 0 || this.mode === 'dead') return;
    const G = this.game;
    const armor = (this.sp.stats.armor || 1) * (1 + (this.powers.armor || 0) * 0.35) * (1 + this.evo.body * 0.06);
    let d = amount / armor;
    if (this.soft > 0) d *= 1.8;          // fresh molt = soft shell
    if (G.difficulty === 'hard') d *= 1.35;
    if (G.realistic) d *= 1.6;
    this.hp -= d; this.lastHurtBy = by || this.lastHurtBy;
    G.hud.hurt(Math.min(1, d / 25));
    G.cam.addShake(Math.min(0.8, d / 30));
    G.audio.hurt(this);
    if (G.realistic && d > 20 && Math.random() < 0.35) this.legsLost = Math.min(4, (this.legsLost || 0) + 1);
    if (this.hp <= 0) G.die(by || 'killed');
  }
  heal(a) { this.hp = Math.min(this.maxHp, this.hp + a); }
  applySoft() {
    const ud = this.body.userData; if (!ud.mats) return;
    for (const k of ['carapace', 'abdomen', 'legs']) ud.mats[k].userData.u.uSoft.value = this.soft;
  }
}

// steel plates (eat cars/tanks): overlapping dark metal scales on the abdomen
function makePlates(sp) {
  const A = sp.abdomen;
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x6c737a, metalness: 0.9, roughness: 0.35 });
  const geo = new THREE.CylinderGeometry(1, 1, 0.12, 6); geo.rotateX(Math.PI / 2);
  for (let i = 0; i < 26; i++) {
    const t = Math.random() * Math.PI * 0.8 + 0.05, p = Math.random() * Math.PI * 2;
    const ux = Math.sin(t) * Math.cos(p), uy = Math.cos(t), uz = Math.sin(t) * Math.sin(p);
    if (uy < -0.2) continue;
    const m = new THREE.Mesh(geo, mat);
    m.position.set(ux * A.wid / 2 * 1.01, uy * A.hgt / 2 * 1.01, uz * A.len / 2 * 1.01);
    m.lookAt(m.position.clone().multiplyScalar(2));
    m.scale.setScalar(A.wid * 0.11);
    g.add(m);
  }
  return g;
}
// feathers (eat birds): soft cards along the sides
function makeFeathers(sp) {
  const g = new THREE.Group();
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const x = cv.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#d8d0c4'); gr.addColorStop(1, '#5a5048');
  x.fillStyle = gr; x.beginPath(); x.ellipse(32, 64, 26, 62, 0, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#3a342e'; x.lineWidth = 2; x.beginPath(); x.moveTo(32, 2); x.lineTo(32, 126); x.stroke();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.9 });
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.2), mat);
    const sx = i % 2 ? 1 : -1;
    m.position.set(sx * (0.12 + Math.random() * 0.05), sp.stance.height + 0.12 + Math.random() * 0.1, -0.1 - Math.random() * 0.4);
    m.rotation.set(-0.6, sx * 0.4, sx * 1.1);
    g.add(m);
  }
  return g;
}
