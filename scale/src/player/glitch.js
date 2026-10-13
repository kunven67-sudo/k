// THE GLITCH: the player's non-human hacker scientist.
//
// Built at real human size (1.75 m, feet at y = 0, facing -Z) from a bone hierarchy of groups, so
// every part follows the procedural animation exactly: hips, spine, chest, neck, head (hood with a
// void face), shoulders, arms, hands, legs, boots. On top: a long lab coat (body, sleeves, three
// tail panels that swing with the legs and lag behind when you run), techwear straps, a backpack
// with two cables plugged into the forearms, and glowing circuit lines that pulse with a heartbeat.
//
// The glitch effect runs in the shaders of the coat, hood and suit: horizontal slices jump sideways,
// edges split into red/cyan, pixel blocks flicker. It's calm when idle and goes wild while you shrink
// or grow, when you're hurt, or when you possess something (set via setGlitch()).
import * as THREE from 'three';
import { prep } from '../render/materials.js';
import * as TX from '../render/textures.js';
import { clamp, damp } from '../core/util.js';

const U = {
  uTime: { value: 0 },
  uGlitch: { value: 0.035 },
  uRootY: { value: 0 },
  uScale: { value: 1 },
  uEye: { value: new THREE.Color(0x35f3ff) },
};

// ---- glitch shader hook --------------------------------------------------------------------------
const GLITCH_V_DECL = /* glsl */ `
uniform float uTime; uniform float uGlitch; uniform float uRootY; uniform float uScale;
varying float vGBand; varying float vGShift;
float g_h( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
`;
const GLITCH_V_BODY = /* glsl */ `
{
  vec4 gw = modelMatrix * vec4( transformed, 1.0 );
  float yl = ( gw.y - uRootY ) / max( uScale, 1e-6 );
  float band = floor( yl * 22.0 );
  float t = floor( uTime * 14.0 );
  float h = g_h( vec2( band, t ) );
  float on = step( h, uGlitch * 0.32 );
  float sh = ( g_h( vec2( band + 7.0, t ) ) - 0.5 ) * 0.09 * on * ( 0.4 + uGlitch );
  vGBand = band; vGShift = sh;
  // shift in the model's own local X (sideways for most parts)
  transformed.x += sh / max( length( modelMatrix[ 0 ].xyz ) / max( uScale, 1e-6 ), 1e-3 );
}
`;
const GLITCH_F_DECL = /* glsl */ `
uniform float uTime; uniform float uGlitch;
varying float vGBand; varying float vGShift;
float g_h2( vec2 p ) { return fract( sin( dot( p, vec2( 269.5, 183.3 ) ) ) * 43758.5453 ); }
`;
const GLITCH_F_BODY = /* glsl */ `
{
  // RGB split on shifted slices: red one way, cyan the other.
  float s = clamp( vGShift * 30.0, -1.0, 1.0 );
  totalEmissiveRadiance += vec3( max( s, 0.0 ) * 0.9, 0.0, max( s, 0.0 ) * 0.25 );
  totalEmissiveRadiance += vec3( 0.0, max( -s, 0.0 ) * 0.7, max( -s, 0.0 ) * 0.9 );
  // Flickering pixel blocks.
  vec2 blk = floor( gl_FragCoord.xy / 7.0 );
  float t = floor( uTime * 18.0 );
  float b = g_h2( blk + t * 1.37 );
  if ( b < max( 0.0, uGlitch - 0.08 ) * 0.06 ) {
    float c = g_h2( blk * 3.1 + t );
    totalEmissiveRadiance += ( c < 0.5 ? vec3( 0.2, 1.0, 1.1 ) : vec3( 1.1, 0.15, 0.6 ) ) * 2.0;
  }
  if ( b > 1.0 - max( 0.0, uGlitch - 0.08 ) * 0.03 ) discard; // bits missing for a frame
}
`;

function glitchify(mat) {
  mat.userData.cacheKey = 'glitch';
  mat.userData.onCompile = (shader) => {
    Object.assign(shader.uniforms, { uTime: U.uTime, uGlitch: U.uGlitch, uRootY: U.uRootY, uScale: U.uScale });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + GLITCH_V_DECL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + GLITCH_V_BODY);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GLITCH_F_DECL)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + GLITCH_F_BODY);
  };
  mat.needsUpdate = true;
  return mat;
}

