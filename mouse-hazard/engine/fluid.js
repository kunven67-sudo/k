// Real fluid simulation on the graphics card (Navier-Stokes). Used for fire, smoke and explosions.
// dye channels: r = heat, g = smoke, b = fuel.
'use strict';
const Fluid = (() => {
  let vel, dye, pres, div, curl, ready = false, SW, SH, VW, VH, DW, DH, cell, active = 0;
  let P = {};
  const opts = { velScale: 0.25, dyeScale: 0.5 };
  function init(sw, sh, quality) {
    SW = sw; SH = sh;
    const vs = quality < 1 ? 0.18 : opts.velScale, ds = quality < 1 ? 0.35 : opts.dyeScale;
    VW = Math.round(sw * vs); VH = Math.round(sh * vs); DW = Math.round(sw * ds); DH = Math.round(sh * ds);
    cell = sw / VW;
    vel = GLX.double(VW, VH); pres = GLX.double(VW, VH); div = GLX.fbo(VW, VH); curl = GLX.fbo(VW, VH);
    dye = GLX.double(DW, DH);
    if (!ready) compileAll();
    ready = true;
  }
  function compileAll() {
    P.advect = GLX.program(`in vec2 vUV; out vec4 o; uniform sampler2D uVel, uSrc; uniform vec2 uScreen; uniform float uDt, uDiss;
      void main(){ vec2 v=texture(uVel,vUV).xy; vec2 c=vUV - uDt*v/uScreen; o=texture(uSrc,c)*uDiss; }`);
    P.advectDye = GLX.program(`in vec2 vUV; out vec4 o; uniform sampler2D uVel, uSrc; uniform vec2 uScreen; uniform float uDt;
      uniform vec4 uDiss; // per channel decay per second
      void main(){ vec2 v=texture(uVel,vUV).xy; vec2 c=vUV - uDt*v/uScreen; vec4 d=texture(uSrc,c);
        float T=d.r, S=d.g, F=d.b;
        float burn = T>0.18 ? min(F, 3.2*uDt*(0.4+T)) : 0.;
        T += burn*0.9; F -= burn; S += burn*0.8;
        T -= uDt*(uDiss.x*T + 0.55*T*T*T);
        S *= exp(-uDiss.y*uDt); F *= exp(-uDiss.z*uDt);
        o=vec4(max(T,0.),max(S,0.),max(F,0.),d.a*exp(-uDiss.w*uDt)); }`);
    P.curl = GLX.program(`in vec2 vUV; out vec4 o; uniform sampler2D uVel; uniform vec2 uTx; uniform float uCell;
      void main(){ float L=texture(uVel,vUV-vec2(uTx.x,0)).y, R=texture(uVel,vUV+vec2(uTx.x,0)).y, B=texture(uVel,vUV-vec2(0,uTx.y)).x, T=texture(uVel,vUV+vec2(0,uTx.y)).x;
        o=vec4(((R-L)-(T-B))*0.5/uCell,0,0,1); }`);
    P.force = GLX.program(`in vec2 vUV; out vec4 o; uniform sampler2D uVel, uCurl, uDye; uniform vec2 uTx; uniform float uCell, uDt, uVort, uBuoy, uWeight, uDamp;
      uniform vec2 uWind; uniform float uSwirlR; uniform vec3 uSwirl; uniform vec2 uScreen;
      void main(){ float L=abs(texture(uCurl,vUV-vec2(uTx.x,0)).x), R=abs(texture(uCurl,vUV+vec2(uTx.x,0)).x), B=abs(texture(uCurl,vUV-vec2(0,uTx.y)).x), T=abs(texture(uCurl,vUV+vec2(0,uTx.y)).x);
        float C=texture(uCurl,vUV).x; vec2 f=0.5*vec2(T-B, R-L)/uCell; f/=length(f)+1e-5; f*=uVort*C*vec2(1,-1);
        vec2 v=texture(uVel,vUV).xy; vec4 d=texture(uDye,vUV);
        v += f*uDt; v.y += (d.r*uBuoy - d.g*uWeight)*uDt; v += uWind*uDt*(0.2+d.g);
        if(uSwirl.z>0.){ vec2 px=vec2(vUV.x,1.-vUV.y)*uScreen; vec2 q=px-uSwirl.xy; float r=length(q)+1.; vec2 tg=vec2(-q.y,q.x)/r; tg.y=-tg.y; vec2 inw=-q/r; inw.y=-inw.y;
          float k=exp(-r/uSwirlR); v += (tg*uSwirl.z + inw*uSwirl.z*0.35)*k*uDt; }
        o=vec4(v*uDamp,0,1); }`);
    P.div = GLX.program(`in vec2 vUV; out vec4 o; uniform sampler2D uVel; uniform vec2 uTx; uniform float uCell;
      void main(){ float L=texture(uVel,vUV-vec2(uTx.x,0)).x, R=texture(uVel,vUV+vec2(uTx.x,0)).x, B=texture(uVel,vUV-vec2(0,uTx.y)).y, T=texture(uVel,vUV+vec2(0,uTx.y)).y;
        vec2 c=texture(uVel,vUV).xy; if(vUV.x-uTx.x<0.) L=-c.x; if(vUV.x+uTx.x>1.) R=-c.x; if(vUV.y-uTx.y<0.) B=-c.y; if(vUV.y+uTx.y>1.) T=-c.y;
        o=vec4(0.5*(R-L+T-B)/uCell,0,0,1); }`);
    P.jacobi = GLX.program(`in vec2 vUV; out vec4 o; uniform sampler2D uP, uDiv; uniform vec2 uTx; uniform float uCell;
      void main(){ float L=texture(uP,vUV-vec2(uTx.x,0)).x, R=texture(uP,vUV+vec2(uTx.x,0)).x, B=texture(uP,vUV-vec2(0,uTx.y)).x, T=texture(uP,vUV+vec2(0,uTx.y)).x;
        float d=texture(uDiv,vUV).x; o=vec4((L+R+B+T-d*uCell*uCell)*0.25,0,0,1); }`);
    P.grad = GLX.program(`in vec2 vUV; out vec4 o; uniform sampler2D uP, uVel; uniform vec2 uTx; uniform float uCell;
      void main(){ float L=texture(uP,vUV-vec2(uTx.x,0)).x, R=texture(uP,vUV+vec2(uTx.x,0)).x, B=texture(uP,vUV-vec2(0,uTx.y)).x, T=texture(uP,vUV+vec2(0,uTx.y)).x;
        vec2 v=texture(uVel,vUV).xy - 0.5*vec2(R-L,T-B)/uCell; o=vec4(v,0,1); }`);
    P.scale = GLX.program(`in vec2 vUV; out vec4 o; uniform sampler2D uSrc; uniform float uK; void main(){ o=texture(uSrc,vUV)*uK; }`);
    P.splat = GLX.program(`in vec2 vUV; out vec4 o; uniform sampler2D uSrc; uniform vec2 uPt, uScreen; uniform float uR, uRadial, uNoise, uSeed; uniform vec4 uVal; uniform vec2 uStretch;
      void main(){ vec2 px=vec2(vUV.x,1.-vUV.y)*uScreen; vec2 d=(px-uPt)/uStretch; float g=exp(-dot(d,d)/(uR*uR));
        if(uNoise>0.) g*=mix(1., fbm(px*0.045+uSeed)*1.8, uNoise);
        vec4 add=uVal*g; if(uRadial!=0.){ vec2 n=normalize(d+1e-4); add.xy+=vec2(n.x,-n.y)*uRadial*g; }
        o=texture(uSrc,vUV)+add; }`);
    // emits along a sprite's shape (the cursor): adds heat+fuel where the picture is, flickering with noise
    P.emitShape = GLX.batch(`in vec2 vUV; in vec4 vCol; in vec4 vPar; in vec4 vEx; in vec2 vPx; out vec4 o; uniform sampler2D uTex; uniform float uPad; uniform vec4 uRect;
      void main(){ vec2 suv=(vUV-uPad)/(1.-2.*uPad); float a=0.;
        for(int i=0;i<8;i++){ float an=float(i)*0.785; vec2 off=vec2(cos(an),sin(an))*0.06; vec2 s=suv+off; if(s.x>0.&&s.x<1.&&s.y>0.&&s.y<1.){ vec2 q=uRect.xy+s*uRect.zw; a=max(a,texture(uTex,vec2(q.x,1.-q.y)).a); } }
        float n=fbm(vPx*0.09+vec2(0,-uTime*6.)+vEx.x); n=smoothstep(0.35,0.85,n);
        o=vCol*a*n; }`, 64);
  }
  function step(dt, f) {
    if (!ready || active <= 0) return;
    f = f || {};
    dt = Math.min(dt, 1 / 30);
    const scr = [SW, SH];
    GLX.pass(P.curl, { uVel: vel.read, uTx: vel.texel, uCell: cell }, curl);
    GLX.pass(P.force, { uVel: vel.read, uCurl: curl, uDye: dye.read, uTx: vel.texel, uCell: cell, uDt: dt, uVort: f.vort ?? 32,
      uBuoy: f.buoy ?? 900, uWeight: f.weight ?? 40, uDamp: f.damp ?? 0.995, uWind: f.wind || [0, 0], uSwirlR: f.swirlR || 200, uSwirl: f.swirl || [0, 0, 0], uScreen: scr }, vel.write); vel.swap();
    GLX.pass(P.div, { uVel: vel.read, uTx: vel.texel, uCell: cell }, div);
    GLX.pass(P.scale, { uSrc: pres.read, uK: 0.8 }, pres.write); pres.swap();
    for (let i = 0; i < (f.iters || 18); i++) { GLX.pass(P.jacobi, { uP: pres.read, uDiv: div, uTx: vel.texel, uCell: cell }, pres.write); pres.swap(); }
    GLX.pass(P.grad, { uP: pres.read, uVel: vel.read, uTx: vel.texel, uCell: cell }, vel.write); vel.swap();
    GLX.pass(P.advect, { uVel: vel.read, uSrc: vel.read, uScreen: scr, uDt: dt, uDiss: 0.996 }, vel.write); vel.swap();
    GLX.pass(P.advectDye, { uVel: vel.read, uSrc: dye.read, uScreen: scr, uDt: dt, uDiss: f.diss || [0.55, 0.32, 0.4, 1.0] }, dye.write); dye.swap();
  }
  // x,y in screen pixels (y down). val = [heat, smoke, fuel, extra]. vel = [vx, vy] screen px/s
  function splat(x, y, r, val, vel2, o) {
    if (!ready) return; o = o || {};
    const scr = [SW, SH];
    if (val) { GLX.pass(P.splat, { uSrc: dye.read, uPt: [x, y], uScreen: scr, uR: r, uVal: val, uRadial: 0, uNoise: o.noise || 0, uSeed: Math.random() * 100, uStretch: o.stretch || [1, 1] }, dye.write); dye.swap(); }
    if (vel2 || o.radial) { GLX.pass(P.splat, { uSrc: vel.read, uPt: [x, y], uScreen: scr, uR: o.vr || r, uVal: vel2 ? [vel2[0], -vel2[1], 0, 0] : [0, 0, 0, 0], uRadial: o.radial || 0, uNoise: 0, uSeed: 0, uStretch: o.stretch || [1, 1] }, vel.write); vel.swap(); }
  }
  function emitShape(tex, rect, pad, cx, cy, w, h, rot, val) { // quad in screen px
    if (!ready) return;
    P.emitShape.reset(); P.emitShape.push(cx, cy, w, h, val[0], val[1], val[2], 0, rot, 0, 0, 0, Math.random() * 50);
    P.emitShape.draw({ uTex: tex, uRect: rect, uPad: pad, uScreen: [SW, SH] }, dye.read, 'add', DW / SW);
  }
  function clear() { if (!ready) return; [vel.read, vel.write, dye.read, dye.write, pres.read, pres.write].forEach(t => GLX.clear(t)); }
  return { init, step, splat, emitShape, clear, get dye() { return dye && dye.read; }, get vel() { return vel && vel.read; },
    use(n) { active += n; if (active <= 0) { active = 0; } }, get active() { return active; }, set active(v) { active = v; } };
})();
