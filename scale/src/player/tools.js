// Hand tools: the RIFT shrink ray (right hand) and your phone (left hand).
import * as THREE from 'three';
import { prep } from '../render/materials.js';
import { input } from '../core/input.js';
import { bus } from '../core/events.js';

const SHRINK = new THREE.Color(0x2ef2ff);
const GROW = new THREE.Color(0xff2e88);

function m(geo, mat, parent, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}

// ---- RIFT shrink ray ------------------------------------------------------------------------------
export class ShrinkRay {
  constructor(game, player) {
    this.game = game;
    this.player = player;
    this.active = false;
    this.rate = 0.85; // e-folds per second (x2.3 per second)
    this.mode = 0; // -1 shrink, +1 grow, 0 idle
    this.blockedT = 0;
    this.target = null;

    // Model (built pointing -Z, ~26 cm long), parented to the right wrist so it follows the hand.
    const g = new THREE.Group();
    const dark = prep(new THREE.MeshStandardMaterial({ color: 0x17191f, roughness: 0.35, metalness: 0.6 }), { detail: 'metal' });
    const steel = prep(new THREE.MeshStandardMaterial({ color: 0x9aa1ab, roughness: 0.25, metalness: 1 }), { detail: 'metal' });
    this.glowMat = new THREE.MeshBasicMaterial({ color: SHRINK.clone().multiplyScalar(2.5), toneMapped: false });
    const body = m(new THREE.BoxGeometry(0.045, 0.06, 0.17), dark, g, 0, 0, -0.02);
    body.geometry.translate(0, 0, 0);
    m(new THREE.BoxGeometry(0.035, 0.09, 0.04), dark, g, 0, -0.065, 0.035).rotation.x = -0.25; // grip
    for (let i = 0; i < 4; i++) {
      const ring = m(new THREE.TorusGeometry(0.024, 0.006, 8, 18), steel, g, 0, 0.005, -0.12 - i * 0.022);
      ring.rotation.y = 0;
    }
    const barrel = m(new THREE.CylinderGeometry(0.014, 0.018, 0.12, 14), steel, g, 0, 0.005, -0.15);
    barrel.rotation.x = Math.PI / 2;
    this.crystal = m(new THREE.OctahedronGeometry(0.016, 0), this.glowMat, g, 0, 0.005, -0.215);
    this.crystal.castShadow = false;
    const strip = m(new THREE.BoxGeometry(0.047, 0.006, 0.1), this.glowMat, g, 0, 0.022, -0.02);
    strip.castShadow = false;
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0, 0.005, -0.235);
    g.add(this.muzzle);
    // Gun forward (-Z) along the forearm (-Y of the wrist), sitting in the palm.
    g.rotation.x = -Math.PI / 2;
    g.position.set(0, -0.085, -0.02);
    this.model = g;
    const wrist = player.model.userData.bones?.wristR;
    (wrist || player.model).add(g);

