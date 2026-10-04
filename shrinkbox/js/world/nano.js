// BELOW 1.5 µm: MOLECULES AND ATOMS. 1 unit = 1 nanometre here.
// What's really there:
//  - the air is a storm of N2 (78%) and O2 (21%) molecules flying at ~500 m/s, ~3 nm apart
//  - a thin film of water molecules sits on almost every surface (humidity)
//  - the surface itself: aluminium = a crystal lattice under a ~4 nm oxide skin,
//    glass = a random network of silicon + oxygen, plastics/carpet = tangled polymer chains,
//    soda = water molecules jiggling with CO2 and sugar molecules
// Atoms only become visible when you're smaller than ~60 nm (realistic: they're ~0.3 nm wide).
import * as THREE from 'three';
import { R } from '../core/physics.js';
import { fbm, rng } from '../core/noise.js';

export const NU = 1e9;               // units per meter (nanometres)
export const NANO_MIN_H = 3e-10;     // 0.3 nm: one atom tall
export const NANO_EXIT_H = 2e-6;     // grow above 2 µm -> back to the germ world

const ELEM = { H: [0xffffff, 0.06], C: [0x3a3a3a, 0.077], N: [0x3050f8, 0.071], O: [0xff2020, 0.066], Al: [0xbfa6a6, 0.143], Si: [0xf0c8a0, 0.111], Na: [0xab5cf2, 0.186] };

