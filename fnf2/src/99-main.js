// FNF 2 - boot: wait for fonts + the decoded FNF assets, then open the first screen
Promise.all([G.fontsReady, G.assetsReady]).then(() => {
  const q = G.query;
  if (q.dev === 'stage') return G.start('devStage', q);
  if (q.dev === 'char') return G.start('devChar', q);
  if (q.dev === 'screen' && G.screens[q.name]) return G.start(q.name, q);
  if (q.bot) G.settings.botplay = q.bot === '1';
  if (q.down) G.settings.downscroll = q.down === '1';
  if (q.dev === 'song' && G.screens.play) return G.start('play', { mode: 'freeplay', songs: [q.id || 'tutorial'], diff: q.diff || 'normal', variation: q.variation || 'default', week: null });
  if (!G.HAS_FNF) { G.start('noAssets', {}); return; }
  G.start(G.screens.title ? 'title' : 'devStage', {});
});
G.screens.noAssets = {
  draw(ctx) {
    G.setScreenT(ctx); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H);
    G.vcr(ctx, 'This build has no FNF assets packed in.', G.W / 2, 320, { align: 'center', size: 30 });
    G.vcr(ctx, 'Run tools/pack_assets.py, then tools/build.js', G.W / 2, 370, { align: 'center', size: 24 });
  },
};
