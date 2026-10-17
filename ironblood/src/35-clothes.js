
// ---------- medieval clothes, built onto the soldier skeleton like the armor ----------
// real fabric scans (Poly Haven, CC0): linen, wool, leather
const FABRIC = {};
function fabrics() {
  if (FABRIC.linen) return FABRIC;
  const mk = (n, rep, diff = 'diff') => { const m = { map: tex(n, diff), normalMap: tex(n, 'nor_gl', false), roughnessMap: tex(n, 'rough', false) }; for (const k in m) m[k].repeat.set(rep, rep); return m; };
  FABRIC.linen = mk('rough_linen', 3);
  FABRIC.wool = mk('poly_wool_herringbone', 3);
  FABRIC.boucle = mk('wool_boucle', 3);
  FABRIC.leather = mk('brown_leather', 2, 'albedo');
  return FABRIC;
}
function clothPBR(kind, color, U) {
  const f = fabrics()[kind];
  // the weave comes from the normal + roughness scans; the color is the real dye (scan colors tint everything grey-blue)
  return addBlood(new THREE.MeshStandardMaterial({ color, map: kind === 'leather' ? f.map : null, normalMap: f.normalMap, normalScale: new THREE.Vector2(1.4, 1.4), roughnessMap: f.roughnessMap, roughness: 1, metalness: 0, side: THREE.DoubleSide }), U);
}
// ---------- real faces (MakeHuman CC0 heads, skin painted per person) ----------
const FACES = {};
let facesReady = false;
function loadFaces(L, done) {
  loadGLB(L, ASSET_BASE + 'faces.glb', (gltf) => {
    for (const g of gltf.scene.children[0] ? (gltf.scene.children[0].name === 'faces' ? gltf.scene.children[0].children : gltf.scene.children) : []) {
      g.traverse(o => { if (o.isMesh) { o.castShadow = true; const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { m.envMapIntensity = 0.6; if (m.name.endsWith('_skin')) { m.roughness = 0.58; } } } });
      FACES[g.name] = g;
    }
    facesReady = true; done && done();
  }, (e) => { console.warn('faces failed', e); facesReady = true; done && done(); });
}
// the soldier's face sits here (mesh space, cm): eyes between the visor and the skull
const EYE_SPOT = new THREE.Vector3(0, 4.2, 168.2);
function attachFace(model, id, U) {
  const src = FACES[id]; if (!src) return null;
  let body = null; model.traverse(m => { if (m.isSkinnedMesh && !m.name.includes('visor')) body = m; });
  model.updateMatrixWorld(true);
  const g = src.clone(true);
  g.traverse(o => { if (o.isMesh) { o.userData.armor = true; o.userData.face = true; if (U && !Array.isArray(o.material) && o.material.name.endsWith('_skin')) { o.material = o.material.clone(); addBlood(o.material, U); } } });
  g.position.copy(EYE_SPOT).applyMatrix4(body.matrixWorld);
  g.rotation.set(0, Math.PI, 0);
  scene.add(g); g.updateMatrixWorld(true);
  bone(model, 'Head').attach(g);
  return g;
}
// ---------- skinned clothes ----------
// The soldier mesh wears army gear. Smoothing it (Taubin) melts the pouches and pads into a plain body shape,
// then it's puffed out a little and painted by body region: top, legs, boots, hands.
let clothBase = null;
function clothBaseFrom(mesh) {
  if (clothBase) return clothBase;
  const g = mesh.geometry, pos = g.attributes.position, n = pos.count, idx = g.index.array;
  const bones = mesh.skeleton.bones.map(b => b.name.replace('mixamorig', ''));
  const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  // weld vertices split at UV seams so smoothing doesn't tear the mesh
  const key = new Map(), weld = new Int32Array(n), wp = [];
  for (let i = 0; i < n; i++) { const k = Math.round(pos.getX(i) * 10) + ',' + Math.round(pos.getY(i) * 10) + ',' + Math.round(pos.getZ(i) * 10); let w = key.get(k); if (w === undefined) { w = wp.length / 3; key.set(k, w); wp.push(pos.getX(i), pos.getY(i), pos.getZ(i)); } weld[i] = w; }
  const W = wp.length / 3, P = new Float32Array(wp);
  const nb = Array.from({ length: W }, () => new Set());
  for (let t = 0; t < idx.length; t += 3) { const a = weld[idx[t]], b = weld[idx[t + 1]], c = weld[idx[t + 2]]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); }
  // region per vertex from its strongest bone
  const region = new Uint8Array(n); // 0 top, 1 legs, 2 boots, 3 hands, 4 head
  const wRegion = new Uint8Array(W);
  for (let i = 0; i < n; i++) {
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
    const bn = bones[best] || '', z = pos.getZ(i);
    let r = 0;
    if (/Hand/.test(bn)) r = 3; else if (/Head|Neck/.test(bn)) r = 4;
    else if (/Foot|Toe/.test(bn) || (/Leg/.test(bn) && z < 40)) r = 2;
    else if (/UpLeg|Leg/.test(bn)) r = 1;
    region[i] = r; wRegion[weld[i]] = r;
  }
  // pull pouches, pads and straps in: each vertex may sit only so far from its bone (cm)
  // bone positions in the mesh's own space (the model is still in its rest pose here)
  mesh.updateWorldMatrix(true, true);
  const toMesh = mesh.matrixWorld.clone().invert();
  const bp = mesh.skeleton.bones.map(b => b.getWorldPosition(new THREE.Vector3()).applyMatrix4(toMesh));
  const bi = (nm) => bones.indexOf(nm);
  const LIMB = { LeftArm: ['LeftForeArm', 6.0], RightArm: ['RightForeArm', 6.0], LeftForeArm: ['LeftHand', 4.8], RightForeArm: ['RightHand', 4.8], LeftShoulder: ['LeftArm', 7.0], RightShoulder: ['RightArm', 7.0],
    LeftUpLeg: ['LeftLeg', 8.2], RightUpLeg: ['RightLeg', 8.2], LeftLeg: ['LeftFoot', 6.0], RightLeg: ['RightFoot', 6.0] };
  const TORSO = { Hips: [16.5, 11.5], Spine: [15.5, 11], Spine1: [16, 11.5], Spine2: [17.5, 12] };
  const seg = (p, a, b) => { const ab = _sa.copy(b).sub(a), t = Math.max(0, Math.min(1, _sb.copy(p).sub(a).dot(ab) / ab.lengthSq())); return _sc.copy(a).addScaledVector(ab, t); };
  const _sa = new THREE.Vector3(), _sb = new THREE.Vector3(), _sc = new THREE.Vector3(), pv = new THREE.Vector3();
  const domBone = new Int32Array(W).fill(-1);
  for (let i = 0; i < n; i++) { let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } } domBone[weld[i]] = best; }
  for (let v = 0; v < W; v++) {
    const nm = bones[domBone[v]]; if (!nm) continue;
    pv.set(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
    if (LIMB[nm]) {
      const [child, R] = LIMB[nm], a = bp[domBone[v]], b = bp[bi(child)]; if (!b) continue;
      if (/Leg$/.test(nm) && !/Up/.test(nm) && pv.z < 40) continue; // boots keep their shape
      const c = seg(pv, a, b), d = pv.distanceTo(c);
      if (d > R) { const k = (R + (d - R) * 0.12) / d; pv.sub(c).multiplyScalar(k).add(c); }
    } else if (TORSO[nm]) {
      const [rx, ry] = TORSO[nm], c = bp[domBone[v]];
      const dx = pv.x - c.x, dy = pv.y - c.y, e = Math.hypot(dx / rx, dy / ry);
      if (e > 1) { const k = (1 + (e - 1) * 0.12) / e; pv.x = c.x + dx * k; pv.y = c.y + dy * k; }
    } else continue;
    P[v * 3] = pv.x; P[v * 3 + 1] = pv.y; P[v * 3 + 2] = pv.z;
  }
  // Taubin smoothing on the body (not hands or face): shrink-free blur of the gear
  const tmp = new Float32Array(W * 3);
  for (let it = 0; it < 24; it++) {
    const lam = it % 2 ? -0.53 : 0.5;
    for (let v = 0; v < W; v++) {
      if (wRegion[v] >= 3 || nb[v].size === 0) { tmp[v * 3] = P[v * 3]; tmp[v * 3 + 1] = P[v * 3 + 1]; tmp[v * 3 + 2] = P[v * 3 + 2]; continue; }
      let x = 0, y = 0, z = 0; for (const u of nb[v]) { x += P[u * 3]; y += P[u * 3 + 1]; z += P[u * 3 + 2]; }
      const c = nb[v].size;
      tmp[v * 3] = P[v * 3] + lam * (x / c - P[v * 3]); tmp[v * 3 + 1] = P[v * 3 + 1] + lam * (y / c - P[v * 3 + 1]); tmp[v * 3 + 2] = P[v * 3 + 2] + lam * (z / c - P[v * 3 + 2]);
    }
    P.set(tmp);
  }
  // smooth normals on the welded shape, then puff the cloth out a little (units are cm here)
  const N = new Float32Array(W * 3);
  for (let t = 0; t < idx.length; t += 3) {
    const a = weld[idx[t]], b = weld[idx[t + 1]], c = weld[idx[t + 2]];
    const ax = P[b * 3] - P[a * 3], ay = P[b * 3 + 1] - P[a * 3 + 1], az = P[b * 3 + 2] - P[a * 3 + 2];
    const bx = P[c * 3] - P[a * 3], by = P[c * 3 + 1] - P[a * 3 + 1], bz = P[c * 3 + 2] - P[a * 3 + 2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    for (const v of [a, b, c]) { N[v * 3] += nx; N[v * 3 + 1] += ny; N[v * 3 + 2] += nz; }
  }
  const outP = new Float32Array(n * 3), outN = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = weld[i]; let nx = N[v * 3], ny = N[v * 3 + 1], nz = N[v * 3 + 2]; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const puff = region[i] === 3 ? 0 : region[i] === 4 ? 0.3 : region[i] === 2 ? 0.9 : 0.7;
    outP[i * 3] = P[v * 3] + nx * puff; outP[i * 3 + 1] = P[v * 3 + 1] + ny * puff; outP[i * 3 + 2] = P[v * 3 + 2] + nz * puff;
    outN[i * 3] = nx; outN[i * 3 + 1] = ny; outN[i * 3 + 2] = nz;
  }
  // triangles sorted into material groups: cloth (top + legs), boots, hands; the head is under the hood
  const groups = [[], [], []];
  for (let t = 0; t < idx.length; t += 3) {
    const r = Math.max(region[idx[t]], region[idx[t + 1]], region[idx[t + 2]]);
    if (r === 4) continue;
    groups[r <= 1 ? 0 : r === 2 ? 1 : 2].push(idx[t], idx[t + 1], idx[t + 2]);
  }
  const index = [], gr = [];
  for (let k = 0; k < 3; k++) { gr.push([index.length, groups[k].length]); index.push(...groups[k]); }
  clothBase = { outP, outN, region, index, gr, uv: g.attributes.uv, si, sw };
  return clothBase;
}
function skinnedClothes(model, o, [top, legs, boots, skinM], U) {
  let body = null;
  model.traverse(m => { if (m.isSkinnedMesh && !m.name.includes('visor')) body = m; });
  if (!body) return;
  const B = clothBaseFrom(body);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(B.outP, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(B.outN, 3));
  g.setAttribute('uv', B.uv); g.setAttribute('skinIndex', B.si); g.setAttribute('skinWeight', B.sw);
  // top and leg colors ride in vertex colors so both share one cloth material
  const ct = new THREE.Color(o.top), cl = new THREE.Color(o.legs || 0x4a3c30), col = new Float32Array(B.region.length * 3);
  const dress = o.dress ?? o.sex === 'f';
  for (let i = 0; i < B.region.length; i++) { const c = B.region[i] === 1 && !dress ? cl : ct; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(B.index);
  for (let k = 0; k < 3; k++) g.addGroup(B.gr[k][0], B.gr[k][1], k);
  g.boundingSphere = body.geometry.boundingSphere; g.boundingBox = body.geometry.boundingBox;
  const cloth = top.clone(); cloth.vertexColors = true; cloth.color.set(0xffffff); cloth.side = THREE.FrontSide; addBlood(cloth, U);
  const mesh = new THREE.SkinnedMesh(g, [cloth, boots, skinM]);
  mesh.bind(body.skeleton, body.bindMatrix);
  mesh.castShadow = true; mesh.frustumCulled = false;
  body.parent.add(mesh);
  body.visible = false;
}
// outfit: { sex: 'm'|'f', dress, top, topKind, legs, boots, hood (bool), hoodColor, hoodKind, apron, cloak, veil, belt }
function buildClothes(model, o) {
  const U = { uBlood: { value: 0 } };
  const top = clothPBR(o.topKind || 'linen', o.top, U), legs = clothPBR('wool', o.legs || 0x4a3c30, U);
  const boots = clothPBR('leather', o.boots || 0x3a2a1e, U), hoodM = clothPBR(o.hoodKind || 'wool', o.hoodColor || o.top, U);
  const leather = clothPBR('leather', 0x5a3e28, U);
  const shadow = new THREE.MeshBasicMaterial({ color: 0x050403, side: THREE.DoubleSide });
  hoodM.envMapIntensity = 0.55;
  const parts = [];
  model.updateMatrixWorld(true);
  // pieces on the same bone with the same cloth become one mesh (fewer draw calls)
  const acc = new Map();
  const put = (boneName, geos, mat) => {
    const key = boneName + '|' + mat.uuid;
    if (!acc.has(key)) acc.set(key, { boneName, mat, geos: [] });
    for (const g of Array.isArray(geos) ? geos : [geos]) acc.get(key).geos.push(g.index ? g.toNonIndexed() : g);
  };
  const f = o.sex === 'f', dress = o.dress ?? f;
  const face = o.face ? attachFace(model, o.face, U) : null;
  // the body itself becomes the clothes: shirt/tunic, hose, boots, bare hands (bends exactly with the body)
  const skin = clothPBR('leather', 0x9a7462, U); skin.map = null; skin.normalMap = null; skin.roughness = 0.75; skin.color.set(o.skin || 0x9a7462);
  skinnedClothes(model, o, [top, legs, boots, skin], U);
  if (dress) {
    // long dress skirt from the waist to the ankles
    put('Hips', lathe([[0.17, 1.08], [0.2, 0.95], [0.25, 0.7], [0.31, 0.4], [0.36, 0.12], [0.38, 0.03]], 0, 0.03, 1, 0.85, 28), top);
  } else {
    // tunic skirt to mid-thigh
    put('Hips', lathe([[0.165, 1.06], [0.19, 0.92], [0.215, 0.72], [0.22, 0.66]], 0, 0.03, 1, 0.82, 24), top);
  }
  if (o.belt !== false) put('Hips', lathe([[0.0, 1.05], [0.18, 1.05], [0.18, 1.09], [0.0, 1.09]], 0, 0.03, 1, 0.82), leather);
  if (o.apron) {
    // unbleached linen apron curving round the front of the skirt
    const ap = new THREE.CylinderGeometry(0.19, 0.29, 0.5, 14, 2, true, Math.PI - 0.95, 1.9);
    ap.scale(1, 1, 0.88); ap.translate(0, 0.8, 0.03);
    put('Hips', ap, clothPBR('linen', 0xb9ad94, U));
  }
  // the hood: a deep wool cowl with the face in shadow, mantle over the shoulders
  if (o.hood) {
    // a deep wool cowl open at the front so the face shows, mantle over the shoulders
    const hood = new THREE.SphereGeometry(0.165, 24, 14, -0.62, Math.PI + 1.24, 0, Math.PI * 0.7);
    hood.scale(1, 1.15, 1.12); hood.translate(0, 1.71, 0.035);
    put('Head', hood, hoodM);
    put('Spine2', cylBetween([0, 1.36, 0.05], [0, 1.56, 0.05], 0.29, 0.13, 22, true), hoodM);
  }
  if (o.veil) {
    // wimple + veil: linen fitted round the head and neck, face in its shadow, the veil falling down the back
    const w = new THREE.SphereGeometry(0.132, 24, 14, -0.55, Math.PI + 1.1, 0, Math.PI * 0.74);
    w.scale(1, 1.12, 1.08); w.translate(0, 1.712, 0.03);
    put('Head', w, hoodM);
    put('Neck', cylBetween([0, 1.47, 0.03], [0, 1.63, 0.025], 0.1, 0.078, 18), hoodM);
    // the veil: a soft curved drape behind the head, flaring onto the shoulders
    const back = new THREE.CylinderGeometry(0.135, 0.19, 0.28, 24, 4, true, -1.3, 2.6);
    const bpos = back.attributes.position;
    for (let i = 0; i < bpos.count; i++) { const y = bpos.getY(i), k = (0.14 - y) / 0.28; bpos.setZ(i, bpos.getZ(i) + k * k * 0.05); }
    back.computeVertexNormals();
    back.translate(0, 1.6, 0.03);
    put('Head', back, hoodM);
  }
  if (o.cloak) put('Spine2', boxAt(0.5, 1.05, 0.02, 0, 0.98, 0.2, -0.05), hoodM);
  for (const { boneName, mat, geos } of acc.values()) {
    for (const g of geos) { for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n); if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); }
    const m = new THREE.Mesh(geos.length > 1 ? mergeGeometries(geos) : geos[0], mat);
    m.castShadow = mat !== shadow; m.userData.armor = true;
    bone(model, boneName).attach(m); parts.push(m);
  }
  return { parts, uniforms: U, mats: [top, legs, boots, hoodM, leather], limbMat: top, face };
}
