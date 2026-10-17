// 3D sound engine: distance delay (speed of sound), distance muffling, slow-motion pitch,
// ear ringing, ambience, and the boombox radio.
import * as THREE from 'three';
import * as S from './synth.js';
import { Radio } from './radio.js';
import { getSettings, onSettingsChange } from '../settings.js';
import { physicsState } from '../engine/physics.js';
import ASSETS from 'virtual:assets';

const SPEED_OF_SOUND = 343;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

class AudioEngine {
  constructor() {
    this.ac = null;
    this.bank = {};
    this.listener = new THREE.Vector3();
    this.loops = new Map();
    this.ready = false;
    this.ringGain = null;
    this.radios = new Map(); // boombox entity -> { radio, panner }
  }

  // Must be called from a user gesture (click on Play).
  async init() {
    if (this.ac) { if (this.ac.state === 'suspended') await this.ac.resume(); return; }
    const ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    this.ac = ac;
    S.setSampleRate(ac.sampleRate);
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -10; comp.ratio.value = 6; comp.attack.value = 0.002; comp.release.value = 0.25;
    this.master = ac.createGain();
    this.master.connect(comp); comp.connect(ac.destination);
    // "deafened" lowpass on everything after a close blast
    this.deafen = ac.createBiquadFilter(); this.deafen.type = 'lowpass'; this.deafen.frequency.value = 20000;
    this.deafen.connect(this.master);
    this.fxBus = ac.createGain(); this.fxBus.connect(this.deafen);
    this.musicBus = ac.createGain(); this.musicBus.connect(this.deafen);
    this.ambBus = ac.createGain(); this.ambBus.connect(this.deafen);
    this.applyVolumes();
    onSettingsChange((k) => { if (k.startsWith('vol')) this.applyVolumes(); });
    this.generate();
    this.ready = true;
    this.startAmbience();
  }

  applyVolumes() {
    const s = getSettings();
    this.master.gain.value = s.volMaster;
    this.fxBus.gain.value = s.volEffects;
    this.musicBus.gain.value = s.volMusic;
    this.ambBus.gain.value = s.volAmbient * 0.6;
  }

