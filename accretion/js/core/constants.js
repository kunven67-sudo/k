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

// Distances inside star systems are 10x shorter than in reality so there is
// always something nearby. Temperatures and starlight are still worked out
// from the real (uncompressed) distance.
export const DIST_COMPRESS = 10;
export const AU_REAL = 1.496e8;
export const AU = AU_REAL / DIST_COMPRESS;
export const LIGHT_SECOND = C;
export const LIGHT_MINUTE = C * 60;
export const LIGHT_HOUR = C * 3600;

// One real second of play = TIME_BASE seconds of simulated time.
// At this rate a low orbit around any rocky body takes about 3 seconds.
export const TIME_BASE = 2500;
export const WARP_LEVELS = [1, 10, 100, 1000, 10000];

// Densities in kg/km^3 (1 g/cm^3 = 1e12 kg/km^3)
export const RHO = {
  rock: 3.0e12,
  iron: 7.9e12,
  ice: 0.95e12,
  gas: 0.25e12,
};

export const COMP_COLORS = {
  rock: '#b08a68',
  iron: '#8f9aa6',
  ice: '#a9d8f0',
  gas: '#e8c27a',
};

export const STAGES = [
  {
    id: 'planetesimal', name: 'Planetesimal', min: 0,
    blurb: 'A loose clump of dust and rock',
    facts: [
      'Planets start as clumps of dust and rock a few kilometres wide, called planetesimals.',
      'Gas in a young disk slows down small pebbles, so they drift in and stick to bigger bodies. Astronomers call this pebble accretion.',
      'Earth was built from countless collisions like these over about 100 million years.',
    ],
  },
  {
    id: 'asteroid', name: 'Asteroid', min: 1e17,
    blurb: 'A rubble pile held together by weak gravity',
    facts: [
      'Most asteroids are rubble piles: loose rocks held together only by their own gravity.',
      'The escape velocity of a 10 km asteroid is only about 5 m/s. You could jump off it.',
    ],
  },
  {
    id: 'dwarf', name: 'Dwarf Planet', min: 1e20,
    blurb: 'Big enough for gravity to pull it round',
    facts: [
      'Once a body is a few hundred km wide, its gravity squeezes it into a sphere. This is hydrostatic equilibrium.',
      'Ceres, the biggest object in the asteroid belt, is a dwarf planet 940 km wide.',
    ],
  },
  {
    id: 'protoplanet', name: 'Protoplanet', min: 3e22,
    blurb: 'Hot from impacts, iron sinking to the core',
    facts: [
      'Impacts now release so much heat that the surface melts into a magma ocean.',
      'Heavy iron sinks to the centre and forms a core. This is called differentiation.',
      'Earth’s Moon probably formed when a Mars-sized protoplanet called Theia hit the young Earth.',
    ],
  },
  {
    id: 'terrestrial', name: 'Rocky Planet', min: 3e23,
    blurb: 'Gravity strong enough to hold an atmosphere',
    facts: [
      'Your gravity can now hold onto an atmosphere. Volcanoes add gas to it.',
      'Earth is 5.97 × 10²⁴ kg. Liquid water needs the right distance from a star: the habitable zone.',
    ],
  },
  {
    id: 'superearth', name: 'Super-Earth', min: 1.2e25,
    blurb: '2 to 10 times the mass of Earth',
    facts: [
      'Super-Earths are among the most common planets in the galaxy, yet our solar system has none.',
      'Surface gravity on a 5 Earth-mass planet can be almost twice Earth’s.',
    ],
  },
  {
    id: 'icegiant', name: 'Ice Giant', min: 6e25,
    blurb: 'Runaway gas accretion has begun',
    facts: [
      'Past about 10 Earth masses, a planet pulls in gas faster and faster. This is runaway gas accretion.',
      'Neptune is blue because methane in its air absorbs red light.',
    ],
  },
  {
    id: 'gasgiant', name: 'Gas Giant', min: 3e26,
    blurb: 'A world of hydrogen and helium with no surface',
    facts: [
      'A gas giant has no solid surface. The gas just gets thicker and hotter as you go down.',
      'Jupiter is so massive that it and the Sun orbit a point just outside the Sun’s surface.',
      'Adding mass to a gas giant barely makes it bigger. It just squeezes tighter.',
    ],
  },
  {
    id: 'browndwarf', name: 'Brown Dwarf', min: 13 * 1.898e27,
    blurb: 'Deuterium fusion flickers in the core',
    facts: [
      'Above 13 Jupiter masses, the core gets hot enough to fuse deuterium.',
      'Brown dwarfs are failed stars. They are too small to fuse ordinary hydrogen, so they glow dim red and slowly cool.',
    ],
  },
  {
    id: 'reddwarf', name: 'Red Dwarf Star', min: 0.075 * 1.989e30,
    blurb: 'Hydrogen fusion ignited. You are a star.',
    facts: [
      'At 0.075 solar masses your core reaches about 3 million °C. Hydrogen fusion begins. You are a star now.',
      'About 3 out of every 4 stars in the Milky Way are red dwarfs.',
      'Red dwarfs can shine for trillions of years, far longer than the universe has existed.',
    ],
  },
  {
    id: 'sunlike', name: 'Sun-like Star', min: 0.5 * 1.989e30,
    blurb: 'A steady yellow-orange star',
    facts: [
      'The Sun turns about 4 million tonnes of matter into energy every second.',
      'Light made in the Sun’s core takes over 100,000 years to work its way to the surface.',
    ],
  },
  {
    id: 'bluestar', name: 'Blue-White Star', min: 1.5 * 1.989e30,
    blurb: 'Hot, bright, and burning fast',
    facts: [
      'Bigger stars burn much faster. A star 5 times the Sun’s mass lives only about 100 million years.',
      'Your surface is now over 8,000 °C, which is why you glow blue-white.',
    ],
  },
  {
    id: 'massive', name: 'Massive Star', min: 8 * 1.989e30,
    blurb: 'Fusing heavier elements toward collapse',
    facts: [
      'Above about 8 solar masses, a star fuses heavier and heavier elements until its core is iron. Then it collapses.',
      'The last step, silicon burning, takes about one day.',
      'A collapsing core becomes a neutron star, or a black hole if the star is heavy enough.',
    ],
  },
  {
    id: 'neutron', name: 'Neutron Star', min: Infinity, compact: true,
    blurb: 'A city-sized ball of neutrons',
    facts: [
      'A teaspoon of neutron star weighs about a billion tonnes.',
      'You are only about 24 km wide, and you spin many times per second.',
      'Above about 2.3 solar masses, a neutron star cannot hold itself up and collapses into a black hole.',
    ],
  },
  {
    id: 'stellarbh', name: 'Black Hole', min: Infinity, compact: true,
    blurb: 'Not even light can escape',
    facts: [
      'Nothing, not even light, escapes from inside the event horizon.',
      'A 10 solar-mass black hole has an event horizon only 59 km wide.',
      'You are only visible by the way you bend light from things behind you.',
    ],
  },
  {
    id: 'imbh', name: 'Intermediate Black Hole', min: Infinity, compact: true,
    blurb: '100 to 100,000 solar masses',
    facts: [
      'Intermediate-mass black holes are rare. Astronomers have only found a few likely ones.',
      'When a star wanders too close, it is shredded in a tidal disruption event, which can outshine a whole galaxy for weeks.',
    ],
  },
  {
    id: 'smbh', name: 'Supermassive Black Hole', min: Infinity, compact: true,
    blurb: 'An engine at the heart of a galaxy',
    facts: [
      'The Milky Way’s central black hole, Sagittarius A*, has about 4 million times the Sun’s mass.',
      'The biggest known black holes have tens of billions of solar masses.',
    ],
  },
];

export const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.id, i]));

// Thresholds for the compact-object branch
export const NS_MAX_MASS = 2.3 * M_SUN;
export const IMBH_MIN = 100 * M_SUN;
export const SMBH_MIN = 1e5 * M_SUN;
export const CORE_COLLAPSE_MASS = 8 * M_SUN;
export const BH_FROM_SN_MASS = 22 * M_SUN;

export const CORE_BURN_STAGES = [
  { el: 'Hydrogen', dur: 70 },
  { el: 'Helium', dur: 35 },
  { el: 'Carbon', dur: 18 },
  { el: 'Neon', dur: 10 },
  { el: 'Oxygen', dur: 7 },
  { el: 'Silicon', dur: 4 },
];