// ---- textures --------------------------------------------------------------------------------------
function circuitTexture() {
  const W = 256, H = 512;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineWidth = 2;
  let seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // Long vertical traces with right-angle jogs and via dots (like a circuit board).
  for (let k = 0; k < 9; k++) {
    let x = 14 + k * 28 + r() * 8;
    let y = 0;
    g.beginPath();
    g.moveTo(x, y);
    while (y < H) {
      y += 30 + r() * 70;
      g.lineTo(x, y);
      if (r() < 0.55) {
        const nx = x + (r() < 0.5 ? -1 : 1) * (10 + r() * 14);
        g.lineTo(nx, y + 10);
        x = nx;
        y += 10;
      }
      if (r() < 0.35) {
        g.stroke();
        g.beginPath();
        g.arc(x, y, 3.2, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.moveTo(x, y);
      }
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function eyeTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.95)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv);
  return t;
}

// ---- geometry helpers ------------------------------------------------------------------------------
// A limb segment hanging down from its joint (-Y), tapered, rounded ends.
function limb(len, r0, r1, seg = 14) {
  const pts = [];
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = -t * len;
    let r = r0 + (r1 - r0) * t;
    if (i === 0) r *= 0.55;
    if (i === 1) r *= 0.92;
    if (i === n - 1) r *= 0.95;
    if (i === n) r *= 0.6;
    pts.push(new THREE.Vector2(r, y));
  }
  pts.unshift(new THREE.Vector2(0, 0.0));
  pts.push(new THREE.Vector2(0, -len));
  const g = new THREE.LatheGeometry(pts, seg);
  return g;
}

function lathe(profile, seg = 24) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}

// A coat tail panel: a curved cloth strip hanging from the waist (top edge at y=0).
function panel(width, length, curve, bulge = 0.02) {
  const g = new THREE.PlaneGeometry(width, length, 8, 10);
  g.translate(0, -length / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const u = x / (width / 2);
    const flare = 1 + (-y / length) * 0.25;
    p.setX(i, x * flare);
    p.setZ(i, -curve * (1 - u * u) - bulge * Math.sin((-y / length) * Math.PI));
  }
  g.computeVertexNormals();
  return g;
}

