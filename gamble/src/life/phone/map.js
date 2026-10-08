// Maps app canvas: a clean 2D map of the downtown slice (from the shared Reno layout contract),
// with a pulsing blue GPS dot and a heading cone. North is up; world -Z = north, +X = east.

import { ROADS, FOOTPRINTS, RESERVED, ARCH_Z, TRENCH, BOUNDS } from '../../world/reno/layout.js';
import { t } from '../../core/i18n.js';

const C = {
  land: '#efebe3',
  block: '#e4dfd4',
  casino: '#e9d9c8',
  casinoEdge: '#d6c0a6',
  motel: '#f1dbe2',
  motelEdge: '#d9a9b9',
  roadEdge: '#cfc8bb',
  road: '#ffffff',
  arterial: '#ffe9a8',
  arterialEdge: '#e8c66a',
  rail: '#9a9fa8',
  text: '#5b5f66',
  label: '#3a3d42',
  water: '#b8d6ef',
};

// Truckee River runs just south of the slice; a hint of it at the bottom edge sells "real map".
const RIVER_Z = 175;

export class MapView {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.zoom = 1.9; // px per metre (CSS px)
    this.t = 0;
  }

  setZoom(z) {
    this.zoom = Math.min(3, Math.max(0.35, z));
  }

  draw(dt, pos, yaw) {
    this.t += dt;
    const cv = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth || 256;
    const H = cv.clientHeight || 480;
    if (cv.width !== Math.round(W * dpr)) (cv.width = Math.round(W * dpr)), (cv.height = Math.round(H * dpr));
    const g = this.g;
    const z = this.zoom;
    const cx = pos ? pos.x : 100;
    const cz = pos ? pos.z : 0;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = C.land;
    g.fillRect(0, 0, W, H);
    // World → screen.
    const X = (x) => W / 2 + (x - cx) * z;
    const Y = (wz) => H * 0.58 + (wz - cz) * z;
    const rect = (r, fill, edge) => {
      const x = X(r.x0);
      const y = Y(r.z0);
      g.fillStyle = fill;
      g.fillRect(x, y, (r.x1 - r.x0) * z, (r.z1 - r.z0) * z);
      if (edge) {
        g.strokeStyle = edge;
        g.lineWidth = 1;
        g.strokeRect(x + 0.5, y + 0.5, (r.x1 - r.x0) * z - 1, (r.z1 - r.z0) * z - 1);
      }
    };

    // River + built area.
    g.fillStyle = C.water;
    g.fillRect(0, Y(RIVER_Z), W, 14 * z);
    rect({ x0: BOUNDS.x0, x1: BOUNDS.x1, z0: BOUNDS.z0, z1: BOUNDS.z1 }, C.block);

    // Casinos and the motel.
    for (const [k, f] of Object.entries(FOOTPRINTS)) rect(f, C.casino, C.casinoEdge, k);
    rect(RESERVED.starlite, C.motel, C.motelEdge);

    // Railroad trench: grey band with sleepers.
    g.fillStyle = '#dcd8d0';
    g.fillRect(0, Y(TRENCH.z0), W, (TRENCH.z1 - TRENCH.z0) * z);
    g.strokeStyle = C.rail;
    g.lineWidth = 1.2;
    const ry = Y((TRENCH.z0 + TRENCH.z1) / 2);
    g.beginPath();
    g.moveTo(0, ry);
    g.lineTo(W, ry);
    g.stroke();
    g.setLineDash([1.2, 5]);
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(0, ry);
    g.lineTo(W, ry);
    g.stroke();
    g.setLineDash([]);

    // Roads: casing first, then fill, so crossings merge cleanly.
    const arterial = (r) => r.id === '4th' || r.id === 'virginia';
    for (const pass of [0, 1]) {
      for (const r of ROADS) {
        const hw = r.hw + (pass === 0 ? 1.4 / z : 0);
        g.fillStyle = pass === 0 ? (arterial(r) ? C.arterialEdge : C.roadEdge) : arterial(r) ? C.arterial : C.road;
        if (r.axis === 'x') g.fillRect(X(r.from), Y(r.c - hw), (r.to - r.from) * z, hw * 2 * z);
        else g.fillRect(X(r.c - hw), Y(r.from), hw * 2 * z, (r.to - r.from) * z);
      }
    }

    // Reno Arch: a small red arc over Virginia.
    g.strokeStyle = '#c8323a';
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(X(0), Y(ARCH_Z) + 3, 9 * z, Math.PI * 1.1, Math.PI * 1.9);
    g.stroke();

    // Road labels (along the road, skipping the part under the GPS dot).
    g.font = '600 9.5px Inter, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const labels = [
      ['4th', 'map.4th'],
      ['virginia', 'map.virginia'],
      ['commercial', 'map.commercial'],
      ['5th', 'map.5th'],
      ['lake', 'map.lake'],
    ];
    for (const [id, key] of labels) {
      const r = ROADS.find((q) => q.id === id);
      if (!r) continue;
      const text = t(`life.${key}`);
      // Label at the middle of the visible stretch of the road (skip roads off screen).
      g.save();
      if (r.axis === 'x') {
        const a = Math.max(X(r.from), 0);
        const b = Math.min(X(r.to), W);
        const y = Y(r.c);
        if (b - a < 90 || y < 0 || y > H) {
          g.restore();
          continue;
        }
        let x = (a + b) / 2;
        if (Math.abs(x - W / 2) < 50 && Math.abs(y - H * 0.58) < 30) x = Math.min(b - 45, x + 90);
        g.translate(x, y);
      } else {
        const a = Math.max(Y(r.from), 0);
        const b = Math.min(Y(r.to), H);
        const x = X(r.c);
        if (b - a < 90 || x < 0 || x > W) {
          g.restore();
          continue;
        }
        let y = (a + b) / 2;
        if (Math.abs(y - H * 0.58) < 60 && Math.abs(x - W / 2) < 30) y = Math.max(a + 45, y - 110);
        g.translate(x, y);
        g.rotate(-Math.PI / 2);
      }
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(255,255,255,.9)';
      g.strokeText(text, 0, 0.5);
      g.fillStyle = C.text;
      g.fillText(text, 0, 0.5);
      g.restore();
    }

    // Place labels with little pins.
    const places = [
      ['map.eldorado', (FOOTPRINTS.eldorado.x0 + FOOTPRINTS.eldorado.x1) / 2, 56, '#a8742a'],
      ['map.legacy', (FOOTPRINTS.silverLegacy.x0 + FOOTPRINTS.silverLegacy.x1) / 2, -60, '#a8742a'],
      ['map.circus', (FOOTPRINTS.circusCircus.x0 + FOOTPRINTS.circusCircus.x1) / 2, -172, '#a8742a'],
      ['map.starlite', 205, -33, '#c0436b'],
      ['map.arch', 0, ARCH_Z - 9, '#c8323a'],
    ];
    g.font = '600 10px Inter, system-ui, sans-serif';
    for (const [key, x, wz, col] of places) {
      const sx = X(x);
      const sy = Y(wz);
      if (sx < -60 || sx > W + 60 || sy < -20 || sy > H + 20) continue;
      g.fillStyle = col;
      g.beginPath();
      g.arc(sx, sy - 9, 4.2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(sx, sy - 9, 1.6, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(255,255,255,.92)';
      const label = t(`life.${key}`);
      g.strokeText(label, sx, sy + 3);
      g.fillStyle = C.label;
      g.fillText(label, sx, sy + 3);
    }

    // GPS: accuracy halo, heading cone, dot.
    if (pos) {
      const px = W / 2;
      const py = H * 0.58;
      const pulse = (this.t % 2) / 2;
      g.fillStyle = `rgba(66,133,244,${0.18 * (1 - pulse)})`;
      g.beginPath();
      g.arc(px, py, 10 + pulse * 26, 0, Math.PI * 2);
      g.fill();
      if (yaw != null) {
        const grad = g.createRadialGradient(px, py, 0, px, py, 42);
        grad.addColorStop(0, 'rgba(66,133,244,.45)');
        grad.addColorStop(1, 'rgba(66,133,244,0)');
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(px, py);
        // yaw: 0 = facing -Z (north) in world → up on the map.
        const a = -Math.PI / 2 + yaw;
        g.arc(px, py, 42, a - 0.45, a + 0.45);
        g.closePath();
        g.fill();
      }
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(px, py, 8, 0, Math.PI * 2);
      g.shadowColor = 'rgba(0,0,0,.3)';
      g.shadowBlur = 4;
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = '#4285f4';
      g.beginPath();
      g.arc(px, py, 5.6, 0, Math.PI * 2);
      g.fill();
    }

    // Scale bar.
    const metres = z > 1.5 ? 50 : z > 0.7 ? 100 : 200;
    g.fillStyle = C.text;
    g.font = '500 9px Inter, system-ui, sans-serif';
    g.textAlign = 'left';
    g.fillRect(12, H - 16, metres * z, 2);
    g.fillText(`${metres} m`, 12, H - 24);
  }
}
