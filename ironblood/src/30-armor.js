
// ---------- materials ----------
function canvasTex(size, draw, repeat = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// scratched, dented plate: light scratches and dark grime on a neutral base
const scratchTex = canvasTex(512, (g, s) => {
  const r = mulberry32(4);
  g.fillStyle = '#bdbdbd'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * 0.06})`; g.fillRect(r() * s, r() * s, 2 + r() * 30, 2 + r() * 30); }
  for (let i = 0; i < 260; i++) {
    g.strokeStyle = `rgba(255,255,255,${0.15 + r() * 0.35})`; g.lineWidth = r() < 0.85 ? 0.6 : 1.4;
    const x = r() * s, y = r() * s, a = r() * 6.28, l = 6 + r() * 60;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
}, 2);
const roughTex = canvasTex(256, (g, s) => {
  const r = mulberry32(9);
  g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 1500; i++) { const v = Math.floor(80 + r() * 120); g.fillStyle = `rgba(${v},${v},${v},.35)`; g.fillRect(r() * s, r() * s, 1 + r() * 6, 1 + r() * 6); }
}, 2);
roughTex.colorSpace = THREE.NoColorSpace;
const clothTex = canvasTex(128, (g, s) => {
  const r = mulberry32(17);
  g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += 2) { g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.08})`; g.fillRect(0, y, s, 1); }
  for (let x = 0; x < s; x += 2) { g.fillStyle = `rgba(255,255,255,${r() * 0.05})`; g.fillRect(x, 0, 1, s); }
}, 6);

// blood soaks into a material where noise is under the blood level (0..1)
const BLOOD_GLSL = `
float bhash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float bnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(bhash(i), bhash(i + vec3(1,0,0)), f.x), mix(bhash(i + vec3(0,1,0)), bhash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(bhash(i + vec3(0,0,1)), bhash(i + vec3(1,0,1)), f.x), mix(bhash(i + vec3(0,1,1)), bhash(i + vec3(1,1,1)), f.x), f.y), f.z); }`;
function addBlood(mat, uniforms) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uBlood = uniforms.uBlood;
    sh.vertexShader = 'varying vec3 vObjP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vObjP = position;');
    sh.fragmentShader = 'uniform float uBlood; varying vec3 vObjP;\n' + BLOOD_GLSL + '\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        float bn = bnoise(vObjP * 13.0) * 0.6 + bnoise(vObjP * 41.0) * 0.4;
        float bloodMask = smoothstep(1.0 - uBlood - 0.04, 1.0 - uBlood + 0.04, bn) * step(0.001, uBlood);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.22, 0.008, 0.006), bloodMask * 0.92);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.22, bloodMask);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n metalnessFactor = mix(metalnessFactor, 0.05, bloodMask);');
  };
  mat.customProgramCacheKey = () => 'blood';
  return mat;
}
function metalMat(color, rough, uniforms) {
  return addBlood(new THREE.MeshStandardMaterial({ color, metalness: 0.9, roughness: rough, map: scratchTex, roughnessMap: roughTex }), uniforms);
}
function clothMat(color, uniforms) {
  return addBlood(new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: 0.92, map: clothTex, side: THREE.DoubleSide }), uniforms);
}
function leatherMat(color, uniforms) {
  return addBlood(new THREE.MeshStandardMaterial({ color, metalness: 0.05, roughness: 0.7, map: clothTex }), uniforms);
}

// ---------- geometry helpers (all built in the model's T-pose space, meters; the model faces -Z) ----------
const _up = new THREE.Vector3(0, 1, 0);
function cylBetween(a, b, r1, r2, seg = 14, open = false) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), dir = B.clone().sub(A), len = dir.length();
  const g = new THREE.CylinderGeometry(r2, r1, len, seg, 1, open);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_up, dir.normalize()));
  g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  return g;
}
function shell(r, x, y, z, sx = 1, sy = 1, sz = 1, phiLen = Math.PI * 2, thetaLen = Math.PI / 2, rx = 0, rz = 0) {
  const g = new THREE.SphereGeometry(r, 18, 10, 0, phiLen, 0, thetaLen);
  g.scale(sx, sy, sz); g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z);
  return g;
}
function boxAt(w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); return g;
}
function lathe(points, x, z, sx, sz, seg = 24) {
  const g = new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  g.scale(sx, 1, sz); g.translate(x, 0, z); return g;
}

