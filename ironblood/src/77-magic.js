// ---------- magic, part 1: glowing particles, the ground remembering fire/ice/mud, burning, wet, knocked flying ----------

// ---- billboard particles: one additive pool (fire, glow, sparks) and one normal pool (smoke, dust, water) ----
const mfx = (() => {
  // 4 x 2 atlas: 0 glow, 1 flame, 2 spark, 3 ring, 4 smoke, 5 dust, 6 droplet, 7 shard
  const T = 64, cv = document.createElement('canvas'); cv.width = T * 4; cv.height = T * 2;
  const g = cv.getContext('2d'), r = mulberry32(31);
  const cell = (i, fn) => { g.save(); g.translate((i % 4) * T, Math.floor(i / 4) * T); fn(); g.restore(); };
  const radial = (x, y, r0, r1, stops) => { const gr = g.createRadialGradient(x, y, r0, x, y, r1); for (const [k, c] of stops) gr.addColorStop(k, c); return gr; };
  cell(0, () => { g.fillStyle = radial(32, 32, 0, 31, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(0, 0, T, T); });
  cell(1, () => {
    // a licking tongue of flame: soft teardrop with a ragged top
    for (let k = 0; k < 26; k++) { const y = 56 - k * 1.9, w = 15 * Math.sin(Math.min(1, (k + 2) / 27) * Math.PI) * (0.75 + r() * 0.35), x = 32 + Math.sin(k * 0.6) * 2.5 * (k / 26); g.fillStyle = radial(x, y, 0, w + 3, [[0, 'rgba(255,255,255,.32)'], [1, 'rgba(255,255,255,0)']]); g.beginPath(); g.arc(x, y, w + 3, 0, 7); g.fill(); }
  });
  cell(2, () => { g.fillStyle = radial(32, 32, 0, 9, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(0, 0, T, T); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(31, 6, 2, 52); g.fillRect(6, 31, 52, 2); });
  cell(3, () => { g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3; g.beginPath(); g.arc(32, 32, 26, 0, 7); g.stroke(); g.fillStyle = radial(32, 32, 20, 31, [[0, 'rgba(255,255,255,0)'], [0.6, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(0, 0, T, T); });
  cell(4, () => { for (let k = 0; k < 14; k++) { const a = r() * 6.28, d = r() * 12, x = 32 + Math.cos(a) * d, y = 32 + Math.sin(a) * d, rr = 10 + r() * 12; g.fillStyle = radial(x, y, 0, rr, [[0, 'rgba(255,255,255,.22)'], [1, 'rgba(255,255,255,0)']]); g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); } });
  cell(5, () => { for (let k = 0; k < 60; k++) { const a = r() * 6.28, d = Math.sqrt(r()) * 24; g.fillStyle = `rgba(255,255,255,${0.05 + r() * 0.12})`; g.beginPath(); g.arc(32 + Math.cos(a) * d, 32 + Math.sin(a) * d, 2 + r() * 5, 0, 7); g.fill(); } });
  cell(6, () => { g.fillStyle = radial(30, 28, 0, 12, [[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,.75)'], [1, 'rgba(255,255,255,0)']]); g.beginPath(); g.arc(32, 32, 12, 0, 7); g.fill(); });
  cell(7, () => { g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.moveTo(32, 4); g.lineTo(42, 30); g.lineTo(33, 60); g.lineTo(23, 34); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.moveTo(32, 4); g.lineTo(42, 30); g.lineTo(32, 30); g.fill(); });
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const VS = `attribute vec3 aPos; attribute float aSize; attribute vec4 aCol; attribute float aTile; attribute float aRot;
    varying vec2 vUv; varying vec4 vCol; varying float vDepth;
    void main() {
      vec4 mv = viewMatrix * vec4(aPos, 1.0);
      float c = cos(aRot), s = sin(aRot);
      vec2 q = position.xy;
      if (abs(aTile - 1.0) < 0.5) q.y = q.y * 1.8 + 0.35; // flames are tall and grow up from their base
      if (abs(aTile - 7.0) < 0.5) q.y *= 2.2;
      mv.xy += vec2(q.x * c - q.y * s, q.x * s + q.y * c) * aSize;
      gl_Position = projectionMatrix * mv;
      float tx = mod(aTile, 4.0), ty = floor(aTile / 4.0);
      vUv = vec2((tx + uv.x) / 4.0, 1.0 - (ty + 1.0 - uv.y) / 2.0);
      vCol = aCol; vDepth = -mv.z;
    }`;
  const FS = (add) => `uniform sampler2D map; uniform vec3 fogColor; uniform float fogDensity; varying vec2 vUv; varying vec4 vCol; varying float vDepth;
    void main() {
      vec4 t = texture2D(map, vUv);
      float f = 1.0 - exp(-fogDensity * fogDensity * vDepth * vDepth);
      ${add ? 'gl_FragColor = vec4(vCol.rgb * t.rgb, t.a * vCol.a * (1.0 - f));' : 'gl_FragColor = vec4(mix(vCol.rgb * t.rgb, fogColor, f), t.a * vCol.a);'}
      if (gl_FragColor.a < 0.003) discard;
    }`;
  function pool(N, add) {
    const geo = new THREE.InstancedBufferGeometry();
    const q = new THREE.PlaneGeometry(1, 1);
    geo.index = q.index; geo.attributes.position = q.attributes.position; geo.attributes.uv = q.attributes.uv;
    const A = { aPos: 3, aSize: 1, aCol: 4, aTile: 1, aRot: 1 };
    for (const k in A) { const at = new THREE.InstancedBufferAttribute(new Float32Array(N * A[k]), A[k]); at.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, at); }
    geo.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS(add), transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { map: { value: tex }, fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 } } });
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = add ? 3 : 2;
    scene.add(mesh);
    // particle state, packed arrays
    return { N, mesh, geo, mat, n: 0, p: new Float32Array(N * 3), v: new Float32Array(N * 3), life: new Float32Array(N), max: new Float32Array(N), s0: new Float32Array(N), s1: new Float32Array(N), c: new Float32Array(N * 4), tile: new Float32Array(N), rot: new Float32Array(N), rv: new Float32Array(N), grav: new Float32Array(N), drag: new Float32Array(N) };
  }
  const P = [pool(LITE ? 600 : 2600, false), pool(LITE ? 900 : 4200, true)];
  // add one particle: additive?, tile, position, velocity, life, start/end size, color (linear, can go over 1 to glow), alpha
  function emit(add, tile, x, y, z, vx, vy, vz, life, s0, s1, r, gg, b, a, grav = 0, drag = 0, rot = Math.random() * 6.28, rv = 0) {
    const S = P[add ? 1 : 0];
    if (S.n >= S.N) return;
    const i = S.n++;
    S.p[i * 3] = x; S.p[i * 3 + 1] = y; S.p[i * 3 + 2] = z;
    S.v[i * 3] = vx; S.v[i * 3 + 1] = vy; S.v[i * 3 + 2] = vz;
    S.life[i] = S.max[i] = life; S.s0[i] = s0; S.s1[i] = s1;
    S.c[i * 4] = r; S.c[i * 4 + 1] = gg; S.c[i * 4 + 2] = b; S.c[i * 4 + 3] = a;
    S.tile[i] = tile; S.rot[i] = rot; S.rv[i] = rv; S.grav[i] = grav; S.drag[i] = drag;
  }
  function update(dt) {
    for (const S of P) {
      const A = S.geo.attributes;
      let w = 0;
      for (let i = 0; i < S.n; i++) {
        S.life[i] -= dt;
        if (S.life[i] <= 0) continue;
        const k = 1 - S.life[i] / S.max[i];
        const dr = Math.max(0, 1 - S.drag[i] * dt);
        S.v[i * 3] *= dr; S.v[i * 3 + 2] *= dr; S.v[i * 3 + 1] = S.v[i * 3 + 1] * dr - S.grav[i] * dt;
        S.p[i * 3] += S.v[i * 3] * dt; S.p[i * 3 + 1] += S.v[i * 3 + 1] * dt; S.p[i * 3 + 2] += S.v[i * 3 + 2] * dt;
        S.rot[i] += S.rv[i] * dt;
        // keep the live ones packed at the front
        if (w !== i) {
          for (const [arr, n] of [[S.p, 3], [S.v, 3], [S.c, 4]]) for (let j = 0; j < n; j++) arr[w * n + j] = arr[i * n + j];
          S.life[w] = S.life[i]; S.max[w] = S.max[i]; S.s0[w] = S.s0[i]; S.s1[w] = S.s1[i]; S.tile[w] = S.tile[i]; S.rot[w] = S.rot[i]; S.rv[w] = S.rv[i]; S.grav[w] = S.grav[i]; S.drag[w] = S.drag[i];
        }
        A.aPos.array[w * 3] = S.p[w * 3]; A.aPos.array[w * 3 + 1] = S.p[w * 3 + 1]; A.aPos.array[w * 3 + 2] = S.p[w * 3 + 2];
        A.aSize.array[w] = S.s0[w] + (S.s1[w] - S.s0[w]) * k;
        const fade = Math.min(1, k * 8) * (1 - k * k);
        A.aCol.array[w * 4] = S.c[w * 4]; A.aCol.array[w * 4 + 1] = S.c[w * 4 + 1]; A.aCol.array[w * 4 + 2] = S.c[w * 4 + 2]; A.aCol.array[w * 4 + 3] = S.c[w * 4 + 3] * fade;
        A.aTile.array[w] = S.tile[w]; A.aRot.array[w] = S.rot[w];
        w++;
      }
      S.n = w; S.geo.instanceCount = w;
      for (const k in A) if (k.startsWith('a')) { A[k].needsUpdate = true; A[k].clearUpdateRanges(); A[k].addUpdateRange(0, w * A[k].itemSize); }
      S.mat.uniforms.fogColor.value.copy(scene.fog.color); S.mat.uniforms.fogDensity.value = scene.fog.density;
    }
  }
  // handy bursts
  const burst = {
    fire(x, y, z, n, spread = 0.4, up = 1.6, size = 0.9) { for (let i = 0; i < n; i++) { const hot = Math.random(); emit(true, 1, x + (Math.random() - 0.5) * spread, y + Math.random() * spread * 0.5, z + (Math.random() - 0.5) * spread, wind.x * 0.4 + (Math.random() - 0.5) * 0.5, up * (0.6 + Math.random() * 0.8), wind.z * 0.4 + (Math.random() - 0.5) * 0.5, 0.4 + Math.random() * 0.4, size * (0.6 + Math.random() * 0.5), size * 0.2, 1.5 + hot * 0.6, 0.42 + hot * 0.35, 0.08 + hot * 0.06, 0.75, -0.4, 0.8, Math.random() * 0.5 - 0.25); } },
    smoke(x, y, z, n, size = 1.2, dark = 0.18) { for (let i = 0; i < n; i++) { const c = dark + Math.random() * 0.06; emit(false, 4, x + (Math.random() - 0.5) * 0.6, y, z + (Math.random() - 0.5) * 0.6, wind.x * 0.8 + (Math.random() - 0.5) * 0.4, 1.2 + Math.random() * 0.9, wind.z * 0.8 + (Math.random() - 0.5) * 0.4, 3 + Math.random() * 2.5, size, size * 4.5, c, c * 0.97, c * 0.95, 0.55, -0.05, 0.25, Math.random() * 6.28, (Math.random() - 0.5) * 0.4); } },
    sparks(x, y, z, n, r = 4, gg = 1.6, b = 0.5, speed = 4) { for (let i = 0; i < n; i++) emit(true, 2, x, y, z, (Math.random() - 0.5) * speed, Math.random() * speed * 0.8, (Math.random() - 0.5) * speed, 0.3 + Math.random() * 0.6, 0.07 + Math.random() * 0.06, 0.02, r, gg, b, 1, 6, 0.5); },
    dust(x, y, z, n, size = 0.8, col = [0.42, 0.36, 0.28], speed = 2) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = speed * (0.4 + Math.random()); emit(false, 5, x, y + Math.random() * 0.3, z, Math.cos(a) * s, 0.3 + Math.random() * speed * 0.5, Math.sin(a) * s, 1.2 + Math.random() * 1.6, size, size * 3.5, col[0], col[1], col[2], 0.55, 0.3, 1.6); } },
    water(x, y, z, n, speed = 3) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = speed * (0.3 + Math.random()); emit(false, 6, x, y, z, Math.cos(a) * s, 1 + Math.random() * speed, Math.sin(a) * s, 0.5 + Math.random() * 0.6, 0.06 + Math.random() * 0.07, 0.03, 0.75, 0.85, 1.0, 0.85, 9.8, 0.2); } },
    glow(x, y, z, size, r, gg, b, life = 0.35, a = 1) { emit(true, 0, x, y, z, 0, 0, 0, life, size, size * 1.3, r, gg, b, a); },
  };
  return { emit, update, burst, tex };
})();

