// FNF 2 - game data: weeks, songs, characters, stages, special-note mechanics.
// This is the single source of truth every module reads from.

// ---------------------------------------------------------------- characters
// role: 'player' (playable), 'gf' (speaker girl), 'opp' (opponent)
// look: the art brief the character module follows. All art is original.
G.CHAR_INFO = {
  ace: { name: 'ACE', role: 'player', color: '#31b0d1',
    look: 'Short teen rapper, big cartoon head, spiky jet-black hair with one cyan streak, cyan hoodie with the hood down and white drawstrings, dark-blue jeans rolled at the ankle, chunky red-and-white sneakers, holds a silver mic. Cocky grin, big eyes with small pupils. Faces LEFT (toward the opponent).',
    personality: 'Cocky, chill, barely talks, answers with "beep" and "bop" noises.' },
  nitro: { name: 'NITRO', role: 'player', color: '#ffb31a',
    look: 'Lean punk teen (our own "Pico"): backwards black cap, bleached-white messy hair poking out, yellow bomber jacket over a black tee, cargo shorts, black boots, a chunky neon paint-blaster pistol in his right hand and a mic in his left. Sharp eyebrows, smirk. Faces LEFT.',
    personality: 'Hot-headed, protective of Mel, shoots paint when hyped.' },
  mel: { name: 'MEL', role: 'gf', color: '#ff4fa3',
    look: 'Girl sitting on top of a big stereo speaker stack (two woofers, bass bumps on beat): long chestnut hair with a hot-pink streak, pink crop jacket over a white tee, black skirt, striped stockings, pink sneakers dangling. Bops her head left/right. Faces FRONT.',
    personality: 'Hype, sweet, supportive; the "girlfriend" role. Teaches the tutorial.' },
  echo: { name: 'ECHO', role: 'opp', color: '#3fd4ff',
    look: 'Phantom club DJ: a tall translucent cyan ghost with a wispy tail instead of legs, big DJ headphones, a backwards snapback, glowing white eyes, floats behind a small DJ deck. Sings by holding one headphone and pointing.',
    personality: 'Smooth, laid-back, says "yo" a lot, the first friendly rival.' },
  ash: { name: 'ASH', role: 'opp', color: '#c9a7ff',
    look: 'Lo-fi skater girl: oversized lavender hoodie, grey beanie, messy ash-blonde bob, ripped black jeans, high-top skate shoes, skateboard under one foot or arm, sleepy half-lidded eyes, headphones around neck.',
    personality: 'Sleepy, chill, sarcastic, but secretly competitive.' },
  glitch: { name: 'GLITCH', role: 'opp', color: '#ff2a6d',
    look: 'Corrupted rhythm robot: lanky metal body, a chunky old CRT monitor for a head that shows a pixel face, one antenna, cables for arms, red/cyan RGB-split glitch slices that jump around his body.',
    personality: 'Speaks in error messages, gets more corrupted each song.' },
  nova: { name: 'NOVA', role: 'opp', color: '#ff5fd1',
    look: 'Stadium pop idol: big pink twin-tails with star clips, sparkly magenta stage outfit, white platform boots, headset mic, star-shaped earrings, winks a lot.',
    personality: 'Bubbly superstar, a little vain, loves the crowd.' },
  tide: { name: 'TIDE', role: 'opp', color: '#00c8ff',
    look: 'Ocean elemental: a muscular body made of rolling blue water with white foam edges, glowing aqua eyes, coral crown, seaweed draped on the shoulders, wave splashes from his fists.',
    personality: 'Loud, dramatic, talks like a pirate-surfer.' },
  marina: { name: 'MARINA', role: 'opp', color: '#2de6c8',
    look: 'Mermaid pop star sitting on a rock: teal scaly tail with a big fin, long wavy seafoam hair, shell top, pearl necklace, holds a shell-shaped mic.',
    personality: 'Sweet but sneaky, siren vibes.' },
  pixel: { name: 'PIXEL', role: 'opp', color: '#ffcc00',
    look: 'Retro arcade challenger: a kid-sized walking arcade cabinet, the screen is his face (chunky pixel eyes + mouth), joystick + buttons on his chest, little legs in sneakers, coin slot belly.',
    personality: 'Gamer trash-talk, "GG EZ", counts high scores.' },
  razor: { name: 'RAZOR', role: 'opp', color: '#ff3b3b',
    look: 'Street-punk alley cat: anthropomorphic black cat with a red mohawk, studded leather jacket, ripped jeans, long claws, a scar over one eye. Song 2: fur bristling, glowing yellow eyes. Song 3 (form 2): bigger, feral, torn jacket, red aura; a mid-song transform makes him even wilder.',
    personality: 'Aggressive brawler, hates losing, turns feral when pushed.' },
  specter: { name: 'SPECTER', role: 'opp', color: '#ff7b1a',
    look: 'Graveyard phantom: a lanky figure in a tattered black cloak with a glowing jack-o-lantern head (carved grin, orange inner glow), skeletal hands, floats a little, a lantern on a chain.',
    personality: 'Spooky prankster, loves scaring Mel.' },
  vixen: { name: 'VIXEN', role: 'opp', color: '#ff8040',
    look: 'Sly fox trickster: anthropomorphic orange fox with a huge fluffy white-tipped tail, green hoodie, golden eyes, a leaf hair clip, mischievous grin, holds a mic with a fox-tail charm.',
    personality: 'Trickster, lies, throws fake notes.' },
  tempo: { name: 'TEMPO', role: 'opp', color: '#d4af37',
    look: 'Clocktower metronome-man: tall brass body, a round clock face for a head with hour/minute hands as eyebrows, a swinging pendulum in his chest, top hat, white gloves, pocket watch on chain.',
    personality: 'Strict and proper, obsessed with being on time.' },
  steve: { name: 'STEVE', role: 'opp', color: '#3ddc97',
    look: 'Blocky overworld hero (our own design, NOT a copy of any game skin): body made of cubes, square head, brown messy block-hair, teal shirt, indigo pants, simple square eyes. Song 2: eyes flicker white, slight jitter. Song 3: pale, glowing white eyes, glitch blocks breaking off, dark aura ("corrupted").',
    personality: 'Friendly builder who slowly gets corrupted ("help me").' },
  blaze: { name: 'BLAZE', role: 'opp', color: '#ff8c1a',
    look: 'Rockstar dragon: red-orange scaly dragon with small wings, flaming mane, leather vest, shades on his snout, a flying-V guitar slung over his shoulder, smoke puffs from nostrils.',
    personality: 'Show-off rock legend, everything is "hot".' },
  bolt: { name: 'BOLT', role: 'opp', color: '#fff34d',
    look: 'Roller-rink speedster: wiry guy with lightning-bolt yellow spiky hair, racing visor, electric-blue track jacket, knee pads, glowing roller skates, sparks crackle around him.',
    personality: 'Hyper, talks super fast, never stops moving.' },
  cipher: { name: 'CIPHER', role: 'opp', color: '#12fa05',
    look: 'Rogue hacker: black hoodie with hood up, the face is a dark void with a glowing green digital mask (code-pattern smile), floating holo-keyboard, green code glyphs drifting off him.',
    personality: 'Cold, calculating, types insults.' },
  deadeye: { name: 'DEADEYE', role: 'opp', color: '#ff1414',
    look: 'Reaper gunslinger: very tall and lean, long tattered dark-red duster coat, wide-brim hat that hides the face except ONE narrow glowing red eye, bandana, bandolier of shiny bullets, a revolver in one hand and a mic in the other, smoke curling off the barrel.',
    personality: 'Quiet, deadly, cowboy drawl. Shoots at you.' },
  omega: { name: 'OMEGA', role: 'opp', color: '#8b2be2',
    look: 'Cosmic final boss: a huge floating entity of deep-purple void with a starfield inside its body, a halo ring of orbiting planets, many small eyes and one giant eye, long ribbon arms, no legs.',
    personality: 'Ancient, calm, speaks in measurements and the end of everything.' },
};

