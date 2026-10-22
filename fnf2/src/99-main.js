// FNF 2 - boot: wait for fonts + the decoded FNF assets, then open the first screen
Promise.all([G.fontsReady, G.assetsReady]).then(() => {
  // players that come in a mod pack that isn't there (or is switched off) aren't in character select
  for (const id in G.PLAYERS || {}) {
    const pk = G.PLAYERS[id].pack;
    if (pk && !G.Packs.has(pk)) {
      const fb = G.PLAYERS[id].fallback;
      if (G.PLAYER_IDS) G.PLAYER_IDS = G.PLAYER_IDS.filter(x => x !== id);
      if (fb) { G.PLAYERS[id] = fb; continue; }
      delete G.PLAYERS[id]; if (G.settings.player === id) G.settings.player = 'bf';
    }
  }
  const q = G.query;
  if (q.touch === '1') G.touchMode = true;      // (tests: as if the screen was touched)
  if (q.player) G.settings.player = q.player;
  if (q.dev === 'stage') return G.start('devStage', q);
  if (q.dev === 'char') return G.start('devChar', q);
  if (q.dev === 'atlas') return G.start('devAtlas', q);
  if (q.dev === 'screen' && G.screens[q.name]) return G.start(q.name, q);
  if (q.dev === 'results') {
    // fake stats for a rank: ?dev=results&rank=good|great|excellent|perfect|gold|loss&player=bf|pico
    const n = 200, mk = { gold: [200, 0, 0, 0, 0], perfect: [190, 10, 0, 0, 0], excellent: [170, 20, 5, 2, 3], great: [160, 20, 7, 3, 10], good: [130, 20, 20, 10, 20], loss: [60, 20, 30, 20, 70] }[q.rank || 'good'];
    return G.start('results', { mode: 'freeplay', diff: q.diff || 'hard', title: q.title || 'Bopeebo', player: q.player || 'bf', newBest: q.best === '1',
      stats: { score: +(q.score || 312840), maxCombo: mk[0] - 3, totalNotes: n, tally: { killer: 0, sick: mk[0], good: mk[1], bad: mk[2], shit: mk[3], miss: mk[4] } } });
  }
  if (q.bot) G.settings.botplay = q.bot === '1';
  if (q.down) G.settings.downscroll = q.down === '1';
  if (q.dev === 'song' && G.screens.play) return G.start('play', { mode: q.story === '1' ? 'story' : 'freeplay', songs: [q.id || 'tutorial'], diff: q.diff || 'normal', variation: q.variation || (G.DIFF_INFO[q.diff] || {}).variation || 'default', swap: q.swap === '1', week: null, noCutscene: q.cs === '0', pro: q.pro === '1' });
  if (!G.HAS_FNF || G.dataMissing) { G.start('noAssets', {}); return; }
  G.start(G.screens.title ? 'title' : 'devStage', {});
});
// no FNF data: either a code-only build, or the game file was opened without its fnf2-data folder (a phone that
// downloaded just the game file). Then the zip it came in is picked once: everything is read out of it and kept
// in the browser (G.Packs.save), and the game starts again.
G.screens.noAssets = {
  // the private zip on GitHub (you're logged in on your phone, so tapping this downloads it)
  ZIP: 'https://github.com/kunven67-sudo/fnf2-private/archive/refs/heads/main.zip',
  enter() {
    this.msg = null; this.busy = false;
    if (!G.dataMissing) return;
    // real page buttons (not drawn ones): a phone always lets a real link download and a real file box open
    const d = this.box = document.createElement('div');
    d.style.cssText = 'position:fixed;left:0;right:0;bottom:6%;display:flex;gap:4vw;justify-content:center;z-index:20;font:bold 5vmin monospace';
    const btn = (txt, bg) => { const e = document.createElement(bg ? 'a' : 'label'); e.textContent = txt;
      e.style.cssText = 'padding:3vmin 5vmin;border-radius:2vmin;color:#000;cursor:pointer;text-decoration:none;user-select:none;background:' + (bg || '#FFE45C'); return e; };
    const get = btn('1  GET THE ZIP', '#9CF'); get.href = this.ZIP; get.target = '_blank'; get.rel = 'noopener';
    get.onclick = () => { this.msg = 'Downloading... when it\'s done, come back here and tap PICK THE ZIP'; };
    const pick = btn('2  PICK THE ZIP');
    const inp = document.createElement('input'); inp.type = 'file'; inp.style.display = 'none';
    inp.onchange = () => this.got([...(inp.files || [])]);
    pick.appendChild(inp);
    d.append(get, pick); document.body.appendChild(d);
  },
  leave() { if (this.box) this.box.remove(); this.box = null; },
  async got(files) {
    if (!files.length || this.busy) return;
    this.busy = true; this.msg = 'Taking everything out of the zip... (a minute or two, keep this open)';
    const got = await G.Packs.save(files);
    this.busy = false;
    if (G.Packs.savedData >= (window.__FNF_DATA_N || 1)) { this.msg = 'Done! Starting the game... (' + got.length + ' mod files too)'; setTimeout(() => location.reload(), 800); }
    else this.msg = 'That\'s not the FNF 2 zip. Tap GET THE ZIP, let it download, then PICK THE ZIP.';
  },
  // (keyboard on PC: Enter opens the file box too)
  pick() { const inp = this.box && this.box.querySelector('input'); if (inp && !this.busy) inp.click(); },
  onAction(a, down) { if (down && a === 'accept') this.pick(); return true; },
  draw(ctx) {
    G.setScreenT(ctx); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H);
    if (!G.dataMissing) {
      G.vcr(ctx, 'This build has no FNF assets packed in.', G.W / 2, 320, { align: 'center', size: 30 });
      G.vcr(ctx, 'Run tools/pack_assets.py, then tools/build.js', G.W / 2, 370, { align: 'center', size: 24 });
      return;
    }
    // (big: on a phone this is the only thing to read)
    G.vcr(ctx, 'FNF 2 needs its files one time.', G.W / 2, 170, { align: 'center', size: 48 });
    G.vcr(ctx, '1. GET THE ZIP  (it downloads)', G.W / 2, 270, { align: 'center', size: 38, color: '#9CF' });
    G.vcr(ctx, '2. PICK THE ZIP  (from Downloads)', G.W / 2, 330, { align: 'center', size: 38, color: '#FFE45C' });
    G.vcr(ctx, 'don\'t unzip it, just pick it', G.W / 2, 385, { align: 'center', size: 28 });
    if (this.msg) G.vcr(ctx, this.msg, G.W / 2, 460, { align: 'center', size: 26, color: '#FFFFFF' });
  },
};
