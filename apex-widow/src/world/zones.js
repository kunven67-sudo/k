// Every zone the size ladder passes through. Each one is its own world with its own unit of length.
import { Halvern } from './halvern.js';
import { EarthZone } from '../space/earth.js';
import { SolarZone } from '../space/solar.js';
import { GalaxyZone } from '../space/galaxy.js';
import { UniverseZone } from '../space/universe.js';
import { MultiverseZone } from '../space/multiverse.js';

export const ZONES = { halvern: Halvern, earth: EarthZone, solar: SolarZone, galaxy: GalaxyZone, universe: UniverseZone, multiverse: MultiverseZone };
export const ZONE_ORDER = ['halvern', 'earth', 'solar', 'galaxy', 'universe', 'multiverse'];
// the size (body length, metres) at which you outgrow a zone and the camera pulls out to the next one
export const OUTGROW = { halvern: 9000, earth: 2.6e7, solar: 3e13, galaxy: 2e21, universe: 6e26, multiverse: Infinity };
export const ZONE_TITLE = { halvern: 'New Halvern', earth: 'Earth', solar: 'The Solar System', galaxy: 'The Milky Way', universe: 'The Universe', multiverse: 'The Multiverse' };
