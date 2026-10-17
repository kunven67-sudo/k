// Collision for walking around: every wall and piece of furniture is a box seen from above
// (can be rotated), with a bottom and top height so you can't walk through anything.
export class Physics {
  constructor() {
    this.boxes = [];
  }

  // x,z = center, hx,hz = half sizes, y0..y1 = height range, rot = radians around Y
  add(b) {
    const box = { x: 0, z: 0, hx: 0.1, hz: 0.1, y0: 0, y1: 3, rot: 0, on: true, ...b };
    this.boxes.push(box);
    return box;
  }

  remove(box) {
    const i = this.boxes.indexOf(box);
    if (i >= 0) this.boxes.splice(i, 1);
  }

  // Pushes a circle (the player's body) out of every box it overlaps. A few passes handle corners.
  resolve(p, r, yMin, yMax) {
    for (let pass = 0; pass < 4; pass++) {
      let moved = false;
      for (const b of this.boxes) {
        if (!b.on || b.y1 <= yMin || b.y0 >= yMax) continue;
        const c = Math.cos(b.rot), s = Math.sin(b.rot);
        const dx = p.x - b.x, dz = p.z - b.z;
        const lx = c * dx - s * dz, lz = s * dx + c * dz;
        if (Math.abs(lx) > b.hx + r || Math.abs(lz) > b.hz + r) continue;
        const cx = Math.max(-b.hx, Math.min(b.hx, lx)), cz = Math.max(-b.hz, Math.min(b.hz, lz));
        let nx = lx - cx, nz = lz - cz;
        let d = Math.hypot(nx, nz);
        if (d >= r) continue;
        let push;
        if (d < 1e-6) {
          // center is inside the box: push out along the shortest side
          const ox = b.hx - Math.abs(lx), oz = b.hz - Math.abs(lz);
          if (ox < oz) { nx = Math.sign(lx) || 1; nz = 0; push = ox + r; } else { nx = 0; nz = Math.sign(lz) || 1; push = oz + r; }
        } else { nx /= d; nz /= d; push = r - d; }
        // back to world space
        const wx = c * nx + s * nz, wz = -s * nx + c * nz;
        p.x += wx * push; p.z += wz * push;
        moved = true;
      }
      if (!moved) break;
    }
  }

  // Is a point clear of everything? (used to check a spot before standing up there)
  free(x, z, r, yMin, yMax) {
    const p = { x, z };
    this.resolve(p, r, yMin, yMax);
    return Math.hypot(p.x - x, p.z - z) < 1e-4;
  }
}
