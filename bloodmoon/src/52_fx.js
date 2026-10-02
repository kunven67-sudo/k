// =====================================================================
// FX — blood, sparks, embers, smoke and splashes (particles), blood
// pools on the ground (decals), flying gore and cut-off limbs, and
// everything that flies: arrows, fireballs, spit and blood bolts.
// =====================================================================
const PART_VS = `attribute float size; attribute vec4 rgba; varying vec4 vC; uniform float scale;
void main(){ vC = rgba; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`;
const PART_FS = `varying vec4 vC; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vC.rgb, vC.a * smoothstep(0.5, 0.15, d)); }`;
function makeParticles(max, additive) {
  const P = { max, n: 0, x: new Float32Array(max * 3), v: new Float32Array(max * 3), life: new Float32Array(max), age: new Float32Array(max), size: new Float32Array(max), size1: new Float32Array(max), col: new Float32Array(max * 4), grav: new Float32Array(max), drag: new Float32Array(max), flags: new Uint8Array(max) };
  const g = new THREE.BufferGeometry();
  P.aPos = new THREE.BufferAttribute(new Float32Array(max * 3), 3); P.aSize = new THREE.BufferAttribute(new Float32Array(max), 1); P.aCol = new THREE.BufferAttribute(new Float32Array(max * 4), 4);
  for (const a of [P.aPos, P.aSize, P.aCol]) a.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', P.aPos); g.setAttribute('size', P.aSize); g.setAttribute('rgba', P.aCol);
  P.mat = new THREE.ShaderMaterial({ uniforms: { scale: { value: 400 } }, vertexShader: PART_VS, fragmentShader: PART_FS, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  P.mesh = new THREE.Points(g, P.mat); P.mesh.frustumCulled = false; P.mesh.renderOrder = 5; scene.add(P.mesh);
  return P;
}
// flags: 1 = leaves a blood pool where it lands
function emit(P, x, y, z, vx, vy, vz, life, size, size1, r, g, b, a, grav = 0, drag = 0, flags = 0) {
  let i = P.n < P.max ? P.n++ : Math.floor(Math.random() * P.max);
  P.x[i * 3] = x; P.x[i * 3 + 1] = y; P.x[i * 3 + 2] = z; P.v[i * 3] = vx; P.v[i * 3 + 1] = vy; P.v[i * 3 + 2] = vz;
  P.life[i] = life; P.age[i] = 0; P.size[i] = size; P.size1[i] = size1; P.col[i * 4] = r; P.col[i * 4 + 1] = g; P.col[i * 4 + 2] = b; P.col[i * 4 + 3] = a; P.grav[i] = grav; P.drag[i] = drag; P.flags[i] = flags;
}
function updateParticles(P, dt) {
  const X = P.x, V = P.v, ap = P.aPos.array, as = P.aSize.array, ac = P.aCol.array;
  for (let i = 0; i < P.n; i++) {
    P.age[i] += dt;
    if (P.age[i] >= P.life[i]) { // swap with the last one
      const j = --P.n; if (i !== j) { for (let k = 0; k < 3; k++) { X[i * 3 + k] = X[j * 3 + k]; V[i * 3 + k] = V[j * 3 + k]; } for (let k = 0; k < 4; k++) P.col[i * 4 + k] = P.col[j * 4 + k]; P.life[i] = P.life[j]; P.age[i] = P.age[j]; P.size[i] = P.size[j]; P.size1[i] = P.size1[j]; P.grav[i] = P.grav[j]; P.drag[i] = P.drag[j]; P.flags[i] = P.flags[j]; }
      i--; continue;
    }
    const k = i * 3, dr = Math.max(0, 1 - P.drag[i] * dt);
    V[k] *= dr; V[k + 1] = V[k + 1] * dr - P.grav[i] * dt; V[k + 2] *= dr;
    X[k] += V[k] * dt; X[k + 1] += V[k + 1] * dt; X[k + 2] += V[k + 2] * dt;
    if (P.grav[i] > 0) { const gy = floorAt(X[k], X[k + 2], X[k + 1] + 0.5); if (X[k + 1] < gy) { X[k + 1] = gy + 0.02; if (P.flags[i] & 1) { P.flags[i] = 0; if (chance(0.35)) Gore.decal(X[k], gy, X[k + 2], rand(0.15, 0.4)); } V[k] *= 0.2; V[k + 1] = 0; V[k + 2] *= 0.2; if (!(P.flags[i] & 2)) P.age[i] = Math.max(P.age[i], P.life[i] - 0.25); } }
    const t = P.age[i] / P.life[i];
    ap[k] = X[k]; ap[k + 1] = X[k + 1]; ap[k + 2] = X[k + 2]; as[i] = lerp(P.size[i], P.size1[i], t);
    ac[i * 4] = P.col[i * 4]; ac[i * 4 + 1] = P.col[i * 4 + 1]; ac[i * 4 + 2] = P.col[i * 4 + 2]; ac[i * 4 + 3] = P.col[i * 4 + 3] * (1 - t * t);
  }
  P.aPos.needsUpdate = P.aSize.needsUpdate = P.aCol.needsUpdate = true; P.mesh.geometry.setDrawRange(0, P.n);
  P.mat.uniforms.scale.value = renderer.domElement.height * 0.9;
}
// ---------- gore ----------
const Gore = {
  soft: null, glow: null, decals: null, decalI: 0, chunks: [], limbs: [], fountains: [],
  init() {
    this.soft = makeParticles(SET.quality === 'low' ? 900 : 2200, false); this.glow = makeParticles(SET.quality === 'low' ? 600 : 1400, true);
    const n = SET.quality === 'low' ? 60 : 160, g = new THREE.CircleGeometry(1, 14); g.rotateX(-Math.PI / 2);
    // splat shape: wobble the edge
    const p = g.attributes.position; for (let i = 1; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), r = 0.75 + 0.25 * Math.sin(a * 5) * Math.cos(a * 3 + 1); p.setX(i, x * r); p.setZ(i, z * r); }
    this.decals = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0x3a0404, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.88, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), n);
    this.decals.count = 0; this.decals.max = n; this.decals.frustumCulled = false; this.decals.renderOrder = 2; this.decals.receiveShadow = true; scene.add(this.decals);
    this.chunkGeo = new THREE.DodecahedronGeometry(0.07, 0); this.chunkMat = new THREE.MeshStandardMaterial({ color: 0x6a0a0a, roughness: 0.4 });
    this.stumpMat = new THREE.MeshStandardMaterial({ color: 0x7a0808, roughness: 0.35 });
  },
  on() { return SET.gore; },
  // a burst of blood from a wound, sprayed along (dx, dy, dz)
  blood(x, y, z, dx = 0, dy = 0.3, dz = 0, n = 14, power = 1, dark) {
    if (!this.soft) return; const g = this.on() ? 1 : 0.25;
    for (let i = 0; i < n * g; i++) {
      const s = rand(1.5, 5) * power, sh = rand(0.4, 0.9);
      emit(this.soft, x, y, z, dx * s + rand(-1.5, 1.5), dy * s + rand(0, 2.5), dz * s + rand(-1.5, 1.5), rand(0.5, 1.1), rand(0.05, 0.12) * (this.on() ? 1 : 0.6), rand(0.03, 0.07), dark ? 0.15 : sh * 0.55, 0.02, 0.02, 0.95, 9.8, 0.6, this.on() ? 1 : 0);
    }
    if (this.on() && power > 0.8) for (let i = 0; i < 5; i++) emit(this.soft, x, y, z, rand(-0.6, 0.6), rand(-0.2, 0.6), rand(-0.6, 0.6), rand(0.4, 0.7), 0.25, 0.6, 0.45, 0.03, 0.03, 0.5, 1, 3); // mist
  },
  ichor(x, y, z, col, n = 10) { const c = new THREE.Color(col); for (let i = 0; i < n; i++) emit(this.soft, x, y, z, rand(-2.5, 2.5), rand(0.5, 4), rand(-2.5, 2.5), rand(0.4, 0.9), rand(0.06, 0.1), 0.04, c.r, c.g, c.b, 0.9, 9.8, 0.5); },
  sparks(x, y, z, n = 10, col = [1, 0.75, 0.3]) { if (!this.glow) return; for (let i = 0; i < n; i++) emit(this.glow, x, y, z, rand(-4, 4), rand(0, 5), rand(-4, 4), rand(0.15, 0.4), 0.06, 0.02, col[0], col[1], col[2], 1, 12, 0.5); },
  ember(x, y, z) { if (!this.glow) return; emit(this.glow, x + rand(-0.2, 0.2), y, z + rand(-0.2, 0.2), rand(-0.3, 0.3), rand(1, 2.5), rand(-0.3, 0.3), rand(0.4, 1), 0.14, 0.02, 1, rand(0.35, 0.6), 0.1, 1, -0.5, 0.8); },
  flame(x, y, z, s = 1) { if (!this.glow) return; emit(this.glow, x + rand(-0.3, 0.3) * s, y, z + rand(-0.3, 0.3) * s, rand(-0.4, 0.4), rand(1.5, 3) * s, rand(-0.4, 0.4), rand(0.25, 0.5), 0.5 * s, 0.1, 1, rand(0.3, 0.55), 0.08, 0.7, -1, 1); },
  smoke(x, y, z, n = 10, col = 0.25) { if (!this.soft) return; for (let i = 0; i < n; i++) emit(this.soft, x + rand(-0.4, 0.4), y + rand(-0.4, 0.6), z + rand(-0.4, 0.4), rand(-0.6, 0.6), rand(0.4, 1.4), rand(-0.6, 0.6), rand(1, 2), 0.5, 1.6, col, col, col * 1.05, 0.5, -0.1, 0.8); },
  dust(x, y, z, n = 6) { if (!this.soft) return; for (let i = 0; i < n; i++) emit(this.soft, x + rand(-0.3, 0.3), y + 0.1, z + rand(-0.3, 0.3), rand(-1, 1), rand(0.2, 0.8), rand(-1, 1), rand(0.5, 1), 0.25, 0.8, 0.45, 0.4, 0.33, 0.35, 0, 1.5); },
  splash(x, y, z, n = 16, s = 1) { if (!this.soft) return; for (let i = 0; i < n; i++) emit(this.soft, x, y, z, rand(-2, 2) * s, rand(2, 5) * s, rand(-2, 2) * s, rand(0.4, 0.8), 0.12, 0.05, 0.75, 0.82, 0.88, 0.7, 9.8, 0.2); },
  magic(x, y, z, col, n = 12, sp = 3) { if (!this.glow) return; const c = new THREE.Color(col); for (let i = 0; i < n; i++) emit(this.glow, x, y, z, rand(-sp, sp), rand(-sp, sp), rand(-sp, sp), rand(0.2, 0.6), 0.22, 0.02, c.r, c.g, c.b, 1, 0, 2); },
  ring(x, y, z, r, col) { // a shockwave of dust on the ground
    const c = new THREE.Color(col); for (let i = 0; i < 40; i++) { const a = (i / 40) * TAU; emit(this.soft, x + Math.cos(a) * 0.6, y + 0.2, z + Math.sin(a) * 0.6, Math.cos(a) * r * 2.2, rand(0.3, 1.2), Math.sin(a) * r * 2.2, rand(0.5, 0.8), 0.5, 1.2, c.r * 0.6, c.g * 0.6, c.b * 0.6, 0.55, 0, 3); }
  },
  decal(x, y, z, r) {
    if (!this.decals || !this.on()) return; const D = this.decals, i = this.decalI++ % D.max;
    D.setMatrixAt(i, M4(x, y + 0.03 + (i % 7) * 0.002, z, rand(0, TAU), r, 1, r * rand(0.7, 1.2))); D.count = Math.max(D.count, i + 1); D.instanceMatrix.needsUpdate = true;
  },
  clearDecals() { if (this.decals) this.decals.count = 0; this.decalI = 0; },
  // little flying pieces
  chunk(x, y, z, n = 5) {
    if (!this.on()) return;
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(this.chunkGeo, this.chunkMat); m.position.set(x, y, z); m.scale.setScalar(rand(0.6, 1.6)); m.castShadow = true; scene.add(m); this.chunks.push({ m, vx: rand(-4, 4), vy: rand(2, 6), vz: rand(-4, 4), t: 0 }); }
    while (this.chunks.length > 50) { const c = this.chunks.shift(); scene.remove(c.m); }
  },
  // cut a limb off an actor's model and throw it
  dismember(a, which, dir) {
    if (!this.on() || !a.rig) return false; const rig = a.rig, j = rig[which]; if (!j || !j.parent || j.userData.cut) return false;
    j.updateWorldMatrix(true, true); const wm = j.matrixWorld.clone(), stump = new THREE.Vector3().setFromMatrixPosition(wm);
    j.userData.cut = true; j.parent.remove(j);
    const piece = new THREE.Group(); piece.add(j); j.position.set(0, 0, 0); j.rotation.set(0, 0, 0); j.scale.set(1, 1, 1);
    wm.decompose(piece.position, piece.quaternion, piece.scale); scene.add(piece);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.06 * (a.d ? a.d.size : 1), 8, 6), this.stumpMat); j.add(cap);
    const s = which === 'head' ? 1.4 : 1; const [dx, dz] = dir || [rand(-1, 1), rand(-1, 1)];
    this.limbs.push({ m: piece, vx: dx * 3 * s + rand(-1, 1), vy: rand(3, 6) * s, vz: dz * 3 * s + rand(-1, 1), ax: rand(-8, 8), az: rand(-8, 8), t: 0, rest: false });
    while (this.limbs.length > 24) { const L = this.limbs.shift(); scene.remove(L.m); }
    // blood fountain from the stump for a moment
    this.fountains.push({ a, j: which, x: stump.x, y: stump.y, z: stump.z, t: 1.4 });
    this.blood(stump.x, stump.y, stump.z, dx, 0.6, dz, 30, 1.4);
    Sfx.play('dismember', { x: stump.x, y: stump.y, z: stump.z });
    a.cut = a.cut || {}; a.cut[which] = true;
    return true;
  },
  update(dt) {
    if (!this.soft) return;
    updateParticles(this.soft, dt); updateParticles(this.glow, dt);
    for (let i = this.chunks.length - 1; i >= 0; i--) { const c = this.chunks[i]; c.t += dt; if (c.t > 25) { scene.remove(c.m); this.chunks.splice(i, 1); continue; } if (c.rest) continue; c.vy -= 14 * dt; c.m.position.x += c.vx * dt; c.m.position.y += c.vy * dt; c.m.position.z += c.vz * dt; c.m.rotation.x += c.vx * dt * 3; const gy = floorAt(c.m.position.x, c.m.position.z, c.m.position.y + 0.5); if (c.m.position.y < gy + 0.04) { c.m.position.y = gy + 0.04; c.vy *= -0.25; c.vx *= 0.5; c.vz *= 0.5; if (Math.abs(c.vy) < 0.6) c.rest = true; if (chance(0.3)) this.decal(c.m.position.x, gy, c.m.position.z, 0.15); } }
    for (let i = this.limbs.length - 1; i >= 0; i--) {
      const L = this.limbs[i]; L.t += dt; if (L.t > 120) { scene.remove(L.m); this.limbs.splice(i, 1); continue; } if (L.rest) continue;
      L.vy -= 14 * dt; L.m.position.x += L.vx * dt; L.m.position.y += L.vy * dt; L.m.position.z += L.vz * dt; L.m.rotation.x += L.ax * dt; L.m.rotation.z += L.az * dt;
      if (L.t < 1.5 && chance(0.5)) emit(this.soft, L.m.position.x, L.m.position.y, L.m.position.z, rand(-0.5, 0.5), 0, rand(-0.5, 0.5), 0.6, 0.06, 0.03, 0.45, 0.02, 0.02, 0.9, 9.8, 0.3, 1);
      const gy = floorAt(L.m.position.x, L.m.position.z, L.m.position.y + 0.5); if (L.m.position.y < gy + 0.08) { L.m.position.y = gy + 0.08; L.vy *= -0.2; L.vx *= 0.4; L.vz *= 0.4; L.ax *= 0.5; L.az *= 0.5; if (Math.abs(L.vy) < 0.8) { L.rest = true; this.decal(L.m.position.x, gy, L.m.position.z, rand(0.4, 0.7)); } }
    }
    for (let i = this.fountains.length - 1; i >= 0; i--) {
      const F = this.fountains[i]; F.t -= dt; if (F.t <= 0) { this.fountains.splice(i, 1); continue; }
      const a = F.a; let x = F.x, y = F.y, z = F.z; if (a.rig && a.rig[F.j === 'head' ? 'neck' : F.j === 'shoulderL' || F.j === 'shoulderR' ? 'spine' : 'hips']) { const p = a.rig[F.j === 'head' ? 'neck' : F.j.startsWith('shoulder') ? 'spine' : 'hips']; p.getWorldPosition(_fxV); x = _fxV.x; y = _fxV.y + (F.j === 'head' ? 0.12 : F.j.startsWith('shoulder') ? 0.5 : 0); z = _fxV.z; }
      for (let k = 0; k < 3; k++) emit(this.soft, x, y, z, rand(-0.8, 0.8), rand(2, 4) * F.t, rand(-0.8, 0.8), rand(0.5, 0.9), 0.07, 0.04, 0.5, 0.02, 0.02, 0.95, 9.8, 0.4, 1);
    }
  },
  clearAll() {
    for (const c of this.chunks) scene.remove(c.m); for (const L of this.limbs) scene.remove(L.m); this.chunks = []; this.limbs = []; this.fountains = [];
    if (this.soft) this.soft.n = 0; if (this.glow) this.glow.n = 0; this.clearDecals();
  },
};
const _fxV = new THREE.Vector3();
// ---------- things that fly ----------
const PROJ = [];
const PROJ_LOOK = { blood: [0xff2030, 0.35], demonfire: [0xff5010, 0.45], poison: [0x80d040, 0.3], fire: [0xff7020, 0.4] };
function fireProj(o) {
  // o: { from (actor or 'player'), x,y,z, tx,ty,tz or dir, speed, dmg, kind, grav, item }
  const p = Object.assign({ t: 0, life: 6, grav: 9.8, r: 0.15 }, o);
  let dx, dy, dz; if (o.dir) [dx, dy, dz] = o.dir; else { dx = o.tx - o.x; dy = o.ty - o.y; dz = o.tz - o.z; }
  const l = Math.hypot(dx, dy, dz) || 1; p.vx = (dx / l) * p.speed; p.vy = (dy / l) * p.speed; p.vz = (dz / l) * p.speed;
  if (p.kind === 'arrow') { p.mesh = buildArrow(p.item); p.r = 0.08; }
  else { const L = PROJ_LOOK[p.kind] || PROJ_LOOK.fire; p.mesh = new THREE.Mesh(new THREE.SphereGeometry(L[1] * 0.5, 10, 8), new THREE.MeshBasicMaterial({ color: L[0] })); p.glow = addLightSource({ x: p.x, y: p.y, z: p.z, color: L[0], intensity: 5, range: 10, kind: 'magic', size: L[1] * 4, always: true, area: G.area, parent: scene }); p.col = L[0]; p.r = L[1]; }
  p.mesh.position.set(p.x, p.y, p.z); scene.add(p.mesh); PROJ.push(p); return p;
}
function killProj(p, i) { scene.remove(p.mesh); if (p.glow) { scene.remove(p.glow.glow); const k = WORLD.lights.indexOf(p.glow); if (k >= 0) WORLD.lights.splice(k, 1); } if (!p.stuck) PROJ.splice(i, 1); }
const STUCK = [];
function updateProjs(dt) {
  for (let i = PROJ.length - 1; i >= 0; i--) {
    const p = PROJ[i]; p.t += dt; if (p.t > p.life) { killProj(p, i); continue; }
    const steps = Math.ceil(Math.hypot(p.vx, p.vy, p.vz) * dt / 0.5); let done = false;
    for (let s = 0; s < steps && !done; s++) {
      const h = dt / steps; p.vy -= p.grav * h; p.x += p.vx * h; p.y += p.vy * h; p.z += p.vz * h;
      // hit the ground, a wall or water
      const gy = floorAt(p.x, p.z, p.y + 0.5);
      if (p.y < gy) { done = true; projImpact(p, null, gy); break; }
      if (G.area === 'outside' && p.y < waterLevelAt(p.x, p.z)) { Gore.splash(p.x, waterLevelAt(p.x, p.z), p.z, 8, 0.6); Sfx.play('splash', { x: p.x, y: p.y, z: p.z, vol: 0.4 }); done = true; killProj(p, i); break; }
      const e = { x: p.x, z: p.z }; if (collideCircle(e, 0.05, p.y, 0.05)) { done = true; projImpact(p, null, null, true); break; }
      if (p.from === 'player') {
        for (const a of ACTORS) {
          if (a.dead || a.kind === 'npc' || a.kind === 'horse' || a.indoors) continue; const [cx, cy, cz] = actorCenter(a), hr = a.r + p.r + 0.15, hh = a.h * 0.55;
          if (Math.abs(p.x - cx) > hr + 1 || Math.abs(p.z - cz) > hr + 1) continue;
          if (Math.hypot(p.x - cx, p.z - cz) < hr && Math.abs(p.y - cy) < hh) { done = true; projImpact(p, a); break; }
        }
      } else if (G.p && !G.p.dead) {
        const P = G.p; if (Math.hypot(p.x - P.x, p.z - P.z) < 0.5 + p.r && p.y > P.y - 0.2 && p.y < P.y + 1.9) { done = true; projImpact(p, 'player'); }
      }
    }
    if (done) continue;
    p.mesh.position.set(p.x, p.y, p.z);
    if (p.kind === 'arrow') { p.mesh.lookAt(p.x + p.vx, p.y + p.vy, p.z + p.vz); if (p.item === 'fire_arrow' && chance(0.6)) Gore.ember(p.x, p.y, p.z); }
    else { if (p.glow) { p.glow.x = p.x; p.glow.y = p.y; p.glow.z = p.z; p.glow.glow.position.set(p.x, p.y, p.z); } for (let k = 0; k < 2; k++) emit(Gore.glow, p.x, p.y, p.z, rand(-0.5, 0.5), rand(-0.5, 0.5), rand(-0.5, 0.5), 0.35, p.r * 1.6, 0.05, ...(new THREE.Color(p.col)).toArray(), 1, 0, 1); }
  }
  for (let i = STUCK.length - 1; i >= 0; i--) { const s = STUCK[i]; s.t += dt; if (s.t > 40) { s.m.parent && s.m.parent.remove(s.m); STUCK.splice(i, 1); } }
}
function stickArrow(p, parent) { // leave the arrow where it hit
  const m = p.mesh; if (parent) { parent.updateWorldMatrix(true, false); const inv = parent.matrixWorld.clone().invert(); m.applyMatrix4(inv); parent.add(m); }
  p.stuck = true; STUCK.push({ m, t: 0 }); while (STUCK.length > 40) { const s = STUCK.shift(); s.m.parent && s.m.parent.remove(s.m); }
}
function projImpact(p, target, gy, wall) {
  const i = PROJ.indexOf(p); if (i >= 0) PROJ.splice(i, 1);
  if (p.kind === 'arrow') {
    if (target && target !== 'player') { const [cx, cy, cz] = actorCenter(target), head = p.y > target.y + target.h * 0.8 + (target.fly ? target.alt || 0 : 0); playerArrowHit(target, p, head); if (target.rig) stickArrow(p, target.rig.spine || target.rig.body || target.rig.root); else scene.remove(p.mesh); }
    else { Sfx.play(wall ? 'arrow_wood' : 'arrow_hit', { x: p.x, y: p.y, z: p.z, vol: 0.6 }); if (gy != null) { p.mesh.position.set(p.x, gy + 0.15, p.z); Gore.dust(p.x, gy, p.z, 3); } stickArrow(p); if (p.item === 'fire_arrow') Gore.smoke(p.x, p.y, p.z, 3); }
    return;
  }
  // magic and monster spit burst where they land
  killProjAfter(p); const x = p.x, y = gy != null ? gy + 0.3 : p.y, z = p.z;
  if (p.kind === 'fire') { playerFireball(x, y, z, p); return; }
  Gore.magic(x, y, z, p.col, 14, 4);
  if (target === 'player') hurtPlayer(p.dmg, p.from, { burn: p.kind === 'demonfire', poison: p.kind === 'poison', proj: true, x, z });
  else if (p.from !== 'player' && G.p && Math.hypot(G.p.x - x, G.p.z - z) < (p.kind === 'demonfire' ? 1.6 : 1.1) && Math.abs(G.p.y - y) < 2) hurtPlayer(p.dmg * 0.6, p.from, { burn: p.kind === 'demonfire', poison: p.kind === 'poison', proj: true, x, z });
  Sfx.play(p.kind === 'poison' ? 'splash' : 'fire_cast', { x, y, z, vol: 0.5 });
}
function killProjAfter(p) { scene.remove(p.mesh); if (p.glow) { scene.remove(p.glow.glow); const k = WORLD.lights.indexOf(p.glow); if (k >= 0) WORLD.lights.splice(k, 1); } }
function clearProjs() { for (const p of PROJ.slice()) killProjAfter(p); PROJ.length = 0; for (const s of STUCK) s.m.parent && s.m.parent.remove(s.m); STUCK.length = 0; }
