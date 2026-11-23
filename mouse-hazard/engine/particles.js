// CPU particles drawn as instanced quads: embers, sparks, snow, dust, debris, smoke, mist, glints.
'use strict';
const Parts = (() => {
  const MAX = 24000;
  const T = { EMBER: 0, SPARK: 1, SNOW: 2, DUST: 3, DEBRIS: 4, SMOKE: 5, MIST: 6, GLINT: 7, DROPLET: 8 };
  const x = new Float32Array(MAX), y = new Float32Array(MAX), vx = new Float32Array(MAX), vy = new Float32Array(MAX),
    life = new Float32Array(MAX), max = new Float32Array(MAX), size = new Float32Array(MAX), type = new Uint8Array(MAX),
    rot = new Float32Array(MAX), vr = new Float32Array(MAX), seed = new Float32Array(MAX), heat = new Float32Array(MAX),
    cr = new Float32Array(MAX), cg = new Float32Array(MAX), cb = new Float32Array(MAX), ca = new Float32Array(MAX), depth = new Float32Array(MAX),
    flag = new Uint8Array(MAX);
  let n = 0, batchAdd, batchPm, floorY = 1e9, screenW = 1920, wind = 0, onSnowLand = null, onFloorHit = null, snowCatch = null;
  const FS = `in vec2 vUV; in vec4 vCol; in vec4 vPar; in vec4 vEx; in vec2 vPx; out vec4 o;
    void main(){ vec2 q=vUV*2.-1.; int t=int(vPar.y+.5); float seed=vPar.z; float heat=vPar.w; float lf=vEx.x;
      if(t==0||t==1){ // glowing streak, quad stretched along motion
        float w=exp(-q.y*q.y*3.5); float l=smoothstep(1.,.2,abs(q.x)); float a=w*l;
        vec3 c=blackbody(heat)*(1.5+heat*5.)*vCol.a; o=vec4(c*a, a*0.15*vCol.a); return; }
      if(t==2){ float r=length(q); float a=smoothstep(1.,0.25+vEx.y*0.5,r); a*=vCol.a; o=vec4(vCol.rgb*a,a); return; }
      if(t==3||t==5||t==6){ float r=length(q); float n=fbm(q*1.6+seed*7.13+vec2(lf*0.7,-lf*0.3));
        float a=smoothstep(1.,0.,r+ (n-.5)*0.9)*smoothstep(0.,0.6,n+0.25); a*=vCol.a; o=vec4(vCol.rgb*a,a); return; }
      if(t==4){ vec2 p=q; float n=fbm(p*1.3+seed*3.1); float d=length(p)+ (n-.5)*0.9; float a=smoothstep(0.85,0.7,d)*vCol.a;
        float sh=0.65+0.35*dot(normalize(vec2(-0.6,0.8)),p); o=vec4(vCol.rgb*sh*a,a); return; }
      if(t==7){ float r=length(q); float cross=exp(-abs(q.x)*14.)*exp(-abs(q.y)*1.5)+exp(-abs(q.y)*14.)*exp(-abs(q.x)*1.5);
        float a=(exp(-r*r*14.)+cross*0.5)*vCol.a; o=vec4(vCol.rgb*a*3., a*0.3); return; }
      if(t==8){ float r=length(q); float a=smoothstep(1.,.6,r)*vCol.a; vec3 c=vCol.rgb*(0.6+0.5*smoothstep(.2,-.6,q.y+q.x*.3)); c+=vec3(1.)*exp(-dot(q-vec2(-.3,-.35),q-vec2(-.3,-.35))*18.)*0.9;
        o=vec4(c*a,a); return; }
      o=vec4(0); }`;
  function init() { batchAdd = GLX.batch(FS, MAX); batchPm = GLX.batch(FS, MAX); }
  function spawn(t, px, py, pvx, pvy, lifeS, sz, col, o) {
    if (n >= MAX) return -1; const i = n++;
    x[i] = px; y[i] = py; vx[i] = pvx; vy[i] = pvy; life[i] = 0; max[i] = lifeS; size[i] = sz; type[i] = t;
    rot[i] = o && o.rot || Math.random() * 6.28; vr[i] = o && o.vr != null ? o.vr : (Math.random() - 0.5) * 6; seed[i] = Math.random() * 100;
    heat[i] = o && o.heat != null ? o.heat : 1; depth[i] = o && o.depth != null ? o.depth : 1; flag[i] = 0;
    cr[i] = col ? col[0] : 1; cg[i] = col ? col[1] : 1; cb[i] = col ? col[2] : 1; ca[i] = col ? col[3] : 1;
    return i;
  }
  function kill(i) { n--; if (i === n) return;
    x[i] = x[n]; y[i] = y[n]; vx[i] = vx[n]; vy[i] = vy[n]; life[i] = life[n]; max[i] = max[n]; size[i] = size[n]; type[i] = type[n];
    rot[i] = rot[n]; vr[i] = vr[n]; seed[i] = seed[n]; heat[i] = heat[n]; cr[i] = cr[n]; cg[i] = cg[n]; cb[i] = cb[n]; ca[i] = ca[n]; depth[i] = depth[n]; flag[i] = flag[n]; }
  function update(dt, time) {
    for (let i = n - 1; i >= 0; i--) {
      life[i] += dt; if (life[i] >= max[i]) { kill(i); continue; }
      const t = type[i];
      if (t === 0) { // ember: rises, flutters, cools
        vy[i] -= 140 * dt; vx[i] += (Math.sin(time * 7 + seed[i]) * 90 + wind * 0.5) * dt; vx[i] *= 1 - 1.4 * dt; vy[i] *= 1 - 1.1 * dt; heat[i] = Math.max(0, heat[i] - dt * 0.55);
      } else if (t === 1) { // spark: falls, bounces
        vy[i] += 1300 * dt; vx[i] *= 1 - 0.6 * dt; heat[i] = Math.max(0, heat[i] - dt * 1.2);
        if (y[i] > floorY && vy[i] > 0) { y[i] = floorY; vy[i] *= -0.35; vx[i] *= 0.6; }
      } else if (t === 2) { // snow
        const d = depth[i]; vx[i] += ((wind + Math.sin(time * 1.3 + seed[i]) * 40) * d - vx[i]) * 2 * dt; vy[i] += (70 + 90 * d - vy[i]) * 1.5 * dt;
        if (snowCatch && d > 0.75 && snowCatch(i, x[i], y[i])) { kill(i); continue; }
        if (y[i] > floorY - 2 && d > 0.6) { if (onSnowLand) onSnowLand(x[i], size[i]); kill(i); continue; }
      } else if (t === 3) { vx[i] *= 1 - 1.2 * dt; vy[i] *= 1 - 1.2 * dt; vy[i] -= 8 * dt; size[i] += dt * 30; }
      else if (t === 4) { vy[i] += 1500 * dt; rot[i] += vr[i] * dt; if (y[i] > floorY && vy[i] > 0) { y[i] = floorY; vy[i] *= -0.3; vx[i] *= 0.5; vr[i] *= 0.5; if (onFloorHit && Math.abs(vy[i]) > 120) onFloorHit(x[i], 'debris'); } }
      else if (t === 5) { vy[i] -= 40 * dt; vx[i] += wind * 0.3 * dt; vx[i] *= 1 - 0.8 * dt; vy[i] *= 1 - 0.6 * dt; size[i] += dt * 40; }
      else if (t === 6) { vy[i] += 25 * dt; vx[i] *= 1 - 1 * dt; vy[i] *= 1 - 0.8 * dt; size[i] += dt * 22; }
      else if (t === 7) { vy[i] += 1500 * dt; vx[i] *= 1 - 0.4 * dt; if (y[i] > floorY && vy[i] > 0) { y[i] = floorY; vy[i] *= -0.4; vx[i] *= 0.6; } }
      else if (t === 8) { vy[i] += 1600 * dt; if (y[i] > floorY) { kill(i); continue; } }
      x[i] += vx[i] * dt; y[i] += vy[i] * dt;
      if (x[i] < -200 || x[i] > screenW + 200 || y[i] < -400 || y[i] > floorY + 400) { kill(i); continue; }
    }
  }
  function draw(tgt) {
    batchAdd.reset(); batchPm.reset();
    for (let i = 0; i < n; i++) {
      const t = type[i], lf = life[i] / max[i];
      const fade = Math.min(1, lf * 8) * (1 - Math.pow(lf, 3));
      if (t === 0 || t === 1) {
        const sp = Math.hypot(vx[i], vy[i]); const len = Math.max(size[i] * 1.2, Math.min(sp * (t === 1 ? 0.045 : 0.03), 60)) ;
        batchAdd.push(x[i], y[i], len, size[i], cr[i], cg[i], cb[i], ca[i] * fade, Math.atan2(vy[i], vx[i]), t, seed[i], heat[i], lf);
      } else if (t === 7) batchAdd.push(x[i], y[i], size[i], size[i], cr[i], cg[i], cb[i], ca[i] * (1 - lf) * (0.5 + 0.5 * Math.sin(life[i] * 30 + seed[i])), 0, t, seed[i], 0, lf);
      else {
        let a = ca[i] * fade; if (t === 3 || t === 5 || t === 6) a = ca[i] * Math.min(1, lf * 5) * (1 - lf);
        batchPm.push(x[i], y[i], size[i], size[i], cr[i], cg[i], cb[i], a, rot[i], t, seed[i], heat[i], lf, 1 - depth[i]);
      }
    }
    batchPm.draw({}, tgt, 'pm'); batchAdd.draw({}, tgt, 'pm');
  }
  return { T, init, spawn, makeBatch: m => GLX.batch(FS, m), update, draw, get count() { return n; }, clear() { n = 0; },
    set floorY(v) { floorY = v; }, set screenW(v) { screenW = v; }, set wind(v) { wind = v; }, get wind() { return wind; },
    set onSnowLand(f) { onSnowLand = f; }, set onFloorHit(f) { onFloorHit = f; }, set snowCatch(f) { snowCatch = f; } };
})();
