// SOUNDGUARD SG-1: the 3D studio rack unit on the home screen.
// Real scanned metal (ambientCG), real studio light (Poly Haven HDRI), real physics-ish VU needles.
// Built into ui/device.js by tools/build-ui.sh (esbuild + three.js).
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const W = 4.6, H = 1.68, D = 0.16;
const LABEL = '"Michroma", "Segoe UI", Arial, sans-serif';

function rrShape(w, h, r, cx = 0, cy = 0) {
  const s = new THREE.Shape();
  const x = cx - w / 2, y = cy - h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function rrPath(w, h, r) {
  const p = new THREE.Path();
  const x = -w / 2, y = -h / 2;
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r);
  p.lineTo(x + w, y + h - r); p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h); p.quadraticCurveTo(x, y + h, x, y + h - r);
  p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y);
  return p;
}

// VU scale: position 0..1 for a VU value (real VU meters are linear in voltage)
const vuPos = (db) => (Math.pow(10, db / 20) - 0.1) / (Math.pow(10, 3 / 20) - 0.1);
const NEEDLE_A = 0.86; // rad each side

export async function createDevice(canvas, opt = {}) {
  const base = opt.base || 'assets/';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07090b);
  const camera = new THREE.PerspectiveCamera(20, 2.6, 0.1, 100);

  // ---------- fonts + assets ----------
  try {
    const ff = new FontFace('Michroma', `url(${base}michroma.ttf)`);
    document.fonts.add(await ff.load());
  } catch (e) { /* falls back to system font */ }
  const tl = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const tex = (f, srgb, rep) => new Promise((res) => tl.load(base + f, (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (rep) t.repeat.set(rep[0], rep[1]);
    t.anisotropy = maxAniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    res(t);
  }, undefined, () => res(null)));
  const panelRep = [W / 1.15, H / 1.15];
  const [mCol, mNrm, mRgh, kCol, kNrm, kRgh, paper, hdr] = await Promise.all([
    tex('metal_col.jpg', true, panelRep), tex('metal_nrm.jpg', false, panelRep), tex('metal_rgh.jpg', false, panelRep),
    tex('knob_col.jpg', true), tex('knob_nrm.jpg', false), tex('knob_rgh.jpg', false), tex('paper.jpg', true),
    new Promise((res) => new RGBELoader().load(base + 'studio.hdr', res, undefined, () => res(null))),
  ]);
  if (hdr) {
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromEquirectangular(hdr).texture;
    hdr.dispose(); pm.dispose();
  }

  // ---------- materials ----------
  const M = {
    panel: new THREE.MeshStandardMaterial({ color: 0x858b93, map: mCol, normalMap: mNrm, normalScale: new THREE.Vector2(1.0, 1.0), roughnessMap: mRgh, roughness: 0.58, metalness: 0.9, envMapIntensity: 1.05 }),
    blackAnod: new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: 0.75, roughness: 0.32, envMapIntensity: 1.0 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xd9dde2, metalness: 1, roughness: 0.16, envMapIntensity: 1.25 }),
    satin: new THREE.MeshStandardMaterial({ color: 0xc4c9cf, metalness: 1, roughness: 0.32, envMapIntensity: 1.1 }),
    hole: new THREE.MeshStandardMaterial({ color: 0x030303, metalness: 0, roughness: 0.9 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x111214, metalness: 0, roughness: 0.62, envMapIntensity: 0.6 }),
    matteBlack: new THREE.MeshStandardMaterial({ color: 0x050506, metalness: 0.05, roughness: 0.92 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.16, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 2.2, depthWrite: false }),
    vfdGlass: new THREE.MeshPhysicalMaterial({ color: 0x0c2e27, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.3, clearcoat: 1, envMapIntensity: 1.4, depthWrite: false }),
    knobCap: new THREE.MeshStandardMaterial({ color: 0xeef1f4, map: kCol, normalMap: kNrm, normalScale: new THREE.Vector2(0.25, 0.25), roughness: 0.3, metalness: 1, envMapIntensity: 1.35 }),
  };

  const root = new THREE.Group();
  scene.add(root);
  const add = (mesh, x = 0, y = 0, z = 0, parent = root, shadow = true) => {
    mesh.position.set(x, y, z);
    if (shadow) { mesh.castShadow = true; mesh.receiveShadow = true; }
    parent.add(mesh);
    return mesh;
  };

  // backdrop (a dark wall the unit hangs on: catches its shadow)
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.95, metalness: 0 }));
  wall.position.z = -D - 0.02;
  wall.receiveShadow = true;
  scene.add(wall);

  // the panel
  const panel = add(new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 5, 0.035), M.panel), 0, 0, -D / 2);
  panel.castShadow = true;

  // ---------- lights ----------
  const key = new THREE.DirectionalLight(0xfff3e6, 2.1);
  key.position.set(-2.5, 3.2, 4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -3.2; key.shadow.camera.right = 3.2; key.shadow.camera.top = 1.8; key.shadow.camera.bottom = -1.8;
  key.shadow.camera.near = 0.5; key.shadow.camera.far = 12;
  key.shadow.radius = 4; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.01;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbfd6ff, 0.35);
  fill.position.set(3, -1, 3);
  scene.add(fill);
  scene.add(new THREE.AmbientLight(0xffffff, 0.06));

  // ---------- helpers ----------
  function bezel(w, h, r, t, depth, mat) {
    const s = rrShape(w + 2 * t, h + 2 * t, r + t);
    s.holes.push(rrPath(w, h, r));
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 10 });
    return new THREE.Mesh(g, mat);
  }
  function screw(x, y, parent = root) {
    const g = new THREE.Group();
    const prof = [new THREE.Vector2(0, 0.017), new THREE.Vector2(0.02, 0.016), new THREE.Vector2(0.031, 0.009), new THREE.Vector2(0.034, 0.002), new THREE.Vector2(0.034, 0)];
    const head = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), M.satin);
    head.rotation.x = Math.PI / 2;
    head.castShadow = true;
    g.add(head);
    const sl = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8, metalness: 0.4 });
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.008, 0.01), sl);
    const b = a.clone(); b.rotation.z = Math.PI / 2;
    a.position.z = b.position.z = 0.014;
    g.add(a, b);
    g.rotation.z = Math.random() * Math.PI;
    g.position.set(x, y, 0.001);
    parent.add(g);
    return g;
  }
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    draw(ctx, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return { t, c, ctx };
  }

  // ---------- rack ears: slots + screws ----------
  for (const sx of [-1, 1]) {
    const ex = sx * (W / 2 - 0.11);
    for (const sy of [-1, 1]) {
      const slot = add(new THREE.Mesh(new THREE.ExtrudeGeometry(rrShape(0.1, 0.2, 0.05), { depth: 0.004, bevelEnabled: false }), M.hole), ex, sy * 0.56, 0.0005, root, false);
      slot.receiveShadow = true;
      screw(ex, sy * 0.56 + (sy > 0 ? -0.03 : 0.03));
    }
  }

  // ---------- VU meters ----------
  const FACE_W = 0.86, FACE_H = 0.56;
  function vuFace(label) {
    const cw = 1024, ch = Math.round(1024 * FACE_H / FACE_W);
    const ppu = cw / FACE_W;
    const px = cw / 2, py = ch + 0.07 * ppu; // pivot in canvas
    return canvasTex(cw, ch, (x) => {
      if (paper && paper.image) {
        x.drawImage(paper.image, 0, 0, cw, ch);
        x.fillStyle = 'rgba(244, 214, 160, 0.62)'; x.fillRect(0, 0, cw, ch);
      } else { x.fillStyle = '#f3e3bd'; x.fillRect(0, 0, cw, ch); }
      // light falloff (backlight from below)
      const gr = x.createRadialGradient(cw / 2, ch * 1.1, 60, cw / 2, ch * 0.9, cw * 0.75);
      gr.addColorStop(0, 'rgba(255,240,200,0.0)'); gr.addColorStop(1, 'rgba(70,40,10,0.33)');
      x.fillStyle = gr; x.fillRect(0, 0, cw, ch);
      const at = (db, r) => {
        const a = (vuPos(db) * 2 - 1) * NEEDLE_A;
        return [px + r * Math.sin(a), py - r * Math.cos(a)];
      };
      const R = 0.43 * ppu;
      x.lineCap = 'butt';
      // main arc
      x.strokeStyle = '#1c1712'; x.lineWidth = 4;
      x.beginPath();
      for (let d = -20; d <= 0.001; d += 0.25) { const [a, b] = at(d, R); d === -20 ? x.moveTo(a, b) : x.lineTo(a, b); }
      x.stroke();
      x.strokeStyle = '#c4271d'; x.lineWidth = 14;
      x.beginPath();
      for (let d = 0; d <= 3.001; d += 0.1) { const [a, b] = at(d, R + 7); d === 0 ? x.moveTo(a, b) : x.lineTo(a, b); }
      x.stroke();
      // ticks + numbers
      const marks = [-20, -10, -7, -5, -3, -2, -1, 0, 1, 2, 3];
      for (const m of marks) {
        const [a1, b1] = at(m, R - 2), [a2, b2] = at(m, R + 34);
        x.strokeStyle = m > 0 ? '#c4271d' : '#1c1712'; x.lineWidth = m === 0 ? 6 : 4;
        x.beginPath(); x.moveTo(a1, b1); x.lineTo(a2, b2); x.stroke();
        const [tx, ty] = at(m, R + 68);
        x.fillStyle = m > 0 ? '#c4271d' : '#1c1712';
        x.font = `600 ${m === 0 ? 40 : 32}px ${LABEL}`;
        x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(m > 0 ? '+' + m : String(Math.abs(m)), tx, ty);
      }
      for (let d = -20; d < 3; d += 1) { // minor ticks
        if (marks.includes(d)) continue;
        if (d < -10 && d % 2) continue;
        const [a1, b1] = at(d, R - 2), [a2, b2] = at(d, R + 16);
        x.strokeStyle = d > 0 ? '#c4271d' : '#1c1712'; x.lineWidth = 2.5;
        x.beginPath(); x.moveTo(a1, b1); x.lineTo(a2, b2); x.stroke();
      }
      // percent scale (inner)
      x.strokeStyle = '#1c1712'; x.lineWidth = 2;
      x.beginPath();
      for (let d = -20; d <= 3.001; d += 0.25) { const [a, b] = at(d, R - 46); d === -20 ? x.moveTo(a, b) : x.lineTo(a, b); }
      x.stroke();
      for (let p = 0; p <= 100; p += 20) {
        const db = 20 * Math.log10(p / 100 * (Math.pow(10, 3 / 20) - 0.1) + 0.1);
        const [a1, b1] = at(db, R - 46), [a2, b2] = at(db, R - 60);
        x.beginPath(); x.moveTo(a1, b1); x.lineTo(a2, b2); x.stroke();
        const [tx, ty] = at(db, R - 82);
        x.font = `500 20px ${LABEL}`; x.fillStyle = '#3a3128';
        x.fillText(String(p), tx, ty);
      }
      x.fillStyle = '#1c1712'; x.font = `600 66px ${LABEL}`; x.textAlign = 'center';
      x.fillText('VU', cw / 2, ch * 0.6);
      x.font = `500 15px ${LABEL}`; x.textAlign = 'left'; x.fillStyle = '#6a5d4d';
      x.fillText('SG-1', 34, ch * 0.7);
    });
  }

  function makeMeter(cx, cy, label) {
    const g = new THREE.Group();
    g.position.set(cx, cy, 0);
    root.add(g);
    const face = vuFace(label);
    const faceMat = new THREE.MeshStandardMaterial({ map: face.t, emissiveMap: face.t, emissive: new THREE.Color(0xffb866), emissiveIntensity: 0.3, roughness: 0.85, metalness: 0 });
    add(new THREE.Mesh(new THREE.PlaneGeometry(FACE_W, FACE_H), faceMat), 0, 0, 0.004, g, false).receiveShadow = true;
    // inner walls (depth)
    add(bezel(FACE_W, FACE_H, 0.02, 0.035, 0.05, M.blackAnod), 0, 0, 0, g);
    // needle
    const pivot = new THREE.Group();
    pivot.position.set(0, -FACE_H / 2 - 0.07, 0.016);
    g.add(pivot);
    const nGeo = new THREE.BoxGeometry(0.0055, 0.52, 0.002);
    nGeo.translate(0, 0.26, 0);
    const needle = new THREE.Mesh(nGeo, new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.5 }));
    needle.castShadow = true;
    pivot.add(needle);
    const tipGeo = new THREE.BoxGeometry(0.0055, 0.09, 0.0021);
    tipGeo.translate(0, 0.475, 0.0002);
    pivot.add(new THREE.Mesh(tipGeo, new THREE.MeshStandardMaterial({ color: 0xb01e16, roughness: 0.5 })));
    // hood over the pivot
    const hood = add(new THREE.Mesh(new RoundedBoxGeometry(FACE_W, 0.11, 0.03, 3, 0.01), M.matteBlack), 0, -FACE_H / 2 + 0.05, 0.025, g);
    hood.castShadow = false;
    const screwHood = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.006, 16), M.satin);
    screwHood.rotation.x = Math.PI / 2;
    add(screwHood, 0, -FACE_H / 2 + 0.05, 0.042, g, false);
    // glass
    add(new THREE.Mesh(new THREE.PlaneGeometry(FACE_W + 0.02, FACE_H + 0.02), M.glass), 0, 0, 0.052, g, false);
    // backlight spill
    const lamp = new THREE.PointLight(0xffb45a, 0.1, 0.5, 2);
    lamp.position.set(0, -FACE_H / 2 + 0.06, 0.03);
    g.add(lamp);
    return { g, pivot, x: 0, v: 0, faceMat, lamp };
  }

  // ---------- LED ladders ----------
  function makeLadder(cx, cy) {
    const g = new THREE.Group();
    g.position.set(cx, cy, 0);
    root.add(g);
    const n = 12, step = 0.047;
    const h = n * step + 0.03;
    add(bezel(0.07, h, 0.012, 0.018, 0.022, M.blackAnod), 0, 0, 0, g);
    add(new THREE.Mesh(new THREE.PlaneGeometry(0.07, h), M.hole), 0, 0, 0.003, g, false);
    const leds = [];
    for (let i = 0; i < n; i++) {
      const col = i >= 10 ? 0xff2a22 : i >= 8 ? 0xffa21e : 0x3dff6a;
      const m = new THREE.MeshStandardMaterial({ color: 0x0f1110, emissive: new THREE.Color(col), emissiveIntensity: 0.05, roughness: 0.25, metalness: 0 });
      const led = add(new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.03, 0.016, 2, 0.006), m), 0, -h / 2 + 0.03 + i * step, 0.01, g, false);
      leds.push(led);
    }
    return { g, leds, lvl: 0, peak: 0, peakT: 0 };
  }

  // ---------- knobs ----------
  function makeKnob(cx, cy) {
    const g = new THREE.Group();
    g.position.set(cx, cy, 0);
    root.add(g);
    const spin = new THREE.Group();
    g.add(spin);
    const prof = [[0, 0], [0.19, 0], [0.19, 0.012], [0.158, 0.02], [0.152, 0.03], [0.15, 0.088], [0.138, 0.101], [0, 0.101]].map(([r, y]) => new THREE.Vector2(r, y));
    const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), M.blackAnod);
    body.rotation.x = Math.PI / 2;
    body.castShadow = true; body.receiveShadow = true;
    spin.add(body);
    // knurl ridges
    const ridge = new THREE.BoxGeometry(0.008, 0.012, 0.055);
    for (let i = 0; i < 48; i++) {
      const a = i / 48 * Math.PI * 2;
      const r = new THREE.Mesh(ridge, M.blackAnod);
      r.position.set(Math.cos(a) * 0.151, Math.sin(a) * 0.151, 0.058);
      r.rotation.z = a;
      spin.add(r);
    }
    const cap = new THREE.Mesh(new THREE.CircleGeometry(0.136, 64), M.knobCap);
    cap.position.z = 0.1015;
    spin.add(cap);
    const ptr = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.075, 0.003), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.4 }));
    ptr.position.set(0, 0.088, 0.103);
    spin.add(ptr);
    // hit target
    const hit = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.z = 0.11;
    g.add(hit);
    return { g, spin, hit, v: 0.5, shown: 0.5, drag: false };
  }

  // ---------- toggle switches ----------
  function makeToggle(cx, cy) {
    const g = new THREE.Group();
    g.position.set(cx, cy, 0);
    root.add(g);
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.02, 6), M.chrome);
    nut.rotation.x = Math.PI / 2; nut.position.z = 0.01; nut.castShadow = true;
    g.add(nut);
    const bush = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.035, 28), M.satin);
    bush.rotation.x = Math.PI / 2; bush.position.z = 0.035; bush.castShadow = true;
    g.add(bush);
    const lever = new THREE.Group();
    lever.position.z = 0.05;
    g.add(lever);
    const lg = new THREE.CylinderGeometry(0.024, 0.016, 0.21, 24);
    lg.translate(0, 0.105, 0);
    const bat = new THREE.Mesh(lg, M.chrome);
    bat.castShadow = true;
    lever.add(bat);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.027, 24, 16), M.chrome);
    tip.position.y = 0.21; tip.castShadow = true;
    lever.add(tip);
    const hit = new THREE.Mesh(new THREE.CircleGeometry(0.11, 20), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.z = 0.12;
    g.add(hit);
    return { g, lever, hit, on: true, a: Math.PI / 3 };
  }

  // ---------- illuminated push buttons ----------
  function makeButton(cx, cy, w, h, text, glow) {
    const g = new THREE.Group();
    g.position.set(cx, cy, 0);
    root.add(g);
    add(new THREE.Mesh(new RoundedBoxGeometry(w + 0.04, h + 0.04, 0.03, 3, 0.012), M.blackAnod), 0, 0, 0.012, g);
    const lt = canvasTex(512, Math.round(512 * h / w), (x, cw, ch) => {
      const gr = x.createLinearGradient(0, 0, 0, ch);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#dfe6e2');
      x.fillStyle = gr; x.fillRect(0, 0, cw, ch);
      x.fillStyle = '#0d0f10';
      let fs = Math.round(ch * 0.3);
      x.font = `600 ${fs}px ${LABEL}`;
      while (x.measureText(text).width > cw * 0.82 && fs > 10) { fs--; x.font = `600 ${fs}px ${LABEL}`; }
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(text, cw / 2, ch / 2 + 2);
    });
    const mat = new THREE.MeshPhysicalMaterial({ color: 0x5a5f63, map: lt.t, emissive: new THREE.Color(glow), emissiveMap: lt.t, emissiveIntensity: 0.03, roughness: 0.28, clearcoat: 0.6, metalness: 0 });
    const cap = add(new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.045, 3, 0.014), mat), 0, 0, 0.04, g);
    const hit = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.04, h + 0.04), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.z = 0.08;
    g.add(hit);
    return { g, cap, mat, hit, lit: 0, target: 0, press: 0, glow };
  }

  // ---------- jewel lamps ----------
  function makeLamp(cx, cy, col) {
    const g = new THREE.Group();
    g.position.set(cx, cy, 0);
    root.add(g);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.013, 16, 40), M.chrome);
    ring.position.z = 0.01; ring.castShadow = true;
    g.add(ring);
    const mat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(col).multiplyScalar(0.35), emissive: new THREE.Color(col), emissiveIntensity: 0.06, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, metalness: 0 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.044, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    dome.rotation.x = Math.PI / 2; dome.position.z = 0.008;
    g.add(dome);
    // facets look: small inner light
    const pl = new THREE.PointLight(col, 0, 0.5, 2);
    pl.position.z = 0.06;
    g.add(pl);
    return { g, mat, pl, on: 0, target: 0, blink: false };
  }

  // ---------- VFD display ----------
  const VW = 1.3, VH = 0.4, COLS = 156, ROWS = 48;
  const vfd = canvasTex(COLS * 10, ROWS * 10, () => {});
  const vfdSmall = document.createElement('canvas');
  vfdSmall.width = 2400; vfdSmall.height = ROWS;
  const vs = vfdSmall.getContext('2d', { willReadFrequently: true });
  const vfdMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissiveMap: vfd.t, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.95, roughness: 0.6 });
  {
    const g = new THREE.Group();
    g.position.set(0, 0.25, 0);
    root.add(g);
    add(new THREE.Mesh(new THREE.PlaneGeometry(VW, VH), vfdMat), 0, 0, 0.004, g, false);
    add(bezel(VW, VH, 0.018, 0.035, 0.045, M.blackAnod), 0, 0, 0, g);
    add(new THREE.Mesh(new THREE.PlaneGeometry(VW + 0.02, VH + 0.02), M.vfdGlass), 0, 0, 0.047, g, false);
    const vl = new THREE.PointLight(0x55ffd0, 0.08, 0.6, 2);
    vl.position.set(0, 0, 0.12);
    g.add(vl);
  }
  let vfdText = { a: '', b: '' }, vfdScroll = -60, vfdBWidth = 0, vfdDirty = true;
  function vfdLayout() {
    vs.clearRect(0, 0, vfdSmall.width, ROWS);
    vs.fillStyle = '#fff'; vs.textBaseline = 'alphabetic';
    let fa = 19;
    vs.font = `bold ${fa}px Arial, sans-serif`;
    while (vs.measureText(vfdText.a.toUpperCase()).width > COLS - 6 && fa > 11) { fa--; vs.font = `bold ${fa}px Arial, sans-serif`; }
    vfdFA = fa;
    vs.fillText(vfdText.a.toUpperCase(), 0, 21);
    vs.font = '12px Arial, sans-serif';
    vfdBWidth = Math.ceil(vs.measureText(vfdText.b).width) + 40;
    vs.fillText(vfdText.b, 0, 42);
    vfdDirty = true;
  }
  let vfdBits = null, vfdAW = 0, vfdFA = 19;
  function vfdDraw() {
    if (vfdDirty) {
      vfdBits = vs.getImageData(0, 0, vfdSmall.width, ROWS).data;
      vs.font = `bold ${vfdFA}px Arial, sans-serif`;
      vfdAW = Math.ceil(vs.measureText(vfdText.a.toUpperCase()).width);
      vfdDirty = false;
    }
    const x = vfd.ctx, cw = vfd.c.width, ch = vfd.c.height, cs = 10;
    x.fillStyle = '#020a08'; x.fillRect(0, 0, cw, ch);
    const scrollB = vfdBWidth - 40 > COLS - 4;
    const offA = Math.max(0, Math.floor((COLS - vfdAW) / 2));
    const off = scrollB ? Math.max(0, Math.floor(vfdScroll)) % vfdBWidth : 0;
    const lit = [], dim = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        let on;
        if (r < 27) {
          const sx = c - offA;
          on = sx >= 0 && sx < vfdSmall.width && vfdBits[(r * vfdSmall.width + sx) * 4 + 3] > 110;
        } else {
          let sx = c + off;
          if (scrollB) sx %= vfdBWidth;
          on = sx < vfdSmall.width && vfdBits[(r * vfdSmall.width + sx) * 4 + 3] > 110;
        }
        (on ? lit : dim).push(c, r);
      }
    }
    x.fillStyle = '#0b1d18';
    for (let i = 0; i < dim.length; i += 2) x.fillRect(dim[i] * cs + 2, dim[i + 1] * cs + 2, 6, 6);
    x.fillStyle = '#86ffe0';
    x.shadowColor = 'rgba(80,255,210,0.6)'; x.shadowBlur = 4;
    for (let i = 0; i < lit.length; i += 2) x.fillRect(lit[i] * cs + 1.5, lit[i + 1] * cs + 1.5, 7, 7);
    x.shadowBlur = 0;
    vfd.t.needsUpdate = true;
  }

  // ---------- jack + plug ----------
  const jack = new THREE.Group();
  jack.position.set(-1.95, -0.45, 0);
  root.add(jack);
  {
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.016, 6), M.chrome);
    nut.rotation.x = Math.PI / 2; nut.position.z = 0.008; nut.castShadow = true;
    jack.add(nut);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 32), M.satin);
    ring.rotation.x = Math.PI / 2; ring.position.z = 0.02;
    jack.add(ring);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.018, 24), M.hole);
    hole.position.z = 0.0305;
    jack.add(hole);
  }
  const plug = new THREE.Group();
  jack.add(plug);
  {
    const seg = (r1, r2, len, mat, z) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, len, 32), mat);
      m.rotation.x = Math.PI / 2; m.position.z = z + len / 2; m.castShadow = true;
      plug.add(m);
      return m;
    };
    seg(0.022, 0.022, 0.02, M.chrome, 0.03);
    seg(0.036, 0.038, 0.13, M.rubber, 0.05);
    seg(0.038, 0.034, 0.012, M.rubber, 0.18);
    seg(0.03, 0.017, 0.07, M.rubber, 0.192);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0.255), new THREE.Vector3(0, -0.02, 0.33), new THREE.Vector3(0.02, -0.2, 0.42), new THREE.Vector3(0.05, -0.6, 0.44), new THREE.Vector3(0.08, -1.4, 0.4)]);
    const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.016, 14, false), M.rubber);
    cable.castShadow = true;
    plug.add(cable);
    // grip lines
    for (let i = 0; i < 6; i++) {
      const gr = new THREE.Mesh(new THREE.TorusGeometry(0.0375, 0.003, 8, 32), M.rubber);
      gr.position.z = 0.07 + i * 0.018;
      plug.add(gr);
    }
  }

  // ---------- silkscreen (printed white legends) ----------
  const SW = 4096, SH = Math.round(4096 * H / W);
  const wx = (x) => (x + W / 2) / W * SW, wy = (y) => (H / 2 - y) / H * SH, wl = (l) => l / W * SW;
  const silk = canvasTex(SW, SH, () => {});
  function drawSilk(alertRed) {
    const x = silk.ctx;
    x.clearRect(0, 0, SW, SH);
    x.fillStyle = 'rgba(236,240,243,0.92)'; x.strokeStyle = 'rgba(236,240,243,0.85)';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const t = (s, px, py, size, w = 500, sp = 0.18) => {
      x.font = `${w} ${size}px ${LABEL}`;
      if ('letterSpacing' in x) x.letterSpacing = `${size * sp}px`;
      x.fillText(s, wx(px), wy(py));
    };
    // brand
    t('SOUNDGUARD', 0, 0.66, 74, 600, 0.32);
    t('SG-1  ·  HEADPHONE + MIC PROTECTION', 0, 0.535, 30, 400, 0.22);
    // sections
    t('HEADPHONES', -1.31, 0.66, 40, 600, 0.3);
    t('MICROPHONE', 1.31, 0.66, 40, 600, 0.3);
    t('LEVEL', -0.79, 0.59, 22, 500, 0.2); t('LEVEL', 0.79, 0.59, 22, 500, 0.2);
    // lamps
    t('WATCH', -0.36, -0.165, 24); t('FIX', 0, -0.165, 24); t('ALERT', 0.36, -0.165, 24);
    // controls
    for (const s of [-1, 1]) {
      t('VOLUME', s * 1.5, -0.2, 24);
      t('DRAG', s * 1.5, -0.74, 18, 400, 0.25);
      // knob scale
      for (let i = 0; i <= 10; i++) {
        const a = (135 - i * 27) * Math.PI / 180;
        const r1 = 0.215, r2 = i % 5 === 0 ? 0.25 : 0.237;
        x.lineWidth = i % 5 === 0 ? 7 : 5;
        x.beginPath();
        x.moveTo(wx(s * 1.5 + Math.cos(a + Math.PI / 2) * r1), wy(-0.45 + Math.sin(a + Math.PI / 2) * r1));
        x.lineTo(wx(s * 1.5 + Math.cos(a + Math.PI / 2) * r2), wy(-0.45 + Math.sin(a + Math.PI / 2) * r2));
        x.stroke();
        if (i === 0 || i === 10) {
          const r3 = 0.285;
          t(String(i), s * 1.5 + Math.cos(a + Math.PI / 2) * r3, -0.45 + Math.sin(a + Math.PI / 2) * r3, 26, 500, 0);
        }
      }
      t('ON', s * 1.1, -0.27, 24); t('MUTE', s * 1.1, -0.64, 24);
    }
    t('PHONES', -1.95, -0.6, 22); t('POWER', 1.95, -0.6, 22);
    // frame lines around the 3 sections
    x.lineWidth = 3; x.strokeStyle = 'rgba(236,240,243,0.35)';
    const box = (x1, y1, x2, y2) => { x.strokeRect(wx(x1), wy(y2), wx(x2) - wx(x1), wy(y1) - wy(y2)); };
    box(-1.98, -0.72, -0.62, 0.74);
    box(0.62, -0.72, 1.98, 0.74);
    silk.t.needsUpdate = true;
  }
  drawSilk();
  const silkMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: silk.t, transparent: true, roughness: 0.62, metalness: 0, depthWrite: false }));
  silkMesh.position.z = 0.0012;
  silkMesh.receiveShadow = true;
  root.add(silkMesh);
  // redraw once the label font is surely ready
  document.fonts && document.fonts.ready.then(() => drawSilk());

  // ---------- build the unit ----------
  const meters = { out: makeMeter(-1.42, 0.22, 'HEADPHONES'), in: makeMeter(1.42, 0.22, 'MICROPHONE') };
  meters.out.g.position.x = -1.38; meters.in.g.position.x = 1.38;
  const ladders = { out: makeLadder(-0.8, 0.22), in: makeLadder(0.8, 0.22) };
  const knobs = { out: makeKnob(-1.5, -0.45), in: makeKnob(1.5, -0.45) };
  const toggles = { out: makeToggle(-1.1, -0.45), in: makeToggle(1.1, -0.45) };
  const buttons = {
    testOut: makeButton(-0.76, -0.45, 0.3, 0.15, 'TEST', 0x7dff9a),
    testIn: makeButton(0.76, -0.45, 0.3, 0.15, 'TEST MIC', 0x7dff9a),
    fix: makeButton(0, -0.46, 0.62, 0.17, 'FIX NOW', 0x6dffb0),
  };
  const lamps = { watch: makeLamp(-0.36, -0.08, 0x2dff62), fix: makeLamp(0, -0.08, 0xffa11a), alert: makeLamp(0.36, -0.08, 0xff2318), power: makeLamp(1.95, -0.45, 0x3d8bff) };
  lamps.power.target = 1;
  for (const k of ['out', 'in']) {
    knobs[k].spin.rotation.z = (135 - 0.5 * 270) * Math.PI / 180;
  }

  // ---------- post ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 256), 0.5, 0.35, 0.86);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------- size + camera ----------
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  function resize() {
    const w = canvas.clientWidth || 800, h = canvas.clientHeight || 300;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.setSize(w, h);
    camera.aspect = w / h;
    const fitW = (W * 1.07) / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / camera.aspect;
    const fitH = (H * 1.2) / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.userData.dist = Math.max(fitW, fitH);
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // ---------- interaction ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hits = () => [knobs.out.hit, knobs.in.hit, toggles.out.hit, toggles.in.hit, buttons.testOut.hit, buttons.testIn.hit, buttons.fix.hit];
  const who = (obj) => {
    for (const k of ['out', 'in']) {
      if (obj === knobs[k].hit) return ['knob', k];
      if (obj === toggles[k].hit) return ['toggle', k];
    }
    if (obj === buttons.testOut.hit) return ['button', 'testOut'];
    if (obj === buttons.testIn.hit) return ['button', 'testIn'];
    if (obj === buttons.fix.hit) return ['button', 'fix'];
    return null;
  };
  const pick = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(hits(), false)[0];
    return h ? who(h.object) : null;
  };
  const api = { on: {} };
  const fire = (name, ...a) => { try { api.on[name] && api.on[name](...a); } catch (e) { console.error(e); } };
  let dragging = null, lastY = 0, lastX = 0, enabled = { out: true, in: true };
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (dragging) {
      const kn = knobs[dragging];
      const dv = ((lastY - e.clientY) + (e.clientX - lastX)) / 260;
      lastY = e.clientY; lastX = e.clientX;
      const before = Math.round(kn.v * 20);
      kn.v = Math.max(0, Math.min(1, kn.v + dv));
      if (Math.round(kn.v * 20) !== before) fire('sound', 'tick');
      fire('volume', dragging, kn.v, false);
      return;
    }
    const p = pick(e);
    canvas.style.cursor = p && (p[0] === 'button' || enabled[p[1]]) ? (p[0] === 'knob' ? 'grab' : 'pointer') : 'default';
  });
  canvas.addEventListener('pointerleave', () => { mouse.tx = 0; mouse.ty = 0; });
  canvas.addEventListener('pointerdown', (e) => {
    const p = pick(e);
    if (!p) return;
    if (p[0] === 'knob' && enabled[p[1]]) {
      dragging = p[1]; knobs[p[1]].drag = true; lastY = e.clientY; lastX = e.clientX;
      canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing';
      fire('sound', 'knob');
    } else if (p[0] === 'toggle' && enabled[p[1]]) {
      const tg = toggles[p[1]];
      tg.on = !tg.on; tg.hold = performance.now() + 2500;
      fire('sound', tg.on ? 'sw_on' : 'sw_off');
      fire('mute', p[1], !tg.on);
    } else if (p[0] === 'button') {
      const b = buttons[p[1]];
      b.press = 1;
      fire('sound', 'btn_down');
      setTimeout(() => { fire('sound', 'btn_up'); }, 140);
      fire('press', p[1]);
    }
  });
  const endDrag = (e) => {
    if (!dragging) return;
    const k = dragging;
    knobs[k].drag = false; dragging = null;
    knobs[k].hold = performance.now() + 2500;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    fire('volume', k, knobs[k].v, true);
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (e) => {
    const p = pick(e);
    if (!p || p[0] !== 'knob' || !enabled[p[1]]) return;
    e.preventDefault();
    const kn = knobs[p[1]];
    kn.v = Math.max(0, Math.min(1, kn.v + (e.deltaY < 0 ? 0.02 : -0.02)));
    kn.hold = performance.now() + 2500;
    fire('sound', 'tick');
    clearTimeout(kn.wt);
    kn.wt = setTimeout(() => fire('volume', p[1], kn.v, true), 350);
  }, { passive: false });

  // ---------- state from the app ----------
  const st = { level: 'ok', fixing: false, auto: true, micMissing: false, plugged: true, needRestart: false, testOut: false, testIn: false, out: 0, in: 0 };
  api.setState = (s) => {
    Object.assign(st, s);
    const a = s.title || '', b = s.sub || '';
    if (a !== vfdText.a || b !== vfdText.b) { vfdText = { a, b }; vfdScroll = -60; vfdLayout(); }
    for (const k of ['out', 'in']) {
      const d = s[k + 'Dev'];
      enabled[k] = !!d;
      if (d) {
        if (!knobs[k].drag && !(knobs[k].hold > performance.now())) knobs[k].v = d.volume;
        if (!(toggles[k].hold > performance.now())) toggles[k].on = !d.muted;
      }
    }
  };
  api.setLevels = (o, i) => { st.out = o; st.in = i; };
  api.dispose = () => { running = false; ro.disconnect(); renderer.dispose(); };

  // ---------- animation ----------
  const lvl01 = (p) => (p <= 0.0005 ? 0 : Math.max(0, Math.min(1, (20 * Math.log10(p) + 48) / 48)));
  let last = performance.now(), running = true, vfdT = 0;
  vfdLayout();
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (document.hidden || !canvas.offsetParent || canvas.clientWidth < 10) { last = now; return; } // not on screen: don't render
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    // camera parallax
    mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 3);
    mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 3);
    const dist = camera.userData.dist || 6;
    camera.position.set(mouse.x * 0.35, 0.18 - mouse.y * 0.22, dist);
    camera.lookAt(0, 0, 0);
    // needles: spring with a little overshoot (real VU ballistics are ~300 ms)
    for (const k of ['out', 'in']) {
      const m = meters[k];
      const p = st[k];
      const vu = p > 0.0003 ? 20 * Math.log10(p) + (k === 'out' ? 9 : 12) : -40;
      const target = Math.max(-0.04, Math.min(1.06, vuPos(Math.max(-22, Math.min(3.6, vu)))));
      const kk = 170, c = 2 * Math.sqrt(kk) * 0.62;
      m.v += (kk * (target - m.x) - c * m.v) * dt;
      m.x += m.v * dt;
      m.pivot.rotation.z = -(m.x * 2 - 1) * NEEDLE_A;
      // LED ladder
      const L = ladders[k];
      const lv = lvl01(p);
      L.lvl = Math.max(lv, L.lvl - dt * 1.6);
      if (L.lvl >= L.peak || t - L.peakT > 1.2) { L.peak = L.lvl; L.peakT = t; }
      const on = Math.round(L.lvl * 12), pk = Math.max(0, Math.round(L.peak * 12) - 1);
      L.leds.forEach((led, i) => { led.material.emissiveIntensity = i < on || (i === pk && L.peak > 0.08) ? 1.9 : 0.05; });
    }
    // knobs + toggles ease to their value
    for (const k of ['out', 'in']) {
      const kn = knobs[k];
      kn.shown += (kn.v - kn.shown) * Math.min(1, dt * (kn.drag ? 30 : 8));
      kn.spin.rotation.z = (135 - kn.shown * 270) * Math.PI / 180;
      const tg = toggles[k];
      const want = tg.on ? Math.PI / 3 : (2 * Math.PI) / 3;
      tg.a += (want - tg.a) * Math.min(1, dt * 22);
      tg.lever.rotation.x = tg.a;
    }
    // buttons
    const blinkFast = (Math.sin(t * 9) > 0) ? 1 : 0.15;
    const pulse = 0.55 + 0.45 * Math.sin(t * 3.2);
    buttons.fix.target = st.level === 'bad' || st.level === 'warn' ? pulse : st.fixing ? blinkFast : 0.12;
    buttons.testOut.target = st.testOut ? blinkFast : 0;
    buttons.testIn.target = st.testIn ? blinkFast : 0;
    for (const b of Object.values(buttons)) {
      b.lit += (b.target - b.lit) * Math.min(1, dt * 14);
      b.mat.emissiveIntensity = 0.03 + b.lit * 0.5;
      b.mat.color.setScalar(0.33 + b.lit * 0.32);
      b.press = Math.max(0, b.press - dt * 7);
      b.cap.position.z = 0.04 - Math.sin(Math.min(1, b.press) * Math.PI) * 0.014;
    }
    // lamps
    lamps.watch.target = st.auto ? 1 : 0;
    lamps.fix.target = st.fixing ? (Math.sin(t * 8) > 0 ? 1 : 0.1) : st.level === 'warn' ? 0.9 : 0;
    lamps.alert.target = st.needRestart ? (Math.sin(t * 5) > 0 ? 1 : 0.15) : st.level === 'bad' ? 1 : 0;
    for (const l of Object.values(lamps)) {
      l.on += (l.target - l.on) * Math.min(1, dt * 16);
      l.mat.emissiveIntensity = 0.06 + l.on * 1.35;
      l.pl.intensity = l.on * 0.06;
    }
    // plug: in the jack, or pulled out a bit when the mic isn't detected
    plug.visible = st.plugged !== false;
    const out = st.micMissing ? 0.035 + 0.025 * Math.max(0, Math.sin(t * 2.4)) : 0;
    plug.position.z += (out - plug.position.z) * Math.min(1, dt * 6);
    // meter lamps flicker a hair, like real bulbs
    meters.out.faceMat.emissiveIntensity = 0.3 + Math.sin(t * 13.1) * 0.004;
    meters.in.faceMat.emissiveIntensity = 0.3 + Math.sin(t * 11.7 + 1) * 0.004;
    // VFD
    vfdScroll += dt * 26;
    vfdT += dt;
    if (vfdT > 1 / 24) { vfdT = 0; vfdDraw(); }
    composer.render(dt);
  }
  vfdDraw();
  requestAnimationFrame(frame);
  return api;
}
