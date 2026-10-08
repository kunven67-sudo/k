// Dev audition board for src/audio: every registered sound grouped by category, the music engine
// with muffle / radio controls, waveform + log-frequency spectrogram, and objective checks
// (peak dBFS, NaN, DC) for every buffer and offline music renders.
// URL flags: ?verify=1 runs the sound check on load, ?music=1 renders all tracks on load.

import { audio } from '../src/core/audio.js';
import { music, catalog, playStep, SURFACES } from '../src/audio/index.js';
import { TRACK_IDS } from '../src/audio/music/index.js';

const $ = (id) => document.getElementById(id);
const loops = new Map(); // name → handle
const q = new URLSearchParams(location.search);

// ---------------------------------------------------------------- analysis

function stats(buf) {
  let peak = 0, nan = 0, sum = 0, sq = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const v = d[i];
      if (!Number.isFinite(v)) { nan++; continue; }
      const a = Math.abs(v);
      if (a > peak) peak = a;
      sum += v;
      sq += v * v;
    }
  }
  const n = buf.length * buf.numberOfChannels;
  return { peakDb: 20 * Math.log10(peak + 1e-12), rmsDb: 10 * Math.log10(sq / n + 1e-12), dc: sum / n, nan, dur: buf.duration };
}

/** In-place radix-2 FFT on (re, im). */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

// Ink-on-black palette: deep green → gold → white (matches the board).
function color(v) {
  const t = Math.max(0, Math.min(1, v));
  const r = t < 0.5 ? t * 2 * 120 : 120 + (t - 0.5) * 2 * 135;
  const g = t < 0.5 ? 20 + t * 2 * 70 : 90 + (t - 0.5) * 2 * 160;
  const b = t < 0.5 ? 30 + t * 2 * 30 : 60 + (t - 0.5) * 2 * 150;
  return [r * Math.min(1, t * 3), g * Math.min(1, t * 3), b * Math.min(1, t * 3)];
}

function drawSpectrogram(canvas, buf) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, N = 1024;
  const d = buf.getChannelData(0), sr = buf.sampleRate;
  const img = g.createImageData(W, H);
  const win = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  const fLo = 30, fHi = Math.min(20000, sr / 2);
  for (let x = 0; x < W; x++) {
    const start = Math.floor((x / W) * Math.max(1, d.length - N));
    const re = new Float32Array(N), im = new Float32Array(N);
    for (let i = 0; i < N; i++) re[i] = (d[start + i] || 0) * win[i];
    fft(re, im);
    for (let y = 0; y < H; y++) {
      const f = fLo * Math.pow(fHi / fLo, 1 - y / H);
      const bin = Math.min(N / 2 - 1, Math.round((f / sr) * N));
      const mag = Math.hypot(re[bin], im[bin]) / (N / 4);
      const db = 20 * Math.log10(mag + 1e-9);
      const [r, gg, b] = color((db + 95) / 85);
      const o = (y * W + x) * 4;
      img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  g.fillStyle = 'rgba(233,228,214,.55)';
  g.font = '10px ui-monospace, monospace';
  for (const f of [100, 1000, 10000]) {
    const y = H * (1 - Math.log(f / fLo) / Math.log(fHi / fLo));
    g.fillRect(0, y, 6, 1);
    g.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, 8, y + 3);
  }
}

function drawWave(canvas, buf) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  g.fillStyle = '#060807';
  g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(216,178,90,.12)';
  g.fillRect(0, H / 2 - (H / 2) * 0.708, W, H * 0.708); // -3 dBFS guide band
  const d = buf.getChannelData(0);
  const per = d.length / W;
  g.fillStyle = '#d8b25a';
  for (let x = 0; x < W; x++) {
    let lo = 1, hi = -1;
    for (let i = Math.floor(x * per); i < Math.floor((x + 1) * per); i++) {
      if (d[i] < lo) lo = d[i];
      if (d[i] > hi) hi = d[i];
    }
    if (hi < lo) continue;
    g.fillRect(x, H / 2 - hi * (H / 2), 1, Math.max(1, (hi - lo) * (H / 2)));
  }
}

function show(name, buf) {
  $('name').textContent = name;
  drawWave($('wave'), buf);
  drawSpectrogram($('spec'), buf);
  const s = stats(buf);
  const ok = s.nan === 0 && s.peakDb <= -0.99 && Math.abs(s.dc) < 0.01;
  $('stats').innerHTML = `<b>${name}</b>  ${s.dur.toFixed(2)} s · ${buf.numberOfChannels} ch · ${buf.sampleRate} Hz\n` +
    `peak <b>${s.peakDb.toFixed(1)} dBFS</b> · rms ${s.rmsDb.toFixed(1)} dB · dc ${s.dc.toFixed(5)} · NaN ${s.nan}  ` +
    `<span class="${ok ? 'ok' : 'warn'}">${ok ? 'PASS' : 'CHECK'}</span>`;
  return { ...s, ok };
}

// ---------------------------------------------------------------- sound buttons

async function unlock() {
  await audio.unlock();
}

