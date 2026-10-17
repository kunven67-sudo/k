import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mesh, box, boxMM, cyl, lathe, tube } from './build.js';
import { paint, canvasTex, smudgeTex, pbr } from './materials.js';
import { model, place } from './models.js';

// Bathroom (x 6.94..9.34, z 3.72..6.4): tub + shower with a curtain along the north wall, toilet
// under the frosted window, vanity + a real mirror (you see yourself, head and all) on the east wall.
export async function buildBathroom(ctx) {
  const scene = ctx.scene;
  const R = { tick: [] };
  const porcelain = paint(0xf6f6f3, 0.12, 0, { envMapIntensity: 1.2 });
  const chrome = paint(0xe0e2e5, 0.08, 1);
  const terry = await pbr('terry_cloth', { roughness: 1, normal: 0.8 });

  // ---- bathtub with shower ---------------------------------------------------------------------
  const tx0 = 7.8, tx1 = 9.34, tz0 = 3.72, tz1 = 4.5, th = 0.55;
  const tub = new THREE.Group();
  mesh(boxMM(tx0, 0, tz1 - 0.06, tx1, th, tz1), porcelain, { parent: tub });               // front apron
  mesh(boxMM(tx0, 0, tz0, tx0 + 0.07, th, tz1), porcelain, { parent: tub });               // west end
  mesh(boxMM(tx1 - 0.07, 0, tz0, tx1, th, tz1), porcelain, { parent: tub });               // east end
  mesh(boxMM(tx0, 0, tz0, tx1, th, tz0 + 0.06), porcelain, { parent: tub });               // back
  mesh(boxMM(tx0 + 0.07, 0.06, tz0 + 0.06, tx1 - 0.07, 0.08, tz1 - 0.06), porcelain, { parent: tub }); // floor
  mesh(cyl(0.022, 0.022, 0.004, 24), chrome, { parent: tub, pos: [tx1 - 0.18, 0.083, (tz0 + tz1) / 2] }); // drain
  scene.add(tub);
  ctx.physics.add({ x: (tx0 + tx1) / 2, z: (tz0 + tz1) / 2, hx: (tx1 - tx0) / 2, hz: (tz1 - tz0) / 2, y0: 0, y1: th });
  ctx.interact.block(tub);
  // wall tiles around the tub go up to the ceiling (the bathroom walls are already tiled)
  // spout + knobs + shower head on the east wall
  const sx = tx1 - 0.005;
  mesh(tube([[sx, 0.72, 4.11], [sx - 0.1, 0.72, 4.11], [sx - 0.14, 0.69, 4.11]], 0.014, 16), chrome, { parent: scene });
  const knob = mesh(cyl(0.03, 0.035, 0.03, 24), chrome, { parent: scene, rot: [0, 0, Math.PI / 2], pos: [sx - 0.015, 1.05, 4.11] });
  mesh(tube([[sx, 1.95, 4.11], [sx - 0.18, 1.98, 4.11]], 0.01, 12), chrome, { parent: scene });
  const head = mesh(cyl(0.07, 0.045, 0.03, 32), chrome, { parent: scene, rot: [0, 0, -Math.PI / 2 + 0.5], pos: [sx - 0.2, 1.96, 4.11] });
  void head;
  // water: a bunch of falling streaks when the shower is on
  const drops = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.12, 4), new THREE.MeshStandardMaterial({ color: 0xd8ecff, roughness: 0.05, transparent: true, opacity: 0.5, depthWrite: false }), 140);
  drops.castShadow = false;
  drops.count = 0;
  scene.add(drops);
  const dropState = [];
  for (let i = 0; i < 140; i++) dropState.push({ t: Math.random(), a: Math.random() * 6.28, r: Math.random() * 0.06 });
  R.shower = { on: false, snd: null, steam: 0 };
  ctx.interact.add(knob, {
    range: 1.9, label: () => R.shower.on ? 'Turn off the shower' : 'Turn on the shower',
    use: () => {
      R.shower.on = !R.shower.on;
      knob.rotation.x = R.shower.on ? -1.2 : 0;
      if (R.shower.on && ctx.audio.ctx) R.shower.snd = ctx.audio.play('water_loop.ogg', { pos: new THREE.Vector3(sx - 0.25, 1.2, 4.11), loop: true, vol: 0.55, rate: 0.85, ref: 0.8 });
      else if (R.shower.snd) { R.shower.snd.stop?.(); R.shower.snd = null; }
    },
  });
  const dm = new THREE.Object3D();
  R.tick.push((dt) => {
    const S = R.shower;
    S.steam = Math.max(0, Math.min(1, S.steam + (S.on ? dt / 90 : -dt / 120)));
    if (!S.on) { drops.count = 0; return; }
    drops.count = 140;
    for (let i = 0; i < 140; i++) {
      const d = dropState[i];
      d.t += dt * 2.4;
      if (d.t > 1) { d.t -= 1; d.a = Math.random() * 6.28; d.r = Math.random() * 0.07; }
      const spread = d.r + d.t * 0.12;
      dm.position.set(sx - 0.22 - d.t * 0.25 + Math.cos(d.a) * spread, 1.93 - d.t * 1.85, 4.11 + Math.sin(d.a) * spread);
      dm.updateMatrix();
      drops.setMatrixAt(i, dm.matrix);
    }
    drops.instanceMatrix.needsUpdate = true;
  });
  // shower curtain on a rod: pull it open / closed
  const rodY = 2.0;
  mesh(cyl(0.012, 0.012, tx1 - tx0, 12), chrome, { parent: scene, rot: [0, 0, Math.PI / 2], pos: [(tx0 + tx1) / 2, rodY, tz1 - 0.02] });
  const curtTex = canvasTex(256, 256, (c, W, Hh) => {
    c.fillStyle = '#e9eef0'; c.fillRect(0, 0, W, Hh);
    c.strokeStyle = 'rgba(70,110,130,0.35)'; c.lineWidth = 6;
    for (let x = 0; x < W; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, Hh); c.stroke(); }
  });
  const curtMat = new THREE.MeshStandardMaterial({ map: curtTex, roughness: 0.75, side: THREE.DoubleSide, transparent: true, opacity: 0.93 });
  const NX = 60, NY = 8;
  const cg = new THREE.PlaneGeometry(1, 1.65, NX, NY);
  const curtain = mesh(cg, curtMat, { parent: scene, cast: true });
  curtain.position.set(0, 0, 0);
  const base = cg.attributes.position.array.slice();
  R.curtain = { open: 1, target: 1 };
  const shapeCurtain = () => {
    const open = R.curtain.open;               // 1 = bunched at the west end, 0 = closed along the tub
    const len = (tx1 - tx0) * (1 - open * 0.82); // how far it's pulled
    const p = cg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = base[i * 3] + 0.5, v = base[i * 3 + 1];
      const x = tx0 + 0.03 + u * len;
      const folds = Math.sin(u * NX * 0.55) * (0.025 + open * 0.035);
      p.setXYZ(i, x, rodY - 0.04 - (0.825 - v), tz1 - 0.02 + folds);
    }
    p.needsUpdate = true;
    cg.computeVertexNormals();
  };
  shapeCurtain();
  ctx.interact.add(curtain, {
    range: 2.0, label: () => R.curtain.target > 0.5 ? 'Close the shower curtain' : 'Open the shower curtain',
    use: () => { R.curtain.target = R.curtain.target > 0.5 ? 0 : 1; ctx.audio.burst({ pos: new THREE.Vector3(8.5, 1.9, tz1), freq: 2600, q: 0.6, vol: 0.05, env: [0.02, 0.35, 0.2] }); },
  });
  R.tick.push((dt) => {
    const c = R.curtain;
    if (Math.abs(c.target - c.open) > 0.002) { c.open += (c.target - c.open) * Math.min(1, dt * 5); shapeCurtain(); }
  });

  // ---- toilet ------------------------------------------------------------------------------------
  const T = await buildToilet(ctx, new THREE.Vector3(8.05, 0, 6.4), porcelain, chrome);
  R.toilet = T;
  R.tick.push((dt) => T.update(dt));
  // paper holder on the south wall next to it
  mesh(cyl(0.006, 0.006, 0.13, 10), chrome, { parent: scene, rot: [0, 0, Math.PI / 2], pos: [7.55, 0.72, 6.36] });
  mesh(cyl(0.055, 0.055, 0.1, 24), paint(0xfbfbf8, 0.95), { parent: scene, rot: [0, 0, Math.PI / 2], pos: [7.55, 0.72, 6.34] });

  // ---- vanity + mirror -------------------------------------------------------------------------------
  const vz0 = 4.85, vz1 = 5.65, vx0 = 8.84, vx1 = 9.34, vh = 0.85;
  const wood = await pbr('white_oak_veneer', { color: 0x6e5a48, roughness: 0.6, normal: 0.4 });
  mesh(boxMM(vx0, 0.1, vz0, vx1, vh - 0.02, vz1), wood, { parent: scene });
  const top = mesh(boxMM(vx0 - 0.01, vh - 0.02, vz0 - 0.01, vx1, vh, vz1 + 0.01), porcelain, { parent: scene, name: 'counter' });
  ctx.interact.block(top);
  // basin (an inset bowl)
  mesh(lathe([[0, 0], [0.12, 0.002], [0.17, 0.07], [0.172, 0.075], [0, 0.075]], 40).scale(1, 1, 0.75), porcelain, { parent: scene, pos: [(vx0 + vx1) / 2 - 0.02, vh - 0.07, (vz0 + vz1) / 2] });
  ctx.physics.add({ x: (vx0 + vx1) / 2, z: (vz0 + vz1) / 2, hx: (vx1 - vx0) / 2, hz: (vz1 - vz0) / 2, y0: 0, y1: vh });
  const faucet = new THREE.Group();
  faucet.position.set(vx1 - 0.08, vh, (vz0 + vz1) / 2);
  mesh(cyl(0.02, 0.024, 0.02, 20), chrome, { parent: faucet, pos: [0, 0.01, 0] });
  mesh(tube([[0, 0.02, 0], [0, 0.17, 0], [-0.04, 0.2, 0], [-0.12, 0.18, 0]], 0.011, 32), chrome, { parent: faucet });
  scene.add(faucet);
  const stream = mesh(new THREE.CylinderGeometry(0.005, 0.004, 0.13, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xd8ecff, roughness: 0.05, transparent: true, opacity: 0.5, depthWrite: false }), { parent: scene, cast: false });
  stream.position.set(vx1 - 0.2, vh + 0.105, (vz0 + vz1) / 2); stream.visible = false;
  R.sink = { on: false };
  ctx.interact.add(faucet, {
    range: 1.8, label: () => R.sink.on ? 'Turn off the tap' : 'Wash your hands',
    use: () => {
      R.sink.on = !R.sink.on; stream.visible = R.sink.on;
      if (R.sink.on && ctx.audio.ctx) R.sink.snd = ctx.audio.play('water_loop.ogg', { pos: faucet.position, loop: true, vol: 0.3, rate: 1.15, ref: 0.5 });
      else if (R.sink.snd) { R.sink.snd.stop?.(); R.sink.snd = null; }
    },
  });
  // the mirror: a real reflection (re-renders the room from behind the glass, only while you're in here)
  const q = ctx.renderer.p.mirror ?? 0.75;
  const mw = 0.72, mh = 0.86;
  const mirror = new Reflector(new THREE.PlaneGeometry(mw, mh), { textureWidth: Math.round(1024 * q * mw), textureHeight: Math.round(1024 * q * mh), color: 0xb9bcbe, multisample: 0 });
  mirror.position.set(9.34 - 0.0135, 1.48, (vz0 + vz1) / 2); // a hair in front of its frame
  mirror.rotation.y = -Math.PI / 2;
  scene.add(mirror);
  mesh(boxMM(9.34 - 0.012, 1.48 - mh / 2 - 0.012, (vz0 + vz1) / 2 - mw / 2 - 0.012, 9.34, 1.48 + mh / 2 + 0.012, (vz0 + vz1) / 2 + mw / 2 + 0.012), paint(0x222325, 0.4, 0.6), { parent: scene, cast: false });
  // in the reflection you have a head: show it just for the mirror's render, hide it again after
  const before = mirror.onBeforeRender;
  mirror.onBeforeRender = function (renderer, sc, cam) {
    const av = ctx.player?.avatar;
    const hidden = av?.headHidden;
    if (hidden) { av.hideHead(false); av.root.updateMatrixWorld(true); }
    before.call(this, renderer, sc, cam);
    if (hidden) { av.hideHead(true); av.root.updateMatrixWorld(true); av.skeletonUpdate?.(); }
  };
  R.mirror = mirror;
  // vanity light bar
  const barMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3e2, emissiveIntensity: 0 });
  mesh(box(0.035, 0.05, 0.6, 0.012), barMat, { parent: scene, pos: [9.34 - 0.03, 2.02, (vz0 + vz1) / 2] });
  R.barMat = barMat;
  // towel ring + hand towel
  mesh(new THREE.TorusGeometry(0.08, 0.006, 8, 32), chrome, { parent: scene, pos: [9.34 - 0.03, 1.2, vz0 - 0.18], rot: [0, Math.PI / 2, 0] });
  mesh(box(0.03, 0.32, 0.2, 0.012), terry.clone(), { parent: scene, pos: [9.34 - 0.05, 1.02, vz0 - 0.18] }).material.color.set(0x5c7d8f);
  // bath towels on a bar on the west wall + a mat
  mesh(cyl(0.01, 0.01, 0.6, 10), chrome, { parent: scene, rot: [Math.PI / 2, 0, 0], pos: [6.97, 1.15, 5.95] });
  const big = mesh(box(0.035, 0.7, 0.5, 0.015), terry.clone(), { parent: scene, pos: [6.99, 0.82, 5.95] });
  big.material.color.set(0xe9e4dc);
  const mat = mesh(box(0.75, 0.012, 0.48, 0.006), terry.clone(), { parent: scene, pos: [8.5, 0.006, 4.8] });
  mat.material.color.set(0x6f8a99); mat.castShadow = false;
  // small stuff: duck on the tub rim, cleaner on the floor
  const duck = await model('rubber_duck_toy');
  place(ctx, duck, { x: tx0 + 0.04, y: th, z: tz1 - 0.04, height: 0.085, rot: 0.7, collide: false });
  const cleaner = await model('multi_cleaner_bottle');
  place(ctx, cleaner, { x: 9.2, y: 0, z: 6.25, height: 0.23, rot: 2.4, collide: false });

  R.update = (dt) => {
    for (const f of R.tick) f(dt);
    // the mirror only costs anything while you're in here
    mirror.visible = ctx.room === 'bathroom' || ctx.room === 'hallway' && ctx.house?.doors.bathroom.open > 0.3;
    barMat.emissiveIntensity = ctx.lights?.rooms.bathroom.on ? 3 : 0;
  };
  return R;
}

