// INSIDE A PERSON. Realistic anatomy at real sizes (you're a few millimetres tall in here):
//  mouth -> pharynx -> esophagus (25 cm, muscle waves push you down) -> stomach (acid! pH ~2)
//  -> small intestine (lined with millions of tiny villi) -> large intestine -> ...the toilet.
//  Wrong pipe: the trachea -> they COUGH you out.   Nose: nasal cavity with hairs -> SNEEZE.
//  Ear: the ear canal (hairs, wax) ends at the eardrum, which vibrates with every sound.
// It's dark in a body, so your watch light turns on. Every wall is a real tube you walk inside.
import * as THREE from 'three';
import { R } from '../core/physics.js';
import { fbm } from '../core/noise.js';
import { loop, sfx } from '../core/audio.js';

// a tube along a curve whose radius varies; built inside-out so you're INSIDE it
function organTube(points, radiusFn, opts = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const len = curve.getLength();
  const segs = opts.segs || Math.max(16, Math.round(len / 0.004));
  const rad = opts.radial || 20;
  const frames = curve.computeFrenetFrames(segs, !!opts.closed);
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, c = curve.getPointAt(t), N = frames.normals[i], Bn = frames.binormals[i];
    const r0 = radiusFn(t);
    for (let j = 0; j <= rad; j++) {
      const a = (j / rad) * Math.PI * 2;
      const bump = 1 + (fbm(t * len * 60, j * 0.7, 3, 4096, opts.seed || 1) - 0.5) * (opts.bumpy ?? 0.35);
      const r = r0 * bump * (opts.flat && Math.abs(Math.sin(a)) > 0.5 ? opts.flat : 1);
      const v = new THREE.Vector3().copy(c).addScaledVector(N, Math.cos(a) * r).addScaledVector(Bn, Math.sin(a) * r);
      pos.push(v.x, v.y, v.z); uv.push(t * len * 20, j / rad);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < rad; j++) {
    const a = i * (rad + 1) + j, b = a + rad + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1); // inward-facing winding
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  g.userData = { curve, len };
  return g;
}
// a squishy chamber (stomach, mouth) seen from inside, with holes where tubes connect
function chamber(center, radii, holes = [], seed = 3, bumpy = 0.12) {
  const g = new THREE.SphereGeometry(1, 48, 32);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
    const k = 1 + (fbm(v.x * 3 + seed, v.y * 3, 3, 4096, seed) - 0.5) * bumpy + Math.sin(v.y * 40) * 0.02; // folds (rugae)
    p.setXYZ(i, center[0] + v.x * radii[0] * k, center[1] + v.y * radii[1] * k, center[2] + v.z * radii[2] * k);
  }
  // flip to face inward + drop triangles at the openings
  const idx = g.index.array, keep = [];
  const hv = holes.map(([x, y, z, r]) => [new THREE.Vector3(x, y, z), r]);
  for (let i = 0; i < idx.length; i += 3) {
    const c = new THREE.Vector3(); for (let k = 0; k < 3; k++) c.add(new THREE.Vector3(p.getX(idx[i + k]), p.getY(idx[i + k]), p.getZ(idx[i + k])));
    c.multiplyScalar(1 / 3);
    if (hv.some(([h, r]) => c.distanceTo(h) < r)) continue;
    keep.push(idx[i], idx[i + 2], idx[i + 1]);
  }
  g.setIndex(keep); g.computeVertexNormals();
  return g;
}

function tissueMat(color, wet = 1) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, clearcoat: 0.8 * wet, clearcoatRoughness: 0.15, sheen: 0.6, sheenColor: new THREE.Color(0xff9a9a), sheenRoughness: 0.5, side: THREE.DoubleSide });
}

