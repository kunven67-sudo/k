// Positional table sounds. Uses the contract names (ARCHITECTURE §5: chip.*, card.*, roulette.*,
// cash.*) from src/audio/sfx/casino.js. Silent until the first gesture unlocks audio, never throws.
import * as THREE from 'three';
import { audio } from '../../../core/audio.js';
import '../../../audio/sfx/casino.js';

const _v = new THREE.Vector3();

/** Play `name` at a world position (Vector3 or {x,y,z}); jittered rate unless given. */
export function sfx(name, pos = null, { gain = 1, rate = null, loop = false, ref = 1.4 } = {}) {
  if (!audio.unlocked) return null;
  try {
    return audio.play(name, {
      bus: 'sfx',
      gain,
      loop,
      rate: rate ?? 0.93 + Math.random() * 0.14,
      position: pos ? { x: pos.x, y: pos.y, z: pos.z } : undefined,
      refDistance: ref,
      rolloff: 1.3,
      reverb: 0.35,
    });
  } catch {
    return null;
  }
}

/** World position of a local point of `obj` (convenience for sound placement). */
export function at(obj, x, y, z) {
  return obj.localToWorld(_v.set(x, y, z)).clone();
}
