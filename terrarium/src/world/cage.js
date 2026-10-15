// The glass terrarium: a soil tray with real terrain (hills, a pond, trees, bushes, rocks),
// glass walls, a lid with a hatch, its own lamp, and the weather machine.
import * as THREE from 'three';
import { TABLE } from './lab.js';
import { std, glassMat, glow } from './materials.js';
import { makeNoise, makeRng, clamp, lerp, rand } from '../core/util.js';
import { quality } from '../core/quality.js';

export const CAGE = {
  x0: TABLE.x - 1.2, x1: TABLE.x + 1.2, z0: TABLE.z - 0.75, z1: TABLE.z + 0.75,
  base: 0.84, bottom: TABLE.top, top: TABLE.top + 1.05,
  nx: 97, nz: 61,
};
CAGE.w = CAGE.x1 - CAGE.x0; CAGE.d = CAGE.z1 - CAGE.z0;
CAGE.cell = CAGE.w / (CAGE.nx - 1);

export const PAINT = { grass: 0, dirt: 1, sand: 2, snow: 3, rock: 4, farm: 5, mud: 6 };
const PAINT_COL = [
  [0x4f8a3a, 0x3f7430], [0x7a5a3a, 0x6a4a2e], [0xd8c48c, 0xcab478], [0xeef3f6, 0xdfe6ea], [0x7c7a74, 0x6a6862], [0x5e3f22, 0x4e341c], [0x4a3a28, 0x3e3020],
];
export const THEMES = {
  forest: 'Forest', desert: 'Desert', snow: 'Snow', jungle: 'Jungle', island: 'Island', mixed: 'Mixed', empty: 'Build your own (empty)',
};

// natural things in the cage
export const NAT = {
  tree: { label: 'Tree', r: 0.006, hp: 10 },
  pine: { label: 'Pine tree', r: 0.006, hp: 10 },
  palm: { label: 'Palm tree', r: 0.005, hp: 8 },
  bush: { label: 'Berry bush', r: 0.012, hp: 3 },
  rock: { label: 'Rock', r: 0.02, hp: 14 },
  cactus: { label: 'Cactus', r: 0.006, hp: 5 },
  mushroom: { label: 'Mushroom', r: 0.002, hp: 1 },
  log: { label: 'Fallen log', r: 0.01, hp: 4 },
};

export class Cage {
  constructor(world, scene) {
    this.world = world;
    this.group = new THREE.Group();
    this.group.name = 'cage';
    scene.add(this.group);
    this.h = new Float32Array(CAGE.nx * CAGE.nz);
    this.paint = new Uint8Array(CAGE.nx * CAGE.nz);
    this.waterY = CAGE.base - 0.02;
    this.baseWater = this.waterY;
    this.nat = [];
    this.obstacles = [];   // {x,z,r,ref}
    this.weather = { rain: 0, snow: 0, heat: 0, fog: 0, storm: 0, quake: 0, flood: 0, lava: 0, wind: 0, lamp: 'auto' };
    this.snowCover = 0;
    this.wet = 0;
    this.lavaPools = [];
    this.lidOpen = false;
    this.hatchOpen = false;
    this.glassHP = 100;
    this.cracks = [];
    this.graffiti = [];
    this.dirty = true;
    this.buildShell();
  }

