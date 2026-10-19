// FNF 2 - song events + character spots from Psych Engine mods, the way their V-Slice ports send them (first used by
// VS Whitty's Definitive Edition port; Tricky, Impostor and most of the big mods were Psych mods too):
//   Set Cam Zoom             value1 = zoom (0 = the stage's), value2 = seconds to tween (sine in-out), empty = at once
//   Add Camera Zoom          a camera bop: +value1 on the game (0.015), +value2 on the HUD (0.03)
//   Cam Boom Speed           an extra bop every value1 beats, value2 times as strong (4 = back to normal)
//   Camera Follow Pos        the camera holds on x,y and ignores FocusCamera until it's sent empty
//   Toggle Strums Visibility value1 = arrow 0-3 opponent / 4-7 you, value2 '1' = show
//   onBeat                   'true' = idle characters bop on every beat
//   Set GF Speed             GF dances every value1 beats
//   Play Animation           value1 = animation, value2 = bf / gf / dad (or 1 / 2 / 0)
//   Change Character         value1 = bf|0, dad|1, gf|2, value2 = character id: swapped where the old one stood
//   Screen Shake             value1 = seconds, value2 = strength (game + HUD)
// Psych-era stages put characters by the corner of their sprite and aim the camera at their middle; stage files carry
// that as characters.<slot>.raw [x, y] + camMid [dx, dy] (+ camSign -1 = the character's camera offset turned around).
(function () {
  const num = (v, d) => { const n = parseFloat(v); return isNaN(n) ? d : n; };   // (Std.parseFloat: '670s' = 670)
  const sineInOut = t => -(Math.cos(Math.PI * t) - 1) / 2;
  const SLOTS = { bf: 'bf', boyfriend: 'bf', player: 'bf', 0: 'bf', dad: 'dad', opponent: 'dad', 1: 'dad', gf: 'gf', girlfriend: 'gf', 2: 'gf' };

  G.ModChars = {
    // a character on a Psych-style spot: sprite corner at raw, camera on its middle (+ the stage's push) + its offsets.
    // Psych characters measure themselves by the FIRST frame of their sheet (the ports switch updateHitbox off).
    place(c, spot) {
      c.x = spot.raw[0]; c.y = spot.raw[1];
      c.originalPosition = { x: c.x, y: c.y };
      c.rawSpot = spot;
      this.focus(c, spot);
      if (spot.hidden) c.visible = false;
    },
    focus(c, spot) {
      const f0 = c.sheet && c.sheet.frames && c.sheet.frames[0];
      const w = f0 ? f0.fw * Math.abs(c.scale.x) : c.width, h = f0 ? f0.fh * Math.abs(c.scale.y) : c.height;
      const m = spot.camMid || [0, 0], co = c.cameraOffsets || [0, 0], go = c.globalOffsets || [0, 0], sg = spot.camSign || 1;
      c.camFocus = { x: c.x + w / 2 + m[0] + sg * co[0] + go[0], y: c.y + h / 2 + m[1] + co[1] + go[1] };
    },
    // every character the song's Change Character events want, made up front (no hitch when they swap in)
    prepare(P) {
      P.swapCache = {};
      for (const e of P.song.events || []) {
        if (e.e !== 'Change Character' || !e.v) continue;
        const slot = SLOTS[String(e.v.value1 || '').trim().toLowerCase()] || 'bf', id = String(e.v.value2 || '').trim();
        const key = slot + ':' + id;
        if (!id || P.swapCache[key] || !G.A.json('preload/data/characters/' + id + '.json')) continue;
        const c = new G.Character(id, slot);
        P.swapCache[key] = c;
      }
      P.swapOrig = { bf: P.bf, dad: P.dad, gf: P.gf };
      return Object.values(P.swapCache);
    },
    swap(P, slot, id) {
      const old = P[slot]; if (!old || old.id === id) return;
      const c = (P.swapCache && P.swapCache[slot + ':' + id]) || (G.A.json('preload/data/characters/' + id + '.json') ? new G.Character(id, slot) : null);
      if (!c) return;
      this.put(P, slot, c, old);
    },
    put(P, slot, c, old) {
      P.stage.addCharacter(c, slot);
      const spot = old.rawSpot;
      if (spot) {
        c.x = old.x; c.y = old.y; c.originalPosition = { x: c.x, y: c.y }; c.rawSpot = spot;
        // (ChangeCharacter.hxc: + the new one's camera offset for everyone)
        this.focus(c, Object.assign({}, spot, { camSign: 1 }));
      }
      c.visible = old.visible;
      c.danceEvery = old.danceEvery;
      P[slot] = c;
      c.dance(true);
      if (slot === 'bf') P.iconP1 = P.makeIcon(c, true);
      if (slot === 'dad') P.iconP2 = P.makeIcon(c, false);
      if (P.sfx && P.sfx.swapped) P.sfx.swapped(P, slot, c, old);
    },
    // a retry puts everyone back
    reset(P) {
      const O = P.swapOrig; if (!O) return;
      for (const slot of ['bf', 'dad', 'gf']) {
        const o = O[slot]; if (!o) continue;
        if (P[slot] !== o) { const cur = P[slot]; this.put(P, slot, o, cur); if (o.rawSpot) { o.x = o.rawSpot.raw[0]; o.y = o.rawSpot.raw[1]; this.focus(o, o.rawSpot); } }
        o.danceEvery = o.data && o.data.danceEvery != null ? o.data.danceEvery : 1;
        o.noDanceUntil = 0;
        if (o.rawSpot) o.visible = !o.rawSpot.hidden;
      }
    },
  };

  G.ModEvents = {
    'Set Cam Zoom'(P, v) {
      const z = String(v.value1).trim() === '0' ? P.stageZoom : num(v.value1, NaN);
      if (isNaN(z)) return;
      const d = num(v.value2, 0);
      if (!v.value2 || String(v.value2).trim() === '0' || d <= 0) { P.zoomTween = null; P.camZoom = z; }
      else P.zoomTween = { t: 0, dur: d, z0: P.camZoom, z1: z, ease: sineInOut };
    },
    'Add Camera Zoom'(P, v) {
      if (G.settings.camZoom === false) return;
      P.bopMul += num(v.value1, 0.015); P.hudZoom += num(v.value2, 0.03);
    },
    'Cam Boom Speed'(P, v) { P.boom = { every: num(v.value1, 4), amt: num(v.value2, 1) }; },
    'Camera Follow Pos'(P, v) {
      const has = !isNaN(parseFloat(v.value1)) || !isNaN(parseFloat(v.value2));
      if (!has) { P.camForced = null; return; }
      P.camForced = { x: num(v.value1, 0), y: num(v.value2, 0) };
      P.camTween = null; P.cam.follow(P.camForced.x, P.camForced.y);
    },
    'Toggle Strums Visibility'(P, v) {
      const n = parseInt(v.value1, 10); if (isNaN(n)) return;
      const L = P.lines[n > 3 ? 1 : 0], s = L && L.strums[n % 4];
      if (s) s.visible = String(v.value2).trim() === '1';
    },
    onBeat(P, v) { P.charDance = String(v.value1).trim() === 'true'; },
    'Set GF Speed'(P, v) { if (P.gf) P.gf.danceEvery = Math.max(1, parseInt(v.value1, 10) || 1); },
    'Play Animation'(P, v) {
      const c = P[SLOTS[String(v.value2 || '').trim().toLowerCase()] || 'dad'];
      if (c) { c.playAnim(String(v.value1 || ''), true); c.holdTimer = 0; }
    },
    'Change Character'(P, v) {
      const slot = SLOTS[String(v.value1 || '').trim().toLowerCase()] || 'bf';
      G.ModChars.swap(P, slot, String(v.value2 || '').trim());
    },
    'Screen Shake'(P, v) {
      const d = num(v.value1, 0), i = num(v.value2, 0);
      if (d > 0 && i !== 0) { P.cam.shake(i, d); P.hud.shake(i, d); }
    },
    // ---- every beat (Cam Boom Speed + onBeat)
    _beat(P, beat) {
      const b = P.boom;
      if (b && b.every !== 4 && b.every > 0 && beat % b.every === 0) G.ModEvents['Add Camera Zoom'](P, { value1: 0.015 * b.amt, value2: 0.03 * b.amt });
      if (P.charDance) for (const c of [P.dad, P.bf]) if (c && c.animName === 'idle' + (c.idleSuffix || '')) c.playAnim(c.animName, true);
    },
    _reset(P) { P.boom = null; P.camForced = null; P.charDance = false; G.ModChars.reset(P); },
  };
})();
