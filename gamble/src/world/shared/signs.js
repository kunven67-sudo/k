// Signage for city builders: painted & weathered signs, neon, marquee bulbs, LED screens.
//
// All sign art is drawn on canvases at load with the vendored fonts, then aged (sun fade,
// grime, rust bleed, scratches) so nothing looks freshly printed. Night behaviour is driven by
// the shared SIGNS uniforms the world updates once per frame (signsUpdate(night, time)).
//
//   paintedSignMat(key, w, h, draw, {weather, rough, emissive})   lit box signs / painted boards
//   neonSign(key, lines, opts) → { mesh(es), material, halo, flicker }   neon tubes on a backer
//   BulbSet: add(pos, seq, colorHex) … build() → InstancedMesh of marquee bulbs (chase/twinkle)
//   ledScreenMat(key, slides, opts)    animated LED marquee (pixel mask, wipes between slides)
//   SIGNS.uNight / uTime / uWet

import * as THREE from 'three';
import { canvasTexture } from '../../gfx/textures.js';
import { Rng } from '../../core/rng.js';

export const SIGNS = {
  uNight: { value: 0 },
  uTime: { value: 0 },
  uWet: { value: 0 },
};

const flickerables = []; // neon signs with personality (buzz, flicker, broken letters)

export function signsUpdate(night, time, wet = 0) {
  SIGNS.uNight.value = night;
  SIGNS.uTime.value = time;
  SIGNS.uWet.value = wet;
  for (const f of flickerables) f.update(night, time);
}

/** Start a fresh build. `tier` (optional) picks bulb tessellation. */
export function resetSigns(tier) {
  flickerables.length = 0;
  const detail = tier?.name === 'low' ? 0 : 1;
  if (detail !== bulbGeoCache.detail) bulbGeoCache.g = null;
  bulbGeoCache.detail = detail;
}

// ---- Canvas helpers -----------------------------------------------------------------------

/** Age a sign canvas: sun fade, grime from the bottom, rust bleed from fixings, scratches. */
export function weatherCanvas(g, w, h, { seed = 1, fade = 0.25, grime = 0.35, rust = 0.2, scratches = 0.3 } = {}) {
  const r = new Rng(seed);
  g.save();
  // Sun fade: a pale wash, stronger at the top.
  if (fade > 0) {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, `rgba(235,228,210,${0.35 * fade})`);
    grd.addColorStop(1, `rgba(235,228,210,${0.1 * fade})`);
    g.globalCompositeOperation = 'screen';
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  }
  g.globalCompositeOperation = 'multiply';
  // Grime blotches + drip lines from the bottom edge and the top.
  for (let i = 0; i < 40 * grime; i++) {
    const x = r.range(0, w);
    const y = r.chance(0.6) ? r.range(h * 0.6, h) : r.range(0, h);
    const rad = r.range(w * 0.02, w * 0.12);
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    const a = r.range(0.05, 0.22) * grime;
    grd.addColorStop(0, `rgba(70,58,44,${a})`);
    grd.addColorStop(1, 'rgba(70,58,44,0)');
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 26 * grime; i++) {
    const x = r.range(0, w);
    const y0 = r.chance(0.5) ? 0 : r.range(0, h * 0.5);
    const len = r.range(h * 0.1, h * 0.6);
    const grd = g.createLinearGradient(0, y0, 0, y0 + len);
    grd.addColorStop(0, `rgba(80,66,50,${0.25 * grime})`);
    grd.addColorStop(1, 'rgba(80,66,50,0)');
    g.fillStyle = grd;
    g.fillRect(x, y0, r.range(1, Math.max(2, w * 0.006)), len);
  }
  // Rust bleed from bolts at the corners.
  if (rust > 0) {
    for (const [bx, by] of [[0.04, 0.08], [0.96, 0.08], [0.04, 0.92], [0.96, 0.92]]) {
      if (!r.chance(0.75)) continue;
      const x = bx * w;
      const y = by * h;
      const len = r.range(h * 0.08, h * 0.35) * rust * 2;
      const grd = g.createLinearGradient(0, y, 0, y + len);
      grd.addColorStop(0, `rgba(120,55,20,${0.6 * rust})`);
      grd.addColorStop(1, 'rgba(120,55,20,0)');
      g.fillStyle = grd;
      g.fillRect(x - w * 0.006, y, w * 0.012, len);
      g.fillStyle = `rgba(60,40,30,${0.8})`;
      g.beginPath();
      g.arc(x, y, Math.max(2, w * 0.006), 0, Math.PI * 2);
      g.fill();
    }
  }
  // Scratches & chips.
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 60 * scratches; i++) {
    const x = r.range(0, w);
    const y = r.range(0, h);
    const a = r.range(0, Math.PI * 2);
    const l = r.range(4, w * 0.05);
    g.strokeStyle = `rgba(230,225,215,${r.range(0.05, 0.25)})`;
    g.lineWidth = r.range(0.5, 1.6);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  // Fine noise speckle to break flat colour.
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r.next() - 0.5) * 14;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  g.putImageData(img, 0, 0);
  g.restore();
}