    // Beam: a camera-facing glowing strip from the muzzle to what it hits.
    const beamGeo = new THREE.PlaneGeometry(1, 1, 1, 24);
    beamGeo.translate(0, 0.5, 0);
    this.beamMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: SHRINK.clone() }, uFlash: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uFlash; varying vec2 vUv;
        void main(){
          float core = exp(-pow((vUv.x - 0.5) * 9.0, 2.0));
          float halo = exp(-pow((vUv.x - 0.5) * 3.2, 2.0)) * 0.35;
          float bands = 0.65 + 0.35 * sin(vUv.y * 60.0 - uTime * 30.0);
          vec3 c = mix(uColor, vec3(1.0, 0.2, 0.2), uFlash);
          gl_FragColor = vec4(c * (core * 3.0 + halo) * bands, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    this.beam = new THREE.Mesh(beamGeo, this.beamMat);
    this.beam.frustumCulled = false;
    this.beam.visible = false;
    game.scene.add(this.beam);
    // Glow where the beam lands.
    this.spot = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshBasicMaterial({ color: SHRINK.clone().multiplyScalar(2), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.spot.visible = false;
    game.scene.add(this.spot);
    this.setVisible(false);
  }

  setVisible(v) {
    this.model.visible = v;
    if (!v) {
      this.beam.visible = false;
      this.spot.visible = false;
      this.mode = 0;
      this.target?.endResize?.();
      this.target = null;
    }
  }

  update(dt, hands) {
    const pl = this.player;
    this.beamMat.uniforms.uTime.value += dt;
    this.blockedT = Math.max(0, this.blockedT - dt);
    this.beamMat.uniforms.uFlash.value = this.blockedT > 0 ? 1 : 0;
    const fire = input.down('fire'), alt = input.down('alt');
    this.mode = fire && !alt ? -1 : alt && !fire ? 1 : 0;
    const col = this.mode > 0 ? GROW : SHRINK;
    this.glowMat.color.copy(col).multiplyScalar(this.mode ? 4 : 2.2);
    this.crystal.rotation.y += dt * (this.mode ? 9 : 1.5);
    if (!this.mode) {
      this.beam.visible = false;
      this.spot.visible = false;
      this.target?.endResize?.();
      this.target = null;
      return;
    }
    // Beam from the muzzle to whatever the crosshair is on (max range ~60 body heights).
    const from = this.muzzle.getWorldPosition(new THREE.Vector3());
    const range = pl.height * 60;
    let to = hands.aimPoint.clone();
    if (to.distanceTo(from) > range) to = from.clone().add(to.sub(from).setLength(range));
    this._placeBeam(from, to, pl.height);
    this.beamMat.uniforms.uColor.value.copy(col);
    this.spot.material.color.copy(col).multiplyScalar(2);
    // Resize the target: only real things (props now; creatures and people use the same call).
    const hit = hands.aimHit;
    const tgt = hit && hit.owner && hit.dist <= range + pl.camDistM ? hit.owner : null;
    if (this.target && this.target !== tgt) this.target.endResize?.();
    this.target = tgt;
    if (tgt && typeof tgt.setScale === 'function' && !tgt.immuneToRay) {
      tgt.beginResize?.();
      const ns = tgt.scale * Math.exp(this.mode * this.rate * dt);
      const ok = tgt.setScale(ns, { force: input.down('force') });
      if (!ok && this.blockedT <= 0) {
        this.blockedT = 0.35;
        bus.emit('toast', `No room for the ${tgt.name} to grow`);
      }
    }
  }

  _placeBeam(from, to, H) {
    const cam = this.game.camera;
    const dir = to.clone().sub(from);
    const len = dir.length();
    if (len < 1e-6) {
      this.beam.visible = false;
      return;
    }
    dir.divideScalar(len);
    // Billboard around the beam axis so it always faces the camera.
    const toCam = cam.position.clone().sub(from);
    const side = new THREE.Vector3().crossVectors(dir, toCam).normalize();
    const normal = new THREE.Vector3().crossVectors(side, dir).normalize();
    const mtx = new THREE.Matrix4().makeBasis(side, dir, normal);
    const w = H * 0.035;
    mtx.scale(new THREE.Vector3(w, len, 1));
    mtx.setPosition(from);
    this.beam.matrixAutoUpdate = false;
    this.beam.matrix.copy(mtx);
    this.beam.matrixWorldNeedsUpdate = true;
    this.beam.visible = true;
    this.spot.position.copy(to);
    this.spot.scale.setScalar(H * 0.05 * (1 + 0.2 * Math.sin(this.beamMat.uniforms.uTime.value * 25)));
    this.spot.visible = true;
  }
}

// ---- phone ------------------------------------------------------------------------------------------
export class Phone {
  constructor(game, player) {
    this.game = game;
    this.player = player;
    this.active = false;
    const g = new THREE.Group();
    const caseMat = prep(new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.4, metalness: 0.5 }), { detail: 'plastic' });
    this.screenMat = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, toneMapped: false });
    m(new THREE.BoxGeometry(0.072, 0.15, 0.008), caseMat, g);
    const screen = m(new THREE.PlaneGeometry(0.066, 0.142), this.screenMat, g, 0, 0, -0.0042);
    screen.rotation.y = Math.PI;
    screen.castShadow = false;
    g.rotation.set(-0.6, Math.PI, 0);
    g.position.set(0, -0.11, -0.02);
    this.model = g;
    const wrist = player.model.userData.bones?.wristL;
    (wrist || player.model).add(g);
    this.setVisible(false);
  }

  setVisible(v) {
    this.model.visible = v;
  }

  update() {}
}
