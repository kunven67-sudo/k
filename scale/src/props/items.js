// More real-world things for the shopping app: electronics, food, toys, small stuff.
// Every one is built at its real size (meters) with its real weight, and gets a real price.
// Brands are made up (Vortex, Nova, Clear Spring, Powercell): no real logos.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { std, phys } from '../render/materials.js';
import * as TX from '../render/textures.js';
import { hash3, rng } from '../core/util.js';
import { CATALOG } from './catalog.js';
import './furniture.js';

const cache = new Map();
const once = (k, f) => (cache.has(k) ? cache.get(k) : (cache.set(k, f()), cache.get(k)));

function def(d) {
  CATALOG[d.id] = d;
  return d;
}

function mesh(geo, mat, parent, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const RB = (w, h, d, r, s = 3) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2, h / 2, d / 2) * 0.99);

// ---- materials ----------------------------------------------------------------------------------
const MAT = {
  plastic: (c, r = 0.45) => once('ip' + c + r, () => std({ color: c, roughness: r }, { detail: 'plastic' })),
  gloss: (c, r = 0.18) => once('ig' + c + r, () => phys({ color: c, roughness: r, clearcoat: 0.8, clearcoatRoughness: 0.08 }, { detail: 'plastic' })),
  metal: (c, r = 0.3) => once('im' + c + r, () => std({ color: c, metalness: 1, roughness: r }, { detail: 'metal' })),
  glassBlack: () => once('iglass', () => phys({ color: 0x050608, roughness: 0.05, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02 }, { detail: 'glass' })),
  food: (c, r = 0.7) => once('if' + c + r, () => std({ color: c, roughness: r }, { detail: 'food' })),
};

