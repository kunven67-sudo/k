// RouletteTable — placeholder until the real table lands (keeps lane A's floor working).
import { stubStation } from '../_stub.js';

export class RouletteTable {}

export function createRouletteTable(opts) {
  return stubStation({ ...opts, w: 3.0, d: 1.4, h: 0.76, color: 0x1f5a35, seats: 6 });
}
