// The 3D galaxy map: spin it, zoom from the whole Milky Way down to the stars
// around you, pick stars, mark them, and see how far your probes have gone.
import * as THREE from 'three';
import { RNG, hash32 } from '../core/rng.js';
import { GALAXY, LY, armDensity, Galaxy } from '../world/galaxy.js';
import { blackbody, clamp } from '../core/phys.js';
import { phaseName } from '../world/stellar.js';
import { generateSystemDetail } from '../world/system.js';
import * as F from '../core/format.js';
import { esc } from './info.js';

const $ = (id) => document.getElementById(id);

const PT_VERT = /* glsl */ `
attribute vec3 color;
attribute float size;
attribute float bright;
uniform float uFocal;
uniform float uMinPx;
uniform float uMaxPx;
varying vec3 vCol;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float d = max(-mv.z, 1e-3);
  float px = size / d * uFocal;
  float k = clamp(px / max(uMinPx, 0.01), 0.0, 1.0);
  vCol = color;
  vA = bright * mix(k * k, 1.0, step(uMinPx, px)) * (1.0 - smoothstep(uMaxPx * 0.6, uMaxPx, px));
  gl_PointSize = clamp(px, uMinPx, uMaxPx);
  gl_Position = projectionMatrix * mv;
}
`;
const PT_FRAG = /* glsl */ `
varying vec3 vCol;
varying float vA;
uniform float uSoft;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  if (r > 1.0) discard;
  float a = mix(1.0 - smoothstep(0.6, 1.0, r), exp(-r * r * 3.0), uSoft) * vA;
  gl_FragColor = vec4(vCol * a, 1.0);
}
`;
const DUST_FRAG = /* glsl */ `
varying vec3 vCol;
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  if (r > 1.0) discard;
  gl_FragColor = vec4(vCol, exp(-r * r * 2.5) * vA);
}
`;

