// Blackjack rules — pure logic shared by the 3D table and the node self-test (no three.js here).
//
// Cards are integers 0..51: rank = c % 13 (0 = A, 1 = 2 … 9 = 10, 10 = J, 11 = Q, 12 = K),
// suit = (c / 13) | 0 (0 spades, 1 hearts, 2 diamonds, 3 clubs).
//
// House rules (CONTRACT "Game rules"): 6-deck shoe with a cut card at ~75 %, burn one card after
// every shuffle, dealer hits soft 17 ($5 table) or stands on all 17s ($25 table), blackjack pays
// 3:2, double on any two cards, double after split, split to 4 hands, split aces receive one card
// each (no re-splitting aces, 21 on a split ace is not a blackjack), no surrender, insurance and
// even money on a dealer ace, US hole card with a peek for blackjack under an ace or a ten.
//
// Every shuffle uses fairShuffle (crypto RNG). The shoe keeps its real order and position, so
// the Hi-Lo count genuinely works (DESIGN §9 "blackjack (card counting)").

import { fairShuffle, fairRandom } from '../../../core/rng.js';

export const SUITS = ['S', 'H', 'D', 'C'];
export const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const rankOf = (c) => c % 13;
export const suitOf = (c) => (c / 13) | 0;
/** Blackjack point value of a card (ace = 11 here; totals demote it to 1 when needed). */
export const pointOf = (c) => {
  const r = c % 13;
  return r === 0 ? 11 : r >= 9 ? 10 : r + 1;
};
/** Hi-Lo tag: 2–6 = +1, 7–9 = 0, tens and aces = −1. */
export const hiLo = (c) => {
  const p = pointOf(c);
  return p <= 6 ? 1 : p >= 10 ? -1 : 0;
};
export const cardName = (c) => `${RANK_LABELS[rankOf(c)]}${SUITS[suitOf(c)]}`;

export const DEFAULT_RULES = {
  decks: 6,
  penetration: 0.75,
  h17: true,
  blackjackPays: 1.5,
  das: true,
  maxHands: 4,
  resplitAces: false,
  hitSplitAces: false,
  peek: true,
};

/** { total, soft } — soft when an ace still counts as 11. */
export function handTotal(cards) {
  let t = 0;
  let aces = 0;
  for (const c of cards) {
    const p = pointOf(c);
    if (p === 11) aces++;
    t += p;
  }
  while (t > 21 && aces) {
    t -= 10;
    aces--;
  }
  return { total: t, soft: aces > 0 };
}

export const isBlackjack = (cards, fromSplit = false) => !fromSplit && cards.length === 2 && handTotal(cards).total === 21;
export const isBust = (cards) => handTotal(cards).total > 21;
export const isPair = (cards) => cards.length === 2 && pointOf(cards[0]) === pointOf(cards[1]);

/** Dealer drawing rule. */
export function dealerShouldHit(cards, h17) {
  const { total, soft } = handTotal(cards);
  if (total < 17) return true;
  if (total === 17 && soft && h17) return true;
  return false;
}

// ---- the shoe -------------------------------------------------------------------------------

export class Shoe {
  constructor({ decks = 6, penetration = 0.75, shuffle = fairShuffle, random = fairRandom } = {}) {
    this.decks = decks;
    this.penetration = penetration;
    this._shuffle = shuffle;
    this._random = random;
    this.cards = [];
    this.pos = 0;
    this.cutAt = 0;
    this.cutReached = false;
    this.running = 0; // Hi-Lo running count of every card seen (burns are unseen)
    this.discards = 0;
    this.shuffle();
  }

  /** Fresh shuffle; the cut card goes in at ~75 % (± a few cards, as a dealer would place it). */
  shuffle() {
    const n = this.decks * 52;
    this.cards = new Array(n);
    for (let i = 0; i < n; i++) this.cards[i] = i % 52;
    this._shuffle(this.cards);
    this.pos = 0;
    const jitter = (this._random() - 0.5) * 0.06;
    this.cutAt = Math.round(n * (this.penetration + jitter));
    this.cutReached = false;
    this.running = 0;
    this.discards = 0;
    this.shuffles = (this.shuffles || 0) + 1;
  }

  /** The burn card after a shuffle (goes straight to the discard rack, unseen). */
  burn() {
    const c = this.cards[this.pos++];
    this.discards++;
    return c;
  }

