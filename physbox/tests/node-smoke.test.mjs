// Node smoke test: bare imports resolve, Rapier runs, Earth data inflates.
import RAPIER from 'rapier';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { inflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { fbm3, latLonToUnit, unitToLatLon } from '../js/core/math.js';
await RAPIER.init();
const w = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
const b = w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 10, 0));
w.createCollider(RAPIER.ColliderDesc.ball(0.5), b);
for (let i = 0; i < 60; i++) w.step();
const topo = inflateSync(readFileSync(new URL('../data/earth-topo.bin', import.meta.url)));
const ll = unitToLatLon(latLonToUnit(38.9, -98.3));
console.log(JSON.stringify({ three: THREE.REVISION, rapierY: +b.translation().y.toFixed(2), topo: topo.length, noise: +fbm3(1, 2, 3).toFixed(3), ll, bgu: typeof BufferGeometryUtils }));
