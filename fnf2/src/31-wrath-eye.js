// FNF 2 - WRATH stage 2: the GIANT EYE, made from the user's own 5 eye pictures
// (tools/own/wrath_eye.py turns them into FNF-style pieces: back-<look> = spikes + eyeball,
// iris-<look> = the iris on its own, mask-* = the eyeball area the iris may move in).
// Here they are put together live, so the eye can look around, squash/stretch on notes,
// flash purple on misses and glitch when it switches looks.
// Each arrow has its own look (the user's pictures):
//   idle = black eye w/ glowing red ring, LEFT = white spiral, DOWN = grey red ring,
//   UP = blue rings, RIGHT = red veiny.
// Goo drips off the bottom spikes (drops = the red picture's beads repainted), splats on the
// road into a goo pool (FNF's street puddle shape) - long notes shake the camera + burst goo
// (Weekend 1's spray paint splash, repainted).
(function () {
  const DIR = 'shared/images/characters/wrath-eye/';
  const img = n => G.A.image(DIR + n + '.png');
  const META = () => G.A.json(DIR + 'meta.json');
  const GLOW = { void: '#ff2a44', spiral: '#cfc6ff', redring: '#ff3434', blue: '#566dff', veins: '#ff1414' };
  const BY_DIR = ['spiral', 'redring', 'blue', 'veins'];
  const GOO = false;                                       // goo drips/pool/splash: saved for later (user, 2026-10-17)

  // ---------------------------------------------------------------- composing the eye
  const bufs = {};
  function buffer(key, w, h) {
    let b = bufs[key];
    if (!b || b.canvas.width !== w || b.canvas.height !== h) { const cv = G.makeCanvas(w, h); b = bufs[key] = cv.getContext('2d'); }
    return b;
  }
  // st = { look, px, py (-1..1 look direction), ps (iris scale), purple }
  // the composed eye only changes when the look / iris / purple change: reuse the last one (no rebuild every frame)
  const lastKey = {};
  function composeEye(st, key) {
    const m = META(), L = m && m.looks[st.look]; if (!L) return null;
    const sig = st.look + '|' + st.px.toFixed(2) + '|' + st.py.toFixed(2) + '|' + st.ps.toFixed(2) + '|' + (st.purple > 0 ? st.purple.toFixed(2) : 0);
    if (lastKey[key] && lastKey[key].sig === sig) return lastKey[key].E;
    const back = img(L.back), iris = img(L.iris), mask = img(L.mask);
    if (!back || !iris || !mask) return null;
    const [w, h] = L.size;
    const c = buffer(key + ':eye', w, h), ic = buffer(key + ':iris', w, h);
    // the iris, clipped to the eyeball
    ic.globalCompositeOperation = 'source-over';
    ic.clearRect(0, 0, w, h);
    const ix = L.irisAt[0] + st.px * L.almondW * 0.085, iy = L.irisAt[1] + st.py * L.almondW * 0.035;
    const iw = iris.width * st.ps, ih = iris.height * st.ps;
    ic.drawImage(iris, ix - iw / 2, iy - ih / 2, iw, ih);
    ic.globalCompositeOperation = 'destination-in';
    ic.drawImage(mask, 0, 0);
    ic.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, w, h);
    c.drawImage(back, 0, 0);
    c.drawImage(ic.canvas, 0, 0);
    if (st.purple > 0) {
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = 'rgba(58,22,118,' + (0.62 * st.purple).toFixed(3) + ')'; c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'source-over';
    }
    const E = { cv: c.canvas, L };
    lastKey[key] = { sig, E };
    return E;
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
  // eye offset / tilt / squash + where the iris looks
  const POSE = {
    idle: { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1, px: 0.45, py: 0.2, ps: 1 },
    L: { dx: -70, dy: -10, rot: -9, sx: 1.06, sy: 0.95, px: -1, py: 0, ps: 0.88 },
    D: { dx: 6, dy: 85, rot: 3, sx: 1.04, sy: 0.95, px: 0.15, py: 1, ps: 0.88 },
    U: { dx: -6, dy: -95, rot: -3, sx: 0.97, sy: 1.04, px: 0.15, py: -1, ps: 0.88 },
    R: { dx: 72, dy: -6, rot: 8, sx: 1.06, sy: 0.95, px: 1, py: 0, ps: 0.88 },
    stare: { dx: 0, dy: -20, rot: 0, sx: 1.12, sy: 1.12, px: 0, py: 0, ps: 1.45 },     // you hit one of his eye notes
  };
  const KEYS = Object.keys(POSE.idle);
  const FRAME = { w: 1000, h: 1000 }, REST = [500, 470];
  const SIZE = 1.0;                                       // a bit bigger than the pictures' natural size

  // ---------------------------------------------------------------- the character fx
  G.OwnFX = G.OwnFX || {};
  const FX = G.OwnFX.wrathEye = {
    init(ch) {
      ch.frameW = FRAME.w; ch.frameH = FRAME.h; ch.resetSize();
      const own = (n, frames) => { ch.anims[n] = { kind: 'own', n: frames, fps: 24, loop: false }; ch.animOffsets[n] = [0, 0]; };
      own('idle', 12);
      for (const d of ['LEFT', 'DOWN', 'UP', 'RIGHT']) { own('sing' + d, 8); own('sing' + d + 'miss', 10); }
      ch._key = 'e' + Math.random();
      ch._p = Object.assign({}, POSE.idle); ch._tgt = POSE.idle; ch._hit = 0;
      ch._look = 'void'; ch._stare = 0; ch._glitch = 0; ch._purple = 0; ch._shake = 0; ch._bop = 0; ch._glowP = 0;
      ch._t = Math.random() * 10;
      ch._drops = []; ch._splats = []; ch._dropT = 0.5; ch._puddle = 0; ch._burst = -1;
      const play = ch.play.bind(ch);
      ch.play = (n, f, r) => { const ok = play(n, f, r); if (ok) FX.onAnim(ch, n); return ok; };
      // build every look once now, so the first time each one shows up mid-song there's no hitch
      try {
        const m = META(), tiny = G.makeCanvas(2, 2).getContext('2d');
        if (m) for (const look in m.looks) {
          const E = composeEye({ look, px: 0, py: 0, ps: 1, purple: 0 }, 'warm');
          if (E) tiny.drawImage(E.cv, 0, 0, 2, 2);
          tiny.drawImage(glowArt(GLOW[look] || GLOW.void), 0, 0, 2, 2);
        }
      } catch (e) {}
    },
    setLook(ch, look) { if (ch._look !== look) { ch._look = look; ch._glitch = 0.09; } },
    // he stares right at you (GLARE's eye notes): looks straight out, iris wide, a bit closer
    stare(ch, dur) { ch._stare = dur; ch._look = 'redring'; ch._glitch = 0.12; ch._shake = Math.max(ch._shake, 0.25); },
    onAnim(ch, name) {
      const m = /^sing(LEFT|DOWN|UP|RIGHT)(miss)?/.exec(name);
      if (m) {
        const d = ['LEFT', 'DOWN', 'UP', 'RIGHT'].indexOf(m[1]);
        ch._tgt = POSE['LDUR'[d]]; ch._miss = !!m[2]; ch._hit = 1; ch._glowP = 1;
        if (!(ch._stare > 0)) this.setLook(ch, BY_DIR[d]);
        for (const k of KEYS) ch._p[k] = G.lerp(ch._p[k], ch._tgt[k], 0.7);   // FNF poses hit on the first frame
        if (ch._miss) { ch._purple = 1; ch._shake = 0.35; } else ch._purple = 0;
        if (GOO && d === 1 && !ch._miss) this.release(ch, 2);
      } else {
        ch._tgt = POSE.idle; ch._miss = false;
        if (name === 'idle') { ch._bop = 1; if (!(ch._stare > 0)) this.setLook(ch, 'void'); }
      }
    },
    // long notes hit harder: camera shake
    onSing(ch, dir, miss) {
      const n = ch.lastNote; ch.lastNote = null;
      if (miss || !n || !(n.len > 240)) return;
      ch._shake = Math.max(ch._shake, 0.2);
      if (GOO) { ch._burst = 0; this.release(ch, 3); }
      const ps = G.screens && G.screens.play;
      if (ps && ps.cam && ps.dad === ch && G.settings.flashing !== false) ps.cam.shake(0.007, 0.2);
    },
    eyePos(ch) {
      const p = ch._p, t = ch._t;
      return [REST[0] + p.dx + Math.sin(t * 0.9) * 8, REST[1] + p.dy + Math.sin(t * 1.7) * 16 + ch._bop * 10];
    },
    update(ch, dt) {
      ch._t += dt;
      const p = ch._p, tg = ch._stare > 0 ? POSE.stare : ch._tgt;
      ch._stare = Math.max(0, ch._stare - dt);
      ch._hit = Math.max(0, ch._hit - dt * 9);
      const rate = tg === POSE.idle ? 7 : 26;
      for (const k of KEYS) { const goal = tg === POSE.idle ? tg[k] : tg[k] + (tg[k] - POSE.idle[k]) * 0.12 * ch._hit; p[k] = G.damp(p[k], goal, rate, dt); }
      ch._glitch = Math.max(0, ch._glitch - dt);
      ch._purple = ch._miss ? Math.max(0.6, ch._purple - dt) : Math.max(0, ch._purple - dt * 5);
      ch._shake = Math.max(0, ch._shake - dt);
      ch._bop = Math.max(0, ch._bop - dt * 5);
      ch._glowP = Math.max(0, ch._glowP - dt * 3);
      ch._puddle = Math.max(0, ch._puddle - dt * 2.5);
      if (ch._burst >= 0) { ch._burst += dt; if (ch._burst > 8 / 24) ch._burst = -1; }
      // drips: grow on a spike tip, let go, fall, splat on the road
      ch._dropT -= dt;
      if (GOO && ch._dropT <= 0 && ch._drops.length < 5) { ch._dropT = 0.4 + Math.random() * 0.8; ch._drops.push({ i: Math.floor(Math.random() * 6), g: 0, rate: 0.9 + Math.random() * 0.8, fall: false, x: 0, y: 0, vy: 0, s: 0.8 + Math.random() * 0.45 }); }
      for (const d of ch._drops) {
        if (!d.fall) {
          d.g += dt * d.rate;
          const a = this.tip(ch, d.i); if (a) { d.x = a[0]; d.y = a[1]; }
          if (d.g >= 1) { d.fall = true; d.vy = 80; d.y += 30 * d.s; }
        } else {
          d.vy += 2300 * dt; d.y += d.vy * dt;
          if (d.y >= FRAME.h - 14) { d.dead = true; ch._puddle = Math.max(ch._puddle, 0.4); ch._splats.push({ x: d.x, y: FRAME.h - 30, t: 0 }); }
        }
      }
      ch._drops = ch._drops.filter(d => !d.dead);
      for (const sp of ch._splats) sp.t += dt;
      ch._splats = ch._splats.filter(sp => sp.t < 8 / 24);
    },
    // drop some goo right now (DOWN notes, long notes)
    release(ch, n) {
      for (let k = 0; k < n; k++) { const a = this.tip(ch, Math.floor(Math.random() * 6)); if (a) ch._drops.push({ i: 0, g: 1, rate: 1, fall: true, x: a[0] + (Math.random() - 0.5) * 30, y: a[1] + 20, vy: 300 + Math.random() * 300, s: 0.9 + Math.random() * 0.5 }); }
    },
    // a bottom spike tip of the current look, in frame space (follows the eye's pose)
    tip(ch, i) {
      const m = META(), L = m && m.looks[ch._look]; if (!L || !L.drips || !L.drips.length) return null;
      const pt = L.drips[i % L.drips.length], p = ch._p, e = this.eyePos(ch);
      const k = SIZE * L.scale, x = (pt[0] - L.center[0]) * k * p.sx, y = (pt[1] - L.center[1]) * k * p.sy;
      const r = p.rot * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
      return [e[0] + x * cs - y * sn, e[1] + x * sn + y * cs];
    },
    draw(ch, c) {
      const p = ch._p, e = this.eyePos(ch), t = ch._t;
      let ex = e[0], ey = e[1];
      if (ch._shake > 0) { ex += (Math.random() - 0.5) * 22 * ch._shake / 0.35; ey += (Math.random() - 0.5) * 14 * ch._shake / 0.35; }
      c.save();
      c.globalAlpha = 0.24 + 0.2 * ch._glowP;                  // plain alpha: an additive glow this big lags slow PCs
      c.drawImage(glowArt(GLOW[ch._look]), ex - 560, ey - 440, 1120, 880);
      c.restore();
      if (GOO) this.drawPuddle(ch, c, ex);
      const E = composeEye({ look: ch._look, px: p.px, py: p.py, ps: p.ps * (ch._purple > 0.3 ? 0.82 : 1), purple: ch._purple }, ch._key);
      if (!E) return;
      const { cv, L } = E, cx = L.center[0], cy = L.center[1];
      c.save();
      c.translate(ex, ey); c.rotate(p.rot * Math.PI / 180);
      const bop = 1 - ch._bop * 0.035;
      c.scale(SIZE * L.scale * p.sx * (2 - bop), SIZE * L.scale * p.sy * bop);
      if (ch._glitch > 0) {
        const rnd = G.rng((t * 60) | 0), H = cv.height, sl = 7;
        for (let i = 0; i < sl; i++) {
          const y0 = Math.floor(H * i / sl), h = Math.ceil(H / sl), off = (rnd() - 0.5) * 90;
          c.drawImage(cv, 0, y0, cv.width, h, -cx + off, -cy + y0, cv.width, h);
        }
      } else c.drawImage(cv, -cx, -cy);
      c.restore();
      if (GOO) this.drawGoo(ch, c, ex, ey);
    },
    drawPuddle(ch, c, ex) {
      const pu = img('goo-puddle'); if (!pu) return;
      const w = 640 * (1 + ch._puddle * 0.05), h = w * pu.height / pu.width;
      c.drawImage(pu, G.lerp(REST[0], ex, 0.3) - w / 2, FRAME.h - h * 0.62, w, h);
    },
    drawGoo(ch, c, ex, ey) {
      const drop = img('goo-drop'), m = META();
      if (drop) for (const d of ch._drops) {
        const W = 38 * d.s;
        if (!d.fall) { const g = Math.min(1, d.g), w = W * (0.45 + 0.55 * g), h = w * (1 + 0.9 * g); c.drawImage(drop, d.x - w / 2, d.y - 8, w, h); }
        else { const st = Math.min(1.8, 1 + d.vy / 1600); c.drawImage(drop, d.x - W / 2 / st, d.y - W * st / 2, W / st, W * st); }
      }
      const n = (m && m.splash) || 0;
      const frame = (t, s, x, y) => { const f = img('goo-splash-' + Math.min(n - 1, Math.floor(t * 12))); if (f) c.drawImage(f, x - f.width * s / 2, y - f.height * s / 2, f.width * s, f.height * s); };
      for (const sp of ch._splats) frame(sp.t, 0.32, sp.x, sp.y);
      if (ch._burst >= 0) frame(ch._burst, 1.1, ex + 20, ey + 120);
    },
  };

  // ---------------------------------------------------------------- character data + health icon
  const DATA = { version: '1.0.0', name: 'WRATH', renderType: 'own', fx: 'wrathEye', scale: 1, singTime: 6, danceEvery: 1, offsets: [-40, 0], cameraOffsets: [-200, 150], healthIcon: { id: 'wrath-eye' }, animations: [] };
  if (G.A && G.A._json) G.A._json.set('preload/data/characters/wrath-eye.json', DATA);
  // health icon (fine / losing), made from the eye once the art has loaded
  function makeIcon() {
    const cv = G.makeCanvas(300, 150), c = cv.getContext('2d');
    [[{ look: 'void', px: 0.5, py: 0.1, ps: 1, purple: 0 }, 0], [{ look: 'veins', px: -0.4, py: 0.3, ps: 0.75, purple: 0 }, -8]].forEach(([st, rot], i) => {
      const E = composeEye(st, 'icon'); if (!E) return;
      const s = 140 / Math.max(E.cv.width, E.cv.height);
      c.save(); c.translate(75 + i * 150, 75); c.rotate(rot * Math.PI / 180); c.scale(s, s);
      c.drawImage(E.cv, -E.L.center[0], -E.L.center[1]); c.restore();
    });
    return cv;
  }
  if (G.assetsReady && G.A && G.A._img) G.assetsReady.then(() => { try { if (META()) G.A._img.set('preload/images/icons/icon-wrath-eye.png', makeIcon()); } catch (e) { G.reportError && G.reportError(e, 'wrath eye icon'); } });
})();