/** Fit text into a box by shrinking the font size; returns the size used. */
export function fitText(g, text, maxW, size, fontTpl) {
  let s = size;
  for (let i = 0; i < 30; i++) {
    g.font = fontTpl(s);
    if (g.measureText(text).width <= maxW) break;
    s *= 0.94;
  }
  return s;
}

const paintedCache = new Map();

/**
 * A painted / printed sign face. `draw(g, w, h)` paints the art; weathering is added after.
 * opts.lit: back-lit box sign (glows at night through SIGNS.uNight) — value is glow strength.
 */
export function paintedSignMat(key, pxW, pxH, draw, opts = {}) {
  const ck = `${key}|${opts.lit ?? 0}`;
  if (paintedCache.has(ck)) return paintedCache.get(ck);
  const tex = canvasTexture(`sign:${key}`, pxW, pxH, (g, w, h) => {
    draw(g, w, h);
    if (opts.weather !== false) weatherCanvas(g, w, h, { seed: hashKey(key), ...(opts.weather || {}) });
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const m = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: opts.rough ?? 0.62,
    metalness: opts.metal ?? 0,
    transparent: !!opts.transparent,
    alphaTest: opts.transparent ? 0.5 : 0,
  });
  if (opts.lit) {
    // Back-lit plastic face: emissive = the art itself, only at night.
    m.emissiveMap = tex;
    m.emissive = new THREE.Color(0xffffff);
    m.emissiveIntensity = 0;
    const strength = opts.lit;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uNight = SIGNS.uNight;
      sh.uniforms.uLitK = { value: strength };
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uNight; uniform float uLitK;')
        .replace('#include <emissivemap_fragment>', `
          vec4 emc = texture2D( emissiveMap, vEmissiveMapUv );
          totalEmissiveRadiance = emc.rgb * emc.rgb * uLitK * uNight;`);
    };
    m.customProgramCacheKey = () => 'lit-sign';
    m.emissiveIntensity = 1;
  }
  m.name = `sign:${key}`;
  paintedCache.set(ck, m);
  return m;
}

function hashKey(s) {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) + 1;
}

// ---- Neon ---------------------------------------------------------------------------------

/**
 * Neon sign drawn as glass tubes. Daytime: pale coloured glass with a dark backer showing.
 * Night: tubes glow (HDR, so bloom picks them up) + a soft halo plane spills light on the wall.
 * @param {string} key
 * @param {Array<{text, font, size, color, y, x?, align?, script?, tube?}>} lines  canvas px units
 * @param {object} o  w, h (canvas px), worldW (m), backer (hex|null), flicker: {broken:[idx], rate}
 * @returns {{group: THREE.Group, mat, haloMat, setOn(v)}}
 */
