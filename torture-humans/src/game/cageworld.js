// The tiny world inside the terrarium (built in the terrarium's local space, meters).
// To a 9 cm person: hills, a pond, a lava pit, boulders (pebbles), fallen logs
// (twigs), forests (grass and ferns). The ground is a real heightfield; rocks and
// logs have exact colliders; tiny people get their own navmesh at their scale.
import * as THREE from 'three';
import { pbr, place } from './engine/assets.js';
import { Water } from 'three/addons/objects/Water2.js';

export const TANK = { w: 2.96, d: 1.86, soilY: 0.13 };

// smooth value noise (deterministic from the seed)
function makeNoise(seed = 7) {
  const rnd = (x, z) => {
    const s = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const smooth = (t) => t * t * (3 - 2 * t);
  const n2 = (x, z) => {
    const xi = Math.floor(x), zi = Math.floor(z);
    const xf = smooth(x - xi), zf = smooth(z - zi);
    const a = rnd(xi, zi), b = rnd(xi + 1, zi), c = rnd(xi, zi + 1), d = rnd(xi + 1, zi + 1);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, xf), THREE.MathUtils.lerp(c, d, xf), zf);
  };
  return (x, z) => n2(x, z) * 0.5 + n2(x * 2.1, z * 2.1) * 0.3 + n2(x * 4.3, z * 4.3) * 0.2;
}

export const FEATURES = {
  pond: { x: 0.75, z: -0.35, r: 0.28, depth: 0.045 },
  lava: { x: -0.95, z: 0.45, r: 0.16, depth: 0.035 },
  hill: { x: -0.55, z: -0.45, r: 0.45, h: 0.09 },
};

// ground height (terrarium local, relative to the soil top) at x,z
export function makeHeight(seed = 7) {
  const noise = makeNoise(seed);
  const { pond, lava, hill } = FEATURES;
  return (x, z) => {
    let h = (noise(x * 3.2 + 10, z * 3.2 + 10) - 0.5) * 0.035;
    const dh = Math.hypot(x - hill.x, z - hill.z) / hill.r;
    if (dh < 1) h += hill.h * Math.pow(Math.cos((dh * Math.PI) / 2), 2);
    for (const pit of [pond, lava]) {
      const dp = Math.hypot(x - pit.x, z - pit.z) / pit.r;
      if (dp < 1.25) h -= pit.depth * Math.pow(Math.cos(Math.min(1, dp / 1.25) * Math.PI / 2), 1.5);
    }
    // flatten toward the glass so nothing floats against the walls
    const edge = Math.min(TANK.w / 2 - Math.abs(x), TANK.d / 2 - Math.abs(z));
    return h * THREE.MathUtils.smoothstep(edge, 0.0, 0.08);
  };
}

