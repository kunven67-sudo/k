// Building kit: materials made from real (CC0) textures + furniture/prop builders.
// Builders push geometry (already transformed into floor space) into a Batch; the Batch merges everything per
// material into a few meshes (cheap to draw), gives every surface real-size UVs, and bakes collision layers.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { texture, hasAsset } from '../core/assets.js';

// ------------------------------------------------------------------ materials
// tex: texture name in assets/tex, size: metres covered by one texture tile
const MAT_DEFS = {
  labfloor: { tex: 'labfloor', size: 1.6, color: 0xffffff, rough: 0.6, desat: 0.08, bright: 1.75 },
  plaster: { tex: 'plaster', size: 2.4, color: 0xf0eeea, rough: 0.85 },
  plasterGrey: { tex: 'plaster', size: 2.4, color: 0xb8bcc2, rough: 0.85 },
  walltile: { tex: 'walltile', size: 1.2, color: 0xffffff, rough: 0.35 },
  ceiling: { tex: 'ceiling', size: 0.6, color: 0xf2f2ee, rough: 0.95 },
  concrete: { tex: 'concrete', size: 3, color: 0xb0aca6, rough: 0.9 },
  concreteFloor: { tex: 'concretefloor', size: 3, color: 0xa8a49c, rough: 0.85 },
  diamond: { tex: 'diamondplate', size: 1, color: 0xb0b4b8, rough: 0.5, metal: 0.8 },
  darkmetal: { tex: 'darkmetal', size: 1.5, color: 0x9a9a9a, rough: 0.55, metal: 0.6 },
  ribmetal: { tex: 'ribmetal', size: 2, color: 0x8a8e94, rough: 0.5, metal: 0.6 },
  laminate: { tex: 'laminate', size: 1.4, color: 0xd8cbb8, rough: 0.45 },
  parquet: { tex: 'parquet', size: 1.6, color: 0xb08860, rough: 0.4 },
  blackmarble: { tex: 'blackmarble', size: 2.4, color: 0xffffff, rough: 0.12 },
  terrazzo: { tex: 'terrazzo', size: 2, color: 0xe0dcd4, rough: 0.3 },
  carpet: { tex: 'carpet', size: 1.0, color: 0x6a7480, rough: 0.98 },
  leather: { tex: 'leather', size: 0.6, color: 0x2a2220, rough: 0.5 },
  kitchentile: { tex: 'kitchentile', size: 1.2, color: 0x9a6a52, rough: 0.7 },
  rubbertile: { tex: 'rubbertile', size: 1.2, color: 0x6a6a6a, rough: 0.8 },
  brushedconcrete: { tex: 'brushedconcrete', size: 3, color: 0xc8c4bc, rough: 0.85 },
  smalltile: { tex: 'smalltile', size: 0.8, color: 0xf4f4f4, rough: 0.3 },
  steel: { color: 0xc9cdd2, rough: 0.28, metal: 1, brushed: true },
  epoxy: { color: 0x15171a, rough: 0.32 },
  chrome: { color: 0xe8ecf0, rough: 0.08, metal: 1 },
  alu: { color: 0xb8bcc2, rough: 0.35, metal: 1 },
  blackPlastic: { color: 0x141516, rough: 0.45 },
  darkPlastic: { color: 0x2a2c30, rough: 0.5 },
  greyPlastic: { color: 0x8a8e94, rough: 0.5 },
  whitePlastic: { color: 0xe8e8e6, rough: 0.4 },
  beigePlastic: { color: 0xd8d2c4, rough: 0.5 },
  rubber: { color: 0x101010, rough: 0.9 },
  paint: { color: 0xd6d8da, rough: 0.55, metal: 0.2 },
  paintGreen: { color: 0x4a6a58, rough: 0.55, metal: 0.2 },
  paintBlue: { color: 0x2c4a7a, rough: 0.5, metal: 0.2 },
  paintRed: { color: 0xa01818, rough: 0.5 },
  paintYellow: { color: 0xd8a818, rough: 0.5 },
  wood: { tex: 'laminate', size: 1.2, color: 0x9a7a58, rough: 0.5 },
  fabric: { tex: 'carpet', size: 0.5, color: 0x2a3038, rough: 0.95 },
  fabricRed: { tex: 'carpet', size: 0.5, color: 0x6a2020, rough: 0.95 },
  paper: { color: 0xf4f2ec, rough: 0.9 },
  cardboard: { color: 0xa88a62, rough: 0.9 },
  black: { color: 0x050505, rough: 0.6 },
  glass: { color: 0xf2f7f9, rough: 0.03, glass: true, opacity: 0.07 },
  glassGreen: { color: 0xa8c8b0, rough: 0.05, glass: true, opacity: 0.35 },
  glassDark: { color: 0x202830, rough: 0.05, glass: true, opacity: 0.55 },
  liquidBlue: { color: 0x3a8ad8, rough: 0.1, glass: true, opacity: 0.6, emissive: 0x081830 },
  liquidGreen: { color: 0x58e080, rough: 0.1, glass: true, opacity: 0.7, emissive: 0x0a3a14 },
  liquidAmber: { color: 0xc8901a, rough: 0.1, glass: true, opacity: 0.75 },
  formalin: { color: 0xd8d0a0, rough: 0.05, glass: true, opacity: 0.4 },
  lightPanel: { color: 0xffffff, rough: 0.5, emissive: 0xeef4ff, emissiveI: 1.7 },
  lightWarm: { color: 0xffffff, rough: 0.5, emissive: 0xffd9a8, emissiveI: 1.6 },
  screen: { color: 0x061018, rough: 0.2, emissive: 0x2a6a8a, emissiveI: 1.4 },
  screenGreen: { color: 0x02120a, rough: 0.2, emissive: 0x1ab060, emissiveI: 1.6 },
  screenOff: { color: 0x050607, rough: 0.12 },
  ledBlue: { color: 0x000000, rough: 0.5, emissive: 0x2a8aff, emissiveI: 6 },
  ledGreen: { color: 0x000000, rough: 0.5, emissive: 0x20ff60, emissiveI: 5 },
  ledRed: { color: 0x000000, rough: 0.5, emissive: 0xff2010, emissiveI: 6 },
  exitSign: { color: 0x0a2010, rough: 0.5, emissive: 0x30ff70, emissiveI: 3.5 },
  frost: { color: 0xeaf6ff, rough: 0.6, emissive: 0x203040, emissiveI: 0.3 },
  specimen: { color: 0x4a3a30, rough: 0.6 },
  fleshPale: { color: 0xc8a890, rough: 0.6 },
  soil: { color: 0x3a2a1e, rough: 0.95 },
  plant: { color: 0x2f5a2a, rough: 0.7 },
  food: { color: 0xc89058, rough: 0.7 },
};