export class GalaxyMap {
  constructor(game) {
    this.game = game;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1e7);
    this.yaw = 0.6;
    this.pitch = 0.9;
    this.dist = 140000;
    this.target = new THREE.Vector3();
    this.goalTarget = null;
    this.goalDist = null;
    this.sel = null;
    this.built = false;
    this.labels = [];
    this.tabs();
    this.bindMouse();
  }

  tabs() {
    const host = $('map-tabs');
    for (const [id, name] of [['galaxy', 'Whole galaxy'], ['local', 'Neighbourhood'], ['you', 'Centre on you']]) {
      const b = document.createElement('button');
      b.className = 'tab';
      b.textContent = name;
      b.addEventListener('click', () => this.go(id));
      host.appendChild(b);
    }
  }

  go(id) {
    const you = this.youLy();
    if (id === 'galaxy') { this.goalTarget = new THREE.Vector3(-you[0], -you[1], -you[2]); this.goalDist = 140000; }
    if (id === 'local') { this.goalTarget = new THREE.Vector3(0, 0, 0); this.goalDist = 120; }
    if (id === 'you') { this.goalTarget = new THREE.Vector3(0, 0, 0); this.goalDist = Math.min(this.dist, 2500); }
  }

  bindMouse() {
    const cv = this.game.canvas;
    let down = null, moved = 0;
    cv.addEventListener('pointerdown', (e) => {
      if (!this.game.mapOpen) return;
      down = { x: e.clientX, y: e.clientY };
      moved = 0;
      cv.setPointerCapture?.(e.pointerId);
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.game.mapOpen || !down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      moved += Math.abs(dx) + Math.abs(dy);
      down = { x: e.clientX, y: e.clientY };
      this.yaw -= dx * 0.005;
      this.pitch = clamp(this.pitch + dy * 0.005, -1.5, 1.5);
    });
    cv.addEventListener('pointerup', (e) => {
      if (!this.game.mapOpen) return;
      if (down && moved < 5) this.pick(e.clientX, e.clientY);
      down = null;
    });
    cv.addEventListener('wheel', (e) => {
      if (!this.game.mapOpen) return;
      this.dist = clamp(this.dist * Math.pow(1.18, Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY) / 100, 3)), 3, 300000);
      this.goalDist = null;
    });
  }

  youLy() {
    const w = this.game.world, p = w.player;
    return w.toLy(p.x, p.y, p.z);
  }

  // ---------------------------------------------------------------- building

  build() {
    const g = this.game.galaxy;
    this.anchor = this.youLy();
    const a = this.anchor;
    for (const o of [...this.scene.children]) { this.scene.remove(o); o.geometry?.dispose(); o.material?.dispose(); }
    const q = this.game.settings.quality;
    const n = q === 'low' ? 60000 : q === 'high' ? 180000 : 120000;
    const rng = new RNG(hash32(g.seed, 911));
    const P = new Float32Array(n * 3), C = new Float32Array(n * 3), S = new Float32Array(n), B = new Float32Array(n);
    const dP = [], dC = [], dS = [], dB = [];
    for (let i = 0; i < n; i++) {
      const p = g.samplePoint(rng);
      P[i * 3] = p[0] - a[0]; P[i * 3 + 1] = p[1] - a[1]; P[i * 3 + 2] = p[2] - a[2];
      const r = Math.hypot(p[0], p[2]);
      const bulge = Math.exp(-r / (GALAXY.Rb * 2.2));
      const arm = armDensity(p[0], p[2]);
      const young = rng.chance(arm * 0.35);
      const col = young ? [0.55, 0.7, 1.0] : bulge > 0.3 ? [1.0, 0.8, 0.55] : [0.95, 0.88, 0.78];
      C.set(col, i * 3);
      S[i] = rng.range(90, 240) * (young ? 1.3 : 1) * (1 + bulge);
      B[i] = 0.55 + 0.45 * rng.next() + bulge * 0.5;
      // dust lanes trail the arms
      const t = Math.atan2(p[2], p[0]);
      const lead = armDensity(r * Math.cos(t - 0.07), r * Math.sin(t - 0.07));
      if (lead > arm + 0.15 && rng.chance(0.35) && r > 3000) {
        dP.push(p[0] - a[0], p[1] * 0.3 - a[1], p[2] - a[2]);
        dC.push(0.02, 0.012, 0.01);
        dS.push(rng.range(250, 600));
        dB.push(0.35);
      }
    }
    // H II regions: pink knots along the arms
    for (const nb of g.nebulaeNear(a[0], a[1], a[2], 30000)) {
      if (nb.massLeft <= 0.02) continue;
      const k = 6;
      for (let i = 0; i < k; i++) {
        const v = rng.unitVector();
        this.nebPts = this.nebPts || [];
        this.nebPts.push(nb.x + v.x * nb.r * 0.5 - a[0], nb.y - a[1], nb.z + v.z * nb.r * 0.5 - a[2]);
      }
    }
    const pts = this.points(P, C, S, B, { min: 1.2, max: 40, soft: 1 }, THREE.AdditiveBlending, PT_FRAG);
    this.scene.add(pts);
    // a soft glow of unresolved stars underneath
    const ng = Math.round(n / 15);
    const gP = new Float32Array(ng * 3), gC = new Float32Array(ng * 3), gS = new Float32Array(ng), gB = new Float32Array(ng);
    for (let i = 0; i < ng; i++) {
      const p = g.samplePoint(rng);
      gP[i * 3] = p[0] - a[0]; gP[i * 3 + 1] = p[1] * 0.6 - a[1]; gP[i * 3 + 2] = p[2] - a[2];
      const r = Math.hypot(p[0], p[2]);
      const bulge = Math.exp(-r / (GALAXY.Rb * 2.5));
      gC.set(bulge > 0.3 ? [1.0, 0.78, 0.5] : armDensity(p[0], p[2]) > 0.4 ? [0.55, 0.65, 1.0] : [0.85, 0.75, 0.6], i * 3);
      gS[i] = rng.range(1500, 3200) * (1 + bulge * 0.8);
      gB[i] = 0.05 + bulge * 0.08;
    }
    this.scene.add(this.points(gP, gC, gS, gB, { min: 2, max: 300, soft: 1 }, THREE.AdditiveBlending, PT_FRAG));
    if (dP.length) this.scene.add(this.points(new Float32Array(dP), new Float32Array(dC), new Float32Array(dS), new Float32Array(dB), { min: 1, max: 80 }, THREE.NormalBlending, DUST_FRAG));
    if (this.nebPts?.length) {
      const m = this.nebPts.length / 3;
      this.scene.add(this.points(new Float32Array(this.nebPts), new Float32Array(m * 3).map((_, i) => [1, 0.3, 0.45][i % 3]), new Float32Array(m).fill(70), new Float32Array(m).fill(0.9), { min: 1.5, max: 60, soft: 1 }, THREE.AdditiveBlending, PT_FRAG));
      this.nebPts = null;
    }
    // the black hole at the centre
    this.addMarker([-a[0], -a[1], -a[2]], [1, 0.6, 0.3], 12, 'core');
    this.local = null;
    this.makeMarkers();
    this.built = true;
  }

  points(P, C, S, B, o, blending, frag) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(S, 1));
    geo.setAttribute('bright', new THREE.BufferAttribute(B, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: PT_VERT, fragmentShader: frag,
      uniforms: { uFocal: { value: 800 }, uMinPx: { value: o.min }, uMaxPx: { value: o.max }, uSoft: { value: o.soft || 0 } },
      transparent: true, depthWrite: false, depthTest: false, blending,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    return pts;
  }

  addMarker(pos, col, px, kind) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
    geo.setAttribute('size', new THREE.BufferAttribute(new Float32Array([1]), 1));
    geo.setAttribute('bright', new THREE.BufferAttribute(new Float32Array([1]), 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: PT_VERT, fragmentShader: PT_FRAG,
      uniforms: { uFocal: { value: 0 }, uMinPx: { value: px }, uMaxPx: { value: px }, uSoft: { value: 0 } },
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
    const m = new THREE.Points(geo, mat);
    m.frustumCulled = false;
    m.renderOrder = 10;
    m.userData.kind = kind;
    this.scene.add(m);
    return m;
  }

  // you, your home, marked systems, your probes' reach
  makeMarkers() {
    for (const o of this.scene.children.filter((c) => c.userData.mk)) { this.scene.remove(o); o.geometry.dispose(); o.material.dispose(); }
    const w = this.game.world, g = w.galaxy, a = this.anchor;
    const add = (ly, col, px, label, kind) => {
      const m = this.addMarker([ly[0] - a[0], ly[1] - a[1], ly[2] - a[2]], col, px, kind);
      m.userData.mk = true;
      m.userData.label = label;
      m.userData.ly = ly;
      return m;
    };
    this.youMk = add(this.youLy(), [1, 0.7, 0.29], 9, 'You', 'you');
    add([g.home.x, g.home.y, g.home.z], [0.55, 0.85, 1], 6, `Birthplace: ${g.nameOf(g.home)}`, 'home');
    for (const [id, st] of g.state) {
      if (!st.marked) continue;
      const rec = this.findRec(id);
      if (rec) add([rec.x, rec.y, rec.z], [1, 0.85, 0.3], 7, g.nameOf(rec), 'mark');
    }
    // probes: a sphere of explored space
    const reach = w.life?.probeReachLy?.() || 0;
    if (this.probeMesh) { this.scene.remove(this.probeMesh); this.probeMesh.geometry.dispose(); this.probeMesh.material.dispose(); this.probeMesh = null; }
    if (reach > 0.05) {
      const geo = new THREE.SphereGeometry(Math.min(reach, 5e4), 32, 16);
      const mat = new THREE.MeshBasicMaterial({ color: 0x3a8fd0, wireframe: true, transparent: true, opacity: 0.25, depthWrite: false });
      this.probeMesh = new THREE.Mesh(geo, mat);
      const y = this.youLy();
      this.probeMesh.position.set(y[0] - a[0], y[1] - a[1], y[2] - a[2]);
      this.scene.add(this.probeMesh);
    }
  }

  findRec(id) {
    const g = this.game.galaxy;
    const lm = g.landmarks.find((l) => l.id === id);
    if (lm) return lm;
    const m = /^(-?\d+),(-?\d+),(-?\d+)#(\d+)$/.exec(id);
    if (!m) return null;
    const stars = g.cellStars(+m[1], +m[2], +m[3], 0.08, 4000);
    return stars[+m[4]] || null;
  }

  // real stars around you, when zoomed in close enough to see them
  buildLocal(radius) {
    const w = this.game.world, g = w.galaxy, a = this.anchor;
    if (this.local) { this.scene.remove(this.local); this.local.geometry.dispose(); this.local.material.dispose(); }
    const list = g.starsNear(w.player, w.O, radius * LY, (dKm) => Math.max(0.08, Math.pow((dKm / LY) / radius, 2) * 1.2), 3000).slice(0, 12000);
    const n = list.length;
    const P = new Float32Array(n * 3), C = new Float32Array(n * 3), S = new Float32Array(n), B = new Float32Array(n);
    this.localList = [];
    const reach = w.life?.probeReachLy?.() || 0;
    const known = this.game.profile.scopeLife || {};
    let k = 0;
    for (const s of list) {
      const st = g.starNow(s.rec);
      if (!st) continue;
      const ly = [s.rec.x, s.rec.y, s.rec.z];
      P[k * 3] = ly[0] - a[0]; P[k * 3 + 1] = ly[1] - a[1]; P[k * 3 + 2] = ly[2] - a[2];
      C.set(st.phase === 'bh' ? [0.5, 0.3, 0.8] : blackbody(st.temp), k * 3);
      S[k] = 0.25 * Math.pow(Math.max(st.lum, 1e-4), 0.18) * (st.phase === 'rg' || st.phase === 'sg' ? 2 : 1);
      B[k] = 1;
      const explored = s.d / LY <= reach;
      const life = Object.keys(known).some((key) => key.startsWith(`${s.rec.id}/`));
      this.localList.push({ rec: s.rec, st, ly, i: k, explored, life });
      k++;
    }
    this.local = this.points(P.subarray(0, k * 3), C.subarray(0, k * 3), S.subarray(0, k), B.subarray(0, k), { min: 1.5, max: 14, soft: 0 }, THREE.AdditiveBlending, PT_FRAG);
    this.local.renderOrder = 5;
    this.scene.add(this.local);
    this.localR = radius;
  }

  // ---------------------------------------------------------------- picking

  pick(cx, cy) {
    if (!this.localList || this.dist > 3000) return;
    const W = window.innerWidth, H = window.innerHeight;
    let best = null, bd = 18 * 18;
    const v = new THREE.Vector3();
    for (const s of this.localList) {
      v.set(s.ly[0] - this.anchor[0], s.ly[1] - this.anchor[1], s.ly[2] - this.anchor[2]).project(this.camera);
      if (v.z > 1) continue;
      const sx = (v.x * 0.5 + 0.5) * W, sy = (-v.y * 0.5 + 0.5) * H;
      const d2 = (sx - cx) ** 2 + (sy - cy) ** 2;
      if (d2 < bd) { bd = d2; best = s; }
    }
    this.sel = best;
    this.renderInfo();
  }

  renderInfo() {
    const box = $('map-info');
    const w = this.game.world, g = w.galaxy;
    const you = this.youLy();
    if (!this.sel) {
      const fromCore = Math.hypot(you[0], you[1], you[2]);
      box.innerHTML = `<div class="eyebrow">You are here</div><div>${F.nice(fromCore)} light-years from the centre of the galaxy, ${F.nice(Math.abs(you[1]))} ly ${you[1] >= 0 ? 'above' : 'below'} its plane.</div>
        <p class="note">Drag to spin, scroll to zoom. Zoom in close and click a star to learn about it.</p>
        <p class="note">Galaxy age: ${F.years(10e9 + g.time)} · Andromeda is ${F.nice(g.andromedaPos()[3] / 1e6)} million ly away.</p>`;
      return;
    }
    const s = this.sel;
    const d = Math.hypot(s.ly[0] - you[0], s.ly[1] - you[1], s.ly[2] - you[2]);
    const st = g.stateOf(s.rec.id);
    let planets = '';
    if (s.explored || d < 60) {
      const det = generateSystemDetail(w.systemInfo(s.rec));
      planets = `${det.planets.length} planet${det.planets.length === 1 ? '' : 's'}${det.disk ? ', a young dusty disk' : ''}${det.belts.length ? `, ${det.belts.length} belt${det.belts.length > 1 ? 's' : ''}` : ''}`;
    }
    const travel = d * LY / (0.01 * 299792.458) / 3.15576e7;
    box.innerHTML = `<div class="eyebrow">${esc(phaseName(s.st))}${s.explored ? ' · visited by your probes' : ''}${s.life ? ' · <span style="color:var(--life)">life found</span>' : ''}</div>
      <div style="font:400 18px/1.2 var(--font-display);letter-spacing:.05em;text-transform:uppercase">${esc(g.nameOf(s.rec))}</div>
      <dl class="kv"><dt>Distance</dt><dd>${F.nice(d)} light-years</dd><dt>Mass</dt><dd>${F.nice(s.st.mass)} Suns</dd><dt>Brightness</dt><dd>${F.nice(s.st.lum)} × the Sun</dd><dt>Age</dt><dd>${F.years(s.st.age)}</dd>${planets ? `<dt>System</dt><dd>${planets}</dd>` : ''}<dt>At 1% of light speed</dt><dd>${F.years(travel)}</dd></dl>
      <div class="menu"><button class="btn small" id="map-mark">${st.marked ? 'Unmark' : 'Mark'}</button><button class="btn small" id="map-course">${this.game.waypoint && this.game.waypoint.id === s.rec.id ? 'Clear course' : 'Set course'}</button></div>`;
    $('map-mark').addEventListener('click', () => { st.marked = !st.marked; this.makeMarkers(); this.renderInfo(); });
    $('map-course').addEventListener('click', () => {
      this.game.waypoint = this.game.waypoint && this.game.waypoint.id === s.rec.id ? null : s.rec;
      if (this.game.waypoint) this.game.hud.log(`Course set for ${g.nameOf(s.rec)}: follow the amber arrow`, 'info');
      this.renderInfo();
    });
  }

  legend() {
    $('map-legend').innerHTML = 'You<i style="background:#ffb24a"></i><br>Birthplace<i style="background:#8cd9ff"></i><br>Marked<i style="background:#ffd84d"></i><br>Galactic centre<i style="background:#ff9a4d"></i><br>Probe reach<i style="background:#3a8fd0"></i>';
  }

  // ---------------------------------------------------------------- open / frame

  open() {
    const g = this.game;
    g.mapOpen = true;
    g.hud.el.overlay.hidden = false;
    g.input.enabled = false;
    g.book?.see('galaxy');
    if (!this.built || Math.hypot(...this.youLy().map((v, i) => v - this.anchor[i])) > 500 || this.builtTime !== g.galaxy.time) {
      this.build();
      this.builtTime = g.galaxy.time;
    } else this.makeMarkers();
    this.target.set(0, 0, 0);
    this.dist = Math.max(this.dist, 30);
    this.sel = null;
    this.legend();
    this.renderInfo();
    this.local = this.local || null;
  }

  close() {
    const g = this.game;
    g.mapOpen = false;
    g.input.enabled = true;
    g.input.wheel = 0;
    $('map-ui').hidden = true;
  }

  render(dt) {
    const g = this.game;
    const gl = g.renderer.gl;
    if (this.goalDist) { this.dist *= Math.pow(this.goalDist / this.dist, Math.min(1, dt * 3)); if (Math.abs(Math.log(this.dist / this.goalDist)) < 0.01) this.goalDist = null; }
    if (this.goalTarget) { this.target.lerp(this.goalTarget, Math.min(1, dt * 3)); if (this.target.distanceTo(this.goalTarget) < this.dist * 0.001) this.goalTarget = null; }
    // close up, show the real stars around you
    if (this.dist < 3000) {
      const want = clamp(this.dist * 1.6, 25, 300);
      if (!this.local || Math.abs(Math.log(want / this.localR)) > 0.5) this.buildLocal(want);
      this.local.visible = true;
    } else if (this.local) this.local.visible = false;
    const W = window.innerWidth, H = window.innerHeight;
    this.camera.aspect = W / H;
    this.camera.near = Math.max(this.dist * 1e-4, 1e-3);
    this.camera.far = this.dist * 50 + 3e5;
    this.camera.updateProjectionMatrix();
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    this.camera.position.set(this.target.x + Math.sin(this.yaw) * cp * this.dist, this.target.y + sp * this.dist, this.target.z + Math.cos(this.yaw) * cp * this.dist);
    this.camera.lookAt(this.target);
    const focal = (H * g.renderer.pixelRatio * 0.5) / Math.tan((this.camera.fov * Math.PI) / 360);
    for (const o of this.scene.children) if (o.material?.uniforms?.uFocal && o.material.uniforms.uFocal.value !== 0) o.material.uniforms.uFocal.value = focal;
    if (this.youMk) this.youMk.material.uniforms.uMinPx.value = this.youMk.material.uniforms.uMaxPx.value = 8 + 3 * Math.sin(performance.now() / 300);
    gl.setRenderTarget(null);
    gl.setClearColor(0x020306, 1);
    gl.clear();
    gl.render(this.scene, this.camera);
    this.drawLabels();
  }

  drawLabels() {
    const hud = this.game.hud;
    const ctx = hud.ctx;
    const dpr = hud.dpr;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.font = '500 11px "IBM Plex Mono", ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    const W = window.innerWidth, H = window.innerHeight;
    const v = new THREE.Vector3();
    const put = (pos, text, col) => {
      v.copy(pos).project(this.camera);
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) return;
      const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillText(text, x + 11, y + 1);
      ctx.fillStyle = col;
      ctx.fillText(text, x + 10, y);
    };
    const placed = [];
    const put0 = put;
    const putOnce = (pos, text, col) => {
      v.copy(pos).project(this.camera);
      const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
      for (const q of placed) if (Math.abs(q[0] - x) < 90 && Math.abs(q[1] - y) < 13) return;
      placed.push([x, y]);
      put0(pos, text, col);
    };
    for (const o of this.scene.children) {
      if (o.userData.kind === 'you') putOnce(new THREE.Vector3(...o.geometry.attributes.position.array), o.userData.label, '#ffb24a');
    }
    for (const o of this.scene.children) {
      if (o.userData.kind === 'you') continue;
      if (o.userData.kind === 'core') putOnce(new THREE.Vector3(...o.geometry.attributes.position.array), 'Sagittarius A*', '#ffb27a');
      else if (o.userData.label) putOnce(new THREE.Vector3(...o.geometry.attributes.position.array), o.userData.label, '#cfe3ff');
    }
    if (this.sel) put(new THREE.Vector3(this.sel.ly[0] - this.anchor[0], this.sel.ly[1] - this.anchor[1], this.sel.ly[2] - this.anchor[2]), this.game.galaxy.nameOf(this.sel.rec), '#ffffff');
    // scale bar
    const lyPerPx = (this.dist * 2 * Math.tan((this.camera.fov * Math.PI) / 360)) / H;
    const nice = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000].find((n) => n / lyPerPx > 80) || 50000;
    const L = nice / lyPerPx;
    ctx.strokeStyle = 'rgba(232,236,242,0.6)';
    ctx.beginPath(); ctx.moveTo(W / 2 - L / 2, H - 30); ctx.lineTo(W / 2 + L / 2, H - 30); ctx.stroke();
    ctx.fillStyle = '#e8ecf2';
    ctx.textAlign = 'center';
    ctx.fillText(`${nice.toLocaleString('en-US')} light-years`, W / 2, H - 18);
    ctx.textAlign = 'left';
    ctx.restore();
  }
}

export { Galaxy, LY };