// Text/graphics drawn on a canvas (labels, logos).
function canvasTex(key, w, h, draw) {
  return once('tex' + key, () => {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    draw(cv.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  });
}

// Surface of revolution from fn(phi, t) -> [radius, y]. t runs bottom (0) to top (1); phi all the
// way around. Lets shapes vary around the axis too (apple lobes, icing drips).
function revolve(segPhi, segT, fn) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segPhi; i++) {
    const phi = (i / segPhi) * Math.PI * 2;
    for (let j = 0; j <= segT; j++) {
      const t = j / segT;
      const [r, y] = fn(phi % (Math.PI * 2), t);
      pos.push(Math.sin(phi) * r, y, Math.cos(phi) * r);
      uv.push(i / segPhi, t);
    }
  }
  const n = segT + 1;
  for (let i = 0; i < segPhi; i++) {
    for (let j = 0; j < segT; j++) {
      const a = i * n + j, b = (i + 1) * n + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Weld the normals along the seam so there's no visible line.
  const nr = g.attributes.normal;
  for (let j = 0; j <= segT; j++) {
    const a = j, b = segPhi * n + j;
    const x = nr.getX(a) + nr.getX(b), y = nr.getY(a) + nr.getY(b), z = nr.getZ(a) + nr.getZ(b);
    const l = Math.hypot(x, y, z) || 1;
    nr.setXYZ(a, x / l, y / l, z / l);
    nr.setXYZ(b, x / l, y / l, z / l);
  }
  return g;
}

// A tube along a curve whose radius changes along it and around it (banana, cables).
function tubeVar(curve, segs, radial, rFn) {
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], uv = [], idx = [];
  const P = new THREE.Vector3(), N = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, P);
    for (let j = 0; j <= radial; j++) {
      const v = (j / radial) * Math.PI * 2;
      const sin = Math.sin(v), cos = -Math.cos(v);
      N.set(0, 0, 0).addScaledVector(frames.normals[i], cos).addScaledVector(frames.binormals[i], sin).normalize();
      const r = rFn(t, v);
      pos.push(P.x + N.x * r, P.y + N.y * r, P.z + N.z * r);
      uv.push(t, j / radial);
    }
  }
  for (let j = 1; j <= radial; j++) {
    for (let i = 1; i <= segs; i++) {
      const a = (radial + 1) * (i - 1) + (j - 1), b = (radial + 1) * i + (j - 1);
      const c = (radial + 1) * i + j, d = (radial + 1) * (i - 1) + j;
      idx.push(a, b, d, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// =================================================================================================
// ELECTRONICS
// =================================================================================================

// Graphics card: a big 3-fan card. 30 cm long, 11.8 cm tall, 2.5 slots (5 cm) thick, 1.4 kg.
// Lies flat with the fans up, the way it sits in its box. Fins, heat pipes, PCB, gold PCIe fingers,
// metal I/O bracket with ports, backplate.
def({
  id: 'gpu', name: 'Graphics card', brand: 'Vortex GX 470 (12 GB)', category: 'Electronics', material: 'metal', mass: 1.4, size: 0.3, price: 599,
  build() {
    const g = new THREE.Group();
    const black = MAT.plastic(0x141518, 0.5);
    const gun = MAT.metal(0x2b2e33, 0.42);
    const alu = MAT.metal(0xb9bec5, 0.34);
    const copper = MAT.metal(0xc4774a, 0.28);
    const gold = MAT.metal(0xd8a63e, 0.22);
    const silver = MAT.metal(0xd3d7dd, 0.18);
    const pcb = std({ color: 0x0c1610, roughness: 0.55 }, { detail: 'plastic' });
    const L = 0.3, W = 0.116;
    // Backplate + PCB.
    mesh(RB(0.286, 0.003, 0.113, 0.0012, 2), gun, g, 0.006, 0.0015, 0);
    mesh(new THREE.BoxGeometry(0.272, 0.0016, 0.106), pcb, g, 0, 0.0039, 0.002);
    // PCIe gold fingers along the -Z edge near the bracket.
    mesh(new THREE.BoxGeometry(0.086, 0.0016, 0.007), gold, g, -0.07, 0.0039, -0.0545);
    // Heat sink: aluminum fins + copper heat pipes running through them.
    const finGeo = new THREE.BoxGeometry(0.0005, 0.026, 0.1);
    const fins = new THREE.InstancedMesh(finGeo, alu, 58);
    const mtx = new THREE.Matrix4();
    for (let i = 0; i < 58; i++) fins.setMatrixAt(i, mtx.makeTranslation(-0.128 + i * 0.0046, 0.0185, 0.002));
    fins.castShadow = true;
    fins.receiveShadow = true;
    g.add(fins);
    for (let k = 0; k < 4; k++) mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.27, 10), copper, g, 0.002, 0.012, -0.03 + k * 0.02, 0, 0, Math.PI / 2);
    // Shroud: one piece with three round fan openings.
    const sh = new THREE.Shape();
    const x0 = -0.142, x1 = 0.15, z0 = -W / 2, z1 = W / 2, rc = 0.012;
    sh.moveTo(x0 + rc, z0);
    sh.lineTo(x1 - rc, z0);
    sh.quadraticCurveTo(x1, z0, x1, z0 + rc);
    sh.lineTo(x1, z1 - rc);
    sh.quadraticCurveTo(x1, z1, x1 - rc, z1);
    sh.lineTo(x0 + rc, z1);
    sh.quadraticCurveTo(x0, z1, x0, z1 - rc);
    sh.lineTo(x0, z0 + rc);
    sh.quadraticCurveTo(x0, z0, x0 + rc, z0);
    const fanX = [-0.093, 0.001, 0.095];
    for (const fx of fanX) {
      const hole = new THREE.Path();
      hole.absarc(fx, 0, 0.0445, 0, Math.PI * 2, true);
      sh.holes.push(hole);
    }
    const shroudGeo = new THREE.ExtrudeGeometry(sh, { depth: 0.005, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 2, curveSegments: 40 });
    shroudGeo.rotateX(-Math.PI / 2);
    mesh(shroudGeo, black, g, 0, 0.038, 0);
    // Shroud side skirts (fins show below them, like real cards).
    for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.29, 0.012, 0.002), black, g, 0.004, 0.034, s * (W / 2 - 0.001));
    mesh(new THREE.BoxGeometry(0.002, 0.04, W), black, g, 0.149, 0.022, 0); // closed end
    // Silver accent stripes between the fans.
    for (const ax of [-0.047, 0.048]) mesh(new THREE.BoxGeometry(0.004, 0.0008, 0.09), silver, g, ax, 0.0447, 0);
    // Fans: hub with a logo, 11 swept blades, a thin ring.
    const hubLogo = once('m-vortexhub', () => std({ map: canvasTex('vortexhub', 128, 128, (c, w) => {
      c.fillStyle = '#121316';
      c.fillRect(0, 0, w, w);
      c.strokeStyle = '#8f98a3';
      c.lineWidth = 6;
      c.beginPath();
      c.arc(64, 64, 52, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = '#c8ced6';
      c.font = 'bold 64px Arial, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('V', 64, 68);
    }), roughness: 0.4 }, { detail: 'plastic' }));
    const bladeGeo = new THREE.BoxGeometry(0.027, 0.0011, 0.0145);
    const ringGeo = new THREE.TorusGeometry(0.0432, 0.0012, 6, 48);
    for (const fx of fanX) {
      const fan = new THREE.Group();
      fan.position.set(fx, 0.034, 0);
      g.add(fan);
      mesh(new THREE.CylinderGeometry(0.0155, 0.0165, 0.007, 28), black, fan, 0, 0, 0);
      const cap = mesh(new THREE.CircleGeometry(0.0145, 28), hubLogo, fan, 0, 0.0036, 0, -Math.PI / 2);
      cap.castShadow = false;
      for (let b = 0; b < 11; b++) {
        const a = (b / 11) * Math.PI * 2;
        const piv = new THREE.Group();
        piv.rotation.y = a;
        fan.add(piv);
        const bl = mesh(bladeGeo, black, piv, 0.029, 0, 0);
        bl.rotation.set(0.42, -0.25, 0); // pitched and swept
      }
      mesh(ringGeo, black, fan, 0, 0.002, 0, Math.PI / 2);
    }
    // I/O bracket at the -X end: steel plate with 3 DisplayPorts and an HDMI.
    mesh(new THREE.BoxGeometry(0.0012, 0.05, 0.12), silver, g, -0.1505, 0.025, 0.004);
    const port = MAT.plastic(0x0b0b0c, 0.6);
    for (let i = 0; i < 4; i++) mesh(new THREE.BoxGeometry(0.004, i === 3 ? 0.006 : 0.0055, i === 3 ? 0.015 : 0.017), port, g, -0.1525, 0.012, -0.04 + i * 0.024);
    // Power connector on the top edge.
    mesh(new THREE.BoxGeometry(0.024, 0.009, 0.007), port, g, 0.07, 0.03, 0.06);
    // Brand on the side you'd see through a PC case window.
    const label = once('m-vortexside', () => std({ map: canvasTex('vortexside', 512, 64, (c, w, h) => {
      c.fillStyle = '#141518';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#d6dbe2';
      c.font = 'bold 40px Arial, sans-serif';
      c.textBaseline = 'middle';
      c.fillText('VORTEX', 18, h / 2 + 2);
      c.fillStyle = '#7d8691';
      c.font = '30px Arial, sans-serif';
      c.fillText('GX 470', 210, h / 2 + 2);
      c.fillStyle = '#2ef2ff';
      c.fillRect(360, h / 2 - 2, 130, 4);
    }), roughness: 0.45 }, { detail: 'plastic' }));
    const side = mesh(new THREE.PlaneGeometry(0.14, 0.0105), label, g, 0.05, 0.034, W / 2 + 0.0003);
    side.castShadow = false;
    return g;
  },
  shapes: [{ t: 'box', s: [0.15, 0.023, 0.059], p: [0.004, 0.023, 0] }],
});

