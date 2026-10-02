
// =====================================================================
// TIME & WEATHER — day and night, the blood moon every 7th night, and
// clear skies, clouds, rain, thunderstorms and fog.
// =====================================================================
const G = { on: false, save: null, area: 'outside', time: 0, dt: 0, p: null, mons: [], fx: [], projs: [], corpses: [], decals: [], picks: [], dead: false, shake: 0, hitstop: 0, slowmo: 1, cine: null };
const Clock = {
  rate: 1.5, // game minutes per real second (a day is 16 minutes)
  W() { return G.save ? G.save.world : this.menu || (this.menu = { min: 17.5 * 60, day: 1, night: 0 }); },
  minutes() { return this.W().min; },
  hour() { return this.W().min / 60; },
  isNight() { const h = this.hour(); return h >= 20 || h < 5; },
  dark() { const s = Sky.sunDir.y; return 1 - smoothstep(-0.1, 0.15, s); },
  // which night it is: night N runs from 20:00 on day N to 05:00 on day N+1
  nightNum() { const W = this.W(); return this.hour() < 5 ? W.day - 1 : W.day; },
  bloodMoon() { const n = this.nightNum(); return this.isNight() && n > 0 && n % 7 === 0; },
  nextBloodIn() { const n = this.nightNum() + (this.isNight() ? 1 : this.hour() >= 20 ? 1 : 0); return (7 - (n % 7)) % 7; },
  label() { const m = Math.floor(this.W().min), h = Math.floor(m / 60), mm = m % 60; return `Day ${this.W().day} · ${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; },
  advance(mins) {
    const W = this.W(); let left = mins;
    while (left > 0) {
      const step = Math.min(left, 5), before = W.min; W.min += step; left -= step;
      if (W.min >= 1440) { W.min -= 1440; W.day++; }
      if (before < 1200 && W.min >= 1200) this.nightFalls();
      if (before < 300 && W.min >= 300) this.dawn();
    }
  },
  tick(dt) { this.advance(dt * this.rate); },
  nightFalls() {
    if (!G.save) return; const n = this.nightNum();
    if (n % 7 === 0) { UI.toast('THE BLOOD MOON RISES', 'blood big'); Sfx.play('bloodmoon'); Music.sting('blood'); }
    else { const left = 7 - (n % 7); UI.toast(left === 1 ? 'Night falls. The blood moon rises tomorrow night.' : 'Night falls.', left === 1 ? 'bad' : ''); }
    Monsters.nightChange();
  },
  dawn() { if (!G.save) return; Sfx.play('rooster'); Monsters.nightChange(); if (this.W().day % 7 === 1 && this.W().day > 1) UI.toast('The blood moon sets. The valley breathes again.', 'good'); },
};
const WEATHER_T = { clear: [0.15, 0, 0, 0.25], cloudy: [0.6, 0, 0, 0.4], rain: [0.85, 0.7, 0, 0.55], storm: [1, 1, 1, 0.9], fog: [0.5, 0, 0, 0.1] };
const Weather = {
  kind: 'clear', next: 120, amt: 0, flash: 0, wind: 0.3, thunderT: 8, fogAmt: 0,
  cloud() { return lerp(WEATHER_T.clear[0], WEATHER_T[this.kind][0], this.amt); },
  rainK() { return WEATHER_T[this.kind][1] * this.amt; },
  stormK() { return WEATHER_T[this.kind][2] * this.amt; },
  fogK() { return (this.kind === 'fog' ? 1 : this.kind === 'rain' ? 0.25 : 0) * this.amt + (Clock.bloodMoon() ? 0.2 : 0); },
  set(k, instant) { this.kind = k; if (instant) this.amt = 1; },
  snowHere() { return G.p && G.p.y > 115; },
  tick(dt) {
    this.next -= dt;
    if (this.next <= 0) { this.next = rand(150, 360); const k = weighted([['clear', 4], ['cloudy', 3], ['rain', 2], ['storm', 1], ['fog', 1.2]]); if (k !== this.kind) { this.amt = 0; this.kind = k; if (G.on && G.area === 'outside') UI.toast({ rain: 'It starts to rain.', storm: 'Thunder rolls over the valley.', fog: 'A thick fog creeps in.' }[k] || ''); } }
    this.amt = Math.min(1, this.amt + dt * 0.04);
    const target = (WEATHER_T[this.kind][3] + Math.sin(G.time * 0.05) * 0.1) * (1 + (G.p && G.p.y > 90 ? 0.6 : 0));
    this.wind = damp(this.wind, target, 0.3, dt); WIND.uWind.value = this.wind; WIND.uTime.value += dt;
    this.flash = Math.max(0, this.flash - dt * 3);
    if (this.stormK() > 0.4 && G.area === 'outside') { this.thunderT -= dt; if (this.thunderT <= 0) { this.thunderT = rand(6, 18); this.flash = 1; const far = rand(0.3, 1); later(far * 2.2, () => Sfx.play('thunder', { vol: 1.2 - far * 0.6 })); } }
  },
};
// timers that run on game time (pause with the game)
const LATER = [];
function later(sec, fn) { LATER.push({ t: G.time + sec, fn }); }
function runLater() { for (let i = LATER.length - 1; i >= 0; i--) if (G.time >= LATER[i].t) { const f = LATER[i].fn; LATER.splice(i, 1); f(); } }
