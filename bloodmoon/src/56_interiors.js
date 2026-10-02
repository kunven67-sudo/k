// =====================================================================
// INTERIORS — your old house (bed, fireplace, alchemy table, trophy
// wall), the great hall of Castle Vargrave, and the Hungering Shrine.
// They are built far outside the valley; the outside is hidden while
// you are in one.
// =====================================================================
const INT_X = 2600;
function floorAt(x, z, fromY = 1e9) { if (x > INT_X - 100) { const I = Interiors.at(x); return I ? I.y : 400; } return groundAt(x, z, fromY); }
const Interiors = {
  root: null, defs: {}, dirty: true, trophyRoot: null,
  at(x) { for (const k in this.defs) { const I = this.defs[k]; if (Math.abs(x - I.x) < 150) return I; } return null; },
  cur() { return this.defs[G.area] || null; },
  build() {
    this.root = new THREE.Group(); this.root.visible = false; scene.add(this.root);
    this.buildHome(); this.buildHall(); this.buildShrine();
  },
  room(I, w, d, h, wallMat, floorMat, ceil = true) {
    const B = new Batch(), P = M4(I.x, I.y, I.z);
    B.addL(floorMat, boxGeo(w, 0.4, d, 2), P, M4(0, -0.2, 0));
    for (const [x, z, ww, dd] of [[0, -d / 2, w, 0.5], [0, d / 2, w, 0.5], [-w / 2, 0, 0.5, d], [w / 2, 0, 0.5, d]]) { B.addL(wallMat, boxGeo(ww, h, dd, 2.5), P, M4(x, h / 2, z)); addCollider({ kind: 'box', x: I.x + x, z: I.z + z, hw: ww / 2 + 0.1, hd: dd / 2 + 0.1, rot: 0, y0: I.y - 5, y1: I.y + h + 5 }); }
    if (ceil) B.addL(MAT.darkWood, boxGeo(w, 0.3, d, 2), P, M4(0, h + 0.15, 0));
    addDeck({ x: I.x, z: I.z, hw: w / 2, hd: d / 2, y: I.y });
    return B;
  },
  light(I, x, y, z, color, intensity, range, kind, size) { return addLightSource({ x: I.x + x, y: I.y + y, z: I.z + z, color, intensity, range, kind, size, always: true, area: I.id, parent: this.root }); },
  // ---------- your old house ----------
  buildHome() {
    const I = (this.defs.home = { id: 'home', name: 'Your old house', x: INT_X, y: 400, z: 0, spawn: [0, 3.2, Math.PI], music: 'sad', exitTo: () => { const d = WORLD.interact.find((e) => e.kind === 'home'); return d ? [d.x, d.z] : [PLACES.home.x, PLACES.home.z + 8]; } });
    const B = this.room(I, 10, 8, 3.4, MAT.timber, MAT.wood), P = M4(I.x, I.y, I.z);
    // fireplace on the west wall
    B.addL(MAT.stone, boxGeo(0.9, 3.4, 2.6, 2), P, M4(-4.5, 1.7, -1)); B.addL(MAT.darkWood, boxGeo(0.4, 1, 1.4), P, M4(-4.15, 0.5, -1));
    this.light(I, -3.8, 0.6, -1, 0xff8a3a, 10, 12, 'fire', 1.2); I.fire = [I.x - 3.8, I.z - 1];
    // bed in the north-east corner
    B.addL(MAT.wood, boxGeo(1.6, 0.5, 2.4), P, M4(3.8, 0.25, -2.6)); B.addL(new THREE.MeshStandardMaterial({ color: 0x8a2a20, roughness: 1 }), boxGeo(1.5, 0.2, 1.9), P, M4(3.8, 0.6, -2.4)); B.addL(new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 1 }), boxGeo(1.2, 0.18, 0.45), P, M4(3.8, 0.65, -3.5));
    addCollider({ kind: 'box', x: I.x + 3.8, z: I.z - 2.6, hw: 0.85, hd: 1.25, y0: I.y - 1, y1: I.y + 0.7 });
    this.addIt(I, 3.8, -1.2, 'bed', 'Sleep');
    // alchemy table by the east wall
    B.addL(MAT.darkWood, boxGeo(1.0, 0.9, 2.0), P, M4(4.4, 0.45, 1.4)); for (let i = 0; i < 4; i++) B.addL(new THREE.MeshStandardMaterial({ color: [0xc02020, 0x40c040, 0x4060e0, 0xd08020][i], roughness: 0.2, transparent: true, opacity: 0.8 }), new THREE.CylinderGeometry(0.06, 0.08, 0.22, 8), P, M4(4.3, 1.02, 0.7 + i * 0.4));
    addCollider({ kind: 'box', x: I.x + 4.4, z: I.z + 1.4, hw: 0.55, hd: 1.05, y0: I.y - 1, y1: I.y + 1 }); this.addIt(I, 3.4, 1.4, 'alchemy', 'Alchemy table');
    // table and chair, rug
    B.addL(MAT.wood, boxGeo(1.6, 0.08, 1.0), P, M4(0.5, 0.8, 0.8)); for (const [x, z] of [[-0.2, 0.4], [1.2, 0.4], [-0.2, 1.2], [1.2, 1.2]]) B.addL(MAT.wood, boxGeo(0.08, 0.8, 0.08), P, M4(x, 0.4, z));
    B.addL(new THREE.MeshStandardMaterial({ color: 0x5a2a20, roughness: 1 }), boxGeo(3, 0.02, 2), P, M4(-1.2, 0.01, 1.2));
    addCollider({ kind: 'box', x: I.x + 0.5, z: I.z + 0.8, hw: 0.85, hd: 0.55, y0: I.y - 1, y1: I.y + 0.9 });
    // window glow, a lantern
    B.addL(MAT.window, boxGeo(1, 1, 0.1), P, M4(-2, 1.8, -3.78)); this.light(I, 0.5, 1.15, 0.8, 0xffc070, 3, 7, 'fire', 0.5);
    // door
    B.addL(MAT.darkWood, boxGeo(1.4, 2.3, 0.15), P, M4(0, 1.15, 3.8)); this.addIt(I, 0, 3.2, 'exit', 'Go outside');
    // the trophy wall (north wall, left side)
    B.addL(MAT.darkWood, boxGeo(5.6, 2.2, 0.12), P, M4(-1.5, 1.9, -3.72)); this.addIt(I, -1.5, -2.6, 'trophies', 'Trophy wall');
    B.build(this.root, true);
    this.trophyRoot = new THREE.Group(); this.trophyRoot.position.set(I.x - 1.5, I.y + 1.9, I.z - 3.6); this.root.add(this.trophyRoot);
  },
  // heads and plaques for every trophy you own
  refreshTrophies() {
    if (!this.trophyRoot || !G.save) return; this.dirty = false; this.trophyRoot.clear();
    const owned = G.save.player.trophies, ids = Object.keys(TROPHIES);
    ids.forEach((id, i) => {
      const col = i % 7, row = Math.floor(i / 7), x = -2.4 + col * 0.8, y = 0.5 - row * 1.0, g = new THREE.Group(); g.position.set(x, y, 0.05); this.trophyRoot.add(g);
      const plaque = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 6), MAT.wood); plaque.rotation.x = Math.PI / 2; g.add(plaque);
      if (!owned[id]) return;
      const T = TROPHIES[id], m = mat(T.col, { roughness: 0.8 }), head = new THREE.Group(); head.position.z = 0.15; g.add(head);
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), m); s.scale.set(1, 0.9, 1.1); head.add(s);
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.2), m); snout.position.set(0, -0.04, 0.16); head.add(snout);
      const horn = /wyvern|azgoreth|demon/.test(id) ? 1 : /werewolf|mill_beast|fiend/.test(id) ? 2 : 0;
      for (const sd of [-1, 1]) { if (horn === 1) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.22, 5), MAT.bone || mat(0xe8dcc0)); h.position.set(sd * 0.1, 0.14, -0.02); h.rotation.set(-0.5, 0, sd * -0.4); head.add(h); } else if (horn === 2) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), m); e.position.set(sd * 0.09, 0.15, 0); head.add(e); } }
      const eye = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: id === 'azgoreth' ? 0xff4010 : 0x302010, emissiveIntensity: 1.5 }); for (const sd of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), eye); e.position.set(sd * 0.06, 0.03, 0.15); head.add(e); }
    });
  },
  addIt(I, x, z, kind, label) { return addInteract({ x: I.x + x, y: I.y, z: I.z + z, r: 1.8, label, kind, area: I.id }); },
  // ---------- the great hall ----------
  buildHall() {
    const I = (this.defs.castle = { id: 'castle', name: 'The Great Hall', x: INT_X + 300, y: 400, z: 0, spawn: [0, 17, Math.PI], music: 'castle', exitTo: () => [CASTLE.keepDoor.x, CASTLE.keepDoor.z + 2] });
    const B = this.room(I, 18, 40, 9, MAT.stone, MAT.cobble || MAT.stone), P = M4(I.x, I.y, I.z);
    // pillars, the long table with candles, banners, the throne on its steps
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const z = -15 + i * 6; B.addL(MAT.stone, new THREE.CylinderGeometry(0.55, 0.65, 9, 10), P, M4(s * 6.5, 4.5, z)); addCollider({ kind: 'circle', x: I.x + s * 6.5, z: I.z + z, r: 0.7, y0: I.y - 1, y1: I.y + 10 }); B.addL(new THREE.MeshStandardMaterial({ color: 0x6a0a10, roughness: 0.9, side: THREE.DoubleSide }), new THREE.PlaneGeometry(1.4, 3.5), P, M4(s * 8.7, 5.5, z, s * -Math.PI / 2)); this.light(I, s * 6.5, 3.2, z + (s > 0 ? 0.7 : -0.7), 0xff8030, 6, 13, 'torch', 1.2); }
    B.addL(MAT.darkWood, boxGeo(2.4, 0.15, 20), P, M4(0, 1.0, 1)); for (const s of [-1, 1]) B.addL(MAT.darkWood, boxGeo(0.5, 0.5, 20), P, M4(s * 1.9, 0.25, 1));
    B.addL(new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 1 }), boxGeo(2.6, 0.04, 20.2), P, M4(0, 1.09, 1));
    for (let i = 0; i < 7; i++) { B.addL(mat(0xe8e0c8), new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6), P, M4(0, 1.26, -8 + i * 3)); if (i % 2 === 0) this.light(I, 0, 1.5, -8 + i * 3, 0xffc070, 2.5, 6, 'fire', 0.35); B.addL(MAT.iron, new THREE.CylinderGeometry(0.2, 0.15, 0.08, 10), P, M4(0.7, 1.12, -8 + i * 3)); B.addL(MAT.iron, new THREE.CylinderGeometry(0.2, 0.15, 0.08, 10), P, M4(-0.7, 1.12, -6.5 + i * 3)); }
    addCollider({ kind: 'box', x: I.x, z: I.z + 1, hw: 1.4, hd: 10.1, y0: I.y - 1, y1: I.y + 1.1 });
    B.addL(MAT.stone, boxGeo(10, 0.5, 4), P, M4(0, 0.25, -17.5)); B.addL(MAT.stone, boxGeo(8, 0.5, 3), P, M4(0, 0.75, -18));
    B.addL(new THREE.MeshStandardMaterial({ color: 0x3a0a10, roughness: 0.6 }), boxGeo(1.6, 3.6, 0.5), P, M4(0, 2.8, -19.2)); B.addL(MAT.darkWood, boxGeo(1.6, 0.7, 1.2), P, M4(0, 1.35, -18.7));
    addDeck({ x: I.x, z: I.z - 17.5, hw: 5, hd: 2, y: I.y + 0.5 }); addDeck({ x: I.x, z: I.z - 18, hw: 4, hd: 1.5, y: I.y + 1.0 });
    B.addL(new THREE.MeshStandardMaterial({ color: 0x5a0a10, roughness: 1 }), boxGeo(3, 0.03, 30), P, M4(0, 0.02, -2)); // long red carpet
    B.addL(MAT.window, boxGeo(3, 6, 0.2), P, M4(0, 5.5, -19.75)); this.light(I, 0, 6, -19, 0xff3030, 6, 20, 'magic', 2);
    B.addL(MAT.darkWood, boxGeo(3, 4, 0.2), P, M4(0, 2, 19.8)); this.addIt(I, 0, 18.4, 'exit', 'Leave the castle');
    B.build(this.root, true);
  },
  // ---------- the shrine ----------
  buildShrine() {
    const I = (this.defs.shrine = { id: 'shrine', name: 'The Hungering Shrine', x: INT_X + 600, y: 400, z: 0, spawn: [0, 19, Math.PI], music: 'shrine', exitTo: () => [SHRINE.door.x + 3, SHRINE.door.z] });
    const R = 24, P = M4(I.x, I.y, I.z), B = new Batch();
    B.addL(MAT.rock, boxGeo(R * 2.2, 0.4, R * 2.2, 3), P, M4(0, -0.2, 0)); addDeck({ x: I.x, z: I.z, hw: R + 2, hd: R + 2, y: I.y });
    // the cave wall: a jagged cylinder seen from inside
    const wall = new THREE.CylinderGeometry(R, R + 3, 18, 40, 6, true); jitterGeo(wall, 1.8, 7); B.addL(new THREE.MeshStandardMaterial({ map: TEX.rock, color: 0x5a4a44, roughness: 1, side: THREE.BackSide }), wall, P, M4(0, 8, 0));
    const roof = new THREE.SphereGeometry(R + 2, 30, 10, 0, TAU, 0, Math.PI / 2); jitterGeo(roof, 2, 9); B.addL(new THREE.MeshStandardMaterial({ map: TEX.rock, color: 0x3a2e2a, roughness: 1, side: THREE.BackSide }), roof, P, M4(0, 15, 0, 0, 1, 0.5, 1));
    for (let i = 0; i < 40; i++) { const a = (i / 40) * TAU; addCollider({ kind: 'circle', x: I.x + Math.cos(a) * (R + 1.2), z: I.z + Math.sin(a) * (R + 1.2), r: 2.4, y0: I.y - 5, y1: I.y + 20 }); }
    // glowing cracks in the floor, black pillars, the altar of bones
    const lava = new THREE.MeshStandardMaterial({ color: 0x200000, emissive: 0xff3a08, emissiveIntensity: 2.2, roughness: 0.8 });
    for (let i = 0; i < 26; i++) { const a = rand(0, TAU), r = rand(3, R - 3), len = rand(2, 6); B.addL(lava, boxGeo(0.25, 0.05, len), P, M4(Math.cos(a) * r, 0.02, Math.sin(a) * r, rand(0, TAU))); }
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3, x = Math.cos(a) * 15, z = Math.sin(a) * 15; B.addL(new THREE.MeshStandardMaterial({ color: 0x1a1414, roughness: 0.5 }), new THREE.CylinderGeometry(0.9, 1.3, 11, 7), P, M4(x, 5.5, z)); addCollider({ kind: 'circle', x: I.x + x, z: I.z + z, r: 1.3, y0: I.y - 1, y1: I.y + 12 }); this.light(I, x * 0.92, 3, z * 0.92, 0xff3010, 7, 14, 'fire', 1.4); }
    B.addL(MAT.stone, new THREE.CylinderGeometry(3, 3.6, 1.2, 9), P, M4(0, 0.6, -14)); for (let i = 0; i < 12; i++) B.addL(mat(0xe8dcc0), new THREE.SphereGeometry(rand(0.12, 0.25), 6, 5), P, M4(rand(-2.5, 2.5), 1.3, -14 + rand(-2, 2)));
    addCollider({ kind: 'circle', x: I.x, z: I.z - 14, r: 3.4, y0: I.y - 1, y1: I.y + 1.4 }); this.light(I, 0, 3, -14, 0xff2a0a, 14, 30, 'magic', 3);
    this.addIt(I, 0, 21, 'exit', 'Leave the shrine');
    B.build(this.root, true);
  },
  // ---------- going in and out ----------
  enter(id, then) {
    const I = this.defs[id], p = G.p; if (!I) return;
    UI.fade(() => {
      if (p.mounted) dismount();
      G.outPos = { x: p.x, z: p.z, yaw: p.yaw };
      G.area = id; this.root.visible = true; WORLD.root.visible = false; Sky.mesh.visible = false; RainFX.mesh.visible = false;
      p.x = I.x + I.spawn[0]; p.z = I.z + I.spawn[1]; p.y = I.y; p.yaw = I.spawn[2]; p.pitch = 0; p.vx = p.vy = p.vz = 0; p.swim = false;
      if (id === 'home' && this.dirty) this.refreshTrophies();
      Sfx.play('door'); Music.set(I.music); Amb.set(id === 'shrine' ? { cave: 1 } : id === 'home' ? { fire: 0.5 } : { cave: 0.3 }); autosave();
      if (then) then();
    });
  },
  exit() {
    const I = this.cur(), p = G.p; if (!I) return;
    if (Story.lockedIn()) { UI.toast('The way out is sealed!', 'bad'); return; }
    UI.fade(() => {
      const [x, z] = I.exitTo(); G.area = 'outside'; this.root.visible = false; WORLD.root.visible = true; Sky.mesh.visible = true;
      p.x = x; p.z = z; p.y = floorAt(x, z) + 0.1; p.yaw = (G.outPos && G.outPos.yaw != null ? G.outPos.yaw : 0) + Math.PI; p.vx = p.vy = p.vz = 0;
      Sfx.play('door'); updateTrees(p.x, p.z, true); updateGrass(p.x, p.z, true); autosave();
    });
  },
};
