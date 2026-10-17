
// ---------- audio: every sound is synthesized live ----------
const settings = { master: 80, music: 55, sfx: 85, gore: 2, sens: 100, dmgNums: 1, hard: 0, brain: 'ai', brainAsked: 0 };
try { Object.assign(settings, JSON.parse(localStorage.getItem('ironblood.settings') || '{}')); } catch (e) {}
function saveSettings() { try { localStorage.setItem('ironblood.settings', JSON.stringify(settings)); } catch (e) {} }

const AC = window.AudioContext || window.webkitAudioContext;
let ac = null, masterGain, sfxGain, musicGain, noiseBuf;
function audioInit() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  ac = new AC();
  masterGain = ac.createGain(); masterGain.connect(ac.destination);
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  comp.connect(masterGain);
  sfxGain = ac.createGain(); sfxGain.connect(comp);
  musicGain = ac.createGain(); musicGain.connect(comp);
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolumes();
  startAmbience();
  startMusic();
}
function applyVolumes() {
  if (!ac) return;
  masterGain.gain.value = (settings.master / 100) ** 1.5;
  sfxGain.gain.value = settings.sfx / 100;
  musicGain.gain.value = (settings.music / 100) * 0.55;
}

// 3D-ish placement: volume falls off with distance, pan by angle to the camera
const _ap = new THREE.Vector3();
function spatial(pos, vol) {
  const g = ac.createGain(), p = ac.createStereoPanner();
  let v = vol, pan = 0;
  if (pos) {
    const d = camera.position.distanceTo(pos);
    v *= 1 / (1 + Math.max(0, d - 2) * 0.12);
    _ap.copy(pos).applyMatrix4(camera.matrixWorldInverse);
    pan = Math.max(-1, Math.min(1, _ap.x / (Math.abs(_ap.z) + 2)));
  }
  g.gain.value = v; p.pan.value = pan;
  g.connect(p); p.connect(sfxGain);
  return g;
}
function noiseSrc(t0, dur, rate = 1) {
  const s = ac.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = rate;
  s.start(t0, Math.random() * 1.5, dur + 0.05); return s;
}
function env(g, t0, a, peak, dec) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec);
}
function tone(type, f0, f1, t0, a, peak, dec, out) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t0);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + a + dec);
  env(g, t0, a, peak, dec); o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + a + dec + 0.05);
  return o;
}
function noiseHit(t0, dur, type, freq, q, peak, out, rate = 1, a = 0.003) {
  const s = noiseSrc(t0, dur, rate), f = ac.createBiquadFilter(), g = ac.createGain();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  env(g, t0, a, peak, dur); s.connect(f); f.connect(g); g.connect(out);
  return f;
}

