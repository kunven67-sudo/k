// Repeated fixtures: crystal chandeliers (brass frame merged into the batch; crystals and candle
// bulbs instanced — two draw calls for every chandelier in the room), smoked eye-in-the-sky domes
// (instanced), and the painted sign faces / fresco used around the floor.
import * as THREE from 'three';
import { t } from '../../core/i18n.js';
import { Rng } from '../../core/rng.js';
import { CEIL_Y, COFFER_DEPTH } from '../layout.js';
import { signMat, fitFont, goldFill } from './mats.js';

const DOWN = new THREE.Vector3(0, -1, 0);

export class Chandeliers {
  constructor(C) {
    this.C = C;
    this.crystals = []; // matrices
    this.bulbs = [];
    this.rng = new Rng('chandeliers');
  }

  /** A two-tier crystal chandelier hanging from a coffer panel at (x, z). s = scale. */
  add(x, z, s = 1, top = CEIL_Y + COFFER_DEPTH) {
    const { M, add, glows, pool, spots } = this.C;
    const r = this.rng;
    const y0 = top - 0.42 * s; // bottom of the chain / canopy
    const P = (geo, px, py, pz) => geo.translate(px, py, pz);
    // Ceiling canopy + chain.
    add(P(new THREE.CylinderGeometry(0.16 * s, 0.22 * s, 0.08, 20), x, top - 0.04, z), M.gold);
    for (let i = 0; i < 6; i++) add(P(new THREE.TorusGeometry(0.025 * s, 0.007 * s, 4, 8).rotateY((i % 2) * Math.PI / 2), x, top - 0.11 - i * 0.055 * s, z), M.brass, { castShadow: false });
    // Central column (lathe profile).
    const prof = [[0, 0], [0.07, 0.02], [0.05, 0.12], [0.11, 0.22], [0.06, 0.34], [0.09, 0.44], [0.16, 0.5], [0.05, 0.62], [0.03, 0.78], [0, 0.8]].map(([a, b]) => new THREE.Vector2(a * s, -b * s));
    add(P(new THREE.LatheGeometry(prof, 18), x, y0, z), M.gold);
    // Arms: lower tier of 8, upper of 6, each an S-curve ending in a candle cup.
    const tiers = [{ n: 8, R: 0.62 * s, y: y0 - 0.5 * s }, { n: 6, R: 0.38 * s, y: y0 - 0.2 * s }];
    for (const T of tiers) {
      add(P(new THREE.TorusGeometry(T.R * 0.55, 0.012 * s, 6, 40).rotateX(Math.PI / 2), x, T.y - 0.02 * s, z), M.gold);
      for (let k = 0; k < T.n; k++) {
        const a = (k / T.n) * Math.PI * 2 + (T.n === 6 ? Math.PI / 6 : 0);
        const cx = Math.cos(a);
        const cz = Math.sin(a);
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(cx * T.R * 0.35, -0.08 * s, cz * T.R * 0.35),
          new THREE.Vector3(cx * T.R * 0.75, -0.02 * s, cz * T.R * 0.75),
          new THREE.Vector3(cx * T.R, 0.08 * s, cz * T.R),
        ]);
        add(P(new THREE.TubeGeometry(curve, 10, 0.013 * s, 6, false), x, T.y, z), M.gold);
        const tipX = x + cx * T.R;
        const tipZ = z + cz * T.R;
        const tipY = T.y + 0.08 * s;
        add(P(new THREE.CylinderGeometry(0.045 * s, 0.025 * s, 0.05 * s, 12), tipX, tipY + 0.025 * s, tipZ), M.gold);
        add(P(new THREE.CylinderGeometry(0.014 * s, 0.014 * s, 0.11 * s, 8), tipX, tipY + 0.105 * s, tipZ), M.paper);
        this.bulbs.push(new THREE.Vector3(tipX, tipY + 0.19 * s, tipZ), s);
        // Crystal drops hanging under each arm: a strand of 3 + a teardrop.
        for (let j = 0; j < 3; j++) this._crystal(x + cx * T.R * 0.7, T.y - 0.05 * s - j * 0.06 * s, z + cz * T.R * 0.7, 0.024 * s, r);
        this._crystal(x + cx * T.R * 0.7, T.y - 0.24 * s, z + cz * T.R * 0.7, 0.04 * s, r, 1.8);
        // Swags between arms.
        const b = a + Math.PI / T.n;
        for (let j = 1; j < 6; j++) {
          const u = j / 6;
          const aa = a + (b - a) * 2 * u;
          const sag = Math.sin(u * Math.PI) * 0.12 * s;
          this._crystal(x + Math.cos(aa) * T.R * 0.92, T.y + 0.02 * s - sag, z + Math.sin(aa) * T.R * 0.92, 0.014 * s, r);
        }
      }
    }
    // Bowl of pendants under the body.
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      for (let j = 0; j < 4; j++) this._crystal(x + Math.cos(a) * 0.12 * s * (1 - j * 0.2), y0 - 0.66 * s - j * 0.07 * s, z + Math.sin(a) * 0.12 * s * (1 - j * 0.2), 0.022 * s, r);
    }
    this._crystal(x, y0 - 0.98 * s, z, 0.07 * s, r, 2);
    // Light: a real-light candidate, a halo on the coffer, a warm pool on the floor.
    const c = new THREE.Vector3(x, y0 - 0.45 * s, z);
    pool.add({ pos: c, color: 0xffd6a0, intensity: 7 * s, distance: 10 * s, weight: 1.3 });
    glows.add(new THREE.Vector3(x, top - 0.012, z), DOWN, 3.2 * s, 0xffd8a8, 0.55);
    spots.add(x, z, 3.2 * s, 0.42, 0xffd6a0);
    return c;
  }

  _crystal(x, y, z, size, r, stretch = 1.4) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r.range(0, Math.PI)),
      new THREE.Vector3(size, size * stretch, size)
    );
    this.crystals.push(m);
  }

  build(group) {
    const out = [];
    if (this.crystals.length) {
      const mat = new THREE.MeshStandardMaterial({ color: 0xfaf6ff, metalness: 0.95, roughness: 0.04, envMapIntensity: 3.2, emissive: 0xffe6c0, emissiveIntensity: 0.18, flatShading: true });
      mat.name = 'crystal';
      const im = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), mat, this.crystals.length);
      this.crystals.forEach((m, i) => im.setMatrixAt(i, m));
      im.computeBoundingSphere();
      im.name = 'casino-crystals';
      group.add(im);
      out.push(im);
    }
    if (this.bulbs.length) {
      const pts = this.bulbs.filter((b) => b.isVector3);
      const scales = this.bulbs.filter((b) => !b.isVector3);
      const g = new THREE.SphereGeometry(1, 10, 8).scale(1, 1.6, 1);
      const im = new THREE.InstancedMesh(g, this.C.M.candle, pts.length);
      pts.forEach((p, i) => im.setMatrixAt(i, new THREE.Matrix4().compose(p, new THREE.Quaternion(), new THREE.Vector3(1, 1, 1).multiplyScalar(0.022 * (scales[i] || 1)))));
      im.computeBoundingSphere();
      im.name = 'casino-candle-bulbs';
      group.add(im);
      out.push(im);
    }
    return out;
  }
}

