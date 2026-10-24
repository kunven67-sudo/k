// Small "alive" things placed by floor builders: printed labels, Voss's notes, serum vials, live computer screens,
// whiteboards with handwriting.
import * as THREE from 'three';

const HAND = '"Segoe Print","Bradley Hand","Comic Neue","Ink Free",cursive';

export function makeLabel({ text, size = 0.3, ink = '#1a1a1a', bg = null, small = false, card = false }) {
  const cv = document.createElement('canvas');
  const fontPx = 96;
  const g = cv.getContext('2d');
  const font = card ? `600 ${fontPx}px "Courier New",monospace` : `800 ${fontPx}px "Arial Narrow","Helvetica Neue",Arial,sans-serif`;
  g.font = font;
  const w = Math.ceil(g.measureText(text).width + fontPx * (card ? 0.8 : 0.4)), h = Math.ceil(fontPx * 1.4);
  cv.width = Math.min(2048, w); cv.height = h;
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (card) { g.fillStyle = '#f4f1e8'; g.fillRect(0, 0, cv.width, h); g.strokeStyle = '#c8c2b0'; g.lineWidth = 6; g.strokeRect(3, 3, cv.width - 6, h - 6); }
  else if (bg) { g.fillStyle = bg; g.fillRect(0, 0, cv.width, h); }
  g.fillStyle = ink; g.fillText(text, cv.width / 2, h / 2 + 4);
  if (!card && !bg) { // stencil paint: a little rough
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 260; i++) { g.globalAlpha = Math.random() * 0.35; g.fillRect(Math.random() * cv.width, Math.random() * h, 2 + Math.random() * 6, 2 + Math.random() * 3); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const H = small ? size * 0.12 : size, W = H * cv.width / h;
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: !card && !bg, roughness: card ? 0.85 : 0.7, alphaTest: !card && !bg ? 0.2 : 0, polygonOffset: true, polygonOffsetFactor: -2 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(card ? H * 3.2 : W, card ? H * 1.3 : H), mat);
  if (card) { // the text card keeps the text size, the card is a fixed size
    tex.repeat.set(1, 1);
    m.geometry.dispose(); m.geometry = new THREE.PlaneGeometry(Math.max(W, H * 2.4), H * 1.25);
  }
  m.receiveShadow = true;
  return m;
}

export function placeLabels(list, parent) {
  for (const L of list) {
    const m = makeLabel(L);
    m.position.set(L.x, L.y, L.z); m.rotation.y = L.rot || 0;
    parent.add(m);
  }
}

// a sheet of paper (note) lying on a surface; E near it = read
export function makeNote() {
  const g = new THREE.PlaneGeometry(0.21, 0.297); g.rotateX(-Math.PI / 2);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 362; const x = cv.getContext('2d');
  x.fillStyle = '#f2efe6'; x.fillRect(0, 0, 256, 362);
  x.fillStyle = '#1c2a4a'; x.font = '600 18px ' + HAND;
  for (let i = 0; i < 14; i++) { x.globalAlpha = 0.7; x.fillRect(22, 40 + i * 22, 140 + Math.random() * 70, 2); }
  x.globalAlpha = 1; x.fillText('E. Voss', 150, 340);
  x.fillStyle = 'rgba(160,20,20,0.8)'; x.font = '700 22px ' + HAND; x.fillText('CONFIDENTIAL', 24, 28);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3 }));
  m.receiveShadow = true;
  return m;
}

// serum vial: glass + glowing liquid
export function makeVial(kind) {
  const g = new THREE.Group();
  const col = kind === 'growth' ? 0x40ff7a : 0xb050ff;
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.05, 14, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }));
  glass.position.y = 0.025;
  const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.0082, 0.0082, 0.034, 14), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2.2, roughness: 0.2, transparent: true, opacity: 0.9 }));
  liq.position.y = 0.018;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.008, 14), new THREE.MeshStandardMaterial({ color: 0xc8c8c8, metalness: 1, roughness: 0.3 }));
  cap.position.y = 0.052;
  g.add(glass, liq, cap);
  g.userData.kind = kind;
  return g;
}

