// State registry. `?state=<name>` in the URL jumps straight to a state (dev / testing).

import { LabState } from './lab.js';
import { WorldState } from './world.js';
import { MenuState } from './menu.js';
import { BirthState } from './birth.js';

export const STATES = {
  lab: LabState,
  world: WorldState,
  menu: MenuState,
  birth: BirthState,
};

export const FIRST_STATE = 'menu';
