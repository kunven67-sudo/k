// Every part in the game, by id.
import { BUILD } from './defs-build.js';
import { MECH } from './defs-mech.js';
import { LOGIC } from './defs-logic.js';

const PEOPLE = [
  { id: 'human_mike', name: 'Mike', cat: 'People', desc: 'A grown man in work gear. Has a brain and a heart you can change.', person: 'soldier', size: [0.6, 1.8, 0.4] },
  { id: 'human_mia', name: 'Mia', cat: 'People', desc: 'A grown woman. Has a brain and a heart you can change.', person: 'michelle', size: [0.6, 1.7, 0.4] },
  { id: 'human_ray', name: 'Ray', cat: 'People', desc: 'A grown man in a suit and a cowboy hat. Has a brain and a heart you can change.', person: 'rpm', size: [0.6, 1.8, 0.4] },
  { id: 'dummy', name: 'Crash Dummy', cat: 'People', desc: 'A crash test dummy. Strap it to anything. Its arms, legs and head come off in big crashes.', person: 'dummy', size: [0.6, 1.8, 0.4] }
];

export const CATS = ['Blocks', 'Moving', 'Power', 'Control', 'Sci-Fi', 'Effects', 'People'];
export const DEFS = {};
for (const d of [...BUILD, ...MECH, ...LOGIC, ...PEOPLE]) {
  d.props = d.props || [];
  d.halfH = d.halfH || ((p) => p.size.y / 2);
  DEFS[d.id] = d;
}
export const LIST = Object.values(DEFS).filter((d) => !d.hidden);
