// Real recorded sounds (CC0), played in 3D so you hear where things happen.
import * as THREE from 'three';
import { assetURL, track } from './assets.js';

const GROUPS = {
  metal: ['metal1', 'metal2', 'metal3', 'metal4'], wood: ['wood1', 'wood2', 'wood3'], heavy: ['heavy1', 'heavy2', 'heavy3'],
  soft: ['soft1', 'soft2'], glass: ['glass1', 'glass2', 'glass3'], punch: ['punch1', 'punch2', 'punch3', 'punch4'],
  attach: ['attach1', 'attach2', 'attach3'], swing: ['swing1', 'swing2'], step: ['step1', 'step2'],
  ouch_m: ['ouch_m1', 'ouch_m2', 'ouch_m3', 'ouch_m4', 'ouch_m5', 'ouch_m6', 'ouch_m7', 'ouch_m8'],
  ouch_f: ['ouch_f1', 'ouch_f2', 'ouch_f3', 'ouch_f4', 'ouch_f5', 'ouch_f6', 'ouch_f7', 'ouch_f8', 'ouch_f9']
};
const ALL = ['ui_click', 'ui_select', 'ui_back', 'ui_open', 'ui_close', 'ui_toggle', 'ui_error', 'ui_ok', 'snap', 'remove', 'crack', 'tink',
  'piston', 'spring', 'button', 'pop', 'field', 'portal', 'zap', 'bell', 'gong', 'boom1', 'boom2', 'boom3',
  'loop_thrust', 'loop_motor', 'loop_hole', 'loop_beam', 'loop_wind', ...Object.values(GROUPS).flat()];

let ctx = null, master = null, buffers = {};
const listenerPos = new THREE.Vector3(), _m = new THREE.Matrix4(), _f = new THREE.Vector3(), _u = new THREE.Vector3();
export const audio = { volume: 0.8, ready: false };

export function initAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return Promise.resolve();
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = audio.volume;
  // a gentle limiter so big explosions do not clip
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10; comp.ratio.value = 6;
  master.connect(comp).connect(ctx.destination);
  const jobs = ALL.map((n) => track(fetch(assetURL('sfx/' + n + '.ogg')).then((r) => r.arrayBuffer())
    .then((b) => ctx.decodeAudioData(b)).then((buf) => { buffers[n] = buf; }).catch(() => {}), 0.15));
  return Promise.all(jobs).then(() => { audio.ready = true; });
}
export function resumeAudio() { if (ctx && ctx.state !== 'running') ctx.resume(); }
export function setVolume(v) { audio.volume = v; if (master) master.gain.value = v; }

export function updateListener(camera) {
  if (!ctx) return;
  camera.matrixWorld.decompose(listenerPos, _q, _s);
  _f.set(0, 0, -1).applyQuaternion(_q); _u.set(0, 1, 0).applyQuaternion(_q);
  const L = ctx.listener;
  if (L.positionX) {
    const t = ctx.currentTime;
    L.positionX.setTargetAtTime(listenerPos.x, t, 0.02); L.positionY.setTargetAtTime(listenerPos.y, t, 0.02); L.positionZ.setTargetAtTime(listenerPos.z, t, 0.02);
    L.forwardX.setTargetAtTime(_f.x, t, 0.02); L.forwardY.setTargetAtTime(_f.y, t, 0.02); L.forwardZ.setTargetAtTime(_f.z, t, 0.02);
    L.upX.setTargetAtTime(_u.x, t, 0.02); L.upY.setTargetAtTime(_u.y, t, 0.02); L.upZ.setTargetAtTime(_u.z, t, 0.02);
  } else { L.setPosition(listenerPos.x, listenerPos.y, listenerPos.z); L.setOrientation(_f.x, _f.y, _f.z, _u.x, _u.y, _u.z); }
}
const _q = new THREE.Quaternion(), _s = new THREE.Vector3();

function panner(pos) {
  const p = ctx.createPanner();
  p.panningModel = 'HRTF';
  p.distanceModel = 'inverse';
  p.refDistance = 3; p.rolloffFactor = 1.1; p.maxDistance = 400;
  p.positionX ? (p.positionX.value = pos.x, p.positionY.value = pos.y, p.positionZ.value = pos.z) : p.setPosition(pos.x, pos.y, pos.z);
  return p;
}
let playing = 0;
// play('metal', position, volume, pitch) — a group name picks a random take so repeats do not sound copy-pasted
export function play(name, pos = null, vol = 1, rate = 1) {
  if (!ctx || ctx.state !== 'running' || vol <= 0.01) return;
  if (name === 'boom') { play('boom1', pos, vol, rate * (0.9 + Math.random() * 0.15)); play('boom2', pos, vol * 0.8, rate); return; }
  const g = GROUPS[name];
  const key = g ? g[(Math.random() * g.length) | 0] : name;
  const buf = buffers[key];
  if (!buf || playing > 40) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate * (g ? 0.92 + Math.random() * 0.16 : 1);
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(gain);
  if (pos && pos.distanceTo(listenerPos) > 0.5) gain.connect(panner(pos)).connect(master); else gain.connect(master);
  playing++;
  src.onended = () => { playing--; };
  src.start();
}
// looping sounds (thrusters, motors, black holes): one handle per thing making noise
export function loop(name) {
  if (!ctx || !buffers[name]) return null;
  const src = ctx.createBufferSource();
  src.buffer = buffers[name];
  src.loop = true;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const pan = panner(listenerPos);
  src.connect(gain).connect(pan).connect(master);
  src.start(0, Math.random() * buffers[name].duration);
  return {
    set(vol, pos, rate = 1) {
      const t = ctx.currentTime;
      gain.gain.setTargetAtTime(vol, t, 0.08);
      src.playbackRate.setTargetAtTime(rate, t, 0.1);
      if (pos) { if (pan.positionX) { pan.positionX.setTargetAtTime(pos.x, t, 0.03); pan.positionY.setTargetAtTime(pos.y, t, 0.03); pan.positionZ.setTargetAtTime(pos.z, t, 0.03); } else pan.setPosition(pos.x, pos.y, pos.z); }
    },
    stop() { try { gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05); src.stop(ctx.currentTime + 0.3); } catch (e) { /* already stopped */ } }
  };
}
// non-3D loop (wind around you)
export function ambient(name) {
  if (!ctx || !buffers[name]) return null;
  const src = ctx.createBufferSource();
  src.buffer = buffers[name]; src.loop = true;
  const gain = ctx.createGain(); gain.gain.value = 0;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800;
  src.connect(lp).connect(gain).connect(master);
  src.start();
  return { set(vol, cutoff = 800) { gain.gain.setTargetAtTime(vol, ctx.currentTime, 0.3); lp.frequency.setTargetAtTime(cutoff, ctx.currentTime, 0.3); } };
}
