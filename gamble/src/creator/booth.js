// The DMV corner: worn linoleum, a pulled-down blue roller backdrop, the photo camera on its stand
// with a ring light, the counter (frosted window, bored clerk, take-a-number dispenser), fluorescent
// troffers and a red-LED NOW SERVING sign. Everything is built in code from a handful of shared
// materials; static pieces are merged per material so the whole room is ~12 draw calls.
//
//   const booth = buildBooth(tier);  scene.add(booth.root);  booth.update(dt, t);
//   booth.setServing(48);  booth.flash(1);  // ring light pop for the photo

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTexture } from '../gfx/textures.js';
import { Rng } from '../core/rng.js';

// ---------------------------------------------------------------------------------------------
// Canvas textures

function linoleum(ctx, w, h) {
  // 12" vinyl composition tile: cream + oatmeal checker with chip flecks, wax build-up and scuffs.
  const rng = new Rng(4417);
  const n = 4;
  const s = w / n;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const odd = (x + y) & 1;
      const base = odd ? [196, 184, 158] : [226, 219, 200];
      const v = rng.range(-7, 7);
      ctx.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v - 2})`;
      ctx.fillRect(x * s, y * s, s, s);
      // flecks
      for (let i = 0; i < 520; i++) {
        const c = rng.pick(odd ? ['#8e8270', '#e9e2cf', '#6d6556', '#b3a585'] : ['#a99e86', '#f4efe2', '#8c8577', '#c9bd9d']);
        ctx.fillStyle = c;
        ctx.globalAlpha = rng.range(0.25, 0.8);
        const r = rng.range(0.6, 2.4);
        ctx.fillRect(x * s + rng.range(0, s), y * s + rng.range(0, s), r, r * rng.range(0.5, 1.6));
      }
      ctx.globalAlpha = 1;
    }
  // Grime in the joints.
  ctx.strokeStyle = 'rgba(70,60,45,0.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= n; i++) {
    ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(w, i * s); ctx.stroke();
  }
  // Scuffs (rubber heel marks) and a worn traffic path.
  for (let i = 0; i < 26; i++) {
    ctx.strokeStyle = `rgba(30,26,22,${rng.range(0.08, 0.3)})`;
    ctx.lineWidth = rng.range(1, 3);
    const x = rng.range(0, w), y = rng.range(0, h), a = rng.range(0, 6.28), l = rng.range(6, 26);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.6, y + Math.sin(a + 0.4) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  const g = ctx.createRadialGradient(w * 0.5, h * 0.55, 10, w * 0.5, h * 0.55, w * 0.7);
  g.addColorStop(0, 'rgba(110,95,70,0.0)');
  g.addColorStop(1, 'rgba(110,95,70,0.16)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function backdrop(ctx, w, h) {
  // Mottled DMV blue with a soft hot spot and the faint horizontal ripple of a rolled screen.
  const g = ctx.createRadialGradient(w * 0.5, h * 0.42, 10, w * 0.5, h * 0.45, h * 0.8);
  g.addColorStop(0, '#6d8fc4');
  g.addColorStop(0.6, '#4d6ea8');
  g.addColorStop(1, '#36528a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const rng = new Rng(77);
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = rng.next() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,30,0.05)';
    const r = rng.range(4, 18);
    ctx.beginPath(); ctx.arc(rng.range(0, w), rng.range(0, h), r, 0, 6.29); ctx.fill();
  }
  for (let y = 0; y < h; y += 3) {
    const a = 0.025 * Math.sin(y * 0.09) + 0.02 * Math.sin(y * 0.021);
    ctx.fillStyle = a > 0 ? `rgba(255,255,255,${a})` : `rgba(0,0,20,${-a})`;
    ctx.fillRect(0, y, w, 3);
  }
}

function wall(ctx, w, h) {
  // Institutional two-tone: sage wainscot under a vinyl chair rail, off-white above, scuffed.
  ctx.fillStyle = '#e4ddcb';
  ctx.fillRect(0, 0, w, h);
  const rail = h * 0.62;
  ctx.fillStyle = '#9fab92';
  ctx.fillRect(0, rail, w, h - rail);
  ctx.fillStyle = '#6f6a5c';
  ctx.fillRect(0, rail - 6, w, 8);
  ctx.fillStyle = '#4a4438';
  ctx.fillRect(0, h - 14, w, 14); // rubber cove base
  const rng = new Rng(9);
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(60,50,40,${rng.range(0.02, 0.09)})`;
    ctx.fillRect(rng.range(0, w), rail + rng.range(0, h - rail - 14), rng.range(4, 40), rng.range(1, 3));
  }
  // Paint roller texture.
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = rng.next() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
    ctx.fillRect(rng.range(0, w), rng.range(0, h), 2, 2);
  }
  // Ghost of a removed poster and tape corners.
  ctx.strokeStyle = 'rgba(120,110,90,0.18)';
  ctx.strokeRect(w * 0.08, h * 0.12, w * 0.16, h * 0.26);
}

