// Public API of the character module (ARCHITECTURE §6 "character").
//
//   import { createHuman, randomHumanParams, HUMAN_PARAM_SCHEMA } from '../character/index.js';
//   const h = createHuman(randomHumanParams(rng), { tier: engine.tier });
//   scene.add(h.root);           // feet at y = 0, facing +Z
//   h.update(dt);                // every frame

import { Human } from './human.js';
import { HUMAN_PARAM_SCHEMA, randomHumanParams, normalizeParams, defaultParams } from './schema.js';

export function createHuman(params = {}, opts = {}) {
  return new Human(params, opts);
}

export { Human, HUMAN_PARAM_SCHEMA, randomHumanParams, normalizeParams, defaultParams };
