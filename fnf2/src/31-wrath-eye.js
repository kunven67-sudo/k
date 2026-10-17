// FNF 2 - WRATH stage 2: the GIANT EYE.
// A huge floating spiky eye over a lump of black goo, with the Monster's (week 2) real arms
// growing out of the goo, one claw gripping BF's real mic (repainted dark).
// The pieces come from tools/own/wrath_eye.py (build/own/.../wrath-eye/, private):
//   back-<look> / iris-<look> / gloss-<look> / line-void  hand-inked eye, 5 looks
//   arm-<frame>-<side>.png + meta.poses                     Monster arms per pose (+ boil frames)
//   mic.png, goo.png (Monster's scribbly black, as a fill pattern)
// Here they are put together live: the eye is composed in a small buffer every frame (so a
// miss can tint it purple and a look switch can glitch it), lids are inked on top.
// Each arrow has its own eye look (the user's 5 pictures):
//   idle = black eye w/ glowing red ring, LEFT = white spiral, DOWN = grey red ring,
//   UP = blue rings, RIGHT = red veiny.
// Long notes shake the camera and splash the goo.
(function () {
  const TAU = Math.PI * 2;
  const DIR = 'shared/images/characters/wrath-eye/';
  const img = n => G.A.image(DIR + n + '.png');
  const META = () => G.A.json(DIR + 'meta.json');
  const AW = 236, AT = 120, AB = 104;                     // almond half width / top + bottom half heights
  const almY = (u, top) => (top ? -AT : AB) * Math.pow(Math.max(0, 1 - u * u), 1.12);
  const BOX = { x: -360, y: -300, w: 720, h: 590 };       // eye buffer (spikes included), eye space
  const SS = 1.35;                                         // the eye art is made at this scale
  const INK = '#050407';
  const LOOKS = {
    void: { body: '#201e29', shade: '#0d0c12', glow: '#ff2a44' },
    spiral: { body: '#f4f3f8', shade: '#b8b6c8', glow: '#cfc6ff', spin: true },
    redring: { body: '#4a4851', shade: '#2c2b32', glow: '#ff3434' },
    blue: { body: '#4b48e8', shade: '#2d29b0', glow: '#566dff' },
    veins: { body: '#d8161f', shade: '#880a12', glow: '#ff1414' },
  };
  const BY_DIR = ['spiral', 'redring', 'blue', 'veins'];

  function almondPath(c) {
    c.beginPath();
    const N = 56;
    for (let i = 0; i <= N; i++) { const u = -1 + 2 * i / N; c.lineTo(u * AW, almY(u, true)); }
    for (let i = N - 1; i > 0; i--) { const u = -1 + 2 * i / N; c.lineTo(u * AW, almY(u, false)); }
    c.closePath();
  }
  // a brush line: width wanders between w0 and w1 (fixed per point, so it doesn't crawl)
  const NZ = (function () { const r = G.rng(91), a = []; for (let i = 0; i < 256; i++) a.push(r()); return a; })();
  function brush(c, pts, w0, w1, seed) {
    const n = pts.length, L = [], R = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const s = i / (n - 1), k = NZ[(i + seed) & 255] * 0.6 + NZ[(i * 3 + seed) & 255] * 0.4;
      const w = (w0 + (w1 - w0) * k) * Math.min(1, 0.3 + 3 * Math.min(s, 1 - s)) / 2;
      L.push([pts[i][0] - ty * w, pts[i][1] + tx * w]); R.push([pts[i][0] + ty * w, pts[i][1] - tx * w]);
    }
    c.beginPath(); for (const p of L) c.lineTo(p[0], p[1]); for (let i = n - 1; i >= 0; i--) c.lineTo(R[i][0], R[i][1]); c.closePath();
    c.fillStyle = INK; c.fill();
  }

  // ---------------------------------------------------------------- composing the eye
  // st = { look, px, py, ps (pupil scale), spin, lid (1 open .. 0 shut), anger, purple }
  function composeEye(c, st) {
    const L = LOOKS[st.look], S = SS;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, c.canvas.width, c.canvas.height);
    const back = img('back-' + st.look); if (back) c.drawImage(back, 0, 0);
    c.setTransform(S, 0, 0, S, -BOX.x * S, -BOX.y * S);
    c.save(); almondPath(c); c.clip();
    const ir = img('iris-' + st.look);
    if (ir) { const P = ir.width / S / 2; c.save(); c.translate(st.px, st.py); if (st.spin) c.rotate(st.spin); c.scale(st.ps, st.ps); c.drawImage(ir, -P, -P, P * 2, P * 2); c.restore(); }
    const gl = img('gloss-' + st.look); if (gl) c.drawImage(gl, BOX.x, BOX.y, BOX.w, BOX.h);
    // lids: the top one comes down (sloped = angry, lower on BF's side), the bottom one rises a bit
    const k = 1 - G.clamp(st.lid, 0, 1);
    if (k > 0.01 || st.anger > 0.01) {
      const N = 30, top = [], bot = [];
      for (let i = 0; i <= N; i++) {
        const u = -1 + 2 * i / N, yt = almY(u, true), yb = almY(u, false), meet = G.lerp(yt, yb, 0.62);
        const slope = st.anger * (0.25 + 0.75 * (u + 1) / 2) * AT * 0.42 * Math.pow(1 - u * u, 0.6);
        top.push([u * AW, Math.min(meet, G.lerp(yt, meet, k) + slope)]);
        bot.push([u * AW, Math.max(meet, G.lerp(yb, meet, k * 0.55))]);
      }
      const lid = (pts, edgeY, seed) => {
        c.beginPath(); c.moveTo(-AW - 4, edgeY);
        for (const p of pts) c.lineTo(p[0], p[1]);
        c.lineTo(AW + 4, edgeY); c.closePath();
        c.fillStyle = L.body; c.fill();
        // choppy shade under the lid edge
        const sg = edgeY < 0 ? -1 : 1;
        c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
        for (let i = 0; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1] + sg * (i % 6 < 3 ? 13 : 8));
        for (let i = pts.length - 1; i >= 0; i--) c.lineTo(pts[i][0], pts[i][1]);
        c.closePath(); c.fillStyle = L.shade; c.fill();
        brush(c, pts, 5, 10, seed);
      };
      lid(top, -AT - 20, 3);
      if (k > 0.01) lid(bot, AB + 20, 40);
    }
    c.restore();
    const line = img('line-void'); if (line) c.drawImage(line, BOX.x, BOX.y, BOX.w, BOX.h);
    if (st.purple > 0) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = 'rgba(58,22,118,' + (0.62 * st.purple).toFixed(3) + ')'; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
      c.globalCompositeOperation = 'source-over';
    }
  }
  const glowCache = {};
  function glowArt(col) {
    if (glowCache[col]) return glowCache[col];
    const cv = G.makeCanvas(256, 256), c = cv.getContext('2d');
    const g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, G.rgba(col, 0.9)); g.addColorStop(0.35, G.rgba(col, 0.38)); g.addColorStop(1, G.rgba(col, 0));
    c.fillStyle = g; c.fillRect(0, 0, 256, 256);
    return (glowCache[col] = cv);
  }

  // ---------------------------------------------------------------- poses
  // eye offset/rot/squash, lid, pupil dir. The arms come from the Monster's pose of the same arrow.
  const POSE = {
    idle: { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1, lid: 0.8, anger: 0.75, pdx: 0.42, pdy: 0.12, ps: 1 },
    L: { dx: -62, dy: -10, rot: -9, sx: 1.05, sy: 0.96, lid: 1, anger: 0.35, pdx: -1, pdy: 0, ps: 0.86 },
    D: { dx: 0, dy: 50, rot: 0, sx: 1.14, sy: 0.84, lid: 1, anger: 0.45, pdx: 0, pdy: 1, ps: 0.86 },
    U: { dx: 0, dy: -60, rot: 0, sx: 0.9, sy: 1.14, lid: 1, anger: 0.2, pdx: 0, pdy: -1, ps: 0.86 },
    R: { dx: 64, dy: -6, rot: 8, sx: 1.05, sy: 0.96, lid: 1, anger: 0.4, pdx: 1, pdy: 0, ps: 0.86 },
  };
  const KEYS = Object.keys(POSE.idle);
  const FRAME = { w: 1100, h: 1050 }, GROUND = 1020, REST = [520, 450];
  const ARM_K = 2.5;                                       // Monster art -> WRATH size
  const SHOULDER = { L: [-235, 165], R: [235, 165] };      // where each arm comes out of the goo (eye space)

  // ---------------------------------------------------------------- the character fx
  G.OwnFX = G.OwnFX || {};
  const FX = G.OwnFX.wrathEye = {
    init(ch) {
      ch.frameW = FRAME.w; ch.frameH = FRAME.h; ch.resetSize();
      const own = (n, frames) => { ch.anims[n] = { kind: 'own', n: frames, fps: 24, loop: false }; ch.animOffsets[n] = [0, 0]; };
      own('idle', 12);
      for (const d of ['LEFT', 'DOWN', 'UP', 'RIGHT']) { own('sing' + d, 8); own('sing' + d + 'miss', 10); }
      ch._buf = G.makeCanvas(Math.ceil(BOX.w * SS), Math.ceil(BOX.h * SS));
      ch._bctx = ch._buf.getContext('2d');
      ch._p = Object.assign({}, POSE.idle); ch._tgt = POSE.idle; ch._hit = 0;
      ch._pose = 'idle'; ch._poseT = 0; ch._bopT = 9;
      ch._look = 'void'; ch._glitch = 0; ch._purple = 0; ch._shake = 0; ch._bop = 0; ch._glowP = 0;
      ch._t = Math.random() * 10; ch._blink = 2 + Math.random() * 3; ch._blinkT = 0;
      ch._drops = []; ch._splats = []; ch._dropT = 0.4; ch._puddle = 0;
      const play = ch.play.bind(ch);
      ch.play = (n, f, r) => { const ok = play(n, f, r); if (ok) FX.onAnim(ch, n); return ok; };
    },
    setLook(ch, look) { if (ch._look !== look) { ch._look = look; ch._glitch = 0.09; } },
    onAnim(ch, name) {
      const m = /^sing(LEFT|DOWN|UP|RIGHT)(miss)?/.exec(name);
      if (m) {
        const d = ['LEFT', 'DOWN', 'UP', 'RIGHT'].indexOf(m[1]);
        ch._pose = 'LDUR'[d]; ch._poseT = 0;
        ch._tgt = POSE[ch._pose]; ch._miss = !!m[2]; ch._hit = 1; ch._glowP = 1;
        this.setLook(ch, BY_DIR[d]);
        for (const k of KEYS) ch._p[k] = G.lerp(ch._p[k], ch._tgt[k], 0.7);   // FNF poses hit on the first frame
        if (ch._miss) { ch._purple = 1; ch._shake = 0.35; } else ch._purple = 0;
        if (d === 1 && !ch._miss) { this.splash(ch, 5); ch._puddle = 1; }
      } else {
        ch._tgt = POSE.idle; ch._miss = false;
        if (name === 'idle') { if (ch._pose !== 'idle') ch._poseT = 0; ch._pose = 'idle'; ch._bop = 1; ch._bopT = 0; this.setLook(ch, 'void'); }
      }
    },
    // long notes hit harder: camera shake + goo splash
    onSing(ch, dir, miss) {
      const n = ch.lastNote; ch.lastNote = null;
      if (miss || !n || !(n.len > 240)) return;
      this.splash(ch, 12); ch._puddle = 1;
      const ps = G.screens && G.screens.play;
      if (ps && ps.cam && ps.dad === ch && G.settings.flashing !== false) ps.cam.shake(0.007, 0.2);
    },
    splash(ch, n) {
      const e = this.eyePos(ch);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
        ch._splats.push({ x: e[0] + (Math.random() - 0.5) * 340, y: GROUND - 10, vx: Math.cos(a) * (180 + Math.random() * 260), vy: Math.sin(a) * (420 + Math.random() * 380), r: 6 + Math.random() * 9, t: 0, fly: true });
      }
    },
    eyePos(ch) {
      const p = ch._p, t = ch._t;
      return [REST[0] + p.dx + Math.sin(t * 0.9) * 7, REST[1] + p.dy + Math.sin(t * 1.7) * 15 + ch._bop * 10];
    },
    update(ch, dt) {
      ch._t += dt; ch._poseT += dt; ch._bopT += dt;
      const p = ch._p, tg = ch._tgt;
      ch._hit = Math.max(0, ch._hit - dt * 9);
      const rate = tg === POSE.idle ? 7 : 26;
      for (const k of KEYS) { const goal = tg === POSE.idle ? tg[k] : tg[k] + (tg[k] - POSE.idle[k]) * 0.12 * ch._hit; p[k] = G.damp(p[k], goal, rate, dt); }
      ch._glitch = Math.max(0, ch._glitch - dt);
      ch._purple = ch._miss ? Math.max(0.6, ch._purple - dt) : Math.max(0, ch._purple - dt * 5);
      ch._shake = Math.max(0, ch._shake - dt);
      ch._bop = Math.max(0, ch._bop - dt * 5);
      ch._glowP = Math.max(0, ch._glowP - dt * 3);
      ch._puddle = Math.max(0, ch._puddle - dt * 2.5);
      ch._blink -= dt;
      if (ch._blink <= 0) { ch._blinkT = 0.16; ch._blink = 2.2 + Math.random() * 3.5; }
      ch._blinkT = Math.max(0, ch._blinkT - dt);
      // goo drips: grow under the goo, let go, fall, splat on the road
      ch._dropT -= dt;
      if (ch._dropT <= 0 && ch._drops.length < 6) { ch._dropT = 0.35 + Math.random() * 0.7; ch._drops.push({ ox: (Math.random() - 0.5) * 380, len: 0, grow: 0.7 + Math.random() * 0.8, r: 8 + Math.random() * 6, fall: false, x: 0, y: 0, vy: 0 }); }
      const e = this.eyePos(ch);
      for (const d of ch._drops) {
        if (!d.fall) {
          d.len += dt * 46 / d.grow;
          d.x = e[0] + d.ox; d.y = e[1] + this.gooBottomAt(d.ox, ch._t) - 14;
          if (d.len > 46) { d.fall = true; d.vy = 60; d.y += d.len; }
        } else {
          d.vy += 2300 * dt; d.y += d.vy * dt;
          if (d.y >= GROUND - 8) {
            d.dead = true; ch._puddle = Math.max(ch._puddle, 0.35);
            for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2; ch._splats.push({ x: d.x, y: GROUND - 8, vx: Math.cos(a) * 140, vy: Math.sin(a) * 260, r: 3 + Math.random() * 3, t: 0, fly: true }); }
            ch._splats.push({ x: d.x, y: GROUND - 6, r: d.r * 2.2, t: 0, fly: false });
          }
        }
      }
      ch._drops = ch._drops.filter(d => !d.dead);
      for (const s of ch._splats) {
        s.t += dt;
        if (s.fly) { s.vy += 1800 * dt; s.x += s.vx * dt; s.y += s.vy * dt; if (s.y > GROUND - 4 && s.vy > 0) { s.fly = false; s.t = 0; s.y = GROUND - 5; s.r *= 1.4; } }
      }
      ch._splats = ch._splats.filter(s => s.fly || s.t < 0.45);
      if (ch._splats.length > 60) ch._splats.splice(0, ch._splats.length - 60);
    },

    // which Monster frame the arms use right now: hit frame, then the 2 boil frames at 12 fps
    armFrame(ch) {
      const m = META(); if (!m) return null;
      if (ch._pose === 'idle') {
        if (ch._bopT < 4 / 24) return m.poses.idleBop[Math.min(3, Math.floor(ch._bopT * 24))];
        const f = m.poses.idle; return f[Math.floor(ch._t * 12) % f.length];
      }
      const f = m.poses[ch._pose];
      if (ch._poseT < 2 / 24) return f[0];
      return f[1 + Math.floor(ch._poseT * 12) % (f.length - 1)];
    },

    // -------------------------------------------------------------- drawing (frame space)
    draw(ch, c) {
      const p = ch._p, e = this.eyePos(ch), purple = ch._purple > 0.3, t = ch._t;
      let ex = e[0], ey = e[1];
      if (ch._shake > 0) { ex += (Math.random() - 0.5) * 22 * ch._shake / 0.35; ey += (Math.random() - 0.5) * 14 * ch._shake / 0.35; }
      const L = LOOKS[ch._look];
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.3 + 0.25 * ch._glowP;
      c.drawImage(glowArt(L.glow), ex - 500, ey - 400, 1000, 800);
      c.restore();
      this.drawPuddle(ch, c, ex);
      this.drawArms(ch, c, ex, ey);
      this.drawGoo(ch, c, ex, ey, purple);
      this.drawDrops(ch, c, purple);
      const blink = ch._blinkT > 0 ? Math.sin((1 - ch._blinkT / 0.16) * Math.PI) : 0;
      composeEye(ch._bctx, {
        look: ch._look, px: p.pdx * AW * 0.42, py: p.pdy * AT * 0.34,
        ps: p.ps * (purple ? 0.82 : 1), spin: L.spin ? -t * 2.4 : 0,
        lid: Math.min(ch._miss ? 0.55 : 1, p.lid) * (1 - blink), anger: p.anger, purple: ch._purple,
      });
      const S = SS;
      c.save();
      c.translate(ex, ey); c.rotate(p.rot * Math.PI / 180);
      const bop = 1 - ch._bop * 0.035;
      c.scale(p.sx / S * (2 - bop), p.sy / S * bop);
      if (ch._glitch > 0) {
        const rnd = G.rng((t * 60) | 0), H = ch._buf.height, sl = 7;
        for (let i = 0; i < sl; i++) {
          const y0 = Math.floor(H * i / sl), h = Math.ceil(H / sl), off = (rnd() - 0.5) * 70 * S;
          c.drawImage(ch._buf, 0, y0, ch._buf.width, h, BOX.x * S + off, BOX.y * S + y0, ch._buf.width, h);
        }
      } else c.drawImage(ch._buf, BOX.x * S, BOX.y * S);
      c.restore();
      this.drawSplats(ch, c, purple);
    },
    // the Monster's arms, each moved so its shoulder sits in the goo; BF's mic in the right claw
    drawArms(ch, c, ex, ey) {
      const fr = this.armFrame(ch); if (!fr) return;
      const K = ARM_K;
      for (const a of fr.arms) {
        const im = img(a.file.replace('.png', '')); if (!im) continue;
        const sh = SHOULDER[a.side], ox = ex + sh[0], oy = ey + sh[1];
        const X = px => ox + (px - a.root[0]) * K, Y = py => oy + (py - a.root[1]) * K;
        if (a.side === 'R') this.drawMic(c, X(a.hand[0]), Y(a.hand[1]), a.hand[0] - a.root[0], a.hand[1] - a.root[1]);
        c.drawImage(im, X(a.x), Y(a.y), im.width * K, im.height * K);
      }
    },
    drawMic(c, hx, hy, dx, dy) {
      const mic = img('mic'), m = META(); if (!mic || !m || !m.mic) return;
      // mic points the way the arm reaches, tipped upward so it reads as held up to sing
      let ux = dx, uy = dy; const l = Math.hypot(ux, uy) || 1; ux = ux / l * 0.6; uy = uy / l * 0.6 - 0.4;
      const l2 = Math.hypot(ux, uy) || 1; ux /= l2; uy /= l2;
      const ang = Math.atan2(ux, -uy), MS = 1.7;
      c.save(); c.translate(hx - ux * 18, hy - uy * 18); c.rotate(ang); c.scale(MS, MS);
      c.drawImage(mic, -m.mic.grip[0], -m.mic.grip[1]);
      c.restore();
    },
    gooBottomAt(ox, t) { const u = ox / 330; return 175 + 115 * Math.sqrt(Math.max(0, 1 - u * u)) + 8 * Math.sin(t * 2 + ox * 0.03); },
    gooPath(c, ex, ey, t, sq, grow) {
      // a wide lump under the eye with a lumpy hanging bottom
      const cx = ex, cy = ey + 175, rx = 330 * sq + grow, ry = 120 + grow;
      const boil = Math.floor(t * 12) % 3;                      // FNF-style line boil
      c.beginPath();
      for (let i = 0; i <= 52; i++) {
        const a = i / 52 * TAU;
        let r = 1 + 0.03 * Math.sin(3 * a + t * 2.1) + 0.025 * Math.sin(5 * a - t * 2.9) + 0.012 * (NZ[(i + boil * 53) & 255] - 0.5);
        r += Math.max(0, Math.sin(a)) * (0.08 + 0.07 * Math.sin(9 * a + t * 3.3));
        c.lineTo(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r);
      }
      c.closePath();
    },
    pattern(c) { const tex = img('goo'); if (tex && !this._pat) this._pat = c.createPattern(tex, 'repeat'); return this._pat || '#0d0b11'; },
    drawGoo(ch, c, ex, ey, purple) {
      const t = ch._t, sq = 0.8 + ch._p.sx * 0.2;
      // purple rim first (the goo shifted down-right leaves a choppy crescent up-left)
      this.gooPath(c, ex, ey, t, sq, 0); c.fillStyle = purple ? '#5b3a96' : '#4b3a86'; c.fill();
      this.gooPath(c, ex + 9, ey + 11, t, sq, -4);
      c.fillStyle = this.pattern(c); c.fill();
      c.fillStyle = purple ? 'rgba(70,30,140,0.45)' : 'rgba(10,8,16,0.35)'; c.fill();
      c.beginPath(); c.ellipse(ex - 250, ey + 235, 16, 7, -0.5, 0, TAU); c.ellipse(ex - 214, ey + 258, 7, 4, -0.5, 0, TAU);
      c.fillStyle = '#8f7cd8'; c.fill();
    },
    drawDrops(ch, c, purple) {
      for (const d of ch._drops) {
        c.beginPath();
        if (!d.fall) {
          const L = d.len, r = d.r * Math.min(1, 0.4 + L / 50);
          c.moveTo(d.x - r * 1.2, d.y);
          c.bezierCurveTo(d.x - r * 0.5, d.y + L * 0.55, d.x - r * 1.1, d.y + L - r * 0.4, d.x, d.y + L + r);
          c.bezierCurveTo(d.x + r * 1.1, d.y + L - r * 0.4, d.x + r * 0.5, d.y + L * 0.55, d.x + r * 1.2, d.y);
        } else {
          const st = Math.min(2.6, 1 + d.vy / 900), r = d.r;
          c.moveTo(d.x, d.y - r * 1.6 * st);
          c.bezierCurveTo(d.x + r * 0.5, d.y - r * 0.6, d.x + r * 1.05, d.y, d.x, d.y + r);
          c.bezierCurveTo(d.x - r * 1.05, d.y, d.x - r * 0.5, d.y - r * 0.6, d.x, d.y - r * 1.6 * st);
        }
        c.closePath();
        c.fillStyle = purple ? '#22133a' : '#0d0b11'; c.fill();
        c.beginPath(); c.arc(d.x - d.r * 0.35, (d.fall ? d.y : d.y + d.len) - d.r * 0.15, d.r * 0.3, 0, TAU); c.fillStyle = '#6f5cb8'; c.fill();
      }
    },
    drawSplats(ch, c, purple) {
      const col = purple ? '#22133a' : '#0d0b11';
      for (const s of ch._splats) {
        if (s.fly) {
          c.beginPath(); c.arc(s.x, s.y, s.r, 0, TAU); c.fillStyle = col; c.fill();
          c.beginPath(); c.arc(s.x - s.r * 0.3, s.y - s.r * 0.3, s.r * 0.3, 0, TAU); c.fillStyle = '#6f5cb8'; c.fill();
        } else {
          const k = s.t / 0.45;
          c.globalAlpha = 1 - k;
          c.beginPath(); c.ellipse(s.x, s.y, s.r * (1 + k * 0.8), s.r * 0.32 * (1 + k * 0.3), 0, 0, TAU);
          c.fillStyle = col; c.fill();
          c.globalAlpha = 1;
        }
      }
    },
    drawPuddle(ch, c, ex) {
      const t = ch._t, cx = G.lerp(REST[0], ex, 0.3), cy = GROUND - 4, rx = 320 + ch._puddle * 24, ry = 34 + ch._puddle * 4;
      const boil = Math.floor(t * 12) % 3;
      c.beginPath();
      for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU, r = 1 + 0.04 * Math.sin(4 * a + t * 1.3) + 0.03 * Math.sin(7 * a - t * 2) + 0.015 * (NZ[(i + boil * 41) & 255] - 0.5); c.lineTo(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r); }
      c.closePath(); c.fillStyle = this.pattern(c); c.fill();
      c.fillStyle = 'rgba(10,8,16,0.4)'; c.fill();
      // choppy shine on the puddle
      c.beginPath();
      for (let i = 0; i <= 10; i++) { const a = Math.PI * (1.08 + 0.7 * i / 10); c.lineTo(cx - rx * 0.15 + Math.cos(a) * rx * 0.6, cy - ry * 0.1 + Math.sin(a) * ry * 0.45 + (i % 3 === 1 ? 3 : 0)); }
      for (let i = 10; i >= 0; i--) { const a = Math.PI * (1.08 + 0.7 * i / 10); c.lineTo(cx - rx * 0.15 + Math.cos(a) * rx * 0.55, cy - ry * 0.1 + Math.sin(a) * ry * 0.3); }
      c.closePath(); c.fillStyle = '#4b3a86'; c.fill();
    },
  };

  // ---------------------------------------------------------------- character data + health icon
  const DATA = { version: '1.0.0', name: 'WRATH', renderType: 'own', fx: 'wrathEye', scale: 1, singTime: 6, danceEvery: 1, offsets: [-160, 0], cameraOffsets: [60, -140], healthIcon: { id: 'wrath-eye' }, animations: [] };
  if (G.A && G.A._json) G.A._json.set('preload/data/characters/wrath-eye.json', DATA);
  // the icon is made once the art has loaded (2 frames: fine, losing)
  function makeIcon() {
    const cv = G.makeCanvas(300, 150), c = cv.getContext('2d');
    const buf = G.makeCanvas(Math.ceil(BOX.w * SS), Math.ceil(BOX.h * SS)), bc = buf.getContext('2d');
    [[{ look: 'void', px: 40, py: 8, ps: 1, spin: 0, lid: 0.85, anger: 0.8, purple: 0 }, 0], [{ look: 'veins', px: -20, py: 14, ps: 0.7, spin: 0, lid: 0.5, anger: 0.2, purple: 0 }, -8]].forEach(([st, rot], i) => {
      composeEye(bc, st);
      c.save(); c.translate(75 + i * 150, 78); c.rotate(rot * Math.PI / 180); c.scale(0.2 / SS, 0.2 / SS);
      c.drawImage(buf, BOX.x * SS, BOX.y * SS); c.restore();
    });
    return cv;
  }
  if (G.assetsReady && G.A && G.A._img) G.assetsReady.then(() => { try { if (img('back-void')) G.A._img.set('preload/images/icons/icon-wrath-eye.png', makeIcon()); } catch (e) { G.reportError && G.reportError(e, 'wrath eye icon'); } });
})();