// Game console (Nova 5): upright, 39 cm tall, 26 cm deep, 10 cm thick, 4.5 kg.
// Black glossy core between two white curved panels, disc slot and ports on the front.
def({
  id: 'console', name: 'Game console', brand: 'Nova 5', category: 'Electronics', material: 'plastic', mass: 4.5, size: 0.39, price: 499,
  build() {
    const g = new THREE.Group();
    const core = MAT.gloss(0x0d0e11, 0.12);
    const white = MAT.plastic(0xeceef0, 0.38);
    const dark = MAT.plastic(0x18191c, 0.5);
    mesh(RB(0.066, 0.372, 0.236, 0.01), core, g, 0, 0.192, 0);
    // Side panel silhouette (z = depth, y = height): slim at the bottom, flaring out at the top.
    const s = new THREE.Shape();
    s.moveTo(-0.118, 0.004);
    s.lineTo(0.112, 0.004);
    s.quadraticCurveTo(0.122, 0.006, 0.124, 0.03);
    s.quadraticCurveTo(0.128, 0.25, 0.136, 0.37);
    s.quadraticCurveTo(0.138, 0.392, 0.115, 0.392);
    s.lineTo(-0.128, 0.392);
    s.quadraticCurveTo(-0.14, 0.39, -0.138, 0.37);
    s.quadraticCurveTo(-0.13, 0.2, -0.124, 0.03);
    s.quadraticCurveTo(-0.123, 0.006, -0.118, 0.004);
    const panel = new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 3, curveSegments: 24 });
    panel.rotateY(Math.PI / 2); // shape x -> -z, extrude z -> x
    for (const sx of [-1, 1]) {
      const p = mesh(panel, white, g, sx > 0 ? 0.037 : -0.045, 0, 0);
      p.scale.set(1, 1, 1);
    }
    // Front (+Z): disc slot, eject/power buttons, USB ports. Back: vents.
    mesh(new THREE.BoxGeometry(0.004, 0.13, 0.002), dark, g, 0.012, 0.25, 0.1185);
    for (const [y, h] of [[0.085, 0.012], [0.11, 0.012]]) mesh(new THREE.BoxGeometry(0.012, h, 0.003), dark, g, -0.01, y, 0.1185);
    mesh(new THREE.BoxGeometry(0.003, 0.016, 0.002), MAT.plastic(0x2a2c30, 0.3), g, 0.02, 0.1, 0.1185);
    for (let i = 0; i < 9; i++) mesh(new THREE.BoxGeometry(0.05, 0.003, 0.002), dark, g, 0, 0.12 + i * 0.022, -0.1185);
    // Brand mark on the right panel.
    const brand = once('m-nova', () => std({ map: canvasTex('nova', 256, 64, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.fillStyle = 'rgba(150,156,166,0.85)';
      c.font = '600 44px Arial, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('N O V A', w / 2, h / 2 + 2);
    }), transparent: true, roughness: 0.4, depthWrite: false }, { detail: 'plastic' }));
    const b = mesh(new THREE.PlaneGeometry(0.07, 0.0175), brand, g, 0.0492, 0.34, 0.02, 0, Math.PI / 2, 0);
    b.castShadow = false;
    b.name = 'brand';
    return g;
  },
  shapes: [{ t: 'box', s: [0.05, 0.195, 0.128], p: [-0.004, 0.196, -0.002] }],
});

// Wireless game controller: 16 x 10.6 x 6.6 cm, 280 g. Lying flat, buttons up.
def({
  id: 'controller', name: 'Wireless controller', brand: 'Nova', category: 'Electronics', material: 'plastic', mass: 0.28, size: 0.16, price: 69,
  build() {
    const g = new THREE.Group();
    const white = MAT.plastic(0xe9ebee, 0.4);
    const dark = MAT.plastic(0x1b1c20, 0.42);
    const rubber = MAT.plastic(0x232428, 0.8);
    mesh(RB(0.112, 0.03, 0.062, 0.012), white, g, 0, 0.026, -0.01);
    for (const s of [-1, 1]) {
      // Grips point back toward you, splay outward and droop a little, like a real controller.
      const grip = mesh(new THREE.CapsuleGeometry(0.019, 0.042, 6, 16), white, g, s * 0.05, 0.0235, 0.026);
      grip.rotation.order = 'YXZ';
      grip.rotation.set(Math.PI / 2 + 0.12, s * 0.38, 0);
    }
    mesh(RB(0.044, 0.004, 0.026, 0.002), dark, g, 0, 0.0405, -0.02); // touch pad
    mesh(RB(0.07, 0.006, 0.02, 0.003), dark, g, 0, 0.033, 0.019); // center band
    // Thumbsticks.
    for (const s of [-1, 1]) {
      const x = s * 0.023, z = 0.012;
      mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.003, 24), dark, g, x, 0.039, z);
      mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.008, 12), dark, g, x, 0.044, z);
      mesh(new THREE.CylinderGeometry(0.0095, 0.009, 0.003, 24), rubber, g, x, 0.049, z);
      mesh(new THREE.TorusGeometry(0.0085, 0.0012, 6, 24), rubber, g, x, 0.0505, z, Math.PI / 2);
    }
    // D-pad.
    mesh(new THREE.BoxGeometry(0.021, 0.004, 0.0068), dark, g, -0.044, 0.0415, -0.007);
    mesh(new THREE.BoxGeometry(0.0068, 0.004, 0.021), dark, g, -0.044, 0.0415, -0.007);
    // Face buttons, each with a colored ring.
    const cols = [0x34c76a, 0xe0464e, 0x3c8ce8, 0xe8b23c];
    [[0, -0.011], [0.011, 0], [0, 0.011], [-0.011, 0]].forEach(([dx, dz], i) => {
      mesh(new THREE.CylinderGeometry(0.0046, 0.0046, 0.005, 16), dark, g, 0.044 + dx, 0.0415, -0.007 + dz);
      mesh(new THREE.TorusGeometry(0.0025, 0.0006, 4, 16), MAT.plastic(cols[i], 0.3), g, 0.044 + dx, 0.0442, -0.007 + dz, Math.PI / 2);
    });
    // Shoulder bumpers and triggers on the back edge.
    for (const s of [-1, 1]) {
      mesh(RB(0.03, 0.008, 0.012, 0.003), dark, g, s * 0.04, 0.036, -0.043);
      mesh(RB(0.026, 0.012, 0.016, 0.004), dark, g, s * 0.04, 0.022, -0.046);
    }
    return g;
  },
  shapes: [
    { t: 'box', s: [0.056, 0.016, 0.031], p: [0, 0.026, -0.01] },
    { t: 'cap', r: 0.018, h: 0.02, p: [-0.05, 0.0195, 0.026], rot: [Math.PI / 2, 0, 0.38] },
    { t: 'cap', r: 0.018, h: 0.02, p: [0.05, 0.0195, 0.026], rot: [Math.PI / 2, 0, -0.38] },
  ],
});

