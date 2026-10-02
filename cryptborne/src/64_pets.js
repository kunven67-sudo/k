
// =====================================================================
// PETS — follow you, fight with you, and level up from your kills.
// =====================================================================
const PET_SPR = {
  raven: [spr(['..........', '...kk.....', '..k11k....', '.k1e11k...', 'k11111kkk.', '.k1111111k', '..k111111.', '...k.k....'], { k: '#0a0610', 1: '#2a2436', e: '#f2c13a' }),
    spr(['.k......k.', 'k1k....k1k', 'k11k..k11k', '.k11kk11k.', '..k1e11k..', '..k1111k..', '...k11k...', '....kk....'], { k: '#0a0610', 1: '#2a2436', e: '#f2c13a' })],
};
const Pets = {
  level(id) { const xp = S().pets.xp[id] || 0; let lv = 1; while (lv < 10 && xp >= petXpNeed(lv)) lv++; return lv; },
  spawn() {
    const id = S().pets.active; if (!id) { G.pet = null; return; }
    G.pet = { id, d: PETS[id], x: G.p.x - 14, y: G.p.y + 4, t: 0, atkCd: 1, face: 1, moving: false, walk: 0, target: null, lvl: this.level(id), hopT: 0, cawT: 3 };
  },
  dmg() { const p = G.pet; return (p.d.atk + p.d.per * (p.lvl - 1)) * (1 + 0.08 * (S().level - 1)); },
  onKill(xp) {
    if (!G.pet) return; const P = S().pets, id = G.pet.id;
    P.xp[id] = (P.xp[id] || 0) + Math.ceil(xp / 3);
    const lv = this.level(id); if (lv > G.pet.lvl) { G.pet.lvl = lv; UI.toast(`${PETS[id].name} reached level ${lv}!`, 'good'); Sfx.play('pet'); burst(G.pet.x, G.pet.y - 6, 16, '#f2c13a', 60); }
  },
  update(dt) {
    const pt = G.pet; if (!pt) return; const p = G.p; pt.t += dt; pt.atkCd -= dt; pt.cawT -= dt;
    const fly = pt.d.kind === 'fly' || pt.d.kind === 'ranged';
    if (dist(pt.x, pt.y, p.x, p.y) > 220) { pt.x = p.x - 12; pt.y = p.y + 4; }
    // pick a target near the hero
    if (!pt.target || pt.target.dead || dist(pt.target.x, pt.target.y, p.x, p.y) > 150) { pt.target = null; let bd = 120; for (const m of G.mons) { if (m.dead || !m.aggro) continue; const d = dist(m.x, m.y, p.x, p.y); if (d < bd) { bd = d; pt.target = m; } } }
    let gx = p.x - p.face * 16, gy = p.y + 6, spd = pt.d.spd;
    const t = pt.target;
    if (t) {
      if (pt.d.kind === 'ranged') { gx = p.x - p.face * 12; gy = p.y - 6; if (pt.atkCd <= 0) { pt.atkCd = pt.d.rate; const [cx, cy] = monCenter(t); const a = Math.atan2(cy - (pt.y - 14), cx - pt.x); fireProj({ x: pt.x, y: pt.y - 14, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, dmg: Math.round(this.dmg()), from: 'p', kind: 'fire', pet: true, burn: pt.lvl >= 5, life: 1.2, r: 3 }); Sfx.play('magic', pt); } }
      else { gx = t.x - Math.sign(t.x - pt.x || 1) * 8; gy = t.y; spd *= 1.2; if (dist(pt.x, pt.y, t.x, t.y) < t.w / 2 + 12 && pt.atkCd <= 0) { pt.atkCd = pt.d.rate; hurtMon(t, Math.round(this.dmg()), { pet: true }); pt.bite = 0.15; Sfx.play(pt.id === 'raven' ? 'squeak' : 'hit', pt); } }
    } else if (pt.id === 'raven' && G.area.kind === 'dungeon') { // ravens hunt for secrets
      const s = G.area.secret, notes = G.area.notes || [];
      let goal = null; if (s && !s.open) goal = { x: s.tx * 16 + 8, y: s.ty * 16 + 8 };
      for (const n of notes) if (!n.got && (!goal || dist(n.x, n.y, p.x, p.y) < dist(goal.x, goal.y, p.x, p.y))) goal = n;
      if (goal && dist(goal.x, goal.y, p.x, p.y) < 170) { gx = goal.x; gy = goal.y - 6; if (pt.cawT <= 0) { pt.cawT = 3; Sfx.voice('squeak', 0.6, pt); addText(goal.x, goal.y - 18, 'CAW!', '#f2c13a'); if (s && goal.x === s.tx * 16 + 8) s.revealed = true; } }
    }
    const dx = gx - pt.x, dy = gy - pt.y, d = Math.hypot(dx, dy);
    if (d > 6) {
      const mx = (dx / d) * spd * dt * Math.min(1, d / 30), my = (dy / d) * spd * dt * Math.min(1, d / 30);
      if (fly) { pt.x += mx; pt.y += my; } else { const e = { x: pt.x, y: pt.y, w: 6, h: 4 }; moveEntity(e, mx, my, false); pt.x = e.x; pt.y = e.y; }
      pt.moving = true; pt.walk += dt * 10; if (Math.abs(dx) > 1) pt.face = dx < 0 ? -1 : 1;
    } else pt.moving = false;
    if (pt.bite) pt.bite = Math.max(0, pt.bite - dt);
  },
  draw(c) {
    const pt = G.pet; if (!pt) return; const x = Math.round(pt.x), y = Math.round(pt.y);
    if (pt.id === 'slime') { const img = monFrames('slime')[0], s = 0.55 + pt.lvl * 0.02, bounce = pt.moving ? Math.abs(Math.sin(pt.t * 10)) * 3 : 0; shadow(c, x, y, 4); c.drawImage(pt.face < 0 ? flipped(img) : img, x - (16 * s) / 2, y - 13 * s - bounce, 16 * s, 13 * s); }
    else if (pt.id === 'wolf') { const fr = monFrames('wolf'), img = fr[pt.moving ? Math.floor(pt.walk * 0.6) % 2 : 0], s = 0.55 + pt.lvl * 0.05; shadow(c, x, y, 6); c.drawImage(pt.face < 0 ? flipped(img) : img, x - (20 * s) / 2, y - 12 * s - (pt.bite ? 2 : 0), 20 * s, 12 * s); }
    else if (pt.id === 'raven') { const img = PET_SPR.raven[Math.floor(pt.t * 8) % 2], yy = y - 16 + Math.sin(pt.t * 4) * 2; shadow(c, x, y, 3); c.drawImage(pt.face < 0 ? flipped(img) : img, x - 5, yy - 8); }
    else if (pt.id === 'sprite') { const yy = y - 16 + Math.sin(pt.t * 3) * 2, f = Math.floor(pt.t * 12) % 3; shadow(c, x, y, 3); px(c, x - 3, yy - 3, 6, 6, '#ff7a2a'); px(c, x - 2, yy - 5 - f % 2, 4, 4, '#ffd27a'); px(c, x - 1, yy - 2, 1, 1, '#1a1020'); px(c, x + 1, yy - 2, 1, 1, '#1a1020'); if (chance(0.4)) G.parts.push({ x: x + rand(-2, 2), y: yy - 3, vx: rand(-5, 5), vy: -20, life: 0.4, max: 0.4, col: '#ffb03a', size: 1, grav: 0 }); }
    if (SET.names) tinyText(c, PETS[pt.id].name + ' LV' + pt.lvl, x, y - 22, '#9fd0f0');
  },
};