const sfx = {
  // blade cutting air: heavier swords are lower and longer
  swing(pos, weight = 1.3, power = 1) {
    if (!ac) return; const t = ac.currentTime, out = spatial(pos, 0.5 * power);
    const dur = 0.16 + weight * 0.07;
    const f = noiseHit(t, dur, 'bandpass', 900, 1.4, 0.9, out, 1, dur * 0.45);
    f.frequency.setValueAtTime(500 / Math.sqrt(weight), t);
    f.frequency.exponentialRampToValueAtTime(2600 / Math.sqrt(weight), t + dur * 0.5);
    f.frequency.exponentialRampToValueAtTime(700, t + dur);
  },
  // steel on steel: inharmonic ringing partials plus a sharp transient
  clang(pos, power = 1) {
    if (!ac) return; const t = ac.currentTime, out = spatial(pos, 0.55 * power);
    const base = 520 + Math.random() * 240;
    for (const [m, v, d] of [[1, 0.5, 0.9], [2.76, 0.32, 0.6], [5.4, 0.2, 0.4], [8.9, 0.12, 0.25], [1.5, 0.18, 0.7]])
      tone('sine', base * m, base * m * 0.995, t, 0.002, v, d, out);
    noiseHit(t, 0.08, 'highpass', 3000, 0.7, 0.9, out);
  },
  // blade into armor that it fails to cut
  armorHit(pos) {
    if (!ac) return; const t = ac.currentTime, out = spatial(pos, 0.5);
    tone('square', 320, 180, t, 0.002, 0.25, 0.12, out);
    for (const m of [1, 2.3, 4.1]) tone('sine', 900 * m, 880 * m, t, 0.002, 0.18 / m, 0.35, out);
    noiseHit(t, 0.06, 'bandpass', 2400, 1, 0.6, out);
  },
  // wet cut into flesh
  cut(pos, deep = 1) {
    if (!ac) return; const t = ac.currentTime, out = spatial(pos, 0.7);
    noiseHit(t, 0.09, 'lowpass', 1800, 0.8, 0.8 * deep, out);
    const f = noiseHit(t + 0.02, 0.22, 'bandpass', 700, 3, 0.55 * deep, out, 0.6);
    f.frequency.setValueAtTime(1200, t + 0.02); f.frequency.exponentialRampToValueAtTime(260, t + 0.24);
    tone('sine', 140, 60, t, 0.004, 0.45 * deep, 0.14, out);
  },
  // bone snapping
  crack(pos) {
    if (!ac) return; const t = ac.currentTime, out = spatial(pos, 0.7);
    for (let i = 0; i < 4; i++) noiseHit(t + i * 0.012 + Math.random() * 0.008, 0.018, 'highpass', 1800 + Math.random() * 2000, 1.5, 0.9, out);
    tone('triangle', 220, 90, t, 0.002, 0.4, 0.08, out);
  },
  stab(pos) { if (!ac) return; this.cut(pos, 1.1); const t = ac.currentTime, out = spatial(pos, 0.5); noiseHit(t, 0.3, 'lowpass', 500, 2, 0.5, out, 0.5, 0.05); },
  // blood pumping from a stump
  spurt(pos) {
    if (!ac) return; const t = ac.currentTime, out = spatial(pos, 0.25);
    const f = noiseHit(t, 0.18, 'bandpass', 500, 4, 0.6, out, 0.7, 0.02);
    f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(900, t + 0.12);
  },
  thud(pos, power = 1) {
    if (!ac) return; const t = ac.currentTime, out = spatial(pos, 0.6 * power);
    tone('sine', 110, 45, t, 0.005, 0.8, 0.25, out);
    noiseHit(t, 0.12, 'lowpass', 400, 0.7, 0.5, out);
    for (const m of [1, 1.9]) tone('sine', 620 * m, 600 * m, t + 0.01, 0.002, 0.08, 0.3, out);
  },
  // footsteps: grass, dirt or water, with a little armor clink when armored
  step(pos, surface, armored, vol = 1) {
    if (!ac) return; const t = ac.currentTime, out = spatial(pos, 0.22 * vol);
    if (surface === 'water') { const f = noiseHit(t, 0.2, 'bandpass', 900, 1.5, 0.7, out, 0.8, 0.02); f.frequency.exponentialRampToValueAtTime(400, t + 0.2); }
    else if (surface === 'dirt') noiseHit(t, 0.07, 'bandpass', 700, 0.9, 0.8, out);
    else if (surface === 'mud') { const f = noiseHit(t, 0.16, 'bandpass', 500, 2.5, 0.8, out, 0.6, 0.02); f.frequency.exponentialRampToValueAtTime(250, t + 0.16); }
    else if (surface === 'snow') { noiseHit(t, 0.14, 'bandpass', 1400, 1.2, 0.6, out, 1, 0.03); noiseHit(t + 0.03, 0.08, 'highpass', 3500, 0.7, 0.3, out); }
    else { noiseHit(t, 0.1, 'highpass', 2500, 0.5, 0.45, out); noiseHit(t, 0.05, 'lowpass', 300, 0.8, 0.5, out); }
    if (armored) for (const m of [1, 1.7, 2.9]) tone('sine', (1300 + Math.random() * 300) * m, 0, t + 0.01, 0.002, 0.05 / m, 0.12, out);
  },
  // human voice: a buzzy source pushed through vowel formants
  voice(pos, kind, pitch = 1) {
    if (!ac) return; const t = ac.currentTime;
    const cfg = {
      grunt: { f0: 120, f1: 95, dur: 0.22, vol: 0.35, formants: [[600, 6], [1040, 7], [2250, 8]] },
      hurt: { f0: 170, f1: 120, dur: 0.38, vol: 0.45, formants: [[700, 6], [1100, 7], [2500, 8]] },
      scream: { f0: 300, f1: 210, dur: 1.1, vol: 0.5, formants: [[800, 5], [1250, 6], [2700, 8]] },
      shout: { f0: 160, f1: 140, dur: 0.5, vol: 0.45, formants: [[650, 6], [1080, 7], [2400, 8]] },
      death: { f0: 150, f1: 70, dur: 0.9, vol: 0.4, formants: [[550, 6], [900, 7], [2300, 8]] },
      exert: { f0: 140, f1: 110, dur: 0.16, vol: 0.3, formants: [[620, 6], [1050, 7], [2300, 8]] },
    }[kind];
    const out = spatial(pos, cfg.vol);
    const o = ac.createOscillator(); o.type = 'sawtooth';
    const f0 = cfg.f0 * pitch;
    o.frequency.setValueAtTime(f0 * 0.9, t);
    o.frequency.linearRampToValueAtTime(f0 * 1.06, t + cfg.dur * 0.2);
    o.frequency.exponentialRampToValueAtTime(cfg.f1 * pitch, t + cfg.dur);
    const vib = ac.createOscillator(), vg = ac.createGain(); vib.frequency.value = kind === 'scream' ? 7 : 5; vg.gain.value = f0 * (kind === 'scream' ? 0.04 : 0.015);
    vib.connect(vg); vg.connect(o.frequency);
    const g = ac.createGain(); env(g, t, 0.03, 1, cfg.dur);
    const breath = noiseSrc(t, cfg.dur, 1), bg = ac.createGain(); env(bg, t, 0.02, 0.12, cfg.dur);
    for (const [fr, q] of cfg.formants) {
      const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fr * (0.95 + Math.random() * 0.1); f.Q.value = q;
      o.connect(f); breath.connect(f); f.connect(g);
    }
    g.connect(out); bg.connect(out);
    o.start(t); vib.start(t); o.stop(t + cfg.dur + 0.1); vib.stop(t + cfg.dur + 0.1);
  },
  // medieval murmur: quick made-up syllables shaped like speech, one per word
  murmur(pos, text, pitch = 1, female = false) {
    if (!ac) return 0;
    const words = Math.min(26, Math.max(2, text.split(/\s+/).length));
    let t = ac.currentTime + 0.02;
    const out = spatial(pos, 0.32);
    const base = (female ? 215 : 118) * pitch;
    const V = [[730, 1090], [530, 1840], [270, 2290], [570, 840], [440, 1020], [660, 1700], [300, 870]];
    for (let w = 0; w < words; w++) {
      const syl = 1 + Math.floor(Math.random() * 2);
      for (let k = 0; k < syl; k++) {
        const d = 0.07 + Math.random() * 0.07;
        const o = ac.createOscillator(); o.type = 'sawtooth';
        const f0 = base * (0.92 + Math.random() * 0.16) * (w === words - 1 && k === syl - 1 ? (/\?\s*$/.test(text) ? 1.18 : 0.86) : 1);
        o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * (0.94 + Math.random() * 0.1), t + d);
        const g = ac.createGain(); env(g, t, 0.015, 0.5, d);
        const [a1, a2] = V[Math.floor(Math.random() * V.length)];
        for (const [fr, q] of [[a1 * (female ? 1.15 : 1), 5], [a2 * (female ? 1.12 : 1), 7], [2500, 9]]) { const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fr; f.Q.value = q; o.connect(f); f.connect(g); }
        // a soft consonant puff before some syllables
        if (Math.random() < 0.6) noiseHit(t - 0.012, 0.03, 'highpass', 3000 + Math.random() * 3000, 1, 0.12, out, 1, 0.002);
        g.connect(out); o.start(t); o.stop(t + d + 0.05);
        t += d + 0.015;
      }
      t += 0.05 + Math.random() * 0.06 + (/[,.!?]$/.test(text.split(/\s+/)[w] || '') ? 0.18 : 0);
    }
    return t - ac.currentTime;
  },
  // the village bell: a raid is coming
  bell() {
    if (!ac) return; const t0 = ac.currentTime;
    for (let i = 0; i < 6; i++) {
      const t = t0 + i * 0.9, out = spatial(null, 0.35);
      for (const [m, v] of [[1, 1], [2.0, 0.5], [2.76, 0.35], [5.4, 0.15]]) tone('sine', 392 * m, 392 * m * 0.998, t, 0.005, v, 2.4, out);
    }
  },
  kiss() { if (!ac) return; const t = ac.currentTime, out = spatial(null, 0.12); noiseHit(t, 0.06, 'bandpass', 1800, 3, 0.4, out, 1, 0.004); },
  coins() { if (!ac) return; const t = ac.currentTime, out = spatial(null, 0.25); for (let i = 0; i < 5; i++) tone('triangle', 2400 + Math.random() * 1600, 0, t + i * 0.05 + Math.random() * 0.03, 0.002, 0.3, 0.12, out); },
  ui(freq = 660) { if (!ac) return; const t = ac.currentTime, out = spatial(null, 0.2); tone('triangle', freq, freq * 1.5, t, 0.005, 0.5, 0.15, out); },
  // thunder: a crack, then a long low roll
  thunder() {
    if (!ac) return; const t = ac.currentTime, out = spatial(null, 0.9);
    noiseHit(t, 0.25, 'lowpass', 2500, 0.6, 0.7, out);
    const f = noiseHit(t + 0.05, 3.5, 'lowpass', 220, 0.9, 1.0, out, 0.5, 0.25);
    f.frequency.setValueAtTime(320, t); f.frequency.exponentialRampToValueAtTime(70, t + 3.5);
  },
  heartbeat() { if (!ac) return; const t = ac.currentTime, out = spatial(null, 0.5); tone('sine', 60, 40, t, 0.01, 0.9, 0.12, out); tone('sine', 55, 38, t + 0.18, 0.01, 0.6, 0.12, out); },
};

