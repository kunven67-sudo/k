// Things that make a house look lived in: framed pictures, posters, a wall clock that shows the
// real game time, light switches + outlets, books on shelves, upper kitchen cabinets, backsplash.
// Everything static goes through the builder (merged); the clock face is a live canvas.

import * as THREE from 'three';
import { mat } from '../gfx/materials.js';
import { canvasTexture } from '../gfx/textures.js';
import { Rng } from '../core/rng.js';

const UP = new THREE.Vector3(0, 1, 0);

/** Procedural art for frames: landscapes, abstracts, a family-photo look, kid posters. */
export function artTexture(kind, seed) {
  return canvasTexture(`art-${kind}-${seed}`, 256, 192, (ctx, w, h) => {
    const r = new Rng(seed);
    if (kind === 'landscape') {
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6);
      sky.addColorStop(0, r.pick(['#7fb3d9', '#e9a86b', '#9ec6e0', '#c9b6e4']));
      sky.addColorStop(1, r.pick(['#f3e3c3', '#fbd9a6', '#e8f0f2']));
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,240,200,.9)';
      ctx.beginPath();
      ctx.arc(r.range(40, w - 40), r.range(25, 60), r.range(10, 18), 0, Math.PI * 2);
      ctx.fill();
      for (let layer = 0; layer < 3; layer++) {
        ctx.fillStyle = ['#6f8f6a', '#4f7350', '#355a3a'][layer];
        ctx.beginPath();
        ctx.moveTo(0, h);
        const base = h * (0.55 + layer * 0.12);
        for (let x = 0; x <= w; x += 8) ctx.lineTo(x, base - Math.sin(x * 0.02 + layer * 2 + seed) * 14 - r.range(0, 5));
        ctx.lineTo(w, h);
        ctx.fill();
      }
    } else if (kind === 'abstract') {
      ctx.fillStyle = r.pick(['#efe6d6', '#e4e7ea', '#f1e2d8']);
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = r.pick(['#c75b39', '#2f5d7c', '#e3b23c', '#3d7a5e', '#8a4f7d', '#1f1f1f']);
        ctx.globalAlpha = r.range(0.55, 0.95);
        if (r.chance(0.5)) ctx.fillRect(r.range(0, w * 0.8), r.range(0, h * 0.8), r.range(20, 110), r.range(20, 90));
        else {
          ctx.beginPath();
          ctx.arc(r.range(20, w - 20), r.range(20, h - 20), r.range(12, 50), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    } else if (kind === 'photo') {
      // A soft "family photo": blurred background + head/shoulder silhouettes.
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#b7c7a3');
      g.addColorStop(1, '#6f8c7d');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      const n = r.int(3, 4);
      for (let i = 0; i < n; i++) {
        const x = (w / (n + 1)) * (i + 1);
        const s = i === n - 1 ? 0.75 : 1;
        ctx.fillStyle = r.pick(['#3b4a6b', '#8c3b3b', '#d9d0c1', '#2d2d2d', '#5a7a3a']);
        ctx.beginPath();
        ctx.ellipse(x, h * 0.95, 34 * s, 52 * s, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = r.pick(['#e8c4a6', '#c99a74', '#8d5a3b', '#f1d6c0']);
        ctx.beginPath();
        ctx.arc(x, h * 0.5 + (1 - s) * 30, 17 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = r.pick(['#2a1d14', '#6b4a2b', '#c9a35e', '#1a1a1a']);
        ctx.beginPath();
        ctx.arc(x, h * 0.5 - 6 * s + (1 - s) * 30, 18 * s, Math.PI, 0);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      ctx.fillRect(0, 0, w, h);
    } else if (kind === 'poster-space') {
      ctx.fillStyle = '#0b1026';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = `rgba(255,255,255,${r.range(0.3, 1)})`;
        ctx.fillRect(r.range(0, w), r.range(0, h), 1.5, 1.5);
      }
      ctx.fillStyle = '#d98c4a';
      ctx.beginPath();
      ctx.arc(w * 0.65, h * 0.45, 42, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e8c79a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(w * 0.65, h * 0.45, 70, 16, -0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px Arial';
      ctx.fillText('THE PLANETS', 14, h - 16);
    } else if (kind === 'poster-dino') {
      ctx.fillStyle = '#f2d36b';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#2f6b3a';
      ctx.beginPath();
      ctx.ellipse(w * 0.45, h * 0.6, 70, 34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(w * 0.6, h * 0.25, 20, 70);
      ctx.beginPath();
      ctx.ellipse(w * 0.66, h * 0.24, 22, 12, 0.2, 0, Math.PI * 2);
      ctx.fill();
      for (const x of [0.32, 0.42, 0.52, 0.6]) ctx.fillRect(w * x, h * 0.7, 10, 34);
      ctx.fillStyle = '#7a3a1a';
      ctx.font = 'bold 24px Arial';
      ctx.fillText('DINO WORLD', 14, 30);
    } else if (kind === 'poster-game') {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#2a0f3d');
      g.addColorStop(1, '#d6336c');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffe14d';
      ctx.font = 'bold 30px Arial';
      ctx.fillText('SUPER', 18, 44);
      ctx.fillText('BLASTO 3', 18, 78);
      ctx.fillStyle = '#4dd6ff';
      ctx.fillRect(w * 0.62, h * 0.4, 44, 60);
      ctx.fillStyle = '#fff';
      ctx.font = '12px Arial';
      ctx.fillText('ONLY ON PLAYSTASHUN 5', 18, h - 14);
    } else if (kind === 'poster-unicorn') {
      ctx.fillStyle = '#fbd3e9';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 5; i++) {
        ctx.strokeStyle = ['#ff6b6b', '#ffb347', '#ffe66d', '#6bcB77', '#4d96ff'][i];
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(w / 2, h, 110 - i * 9, Math.PI, 0);
        ctx.stroke();
      }
      ctx.fillStyle = '#8a4fbf';
      ctx.font = 'bold 22px Arial';
      ctx.fillText('BE MAGICAL', 50, 34);
    }
  });
}

export class Decor {
  constructor(world, B) {
    this.world = world;
    this.B = B;
    this.frameMat = mat('wood', { color: 0x3b2a1e, varnish: 0.7, wear: 0.1 });
    this.whiteFrame = mat('paint', { color: 0xf3f0ea });
    this.plate = mat('plastic', { color: 0xf2efe8, wear: 0.05, dirt: 0.05 });
  }

  /** A framed picture flat on a wall. normalYaw = the direction the picture faces. */
  picture(x, y, z, normalYaw, w, h, kind, seed, { frame = 'wood' } = {}) {
    const fm = frame === 'none' ? null : frame === 'white' ? this.whiteFrame : this.frameMat;
    const n = new THREE.Vector3(Math.sin(normalYaw), 0, Math.cos(normalYaw));
    if (fm) this.B.box(x + n.x * 0.015, y, z + n.z * 0.015, w + 0.06, h + 0.06, 0.03, fm, { rotY: normalYaw, collide: false, shadow: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: artTexture(kind, seed), roughness: kind.startsWith('poster') ? 0.6 : 0.35 }));
    m.position.set(x + n.x * 0.033, y, z + n.z * 0.033);
    m.rotation.y = normalYaw;
    this.world.scene.add(m);
    return m;
  }

  /** A light switch plate (the world wires it to the room light). */
  switchPlate(x, y, z, normalYaw) {
    const n = new THREE.Vector3(Math.sin(normalYaw), 0, Math.cos(normalYaw));
    this.B.box(x + n.x * 0.005, y, z + n.z * 0.005, 0.07, 0.115, 0.01, this.plate, { rotY: normalYaw, collide: false, shadow: false });
    const toggle = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.03, 0.012), this.plate);
    toggle.position.set(x + n.x * 0.014, y, z + n.z * 0.014);
    toggle.rotation.y = normalYaw;
    this.world.scene.add(toggle);
    return { pos: new THREE.Vector3(x, y, z), toggle, normal: n };
  }

  outlet(x, y, z, normalYaw) {
    const n = new THREE.Vector3(Math.sin(normalYaw), 0, Math.cos(normalYaw));
    this.B.box(x + n.x * 0.004, y, z + n.z * 0.004, 0.07, 0.115, 0.008, this.plate, { rotY: normalYaw, collide: false, shadow: false });
  }

  /** Rows of books on a shelf box (min corner + size), facing normalYaw. */
  books(cx, cz, y0, width, shelves, gap, normalYaw, seed) {
    const r = new Rng(seed);
    const colors = [0x8c2f2f, 0x2f4f8c, 0x2f6b4a, 0xc9a24a, 0x5a3a6b, 0x1f1f1f, 0xd8d0c0, 0x7a4a2a];
    const right = new THREE.Vector3(Math.cos(normalYaw), 0, -Math.sin(normalYaw));
    for (let s = 0; s < shelves; s++) {
      let u = -width / 2 + 0.03;
      while (u < width / 2 - 0.08) {
        const bw = r.range(0.025, 0.055);
        const bh = r.range(0.17, 0.27);
        if (r.chance(0.08)) {
          u += 0.08;
          continue;
        }
        const m = mat('paint', { color: r.pick(colors) });
        const tilt = r.chance(0.06) ? 0.25 : 0;
        this.B.box(cx + right.x * (u + bw / 2), y0 + s * gap + bh / 2, cz + right.z * (u + bw / 2), bw, bh, 0.18, m, { rotY: normalYaw + tilt * 0, collide: false, shadow: false });
        u += bw + 0.003;
      }
    }
  }
}

/** A round wall clock whose face shows the game time (redrawn once a game minute). */
export function wallClock(world, x, y, z, normalYaw, clockRef) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.15, 32), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.015, 8, 32), mat('metal-painted', { color: 0x222222, wear: 0.05 }));
  const n = new THREE.Vector3(Math.sin(normalYaw), 0, Math.cos(normalYaw));
  face.position.set(x + n.x * 0.02, y, z + n.z * 0.02);
  rim.position.copy(face.position);
  face.rotation.y = rim.rotation.y = normalYaw;
  world.scene.add(face, rim);
  let last = -1;
  const draw = () => {
    const m = Math.floor(clockRef.minutes);
    if (m === last) return;
    last = m;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f7f4ec';
    ctx.fillRect(0, 0, 128, 128);
    ctx.translate(64, 64);
    ctx.strokeStyle = '#222';
    for (let i = 0; i < 12; i++) {
      ctx.lineWidth = i % 3 === 0 ? 4 : 2;
      ctx.beginPath();
      const a = (i / 12) * Math.PI * 2;
      ctx.moveTo(Math.sin(a) * 48, -Math.cos(a) * 48);
      ctx.lineTo(Math.sin(a) * 56, -Math.cos(a) * 56);
      ctx.stroke();
    }
    const hrs = (m / 60) % 12;
    const mins = m % 60;
    const hand = (a, len, wdt) => {
      ctx.lineWidth = wdt;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.sin(a) * len, -Math.cos(a) * len);
      ctx.stroke();
    };
    hand((hrs / 12) * Math.PI * 2, 30, 5);
    hand((mins / 60) * Math.PI * 2, 44, 3);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    tex.needsUpdate = true;
  };
  draw();
  return { update: draw, face };
}

void UP;
