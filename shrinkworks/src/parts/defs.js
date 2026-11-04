// Every part in the game, by id.
import { BUILD } from './defs-build.js';
import { MECH } from './defs-mech.js';
import { LOGIC } from './defs-logic.js';
import { SHRINK } from './defs-shrink.js';

export const CATS = ['Tools', 'Real stuff', 'Blocks', 'Moving', 'Power', 'Control', 'Sci-Fi', 'Effects'];
export const DEFS = {};
for (const d of [...SHRINK.filter((x) => x.cat === 'Tools'), ...SHRINK.filter((x) => x.cat === 'Real stuff'), ...BUILD, ...MECH, ...LOGIC, ...SHRINK.filter((x) => x.cat !== 'Tools' && x.cat !== 'Real stuff')]) {
  if (d.id === 'strapchair' || d.id === 'brain') d.hidden = true;
  d.props = d.props || [];
  if (!d.halfH) d.halfH = (p) => p.size.y / 2;
  DEFS[d.id] = d;
}
export const LIST = Object.values(DEFS).filter((d) => !d.hidden);
