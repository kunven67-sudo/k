// Time of day and weather outside: the sun moves across the sky (sunrise ~6:00,
// sunset ~20:00, moonlight at night), street lamps and house windows light up
// after dark, it rains now and then (wet shiny streets, puddles, drying after),
// there's fog in the morning, breath shows when it's cold, and dust floats in
// the basement air. Particle counts follow graphics.particles.
import * as THREE from 'three';

const DAY_SECONDS = 24 * 60;  // one game day = 24 real minutes (1 game hour = 1 minute)
const _v = new THREE.Vector3();
const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);

function softDot(size = 64, inner = 'rgba(255,255,255,0.9)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

export class Environment {
  constructor({ scene, renderer, settings, camera, level, humans, zone }) {
    this.scene = scene;
    this.r = renderer;
    this.settings = settings;
    this.camera = camera;
    this.level = level;
    this.humans = humans;
    this.zone = zone;          // () => 'lab' | 'house' | 'outside'
    const params = new URLSearchParams(location.search);
    this.hour = Number(params.get('time') ?? 9.5);
    this.weather = { state: params.get('weather') || 'clear', rain: 0, cloud: 0, next: 30 + Math.random() * 60 };
    if (this.weather.state === 'rain') { this.weather.rain = 1; this.weather.cloud = 1; }
    this.wet = this.weather.rain;
    this.temperature = 15;
    const out = level.outdoor;
    this.wetU = { value: this.wet };
    if (out) this.makeWettable(out.materials);
    this.buildLamps(out?.lamps || []);
    this.buildRain();
    this.buildPuddles(out?.ground ?? 3.28);
    this.buildDust();
    this.buildBreath();
    this.clockEl = document.getElementById('clock');
  }

  get particles() { return this.settings.get('graphics.particles') ?? 1; }
  get night() { return 1 - smooth(-0.08, 0.12, this.sunElevation); }

  // ---- time of day
  get sunElevation() {
    const a = ((this.hour - 6) / 14) * Math.PI;   // 6:00 rise .. 20:00 set
    return Math.sin(a) * 0.95;
  }

  sunDir() {
    const a = ((this.hour - 6) / 14) * Math.PI;
    // from the east (+x) over the south (-z tilt) to the west
    const toSun = new THREE.Vector3(Math.cos(a), Math.max(0.05, Math.sin(a) * 0.95), -0.35).normalize();
    return toSun.negate();
  }

  // ---- wet streets: darker and shinier in the rain
  makeWettable(materials) {
    const u = this.wetU;
    for (const m of materials) {
      if (!m || m.userData.wettable) continue;
      m.userData.wettable = true;
      const prev = m.onBeforeCompile;
      const wet = (sh) => {
        sh.uniforms.uWet = u;
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float uWet;')
          .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 1.0 - 0.38 * uWet;')
          .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.12, uWet * 0.85);');
      };
      m.userData.extraCompile = wet;
      m.onBeforeCompile = (sh, r) => { prev?.call(m, sh, r); wet(sh, r); };
      m.customProgramCacheKey = () => `wet-${m.uuid.slice(0, 4)}`;
      m.needsUpdate = true;
    }
  }

  buildPuddles(groundY) {
    // shallow puddles in low spots on the road and sidewalks (they only show when it's wet)
    const geos = [];
    let s = 11;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 22; i++) {
      const g = new THREE.CircleGeometry(0.5 + rnd() * 1.1, 20);
      // irregular outline
      const p = g.attributes.position;
      for (let k = 1; k < p.count; k++) { const f = 0.75 + rnd() * 0.45; p.setXY(k, p.getX(k) * f, p.getY(k) * f * (0.6 + rnd() * 0.5)); }
      g.rotateX(-Math.PI / 2);
      const onRoad = i % 3 !== 0;
      g.translate(-40 + rnd() * 80, (onRoad ? 3.13 : groundY + 0.02) + 0.006, onRoad ? 9.6 + rnd() * 6 : (rnd() < 0.5 ? 7.4 + rnd() * 1.2 : 16.4 + rnd() * 1.2));
      geos.push(g);
    }
    const merged = new THREE.BufferGeometry();
    const pos = [];
    for (const g of geos) { const ng = g.toNonIndexed(); pos.push(...ng.attributes.position.array); }
    merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    merged.computeVertexNormals();
    this.puddleMat = new THREE.MeshStandardMaterial({ color: 0x1a1d20, roughness: 0.02, metalness: 0.2, transparent: true, opacity: 0, depthWrite: false, envMapIntensity: 1.6 });
    this.puddles = new THREE.Mesh(merged, this.puddleMat);
    this.puddles.userData.noCollide = true;
    this.puddles.receiveShadow = true;
    this.puddles.renderOrder = 1;
    this.scene.add(this.puddles);
  }

  // ---- street lamps: glowing heads, and a few real lights near you (always the same number of lights)
  buildLamps(lamps) {
    this.lampPos = lamps;
    const glowTex = softDot(64, 'rgba(255,214,150,1)', 'rgba(255,190,110,0)');
    this.lampGlows = lamps.map((p) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
      sp.position.copy(p);
      sp.scale.setScalar(1.4);
      this.scene.add(sp);
      return sp;
    });
    const n = lamps.length ? 4 : 0;
    this.lampLights = [];
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight(0xffc98a, 0, 16, 2);
      l.position.set(0, -100, 0);
      this.scene.add(l);
      this.lampLights.push(l);
    }
  }

  // ---- rain: streaks falling around you
  buildRain() {
    const N = 6000;
    const pos = new Float32Array(N * 6);
    this.rainBox = { w: 30, h: 16 };
    for (let i = 0; i < N; i++) {
      const x = (Math.random() - 0.5) * this.rainBox.w, y = Math.random() * this.rainBox.h, z = (Math.random() - 0.5) * this.rainBox.w;
      pos.set([x, y, z, x, y - 0.35, z], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rainMat = new THREE.LineBasicMaterial({ color: 0xaabbcc, transparent: true, opacity: 0.35, depthWrite: false });
    this.rain = new THREE.LineSegments(g, this.rainMat);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.rainN = N;
    this.scene.add(this.rain);
  }

  // ---- dust floating in the basement air
  buildDust() {
    const N = 500;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) pos.set([(Math.random() - 0.5) * 13.5, 0.2 + Math.random() * 2.7, (Math.random() - 0.5) * 9.5], i * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(g, new THREE.PointsMaterial({ map: softDot(32), size: 0.012, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false, color: 0xfff2dc }));
    this.dust.frustumCulled = false;
    this.dustN = N;
    this.scene.add(this.dust);
  }

  // ---- breath clouds in the cold
  buildBreath() {
    const tex = softDot(64, 'rgba(235,240,245,0.55)', 'rgba(235,240,245,0)');
    this.puffs = [];
    for (let i = 0; i < 48; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
      sp.visible = false;
      this.scene.add(sp);
      this.puffs.push({ sp, t: 1, life: 1, vel: new THREE.Vector3() });
    }
    this.nextPuff = 0;
  }

  puff(at, dir, scale) {
    const p = this.puffs[this.nextPuff++ % this.puffs.length];
    p.sp.position.copy(at);
    p.vel.copy(dir).multiplyScalar(0.35 * scale).add(_v.set(0, 0.06 * scale, 0));
    p.t = 0;
    p.life = 1.1 + Math.random() * 0.4;
    p.scale = scale;
    p.sp.visible = true;
  }

  // ---- every frame
  update(dt) {
    dt = Math.max(0, Math.min(0.1, dt));
    this.hour = (this.hour + (dt * 24) / DAY_SECONDS) % 24;
    this.updateWeather(dt);
    const zone = this.zone();
    const outside = zone !== 'lab';
    const elev = this.sunElevation;
    const day = smooth(-0.05, 0.25, elev);
    const night = this.night;
    // temperature: cool nights and mornings, colder in the rain
    this.temperature = 6 + 13 * day - this.weather.rain * 4;

    // sun / moon (the same light: low and blue at night)
    const csm = this.r.csm;
    if (csm) {
      const dir = elev > -0.05 ? this.sunDir() : new THREE.Vector3(0.3, -0.9, 0.25).normalize();
      csm.lightDirection.copy(dir);
      const cloud = this.weather.cloud;
      const sunI = 3 * day * (1 - cloud * 0.65);
      const moonI = 0.22 * night;
      const warm = 1 - smooth(0.02, 0.3, elev); // orange near the horizon
      const col = new THREE.Color(0xfff2e0).lerp(new THREE.Color(0xff9a52), warm * day);
      if (night > 0.5) col.set(0x8fa6d6);
      for (const l of csm.lights) {
        l.intensity = outside ? sunI + moonI : 0;
        l.color.copy(col);
      }
      this.r.sunIntensity = sunI + moonI;
    }
    if (outside && zone !== 'lab') {
      const bright = 0.04 + 0.96 * day * (1 - this.weather.cloud * 0.5);
      this.scene.backgroundIntensity = bright;
      if (zone === 'outside') this.scene.environmentIntensity = 0.05 + 0.85 * bright;
      // fog: thick in the early morning and in the rain, darker at night
      const fog = this.scene.fog;
      if (fog) {
        const morning = smooth(4.5, 6.5, this.hour) * (1 - smooth(8, 10, this.hour));
        const thick = Math.max(morning * 0.8, this.weather.rain * 0.6, this.weather.cloud * 0.25);
        fog.near = THREE.MathUtils.lerp(80, 6, thick);
        fog.far = THREE.MathUtils.lerp(260, 70, thick);
        fog.color.setRGB(0.77, 0.82, 0.86).multiplyScalar(0.08 + 0.92 * day);
      }
    }

    // street lamps and windows at night
    const lampOn = smooth(0.3, 0.7, night + this.weather.cloud * 0.2);
    for (const g of this.lampGlows) { g.material.opacity = lampOn * 0.9; g.visible = lampOn > 0.01 && outside; }
    if (this.level.outdoor?.litWindows) this.level.outdoor.litWindows.emissiveIntensity = lampOn * 0.8;
    if (this.lampLights.length) {
      const cam = this.camera.position;
      const near = [...this.lampPos].sort((a, b) => a.distanceToSquared(cam) - b.distanceToSquared(cam));
      const max = this.settings.get('graphics.preset') === 'low' ? 2 : 4;
      this.lampLights.forEach((l, i) => {
        const p = near[i];
        if (p && i < max && outside) { l.position.copy(p).add(_v.set(0, -0.3, 0)); l.intensity = lampOn * 22; }
        else l.intensity = 0;
      });
    }

    // rain streaks around you, wet ground building up and drying
    const rainOn = this.weather.rain > 0.05 && zone === 'outside';
    this.rain.visible = rainOn;
    if (rainOn) {
      const n = Math.floor(this.rainN * Math.min(1, this.particles) * this.weather.rain);
      this.rain.geometry.setDrawRange(0, n * 2);
      const p = this.rain.geometry.attributes.position.array;
      const fall = 9 * dt;
      const { w, h } = this.rainBox;
      for (let i = 0; i < n; i++) {
        const k = i * 6;
        p[k + 1] -= fall; p[k + 4] -= fall;
        if (p[k + 1] < -2) {
          const x = (Math.random() - 0.5) * w, z = (Math.random() - 0.5) * w;
          p[k] = p[k + 3] = x; p[k + 2] = p[k + 5] = z;
          p[k + 1] = h - 2; p[k + 4] = h - 2.35;
        }
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
      this.rain.position.set(this.camera.position.x, this.camera.position.y - 4, this.camera.position.z);
      this.rainMat.opacity = 0.18 + 0.2 * day;
    }
    const wetTarget = this.weather.rain > 0.1 ? 1 : 0;
    this.wet += (wetTarget - this.wet) * dt * (wetTarget ? 0.08 : 0.004 * (0.3 + day)); // gets wet fast, dries slowly (faster in the sun)
    this.wetU.value = this.wet;
    this.puddleMat.opacity = smooth(0.35, 0.9, this.wet) * 0.85;
    this.puddles.visible = this.puddleMat.opacity > 0.01 && outside;

    // dust in the basement air: slow drifting (only drawn when you're down there)
    this.dust.visible = zone === 'lab' && this.particles > 0;
    if (this.dust.visible) {
      const n = Math.floor(this.dustN * Math.min(1, this.particles));
      this.dust.geometry.setDrawRange(0, n);
      const p = this.dust.geometry.attributes.position.array;
      const t = performance.now() / 1000;
      for (let i = 0; i < n; i++) {
        const k = i * 3;
        p[k] += Math.sin(t * 0.3 + i) * 0.0006;
        p[k + 1] += (Math.sin(t * 0.21 + i * 1.7) * 0.5 - 0.15) * 0.002;
        p[k + 2] += Math.cos(t * 0.27 + i * 0.7) * 0.0006;
        if (p[k + 1] < 0.1) p[k + 1] = 2.8;
      }
      this.dust.geometry.attributes.position.needsUpdate = true;
    }

    // people outside get rained on (and their shoes get dirty out here)
    for (const h of this.humans) {
      if (!h.life) continue;
      const outdoorsNow = !h.tiny && h.position.y > 3.1 && !this.level.zones?.inHouse(h.position);
      h.life.outdoors = outdoorsNow;
      h.life.rain = outdoorsNow ? this.weather.rain : 0;
    }
    // breath you can see: a puff on every breath out when it's below ~8 °C
    const cold = smooth(9, 4, this.temperature);
    if (cold > 0.05 && outside) {
      for (const h of this.humans) {
        const life = h.life;
        if (!life || h.dead || h.tiny || !h.character.root.visible) continue;
        const phase = Math.sin(life.breath);
        if (life.lastPhase !== undefined && life.lastPhase > 0 && phase <= 0) {
          const head = h.character.bones.Bip01_Head;
          if (head && Math.random() < cold) {
            const hp = head.getWorldPosition(new THREE.Vector3());
            const fwd = new THREE.Vector3(Math.sin(h.yaw), 0, Math.cos(h.yaw));
            this.puff(hp.addScaledVector(fwd, 0.12 * h.scale).add(_v.set(0, -0.06 * h.scale, 0)), fwd, h.scale);
          }
        }
        life.lastPhase = phase;
      }
    }
    for (const p of this.puffs) {
      if (p.t >= p.life) { p.sp.visible = false; continue; }
      p.t += dt;
      const k = p.t / p.life;
      p.sp.position.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(Math.exp(-dt * 1.5));
      p.sp.scale.setScalar((0.06 + k * 0.35) * p.scale);
      p.sp.material.opacity = 0.5 * (1 - k) * Math.min(1, k * 6);
    }

    if (this.clockEl) {
      const h = Math.floor(this.hour), m = Math.floor((this.hour % 1) * 60);
      const icon = { clear: day > 0.5 ? '☀️' : '🌙', cloudy: '☁️', rain: '🌧️' }[this.weather.state];
      const text = `${icon} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} · ${Math.round(this.temperature)}°C`;
      if (this.clockEl.textContent !== text) this.clockEl.textContent = text;
    }
  }

  // weather changes now and then: mostly clear, sometimes cloudy, sometimes rain
  updateWeather(dt) {
    const w = this.weather;
    w.next -= dt;
    if (w.next <= 0) {
      const r = Math.random();
      w.state = r < 0.55 ? 'clear' : r < 0.8 ? 'cloudy' : 'rain';
      w.next = 120 + Math.random() * 300; // 2-7 game hours
    }
    const rainT = w.state === 'rain' ? 1 : 0;
    const cloudT = w.state === 'clear' ? 0 : 1;
    w.rain += (rainT - w.rain) * dt * 0.05;
    w.cloud += (cloudT - w.cloud) * dt * 0.04;
  }
}
