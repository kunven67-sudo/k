// Meme pop-up in front of the wheel (like his edits: the meme covers the wheel), with its sound. Plus the flashbang.
import * as THREE from 'three';
import { drawCaption } from './text.js';

export class MemePop {
  constructor({ audio, base = 'assets/memes/', camera }) {
    this.audio = audio; this.base = base; this.camera = camera;
    this.group = new THREE.Group(); this.group.visible = false; this.group.name = 'meme';
    this.mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true });
    this.plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat); this.group.add(this.plane);
    this.capCanvas = document.createElement('canvas'); this.capCanvas.width = 1024; this.capCanvas.height = 1024;
    this.capTex = new THREE.CanvasTexture(this.capCanvas); this.capTex.colorSpace = THREE.SRGBColorSpace;
    this.cap = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.capTex, transparent: true, depthWrite: false, toneMapped: false }));
    this.cap.position.z = 0.002; this.group.add(this.cap);
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x000000 })); frame.position.z = -0.004; frame.scale.set(1.04, 1.04, 1);
    this.frame = frame; this.group.add(frame);
    this.video = document.createElement('video'); this.video.muted = true; this.video.loop = true; this.video.playsInline = true; this.video.crossOrigin = 'anonymous'; this.video.preload = 'auto';
    this.vtex = new THREE.VideoTexture(this.video); this.vtex.colorSpace = THREE.SRGBColorSpace;
    this.loader = new THREE.TextureLoader();
    // flashbang: white shell around the head
    this.flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, depthWrite: false, toneMapped: false });
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), this.flashMat); this.flash.renderOrder = 999; this.flash.visible = false;
    this.flashT = -1; this.t = 0; this.state = 'off'; this.width = 1.9;
  }
  attachFlash(camera) { camera.add(this.flash); }

  async flashbang(level = 1) {
    if (level <= 0) { this.audio && this.audio.flashbang(); await wait(900); return; }
    this.audio && this.audio.flashbang();
    this.flashLevel = level; this.flashT = 0; this.flash.visible = true;
    await wait(1100);
  }

  // show a decision from the brain; resolves when it is gone
  async show(d, { hold } = {}) {
    if (!d) return;
    this.skip = false;
    let tex, aspect = d.aspect || 0.75;
    if (d.video) {
      this.video.src = this.base + d.file;
      try { await new Promise((res, rej) => { const t = setTimeout(res, 2500); this.video.oncanplay = () => { clearTimeout(t); res(); }; this.video.onerror = () => { clearTimeout(t); rej(); }; this.video.load(); }); } catch (e) { return; }
      if (this.video.videoWidth) aspect = this.video.videoHeight / this.video.videoWidth;
      this.video.currentTime = 0; this.video.play().catch(() => { });
      tex = this.vtex;
    } else {
      try { tex = await this.loader.loadAsync(this.base + d.file); tex.colorSpace = THREE.SRGBColorSpace; } catch (e) { return; }
      aspect = tex.image.height / tex.image.width;
    }
    if (this.mat.map && this.mat.map !== this.vtex) this.mat.map.dispose();
    this.mat.map = tex; this.mat.needsUpdate = true;
    const w = this.width, h = Math.min(w * aspect, 1.9);
    const ww = h / aspect;
    this.plane.scale.set(ww, h, 1); this.frame.scale.set(ww + 0.04, h + 0.04, 1);
    // caption (only for clean pictures; his pop-ups already have their text)
    const g = this.capCanvas.getContext('2d'); g.clearRect(0, 0, 1024, 1024);
    this.cap.visible = d.kind === 'clean' && !!d.line;
    if (this.cap.visible) {
      const ch = Math.max(256, Math.min(2048, Math.round(1024 * h / ww)));
      if (this.capCanvas.height !== ch) { this.capCanvas.height = ch; this.capTex.dispose(); this.capTex = new THREE.CanvasTexture(this.capCanvas); this.capTex.colorSpace = THREE.SRGBColorSpace; this.cap.material.map = this.capTex; this.cap.material.needsUpdate = true; }
      const g2 = this.capCanvas.getContext('2d'); g2.clearRect(0, 0, 1024, ch);
      drawCaption(g2, d.line, 512, this.capCanvas.height * 0.5, 860, 64);
      this.capTex.needsUpdate = true; this.cap.scale.set(ww, h, 1);
    }
    if (d.snd && this.audio) this.audio.play('memes/' + d.snd, { gain: 1 });
    this.audio && this.audio.duckMusic(true);
    this.group.visible = true; this.state = 'in'; this.t = 0;
    this.shake = /shock|max|flash/.test((d.tags || []).join(',')) ? 1 : 0.35;
    const dur = hold || (d.video ? Math.min(3.2, Math.max(2.2, (this.video.duration || 2.4))) : 2.4);
    const t0 = performance.now();
    while (performance.now() - t0 < dur * 1000 && !this.skip) await wait(50);
    this.state = 'out'; this.t = 0;
    await wait(220);
    this.group.visible = false; this.state = 'off';
    if (d.video) this.video.pause();
    this.audio && this.audio.duckMusic(false);
  }

  update(dt) {
    this.t += dt;
    if (this.state === 'in') {
      const k = Math.min(1, this.t / 0.22);
      const s = k < 1 ? 0.2 + 0.95 * easeOutBack(k) : 1;
      this.group.scale.setScalar(s);
      const sh = this.t < 0.5 ? this.shake * 0.02 * (1 - this.t / 0.5) : 0;
      this.group.rotation.z = Math.sin(this.t * 60) * sh * 2;
    } else if (this.state === 'out') {
      const k = Math.min(1, this.t / 0.2); this.group.scale.setScalar(1 - k * 0.8);
    }
    if (this.flashT >= 0) {
      this.flashT += dt; const t = this.flashT, L = this.flashLevel || 1;
      this.flashMat.opacity = (t < 0.06 ? t / 0.06 : t < 0.32 ? 1 : Math.max(0, 1 - (t - 0.32) / 1.9)) * 0.94 * L;
      if (t > 2.3) { this.flashT = -1; this.flash.visible = false; this.flashMat.opacity = 0; }
    }
  }
}
function easeOutBack(x) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
export const wait = (ms) => new Promise(r => setTimeout(r, ms));
