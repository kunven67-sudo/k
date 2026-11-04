// Pictures of every part for the parts menu: the real 3D part with its real materials, rendered once at start.
import * as THREE from 'three';
import { renderer, scene as mainScene } from '../core/render.js';
import { LIST, DEFS } from '../parts/defs.js';

export const thumbs = {};
const S = 128;

export function makeThumbs(personMeshes = {}) {
  const sc = new THREE.Scene();
  sc.environment = mainScene.environment;
  sc.environmentIntensity = 1.1;
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 5, 4);
  sc.add(key);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  const out = document.createElement('canvas');
  out.width = out.height = S;
  const g = out.getContext('2d');
  const size = renderer.getSize(new THREE.Vector2());
  const pr = renderer.getPixelRatio();
  const oldClear = renderer.getClearColor(new THREE.Color()), oldAlpha = renderer.getClearAlpha();
  const oldTone = renderer.toneMappingExposure;
  renderer.setPixelRatio(1);
  renderer.setSize(S, S, false);
  renderer.setClearColor(0x23262c, 1);
  renderer.toneMappingExposure = 1;
  const wasXR = renderer.xr.enabled;
  renderer.xr.enabled = false;
  for (const d of LIST) {
    let obj;
    if (d.person) {
      obj = personMeshes[d.person] ? personMeshes[d.person]() : null;
      if (!obj) continue;
    } else {
      const stub = { def: d, size: new THREE.Vector3(...d.size), props: Object.fromEntries(d.props.map((p) => [p.k, p.def])), mat: d.mat, color: d.color || null, st: {}, pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
      obj = d.mesh(stub, null);
      if (d.joint) {
        const R = DEFS[d.joint.rotor];
        const rm = R.mesh({ def: R, size: new THREE.Vector3(...d.joint.rotorSize(stub)), props: {}, mat: d.mat, color: d.color, st: {} }, null);
        rm.position.y = d.joint.at(stub) + d.joint.rotorAt(stub);
        obj.add(rm);
      }
    }
    obj.traverse((o) => { if (o.userData && o.userData.flame) o.userData.flame.visible = false; });
    // hide effect-only bits (beams, bubbles) so the picture shows the part itself
    obj.traverse((o) => { if (o.material && o.material.isShaderMaterial) o.visible = false; });
    const pivot = new THREE.Group();
    pivot.add(obj);
    sc.add(pivot);
    const box = new THREE.Box3().setFromObject(obj);
    const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2 || 0.5;
    obj.position.sub(c);
    pivot.rotation.y = -0.6;
    const dist = r / Math.sin(THREE.MathUtils.degToRad(15)) * 1.05;
    cam.position.set(dist * 0.62, dist * 0.5, dist * 0.6);
    cam.lookAt(0, 0, 0);
    renderer.render(sc, cam);
    g.clearRect(0, 0, S, S);
    g.drawImage(renderer.domElement, 0, 0, S, S);
    thumbs[d.id] = out.toDataURL('image/png');
    sc.remove(pivot);
  }
  renderer.xr.enabled = wasXR;
  renderer.setPixelRatio(pr);
  renderer.setSize(size.x, size.y, false);
  renderer.setClearColor(oldClear, oldAlpha);
  renderer.toneMappingExposure = oldTone;
}
