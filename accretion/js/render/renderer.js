// Turns the simulation into pictures. Everything is drawn relative to the
// camera and scaled by your size, so 3 km rocks and black holes both work.
import * as THREE from 'three';
import { EffectComposer } from '../vendor/three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from '../vendor/three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from '../vendor/three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SurfaceBaker } from './bake.js';
import { makePlanetMaterial, makeAtmosphereMaterial, makeCloudMaterial, makeRingMaterial, PTYPE } from './planetMaterial.js';
import { makeStarMaterial, makeGlowMaterial, makeDiskMaterial, makeBeamMaterial, makeNeutronMaterial } from './starMaterials.js';
import { Sky } from './sky.js';
import { DiskCloud, Motes, Effects, Rocks } from './particles.js';
import { LensShader, FinalShader, ClampShader } from './post.js';
import { computeLook } from './look.js';
import { blackbody, clamp, lerp } from '../core/phys.js';
import { DIST_COMPRESS, AU_REAL, M_JUP, TIME_BASE } from '../core/constants.js';

export class Renderer {
  constructor(canvas, galaxy, settings) {
    this.settings = settings;
    const quality = settings.quality;
    this.quality = quality;
    this.gl = new THREE.WebGLRenderer({
      canvas,
      antialias: quality !== 'low',
      logarithmicDepthBuffer: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.gl.toneMapping = THREE.NoToneMapping;
    this.gl.setClearColor(0x000000, 1);
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : quality === 'low' ? 1 : 1.5);
    this.gl.setPixelRatio(this.pixelRatio);

    this.shared = { uTime: { value: 0 }, uExposure: { value: 1 } };
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 1e-3, 1e14);
    this.camera.position.set(0, 0, 0);
    this.scene.add(this.camera);

    this.baker = new SurfaceBaker(this.gl);
    this.sky = new Sky(this.gl, galaxy, this.shared, quality);
    this.scene.background = this.sky.texture;
    this.sky.onSwap = (tex) => { this.scene.background = tex; };
    this.scene.add(this.sky.systemPoints);

    this.motes = new Motes(this.shared, quality === 'low' ? 500 : 900);
    this.scene.add(this.motes.lines);
    this.fx = new Effects(this.shared, quality === 'low' ? 8000 : 16000);
    this.scene.add(this.fx.glowPts, this.fx.dustPts);
    this.rocks = new Rocks(this.shared, 1200);
    this.scene.add(this.rocks.mesh);
    this.dots = this.makeDots(2000);
    this.scene.add(this.dots);

    this.views = new Map();
    this.disks = new Map();
    this.geoCache = new Map();
    this.ringGeo = new THREE.RingGeometry(1, 3, 128, 1);
    this.diskGeo = new THREE.RingGeometry(1, 6, 192, 6);
    this.glowGeo = new THREE.PlaneGeometry(2, 2);
    this.beamGeo = new THREE.CylinderGeometry(0, 1, 1, 24, 1, true);

    this.composer = new EffectComposer(this.gl);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.lensPass = new ShaderPass(LensShader);
    this.lensPass.enabled = false;
    this.composer.addPass(this.lensPass);
    this.composer.addPass(new ShaderPass(ClampShader));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.45, 1.6);
    this.bloom.enabled = quality !== 'low';
    // favour the sharp mips: the coarsest ones turn bright points into blocks
    this.bloom.radius = 0;
    this.bloom.compositeMaterial.uniforms.bloomFactors.value = [1.0, 0.65, 0.3, 0.07, 0.0];
    this.composer.addPass(this.bloom);
    this.finalPass = new ShaderPass(FinalShader);
    this.composer.addPass(this.finalPass);

