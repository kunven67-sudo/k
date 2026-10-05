// Particle effects for impacts, jets, tails, supernova shells and more.
import { TIME_BASE } from '../core/constants.js';
import { clamp, blackbody } from '../core/phys.js';

export class FXSpawner {
  constructor(game) {
    this.game = game;
  }

  get world() { return this.game.world; }
  get renderer() { return this.game.renderer; }
  get settings() { return this.game.settings; }

  compColor(c) {
    if (c.gas > 0.5) return [0.75, 0.68, 0.55];
    if (c.ice > 0.4) return [0.7, 0.76, 0.82];
    if (c.iron > 0.5) return [0.35, 0.34, 0.33];
    return [0.32, 0.29, 0.26];
  }

  spawnImpact(e, scale) {
    const p = this.world.player, fx = this.renderer.fx;
    const R = this.renderer.visualRadius(p);
    const d = e.dir;
    const n = Math.round(clamp(4 + 70 * Math.sqrt(e.rel), 3, 80) * scale);
    const col = this.compColor(e.body.comp || p.comp);
    const hot = clamp(e.energy * 0.8, 0, 1);
    const vScale = R / TIME_BASE;
    for (let i = 0; i < n; i++) {
      const j = randUnit();
      // spray out of the hemisphere facing the impact
      let ox = d.x + j.x * 0.8, oy = d.y + j.y * 0.8, oz = d.z + j.z * 0.8;
      const l = Math.hypot(ox, oy, oz) || 1;
      ox /= l; oy /= l; oz /= l;
      const sp = (0.6 + Math.random() * 2.6) * vScale * (0.6 + hot);
      const glow = Math.random() < hot * 0.7 || p.isStar || p.compact;
      const c = glow ? blackbody(1200 + hot * 2500 + (p.isStar ? 3000 : 0)) : col;
      fx.spawn({
        x: p.x + d.x * R * 1.01, y: p.y + d.y * R * 1.01, z: p.z + d.z * R * 1.01,
        vx: p.vx + ox * sp, vy: p.vy + oy * sp, vz: p.vz + oz * sp,
        life: 0.8 + Math.random() * 1.8,
        size: R * (glow ? 0.025 : 0.05) * (0.5 + Math.random()) * clamp(0.6 + e.rel * 6, 0.6, 3),
        grow: glow ? 0.6 : 2.2,
        r: c[0] * (glow ? 2.5 : 1), g: c[1] * (glow ? 2.5 : 1), b: c[2] * (glow ? 2.5 : 1), a: glow ? 1 : 0.85,
        glow, drag: 0.6,
      });
    }
  }

  spawnPuff(b, scale) {
    const fx = this.renderer.fx;
    const R = b.radius || this.renderer.visualRadius(this.world.player);
    const col = this.compColor(b.comp || { rock: 1, iron: 0, ice: 0, gas: 0 });
    const vScale = R / TIME_BASE;
    for (let i = 0; i < 40 * scale; i++) {
      const j = randUnit();
      const sp = (0.2 + Math.random()) * vScale * 1.5;
      fx.spawn({
        x: b.x + j.x * R, y: b.y + j.y * R, z: b.z + j.z * R,
        vx: (b.vx || 0) + j.x * sp, vy: (b.vy || 0) + j.y * sp, vz: (b.vz || 0) + j.z * sp,
        life: 2 + Math.random() * 2, size: R * 0.3 * (0.5 + Math.random()), grow: 3,
        r: col[0], g: col[1], b: col[2], a: 0.5, glow: false, drag: 0.3,
      });
    }
  }

  spawnJet(e) {
    const w = this.world, p = w.player, fx = this.renderer.fx;
    const R = this.renderer.visualRadius(p);
    const vScale = p.rEff / TIME_BASE;
    const n = Math.round((e.boost ? 7 : 3) * (this.settings.quality === 'low' ? 0.5 : 1));
    if (p.compact === 'bh') {
      // relativistic jets shoot along the spin axis, both ways
      const ax = Math.sin(p.tilt), ay = Math.cos(p.tilt);
      for (let i = 0; i < n * 2; i++) {
        const s = i % 2 ? 1 : -1;
        const j = randUnit();
        const sp = (14 + Math.random() * 10) * vScale;
        fx.spawn({
          x: p.x + ax * s * R * 1.5, y: p.y + ay * s * R * 1.5, z: p.z,
          vx: p.vx + (ax * s + j.x * 0.03) * sp, vy: p.vy + (ay * s + j.y * 0.03) * sp, vz: p.vz + j.z * 0.03 * sp,
          life: 1.2, size: p.rEff * 0.08, grow: 2.5, r: 0.6, g: 0.75, b: 1.6, a: 1, glow: true,
        });
      }
      return;
    }
    const star = p.isStar;
    const gas = p.comp.gas > 0.4 && !star;
    for (let i = 0; i < n; i++) {
      const j = randUnit();
      let dx = e.x + j.x * 0.25, dy = e.y + j.y * 0.25, dz = e.z + j.z * 0.25;
      const l = Math.hypot(dx, dy, dz) || 1;
      dx /= l; dy /= l; dz /= l;
      const sp = (2.5 + Math.random() * 3) * vScale * (e.boost ? 1.6 : 1);
      // plumes leave from a few vents on the side facing away from your thrust
      const vent = randUnit();
      const sx = e.x + vent.x * 0.25, sy = e.y + vent.y * 0.25, sz = e.z + vent.z * 0.25;
      const sl = Math.hypot(sx, sy, sz) || 1;
      const ox = p.x + (sx / sl) * R, oy = p.y + (sy / sl) * R, oz = p.z + (sz / sl) * R;
      let c, glow, size;
      if (star) { c = blackbody(p.starTemp * 0.9); glow = true; size = R * 0.12; }
      else if (gas) { c = [0.8, 0.75, 0.68]; glow = Math.random() < 0.3; size = R * 0.08; }
      else {
        glow = Math.random() < 0.35;
        c = glow ? blackbody(1300 + Math.random() * 500) : [0.22, 0.2, 0.19];
        size = R * (glow ? 0.03 : 0.07);
      }
      fx.spawn({
        x: ox, y: oy, z: oz,
        vx: p.vx + dx * sp, vy: p.vy + dy * sp, vz: p.vz + dz * sp,
        life: 0.7 + Math.random() * 0.9, size: size * (0.6 + Math.random() * 0.8), grow: glow ? 1.2 : 3,
        r: c[0] * (glow ? 2.2 : 1), g: c[1] * (glow ? 2.2 : 1), b: c[2] * (glow ? 2.2 : 1),
        a: glow ? 1 : 0.7, glow, drag: 0.4,
      });
    }
  }

