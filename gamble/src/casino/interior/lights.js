// Lighting that sells a windowless casino without dozens of real lights (phones!):
//
//  1. LightPool — a fixed pool of shadowless PointLights (tier-sized: low 2, medium 4, high 6,
//     ultra 8) that follow the strongest candidates near the viewer (chandeliers, the cage, the
//     bar, table lamps). The pool size never changes, so no shader recompiles; compose.js swaps it
//     against the motel's night pool (same size) so the scene's light count stays constant.
//  2. Spots — a list of light footprints baked into the carpet / marble vertex colours (warm pools
//     under every downlight and chandelier, dim aisles, darker corners).
//  3. GlowSet — additive radial quads (one instanced draw call): the warm wash a sconce throws on
//     the wallpaper, the halo on the ceiling above a chandelier, the glow of the dome cove.
//  4. interiorEnvironment() — a warm PMREM of an imaginary casino room, swapped in for the sky's
//     environment map while you are inside so chrome, brass and glass reflect lamps, not sky.
import * as THREE from 'three';
import { canvasTexture } from '../../gfx/textures.js';
import { damp } from '../../core/util.js';

export const POOL_SIZE = { low: 2, medium: 4, high: 6, ultra: 8 };

export class LightPool {
  constructor(group, { tier }) {
    this.candidates = [];
    this.lights = [];
    const n = POOL_SIZE[tier?.name] ?? 4;
    this.group = new THREE.Group();
    this.group.name = 'casino-light-pool';
    group.add(this.group);
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 10, 1.6);
      l.castShadow = false;
      l.userData = { src: null };
      this.group.add(l);
      this.lights.push(l);
    }
    this._t = 1;
    this._focus = new THREE.Vector3();
  }

  /** { pos, color, intensity, distance, weight } */
  add(c) {
    this.candidates.push({ weight: 1, distance: 9, intensity: 6, color: 0xffd9a8, ...c });
  }

  update(dt, viewer, camera, active = 1) {
    this._t += dt;
    if (this._t > 0.3 && viewer) {
      this._t = 0;
      // Bias the choice toward what's in front of the camera (lights behind you matter less).
      this._focus.copy(viewer);
      if (camera) {
        camera.getWorldDirection(_d);
        this._focus.addScaledVector(_d.setY(0).normalize(), 3.5);
      }
      const scored = [];
      for (const c of this.candidates) {
        const d = c.pos.distanceTo(this._focus);
        if (d > c.distance * 2.2 + 8) continue;
        scored.push({ c, s: d / (Math.sqrt(c.intensity) * c.weight + 0.5) });
      }
      scored.sort((a, b) => a.s - b.s);
      const want = new Set(scored.slice(0, this.lights.length).map((x) => x.c));
      const free = [];
      for (const l of this.lights) {
        if (l.userData.src && want.has(l.userData.src)) want.delete(l.userData.src);
        else free.push(l);
      }
      for (const src of want) {
        // Prefer a light that is already dark so nothing visibly jumps.
        free.sort((a, b) => a.intensity - b.intensity);
        const l = free.shift();
        if (!l) break;
        l.userData.src = src;
        l.userData.fresh = l.intensity < 0.05;
        if (l.userData.fresh) {
          l.position.copy(src.pos);
          l.color.set(src.color);
          l.distance = src.distance;
        }
      }
      for (const l of free) l.userData.src = null;
    }
    for (const l of this.lights) {
      const src = l.userData.src;
      // A light reassigned while still lit fades out first, then jumps and fades back in.
      let target = 0;
      if (src) {
        if (l.position.distanceToSquared(src.pos) > 0.01) {
          if (l.intensity < 0.05) {
            l.position.copy(src.pos);
            l.color.set(src.color);
            l.distance = src.distance;
          }
        } else target = src.intensity * active;
      }
      l.intensity = damp(l.intensity, target, 0.12, dt);
    }
  }

  setVisible(v) {
    for (const l of this.lights) l.visible = v;
  }
}
const _d = new THREE.Vector3();

// ---- Baked light footprints ---------------------------------------------------------------

export class Spots {
  constructor() {
    this.list = [];
    this.ambient = [0.5, 0.46, 0.42];
  }

  /** x, z centre, r radius (m, 1/e), k strength, color hex. */
  add(x, z, r, k, color = 0xffd9a8) {
    const c = new THREE.Color(color);
    this.list.push({ x, z, r2: r * r, k, c: [c.r, c.g, c.b], reach2: (r * 2.6) ** 2 });
  }

