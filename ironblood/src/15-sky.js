
// ---------- time of day ----------
let dayT = 10 / 24;            // start at 10 AM
const DAY_SECONDS = 12 * 60;   // one full day = 12 minutes
const sunDir = new THREE.Vector3();
const C = (h) => new THREE.Color(h);
const FOG = { night: C(0x0a0f1a), dusk: C(0xc99574), day: C(0xb9cbe0), war: C(0x6f7478), snow: C(0xd6dee8) };
const _fc = new THREE.Color();
let weather = { rain: 0, snow: 0, flash: 0, nextBolt: 6 };
function updateSky(dt = 0) {
  const a = (dayT - 0.25) * Math.PI * 2;
  sunDir.set(Math.cos(a) * 0.8, Math.sin(a), 0.45).normalize();
  const e = sunDir.y;
  skyU.sunPosition.value.copy(sunDir);
  skyU.rayleigh.value = 1.4 - 0.6 * smooth(0, 0.3, e) + weather.rain * 1.5;
  skyU.turbidity.value = 4.5 + weather.rain * 8;
  const day = smooth(-0.06, 0.16, e), night = 1 - smooth(-0.22, 0.02, e), tw = smooth(-0.3, 0.0, e);
  sun.intensity = 3.6 * day * (1 - weather.rain * 0.65);
  sun.color.setRGB(1, 0.7 + 0.28 * smooth(0, 0.4, e), 0.48 + 0.45 * smooth(0, 0.4, e));
  moon.intensity = 0.55 * night;
  hemi.intensity = (0.2 + 0.2 * tw + 0.25 * day) * (1 + weather.flash * 8);
  hemi.color.set(0x2a3a66).lerp(C(0xb08a8a), tw).lerp(C(0xc4dbff), day);
  hemi.groundColor.set(0x141a10).lerp(C(0x3a3424), tw).lerp(C(0x56622e), day);
  starMat.opacity = (1 - smooth(-0.28, -0.08, e)) * 0.95 * (1 - weather.rain);
  moonMesh.position.copy(camera.position).addScaledVector(sunDir, -1500);
  moonMesh.visible = night > 0.05;
  renderer.toneMappingExposure = 0.6 + night * 0.25;
  scene.environmentIntensity = (0.2 + 0.8 * day) * (1 - weather.rain * 0.4);
  // fog: thick and gray on the battlefield, white haze in the snow
  const px = player.pos.x, pz = player.pos.z;
  const war = smooth(BATTLE_X - 40, BATTLE_X + 30, px), snowy = smooth(-140, -200, pz);
  if (e < 0) _fc.copy(FOG.night).lerp(FOG.dusk, smooth(-0.22, 0, e)); else _fc.copy(FOG.dusk).lerp(FOG.day, smooth(0, 0.3, e));
  _fc.lerp(FOG.war, war * 0.7 * day).lerp(FOG.snow, snowy * 0.5 * day);
  scene.fog.color.copy(_fc);
  scene.fog.density = 0.0018 + war * 0.009 + snowy * 0.003 + night * 0.0015;
  // weather follows where you are
  weather.rain += (war - weather.rain) * Math.min(1, dt * 0.5);
  weather.snow += (snowy - weather.snow) * Math.min(1, dt * 0.5);
  terrainUniforms.uWet.value = Math.min(0.9, weather.rain * 0.95);
  for (const w of windowsLitMats()) w.emissiveIntensity = night * 1.6;
  const h = Math.floor(dayT * 24), m = Math.floor((dayT * 24 - h) * 60), hh = ((h + 11) % 12) + 1;
  document.getElementById('clock').textContent = `${hh}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  return { day, night };
}
function windowsLitMats() { return MAT.window ? [MAT.window] : []; }

// rain streaks + lightning, snowflakes
const RAIN_N = 5000, rainGeo = new THREE.BufferGeometry(), rainPos = new Float32Array(RAIN_N * 6);
for (let i = 0; i < RAIN_N; i++) { const x = (Math.random() - 0.5) * 60, y = Math.random() * 30, z = (Math.random() - 0.5) * 60; rainPos.set([x, y, z, x + 0.03, y - 0.55, z], i * 6); }
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rainMat = new THREE.LineBasicMaterial({ color: 0xaab4bd, transparent: true, opacity: 0, depthWrite: false });
const rain = new THREE.LineSegments(rainGeo, rainMat); rain.frustumCulled = false; scene.add(rain);
const SNOW_N = 3500, snowGeo = new THREE.BufferGeometry(), snowPos = new Float32Array(SNOW_N * 3);
for (let i = 0; i < SNOW_N; i++) snowPos.set([(Math.random() - 0.5) * 50, Math.random() * 25, (Math.random() - 0.5) * 50], i * 3);
snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
const snowMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.07, transparent: true, opacity: 0, depthWrite: false });
const snow = new THREE.Points(snowGeo, snowMat); snow.frustumCulled = false; scene.add(snow);
let lastCam = new THREE.Vector3();
function updateWeather(dt, t) {
  rainMat.opacity = weather.rain * 0.42;
  snowMat.opacity = weather.snow * 0.9;
  const cp = camera.position;
  rain.visible = weather.rain > 0.02; snow.visible = weather.snow > 0.02;
  if (rain.visible) {
    for (let i = 0; i < RAIN_N; i++) {
      let y = rainPos[i * 6 + 1] - dt * 20;
      if (y < -5) y += 30;
      rainPos[i * 6 + 1] = y; rainPos[i * 6 + 4] = y - 0.55;
    }
    rain.position.set(cp.x, cp.y - 10, cp.z);
    rainGeo.attributes.position.needsUpdate = true;
    // lightning: a flash, then thunder rolling in a bit later
    weather.nextBolt -= dt;
    if (weather.rain > 0.5 && weather.nextBolt <= 0) {
      weather.nextBolt = 7 + Math.random() * 16; weather.flash = 1;
      const delay = 0.6 + Math.random() * 2.5;
      setTimeout(() => sfx.thunder && sfx.thunder(), delay * 1000);
    }
  }
  weather.flash = Math.max(0, weather.flash - dt * 3.5) * (Math.random() < 0.9 ? 1 : 0.4);
  if (snow.visible) {
    for (let i = 0; i < SNOW_N; i++) {
      let y = snowPos[i * 3 + 1] - dt * 1.1;
      snowPos[i * 3] += Math.sin(t * 0.7 + i) * dt * 0.3;
      if (y < -5) y += 25;
      snowPos[i * 3 + 1] = y;
    }
    snow.position.set(cp.x, cp.y - 8, cp.z);
    snowGeo.attributes.position.needsUpdate = true;
  }
}