export function neonSign(key, lines, o = {}) {
  const W = o.w ?? 1024;
  const H = o.h ?? 256;
  const segments = []; // drawn tube runs, each with its own flicker channel (0..3)
  // Tube mask: R = tube core, G = halo, B = flicker channel id / 3
  const mask = canvasTexture(`neon:${key}`, W, H, (g) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    lines.forEach((ln, li) => {
      const ch = (ln.channel ?? li) % 4;
      g.font = ln.font;
      g.textAlign = ln.align || 'center';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      g.lineCap = 'round';
      const x = ln.x ?? W / 2;
      const tube = ln.tube ?? Math.max(3, (ln.size || 60) * 0.075);
      // Halo (green) — wide blurred stroke.
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.shadowColor = 'rgba(0,255,0,1)';
      g.shadowBlur = tube * 5;
      g.strokeStyle = 'rgba(0,150,0,1)';
      g.lineWidth = tube * 2.2;
      if (ln.fill) g.fillText(ln.text, x, ln.y);
      else g.strokeText(ln.text, x, ln.y);
      g.restore();
      // Core tube (red) + channel (blue).
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = `rgb(255,0,${Math.round((ch / 3) * 255)})`;
      g.fillStyle = g.strokeStyle;
      g.lineWidth = tube;
      if (ln.fill) g.fillText(ln.text, x, ln.y);
      else g.strokeText(ln.text, x, ln.y);
      g.restore();
      segments.push(ch);
    });
    if (o.drawExtra) o.drawExtra(g, W, H);
  }, { srgb: false });
  mask.wrapS = mask.wrapT = THREE.ClampToEdgeWrapping;
  // Colour per line is baked into a colour texture (tubes are coloured glass by day).
  const colTex = canvasTexture(`neoncol:${key}`, W, H, (g) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    for (const ln of lines) {
      g.font = ln.font;
      g.textAlign = ln.align || 'center';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      g.lineCap = 'round';
      const tube = ln.tube ?? Math.max(3, (ln.size || 60) * 0.075);
      g.strokeStyle = ln.color;
      g.fillStyle = ln.color;
      g.lineWidth = tube * 2.6;
      g.shadowColor = ln.color;
      g.shadowBlur = tube * 5;
      if (ln.fill) g.fillText(ln.text, ln.x ?? W / 2, ln.y);
      else g.strokeText(ln.text, ln.x ?? W / 2, ln.y);
    }
    if (o.drawExtraColor) o.drawExtraColor(g, W, H);
  });
  colTex.wrapS = colTex.wrapT = THREE.ClampToEdgeWrapping;

  const chan = { value: new THREE.Vector4(1, 1, 1, 1) };
  const intensity = o.intensity ?? 9;
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: colTex,
    roughness: 0.25,
    metalness: 0,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tMask = { value: mask };
    sh.uniforms.uNight = SIGNS.uNight;
    sh.uniforms.uChan = chan;
    sh.uniforms.uNeonK = { value: intensity };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tMask; uniform float uNight; uniform vec4 uChan; uniform float uNeonK;')
      .replace('#include <map_fragment>', `
        vec4 nm = texture2D(tMask, vMapUv);
        vec3 ncol = texture2D(map, vMapUv).rgb;
        int ci = int(floor(nm.b * 3.0 + 0.5));
        float on = ci == 0 ? uChan.x : ci == 1 ? uChan.y : ci == 2 ? uChan.z : uChan.w;
        float core = nm.r;
        // Day: glass tube (pale tint, shiny). Night: coloured glow, white-hot core.
        diffuseColor.rgb = mix(vec3(0.6), ncol * 0.6 + 0.35, core) * (1.0 - uNight * 0.85);
        diffuseColor.a = clamp(core * 1.2, 0.0, 1.0);`)
      .replace('#include <emissivemap_fragment>', `
        float lit = uNight * on;
        vec3 hot = mix(ncol, vec3(1.0, 0.95, 0.9), 0.35 * core);
        totalEmissiveRadiance = hot * core * uNeonK * lit;
        diffuseColor.a = max(diffuseColor.a, nm.g * 0.85 * lit);
        totalEmissiveRadiance += ncol * nm.g * nm.g * uNeonK * 0.16 * lit;`);
  };
  mat.customProgramCacheKey = () => 'neon-sign';
  mat.name = `neon:${key}`;

  const worldW = o.worldW ?? 4;
  const worldH = worldW * (H / W);
  const group = new THREE.Group();
  group.name = `neon:${key}`;
  if (o.backer !== null) {
    const bk = new THREE.Mesh(new THREE.PlaneGeometry(worldW, worldH), o.backerMat || new THREE.MeshStandardMaterial({ color: o.backer ?? 0x15130f, roughness: 0.8 }));
    bk.position.z = -0.03;
    bk.receiveShadow = true;
    group.add(bk);
  }
  const tubes = new THREE.Mesh(new THREE.PlaneGeometry(worldW, worldH), mat);
  tubes.renderOrder = 2;
  group.add(tubes);

  // Personality: some signs have a dying segment that stutters, some cycle words.
  const fl = o.flicker || {};
  const rng = new Rng(hashKey(key));
  const state = { stutter: 0, next: rng.range(2, 9) };
  const f = {
    update(night, time) {
      chan.value.set(1, 1, 1, 1);
      if (night < 0.05) return;
      if (fl.cycle) {
        // Words lighting in sequence (e.g. "NO" / "VACANCY" alternating).
        const k = Math.floor(time / (fl.cycle || 1.2)) % (fl.cycleSteps || 3);
        for (let c = 0; c < 4; c++) chan.value.setComponent(c, fl.cycleMap ? fl.cycleMap(c, k) : 1);
      }
      for (const b of fl.broken || []) {
        // Dying tube: mostly off with bursts of buzzing flicker.
        if (time > state.next) {
          state.stutter = time + rng.range(0.4, 2.2);
          state.next = time + rng.range(3, 11);
        }
        const v = time < state.stutter ? (Math.sin(time * 61.0) * Math.sin(time * 23.7) > -0.1 ? 1 : 0.05) : fl.deadMostly ? 0.04 : 1;
        chan.value.setComponent(b, v);
      }
    },
    chan,
  };
  flickerables.push(f);
  return { group, mat, tubes, flicker: f, worldW, worldH, chan };
}