// ---------------------------------------------------------------- weeks + songs
// Every week has its own stage. Song style hints feed the composer.
// mech = special mechanics used in that week (see G.MECHANICS)
G.WEEKS = [
  { id: 'tutorial', name: 'TUTORIAL', title: 'Learn the Ropes', opp: 'mel', stage: 'practice', color: '#ff4fa3', mech: [],
    songs: [{ id: 'warm-up', name: 'Warm Up', bpm: 100, style: 'simple bouncy hip-hop beat, friendly, major key', key: 'C', mode: 'major' }] },
  { id: 'week1', name: 'WEEK 1', title: 'Club Phantom', opp: 'echo', stage: 'club', color: '#3fd4ff', mech: [],
    songs: [
      { id: 'afterhours', name: 'Afterhours', bpm: 110, style: 'chill house groove, plucky synth, four-on-the-floor', key: 'F', mode: 'minor' },
      { id: 'reverb', name: 'Reverb', bpm: 118, style: 'deep house, echoing stabs, rolling bass', key: 'G', mode: 'minor' },
      { id: 'phantom-drop', name: 'Phantom Drop', bpm: 126, style: 'big club drop, sidechain pumping, ghostly choir', key: 'A', mode: 'minor' }] },
  { id: 'week2', name: 'WEEK 2', title: 'Sunset Skate', opp: 'ash', stage: 'skatepark', color: '#c9a7ff', mech: [],
    songs: [
      { id: 'kickflip', name: 'Kickflip', bpm: 96, style: 'lo-fi hip-hop, dusty drums, jazzy keys, vinyl crackle', key: 'D', mode: 'major' },
      { id: 'lo-fi-lane', name: 'Lo-Fi Lane', bpm: 102, style: 'lo-fi boom-bap, mellow electric piano', key: 'E', mode: 'minor' },
      { id: 'grind-rail', name: 'Grind Rail', bpm: 110, style: 'skate punk energy, distorted guitar, fast hats', key: 'A', mode: 'minor' }] },
  { id: 'week3', name: 'WEEK 3', title: 'System Error', opp: 'glitch', stage: 'void', color: '#ff2a6d', mech: ['glitch'],
    songs: [
      { id: 'static', name: 'Static', bpm: 130, style: 'glitchy electro, bitcrushed drums, stuttering chops', key: 'C', mode: 'minor' },
      { id: 'corrupt', name: 'Corrupt', bpm: 136, style: 'dark electro, broken square leads, heavy kicks', key: 'D', mode: 'minor' },
      { id: 'blue-screen', name: 'Blue Screen', bpm: 145, style: 'chaotic glitch-hop, distorted bass, alarm synths', key: 'Eb', mode: 'minor' }] },
  { id: 'week4', name: 'WEEK 4', title: 'Superstar', opp: 'nova', stage: 'stadium', color: '#ff5fd1', mech: [],
    songs: [
      { id: 'starlight', name: 'Starlight', bpm: 138, style: 'sparkly J-pop, bright synth chords, handclaps', key: 'E', mode: 'major' },
      { id: 'encore', name: 'Encore', bpm: 144, style: 'arena pop, big chorus, crowd claps', key: 'F', mode: 'major' },
      { id: 'supernova', name: 'Supernova', bpm: 150, style: 'hyperpop, pitched vocal chops, huge drops', key: 'G', mode: 'major' }] },
  { id: 'week5', name: 'WEEK 5', title: 'High Tide', opp: 'tide', stage: 'beach', color: '#00c8ff', mech: [],
    songs: [
      { id: 'undertow', name: 'Undertow', bpm: 120, style: 'surf rock, twangy guitar, splashy cymbals', key: 'A', mode: 'major' },
      { id: 'riptide', name: 'Riptide', bpm: 126, style: 'surf punk, driving bass', key: 'B', mode: 'minor' },
      { id: 'tsunami', name: 'Tsunami', bpm: 135, style: 'epic stormy rock, thunder hits, huge toms', key: 'C', mode: 'minor' }] },
  { id: 'week6', name: 'WEEK 6', title: 'Siren Reef', opp: 'marina', stage: 'reef', color: '#2de6c8', mech: [],
    songs: [
      { id: 'siren-song', name: 'Siren Song', bpm: 112, style: 'dreamy pop, bubbly plucks, airy pads', key: 'D', mode: 'major' },
      { id: 'coral-pop', name: 'Coral Pop', bpm: 118, style: 'tropical pop, marimba, steel drum', key: 'F', mode: 'major' },
      { id: 'deep-blue', name: 'Deep Blue', bpm: 124, style: 'dark wavy synthpop, deep bass, echo', key: 'C#', mode: 'minor' }] },
  { id: 'week7', name: 'WEEK 7', title: 'Insert Coin', opp: 'pixel', stage: 'arcade', color: '#ffcc00', mech: ['coin'],
    songs: [
      { id: 'insert-coin', name: 'Insert Coin', bpm: 140, style: 'chiptune, square leads, 8-bit noise drums', key: 'C', mode: 'major' },
      { id: 'high-score', name: 'High Score', bpm: 148, style: 'fast chiptune, arpeggios, triangle bass', key: 'D', mode: 'major' },
      { id: 'bit-crush', name: 'Bit Crush', bpm: 156, style: 'chiptune metal, crushed drums, boss music', key: 'E', mode: 'minor' }] },
  { id: 'week8', name: 'WEEK 8', title: 'Alley Cat', opp: 'razor', stage: 'alley', color: '#ff3b3b', mech: ['drain'],
    songs: [
      { id: 'back-alley', name: 'Back Alley', bpm: 148, style: 'punk rock, power chords, fast snare', key: 'E', mode: 'minor' },
      { id: 'feral', name: 'Feral', bpm: 156, style: 'hardcore punk, growling bass, gang shouts', key: 'F#', mode: 'minor' },
      { id: 'nine-lives', name: 'Nine Lives', bpm: 165, style: 'metal breakdown, double kick, screaming lead', key: 'D', mode: 'minor' }] },
  { id: 'week9', name: 'WEEK 9', title: 'Grave Shift', opp: 'specter', stage: 'graveyard', color: '#ff7b1a', mech: ['ghost'],
    songs: [
      { id: 'grave-shift', name: 'Grave Shift', bpm: 134, style: 'spooky swing, organ, plucked bass', key: 'G', mode: 'minor' },
      { id: 'hollow', name: 'Hollow', bpm: 140, style: 'creepy electro-swing, theremin lead', key: 'A', mode: 'minor' },
      { id: 'midnight', name: 'Midnight', bpm: 150, style: 'horror rock, church bells, choir', key: 'C', mode: 'minor' }] },
  { id: 'week10', name: 'WEEK 10', title: 'Foxfire Forest', opp: 'vixen', stage: 'forest', color: '#ff8040', mech: ['hurt'],
    songs: [
      { id: 'sly', name: 'Sly', bpm: 144, style: 'funky folk-pop, flute lead, slap bass', key: 'D', mode: 'minor' },
      { id: 'foxfire', name: 'Foxfire', bpm: 150, style: 'mystical trap, koto-like plucks, 808s', key: 'E', mode: 'minor' },
      { id: 'trickster', name: 'Trickster', bpm: 158, style: 'chaotic funk, fake-out breaks, wah guitar', key: 'G', mode: 'minor' }] },
  { id: 'week11', name: 'WEEK 11', title: 'Clockwork', opp: 'tempo', stage: 'clocktower', color: '#d4af37', mech: ['tempo'],
    songs: [
      { id: 'tick-tock', name: 'Tick Tock', bpm: 156, style: 'clockwork baroque-electro, harpsichord, ticking hats', key: 'C', mode: 'minor' },
      { id: 'overtime', name: 'Overtime', bpm: 162, style: 'swing-electro, brass stabs, ticking', key: 'F', mode: 'minor' },
      { id: 'last-second', name: 'Last Second', bpm: 170, style: 'frantic orchestral-electro, bells, accelerating feel', key: 'Bb', mode: 'minor' }] },
  { id: 'week12', name: 'WEEK 12', title: 'Overworld', opp: 'steve', stage: 'overworld', color: '#3ddc97', mech: ['glitch'],
    songs: [
      { id: 'blocky', name: 'Blocky', bpm: 128, style: 'cozy chiptune-pop, bright plucks, happy', key: 'G', mode: 'major' },
      { id: 'mined-out', name: 'Mined Out', bpm: 134, style: 'uneasy minor chiptune, echoing drips', key: 'A', mode: 'minor' },
      { id: 'null-seed', name: 'Null Seed', bpm: 142, style: 'corrupted horror chiptune, detuned, glitch stutters', key: 'C', mode: 'minor' }] },
  { id: 'week13', name: 'WEEK 13', title: 'Hot Wired', opp: 'blaze', stage: 'volcano', color: '#ff8c1a', mech: ['fire'],
    songs: [
      { id: 'hot-wired', name: 'Hot Wired', bpm: 168, style: 'hard rock, crunchy riffs, cowbell', key: 'E', mode: 'minor' },
      { id: 'magma', name: 'Magma', bpm: 174, style: 'heavy metal, chugging, guitar solo', key: 'D', mode: 'minor' },
      { id: 'inferno', name: 'Inferno', bpm: 182, style: 'speed metal, blast beats, epic', key: 'C#', mode: 'minor' }] },
  { id: 'week14', name: 'WEEK 14', title: 'Redline', opp: 'bolt', stage: 'highway', color: '#fff34d', mech: [],
    songs: [
      { id: 'rollin', name: "Rollin'", bpm: 178, style: 'eurobeat, racing synth lead, fast arps', key: 'F', mode: 'minor' },
      { id: 'overdrive', name: 'Overdrive', bpm: 186, style: 'drum and bass, reese bass, amen-style breaks', key: 'G', mode: 'minor' },
      { id: 'redline', name: 'Redline', bpm: 195, style: 'hardcore eurobeat, insane speed', key: 'A', mode: 'minor' }] },
  { id: 'week15', name: 'WEEK 15', title: 'Firewall', opp: 'cipher', stage: 'cyber', color: '#12fa05', mech: ['virus'],
    songs: [
      { id: 'firewall', name: 'Firewall', bpm: 172, style: 'darksynth, gated drums, cold arps', key: 'D', mode: 'minor' },
      { id: 'breach', name: 'Breach', bpm: 180, style: 'industrial techno, metallic hits', key: 'E', mode: 'minor' },
      { id: 'root-access', name: 'Root Access', bpm: 188, style: 'cyberpunk drum and bass, glitch fills', key: 'F', mode: 'minor' }] },
  { id: 'week16', name: 'WEEK 16', title: 'High Noon', opp: 'deadeye', stage: 'canyon', color: '#ff1414', mech: ['bullet', 'dodge'],
    songs: [
      { id: 'showdown', name: 'Showdown', bpm: 165, style: 'spaghetti western rock, whistle lead, twangy guitar', key: 'A', mode: 'minor' },
      { id: 'dead-aim', name: 'Dead Aim', bpm: 172, style: 'western trap, gunshot percussion, trumpet', key: 'D', mode: 'minor' },
      { id: 'last-stand', name: 'Last Stand', bpm: 180, style: 'epic western metal, choir, gunfire breaks', key: 'E', mode: 'minor' }] },
  { id: 'week17', name: 'WEEK 17', title: 'The End', opp: 'omega', stage: 'cosmos', color: '#8b2be2', mech: ['void', 'drain'],
    songs: [
      { id: 'singularity', name: 'Singularity', bpm: 170, style: 'cosmic synthwave, huge pads, arps', key: 'C', mode: 'minor' },
      { id: 'event-horizon', name: 'Event Horizon', bpm: 180, style: 'epic orchestral electronic, choir, timpani', key: 'D', mode: 'minor' },
      { id: 'omega', name: 'Omega', bpm: 190, style: 'final boss, everything at once, key changes, choir + metal + synths', key: 'Eb', mode: 'minor' }] },
];
// flat song list + lookups
G.SONGS = [];
G.WEEKS.forEach((w, wi) => w.songs.forEach((s, si) => {
  s.week = w.id; s.weekIndex = wi; s.index = si; s.opp = w.opp; s.stage = w.stage; s.color = w.color;
  G.SONGS.push(s);
}));
G.songInfo = id => G.SONGS.find(s => s.id === id) || null;
G.weekInfo = id => G.WEEKS.find(w => w.id === id) || null;
G.PLAYERS = ['ace', 'nitro'];