export class NanoWorld {
  constructor(game, kind) {
    this.game = game; this.kind = kind;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070c);
    this.scene.fog = new THREE.FogExp2(0x05070c, 0.01);
    this.world = new R.World({ x: 0, y: 0, z: 0 });
    this.fixed = this.world.createRigidBody(R.RigidBodyDesc.fixed());
    this.scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x302820, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(1, 3, 2); this.scene.add(key);
    this.R = rng(77);
    this.atomGeo = new THREE.SphereGeometry(1, 16, 12);
    this.mats = {}; for (const e in ELEM) this.mats[e] = new THREE.MeshPhysicalMaterial({ color: ELEM[e][0], roughness: 0.35, clearcoat: 0.6 });
    this.cells = new Map();
    this.h = (x, z) => this.surfaceH(x, z);
    // the ground: smooth at big sizes (atoms are too small to see), detailed when tiny
    this.ground = null; this.groundCol = null; this.gCenter = null;
    // air molecules (instanced dumbbells) flying around you
    this.air = this.makeAir();
    this.time = 0;
  }

  surfaceH(x, z) {
    // molecular-scale roughness (a few nm) - realistic for "smooth" surfaces
    const k = this.kind;
    const amp = k === 'glass' ? 0.5 : k === 'metal' ? 2 : k === 'liquid' ? 0.2 : 4;
    return fbm(x * 0.02, z * 0.02, 4, 65536, 3) * amp * 4 + fbm(x * 0.3, z * 0.3, 2, 65536, 5) * amp * 0.3;
  }

  spawnPoint() { return new THREE.Vector3(0, this.surfaceH(0, 0) + 30, 0); }

  rebuildGround(px, pz, ph) {
    const N = 80, cell = Math.max(ph * 0.5, 0.05), size = N * cell;
    const cx = Math.round(px / cell) * cell, cz = Math.round(pz / cell) * cell;
    this.gCenter = { x: cx, z: cz, cell, size };
    const heights = new Float32Array((N + 1) * (N + 1));
    const geo = new THREE.PlaneGeometry(size, size, N, N); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + cx, z = pos.getZ(i) + cz, y = this.surfaceH(x, z) - (ph < 60 ? 0.12 : 0);
      pos.setY(i, y);
      heights[Math.round((pos.getX(i) + size / 2) / cell) * (N + 1) + Math.round((pos.getZ(i) + size / 2) / cell)] = y;
    }
    geo.translate(cx, 0, cz); geo.computeVertexNormals();
    const col = { metal: 0x9aa0a8, glass: 0x2a3a40, plastic: 0x2a2a30, liquid: 0x203040, carpet: 0x4a5058, fabric: 0x34507c, wood: 0x4a3a2a, paper: 0x8a7050, food: 0x8a5a2a, paint: 0xb0aa9a, pcb: 0x1d4a2b }[this.kind] ?? 0x555555;
    if (this.ground) { this.scene.remove(this.ground); this.ground.geometry.dispose(); }
    this.ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, transparent: ph < 60, opacity: ph < 60 ? 0.35 : 1 }));
    this.scene.add(this.ground);
    if (this.groundCol) this.world.removeCollider(this.groundCol, false);
    this.groundCol = this.world.createCollider(R.ColliderDesc.heightfield(N, N, heights, { x: size, y: 1, z: size }).setTranslation(cx, 0, cz), this.fixed);
  }

  makeAir() {
    const n = 220;
    const geo = new THREE.CapsuleGeometry(0.065, 0.11, 3, 8); geo.rotateZ(Math.PI / 2);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }), n);
    const cols = []; for (let i = 0; i < n; i++) { const c = new THREE.Color(Math.random() < 0.78 ? 0x3050f8 : 0xff3030); mesh.setColorAt(i, c); cols.push(c); }
    this.scene.add(mesh);
    this.airP = []; for (let i = 0; i < n; i++) this.airP.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion().random() });
    this.airInit = false;
    return mesh;
  }

  // atoms of the surface, built per cell around you (only when they're big enough to see)
  makeCell(ix, iz, size) {
    const objs = [], r = rng((ix * 73856093) ^ (iz * 19349663) ^ 99);
    const k = this.kind, add = (el, x, y, z, scale = 1) => {
      const m = new THREE.Mesh(this.atomGeo, this.mats[el]); m.scale.setScalar(ELEM[el][1] * 1.6 * scale); m.position.set(x, y, z); this.scene.add(m); objs.push(m);
    };
    const x0 = ix * size, z0 = iz * size;
    if (k === 'metal' || k === 'pcb') {
      // aluminium FCC crystal (a = 0.405 nm) under an amorphous oxide skin
      const a = 0.405;
      for (let x = x0; x < x0 + size; x += a) for (let z = z0; z < z0 + size; z += a) {
        const y = this.surfaceH(x, z) - 0.3;
        add('Al', x, y, z); if (r() < 0.5) add('Al', x + a / 2, y - a / 2, z + a / 2);
        if (r() < 0.45) add('O', x + (r() - 0.5) * 0.3, y + 0.25 + r() * 0.15, z + (r() - 0.5) * 0.3);
      }
    } else if (k === 'glass') {
      for (let i = 0; i < size * size * 6; i++) { const x = x0 + r() * size, z = z0 + r() * size, y = this.surfaceH(x, z) - 0.15; add(r() < 0.33 ? 'Si' : 'O', x, y + (r() - 0.5) * 0.1, z); }
    } else if (k === 'liquid') {
      for (let i = 0; i < size * size * 3; i++) { const x = x0 + r() * size, z = z0 + r() * size, y = -r() * 0.6; this.water(x, y, z, objs); }
    } else {
      // polymer chains: zig-zag carbon backbones with hydrogens
      for (let c = 0; c < Math.max(1, size * size * 0.15); c++) {
        let x = x0 + r() * size, z = z0 + r() * size, dir = r() * 6.28;
        for (let i = 0; i < 24; i++) {
          const y = this.surfaceH(x, z) - 0.05 + (i % 2) * 0.08;
          add('C', x, y, z); add('H', x + Math.cos(dir + 1.6) * 0.11, y + 0.07, z + Math.sin(dir + 1.6) * 0.11, 0.9);
          dir += (r() - 0.5) * 0.6; x += Math.cos(dir) * 0.154; z += Math.sin(dir) * 0.154;
        }
      }
    }
    // a film of adsorbed water molecules on top (humidity) - realistic on almost everything
    if (k !== 'liquid') for (let i = 0; i < size * size * 0.6; i++) { const x = x0 + r() * size, z = z0 + r() * size; this.water(x, this.surfaceH(x, z) + 0.25 + r() * 0.3, z, objs); }
    return objs;
  }
  water(x, y, z, objs) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(Math.random() * 6, Math.random() * 6, 0);
    const o = new THREE.Mesh(this.atomGeo, this.mats.O); o.scale.setScalar(0.105); g.add(o);
    for (const s of [-1, 1]) { const h = new THREE.Mesh(this.atomGeo, this.mats.H); h.scale.setScalar(0.08); h.position.set(s * 0.076, 0.059, 0); g.add(h); } // 104.5 degree angle
    g.userData.jiggle = true; this.scene.add(g); objs.push(g);
  }

  updateAtoms(px, pz, ph) {
    if (ph > 60) { for (const [, objs] of this.cells) for (const o of objs) this.scene.remove(o); this.cells.clear(); return; }
    const size = 2, rad = Math.min(5, Math.ceil(ph * 8 / size) + 1);
    const cx = Math.floor(px / size), cz = Math.floor(pz / size), keep = new Set();
    for (let i = -rad; i <= rad; i++) for (let j = -rad; j <= rad; j++) {
      const key = `${cx + i}:${cz + j}`; keep.add(key);
      if (!this.cells.has(key)) this.cells.set(key, this.makeCell(cx + i, cz + j, size));
    }
    for (const [key, objs] of this.cells) if (!keep.has(key)) { for (const o of objs) this.scene.remove(o); this.cells.delete(key); }
  }

  preStep() {}

  update(dt, player) {
    this.time += dt;
    const f = player.feet, ph = player.height;
    const gc = this.gCenter;
    if (!gc || Math.abs(Math.log((ph * 0.5) / gc.cell)) > 0.7 || Math.hypot(f.x - gc.x, f.z - gc.z) > gc.size * 0.2) this.rebuildGround(f.x, f.z, ph);
    this.updateAtoms(f.x, f.z, ph);
    this.scene.fog.density = 0.8 / Math.max(ph * 30, 1);
    // air molecules: ~500 m/s for real. Shown slowed WAY down or you'd never see them.
    const box = Math.max(ph * 6, 8), m4 = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1);
    const speed = Math.max(ph * 2.5, 4);
    this.airP.forEach((a, i) => {
      if (!this.airInit || a.p.distanceTo(f) > box * 1.2) {
        a.p.set(f.x + (Math.random() - 0.5) * box * 2, f.y + Math.random() * box, f.z + (Math.random() - 0.5) * box * 2);
        a.v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(speed);
      }
      a.p.addScaledVector(a.v, dt);
      if (a.p.y < this.surfaceH(a.p.x, a.p.z) + 0.3) a.v.y = Math.abs(a.v.y);
      // a molecule hitting you gives you a little push (this is what air pressure IS)
      if (ph < 5 && a.p.distanceTo(player.center(new THREE.Vector3())) < ph * 0.6) { player.vel.addScaledVector(a.v, 0.02); a.v.negate(); player.shake = Math.max(player.shake, 0.15); }
      const vis = Math.max(1, ph / 6);
      m4.compose(a.p, a.q, one.clone().multiplyScalar(vis)); this.air.setMatrixAt(i, m4);
    });
    this.airInit = true;
    this.air.instanceMatrix.needsUpdate = true;
    // everything jiggles - heat is just atoms vibrating
    for (const [, objs] of this.cells) for (const o of objs) if (o.userData.jiggle) { o.position.x += (Math.random() - 0.5) * 0.004; o.position.z += (Math.random() - 0.5) * 0.004; o.rotation.y += (Math.random() - 0.5) * 0.1; }
    this.world.step();
  }

  dispose() { this.scene.traverse((o) => { if (o.geometry && o.geometry !== this.atomGeo) o.geometry.dispose(); }); this.world.free(); }
}
