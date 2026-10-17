// Helpers for laying out rooms: walls with door/window holes, floors, doors that swing.
import * as THREE from '../three.js';
import { G, mesh, LAYER_OVERLAY } from '../render/kit.js';
import { toon } from '../render/materials.js';
import { audio } from '../core/audio.js';
import { clamp, damp } from '../util.js';

const glassMat = new THREE.MeshBasicMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });

export class Builder {
  constructor(root, physics, interact) {
    this.root = root;
    this.phys = physics;
    this.interact = interact;
    this.doors = [];
  }

  /** solid box from min/max corners */
  box(x0, y0, z0, x1, y1, z1, mat, o = {}) {
    const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
    if (w < 1e-4 || h < 1e-4 || d < 1e-4) return null;
    // grow each box a hair so touching boxes overlap: no pixel cracks along seams
    const e = o.expand ?? 0.004;
    const m = mesh(G.box(+(w + e).toFixed(4), +(h + e).toFixed(4), +(d + e).toFixed(4)), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, o.parent || this.root);
    if (o.collide !== false) this.phys.box(x0, y0, z0, x1, y1, z1, { surface: o.surface, portalable: o.portalable, shootable: o.shootable, tag: o.tag });
    return m;
  }

  /** invisible wall (keeps players in, lets portal blobs through) */
  barrier(x0, y0, z0, x1, y1, z1) {
    return this.phys.box(x0, y0, z0, x1, y1, z1, { portalable: false, shootable: false });
  }

  /**
   * Wall running along X at depth z. openings: [{a, b, y0, y1}] in X.
   * matIn is the -Z side paint, matOut the +Z side (pass one for both).
   */
  wallX(z, x0, x1, y0, y1, t, matIn, matOut = matIn, openings = [], o = {}) {
    this._wall('x', z, x0, x1, y0, y1, t, matIn, matOut, openings, o);
  }

  /** Wall running along Z at x. matIn is the -X side, matOut the +X side. */
  wallZ(x, z0, z1, y0, y1, t, matIn, matOut = matIn, openings = [], o = {}) {
    this._wall('z', x, z0, z1, y0, y1, t, matIn, matOut, openings, o);
  }

  _wall(axis, c, a0, a1, y0, y1, t, matIn, matOut, openings, o) {
    const ops = openings.slice().sort((p, q) => p.a - q.a);
    const pieces = [];
    let cur = a0;
    for (const op of ops) {
      if (op.a > cur) pieces.push([cur, op.a, y0, y1]);
      if (op.y1 < y1) pieces.push([op.a, op.b, op.y1, y1]);
      if (op.y0 > y0) pieces.push([op.a, op.b, y0, op.y0]);
      cur = Math.max(cur, op.b);
    }
    if (cur < a1) pieces.push([cur, a1, y0, y1]);
    for (const [p0, p1, q0, q1] of pieces) {
      const coll = { surface: o.surface, portalable: o.portalable, collide: false };
      if (axis === 'x') {
        if (matIn === matOut) this.box(p0, q0, c - t / 2, p1, q1, c + t / 2, matIn, coll);
        else {
          this.box(p0, q0, c - t / 2, p1, q1, c, matIn, coll);
          this.box(p0, q0, c, p1, q1, c + t / 2, matOut, coll);
        }
        if (o.collide !== false) this.phys.box(p0, q0, c - t / 2, p1, q1, c + t / 2, { surface: o.surface, portalable: o.portalable });
      } else {
        if (matIn === matOut) this.box(c - t / 2, q0, p0, c + t / 2, q1, p1, matIn, coll);
        else {
          this.box(c - t / 2, q0, p0, c, q1, p1, matIn, coll);
          this.box(c, q0, p0, c + t / 2, q1, p1, matOut, coll);
        }
        if (o.collide !== false) this.phys.box(c - t / 2, q0, p0, c + t / 2, q1, p1, { surface: o.surface, portalable: o.portalable });
      }
    }
    // trim around openings
    if (o.trim) {
      for (const op of ops) {
        const tm = o.trim;
        const tw = 0.07, td = t + 0.04;
        if (axis === 'x') {
          this.box(op.a - tw, op.y0, c - td / 2, op.a, op.y1 + tw, c + td / 2, tm, { collide: false });
          this.box(op.b, op.y0, c - td / 2, op.b + tw, op.y1 + tw, c + td / 2, tm, { collide: false });
          this.box(op.a, op.y1, c - td / 2, op.b, op.y1 + tw, c + td / 2, tm, { collide: false });
          if (op.y0 > y0) this.box(op.a - tw, op.y0 - tw, c - td / 2 - 0.04, op.b + tw, op.y0, c + td / 2 + 0.04, tm, { collide: false });
        } else {
          this.box(c - td / 2, op.y0, op.a - tw, c + td / 2, op.y1 + tw, op.a, tm, { collide: false });
          this.box(c - td / 2, op.y0, op.b, c + td / 2, op.y1 + tw, op.b + tw, tm, { collide: false });
          this.box(c - td / 2, op.y1, op.a, c + td / 2, op.y1 + tw, op.b, tm, { collide: false });
          if (op.y0 > y0) this.box(c - td / 2 - 0.04, op.y0 - tw, op.a - tw, c + td / 2 + 0.04, op.y0, op.b + tw, tm, { collide: false });
        }
      }
    }
  }

