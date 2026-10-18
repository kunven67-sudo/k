// FNF 2 - game data. The real weeks/songs come from FNF's own level files
// (preload/data/levels/*.json); this lists their order + our extras.
G.WEEK_ORDER = ['tutorial', 'week1', 'week2', 'week3', 'week4', 'week5', 'week6', 'week7', 'weekend1', 'wrath', 'sky', 'nenesongs'];
// weeks packed only for the new players' own songs (Tankman: Week 7, Darnell: Weekend 1) until those weeks are
// built properly for BF / Pico (their stage scripts + cutscenes): hidden from Story Mode and BF/Pico's freeplay.
// nenesongs = Nene's own songs from mods (tools/own/nene.py), only ever played as Nene
G.OWN_SONG_WEEKS = new Set(['week7', 'weekend1', 'nenesongs']);
G.availableWeeks = () => G.WEEK_ORDER.filter(id => { const L = G.A.json('preload/data/levels/' + id + '.json'); return L && L.songs.some(s => G.Songs.meta(s)); });
G.CREDITS = [
  // the big menu letters have no bold punctuation, so names stay plain (details go in the footer)
  { head: 'FNF 2' },
  { name: 'ven / jason', role: 'Idea + direction' },
  { name: 'Claude Code', role: 'Built the engine (browser port)' },
  { head: 'Friday Night Funkin' },
  { name: 'ninjamuffin99', role: 'Programming' },
  { name: 'PhantomArcade', role: 'Art + Animation' },
  { name: 'evilsk8r', role: 'Art' },
  { name: 'Kawai Sprite', role: 'Music' },
  { name: 'The Funkin Crew', role: 'All FNF art, music + charts belong to them. Private copy.' },
  { head: 'VS Sky' },
  { name: 'bbpanzu', role: 'VS Sky: code, music, art + animation' },
  { name: 'Alexander0110', role: 'Owner of Sky' },
  { name: 'Dra9onSlayer5', role: 'Owner of Sky' },
  { name: 'Rermega', role: 'V-Slice port of VS Sky (stage + layout numbers)' },
  { head: 'Nene' },
  { name: 'ZenUnique', role: 'Playable Nene: her singing sprites' },
  { name: 'Fletch Legacy', role: 'Girls Night: After Hours (music)' },
  { name: 'AstralZ', role: 'Girls Night: charts + rooftop art' },
  { name: 'chibisprinklez', role: 'Girls Night: sprites' },
  { name: 'ItoSaihara', role: "Girls' Night Out: director, alley art, Nene's voice" },
  { name: 'Clover', role: "Girls' Night Out: Sharp + charts" },
  { name: 'KaiTheGuy', role: "Girls' Night Out: Sharp" },
  { name: 'bbpanzu', role: "Girls' Night Out: Nene (music)" },
  { name: 'Nasa', role: "Girls' Night Out: Bubbles" },
  { name: 'Flyplague', role: "Girls' Night Out: GF sprites + voice" },
  { name: 'Starzilla10', role: "Girls' Night Out: Nene sprites" },
  { name: 'WedgeCuts', role: "Girls' Night Out: programming" },
];
