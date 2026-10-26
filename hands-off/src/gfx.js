/* HANDS OFF: the GPU side. Pass 1 draws the world into a smaller texture, pass 2 breaks it (and the HUD) onto the screen. */
(function (root) {
  'use strict';

  const HEAD = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
  const VERT = 'attribute vec2 a_pos;\nvoid main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }\n';

  const COMMON = `
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y);
}
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
`;

  // ---------------- pass 1: the world ----------------
  const SCENE = HEAD + COMMON + `
uniform vec2 u_res;
uniform float u_time;
uniform float u_still;   // 0..1.5 how broken reality is (grows while you hold still)
uniform vec3 u_mix;      // chrome, glitch, black hole weights for this world
uniform float u_hue;     // palette shift
uniform float u_folds;   // kaleidoscope folds, 0 = none
uniform float u_pulse;   // milestone kick, decays to 0
uniform float u_grow;    // 0..1 how big the center gets
uniform float u_beat;    // music beat 0..1
uniform float u_steps;   // raymarch steps
uniform float u_spin;    // extra spin from events

float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a*noise(p); p = rot(0.6)*p*2.03 + 7.1; a *= 0.5; }
  return v;
}
// dark neon palette: deep violet -> cyan -> magenta -> hot orange
vec3 pal(float t){
  t = fract(t + u_hue);
  vec3 a = vec3(0.18, 0.05, 0.42), b = vec3(0.05, 0.85, 0.95), c = vec3(0.95, 0.15, 0.75), d = vec3(1.0, 0.55, 0.15);
  if (t < 0.25) return mix(a, b, t*4.0);
  if (t < 0.5) return mix(b, c, (t-0.25)*4.0);
  if (t < 0.75) return mix(c, d, (t-0.5)*4.0);
  return mix(d, a, (t-0.75)*4.0);
}

vec3 sky(vec2 p){
  float t = u_time*0.035;
  if (u_folds > 0.5) { // kaleidoscope: folds everything in the sky, not just the gas
    float a = atan(p.y, p.x), seg = 6.28318/u_folds;
    a = mod(a + t*0.5, seg); a = abs(a - seg*0.5);
    p = length(p)*vec2(cos(a), sin(a));
  }
  vec2 q = p*1.5;
  vec2 w = vec2(fbm(q + t), fbm(q + vec2(5.2, 1.3) - t));
  float n = fbm(q + (1.6 + u_still*1.4)*w + 0.3*sin(t*4.0 + u_still*3.0));
  // two clouds of colored gas
  vec3 col = mix(vec3(0.006, 0.0, 0.02), pal(n*0.5 + 0.08*w.y)*0.75, smoothstep(0.38, 1.0, n));
  col += pal(w.x*0.7 + 0.45)*0.30*pow(smoothstep(0.45, 1.05, w.y*1.2), 2.0)*(0.7 + 0.6*u_still);
  // spacetime grid: bends around the hole, breathes with the beat, burns brighter the longer you hold still
  vec2 gq = p*5.0 + vec2(0.0, t*3.0);
  gq += 0.12*u_still*vec2(sin(gq.y*1.7 + u_time), cos(gq.x*1.3 - u_time*0.8));
  vec2 gf = abs(fract(gq) - 0.5);
  float gridl = smoothstep(0.035 + 0.02*u_beat, 0.0, min(gf.x, gf.y));
  col += pal(0.3)*gridl*(0.05 + 0.13*u_still)*smoothstep(1.4, 0.2, length(p));
  // warp streaks shooting out of the center
  float ra = atan(p.y, p.x), rr = length(p);
  float streak = pow(noise(vec2(ra*38.0, rr*2.5 - u_time*(1.5 + 3.0*u_still))), 7.0);
  col += pal(0.55 + rr*0.2)*streak*smoothstep(0.08, 0.7, rr)*(0.15 + 0.85*u_still);
  // stars
  vec2 g = p*80.0, id = floor(g), f = fract(g) - 0.5;
  float h = hash(id);
  vec2 o = vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5;
  float star = step(0.982, h)*smoothstep(0.09, 0.0, length(f + o*0.6));
  col += star*(0.55 + 0.45*sin(u_time*2.5 + h*60.0))*vec3(0.9, 0.95, 1.0);
  return col;
}

// ---- black hole ----
vec3 hole(vec2 p, float rs, vec3 col){
  float r = length(p);
  float spd = 1.0 + u_still*1.8;
  // the far side of the disk, bent over the top and bottom of the shadow
  float ringR = rs*1.25;
  float ring = smoothstep(rs*0.42, 0.0, abs(r - ringR))*(0.55 + 0.45*abs(p.y)/max(r, 1e-3));
  float swirl = noise(vec2(atan(p.y, p.x)*6.0 - u_time*spd*1.5, r*30.0));
  vec3 hot = mix(vec3(1.0, 0.45, 0.12), vec3(1.0, 0.9, 0.75), swirl);
  col += hot*ring*(0.6 + 0.6*swirl)*0.9;
  // the shadow
  col *= smoothstep(rs*0.92, rs*1.08, r);
  // photon ring
  col += vec3(1.0, 0.85, 0.65)*smoothstep(rs*0.06, 0.0, abs(r - rs*1.05))*1.4;
  // the near side of the disk crossing in front
  vec2 dp = vec2(p.x, p.y*3.4 - rs*0.05);
  float dr = length(dp);
  float band = smoothstep(rs*1.15, rs*1.5, dr)*(1.0 - smoothstep(rs*2.6, rs*4.6, dr));
  float ang = atan(dp.y, dp.x);
  float streak = noise(vec2(ang*5.0 + u_time*spd*2.2/(dr*4.0 + 0.3), dr*26.0));
  streak = 0.35 + 0.9*streak*streak;
  float dop = 1.0 + 0.75*(-p.x/max(dr, 1e-3)); // the side spinning toward you is brighter
  vec3 dcol = mix(vec3(1.0, 0.35, 0.08), vec3(1.0, 0.92, 0.8), smoothstep(rs*3.5, rs*1.3, dr));
  float front = step(0.0, -p.y) + step(0.0, p.y)*smoothstep(rs*1.02, rs*1.25, r); // hidden behind the shadow on the top half
  col += dcol*band*streak*dop*front*(0.9 + u_pulse*0.8);
  return col;
}

// ---- liquid chrome ----
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5*(b - a)/k, 0.0, 1.0); return mix(b, a, h) - k*h*(1.0 - h); }
float S;
float blob(vec3 q){
  float t = u_time*0.55;
  float k = 0.30 + 0.18*u_still;
  vec3 a = vec3(sin(t*1.1), cos(t*0.9), sin(t*0.7))*0.36*S;
  vec3 b = vec3(cos(t*0.8 + 1.0), sin(t*1.3), cos(t*1.2))*0.40*S;
  vec3 c = vec3(sin(t*0.5 + 2.0), sin(t*1.7 + 1.0), cos(t*0.6))*0.34*S;
  float d = smin(length(q - a) - 0.40*S, length(q - b) - 0.34*S, k*S);
  d = smin(d, length(q - c) - 0.28*S, k*S);
  d = smin(d, length(q) - (0.42 + 0.08*u_beat)*S, k*S);
  float w = (0.025 + 0.05*u_still)*S;
  d += w*sin(q.x*7.0/S + t*2.0)*sin(q.y*8.0/S - t*1.3)*sin(q.z*6.0/S + t*1.7);
  return d;
}
vec3 env(vec3 d){
  float y = d.y;
  vec3 c = mix(vec3(0.01, 0.0, 0.03), pal(0.15 + y*0.25)*0.7, smoothstep(-0.6, 0.9, y));
  c += smoothstep(0.93, 1.0, abs(sin(y*5.0 + d.x*1.5 + u_time*0.25)))*vec3(1.2, 1.15, 1.3);
  c += smoothstep(0.985, 1.0, abs(sin(d.x*9.0 - u_time*0.4)))*0.8*pal(0.55);
  c += pal(0.62)*pow(max(0.0, -d.z), 6.0)*0.6;
  return c;
}
vec4 chrome(vec2 p){
  vec3 ro = vec3(0.0, 0.0, -3.0), rd = normalize(vec3(p, 1.75));
  // skip pixels that can't hit it
  float b = dot(ro, rd), c = dot(ro, ro) - (1.25*S)*(1.25*S);
  if (b*b - c < 0.0) return vec4(0.0);
  float t = -b - sqrt(max(b*b - c, 0.0));
  t = max(t, 0.5);
  float hit = 0.0;
  for (int i = 0; i < 96; i++) {
    if (float(i) >= u_steps) break;
    float d = blob(ro + rd*t);
    if (d < 0.0015) { hit = 1.0; break; }
    t += d*0.9;
    if (t > 6.0) break;
  }
  if (hit < 0.5) return vec4(0.0);
  vec3 pos = ro + rd*t;
  vec2 e = vec2(0.002, -0.002);
  vec3 n = normalize(e.xyy*blob(pos + e.xyy) + e.yyx*blob(pos + e.yyx) + e.yxy*blob(pos + e.yxy) + e.xxx*blob(pos + e.xxx));
  vec3 v = -rd;
  float fres = pow(1.0 - max(dot(n, v), 0.0), 2.5);
  vec3 film = pal(fres*1.3 + n.y*0.25 + u_time*0.04 + 0.3); // rainbow hologram film
  vec3 col = env(reflect(rd, n))*mix(vec3(0.9), film, 0.35 + 0.35*u_still);
  col += film*fres*0.55;
  vec3 ld = normalize(vec3(-0.5, 0.8, -0.6));
  col += vec3(1.0)*pow(max(dot(reflect(-ld, n), v), 0.0), 40.0)*1.2;
  return vec4(col, 1.0);
}

// ---- glitch cube ----
float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba)/dot(ba, ba), 0.0, 1.0); return length(pa - ba*h); }
vec2 proj(vec3 v){ return v.xy/(v.z + 3.0)*2.6; }
vec3 cube(vec2 p, float sz, float spin){
  float t = u_time*(0.35 + 0.6*u_still) + spin;
  mat2 ra = rot(t), rb = rot(t*0.73 + 1.0);
  float d = 10.0;
  // 8 corners
  vec3 c0 = vec3(-1,-1,-1), c1 = vec3(1,-1,-1), c2 = vec3(1,1,-1), c3 = vec3(-1,1,-1);
  vec3 c4 = vec3(-1,-1,1), c5 = vec3(1,-1,1), c6 = vec3(1,1,1), c7 = vec3(-1,1,1);
  #define TR(c) (vec3((ra*(c).xz).x, (c).y, (ra*(c).xz).y))
  #define TR2(c) vec3(TR(c).x, (rb*TR(c).yz).x, (rb*TR(c).yz).y)
  vec2 a0 = proj(TR2(c0)*sz), a1 = proj(TR2(c1)*sz), a2 = proj(TR2(c2)*sz), a3 = proj(TR2(c3)*sz);
  vec2 a4 = proj(TR2(c4)*sz), a5 = proj(TR2(c5)*sz), a6 = proj(TR2(c6)*sz), a7 = proj(TR2(c7)*sz);
  d = min(d, seg(p, a0, a1)); d = min(d, seg(p, a1, a2)); d = min(d, seg(p, a2, a3)); d = min(d, seg(p, a3, a0));
  d = min(d, seg(p, a4, a5)); d = min(d, seg(p, a5, a6)); d = min(d, seg(p, a6, a7)); d = min(d, seg(p, a7, a4));
  d = min(d, seg(p, a0, a4)); d = min(d, seg(p, a1, a5)); d = min(d, seg(p, a2, a6)); d = min(d, seg(p, a3, a7));
  float px = 1.5/min(u_res.x, u_res.y);
  float line = smoothstep(px*2.5, 0.0, d);
  float glow = smoothstep(0.06, 0.0, d)*0.35;
  // static inside its shadow
  float inside = smoothstep(sz*1.05, sz*0.85, max(abs(p.x), abs(p.y))/0.9);
  float st = hash(floor(p*u_res.y*0.22) + floor(u_time*30.0));
  float bands = step(0.5, fract(p.y*14.0 - u_time*3.0));
  vec3 col = vec3(st)*inside*(0.10 + 0.12*bands)*(0.5 + u_still);
  col += (line + glow)*mix(vec3(0.15, 1.0, 0.95), vec3(1.0, 0.2, 0.75), 0.5 + 0.5*sin(u_time + p.y*4.0));
  return col;
}

void main(){
  vec2 p = (gl_FragCoord.xy - 0.5*u_res)/min(u_res.x, u_res.y); // sized by the short side, so phones fit too
  p.y -= 0.035; // center sits a little above the middle of the screen
  float pulse = u_pulse*u_pulse;
  float grow = 0.75 + 0.35*u_grow + 0.12*pulse + 0.04*u_beat;
  float rs = 0.135*grow*u_mix.z;

  // gravity bends the sky around the hole
  vec2 sp = p;
  float r = length(p);
  if (u_mix.z > 0.01) sp = p - normalize(p + 1e-5)*min(rs*rs*2.3/max(r, 1e-3), r*0.97);
  vec3 col = sky(sp);
  col *= 0.8 + 0.2*u_still;

  if (u_mix.z > 0.01) col = hole(p, rs, col);
  if (u_mix.y > 0.01) col += cube(p, 0.30*grow*(0.7 + 0.3*u_mix.y)*(u_mix.z > 0.3 ? 1.25 : 1.0), u_spin)*u_mix.y;
  if (u_mix.x > 0.01) {
    S = 0.9*grow*(0.55 + 0.45*u_mix.x);
    vec2 cp = p;
    if (u_mix.z > 0.3) { // orbits the black hole
      S *= 0.55;
      float ot = u_time*0.35;
      cp -= vec2(cos(ot)*0.36, sin(ot)*0.09);
    }
    vec4 c = chrome(cp);
    col = mix(col, c.rgb, c.a*smoothstep(0.0, 0.25, u_mix.x));
  }
  col += pal(0.1)*(pulse*0.35 + 0.06 + 0.06*u_still)*smoothstep(0.75, 0.0, r);
  gl_FragColor = vec4(col, 1.0);
}`;

  // ---------------- pass 2: break it ----------------
  const POST = HEAD + COMMON + `
uniform sampler2D u_scene;
uniform sampler2D u_ui;
uniform vec2 u_res;
uniform vec2 u_sceneRes;
uniform float u_time;
uniform float u_glitch;
uniform vec3 u_lens;      // xy center (0..1), z strength
uniform vec3 u_shock;     // xy center, z age 0..1
uniform float u_rewind;
uniform float u_flash;
uniform vec3 u_flashCol;
uniform float u_flip;
uniform float u_mirror;
uniform float u_melt;
uniform float u_invert;
uniform float u_uiWarp;
uniform float u_scan;
uniform float u_shake;

void main(){
  vec2 uv = gl_FragCoord.xy/u_res;
  float aspect = u_res.x/u_res.y;
  vec2 c = uv - 0.5;
  // shake
  c += u_shake*0.012*vec2(sin(u_time*71.0), cos(u_time*63.0));
  // flip the whole world upside down
  if (u_flip > 0.001) { vec2 a = vec2(c.x*aspect, c.y)*rot(u_flip*3.14159); c = vec2(a.x/aspect, a.y); }
  // mirror flip, squashing through the middle
  if (u_mirror > 0.001) { float k = cos(u_mirror*3.14159); c.x = c.x/(abs(k) < 0.04 ? 0.04*sign(k + 1e-4) : k); }
  uv = c + 0.5;

  // shockwave ring
  vec2 d = vec2((uv.x - u_shock.x)*aspect, uv.y - u_shock.y);
  float dl = length(d);
  float ring = u_shock.z*1.25;
  float sq = (dl - ring)/0.075;
  float amp = (1.0 - u_shock.z)*0.045*exp(-sq*sq); // squared by hand: pow() of a negative number is undefined on some GPUs
  vec2 shockOff = dl > 0.0001 ? vec2(d.x/aspect, d.y)/dl*amp : vec2(0.0);

  // lens near the black hole (bends the HUD a little too)
  vec2 ld = vec2((uv.x - u_lens.x)*aspect, uv.y - u_lens.y);
  float lr = length(ld);
  vec2 lensOff = lr > 0.0001 ? -vec2(ld.x/aspect, ld.y)/lr*u_lens.z*0.006/(lr*lr*8.0 + 0.06) : vec2(0.0);

  // glitch: torn horizontal slices
  float row = floor(uv.y*48.0);
  float tick = floor(u_time*14.0);
  float g = hash(vec2(row, tick));
  float tear = step(1.0 - u_glitch*0.28, g)*(hash(vec2(row*3.1, tick + 1.0)) - 0.5)*0.12*u_glitch;
  float block = step(1.0 - u_glitch*0.06, hash(vec2(floor(uv.x*12.0), floor(uv.y*9.0) + tick*7.0)))*0.04*u_glitch;
  // VHS rewind wobble
  float vhs = u_rewind*(sin(uv.y*60.0 + u_time*90.0)*0.004 + (hash(vec2(floor(uv.y*90.0), floor(u_time*40.0))) - 0.5)*0.012);

  vec2 su = uv + shockOff + vec2(tear + block + vhs, 0.0);
  float ca = 0.0012 + u_glitch*0.0075 + u_rewind*0.006 + u_flash*0.003;
  vec3 col;
  col.r = texture2D(u_scene, su + vec2(ca, 0.0)).r;
  col.g = texture2D(u_scene, su).g;
  col.b = texture2D(u_scene, su - vec2(ca, 0.0)).b;
  // cheap glow from the small world texture
  vec2 px = 2.5/u_sceneRes;
  vec3 gl = texture2D(u_scene, su + vec2(px.x, 0.0)).rgb + texture2D(u_scene, su - vec2(px.x, 0.0)).rgb
          + texture2D(u_scene, su + vec2(0.0, px.y)).rgb + texture2D(u_scene, su - vec2(0.0, px.y)).rgb;
  col += max(gl*0.25 - 0.55, 0.0)*0.9;

  // the HUD bends + glitches a little with reality, but stays readable
  vec2 uu = uv + (shockOff + lensOff + vec2(tear*0.35 + vhs, 0.0))*u_uiWarp;
  if (u_melt > 0.001) {
    float colm = floor(uu.x*90.0);
    uu.y += u_melt*(0.02 + 0.09*hash(vec2(colm, 3.0)))*(0.6 + 0.4*sin(u_time*2.0 + colm));
  }
  float uca = ca*0.35*u_uiWarp;
  vec4 ui = texture2D(u_ui, uu);
  vec4 uiR = texture2D(u_ui, uu + vec2(uca, 0.0));
  vec4 uiB = texture2D(u_ui, uu - vec2(uca, 0.0));
  vec3 uic = vec3(uiR.r, ui.g, uiB.b);
  float ua = max(ui.a, max(uiR.a, uiB.a));
  col = col*(1.0 - ua) + uic;

  // rewind tape look
  if (u_rewind > 0.001) {
    float lines = step(0.965, hash(vec2(floor(uv.y*140.0), floor(u_time*50.0))));
    float band = smoothstep(0.06, 0.0, abs(fract(uv.y*0.7 + u_time*1.8) - 0.5));
    float lum = dot(col, vec3(0.3, 0.59, 0.11));
    col = mix(col, vec3(lum)*vec3(0.85, 0.95, 1.15), 0.45*u_rewind);
    col += (lines*0.35 + band*0.25)*u_rewind;
  }
  // scanlines, vignette, grain
  col *= 1.0 - u_scan*0.18*(0.5 + 0.5*sin(gl_FragCoord.y*3.14159));
  float vig = smoothstep(1.25, 0.25, length(vec2((uv.x - 0.5)*aspect, uv.y - 0.5)));
  col *= mix(1.0, vig, 0.55);
  col += (hash(gl_FragCoord.xy + fract(u_time)*100.0) - 0.5)*0.035;
  col = mix(col, 1.0 - col, u_invert);
  col += u_flashCol*u_flash;
  gl_FragColor = vec4(col, 1.0);
}`;

  function create(canvas, opt) {
    opt = opt || {};
    const R = { ok: false, error: '' };
    let gl = null;
    try {
      gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    } catch (e) { gl = null; }
    if (!gl) { R.error = 'WebGL is off'; return R; }

    function sh(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { R.error = gl.getShaderInfoLog(s) || 'shader failed'; return null; }
      return s;
    }
    function program(fsrc) {
      const v = sh(gl.VERTEX_SHADER, VERT), f = v && sh(gl.FRAGMENT_SHADER, fsrc);
      if (!v || !f) return null;
      const p = gl.createProgram();
      gl.attachShader(p, v); gl.attachShader(p, f);
      gl.bindAttribLocation(p, 0, 'a_pos');
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { R.error = gl.getProgramInfoLog(p) || 'link failed'; return null; }
      const u = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
      return { p, u };
    }

    let scene, post, quad, sceneTex, fbo, uiTex;
    function build() {
      scene = program(SCENE);
      post = scene && program(POST);
      if (!post) return false;
      quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      sceneTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, sceneTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      fbo = gl.createFramebuffer();
      uiTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, uiTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      sw = sh2 = 0;
      return true;
    }
    let sw = 0, sh2 = 0;
    function sizeScene(w, h) {
      if (w === sw && h === sh2) return;
      sw = w; sh2 = h;
      gl.bindTexture(gl.TEXTURE_2D, sceneTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    if (!build()) return R;
    R.ok = true;

    function set(prog, name, v) {
      const loc = prog.u[name];
      if (loc === undefined || loc === null) return;
      if (typeof v === 'number') gl.uniform1f(loc, v);
      else if (v.length === 2) gl.uniform2f(loc, v[0], v[1]);
      else if (v.length === 3) gl.uniform3f(loc, v[0], v[1], v[2]);
    }

    // scene scale + steps by quality; 'auto' adjusts itself to the frame time
    const Q = { low: [0.38, 28, 1.0], auto: [0.55, 48, 1.25], high: [0.75, 64, 1.5], insane: [1.0, 96, 2.0] };
    let quality = 'auto', autoScale = 0.55;
    const times = [];
    R.setQuality = (q) => { quality = Q[q] ? q : 'auto'; autoScale = Q[quality][0]; };
    R.quality = () => quality;
    R.uiScale = () => Math.min(window.devicePixelRatio || 1, Q[quality][2]);

    // resize the screen canvas (and tell the HUD how big to draw)
    R.resize = () => {
      const s = R.uiScale();
      const w = Math.max(2, Math.round((canvas.clientWidth || window.innerWidth) * s));
      const h = Math.max(2, Math.round((canvas.clientHeight || window.innerHeight) * s));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      return [w, h];
    };

    R.uploadUI = (src) => {
      gl.bindTexture(gl.TEXTURE_2D, uiTex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    };

    // u: every uniform value for this frame; dtMs for auto quality
    R.draw = (u, dtMs) => {
      if (!R.ok) return;
      const [W, Hh] = R.resize();
      const scale = quality === 'auto' ? autoScale : Q[quality][0];
      const w = Math.max(2, Math.round(W * scale / R.uiScale())), h = Math.max(2, Math.round(Hh * scale / R.uiScale()));
      sizeScene(w, h);
      // pass 1
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, w, h);
      gl.useProgram(scene.p);
      set(scene, 'u_res', [w, h]);
      set(scene, 'u_steps', quality === 'auto' ? Math.round(Q.auto[1] * Math.min(1, autoScale / 0.5)) : Q[quality][1]);
      for (const k of ['u_time', 'u_still', 'u_mix', 'u_hue', 'u_folds', 'u_pulse', 'u_grow', 'u_beat', 'u_spin']) if (u[k] !== undefined) set(scene, k, u[k]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // pass 2
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, Hh);
      gl.useProgram(post.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sceneTex);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, uiTex);
      gl.uniform1i(post.u.u_scene, 0);
      gl.uniform1i(post.u.u_ui, 1);
      set(post, 'u_res', [W, Hh]);
      set(post, 'u_sceneRes', [w, h]);
      for (const k of ['u_time', 'u_glitch', 'u_lens', 'u_shock', 'u_rewind', 'u_flash', 'u_flashCol', 'u_flip', 'u_mirror', 'u_melt', 'u_invert', 'u_uiWarp', 'u_scan', 'u_shake']) if (u[k] !== undefined) set(post, k, u[k]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.activeTexture(gl.TEXTURE0);
      // auto quality: watch real frame times
      if (quality === 'auto' && dtMs > 0) {
        times.push(dtMs);
        if (times.length >= 45) {
          times.sort((a, b) => a - b);
          const med = times[22];
          times.length = 0;
          if (med > 24 && autoScale > 0.3) autoScale = Math.max(0.3, autoScale * 0.85);
          else if (med < 17.5 && autoScale < 0.7) autoScale = Math.min(0.7, autoScale * 1.07);
        }
      }
    };
    R.autoScale = () => autoScale;

    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); R.ok = false; }, false);
    canvas.addEventListener('webglcontextrestored', () => { R.ok = build(); }, false);
    return R;
  }

  root.HOGFX = { create, SCENE, POST };
})(typeof window !== 'undefined' ? window : globalThis);
