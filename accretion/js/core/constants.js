// Real physical constants. Internal units: kilometres, kilograms, seconds.

export const G = 6.674e-20;            // km^3 kg^-1 s^-2
export const C = 299792.458;           // km/s
export const SIGMA_SB = 5.670374e-8;   // W m^-2 K^-4

export const M_SUN = 1.989e30;
export const R_SUN = 695700;
export const L_SUN = 3.828e26;
export const T_SUN = 5772;
export const M_JUP = 1.898e27;
export const R_JUP = 69911;
export const M_EARTH = 5.972e24;
export const R_EARTH = 6371;
export const M_MOON = 7.342e22;
export const M_CERES = 9.39e20;
export const M_EVEREST = 1.62e14;
export const YEAR = 3.15576e7;

// Distances inside star systems are 10x shorter than in reality so there is
// always something nearby. Temperatures and starlight are still worked out
// from the real (uncompressed) distance. Between stars, distances are real.
export const DIST_COMPRESS = 10;
export const AU_REAL = 1.496e8;
export const AU = AU_REAL / DIST_COMPRESS;
export const LY = 9.4607e12;

// One real second of play = TIME_BASE seconds of simulated time.
// At this rate a low orbit around any rocky body takes about 3 seconds.
export const TIME_BASE = 2500;
export const WARP_LEVELS = [1, 10, 100, 1000, 10000];
// deep time: years per real second
export const DEEP_LEVELS = [1e3, 1e5, 1e7, 1e9];

// Densities in kg/km^3 (1 g/cm^3 = 1e12 kg/km^3)
export const RHO = {
  rock: 3.0e12,
  iron: 7.9e12,
  ice: 0.95e12,
  carbon: 3.3e12,
  gas: 0.25e12,
};

export const COMP_KEYS = ['rock', 'iron', 'ice', 'carbon', 'gas'];

export const COMP_COLORS = {
  rock: '#b08a68',
  iron: '#8f9aa6',
  ice: '#a9d8f0',
  carbon: '#5b5866',
  gas: '#e8c27a',
};

