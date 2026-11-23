// The 20 things you can do to your mouse.
'use strict';
const Effects = (() => {
  const E = {};
  const R = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
  const ci = () => Render.cursorInfo(MH.M.shape) || { w: 32, h: 32, hx: 1, hy: 1 };
  const cx = c => c.M.virt.x, cy = c => c.M.virt.y;
  const play = (n, o) => Sfx.play(n, o);
  let fluidProg = null;
  E._drawFluid = () => {
    if (!fluidProg) fluidProg = GLX.program(`in vec2 vUV; out vec4 o; uniform sampler2D uDye;
      void main(){ vec4 d=texture(uDye,vUV); float T=d.r, S=d.g; if(T<0.004&&S<0.004){ o=vec4(0); return; }
                vec2 px=vUV*uRes; float fl=0.65+0.7*fbm(px*vec2(0.045,0.03)+vec2(0.,uTime*4.));
        float Tf=T*mix(1.,fl,smoothstep(0.05,0.6,T));
        vec3 em=blackbody(Tf*0.8)*pow(clamp(Tf,0.,2.5),1.7)*2.4*smoothstep(0.1,0.85,Tf);
        float sa=1.-exp(-S*2.4);
        vec3 sc=mix(vec3(0.12,0.115,0.11),vec3(0.03,0.028,0.026),clamp(S*0.5,0.,1.))+blackbody(0.5)*T*0.5;
        float ea=clamp(dot(em,vec3(0.3,0.5,0.2))*0.75,0.,1.);
        o=vec4(sc*sa*(1.-ea)+em, clamp(sa+ea-sa*ea,0.,1.)); }`);
    GLX.pass(fluidProg, { uDye: Fluid.dye }, Render.scene, 'pm');
  };
  // shared liquid sounds
  let lastDrip = 0, lastSplash = 0, lastLand = 0;
  Liquid.hooks.drip = (x) => { const t = performance.now(); if (t - lastDrip > 140) { lastDrip = t; play('water_drip', { vol: 0.35, vary: 0.4, pan: MH.ctx.pan(x) }); } };
  Liquid.hooks.splash = (x, y, imp, k) => { const t = performance.now(); if (t - lastSplash > 220) { lastSplash = t;
    if (k === Liquid.K.LAVA) play('sizzle', { vol: 0.5, vary: 0.3, pan: MH.ctx.pan(x) });
    else if (k === Liquid.K.HONEY) play('squelch', { vol: 0.4, vary: 0.3, pan: MH.ctx.pan(x) });
    else play('water_drip', { vol: Math.min(0.6, imp / 2500), vary: 0.5, pan: MH.ctx.pan(x) }); } };
  Liquid.hooks.land = (x, y, imp, k, heat) => {
    if (k === Liquid.K.LAVA && heat > 0.3) { if (Math.random() < 0.5) Parts.spawn(Parts.T.SMOKE, x, y - 4, R(-20, 20), R(-80, -40), R(1, 2), R(14, 26), [0.55, 0.55, 0.56, 0.35]);
      const t = performance.now(); if (t - lastLand > 300) { lastLand = t; play('sizzle', { vol: 0.35, vary: 0.4, pan: MH.ctx.pan(x) }); } }
  };
  function cursorCenter(c) { const i = ci(); return { x: cx(c) + i.w / 2 - i.hx, y: cy(c) + i.h / 2 - i.hy, w: i.w, h: i.h }; }

  // 1 ─ FORCE FIELD: stuck in a glowing energy box in the middle of the screen
  E.forcefield = {
    name: 'Force Field', outro: 0.7,
    start(e, c) { const S = Math.round(Math.min(c.W, c.H) * 0.2); e.s.box = [c.W / 2 - S / 2, c.H / 2 - S / 2, S, S]; e.s.hits = []; e.s.from = { x: cx(c), y: cy(c) }; e.s.cool = 0;
      e.s.hum = Sfx.loop('field_hum', { vol: 0.55 }); play('field_hit', { vol: 0.8 }); play('whoosh', { vol: 0.6, rate: 0.8 });
      for (let i = 0; i < 40; i++) { const k = i / 40; Parts.spawn(Parts.T.GLINT, e.s.from.x + (c.W / 2 - e.s.from.x) * k, e.s.from.y + (c.H / 2 - e.s.from.y) * k, R(-30, 30), R(-30, 30), R(0.2, 0.5), R(6, 12), [0.5, 0.8, 1.6, 1]); } },
    mouse(e, m) { const b = e.s.box, c = MH.ctx;
      if (e.t < 0.22) { const k = ease(e.t / 0.22); m.pin = { x: e.s.from.x + (c.W / 2 - e.s.from.x) * k, y: e.s.from.y + (c.H / 2 - e.s.from.y) * k }; return; }
      const ins = 12; m.clip = { x: b[0] + ins, y: b[1] + ins, w: b[2] - ins * 2, h: b[3] - ins * 2 }; m.margin = 60; },
    update(e, c, dt) { const s = e.s; s.cool -= dt;
      const p = c.M.push, mag = Math.hypot(p.x, p.y);
      if (!e.ending && mag > 1.5 && s.cool <= 0) { s.cool = 0.09; const str = clamp(mag / 25, 0.25, 1);
        s.hits.unshift({ x: cx(c) + p.x / mag * 10, y: cy(c) + p.y / mag * 10, age: 0, w: str }); s.hits.length = Math.min(s.hits.length, 8);
        play('field_hit', { vol: 0.25 + str * 0.5, vary: 0.4, pan: c.pan(cx(c)) });
        for (let i = 0; i < 14 * str; i++) Parts.spawn(Parts.T.SPARK, cx(c) + p.x / mag * 10, cy(c) + p.y / mag * 10, -p.x / mag * R(100, 500) + R(-200, 200), -p.y / mag * R(100, 500) + R(-250, 100), R(0.25, 0.6), R(1.5, 3), [0.6, 0.85, 1.6, 1], { heat: 0.9 }); }
      s.hits.forEach(h => h.age += dt);
      s.power = e.ending ? Math.max(0, 1 - e.te / 0.5) * (Math.random() < 0.3 ? 0.4 : 1) : ease(e.t / 0.3) * (e.t < 0.3 && Math.random() < 0.4 ? 0.3 : 1);
      s.collapse = e.ending ? ease(e.te / 0.55) : 0;
      if (!e.ending) c.timer(true, s.box[0] + s.box[2] / 2, s.box[1] + s.box[3] + 24, e.dur - e.t);
    },
    end(e, c) { e.s.hum.stop(0.4); play('field_hit', { vol: 0.9, rate: 0.6 }); c.timer(false); const b = e.s.box;
      for (let i = 0; i < 160; i++) { const side = i % 4, k = Math.random(); const x = side < 2 ? b[0] + b[2] * k : (side === 2 ? b[0] : b[0] + b[2]); const y = side < 2 ? (side ? b[1] : b[1] + b[3]) : b[1] + b[3] * k;
        Parts.spawn(Parts.T.GLINT, x, y, R(-80, 80), R(-80, 80), R(0.3, 0.8), R(5, 10), [0.5, 0.8, 1.6, 1]); } },
    front(e) { const s = e.s; const hits = new Float32Array(32); s.hits.forEach((h, i) => { hits.set([h.x, h.y, h.age, h.w], i * 4); });
      Shapes.field({ box: s.box, depth: s.box[2] * 0.16, power: s.power || 0, collapse: s.collapse || 0, hits, hot: s.hits.length && s.hits[0].age < 0.15 ? 1 : 0 }); },
  };

  // 2 ─ DEEP FREEZE: frozen solid in a block of ice, then it shatters
  E.freeze = {
    name: 'Deep Freeze', outro: 2.8,
    start(e, c) { const i = ci(); const s = e.s; s.pos = { x: cx(c), y: cy(c) }; s.seed = R(0, 50); s.crack = 0; s.cracked = 0;
      s.box = [s.pos.x + i.w * 0.3, s.pos.y + i.h * 0.38, Math.max(170, i.w * 5), Math.max(150, i.h * 4.2)];
      play('ice_freeze', { vol: 0.9 });
      for (let k = 0; k < 50; k++) Parts.spawn(Parts.T.MIST, s.box[0] + R(-60, 60), s.box[1] + R(-50, 50), R(-60, 60), R(-40, 40), R(0.8, 1.6), R(20, 40), [0.85, 0.92, 1, 0.25]); },
    mouse(e, m) { m.clip = { x: e.s.pos.x, y: e.s.pos.y, w: 0, h: 0 }; m.margin = 40; },
    update(e, c, dt) { const s = e.s;
      s.grow = ease(e.t / 0.45);
      const p = c.M.push; const mag = Math.hypot(p.x, p.y);
      if (!e.ending) { s.crack = Math.min(0.85, s.crack + mag * dt * 0.012);
        const lvl = Math.floor(s.crack * 6); if (lvl > s.cracked) { s.cracked = lvl; play('ice_crack', { vol: 0.5, vary: 0.3 }); for (let k = 0; k < 12; k++) Parts.spawn(Parts.T.GLINT, s.box[0] + R(-40, 40), s.box[1] + R(-40, 40), R(-60, 60), R(-120, 20), R(0.3, 0.7), R(4, 9), [0.9, 0.95, 1.2, 1]); }
        if (Math.random() < dt * 6) Parts.spawn(Parts.T.MIST, s.box[0] + R(-s.box[2] / 2, s.box[2] / 2), s.box[1] + s.box[3] / 2, R(-10, 10), R(10, 30), R(1.2, 2), R(16, 30), [0.88, 0.94, 1, 0.18]);
        c.timer(true, s.box[0], s.box[1] + s.box[3] / 2 + 26, e.dur - e.t); }
      s.frost = e.ending ? Math.max(0, 1 - e.te / 1.5) * 0.85 : Math.min(0.85, e.t / 1.2);
      if (s.shards) s.shards.forEach(h => { h.vy += 1600 * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.vr * dt;
        if (h.y > c.floor - h.size * 0.3 && h.vy > 0) { h.y = c.floor - h.size * 0.3; h.vy *= -0.3; h.vx *= 0.6; h.vr *= 0.5; if (!h.landed) { h.landed = 1; if (Math.random() < 0.3) play('glass_crack', { vol: 0.15, vary: 0.5, rate: 1.6 }); } }
        h.a = clamp((2.6 - e.te) / 0.8, 0, 1);
        if (e.te > 1.4 && !h.melted) { h.melted = 1; for (let k = 0; k < 3; k++) Liquid.add(h.x + R(-6, 6), h.y - 4, R(-20, 20), 0, R(3, 5), Liquid.K.WATER); } });
    },
    end(e, c) { const s = e.s; c.timer(false); play('ice_shatter', { vol: 1 }); s.shards = [];
      for (let k = 0; k < 22; k++) { const a = R(0, Math.PI * 2), d = R(0, 0.45); const x = s.box[0] + Math.cos(a) * s.box[2] * d, y = s.box[1] + Math.sin(a) * s.box[3] * d;
        s.shards.push({ x, y, vx: Math.cos(a) * R(120, 520), vy: Math.sin(a) * R(120, 400) - R(250, 650), rot: R(0, 6), vr: R(-12, 12), size: R(14, 40), seed: R(0, 99), a: 1 }); }
      for (let k = 0; k < 60; k++) Parts.spawn(Parts.T.GLINT, s.box[0] + R(-50, 50), s.box[1] + R(-50, 50), R(-500, 500), R(-700, 100), R(0.4, 1), R(4, 10), [0.9, 0.95, 1.2, 1]); },
    cursor(e, look, lk) { lk.frost = Math.max(lk.frost || 0, e.ending ? Math.max(0, 1 - e.te / 0.6) : ease(e.t / 0.4)); },
    back(e) { if (!e.ending) Shapes.ice({ box: e.s.box, grow: e.s.grow, crack: e.s.crack, layer: 0, seed: e.s.seed }); },
    front(e) { const s = e.s; if (!e.ending) Shapes.ice({ box: s.box, grow: s.grow, crack: s.crack, layer: 1, seed: s.seed }); else if (s.shards) Shapes.shards(s.shards);
      Shapes.frost(s.frost, s.seed); },
  };

  // 3 ─ ON FIRE: the cursor burns for real (fluid fire), embers, smoke, heat shimmer, turns black
  E.fire = {
    name: 'On Fire', fluid: true, outro: 2.6,
    start(e, c) { play('fire_ignite', { vol: 0.9 }); e.s.loop = Sfx.loop('fire_loop', { vol: 1, fade: 0.6 }); e.s.char = 0; },
    update(e, c, dt) { const s = e.s;
      const k = e.ending ? Math.max(0, 1 - e.te / 0.7) : ease(e.t / 0.35); s.k = k;
      s.char = e.ending ? Math.max(0, s.char - dt * 0.8) : Math.min(1, e.t / 3.5);
      if (k > 0.01) {
        const i = ci(), cc = cursorCenter(c); const pad = 0.3; const info = Render.cursorInfo(MH.M.shape);
        if (info) Fluid.emitShape(Render.cursorTex, info.rect, pad, cc.x, cc.y, i.w / (1 - 2 * pad) * 1.05, i.h / (1 - 2 * pad) * 1.05, 0, [0.5 * k, 0.0, 0.6 * k]);
        const v = c.M.vel; if (Math.hypot(v.x, v.y) > 40) Fluid.splat(cc.x, cc.y, 22, null, [v.x * 0.5, v.y * 0.5]);
        Fluid.splat(cc.x + R(-4, 4), cc.y + 2, 10, [0.25 * k, 0, 0.45 * k, 0], [R(-80, 80), -R(80, 200)], { noise: 0.7 });
        const n = (c.quality ? 40 : 20) * dt * k; for (let j = 0; j < n + (Math.random() < n % 1 ? 1 : 0); j++)
          Parts.spawn(Parts.T.EMBER, cc.x + R(-i.w * 0.4, i.w * 0.4), cc.y + R(-i.h * 0.3, i.h * 0.3), R(-60, 60) + v.x * 0.2, R(-260, -80) + v.y * 0.2, R(0.8, 2), R(1.6, 3.2), [1, 1, 1, 1], { heat: R(0.7, 1) });
        Render.SCREEN.heat = Math.max(Render.SCREEN.heat, k);
        if (s.loop.set) s.loop.set(k, 0.2);
      }
    },
    fluidParams(e, f) { f.buoy = 1500; f.vort = 40; },
    end(e) { e.s.loop.stop(1.6); },
    cursor(e, look, lk) { lk.char = Math.max(lk.char || 0, e.s.char * 0.9); lk.heat = Math.max(lk.heat || 0, 0.12 * (e.s.k || 0)); },
  };

  // 4 ─ WATER BUCKET: a load of water pours on the cursor, it gets soaked, drips, splashes, makes a puddle
  E.water = {
    name: 'Water Bucket', outro: 0.2,
    start(e, c) { e.s.pours = [0]; for (let t = 7; t < e.dur - 1; t += 7) e.s.pours.push(t); e.s.pi = 0; e.s.wet = 0; e.s.sound = [];
      c.linger(2); },
    update(e, c, dt) { const s = e.s;
      // a pour lasts 0.8s: a thick stream from the top edge right above the cursor
      s.pours.forEach(t0 => { const t = e.t - t0; if (t < 0 || t > 0.85 || e.ending) return;
        if (!s.sound.includes(t0)) { s.sound.push(t0); play('water_pour', { vol: 0.8, offset: 1, dur: 1.6 }); setTimeout(() => play('water_splash', { vol: 1, pan: c.pan(cx(c)) }), 380); }
        const rate = (c.quality ? 1600 : 900) * (t < 0.15 ? t / 0.15 : 1);
        const n = rate * dt; for (let j = 0; j < n; j++) { const spread = 26 + t * 30;
          Liquid.add(cx(c) + 10 + R(-spread, spread), R(-40, -5), R(-40, 40), R(650, 950), R(3.5, 7), Liquid.K.WATER); } });
      const att = Liquid.attachedCount(); s.wet = Math.max(s.wet * Math.exp(-dt * 0.3), Math.min(1, att / 30));
    },
    cursor(e, look, lk) { lk.wet = Math.max(lk.wet || 0, e.s.wet); look.catchable = Liquid.attachedCount() < 150; },
  };

  // 5 ─ BLACK HOLE: sucks your cursor in, bends the whole screen around it
  E.blackhole = {
    name: 'Black Hole', outro: 1.4,
    start(e, c) { const s = e.s; s.c = { x: c.W * 0.5, y: c.H * 0.45 };
      if (Math.hypot(cx(c) - s.c.x, cy(c) - s.c.y) < 260) s.c.x = cx(c) < c.W / 2 ? c.W * 0.72 : c.W * 0.28;
      s.rsMax = Math.min(c.W, c.H) * 0.045; s.rs = 0; s.cap = false; s.capT = 0; s.drone = Sfx.drone({ vol: 0.25 }); play('whoosh', { vol: 0.8, rate: 0.5 }); },
    mouse(e, m, dt) { const s = e.s, c = MH.ctx;
      if (s.cap) { m.clip = { x: s.c.x, y: s.c.y, w: 0, h: 0 }; m.margin = 30; return; }
      const k = clamp(e.t / Math.max(1.2, e.dur * 0.55), 0, 1);
      const dx = s.c.x - cx(c), dy = s.c.y - cy(c), r = Math.hypot(dx, dy) + 1;
      const pull = Math.min(5000, (350 + 1300 * k) * (1 + Math.pow(s.rs * 7 / r, 1.6)));
      m.fx += dx / r * pull - dy / r * pull * 0.45; m.fy += dy / r * pull + dx / r * pull * 0.45;
      m.dx *= 1 - k * 0.5; m.dy *= 1 - k * 0.5; },
    mouseEnd(e, m) { if (e.te < 0.45 && e.s.cap) { const a = e.s.ejA; m.fx += Math.cos(a) * 3200 * (1 - e.te / 0.45); m.fy += Math.sin(a) * 3200 * (1 - e.te / 0.45); } },
    update(e, c, dt, time) { const s = e.s;
      s.rs = e.ending ? s.rsMax * Math.max(0, 1 - ease(e.te / 0.5)) : s.rsMax * ease(e.t / 0.9);
      const r = Math.hypot(cx(c) - s.c.x, cy(c) - s.c.y);
      if (!s.cap && !e.ending && r < s.rs * 1.15) { s.cap = true; s.capT = e.t; play('whoosh', { vol: 1, rate: 0.7 }); }
      s.drone.set(0.2 + 0.5 * clamp(1 - r / 900, 0, 1), 0.8 + 0.5 * clamp(1 - r / 900, 0, 1));
      Render.SCREEN.bh = [s.c.x, s.c.y, s.rs, 1];
      if (e.ending) { const w = e.te; Render.SCREEN.waves.set([s.c.x, s.c.y, w * 1600, Math.max(0, 1 - w / 0.9)], 0);
        if (w < 0.2) { Render.SCREEN.flash = [0.9 * (1 - w / 0.2), 0.85 * (1 - w / 0.2), 1 * (1 - w / 0.2)]; Render.SCREEN.mask = 1 - w / 0.2; } }
      if (!e.ending && Math.random() < dt * 30) { const a = R(0, 6.28), d = s.rs * R(6, 9); Parts.spawn(Parts.T.DUST, s.c.x + Math.cos(a) * d, s.c.y + Math.sin(a) * d * 0.3, -Math.sin(a) * 260 - Math.cos(a) * 120, Math.cos(a) * 60, R(0.6, 1.1), R(8, 16), [0.9, 0.6, 0.35, 0.25]); }
      if (!e.ending) c.timer(s.cap, s.c.x, s.c.y + s.rs * 2.6, e.dur - e.t);
    },
    end(e, c) { e.s.drone.stop(0.8); e.s.ejA = R(0, Math.PI * 2); play('explosion', { vol: 0.5, rate: 1.5, dur: 1.5 }); play('whoosh', { vol: 1, rate: 1.3 }); c.timer(false); },
    cursor(e, look) { const s = e.s; const c = MH.ctx;
      if (s.cap && !e.ending) { const k = ease((e.t - s.capT) / 0.7); look.x = s.c.x; look.y = s.c.y; look.rot = (e.t - s.capT) * 14; look.sx = 1 - k * 0.9; look.sy = 1 + k * 2.5; look.alpha = 1 - k; return; }
      if (s.cap && e.ending) { const k = ease(e.te / 0.35); look.scale = k; look.rot = (1 - k) * 8; return; }
      const r = Math.hypot(look.x - s.c.x, look.y - s.c.y); const st = clamp(1 - r / (s.rs * 6), 0, 1);
      if (st > 0) { look.sy = 1 + st * 1.2; look.sx = 1 - st * 0.4; look.rot = Math.atan2(s.c.y - look.y, s.c.x - look.x) - Math.PI / 2; } },
    back(e, c, time) { Shapes.blackhole({ bh: [e.s.c.x, e.s.c.y, e.s.rs, 1], spin: time * 2.5 }); },
  };

  // 6 ─ AIRSTRIKE: a laser locks on, a bomb whistles down, BOOM: fireball, shockwave, cursor blown away
  E.airstrike = {
    name: 'Airstrike', fluid: true, outro: 3.2,
    start(e, c) { const s = e.s; s.strikes = []; let t = Math.max(0.7, Math.min(4, e.dur * 0.6)); while (t < e.dur - 0.2 || !s.strikes.length) { s.strikes.push(t); t += 4.6; } s.si = 0;
      s.target = { x: cx(c), y: cy(c) }; s.beep = 0; s.scorch = []; s.whistled = -1; s.fly = null; s.shake = 0; s.flash = 0; s.wave = null; s.origin = { x: c.W + 60, y: -60 }; },
    mouse(e, m, dt) { const f = e.s.fly; if (!f) return; const c = MH.ctx;
      f.vy += 3000 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 1 - 0.6 * dt;
      if (f.x < 10) { f.x = 10; f.vx = Math.abs(f.vx) * 0.5; } if (f.x > c.W - 10) { f.x = c.W - 10; f.vx = -Math.abs(f.vx) * 0.5; } if (f.y < 10) { f.y = 10; f.vy = Math.abs(f.vy) * 0.4; }
      if (f.y > c.floor - 30) { f.y = c.floor - 30; if (f.vy > 300) play('thud', { vol: Math.min(1, f.vy / 2500), pan: c.pan(f.x) }); f.vy = -f.vy * 0.35; f.vx *= 0.6; f.spin *= 0.5; }
      f.t += dt; m.pin = { x: f.x, y: f.y }; if (f.t > 1.3) e.s.fly = null; },
    update(e, c, dt) { const s = e.s; const next = s.strikes[s.si];
      const prevT = s.si ? s.strikes[s.si - 1] : 0;
      if (next != null && !e.ending) {
        const lock = clamp((e.t - prevT) / (next - prevT), 0, 1); s.lock = lock;
        s.target.x += (cx(c) - s.target.x) * Math.min(1, dt * (4 + lock * 10)); s.target.y += (cy(c) - s.target.y) * Math.min(1, dt * (4 + lock * 10));
        s.beep -= dt; if (s.beep <= 0) { s.beep = 0.5 - 0.4 * lock; play('beep', { vol: 0.25, rate: 1 + lock * 0.3 }); }
        if (s.whistled !== s.si && e.t > next - 1.4) { s.whistled = s.si; play('incoming', { vol: 0.85, offset: 3.75, dur: 1.45 }); }
        if (e.t >= next) { s.si++; boom(e, c); }
      } else s.lock = 0;
      s.shake = Math.max(0, s.shake - dt * 1.4); s.flash = Math.max(0, s.flash - dt * 4);
      if (s.shake > 0) { Render.SCREEN.mask = 1; Render.SCREEN.shake = [R(-1, 1) * 30 * s.shake * s.shake, R(-1, 1) * 30 * s.shake * s.shake]; }
      if (s.flash > 0) { Render.SCREEN.mask = 1; Render.SCREEN.flash = [s.flash * 0.9, s.flash * 0.75, s.flash * 0.5]; }
      if (s.wave) { s.wave.r += dt * 1500; s.wave.k = Math.max(0, s.wave.k - dt * 1.1); Render.SCREEN.waves.set([s.wave.x, s.wave.y, s.wave.r, s.wave.k], 4); }
      s.scorch.forEach(q => { q.ember = Math.max(0, q.ember - dt * 0.25); q.a = e.ending ? Math.max(0, 0.85 * (1 - e.te / 3)) : 0.85; });
    },
    end(e) {},
    cursor(e, look, lk) { const f = e.s.fly; if (f) { look.rot = f.spin * f.t; lk.char = Math.max(lk.char || 0, 0.55); }
      else if (e.s.si > 0) lk.char = Math.max(lk.char || 0, 0.55 * clamp(1 - (e.ending ? e.te / 1.5 : 0), 0, 1)); },
    fluidParams(e, f) { f.buoy = 700; f.vort = 26; },
    back(e) { if (e.s.scorch.length) Shapes.scorch(e.s.scorch); },
    front(e, c, time) { const s = e.s; if (s.lock > 0 && !e.ending) Shapes.laser({ a: [s.origin.x, s.origin.y], b: [s.target.x, s.target.y], on: 1, ret: 1, lock: s.lock, pulse: 0.5 + 0.5 * Math.sin(time * (6 + s.lock * 20)) }); },
  };
  function boom(e, c) { const s = e.s; const x = cx(c), y = cy(c);
    Fluid.splat(x, y, 42, [1.5, 1.4, 1.3, 0], null, { radial: 1700, vr: 95, noise: 0.85 });
    for (let k = 0; k < 9; k++) { const a = R(0, 6.28), d = R(25, 80); Fluid.splat(x + Math.cos(a) * d, y + Math.sin(a) * d, R(16, 34), [R(0.8, 1.3), R(0.9, 1.6), R(0.6, 1.1), 0], [Math.cos(a) * R(200, 700), Math.sin(a) * R(200, 700) - 300], { noise: 0.9, vr: 40 }); }
    Fluid.splat(x, y - 40, 60, null, [0, -700]);
    s.wave = { x, y, r: 10, k: 1 }; s.shake = 1; s.flash = 0.75;
    for (let k = 0; k < 140; k++) { const a = R(0, 6.28), sp = R(300, 1800); Parts.spawn(Parts.T.SPARK, x, y, Math.cos(a) * sp, Math.sin(a) * sp - 300, R(0.4, 1.4), R(1.5, 3.5), [1, 1, 1, 1], { heat: R(0.7, 1) }); }
    for (let k = 0; k < 45; k++) { const a = R(-3.0, -0.1), sp = R(300, 1200); Parts.spawn(Parts.T.DEBRIS, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R(1.5, 3), R(4, 11), [0.16, 0.13, 0.11, 1]); }
    for (let k = 0; k < 40; k++) Parts.spawn(Parts.T.EMBER, x + R(-40, 40), y + R(-40, 40), R(-300, 300), R(-500, -100), R(1, 2.5), R(2, 3.5), [1, 1, 1, 1], { heat: 1 });
    if (y > c.floor - 140) for (let k = 0; k < 30; k++) Parts.spawn(Parts.T.DUST, x + R(-30, 30), c.floor - 8, R(-700, 700), R(-60, 0), R(1.2, 2.4), R(20, 40), [0.42, 0.38, 0.33, 0.5]);
    s.scorch.push({ x, y, r: 95, a: 0.85, seed: R(0, 50), ember: 1, rot: R(0, 6) });
    s.fly = { x, y, vx: R(-1, 1) * 2600, vy: -R(1200, 2200), spin: R(-25, 25), t: 0 };
    play('explosion', { vol: 1, offset: 0.33, pan: c.pan(x) });
  }

  // 7 ─ LIGHTNING: storm clouds, real lightning bolts hit your cursor, it gets electrocuted
  function bolt(x0, y0, x1, y1, rough, depth, out, w) {
    if (depth === 0) { out.push([x0, y0, w], [x1, y1, w]); return; }
    const mx = (x0 + x1) / 2 + (Math.random() - 0.5) * rough, my = (y0 + y1) / 2 + (Math.random() - 0.5) * rough * 0.4;
    const a = [], b = []; bolt(x0, y0, mx, my, rough / 2, depth - 1, a, w); bolt(mx, my, x1, y1, rough / 2, depth - 1, b, w);
    out.push(...a, ...b.slice(1));
  }
  E.lightning = {
    name: 'Lightning', outro: 1.4,
    start(e, c) { const s = e.s; s.next = 0.55; s.bolts = []; s.shock = 0; s.flash = 0; s.scorch = []; s.flashAt = [c.W / 2, 0]; play('thunder', { vol: 0.35, rate: 0.7, offset: 4, dur: 4 }); },
    mouse(e, m) { const s = e.s; if (s.jolt) { m.dx += s.jolt.x; m.dy += s.jolt.y; s.jolt = null; }
      if (s.shock > 0) { m.dx += R(-1, 1) * 9 * s.shock; m.dy += R(-1, 1) * 9 * s.shock; } },
    update(e, c, dt) { const s = e.s;
      s.cloud = e.ending ? Math.max(0, 1 - e.te / 1.2) : ease(e.t / 0.6);
      if (!e.ending && e.t >= s.next) {
        s.next = e.t + R(0.9, 1.7); const x1 = cx(c), y1 = cy(c); const x0 = x1 + R(-350, 350), y0 = c.H * 0.1;
        const main = []; bolt(x0, y0, x1, y1, Math.hypot(x1 - x0, y1 - y0) * 0.35, 7, main, 1);
        const br = []; for (let k = 0; k < 5; k++) { const p = main[(Math.random() * main.length * 0.8) | 0]; const pts = []; const a = Math.atan2(y1 - y0, x1 - x0) + R(-0.9, 0.9); const L = R(60, 220);
          bolt(p[0], p[1], p[0] + Math.cos(a) * L, p[1] + Math.sin(a) * L, L * 0.5, 5, pts, 0.45); br.push(pts); }
        s.bolts.push({ main, br, age: 0 }); s.flash = 1; s.shock = 1; s.flashAt = [x0, y0];
        s.jolt = { x: R(-70, 70), y: R(-70, 40) };
        play('thunder', { vol: 1, pan: c.pan(x1) }); play('electric', { vol: 0.55, dur: 0.8 });
        for (let k = 0; k < 70; k++) { const a = R(0, 6.28), sp = R(150, 900); Parts.spawn(Parts.T.SPARK, x1, y1, Math.cos(a) * sp, Math.sin(a) * sp - 200, R(0.3, 0.9), R(1.3, 2.8), [0.8, 0.9, 1.5, 1], { heat: 1 }); }
        s.scorch.push({ x: x1 + 6, y: y1 + 10, r: 34, a: 0.6, seed: R(0, 50), ember: 0.4 }); if (s.scorch.length > 6) s.scorch.shift();
      }
      s.bolts.forEach(b => b.age += dt); s.bolts = s.bolts.filter(b => b.age < 0.4);
      s.shock = Math.max(0, s.shock - dt * 1.6); s.flash = Math.max(0, s.flash - dt * 5);
      if (s.flash > 0.02) { Render.SCREEN.mask = 1; const f = s.flash * s.flash * 0.22; Render.SCREEN.flash = [f * 0.85, f * 0.9, f]; }
      s.scorch.forEach(q => { q.ember = Math.max(0, q.ember - dt * 0.5); if (e.ending) q.a = Math.max(0, 0.6 * (1 - e.te / 1.4)); });
    },
    cursor(e, look, lk) { lk.elec = Math.max(lk.elec || 0, e.s.shock); },
    back(e, c) { Shapes.clouds({ amt: e.s.cloud || 0, flash: e.s.flash, at: e.s.flashAt, h: c.H * 0.17 }); if (e.s.scorch.length) Shapes.scorch(e.s.scorch); },
    front(e) { const s = e.s; if (!s.bolts.length) return;
      s.bolts.forEach(b => { const f = b.age < 0.06 ? 1 : b.age < 0.1 ? 0.25 : b.age < 0.16 ? 0.9 : Math.max(0, 1 - (b.age - 0.16) / 0.24) * 0.6;
        Shapes.glowLine(b.main, 2.6, [0.75, 0.85, 1.7], f, false); b.br.forEach(p => Shapes.glowLine(p, 1.4, [0.65, 0.75, 1.5], f * 0.7, false)); });
      Shapes.glowFlush(); },
  };

  // 8 ─ TORNADO: a funnel of spinning dust grabs your cursor and spins it around
  E.tornado = {
    name: 'Tornado', outro: 2.2,
    start(e, c) { const s = e.s; s.cx = clamp(cx(c) + (cx(c) < c.W / 2 ? 280 : -280), 200, c.W - 200); s.ca = 0; s.pow = 0;
      const N = c.quality ? 2600 : 1400; s.N = N; s.d = new Float32Array(N * 6);
      for (let i = 0; i < N; i++) { const o = i * 6; s.d[o] = R(0, 6.28); s.d[o + 1] = Math.pow(Math.random(), 0.6); s.d[o + 2] = R(0.82, 1.12); s.d[o + 3] = R(0.7, 1.3); s.d[o + 4] = R(0, 1); s.d[o + 5] = R(0, 99); }
      s.deb = []; for (let i = 0; i < 70; i++) s.deb.push({ a: R(0, 6.28), h: R(0, 0.9), r: R(1.1, 1.8), sp: R(0.8, 1.4), size: R(3, 9), seed: R(0, 99) });
      s.batch = s.batch || Parts.makeBatch(N + 200); s.batchF = s.batchF || Parts.makeBatch(N + 200);
      s.wind = Sfx.loop('blizzard', { vol: 1, fade: 1 }); s.rum = Sfx.loop('rumble', { vol: 0.5, fade: 1 }); },
    R(s, h) { return (14 + 380 * Math.pow(h, 1.8)) * (0.25 + 0.75 * s.pow); },
    mouse(e, m, dt) { const s = e.s, c = MH.ctx;
      s.ca += dt * (5 + 3 * s.pow); const ch = 0.42 + 0.28 * Math.sin(e.t * 0.9);
      const r = E.tornado.R(s, ch) * 0.8; const tx = s.cx + Math.cos(s.ca) * r, ty = (c.floor) - ch * (c.floor + 60) + Math.sin(s.ca) * r * 0.16;
      m.dx *= 0.3; m.dy *= 0.3; const k = s.pow * 7; m.fx += (tx - cx(c)) * k; m.fy += (ty - cy(c)) * k; s.behind = Math.sin(s.ca) < 0; },
    mouseEnd(e, m) { if (e.te < 0.5) { const c = MH.ctx; const dx = cx(c) - e.s.cx; const d = Math.sign(dx) || 1; m.fx += d * 2200 * (1 - e.te / 0.5); m.fy -= 800 * (1 - e.te / 0.5); } },
    update(e, c, dt, time) { const s = e.s;
      s.pow = e.ending ? Math.max(0, 1 - e.te / 1.8) : ease(e.t / 1.2);
      s.cx += Math.sin(time * 0.6) * 30 * dt; s.cloud = s.pow;
      const d = s.d, top = c.floor + 60;
      for (let i = 0; i < s.N; i++) { const o = i * 6; const h = d[o + 1]; const rr = E.tornado.R(s, h) * d[o + 2]; d[o] += dt * (3.2 + 160 / (rr + 30)) * d[o + 3]; d[o + 1] += dt * 0.05 * d[o + 3]; if (d[o + 1] > 1) d[o + 1] = 0; }
      s.deb.forEach(q => { q.a += dt * (4 + 2 * q.sp); q.h += dt * 0.12 * q.sp; if (q.h > 0.95) q.h = 0.02; });
      if (s.pow > 0.3 && Math.random() < dt * 25) Parts.spawn(Parts.T.DUST, s.cx + R(-120, 120), c.floor - 6, R(-300, 300), R(-60, -10), R(0.8, 1.6), R(18, 36), [0.4, 0.37, 0.33, 0.35]);
      s.wind.set(s.pow, 0.3); s.rum.set(s.pow * 0.5, 0.3);
    },
    end(e) { e.s.wind.stop(1.5); e.s.rum.stop(1.5); },
    cursor(e, look) { look.rot = (look.rot || 0) + e.t * 11 * e.s.pow; },
    _draw(e, c, front, time) { const s = e.s, d = s.d, b = front ? s.batchF : s.batch; b.reset(); const top = c.floor + 60;
      for (let i = 0; i < s.N; i++) { const o = i * 6; const sn = Math.sin(d[o]); if ((sn >= 0) !== front) continue; const h = d[o + 1]; const rr = E.tornado.R(s, h) * d[o + 2];
        const x = s.cx + Math.cos(d[o]) * rr + Math.sin(h * 9 + time * 1.5) * 18 * h, y = c.floor - h * top + sn * rr * 0.16;
        const sz = (14 + 95 * h) * (0.7 + 0.3 * d[o + 4]); const sh = 0.55 + 0.45 * (sn * 0.5 + 0.5);
        const a = 0.075 * s.pow * (front ? 1 : 0.8) * Math.min(1, h * 12) * (1 - Math.pow(h, 8));
        b.push(x, y, sz, sz, 0.5 * sh + 0.12, 0.46 * sh + 0.11, 0.41 * sh + 0.1, a, d[o + 5], 3, d[o + 5], 0, time * 0.05); }
      if (front) s.deb.forEach(q => { const rr = E.tornado.R(s, q.h) * q.r; const x = s.cx + Math.cos(q.a) * rr, y = c.floor - q.h * top + Math.sin(q.a) * rr * 0.16;
        b.push(x, y, q.size, q.size * 0.8, 0.12, 0.1, 0.08, s.pow, q.a * 3, 4, q.seed, 0, 0); });
      b.draw({}, Render.scene, 'pm'); },
    back(e, c, time) { Shapes.clouds({ amt: e.s.cloud * 0.9, flash: 0, at: [0, 0], h: c.H * 0.12 }); E.tornado._draw(e, c, false, time); },
    front(e, c, time) { E.tornado._draw(e, c, true, time); },
  };

  // 9 ─ EARTHQUAKE: the whole screen shakes, the glass cracks, dust falls, the cursor goes crazy
  function crackWeb(x, y, size) { const segs = []; const arms = 7 + (Math.random() * 5 | 0); const ringR = [];
    for (let k = 1; k <= 3; k++) ringR.push(size * 0.18 * k * R(0.8, 1.2));
    const armPts = [];
    for (let a = 0; a < arms; a++) { let ang = a / arms * 6.28 + R(-0.25, 0.25); let px = x, py = y; const pts = [[px, py]]; const L = size * R(0.6, 1.4); let d = 0;
      while (d < L) { const st = R(18, 46); ang += R(-0.14, 0.14); const nx = px + Math.cos(ang) * st, ny = py + Math.sin(ang) * st; segs.push({ s: [px, py, nx, ny, R(1.1, 1.8)], d }); px = nx; py = ny; d += st; pts.push([px, py]);
        if (Math.random() < 0.12) { let ba = ang + R(-1, 1), bx = px, by = py; for (let j = 0; j < 4; j++) { const s2 = R(8, 18); const nx2 = bx + Math.cos(ba) * s2, ny2 = by + Math.sin(ba) * s2; segs.push({ s: [bx, by, nx2, ny2, 0.6], d: d + j * 10 }); bx = nx2; by = ny2; ba += R(-0.4, 0.4); } } }
      armPts.push(pts); }
    ringR.forEach(rr => { for (let a = 0; a < arms; a++) { const p0 = armPts[a].find(p => Math.hypot(p[0] - x, p[1] - y) >= rr), p1 = armPts[(a + 1) % arms].find(p => Math.hypot(p[0] - x, p[1] - y) >= rr);
      if (p0 && p1 && Math.random() < 0.75) segs.push({ s: [p0[0], p0[1], p1[0] + R(-4, 4), p1[1] + R(-4, 4), 0.6], d: rr * 1.2 }); } });
    for (let k = 0; k < 26; k++) { const a = R(0, 6.28), r0 = R(2, 20), r1 = r0 + R(6, 18); segs.push({ s: [x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a + R(-0.4, 0.4)) * r1, y + Math.sin(a + R(-0.4, 0.4)) * r1, 1], d: 0 }); }
    return segs; }
  E.earthquake = {
    name: 'Earthquake', outro: 1.8,
    start(e, c) { const s = e.s; s.cracks = []; s.nextCrack = 0.5; s.amp = 0; s.loop = Sfx.loop('rumble', { vol: 1, fade: 0.4 }); },
    mouse(e, m) { const a = e.s.amp; m.dx += R(-1, 1) * 16 * a; m.dy += R(-1, 1) * 16 * a; },
    update(e, c, dt, time) { const s = e.s;
      s.amp = (e.ending ? Math.max(0, 1 - e.te / 0.8) : ease(e.t / 0.6)) * (0.7 + 0.3 * Math.sin(time * 11) * Math.sin(time * 3.7));
      if (s.amp > 0.01) { Render.SCREEN.mask = 1; Render.SCREEN.shake = [(vnoise(time * 23) - 0.5) * 34 * s.amp, (vnoise(time * 19 + 7) - 0.5) * 26 * s.amp]; Render.SCREEN.rot = Math.sin(time * 9) * 0.005 * s.amp; }
      if (!e.ending && e.t > s.nextCrack && s.cracks.length < 5) { s.nextCrack = e.t + R(0.9, 1.8);
        s.cracks.push({ t0: e.t, segs: crackWeb(R(c.W * 0.12, c.W * 0.88), R(c.H * 0.12, c.floor * 0.85), R(160, 320)) }); play('glass_crack', { vol: 0.8 }); }
      if (!e.ending && Math.random() < dt * 40 * s.amp) Parts.spawn(Parts.T.DUST, R(0, c.W), -10, R(-20, 20), R(60, 200), R(1.5, 3), R(10, 26), [0.5, 0.47, 0.42, 0.3]);
      if (!e.ending && Math.random() < dt * 20 * s.amp) Parts.spawn(Parts.T.DEBRIS, R(0, c.W), -10, R(-60, 60), R(0, 200), R(2, 3), R(2, 6), [0.3, 0.28, 0.25, 1]);
      s.loop.set(Math.max(0.05, s.amp), 0.2);
    },
    end(e) { e.s.loop.stop(1.2); },
    front(e) { const s = e.s; const a = e.ending ? Math.max(0, 1 - e.te / 1.8) : 1; const list = [];
      s.cracks.forEach(cr => { const age = e.t - cr.t0; cr.segs.forEach(q => { const g = clamp((age * 900 - q.d) / 30, 0, 1); if (g > 0) list.push([...q.s, g]); }); });
      if (list.length) Shapes.cracks(list.map(q => [q[0], q[1], q[2], q[3], q[4], q[5]]), a * 0.9); },
  };
  function vnoise(t) { const i = Math.floor(t), f = t - i; const h = n => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }; const u = f * f * (3 - 2 * f); return h(i) * (1 - u) + h(i + 1) * u; }

  // 10 ─ GRAVITY: the cursor gets heavy and drops onto the taskbar, bounces; flick up to throw it
  E.gravity = {
    name: 'Gravity', outro: 0.3,
    start(e) { e.s.vy = 0; e.s.tilt = 0; e.s.squash = 0; e.s.trail = []; play('whoosh', { vol: 0.5, rate: 0.7 }); },
    mouse(e, m, dt) { const s = e.s, c = MH.ctx, i = ci();
      if (m.dy < -2) s.vy = Math.min(s.vy, m.dy / dt * 0.8);
      s.vy += 3400 * dt; m.dy = (m.dy > 0 ? m.dy * 0.2 : 0) + s.vy * dt;
      const fl = c.floor - (i.h - i.hy) + 2;
      if (cy(c) + m.dy > fl) { m.dy = fl - cy(c); const imp = s.vy;
        if (imp > 420) { play('thud', { vol: Math.min(1, imp / 2600), vary: 0.2, pan: c.pan(cx(c)) }); s.vy = -imp * 0.36; s.tilt = R(-0.5, 0.5); s.squash = Math.min(1, imp / 2500);
          for (let k = 0; k < 10 * s.squash; k++) Parts.spawn(Parts.T.DUST, cx(c) + R(-10, 20), c.floor - 4, R(-160, 160), R(-50, -5), R(0.6, 1.2), R(8, 18), [0.55, 0.52, 0.48, 0.3]); }
        else s.vy = 0; }
      if (cy(c) + m.dy < 0) { s.vy = Math.abs(s.vy) * 0.3; } },
    update(e, c, dt) { const s = e.s; s.tilt *= Math.exp(-dt * 5); s.squash = Math.max(0, s.squash - dt * 6);
      s.trail.unshift({ x: cx(c), y: cy(c) }); s.trail.length = Math.min(s.trail.length, 6); },
    cursor(e, look) { const s = e.s; look.rot += s.tilt; look.sy = 1 - s.squash * 0.25; look.sx = 1 + s.squash * 0.2;
      if (Math.abs(s.vy) > 900) s.trail.slice(1).forEach((p, i) => look.extra.push({ x: p.x, y: p.y, key: look.key, alpha: 0.25 * (1 - i / 6) })); },
  };

  // 11 ─ OIL SLICK: rainbow oil everywhere, the cursor slides like crazy
  E.oil = {
    name: 'Oil Slick', outro: 3,
    start(e, c) { const s = e.s; s.v = { x: 0, y: 0 }; s.stamps = []; for (let k = 0; k < 12; k++) s.stamps.push([cx(c) + R(-90, 90), cy(c) + R(-50, 90), R(70, 180), R(0.45, 0.7)]);
      play('squelch', { vol: 0.9, rate: 0.7 }); s.sq = 0; },
    mouse(e, m, dt) { const s = e.s, c = MH.ctx;
      s.v.x += m.dx / dt * 0.1; s.v.y += m.dy / dt * 0.1; const f = Math.exp(-0.5 * dt); s.v.x *= f; s.v.y *= f;
      const sp = Math.hypot(s.v.x, s.v.y); if (sp > 4000) { s.v.x *= 4000 / sp; s.v.y *= 4000 / sp; }
      m.dx = s.v.x * dt; m.dy = s.v.y * dt;
      const nx = cx(c) + m.dx, ny = cy(c) + m.dy;
      if (nx < 2 || nx > c.W - 3) { s.v.x *= -0.55; m.dx = 0; } if (ny < 2 || ny > c.H - 3) { s.v.y *= -0.55; m.dy = 0; } },
    update(e, c, dt) { const s = e.s; const sp = Math.hypot(s.v.x, s.v.y);
      if (!e.ending && sp > 60) s.stamps.push([cx(c) + 8, cy(c) + 10, 26 + Math.min(60, sp * 0.02), 0.42]);
      s.sq -= dt; if (sp > 1300 && s.sq <= 0) { s.sq = 0.5; play('squelch', { vol: 0.4, vary: 0.4, pan: c.pan(cx(c)) }); }
      s.fade = e.ending ? Math.max(0, 1 - e.te / 3) : 1; },
    cursor(e, look, lk) { lk.wet = Math.max(lk.wet || 0, 0.7 * e.s.fade); },
    back(e) { const s = e.s; if (s.stamps.length) { Shapes.oilStamp(s.stamps); s.stamps = []; } Shapes.oilDraw(s.fade); },
    cleanup() { Shapes.oilClear(); },
  };

  // 12 ─ HONEY TRAP: thick honey pours on it, the cursor gets super slow and sticky
  E.honey = {
    name: 'Honey Trap', outro: 0.3,
    start(e, c) { e.s.pour = 0; play('water_pour', { vol: 0.5, rate: 0.55, offset: 1, dur: 2.5 }); setTimeout(() => play('squelch', { vol: 0.8, rate: 0.6 }), 700); c.linger(2); },
    mouse(e, m) { const k = ease(e.t / 0.8); m.dx *= 1 - k * 0.87; m.dy *= 1 - k * 0.87; m.fy += 18 * k; },
    update(e, c, dt) { if (e.t < 1.4 && !e.ending) { const n = (c.quality ? 520 : 320) * dt;
      for (let j = 0; j < n; j++) Liquid.add(cx(c) + 9 + R(-9, 9), R(-30, -5), R(-10, 10), R(380, 480), R(5, 8), Liquid.K.HONEY); }
      if (Math.random() < dt * 0.8 && !e.ending) play('squelch', { vol: 0.25, vary: 0.4, rate: 0.7 }); },
    cursor(e, look, lk) { lk.wet = Math.max(lk.wet || 0, 0.6); look.catchable = Liquid.attachedCount() < 260; },
  };

  // 13 ─ LAVA MELT: the cursor heats up red hot and melts into dripping lava that cools on the taskbar
  E.lava = {
    name: 'Lava Melt', fluid: true, outro: 1.6,
    start(e) { e.s.heat = 0; e.s.melt = 0; play('sizzle', { vol: 0.7 }); e.s.loop = Sfx.loop('lava', { vol: 0.8, fade: 1 }); e.s.drip = 0; },
    mouse(e, m) { const k = e.s.melt; m.dx *= 1 - 0.45 * k; m.dy *= 1 - 0.45 * k; m.fy += 70 * k; },
    update(e, c, dt) { const s = e.s;
      s.heat = e.ending ? Math.max(0, s.heat - dt * 0.7) : Math.min(1, e.t / 1.3);
      s.melt = e.ending ? Math.max(0, s.melt - dt * 1.2) : clamp((e.t - 0.7) / 2.4, 0, 1);
      const i = ci();
      if (!e.ending && s.melt > 0.05) { s.drip += dt * (3 + 9 * s.melt);
        while (s.drip > 1) { s.drip--; Liquid.add(cx(c) + R(i.w * 0.05, i.w * 0.55) - i.hx, cy(c) + i.h * (0.55 + s.melt * 0.4) - i.hy, c.M.vel.x * 0.2 + R(-10, 10), R(20, 80), R(4, 7.5), Liquid.K.LAVA, { heat: 1 }); } }
      if (s.heat > 0.3 && !e.ending) { const cc = cursorCenter(c); Fluid.splat(cc.x, cc.y - 4, 10, [0.12 * s.heat, 0.07 * s.heat, 0, 0]);
        if (Math.random() < dt * 6) Parts.spawn(Parts.T.EMBER, cc.x + R(-8, 8), cc.y, R(-30, 30), R(-120, -40), R(0.5, 1.2), R(1.4, 2.4), [1, 1, 1, 1], { heat: 0.8 }); }
      Render.SCREEN.heat = Math.max(Render.SCREEN.heat, s.heat * 0.7);
    },
    fluidParams(e, f) { f.buoy = 600; },
    end(e) { e.s.loop.stop(2); play('steam', { vol: 0.5 }); },
    cursor(e, look, lk) { lk.heat = Math.max(lk.heat || 0, e.s.heat * 0.95); lk.melt = Math.max(lk.melt || 0, e.s.melt); },
  };

  // 14 ─ BLIZZARD: a real snow storm, snow piles up ON the cursor (it gets heavy) and on the taskbar
  E.blizzard = {
    name: 'Blizzard', outro: 2.6,
    start(e, c) { const s = e.s; s.bank = new Float32Array(Math.ceil(c.W / 4)); s.pile = []; s.gust = 0; s.k = 0; s.loop = Sfx.loop('blizzard', { vol: 1, fade: 1.2 });
      s.batch = s.batch || Parts.makeBatch(600);
      Parts.onSnowLand = (x, size) => { const j = clamp(Math.round(x / 4), 0, s.bank.length - 1); for (let q = -2; q <= 2; q++) { const jj = j + q; if (jj >= 0 && jj < s.bank.length) s.bank[jj] = Math.min(120, s.bank[jj] + size * 0.05 * (1 - Math.abs(q) / 3)); } };
      Parts.snowCatch = (i, x, y) => { if (e.ending || s.pile.length > 420) return false; const lx = x - cx(c), ly = y - cy(c);
        if (Liquid.inMask(lx, ly + 2)) { s.pile.push({ x: lx, y: ly - 1, s: R(2.5, 4.5) }); return true; }
        for (let q = s.pile.length - 1; q >= Math.max(0, s.pile.length - 120); q--) { const p = s.pile[q]; if (Math.abs(p.x - lx) < 3.5 && ly < p.y && ly > p.y - 4) { s.pile.push({ x: lx, y: p.y - R(1.5, 2.5), s: R(2.5, 4.5) }); return true; } }
        return false; }; },
    mouse(e, m) { const s = e.s; m.fx += s.gust * 0.45 * s.k; m.fy += Math.min(260, s.pile.length * 0.9); },
    update(e, c, dt, time) { const s = e.s;
      s.k = e.ending ? Math.max(0, 1 - e.te / 1.2) : ease(e.t / 1.2);
      s.gust = (Math.sin(time * 0.55) * 260 + Math.sin(time * 1.7 + 1) * 110 + 120) * s.k; Parts.wind = s.gust;
      const n = (c.quality ? 1900 : 900) * dt * s.k;
      for (let j = 0; j < n; j++) { const d = Math.pow(Math.random(), 0.6); Parts.spawn(Parts.T.SNOW, R(-c.W * 0.25, c.W), R(-30, -5), s.gust * d, R(60, 160) * d, 12, (1.6 + 5 * d) * (d > 0.93 ? 2.6 : 1), [1, 1, 1, 0.6 + 0.4 * d], { depth: d }); }
      const sp = Math.hypot(c.M.vel.x, c.M.vel.y);
      if (sp > 1700 && s.pile.length) { const drop = s.pile.splice(0, Math.ceil(s.pile.length * 0.6)); drop.forEach(p => Parts.spawn(Parts.T.SNOW, cx(c) + p.x, cy(c) + p.y, c.M.vel.x * 0.3 + R(-40, 40), R(0, 100), 6, p.s, [1, 1, 1, 0.95], { depth: 0.99 })); play('thud', { vol: 0.2, rate: 1.8 }); }
      if (e.ending && s.pile.length) { const drop = s.pile.splice(0, Math.max(1, s.pile.length * dt * 3 | 0)); drop.forEach(p => Parts.spawn(Parts.T.SNOW, cx(c) + p.x, cy(c) + p.y, R(-30, 30), R(0, 60), 6, p.s, [1, 1, 1, 0.95], { depth: 0.99 })); }
      for (let j = 1; j < s.bank.length - 1; j++) s.bank[j] = s.bank[j] * 0.96 + (s.bank[j - 1] + s.bank[j + 1]) * 0.02;
      if (e.ending) for (let j = 0; j < s.bank.length; j++) s.bank[j] *= Math.exp(-dt * 0.8);
      s.frost = 0.55 * s.k; s.loop.set(Math.max(0.1, s.k), 0.3);
    },
    end(e) { e.s.loop.stop(2); },
    cleanup() { Parts.onSnowLand = null; Parts.snowCatch = null; },
    back(e, c) { Shapes.snowbank(e.s.bank, c.floor, 1); },
    front(e, c, time) { const s = e.s; const b = s.batch; b.reset();
      s.pile.forEach(p => b.push(cx(c) + p.x, cy(c) + p.y, p.s * 2.2, p.s * 2.2, 0.97, 0.98, 1, 0.97, 0, 2, 0, 0, 0, 0.7)); b.draw({}, Render.scene, 'pm');
      Shapes.frost(s.frost, 3.3); },
  };

  // 15 ─ DRUNK: double vision, the screen sways, the cursor wobbles and hiccups
  E.drunk = {
    name: 'Drunk', outro: 1.6,
    start(e) { e.s.hic = 1.2; e.s.jolt = 0; },
    mouse(e, m, dt) { const s = e.s; const a = s.amt || 0; const t = e.t;
      m.fx += (vnoise(t * 0.8) - 0.5) * 900 * a + Math.sin(t * 1.3) * 160 * a; m.fy += (vnoise(t * 0.7 + 30) - 0.5) * 500 * a;
      if (s.jolt) { m.dy -= s.jolt; s.jolt = 0; } m.dx *= 1 - 0.25 * a; m.dy *= 1 - 0.25 * a; },
    update(e, c, dt, time) { const s = e.s; s.amt = e.ending ? Math.max(0, 1 - e.te / 1.4) : ease(e.t / 1.5); const a = s.amt;
      if (a > 0.01) { Render.SCREEN.mask = 1; Render.SCREEN.drunk = [Math.sin(time * 1.1) * 30 * a, Math.cos(time * 0.8) * 14 * a, a];
        Render.SCREEN.rot = Math.sin(time * 0.6) * 0.014 * a; Render.SCREEN.zoom = 1 + 0.012 * a * (1 + Math.sin(time * 0.4)); Render.SCREEN.tint = [1.06, 0.97, 0.86]; Render.SCREEN.tintAmt = 0.45 * a; }
      if (!e.ending && e.t > s.hic) { s.hic = e.t + R(1.6, 3.4); play('hiccup', { vol: 0.9, vary: 0.15 }); s.jolt = R(40, 80); } },
    cursor(e, look) { const a = e.s.amt || 0; if (a > 0.01) look.extra.push({ x: look.x + Math.sin(performance.now() / 1000 * 1.1) * 30 * a, y: look.y + Math.cos(performance.now() / 1000 * 0.8) * 14 * a, key: look.key, alpha: 0.45 * a, rot: look.rot }); },
  };

  // 16 ─ GLITCH: the screen corrupts and the cursor teleports around
  E.glitch = {
    name: 'Glitch', outro: 0.4,
    start(e) { e.s.next = 0.45; e.s.burst = 0.8; e.s.seed = 0; e.s.st = 0; play('glitch', { vol: 0.6, offset: R(0, 6), dur: 0.4 }); },
    mouse(e, m) { const s = e.s; if (s.tp) { m.pin = s.tp; s.tp = null; } if (s.burst > 0.1) { m.dx += R(-1, 1) * 6 * s.burst; m.dy += R(-1, 1) * 3 * s.burst; } },
    update(e, c, dt) { const s = e.s; s.burst = Math.max(0, s.burst - dt * 2.8); s.st -= dt; if (s.st <= 0) { s.st = R(0.03, 0.08); s.seed = R(0, 999); }
      if (!e.ending && e.t >= s.next) { s.next = e.t + R(0.45, 1.3); s.burst = 1; s.tp = { x: R(60, c.W - 60), y: R(60, c.floor - 60) };
        play('glitch', { vol: 0.55, offset: R(0, 6.5), dur: R(0.15, 0.4), pan: c.pan(s.tp.x) }); }
      if (s.burst > 0.06) { Render.SCREEN.mask = 1; Render.SCREEN.glitch = 0.3 + s.burst * 0.9; Render.SCREEN.glitchSeed = s.seed; } },
    cursor(e, look, lk) { const s = e.s; lk.split = Math.max(lk.split || 0, 0.35 + s.burst * 1.6);
      if (s.burst > 0.2) { look.extra.push({ x: look.x + R(-30, 30) * s.burst, y: look.y + R(-6, 6), key: look.key, alpha: 0.5 * s.burst, tint: [1, 0.2, 0.2] }, { x: look.x + R(-30, 30) * s.burst, y: look.y, key: look.key, alpha: 0.5 * s.burst, tint: [0.2, 1, 1] }); } },
  };

  // 17 ─ CLONE ARMY: 30 cursors move exactly like yours. Which one is real?
  E.clones = {
    name: 'Clone Army', outro: 0.6,
    start(e, c) { const s = e.s; s.offs = []; for (let k = 0; k < 29; k++) s.offs.push({ x: R(-c.W, c.W), y: R(-c.H, c.H), seed: R(0, 9) }); play('shimmer', { vol: 0.9 }); },
    end(e, c) { play('pop', { vol: 0.7 }); setTimeout(() => play('pop', { vol: 0.5, rate: 1.2 }), 120); setTimeout(() => play('pop', { vol: 0.5, rate: 0.9 }), 240); },
    cursor(e, look) { const s = e.s, c = MH.ctx; const k = e.ending ? 1 - ease(e.te / 0.5) : ease(e.t / 0.45);
      const fy = c.floor;
      s.offs.forEach(o => { let x = look.x + o.x * k, y = look.y + o.y * k; x = ((x % c.W) + c.W) % c.W; y = ((y % fy) + fy) % fy; look.extra.push({ x, y, key: look.key, alpha: 1 }); });
      if (e.ending && e.te > 0.45 && !s.popped) { s.popped = 1; look.extra.forEach(p => { for (let q = 0; q < 3; q++) Parts.spawn(Parts.T.GLINT, p.x, p.y, R(-80, 80), R(-80, 80), 0.4, 8, [1, 1, 1, 1]); }); } },
  };

  // 18 ─ MIRROR WORLD: the whole screen flips. Left is right now (and later up is down)
  E.mirror = {
    name: 'Mirror World', outro: 0.6,
    start(e) { e.s.fx = 0; e.s.fy = 0; e.s.vAt = e.dur > 4 ? e.dur * 0.5 : 1e9; e.s.vDone = false; play('shimmer', { vol: 0.8 }); play('whoosh', { vol: 0.7 }); },
    update(e, c) { const s = e.s;
      s.fx = e.ending ? 1 - ease(e.te / 0.45) : ease(e.t / 0.45);
      if (!e.ending && e.t > s.vAt && !s.vDone) { s.vDone = true; play('whoosh', { vol: 0.7, rate: 0.8 }); }
      s.fy = e.ending ? (s.vDone ? 1 - ease(e.te / 0.45) : 0) : (s.vDone ? ease((e.t - s.vAt) / 0.45) : 0);
      Render.SCREEN.mask = 1; Render.SCREEN.flipX = s.fx; Render.SCREEN.flipY = s.fy; },
    cursor(e, look) { const s = e.s, c = MH.ctx; if (s.fx > 0.5) { look.x = c.W - look.x; look.sx = -(look.sx || 1); } if (s.fy > 0.5) { look.y = c.H - look.y; look.sy = -(look.sy || 1); } },
  };

  // 19 ─ RUBBER BAND: a thumbtack pins a rubber band to your cursor; it pulls you back, then SNAPS
  E.rubberband = {
    name: 'Rubber Band', outro: 1.3,
    start(e, c) { const s = e.s; s.pin = { x: clamp(cx(c) - 20, 30, c.W - 30), y: clamp(cy(c) - 20, 30, c.H - 30) }; s.L0 = 50; s.Lmax = Math.min(c.W, c.H) * 0.36;
      const N = 26; s.pts = []; for (let i = 0; i < N; i++) { const k = i / (N - 1); const x = s.pin.x + (cx(c) - s.pin.x) * k, y = s.pin.y + (cy(c) - s.pin.y) * k; s.pts.push([x, y, x, y]); }
      play('thud', { vol: 0.6, rate: 2.2 }); s.st = 0; s.pinIn = 0; },
    mouse(e, m, dt) { const s = e.s, c = MH.ctx; const dx = cx(c) - s.pin.x, dy = cy(c) - s.pin.y; const L = Math.hypot(dx, dy) + 0.01;
      if (L > s.L0) { const pull = (L - s.L0) * 6.5; m.fx -= dx / L * pull; m.fy -= dy / L * pull; }
      let nx = cx(c) + m.dx + m.fx * dt, ny = cy(c) + m.dy + m.fy * dt; const nd = Math.hypot(nx - s.pin.x, ny - s.pin.y);
      if (nd > s.Lmax) { nx = s.pin.x + (nx - s.pin.x) / nd * s.Lmax; ny = s.pin.y + (ny - s.pin.y) / nd * s.Lmax; m.fx = 0; m.fy = 0; m.dx = nx - cx(c); m.dy = ny - cy(c); } },
    mouseEnd(e, m) { if (e.te < 0.22) { const c = MH.ctx; const dx = e.s.pin.x - cx(c), dy = e.s.pin.y - cy(c), L = Math.hypot(dx, dy) + 1; m.fx += dx / L * 1600; m.fy += dy / L * 1600; } },
    update(e, c, dt) { const s = e.s; const pts = s.pts, N = pts.length; s.pinIn = Math.min(1, s.pinIn + dt * 8);
      const end = { x: cx(c) + 2, y: cy(c) + 3 }; const L = Math.hypot(end.x - s.pin.x, end.y - s.pin.y);
      for (const p of pts) { const vx = (p[0] - p[2]) * 0.985, vy = (p[1] - p[3]) * 0.985; p[2] = p[0]; p[3] = p[1]; p[0] += vx; p[1] += vy + 700 * dt * dt; }
      const seg = Math.max(s.L0, L) / (N - 1) * 0.985;
      for (let it = 0; it < 10; it++) {
        pts[0][0] = s.pin.x; pts[0][1] = s.pin.y; if (!s.broken) { pts[N - 1][0] = end.x; pts[N - 1][1] = end.y; }
        for (let i = 1; i < N; i++) { if (s.broken && i === s.brk) continue; const a = pts[i - 1], b = pts[i]; const dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) + 1e-4; const diff = (d - seg) / d * 0.5;
          if (i - 1 > 0) { a[0] += dx * diff; a[1] += dy * diff; } else { b[0] -= dx * diff; b[1] -= dy * diff; continue; }
          b[0] -= dx * diff; b[1] -= dy * diff; } }
      if (s.broken) { pts[0][0] = s.pin.x; pts[0][1] = s.pin.y; }
      s.stretch = L / s.Lmax; s.st -= dt;
      if (!e.ending && s.stretch > 0.55 && s.st <= 0) { s.st = 0.7; play('band_stretch', { vol: 0.35 + s.stretch * 0.4, rate: 0.8 + s.stretch * 0.5, vary: 0.1 }); } },
    end(e) { const s = e.s; s.broken = true; s.brk = 4 + (Math.random() * (s.pts.length - 8) | 0); Sfx.snap({ vol: 1 }); play('pop', { vol: 0.5, rate: 0.6 });
      const p = s.pts; for (let i = s.brk; i < p.length; i++) { p[i][2] = p[i][0] - (p[i][0] - s.pin.x) * 0.08; p[i][3] = p[i][1] - (p[i][1] - s.pin.y) * 0.08; } },
    back(e) { const s = e.s; const th = 4.2 * Math.sqrt(1 / Math.max(1, (s.stretch || 0) * 3)); const a = e.ending ? Math.max(0, 1 - e.te / 1.2) : 1;
      if (!s.broken) Shapes.rope(s.pts.map(p => [p[0], p[1]]), th, [0.62, 0.43, 0.27], a);
      else { Shapes.rope(s.pts.slice(0, s.brk).map(p => [p[0], p[1]]), th * 1.3, [0.62, 0.43, 0.27], a); Shapes.rope(s.pts.slice(s.brk).map(p => [p[0], p[1]]), th * 1.3, [0.62, 0.43, 0.27], a); }
      Shapes.pin(s.pin.x, s.pin.y, 11 * ease(s.pinIn), a); },
  };

  // 20 ─ SOAP BUBBLE: the cursor gets trapped in a soap bubble that floats up, then pops
  E.bubble = {
    name: 'Soap Bubble', outro: 0.9,
    start(e, c) { const s = e.s; s.c = { x: cx(c) + 12, y: cy(c) + 14 }; s.v = { x: 0, y: 0 }; s.l = { x: cx(c) - s.c.x, y: cy(c) - s.c.y }; s.R = 0; s.wob = 1; s.seed = R(0, 9);
      play('bubbles', { vol: 0.6, dur: 1.4 }); },
    mouse(e, m) { const s = e.s; s.l.x += m.dx; s.l.y += m.dy; const lim = Math.max(4, s.R - 16); const d = Math.hypot(s.l.x, s.l.y);
      if (d > lim) { s.l.x *= lim / d; s.l.y *= lim / d; s.push = d - lim; } else s.push = 0;
      m.pin = { x: s.c.x + s.l.x, y: s.c.y + s.l.y }; },
    update(e, c, dt, time) { const s = e.s; const RM = Math.min(c.W, c.H) * 0.075;
      s.R = e.ending ? s.R : RM * ease(e.t / 0.5) * (1 + 0.08 * Math.sin(e.t * 9) * Math.exp(-e.t * 2));
      s.wob = Math.min(1, Math.max(0.35, s.wob - dt * 0.5) + Math.min(10, s.push || 0) * 0.01);
      if (!e.ending) { s.v.y += (-65 - s.v.y) * dt * 0.8; s.v.x = Math.sin(time * 0.7 + s.seed) * 45 + (s.push ? s.l.x * 0.5 : 0);
        s.c.x += s.v.x * dt; s.c.y += s.v.y * dt;
        if (s.c.y < s.R + 8) { s.c.y = s.R + 8; s.v.y = Math.abs(s.v.y) * 0.4; } s.c.x = clamp(s.c.x, s.R + 8, c.W - s.R - 8);
        c.timer(true, s.c.x, s.c.y + s.R + 22, e.dur - e.t); }
      s.pop = e.ending ? clamp(e.te / 0.12, 0, 1) : 0; },
    end(e, c) { const s = e.s; c.timer(false); play('bubble_pop', { vol: 1 }); play('pop', { vol: 0.4, rate: 1.4 });
      for (let k = 0; k < 90; k++) { const a = R(0, 6.28); Liquid.add(s.c.x + Math.cos(a) * s.R, s.c.y + Math.sin(a) * s.R, Math.cos(a) * R(100, 400), Math.sin(a) * R(100, 400) - 100, R(1.5, 2.8), Liquid.K.SOAP); } },
    front(e) { const s = e.s; if (!e.ending) Shapes.bubble({ b: [s.c.x, s.c.y, s.R], wob: s.wob, pop: 0, seed: s.seed }); },
  };

  return E;
})();