// ---- Marquee bulbs ------------------------------------------------------------------------

// A 5 cm glowing bulb never needs a smooth sphere: an icosphere (80 tris) on desktop tiers and a
// plain icosahedron (20 tris) on tier low — there are several thousand of them downtown.
const bulbGeoCache = { g: null, detail: 1 };
function bulbGeometry() {
  if (!bulbGeoCache.g) bulbGeoCache.g = new THREE.IcosahedronGeometry(1, bulbGeoCache.detail);
  return bulbGeoCache.g;
}

/**
 * Instanced marquee bulbs. Each bulb has a sequence index (chase order) and colour.
 * pattern: 'chase' (every 3rd bulb lit, travelling), 'twinkle', 'steady', 'wave'.
 */
export class BulbSet {
  constructor({ radius = 0.05, pattern = 'chase', speed = 6, intensity = 7, dayIntensity = 0.0, steps = 3 } = {}) {
    this.radius = radius;
    this.pattern = pattern;
    this.speed = speed;
    this.intensity = intensity;
    this.dayIntensity = dayIntensity;
    this.steps = steps;
    this.items = [];
  }

  add(pos, seq, color = 0xffd9a0, scale = 1) {
    this.items.push({ pos: pos.clone ? pos.clone() : new THREE.Vector3(...pos), seq, color, scale });
  }

  build(name = 'bulbs') {
    const n = this.items.length;
    const mat = new THREE.MeshStandardMaterial({ color: 0xf2eee6, roughness: 0.15, metalness: 0, emissive: 0xffffff });
    const seqAttr = new Float32Array(n);
    const pattern = { chase: 0, twinkle: 1, steady: 2, wave: 3 }[this.pattern] ?? 0;
    const speed = this.speed;
    // Hundreds of HDR bulbs sum into one wide bloom veil; 0.5 keeps each bulb hot (above the
    // bloom threshold) while the marquee reads as crisp points instead of milky haze.
    const k = this.intensity * 0.5;
    const steps = this.steps;
    const dayI = this.dayIntensity;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uNight = SIGNS.uNight;
      sh.uniforms.uTime = SIGNS.uTime;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aSeq;\nvarying float vSeq;\nvarying vec3 vBulbCol;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSeq = aSeq;\n#ifdef USE_INSTANCING_COLOR\nvBulbCol = instanceColor;\n#else\nvBulbCol = vec3(1.0);\n#endif');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uNight; uniform float uTime; varying float vSeq; varying vec3 vBulbCol;')
        .replace('#include <emissivemap_fragment>', `
          float s = vSeq;
          float on;
          ${pattern === 0 ? `on = step(0.5, 1.0 - mod(s - floor(uTime * ${speed.toFixed(2)}), ${steps.toFixed(1)}));
             on = max(on, 0.18);` : ''}
          ${pattern === 1 ? `float ph = fract(sin(s * 12.9898) * 43758.5453);
             on = 0.35 + 0.65 * step(0.45, fract(uTime * (0.6 + ph) + ph));` : ''}
          ${pattern === 2 ? 'on = 1.0;' : ''}
          ${pattern === 3 ? `on = 0.25 + 0.75 * pow(0.5 + 0.5 * sin(s * 0.35 - uTime * ${speed.toFixed(2)}), 3.0);` : ''}
          float bright = mix(${dayI.toFixed(3)}, 1.0, uNight);
          totalEmissiveRadiance = vBulbCol * on * ${k.toFixed(2)} * bright;
          diffuseColor.rgb = mix(diffuseColor.rgb, vBulbCol * 0.9, 0.35);`);
    };
    mat.customProgramCacheKey = () => `bulbs-${pattern}-${speed}-${k}-${steps}-${dayI}`;
    const mesh = new THREE.InstancedMesh(bulbGeometry(), mat, n);
    const m4 = new THREE.Matrix4();
    const c = new THREE.Color();
    this.items.forEach((it, i) => {
      const r = this.radius * it.scale;
      m4.makeScale(r, r, r).setPosition(it.pos);
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, c.set(it.color));
      seqAttr[i] = it.seq;
    });
    mesh.geometry = mesh.geometry.clone();
    mesh.geometry.setAttribute('aSeq', new THREE.InstancedBufferAttribute(seqAttr, 1));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = name;
    mesh.computeBoundingSphere();
    return mesh;
  }
}

