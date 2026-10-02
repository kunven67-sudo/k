
// =====================================================================
// MODELS — people, beasts and the horse, built from shapes with joints so
// they can walk, run, fight, die, and lose limbs.
// =====================================================================
const _matCache = new Map();
function mat(col, o = {}) { const k = col + JSON.stringify(o); let m = _matCache.get(k); if (!m) { m = new THREE.MeshStandardMaterial(Object.assign({ color: col, roughness: 0.8, envMapIntensity: 0.3 }, o)); _matCache.set(k, m); } return m; }
function part(geo, m, x = 0, y = 0, z = 0, parent, name) { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; if (name) me.name = name; if (parent) parent.add(me); return me; }
function joint(x, y, z, parent, name) { const g = new THREE.Group(); g.position.set(x, y, z); g.name = name || ''; if (parent) parent.add(g); return g; }
const cap = (r, len, rs = 8) => new THREE.CapsuleGeometry(r, len, 3, rs);
const col3 = (c) => (typeof c === 'string' ? new THREE.Color(c).getHex() : c);
// ---------- people ----------
// look: { skin, hair, hairCol, beard, scar, eyes, coat, shirt, body (0..2), face (0..3), helm, hood, robe, cape, apron }
function buildHuman(look, o = {}) {
  const L = look || {}, root = new THREE.Group(), rig = { root, kind: 'human', parts: {} };
  const bw = [0.88, 1, 1.15][L.body == null ? 1 : L.body], skin = mat(col3(L.skin || '#e0b090'), { roughness: 0.65 }), coat = mat(col3(L.coat || '#3a3028'), { roughness: 0.9 }), shirt = mat(col3(L.shirt || '#8a7a6a'), { roughness: 0.95 });
  const pants = mat(o.pants || 0x2a2420, { roughness: 0.95 }), boots = mat(0x1e1610, { roughness: 0.7 }), hairM = mat(col3(L.hairCol || L.hair || '#3a2414'), { roughness: 0.9 });
  const S = o.scale || 1; root.scale.setScalar(S);
  const hips = joint(0, 0.98, 0, root, 'hips'); rig.hips = hips;
  part(new THREE.CylinderGeometry(0.17 * bw, 0.16 * bw, 0.22, 10), pants, 0, 0, 0, hips);
  // legs
  for (const s of [-1, 1]) {
    const th = joint(s * 0.1 * bw, -0.05, 0, hips, s < 0 ? 'thighL' : 'thighR'); part(cap(0.075 * bw, 0.34), pants, 0, -0.22, 0, th);
    const sh = joint(0, -0.44, 0, th, s < 0 ? 'shinL' : 'shinR'); part(cap(0.065 * bw, 0.32), pants, 0, -0.2, 0, sh);
    const ft = part(new THREE.BoxGeometry(0.11 * bw, 0.09, 0.24), boots, 0, -0.42, 0.04, sh); part(cap(0.072 * bw, 0.14), boots, 0, -0.3, 0, sh);
    rig[s < 0 ? 'thighL' : 'thighR'] = th; rig[s < 0 ? 'shinL' : 'shinR'] = sh;
  }
  // torso
  const spine = joint(0, 0.1, 0, hips, 'spine'); rig.spine = spine;
  part(new THREE.CylinderGeometry(0.2 * bw, 0.17 * bw, 0.5, 10), shirt, 0, 0.27, 0, spine);
  const chest = part(new THREE.CylinderGeometry(0.235 * bw, 0.205 * bw, 0.32, 10), coat, 0, 0.42, 0, spine); chest.scale.z = 0.78;
  part(new THREE.CylinderGeometry(0.205 * bw, 0.215 * bw, 0.26, 10, 1, true), coat, 0, 0.17, 0, spine).scale.z = 0.8;
  // coat skirt flaps
  const skirt = part(new THREE.CylinderGeometry(0.21 * bw, L.robe ? 0.34 * bw : 0.27 * bw, L.robe ? 0.9 : 0.42, 10, 1, true), coat, 0, L.robe ? -0.4 : -0.14, 0, hips); skirt.scale.z = 0.85; skirt.material = mat(col3(L.coat || '#3a3028'), { roughness: 0.9, side: THREE.DoubleSide });
  part(new THREE.TorusGeometry(0.19 * bw, 0.03, 4, 12), mat(0x3a2414), 0, 0.03, 0, spine).rotation.x = Math.PI / 2;
  if (L.apron) part(new THREE.BoxGeometry(0.3 * bw, 0.6, 0.02), mat(0x5a4a3a), 0, 0.05, 0.19 * bw, spine);
  // neck and head
  const neck = joint(0, 0.62, 0, spine, 'neck'); part(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8), skin, 0, 0.04, 0, neck);
  const head = joint(0, 0.14, 0, neck, 'head'); rig.head = head; rig.neck = neck;
  const fw = [0.98, 1.04, 1.1, 0.92][L.face || 0], skull = part(new THREE.SphereGeometry(0.115, 14, 12), skin, 0, 0.06, 0, head); skull.scale.set(fw, 1.12, 1.02);
  const jaw = part(new THREE.BoxGeometry(0.15 * fw, 0.07, 0.12), skin, 0, -0.02, 0.03, head); jaw.scale.set(1, 1, L.face === 2 ? 1.1 : 1);
  part(new THREE.BoxGeometry(0.03, 0.05, 0.05), skin, 0, 0.04, 0.115, head); // nose
  const eyeM = mat(col3(L.eyes || '#2a2010'), { roughness: 0.2 }), white = mat(0xe8e4dc, { roughness: 0.3 });
  for (const s of [-1, 1]) { part(new THREE.SphereGeometry(0.019, 8, 6), white, s * 0.042, 0.075, 0.098, head); part(new THREE.SphereGeometry(0.011, 6, 5), eyeM, s * 0.042, 0.075, 0.112, head); part(new THREE.BoxGeometry(0.045, 0.012, 0.02), hairM, s * 0.044, 0.105, 0.105, head); part(new THREE.SphereGeometry(0.025, 6, 6), skin, s * 0.115, 0.06, 0, head); }
  rig.eyes = [];
  // hair styles: 0 bald, 1 short, 2 long, 3 ponytail, 4 braid, 5 shaved sides
  const hs = L.hair == null ? 1 : L.hair;
  if (!L.hood && !L.helm && hs > 0) {
    const capG = new THREE.SphereGeometry(0.125, 14, 10, 0, TAU, 0, hs === 5 ? 0.9 : 1.75); const hc = part(capG, hairM, 0, 0.07, -0.005, head); hc.scale.set(fw * 1.03, 1.15, 1.08);
    if (hs === 2) part(new THREE.BoxGeometry(0.24 * fw, 0.3, 0.12), hairM, 0, -0.06, -0.07, head);
    if (hs === 3) { part(new THREE.SphereGeometry(0.04, 8, 6), hairM, 0, 0.08, -0.13, head); part(cap(0.035, 0.18), hairM, 0, -0.05, -0.15, head); }
    if (hs === 4) for (let i = 0; i < 4; i++) part(new THREE.SphereGeometry(0.035 - i * 0.004, 8, 6), hairM, 0, 0.02 - i * 0.07, -0.135 - i * 0.012, head);
    if (hs === 5) part(new THREE.BoxGeometry(0.05, 0.05, 0.22), hairM, 0, 0.19, 0, head);
  }
  if (L.beard) { const bh = L.beard === 1 ? 0.03 : L.beard === 2 ? 0.06 : 0.12; part(new THREE.BoxGeometry(0.17 * fw, bh, 0.1), mat(col3(L.hairCol || L.hair || '#3a2414'), { roughness: 1 }), 0, -0.04 - bh / 2 + 0.02, 0.06, head); if (L.beard > 1) part(new THREE.BoxGeometry(0.15 * fw, 0.025, 0.02), hairM, 0, 0.01, 0.11, head); }
  if (L.scar) { const sm = mat(0x8a3a30, { roughness: 0.5 }); if (L.scar === 1) part(new THREE.BoxGeometry(0.008, 0.09, 0.01), sm, 0.042, 0.07, 0.112, head); if (L.scar === 2) part(new THREE.BoxGeometry(0.07, 0.008, 0.01), sm, -0.06, 0.02, 0.1, head).rotation.z = 0.4; if (L.scar === 3) { part(new THREE.BoxGeometry(0.1, 0.008, 0.01), sm, 0, 0.03, 0.115, head).rotation.z = 0.7; part(new THREE.BoxGeometry(0.1, 0.008, 0.01), sm, 0, 0.03, 0.115, head).rotation.z = -0.7; } if (L.scar === 4) part(new THREE.SphereGeometry(0.05, 8, 6), mat(0xa05040, { roughness: 0.9 }), -0.07, 0.03, 0.07, head).scale.z = 0.4; }
  if (L.hood) { const hd = part(new THREE.SphereGeometry(0.15, 12, 10, 0, TAU, 0, 2.1), coat, 0, 0.06, -0.02, head); hd.scale.set(1.05, 1.15, 1.15); hd.rotation.x = -0.25; hd.material = mat(col3(L.coat || '#3a3028'), { roughness: 0.95, side: THREE.DoubleSide }); }
  if (L.helm) { part(new THREE.SphereGeometry(0.135, 12, 8, 0, TAU, 0, 1.6), mat(0x8a8e98, { metalness: 0.8, roughness: 0.35 }), 0, 0.08, 0, head).scale.y = 1.1; part(new THREE.BoxGeometry(0.02, 0.1, 0.03), mat(0x8a8e98, { metalness: 0.8, roughness: 0.35 }), 0, 0.03, 0.125, head); }
  if (L.cape) { const cp = part(new THREE.PlaneGeometry(0.55 * bw, 1.2, 1, 4), mat(col3(L.coat || '#3a0a10'), { side: THREE.DoubleSide, roughness: 0.9 }), 0, -0.05, -0.2 * bw, spine); cp.rotation.x = 0.12; rig.cape = cp; }
  // arms
  for (const s of [-1, 1]) {
    const sh = joint(s * 0.27 * bw, 0.5, 0, spine, s < 0 ? 'shoulderL' : 'shoulderR'); part(new THREE.SphereGeometry(0.075 * bw, 8, 6), coat, 0, 0, 0, sh);
    part(cap(0.062 * bw, 0.22), coat, 0, -0.16, 0, sh);
    const el = joint(0, -0.32, 0, sh, s < 0 ? 'elbowL' : 'elbowR'); part(cap(0.054 * bw, 0.2), coat, 0, -0.13, 0, el);
    const hand = joint(0, -0.28, 0, el, s < 0 ? 'handL' : 'handR'); part(new THREE.BoxGeometry(0.07, 0.1, 0.045), skin, 0, -0.03, 0, hand);
    rig[s < 0 ? 'shoulderL' : 'shoulderR'] = sh; rig[s < 0 ? 'elbowL' : 'elbowR'] = el; rig[s < 0 ? 'handL' : 'handR'] = hand;
  }
  rig.height = 1.8 * S; rig.limbs = ['head', 'shoulderL', 'shoulderR', 'thighL', 'thighR'];
  return rig;
}
// beasts that stand like people but are built differently
function buildBeastMan(kind, colr, size) {
  const rig = buildHuman({ skin: '#000', coat: '#000', shirt: '#000', body: 2, hair: 0 }, {});
  const fur = mat(colr, { roughness: 1 }), dark = mat(new THREE.Color(colr).multiplyScalar(0.6).getHex(), { roughness: 1 });
  const glow = { werewolf: 0xffc030, ghoul: 0xd8ff5a, vampire: 0xff2020, drowner: 0x9fe8ff, troll: 0xffa040, lord: 0xff2020, demon: 0xff5010 }[kind] || 0xffffff;
  const eyeM = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: glow, emissiveIntensity: 2.5 });
  rig.root.traverse((o) => { if (o.isMesh) o.material = fur; });
  const head = rig.head; head.clear();
  if (kind === 'werewolf') {
    part(new THREE.SphereGeometry(0.16, 12, 10), fur, 0, 0.06, -0.02, head).scale.set(1, 0.95, 1.05);
    const snout = part(new THREE.BoxGeometry(0.13, 0.11, 0.22), fur, 0, 0.0, 0.17, head); part(new THREE.BoxGeometry(0.05, 0.04, 0.04), mat(0x101010), 0, 0.04, 0.28, head);
    part(new THREE.BoxGeometry(0.12, 0.04, 0.18), dark, 0, -0.07, 0.15, head); // jaw
    for (const s of [-1, 1]) { part(new THREE.ConeGeometry(0.05, 0.16, 5), fur, s * 0.09, 0.22, -0.03, head).rotation.z = -s * 0.25; part(new THREE.SphereGeometry(0.02, 6, 5), eyeM, s * 0.06, 0.08, 0.13, head); for (let i = 0; i < 2; i++) part(new THREE.ConeGeometry(0.008, 0.04, 4), mat(0xf0e8d8), s * 0.04, -0.04, 0.22 - i * 0.05, head).rotation.x = Math.PI; }
    rig.spine.rotation.x = 0.35; rig.neck.rotation.x = -0.3; // hunched
    for (const h of [rig.handL, rig.handR]) for (let i = 0; i < 3; i++) part(new THREE.ConeGeometry(0.012, 0.09, 4), mat(0xe8e0d0), (i - 1) * 0.025, -0.11, 0.02, h).rotation.x = Math.PI;
    for (const s of [rig.shinL, rig.shinR]) s.rotation.x = 0.25;
    part(new THREE.SphereGeometry(0.28, 10, 8), fur, 0, 0.5, -0.06, rig.spine).scale.set(1.15, 0.8, 0.9);
  } else if (kind === 'ghoul') {
    part(new THREE.SphereGeometry(0.12, 12, 10), fur, 0, 0.05, 0, head).scale.set(0.85, 1.15, 1); part(new THREE.BoxGeometry(0.09, 0.05, 0.08), dark, 0, -0.05, 0.06, head);
    for (const s of [-1, 1]) part(new THREE.SphereGeometry(0.018, 6, 5), eyeM, s * 0.038, 0.07, 0.095, head);
    for (let i = -2; i <= 2; i++) part(new THREE.ConeGeometry(0.007, 0.03, 4), mat(0xd8d0b0), i * 0.016, -0.06, 0.1, head).rotation.x = Math.PI;
    rig.spine.rotation.x = 0.55; rig.neck.rotation.x = -0.5; rig.root.scale.set(0.95, 0.9, 0.95);
    for (const h of [rig.handL, rig.handR]) for (let i = 0; i < 3; i++) part(new THREE.ConeGeometry(0.01, 0.1, 4), mat(0x2a2a20), (i - 1) * 0.022, -0.12, 0.02, h).rotation.x = Math.PI;
    for (const e of [rig.elbowL, rig.elbowR]) e.position.y = -0.38;
  } else if (kind === 'drowner') {
    part(new THREE.SphereGeometry(0.13, 12, 10), fur, 0, 0.04, 0.02, head).scale.set(1.1, 0.9, 1.25); part(new THREE.BoxGeometry(0.16, 0.05, 0.12), dark, 0, -0.05, 0.08, head);
    for (const s of [-1, 1]) { part(new THREE.SphereGeometry(0.03, 8, 6), eyeM, s * 0.07, 0.06, 0.1, head); part(new THREE.ConeGeometry(0.04, 0.14, 4), dark, s * 0.13, 0.04, -0.02, head).rotation.z = -s * 1.2; }
    for (let i = 0; i < 4; i++) part(new THREE.ConeGeometry(0.03, 0.12, 4), dark, 0, 0.45 - i * 0.12, -0.2, rig.spine).rotation.x = -0.6; // fins on the back
    rig.spine.rotation.x = 0.4; rig.neck.rotation.x = -0.25;
    for (const h of [rig.handL, rig.handR]) for (let i = 0; i < 3; i++) part(new THREE.ConeGeometry(0.01, 0.08, 4), dark, (i - 1) * 0.022, -0.1, 0.02, h).rotation.x = Math.PI;
  } else if (kind === 'troll') {
    part(new THREE.SphereGeometry(0.13, 10, 8), fur, 0, 0.02, 0.06, head).scale.set(1.2, 0.9, 1);
    for (const s of [-1, 1]) { part(new THREE.SphereGeometry(0.018, 6, 5), eyeM, s * 0.05, 0.04, 0.17, head); part(new THREE.ConeGeometry(0.02, 0.08, 5), mat(0xe8e0c8), s * 0.06, -0.05, 0.15, head); }
    part(new THREE.SphereGeometry(0.42, 12, 10), fur, 0, 0.28, 0.08, rig.spine).scale.set(1, 0.95, 0.95); // belly
    part(new THREE.SphereGeometry(0.33, 10, 8), dark, 0, 0.58, -0.08, rig.spine).scale.set(1.3, 0.7, 0.8); // hump
    for (let i = 0; i < 6; i++) part(new THREE.SphereGeometry(rand(0.05, 0.09), 6, 5), mat(0x4a6a2a, { roughness: 1 }), rand(-0.25, 0.25), 0.5 + rand(0, 0.2), rand(-0.3, -0.1), rig.spine);
    rig.spine.rotation.x = 0.3; rig.neck.position.y = 0.55;
    const club = joint(0, -0.1, 0.05, rig.handR, 'weapon'); part(new THREE.CylinderGeometry(0.06, 0.13, 1.2, 7), mat(0x4a3420), 0, -0.4, 0, club).rotation.x = 0.2; rig.weapon = club;
    for (const e of [rig.elbowL, rig.elbowR]) e.scale.setScalar(1.3);
  } else if (kind === 'vampire' || kind === 'lord') {
    const skinV = mat(0xe8e0e4, { roughness: 0.5 }), cl = mat(kind === 'lord' ? 0x3a0a10 : 0x1a1418, { roughness: 0.8 }), cl2 = mat(0x0a0a0c, { roughness: 0.8 });
    rig.root.traverse((o) => { if (o.isMesh) o.material = cl; });
    part(new THREE.SphereGeometry(0.115, 14, 12), skinV, 0, 0.06, 0, head).scale.set(0.95, 1.18, 1);
    for (const s of [-1, 1]) { part(new THREE.SphereGeometry(0.016, 6, 5), eyeM, s * 0.04, 0.075, 0.1, head); part(new THREE.ConeGeometry(0.006, 0.03, 4), mat(0xffffff), s * 0.015, -0.04, 0.105, head).rotation.x = Math.PI; part(new THREE.ConeGeometry(0.03, 0.07, 4), skinV, s * 0.115, 0.08, 0, head).rotation.z = -s * 1.1; }
    part(new THREE.SphereGeometry(0.125, 12, 8, 0, TAU, 0, 1.5), mat(kind === 'lord' ? 0xe8e8e8 : 0x0a0a0a), 0, 0.08, -0.01, head).scale.set(1.02, 1.1, 1.08);
    const cape = part(new THREE.PlaneGeometry(0.75, 1.5, 2, 6), mat(kind === 'lord' ? 0x6a0a10 : 0x1a0a10, { side: THREE.DoubleSide, roughness: 0.85 }), 0, -0.15, -0.22, rig.spine); cape.rotation.x = 0.15; rig.cape = cape;
    part(new THREE.BoxGeometry(0.42, 0.22, 0.05), cl2, 0, 0.62, -0.12, rig.spine).rotation.x = -0.4; // high collar
    if (kind === 'lord') { const crownM = mat(0xd8a840, { metalness: 1, roughness: 0.3, envMapIntensity: 1 }); for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; part(new THREE.ConeGeometry(0.015, 0.06, 4), crownM, Math.cos(a) * 0.1, 0.2, Math.sin(a) * 0.1, head); } part(new THREE.TorusGeometry(0.1, 0.012, 4, 14), crownM, 0, 0.18, 0, head).rotation.x = Math.PI / 2; }
    for (const h of [rig.handL, rig.handR]) { h.children[0].material = skinV; for (let i = 0; i < 3; i++) part(new THREE.ConeGeometry(0.007, 0.07, 4), skinV, (i - 1) * 0.02, -0.1, 0.02, h).rotation.x = Math.PI; }
  } else if (kind === 'demon') {
    const crack = new THREE.MeshStandardMaterial({ color: 0x200000, emissive: 0xff3000, emissiveIntensity: 1.6 });
    part(new THREE.SphereGeometry(0.16, 12, 10), fur, 0, 0.06, 0.02, head).scale.set(1.1, 1, 1.1); part(new THREE.BoxGeometry(0.18, 0.08, 0.16), dark, 0, -0.06, 0.08, head);
    for (const s of [-1, 1]) { part(new THREE.SphereGeometry(0.025, 8, 6), eyeM, s * 0.06, 0.07, 0.14, head); const horn = joint(s * 0.1, 0.15, 0, head); for (let i = 0; i < 5; i++) part(new THREE.CylinderGeometry(0.04 - i * 0.007, 0.045 - i * 0.007, 0.1, 6), mat(0x1a1410), s * i * 0.04, i * 0.08, -i * i * 0.012, horn).rotation.z = -s * (0.3 + i * 0.15); }
    part(new THREE.SphereGeometry(0.4, 12, 10), fur, 0, 0.45, 0, rig.spine).scale.set(1.25, 0.9, 0.85);
    for (let i = 0; i < 8; i++) part(new THREE.BoxGeometry(0.02, rand(0.15, 0.35), 0.02), crack, rand(-0.3, 0.3), 0.4 + rand(-0.15, 0.2), 0.32, rig.spine).rotation.z = rand(-0.6, 0.6);
    for (const h of [rig.handL, rig.handR]) for (let i = 0; i < 3; i++) part(new THREE.ConeGeometry(0.02, 0.16, 4), mat(0x1a1410), (i - 1) * 0.035, -0.16, 0.02, h).rotation.x = Math.PI;
    for (const s of [rig.shoulderL, rig.shoulderR]) s.scale.setScalar(1.35);
    rig.spine.rotation.x = 0.2;
  }
  rig.root.scale.multiplyScalar(size || 1); rig.height = 1.9 * (size || 1); rig.kind = kind; rig.beastMan = true;
  return rig;
}
// ---------- four-legged animals ----------
function buildQuad(kind, colr, size = 1) {
  const root = new THREE.Group(), rig = { root, kind, quad: true }, fur = mat(colr, { roughness: 1 }), dark = mat(new THREE.Color(colr).multiplyScalar(0.55).getHex(), { roughness: 1 }), light = mat(new THREE.Color(colr).lerp(new THREE.Color(0xffffff), 0.35).getHex(), { roughness: 1 });
  const P = { wolf: { len: 0.95, h: 0.72, leg: 0.36, w: 0.22, neck: 0.25, head: 0.16 }, deer: { len: 1.05, h: 1.0, leg: 0.52, w: 0.22, neck: 0.42, head: 0.14 }, horse: { len: 1.5, h: 1.45, leg: 0.72, w: 0.32, neck: 0.62, head: 0.2 }, rabbit: { len: 0.32, h: 0.2, leg: 0.1, w: 0.12, neck: 0.06, head: 0.08 } }[kind];
  const body = joint(0, P.h, 0, root, 'body'); rig.body = body;
  const torso = part(cap(P.w, P.len, 10), fur, 0, 0, 0, body); torso.rotation.x = Math.PI / 2; if (kind !== 'rabbit') torso.scale.set(1, 1, 1.15);
  if (kind === 'horse' || kind === 'deer') part(cap(P.w * 0.92, P.len * 0.8, 8), light, 0, -P.w * 0.35, 0, body).rotation.x = Math.PI / 2; // belly
  const neck = joint(0, P.w * 0.6, P.len / 2 + P.w * 0.5, body, 'neck'); rig.neck = neck;
  const nk = part(cap(P.w * 0.55, P.neck, 8), fur, 0, P.neck * 0.45, 0, neck); nk.rotation.x = 0.55;
  const head = joint(0, P.neck * 0.9, P.neck * 0.4, neck, 'head'); rig.head = head;
  part(new THREE.SphereGeometry(P.head, 10, 8), fur, 0, 0, 0, head).scale.set(0.9, 0.95, 1.2);
  const snout = part(cap(P.head * 0.55, P.head * 1.1, 8), kind === 'horse' ? fur : dark, 0, -P.head * 0.25, P.head * 1.15, head); snout.rotation.x = Math.PI / 2 - (kind === 'horse' ? 0.35 : 0);
  const eyeM = mat(0x0a0806, { roughness: 0.2 });
  for (const s of [-1, 1]) {
    part(new THREE.SphereGeometry(P.head * 0.14, 6, 5), eyeM, s * P.head * 0.65, P.head * 0.25, P.head * 0.5, head);
    const ear = part(new THREE.ConeGeometry(P.head * (kind === 'rabbit' ? 0.25 : 0.32), P.head * (kind === 'rabbit' ? 2.6 : 1.1), 5), fur, s * P.head * 0.45, P.head * (kind === 'rabbit' ? 1.6 : 0.95), -P.head * 0.2, head); ear.rotation.z = -s * 0.25;
  }
  if (kind === 'deer' && size >= 1) { const ant = mat(0xc8b898, { roughness: 0.8 }); for (const s of [-1, 1]) { const a = joint(s * 0.06, 0.12, -0.02, head); part(new THREE.CylinderGeometry(0.012, 0.02, 0.4, 5), ant, s * 0.08, 0.18, 0, a).rotation.z = -s * 0.5; part(new THREE.CylinderGeometry(0.01, 0.014, 0.22, 5), ant, s * 0.12, 0.32, 0.08, a).rotation.x = -0.6; part(new THREE.CylinderGeometry(0.01, 0.014, 0.2, 5), ant, s * 0.2, 0.38, -0.02, a).rotation.z = -s * 0.9; } }
  if (kind === 'horse') { const mane = mat(0x1a1410, { roughness: 1 }); for (let i = 0; i < 7; i++) part(new THREE.BoxGeometry(0.06, 0.14, 0.12), mane, 0, 0.12 + i * 0.08, -0.08 + i * 0.05, neck).rotation.x = 0.55; }
  // legs: [x, z, front]
  rig.legs = [];
  for (const [lx, lz, front] of [[-1, 1, 1], [1, 1, 1], [-1, -1, 0], [1, -1, 0]]) {
    const hip = joint(lx * P.w * 0.62, -P.w * 0.2, lz * P.len * 0.48, body); const up = part(cap(P.w * (front ? 0.3 : 0.38), P.leg * 0.45, 6), fur, 0, -P.leg * 0.28, 0, hip);
    const knee = joint(0, -P.leg * 0.55, 0, hip); part(cap(P.w * 0.18, P.leg * 0.45, 6), kind === 'horse' || kind === 'deer' ? dark : fur, 0, -P.leg * 0.26, 0, knee);
    part(new THREE.CylinderGeometry(P.w * 0.2, P.w * 0.23, P.leg * 0.1, 6), mat(kind === 'horse' ? 0x1a1410 : 0x2a2018), 0, -P.leg * 0.5, 0, knee);
    rig.legs.push({ hip, knee, front, side: lx });
  }
  // tail
  const tail = joint(0, P.w * 0.3, -P.len / 2 - P.w * 0.6, body, 'tail'); rig.tail = tail;
  if (kind === 'horse') { const tm = mat(0x1a1410, { roughness: 1 }); part(cap(0.07, 0.6, 6), tm, 0, -0.35, -0.05, tail).rotation.x = 0.3; }
  else if (kind === 'wolf') part(cap(0.07, 0.42, 6), fur, 0, -0.1, -0.2, tail).rotation.x = -1.0;
  else part(new THREE.SphereGeometry(kind === 'rabbit' ? 0.05 : 0.07, 6, 5), light, 0, 0, -0.02, tail);
  if (kind === 'horse') { // saddle and bridle
    const leather = mat(0x4a2a14, { roughness: 0.7 });
    part(new THREE.BoxGeometry(0.5, 0.08, 0.55), leather, 0, P.w * 0.95, 0.05, body); part(new THREE.BoxGeometry(0.56, 0.3, 0.42), mat(0x6a1a14, { roughness: 1 }), 0, P.w * 0.6, 0.05, body);
    for (const s of [-1, 1]) part(new THREE.BoxGeometry(0.02, 0.4, 0.04), leather, s * 0.3, P.w * 0.4, 0.05, body);
    part(new THREE.TorusGeometry(P.head * 0.6, 0.012, 4, 10), leather, 0, -P.head * 0.2, P.head * 0.9, head).rotation.y = Math.PI / 2;
    rig.seat = new THREE.Vector3(0, P.h + P.w * 1.0, 0.05);
  }
  root.scale.setScalar(size); rig.height = (P.h + P.w + P.neck) * size; rig.len = P.len * size; rig.P = P;
  return rig;
}
function buildCrow() {
  const root = new THREE.Group(), rig = { root, kind: 'crow', bird: true }, m = mat(0x141418, { roughness: 0.6 });
  const body = joint(0, 0.12, 0, root); rig.body = body;
  part(new THREE.SphereGeometry(0.09, 8, 6), m, 0, 0, 0, body).scale.set(0.8, 0.8, 1.4);
  const head = joint(0, 0.06, 0.1, body); part(new THREE.SphereGeometry(0.055, 8, 6), m, 0, 0, 0, head); part(new THREE.ConeGeometry(0.018, 0.07, 4), mat(0x2a2a2a), 0, -0.01, 0.07, head).rotation.x = Math.PI / 2; rig.head = head;
  rig.wings = [];
  for (const s of [-1, 1]) { const w = joint(s * 0.06, 0.02, 0, body); part(new THREE.BoxGeometry(0.22, 0.015, 0.12), m, s * 0.11, 0, -0.02, w); rig.wings.push(w); }
  part(new THREE.BoxGeometry(0.08, 0.01, 0.12), m, 0, 0, -0.15, body);
  rig.height = 0.25; return rig;
}
function buildWyvern(colr, size) {
  const root = new THREE.Group(), rig = { root, kind: 'wyvern', flyer: true }, skin = mat(colr, { roughness: 0.7 }), belly = mat(new THREE.Color(colr).lerp(new THREE.Color(0xd8c8a0), 0.5).getHex(), { roughness: 0.8 }), memb = mat(new THREE.Color(colr).multiplyScalar(0.7).getHex(), { roughness: 0.9, side: THREE.DoubleSide });
  const body = joint(0, 1.3, 0, root); rig.body = body;
  part(cap(0.4, 1.2, 10), skin, 0, 0, 0, body).rotation.x = Math.PI / 2; part(cap(0.34, 0.9, 8), belly, 0, -0.14, 0.05, body).rotation.x = Math.PI / 2;
  const neck = joint(0, 0.15, 0.9, body); rig.neck = neck; for (let i = 0; i < 4; i++) part(new THREE.SphereGeometry(0.22 - i * 0.025, 8, 6), skin, 0, i * 0.18, i * 0.2, neck);
  const head = joint(0, 0.78, 0.86, neck); rig.head = head; part(new THREE.BoxGeometry(0.26, 0.2, 0.45), skin, 0, 0, 0.1, head); part(new THREE.BoxGeometry(0.2, 0.08, 0.38), belly, 0, -0.12, 0.12, head);
  const horn = mat(0xd8d0b8); for (const s of [-1, 1]) { part(new THREE.ConeGeometry(0.04, 0.35, 5), horn, s * 0.1, 0.12, -0.15, head).rotation.x = -1.1; part(new THREE.SphereGeometry(0.03, 6, 5), new THREE.MeshStandardMaterial({ color: 0x000, emissive: 0xffd040, emissiveIntensity: 2 }), s * 0.12, 0.05, 0.18, head); }
  for (let i = 0; i < 4; i++) part(new THREE.ConeGeometry(0.02, 0.06, 4), mat(0xf0e8d8), (i - 1.5) * 0.05, -0.12, 0.3, head).rotation.x = Math.PI;
  const tail = joint(0, 0, -0.8, body); rig.tail = tail; let t = tail; rig.tailSegs = [];
  for (let i = 0; i < 6; i++) { part(new THREE.SphereGeometry(0.2 - i * 0.03, 8, 6), skin, 0, 0, -0.18, t); const n = joint(0, 0, -0.3, t); rig.tailSegs.push(n); t = n; }
  part(new THREE.ConeGeometry(0.12, 0.3, 4), skin, 0, 0, -0.1, t).rotation.x = -Math.PI / 2;
  rig.wings = [];
  for (const s of [-1, 1]) {
    const w = joint(s * 0.3, 0.25, 0.3, body); const arm = part(cap(0.05, 1.3, 6), skin, s * 0.7, 0.1, 0, w); arm.rotation.z = Math.PI / 2;
    const wt = joint(s * 1.4, 0.15, 0, w); part(cap(0.035, 1.1, 6), skin, s * 0.55, 0, -0.1, wt).rotation.z = Math.PI / 2;
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(s * 2.5, 0.25); shape.lineTo(s * 2.4, -0.9); shape.lineTo(s * 1.6, -1.3); shape.lineTo(s * 0.8, -1.4); shape.lineTo(0, -1.0);
    const mm = new THREE.Mesh(new THREE.ShapeGeometry(shape), memb); mm.rotation.x = Math.PI / 2; mm.position.y = 0.12; mm.castShadow = true; w.add(mm);
    rig.wings.push({ w, wt, s });
  }
  for (const s of [-1, 1]) { const leg = joint(s * 0.25, -0.3, -0.2, body); part(cap(0.08, 0.5, 6), skin, 0, -0.35, 0, leg); part(new THREE.BoxGeometry(0.16, 0.06, 0.24), horn, 0, -0.7, 0.08, leg); }
  root.scale.setScalar(size); rig.height = 2 * size; return rig;
}
function buildMonsterModel(type) {
  const d = MON[type];
  switch (d.model) {
    case 'wolf': case 'deer': case 'rabbit': return buildQuad(d.model, d.col, d.size);
    case 'crow': return buildCrow();
    case 'wyvern': return buildWyvern(d.col, d.size);
    default: return buildBeastMan(d.model, d.col, d.size);
  }
}
// ---------- animation ----------
// a: { speed (m/s), phase, attack (0..1 or -1), atkKind, block, draw, cast, dead (0..1), air }
function animHuman(rig, a, dt) {
  const run = clamp(a.speed / 6, 0, 1), walkAmt = clamp(a.speed / 1.5, 0, 1), ph = a.phase || 0, s = Math.sin(ph), c = Math.cos(ph);
  const swing = (0.45 + run * 0.45) * walkAmt;
  rig.thighL.rotation.x = s * swing; rig.thighR.rotation.x = -s * swing;
  rig.shinL.rotation.x = Math.max(0, -c) * swing * 1.3 + (rig.beastMan && rig.kind === 'werewolf' ? 0.25 : 0); rig.shinR.rotation.x = Math.max(0, c) * swing * 1.3 + (rig.beastMan && rig.kind === 'werewolf' ? 0.25 : 0);
  rig.hips.position.y = 0.98 - Math.abs(s) * 0.04 * walkAmt - run * 0.03 + (a.air ? 0.05 : 0);
  const breath = Math.sin((a.t || 0) * 1.8) * 0.02 * (1 - walkAmt);
  const lean = run * 0.18;
  const baseLean = rig.beastMan ? { werewolf: 0.35, ghoul: 0.55, drowner: 0.4, troll: 0.3, demon: 0.2 }[rig.kind] || 0 : 0;
  rig.spine.rotation.x = baseLean + lean + breath;
  rig.spine.rotation.y = -s * 0.08 * walkAmt;
  // arms
  let aL = -s * swing * 0.8, aR = s * swing * 0.8, eL = 0.25 + run * 0.6, eR = 0.25 + run * 0.6, sideL = 0.08, sideR = -0.08;
  if (a.attack >= 0) { // overhead/diagonal slash with the right arm
    const t = a.attack, wind = smoothstep(0, 0.3, t), strike = smoothstep(0.3, 0.6, t), back = smoothstep(0.6, 1, t);
    aR = lerp(lerp(0, -2.6, wind), 0.6, strike); aR = lerp(aR, 0, back); eR = lerp(0.3, 1.2, wind) * (1 - strike) + 0.15; sideR = lerp(-0.3, 0.4, strike);
    rig.spine.rotation.y = lerp(0.5 * wind, -0.6, strike) * (1 - back);
    if (a.atkKind === 'claw') { aL = lerp(-2.2, 0.5, strike) * (1 - back); eL = 0.4; }
  }
  if (a.block) { aL = -1.3; eL = 1.5; sideL = 0.6; }
  if (a.draw != null && a.draw >= 0) { aL = -1.5; eL = 0.05; sideL = 0.1; aR = -1.45; eR = 1.6 + a.draw * 0.5; sideR = -0.3 - a.draw * 0.2; rig.spine.rotation.y = 0.5; }
  if (a.cast > 0) { aR = -1.5; eR = 0.1; sideR = -0.1; aL = -0.9 * a.cast; eL = 0.6; }
  rig.shoulderL.rotation.set(aL, 0, sideL); rig.shoulderR.rotation.set(aR, 0, sideR);
  rig.elbowL.rotation.x = -eL; rig.elbowR.rotation.x = -eR;
  if (rig.head) rig.head.rotation.y = a.look || 0;
  if (rig.cape) rig.cape.rotation.x = 0.12 + run * 0.6 + Math.sin((a.t || 0) * 3) * 0.04;
  // death: fall backwards
  if (a.dead > 0) { const k = smooth(clamp(a.dead, 0, 1)); rig.root.rotation.x = -k * Math.PI / 2 * (a.fallDir || 1); rig.root.position.y = k * 0.12; }
}
function animQuad(rig, a, dt) {
  const ph = a.phase || 0, spd = a.speed, gallop = clamp((spd - 4) / 6, 0, 1), amt = clamp(spd / 2, 0, 1);
  for (const L of rig.legs) {
    const off = gallop > 0.5 ? (L.front ? 0 : Math.PI * 0.6) + (L.side > 0 ? 0.3 : 0) : (L.front ? 0 : Math.PI) + (L.side > 0 ? Math.PI : 0);
    const s = Math.sin(ph + off); L.hip.rotation.x = s * (0.5 + gallop * 0.3) * amt; L.knee.rotation.x = (L.front ? -1 : 1) * Math.max(0, Math.cos(ph + off)) * 0.7 * amt;
  }
  rig.body.position.y = rig.P.h + Math.abs(Math.sin(ph)) * 0.04 * amt + gallop * Math.sin(ph * 2) * 0.05 + (a.hop ? Math.max(0, Math.sin(ph)) * 0.25 : 0);
  rig.body.rotation.x = gallop * Math.sin(ph) * 0.08 - (a.graze ? 0 : 0);
  if (rig.neck) rig.neck.rotation.x = a.graze ? 1.1 : -0.1 * gallop + (a.attack >= 0 ? -0.4 * Math.sin(a.attack * Math.PI) : 0);
  if (rig.tail) rig.tail.rotation.y = Math.sin((a.t || 0) * 3) * 0.3;
  if (a.dead > 0) { const k = smooth(clamp(a.dead, 0, 1)); rig.root.rotation.z = k * Math.PI / 2; rig.root.position.y = k * rig.P.w * 0.8; }
}
function animBird(rig, a, dt) {
  const fly = a.air ? 1 : 0, f = Math.sin((a.t || 0) * (fly ? 22 : 3));
  rig.wings[0].rotation.z = fly ? f * 0.9 : 0.1; rig.wings[1].rotation.z = fly ? -f * 0.9 : -0.1;
  if (!fly) rig.head.rotation.x = Math.max(0, Math.sin((a.t || 0) * 2.5)) * 0.8;
  if (a.dead > 0) rig.root.rotation.z = Math.PI / 2;
}
function animWyvern(rig, a, dt) {
  const t = a.t || 0, flap = a.air ? Math.sin(t * (a.speed > 4 ? 6 : 3.5)) : Math.sin(t * 1.2) * 0.15;
  for (const W of rig.wings) { W.w.rotation.z = W.s * (a.air ? flap * 0.8 : -0.9); W.wt.rotation.z = W.s * (a.air ? flap * 0.4 - 0.1 : -1.2); W.w.rotation.y = a.air ? 0 : W.s * 0.6; }
  rig.tailSegs.forEach((s, i) => (s.rotation.y = Math.sin(t * 2 - i * 0.6) * 0.18));
  rig.neck.rotation.x = a.attack >= 0 ? -0.5 * Math.sin(a.attack * Math.PI) : Math.sin(t * 0.8) * 0.1;
  if (a.dead > 0) { rig.root.rotation.z = smooth(clamp(a.dead, 0, 1)) * Math.PI / 2; }
}
function animate(rig, a, dt) { if (rig.quad) animQuad(rig, a, dt); else if (rig.bird) animBird(rig, a, dt); else if (rig.flyer) animWyvern(rig, a, dt); else animHuman(rig, a, dt); }
// ---------- weapons ----------
function buildSword(item) {
  const g = new THREE.Group(), it = ITEMS[item] || ITEMS.rusty_sword, blade = new THREE.MeshStandardMaterial({ color: it.col || 0xb8bcc4, metalness: 1, roughness: it.id === 'rusty_sword' ? 0.6 : 0.22, envMapIntensity: 1.2, emissive: it.id === 'demonbane' ? 0x401000 : 0x000000 });
  const len = it.dmg > 30 ? 1.05 : 0.9;
  const bg = new THREE.BoxGeometry(0.05, len, 0.012); const p = bg.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > len / 2 - 0.12) p.setX(i, p.getX(i) * (1 - (y - (len / 2 - 0.12)) / 0.13)); } bg.computeVertexNormals();
  part(bg, blade, 0, len / 2 + 0.1, 0, g); part(new THREE.BoxGeometry(0.008, len * 0.8, 0.014), new THREE.MeshStandardMaterial({ color: 0x6a6e78, metalness: 1, roughness: 0.4 }), 0, len * 0.42 + 0.1, 0, g);
  part(new THREE.BoxGeometry(0.22, 0.03, 0.035), MAT.iron, 0, 0.09, 0, g); part(new THREE.CylinderGeometry(0.018, 0.02, 0.16, 6), mat(0x3a2414, { roughness: 0.9 }), 0, 0, 0, g); part(new THREE.SphereGeometry(0.028, 6, 5), MAT.iron, 0, -0.09, 0, g);
  g.userData.len = len + 0.1; return g;
}
function buildBow(item) {
  const g = new THREE.Group(), it = ITEMS[item] || ITEMS.hunting_bow, wood = mat(it.col || 0x6a3a1a, { roughness: 0.7 });
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -0.65, 0), new THREE.Vector3(0, 0, 0.22), new THREE.Vector3(0, 0.65, 0));
  part(new THREE.TubeGeometry(curve, 16, 0.017, 6), wood, 0, 0, 0, g); part(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 6), mat(0x2a1a10), 0, 0, 0.11, g);
  const sg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.65, 0), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.65, 0)]); const string = new THREE.Line(sg, new THREE.LineBasicMaterial({ color: 0xd8d0c0 })); g.add(string); g.userData.string = string;
  return g;
}
function buildArrow(kind) {
  const g = new THREE.Group(); part(new THREE.CylinderGeometry(0.006, 0.006, 0.72, 4), mat(0x8a6a3a), 0, 0, 0, g).rotation.x = Math.PI / 2;
  part(new THREE.ConeGeometry(0.014, 0.06, 4), kind === 'silver_arrow' ? MAT.silver : MAT.iron, 0, 0, 0.38, g).rotation.x = Math.PI / 2;
  for (const r of [0, 2.1, 4.2]) { const f = part(new THREE.PlaneGeometry(0.03, 0.09), mat(kind === 'fire_arrow' ? 0xc04010 : 0xd8d0c0, { side: THREE.DoubleSide }), 0, 0, -0.32, g); f.rotation.set(Math.PI / 2, 0, r); }
  if (kind === 'fire_arrow') part(new THREE.SphereGeometry(0.03, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff8020 }), 0, 0, 0.36, g);
  return g;
}
function buildShield(item) {
  const g = new THREE.Group(), it = ITEMS[item]; if (!it) return g;
  const face = mat(it.col || 0x8a5a2b, { roughness: 0.7, metalness: it.id === 'wood_shield' ? 0 : 0.6 });
  if (it.id === 'tower_shield') part(new THREE.BoxGeometry(0.62, 0.95, 0.05), face, 0, 0, 0, g);
  else { part(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 16), face, 0, 0, 0, g).rotation.x = Math.PI / 2; part(new THREE.TorusGeometry(0.32, 0.02, 4, 18), MAT.iron, 0, 0, 0, g); }
  part(new THREE.SphereGeometry(0.07, 8, 6, 0, TAU, 0, Math.PI / 2), MAT.iron, 0, 0, 0.02, g).rotation.x = Math.PI / 2;
  return g;
}
