// SPINBORN giant glowing wheel: metal rim with chasing bulbs, lit slices, clicking pointer, sparks, light burst, golden mode.
import * as THREE from 'three';
import { drawText, FONT } from './text.js';

const TAU = Math.PI * 2;

// color helpers ------------------------------------------------------------
function hexToHsl(hex) {
  const c = new THREE.Color(hex); const o = {}; c.getHSL(o, THREE.SRGBColorSpace); return o;
}
export function sliceColors(color, n, labels) {
  const out = [];
  if (color === 'rainbow') {
    for (let i = 0; i < n; i++) { const h = (i * 0.61803398875) % 1; out.push(new THREE.Color().setHSL(h, 0.7, 0.34 + (i % 3) * 0.05, THREE.SRGBColorSpace)); }
  } else if (color === 'yesno') {
    for (let i = 0; i < n; i++) out.push(new THREE.Color(labels[i] === 'Yes' ? '#2f9a36' : '#a01818'));
  } else if (color === 'improves') {
    const m = { Strength: '#d41f1f', IQ: '#0f6a78', 'Power mastery': '#3d6b16', 'Weapon mastery': '#5a1c8a', 'Fighting experience': '#7a1010', Durability: '#a01452', Speed: '#d8d000' };
    for (let i = 0; i < n; i++) out.push(new THREE.Color(m[labels[i]] || '#444'));
  } else {
    const { h, s, l } = hexToHsl(color);
    for (let i = 0; i < n; i++) {
      const k = ((i * 7) % 5) / 4; // pseudo random shade like his wheels
      out.push(new THREE.Color().setHSL(h, Math.min(1, s * 0.95), Math.max(0.13, Math.min(0.6, l * (0.52 + k * 0.78))), THREE.SRGBColorSpace));
    }
  }
  return out;
}

