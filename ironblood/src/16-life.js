function animateLife(dt, t) {
  const day = smooth(-0.04, 0.12, sunDir.y);
  // butterflies drift between flowers near the player in daylight
  for (const b of butterflies) {
    b.g.visible = day > 0.5;
    if (!b.g.visible) continue;
    if (Math.hypot(b.tx - b.g.position.x, b.tz - b.g.position.z) < 0.5 || Math.hypot(b.g.position.x - player.pos.x, b.g.position.z - player.pos.z) > 40) {
      const a = b.r() * 6.28, d = 3 + b.r() * 22;
      b.tx = player.pos.x + Math.cos(a) * d; b.tz = player.pos.z + Math.sin(a) * d;
      if (Math.hypot(b.g.position.x - player.pos.x, b.g.position.z - player.pos.z) > 45) b.g.position.set(b.tx + 2, b.g.position.y, b.tz);
    }
    const dx = b.tx - b.g.position.x, dz = b.tz - b.g.position.z, d = Math.hypot(dx, dz) || 1;
    b.g.position.x += dx / d * 1.2 * dt + Math.sin(t * 3 + b.phase) * 0.01;
    b.g.position.z += dz / d * 1.2 * dt + Math.cos(t * 2.3 + b.phase) * 0.01;
    b.g.position.y = groundH(b.g.position.x, b.g.position.z) + b.h + Math.sin(t * 2 + b.phase) * 0.25;
    b.g.rotation.y = Math.atan2(dx, dz);
    const f = Math.sin(t * 22 + b.phase) * 1.1;
    b.L.rotation.z = f; b.R.rotation.z = -f;
  }
  // two flocks circling high above
  for (const b of birds) {
    b.g.visible = day > 0.3;
    if (!b.g.visible) continue;
    const fa = t * (b.flock ? 0.05 : 0.07) + b.flock * 3;
    const cx = b.flock ? -40 : 30, cz = b.flock ? 20 : -10, R = b.flock ? 70 : 55;
    const lead = new THREE.Vector3(cx + Math.cos(fa) * R, 38 + b.flock * 8 + Math.sin(t * 0.3) * 3, cz + Math.sin(fa) * R);
    const side = (b.slot % 2 ? 1 : -1) * Math.ceil(b.slot / 2);
    const dirx = -Math.sin(fa), dirz = Math.cos(fa);
    b.g.position.set(lead.x - dirx * Math.abs(side) * 2.2 + dirz * side * 2.2, lead.y, lead.z - dirz * Math.abs(side) * 2.2 - dirx * side * 2.2);
    b.g.rotation.y = Math.atan2(dirx, dirz);
    const f = Math.sin(t * 7 + b.phase) * 0.6;
    b.L.rotation.z = f; b.R.rotation.z = -f;
  }
  // fireflies by the pond at night
  if (ffMat.opacity > 0.01) {
    const p = fireflyGeo.attributes.position;
    for (let i = 0; i < FF; i++) {
      const f = ffBase[i];
      p.setXYZ(i, f.x + Math.sin(t * 0.5 + f.ph) * 0.8, f.y + Math.sin(t * 0.9 + f.ph * 2) * 0.3, f.z + Math.cos(t * 0.4 + f.ph) * 0.8);
    }
    p.needsUpdate = true;
  }
  for (const c of clouds) { c.position.x += dt * 1.5; if (c.position.x > 380) c.position.x = -380; }
  waterMat.roughness = 0.08 + Math.sin(t * 0.7) * 0.02;
}