/** Smoked surveillance domes (instanced) with a gilded trim ring each (batched). */
export function eyeDomes(C, list) {
  if (!list.length) return null;
  const g = new THREE.SphereGeometry(0.3, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const im = new THREE.InstancedMesh(g, C.M.smoked, list.length);
  list.forEach((p, i) => {
    im.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y - 0.005, p.z));
    C.add(new THREE.TorusGeometry(0.31, 0.022, 6, 28).rotateX(Math.PI / 2).translate(p.x, p.y - 0.012, p.z), C.M.chrome, { castShadow: false });
  });
  im.computeBoundingSphere();
  im.name = 'casino-eye-domes';
  im.castShadow = false;
  C.group.add(im);
  return im;
}

// ---- sign faces --------------------------------------------------------------------------

/** All canvas-painted faces used by the floor (built once; text through t()). */
export function casinoSigns() {
  const S = {};
  S.exit = signMat('exit', 256, 96, (g, w, h) => {
    g.fillStyle = '#1b0505';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff3a2a';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    fitFont(g, t('casino.sign.exit'), w - 30, 72, (s) => `400 ${s}px "Bebas Neue"`);
    g.shadowColor = '#ff2a1a';
    g.shadowBlur = 12;
    g.fillText(t('casino.sign.exit'), w / 2, h / 2 + 4);
  }, { lit: 2.2 });
  S.fresco = frescoMat();
  return S;
}