// ---------------------------------------------------------------- stages
G.STAGE_INFO = {
  practice: 'FNF-week-1-style practice stage: dark wooden stage floor, red velvet curtains on both sides and top, spotlights, an empty audience area. Simple and clean.',
  club: 'Neon nightclub "CLUB PHANTOM": DJ booth behind ECHO, dance floor tiles that light up on beat, crowd silhouettes bopping, sweeping laser beams, disco ball, haze.',
  skatepark: 'Skatepark at sunset: concrete bowls and ramps, graffiti walls, chain-link fence, palm trees, orange-pink sky; event: skaters roll past in the background.',
  void: 'Corrupted digital void: dark grid floor, floating broken windows/error popups, pixel blocks drifting; events: screen-tear glitch bursts on big beats.',
  stadium: 'Stadium concert at night: huge stage with LED screens, crowd with lightsticks waving to the beat, stage lights; event: fireworks bursts.',
  beach: 'Beach at night with a full moon: sand, lifeguard tower, palm trees, rolling waves; event: a big wave crash splash.',
  reef: 'Underwater coral reef stage: coral, kelp swaying, light rays, bubbles; event: a school of fish swims across.',
  arcade: 'Retro arcade hall: rows of glowing arcade cabinets, checker carpet, neon signs; event: pixel invaders fly across a big screen.',
  alley: 'Back alley at night: brick walls, dumpsters, fire escape, neon "OPEN 24/7" sign, puddles reflecting; event: a police car speeds past with flashing lights.',
  graveyard: 'Haunted graveyard with a creepy mansion: tombstones, dead trees, fog, full moon; events: LIGHTNING strikes with thunder (characters get scared, like FNF week 2).',
  forest: 'Moonlit forest clearing: tall pines, fireflies, glowing mushrooms, a shrine gate; event: fox-fire wisps swirl across.',
  clocktower: 'Inside a giant clocktower: huge brass gears turning on beat, a giant clock face window behind, pendulum; event: the bell tolls (screen shake).',
  overworld: 'Blocky overworld: voxel hills, square trees, square sun and clouds, a small block house; gets darker/corrupted across the week (song index: 0 bright day, 1 sunset, 2 red corrupted night).',
  volcano: 'Volcano rock concert: stage on black rock, lava rivers, amp stacks, pyro jets that fire on beat; event: an eruption.',
  highway: 'Highway race at night (FNF week-4 style): everyone rides on top of a speeding open truck, road lines and street lights zoom past; event: a car overtakes.',
  cyber: 'Cyberpunk rooftop at night (FNF week-3 style): skyline with windows that light up in a new color each beat, holo ads; event: a maglev train blasts past.',
  canyon: 'Desert canyon at dusk (FNF week-7 style): red mesas, cacti, tumbleweeds, vultures circling, an old saloon; bandit silhouettes on the ridge.',
  cosmos: 'Edge of the universe: deep space, nebulas, swirling black hole behind OMEGA, planets drifting, a floating rock platform the singers stand on.',
};

