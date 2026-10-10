// Slot math registry: one entry per theme, wrapping the PAR sheets so the machines can spin with
// the casino-grade RNG (fairRandom) without knowing which engine a theme uses.
//
//   const game = slotMath('wild-west');   game.kind === 'video' | 'stepper'
//   game.spin({ coins | lines, betPerLine })  → result (see engine.js / classic.js)

import { fairRandom } from '../../../core/rng.js';
import { compileTheme, playSpin, coinFace } from './engine.js';
import { CLASSIC_PARS, compileClassic, spinClassic } from './classic.js';
import { VIDEO_PARS, DRAGON_JACKPOTS } from './themes.js';

/** The game RNG: the platform CSPRNG (never the seeded Rng) for every outcome. */
export const fairRng = { random: fairRandom, int: (n) => Math.floor(fairRandom() * n) };

const cache = new Map();

export function videoMath(theme) {
  let m = cache.get(theme);
  if (!m) {
    m = compileTheme(VIDEO_PARS[theme]);
    cache.set(theme, m);
  }
  return m;
}

export function classicMath(variant = 'single') {
  const key = `classic-${variant}`;
  let m = cache.get(key);
  if (!m) {
    m = compileClassic(CLASSIC_PARS[variant]);
    cache.set(key, m);
  }
  return m;
}

export const spinVideo = (theme) => playSpin(videoMath(theme), fairRng, { detail: true });
export const spinStepper = (variant, coins) => spinClassic(classicMath(variant), fairRng, coins);
export const pearlFace = () => coinFace(videoMath('dragon'), fairRng);

export { VIDEO_PARS, CLASSIC_PARS, DRAGON_JACKPOTS };
