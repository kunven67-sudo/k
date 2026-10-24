// The main menu background: a giant black widow holding the Earth in her web. City lights on the night side,
// the sun coming round the edge of the planet, the Moon behind, the Milky Way. She's alive: legs re-grip, palps
// twitch, the abdomen breathes, and every few seconds she shifts on the planet.
import * as THREE from 'three';
import { makeEarth, makePlanet, makeStarSky, makeStarPoints, makeSun } from '../space/planets.js';
import { buildSpider } from '../spider/body.js';
import { SpiderRig } from '../spider/rig.js';
import { SPECIES } from '../spider/species.js';
import { WebLines } from '../game/webs.js';

const R = 10;
const _o = new THREE.Vector3();

function sphereProbe(c, r) {
  return (o, d, far) => {
    _o.copy(o).sub(c);
    const b = _o.dot(d), cc = _o.dot(_o) - r * r, disc = b * b - cc;
    if (disc < 0) return null;
    const sq = Math.sqrt(disc);
    let t = -b - sq; if (t < 0) t = -b + sq;
    if (t < 0 || t > far) return null;
    const p = o.clone().addScaledVector(d, t);
    return { point: p, normal: p.clone().sub(c).normalize(), distance: t };
  };
}

export class MenuScene {
  constructor(game) {
    this.game = game;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 4000);
    this.t = 0; this.ready = false;
  }
  async build() {
    const S = this.scene, G = this.game;
    this.sunDir = new THREE.Vector3(-0.72, 0.42, -0.55).normalize();
    // lights: the sun (rim), a cold fill so the spider reads, blue light bouncing off the Earth
    const sun = new THREE.DirectionalLight(0xfff1e0, 4.2); sun.position.copy(this.sunDir).multiplyScalar(100); S.add(sun);
    const fill = new THREE.DirectionalLight(0x9db8ff, 0.55); fill.position.set(30, 10, 40); S.add(fill);
    const bounce = new THREE.HemisphereLight(0x0a0c14, 0x2a5a9a, 0.7); S.add(bounce);
    // reflections for the glossy shell: space, the sun, the blue planet underneath
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, uniforms: { uSun: { value: this.sunDir } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec3 vD; uniform vec3 uSun; void main(){ vec3 d = normalize(vD); float s = max(dot(d, normalize(uSun)), 0.0);
        vec3 c = vec3(0.004, 0.005, 0.01) + vec3(0.08, 0.2, 0.45) * (1.0 - smoothstep(-0.9, 0.1, d.y)) * 0.6;
        c += vec3(1.0, 0.92, 0.8) * (smoothstep(0.985, 0.995, s) * 40.0 + s * s * s * s * s * s * s * s * 0.6);
        gl_FragColor = vec4(c, 1.0); }`,
    })));
    const pm = new THREE.PMREMGenerator(G.renderer.r);
    this.env = pm.fromScene(envScene, 0.02).texture; pm.dispose();
    S.environment = this.env; S.environmentIntensity = 1.0;
    // sky
    S.add(await makeStarSky(1000, 0.45));
    S.add(makeStarPoints(5000, 1));
    // the Earth
    this.earth = await makeEarth(R, { segments: 160, detail: false });
    this.earth.group.rotation.set(0.41, 2.2, 0); // tilt + turn so the Atlantic / Americas face us
    S.add(this.earth.group);
    // the Moon
    this.moon = await makePlanet('moon', R * 0.2727);
    this.moon.group.position.set(-46, 15, -95); S.add(this.moon.group);
    // the sun itself, far behind the planet's edge
    this.sun = await makeSun(6, { glow: 1.2 });
    this.sun.group.position.copy(this.sunDir).multiplyScalar(600); S.add(this.sun.group);
    // the spider, wrapped round the planet
    const sp = SPECIES.widow;
    this.spider = buildSpider(sp, { quality: 'high', hairMul: G.renderer.q.hair, fear: G.settings.fear });
    this.spider.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    S.add(this.spider);
    this.rig = new SpiderRig(this.spider, sp, sphereProbe(new THREE.Vector3(), R));
    this.hub = new THREE.Vector3(-0.42, 0.6, 0.68).normalize();
    this.size = R * 0.9;
    this.place(0);
    this.rig.snapFeet();
    // the web: an orb web wrapped round the whole planet, its hub under the spider (+ messy cobweb strands)
    this.web = new WebLines();
    this.buildWeb();
    S.add(this.web.mesh);
    // camera
    this.camBase = new THREE.Vector3(-16, 8, 40);
    this.look = new THREE.Vector3(-9.5, 3.5, -2);
    this.ready = true;
  }
  place(t) {
    // she shifts her grip slowly: a little turn + a little creep, so the legs re-step
    const yaw = Math.sin(t * 0.11) * 0.32 + Math.sin(t * 0.043) * 0.12;
    const creep = Math.sin(t * 0.07) * 0.06;
    const h = this.hub.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), creep).normalize();
    const up = h.clone();
    // head points toward the camera side of the planet, turned by yaw
    const want = new THREE.Vector3(-0.55, -0.25, 1); let fwd = want.clone().addScaledVector(up, -want.dot(up)).normalize();
    fwd.applyAxisAngle(up, yaw);
    const right = new THREE.Vector3().crossVectors(up, fwd).normalize();
    const m = new THREE.Matrix4().makeBasis(right, up, fwd);
    this.spider.quaternion.setFromRotationMatrix(m);
    this.spider.position.copy(h).multiplyScalar(R);
    this.spider.scale.setScalar(this.size);
  }
  buildWeb() {
    // widows don't spin neat wheels: she's been WRAPPING the planet like prey. Wobbly wraps all the way round in
    // every direction (thicker near her), a messy tangle around her, and a few long anchor lines out into space.
    const W = this.web, h = this.hub;
    let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const lit = (p) => Math.max(0.1, Math.min(1, p.clone().normalize().dot(this.sunDir) * 1.3 + 0.5));
    const randDir = () => { const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u); return new THREE.Vector3(r * Math.cos(a), u, r * Math.sin(a)); };
    // 1) wraps: big circles round the planet; most of them pass near her (she walks over them as she wraps)
    for (let i = 0; i < 46; i++) {
      let n = randDir();
      if (rnd() < 0.7) { const t = randDir(); n = t.sub(h.clone().multiplyScalar(t.dot(h))).normalize(); } // circle through the hub area
      const e1 = new THREE.Vector3().crossVectors(n, Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
      const e2 = new THREE.Vector3().crossVectors(n, e1);
      const a0 = rnd() * Math.PI * 2, span = Math.PI * (0.7 + rnd() * 1.3), rr = R * (1.008 + rnd() * 0.03), segs = 64;
      const al = 0.12 + rnd() * 0.22, w = 0.006 + rnd() * 0.006, wob = rnd() * 0.02;
      let prev = null;
      for (let k = 0; k <= segs; k++) {
        const a = a0 + span * k / segs;
        const p = e1.clone().multiplyScalar(Math.cos(a)).addScaledVector(e2, Math.sin(a)).multiplyScalar(rr * (1 + Math.sin(a * 9 + i) * wob * 0.3));
        if (prev && rnd() > 0.015) W.push(prev, p, w, al * lit(p));
        prev = p;
      }
    }
    // 2) the tangle round her: short sagging strands between points at different heights
    const near = () => { const d = h.clone().add(randDir().multiplyScalar(0.45)).normalize(); return d.multiplyScalar(R * (1.01 + rnd() * 0.25)); };
    for (let i = 0; i < 160; i++) {
      const a = near(), b = near(); if (a.distanceTo(b) > R * 0.7) continue;
      let prev = a;
      for (let k = 1; k <= 4; k++) { const f = k / 4; const p = a.clone().lerp(b, f); const len = p.length(); p.multiplyScalar(Math.max(R * 1.006, len - Math.sin(f * Math.PI) * a.distanceTo(b) * 0.08) / len); W.push(prev, p, 0.007, (0.18 + rnd() * 0.25) * lit(p)); prev = p; }
    }
    // 3) anchor lines from her out into the dark
    for (let i = 0; i < 9; i++) { const a = h.clone().multiplyScalar(R * 1.25).add(randDir().multiplyScalar(R * 0.2)); const b = a.clone().add(randDir().add(h).normalize().multiplyScalar(R * (3 + rnd() * 5))); W.push(a, b, 0.01, 0.25); }
    W.commit();
  }
  update(dt) {
    if (!this.ready) return;
    this.t += dt;
    const t = this.t;
    this.place(t);
    this.rig.excite = 0.25 + 0.25 * Math.max(0, Math.sin(t * 0.37));
    this.rig.update(dt, 0.05);
    this.earth.group.rotation.y += dt * 0.006;
    this.earth.update(dt, this.sunDir, this.camera.position);
    this.moon.update(dt, this.sunDir);
    this.sun.update(dt);
    // slow cinematic drift
    const c = this.camera, sw = Math.sin(t * 0.05);
    c.position.copy(this.camBase).applyAxisAngle(new THREE.Vector3(0, 1, 0), sw * 0.16).multiplyScalar(1 - 0.04 * Math.sin(t * 0.07));
    c.position.y += Math.sin(t * 0.09) * 1.2;
    c.lookAt(this.look);
    const { w, h } = this.game.renderer.size();
    if (c.aspect !== w / h) { c.aspect = w / h; c.updateProjectionMatrix(); }
    this.web.mat.uniforms.uRes.value.set(w, h);
  }
}