  // ------------------------------------------------------------- shell
  buildShell() {
    const g = this.group;
    const C = this.world.colliders;
    const gm = glassMat();
    const H = CAGE.top - CAGE.bottom;
    const t = 0.008;
    const frame = std(0x1e2426, 0.35, 0.8);
    const mk = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    const cx = (CAGE.x0 + CAGE.x1) / 2, cz = (CAGE.z0 + CAGE.z1) / 2;
    this.glass = [
      mk(new THREE.BoxGeometry(CAGE.w, H, t), gm, cx, CAGE.bottom + H / 2, CAGE.z1 + t / 2),
      mk(new THREE.BoxGeometry(CAGE.w, H, t), gm, cx, CAGE.bottom + H / 2, CAGE.z0 - t / 2),
      mk(new THREE.BoxGeometry(t, H, CAGE.d), gm, CAGE.x0 - t / 2, CAGE.bottom + H / 2, cz),
      mk(new THREE.BoxGeometry(t, H, CAGE.d), gm, CAGE.x1 + t / 2, CAGE.bottom + H / 2, cz),
    ];
    for (const m of this.glass) m.renderOrder = 5;
    C.add(CAGE.x0 - 0.02, CAGE.bottom, CAGE.z1, CAGE.x1 + 0.02, CAGE.top, CAGE.z1 + 0.012, { zone: 'lab', walk: false, tag: 'glass' });
    C.add(CAGE.x0 - 0.02, CAGE.bottom, CAGE.z0 - 0.012, CAGE.x1 + 0.02, CAGE.top, CAGE.z0, { zone: 'lab', walk: false, tag: 'glass' });
    C.add(CAGE.x0 - 0.012, CAGE.bottom, CAGE.z0, CAGE.x0, CAGE.top, CAGE.z1, { zone: 'lab', walk: false, tag: 'glass' });
    C.add(CAGE.x1, CAGE.bottom, CAGE.z0, CAGE.x1 + 0.012, CAGE.top, CAGE.z1, { zone: 'lab', walk: false, tag: 'glass' });
    // metal frame edges
    const e = 0.018;
    for (const [x, z] of [[CAGE.x0, CAGE.z0], [CAGE.x1, CAGE.z0], [CAGE.x0, CAGE.z1], [CAGE.x1, CAGE.z1]]) mk(new THREE.BoxGeometry(e, H, e), frame, x, CAGE.bottom + H / 2, z).castShadow = true;
    for (const y of [CAGE.bottom + 0.01, CAGE.top]) {
      mk(new THREE.BoxGeometry(CAGE.w + e, e, e), frame, cx, y, CAGE.z0);
      mk(new THREE.BoxGeometry(CAGE.w + e, e, e), frame, cx, y, CAGE.z1);
      mk(new THREE.BoxGeometry(e, e, CAGE.d + e), frame, CAGE.x0, y, cz);
      mk(new THREE.BoxGeometry(e, e, CAGE.d + e), frame, CAGE.x1, y, cz);
    }
    // lid: mesh panel with a square hatch in the middle-front
    const lidMat = new THREE.MeshStandardMaterial({ color: 0x9fb4b6, roughness: 0.5, metalness: 0.6, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    this.lid = new THREE.Group();
    const hw = 0.16;
    const lidY = CAGE.top + 0.005;
    const hx = cx, hz = cz + 0.3;
    this.hatchPos = new THREE.Vector3(hx, lidY, hz);
    const panels = [
      [CAGE.x0, CAGE.z0, CAGE.x1, hz - hw], [CAGE.x0, hz + hw, CAGE.x1, CAGE.z1],
      [CAGE.x0, hz - hw, hx - hw, hz + hw], [hx + hw, hz - hw, CAGE.x1, hz + hw],
    ];
    for (const [a, b, c, d] of panels) { const m = new THREE.Mesh(new THREE.BoxGeometry(c - a, 0.004, d - b), lidMat); m.position.set((a + c) / 2, lidY, (b + d) / 2); this.lid.add(m); }
    this.hatch = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, 0.006, hw * 2), std(0x5a6a6c, 0.4, 0.7));
    this.hatch.position.set(hx, lidY + 0.002, hz);
    this.lid.add(this.hatch);
    g.add(this.lid);
    this.lidBox = C.add(CAGE.x0, CAGE.top, CAGE.z0, CAGE.x1, CAGE.top + 0.012, CAGE.z1, { zone: 'lab', walk: true, tag: 'lid' });
    // hanging lamp = the cage "sun"
    const lampY = CAGE.top + 0.75;
    mk(new THREE.CylinderGeometry(0.004, 0.004, 0.6, 6), frame, cx, lampY + 0.35, cz);
    const shade = mk(new THREE.CylinderGeometry(0.12, 0.32, 0.18, 24, 1, true), std(0x2f5c4f, 0.5, 0.5, { side: THREE.DoubleSide }), cx, lampY, cz);
    shade.castShadow = false;
    this.bulb = mk(new THREE.SphereGeometry(0.06, 14, 10), glow(0xfff2d0, 3), cx, lampY - 0.04, cz);
    this.sun = new THREE.SpotLight(0xfff4dc, 30, 3.2, 0.95, 0.55, 1.2);
    this.sun.position.set(cx, lampY - 0.06, cz);
    this.sun.target.position.set(cx, CAGE.base, cz);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.002;
    this.sun.shadow.camera.near = 0.3;
    this.sun.shadow.camera.far = 2.2;
    g.add(this.sun, this.sun.target);
    this.heatLight = new THREE.PointLight(0xff7a2a, 0, 2.5, 1.5);
    this.heatLight.position.set(cx + 0.6, CAGE.top + 0.1, cz);
    g.add(this.heatLight);
    this.flash = new THREE.PointLight(0xdfe8ff, 0, 4, 1);
    this.flash.position.set(cx, CAGE.top - 0.1, cz);
    g.add(this.flash);
    // wind fan clamped to the right glass
    this.fan = new THREE.Group();
    const fanBody = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 20), std(0x30373a, 0.4, 0.6));
    fanBody.rotation.z = Math.PI / 2;
    this.fanBlades = new THREE.Group();
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.075, 0.025), std(0xcfd8da, 0.4, 0.5)); b.position.y = 0.04; const p = new THREE.Group(); p.add(b); p.rotation.x = i * Math.PI / 2; this.fanBlades.add(p); }
    this.fanBlades.position.x = -0.025;
    this.fan.add(fanBody, this.fanBlades);
    this.fan.position.set(CAGE.x1 + 0.05, CAGE.top - 0.15, cz);
    g.add(this.fan);
    // soil tray sides are drawn as skirts in buildTerrainMesh
    this.terrainField = this.world.colliders.addField({
      x0: CAGE.x0, x1: CAGE.x1, z0: CAGE.z0, z1: CAGE.z1, on: true,
      height: (x, z) => this.heightAt(x, z),
      raycast: (o, d, max) => this.raycast(o, d, max),
    });
  }

  // ------------------------------------------------------------- terrain data
  idx(i, k) { return k * CAGE.nx + i; }
  hAt(i, k) { i = clamp(i, 0, CAGE.nx - 1); k = clamp(k, 0, CAGE.nz - 1); return this.h[k * CAGE.nx + i]; }

  heightAt(x, z) {
    const fx = (x - CAGE.x0) / CAGE.cell, fz = (z - CAGE.z0) / CAGE.cell;
    const i = Math.floor(fx), k = Math.floor(fz);
    const u = fx - i, v = fz - k;
    const a = this.hAt(i, k), b = this.hAt(i + 1, k), c = this.hAt(i, k + 1), d = this.hAt(i + 1, k + 1);
    return CAGE.base + lerp(lerp(a, b, u), lerp(c, d, u), v);
  }

  normalAt(x, z, out = new THREE.Vector3()) {
    const e = CAGE.cell;
    const hx = this.heightAt(x + e, z) - this.heightAt(x - e, z), hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return out.set(-hx, 2 * e, -hz).normalize();
  }

  paintAt(x, z) {
    const i = clamp(Math.round((x - CAGE.x0) / CAGE.cell), 0, CAGE.nx - 1), k = clamp(Math.round((z - CAGE.z0) / CAGE.cell), 0, CAGE.nz - 1);
    return this.paint[k * CAGE.nx + i];
  }

  inside(x, z, m = 0) { return x > CAGE.x0 + m && x < CAGE.x1 - m && z > CAGE.z0 + m && z < CAGE.z1 - m; }
  insideBox(p, m = 0) { return this.inside(p.x, p.z, m) && p.y < CAGE.top + 0.002 && p.y > CAGE.bottom - 0.01; }
  isWater(x, z) { return this.heightAt(x, z) < this.waterY - 0.0015; }
  waterDepth(x, z) { return Math.max(0, this.waterY - this.heightAt(x, z)); }

  raycast(o, d, max) {
    // march through the terrain box
    let t = 0;
    const step = CAGE.cell * 0.5;
    let prevAbove = true;
    for (let s = 0; s < 4000 && t <= max; s++) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      if (this.inside(x, z)) {
        const h = this.heightAt(x, z);
        const above = y > h;
        if (!above && prevAbove && s > 0) {
          // refine
          let a = t - step, b = t;
          for (let r = 0; r < 8; r++) { const m = (a + b) / 2; const yy = o.y + d.y * m; if (yy > this.heightAt(o.x + d.x * m, o.z + d.z * m)) a = m; else b = m; }
          return b;
        }
        prevAbove = above;
      } else prevAbove = true;
      // skip quickly if ray is far above the cage
      if (y > CAGE.top + 0.5 && d.y > 0) return null;
      t += step;
    }
    return null;
  }

  // ------------------------------------------------------------- generate a theme
  generate(theme, seed = 1) {
    this.theme = theme;
    const n = makeNoise(seed), n2 = makeNoise(seed + 7);
    const r = makeRng(seed + 3);
    const { nx, nz } = CAGE;
    this.nat = [];
    let water = -0.015;
    for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
      const u = i / (nx - 1), v = k / (nz - 1);
      const x = CAGE.x0 + u * CAGE.w, z = CAGE.z0 + v * CAGE.d;
      const base = n.fbm(u * 3.2, v * 2.2, 4);
      let h = 0, p = PAINT.grass;
      const edge = Math.min(u, 1 - u, v, 1 - v);
      switch (theme) {
        case 'forest': {
          h = 0.03 + base * 0.05 + Math.max(0, n2.fbm(u * 1.5 + 3, v * 1.5, 3)) * 0.12;
          const pond = Math.hypot((u - 0.68) * 2.4, (v - 0.55) * 1.6);
          if (pond < 0.32) h -= (0.32 - pond) * 0.25;
          p = h < 0.02 ? PAINT.dirt : PAINT.grass;
          water = 0.0;
          break;
        }
        case 'desert': {
          h = 0.03 + Math.abs(n.fbm(u * 2.5, v * 4, 3)) * 0.1 + Math.sin(u * 14 + base * 3) * 0.008;
          const oasis = Math.hypot((u - 0.3) * 2.4, (v - 0.4) * 1.6);
          if (oasis < 0.18) h -= (0.18 - oasis) * 0.3;
          p = oasis < 0.24 ? PAINT.grass : PAINT.sand;
          if (base > 0.35) p = PAINT.rock;
          water = 0.0;
          break;
        }
        case 'snow': {
          h = 0.03 + base * 0.06 + Math.max(0, n2.fbm(u * 2, v * 2, 3)) * 0.14;
          p = PAINT.snow;
          const pond = Math.hypot((u - 0.35) * 2.4, (v - 0.6) * 1.6);
          if (pond < 0.25) h -= (0.25 - pond) * 0.22;
          water = 0.0;
          break;
        }
        case 'jungle': {
          h = 0.04 + base * 0.07 + Math.max(0, n2.fbm(u * 3, v * 3, 3)) * 0.06;
          const river = Math.abs(v - 0.5 - Math.sin(u * 6) * 0.12);
          if (river < 0.07) h -= (0.07 - river) * 0.9;
          p = river < 0.1 ? PAINT.mud : PAINT.grass;
          water = 0.0;
          break;
        }
        case 'island': {
          const d = Math.hypot((u - 0.5) * 1.6, (v - 0.5) * 1.0);
          h = 0.07 - d * 0.22 + base * 0.03 + Math.max(0, 0.18 - d) * 0.4;
          p = h < 0.035 ? PAINT.sand : PAINT.grass;
          water = 0.03;
          break;
        }
        case 'mixed': {
          h = 0.03 + base * 0.045;
          // mountain against the back glass
          const mt = Math.max(0, 1 - Math.hypot((u - 0.2) * 2.2, (v - 0.02) * 2.4));
          h += mt * mt * 0.3;
          // pond with a waterfall from the mountain
          const pond = Math.hypot((u - 0.48) * 2.6, (v - 0.42) * 1.7);
          if (pond < 0.2) h -= (0.2 - pond) * 0.3;
          // beach on the right
          if (u > 0.82) { h = lerp(h, 0.012 - (u - 0.82) * 0.04, clamp((u - 0.82) * 8, 0, 1)); }
          p = PAINT.grass;
          if (mt > 0.45) p = PAINT.rock;
          if (u > 0.84) p = PAINT.sand;
          if (u > 0.55 && u < 0.75 && v > 0.62 && v < 0.88) { p = PAINT.farm; h = 0.03; }
          if (pond < 0.25 && pond > 0.2) p = PAINT.sand;
          water = 0.004;
          break;
        }
        default: { // empty: flat dirt to build on
          h = 0.025 + base * 0.004;
          p = PAINT.dirt;
          water = -0.05;
        }
      }
      // keep the edges flat-ish so the glass corners look tidy
      if (edge < 0.03) h = lerp(0.03, h, edge / 0.03);
      this.h[k * nx + i] = clamp(h, -0.035, 0.38);
      this.paint[k * nx + i] = p;
    }
    this.waterY = CAGE.base + water;
    this.baseWater = this.waterY;

    // natural objects
    const place = (type, count, test, sMin = 0.8, sMax = 1.3) => {
      for (let i = 0, tries = 0; i < count && tries < count * 30; tries++) {
        const x = lerp(CAGE.x0 + 0.04, CAGE.x1 - 0.04, r()), z = lerp(CAGE.z0 + 0.04, CAGE.z1 - 0.04, r());
        if (this.isWater(x, z)) continue;
        if (test && !test(x, z)) continue;
        if (this.nat.some((o) => Math.hypot(o.x - x, o.z - z) < (NAT[o.type].r + NAT[type].r) * 2.2)) continue;
        this.addNat(type, x, z, lerp(sMin, sMax, r()), r);
        i++;
      }
    };
    const isP = (pp) => (x, z) => this.paintAt(x, z) === pp;
    switch (theme) {
      case 'forest': place('tree', 34); place('pine', 10); place('bush', 16); place('rock', 12); place('mushroom', 14); place('log', 5); break;
      case 'desert': place('cactus', 22, isP(PAINT.sand)); place('palm', 7, isP(PAINT.grass)); place('rock', 22); place('bush', 5, isP(PAINT.grass)); break;
      case 'snow': place('pine', 38); place('rock', 14); place('bush', 6); place('log', 4); break;
      case 'jungle': place('tree', 40, null, 1.0, 1.6); place('palm', 18); place('bush', 26); place('mushroom', 18); place('rock', 8); break;
      case 'island': place('palm', 16); place('bush', 10); place('rock', 10); place('tree', 6); break;
      case 'mixed': place('tree', 22, (x, z) => (x - CAGE.x0) / CAGE.w < 0.42); place('pine', 8, isP(PAINT.rock)); place('bush', 14); place('rock', 14); place('mushroom', 10); place('palm', 4, isP(PAINT.sand)); place('log', 4); break;
      default: place('rock', 3); break;
    }
    this.snowCover = theme === 'snow' ? 1 : 0;
    this.dirty = true;
    this.rebuild();
  }

  addNat(type, x, z, s = 1, r = rand) {
    const o = { type, x, z, s, rot: r() * Math.PI * 2, hp: NAT[type].hp * s, food: type === 'bush' ? 3 : type === 'mushroom' ? 1 : 0, poison: type === 'mushroom' && r() < 0.35, grow: 1, regrow: 0 };
    this.nat.push(o);
    this.dirty = true;
    return o;
  }

  removeNat(o) {
    const i = this.nat.indexOf(o);
    if (i >= 0) this.nat.splice(i, 1);
    this.dirty = true;
  }

  // ------------------------------------------------------------- meshes
  rebuild() {
    this.buildTerrainMesh();
    this.buildNatMeshes();
    this.buildGrass();
    this.buildWater();
    this.rebuildObstacles();
    this.dirty = false;
  }

  buildTerrainMesh() {
    const { nx, nz } = CAGE;
    if (!this.terrain) {
      const geo = new THREE.PlaneGeometry(CAGE.w, CAGE.d, nx - 1, nz - 1);
      geo.rotateX(-Math.PI / 2);
      geo.translate((CAGE.x0 + CAGE.x1) / 2, 0, (CAGE.z0 + CAGE.z1) / 2);
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nx * nz * 3), 3));
      this.terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
      this.terrain.receiveShadow = true;
      this.terrain.castShadow = true;
      this.group.add(this.terrain);
      // skirts (the soil you see through the glass)
      const sk = new THREE.BufferGeometry();
      const n = (nx + nz) * 2;
      sk.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));
      const idx = [];
      for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      sk.setIndex(idx);
      this.skirt = new THREE.Mesh(sk, new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 1, side: THREE.DoubleSide }));
      this.group.add(this.skirt);
    }
    const pos = this.terrain.geometry.attributes.position;
    const col = this.terrain.geometry.attributes.color;
    const c = new THREE.Color(), c2 = new THREE.Color(), snowC = new THREE.Color(0xf2f6fa), wetC = new THREE.Color(0x3a2c20);
    const noise = makeNoise(5);
    for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
      const id = k * nx + i;
      const y = CAGE.base + this.h[id];
      pos.setY(id, y);
      const pp = this.paint[id];
      const pc = PAINT_COL[pp] || PAINT_COL[0];
      const nn = noise(i * 0.35, k * 0.35) * 0.5 + 0.5;
      c.setHex(pc[0]).lerp(c2.setHex(pc[1]), nn);
      // slope -> rock, under water -> dark mud
      const sl = Math.abs(this.hAt(i + 1, k) - this.hAt(i - 1, k)) + Math.abs(this.hAt(i, k + 1) - this.hAt(i, k - 1));
      if (sl > CAGE.cell * 1.6 && pp !== PAINT.snow) c.lerp(c2.setHex(0x6e6a62), clamp((sl - CAGE.cell * 1.6) * 30, 0, 0.8));
      if (y < this.waterY) c.lerp(wetC, 0.6);
      if (this.snowCover > 0 && pp !== PAINT.snow) c.lerp(snowC, this.snowCover * clamp(1 - sl * 20, 0.3, 1));
      if (this.wet > 0) c.multiplyScalar(1 - this.wet * 0.25);
      col.setXYZ(id, c.r, c.g, c.b);
    }
    pos.needsUpdate = true; col.needsUpdate = true;
    this.terrain.geometry.computeVertexNormals();
    this.terrain.geometry.computeBoundingSphere();
    // skirt along the 4 edges
    const sp = this.skirt.geometry.attributes.position;
    let w = 0;
    const put = (x, z, top) => { sp.setXYZ(w++, x, top, z); sp.setXYZ(w++, x, CAGE.bottom + 0.002, z); };
    for (let i = 0; i < nx; i++) put(CAGE.x0 + i * CAGE.cell, CAGE.z1 - 0.0005, CAGE.base + this.hAt(i, nz - 1));
    for (let k = nz - 1; k >= 0; k--) put(CAGE.x1 - 0.0005, CAGE.z0 + k * CAGE.cell, CAGE.base + this.hAt(nx - 1, k));
    for (let i = nx - 1; i >= 0; i--) put(CAGE.x0 + i * CAGE.cell, CAGE.z0 + 0.0005, CAGE.base + this.hAt(i, 0));
    for (let k = 0; k < nz; k++) put(CAGE.x0 + 0.0005, CAGE.z0 + k * CAGE.cell, CAGE.base + this.hAt(0, k));
    sp.needsUpdate = true;
    this.skirt.geometry.computeVertexNormals();
    this.skirt.geometry.computeBoundingSphere();
  }

  buildNatMeshes() {
    const types = {
      trunk: { geo: new THREE.CylinderGeometry(0.6, 1, 1, 7), mat: std(0x5b3d26, 0.95) },
      crown: { geo: new THREE.IcosahedronGeometry(1, 1), mat: std(0x3d7a32, 0.85) },
      crown2: { geo: new THREE.IcosahedronGeometry(1, 1), mat: std(0x4c8c3a, 0.85) },
      pine: { geo: new THREE.ConeGeometry(1, 1, 9), mat: std(0x2a5a34, 0.85) },
      palmleaf: { geo: new THREE.ConeGeometry(1, 1, 3), mat: std(0x4f9a3a, 0.8) },
      bush: { geo: new THREE.IcosahedronGeometry(1, 1), mat: std(0x3f7a30, 0.9) },
      berry: { geo: new THREE.SphereGeometry(1, 6, 5), mat: std(0xc0182c, 0.4) },
      rock: { geo: new THREE.DodecahedronGeometry(1, 0), mat: std(0x8a8780, 0.9) },
      cactus: { geo: new THREE.CapsuleGeometry(1, 2, 3, 8), mat: std(0x4f8a45, 0.8) },
      shroomStem: { geo: new THREE.CylinderGeometry(0.6, 0.8, 1, 8), mat: std(0xf0e6d0, 0.8) },
      shroomCap: { geo: new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat: std(0xc0392b, 0.6) },
      shroomCap2: { geo: new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat: std(0xb08a5a, 0.7) },
      log: { geo: new THREE.CylinderGeometry(1, 1, 1, 8), mat: std(0x6a4a30, 0.95) },
    };
    if (!this.natMeshes) {
      this.natMeshes = {};
      for (const [k, t] of Object.entries(types)) {
        const m = new THREE.InstancedMesh(t.geo, t.mat, 400);
        m.castShadow = k !== 'berry';
        m.receiveShadow = true;
        m.frustumCulled = false;
        m.count = 0;
        this.natMeshes[k] = m;
        this.group.add(m);
      }
    }
    const M = this.natMeshes;
    for (const m of Object.values(M)) m.count = 0;
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const add = (key, x, y, z, sx, sy, sz, rotY = 0, rx = 0, rz = 0) => {
      const m = M[key]; if (m.count >= 400) return;
      q.setFromEuler(new THREE.Euler(rx, rotY, rz));
      mtx.compose(p.set(x, y, z), q, s.set(sx, sy, sz));
      m.setMatrixAt(m.count++, mtx);
    };
    const snow = this.snowCover;
    for (const o of this.nat) {
      const y = this.heightAt(o.x, o.z);
      const s0 = o.s * o.grow;
      switch (o.type) {
        case 'tree': {
          const h = 0.16 * s0;
          add('trunk', o.x, y + h * 0.35, o.z, 0.006 * s0, h * 0.7, 0.006 * s0, o.rot);
          add('crown', o.x, y + h * 0.72, o.z, 0.05 * s0, 0.045 * s0, 0.05 * s0, o.rot);
          add('crown2', o.x + 0.02 * s0, y + h * 0.9, o.z - 0.01 * s0, 0.035 * s0, 0.032 * s0, 0.035 * s0, o.rot);
          add('crown', o.x - 0.022 * s0, y + h * 0.82, o.z + 0.012 * s0, 0.032 * s0, 0.03 * s0, 0.032 * s0, o.rot);
          break;
        }
        case 'pine': {
          const h = 0.2 * s0;
          add('trunk', o.x, y + h * 0.2, o.z, 0.005 * s0, h * 0.4, 0.005 * s0, o.rot);
          for (let i = 0; i < 3; i++) add('pine', o.x, y + h * (0.38 + i * 0.2), o.z, 0.04 * s0 * (1 - i * 0.25), h * 0.38, 0.04 * s0 * (1 - i * 0.25), o.rot + i);
          break;
        }
        case 'palm': {
          const h = 0.17 * s0;
          add('trunk', o.x, y + h * 0.5, o.z, 0.0045 * s0, h, 0.0045 * s0, o.rot, 0.08, 0.05);
          for (let i = 0; i < 6; i++) { const a = o.rot + (i / 6) * Math.PI * 2; add('palmleaf', o.x + Math.cos(a) * 0.025 * s0, y + h * 0.98, o.z + Math.sin(a) * 0.025 * s0, 0.008 * s0, 0.06 * s0, 0.002 * s0, -a, 0, Math.PI / 2 - 0.35); }
          break;
        }
        case 'bush': {
          add('bush', o.x, y + 0.008 * s0, o.z, 0.017 * s0, 0.013 * s0, 0.017 * s0, o.rot);
          add('bush', o.x + 0.008 * s0, y + 0.006 * s0, o.z + 0.006 * s0, 0.011 * s0, 0.009 * s0, 0.011 * s0, o.rot);
          for (let i = 0; i < Math.min(o.food, 5); i++) { const a = o.rot + i * 2.1; add('berry', o.x + Math.cos(a) * 0.013 * s0, y + 0.012 * s0 + (i % 2) * 0.004, o.z + Math.sin(a) * 0.013 * s0, 0.0025, 0.0025, 0.0025); }
          break;
        }
        case 'rock': add('rock', o.x, y + 0.006 * s0, o.z, 0.02 * s0 * (o.hp / (NAT.rock.hp * o.s) * 0.6 + 0.4), 0.014 * s0, 0.017 * s0, o.rot, 0.3, 0.1); break;
        case 'cactus': {
          const h = 0.05 * s0;
          add('cactus', o.x, y + h * 0.5, o.z, 0.006 * s0, h * 0.25, 0.006 * s0, o.rot);
          add('cactus', o.x + 0.009 * s0, y + h * 0.6, o.z, 0.004 * s0, h * 0.12, 0.004 * s0, o.rot);
          break;
        }
        case 'mushroom': {
          add('shroomStem', o.x, y + 0.003 * s0, o.z, 0.0016 * s0, 0.006 * s0, 0.0016 * s0);
          add(o.poison ? 'shroomCap' : 'shroomCap2', o.x, y + 0.006 * s0, o.z, 0.0045 * s0, 0.003 * s0, 0.0045 * s0);
          break;
        }
        case 'log': add('log', o.x, y + 0.006 * s0, o.z, 0.006 * s0, 0.05 * s0, 0.006 * s0, o.rot, 0, Math.PI / 2); break;
        default: break;
      }
    }
    for (const m of Object.values(M)) m.instanceMatrix.needsUpdate = true;
    // snow tint on leaves
    M.crown.material.color.setHex(snow > 0.5 ? 0xdfe8e0 : 0x3d7a32);
    M.pine.material.color.setHex(snow > 0.5 ? 0xcfdcd4 : 0x2a5a34);
  }

  buildGrass() {
    const density = quality.p.grass;
    if (this.grass) { this.group.remove(this.grass); this.grass.geometry.dispose(); this.grass = null; }
    if (!density) return;
    const blade = new THREE.BufferGeometry();
    const v = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      const cx = Math.cos(a) * 0.0012, cz = Math.sin(a) * 0.0012;
      v.push(-cx, 0, -cz, cx, 0, cz, 0, 0.0075, 0);
    }
    blade.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    blade.computeVertexNormals();
    const count = Math.floor(4500 * density);
    const m = new THREE.InstancedMesh(blade, new THREE.MeshStandardMaterial({ color: 0x5f9a3c, roughness: 0.9, side: THREE.DoubleSide }), count);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const r = makeRng(42);
    let n = 0;
    for (let t = 0; t < count * 4 && n < count; t++) {
      const x = lerp(CAGE.x0 + 0.01, CAGE.x1 - 0.01, r()), z = lerp(CAGE.z0 + 0.01, CAGE.z1 - 0.01, r());
      if (this.paintAt(x, z) !== PAINT.grass || this.isWater(x, z)) continue;
      const y = this.heightAt(x, z);
      q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.4, r() * 6, (r() - 0.5) * 0.4));
      const sc = 0.7 + r() * 0.9;
      mtx.compose(p.set(x, y, z), q, s.set(sc, sc * (0.8 + r() * 0.6), sc));
      m.setMatrixAt(n++, mtx);
    }
    m.count = n;
    m.receiveShadow = true;
    m.frustumCulled = false;
    if (this.snowCover > 0.5) m.material.color.setHex(0xdfe8e4);
    this.grass = m;
    this.group.add(m);
  }

  buildWater() {
    if (!this.water) {
      const geo = new THREE.PlaneGeometry(CAGE.w - 0.002, CAGE.d - 0.002, 1, 1);
      geo.rotateX(-Math.PI / 2);
      this.waterMat = new THREE.MeshStandardMaterial({ color: 0x2f7aa8, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.72, depthWrite: false });
      this.water = new THREE.Mesh(geo, this.waterMat);
      this.water.position.set((CAGE.x0 + CAGE.x1) / 2, 0, (CAGE.z0 + CAGE.z1) / 2);
      this.water.renderOrder = 2;
      this.group.add(this.water);
      // waterfall strip (mixed theme)
      this.fall = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.2), new THREE.MeshStandardMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0.55, emissive: 0x204060, roughness: 0.1, depthWrite: false }));
      this.fall.visible = false;
      this.group.add(this.fall);
    }
    this.water.position.y = this.waterY;
    this.water.visible = this.waterY > CAGE.base - 0.035;
    if (this.theme === 'mixed') {
      const fx = CAGE.x0 + CAGE.w * 0.3, fz = CAGE.z0 + CAGE.d * 0.22;
      const top = this.heightAt(fx, fz - 0.03), bot = this.waterY;
      this.fall.visible = top > bot + 0.03;
      this.fall.position.set(fx, (top + bot) / 2, fz);
      this.fall.scale.y = (top - bot) / 0.2;
    }
    if (this.snowCover > 0.8 && this.weather.heat <= 0) { this.waterMat.color.setHex(0xcfe6f2); this.waterMat.opacity = 0.9; this.frozen = true; } else { this.waterMat.color.setHex(0x2f7aa8); this.waterMat.opacity = 0.72; this.frozen = false; }
  }

  rebuildObstacles() {
    this.obstacles = [];
    for (const o of this.nat) {
      if (o.type === 'mushroom' || o.type === 'bush') continue;
      const r = (o.type === 'rock' ? 0.017 * o.s * (o.hp / (NAT.rock.hp * o.s) * 0.6 + 0.4) : o.type === 'log' ? 0.008 : NAT[o.type].r) * o.s;
      this.obstacles.push({ x: o.x, z: o.z, r, ref: o, h: o.type === 'rock' ? 0.012 * o.s : 0.3 });
    }
    for (const b of this.world.society ? this.world.society.buildings : []) if (b.solid) this.obstacles.push({ x: b.x, z: b.z, r: b.r, ref: b, h: b.h || 0.03 });
    // simple spatial grid for queries
    this.obGrid = new Map();
    const cs = 0.06;
    for (const ob of this.obstacles) {
      const x0 = Math.floor((ob.x - ob.r) / cs), x1 = Math.floor((ob.x + ob.r) / cs), z0 = Math.floor((ob.z - ob.r) / cs), z1 = Math.floor((ob.z + ob.r) / cs);
      for (let i = x0; i <= x1; i++) for (let k = z0; k <= z1; k++) { const key = i * 1000 + k; let a = this.obGrid.get(key); if (!a) this.obGrid.set(key, a = []); a.push(ob); }
    }
  }

  obstaclesNear(x, z, r) {
    const cs = 0.06, out = [];
    if (!this.obGrid) return out;
    const x0 = Math.floor((x - r) / cs), x1 = Math.floor((x + r) / cs), z0 = Math.floor((z - r) / cs), z1 = Math.floor((z + r) / cs);
    for (let i = x0; i <= x1; i++) for (let k = z0; k <= z1; k++) { const a = this.obGrid.get(i * 1000 + k); if (a) for (const o of a) if (!out.includes(o)) out.push(o); }
    return out;
  }

  // push a circle out of trees/rocks/buildings. y = feet height (so short rocks can be stepped on when big)
  pushOut(pos, r, heightOfMover = 1) {
    for (const ob of this.obstaclesNear(pos.x, pos.z, r)) {
      if (ob.h < heightOfMover * 0.25) continue;
      const dx = pos.x - ob.x, dz = pos.z - ob.z;
      const d = Math.hypot(dx, dz), min = ob.r + r;
      if (d < min && d > 1e-9) { pos.x = ob.x + (dx / d) * min; pos.z = ob.z + (dz / d) * min; }
    }
    pos.x = clamp(pos.x, CAGE.x0 + r, CAGE.x1 - r);
    pos.z = clamp(pos.z, CAGE.z0 + r, CAGE.z1 - r);
  }

  // ------------------------------------------------------------- terrain brush
  brush(x, z, tool, radius, strength, dt) {
    const { nx, nz } = CAGE;
    const ci = Math.round((x - CAGE.x0) / CAGE.cell), ck = Math.round((z - CAGE.z0) / CAGE.cell);
    const rc = Math.ceil(radius / CAGE.cell);
    let avg = 0, cnt = 0;
    if (tool === 'smooth' || tool === 'flatten') {
      for (let k = ck - rc; k <= ck + rc; k++) for (let i = ci - rc; i <= ci + rc; i++) { if (i < 0 || k < 0 || i >= nx || k >= nz) continue; avg += this.h[k * nx + i]; cnt++; }
      avg /= Math.max(1, cnt);
    }
    for (let k = ck - rc; k <= ck + rc; k++) for (let i = ci - rc; i <= ci + rc; i++) {
      if (i < 0 || k < 0 || i >= nx || k >= nz) continue;
      const d = Math.hypot(i - ci, k - ck) * CAGE.cell;
      if (d > radius) continue;
      const f = Math.pow(1 - d / radius, 1.5) * strength * dt;
      const id = k * nx + i;
      switch (tool) {
        case 'raise': this.h[id] = Math.min(0.38, this.h[id] + f * 0.12); break;
        case 'lower': this.h[id] = Math.max(-0.035, this.h[id] - f * 0.12); break;
        case 'smooth': {
          const nb = (this.hAt(i - 1, k) + this.hAt(i + 1, k) + this.hAt(i, k - 1) + this.hAt(i, k + 1)) / 4;
          this.h[id] = lerp(this.h[id], nb, clamp(f * 8, 0, 1)); break;
        }
        case 'flatten': this.h[id] = lerp(this.h[id], avg, clamp(f * 6, 0, 1)); break;
        default:
          if (tool.startsWith('paint:')) { if (d < radius * 0.8) this.paint[id] = PAINT[tool.slice(6)]; }
      }
    }
    this.terrainDirty = true;
  }

  // ------------------------------------------------------------- weather + time
  update(dt, ctx) {
    const W = this.weather;
    const day = ctx.daylight; // 0 night .. 1 noon
    const lampOn = W.lamp === 'on' || (W.lamp === 'auto' && day > 0.05);
    const target = W.lamp === 'off' ? 0 : W.lamp === 'on' ? 30 : 30 * clamp(day * 1.4, 0, 1);
    this.sun.intensity = lerp(this.sun.intensity, target * (W.storm ? 0.45 : W.rain ? 0.7 : 1) * (W.fog ? 0.8 : 1), 1 - Math.exp(-dt * 3));
    const warm = 1 - clamp(day * 2, 0, 1);
    this.sun.color.setRGB(1, 0.92 - warm * 0.2, 0.8 - warm * 0.35);
    this.bulb.material.emissiveIntensity = lampOn ? 0.5 + this.sun.intensity / 10 : 0.05;
    this.heatLight.intensity = W.heat ? 4 + Math.sin(ctx.time * 3) * 0.3 : 0;
    // fan
    if (W.wind) this.fanBlades.rotation.x += dt * 30;
    // snow cover builds up / melts
    const prevSnow = this.snowCover;
    if (W.snow) this.snowCover = Math.min(1, this.snowCover + dt * 0.02);
    else if (this.theme !== 'snow' || W.heat) this.snowCover = Math.max(0, this.snowCover - dt * (W.heat ? 0.05 : 0.008));
    const prevWet = this.wet;
    if (W.rain || W.storm) this.wet = Math.min(1, this.wet + dt * 0.05); else this.wet = Math.max(0, this.wet - dt * (W.heat ? 0.05 : 0.01));
    // flood rises, then drains
    const floodTarget = W.flood ? this.baseWater + 0.09 : this.baseWater + (W.rain || W.storm ? 0.006 : 0) - (W.heat ? 0.006 : 0);
    const prevWater = this.waterY;
    this.waterY = lerp(this.waterY, floodTarget, 1 - Math.exp(-dt * (W.flood ? 0.12 : 0.05)));
    if (Math.abs(this.waterY - prevWater) > 1e-6) { this.water.position.y = this.waterY; this.water.visible = this.waterY > CAGE.base - 0.035; }
    if (Math.abs(prevSnow - this.snowCover) > 0.02 || Math.abs(prevWet - this.wet) > 0.04 || this.terrainDirty) {
      this.buildTerrainMesh(); this.terrainDirty = false;
      if ((prevSnow > 0.5) !== (this.snowCover > 0.5)) { this.buildNatMeshes(); this.buildGrass(); this.buildWater(); }
    }
    // lightning
    if (W.storm && Math.random() < dt * 0.25) this.lightning(ctx);
    this.flash.intensity = Math.max(0, this.flash.intensity - dt * 40);
    // earthquake
    this.quakeOffset = W.quake ? (Math.random() - 0.5) * 0.004 : 0;
    // berries regrow, saplings grow
    for (const o of this.nat) {
      if (o.type === 'bush' && o.food < 5) { o.regrow += dt; if (o.regrow > 90) { o.regrow = 0; o.food++; this.dirty = true; } }
      if (o.grow < 1) { o.grow = Math.min(1, o.grow + dt * 0.01); this.growDirtyT = (this.growDirtyT || 0) + dt; }
    }
    if (this.growDirtyT > 2) { this.growDirtyT = 0; this.dirty = true; }
    if (this.dirty) { this.buildNatMeshes(); this.rebuildObstacles(); this.dirty = false; }
    // lava pools glow + burn
    for (const lp of this.lavaPools) lp.t += dt;
  }

  lightning(ctx) {
    const x = lerp(CAGE.x0 + 0.1, CAGE.x1 - 0.1, Math.random()), z = lerp(CAGE.z0 + 0.1, CAGE.z1 - 0.1, Math.random());
    this.flash.position.set(x, CAGE.top - 0.05, z);
    this.flash.intensity = 60;
    if (ctx.onStrike) ctx.onStrike(new THREE.Vector3(x, this.heightAt(x, z), z));
  }

  addLava(x, z) {
    const geo = new THREE.CircleGeometry(0.04, 20);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x331000, emissive: 0xff5a10, emissiveIntensity: 2.2, roughness: 0.6 }));
    m.position.set(x, this.heightAt(x, z) + 0.002, z);
    this.group.add(m);
    const l = new THREE.PointLight(0xff5a10, 2, 0.4, 1.5);
    l.position.set(x, m.position.y + 0.03, z);
    this.group.add(l);
    this.lavaPools.push({ x, z, r: 0.04, mesh: m, light: l, t: 0 });
  }

  clearLava() {
    for (const lp of this.lavaPools) { this.group.remove(lp.mesh, lp.light); lp.mesh.geometry.dispose(); }
    this.lavaPools = [];
  }

  lavaAt(x, z) { return this.lavaPools.some((l) => Math.hypot(l.x - x, l.z - z) < l.r); }

  // crack the glass (escapes / big hits)
  damageGlass(amount, at) {
    this.glassHP = Math.max(0, this.glassHP - amount);
    if (at) this.cracks.push(at.clone());
  }

  setLid(open) { this.lidOpen = open; this.lid.visible = !open; this.lidBox.on = !open; }
  setHatch(open) { this.hatchOpen = open; this.hatch.visible = !open; }

  // ------------------------------------------------------------- save / load
  save() {
    return {
      theme: this.theme, h: Array.from(this.h, (v) => Math.round(v * 10000) / 10000), paint: Array.from(this.paint), waterY: this.baseWater,
      nat: this.nat.map((o) => ({ ...o })), weather: { ...this.weather }, snow: this.snowCover, lid: this.lidOpen, glassHP: this.glassHP,
      lava: this.lavaPools.map((l) => [l.x, l.z]), graffiti: this.graffiti,
    };
  }

  load(d) {
    this.theme = d.theme;
    this.h.set(d.h); this.paint.set(d.paint);
    this.baseWater = this.waterY = d.waterY;
    this.nat = d.nat.map((o) => ({ ...o }));
    Object.assign(this.weather, d.weather || {});
    this.snowCover = d.snow || 0;
    this.glassHP = d.glassHP ?? 100;
    this.setLid(!!d.lid);
    this.clearLava();
    for (const [x, z] of d.lava || []) this.addLava(x, z);
    this.graffiti = d.graffiti || [];
    this.rebuild();
  }
}
