// Rick's portal gun, modeled after the reference picture: white body, tall glowing
// green dome, three green emitters in the front, red coordinate screen, dial knob,
// red side switch and the angled grip, held in Rick's hand with the lab coat sleeve.
import * as THREE from '../three.js';
import { G, mesh } from '../render/kit.js';
import { toon, makeCanvas, canvasTexture } from '../render/materials.js';
import { RoundedBoxGeometry } from '../../vendor/three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from '../../vendor/three/addons/utils/BufferGeometryUtils.js';
import { clamp, damp } from '../util.js';

const liquidShader = {
  uniforms: { time: { value: 0 }, level: { value: 1 }, glow: { value: 1 }, top: { value: 1.2 }, bottom: { value: 0.4 } },
  vertexShader: /* glsl */ `
    varying vec3 vPos;
    varying vec3 vN;
    varying vec3 vView;
    void main() {
      vPos = position;
      vN = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform float time;
    uniform float level;
    uniform float glow;
    uniform float top;
    uniform float bottom;
    varying vec3 vPos;
    varying vec3 vN;
    varying vec3 vView;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      float y = (vPos.y - bottom) / (top - bottom);
      float wave = 0.02 * sin(vPos.x * 18.0 + time * 3.0) + 0.02 * sin(vPos.z * 15.0 - time * 2.4);
      if (y > level + wave) discard;
      // bubbles rising
      vec2 g = vec2(atan(vPos.z, vPos.x) * 3.0, vPos.y * 9.0 - time * 1.6);
      vec2 id = floor(g);
      vec2 f = fract(g) - 0.5;
      float h = hash(id);
      float bub = step(0.72, h) * smoothstep(0.22, 0.12, length(f + vec2(h - 0.5, 0.0) * 0.4));
      float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 1.5);
      // only green goes over-bright: it blooms green instead of washing out to white
      vec3 deep = vec3(0.03, 0.58, 0.05);
      vec3 bright = vec3(0.22, 1.12, 0.16);
      vec3 c = mix(bright, deep, fres * 0.85);
      c += vec3(0.14, 0.35, 0.1) * bub;
      c += vec3(0.08, 0.2, 0.05) * smoothstep(0.85, 1.0, y / max(level, 0.01));
      gl_FragColor = vec4(c * (1.0 + glow * 0.3), 1.0);
    }`,
};

const glassShader = {
  uniforms: { tint: { value: new THREE.Color(0.75, 1.0, 0.75) } },
  vertexShader: /* glsl */ `
    varying vec3 vN;
    varying vec3 vView;
    varying vec3 vPos;
    void main() {
      vN = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vView = normalize(-mv.xyz);
      vPos = position;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 tint;
    varying vec3 vN;
    varying vec3 vView;
    varying vec3 vPos;
    void main() {
      float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.0);
      // a streak of highlight like in the reference render
      float streak = smoothstep(0.06, 0.0, abs(atan(vPos.z, vPos.x) - 2.35)) * 0.8;
      float a = 0.08 + fres * 0.55 + streak * 0.5;
      gl_FragColor = vec4(tint * (0.9 + streak), a);
    }`,
};

