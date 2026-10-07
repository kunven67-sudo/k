// Cheap TV picture: a small canvas redrawn ~12 times a second and used as an emissive map.
// Channels: 0 = static (snow + rolling bar), 1 = late-night infomercial (talking blob, price
// banner), 2 = old western (sepia desert, riders), 3 = weather map. All drawn procedurally.
import * as THREE from 'three';
import { Rng } from '../../core/rng.js';

export function tvScreen(key, { w = 192, h = 144, fps = 12 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({ color: 0x0b0d0c, roughness: 0.4, metalness: 0.0, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0 });
  material.name = `tv:${key}`;
  const img = g.createImageData(w, h);
  const rng = new Rng(key);
  const state = { on: false, channel: 0, t: 0, acc: 0, glow: new THREE.Color(0x8fa6c8), level: 0 };

  function snow() {
    const d = img.data;
    const bar = (state.t * 40) % (h * 1.6);
    for (let y = 0; y < h; y++) {
      const roll = Math.abs(y - bar) < 10 ? 40 : 0;
      for (let x = 0; x < w; x++) {
        const v = (rng.next() * 200 + roll) | 0;
        const i = (y * w + x) * 4;
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v + 10;
        d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    state.glow.setRGB(0.55, 0.58, 0.65);
  }

  function infomercial() {
    const t = state.t;
    g.fillStyle = '#1d3f7a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#c8b28a';
    g.fillRect(0, h * 0.62, w, h * 0.38);
    // Host: head + shoulders bobbing as he talks.
    const bob = Math.sin(t * 7) * 1.5;
    g.fillStyle = '#2b2b33';
    g.beginPath();
    g.ellipse(w * 0.36, h * 0.86, 34, 30, 0, Math.PI, 0);
    g.fill();
    g.fillStyle = '#e0a985';
    g.beginPath();
    g.ellipse(w * 0.36, h * 0.48 + bob, 15, 19, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3a2416';
    g.fillRect(w * 0.36 - 15, h * 0.48 - 19 + bob, 30, 8);
    g.fillStyle = '#7a2a20';
    g.fillRect(w * 0.36 - 5, h * 0.55 + bob, 10, 2 + Math.abs(Math.sin(t * 13)) * 4);
    // Product: a glinting knife set.
    g.fillStyle = '#d9d9de';
    for (let i = 0; i < 4; i++) g.fillRect(w * 0.62 + i * 9, h * 0.38, 4, 34);
    g.fillStyle = '#3b2a1e';
    g.fillRect(w * 0.6, h * 0.62, 44, 16);
    // Price banner flashing.
    g.fillStyle = Math.floor(t * 2) % 2 ? '#ffde2e' : '#ff3b2e';
    g.fillRect(0, h - 26, w, 26);
    g.fillStyle = '#111';
    g.font = '700 18px "Bebas Neue", sans-serif';
    g.textAlign = 'center';
    g.fillText('ONLY $19.99 · CALL NOW', w / 2, h - 7);
    state.glow.setRGB(0.45, 0.55, 0.9);
  }

  function western() {
    const t = state.t;
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#d8c39a');
    grd.addColorStop(0.55, '#c49a62');
    grd.addColorStop(1, '#8a6238');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#6b4a2c';
    g.beginPath();
    g.moveTo(0, h * 0.55);
    for (let x = 0; x <= w; x += 16) g.lineTo(x, h * 0.5 - Math.sin(x * 0.05) * 10 - (x > w * 0.6 ? 18 : 0));
    g.lineTo(w, h * 0.6);
    g.lineTo(0, h * 0.6);
    g.fill();
    g.fillStyle = '#2a1c12';
    for (let i = 0; i < 3; i++) {
      const x = ((t * 18 + i * 34) % (w + 40)) - 20;
      const gallop = Math.abs(Math.sin(t * 9 + i)) * 3;
      g.fillRect(x, h * 0.66 - gallop, 18, 7);
      g.fillRect(x + 6, h * 0.66 - 9 - gallop, 4, 9);
      g.fillRect(x + 1, h * 0.66 + 7 - gallop, 2, 6);
      g.fillRect(x + 14, h * 0.66 + 7 - gallop, 2, 6);
    }
    // Film grain + vignette.
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `rgba(30,20,10,${rng.range(0.05, 0.3)})`;
      g.fillRect(rng.range(0, w), rng.range(0, h), 1, rng.range(1, 6));
    }
    state.glow.setRGB(0.9, 0.7, 0.45);
  }

  function weather() {
    const t = state.t;
    g.fillStyle = '#1a5a2a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#2f7a3a';
    g.beginPath();
    g.moveTo(w * 0.2, h * 0.1);
    g.lineTo(w * 0.8, h * 0.12);
    g.lineTo(w * 0.85, h * 0.85);
    g.lineTo(w * 0.15, h * 0.8);
    g.fill();
    g.fillStyle = 'rgba(240,240,255,0.75)';
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.ellipse(((t * 6 + i * 50) % (w + 60)) - 30, h * (0.3 + i * 0.12), 26, 12, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#fff';
    g.font = '700 22px "Bebas Neue", sans-serif';
    g.fillText('RENO 71°', 10, 26);
    state.glow.setRGB(0.4, 0.75, 0.5);
  }

  const DRAW = [snow, infomercial, western, weather];
  function scanlines() {
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < h; y += 2) g.fillRect(0, y, w, 1);
  }

  return {
    material,
    texture: tex,
    state,
    get on() {
      return state.on;
    },
    setOn(v) {
      state.on = v;
      material.emissiveIntensity = v ? 1.25 : 0;
      material.color.setHex(v ? 0x222222 : 0x0b0d0c);
      if (!v) {
        g.fillStyle = '#000';
        g.fillRect(0, 0, w, h);
        tex.needsUpdate = true;
      }
    },
    setChannel(c) {
      state.channel = ((c % DRAW.length) + DRAW.length) % DRAW.length;
    },
    nextChannel() {
      this.setChannel(state.channel + 1);
    },
    // Returns the current flicker level (0..1) for the room light that fakes the screen glow.
    update(dt) {
      if (!state.on) return 0;
      state.t += dt;
      state.acc += dt;
      if (state.acc >= 1 / fps) {
        state.acc = 0;
        DRAW[state.channel]();
        if (state.channel) scanlines();
        tex.needsUpdate = true;
        state.level = 0.75 + rng.next() * 0.25;
      }
      return state.level;
    },
  };
}
