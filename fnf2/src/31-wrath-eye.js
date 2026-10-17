// FNF 2 - WRATH stage 2: the GIANT EYE, made from the user's own 5 eye pictures
// (tools/own/wrath_eye.py turns them into FNF-style pieces: back-<look> = spikes + eyeball,
// iris-<look> = the iris on its own, mask-* = the eyeball area the iris may move in).
// Here they are put together live, so the eye can look around, squash/stretch on notes,
// flash purple on misses and glitch when it switches looks.
// Each arrow has its own look (the user's pictures):
//   idle = black eye w/ glowing red ring, LEFT = white spiral, DOWN = grey red ring,
//   UP = blue rings, RIGHT = red veiny.
// Long notes shake the camera.
(function () {
  const DIR = 'shared/images/characters/wrath-eye/';
  const img = n => G.A.image(DIR + n + '.png');
  const META = () => G.A.json(DIR + 'meta.json');
  const GLOW = { void: '#ff2a44', spiral: '#cfc6ff', redring: '#ff3434', blue: '#566dff', veins: '#ff1414' };
  const BY_DIR = ['spiral', 'redring', 'blue', 'veins'];

  // ---------------------------------------------------------------- composing the eye
  const bufs = {};
  function buffer(key, w, h) {
    let b = bufs[key];
    if (!b || b.canvas.width !== w || b.canvas.height !== h) { const cv = G.makeCanvas(w, h); b = bufs[key] = cv.getContext('2d'); }
    return b;
  }
  // st = { look, px, py (-1..1 look direction), ps (iris scale), purple }
  function composeEye(st, key) {
    const m = META(), L = m && m.looks[st.look]; if (!L) return null;
    const back = img(L.back), iris = img(L.iris), mask = img(L.mask);
    if (!back || !iris || !mask) return null;
    const [w, h] = L.size;
    const c = buffer(key + ':eye', w, h), ic = buffer(key + ':iris', w, h);
    // the iris, clipped to the eyeball
    ic.globalCompositeOperation = 'source-over';
    ic.clearRect(0, 0, w, h);
    const ix = L.irisAt[0] + st.px * L.almondW * 0.17, iy = L.irisAt[1] + st.py * L.almondW * 0.06;
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
    return { cv: c.canvas, L };
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
    D: { dx: 0, dy: 55, rot: 0, sx: 1.15, sy: 0.83, px: 0, py: 1, ps: 0.88 },
    U: { dx: 0, dy: -65, rot: 0, sx: 0.9, sy: 1.15, px: 0, py: -1, ps: 0.88 },
    R: { dx: 72, dy: -6, rot: 8, sx: 1.06, sy: 0.95, px: 1, py: 0, ps: 0.88 },
  };
  const KEYS = Object.keys(POSE.idle);
  const FRAME = { w: 1000, h: 1000 }, REST = [500, 470];
  const SIZE = 1.25;                                       // a bit bigger than the pictures' natural size

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
      ch._look = 'void'; ch._glitch = 0; ch._purple = 0; ch._shake = 0; ch._bop = 0; ch._glowP = 0;
      ch._t = Math.random() * 10;
      const play = ch.play.bind(ch);
      ch.play = (n, f, r) => { const ok = play(n, f, r); if (ok) FX.onAnim(ch, n); return ok; };
    },
    setLook(ch, look) { if (ch._look !== look) { ch._look = look; ch._glitch = 0.09; } },
    onAnim(ch, name) {
      const m = /^sing(LEFT|DOWN|UP|RIGHT)(miss)?/.exec(name);
      if (m) {
        const d = ['LEFT', 'DOWN', 'UP', 'RIGHT'].indexOf(m[1]);
        ch._tgt = POSE['LDUR'[d]]; ch._miss = !!m[2]; ch._hit = 1; ch._glowP = 1;
        this.setLook(ch, BY_DIR[d]);
        for (const k of KEYS) ch._p[k] = G.lerp(ch._p[k], ch._tgt[k], 0.7);   // FNF poses hit on the first frame
        if (ch._miss) { ch._purple = 1; ch._shake = 0.35; } else ch._purple = 0;
      } else {
        ch._tgt = POSE.idle; ch._miss = false;
        if (name === 'idle') { ch._bop = 1; this.setLook(ch, 'void'); }
      }
    },
    // long notes hit harder: camera shake
    onSing(ch, dir, miss) {
      const n = ch.lastNote; ch.lastNote = null;
      if (miss || !n || !(n.len > 240)) return;
      ch._shake = Math.max(ch._shake, 0.2);
      const ps = G.screens && G.screens.play;
      if (ps && ps.cam && ps.dad === ch && G.settings.flashing !== false) ps.cam.shake(0.007, 0.2);
    },
    eyePos(ch) {
      const p = ch._p, t = ch._t;
      return [REST[0] + p.dx + Math.sin(t * 0.9) * 8, REST[1] + p.dy + Math.sin(t * 1.7) * 16 + ch._bop * 10];
    },
    update(ch, dt) {
      ch._t += dt;
      const p = ch._p, tg = ch._tgt;
      ch._hit = Math.max(0, ch._hit - dt * 9);
      const rate = tg === POSE.idle ? 7 : 26;
      for (const k of KEYS) { const goal = tg === POSE.idle ? tg[k] : tg[k] + (tg[k] - POSE.idle[k]) * 0.12 * ch._hit; p[k] = G.damp(p[k], goal, rate, dt); }
      ch._glitch = Math.max(0, ch._glitch - dt);
      ch._purple = ch._miss ? Math.max(0.6, ch._purple - dt) : Math.max(0, ch._purple - dt * 5);
      ch._shake = Math.max(0, ch._shake - dt);
      ch._bop = Math.max(0, ch._bop - dt * 5);
      ch._glowP = Math.max(0, ch._glowP - dt * 3);
    },
    draw(ch, c) {
      const p = ch._p, e = this.eyePos(ch), t = ch._t;
      let ex = e[0], ey = e[1];
      if (ch._shake > 0) { ex += (Math.random() - 0.5) * 22 * ch._shake / 0.35; ey += (Math.random() - 0.5) * 14 * ch._shake / 0.35; }
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.3 + 0.25 * ch._glowP;
      c.drawImage(glowArt(GLOW[ch._look]), ex - 560, ey - 440, 1120, 880);
      c.restore();
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
    },
  };

  // ---------------------------------------------------------------- character data + health icon
  const DATA = { version: '1.0.0', name: 'WRATH', renderType: 'own', fx: 'wrathEye', scale: 1, singTime: 6, danceEvery: 1, offsets: [-80, 0], cameraOffsets: [80, -110], healthIcon: { id: 'wrath-eye' }, animations: [] };
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
