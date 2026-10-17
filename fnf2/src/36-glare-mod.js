// FNF 2 - GLARE's modchart + battle effects (WRATH's song). Medium: hard but readable.
//   arrows   bob on the beat, sway, swap places on the big hits, spin when he turns into the eye,
//            shake + flicker when the song glitches, float in the void, calm again for the ending
//   notes    'glitch' = jumps between lanes far away, lands in its real lane in time
//            'fake'   = a decoy that breaks apart halfway up, before it reaches you
//            'eye'    = his eye in your lane: DON'T hit it -> he stares at you, the world goes dark
//   WRATH    stage 1: glitches + teleports when the song stutters
//            stage 2: flickers into the creepy copy of BF (mint hair, black in the void)
// Easy: just the bob + sway (no swaps, no special notes - the chart has none there either).
(function () {
  const STRUM_SIZE = 104, INITIAL_OFFSET = -0.275 * STRUM_SIZE;
  const FXI = 'shared/images/fx/', SND = 'shared/sounds/wrath-battle/';
  const T = (bar, beat) => bar * 4 + (beat || 0);                       // in beats
  // the song's stutters (tools/own/glare.py GLITCHES): [start beat, length in beats]
  const STUTTER = [[T(27, 3.5), 0.5], [T(31, 3), 1], [T(47, 3.5), 0.5], [T(59, 3), 1], [T(63, 3.5), 0.5]];
  // stage 1: WRATH teleports (beat, how far)
  const TELEPORT = [[T(21), -90], [T(23), 80], [T(27, 3.5), 110], [T(31, 3), -100], [T(31, 3.5), 70]];
  // stage 2: the eye flickers into the creepy copy of BF
  const FLICKER = [T(43, 3), T(47, 3.5), T(51, 2), T(55, 3), T(59, 3), T(63, 3.5)];
  // player lanes swapping places: [lane a, lane b, start beat, back beat, hard only]
  const SWAPS = [[0, 3, T(27, 2), T(30), false], [1, 2, T(47, 2), T(50), false], [0, 3, T(59, 2), T(62), true]];
  // spins: both strumlines, a full turn (the eye opening is an event, these are on the beat)
  const SPINS = [T(44), T(52), T(56)];

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
  // 0 -> 1 -> 0 envelope between two bars, easing in/out over a beat
  const env = (B, b0, b1) => smooth((B - T(b0)) / 1) * smooth((T(b1) - B) / 1);
  const hash = n => { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); return (n ^ (n >>> 15)) >>> 0; };

  // the 4 arrow heads + a red and a cyan copy of each (RGB split on glitchy notes)
  let tinted = null;
  function tints(sheet) {
    if (tinted) return tinted;
    const img = G.srcImg(sheet.img); if (!img || !img.width || (img.complete === false)) return null;
    tinted = ['Left', 'Down', 'Up', 'Right'].map(d => {
      const f = G.Sparrow.byPrefix(sheet, 'note' + d)[0]; if (!f) return null;
      const mk = col => {
        const cv = G.makeCanvas(Math.ceil(f.fw), Math.ceil(f.fh)), c = cv.getContext('2d');
        G.Sparrow.draw(c, sheet, f);
        if (col) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = col; c.fillRect(0, 0, cv.width, cv.height); }
        return cv;
      };
      return { norm: mk(null), red: mk('rgba(255,30,60,0.85)'), cyan: mk('rgba(0,230,255,0.85)') };
    });
    return tinted;
  }

  G.Modcharts = G.Modcharts || {};
  const M = G.Modcharts.glare = {
    setup(P) {
      const diff = P.song.diff;
      P.glare = { amp: diff === 'easy' ? 0.5 : diff === 'hard' ? 1.15 : 1, tricks: diff !== 'easy', hard: diff === 'hard' };
      G.A.warmNow([FXI + 'eye-note.png']);
      G.audio.preload([SND + 'glitch.ogg', SND + 'eye-stare.ogg']);
      // the creepy copies of BF (made up front so the first flicker doesn't hitch)
      const g = P.glare;
      g.creepy = ['wrath', 'wrath-black'].map(id => {
        if (!G.A.json('preload/data/characters/' + id + '.json')) return null;
        const c = new G.Character(id, 'dad');
        P.stage.addCharacter(c, 'dad');
        return c;
      });
      P.stage.chars.dad = P.dad;
      if (P.dadForms) g.home = { x: P.dadForms[0].originalPosition.x, y: P.dadForms[0].originalPosition.y };
    },
    reset(P) {
      const g = P.glare; if (!g) return;
      g.spin = null; g.spinStart = -1; g.tp = null; g.ghost = null; g.flick = null; g.dark = 0; g.trapT = 0; g.camBack = null;
      g.tpIdx = 0; g.flIdx = 0; g.spIdx = 0;
      if (g.home && P.dadForms) { P.dadForms[0].x = g.home.x; P.dadForms[0].y = g.home.y; }
      if (P.dad) P.stage.chars.dad = P.dad;
    },
    event(P, name) {
      const g = P.glare; if (!g) return;
      if (name === 'WrathEye') { g.spinStart = P.songPos / P.cond.crochet; g.tp = null; if (g.home) P.dadForms[0].x = g.home.x; }
    },
    beat(P, beat) {},
    // -------------------------------------------------------------- every frame
    update(P, dt) {
      const g = P.glare; if (!g) return;
      const B = P.songPos / P.cond.crochet, bar = B / 4;
      const fl = G.settings.flashing !== false;
      // ---------------- arrows
      const bob = (bar >= 12 && bar < 32 ? 8 : bar >= 36 && bar < 64 ? 12 : 0) * g.amp;
      const kick = Math.pow(1 - (B - Math.floor(B)), 3) * (B > 0 ? 1 : 0);
      const sway = (14 * env(B, 20, 32) + 26 * env(B, 36, 52) + 18 * env(B, 52, 64)) * g.amp;
      const float = 16 * env(B, 52, 64) * g.amp;
      const dir = P.down ? -1 : 1;
      let jit = 0;
      for (const [s0, len] of STUTTER) if (B >= s0 && B < s0 + len) jit = 1;
      // a full turn when the eye opens (event) and on a few big beats
      let spinAt = g.spinStart;
      for (const sb of SPINS) if (B >= sb && B < sb + 1.5) spinAt = sb;
      P.lines.forEach((L, li) => {
        const side = li === 1 ? 1 : -1;
        L.strums.forEach((s, i) => {
          let x = Math.sin(B * Math.PI / 4) * sway * side;
          let y = bob * kick * dir + Math.sin(B * Math.PI / 2 + i * 0.9) * float;
          let a = 0, al = 1;
          // swapping places (player only)
          if (g.tricks && li === 1) for (const [la, lb, b0, b1, hardOnly] of SWAPS) {
            if (hardOnly && !g.hard) continue;
            if (i !== la && i !== lb) continue;
            const e = smooth(B - b0) * (1 - smooth(B - b1));
            if (e <= 0) continue;
            const other = L.strums[i === la ? lb : la];
            x += (other.bx - s.bx) * e;
            y += Math.sin(Math.min(1, Math.max(0, B < b1 ? B - b0 : B - b1)) * Math.PI) * 34 * (i === la ? -1 : 1) * dir;
          }
          // spin
          if (spinAt >= 0) { const k = (B - spinAt - i * 0.12) / 1.2; if (k > 0 && k < 1) a = G.ease.cubeInOut ? G.ease.cubeInOut(k) * 360 : k * 360; }
          // the song stutters: arrows shake + flicker
          if (jit) { x += (Math.random() - 0.5) * 18 * g.amp; y += (Math.random() - 0.5) * 12 * g.amp; al = Math.random() < 0.25 ? 0.45 : 1; }
          s.mx = x; s.my = y; s.ma = a; s.mal = al;
        });
      });
      if (spinAt === g.spinStart && g.spinStart >= 0 && B > g.spinStart + 2) g.spinStart = -1;
      // ---------------- stage 1: WRATH glitches + teleports
      const W = P.dadForms && P.dadForms[0];
      if (W && g.home && P.dad === W) {
        while (g.tpIdx < TELEPORT.length && B >= TELEPORT[g.tpIdx][0]) {
          const [, off] = TELEPORT[g.tpIdx++];
          if (B - TELEPORT[g.tpIdx - 1][0] > 1) continue;                  // (skipped past it: seeking)
          g.ghost = { x: W.x, y: W.y, t: 0 };
          g.tp = { t: 0, dur: 0.22, off };
          G.sfx(SND + 'glitch.ogg', { vol: 0.45 });
          if (P.park) P.park.burst = Math.max(P.park.burst || 0, 0.12);
        }
        if (g.tp) {
          g.tp.t += dt;
          W.x = g.home.x + (g.tp.t < g.tp.dur ? g.tp.off + (Math.random() - 0.5) * 14 : 0);
          if (g.tp.t >= g.tp.dur) { W.x = g.home.x; g.tp = null; }
        }
      }
      if (g.ghost) { g.ghost.t += dt; if (g.ghost.t > 0.3) g.ghost = null; }
      // ---------------- stage 2: flickers into the creepy BF
      const E = P.dadForms && P.dadForms[1];
      if (E && P.dad === E) {
        while (g.flIdx < FLICKER.length && B >= FLICKER[g.flIdx]) {
          const at = FLICKER[g.flIdx++];
          if (B - at > 1) continue;
          const c = g.creepy[bar >= 52 ? 1 : 0] || g.creepy[0];
          if (!c) continue;
          const sing = /^sing(LEFT|DOWN|UP|RIGHT)/.exec(E.animName || '');
          c.playAnim(sing ? sing[0] : 'idle', true);
          g.flick = { c, t: 0 };
          G.sfx(SND + 'glitch.ogg', { vol: 0.55 });
          if (P.park) P.park.burst = Math.max(P.park.burst || 0, 0.2);
          if (fl) P.cam.shake(0.006, 0.15);
        }
      }
      if (g.flick) {
        const f = g.flick; f.t += dt; f.c.update(dt);
        // creepy BF / eye / creepy BF, then back for good
        const on = f.t < 0.07 || (f.t > 0.12 && f.t < 0.2);
        P.stage.chars.dad = on ? f.c : P.dad;
        if (f.t >= 0.2) { P.stage.chars.dad = P.dad; g.flick = null; }
      }
      // ---------------- the stare (you hit an eye note)
      if (g.trapT > 0) g.trapT = Math.max(0, g.trapT - dt);
      if (g.camBack && g.trapT < 0.6) {
        // (unless a camera event moved it somewhere else meanwhile)
        if (P.cam.tx === g.camBack.eye[0] && P.cam.ty === g.camBack.eye[1]) P.cam.follow(g.camBack.x, g.camBack.y);
        g.camBack = null;
      }
      g.dark = g.trapT > 0 ? Math.min(0.82, g.trapT / 1.4 * 1.4) : 0;
    },
    // you hit one of his eye notes: he stares at you and the world goes dark
    trap(P, n) {
      const g = P.glare; if (!g) return;
      g.trapT = 1.4;
      G.sfx(SND + 'eye-stare.ogg', { vol: 0.9 });
      // the camera swings to the eye for a moment, then goes back to whoever it was on
      if (P.dad) { g.camBack = { x: P.cam.tx, y: P.cam.ty, eye: [P.dad.camFocus.x, P.dad.camFocus.y] }; P.cam.follow(g.camBack.eye[0], g.camBack.eye[1]); }
      if (P.dad && P.dad.fx && P.dad.fx.stare) P.dad.fx.stare(P.dad, 1.3);
      P.bopMul = Math.max(P.bopMul, 1.06);
      if (G.settings.flashing !== false) P.cam.shake(0.008, 0.35);
    },
    // over the world (under the HUD): the stare's darkness (only the eye still shows) + WRATH's teleport ghost
    drawWorld(ctx, P) {
      const g = P.glare; if (!g) return;
      if (g.ghost && P.dadForms) {
        const W = P.dadForms[0], k = 1 - g.ghost.t / 0.3, ox = W.x, oy = W.y;
        W.x = g.ghost.x; W.y = g.ghost.y;
        G.imgFilter = 'brightness(0.55) sepia(1) saturate(9) hue-rotate(-50deg)';
        ctx.save(); ctx.globalAlpha = 0.5 * k;
        try { W.draw(ctx, P.cam); } finally { G.imgFilter = null; ctx.restore(); W.x = ox; W.y = oy; }
      }
      if (g.tp && P.dadForms) {                                        // red/cyan split while he teleports
        const W = P.dadForms[0], ox = W.x;
        for (const [dx, f] of [[-12, 'brightness(0.6) sepia(1) saturate(9) hue-rotate(-50deg)'], [12, 'brightness(0.8) sepia(1) saturate(7) hue-rotate(140deg)']]) {
          W.x = ox + dx; G.imgFilter = f; ctx.save(); ctx.globalAlpha = 0.35; ctx.globalCompositeOperation = 'screen';
          try { W.draw(ctx, P.cam); } finally { G.imgFilter = null; ctx.restore(); }
        }
        W.x = ox;
      }
      if (g.dark > 0) {
        G.setScreenT(ctx); ctx.fillStyle = 'rgba(0,0,0,' + g.dark.toFixed(3) + ')'; ctx.fillRect(0, 0, G.W, G.H);
        if (P.dad && P.stage.chars.dad === P.dad) P.dad.draw(ctx, P.cam);      // ...except his eye, staring at you
      }
    },
    // -------------------------------------------------------------- special notes
    drawNote(ctx, P, n, L, x, y, f, sheet) {
      const k = n.kind;
      if (k !== 'eye' && k !== 'fake' && k !== 'glitch') return false;
      const S = L.strums[n.lane], dtm = n.t - P.songPos, cx = x + f.fw * 0.35, cy = y + f.fh * 0.35;
      const base = (n.missed ? 0.3 : 1) * S.alpha;
      const arrow = (ax, ay, alpha, img) => {
        ctx.save(); ctx.translate(ax, ay);
        if (S.angle) { const c = f.fw * 0.35; ctx.translate(c, c); ctx.rotate(S.angle * Math.PI / 180); ctx.translate(-c, -c); }
        ctx.scale(0.7, 0.7); ctx.globalAlpha *= alpha;
        if (img) ctx.drawImage(img, 0, 0); else G.Sparrow.draw(ctx, sheet, f);
        ctx.restore();
      };
      if (k === 'eye') {
        const im = G.A.image(FXI + 'eye-note.png'); if (!im) return true;
        const t = P.songPos / 1000, w = 118 * (1 + 0.06 * Math.sin(t * 9 + n.i)), h = w * im.height / im.width;
        const fade = dtm < -30 ? Math.max(0, 1 + (dtm + 30) / 140) : 1;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate((S.angle + Math.sin(t * 3 + n.i) * 7) * Math.PI / 180);
        ctx.globalAlpha *= base * fade;
        ctx.drawImage(G.srcImg(im), -w / 2, -h / 2, w, h);
        ctx.restore();
        return true;
      }
      const tz = tints(sheet), tn = tz && tz[n.lane];
      if (k === 'fake') {
        // looks real until it's about halfway up, then breaks apart (by distance, so every scroll speed is fair)
        const dist = Math.abs(P.noteY(n.t)), V = 330, gone = 190;
        if (dist < gone) return true;
        if (dist < V) {
          const q = (V - dist) / (V - gone), img = G.srcImg(sheet.img);
          if (!n._broke) { n._broke = true; G.sfx(SND + 'glitch.ogg', { vol: 0.22 }); }
          for (let s = 0; s < 3; s++) {                                   // three slices sliding apart
            const sy = f.fh * s / 3, sh = f.fh / 3, off = (s - 1) * 26 * q + (s === 1 ? 0 : (Math.random() - 0.5) * 8 * q);
            ctx.save(); ctx.translate(x + off, y + sy * 0.7); ctx.scale(0.7, 0.7); ctx.globalAlpha *= base * (1 - q);
            ctx.drawImage(tn ? (s === 1 ? tn.norm : s === 0 ? tn.red : tn.cyan) : img, tn ? 0 : f.x, tn ? sy : f.y + sy, f.fw, sh, 0, 0, f.fw, sh);
            ctx.restore();
          }
          return true;
        }
        arrow(x, y, base);
        return true;
      }
      // glitch: far away it hops between lanes with a red/cyan split; it lands in its own lane in time
      const dist = Math.abs(P.noteY(n.t));
      if (dist > 300) {
        const hop = hash(n.i * 131 + Math.floor(P.songPos / 95)) % 4, VS = L.strums[hop];
        const gx = x + (VS.x - S.x), flick = hash(n.i + Math.floor(P.songPos / 45)) % 5 === 0 ? 0.35 : 1;
        if (tn) { arrow(gx - 7, y, 0.55 * base * flick, tn.red); arrow(gx + 7, y, 0.55 * base * flick, tn.cyan); }
        arrow(gx, y, base * flick);
        return true;
      }
      if (dist > 220 && tn) { const q = (dist - 220) / 80; arrow(x - 7 * q, y, 0.5 * q * base, tn.red); arrow(x + 7 * q, y, 0.5 * q * base, tn.cyan); }
      arrow(x, y, base);
      return true;
    },
  };
})();