function buildBoard() {
  const groups = {};
  for (const c of catalog) (groups[c.group] ??= []).push(c);
  const root = $('groups');
  // Footsteps get a "random variant" row on top of the raw variants.
  const stepSec = document.createElement('section');
  stepSec.innerHTML = '<h2>playStep(surface) <span>random variant ±8% rate</span></h2><div class="btns"></div>';
  for (const s of SURFACES) {
    const b = document.createElement('button');
    b.textContent = s;
    b.onclick = async () => { await unlock(); playStep(s); show(`step.${s}`, audio.buffer(`step.${s}.1`)); };
    stepSec.querySelector('.btns').append(b);
  }
  root.append(stepSec);
  for (const [g, list] of Object.entries(groups)) {
    const sec = document.createElement('section');
    sec.innerHTML = `<h2>${g} <span>${list.length}</span></h2><div class="btns"></div>`;
    for (const { name, loop } of list) {
      const b = document.createElement('button');
      b.textContent = name;
      b.dataset.name = name;
      if (loop) b.classList.add('loop');
      b.onclick = async () => {
        await unlock();
        const buf = audio.buffer(name);
        show(name, buf);
        if (!loop) return void audio.play(name, { bus: 'sfx', reverb: 0.2 });
        if (loops.has(name)) {
          loops.get(name).stop(0.3);
          loops.delete(name);
          b.classList.remove('on');
        } else {
          loops.set(name, audio.play(name, { loop: true, bus: 'ambience', reverb: 0.1 }));
          b.classList.add('on');
        }
      };
      sec.querySelector('.btns').append(b);
    }
    root.append(sec);
  }
}

// ---------------------------------------------------------------- music

function buildMusic() {
  for (const id of TRACK_IDS) {
    const b = document.createElement('button');
    b.textContent = id;
    b.dataset.track = id;
    b.onclick = async () => {
      await unlock();
      music.play(id, { fade: 1.5 });
      $('radio').value = music.radio;
      document.querySelectorAll('[data-track]').forEach((x) => x.classList.toggle('on', x === b));
    };
    $('tracks').append(b);
  }
  $('stop').onclick = () => {
    music.stop({ fade: 1.5 });
    document.querySelectorAll('[data-track]').forEach((x) => x.classList.remove('on'));
  };
  $('muffle').oninput = (e) => music.setMuffle(+e.target.value);
  $('radio').oninput = (e) => music.setRadioFX(+e.target.value);
  $('render').onclick = async () => {
    const id = music.current || 'menu-lounge';
    $('stats').textContent = `rendering ${id}…`;
    const buf = await music.render(id, 16);
    show(`music:${id}`, buf);
  };
  setInterval(() => ($('section').textContent = music.current ? `${music.current} · ${music.section}` : '—'), 250);
}

// ---------------------------------------------------------------- verification

async function verifyAll() {
  const lines = [];
  let bad = 0;
  const t0 = performance.now();
  for (const { name } of catalog) {
    const t = performance.now();
    const buf = audio.buffer(name);
    const s = stats(buf);
    const ms = performance.now() - t;
    const ok = s.nan === 0 && s.peakDb <= -0.99 && s.peakDb > -40 && Math.abs(s.dc) < 0.01;
    if (!ok) bad++;
    lines.push(`${ok ? '  ' : '✗ '}${name.padEnd(24)} ${s.dur.toFixed(2).padStart(6)}s  pk ${s.peakDb.toFixed(1).padStart(5)}  dc ${s.dc.toFixed(4).padStart(7)}  ${ms.toFixed(0).padStart(4)}ms`);
    document.querySelector(`[data-name="${CSS.escape(name)}"]`)?.classList.toggle('bad', !ok);
    await new Promise((r) => setTimeout(r, 0));
  }
  $('vsum').innerHTML = `<span class="${bad ? 'warn' : 'ok'}">${catalog.length} sounds · ${bad} flagged · ${((performance.now() - t0) / 1000).toFixed(1)} s</span>`;
  $('report').textContent = lines.join('\n');
  window.__verify = { count: catalog.length, bad };
}

async function verifyMusic() {
  $('specs').innerHTML = '';
  const out = [];
  for (const id of TRACK_IDS) {
    const buf = await music.render(id, 14);
    const s = stats(buf);
    const fig = document.createElement('figure');
    const c = document.createElement('canvas');
    c.width = 400;
    c.height = 150;
    fig.append(c);
    const ok = s.nan === 0 && s.peakDb <= -1 && Math.abs(s.dc) < 0.01;
    fig.insertAdjacentHTML('beforeend', `<figcaption>${id} · pk ${s.peakDb.toFixed(1)} dB · rms ${s.rmsDb.toFixed(1)} · <span class="${ok ? 'ok' : 'warn'}">${ok ? 'PASS' : 'CHECK'}</span></figcaption>`);
    $('specs').append(fig);
    drawSpectrogram(c, buf);
    out.push({ id, ...s, ok });
  }
  window.__music = out;
}

$('verify').onclick = verifyAll;
$('verifyMusic').onclick = verifyMusic;
buildBoard();
buildMusic();
if (q.get('verify')) verifyAll();
if (q.get('music')) verifyMusic();
if (q.get('show')) show(q.get('show'), audio.buffer(q.get('show')));
if (q.get('render')) music.render(q.get('render'), +(q.get('sec') || 16)).then((b) => show(`music:${q.get('render')}`, b));