// ---------- ambience: wind, birds by day, crickets at night ----------
let windGain, windFilter;
function startAmbience() {
  const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  windFilter = ac.createBiquadFilter(); windFilter.type = 'lowpass'; windFilter.frequency.value = 500;
  windGain = ac.createGain(); windGain.gain.value = 0.05;
  s.connect(windFilter); windFilter.connect(windGain); windGain.connect(sfxGain); s.start();
}
let ambT = 0;
function updateAmbience(dt, dayK) {
  if (!ac) return;
  ambT -= dt;
  windFilter.frequency.value = 350 + Math.sin(performance.now() * 0.0003) * 180 + 150;
  windGain.gain.value = 0.035 + Math.sin(performance.now() * 0.00021) * 0.015;
  if (ambT > 0) return;
  ambT = 0.4 + Math.random() * 1.6;
  const t = ac.currentTime;
  if (dayK > 0.5) {
    if (Math.random() < 0.5) {
      const out = spatial(null, 0.05), f = 2500 + Math.random() * 2000;
      const n = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) tone('sine', f, f * (Math.random() < 0.5 ? 1.3 : 0.75), t + i * 0.11, 0.01, 0.6, 0.07, out);
    }
  } else {
    const out = spatial(null, 0.035);
    for (let i = 0; i < 6; i++) tone('sine', 4400 + Math.random() * 200, 0, t + i * 0.045, 0.004, 0.5, 0.025, out);
  }
}