// ---- LED screen -----------------------------------------------------------------------------

/**
 * Animated LED billboard. `slides` are draw callbacks (g, w, h, i) rendered into one tall atlas;
 * the shader cycles them with wipe transitions, an LED dot mask and a slight scan shimmer.
 * @returns material (use on a plane with UVs 0..1)
 */
export function ledScreenMat(key, slides, { w = 512, h = 192, hold = 5, dots = [192, 72], intensity = 3.2, dayIntensity = 1.6 } = {}) {
  const n = slides.length;
  const tex = canvasTexture(`led:${key}`, w, h * n, (g) => {
    for (let i = 0; i < n; i++) {
      g.save();
      g.translate(0, i * h);
      g.beginPath();
      g.rect(0, 0, w, h);
      g.clip();
      slides[i](g, w, h, i);
      g.restore();
    }
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  const m = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.35, metalness: 0.1, emissive: 0xffffff });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tLed = { value: tex };
    sh.uniforms.uNight = SIGNS.uNight;
    sh.uniforms.uTime = SIGNS.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vLedUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvLedUv = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tLed; uniform float uNight; uniform float uTime; varying vec2 vLedUv;
        vec3 slide(float i, vec2 uv) {
          float k = mod(i, ${n.toFixed(1)});
          // Atlas: slide 0 at the top of the canvas (uv.y high).
          return texture2D(tLed, vec2(uv.x, (${n.toFixed(1)} - 1.0 - k + uv.y) / ${n.toFixed(1)})).rgb;
        }`)
      .replace('#include <emissivemap_fragment>', `
        vec2 grid = vec2(${dots[0].toFixed(1)}, ${dots[1].toFixed(1)});
        vec2 cell = floor(vLedUv * grid);
        vec2 cuv = (cell + 0.5) / grid;
        float t = uTime / ${hold.toFixed(2)};
        float i = floor(t);
        float f = fract(t);
        // Wipe transition during the last 12% of each hold (direction alternates).
        float wipe = smoothstep(0.88, 1.0, f);
        float edge = mod(i, 2.0) < 0.5 ? cuv.x : 1.0 - cuv.y;
        vec3 a = slide(i, cuv);
        vec3 b = slide(i + 1.0, cuv);
        vec3 c = mix(a, b, step(edge, wipe));
        // Sparkle on bright pixels; LED dot shape.
        vec2 q = fract(vLedUv * grid) - 0.5;
        float dotm = smoothstep(0.5, 0.28, length(q));
        float shimmer = 0.92 + 0.08 * sin(uTime * 3.0 + cell.y * 0.7);
        float br = mix(${dayIntensity.toFixed(2)}, ${intensity.toFixed(2)}, uNight);
        totalEmissiveRadiance = c * c * dotm * br * shimmer;`);
  };
  m.customProgramCacheKey = () => `led-${key}`;
  m.name = `led:${key}`;
  return m;
}
