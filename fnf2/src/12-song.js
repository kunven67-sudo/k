// FNF 2 - songs: reads FNF's metadata + chart JSON (all variations: default, erect, pico)
// and builds everything PlayState needs.

// difficulty -> which song variation it lives in. ERECT/NIGHTMARE are the remix charts.
G.DIFF_INFO = {
  easy: { name: 'EASY', variation: 'default' }, normal: { name: 'NORMAL', variation: 'default' }, hard: { name: 'HARD', variation: 'default' },
  erect: { name: 'ERECT', variation: 'erect' }, nightmare: { name: 'NIGHTMARE', variation: 'erect' },
};
G.DIFF_ORDER = ['easy', 'normal', 'hard', 'erect', 'nightmare'];

G.Songs = {
  meta(id, variation) {
    const v = !variation || variation === 'default' ? '' : '-' + variation;
    return G.A.json('preload/data/songs/' + id + '/' + id + '-metadata' + v + '.json');
  },
  chart(id, variation) {
    const v = !variation || variation === 'default' ? '' : '-' + variation;
    return G.A.json('preload/data/songs/' + id + '/' + id + '-chart' + v + '.json');
  },
  // every playable (difficulty, variation) combo for a song + player character
  // player: 'bf' (default/erect variations) or 'pico' (pico variation)
  difficulties(id, player) {
    const out = [];
    const base = this.meta(id);
    if (!base) return out;
    const vars = ['default'].concat(base.playData.songVariations || []);
    for (const v of vars) {
      const m = v === 'default' ? base : this.meta(id, v);
      if (!m || !this.chart(id, v)) continue;
      const pl = m.playData.characters.player || 'bf';
      const isPico = pl.startsWith('pico');
      if ((player === 'pico') !== isPico) continue;
      for (const d of m.playData.difficulties || []) if (this.hasAudio(id, v, m)) out.push({ diff: d, variation: v });
    }
    out.sort((a, b) => G.DIFF_ORDER.indexOf(a.diff) - G.DIFF_ORDER.indexOf(b.diff));
    return out;
  },
  instPath(id, m, variation) {
    const ins = m.playData.characters.instrumental;
    const suf = ins ? '-' + ins : '';
    return 'songs/' + id + '/Inst' + suf + '.ogg';
  },
  voicePaths(id, m, variation) {
    const v = !variation || variation === 'default' ? '' : '-' + variation;
    const c = m.playData.characters;
    const out = [];
    const add = (list, who, fallback) => {
      for (const ch of (list && list.length ? list : [fallback])) {
        const p = 'songs/' + id + '/Voices-' + ch + v + '.ogg';
        if (G.A.has(p)) out.push({ path: p, who });
      }
    };
    add(c.playerVocals, 'p', c.player);
    add(c.opponentVocals, 'o', c.opponent);
    return out;
  },
  hasAudio(id, v, m) { return G.A.has(this.instPath(id, m, v)); },
  // full song description for PlayState
  build(id, diff, variation) {
    variation = variation || (G.DIFF_INFO[diff] || {}).variation || 'default';
    const m = this.meta(id, variation), c = this.chart(id, variation);
    if (!m || !c) return null;
    const notes = (c.notes[diff] || []).map(n => ({ t: n.t, d: n.d, l: n.l || 0, k: n.k || '' })).sort((a, b) => a.t - b.t);
    const speed = (c.scrollSpeed && (c.scrollSpeed[diff] != null ? c.scrollSpeed[diff] : c.scrollSpeed.default)) || 1;
    const tc = (m.timeChanges || [{ t: 0, bpm: 100 }]).map(x => ({ t: x.t, bpm: x.bpm, b: x.b || 0 }));
    const pd = m.playData;
    return {
      id, diff, variation, name: m.songName || id, artist: m.artist || '', charter: m.charter || '',
      timeChanges: tc, bpm: tc[0].bpm, speed,
      notes, events: (c.events || []).slice().sort((a, b) => a.t - b.t),
      chars: { player: pd.characters.player || 'bf', gf: pd.characters.girlfriend || 'gf', opponent: pd.characters.opponent || 'dad' },
      stage: pd.stage || 'mainStage', noteStyle: pd.noteStyle || 'funkin',
      inst: this.instPath(id, m, variation), voices: this.voicePaths(id, m, variation),
      offsets: m.offsets || {},
    };
  },
};

// Conductor with FNF time changes (bpm changes)
G.SongConductor = class {
  constructor(timeChanges) { this.tc = timeChanges && timeChanges.length ? timeChanges : [{ t: 0, bpm: 100, b: 0 }]; this.pos = 0; this.lastStep = -Infinity; this._fixBeats(); }
  _fixBeats() { // beat number at each change
    let beat = 0;
    for (let i = 0; i < this.tc.length; i++) {
      if (i > 0) { const p = this.tc[i - 1]; beat += (this.tc[i].t - p.t) / (60000 / p.bpm); }
      this.tc[i].beat = beat;
    }
  }
  change(ms) { let c = this.tc[0]; for (const x of this.tc) if (x.t <= ms) c = x; return c; }
  get bpm() { return this.change(this.pos).bpm; }
  get crochet() { return 60000 / this.bpm; }
  get stepCrochet() { return this.crochet / 4; }
  beatAt(ms) { const c = this.change(ms); return c.beat + (ms - c.t) / (60000 / c.bpm); }
  get beatF() { return this.beatAt(this.pos); }
  get stepF() { return this.beatF * 4; }
  msAtBeat(beat) { let c = this.tc[0]; for (const x of this.tc) if (x.beat <= beat) c = x; return c.t + (beat - c.beat) * 60000 / c.bpm; }
  reset(ms) { this.pos = ms; this.lastStep = Math.floor(this.stepF) - 1; }
  update(ms, onStep, onBeat) {
    this.pos = ms;
    const step = Math.floor(this.stepF);
    if (step < this.lastStep) this.lastStep = step - 1;
    if (step - this.lastStep > 64) this.lastStep = step - 1;
    while (this.lastStep < step) { this.lastStep++; if (onStep) onStep(this.lastStep); if (this.lastStep % 4 === 0 && onBeat) onBeat(this.lastStep / 4); }
  }
};
