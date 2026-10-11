// Rapier physics world wrapper: fixed timestep, slow motion, collision groups.
import RAPIER from '@dimforge/rapier3d-compat';

export let R = null;
export let world = null;
export let eventQueue = null;

// Collision group bits.
export const G = { STATIC: 1, OBJECT: 2, DEBRIS: 4, PLAYER: 8, PROJECTILE: 16, GHOST: 32 };
export function groups(member, filter) { return (member << 16) | filter; }
export const GROUPS = {
  static: groups(G.STATIC, 0xffff),
  object: groups(G.OBJECT, 0xffff),
  debris: groups(G.DEBRIS, G.STATIC | G.OBJECT | G.DEBRIS | G.PLAYER | G.PROJECTILE),
  player: groups(G.PLAYER, G.STATIC | G.OBJECT | G.DEBRIS),
  projectile: groups(G.PROJECTILE, G.STATIC | G.OBJECT | G.DEBRIS),
};
// Filter for queries that should hit "real" things (not the player, not tiny debris).
export const QUERY_SOLID = groups(0xffff, G.STATIC | G.OBJECT);
export const QUERY_ALL = groups(0xffff, G.STATIC | G.OBJECT | G.DEBRIS);

export const STEP = 1 / 60;
export const physicsState = { timeScale: 1, targetTimeScale: 1, accumulator: 0, alpha: 0, simTime: 0 };

export async function initPhysics() {
  await RAPIER.init();
  R = RAPIER;
  world = new R.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = STEP;
  world.integrationParameters.numSolverIterations = 6;
  eventQueue = new R.EventQueue(true);
}

// Advance the simulation. `beforeStep(dt)` runs before each fixed step (forces, player, tools)
// and `afterStep(dt)` right after it (events, breaking).
export function stepPhysics(realDt, beforeStep, afterStep) {
  const s = physicsState;
  s.timeScale += (s.targetTimeScale - s.timeScale) * Math.min(1, realDt * 6);
  s.accumulator += Math.min(realDt, 0.1);
  let steps = 0;
  // Each step always covers STEP of *real* time; slow motion shrinks the simulated dt,
  // which keeps motion smooth instead of stepping less often.
  while (s.accumulator >= STEP && steps < 4) {
    const dt = STEP * s.timeScale;
    world.timestep = dt;
    beforeStep(dt);
    world.step(eventQueue);
    s.simTime += dt;
    afterStep(dt);
    s.accumulator -= STEP;
    steps++;
  }
  if (steps === 4) s.accumulator = 0;
  s.alpha = s.accumulator / STEP;
  return steps;
}
