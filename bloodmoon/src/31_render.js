
// =====================================================================
// RENDERER, SKY, LIGHT, FOG, RAIN — the look of the world.
// =====================================================================
let renderer, scene, camera, vmScene, vmCamera, sunLight, hemiLight, ambLight, vmSun, vmHemi;
const R = { pmrem: null, envT: 99, env: null, envScene: null, shadows: true };
function initRenderer() {
  const cv = $('#gl');
  renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: SET.quality !== 'low', powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, SET.quality === 'high' ? 1.5 : 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = SET.quality !== 'low'; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.autoClear = false;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(SET.fov, innerWidth / innerHeight, 0.08, 3200);
  scene.fog = new THREE.FogExp2(0x9aa8b8, 0.0022);
  // first-person arms and weapon live in their own little scene, drawn on top
  vmScene = new THREE.Scene(); vmCamera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.01, 10);
  sunLight = new THREE.DirectionalLight(0xffffff, 2.5); sunLight.castShadow = renderer.shadowMap.enabled;
  const sz = SET.quality === 'high' ? 2048 : 1024; sunLight.shadow.mapSize.set(sz, sz);
  const sc = sunLight.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 600;
  sunLight.shadow.bias = -0.0004; sunLight.shadow.normalBias = 0.6;
  scene.add(sunLight); scene.add(sunLight.target);
  hemiLight = new THREE.HemisphereLight(0xbcd2ff, 0x4a4030, 0.8); scene.add(hemiLight);
  ambLight = new THREE.AmbientLight(0x8090b0, 0.06); scene.add(ambLight);
  vmSun = new THREE.DirectionalLight(0xffffff, 1.5); vmSun.position.set(0.5, 1, 0.3); vmScene.add(vmSun);
  vmHemi = new THREE.HemisphereLight(0xbcd2ff, 0x4a4030, 0.8); vmScene.add(vmHemi);
  R.pmrem = new THREE.PMREMGenerator(renderer);
  Sky.init();
  addEventListener('resize', resizeRenderer); resizeRenderer();
}
function resizeRenderer() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); $('#gl').style.width = w + 'px'; $('#gl').style.height = h + 'px';
  camera.aspect = w / h; camera.updateProjectionMatrix(); vmCamera.aspect = w / h; vmCamera.updateProjectionMatrix();
}
// ---------- the sky dome ----------
const SKY_FRAG = `
uniform vec3 sunDir; uniform vec3 moonDir; uniform float night; uniform float blood; uniform float time; uniform float cloud; uniform float storm; uniform float flash;
varying vec3 vDir;
float hash(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x), mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x), mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm3(vec3 p){ float a=0., w=.5; for(int i=0;i<5;i++){ a+=w*noise(p); p*=2.03; w*=.5;} return a; }
void main(){
  vec3 d = normalize(vDir); float h = d.y; float sunH = sunDir.y;
  float dayK = smoothstep(-0.12, 0.22, sunH);
  float setK = 1.0 - smoothstep(0.0, 0.32, abs(sunH + 0.03));
  vec3 zen = mix(vec3(0.006,0.009,0.022), vec3(0.16,0.34,0.70), dayK);
  vec3 hor = mix(vec3(0.035,0.045,0.075), vec3(0.60,0.72,0.84), dayK);
  vec2 hd = normalize(d.xz + 1e-5), hs = normalize(sunDir.xz + 1e-5);
  float towardSun = max(0., dot(hd, hs));
  hor = mix(hor, vec3(0.98,0.48,0.22), setK * (0.3 + 0.7*pow(towardSun, 3.)) * smoothstep(-0.28, 0.04, sunH));
  zen = mix(zen, vec3(0.24,0.22,0.42), setK*0.35*dayK);
  vec3 col = mix(hor, zen, pow(clamp(h, 0., 1.), 0.45));
  col = mix(col, col*vec3(1.7,0.32,0.28) + vec3(0.07,0.0,0.0)*(1.-clamp(h,0.,1.)), blood*night);
  col = mix(col, mix(col, vec3(0.22,0.23,0.25)*(0.15+0.85*dayK), 0.7), storm);
  col = mix(col, hor*0.8, smoothstep(0.0, -0.25, h));
  float sd = max(0., dot(d, sunDir));
  col += vec3(1.0,0.86,0.62) * pow(sd, 1200.) * 18. * dayK * (1.-storm);
  col += vec3(1.0,0.62,0.32) * pow(sd, 10.) * 0.35 * (dayK*0.5 + setK*0.7) * (1.-storm*0.8);
  float md = max(0., dot(d, moonDir));
  vec3 moonCol = mix(vec3(0.92,0.94,1.0), vec3(1.0,0.16,0.1), blood);
  float disc = smoothstep(0.99925, 0.9996, md);
  float crater = fbm3(d*140.)*0.4;
  col += moonCol * disc * (1.5 - crater) * night * (1.-storm*0.7);
  col += moonCol * pow(md, 50.) * 0.3 * night * (1.+blood*2.);
  if (h > 0.) {
    vec3 sp = d*320.; float st = hash(floor(sp));
    float tw = 0.65 + 0.35*sin(time*2.5 + st*60.);
    col += vec3(step(0.9972, st)) * night * tw * (1.-cloud) * (1.-storm) * smoothstep(0.,0.25,h) * 1.3;
    vec2 uv = d.xz / (h + 0.12) * 1.4;
    float c = fbm3(vec3(uv*1.6 + vec2(time*0.006, time*0.003), time*0.002));
    float cov = smoothstep(0.66 - cloud*0.4 - storm*0.2, 0.98, c);
    vec3 cc = mix(vec3(0.035,0.035,0.05) + vec3(0.06,0.0,0.0)*blood, mix(vec3(0.78,0.78,0.80), vec3(1.0,0.72,0.55), setK*0.7), dayK);
    cc = mix(cc, cc*0.4, storm);
    cc += vec3(1.0,0.55,0.3)*pow(sd,5.)*0.5*dayK;
    col = mix(col, cc, cov * smoothstep(0.0, 0.2, h) * 0.92);
  }
  col += vec3(0.75,0.8,1.0) * flash * 0.9;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const Sky = {
  mesh: null, u: null, sunDir: new THREE.Vector3(0, 1, 0), moonDir: new THREE.Vector3(0, -1, 0),
  init() {
    this.u = { sunDir: { value: this.sunDir }, moonDir: { value: this.moonDir }, night: { value: 0 }, blood: { value: 0 }, time: { value: 0 }, cloud: { value: 0.3 }, storm: { value: 0 }, flash: { value: 0 } };
    const mat = new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }', fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = -10; scene.add(this.mesh);
    R.envScene = new THREE.Scene(); this.envMesh = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), mat); R.envScene.add(this.envMesh);
  },
  // the colour of the horizon right now (for fog), matching the shader roughly
  horizon(out) {
    const s = this.sunDir.y, day = smoothstep(-0.12, 0.22, s), set = 1 - smoothstep(0, 0.32, Math.abs(s + 0.03));
    let r = lerp(0.035, 0.6, day), g = lerp(0.045, 0.72, day), b = lerp(0.075, 0.84, day);
    const k = set * 0.45 * smoothstep(-0.28, 0.04, s); r = lerp(r, 0.85, k); g = lerp(g, 0.5, k); b = lerp(b, 0.32, k);
    const bl = this.u.blood.value * this.u.night.value; r = lerp(r, r * 1.7 + 0.05, bl); g = lerp(g, g * 0.32, bl); b = lerp(b, b * 0.28, bl);
    const st = this.u.storm.value; r = lerp(r, 0.2 * (0.15 + 0.85 * day), st * 0.7); g = lerp(g, 0.21 * (0.15 + 0.85 * day), st * 0.7); b = lerp(b, 0.23 * (0.15 + 0.85 * day), st * 0.7);
    out.setRGB(r, g, b, THREE.SRGBColorSpace); return out;
  },
};
// ---------- per-frame lighting from the clock and weather ----------
const _hc = new THREE.Color(), _tmpV = new THREE.Vector3();
function updateSkyAndLight(dt, focus) {
  const t = Clock.minutes(), dayFrac = t / 1440; // 0 = midnight
  const sunAng = (dayFrac - 0.25) * TAU; // sunrise ~06:00, sunset ~18:00 + a long dusk
  Sky.sunDir.set(Math.cos(sunAng) * 0.8, Math.sin(sunAng), 0.35).normalize();
  Sky.moonDir.set(-Math.cos(sunAng) * 0.7, -Math.sin(sunAng) * 0.85 + 0.25, -0.4).normalize();
  if (Sky.moonDir.y < 0.15) Sky.moonDir.y = 0.15, Sky.moonDir.normalize();
  const day = smoothstep(-0.12, 0.22, Sky.sunDir.y), night = 1 - smoothstep(-0.2, 0.05, Sky.sunDir.y);
  const W = Weather, blood = Clock.bloodMoon() ? 1 : 0;
  Sky.u.night.value = night; Sky.u.blood.value = damp(Sky.u.blood.value, blood, 0.5, dt); Sky.u.time.value += dt;
  Sky.u.cloud.value = damp(Sky.u.cloud.value, W.cloud(), 0.3, dt); Sky.u.storm.value = damp(Sky.u.storm.value, W.stormK(), 0.3, dt); Sky.u.flash.value = W.flash;
  const bl = Sky.u.blood.value * night, storm = Sky.u.storm.value;
  // sun by day, moon by night
  const useSun = Sky.sunDir.y > -0.05, dir = useSun ? Sky.sunDir : Sky.moonDir;
  _tmpV.copy(dir).multiplyScalar(300); sunLight.position.copy(focus).add(_tmpV); sunLight.target.position.copy(focus);
  if (useSun) { const warm = 1 - smoothstep(0.05, 0.35, Sky.sunDir.y); sunLight.color.setRGB(1, lerp(0.95, 0.62, warm), lerp(0.88, 0.4, warm)); sunLight.intensity = 3.0 * smoothstep(-0.05, 0.12, Sky.sunDir.y) * (1 - storm * 0.75); }
  else { sunLight.color.setRGB(lerp(0.55, 1.0, bl), lerp(0.62, 0.2, bl), lerp(0.85, 0.16, bl)); sunLight.intensity = (0.32 + bl * 0.25) * (1 - storm * 0.6); }
  sunLight.intensity += W.flash * 3;
  hemiLight.color.setRGB(lerp(0.12, 0.72, day) + bl * 0.15, lerp(0.14, 0.8, day) * (1 - bl * 0.6), lerp(0.24, 0.95, day) * (1 - bl * 0.6));
  hemiLight.groundColor.setRGB(lerp(0.04, 0.32, day), lerp(0.035, 0.27, day), lerp(0.03, 0.2, day));
  hemiLight.intensity = lerp(0.55, 1.05, day) * (1 - storm * 0.35) + W.flash;
  ambLight.intensity = 0.05 + night * 0.08;
  // fog: thicker at night, in rain and in the swamp
  Sky.horizon(_hc); scene.fog.color.copy(_hc);
  let fd = 0.0016 + night * 0.0012 + W.fogK() * 0.012 + storm * 0.003 + bl * 0.0015;
  if (G.area === 'outside') { const P = PLACES.swamp, ds = Math.hypot(focus.x - P.x, focus.z - P.z); fd += (1 - smoothstep(P.r * 0.5, P.r + 60, ds)) * 0.009; }
  else fd = 0.03;
  scene.fog.density = damp(scene.fog.density, fd, 1.2, dt);
  renderer.toneMappingExposure = lerp(1.55, 1.0, day) + bl * 0.1;
  vmSun.intensity = sunLight.intensity * 0.6 + 0.4; vmSun.color.copy(sunLight.color); vmHemi.color.copy(hemiLight.color); vmHemi.groundColor.copy(hemiLight.groundColor); vmHemi.intensity = hemiLight.intensity;
  // reflections: re-bake the sky environment now and then
  R.envT += dt; if (R.envT > 6 && SET.quality !== 'low') { R.envT = 0; if (R.env) R.env.dispose(); R.env = R.pmrem.fromScene(R.envScene, 0, 0.1, 1000); scene.environment = R.env.texture; }
  Sky.mesh.position.copy(camera.position);
}
// ---------- rain, snow and lightning ----------
const RainFX = {
  mesh: null, n: 0, pos: null, vel: null,
  init() {
    this.n = SET.quality === 'low' ? 1200 : 3500; this.pos = new Float32Array(this.n * 6); this.base = new Float32Array(this.n * 3);
    for (let i = 0; i < this.n; i++) { this.base[i * 3] = rand(-35, 35); this.base[i * 3 + 1] = rand(0, 30); this.base[i * 3 + 2] = rand(-35, 35); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9aa6b8, transparent: true, opacity: 0.35, fog: true })); this.mesh.frustumCulled = false; scene.add(this.mesh);
  },
  update(dt, amt, snow) {
    const show = amt > 0.02 && G.area === 'outside'; this.mesh.visible = show; if (!show) return;
    const n = Math.floor(this.n * clamp(amt, 0, 1)), cx = camera.position.x, cy = camera.position.y, cz = camera.position.z, P = this.pos, B = this.base;
    const fall = snow ? 3 : 22, len = snow ? 0.08 : 0.55, wx = Weather.wind * (snow ? 4 : 3);
    this.mesh.material.opacity = snow ? 0.8 : 0.32; this.mesh.material.color.setHex(snow ? 0xffffff : 0x9aa6b8);
    for (let i = 0; i < this.n; i++) {
      const k = i * 3; B[k + 1] -= fall * dt; B[k] += wx * dt; if (snow) B[k] += Math.sin(i + Sky.u.time.value) * dt * 0.6;
      if (B[k + 1] < -6) { B[k + 1] += 30; B[k] = rand(-35, 35); B[k + 2] = rand(-35, 35); }
      const x = cx + B[k], y = cy + B[k + 1] - 8, z = cz + B[k + 2], o = i * 6;
      if (i >= n) { P[o] = P[o + 3] = 0; P[o + 1] = P[o + 4] = -999; P[o + 2] = P[o + 5] = 0; continue; }
      P[o] = x; P[o + 1] = y; P[o + 2] = z; P[o + 3] = x - wx * 0.03; P[o + 4] = y + len * (snow ? 1 : 1.6); P[o + 5] = z;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  },
};