/**
 * Engraved brass plaque / back-lit sign with a gilded title and an optional subtitle.
 * style: 'wood' (gold leaf on dark walnut), 'lit' (cream glass, back-lit), 'brass' (etched).
 */
export function plaque(key, title, sub = '', { w = 1024, h = 256, style = 'wood', lit = 0, font = '"Playfair Display"' } = {}) {
  return signMat(`plaque:${key}:${title}:${sub}:${style}`, w, h, (g, W, H) => {
    if (style === 'wood') {
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#2a140a');
      gr.addColorStop(0.5, '#3a1d0e');
      gr.addColorStop(1, '#1e0e06');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 0.18;
      for (let i = 0; i < 60; i++) {
        g.strokeStyle = i % 2 ? '#5a3418' : '#120804';
        g.lineWidth = 1 + (i % 3);
        g.beginPath();
        const y = (i / 60) * H;
        g.moveTo(0, y);
        g.bezierCurveTo(W * 0.3, y + 6, W * 0.6, y - 6, W, y + 3);
        g.stroke();
      }
      g.globalAlpha = 1;
    } else if (style === 'brass') {
      const gr = g.createLinearGradient(0, 0, W, H);
      gr.addColorStop(0, '#b8893a');
      gr.addColorStop(0.5, '#e8c878');
      gr.addColorStop(1, '#9a7030');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
    } else {
      const gr = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W * 0.6);
      gr.addColorStop(0, '#fff6e0');
      gr.addColorStop(1, '#e8d2a0');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
    }
    // Double gilt border.
    g.strokeStyle = style === 'brass' ? '#5a3c12' : '#c9a24f';
    g.lineWidth = Math.max(3, H * 0.025);
    g.strokeRect(H * 0.06, H * 0.06, W - H * 0.12, H - H * 0.12);
    g.lineWidth = Math.max(1, H * 0.008);
    g.strokeRect(H * 0.1, H * 0.1, W - H * 0.2, H - H * 0.2);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const ty = sub ? H * 0.42 : H * 0.53;
    const size = fitFont(g, title, W - H * 0.5, (sub ? 0.42 : 0.56) * H, (s) => `700 ${s}px ${font}`);
    if (style === 'lit') {
      g.fillStyle = '#5a1418';
    } else if (style === 'brass') {
      g.fillStyle = '#2a1806';
    } else {
      g.fillStyle = goldFill(g, ty - size / 2, ty + size / 2);
      g.shadowColor = 'rgba(0,0,0,.6)';
      g.shadowOffsetY = 3;
      g.shadowBlur = 4;
    }
    g.fillText(title, W / 2, ty);
    g.shadowColor = 'transparent';
    if (sub) {
      fitFont(g, sub, W - H * 0.5, H * 0.17, (s) => `italic 400 ${s}px "Playfair Display"`);
      g.fillStyle = style === 'wood' ? '#e8d6a8' : style === 'brass' ? '#3a2408' : '#6a3a20';
      g.fillText(sub, W / 2, H * 0.74);
    }
  }, { lit, rough: style === 'brass' ? 0.3 : 0.55, metal: style === 'brass' ? 0.8 : 0 });
}