function servingSign(ctx, w, h, num, label) {
  ctx.fillStyle = '#121012';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#e9e1d0';
  ctx.font = `600 ${h * 0.17}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(label, w / 2, h * 0.24);
  // LED dot matrix digits: draw text into an offscreen mask then sample as dots.
  const txt = `A${String(num).padStart(3, '0')}`;
  const m = document.createElement('canvas');
  m.width = 40; m.height = 14;
  const mc = m.getContext('2d', { willReadFrequently: true });
  mc.fillStyle = '#000'; mc.fillRect(0, 0, 40, 14);
  mc.fillStyle = '#fff';
  mc.font = 'bold 13px monospace';
  mc.textBaseline = 'top';
  mc.textAlign = 'center';
  mc.fillText(txt, 20, 1);
  const d = mc.getImageData(0, 0, 40, 14).data;
  const cw = w / 42, top = h * 0.34;
  for (let y = 0; y < 14; y++)
    for (let x = 0; x < 40; x++) {
      const on = d[(y * 40 + x) * 4] > 90;
      ctx.fillStyle = on ? '#ff3b26' : '#2a0c0a';
      ctx.beginPath();
      ctx.arc(cw * (x + 1.5), top + y * cw, cw * 0.38, 0, 6.29);
      ctx.fill();
    }
}

// ---------------------------------------------------------------------------------------------

export function buildBooth(tier) {
  const root = new THREE.Group();
  root.name = 'dmv-booth';
  const low = tier?.name === 'low';

  // Shared materials.
  const M = {
    floor: new THREE.MeshStandardMaterial({ map: canvasTexture('creator.lino', 512, 512, linoleum, { repeat: true }), roughness: 0.42, metalness: 0 }),
    wall: new THREE.MeshStandardMaterial({ map: canvasTexture('creator.wall', 512, 256, wall), roughness: 0.92 }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0xd9d6cc, roughness: 1 }),
    backdrop: new THREE.MeshStandardMaterial({ map: canvasTexture('creator.backdrop', 256, 512, backdrop), roughness: 0.95, side: THREE.DoubleSide }),
    metal: new THREE.MeshStandardMaterial({ color: 0x2b2c30, roughness: 0.38, metalness: 0.8 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xc9ccd2, roughness: 0.18, metalness: 1 }),
    plastic: new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.55 }),
    counter: new THREE.MeshStandardMaterial({ color: 0x8b7458, roughness: 0.6 }), // wood-grain laminate tone
    counterTop: new THREE.MeshStandardMaterial({ color: 0xcfc4ad, roughness: 0.35 }), // speckled formica
    red: new THREE.MeshStandardMaterial({ color: 0xb3202a, roughness: 0.42 }),
    paper: new THREE.MeshStandardMaterial({ color: 0xf2ecdc, roughness: 0.9 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xdfe8e6, roughness: 0.25, transparent: true, opacity: 0.42, depthWrite: false }),
    clerk: new THREE.MeshStandardMaterial({ color: 0x3c3f4a, roughness: 0.9 }),
    cardigan: new THREE.MeshStandardMaterial({ color: 0x6b5a7a, roughness: 0.95 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xb98a6c, roughness: 0.7 }),
    tube: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 2.2, roughness: 0.4 }),
    ring: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6ea, emissiveIntensity: 1.6, roughness: 0.3 }),
  };
  M.floor.map.repeat.set(3, 3);
  M.floor.map.anisotropy = 8;

  // Static geometry, collected per material and merged.
  const parts = new Map();
  const put = (geo, mat, pos = [0, 0, 0], rot = [0, 0, 0], scale = null) => {
    const o = new THREE.Object3D();
    o.position.set(...pos);
    o.rotation.set(...rot);
    if (scale) o.scale.set(...scale);
    o.updateMatrix();
    geo = geo.index ? geo.toNonIndexed() : geo;
    geo.applyMatrix4(o.matrix);
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    if (!parts.has(mat)) parts.set(mat, []);
    parts.get(mat).push(geo);
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (r1, r2, h, s = 16) => new THREE.CylinderGeometry(r1, r2, h, s);

  // Room shell: floor, back wall, right wall, ceiling.
  put(new THREE.PlaneGeometry(9, 9), M.floor, [0.4, 0, 0.6], [-Math.PI / 2, 0, 0]);
  put(new THREE.PlaneGeometry(9, 3.1), M.wall, [0.4, 1.55, -1.25]);
  put(new THREE.PlaneGeometry(6, 3.1), M.wall, [-2.6, 1.55, 1.2], [0, Math.PI / 2, 0]);
  put(new THREE.PlaneGeometry(6, 3.1), M.wall, [3.4, 1.55, 1.2], [0, -Math.PI / 2, 0]);
  put(new THREE.PlaneGeometry(9, 6), M.ceiling, [0.4, 3.0, 1.2], [Math.PI / 2, 0, 0]);

  // Blue roller backdrop: wall brackets, the roll, the pulled-down screen and its weight bar.
  put(box(1.62, 0.05, 0.12), M.metal, [0, 2.42, -1.17]);
  put(cyl(0.045, 0.045, 1.56, 18), M.backdrop, [0, 2.36, -1.1], [0, 0, Math.PI / 2]);
  put(cyl(0.05, 0.05, 0.03, 18), M.metal, [-0.795, 2.36, -1.1], [0, 0, Math.PI / 2]);
  put(cyl(0.05, 0.05, 0.03, 18), M.metal, [0.795, 2.36, -1.1], [0, 0, Math.PI / 2]);
  const screen = new THREE.PlaneGeometry(1.5, 2.0, 1, 12);
  { // gentle belly so it reads as cloth, not a plane
    const p = screen.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, 0.02 * Math.sin(((p.getY(i) + 1) / 2) * Math.PI));
    screen.computeVertexNormals();
  }
  put(screen, M.backdrop, [0, 1.33, -1.08]);
  put(cyl(0.014, 0.014, 1.52, 8), M.chrome, [0, 0.33, -1.07], [0, 0, Math.PI / 2]);
  put(cyl(0.004, 0.004, 0.12, 6), M.plastic, [0, 0.27, -1.06]); // pull cord

  // Photo stand: tripod pole, camera body, lens, ring light housing (emissive ring separate).
  const cam = new THREE.Group();
  cam.position.set(-0.78, 0, 1.15);
  cam.rotation.y = Math.atan2(0.78, -1.15) + Math.PI; // face the subject
  root.add(cam);
  const camParts = new Map();
  const cput = (geo, mat, pos, rot = [0, 0, 0]) => {
    const o = new THREE.Mesh(geo, mat);
    o.position.set(...pos);
    o.rotation.set(...rot);
    o.castShadow = true;
    cam.add(o);
    return o;
  };
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    cput(cyl(0.012, 0.01, 0.82, 6), M.metal, [Math.cos(a) * 0.2, 0.36, Math.sin(a) * 0.2], [Math.sin(a) * 0.26, 0, -Math.cos(a) * 0.26]);
  }
  cput(cyl(0.018, 0.018, 0.9, 8), M.metal, [0, 1.12, 0]);
  cput(box(0.16, 0.12, 0.2), M.plastic, [0, 1.62, 0]);
  cput(cyl(0.045, 0.05, 0.1, 18), M.plastic, [0, 1.62, -0.14], [Math.PI / 2, 0, 0]);
  cput(new THREE.CircleGeometry(0.038, 20), M.glass, [0, 1.62, -0.191], [Math.PI, 0, 0]);
  cput(new THREE.TorusGeometry(0.2, 0.025, 8, 40), M.plastic, [0, 1.62, -0.08]);
  const ringMesh = cput(new THREE.TorusGeometry(0.2, 0.012, 6, 40), M.ring, [0, 1.62, -0.105]);
  ringMesh.castShadow = false;
  void camParts;

  // Counter (right): laminate body, formica top, frosted window above, clerk behind.
  put(box(1.7, 1.02, 0.6), M.counter, [1.5, 0.51, -0.25]);
  put(box(1.78, 0.04, 0.68), M.counterTop, [1.5, 1.04, -0.25]);
  put(box(1.78, 0.06, 0.02), M.metal, [1.5, 0.03, 0.06]); // kick plate
  put(box(0.04, 1.3, 0.05), M.metal, [0.65, 1.7, -0.45]);
  put(box(0.04, 1.3, 0.05), M.metal, [2.35, 1.7, -0.45]);
  put(box(1.74, 0.05, 0.05), M.metal, [1.5, 2.36, -0.45]);
  put(box(1.7, 1.06, 0.01), M.glass, [1.5, 1.83, -0.45]);
  // Clerk silhouette behind the glass.
  put(new THREE.CapsuleGeometry(0.22, 0.42, 4, 12), M.clerk, [1.8, 1.38, -0.85], [0, 0, 0.06]);
  put(new THREE.SphereGeometry(0.115, 16, 12), M.clerk, [1.83, 1.86, -0.86], [0, 0, 0], [1, 1.15, 1]);
  put(new THREE.SphereGeometry(0.14, 16, 10), M.clerk, [1.85, 1.93, -0.9], [0.4, 0, 0], [1, 0.75, 1]); // hair bun
  // Paperwork: a stamp pad, stacked forms, the pen on its bead chain.
  put(box(0.22, 0.02, 0.3), M.paper, [1.1, 1.07, -0.18], [0, 0.12, 0]);
  put(box(0.21, 0.02, 0.29), M.paper, [1.11, 1.09, -0.19], [0, -0.05, 0]);
  put(box(0.1, 0.025, 0.07), M.red, [1.35, 1.072, -0.05]);
  put(cyl(0.006, 0.006, 0.14, 6), M.plastic, [1.57, 1.07, -0.02], [0, 0, Math.PI / 2 - 0.2]);

  // Take-a-number dispenser on a short chrome post at the counter's front-left corner.
  put(cyl(0.012, 0.012, 0.22, 10), M.chrome, [0.82, 1.17, -0.02]);
  put(cyl(0.05, 0.06, 0.015, 16), M.metal, [0.82, 1.065, -0.02]);
  put(new THREE.SphereGeometry(0.06, 18, 12), M.red, [0.82, 1.31, -0.02], [0, 0, 0], [1, 1.3, 1]);
  put(box(0.04, 0.003, 0.05), M.paper, [0.82, 1.29, 0.045], [-0.4, 0, 0]);

  // Fluorescent troffers: housings + emissive diffusers.
  const troffers = [[0, 0.3], [1.9, 0.3], [0, 2.2], [1.9, 2.2]];
  for (const [x, z] of troffers) {
    put(box(0.62, 0.05, 1.22), M.ceiling, [x, 2.985, z]);
    put(box(0.56, 0.01, 1.16), M.tube, [x, 2.955, z]);
  }

  // NOW SERVING sign (own mesh: its canvas changes).
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 256; signCanvas.height = 96;
  const signTex = new THREE.CanvasTexture(signCanvas);
  signTex.colorSpace = THREE.SRGBColorSpace;
  const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.5 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.27, 0.06), [M.metal, M.metal, M.metal, M.metal, signMat, M.metal]);
  sign.position.set(1.5, 2.62, -1.18);
  root.add(sign);
  put(cyl(0.006, 0.006, 0.25, 6), M.metal, [1.25, 2.86, -1.18]);
  put(cyl(0.006, 0.006, 0.25, 6), M.metal, [1.75, 2.86, -1.18]);
  let signLabel = 'NOW SERVING';
  let serving = 47;
  const drawSign = () => {
    const ctx = signCanvas.getContext('2d');
    servingSign(ctx, 256, 96, serving, signLabel);
    signTex.needsUpdate = true;
  };
  drawSign();

  // Merge statics.
  for (const [mat, geos] of parts) {
    const m = new THREE.Mesh(mergeGeometries(geos, false), mat);
    m.receiveShadow = mat !== M.tube && mat !== M.glass;
    m.castShadow = [M.metal, M.counter, M.clerk, M.red, M.chrome].includes(mat);
    m.matrixAutoUpdate = false;
    root.add(m);
  }

  // Clerk's arm resting on the counter through the window slot (animated: bored finger drum).
  const arm = new THREE.Group();
  arm.position.set(1.7, 1.09, -0.5);
  root.add(arm);
  const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.36, 4, 10), M.cardigan);
  sleeve.rotation.set(Math.PI / 2, 0, 0.5);
  sleeve.position.set(-0.08, 0.02, 0.16);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), M.skin);
  hand.scale.set(1.2, 0.55, 1.5);
  hand.position.set(-0.19, 0.0, 0.36);
  const fingers = [];
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.035, 2, 6), M.skin);
    f.rotation.set(Math.PI / 2, 0, 0.5);
    f.position.set(-0.17 - i * 0.017 + 0.02, 0.0, 0.41 + i * 0.009);
    fingers.push(f);
    arm.add(f);
  }
  for (const m of [sleeve, hand]) { m.castShadow = true; arm.add(m); }

  // Lights: cool overhead fluorescent wash + the ring light key + a warm bounce.
  const hemi = new THREE.HemisphereLight(0xeef3ff, 0x8a7a62, 0.75);
  root.add(hemi);
  const top = new THREE.DirectionalLight(0xf2f6ff, 1.5);
  top.position.set(0.6, 4, 2.2);
  top.target.position.set(0.3, 0.8, -0.3);
  top.castShadow = !!tier?.shadows;
  if (top.castShadow) {
    top.shadow.mapSize.setScalar(Math.min(2048, tier.shadowMapSize || 1024));
    Object.assign(top.shadow.camera, { left: -2.2, right: 3, top: 2.6, bottom: -1.6, near: 0.5, far: 8 });
    top.shadow.bias = -0.0004;
    top.shadow.normalBias = 0.02;
  }
  root.add(top, top.target);
  const ringLight = new THREE.PointLight(0xfff3e6, 1.4, 4.5, 2);
  ringLight.position.set(-0.7, 1.62, 1.05);
  root.add(ringLight);
  const fill = new THREE.PointLight(0xffe2c0, low ? 0 : 0.6, 5, 2);
  fill.position.set(1.4, 1.5, 1.8);
  root.add(fill);

  // Flicker state for one tired tube.
  let flick = 0;
  let flickT = 3;
  let flashV = 0;

  return {
    root,
    materials: M,
    ringLight,
    /** World position of the photo camera's lens. */
    lensWorld: () => new THREE.Vector3(0, 1.62, -0.19).applyMatrix4(cam.matrixWorld),
    setServing(n) { serving = n; drawSign(); },
    setLabel(l) { signLabel = l; drawSign(); },
    /** Pop the ring light (v 0..1, decays in update). */
    flash(v = 1) { flashV = v; },
    update(dt, t) {
      // Finger drum: a rolling wave every ~1.6 s, then a bored pause.
      const cyc = t % 2.4;
      fingers.forEach((f, i) => {
        const k = Math.max(0, Math.sin((cyc - i * 0.08) * 9) * (cyc < 0.8 ? 1 : 0));
        f.position.y = 0.012 * k;
      });
      arm.rotation.y = 0.04 * Math.sin(t * 0.37);
      // Tube flicker: occasional stutter on the fixture furthest back.
      flickT -= dt;
      if (flickT < 0) { flick = 0.35; flickT = 4 + Math.random() * 7; }
      flick = Math.max(0, flick - dt);
      const stutter = flick > 0 && Math.sin(t * 90) > 0 ? 0.55 : 1;
      M.tube.emissiveIntensity = 2.2 * stutter;
      top.intensity = 1.5 * (0.92 + 0.08 * stutter);
      // Ring light flash decay.
      flashV = Math.max(0, flashV - dt * 3.5);
      ringLight.intensity = 1.4 + flashV * 3.5;
      M.ring.emissiveIntensity = 1.6 + flashV * 8;
    },
    dispose() {
      root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
      signTex.dispose();
      signMat.dispose();
      for (const m of Object.values(M)) m.dispose();
    },
  };
}
