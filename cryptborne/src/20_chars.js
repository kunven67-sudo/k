
// =====================================================================
// CHARACTERS — chunky outlined pixel people in the style of Moonlighter.
// Every person (hero, villagers, humanoid monsters) is painted into a
// 32x36 frame with feet at (16, 33), in three views: 'down' (facing you),
// 'up' (facing away) and 'side' (facing right; flipped for left).
// Animations: idle (4 frames, breathing), walk (8), atk (3: windup, strike,
// follow-through), roll (6), hurt, cast, bow, block, wave (2), hammer (2),
// work (2). Frames are painted once and cached.
// =====================================================================
const CHAR_W = 32, CHAR_H = 36, CHAR_FX = 16, CHAR_FY = 33;
const HUM_W = CHAR_W, HUM_H = CHAR_H, HUM_FX = CHAR_FX, HUM_FY = CHAR_FY; // used by monster drawing
const CHAR_OUT = '#1a1018';
const _shade = new Map();
function shade(hex, f) {
  if (!hex) return hex; const key = hex + '|' + f; let v = _shade.get(key); if (v) return v;
  const h = hex.length >= 7 ? hex.slice(1, 7) : hex.slice(1).split('').map((c) => c + c).join('');
  let r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  if (f <= 1) { r *= f; g *= f; b *= f; } else { const k = f - 1; r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
  v = '#' + [r, g, b].map((n) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0')).join(''); _shade.set(key, v); return v;
}
const ANIM_FRAMES = { idle: 4, walk: 8, atk: 3, roll: 6, hurt: 1, cast: 1, bow: 1, block: 1, wave: 2, hammer: 2, work: 2, raise: 1, strike: 1 };
// where the hands go: [weaponHand, otherHand] as [x, y] in frame pixels (side view: front hand, back hand)
function charPose(dir, anim, f) {
  const P = { bob: 0, lean: 0, liftA: 0, liftB: 0, stride: 0, squint: false, weaponAng: null };
  const s = Math.sin((f / 8) * TAU), cph = Math.cos((f / 8) * TAU);
  if (dir === 'side') { P.hand = [16, 25]; P.hand2 = [14, 25]; } else if (dir === 'down') { P.hand = [22, 25]; P.hand2 = [9, 25]; } else { P.hand = [9, 25]; P.hand2 = [22, 25]; }
  switch (anim) {
    case 'idle': P.bob = f === 1 || f === 2 ? -1 : 0; break;
    case 'walk':
      P.bob = Math.abs(s) < 0.5 ? -1 : 0;
      if (dir === 'side') { P.stride = Math.round(s * 3); P.liftA = cph > 0.3 ? 1 : 0; P.liftB = cph < -0.3 ? 1 : 0; P.hand = [16 - Math.round(s * 2.5), 25 - (Math.abs(s) > 0.9 ? 1 : 0)]; P.hand2 = [14 + Math.round(s * 2.5), 25]; }
      else { P.liftA = Math.round(Math.max(0, s) * 2); P.liftB = Math.round(Math.max(0, -s) * 2); P.hand[1] += Math.round(s * 1.4); P.hand2[1] -= Math.round(s * 1.4); }
      break;
    case 'atk': case 'raise': case 'strike': {
      const k = anim === 'raise' ? 0 : anim === 'strike' ? 1 : f;
      if (dir === 'side') { P.hand = [[11, 16], [25, 23], [22, 28]][k]; P.lean = [-1, 1, 1][k]; P.weaponAng = [-2.5, 0, 0.75][k]; P.hand2 = [[16, 24], [13, 24], [14, 25]][k]; }
      else if (dir === 'down') { P.hand = [[25, 16], [18, 29], [10, 27]][k]; P.weaponAng = [-2.1, 1.57, 2.6][k]; P.bob = k === 0 ? -1 : 0; P.hand2 = [[8, 23], [9, 24], [8, 25]][k]; }
      else { P.hand = [[6, 17], [13, 15], [21, 18]][k]; P.weaponAng = [-2.6, -1.57, -0.6][k]; P.hand2 = [[23, 23], [22, 24], [23, 25]][k]; }
      break;
    }
    case 'cast': if (dir === 'side') { P.hand = [23, 16]; P.hand2 = [17, 20]; P.weaponAng = -1.3; } else { P.hand = [dir === 'down' ? 25 : 6, 16]; P.hand2 = [dir === 'down' ? 6 : 25, 16]; P.weaponAng = -1.57; } P.bob = -1; break;
    case 'bow': if (dir === 'side') { P.hand = [25, 21]; P.hand2 = [19, 21]; P.weaponAng = 0; } else if (dir === 'down') { P.hand = [17, 25]; P.hand2 = [15, 21]; P.weaponAng = 1.57; } else { P.hand = [14, 16]; P.hand2 = [17, 19]; P.weaponAng = -1.57; } break;
    case 'block': if (dir === 'side') { P.hand = [21, 21]; P.hand2 = [19, 22]; } else if (dir === 'down') { P.hand = [19, 23]; P.hand2 = [12, 23]; } else { P.hand = [12, 20]; P.hand2 = [19, 20]; } P.lean = dir === 'side' ? -1 : 0; break;
    case 'hurt': P.squint = true; P.bob = -1; if (dir === 'side') { P.hand = [11, 19]; P.hand2 = [12, 21]; P.lean = -1; } else { P.hand = [dir === 'down' ? 26 : 5, 19]; P.hand2 = [dir === 'down' ? 5 : 26, 19]; } break;
    case 'wave': if (dir === 'side') P.hand = f ? [22, 12] : [21, 13]; else P.hand = f ? [26, 12] : [25, 13]; break;
    case 'hammer': if (dir === 'side') { P.hand = f ? [23, 24] : [17, 14]; P.weaponAng = f ? 0.35 : -1.75; P.lean = f ? 1 : -1; } else { P.hand = f ? [21, 27] : [23, 14]; P.weaponAng = f ? 1.4 : -1.7; } break;
    case 'work': if (dir === 'side') P.hand = f ? [22, 25] : [21, 23]; else { P.hand = f ? [18, 26] : [18, 24]; P.hand2 = f ? [13, 24] : [13, 26]; } break;
  }
  return P;
}
// ---------- the painter ----------
function paintChar(x, L, o) {
  const dir = o.dir, anim = o.anim, f = o.f || 0, P = charPose(dir, anim, f);
  const fill = (px0, py0, w, h, c) => { if (!c || w <= 0 || h <= 0) return; x.fillStyle = c; x.fillRect(px0, py0, w, h); };
  const pix = (px0, py0, c) => fill(px0, py0, 1, 1, c);
  const by = P.bob, lx = P.lean; // upper-body offsets
  const U = (px0, py0, w, h, c) => fill(px0 + lx, py0 + by, w, h, c); // upper body
  const skin = L.skin || '#f0c08a', skinD = shade(skin, 0.82), skinL = shade(skin, 1.12);
  const shirt = o.armor || L.shirt || '#8a8f99', shirtD = L.shirtDark && !o.armor ? L.shirtDark : shade(shirt, 0.78), shirtL = shade(shirt, 1.12);
  const pants = L.pants || shade(shirt, 0.7), pantsD = shade(pants, 0.78), shoes = L.shoes || '#2a1a10';
  const hair = L.hair, hairD = hair && shade(hair, 0.75), hairL = hair && shade(hair, 1.18), hs = L.hairStyle == null ? (hair ? 0 : 2) : L.hairStyle | 0;
  const robe = L.robe, side = dir === 'side', down = dir === 'down', up = dir === 'up';
  const arm = (sx, sy, hx, hy, sleeve, hand) => { // a chunky arm from shoulder to hand
    sx += lx; sy += by; hx += lx; hy += by;
    const n = Math.max(Math.abs(hx - sx), Math.abs(hy - sy), 1);
    for (let i = 0; i <= n; i++) { const t = i / n; if (t > 0.78) break; fill(Math.round(sx + (hx - sx) * t) - 1, Math.round(sy + (hy - sy) * t) - 1, 3, 3, sleeve); }
    fill(hx - 1, hy - 1, 3, 2, hand); pix(hx + 1, hy, shade(hand, 0.85));
  };
  if (anim === 'roll') { paintRoll(x, L, f, { shirt, shirtD, pants, hair, skin, shoes }); return { hand: [16, 25], back: false }; }
  // ----- behind the body -----
  if (L.wings) { const w = L.wings, wd = shade(w, 0.75); if (side) { U(5, 13, 7, 2, w); U(4, 15, 8, 3, w); U(5, 18, 6, 2, wd); U(6, 20, 3, 1, wd); } else { for (const sgn of [-1, 1]) { const cx = sgn < 0 ? 2 : 23; U(cx, 13, 7, 2, w); U(cx + (sgn < 0 ? -1 : 0), 15, 8, 3, w); U(cx, 18, 7, 2, wd); U(cx + (sgn < 0 ? 0 : 3), 20, 4, 1, wd); } } }
  if (L.cape && !up) { const c = shade(L.cape, 0.8); if (side) U(8, 19, 5, 11, c); else { U(10, 19, 12, 12, c); } }
  if (hair && hs === 1 && !up && !L.hood && !L.helm) { if (side) U(8, 9, 6, 13, hairD); else U(8, 9, 16, 13, hairD); }
  if (L.tail) { if (side) { fill(6, 27, 4, 1, L.tail); fill(5, 26, 1, 2, L.tail); } else if (up) fill(15, 27, 2, 5, L.tail); }
  // ----- legs / robe -----
  if (robe) {
    const r = robe, rd = shade(r, 0.78), sway = anim === 'walk' ? Math.round(Math.sin((f / 8) * TAU)) : 0;
    if (side) { fill(12, 27, 8, 5, r); fill(12, 27, 2, 5, rd); fill(11 + sway, 31, 10, 1, rd); fill(14 + sway, 32, 4, 1, shoes); }
    else { fill(10, 27, 12, 5, r); fill(20, 27, 2, 5, rd); fill(9, 31, 14, 1, rd); fill(11 + Math.max(0, sway), 32, 3, 1, shoes); fill(18 + Math.min(0, sway), 32, 3, 1, shoes); }
  } else if (side) {
    const leg = (dx, lift, back) => { const pc = back ? pantsD : pants, sc = back ? shade(shoes, 0.8) : shoes; for (let r = 27; r <= 30 - lift; r++) fill(14 + Math.round((dx * (r - 26)) / 5), r, 3, 1, pc); fill(14 + dx, 31 - lift, 4, 2, sc); pix(17 + dx, 32 - lift, shade(sc, 0.8)); };
    leg(-P.stride, P.liftB, true); leg(P.stride, P.liftA, false);
  } else {
    const leg = (x0, lift, sx0) => { fill(x0, 27, 3, 4 - lift, pants); pix(x0 + (x0 < 16 ? 2 : 0), 27, pantsD); fill(x0 + (x0 < 16 ? 2 : 0), 28, 1, 3 - lift, pantsD); fill(sx0, 31 - lift, 4, 2, shoes); fill(sx0, 32 - lift, 4, 1, shade(shoes, 0.75)); };
    leg(12, P.liftB, 11); leg(17, P.liftA, 17);
  }
  // ----- back arm (side view) and weapon behind (back view) -----
  if (side) arm(14, 20, P.hand2[0], P.hand2[1], o.armor ? shade(o.armor, 0.7) : shirtD, skinD);
  if (up && L.weapon) paintWeapon(x, L, P.hand[0] + lx, P.hand[1] + by, P.weaponAng == null ? -1.57 : P.weaponAng, 'up');
  // ----- torso -----
  const t0 = 19 + by;
  if (side) { fill(12 + lx, t0, 8, 26 - t0, robe || shirt); fill(12 + lx, t0, 2, 26 - t0, robe ? shade(robe, 0.8) : shirtD); fill(19 + lx, t0 + 1, 1, 4, robe ? shade(robe, 1.1) : shirtL); }
  else { fill(11, t0, 10, 26 - t0, robe || shirt); fill(19, t0, 2, 26 - t0, robe ? shade(robe, 0.8) : shirtD); fill(11, t0 + 1, 1, 4, robe ? shade(robe, 1.1) : shirtL); if (down && !robe && !o.armor && !L.fur) { pix(15, t0, skinD); pix(16, t0, skinD); pix(15, t0 + 1, skinD); } }
  if (L.ribs) { const rc = L.ribs; if (side) { for (const r of [20, 22, 24]) fill(13 + lx, r + by, 6, 1, rc); } else { for (const r of [20, 22, 24]) fill(12, r + by, 8, 1, rc); fill(15, t0, 2, 7, rc); } }
  if (L.apron && !up) { if (side) fill(17 + lx, 21 + by, 3, 8 - by, L.apron); else { fill(12, 21 + by, 8, 9 - by, L.apron); fill(13, 20 + by, 6, 1, L.apron); fill(19, 22 + by, 1, 7, shade(L.apron, 0.85)); } }
  if (L.vest) { const v = L.vest; if (side) fill(12 + lx, t0, 4, 7, v); else if (down) { fill(11, t0, 3, 7, v); fill(18, t0, 3, 7, shade(v, 0.85)); } else fill(11, t0, 10, 7, v); }
  if (o.armor) { const a = o.armor, tr = o.trim || shade(a, 1.3); if (side) { fill(12 + lx, t0, 8, 7, a); fill(13 + lx, t0 + 1, 1, 5, shade(a, 1.25)); fill(14 + lx, t0 - 1, 4, 2, shade(a, 1.1)); } else { fill(11, t0, 10, 7, a); fill(12, t0 + 1, 1, 5, shade(a, 1.25)); fill(19, t0, 2, 7, shade(a, 0.75)); if (down) { fill(15, t0 + 2, 2, 3, tr); fill(11, t0, 10, 1, tr); } } }
  if (L.wraps) { const w = L.wraps; if (side) { fill(12 + lx, 21 + by, 8, 1, w); fill(12 + lx, 24 + by, 8, 1, w); } else { fill(11, 21 + by, 10, 1, w); fill(11, 24 + by, 10, 1, w); } if (!robe) { fill(side ? 14 : 12, 29, side ? 3 : 8, 1, w); } }
  if (L.spots) { const sp = L.spots; if (side) { fill(14 + lx, 21 + by, 2, 2, sp); pix(17 + lx, 24 + by, sp); } else { fill(12, 21 + by, 2, 2, sp); fill(18, 23 + by, 2, 1, sp); } }
  if (!robe || L.belt) { const bc = L.belt || '#3a2616'; if (side) { fill(12 + lx, 26, 8, 1, bc); pix(18 + lx, 26, '#c8a040'); } else { fill(11, 26, 10, 1, bc); if (down) fill(15, 26, 2, 1, '#c8a040'); } }
  if (L.cape && up) { const c = L.cape; fill(10, t0, 12, 31 - t0, c); fill(19, t0, 3, 31 - t0, shade(c, 0.8)); }
  if (L.fur) { const fu = L.fur; if (side) { fill(11 + lx, t0 - 1, 10, 2, fu); fill(12 + lx, t0 + 1, 3, 1, shade(fu, 0.85)); } else { fill(9, t0 - 1, 14, 2, fu); fill(10, t0 + 1, 12, 1, shade(fu, 0.85)); } }
  if (hair && hs === 1 && up && !L.hood && !L.helm) U(9, 15, 14, 8, hair);
  if (L.cape && up && !hair) {}
  // ----- arms -----
  const sleeve = o.armor || (L.robe ? L.robe : shirt), sleeveD = shade(sleeve, 0.82);
  if (side) arm(17, 20, P.hand[0], P.hand[1], sleeve, skin);
  else { const sh1 = down ? [21, 20] : [10, 20], sh2 = down ? [10, 20] : [21, 20]; arm(sh2[0], sh2[1], P.hand2[0], P.hand2[1], down ? sleeve : sleeveD, down ? skin : skinD); arm(sh1[0], sh1[1], P.hand[0], P.hand[1], down ? sleeveD : sleeve, skin); }
  if (o.armor && !side) { fill(8, t0, 3, 2, shade(o.armor, 1.15)); fill(21, t0, 3, 2, shade(o.armor, 0.9)); } else if (o.armor) fill(14 + lx, t0, 5, 2, shade(o.armor, 1.15));
  if (L.fur && !side) { pix(8, t0, L.fur); pix(23, t0, L.fur); }
  // ----- head -----
  paintHead(x, L, o, P, { U, fill, pix, skin, skinD, skinL, hair, hairD, hairL, hs, side, down, up });
  // ----- weapon in front -----
  if (L.weapon && !up) paintWeapon(x, L, P.hand[0] + lx, P.hand[1] + by, P.weaponAng == null ? (side ? -1.15 : -1.35) : P.weaponAng, dir);
  return { hand: [P.hand[0] + lx, P.hand[1] + by], hand2: [P.hand2[0] + lx, P.hand2[1] + by], back: up };
}
function paintHead(x, L, o, P, k) {
  const { U, skin, skinD, skinL, hair, hairD, hairL, hs, side, down, up } = k;
  const noFace = L.noFace, faceCol = noFace ? shade(skin, 0.55) : skin;
  // skull shape
  if (side) { U(10, 6, 11, 1, faceCol); U(9, 7, 13, 11, faceCol); U(10, 18, 11, 1, shade(faceCol, 0.85)); U(9, 7, 2, 11, shade(faceCol, 0.88)); }
  else { U(10, 6, 12, 1, faceCol); U(9, 7, 14, 11, faceCol); U(10, 18, 12, 1, shade(faceCol, 0.85)); U(21, 8, 2, 10, shade(faceCol, 0.9)); if (!noFace) U(11, 8, 2, 1, skinL); }
  // face
  if (!up && !noFace && !L.skull) {
    const ec = L.eyes || L.eyeCol || '#22141e', glow = !!L.eyes;
    if (side) {
      if (o.blink && !glow) U(18, 13, 2, 1, '#22141e'); else if (P.squint) { U(18, 12, 1, 1, ec); U(19, 13, 1, 1, ec); } else { U(18, 12, 2, 2, ec); if (!glow) U(18, 12, 1, 1, '#ffffff'); }
      U(22, 14, 1, 1, skin); U(20, 16, 2, 1, skinD); U(13, 12, 2, 2, skinD);
      if (L.blush) U(18, 15, 2, 1, L.blush);
    } else {
      for (const ex of [12, 18]) {
        if (o.blink && !glow) U(ex, 13, 2, 1, '#22141e');
        else if (P.squint) { U(ex, 12, 1, 1, ec); U(ex + 1, 13, 1, 1, ec); }
        else { U(ex, 12, 2, 2, ec); if (!glow) U(ex, 12, 1, 1, '#ffffff'); }
      }
      U(15, 16, 2, 1, skinD);
      if (L.blush) { U(10, 15, 2, 1, L.blush); U(20, 15, 2, 1, L.blush); }
    }
  }
  if (noFace && L.eyes && !up) { if (side) U(18, 12, 2, 1, L.eyes); else { U(12, 12, 2, 1, L.eyes); U(18, 12, 2, 1, L.eyes); } }
  if (L.skull && !up) {
    const d = '#160c12', ey = L.eyes;
    if (side) { U(17, 11, 3, 3, d); if (ey) U(18, 12, 1, 1, ey); U(21, 14, 1, 2, d); for (let i = 0; i < 3; i++) U(17 + i * 2, 17, 1, 1, d); }
    else { U(11, 11, 3, 3, d); U(18, 11, 3, 3, d); if (ey) { U(12, 12, 1, 1, ey); U(19, 12, 1, 1, ey); } U(15, 15, 2, 1, d); for (let i = 0; i < 4; i++) U(12 + i * 2, 17, 1, 1, d); }
  }
  // hair
  if (hair && hs !== 2 && !L.hood && !o.helm) {
    if (up) {
      U(10, 5, 12, 1, hair); U(9, 6, 14, 10 + (hs === 1 ? 0 : 0), hair); U(10, 16, 12, 1, hairD); U(20, 7, 3, 9, hairD); U(12, 6, 4, 1, hairL);
      if (hs === 4) { U(15, 16, 2, 6, hair); U(15, 16, 2, 1, hairD); }
      if (hs === 3) { U(10, 4, 1, 1, hair); U(13, 3, 2, 2, hair); U(17, 3, 2, 2, hair); U(21, 4, 1, 1, hair); }
    } else if (side) {
      U(10, 5, 10, 1, hair); U(9, 6, 12, 4, hair); U(9, 10, 5, hs === 1 ? 4 : 4, hair); U(9, 10, 2, 4, hairD); U(19, 10, 3, 1, hair); U(21, 11, 1, 1, hair); U(12, 6, 4, 1, hairL);
      if (hs === 3) { U(11, 4, 1, 1, hair); U(14, 3, 2, 2, hair); U(18, 4, 1, 1, hair); U(8, 7, 1, 2, hair); }
      if (hs === 4) { U(6, 9, 3, 7, hair); U(6, 14, 3, 2, hairD); U(8, 9, 1, 1, '#c8a040'); }
      if (hs === 0) U(9, 14, 2, 1, hairD);
    } else {
      U(10, 5, 12, 1, hair); U(9, 6, 14, 4, hair); U(20, 6, 3, 4, hairD); U(12, 6, 4, 1, hairL);
      U(9, 10, 3, 1, hair); U(13, 10, 2, 1, hair); U(17, 10, 2, 1, hair); U(20, 10, 3, 1, hairD); U(9, 11, 1, 3, hair); U(22, 11, 1, 3, hairD);
      if (hs === 3) { U(10, 4, 1, 1, hair); U(13, 3, 2, 2, hair); U(17, 3, 2, 2, hair); U(21, 4, 1, 1, hair); }
      if (hs === 4) { U(23, 8, 2, 7, hair); U(23, 13, 2, 2, hairD); U(23, 8, 1, 1, '#c8a040'); }
      if (hs === 1) { U(8, 10, 2, 11, hair); U(22, 10, 2, 11, hairD); }
    }
  }
  if (L.beard && !up) { const b = L.beard, bd = shade(b, 0.8); if (side) { U(14, 15, 8, 4, b); U(17, 19, 4, 1, bd); U(14, 15, 2, 3, bd); } else { U(10, 15, 12, 3, b); U(12, 18, 8, 2, b); U(20, 15, 2, 4, bd); U(14, 20, 4, 1, bd); U(15, 16, 2, 1, shade(skin, 0.6)); } }
  if (L.tusks && !up) { if (side) U(20, 16, 1, 2, '#f4ecd8'); else { U(12, 16, 1, 2, '#f4ecd8'); U(19, 16, 1, 2, '#f4ecd8'); } }
  if (L.ears) { const e = skin, ed = skinD; if (side) { U(11, 10, 3, 3, e); U(10, 8, 2, 3, e); U(9, 7, 1, 2, ed); } else { U(6, 10, 3, 3, e); U(4, 9, 3, 2, e); U(3, 8, 2, 1, ed); U(23, 10, 3, 3, ed); U(25, 9, 3, 2, ed); U(27, 8, 2, 1, ed); } }
  if (L.horns) { const h = L.horns; if (side) { U(12, 3, 2, 3, h); U(11, 1, 2, 2, h); U(16, 3, 2, 3, h); U(17, 1, 1, 2, h); } else { U(10, 3, 2, 3, h); U(9, 1, 2, 2, h); U(20, 3, 2, 3, h); U(21, 1, 2, 2, h); } }
  if (L.eyepatch && !up) { if (side) { U(17, 11, 3, 3, '#160c12'); U(9, 9, 12, 1, '#160c12'); } else { U(17, 11, 4, 3, '#160c12'); U(9, 9, 14, 1, '#160c12'); } }
  if (L.wraps) { const w = L.wraps; U(9, 8, side ? 13 : 14, 1, w); U(9, 15, side ? 13 : 14, 1, w); if (!up) U(side ? 14 : 9, 11, side ? 3 : 2, 1, w); }
  if (L.spots) U(side ? 12 : 11, 8, 2, 1, L.spots);
  // headwear
  if (L.hood) { const h = L.hood, hd = shade(h, 0.75); if (up) { U(9, 4, 14, 15, h); U(20, 5, 3, 14, hd); } else if (side) { U(9, 4, 10, 15, h); U(9, 4, 13, 4, h); U(9, 5, 3, 13, hd); U(19, 8, 2, 1, hd); } else { U(9, 4, 14, 4, h); U(8, 8, 3, 12, h); U(21, 8, 3, 12, hd); U(10, 7, 12, 1, hd); } }
  if (o.helm) { const h = o.helm, hl = shade(h, 1.25), hd = shade(h, 0.72); if (up) { U(9, 5, 14, 12, h); U(20, 6, 3, 11, hd); } else if (side) { U(9, 5, 13, 6, h); U(9, 11, 5, 6, h); U(12, 6, 4, 1, hl); U(20, 11, 2, 3, h); U(15, 11, 5, 1, hd); } else { U(9, 5, 14, 6, h); U(9, 11, 2, 6, h); U(21, 11, 2, 6, hd); U(15, 11, 2, 4, h); U(11, 6, 4, 1, hl); U(11, 10, 10, 1, hd); } }
  if (L.bandana) { const b = L.bandana, bd = shade(b, 0.78); if (side) { U(9, 6, 13, 3, b); U(6, 7, 3, 2, bd); U(5, 9, 2, 2, bd); } else if (up) { U(9, 6, 14, 3, b); U(15, 9, 2, 3, bd); } else { U(9, 6, 14, 3, b); U(21, 6, 2, 3, bd); U(23, 8, 2, 2, bd); U(24, 10, 1, 2, bd); } }
  if (L.tricorn) { const t = L.tricorn, td = shade(t, 1.3); if (side) { U(10, 3, 10, 3, t); U(6, 6, 18, 2, t); U(13, 3, 4, 1, td); } else { U(10, 3, 12, 3, t); U(6, 6, 20, 2, t); U(15, 4, 2, 1, '#f2c13a'); } }
  if (L.hat) { const h = L.hat, hd = shade(h, 0.75); U(6, 6, 20, 2, h); U(6, 7, 20, 1, hd); U(10, 4, 12, 2, h); U(12, 2, 8, 2, h); U(14, 0, 4, 2, h); U(18, 2, 2, 4, hd); if (!up) U(10, 5, 12, 1, shade(h, 1.3)); }
  if (L.crown) { const g = '#f2c13a', gd = '#b8862a'; U(11, 3, 10, 3, g); U(11, 1, 2, 2, g); U(15, 0, 2, 3, g); U(19, 1, 2, 2, g); U(11, 5, 10, 1, gd); if (!up) U(15, 3, 2, 2, '#d8454a'); }
  if (L.feather) { U(18, 0, 2, 6, '#d8454a'); U(20, 1, 1, 4, '#f2b53a'); }
}
function paintRoll(x, L, f, c) { // curled into a ball, spinning
  const cx = 16, cy = 25, rx = 8, ry = 7, a = (f / 6) * TAU;
  for (let yy = cy - ry; yy <= cy + ry; yy++) for (let xx = cx - rx; xx <= cx + rx; xx++) {
    const dx = (xx - cx + 0.5) / rx, dy = (yy - cy + 0.5) / ry, r2 = dx * dx + dy * dy; if (r2 > 1) continue;
    const ang = Math.atan2(dy, dx), rel = Math.abs(angDiff(ang, a)), rel2 = Math.abs(angDiff(ang, a + 2.2)), rel3 = Math.abs(angDiff(ang, a - 2.0));
    let col = c.shirt;
    if (rel < 1.1 && c.hair) col = c.hair; else if (rel < 1.1) col = c.skin;
    else if (rel2 < 0.7) col = c.pants; else if (rel3 < 0.45 && r2 > 0.3) col = c.skin;
    if (dy > 0.35 || dx > 0.55) col = shade(col, 0.78);
    if (r2 < 0.12 && rel > 1.2) col = shade(col, 1.12);
    x.fillStyle = col; x.fillRect(xx, yy, 1, 1);
  }
  x.fillStyle = shade(c.shoes, 1); const fa = a + Math.PI; x.fillRect(Math.round(cx + Math.cos(fa) * 6) - 1, Math.round(cy + Math.sin(fa) * 5), 3, 2);
}
// monster weapons, baked into the frame (the hero's weapon is drawn live instead)
function paintWeapon(x, L, hx, hy, ang, dir) {
  const fs = (c) => (x.fillStyle = c);
  const line = (len, w, col, from = 0) => { fs(col); const ca = Math.cos(ang), sa = Math.sin(ang) * (dir !== 'side' && Math.abs(Math.sin(ang)) > 0.9 ? 0.75 : 1); for (let i = from; i <= len; i++) x.fillRect(Math.round(hx + ca * i - w / 2), Math.round(hy + sa * i - w / 2), w, w); return [hx + ca * len, hy + sa * len]; };
  const at = (d, ox = 0) => [Math.round(hx + Math.cos(ang) * d - Math.sin(ang) * ox), Math.round(hy + Math.sin(ang) * d + Math.cos(ang) * ox)];
  switch (L.weapon) {
    case 'sword': { line(11, 1, '#e4e8ee', 2); line(11, 1, '#9aa2ae', 9); const [a, b] = at(1, -2), [c, d] = at(1, 2); fs('#8a6a3a'); x.fillRect(Math.min(a, c), Math.min(b, d), Math.abs(c - a) + 1, Math.abs(d - b) + 1); line(1, 2, '#5a3a20', -2); break; }
    case 'cutlass': { line(9, 2, '#e4e8ee', 2); const [a, b] = at(10, 1); fs('#e4e8ee'); x.fillRect(a, b, 2, 1); line(1, 2, '#f2c13a', 0); break; }
    case 'bigsword': { line(15, 2, '#e4e8ee', 3); line(15, 1, '#aab2bd', 4); for (const ox of [-3, -2, -1, 0, 1, 2, 3]) { const [a, b] = at(2, ox); fs('#f2c13a'); x.fillRect(a, b, 1, 1); } line(1, 2, '#5a3a20', -2); break; }
    case 'club': { line(9, 2, '#7a4a24', -1); const [a, b] = at(9); fs('#5a3418'); x.fillRect(a - 2, b - 2, 4, 4); fs('#8a5a2b'); x.fillRect(a - 1, b - 2, 1, 1); break; }
    case 'axe': { line(11, 1, '#6b4423', -1); for (let d = 7; d <= 11; d++) for (let ox = 1; ox <= 3; ox++) { const [a, b] = at(d, ox); fs(ox === 3 ? '#e4e8ee' : '#9aa2ae'); x.fillRect(a, b, 1, 1); } break; }
    case 'bow': { fs('#8a5a2b'); for (let i = -7; i <= 7; i++) { const bend = Math.round(2 - (i * i) / 25 * 2); const [a, b] = [Math.round(hx + Math.cos(ang) * bend - Math.sin(ang) * i), Math.round(hy + Math.sin(ang) * bend + Math.cos(ang) * i)]; x.fillRect(a, b, 1, 1); } fs('#e8e0cc'); for (let i = -6; i <= 6; i++) { const [a, b] = [Math.round(hx - Math.sin(ang) * i - Math.cos(ang)), Math.round(hy + Math.cos(ang) * i - Math.sin(ang))]; x.fillRect(a, b, 1, 1); } break; }
    case 'musket': { line(13, 1, '#3a3a40', 0); line(0, 3, '#6b4423', -3); break; }
    case 'staff': { const a2 = dir === 'side' ? ang : -1.57; const save = ang; ang = a2; line(16, 1, '#5a3a20', -3); const [a, b] = at(16); fs(L.orb || '#b878ea'); x.fillRect(a - 1, b - 2, 3, 3); fs('#ffffff'); x.fillRect(a - 1, b - 2, 1, 1); ang = save; break; }
    case 'claws': { fs('#efe4cc'); for (const ox of [-1, 1]) { const [a, b] = at(2, ox), [c, d] = at(4, ox); x.fillRect(a, b, 1, 1); x.fillRect(c, d, 1, 1); } break; }
  }
}
// add a dark 1px outline around everything painted
function outlineCanvas(c, col = CHAR_OUT) {
  const x = c.getContext('2d'), w = c.width, h = c.height, img = x.getImageData(0, 0, w, h), d = img.data, out = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = (j * w + i) * 4; if (d[k + 3] > 0) continue; if ((i > 0 && d[k - 1] > 0) || (i < w - 1 && d[k + 7] > 0) || (j > 0 && d[k - w * 4 + 3] > 0) || (j < h - 1 && d[k + w * 4 + 3] > 0)) out[j * w + i] = 1; }
  const n = parseInt(col.slice(1), 16);
  for (let i = 0; i < w * h; i++) if (out[i]) { d[i * 4] = (n >> 16) & 255; d[i * 4 + 1] = (n >> 8) & 255; d[i * 4 + 2] = n & 255; d[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0);
}
// ---------- cache and drawing ----------
const _cf = new Map(), _lookKey = new WeakMap();
function lookKey(L) { let k = _lookKey.get(L); if (!k) { k = JSON.stringify(L); _lookKey.set(L, k); } return k; }
function charFrame(L, o) {
  const anim = ANIM_FRAMES[o.anim] ? o.anim : 'idle', f = ((o.f | 0) % ANIM_FRAMES[anim] + ANIM_FRAMES[anim]) % ANIM_FRAMES[anim];
  const key = lookKey(L) + '|' + o.dir + anim + f + (o.blink ? 'b' : '') + (o.armor || '') + (o.trim || '') + (o.helm || '');
  let fr = _cf.get(key); if (fr) return fr;
  if (_cf.size > 4000) _cf.clear();
  const [c, x] = mkCanvas(CHAR_W, CHAR_H);
  const meta = paintChar(x, L, Object.assign({}, o, { anim, f }));
  outlineCanvas(c);
  fr = { c, hand: meta.hand, hand2: meta.hand2, back: meta.back }; _cf.set(key, fr); return fr;
}
// facing helpers: an angle to a view + flip
function viewOf(a) { const c = Math.cos(a), s = Math.sin(a); if (Math.abs(s) > Math.abs(c) * 1.05) return s > 0 ? ['down', false] : ['up', false]; return ['side', c < 0]; }
// draw a character with feet at (x, y). Returns [handX, handY, frame] in world space.
function drawChar(ctx, x, y, L, o) {
  const fr = charFrame(L, o), X = Math.round(x), Y = Math.round(y);
  let img = fr.c; if (o.flip) img = flipped(img);
  if (o.tint === 'white') img = whiteOf(img); else if (o.tint === 'red') img = redOf(img); else if (o.tint === 'ice') img = iceOf(img); else if (o.tint === 'dark') img = darkOf(img);
  const sc = o.scale || 1;
  if (sc === 1) ctx.drawImage(img, X - CHAR_FX, Y - CHAR_FY);
  else ctx.drawImage(img, Math.round(X - CHAR_FX * sc), Math.round(Y - CHAR_FY * sc), Math.round(CHAR_W * sc), Math.round(CHAR_H * sc));
  const hx = o.flip ? CHAR_W - 1 - fr.hand[0] : fr.hand[0];
  return [X + (hx - CHAR_FX) * sc, Y + (fr.hand[1] - CHAR_FY) * sc, fr];
}
// the older call style used around the game: st = { face, moving, walk, breathe, blink, pose, poseT, armor, trim, helm, dir }
function drawHuman(ctx, x, y, L, st) {
  st = st || {};
  const dir = st.dir || (st.pose === 'wave' || st.front ? 'down' : 'side'), flip = dir === 'side' && (st.face || 1) < 0;
  let anim = 'idle', f = st.breathe ? 1 : 0;
  if (st.pose) { anim = st.pose; f = st.poseT >= 0.5 ? 1 : 0; if (st.pose === 'hammer') f = st.poseT >= 0.55 ? 1 : 0; }
  else if (st.moving) { anim = 'walk'; f = Math.floor(((st.walk || 0) / TAU) * 8 + 800) % 8; }
  return drawChar(ctx, x, y, L, { dir, flip, anim, f, blink: st.blink, armor: st.armor, trim: st.trim, helm: st.helm, scale: st.scale });
}
// legacy 6-frame side-view set used for corpses and a few props: stand, step, stand, step, windup, strike
function buildHumanoid(L) {
  return [['idle', 0], ['walk', 2], ['idle', 0], ['walk', 6], ['atk', 0], ['atk', 1]].map(([anim, f]) => charFrame(L, { dir: 'side', anim, f }).c);
}