export class Mats {
  constructor(renderer) { this.r = renderer; this.cache = {}; this.ready = false; }
  async load(keys) {
    const want = keys || Object.keys(MAT_DEFS);
    for (const k of want) await this.get(k);
    this.ready = true;
  }
  async get(key) {
    if (this.cache[key]) return this.cache[key];
    const d = MAT_DEFS[key] || MAT_DEFS.paint;
    let m;
    if (d.glass) {
      m = new THREE.MeshPhysicalMaterial({ color: d.color, roughness: d.rough, metalness: 0, transparent: true, opacity: d.opacity, depthWrite: false,
        ior: 1.5, specularIntensity: 1, side: THREE.FrontSide, envMapIntensity: 0.9 });
      if (d.emissive) m.emissive = new THREE.Color(d.emissive);
    } else {
      m = new THREE.MeshStandardMaterial({ color: d.color, roughness: d.rough, metalness: d.metal || 0 });
      if (d.emissive) { m.emissive = new THREE.Color(d.emissive); m.emissiveIntensity = d.emissiveI || 1; }
      if (d.tex && hasAsset(`tex/${d.tex}_col.webp`)) {
        try {
          m.map = await texture(`tex/${d.tex}_col.webp`, { aniso: this.r.q.aniso });
          m.normalMap = await texture(`tex/${d.tex}_nrm.webp`, { srgb: false, aniso: this.r.q.aniso });
          m.normalScale = new THREE.Vector2(0.9, 0.9);
          const arm = await texture(`tex/${d.tex}_arm.webp`, { srgb: false, aniso: this.r.q.aniso });
          m.roughnessMap = arm; m.aoMap = arm; m.aoMapIntensity = 0.6;
          if (d.metal) m.metalnessMap = arm;
          m.roughness = 1;
        } catch (e) { /* plain colour fallback */ }
      }
      if (d.brushed) { m.map = brushedTex(); m.roughnessMap = m.map; }
      // recolour a photo texture (e.g. make beige tiles light grey vinyl)
      if (d.desat !== undefined && m.map) {
        const ds = d.desat, br = d.bright || 1;
        m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114))), diffuseColor.rgb, ${ds.toFixed(3)}) * ${br.toFixed(3)};`); };
        m.customProgramCacheKey = () => 'recol' + ds + '_' + br;
      }
    }
    m.userData.texSize = d.size || 1;
    m.name = key;
    this.cache[key] = m;
    return m;
  }
  size(key) { return (MAT_DEFS[key] && MAT_DEFS[key].size) || 1; }
}

let _brushed = null;
function brushedTex() {
  if (_brushed) return _brushed;
  const W = 256, cv = document.createElement('canvas'); cv.width = cv.height = W; const g = cv.getContext('2d');
  g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, W, W);
  for (let i = 0; i < 1400; i++) { const y = Math.random() * W; g.fillStyle = `rgba(${Math.random() < 0.5 ? 255 : 90},${Math.random() < 0.5 ? 255 : 90},${Math.random() < 0.5 ? 255 : 90},0.07)`; g.fillRect(0, y, W, 0.6 + Math.random()); }
  _brushed = new THREE.CanvasTexture(cv); _brushed.wrapS = _brushed.wrapT = THREE.RepeatWrapping; _brushed.colorSpace = THREE.SRGBColorSpace;
  return _brushed;
}

// ------------------------------------------------------------------ batch
// size classes for collision: what size of spider still walks ON this stuff
export const SOLID = { STRUCT: 1e9, FURN: 8, PROP: 0.4, SMALL: 0.06, NONE: 0 };

const _mat = new THREE.Matrix4(), _pos = new THREE.Vector3(), _q = new THREE.Quaternion(), _sc = new THREE.Vector3();
export class Batch {
  constructor(mats) { this.mats = mats; this.parts = {}; this.solids = { STRUCT: [], FURN: [], PROP: [], SMALL: [] }; this.extra = []; }
  // geo in local space; m = Matrix4 or {p:[x,y,z], r:[x,y,z], s:[x,y,z]}; solid = SOLID class name or null
  add(geo, matKey, m, solid = 'PROP') {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    const M = m instanceof THREE.Matrix4 ? m : toM(m);
    g.applyMatrix4(M);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    (this.parts[matKey] || (this.parts[matKey] = [])).push(g);
    if (solid && this.solids[solid]) this.solids[solid].push(g);
    return g;
  }
  box(w, h, d, matKey, x, y, z, solid = 'FURN', rot = 0, round = 0) {
    const geo = round > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(round, w / 2.1, h / 2.1, d / 2.1)) : new THREE.BoxGeometry(w, h, d);
    return this.add(geo, matKey, { p: [x, y, z], r: [0, rot, 0] }, solid);
  }
  cyl(rt, rb, h, matKey, x, y, z, solid = 'PROP', seg = 16, rot = null) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), matKey, { p: [x, y, z], r: rot || [0, 0, 0] }, solid);
  }
  // build merged meshes; world-scale UVs for textured materials
  async build(parent, { shadows = true } = {}) {
    const meshes = [];
    for (const [key, list] of Object.entries(this.parts)) {
      const mat = await this.mats.get(key);
      const geo = mergeGeometries(list);
      if (mat.map || mat.normalMap) boxUV(geo, mat.userData.texSize || 1);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = shadows && !mat.transparent; mesh.receiveShadow = true;
      mesh.name = key;
      if (mat.transparent) mesh.renderOrder = 2;
      parent.add(mesh); meshes.push(mesh);
    }
    return meshes;
  }
  solidGeo(cls) {
    const list = this.solids[cls]; if (!list.length) return null;
    const parts = list.map(g => { const p = new THREE.BufferGeometry(); p.setAttribute('position', g.attributes.position); return p; });
    return mergeGeometries(parts);
  }
}
function toM(o) {
  _pos.set(...(o.p || [0, 0, 0]));
  _q.setFromEuler(new THREE.Euler(...(o.r || [0, 0, 0]), 'YXZ'));
  _sc.set(...(o.s || [1, 1, 1]));
  return new THREE.Matrix4().compose(_pos, _q, _sc);
}
// planar box mapping from world positions (so textures are real size on every face)
export function boxUV(geo, size) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv.setXY(i, u / size, v / size);
  }
  uv.needsUpdate = true;
}

// ------------------------------------------------------------------ furniture + props (all real dimensions, metres)
// each takes (B = batch, x, y, z, rot) where y = floor height under it
export const Kit = {
  // office/lab desk 1.6 x 0.8 x 0.74 with drawers and legs
  desk(B, x, y, z, rot = 0, top = 'laminate', w = 1.6, d = 0.8) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    B.box(w, 0.03, d, top, x, y + 0.725, z, 'FURN', rot, 0.008);
    for (const [lx, lz] of [[-w / 2 + 0.05, -d / 2 + 0.05], [w / 2 - 0.05, -d / 2 + 0.05], [-w / 2 + 0.05, d / 2 - 0.05], [w / 2 - 0.05, d / 2 - 0.05]]) {
      const [px, pz] = P(lx, lz); B.box(0.045, 0.71, 0.045, 'alu', px, y + 0.355, pz, 'PROP', rot, 0.004);
    }
    // drawer pedestal
    const [dx, dz] = P(w / 2 - 0.26, 0.0);
    B.box(0.42, 0.6, d - 0.12, 'greyPlastic', dx, y + 0.3, dz, 'FURN', rot, 0.01);
    for (let i = 0; i < 3; i++) { const [hx, hz] = P(w / 2 - 0.26, d / 2 - 0.055); B.box(0.12, 0.012, 0.012, 'alu', hx, y + 0.12 + i * 0.19, hz, 'SMALL', rot, 0.003); }
    // modesty panel
    const [mx, mz] = P(0, -d / 2 + 0.03); B.box(w - 0.1, 0.4, 0.02, 'greyPlastic', mx, y + 0.5, mz, 'FURN', rot);
  },
  labBench(B, x, y, z, rot = 0, w = 2.4, d = 0.9) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    B.box(w, 0.035, d, 'epoxy', x, y + 0.92, z, 'FURN', rot, 0.006);
    B.box(w - 0.04, 0.84, d - 0.06, 'whitePlastic', x, y + 0.45, z, 'FURN', rot, 0.012);
    // cabinet doors + handles
    for (let i = 0; i < Math.floor(w / 0.6); i++) {
      const lx = -w / 2 + 0.3 + i * 0.6;
      const [hx, hz] = P(lx + 0.2, d / 2 - 0.02); B.box(0.012, 0.14, 0.02, 'steel', hx, y + 0.7, hz, 'SMALL', rot, 0.004);
      const [gx, gz] = P(lx + 0.29, d / 2 - 0.028); B.box(0.006, 0.78, 0.004, 'greyPlastic', gx, y + 0.45, gz, null, rot);
    }
    const [kx, kz] = P(0, d / 2 - 0.08); B.box(w - 0.04, 0.08, 0.12, 'black', kx, y + 0.04, kz, 'PROP', rot); // toe kick
    // shelf above with uprights
    for (const lx of [-w / 2 + 0.06, w / 2 - 0.06]) { const [ux, uz] = P(lx, -d / 2 + 0.06); B.box(0.04, 0.9, 0.04, 'steel', ux, y + 1.38, uz, 'PROP', rot); }
    const [sx, sz] = P(0, -d / 2 + 0.15); B.box(w, 0.025, 0.28, 'steel', sx, y + 1.5, sz, 'FURN', rot, 0.005);
  },
  officeChair(B, x, y, z, rot = 0, fab = 'fabric') {
    // 5-star base w/ casters, gas lift, seat, back
    for (let i = 0; i < 5; i++) {
      const a = rot + i * Math.PI * 2 / 5;
      const ex = x + Math.sin(a) * 0.3, ez = z + Math.cos(a) * 0.3;
      B.add(new THREE.BoxGeometry(0.04, 0.035, 0.3), 'blackPlastic', { p: [x + Math.sin(a) * 0.15, y + 0.09, z + Math.cos(a) * 0.15], r: [0, a, 0] }, 'PROP');
      B.add(new THREE.SphereGeometry(0.03, 10, 8), 'blackPlastic', { p: [ex, y + 0.03, ez] }, 'SMALL');
    }
    B.cyl(0.025, 0.025, 0.32, 'chrome', x, y + 0.26, z, 'PROP', 12);
    B.cyl(0.04, 0.04, 0.12, 'blackPlastic', x, y + 0.14, z, 'PROP', 12);
    B.box(0.5, 0.08, 0.48, fab, x, y + 0.47, z, 'FURN', rot, 0.035);
    const bx = x - Math.sin(rot) * 0.22, bz = z - Math.cos(rot) * 0.22;
    B.add(new RoundedBoxGeometry(0.46, 0.55, 0.06, 2, 0.025), fab, { p: [bx, y + 0.82, bz], r: [-0.12, rot, 0] }, 'FURN');
    for (const sd of [-1, 1]) { // armrests
      const ax = x + Math.cos(rot) * 0.26 * sd, az = z - Math.sin(rot) * 0.26 * sd;
      B.box(0.05, 0.03, 0.26, 'blackPlastic', ax, y + 0.66, az, 'PROP', rot, 0.01);
      B.box(0.03, 0.18, 0.03, 'blackPlastic', ax, y + 0.56, az, 'SMALL', rot);
    }
  },
  monitor(B, x, y, z, rot = 0, scr = 'screen', w = 0.6) {
    const h = w * 0.58;
    B.box(w, h, 0.03, 'blackPlastic', x, y + 0.18 + h / 2, z, 'PROP', rot, 0.006);
    const fx = x + Math.sin(rot) * 0.0155, fz = z + Math.cos(rot) * 0.0155;
    B.box(w - 0.02, h - 0.02, 0.002, scr, fx, y + 0.18 + h / 2, fz, null, rot);
    B.box(0.05, 0.16, 0.05, 'blackPlastic', x - Math.sin(rot) * 0.05, y + 0.1, z - Math.cos(rot) * 0.05, 'SMALL', rot);
    B.box(0.24, 0.015, 0.18, 'blackPlastic', x - Math.sin(rot) * 0.05, y + 0.008, z - Math.cos(rot) * 0.05, 'SMALL', rot, 0.005);
  },
  keyboard(B, x, y, z, rot = 0) {
    const c = Math.cos(rot), s = Math.sin(rot);
    B.box(0.44, 0.018, 0.14, 'darkPlastic', x, y + 0.009, z, 'SMALL', rot, 0.004);
    // keys: 5 rows (real keyboards are what a 4 mm spider walks across)
    const keyG = new RoundedBoxGeometry(0.016, 0.008, 0.016, 1, 0.0025);
    for (let r = 0; r < 5; r++) for (let k = 0; k < 15; k++) {
      const lx = -0.2 + k * 0.0187 + (r % 2) * 0.004, lz = -0.05 + r * 0.0195;
      const wk = r === 4 && k > 4 && k < 10 ? 0 : 1;
      if (!wk && k !== 7) continue;
      const g = r === 4 && k === 7 ? new RoundedBoxGeometry(0.1, 0.008, 0.016, 1, 0.0025) : keyG;
      B.add(g, 'blackPlastic', { p: [x + lx * c + lz * s, y + 0.021, z - lx * s + lz * c], r: [0, rot, 0] }, 'SMALL');
    }
  },
  mouse(B, x, y, z, rot = 0) { B.add(new THREE.SphereGeometry(0.03, 12, 8).scale(1, 0.4, 1.6), 'darkPlastic', { p: [x, y + 0.012, z], r: [0, rot, 0] }, 'SMALL'); },
  mug(B, x, y, z, col = 'whitePlastic') {
    B.add(new THREE.CylinderGeometry(0.04, 0.036, 0.095, 18, 1, true), col, { p: [x, y + 0.0475, z] }, 'SMALL');
    B.add(new THREE.CylinderGeometry(0.036, 0.036, 0.004, 18), col, { p: [x, y + 0.002, z] }, 'SMALL');
    B.add(new THREE.TorusGeometry(0.025, 0.007, 8, 14, Math.PI), col, { p: [x + 0.04, y + 0.05, z], r: [0, 0, -Math.PI / 2] }, 'SMALL');
    B.add(new THREE.CylinderGeometry(0.037, 0.037, 0.002, 18), 'soil', { p: [x, y + 0.08, z] }, null); // coffee
  },
  paperStack(B, x, y, z, rot = 0, n = 6) {
    for (let i = 0; i < n; i++) B.box(0.21, 0.0015, 0.297, 'paper', x + (Math.random() - 0.5) * 0.01, y + 0.001 + i * 0.0016, z + (Math.random() - 0.5) * 0.01, i === n - 1 ? 'SMALL' : null, rot + (Math.random() - 0.5) * 0.08);
  },
  pen(B, x, y, z, rot = 0) { B.add(new THREE.CylinderGeometry(0.0045, 0.0045, 0.14, 8), Math.random() < 0.5 ? 'paintBlue' : 'black', { p: [x, y + 0.0045, z], r: [Math.PI / 2, rot, 0] }, 'SMALL'); },
  trash(B, x, y, z) {
    B.add(new THREE.CylinderGeometry(0.15, 0.12, 0.36, 20, 1, true), 'darkPlastic', { p: [x, y + 0.18, z] }, 'PROP');
    B.cyl(0.12, 0.12, 0.01, 'darkPlastic', x, y + 0.005, z, 'PROP', 20);
  },
  plant(B, x, y, z, h = 1.1) {
    B.add(new THREE.CylinderGeometry(0.16, 0.12, 0.3, 18), 'darkPlastic', { p: [x, y + 0.15, z] }, 'FURN');
    B.cyl(0.15, 0.15, 0.02, 'soil', x, y + 0.29, z, 'PROP', 18);
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4, r = 0.05 + Math.random() * 0.12, hh = 0.3 + Math.random() * (h - 0.3);
      B.add(new THREE.ConeGeometry(0.06, 0.32, 5).scale(1, 1, 0.2), 'plant', { p: [x + Math.sin(a) * r, y + hh, z + Math.cos(a) * r], r: [Math.random() - 0.5, a, (Math.random() - 0.5) * 0.8] }, 'SMALL');
      B.cyl(0.006, 0.008, hh, 'plant', x + Math.sin(a) * r * 0.5, y + hh / 2, z + Math.cos(a) * r * 0.5, null, 5);
    }
  },
  shelf(B, x, y, z, rot = 0, w = 1.2, h = 2, d = 0.4, levels = 5, mat = 'steel') {
    const c = Math.cos(rot), s = Math.sin(rot);
    for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) B.box(0.03, h, 0.03, mat, x + lx * c + lz * s, y + h / 2, z - lx * s + lz * c, 'PROP', rot);
    for (let i = 0; i < levels; i++) B.box(w, 0.02, d, mat, x, y + 0.1 + i * (h - 0.15) / (levels - 1), z, 'FURN', rot);
  },
  jar(B, x, y, z, r = 0.07, h = 0.22, fill = 'formalin', inner = null) {
    B.add(new THREE.CylinderGeometry(r, r, h, 20, 1, true), 'glass', { p: [x, y + h / 2, z] }, 'SMALL');
    B.cyl(r * 0.95, r * 0.95, h * 0.82, fill, x, y + h * 0.42, z, null, 20);
    B.cyl(r * 1.05, r * 1.05, 0.025, 'blackPlastic', x, y + h + 0.012, z, 'SMALL', 20);
    if (inner) inner(x, y + h * 0.4, z);
  },
  beaker(B, x, y, z, r = 0.035, h = 0.1, fill = 'liquidBlue') {
    B.add(new THREE.CylinderGeometry(r, r, h, 16, 1, true), 'glass', { p: [x, y + h / 2, z] }, 'SMALL');
    B.cyl(r * 0.94, r * 0.94, h * 0.5, fill, x, y + h * 0.25, z, null, 16);
  },
  flask(B, x, y, z, s = 1, fill = 'liquidGreen') {
    const pts = [[0, 0], [0.06, 0], [0.065, 0.01], [0.055, 0.06], [0.02, 0.13], [0.015, 0.2], [0.017, 0.205]].map(([a, b]) => new THREE.Vector2(a * s, b * s));
    B.add(new THREE.LatheGeometry(pts, 18), 'glass', { p: [x, y, z] }, 'SMALL');
    const fp = [[0, 0.004], [0.057, 0.004], [0.05, 0.05], [0.04, 0.075], [0, 0.075]].map(([a, b]) => new THREE.Vector2(a * s, b * s));
    B.add(new THREE.LatheGeometry(fp, 16), fill, { p: [x, y, z] }, null);
  },
  microscope(B, x, y, z, rot = 0) {
    B.box(0.2, 0.03, 0.26, 'whitePlastic', x, y + 0.015, z, 'PROP', rot, 0.01);
    const bx = x - Math.sin(rot) * 0.08, bz = z - Math.cos(rot) * 0.08;
    B.add(new RoundedBoxGeometry(0.06, 0.28, 0.08, 2, 0.015), 'whitePlastic', { p: [bx, y + 0.17, bz], r: [0.15, rot, 0] }, 'PROP');
    B.box(0.14, 0.012, 0.14, 'black', x, y + 0.12, z, 'SMALL', rot);
    B.add(new THREE.CylinderGeometry(0.018, 0.022, 0.14, 14), 'black', { p: [x - Math.sin(rot) * 0.03, y + 0.28, z - Math.cos(rot) * 0.03], r: [-0.5, rot, 0] }, 'SMALL');
    for (const sd of [-1, 1]) B.add(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 12), 'black', { p: [bx + Math.cos(rot) * 0.025 * sd, y + 0.36, bz - Math.sin(rot) * 0.025 * sd], r: [-0.7, rot, 0] }, 'SMALL');
    B.add(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 14), 'steel', { p: [x, y + 0.2, z], r: [0, 0, 0] }, 'SMALL');
  },
  centrifuge(B, x, y, z, rot = 0) {
    B.add(new RoundedBoxGeometry(0.42, 0.3, 0.5, 3, 0.04), 'whitePlastic', { p: [x, y + 0.15, z], r: [0, rot, 0] }, 'PROP');
    B.add(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 24), 'greyPlastic', { p: [x, y + 0.305, z - Math.cos(rot) * 0.02] }, 'SMALL');
    B.box(0.12, 0.05, 0.005, 'screenGreen', x + Math.sin(rot) * 0.251, y + 0.2, z + Math.cos(rot) * 0.251, null, rot);
  },
  fridge(B, x, y, z, rot = 0, glass = true) {
    B.add(new RoundedBoxGeometry(0.7, 1.9, 0.72, 2, 0.02), 'whitePlastic', { p: [x, y + 0.95, z], r: [0, rot, 0] }, 'FURN');
    if (glass) {
      const fx = x + Math.sin(rot) * 0.362, fz = z + Math.cos(rot) * 0.362;
      B.box(0.6, 1.6, 0.006, 'glassDark', fx, y + 1.0, fz, null, rot);
      for (let i = 0; i < 4; i++) B.box(0.58, 0.01, 0.55, 'whitePlastic', x, y + 0.4 + i * 0.38, z, null, rot);
    }
    B.box(0.02, 0.4, 0.03, 'steel', x + Math.cos(rot) * 0.28 + Math.sin(rot) * 0.38, y + 1.1, z - Math.sin(rot) * 0.28 + Math.cos(rot) * 0.38, 'SMALL', rot);
  },
  serverRack(B, x, y, z, rot = 0) {
    B.box(0.6, 2.0, 1.0, 'black', x, y + 1.0, z, 'FURN', rot, 0.01);
    const fx = Math.sin(rot) * 0.502, fz = Math.cos(rot) * 0.502;
    for (let u = 0; u < 18; u++) {
      B.box(0.52, 0.075, 0.004, 'darkPlastic', x + fx, y + 0.15 + u * 0.095, z + fz, null, rot);
      for (let l = 0; l < 3; l++) B.box(0.008, 0.008, 0.004, Math.random() < 0.8 ? 'ledGreen' : (Math.random() < 0.5 ? 'ledBlue' : 'ledRed'), x + fx * 1.004 + Math.cos(rot) * (0.2 - l * 0.02), y + 0.17 + u * 0.095, z + fz * 1.004 - Math.sin(rot) * (0.2 - l * 0.02), null, rot);
    }
  },
  cage(B, x, y, z, w = 0.48, h = 0.22, d = 0.3) {
    B.box(w, 0.06, d, 'whitePlastic', x, y + 0.03, z, 'PROP', 0, 0.01);
    B.add(new THREE.BoxGeometry(w, h - 0.06, d), 'glass', { p: [x, y + 0.06 + (h - 0.06) / 2, z] }, null);
    for (let i = 0; i <= 12; i++) B.box(0.003, 0.003, d, 'steel', x - w / 2 + i * w / 12, y + h, z, 'SMALL');
    B.box(0.05, 0.08, 0.05, 'liquidBlue', x + w / 2 - 0.05, y + h - 0.02, z - d / 2 + 0.05, null); // water bottle
  },
  vent(B, x, y, z, w = 0.6, d = 0.6) { // ceiling diffuser with slots (a tiny spider walks between the slats)
    B.box(w, 0.012, d, 'paint', x, y - 0.006, z, 'STRUCT');
    for (let i = 1; i < 8; i++) B.box(w - 0.06, 0.03, 0.006, 'paint', x, y - 0.025, z - d / 2 + i * d / 8, 'SMALL');
  },
  troffer(B, x, y, z, w = 1.2, d = 0.6, on = true) {
    B.box(w, 0.04, d, 'paint', x, y - 0.02, z, 'STRUCT');
    B.box(w - 0.06, 0.012, d - 0.06, on ? 'lightPanel' : 'whitePlastic', x, y - 0.042, z, null);
  },
  exitSign(B, x, y, z, rot = 0) { B.box(0.32, 0.16, 0.04, 'exitSign', x, y, z, null, rot); },
  wallClock(B, x, y, z, rot = 0) {
    B.add(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 28), 'whitePlastic', { p: [x, y, z], r: [Math.PI / 2, rot, 0] }, 'SMALL');
    B.add(new THREE.TorusGeometry(0.16, 0.012, 8, 28), 'black', { p: [x, y, z], r: [0, rot, 0] }, null);
  },
  fireExt(B, x, y, z) {
    B.cyl(0.075, 0.075, 0.45, 'paintRed', x, y + 0.4, z, 'PROP', 16);
    B.add(new THREE.SphereGeometry(0.075, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 'paintRed', { p: [x, y + 0.625, z] }, 'SMALL');
    B.box(0.03, 0.07, 0.1, 'black', x, y + 0.71, z, 'SMALL');
  },
  water(B, x, y, z) {
    B.add(new RoundedBoxGeometry(0.32, 1.0, 0.32, 2, 0.02), 'whitePlastic', { p: [x, y + 0.5, z] }, 'FURN');
    B.add(new THREE.CylinderGeometry(0.13, 0.13, 0.42, 20), 'liquidBlue', { p: [x, y + 1.21, z] }, 'PROP');
  },
  vending(B, x, y, z, rot = 0) {
    B.box(0.9, 1.85, 0.8, 'paintRed', x, y + 0.925, z, 'FURN', rot, 0.02);
    const fx = x + Math.sin(rot) * 0.402, fz = z + Math.cos(rot) * 0.402;
    B.box(0.6, 1.3, 0.01, 'glassDark', fx, y + 1.1, fz, null, rot);
    for (let r = 0; r < 6; r++) for (let k = 0; k < 6; k++) B.box(0.07, 0.12, 0.06, ['paintRed', 'paintBlue', 'paintYellow', 'paintGreen'][(r + k) % 4], fx - Math.sin(rot) * 0.15 + Math.cos(rot) * (-0.22 + k * 0.09), y + 0.6 + r * 0.2, fz - Math.cos(rot) * 0.15 - Math.sin(rot) * (-0.22 + k * 0.09), null, rot);
    B.box(0.88, 0.04, 0.02, 'lightWarm', x, y + 1.82, fz, null, rot);
  },
};
