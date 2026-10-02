
// =====================================================================
// TIME & WEATHER — 24 game hours = 8 real minutes. Night runs 20:00-05:00.
// The night counter drives the Eternal Night ending.
// =====================================================================
const Clock = {
  rate: 3, // game minutes per real second
  W: () => G.save.world,
  hour() { return this.W().time / 60; },
  isNight() { const h = this.hour(); return h >= 20 || h < 5; },
  // 0 in full day, 1 in deep night, with dusk and dawn in between
  dark() { const h = this.hour(); if (h >= 21 || h < 4) return 1; if (h >= 18.5) return smooth((h - 18.5) / 2.5); if (h < 6.5) return 1 - smooth((h - 4) / 2.5); return 0; },
  // colour cast for dusk (orange) and dawn (pink)
  cast() { const h = this.hour(); if (h >= 17.5 && h < 20.5) return ['255,140,60', Math.sin(((h - 17.5) / 3) * Math.PI) * 0.18]; if (h >= 4.5 && h < 7) return ['255,170,190', Math.sin(((h - 4.5) / 2.5) * Math.PI) * 0.14]; return null; },
  label() { const t = this.W().time, h = Math.floor(t / 60), mm = Math.floor(t % 60); return `Day ${this.W().day} · ${String(h).padStart(2, '0')}:${String(mm - (mm % 10)).padStart(2, '0')}`; },
  advance(mins) { // used by the clock and by sleeping
    const W = this.W(); let left = mins;
    while (left > 0) {
      const step = Math.min(left, 10), before = W.time; W.time += step; left -= step;
      if (W.time >= 1440) { W.time -= 1440; W.day++; }
      if (before < 1200 && W.time >= 1200) this.nightStarts();
    }
  },
  tick(dt) { this.advance(dt * this.rate); },
  nightStarts() {
    const W = this.W(); W.nights++;
    if (ST().ending) return;
    const limit = DF().nights, left = limit - W.nights;
    if (left < 0) { Story.queue('end_night'); return; }
    if (G.area && G.area.kind !== 'dungeon') UI.toast(left <= 5 ? `Night ${W.nights} of ${limit}. Only ${left} nights left to save Finn!` : `Night falls. Night ${W.nights} of ${limit}.`, left <= 5 ? 'bad' : '');
    if (left === 10 || left === 5 || left === 1) Sfx.play('bell');
  },
};
const Weather = {
  kind: 'clear', next: 40, amt: 0, flash: 0, region: null, drops: [], wind: 0.25,
  enter(regionId) {
    if (this.region === regionId) return; this.region = regionId; this.drops.length = 0;
    const R = REGIONS[regionId]; this.kind = R && R.weather ? weighted(R.weather) : 'clear'; this.next = rand(50, 120); this.amt = this.kind === 'clear' ? 0 : 0.6;
  },
  tick(dt) {
    const R = REGIONS[this.region];
    if (R && R.weather) { this.next -= dt; if (this.next <= 0) { this.next = rand(60, 160); const k = weighted(R.weather); if (k !== this.kind) { this.kind = k; if (k !== 'clear') UI.toast({ rain: 'It starts to rain.', storm: 'A storm rolls in.', fog: 'Fog creeps over the ground.', snow: 'Snow begins to fall.', blizzard: 'A blizzard howls in!', sandstorm: 'A sandstorm is coming!' }[k] || ''); } } }
    const target = this.kind === 'clear' ? 0 : 1; this.amt += clamp(target - this.amt, -dt * 0.2, dt * 0.2);
    this.wind = { storm: 0.9, blizzard: 1, sandstorm: 1, rain: 0.45, snow: 0.35, fog: 0.15 }[this.kind] || 0.25;
    this.flash = Math.max(0, this.flash - dt * 2.5);
    if (!SET.weather) { this.drops.length = 0; return; }
    // particles live in screen space
    const want = Math.floor(this.amt * ({ rain: 140, storm: 220, snow: 110, blizzard: 260, sandstorm: 240, fog: 0, clear: 0 }[this.kind] || 0));
    while (this.drops.length < want) this.drops.push({ x: rand(0, VIEW.w), y: rand(-VIEW.h, VIEW.h), s: rand(0.6, 1.4), ph: rand(0, TAU) });
    if (this.drops.length > want) this.drops.length = want;
    const k = this.kind;
    for (const d of this.drops) {
      if (k === 'rain' || k === 'storm') { d.y += 340 * d.s * dt; d.x -= 70 * this.wind * dt; }
      else if (k === 'snow') { d.y += 30 * d.s * dt; d.x += Math.sin(G.time * 1.3 + d.ph) * 14 * dt - 10 * dt; }
      else if (k === 'blizzard') { d.y += 70 * d.s * dt; d.x -= 170 * d.s * dt; }
      else if (k === 'sandstorm') { d.y += Math.sin(G.time * 2 + d.ph) * 20 * dt; d.x -= 260 * d.s * dt; }
      if (d.y > VIEW.h + 4) { d.y = rand(-20, -2); d.x = rand(0, VIEW.w + 60); }
      if (d.x < -10) { d.x = VIEW.w + rand(0, 20); d.y = rand(0, VIEW.h); } else if (d.x > VIEW.w + 70) d.x = rand(-5, VIEW.w);
    }
  },
  // movement slow from heavy weather
  slow() { return this.region && (this.kind === 'blizzard' || this.kind === 'sandstorm') ? 0.85 : 1; },
};
// pick the music for where you are, and feed the ambience loops
function envTick(dt) {
  const A = G.area, p = G.p; if (!A) return;
  const night = Clock.isNight(), dungeon = A.kind === 'dungeon', interior = A.kind === 'interior';
  let mood;
  if (Story.mood) mood = Story.mood;
  else if (G.dead) mood = 'sad';
  else if (dungeon) mood = G.bossMon && !G.bossMon.dead ? (A.def.final || A.def.secret ? 'final' : 'boss') : 'dungeon';
  else if (interior) mood = night ? 'night' : 'town';
  else if (A.id === 'vale') mood = inTownPx(p.x, p.y) ? (night ? 'night' : 'town') : night ? 'night' : 'wild';
  else mood = night && A.biome === 'coast' ? 'night' : REGIONS[A.id].music;
  Music.set(mood);
  const outdoors = A.kind === 'overworld';
  const wk = outdoors ? Weather.kind : 'clear', wa = outdoors ? Weather.amt : 0;
  let water = 0, sea = 0, fire = 0;
  if (outdoors) {
    if (A.fountain) water = clamp(1 - dist(p.x, p.y, A.fountain.x, A.fountain.y) / 140, 0, 1) * 0.6;
    if (A.coast) { const c = A.coast[clamp(Math.floor(p.y / 16), 0, A.coast.length - 1)] * 16; sea = clamp(1 - Math.abs(p.x - c) / 260, 0.1, 1); }
    if (A.campfire) fire = clamp(1 - dist(p.x, p.y, A.campfire.x, A.campfire.y) / 120, 0, 1) * 0.8;
  } else if (interior && A.campfire) fire = clamp(1 - dist(p.x, p.y, A.campfire.x, A.campfire.y) / 160, 0, 1) * 0.6;
  let lava = 0; if (dungeon && A.def.theme.hazard === 'lava') lava = 0.4;
  Amb.set({
    wind: outdoors ? 0.15 + Weather.wind * 0.5 + (A.biome === 'frost' ? 0.25 : 0) : dungeon ? 0.05 : 0,
    rain: (wk === 'rain' || wk === 'storm') ? wa * (wk === 'storm' ? 0.9 : 0.6) : 0,
    sea, water, cave: dungeon ? 0.6 : 0, sand: wk === 'sandstorm' ? wa * 0.8 : 0, fire: fire + lava,
  });
  Amb.tick(dt, { dungeon, outdoors, night, biome: A.biome, rain: wk === 'rain' || wk === 'storm', storm: wk === 'storm' && wa > 0.5 });
}