function mesh(geo, mat, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function bone(parent, name, x = 0, y = 0, z = 0) {
  const b = new THREE.Group();
  b.name = name;
  b.position.set(x, y, z);
  parent.add(b);
  return b;
}

// ---- the model -------------------------------------------------------------------------------------
export function createGlitch({ coat = 0xe9e7e2, coatTrim = 0x1a1c22, suit = 0x101217, circuit = 0x35f3ff, eye = 0x35f3ff } = {}) {
  U.uEye.value.set(eye);
  const root = new THREE.Group();
  root.name = 'glitch';

  // Materials (registered so shadows/lighting/detail work; glitch hook on the clothes).
  const coatTex = TX.fabric(coat, 160);
  const mCoat = glitchify(prep(new THREE.MeshStandardMaterial({ map: coatTex.map, normalMap: coatTex.normalMap, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.85, side: THREE.DoubleSide }), { detail: 'fabric' }));
  const mTrim = glitchify(prep(new THREE.MeshStandardMaterial({ color: coatTrim, roughness: 0.6, side: THREE.DoubleSide }), { detail: 'fabric' }));
  const circ = circuitTexture();
  const mSuit = glitchify(prep(new THREE.MeshStandardMaterial({ color: suit, roughness: 0.45, metalness: 0.2, emissive: new THREE.Color(circuit), emissiveMap: circ, emissiveIntensity: 0.9 }), { detail: 'plastic' }));
  circ.repeat.set(2, 1);
  const mStrap = prep(new THREE.MeshStandardMaterial({ color: 0x23262d, roughness: 0.5, metalness: 0.3 }), { detail: 'plastic' });
  const mMetal = prep(new THREE.MeshStandardMaterial({ color: 0x8b9099, roughness: 0.3, metalness: 1 }), { detail: 'metal' });
  const mGlove = prep(new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.4, metalness: 0.1 }), { detail: 'plastic' });
  const mBoot = prep(new THREE.MeshStandardMaterial({ color: 0x0f1013, roughness: 0.55 }), { detail: 'plastic' });
  const mSole = prep(new THREE.MeshStandardMaterial({ color: 0x2c2e33, roughness: 0.9 }), { detail: 'plastic' });
  const mHood = glitchify(prep(new THREE.MeshStandardMaterial({ color: 0x15161b, roughness: 0.85, side: THREE.DoubleSide }), { detail: 'fabric' }));
  const mVoid = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uGlitch: U.uGlitch },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uTime; uniform float uGlitch; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){
        vec2 c = floor(vUv * vec2(90.0, 70.0));
        float n = h(c + floor(uTime * 24.0));
        float scan = 0.5 + 0.5 * sin(vUv.y * 180.0 + uTime * 9.0);
        float edge = smoothstep(0.0, 0.35, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
        float v = (n * 0.05 + scan * 0.012) * (0.6 + uGlitch * 2.0) * edge;
        gl_FragColor = vec4(vec3(v * 0.8, v, v * 1.15), 1.0);
      }`,
  });
  const mEye = new THREE.MeshBasicMaterial({ color: U.uEye.value, map: eyeTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const mEyeCore = new THREE.MeshBasicMaterial({ color: new THREE.Color(eye).multiplyScalar(4), toneMapped: false });

  // ---- skeleton ----
  const B = {};
  B.hips = bone(root, 'hips', 0, 0.95, 0);
  B.spine = bone(B.hips, 'spine', 0, 0.1, 0);
  B.chest = bone(B.spine, 'chest', 0, 0.2, 0);
  B.neck = bone(B.chest, 'neck', 0, 0.2, -0.01);
  B.head = bone(B.neck, 'head', 0, 0.09, 0);
  for (const s of [-1, 1]) {
    const k = s < 0 ? 'L' : 'R';
    B['shoulder' + k] = bone(B.chest, 'shoulder' + k, 0.19 * s, 0.15, 0);
    B['arm' + k] = bone(B['shoulder' + k], 'arm' + k, 0, 0, 0);
    B['elbow' + k] = bone(B['arm' + k], 'elbow' + k, 0, -0.3, 0);
    B['wrist' + k] = bone(B['elbow' + k], 'wrist' + k, 0, -0.26, 0);
    B['hip' + k] = bone(B.hips, 'hip' + k, 0.1 * s, -0.03, 0);
    B['knee' + k] = bone(B['hip' + k], 'knee' + k, 0, -0.44, 0);
    B['ankle' + k] = bone(B['knee' + k], 'ankle' + k, 0, -0.41, 0);
  }

  // ---- body (techwear undersuit with circuit lines) ----
  mesh(lathe([[0, -0.1], [0.135, -0.08], [0.16, 0.0], [0.15, 0.08], [0.0, 0.1]], 20), mSuit, B.hips); // pelvis
  mesh(lathe([[0, -0.02], [0.13, 0.0], [0.135, 0.12], [0.0, 0.16]], 20), mSuit, B.spine); // abdomen
  const torsoGeo = lathe([[0, -0.04], [0.145, -0.02], [0.165, 0.08], [0.178, 0.15], [0.14, 0.205], [0.06, 0.225], [0, 0.225]], 28);
  // Flatter chest front and back like a real ribcage (not a round barrel).
  {
    const tp = torsoGeo.attributes.position;
    for (let i = 0; i < tp.count; i++) {
      const z = tp.getZ(i);
      tp.setZ(i, z < 0 ? z * 0.62 : z * 0.7);
    }
    torsoGeo.computeVertexNormals();
  }
  const torso = mesh(torsoGeo, mSuit, B.chest);
  mesh(limb(0.11, 0.05, 0.055, 12), mSuit, B.neck, 0, 0.1, 0);
  for (const s of [-1, 1]) {
    const k = s < 0 ? 'L' : 'R';
    mesh(new THREE.SphereGeometry(0.065, 16, 12), mSuit, B['shoulder' + k]);
    mesh(limb(0.3, 0.052, 0.042), mSuit, B['arm' + k]);
    mesh(limb(0.26, 0.044, 0.034), mSuit, B['elbow' + k]);
    mesh(limb(0.44, 0.078, 0.055), mSuit, B['hip' + k]);
    mesh(limb(0.41, 0.056, 0.042), mSuit, B['knee' + k]);
    // Gloves: palm + fingers block + thumb.
    const palm = mesh(new THREE.BoxGeometry(0.08, 0.09, 0.03), mGlove, B['wrist' + k], 0, -0.05, 0);
    palm.geometry.translate(0, 0, 0);
    mesh(new THREE.BoxGeometry(0.075, 0.075, 0.026), mGlove, B['wrist' + k], 0, -0.125, -0.004).rotation.x = -0.25;
    mesh(new THREE.CapsuleGeometry(0.012, 0.04, 4, 8), mGlove, B['wrist' + k], -0.045 * s, -0.06, -0.02).rotation.z = 0.5 * s;
    // Boots: shaft + foot + sole, toe pointing -Z.
    mesh(limb(0.11, 0.05, 0.048), mBoot, B['ankle' + k], 0, 0.1, 0);
    const foot = mesh(new THREE.BoxGeometry(0.1, 0.075, 0.25, 2, 2, 4), mBoot, B['ankle' + k], 0, -0.033, -0.06);
    roundBox(foot.geometry, 0.03);
    mesh(new THREE.BoxGeometry(0.104, 0.02, 0.26), mSole, B['ankle' + k], 0, -0.069, -0.06);
    // Forearm cable sockets (metal rings).
    const ring = mesh(new THREE.TorusGeometry(0.046, 0.009, 8, 20), mMetal, B['elbow' + k], 0, -0.12, 0);
    ring.rotation.x = Math.PI / 2;
  }

  // ---- hood with void face ----
  const hoodGeo = lathe([[0.075, -0.15], [0.112, -0.12], [0.138, -0.04], [0.143, 0.04], [0.128, 0.11], [0.088, 0.162], [0.03, 0.185], [0, 0.187]], 32);
  shapeHood(hoodGeo);
  const hood = mesh(hoodGeo, mHood, B.head, 0, 0.0, 0.02);
  // Cut the face opening by covering it with the void (slightly inside the hood front).
  // The void sits recessed inside the opening (a shallow dish so it reads as depth, not a sticker).
  const voidGeo = new THREE.SphereGeometry(0.11, 24, 16, Math.PI * 0.5, Math.PI, Math.PI * 0.18, Math.PI * 0.64);
  const voidFace = mesh(voidGeo, mVoid, B.head, 0, -0.005, -0.03);
  voidFace.scale.set(0.82, 1.05, 0.62);
  voidFace.castShadow = false;
  // Hood rim (thicker edge around the opening).
  const rim = mesh(new THREE.TorusGeometry(0.1, 0.017, 10, 32), mHood, B.head, 0, -0.005, -0.112);
  rim.scale.set(0.92, 1.22, 0.7);
  // Hood drape down the back and shoulders.
  const drape = mesh(lathe([[0.1, 0.02], [0.16, -0.06], [0.22, -0.14], [0.0, -0.15]], 24), mHood, B.neck, 0, 0.05, 0.02);
  drape.scale.set(1, 1, 0.8);
  // Eyes: glowing cores + soft glow, inside the void.
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Group();
    e.position.set(0.032 * s, 0.01, -0.098);
    B.head.add(e);
    const core = new THREE.Mesh(new THREE.CircleGeometry(0.009, 14), mEyeCore);
    core.scale.set(1.5, 0.75, 1);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.05), mEye);
    glow.position.z = -0.001;
    e.add(core, glow);
    e.rotation.y = Math.PI;
    eyes.push(e);
  }

  // ---- lab coat ----
  // Body of the coat: open-front shell around chest and abdomen.
  const coatBody = mesh(lathe([[0.17, -0.3], [0.18, -0.15], [0.19, 0.0], [0.205, 0.12], [0.21, 0.2], [0.17, 0.26], [0.09, 0.29]], 28), mCoat, B.chest, 0, 0, 0);
  coatBody.scale.set(1, 1, 0.78);
  openFront(coatBody.geometry, 0.55);
  // Lapels / collar.
  for (const s of [-1, 1]) {
    const lap = mesh(new THREE.BoxGeometry(0.06, 0.24, 0.012), mTrim, B.chest, 0.07 * s, 0.1, -0.15);
    lap.rotation.z = -0.25 * s;
    lap.rotation.x = 0.12;
  }
  const collar = mesh(lathe([[0.1, 0.0], [0.11, 0.05], [0.085, 0.09]], 24), mCoat, B.chest, 0, 0.22, 0.01);
  openFront(collar.geometry, 0.45);
  // Sleeves (wider than the arm, cuffs at the forearm).
  for (const s of [-1, 1]) {
    const k = s < 0 ? 'L' : 'R';
    mesh(limb(0.31, 0.075, 0.064, 16), mCoat, B['arm' + k], 0, 0.02, 0);
    mesh(limb(0.2, 0.064, 0.058, 16), mCoat, B['elbow' + k], 0, 0.01, 0);
    const cuff = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 16, 1, true), mTrim, B['elbow' + k], 0, -0.2, 0);
    cuff.castShadow = false;
    // Shoulder pad of the coat.
    mesh(new THREE.SphereGeometry(0.085, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mCoat, B['shoulder' + k], 0, -0.005, 0);
  }
  // Tail panels hanging from the waist: back, front-left, front-right. They swing in the animation.
  const tails = {};
  tails.back = bone(B.hips, 'tailBack', 0, 0.03, 0.1);
  mesh(panel(0.36, 0.6, -0.07, 0.015), mCoat, tails.back);
  for (const s of [-1, 1]) {
    const k = s < 0 ? 'L' : 'R';
    tails[k] = bone(B.hips, 'tail' + k, 0.12 * s, 0.03, -0.06);
    tails[k].rotation.y = -0.5 * s;
    const p = mesh(panel(0.2, 0.58, 0.05, 0.01), mCoat, tails[k]);
    p.rotation.y = Math.PI;
    // Side panels so there's no gap at the hips.
    const side = bone(B.hips, 'side' + k, 0.17 * s, 0.03, 0.03);
    side.rotation.y = (Math.PI / 2) * s;
    mesh(panel(0.17, 0.59, 0.02, 0.01), mCoat, side);
    tails['side' + k] = side;
  }
  // Belt with pouches.
  const belt = mesh(new THREE.TorusGeometry(0.16, 0.018, 8, 32), mStrap, B.hips, 0, 0.04, 0);
  belt.rotation.x = Math.PI / 2;
  belt.scale.set(1, 0.78, 1);
  mesh(new THREE.BoxGeometry(0.05, 0.07, 0.035), mStrap, B.hips, 0.14, 0.0, -0.06);
  mesh(new THREE.BoxGeometry(0.035, 0.035, 0.02), mMetal, B.hips, 0, 0.04, -0.13);

  // ---- techwear straps + backpack ----
  for (const s of [-1, 1]) {
    const strap = mesh(new THREE.BoxGeometry(0.035, 0.36, 0.012), mStrap, B.chest, 0.09 * s, 0.07, -0.135);
    strap.rotation.z = 0.32 * s;
    const strapB = mesh(new THREE.BoxGeometry(0.035, 0.3, 0.012), mStrap, B.chest, 0.09 * s, 0.07, 0.13);
    strapB.rotation.z = -0.2 * s;
  }
  mesh(new THREE.BoxGeometry(0.12, 0.05, 0.02), mMetal, B.chest, 0, 0.05, -0.145); // chest clasp
  const pack = mesh(new THREE.BoxGeometry(0.28, 0.36, 0.11), mStrap, B.chest, 0, 0.06, 0.2);
  roundBox(pack.geometry, 0.03);
  const packLight = mesh(new THREE.BoxGeometry(0.2, 0.012, 0.004), new THREE.MeshBasicMaterial({ color: new THREE.Color(circuit).multiplyScalar(3), toneMapped: false }), B.chest, 0, 0.15, 0.257);
  packLight.castShadow = false;
  const ports = {};
  for (const s of [-1, 1]) {
    const k = s < 0 ? 'L' : 'R';
    ports[k] = bone(B.chest, 'port' + k, 0.15 * s, -0.04, 0.2);
    mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 12), mMetal, ports[k]).rotation.z = Math.PI / 2;
  }
  // Cables: rebuilt each frame from the backpack ports to the forearm rings, with sag.
  const cables = [];
  const cableMat = prep(new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.35, emissive: new THREE.Color(circuit), emissiveIntensity: 0.25 }), { detail: 'plastic' });
  for (const k of ['L', 'R']) {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), cableMat);
    m.castShadow = true;
    m.frustumCulled = false;
    root.add(m);
    cables.push({ k, mesh: m });
  }

  // ---- animation state ----
  const st = { phase: 0, run: 0, air: 0, lean: 0, t: 0, blink: 0, tailBack: 0, tailVel: 0, squint: 0, look: 0, glitch: 0.035, glitchTarget: 0.035 };
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

  function updateCables() {
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    for (const c of cables) {
      ports[c.k].getWorldPosition(_a).applyMatrix4(inv);
      B['elbow' + c.k].localToWorld(_b.set(0, -0.12, 0.045)).applyMatrix4(inv);
      _c.lerpVectors(_a, _b, 0.5);
      _c.y -= 0.12;
      _c.z += 0.06;
      const curve = new THREE.CatmullRomCurve3([_a.clone(), _a.clone().lerp(_c, 0.5).add(new THREE.Vector3(0, -0.02, 0.03)), _c.clone(), _c.clone().lerp(_b, 0.5), _b.clone()]);
      c.mesh.geometry.dispose();
      c.mesh.geometry = new THREE.TubeGeometry(curve, 18, 0.011, 6, false);
    }
  }

  // speed: horizontal speed normalized to human size (m/s at 1.75 m). scale: body scale.
  function animate(dt, { speed = 0, grounded = true, vy = 0, crouch = false, scaleRate = 0, scale = 1, hurt = 0, poseR = null, poseL = null, aimPitch = 0, held = false, dead = false } = {}) {
    st.t += dt;
    U.uTime.value = st.t;
    // Glitch intensity: calm idle flicker, wild while resizing or hurt.
    st.glitchTarget = 0.035 + Math.min(1, Math.abs(scaleRate) * 1.2) + hurt * 0.8 + (held ? 0.3 : 0);
    st.glitch = damp(st.glitch, st.glitchTarget, 6, dt);
    U.uGlitch.value = st.glitch;
    root.updateWorldMatrix(true, false);
    U.uRootY.value = root.matrixWorld.elements[13];
    U.uScale.value = scale;

    // Real cadence: legs cycle faster on smaller bodies (pendulum physics), slower on giants.
    const cadenceScale = 1 / Math.sqrt(Math.max(1e-6, scale));
    const run = clamp((speed - 1.8) / 2.2, 0, 1);
    st.run = damp(st.run, run, 8, dt);
    const stepsPerSec = speed < 0.05 ? 0 : clamp(1.3 + speed * 0.42, 1.3, 3.4);
    st.phase += dt * stepsPerSec * Math.PI * cadenceScale;
    const moving = clamp(speed / 0.6, 0, 1);
    st.air = damp(st.air, grounded ? 0 : 1, 10, dt);
    const r = st.run;
    const ph = st.phase;
    const A = (0.42 + 0.38 * r) * moving; // thigh swing
    const K = (0.75 + 0.85 * r) * moving; // knee bend
    const crouchK = crouch ? 1 : 0;

    for (const [k, off] of [['L', 0], ['R', Math.PI]]) {
      const p = ph + off;
      let thigh = A * Math.sin(p);
      let knee = -K * Math.pow(Math.max(0, Math.sin(p + 1.15)), 1.6) - 0.05 * moving;
      // In the air: tuck when going up, reach when coming down.
      thigh = thigh * (1 - st.air) + st.air * (vy > 0 ? 0.55 : 0.25) * (k === 'L' ? 1 : 0.6);
      knee = knee * (1 - st.air) + st.air * (vy > 0 ? -0.95 : -0.35);
      thigh += crouchK * 0.9;
      knee -= crouchK * 1.5;
      B['hip' + k].rotation.x = thigh;
      B['hip' + k].rotation.z = (k === 'L' ? -1 : 1) * 0.03;
      B['knee' + k].rotation.x = knee;
      B['ankle' + k].rotation.x = -(thigh + knee) * 0.65 + crouchK * 0.2;
      // Arms swing opposite to the legs, elbows bend more when running.
      const armSwing = -Math.sin(p) * (0.32 + 0.45 * r) * moving;
      const s = k === 'L' ? -1 : 1;
      B['arm' + k].rotation.x = armSwing * (1 - st.air) + st.air * (vy > 0 ? -0.6 : -1.1);
      B['arm' + k].rotation.z = s * (0.08 + st.air * 0.5 + 0.03 * Math.sin(st.t * 1.3));
      B['elbow' + k].rotation.x = -(0.25 + 1.05 * r * moving + st.air * 0.4 + 0.08 * Math.sin(st.t * 1.1));
      B['wrist' + k].rotation.x = -0.1;
    }
    // Hand poses override the swing: aiming the ray, holding things, the phone.
    st.poseR = damp(st.poseR ?? 0, poseR ? 1 : 0, 12, dt);
    st.poseL = damp(st.poseL ?? 0, poseL ? 1 : 0, 12, dt);
    const blendPose = (k, x, z, elbow, wrist, w) => {
      B['arm' + k].rotation.x += (x - B['arm' + k].rotation.x) * w;
      B['arm' + k].rotation.z += (z - B['arm' + k].rotation.z) * w;
      B['elbow' + k].rotation.x += (elbow - B['elbow' + k].rotation.x) * w;
      B['wrist' + k].rotation.x += (wrist - B['wrist' + k].rotation.x) * w;
    };
    if (poseR === 'aim') blendPose('R', Math.PI / 2 + aimPitch, 0.04, -0.04, 0, st.poseR);
    else if (poseR === 'hold') blendPose('R', 0.85, 0.12, -1.0, -0.2, st.poseR);
    else if (poseR === 'carry2') blendPose('R', 1.05, -0.28, -0.75, -0.3, st.poseR);
    if (poseL === 'phone') blendPose('L', 0.55, 0.1, -1.75, 0.35, st.poseL);
    else if (poseL === 'hold') blendPose('L', 0.85, -0.12, -1.0, -0.2, st.poseL);
    else if (poseL === 'carry2') blendPose('L', 1.05, 0.28, -0.75, -0.3, st.poseL);

    // Caught by something: kicking legs, arms pushing up at what's holding you (fast, desperate).
    st.held = damp(st.held ?? 0, held ? 1 : 0, 10, dt);
    if (st.held > 0.01) {
      const w = st.held, f = st.t * 13 * cadenceScale;
      for (const [k, off] of [['L', 0], ['R', 2.1]]) {
        const s = k === 'L' ? -1 : 1;
        B['hip' + k].rotation.x += (Math.sin(f + off) * 0.7 + 0.3 - B['hip' + k].rotation.x) * w;
        B['knee' + k].rotation.x += (-0.6 - Math.max(0, Math.sin(f + off + 1)) * 0.9 - B['knee' + k].rotation.x) * w;
        B['arm' + k].rotation.x += (-2.5 + Math.sin(f * 1.1 + off) * 0.45 - B['arm' + k].rotation.x) * w;
        B['arm' + k].rotation.z += (s * (0.35 + Math.sin(f + off) * 0.15) - B['arm' + k].rotation.z) * w;
        B['elbow' + k].rotation.x += (-0.5 - Math.max(0, Math.sin(f * 1.3 + off)) * 0.9 - B['elbow' + k].rotation.x) * w;
      }
    }
    // Dead: limp (arms out, knees soft, head rolled to the side).
    st.dead = damp(st.dead ?? 0, dead ? 1 : 0, 6, dt);
    if (st.dead > 0.01) {
      const w = st.dead;
      for (const k of ['L', 'R']) {
        const s = k === 'L' ? -1 : 1;
        B['hip' + k].rotation.x += (0.15 - B['hip' + k].rotation.x) * w;
        B['knee' + k].rotation.x += (-0.25 - B['knee' + k].rotation.x) * w;
        B['arm' + k].rotation.x += (-0.2 - B['arm' + k].rotation.x) * w;
        B['arm' + k].rotation.z += (s * 0.9 - B['arm' + k].rotation.z) * w;
        B['elbow' + k].rotation.x += (-0.2 - B['elbow' + k].rotation.x) * w;
      }
    }

    // Hips bob and twist, body leans into running.
    const bob = Math.abs(Math.sin(ph)) * (0.012 + 0.03 * r) * moving;
    B.hips.position.y = 0.95 - bob - crouchK * 0.28 + Math.sin(st.t * 1.6) * 0.004 * (1 - moving);
    B.hips.rotation.y = Math.sin(ph) * 0.12 * moving;
    st.lean = damp(st.lean, 0.06 * moving + 0.16 * r * moving + crouchK * 0.35, 6, dt);
    B.spine.rotation.x = st.lean;
    B.chest.rotation.y = -Math.sin(ph) * 0.16 * moving;
    B.chest.rotation.x = Math.sin(st.t * 1.6) * 0.012 * (1 - moving); // breathing
    // Head: keeps level, slow idle look-around (deterministic, no randomness).
    st.look = damp(st.look, (1 - moving) * Math.sin(st.t * 0.37) * 0.35, 2, dt);
    B.head.rotation.y = st.look - B.chest.rotation.y;
    B.head.rotation.x = -st.lean * 0.6;
    if (st.dead > 0.01) {
      B.head.rotation.z = 0.5 * st.dead;
      B.head.rotation.x += 0.3 * st.dead;
    } else B.head.rotation.z = 0;

    // Coat tails: front panels follow each thigh, back panel lags and flutters with speed.
    const swingL = B.hipL.rotation.x, swingR = B.hipR.rotation.x;
    tails.L.rotation.x = Math.max(-0.1, swingL * 0.7) + 0.04;
    tails.R.rotation.x = Math.max(-0.1, swingR * 0.7) + 0.04;
    tails.sideL.rotation.x = swingL * 0.35;
    tails.sideR.rotation.x = swingR * 0.35;
    const wantBack = -0.12 * moving - 0.45 * r * moving - Math.max(0, vy) * 0.08 + st.air * -0.3;
    // Spring so the back of the coat swings and settles.
    const kSpring = 60, damping = 9;
    st.tailVel += ((wantBack + Math.sin(ph * 2) * 0.06 * r) - st.tailBack) * kSpring * dt - st.tailVel * damping * dt;
    st.tailBack += st.tailVel * dt;
    tails.back.rotation.x = Math.min(0.15, Math.max(-1.1, st.tailBack - Math.max(0, -Math.min(swingL, swingR)) * 0.6));

    // Eyes: blink every few seconds, squint while resizing.
    const blinkCycle = (st.t % 4.3) / 4.3;
    const blink = blinkCycle > 0.97 ? 0.1 : 1;
    st.squint = damp(st.squint, Math.min(1, Math.abs(scaleRate) * 2), 8, dt);
    // Dead: the eyes go dark.
    for (const e of eyes) {
      e.scale.y = blink * (1 - st.squint * 0.55) * (1 - st.dead * 0.92);
      e.visible = st.dead < 0.97;
    }

    updateCables();
  }

  root.userData.animate = animate;
  root.userData.bones = B;
  root.userData.setEyeColor = (c) => U.uEye.value.set(c);
  root.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true;
  });
  animate(0, {});
  return root;
}

// Turn a round lathe into a hood: longer, drooping back; a face opening cut out of the front.
function shapeHood(geo) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (z > 0) {
      const t = z / 0.14;
      z *= 1.25 + 0.25 * Math.max(0, 0.1 - y) * 4; // fuller back, more drape low
      y -= t * t * 0.025;
    }
    x *= 1.04;
    p.setXYZ(i, x, y, z);
  }
  // Cut the opening: drop triangles facing forward within the face oval.
  const idx = geo.index.array;
  const keep = [];
  for (let i = 0; i < idx.length; i += 3) {
    let cx = 0, cy = 0, cz = 0;
    for (let j = 0; j < 3; j++) {
      cx += p.getX(idx[i + j]) / 3;
      cy += p.getY(idx[i + j]) / 3;
      cz += p.getZ(idx[i + j]) / 3;
    }
    const inFace = cz < -0.02 && (cx / 0.092) ** 2 + ((cy + 0.005) / 0.118) ** 2 < 1;
    if (!inFace) keep.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  geo.setIndex(keep);
  geo.computeVertexNormals();
}

// Round the corners of a subdivided box geometry.
function roundBox(geo, r) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const c = bb.getCenter(new THREE.Vector3());
  const h = bb.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).sub(c);
    const inner = new THREE.Vector3(clamp(v.x, -h.x + r, h.x - r), clamp(v.y, -h.y + r, h.y - r), clamp(v.z, -h.z + r, h.z - r));
    const d = v.clone().sub(inner);
    if (d.lengthSq() > 1e-12) d.setLength(r);
    v.copy(inner).add(d).add(c);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
}

// Remove the front of a lathe shell so the coat hangs open (angle = fraction of PI around -Z).
function openFront(geo, frac) {
  const p = geo.attributes.position;
  const idx = geo.index.array;
  const keep = [];
  for (let i = 0; i < idx.length; i += 3) {
    let cx = 0, cz = 0;
    for (let j = 0; j < 3; j++) {
      cx += p.getX(idx[i + j]);
      cz += p.getZ(idx[i + j]);
    }
    const ang = Math.atan2(cx, -cz); // 0 = straight ahead (-Z)
    if (Math.abs(ang) > (frac * Math.PI) / 2) keep.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  geo.setIndex(keep);
}