// ---------------------------------------------------------------- mechanics
// Special note types. 'avoid' notes must NOT be pressed.
// Every mechanic is explained in a popup the first time a song with it starts.
G.MECHANICS = {
  hurt:   { name: 'Trick Notes', avoid: true, desc: 'Notes with a fox tail are FAKES. Do NOT press them, or you take damage.' },
  bullet: { name: 'Bullet Notes', avoid: true, desc: 'Red bullet notes are DEADEYE shooting at you. Do NOT press them, they hurt a lot (even on Easy).' },
  fire:   { name: 'Fire Notes', avoid: true, desc: 'Flaming notes BURN. Do NOT press them, or you slowly lose health for a few seconds.' },
  virus:  { name: 'Virus Notes', avoid: true, desc: 'Green virus notes hack your screen. Do NOT press them.' },
  void:   { name: 'Void Notes', avoid: true, desc: 'Black void notes drain you. Do NOT press them.' },
  ghost:  { name: 'Ghost Notes', avoid: false, desc: 'Ghost notes fade away before they reach your arrows. Remember where they were and hit them anyway!' },
  glitch: { name: 'Glitch Notes', avoid: false, desc: 'Glitch notes jump to a different lane on the way up. Watch where they land!' },
  coin:   { name: 'Coin Notes', avoid: false, desc: 'Gold coin notes are a bonus: hit them for extra health and score. Missing them is fine.' },
  dodge:  { name: 'Dodge!', avoid: false, desc: 'When DEADEYE aims at you and "DODGE!" flashes, press SPACE (or the DODGE button) to dodge the shot.' },
  drain:  { name: 'Health Drain', avoid: false, desc: 'This opponent steals a little health every time they sing. Keep hitting notes!' },
  tempo:  { name: 'Tempo Shift', avoid: false, desc: 'The clock speeds up and slows down the note speed. Stay sharp!' },
};

// Credits screen text
G.CREDITS = [
  { head: 'FNF 2' },
  { name: 'Game idea + direction', role: 'kunven67' },
  { name: 'Built with', role: 'Claude Code' },
  { head: 'Inspired by' },
  { name: "Friday Night Funkin'", role: 'by the Funkin\' Crew (go play it!)' },
  { head: 'Fonts' },
  { name: 'Spicy Rice', role: 'Astigmatic - SIL Open Font License' },
  { name: 'Chewy', role: 'Sideshow - Apache License 2.0' },
  { name: 'VT323', role: 'Peter Hull - SIL Open Font License' },
  { head: 'Note' },
  { name: 'All characters, songs and art in FNF 2', role: 'are original and made in code' },
];
