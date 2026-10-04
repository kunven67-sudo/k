// Save slots (stored in this browser). Saves you, your size, your look, the watch, the room
// (lights, power) and where every movable thing is + how big it is.
import { things } from '../world/thing.js';

const KEY = (i) => `shrinkbox.slot.${i}`;

export class Saves {
  constructor(game) { this.game = game; }

  info(i) {
    try {
      const d = JSON.parse(localStorage.getItem(KEY(i)) || 'null');
      if (!d) return null;
      return `${new Date(d.time).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · ${d.sizeText || ''}`;
    } catch { return null; }
  }

  snapshot() {
    const g = this.game, p = g.player;
    const objs = [];
    let idx = 0;
    for (const t of things) {
      if (t.type !== 'dynamic' || !t.body) continue;
      const tr = t.body.translation(), r = t.body.rotation();
      objs.push({ key: t.saveKey || `${t.name}#${idx++}`, spawnId: t.spawnId, spawned: !!t.spawned, p: [tr.x, tr.y, tr.z], q: [r.x, r.y, r.z, r.w], s: t.scale, on: t.on, fill: t.fill, dirt: t.dirt });
    }
    return {
      v: 1, time: Date.now(), sizeText: `${(p.height * 100).toFixed(p.height < 0.01 ? 2 : 0)} cm`,
      player: { feet: g.macroFeet().toArray(), yaw: p.yaw, pitch: p.pitch, s: p.s / (g.unit || 1), health: p.health, view: p.view },
      watch: { battery: g.watch.battery, confiscated: !!g.watch.confiscated }, look: g.look, money: g.economy.money, grounded: !!g.grounded,
      eco: { log: g.economy.log.slice(0, 50), messages: g.economy.messages.slice(0, 50), choresDone: g.economy.choresDone, lastAllowance: g.economy.lastAllowance },
      pets: g.pets.list.map((p) => p.kind),
      room: { light: g.roomLight?.on, lamp: g.lamp?.on, door: g.door?.target, tv: g.tv?.on, xbox: g.xbox?.on },
      objs,
    };
  }

  save(i) {
    try { localStorage.setItem(KEY(i), JSON.stringify(this.snapshot())); this.game.slot = i; return true; }
    catch { this.game.ui.toast('⚠️ Could not save (browser storage blocked)'); return false; }
  }

  remove(i) { try { localStorage.removeItem(KEY(i)); } catch { /* ignore */ } }

  read(i) { try { return JSON.parse(localStorage.getItem(KEY(i)) || 'null'); } catch { return null; } }

  load(i) {
    const d = this.read(i); if (!d) return false;
    this.apply(d); this.game.slot = i; return true;
  }

  apply(d) {
    const g = this.game, p = g.player;
    g.leaveElsewhere();
    g.look = { ...g.look, ...(d.look || {}) }; g.applyLook();
    p.setScale(d.player.s); p.feet.fromArray(d.player.feet); p.yaw = d.player.yaw; p.pitch = d.player.pitch; p.health = d.player.health; p.view = d.player.view || 'first';
    p.vel.set(0, 0, 0); p.setScale(d.player.s);
    g.watch.battery = d.watch?.battery ?? 1;
    if (d.money !== undefined) g.economy.money = d.money;
    g.grounded = !!d.grounded; g.watch.confiscated = !!d.watch?.confiscated;
    if (d.eco) Object.assign(g.economy, d.eco);
    if (d.room) {
      g.setRoomLight?.(!!d.room.light); g.setLamp?.(!!d.room.lamp);
      if (g.door) { g.door.target = d.room.door || 0; g.door.open = g.door.target; }
      if (g.tv) { g.tv.on = !!d.room.tv; g.tv.refresh(); }
      if (g.xbox) g.xbox.on = !!d.room.xbox;
    }
    // pets (re-adopt the ones from the save if they're not here yet)
    if (d.pets && !g.pets.list.length) for (const k of d.pets) g.pets.adopt(k, new g.player.feet.constructor(-0.6, 0.02, 0.6));
    // remove things spawned in this session, then restore everything from the save
    for (const t of [...things]) if (t.spawned) t.remove(g.engine.scene);
    const byKey = new Map(); let idx = 0;
    for (const t of things) if (t.type === 'dynamic') byKey.set(t.saveKey || `${t.name}#${idx++}`, t);
    for (const o of d.objs || []) {
      let t = byKey.get(o.key);
      if (!t && o.spawned && o.spawnId && g.spawner) t = g.spawner.spawn(o.spawnId, o.p, true);
      if (!t || !t.body) continue;
      if (o.s && Math.abs(o.s - t.scale) > 1e-6) t.setScale(o.s);
      t.body.setTranslation({ x: o.p[0], y: o.p[1], z: o.p[2] }, true);
      t.body.setRotation({ x: o.q[0], y: o.q[1], z: o.q[2], w: o.q[3] }, true);
      t.body.setLinvel({ x: 0, y: 0, z: 0 }, true); t.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      if (o.fill !== undefined) t.fill = o.fill;
      if (o.dirt !== undefined) t.dirt = o.dirt;
      if (o.on !== undefined && t.on !== o.on) t.on = o.on;
      t.sync();
    }
  }
}
