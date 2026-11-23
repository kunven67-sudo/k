// Small WebGL2 helper: programs, render targets, full-screen passes and an instanced sprite batch.
'use strict';
const GLX = (() => {
  let gl, W = 1, H = 1, fsTri, halfFloat = true;
  const HEAD = '#version 300 es\nprecision highp float;\nprecision highp int;\n';
  const COMMON = `
  uniform vec2 uRes; uniform float uTime;
  float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
  vec2 hash22(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
  float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
    return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }
  float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.03+vec2(17.1,9.2); a*=.5; } return s; }
  float ridged(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*(1.-abs(vnoise(p)*2.-1.)); p=p*2.1+vec2(3.3,7.7); a*=.5; } return s; }
  vec3 blackbody(float t){ // t: 0..1 heat -> realistic flame color (approx 800K..2400K), not tone mapped
    t=clamp(t,0.,1.5); float K=800.+t*1600.; vec3 c;
    float x=K/100.; c.r=1.; c.g=clamp(.39*log(x)-.634,0.,1.); c.b=clamp(.543*log(x-10.)-1.186,0.,1.);
    if(K<1000.) c.g*=K/1000.; return c*c; }
  vec2 toUV(vec2 px){ return vec2(px.x/uRes.x, 1.-px.y/uRes.y); }
  `;
  const VS_FULL = HEAD + `in vec2 aPos; out vec2 vUV; void main(){ vUV=aPos*.5+.5; gl_Position=vec4(aPos,0,1); }`;

  function init(canvas, opts) {
    gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false,
      preserveDrawingBuffer: !!(opts && opts.preserve), powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 not available');
    halfFloat = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
    gl.getExtension('OES_texture_float_linear');
    fsTri = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, fsTri);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    return gl;
  }
  function resize(w, h) { W = w; H = h; }

  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s); const lines = src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n');
      console.error(log + '\n' + lines); throw new Error('shader: ' + log);
    }
    return s;
  }
  function program(fs, vs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs || VS_FULL));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, HEAD + COMMON + fs));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); const name = info.name.replace(/\[0\]$/, ''); u[name] = { loc: gl.getUniformLocation(p, info.name), type: info.type, size: info.size }; }
    return { p, u };
  }
  function setUniforms(prog, uni) {
    let unit = 0;
    const all = Object.assign({ uRes: [W, H], uTime: performance.now() / 1000 }, uni);
    for (const k in all) {
      const d = prog.u[k]; if (!d) continue; const v = all[k];
      switch (d.type) {
        case gl.FLOAT: d.size > 1 ? gl.uniform1fv(d.loc, v) : gl.uniform1f(d.loc, v); break;
        case gl.FLOAT_VEC2: gl.uniform2fv(d.loc, v); break;
        case gl.FLOAT_VEC3: gl.uniform3fv(d.loc, v); break;
        case gl.FLOAT_VEC4: gl.uniform4fv(d.loc, v); break;
        case gl.INT: case gl.BOOL: d.size > 1 ? gl.uniform1iv(d.loc, v) : gl.uniform1i(d.loc, v | 0); break;
        case gl.FLOAT_MAT3: gl.uniformMatrix3fv(d.loc, false, v); break;
        case gl.SAMPLER_2D: {
          gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, v && (v.tex || v) || null); gl.uniform1i(d.loc, unit); unit++; break;
        }
      }
    }
  }
  function target(t) {
    if (t) { gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.viewport(0, 0, t.w, t.h); }
    else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); }
  }
  // blend: null = none, 'pm' = premultiplied over, 'add' = additive, 'max'
  function blend(mode) {
    if (!mode) { gl.disable(gl.BLEND); return; }
    gl.enable(gl.BLEND);
    if (mode === 'pm') { gl.blendEquation(gl.FUNC_ADD); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); }
    else if (mode === 'add') { gl.blendEquation(gl.FUNC_ADD); gl.blendFunc(gl.ONE, gl.ONE); }
    else if (mode === 'max') { gl.blendEquation(gl.MAX); gl.blendFunc(gl.ONE, gl.ONE); }
  }
  function pass(prog, uni, tgt, mode) {
    target(tgt); blend(mode || null); gl.useProgram(prog.p);
    setUniforms(prog, Object.assign(tgt ? { uRes: [tgt.w, tgt.h] } : {}, uni));
    gl.bindBuffer(gl.ARRAY_BUFFER, fsTri); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function texture(w, h, opt) {
    opt = opt || {};
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    const f = opt.nearest ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, opt.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, opt.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    if (opt.float && halfFloat) gl.texImage2D(gl.TEXTURE_2D, 0, opt.rg ? gl.RG16F : gl.RGBA16F, w, h, 0, opt.rg ? gl.RG : gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return t;
  }
  function fbo(w, h, opt) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    const tex = texture(w, h, Object.assign({ float: true }, opt));
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const o = { tex, fb, w, h, texel: [1 / w, 1 / h] };
    clear(o); return o;
  }
  function double(w, h, opt) {
    const a = fbo(w, h, opt), b = fbo(w, h, opt);
    return { get read() { return this._r; }, get write() { return this._w; }, _r: a, _w: b, w: a.w, h: a.h, texel: a.texel,
      swap() { const t = this._r; this._r = this._w; this._w = t; } };
  }
  function clear(t, c) { target(t); gl.clearColor(...(c || [0, 0, 0, 0])); gl.clear(gl.COLOR_BUFFER_BIT); }
  function upload(tex, src, w, h, opt) { // src: image/canvas, or Uint8Array with w,h
    opt = opt || {};
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, opt.flip !== false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !!opt.premul);
    if (src instanceof Uint8Array || src instanceof Uint8ClampedArray) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (opt.mips) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
  }

  // Instanced quads. Each instance: pos.xy size.xy | color rgba | param (rot, a, b, c) | extra (4)
  const VS_SPRITE = HEAD + `
  layout(location=0) in vec2 aPos;
  layout(location=1) in vec4 iPS; layout(location=2) in vec4 iCol; layout(location=3) in vec4 iPar; layout(location=4) in vec4 iEx;
  uniform vec2 uRes; uniform vec2 uScale;
  out vec2 vUV; out vec4 vCol; out vec4 vPar; out vec4 vEx; out vec2 vPx;
  void main(){ float r=iPar.x; vec2 c=aPos*iPS.zw*.5; c=vec2(c.x*cos(r)-c.y*sin(r), c.x*sin(r)+c.y*cos(r));
    vec2 p=(iPS.xy+c)*uScale; vPx=p; vUV=aPos*.5+.5; vCol=iCol; vPar=iPar; vEx=iEx;
    gl_Position=vec4(p.x/uRes.x*2.-1., 1.-p.y/uRes.y*2., 0, 1); }`;
  const STRIDE = 16;
  function batch(fs, max) {
    const prog = program(fs, VS_SPRITE);
    const data = new Float32Array(max * STRIDE); const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
    const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    for (let i = 0; i < 4; i++) { gl.enableVertexAttribArray(1 + i); gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, STRIDE * 4, i * 16); gl.vertexAttribDivisor(1 + i, 1); }
    gl.bindVertexArray(null);
    let n = 0;
    return {
      get count() { return n; },
      reset() { n = 0; },
      push(x, y, w, h, r, g, b, a, rot, p1, p2, p3, e0, e1, e2, e3) {
        if (n >= max) return; const o = n * STRIDE;
        data[o] = x; data[o + 1] = y; data[o + 2] = w; data[o + 3] = h; data[o + 4] = r; data[o + 5] = g; data[o + 6] = b; data[o + 7] = a;
        data[o + 8] = rot || 0; data[o + 9] = p1 || 0; data[o + 10] = p2 || 0; data[o + 11] = p3 || 0;
        data[o + 12] = e0 || 0; data[o + 13] = e1 || 0; data[o + 14] = e2 || 0; data[o + 15] = e3 || 0; n++;
      },
      draw(uni, tgt, mode, scale) {
        if (!n) return;
        target(tgt); blend(mode || 'pm'); gl.useProgram(prog.p);
        const sc = scale || 1;
        setUniforms(prog, Object.assign({ uScale: [sc, sc] }, tgt ? { uRes: [tgt.w, tgt.h] } : {}, uni));
        gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, n * STRIDE);
        gl.bindVertexArray(vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n); gl.bindVertexArray(null);
      },
    };
  }
  return { init, resize, program, pass, fbo, double, clear, texture, upload, batch, blend, target, get gl() { return gl; }, get W() { return W; }, get H() { return H; } };
})();
