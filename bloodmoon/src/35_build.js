
// =====================================================================
// WORLD (2) — buildings and places: Ashford, the castle, the graveyard,
// bridges, the mill, camps, the witch's hut, the nest, the shrine, farms.
// =====================================================================
const ANIM = []; // things that move every frame: waterwheel, windmill sails, flags
function addInteract(o) { WORLD.interact.push(o); return o; } // {x, y, z, r, label, kind, ...}
function groundMinMax(x, z, hw, hd, rot) {
  const c = Math.cos(rot), s = Math.sin(rot); let lo = 1e9, hi = -1e9;
  for (const [a, b] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd], [0, 0]]) { const h = heightAt(x + a * c + b * s, z - a * s + b * c); lo = Math.min(lo, h); hi = Math.max(hi, h); }
  return [lo, hi];
}
// ---------- houses ----------
function buildHouse(B, x, z, w, d, rot, kind, name) {
  const [lo, hi] = groundMinMax(x, z, w / 2, d / 2, rot), gy = hi + 0.35;
  const P = M4(x, 0, z, rot), tall = kind === 'inn' || kind === 'barracks', wallH = tall ? 6.4 : kind === 'chapel' ? 7.5 : 3.6;
  const stoneBase = kind === 'chapel' || kind === 'barracks' || kind === 'smith';
  B.addL(MAT.stone, boxGeo(w + 0.5, gy - lo + 1.2, d + 0.5, 2.5), P, M4(0, (gy + lo) / 2 - 0.4, 0));
  B.addL(stoneBase ? MAT.stone : MAT.timber, boxGeo(w, wallH, d, stoneBase ? 2.5 : 3.6), P, M4(0, gy + wallH / 2, 0));
  if (tall && !stoneBase) B.addL(MAT.wood, boxGeo(w + 0.3, 0.3, d + 0.3), P, M4(0, gy + 3.3, 0));
  const rise = kind === 'chapel' ? 5 : Math.min(w, d) * 0.42, roofMat = kind === 'chapel' || kind === 'barracks' ? MAT.slate : hash2(Math.round(x), Math.round(z), 3) < 0.35 ? MAT.thatch : MAT.roof;
  // the ridge runs along the longer side
  const along = w >= d, rw = along ? w : d, rd = along ? d : w, rr = along ? 0 : Math.PI / 2;
  B.addL(roofMat, roofGeo(rw, rd, rise, 0.6), P, M4(0, gy + wallH, 0, rr));
  B.addL(stoneBase ? MAT.stone : MAT.timber, gableGeo(rd, rise), P, M4(along ? -rw / 2 : 0, gy + wallH, along ? 0 : -rw / 2, rr));
  B.addL(stoneBase ? MAT.stone : MAT.timber, gableGeo(rd, rise), P, M4(along ? rw / 2 : 0, gy + wallH, along ? 0 : rw / 2, rr + Math.PI));
  if (kind !== 'chapel') B.addL(MAT.stone, boxGeo(1, rise + 2.2, 1, 2), P, M4(w / 2 - 1.2, gy + wallH + rise / 2 + 0.6, -d / 4));
  // door and windows on the front (+z) face
  B.addL(MAT.darkWood, boxGeo(1.5, 2.3, 0.2), P, M4(0, gy + 1.15, d / 2 + 0.05));
  B.addL(MAT.wood, boxGeo(1.9, 0.25, 0.3), P, M4(0, gy + 2.4, d / 2 + 0.1));
  const win = (lx, ly, lz, ry) => { B.addL(MAT.window, boxGeo(0.9, 1.0, 0.12), P, M4(lx, ly, lz, ry)); B.addL(MAT.darkWood, boxGeo(1.1, 0.14, 0.2), P, M4(lx, ly - 0.58, lz, ry)); };
  for (const lx of [-w / 2 + 1.6, w / 2 - 1.6]) { win(lx, gy + 1.7, d / 2 + 0.03, 0); win(lx, gy + 1.7, -d / 2 - 0.03, 0); if (tall) { win(lx, gy + 4.8, d / 2 + 0.03, 0); win(lx, gy + 4.8, -d / 2 - 0.03, 0); } }
  win(w / 2 + 0.03, gy + 1.7, 0, Math.PI / 2); win(-w / 2 - 0.03, gy + 1.7, 0, Math.PI / 2);
  if (kind === 'chapel') { // bell tower
    B.addL(MAT.stone, boxGeo(3.4, 9, 3.4, 2.5), P, M4(0, gy + wallH + 4.5, -d / 2 + 1.7)); B.addL(MAT.slate, new THREE.ConeGeometry(2.8, 4.5, 4), P, M4(0, gy + wallH + 11.2, -d / 2 + 1.7, Math.PI / 4));
    B.addL(MAT.window, boxGeo(1.2, 3, 0.15), P, M4(0, gy + 3.8, d / 2 + 0.04));
  }
  // a hanging shop sign
  const signCol = { smith: 0x6a6e78, alchemist: 0x5a8a3a, inn: 0xd8a040 }[kind];
  if (signCol) { B.addL(MAT.iron, boxGeo(0.1, 0.1, 1.2), P, M4(w / 2 - 2.2, gy + 3, d / 2 + 0.6)); B.addL(MAT.wood, boxGeo(1.1, 0.8, 0.08), P, M4(w / 2 - 2.2, gy + 2.45, d / 2 + 1.05)); B.addL(new THREE.MeshStandardMaterial({ color: signCol, roughness: 0.6, metalness: 0.4 }), boxGeo(0.5, 0.45, 0.1), P, M4(w / 2 - 2.2, gy + 2.45, d / 2 + 1.1)); }
  addCollider({ kind: 'box', x, z, hw: w / 2 + 0.2, hd: d / 2 + 0.2, rot, y0: lo - 2, y1: gy + wallH + rise });
  const fx = x + Math.sin(rot) * (d / 2 + 1.4), fz = z + Math.cos(rot) * (d / 2 + 1.4);
  return { door: [fx, gy, fz], gy, name };
}
function buildTown(B) {
  const P = PLACES.ashford;
  for (const [x, z, w, d, kind, rot, name, act] of TOWN) {
    const h = buildHouse(B, x, z, w, d, rot, kind, name);
    if (act) addInteract({ x: h.door[0], y: h.door[1], z: h.door[2], r: 2.4, label: name, kind: act });
    else if (hash2(Math.round(x), Math.round(z), 9) < 0.5) addLightSource({ x: h.door[0], y: h.gy + 2.6, z: h.door[2] - Math.cos(rot) * 1.0, color: 0xffb060, intensity: 4, range: 10, kind: 'lamp', size: 0.9 });
  }
  // the square: well, contract board, market stalls, lamps
  const sq = { x: 4, z: 140 }, gy = heightAt(sq.x, sq.z);
  const well = M4(-8, gy, 142);
  B.addL(MAT.stone, new THREE.CylinderGeometry(1.4, 1.5, 1, 14, 1, true), well, M4(0, 0.5, 0)); B.addL(MAT.stone, new THREE.TorusGeometry(1.45, 0.18, 6, 16), well, M4(0, 1, 0, 0, 1, 1, 1, Math.PI / 2));
  B.addL(MAT.wood, boxGeo(0.2, 2.6, 0.2), well, M4(-1.3, 1.3, 0)); B.addL(MAT.wood, boxGeo(0.2, 2.6, 0.2), well, M4(1.3, 1.3, 0)); B.addL(MAT.roof, roofGeo(3.4, 2.4, 1, 0.2), well, M4(0, 2.5, 0));
  addCollider({ kind: 'circle', x: -8, z: 142, r: 1.7, y0: gy - 1, y1: gy + 3 });
  addInteract({ x: -8, y: gy, z: 144.6, r: 2.2, label: 'Drink from the well', kind: 'well' });
  const bx = 15, bz = 128, by = heightAt(bx, bz), board = M4(bx, by, bz, -0.4);
  B.addL(MAT.darkWood, boxGeo(0.25, 2.8, 0.25), board, M4(-1.6, 1.4, 0)); B.addL(MAT.darkWood, boxGeo(0.25, 2.8, 0.25), board, M4(1.6, 1.4, 0));
  B.addL(MAT.wood, boxGeo(3.4, 1.8, 0.12), board, M4(0, 1.8, 0)); B.addL(MAT.roof, roofGeo(3.8, 0.8, 0.35, 0.1), board, M4(0, 2.75, 0));
  const paper = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 1 });
  for (let i = 0; i < 6; i++) B.addL(paper, boxGeo(0.55, 0.7, 0.02), board, M4(-1.2 + (i % 3) * 1.15, 2.2 - Math.floor(i / 3) * 0.8, 0.08, 0, 1, 1, 1, 0, rand(-0.1, 0.1)));
  addCollider({ kind: 'box', x: bx, z: bz, hw: 1.8, hd: 0.3, rot: -0.4, y0: by - 1, y1: by + 3 });
  addInteract({ x: bx + Math.sin(-0.4) * 1.6, y: by, z: bz + Math.cos(-0.4) * 1.6, r: 2.5, label: 'Contract board', kind: 'board' });
  for (const [sx, sz, sr, col] of [[24, 148, 0.2, 0x8a2a24], [-16, 156, -0.3, 0x2a5a8a], [10, 160, 0.1, 0x6a7a2a]]) {
    const y = heightAt(sx, sz), S = M4(sx, y, sz, sr), cloth = new THREE.MeshStandardMaterial({ color: col, roughness: 1, side: THREE.DoubleSide });
    for (const [px2, pz2] of [[-1.4, -0.9], [1.4, -0.9], [-1.4, 0.9], [1.4, 0.9]]) B.addL(MAT.wood, boxGeo(0.15, 2.4, 0.15), S, M4(px2, 1.2, pz2));
    B.addL(MAT.wood, boxGeo(3, 0.15, 1.8), S, M4(0, 0.95, 0)); B.addL(cloth, roofGeo(3.2, 2, 0.6, 0.2), S, M4(0, 2.4, 0));
    for (let i = 0; i < 5; i++) B.addL(i % 2 ? MAT.hay : new THREE.MeshStandardMaterial({ color: [0xb02020, 0xd8a040, 0x5a8a3a][i % 3], roughness: 0.8 }), new THREE.SphereGeometry(0.16, 6, 4), S, M4(-1 + i * 0.5, 1.12, rand(-0.4, 0.4)));
    addCollider({ kind: 'box', x: sx, z: sz, hw: 1.6, hd: 1, rot: sr, y0: y - 1, y1: y + 2.6 });
  }
  // street lamps along the roads inside town
  for (const pts of ROADS) for (let i = 0; i < pts.length; i += 3) {
    const [x, z] = pts[i]; if (Math.hypot(x - P.x, z - P.z) > 95) continue;
    const [nx, nz] = pts[Math.min(pts.length - 1, i + 1)]; const dx = nx - x, dz = nz - z, L = Math.hypot(dx, dz) || 1, lx = x - (dz / L) * 4, lz = z + (dx / L) * 4;
    if (COL.list.some((c) => Math.hypot(c.x - lx, c.z - lz) < (c.br || 1) + 1.5)) continue;
    buildLamp(B, lx, lz);
  }
  // barrels and crates
  const rnd = mulberry32(5);
  for (let i = 0; i < 26; i++) {
    const [x, z, , , , rot] = TOWN[i % TOWN.length], a = rnd() * TAU, px2 = x + Math.cos(a) * 7, pz2 = z + Math.sin(a) * 7;
    if (COL.list.some((c) => Math.hypot(c.x - px2, c.z - pz2) < (c.br || 1) + 0.8)) continue;
    const y = heightAt(px2, pz2);
    if (rnd() < 0.5) { B.addL(MAT.wood, new THREE.CylinderGeometry(0.45, 0.4, 1.1, 10), M4(px2, y + 0.55, pz2), M4()); B.addL(MAT.iron, new THREE.TorusGeometry(0.47, 0.04, 4, 12), M4(px2, y + 0.3, pz2, 0, 1, 1, 1, Math.PI / 2), M4()); }
    else B.addL(MAT.wood, boxGeo(1, 1, 1, 1), M4(px2, y + 0.5, pz2, rnd()), M4());
    addCollider({ kind: 'circle', x: px2, z: pz2, r: 0.6, y0: y - 1, y1: y + 1.1 });
  }
}
function buildLamp(B, x, z) {
  const y = heightAt(x, z);
  B.addL(MAT.iron, new THREE.CylinderGeometry(0.07, 0.11, 3.4, 6), M4(x, y + 1.7, z), M4());
  B.addL(MAT.iron, boxGeo(0.5, 0.08, 0.08), M4(x + 0.2, y + 3.35, z), M4());
  B.addL(MAT.window, boxGeo(0.32, 0.45, 0.32), M4(x + 0.42, y + 3.05, z), M4()); B.addL(MAT.iron, new THREE.ConeGeometry(0.3, 0.25, 4), M4(x + 0.42, y + 3.4, z, Math.PI / 4), M4());
  addCollider({ kind: 'circle', x, z, r: 0.2, y0: y - 1, y1: y + 3.5 });
  addLightSource({ x: x + 0.42, y: y + 3.05, z, color: 0xffb060, intensity: 6, range: 15, kind: 'lamp', size: 1.2 });
}
// ---------- the castle ----------
const CASTLE = { gate: null, keepDoor: null };
function buildCastle(B) {
  const C = PLACES.castle, cy = castleLevel(), H = 48, wallH = 13, T = 3;
  const P = M4(C.x, cy, C.z);
  const wall = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), r = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    const lo = Math.min(heightAt(C.x + x0, C.z + z0), heightAt(C.x + x1, C.z + z1)) - cy;
    B.addL(MAT.darkStone, boxGeo(len, wallH - lo, T, 3), P, M4(mx, (wallH + lo) / 2, mz, r));
    for (let i = 0; i < len / 2.6; i++) { const t = (i + 0.5) / Math.ceil(len / 2.6) - 0.5; B.addL(MAT.darkStone, boxGeo(1.3, 1.2, T + 0.3, 1.5), P, M4(mx + Math.cos(-r) * t * len, wallH + 0.6, mz + Math.sin(-r) * t * len, r)); }
    addCollider({ kind: 'box', x: C.x + mx, z: C.z + mz, hw: len / 2, hd: T / 2 + 0.2, rot: r, y0: cy - 20, y1: cy + wallH + 2 });
  };
  const g = 5; // half gate width
  wall(-H, -H, H, -H); wall(-H, -H, -H, H); wall(H, -H, H, H); wall(-H, H, -g, H); wall(g, H, H, H);
  // gatehouse over the gap
  B.addL(MAT.darkStone, boxGeo(g * 2 + 6, 5, T + 2, 3), P, M4(0, wallH + 1, H)); B.addL(MAT.darkStone, boxGeo(3, wallH + 6, T + 2, 3), P, M4(-g - 1.5, (wallH + 6) / 2, H)); B.addL(MAT.darkStone, boxGeo(3, wallH + 6, T + 2, 3), P, M4(g + 1.5, (wallH + 6) / 2, H));
  const bars = new THREE.Group(); bars.position.set(C.x, cy, C.z + H);
  for (let i = -4; i <= 4; i++) { const b = new THREE.Mesh(boxGeo(0.18, 10, 0.18), MAT.iron); b.position.set(i * 1.1, 5, 0); b.castShadow = true; bars.add(b); }
  for (let j = 1; j < 5; j++) { const b = new THREE.Mesh(boxGeo(g * 2, 0.16, 0.16), MAT.iron); b.position.set(0, j * 2, 0); bars.add(b); }
  WORLD.root.add(bars);
  CASTLE.gate = { mesh: bars, col: addCollider({ kind: 'box', x: C.x, z: C.z + H, hw: g, hd: 0.6, rot: 0, y0: cy - 5, y1: cy + 12 }), open: false, y: cy };
  addInteract({ x: C.x, y: cy, z: C.z + H + 3, r: 3.5, label: 'The castle gate', kind: 'castlegate' });
  // corner towers
  for (const [tx, tz] of [[-H, -H], [H, -H], [-H, H], [H, H]]) {
    B.addL(MAT.darkStone, new THREE.CylinderGeometry(5.5, 6.2, wallH + 9, 14), P, M4(tx, (wallH + 9) / 2 - 2, tz));
    B.addL(MAT.slate, new THREE.ConeGeometry(6.6, 8, 14), P, M4(tx, wallH + 7 + 4, tz));
    addCollider({ kind: 'circle', x: C.x + tx, z: C.z + tz, r: 6.2, y0: cy - 20, y1: cy + 30 });
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.6, 6, 1), new THREE.MeshStandardMaterial({ color: 0x6a0a0e, roughness: 1, side: THREE.DoubleSide }));
    flag.position.set(C.x + tx + 1.6, cy + wallH + 17, C.z + tz); WORLD.root.add(flag); ANIM.push({ kind: 'flag', mesh: flag, base: flag.geometry.attributes.position.array.slice() });
    B.addL(MAT.iron, new THREE.CylinderGeometry(0.06, 0.06, 4, 4), P, M4(tx, wallH + 16, tz));
  }
  // the keep
  const kx = 0, kz = -16, kw = 34, kd = 24, kh = 24;
  B.addL(MAT.darkStone, boxGeo(kw, kh + 4, kd, 3), P, M4(kx, kh / 2 - 2, kz));
  B.addL(MAT.slate, roofGeo(kw, kd, 9, 0.8), P, M4(kx, kh, kz));
  B.addL(MAT.darkStone, gableGeo(kd, 9), P, M4(kx - kw / 2, kh, kz)); B.addL(MAT.darkStone, gableGeo(kd, 9), P, M4(kx + kw / 2, kh, kz, Math.PI));
  for (const sx of [-1, 1]) { B.addL(MAT.darkStone, new THREE.CylinderGeometry(3.4, 3.6, kh + 12, 10), P, M4(kx + sx * (kw / 2 - 1), (kh + 12) / 2 - 2, kz + kd / 2 - 1)); B.addL(MAT.slate, new THREE.ConeGeometry(4.2, 7, 10), P, M4(kx + sx * (kw / 2 - 1), kh + 13.5, kz + kd / 2 - 1)); }
  for (let i = -3; i <= 3; i++) if (i) B.addL(MAT.window, boxGeo(1, 2.4, 0.2), P, M4(kx + i * 4.4, 12, kz + kd / 2 + 0.06));
  B.addL(MAT.darkWood, boxGeo(4, 5.5, 0.4), P, M4(kx, 2.75, kz + kd / 2 + 0.1)); B.addL(MAT.darkStone, boxGeo(5.5, 0.8, 1), P, M4(kx, 5.8, kz + kd / 2 + 0.3));
  addCollider({ kind: 'box', x: C.x + kx, z: C.z + kz, hw: kw / 2, hd: kd / 2, rot: 0, y0: cy - 10, y1: cy + kh + 10 });
  CASTLE.keepDoor = addInteract({ x: C.x + kx, y: cy, z: C.z + kz + kd / 2 + 2, r: 3, label: 'The great hall', kind: 'keep' });
  // torches along the courtyard
  for (const [tx, tz] of [[-g - 3, H - 3], [g + 3, H - 3], [-6, kz + kd / 2 + 1], [6, kz + kd / 2 + 1], [-H + 3, 0], [H - 3, 0]]) { B.addL(MAT.iron, new THREE.CylinderGeometry(0.06, 0.08, 1.6, 5), P, M4(tx, 2.5, tz)); addLightSource({ x: C.x + tx, y: cy + 3.5, z: C.z + tz, color: 0xff8030, intensity: 7, range: 14, kind: 'torch', size: 1.4 }); }
  for (let i = 0; i < 4; i++) addLightSource({ x: C.x + (i - 1.5) * 9, y: cy + wallH + 1.5, z: C.z + H + 1.5, color: 0xff7020, intensity: 5, range: 12, kind: 'torch', size: 1.2 });
}
// ---------- graveyard and the ruined chapel ----------
function buildGraveyard(B) {
  const G0 = PLACES.graveyard, rnd = mulberry32(13), hw = 26, hd = 20;
  const lowWall = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0), r = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2, mx = (x0 + x1) / 2 + G0.x, mz = (z0 + z1) / 2 + G0.z, y = heightAt(mx, mz); B.add(MAT.stone, boxGeo(len, 1.4, 0.7, 1.5), M4(mx, y + 0.5, mz, r)); addCollider({ kind: 'box', x: mx, z: mz, hw: len / 2, hd: 0.45, rot: r, y0: y - 2, y1: y + 1.2 }); };
  lowWall(-hw, -hd, hw, -hd); lowWall(hw, -hd, hw, hd); lowWall(-hw, hd, hw, hd); lowWall(-hw, -hd, -hw, -4); lowWall(-hw, 4, -hw, hd);
  const stoneM = new THREE.MeshStandardMaterial({ map: TEX.stone, color: 0x9a9890, roughness: 0.95 });
  for (let i = 0; i < 46; i++) {
    const x = G0.x + rand(-hw + 3, hw - 3), z = G0.z + rand(-hd + 3, hd - 3), y = heightAt(x, z), r = rand(-0.2, 0.2) + Math.PI / 2 * (rnd() < 0.1 ? 1 : 0), tilt = rand(-0.15, 0.15);
    if (rnd() < 0.7) { B.add(stoneM, boxGeo(0.9, 1.2, 0.22, 1), M4(x, y + 0.45, z, r, 1, 1, 1, tilt)); B.add(stoneM, new THREE.CylinderGeometry(0.45, 0.45, 0.22, 10, 1, false, 0, Math.PI), M4(x, y + 1.05, z, r, 1, 1, 1, Math.PI / 2 + tilt)); }
    else { B.add(MAT.darkWood, boxGeo(0.16, 1.6, 0.16), M4(x, y + 0.7, z, r, 1, 1, 1, tilt)); B.add(MAT.darkWood, boxGeo(0.8, 0.14, 0.16), M4(x, y + 1.15, z, r, 1, 1, 1, tilt)); }
    B.add(MAT.dirt, boxGeo(0.9, 0.2, 1.8, 1), M4(x - Math.sin(r) * 1.1, y + 0.02, z - Math.cos(r) * 1.1, r));
  }
  // mausoleum
  const mx = G0.x + 14, mz = G0.z - 10, my = heightAt(mx, mz), Mz = M4(mx, my, mz, -Math.PI / 2);
  B.addL(stoneM, boxGeo(6, 4.5, 5, 2), Mz, M4(0, 2.25, 0)); B.addL(MAT.slate, roofGeo(6, 5, 1.6, 0.4), Mz, M4(0, 4.5, 0)); B.addL(stoneM, gableGeo(5, 1.6), Mz, M4(-3, 4.5, 0)); B.addL(stoneM, gableGeo(5, 1.6), Mz, M4(3, 4.5, 0, Math.PI));
  for (const s of [-1, 1]) B.addL(stoneM, new THREE.CylinderGeometry(0.3, 0.3, 4, 8), Mz, M4(s * 1.6, 2, 2.7));
  B.addL(MAT.darkWood, boxGeo(1.6, 2.6, 0.2), Mz, M4(0, 1.3, 2.55));
  addCollider({ kind: 'box', x: mx, z: mz, hw: 3, hd: 2.6, rot: -Math.PI / 2, y0: my - 2, y1: my + 6 });
  // the ruined chapel
  const C = PLACES.chapel, cy = heightAt(C.x, C.z), cr = 0.3, R = M4(C.x, cy, C.z, cr);
  const ruin = (lx, lz, len, h, ry) => { B.addL(MAT.stone, boxGeo(len, h, 1, 2.5), R, M4(lx, h / 2 - 0.5, lz, ry)); const c = Math.cos(cr), s = Math.sin(cr); addCollider({ kind: 'box', x: C.x + lx * c + lz * s, z: C.z - lx * s + lz * c, hw: ry ? 0.5 : len / 2, hd: ry ? len / 2 : 0.5, rot: cr, y0: cy - 2, y1: cy + h }); };
  ruin(0, -8, 12, 7, 0); ruin(-6, -3, 10, 5.5, Math.PI / 2); ruin(6, -4, 8, 3, Math.PI / 2); ruin(-6, 5.5, 5, 2.4, Math.PI / 2); ruin(-3.5, 8, 5, 4, 0); ruin(5, 8, 3, 1.6, 0);
  B.addL(MAT.stone, boxGeo(2.6, 1.1, 1.2, 1.5), R, M4(0, 0.55, -6)); // altar
  for (let i = 0; i < 12; i++) B.addL(MAT.stone, boxGeo(rand(0.4, 1), rand(0.3, 0.6), rand(0.4, 1), 1), R, M4(rand(-5, 5), 0.15, rand(-7, 7), rand(0, 3)));
  addInteract({ x: C.x - Math.sin(cr) * 5, y: cy, z: C.z - 5 * Math.cos(cr), r: 3, label: 'The ruined altar', kind: 'altar' });
  addLightSource({ x: C.x, y: cy + 1.6, z: C.z - 6, color: 0xffd090, intensity: 3, range: 8, kind: 'fire', size: 0.6 });
}
// ---------- bridges where roads cross the river ----------
function segX(a, b, c, d) { const r = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]); if (Math.abs(r) < 1e-9) return null; const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / r, u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / r; return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] : null; }
const BRIDGES = [];
function buildBridges(B) {
  for (const pts of ROADS) for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < RIVER.length - 1; j++) {
    const X = segX(pts[i], pts[i + 1], RIVER[j], RIVER[j + 1]); if (!X || BRIDGES.some((b) => Math.hypot(b.x - X[0], b.z - X[1]) < 30)) continue;
    const dx = pts[i + 1][0] - pts[i][0], dz = pts[i + 1][1] - pts[i][1], rot = Math.atan2(dx, dz) + Math.PI / 2, len = 30;
    const stone = Math.hypot(X[0] - PLACES.bridge.x, X[1] - PLACES.bridge.z) < 40;
    const ax = X[0] - Math.cos(-rot) * len / 2, az = X[1] - Math.sin(-rot) * len / 2, bx = X[0] + Math.cos(-rot) * len / 2, bz = X[1] + Math.sin(-rot) * len / 2;
    const deckY = Math.max(heightAt(ax, az), heightAt(bx, bz), riverLevelAt(j, 0.5) + 2.2) + 0.1, wlv = riverLevelAt(j, 0.5);
    const P = M4(X[0], 0, X[1], rot), W = 4.6;
    if (stone) {
      const arch = 1.8;
      for (let k = 0; k < 12; k++) { const t0 = k / 12 - 0.5, t1 = (k + 1) / 12 - 0.5, y0 = arch * (1 - (2 * t0) ** 2), y1 = arch * (1 - (2 * t1) ** 2), seg = len / 12, slope = Math.atan2(y1 - y0, seg);
        B.addL(MAT.stone, boxGeo(seg + 0.05, 1.1, W, 2), P, M4(((t0 + t1) / 2) * len, deckY + (y0 + y1) / 2 - 0.55, 0, 0, 1, 1, 1, 0, slope));
        for (const s of [-1, 1]) B.addL(MAT.stone, boxGeo(seg + 0.05, 1.1, 0.5, 1.5), P, M4(((t0 + t1) / 2) * len, deckY + (y0 + y1) / 2 + 0.5, s * (W / 2 - 0.25), 0, 1, 1, 1, 0, slope)); }
      for (const t of [-0.22, 0.22]) B.addL(MAT.stone, boxGeo(2.2, deckY - wlv + 3, W + 0.6, 2.5), P, M4(t * len, (deckY + wlv - 3) / 2, 0));
      addDeck({ x: X[0], z: X[1], hw: len / 2, hd: W / 2, rot, y: deckY, arch });
    } else {
      B.addL(MAT.wood, boxGeo(len, 0.35, W, 2), P, M4(0, deckY - 0.17, 0));
      for (let k = -6; k <= 6; k++) for (const s of [-1, 1]) { B.addL(MAT.darkWood, boxGeo(0.25, deckY - wlv + 2.6, 0.25), P, M4(k * len / 13, (deckY + wlv) / 2 - 0.3 + 0.4, s * (W / 2 - 0.1))); }
      for (const s of [-1, 1]) B.addL(MAT.darkWood, boxGeo(len, 0.14, 0.14), P, M4(0, deckY + 1, s * (W / 2 - 0.1)));
      addDeck({ x: X[0], z: X[1], hw: len / 2, hd: W / 2, rot, y: deckY });
    }
    for (const s of [-1, 1]) addCollider({ kind: 'box', x: X[0] + Math.sin(rot) * s * (W / 2 + 0.1), z: X[1] + Math.cos(rot) * s * (W / 2 + 0.1), hw: len / 2 - 2, hd: 0.25, rot, y0: deckY - 0.2, y1: deckY + 1.2 });
    BRIDGES.push({ x: X[0], z: X[1], rot, stone, deckY, water: wlv });
  }
}
// ---------- the old mill ----------
function buildMill(B) {
  const M = PLACES.mill, h = buildHouse(B, M.x, M.z, 9, 8, Math.PI / 2, 'inn', 'The Old Mill');
  addInteract({ x: h.door[0], y: h.door[1], z: h.door[2], r: 2.5, label: 'The Old Mill', kind: 'mill' });
  const wheel = new THREE.Group(), wy = h.gy + 1.6; wheel.position.set(M.x - 6.4, wy, M.z);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.16, 6, 24), MAT.darkWood); ring.rotation.y = Math.PI / 2; wheel.add(ring);
  const ring2 = ring.clone(); ring2.position.x = 0.9; wheel.add(ring2);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, pad = new THREE.Mesh(boxGeo(1.1, 0.12, 1.2), MAT.wood); pad.position.set(0.45, Math.sin(a) * 3.2, Math.cos(a) * 3.2); pad.rotation.x = -a; wheel.add(pad); const sp = new THREE.Mesh(boxGeo(0.12, 6.6, 0.12), MAT.darkWood); sp.rotation.x = a; sp.position.x = 0.45; wheel.add(sp); }
  wheel.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  WORLD.root.add(wheel); ANIM.push({ kind: 'wheel', obj: wheel, speed: 0.6 });
}
// ---------- hunter camps ----------
function buildCamp(B, c) {
  const y = heightAt(c.x, c.z), P = M4(c.x, y, c.z, hash2(c.x | 0, c.z | 0, 1) * TAU);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; B.addL(MAT.rock, new THREE.DodecahedronGeometry(0.26, 0), P, M4(Math.cos(a) * 0.9, 0.1, Math.sin(a) * 0.9, a)); }
  for (let i = 0; i < 3; i++) B.addL(MAT.bark, new THREE.CylinderGeometry(0.1, 0.12, 1.3, 6), P, M4(0, 0.25, 0, (i / 3) * TAU, 1, 1, 1, 1.2));
  B.addL(MAT.canvas, roofGeo(2.6, 2.4, 1.7, 0.05), P, M4(3.6, 0, -1.6, 0.6)); B.addL(MAT.canvas, gableGeo(2.4, 1.7), P, M4(3.6 - Math.cos(0.6) * 1.3, 0, -1.6 + Math.sin(0.6) * 1.3, 0.6));
  B.addL(MAT.bark, new THREE.CylinderGeometry(0.22, 0.22, 2, 8), P, M4(-2.4, 0.22, 0.6, 0, 1, 1, 1, 0, Math.PI / 2));
  // the signpost
  B.addL(MAT.darkWood, boxGeo(0.2, 2.8, 0.2), P, M4(-1.8, 1.4, -2.4));
  for (let k = 0; k < 3; k++) B.addL(MAT.wood, boxGeo(1.3, 0.3, 0.06), P, M4(-1.5, 2.4 - k * 0.42, -2.4, k * 1.9));
  B.addL(MAT.cloth, boxGeo(0.06, 0.6, 0.4), P, M4(-1.8, 2.65, -2.35));
  const fx = c.x, fz = c.z; addLightSource({ x: fx, y: y + 0.7, z: fz, color: 0xff7a30, intensity: 9, range: 16, kind: 'fire', size: 1.7, always: true, camp: c.id });
  addCollider({ kind: 'circle', x: fx, z: fz, r: 0.9, y0: y - 1, y1: y + 0.6 });
  addInteract({ x: fx, y, z: fz, r: 3.2, label: c.name + ': rest, cook, fast travel', kind: 'camp', camp: c.id });
  WORLD.fires = WORLD.fires || []; WORLD.fires.push({ x: fx, y: y + 0.4, z: fz, camp: c.id });
}
// ---------- the swamp witch, the nest, the shrine, the den ----------
function buildWitch(B) {
  const W = PLACES.witch, y = SWAMP_LEVEL + 1.7, P = M4(W.x, y, W.z, 0.4);
  for (const [px2, pz2] of [[-3, -3], [3, -3], [-3, 3], [3, 3], [0, 4.2]]) B.addL(MAT.darkWood, new THREE.CylinderGeometry(0.18, 0.2, 4, 6), P, M4(px2, -1.8, pz2));
  B.addL(MAT.darkWood, boxGeo(8, 0.3, 9.5), P, M4(0, 0, 0.5));
  B.addL(MAT.timber, boxGeo(5.5, 3.2, 5.5, 3), P, M4(0, 1.75, -0.5)); B.addL(MAT.thatch, roofGeo(5.5, 5.5, 2.6, 0.7), P, M4(0, 3.35, -0.5));
  B.addL(MAT.timber, gableGeo(5.5, 2.6), P, M4(-2.75, 3.35, -0.5)); B.addL(MAT.timber, gableGeo(5.5, 2.6), P, M4(2.75, 3.35, -0.5, Math.PI));
  B.addL(MAT.darkWood, boxGeo(1.2, 2.1, 0.15), P, M4(0, 1.2, 2.3)); B.addL(MAT.window, boxGeo(0.7, 0.7, 0.1), P, M4(1.8, 2, 2.27));
  B.addL(MAT.iron, new THREE.SphereGeometry(0.7, 10, 6, 0, TAU, Math.PI / 2, Math.PI / 2), P, M4(1.5, 0.75, 3.4)); B.addL(MAT.glowGreen, new THREE.CircleGeometry(0.62, 12), P, M4(1.5, 0.74, 3.4, 0, 1, 1, 1, -Math.PI / 2));
  for (const [sx, sz] of [[-3.6, 4.8], [3.6, 4.8]]) { B.addL(MAT.darkWood, boxGeo(0.12, 2.2, 0.12), P, M4(sx, 1.1, sz)); B.addL(MAT.bone, new THREE.SphereGeometry(0.25, 8, 6), P, M4(sx, 2.3, sz)); }
  addDeck({ x: W.x, z: W.z, hw: 4.6, hd: 5.4, rot: 0.4, y });
  addLightSource({ x: W.x + 1.5, y: y + 1.2, z: W.z + 3.4, color: 0x6aff40, intensity: 5, range: 12, kind: 'magic', size: 1.4, always: true });
  addInteract({ x: W.x + Math.sin(0.4) * 3.2, y, z: W.z + Math.cos(0.4) * 3.2, r: 3, label: "Morwen's hut", kind: 'witch' });
  // a plank walkway from the bank
  for (let i = 0; i < 9; i++) { const x = W.x + 6 + i * 3.4, z = W.z + 4 + i * 1.2; B.add(MAT.wood, boxGeo(3.6, 0.2, 1.6), M4(x, SWAMP_LEVEL + 1.1 + i * 0.05, z, -0.34)); addDeck({ x, z, hw: 1.9, hd: 0.9, rot: -0.34, y: SWAMP_LEVEL + 1.2 + i * 0.05 }); }
}
function buildNest(B) {
  const N = PLACES.nest, y = heightAt(N.x, N.z), rnd = mulberry32(17);
  for (let i = 0; i < 90; i++) { const a = rnd() * TAU, r = 6 + rnd() * 2.5; B.add(i % 7 ? MAT.bark : MAT.bone, new THREE.CylinderGeometry(0.12, 0.18, rand(3, 6), 5), M4(N.x + Math.cos(a) * r, y + 0.6 + rnd() * 0.8, N.z + Math.sin(a) * r, rnd() * TAU, 1, 1, 1, Math.PI / 2 + rand(-0.4, 0.4))); }
  for (let i = 0; i < 4; i++) B.add(new THREE.MeshStandardMaterial({ color: 0xc8c0a0, roughness: 0.5 }), new THREE.SphereGeometry(0.6, 10, 8), M4(N.x + rand(-2, 2), y + 0.5, N.z + rand(-2, 2), 0, 1, 1.3, 1));
  for (let i = 0; i < 14; i++) B.add(MAT.bone, new THREE.CylinderGeometry(0.06, 0.08, rand(0.6, 1.4), 5), M4(N.x + rand(-12, 12), y + 0.1, N.z + rand(-12, 12), rand(0, TAU), 1, 1, 1, Math.PI / 2));
}
const SHRINE = { door: null };
function buildShrine(B) {
  const S0 = PLACES.shrine, y = shrineLevel(), rnd = mulberry32(19);
  for (let i = 0; i < 26; i++) { const a = -Math.PI * 0.95 + (i / 25) * Math.PI * 0.9, r = 6 + rnd() * 1.5; B.add(MAT.rock, new THREE.DodecahedronGeometry(2 + rnd() * 1.6, 0), M4(S0.x + Math.cos(a) * r + 4, y + 1 + Math.abs(Math.sin(a)) * 4 + rnd(), S0.z + Math.sin(a) * r, rnd() * 3)); }
  B.add(new THREE.MeshBasicMaterial({ color: 0x050203 }), new THREE.CircleGeometry(3.6, 16, 0, Math.PI), M4(S0.x + 2.2, y, S0.z, Math.PI / 2));
  for (let i = 0; i < 5; i++) B.add(MAT.glowRed, boxGeo(0.12, 0.8, 0.12), M4(S0.x + 3.2, y + 1 + i * 0.7, S0.z - 3.6 + (i % 2) * 7.2, 0, 1, 1, 1, 0, 0.4));
  for (const s of [-1, 1]) { B.add(MAT.iron, new THREE.CylinderGeometry(0.3, 0.2, 1.2, 8), M4(S0.x + 6, y + 0.6, S0.z + s * 4)); addLightSource({ x: S0.x + 6, y: y + 1.5, z: S0.z + s * 4, color: 0xff3010, intensity: 8, range: 14, kind: 'fire', size: 1.5 }); }
  SHRINE.door = addInteract({ x: S0.x + 5, y, z: S0.z, r: 3.5, label: 'The Hungering Shrine', kind: 'shrine' });
}
function buildDen(B) {
  const D = PLACES.den, y = heightAt(D.x, D.z), rnd = mulberry32(23);
  for (let i = 0; i < 14; i++) { const a = Math.PI * 0.2 + (i / 13) * Math.PI * 1.6, r = 5 + rnd() * 2; B.add(MAT.rock, new THREE.DodecahedronGeometry(1.6 + rnd() * 1.4, 0), M4(D.x + Math.cos(a) * r, y + 0.6 + rnd() * 1.5, D.z + Math.sin(a) * r, rnd() * 3)); addCollider({ kind: 'circle', x: D.x + Math.cos(a) * r, z: D.z + Math.sin(a) * r, r: 1.8, y0: y - 2, y1: y + 3 }); }
  for (let i = 0; i < 20; i++) B.add(MAT.bone, new THREE.CylinderGeometry(0.05, 0.07, rand(0.4, 1.2), 5), M4(D.x + rand(-4, 4), y + 0.08, D.z + rand(-4, 4), rand(0, TAU), 1, 1, 1, Math.PI / 2));
  B.add(MAT.bone, new THREE.SphereGeometry(0.3, 8, 6), M4(D.x + 1.5, y + 0.2, D.z - 1, 0, 1, 0.8, 1.2));
}
// ---------- farms ----------
function buildFarms(B) {
  const F = PLACES.farms, rnd = mulberry32(29);
  const fence = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(len / 3); for (let i = 0; i <= n; i++) { const t = i / n, x = lerp(x0, x1, t), z = lerp(z0, z1, t), y = heightAt(x, z); B.add(MAT.darkWood, boxGeo(0.16, 1.3, 0.16), M4(x, y + 0.6, z)); if (i < n) { const x2 = lerp(x0, x1, (i + 1) / n), z2 = lerp(z0, z1, (i + 1) / n), r = Math.atan2(x2 - x, z2 - z) + Math.PI / 2, ln = Math.hypot(x2 - x, z2 - z); for (const hh of [0.5, 1]) B.add(MAT.wood, boxGeo(ln, 0.1, 0.07), M4((x + x2) / 2, (y + heightAt(x2, z2)) / 2 + hh, (z + z2) / 2, r)); } } };
  fence(F.x - 68, F.z - 52, F.x + 68, F.z - 52); fence(F.x + 68, F.z - 52, F.x + 68, F.z + 52); fence(F.x - 68, F.z + 52, F.x + 68, F.z + 52);
  for (let i = 0; i < 9; i++) { const x = F.x + rand(-60, 60), z = F.z + rand(-45, 45), y = heightAt(x, z); if (surfaceAt(x, z) !== SURF.FIELD) continue; B.add(MAT.hay, new THREE.CylinderGeometry(0.9, 0.9, 1.4, 12), M4(x, y + 0.7, z, 0, 1, 1, 1, Math.PI / 2, rnd())); addCollider({ kind: 'circle', x, z, r: 1, y0: y - 1, y1: y + 1.6 }); }
  // scarecrow
  const sx = F.x - 20, sz = F.z + 8, sy = heightAt(sx, sz);
  B.add(MAT.darkWood, boxGeo(0.14, 2.6, 0.14), M4(sx, sy + 1.3, sz)); B.add(MAT.darkWood, boxGeo(1.8, 0.12, 0.12), M4(sx, sy + 2.1, sz)); B.add(MAT.cloth, boxGeo(0.9, 0.9, 0.3), M4(sx, sy + 1.8, sz)); B.add(MAT.hay, new THREE.SphereGeometry(0.28, 8, 6), M4(sx, sy + 2.55, sz)); B.add(MAT.darkWood, new THREE.ConeGeometry(0.4, 0.4, 8), M4(sx, sy + 2.85, sz));
  // farmhouse and windmill
  buildHouse(B, F.x + 48, F.z - 30, 9, 7, -Math.PI / 2, 'house');
  const wx = F.x + 58, wz = F.z + 32, wy = heightAt(wx, wz);
  B.add(MAT.stone, new THREE.CylinderGeometry(2.4, 3.4, 11, 10), M4(wx, wy + 5.5, wz)); B.add(MAT.roof, new THREE.ConeGeometry(3.2, 3.5, 10), M4(wx, wy + 12.7, wz));
  addCollider({ kind: 'circle', x: wx, z: wz, r: 3.4, y0: wy - 2, y1: wy + 14 });
  const sails = new THREE.Group(); sails.position.set(wx, wy + 10, wz + 3);
  for (let i = 0; i < 4; i++) { const arm = new THREE.Group(); arm.rotation.z = (i / 4) * TAU; const pole = new THREE.Mesh(boxGeo(0.2, 7, 0.2), MAT.darkWood); pole.position.y = 3.5; arm.add(pole); const sail = new THREE.Mesh(boxGeo(1.6, 5.2, 0.05), MAT.canvas); sail.position.set(0.9, 4.2, 0); arm.add(sail); sails.add(arm); }
  sails.traverse((o) => { if (o.isMesh) o.castShadow = true; }); WORLD.root.add(sails); ANIM.push({ kind: 'sails', obj: sails, speed: 0.35 });
}
function buildPlaces() {
  const B = new Batch();
  buildTown(B); buildCastle(B); buildGraveyard(B); buildBridges(B); buildMill(B);
  for (const c of CAMPS) buildCamp(B, c);
  buildWitch(B); buildNest(B); buildShrine(B); buildDen(B); buildFarms(B);
  B.build(WORLD.root, true);
}
function updateAnims(dt, t) {
  for (const a of ANIM) {
    if (a.kind === 'wheel') a.obj.rotation.x -= dt * a.speed;
    else if (a.kind === 'sails') a.obj.rotation.z += dt * a.speed * (0.6 + Weather.wind);
    else if (a.kind === 'lift') { if (a.obj.position.y < a.to) a.obj.position.y = Math.min(a.to, a.obj.position.y + dt * 1.6); }
    else if (a.kind === 'flag') { const p = a.mesh.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = a.base[i * 3], k = (x + 1.5) / 3; p.setZ(i, Math.sin(t * 4 + x * 2) * 0.35 * k * (0.4 + Weather.wind)); } p.needsUpdate = true; }
  }
}
