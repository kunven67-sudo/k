// The flat world: endless grass, a big concrete build pad in the middle and a long runway for cars and planes.
import * as THREE from 'three';
import { scene } from './core/render.js';
import { texSet } from './core/mats.js';
import { R, world, owners, G, groups } from './core/physics.js';

export const PAD = 50;          // build pad half size (m)
export const LIMIT = 1900;      // how far you can go
export const ground = { collider: null };

function groundMat(name, tile, extra = {}) {
  const t = texSet(name);
  const m = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.arm, aoMap: t.arm, aoMapIntensity: 0.7, ...extra });
  // break up the repeating pattern: blend in a much bigger, blurrier copy of the same photo
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D( map, vMapUv );
          vec3 macroA = texture2D( map, vMapUv * 0.071 + vec2(0.31, 0.17) ).rgb;
          vec3 macroB = texture2D( map, vMapUv * 0.013 + vec2(0.7, 0.4) ).rgb;
          // two far-apart samples of the same photo: their difference averages out to zero, so this only adds big soft patches
          float lA = dot( macroA, vec3(0.333) ), lB = dot( macroB, vec3(0.333) );
          sampledDiffuseColor.rgb *= 0.78 + 0.44 * smoothstep( 0.0, 1.0, (lA - lB) * 3.0 + 0.5 );
          diffuseColor *= sampledDiffuseColor;
        #endif`);
  };
  m.customProgramCacheKey = () => 'ground-macro';
  return m;
}

function plane(w, h, tile, mat, y) {
  const g = new THREE.PlaneGeometry(w, h, 1, 1);
  g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * h / tile);
  const m = new THREE.Mesh(g, mat);
  m.position.y = y;
  m.receiveShadow = true;
  m.matrixAutoUpdate = false;
  m.updateMatrix();
  scene.add(m);
  return m;
}

export function buildWorld() {
  // grass to the horizon, with a real hole where the pad and runway are (no two floors in the same spot = no flicker)
  const outer = new THREE.Shape([new THREE.Vector2(-4500, -4500), new THREE.Vector2(4500, -4500), new THREE.Vector2(4500, 4500), new THREE.Vector2(-4500, 4500)]);
  const z = (x, zz) => new THREE.Vector2(x, -zz);
  outer.holes.push(new THREE.Path([z(-PAD, PAD), z(-PAD, -PAD), z(-15, -PAD), z(-15, -PAD - 600), z(15, -PAD - 600), z(15, -PAD), z(PAD, -PAD), z(PAD, PAD)]));
  const gg = new THREE.ShapeGeometry(outer);
  gg.rotateX(-Math.PI / 2);
  const guv = gg.attributes.uv;
  for (let i = 0; i < guv.count; i++) guv.setXY(i, guv.getX(i) / 6, guv.getY(i) / 6);
  gg.computeVertexNormals();
  const grass = new THREE.Mesh(gg, groundMat('grass', 6, { color: new THREE.Color('#c9d6b0') }));
  grass.receiveShadow = true;
  grass.matrixAutoUpdate = false;
  scene.add(grass);
  // concrete build pad (lifted a hair + polygon offset so it never flickers against the grass)
  const pad = groundMat('pad', 4, { color: new THREE.Color('#d8d8d8') });
  plane(PAD * 2, PAD * 2, 4, pad, 0.004);
  // runway north of the pad
  const asphalt = groundMat('asphalt', 5, { color: new THREE.Color('#bdbdbd') });
  const run = plane(30, 600, 5, asphalt, 0.004);
  run.position.set(0, 0.004, -PAD - 300);
  run.updateMatrix();
  // painted runway marks: real paint is just paint on asphalt, so they are thin flat strips
  const paint = new THREE.MeshStandardMaterial({ color: 0xe8e4d6, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const marks = new THREE.Group();
  for (let z = -PAD - 20; z > -PAD - 590; z -= 24) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 10).rotateX(-Math.PI / 2), paint);
    s.position.set(0, 0.012, z);
    marks.add(s);
  }
  for (const x of [-14, 14]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 590).rotateX(-Math.PI / 2), paint);
    s.position.set(x, 0.012, -PAD - 300);
    marks.add(s);
  }
  marks.traverse((o) => { o.receiveShadow = true; });
  scene.add(marks);
  // pad edge lines
  for (const [x, z, w, h] of [[0, -PAD + 0.2, PAD * 2, 0.4], [0, PAD - 0.2, PAD * 2, 0.4], [-PAD + 0.2, 0, 0.4, PAD * 2], [PAD - 0.2, 0, 0.4, PAD * 2]]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd9b23a, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    s.position.set(x, 0.012, z);
    s.receiveShadow = true;
    scene.add(s);
  }

  // physics ground: one big flat box, top at y = 0
  const rb = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0, -5, 0));
  ground.collider = world.createCollider(
    R.ColliderDesc.cuboid(4000, 5, 4000).setFriction(0.9).setRestitution(0.05)
      .setCollisionGroups(groups(G.WORLD, 0xffff)), rb);
  owners.set(ground.collider.handle, { kind: 'ground' });
}
