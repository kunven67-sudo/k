import * as THREE from 'three';
import { mesh, cyl, slab } from './build.js';
import { paint, canvasTex, smudgeTex } from './materials.js';

// Wireless gaming mouse built from a lofted shell. Left/right buttons are separate parts that
// really click down, the wheel spins when you scroll, the logo glows.
const L = 0.124, MAXW = 0.064, MAXH = 0.040;

function profile(v) { // v: 0 back .. 1 front
  const env = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * v - 1), 5)), 0.32);
  const w = (0.054 + 0.012 * Math.exp(-Math.pow((v - 0.4) / 0.3, 2))) * env * (1 - 0.07 * v);
  const h = MAXH * (0.48 + 0.52 * Math.exp(-Math.pow((v - 0.36) / 0.36, 2))) * env;
  return { w: Math.min(w, MAXW), h };
}

export function buildMouse() {
  const group = new THREE.Group();
  group.name = 'mouse';
  const NU = 40, NV = 48;
  const pos = [], uv = [];
  for (let j = 0; j <= NV; j++) {
    const v = j / NV;
    const { w, h } = profile(v);
    const z = L / 2 - v * L;
    for (let i = 0; i <= NU; i++) {
      const th = (i / NU) * Math.PI;
      const c = Math.cos(th), s = Math.sin(th);
      const x = (w / 2) * Math.sign(c) * Math.pow(Math.abs(c), 0.55);
      const y = h * Math.pow(s, 0.62);
      pos.push(x, y, z); uv.push(i / NU, v);
    }
  }
  const posAttr = new THREE.Float32BufferAttribute(pos, 3), uvAttr = new THREE.Float32BufferAttribute(uv, 2);
  const parts = { body: [], left: [], right: [] };
  const vb = 0.6; // buttons start 60% toward the front
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1;
    const vc = (j + 0.5) / NV, cc = Math.cos(((i + 0.5) / NU) * Math.PI);
    let part = 'body';
    if (vc > vb && vc < 0.985) { if (cc > 0.07 && cc < 0.7) part = 'right'; else if (cc < -0.07 && cc > -0.7) part = 'left'; }
    // keep a little channel in the middle for the wheel
    parts[part].push(a, c, b, b, c, d);
  }
  const mk = (idx) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', posAttr); g.setAttribute('uv', uvAttr); g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  const shellMat = paint(0x121316, 0.5, 0.0, { roughnessMap: smudgeTex() });
  const btnMat = paint(0x141518, 0.38, 0.0, { roughnessMap: smudgeTex() });
  const body = mesh(mk(parts.body), shellMat, { parent: group });
  body.material.side = THREE.DoubleSide;
  // bottom plate + skates
  const base = mesh(slab(MAXW * 0.84, L * 0.9, 0.004, 0.02, 0.001), paint(0x0b0b0c, 0.7), { parent: group });
  base.position.y = -0.0005;
  const btn = {};
  for (const side of ['left', 'right']) {
    const pivot = new THREE.Group();
    const zHinge = L / 2 - vb * L;
    pivot.position.set(0, MAXH * 0.9, zHinge);
    const m = mesh(mk(parts[side]), btnMat, { parent: pivot });
    m.position.set(0, -MAXH * 0.9, -zHinge);
    m.material.side = THREE.DoubleSide;
    group.add(pivot);
    btn[side] = { pivot, down: 0, target: 0 };
  }
  // scroll wheel with rubber ridges
  const ridge = canvasTex(64, 256, (g, w, h) => { g.fillStyle = '#777'; g.fillRect(0, 0, w, h); g.fillStyle = '#222'; for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 4); }, false);
  ridge.repeat.set(1, 6);
  const wheelMat = paint(0x202124, 0.85, 0, { bumpMap: ridge, bumpScale: 0.6 });
  const wheel = mesh(cyl(0.0105, 0.0105, 0.0075, 32), wheelMat, { parent: group, rot: [0, 0, Math.PI / 2] });
  const wv = 0.76, wp = profile(wv);
  wheel.position.set(0, wp.h - 0.0075, L / 2 - wv * L);
  // side buttons
  const sideMat = paint(0x18191c, 0.35);
  for (const [v, len] of [[0.52, 0.016], [0.68, 0.016]]) {
    const p = profile(v);
    const sb = mesh(new THREE.CapsuleGeometry(0.0032, len, 4, 8), sideMat, { parent: group, rot: [Math.PI / 2, 0, 0] });
    sb.position.set(-p.w / 2 - 0.0003, p.h * 0.62, L / 2 - v * L);
  }
  // RGB logo near the palm
  const logoMat = new THREE.MeshStandardMaterial({ color: 0x050505, emissive: 0x3366ff, emissiveIntensity: 2.2 });
  const lp = profile(0.2);
  const logo = mesh(new THREE.CircleGeometry(0.0055, 24), logoMat, { parent: group, cast: false });
  logo.position.set(0, lp.h + 0.0004, L / 2 - 0.2 * L);
  logo.rotation.x = -Math.PI / 2 + 0.28;

  const m = { group, btn, wheel, logoMat, wheelAngle: 0, L, height: MAXH };
  m.click = (button, down) => { const b = button === 0 ? btn.left : button === 2 ? btn.right : null; if (b) b.target = down ? 1 : 0; };
  m.scroll = (steps) => { m.wheelAngle += steps * (Math.PI * 2 / 24); };
  m.update = (dt, t) => {
    for (const b of Object.values(btn)) {
      b.down += (b.target - b.down) * Math.min(1, dt * 45);
      b.pivot.rotation.x = -b.down * 0.045;
    }
    wheel.rotation.x += (m.wheelAngle - wheel.rotation.x) * Math.min(1, dt * 25);
    logoMat.emissive.setHSL((t * 0.08) % 1, 0.9, 0.5);
  };
  // where the hand goes (local): palm on the hump, finger tips on the buttons
  m.anchor = {
    palm: new THREE.Vector3(0, MAXH + 0.012, 0.03),
    index: new THREE.Vector3(-0.013, profile(0.86).h + 0.002, L / 2 - 0.86 * L),
    middle: new THREE.Vector3(0.013, profile(0.86).h + 0.002, L / 2 - 0.86 * L),
    wheel: new THREE.Vector3(0, wp.h + 0.004, L / 2 - wv * L),
  };
  return m;
}