  /** Light reaching the floor at (x, z) → [r, g, b] multiplier (≈ 0.45 … 1.6). */
  at(x, z, out = [0, 0, 0]) {
    out[0] = this.ambient[0];
    out[1] = this.ambient[1];
    out[2] = this.ambient[2];
    for (const s of this.list) {
      const dx = x - s.x;
      const dz = z - s.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > s.reach2) continue;
      const f = Math.exp(-d2 / s.r2) * s.k;
      out[0] += s.c[0] * f;
      out[1] += s.c[1] * f;
      out[2] += s.c[2] * f;
    }
    // Soft shoulder instead of a hard clip so hot spots don't flatten the carpet pattern.
    for (let i = 0; i < 3; i++) out[i] = out[i] < 1.1 ? out[i] : 1.1 + (1 - Math.exp(-(out[i] - 1.1) * 1.5)) * 0.5;
    return out;
  }

  /** Bake into a geometry's 'color' attribute (positions in world space). `mul` scales it. */
  bake(geo, mul = 1, occlusion = null) {
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const o = [0, 0, 0];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      this.at(x, z, o);
      const occ = occlusion ? occlusion(x, pos.getY(i), z) : 1;
      col[i * 3] = o[0] * mul * occ;
      col[i * 3 + 1] = o[1] * mul * occ;
      col[i * 3 + 2] = o[2] * mul * occ;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  }
}

// ---- Additive glow quads ------------------------------------------------------------------

function glowTexture() {
  return canvasTexture('casino-glow', 128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.2, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.18)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  }, { srgb: false });
}

// Upward-fan wash a wall sconce throws (bright under the shade, fading up and sideways).
function washTexture() {
  return canvasTexture('casino-wash', 128, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = (x / (w - 1)) * 2 - 1;
        const v = y / (h - 1); // 0 top … 1 bottom
        const cy = 0.62;
        const dy = v - cy;
        const spread = 0.25 + Math.max(0, -dy) * 1.1 + Math.max(0, dy) * 0.6;
        const a = Math.exp(-((u / spread) ** 2) * 2.2) * Math.exp(-(dy * dy) / (dy < 0 ? 0.09 : 0.02));
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = Math.min(255, a * 255);
      }
    }
    g.putImageData(img, 0, 0);
  }, { srgb: false });
}

export class GlowSet {
  constructor(name = 'casino-glows') {
    this.name = name;
    this.items = { glow: [], wash: [] };
  }

  /** Radial glow quad: pos, normal (facing), size (m) or [w, h], color hex, k intensity. */
  add(pos, normal, size, color, k = 1, kind = 'glow') {
    const s = Array.isArray(size) ? size : [size, size];
    this.items[kind].push({ pos: pos.clone(), normal: normal.clone().normalize(), s, c: new THREE.Color(color).multiplyScalar(k) });
  }

  wash(pos, normal, w, h, color, k = 1) {
    this.add(pos, normal, [w, h], color, k, 'wash');
  }

  build(group) {
    const out = [];
    for (const kind of ['glow', 'wash']) {
      const list = this.items[kind];
      if (!list.length) continue;
      const mat = new THREE.MeshBasicMaterial({
        map: kind === 'glow' ? glowTexture() : washTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -8,
        toneMapped: true,
        fog: false,
      });
      const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, list.length);
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const z = new THREE.Vector3(0, 0, 1);
      list.forEach((it, i) => {
        q.setFromUnitVectors(z, it.normal);
        m4.compose(it.pos, q, new THREE.Vector3(it.s[0], it.s[1], 1));
        mesh.setMatrixAt(i, m4);
        mesh.setColorAt(i, it.c);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.renderOrder = 3;
      mesh.name = `${this.name}-${kind}`;
      group.add(mesh);
      out.push(mesh);
    }
    return out;
  }
}

// ---- Interior environment map --------------------------------------------------------------

/**
 * A warm, low-contrast "casino room" rendered into a PMREM: dark red carpet below, cream walls,
 * rows of lamp-coloured panels (chandeliers, machine glow) above. Same PMREM size as the sky's,
 * so swapping scene.environment never recompiles shaders.
 */
export function interiorEnvironment(renderer) {
  const scene = new THREE.Scene();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const room = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0x2a1410, side: THREE.BackSide }));
  room.scale.set(40, 9, 40);
  room.position.y = 3;
  scene.add(room);
  const add = (color, x, y, z, sx, sy, sz, k = 1) => {
    const m = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k) }));
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    scene.add(m);
  };
  add(0x4a1018, 0, -1.45, 0, 39, 0.1, 39); // carpet
  add(0x8a7050, 0, 7.4, 0, 39, 0.1, 39); // ceiling
  for (const s of [-1, 1]) {
    add(0x9a8054, s * 19.4, 3, 0, 0.2, 9, 39); // cream/gold walls
    add(0x9a8054, 0, 3, s * 19.4, 39, 9, 0.2);
  }
  // Chandeliers / downlights.
  for (let x = -15; x <= 15; x += 7.5) for (let z = -15; z <= 15; z += 7.5) add(0xffd6a0, x, 7.2, z, 1.4, 0.3, 1.4, 6);
  // Machine glow bands (cool and warm) at eye level.
  const tints = [0x4a7aff, 0xff4a8a, 0xffc040, 0x40e0a0];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    add(tints[i % 4], Math.cos(a) * 18.8, 1.2, Math.sin(a) * 18.8, 3, 1.2, 3, 2.2);
  }
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(scene, 0.035, 0.1, 100);
  pm.dispose();
  scene.traverse((o) => o.material?.dispose?.());
  box.dispose();
  return rt;
}
