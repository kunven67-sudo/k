// State registry. Each feature area exports its state class; main.js registers them all.
// `?state=<name>` in the URL jumps straight to a state (dev / testing).

import { BootState } from './boot.js';
import { MenuState } from './menu.js';
import { CreditsState } from './credits.js';
import { SandboxState } from './sandbox.js';
import { CreatorState } from './creator.js';
import { WorldState } from './world.js';

export const STATES = {
  boot: BootState,
  menu: MenuState,
  credits: CreditsState,
  sandbox: SandboxState,
  creator: CreatorState,
  world: WorldState,
};

export const FIRST_STATE = 'boot';
