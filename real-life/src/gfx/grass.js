// Real grass blades on the lawns around you (the ground texture alone looks like carpet).
// A grid of grass tufts follows you; each tuft's spot is fixed in the world (hashed from its
// cell), so grass doesn't swim when you walk. Only lawns get grass: never roads, sidewalks,
// driveways, inside houses or stores. It sways in the wind, thins out at the edge of the patch,
// turns yellow-brown in fall and is gone under winter's dead lawn. Settings > Grass turns it off.
//
//   const grass = new Grass(world); grass.update(viewerPos)

import * as THREE from 'three';
import { clock } from '../core/clock.js';
import { CURB, BOUNDS } from '../world/layout.js';

const uTime = { value: 0 };

function bladeTexture() {
  const W = 256;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {
    const x = 20 + rnd() * (W - 40);
    const h = H * (0.45 + rnd() * 0.55) * (1 - Math.abs(x - W / 2) / W);
    const lean = (rnd() - 0.5) * 60;
    const w = 3 + rnd() * 4;
    const grad = g.createLinearGradient(0, H, 0, H - h);
    // Close to the lawn texture's own colour so the blades blend in instead of reading as
    // dark clover blotches.
    const l = 0.88 + rnd() * 0.24;
    grad.addColorStop(0, `rgb(${Math.round(92 * l)},${Math.round(116 * l)},${Math.round(56 * l)})`);
    grad.addColorStop(1, `rgb(${Math.round(136 * l)},${Math.round(162 * l)},${Math.round(84 * l)})`);
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x - w, H);
    g.quadraticCurveTo(x + lean * 0.3, H - h * 0.6, x + lean, H - h);
    g.quadraticCurveTo(x + lean * 0.3 + w * 0.3, H - h * 0.6, x + w, H);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function tuftGeometry() {
  // Two crossed quads, 26 cm wide, 13 cm tall (a mowed lawn); normals straight up so tufts light like the lawn.
  const parts = [];
  for (const a of [0, Math.PI / 2]) {
    const g = new THREE.PlaneGeometry(0.26, 0.13);
    g.translate(0, 0.065, 0);
    g.rotateY(a);
    parts.push(g);
  }
  const pos = [];
  const uv = [];
  const idx = [];
  let base = 0;
  for (const g of parts) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      uv.push(g.attributes.uv.getX(i), g.attributes.uv.getY(i));
    }
    for (const i of g.index.array) idx.push(base + i);
    base += p.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill(0).flatMap(() => [0, 1, 0]), 3));
  geo.setIndex(idx);
  return geo;
}

function hash(x, z) {
  let h = (x * 374761393 + z * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class Grass {
  constructor(world, { radius = 14, spacing = 0.2 } = {}) {
    this.world = world;
    this.spacing = spacing;
    this.radius = radius;
    this.half = Math.ceil(radius / spacing);
    const n = (this.half * 2 + 1) ** 2;
    const mat = new THREE.MeshStandardMaterial({ map: bladeTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1, metalness: 0 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uGrassTime = uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uGrassTime;').replace(
        '#include <project_vertex>',
        `{
          vec4 wp = vec4( transformed, 1.0 );
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp;
          #endif
          float k = uv.y * uv.y;
          float ph = uGrassTime * 2.1 + wp.x * 0.7 + wp.z * 0.5;
          transformed.x += sin( ph ) * 0.035 * k;
          transformed.z += cos( ph * 0.9 ) * 0.025 * k;
        }
        #include <project_vertex>`,
      );
      sh.fragmentShader = sh.fragmentShader.replace('normal *= faceDirection;', '');
    };
    mat.customProgramCacheKey = () => 'grass-v1';
    this.mat = mat;
    this.mesh = new THREE.InstancedMesh(tuftGeometry(), mat, n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    world.scene.add(this.mesh);
    this.center = null;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
    this._season = null;
    this.enabled = true;
  }

  setEnabled(on) {
    this.enabled = on;
    this.mesh.visible = on && clock.season !== 'winter';
  }

  update(viewer) {
    uTime.value = performance.now() / 1000;
    if (!this.enabled) return;
    const season = clock.season;
    if (season !== this._season) {
      this._season = season;
      this.mat.color.set(season === 'fall' ? 0xd8c27a : season === 'spring' ? 0xeaffd8 : 0xffffff);
      this.mesh.visible = season !== 'winter';
      this.center = null;
    }
    if (!this.mesh.visible) return;
    const s = this.spacing;
    const cx = Math.round(viewer.x / s);
    const cz = Math.round(viewer.z / s);
    if (this.center && Math.abs(cx - this.center[0]) * s < 1.2 && Math.abs(cz - this.center[1]) * s < 1.2) return;
    this.center = [cx, cz];
    const w = this.world;
    const H = this.half;
    const R2 = this.radius * this.radius;
    let i = 0;
    const p = this._p;
    for (let gx = -H; gx <= H; gx++)
      for (let gz = -H; gz <= H; gz++) {
        const ax = cx + gx;
        const az = cz + gz;
        const h1 = hash(ax, az);
        const h2 = hash(az + 91, ax - 37);
        p.set((ax + (h1 - 0.5) * 0.9) * s, CURB, (az + (h2 - 0.5) * 0.9) * s);
        const dx = p.x - viewer.x;
        const dz = p.z - viewer.z;
        const d2 = dx * dx + dz * dz;
        let scale = 0;
        if (d2 < R2 && p.x > BOUNDS.x0 && p.x < BOUNDS.x1 && p.z > BOUNDS.z0 && p.z < BOUNDS.z1 && w.surfaceAt(p) === 'grass') {
          const edge = 1 - Math.sqrt(d2) / this.radius;
          scale = Math.min(1, edge * 4) * (0.7 + h1 * 0.6);
        }
        this._q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, h2 * Math.PI * 2);
        this._s.set(scale, scale * (0.75 + h2 * 0.4), scale);
        this._m.compose(p, this._q, this._s);
        this.mesh.setMatrixAt(i, this._m);
        this._c.setRGB(0.92 + h1 * 0.22, 0.95 + h2 * 0.15, 0.85 + h1 * 0.15);
        this.mesh.setColorAt(i, this._c);
        i++;
      }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.world.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
  }
}
