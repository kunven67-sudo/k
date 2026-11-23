// Scene, the bent copy of the real screen, the fake cursor (their real cursor picture) and the final glow pass.
'use strict';
const Render = (() => {
  let W, H, scene, bloomA = [], bloomB = [], P = {}, screenTex, hasScreen = false, cursorTex, cursors = {}, cursorBatch;
  const SCREEN = { mask: 0, shake: [0, 0], flipX: 0, flipY: 0, zoom: 1, rot: 0, bh: [0, 0, 0, 0], waves: new Float32Array(16),
    heat: 0, drunk: [0, 0, 0], glitch: 0, glitchSeed: 0, tint: [1, 1, 1], tintAmt: 0, flash: [0, 0, 0], dark: 0, mirrorPivot: 0.5 };
  function init(w, h) {
    W = w; H = h; GLX.resize(w, h);
    scene = GLX.fbo(w, h);
    bloomA = []; bloomB = []; let bw = w / 2, bh = h / 2;
    for (let i = 0; i < 5; i++) { bloomA.push(GLX.fbo(bw, bh)); bloomB.push(GLX.fbo(bw, bh)); bw /= 2; bh /= 2; }
    if (!P.screen) compile();
    if (!screenTex) screenTex = GLX.texture(4, 4, { float: false });
  }
  function compile() {
    P.screen = GLX.program(`in vec2 vUV; out vec4 o; uniform sampler2D uScreen, uDye; uniform float uMask, uZoom, uRot, uHeat, uGlitch, uGlitchSeed, uTintAmt, uDark, uHasDye;
      uniform vec2 uShake, uFlip; uniform vec4 uBH; uniform vec4 uWaves[4]; uniform vec3 uDrunk, uTint, uFlash;
      vec3 S(vec2 uv){ return texture(uScreen, clamp(uv, vec2(0.0005), vec2(0.9995))).rgb; }
      void main(){
        vec2 px=vec2(vUV.x,1.-vUV.y)*uRes; float mask=uMask; vec2 p=px;
        // whole-screen moves: shake, zoom, tilt, mirror flips (as a 3D card turn)
        vec2 c=uRes*0.5; p=(p-c)/uZoom; p=vec2(p.x*cos(uRot)-p.y*sin(uRot), p.x*sin(uRot)+p.y*cos(uRot)); p+=c+uShake;
        float fx=uFlip.x, fy=uFlip.y; float sx=cos(fx*3.14159), sy=cos(fy*3.14159);
        if(abs(sx)<0.002||abs(sy)<0.002){ o=vec4(0,0,0,uMask); return; }
        p.x=c.x+(p.x-c.x)/sx; p.y=c.y+(p.y-c.y)/sy;
        if(fx>0.001&&fx<0.999){ float persp=1.+sin(fx*3.14159)*((px.x-c.x)/uRes.x)*0.5*sign(sx); p.y=c.y+(p.y-c.y)*persp; }
        if(fy>0.001&&fy<0.999){ float persp=1.+sin(fy*3.14159)*((px.y-c.y)/uRes.y)*0.5*sign(sy); p.x=c.x+(p.x-c.x)*persp; }
        bool outside = p.x<0.||p.y<0.||p.x>uRes.x||p.y>uRes.y;
        // black hole: bends light around it (point-mass lens)
        float hole=0.;
        if(uBH.z>0.){ vec2 d=px-uBH.xy; float r=length(d); float rs=uBH.z; float te=rs*2.2*uBH.w;
          p -= normalize(d+1e-4)*te*te/max(r,rs*0.5);
          mask=max(mask, smoothstep(rs*9.,rs*3.,r)); hole=smoothstep(rs*1.02,rs*0.96,r); }
        // shockwaves
        for(int i=0;i<4;i++){ vec4 w=uWaves[i]; if(w.w<=0.) continue; vec2 d=px-w.xy; float r=length(d); float band=(r-w.z)/(30.+w.z*0.08);
          float k=exp(-band*band*2.)*w.w; p-=normalize(d+1e-4)*k*40.; mask=max(mask, smoothstep(0.02,0.2,k)); }
        // heat shimmer above fire
        if(uHeat>0. && uHasDye>0.5){ vec2 u=vec2(px.x/uRes.x,1.-px.y/uRes.y); float t0=texture(uDye,u+vec2(0,-0.02)).r; float t1=texture(uDye,u+vec2(0,-0.06)).r; float tt=max(t0,t1);
          float m=smoothstep(0.03,0.2,tt)*uHeat; vec2 wob=vec2(vnoise(px*0.05+vec2(0,uTime*9.))-.5, vnoise(px*0.05+vec2(7.,uTime*8.))-.5);
          p+=wob*m*5.; mask=max(mask,m*0.999); }
        if(mask<0.002){ o=vec4(0); return; }
        vec2 uv=vec2(p.x/uRes.x, 1.-p.y/uRes.y);
        // digital glitch: torn slices, colour split, blocky corruption
        vec3 col;
        if(uGlitch>0.){ float row=floor(px.y/ (8.+hash12(vec2(uGlitchSeed,1.))*40.)); float tear=step(1.-uGlitch*0.3, hash12(vec2(row,uGlitchSeed)));
          uv.x += tear*(hash12(vec2(row,uGlitchSeed+3.))-.5)*0.25*uGlitch;
          vec2 blk=floor(px/vec2(32.,16.)); float bad=step(1.-uGlitch*0.08, hash12(blk+uGlitchSeed*1.7));
          vec2 buv=mix(uv, (floor(uv*vec2(60.,34.))+.5)/vec2(60.,34.), bad);
          float sp=0.008*uGlitch*(1.+tear*3.);
          col=vec3(S(buv+vec2(sp,0)).r, S(buv).g, S(buv-vec2(sp,0)).b);
          col=mix(col, 1.-col, bad*step(0.85,hash12(blk+uGlitchSeed)));
          col*=0.92+0.08*sin(px.y*3.14159);
          col+= (hash12(px+uTime)-.5)*0.1*uGlitch;
        } else col=S(uv);
        if(uDrunk.z>0.){ vec3 g=S(uv+uDrunk.xy/uRes*vec2(1,-1)); vec3 g2=S(uv-uDrunk.xy/uRes*vec2(0.6,-0.6));
          col=mix(col,(g+g2)*0.5,uDrunk.z*0.5); col=mix(col,(S(uv+vec2(0.003,0))+S(uv-vec2(0.003,0))+S(uv+vec2(0,0.003))+S(uv-vec2(0,0.003)))*.25,uDrunk.z*0.6); }
        if(outside) col=vec3(0.02);
        col=mix(col, col*uTint, uTintAmt);
        col*=1.-uDark; col+=uFlash;
        col*=1.-hole;
        o=vec4(col*mask, mask); }`);
    P.bright = GLX.program(`in vec2 vUV; out vec4 o; uniform sampler2D uSrc; void main(){ vec4 c=texture(uSrc,vUV); vec3 b=max(c.rgb-vec3(1.0),0.); o=vec4(b,0); }`);
    P.down = GLX.program(`in vec2 vUV; out vec4 o; uniform sampler2D uSrc; uniform vec2 uTx; void main(){ vec2 t=uTx;
      o=(texture(uSrc,vUV)*4.+texture(uSrc,vUV+t*vec2(1,1))+texture(uSrc,vUV+t*vec2(-1,1))+texture(uSrc,vUV+t*vec2(1,-1))+texture(uSrc,vUV+t*vec2(-1,-1)))/8.; }`);
    P.up = GLX.program(`in vec2 vUV; out vec4 o; uniform sampler2D uSrc, uBase; uniform vec2 uTx; void main(){ vec2 t=uTx;
      vec4 s=(texture(uSrc,vUV+vec2(-t.x*2.,0))+texture(uSrc,vUV+vec2(t.x*2.,0))+texture(uSrc,vUV+vec2(0,t.y*2.))+texture(uSrc,vUV+vec2(0,-t.y*2.))
       +(texture(uSrc,vUV+t)+texture(uSrc,vUV-t)+texture(uSrc,vUV+vec2(t.x,-t.y))+texture(uSrc,vUV+vec2(-t.x,t.y)))*2.)/12.;
      o=s+texture(uBase,vUV); }`);
    P.final = GLX.program(`in vec2 vUV; out vec4 o; uniform sampler2D uScene, uBloom; uniform float uBloomK;
      vec3 soft(vec3 c){ vec3 k=vec3(0.82); return mix(c, k+(1.-k)*(1.-exp(-(c-k)/(1.-k))), step(k,c)); }
      void main(){ vec4 s=texture(uScene,vUV); vec3 b=texture(uBloom,vUV).rgb*uBloomK;
        vec3 c=s.rgb+b; float a=clamp(s.a+dot(b,vec3(0.3,0.5,0.2))*0.9,0.,1.);
        c=soft(c); c=min(c,vec3(max(a,0.0001))*1.6); o=vec4(c,a); }`);
    // the cursor: their real cursor picture with burn / wet / frost / melt / glow / colour-split looks
    cursorBatch = GLX.batch(`in vec2 vUV; in vec4 vCol; in vec4 vPar; in vec4 vEx; in vec2 vPx; out vec4 o;
      uniform sampler2D uTex; uniform float uPad, uChar, uWet, uFrost, uMelt, uHeat, uSplit, uElec, uStretch; uniform vec4 uRect; // atlas rect
      vec4 T(vec2 suv){ if(suv.x<0.||suv.y<0.||suv.x>1.||suv.y>1.) return vec4(0); vec2 a=uRect.xy+suv*uRect.zw; return texture(uTex,vec2(a.x,1.-a.y)); }
      void main(){ vec2 suv=(vUV-uPad)/(1.-2.*uPad);
        float seedx=vEx.x;
        if(uMelt>0.){ float col=vnoise(vec2(suv.x*9.+seedx,0.)); float drip=pow(col,3.)*uMelt*0.9+uMelt*0.12; suv.y-=drip*smoothstep(0.,1.,suv.y);
          suv.x+=sin(suv.y*12.+uTime*2.)*0.015*uMelt; }
        vec4 c=T(suv);
        if(uSplit>0.){ float s=uSplit*0.06; c=vec4(T(suv+vec2(s,0)).r, c.g, T(suv-vec2(s,0)).b, max(c.a,max(T(suv+vec2(s,0)).a,T(suv-vec2(s,0)).a))); }
        vec3 rgb=c.a>0.?c.rgb/c.a:vec3(0); float a=c.a;
        vec2 p=suv*vec2(32.,32.)+seedx;
        if(uChar>0.){ float n=fbm(p*0.35); vec3 soot=vec3(0.035,0.03,0.028)*(0.6+n); rgb=mix(rgb,soot,smoothstep(0.1,0.9,uChar*(0.7+n*0.6)));
          float cr=smoothstep(0.86,0.97,ridged(p*0.25+uTime*0.15)); rgb+=blackbody(0.7)*cr*uChar*(2.+sin(uTime*9.+p.x)*0.8); }
        if(uHeat>0.){ rgb=mix(rgb, blackbody(0.35+uHeat*0.7)*(1.+uHeat*4.), smoothstep(0.,1.,uHeat)); }
        if(uFrost>0.){ float n=fbm(p*0.6); float cry=ridged(p*0.4); rgb=mix(rgb, mix(vec3(0.75,0.86,0.95),vec3(1.),cry), uFrost*smoothstep(0.3,0.9,n+cry*0.4)*0.85); rgb*=mix(vec3(1),vec3(0.82,0.92,1.08),uFrost); }
        if(uWet>0.){ float n=fbm(p*0.5+vec2(0,uTime*0.4)); float glint=smoothstep(0.62,0.7,n)*smoothstep(0.75,0.68,n);
          rgb=rgb*(1.-uWet*0.2)+vec3(0.9,0.95,1.)*glint*uWet*1.4; }
        if(uElec>0.){ float e=smoothstep(0.7,1.,ridged(p*0.3+uTime*20.)); rgb+=vec3(0.5,0.7,1.6)*e*uElec*3.; }
        a*=vCol.a;
        // outer glow halos (heat / electric) outside the picture
        float halo=0.; if(uHeat>0.||uElec>0.){ for(int i=0;i<6;i++){ float an=float(i)*1.047; halo=max(halo,T(suv+vec2(cos(an),sin(an))*0.09).a); } }
        vec3 glow=blackbody(0.5+uHeat*0.4)*uHeat*1.2*halo + vec3(0.35,0.55,1.4)*uElec*halo*(0.6+0.4*sin(uTime*50.));
        o=vec4(rgb*a*vCol.rgb + glow*(1.-a)*vCol.a, a); }`, 64);
  }
  function setScreen(img) { // {w,h,bgra} from the main process, or an <img>/<canvas> in tests
    hasScreen = !!img;
    if (!img) return;
    if (img.bgra) {
      const src = img.bgra instanceof Uint8Array ? img.bgra : new Uint8Array(img.bgra.buffer || img.bgra);
      const d = new Uint8Array(img.w * img.h * 4);
      for (let i = 0; i < d.length; i += 4) { d[i] = src[i + 2]; d[i + 1] = src[i + 1]; d[i + 2] = src[i]; d[i + 3] = 255; }
      GLX.upload(screenTex, d, img.w, img.h);
    } else GLX.upload(screenTex, img);
  }
  // cursor pictures: {key:{w,h,hx,hy,rgba(Uint8Array)}} packed side by side in one texture
  function setCursors(pics) {
    const keys = Object.keys(pics); if (!keys.length) return;
    let aw = 0, ah = 0; keys.forEach(k => { aw += pics[k].w + 4; ah = Math.max(ah, pics[k].h); });
    const data = new Uint8Array(aw * ah * 4); let ox = 0; cursors = {};
    keys.forEach(k => { const c = pics[k];
      for (let yy = 0; yy < c.h; yy++) for (let xx = 0; xx < c.w; xx++) { const s = (yy * c.w + xx) * 4, d = (yy * aw + ox + xx) * 4;
        const a = c.rgba[s + 3] / 255; data[d] = c.rgba[s] * a; data[d + 1] = c.rgba[s + 1] * a; data[d + 2] = c.rgba[s + 2] * a; data[d + 3] = c.rgba[s + 3]; }
      cursors[k] = { w: c.w, h: c.h, hx: c.hx, hy: c.hy, rect: [ox / aw, 0, c.w / aw, c.h / ah], rgba: c.rgba }; ox += c.w + 4; });
    cursorTex = cursorTex || GLX.texture(4, 4, { float: false });
    GLX.upload(cursorTex, data, aw, ah, { flip: false });
    // texture rows: row 0 = top. Shader samples (a.x, 1-a.y), so flip rect.y space accordingly
    const g = GLX.gl; g.bindTexture(g.TEXTURE_2D, cursorTex);
    const flipped = new Uint8Array(data.length); const row = aw * 4;
    for (let yy = 0; yy < ah; yy++) flipped.set(data.subarray(yy * row, yy * row + row), (ah - 1 - yy) * row);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, aw, ah, 0, g.RGBA, g.UNSIGNED_BYTE, flipped);
  }
  function cursorInfo(key) { return cursors[key] || cursors.arrow; }
  // draw one or more cursors. list: [{x,y,key,scale,rot,alpha,sx,sy}], look: {char,wet,frost,melt,heat,split,elec}
  function drawCursors(list, look, tgt) {
    look = look || {};
    const groups = {};
    list.forEach(c => { const k = cursors[c.key] ? c.key : 'arrow'; (groups[k] = groups[k] || []).push(c); });
    for (const k in groups) {
      const ci = cursors[k]; if (!ci) continue; const pad = 0.3;
      cursorBatch.reset();
      groups[k].forEach(c => {
        const sc = c.scale || 1, sx = (c.sx || 1) * sc, sy = (c.sy || 1) * sc; const qw = ci.w / (1 - 2 * pad) * sx, qh = ci.h / (1 - 2 * pad) * sy;
        // rotate around the hotspot
        const cxl = (ci.w / 2 - ci.hx) * sx, cyl = (ci.h / 2 - ci.hy) * sy, r = c.rot || 0;
        const cx = c.x + cxl * Math.cos(r) - cyl * Math.sin(r), cy = c.y + cxl * Math.sin(r) + cyl * Math.cos(r);
        const tint = c.tint || [1, 1, 1];
        cursorBatch.push(cx, cy, qw, qh, tint[0], tint[1], tint[2], c.alpha == null ? 1 : c.alpha, r, 0, 0, 0, c.seed || 0);
      });
      cursorBatch.draw({ uTex: cursorTex, uPad: pad, uRect: ci.rect, uChar: look.char || 0, uWet: look.wet || 0, uFrost: look.frost || 0,
        uMelt: look.melt || 0, uHeat: look.heat || 0, uSplit: look.split || 0, uElec: look.elec || 0 }, tgt || scene, 'pm');
    }
  }
  function screenPass(dyeTex) {
    const s = SCREEN;
    const need = s.mask > 0 || s.bh[2] > 0 || s.heat > 0 || s.waves.some((v, i) => i % 4 === 3 && v > 0);
    if (!need || !hasScreen) { s.lastDrawn = false; return; }
    GLX.pass(P.screen, { uScreen: screenTex, uDye: dyeTex || screenTex, uHasDye: dyeTex ? 1 : 0, uMask: s.mask, uZoom: s.zoom, uRot: s.rot, uHeat: s.heat,
      uGlitch: s.glitch, uGlitchSeed: s.glitchSeed, uTintAmt: s.tintAmt, uDark: s.dark, uShake: s.shake, uFlip: [s.flipX, s.flipY],
      uBH: s.bh, uWaves: s.waves, uDrunk: s.drunk, uTint: s.tint, uFlash: s.flash }, scene, 'pm');
  }
  function begin() { GLX.clear(scene); }
  function finish() {
    GLX.pass(P.bright, { uSrc: scene }, bloomA[0]);
    for (let i = 1; i < bloomA.length; i++) GLX.pass(P.down, { uSrc: bloomA[i - 1], uTx: bloomA[i - 1].texel }, bloomA[i]);
    let cur = bloomA[bloomA.length - 1];
    for (let i = bloomA.length - 2; i >= 0; i--) { GLX.pass(P.up, { uSrc: cur, uBase: bloomA[i], uTx: cur.texel }, bloomB[i]); cur = bloomB[i]; }
    GLX.pass(P.final, { uScene: scene, uBloom: cur, uBloomK: 0.6 }, null);
  }
  function resetScreen() { const s = SCREEN; s.mask = 0; s.shake = [0, 0]; s.flipX = 0; s.flipY = 0; s.zoom = 1; s.rot = 0; s.bh = [0, 0, 0, 0]; s.waves.fill(0);
    s.heat = 0; s.drunk = [0, 0, 0]; s.glitch = 0; s.tintAmt = 0; s.tint = [1, 1, 1]; s.flash = [0, 0, 0]; s.dark = 0; }
  return { init, setScreen, setCursors, cursorInfo, drawCursors, screenPass, begin, finish, resetScreen, SCREEN,
    get scene() { return scene; }, get screenTex() { return screenTex; }, get hasScreen() { return hasScreen; }, get cursorTex() { return cursorTex; }, get cursors() { return cursors; } };
})();