    this.S = 1;
    this.exposure = 1;
    this.flash = 0;
    this.damage = 0;
    this.shake = 0;
    this.focal = 800;
    this.tmpV = new THREE.Vector3();
    this.tmpQ = new THREE.Quaternion();
    this.frame = 0;
    this.resize();
  }

  makeDots(max) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      vertexShader: `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        attribute vec4 aCol; attribute float aSize; varying vec4 vCol;
        void main(){ vCol = aCol; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize; gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `
        #include <logdepthbuf_pars_fragment>
        uniform float uExposure; varying vec4 vCol;
        void main(){
        #include <logdepthbuf_fragment>
        vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0; if (r > 1.0) discard; float a = (exp(-r*r*3.0) - 0.0498) / 0.9502 * vCol.a;
        gl_FragColor = vec4(vCol.rgb * a * uExposure, 1.0); }`,
      uniforms: { uExposure: this.shared.uExposure },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const p = new THREE.Points(geo, mat);
    p.frustumCulled = false;
    p.max = max;
    return p;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.gl.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.width = w; this.height = h;
    this.updateFocal();
    const bs = this.quality === 'high' ? 0.6 : 0.5;
    this.bloom.setSize(Math.round(w * this.pixelRatio * bs), Math.round(h * this.pixelRatio * bs));
  }

  updateFocal() {
    this.focal = (this.height * this.pixelRatio * 0.5) / Math.tan((this.camera.fov * Math.PI) / 360);
  }

  setFov(fov) {
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
      this.updateFocal();
    }
  }

  geometry(detail) {
    let g = this.geoCache.get(detail);
    if (!g) {
      g = new THREE.IcosahedronGeometry(1, detail);
      this.geoCache.set(detail, g);
    }
    return g;
  }

  // ---------------------------------------------------------------- views

  viewKind(b) {
    if (b.compact === 'bh') return 'bh';
    if (b.compact === 'ns') return 'ns';
    if (b.isStar) return 'star';
    return 'planet';
  }

  createView(b) {
    const kind = this.viewKind(b);
    const group = new THREE.Group();
    const v = { kind, group, body: b, lookTimer: 0, mass0: b.mass };
    if (kind === 'planet') {
      v.mat = makePlanetMaterial(this.shared);
      v.mesh = new THREE.Mesh(this.geometry(6), v.mat);
      group.add(v.mesh);
      v.atmoMat = makeAtmosphereMaterial(this.shared);
      v.atmo = new THREE.Mesh(this.geometry(24), v.atmoMat);
      v.atmo.visible = false;
      group.add(v.atmo);
      v.cloudMat = makeCloudMaterial(this.shared);
      v.clouds = new THREE.Mesh(this.geometry(24), v.cloudMat);
      v.clouds.visible = false;
      group.add(v.clouds);
      v.ringMat = makeRingMaterial(this.shared);
      v.ring = new THREE.Mesh(this.ringGeo, v.ringMat);
      v.ring.visible = false;
      group.add(v.ring);
      v.glowMat = makeGlowMaterial(this.shared);
      v.glow = new THREE.Mesh(this.glowGeo, v.glowMat);
      v.glow.frustumCulled = false;
      v.glow.visible = false;
      group.add(v.glow);
      this.applyLook(v, true);
    } else if (kind === 'star') {
      v.mat = makeStarMaterial(this.shared);
      v.mat.uniforms.uSeed.value = (b.seed % 1000) + 0.5;
      v.mesh = new THREE.Mesh(this.geometry(24), v.mat);
      group.add(v.mesh);
      v.glowMat = makeGlowMaterial(this.shared);
      v.glow = new THREE.Mesh(this.glowGeo, v.glowMat);
      v.glow.frustumCulled = false;
      v.glow.renderOrder = 4;
      group.add(v.glow);
    } else if (kind === 'bh') {
      v.mesh = new THREE.Mesh(this.geometry(16), new THREE.MeshBasicMaterial({ color: 0x000000 }));
      group.add(v.mesh);
      v.diskMat = makeDiskMaterial(this.shared);
      v.diskMat.uniforms.uSeed.value = (b.seed % 100) + 0.3;
      v.disk = new THREE.Mesh(this.diskGeo, v.diskMat);
      v.disk.renderOrder = 3;
      group.add(v.disk);
    } else if (kind === 'ns') {
      v.mat = makeNeutronMaterial(this.shared);
      v.mesh = new THREE.Mesh(this.geometry(12), v.mat);
      group.add(v.mesh);
      v.glowMat = makeGlowMaterial(this.shared);
      v.glow = new THREE.Mesh(this.glowGeo, v.glowMat);
      v.glow.frustumCulled = false;
      group.add(v.glow);
      v.beamMat = makeBeamMaterial(this.shared);
      v.beams = new THREE.Group();
      const b1 = new THREE.Mesh(this.beamGeo, v.beamMat);
      const b2 = new THREE.Mesh(this.beamGeo, v.beamMat);
      b1.position.y = 0.5; b2.position.y = -0.5; b2.rotation.x = Math.PI;
      v.beams.add(b1, b2);
      group.add(v.beams);
    }
    group.traverse((o) => { o.frustumCulled = false; });
    this.scene.add(group);
    return v;
  }

  disposeView(v) {
    v.group.removeFromParent();
    v.group.traverse((o) => {
      if (o.material && o.material.dispose) o.material.dispose();
    });
  }

  applyLook(v, initial = false) {
    const b = v.body;
    const L = computeLook(b);
    v.look = L;
    const u = v.mat.uniforms;
    u.uType.value = L.type;
    u.uSeed.value = (b.seed % 997) + 0.5;
    u.uColA.value.setRGB(...L.pal[0]);
    u.uColB.value.setRGB(...L.pal[1]);
    u.uColC.value.setRGB(...L.pal[2]);
    u.uOcean.value = L.ocean;
    u.uIceCap.value = L.iceCap;
    u.uLife.value = b.life || 0;
    u.uHeat.value = L.heat;
    u.uCraters.value = L.craters;
    u.uRelief.value = L.relief;
    u.uLumpy.value = L.lumpy;
    u.uTempK.value = b.mass >= 13 * M_JUP ? (b.starTemp || 1500) : Math.max(b.temp || 150, 900);
    u.uAtmo.value.set(L.atmoColor[0], L.atmoColor[1], L.atmoColor[2], clamp(L.atmo * 0.35, 0, 0.6));
    u.uEmissive.value = L.glow;
    if (L.type < PTYPE.gasgiant) {
      // small or distant bodies share a few surfaces; big ones on screen get their own
      const isPlayer = b.role === 'player';
      const unique = isPlayer || (v.lastPx || 0) > 45;
      const size = isPlayer ? (this.quality === 'high' ? 1024 : 512) : unique ? 256 : 128;
      const seedKey = unique ? b.seed : (b.seed % 12) + 1;
      u.uSurf.value = this.baker.get(seedKey, size);
    }
    // atmosphere shell
    const hasAtmo = L.atmo > 0.05;
    v.atmo.visible = hasAtmo;
    if (hasAtmo) {
      const au = v.atmoMat.uniforms;
      const c = L.atmoColor;
      au.uBetaR.value.set(c[0], c[1], c[2]);
      au.uMie.value = L.atmoMie;
      au.uDensity.value = clamp(L.atmo, 0.1, 2) * (L.type >= PTYPE.gasgiant ? 0.5 : 1);
      v.atmoScale = L.type >= PTYPE.gasgiant ? 1.02 : 1.025 + 0.015 * clamp(L.atmo, 0, 1.5);
    }
    v.clouds.visible = L.clouds > 0.02;
    if (v.clouds.visible) {
      v.cloudMat.uniforms.uSeed.value = (b.seed % 131) + 0.3;
      v.cloudMat.uniforms.uCover.value = L.clouds;
      v.cloudMat.uniforms.uTint.value.setRGB(...L.cloudTint);
    }
    v.ring.visible = !!L.rings;
    if (L.rings) {
      const ru = v.ringMat.uniforms;
      ru.uInner.value = L.rings.inner;
      ru.uOuter.value = L.rings.outer;
      ru.uSeed.value = (L.rings.seed % 100) + 0.5;
      ru.uOpacity.value = L.rings.opacity;
      const icy = b.comp.ice > 0.3;
      ru.uColA.value.setRGB(...(icy ? [0.55, 0.58, 0.6] : [0.5, 0.44, 0.36]));
      ru.uColB.value.setRGB(...(icy ? [0.8, 0.82, 0.85] : [0.78, 0.7, 0.56]));
    }
    v.glow.visible = L.glow > 0;
    void initial;
  }

  // ---------------------------------------------------------------- lights

  lightsFor(world, x, y, z, exclude) {
    // two brightest light sources by flux (stars, the player if it shines, neutron stars)
    let l0 = null, l1 = null, f0 = 0, f1 = 0;
    const consider = (s) => {
      if (!s.alive || s === exclude) return;
      const d = Math.hypot(s.x - x, s.y - y, s.z - z);
      const dReal = s.radius + Math.max(0, d - s.radius) * DIST_COMPRESS;
      const au = dReal / AU_REAL;
      const lum = s.lum || 0;
      const f = lum / (au * au + 1e-12);
      if (f > f0) { l1 = l0; f1 = f0; l0 = s; f0 = f; } else if (f > f1) { l1 = s; f1 = f; }
    };
    for (const s of world.stars) consider(s);
    const p = world.player;
    if (p && p.alive && (p.isStar || p.compact === 'ns' || p.starTemp > 0)) consider(p);
    return { l0, f0, l1, f1 };
  }

  setLightUniforms(u, lights, cx, cy, cz, view) {
    const set = (dirU, colU, s, f) => {
      if (!s) { colU.value.setRGB(0, 0, 0); return; }
      this.tmpV.set(s.x - cx, s.y - cy, s.z - cz).normalize();
      this.tmpV.transformDirection(view);
      dirU.value.copy(this.tmpV);
      const bb = blackbody(s.starTemp || 6000);
      // a camera white-balances toward its light source; keep only a hint of the star's tint
      const c = [0.62 + 0.38 * bb[0], 0.62 + 0.38 * bb[1], 0.62 + 0.38 * bb[2]];
      // compress the huge range of starlight like a camera with good dynamic range
      const I = Math.pow(f, 0.5);
      colU.value.setRGB(c[0] * I, c[1] * I, c[2] * I);
    };
    set(u.uL0dir, u.uL0col, lights.l0, lights.f0);
    if (u.uL1dir) set(u.uL1dir, u.uL1col, lights.l1, lights.f1);
  }

  // ---------------------------------------------------------------- frame

  sync(world, cam, dtReal, state) {
    const S = cam.S;
    this.S = S;
    this.frame++;
    this.shared.uTime.value += dtReal;
    const camW = cam.pos;
    // camera orientation
    this.camera.quaternion.copy(cam.quat);
    this.setFov(cam.fov);
    this.camera.updateMatrixWorld();
    const view = this.camera.matrixWorldInverse;

    // exposure: adapt to the light falling on you
    const p = world.player;
    const pl = this.lightsFor(world, p.x, p.y, p.z, p);
    let target = clamp((1.0 / Math.sqrt(Math.max(pl.f0 + pl.f1, 1e-6))) * 0.9, 0.012, 260);
    if (p.isStar) target = Math.min(0.55, target * 3);
    else if (p.compact) target = Math.min(target * 1.5, 2.5);
    target *= state.flashDim || 1;
    if (state.snap || !isFinite(this.exposure)) this.exposure = target;
    // eyes adapt faster to brighter light than to darkness
    const rate = target < this.exposure ? 3.5 : 1.2;
    this.exposure += (target - this.exposure) * Math.min(1, dtReal * rate);
    this.shared.uExposure.value = this.exposure;
    this.scene.backgroundIntensity = clamp(this.exposure * 0.6, 0, 40);

    // sky
    this.sky.setCamera(camW.x, camW.y, camW.z);
    this.sky.sysMat.uniforms.uHideNear.value = 9e9;
    this.sky.update(camW, this.focal, state.forceSky);
    if (this.frame % 60 === 0) this.sky.refreshSystemLum();

    // bodies
    const seen = new Set();
    const lenses = [];
    this.rocks.begin();
    const dotsGeo = this.dots.geometry;
    const dPos = dotsGeo.attributes.position.array, dCol = dotsGeo.attributes.aCol.array, dSz = dotsGeo.attributes.aSize.array;
    let nd = 0;
    const plasma = [];
    const focal = this.focal;
    for (const b of world.bodies) {
      if (!b.alive) continue;
      const rx = (b.x - camW.x) / S, ry = (b.y - camW.y) / S, rz = (b.z - camW.z) / S;
      const dist = Math.hypot(rx, ry, rz);
      if (b.role === 'fragment') {
        const r = b.radius / S;
        const px = (r / dist) * focal;
        if (b.kind === 'plasma' || b.fromStar) {
          plasma.push(b);
          continue;
        }
        if (px < 0.8) {
          if (nd < this.dots.max) {
            dPos[nd * 3] = rx; dPos[nd * 3 + 1] = ry; dPos[nd * 3 + 2] = rz;
            dCol.set([0.6, 0.55, 0.5, clamp(px * 1.5, 0.15, 0.8)], nd * 4);
            dSz[nd] = 1.6; nd++;
          }
          continue;
        }
        const t = b.comp.ice > 0.35 ? [0.6, 0.62, 0.64] : b.comp.iron > 0.5 ? [0.35, 0.35, 0.37] : [0.22, 0.2, 0.18];
        this.rocks.add(rx, ry, rz, r, b.rot * 3, (b.seed % 100) * 0.1, t, clamp(b.hot || 0, 0, 1) * 0.6);
        continue;
      }
      const kind = this.viewKind(b);
      let v = this.views.get(b.id);
      if (v && v.kind !== kind) { this.disposeView(v); this.views.delete(b.id); v = null; }
      const vr = this.visualRadius(b);
      const rU = vr / S;
      const px = (rU / Math.max(dist, 1e-9)) * focal;
      // tiny and dim: a dot of reflected light
      if (px < 0.9 && kind === 'planet' && b.role !== 'player') {
        if (v) { v.group.visible = false; seen.add(b.id); }
        if (nd < this.dots.max) {
          dPos[nd * 3] = rx; dPos[nd * 3 + 1] = ry; dPos[nd * 3 + 2] = rz;
          const lt = this.lightsFor(world, b.x, b.y, b.z, b);
          const bright = clamp(Math.sqrt(lt.f0) * px * 2.2 * this.exposure, 0.03, 1.4) * (b.fadeIn ?? 1);
          const col = b.comp.ice > 0.35 ? [0.8, 0.85, 0.9] : b.comp.gas > 0.3 ? [0.9, 0.8, 0.65] : [0.65, 0.6, 0.55];
          dCol.set([col[0], col[1], col[2], bright / Math.max(this.exposure, 1e-3)], nd * 4);
          dSz[nd] = 2.0; nd++;
        }
        continue;
      }
      if (!v) { v = this.createView(b); this.views.set(b.id, v); }
      seen.add(b.id);
      v.group.visible = true;
      v.group.position.set(rx, ry, rz);
      this.updateView(v, world, rU, px, dist, rx, ry, rz, view, dtReal, lenses, cam, state);
    }
    this.rocks.end();
    // hot plasma fragments
    for (const b of plasma) {
      if (nd >= this.dots.max) break;
      const rx = (b.x - camW.x) / S, ry = (b.y - camW.y) / S, rz = (b.z - camW.z) / S;
      dPos[nd * 3] = rx; dPos[nd * 3 + 1] = ry; dPos[nd * 3 + 2] = rz;
      const c = blackbody(lerp(4000, 12000, b.hot || 0.5));
      dCol.set([c[0] * 3, c[1] * 3, c[2] * 3, 1.0], nd * 4);
      const dist = Math.hypot(rx, ry, rz);
      dSz[nd] = clamp(((b.radius * 4) / S / dist) * this.focal, 2, 24);
      nd++;
    }
    dotsGeo.setDrawRange(0, nd);
    dotsGeo.attributes.position.needsUpdate = true;
    dotsGeo.attributes.aCol.needsUpdate = true;
    dotsGeo.attributes.aSize.needsUpdate = true;

    for (const [id, v] of this.views) {
      if (!seen.has(id)) { this.disposeView(v); this.views.delete(id); }
    }

    // rock lighting: use the light on the player
    this.setLightUniforms(this.rocks.mat.uniforms, pl, p.x, p.y, p.z, view);

    // disks and belts of active systems
    for (const [id, e] of world.active) {
      if (!this.disks.has(id) && (e.detail.disk || e.detail.belts.length)) {
        const dc = new DiskCloud(e, this.shared, this.quality);
        for (const o of dc.objects) this.scene.add(o);
        this.disks.set(id, dc);
      }
    }
    for (const [id, dc] of this.disks) {
      if (!world.active.has(id)) { dc.dispose(); this.disks.delete(id); continue; }
      const st = dc.entry.star;
      dc.update(camW, S, this.focal, world.time, st && st.alive ? blackbody(st.starTemp || 5000) : [1, 1, 1]);
    }

    // dust motes give a sense of speed
    const env = world.field.env;
    const motesBright = env.kind === 'disk' ? 0.22 : env.kind === 'belt' || env.kind === 'nebula' ? 0.12 : env.kind === 'planetary' ? 0.08 : env.kind === 'interplanetary' ? 0.05 : 0.025;
    const fr = state.frame || { vx: 0, vy: 0, vz: 0 };
    const rel = this.tmpV.set(p.vx - fr.vx, p.vy - fr.vy, p.vz - fr.vz);
    const streakSeconds = 0.06 * TIME_BASE * world.warp;
    rel.multiplyScalar(streakSeconds / S);
    const box = cam.dist * 9;
    if (rel.length() > box * 0.4) rel.setLength(box * 0.4);
    this.motes.update(camW, S, box, rel, env.kind === 'disk' ? [1, 0.75, 0.55] : [0.7, 0.75, 0.85], motesBright * clamp(pl.f0 ** 0.25, 0.3, 2) / Math.max(this.exposure, 0.05) * 0.9);

    // effects
    this.fx.update(dtReal, dtReal * TIME_BASE * world.warp, camW, S, this.focal);

    // lensing: the four biggest black holes on screen bend light; the lens pass
    // also draws their shadows, so their black spheres are hidden
    this.lensPass.enabled = lenses.length > 0;
    if (lenses.length) {
      lenses.sort((a, b) => b.z - a.z);
      const u = this.lensPass.uniforms;
      u.uCount.value = Math.min(4, lenses.length);
      u.uAspect.value = this.width / this.height;
      for (let i = 0; i < 4; i++) {
        const L = lenses[i];
        if (!L) continue;
        u.uLens.value[i].set(L.x, L.y, L.z, L.w);
        u.uGlow.value[i] = L.glow;
        L.view.mesh.visible = false;
      }
    }

    // final look
    this.flash *= Math.exp(-dtReal * 1.3);
    if (this.flash < 0.01) this.flash = 0;
    const fu = this.finalPass.uniforms;
    fu.uTime.value = this.shared.uTime.value;
    fu.uDamage.value = clamp(state.damage || 0, 0, 1);
    fu.uFlash.value = this.flash;
    fu.uGrain.value = this.quality === 'low' ? 0.0 : 0.022;
    this.bloom.strength = 0.5 + this.flash * 0.8;
  }

  visualRadius(b) {
    if (b.compact === 'bh') return b.rEff * 0.32;
    if (b.compact === 'ns') return b.rEff * 0.04;
    return b.radius;
  }

  // the size the camera frames: for compact objects that's their reach, not their tiny body
  cameraScale(b) {
    if (b.compact === 'bh') return b.rEff * 0.32;
    if (b.compact === 'ns') return b.rEff * 0.22;
    return b.radius;
  }

  updateView(v, world, rU, px, dist, rx, ry, rz, view, dtReal, lenses, cam, state) {
    const b = v.body;
    const isPlayer = b.role === 'player';
    const fade = b.fadeIn ?? 1;
    if (v.kind === 'planet') {
      // LOD
      const det = px < 5 ? 3 : px < 25 ? 8 : px < 110 ? 18 : px < 380 ? 40 : 72;
      const want = b.mass < 8e20 && isPlayer ? Math.max(det, 48) : det;
      if (v.mesh.geometry !== this.geometry(want)) v.mesh.geometry = this.geometry(want);
      v.mesh.scale.setScalar(rU);
      // spin around a tilted axis
      v.mesh.rotation.set(b.tilt, b.rot, 0, 'XYZ');
      v.lookTimer -= dtReal;
      const grewOnScreen = px > 45 && (v.lastPx || 0) <= 45;
      v.lastPx = px;
      if (v.lookTimer <= 0 || grewOnScreen || Math.abs(b.mass / v.mass0 - 1) > 0.04) {
        this.applyLook(v);
        v.lookTimer = isPlayer ? 0.25 : 2;
        v.mass0 = b.mass;
      }
      const u = v.mat.uniforms;
      u.uDetail.value = px > 40 ? 1 : 0;
      u.uHeat.value = Math.max(v.look.heat, b.heat || 0);
      u.uDamage.value = isPlayer ? clamp(state.damage * 1.2, 0, 1) : clamp(b.disrupt * 0.6, 0, 1);
      const lights = this.lightsFor(world, b.x, b.y, b.z, b);
      this.setLightUniforms(u, lights, b.x, b.y, b.z, view);
      u.uAmbient.value = 0.0015 + (world.field.env.kind === 'nebula' ? 0.004 : 0);
      if (fade < 1) { u.uL0col.value.multiplyScalar(fade); u.uL1col.value.multiplyScalar(fade); }
      // atmosphere
      if (v.atmo.visible) {
        const s = rU * v.atmoScale;
        v.atmo.scale.setScalar(s);
        const au = v.atmoMat.uniforms;
        au.uCenter.value.set(rx, ry, rz).applyMatrix4(view);
        au.uRp.value = rU;
        au.uRa.value = s;
        au.uL0dir.value.copy(u.uL0dir.value);
        au.uL0col.value.copy(u.uL0col.value);
        v.atmo.visible = px > 2;
      }
      if (v.clouds.visible || (v.look.clouds > 0.02 && px > 3)) {
        v.clouds.visible = v.look.clouds > 0.02 && px > 3;
        v.clouds.scale.setScalar(rU * 1.008);
        v.clouds.rotation.set(b.tilt, b.rot * 1.05, 0, 'XYZ');
        v.cloudMat.uniforms.uL0dir.value.copy(u.uL0dir.value);
        v.cloudMat.uniforms.uL0col.value.copy(u.uL0col.value);
      }
      if (v.ring.visible) {
        v.ring.scale.setScalar(rU);
        // rings lie in the equator: perpendicular to the tilted spin axis
        v.ring.rotation.set(b.tilt + Math.PI / 2, 0, 0, 'XYZ');
        const ru = v.ringMat.uniforms;
        ru.uCenter.value.set(rx, ry, rz).applyMatrix4(view);
        ru.uRp.value = rU;
        ru.uL0dir.value.copy(u.uL0dir.value);
        ru.uL0col.value.copy(u.uL0col.value);
      }
      if (v.glow.visible) {
        const gu = v.glowMat.uniforms;
        const c = blackbody(b.starTemp || 1500);
        gu.uColor.value.setRGB(c[0], c[1] * 0.8, c[2] * 0.7);
        gu.uSize.value = rU * 3;
        gu.uCore.value = 1 / 3;
        gu.uIntensity.value = 0.6 * v.look.glow;
        gu.uSpikes.value = 0;
        gu.uCorona.value = 0;
        gu.uHalo.value = 0.3;
      }
    } else if (v.kind === 'star') {
      const det = px < 8 ? 8 : px < 60 ? 16 : px < 300 ? 32 : 64;
      if (v.mesh.geometry !== this.geometry(det)) v.mesh.geometry = this.geometry(det);
      v.mesh.scale.setScalar(rU);
      v.mesh.rotation.set(b.tilt * 0.2, b.rot * 0.2, 0);
      const u = v.mat.uniforms;
      u.uTempK.value = b.starTemp;
      u.uIntensity.value = (isPlayer ? 1.15 : 1.8) / Math.max(this.exposure, 1e-4);
      u.uDetail.value = px > 30 ? 1 : 0;
      u.uActivity.value = px < 120 ? -2 : b.starTemp < 4000 ? 1 : 0.3;
      const c = blackbody(b.starTemp);
      const gu = v.glowMat.uniforms;
      gu.uColor.value.setRGB(c[0], c[1], c[2]);
      // how bright it looks from here sets the glare size
      const dKm = dist * this.S;
      const dReal = b.radius + Math.max(0, dKm - b.radius) * DIST_COMPRESS;
      const au = dReal / AU_REAL;
      const flux = b.lum / (au * au);
      const glarePx = clamp(30 * Math.pow(flux * this.exposure, 0.3), 8, 260);
      const sizeU = Math.max(rU * 5, (glarePx / this.focal) * dist);
      gu.uHalo.value = clamp(1 - px / 25, 0, 1);
      gu.uSize.value = sizeU;
      gu.uCore.value = rU / sizeU;
      gu.uIntensity.value = isPlayer ? 0.9 / Math.max(this.exposure, 1e-4) : Math.min(clamp(Math.pow(flux, 0.5), 0.05, 400), 3 / Math.max(this.exposure, 1e-4));
      gu.uSpikes.value = isPlayer ? 0 : clamp(0.6 - px / 300, 0, 0.6);
      gu.uCorona.value = isPlayer ? 0.35 : 0.25;
      gu.uSeed.value = (b.seed % 50) + 0.2;
    } else if (v.kind === 'bh') {
      v.mesh.scale.setScalar(rU);
      v.mesh.visible = true;
      const du = v.diskMat.uniforms;
      v.disk.scale.setScalar(rU);
      du.uInner.value = 1.3;
      du.uOuter.value = 5.5;
      du.uTempIn.value = 6600 + 900 * Math.sin(b.seed);
      // brighter while feeding
      const feed = isPlayer ? clamp(state.feed || 0, 0, 1) : 0.15;
      du.uFeed.value = feed;
      du.uIntensity.value = (isPlayer ? 2.0 : 1.3) * (0.55 + feed) / Math.max(this.exposure, 1e-4);
      v.disk.rotation.set(b.tilt + Math.PI / 2, 0, 0.3);
      // screen position for lensing
      this.tmpV.set(rx, ry, rz).applyMatrix4(view);
      if (this.tmpV.z < 0) {
        const ndc = this.tmpV.clone().applyMatrix4(this.camera.projectionMatrix);
        const sx = ndc.x * 0.5 + 0.5, sy = ndc.y * 0.5 + 0.5;
        const angR = rU / Math.max(-this.tmpV.z, 1e-9);           // radians
        const toScreen = 1 / (2 * Math.tan((this.camera.fov * Math.PI) / 360)); // screen-height units per radian
        const shadow = angR * toScreen;
        lenses.push({ x: sx, y: sy, z: shadow * 2.0, w: shadow, view: v, glow: 0.25 + feed });
      }
    } else if (v.kind === 'ns') {
      v.mesh.scale.setScalar(rU);
      v.mat.uniforms.uIntensity.value = 2.0 / Math.max(this.exposure, 1e-4);
      const gu = v.glowMat.uniforms;
      gu.uColor.value.setRGB(0.55, 0.7, 1.0);
      gu.uSize.value = rU * 9;
      gu.uCore.value = 1 / 9;
      gu.uIntensity.value = 0.5 / Math.max(this.exposure, 0.02);
      gu.uSpikes.value = 0.1;
      gu.uCorona.value = 0;
      gu.uHalo.value = 0.6;
      // lighthouse: beams sweep around the spin axis
      const t = this.shared.uTime.value;
      v.beams.scale.set(rU * 6, rU * 70, rU * 6);
      v.beams.rotation.set(0.5, t * 2.2, 0.35, 'YXZ');
      v.beams.rotation.set(Math.sin(t * 2.2) * 0.9, t * 2.2, Math.cos(t * 2.2) * 0.5);
      v.beamMat.uniforms.uIntensity.value = 1.6 / Math.max(this.exposure, 0.02) * 0.3;
    }
    void cam;
  }

  render() {
    this.composer.render();
  }
}