function groundMesh(heightAt) {
  const segX = 240, segZ = 150;
  const g = new THREE.PlaneGeometry(TANK.w, TANK.d, segX, segZ);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  const colors = new Float32Array(pos.count * 3);
  const { pond, lava } = FEATURES;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = heightAt(x, z);
    pos.setY(i, TANK.soilY + y);
    uv.setXY(i, x, z); // meters
    // tint: damp dark soil by the pond, scorched near the lava, lighter on the hill
    const dPond = Math.hypot(x - pond.x, z - pond.z) / pond.r;
    const dLava = Math.hypot(x - lava.x, z - lava.z) / lava.r;
    let r = 1, gg = 1, b = 1;
    if (dPond < 1.6) { const k = 1 - Math.max(0, dPond - 0.9) / 0.7; r -= 0.35 * k; gg -= 0.3 * k; b -= 0.25 * k; }
    if (dLava < 1.8) { const k = 1 - Math.max(0, dLava - 1) / 0.8; r = r * (1 - 0.55 * k) + 0.05 * k; gg *= 1 - 0.7 * k; b *= 1 - 0.75 * k; }
    r += y * 2; gg += y * 2; b += y * 1.5;
    colors.set([r, gg, b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setAttribute('uv1', uv.clone());
  g.computeVertexNormals();
  const mat = pbr('forest_ground_04', { size: 0.35 });
  mat.vertexColors = true;
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  m.name = 'tiny-ground';
  return m;
}

// procedural ripple normals for the pond (no image files needed)
function rippleNormal(seed = 3) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const noise = makeNoise(seed);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const h = (u, v) => noise((u / size) * 8, (v / size) * 8);
      const dx = h(x + 1, y) - h(x - 1, y);
      const dy = h(x, y + 1) - h(x, y - 1);
      const n = new THREE.Vector3(-dx * 6, -dy * 6, 1).normalize();
      const i = (y * size + x) * 4;
      img.data[i] = (n.x * 0.5 + 0.5) * 255;
      img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      img.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// soft shoreline: opaque in the deep middle, fading out where the water gets shallow
function shoreAlpha() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, '#fff');
  grd.addColorStop(0.62, '#fff');
  grd.addColorStop(0.86, '#777');
  grd.addColorStop(1, '#000');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

// Mirror-and-see-through pond water (Water2: planar reflection + refraction),
// with our own finish: murkier toward the deep middle, see-through at the shore.
const POND_SHADER = (() => {
  const base = Water.WaterShader;
  const frag = base.fragmentShader
    .replace('uniform vec3 color;', 'uniform vec3 color;\nuniform vec3 deepColor;')
    .replace('gl_FragColor = vec4( color, 1.0 ) * mix( refractColor, reflectColor, reflectance );', `
      float d = length( vUv - 0.5 ) * 2.0;                       // 0 middle .. 1 shore
      float depth = 1.0 - smoothstep( 0.45, 1.0, d );
      vec3 below = mix( refractColor.rgb, refractColor.rgb * deepColor, depth * 0.9 );
      vec3 col = mix( below, reflectColor.rgb, reflectance );
      float alpha = 1.0 - smoothstep( 0.8, 1.0, d );
      gl_FragColor = vec4( color * col, alpha );`);
  return { ...base, name: 'PondWater', fragmentShader: frag, uniforms: { ...base.uniforms, deepColor: { value: new THREE.Color(0x2c4a3c) } } };
})();

const REFLECTION_SIZE = { off: 0, low: 256, medium: 512, high: 1024 };

function pondMesh(heightAt, { reflections = 'high' } = {}) {
  const { pond } = FEATURES;
  const size = REFLECTION_SIZE[reflections] ?? 512;
  if (size > 0) {
    const n0 = rippleNormal();
    const n1 = rippleNormal(9);
    const water = new Water(new THREE.CircleGeometry(pond.r * 1.1, 64), {
      color: 0xdfeee6, scale: 4, flowDirection: new THREE.Vector2(0.6, 0.35), flowSpeed: 0.02,
      reflectivity: 0.06, textureWidth: size, textureHeight: size, clipBias: 0.0005,
      normalMap0: n0, normalMap1: n1, shader: POND_SHADER,
    });
    water.material.depthWrite = false;
    water.rotation.x = -Math.PI / 2;
    water.position.set(pond.x, TANK.soilY - pond.depth * 0.45, pond.z);
    water.name = 'tiny-pond';
    water.userData.noCollide = true;
    return water;
  }
  const nm = rippleNormal();
  nm.repeat.set(3, 3);
  // pond water: dark and deep in the middle, reflecting the room, faint ripples
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x1d2f2b, roughness: 0.02, metalness: 0, transmission: 0.35, thickness: 0.05, ior: 1.33,
    attenuationColor: new THREE.Color(0x24463b), attenuationDistance: 0.04,
    specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.02,
    transparent: true, opacity: 0.95, normalMap: nm, normalScale: new THREE.Vector2(0.18, 0.18), envMapIntensity: 2.2,
    alphaMap: shoreAlpha(), depthWrite: false,
  });
  const water = new THREE.Mesh(new THREE.CircleGeometry(pond.r * 1.1, 64), mat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(pond.x, TANK.soilY - pond.depth * 0.45, pond.z);
  water.name = 'tiny-pond';
  water.userData.noCollide = true;
  water.userData.update = (t) => { nm.offset.set(t * 0.02, t * 0.013); };
  return water;
}

