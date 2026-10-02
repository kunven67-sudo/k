// =====================================================================
// HUD — health, stamina, mana, hunger / sleep / warmth, compass, the
// objective, boss health, hotbar, the "E" prompt, and screen effects.
// =====================================================================
const Hud = {
  bossA: null, t: 0, near: null, last: {},
  boss(a) { this.bossA = a; const el = $('#bossBar'); if (!a || a.dead) { el.hidden = true; return; } el.hidden = false; $('#bossName').textContent = a.d.name; $('#bossFill').style.width = (100 * a.hp / a.maxHp).toFixed(1) + '%'; },
  set(id, prop, val) { const k = id + prop; if (this.last[k] === val) return; this.last[k] = val; const el = document.getElementById(id); if (prop === 'text') el.textContent = val; else if (prop === 'html') el.innerHTML = val; else el.style[prop] = val; },
  update(dt) {
    const p = G.p; if (!p || !G.save) return; const S = G.save, sv = S.surv;
    this.set('hpFill', 'width', (100 * Math.max(0, p.hp) / p.maxHp).toFixed(1) + '%'); this.set('hpTxt', 'text', Math.ceil(Math.max(0, p.hp)) + ' / ' + p.maxHp);
    this.set('stFill', 'width', (100 * p.stam / p.maxStam).toFixed(1) + '%'); this.set('mpFill', 'width', (100 * p.mana / p.maxMana).toFixed(1) + '%');
    $('#horseRow').hidden = !p.mounted; if (p.mounted) this.set('hsFill', 'width', (p.mounted.stam == null ? 100 : p.mounted.stam).toFixed(0) + '%');
    if (this.bossA) { if (this.bossA.dead || !ACTORS.includes(this.bossA)) this.boss(null); else this.set('bossFill', 'width', (100 * this.bossA.hp / this.bossA.maxHp).toFixed(1) + '%'); }
    // screen effects
    const fx = (id, v) => this.set(id, 'opacity', v.toFixed(2));
    this.hurtK = Math.max(0, (this.hurtK || 0) - dt * 1.6); fx('hurtV', this.hurtK); fx('lowV', p.hp < p.maxHp * 0.25 && !p.dead ? 0.8 : 0);
    fx('coldV', clamp((30 - sv.warmth) / 30, 0, 1) * 0.9); fx('senseV', SENSE.on ? 0.85 : 0);
    this.flashK = Math.max(0, (this.flashK || 0) - dt * 2.5); fx('flashV', this.flashK); if (this.flashK > 0) this.set('flashV', 'background', this.flashCol);
    $('#cross').className = p.drawing ? 'bow' : ''; if (p.drawing) $('#cross').style.transform = 'scale(' + (1.6 - p.draw * 0.8).toFixed(2) + ')'; else $('#cross').style.transform = '';
    this.t -= dt; if (this.t > 0) return; this.t = 0.12; // the rest updates ~8 times a second
    this.set('clockT', 'text', Clock.label());
    const bm = Clock.bloodMoon(), nb = Clock.nextBloodIn(), free = S.story.flags.free;
    this.set('moonT', 'text', free ? 'The moon is white' : bm ? '☾ THE BLOOD MOON' : nb === 0 ? '☾ Blood moon tonight' : nb === 1 ? '☾ Blood moon tomorrow night' : '☾ Blood moon in ' + nb + ' nights');
    $('#moonT').className = bm ? 'blood' : '';
    const m = MAIN[MAIN_IDX[S.story.step]]; this.set('goal', 'text', m ? (m.id === 'done' ? '' : m.goal) : '');
    // survival and status
    const lvl = (v, inv) => { const x = inv ? 100 - v : v; return x < 15 ? 'bad' : x < 35 ? 'warn' : ''; };
    let h = `<span class="${lvl(sv.hunger)}">🍖 ${Math.round(sv.hunger)}</span><span class="${lvl(sv.fatigue, 1)}">💤 ${Math.round(100 - sv.fatigue)}</span><span class="${lvl(sv.warmth)}">🔥 ${Math.round(sv.warmth)}</span>`;
    const P = S.player; if (P.oil) h += `<span class="tag">${esc(P.oil.name)} ${P.oil.hits}</span>`; if (p.poison > 0) h += '<span class="tag bad">Poisoned</span>'; if (p.burn > 0) h += '<span class="tag bad">Burning</span>'; if (sv.owlT > 0) h += '<span class="tag">Owl\'s Eye</span>'; if (SENSE.on) h += '<span class="tag">Sense</span>';
    this.set('surv', 'html', h);
    // hotbar
    const pots = invCount('draught') + invCount('greater_draught'), food = P.inv.filter((e) => ITEMS[e.id].type === 'food').reduce((a, e) => a + e.n, 0), ar = P.eq.arrow || 'arrow';
    const spell = (k, key, icon) => { const S2 = SPELLS[k], cd = p.cd[k] / S2.cd; return `<div class="k ${p.mana < S2.mana ? 'off' : ''}"><em>${key}</em>${icon}<s>${S2.mana}</s>${cd > 0 ? `<div class="cd" style="height:${(cd * 100).toFixed(0)}%"></div>` : ''}</div>`; };
    this.set('hotbar', 'html', `<div class="k ${pots ? '' : 'off'}"><em>Q</em>❤<s>${pots}</s></div><div class="k ${food ? '' : 'off'}"><em>1</em>🍖<s>${food}</s></div><div class="k ${P.eq.bow ? '' : 'off'}"><em>2</em>${ar === 'fire_arrow' ? '🔥' : ar === 'silver_arrow' ? '⚪' : '➶'}<s>${invCount(ar)}</s></div>${spell('fire', 3, '🔥')}${spell('lightning', 4, '⚡')}${spell('ice', 5, '❄')}`);
    this.compass(); this.prompt();
  },
  compass() {
    const p = G.p, el = $('#compassIn'); if (G.area !== 'outside') { this.set('compassIn', 'html', '<div class="m card" style="left:50%">' + esc(Interiors.cur() ? Interiors.cur().name : '') + '</div>'); return; }
    const W = el.parentNode.clientWidth || 500, fov = Math.PI * 0.9, items = [];
    const add = (bear, cls, txt, sub) => { const d = angDiff(p.yaw, bear); if (Math.abs(d) > fov / 2) return; items.push(`<div class="m ${cls}" style="left:${((0.5 - d / fov) * W).toFixed(0)}px">${txt}${sub ? '<small>' + sub + '</small>' : ''}</div>`); };
    for (const [b, n] of [[Math.PI, 'N'], [Math.PI / 2, 'E'], [0, 'S'], [-Math.PI / 2, 'W']]) add(b, 'card', n);
    for (const [b, n] of [[Math.PI * 0.75, 'NE'], [Math.PI * 0.25, 'SE'], [-Math.PI * 0.25, 'SW'], [-Math.PI * 0.75, 'NW']]) add(b, '', '·');
    const bearTo = (x, z) => Math.atan2(x - p.x, z - p.z), dist = (x, z) => Math.round(Math.hypot(x - p.x, z - p.z));
    const mk = Story.marker(); if (mk) add(bearTo(mk[0], mk[1]), 'obj', '◆', dist(mk[0], mk[1]) + 'm');
    for (const c of G.save.contracts.active) { if (c.done) continue; if (c.kind === 'lair') { const t = c.seen ? c.lair : c.area; add(bearTo(t[0], t[1]), 'con', '✖', dist(t[0], t[1]) + 'm'); } }
    for (const c of CAMPS) { const d = dist(c.x, c.z); if (d < 260 && d > 12) add(bearTo(c.x, c.z), '', '⛺', d + 'm'); }
    if (G.horse && !p.mounted) { const d = dist(G.horse.x, G.horse.z); if (d > 15) add(bearTo(G.horse.x, G.horse.z), 'horse', '🐴', d + 'm'); }
    this.set('compassIn', 'html', items.join(''));
  },
  prompt() { const t = findInteract(); this.near = t; if (!t || UI.blocking() || G.p.dead) { $('#prompt').hidden = true; return; } $('#prompt').hidden = false; this.set('prompt', 'html', `<kbd>${TOUCH.on ? 'E' : 'E'}</kbd>${esc(t.label)}`); },
};
// ---------- what can you interact with right now? ----------
function findInteract() {
  const p = G.p; if (!p || p.dead) return null; let best = null, bd = 1e9; const [fx, fz] = fwdOf(p.yaw);
  const consider = (x, z, r, o) => { const d = Math.hypot(x - p.x, z - p.z); if (d > r) return; const facing = d < 0.8 ? 1 : ((x - p.x) * fx + (z - p.z) * fz) / d; const score = d - facing * 1.2; if (score < bd) { bd = score; best = o; } };
  if (p.mounted) { if (!p.mounted || Math.abs(p.horseSpeed) > 6) return null; return { label: 'Get off the horse', kind: 'dismount' }; }
  for (const e of WORLD.interact) { if ((e.area || 'outside') !== G.area) continue; if (Math.abs(e.y - p.y) > 4) continue; consider(e.x, e.z, e.r, e); }
  for (const a of ACTORS) {
    if (a.kind === 'npc' && !a.indoors && !a.dead) consider(a.x, a.z, 2.8, { label: 'Talk to ' + a.name + (a.role && a.person !== 'folk' ? ' (' + a.role + ')' : ''), kind: 'talk', a });
    else if (a.kind === 'horse' && G.area === 'outside') consider(a.x, a.z, 3, { label: 'Ride ' + (G.save.horse.name || 'your horse'), kind: 'mount', a });
    else if (a.dead && a.loot && (a.loot.length || (hasMut('ghoul') && !a.eaten && a.d.family !== 'animal'))) consider(a.x, a.z, 3, { label: (a.d.family === 'animal' ? 'Skin the ' : 'Loot the ') + a.d.name.toLowerCase(), kind: 'loot', a });
  }
  if (G.area === 'outside') {
    for (const h of WORLD.herbs) { if (h.picked) continue; if (Math.abs(h.x - p.x) > 2.5 || Math.abs(h.z - p.z) > 2.5) continue; consider(h.x, h.z, 2.2, { label: 'Pick ' + HERB_TYPES[h.type].name, kind: 'herb', h }); }
    if (SENSE.on) { const c = Clues.nearest(p.x, p.z, 3.5); if (c) consider(c.x, c.z, 3.5, { label: 'Examine', kind: 'clue', c }); }
  }
  return best;
}
function doInteract() {
  const t = findInteract(), p = G.p; if (!t || UI.blocking()) return;
  switch (t.kind) {
    case 'dismount': return dismount();
    case 'mount': return mountHorse(t.a);
    case 'talk': return Story.talk(t.a);
    case 'loot': {
      const a = t.a, got = {}; for (const id of a.loot) got[id] = (got[id] || 0) + 1; a.loot = [];
      for (const id in got) invAdd(id, got[id]); if (!Object.keys(got).length) UI.toast('Nothing useful.');
      if (hasMut('ghoul') && !a.eaten && a.d.family !== 'animal') { a.eaten = true; p.hp = Math.min(p.maxHp, p.hp + 25); G.save.surv.hunger = Math.min(100, G.save.surv.hunger + 15); Sfx.play('eat'); UI.toast('You feed. It tastes better than it should.', 'blood'); G.save.player.corruption = Math.min(100, G.save.player.corruption + 1); }
      Sfx.play(a.d.family === 'animal' ? 'gore' : 'pickup', { vol: 0.6 }); return;
    }
    case 'herb': { const h = t.h; setHerbPicked(h, true); G.save.herbs[h.id] = Clock.W().day; invAdd(h.type, chance(0.3) ? 2 : 1); Sfx.play('herb'); return; }
    case 'clue': return Clues.find(t.c);
    case 'home': return Interiors.enter('home');
    case 'exit': return Interiors.exit();
    case 'bed': return UI.sleepMenu('home');
    case 'alchemy': return UI.openCraft('alchemy', 'Alchemy Table');
    case 'trophies': return UI.openTrophies();
    case 'inn': case 'smith': case 'alchemist': case 'chapel': return UI.openShop({ inn: 'inn', smith: 'smith', alchemist: 'alchemist', chapel: 'chapel' }[t.kind]);
    case 'board': return UI.openBoard();
    case 'well': Sfx.play('drink'); p.stam = p.maxStam; UI.toast('Cold, sweet water.'); return;
    case 'camp': case 'fire': return UI.openCamp(t);
    case 'mill': return UI.toast(Story.step() === 'mill' ? 'The door hangs off one hinge. Use your hunter sense (R) to look for clues.' : 'The Old Mill. Nobody lives here now.');
    case 'altar': return Story.altar();
    case 'castlegate': return Story.gate();
    case 'keep': return Story.keep();
    case 'witch': { const m = NPCS.morwen; if (m) return Story.talk(m); return; }
    case 'shrine': return Story.shrine();
  }
}