// Smartphone: 14.7 x 7.15 x 0.78 cm, 172 g. Lies screen-up; the camera bump makes it rock a little,
// like a real phone on a table.
def({
  id: 'smartphone', name: 'Smartphone', brand: 'Nova Pixel 9', category: 'Electronics', material: 'metal', mass: 0.172, size: 0.147, price: 799,
  build() {
    const g = new THREE.Group();
    const frame = MAT.metal(0x3a3d43, 0.3);
    const back = MAT.gloss(0x1f2a36, 0.25);
    const by = 0.0016; // bump height
    mesh(RB(0.0715, 0.0078, 0.147, 0.009, 4), frame, g, 0, by + 0.0039, 0);
    mesh(RB(0.069, 0.001, 0.144, 0.008, 3), back, g, 0, by + 0.0004, 0);
    // Screen glass with rounded corners.
    const s = new THREE.Shape();
    const w = 0.0345, h = 0.0715, r = 0.0075;
    s.moveTo(-w + r, -h);
    s.lineTo(w - r, -h);
    s.quadraticCurveTo(w, -h, w, -h + r);
    s.lineTo(w, h - r);
    s.quadraticCurveTo(w, h, w - r, h);
    s.lineTo(-w + r, h);
    s.quadraticCurveTo(-w, h, -w, h - r);
    s.lineTo(-w, -h + r);
    s.quadraticCurveTo(-w, -h, -w + r, -h);
    const scr = mesh(new THREE.ShapeGeometry(s, 8), MAT.glassBlack(), g, 0, by + 0.0079, 0, -Math.PI / 2);
    scr.castShadow = false;
    mesh(new THREE.CylinderGeometry(0.0013, 0.0013, 0.0002, 12), MAT.plastic(0x000000, 0.2), g, 0, by + 0.0081, -0.066);
    // Camera bump with two lenses (on the back, underneath).
    mesh(RB(0.026, 0.0018, 0.03, 0.006), back, g, -0.016, 0.0009, -0.052);
    for (const dz of [-0.007, 0.007]) {
      mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.0004, 20), MAT.metal(0x9aa0a8, 0.2), g, -0.016, -0.0001, -0.052 + dz);
      mesh(new THREE.CylinderGeometry(0.0038, 0.0038, 0.0005, 20), MAT.glassBlack(), g, -0.016, -0.0003, -0.052 + dz);
    }
    // Side buttons.
    mesh(new THREE.BoxGeometry(0.001, 0.0028, 0.018), frame, g, 0.0362, by + 0.0042, -0.02);
    mesh(new THREE.BoxGeometry(0.001, 0.0028, 0.03), frame, g, -0.0362, by + 0.0042, -0.025);
    return g;
  },
  shapes: [
    { t: 'box', s: [0.0357, 0.0039, 0.0735], p: [0, 0.0055, 0] },
    { t: 'box', s: [0.013, 0.0008, 0.015], p: [-0.016, 0.0008, -0.052] },
  ],
});

// AA battery: 50.5 mm long, 14.5 mm wide, 23 g.
def({
  id: 'battery', name: 'AA battery', brand: 'Powercell', category: 'Electronics', material: 'metal', mass: 0.023, size: 0.0505, price: 1.25,
  build() {
    const g = new THREE.Group();
    const wrap = once('m-powercell', () => std({ map: canvasTex('powercell', 256, 128, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#b8642a');
      gr.addColorStop(0.62, '#c9783a');
      gr.addColorStop(0.62, '#131416');
      gr.addColorStop(1, '#131416');
      c.fillStyle = gr;
      c.fillRect(0, 0, w, h);
      c.save();
      c.translate(w * 0.25, h / 2);
      c.rotate(-Math.PI / 2);
      c.fillStyle = '#f1f1f1';
      c.font = 'bold 22px Arial, sans-serif';
      c.textAlign = 'center';
      c.fillText('POWERCELL', 0, 0);
      c.font = '16px Arial, sans-serif';
      c.fillText('AA  1.5V', 0, 20);
      c.restore();
    }), metalness: 0.35, roughness: 0.35 }, { detail: 'metal' }));
    const steel = MAT.metal(0xc5c9cf, 0.25);
    mesh(new THREE.CylinderGeometry(0.00725, 0.00725, 0.0485, 32, 1, true), wrap, g, 0, 0.0245, 0);
    mesh(new THREE.CylinderGeometry(0.0071, 0.0071, 0.0006, 32), steel, g, 0, 0.0003, 0);
    mesh(new THREE.CylinderGeometry(0.0071, 0.0071, 0.0006, 32), steel, g, 0, 0.0488, 0);
    mesh(new THREE.CylinderGeometry(0.0027, 0.0028, 0.0015, 20), steel, g, 0, 0.0498, 0);
    return g;
  },
  shapes: [{ t: 'cyl', r: 0.00725, h: 0.0249, p: [0, 0.0249, 0] }],
});

// =================================================================================================
// FOOD
// =================================================================================================

// Apple: 7.5 cm wide, 7 cm tall, 180 g. Five soft lobes, dimples top and bottom, stem and a leaf.
const appleTex = () => TX.generate('apple', 256, (u, v) => {
  const streak = TX.fbm(u, v * 0.25, { freq: 28, oct: 3, seed: 301 });
  const blush = TX.fbm(u, v, { freq: 3, oct: 3, seed: 302 });
  const dot = hash3(Math.floor(u * 256), Math.floor(v * 256), 0, 303) > 0.992 ? 1 : 0;
  const red = [0.55 + streak * 0.2, 0.05 + streak * 0.05, 0.05];
  const yel = [0.86, 0.62, 0.22];
  const k = Math.max(0, Math.min(1, (blush - 0.58) * 3)) * (0.6 + streak * 0.4);
  let c = [red[0] + (yel[0] - red[0]) * k, red[1] + (yel[1] - red[1]) * k, red[2] + (yel[2] - red[2]) * k];
  const cavity = Math.max(0, Math.max(0.12 - v, v - 0.9)) * 6;
  c = [c[0] * (1 - cavity * 0.4) + 0.3 * cavity * 0.3, c[1] + 0.25 * cavity * 0.3, c[2]];
  if (dot) c = [c[0] + 0.25, c[1] + 0.2, c[2] + 0.1];
  return [c[0], c[1], c[2], streak * 0.3 + dot * 0.2, 0.32];
}, { normalStrength: 1 });
def({
  id: 'apple', name: 'Apple', category: 'Food & drink', material: 'food', mass: 0.18, size: 0.075, price: 0.79,
  build() {
    const g = new THREE.Group();
    const t = appleTex();
    const skin = once('appleskin', () => phys({ map: t.map, normalMap: t.normalMap, roughness: 0.38, clearcoat: 0.45, clearcoatRoughness: 0.25 }, { detail: 'food' }));
    // Profile from the bottom dimple up to the stem well.
    const prof = [[0.0, 0.006], [0.008, 0.0035], [0.018, 0.002], [0.028, 0.006], [0.0345, 0.015], [0.0378, 0.029], [0.0372, 0.044], [0.0335, 0.057], [0.025, 0.0665], [0.0145, 0.0695], [0.0065, 0.066], [0.0, 0.0605]];
    const curve = new THREE.SplineCurve(prof.map((p) => new THREE.Vector2(p[0], p[1])));
    const geo = revolve(40, 28, (phi, tt) => {
      const p = curve.getPoint(tt);
      const lobe = 1 + 0.035 * Math.cos(phi * 5) * Math.sin(Math.PI * tt);
      return [p.x * lobe, p.y];
    });
    mesh(geo, skin, g);
    const stem = mesh(new THREE.CylinderGeometry(0.0008, 0.0013, 0.016, 8), MAT.food(0x4a3420, 0.8), g, 0.001, 0.069, 0);
    stem.rotation.z = -0.25;
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.quadraticCurveTo(0.008, 0.006, 0.022, 0);
    leafShape.quadraticCurveTo(0.008, -0.006, 0, 0);
    const leaf = mesh(new THREE.ShapeGeometry(leafShape, 6), once('appleleaf', () => std({ color: 0x3d6e2a, roughness: 0.55, side: THREE.DoubleSide }, { detail: 'plastic' })), g, 0.002, 0.074, 0);
    leaf.rotation.set(-1.2, 0.6, 0.3);
    return g;
  },
  // Convex hull of the apple (rolls a bit, then stops, like a real one).
  shapes: [{ t: 'hull', pts: (() => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      for (const [r, y] of [[0.018, 0.002], [0.0345, 0.015], [0.0378, 0.032], [0.0335, 0.057], [0.016, 0.069]]) pts.push([Math.sin(a) * r, y, Math.cos(a) * r]);
    }
    return pts;
  })() }],
});