function frescoMat() {
  const m = signMat('dome-fresco', 1024, 1024, (g, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const R = w / 2;
    // Sky: deep blue at the oculus, warm cream toward the rim where the cove light washes it.
    const sky = g.createRadialGradient(cx, cy, R * 0.08, cx, cy, R);
    sky.addColorStop(0, '#fff2cf');
    sky.addColorStop(0.12, '#6f9ccc');
    sky.addColorStop(0.45, '#8db3d8');
    sky.addColorStop(0.75, '#d9c9a8');
    sky.addColorStop(0.92, '#f4dca8');
    sky.addColorStop(1, '#c9a060');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    // Clouds: soft overlapping blobs in a ring.
    const rng = new Rng('fresco');
    for (let i = 0; i < 220; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = R * rng.range(0.22, 0.78);
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      const s = rng.range(18, 60) * (0.6 + r / R);
      const cl = g.createRadialGradient(x, y, 0, x, y, s);
      const warm = rng.range(0, 1) < 0.5;
      cl.addColorStop(0, warm ? 'rgba(255,244,226,.55)' : 'rgba(250,250,255,.5)');
      cl.addColorStop(0.6, warm ? 'rgba(250,226,196,.22)' : 'rgba(225,232,245,.2)');
      cl.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = cl;
      g.beginPath();
      g.arc(x, y, s, 0, Math.PI * 2);
      g.fill();
    }
    // Gilded ribs from the oculus to the rim, with painted laurel bands.
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      g.save();
      g.translate(cx, cy);
      g.rotate(a);
      const gr = g.createLinearGradient(0, -10, 0, 10);
      gr.addColorStop(0, '#7a5520');
      gr.addColorStop(0.5, '#f4d68a');
      gr.addColorStop(1, '#7a5520');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(R * 0.13, -5);
      g.lineTo(R * 0.99, -11);
      g.lineTo(R * 0.99, 11);
      g.lineTo(R * 0.13, 5);
      g.fill();
      for (let j = 0; j < 14; j++) {
        const rr = R * (0.2 + j * 0.055);
        g.fillStyle = 'rgba(90,110,60,.55)';
        g.beginPath();
        g.ellipse(rr, j % 2 ? 9 : -9, 9, 4, j % 2 ? 0.5 : -0.5, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }
    // Gold stars scattered in the sky.
    for (let i = 0; i < 90; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = R * rng.range(0.16, 0.7);
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      const s = rng.range(2, 5);
      g.fillStyle = 'rgba(255,226,150,.9)';
      g.beginPath();
      for (let p = 0; p < 10; p++) {
        const rr = p % 2 ? s * 0.4 : s;
        const aa = (p / 10) * Math.PI * 2;
        g.lineTo(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr);
      }
      g.fill();
    }
    // Oculus: sunburst + ring of gold.
    for (let k = 0; k < 32; k++) {
      g.save();
      g.translate(cx, cy);
      g.rotate((k / 32) * Math.PI * 2);
      g.fillStyle = k % 2 ? 'rgba(255,236,180,.7)' : 'rgba(255,214,120,.55)';
      g.beginPath();
      g.moveTo(0, -4);
      g.lineTo(R * (k % 2 ? 0.16 : 0.2), 0);
      g.lineTo(0, 4);
      g.fill();
      g.restore();
    }
    g.lineWidth = 10;
    g.strokeStyle = '#d8b060';
    g.beginPath();
    g.arc(cx, cy, R * 0.13, 0, Math.PI * 2);
    g.stroke();
    // Rim: gilded frame.
    g.lineWidth = 18;
    g.strokeStyle = '#b8893a';
    g.beginPath();
    g.arc(cx, cy, R * 0.985, 0, Math.PI * 2);
    g.stroke();
  }, { lit: 0.55, rough: 0.8 });
  return m;
}
