// FNF 2 - boot. Waits for the fonts, then opens the title screen
// (or a dev screen when the URL has ?dev=...).
G.fontsReady.then(() => {
  const q = G.query;
  if (q.dev === 'char') return G.start('devChar', q);
  if (q.dev === 'icons') return G.start('devIcons', q);
  if (q.dev === 'stage') return G.start('devStage', q);
  if (q.dev === 'screen' && G.screens[q.name]) return G.start(q.name, q);
  if (q.dev === 'song' && G.screens.play) {
    return G.start('play', { mode: 'freeplay', songs: [q.id || 'warm-up'], diff: q.diff || 'normal', player: q.player || G.settings.player, week: null });
  }
  if (q.dev) return G.start('devBlank', q);
  G.start(G.screens.title ? 'title' : 'devBlank', {});
});