// Banana: 19 cm along the curve, 3.5 cm thick, 120 g. Five soft ridges, green-brown stem, black tip.
const bananaTex = () => TX.generate('banana', 128, (u, v) => {
  const n = TX.fbm(u, v, { freq: 8, oct: 3, seed: 311 });
  const spot = TX.fbm(u, v, { freq: 24, oct: 2, seed: 312 }) > 0.74 ? 1 : 0;
  const endK = Math.max(0, 1 - Math.min(u, 1 - u) / 0.09);
  let c = [0.93 - n * 0.06, 0.76 - n * 0.06, 0.2];
  c = [c[0] + (0.46 - c[0]) * endK, c[1] + (0.48 - c[1]) * endK, c[2] + (0.16 - c[2]) * endK];
  if (spot) c = [c[0] * 0.55, c[1] * 0.45, c[2] * 0.4];
  const ridge = Math.abs(Math.cos(v * Math.PI * 5));
  return [c[0] * (0.92 + ridge * 0.08), c[1] * (0.92 + ridge * 0.08), c[2], ridge * 0.4 + n * 0.2, 0.55];
}, { normalStrength: 1.2 });
const BAN = { R: 0.13, A: 0.78, r: 0.0172 };
const banPt = (a) => [BAN.R * Math.sin(a), BAN.r, BAN.R * (1 - Math.cos(a)) - 0.022];
def({
  id: 'banana', name: 'Banana', category: 'Food & drink', material: 'food', mass: 0.12, size: 0.2, price: 0.29,
  build() {
    const g = new THREE.Group();
    const t = bananaTex();
    const peel = once('bananapeel', () => std({ map: t.map, normalMap: t.normalMap, roughness: 0.55 }, { detail: 'food' }));
    const pts = [];
    for (let i = 0; i <= 8; i++) pts.push(new THREE.Vector3(...banPt(-BAN.A + (i / 8) * 2 * BAN.A)));
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = tubeVar(curve, 48, 15, (tt, v) => {
      const taper = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, tt * 0.94 + 0.03))), 0.45);
      return BAN.r * (0.22 + 0.78 * taper) * (1 + 0.045 * Math.cos(v * 5));
    });
    mesh(geo, peel, g);
    // Stem at one end, dark blossom nub at the other.
    const p0 = curve.getPointAt(0), d0 = curve.getTangentAt(0);
    const stem = mesh(new THREE.CylinderGeometry(0.0035, 0.0045, 0.022, 8), MAT.food(0x5e5a2a, 0.7), g);
    stem.position.copy(p0).addScaledVector(d0, -0.009);
    stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d0.clone().negate());
    mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.0012, 8), MAT.food(0x2e2a18, 0.8), g).position.copy(p0).addScaledVector(d0, -0.02);
    const p1 = curve.getPointAt(1), d1 = curve.getTangentAt(1);
    const nub = mesh(new THREE.SphereGeometry(0.0035, 10, 8), MAT.food(0x1d1710, 0.8), g);
    nub.position.copy(p1).addScaledVector(d1, 0.001);
    return g;
  },
  // Four capsules along the curve; the thinner end ones sit a little off the ground like the real
  // banana's ends curl up.
  shapes: (() => {
    const out = [];
    const n = 4, step = (2 * BAN.A) / n;
    for (let i = 0; i < n; i++) {
      const a0 = -BAN.A + i * step, a1 = a0 + step, am = (a0 + a1) / 2;
      const p = banPt(a0), q = banPt(a1);
      const r = i === 0 || i === n - 1 ? 0.0128 : 0.0166;
      const chord = 2 * BAN.R * Math.sin(step / 2);
      out.push({ t: 'cap', r, h: Math.max(0.004, chord / 2 - r * 0.6), p: [(p[0] + q[0]) / 2, BAN.r, (p[2] + q[2]) / 2], rot: [0, -am, Math.PI / 2] });
    }
    return out;
  })(),
});

