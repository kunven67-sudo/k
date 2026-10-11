// Shared game context, filled in by main.js. Lets modules talk without import cycles.
export const ctx = {
  scene: null,
  camera: null,
  renderer: null,
  fx: null,
  player: null,
  arena: null,
  hud: null,
  // hooks set by other modules
  detonate: null,        // (entity, delay) => void
  onEntityRemoved: null, // (entity) => void
};
