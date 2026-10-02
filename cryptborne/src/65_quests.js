
// =====================================================================
// QUESTS — villagers hand out hunting, collecting, rescue and delivery jobs.
// =====================================================================
const NPC_PLACES = { pip: 'vale', wren: 'vale', oskar: 'vale', lena: 'vale', mara: 'vale', brom: 'vale', hollis: 'vale', tobin: 'vale', morra: 'mirefen', sigrid: 'frostpeak', rashid: 'sunscar', vey: 'saltmarrow', nell: 'saltmarrow', salty: 'saltmarrow' };
const NPC_NAMES = { pip: 'Pip', wren: 'Wren', oskar: 'Oskar', lena: 'Lena', mara: 'Mara', brom: 'Brom', hollis: 'Hollis', tobin: 'Elder Tobin', morra: 'Old Morra', sigrid: 'Sigrid', rashid: 'Rashid', vey: 'Captain Vey', nell: 'Nell', salty: 'Salty' };
const Quests = {
  Q: () => G.save.quests,
  placeOpen(map) { return map === 'vale' || ST().act >= 2; },
  // monsters a player of this level can reasonably hunt
  pool(giver) {
    const L = S().level, out = new Set(), gm = QUEST_GIVERS[giver].map;
    for (const d of DUNGEONS) if (!d.secret && d.lvl <= L + 2 && d.act <= ST().act && (gm === 'vale' || d.map === gm)) for (const [t] of d.mons) out.add(t);
    const R = REGIONS[gm]; if (R.zones) for (const z of R.zones) for (const [t] of z.types) out.add(t);
    return [...out].filter((t) => MON[t] && !MON[t].boss && !MON[t].mini);
  },
  make(giver) {
    const L = S().level, Q = this.Q(), likes = QUEST_GIVERS[giver].likes, id = 'q' + Date.now().toString(36) + randi(10, 99);
    let type = pick(likes);
    const pool = this.pool(giver); if (!pool.length) type = 'deliver';
    const q = { id, giver, type, have: 0 };
    if (type === 'hunt') { q.mon = pick(pool); const d = MON[q.mon]; q.need = randi(5, 9); q.reward = { coins: Math.round(((d.coins[0] + d.coins[1]) / 2) * q.need * 2 + 20 * L), xp: Math.round(d.xp * q.need * 0.5) }; }
    else if (type === 'collect') {
      const drops = []; for (const t of pool) for (const [it] of MON[t].drops || []) if (ITEMS[it].type === 'loot' && ITEMS[it].rarity === 'common') drops.push(it);
      if (!drops.length) { type = q.type = 'deliver'; } else { q.item = pick(drops); q.need = randi(3, 6); q.reward = { coins: Math.round(sellPrice(q.item) * q.need * 2.5 + 15 * L), xp: 12 * L }; }
    }
    if (type === 'rescue') {
      const ds = DUNGEONS.filter((d) => !d.secret && !d.final && d.lvl <= L + 1 && d.act <= ST().act && this.placeOpen(d.map));
      if (!ds.length) type = q.type = 'deliver'; else { const d = pick(ds); q.dungeon = d.id; q.name = pick(RESCUE_NAMES); q.rel = pick(RESCUE_RELS); q.need = 1; q.reward = { coins: 100 + 45 * d.lvl, xp: 40 * d.lvl, item: d.tier >= 6 ? 'super_potion' : 'big_potion' }; }
    }
    if (type === 'deliver') {
      const to = Object.keys(NPC_PLACES).filter((k) => k !== giver && k !== 'tobin' && this.placeOpen(NPC_PLACES[k]));
      q.to = pick(to); q.need = 1; const far = NPC_PLACES[q.to] !== QUEST_GIVERS[giver].map;
      q.reward = { coins: 50 + 25 * L + (far ? 80 : 0), xp: 20 * L };
    }
    return q;
  },
  offer(giver) { const Q = this.Q(); if (!Q.offers[giver] || !Q.offers[giver].type) Q.offers[giver] = this.make(giver); return Q.offers[giver]; },
  text(q) {
    switch (q.type) {
      case 'hunt': return `${MON[q.mon].name}s have been getting too close. Kill ${q.need} of them and I'll pay you ${q.reward.coins} coins.`;
      case 'collect': return `I need ${q.need} ${ITEMS[q.item].name}. Bring them to me and I'll pay you ${q.reward.coins} coins.`;
      case 'rescue': return `My ${q.rel} ${q.name} went into ${DUNGEON_BY_ID[q.dungeon].name} and never came back. Please find them! ${q.reward.coins} coins if you do.`;
      case 'deliver': return `Can you take this parcel to ${NPC_NAMES[q.to]} in ${REGIONS[NPC_PLACES[q.to]].name}? You'll get ${q.reward.coins} coins.`;
    }
    return '';
  },
  goal(q) {
    switch (q.type) {
      case 'hunt': return `Kill ${MON[q.mon].name}s: ${Math.min(q.have, q.need)} / ${q.need}`;
      case 'collect': return `Bring ${ITEMS[q.item].name}: ${Math.min(invCount(q.item), q.need)} / ${q.need}`;
      case 'rescue': return q.freed ? `${q.name} is safe. Tell ${NPC_NAMES[q.giver]}.` : `Find ${q.name} in ${DUNGEON_BY_ID[q.dungeon].name}`;
      case 'deliver': return `Bring the parcel to ${NPC_NAMES[q.to]} (${REGIONS[NPC_PLACES[q.to]].name})`;
    }
    return '';
  },
  done(q) { return q.type === 'hunt' ? q.have >= q.need : q.type === 'collect' ? invCount(q.item) >= q.need : q.type === 'rescue' ? !!q.freed : false; },
  accept(giver) {
    const Q = this.Q(), q = Q.offers[giver]; if (!q) return;
    if (Q.active.length >= 5) { UI.toast('You can have 5 quests at once. Finish one first.', 'bad'); return; }
    if (q.type === 'deliver' && invAdd('parcel', 1) > 0) { UI.toast('Your bag is full. Make room for the parcel.', 'bad'); return; }
    Q.active.push(q); delete Q.offers[giver]; Sfx.play('quest'); UI.toast('Quest accepted. Press J to see your journal.', 'good'); UI.hudDirty();
  },
  reward(q) {
    const r = q.reward; gainCoins(r.coins); gainXp(r.xp); if (r.item) invAdd(r.item, 1);
    this.Q().done++; this.Q().active = this.Q().active.filter((x) => x !== q);
    Sfx.play('quest'); UI.toast(`Quest complete! +${r.coins} coins, +${r.xp} XP${r.item ? ', ' + ITEMS[r.item].name : ''}`, 'gold'); saveGame(true);
  },
  turnIn(q) { if (q.type === 'collect') invTake(q.item, q.need); this.reward(q); },
  onKill(type) { for (const q of this.Q().active) if (q.type === 'hunt' && q.mon === type && q.have < q.need) { q.have++; if (q.have === q.need) UI.toast(`Quest done: go back to ${NPC_NAMES[q.giver]}`, 'good'); UI.hudDirty(); } },
  deliverTo(npcId) { const q = this.Q().active.find((x) => x.type === 'deliver' && x.to === npcId); if (!q) return false; if (invCount('parcel') < 1) { UI.toast('You lost the parcel... (it should be in your bag)', 'bad'); return false; } invTake('parcel', 1); this.reward(q); return true; },
  rescueFor(dungeonId) { return this.Q().active.find((x) => x.type === 'rescue' && x.dungeon === dungeonId && !x.freed); },
  marker(npcId) { // ! = new quest, ? = something to hand in
    const Q = this.Q();
    if (Q.active.some((q) => (q.giver === npcId && this.done(q)) || (q.type === 'deliver' && q.to === npcId))) return '?';
    if (QUEST_GIVERS[npcId] && !Q.active.some((q) => q.giver === npcId) && G.save.story.flags.hasMap) return '!';
    return null;
  },
};