// ---------- music: calm while exploring, war drums + strings in fights ----------
let calmBus, fightBus, musicStep = 0, nextNote = 0, fightLevel = 0;
const MINOR = [0, 2, 3, 5, 7, 8, 10];
function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
function startMusic() {
  calmBus = ac.createGain(); fightBus = ac.createGain();
  calmBus.gain.value = 0.7; fightBus.gain.value = 0;
  const rev = ac.createConvolver();
  const len = ac.sampleRate * 2.2, ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
  rev.buffer = ir;
  const wet = ac.createGain(); wet.gain.value = 0.35;
  calmBus.connect(musicGain); fightBus.connect(musicGain);
  calmBus.connect(rev); fightBus.connect(rev); rev.connect(wet); wet.connect(musicGain);
  nextNote = ac.currentTime + 0.5;
}
function strings(freqs, t, dur, out, vol) {
  for (const f of freqs) for (const det of [-6, 0, 7]) {
    const o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
    lp.type = 'lowpass'; lp.frequency.value = 1400;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
}
function updateMusic(inFight) {
  if (!ac) return;
  fightLevel += ((inFight ? 1 : 0) - fightLevel) * 0.01;
  calmBus.gain.value = 0.7 * (1 - fightLevel);
  fightBus.gain.value = 0.9 * fightLevel;
  const beat = 60 / (fightLevel > 0.5 ? 132 : 72);
  while (nextNote < ac.currentTime + 0.25) {
    const t = nextNote, s = musicStep;
    const root = 50; // D minor
    const chordRoots = [0, 5, 3, 7]; // i - iv - III - v feel
    const cr = chordRoots[Math.floor(s / 16) % 4];
    if (s % 16 === 0) {
      const ch = [root + cr, root + cr + (MINOR.includes((cr + 3) % 12) ? 3 : 4), root + cr + 7].map(midi);
      strings(ch, t, beat * 16, calmBus, 0.012);
      strings(ch.map(f => f * 0.5), t, beat * 8, fightBus, 0.02);
      strings(ch.map(f => f * 0.5), t + beat * 8, beat * 8, fightBus, 0.02);
    }
    // calm: soft plucked harp line
    if (s % 2 === 0 && Math.random() < 0.55) {
      const n = root + 12 + cr + MINOR[Math.floor(Math.random() * 5)];
      tone('triangle', midi(n), 0, t, 0.005, 0.07, beat * 2.5, calmBus);
    }
    // fight: war drums and a driving low string ostinato
    if (s % 4 === 0) { tone('sine', 70, 38, t, 0.004, 0.9, 0.35, fightBus); noiseHit(t, 0.12, 'lowpass', 300, 1, 0.5, fightBus); }
    if (s % 8 === 6) tone('sine', 90, 50, t, 0.004, 0.6, 0.25, fightBus);
    if (s % 4 === 2) noiseHit(t, 0.08, 'bandpass', 1800, 2, 0.25, fightBus);
    if (s % 2 === 0) tone('sawtooth', midi(root - 12 + cr + (s % 4 === 0 ? 0 : 7)), 0, t, 0.01, 0.05, beat * 0.9, fightBus);
    musicStep++;
    nextNote += beat;
  }
}