// Everything you can become. tier = how far along you are; path = which branch.
export const FORMS = [
  { id: 'planetesimal', tier: 0, name: 'Planetesimal', blurb: 'A loose clump of dust and rock', facts: [
    'Planets start as clumps of rock a few kilometres wide, called planetesimals.',
    'Gas in a young disk slows tiny pebbles so they drift onto bigger bodies. This is pebble accretion.',
    'Earth was built from countless crashes like these over about 100 million years.',
  ] },
  { id: 'asteroid', tier: 1, name: 'Asteroid', blurb: 'A rubble pile held together by weak gravity', facts: [
    'Most asteroids are rubble piles: loose rocks held together only by their own gravity.',
    'On a 10 km asteroid you could jump off into space. Escape speed is about 5 m/s.',
  ] },
  { id: 'dwarf', tier: 2, name: 'Dwarf Planet', blurb: 'Big enough for gravity to pull it round', facts: [
    'At a few hundred km wide, gravity squeezes a body into a ball.',
    'Ceres, the biggest object in the asteroid belt, is a dwarf planet 940 km wide.',
  ] },
  { id: 'protoplanet', tier: 3, name: 'Protoplanet', blurb: 'Hot from impacts, iron sinking to the core', facts: [
    'Big impacts now melt your surface into a magma ocean.',
    'Heavy iron sinks to your centre and forms a core.',
    'Earth’s Moon probably formed when a Mars-sized protoplanet hit the young Earth.',
  ] },
  { id: 'terrestrial', tier: 4, name: 'Rocky Planet', blurb: 'Gravity strong enough to hold an atmosphere', facts: [
    'Your gravity can now hold onto air. Volcanoes add gas to it.',
    'Liquid water needs the right distance from a star: the habitable zone.',
  ] },
  { id: 'oceanworld', tier: 4, name: 'Ocean World', blurb: 'A planet covered by one deep ocean', facts: [
    'Eating lots of ice gave you a global ocean that could be hundreds of km deep.',
    'Deep down, the pressure squeezes water into strange hot ices.',
  ] },
  { id: 'iceworld', tier: 4, name: 'Ice World', blurb: 'A frozen ocean world', facts: [
    'Too cold for liquid water at the surface, so your ocean is frozen solid.',
    'Moons like Europa may hide liquid oceans under their ice.',
  ] },
  { id: 'ironworld', tier: 4, name: 'Iron Planet', blurb: 'Dense, dark, mostly metal', facts: [
    'You are mostly iron, like a giant version of Mercury.',
    'A big spinning iron core makes a strong magnetic field.',
  ] },
  { id: 'carbonworld', tier: 4, name: 'Carbon World', blurb: 'Made of graphite and carbon compounds', facts: [
    'Planets made from carbon-rich dust may have graphite crusts and tar-like oceans.',
    'Some stars have more carbon than oxygen, and their planets could be like this.',
  ] },
  { id: 'superearth', tier: 5, name: 'Super-Earth', blurb: '2 to 10 times the mass of Earth', facts: [
    'Super-Earths are among the most common planets in the galaxy, but our solar system has none.',
    'Surface gravity on a 5 Earth-mass planet is almost twice Earth’s.',
  ] },
  { id: 'diamondworld', tier: 5, name: 'Diamond World', blurb: 'Carbon squeezed into diamond', facts: [
    'Deep inside you, the pressure turns carbon into diamond. Your mantle may be a diamond layer thousands of km thick.',
    'Diamond worlds are possible but not proven yet. 55 Cancri e was once thought to be one.',
  ] },
  { id: 'megaearth', tier: 6, name: 'Mega-Earth', blurb: 'A rocky giant with crushing gravity', facts: [
    'Rocky planets over 10 Earth masses are called mega-Earths. Kepler-10c may be one.',
    'In a gas-rich disk, a planet this big pulls in gas fast. Stay out of the disk to stay rocky.',
  ] },
  { id: 'icegiant', tier: 6, name: 'Ice Giant', blurb: 'Runaway gas accretion has begun', facts: [
    'Past about 10 Earth masses, a planet in a gas disk pulls in gas faster and faster.',
    'Neptune is blue because methane in its air absorbs red light.',
  ] },
  { id: 'gasgiant', tier: 7, name: 'Gas Giant', blurb: 'Hydrogen and helium with no surface', facts: [
    'A gas giant has no solid surface. The gas just gets thicker and hotter as you go down.',
    'Adding mass to a gas giant barely makes it bigger. It just squeezes tighter.',
  ] },
  { id: 'degenerate', tier: 8, name: 'Degenerate Rock World', blurb: 'So heavy its atoms are crushed', facts: [
    'With no hydrogen you can never become a star. Instead your atoms are squeezed until electrons push back.',
    'Above about 1.4 solar masses even that pressure fails and you collapse into a neutron star.',
  ] },
  { id: 'browndwarf', tier: 8, name: 'Brown Dwarf', blurb: 'Deuterium fusion flickers in the core', facts: [
    'Above 13 Jupiter masses, the core gets hot enough to fuse deuterium.',
    'Brown dwarfs are failed stars: too small to fuse ordinary hydrogen.',
  ] },
  { id: 'reddwarf', tier: 9, name: 'Red Dwarf Star', blurb: 'Hydrogen fusion ignited. You are a star.', facts: [
    'At 0.075 solar masses your core reaches about 3 million °C. Hydrogen fusion begins.',
    'About 3 out of every 4 stars in the Milky Way are red dwarfs.',
    'Red dwarfs can shine for trillions of years.',
  ] },
  { id: 'sunlike', tier: 10, name: 'Sun-like Star', blurb: 'A steady yellow-orange star', facts: [
    'The Sun turns about 4 million tonnes of matter into energy every second.',
    'A star like the Sun shines for about 10 billion years.',
  ] },
  { id: 'bluestar', tier: 11, name: 'Blue-White Star', blurb: 'Hot, bright, and burning fast', facts: [
    'Bigger stars burn much faster. A star 5 times the Sun’s mass lives only about 100 million years.',
    'Your surface is over 8,000 °C, so you glow blue-white.',
  ] },
  { id: 'redgiant', tier: 11, name: 'Red Giant', blurb: 'Your core ran out of hydrogen', facts: [
    'With hydrogen gone from your core, you swelled up to hundreds of times your old size.',
    'The Sun will become a red giant in about 5 billion years and swallow Mercury and Venus.',
  ] },
  { id: 'massive', tier: 12, name: 'Massive Star', blurb: 'Fusing heavier elements toward collapse', facts: [
    'Above 8 solar masses, a star fuses heavier and heavier elements until its core is iron. Then it collapses.',
    'The last step, silicon burning, takes about one day.',
  ] },
  { id: 'whitedwarf', tier: 12, name: 'White Dwarf', blurb: 'An Earth-sized ember of a star', facts: [
    'A teaspoon of white dwarf weighs about 5 tonnes.',
    'Over 1.4 solar masses (the Chandrasekhar limit), a white dwarf explodes as a Type Ia supernova.',
  ] },
  { id: 'neutron', tier: 13, name: 'Neutron Star', blurb: 'A city-sized ball of neutrons', compact: true, facts: [
    'A teaspoon of neutron star weighs about a billion tonnes.',
    'You are only about 24 km wide, and you spin many times per second.',
    'Above about 2.3 solar masses a neutron star collapses into a black hole.',
  ] },
  { id: 'stellarbh', tier: 14, name: 'Black Hole', blurb: 'Not even light can escape', compact: true, facts: [
    'Nothing, not even light, escapes from inside the event horizon.',
    'A 10 solar-mass black hole is only 59 km wide.',
  ] },
  { id: 'imbh', tier: 15, name: 'Intermediate Black Hole', blurb: '100 to 100,000 solar masses', compact: true, facts: [
    'Intermediate-mass black holes are rare. Only a few likely ones are known.',
    'A star that wanders too close is shredded in a tidal disruption event.',
  ] },
  { id: 'smbh', tier: 16, name: 'Supermassive Black Hole', blurb: 'An engine at the heart of a galaxy', compact: true, facts: [
    'The Milky Way’s central black hole, Sagittarius A*, has about 4 million times the Sun’s mass.',
    'The biggest known black holes, like TON 618, have tens of billions of solar masses.',
  ] },
];

export const FORM = Object.fromEntries(FORMS.map((f) => [f.id, f]));
// old name kept for modules that index forms by position
export const STAGES = FORMS;
export const STAGE_INDEX = Object.fromEntries(FORMS.map((s, i) => [s.id, i]));

// Thresholds
export const NS_MAX_MASS = 2.3 * M_SUN;
export const WD_MAX_MASS = 1.38 * M_SUN;
export const IMBH_MIN = 100 * M_SUN;
export const SMBH_MIN = 1e5 * M_SUN;
export const CORE_COLLAPSE_MASS = 8 * M_SUN;
export const BH_FROM_SN_MASS = 22 * M_SUN;
export const TON618 = 4.07e10 * M_SUN;

// the last stages of a massive star's core, shortened to play out in a couple of minutes
export const CORE_BURN_STAGES = [
  { el: 'Carbon', dur: 45, real: '600 years' },
  { el: 'Neon', dur: 30, real: '1 year' },
  { el: 'Oxygen', dur: 25, real: '6 months' },
  { el: 'Silicon', dur: 18, real: '1 day' },
];
