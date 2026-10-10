// People on the Eldorado floor: staff (security guard at the podium, the cashier behind the cage,
// the bartender, the pit boss), players seated at slot machines (tier-sized), and a cocktail
// server walking her loop with a tray. Plus the guard's ID check at the door (DESIGN §3 "ID
// checked at casino doors", §49): under 21 → a polite refusal and you're walked back out; no
// wallet → no entry. Whether you get carded depends on how old you look and on the guard.
//
// Phones: every Human is culled by distance + view frustum and animated at a reduced rate when
// it's further away; only humans near the viewer cost anything.
import * as THREE from 'three';
import { createHuman, randomHumanParams } from '../character/index.js';
import { save } from '../core/save.js';
import { t } from '../core/i18n.js';
import { Rng } from '../core/rng.js';
import { audio } from '../core/audio.js';
import { slice } from '../life/state.js';
import { openDialogue } from '../life/dialogue.js';
import { say } from '../player/voice.js';
import { FLOOR_Y, PODIUM, PIT_PODIUM, SPAWNS, insideShell } from './layout.js';

const F = FLOOR_Y;
const CULL = { low: 18, medium: 26, high: 36, ultra: 52 };
const SLOT_PLAYERS = { low: 2, medium: 4, high: 8, ultra: 12 };
const _v = new THREE.Vector3();
const _s = new THREE.Sphere();
const _frustum = new THREE.Frustum();
const _pm = new THREE.Matrix4();

// Server's loop around the fountain plaza (clear of columns, banks and tables).
const SERVER_PATH = [[-52, 62.4], [-36, 62.4], [-31.5, 56], [-31.5, 44], [-36, 38.9], [-56, 38.9], [-60.5, 44], [-60.5, 56]];