  /** Next card. `seen` = dealt face up (counts toward the running count when revealed). */
  draw() {
    if (this.pos >= this.cards.length) {
      // Never happens with a 75 % cut, but a giant split-fest at a full table must not crash.
      this.shuffle();
      this.burn();
    }
    const c = this.cards[this.pos++];
    if (this.pos >= this.cutAt) this.cutReached = true;
    return c;
  }

  /** Call when a card becomes visible to the table (dealt face up or the hole card turned). */
  reveal(c) {
    this.running += hiLo(c);
  }

  get remaining() {
    return this.cards.length - this.pos;
  }

  get decksRemaining() {
    return this.remaining / 52;
  }

  get trueCount() {
    return this.running / Math.max(0.5, this.decksRemaining);
  }

  /** 0..1 of the shoe dealt (for the discard-rack height). */
  get dealtFraction() {
    return this.pos / this.cards.length;
  }
}

// ---- basic strategy (6 decks, DAS, no surrender) --------------------------------------------
// Dealer up value: 2..10, 11 = ace. Returns 'H' | 'S' | 'D' | 'P' (D already falls back when a
// double isn't allowed: 'Ds' → S, 'Dh' → H).

const UP = (v) => v - 2; // index 0..9 for 2..A
// Hard totals 5..17+ vs 2..A
const HARD = {
  8: 'HHHHHHHHHH',
  9: 'HDDDDHHHHH',
  10: 'DDDDDDDDHH',
  11: 'DDDDDDDDDd', // d = double vs A on H17, hit on S17
  12: 'HHSSSHHHHH',
  13: 'SSSSSHHHHH',
  14: 'SSSSSHHHHH',
  15: 'SSSSSHHHHH',
  16: 'SSSSSHHHHH',
};
// Soft totals (A + x) 13..20 vs 2..A. 'X' = double else stand; 'Y' = double on H17 else stand.
const SOFT = {
  13: 'HHHDDHHHHH',
  14: 'HHHDDHHHHH',
  15: 'HHDDDHHHHH',
  16: 'HHDDDHHHHH',
  17: 'HDDDDHHHHH',
  18: 'ZXXXXSSHHH', // Z = double-else-stand on H17, stand on S17
  19: 'SSSSYSSSSS',
  20: 'SSSSSSSSSS',
};
// Pairs by card point (2..11) vs 2..A; 'P' split, otherwise fall through to totals.
const PAIRS = {
  2: 'PPPPPPHHHH',
  3: 'PPPPPPHHHH',
  4: 'HHHPPHHHHH',
  5: '----------',
  6: 'PPPPPHHHHH',
  7: 'PPPPPPHHHH',
  8: 'PPPPPPPPPP',
  9: 'PPPPPSPPSS',
  10: 'SSSSSSSSSS',
  11: 'PPPPPPPPPP',
};

/**
 * Basic strategy decision.
 * @param {number[]} cards player hand
 * @param {number} upCard dealer up card (0..51)
 * @param {{h17?:boolean, canDouble?:boolean, canSplit?:boolean}} o
 */
export function basicStrategy(cards, upCard, { h17 = true, canDouble = true, canSplit = true } = {}) {
  const up = pointOf(upCard);
  const i = UP(up);
  if (canSplit && isPair(cards)) {
    const code = PAIRS[pointOf(cards[0])][i];
    if (code === 'P') return 'P';
  }
  const { total, soft } = handTotal(cards);
  if (soft && total <= 12) return 'H'; // A-A that can't be split (soft 12)
  if (soft && total >= 13 && total <= 20 && cards.length >= 2) {
    const code = SOFT[total][i];
    switch (code) {
      case 'H': return 'H';
      case 'S': return 'S';
      case 'D': return canDouble ? 'D' : 'H';
      case 'X': return canDouble ? 'D' : 'S';
      case 'Y': return h17 && canDouble ? 'D' : 'S';
      case 'Z': return h17 ? (canDouble ? 'D' : 'S') : 'S';
    }
  }
  if (soft && total >= 21) return 'S';
  if (total >= 17) return 'S';
  if (total <= 8) return 'H';
  const code = HARD[total][i];
  if (code === 'D') return canDouble ? 'D' : 'H';
  if (code === 'd') return h17 && canDouble ? 'D' : 'H';
  return code;
}