  generate() {
    const ac = this.ac;
    const many = (fn, n) => Array.from({ length: n }, fn);
    this.bank = {
      explosion: many(() => S.explosion(ac, 1), 3),
      explosionBig: many(() => S.explosion(ac, 1.8), 2),
      wood: many(() => S.woodKnock(ac), 5),
      metal: many(() => S.metalClang(ac), 4),
      metalLight: many(() => S.metalClang(ac, true), 4),
      glass: many(() => S.glassShatter(ac), 3),
      tempered: many(() => S.glassShatter(ac, true), 2),
      glassTink: many(() => S.metalClang(ac, true), 3),
      concrete: many(() => S.concreteCrunch(ac), 4),
      thud: many(() => S.thud(ac, rnd(70, 120)), 4),
      rubber: many(() => S.thud(ac, rnd(55, 75), 0.3), 3),
      plastic: many(() => S.plasticTick(ac), 4),
      cardboard: many(() => S.thud(ac, rnd(140, 200), 0.2), 3),
      stepConcrete: many(() => S.footstep(ac, 'concrete'), 6),
      stepMetal: many(() => S.footstep(ac, 'metal'), 4),
      stepWood: many(() => S.footstep(ac, 'wood'), 4),
      land: many(() => S.thud(ac, 80, 0.35), 2),
      rpg: [S.rpgLaunch(ac)],
      whoosh: [S.whoosh(ac, 1.0)],
      click: [S.click(ac, 2400)],
      pin: [S.click(ac, 3400, 0.08)],
      spoon: [S.metalClang(ac, true)],
      beep: [S.beep(ac)],
      hiss: [S.noiseLoop(ac, 2, 5000, true)],
      jet: [S.noiseLoop(ac, 2, 1200)],
      wind: [S.wind(ac)],
      bird: many(() => S.birdChirp(ac), 6),
      ring: [S.ringing(ac)],
      debris: many(() => S.noiseBurst(ac, 0.12, 2500, 40), 4),
      shotPistol: many(() => S.gunshot(ac, 'pistol'), 3),
      shotRifle: many(() => S.gunshot(ac, 'rifle'), 3),
      shotShotgun: many(() => S.gunshot(ac, 'shotgun'), 2),
      shotSniper: many(() => S.gunshot(ac, 'sniper'), 2),
      magOut: [S.mech(ac, 'magOut')], magIn: [S.mech(ac, 'magIn')], slide: [S.mech(ac, 'slide')],
      pump: [S.mech(ac, 'pump')], bolt: [S.mech(ac, 'bolt')], dry: [S.mech(ac, 'dry')], shellIn: [S.mech(ac, 'shell')], select: [S.mech(ac, 'select')],
      casing: many(() => S.casingTink(ac), 4),
      ricochet: many(() => S.ricochet(ac), 3),
      flesh: many(() => S.fleshHit(ac), 3),
      heartbeat: [S.heartbeat(ac)],
      rip: [S.rip(ac)],
      pills: [S.pills(ac)],
    };
    // indoor reverb send + outdoor echo send (gunshots/explosions use these)
    this.reverb = ac.createConvolver();
    this.reverb.buffer = S.roomIR(ac);
    this.reverbSend = ac.createGain(); this.reverbSend.gain.value = 0;
    this.reverbSend.connect(this.reverb); this.reverb.connect(this.fxBus);
    this.echoSend = ac.createGain(); this.echoSend.gain.value = 0.35;
    const d1 = ac.createDelay(3); d1.delayTime.value = 0.85;
    const d2 = ac.createDelay(3); d2.delayTime.value = 1.6;
    const elp = ac.createBiquadFilter(); elp.type = 'lowpass'; elp.frequency.value = 900;
    const g1 = ac.createGain(); g1.gain.value = 0.35; const g2 = ac.createGain(); g2.gain.value = 0.18;
    this.echoSend.connect(elp); elp.connect(d1); elp.connect(d2); d1.connect(g1); d2.connect(g2); g1.connect(this.fxBus); g2.connect(this.fxBus);
    // Real recordings dropped into assets/sounds/<name>_N.ogg replace the generated ones.
    for (const key of Object.keys(ASSETS)) {
      const m = key.match(/^sounds\/([a-zA-Z]+)(?:_\d+)?\.(ogg|mp3|wav)$/);
      if (!m) continue;
      const name = m[1];
      fetch(ASSETS[key]).then((r) => r.arrayBuffer()).then((ab) => ac.decodeAudioData(ab)).then((b) => {
        if (!this.bank[name] || !this.bank[name].real) { this.bank[name] = []; this.bank[name].real = true; }
        this.bank[name].push(b);
      }).catch(() => {});
    }
  }

