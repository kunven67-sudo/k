// The small things that make the terrarium feel like a real piece of Earth at
// 1/20 scale: morning dew on the plants (a drink for tiny people), mushrooms
// and moss by the logs and rocks, fallen leaves, fog and drops on the glass,
// algae and floating leaves on the pond, embers over the lava, grass that
// bends when someone pushes through it, footprints in the soil, and dust and
// hairs drifting down from you when you lean over the tank.
// Counts follow graphics.particles; everything is instanced (few draw calls).
import * as THREE from 'three';
import { TANK } from './cageworld.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

function rng(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

// instanced mesh from a list of transforms
function instanced(geo, mat, list, { shadow = false } = {}) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  list.forEach((m, i) => im.setMatrixAt(i, m));
  im.count = list.length;
  im.castShadow = shadow;
  im.receiveShadow = true;
  im.userData.noCollide = true;
  im.computeBoundingSphere();
  return im;
}

const place = (x, y, z, s, rotY = 0, tilt = 0) => _m.compose(_p.set(x, y, z), _q.setFromEuler(new THREE.Euler(tilt, rotY, 0)), _s.setScalar(s)).clone();

export function addTinyDetails({ tiny, cage, settings, glass, getHour, player, camera }) {
  const world = tiny.world;
  const r = rng(91);
  const density = Math.max(0.3, settings.get('graphics.particles') ?? 1);
  const y = (x, z) => tiny.surfaceY(x, z);
  const { pond, lava } = tiny.features;
  const dry = (x, z) => cage.isWalkable(x, z);
  const sources = tiny.solid.children.filter((o) => /tiny-log|tiny-rock/.test(o.name));

  // ---- mushrooms (stem + cap) in little clusters at the foot of logs and rocks
  const stems = [], caps = [];
  for (const o of sources) {
    const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
    const n = o.name === 'tiny-log' ? 5 : 2;
    for (let i = 0; i < n * density; i++) {
      const a = r() * Math.PI * 2, d = 0.02 + r() * 0.05;
      const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
      if (!dry(x, z)) continue;
      const h = 0.004 + r() * 0.008; // 8-24 cm to a tiny person... toadstools taller than them for some
      stems.push(place(x, y(x, z) + h / 2, z, 1, 0).multiply(new THREE.Matrix4().makeScale(h * 0.18, h, h * 0.18)));
      caps.push(place(x, y(x, z) + h, z, h * 0.55, r() * 6, (r() - 0.5) * 0.3));
    }
  }
  const stemGeo = new THREE.CylinderGeometry(0.5, 0.65, 1, 8);
  const capGeo = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  capGeo.scale(1, 0.55, 1);
  world.add(instanced(stemGeo, new THREE.MeshStandardMaterial({ color: 0xe9e2cf, roughness: 0.8 }), stems));
  world.add(instanced(capGeo, new THREE.MeshStandardMaterial({ color: 0xa4572c, roughness: 0.55 }), caps, { shadow: true }));

  // ---- moss: soft green clumps hugging rocks and logs
  const moss = [];
  for (const o of sources) {
    const bb = new THREE.Box3().setFromObject(o);
    const c = bb.getCenter(new THREE.Vector3()), size = bb.getSize(new THREE.Vector3());
    for (let i = 0; i < 6 * density; i++) {
      const a = r() * Math.PI * 2;
      const x = c.x + Math.cos(a) * size.x * 0.45, z = c.z + Math.sin(a) * size.z * 0.45;
      const s = 0.006 + r() * 0.012;
      moss.push(place(x, Math.max(y(x, z), bb.min.y) + s * 0.15, z, s, r() * 6).multiply(new THREE.Matrix4().makeScale(1, 0.35, 1)));
    }
  }
  const mossGeo = new THREE.IcosahedronGeometry(1, 1);
  world.add(instanced(mossGeo, new THREE.MeshStandardMaterial({ color: 0x4f6b2a, roughness: 1 }), moss));

  // ---- fallen leaves (to them: sheets as big as a door) and twigs
  const leafGeo = new THREE.PlaneGeometry(1, 0.6, 4, 2);
  {
    // curl the leaf a little, pointy at the ends
    const p = leafGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), yy = p.getY(i);
      p.setY(i, yy * (1 - Math.abs(x) * 1.4));
      p.setZ(i, (yy * yy) * 0.6 + x * x * 0.2);
    }
    leafGeo.rotateX(-Math.PI / 2);
    leafGeo.computeVertexNormals();
  }
  const leaves = [];
  for (let i = 0; i < 70 * density; i++) {
    const x = (r() - 0.5) * (TANK.w - 0.1), z = (r() - 0.5) * (TANK.d - 0.1);
    if (!dry(x, z)) continue;
    leaves.push(place(x, y(x, z) + 0.0008, z, 0.035 + r() * 0.04, r() * 6, (r() - 0.5) * 0.25));
  }
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x5e4426, roughness: 0.95, side: THREE.DoubleSide });
  world.add(instanced(leafGeo, leafMat, leaves));

  // ---- pond: algae ring at the shore and leaves floating on the water
  const algae = [];
  for (let i = 0; i < 40 * density; i++) {
    const a = r() * Math.PI * 2, d = pond.r * (0.68 + r() * 0.12);
    const x = pond.x + Math.cos(a) * d, z = pond.z + Math.sin(a) * d;
    algae.push(place(x, cage.waterY + 0.0004, z, 0.006 + r() * 0.012, r() * 6).multiply(new THREE.Matrix4().makeScale(1, 0.05, 1)));
  }
  world.add(instanced(new THREE.CircleGeometry(1, 10).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3e5e24, roughness: 0.7, transparent: true, opacity: 0.85 }), algae));
  const floaters = [];
  const floatState = [];
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI * 2, d = pond.r * r() * 0.5;
    floatState.push({ x: pond.x + Math.cos(a) * d, z: pond.z + Math.sin(a) * d, rot: r() * 6, s: 0.02 + r() * 0.02, vx: (r() - 0.5) * 0.002, vz: (r() - 0.5) * 0.002 });
    floaters.push(new THREE.Matrix4());
  }
  const floatMesh = instanced(leafGeo, new THREE.MeshStandardMaterial({ color: 0x6f7d2e, roughness: 0.5, side: THREE.DoubleSide }), floaters);
  world.add(floatMesh);

  // ---- morning dew: drops on the plants (each one a mouthful of water to them)
  const dewSpots = [];
  for (const plant of tiny.plants.children) {
    const bb = new THREE.Box3().setFromObject(plant);
    for (let i = 0; i < 3 * density; i++) {
      const x = THREE.MathUtils.lerp(bb.min.x, bb.max.x, r()), z = THREE.MathUtils.lerp(bb.min.z, bb.max.z, r());
      const h = THREE.MathUtils.lerp(bb.min.y, bb.max.y, 0.15 + r() * 0.7);
      dewSpots.push({ p: new THREE.Vector3(x, h, z), s: 0.0012 + r() * 0.0022 });
    }
    // and one on the ground at the foot of the plant (reachable)
    const c = bb.getCenter(new THREE.Vector3());
    dewSpots.push({ p: new THREE.Vector3(c.x + 0.006, y(c.x + 0.006, c.z) + 0.002, c.z), s: 0.002, ground: true });
  }
  const dewMat = new THREE.MeshStandardMaterial({ color: 0xdfeef5, roughness: 0.0, metalness: 0.1, transparent: true, opacity: 0.6, envMapIntensity: 2.5 });
  const dew = instanced(new THREE.SphereGeometry(1, 10, 8), dewMat, dewSpots.map((d) => place(d.p.x, d.p.y, d.p.z, d.s).multiply(new THREE.Matrix4().makeScale(1, 0.8, 1))));
  world.add(dew);

  // ---- condensation on the glass: fog toward the top, drops that run down
  const condMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uFog: { value: 0.5 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime, uFog; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        // fog: thicker high up where warm air meets the cool glass
        float fog = uFog * smoothstep(0.45, 1.0, vUv.y) * (0.75 + 0.25 * sin(vUv.x * 23.0 + vUv.y * 7.0) * sin(vUv.x * 9.0 - vUv.y * 13.0));
        // drops: a grid of columns, each with a drop sliding down now and then, leaving a clear trail
        vec2 g = vec2(vUv.x * 160.0, vUv.y * 22.0);
        float col = floor(g.x);
        float speed = 0.04 + h(vec2(col, 1.0)) * 0.08;
        float pos = fract(-uTime * speed + h(vec2(col, 2.0)));
        float dy = vUv.y - pos;
        float fx = abs(fract(g.x) - 0.5);
        float drop = smoothstep(0.012, 0.0, abs(dy)) * smoothstep(0.35, 0.0, fx) * step(0.55, h(vec2(col, 3.0)));
        float trail = smoothstep(0.25, 0.0, fx) * step(0.0, dy) * smoothstep(0.25, 0.0, dy) * step(0.55, h(vec2(col, 3.0)));
        float a = clamp(fog * (1.0 - trail) * 0.18 + drop * 0.5, 0.0, 0.5);
        gl_FragColor = vec4(vec3(0.92, 0.95, 0.97), a);
      }`,
  });
  const condPlanes = [];
  if (glass) {
    const { w, h, d } = glass;
    for (const [px, pz, ry, len] of [[0, d / 2 - 0.012, Math.PI, w], [0, -d / 2 + 0.012, 0, w], [w / 2 - 0.012, 0, -Math.PI / 2, d], [-w / 2 + 0.012, 0, Math.PI / 2, d]]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.02, h - TANK.soilY - 0.02), condMat);
      pl.position.set(px, TANK.soilY + (h - TANK.soilY) / 2, pz);
      pl.rotation.y = ry;
      pl.userData.noCollide = true;
      pl.renderOrder = 2;
      cage.group.add(pl);
      condPlanes.push(pl);
    }
  }

  // ---- embers rising off the lava
  const EMBERS = Math.floor(60 * density);
  const emberPos = new Float32Array(EMBERS * 3);
  const emberLife = new Float32Array(EMBERS);
  const resetEmber = (i) => {
    const a = r() * Math.PI * 2, d = lava.r * Math.sqrt(r()) * 0.7;
    emberPos.set([lava.x + Math.cos(a) * d, TANK.soilY - lava.depth * 0.5, lava.z + Math.sin(a) * d], i * 3);
    emberLife[i] = r() * 2.5;
  };
  for (let i = 0; i < EMBERS; i++) resetEmber(i);
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({ color: 0xff8a2a, size: 0.003, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  embers.frustumCulled = false;
  world.add(embers);

  // ---- footprints left in the soil by tiny people (fade over a minute)
  const PRINTS = 160;
  const printMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x241a10, transparent: true, opacity: 0.35, depthWrite: false }), PRINTS);
  printMesh.count = 0;
  printMesh.userData.noCollide = true;
  printMesh.frustumCulled = false;
  world.add(printMesh);
  const prints = [];
  const lastStep = new Map();

  // ---- dust and hairs falling from you when you lean over the open top
  const FALL = 14;
  const fallers = [];
  const hairGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.012, 0.03, 0.004)]);
  for (let i = 0; i < FALL; i++) {
    const hair = i % 3 === 0;
    const o = hair
      ? new THREE.Line(hairGeo, new THREE.LineBasicMaterial({ color: 0x2b1d14 }))
      : new THREE.Mesh(new THREE.SphereGeometry(0.0012, 5, 4), new THREE.MeshBasicMaterial({ color: 0xbfb5a6 }));
    o.visible = false;
    o.userData.noCollide = true;
    world.add(o);
    fallers.push({ o, v: new THREE.Vector3(), on: false, rest: 0 });
  }

  const plants = tiny.plants.children.map((p) => ({ o: p, base: p.quaternion.clone(), tilt: 0, dir: new THREE.Vector3() }));
  let t = 0;
  let fallTimer = 2;

  return {
    dewSpots,
    // tiny people can drink morning dew instead of walking to the pond
    get dewVisible() { return dew.visible; }, // morning only
    dewNear(local, maxD) {
      if (!dew.visible) return null;
      let best = null, bd = maxD;
      for (const d of dewSpots) {
        if (!d.ground || d.drunk) continue;
        const dd = Math.hypot(d.p.x - local.x, d.p.z - local.z);
        if (dd < bd) { bd = dd; best = d; }
      }
      return best;
    },
    update(dt) {
      t += dt;
      const hour = getHour?.() ?? 9;
      // dew: there from before dawn, evaporating by mid-morning
      const dewAmount = THREE.MathUtils.smoothstep(hour, 3, 5) * (1 - THREE.MathUtils.smoothstep(hour, 8.5, 10.5));
      dew.visible = dewAmount > 0.02;
      dewMat.opacity = 0.6 * dewAmount;
      if (hour > 11 && hour < 12) for (const d of dewSpots) d.drunk = false; // a new morning later
      condMat.uniforms.uTime.value = t;
      condMat.uniforms.uFog.value = 0.25 + 0.55 * dewAmount;
      for (const p of condPlanes) p.visible = settings.get('graphics.preset') !== 'low';

      // floating leaves drift and turn slowly
      floatState.forEach((f, i) => {
        f.x += f.vx * dt; f.z += f.vz * dt; f.rot += dt * 0.05;
        if (Math.hypot(f.x - pond.x, f.z - pond.z) > pond.r * 0.62) { f.vx *= -1; f.vz *= -1; }
        floatMesh.setMatrixAt(i, place(f.x, cage.waterY + 0.0006 + Math.sin(t + i) * 0.0002, f.z, f.s, f.rot));
      });
      floatMesh.instanceMatrix.needsUpdate = true;

      // embers: rise, wander, fade
      for (let i = 0; i < EMBERS; i++) {
        emberLife[i] -= dt;
        if (emberLife[i] <= 0) { resetEmber(i); emberLife[i] = 1.5 + r() * 2; }
        emberPos[i * 3 + 1] += dt * 0.03;
        emberPos[i * 3] += Math.sin(t * 3 + i) * dt * 0.004;
      }
      emberGeo.attributes.position.needsUpdate = true;

      // grass and ferns lean away from anyone pushing through (and spring back)
      const people = [...cage.residents].filter((h) => !h.dead).map((h) => h.position);
      for (const pl of plants) {
        let push = 0;
        for (const pos of people) {
          const dx = pl.o.position.x - pos.x, dz = pl.o.position.z - pos.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.03) { push = Math.max(push, 1 - d / 0.03); pl.dir.set(dx, 0, dz).normalize(); }
        }
        pl.tilt += (push * 0.5 - pl.tilt) * (1 - Math.exp(-dt * (push > pl.tilt ? 10 : 3)));
        if (pl.tilt > 0.002) {
          const axis = new THREE.Vector3(pl.dir.z, 0, -pl.dir.x).normalize();
          pl.o.quaternion.copy(pl.base).premultiply(_q.setFromAxisAngle(axis, pl.tilt));
        } else pl.o.quaternion.copy(pl.base);
      }

      // footprints: one every ~2 cm (40 cm stride to them) while walking on soil
      for (const h of cage.residents) {
        if (h.dead) continue;
        const pos = h.position;
        const last = lastStep.get(h);
        if (last && Math.hypot(last.x - pos.x, last.z - pos.z) < 0.018) continue;
        lastStep.set(h, pos.clone());
        if (!dry(pos.x, pos.z) || !last) continue;
        const side = (prints.length % 2 ? 1 : -1) * 0.004;
        const dir = new THREE.Vector3(pos.x - last.x, 0, pos.z - last.z).normalize();
        prints.push({ x: pos.x + dir.z * side, z: pos.z - dir.x * side, yaw: Math.atan2(dir.x, dir.z), t: 0 });
        if (prints.length > PRINTS) prints.shift();
      }
      for (let i = prints.length - 1; i >= 0; i--) {
        prints[i].t += dt;
        if (prints[i].t > 60) prints.splice(i, 1);
      }
      prints.forEach((p, i) => {
        const fade = 1 - p.t / 60;
        printMesh.setMatrixAt(i, place(p.x, y(p.x, p.z) + 0.0004, p.z, 1, p.yaw).multiply(new THREE.Matrix4().makeScale(0.0016 * fade + 0.0004, 1, 0.0034 * fade + 0.0008)));
      });
      printMesh.count = prints.length;
      printMesh.instanceMatrix.needsUpdate = true;

      // you leaning over the open top: now and then a speck of dust or a hair drifts down
      const camLocal = cage.group.worldToLocal(camera.position.clone());
      const over = player.scale > 0.5 && Math.abs(camLocal.x) < TANK.w / 2 + 0.3 && Math.abs(camLocal.z) < TANK.d / 2 + 0.3 && camLocal.y > 0.9;
      fallTimer -= dt;
      if (over && fallTimer <= 0) {
        fallTimer = 3 + r() * 6;
        const f = fallers.find((x) => !x.on);
        if (f) {
          f.on = true; f.rest = 0;
          f.o.visible = true;
          f.o.position.set(THREE.MathUtils.clamp(camLocal.x, -1.3, 1.3), 1.0, THREE.MathUtils.clamp(camLocal.z, -0.8, 0.8));
          f.v.set((r() - 0.5) * 0.02, -0.06, (r() - 0.5) * 0.02);
        }
      }
      for (const f of fallers) {
        if (!f.on) continue;
        if (f.rest > 0) { f.rest += dt; if (f.rest > 40) { f.on = false; f.o.visible = false; } continue; }
        f.o.position.addScaledVector(f.v, dt);
        f.o.position.x += Math.sin(t * 2 + f.o.id) * dt * 0.01; // drifting on the air
        f.o.rotation.z += dt * 0.6;
        const g = y(f.o.position.x, f.o.position.z);
        if (f.o.position.y <= g + 0.001) { f.o.position.y = g + 0.001; f.rest = 0.001; }
      }
    },
  };
}
