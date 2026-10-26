// Light pool: a building has hundreds of real light fixtures, a GPU can afford a handful of real lights.
// Every fixture glows (emissive panel); the N nearest to the camera get a real PointLight, faded in/out so nothing
// pops. One shadow-casting SpotLight sits in the nearest fixture above the spider so it casts a real shadow.
import * as THREE from 'three';

const _v = new THREE.Vector3();

export class LightPool {
  constructor(scene, n, { shadowSize = 2048, decay = 2, range = 9 } = {}) {
    this.scene = scene;
    this.fixtures = [];           // { p: Vector3, color: Color, i: number, r: range }
    this.lights = [];
    this.range = range;
    for (let k = 0; k < n; k++) {
      const L = new THREE.PointLight(0xffffff, 0, range, decay);
      L.userData = { fix: null, want: null, cur: 0 };
      scene.add(L); this.lights.push(L);
    }
    this.spot = new THREE.SpotLight(0xffffff, 0, 30, 0.9, 0.85, decay);
    this.spot.castShadow = true;
    this.spot.shadow.mapSize.set(shadowSize, shadowSize);
    this.spot.shadow.bias = -0.0002; this.spot.shadow.normalBias = 0.02;
    this.spot.userData = { fix: null, cur: 0 };
    scene.add(this.spot); scene.add(this.spot.target);
    this.timer = 0;
    this.master = 1;               // 0 = power cut / lockdown dark
    this.flicker = 0;              // lockdown flicker amount
  }
  setFixtures(list) {
    this.fixtures = list.map(f => ({ p: f.p.clone ? f.p.clone() : new THREE.Vector3(...f.p), color: new THREE.Color(f.color ?? 0xffffff), i: f.i ?? 1, r: f.r || this.range, on: f.on !== false }));
    for (const L of this.lights) { L.userData.fix = null; L.userData.want = null; L.userData.cur = 0; L.intensity = 0; }
    this.spot.userData.fix = null; this.timer = 0;
  }
  addFixtures(list) { for (const f of list) this.fixtures.push({ p: f.p.clone(), color: new THREE.Color(f.color ?? 0xffffff), i: f.i ?? 1, r: f.r || this.range, on: f.on !== false }); }
  // brightness per unit of fixture "i" (candela-ish), tuned by eye for exposure 1
  update(dt, camPos, focus, size, base = 9) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.2;
      // spot: nearest lit fixture above the focus
      let best = null, bd = Infinity;
      for (const f of this.fixtures) {
        if (!f.on) continue;
        const dy = f.p.y - focus.y; if (dy < size * 2 || dy > 14) continue;
        const dx = f.p.x - focus.x, dz = f.p.z - focus.z, d = dx * dx + dz * dz + dy * dy * 0.25;
        if (d < bd) { bd = d; best = f; }
      }
      this.spot.userData.next = best;
      // pool: nearest lit fixtures to the camera (minus the one the spot took)
      const scored = [];
      for (const f of this.fixtures) {
        if (!f.on || f === best) continue;
        const d = f.p.distanceToSquared(camPos);
        if (d < f.r * f.r * 4) scored.push([d, f]);
      }
      scored.sort((a, b) => a[0] - b[0]);
      const want = scored.slice(0, this.lights.length).map(s => s[1]);
      const free = [];
      for (const L of this.lights) { const u = L.userData; if (u.fix && want.includes(u.fix)) { want.splice(want.indexOf(u.fix), 1); u.want = u.fix; } else { u.want = null; free.push(L); } }
      for (const L of free) { const f = want.shift(); L.userData.want = f || null; }
    }
    const k = 1 - Math.exp(-dt * 7);
    const fl = this.flicker > 0 ? (Math.sin(performance.now() * 0.031) * Math.sin(performance.now() * 0.0173) > 0.6 ? 0.15 : 1) : 1;
    for (const L of this.lights) {
      const u = L.userData;
      if (u.fix !== u.want) {
        u.cur -= dt * 6;                      // fade out, then move to the new fixture
        if (u.cur <= 0) { u.cur = 0; u.fix = u.want; if (u.fix) { L.position.copy(u.fix.p); L.color.copy(u.fix.color); L.distance = u.fix.r; } }
      } else if (u.fix) u.cur = Math.min(1, u.cur + dt * 3);
      L.intensity = u.fix ? u.cur * u.fix.i * base * this.master * fl : 0;
    }
    const S = this.spot, su = S.userData;
    if (su.fix !== su.next) {
      su.cur -= dt * 5;
      if (su.cur <= 0) { su.cur = 0; su.fix = su.next; if (su.fix) { S.position.copy(su.fix.p); S.color.copy(su.fix.color); } }
    } else if (su.fix) su.cur = Math.min(1, su.cur + dt * 3);
    if (su.fix) {
      S.target.position.copy(focus);
      const dist = su.fix.p.distanceTo(focus);
      // wide soft cone (the light still lights the room), shadow camera tight around the spider
      S.angle = 1.15; S.penumbra = 0.9; S.distance = Math.max(su.fix.r * 1.6, dist * 2.5);
      S.shadow.camera.near = Math.max(0.02, dist * 0.2); S.shadow.camera.far = dist * 2.5;
      S.shadow.camera.fov = Math.max(6, Math.min(100, THREE.MathUtils.radToDeg(Math.atan(size * 18 / dist)) * 2));
      S.shadow.camera.updateProjectionMatrix();
      S.intensity = su.cur * su.fix.i * base * this.master * fl;
    } else S.intensity = 0;
  }
  dispose() { for (const L of this.lights) L.removeFromParent(); this.spot.removeFromParent(); this.spot.target.removeFromParent(); this.spot.shadow.dispose && this.spot.shadow.dispose(); }
}
