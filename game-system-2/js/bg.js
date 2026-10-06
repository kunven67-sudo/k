/* Game System 2.0 — animated WebGL background.
   Modes: 'insane' (neon grid + sun + nebula + stars), 'chill' (nebula + stars, slower), 'off'.
   It pauses itself while a game is running or the tab is hidden, and lowers its resolution
   automatically if the computer is struggling, so it never makes games lag. */
(function () {
  'use strict';

  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  /* scenes: 0 synthwave (sun + grid), 1 hacker code rain, 2 lava + embers, 3 snow + aurora, 4 galaxy, 5 ocean waves */
  var FS = [
    'precision mediump float;',
    'uniform vec2 uRes;uniform float uTime;uniform vec3 uA;uniform vec3 uB;uniform vec2 uMouse;uniform float uMode;uniform float uScene;uniform vec3 uBase;',
    'float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);',
    ' return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}',
    'vec3 stars(vec2 p,float t,float k){vec2 sg=p*55.;vec2 si=floor(sg);float sh=hash(si);',
    ' return vec3(.85,.9,1.)*k*step(.982,sh)*smoothstep(.09,0.,length(fract(sg)-.5))*(.55+.45*sin(t*1.7+sh*50.));}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/uRes;',
    ' vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;',
    ' p+=uMouse*.025;',
    ' float t=uTime;',
    ' vec3 col=uBase;',
    ' float sp=uMode>.5?1.:.55;',
    ' if(uScene<.5){',
    '  float n=fbm(p*1.5+vec2(t*.018,-t*.012)*sp);',
    '  float n2=fbm(p*2.8-vec2(t*.026,t*.01)*sp+n*1.4);',
    '  col+=uA*pow(n2,3.2)*.75;',
    '  col+=uB*pow(fbm(p*2.1+vec2(-t*.011,t*.017)*sp+3.),4.)*.65;',
    '  col+=stars(p,t,1.);',
    '  if(uMode>.5){',
    '   float hz=-.1;',
    '   vec2 sc=p-vec2(0.,hz+.2);float sr=length(sc);',
    '   float sun=smoothstep(.25,.245,sr);',
    '   float band=step(.5,fract((p.y-hz)*28.-t*.6));',
    '   float cut=mix(1.,band,smoothstep(.24,.0,p.y-hz));',
    '   vec3 sunc=mix(uB,uA,clamp((p.y-hz)/.42,0.,1.));',
    '   if(p.y>hz)col=mix(col,sunc*.9,sun*cut*.55);',
    '   col+=sunc*.22*exp(-max(sr-.25,0.)*9.)*step(hz,p.y);',
    '   if(p.y<hz){',
    '    float d=hz-p.y;',
    '    vec2 g=vec2(p.x/d,1./d);g.y+=t*.9;',
    '    float px=1./uRes.y;',
    '    vec2 w=vec2(px/d,px/(d*d))*1.6;',
    '    vec2 ld=.5-abs(fract(g)-.5);',
    '    vec2 l=1.-smoothstep(vec2(0.),w,ld);',
    '    float grid=max(l.x,l.y);',
    '    float fade=smoothstep(0.,.32,d);',
    '    col=col*.35+uA*grid*fade*.6+uA*.04*fade+uB*.07*(1.-fade);',
    '   }',
    '   col+=uB*.55*exp(-abs(p.y-hz)*55.)+uA*.22*exp(-abs(p.y-hz)*9.);',
    '  }',
    ' } else if(uScene<1.5){',
    /* hacker: falling green code */
    '  float cs=uRes.y/(uMode>.5?46.:34.);',
    '  vec2 cell=floor(gl_FragCoord.xy/vec2(cs*.72,cs));',
    '  vec2 f=fract(gl_FragCoord.xy/vec2(cs*.72,cs));',
    '  float rows=uRes.y/cs;',
    '  float c1=hash(vec2(cell.x,1.)),c2=hash(vec2(cell.x,2.)),c3=hash(vec2(cell.x,3.));',
    '  float len=7.+c2*20.;',
    '  float head=mod(t*(3.+c1*7.)*sp+c3*300.,rows+len);',
    '  float d=head-(rows-cell.y);',
    '  float b=(d<0.||d>len)?0.:pow(1.-d/len,1.6);',
    '  vec2 g=floor(f*vec2(3.,5.));',
    '  float flick=floor(t*(2.+c1*5.)+hash(cell)*10.);',
    '  float bit=step(.42,hash(cell*vec2(3.1,5.3)+g+flick));',
    '  float inside=step(.14,f.x)*step(f.x,.86)*step(.1,f.y)*step(f.y,.9);',
    '  float glyph=bit*inside;',
    '  col+=uA*glyph*b*(uMode>.5?.95:.6);',
    '  col+=vec3(.75,1.,.85)*glyph*step(0.,d)*step(d,1.)*(uMode>.5?.9:.5);',
    '  col+=uA*.05*fbm(p*2.+t*.03);',
    ' } else if(uScene<2.5){',
    /* lava: glowing flow at the bottom + rising embers */
    '  float lv=fbm(vec2(p.x*2.2+t*.04*sp,uv.y*3.2-t*.12*sp));',
    '  float lv2=fbm(vec2(p.x*4.+lv*2.,uv.y*6.-t*.2*sp));',
    '  col+=mix(uA,uB,lv2*.5)*pow(1.-uv.y,1.9)*(.75+lv*1.3);',
    '  col+=uA*.12*pow(1.-uv.y,4.);',
    '  col+=uA*.18*pow(fbm(p*1.3+vec2(t*.01,-t*.02)),3.);',
    '  for(int i=0;i<3;i++){',
    '   float fi=float(i);',
    '   vec2 q=p*(16.+fi*12.);',
    '   q.y-=t*(1.3+fi*.7)*sp;q.x+=sin(q.y*.35+fi*2.)*.5;',
    '   vec2 id=floor(q);vec2 fr=fract(q)-.5;',
    '   float hs=hash(id+fi*7.3);',
    '   if(hs>.87){',
    '    vec2 o=vec2(hash(id+3.1),hash(id+5.7))-.5;',
    '    float e=smoothstep(.13,0.,length(fr-o*.6))*(.55+.45*sin(t*4.+hs*40.));',
    '    col+=mix(uA,vec3(1.,.82,.4),.55)*e*(1.-fi*.22)*(.35+(1.-uv.y)*.9);',
    '   }',
    '  }',
    ' } else if(uScene<3.5){',
    /* ice: frosty gradient, aurora, snow */
    '  col=mix(uBase*.55,uBase*1.25,uv.y);',
    '  float au=fbm(vec2(p.x*1.1+t*.015*sp,p.y*2.6+t*.02*sp));',
    '  col+=mix(uA,uB,au)*.32*smoothstep(.45,.85,au)*smoothstep(-.15,.45,p.y);',
    '  col+=stars(p,t,.5)*step(0.,p.y);',
    '  for(int i=0;i<4;i++){',
    '   float fi=float(i);',
    '   vec2 q=p*(8.+fi*8.);',
    '   q.y+=t*(.35+fi*.22)*sp;q.x+=sin(q.y*.45+t*.4+fi*1.7)*.45;',
    '   vec2 id=floor(q);vec2 fr=fract(q)-.5;',
    '   float hs=hash(id+fi*13.1);',
    '   if(hs>.72){',
    '    vec2 o=vec2(hash(id+1.3),hash(id+2.9))-.5;',
    '    col+=vec3(.92,.97,1.)*smoothstep(.085-fi*.015,0.,length(fr-o*.5))*(.75-fi*.13);',
    '   }',
    '  }',
    ' } else if(uScene<4.5){',
    /* galaxy: spiral glow + nebula + stars */
    '  vec2 c=p-vec2(.18,.06);float r=length(c);float an=atan(c.y,c.x);',
    '  float arms=sin(an*2.-log(r+.002)*5.5+t*.06*sp);',
    '  float neb=fbm(p*2.2+vec2(t*.01,-t*.008));',
    '  col+=mix(uB,uA,clamp(r*1.8,0.,1.))*exp(-r*2.6)*(.45+.55*arms)*(.6+neb*.8);',
    '  col+=vec3(1.,.93,.86)*exp(-r*16.)*.75;',
    '  col+=uB*pow(neb,3.5)*.55;',
    '  col+=stars(p,t,1.3)+stars(p*1.7+3.,t,.6);',
    ' } else {',
    /* ocean: layered waves */
    '  col=mix(uBase*.6,uBase*1.3,uv.y);',
    '  for(int i=0;i<5;i++){',
    '   float fi=float(i);',
    '   float y=-.32+fi*.11+sin(p.x*(2.+fi*.7)+t*(.5+fi*.15)*sp+fi*1.3)*.035+sin(p.x*5.3-t*.7*sp+fi)*.012;',
    '   float lw=smoothstep(.006,0.,abs(p.y-y));',
    '   col+=mix(uA,uB,fi/4.)*lw*.55;',
    '   col=mix(col,uBase*(.5+fi*.08),step(p.y,y)*.18);',
    '  }',
    '  col+=stars(p,t,.6)*step(.1,p.y);',
    ' }',
    ' col*=1.-.6*dot(uv-.5,uv-.5)*1.8;',
    ' col+=(hash(gl_FragCoord.xy+fract(t))-.5)/200.;',
    ' gl_FragColor=vec4(col,1.);',
    '}'
  ].join('\n');

  var canvas, gl, prog, loc = {};
  var mode = 'insane';
  var running = false;
  var paused = false;
  var raf = 0;
  var t0 = performance.now();
  var lastFrame = 0;
  var scale = 0.75;
  var frameTimes = [];
  var mouse = [0, 0], mouseT = [0, 0];
  var colA = [0, 0.9, 1], colB = [1, 0.17, 0.84];
  var scene = 0, base = [0.01, 0.012, 0.026];
  var SCENES = { synth: 0, matrix: 1, embers: 2, snow: 3, stars: 4, waves: 5 };
  var tgtA = colA.slice(), tgtB = colB.slice();
  var ok = false;

  function hexToVec(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return null;
    var n = parseInt(m[1], 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function init(c) {
    canvas = c;
    try {
      gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
      if (!gl) return false;
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      var pl = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(pl);
      gl.vertexAttribPointer(pl, 2, gl.FLOAT, false, 0, 0);
      ['uRes', 'uTime', 'uA', 'uB', 'uMouse', 'uMode', 'uScene', 'uBase'].forEach(function (n) { loc[n] = gl.getUniformLocation(prog, n); });
      canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); ok = false; stop(); });
      canvas.addEventListener('webglcontextrestored', function () { init(canvas); if (mode !== 'off') start(); });
      ok = true;
    } catch (e) {
      ok = false;
      gl = null;
      return false;
    }
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', function (e) {
      mouseT[0] = (e.clientX / window.innerWidth - 0.5);
      mouseT[1] = -(e.clientY / window.innerHeight - 0.5);
    }, { passive: true });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) cancelAnimationFrame(raf), raf = 0;
      else if (running && !paused && !raf) raf = requestAnimationFrame(frame);
    });
    resize();
    return true;
  }

  function resize() {
    if (!canvas) return;
    var w = Math.max(1, Math.round(window.innerWidth * scale));
    var hh = Math.max(1, Math.round(window.innerHeight * scale));
    if (canvas.width !== w || canvas.height !== hh) {
      canvas.width = w;
      canvas.height = hh;
      if (gl) gl.viewport(0, 0, w, hh);
    }
  }

  function frame(now) {
    raf = 0;
    if (!running || paused || !ok) return;
    var minGap = mode === 'chill' ? 1000 / 30 - 2 : 1000 / 60 - 2;
    if (now - lastFrame >= minGap) {
      var dt = now - lastFrame;
      lastFrame = now;
      /* auto quality: if frames are slow, render fewer pixels */
      if (dt < 200) {
        frameTimes.push(dt);
        if (frameTimes.length > 60) {
          var avg = frameTimes.reduce(function (a, b) { return a + b; }, 0) / frameTimes.length;
          frameTimes.length = 0;
          var budget = mode === 'chill' ? 40 : 24;
          if (avg > budget && scale > 0.4) { scale = Math.max(0.4, scale - 0.15); resize(); }
        }
      }
      for (var i = 0; i < 3; i++) {
        colA[i] += (tgtA[i] - colA[i]) * 0.04;
        colB[i] += (tgtB[i] - colB[i]) * 0.04;
      }
      mouse[0] += (mouseT[0] - mouse[0]) * 0.05;
      mouse[1] += (mouseT[1] - mouse[1]) * 0.05;
      gl.uniform2f(loc.uRes, canvas.width, canvas.height);
      gl.uniform1f(loc.uTime, (now - t0) / 1000);
      gl.uniform3fv(loc.uA, colA);
      gl.uniform3fv(loc.uB, colB);
      gl.uniform2fv(loc.uMouse, mouse);
      gl.uniform1f(loc.uMode, mode === 'insane' ? 1 : 0);
      gl.uniform1f(loc.uScene, scene);
      gl.uniform3fv(loc.uBase, base);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (!ok || mode === 'off') return;
    running = true;
    canvas.style.opacity = '1';
    if (!paused && !raf && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  window.BG = {
    init: function (c, m) {
      mode = m || 'insane';
      scale = mode === 'chill' ? 0.5 : 0.75;
      if (mode === 'off') { c.style.opacity = '1'; canvas = c; return; }
      if (init(c)) start();
    },
    setMode: function (m) {
      mode = m;
      if (m === 'off') {
        stop();
        if (gl) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
        if (canvas) canvas.style.opacity = '0';
        return;
      }
      scale = m === 'chill' ? 0.5 : 0.75;
      frameTimes.length = 0;
      if (!gl && canvas) init(canvas);
      resize();
      start();
    },
    setColors: function (a, b) {
      var va = hexToVec(a), vb = hexToVec(b);
      if (va) tgtA = va;
      if (vb) tgtB = vb;
    },
    /* the theme's moving background: 'synth' | 'matrix' | 'embers' | 'snow' | 'stars' | 'waves' */
    setScene: function (name, baseHex) {
      scene = SCENES[name] != null ? SCENES[name] : 0;
      var b = hexToVec(baseHex);
      base = b ? b.map(function (v) { return Math.min(0.5, v); }) : [0.01, 0.012, 0.026];
    },
    pause: function () { paused = true; if (raf) cancelAnimationFrame(raf); raf = 0; },
    resume: function () {
      paused = false;
      if (running && !raf && !document.hidden) { lastFrame = 0; raf = requestAnimationFrame(frame); }
    },
    isOk: function () { return ok; }
  };
})();
