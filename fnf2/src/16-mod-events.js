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
// and the custom events Psych mods ship most (Whitty-ERECT has them all):
//   SetCamZoom               value1 = zoom, value2 = seconds to tween (sine in-out), empty = the camera eases there
//   CamBeat                  value1 = bops per section (empty / 0 = off), value2 = how strong (1)
//   Camera Flash             value1 = 'camGame, forced', value2 = 'RRGGBB, seconds' (or 'r, g, b, seconds')
//   ColoredApple             value1 = seconds, value2 = zoom (optional): the stage goes black + the singers turn into
//                            flat silhouettes + the health bar fades; the next one turns it back
//   Change Scroll Speed      value1 = times the chart speed, value2 = seconds to get there (Psych built-in)
// and V-Slice's own:
//   ScrollSpeed              {scroll, duration (steps), ease, strumline: player|opponent|both, absolute (false = times the
//                            chart speed)}: each strumline can have its own speed (Madness ERECT)
// Psych-era stages put characters by the corner of their sprite and aim the camera at their middle; stage files carry
// that as characters.<slot>.raw [x, y] + camMid [dx, dy] (+ camSign -1 = the character's camera offset turned around).
(function () {
  const num = (v, d) => { const n = parseFloat(v); return isNaN(n) ? d : n; };   // (Std.parseFloat: '670s' = 670)
  const sineInOut = t => -(Math.cos(Math.PI * t) - 1) / 2;
  const EASE = { linear: t => t, sineIn: t => 1 - Math.cos(t * Math.PI / 2), sineOut: t => Math.sin(t * Math.PI / 2), sineInOut,
    quadIn: t => t * t, quadOut: t => 1 - (1 - t) * (1 - t), quadInOut: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    expoOut: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t), expoIn: t => t <= 0 ? 0 : Math.pow(2, 10 * t - 10) };
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
      const gx = go[0] * Math.abs(c.scale.x), gy = go[1] * Math.abs(c.scale.y);     // (drawn x the sheet's scale)
      c.camFocus = { x: c.x + w / 2 + m[0] + sg * co[0] + gx, y: c.y + h / 2 + m[1] + co[1] + gy };
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
    SetCamZoom(P, v) {
      const z = num(v.value1, NaN); if (isNaN(z)) return;
      const d = num(v.value2, NaN);
      // (empty seconds: Psych sets defaultCamZoom and the camera's zoom lerp eases there in about a third of a second)
      P.zoomTween = { t: 0, dur: isNaN(d) || d <= 0 ? 0.35 : d, z0: P.camZoom, z1: z, ease: isNaN(d) || d <= 0 ? (t => 1 - (1 - t) * (1 - t)) : sineInOut };
    },
    CamBeat(P, v) {
      const per = num(v.value1, 0);
      P.camBeat = per > 0 ? { every: Math.max(1, Math.round(16 / per)), amt: num(v.value2, 1) || 1 } : null;
    },
    'Camera Flash'(P, v) {
      if (G.settings.flashing === false) return;
      const parts = String(v.value2 || '').split(',').map(x => x.trim()).filter(Boolean);
      let col = '#FFFFFF', dur = 1;
      if (parts.length >= 4) { col = 'rgb(' + parts.slice(0, 3).join(',') + ')'; dur = num(parts[3], 1); }
      else if (parts.length) { col = '#' + parts[0].replace('#', ''); dur = num(parts[1], 1); }
      P.cam.flash(col, dur || 1);
    },
    ColoredApple(P, v) {
      const A = P.apple = P.apple || { k: 0, on: false };
      let d = num(v.value1, 0); if (d <= 0) d = 0.1;
      A.on = !A.on; A.from = A.k; A.to = A.on ? 1 : 0; A.t = 0; A.dur = d;
      const z = num(v.value2, NaN);
      if (!isNaN(z)) P.zoomTween = { t: 0, dur: d, z0: P.camZoom, z1: z, ease: sineInOut };
    },
    'Change Scroll Speed'(P, v) {
      const to = (P.baseScrollSpeed || P.scrollSpeed) * num(v.value1, 1), d = num(v.value2, 0);
      if (d <= 0) { P.scrollSpeed = to; P.speedTween = null; } else P.speedTween = { t: 0, dur: d, from: P.scrollSpeed, to };
    },
    ScrollSpeed(P, v) {
      const st = G.settings; if (st.speedType === 'const') return;             // (your own fixed speed wins)
      let to = num(v.scroll, 1); if (v.absolute === false) to *= P.song.speed || 1;
      if (st.speedType === 'mult') to *= st.speedValue;
      const lines = v.strumline === 'both' ? [0, 1] : v.strumline === 'opponent' ? [0] : [1];
      const dur = v.ease === 'INSTANT' ? 0 : num(v.duration, 4) * P.cond.stepCrochet / 1000, ease = EASE[v.ease] || EASE.linear;
      P.lineSpeedTw = (P.lineSpeedTw || []).filter(w => { if (lines.includes(w.i)) { P.lines[w.i].scroll = w.to; return false; } return true; });
      for (const i of lines) {
        const L = P.lines[i]; if (!L) continue;
        if (dur <= 0) L.scroll = to; else P.lineSpeedTw.push({ i, t: 0, dur, from: P.lineSpeed(L), to, ease });
      }
    },
    // every frame: the silhouette fade, scroll speed tweens, the mods' HUD parts
    _update(P, dt) {
      const A = P.apple;
      if (A && A.dur) {
        A.t += dt; const k = Math.min(1, A.t / A.dur); A.k = A.from + (A.to - A.from) * k;
        P.hudParts.health.apple = 1 - A.k;
        if (k >= 1) A.dur = 0;
      }
      const T = P.speedTween;
      if (T) { T.t += dt; const k = Math.min(1, T.t / T.dur); P.scrollSpeed = T.from + (T.to - T.from) * k; if (k >= 1) P.speedTween = null; }
      if (P.lineSpeedTw && P.lineSpeedTw.length) P.lineSpeedTw = P.lineSpeedTw.filter(w => { w.t += dt; const k = Math.min(1, w.t / w.dur); P.lines[w.i].scroll = w.from + (w.to - w.from) * w.ease(k); return k < 1; });
    },
    _step(P, step) {
      const B = P.camBeat;
      if (B && step >= 0 && step % B.every === 0 && P.cam.zoom < 1.35 && G.settings.camZoom !== false) { P.bopMul += 0.015 * B.amt; P.hudZoom += 0.03 * B.amt; }
    },
    // ColoredApple: the world with the stage behind the singers covered in black and the singers as flat silhouettes
    // (drawn through one screen-sized canvas instead of baking white copies of their huge sheets)
    _appleWorld(ctx, P) {
      const A = P.apple, k = A.k, cols = P.appleColors || {};
      let oc = this._appleCanvas;
      if (!oc || oc.width !== ctx.canvas.width || oc.height !== ctx.canvas.height) { oc = this._appleCanvas = document.createElement('canvas'); oc.width = ctx.canvas.width; oc.height = ctx.canvas.height; }
      const ox = oc.getContext('2d');
      let black = false;
      for (const s of P.stage.ordered()) {
        const o = s.owner || s, slot = o === P.bf ? 'bf' : o === P.dad ? 'dad' : o === P.gf ? 'gf' : null;
        if (!slot) { s.draw(ctx, P.cam); continue; }
        if (!black) { black = true; G.setScreenT(ctx); ctx.globalAlpha = k; ctx.fillStyle = '#000'; ctx.fillRect(-G.W, -G.H, G.W * 3, G.H * 3); ctx.globalAlpha = 1; }
        if (k < 0.999) s.draw(ctx, P.cam);
        if (!s.visible || s.alpha <= 0) continue;
        ox.setTransform(1, 0, 0, 1, 0, 0); ox.globalCompositeOperation = 'source-over'; ox.globalAlpha = 1; ox.clearRect(0, 0, oc.width, oc.height);
        s.draw(ox, P.cam);
        ox.setTransform(1, 0, 0, 1, 0, 0); ox.globalAlpha = 1; ox.globalCompositeOperation = 'source-in';
        ox.fillStyle = cols[slot] || (o.data && o.data.hpColor) || '#FFFFFF'; ox.fillRect(0, 0, oc.width, oc.height);
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = k; ctx.drawImage(oc, 0, 0); ctx.restore();
      }
    },
    _beat(P, beat) {
      const b = P.boom;
      if (b && b.every !== 4 && b.every > 0 && beat % b.every === 0) G.ModEvents['Add Camera Zoom'](P, { value1: 0.015 * b.amt, value2: 0.03 * b.amt });
      if (P.charDance) for (const c of [P.dad, P.bf]) if (c && c.animName === 'idle' + (c.idleSuffix || '')) c.playAnim(c.animName, true);
    },
    _reset(P) { P.boom = null; P.camForced = null; P.charDance = false; P.camBeat = null; P.apple = null; P.speedTween = null; P.lineSpeedTw = null; for (const L of P.lines || []) L.scroll = null; G.ModChars.reset(P); },
  };
})();