// ---- settlement -----------------------------------------------------------------------------

/**
 * What a finished hand returns to the player (stake included): 0 lose, bet push, 2·bet win,
 * (1 + pays)·bet natural. `hand` = { cards, bet, fromSplit }.
 */
export function settleHand(hand, dealerCards, rules = DEFAULT_RULES) {
  const p = handTotal(hand.cards).total;
  const playerBJ = isBlackjack(hand.cards, hand.fromSplit);
  const dealerBJ = isBlackjack(dealerCards);
  if (playerBJ && dealerBJ) return { result: 'push', returned: hand.bet };
  if (playerBJ) return { result: 'blackjack', returned: hand.bet * (1 + rules.blackjackPays) };
  if (dealerBJ) return { result: 'lose', returned: 0 };
  if (p > 21) return { result: 'bust', returned: 0 };
  const d = handTotal(dealerCards).total;
  if (d > 21 || p > d) return { result: 'win', returned: hand.bet * 2 };
  if (p === d) return { result: 'push', returned: hand.bet };
  return { result: 'lose', returned: 0 };
}

/** Which actions are legal for this hand right now. */
export function legalActions(hand, handsCount, rules = DEFAULT_RULES) {
  const { total } = handTotal(hand.cards);
  const two = hand.cards.length === 2;
  const done = total >= 21 || hand.doubled || (hand.splitAces && !rules.hitSplitAces);
  if (done) return { hit: false, stand: false, double: false, split: false };
  const pair = isPair(hand.cards);
  const acePair = pair && pointOf(hand.cards[0]) === 11;
  return {
    hit: true,
    stand: true,
    double: two && (!hand.fromSplit || rules.das),
    split: two && pair && handsCount < rules.maxHands && (!acePair || !hand.splitAces || rules.resplitAces),
  };
}

// ---- headless round (used by the self-test and NPC bookkeeping) -------------------------------

/**
 * Play one complete round for one basic-strategy player betting 1 unit. Returns the net result
 * in units. `decide(hand, up, legal)` may override the strategy (personality mistakes).
 */
export function simulateRound(shoe, rules = DEFAULT_RULES, decide = null) {
  if (shoe.cutReached) {
    shoe.shuffle();
    shoe.burn();
  }
  const p = [shoe.draw()];
  const d = [shoe.draw()];
  p.push(shoe.draw());
  d.push(shoe.draw());
  const up = d[0];
  // Peek: the hand ends at once on a dealer natural (insurance declined — basic strategy).
  const dealerBJ = isBlackjack(d);
  const playerBJ = isBlackjack(p);
  if (dealerBJ || playerBJ) {
    if (dealerBJ && playerBJ) return 0;
    if (dealerBJ) return -1;
    return rules.blackjackPays;
  }
  const hands = [{ cards: p, bet: 1, fromSplit: false, splitAces: false, doubled: false }];
  for (let h = 0; h < hands.length; h++) {
    const hand = hands[h];
    if (hand.cards.length === 1) hand.cards.push(shoe.draw()); // second card after a split
    for (;;) {
      const legal = legalActions(hand, hands.length, rules);
      if (!legal.hit) break;
      const a = decide ? decide(hand, up, legal) : basicStrategy(hand.cards, up, { h17: rules.h17, canDouble: legal.double, canSplit: legal.split });
      if (a === 'S') break;
      if (a === 'H') {
        hand.cards.push(shoe.draw());
        continue;
      }
      if (a === 'D' && legal.double) {
        hand.bet *= 2;
        hand.doubled = true;
        hand.cards.push(shoe.draw());
        break;
      }
      if (a === 'P' && legal.split) {
        const aces = pointOf(hand.cards[0]) === 11;
        const second = { cards: [hand.cards.pop()], bet: hand.bet, fromSplit: true, splitAces: aces, doubled: false };
        hand.fromSplit = true;
        hand.splitAces = aces;
        hand.cards.push(shoe.draw());
        hands.splice(h + 1, 0, second);
        continue;
      }
      hand.cards.push(shoe.draw()); // illegal choice → hit
    }
  }
  const live = hands.some((h) => !isBust(h.cards));
  if (live) while (dealerShouldHit(d, rules.h17)) d.push(shoe.draw());
  let net = 0;
  for (const h of hands) net += settleHand(h, d, rules).returned - h.bet;
  return net;
}