export class BodyWorld {
  constructor(game, who, entry) {
    this.game = game; this.who = who; this.entry = entry;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090203);
    this.scene.fog = new THREE.FogExp2(0x140405, 18);
    this.world = new R.World({ x: 0, y: 0, z: 0 });
    this.fixed = this.world.createRigidBody(R.RigidBodyDesc.fixed());
    this.scene.add(new THREE.HemisphereLight(0x7a2a2a, 0x200808, 0.25));
    this.time = 0; this.zones = [];
    this.build();
    this.heart = loop('rumble'); this.gurgle = loop('fizz');
  }

  add(geo, mat, collide = true) {
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; this.scene.add(m);
    if (collide) {
      const pos = geo.attributes.position.array, idx = geo.index ? geo.index.array : null;
      const d = R.ColliderDesc.trimesh(new Float32Array(pos), new Uint32Array(idx));
      const c = this.world.createCollider(d, this.fixed); c.part = { mat: 'tissue' };
    }
    return m;
  }

  build() {
    const pink = tissueMat(0xc4505a), deep = tissueMat(0x9a2f3a), gut = tissueMat(0xd07a6a), colon = tissueMat(0x9a5a40, 0.6), ear = tissueMat(0xe0a088, 0.4);
    // ---- mouth: cavity, tongue, two rows of teeth, opening at the front (+z) ----
    this.add(chamber([0, 0, 0.04], [0.026, 0.017, 0.048], [[0, 0, 0.088, 0.012], [0, -0.004, -0.007, 0.014], [0, 0.012, 0.0, 0.008]], 2, 0.05), pink);
    const tongue = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), tissueMat(0xd86a72));
    tongue.scale.set(0.019, 0.007, 0.03); tongue.position.set(0, -0.017, 0.042); this.scene.add(tongue);
    this.world.createCollider(R.ColliderDesc.roundCuboid(0.015, 0.002, 0.025, 0.003).setTranslation(0, -0.0135, 0.043), this.fixed);
    const toothM = new THREE.MeshPhysicalMaterial({ color: 0xf2eee2, roughness: 0.2, clearcoat: 1 });
    for (const [y, top] of [[0.011, 1], [-0.013, -1]]) for (let i = 0; i < 14; i++) {
      const a = -1.2 + i * (2.4 / 13), x = Math.sin(a) * 0.022, z = 0.04 + Math.cos(a) * 0.04;
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.0055, 0.008, 0.006), toothM); t.position.set(x, y, z); t.rotation.y = a; this.scene.add(t);
      this.world.createCollider(R.ColliderDesc.cuboid(0.0027, 0.004, 0.003).setTranslation(x, y, z).setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, 0))), this.fixed);
      void top;
    }
    this.zones.push({ name: 'mouth', box: new THREE.Box3(new THREE.Vector3(-0.03, -0.02, -0.01), new THREE.Vector3(0.03, 0.02, 0.09)) });
    // ---- nose: nostril at the front-top, nasal cavity with hairs, joins the throat ----
    const nose = organTube([[0, 0.045, 0.1], [0, 0.04, 0.07], [0, 0.034, 0.035], [0, 0.024, 0.012], [0, 0.011, 0.004]], (t) => 0.007 + 0.002 * Math.sin(t * 3), { radial: 16, flat: 0.6, seed: 4 });
    this.add(nose, deep);
    const hairM = new THREE.MeshStandardMaterial({ color: 0x2a1a14, roughness: 0.6 });
    for (let i = 0; i < 40; i++) { const t = Math.random() * 0.25; const c = nose.userData.curve.getPointAt(t); const h = new THREE.Mesh(new THREE.CylinderGeometry(0.00006, 0.0001, 0.006, 4), hairM); h.position.copy(c).add(new THREE.Vector3((Math.random() - 0.5) * 0.01, -0.004, (Math.random() - 0.5) * 0.005)); h.rotation.set(Math.random() - 0.5, 0, Math.random() - 0.5); this.scene.add(h); }
    this.zones.push({ name: 'nose', box: new THREE.Box3(new THREE.Vector3(-0.012, 0.012, 0.0), new THREE.Vector3(0.012, 0.055, 0.11)) });
    // ---- pharynx (throat) splitting into the esophagus (back) and trachea (front) ----
    this.add(organTube([[0, -0.003, -0.002], [0, -0.012, -0.01], [0, -0.035, -0.013], [0, -0.06, -0.012]], () => 0.012, { radial: 22, seed: 5 }), pink);
    this.zones.push({ name: 'pharynx', box: new THREE.Box3(new THREE.Vector3(-0.013, -0.058, -0.025), new THREE.Vector3(0.013, 0.004, 0.0)) });
    const eso = organTube([[0, -0.058, -0.016], [0, -0.12, -0.02], [0.005, -0.2, -0.02], [0.0, -0.28, -0.015], [0.01, -0.315, -0.005]], (t) => 0.0085 + 0.0015 * Math.sin(t * 20), { radial: 18, seed: 6 });
    this.add(eso, pink);
    this.zones.push({ name: 'esophagus', curve: eso.userData.curve, r: 0.012, push: 0.05 });
    const trach = organTube([[0, -0.058, -0.004], [0, -0.09, 0.006], [0, -0.14, 0.008]], () => 0.008, { radial: 16, seed: 7 });
    this.add(trach, tissueMat(0xd9a0a0));
    this.zones.push({ name: 'trachea', box: new THREE.Box3(new THREE.Vector3(-0.01, -0.145, -0.002), new THREE.Vector3(0.01, -0.075, 0.018)) });
    // ---- stomach with acid ----
    this.add(chamber([0.06, -0.38, 0], [0.12, 0.07, 0.065], [[0.01, -0.315, -0.005, 0.014], [0.17, -0.41, 0, 0.016]], 9, 0.18), tissueMat(0xb0444e));
    const acid = new THREE.Mesh(new THREE.CircleGeometry(0.11, 40).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xc8d06a, roughness: 0.05, transmission: 0.4, thickness: 0.05, transparent: true, opacity: 0.75, emissive: 0x2a3008, emissiveIntensity: 0.4 }));
    acid.position.set(0.06, -0.415, 0); acid.scale.set(1, 1, 0.55); this.scene.add(acid);
    this.zones.push({ name: 'stomach', box: new THREE.Box3(new THREE.Vector3(-0.06, -0.45, -0.065), new THREE.Vector3(0.18, -0.31, 0.065)), acidY: -0.415 });
    // ---- small intestine: a long coiled tube lined with villi ----
    const coil = [];
    coil.push([0.17, -0.41, 0], [0.2, -0.45, 0.02]);
    for (let i = 0; i <= 24; i++) { const a = i * 0.8, y = -0.48 - i * 0.012; coil.push([0.05 + Math.cos(a) * 0.09, y, Math.sin(a) * 0.06]); }
    const si = organTube(coil, () => 0.011, { radial: 18, seed: 11, bumpy: 0.2 });
    this.add(si, gut);
    this.zones.push({ name: 'small intestine', curve: si.userData.curve, r: 0.014, push: 0.26 });
    // villi: tiny finger-like bumps (realistic: ~1 mm tall) all over the inside wall
    const vg = new THREE.CapsuleGeometry(0.00025, 0.0008, 3, 6);
    const villi = new THREE.InstancedMesh(vg, tissueMat(0xe0948a), 5000);
    const m4 = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 5000; i++) {
      const t = Math.random(), c = si.userData.curve.getPointAt(t), tan = si.userData.curve.getTangentAt(t);
      const side = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).projectOnVector(tan).negate().add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)).normalize();
      const n = side.sub(tan.clone().multiplyScalar(side.dot(tan))).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(up, n.clone().negate());
      m4.compose(c.clone().addScaledVector(n, 0.0102), q, new THREE.Vector3(1, 1, 1)); villi.setMatrixAt(i, m4);
    }
    this.scene.add(villi);
    // ---- large intestine (colon) up, across, down to the exit ----
    const end = coil[coil.length - 1];
    const col = organTube([end, [end[0] + 0.05, end[1] - 0.02, 0.03], [0.22, -0.6, 0.03], [0.22, -0.45, 0.03], [0.05, -0.43, 0.06], [-0.12, -0.45, 0.04], [-0.12, -0.7, 0.03], [-0.03, -0.85, -0.02], [-0.02, -0.95, -0.05]], (t) => 0.018 + 0.004 * Math.sin(t * 40), { radial: 20, seed: 13, bumpy: 0.25 });
    this.add(col, colon);
    this.zones.push({ name: 'large intestine', curve: col.userData.curve, r: 0.024, push: 0.3, exitAt: 0.985 });
    // ---- ear (a separate place: you only get here through the ear) ----
    const ec = organTube([[1.0, 0, 0], [0.99, 0.002, 0], [0.98, 0.0, 0.002], [0.975, -0.001, 0]], (t) => 0.0038 - t * 0.001, { radial: 16, seed: 15, bumpy: 0.15 });
    this.add(ec, ear);
    for (let i = 0; i < 25; i++) { const t = Math.random() * 0.3; const c = ec.userData.curve.getPointAt(t); const h = new THREE.Mesh(new THREE.CylinderGeometry(0.00003, 0.00005, 0.002, 4), hairM); h.position.copy(c).add(new THREE.Vector3(0, -0.003, (Math.random() - 0.5) * 0.004)); this.scene.add(h); }
    for (let i = 0; i < 6; i++) { const w = new THREE.Mesh(new THREE.SphereGeometry(0.0006 + Math.random() * 0.0005, 8, 6), new THREE.MeshStandardMaterial({ color: 0xc98a2a, roughness: 0.3 })); const c = ec.userData.curve.getPointAt(0.3 + Math.random() * 0.4); w.position.copy(c).add(new THREE.Vector3(0, -0.003, 0)); this.scene.add(w); }
    this.eardrum = new THREE.Mesh(new THREE.CircleGeometry(0.0034, 32), new THREE.MeshPhysicalMaterial({ color: 0xe8c8b8, roughness: 0.3, transmission: 0.3, thickness: 0.0002, side: THREE.DoubleSide }));
    this.eardrum.position.set(0.9752, -0.001, 0); this.eardrum.rotation.y = Math.PI / 2; this.scene.add(this.eardrum);
    this.world.createCollider(R.ColliderDesc.cylinder(0.0001, 0.0034).setTranslation(0.9752, -0.001, 0).setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2))), this.fixed);
    this.zones.push({ name: 'ear', box: new THREE.Box3(new THREE.Vector3(0.974, -0.006, -0.006), new THREE.Vector3(1.002, 0.006, 0.006)), exitX: 0.999 });
  }

  spawnPoint() {
    if (this.entry === 'nose') return new THREE.Vector3(0, 0.041, 0.085);
    if (this.entry === 'ear') return new THREE.Vector3(0.996, -0.0028, 0);
    return new THREE.Vector3(0, -0.0085, 0.06); // on the tongue
  }

  zoneOf(p) {
    for (const z of this.zones) {
      if (z.box && z.box.containsPoint(p)) return z;
      if (z.curve) { const t = nearestT(z.curve, p); if (z.curve.getPointAt(t).distanceTo(p) < z.r) { z.t = t; return z; } }
    }
    return null;
  }

  preStep(p) {
    const g = this.game, s = p.s, gg = 9.81 * s;
    const c = p.center(new THREE.Vector3());
    const z = this.zoneOf(c);
    this.zone = z ? z.name : 'body';
    // muscle waves push you along the tubes (that's how food moves - peristalsis)
    if (z && z.curve) {
      // the flow speed is real (a few cm per second), whatever size you are
      const tan = z.curve.getTangentAt(z.t);
      const flow = tan.multiplyScalar(z.push * 0.25 * (0.6 + 0.4 * Math.sin(this.time * 3)));
      p.extForce.add(flow.sub(p.vel).multiplyScalar(2.5));
      p.extForce.y += gg; // squeezed along by the walls - gravity hardly matters in here
      if (z.exitAt && z.t > z.exitAt) this.exit('poop');
    }
    if (z && z.name === 'stomach' && c.y < z.acidY) {
      p.inLiquid = { swimMul: 0.4, drag: 4, sink: 0.05, name: 'stomach acid' };
      if (g.time > (this._acidCd || 0)) { this._acidCd = g.time + 0.8; p.hurt(1.6, 'stomach acid'); if (!this._acidTip) { this._acidTip = 1; g.ui.toast('🧪 Stomach acid (pH ~2)! It burns - get out of the liquid!', 4); } }
    }
    if (z && z.name === 'stomach') {
      this.stomachT = (this.stomachT || 0) + 1 / 60;
      if (this.stomachT > 10) {
        // the stomach churns and pushes its contents through the pylorus into the intestine
        if (!this._churnTip) { this._churnTip = 1; g.ui.toast('🌀 The stomach churns and squeezes you toward the intestines!', 3); }
        const to = new THREE.Vector3(0.17 - c.x, -0.41 - c.y, -c.z).normalize().multiplyScalar(0.05);
        p.extForce.add(to.sub(p.vel).multiplyScalar(3)); p.extForce.y += gg;
      }
    }
    if (z && z.name === 'trachea' && !this._coughing) { this._coughing = true; g.ui.toast('⚠️ Wrong pipe! That\'s the windpipe...', 2); setTimeout(() => this.exit('cough'), 1200); }
    if (z && z.name === 'nose') { this.noseT = (this.noseT || 0) + 1 / 60; if (this.noseT > 8 && !this._sneezing) { this._sneezing = true; g.ui.toast('👃 You\'re tickling the nose hairs... uh oh...', 2); setTimeout(() => this.exit('sneeze'), 1500); } }
    if (z && z.name === 'ear' && c.x > z.exitX) this.exit('ear');
    if (z && z.name === 'mouth' && this.entry === 'mouth' && this.time < 3) {
      // chewing! (realistic: you'd want to hide by the cheek)
      if (Math.abs(c.x) > 0.012 && g.time > (this._chewCd || 0)) { this._chewCd = g.time + 0.8; p.hurt(8, 'chewed'); p.shake = 1; sfx.thud(0.8, 1.4); }
    }
    if (z && z.name === 'mouth') {
      this.mouthT = (this.mouthT || 0) + 1 / 60;
      if (this.mouthT > 3.5) {
        // the tongue pushes everything back into the throat (swallowing)
        if (!this._swallowTip) { this._swallowTip = 1; g.ui.toast('😮 GULP! The tongue pushes you down the throat!', 3); sfx.whoosh(false, 0.5, 0.6); }
        const to = new THREE.Vector3(0, -0.006, -0.01).sub(c).normalize().multiplyScalar(0.06);
        p.extForce.add(to.sub(p.vel).multiplyScalar(4)); p.extForce.y += gg;
      }
    } else this.mouthT = 0;
    if (z && z.name === 'pharynx') {
      const to = new THREE.Vector3(0, -0.07, -0.016).sub(c).normalize().multiplyScalar(0.05);
      p.extForce.add(to.sub(p.vel).multiplyScalar(3)); p.extForce.y += gg;
    }
  }

  // safety net: if the walls ever pin you, the muscles squeeze you onward (that's what they do!)
  unstick(p, c) {
    if (!this.lastC) { this.lastC = c.clone(); this.stuckT = 0; return; }
    if (c.distanceTo(this.lastC) > p.height * 0.3) { this.lastC.copy(c); this.stuckT = 0; return; }
    this.stuckT += 1 / 60;
    if (this.stuckT < 3 || p.inputMoving) return;
    this.stuckT = 0;
    const byName = (n) => this.zones.find((z) => z.name === n);
    const z = this.zone;
    let to = null;
    if (z === 'mouth' && this.mouthT > 3.5 || z === 'pharynx') to = byName('esophagus').curve.getPointAt(0.04);
    else if (z === 'esophagus') { const zz = byName('esophagus'); to = zz.t > 0.9 ? new THREE.Vector3(0.03, -0.36, 0) : zz.curve.getPointAt(Math.min(0.97, zz.t + 0.08)); }
    else if (z === 'stomach' && this.stomachT > 14) to = byName('small intestine').curve.getPointAt(0.02);
    else if (z === 'small intestine') { const zz = byName('small intestine'); to = zz.t > 0.95 ? byName('large intestine').curve.getPointAt(0.02) : zz.curve.getPointAt(Math.min(0.99, zz.t + 0.06)); }
    else if (z === 'large intestine') { const zz = byName('large intestine'); to = zz.curve.getPointAt(Math.min(0.995, zz.t + 0.06)); }
    if (to) { p.feet.copy(to).y -= p.height * 0.4; p.vel.set(0, 0, 0); }
  }

  update(dt, p) {
    this.time += dt;
    this.unstick(p, p.center(new THREE.Vector3()));
    // heartbeat (felt everywhere) + stomach gurgles
    const beat = Math.pow(Math.max(0, Math.sin(this.time * 7.5)), 12) + Math.pow(Math.max(0, Math.sin(this.time * 7.5 - 0.9)), 12) * 0.6;
    this.heart.set(0.15 + beat * 0.5, 0.6);
    this.gurgle.set(this.zone === 'stomach' || (this.zone || '').includes('intestine') ? 0.06 : 0.01, 0.3);
    p.shake = Math.max(p.shake, beat * 0.08);
    this.scene.fog.density = 0.6 / Math.max(p.height * 40, 0.001);
    this.eardrum.position.x = 0.9752 + Math.sin(this.time * 90) * 0.00002 * (1 + beat);
    this.world.step();
  }

  exit(how) {
    if (this._exiting) return; this._exiting = true;
    setTimeout(() => this.game.exitBody(how), 50);
  }

  dispose() { this.heart.stop(); this.gurgle.stop(); this.scene.traverse((o) => o.geometry && o.geometry.dispose()); this.world.free(); }
}

function nearestT(curve, p) {
  let best = 0, bd = Infinity;
  for (let i = 0; i <= 60; i++) { const t = i / 60, d = curve.getPointAt(t).distanceToSquared(p); if (d < bd) { bd = d; best = t; } }
  let lo = Math.max(0, best - 1 / 60), hi = Math.min(1, best + 1 / 60);
  for (let k = 0; k < 8; k++) { const a = lo + (hi - lo) / 3, b = hi - (hi - lo) / 3; if (curve.getPointAt(a).distanceToSquared(p) < curve.getPointAt(b).distanceToSquared(p)) hi = b; else lo = a; }
  return (lo + hi) / 2;
}
