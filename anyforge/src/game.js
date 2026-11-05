// Shared game state every system can reach (filled in by main.js), so modules do not import each other in circles.
export const game = {
  settings: {
    breaking: true, gore: 'some', gravity: 'earth', sky: 'day', quality: 'auto', grid: 0.25, volume: 0.8,
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
export const GRAVITY = { earth: -9.81, moon: -1.62, mars: -3.71, low: -4, zero: 0, heavy: -20 };
