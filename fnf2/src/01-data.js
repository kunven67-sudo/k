// FNF 2 - game data. The real weeks/songs come from FNF's own level files
// (preload/data/levels/*.json); this lists their order + our extras.
G.WEEK_ORDER = ['tutorial', 'week1', 'week2', 'week3', 'week4', 'week5', 'week6', 'week7', 'weekend1', 'wrath'];
G.availableWeeks = () => G.WEEK_ORDER.filter(id => { const L = G.A.json('preload/data/levels/' + id + '.json'); return L && L.songs.some(s => G.Songs.meta(s)); });
G.CREDITS = [
  { head: 'FNF 2 (private copy)' },
  { name: 'Idea + direction', role: 'ven / jason' },
  { name: 'Engine (browser port)', role: 'built with Claude Code' },
  { head: 'Sound effects (OpenGameArt)' },
  { name: 'spookymodem', role: 'Crunching Bones (CC-BY 3.0)' },
  { name: 'nerdzmasterz', role: 'A Lotta Bones Sound FX (CC-BY 3.0)' },
  { name: 'varkalandar', role: 'Cracking sounds (CC-BY 3.0)' },
  { head: "Friday Night Funkin'" },
  { name: 'ninjamuffin99', role: 'Programming' },
  { name: 'PhantomArcade3K', role: 'Art + Animation' },
  { name: 'evilsk8r', role: 'Art' },
  { name: 'Kawai Sprite', role: 'Music' },
  { name: 'The Funkin Crew', role: 'All FNF art, music + charts belong to them' },
];