// ---------- armor ----------
// tiers: 0 = footman (kettle hat, mail, few plates), 1 = man-at-arms (half plate), 2 = knight (full plate), 3 = you
const TIER = [
  { name: 'Footman', hp: 90, armor: { head: 0.45, neck: 0.15, chest: 0.4, belly: 0.3, uarm: 0.2, farm: 0.15, thigh: 0.15, shin: 0.25 }, speed: 1.05 },
  { name: 'Man-at-Arms', hp: 110, armor: { head: 0.65, neck: 0.3, chest: 0.65, belly: 0.5, uarm: 0.5, farm: 0.4, thigh: 0.45, shin: 0.5 }, speed: 1 },
  { name: 'Knight', hp: 130, armor: { head: 0.8, neck: 0.35, chest: 0.8, belly: 0.65, uarm: 0.65, farm: 0.6, thigh: 0.65, shin: 0.65 }, speed: 0.92 },
  { name: 'You', hp: 100, armor: { head: 0.7, neck: 0.35, chest: 0.7, belly: 0.55, uarm: 0.55, farm: 0.5, thigh: 0.55, shin: 0.55 }, speed: 1 },
];

function bone(model, n) { return model.getObjectByName('mixamorig' + n); }

function buildArmor(model, opt) {
  // opt: { tier, metal, rough, cloth, leather, player }
  const U = { uBlood: { value: 0 } };
  const M = metalMat(opt.metal, opt.rough, U), C = clothMat(opt.cloth, U), L = leatherMat(opt.leather, U);
  const parts = [];
  const put = (boneName, geos, mat, extra = {}) => {
    const geo = Array.isArray(geos) ? mergeGeometries(geos.map(g => g.index ? g.toNonIndexed() : g)) : geos;
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true; m.userData.armor = true; Object.assign(m.userData, extra);
    bone(model, boneName).attach(m);
    parts.push(m);
    return m;
  };
  model.updateMatrixWorld(true);
  const T = opt.tier;
  const plate = T >= 1;

  // --- head ---
  if (T === 0) {
    // kettle hat: wide brim, open face
    put('Head', [shell(0.122, 0, 1.74, 0.03, 1, 0.9, 1.05), cylBetween([0, 1.735, 0.03], [0, 1.745, 0.03], 0.21, 0.2, 24)], M);
  } else {
    const helm = [
      cylBetween([0, 1.585, 0.03], [0, 1.80, 0.03], 0.118, 0.124, 22),
      shell(0.124, 0, 1.80, 0.03, 1, 0.75, 1),
      boxAt(0.012, 0.05, 0.25, 0, 1.86, 0.03), // crest ridge
      cylBetween([0, 1.55, 0.03], [0, 1.59, 0.03], 0.13, 0.12, 22), // bevor lip
    ];
    put('Head', helm, M);
    // eye slit (glows on you) and breathing holes
    const slitMat = opt.player
      ? new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff1608, emissiveIntensity: 3 })
      : new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 });
    put('Head', [boxAt(0.085, 0.014, 0.02, -0.045, 1.715, -0.088, 0, 0.32), boxAt(0.085, 0.014, 0.02, 0.045, 1.715, -0.088, 0, -0.32)], slitMat);
    const holes = [];
    for (let i = 0; i < 6; i++) holes.push(boxAt(0.008, 0.008, 0.02, -0.03 + (i % 3) * 0.03, 1.64 - Math.floor(i / 3) * 0.022, -0.118));
    put('Head', holes, new THREE.MeshBasicMaterial({ color: 0x050505 }));
  }
  if (opt.player) {
    // hood over the helmet and onto the shoulders
    const hood = new THREE.SphereGeometry(0.152, 20, 12, -0.45, Math.PI + 0.9, 0, Math.PI * 0.64);
    hood.scale(1, 1.12, 1.08); hood.translate(0, 1.70, 0.045);
    put('Head', hood, C);
    put('Spine2', [cylBetween([0, 1.43, 0.05], [0, 1.58, 0.06], 0.25, 0.13, 20, true)], C);
  }
  // --- neck + torso ---
  put('Spine2', cylBetween([0, 1.47, 0.05], [0, 1.56, 0.055], 0.13, 0.085, 18), plate ? M : L); // gorget / mail collar
  const chest = lathe([[0.001, 1.08], [0.15, 1.08], [0.16, 1.16], [0.165, 1.27], [0.19, 1.38], [0.18, 1.45], [0.12, 1.5], [0.001, 1.5]], 0, 0.035, 1, 0.74);
  put('Spine1', chest, plate ? M : L);
  if (plate) put('Spine1', boxAt(0.015, 0.36, 0.02, 0, 1.3, -0.103, 0.12), M); // center ridge
  if (!opt.player) {
    // tabard in the house colors
    put('Spine', [boxAt(0.27, 0.42, 0.012, 0, 1.17, -0.1), boxAt(0.27, 0.42, 0.012, 0, 1.17, 0.17)], C);
  }
  // waist faulds + tassets
  put('Hips', [cylBetween([0, 0.94, 0.03], [0, 1.1, 0.03], 0.19, 0.165, 20, true)], plate ? M : C);
  put('Hips', lathe([[0.0, 1.07], [0.17, 1.07], [0.17, 1.1], [0.0, 1.1]], 0, 0.03, 1, 0.8), L); // belt

  // --- arms (left = -x, right = +x) ---
  for (const s of [-1, 1]) {
    const side = s < 0 ? 'Left' : 'Right';
    // pauldron: three stacked lames
    const pd = [];
    for (let k = 0; k < 3; k++) pd.push(shell(0.105 - k * 0.012, s * (0.2 + k * 0.03), 1.49 - k * 0.025, 0.06, 1.05, 0.9, 1.1, Math.PI * 2, Math.PI / 2, 0, -s * (0.35 + k * 0.25)));
    put(side + 'Arm', pd, plate || T === 0 ? M : L);
    put(side + 'Arm', cylBetween([s * 0.22, 1.48, 0.06], [s * 0.43, 1.48, 0.06], 0.056, 0.05), plate ? M : L);
    put(side + 'ForeArm', shell(0.055, s * 0.44, 1.48, 0.07, 1, 1, 1, Math.PI * 2, Math.PI * 0.7, Math.PI / 2, 0), M); // couter
    put(side + 'ForeArm', cylBetween([s * 0.45, 1.48, 0.06], [s * 0.665, 1.48, 0.06], 0.048, 0.042), plate ? M : L);
    put(side + 'Hand', [boxAt(0.12, 0.055, 0.095, s * 0.75, 1.475, 0.065), cylBetween([s * 0.66, 1.48, 0.06], [s * 0.70, 1.48, 0.06], 0.06, 0.05, 12, true)], plate ? M : L);
  }
  // --- legs ---
  for (const s of [-1, 1]) {
    const side = s < 0 ? 'Left' : 'Right';
    put(side + 'UpLeg', cylBetween([s * 0.1, 0.99, 0.0], [s * 0.1, 0.62, -0.01], 0.08, 0.064), plate ? M : C);
    put(side + 'Leg', shell(0.066, s * 0.1, 0.58, -0.035, 1, 1, 1, Math.PI * 2, Math.PI * 0.7, -Math.PI / 2, 0), M); // poleyn
    put(side + 'Leg', cylBetween([s * 0.1, 0.56, -0.01], [s * 0.1, 0.15, 0.025], 0.058, 0.047), T === 0 ? L : M);
    put(side + 'Foot', boxAt(0.1, 0.075, 0.25, s * 0.105, 0.06, -0.05, 0.08), T === 0 ? L : M);
  }
  return { parts, uniforms: U, mats: [M, C, L] };
}

