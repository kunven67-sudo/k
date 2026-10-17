// State registry. `?state=<name>` in the URL jumps straight to a state (dev / testing).

import { LabState } from './lab.js';
import { WorldState } from './world.js';

export const STATES = {
  lab: LabState,
  world: WorldState,
};

export const FIRST_STATE = 'world';
