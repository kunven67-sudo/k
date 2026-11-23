// Liquid drops (water, honey, lava, soap). Each drop is a small blob with physics: sticks to the cursor, slides to the
// tip, drips, falls, splashes on the taskbar and spreads into a puddle. Drawn as one connected surface that bends
// (refracts) the real screen behind it, with highlights.
'use strict';
const Liquid = (() => {
  const MAX = 7000;
  const K = { WATER: 0, HONEY: 1, LAVA: 2, SOAP: 3 };
  const PROPS = [ // gravity, air drag, viscosity, cohesion, stick to cursor, slide speed, splashy, evaporate/s
    { g: 1700, drag: 0.15, visc: 0.08, coh: 260, stick: 0.55, slide: 40, splash: 1, evap: 0.012 },
    { g: 1100, drag: 0.9, visc: 0.85, coh: 260, stick: 0.95, slide: 9, splash: 0.05, evap: 0.004 },
    { g: 1300, drag: 0.6, visc: 0.4, coh: 700, stick: 0.0, slide: 14, splash: 0.15, evap: 0.006 },
    { g: 1500, drag: 0.3, visc: 0.05, coh: 120, stick: 0.2, slide: 40, splash: 1, evap: 0.25 },
  ];
  const x = new Float32Array(MAX), y = new Float32Array(MAX), vx = new Float32Array(MAX), vy = new Float32Array(MAX),
    r = new Float32Array(MAX), kind = new Uint8Array(MAX), heat = new Float32Array(MAX), att = new Uint8Array(MAX),
    ox = new Float32Array(MAX), oy = new Float32Array(MAX), age = new Float32Array(MAX), floor = new Uint8Array(MAX);
  let n = 0, batch, prog, blur, thick2, thick, sw = 1920, sh = 1080, floorY = 1040, hooks = {};
  const CELL = 12; let gw = 0, gh = 0, head = null; const next = new Int32Array(MAX);
  // cursor shape mask (where drops can cling), set from the cursor picture
  let mask = null, mw = 0, mh = 0, mScale = 1, hot = [0, 0];
  function setMask(rgba, w, h, hx, hy, scale) {
    mw = w; mh = h; mScale = scale || 1; hot = [hx, hy]; mask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) mask[i] = rgba[i * 4 + 3] > 60 ? 1 : 0;
  }
  function inMask(lx, ly) { // local px relative to hotspot
    if (!mask) return lx > -2 && ly > -2 && ly < 18 && lx < ly * 0.6 + 2;
    const mx = Math.floor(lx / mScale + hot[0]), my = Math.floor(ly / mScale + hot[1]);
    return mx >= 0 && my >= 0 && mx < mw && my < mh && mask[my * mw + mx] === 1;
  }
  function init(w, h) {
    sw = w; sh = h; gw = Math.ceil(w / CELL) + 2; gh = Math.ceil(h / CELL) + 2; head = new Int32Array(gw * gh);
    thick = GLX.fbo(w * 0.5, h * 0.5); thick2 = GLX.fbo(w * 0.5, h * 0.5);
    if (!batch) {
      batch = GLX.batch(`in vec2 vUV; in vec4 vCol; in vec4 vPar; out vec4 o;
        void main(){ vec2 q=vUV*2.-1.; float d=dot(q,q); if(d>1.) discard; float g=exp(-d*3.2)-exp(-3.2); g/=1.-exp(-3.2);
          o=vec4(g, g*vCol.r, g*vCol.g, g*vCol.b); }`, MAX);
      blur = GLX.program(`in vec2 vUV; out vec4 o; uniform sampler2D uSrc; uniform vec2 uD;
        void main(){ o=texture(uSrc,vUV)*0.4+(texture(uSrc,vUV+uD)+texture(uSrc,vUV-uD))*0.24+(texture(uSrc,vUV+uD*2.)+texture(uSrc,vUV-uD*2.))*0.06; }`);
      prog = GLX.program(`in vec2 vUV; out vec4 o; uniform sampler2D uThick, uScreen; uniform vec2 uTx; uniform float uHasScreen, uTime2;
        vec3 envc(vec3 n){ float up=n.y*0.5+0.5; return mix(vec3(0.05,0.06,0.07), vec3(0.92,0.95,1.0), smoothstep(0.2,1.,up)); }
        void main(){ vec4 t=texture(uThick,vUV); float th=t.r; if(th<0.12) { o=vec4(0); return; }
          float hl=texture(uThick,vUV-vec2(uTx.x*2.,0)).r, hr=texture(uThick,vUV+vec2(uTx.x*2.,0)).r, hb=texture(uThick,vUV-vec2(0,uTx.y*2.)).r, ht=texture(uThick,vUV+vec2(0,uTx.y*2.)).r;
          float heat=t.g/max(th,1e-3), honey=t.b/max(th,1e-3), soap=t.a/max(th,1e-3);
          float h=sqrt(max(th-0.25,0.)); float edge=smoothstep(0.28,0.42,th);
          vec3 n=normalize(vec3((hl-hr)*1.6,(hb-ht)*1.6,0.5+h*0.5));
          vec2 ruv=vUV - n.xy*0.022*(0.6+h);
          vec3 bg = uHasScreen>0.5 ? texture(uScreen,ruv).rgb : vec3(0.25);
          vec3 absorb=mix(vec3(0.16,0.05,0.025), vec3(0.02,0.2,1.05), honey); absorb=mix(absorb, vec3(0.02), soap);
          vec3 col=bg*exp(-absorb*h*1.6);
          // caustic: light gathered on the side away from the light
          col += vec3(1.,0.98,0.92)*smoothstep(0.1,0.7,-dot(n.xy,vec2(-0.55,0.7)))*0.35*h*(1.-honey*0.5);
          vec3 L=normalize(vec3(-0.45,0.65,0.62)); vec3 H=normalize(L+vec3(0,0,1));
          float nh=max(dot(n,H),0.);
          float spec=pow(nh,180.)*3.2+pow(nh,28.)*0.22;
          float fres=pow(1.-clamp(n.z,0.,1.),2.6);
          col=mix(col, envc(n), fres*0.4);
          col*=1.-smoothstep(0.42,0.28,th)*mix(0.55,0.2,honey); // dark meniscus rim
          col+=spec;
          // lava: hot glowing liquid that crusts over as it cools
          if(heat>0.01){ float crust=smoothstep(0.75,0.15,heat); vec2 p=vUV*uRes;
            float cr=ridged(p*0.025+vec2(0,uTime2*0.05)); float crack=smoothstep(0.82,0.95,cr);
            vec3 hot=blackbody(0.55+heat*0.6)*(2.2+heat*5.);
            vec3 rock=vec3(0.06,0.05,0.045)*(0.5+fbm(p*0.08)) + spec*0.4;
            vec3 lava=mix(hot, rock + blackbody(0.5)*crack*1.6*smoothstep(0.,0.4,heat), crust);
            col=mix(col, lava, clamp(heat*3.,0.,1.)); }
          if(soap>0.05){ float tf=fbm(vUV*uRes*0.01+uTime2*0.2)*3.+h*4.; vec3 film=0.5+0.5*cos(6.283*(tf+vec3(0.,0.33,0.67)));
            col=mix(col, bg*0.92+film*0.25*fres+spec, soap); edge*=mix(1.,0.75,soap); }
          o=vec4(col*edge, edge); }`);
    }
  }
  function add(px, py, pvx, pvy, rad, k, o) {
    if (n >= MAX) return -1; const i = n++;
    x[i] = px; y[i] = py; vx[i] = pvx; vy[i] = pvy; r[i] = rad; kind[i] = k; heat[i] = o && o.heat || 0; att[i] = 0; age[i] = 0; floor[i] = 0;
    if (o && o.attach) { att[i] = 1; ox[i] = o.ox; oy[i] = o.oy; }
    return i;
  }
  function kill(i) { n--; if (i === n) return; x[i] = x[n]; y[i] = y[n]; vx[i] = vx[n]; vy[i] = vy[n]; r[i] = r[n]; kind[i] = kind[n]; heat[i] = heat[n]; att[i] = att[n]; ox[i] = ox[n]; oy[i] = oy[n]; age[i] = age[n]; floor[i] = floor[n]; }
  // cur = {x,y,vx,vy,ax,ay, on: bool (cursor exists), catchable}
  function update(dt, cur) {
    dt = Math.min(dt, 1 / 40);
    head.fill(-1);
    for (let i = 0; i < n; i++) { if (att[i]) continue; const cx = Math.max(0, Math.min(gw - 1, (x[i] / CELL | 0) + 1)), cy = Math.max(0, Math.min(gh - 1, (y[i] / CELL | 0) + 1)); const c = cy * gw + cx; next[i] = head[c]; head[c] = i; }
    const ca = cur ? Math.hypot(cur.ax, cur.ay) : 0;
    for (let i = n - 1; i >= 0; i--) {
      const P = PROPS[kind[i]]; age[i] += dt;
      if (kind[i] === K.LAVA) heat[i] = Math.max(0, heat[i] - dt * (floor[i] ? 0.11 : 0.05));
      if (att[i]) {
        if (!cur || !cur.on) { att[i] = 0; continue; }
        // slide down the cursor; fall off at the bottom edge, or when the cursor is yanked
        const step = P.slide * 0.35 * dt * (0.4 + Math.random()); oy[i] += step; ox[i] += (Math.random() - 0.5) * 6 * dt;
        const yank = ca > 9000 && Math.random() < (ca - 9000) / 40000 * (1.2 - P.stick);
        let off = !inMask(ox[i], oy[i]);
        if (off && !yank && Math.random() > dt * (0.9 + r[i] * 0.12)) { oy[i] -= step; off = false; } // hang on the edge, then drip
        if (off || yank) {
          att[i] = 0; x[i] = cur.x + ox[i]; y[i] = cur.y + oy[i]; vx[i] = cur.vx * 0.9; vy[i] = cur.vy * 0.9 + 20;
          if (hooks.drip && kind[i] === K.WATER && Math.random() < 0.08) hooks.drip(x[i], y[i]);
        } else { x[i] = cur.x + ox[i]; y[i] = cur.y + oy[i]; vx[i] = cur.vx; vy[i] = cur.vy; }
        continue;
      }
      vy[i] += P.g * dt;
      // neighbours: cohesion + push apart + viscosity
      const gx = (x[i] / CELL | 0) + 1, gy = (y[i] / CELL | 0) + 1; let ax = 0, ay = 0, avx = 0, avy = 0, cnt = 0;
      for (let yy = gy - 1; yy <= gy + 1; yy++) for (let xx = gx - 1; xx <= gx + 1; xx++) {
        if (xx < 0 || yy < 0 || xx >= gw || yy >= gh) continue;
        for (let j = head[yy * gw + xx]; j !== -1; j = next[j]) {
          if (j === i) continue; const dx = x[j] - x[i], dy = y[j] - y[i]; const d2 = dx * dx + dy * dy; const rr = (r[i] + r[j]) * 1.25;
          if (d2 > rr * rr || d2 < 1e-4) continue; const d = Math.sqrt(d2); const rest = (r[i] + r[j]) * 0.55;
          const f = d < rest ? -(rest - d) * 60 : P.coh * (d - rest) / rr; ax += dx / d * f; ay += dy / d * f;
          avx += vx[j]; avy += vy[j]; cnt++;
        }
      }
      vx[i] += ax * dt; vy[i] += ay * dt;
      if (cnt) { const k = Math.min(1, P.visc * 60 * dt); vx[i] += (avx / cnt - vx[i]) * k; vy[i] += (avy / cnt - vy[i]) * k; }
      const dr = Math.max(0, 1 - P.drag * dt); vx[i] *= dr; vy[i] *= dr;
      x[i] += vx[i] * dt; y[i] += vy[i] * dt;
      // land on the cursor and cling to it
      if (cur && cur.on && cur.catchable && P.stick > 0 && age[i] > 0.05) {
        const lx = x[i] - cur.x, ly = y[i] - cur.y;
        if (inMask(lx, ly) && Math.random() < P.stick) { att[i] = 1; ox[i] = lx; oy[i] = ly; continue; }
      }
      // taskbar = the floor: splash + puddle
      const fy = floorY - r[i] * 0.35;
      if (y[i] > fy) {
        const imp = vy[i]; y[i] = fy;
        if (imp > 380 && !floor[i] && P.splash > 0 && Math.random() < P.splash * 0.7) {
          const m = 1 + (Math.random() * 3 | 0);
          for (let s = 0; s < m && n < MAX; s++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2; const sp = imp * (0.25 + Math.random() * 0.35);
            add(x[i], fy - 2, Math.cos(a) * sp + vx[i] * 0.3, Math.sin(a) * sp, r[i] * (0.35 + Math.random() * 0.3), kind[i], { heat: heat[i] }); }
          r[i] *= 0.85; if (hooks.splash) hooks.splash(x[i], fy, imp, kind[i]);
        }
        if (!floor[i] && hooks.land) hooks.land(x[i], fy, imp, kind[i], heat[i]);
        vy[i] = imp > 0 ? -imp * 0.08 : vy[i]; vx[i] *= Math.exp(-7 * dt); floor[i] = 1;
      } else if (y[i] < fy - r[i] * 3) floor[i] = 0;
      if (x[i] < r[i]) { x[i] = r[i]; vx[i] = Math.abs(vx[i]) * 0.3; } if (x[i] > sw - r[i]) { x[i] = sw - r[i]; vx[i] = -Math.abs(vx[i]) * 0.3; }
      if (floor[i] || age[i] > 8) r[i] -= P.evap * dt * (floor[i] ? 2.2 : 1) * (hooks.dry || 1);
      if (r[i] < 1.2 || y[i] > sh + 200) kill(i);
    }
  }
  function draw(scene, screenTex, hasScreen, time) {
    if (!n) return;
    batch.reset();
    for (let i = 0; i < n; i++) {
      const k = kind[i]; const s = r[i] * 2.7;
      batch.push(x[i], y[i], s, s, k === K.LAVA ? Math.max(heat[i], 0.001) : 0, k === K.HONEY ? 1 : 0, k === K.SOAP ? 1 : 0, 1, 0);
    }
    GLX.clear(thick);
    batch.draw({}, thick, 'add', 0.5);
    GLX.pass(blur, { uSrc: thick, uD: [thick.texel[0] * 1.5, 0] }, thick2); GLX.pass(blur, { uSrc: thick2, uD: [0, thick.texel[1] * 1.5] }, thick);
    GLX.pass(prog, { uThick: thick, uScreen: screenTex, uTx: thick.texel, uHasScreen: hasScreen ? 1 : 0, uTime2: time }, scene, 'pm');
  }
  function detachAll() { for (let i = 0; i < n; i++) att[i] = 0; }
  function attachedCount() { let c = 0; for (let i = 0; i < n; i++) c += att[i]; return c; }
  return { K, init, add, update, draw, setMask, inMask, detachAll, attachedCount, get count() { return n; }, clear() { n = 0; },
    set floorY(v) { floorY = v; }, hooks };
})();