// tint the soldier's own body (padding under the armor) to match
function tintBody(model, color) {
  model.traverse(o => {
    if (o.isSkinnedMesh) {
      o.material = o.material.clone();
      o.material.color = new THREE.Color(color);
      if (o.name.includes('visor')) o.visible = false;
      o.castShadow = true; o.frustumCulled = false;
    }
  });
}

// ---------- the cape (verlet cloth hanging from the shoulders) ----------
class Cape {
  constructor(model, color, U) {
    this.model = model; this.W = 7; this.H = 11; this.len = 0.95;
    this.anchorBone = bone(model, 'Spine2');
    this.p = []; this.o = [];
    const r = mulberry32(3);
    this.cut = []; for (let i = 0; i < this.W; i++) this.cut.push(0.82 + r() * 0.18);
    for (let j = 0; j < this.H; j++) for (let i = 0; i < this.W; i++) { this.p.push(new THREE.Vector3()); this.o.push(new THREE.Vector3()); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.W * this.H * 3), 3));
    const uv = [];
    for (let j = 0; j < this.H; j++) for (let i = 0; i < this.W; i++) uv.push(i / (this.W - 1), j / (this.H - 1));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const idx = [];
    for (let j = 0; j < this.H - 1; j++) for (let i = 0; i < this.W - 1; i++) {
      const a = j * this.W + i, b = a + 1, c = a + this.W, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, clothMat(color, U));
    this.mesh.castShadow = true; this.mesh.frustumCulled = false;
    this.ready = false;
    // anchor offsets in the spine bone's space, taken at bind pose (model still at the origin)
    model.updateMatrixWorld(true);
    const inv = this.anchorBone.matrixWorld.clone().invert();
    this.local = this.anchors().map(v => v.applyMatrix4(inv));
  }
  anchors() {
    // shoulder line in the bone's space, behind the back
    const out = [];
    for (let i = 0; i < this.W; i++) {
      const t = i / (this.W - 1) - 0.5;
      out.push(new THREE.Vector3(t * 0.36, 1.47 - Math.abs(t) * 0.05, 0.13 + Math.abs(t) * 0.02));
    }
    return out;
  }
  update(dt, root, colliders) {
    const W = this.W, H = this.H, seg = this.len / (H - 1);
    const anchorsW = this.local.map(v => v.clone().applyMatrix4(this.anchorBone.matrixWorld));
    // teleport / respawn: drop the old cloth instead of stretching it across the map
    if (this.ready && this.p[0].distanceTo(anchorsW[0]) > 1.5) this.ready = false;
    if (!this.ready) {
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = j * W + i; this.p[k].copy(anchorsW[i]).y -= j * seg; this.o[k].copy(this.p[k]); }
      this.ready = true;
    }
    const g = -9.8 * dt * dt, wind = Math.sin(performance.now() * 0.0013) * 0.00004;
    for (let j = 1; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i, p = this.p[k], o = this.o[k];
      const vx = (p.x - o.x) * 0.97, vy = (p.y - o.y) * 0.97, vz = (p.z - o.z) * 0.97;
      o.copy(p); p.x += vx + wind; p.y += vy + g; p.z += vz + wind * 0.6;
    }
    for (let i = 0; i < W; i++) this.p[i].copy(anchorsW[i]);
    for (let it = 0; it < 4; it++) {
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const k = j * W + i;
        if (i < W - 1) this.solve(k, k + 1, 0.36 / (W - 1), j === 0);
        if (j < H - 1) this.solve(k, k + W, seg, j === 0);
      }
      // keep the cloth outside the body and above the ground
      for (let k = W; k < W * H; k++) {
        const p = this.p[k];
        for (const c of colliders) {
          const dx = p.x - c.x, dy = p.y - c.y, dz = p.z - c.z, d = Math.hypot(dx, dy, dz);
          if (d < c.r && d > 1e-5) { p.x = c.x + dx / d * c.r; p.y = c.y + dy / d * c.r; p.z = c.z + dz / d * c.r; }
        }
        const gh = groundH(p.x, p.z) + 0.02; if (p.y < gh) p.y = gh;
      }
    }
    const pos = this.mesh.geometry.attributes.position;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i, p = this.p[k];
      // ragged bottom edge: shorter columns pull their last rows up
      if (j === H - 1) { const a = this.p[k - W]; pos.setXYZ(k, lerp(a.x, p.x, this.cut[i]), lerp(a.y, p.y, this.cut[i]), lerp(a.z, p.z, this.cut[i])); }
      else pos.setXYZ(k, p.x, p.y, p.z);
    }
    pos.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }
  solve(a, b, rest, pinA) {
    const A = this.p[a], B = this.p[b];
    const dx = B.x - A.x, dy = B.y - A.y, dz = B.z - A.z, d = Math.hypot(dx, dy, dz) || 1e-6;
    const diff = (d - rest) / d;
    if (pinA) { B.x -= dx * diff; B.y -= dy * diff; B.z -= dz * diff; }
    else { A.x += dx * diff * 0.5; A.y += dy * diff * 0.5; A.z += dz * diff * 0.5; B.x -= dx * diff * 0.5; B.y -= dy * diff * 0.5; B.z -= dz * diff * 0.5; }
  }
}

