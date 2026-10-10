// Player-visible text in the downtown slice (signage). Registered through i18n like any UI.
//
// Signage is physical text in a real US city, so the "most realistic" rule keeps proper names and
// printed English on signs; Spanish entries exist for generic words where Reno businesses really
// do show both (and so a language switch never shows raw keys).

import { i18n } from '../../core/i18n.js';

const en = {
  'arch.name': 'RENO',
  'arch.slogan': 'THE BIGGEST LITTLE CITY IN THE WORLD',
  'eldo.name': 'ELDORADO',
  'eldo.sub': 'RESORT · CASINO',
  'eldo.led1': 'ELDORADO',
  'eldo.led2': 'LOOSE SLOTS',
  'eldo.led3': 'BUFFET OPEN LATE',
  'eldo.led4': 'LIVE SHOWS NIGHTLY',
  'eldo.led5': 'WIN $1,000,000',
  'eldo.entrance': 'ENTRANCE',
  'legacy.name': 'SILVER LEGACY',
  'legacy.sub': 'RESORT CASINO',
  'circus.name': 'CIRCUS CIRCUS',
  'bowling.name': 'NATIONAL BOWLING STADIUM',
  'harrahs.name': "HARRAH'S",
  'parking': 'PUBLIC PARKING',
  'parking.rate': '$5 ALL DAY',
  'souvenir': 'RENO SOUVENIRS',
  'souvenir.sub': 'T-SHIRTS · GIFTS · CANDY',
  'pawn.dt': 'SILVER STATE PAWN',
  'pawn.sub': 'GOLD · GUNS · GUITARS · LOANS',
  'chapel': 'Silver Bells Wedding Chapel',
  'chapel.sub': 'WEDDINGS 24 HRS · NO WAITING',
  'closed.club': 'LUCKY STRIKE CLUB',
  'closed.lease': 'FOR LEASE',
  'hotel.sierra': 'HOTEL SIERRA',
  'tattoo': 'INK SLINGERS TATTOO',
  'smoke': 'SMOKE & VAPE',
  'checks': 'CHECKS CASHED',
  'checks.sub': 'PAYDAY LOANS · MONEY ORDERS',
  'market': 'ROW MARKET',
  'market.sub': 'BEER · WINE · ICE · ATM',
  'bar.roundup': 'ROUND-UP BAR',
  'liquor': 'LIQUOR',
  'liquor.store': '4TH ST LIQUOR & DELI',
  'bail': 'A-1 BAIL BONDS',
  'bail.sub': '24 HRS · SE HABLA ESPAÑOL',
  'pawn.strip': '4TH ST PAWN',
  'pawn.strip.sub': 'WE BUY GOLD',
  'diner': 'SUNRISE DINER',
  'diner.open': 'OPEN 24 HRS',
  'diner.sub': 'BREAKFAST ALL DAY',
  'motel': 'MOTEL',
  'vacancy': 'VACANCY',
  'novacancy': 'NO',
  'motel.rose': 'Desert Rose',
  'motel.spur': 'Lucky Spur',
  'motel.dollar': 'Silver Dollar',
  'motel.tv': 'COLOR TV · A/C',
  'motel.weekly': 'WEEKLY RATES',
  'notrespass': 'NO TRESPASSING',
  'vacant.sale': 'FOR SALE · COMMERCIAL LOT',
  'open': 'OPEN',
  'atm': 'ATM',
};

const es = {
  ...en,
  'eldo.entrance': 'ENTRADA',
  'open': 'OPEN',
};

i18n.register('reno', { en, es });