  setListener(camera) {
    if (!this.ready) return;
    const l = this.ac.listener;
    const p = camera.position;
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const u = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    this.listener.copy(p);
    if (l.positionX) {
      const t = this.ac.currentTime;
      l.positionX.setTargetAtTime(p.x, t, 0.01); l.positionY.setTargetAtTime(p.y, t, 0.01); l.positionZ.setTargetAtTime(p.z, t, 0.01);
      l.forwardX.setTargetAtTime(f.x, t, 0.01); l.forwardY.setTargetAtTime(f.y, t, 0.01); l.forwardZ.setTargetAtTime(f.z, t, 0.01);
      l.upX.setTargetAtTime(u.x, t, 0.01); l.upY.setTargetAtTime(u.y, t, 0.01); l.upZ.setTargetAtTime(u.z, t, 0.01);
    } else {
      l.setPosition(p.x, p.y, p.z); l.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z);
    }
    // slow motion deepens everything already playing
    const rate = 0.35 + 0.65 * physicsState.timeScale;
    for (const lp of this.loops.values()) lp.src.playbackRate.value = (lp.baseRate || 1) * rate;
  }

  // Play a sound from the bank. pos = world position (null = 2D, e.g. your own footsteps).
  // Indoors (under a roof) gunshots boom with reverb; outdoors they crack and echo off the hills.
  setIndoor(indoor) {
    if (!this.ready || this.indoor === indoor) return;
    this.indoor = indoor;
    const t = this.ac.currentTime;
    this.reverbSend.gain.setTargetAtTime(indoor ? 0.9 : 0.05, t, 0.2);
    this.echoSend.gain.setTargetAtTime(indoor ? 0.05 : 0.35, t, 0.2);
  }

  play(name, { pos = null, vol = 1, rate = 1, ref = 4, bus = 'fx', delay = true, loop = false, space = false } = {}) {
    // while the context is suspended (before you click Play) sounds would pile up and all fire at once
    if (!this.ready || this.ac.state !== 'running') return null;
    const list = this.bank[name];
    if (!list?.length) return null;
    // voice limit: when lots of debris is clattering, drop the quiet sounds
    if (!loop && this.voices >= 24 && vol < 0.7) return null;
    if (!loop && this.voices >= 48) return null;
    const ac = this.ac;
    const src = ac.createBufferSource();
    src.buffer = pick(list);
    src.loop = loop;
    const slow = 0.35 + 0.65 * physicsState.timeScale;
    src.playbackRate.value = rate * slow;
    const g = ac.createGain();
    g.gain.value = vol;
    let node = src;
    let when = ac.currentTime;
    if (pos) {
      const d = pos.distanceTo(this.listener);
      if (d > 2500) return null;
      // far sounds lose their highs (air absorption) and arrive late (speed of sound)
      const lpf = ac.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = Math.max(350, 18000 / (1 + d / 40));
      node.connect(lpf); node = lpf;
      const p = ac.createPanner();
      p.panningModel = 'equalpower';
      p.distanceModel = 'inverse';
      p.refDistance = ref;
      p.rolloffFactor = 1;
      p.maxDistance = 10000;
      p.positionX ? (p.positionX.value = pos.x, p.positionY.value = pos.y, p.positionZ.value = pos.z) : p.setPosition(pos.x, pos.y, pos.z);
      node.connect(p); node = p;
      if (delay && !loop) when += d / SPEED_OF_SOUND / Math.max(0.2, physicsState.timeScale);
    }
    node.connect(g);
    g.connect(bus === 'music' ? this.musicBus : bus === 'amb' ? this.ambBus : this.fxBus);
    if (space) { g.connect(this.reverbSend); g.connect(this.echoSend); }
    src.start(when);
    this.voices = (this.voices || 0) + 1;
    src.onended = () => { this.voices--; };
    return { src, gain: g, panner: pos ? node : null };
  }

  // Looping sounds keyed by an id (jetpack, fuse hiss...). vol 0 stops it.
  loop(id, name, vol, pos = null, rate = 1) {
    if (!this.ready) return;
    let lp = this.loops.get(id);
    if (vol <= 0.001) {
      if (lp) { lp.gain.gain.setTargetAtTime(0, this.ac.currentTime, 0.05); lp.src.stop(this.ac.currentTime + 0.3); this.loops.delete(id); }
      return;
    }
    if (!lp) {
      const h = this.play(name, { pos, vol: 0, loop: true, delay: false });
      if (!h) return;
      lp = { ...h, baseRate: rate };
      this.loops.set(id, lp);
    }
    lp.baseRate = rate;
    lp.gain.gain.setTargetAtTime(vol, this.ac.currentTime, 0.05);
    if (pos && lp.panner?.positionX) { lp.panner.positionX.value = pos.x; lp.panner.positionY.value = pos.y; lp.panner.positionZ.value = pos.z; }
  }

  explosion(pos, power, fuel) {
    const k = Math.cbrt(power);
    const big = power > 1.5 || fuel;
    this.play(big ? 'explosionBig' : 'explosion', { pos, space: true, vol: Math.min(2.5, 0.8 + k * 0.9), ref: 8 + k * 10, rate: rnd(0.9, 1.05) / Math.max(0.8, Math.pow(k, 0.15)) });
    // a little debris rain after
    for (let i = 0; i < Math.min(8, 3 + k * 3); i++) setTimeout(() => this.play(pick(['debris', 'concrete', 'wood', 'metalLight']), { pos, vol: 0.25, ref: 4 }), 400 + Math.random() * 1500);
  }

  // Close blast: muffled hearing + ear ringing for a few seconds.
  earRinging(strength) {
    if (!this.ready || strength <= 0) return;
    const t = this.ac.currentTime;
    const f = this.deafen.frequency;
    f.cancelScheduledValues(t);
    f.setValueAtTime(Math.max(250, 2500 * (1 - strength)), t);
    f.exponentialRampToValueAtTime(20000, t + 2 + strength * 5);
    const h = this.play('ring', { vol: 0.12 * strength, bus: 'fx' });
    if (h) { h.gain.disconnect(); h.gain.connect(this.master); } // ringing is inside your head, not muffled
  }

  impact(matId, pos, strength) {
    const v = Math.min(1.2, strength);
    const map = {
      wood: 'wood', plywood: 'wood', steel: 'metal', aluminum: 'metalLight', glass: 'glassTink', tempered: 'glassTink',
      ice: 'glassTink', concrete: 'concrete', cinder: 'concrete', rubber: 'rubber', plastic: 'plastic', cardboard: 'cardboard', tnt: 'cardboard',
    };
    this.play(map[matId] || 'thud', { pos, vol: v, ref: 3, rate: rnd(0.9, 1.1) });
  }

  breakSound(matId, pos, size) {
    const name = matId === 'tempered' ? 'tempered' : matId === 'glass' ? 'glass' : matId === 'ice' ? 'glass' : (matId === 'wood' || matId === 'plywood') ? 'wood' : (matId === 'concrete' || matId === 'cinder') ? 'concrete' : 'plastic';
    this.play(name, { pos, vol: Math.min(1.5, 0.6 + size * 0.4), ref: 5, rate: name === 'wood' ? rnd(0.6, 0.8) : name === 'glass' && matId === 'ice' ? 0.6 : 1 });
  }

  startAmbience() {
    const w = this.play('wind', { vol: 0.5, bus: 'amb', loop: true, delay: false });
    this.windHandle = w;
    const chirp = () => {
      if (this.listener) {
        const a = Math.random() * Math.PI * 2, d = rnd(40, 160);
        this.play('bird', { pos: this.listener.clone().add(new THREE.Vector3(Math.cos(a) * d, rnd(4, 20), Math.sin(a) * d)), vol: 0.35, bus: 'amb', ref: 20, rate: rnd(0.9, 1.15) });
      }
      setTimeout(chirp, rnd(3000, 11000));
    };
    setTimeout(chirp, 4000);
  }

  // ---- boombox radios
  radioNext(entity) {
    if (!this.ready) return null;
    let r = this.radios.get(entity);
    if (!r) {
      const panner = this.ac.createPanner();
      panner.panningModel = 'equalpower'; panner.distanceModel = 'inverse'; panner.refDistance = 2.5; panner.rolloffFactor = 1.2;
      panner.connect(this.musicBus);
      r = { radio: new Radio(this.ac, panner), panner };
      this.radios.set(entity, r);
    }
    const name = r.radio.next();
    if (!name) { r.radio.out.disconnect(); r.panner.disconnect(); this.radios.delete(entity); }
    return name;
  }

  updateRadios() {
    for (const [e, r] of this.radios) {
      if (!e.alive) { r.radio.stop(); r.radio.out.disconnect(); r.panner.disconnect(); this.radios.delete(e); continue; }
      const p = e.root.position;
      if (r.panner.positionX) { r.panner.positionX.value = p.x; r.panner.positionY.value = p.y; r.panner.positionZ.value = p.z; }
      else r.panner.setPosition(p.x, p.y, p.z);
    }
  }

  stopAllRadios() {
    for (const r of this.radios.values()) { r.radio.stop(); r.radio.out.disconnect(); r.panner.disconnect(); }
    this.radios.clear();
  }
}

export const audio = new AudioEngine();