export function glowTexture(size = 256, inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, inner); gr.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.55)')); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function burstTexture(size = 512) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  g.translate(size / 2, size / 2);
  for (let i = 0; i < 28; i++) {
    g.rotate(TAU / 28);
    const gr = g.createLinearGradient(0, 0, size / 2, 0); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, -3); g.lineTo(size / 2, -(i % 2 ? 14 : 26)); g.lineTo(size / 2, i % 2 ? 14 : 26); g.lineTo(0, 3); g.fill();
  }
  const r = g.createRadialGradient(0, 0, 0, 0, 0, size / 4); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(-size / 2, -size / 2, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Wheel3D {
  constructor({ radius = 1.5, envMap, audio, onTick } = {}) {
    this.R = radius; this.audio = audio; this.onTick = onTick;
    this.group = new THREE.Group(); this.group.name = 'wheel';
    this.spinGroup = new THREE.Group(); this.group.add(this.spinGroup);
    this.angle = 0; this.spinning = false; this.slices = []; this.weights = []; this.result = -1; this.gold = false;
    this._t = 0;

    // disc texture
    this.canvas = document.createElement('canvas'); this.canvas.width = this.canvas.height = 2048;
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8;
    this.discMat = new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false });
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(this.R, 256), this.discMat);
    this.spinGroup.add(this.disc);

    const metal = new THREE.MeshStandardMaterial({ color: 0xc8ccd4, metalness: 1, roughness: 0.22, envMap, envMapIntensity: 1.4 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1b1d22, metalness: 0.7, roughness: 0.35, envMap, envMapIntensity: 0.8 });
    this.metal = metal;
    // rim (two tori) + back plate
    this.rim = new THREE.Mesh(new THREE.TorusGeometry(this.R + 0.07, 0.085, 24, 180), metal); this.rim.position.z = 0.02; this.group.add(this.rim);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(this.R + 0.005, 0.025, 12, 180), dark); inner.position.z = 0.02; this.group.add(inner);
    const back = new THREE.Mesh(new THREE.CylinderGeometry(this.R + 0.16, this.R + 0.2, 0.12, 96, 1), dark);
    back.rotation.x = Math.PI / 2; back.position.z = -0.08; this.group.add(back);
    // hub (like his: dark disk + light ring)
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(this.R * 0.2, this.R * 0.21, 0.08, 64), dark); hub.rotation.x = Math.PI / 2; hub.position.z = 0.04; this.spinGroup.add(hub);
    const hubRing = new THREE.Mesh(new THREE.TorusGeometry(this.R * 0.11, this.R * 0.016, 12, 64), new THREE.MeshStandardMaterial({ color: 0x6d7077, metalness: 0.8, roughness: 0.3, envMap }));
    hubRing.position.z = 0.09; this.spinGroup.add(hubRing);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(this.R * 0.06, 24, 12, 0, TAU, 0, Math.PI / 2), metal); cap.rotation.x = Math.PI / 2; cap.position.z = 0.08; this.group.add(cap);

    // bulbs on the rim (instanced), chase lights
    this.nBulbs = 48;
    this.bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.036, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), this.nBulbs);
    const m = new THREE.Matrix4();
    for (let i = 0; i < this.nBulbs; i++) {
      const a = (i / this.nBulbs) * TAU; m.makeTranslation(Math.cos(a) * (this.R + 0.07), Math.sin(a) * (this.R + 0.07), 0.1);
      this.bulbs.setMatrixAt(i, m); this.bulbs.setColorAt(i, new THREE.Color(0xffd27a));
    }
    this.group.add(this.bulbs);

    // pointer at the top (points down), hinged so it can flick
    this.pointerPivot = new THREE.Group(); this.pointerPivot.position.set(0, this.R + 0.2, 0.16); this.group.add(this.pointerPivot);
    const pShape = new THREE.Shape(); pShape.moveTo(0, -0.34); pShape.lineTo(0.13, 0.02); pShape.quadraticCurveTo(0, 0.14, -0.13, 0.02); pShape.lineTo(0, -0.34);
    const pGeo = new THREE.ExtrudeGeometry(pShape, { depth: 0.06, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 3 });
    pGeo.translate(0, 0, -0.03);
    this.pointer = new THREE.Mesh(pGeo, metal); this.pointerPivot.add(this.pointer);
    this.gem = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff2a3a, toneMapped: false }));
    this.gem.position.set(0, 0.0, 0.06); this.pointerPivot.add(this.gem);
    this.kick = 0;

    // back glow in wheel color + highlight wedge + burst
    this.glowMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0x3366ff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
    this.glow = new THREE.Sprite(this.glowMat); this.glow.scale.set(this.R * 3.4, this.R * 3.4, 1); this.glow.position.z = -0.3; this.group.add(this.glow);
    this.wedgeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.wedge = new THREE.Mesh(new THREE.BufferGeometry(), this.wedgeMat); this.wedge.position.z = 0.012; this.group.add(this.wedge);
    this.burstMat = new THREE.SpriteMaterial({ map: burstTexture(), color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    this.burst = new THREE.Sprite(this.burstMat); this.burst.position.set(0, this.R * 0.62, 0.3); this.group.add(this.burst);

    // sparks
    this.nSparks = 220;
    const sg = new THREE.BufferGeometry();
    this.sp = { pos: new Float32Array(this.nSparks * 3), vel: new Float32Array(this.nSparks * 3), life: new Float32Array(this.nSparks), col: new Float32Array(this.nSparks * 3) };
    sg.setAttribute('position', new THREE.BufferAttribute(this.sp.pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(this.sp.col, 3));
    this.sparkMat = new THREE.PointsMaterial({ size: 0.05, map: glowTexture(64), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    this.sparks = new THREE.Points(sg, this.sparkMat); this.sparks.frustumCulled = false; this.group.add(this.sparks);
    for (let i = 0; i < this.nSparks; i++) this.sp.pos[i * 3 + 1] = -999;
    this._si = 0;
  }

  // draw slices ---------------------------------------------------------------
  setWheel(def, weights) {
    this.def = def; this.slices = def.slices; this.result = -1; this.gold = !!def.gold;
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    this.weights = weights;
    // angles: slice i spans [a0, a1) going counter-clockwise from the top
    this.ang = []; let a = 0;
    for (let i = 0; i < this.slices.length; i++) { const da = (weights[i] / total) * TAU; this.ang.push([a, a + da]); a += da; }
    this.colors = sliceColors(def.color, this.slices.length, this.slices.map(s => s.label));
    this.drawDisc(-1);
    const gc = this.gold ? 0xffc23a : (def.color && def.color.startsWith('#') ? def.color : 0x6a4dff);
    this.glowMat.color.set(gc);
    this.metal.color.set(this.gold ? 0xffd36b : 0xc8ccd4);
    this.wedgeMat.opacity = 0; this.burstMat.opacity = 0;
  }

  drawDisc(highlight) {
    const c = this.canvas, g = c.getContext('2d'), S = c.width, R = S / 2;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S, S);
    g.translate(R, R);
    const n = this.slices.length;
    // canvas y is down; three's texture maps canvas top to +y. Our slice angle 0 = top, increasing counter-clockwise on screen.
    for (let i = 0; i < n; i++) {
      const [a0, a1] = this.ang[i];
      const col = this.colors[i].clone();
      if (this.gold) col.lerp(new THREE.Color('#ffcc44'), 0.35);
      if (highlight >= 0) { if (i === highlight) { const o = {}; col.getHSL(o, THREE.SRGBColorSpace); col.setHSL(o.h, Math.min(1, o.s + 0.1), Math.min(0.72, o.l + 0.2), THREE.SRGBColorSpace); } else col.multiplyScalar(0.3); }
      g.fillStyle = '#' + col.getHexString();
      g.beginPath(); g.moveTo(0, 0);
      g.arc(0, 0, R - 2, -Math.PI / 2 - a1, -Math.PI / 2 - a0);
      g.closePath(); g.fill();
      if (n <= 120) { g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = n > 60 ? 1 : 3; g.stroke(); }
    }
    // labels: radial, written from the rim toward the middle (like his wheels)
    g.fillStyle = '#fff'; g.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      const [a0, a1] = this.ang[i]; const da = a1 - a0; const mid = (a0 + a1) / 2;
      const arcPx = da * R * 0.78;
      let fs = Math.min(64, Math.max(8, arcPx * 0.62));
      const label = this.slices[i].label;
      const maxLen = R * 0.72;
      g.save();
      g.rotate(Math.PI / 2 - mid); // +x now points from the rim toward the middle
      g.font = `600 ${fs}px ${FONT}`;
      let w = g.measureText(label).width;
      if (w > maxLen) { fs = Math.max(7, fs * maxLen / w); g.font = `600 ${fs}px ${FONT}`; w = g.measureText(label).width; }
      const dim = highlight >= 0 && i !== highlight;
      g.globalAlpha = dim ? 0.45 : 1;
      g.textAlign = 'left';
      g.fillText(label, -R * 0.95, 0, maxLen);
      g.restore();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    this.tex.needsUpdate = true;
  }

  sliceAtPointer() {
    // pointer is at the top (angle 0 in wheel space, relative to rotation)
    const a = ((-this.angle) % TAU + TAU) % TAU;
    for (let i = 0; i < this.ang.length; i++) if (a >= this.ang[i][0] && a < this.ang[i][1]) return i;
    return this.ang.length - 1;
  }
  sliceAtLocal(x, y) {
    // x,y in wheel local space (meters); returns slice index under that point or -1
    const r = Math.hypot(x, y); if (r > this.R) return -1;
    let a = Math.atan2(x, y); // 0 at top, positive toward +x (clockwise on screen) -> our angles go counter-clockwise
    a = -a - this.angle; a = ((a % TAU) + TAU) % TAU;
    for (let i = 0; i < this.ang.length; i++) if (a >= this.ang[i][0] && a < this.ang[i][1]) return i;
    return -1;
  }

  // spin so slice `idx` stops under the pointer --------------------------------
  spinTo(idx, { fast = false, power = 1 } = {}) {
    const [a0, a1] = this.ang[idx];
    const span = a1 - a0;
    const target = a0 + span * (0.18 + Math.random() * 0.64);          // somewhere inside the slice, not on the line
    const cur = ((-this.angle) % TAU + TAU) % TAU;
    let delta = target - cur; if (delta < 0) delta += TAU;
    const turns = fast ? 2 + Math.floor(Math.random() * 2) : 4 + Math.floor(Math.random() * 3) + Math.round(power);
    this.from = this.angle; this.to = this.angle - (delta + turns * TAU);
    this.dur = fast ? 1.5 + Math.random() * 0.4 : 4.4 + Math.random() * 1.4;
    this.t0 = performance.now() / 1000; this.spinning = true; this.result = idx; this.lastSlice = this.sliceAtPointer();
    this.wedgeMat.opacity = 0; this.burstMat.opacity = 0;
    this.drawDisc(-1);
    return new Promise(res => { this._done = res; });
  }

  emitSparks(n, x, y, z, speed, color) {
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const i = this._si = (this._si + 1) % this.nSparks;
      this.sp.pos[i * 3] = x; this.sp.pos[i * 3 + 1] = y; this.sp.pos[i * 3 + 2] = z;
      const a = Math.random() * TAU, s = speed * (0.4 + Math.random());
      this.sp.vel[i * 3] = Math.cos(a) * s; this.sp.vel[i * 3 + 1] = Math.sin(a) * s + speed * 0.3; this.sp.vel[i * 3 + 2] = (Math.random() * 0.8 + 0.2) * speed;
      this.sp.life[i] = 0.6 + Math.random() * 0.7;
      this.sp.col[i * 3] = c.r; this.sp.col[i * 3 + 1] = c.g; this.sp.col[i * 3 + 2] = c.b;
    }
  }

  update(dt, now) {
    this._t += dt;
    if (this.spinning) {
      const t = Math.min(1, (now - this.t0) / this.dur);
      const e = 1 - Math.pow(1 - t, 4); // ease out
      this.angle = this.from + (this.to - this.from) * e;
      const s = this.sliceAtPointer();
      if (s !== this.lastSlice) {
        this.lastSlice = s; this.kick = Math.min(1, this.kick + 0.6);
        if (this.onTick) this.onTick((1 - e));
        if (Math.random() < 0.25 * (1 - t)) this.emitSparks(2, 0, this.R + 0.05, 0.2, 1.2, this.gold ? 0xffd040 : 0xffe2a0);
      }
      if (t >= 1) {
        this.spinning = false; this.angle = this.to;
        this.reveal();
        const d = this._done; this._done = null; d && d(this.result);
      }
    }
    this.spinGroup.rotation.z = this.angle;
    // pointer flick
    this.kick = Math.max(0, this.kick - dt * 6);
    this.pointerPivot.rotation.z = -this.kick * 0.32;
    // bulbs
    const col = new THREE.Color();
    const spinPhase = this.spinning ? this._t * 18 : this._t * 2.2;
    for (let i = 0; i < this.nBulbs; i++) {
      let on;
      if (this.flashT > 0) on = Math.sin(this._t * 30) > 0 ? 1 : 0.15;
      else on = ((i + Math.floor(spinPhase)) % 4 === 0) ? 1 : 0.22;
      col.set(this.gold ? 0xffc23a : 0xffd27a).multiplyScalar(on * 1.6);
      this.bulbs.setColorAt(i, col);
    }
    this.bulbs.instanceColor.needsUpdate = true;
    this.flashT = Math.max(0, (this.flashT || 0) - dt);
    // reveal fx
    if (this.result >= 0 && !this.spinning) {
      this.wedgeMat.opacity = 0.18 + Math.sin(this._t * 5) * 0.08;
    }
    if (this.burstMat.opacity > 0) { this.burstMat.opacity = Math.max(0, this.burstMat.opacity - dt * 0.9); this.burst.material.rotation += dt * 0.4; const sc = this.R * (1.3 + (1 - this.burstMat.opacity) * 0.8); this.burst.scale.set(sc, sc, 1); }
    // sparks physics
    for (let i = 0; i < this.nSparks; i++) {
      if (this.sp.life[i] <= 0) continue;
      this.sp.life[i] -= dt;
      this.sp.vel[i * 3 + 1] -= 3.2 * dt;
      this.sp.pos[i * 3] += this.sp.vel[i * 3] * dt; this.sp.pos[i * 3 + 1] += this.sp.vel[i * 3 + 1] * dt; this.sp.pos[i * 3 + 2] += this.sp.vel[i * 3 + 2] * dt;
      if (this.sp.life[i] <= 0) this.sp.pos[i * 3 + 1] = -999;
    }
    this.sparks.geometry.attributes.position.needsUpdate = true; this.sparks.geometry.attributes.color.needsUpdate = true;
    this.glowMat.opacity = (this.spinning ? 0.7 : 0.5) + Math.sin(this._t * 1.7) * 0.06;
  }

  reveal() {
    const i = this.result; if (i < 0) return;
    this.drawDisc(i);
    // wedge over the winning slice (in world space it sits under the pointer)
    const [a0, a1] = this.ang[i];
    const geo = new THREE.BufferGeometry(); const pts = [0, 0, 0]; const segs = Math.max(2, Math.ceil((a1 - a0) / 0.05));
    for (let k = 0; k <= segs; k++) { const a = a0 + (a1 - a0) * k / segs + this.angle; pts.push(-Math.sin(a) * this.R, Math.cos(a) * this.R, 0); }
    const idx = []; for (let k = 1; k <= segs; k++) idx.push(0, k, k + 1);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); geo.setIndex(idx);
    this.wedge.geometry.dispose(); this.wedge.geometry = geo;
    this.wedgeMat.color.set(this.gold ? 0xffd040 : 0xffffff);
    this.burstMat.opacity = 0.9; this.burstMat.color.set(this.gold ? 0xffd040 : 0xffffff);
    this.flashT = 0.9;
    this.emitSparks(70, 0, this.R + 0.1, 0.25, 2.4, this.gold ? 0xffc030 : 0xffe9b0);
    this.emitSparks(40, 0, this.R * 0.55, 0.3, 1.6, '#' + this.colors[i].getHexString());
  }
}
