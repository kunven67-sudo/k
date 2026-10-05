// State registry. Each feature area exports its state class; main.js registers them all.
// `?state=<name>` in the URL jumps straight to a state (dev / testing).

import { SandboxState } from './sandbox.js';

export const STATES = {
  sandbox: SandboxState,
};

export const FIRST_STATE = 'sandbox';
