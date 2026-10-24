// FNF 2 - songs: reads FNF's metadata + chart JSON (all variations: default, erect, pico)
// and builds everything PlayState needs.

// difficulty -> which song variation it lives in. ERECT/NIGHTMARE are the remix charts.
G.DIFF_INFO = {
  easy: { name: 'EASY', variation: 'default' }, normal: { name: 'NORMAL', variation: 'default' }, hard: { name: 'HARD', variation: 'default' },
  erect: { name: 'ERECT', variation: 'erect' }, nightmare: { name: 'NIGHTMARE', variation: 'erect' },
  og: { name: 'OG', variation: 'og' },   // mods: the song as it was in the original mod (VS Garcello)
};
G.DIFF_ORDER = ['easy', 'normal', 'hard', 'erect', 'nightmare', 'og'];

// which playable character a song variation belongs to: the player whose ownedChars has its player character
// (preload/data/players/*.json: 'pico-playable' -> pico, 'darnell-player' -> darnell), anything else -> bf
G.PLAYER_IDS = ['bf', 'pico', 'darnell', 'tankman', 'nene'];
G.playerOf = function (charId) {
  if (!charId) return 'bf';
  if (G.PLAYER_IDS.includes(charId) || (G.PLAYERS && G.PLAYERS[charId])) return charId;
  for (const id of G.PLAYER_IDS) { const d = G.A.json('preload/data/players/' + id + '.json'); if (d && (d.ownedChars || []).includes(charId)) return id; }
  // (new players made from a gameplay character: the Jordus girl is 'nightly' when nightly-player sings)
  for (const id in G.PLAYERS || {}) { const R = G.PLAYERS[id].real; if (R && (R.char === charId || R.songChar === charId)) return id; }
  return String(charId).startsWith('pico') ? 'pico' : 'bf';
};

// who you are rapping against, for the death counter ("DEATHS vs WHITTY: 12"): every form of one character
// (Whitty, Whitty Crazy, Whitty HQ...) adds up under one name
G.deathWho = function (c) {
  if (!c) return '???';
  const id = String(c.id || c);
  const R = [
    [/^imp-red/, 'RED'], [/^imp-green/, 'GREEN'], [/^imp-yellow/, 'YELLOW'], [/^imp-white/, 'WHITE'], [/^imp-(danger|black)/, 'BLACK'],
    [/^whit(t|$|-|bonkers)/i, 'WHITTY'], [/^4_fuck$/, 'NITTY GRITTY'], [/^(testis|hunger)$/, 'JULIAN'],
    [/^garcello/, 'GARCELLO'], [/^tabi/, 'TABI'], [/tricky/i, 'TRICKY'], [/^sky/, 'SKY'], [/^wrath/, 'WRATH'],
    [/^nightly-opp/, 'THE CAP GIRL'], [/^nightly/, 'JORDUS'], [/^kip/, 'ZOMBIE + ROBOT'],
    [/^dad$/, 'DADDY DEAREST'], [/^(gf|geef)/, 'GIRLFRIEND'], [/^darnell/, 'DARNELL'], [/^tankman/, 'TANKMAN'],
    [/^nene/, 'NENE'], [/^pico/, 'PICO'], [/^bf/, 'BOYFRIEND'],
  ];
  for (const [re, name] of R) if (re.test(id)) return name;
  const nm = String((c.data && c.data.name) || c.name || id).replace(/\s*\(.*?\)\s*/g, ' ').trim();
  return (nm || id).toUpperCase();
};
// deaths against one character, kept forever in the save
G.deathsVs = function (who) { const d = G.save.deathsVs || {}; return d[who] || 0; };