// glowing, slowly churning lava (emissive + animated crust)
function lavaMesh() {
  const { lava } = FEATURES;
  const mat = new THREE.MeshStandardMaterial({ color: 0x1a0500, emissive: 0xff4a0a, emissiveIntensity: 2.2, roughness: 0.9 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = { value: 0 };
    mat.userData.shader = sh;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPosW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvPosW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uTime; varying vec3 vPosW;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ vec2 q = vPosW.xz * 60.0; float n = vn(q + uTime*0.35) * 0.6 + vn(q*2.3 - uTime*0.2) * 0.4;
  float crust = smoothstep(0.45, 0.62, n);
  totalEmissiveRadiance *= mix(1.6, 0.08, crust);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05,0.03,0.02), crust); }`);
  };
  const m = new THREE.Mesh(new THREE.CircleGeometry(lava.r * 1.05, 64), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(lava.x, TANK.soilY - lava.depth * 0.5, lava.z);
  m.name = 'tiny-lava';
  m.userData.noCollide = true;
  m.userData.update = (t) => { if (mat.userData.shader) mat.userData.shader.uniforms.uTime.value = t; };
  const light = new THREE.PointLight(0xff5a1a, 0.6, 0.6, 2);
  light.position.set(0, 0, 0.05); // the disc is turned flat, so local +Z is up
  m.add(light);
  return m;
}

// seeded random scatter that avoids the pond, lava and glass
function scatter(count, seed, avoid = 0.06) {
  const out = [];
  let s = seed;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const { pond, lava } = FEATURES;
  for (let tries = 0; out.length < count && tries < count * 40; tries++) {
    const x = (r() - 0.5) * (TANK.w - 0.12);
    const z = (r() - 0.5) * (TANK.d - 0.12);
    if (Math.hypot(x - pond.x, z - pond.z) < pond.r * 1.2 + avoid) continue;
    if (Math.hypot(x - lava.x, z - lava.z) < lava.r * 1.4 + avoid) continue;
    out.push({ x, z, rot: r() * Math.PI * 2, k: r() });
  }
  return out;
}

export async function buildTinyWorld(terrarium, { reflections = 'high' } = {}) {
  const world = new THREE.Group();
  world.name = 'tiny-world';
  terrarium.add(world);
  const heightAt = makeHeight(7);
  const ground = groundMesh(heightAt);
  world.add(ground);
  world.add(pondMesh(heightAt, { reflections }));
  world.add(lavaMesh());

  const solid = new THREE.Group();    // rocks and logs: exact colliders, block tiny people
  const plants = new THREE.Group();   // grass and ferns: you walk through them (like tall grass)
  solid.name = 'tiny-solid';
  plants.name = 'tiny-plants';
  world.add(solid, plants);
  const y = (x, z) => TANK.soilY + heightAt(x, z);

  // boulders (pebbles to us), some half buried
  const rockIds = ['coast_rocks_01', 'coast_rocks_02', 'boulder_01', 'namaqualand_boulder_02'];
  for (const [i, p] of scatter(18, 11, 0.05).entries()) {
    const size = 0.02 + p.k * p.k * 0.07;
    const r = await place(solid, rockIds[i % rockIds.length], { x: p.x, y: y(p.x, p.z) - size * 0.25, z: p.z, rotY: p.rot, width: size });
    r.name = 'tiny-rock';
  }
  // fallen logs (twigs to us): resources once someone has an axe
  for (const p of scatter(6, 23, 0.08)) {
    const log = await place(solid, p.k > 0.5 ? 'dead_tree_trunk' : 'tree_stump_01', { x: p.x, y: y(p.x, p.z) - 0.004, z: p.z, rotY: p.rot, width: p.k > 0.5 ? 0.22 : 0.06 });
    log.name = 'tiny-log';
    log.userData.resource = 'wood';
  }
  await place(solid, 'bark_debris_01', { x: 0.1, y: y(0.1, 0.55), z: 0.55, width: 0.12 });
  // a "forest" of grass and ferns on the hill and around the pond
  const plantIds = ['grass_medium_01', 'grass_medium_02', 'fern_02', 'grass_bermuda_01', 'dandelion_01', 'nettle_plant'];
  for (const [i, p] of scatter(34, 37, 0.02).entries()) {
    const id = plantIds[i % plantIds.length];
    const h = id === 'fern_02' ? 0.18 + p.k * 0.1 : 0.06 + p.k * 0.08; // 60 cm - 2 m "trees" to a 9 cm person
    const plant = await place(plants, id, { x: p.x, y: y(p.x, p.z) - 0.003, z: p.z, rotY: p.rot, height: h });
    plant.traverse((o) => { if (o.isMesh) o.userData.noCollide = true; });
  }

  // animated bits (pond ripples, lava); collected once, ticked every frame
  const animated = [];
  world.traverse((o) => { if (o !== world && o.userData.update) animated.push(o); });
  const t0 = performance.now();
  world.userData.tick = () => {
    const t = (performance.now() - t0) / 1000;
    for (const o of animated) o.userData.update(t);
  };
  return { world, ground, solid, plants, heightAt, features: FEATURES, surfaceY: y };
}
