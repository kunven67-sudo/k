
// ---------- gore: blood, sparks, stains, pools, cut pieces, organs ----------
const splatTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), r = mulberry32(5);
  const blob = (x, y, rad, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(95,4,4,${a})`); gr.addColorStop(0.7, `rgba(80,2,2,${a * 0.9})`); gr.addColorStop(1, 'rgba(60,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); };
  blob(64, 64, 34, 0.95);
  for (let i = 0; i < 18; i++) { const a = r() * 6.28, d = 20 + r() * 36; blob(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 3 + r() * 9, 0.9); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();

const gore = (() => {
  // --- particles ---
  const N = 900;
  const pMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x6a0303, roughness: 0.25, metalness: 0 }), N);
  pMesh.frustumCulled = false; scene.add(pMesh);
  const P = []; for (let i = 0; i < N; i++) P.push({ on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), s: 0, life: 0 });
  let pNext = 0;
  const S = 220;
  const sMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xffd27a }), S);
  sMesh.frustumCulled = false; scene.add(sMesh);
  const SP = []; for (let i = 0; i < S; i++) SP.push({ on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0 });
  let sNext = 0;
  // --- stains ---
  const D = 450;
  const dGeo = new THREE.PlaneGeometry(1, 1);
  const dMesh = new THREE.InstancedMesh(dGeo, new THREE.MeshStandardMaterial({ map: splatTex, transparent: true, depthWrite: false, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -4 }), D);
  dMesh.frustumCulled = false; dMesh.renderOrder = 1; scene.add(dMesh);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < D; i++) dMesh.setMatrixAt(i, zero);
  for (let i = 0; i < N; i++) pMesh.setMatrixAt(i, zero);
  for (let i = 0; i < S; i++) sMesh.setMatrixAt(i, zero);
  let dNext = 0;
  const pools = [];
  const pieces = [];
  const emitters = [];
  const later = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), nrm = new THREE.Vector3(), zAxis = new THREE.Vector3(0, 0, 1);

  function groundNormal(x, z, out) {
    const e = 0.4;
    out.set(groundH(x - e, z) - groundH(x + e, z), 2 * e, groundH(x, z - e) - groundH(x, z + e)).normalize();
    return out;
  }
  function stain(x, y, z, size, normal) {
    if (settings.gore === 0) return -1;
    const i = dNext; dNext = (dNext + 1) % D;
    const n = normal || groundNormal(x, z, nrm);
    q.setFromUnitVectors(zAxis, n);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(zAxis, Math.random() * 6.28));
    m4.compose(new THREE.Vector3(x, y, z), q, sc.set(size, size, size));
    dMesh.setMatrixAt(i, m4); dMesh.instanceMatrix.needsUpdate = true;
    return i;
  }
  function blood(at, dir, count, speed) {
    if (settings.gore === 0 || !at) return;
    count = Math.round(count * (settings.gore === 1 ? 0.5 : 1));
    for (let k = 0; k < count; k++) {
      const p = P[pNext]; pNext = (pNext + 1) % N;
      p.on = true; p.p.copy(at);
      p.v.set((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2).multiplyScalar(speed * 0.6);
      if (dir) p.v.addScaledVector(dir, speed * (0.4 + Math.random() * 0.8));
      p.s = 0.01 + Math.random() * 0.025; p.life = 2;
    }
  }
  function sparks(at, dir, count = 14) {
    if (!at) return;
    for (let k = 0; k < count; k++) {
      const p = SP[sNext]; sNext = (sNext + 1) % S;
      p.on = true; p.p.copy(at); p.life = 0.25 + Math.random() * 0.3;
      p.v.set((Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6);
      if (dir) p.v.addScaledVector(dir, -3);
    }
  }
  function piece(obj, vel, angVel, r, axis, offset, isHead, isSword) {
    pieces.push({ obj, vel, angVel, r, rest: false, isHead, isSword, bleedT: isSword ? 0 : 4 });
    if (pieces.length > 50) { const old = pieces.shift(); scene.remove(old.obj); }
  }
  function emitter(obj, fighter, dur, intensity) { emitters.push({ obj, f: fighter, t: 0, dur, k: intensity, beat: 0 }); }
  function pool(f) { pools.push({ f, idx: -1, size: 0.2, max: 1.4 + Math.random() * 0.6, delay: 0.8 }); }
  // wound in the torso while still alive: ribs and guts showing through
  function gash(f, k, point) {
    if (settings.gore < 2 || (f.gashes || 0) >= 2) return;
    f.gashes = (f.gashes || 0) + 1;
    const g = torsoGash();
    const b = f.b[k === 'chest' ? 'Spine2' : 'Spine'];
    const c = b.getWorldPosition(new THREE.Vector3());
    const out = point.clone().sub(c).setY(0).normalize();
    g.position.copy(c).addScaledVector(out, k === 'chest' ? 0.16 : 0.15).setY(point.y);
    g.lookAt(g.position.clone().add(out));
    g.scale.setScalar(k === 'chest' ? 1 : 0.9);
    b.attach(g);
  }
  function openTorso(f, o, stab) {
    gash(f, o.part || 'belly', o.point || f.b.Spine1.getWorldPosition(new THREE.Vector3()));
    if (stab) return;
    // after the body hits the ground, the organs spill out beside it
    later.push({ t: 0.75, fn: () => {
      const c = f.b.Spine1.getWorldPosition(new THREE.Vector3());
      const kinds = o.part === 'chest' ? ['heart', 'lung', 'lung', 'gut'] : ['gut', 'gut', 'liver', 'stomach', 'kidney'];
      for (const kd of kinds) {
        const m = new THREE.Mesh(organGeo(kd), ORGAN_MATS[kd]);
        m.castShadow = true;
        const g = new THREE.Group(); g.add(m);
        g.position.copy(c).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.15, (Math.random() - 0.5) * 0.3));
        g.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        if (kd === 'gut') { g.rotation.set(0, Math.random() * 6, 0); }
        scene.add(g);
        piece(g, new THREE.Vector3((Math.random() - 0.5) * 1.6, 1 + Math.random(), (Math.random() - 0.5) * 1.6), kd === 'gut' ? new THREE.Vector3() : new THREE.Vector3(Math.random() * 4, Math.random() * 4, Math.random() * 4), kd === 'gut' ? 0.02 : 0.04, null, 0, false, false);
      }
      blood(c, new THREE.Vector3(0, 1, 0), 60, 2.5);
      sfx.cut(c, 1.2);
      for (let i = 0; i < 4; i++) stain(c.x + (Math.random() - 0.5) * 0.8, groundH(c.x, c.z) + 0.015, c.z + (Math.random() - 0.5) * 0.8, 0.5 + Math.random() * 0.4);
    } });
  }
  const tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3(), tmpW = new THREE.Vector3();
  function update(dt) {
    // blood drops
    for (let i = 0; i < N; i++) {
      const p = P[i];
      if (!p.on) continue;
      p.v.y -= 9.8 * dt; p.v.multiplyScalar(1 - 0.4 * dt);
      p.p.addScaledVector(p.v, dt);
      p.life -= dt;
      const gh = groundH(p.p.x, p.p.z);
      if (p.p.y <= gh + 0.01 || p.life <= 0) {
        p.on = false; pMesh.setMatrixAt(i, zero);
        if (p.life > 0 && Math.random() < 0.3) stain(p.p.x, gh + 0.012 + Math.random() * 0.004, p.p.z, 0.08 + Math.random() * 0.22);
        continue;
      }
      // splashes onto walls: houses, castle walls, ruins
      const wb = solidAt(p.p.x, p.p.z, 0.02);
      if (wb && p.p.y > wb.h0 && p.p.y < wb.h1) {
        p.on = false; pMesh.setMatrixAt(i, zero);
        const dx = p.p.x - wb.cx, dz = p.p.z - wb.cz, u = dx * wb.c - dz * wb.s, v = dx * wb.s + dz * wb.c;
        let lu = 0, lv = 0, pu = u, pv = v;
        if (wb.hw - Math.abs(u) < wb.hd - Math.abs(v)) { lu = Math.sign(u); pu = Math.sign(u) * (wb.hw + 0.03); } else { lv = Math.sign(v); pv = Math.sign(v) * (wb.hd + 0.03); }
        const n = new THREE.Vector3(lu * wb.c + lv * wb.s, 0, -lu * wb.s + lv * wb.c);
        const wx = wb.cx + pu * wb.c + pv * wb.s, wz = wb.cz - pu * wb.s + pv * wb.c;
        stain(wx, p.p.y, wz, 0.12 + Math.random() * 0.2, n);
        continue;
      }
      m4.makeScale(p.s, p.s * (1 + Math.min(2, p.v.length() * 0.15)), p.s).setPosition(p.p);
      pMesh.setMatrixAt(i, m4);
    }
    pMesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < S; i++) {
      const p = SP[i];
      if (!p.on) continue;
      p.v.y -= 9.8 * dt; p.p.addScaledVector(p.v, dt); p.life -= dt;
      if (p.life <= 0) { p.on = false; sMesh.setMatrixAt(i, zero); continue; }
      const s = 0.008 * (p.life / 0.5 + 0.3);
      m4.makeScale(s, s, s).setPosition(p.p); sMesh.setMatrixAt(i, m4);
    }
    sMesh.instanceMatrix.needsUpdate = true;
    // stumps pumping blood with the heartbeat, weaker over time
    for (let i = emitters.length - 1; i >= 0; i--) {
      const e = emitters[i];
      e.t += dt;
      const fade = e.f.alive ? 1 : Math.max(0, 1 - (e.t - (e.diedAt ?? (e.diedAt = e.t))) / 4);
      if (e.t > e.dur * 3 || fade <= 0 || settings.gore === 0) { emitters.splice(i, 1); continue; }
      e.beat += dt * (e.f.alive ? 1.6 : 0.9);
      const pulse = Math.max(0, Math.sin(e.beat * Math.PI * 2)) ** 3;
      if (pulse > 0.2) {
        e.obj.getWorldPosition(tmpV);
        tmpW.set(0, 0, 1).applyQuaternion(e.obj.getWorldQuaternion(tmpQ));
        blood(tmpV, tmpW, Math.ceil(3 * e.k * fade * pulse), 3.2 * e.k * fade * (0.6 + pulse));
        if (pulse > 0.95 && Math.random() < 0.3) sfx.spurt(tmpV);
      }
    }
    // cut pieces: fly, bounce, roll, then rest
    for (const pc of pieces) {
      if (pc.rest) continue;
      pc.vel.y -= 9.8 * dt;
      pc.obj.position.addScaledVector(pc.vel, dt);
      const w = pc.angVel.length();
      if (w > 1e-4) { tmpQ.setFromAxisAngle(tmpV.copy(pc.angVel).divideScalar(w), w * dt); pc.obj.quaternion.premultiply(tmpQ); }
      const gh = groundH(pc.obj.position.x, pc.obj.position.z) + pc.r;
      if (pc.obj.position.y < gh) {
        const sp = Math.abs(pc.vel.y);
        pc.obj.position.y = gh;
        pc.vel.y = sp > 1.5 ? sp * 0.28 : 0;
        pc.vel.x *= 0.62; pc.vel.z *= 0.62; pc.angVel.multiplyScalar(0.55);
        if (sp > 1.8) { pc.isSword ? sfx.armorHit(pc.obj.position) : sfx.thud(pc.obj.position, 0.4); if (!pc.isSword) stain(pc.obj.position.x, groundH(pc.obj.position.x, pc.obj.position.z) + 0.013, pc.obj.position.z, 0.18 + Math.random() * 0.15); }
        if (pc.vel.lengthSq() < 0.05 && pc.angVel.lengthSq() < 0.2) {
          pc.rest = true;
          if (!pc.isSword) stain(pc.obj.position.x, groundH(pc.obj.position.x, pc.obj.position.z) + 0.014, pc.obj.position.z, pc.isHead ? 0.6 : 0.35);
        }
      }
      if (pc.bleedT > 0 && !pc.isSword) { pc.bleedT -= dt; if (Math.random() < 0.5) blood(pc.obj.position, null, 1, 0.5); }
    }
    // pools spreading under the dead
    for (const pl of pools) {
      if (pl.delay > 0) { pl.delay -= dt; continue; }
      if (pl.size >= pl.max) continue;
      pl.size = Math.min(pl.max, pl.size + dt * 0.06);
      const c = pl.f.b.Spine1.getWorldPosition(tmpV);
      if (pl.idx < 0) { pl.idx = stain(c.x, groundH(c.x, c.z) + 0.016, c.z, pl.size); pl.rot = Math.random() * 6.28; pl.x = c.x; pl.z = c.z; continue; }
      groundNormal(pl.x, pl.z, nrm);
      q.setFromUnitVectors(zAxis, nrm).multiply(tmpQ.setFromAxisAngle(zAxis, pl.rot));
      m4.compose(new THREE.Vector3(pl.x, groundH(pl.x, pl.z) + 0.016, pl.z), q, sc.set(pl.size, pl.size, pl.size));
      dMesh.setMatrixAt(pl.idx, m4); dMesh.instanceMatrix.needsUpdate = true;
    }
    for (let i = later.length - 1; i >= 0; i--) { later[i].t -= dt; if (later[i].t <= 0) { later[i].fn(); later.splice(i, 1); } }
  }
  return { blood, sparks, stain, piece, emitter, pool, gash, openTorso, update };
})();
