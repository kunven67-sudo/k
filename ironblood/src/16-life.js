
// ---------- life: butterflies, birds, fireflies, clouds ----------
const butterflies = [];
{
  const r = mulberry32(600), cols = [0xf2a33a, 0xf4f1e6, 0x7fb3e6, 0xf2d34c];
  const wing = new THREE.CircleGeometry(0.06, 6); wing.translate(0.06, 0, 0); wing.rotateX(-Math.PI / 2);
  for (let i = 0; i < 14; i++) {
    const m = new THREE.MeshStandardMaterial({ color: cols[i % 4], side: THREE.DoubleSide, roughness: 0.6 });
    const g = new THREE.Group(), L = new THREE.Mesh(wing, m), R = new THREE.Mesh(wing, m);
    R.scale.x = -1; g.add(L, R);
    g.position.set(VILLAGE.x + (r() - 0.5) * 40, 0, VILLAGE.z + (r() - 0.5) * 40);
    butterflies.push({ g, L, R, phase: r() * 10, tx: g.position.x, tz: g.position.z, h: 0.6 + r() * 1.2, r });
    scene.add(g);
  }
}
const birds = [];
{
  const mat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, side: THREE.DoubleSide });
  const wing = new THREE.BufferGeometry();
  wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.15, 0, 0, 0.2, 0.75, 0, 0.05], 3));
  wing.computeVertexNormals();
  for (let i = 0; i < 12; i++) {
    const g = new THREE.Group(), L = new THREE.Mesh(wing, mat), R = new THREE.Mesh(wing, mat);
    R.scale.x = -1;
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.45, 5), mat); body.rotation.x = Math.PI / 2;
    g.add(L, R, body); g.scale.setScalar(1.6);
    birds.push({ g, L, R, flock: i < 6 ? 0 : 1, slot: i < 6 ? i : i - 6, phase: i * 0.7 });
    scene.add(g);
  }
}
const FF = 90, ffBase = [], fireflyGeo = new THREE.BufferGeometry();
{
  const r = mulberry32(700), p = new Float32Array(FF * 3);
  for (let i = 0; i < FF; i++) {
    const seg = Math.floor(r() * (RIVER.length - 1)), t = r();
    const x = lerp(RIVER[seg][0], RIVER[seg + 1][0], t) + (r() - 0.5) * 40, z = lerp(RIVER[seg][1], RIVER[seg + 1][1], t) + (r() - 0.5) * 40;
    ffBase.push({ x, z, y: Math.max(WATER_Y + 0.4, terrainH(x, z) + 0.4 + r() * 1.3), ph: r() * 10 });
  }
  fireflyGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
}
const ffMat = new THREE.PointsMaterial({ color: 0xd8ff7a, size: 0.12, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
const fireflies = new THREE.Points(fireflyGeo, ffMat); fireflies.frustumCulled = false; scene.add(fireflies);
// soft billboard clouds high above
const cloudTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), r = mulberry32(31);
  for (let i = 0; i < 26; i++) {
    const x = 60 + r() * 136, y = 90 + r() * 70, rad = 30 + r() * 50;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const cloudMat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.85 });
const clouds = [];
for (let i = 0; i < 55; i++) {
  const s = new THREE.Sprite(cloudMat); const r = 120 + Math.random() * 120;
  s.scale.set(r * 1.6, r * 0.7, 1);
  s.position.set((Math.random() - 0.5) * 1600, 260 + Math.random() * 120, (Math.random() - 0.5) * 1600);
  scene.add(s); clouds.push(s);
}
function animateLife(dt, t, P) {
  const day = smooth(-0.04, 0.12, sunDir.y);
  for (const b of butterflies) {
    b.g.visible = day > 0.5 && weather.rain < 0.3;
    if (!b.g.visible) continue;
    if (Math.hypot(b.tx - b.g.position.x, b.tz - b.g.position.z) < 0.5 || Math.hypot(b.g.position.x - P.x, b.g.position.z - P.z) > 40) {
      const a = b.r() * 6.28, d = 3 + b.r() * 22;
      b.tx = P.x + Math.cos(a) * d; b.tz = P.z + Math.sin(a) * d;
      if (Math.hypot(b.g.position.x - P.x, b.g.position.z - P.z) > 45) b.g.position.set(b.tx + 2, b.g.position.y, b.tz);
    }
    const dx = b.tx - b.g.position.x, dz = b.tz - b.g.position.z, d = Math.hypot(dx, dz) || 1;
    b.g.position.x += dx / d * 1.2 * dt + Math.sin(t * 3 + b.phase) * 0.01;
    b.g.position.z += dz / d * 1.2 * dt + Math.cos(t * 2.3 + b.phase) * 0.01;
    b.g.position.y = terrainH(b.g.position.x, b.g.position.z) + b.h + Math.sin(t * 2 + b.phase) * 0.25;
    b.g.rotation.y = Math.atan2(dx, dz);
    const f = Math.sin(t * 22 + b.phase) * 1.1; b.L.rotation.z = f; b.R.rotation.z = -f;
  }
  for (const b of birds) {
    b.g.visible = day > 0.3;
    if (!b.g.visible) continue;
    const fa = t * (b.flock ? 0.05 : 0.07) + b.flock * 3;
    const cx = P.x + (b.flock ? -60 : 50), cz = P.z + (b.flock ? 30 : -20), R = b.flock ? 80 : 60;
    const lx = cx + Math.cos(fa) * R, ly = terrainH(cx, cz) + 45 + b.flock * 10, lz = cz + Math.sin(fa) * R;
    const side = (b.slot % 2 ? 1 : -1) * Math.ceil(b.slot / 2), dx = -Math.sin(fa), dz = Math.cos(fa);
    b.g.position.set(lx - dx * Math.abs(side) * 2.2 + dz * side * 2.2, ly, lz - dz * Math.abs(side) * 2.2 - dx * side * 2.2);
    b.g.rotation.y = Math.atan2(dx, dz);
    const f = Math.sin(t * 7 + b.phase) * 0.6; b.L.rotation.z = f; b.R.rotation.z = -f;
  }
  ffMat.opacity = (1 - smooth(-0.2, 0.02, sunDir.y)) * (1 - weather.rain);
  if (ffMat.opacity > 0.01) {
    const p = fireflyGeo.attributes.position;
    for (let i = 0; i < FF; i++) { const f = ffBase[i]; p.setXYZ(i, f.x + Math.sin(t * 0.5 + f.ph) * 0.8, f.y + Math.sin(t * 0.9 + f.ph * 2) * 0.3, f.z + Math.cos(t * 0.4 + f.ph) * 0.8); }
    p.needsUpdate = true;
  }
  const cl = 0.15 + 0.85 * day;
  cloudMat.color.setRGB(cl, cl, cl * 1.02).lerp(new THREE.Color(0x55595e), weather.rain * 0.8);
  cloudMat.opacity = 0.75 + weather.rain * 0.25;
  for (const c of clouds) { c.position.x += dt * 2.5; if (c.position.x > 800) c.position.x = -800; }
}
