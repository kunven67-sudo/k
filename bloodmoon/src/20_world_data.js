
// =====================================================================
// GREYWATER VALE — where everything is. x runs east, z runs south (north is -z).
// The valley is 1600 m across, ringed by mountains.
// =====================================================================
const WORLD_SIZE = 1600, HALF = 800;
const PLACES = {
  ashford: { name: 'Ashford', x: 0, z: 150, r: 105, kind: 'town', level: 13 },
  home: { name: 'Your old house', x: -58, z: 168 },
  mill: { name: 'The Old Mill', x: -78, z: 296, r: 30 },
  wolfwood: { name: 'Wolfwood', x: 300, z: 60, r: 190 },
  den: { name: 'The Wolf Den', x: 372, z: -20 },
  graveyard: { name: 'St. Aldric\'s Graveyard', x: 420, z: 300, r: 55 },
  chapel: { name: 'Ruined Chapel', x: 448, z: 268 },
  castle: { name: 'Castle Vargrave', x: 360, z: -340, r: 75, level: 46 },
  bridge: { name: 'The Old Stone Bridge', x: -58, z: -168 },
  northcamp: { name: 'North Camp', x: -120, z: -470 },
  nest: { name: 'Wyvern Nest', x: -250, z: -655 },
  swamp: { name: 'Blackmire', x: -470, z: 60, r: 160 },
  witch: { name: 'Morwen\'s Hut', x: -540, z: 10 },
  mirenest: { name: 'The Drowned Nest', x: -430, z: 140 },
  shrine: { name: 'The Hungering Shrine', x: -655, z: -390 },
  lake: { name: 'Greywater Lake', x: 135, z: 600, r: 115 },
  farms: { name: 'Ashford Farms', x: 130, z: 225, r: 70 },
};
// hunter camps with signposts: fast travel, rest and autosave
const CAMPS = [
  { id: 'ashford', name: 'Ashford Square', x: 8, z: 128 },
  { id: 'mill', name: 'Mill Crossing', x: -40, z: 330 },
  { id: 'bridge', name: 'Old Bridge Camp', x: -22, z: -138 },
  { id: 'north', name: 'North Camp', x: -120, z: -470 },
  { id: 'mire', name: 'Blackmire Camp', x: -318, z: 96 },
  { id: 'castle', name: 'Castle Road', x: 245, z: -215 },
  { id: 'grave', name: 'Graveyard Gate', x: 372, z: 282 },
  { id: 'lake', name: 'Lake Shore', x: 40, z: 532 },
];
// the river runs from the northern mountains, under the Old Bridge, past the mill and into the lake
const RIVER_RAW = [[-30, -800], [-36, -640], [-80, -470], [-92, -330], [-58, -168], [-30, -40], [-110, 60], [-128, 200], [-100, 302], [-30, 420], [60, 500], [135, 600]];
const RIVER = smoothPath(RIVER_RAW, 8);
const RIVER_TOP = 46, RIVER_BOTTOM = 5.2; // water height at the source and at the lake
const LAKE_LEVEL = 5.2, SWAMP_LEVEL = 7.4;
// dirt roads between places
const ROADS_RAW = [
  [[8, 128], [40, 60], [120, -60], [210, -170], [290, -270], [345, -305]], // castle road
  [[-20, 140], [-40, 90], [-36, -40], [-58, -168], [-70, -300], [-110, -420], [-120, -470], [-190, -580], [-240, -630]], // north road over the bridge
  [[-40, 175], [-50, 260], [-40, 330], [-78, 296]], // mill lane
  [[30, 170], [120, 220], [240, 270], [372, 282], [420, 300]], // graveyard road
  [[-50, 140], [-160, 120], [-260, 100], [-318, 96], [-450, 70], [-540, 10]], // swamp track
  [[10, 200], [20, 330], [40, 532], [70, 560]], // lake road
  [[120, -60], [230, 0], [330, 30]], // into Wolfwood
];
const ROADS = ROADS_RAW.map((r) => smoothPath(r, 5));
// town layout: [x, z, width, depth, kind, rotation(rad), name, interaction]
const TOWN = [
  [-58, 168, 11, 9, 'home', 0, 'Your old house', 'home'],
  [26, 108, 12, 10, 'inn', 0, 'The Drowned Lantern (inn)', 'inn'],
  [-30, 108, 10, 9, 'smith', 0, 'Brann\'s Forge', 'smith'],
  [44, 152, 9, 8, 'alchemist', -Math.PI / 2, 'Old Maud\'s Remedies', 'alchemist'],
  [-6, 205, 13, 11, 'chapel', Math.PI, 'Chapel of the Dawn', 'chapel'],
  [62, 196, 9, 8, 'house', Math.PI, null, null], [-40, 220, 9, 8, 'house', Math.PI, null, null], [80, 120, 9, 8, 'house', -Math.PI / 2, null, null],
  [-78, 120, 9, 8, 'house', Math.PI / 2, null, null], [-86, 200, 9, 8, 'house', Math.PI / 2, null, null], [60, 82, 8, 7, 'house', 0, null, null],
  [-62, 78, 8, 7, 'house', 0, null, null], [92, 160, 8, 7, 'house', -Math.PI / 2, null, null], [30, 236, 9, 8, 'house', Math.PI, null, null],
  [-6, 70, 10, 8, 'barracks', 0, 'Watch House', null],
];
const TOWN_LEVEL = 13; // ground height the town is flattened to
// world map icons
const MAP_ICONS = {
  ashford: 'town', castle: 'castle', mill: 'mill', graveyard: 'grave', bridge: 'bridge', witch: 'hut', shrine: 'skull', nest: 'nest', den: 'paw', lake: 'water',
};
