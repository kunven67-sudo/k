// THE GERM WORLD. When you shrink below ~0.45 mm the spot you're standing on becomes its own
// world, built from what that surface REALLY looks like under a microscope:
//   carpet  -> a jungle of fibre tufts 8 mm tall, dust mites, skin flakes, hairs, sand grains
//   bedding -> woven threads like giant ropes, LOTS of dust mites (realistic: beds have millions)
//   plastic -> rolling hills + scratches, skin-oil puddles, bacteria colonies, crumbs
//   glass   -> almost perfectly flat, fingerprint ridges, bacteria + viruses (phones are filthy)
//   metal   -> brushed grooves, dust;  circuit boards -> copper traces as walls, solder hills
//   wood, paint, paper, food...  soda -> the liquid surface with giant CO2 bubbles
// 1 unit here = 0.1 mm. Germs only appear on dirty things (things get dirty when touched and
// get clean when you wipe them). Dust mites and bacteria have no eyes - they ignore you.
import * as THREE from 'three';
import { R } from '../core/physics.js';
import { fbm, vnoise, rng } from '../core/noise.js';

export const MU = 1e4;            // micro units per meter
export const ENTER_H = 0.00045;   // shrink below this (meters) -> germ world
export const EXIT_H = 0.0006;     // grow above this -> back to the room
export const MICRO_MIN_H = 0.0000015; // 1.5 µm: as small as a bacterium

// what each macro material becomes
const KIND = {
  carpet: 'carpet', rug: 'carpet', sheet: 'fabric', blanket: 'fabric', pillow: 'fabric', mattress: 'fabric', chairFabric: 'fabric', fabric: 'fabric',
  deskWood: 'wood', lightWood: 'wood', planks: 'wood', floorWood: 'wood', wood: 'wood',
  wall: 'paint', ceiling: 'paint', trim: 'paint', doorWood: 'paint', paint: 'paint',
  pcb: 'pcb', glass: 'glass', windowGlass: 'glass', phoneGlass: 'glass', screenOff: 'glass', phoneBack: 'glass', lens: 'glass',
  alu: 'metal', darkAlu: 'metal', steel: 'metal', chrome: 'metal', copper: 'metal', canInside: 'metal', canLid: 'metal', fizzLabelMat: 'metal', metal: 'metal', copperCoil: 'metal', solder: 'metal', phoneFrame: 'metal',
  cardboard: 'paper', paper: 'paper', food: 'food', cookie: 'food', appleSkin: 'food', pumpkin: 'food',
};
export function microKind(collider, thing) {
  if (collider && collider.isSkin) return 'liquid';
  const p = collider && collider.part;
  const name = p && (typeof p.mat === 'string' ? p.mat : p.mat && p.mat.name);
  if (name && KIND[name]) return KIND[name];
  if (thing && KIND[thing.material]) return KIND[thing.material];
  return 'plastic';
}

const LOOK = {
  carpet: { ground: 0x4c535c, fog: 0x272a2f, amp: 0.4 },
  fabric: { ground: 0x34507c, fog: 0x1d2633, amp: 0.2 },
  plastic: { ground: 0x1d1e22, fog: 0x101114, amp: 0.03 },
  glass: { ground: 0x0b0d10, fog: 0x0c0f13, amp: 0.002 },
  metal: { ground: 0x9aa0a8, fog: 0x2a2d31, amp: 0.012 },
  pcb: { ground: 0x1d5a33, fog: 0x0e1f15, amp: 0.02 },
  wood: { ground: 0x3d2b1f, fog: 0x1c140e, amp: 0.03 },
  paint: { ground: 0xd8d2c4, fog: 0x5a574f, amp: 0.08 },
  paper: { ground: 0xb08a5a, fog: 0x3a2e20, amp: 0.25 },
  food: { ground: 0xc58b4a, fog: 0x3a2a18, amp: 0.3 },
  liquid: { ground: 0x3a1608, fog: 0x1a0904, amp: 0 },
};