  spawnTail(e) {
    const p = this.world.player, fx = this.renderer.fx, s = e.source;
    if (!s) return;
    const R = this.renderer.visualRadius(p);
    let ux = p.x - s.x, uy = p.y - s.y, uz = p.z - s.z;
    const l = Math.hypot(ux, uy, uz) || 1;
    ux /= l; uy /= l; uz /= l;
    const vScale = R / TIME_BASE;
    const n = Math.min(6, Math.ceil(e.rate * 300));
    for (let i = 0; i < n; i++) {
      const j = randUnit();
      const ion = e.ice > 0 && Math.random() < 0.5;
      const sp = (ion ? 6 : 2.5) * vScale * (0.6 + Math.random() * 0.8);
      const c = ion ? [0.35, 0.6, 1.2] : e.ice > 0 ? [0.9, 0.9, 0.85] : [1.4, 0.6, 0.25];
      fx.spawn({
        x: p.x + (j.x - ux) * R * 0.9, y: p.y + (j.y - uy) * R * 0.9, z: p.z + (j.z - uz) * R * 0.9,
        vx: p.vx + (ux + j.x * 0.15) * sp, vy: p.vy + (uy + j.y * 0.15) * sp, vz: p.vz + (uz + j.z * 0.15) * sp,
        life: 1.5 + Math.random() * 1.5, size: R * (ion ? 0.12 : 0.2), grow: 3.5,
        r: c[0], g: c[1], b: c[2], a: ion ? 0.6 : 0.35, glow: true,
      });
    }
  }

  spawnStrip(src, depth) {
    const p = this.world.player, fx = this.renderer.fx;
    const R = this.renderer.visualRadius(p);
    let ux = src.x - p.x, uy = src.y - p.y, uz = src.z - p.z;
    const l = Math.hypot(ux, uy, uz) || 1;
    ux /= l; uy /= l; uz /= l;
    const vScale = R / TIME_BASE;
    const n = Math.ceil(2 + depth * 8);
    const col = this.compColor(p.comp);
    for (let i = 0; i < n; i++) {
      const j = randUnit();
      const side = Math.random() < 0.7 ? 1 : -1;
      const sp = (1.5 + Math.random() * 3) * vScale;
      const glow = Math.random() < 0.3;
      const c = glow ? blackbody(1500) : col;
      fx.spawn({
        x: p.x + (ux * side + j.x * 0.3) * R, y: p.y + (uy * side + j.y * 0.3) * R, z: p.z + (uz * side + j.z * 0.3) * R,
        vx: p.vx + ux * side * sp, vy: p.vy + uy * side * sp, vz: p.vz + uz * side * sp,
        life: 1.6, size: R * 0.06, grow: 2.5, r: c[0] * (glow ? 2 : 1), g: c[1] * (glow ? 2 : 1), b: c[2] * (glow ? 2 : 1), a: 0.8, glow, drag: 0,
      });
    }
  }

  spawnShell(x, y, z, scale = 1) {
    const fx = this.renderer.fx;
    const sp = 9000 * scale;
    for (let i = 0; i < 500; i++) {
      const j = randUnit();
      const k = 0.85 + Math.random() * 0.3;
      const hot = Math.random();
      const c = hot < 0.5 ? [1.6, 0.35, 0.45] : hot < 0.8 ? [0.4, 1.0, 1.1] : [1.6, 1.5, 1.4];
      fx.spawn({
        x, y, z, vx: j.x * sp * k, vy: j.y * sp * k, vz: j.z * sp * k,
        life: 14, size: 2e6 * scale, grow: 40, r: c[0], g: c[1], b: c[2], a: 0.7, glow: true,
      });
    }
  }
}

function randUnit() {
  const z = Math.random() * 2 - 1;
  const t = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return { x: r * Math.cos(t), y: z, z: r * Math.sin(t) };
}

