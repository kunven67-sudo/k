/* AI Play - the SQUAD (all your AIs), the LEADERBOARD, and each AI's DIARY. */
'use strict';

AIP.squad = (function () {
  const U = AIP.util;
  const A = ['Zap', 'Byte', 'Pix', 'Glitch', 'Nova', 'Bolt', 'Echo', 'Chip', 'Zig', 'Kilo', 'Mochi', 'Turbo', 'Blip', 'Rex', 'Vex', 'Nyx', 'Juno', 'Taco', 'Bean', 'Pogo',
    'Fizz', 'Dash', 'Lumo', 'Ozz', 'Waffle', 'Sprock', 'Noodle', 'Kern', 'Widge', 'Bit', 'Volt', 'Pip', 'Rusty', 'Neon', 'Sparky', 'Gizmo', 'Tofu', 'Blitz', 'Comet', 'Pebble', 'Dot', 'Fuzz', 'Grit', 'Mango'];
  const B = ['', '', '', 'o', 'y', 'tron', 'bot', '-9', ' 3000', 'ster', 'ix', ' Jr.', 'zilla', 'X', '-42', 'ie'];

  function suggestName(taken) {
    for (let i = 0; i < 30; i++) {
      let n = U.pick(A) + U.pick(B);
      n = n.replace(/yy$/, 'y').replace(/oo$/, 'o');
      if (!taken || taken.indexOf(n) < 0) return n;
    }
    return U.pick(A) + U.randi(10, 99);
  }

  // A brand new AI: it designs its own face, voice, personality and name.
  function birth(taken) {
    const traits = AIP.Heart.newTraits();
    return {
      id: 'ai_' + U.uid(),
      name: suggestName(taken),
      born: Date.now(),
      look: AIP.avatar.design(),
      traits,
      bornTraits: Object.assign({}, traits),
      voice: { pitch: U.rand(0.7, 1.5), rate: U.rand(0.92, 1.2), pick: Math.random() },
      catchphrase: U.pick(AIP.Voice.CATCH),
      stats: { games: {} },
    };
  }

  const all = () => AIP.db.all('ais').then((l) => (l || []).sort((a, b) => a.born - b.born));
  const save = (ai) => AIP.db.put('ais', ai);
  async function remove(ai) {
    await AIP.db.del('ais', ai.id);
    await AIP.db.delPrefix('brains', ai.id + '|');
    await AIP.db.delPrefix('replays', ai.id + '|');
    const d = await AIP.db.byIndex('diary', 'aiId', ai.id);
    for (const e of d || []) await AIP.db.del('diary', e.id);
  }
  function gameStats(ai, gameId) {
    ai.stats = ai.stats || { games: {} };
    if (!ai.stats.games[gameId]) ai.stats.games[gameId] = { best: null, tries: 0, timeMs: 0, wins: 0, scoreKind: 'score' };
    return ai.stats.games[gameId];
  }
  // Leaderboard for one game: everyone who played it, best score first.
  function leaderboard(ais, gameId) {
    return ais.map((ai) => ({ ai, s: ai.stats && ai.stats.games && ai.stats.games[gameId] }))
      .filter((r) => r.s && r.s.tries > 0)
      .sort((a, b) => (b.s.best == null ? -Infinity : b.s.best) - (a.s.best == null ? -Infinity : a.s.best));
  }

  /* ---------- diary ---------- */
  async function write(ai, game, kind, text, mood) {
    const e = { id: 'd_' + U.uid(), aiId: ai.id, gameId: game ? game.id : null, gameName: game ? game.name : '', t: Date.now(), kind, text, mood: mood || 'calm' };
    try { await AIP.db.put('diary', e); } catch (err) { /* ignore */ }
    return e;
  }
  const diary = (aiId) => AIP.db.byIndex('diary', 'aiId', aiId).then((l) => (l || []).sort((a, b) => b.t - a.t));

  return { birth, suggestName, all, save, remove, gameStats, leaderboard, write, diary };
})();