// Glazed donut with pink icing and sprinkles: 9.2 cm across, 3.3 cm tall, 60 g.
def({
  id: 'donut', name: 'Donut (pink icing)', category: 'Food & drink', material: 'food', mass: 0.06, size: 0.092, price: 1.49,
  noMerge: false,
  build() {
    const g = new THREE.Group();
    const R = 0.0305, r = 0.0158;
    const doughT = TX.generate('dough', 128, (u, v) => {
      const n = TX.fbm(u, v, { freq: 12, oct: 4, seed: 321 });
      const band = Math.exp(-((v - 0.5) ** 2) / 0.004) * 0.25; // the pale ring where it floated in the fryer
      const d = 0.8 + n * 0.25 + band;
      return [0.76 * d, 0.47 * d, 0.22 * d, n, 0.75];
    }, { normalStrength: 2 });
    const dough = once('dough', () => std({ map: doughT.map, normalMap: doughT.normalMap, roughness: 0.8 }, { detail: 'food' }));
    // Dough: torus as a revolve so its UV v runs around the tube (bottom -> top).
    mesh(revolve(48, 24, (phi, t) => {
      const th = -Math.PI / 2 + t * Math.PI * 2; // around the tube
      return [R + Math.cos(th) * r, r + Math.sin(th) * r * 0.95];
    }), dough, g);
    // Icing: covers the top of the tube, with drips around the edges.
    const icing = once('icingpink', () => phys({ color: 0xf28fb0, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.15 }, { detail: 'food' }));
    const r2 = r * 1.06;
    mesh(revolve(64, 20, (phi, t) => {
      const dripOut = 0.25 + 0.22 * Math.max(0, Math.sin(phi * 7 + 1.3)) * Math.max(0, Math.sin(phi * 3));
      const dripIn = 0.2 + 0.18 * Math.max(0, Math.sin(phi * 5 + 0.4));
      const a0 = -dripOut, a1 = Math.PI + dripIn; // outer edge angle -> inner edge angle
      const th = a0 + t * (a1 - a0);
      return [R + Math.cos(th) * r2, r + Math.sin(th) * r2 * 0.97 + 0.0003];
    }), icing, g);
    // Sprinkles (instanced, 5 colors).
    const sGeo = new THREE.CapsuleGeometry(0.00075, 0.0034, 2, 6);
    const sMat = once('sprinkle', () => std({ color: 0xffffff, roughness: 0.35 }, { detail: 'food' }));
    const N = 90;
    const sp = new THREE.InstancedMesh(sGeo, sMat, N);
    const cols = [0xffffff, 0xffd84a, 0x4fc3ff, 0x8be36a, 0xff6b4a].map((c) => new THREE.Color(c));
    const R0 = rng(77);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < N; i++) {
      const phi = R0() * Math.PI * 2, th = 0.25 + R0() * (Math.PI - 0.5);
      const rr = R + Math.cos(th) * r2 * 1.02;
      pos.set(Math.sin(phi) * rr, r + Math.sin(th) * r2 * 1.0, Math.cos(phi) * rr);
      e.set(Math.PI / 2 + (R0() - 0.5) * 0.6, R0() * Math.PI * 2, (R0() - 0.5) * 0.6, 'YXZ');
      q.setFromEuler(e);
      sp.setMatrixAt(i, m4.compose(pos, q, one));
      sp.setColorAt(i, cols[i % cols.length]);
    }
    sp.castShadow = true;
    sp.receiveShadow = true;
    g.add(sp);
    return g;
  },
  // A ring of 8 boxes: the hole is real (a tiny you can walk through it).
  shapes: Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return { t: 'box', s: [0.0125, 0.0152, 0.0135], p: [Math.sin(a) * 0.0305, 0.0158, Math.cos(a) * 0.0305], rot: [0, a, 0] };
  }),
});

// Gummy bears: 2.2 cm tall, 2.3 g. Glossy, slightly see-through color.
function gummyDef(id, name, color) {
  def({
    id, name, category: 'Food & drink', material: 'food', mass: 0.0023, size: 0.022, price: 0.05,
    build() {
      const g = new THREE.Group();
      const c = new THREE.Color(color);
      const mat = once('gummy' + color, () => phys({ color: c, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12, emissive: c.clone().multiplyScalar(0.12), sheen: 0.4, sheenColor: c }, { detail: 'food' }));
      const sph = (r, x, y, z, sx = 1, sy = 1, sz = 1) => {
        const m = mesh(new THREE.SphereGeometry(r, 18, 12), mat, g, x, y, z);
        m.scale.set(sx, sy, sz);
        return m;
      };
      sph(0.0055, 0, 0.0075, 0, 1, 1.15, 0.85); // body
      sph(0.0042, 0, 0.0165, 0.0004, 1.05, 0.95, 0.9); // head
      for (const s of [-1, 1]) {
        sph(0.0016, s * 0.0032, 0.0203, 0, 1, 1, 0.7); // ears
        sph(0.0021, s * 0.0052, 0.0105, 0.0015, 1, 1.3, 0.9); // arms
        sph(0.0026, s * 0.0034, 0.0026, 0.0012, 1, 0.95, 1.05); // legs
      }
      sph(0.0017, 0, 0.0158, 0.0036, 1.1, 0.8, 0.7); // snout
      return g;
    },
    shapes: [{ t: 'box', s: [0.0058, 0.0105, 0.0043], p: [0, 0.0107, 0.0005] }],
  });
}
gummyDef('gummy_red', 'Gummy bear (red)', 0xd8202c);
gummyDef('gummy_green', 'Gummy bear (green)', 0x3fb83a);
gummyDef('gummy_yellow', 'Gummy bear (yellow)', 0xf2c418);

// Bottled water: 500 ml, 21 cm, 520 g full. Clear bottle, real water inside, blue cap, label.
def({
  id: 'water_bottle', name: 'Bottled water (500 ml)', brand: 'Clear Spring', category: 'Food & drink', material: 'plastic', mass: 0.52, size: 0.21, price: 1.29,
  noMerge: true,
  build() {
    const g = new THREE.Group();
    const prof = [[0.0, 0.0], [0.024, 0.0], [0.031, 0.003], [0.0325, 0.01], [0.0325, 0.145], [0.0305, 0.16], [0.02, 0.18], [0.0145, 0.188], [0.0138, 0.197]];
    const rib = (y) => (y > 0.03 && y < 0.14 ? -0.0009 * Math.max(0, Math.cos(y * 380)) : 0);
    const curve = new THREE.SplineCurve(prof.map((p) => new THREE.Vector2(p[0], p[1])));
    const bottle = revolve(40, 60, (phi, t) => {
      const p = curve.getPoint(t);
      return [p.x + rib(p.y), p.y];
    });
    const plastic = once('bottleplastic', () => phys({ color: 0xe8f1f6, roughness: 0.06, transparent: true, opacity: 0.22, depthWrite: false, clearcoat: 1 }, { detail: 'glass' }));
    const water = once('bottlewater', () => phys({ color: 0x9cc4dc, roughness: 0.04, transparent: true, opacity: 0.3, depthWrite: false }, { detail: 'glass' }));
    // Water fills it up to the shoulder, with a flat surface on top.
    const w = new THREE.LatheGeometry([[0, 0.0015], [0.023, 0.0015], [0.0298, 0.004], [0.0312, 0.011], [0.0312, 0.143], [0.0293, 0.157], [0.0262, 0.165], [0, 0.165]].map((q) => new THREE.Vector2(q[0], q[1])), 32);
    const wm = mesh(w, water, g);
    wm.renderOrder = 1;
    wm.castShadow = false;
    const bm = mesh(bottle, plastic, g);
    bm.renderOrder = 2;
    bm.castShadow = false;
    // Cap with grip ridges.
    const cap = MAT.plastic(0x1f6fd6, 0.35);
    mesh(new THREE.CylinderGeometry(0.0155, 0.0155, 0.014, 36), cap, g, 0, 0.204, 0);
    mesh(new THREE.CylinderGeometry(0.0165, 0.0165, 0.0015, 36), cap, g, 0, 0.1965, 0);
    const label = once('m-clearspring', () => std({ map: canvasTex('clearspring', 512, 128, (c, ww, hh) => {
      const gr = c.createLinearGradient(0, 0, ww, 0);
      gr.addColorStop(0, '#0b5fb8');
      gr.addColorStop(0.5, '#3aa7f2');
      gr.addColorStop(1, '#0b5fb8');
      c.fillStyle = gr;
      c.fillRect(0, 0, ww, hh);
      c.fillStyle = '#ffffff';
      c.font = 'bold 42px Arial, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('CLEAR SPRING', ww / 4, hh / 2 - 8);
      c.fillText('CLEAR SPRING', (ww * 3) / 4, hh / 2 - 8);
      c.font = '22px Arial, sans-serif';
      c.fillText('natural spring water · 500 mL', ww / 4, hh / 2 + 30);
      c.fillText('natural spring water · 500 mL', (ww * 3) / 4, hh / 2 + 30);
    }), roughness: 0.4 }, { detail: 'paint' }));
    const lm = mesh(new THREE.CylinderGeometry(0.0329, 0.0329, 0.058, 40, 1, true), label, g, 0, 0.085, 0);
    lm.renderOrder = 3;
    return g;
  },
  shapes: [{ t: 'cyl', r: 0.0325, h: 0.09, p: [0, 0.09, 0] }, { t: 'cyl', r: 0.016, h: 0.02, p: [0, 0.19, 0] }],
});

