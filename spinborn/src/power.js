// SPINBORN power look (anime power-up): how strong you are shows on you.
//  level 0 weak = nothing, slouched | 1 = faint glow | 2 = aura flame + rising sparks + floating rocks
//  3 = full-body flame aura, body outline glow, lightning on the skin, hair floats + glows, ground cracks, shockwave
//  4 = reality breaking: everything above + cracks in space + glass shards orbiting
// Villains/demons get a crimson-black aura + red eyes, holy races gold-white.
import * as THREE from 'three';

const NOISE = `
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a * n(p); p *= 2.07; a *= 0.5; } return v; }`;

// big teardrop flame behind the body (faces the camera)
function auraBillboardMat(col, core) {
  return new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, col: { value: new THREE.Color(col) }, core: { value: new THREE.Color(core) }, k: { value: 1 }, grow: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float t; uniform vec3 col; uniform vec3 core; uniform float k; uniform float grow; varying vec2 vUv; ${NOISE}
      void main(){
        vec2 p = vUv - vec2(0.5, 0.40);
        p.x *= 2.0;
        float r = length(p);
        float ang = atan(p.x, p.y);
        float up = clamp(p.y * 1.6 + 0.45, 0.0, 1.0);
        float tongues = fbm(vec2(ang * 3.2, r * 3.0 - t * 2.6)) * 0.95 + fbm(vec2(p.x * 7.0, p.y * 2.5 - t * 4.5)) * 0.55;
        float edge = (0.20 + tongues * 0.16 * (0.35 + up * 1.4)) * grow;
        float body = smoothstep(edge, edge * 0.45, r);
        float hot = smoothstep(edge * 0.8, 0.0, r);
        float streak = smoothstep(0.62, 0.95, fbm(vec2(p.x * 14.0, p.y * 1.2 - t * 6.0))) * up * body;
        float a = clamp(body * 0.85 + streak * 0.8, 0.0, 1.0) * k;
        vec3 c = mix(col, core, clamp(hot * 0.9 + streak, 0.0, 1.0));
        gl_FragColor = vec4(c * a * 1.7, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
  });
}

