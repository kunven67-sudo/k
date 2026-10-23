/* HANDS OFF (real): the photoreal renderer. WebGL2, HDR, real light bending, a place in space per world,
   3D chrome numbers on rolling drums, liquid mercury, a glass cube, dust in the light, and a glass screen that
   really shatters. Same outside shape as the old renderer (gfx.js), plus a few extras main.js asks for. */
(function (root) {
  'use strict';
  const S = root.HOGFX2_SHADERS;
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const eOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const eIO = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  // ---------------------------------------------------------------- tiny vector math (arrays)
  const v3 = (x, y, z) => [x, y, z];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  // 3x3 as columns [c0, c1, c2]
  const m3 = (c0, c1, c2) => [c0, c1, c2];
  const m3v = (m, v) => add(add(mul(m[0], v[0]), mul(m[1], v[1])), mul(m[2], v[2]));
  const m3t = (m) => [[m[0][0], m[1][0], m[2][0]], [m[0][1], m[1][1], m[2][1]], [m[0][2], m[1][2], m[2][2]]];
  const m3mul = (a, b) => [m3v(a, b[0]), m3v(a, b[1]), m3v(a, b[2])];
  const m3f = (m) => new Float32Array([m[0][0], m[0][1], m[0][2], m[1][0], m[1][1], m[1][2], m[2][0], m[2][1], m[2][2]]);
  const I3 = () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  function rotAxis(ax, a) { // rotation matrix (columns)
    ax = norm(ax);
    const c = Math.cos(a), s = Math.sin(a), t = 1 - c, [x, y, z] = ax;
    return [[t * x * x + c, t * x * y + s * z, t * x * z - s * y], [t * x * y - s * z, t * y * y + c, t * y * z + s * x], [t * x * z + s * y, t * y * z - s * x, t * z * z + c]];
  }
  function lookRot(pos, target, up) {
    const f = norm(sub(target, pos));
    let r = cross(f, up || [0, 1, 0]);
    if (len(r) < 1e-4) r = [1, 0, 0];
    r = norm(r);
    const u = cross(r, f);
    return m3(r, u, f);
  }
  // quaternions [x, y, z, w]
  const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  const qnorm = (q) => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; };
  function qint(q, w, dt) { const d = qmul([w[0] * dt * 0.5, w[1] * dt * 0.5, w[2] * dt * 0.5, 0], q); return qnorm([q[0] + d[0], q[1] + d[1], q[2] + d[2], q[3] + d[3]]); }
  function qm3(q) {
    const [x, y, z, w] = q;
    return [[1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w)], [2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w)], [2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)]];
  }
  function qslerp(a, b, t) {
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    if (d < 0) { b = [-b[0], -b[1], -b[2], -b[3]]; d = -d; }
    if (d > 0.9995) return qnorm([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)]);
    const th = Math.acos(d), s = Math.sin(th), wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
    return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb, a[3] * wa + b[3] * wb];
  }
  function perspective(fovY, aspect, n, f) {
    const t = 1 / Math.tan(fovY / 2), nf = 1 / (n - f);
    return new Float32Array([t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]);
  }
  function viewMat(pos, rot) {
    const [r, u, f] = rot;
    return new Float32Array([r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -dot(r, pos), -dot(u, pos), dot(f, pos), 1]);
  }
  function mat4mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; }
    return o;
  }
  // smooth wandering 0-mean noise for the film camera
  const wander = (t, s) => Math.sin(t * 0.37 + s) * 0.5 + Math.sin(t * 0.61 + s * 2.3) * 0.3 + Math.sin(t * 1.13 + s * 4.1) * 0.2;

  // ---------------------------------------------------------------- data made on the CPU once
  function noise3D(size, period) { // 4 tileable gradient noises in RGBA
    const out = new Uint8Array(size * size * size * 4);
    const per = period, cell = size / per;
    for (let ch = 0; ch < 4; ch++) {
      const g = new Float32Array(per * per * per * 3);
      let seed = 1234567 + ch * 7919;
      const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      for (let i = 0; i < per * per * per; i++) {
        const z = rnd() * 2 - 1, a = rnd() * TAU, r = Math.sqrt(1 - z * z);
        g[i * 3] = r * Math.cos(a); g[i * 3 + 1] = r * Math.sin(a); g[i * 3 + 2] = z;
      }
      const grad = (ix, iy, iz, fx, fy, fz) => {
        const i = (((iz % per) * per + (iy % per)) * per + (ix % per)) * 3;
        return g[i] * fx + g[i + 1] * fy + g[i + 2] * fz;
      };
      const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
      for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const px = (x + 0.5) / cell, py = (y + 0.5) / cell, pz = (z + 0.5) / cell;
        const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz);
        const fx = px - ix, fy = py - iy, fz = pz - iz;
        const u = fade(fx), v = fade(fy), w = fade(fz);
        const n000 = grad(ix, iy, iz, fx, fy, fz), n100 = grad(ix + 1, iy, iz, fx - 1, fy, fz);
        const n010 = grad(ix, iy + 1, iz, fx, fy - 1, fz), n110 = grad(ix + 1, iy + 1, iz, fx - 1, fy - 1, fz);
        const n001 = grad(ix, iy, iz + 1, fx, fy, fz - 1), n101 = grad(ix + 1, iy, iz + 1, fx - 1, fy, fz - 1);
        const n011 = grad(ix, iy + 1, iz + 1, fx, fy - 1, fz - 1), n111 = grad(ix + 1, iy + 1, iz + 1, fx - 1, fy - 1, fz - 1);
        const nx0 = lerp(lerp(n000, n100, u), lerp(n010, n110, u), v), nx1 = lerp(lerp(n001, n101, u), lerp(n011, n111, u), v);
        const n = lerp(nx0, nx1, w) / 0.75;
        out[((z * size + y) * size + x) * 4 + ch] = Math.round(clamp(n * 0.5 + 0.5, 0, 1) * 255);
      }
    }
    return out;
  }
  function blackbodyLUT(n) { // real color of a hot body: Planck spectrum -> CIE 1931 (Wyman fit) -> linear sRGB
    const out = new Uint8Array(n * 4);
    const g = (x, m, s1, s2) => { const t = (x - m) / (x < m ? s1 : s2); return Math.exp(-0.5 * t * t); };
    for (let i = 0; i < n; i++) {
      const T = 1000 * Math.pow(40, i / (n - 1));
      let X = 0, Y = 0, Z = 0;
      for (let l = 380; l <= 780; l += 5) {
        const lm = l * 1e-9;
        const B = 1 / (Math.pow(lm, 5) * (Math.exp(0.014388 / (lm * T)) - 1));
        X += B * (1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2));
        Y += B * (0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1));
        Z += B * (1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8));
      }
      let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z, gg = -0.9689 * X + 1.8758 * Y + 0.0415 * Z, b = 0.0557 * X - 0.2040 * Y + 1.0570 * Z;
      r = Math.max(r, 0); gg = Math.max(gg, 0); b = Math.max(b, 0);
      const m = Math.max(r, gg, b) || 1;
      out[i * 4] = Math.round(r / m * 255); out[i * 4 + 1] = Math.round(gg / m * 255); out[i * 4 + 2] = Math.round(b / m * 255); out[i * 4 + 3] = 255;
    }
    return out;
  }
  function bbJS(lut, T) { // same table on the CPU (for sparks + lights)
    const n = lut.length / 4;
    const x = clamp(Math.log(T * 0.001) / Math.log(40), 0, 1) * (n - 1);
    const i = Math.floor(x), f = x - i, j = Math.min(n - 1, i + 1);
    const c = (k) => (lut[i * 4 + k] * (1 - f) + lut[j * 4 + k] * f) / 255;
    return [c(0), c(1), c(2)];
  }

  // ---------------------------------------------------------------- the places (one per world, then they come back deeper)
  // kind: 0 black hole, 1 ringed giant, 2 pulsar, 3 two black holes
  const PLACES = [
    { name: 'EVENT HORIZON', kind: 0, cam: { dist: 21, elev: 0.075, look: [0, 1.05, 0], fov: 46 }, tilt: 0.05,
      hA: [3.0, 15.0, 5400, 1.1], hB: [1, 0, 2.2, 0], skyGain: 0.16, hC: [36, 0, 0, 0], sky: { c0: [0, 0.05, -1], n: [0.35, 0.92, 0.18], core: [-0.6, 0.15, -0.78] }, star: 1.0, light: 7400 },
    { name: 'PILLARS', kind: 0, cam: { dist: 30, elev: 0.02, look: [-3.2, 1.6, 0], fov: 46 }, tilt: 0, skyGain: 0.5,
      hA: [3.0, 15.0, 6000, 1], hB: [0, 0, 0, 0], hC: [30, 0, 0, 0], sky: { c0: [-0.4, 0.06, -0.91], n: [0.2, 0.3, 0.93], core: [0.8, -0.2, 0.55] }, star: 0.7, light: 5200 },
    { name: 'RINGED GIANT', kind: 1, cam: { dist: 42, elev: 0.16, look: [0, 3.2, 0], fov: 46 }, tilt: 0.42,
      hA: [9.0, 0, 0, 1], hB: [3.2, 0, 0, 0], hC: [0, 0, 0, 0], sun: [-0.86, 0.22, 0.46], sky: { c0: [0.5, 0.4, -0.77], n: [0.1, 0.55, 0.83], core: [-0.3, 0.7, -0.65] }, star: 0.3, light: 5800, skyGain: 0.05 },
    { name: 'PULSAR', kind: 2, cam: { dist: 19, elev: 0.18, look: [0, 0.8, 0], fov: 46 }, tilt: 0.35,
      hA: [0.32, 26, 2.2, 0.78], hB: [0.3, 0.32, 0.13, 0.6], hC: [0, 0, 0, 0], sky: { c0: [0, 0.02, -1], n: [0.6, 0.7, 0.4], core: [0.7, -0.4, 0.6] }, star: 0.8, light: 26000, skyGain: 0.22 },
    { name: 'QUASAR', kind: 0, cam: { dist: 27, elev: 0.3, look: [0, 1.4, 0], fov: 46 }, tilt: -0.12,
      hA: [3.0, 18.0, 15000, 1.7], hB: [1, 1, 1.6, 2.4], hC: [40, 0, 0, 0], sky: { c0: [0, 0, -1], n: [0.1, 0.98, 0.1], core: [0.05, -0.2, -0.98] }, star: 0.8, light: 15000, skyGain: 0.12 },
    { name: 'COLLISION', kind: 3, cam: { dist: 44, elev: 0.04, look: [0, 1.6, 0], fov: 46 }, tilt: 0,
      hA: [0.55, 6.5, 0, 0], hB: [0, 0, 0, 0], hC: [0, 0, 0, 0], sky: { c0: [-0.22, 0.2, -0.95], n: [0.7, 0.6, 0.38], core: [0.2, -0.9, 0.4] }, star: 0.7, light: 6500, skyGain: 0.5 },
  ];

  // ---------------------------------------------------------------- the renderer
  function create(canvas, opt) {
    opt = opt || {};
    const R = { ok: false, real: true, error: '', ready: false, flags: {} };
    let gl = null;
    try {
      gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: true, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    } catch (e) { gl = null; }
    if (!gl) { R.error = 'no WebGL2'; return R; }
    if (!gl.getExtension('EXT_color_buffer_float')) { R.error = 'no float render targets'; return R; }
    gl.getExtension('OES_texture_float_linear');
    const par = gl.getExtension('KHR_parallel_shader_compile');
    const lut = blackbodyLUT(256);
    R.bb = (T) => bbJS(lut, T);

    // ---------------- programs (compiled in the background when the browser can)
    const progs = {};
    function shader(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    function program(name, vs, fs) {
      const p = gl.createProgram();
      const v = shader(gl.VERTEX_SHADER, vs), f = shader(gl.FRAGMENT_SHADER, fs);
      gl.attachShader(p, v); gl.attachShader(p, f);
      gl.linkProgram(p);
      progs[name] = { p, v, f, u: null, t: null, linked: false, name };
    }
    function finish(P) {
      if (P.linked) return true;
      if (par && !gl.getProgramParameter(P.p, par.COMPLETION_STATUS_KHR)) return false;
      if (!gl.getProgramParameter(P.p, gl.LINK_STATUS)) {
        const log = (gl.getShaderInfoLog(P.f) || '') + (gl.getShaderInfoLog(P.v) || '') + (gl.getProgramInfoLog(P.p) || '');
        throw new Error(P.name + ': ' + log.slice(0, 600));
      }
      P.u = {}; P.t = {};
      const n = gl.getProgramParameter(P.p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(P.p, i);
        const base = info.name.replace(/\[0\]$/, '');
        P.u[base] = gl.getUniformLocation(P.p, info.name);
        P.t[base] = info.type;
      }
      P.linked = true;
      return true;
    }
    function allReady() {
      try {
        let ok = true;
        for (const k in progs) if (!finish(progs[k])) ok = false;
        return ok;
      } catch (e) { R.error = String(e.message || e); R.failed = true; return false; }
    }
    const T = gl;
    function set(P, name, v) {
      const loc = P.u[name];
      if (loc === undefined || loc === null) return;
      const ty = P.t[name];
      switch (ty) {
        case T.FLOAT: if (v.length) gl.uniform1fv(loc, v); else gl.uniform1f(loc, v); break;
        case T.FLOAT_VEC2: gl.uniform2fv(loc, v); break;
        case T.FLOAT_VEC3: gl.uniform3fv(loc, v); break;
        case T.FLOAT_VEC4: gl.uniform4fv(loc, v); break;
        case T.INT: case T.BOOL: case T.SAMPLER_2D: case T.SAMPLER_3D: case T.SAMPLER_CUBE: gl.uniform1i(loc, v); break;
        case T.FLOAT_MAT3: gl.uniformMatrix3fv(loc, false, v); break;
        case T.FLOAT_MAT4: gl.uniformMatrix4fv(loc, false, v); break;
        default: break;
      }
    }
    program('sky', S.VERT, S.SKY);
    program('hero', S.VERT, S.HERO);
    program('obj', S.VERT, S.OBJ);
    program('part', S.PART_V, S.PART_F);
    program('down', S.VERT, S.DOWN);
    program('up', S.VERT, S.UP);
    program('post', S.VERT, S.POST);
    program('copy', S.VERT, S.COPY);
    program('shard', SHARD_V, SHARD_F);
    program('floor', S.VERT, FLOOR_F);
    program('chip', CHIP_V, CHIP_F);

    // ---------------- buffers + textures
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const tri = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tri);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    function tex2D(w, h, ifmt, fmt, type, filter, data) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, data || null);
      return t;
    }
    function cube(size) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, t);
      for (let f = 0; f < 6; f++) gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + f, 0, gl.RGBA16F, size, size, 0, gl.RGBA, gl.HALF_FLOAT, null);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return { t, size, fbos: [] };
    }
    function cubeFbo(c, f) {
      if (!c.fbos[f]) {
        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + f, c.t, 0);
        c.fbos[f] = fb;
      }
      return c.fbos[f];
    }
    function fboFor(t, depth) {
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      if (depth) gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
      return fb;
    }
    const noiseTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, noiseTex);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    for (const w of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, w, gl.REPEAT);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, 64, 64, 64, 0, gl.RGBA, gl.UNSIGNED_BYTE, noise3D(64, 16));
    const bbTex = tex2D(256, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR, lut);

    // ---------------- quality
    // scale = how much of the screen the 3D world is drawn at; steps = light-ray steps; sky = cube face size
    const Q = {
      low: { scale: 0.42, steps: 90, sky: 384, probe: 64, numSteps: 56, disp: 0, bloom: 5, dust: 220, ui: 1.0 },
      auto: { scale: 0.55, steps: 140, sky: 512, probe: 96, numSteps: 80, disp: 1, bloom: 6, dust: 420, ui: 1.25 },
      high: { scale: 0.7, steps: 200, sky: 768, probe: 128, numSteps: 110, disp: 1, bloom: 6, dust: 600, ui: 1.5 },
      max: { scale: 0.85, steps: 280, sky: 1024, probe: 160, numSteps: 140, disp: 1, bloom: 7, dust: 800, ui: 1.75 },
      insane: { scale: 1.0, steps: 420, sky: 1024, probe: 192, numSteps: 160, disp: 1, bloom: 7, dust: 1100, ui: 2 },
    };
    let quality = 'max', qv = Q.max, adapt = 1;
    const times = [];
    R.setQuality = (q) => { quality = Q[q] ? q : 'max'; qv = Q[quality]; adapt = 1; skyDirty = true; };
    R.quality = () => quality;
    R.uiScale = () => Math.min(window.devicePixelRatio || 1, qv.ui);
    R.autoScale = () => qv.scale * adapt;
    R.resize = () => {
      const s = R.uiScale();
      const w = Math.max(2, Math.round((canvas.clientWidth || window.innerWidth) * s));
      const h = Math.max(2, Math.round((canvas.clientHeight || window.innerHeight) * s));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      return [w, h];
    };

    // ---------------- render targets (made to size)
    let sceneTex = null, sceneFbo = null, sceneDepth = null, sw = 0, sh = 0;
    let mips = [], finalTex = null, finalFbo = null, fw = 0, fh = 0, snapTex = null, snapFbo = null, crackTex = null;
    let objTex = null, objFbo = null, objDepth = null;
    function sizeScene(w, h) {
      if (w === sw && h === sh) return;
      sw = w; sh = h;
      if (sceneTex) { gl.deleteTexture(sceneTex); gl.deleteFramebuffer(sceneFbo); gl.deleteRenderbuffer(sceneDepth); }
      for (const m of mips) { gl.deleteTexture(m.t); gl.deleteFramebuffer(m.f); }
      sceneTex = tex2D(w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
      sceneDepth = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, sceneDepth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
      sceneFbo = fboFor(sceneTex, sceneDepth);
      mips = [];
      let mw = w, mh = h;
      for (let i = 0; i < 8; i++) {
        mw = Math.max(1, Math.floor(mw / 2)); mh = Math.max(1, Math.floor(mh / 2));
        const t = tex2D(mw, mh, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
        mips.push({ t, f: fboFor(t), w: mw, h: mh });
        if (mw <= 4 || mh <= 4) break;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    // the number, the mercury, the glass and the dust: full sharpness unless a slow card makes MAX drop resolution
    let ow = 0, oh = 0;
    function sizeObj(w, h) {
      if (w === ow && h === oh) return;
      ow = w; oh = h;
      if (objTex) { gl.deleteTexture(objTex); gl.deleteFramebuffer(objFbo); gl.deleteRenderbuffer(objDepth); }
      objTex = tex2D(w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
      objDepth = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, objDepth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
      objFbo = fboFor(objTex, objDepth);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    function sizeFinal(w, h) {
      if (w === fw && h === fh) return;
      fw = w; fh = h;
      if (finalTex) { gl.deleteTexture(finalTex); gl.deleteFramebuffer(finalFbo); gl.deleteTexture(snapTex); gl.deleteFramebuffer(snapFbo); }
      finalTex = tex2D(w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
      finalFbo = fboFor(finalTex);
      snapTex = tex2D(w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
      snapFbo = fboFor(snapTex);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    const uiTex = tex2D(1, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR, new Uint8Array(4));
    crackTex = tex2D(1, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR, new Uint8Array(4));
    R.uploadUI = (src) => {
      gl.bindTexture(gl.TEXTURE_2D, uiTex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    };

    // ---------------- skies: one cube per place, built a strip at a time so the GPU never stalls
    const skies = {};              // key -> { c, done, face, row, place, lap }
    let skyDirty = false;
    let curKey = null, nextKey = null;
    function skyKey(w) { const i = ((w % PLACES.length) + PLACES.length) % PLACES.length; return i + ':' + Math.min(3, Math.floor(Math.max(0, w) / PLACES.length)); }
    function skyFor(w) {
      const key = skyKey(w);
      let s = skies[key];
      if (!s || s.c.size !== qv.sky) {
        if (s) gl.deleteTexture(s.c.t);
        const i = ((w % PLACES.length) + PLACES.length) % PLACES.length;
        s = skies[key] = { c: cube(qv.sky), done: false, face: 0, row: 0, place: i, lap: Math.min(3, Math.floor(Math.max(0, w) / PLACES.length)), key };
      }
      return s;
    }
    function dropSkies(keep) { for (const k in skies) if (keep.indexOf(k) < 0) { gl.deleteTexture(skies[k].c.t); for (const f of skies[k].c.fbos) if (f) gl.deleteFramebuffer(f); delete skies[k]; } }
    function buildSky(s, budgetRows) { // returns true when done
      if (s.done) return true;
      const P = progs.sky, pl = PLACES[s.place];
      gl.useProgram(P.p);
      gl.bindVertexArray(vao);
      bindCommon(P);
      set(P, 'u_size', [s.c.size, s.c.size]);
      set(P, 'u_place', s.place);
      set(P, 'u_seed', s.lap * 13.7);
      set(P, 'u_c0', norm(pl.sky.c0)); set(P, 'u_c1', norm(pl.sky.n)); set(P, 'u_c2', norm(pl.sky.core));
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
      gl.enable(gl.SCISSOR_TEST);
      let rows = budgetRows;
      while (rows > 0 && !s.done) {
        const n = Math.min(rows, s.c.size - s.row);
        gl.bindFramebuffer(gl.FRAMEBUFFER, cubeFbo(s.c, s.face));
        gl.viewport(0, 0, s.c.size, s.c.size);
        gl.scissor(0, s.row, s.c.size, n);
        set(P, 'u_face', s.face);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        s.row += n; rows -= n;
        if (s.row >= s.c.size) { s.row = 0; s.face++; if (s.face >= 6) s.done = true; }
      }
      gl.disable(gl.SCISSOR_TEST);
      return s.done;
    }
    function bindCommon(P) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_3D, noiseTex); set(P, 'u_noise', 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bbTex); set(P, 'u_bb', 1);
    }
    let probe = null;

    // ---------------- the place we're in + the camera
    let world = 0, place = PLACES[0], placeIdx = 0, lap = 0;
    let rigPos = [0, 0, 20], rigRot = I3();
    const cam = { pos: [0, 0, 20], rot: I3(), fov: 46, pull: 0, pullV: 0, fovK: 0, roll: 0, t: 0 };
    let heroRot = I3();
    const dive = { on: false, t: 0, from: 0, to: 0, swapped: false, viaMetal: false };
    function setPlace(w) {
      world = w;
      placeIdx = ((w % PLACES.length) + PLACES.length) % PLACES.length;
      place = PLACES[placeIdx];
      lap = Math.max(0, Math.floor(w / PLACES.length));
      heroRot = m3t(rotAxis([0, 0, 1], place.tilt));       // world -> hero (rings/disk tilted a little)
      curKey = skyKey(w); nextKey = skyKey(w + 1);
    }
    R.places = PLACES;
    R.setWorld = (w) => { if (w !== world || !curKey) { setPlace(w); dropSkies([curKey, nextKey, skyKey(0)]); } };
    setPlace(0);

    function rigFor(grow) { // where the camera sits in this place (the hole gets a bit closer the longer you hold still)
      const c = place.cam;
      const dist = c.dist * (1 - 0.18 * grow) * (lap ? 0.9 : 1);
      const az = 0.18 * Math.sin(cam.t * 0.012) + (lap % 2 ? 0.5 : 0);
      const el = c.elev + 0.02 * Math.sin(cam.t * 0.017);
      const pos = [Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist];
      const look = add(c.look, [0, 0, 0]);
      return { pos, rot: lookRot(pos, look, [0, 1, 0]) };
    }

    // ---------------- number: SDF atlas of chrome glyphs + rolling drums
    const GLYPHS = '0123456789.,e+-';
    const AT = { cols: 4, rows: 4, cw: 1.0, ch: 1.32, pxEm: 120, range: 0.14, tex: null, adv: {}, font: '', built: false };
    function buildAtlas(fam) {
      const pxEm = AT.pxEm;
      const cnv = document.createElement('canvas');
      const c = cnv.getContext('2d');
      c.font = '900 ' + pxEm + 'px ' + fam;
      let maxD = 0;
      for (const ch of GLYPHS) { AT.adv[ch] = c.measureText(ch).width / pxEm; if (ch >= '0' && ch <= '9') maxD = Math.max(maxD, AT.adv[ch]); }
      AT.digit = maxD;
      AT.cw = Math.max(1.0, maxD + 0.36);
      const cwp = Math.ceil(AT.cw * pxEm), chp = Math.ceil(AT.ch * pxEm);
      cnv.width = cwp * AT.cols; cnv.height = chp * AT.rows;
      c.font = '900 ' + pxEm + 'px ' + fam;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#000'; c.fillRect(0, 0, cnv.width, cnv.height);
      c.fillStyle = '#fff';
      for (let i = 0; i < GLYPHS.length; i++) {
        const x = (i % AT.cols) * cwp + cwp / 2, y = Math.floor(i / AT.cols) * chp + chp / 2;
        c.fillText(GLYPHS[i], x, y + pxEm * 0.02);
      }
      const img = c.getImageData(0, 0, cnv.width, cnv.height).data;
      const W = cnv.width, H = cnv.height, N = W * H, INF = 1e20;
      const outer = new Float64Array(N), inner = new Float64Array(N);
      for (let i = 0; i < N; i++) {
        const a = img[i * 4] / 255;
        if (a >= 0.999) { outer[i] = 0; inner[i] = INF; }
        else if (a <= 0.001) { outer[i] = INF; inner[i] = 0; }
        else { const d = 0.5 - a; outer[i] = d > 0 ? d * d : 0; inner[i] = d < 0 ? d * d : 0; }
      }
      edt(outer, W, H); edt(inner, W, H);
      const data = new Uint8Array(N);
      const rpx = AT.range * pxEm;
      for (let i = 0; i < N; i++) {
        const d = Math.sqrt(outer[i]) - Math.sqrt(inner[i]);
        data[i] = Math.round(clamp(0.5 + d / (2 * rpx), 0, 1) * 255);
      }
      if (AT.tex) gl.deleteTexture(AT.tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      AT.tex = tex2D(W, H, gl.R8, gl.RED, gl.UNSIGNED_BYTE, gl.LINEAR, data);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      AT.font = fam; AT.built = true;
    }
    function edt(f, w, h) { // Felzenszwalb squared distance transform, in place
      const n = Math.max(w, h), v = new Int32Array(n), z = new Float64Array(n + 1), g = new Float64Array(n), d = new Float64Array(n);
      const pass = (off, stride, len) => {
        for (let q = 0; q < len; q++) g[q] = f[off + q * stride];
        let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
        for (let q = 1; q < len; q++) {
          let s;
          do { const r = v[k]; s = (g[q] - g[r] + q * q - r * r) / (2 * q - 2 * r); } while (s <= z[k] && --k > -1);
          k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
        }
        k = 0;
        for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; const r = v[k]; d[q] = (q - r) * (q - r) + g[r]; }
        for (let q = 0; q < len; q++) f[off + q * stride] = d[q];
      };
      for (let x = 0; x < w; x++) pass(x, w, h);
      for (let y = 0; y < h; y++) pass(y * w, 1, w);
    }
    function ensureAtlas() {
      let fam = 'Arial Black, sans-serif';
      try { if (document.fonts && document.fonts.check('900 40px Unbounded')) fam = 'Unbounded, "Arial Black", sans-serif'; } catch (e) { /* old browser */ }
      if (!AT.built || (fam !== AT.font && fam[0] === 'U')) buildAtlas(fam);
    }
    // the drums (slots keyed from the right, so the ones digit stays the ones digit as the number grows)
    const NUM = { slots: [], text: '', cx: 0, cy: 0, size: 100, alpha: 0, want: 0, hot: 0, mode: 'live', morph: -1, wob: 0, layoutW: 0 };
    R.setNumber = (o) => {
      if (!o) { NUM.want = 0; return; }
      NUM.want = o.alpha === undefined ? 1 : o.alpha;
      NUM.text = o.text; NUM.cx = o.cx; NUM.cy = o.cy; NUM.size = o.size;
      NUM.mode = o.mode || 'live'; NUM.hot = Math.max(NUM.hot, o.hot || 0); NUM.wob = o.wobble || 0;
    };
    R.numberWidth = () => NUM.layoutW * NUM.size;   // px, like measureText
    R.morph = () => { NUM.morph = 0; };
    function updNumber(dt) {
      NUM.alpha = lerp(NUM.alpha, NUM.want, 1 - Math.exp(-dt * 10));
      NUM.hot *= Math.exp(-dt * 2);
      const chars = [...(NUM.text || '')].filter((ch) => GLYPHS.indexOf(ch) >= 0);
      const n = chars.length;
      // right-keyed slot list
      while (NUM.slots.length < n) NUM.slots.push({ v: 0, tgt: 0, sc: 0, x: null, ch: '', extra: 0, flip: 0, alive: true, cr: 0, last: -1 });
      let w = 0;
      const adv = (ch) => (ch >= '0' && ch <= '9' ? AT.digit || 0.8 : AT.adv[ch] || 0.4) * 1.0;
      for (const ch of chars) w += adv(ch);
      NUM.layoutW = w;
      let x = -w / 2;
      const xs = chars.map((ch) => { const c0 = x + adv(ch) / 2; x += adv(ch); return c0; });
      for (let k = 0; k < NUM.slots.length; k++) {
        const s = NUM.slots[k];
        const ci = n - 1 - k;                 // k = 0 is the rightmost character
        if (ci < 0) { s.alive = false; s.sc = Math.max(0, s.sc - dt * 6); continue; }
        const ch = chars[ci];
        s.alive = true;
        const tx = xs[ci];
        s.x = s.x === null ? tx : lerp(s.x, tx, 1 - Math.exp(-dt * 12));
        s.sc = lerp(s.sc, 1, 1 - Math.exp(-dt * 10));
        if (ch >= '0' && ch <= '9') {
          const t = +ch;
          if (!(s.ch >= '0' && s.ch <= '9')) { s.v = t; }
          s.ch = ch;
          // how often this digit changes: the fast ones just switch (like a real counter's blur), the slow ones roll
          s.cr = s.cr * Math.exp(-dt / 0.5) + (t !== s.last ? 1 : 0);
          s.last = t;
          if (s.cr > 2.6 && s.extra <= 0) { s.v = t; continue; }
          const cur = ((s.v % 10) + 10) % 10;
          const dir = NUM.mode === 'rewind' ? -1 : 1;
          let delta = dir > 0 ? ((t - cur) % 10 + 10) % 10 : -(((cur - t) % 10 + 10) % 10);
          if (Math.abs(delta) < 1e-3) delta = 0;
          if (NUM.mode === 'freeze') delta = 0;
          const speed = Math.min(40, 11 + Math.abs(delta) * 20);
          const mv = Math.sign(delta) * Math.min(Math.abs(delta), speed * dt);
          s.v += mv;
          if (s.extra > 0) { const e = Math.min(s.extra, 30 * dt); s.v += e; s.extra -= e; }
          if (Math.abs(s.v) > 1e5) s.v = ((s.v % 10) + 10) % 10;
        } else {
          s.ch = ch;
          if (s.flip > 0) s.flip = Math.max(0, s.flip - dt * 7);
        }
      }
      while (NUM.slots.length && !NUM.slots[NUM.slots.length - 1].alive && NUM.slots[NUM.slots.length - 1].sc < 0.02) NUM.slots.pop();
      if (NUM.morph >= 0) { // the money changes: every drum spins a full turn, left to right
        const before = NUM.morph;
        NUM.morph += dt;
        for (let k = 0; k < NUM.slots.length; k++) {
          const s = NUM.slots[k], ci = n - 1 - k;
          const at = Math.max(0, ci) * 0.05;
          if (before < at && NUM.morph >= at) { if (s.ch >= '0' && s.ch <= '9') s.extra += 10; else s.flip = TAU; }
        }
        if (NUM.morph > 1.5) NUM.morph = -1;
      }
      if (NUM.morph < 0) for (const s of NUM.slots) { s.flip = 0; if (s.extra > 0 && s.extra < 0.05) s.extra = 0; }
    }
    const slotA = new Float32Array(18 * 4), slotB = new Float32Array(18 * 4);
    function numberUniforms(P, W, Hh, tanHalf) {
      const n = Math.min(18, NUM.slots.length);
      let minx = 1e9, maxx = -1e9;
      for (let k = 0; k < n; k++) {
        const s = NUM.slots[k];
        const gi = GLYPHS.indexOf(s.ch);
        const digit = s.ch >= '0' && s.ch <= '9';
        const wob = NUM.wob ? (Math.sin(cam.t * 31 + k * 2.1) * 0.08 * NUM.wob) : 0;
        slotA[k * 4] = s.x || 0; slotA[k * 4 + 1] = digit ? s.v + wob : -1; slotA[k * 4 + 2] = gi; slotA[k * 4 + 3] = s.sc;
        slotB[k * 4] = s.flip || 0; slotB[k * 4 + 1] = 0; slotB[k * 4 + 2] = 0; slotB[k * 4 + 3] = 0;
        minx = Math.min(minx, (s.x || 0) - AT.cw * 0.5); maxx = Math.max(maxx, (s.x || 0) + AT.cw * 0.5);
      }
      set(P, 'u_nSlots', n);
      set(P, 'u_slotA', slotA); set(P, 'u_slotB', slotB);
      // where it sits: same place + size as the HUD number used to be
      const zN = 3.2;
      const px2w = 2 * zN * tanHalf / Hh;
      const em = NUM.size * px2w;
      const cxw = (NUM.cx - W / 2) * px2w, cyw = (Hh / 2 - NUM.cy) * px2w;
      set(P, 'u_numC', [cxw, cyw, zN]);
      set(P, 'u_em', em);
      // a slight tilt back so the faces catch the light above
      const tilt = rotAxis([1, 0, 0], -0.1);
      set(P, 'u_numRot', m3f(m3t(tilt)));
      set(P, 'u_numBox', [n ? minx : 0, n ? maxx : 0, -1.0, 1.0]);
      set(P, 'u_numOn', n ? NUM.alpha : 0);
      set(P, 'u_numHot', NUM.hot);
      set(P, 'u_atlasInfo', [AT.cols, AT.rows, AT.cw, AT.ch]);
      set(P, 'u_glyph', [AT.range, 0.24, 0.035, 1.1]);
    }

    // ---------------- liquid mercury + the glass cube (they live in the rig's space, so the camera drifts past them)
    const merc = { anchor: [-2.55, 0.15, 6.4], c: null, r: 0.62, balls: [], drops: [], next: 2, kick: 0, grow: 0, toCam: 0 };
    for (let i = 0; i < 5; i++) merc.balls.push({ o: [0, 0, 0], v: [0, 0, 0], r: [0.5, 0.3, 0.27, 0.23, 0.2][i], ph: i * 1.7 });
    const glass = { anchor: [2.6, 0.32, 6.1], q: qnorm([0.3, 0.6, 0.1, 0.7]), w: [0.25, 0.4, 0.12], size: 0.5, kick: 0 };
    const ballsArr = new Float32Array(14 * 4);
    let merkPos = [0, 0, 0];
    function updObjects(dt, still, beat, aspect, tanHalf) {
      // where they float: either side of the number (on a tall phone screen: above and below it)
      const portrait = aspect < 0.9;
      const hw = tanHalf * aspect * 6.3;
      glass.size = portrait ? 0.36 : 0.44;
      // keep clear of the number: slide out sideways, and if there's no room, go above / below it
      const Hh = Math.max(1, canvas.height);
      const px2w = (z) => 2 * z * tanHalf / Hh;
      const halfPx = NUM.layoutW * NUM.size * 0.5 * NUM.alpha + 24;
      const needM = halfPx * px2w(6.4) + 0.72, needG = halfPx * px2w(6.1) + glass.size * 1.5;
      const roomM = hw * 0.86, roomG = tanHalf * aspect * 6.1 * 0.86;
      const upM = NUM.size * px2w(6.4) * 1.05 + 0.75, dnG = NUM.size * px2w(6.1) * 1.05 + glass.size * 1.6;
      const hh = tanHalf * 6.3;
      if (portrait || needM > roomM || needG > roomG) {
        // no room beside it: both float up between the number and the top of the screen
        merc.anchor = [-hw * 0.55, clamp(Math.max(hh * 0.5, upM), 0, hh * 0.62), 6.4];
        glass.anchor = [hw * 0.55, clamp(Math.max(hh * 0.46, upM * 0.95), 0, hh * 0.6), 6.1];
        glass.size *= 0.82;
      } else {
        const xm = clamp(Math.max(hw * 0.56, needM), 1.0, roomM), xg = clamp(Math.max(roomG * 0.65, needG), 1.0, roomG);
        merc.anchor = [-xm, 0.15, 6.4];
        glass.anchor = [xg, 0.3, 6.1];
      }
      // mercury: a big drop in zero gravity, wobbling, throwing out little beads that get pulled back in
      const t = cam.t;
      const rp = (a) => add(rigPos, m3v(rigRot, a));
      let center = rp(add(merc.anchor, [Math.sin(t * 0.21) * 0.15, Math.sin(t * 0.33) * 0.12, Math.sin(t * 0.17) * 0.2]));
      if (merc.toCam > 0) { // the dive: it slides in front of the camera and swallows it
        const e = eIO(merc.toCam);
        const front = add(cam.pos, mul(cam.rot[2], 2.4));
        center = add(mul(center, 1 - e), mul(front, e));
      }
      merc.c = center;
      const scale = (1 + merc.grow * 3.2) * (aspect < 0.9 ? 0.72 : 1);
      merc.kick *= Math.exp(-dt * 3);
      for (let i = 0; i < merc.balls.length; i++) {
        const b = merc.balls[i];
        const target = [Math.sin(t * (0.5 + i * 0.13) + b.ph) * 0.19, Math.cos(t * (0.43 + i * 0.11) + b.ph * 1.3) * 0.17, Math.sin(t * (0.37 + i * 0.07) + b.ph * 0.7) * 0.18];
        if (i === 0) target[0] = target[1] = target[2] = 0;
        const f = sub(mul(sub(target, b.o), 9), mul(b.v, 2.2));
        b.v = add(b.v, mul(f, dt));
        if (merc.kick > 0.01 && i) b.v = add(b.v, mul(norm([Math.sin(i * 3.1 + t), Math.cos(i * 1.7), Math.sin(i * 2.3)]), merc.kick * dt * 6));
        b.o = add(b.o, mul(b.v, dt));
      }
      merc.next -= dt * (1 + still);
      if (merc.next <= 0 && merc.drops.length < 6) {
        merc.next = 1.2 + Math.random() * 3;
        const dir = norm([Math.random() * 2 - 1, Math.random() * 1.6 - 0.3, Math.random() * 2 - 1]);
        merc.drops.push({ o: mul(dir, 0.5), v: mul(dir, 1.1 + Math.random() * 0.9), r: 0.05 + Math.random() * 0.06, life: 0 });
        if (R.onSplash) R.onSplash();
      }
      for (const d of merc.drops) {
        d.life += dt;
        const pull = mul(d.o, -3.2);          // surface tension pulls it home
        d.v = add(mul(d.v, Math.exp(-dt * 0.4)), mul(pull, dt));
        d.o = add(d.o, mul(d.v, dt));
      }
      merc.drops = merc.drops.filter((d) => !(d.life > 0.6 && len(d.o) < 0.35) && d.life < 9);
      let n = 0, bound = 0.2;
      const all = merc.balls.map((b) => ({ o: b.o, r: b.r * (1 + 0.06 * beat * (b === merc.balls[0] ? 1 : 0)) })).concat(merc.drops.map((d) => ({ o: d.o, r: d.r })));
      for (const b of all) {
        if (n >= 14) break;   // (main drop first, then the beads)
        const p = add(center, mul(b.o, scale));
        ballsArr[n * 4] = p[0]; ballsArr[n * 4 + 1] = p[1]; ballsArr[n * 4 + 2] = p[2]; ballsArr[n * 4 + 3] = b.r * scale;
        bound = Math.max(bound, len(b.o) * scale + b.r * scale);
        n++;
      }
      merc.n = n; merc.bound = bound + 0.15 * scale; merkPos = center;
      // glass: slow tumble
      glass.kick *= Math.exp(-dt * 1.5);
      const w = add(glass.w, mul(norm([Math.sin(t * 0.3), 1, Math.cos(t * 0.2)]), glass.kick));
      glass.q = qint(glass.q, w, dt);
      glass.pos = rp(add(glass.anchor, [Math.sin(t * 0.27 + 1) * 0.12, Math.sin(t * 0.35) * 0.14, Math.sin(t * 0.19 + 2) * 0.15]));
    }

    // ---------------- dust in the light + sparks
    const MAXP = 2600;
    const pData = new Float32Array(MAXP * 8);
    const pBuf = gl.createBuffer();
    const pVao = gl.createVertexArray();
    gl.bindVertexArray(pVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, pBuf);
    gl.bufferData(gl.ARRAY_BUFFER, pData.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16);
    gl.bindVertexArray(null);
    const dust = [];
    const sparks = [];
    function seedDust(nWant) {
      while (dust.length < nWant) dust.push({ p: [Math.random() * 14 - 7, Math.random() * 9 - 4.5, 1.2 + Math.random() * 12], v: [(Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.04], s: 0.006 + Math.random() * 0.014, ph: Math.random() * TAU });
      dust.length = nWant;
    }
    R.burst = (n, strength) => { // stars blasting out of the number, in 3D
      const c = numberWorldCenter();
      for (let i = 0; i < n; i++) {
        const d = norm([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1]);
        const sp = (1.5 + Math.random() * 5) * (strength || 1);
        const T = 3500 + Math.pow(Math.random(), 0.7) * 26000;
        sparks.push({ p: c.slice(), v: mul(d, sp), life: 0, max: 0.8 + Math.random() * 1.3, s: 0.012 + Math.random() * 0.03, col: bbJS(lut, T), i: 2 + Math.random() * 10 });
      }
      if (sparks.length > 1600) sparks.splice(0, sparks.length - 1600);
    };
    function numberWorldCenter() {
      const [W, Hh] = [Math.max(1, canvas.width), Math.max(1, canvas.height)];
      const tanHalf = Math.tan(cam.fov * Math.PI / 360);
      const zN = 3.2, px2w = 2 * zN * tanHalf / Hh;
      const c = [(NUM.cx - W / 2) * px2w, (Hh / 2 - NUM.cy) * px2w, zN];
      return add(cam.pos, m3v(cam.rot, c));
    }
    function updParticles(dt, lightDir, lightCol, still) {
      seedDust(qv.dust);
      let n = 0;
      for (const d of dust) {
        d.p = add(d.p, mul(d.v, dt * (1 + still)));
        if (d.p[0] < -7) d.p[0] += 14; if (d.p[0] > 7) d.p[0] -= 14;
        if (d.p[1] < -4.5) d.p[1] += 9; if (d.p[1] > 4.5) d.p[1] -= 9;
        if (d.p[2] < 1.2) d.p[2] += 12; if (d.p[2] > 13.2) d.p[2] -= 12;
        const wp = add(rigPos, m3v(rigRot, d.p));
        // forward scattering: dust glows when it's between you and the light
        const toCam = norm(sub(cam.pos, wp));
        const ph = Math.pow(Math.max(0, -dot(toCam, lightDir) * 0.5 + 0.5), 6) * 2.2 + 0.08;
        const tw = 0.7 + 0.3 * Math.sin(cam.t * 1.3 + d.ph);
        const o = n * 8;
        pData[o] = wp[0]; pData[o + 1] = wp[1]; pData[o + 2] = wp[2]; pData[o + 3] = d.s;
        pData[o + 4] = lightCol[0] * ph * tw * 0.5; pData[o + 5] = lightCol[1] * ph * tw * 0.5; pData[o + 6] = lightCol[2] * ph * tw * 0.5; pData[o + 7] = 1;
        n++;
      }
      for (const s of sparks) {
        s.life += dt;
        s.v = mul(s.v, Math.exp(-dt * 1.2));
        s.p = add(s.p, mul(s.v, dt));
        if (n >= MAXP) continue;
        const k = 1 - s.life / s.max;
        if (k <= 0) continue;
        const o = n * 8;
        pData[o] = s.p[0]; pData[o + 1] = s.p[1]; pData[o + 2] = s.p[2]; pData[o + 3] = s.s;
        pData[o + 4] = s.col[0] * s.i * k * k; pData[o + 5] = s.col[1] * s.i * k * k; pData[o + 6] = s.col[2] * s.i * k * k; pData[o + 7] = 1;
        n++;
      }
      for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].life > sparks[i].max) sparks.splice(i, 1);
      return n;
    }

    // ---------------- kicks from the game
    R.kick = (what, amt) => {
      amt = amt || 1;
      if (what === 'milestone') {
        cam.pullV += 5.5 * amt; cam.fovK = Math.max(cam.fovK, 1);
        merc.kick = Math.max(merc.kick, 1.2); glass.kick = Math.max(glass.kick, 2.5);
        NUM.hot = 1; NUM.morph = 0;
        R.burst(Math.round(320 * amt), 1);
      } else if (what === 'level') { merc.kick = Math.max(merc.kick, 0.25); }
      else if (what === 'buy') { NUM.hot = Math.max(NUM.hot, 0.25); }
    };
    // world change: dive into the black hole (or through the liquid metal) and come out somewhere else
    R.dive = (toWorld) => {
      if (dive.on) { setPlace(toWorld); return; }
      dive.on = true; dive.t = 0; dive.from = world; dive.to = toWorld; dive.swapped = false;
      dive.viaMetal = place.kind !== 0;
      nextKey = skyKey(toWorld);
    };
    R.diving = () => dive.on;
    function updDive(dt) {
      if (!dive.on) return { push: 0, flash: 0, fade: 1 };
      dive.t += dt;
      const t = dive.t;
      const IN = 1.15, OUT = 1.35;
      let push = 0, flash = 0, fade = 1;
      if (!dive.swapped) {
        const e = clamp(t / IN, 0, 1);
        push = Math.pow(e, 2.2);
        if (dive.viaMetal) { merc.toCam = sstep(e * 1.15); merc.grow = sstep((e - 0.35) / 0.6); }
        fade = dive.viaMetal ? 1 : 1 - sstep((e - 0.9) / 0.1) * 0.85;
        const nxt = skies[nextKey];
        const ready = nxt && nxt.done;
        if (t >= IN && (ready || t > IN + 2.5)) {
          setPlace(dive.to); dive.swapped = true; dive.t2 = 0;
          merc.toCam = dive.viaMetal ? 1 : 0; merc.grow = dive.viaMetal ? 1 : 0;
          dropSkies([curKey, nextKey, skyKey(0)]);
        }
      } else {
        dive.t2 += dt;
        const e = clamp(dive.t2 / OUT, 0, 1);
        push = 0.9 * (1 - eOut(e));         // come out pulling back from very close
        flash = dive.viaMetal ? 0 : Math.max(0, 1 - dive.t2 / 0.35);
        if (dive.viaMetal) { merc.toCam = 1 - sstep(e * 1.2); merc.grow = 1 - sstep(e * 1.6); }
        if (e >= 1) { dive.on = false; merc.toCam = 0; merc.grow = 0; }
      }
      return { push, flash, fade };
    }

    // ---------------- glass screen that shatters (lives in the camera's space at the moment it broke)
    const SH = { on: false, t: 0, shards: [], rec: [], recT: [], cam0: null, rot0: null, chips: [], floorA: 0, sim: 0, live: 0, tl: null };
    const TL = { slowIn: 0.1, slowOut: 1.5, ramp: 0.32, rewStart: 2.85, rewEnd: 3.7 };
    R.SHATTER = { slamAt: 3.75, endAt: 7.2, rewStart: TL.rewStart };
    let shardVao = null, shardBuf = null, shardCount = 0;
    R.shatterStart = (info) => {
      // info: { w, h (px of the picture), ix, iy (hit point px), angles, crackCanvas }
      const [W, Hh] = [fw, fh];
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, finalFbo);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, snapFbo);
      gl.blitFramebuffer(0, 0, W, Hh, 0, 0, W, Hh, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      if (info.crackCanvas) {
        gl.bindTexture(gl.TEXTURE_2D, crackTex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, info.crackCanvas);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      }
      buildShards(info);
      SH.on = true; SH.t = 0; SH.sim = 0; SH.rec.length = 0; SH.recT.length = 0; SH.chips.length = 0; SH.floorA = 0;
      SH.cam0 = cam.pos.slice(); SH.rot0 = cam.rot.map((c) => c.slice());
    };
    R.shatterStop = () => { SH.on = false; SH.shards.length = 0; SH.chips.length = 0; };
    R.shattering = () => SH.on;
    function buildShards(info) {
      const tanHalf = Math.tan(cam.fov * Math.PI / 360), aspect = info.w / info.h;
      const toG = (px, py) => [((px / info.w) * 2 - 1) * aspect * tanHalf, (1 - (py / info.h) * 2) * tanHalf];
      const toUV = (px, py) => [px / info.w, 1 - py / info.h];
      const ix = info.ix, iy = info.iy, diag = Math.hypot(info.w, info.h);
      const angs = info.angles.slice().sort((a, b) => a - b);
      const radii = [0, 0.03, 0.07, 0.13, 0.21, 0.32, 0.47, 0.68, 1.6];
      const pts = angs.map((a) => radii.map((r, j) => { const q = r * diag * (j ? 0.86 + Math.random() * 0.28 : 0); return [ix + Math.cos(a) * q, iy + Math.sin(a) * q]; }));
      const polys = [];
      for (let i = 0; i < angs.length; i++) {
        const A = pts[i], B = pts[(i + 1) % angs.length];
        for (let j = 0; j < radii.length - 1; j++) {
          if (j === 0) { polys.push([A[0], B[1], A[1]]); continue; }
          const quad = [A[j], B[j], B[j + 1], A[j + 1]];
          // bigger pieces split once more along a random diagonal, like real tempered breaks
          if (j >= 3 && Math.random() < 0.7) {
            if (Math.random() < 0.5) { polys.push([quad[0], quad[1], quad[2]]); polys.push([quad[0], quad[2], quad[3]]); }
            else { polys.push([quad[0], quad[1], quad[3]]); polys.push([quad[1], quad[2], quad[3]]); }
          } else polys.push(quad);
        }
      }
      // clip every piece to the screen
      const inside = (p, e) => (e === 0 ? p[0] >= 0 : e === 1 ? p[0] <= info.w : e === 2 ? p[1] >= 0 : p[1] <= info.h);
      const inter = (a, b, e) => {
        let t;
        if (e === 0) t = (0 - a[0]) / (b[0] - a[0]); else if (e === 1) t = (info.w - a[0]) / (b[0] - a[0]);
        else if (e === 2) t = (0 - a[1]) / (b[1] - a[1]); else t = (info.h - a[1]) / (b[1] - a[1]);
        return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
      };
      const clip = (poly) => {
        let out = poly;
        for (let e = 0; e < 4; e++) {
          const inp = out; out = [];
          for (let i = 0; i < inp.length; i++) {
            const cur = inp[i], prev = inp[(i + inp.length - 1) % inp.length];
            const ci = inside(cur, e), pi = inside(prev, e);
            if (ci) { if (!pi) out.push(inter(prev, cur, e)); out.push(cur); } else if (pi) out.push(inter(prev, cur, e));
          }
          if (!out.length) break;
        }
        return out;
      };
      const verts = [];
      SH.shards.length = 0;
      const TH = 0.0045;
      for (const raw of polys) {
        const poly = clip(raw);
        if (poly.length < 3) continue;
        let area = 0;
        for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; area += a[0] * b[1] - b[0] * a[1]; }
        if (Math.abs(area) < 40) continue;
        let cx = 0, cy = 0; for (const p of poly) { cx += p[0]; cy += p[1]; } cx /= poly.length; cy /= poly.length;
        const gc = toG(cx, cy);
        const first = verts.length / 12;
        const gp = poly.map((p) => toG(p[0], p[1])), uv = poly.map((p) => toUV(p[0], p[1]));
        const ccw = area < 0; // screen y is down, so the sign flips
        const push = (x, y, z, nx, ny, nz, u, v, kind) => verts.push(x, y, z, nx, ny, nz, u, v, kind, 0, 0, 0);
        for (let i = 1; i < gp.length - 1; i++) {
          const ids = ccw ? [0, i, i + 1] : [0, i + 1, i];
          for (const k of ids) push(gp[k][0] - gc[0], gp[k][1] - gc[1], -TH, 0, 0, -1, uv[k][0], uv[k][1], 0);   // front (facing you)
          for (const k of [ids[0], ids[2], ids[1]]) push(gp[k][0] - gc[0], gp[k][1] - gc[1], TH, 0, 0, 1, uv[k][0], uv[k][1], 1);
        }
        for (let i = 0; i < gp.length; i++) {
          const a = gp[i], b = gp[(i + 1) % gp.length];
          const ex = b[0] - a[0], ey = b[1] - a[1], el = Math.hypot(ex, ey) || 1;
          const nx = ccw ? ey / el : -ey / el, ny = ccw ? -ex / el : ex / el;
          const ax = a[0] - gc[0], ay = a[1] - gc[1], bx = b[0] - gc[0], by = b[1] - gc[1];
          const ua = uv[i], ub = uv[(i + 1) % gp.length];
          push(ax, ay, -TH, nx, ny, 0, ua[0], ua[1], 2); push(bx, by, -TH, nx, ny, 0, ub[0], ub[1], 2); push(bx, by, TH, nx, ny, 0, ub[0], ub[1], 2);
          push(ax, ay, -TH, nx, ny, 0, ua[0], ua[1], 2); push(bx, by, TH, nx, ny, 0, ub[0], ub[1], 2); push(ax, ay, TH, nx, ny, 0, ua[0], ua[1], 2);
        }
        const count = verts.length / 12 - first;
        const dx = cx - ix, dy = cy - iy, dist = Math.hypot(dx, dy) || 1;
        const near = 1 / (1 + dist / (0.12 * diag));
        const size = Math.sqrt(Math.abs(area)) / diag;
        let rad = 0;
        for (const p of gp) rad = Math.max(rad, Math.hypot(p[0] - gc[0], p[1] - gc[1]));
        const dirx = dx / dist, diry = -dy / dist;
        SH.shards.push({
          first, count, rad, size,
          p: [gc[0], gc[1], 1], v: [dirx * (0.15 + 0.9 * near) + (Math.random() - 0.5) * 0.12, diry * (0.15 + 0.9 * near) + Math.random() * 0.25, -(0.12 + 0.75 * near + Math.random() * 0.25)],
          q: [0, 0, 0, 1], w: [(Math.random() - 0.5) * 7 * (0.5 + near), (Math.random() - 0.5) * 7 * (0.5 + near), (Math.random() - 0.5) * 4],
          delay: (dist / diag) * 0.06, rest: false, hits: 0, local: gp.map((p) => [p[0] - gc[0], p[1] - gc[1]]),
        });
      }
      if (!shardVao) { shardVao = gl.createVertexArray(); shardBuf = gl.createBuffer(); }
      gl.bindVertexArray(shardVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, shardBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 48, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 48, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 48, 24);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 48, 32);
      gl.bindVertexArray(null);
      shardCount = verts.length / 12;
      SH.floorY = -Math.tan(cam.fov * Math.PI / 360) * 1.32;
    }
    function shardTimeScale(t) {
      if (t < TL.slowIn) return 1;
      if (t < TL.slowOut) return lerp(1, 0.045, sstep((t - TL.slowIn) / 0.12));
      return lerp(0.045, 1, sstep((t - TL.slowOut) / TL.ramp));
    }
    function stepShards(dt) {
      const g = 9.0, fy = SH.floorY;
      for (const s of SH.shards) {
        if (SH.sim < s.delay) continue;
        if (s.rest) continue;
        s.v[1] -= g * dt;
        s.v = mul(s.v, Math.exp(-dt * 0.15));
        s.p = add(s.p, mul(s.v, dt));
        s.q = qint(s.q, s.w, dt);
        // lowest corner vs the floor
        const m = qm3(s.q);
        let low = 1e9;
        for (const l of s.local) for (const z of [-0.0045, 0.0045]) { const wp = m3v(m, [l[0], l[1], z]); low = Math.min(low, wp[1]); }
        const bottom = s.p[1] + low;
        if (bottom < fy) {
          s.p[1] += fy - bottom;
          const vin = -s.v[1];
          if (vin > 0) {
            s.v[1] = vin * 0.28;
            s.v[0] *= 0.55; s.v[2] *= 0.55;
            s.w = mul(s.w, 0.5); s.w = add(s.w, [(Math.random() - 0.5) * vin * 6, 0, (Math.random() - 0.5) * vin * 6]);
            s.hits++;
            if (vin > 0.35 && R.onShardHit) R.onShardHit(vin, s.size, clamp(s.p[0] * 1.5, -1, 1));
            if (vin > 0.8) for (let k = 0; k < 3 + Math.floor(vin * 3); k++) SH.chips.push({ p: [s.p[0], fy + 0.004, s.p[2]], v: [(Math.random() - 0.5) * vin, Math.random() * vin * 0.8, (Math.random() - 0.5) * vin], life: 0, max: 0.4 + Math.random() * 0.6 });
          }
          // settle flat
          if (Math.abs(s.v[1]) < 0.06 && s.hits > 1) {
            s.v = mul(s.v, Math.exp(-dt * 8)); s.w = mul(s.w, Math.exp(-dt * 10));
            const up = m3v(m, [0, 0, 1]);
            const flat = up[1] >= 0 ? [Math.SQRT1_2, 0, 0, -Math.SQRT1_2] : [Math.SQRT1_2, 0, 0, Math.SQRT1_2];
            const yaw = Math.atan2(m[0][2], m[0][0]);
            const yq = [0, Math.sin(-yaw / 2), 0, Math.cos(-yaw / 2)];
            s.q = qslerp(s.q, qmul(yq, flat), 1 - Math.exp(-dt * 6));
            if (len(s.v) < 0.02) s.rest = true;
          }
        }
      }
      for (const c of SH.chips) { c.life += dt; c.v[1] -= g * dt; c.p = add(c.p, mul(c.v, dt)); if (c.p[1] < fy) { c.p[1] = fy; c.v = mul(c.v, 0.3); c.v[1] = Math.abs(c.v[1]); } }
    }
    function updShatter(t, dt) {
      SH.t = t;
      if (t < TL.rewStart) {
        const ts = shardTimeScale(t);
        const sdt = dt * ts;
        // fixed sub steps for steady physics
        const nSub = Math.max(1, Math.ceil(sdt / 0.004));
        for (let i = 0; i < nSub; i++) { SH.sim += sdt / nSub; stepShards(sdt / nSub); }
        SH.rec.push(SH.shards.map((s) => [s.p[0], s.p[1], s.p[2], s.q[0], s.q[1], s.q[2], s.q[3]]));
        SH.recT.push(t);
        SH.floorA = lerp(SH.floorA, 1, 1 - Math.exp(-dt * 2.5));
      } else {
        // rewind: play it all backwards, fast
        const e = eIO((t - TL.rewStart) / (TL.rewEnd - TL.rewStart));
        const idx = (1 - e) * (SH.rec.length - 1);
        const i0 = Math.floor(idx), i1 = Math.min(SH.rec.length - 1, i0 + 1), f = idx - i0;
        const A = SH.rec[i0], B = SH.rec[i1];
        if (A && B) SH.shards.forEach((s, k) => {
          const a = A[k], b = B[k];
          s.p = [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
          s.q = qslerp([a[3], a[4], a[5], a[6]], [b[3], b[4], b[5], b[6]], f);
        });
        SH.floorA = 1 - e;
        SH.chips.length = 0;
      }
      SH.live = sstep((t - TL.rewStart - 0.2) / 0.55);
    }
    // the camera's move during the break, relative to where it was
    function shatterCam(t) {
      const k1 = sstep((t - TL.slowIn) / (TL.slowOut - TL.slowIn));
      const k2 = sstep((t - TL.slowOut) / 0.9);
      const k3 = eIO((t - TL.rewStart) / (TL.rewEnd - TL.rewStart));
      let pos = [0.1 * k1, 0.03 * k1, 0.42 * k1];
      pos = [lerp(pos[0], -0.05, k2), lerp(pos[1], 0.26, k2), lerp(pos[2], -0.75, k2)];
      let yaw = lerp(-0.22 * k1, 0.05, k2), pitch = lerp(0.04 * k1, -0.2, k2), roll = lerp(0.07 * k1, 0, k2);
      pos = mul(pos, 1 - k3); yaw *= 1 - k3; pitch *= 1 - k3; roll *= 1 - k3;
      let rot = m3mul(rotAxis([0, 1, 0], yaw), m3mul(rotAxis([1, 0, 0], -pitch), rotAxis([0, 0, 1], roll)));
      return { pos, rot };
    }
    function drawShards(view, proj, glassToWorld, W, Hh) {
      const P = progs.shard;
      gl.useProgram(P.p);
      gl.bindVertexArray(shardVao);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, snapTex); set(P, 'u_snap', 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, crackTex); set(P, 'u_crack', 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, finalTex); set(P, 'u_live', 2);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_CUBE_MAP, probe ? probe.t : null); set(P, 'u_env', 3);
      set(P, 'u_view', view); set(P, 'u_proj', proj);
      set(P, 'u_g2w', m3f(glassToWorld));
      set(P, 'u_light', norm(m3v(m3t(glassToWorld), lightDirW)));
      set(P, 'u_lightCol', lightColW);
      set(P, 'u_liveMix', SH.live);
      set(P, 'u_res', [W, Hh]);
      if (SH.floorA > 0.02) drawFloor(view, proj, W, Hh);
      for (const mirror of [1, 0]) {
        if (mirror && SH.floorA < 0.02) continue;
        set(P, 'u_mirror', mirror ? SH.floorY : 0);
        set(P, 'u_dim', mirror ? 0.28 * SH.floorA : 1);
        if (mirror) { gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); }
        else { gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.BLEND); }
        for (const s of SH.shards) {
          const m = qm3(s.q);
          set(P, 'u_model', new Float32Array([m[0][0], m[0][1], m[0][2], 0, m[1][0], m[1][1], m[1][2], 0, m[2][0], m[2][1], m[2][2], 0, s.p[0], s.p[1], s.p[2], 1]));
          gl.drawArrays(gl.TRIANGLES, s.first, s.count);
        }
      }
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
    }
    function drawFloor(view, proj, W, Hh) {
      const P = progs.floor;
      gl.useProgram(P.p);
      gl.bindVertexArray(vao);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.DEPTH_TEST);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, finalTex); set(P, 'u_live', 2);
      const inv = invViewProj(view, proj);
      set(P, 'u_invVP', inv); set(P, 'u_vp', mat4mul(proj, view));
      set(P, 'u_floorY', SH.floorY); set(P, 'u_a', SH.floorA); set(P, 'u_res', [W, Hh]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(shardVao);
      gl.useProgram(progs.shard.p);
      gl.disable(gl.BLEND);
    }
    function invViewProj(view, proj) { return invert4(mat4mul(proj, view)); }
    function invert4(m) {
      const inv = new Float32Array(16);
      inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
      inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
      inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
      inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
      inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
      inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
      inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
      inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
      inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
      inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
      inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
      inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
      inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
      inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
      inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
      inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
      let det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
      det = det ? 1 / det : 0;
      for (let i = 0; i < 16; i++) inv[i] *= det;
      return inv;
    }
    function drawChips(view, proj) {
      if (!SH.chips.length) return;
      const P = progs.chip;
      const n = Math.min(SH.chips.length, 400);
      const arr = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { const c = SH.chips[i]; arr[i * 4] = c.p[0]; arr[i * 4 + 1] = c.p[1]; arr[i * 4 + 2] = c.p[2]; arr[i * 4 + 3] = Math.max(0, 1 - c.life / c.max); }
      gl.useProgram(P.p);
      gl.bindVertexArray(pVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, pBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, arr);
      gl.disableVertexAttribArray(1);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
      set(P, 'u_vp', mat4mul(proj, view));
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArrays(gl.POINTS, 0, n);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0);
      gl.enableVertexAttribArray(1);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
    }

    // ---------------- per frame
    let lightDirW = [0, 0, -1], lightColW = [1, 1, 1];
    let frameNo = 0;
    let lastPlaceUniforms = null;
    function heroUniforms(P) {
      bindCommon(P);
      set(P, 'u_kind', place.kind);
      set(P, 'u_hole', [0, 0, 0]);
      set(P, 'u_heroRot', m3f(heroRot));
      const pulse = 1 + 0.18 * NUM.hot;
      set(P, 'u_hA', place.hA);
      set(P, 'u_hB', [place.hB[0], place.hB[1], place.hB[2] * pulse, place.hB[3]]);
      set(P, 'u_hC', place.hC);
      set(P, 'u_sun', norm(place.sun || [1, 0, 0]));
      if (place.kind === 3) {
        const ph = cam.t * 0.35, a = place.hA[1] / 2;
        set(P, 'u_b1', [Math.cos(ph) * a, 0.6 + Math.sin(ph) * a * 0.25, Math.sin(ph) * a * 0.6, place.hA[0]]);
        set(P, 'u_b2', [-Math.cos(ph) * a, 0.6 - Math.sin(ph) * a * 0.25, -Math.sin(ph) * a * 0.6, place.hA[0] * 0.8]);
      }
      set(P, 'u_starAmt', place.star);
      set(P, 'u_skyGain', place.skyGain || 0.08);
      set(P, 'u_skyRot', m3f(I3()));
      const cur = skies[curKey];
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_CUBE_MAP, cur ? cur.c.t : null); set(P, 'u_sky', 2);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_CUBE_MAP, cur ? cur.c.t : null); set(P, 'u_sky2', 3);
      set(P, 'u_skyMix', 0);
      set(P, 'u_jit', (frameNo % 64) * 1.37);
    }
    function placeLight() {
      if (place.kind === 1) return { dir: norm(place.sun), col: mul(bbJS(lut, 5800), 3) };
      const toHero = norm(sub([0, 0, 0], cam.pos));
      const up = place.kind === 0 ? [0, 0.5, 0] : [0, 0.25, 0];
      const k = place.kind === 2 ? 2.2 : place.kind === 3 ? 0.9 : 2.0;
      return { dir: norm(add(toHero, up)), col: mul(bbJS(lut, place.light), k) };
    }

    R.draw = (u, dtMs) => {
      if (!R.ok) return;
      if (!R.ready) {
        R.ready = allReady();
        if (R.failed) { R.ok = false; return; }
        if (!R.ready) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0.01, 0.005, 0.02, 1); gl.clear(gl.COLOR_BUFFER_BIT); return; }
        ensureAtlas();
      }
      frameNo++;
      const dt = Math.min(0.1, (dtMs || 16) / 1000);
      const ts = u.u_timeScale === undefined ? 1 : u.u_timeScale;
      cam.t = u.u_time || 0;
      const [W, Hh] = R.resize();
      sizeFinal(W, Hh);
      const scale = qv.scale * adapt;
      const objK = quality === 'insane' ? 1 : Math.max(0.6, Math.min(1, Math.round(adapt / 0.8 * 10) / 10));
      const OW = Math.max(2, Math.round(W * objK)), OH = Math.max(2, Math.round(Hh * objK));
      sizeObj(OW, OH);
      const w = Math.max(2, Math.round(W * scale / R.uiScale() * Math.min(window.devicePixelRatio || 1, 1.5)));
      const h = Math.max(2, Math.round(Hh * scale / R.uiScale() * Math.min(window.devicePixelRatio || 1, 1.5)));
      sizeScene(w, h);
      if (frameNo % 30 === 0) ensureAtlas();

      // skies: make sure this place's sky exists, then build the next one in the background
      if (u.u_world !== undefined && !dive.on && u.u_world !== world) R.setWorld(u.u_world);
      const cur = skyFor(world);
      if (!cur.done) buildSky(cur, cur.c.size);                 // first time: as fast as possible
      else if (nextKey && nextKey !== curKey) {
        const nw = dive.on ? dive.to : world + 1;
        const nx = skyFor(nw);
        if (!nx.done) buildSky(nx, dive.on ? Math.ceil(nx.c.size / 3) : Math.max(8, Math.ceil(nx.c.size / 48)));
      }

      // camera: the place's rig + film drift + kicks + the dive + the shatter move
      const still = u.u_still || 0;
      const grow = u.u_grow || 0;
      const rig = rigFor(grow);
      rigPos = rig.pos; rigRot = rig.rot;
      cam.pullV += (-cam.pull * 18 - cam.pullV * 6.5) * dt;
      cam.pull += cam.pullV * dt;
      cam.fovK *= Math.exp(-dt * 1.4);
      const dv = updDive(dt);
      const fwd = rig.rot[2];
      let pos = add(rig.pos, mul(fwd, -cam.pull * 2.2));
      if (dive.on) {
        const toHero = sub([0, 0, 0], pos);
        const D = len(toHero);
        const stop = place.kind === 0 ? 1.3 : place.kind === 1 ? place.hA[0] * 1.3 : place.kind === 2 ? 1.4 : 2.6;
        if (!dive.viaMetal) pos = add(pos, mul(norm(toHero), dv.push * Math.max(0, D - stop)));
      }
      const tt = cam.t;
      const amp = 0.004 + 0.003 * Math.min(1, still);
      let rot = m3mul(rig.rot, m3mul(rotAxis([0, 1, 0], wander(tt, 1.0) * amp), m3mul(rotAxis([1, 0, 0], wander(tt, 4.0) * amp), rotAxis([0, 0, 1], wander(tt, 7.0) * amp * 0.6 + (u.u_spin || 0)))));
      pos = add(pos, m3v(rig.rot, [wander(tt * 0.7, 2.0) * 0.06, wander(tt * 0.7, 5.0) * 0.04, 0]));
      if (u.u_shake) rot = m3mul(rot, m3mul(rotAxis([0, 1, 0], Math.sin(tt * 61) * 0.006 * u.u_shake), rotAxis([1, 0, 0], Math.cos(tt * 53) * 0.006 * u.u_shake)));
      if (SH.on) {
        const sc = shatterCam(u.u_shatterT || 0);
        pos = add(SH.cam0, m3v(SH.rot0, sc.pos));
        rot = m3mul(SH.rot0, sc.rot);
      }
      cam.pos = pos; cam.rot = rot;
      cam.fov = place.cam.fov + cam.fovK * 7 + (dive.on ? dv.push * 18 : 0);
      const tanHalf = Math.tan(cam.fov * Math.PI / 360);
      const aspect = W / Hh;
      const L = placeLight();
      lightDirW = L.dir; lightColW = L.col;

      updNumber(dt);
      updObjects(dt * ts, still, u.u_beat || 0, aspect, tanHalf);
      const nPart = updParticles(dt * ts, lightDirW, lightColW, still);
      if (SH.on) updShatter(u.u_shatterT || 0, dt);

      // reflection probe: the lensed world as seen from where the objects float
      if (!probe || probe.size !== qv.probe) { if (probe) gl.deleteTexture(probe.t); probe = cube(qv.probe); }
      const P = progs.hero;
      gl.useProgram(P.p);
      gl.bindVertexArray(vao);
      heroUniforms(P);
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
      const probePos = add(rig.pos, m3v(rig.rot, [0, 0.2, 5.5]));
      set(P, 'u_camPos', probePos);
      set(P, 'u_probe', 1);
      set(P, 'u_steps', Math.round(qv.steps * 0.7));
      set(P, 'u_res', [probe.size, probe.size]);
      set(P, 'u_time', cam.t);
      set(P, 'u_folds', 0); set(P, 'u_scrimA', 0);
      const faces = qv.probe >= 128 ? [frameNo % 2 ? 0 : 3, frameNo % 2 ? 1 : 4, frameNo % 2 ? 2 : 5] : [0, 1, 2, 3, 4, 5];
      for (const f of (frameNo < 3 ? [0, 1, 2, 3, 4, 5] : faces)) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, cubeFbo(probe, f));
        gl.viewport(0, 0, probe.size, probe.size);
        set(P, 'u_face', f);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }

      // pass 1: the hero + the sky
      gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFbo);
      gl.viewport(0, 0, w, h);
      set(P, 'u_probe', 0);
      set(P, 'u_res', [w, h]);
      set(P, 'u_camPos', cam.pos); set(P, 'u_camRot', m3f(cam.rot)); set(P, 'u_tanHalf', tanHalf); set(P, 'u_aspect', aspect);
      set(P, 'u_steps', qv.steps);
      set(P, 'u_folds', u.u_folds || 0);
      const sx = w / W, sy = h / Hh;
      const scrimW = Math.max(R.numberWidth() * 0.62, 160), scrimH = NUM.size * 0.85;
      set(P, 'u_scrim', [NUM.cx * sx, h - NUM.cy * sy, scrimW * sx, scrimH * sy]);
      set(P, 'u_scrimA', 0.55 * NUM.alpha);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // pass 2: the number, the mercury, the glass (they write depth) at full resolution
      gl.bindFramebuffer(gl.FRAMEBUFFER, objFbo);
      gl.viewport(0, 0, OW, OH);
      gl.clearColor(0, 0, 0, 0); gl.depthMask(true); gl.clearDepth(1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const O = progs.obj;
      gl.useProgram(O.p);
      bindCommon(O);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_CUBE_MAP, probe.t); set(O, 'u_probe', 2);
      gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, AT.tex); set(O, 'u_atlas', 4);
      set(O, 'u_res', [OW, OH]); set(O, 'u_camPos', cam.pos); set(O, 'u_camRot', m3f(cam.rot)); set(O, 'u_tanHalf', tanHalf); set(O, 'u_aspect', aspect);
      set(O, 'u_time', cam.t); set(O, 'u_proj', [0.02, 600, 0, 0]); set(O, 'u_steps', qv.numSteps);
      numberUniforms(O, W, Hh, tanHalf);
      set(O, 'u_nBalls', merc.n); set(O, 'u_balls', ballsArr);
      set(O, 'u_merc', [merkPos[0], merkPos[1], merkPos[2], merc.bound]);
      set(O, 'u_mercK', 0.34 * (1 + merc.grow * 3)); set(O, 'u_mercOn', 1); set(O, 'u_ripple', 0.5 + still * 0.6);
      set(O, 'u_gPos', glass.pos); set(O, 'u_gRot', m3f(qm3(glass.q))); set(O, 'u_gSize', [glass.size, glass.size, glass.size, glass.size * 0.16]);
      set(O, 'u_gOn', 1); set(O, 'u_disp', qv.disp);
      set(O, 'u_lightDir', lightDirW); set(O, 'u_lightCol', lightColW);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.ALWAYS); gl.depthMask(true);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      if (!R.flags.noObj) gl.drawArrays(gl.TRIANGLES, 0, 3);

      // pass 3: dust + sparks
      const proj = perspective(cam.fov * Math.PI / 180, aspect, 0.02, 600);
      const view = viewMat(cam.pos, cam.rot);
      if (nPart && !R.flags.noDust) {
        const PP = progs.part;
        gl.useProgram(PP.p);
        gl.bindVertexArray(pVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, pBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, pData, 0, nPart * 8);
        set(PP, 'u_vp', mat4mul(proj, view));
        set(PP, 'u_pxScale', OH / (2 * tanHalf));
        gl.depthFunc(gl.LEQUAL); gl.depthMask(false);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.drawArrays(gl.POINTS, 0, nPart);
        gl.depthMask(true);
      }
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
      gl.bindVertexArray(vao);

      // bloom chain
      const D = progs.down, Up = progs.up;
      const nm = Math.min(mips.length, qv.bloom);
      gl.useProgram(D.p);
      let src = sceneTex, srcW = w, srcH = h;
      for (let i = 0; i < nm; i++) {
        const m = mips[i];
        gl.bindFramebuffer(gl.FRAMEBUFFER, m.f);
        gl.viewport(0, 0, m.w, m.h);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src); set(D, 'u_src', 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, objTex); set(D, 'u_obj', 1);
        set(D, 'u_srcTexel', [1 / srcW, 1 / srcH]); set(D, 'u_dst', [m.w, m.h]); set(D, 'u_karis', i === 0 ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        src = m.t; srcW = m.w; srcH = m.h;
      }
      gl.useProgram(Up.p);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      for (let i = nm - 1; i > 0; i--) {
        const s0 = mips[i], d0 = mips[i - 1];
        gl.bindFramebuffer(gl.FRAMEBUFFER, d0.f);
        gl.viewport(0, 0, d0.w, d0.h);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s0.t); set(Up, 'u_src', 0);
        set(Up, 'u_srcTexel', [1 / s0.w, 1 / s0.h]); set(Up, 'u_dst', [d0.w, d0.h]); set(Up, 'u_radius', 1.0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      gl.disable(gl.BLEND);

      // the lens + the HUD
      const PO = progs.post;
      gl.useProgram(PO.p);
      bindCommon(PO);
      gl.bindFramebuffer(gl.FRAMEBUFFER, finalFbo);
      gl.viewport(0, 0, W, Hh);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, sceneTex); set(PO, 'u_scene', 2);
      gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, objTex); set(PO, 'u_obj', 6);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, mips[0].t); set(PO, 'u_bloom', 3);
      gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, mips[Math.min(2, mips.length - 1)].t); set(PO, 'u_streak', 4);
      gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, uiTex); set(PO, 'u_ui', 5);
      set(PO, 'u_res', [W, Hh]); set(PO, 'u_time', u.u_time || 0);
      set(PO, 'u_exposure', (u.u_exposure || 1) * (place.kind === 1 ? 0.9 : 1.05));
      set(PO, 'u_bloomAmt', 0.04 + 0.025 * Math.min(1, still));
      set(PO, 'u_streakAmt', 0.012);
      for (const k of ['u_glitch', 'u_lens', 'u_shock', 'u_rewind', 'u_flip', 'u_mirror', 'u_melt', 'u_invert', 'u_uiWarp', 'u_scan', 'u_shake', 'u_hue']) if (u[k] !== undefined) set(PO, k, u[k]);
      set(PO, 'u_flash', (u.u_flash || 0) + dv.flash * (u.u_flashOK === false ? 0.12 : 0.9));
      set(PO, 'u_flashCol', dv.flash > 0.01 ? [1, 1, 1] : (u.u_flashCol || [1, 1, 1]));
      set(PO, 'u_uiOn', u.u_uiOn === undefined ? 1 : u.u_uiOn);
      set(PO, 'u_fade', dv.fade);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // to the screen
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, Hh);
      const CP = progs.copy;
      gl.useProgram(CP.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, finalTex); set(CP, 'u_src', 0); set(CP, 'u_res', [W, Hh]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (SH.on && shardCount) {
        gl.clearDepth(1); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT);
        // shards live in the space of the camera at the moment of the break
        const sc = shatterCam(SH.t);
        const sproj = perspective(cam.fov * Math.PI / 180, W / Hh, 0.01, 50);
        const sview = viewMat(sc.pos, sc.rot);
        drawShards(sview, sproj, SH.rot0, W, Hh);
        drawChips(sview, sproj);
      }

      // keep it smooth: MAX drops resolution (never effects) if frames take too long; INSANE never does
      if (quality !== 'insane' && dtMs > 0 && !R.flags.noAdapt) {
        times.push(dtMs);
        if (times.length >= 40) {
          times.sort((a, b) => a - b);
          const med = times[20];
          times.length = 0;
          const floor = quality === 'max' ? 0.5 : 0.6;
          if (med > 30 && adapt > floor) adapt = Math.max(floor, adapt * 0.88);
          else if (med < 18 && adapt < 1) adapt = Math.min(1, adapt * 1.05);
        }
      }
    };

    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); R.ok = false; }, false);
    R.ok = true;
    R.gl = gl;
    R.debug = { cam, NUM, merc, glass, SH, skies, dive, get place() { return place; }, get world() { return world; } };
    return R;
  }

  // ---------------------------------------------------------------- shard / floor / chip programs
  const SHARD_V = `#version 300 es
layout(location = 0) in vec3 a_pos;
layout(location = 1) in vec3 a_nrm;
layout(location = 2) in vec2 a_uv;
layout(location = 3) in float a_kind;
uniform mat4 u_model, u_view, u_proj;
uniform float u_mirror;
out vec3 v_p; out vec3 v_n; out vec2 v_uv; out float v_kind;
void main(){
  vec4 wp = u_model*vec4(a_pos, 1.0);
  vec3 n = mat3(u_model)*a_nrm;
  if (u_mirror != 0.0) { wp.y = 2.0*u_mirror - wp.y; n.y = -n.y; }
  v_p = wp.xyz; v_n = n; v_uv = a_uv; v_kind = a_kind;
  gl_Position = u_proj*u_view*wp;
}`;
  const SHARD_F = `#version 300 es
precision highp float;
precision highp samplerCube;
in vec3 v_p; in vec3 v_n; in vec2 v_uv; in float v_kind;
uniform sampler2D u_snap, u_crack, u_live;
uniform samplerCube u_env;
uniform mat4 u_view;
uniform mat3 u_g2w;
uniform vec3 u_light, u_lightCol;
uniform float u_liveMix, u_dim;
uniform vec2 u_res;
out vec4 o;
vec3 tone(vec3 x){ x *= 0.8; return x/(1.0 + x); }
void main(){
  mat3 vr = transpose(mat3(u_view));
  vec3 camP = -vr*u_view[3].xyz;
  vec3 V = normalize(camP - v_p);
  vec3 n = normalize(v_n);
  if (dot(n, V) < 0.0) n = -n;
  float c = abs(dot(n, V));
  float F = 0.04 + 0.96*pow(1.0 - c, 5.0);
  vec3 R = reflect(-V, n);
  vec3 env = tone(texture(u_env, u_g2w*R).rgb)*1.4;
  float spec = pow(max(dot(R, u_light), 0.0), 140.0)*2.5 + pow(max(dot(R, normalize(vec3(-0.4, 0.8, -0.3))), 0.0), 60.0)*0.5;
  vec3 col;
  if (v_kind < 1.5) {
    vec3 img = mix(texture(u_snap, v_uv).rgb, texture(u_live, v_uv).rgb, u_liveMix);
    vec4 ck = texture(u_crack, v_uv);
    img = img*(1.0 - ck.a*(1.0 - u_liveMix)) + ck.rgb*(1.0 - u_liveMix);
    if (v_kind > 0.5) img *= 0.55;                     // the back side of the picture
    // a hint of what's behind, bent by the glass
    vec2 suv = gl_FragCoord.xy/u_res + n.xy*0.02;
    vec3 behind = texture(u_live, suv).rgb;
    col = mix(img*0.93, behind, 0.06)*(1.0 - F) + env*F + u_lightCol*spec*0.35;
    col *= mix(vec3(1.0), vec3(0.9, 1.0, 0.96), pow(1.0 - c, 2.0));
  } else {
    // the cut edge: thick glass, dark green inside, a bright line where it catches the light
    vec2 suv = gl_FragCoord.xy/u_res + n.xy*0.03;
    vec3 thru = texture(u_live, suv).rgb*vec3(0.35, 0.55, 0.48);
    col = thru + vec3(0.1, 0.2, 0.17)*(0.3 + 0.7*pow(1.0 - c, 2.0)) + env*0.35 + u_lightCol*spec*0.9;
  }
  o = vec4(col*u_dim, 1.0);
}`;
  const FLOOR_F = `#version 300 es
precision highp float;
uniform sampler2D u_live;
uniform mat4 u_invVP, u_vp;
uniform float u_floorY, u_a;
uniform vec2 u_res;
out vec4 o;
void main(){
  vec2 ndc = gl_FragCoord.xy/u_res*2.0 - 1.0;
  vec4 a = u_invVP*vec4(ndc, -1.0, 1.0), b = u_invVP*vec4(ndc, 1.0, 1.0);
  vec3 ro = a.xyz/a.w, rd = normalize(b.xyz/b.w - ro);
  if (rd.y >= -1e-4) discard;
  float t = (u_floorY - ro.y)/rd.y;
  if (t <= 0.0 || t > 40.0) discard;
  vec3 p = ro + rd*t;
  // what the floor mirrors: the same picture, flipped across the horizon
  vec3 rr = reflect(rd, vec3(0.0, 1.0, 0.0));
  vec4 cp = u_vp*vec4(p + rr*30.0, 1.0);
  vec2 ruv = cp.xy/cp.w*0.5 + 0.5;
  vec3 refl = texture(u_live, clamp(ruv, 0.0, 1.0)).rgb;
  float fres = 0.04 + 0.96*pow(1.0 - abs(rd.y), 5.0);
  float edge = smoothstep(40.0, 6.0, t);
  vec3 col = vec3(0.004, 0.004, 0.008) + refl*(0.12 + 0.6*fres);
  o = vec4(col, u_a*edge*0.92);
}`;
  const CHIP_V = `#version 300 es
layout(location = 0) in vec4 a_p;
uniform mat4 u_vp;
out float v_a;
void main(){ vec4 c = u_vp*vec4(a_p.xyz, 1.0); gl_Position = c; gl_PointSize = clamp(5.0/max(c.w, 0.05), 1.0, 6.0); v_a = a_p.w; }`;
  const CHIP_F = `#version 300 es
precision highp float;
in float v_a;
out vec4 o;
void main(){ vec2 d = gl_PointCoord*2.0 - 1.0; if (dot(d, d) > 1.0) discard; o = vec4(vec3(0.8, 0.95, 1.0)*v_a, 1.0); }`;

  root.HOGFX2 = { create, PLACES };
})(typeof window !== 'undefined' ? window : globalThis);