// ---------- swords ----------
// weight in kg, damage per hit, swing speed, reach in meters, how well it beats armor, how well it cuts flesh
const SWORDS = [
  { id: 'arming', name: 'Arming Sword', sub: 'European one-hander, 13th century', weight: 1.1, dmg: 30, speed: 1.3, reach: 0.8, pierce: 0.25, cut: 1.0, unlock: 0 },
  { id: 'falchion', name: 'Falchion', sub: 'Heavy chopping blade, wide near the tip', weight: 1.35, dmg: 36, speed: 1.15, reach: 0.78, pierce: 0.18, cut: 1.3, unlock: 4 },
  { id: 'katana', name: 'Katana', sub: 'Curved Japanese blade, cuts flesh best', weight: 1.2, dmg: 38, speed: 1.22, reach: 0.95, pierce: 0.1, cut: 1.45, unlock: 10 },
  { id: 'longsword', name: 'Longsword', sub: 'Two-handed knightly sword', weight: 1.5, dmg: 44, speed: 1.0, reach: 1.02, pierce: 0.35, cut: 1.1, unlock: 18 },
  { id: 'claymore', name: 'Claymore', sub: 'Scottish greatsword, slow and brutal', weight: 2.5, dmg: 60, speed: 0.75, reach: 1.22, pierce: 0.5, cut: 1.15, unlock: 30 },
  { id: 'zwei', name: 'Zweihander', sub: 'Huge German two-hander, splits armor', weight: 3.2, dmg: 74, speed: 0.6, reach: 1.42, pierce: 0.62, cut: 1.2, unlock: 45 },
];
// blade: rings of a lozenge (or single-edge) cross-section along +Y, ending in a point
function swordBladeGeo(len, w0, w1, thick, curve = 0, singleEdge = false, widenTip = 0) {
  const N = 14, pos = [];
  const ring = (y, w, t, cx) => singleEdge
    ? [[cx - w, y, 0], [cx + w * 0.55, y, t], [cx + w * 0.6, y, -t], [cx - w, y, 0]]
    : [[cx - w, y, 0], [cx, y, t], [cx + w, y, 0], [cx, y, -t]];
  const rings = [];
  for (let i = 0; i <= N; i++) {
    const f = i / N, y = f * len * 0.93;
    let w = lerp(w0, w1, f) + widenTip * Math.sin(f * Math.PI * 0.9) * 0.5;
    const cx = curve * f * f;
    rings.push(ring(y, w, thick * (1 - f * 0.5), cx));
  }
  const tip = [curve, len, 0];
  const tri = (a, b, c) => pos.push(...a, ...b, ...c);
  for (let i = 0; i < N; i++) for (let k = 0; k < 4; k++) {
    const a = rings[i][k], b = rings[i][(k + 1) % 4], c = rings[i + 1][k], d = rings[i + 1][(k + 1) % 4];
    tri(a, c, b); tri(b, c, d);
  }
  for (let k = 0; k < 4; k++) tri(rings[N][k], tip, rings[N][(k + 1) % 4]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
function makeSword(def, U) {
  const g = new THREE.Group();
  const steel = addBlood(new THREE.MeshStandardMaterial({ color: 0xd4d8dc, metalness: 1, roughness: 0.16, map: scratchTex }), U);
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2724, metalness: 0.6, roughness: 0.45 });
  const grip = new THREE.MeshStandardMaterial({ color: 0x2b1a10, roughness: 0.85, map: clothTex });
  const gold = new THREE.MeshStandardMaterial({ color: 0x8a6a32, metalness: 0.9, roughness: 0.35 });
  let blade, guard, handle, pommel;
  switch (def.id) {
    case 'katana':
      blade = swordBladeGeo(0.72, 0.016, 0.012, 0.0055, -0.04, true);
      guard = new THREE.CylinderGeometry(0.042, 0.042, 0.008, 18);
      handle = cylBetween([0, -0.27, 0], [0, -0.01, 0], 0.016, 0.015, 10); pommel = new THREE.CylinderGeometry(0.018, 0.018, 0.02, 10).translate(0, -0.28, 0);
      break;
    case 'falchion':
      blade = swordBladeGeo(0.72, 0.022, 0.03, 0.005, 0, true, 0.03);
      guard = new THREE.BoxGeometry(0.17, 0.018, 0.025);
      handle = cylBetween([0, -0.12, 0], [0, -0.01, 0], 0.015, 0.014, 10); pommel = new THREE.SphereGeometry(0.024, 12, 8).translate(0, -0.135, 0);
      break;
    case 'longsword':
      blade = swordBladeGeo(0.95, 0.024, 0.008, 0.006);
      guard = new THREE.BoxGeometry(0.22, 0.018, 0.024);
      handle = cylBetween([0, -0.22, 0], [0, -0.01, 0], 0.016, 0.014, 10); pommel = new THREE.SphereGeometry(0.028, 12, 8).scale(1, 1, 0.6).translate(0, -0.24, 0);
      break;
    case 'claymore':
      blade = swordBladeGeo(1.12, 0.028, 0.01, 0.0065);
      guard = mergeGeometries([new THREE.BoxGeometry(0.3, 0.02, 0.026), new THREE.BoxGeometry(0.03, 0.03, 0.03).translate(0.15, 0.03, 0), new THREE.BoxGeometry(0.03, 0.03, 0.03).translate(-0.15, 0.03, 0)].map(x => x.toNonIndexed()));
      guard.rotateZ(0); handle = cylBetween([0, -0.3, 0], [0, -0.01, 0], 0.018, 0.016, 10); pommel = new THREE.SphereGeometry(0.032, 12, 8).translate(0, -0.32, 0);
      break;
    case 'zwei':
      blade = swordBladeGeo(1.32, 0.03, 0.011, 0.007);
      guard = mergeGeometries([new THREE.BoxGeometry(0.4, 0.024, 0.028), new THREE.BoxGeometry(0.06, 0.012, 0.02).translate(0.045, 0.2, 0), new THREE.BoxGeometry(0.06, 0.012, 0.02).translate(-0.045, 0.2, 0)].map(x => x.toNonIndexed()));
      handle = cylBetween([0, -0.38, 0], [0, -0.01, 0], 0.019, 0.017, 10); pommel = new THREE.SphereGeometry(0.036, 12, 8).translate(0, -0.4, 0);
      break;
    default:
      blade = swordBladeGeo(0.78, 0.022, 0.009, 0.0055);
      guard = new THREE.BoxGeometry(0.18, 0.016, 0.022);
      handle = cylBetween([0, -0.11, 0], [0, -0.01, 0], 0.015, 0.014, 10); pommel = new THREE.SphereGeometry(0.025, 12, 8).translate(0, -0.125, 0);
  }
  const bm = new THREE.Mesh(blade, steel); bm.position.y = 0.012;
  if (def.id === 'zwei' || def.id === 'claymore') bm.position.y = 0.02;
  const gm = new THREE.Mesh(guard, def.id === 'katana' ? gold : dark);
  const hm = new THREE.Mesh(handle, grip), pm = new THREE.Mesh(pommel, def.id === 'katana' ? gold : dark);
  for (const m of [bm, gm, hm, pm]) { m.castShadow = true; g.add(m); }
  g.userData.bladeLen = blade.boundingBox ? 0 : 0;
  blade.computeBoundingBox();
  g.userData.tip = blade.boundingBox.max.y + bm.position.y;
  g.userData.gripLen = -handle.attributes.position.array.reduce((m, v, i) => (i % 3 === 1 ? Math.min(m, v) : m), 0);
  return g;
}

