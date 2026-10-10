// Paper money on the felt (cash buy-ins at a table): generic green-grey notes drawn with canvas
// paths — an original design, not a copy of real currency — as small planes the dealer spreads,
// counts and pushes into the drop box.
import * as THREE from 'three';

const BILL_W = 0.156;
const BILL_H = 0.066;
const DEN = [100, 50, 20, 5, 1];

let tex = null;
function billTexture() {
  if (tex) return tex;
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d');
  const cw = 512;
  const ch = 204;
  DEN.forEach((d, i) => {
    const x = (i % 2) * cw;
    const y = Math.floor(i / 2) * ch;
    g.save();
    g.translate(x, y);
    const bg = g.createLinearGradient(0, 0, cw, ch);
    bg.addColorStop(0, '#dfe3cf');
    bg.addColorStop(0.5, '#cfd8c0');
    bg.addColorStop(1, '#d9dcc6');
    g.fillStyle = bg;
    g.fillRect(0, 0, cw, ch);
    // Guilloche border.
    g.strokeStyle = 'rgba(40,70,50,0.55)';
    g.lineWidth = 1;
    for (let k = 0; k < 90; k++) {
      g.beginPath();
      g.ellipse(cw / 2, ch / 2, cw / 2 - 8 - (k % 3), ch / 2 - 8 - (k % 3), 0, (k / 90) * Math.PI * 2, (k / 90) * Math.PI * 2 + 0.25);
      g.stroke();
    }
    g.strokeStyle = '#2c4a38';
    g.lineWidth = 3;
    g.strokeRect(10, 10, cw - 20, ch - 20);
    g.lineWidth = 1;
    g.strokeRect(18, 18, cw - 36, ch - 36);
    // Portrait oval (abstract bust silhouette).
    g.fillStyle = 'rgba(44,74,56,0.18)';
    g.beginPath();
    g.ellipse(cw / 2, ch / 2, 62, 74, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#2c4a38';
    g.lineWidth = 2.5;
    g.stroke();
    g.fillStyle = 'rgba(30,50,38,0.55)';
    g.beginPath();
    g.ellipse(cw / 2, ch / 2 - 14, 22, 27, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(cw / 2, ch / 2 + 46, 46, 30, 0, Math.PI, 0);
    g.fill();
    // Denominations.
    g.fillStyle = '#1f3a2b';
    g.font = '700 54px "Playfair Display", Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const [px, py] of [[62, 52], [cw - 62, ch - 48]]) g.fillText(String(d), px, py);
    g.font = '700 30px "Playfair Display", Georgia, serif';
    for (const [px, py] of [[cw - 54, 44], [54, ch - 42]]) g.fillText(String(d), px, py);
    g.font = '600 15px Georgia, serif';
    g.fillText('LEGAL TENDER · VIRTUAL', cw / 2, 30);
    g.restore();
  });
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

const geoCache = new Map();
function billGeo(i) {
  if (geoCache.has(i)) return geoCache.get(i);
  const g = new THREE.PlaneGeometry(BILL_W, BILL_H);
  g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv;
  const x0 = (i % 2) * 0.5;
  const y1 = 1 - Math.floor(i / 2) * (204 / 512);
  const y0 = y1 - 204 / 512;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, x0 + uv.getX(k) * 0.5, y0 + uv.getY(k) * (y1 - y0));
  geoCache.set(i, g);
  return g;
}

let billMat = null;

/** Meshes for `amount` in bills (largest first), fanned like a player drops them on the felt. */
export function billsFor(amount) {
  billMat ||= new THREE.MeshStandardMaterial({ map: billTexture(), roughness: 0.85, side: THREE.DoubleSide });
  const out = [];
  let left = amount;
  for (let i = 0; i < DEN.length && out.length < 12; i++) {
    while (left >= DEN[i] && out.length < 12) {
      const m = new THREE.Mesh(billGeo(i), billMat);
      m.castShadow = true;
      m.receiveShadow = true;
      out.push(m);
      left -= DEN[i];
    }
  }
  return out;
}

export { BILL_W, BILL_H };
