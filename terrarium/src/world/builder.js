// Helpers to place meshes and their collision boxes together.
import * as THREE from 'three';
import { roundedBox } from './materials.js';

export class Builder {
  constructor(group, colliders, zone) {
    this.g = group;
    this.c = colliders;
    this.zone = zone;
  }

  // solid box: mesh + collider. opts: {col:false, walk, round, cast, recv, rotY}
  box(w, h, d, mat, x, y, z, opts = {}) {
    const geo = opts.round ? roundedBox(w, h, d, opts.round) : new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (opts.rotY) m.rotation.y = opts.rotY;
    m.castShadow = opts.cast !== false;
    m.receiveShadow = opts.recv !== false;
    (opts.parent || this.g).add(m);
    if (opts.col !== false) {
      if (opts.rotY && Math.abs(Math.sin(opts.rotY)) > 0.5) this.c.addCentered(x, y, z, d, h, w, { zone: this.zone, walk: opts.walk, solid: opts.solid, tag: opts.tag });
      else this.c.addCentered(x, y, z, w, h, d, { zone: this.zone, walk: opts.walk, solid: opts.solid, tag: opts.tag });
    }
    return m;
  }

  mesh(geo, mat, x, y, z, opts = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (opts.rot) m.rotation.set(opts.rot[0], opts.rot[1], opts.rot[2]);
    if (opts.scale) m.scale.set(...opts.scale);
    m.castShadow = opts.cast !== false;
    m.receiveShadow = opts.recv !== false;
    (opts.parent || this.g).add(m);
    return m;
  }

  cyl(rt, rb, h, mat, x, y, z, opts = {}) {
    const m = this.mesh(new THREE.CylinderGeometry(rt, rb, h, opts.seg || 16), mat, x, y, z, opts);
    if (opts.col !== false) this.c.addCentered(x, y, z, Math.max(rt, rb) * 1.7, h, Math.max(rt, rb) * 1.7, { zone: this.zone, walk: opts.walk });
    return m;
  }

  // a wall from (x0,z0) to (x1,z1) axis-aligned, with optional holes [{from, to, y0, y1}] along its length
  wall(x0, z0, x1, z1, y0, y1, thick, mat, holes = [], opts = {}) {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1), a1 = alongX ? Math.max(x0, x1) : Math.max(z0, z1);
    const fixed = alongX ? z0 : x0;
    const pieces = [];
    const hs = [...holes].sort((p, q) => p.from - q.from);
    let cur = a0;
    for (const h of hs) {
      if (h.from > cur) pieces.push([cur, h.from, y0, y1]);
      if (h.y0 > y0) pieces.push([h.from, h.to, y0, h.y0]);
      if (h.y1 < y1) pieces.push([h.from, h.to, h.y1, y1]);
      cur = h.to;
    }
    if (cur < a1) pieces.push([cur, a1, y0, y1]);
    const out = [];
    for (const [p0, p1, q0, q1] of pieces) {
      const len = p1 - p0, hh = q1 - q0;
      if (len <= 0.001 || hh <= 0.001) continue;
      const cx = (p0 + p1) / 2, cy = (q0 + q1) / 2;
      const w = alongX ? len : thick, d = alongX ? thick : len;
      const m = this.box(w, hh, d, mat, alongX ? cx : fixed, cy, alongX ? fixed : cx, { ...opts, walk: false });
      if (mat.map) {
        // keep texture scale constant
        const uv = m.geometry.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (alongX ? w : d) / 2, uv.getY(i) * hh / 2);
      }
      out.push(m);
    }
    return out;
  }

  light(type, color, intensity, x, y, z, opts = {}) {
    let l;
    if (type === 'point') l = new THREE.PointLight(color, intensity, opts.dist || 10, opts.decay ?? 2);
    else if (type === 'spot') { l = new THREE.SpotLight(color, intensity, opts.dist || 12, opts.angle || 0.6, opts.pen ?? 0.5, opts.decay ?? 2); }
    l.position.set(x, y, z);
    if (opts.target) { l.target.position.set(...opts.target); this.g.add(l.target); }
    this.g.add(l);
    return l;
  }
}

// scale UVs on a geometry so textures tile by world size
export function uvScale(geo, sx, sy) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  return geo;
}

// canvas sign / label texture
export function textTexture(text, opts = {}) {
  const w = opts.w || 512, h = opts.h || 128;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = opts.bg || '#20302c'; g.fillRect(0, 0, w, h);
  if (opts.border) { g.strokeStyle = opts.border; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8); }
  g.fillStyle = opts.color || '#e9fff6';
  g.font = `${opts.weight || 800} ${opts.size || 64}px ${opts.font || 'Arial, sans-serif'}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const lines = String(text).split('\n');
  lines.forEach((ln, i) => g.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * (opts.size || 64) * 1.1));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
