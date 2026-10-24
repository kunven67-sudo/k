// How hard they hunt you. Heat goes up when people see you, when you bite/eat people, when you break things,
// and with your size. Levels: 1 night staff + bug spray, 2 Voss containment team (nets, jars, tranq), 3 police,
// 4 SWAT + Voss black ops, 5 army, 6 air force + everything Voss has. Hiding lets it cool down.
import * as THREE from 'three';
import { clamp, rand } from '../core/util.js';

export const LEVEL_NAMES = ['', 'Night staff', 'Voss containment team', 'Police', 'SWAT + Voss black ops', 'Army', 'Air force'];

export class Wanted {
  constructor(game) { this.game = game; this.reset(); }
  reset() { this.level = 0; this.heat = 0; this.lastSeen = null; this.calm = 0; this.teamT = 0; this.teams = []; }
  alert(level, pos) { if (level > this.level) { this.level = level; this.game.hud.wanted && this.game.hud.wanted(this.level); } this.heat = 1; this.lastSeen = pos.clone(); this.calm = 0; this.game.stats.maxWanted = Math.max(this.game.stats.maxWanted, this.level); }
  seen(pos, sizeM, how) { const lv = sizeM < 0.05 ? 1 : sizeM < 0.5 ? 2 : sizeM < 2 ? 3 : sizeM < 15 ? 4 : sizeM < 200 ? 5 : 6; this.alert(Math.max(this.level, lv), pos); }
  crime(kind, pos) { this.alert(Math.min(6, Math.max(this.level, kind === 'bite' ? 2 : 2)), pos); this.heat = 1; }
  update(dt) {
    const G = this.game, Z = G.zone, p = G.player; if (!p || G.state !== 'play') return;
    // nobody has seen you for a while: they lose the trail
    this.calm += dt;
    if (this.calm > 25) this.heat = Math.max(0, this.heat - dt * 0.03);
    if (this.heat <= 0 && this.level > 0 && this.calm > 60) { this.level = Math.max(0, this.level - 1); this.calm = 30; G.hud.wanted && G.hud.wanted(this.level); }
    // the tower: Voss sends a containment team to the floor you were last seen on
    if (Z && Z.id === 'halvern' && this.level >= 2 && Z.inside(p.pos)) {
      this.teamT -= dt;
      if (this.teamT <= 0 && this.heat > 0.4) {
        this.teamT = 70;
        const f = Z.floorAt(this.lastSeen || p.pos);
        if (f && Z.humans) {
          const y = Z.floors[f] ? Z.floors[f].y0 + (Z.floors[f].ctx.floorOffset || 0) * 0 : 0;
          for (let i = 0; i < 2 + Math.min(2, this.level - 2); i++) {
            const h = Z.humans.spawn({ role: 'hazmat', x: -3.5 + rand(-1, 1), y: Z.floors[f].y0, z: -6.4 + rand(-0.4, 0.4), rot: Math.PI, floor: f });
            if (h) { h.noticed = true; h.state = 'catch'; h.timer = 60; this.teams.push(h); }
          }
          G.hud.toast(`Voss's containment team just stepped out of the elevator on ${f === 1 ? 'the lobby' : 'floor ' + f}.`, 3);
          G.audio.at('ding', new THREE.Vector3(-3.5, Z.floors[f].y0 + 1, -6));
        }
      }
    }
  }
}
