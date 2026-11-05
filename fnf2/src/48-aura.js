// FNF 2 - Aura Funkin': at South America (Coopey St. Whistler), song Aura Battle, played like the mod. It's a
// Psych Engine 1.0 mod; what its scripts do is here:
//   AURA.lua      no health bar, no score, no ratings / combo, no countdown, only the time left at the top; the two
//                 icons big (140 px) in the bottom corners with 'AURA: 37' (them) and '63 :AURA' (you) between them;
//                 the opponent's notes take your aura (0.023 each, never the last bit); losing = the song starts over
//                 at once (no game over screen); the arrows at 0.6 (the 'aura' note style, tools/own/aura.py)
//   events        Set Cam Zoom (the zoom the camera eases to, or a tween), Camera Set Target (B / D / M / G, with a
//                 time = it moves there + stays), CamPosV2 (the pan up into the sky at the end), bop (a camera bop
//                 every beat, on / off), lyrics (the words under the middle), Image Fade In / Out (black over
//                 everything), backgroundfade (the hallway goes black behind Chase + Ike), Play Animation (Psych's
//                 special animation: held until they sing again)
//   GF Sing       Randy sings those notes, on both sides
// Pictures, songs + the chart come from the mod (tools/own/aura.py, private build only).
(function () {
  const isAura = P => !!(P.stage && P.stage.data && P.stage.data.aura);
  const num = (v, d) => { const n = parseFloat(v); return isNaN(n) ? d : n; };
  const EASE = {
    linear: t => t, sinein: t => 1 - Math.cos(t * Math.PI / 2), sineout: t => Math.sin(t * Math.PI / 2), sineinout: t => -(Math.cos(Math.PI * t) - 1) / 2,
    quadin: t => t * t, quadout: t => 1 - (1 - t) * (1 - t), quadinout: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    cubein: t => t * t * t, cubeout: t => 1 - Math.pow(1 - t, 3), cubeinout: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  };
  const ease = s => EASE[String(s || '').trim().toLowerCase()] || EASE.linear;     // (Psych: a name it doesn't know = linear)
  // 'seconds' or 'seconds,Ease' (the mod's parseDurationEasing): null = no time given
  function durEase(s, def) {
    s = String(s == null ? '' : s).trim(); if (!s) return null;
    const [d, e] = s.split(','); const t = parseFloat(d); if (isNaN(t)) return null;
    return { t, ease: e && e.trim() ? ease(e) : EASE[def] };
  }
  const DRAIN = 0.023;                                  // (Psych's hitHealth)
  const CAM_POS = { bf: [690, 377.9], dad: [-300, 356.5], middle: [-200, 400], up: [50, -2432.1], rotnug: [-230, 450], nug: [970, 500] };   // (CamPosV2.lua)
  const slotOf = s => ({ bf: 'bf', boyfriend: 'bf', '0': 'bf', gf: 'gf', girlfriend: 'gf', '2': 'gf' })[String(s || '').trim().toLowerCase()] || 'dad';

  function fade(A, key, to, dur) { A.fades[key] = { from: A[key], to, t: 0, dur: Math.max(0.0001, dur) }; }

  function camTo(P, x, y, d) {
    P.camForced = { x, y };
    if (!d || d.t <= 0) { P.camTween = null; P.cam.focus(x, y); P.cam.follow(x, y); return; }
    P.camTween = { t: 0, dur: d.t, x0: P.cam.x, y0: P.cam.y, x1: x, y1: y, ease: d.ease };
    P.cam.follow(x, y);
  }

  const FX = {
    setup(P) {
      if (!isAura(P)) return;
      P.aura = { fades: {} };
      // (phones are wider than 1280: the hallway picture grows around its middle so no black shows at the sides)
      const hall = P.stage.props.find(s => s.name === 'sprite1');
      if (hall && G.W > 1280 && !hall._wide) {
        const k = G.W / 1280 * 1.02, w = hall.frameW * hall.scale.x, h = hall.frameH * hall.scale.y;
        hall.x -= w * (k - 1) / 2; hall.y -= h * (k - 1) / 2; hall.scale.x *= k; hall.scale.y *= k; hall._wide = true;
        if (hall.resetSize) hall.resetSize();
      }
    },
    reset(P) {
      if (!P.aura) return;
      const A = P.aura;
      A.zoomTo = P.stageZoom; A.ztw = null; A.bop = null; A.lyric = ''; A.sung = ''; A.lyricCol = '#ffffff'; A.sungCol = '#f2ff00';
      A.black = 1; A.bg = 0; A.timeA = 0; A.fades = {};
      // (Psych: camera speed 1.5 = camFollow lerp exp(-2.4 x 1.5 x dt), FNF 2 counts it per 60th of a second)
      const sp = (P.stage.data.aura && P.stage.data.aura.cameraSpeed) || 1;
      if (P.cam) P.cam.followRate = 1 - Math.exp(-2.4 * sp / 60);
      // skipCountdown: the song starts right away
      P.songPos = 0; P.cond.reset(0);
      // Randy's notes on your side: you hit them, he sings them (Psych's gfNote)
      for (const n of P.notes) if (n.kind === 'gfsing' && n.line === 1) { n.kind = 'No Animation'; n.gfNote = true; }
      P.hideHealth = true;             // (FNF 2's deaths line sits by the health bar: drawHealth puts it between the AURA numbers)
    },
    update(P, dt) {
      const A = P.aura; if (!A) return;
      for (const k in A.fades) {
        const f = A.fades[k]; f.t += dt; const p = Math.min(1, f.t / f.dur);
        A[k] = f.from + (f.to - f.from) * p; if (p >= 1) delete A.fades[k];
      }
      if (P.songPos >= 0) A.timeA = Math.min(1, A.timeA + dt / 0.5);
      if (P.vsCard && A.black > 0.3) P.vsCard.t = 0;      // ('VS CHASE / DEATHS' waits until the black is gone)
      // the zoom: a tween (Set Cam Zoom with a time), or easing to the zoom it was set to (Psych's camZooming lerp)
      P.zoomTween = null;
      if (A.ztw) {
        const w = A.ztw; w.t += dt; const p = Math.min(1, w.t / w.dur);
        P.camZoom = w.z0 + (w.z1 - w.z0) * w.ease(p);
        if (p >= 1) { A.ztw = null; A.zoomTo = w.z1; }
      } else P.camZoom = A.zoomTo + (P.camZoom - A.zoomTo) * Math.exp(-dt * 3.125);
      // AURA.lua onGameOver: the song starts over straight away (the death still counts)
      if (P.health <= 0 && !P.practice && !P.botplay && !P.gameOver && !P.ended) { P.die(); P.restart(true); }
    },
    beat(P) {
      const A = P.aura; if (!A || !A.bop || G.settings.camZoom === false) return;
      if (P.cam.zoom < 1.35) { P.bopMul += A.bop[0] / Math.max(0.1, P.camZoom); P.hudZoom += A.bop[1]; }
    },
    event(P, name, v) {
      const A = P.aura; if (!A) return;
      const v1 = String(v && v.value1 != null ? v.value1 : ''), v2 = String(v && v.value2 != null ? v.value2 : '');
      switch (name) {
        case 'Aura Zoom': {
          const z = parseFloat(v1); if (isNaN(z)) break;
          const d = durEase(v2, 'sineinout');
          if (!d) { A.zoomTo = z; A.ztw = null; }
          else A.ztw = { t: 0, dur: Math.max(0.0001, d.t), z0: P.camZoom, z1: z, ease: d.ease };
          break;
        }
        case 'Aura Bop': {           // (bop.lua: every call flips it on / off, the values stay the newest)
          const b = [v1.trim() ? num(v1, 0.025) : 0.025, v2.trim() ? num(v2, 0.025) : 0.025];
          A.bop = A.bop ? null : b;
          break;
        }
        case 'Aura Cam': {
          const k = v1.trim().toLowerCase(), d = durEase(v2, 'sineinout');
          const fb = P.bf && P.bf.camFocus, fd = P.dad && P.dad.camFocus, fg = P.gf ? P.gf.camFocus : fd;
          const at = k === 'b' ? fb : k === 'd' ? fd : k === 'g' ? fg : k === 'm' && fb && fd ? { x: (fb.x + fd.x) / 2, y: (fb.y + fd.y) / 2 } : null;
          if (!k) { P.camForced = null; break; }              // (back to following the singers at the next section)
          if (!at) break;
          if (!d && (k === 'b' || k === 'd')) { P.camTween = null; P.cam.follow(at.x, at.y); break; }   // (cameraSetTarget)
          camTo(P, at.x, at.y, d || { t: 0 });
          break;
        }
        case 'Aura Cam Pos': {       // (CamPosV2: value2 = 'Ease,seconds')
          const pos = CAM_POS[v1.trim()]; if (!pos) break;
          const [e, t] = v2.split(','); const s = parseFloat(t); if (isNaN(s)) break;
          camTo(P, pos[0], pos[1], { t: s, ease: ease(e) });
          break;
        }
        case 'Aura Lyrics': {
          const k = v1.trim();
          if (k === 'setcolor') A.lyricCol = '#' + v2.replace(/^(0x|#)/i, '').slice(-6);
          else if (k === 'sungcolor') A.sungCol = '#' + v2.replace(/^(0x|#)/i, '').slice(-6);
          if (k === 'set' || k === '') { A.lyric = v2; A.sung = ''; }
          if (k === 'sung') A.sung = v2;
          break;
        }
        case 'Aura Black In': A.black = 0; fade(A, 'black', 1, num(v2, 0)); break;
        case 'Aura Black Out': fade(A, 'black', 0, num(v2, 0)); break;
        case 'Aura BG Fade': {       // (backgroundfade.lua, as it really runs: from clear it fades in, else it's gone at once)
          const d = num(v2, 0);
          if (A.bg === 0 && !A.fades.bg) fade(A, 'bg', 1, d);
          else { A.bg = 1; fade(A, 'bg', 0, d); }
          break;
        }
        case 'Aura Anim': {          // (Play Animation: Psych's specialAnim, no dancing until it ends or they sing)
          const c = P[slotOf(v2)];
          if (c && c.playAnim(v1, true)) { c.holdTimer = 0; c._special = true; }
          break;
        }
      }
    },
    oppSingers(P, n) { return n.kind === 'gfsing' && P.gf ? [P.gf] : [P.dad]; },
    oppHit(P, n) { if (P.aura && P.health > DRAIN) P.health -= DRAIN; },
    playerHit(P, n) { if (n.gfNote && P.gf) P.gf.sing(n.lane, false); },
    popups() { return true; },                         // (no ratings, no combo)
    // the hallway's black (backgroundfade): over the stage + Randy, under Chase + Ike
    drawWorld(ctx, P, drawAll) {
      const A = P.aura;
      if (!A || A.bg <= 0.002) { drawAll(P.cam); return; }
      let done = false;
      const black = () => { done = true; ctx.save(); G.setScreenT(ctx); ctx.globalAlpha = Math.min(1, A.bg); ctx.fillStyle = '#000'; ctx.fillRect(-G.CUT, 0, G.W + G.CUT * 2, G.H); ctx.restore(); };
      for (const s of P.stage.ordered()) {
        const o = s.owner || s;
        if (!done && (o === P.dad || o === P.bf)) black();
        s.draw(ctx, P.cam);
      }
      if (!done) black();
    },
    // AURA.lua's HUD instead of the health bar
    drawHealth(ctx, P) {
      if (!P.aura) return false;
      G.setScreenT(ctx);
      const H = 140, gap = 28, top = P.down && !P.phoneArrows;      // (phones: the bottom corners are free, the top has the pause button + their arrows)
      const size = ic => ic && ic.img ? [ic.img.width >= 300 ? 150 : ic.img.width, ic.img.height] : [H, H];
      const [w1, h1] = size(P.iconP1), [w2, h2] = size(P.iconP2);
      const W1 = w1 * H / h1, W2 = w2 * H / h2;
      const x2 = gap, x1 = G.W - gap - W1, y = top ? 22 : G.H - 22 - H;
      if (P.iconP2.img) ctx.drawImage(P.iconP2.img, 0, 0, w2, h2, x2, y, W2, H);
      if (P.iconP1.img) ctx.drawImage(P.iconP1.img, 0, 0, w1, h1, x1, y, W1, H);
      const hv = Math.max(0, Math.min(100, Math.floor(P.health * 50)));
      const ty = top ? y : y + H - 25;
      G.vcr(ctx, 'AURA: ' + (100 - hv), x2 + W2 + 2, ty, { size: 32, outline: 2 });
      G.vcr(ctx, hv + ' :AURA', x1 - 2, ty, { size: 32, outline: 2, align: 'right' });
      if (G.settings.deathCounter !== false && P.vsWho) G.vcr(ctx, P.deathLine(), G.W / 2, P.phoneArrows ? 40 : ty + 16, { size: 17, outline: 2, align: 'center', baseline: 'middle', alpha: 0.9 });
      return true;
    },
    // only the time left (timeTxt), at the top (downscroll: the bottom; phones: under the icons)
    drawTime(ctx, P) {
      const A = P.aura; if (!A) return false;
      if (G.settings.timeBar === 'off' || A.timeA <= 0.004) return true;
      G.setScreenT(ctx);
      const left = Math.max(0, Math.floor((P.audio.length - Math.max(0, P.songPos)) / 1000));
      const y = P.phoneArrows ? 170 : P.down ? G.H - 44 : 19;
      G.vcr(ctx, Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'), G.W / 2, y, { size: 32, outline: 2, align: 'center', alpha: A.timeA });
      return true;
    },
    drawTop(ctx, P) {
      const A = P.aura; if (!A) return;
      G.setScreenT(ctx);
      // (lyrics.lua: white words at the middle + 120, the sung part in yellow over them)
      if (A.lyric) G.vcr(ctx, A.lyric, G.W / 2, G.H / 2 + 120, { size: 32, outline: 2, align: 'center', color: A.lyricCol });
      if (A.sung) G.vcr(ctx, A.sung, G.W / 2, G.H / 2 + 120, { size: 32, outline: 2, align: 'center', color: A.sungCol });
      if (A.black > 0.002) { ctx.globalAlpha = Math.min(1, A.black); ctx.fillStyle = '#000'; ctx.fillRect(-G.CUT, 0, G.W + G.CUT * 2, G.H); ctx.globalAlpha = 1; }
    },
  };

  G.SongFX = G.SongFX || {};
  G.SongFX['aura-battle'] = FX;
})();