// =================================================================================================
// TOYS / SPORTS / OFFICE / SMALL STUFF
// =================================================================================================

// Basketball: size 7, 24 cm, 620 g. Pebbled orange leather, black grooved seams.
const ballTex = () => TX.generate('basketball', 512, (u, v) => {
  const th = (1 - v) * Math.PI, ph = u * Math.PI * 2;
  const dx = -Math.cos(ph) * Math.sin(th), dy = Math.cos(th), dz = Math.sin(ph) * Math.sin(th);
  const w = 0.016;
  const angX = Math.acos(Math.min(1, Math.abs(dx)));
  const seam = Math.abs(dz) < w || Math.abs(dy) < w || Math.abs(angX - 0.86) < w;
  const peb = TX.fbm(u, v, { freq: 128, oct: 2, seed: 331 });
  if (seam) return [0.05, 0.035, 0.03, 0.0, 0.6];
  const d = 0.82 + peb * 0.22;
  return [0.84 * d, 0.36 * d, 0.1 * d, 0.55 + peb * 0.45, 0.72];
}, { normalStrength: 2.5 });
def({
  id: 'basketball', name: 'Basketball', category: 'Sports', material: 'rubber', mass: 0.62, size: 0.24, price: 29.99,
  build() {
    const t = ballTex();
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 48, 32), once('bball', () => std({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1 }, { detail: 'skin' })));
    m.position.y = 0.12;
    return m;
  },
  shapes: [{ t: 'ball', r: 0.12, p: [0, 0.12, 0] }],
});

// Rubber duck: 9 cm tall, 40 g (hollow vinyl).
def({
  id: 'duck', name: 'Rubber duck', category: 'Toys', material: 'rubber', mass: 0.04, size: 0.1, price: 4.99,
  build() {
    const g = new THREE.Group();
    const yellow = MAT.gloss(0xffcf1f, 0.3);
    const orange = MAT.gloss(0xff7a1a, 0.3);
    const black = MAT.gloss(0x0a0a0a, 0.1);
    const body = new THREE.SphereGeometry(0.04, 32, 20);
    const p = body.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      p.setY(i, Math.max(y, -0.026)); // flat bottom so it floats upright
      const z = p.getZ(i);
      if (z < -0.02 && y > 0) p.setY(i, p.getY(i) + (-0.02 - z) * 0.9 * (y / 0.04)); // tail sweeps up
    }
    body.computeVertexNormals();
    const b = mesh(body, yellow, g, 0, 0.0221, 0);
    b.scale.set(1, 0.85, 1.18);
    mesh(new THREE.SphereGeometry(0.025, 28, 18), yellow, g, 0, 0.07, 0.016);
    const beak = mesh(new THREE.SphereGeometry(0.011, 18, 10), orange, g, 0, 0.065, 0.041);
    beak.scale.set(1.3, 0.45, 1.25);
    for (const s of [-1, 1]) {
      mesh(new THREE.SphereGeometry(0.0034, 12, 8), black, g, s * 0.012, 0.078, 0.034);
      const wing = mesh(new THREE.SphereGeometry(0.016, 18, 10), yellow, g, s * 0.036, 0.034, -0.004);
      wing.scale.set(0.35, 0.7, 1.15);
    }
    return g;
  },
  shapes: [{ t: 'cyl', r: 0.039, h: 0.016, p: [0, 0.016, 0] }, { t: 'ball', r: 0.024, p: [0, 0.07, 0.016] }],
});

// Toy brick, 2x4: 31.8 x 15.8 x 9.6 mm, 2.3 g. (Real-life hazard when stepped on barefoot.)
def({
  id: 'brick', name: 'Toy brick (2x4)', category: 'Toys', material: 'plastic', mass: 0.0023, size: 0.032, price: 0.2,
  build() {
    const g = new THREE.Group();
    const red = MAT.gloss(0xc8161d, 0.22);
    mesh(RB(0.0318, 0.0096, 0.0158, 0.0004, 2), red, g, 0, 0.0048, 0);
    const stud = new THREE.CylinderGeometry(0.0024, 0.0024, 0.0017, 20);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) mesh(stud, red, g, -0.012 + i * 0.008, 0.01045, -0.004 + j * 0.008);
    return g;
  },
  shapes: [{ t: 'box', s: [0.0159, 0.0048, 0.0079], p: [0, 0.0048, 0] }],
});

// Six-sided die: 16 mm, 3.5 g. Opposite faces add up to 7.
def({
  id: 'die', name: 'Die', category: 'Toys', material: 'plastic', mass: 0.0035, size: 0.016, price: 0.5,
  build() {
    const g = new THREE.Group();
    const s = 0.016, h = s / 2;
    mesh(RB(s, s, s, 0.0022, 3), MAT.gloss(0xf3f0e8, 0.2), g, 0, h, 0);
    const pip = new THREE.SphereGeometry(0.00135, 12, 8);
    const pm = MAT.gloss(0x111111, 0.3);
    const P = 0.0042;
    const layouts = { 1: [[0, 0]], 2: [[-P, -P], [P, P]], 3: [[-P, -P], [0, 0], [P, P]], 4: [[-P, -P], [P, -P], [-P, P], [P, P]], 5: [[-P, -P], [P, -P], [0, 0], [-P, P], [P, P]], 6: [[-P, -P], [P, -P], [-P, 0], [P, 0], [-P, P], [P, P]] };
    // face: [normal axis, sign, value]
    const faces = [['y', 1, 1], ['y', -1, 6], ['x', 1, 3], ['x', -1, 4], ['z', 1, 2], ['z', -1, 5]];
    for (const [ax, sg, val] of faces) {
      for (const [a, b] of layouts[val]) {
        const d = h - 0.0003;
        const p = ax === 'y' ? [a, h + sg * d, b] : ax === 'x' ? [sg * d, h + a, b] : [a, h + b, sg * d];
        const m = mesh(pip, pm, g, p[0], p[1], p[2]);
        m.scale.set(ax === 'x' ? 0.4 : 1, ax === 'y' ? 0.4 : 1, ax === 'z' ? 0.4 : 1);
        m.castShadow = false;
      }
    }
    return g;
  },
  shapes: [{ t: 'box', s: [0.008, 0.008, 0.008], p: [0, 0.008, 0] }],
});