export class FloorPeople {
  constructor(C, { tier, banks, cageStand, barStand }) {
    this.C = C;
    this.tier = tier;
    this.list = [];
    this.cull = CULL[tier?.name] ?? 26;
    this.speech = null;
    this.rng = new Rng('eldorado-npcs');
    const tierName = tier?.name || 'medium';

    // ---- staff ----
    this.guard = this._npc('guard', { uniform: 'security', sex: 'm', age: 46, fat: 0.55, height: 1.86, muscle: 0.75 }, new THREE.Vector3(PODIUM.x - 0.78, F, PODIUM.z), Math.PI / 2, { name: t('casino.it.guard'), pitch: 0.82, rate: 0.96, male: true });
    this.guard.personality = this.rng.chance(0.5) ? 'strict' : 'easy';
    if (cageStand) this.cashier = this._npc('cashier', { uniform: 'dealer', sex: 'f', age: 34, fat: 0.4 }, cageStand.pos, cageStand.yaw, { name: t('casino.cage.title'), pitch: 1.1, rate: 1.02, male: false });
    if (barStand) {
      this.bartender = this._npc('bartender', { uniform: 'dealer', sex: 'm', age: 29, fat: 0.3 }, barStand.pos, Math.PI, { name: t('casino.it.bartender'), pitch: 1.0, rate: 1.05, male: true });
      this.bartender.patrol = { x0: barStand.x0 + 1.4, x1: barStand.x1 - 1.4, z: barStand.pos.z, wait: 3, target: null };
    }
    this.pitBoss = this._npc('pitboss', { sex: 'm', age: 57, fat: 0.6, top: 'button', topColor: 'white', outer: 'blazer', outerColor: 'black', bottom: 'slacks', bottomColor: 'black', shoes: 'dress', shoesColor: 'black', hat: 'none' }, new THREE.Vector3(PIT_PODIUM.x, F, PIT_PODIUM.z - 0.7), Math.PI, { name: 'Pit', pitch: 0.75, rate: 0.95, male: true });

    // Staff interactables (talk; serving / markers come later).
    const talk = (npc, id, key) => ({
      id, kind: 'talk', radius: 0.45, reach: 2.6,
      get position() {
        return npc.root.position.clone().setY(npc.root.position.y + 1.55);
      },
      describe: () => npc.voice.name,
      onInteract: () => this.speak(npc, t(key)),
    });
    C.interactables.push(talk(this.guard, 'eldorado-guard', 'casino.guard.hi'));
    if (this.bartender) C.interactables.push(talk(this.bartender, 'eldorado-bartender', 'casino.bar.hi'));
    C.interactables.push(talk(this.pitBoss, 'eldorado-pitboss', 'casino.pit.hi'));

    // ---- slot players ----
    const n = SLOT_PLAYERS[tierName] ?? 4;
    const machines = [];
    for (const b of banks) for (const m of b.machines || []) machines.push({ m, theme: b.spec?.theme });
    // Spread them: every k-th machine across the floor, deterministic.
    const step = Math.max(1, Math.floor(machines.length / Math.max(1, n)));
    for (let i = 0; i < n && i * step < machines.length; i++) {
      const pick = machines[(i * step + 3) % machines.length];
      this._seatPlayer(pick.m, pick.theme, i);
    }

    // ---- cocktail server (not on low) ----
    if (tierName !== 'low') {
      const p0 = SERVER_PATH[0];
      this.server = this._npc('server', { sex: 'f', age: 26, fat: 0.25, top: 'dealer', topColor: 'white', bottom: 'skirt', bottomColor: 'black', shoes: 'dress', shoesColor: 'black', outer: 'none', hat: 'none' }, new THREE.Vector3(p0[0], F, p0[1]), Math.PI / 2, { name: 'Server', pitch: 1.15, rate: 1.05, male: false });
      this.server.path = { i: 1, wait: 0, speed: 0 };
      try {
        const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.015, 24), C.M.chrome);
        const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.11, 10), C.M.glass);
        glass.position.set(0.06, 0.06, 0.02);
        tray.add(glass);
        tray.position.set(0, 0.06, 0.12);
        this.server.human.attach?.('hand.L', tray);
      } catch {
        /* attach unsupported */
      }
    }
    C.npcCount = this.list.length;

    // ---- ID check ----
    this.check = { cleared: false, outsideT: 99, busy: false, refused: 0 };
  }

  _npc(seed, overrides, pos, yaw, voice) {
    const params = randomHumanParams(new Rng(`eldorado-${seed}`), overrides);
    const human = createHuman(params, { tier: this.tier });
    human.root.position.copy(pos);
    human.root.rotation.y = yaw;
    this.C.group.add(human.root);
    const npc = { id: seed, human, root: human.root, params, voice, acc: 0, home: pos.clone(), yaw, idleT: this.rng.range(2, 8), look: null };
    this.list.push(npc);
    return npc;
  }

  _seatPlayer(machine, theme, i) {
    const rng = new Rng(`slot-player-${i}`);
    const params = randomHumanParams(rng, { age: rng.weighted([[rng.range(55, 82), 3], [rng.range(28, 55), 2]]) });
    const human = createHuman(params, { tier: this.tier });
    let seated = false;
    try {
      machine.seatNpc?.(human);
      seated = !!human.root.parent;
    } catch (e) {
      console.warn('[casino] seatNpc failed', e);
    }
    const npc = { id: `slot-${i}`, human, root: human.root, params, voice: null, acc: 0, slot: { machine, theme, own: !seated, t: rng.range(1, 6) } };
    if (!seated) {
      // Fallback (stub machines): sit them on the machine's seat ourselves.
      const seat = machine.seats?.[0];
      if (!seat) {
        human.dispose?.();
        return;
      }
      machine.refreshWorld?.();
      const p = machine.toWorld(seat.pos, new THREE.Vector3());
      human.root.position.copy(p);
      human.root.rotation.y = machine.worldYaw(seat.yaw ?? 0);
      this.C.group.add(human.root);
      human.play('sit', { height: seat.height ?? 0.68 });
      for (let k = 0; k < 70; k++) human.update(1 / 30); // settle into the seat before first frame
      seat.occupant = 'npc';
    }
    this.list.push(npc);
  }

  /** Bubble + voice over an NPC's head. */
  speak(npc, text, holdMs = 2600) {
    this.speech?.close?.();
    const engine = this.C.engine;
    const head = () => npc.root.position.clone().setY(npc.root.position.y + 1.95);
    try {
      this.speech = openDialogue({ engine, anchor: head, name: npc.voice?.name || '', text, choices: [] });
      this.speech.say?.(text, [], holdMs);
    } catch {
      this.speech = null;
    }
    try {
      say(text, { pitch: npc.voice?.pitch ?? 1, rate: npc.voice?.rate ?? 1, male: npc.voice?.male !== false });
    } catch {
      /* no TTS */
    }
    npc.human.play?.('wave-off', { speed: 0.8 });
    return this.speech;
  }

  update(dt, ctx, state) {
    const cam = ctx.camera;
    const camPos = cam?.position || ctx.viewer;
    if (cam) {
      _pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      _frustum.setFromProjectionMatrix(_pm);
    }
    const pl = ctx.player;
    for (const npc of this.list) {
      const d = camPos ? npc.root.position.distanceTo(camPos) : 0;
      _s.center.copy(npc.root.position).setY(npc.root.position.y + 1);
      _s.radius = 1.3;
      const vis = d < this.cull && (!cam || _frustum.intersectsSphere(_s));
      if (npc.root.visible !== vis) npc.root.visible = vis;
      // Walkers keep walking off-screen (their position matters); animation only when seen.
      if (npc.path) this._walk(npc, dt);
      if (npc.patrol) this._patrol(npc, dt);
      if (npc.slot) this._slotIdle(npc, dt, vis);
      if (!vis) continue;
      npc.acc += dt;
      const every = d < 10 ? 0 : d < 18 ? 1 / 30 : 1 / 15;
      if (npc.acc < every) continue;
      const step = npc.acc;
      npc.acc = 0;
      // Staff glance at you when you come close.
      if (npc.voice && pl?.position && !npc.slot) {
        const near = pl.position.distanceTo(npc.root.position) < 6;
        if (near) npc.human.lookAt(pl.head ? pl.head(_v) : _v.copy(pl.position).setY(pl.position.y + 1.6));
        else if (npc.looking) npc.human.lookAt(null);
        npc.looking = near;
      }
      npc.human.update(step);
    }
    this.speech?.update?.();
    if (this.speech?.closed) this.speech = null;
    this._idCheck(dt, ctx, state);
  }

  _slotIdle(npc, dt, vis) {
    const s = npc.slot;
    if (!s.own) return; // the machine animates its own player
    s.t -= dt;
    if (s.t > 0 || !vis) return;
    s.t = 3.5 + Math.random() * 6;
    const r = Math.random();
    if (s.theme === 'classic-fruit') npc.human.play('pull-lever', { side: 'R' });
    else if (r < 0.06) npc.human.play('cheer');
    else if (r < 0.12) npc.human.play('facepalm');
    else npc.human.play('tap-table', { side: 'R', speed: 1.4 });
  }

  _walk(npc, dt) {
    const P = npc.path;
    if (P.wait > 0) {
      P.wait -= dt;
      P.speed = Math.max(0, P.speed - dt * 2.5);
    } else {
      const [tx, tz] = SERVER_PATH[P.i];
      const dx = tx - npc.root.position.x;
      const dz = tz - npc.root.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.3) {
        P.i = (P.i + 1) % SERVER_PATH.length;
        if (Math.random() < 0.4) P.wait = 2 + Math.random() * 4;
      } else {
        const want = Math.atan2(dx, dz);
        let diff = want - npc.root.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        const turn = Math.sign(diff) * Math.min(Math.abs(diff), dt * 2.4);
        npc.root.rotation.y += turn;
        P.turn = turn / Math.max(dt, 1e-4);
        P.speed = Math.min(1.15, P.speed + dt * 1.6) * (Math.abs(diff) > 1.2 ? 0.6 : 1);
        npc.root.position.x += Math.sin(npc.root.rotation.y) * P.speed * dt;
        npc.root.position.z += Math.cos(npc.root.rotation.y) * P.speed * dt;
      }
    }
    npc.human.setLocomotion({ speed: P.speed, turnRate: P.turn || 0, grounded: true, crouch: false, sprint: false });
  }

  _patrol(npc, dt) {
    const P = npc.patrol;
    if (P.target == null) {
      P.wait -= dt;
      npc.human.setLocomotion({ speed: 0, turnRate: 0, grounded: true });
      if (P.wait <= 0) {
        P.target = P.x0 + Math.random() * (P.x1 - P.x0);
        P.speed = 0;
      }
      return;
    }
    const dx = P.target - npc.root.position.x;
    if (Math.abs(dx) < 0.1) {
      P.target = null;
      P.wait = 4 + Math.random() * 8;
      // Face the counter again and wipe it.
      npc.root.rotation.y = Math.PI;
      npc.human.play('tap-table', { side: 'R', speed: 0.7 });
      return;
    }
    P.speed = Math.min(0.9, (P.speed || 0) + dt * 1.5);
    npc.root.rotation.y = dx > 0 ? Math.PI / 2 : -Math.PI / 2;
    npc.root.position.x += Math.sign(dx) * Math.min(Math.abs(dx), P.speed * dt);
    npc.human.setLocomotion({ speed: P.speed, turnRate: 0, grounded: true });
  }

  // ---- the door check -----------------------------------------------------------------------

  _idCheck(dt, ctx) {
    const pl = ctx.player;
    const C = this.check;
    if (!pl?.position || C.busy) return;
    const p = pl.position;
    const inside = insideShell(p.x, p.z, 0);
    if (!inside) {
      C.outsideT += dt;
      if (C.outsideT > 20) C.cleared = false;
      return;
    }
    C.outsideT = 0;
    if (C.cleared) return;
    // Only when coming in through the Virginia St doors, near the podium.
    if (!(p.x > -17.5 && p.z > 41 && p.z < 59)) {
      // Came in another way (4th St / corner door): the floor staff don't card you there.
      if (p.x < -22) C.cleared = true;
      return;
    }
    const age = this._age();
    const looksYoung = age < (this.guard.personality === 'strict' ? 36 : 28);
    if (!looksYoung) {
      C.cleared = true;
      this.speak(this.guard, t(this.rng.chance(0.5) ? 'casino.guard.welcome' : 'casino.guard.welcomeBack'));
      return;
    }
    C.busy = true;
    pl.locked = true;
    this.guard.human.lookAt(pl.head ? pl.head(_v) : p.clone().setY(p.y + 1.6));
    this.speak(this.guard, t('casino.guard.id'), 1600);
    setTimeout(() => pl.human?.play?.('pat-pockets'), 600);
    setTimeout(() => {
      const hasWallet = (slice('inventory').pockets || []).some((it) => it.kind === 'wallet');
      if (!hasWallet) this._refuse(pl, 'casino.guard.noId');
      else if (age < 21) this._refuse(pl, 'casino.guard.under');
      else {
        this.speak(this.guard, t('casino.guard.ok'));
        C.cleared = true;
        C.busy = false;
        pl.locked = false;
      }
    }, 2600);
  }

  _age() {
    const ch = save.life?.character;
    const a = ch?.age ?? ch?.params?.age;
    return typeof a === 'number' ? a : 30;
  }

  _refuse(pl, key) {
    const C = this.check;
    C.refused++;
    this.speak(this.guard, t(key), 2400);
    this.guard.human.play('wave-off');
    const engine = this.C.engine;
    setTimeout(async () => {
      try {
        await engine.fade?.(true, 650);
      } catch {
        /* no fade */
      }
      const s = SPAWNS.entrance;
      pl.place(new THREE.Vector3(s.x + 1.8, s.y, s.z + (Math.random() - 0.5) * 2), -Math.PI / 2);
      try {
        audio.play('door.close', { bus: 'sfx', gain: 0.4, position: { x: -12.2, y: 1.2, z: s.z }, refDistance: 2 });
      } catch {
        /* locked */
      }
      try {
        await engine.fade?.(false, 650);
      } catch {
        /* no fade */
      }
      pl.locked = false;
      C.busy = false;
      C.cleared = false;
      C.outsideT = 0;
    }, 2600);
  }

  dispose() {
    this.speech?.close?.();
    for (const n of this.list) {
      if (n.slot && !n.slot.own) {
        try {
          n.slot.machine.unseatNpc?.();
        } catch {
          /* */
        }
      }
      n.root.removeFromParent();
      n.human.dispose?.();
    }
    this.list.length = 0;
  }
}