  /** Glass in a window hole. Blocks players, not light. */
  glass(axis, c, a, b, y0, y1) {
    const w = b - a, h = y1 - y0;
    const g = new THREE.Mesh(G.plane(w, h), glassMat);
    g.layers.set(LAYER_OVERLAY);
    if (axis === 'x') {
      g.position.set((a + b) / 2, (y0 + y1) / 2, c);
      this.phys.box(a, y0, c - 0.03, b, y1, c + 0.03, { portalable: false });
    } else {
      g.position.set(c, (y0 + y1) / 2, (a + b) / 2);
      g.rotation.y = Math.PI / 2;
      this.phys.box(c - 0.03, y0, a, c + 0.03, y1, b, { portalable: false });
    }
    g.userData.dynamic = true;
    this.root.add(g);
    // a cross bar like a real window
    const fm = toon(0xf4f1e8);
    if (axis === 'x') {
      this.box(a, (y0 + y1) / 2 - 0.025, c - 0.03, b, (y0 + y1) / 2 + 0.025, c + 0.03, fm, { collide: false });
      this.box((a + b) / 2 - 0.025, y0, c - 0.03, (a + b) / 2 + 0.025, y1, c + 0.03, fm, { collide: false });
    } else {
      this.box(c - 0.03, (y0 + y1) / 2 - 0.025, a, c + 0.03, (y0 + y1) / 2 + 0.025, b, fm, { collide: false });
      this.box(c - 0.03, y0, (a + b) / 2 - 0.025, c + 0.03, y1, (a + b) / 2 + 0.025, fm, { collide: false });
    }
    return g;
  }

  /**
   * Swinging door in a hole. axis: wall direction ('x' or 'z').
   * hinge: 'a' or 'b' end of the opening. swing: +1/-1 which side it opens to.
   */
  door({ axis, c, a, b, y0 = 0, y1 = 2.1, hinge = 'a', swing = 1, mat, knob = 0xd8b45a, locked = null, open = false, label = 'door', onOpen = null, sign = null }) {
    const w = b - a;
    const pivot = new THREE.Group();
    pivot.userData.dynamic = true;
    const hx = hinge === 'a' ? a : b;
    const dirSign = hinge === 'a' ? 1 : -1;
    const panel = new THREE.Group();
    pivot.add(panel);
    const t = 0.06;
    const pm = mesh(G.box(w - 0.02, y1 - y0 - 0.02, t), mat, (dirSign * w) / 2, (y1 - y0) / 2, 0, panel);
    pm.userData.dynamic = true;
    // panel details
    const dm = toon(new THREE.Color(mat.color).multiplyScalar(0.88).getHex());
    for (const yy of [0.55, 1.45]) {
      mesh(G.box(w * 0.62, 0.62, t + 0.02), dm, (dirSign * w) / 2, yy, 0, panel);
    }
    const kn = mesh(G.sphere(0.045, 10, 8), toon(knob), dirSign * (w - 0.12), 1.0, 0, panel, { sz: 2.6 });
    kn.userData.dynamic = true;
    if (sign) {
      const s = mesh(G.plane(0.42, 0.28), sign, (dirSign * w) / 2, 1.55, t / 2 + 0.012, panel);
      const s2 = mesh(G.plane(0.42, 0.28), sign, (dirSign * w) / 2, 1.55, -t / 2 - 0.012, panel, { ry: Math.PI });
      s.userData.dynamic = s2.userData.dynamic = true;
    }
    if (axis === 'x') {
      pivot.position.set(hx, y0, c);
    } else {
      pivot.position.set(c, y0, hx);
      pivot.rotation.y = -Math.PI / 2;
      panel.rotation.y = 0;
    }
    this.root.add(pivot);
    const coll = axis === 'x' ? this.phys.box(a, y0, c - 0.06, b, y1, c + 0.06, { portalable: false, surface: 'wood' }) : this.phys.box(c - 0.06, y0, a, c + 0.06, y1, b, { portalable: false, surface: 'wood' });
    const baseRot = pivot.rotation.y;
    const d = {
      pivot,
      panel,
      coll,
      open: false,
      t: 0,
      locked,
      label,
      onOpen,
      center: axis === 'x' ? new THREE.Vector3((a + b) / 2, y0 + 1.1, c) : new THREE.Vector3(c, y0 + 1.1, (a + b) / 2),
      set(o, silent = false) {
        if (o === this.open) return;
        this.open = o;
        this.coll.enabled = !o;
        if (!silent) audio.door(o);
        if (o) this.onOpen?.();
      },
      update(dt) {
        const target = this.open ? 1 : 0;
        this.t += (target - this.t) * damp(7, dt);
        panel.rotation.y = dirSign * swing * this.t * 1.65;
      },
    };
    void baseRot;
    if (open) {
      d.open = true;
      d.coll.enabled = false;
      d.t = 1;
    }
    this.doors.push(d);
    this.interact?.add({
      pos: d.center,
      radius: Math.max(0.7, w * 0.6),
      label: () => (d.locked ? `Try the ${label}` : d.open ? `Close ${label}` : `Open ${label}`),
      use: () => {
        if (d.locked) {
          audio.denied();
          d.locked(d);
          return;
        }
        d.set(!d.open);
      },
    });
    return d;
  }

  update(dt) {
    for (const d of this.doors) d.update(dt);
  }
}

/** Simple axis-aligned room shell helper values */
export function clampTo(v, a, b) {
  return clamp(v, a, b);
}