// ---------- gore pieces ----------
// cross-section of a cut limb: armor edge, skin, fat, muscle, bone, marrow
function stumpTexture(neck) {
  return canvasTex(256, (g, s) => {
    const c = s / 2, r = mulberry32(neck ? 77 : 66);
    g.fillStyle = '#3a3a3c'; g.beginPath(); g.arc(c, c, c, 0, 7); g.fill();               // armor / cloth ring
    g.fillStyle = '#c99a86'; g.beginPath(); g.arc(c, c, c * 0.88, 0, 7); g.fill();        // skin
    g.fillStyle = '#e3c27a'; g.beginPath(); g.arc(c, c, c * 0.82, 0, 7); g.fill();        // fat
    const grd = g.createRadialGradient(c, c, c * 0.1, c, c, c * 0.78);
    grd.addColorStop(0, '#9e1a1a'); grd.addColorStop(1, '#6e0c0c');
    g.fillStyle = grd; g.beginPath(); g.arc(c, c, c * 0.78, 0, 7); g.fill();               // muscle
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(40,0,0,${0.2 + r() * 0.3})`; g.lineWidth = 1; const a = r() * 6.28; g.beginPath(); g.moveTo(c + Math.cos(a) * c * 0.2, c + Math.sin(a) * c * 0.2); g.lineTo(c + Math.cos(a) * c * 0.76, c + Math.sin(a) * c * 0.76); g.stroke(); }
    if (neck) {
      g.fillStyle = '#efe6d6'; g.beginPath(); g.arc(c, c * 1.32, c * 0.2, 0, 7); g.fill();  // vertebra
      g.fillStyle = '#d8c79a'; g.beginPath(); g.arc(c, c * 1.32, c * 0.09, 0, 7); g.fill(); // spinal cord
      g.fillStyle = '#2a0303'; g.beginPath(); g.ellipse(c, c * 0.68, c * 0.13, c * 0.1, 0, 0, 7); g.fill(); // windpipe
      g.strokeStyle = '#e8d8c8'; g.lineWidth = 4; g.stroke();
      for (const sx of [-1, 1]) { g.fillStyle = '#3b0000'; g.beginPath(); g.arc(c + sx * c * 0.35, c * 0.95, c * 0.07, 0, 7); g.fill(); } // arteries
    } else {
      g.fillStyle = '#efe6d6'; g.beginPath(); g.arc(c + c * 0.05, c, c * 0.24, 0, 7); g.fill();  // bone
      g.fillStyle = '#7a1212'; g.beginPath(); g.arc(c + c * 0.05, c, c * 0.12, 0, 7); g.fill();  // marrow
    }
  });
}
const stumpMatLimb = new THREE.MeshStandardMaterial({ map: stumpTexture(false), roughness: 0.3, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
const stumpMatNeck = new THREE.MeshStandardMaterial({ map: stumpTexture(true), roughness: 0.3, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
function stumpCap(r, neck) {
  const g = new THREE.CircleGeometry(r, 18);
  const p = g.attributes.position;
  for (let i = 1; i < p.count; i++) { const k = 0.9 + hash2(i, 7) * 0.2; p.setXY(i, p.getX(i) * k, p.getY(i) * k); }
  return new THREE.Mesh(g, neck ? stumpMatNeck : stumpMatLimb);
}

// organs: shapes, sizes and colors of real anatomy
const wet = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.26, metalness: 0.02 });
const ORGAN_MATS = {
  heart: wet(0x6e1212), lung: wet(0xb86a72), liver: wet(0x4a0e10), stomach: wet(0xbf7f72), gut: wet(0xd29a88), kidney: wet(0x5e1616), rib: wet(0xece2cf), flesh: wet(0x7e0e0e),
};
function lumpy(geo, amt, seed) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 1 + (vnoise(x * 30 + seed, z * 30 + y * 17) * amt);
    p.setXYZ(i, x * n, y * n, z * n);
  }
  geo.computeVertexNormals(); return geo;
}
function organGeo(kind) {
  switch (kind) {
    case 'heart': { const g = new THREE.SphereGeometry(0.055, 16, 12); g.scale(1, 1.25, 0.9); const p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setX(i, p.getX(i) * (1 + p.getY(i) * 6)); return lumpy(g, 0.08, 1); }
    case 'lung': { const g = new THREE.SphereGeometry(0.07, 16, 12); g.scale(0.8, 1.6, 0.9); return lumpy(g, 0.1, 2); }
    case 'liver': { const g = new THREE.SphereGeometry(0.09, 16, 10); g.scale(1.5, 0.55, 0.9); return lumpy(g, 0.06, 3); }
    case 'stomach': { const g = new THREE.SphereGeometry(0.06, 14, 10); g.scale(1.4, 0.9, 0.8); return lumpy(g, 0.08, 4); }
    case 'kidney': { const g = new THREE.SphereGeometry(0.035, 12, 8); g.scale(0.8, 1.3, 0.6); return lumpy(g, 0.1, 5); }
    case 'gut': {
      const r = mulberry32(Math.floor(Math.random() * 1e6)), pts = [];
      let x = 0, y = 0, z = 0;
      for (let i = 0; i < 22; i++) { x += (r() - 0.5) * 0.12; z += (r() - 0.5) * 0.12; y = Math.sin(i * 0.9) * 0.015 + 0.02; pts.push(new THREE.Vector3(x, y, z)); }
      const curve = new THREE.CatmullRomCurve3(pts);
      return new THREE.TubeGeometry(curve, 90, 0.022, 8, false);
    }
  }
}
// an open torso wound: torn flesh with ribs showing through
function torsoGash() {
  const g = new THREE.Group();
  const flesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10).scale(1, 0.55, 0.25), ORGAN_MATS.flesh);
  g.add(flesh);
  for (let i = 0; i < 3; i++) {
    const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.17, 6), ORGAN_MATS.rib);
    rib.rotation.z = Math.PI / 2 + (i - 1) * 0.12; rib.position.set(0, (i - 1) * 0.03, 0.012);
    g.add(rib);
  }
  const bulge = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.045, 10, 8), 0.15, 9), ORGAN_MATS.gut);
  bulge.position.set(0.02, -0.02, 0.015); g.add(bulge);
  return g;
}
