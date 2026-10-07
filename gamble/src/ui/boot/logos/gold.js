// Logo B: chunky gold G-A-M-B-L-E drop onto black lacquer one by one, wobble on real Rapier
// bodies (rotation locked to the screen plane so the word stays readable) with squash-and-
// stretch jiggle on every hit, then a shower of physics coins bounces off them.

import * as THREE from 'three';
import { RAPIER } from '../../../core/physics.js';
import { mat } from '../../../gfx/materials.js';
import { Stage, spring, fitDistance } from '../../three/stage.js';
import { createBokeh } from '../../three/bokeh.js';
import { letterGeometry, LETTER_HALF_WIDTH } from '../../three/letters.js';
import { uiSound, vary } from '../../sfx.js';

const WORD = ['G', 'A', 'M', 'B', 'L', 'E'];
const GAP = 0.42;

export async function runLogo(engine, root, skip, host) {
  const stage = new Stage(engine, { fov: 30, background: 0x040303, envIntensity: 1.0 });
  host.stage = stage;
  const { scene, camera, tier } = stage;

  // Black lacquer floor with a soft reflection of the room.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ color: 0x020202, roughness: 0.5, metalness: 0, envMapIntensity: 0.05 }));
  scene.fog = new THREE.Fog(0x040303, 18, 46);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  stage.own(floor.material);
  const bokeh = createBokeh({ count: Math.round(70 * tier.particlesScale) + 20, y: 5, z: [-14, -34], spreadX: 46 });
  scene.add(bokeh);
  stage.own(bokeh.material);

  scene.add(new THREE.HemisphereLight(0x806650, 0x050404, 0.4));
  const key = new THREE.SpotLight(0xfff0d8, 1400, 60, 0.42, 0.55, 2);
  key.position.set(-4, 16, 9);
  key.target.position.set(0, 1, 0);
  key.castShadow = tier.shadows;
  key.shadow.mapSize.setScalar(Math.min(2048, tier.shadowMapSize));
  key.shadow.bias = -0.0005;
  scene.add(key, key.target);
  const rim = new THREE.PointLight(0xff9a4a, 60, 30, 1.5);
  rim.position.set(6, 4, -6);
  scene.add(rim);

  // Physics (own small world, stepped at 60 Hz below).
  const world = new RAPIER.World({ x: 0, y: -24, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.5, 30).setTranslation(0, -0.5, 0).setFriction(0.8).setRestitution(0.3));
  // Invisible back stop so coins pile in front of the type instead of rolling away forever.
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 6, 0.5).setTranslation(0, 6, -3.2));

  const gold = mat('gold');
  const total = WORD.reduce((w, c) => w + LETTER_HALF_WIDTH[c] * 2, 0) + GAP * (WORD.length - 1);
  let x = -total / 2;
  const letters = WORD.map((ch, i) => {
    const hw = LETTER_HALF_WIDTH[ch];
    x += hw;
    const mesh = new THREE.Mesh(letterGeometry(ch, { curveSegments: tier.name === 'low' ? 10 : 20 }), gold);
    mesh.castShadow = mesh.receiveShadow = true;
    const pivot = new THREE.Group(); // jiggle scales around the letter's base
    const inner = new THREE.Group();
    inner.add(mesh);
    mesh.position.y = 1;
    pivot.add(inner);
    pivot.visible = false;
    scene.add(pivot);
    const L = { ch, mesh, pivot, inner, x, hw, body: null, squash: { x: 0, v: 0 }, landed: false, lastVy: 0 };
    x += hw + GAP;
    return L;
  });

  function drop(L, i) {
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(L.x, 9 + i * 0.2, 0)
        .setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (Math.random() - 0.5) * 0.22))
        .enabledRotations(false, false, true)
        .enabledTranslations(false, true, false) // stays in its slot: drops, bounces, wobbles
        .setAngularDamping(2.5)
        .setCcdEnabled(true),
    );
    world.createCollider(RAPIER.ColliderDesc.roundCuboid(L.hw - 0.08, 0.92, 0.25, 0.08).setTranslation(0, 1, 0).setDensity(3).setRestitution(0.35).setFriction(0.7), body);
    L.body = body;
    L.pivot.visible = true;
  }

  // Coins: one InstancedMesh, each instance a dynamic cylinder.
  const COINS = Math.round(46 * Math.max(0.5, tier.particlesScale));
  const coinGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.05, 20);
  stage.own(coinGeo);
  const coinMesh = new THREE.InstancedMesh(coinGeo, gold, COINS);
  coinMesh.castShadow = true;
  coinMesh.count = 0;
  scene.add(coinMesh);
  const coins = [];
  function burst() {
    for (let i = 0; i < COINS; i++) {
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation((Math.random() - 0.5) * total * 0.9, 9 + Math.random() * 6, (Math.random() - 0.5) * 1.2 + 0.6)
          .setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6)))
          .setAngvel({ x: (Math.random() - 0.5) * 20, y: (Math.random() - 0.5) * 20, z: (Math.random() - 0.5) * 20 })
          .setCcdEnabled(true),
      );
      world.createCollider(RAPIER.ColliderDesc.cylinder(0.025, 0.26).setDensity(8).setRestitution(0.45).setFriction(0.4), body);
      coins.push({ body, vy: 0 });
    }
    coinMesh.count = COINS;
  }

  const m4 = new THREE.Matrix4();
  const one = new THREE.Vector3(1, 1, 1);
  let acc = 0;
  let clinks = 0;
  stage.onUpdate((dt, time) => {
    acc += dt;
    let steps = 0;
    while (acc >= 1 / 60 && steps++ < 4) {
      world.step();
      acc -= 1 / 60;
    }
    for (const L of letters) {
      if (!L.body) continue;
      const p = L.body.translation();
      const r = L.body.rotation();
      const v = L.body.linvel();
      // Impact → squash proportional to how hard it hit, then spring back (jiggle).
      if (L.lastVy < -2 && v.y > L.lastVy + 2) {
        const hit = Math.min(1, -L.lastVy / 14);
        L.squash.v -= 9 * hit;
        if (!L.landed) uiSound('dice.hit-wall', { rate: 0.45 * vary(0.08), gain: 0.4 + hit * 0.6, bus: 'sfx' });
        L.landed = true;
      }
      L.lastVy = v.y;
      L.pivot.position.set(p.x, p.y, p.z);
      L.pivot.quaternion.set(r.x, r.y, r.z, r.w);
      const s = spring(L.squash, 0, dt, 260, 9);
      L.inner.scale.set(1 - s * 0.5, 1 + s, 1 - s * 0.5);
    }
    coins.forEach((c, i) => {
      const p = c.body.translation();
      const r = c.body.rotation();
      const v = c.body.linvel();
      if (c.vy < -3 && v.y > c.vy + 3 && clinks < 40 && Math.random() < 0.35) {
        clinks++;
        uiSound('coins.drop', { rate: vary(0.2) * 1.3, gain: 0.15, bus: 'sfx' });
      }
      c.vy = v.y;
      m4.compose(new THREE.Vector3(p.x, p.y, p.z), new THREE.Quaternion(r.x, r.y, r.z, r.w), one);
      coinMesh.setMatrixAt(i, m4);
    });
    if (coins.length) coinMesh.instanceMatrix.needsUpdate = true;
    bokeh.update(time, engine.height);
    const dist = Math.max(15.5, fitDistance(camera, total / 2 + 0.5, 3.2));
    camera.position.set(Math.sin(time * 0.25) * 0.8, 2.6 + (dist - 15.5) * 0.12, dist);
    // Keep the fog relative to the camera so pulled-back (portrait) framings don't fog the type.
    scene.fog.near = dist + 2;
    scene.fog.far = dist + 30;
    camera.lookAt(0, 1.3, 0);
  });

  await stage.wait(300, skip);
  for (let i = 0; i < letters.length && !skip.requested; i++) {
    drop(letters[i], i);
    await stage.wait(230, skip);
  }
  await stage.wait(1100, skip);
  if (!skip.requested) {
    burst();
    uiSound('logo.coins', { bus: 'sfx' });
  }
  await stage.wait(3000, skip);
  await engine.fade(true, skip.requested ? 250 : 700);
  stage.dispose();
  world.free();
}
