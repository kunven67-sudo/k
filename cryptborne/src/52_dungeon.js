
// =====================================================================
// DUNGEONS — a new layout every visit.
// Normal rooms on the left. The mini-boss carries the boss key, which opens
// the door to the healing spring. The lever in the spring room opens the
// gate to the boss. One room hides a cracked wall with a secret room.
// =====================================================================
function buildDungeon(def) {
  const big = Math.min(def.tier, 7), Wn = 42 + big * 3, H = 38 + big * 3, W = Wn + 31;
  const m = makeMap(W, H, T.WALL); m.kind = 'dungeon'; m.explored = new Uint8Array(W * H); m.biome = 'dungeon';
  const th = def.theme, rooms = [];
  const target = def.secret ? def.rooms : def.rooms;
  for (let tries = 0; tries < 800 && rooms.length < target; tries++) {
    const w = randi(7, 12), h = randi(6, 9), x = randi(2, Wn - w - 2), y = randi(3, H - h - 3);
    if (rooms.some((o) => x < o.x + o.w + 3 && x + w + 3 > o.x && y < o.y + o.h + 3 && y + h + 3 > o.y)) continue;
    rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
  }
  const floor = (tx, ty) => { if (tx > 0 && ty > 1 && tx < W - 1 && ty < H - 1) m.t[ty * W + tx] = T.FLOOR; };
  const carveRoom = (r) => { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) floor(x, y); };
  rooms.forEach(carveRoom);
  const corridor = (a, b) => {
    let x = a.cx, y = a.cy;
    const stepTo = (tx, ty) => { while (x !== tx || y !== ty) { if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y); floor(x, y); floor(x + 1, y); floor(x, y + 1); floor(x + 1, y + 1); } };
    if (Math.random() < 0.5) { stepTo(b.cx, a.cy); stepTo(b.cx, b.cy); } else { stepTo(a.cx, b.cy); stepTo(b.cx, b.cy); }
  };
  const linked = [rooms[0]], rest = rooms.slice(1);
  while (rest.length) {
    let best = null, bd = Infinity;
    for (const a of linked) for (const b of rest) { const d = Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy); if (d < bd) { bd = d; best = [a, b]; } }
    corridor(best[0], best[1]); linked.push(best[1]); rest.splice(rest.indexOf(best[1]), 1);
  }
  for (let i = 0; i < 2 && rooms.length > 3; i++) corridor(pick(rooms), pick(rooms));
  // the start is the leftmost room; the connector is the room reaching furthest right
  rooms.sort((a, b) => a.x - b.x);
  const start = rooms[0];
  let conn = rooms[rooms.length - 1]; for (const r of rooms) if (r.x + r.w > conn.x + conn.w) conn = r;
  // ---- boss wing: spring room then boss room, reached only through the key door ----
  const spring = { w: 8, h: 7 }; spring.x = Wn + 3; spring.y = clamp(conn.cy - 3, 3, H - spring.h - 3); spring.cx = spring.x + 4; spring.cy = spring.y + 3;
  const boss = { w: 15, h: 11 }; boss.x = Wn + 14; boss.y = clamp(spring.cy - 5, 3, H - boss.h - 3); boss.cx = boss.x + 7; boss.cy = boss.y + 5;
  carveRoom(spring); carveRoom(boss);
  const one = (x0, y0, x1, y1) => { let x = x0, y = y0; floor(x, y); while (x !== x1 || y !== y1) { if (x !== x1) x += Math.sign(x1 - x); else y += Math.sign(y1 - y); floor(x, y); } };
  const door1 = { tx: spring.x - 1, ty: spring.cy, kind: def.mini ? 'key' : 'open', open: !def.mini };
  one(conn.x + conn.w, conn.cy, Wn + 1, conn.cy); one(Wn + 1, conn.cy, Wn + 1, spring.cy); one(Wn + 1, spring.cy, spring.x - 1, spring.cy);
  const gateRow = clamp(spring.cy, boss.y + 1, boss.y + boss.h - 2);
  one(spring.x + spring.w, spring.cy, spring.x + spring.w + 1, spring.cy); one(spring.x + spring.w + 1, spring.cy, spring.x + spring.w + 1, gateRow); one(spring.x + spring.w + 1, gateRow, boss.x - 1, gateRow);
  const door2 = { tx: boss.x - 1, ty: gateRow, kind: 'gate', open: false };
  const doors = [door1, door2];
  for (const d of doors) if (!d.open) m.block[d.ty * W + d.tx] = 1;
  // the healing pool and the lever
  for (let y = spring.cy - 1; y <= spring.cy; y++) for (let x = spring.cx - 2; x <= spring.cx; x++) m.t[y * W + x] = T.SPRING;
  const lever = { tx: spring.x + spring.w - 1, ty: spring.y, pulled: false, x: (spring.x + spring.w - 1) * 16 + 8, y: spring.y * 16 + 14 };
  m.block[lever.ty * W + lever.tx] = 1;
  // ---- details ----
  const props = [], chests = [], spawns = [], torches = [], traps = [], decos = [], notes = [];
  const normal = rooms.filter((r) => r !== start);
  const freeFloor = (r, margin = 1) => {
    for (let k = 0; k < 60; k++) { const tx = randi(r.x + margin, r.x + r.w - 1 - margin), ty = randi(r.y + margin, r.y + r.h - 1 - margin), i = ty * W + tx; if (m.t[i] === T.FLOOR && !m.block[i] && !chests.some((c) => c.tx === tx && c.ty === ty)) return [tx, ty]; }
    for (let ty = r.y; ty < r.y + r.h; ty++) for (let tx = r.x; tx < r.x + r.w; tx++) { const i = ty * W + tx; if (m.t[i] === T.FLOOR && !m.block[i]) return [tx, ty]; }
    return null;
  };
  // hazards inside normal rooms
  if (th.hazard) for (const r of normal) {
    if (r.w < 9 || r.h < 7) continue;
    const tile = { lava: T.LAVA, bog: T.BOG, ice: T.ICE, water: T.SHALLOW }[th.hazard];
    for (let k = 0; k < (th.hazard === 'ice' ? 3 : 2); k++) { const lw = randi(2, th.hazard === 'ice' ? 5 : 3), lh = randi(2, 3), lx = randi(r.x + 2, Math.max(r.x + 2, r.x + r.w - lw - 2)), ly = randi(r.y + 2, Math.max(r.y + 2, r.y + r.h - lh - 2)); for (let y = ly; y < ly + lh; y++) for (let x = lx; x < lx + lw; x++) m.t[y * W + x] = tile; }
  }
  // secret room behind a cracked wall
  let secret = null;
  for (const r of normal.slice().sort(() => Math.random() - 0.5)) {
    const opts = [[-1, 0], [1, 0], [0, -1], [0, 1]].sort(() => Math.random() - 0.5);
    for (const [dx, dy] of opts) {
      const sw = 4, sh = 3;
      const cx = dx ? (dx < 0 ? r.x - 1 : r.x + r.w) : r.cx, cy = dy ? (dy < 0 ? r.y - 1 : r.y + r.h) : r.cy;
      const sx = dx < 0 ? cx - 1 - sw : dx > 0 ? cx + 2 : cx - 2, sy = dy < 0 ? cy - 1 - sh : dy > 0 ? cy + 2 : cy - 1;
      if (sx < 2 || sy < 3 || sx + sw > Wn - 1 || sy + sh > H - 2) continue;
      let ok = true;
      for (let y = sy - 1; y <= sy + sh && ok; y++) for (let x = sx - 1; x <= sx + sw && ok; x++) if (m.t[y * W + x] !== T.WALL) ok = false;
      const px2 = cx + dx, py2 = cy + dy; if (m.t[py2 * W + px2] !== T.WALL || m.t[cy * W + cx] !== T.WALL) ok = false;
      if (!ok) continue;
      for (let y = sy; y < sy + sh; y++) for (let x = sx; x < sx + sw; x++) floor(x, y);
      floor(px2, py2); m.t[cy * W + cx] = T.FLOOR; m.block[cy * W + cx] = 1;
      secret = { tx: cx, ty: cy, hp: 3, open: false, room: { x: sx, y: sy, w: sw, h: sh, cx: sx + 2, cy: sy + 1 } };
      break;
    }
    if (secret) break;
  }
  // chests: wood in normal rooms, a better one in the secret room, gold behind the boss
  normal.forEach((r, i) => { if (r === conn && normal.length > 2) return; if (i % 2 === 0 || Math.random() < 0.3) { const f = freeFloor(r, 1); if (f) { m.block[f[1] * W + f[0]] = 1; chests.push({ x: f[0] * 16 + 8, y: f[1] * 16 + 14, tx: f[0], ty: f[1], kind: 'wood', open: false }); } } });
  if (secret) { const s = secret.room; m.block[s.y * W + s.x + 3] = 1; chests.push({ x: (s.x + 3) * 16 + 8, y: s.y * 16 + 14, tx: s.x + 3, ty: s.y, kind: 'wood', open: false, rich: true }); }
  { const tx = boss.cx, ty = boss.y + 1; m.block[ty * W + tx] = 1; chests.push({ x: tx * 16 + 8, y: ty * 16 + 14, tx, ty, kind: 'gold', open: false, locked: true }); }
  // monsters, the mini-boss (key holder) and the boss
  for (const r of normal) {
    const n = randi(2, 3) + Math.floor(Math.min(def.tier, 8) / 3);
    for (let k = 0; k < n; k++) { const f = freeFloor(r, 1); if (f) spawns.push({ type: weighted(def.mons), x: f[0] * 16 + 8, y: f[1] * 16 + 12, room: r }); }
  }
  if (def.mini) {
    const bfs = (sx, sy) => { const d = new Int16Array(W * H).fill(-1), q = [sy * W + sx]; d[q[0]] = 0; for (let qi = 0; qi < q.length; qi++) { const i = q[qi], x = i % W, y = (i / W) | 0; for (const [ddx, ddy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (y + ddy) * W + x + ddx; if (d[j] === -1 && !SOLID_T[m.t[j]] && !m.block[j]) { d[j] = d[i] + 1; q.push(j); } } } return d; };
    const d0 = bfs(start.cx, start.cy);
    const cands = normal.filter((r) => r !== conn || normal.length < 3).sort((a, b) => d0[b.cy * W + b.cx] - d0[a.cy * W + a.cx]);
    const mr = cands[Math.min(cands.length - 1, cands.length > 2 ? 1 : 0)] || conn;
    const f = freeFloor(mr, 2) || freeFloor(mr, 1) || [mr.cx, mr.cy];
    spawns.push({ type: def.mini, x: f[0] * 16 + 8, y: f[1] * 16 + 12, room: mr, mini: true });
    def._miniRoom = mr;
  }
  spawns.push({ type: def.boss, x: boss.cx * 16 + 8, y: (boss.cy + 1) * 16, room: boss, boss: true });
  // notes Finn left here (only ones not found yet are placed)
  const found = (G.save && G.save.story.notes) || {};
  const left = def.notes.filter((id) => !found[id]);
  left.forEach((id, i) => {
    const r = i === 1 && secret ? secret.room : pick(normal.length ? normal : [start]);
    const f = r === (secret && secret.room) ? [r.x + 1, r.y + 1] : freeFloor(r, 1);
    if (f) notes.push({ id, x: f[0] * 16 + 8, y: f[1] * 16 + 10 });
  });
  // torches, decorations, traps
  for (const r of rooms.concat([spring, boss])) {
    for (let x = r.x + 1; x < r.x + r.w - 1; x += 4) if (m.t[(r.y - 1) * W + x] === T.WALL && m.t[r.y * W + x] === T.FLOOR) torches.push({ x: x * 16 + 8, y: (r.y - 1) * 16 + 9, ph: Math.random() * 6 });
    if (r === start || r === spring) continue;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      const i = y * W + x; if (m.t[i] !== T.FLOOR || m.block[i]) continue;
      if (Math.random() < 0.045) decos.push({ x: x * 16 + randi(3, 12), y: y * 16 + randi(4, 13), kind: th.deco, v: randi(0, 2) });
      else if (th.traps && r !== boss && Math.random() < 0.025) traps.push({ tx: x, ty: y, x: x * 16 + 8, y: y * 16 + 8, ph: Math.random() * 2.4, cd: 0 });
    }
  }
  renderLayer(m, th);
  return { def, map: m, rooms, start, boss, spring, conn, props, chests, spawns, torches, traps, decos, doors, lever, notes, secret, captive: null,
    entry: { x: start.cx * 16 + 8, y: (start.y + start.h - 2) * 16 + 12 }, exit: { x: start.cx * 16 + 8, y: (start.y + 1) * 16 + 8 } };
}