// glow shell around the real body (skinned, so it follows every move)
export function shellMat(col, thick, strength, mask, cut = 0.5) {
  return new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, col: { value: new THREE.Color(col) }, thick: { value: thick }, k: { value: strength }, mask: { value: mask || null }, cut: { value: mask ? cut : -1 } },
    vertexShader: `#include <common>
      #include <skinning_pars_vertex>
      uniform float thick; varying float vF; varying vec3 vWP; varying vec2 vUv;
      void main(){
        vUv = uv;
        #include <begin_vertex>
        #include <beginnormal_vertex>
        transformed += normalize(normal) * thick;
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <skinning_vertex>
        vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
        vec3 nn = normalize(normalMatrix * objectNormal);
        vF = 1.0 - abs(dot(nn, normalize(-mv.xyz)));
        vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform float t; uniform vec3 col; uniform float k; uniform sampler2D mask; uniform float cut; varying float vF; varying vec3 vWP; varying vec2 vUv; ${NOISE}
      void main(){
        if (cut >= 0.0 && texture2D(mask, vUv).a < cut) discard;   // same cut-out as the cloth (hidden parts stay hidden)
        float fl = fbm(vec2((vWP.x + vWP.z) * 7.0, vWP.y * 6.0 - t * 5.0));
        float rim = vF * vF;
        float a = (rim * 1.1 + 0.06) * (0.55 + fl * 0.9) * k;
        gl_FragColor = vec4(col * a, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide, toneMapped: false
  });
}

function crackTexture(size = 512, glow = '#9fe8ff', count = 9, spread = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  g.translate(size / 2, size / 2); g.lineCap = 'round'; g.lineJoin = 'round';
  const seed = Math.floor(Math.random() * 1e9);
  let rnd = mulberry(seed);
  const branch = (x, y, a, len, w, depth) => {
    let px = x, py = y; const segs = 6 + Math.floor(rnd() * 5);
    g.beginPath(); g.moveTo(px, py);
    for (let i = 0; i < segs; i++) { a += (rnd() - 0.5) * 0.9; const l = len / segs; px += Math.cos(a) * l; py += Math.sin(a) * l; g.lineTo(px, py);
      if (depth < 2 && rnd() < 0.28) { g.stroke(); branch(px, py, a + (rnd() - 0.5) * 1.6, len * 0.45, w * 0.6, depth + 1); g.beginPath(); g.moveTo(px, py); } }
    g.lineWidth = w; g.stroke();
  };
  for (const pass of [[glow, 14, 0.25], [glow, 6, 0.7], ['#ffffff', 2, 1]]) {
    g.strokeStyle = pass[0]; g.globalAlpha = pass[2]; g.shadowColor = glow; g.shadowBlur = pass[1] * 1.5;
    rnd = mulberry(seed); // same cracks on every glow pass
    for (let i = 0; i < count; i++) branch(0, 0, (i / count) * Math.PI * 2 + rnd() * 0.4, size * 0.48 * spread * (0.6 + rnd() * 0.4), pass[1] * 0.5, 0);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function dotTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}

// which power look a character gets
export function powerLook(C, tier) {
  const races = C.race + ' ' + (C.parents || []).join(' ');
  const evilRace = /Devil|Hollow|Lich|Ghoul|Deviant|Vampire|Symbiote|Zombie|Arrancar/.test(races);
  const evilVibe = /Cruel|Ruthless|Bloodthirsty|Vengeful|Unhinged|Edgy|Savage/.test(C.personality || '') || /Villain|Criminal|Assassin|Monster Clan/.test((C.org && C.org.kind) || '') ||
    /Demon|Blood|Chaos|Calamity|Destroyer|Reaper|Nightmare|Scarlet|Plague|Apocalypse|Black/.test(C.title || '') || /Demon/.test(C.transformation || '');
  const holy = /Angel|God|Eternal|Phoenix/.test(races) && !evilVibe;
  const golden = /Saiyan/.test(races) || /Golden|God Form|Limit Break/.test(C.transformation || '') || /Super Saiyan|Legendary/.test((C.extras && C.extras.saiyan_form) || '');
  const reality = tier >= 16 || (C.powers.some(p => /Reality|Omnipotence|Existence|Conceptual|Law|Narrative|Matter Erasure|Void|Space|Time/.test(p.name)) && tier >= 11);
  let col = C.auraColor && C.auraColor.startsWith('#') ? C.auraColor : C.auraColor === 'rainbow' ? '#ff5fd0' : C.auraColor === 'galaxy' ? '#7a5cff' : '#58b6ff';
  let core = '#ffffff';
  if (evilRace || evilVibe) { col = '#e0102e'; core = '#ff9a9a'; }
  else if (golden) { col = '#ffc21a'; core = '#fff6d0'; }
  else if (holy) { col = '#ffd35a'; core = '#fff7e0'; }
  const level = tier < 4 ? 0 : tier < 8 ? 1 : tier < 12 ? 2 : tier < 16 ? 3 : 4;
  return { level: reality ? Math.max(level, 4) : level, evil: evilRace || evilVibe, holy, golden, col, core, tier,
    eyes: (evilRace || evilVibe) ? '#ff1a2e' : golden ? '#2fd8ff' : holy ? '#ffe27a' : col,
    hair: golden && level >= 3 ? '#ffd23a' : null, spark: (evilRace || evilVibe) ? '#ff5070' : '#e8f6ff' };
}

export class PowerFX {
  constructor(height = 1.7) { this.group = new THREE.Group(); this.group.name = 'powerfx'; this.H = height; this.t = 0; this.parts = {}; this.dot = dotTex(); }
  dispose() {
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map && o.material.map !== this.dot) o.material.map.dispose(); o.material.dispose(); } });
    this.group.clear(); this.parts = {};
  }
  set(look, height) {
    this.dispose(); this.look = look; this.H = height || this.H; const H = this.H, L = look.level;
    if (L <= 0) return;
    // 1) the big flame aura (camera-facing, sits just behind the body)
    const k = [0, 0.45, 0.8, 1, 1.15][L];
    const bb = new THREE.Mesh(new THREE.PlaneGeometry(H * 1.6, H * 2.1), auraBillboardMat(look.col, look.core));
    bb.material.uniforms.k.value = k; bb.material.uniforms.grow.value = [0, 0.75, 0.9, 1.05, 1.2][L];
    bb.position.y = H * 0.62; bb.renderOrder = 2; bb.frustumCulled = false;
    const center = new THREE.Vector3(), camPos = new THREE.Vector3();
    bb.onBeforeRender = (r, s, cam) => {
      cam.getWorldPosition(camPos); this.group.getWorldPosition(center);
      const dx = camPos.x - center.x, dz = camPos.z - center.z, len = Math.hypot(dx, dz) || 1;
      const inv = this.group.getWorldQuaternion(new THREE.Quaternion()).invert();
      const dirLocal = new THREE.Vector3(dx / len, 0, dz / len).applyQuaternion(inv);
      const sc = this.group.getWorldScale(new THREE.Vector3()).x || 1;
      bb.position.set(-dirLocal.x * H * 0.22 / sc * sc, H * 0.62, -dirLocal.z * H * 0.22);
      bb.rotation.set(0, Math.atan2(dirLocal.x, dirLocal.z), 0);
      bb.updateMatrixWorld(true);
    };
    this.group.add(bb); this.parts.bb = bb;
    // 2) rising sparks hugging the body
    const n = [0, 50, 140, 260, 340][L];
    const pos = new Float32Array(n * 3), spd = new Float32Array(n);
    for (let i = 0; i < n; i++) { const r = H * (0.08 + Math.random() * 0.24), a = Math.random() * 6.283; pos.set([Math.cos(a) * r, Math.random() * H * 1.3, Math.sin(a) * r], i * 3); spd[i] = 0.8 + Math.random() * 1.8; }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({ map: this.dot, color: look.core, size: H * 0.022, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    pts.frustumCulled = false; this.group.add(pts); this.parts.pts = { pts, spd };
    // 3) floating rocks + ground cracks
    if (L >= 2) {
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a7e72, roughness: 0.9, flatShading: true, emissive: new THREE.Color(look.col), emissiveIntensity: 0.18 });
      const rocks = [];
      for (let i = 0; i < (L >= 3 ? 26 : 12); i++) {
        const g = new THREE.IcosahedronGeometry(H * (0.008 + Math.random() * 0.028), 0);
        const p = g.attributes.position; for (let v = 0; v < p.count; v++) p.setXYZ(v, p.getX(v) * (0.7 + Math.random() * 0.6), p.getY(v) * (0.6 + Math.random() * 0.5), p.getZ(v) * (0.7 + Math.random() * 0.6));
        g.computeVertexNormals();
        const m = new THREE.Mesh(g, rockMat); m.userData = { r: H * (0.32 + Math.random() * 0.35), a: Math.random() * 6.283, y0: 0, y1: H * (0.1 + Math.random() * 0.8), s: (Math.random() * 0.3 + 0.08) * (Math.random() < 0.5 ? -1 : 1), bob: Math.random() * 6, rise: Math.random() };
        this.group.add(m); rocks.push(m);
      }
      this.parts.rocks = rocks;
      const crack = new THREE.Mesh(new THREE.PlaneGeometry(H * 1.8, H * 1.8), new THREE.MeshBasicMaterial({ map: crackTexture(512, look.col, 11, 1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      crack.rotation.x = -Math.PI / 2; crack.position.y = 0.008; this.group.add(crack); this.parts.crack = crack;
      const crater = new THREE.Mesh(new THREE.CircleGeometry(H * 0.55, 48), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }));
      crater.rotation.x = -Math.PI / 2; crater.position.y = 0.004; this.group.add(crater);
    }
    // 4) lightning crawling on the body + shockwave rings
    if (L >= 3) {
      const bolts = [];
      for (let i = 0; i < 7; i++) {
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12 * 2 * 3), 3));
        const idx = []; for (let s = 0; s < 11; s++) idx.push(s * 2, s * 2 + 1, s * 2 + 2, s * 2 + 1, s * 2 + 3, s * 2 + 2); geo.setIndex(idx);
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: look.spark, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
        m.frustumCulled = false; m.renderOrder = 6; this.group.add(m); bolts.push(m);
      }
      this.parts.bolts = bolts; this.nextBolt = 0;
      const rings = [];
      for (let i = 0; i < 2; i++) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64), new THREE.MeshBasicMaterial({ color: look.col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; ring.userData.off = i * 0.5; this.group.add(ring); rings.push(ring);
      }
      this.parts.rings = rings;
    }
    // 5) reality breaking
    if (L >= 4) {
      const shardMat = new THREE.MeshBasicMaterial({ color: look.evil ? 0xff8090 : 0xcfefff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
      const shards = [];
      for (let i = 0; i < 10; i++) {
        const g = new THREE.BufferGeometry(); const s = H * (0.015 + Math.random() * 0.025);
        g.setAttribute('position', new THREE.Float32BufferAttribute([0, s, 0, -s * 0.6, -s * 0.5, 0, s * 0.7, -s * 0.4, 0], 3));
        const m = new THREE.Mesh(g, shardMat); m.userData = { r: H * (0.55 + Math.random() * 0.6), a: Math.random() * 6.283, y: H * (0.2 + Math.random() * 1.0), s: 0.15 + Math.random() * 0.3, spin: (Math.random() - 0.5) * 3 };
        this.group.add(m); shards.push(m);
      }
      this.parts.shards = shards;
    }
  }
  setEnv() { }
  update(dt) {
    this.t += dt; const t = this.t, H = this.H, p = this.parts; if (!this.look) return;
    if (p.bb) p.bb.material.uniforms.t.value = t;
    if (p.pts) {
      const pos = p.pts.pts.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) { let y = pos.getY(i) + p.pts.spd[i] * dt * H * 0.6; if (y > H * 1.35) y = 0; pos.setY(i, y); }
      pos.needsUpdate = true;
    }
    if (p.rocks) for (const m of p.rocks) { const u = m.userData; u.a += u.s * dt; u.rise = Math.min(1, u.rise + dt * 0.25);
      m.position.set(Math.cos(u.a) * u.r, u.y1 * u.rise + Math.sin(t * 1.3 + u.bob) * H * 0.03, Math.sin(u.a) * u.r); m.rotation.x += dt * u.s * 2; m.rotation.y += dt * 0.7; }
    if (p.crack) p.crack.material.opacity = 0.6 + Math.sin(t * 3) * 0.25;
    if (p.rings) for (const r of p.rings) { const k = (t * 0.6 + r.userData.off) % 1; r.scale.setScalar(0.15 + k * H * 1.3); r.material.opacity = (1 - k) * 0.75; }
    if (p.bolts && t > this.nextBolt) {
      this.nextBolt = t + 0.04 + Math.random() * 0.07;
      for (const b of p.bolts) {
        const on = Math.random() < 0.6; b.visible = on; if (!on) continue;
        const arr = b.geometry.attributes.position.array;
        const a0 = Math.random() * 6.283, r0 = H * (0.1 + Math.random() * 0.1);
        let x = Math.cos(a0) * r0, y = H * (0.15 + Math.random() * 0.8), z = Math.sin(a0) * r0;
        const w = H * 0.004;
        for (let s = 0; s < 12; s++) {
          arr.set([x - w, y, z, x + w, y + w, z], s * 6);
          x += (Math.random() - 0.5) * H * 0.05; y += (Math.random() - 0.35) * H * 0.045; z += (Math.random() - 0.5) * H * 0.05;
        }
        b.geometry.attributes.position.needsUpdate = true;
      }
    }
    if (p.shards) for (const m of p.shards) { const u = m.userData; u.a += u.s * dt; m.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(t + u.a) * H * 0.05, Math.sin(u.a) * u.r); m.rotation.x += dt * u.spin; m.rotation.y += dt * u.spin * 0.7; }
  }
}
