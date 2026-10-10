// Table games (lane B). STUB — replaced by the tables lane (see ../CONTRACT.md).
import { stubStation } from '../_stub.js';

export function createBlackjackTable(opts) {
  return stubStation({ ...opts, w: 2.4, d: 1.3, h: 0.76, color: 0x1f5a35, seats: 7 });
}

export function createRouletteTable(opts) {
  return stubStation({ ...opts, w: 3.0, d: 1.4, h: 0.76, color: 0x1f5a35, seats: 6 });
}
