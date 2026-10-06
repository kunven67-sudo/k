/* Game System 2.0 — animated WebGL background.
   Modes: 'insane' (neon grid + sun + nebula + stars), 'chill' (nebula + stars, slower), 'off'.
   It pauses itself while a game is running or the tab is hidden, and lowers its resolution
   automatically if the computer is struggling, so it never makes games lag. */
(function () {
  'use strict';

  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var FS = [
    'precision mediump float;',
    'uniform vec2 uRes;uniform float uTime;uniform vec3 uA;uniform vec3 uB;uniform vec2 uMouse;uniform float uMode;',
    'float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);',
    ' return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/uRes;',
    ' vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;',
    ' p+=uMouse*.025;',
    ' float t=uTime;',
    ' vec3 col=vec3(.01,.012,.026);',
    ' float sp=uMode>.5?1.:.55;',
    ' float n=fbm(p*1.5+vec2(t*.018,-t*.012)*sp);',
    ' float n2=fbm(p*2.8-vec2(t*.026,t*.01)*sp+n*1.4);',
    ' col+=uA*pow(n2,3.2)*.75;',
    ' col+=uB*pow(fbm(p*2.1+vec2(-t*.011,t*.017)*sp+3.),4.)*.65;',
    ' vec2 sg=p*55.;vec2 si=floor(sg);float sh=hash(si);',
    ' float st=step(.982,sh)*smoothstep(.09,0.,length(fract(sg)-.5))*(.55+.45*sin(t*1.7+sh*50.));',
    ' col+=vec3(.85,.9,1.)*st;',
    ' if(uMode>.5){',
    '  float hz=-.1;',
    '  vec2 sc=p-vec2(0.,hz+.2);float sr=length(sc);',
    '  float sun=smoothstep(.25,.245,sr);',
    '  float band=step(.5,fract((p.y-hz)*28.-t*.6));',
    '  float cut=mix(1.,band,smoothstep(.24,.0,p.y-hz));',
    '  vec3 sunc=mix(uB,uA,clamp((p.y-hz)/.42,0.,1.));',
    '  if(p.y>hz)col=mix(col,sunc*.9,sun*cut*.55);',
    '  col+=sunc*.22*exp(-max(sr-.25,0.)*9.)*step(hz,p.y);',
    '  if(p.y<hz){',
    '   float d=hz-p.y;',
    '   vec2 g=vec2(p.x/d,1./d);g.y+=t*.9;',
    '   float px=1./uRes.y;',
    '   vec2 w=vec2(px/d,px/(d*d))*1.6;',
    '   vec2 ld=.5-abs(fract(g)-.5);',
    '   vec2 l=1.-smoothstep(vec2(0.),w,ld);',
    '   float grid=max(l.x,l.y);',
    '   float fade=smoothstep(0.,.32,d);',
    '   col=col*.35+uA*grid*fade*.6+uA*.04*fade+uB*.07*(1.-fade);',
    '  }',
    '  col+=uB*.55*exp(-abs(p.y-hz)*55.)+uA*.22*exp(-abs(p.y-hz)*9.);',
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
      ['uRes', 'uTime', 'uA', 'uB', 'uMouse', 'uMode'].forEach(function (n) { loc[n] = gl.getUniformLocation(prog, n); });
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
    pause: function () { paused = true; if (raf) cancelAnimationFrame(raf); raf = 0; },
    resume: function () {
      paused = false;
      if (running && !raf && !document.hidden) { lastFrame = 0; raf = requestAnimationFrame(frame); }
    },
    isOk: function () { return ok; }
  };
})();
