// Shared game state every system can reach (filled in by main.js), so modules do not import each other in circles.
export const game = {
  settings: {
    breaking: true, gore: 'off', damage: true, gravity: 'earth', sky: 'day', quality: 'auto', grid: 0.25, volume: 0.8,
    music: 0, sensitivity: 1, invertY: false, fov: 72, snapTurn: true, turnAngle: 30, vrSmoothSpeed: 3, vrHeight: 0,
    fly: false, hints: true
  },
  inVR: false,
  paused: false,     // a menu is open
  toast: () => {},
  sound: () => {},
  fx: null,
  player: null,
  humans: null,
  seatOf: null       // the seat you sit in (or null)
};
// SHRINKWORKS world units: 1 unit = 10 cm. Parts are hand-sized (a 1-unit block is a 10 cm cube) and the kitchen is
// built in the same units, so gravity and every push is 10x bigger in numbers (= real gravity in real centimeters).
export const U = 10;
export const FORCE = U;
export const GRAVITY = { earth: -9.81 * U, moon: -1.62 * U, mars: -3.71 * U, low: -4 * U, zero: 0, heavy: -20 * U };
