// Puts the lab, house, street and cage together. Owns the clock, sky, sun and doors.
import * as THREE from 'three';
import { Colliders } from './colliders.js';
import { buildLab, LAB, STAIRS } from './lab.js';
import { buildHouse, HOUSE } from './house.js';
import { buildStreet, STREET } from './street.js';
import { Cage } from './cage.js';
import { buildHolidays } from './holidays.js';
import { clamp, lerp } from '../core/util.js';
import { quality } from '../core/quality.js';
import { sfx } from '../core/audio.js';

export const DAY_SECONDS = 16 * 60; // one in-game day = 16 real minutes at 1x

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = new Colliders();
    this.interactables = [];
    this.time = 9.5;           // hours 0..24
    this.day = 1;
    this.speed = 1;            // game time speed (cage time + everything)
    this.labLights = 'auto';
    this.lab = buildLab(this);
    this.house = buildHouse(this);
    this.street = buildStreet(this);
    scene.add(this.lab, this.house, this.street);
    this.cage = new Cage(this, this.lab);
    this.holiday = buildHolidays(this);
    this.buildSky();
    this.labLightList = [];
    this.lab.traverse((o) => { if (o.isPointLight) this.labLightList.push({ l: o, base: o.intensity }); });
    this.houseLightList = [];
    this.house.traverse((o) => { if (o.isPointLight) this.houseLightList.push({ l: o, base: o.intensity }); });
  }

  buildSky() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight(0xcfe6ff, 0x4a5a3a, 0.6);
    s.add(this.hemi);
    this.labAmb = new THREE.AmbientLight(0xbfd0d8, 0.35);
    this.lab.add(this.labAmb);
    this.sun = new THREE.DirectionalLight(0xfff2dc, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const c = this.sun.shadow.camera;
    c.left = -30; c.right = 30; c.top = 30; c.bottom = -30; c.near = 1; c.far = 160;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.03;
    s.add(this.sun, this.sun.target);
    this.street.add(this.sun);
    this.street.add(this.sun.target);
    // sky dome
    const geo = new THREE.SphereGeometry(400, 24, 12);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x3d7fd6) }, bottom: { value: new THREE.Color(0xcfe3f2) }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, night: { value: 0 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform float night; varying vec3 vP;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
        void main(){ float t = clamp(vP.y*1.4+0.15,0.0,1.0); vec3 col = mix(bottom, top, t);
          float s = max(dot(vP, normalize(sunDir)), 0.0); col += vec3(1.0,0.85,0.6)*pow(s, 400.0)*3.0*(1.0-night) + vec3(1.0,0.7,0.4)*pow(s,8.0)*0.25*(1.0-night);
          vec3 q = floor(vP*220.0); float st = step(0.997, h(q)) * night * smoothstep(0.0,0.3,vP.y);
          col += vec3(st);
          gl_FragColor = vec4(col,1.0); }`,
    });
    this.sky = new THREE.Mesh(geo, this.skyMat);
    this.sky.frustumCulled = false;
    this.street.add(this.sky);
    this.fog = new THREE.Fog(0xcfe3f2, 60, 190);
  }

  // where is a point: lab | stairs | house | street
  zoneAt(p) {
    if (p.x < -5.4 && p.x > -7.2 && p.z > -0.4 && p.z < 6.0 && p.y < HOUSE.floor + 2.6) return 'stairs';
    if (p.x > LAB.x0 - 0.3 && p.x < LAB.x1 + 0.3 && p.z > LAB.z0 - 0.3 && p.z < LAB.z1 + 0.3) {
      if (p.y < LAB.ceil) return 'lab';
      if (p.y < HOUSE.ceil + 0.2) return 'house';
    }
    return 'street';
  }

  get daylight() {
    const t = this.time;
    // 0 at night, 1 at noon; sunrise ~6, sunset ~19
    if (t < 5.5 || t > 19.5) return 0;
    if (t < 7) return (t - 5.5) / 1.5 * 0.6;
    if (t > 18) return (19.5 - t) / 1.5 * 0.6;
    return 0.6 + 0.4 * Math.sin(((t - 7) / 11) * Math.PI);
  }

  timeString() {
    const h = Math.floor(this.time), m = Math.floor((this.time - h) * 60);
    const ap = h >= 12 ? 'PM' : 'AM';
    return `Day ${this.day}  ${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`;
  }

  setVisibility(zone, cam) {
    const inLab = zone === 'lab', inStairs = zone === 'stairs';
    this.lab.visible = inLab || inStairs || (zone === 'house' && this.bookshelf.open && cam.x < -2);
    this.house.visible = !inLab || inStairs;
    this.street.visible = zone === 'house' || zone === 'street' || (inStairs && cam.y > 2.8);
    this.scene.fog = this.street.visible && zone === 'street' ? this.fog : null;
    if (!this.street.visible) this.scene.background = this.labBg || (this.labBg = new THREE.Color(0x0b0f10));
    else this.scene.background = null;
  }

  toggleDoor(d, open = !d.open) {
    if (d.open === open) return;
    d.open = open;
    sfx(d === this.bookshelf ? 'slide' : 'door');
  }

  update(dt, ctx) {
    // clock
    this.time += (dt * this.speed * 24) / DAY_SECONDS;
    if (this.time >= 24) { this.time -= 24; this.day++; if (ctx.onNewDay) ctx.onNewDay(this.day); }
    const day = this.daylight;
    // doors
    for (const d of [this.frontDoor, this.bookshelf]) {
      d.t = clamp(d.t + (d.open ? dt : -dt) * 1.6, 0, 1);
      const e = d.t * d.t * (3 - 2 * d.t);
      d.pivot.rotation.y = e * (d === this.bookshelf ? 1.45 : 1.5);
      d.box.on = d.t < 0.5;
    }
    // sun + sky
    const ang = ((this.time - 6) / 24) * Math.PI * 2;
    const sd = new THREE.Vector3(Math.cos(ang) * 0.6, Math.sin(ang), 0.45).normalize();
    this.skyMat.uniforms.sunDir.value.copy(sd);
    const night = clamp(1 - day * 2.2, 0, 1);
    this.skyMat.uniforms.night.value = night;
    const dusk = clamp(1 - Math.abs(day - 0.3) * 4, 0, 1) * (day < 0.6 ? 1 : 0);
    this.skyMat.uniforms.top.value.setRGB(lerp(0.02, 0.24, day), lerp(0.03, 0.5, day), lerp(0.08, 0.84, day));
    this.skyMat.uniforms.bottom.value.setRGB(lerp(0.05, 0.81, day) + dusk * 0.3, lerp(0.07, 0.89, day) + dusk * 0.05, lerp(0.12, 0.95, day) - dusk * 0.2);
    this.fog.color.copy(this.skyMat.uniforms.bottom.value);
    const p = ctx.playerPos;
    this.sun.position.set(p.x + sd.x * 80, p.y + Math.max(sd.y, 0.05) * 80, p.z + sd.z * 80);
    this.sun.target.position.copy(p);
    this.sun.intensity = 2.6 * clamp(day * 1.4, 0, 1);
    this.sun.color.setRGB(1, 0.85 + day * 0.12, 0.7 + day * 0.25);
    this.sun.castShadow = quality.p.shadows && day > 0.05;
    this.hemi.intensity = lerp(0.12, 0.75, day);
    this.hemi.color.setRGB(lerp(0.3, 0.8, day), lerp(0.35, 0.9, day), lerp(0.55, 1, day));
    this.sky.position.copy(p);
    // lab lights follow the clock (never fully dark) unless forced
    const lf = this.labLights === 'on' ? 1 : this.labLights === 'off' ? 0.12 : lerp(0.45, 1, clamp(day * 2, 0, 1));
    for (const { l, base } of this.labLightList) l.intensity = base * lf;
    this.labAmb.intensity = 0.35 * lf;
    const hf = lerp(1, 0.6, day);
    for (const { l, base } of this.houseLightList) l.intensity = base * hf;
    // street lamps glow at night
    for (const b of this.streetLamps) b.material.emissiveIntensity = night > 0.3 ? 2.2 : 0.1;
    // machines
    if (this.cloneRing) this.cloneRing.rotation.z += dt * 0.8;
    if (this.tvScreen) this.tvScreen.material.color.setHSL((ctx.time * 0.05) % 1, 0.4, 0.15 + Math.sin(ctx.time * 7) * 0.03);
    this.cage.update(dt * this.speed, { daylight: day, time: ctx.time, onStrike: ctx.onStrike });
    if (this.holiday) this.holiday.update(dt, ctx.time, night);
  }
}

export { LAB, HOUSE, STREET, STAIRS };