// ---- wind: drifts slowly, pushes fire and smoke ----
const wind = { a: 0.7, s: 0.55, x: 0, z: 0 };
function updateWind(dt, t) {
  wind.a += (vnoise(t * 0.01, 3.3) * 0.25) * dt * 0.2;
  wind.s = Math.max(0.15, Math.min(1.25, 0.55 + vnoise(t * 0.02, 9.1) * 0.6 + weather.rain * 0.4));
  wind.x = Math.cos(wind.a) * wind.s; wind.z = Math.sin(wind.a) * wind.s;
}

// ---- the ground remembers: burnt (R), burning (G), frost (B), mud (A), one texel = 1.56 m ----
const BM = 512, BMS = (HALF * 2) / BM;
const bmData = new Uint8Array(BM * BM * 4);
const burnTex = new THREE.DataTexture(bmData, BM, BM, THREE.RGBAFormat);
burnTex.magFilter = burnTex.minFilter = THREE.LinearFilter; burnTex.needsUpdate = true;
let bmDirty = false, bmUpT = 0;
const bmCell = (x, z) => { const i = Math.min(BM - 1, Math.max(0, Math.floor((x + HALF) / BMS))), j = Math.min(BM - 1, Math.max(0, Math.floor((z + HALF) / BMS))); return j * BM + i; };
const cellX = (c) => -HALF + ((c % BM) + 0.5) * BMS, cellZ = (c) => -HALF + (Math.floor(c / BM) + 0.5) * BMS;
function groundFx(x, z) { const o = bmCell(x, z) * 4; return { burnt: bmData[o] / 255, fire: bmData[o + 1] / 255, frost: bmData[o + 2] / 255, mud: bmData[o + 3] / 255 }; }
function paintDisc(x, z, rad, ch, val, soft = 0.4) {
  const r = Math.ceil(rad / BMS) + 1, c0 = bmCell(x, z), ci = c0 % BM, cj = Math.floor(c0 / BM);
  for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
    if (i < 0 || j < 0 || i >= BM || j >= BM) continue;
    const cx = -HALF + (i + 0.5) * BMS, cz = -HALF + (j + 0.5) * BMS;
    const d = Math.hypot(cx - x, cz - z) / rad;
    if (d > 1) continue;
    const k = Math.min(1, (1 - d) / soft) * (0.75 + 0.25 * hash2(i * 7 + ch, j * 13));
    const o = (j * BM + i) * 4 + ch;
    bmData[o] = Math.max(bmData[o], Math.round(val * k * 255));
  }
  bmDirty = true; fieldUniforms.uFxOn.value = 1;
}
// the terrain and the grass both look at that map
terrainUniforms.tBurn = { value: burnTex };
{
  const prev = terrainMat.onBeforeCompile;
  terrainMat.onBeforeCompile = (sh) => {
    prev(sh);
    sh.uniforms.tBurn = terrainUniforms.tBurn; sh.uniforms.uFireT = fieldUniforms.uFireT;
    sh.fragmentShader = 'uniform sampler2D tBurn; uniform float uFireT;\n' + sh.fragmentShader
      .replace('diffuseColor.rgb *= 1.0 - uWet * 0.25 * (1.0 - w4);', `diffuseColor.rgb *= 1.0 - uWet * 0.25 * (1.0 - w4);
      vec4 gfx = texture2D(tBurn, (vW + ${HALF.toFixed(1)}) / ${(HALF * 2).toFixed(1)});
      float gn = texture2D(tN[0], vW * 0.31).r;
      float burnt = smoothstep(0.2, 0.75, gfx.r + (gn - 0.5) * 0.35), frost = smoothstep(0.15, 0.6, gfx.b + (gn - 0.5) * 0.3), mudK = smoothstep(0.15, 0.6, gfx.a + (gn - 0.5) * 0.25);
      vec3 charCol = mix(vec3(0.011, 0.010, 0.009), vec3(0.15, 0.145, 0.14), smoothstep(0.6, 0.82, gn) * 0.8);
      diffuseColor.rgb = mix(diffuseColor.rgb, charCol, burnt * 0.96);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.11, 0.07) * (0.8 + gn * 0.4), mudK * 0.92);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.74, 0.83, 0.93) * (0.85 + gn * 0.25), frost * 0.88);
      blendR = mix(blendR, 0.97, burnt * 0.7); blendR = mix(blendR, 0.12, mudK); blendR = mix(blendR, 0.09, frost);
      float fireGlow = gfx.g * (0.6 + 0.4 * sin(uFireT * 9.0 + vW.x * 1.7 + vW.y * 2.3)) * smoothstep(0.5, 0.75, gn + 0.1);`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(1.6, 0.42, 0.08) * fireGlow * 0.7;');
  };
  terrainMat.customProgramCacheKey = () => 'terrain6fx';
  const prevG = grassMat.onBeforeCompile;
  grassMat.onBeforeCompile = (sh) => {
    prevG(sh);
    sh.uniforms.tBurn = terrainUniforms.tBurn; sh.uniforms.uFxOn = fieldUniforms.uFxOn;
    sh.vertexShader = 'uniform sampler2D tBurn; uniform float uFxOn; varying vec3 vGfx;\n' + sh.vertexShader.replace('float d = distance(ip.xz, uPlayer.xz);', `float d = distance(ip.xz, uPlayer.xz);
      vec4 gfx = uFxOn > 0.5 ? texture2D(tBurn, (ip.xz + ${HALF.toFixed(1)}) / ${(HALF * 2).toFixed(1)}) : vec4(0.0);
      vGfx = gfx.rba;
      transformed.y *= 1.0 - clamp(gfx.r * 1.4, 0.0, 0.94) - gfx.a * 0.85;`);
    sh.fragmentShader = 'varying vec3 vGfx;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.03, 0.025, 0.02), clamp(vGfx.x * 1.5, 0.0, 1.0));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.88, 0.96), vGfx.y * 0.8);`);
  };
  grassMat.customProgramCacheKey = () => 'grassfx';
}
const fieldUniforms = { uFireT: { value: 0 }, uFxOn: { value: 0 } };

// ---- fire that spreads: dry grass burns fast downwind, dirt and stone don't burn, water stops it ----
const burning = new Map();     // cell -> { t, dur }
const fuelCache = new Float32Array(BM * BM).fill(-1);
const wetUntil = new Map();    // cell -> time it dries
const burningHouses = new Set();
function cellFuel(c) {
  if (fuelCache[c] >= 0) return fuelCache[c];
  const x = cellX(c), z = cellZ(c);
  let f = 0;
  if (riverDist(x, z) > 11 && !onBridge(x, z)) {
    const sp = splatAt(x, z, terrainH(x, z), slopeAt(x, z));
    f = sp.grass * 0.95 + sp.dirt * 0.12 + sp.mud * 0.05;
    if (solidAt(x, z, 0.2)) f = houseAt(x, z) ? 0.6 : 0; // wood and thatch burn, stone doesn't
  }
  return (fuelCache[c] = f);
}
function houseAt(x, z) { return VHOUSES.find(h => { const dx = x - h.x, dz = z - h.z, c = Math.cos(h.ry), s = Math.sin(h.ry), u = dx * c - dz * s, v = dx * s + dz * c; return Math.abs(u) < h.w / 2 + 0.8 && Math.abs(v) < h.d / 2 + 0.8; }); }
function ignite(x, z, by, strength = 1) {
  const c = bmCell(x, z);
  if (burning.has(c) || bmData[c * 4] > 200) return false;
  if ((wetUntil.get(c) || 0) > clockNow) return false;
  if (bmData[c * 4 + 2] > 90) return false; // frozen ground
  const f = cellFuel(c);
  if (f * strength < 0.12) return false;
  burning.set(c, { t: 0, dur: 4 + f * 5 + Math.random() * 3, by });
  bmData[c * 4 + 1] = 255; bmDirty = true; fieldUniforms.uFxOn.value = 1;
  // a burning house
  const h = houseAt(x, z);
  if (h && !burningHouses.has(h) && !raid.burning.some(b => b.house === h)) { burningHouses.add(h); burnHouse(h, by && by.isPlayer ? 'you' : by && by.team === 'knight' ? 'raid' : 'wild'); onHouseFire(h, by); setTimeout(() => burningHouses.delete(h), 150000); }
  return true;
}
function igniteDisc(x, z, rad, by, chance = 1) {
  const r = Math.ceil(rad / BMS);
  const c0 = bmCell(x, z), ci = c0 % BM, cj = Math.floor(c0 / BM);
  let n = 0;
  for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
    if (i < 0 || j < 0 || i >= BM || j >= BM) continue;
    const cx = -HALF + (i + 0.5) * BMS, cz = -HALF + (j + 0.5) * BMS;
    if (Math.hypot(cx - x, cz - z) > rad || Math.random() > chance) continue;
    if (ignite(cx, cz, by)) n++;
  }
  return n;
}
function douse(x, z, rad, secs = 60) {
  const r = Math.ceil(rad / BMS), c0 = bmCell(x, z), ci = c0 % BM, cj = Math.floor(c0 / BM);
  let n = 0;
  for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
    if (i < 0 || j < 0 || i >= BM || j >= BM) continue;
    const cx = -HALF + (i + 0.5) * BMS, cz = -HALF + (j + 0.5) * BMS;
    if (Math.hypot(cx - x, cz - z) > rad) continue;
    const c = j * BM + i;
    if (burning.has(c)) { burning.delete(c); bmData[c * 4 + 1] = 0; bmData[c * 4] = Math.max(bmData[c * 4], 150); n++; }
    wetUntil.set(c, clockNow + secs);
  }
  if (n) { bmDirty = true; mfx.burst.smoke(x, groundH(x, z) + 0.3, z, Math.min(12, n), 1, 0.75); sfx.hiss && sfx.hiss(new THREE.Vector3(x, groundH(x, z), z)); }
  // houses close by go out too
  for (const b of raid.burning) if (Math.hypot(b.house.x - x, b.house.z - z) < rad + Math.max(b.house.w, b.house.d) / 2) b.t = Math.min(b.t, 6);
  return n;
}
// a few of the fire pool lights follow the biggest blazes near you
const fireLights = [0, 1, 2].map(() => ({ g: new THREE.Object3D(), sprites: [], size: 1.3, pos: new THREE.Vector3(), on: false }));
let spreadT = 0, fireLightT = 0, fireSoundT = 0;
function updateBurning(dt) {
  spreadT -= dt;
  const tick = spreadT <= 0;
  if (tick) spreadT = 0.2;
  const cam = camera.position, rain = weather.rain;
  const over = burning.size > 900;
  let near = 0;
  for (const [c, b] of burning) {
    b.t += dt;
    const x = cellX(c), z = cellZ(c);
    const o = c * 4;
    bmData[o] = Math.min(255, Math.max(bmData[o], Math.round((0.35 + 0.65 * b.t / b.dur) * 255)));
    if (b.t >= b.dur || rain > 0.65 && Math.random() < dt * 0.4) {
      burning.delete(c); bmData[o + 1] = 0; bmData[o] = 255; fuelCache[c] = 0; bmDirty = true; continue;
    }
    // flames and smoke near the camera
    const dc = (x - cam.x) ** 2 + (z - cam.z) ** 2;
    if (dc < 120 * 120) {
      const y = terrainH(x, z);
      const k = dc < 40 * 40 ? 1 : 0.35, life = Math.sin(Math.min(1, b.t / b.dur) * Math.PI);
      if (Math.random() < dt * 5.5 * k * (0.3 + life)) mfx.burst.fire(x + (Math.random() - 0.5) * BMS, y + 0.02, z + (Math.random() - 0.5) * BMS, 1, 0.4, 1.2 + life, 0.55 + life * 0.6);
      if (Math.random() < dt * 0.3 * k) mfx.burst.smoke(x, y + 1.2, z, 1, 0.8 + life * 0.7, 0.14);
      if (Math.random() < dt * 0.6 * k) mfx.burst.sparks(x, y + 0.6, z, 2, 3.5, 1.4, 0.4, 2.5);
      if (dc < 30 * 30) near++;
    }
    // catch the neighbours, much more downwind
    if (!tick || b.t < 0.8) continue;
    const ci = c % BM, cj = Math.floor(c / BM);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= BM || nj >= BM) continue;
      const nc = nj * BM + ni;
      if (burning.has(nc) || bmData[nc * 4] > 200) continue;
      const len = Math.hypot(di, dj), dot = (di * wind.x + dj * wind.z) / len;
      const wk = 1 + 2.6 * Math.max(0, dot) - 0.75 * Math.max(0, -dot) * (wind.s / 1.25);
      const p = cellFuel(nc) * 0.09 * wk * (1 - rain * 0.85) * (over ? 0.25 : 1) / len;
      if (Math.random() < p) ignite(cellX(nc), cellZ(nc), b.by);
    }
  }
  // people standing in flames catch fire
  if (tick && burning.size) for (const f of fighters) {
    if (!f.alive || f.inside || f.invuln) continue;
    const c = bmCell(f.pos.x, f.pos.z);
    if (burning.has(c) && f.pos.y < groundH(f.pos.x, f.pos.z) + 1) setOnFire(f, 5, burning.get(c).by);
  }
  // lights on the three biggest nearby blazes
  fireLightT -= dt;
  if (fireLightT <= 0) {
    fireLightT = 0.5;
    const picks = [];
    for (const [c] of burning) { const x = cellX(c), z = cellZ(c), d = (x - cam.x) ** 2 + (z - cam.z) ** 2; if (d > 70 * 70) continue; if (picks.some(p => (p.x - x) ** 2 + (p.z - z) ** 2 < 144)) continue; picks.push({ x, z, d }); if (picks.length > 12) break; }
    picks.sort((a, b) => a.d - b.d);
    fireLights.forEach((e, i) => {
      const p = picks[i];
      if (p) { e.pos.set(p.x, terrainH(p.x, p.z) + 1.2, p.z); if (!e.on) { fires.push(e); e.on = true; } }
      else if (e.on) { const k = fires.indexOf(e); if (k >= 0) fires.splice(k, 1); e.on = false; for (const l of firePool) if (l.userData.fire === e) { l.userData.fire = null; l.intensity = 0; } }
    });
  }
  // crackling
  fireSoundT -= dt;
  if (near && fireSoundT <= 0 && ac) { fireSoundT = 0.05 + Math.random() * 0.15 / Math.min(4, near); sfx.crackle && sfx.crackle(near); }
}

