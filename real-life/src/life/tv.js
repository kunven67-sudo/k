// A TV that really plays: made-up live channels drawn on a canvas, following the game clock
// (cartoons in the morning, town news at 6, game shows at night, ads in between).
//
//   const tv = new Tv(world, spot)  // spot: { at, faceYaw, size: [w, h] }
//   tv.next() / tv.off() / tv.update(dt)

import * as THREE from 'three';
import { clock } from '../core/clock.js';
import { audio } from '../core/audio.js';
import { bus } from '../core/events.js';

export const CHANNELS = [
  { id: 'toons', name: 'Channel 4 Toons', kind: 'cartoon' },
  { id: 'news', name: 'WMHN 7 News', kind: 'news' },
  { id: 'cook', name: 'Cook It!', kind: 'cooking' },
  { id: 'sports', name: 'Sportz 1', kind: 'sports' },
  { id: 'game', name: 'Prize Wheel', kind: 'gameshow' },
];

export class Tv {
  constructor(world, spot) {
    this.spot = spot;
    this.on = false;
    this.channel = 0;
    this.t = 0;
    this._acc = 0;
    const [w, h] = spot.size || [1, 0.6];
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256;
    this.canvas.height = 144;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mat = new THREE.MeshBasicMaterial({ color: 0x050607, toneMapped: false });
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.94, h * 0.9), this.mat);
    const yaw = spot.faceYaw ?? 0;
    this.screen.position.copy(spot.at).add(new THREE.Vector3(Math.sin(yaw) * 0.012, 0, Math.cos(yaw) * 0.012));
    this.screen.rotation.y = yaw;
    world.scene.add(this.screen);
    // The room glows with the picture (one of the world's pooled lights, not an extra one).
    const gp = spot.at.clone().add(new THREE.Vector3(Math.sin(yaw) * 0.8, 0, Math.cos(yaw) * 0.8));
    this.glow = world.lights.addLamp(gp, { color: 0x9fc4ff, intensity: 0, range: 4.5, auto: null });
  }

  get channelName() {
    return CHANNELS[this.channel].name;
  }

  next() {
    if (!this.on) {
      this.on = true;
      this.mat.color.set(0xffffff);
      this.mat.map = this.tex;
      this.mat.needsUpdate = true;
      audio.play?.('tv.on', { position: this.spot.at, gain: 0.5 });
    } else {
      this.channel = (this.channel + 1) % CHANNELS.length;
      audio.play?.('tv.static', { position: this.spot.at, gain: 0.25 });
    }
    this.t = 0;
    bus.emit('tv:changed', { tv: this, channel: CHANNELS[this.channel] });
  }

  off() {
    if (!this.on) return;
    this.on = false;
    this.mat.map = null;
    this.mat.color.set(0x050607);
    this.mat.needsUpdate = true;
    this.glow.on = false;
    bus.emit('tv:changed', { tv: this, channel: null });
  }

  /** What's showing right now (ads every ~12 game minutes, like real TV). */
  showing() {
    const ch = CHANNELS[this.channel];
    const m = clock.minutes % 30;
    if (m >= 24) return { ...ch, kind: 'ad', title: ['Pepsy: Taste the Fizz', "McDanny's Big Deal Meal", 'Toyoda: Let\'s Go Places', 'Best Bye Weekend Sale'][Math.floor(clock.minutes / 30) % 4] };
    const titles = {
      cartoon: ['Captain Crunchbeak', 'Space Puppies', 'Dino Detectives'],
      news: ['WMHN Morning News', 'Noon Report', 'Evening News at 6', 'Late News'],
      cooking: ['Cook It! with Chef Rosa', 'Grill Masters', 'Bake Off Ohio'],
      sports: ['Buckeyes Football', 'Pro Hoops Tonight', 'Baseball Recap'],
      gameshow: ['Prize Wheel', 'Guess That Price', 'Trivia Rush'],
    };
    const list = titles[ch.kind];
    return { ...ch, title: list[Math.floor(clock.hour / 6) % list.length] };
  }

  update(dt) {
    if (!this.on) return;
    this.t += dt;
    this._acc += dt;
    if (this._acc < 1 / 12) return;
    this._acc = 0;
    const g = this.canvas.getContext('2d');
    const s = this.showing();
    const t = this.t;
    const W = 256;
    const H = 144;
    let lum = 0.5;
    if (s.kind === 'ad') {
      const hue = (t * 40) % 360;
      g.fillStyle = `hsl(${hue},70%,50%)`;
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#fff';
      g.font = 'bold 20px Arial';
      g.textAlign = 'center';
      g.fillText(s.title, W / 2, H / 2 + Math.sin(t * 3) * 4);
      g.font = '11px Arial';
      g.fillText('AVAILABLE NOW', W / 2, H / 2 + 24);
      lum = 0.7;
    } else if (s.kind === 'cartoon') {
      g.fillStyle = '#7fd1ff';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#6bc35a';
      g.fillRect(0, H * 0.7, W, H * 0.3);
      const x = (t * 50) % (W + 60) - 30;
      g.fillStyle = '#ffcf3f';
      g.beginPath();
      g.arc(x, H * 0.6 + Math.abs(Math.sin(t * 6)) * -18, 16, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#222';
      g.beginPath();
      g.arc(x + 5, H * 0.6 - 4 + Math.abs(Math.sin(t * 6)) * -18, 3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ff6b6b';
      g.fillRect(W - 70 - ((t * 20) % 40), H * 0.55, 30, 30);
      lum = 0.8;
    } else if (s.kind === 'news') {
      g.fillStyle = '#18324f';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#c9a882';
      g.beginPath();
      g.arc(W * 0.35, H * 0.42, 18, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#2b2b38';
      g.fillRect(W * 0.35 - 28, H * 0.55, 56, 50);
      g.fillStyle = '#0d1b2e';
      g.fillRect(W * 0.58, H * 0.2, W * 0.36, H * 0.4);
      g.fillStyle = '#d72b2b';
      g.fillRect(0, H - 30, W, 18);
      g.fillStyle = '#fff';
      g.font = 'bold 11px Arial';
      g.textAlign = 'left';
      const ticker = `MAPLE HOLLOW: ${clock.dateText()} · ${Math.round(55 + Math.sin(clock.dayIndex) * 20)}°F · WALMORT OPEN 7AM-11PM · `;
      g.fillText(ticker + ticker, -((t * 30) % 300), H - 17);
      lum = 0.35;
    } else if (s.kind === 'cooking') {
      g.fillStyle = '#f2e6d0';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#8a5a34';
      g.fillRect(0, H * 0.65, W, H * 0.35);
      g.fillStyle = '#333';
      g.beginPath();
      g.ellipse(W / 2, H * 0.7, 46, 12, 0, 0, Math.PI * 2);
      g.fill();
      for (let i = 0; i < 6; i++) {
        g.fillStyle = 'rgba(255,255,255,.5)';
        g.beginPath();
        g.arc(W / 2 - 20 + i * 8, H * 0.55 - ((t * 20 + i * 10) % 40), 4, 0, Math.PI * 2);
        g.fill();
      }
      lum = 0.75;
    } else if (s.kind === 'sports') {
      g.fillStyle = '#2f7d3a';
      g.fillRect(0, 0, W, H);
      g.strokeStyle = '#fff';
      g.lineWidth = 2;
      for (let x = 20; x < W; x += 36) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, H);
        g.stroke();
      }
      for (let i = 0; i < 8; i++) {
        g.fillStyle = i < 4 ? '#bb0000' : '#ffffff';
        g.beginPath();
        g.arc((i * 37 + t * (i < 4 ? 20 : -16)) % W, 40 + (i % 4) * 22, 5, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = 'rgba(0,0,0,.6)';
      g.fillRect(6, 6, 96, 18);
      g.fillStyle = '#fff';
      g.font = 'bold 11px Arial';
      g.fillText(`OSU ${14 + (Math.floor(t / 20) % 3) * 7}  MICH ${10}`, 10, 19);
      lum = 0.5;
    } else {
      g.fillStyle = '#3a0d5c';
      g.fillRect(0, 0, W, H);
      g.save();
      g.translate(W / 2, H / 2 + 6);
      g.rotate(t * 2);
      for (let i = 0; i < 8; i++) {
        g.fillStyle = `hsl(${i * 45},80%,55%)`;
        g.beginPath();
        g.moveTo(0, 0);
        g.arc(0, 0, 50, (i / 8) * Math.PI * 2, ((i + 1) / 8) * Math.PI * 2);
        g.fill();
      }
      g.restore();
      lum = 0.6;
    }
    // Channel bug (logo) in the corner.
    g.fillStyle = 'rgba(255,255,255,.75)';
    g.font = 'bold 9px Arial';
    g.textAlign = 'right';
    g.fillText(s.name.toUpperCase(), W - 6, 12);
    g.textAlign = 'left';
    this.tex.needsUpdate = true;
    this.glow.on = true;
    this.glow.intensity = 0.8 + lum * 2.2 + Math.sin(t * 7) * 0.2;
  }
}
