// ---------- time of day ----------
let dayT = 9 / 24;            // start at 9 AM
const DAY_SECONDS = 8 * 60;   // one full day = 8 minutes
const sunDir = new THREE.Vector3();
const C = (h) => new THREE.Color(h);
const SKY = {
  night: { top: C(0x040814), hor: C(0x0b1326) },
  dusk:  { top: C(0x34507e), hor: C(0xe59a5c) },
  day:   { top: C(0x3a7bd5), hor: C(0xbcd6ee) },
};
const tmpTop = new THREE.Color(), tmpHor = new THREE.Color();
function updateSky() {
  const a = (dayT - 0.25) * Math.PI * 2;
  sunDir.set(Math.cos(a), Math.sin(a), 0.35).normalize();
  const e = sunDir.y;
  if (e < 0) { const k = smooth(-0.22, 0, e); tmpTop.copy(SKY.night.top).lerp(SKY.dusk.top, k); tmpHor.copy(SKY.night.hor).lerp(SKY.dusk.hor, k); }
  else { const k = smooth(0, 0.32, e); tmpTop.copy(SKY.dusk.top).lerp(SKY.day.top, k); tmpHor.copy(SKY.dusk.hor).lerp(SKY.day.hor, k); }
  skyMat.uniforms.top.value.copy(tmpTop);
  skyMat.uniforms.horizon.value.copy(tmpHor);
  skyMat.uniforms.sunDir.value.copy(sunDir);
  const day = smooth(-0.06, 0.18, e);
  skyMat.uniforms.sunVis.value = smooth(-0.1, 0.02, e);
  skyMat.uniforms.sunCol.value.setRGB(1, 0.75 + 0.2 * day, 0.5 + 0.4 * day);
  skyMat.uniforms.moonDir.value.copy(sunDir).negate();
  const night = 1 - smooth(-0.2, 0.02, e);
  skyMat.uniforms.moonVis.value = night;
  starMat.opacity = (1 - smooth(-0.28, -0.08, e)) * 0.9;
  ffMat.opacity = night;
  scene.fog.color.copy(tmpHor).multiplyScalar(0.92);

  sun.intensity = 2.8 * day;
  sun.color.setRGB(1, 0.72 + 0.26 * smooth(0, 0.4, e), 0.5 + 0.42 * smooth(0, 0.4, e));
  // twilight keeps a soft glow for a while after sunset and before sunrise
  const tw = smooth(-0.3, 0.0, e);
  moon.intensity = 0.7 * night;
  hemi.intensity = 0.32 + 0.3 * tw + 0.36 * day;
  hemi.color.copy(C(0x2a3a66)).lerp(C(0xb08a8a), tw).lerp(C(0xc4dbff), day);
  hemi.groundColor.set(0x141a10).lerp(C(0x3a3424), tw).lerp(C(0x56622e), day);
  renderer.toneMappingExposure = 1.05 + night * 0.35;

  const h = Math.floor(dayT * 24), m = Math.floor((dayT * 24 - h) * 60);
  const hh = ((h + 11) % 12) + 1;
  document.getElementById('clock').textContent = `${hh}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