// ground height (units) at x,z for each surface kind - continuous at every zoom level
function heightFn(kind, seed) {
  switch (kind) {
    case 'plastic': return (x, z) => fbm(x * 0.6, z * 0.6, 4, 4096, seed) * 0.03 + fbm(x * 12, z * 12, 3, 4096, seed + 3) * 0.004 + fbm(x * 180, z * 180, 2, 65536, seed + 5) * 0.0004 - scratch(x, z, seed) * 0.012;
    case 'glass': return (x, z) => fbm(x * 2, z * 2, 2, 4096, seed) * 0.0015 + fingerprint(x, z) * 0.008 + fbm(x * 300, z * 300, 2, 65536, seed) * 0.00005;
    case 'metal': return (x, z) => (Math.sin(z * 90 + fbm(x * 3, z * 3, 2, 4096, seed) * 6) * 0.5 + 0.5) * 0.008 + fbm(x * 40, z * 2, 3, 4096, seed + 1) * 0.004 + fbm(x * 400, z * 400, 2, 65536, seed) * 0.0003;
    case 'pcb': return (x, z) => pcbTrace(x, z, seed) * 0.35 + fbm(x * 5, z * 5, 3, 4096, seed) * 0.01 + fbm(x * 120, z * 120, 2, 65536, seed) * 0.0008;
    case 'wood': return (x, z) => fbm(x * 0.3, z * 3, 4, 4096, seed) * 0.03 - pores(x, z, seed) * 0.08 + fbm(x * 150, z * 150, 2, 65536, seed) * 0.0005;
    case 'paint': return (x, z) => fbm(x * 0.8, z * 0.8, 5, 4096, seed) * 0.12 + fbm(x * 30, z * 30, 3, 65536, seed + 2) * 0.006;
    case 'paper': return (x, z) => fibrous(x, z, seed) * 0.3 + fbm(x * 40, z * 40, 2, 65536, seed) * 0.004;
    case 'food': return (x, z) => fbm(x * 0.5, z * 0.5, 5, 4096, seed) * 0.6 + Math.abs(fbm(x * 4, z * 4, 3, 4096, seed + 9) - 0.5) * 0.12 + fbm(x * 80, z * 80, 2, 65536, seed) * 0.002;
    case 'fabric': return (x, z) => fbm(x * 2, z * 2, 3, 4096, seed) * 0.05 - 3.2;
    case 'carpet': return (x, z) => fbm(x * 0.4, z * 0.4, 4, 4096, seed) * 0.6 - 80;
    case 'liquid': return () => -60;
    default: return () => 0;
  }
}
function scratch(x, z, seed) { let v = 0; for (let i = 0; i < 3; i++) { const a = (seed * 0.37 + i * 1.9) % 6.28, d = Math.abs((x * Math.sin(a) - z * Math.cos(a) + i * 7.3) % 9 - 4.5); v = Math.max(v, Math.max(0, 1 - d / 0.03)); } return v; }
function fingerprint(x, z) { const r = Math.hypot(x - 3, (z + 2) * 1.3); return Math.pow(Math.max(0, Math.sin(r * 12)), 6) * Math.max(0, 1 - r / 40); }
function pcbTrace(x, z, seed) {
  const gx = Math.floor(x / 6), gz = Math.floor(z / 6), h = vnoise(gx * 3.1, gz * 2.7, 4096, seed);
  const lx = x - gx * 6, lz = z - gz * 6;
  const w = 0.6 + h * 1.2;
  const horiz = h > 0.5 ? Math.abs(lz - 3) < w / 2 : Math.abs(lx - 3) < w / 2;
  return horiz ? 1 : 0;
}
function pores(x, z, seed) { const c = vnoise(Math.floor(x / 1.5) * 1.7, Math.floor(z / 0.6) * 2.3, 4096, seed); if (c < 0.8) return 0; const dx = (x % 1.5 + 1.5) % 1.5 - 0.75, dz = (z % 0.6 + 0.6) % 0.6 - 0.3; return Math.max(0, 1 - Math.hypot(dx / 0.4, dz / 0.2)); }
function fibrous(x, z, seed) { let v = 0; for (let i = 0; i < 4; i++) { const a = i * 0.8 + seed; v += Math.pow(Math.abs(Math.sin((x * Math.cos(a) + z * Math.sin(a)) * (2 + i) + fbm(x, z, 2, 4096, seed + i) * 4)), 8); } return v / 4; }

