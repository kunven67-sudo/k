// Real recorded sounds (assets/snd), played in 3D around the camera.
import * as THREE from 'three';

const NAMES = ['roar_bear', 'roar_big', 'roar_cat', 'roar_dragon', 'growl', 'growl2', 'hyena', 'screech', 'alien', 'fossil', 'zombie1', 'zombie2',
  'chit', 'chit2', 'pain1', 'pain2', 'pain3', 'scream', 'gun_pistol', 'gun_rifle', 'boom', 'swish1', 'swish2', 'swish3', 'flesh1', 'flesh2',
  'break1', 'break2', 'regen', 'pop', 'clang'];

export class Audio {
  constructor() {
    this.ctx = null; this.buf = {}; this.volume = 0.8; this.master = null;
  }
  async init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(this.ctx.destination);
    await Promise.all(NAMES.map(async n => {
      try { const r = await fetch('assets/snd/' + n + '.mp3'); this.buf[n] = await this.ctx.decodeAudioData(await r.arrayBuffer()); } catch (e) { /* missing sound = silent */ }
    }));
  }
  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume(); }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }
  listen(camera) {
    if (!this.ctx) return;
    const l = this.ctx.listener, p = camera.getWorldPosition(_v), f = camera.getWorldDirection(_f);
    if (l.positionX) {
      l.positionX.value = p.x; l.positionY.value = p.y; l.positionZ.value = p.z;
      l.forwardX.value = f.x; l.forwardY.value = f.y; l.forwardZ.value = f.z; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else { l.setPosition(p.x, p.y, p.z); l.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
  }
  play(name, { pos = null, vol = 1, rate = 1, far = 60 } = {}) {
    const b = this.buf[name]; if (!b || !this.ctx) return;
    const s = this.ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate * (0.94 + Math.random() * 0.12);
    const g = this.ctx.createGain(); g.gain.value = vol; s.connect(g);
    if (pos) {
      const p = this.ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = far / 12; p.maxDistance = far * 4; p.rolloffFactor = 1;
      if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
      g.connect(p); p.connect(this.master);
    } else g.connect(this.master);
    s.start();
    return s;
  }
}
const _v = new THREE.Vector3(), _f = new THREE.Vector3();