async function buildToilet(ctx, wallPos, porcelain, chrome) {
  const g = new THREE.Group();
  g.position.copy(wallPos);
  g.rotation.y = Math.PI; // faces north into the room
  ctx.scene.add(g);
  // local: back against the wall at z = 0, bowl toward +z
  mesh(box(0.38, 0.38, 0.17, 0.03), porcelain, { parent: g, pos: [0, 0.6, 0.1] });                     // tank
  mesh(box(0.4, 0.04, 0.19, 0.012), porcelain, { parent: g, pos: [0, 0.81, 0.1] });                     // tank lid
  const bowl = lathe([[0, 0], [0.12, 0], [0.13, 0.05], [0.11, 0.2], [0.17, 0.34], [0.19, 0.4], [0.16, 0.405], [0.14, 0.34], [0, 0.26]], 40);
  bowl.scale(1, 1, 1.25);
  mesh(bowl, porcelain, { parent: g, pos: [0, 0, 0.42] });
  const water = mesh(new THREE.CircleGeometry(0.12, 32).scale(1, 1.2, 1), new THREE.MeshStandardMaterial({ color: 0x9ec7d6, roughness: 0.02, transparent: true, opacity: 0.6 }), { parent: g, pos: [0, 0.28, 0.43], rot: [-Math.PI / 2, 0, 0], cast: false });
  void water;
  // seat + lid on hinges at the back of the bowl
  const hinge = new THREE.Group(); hinge.position.set(0, 0.41, 0.22); g.add(hinge);
  const seatShape = new THREE.Shape(); seatShape.absellipse(0, 0, 0.19, 0.23, 0, Math.PI * 2);
  const hole = new THREE.Path(); hole.absellipse(0, 0.01, 0.12, 0.15, 0, Math.PI * 2); seatShape.holes.push(hole);
  const seatGeo = new THREE.ExtrudeGeometry(seatShape, { depth: 0.02, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2, curveSegments: 32 });
  seatGeo.rotateX(-Math.PI / 2);
  const seat = new THREE.Group(); hinge.add(seat);
  mesh(seatGeo, porcelain, { parent: seat, pos: [0, 0, 0.23] });
  const lidShape = new THREE.Shape(); lidShape.absellipse(0, 0, 0.19, 0.23, 0, Math.PI * 2);
  const lidGeo = new THREE.ExtrudeGeometry(lidShape, { depth: 0.015, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 32 });
  lidGeo.rotateX(-Math.PI / 2);
  const lid = new THREE.Group(); lid.position.y = 0.03; hinge.add(lid);
  mesh(lidGeo, porcelain, { parent: lid, pos: [0, 0, 0.23] });
  const handle = mesh(box(0.06, 0.012, 0.012, 0.004), chrome, { parent: g, pos: [-0.16, 0.74, 0.19] });
  ctx.physics.add({ x: wallPos.x, z: wallPos.z - 0.36, hx: 0.2, hz: 0.36, y0: 0, y1: 0.8 });
  const pos = wallPos.clone().add(new THREE.Vector3(0, 0.5, -0.35));
  const Tl = { lid: 0, lidT: 0, flushT: 0, g };
  ctx.interact.add(lid, {
    range: 1.9, label: () => Tl.lidT ? (ctx.needs && ctx.needs.v.bladder > 0.15 ? 'Pee' : 'Close the lid') : 'Lift the lid',
    use: () => {
      if (Tl.lidT && ctx.needs && ctx.needs.v.bladder > 0.15) {
        ctx.needs.pee(); ctx.toast('Ahh. Don\'t forget to flush.');
        ctx.audio.burst({ pos: pos.clone().setY(0.3), freq: 1300, q: 0.5, vol: 0.05, env: [0.2, 3.5, 0.6] });
        Tl.dirty = true; return;
      }
      Tl.lidT = Tl.lidT ? 0 : 1;
      ctx.audio.play('microwave_close.ogg', { pos, vol: 0.25, rate: Tl.lidT ? 1.3 : 0.9 });
    },
  });
  ctx.interact.add(handle, {
    range: 1.9, label: () => 'Flush',
    use: () => { if (Tl.flushT > 0) return; Tl.flushT = 6; handle.rotation.z = -0.5; Tl.dirty = false; ctx.audio.play('toilet.ogg', { pos, vol: 0.7 }); },
  });
  Tl.update = (dt) => {
    Tl.lid += (Tl.lidT - Tl.lid) * Math.min(1, dt * 7);
    lid.rotation.x = -Tl.lid * 1.75;
    if (Tl.flushT > 0) { Tl.flushT -= dt; if (Tl.flushT < 5.5) handle.rotation.z = 0; }
  };
  return Tl;
}