// ---------------- adaptive terrain: rebuilt around you as you shrink / walk ----------------
class Terrain {
  constructor(mw, kind, look, seed) {
    this.mw = mw; this.kind = kind; this.h = heightFn(kind, seed); this.mesh = null; this.collider = null; this.center = null; this.cell = 0;
    this.mat = new THREE.MeshStandardMaterial({ color: look.ground, roughness: kind === 'glass' ? 0.08 : kind === 'metal' ? 0.35 : 0.8, metalness: kind === 'metal' ? 0.8 : 0, vertexColors: true });
  }
  needs(px, pz, ph) {
    if (!this.center) return true;
    const cell = ph * 0.6;
    if (cell / this.cell > 2 || cell / this.cell < 0.5) return true;
    return Math.hypot(px - this.center.x, pz - this.center.z) > this.size * 0.2;
  }
  rebuild(px, pz, ph) {
    const N = 96, cell = Math.max(ph * 0.6, 0.0002), size = cell * N;
    this.cell = cell; this.size = size;
    // snap the grid to the cell size so it doesn't "swim" when rebuilt
    const cx = Math.round(px / cell) * cell, cz = Math.round(pz / cell) * cell;
    this.center = { x: cx, z: cz };
    const heights = new Float32Array((N + 1) * (N + 1));
    const geo = new THREE.PlaneGeometry(size, size, N, N); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    const base = new THREE.Color(this.mat.color);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + cx, z = pos.getZ(i) + cz, y = this.h(x, z);
      pos.setY(i, y); lo = Math.min(lo, y); hi = Math.max(hi, y);
      const ix = Math.round((pos.getX(i) + size / 2) / cell), iz = Math.round((pos.getZ(i) + size / 2) / cell);
      heights[ix * (N + 1) + iz] = y;
    }
    const span = Math.max(1e-6, hi - lo);
    for (let i = 0; i < pos.count; i++) { const t = (pos.getY(i) - lo) / span; col[i * 3] = 0.75 + t * 0.35; col[i * 3 + 1] = 0.75 + t * 0.35; col[i * 3 + 2] = 0.75 + t * 0.35; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.translate(cx, 0, cz);
    geo.computeVertexNormals();
    void base;
    if (this.mesh) { this.mw.scene.remove(this.mesh); this.mesh.geometry.dispose(); }
    this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.receiveShadow = true;
    this.mw.scene.add(this.mesh);
    if (this.collider) this.mw.world.removeCollider(this.collider, false);
    const d = R.ColliderDesc.heightfield(N, N, heights, { x: size, y: 1, z: size }).setTranslation(cx, 0, cz);
    this.collider = this.mw.world.createCollider(d, this.mw.fixed);
    this.collider.microKind = this.kind;
  }
}

// ---------------- creatures + debris ----------------
const mat = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...extra });

function makeMite() {
  // house dust mite: ~0.3 mm, 8 legs, no eyes, translucent cream body with bristles
  const g = new THREE.Group();
  const bodyM = new THREE.MeshPhysicalMaterial({ color: 0xe8dcc0, roughness: 0.45, transmission: 0.25, thickness: 1, sheen: 0.5, clearcoat: 0.3 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), bodyM); body.scale.set(1.0, 0.55, 1.45); body.position.y = 0.75; body.castShadow = true; g.add(body);
  for (let i = 0; i < 4; i++) { const ridge = new THREE.Mesh(new THREE.TorusGeometry(0.75 - Math.abs(i - 1.5) * 0.12, 0.03, 6, 24, Math.PI), bodyM); ridge.rotation.set(0, Math.PI / 2, 0); ridge.position.set(0, 1.0, -0.6 + i * 0.4); g.add(ridge); }
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 12), bodyM); head.rotation.x = Math.PI / 2; head.position.set(0, 0.65, 1.55); g.add(head);
  const legM = mat(0xd9c49a, { roughness: 0.5 });
  const legs = [];
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1, k = i % 4;
    const hip = new THREE.Group(); hip.position.set(side * 0.8, 0.6, 1.0 - k * 0.55);
    const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.7, 8).translate(0, -0.35, 0), legM); seg1.rotation.z = side * 1.0; hip.add(seg1);
    const knee = new THREE.Group(); knee.position.set(side * 0.59, -0.38, 0); hip.add(knee);
    const seg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.7, 8).translate(0, -0.35, 0), legM); seg2.rotation.z = -side * 0.35; knee.add(seg2);
    const bristle = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, 0.5, 4).translate(0, 0.25, 0), legM); bristle.position.set(side * 0.1, -0.2, 0); bristle.rotation.z = side * 0.8; knee.add(bristle);
    g.add(hip); legs.push({ hip, phase: (k % 2 === 0 ? 0 : Math.PI) + (side > 0 ? Math.PI : 0) });
  }
  for (let i = 0; i < 10; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.02, 0.9, 4).translate(0, 0.45, 0), legM); b.position.set((Math.random() - 0.5) * 1.2, 1.1, -1.2 + Math.random() * 0.5); b.rotation.set(-0.8 - Math.random() * 0.5, 0, (Math.random() - 0.5) * 0.8); g.add(b); }
  g.userData.legs = legs;
  return g;
}