// Pencil: 19 cm, 7 mm across the flats, 6 g. Hexagonal (it doesn't roll off the desk easily).
def({
  id: 'pencil', name: 'Pencil (#2)', category: 'Office', material: 'wood', mass: 0.006, size: 0.19, price: 0.5,
  build() {
    const g = new THREE.Group();
    const R = 0.004; // to the corners
    const yc = R * Math.cos(Math.PI / 6);
    const paint = MAT.gloss(0xf2b51c, 0.3);
    mesh(new THREE.CylinderGeometry(R, R, 0.165, 6), paint, g, -0.004, yc, 0, 0, 0, Math.PI / 2);
    const wood = MAT.food(0xd9b07a, 0.8);
    mesh(new THREE.CylinderGeometry(0.0012, R, 0.017, 6), wood, g, 0.0875, yc, 0, 0, 0, -Math.PI / 2);
    mesh(new THREE.CylinderGeometry(0.0001, 0.0012, 0.0045, 8), MAT.metal(0x2a2b2e, 0.5), g, 0.0982, yc, 0, 0, 0, -Math.PI / 2);
    const ferrule = MAT.metal(0xc9b46a, 0.3);
    mesh(new THREE.CylinderGeometry(0.0039, 0.0039, 0.011, 20), ferrule, g, -0.092, yc, 0, 0, 0, Math.PI / 2);
    for (const dx of [-0.0035, 0.0035]) mesh(new THREE.TorusGeometry(0.0039, 0.0004, 6, 20), ferrule, g, -0.092 + dx, yc, 0, 0, Math.PI / 2, 0);
    mesh(new THREE.CapsuleGeometry(0.0034, 0.004, 4, 16), MAT.plastic(0xe58c98, 0.85), g, -0.1, yc, 0, 0, 0, Math.PI / 2);
    return g;
  },
  shapes: [{ t: 'hull', pts: (() => {
    const pts = [];
    const R = 0.004, yc = R * Math.cos(Math.PI / 6);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const y = yc + Math.sin(a) * R, z = Math.cos(a) * R; // flat faces top and bottom, like the model
      pts.push([-0.104, y, z], [0.079, y, z]);
    }
    pts.push([0.1, yc, 0]);
    return pts;
  })() }],
});

// Coin (25 cents): 24.26 mm, 1.75 mm thick, 5.67 g. Reeded edge, raised rim, star design.
const coinFace = () => once('coinface', () => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const c = cv.getContext('2d');
  c.fillStyle = '#000';
  c.fillRect(0, 0, 256, 256);
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(128, 128, 127, 0, Math.PI * 2);
  c.arc(128, 128, 116, 0, Math.PI * 2, true);
  c.fill();
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * Math.PI * 2 - Math.PI / 2;
    c.beginPath();
    c.arc(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100, 5, 0, Math.PI * 2);
    c.fill();
  }
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 22 : 52;
    c.lineTo(128 + Math.cos(a) * r, 112 + Math.sin(a) * r);
  }
  c.fill();
  c.font = 'bold 38px Georgia, serif';
  c.textAlign = 'center';
  c.fillText('25', 128, 200);
  const img = c.getImageData(0, 0, 256, 256).data;
  return TX.generate('coin', 256, (u, v) => {
    const x = Math.min(255, Math.floor(u * 256)), y = Math.min(255, Math.floor((1 - v) * 256));
    const h = img[(y * 256 + x) * 4] / 255;
    const n = TX.fbm(u, v, { freq: 32, oct: 2, seed: 341 });
    const d = 0.9 + h * 0.1 - n * 0.05;
    return [0.78 * d, 0.79 * d, 0.81 * d, h * 0.8 + n * 0.05, 0.3 - h * 0.08];
  }, { normalStrength: 6 });
});
def({
  id: 'coin', name: 'Coin (25¢)', category: 'Home', material: 'metal', mass: 0.00567, size: 0.0243, price: 0.25,
  build() {
    const t = coinFace();
    const face = once('coinmat', () => std({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, metalness: 1, roughness: 1 }, { detail: 'metal' }));
    const edgeT = TX.generate('reeded', 64, (u) => {
      const s = Math.sin(u * Math.PI * 2 * 8);
      return [0.74, 0.75, 0.77, s * 0.5 + 0.5, 0.35];
    }, { normalStrength: 3 });
    const edge = once('coinedge', () => {
      const n = edgeT.normalMap.clone();
      n.repeat.set(15, 1);
      n.needsUpdate = true;
      return std({ color: 0xc7cacd, normalMap: n, metalness: 1, roughness: 0.35 }, { detail: 'metal' });
    });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.01213, 0.01213, 0.00175, 72), [edge, face, face]);
    m.position.y = 0.000875;
    m.name = 'coin'; // multi-material: keep as its own mesh
    return m;
  },
  shapes: [{ t: 'cyl', r: 0.01213, h: 0.000875, p: [0, 0.000875, 0] }],
});

// ---- prices for the starter catalog (real-world prices, US dollars) --------------------------
const PRICES = {
  soda_can: 1.49, mug: 8.99, cookie: 1.25, box: 3.49, ball: 6.99, book: 18.99, table: 249,
  sofa: 899, armchair: 349, coffee_table: 189, tv65: 649, tv_stand: 159, floor_lamp: 79, plant: 59,
  desk: 219, office_chair: 179, pc_tower: 1499, monitor: 279, keyboard: 89, mouse_pc: 39,
  bed_king: 1299, nightstand: 119, dining_chair: 69, terrarium: 129,
};
for (const [id, p] of Object.entries(PRICES)) if (CATALOG[id] && CATALOG[id].price === undefined) CATALOG[id].price = p;
if (CATALOG.crumb) CATALOG.crumb.shop = false; // crumbs come from food, not from the store