/** Black back-face shell that gives a mesh a cartoon outline. */
function outlineOf(geo, thickness) {
  const g = geo.clone();
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  const m = mergeVertices(g, 1e-4);
  m.computeVertexNormals();
  const mat = new THREE.ShaderMaterial({
    uniforms: { thickness: { value: thickness } },
    vertexShader: /* glsl */ `
      uniform float thickness;
      void main() {
        vec3 p = position + normal * thickness;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `void main() { gl_FragColor = vec4(0.08, 0.09, 0.1, 1.0); }`,
    side: THREE.BackSide,
  });
  return new THREE.Mesh(m, mat);
}

export class PortalGun {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.01, 10);
    this.root = new THREE.Group(); // animated holder
    this.model = new THREE.Group(); // the gun in its own units
    this.scene.add(this.root);
    this.root.add(this.model);
    this.model.scale.setScalar(0.09);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x9a9a8a, 1.6);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.5);
    this.sun.position.set(-0.3, 1, 0.6);
    this.scene.add(this.hemi, this.sun);
    this.domeLight = new THREE.PointLight(0x66ff44, 0.35, 0.14, 0);
    this.scene.add(this.domeLight);

    this.level = 1;
    this.shownLevel = 1;
    this.recoil = 0;
    this.dialAngle = 0;
    this.dialTarget = 0;
    this.switchT = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.equip = 0;
    this.visible = true;
    this.lowBlink = 0;
    this.flash = 0;
    this.t = 0;
    this.base = { x: 0.18, y: -0.185, z: -0.5, rx: 0.14, ry: 0.72, rz: -0.1 };
    this._build();
    this.setDisplay('C-137', 100, false);
  }

  _part(geo, mat, x, y, z, parent = this.model, o = null, outline = 0.018) {
    const m = mesh(geo, mat, x, y, z, parent, o);
    if (outline) {
      const ol = outlineOf(geo, outline);
      m.add(ol);
    }
    return m;
  }

  _build() {
    const white = toon(0xe1e5df);
    const light = toon(0xeef0ec);
    const grey = toon(0xbdc4be);
    const dark = toon(0x4d5450);
    const M = this.model;

    // main body
    const bodyGeo = new RoundedBoxGeometry(1.0, 0.74, 3.0, 3, 0.14);
    this._part(bodyGeo, white, 0, 0, 0);
    // panel line grooves along the sides
    for (const s of [-1, 1]) mesh(G.box(0.012, 0.016, 2.6), toon(0x9ea69f), s * 0.502, -0.2, 0.05, M);
    // front frame and recessed emitter panel
    const frame = new RoundedBoxGeometry(1.02, 0.76, 0.12, 2, 0.05);
    this._part(frame, light, 0, 0, -1.48);
    this._part(G.box(0.86, 0.58, 0.06), toon(0xc8ceca), 0, 0, -1.52, M, null, 0.01);
    this.nozzleMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.4, 0.35) });
    this.nozzles = [];
    for (const x of [-0.28, 0, 0.28]) {
      this._part(G.cyl(0.14, 0.14, 0.06, 20), toon(0x6c786e), x, 0, -1.55, M, { rx: Math.PI / 2 }, 0.01);
      const n = mesh(G.sphere(0.12, 20, 14), this.nozzleMat, x, 0, -1.57, M, { sz: 0.7 });
      this.nozzles.push(n);
    }

    // dome collar
    this._part(G.cyl(0.47, 0.49, 0.08, 32), light, 0, 0.41, -0.42);
    this._part(G.cyl(0.43, 0.45, 0.07, 32), grey, 0, 0.475, -0.42, M, null, 0.012);
    // liquid (tall capsule) + glass
    const liq = new THREE.Group();
    liq.position.set(0, 0, -0.42);
    M.add(liq);
    this.liquidMat = new THREE.ShaderMaterial({ ...liquidShader, uniforms: THREE.UniformsUtils.clone(liquidShader.uniforms), side: THREE.DoubleSide });
    this.liquidMat.uniforms.bottom.value = 0.5;
    this.liquidMat.uniforms.top.value = 1.62;
    // geometry is baked into the dome's space so the shader can cut it at the fluid level
    mesh(new THREE.CylinderGeometry(0.385, 0.385, 0.72, 40, 6, true).translate(0, 0.86, 0), this.liquidMat, 0, 0, 0, liq);
    mesh(new THREE.SphereGeometry(0.385, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.22, 0), this.liquidMat, 0, 0, 0, liq);
    mesh(new THREE.CircleGeometry(0.385, 40).rotateX(-Math.PI / 2).translate(0, 0.502, 0), this.liquidMat, 0, 0, 0, liq);
    this.glassMat = new THREE.ShaderMaterial({ ...glassShader, uniforms: THREE.UniformsUtils.clone(glassShader.uniforms), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const glassCyl = new THREE.CylinderGeometry(0.41, 0.41, 0.74, 40, 1, true);
    const glassTop = new THREE.SphereGeometry(0.41, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const g1 = mesh(glassCyl, this.glassMat, 0, 0.87, 0, liq);
    const g2 = mesh(glassTop, this.glassMat, 0, 1.24, 0, liq);
    g1.renderOrder = g2.renderOrder = 5;
    // outline around the dome silhouette
    liq.add(outlineOf(glassCyl, 0.016).translateY(0.87));
    liq.add(outlineOf(glassTop, 0.016).translateY(1.24));
    // soft green halo
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: 0x66ff44, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.set(2.8, 3.2, 1);
    halo.position.set(0, 1.0, 0);
    liq.add(halo);
    this.halo = halo;
    this.domeAnchor = liq;

    // coordinate display, tilted toward Rick
    const disp = new THREE.Group();
    disp.position.set(0, 0.4, 0.5);
    disp.rotation.x = 0.32;
    M.add(disp);
    this._part(new RoundedBoxGeometry(0.5, 0.09, 0.36, 2, 0.03), grey, 0, 0.03, 0, disp, null, 0.012);
    this.dispCanvas = makeCanvas(256, 160);
    this.dispTex = canvasTexture(this.dispCanvas);
    this.dispMat = new THREE.MeshBasicMaterial({ map: this.dispTex });
    this.dispMat.color.setScalar(1.5);
    mesh(G.plane(0.42, 0.27), this.dispMat, 0, 0.078, 0, disp, { rx: -Math.PI / 2 });

    // back housing + dial knob
    this._part(G.cyl(0.25, 0.27, 0.3, 24), white, 0, 0.3, 1.3);
    const knob = new THREE.Group();
    knob.position.set(0, 0.51, 1.3);
    M.add(knob);
    this._part(G.cyl(0.19, 0.19, 0.13, 24), dark, 0, 0, 0, knob, null, 0.012);
    mesh(G.cyl(0.15, 0.17, 0.03, 24), toon(0x8e9590), 0, 0.075, 0, knob);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      mesh(G.box(0.05, 0.11, 0.04), dark, Math.cos(a) * 0.195, 0, Math.sin(a) * 0.195, knob, { ry: -a });
    }
    mesh(G.box(0.03, 0.02, 0.12), toon(0xd8dcd6), 0, 0.09, -0.06, knob);
    this.knob = knob;

    // red side switch
    this._part(G.box(0.04, 0.13, 0.24), toon(0x2f3532), 0.5, 0.04, 0.55, M, null, 0.008);
    const sw = mesh(G.box(0.07, 0.065, 0.09), toon(0xd8382a), 0.53, 0.06, 0.6, M);
    sw.add(outlineOf(G.box(0.07, 0.06, 0.08), 0.008));
    this.switchMesh = sw;

    // the grip, angled down and back
    const dir = new THREE.Vector3(0, -0.5, 1).normalize();
    const grip = new THREE.Group();
    grip.position.set(0, -0.04, 1.28);
    grip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    M.add(grip);
    const gripGeo = new THREE.CapsuleGeometry(0.2, 1.0, 8, 20);
    this._part(gripGeo, white, 0, 0.62, 0, grip);
    this._part(G.cyl(0.24, 0.24, 0.12, 20), light, 0, 0.08, 0, grip, null, 0.012);
    this.grip = grip;

    this._buildHand(grip);
  }

  _buildHand(grip) {
    const skin = toon(0xdcd5c6);
    const coat = toon(0xf3f7f8);
    // grip-space: +Y runs along the handle toward the back, +Z is the underside
    const hand = new THREE.Group();
    hand.position.set(0, 0.7, 0);
    grip.add(hand);
    // palm wraps the right side
    this._part(new RoundedBoxGeometry(0.26, 0.5, 0.46, 3, 0.11), skin, 0.2, 0, 0.02, hand);
    // four fingers curled around the underside
    for (let i = 0; i < 4; i++) {
      const f = this._part(G.capsule(0.075, 0.24, 4, 10), skin, -0.03, 0.17 - i * 0.115, 0.2, hand, { rz: Math.PI / 2 }, 0.012);
      f.rotation.y = 0.35;
    }
    // thumb along the top-left
    this._part(G.capsule(0.07, 0.3, 4, 10), skin, -0.14, -0.05, -0.17, hand, { rx: 0.35, rz: 0.2 }, 0.012);
    // wrist, cuff and sleeve heading off-screen
    this._part(G.cyl(0.17, 0.18, 0.35, 16), skin, 0.12, 0.38, 0.0, hand, { rz: -0.25 }, 0.012);
    this._part(G.cyl(0.23, 0.23, 0.08, 16), toon(0x9fd3e6), 0.19, 0.6, 0.0, hand, { rz: -0.35 }, 0.012);
    const sleeveA = new THREE.Vector3(0.22, 0.62, 0.0);
    const sleeveB = new THREE.Vector3(1.6, 2.4, -0.4);
    const len = sleeveA.distanceTo(sleeveB);
    const sleeve = this._part(G.cyl(0.29, 0.36, len, 18), coat, 0, 0, 0, hand);
    sleeve.position.copy(sleeveA).lerp(sleeveB, 0.5);
    sleeve.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), sleeveB.clone().sub(sleeveA).normalize());
  }

  setDisplay(code, fluidPct, locked) {
    const key = `${code}|${Math.round(fluidPct)}|${locked}`;
    if (key === this._dispKey) return;
    this._dispKey = key;
    const g = this.dispCanvas.getContext('2d');
    g.fillStyle = '#2a0703';
    g.fillRect(0, 0, 256, 160);
    // dim segments behind the digits like a real LCD
    g.font = '700 72px "VT323", "Courier New", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,80,40,0.08)';
    g.fillText('88888', 128, 66);
    g.shadowColor = '#ff5a2a';
    g.shadowBlur = 14;
    g.fillStyle = locked ? '#ff9a2a' : '#ff6a3a';
    g.fillText(code, 128, 66);
    g.shadowBlur = 0;
    g.font = '700 30px "VT323", "Courier New", monospace';
    g.fillStyle = '#ff7a4a';
    g.fillText(locked ? 'LOCKED' : `FLUID ${String(Math.round(fluidPct)).padStart(3, ' ')}%`, 128, 128);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < 160; y += 4) g.fillRect(0, y, 256, 1);
    this.dispTex.needsUpdate = true;
  }

  dial(step) {
    this.dialTarget += step * (Math.PI / 4);
    this.switchT = 1;
  }

  fire() {
    this.recoil = 1;
    this.flash = 1;
  }

  /** nozzle position in world space (the main camera shares orientation with ours) */
  muzzleWorld(mainCamera, out = new THREE.Vector3()) {
    this.root.updateMatrixWorld(true);
    const p = this.nozzles[1].getWorldPosition(new THREE.Vector3());
    // our camera sits at the origin; map from its space into the main camera's
    return out.copy(p).applyMatrix4(mainCamera.matrixWorld);
  }

  update(dt, player, sprinting) {
    this.t += dt;
    this.camera.aspect = player.camera.aspect;
    this.camera.updateProjectionMatrix();
    // fluid gauge in the dome
    this.shownLevel += (this.level - this.shownLevel) * damp(5, dt);
    const u = this.liquidMat.uniforms;
    u.time.value = this.t;
    u.level.value = Math.max(0.02, this.shownLevel);
    this.flash = Math.max(0, this.flash - dt * 4);
    const low = this.level < 0.2;
    this.lowBlink += dt;
    const blink = low ? 0.5 + 0.5 * Math.sin(this.lowBlink * 10) : 1;
    u.glow.value = (0.6 + this.flash * 2.0) * blink;
    this.halo.material.opacity = (0.18 + 0.3 * this.shownLevel) * blink + this.flash * 0.35;
    this.nozzleMat.color.setRGB(0.4 + this.flash * 1.5, 2.2 + this.flash * 3, 0.35 + this.flash * 1.2);
    this.domeLight.intensity = 0.3 + this.flash * 0.9;

    // recoil, dial, switch
    this.recoil = Math.max(0, this.recoil - dt * 5);
    this.dialAngle += (this.dialTarget - this.dialAngle) * damp(14, dt);
    this.knob.rotation.y = this.dialAngle;
    this.switchT = Math.max(0, this.switchT - dt * 3);
    this.switchMesh.position.z = 0.6 - Math.sin(this.switchT * Math.PI) * 0.06;

    // sway follows the mouse, bob follows the walk
    const k = damp(10, dt);
    this.swayX += (clamp(-player.lookDX * 2.2, -0.12, 0.12) - this.swayX) * k;
    this.swayY += (clamp(-player.lookDY * 2.2, -0.1, 0.1) - this.swayY) * k;
    this.equip += ((this.visible ? 1 : 0) - this.equip) * damp(6, dt);
    const bob = player.bobAmt;
    const sprint = sprinting ? 1 : 0;
    this._sprint = (this._sprint || 0) + (sprint - (this._sprint || 0)) * damp(8, dt);
    const r = this.recoil * this.recoil;
    const B = this.base;
    this.root.position.set(
      B.x + Math.cos(player.bob) * 0.012 * bob + this.swayX * 0.12 - this._sprint * 0.05,
      B.y - Math.abs(Math.sin(player.bob)) * 0.014 * bob + this.swayY * 0.1 - (1 - this.equip) * 0.4 - this._sprint * 0.06,
      B.z + r * 0.07
    );
    this.root.rotation.order = 'YXZ';
    this.root.rotation.set(B.rx + r * 0.16 + this.swayY - this._sprint * 0.35, B.ry + this.swayX + this._sprint * 0.5, B.rz - this.swayX * 0.6 + this._sprint * 0.2);
    this.domeLight.position.copy(this.domeAnchor.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(0, 0.05, 0));
    this.scene.visible = this.equip > 0.02;
  }

  setLighting(hemiSky, hemiGround, hemiI, sunColor, sunI) {
    this.hemi.color.set(hemiSky);
    this.hemi.groundColor.set(hemiGround);
    this.hemi.intensity = hemiI;
    this.sun.color.set(sunColor);
    this.sun.intensity = sunI;
  }
}

let _halo = null;
function haloTexture() {
  if (_halo) return _halo;
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  _halo = canvasTexture(c);
  return _halo;
}

export { haloTexture };