function bacteriaMeshes(kind) {
  const rod = new THREE.CapsuleGeometry(0.25, 1, 4, 10); rod.rotateZ(Math.PI / 2); // 2 µm x 0.5 µm (scaled later)
  const coc = new THREE.SphereGeometry(0.5, 12, 8);
  const virus = new THREE.IcosahedronGeometry(0.5, 1);
  const m1 = new THREE.MeshPhysicalMaterial({ color: kind === 'glass' ? 0x9ec7a8 : 0xc9b98f, roughness: 0.35, transmission: 0.3, thickness: 0.5, clearcoat: 0.5 });
  const m2 = new THREE.MeshPhysicalMaterial({ color: 0xe0c76a, roughness: 0.3, transmission: 0.2, thickness: 0.5, clearcoat: 0.6 });
  const m3 = new THREE.MeshStandardMaterial({ color: 0xa86b8f, roughness: 0.5 });
  return { rod: [rod, m1], coccus: [coc, m2], virus: [virus, m3] };
}

// ---------------- the micro world ----------------
export class MicroWorld {
  constructor(game, anchor) {
    this.game = game;
    this.anchor = anchor;
    this.kind = anchor.kind;
    this.dirt = anchor.dirt;
    this.seed = Math.floor(Math.abs(anchor.point.x * 7919 + anchor.point.z * 104729) % 9973) + 1;
    this.R = rng(this.seed);
    const look = LOOK[this.kind] || LOOK.plastic;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(look.fog);
    this.scene.fog = new THREE.FogExp2(look.fog, 0.05);
    this.world = new R.World({ x: 0, y: 0, z: 0 });
    this.fixed = this.world.createRigidBody(R.RigidBodyDesc.fixed());
    // light: matches the room (dark inside things - use your watch light!)
    const bright = anchor.brightness;
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 0.35 + bright * 1.2);
    this.key = new THREE.DirectionalLight(0xfff2e0, bright * 2.2);
    this.key.castShadow = game.engine.q.shadows;
    this.key.shadow.mapSize.set(1024, 1024);
    this.scene.add(this.hemi, this.key, this.key.target);
    this.terrain = new Terrain(this, this.kind, look, this.seed);
    this.creatures = [];
    this.cells = new Map();
    this.time = 0;
    this.buildFeatures();
  }

  groundAt(x, z) {
    const ray = new R.Ray({ x, y: 200, z }, { x: 0, y: -1, z: 0 });
    const hit = this.world.castRay(ray, 400, true);
    return hit ? 200 - hit.timeOfImpact : this.terrain.h(x, z);
  }

  // big stuff placed once over the whole patch (fibres, threads, mites, flakes, hairs, grains)
  buildFeatures() {
    const k = this.kind, R0 = this.R, S = 70; // patch half-size in units (7 mm)
    const add = (desc) => this.world.createCollider(desc, this.fixed);
    const dirt = this.dirt;
    if (k === 'carpet') {
      // fibre tufts: twisted bundles 8 mm tall, ~3 mm apart (a cut-pile carpet)
      const fiberGeo = new THREE.CylinderGeometry(0.11, 0.13, 1, 10, 8); fiberGeo.translate(0, 0.5, 0);
      // nylon fibres: slightly shiny, with fine lengthwise striations
      const stri = document.createElement('canvas'); stri.width = 64; stri.height = 8; const sc = stri.getContext('2d');
      for (let x = 0; x < 64; x++) { const v = 128 + Math.sin(x * 0.9) * 40 + (Math.random() - 0.5) * 30; sc.fillStyle = `rgb(${v},${v},${v})`; sc.fillRect(x, 0, 1, 8); }
      const st = new THREE.CanvasTexture(stri); st.wrapS = st.wrapT = THREE.RepeatWrapping;
      const fm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, bumpMap: st, bumpScale: 0.02 });
      const tufts = [], SC = 33;
      for (let x = -SC; x <= SC; x += 3) for (let z = -SC; z <= SC; z += 3) tufts.push([x + (R0() - 0.5) * 1.6, z + (R0() - 0.5) * 1.6]);
      const perTuft = 10, count = tufts.length * perTuft;
      const inst = new THREE.InstancedMesh(fiberGeo, fm, count);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      let i = 0;
      for (const [tx, tz] of tufts) {
        const lean = R0() * 0.25, dir = R0() * 6.28;
        for (let f = 0; f < perTuft; f++) {
          const a = f / perTuft * 6.28 + R0(), r = 0.25 + R0() * 0.3;
          const bx = tx + Math.cos(a) * r, bz = tz + Math.sin(a) * r, h = 76 + R0() * 6;
          e.set(Math.cos(dir) * lean + (R0() - 0.5) * 0.08, 0, Math.sin(dir) * lean + (R0() - 0.5) * 0.08);
          q.setFromEuler(e);
          m4.compose(new THREE.Vector3(bx, -80, bz), q, new THREE.Vector3(1, h, 1));
          inst.setMatrixAt(i, m4);
          const shade = 0.75 + R0() * 0.3; inst.setColorAt(i++, new THREE.Color(0x5d6570).multiplyScalar(shade));
          // collider: each fibre is a long thin capsule along its axis
          if (f % 2 === 0) {
            const top = new THREE.Vector3(0, h, 0).applyQuaternion(q);
            const mid = new THREE.Vector3(bx, -80, bz).addScaledVector(top, 0.5);
            add(R.ColliderDesc.capsule(h / 2, 0.14).setTranslation(mid.x, mid.y, mid.z).setRotation(q));
          }
        }
      }
      inst.castShadow = true; inst.receiveShadow = true;
      this.scene.add(inst);
    }
    if (k === 'fabric') {
      // woven threads (each ~0.3 mm thick, made of twisted fibres) going over and under
      const tm = new THREE.MeshStandardMaterial({ color: 0x3b5b8a, roughness: 0.95 });
      const P = 3.2, Rt = 1.0;
      for (let dir = 0; dir < 2; dir++) for (let j = -10; j <= 10; j++) {
        const pts = [];
        for (let u = -32; u <= 32; u += 0.8) {
          const y = Math.sin((u / P) * Math.PI + (j % 2) * Math.PI) * 0.55 * (dir ? -1 : 1) - 1.0;
          pts.push(dir ? new THREE.Vector3(j * P, y, u) : new THREE.Vector3(u, y, j * P));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 2, Rt, 8, false), tm);
        tube.castShadow = tube.receiveShadow = true; this.scene.add(tube);
        for (let n = 0; n < pts.length - 1; n++) {
          const a = pts[n], b = pts[n + 1], mid = a.clone().add(b).multiplyScalar(0.5), len = a.distanceTo(b);
          const qq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
          add(R.ColliderDesc.capsule(len / 2, Rt).setTranslation(mid.x, mid.y, mid.z).setRotation(qq));
        }
      }
    }
    if (k === 'liquid') {
      // the soda surface: surface tension holds tiny-you up; CO2 bubbles come up from below
      const surf = new THREE.Mesh(new THREE.PlaneGeometry(400, 400, 1, 1).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x5a2410, roughness: 0.05, transmission: 0.3, thickness: 2, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
      this.scene.add(surf);
      this.skin = add(R.ColliderDesc.cuboid(200, 0.01, 200).setTranslation(0, -0.01, 0));
      this.skin.isSkin = true;
      this.bubbles = [];
      const bm = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0, transmission: 1, thickness: 0.2, ior: 1.0, transparent: true, opacity: 0.35 });
      for (let i = 0; i < 40; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), bm);
        b.userData.r = 0.5 + R0() * 4; b.scale.setScalar(b.userData.r);
        b.position.set((R0() - 0.5) * 80, -60 * R0(), (R0() - 0.5) * 80);
        this.scene.add(b); this.bubbles.push(b);
      }
    }
    // ---- debris on the ground (only on dirty / dusty surfaces) ----
    if (dirt > 0.05 && k !== 'liquid') {
      const flakeM = new THREE.MeshPhysicalMaterial({ color: 0xf0e2d0, roughness: 0.6, transmission: 0.4, thickness: 0.05, side: THREE.DoubleSide });
      const nFlakes = Math.round(30 * dirt * (k === 'fabric' || k === 'carpet' ? 3 : 1));
      for (let i = 0; i < nFlakes; i++) { // dead skin flakes: what dust mites eat
        const x = (R0() - 0.5) * 2 * S, z = (R0() - 0.5) * 2 * S, w = 1 + R0() * 4;
        const shape = new THREE.Shape(); for (let a = 0; a < 7; a++) { const rr = w * (0.6 + R0() * 0.4); const p = [Math.cos(a / 7 * 6.28) * rr, Math.sin(a / 7 * 6.28) * rr]; if (a) shape.lineTo(...p); else shape.moveTo(...p); }
        const geo = new THREE.ShapeGeometry(shape); geo.rotateX(-Math.PI / 2);
        const m = new THREE.Mesh(geo, flakeM); const y = this.surfaceY(x, z) + 0.03; m.position.set(x, y, z); m.rotation.set((R0() - 0.5) * 0.3, R0() * 6, (R0() - 0.5) * 0.3); this.scene.add(m);
        add(R.ColliderDesc.cylinder(0.03, w * 0.7).setTranslation(x, y, z));
      }
      const grainM = new THREE.MeshStandardMaterial({ color: 0xb9a888, roughness: 0.9, flatShading: true });
      for (let i = 0; i < Math.round(12 * dirt); i++) { // sand / grit grains like boulders
        const r = 0.6 + R0() * 2.5, x = (R0() - 0.5) * 2 * S, z = (R0() - 0.5) * 2 * S;
        const geo = new THREE.IcosahedronGeometry(r, 1); const p = geo.attributes.position;
        for (let j = 0; j < p.count; j++) { const f = 0.75 + R0() * 0.4; p.setXYZ(j, p.getX(j) * f, p.getY(j) * f, p.getZ(j) * f); }
        geo.computeVertexNormals();
        const y = this.surfaceY(x, z) + r * 0.5;
        const m = new THREE.Mesh(geo, grainM); m.position.set(x, y, z); m.castShadow = true; this.scene.add(m);
        add(R.ColliderDesc.convexHull(geo.attributes.position.array).setTranslation(x, y, z));
      }
      const hairM = new THREE.MeshStandardMaterial({ color: 0x2b1d14, roughness: 0.4 });
      for (let i = 0; i < Math.round(3 * dirt); i++) { // human hairs: 0.07 mm thick logs
        const x = (R0() - 0.5) * S, z = (R0() - 0.5) * S, a = R0() * 6.28, len = 80;
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, Math.PI / 2));
        const y = this.surfaceY(x, z) + 0.36;
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, len, 12), hairM); m.position.set(x, y, z); m.quaternion.copy(q); m.castShadow = true; this.scene.add(m);
        add(R.ColliderDesc.capsule(len / 2, 0.35).setTranslation(x, y, z).setRotation(q));
      }
      // dust mites live in carpets + beds (not on hot electronics or clean glass)
      if (k === 'carpet' || k === 'fabric' || k === 'paper' || (k === 'wood' && dirt > 0.4)) {
        const n = Math.round((k === 'fabric' ? 9 : 5) * dirt);
        for (let i = 0; i < n; i++) {
          const g = makeMite(); const s = 1.0 + R0() * 0.35; g.scale.setScalar(s);
          const x = (R0() - 0.5) * 30, z = (R0() - 0.5) * 30;
          g.position.set(x, this.surfaceY(x, z), z); g.rotation.y = R0() * 6.28;
          this.scene.add(g);
          const body = this.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(x, g.position.y + 0.8 * s, z));
          this.world.createCollider(R.ColliderDesc.ball(0.9 * s), body);
          this.creatures.push({ type: 'mite', g, body, s, speed: 0.15 + R0() * 0.2, turn: 0, t: R0() * 10 });
        }
      }
    }
  }

  surfaceY(x, z) {
    if (this.kind === 'carpet') return this.terrain.h(x, z); // the carpet backing, deep under the fibres
    if (this.kind === 'fabric') return 0.55; // top of the weave
    return this.terrain.h(x, z);
  }

  // where the player appears (feet) when entering
  spawnPoint() {
    if (this.kind === 'carpet') return new THREE.Vector3(1.5, 2, 1.5);   // on top of the fibres, then you sink in
    if (this.kind === 'fabric') return new THREE.Vector3(0, 1.2, 0);
    if (this.kind === 'liquid') return new THREE.Vector3(0, 0.02, 0);
    return new THREE.Vector3(0, this.terrain.h(0, 0) + 0.05, 0);
  }

  // germs near you, made per grid cell so they stay put as you walk around
  updateGerms(px, pz, ph) {
    const dirt = this.dirt;
    if (dirt < 0.05 || this.kind === 'liquid') return;
    const cs = Math.max(ph * 8, 0.02);
    const lvl = Math.round(Math.log2(cs));
    const size = Math.pow(2, lvl);
    const rad = 4;
    const cx = Math.floor(px / size), cz = Math.floor(pz / size);
    const keep = new Set();
    for (let i = -rad; i <= rad; i++) for (let j = -rad; j <= rad; j++) {
      const key = `${lvl}:${cx + i}:${cz + j}`; keep.add(key);
      if (!this.cells.has(key)) this.cells.set(key, this.makeCell(cx + i, cz + j, size, ph));
    }
    for (const [key, cell] of this.cells) if (!keep.has(key)) { for (const o of cell.objs) this.scene.remove(o); for (const c of cell.cols) this.world.removeCollider(c, false); this.cells.delete(key); }
  }

  makeCell(ix, iz, size, ph) {
    const r = rng((ix * 73856093) ^ (iz * 19349663) ^ (Math.round(Math.log2(size)) * 83492791) ^ this.seed);
    const objs = [], cols = [];
    const kind = this.kind;
    this._bm = this._bm || bacteriaMeshes(kind);
    const bm = this._bm;
    // how many germs: dirty + a good surface for them = more. Glass/plastic touched by hands: lots.
    const host = { glass: 1.3, plastic: 1.0, carpet: 0.6, fabric: 0.8, food: 1.5, wood: 0.5, metal: 0.3, pcb: 0.2, paint: 0.2, paper: 0.4 }[kind] ?? 0.5;
    const density = this.dirt * host; // per (cell = 8 player heights)
    const types = [];
    const bacSize = 0.02;  // 2 µm
    if (bacSize > ph * 0.05 && bacSize < ph * 30) types.push(['rod', bacSize, 3], ['coccus', 0.01, 4]);
    if (0.001 > ph * 0.03) types.push(['virus', 0.0012, 2]);
    for (const [type, sz, n0] of types) {
      const n = Math.floor(n0 * density * (size / (ph * 8)) ** 0 + r() * 2);
      const [geo, m] = bm[type];
      const clusterX = ix * size + r() * size, clusterZ = iz * size + r() * size;
      for (let i = 0; i < n * (type === 'coccus' ? 4 : 1); i++) {
        const x = type === 'coccus' ? clusterX + (r() - 0.5) * sz * 4 : ix * size + r() * size;
        const z = type === 'coccus' ? clusterZ + (r() - 0.5) * sz * 4 : iz * size + r() * size;
        const mesh = new THREE.Mesh(geo, m);
        const len = type === 'rod' ? sz * (0.8 + r() * 0.6) : sz;
        mesh.scale.set(len, sz * (type === 'rod' ? 0.5 : 1), sz * (type === 'rod' ? 0.5 : 1));
        const y = this.surfaceY(x, z) + sz * (type === 'rod' ? 0.25 : 0.5);
        mesh.position.set(x, y, z); mesh.rotation.y = r() * 6.28; mesh.castShadow = true;
        if (type === 'virus') this.addSpikes(mesh);
        this.scene.add(mesh); objs.push(mesh);
        if (sz > ph * 0.25) cols.push(this.world.createCollider(R.ColliderDesc.ball(sz * 0.4).setTranslation(x, y, z), this.fixed));
        if (type !== 'virus') this.creatures.push({ type: 'germ', g: mesh, base: mesh.position.clone(), t: r() * 10, amp: sz * 0.05, dead: () => !objs.includes(mesh) });
      }
    }
    return { objs, cols };
  }

  addSpikes(mesh) {
    if (!this._spike) { this._spike = new THREE.ConeGeometry(0.06, 0.35, 5); this._spike.translate(0, 0.65, 0); this._spikeM = new THREE.MeshStandardMaterial({ color: 0xd28aa8, roughness: 0.5 }); }
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Mesh(this._spike, this._spikeM);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v); mesh.add(s);
    }
  }

  // before the player moves: soda surface tension + swimming in the germ world
  preStep(p) {
    if (this.kind !== 'liquid') return;
    const dt = 1 / 60;
    if (p.feet.y < -0.02 * p.height) {
      p.inLiquid = { swimMul: 0.18, drag: 10, sink: 0.04, name: 'soda' }; // thick like honey at this size
      p.extForce.y += 9.81 * p.s * 0.7;
      p.sticky = Math.min(0.7, p.sticky + dt * 0.4);
    }
    if (this.skin) {
      const onSkin = p.grounded && Math.abs(p.feet.y) < p.height * 0.25;
      if (onSkin) {
        this.push = Math.max(0, (this.push || 0) + (p.crouchT > 0.5 ? dt : -dt));
        if (!this._tip) { this._tip = 1; this.game.ui.toast('🫧 Surface tension holds you up like a trampoline. Hold CROUCH to break through'); }
      }
      if (this.push > 1.2) { this.broke = true; this.push = 0; }
      if (this.broke && p.feet.y > p.height * 0.6) this.broke = false;
      this.skin.setEnabled(!this.broke);
    }
  }

  update(dt, player) {
    this.time += dt;
    const ph = player.height, f = player.feet;
    if (this.terrain.needs(f.x, f.z, ph)) this.terrain.rebuild(f.x, f.z, ph);
    this.updateGerms(f.x, f.z, ph);
    this.scene.fog.density = 0.9 / Math.max(ph * 40, 0.02);
    // light follows you (shadow box scaled to your size)
    const span = Math.max(ph * 12, 0.05);
    const cam = this.key.shadow.camera; cam.left = -span; cam.right = span; cam.top = span; cam.bottom = -span; cam.near = 0.001; cam.far = span * 20; cam.updateProjectionMatrix();
    this.key.position.set(f.x + span * 2, f.y + span * 8, f.z + span * 3); this.key.target.position.copy(f);
    // dust mites wander (they're blind - they bump into you without noticing)
    for (const c of this.creatures) {
      if (c.type === 'mite') {
        c.t += dt;
        c.turn += (Math.random() - 0.5) * dt * 2; c.turn *= 0.98;
        c.g.rotation.y += c.turn * dt;
        const v = c.speed * c.s;
        c.g.position.x += Math.sin(c.g.rotation.y) * v * dt; c.g.position.z += Math.cos(c.g.rotation.y) * v * dt;
        c.g.position.y = this.surfaceY(c.g.position.x, c.g.position.z);
        for (const l of c.g.userData.legs) { l.hip.rotation.y = Math.sin(c.t * 5 + l.phase) * 0.35; l.hip.rotation.x = Math.max(0, Math.cos(c.t * 5 + l.phase)) * 0.25; }
        c.body.setNextKinematicTranslation({ x: c.g.position.x, y: c.g.position.y + 0.8 * c.s, z: c.g.position.z });
        // a mite walking into you shoves you aside
        const dx = f.x - c.g.position.x, dz = f.z - c.g.position.z, d = Math.hypot(dx, dz);
        if (d < 1.6 * c.s && ph < 1.2 * c.s) { player.vel.x += dx / d * v * 2; player.vel.z += dz / d * v * 2; player.shake = Math.max(player.shake, 0.3); }
      } else if (c.type === 'germ') {
        c.t += dt;
        // Brownian motion: tiny things really do jiggle
        c.g.position.x = c.base.x + Math.sin(c.t * 7.3) * c.amp; c.g.position.z = c.base.z + Math.cos(c.t * 6.1) * c.amp;
      }
    }
    this.creatures = this.creatures.filter((c) => c.type !== 'germ' || c.g.parent);
    if (this.bubbles) for (const b of this.bubbles) {
      b.position.y += dt * (2 + b.userData.r * 1.2);
      if (b.position.y > -b.userData.r * 0.3) {
        // pop at the surface: a little shockwave that bumps you
        const d = Math.hypot(f.x - b.position.x, f.z - b.position.z);
        if (d < b.userData.r * 2) { player.vel.y += 0.4 * ph; player.shake = Math.max(player.shake, 0.4); }
        b.position.set(f.x + (Math.random() - 0.5) * 60 * Math.max(ph, 0.05), -40 - Math.random() * 20, f.z + (Math.random() - 0.5) * 60 * Math.max(ph, 0.05));
      }
    }
    this.world.step();
  }

  dispose() {
    this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.world.free();
  }
}
