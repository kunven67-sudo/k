// FNF 2 - songs: reads FNF's metadata + chart JSON (all variations: default, erect, pico)
// and builds everything PlayState needs.

// difficulty -> which song variation it lives in. ERECT/NIGHTMARE are the remix charts.
G.DIFF_INFO = {
  easy: { name: 'EASY', variation: 'default' }, normal: { name: 'NORMAL', variation: 'default' }, hard: { name: 'HARD', variation: 'default' },
  erect: { name: 'ERECT', variation: 'erect' }, nightmare: { name: 'NIGHTMARE', variation: 'erect' },
  og: { name: 'OG', variation: 'og' },   // mods: the song as it was in the original mod (VS Garcello)
  // FNF 2's own, made from a song's own chart for every song (G.Songs.genNotes): BABY = easier than EASY,
  // INSANE + GOD = harder than HARD
  baby: { name: 'BABY', variation: 'default', gen: 'baby' }, insane: { name: 'INSANE', variation: 'default', gen: 'insane' },
  god: { name: 'GOD', variation: 'default', gen: 'god' },
};
G.DIFF_ORDER = ['baby', 'easy', 'normal', 'hard', 'insane', 'god', 'erect', 'nightmare', 'og'];
G.DIFF_COLOR = { baby: '#7FD8FF', insane: '#FF8A1F', god: '#FFD23A' };

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
  const cj = typeof c === 'string' ? G.A.json('preload/data/characters/' + id + '.json') : null;
  const nm = String((c.data && c.data.name) || c.name || (cj && cj.name) || id).replace(/\s*\(.*?\)\s*/g, ' ').trim();
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
  // + BABY / INSANE / GOD for every song that has EASY / NORMAL / HARD (each way it can be played: variation, swapped...)
  difficulties(id, player) {
    const out = this.baseDifficulties(id, player), add = [];
    const groups = {};
    for (const d of out) if (d.diff === 'easy' || d.diff === 'normal' || d.diff === 'hard') { const k = d.variation + '|' + !!d.swap + '|' + !!d.cover; (groups[k] = groups[k] || []).push(d); }
    for (const k in groups) {
      const g = groups[k][0];
      for (const nd of ['baby', 'insane', 'god']) add.push(Object.assign({}, g, { diff: nd }));
    }
    return out.concat(add).sort((a, b) => G.DIFF_ORDER.indexOf(a.diff) - G.DIFF_ORDER.indexOf(b.diff));
  },
  baseDifficulties(id, player) {
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
    // a player who can sing EVERY song (Tankman): a song with nothing of his own = BF's part, sung as himself
    const PE = G.PLAYERS && G.PLAYERS[player];
    if (!out.length && PE && PE.everySong && player !== 'bf') return this.baseDifficulties(id, 'bf').filter(d => !d.swap).map(d => Object.assign({}, d, { cover: true }));
    return out;
  },
  // BABY: at most one note a beat, no chords. INSANE: the gaps inside your singing get 8ths (and some 16ths) + chords
  // on the beat. GOD: 8ths everywhere you sing + lots of 16ths + more chords. Only your side changes; long rests (the
  // opponent's turn) stay empty; trick notes (fake, eye, talk...) stay as they are. Same song + mode = same chart.
  genNotes(src, gen, tc, swap, id) {
    const lo = swap ? 4 : 0, mine = n => n.d >= lo && n.d < lo + 4;
    const plain = n => !n.k || n.k === 'alt' || n.k === 'normal';
    let seed = 2166136261; for (const ch of id + gen) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
    const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const tcs = tc.slice().sort((a, b) => a.t - b.t);
    const at = t => { let x = tcs[0]; for (const y of tcs) if (y.t <= t) x = y; return x; };
    const step = t => 60000 / (at(t).bpm || 100) / 4;
    const onBeat = t => { const x = at(t), u = 60000 / (x.bpm || 100), f = ((t - x.t) / u) % 1; return f < 0.04 || f > 0.96; };
    const other = src.filter(n => !mine(n)).map(n => Object.assign({}, n));
    const me = src.filter(mine).map(n => Object.assign({}, n)).sort((a, b) => a.t - b.t);
    if (gen === 'baby') {
      const out = []; let last = -1e9;
      for (const n of me) {
        if (!plain(n)) { out.push(n); continue; }
        if (n.t - last < step(n.t) * 4 - 2) continue;
        out.push(n); last = n.t;
      }
      return other.concat(out);
    }
    const god = gen === 'god';
    const add = [];
    const busy = (lane, t, u) => me.concat(add).some(n => n.d === lane && (Math.abs(n.t - t) < u * 0.9 || (n.l > 0 && t > n.t - u * 0.5 && t < n.t + n.l + u * 0.5)));
    const pick = (t, u, avoid) => {
      const lanes = [0, 1, 2, 3].map(i => lo + i).filter(l => !busy(l, t, u));
      const best = lanes.filter(l => !avoid.includes(l));
      const L = best.length ? best : lanes;
      return L.length ? L[Math.floor(rnd() * L.length)] : -1;
    };
    // the times you sing at (one per chord)
    const times = []; for (const n of me) if (plain(n) && (!times.length || n.t - times[times.length - 1].t > 1)) times.push(n);
    for (let i = 0; i + 1 < times.length; i++) {
      const a = times[i], b = times[i + 1], u = step(a.t), gap = b.t - a.t;
      if (gap > u * 8 + 2) continue;                     // (a rest: not yours)
      let prev = a.d;
      for (let k = 1; a.t + k * u < b.t - u * 0.5; k++) {
        const eighth = k % 2 === 0, chance = eighth ? (god ? 1 : 0.85) : (god ? 0.55 : (gap <= u * 2 + 2 ? 0.3 : 0.12));
        if (rnd() >= chance) continue;
        const t = Math.round((a.t + k * u) * 100) / 100, l = pick(t, u, [prev, b.d]);
        if (l < 0) continue;
        add.push({ t, d: l, l: 0, k: '' }); prev = l;
      }
    }
    // chords on the beat
    for (const n of times) {
      const u = step(n.t);
      if (!onBeat(n.t) || rnd() >= (god ? 0.45 : 0.25)) continue;
      const l = pick(n.t, u, me.filter(x => Math.abs(x.t - n.t) < 2).map(x => x.d));
      if (l >= 0 && !me.some(x => x.d === l && Math.abs(x.t - n.t) < 2)) add.push({ t: n.t, d: l, l: 0, k: '' });
    }
    return other.concat(me, add);
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
    const tc = (m.timeChanges || [{ t: 0, bpm: 100 }]).map(x => ({ t: x.t, bpm: x.bpm, b: x.b || 0 }));
    // BABY / INSANE / GOD: made from the song's own easiest / hardest chart
    const gen = (G.DIFF_INFO[diff] || {}).gen, has = d => c.notes[d] && c.notes[d].length;
    const src = gen ? (gen === 'baby' ? ['easy', 'normal', 'hard'] : ['hard', 'normal', 'easy']).find(has) : diff;
    let raw = (src && c.notes[src]) || [];
    if (gen) raw = this.genNotes(raw, gen, tc, !!swap, id);
    const notes = raw.map(n => ({ t: n.t, d: swap ? (n.d + 4) % 8 : n.d, l: n.l || 0, k: n.k || '' })).sort((a, b) => a.t - b.t);
    const speed = ((c.scrollSpeed && (c.scrollSpeed[src] != null ? c.scrollSpeed[src] : c.scrollSpeed.default)) || 1) * (gen === 'baby' ? 0.85 : gen === 'insane' ? 1.12 : gen === 'god' ? 1.25 : 1);
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
