
// =====================================================================
// HUD CANVASES — tiny map, world atlas, dungeon map, specials bar.
// =====================================================================
const miniC = $('#mini'), miniX = miniC.getContext('2d'); miniX.imageSmoothingEnabled = false;
function drawMini() {
  const A = G.area; if (!A) return; const p = G.p, W = 60, H = 40, s = 2;
  miniX.fillStyle = '#07050a'; miniX.fillRect(0, 0, 120, 80);
  const ptx = p.x / 16, pty = p.y / 16; const ox = Math.round(ptx - W / 2), oy = Math.round(pty - H / 2);
  const dot = (tx, ty, col, r = 2) => { const x = (tx - ox) * s, y = (ty - oy) * s; miniX.fillStyle = '#07050a'; miniX.fillRect(x - r - 1, y - r - 1, r * 2 + 3, r * 2 + 3); miniX.fillStyle = col; miniX.fillRect(x - r, y - r, r * 2 + 1, r * 2 + 1); };
  if (A.kind !== 'dungeon') {
    miniX.drawImage(A.mini, ox, oy, W, H, 0, 0, W * s, H * s);
    if (Clock.dark() > 0.3) { miniX.fillStyle = `rgba(8,10,28,${Clock.dark() * 0.45})`; miniX.fillRect(0, 0, 120, 80); }
    for (const e of A.entrances || []) { const d = e.d; if (d.secret && !ST().flags.mirrorOpen) continue; dot(e.tx, e.ty - 1, G.save.stats.bosses[d.id] ? '#9be04a' : S().level >= d.lvl && d.act <= ST().act ? '#f2c13a' : '#d8454a'); }
    for (const g of A.gates || []) dot((g.x0 + g.x1) / 2, (g.y0 + g.y1) / 2, '#55a8ef', 1);
    for (const n of A.npcs || []) if (!n.hidden && Quests.marker(n.id)) dot(n.x / 16, n.y / 16, Quests.marker(n.id) === '?' ? '#7dff8a' : '#f2c13a', 1);
    for (const n of A.notes || []) if (!n.got) dot(n.x / 16, n.y / 16, '#efe4cc', 1);
  } else {
    const m = A.map;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const tx = ox + x, ty = oy + y; if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h || !m.explored[ty * m.w + tx]) continue; const t = m.t[ty * m.w + tx]; miniX.fillStyle = t === T.LAVA ? '#d8452a' : t === T.SPRING ? '#3aa0b8' : SOLID_T[t] ? '#221c2c' : '#5a5268'; miniX.fillRect(x * s, y * s, s, s); }
    for (const c of A.chests) if (!c.open && m.explored[c.ty * m.w + c.tx]) dot(c.tx, c.ty, c.kind === 'gold' ? '#ffe08a' : '#c8922a', 1);
    for (const d of A.doors) if (!d.open && d.kind !== 'open' && m.explored[d.ty * m.w + d.tx]) dot(d.tx, d.ty, d.kind === 'key' ? '#f2c13a' : '#8a8c92', 1);
    for (const pt of A.portals) dot(pt.x / 16, pt.y / 16, '#b878ea');
    for (const mm of G.mons) if (mm.mini && m.explored[Math.floor(mm.y / 16) * m.w + Math.floor(mm.x / 16)]) dot(mm.x / 16, mm.y / 16, '#f2c13a');
    if (G.bossMon) dot(G.bossMon.x / 16, G.bossMon.y / 16, '#ff4040');
  }
  if (Math.floor(G.time * 3) % 2 === 0) { miniX.fillStyle = '#ffffff'; miniX.fillRect(Math.round((ptx - ox) * s) - 2, Math.round((pty - oy) * s) - 2, 4, 4); }
}
// ---------- world atlas (map modal) ----------
const ATLAS = { vale: [104, 80, 112], frostpeak: [113, 4, 93], sunscar: [113, 170, 93], mirefen: [6, 88, 93], saltmarrow: [221, 88, 93] }; // x, y, width in canvas px
function atlasPos(mapId, tx, ty) { const [x, y, w] = ATLAS[mapId], s = w / REGIONS[mapId].w; return [x + tx * s, y + ty * s]; }
function drawAtlas(cv) {
  const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.fillStyle = '#0a0812'; c.fillRect(0, 0, cv.width, cv.height);
  const act = ST().act;
  for (const id in ATLAS) {
    const [x, y, w] = ATLAS[id], h = (w / REGIONS[id].w) * REGIONS[id].h, open = id === 'vale' || act >= 2;
    if (open && (WORLDS[id] || (ST().visited || {})[id])) c.drawImage(getWorld(id).mini, x, y, w, h);
    else { c.fillStyle = open ? '#1e1830' : '#141020'; c.fillRect(x, y, w, h); c.strokeStyle = '#3a2e48'; c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); tinyText(c, open ? 'UNEXPLORED' : 'ROAD CLOSED', x + w / 2, y + h / 2 + 4, '#6a5a7a'); }
  }
  // roads between lands
  c.strokeStyle = 'rgba(242,193,58,.5)'; c.setLineDash([2, 2]); c.beginPath();
  for (const [a, b] of [['vale', 'frostpeak'], ['vale', 'sunscar'], ['vale', 'mirefen'], ['vale', 'saltmarrow']]) { const [ax, ay, aw] = ATLAS[a], [bx, by, bw] = ATLAS[b]; c.moveTo(ax + aw / 2, ay + 40); c.lineTo(bx + bw / 2, by + 35); }
  c.stroke(); c.setLineDash([]);
  for (const d of DUNGEONS) {
    if (d.secret && !ST().flags.mirrorOpen) continue;
    const [x, y] = atlasPos(d.map, d.at[0], d.at[1]), ok = S().level >= d.lvl && d.act <= act, sel = UI.mapSel === d.id;
    c.fillStyle = '#07050a'; c.fillRect(x - 4, y - 4, 9, 9); c.fillStyle = G.save.stats.bosses[d.id] ? '#9be04a' : ok ? '#f2c13a' : d.act > act ? '#7a4a9a' : '#d8454a'; c.fillRect(x - 3, y - 3, 7, 7);
    if (sel) { c.strokeStyle = '#ffffff'; c.lineWidth = 1; c.strokeRect(x - 6.5, y - 6.5, 14, 14); }
  }
  for (const id in ATLAS) { const [x, y, w] = ATLAS[id], n = REGIONS[id].name, tw = n.length * 6 + 4; c.fillStyle = 'rgba(7,5,10,.7)'; c.fillRect(x + w / 2 - tw / 2, y + 1, tw, 9); tinyText(c, n, x + w / 2, y + 8, '#ffffff'); }
  const here = G.area.kind === 'dungeon' ? G.area.def.map : G.area.kind === 'interior' ? 'vale' : G.area.id;
  if (ATLAS[here] && Math.floor(performance.now() / 300) % 2) { const [x, y] = G.area.kind === 'dungeon' ? atlasPos(here, G.area.def.at[0], G.area.def.at[1]) : G.area.kind === 'interior' ? atlasPos('vale', 39, 45) : atlasPos(here, G.p.x / 16, G.p.y / 16); c.fillStyle = '#ffffff'; c.fillRect(x - 2, y - 2, 5, 5); }
}
function drawDungeonMap(cv) {
  const c = cv.getContext('2d'), A = G.area, m = A.map; c.fillStyle = '#07050a'; c.fillRect(0, 0, cv.width, cv.height);
  const s = Math.min(cv.width / m.w, cv.height / m.h), ox = (cv.width - m.w * s) / 2, oy = (cv.height - m.h * s) / 2;
  for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) { if (!m.explored[ty * m.w + tx]) continue; const t = m.t[ty * m.w + tx]; c.fillStyle = t === T.LAVA ? '#d8452a' : t === T.SPRING ? '#3aa0b8' : SOLID_T[t] ? '#221c2c' : '#5a5268'; c.fillRect(ox + tx * s, oy + ty * s, Math.ceil(s), Math.ceil(s)); }
  for (const ch of A.chests) if (!ch.open && m.explored[ch.ty * m.w + ch.tx]) { c.fillStyle = ch.kind === 'gold' ? '#ffe08a' : '#c8922a'; c.fillRect(ox + ch.tx * s - 1, oy + ch.ty * s - 1, s + 2, s + 2); }
  for (const pt of A.portals) { c.fillStyle = '#b878ea'; c.fillRect(ox + (pt.x / 16) * s - 3, oy + (pt.y / 16) * s - 3, 6, 6); }
  c.fillStyle = '#ffffff'; c.fillRect(ox + (G.p.x / 16) * s - 2, oy + (G.p.y / 16) * s - 2, 5, 5);
}
// ---------- specials bar ----------
function renderSpecialsBar() {
  const bar = $('#specials'); if (!G.save) return;
  if (bar.children.length !== 4) {
    bar.innerHTML = '';
    for (let i = 0; i < 4; i++) { const b = document.createElement('button'); b.type = 'button'; b.className = 'sp'; b.innerHTML = `<span class="k">${SPECIAL_KEYS[i]}</span><span class="nm"></span><span class="cdv"></span><span class="cdt"></span>`; b.addEventListener('click', () => { AU.unlock(); b.blur(); if (!UI.modal && !Story.active()) useSpecial(i); }); bar.appendChild(b); }
  }
  for (let i = 0; i < 4; i++) {
    const b = bar.children[i], id = S().specials[i], cd = G.p.cds[i], mx = G.p.cdMax[i] || 1;
    const nm = id ? SPECIALS[id].name.split(' ')[0].slice(0, 6).toUpperCase() : '-';
    if (b.dataset.id !== String(id)) { b.dataset.id = id; b.querySelector('.nm').textContent = nm; b.title = id ? SPECIALS[id].name + ': ' + SPECIALS[id].desc : 'Empty slot (open skills with K)'; }
    b.classList.toggle('empty', !id); b.classList.toggle('ready', !!id && cd <= 0);
    b.querySelector('.cdv').style.height = id && cd > 0 ? clamp((cd / mx) * 100, 0, 100) + '%' : '0';
    b.querySelector('.cdt').textContent = id && cd > 0 ? Math.ceil(cd) : '';
    if (Input.touchMode) { const t = $$('#touch [data-sp]')[i], txt = !id ? '-' : cd > 0 ? String(Math.ceil(cd)) : nm.slice(0, 5); if (t && t.textContent !== txt) t.textContent = txt; if (t) t.style.opacity = id && cd <= 0 ? 1 : 0.5; }
  }
}