// ---- ice on the river: you can walk on it until it melts ----
const iceSheets = [];
const iceMat = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), r = mulberry32(12);
  g.fillStyle = '#cfe2ee'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.15})`; g.beginPath(); g.arc(r() * 256, r() * 256, 4 + r() * 30, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.2;
  for (let i = 0; i < 26; i++) { let x = r() * 256, y = r() * 256; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, color: 0x9fbfd6, roughness: 0.06, metalness: 0.15, envMapIntensity: 1.6, transparent: true, opacity: 0.72, polygonOffset: true, polygonOffsetFactor: -2 });
})();
function freezeWater(x, z, rad) {
  if (riverDist(x, z) > 11 + rad) return null;
  const m = new THREE.Mesh(new THREE.CircleGeometry(rad, 40).rotateX(-Math.PI / 2), iceMat.clone());
  m.position.set(x, WATER_Y + 0.05, z); m.receiveShadow = true;
  scene.add(m);
  const s = { x, z, r2: rad * rad, rad, t: 75 + Math.random() * 20, mesh: m };
  iceSheets.push(s);
  return s;
}
const groundH0 = groundH;
groundH = function (x, z) {
  const h = groundH0(x, z);
  if (iceSheets.length && h < WATER_Y + 0.05) for (const s of iceSheets) if ((x - s.x) ** 2 + (z - s.z) ** 2 < s.r2) return WATER_Y + 0.06;
  return h;
};
function updateIce(dt) {
  for (let i = iceSheets.length - 1; i >= 0; i--) {
    const s = iceSheets[i]; s.t -= dt;
    if (s.t < 8) { s.mesh.material.opacity = 0.72 * Math.max(0, s.t / 8); if (Math.random() < dt * 2) sfx.iceCrack && sfx.iceCrack(new THREE.Vector3(s.x, 0, s.z)); }
    if (s.t <= 0) { scene.remove(s.mesh); s.mesh.geometry.dispose(); iceSheets.splice(i, 1); for (const f of fighters) if (f.alive && (f.pos.x - s.x) ** 2 + (f.pos.z - s.z) ** 2 < s.r2 && f.pos.y < 0.3) { mfx.burst.water(f.pos.x, WATER_Y, f.pos.z, 20, 3); f.grounded = false; f.vy = -1; } }
  }
}
// frost and mud slowly go away
let fieldFadeT = 0;
function updateFields(dt) {
  fieldFadeT -= dt;
  if (fieldFadeT > 0) return;
  fieldFadeT = 1;
  for (let o = 0; o < bmData.length; o += 4) {
    if (bmData[o + 2]) { bmData[o + 2] = Math.max(0, bmData[o + 2] - 3); bmDirty = true; }
    if (bmData[o + 3]) { bmData[o + 3] = Math.max(0, bmData[o + 3] - 9); bmDirty = true; }
  }
}

// ---- what magic does to a body: on fire, soaked, frozen solid, knocked flying ----
function setOnFire(f, secs, by) {
  if (f.invuln || !f.alive && f.charred > 0.9) return;
  if ((f.wet || 0) > 0) { f.wet = Math.max(0, f.wet - secs * 2); mfx.burst.smoke(f.pos.x, f.pos.y + 1, f.pos.z, 2, 0.6, 0.7); return; }
  if (!(f.burning > 0) && f.alive) { sfx.voice(f.pos, 'scream', f.voicePitch || 1); if (f.isPlayer) ui.sub('You are on fire! Get to water or roll it out (dodge)', 2.5); }
  f.burning = Math.max(f.burning || 0, secs);
  f.fireBy = by || f.fireBy;
}
const _mb = new THREE.Vector3();
const BURN_BONES = ['Spine1', 'Spine2', 'LeftArm', 'RightArm', 'LeftUpLeg', 'RightUpLeg', 'Head', 'LeftForeArm', 'RightForeArm'];
function magicStatus(f, dt) {
  if (!f.isPlayer && f.castAfter > 0) { f.castAfter -= dt; if (f.castAfter <= 0 && !(f.mage && f.mage.chant)) f.castAim = null; }
  if (f.burning > 0) {
    f.burning -= dt * ((f.wet || 0) > 0 ? 6 : 1) * (f.dodge > 0 ? 3 : 1);
    if (f.pos.y < WATER_Y - 0.2) { f.burning = 0; f.wet = 30; mfx.burst.smoke(f.pos.x, WATER_Y + 0.3, f.pos.z, 6, 0.8, 0.75); }
    if (weather.rain > 0.5) f.burning -= dt * 0.8;
    const cloth = f.vill || f.mage ? 1.5 : f.isPlayer ? 0.6 : 0.85;
    if (f.alive) {
      const dmg = dt * 5.5 * cloth;
      f.hp -= dmg; f.charred = Math.min(1, (f.charred || 0) + dt * 0.035);
      if (f.isPlayer) f.armorHp = Math.max(0, f.armorHp - dt * 0.4);
      if (f.painT <= 0) { sfx.voice(f.pos, Math.random() < 0.6 ? 'scream' : 'hurt', f.voicePitch || 1); f.painT = 0.9 + Math.random() * 0.6; }
      if (f.hp <= 0) { f.lastHitBy = f.fireBy || f.lastHitBy; f.die({ from: f.fireBy, part: 'chest', burn: true }, 'burned alive'); }
    } else f.charred = Math.min(1, (f.charred || 0) + dt * 0.08);
    // flames climbing the body
    const n = f.alive ? 3 : 1.5;
    for (let k = 0; k < n; k++) if (Math.random() < dt * 12) { const b = f.b[BURN_BONES[Math.floor(Math.random() * BURN_BONES.length)]]; if (!b) continue; b.getWorldPosition(_mb); mfx.burst.fire(_mb.x, _mb.y - 0.05, _mb.z, 1, 0.2, 1.3, 0.4); }
    if (Math.random() < dt * 1.5) { f.b.Spine2.getWorldPosition(_mb); mfx.burst.smoke(_mb.x, _mb.y + 0.4, _mb.z, 1, 0.5, 0.12); }
    // running through dry grass spreads it
    if (Math.random() < dt * 3) ignite(f.pos.x, f.pos.z, f.fireBy, 0.8);
    if (f.burning <= 0) f.burning = 0;
    applyChar(f);
  }
  if (f.wet > 0) { f.wet -= dt; if (Math.random() < dt * 3) { f.b.Spine1.getWorldPosition(_mb); mfx.emit(false, 6, _mb.x + (Math.random() - 0.5) * 0.4, _mb.y, _mb.z + (Math.random() - 0.5) * 0.4, 0, -0.5, 0, 0.5, 0.04, 0.02, 0.75, 0.85, 1, 0.8, 9); } }
  if (f.pos.y < WATER_Y - 0.25) f.wet = Math.max(f.wet || 0, 25);
  if (weather.rain > 0.4) f.wet = Math.max(f.wet || 0, 6);
  if (f.frozen > 0) {
    f.frozen -= dt;
    if (f.frozen <= 0) { f.frozen = 0; if (f.iceMesh) { f.root.remove(f.iceMesh); f.iceMesh = null; sfx.iceCrack && sfx.iceCrack(f.pos); mfx.burst.sparks(f.pos.x, f.pos.y + 0.4, f.pos.z, 10, 1.4, 1.8, 2.4, 3); } }
  }
  if (f.shock > 0) { f.shock -= dt; if (Math.random() < dt * 10) { const b = f.b[BURN_BONES[Math.floor(Math.random() * 6)]]; b.getWorldPosition(_mb); mfx.burst.sparks(_mb.x, _mb.y, _mb.z, 2, 1.5, 2.2, 4, 3); } }
  if (f.shieldT > 0) { f.shieldT -= dt; if (f.shieldT <= 0 || f.shieldHp <= 0) dropShield(f); }
  if (f.lift) updateLift(f, dt);
}
// burned bodies go dark
function applyChar(f) {
  if (!f.charred || f.charred - (f.charShown || 0) < 0.04) return;
  f.charShown = f.charred;
  f.root.traverse(o => {
    if (!o.isMesh || (!o.userData.armor && !o.isSkinnedMesh)) return;
    const arr = Array.isArray(o.material), ms = arr ? o.material : [o.material];
    const out = ms.map(m => {
      if (!m.color || m.isShaderMaterial) return m;
      if (!m.userData.charBase) { const c = m.clone(); c.userData.charBase = m.color.clone(); c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey; m = c; }
      m.color.copy(m.userData.charBase).multiplyScalar(1 - f.charred * 0.85);
      return m;
    });
    o.material = arr ? out : out[0];
  });
}
// frozen in place: ice grows over the legs
const iceShardGeo = (() => { const g = new THREE.ConeGeometry(0.07, 0.5, 5); g.translate(0, 0.25, 0); return g; })();
const iceBodyMat = new THREE.MeshStandardMaterial({ color: 0xcfe8ff, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.8, emissive: 0x15324a, emissiveIntensity: 0.6 });
function freezeFighter(f, secs) {
  if (f.invuln || !f.alive) return;
  if (f.burning > 0) { f.burning = 0; mfx.burst.smoke(f.pos.x, f.pos.y + 1, f.pos.z, 4, 0.7, 0.75); return; }
  f.frozen = Math.max(f.frozen || 0, secs);
  f.attack = null; f.blocking = false;
  if (!f.iceMesh) {
    const g = new THREE.Group();
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(iceShardGeo, iceBodyMat);
      const a = (i / 16) * 6.28 + Math.random() * 0.3, r = 0.15 + Math.random() * 0.12;
      m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      m.rotation.set((Math.random() - 0.5) * 0.7 + Math.sin(a) * 0.3, Math.random() * 6, (Math.random() - 0.5) * 0.7 - Math.cos(a) * 0.3);
      m.scale.set(1 + Math.random(), 0.8 + Math.random() * 1.4, 1 + Math.random());
      g.add(m);
    }
    f.root.add(g); f.iceMesh = g;
  }
  sfx.freeze && sfx.freeze(f.pos);
}
// knocked off your feet: fly, land, maybe break something, then get up
function knockDown(f, vx, vy, vz, secs = 1.6, by) {
  if (f.invuln || !f.alive) return;
  if (f.frozen > 0) { f.frozen = 0.01; } // ice shatters
  f.knock = { t: 0, dur: secs, by, land: false, side: Math.random() < 0.5 ? 1 : -1 };
  f.vel.set(vx, 0, vz); f.vy = vy; f.grounded = vy <= 0.5 && f.grounded;
  f.attack = null; f.blocking = false; f.dodge = 0;
  if (f.isPlayer) lockTarget = null;
}
function updateKnock(f, dt) {
  const k = f.knock;
  k.t += dt;
  const g = groundH(f.pos.x, f.pos.z);
  if (!k.land) {
    f.vy -= 17 * dt;
    f.pos.x += f.vel.x * dt; f.pos.z += f.vel.z * dt; f.pos.y += f.vy * dt;
    const drag = f.grounded ? Math.max(0, 1 - 6 * dt) : 1;
    f.vel.x *= drag; f.vel.z *= drag;
    collideFighter(f);
    const gg = groundH(f.pos.x, f.pos.z);
    if (f.pos.y <= gg) {
      const speed = Math.hypot(f.vel.x, f.vy, f.vel.z);
      f.pos.y = gg;
      if (f.vy < -4 || speed > 9) {
        // a hard landing hurts, a very hard one breaks bones
        const hurt = Math.max(0, -f.vy - 5) * 4.5 + Math.max(0, speed - 9) * 2;
        sfx.thud(f.pos, 1.3);
        mfx.burst.dust(f.pos.x, gg, f.pos.z, 8, 0.7);
        if (hurt > 3) f.takeHit(['belly', 'chest', 'lthigh', 'rthigh', 'luarm', 'ruarm'][Math.floor(Math.random() * 6)], hurt, { blunt: true, noBlood: hurt < 25, point: f.pos.clone().setY(gg + 0.3), dir: new THREE.Vector3(0, -1, 0), from: k.by, power: 1.2 });
      }
      f.vy = 0;
      if (Math.abs(f.vel.x) + Math.abs(f.vel.z) < 0.4 || k.t > 0.5) { k.land = true; k.landT = k.t; }
      f.grounded = true;
    }
  } else { f.pos.y = g; f.vel.multiplyScalar(Math.max(0, 1 - 8 * dt)); f.pos.x += f.vel.x * dt; f.pos.z += f.vel.z * dt; collideFighter(f); }
  // the body tips over and back up
  const fall = Math.min(1, k.t / 0.35), up = k.t > k.dur ? Math.min(1, (k.t - k.dur) / 0.55) : 0;
  const tilt = fall * (1 - up);
  f.root.rotation.x = -tilt * Math.PI / 2 * 0.95;
  f.root.rotation.z = 0;
  if (k.land) f.pos.y = g + 0.1 * tilt;
  f.speed = 0;
  f.root.rotation.y = f.facing;
  if (up >= 1 && f.alive) { f.knock = null; f.root.rotation.x = 0; f.stagger = 0.3; }
  if (!f.alive) { f.knock = null; }
}
// lifted by telekinesis: hangs in the air glowing, then thrown
function updateLift(f, dt) {
  const L = f.lift;
  L.t += dt;
  if (!f.alive && !L.body) { f.lift = null; return; }
  if (L.t < L.hold) {
    const want = L.anchor();
    f.pos.lerp(want, Math.min(1, dt * 6));
    f.vel.set(0, 0, 0); f.vy = 0; f.grounded = false;
    f.root.rotation.x = Math.sin(L.t * 3) * 0.25; f.root.rotation.z = Math.cos(L.t * 2.3) * 0.2;
    if (Math.random() < dt * 25) { f.b.Spine1.getWorldPosition(_mb); mfx.emit(true, 0, _mb.x + (Math.random() - 0.5) * 0.6, _mb.y + (Math.random() - 0.5) * 0.9, _mb.z + (Math.random() - 0.5) * 0.6, 0, 0.3, 0, 0.5, 0.25, 0.1, 1.2, 0.45, 2.2, 0.7); }
  } else {
    f.lift = null; f.root.rotation.z = 0;
    const d = L.throwDir();
    knockDown(f, d.x * L.force, d.y * L.force + 2, d.z * L.force, 1.8, L.by);
    sfx.swing(f.pos, 3, 1.6);
  }
}
// a magic barrier around someone
const shieldMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uT: { value: 0 }, uHit: { value: 0 }, uCol: { value: new THREE.Color(0.35, 0.75, 1.6) } },
  vertexShader: 'varying vec3 vN; varying vec3 vP; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vP = position; vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
  fragmentShader: `uniform float uT; uniform float uHit; uniform vec3 uCol; varying vec3 vN; varying vec3 vP; varying vec3 vV;
    float hex(vec2 p){ p.x *= 1.1547; p.y += mod(floor(p.x), 2.0) * 0.5; p = abs(fract(p) - 0.5); return abs(max(p.x * 1.5 + p.y, p.y * 2.0) - 1.0); }
    void main(){ float fr = pow(1.0 - abs(dot(vN, vV)), 2.2); float h = smoothstep(0.08, 0.0, hex(vec2(atan(vP.z, vP.x) * 3.0, vP.y * 4.0) + vec2(0.0, uT * 0.2)));
      float wave = 0.5 + 0.5 * sin(vP.y * 9.0 - uT * 4.0);
      gl_FragColor = vec4(uCol * (fr * 0.9 + h * 0.35 * (0.6 + wave * 0.4) + uHit * 0.8), 1.0); }`,
});
function giveShield(f, hp, secs) {
  dropShield(f);
  const m = new THREE.Mesh(new THREE.SphereGeometry(1.05, 32, 20), shieldMat.clone());
  m.scale.set(0.95, 1.12, 0.95); m.position.y = 0.95;
  f.root.add(m);
  f.shield = m; f.shieldHp = hp; f.shieldT = secs;
}
function dropShield(f) {
  if (!f.shield) return;
  f.root.remove(f.shield); f.shield.material.dispose(); f.shield = null; f.shieldHp = 0;
  mfx.burst.sparks(f.pos.x, f.pos.y + 1, f.pos.z, 20, 0.8, 1.8, 3.2, 4);
  sfx.shieldBreak && sfx.shieldBreak(f.pos);
}

// ---- burning houses: flames climb out of the roof, black smoke pours up ----
function updateHouseFires(dt) {
  const cam = camera.position;
  for (const b of raid.burning) {
    const h = b.house, d = Math.hypot(h.x - cam.x, h.z - cam.z);
    if (d > 160) continue;
    const k = d < 50 ? 1 : 0.4, life = Math.min(1, b.t / 20); // dies down at the end
    const c = Math.cos(h.ry), sn = Math.sin(h.ry);
    for (let i = 0; i < 4; i++) if (Math.random() < dt * 26 * k * life) {
      const u = (Math.random() - 0.5) * h.w * 0.9, v = (Math.random() - 0.5) * h.d * 0.9;
      const x = h.x + u * c + v * sn, z = h.z - u * sn + v * c;
      const roof = b.top.y - 1.6 + (1 - Math.abs(v) / (h.d * 0.5)) * 1.8;
      mfx.burst.fire(x, roof, z, 1, 0.5, 3, 1.9 + Math.random() * 1.6);
    }
    if (Math.random() < dt * 5 * k * life) mfx.burst.smoke(h.x + (Math.random() - 0.5) * h.w * 0.6, b.top.y + 1, h.z + (Math.random() - 0.5) * h.d * 0.6, 1, 2.2, 0.07);
    if (Math.random() < dt * 3 * k * life) mfx.burst.sparks(h.x, b.top.y, h.z, 4, 4, 1.5, 0.4, 5);
  }
}

// ---- one call per frame ----
function updateMagicWorld(dt, realDt, t) {
  updateWind(realDt, t);
  if (dt > 0) updateHouseFires(dt);
  fieldUniforms.uFireT.value = t;
  if (dt > 0) { updateBurning(dt); updateIce(dt); updateFields(dt); }
  for (const s of iceSheets) s.mesh.material.map.offset.set(s.x * 0.01, s.z * 0.01);
  for (const f of fighters) if (f.shield) { f.shield.material.uniforms.uT.value = t; f.shield.material.uniforms.uHit.value *= Math.pow(0.02, realDt); }
  mfx.update(dt);
  bmUpT -= realDt;
  if (bmDirty && bmUpT <= 0) { burnTex.needsUpdate = true; bmDirty = false; bmUpT = 0.2; }
}