// live screen: draws into a canvas a few times a second
export class Screen {
  constructor(kind, w, h, pxW = 512) {
    this.kind = kind;
    this.cv = document.createElement('canvas'); this.cv.width = pxW; this.cv.height = Math.round(pxW * h / w);
    this.g = this.cv.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.cv); this.tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: this.tex });
    mat.color.setScalar(1.6);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    this.t = 0; this.acc = 0; this.hist = [];
    this.lines = [];
  }
  update(dt, info) {
    this.t += dt; this.acc += dt;
    if (this.acc < 0.2) return;
    this.acc = 0;
    const g = this.g, W = this.cv.width, H = this.cv.height;
    if (this.kind === 'vitals') {
      g.fillStyle = '#020806'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#18ff8a'; g.font = '700 22px monospace';
      g.fillText('SPECIMEN 8  /  L. hesperus (mod.)', 14, 30);
      g.font = '16px monospace'; g.fillStyle = '#7dffbf';
      const s = info || {};
      g.fillText('BODY LEN  ' + (s.size || '4.0 mm'), 14, 60);
      g.fillText('MASS      ' + (s.mass || '0.009 g'), 14, 82);
      g.fillText('DOSE      #4  (3.2x)', 14, 104);
      g.fillText('STATUS    ' + (s.status || 'CONTAINED'), 14, 126);
      // heart trace (spider heart ~ 30-70 bpm at rest; panics fast)
      const rate = s.hr || 1.2;
      this.hist.push(Math.max(0, Math.sin(this.t * rate * 6.28)) ** 8 * (0.8 + Math.random() * 0.2));
      if (this.hist.length > 120) this.hist.shift();
      g.strokeStyle = '#18ff8a'; g.lineWidth = 2; g.beginPath();
      this.hist.forEach((v, i) => { const x = 14 + i * (W - 28) / 120, y = H - 30 - v * (H * 0.35); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.stroke();
      if (s.status && s.status !== 'CONTAINED' && Math.floor(this.t * 3) % 2) { g.fillStyle = '#ff2a1a'; g.font = '700 26px monospace'; g.fillText('!! CONTAINMENT BREACH !!', 14, H - 64); }
    } else if (this.kind === 'code') {
      if (this.lines.length === 0 || Math.random() < 0.6) this.lines.push(randLine());
      if (this.lines.length > 22) this.lines.shift();
      g.fillStyle = '#0b1016'; g.fillRect(0, 0, W, H);
      g.font = '14px monospace';
      this.lines.forEach((l, i) => { g.fillStyle = l[1]; g.fillText(l[0], 10, 20 + i * 18); });
    } else if (this.kind === 'graph') {
      g.fillStyle = '#f4f6f8'; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#c8d0d8'; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(0, i * H / 8); g.lineTo(W, i * H / 8); g.stroke(); }
      g.strokeStyle = '#2a6ad8'; g.lineWidth = 3; g.beginPath();
      for (let i = 0; i < 60; i++) { const x = i * W / 59, y = H * 0.85 - Math.exp(i / 22) * H * 0.07 - Math.sin(i + this.t) * 3; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke(); g.fillStyle = '#333'; g.font = '700 16px Arial'; g.fillText('GROWTH RESPONSE vs DOSE', 12, 22);
    }
    this.tex.needsUpdate = true;
  }
}
const CODE = ['seq_align(L.hesp, ref=TX-4)', 'dose_curve.fit(k=3.2)', 'chitin.sclerotin += 0.41', 'WARN: molt cycle unstable', 'serum_batch[8].status = ACTIVE',
  'telemetry.vibration.peak = 2.4 Hz', 'cell_div_rate *= 1.07', 'specimen[1..7] -> ARCHIVE', 'neuro.mass_index = 0.91', 'export results -> voss_private/'];
function randLine() { const c = ['#9fd0ff', '#ffd27a', '#8affb0', '#ff8a8a', '#d0d0d0'][Math.floor(Math.random() * 5)]; return ['> ' + CODE[Math.floor(Math.random() * CODE.length)] + (Math.random() < 0.3 ? '  ok' : ''), c]; }

// whiteboard with handwriting
export function makeBoard(w, h, lines) {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = Math.round(1024 * h / w);
  const g = cv.getContext('2d');
  g.fillStyle = '#f7f8f6'; g.fillRect(0, 0, cv.width, cv.height);
  // old smudges
  for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(80,90,110,${Math.random() * 0.05})`; g.beginPath(); g.ellipse(Math.random() * cv.width, Math.random() * cv.height, 40 + Math.random() * 120, 10 + Math.random() * 30, Math.random(), 0, 7); g.fill(); }
  let y = 70;
  for (const [txt, col, size] of lines) {
    g.fillStyle = col || '#1a2a6a'; g.font = `${size || 44}px ` + HAND;
    g.save(); g.translate(50 + Math.random() * 20, y); g.rotate((Math.random() - 0.5) * 0.03); g.fillText(txt, 0, 0); g.restore();
    y += (size || 44) * 1.35;
  }
  // growth curve sketch
  g.strokeStyle = '#a01818'; g.lineWidth = 5; g.beginPath(); g.moveTo(640, cv.height - 60);
  for (let i = 0; i <= 30; i++) g.lineTo(640 + i * 11, cv.height - 60 - Math.exp(i / 9) * 9);
  g.stroke(); g.beginPath(); g.moveTo(630, cv.height - 50); g.lineTo(980, cv.height - 50); g.moveTo(640, cv.height - 40); g.lineTo(640, cv.height - 360); g.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.25, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.receiveShadow = true;
  return m;
}
export const BOARD_48 = [
  ['SPECIMEN 8  -  day 41', '#1a2a6a', 54], ['dose #4: 3.2x baseline growth', '#1a2a6a'], ['molt interval 9h -> 2h ?!', '#a01818'],
  ['1-7: exoskeleton failure > 2 cm', '#1a2a6a'], ['8 survives. WHY?', '#a01818', 52], ['-> silk tensile x6', '#1a2a6a'], ['DO NOT tell the board', '#202020', 38],
];