G.Songs = {
  meta(id, variation) {
    const v = !variation || variation === 'default' ? '' : '-' + variation;
    return G.A.json('preload/data/songs/' + id + '/' + id + '-metadata' + v + '.json');
  },
  chart(id, variation) {
    const v = !variation || variation === 'default' ? '' : '-' + variation;
    return G.A.json('preload/data/songs/' + id + '/' + id + '-chart' + v + '.json');
  },
  // the songs a new player (Darnell, Tankman, Nene: 59-charselect.js) really sang in: the ones where they're the
  // opponent. Played SWAPPED: their part becomes yours, sung with their real recorded voice.
  ownSong(id, player) {
    const P = G.PLAYERS && G.PLAYERS[player], ch = P && (P.real ? P.real.char : P.ownChar), m = ch && this.meta(id);
    const opp = m && (m.playData.characters || {}).opponent, sc = P && (P.real ? P.real.songChar : P.songChar);
    // (a player can have a song version of themselves: Nene's own songs are sung by nene-playable)
    return !!(m && (opp === ch || (sc && opp === sc)));
  },
  // every playable (difficulty, variation) combo for a song + player character
  // player: 'bf' (default/erect variations), 'pico' (pico variation), 'darnell' (his mixes), plus the songs a
  // new player really sang in (played swapped)
  difficulties(id, player) {
    const out = [];
    const base = this.meta(id);
    if (!base) return out;
    // a song made for anybody (video songs): every player sings it as themselves
    if (base.playData.anyPlayer) {
      if (!this.chart(id) || !this.hasAudio(id, 'default', base)) return out;
      for (const d of base.playData.difficulties || []) out.push({ diff: d, variation: 'default' });
      out.sort((a, b) => G.DIFF_ORDER.indexOf(a.diff) - G.DIFF_ORDER.indexOf(b.diff));
      return out;
    }
    // a song this player really sang in as the opponent: played swapped (stand-in players only get these)
    if (this.ownSong(id, player)) {
      if (!this.chart(id) || !this.hasAudio(id, 'default', base)) return out;
      for (const d of base.playData.difficulties || []) out.push({ diff: d, variation: 'default', swap: true });
      out.sort((a, b) => G.DIFF_ORDER.indexOf(a.diff) - G.DIFF_ORDER.indexOf(b.diff));
      return out;
    }
    // a song made for a new player (she's the song's own player: the Jordus girl in Jordus): played as it is
    const RP = G.realPlayer && G.realPlayer(player);
    if (RP) {
      const pc = (base.playData.characters || {}).player;
      if (pc && (pc === RP.real.char || pc === RP.real.songChar) && this.chart(id) && this.hasAudio(id, 'default', base)) {
        for (const d of base.playData.difficulties || []) out.push({ diff: d, variation: 'default' });
        out.sort((a, b) => G.DIFF_ORDER.indexOf(a.diff) - G.DIFF_ORDER.indexOf(b.diff));
      }
      return out;
    }
    const vars = ['default'].concat(base.playData.songVariations || []);
    // (a player's mod pack brings its own variation of a song without patching the song's metadata: two packs
    // patching the same file would hide each other's)
    for (const pid of G.PLAYER_IDS) if (!vars.includes(pid) && this.meta(id, pid)) vars.push(pid);
    for (const v of vars) {
      const m = v === 'default' ? base : this.meta(id, v);
      if (!m || !this.chart(id, v)) continue;
      const pl = m.playData.characters.player || 'bf';
      if (G.playerOf(pl) !== (player || 'bf')) continue;
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
    // (vocalsVariation: a variation sung over the base vocal tracks, e.g. a mod's OG chart of the same recording)
    const vv = m.playData.vocalsVariation != null ? m.playData.vocalsVariation : variation;
    const v = !vv || vv === 'default' ? '' : '-' + vv;
    const c = m.playData.characters;
    const out = [];
    // a character's own track, else the base character's (bf-holding-gf -> bf, pico-playable -> pico)
    const add = (list, who, fallback) => {
      for (const ch of (list && list.length ? list : [fallback])) {
        const names = [ch]; for (let n = ch; n.includes('-');) names.push(n = n.slice(0, n.lastIndexOf('-')));
        const p = names.map(n => 'songs/' + id + '/Voices-' + n + v + '.ogg').find(q => G.A.has(q));
        if (p) out.push({ path: p, who });
      }
    };
    add(c.playerVocals, 'p', c.player);
    add(c.opponentVocals, 'o', c.opponent);
    return out;
  },
  hasAudio(id, v, m) { return G.A.has(this.instPath(id, m, v)); },
  // full song description for PlayState. swap = you sing the opponent's part (their notes, their real voice,
  // standing on the player's side); everything that points at "player" / "opponent" swaps with it
  build(id, diff, variation, swap) {
    variation = variation || (G.DIFF_INFO[diff] || {}).variation || 'default';
    const m = this.meta(id, variation), c = this.chart(id, variation);
    if (!m || !c) return null;
    const notes = (c.notes[diff] || []).map(n => ({ t: n.t, d: swap ? (n.d + 4) % 8 : n.d, l: n.l || 0, k: n.k || '' })).sort((a, b) => a.t - b.t);
    const speed = (c.scrollSpeed && (c.scrollSpeed[diff] != null ? c.scrollSpeed[diff] : c.scrollSpeed.default)) || 1;
    const tc = (m.timeChanges || [{ t: 0, bpm: 100 }]).map(x => ({ t: x.t, bpm: x.bpm, b: x.b || 0 }));
    const pd = m.playData;
    let events = (c.events || []).slice().sort((a, b) => a.t - b.t);
    let chars = { player: pd.characters.player || 'bf', gf: pd.characters.girlfriend != null ? pd.characters.girlfriend : 'gf', opponent: pd.characters.opponent || 'dad' };   // ('' = no GF)
    let voices = this.voicePaths(id, m, variation);
    if (swap) {
      const flipChar = v => (v === 0 ? 1 : v === 1 ? 0 : v);
      const flipTarget = { bf: 'dad', boyfriend: 'dad', player: 'opponent', dad: 'bf', opponent: 'player' };
      events = events.map(e => {
        const v = e.v;
        if (e.e === 'FocusCamera') return Object.assign({}, e, { v: v != null && typeof v === 'object' ? Object.assign({}, v, { char: flipChar(v.char == null ? 0 : v.char) }) : flipChar(v == null ? 0 : v) });
        if (e.e === 'PlayAnimation' && v && flipTarget[v.target]) return Object.assign({}, e, { v: Object.assign({}, v, { target: flipTarget[v.target] }) });
        return e;
      });
      chars = { player: chars.opponent, gf: chars.gf, opponent: chars.player };
      voices = voices.map(x => ({ path: x.path, who: x.who === 'p' ? 'o' : 'p' }));
    }
    return {
      id, diff, variation, swap: !!swap, name: m.songName || id, artist: m.artist || '', charter: m.charter || '',
      timeChanges: tc, bpm: tc[0].bpm, speed,
      notes, events, chars,
      stage: pd.stage || 'mainStage', noteStyle: pd.noteStyle || 'funkin',
      inst: this.instPath(id, m, variation), voices,
      offsets: m.offsets || {},
      video: pd.video || null, anyPlayer: !!pd.anyPlayer,
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
