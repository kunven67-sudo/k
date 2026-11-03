// THE MASK - the room: a clockmaker's study on a rainy night (cartoon). Warm lamps inside, cold moon + rain outside.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { toon, toonify, glowSprite, PAL } from './toon.js';

export const ROOM = { W: 6, D: 7, H: 3, win: { x0: -0.8, x1: 0.8, y0: 0.9, y1: 2.55 } };
const HW = ROOM.W / 2, HD = ROOM.D / 2;

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function box(w, h, d, x, y, z, color) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z);
  if (color !== undefined) {
    const c = new THREE.Color(color), n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  return g;
}
const vc = () => toon({ vertexColors: true });

function stripeTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const k = c.getContext('2d');
  k.fillStyle = '#3b2638'; k.fillRect(0, 0, 256, 256);
  k.fillStyle = '#46303f'; for (let x = 0; x < 256; x += 64) k.fillRect(x, 0, 32, 256);
  k.fillStyle = 'rgba(208,154,62,0.35)'; for (let x = 0; x < 256; x += 64) k.fillRect(x + 31, 0, 2, 256);
  // small diamonds down the wide stripe
  k.fillStyle = 'rgba(208,154,62,0.28)';
  for (let x = 48; x < 256; x += 64) for (let y = 16; y < 256; y += 32) {
    k.beginPath(); k.moveTo(x, y - 5); k.lineTo(x + 4, y); k.lineTo(x, y + 5); k.lineTo(x - 4, y); k.closePath(); k.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

/* ---------- floor: staggered planks in three browns ---------- */
function floor() {
  const r = rng(7), geos = [];
  const browns = [0x5e3826, 0x6a4029, 0x543120, 0x63402a];
  const pw = 0.2;
  for (let x = -HW; x < HW - 0.001; x += pw) {
    let z = -HD - r() * 1.2;
    while (z < HD) {
      const len = 0.9 + r() * 1.4, z0 = Math.max(z, -HD), z1 = Math.min(z + len, HD);
      if (z1 - z0 > 0.05) geos.push(box(pw - 0.008, 0.03, z1 - z0 - 0.008, x + pw / 2, -0.015, (z0 + z1) / 2, browns[(r() * browns.length) | 0]));
      z += len;
    }
  }
  geos.push(box(ROOM.W, 0.02, ROOM.D, 0, -0.035, 0, 0x24140e)); // gaps read dark
  const m = new THREE.Mesh(mergeGeometries(geos), vc()); m.receiveShadow = true; m.name = 'floor';
  return m;
}

/* ---------- walls: striped wallpaper above, wood paneling below, window cut in the back wall ---------- */
function walls() {
  const g = new THREE.Group();
  const paper = stripeTexture();
  const wallMat = (w, h) => { const t = paper.clone(); t.repeat.set(w / 0.9, h / 0.9); t.needsUpdate = true; return toon({ map: t }); };
  const plane = (w, h, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat(w, h)); m.position.set(x, y, z); m.rotation.y = ry;
    m.receiveShadow = true; m.castShadow = true; g.add(m); return m;
  };
  const { x0, x1, y0, y1 } = ROOM.win, H = ROOM.H;
  // back wall (z = -HD) around the window
  plane(x0 + HW, H, (-HW + x0) / 2, H / 2, -HD, 0);
  plane(HW - x1, H, (x1 + HW) / 2, H / 2, -HD, 0);
  plane(x1 - x0, y0, 0, y0 / 2, -HD, 0);
  plane(x1 - x0, H - y1, 0, (y1 + H) / 2, -HD, 0);
  plane(ROOM.D, H, -HW, H / 2, 0, Math.PI / 2); // left
  plane(ROOM.D, H, HW, H / 2, 0, -Math.PI / 2); // right
  plane(ROOM.W, H, 0, H / 2, HD, Math.PI); // front
  // invisible blockers behind the back wall so moonlight only enters through the window
  const back = new THREE.Group();
  const bm = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const blocker = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.25), bm); m.position.set(x, y, -HD - 0.15); m.castShadow = true; back.add(m); };
  blocker(x0 + HW + 0.5, H + 1, (-HW - 0.5 + x0) / 2, H / 2); blocker(HW + 0.5 - x1, H + 1, (x1 + HW + 0.5) / 2, H / 2);
  blocker(x1 - x0, y0, 0, y0 / 2); blocker(x1 - x0, H + 0.5 - y1, 0, (y1 + H + 0.5) / 2);
  g.add(back);
  // ceiling with beams
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.W, ROOM.D), toon({ color: PAL.ceiling }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = H; ceil.castShadow = true; g.add(ceil);
  const beams = [];
  for (let z = -HD + 0.7; z < HD; z += 1.4) beams.push(box(ROOM.W, 0.16, 0.18, 0, H - 0.08, z, 0x3a2219));
  const bmesh = new THREE.Mesh(mergeGeometries(beams), vc()); bmesh.castShadow = true; g.add(bmesh);

  // paneling (wainscot) on all walls, crown molding, baseboard
  const wood = [];
  const run = (len, cx, cz, ry, gaps = []) => { // pieces along one wall
    const add = (w, h, d, along, y, out) => {
      const geo = box(w, h, d, 0, 0, 0, undefined);
      const m = new THREE.Matrix4().makeRotationY(ry).setPosition(cx + Math.cos(ry) * along + Math.sin(ry) * out, y, cz - Math.sin(ry) * along + Math.cos(ry) * out);
      geo.applyMatrix4(m); return geo;
    };
    const parts = [];
    const segs = []; let s = -len / 2;
    for (const [a, b] of gaps) { segs.push([s, a]); s = b; } segs.push([s, len / 2]);
    for (const [a, b] of segs) {
      const L = b - a, mid = (a + b) / 2; if (L < 0.05) continue;
      parts.push([add(L, 1.0, 0.03, mid, 0.5, 0.015), 0x4a2a1e]);
      parts.push([add(L, 0.14, 0.05, mid, 0.07, 0.025), 0x2e1a12]); // baseboard
      parts.push([add(L, 0.05, 0.07, mid, 1.0, 0.035), 0x6b3f28]); // chair rail
      const n = Math.max(1, Math.round(L / 0.75)), pw = L / n;
      for (let i = 0; i < n; i++) parts.push([add(pw - 0.14, 0.62, 0.02, a + pw * (i + 0.5), 0.55, 0.035), 0x55301f]);
    }
    parts.push([add(len, 0.12, 0.08, 0, ROOM.H - 0.06, 0.04), 0x6b3f28]); // crown
    for (const [geo, col] of parts) {
      const c = new THREE.Color(col), n = geo.attributes.position.count, arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
      geo.setAttribute('color', new THREE.BufferAttribute(arr, 3)); wood.push(geo);
    }
  };
  run(ROOM.W, 0, -HD, 0);
  run(ROOM.D, -HW, 0, Math.PI / 2);
  run(ROOM.D, HW, 0, -Math.PI / 2, [[1.6, 2.6]]); // door gap on the right wall
  run(ROOM.W, 0, HD, Math.PI);
  const wm = new THREE.Mesh(mergeGeometries(wood), vc()); wm.castShadow = true; wm.receiveShadow = true; g.add(wm);

  // door (right wall, closed)
  const door = new THREE.Group();
  const dw = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.15, 0.06), toon({ color: 0x4a2a1e })); dw.position.y = 1.075; door.add(dw);
  for (const [y, h] of [[0.55, 0.7], [1.5, 0.8]]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, h, 0.03), toon({ color: 0x5a3424 })); p.position.set(0, y, 0.035); door.add(p);
  }
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), toon({ color: PAL.brass })); knob.position.set(-0.36, 1.0, 0.07); door.add(knob);
  const frame = new THREE.Mesh(mergeGeometries([box(0.1, 2.25, 0.1, -0.52, 1.125, 0), box(0.1, 2.25, 0.1, 0.52, 1.125, 0), box(1.14, 0.1, 0.1, 0, 2.25, 0)]), toon({ color: 0x2e1a12 }));
  door.add(frame);
  door.position.set(HW - 0.03, 0, 2.1); door.rotation.y = -Math.PI / 2; g.add(door);
  return g;
}

/* ---------- window: frame, rain on the glass, a rainy night outside ---------- */
function rainGlass() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { time: { value: 0 }, flash: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      varying vec2 vUv; uniform float time; uniform float flash;
      float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
      // one layer of drops: a few sit still, most slide down leaving a trail
      vec3 layer(vec2 uv, float t, float scale){
        vec2 g = vec2(10.0, 4.0) * scale; vec2 p = uv * g;
        float col = floor(p.x); float sp = 0.25 + h21(vec2(col, scale)) * 0.6;
        p.y += t * sp + h21(vec2(col, 2.0 + scale)) * 7.0;
        vec2 id = floor(p); vec2 f = fract(p) - 0.5;
        float n = h21(id + scale * 13.0);
        float x = (n - 0.5) * 0.6;
        float wob = sin(p.y * 6.2831 * 2.0 + n * 20.0) * 0.06;
        vec2 d = vec2((f.x - x - wob) * (g.y / g.x) * 2.2, f.y + 0.18);
        float drop = smoothstep(0.11, 0.08, length(d));
        float trail = smoothstep(0.035, 0.0, abs(f.x - x - wob)) * smoothstep(-0.18, 0.4, f.y) * step(0.0, f.y + 0.18) * 0.5;
        float rim = smoothstep(0.12, 0.10, length(d)) - smoothstep(0.09, 0.07, length(d - vec2(0.02, -0.03)));
        return vec3(drop, trail, max(rim, 0.0));
      }
      void main(){
        vec2 uv = vUv;
        vec3 a = layer(uv, time * 0.22, 1.0);
        vec3 b = layer(uv * 1.7 + 3.1, time * 0.3, 1.6);
        float statics = 0.0;
        vec2 sp = uv * vec2(46.0, 34.0); vec2 sid = floor(sp); vec2 sf = fract(sp) - 0.5;
        float sn = h21(sid);
        if (sn > 0.72) statics = smoothstep(0.22, 0.12, length(sf - (vec2(h21(sid+1.3), h21(sid+2.7)) - 0.5) * 0.4));
        float drops = clamp(a.x + b.x * 0.8 + statics, 0.0, 1.0);
        float trails = clamp(a.y + b.y, 0.0, 1.0);
        vec3 glass = vec3(0.30, 0.42, 0.62);
        vec3 c = mix(glass, vec3(0.78, 0.87, 1.0), drops * 0.85);
        c = mix(c, vec3(0.55, 0.68, 0.9), trails * 0.6);
        c += vec3(0.6, 0.7, 1.0) * flash * 0.5;
        float alpha = 0.16 + drops * 0.55 + trails * 0.22 + flash * 0.25;
        gl_FragColor = vec4(c, alpha);
        #include <colorspace_fragment>
      }`
  });
}
function nightBackdrop() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const k = c.getContext('2d');
  const sky = k.createLinearGradient(0, 0, 0, 512); sky.addColorStop(0, '#0d1630'); sky.addColorStop(0.6, '#1d2c52'); sky.addColorStop(1, '#2a3a63');
  k.fillStyle = sky; k.fillRect(0, 0, 1024, 512);
  const moon = k.createRadialGradient(700, 130, 0, 700, 130, 140); moon.addColorStop(0, 'rgba(220,232,255,0.55)'); moon.addColorStop(1, 'rgba(220,232,255,0)');
  k.fillStyle = moon; k.fillRect(0, 0, 1024, 512);
  k.fillStyle = '#dfe9ff'; k.beginPath(); k.arc(700, 130, 34, 0, Math.PI * 2); k.fill();
  k.fillStyle = '#c9d7f5'; k.beginPath(); k.arc(712, 122, 7, 0, Math.PI * 2); k.arc(690, 142, 5, 0, Math.PI * 2); k.fill();
  // clouds over the moon
  k.fillStyle = 'rgba(30,44,80,0.85)';
  for (const [x, y, r] of [[600, 170, 50], [650, 160, 60], [720, 175, 46], [780, 168, 40], [560, 180, 34]]) { k.beginPath(); k.arc(x, y, r, 0, Math.PI * 2); k.fill(); }
  // rooftops + chimneys, two layers
  const r = rng(3);
  for (const [base, col] of [[330, '#15203c'], [380, '#0c1428']]) {
    k.fillStyle = col; let x = -20;
    while (x < 1044) {
      const w = 60 + r() * 120, h = 40 + r() * 90, top = base - h;
      k.beginPath(); k.moveTo(x, 512); k.lineTo(x, top); k.lineTo(x + w / 2, top - 20 - r() * 30); k.lineTo(x + w, top); k.lineTo(x + w, 512); k.fill();
      if (r() > 0.5) k.fillRect(x + w * 0.7, top - 40, 12, 40);
      if (col === '#0c1428') for (let i = 0; i < 3; i++) if (r() > 0.55) { k.fillStyle = '#f2b65a'; k.fillRect(x + 10 + r() * (w - 30), top + 20 + r() * 40, 10, 14); k.fillStyle = col; }
      x += w - 4;
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: t, fog: false }));
  m.position.set(0, 1.6, -HD - 4.5);
  return m;
}
function rainOutside() {
  const N = 900, pos = new Float32Array(N * 6), seed = new Float32Array(N);
  const r = rng(11);
  for (let i = 0; i < N; i++) {
    const x = (r() - 0.5) * 6, y = r() * 5, z = -HD - 0.4 - r() * 3.8;
    pos.set([x, y, z, x + 0.02, y - 0.22, z], i * 6); seed[i] = 0.7 + r() * 0.6;
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xa9c4f0, transparent: true, opacity: 0.45, fog: false }));
  lines.frustumCulled = false;
  lines.userData.update = (dt) => {
    const p = geo.attributes.position.array;
    for (let i = 0; i < N; i++) {
      const s = 7.5 * seed[i] * dt; let y = p[i * 6 + 1] - s;
      if (y < -0.5) y += 5.5;
      p[i * 6 + 1] = y; p[i * 6 + 4] = y - 0.22;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return lines;
}
function windowPiece() {
  const g = new THREE.Group();
  const { x0, x1, y0, y1 } = ROOM.win, w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, z = -HD;
  const fr = [
    box(w + 0.16, 0.1, 0.16, cx, y1 + 0.05, z), box(w + 0.16, 0.1, 0.16, cx, y0 - 0.05, z),
    box(0.1, h, 0.16, x0 - 0.05, cy, z), box(0.1, h, 0.16, x1 + 0.05, cy, z),
    box(0.05, h, 0.08, cx, cy, z), box(w, 0.05, 0.08, cx, y0 + h * 0.62, z),
    box(w + 0.34, 0.06, 0.3, cx, y0 - 0.1, z + 0.1) // sill
  ];
  const frame = new THREE.Mesh(mergeGeometries(fr), toon({ color: 0x3b2318 })); frame.castShadow = true; frame.receiveShadow = true; g.add(frame);
  const glassMat = rainGlass();
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat); glass.position.set(cx, cy, z - 0.01); glass.renderOrder = 2; g.add(glass);
  g.add(nightBackdrop());
  const rain = rainOutside(); g.add(rain);
  // curtains + rod
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, w + 1.3, 8), toon({ color: PAL.brass }));
  rod.rotation.z = Math.PI / 2; rod.position.set(cx, y1 + 0.22, z + 0.14); g.add(rod);
  for (const sx of [-1, 1]) {
    const cg = new THREE.PlaneGeometry(0.62, y1 + 0.2, 24, 4);
    const p = cg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = (p.getX(i) + 0.31) / 0.62, v = (p.getY(i) + (y1 + 0.2) / 2) / (y1 + 0.2);
      p.setZ(i, Math.sin(u * Math.PI * 7) * 0.035 * (0.6 + 0.4 * (1 - v)));
      p.setX(i, p.getX(i) * (0.85 + 0.25 * (1 - v)));
    }
    cg.computeVertexNormals();
    const cur = new THREE.Mesh(cg, toon({ color: PAL.tealDark, side: THREE.DoubleSide }));
    cur.position.set(cx + sx * (w / 2 + 0.28), (y1 + 0.2) / 2 + 0.02, z + 0.16); cur.castShadow = true; cur.receiveShadow = true;
    g.add(cur);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 12), toon({ color: PAL.brass }));
    tie.position.set(cx + sx * (w / 2 + 0.26), 1.05, z + 0.2); tie.scale.set(1.3, 0.5, 1); g.add(tie);
  }
  g.userData.update = (t, dt, flash) => { glassMat.uniforms.time.value = t; glassMat.uniforms.flash.value = flash; rain.userData.update(dt); };
  return g;
}

/* ---------- grandfather clock (shows the real time + your loop) ---------- */
function grandfatherClock() {
  const g = new THREE.Group();
  const wood = toon({ color: 0x5c2c20 }), woodD = toon({ color: 0x3e1c14 }), brass = toon({ color: PAL.brass }), brassD = toon({ color: PAL.brassDark });
  const cream = toon({ color: 0xf6edd8 }), ink = toon({ color: PAL.ink }), tealM = toon({ color: PAL.teal });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  add(new THREE.BoxGeometry(0.64, 0.28, 0.4), woodD, 0, 0.14, 0);
  add(new THREE.BoxGeometry(0.58, 0.05, 0.36), wood, 0, 0.3, 0);
  add(new THREE.BoxGeometry(0.46, 1.15, 0.3), wood, 0, 0.9, 0);
  add(new THREE.BoxGeometry(0.3, 0.8, 0.02), toon({ color: 0x1c1012 }), 0, 0.92, 0.151); // dark window in the trunk
  add(new THREE.BoxGeometry(0.36, 0.06, 0.04), woodD, 0, 1.34, 0.16); add(new THREE.BoxGeometry(0.36, 0.06, 0.04), woodD, 0, 0.5, 0.16);
  add(new THREE.BoxGeometry(0.06, 0.84, 0.04), woodD, -0.18, 0.92, 0.16); add(new THREE.BoxGeometry(0.06, 0.84, 0.04), woodD, 0.18, 0.92, 0.16);
  // pendulum
  const pend = new THREE.Group(); pend.position.set(0, 1.28, 0.12); g.add(pend);
  const rod = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.58, 0.01), brassD); rod.position.y = -0.29; pend.add(rod);
  const bob = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 18), brass); bob.rotation.x = Math.PI / 2; bob.position.y = -0.6; pend.add(bob);
  // hood + dial
  add(new THREE.BoxGeometry(0.56, 0.06, 0.36), woodD, 0, 1.5, 0);
  add(new THREE.BoxGeometry(0.54, 0.52, 0.34), wood, 0, 1.79, 0);
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 8), woodD, -0.25, 1.79, 0.15); add(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 8), woodD, 0.25, 1.79, 0.15);
  const bez = add(new THREE.TorusGeometry(0.2, 0.022, 8, 28), brass, 0, 1.79, 0.175);
  const dial = add(new THREE.CircleGeometry(0.19, 28), cream, 0, 1.79, 0.172);
  for (let i = 0; i < 12; i++) {
    const big = i % 3 === 0, a = i / 12 * Math.PI * 2;
    const t = add(new THREE.BoxGeometry(big ? 0.022 : 0.011, big ? 0.045 : 0.026, 0.005), big ? tealM : ink, Math.sin(a) * 0.155, 1.79 + Math.cos(a) * 0.155, 0.176);
    t.rotation.z = -a;
  }
  const mkHand = (len, w, mat, z) => { const p = new THREE.Group(); p.position.set(0, 1.79, z); g.add(p); const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.006), mat); m.position.y = len * 0.4; p.add(m); return p; };
  const hourH = mkHand(0.1, 0.02, ink, 0.18), minH = mkHand(0.15, 0.013, ink, 0.186), loopH = mkHand(0.165, 0.007, tealM, 0.192);
  add(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 10), brass, 0, 1.79, 0.19).rotation.x = Math.PI / 2;
  // crown: broken pediment + finials
  const l = add(new THREE.BoxGeometry(0.34, 0.06, 0.36), woodD, -0.14, 2.1, 0); l.rotation.z = 0.35;
  const r2 = add(new THREE.BoxGeometry(0.34, 0.06, 0.36), woodD, 0.14, 2.1, 0); r2.rotation.z = -0.35;
  add(new THREE.BoxGeometry(0.6, 0.05, 0.38), woodD, 0, 2.06, 0);
  for (const x of [-0.27, 0, 0.27]) add(new THREE.SphereGeometry(x === 0 ? 0.045 : 0.035, 10, 8), brass, x, x === 0 ? 2.25 : 2.13, 0.02);
  g.userData.update = (t, date, loopFrac) => {
    pend.rotation.z = Math.sin(t * Math.PI) * 0.16;
    const h = date.getHours() % 12 + date.getMinutes() / 60, m = date.getMinutes() + date.getSeconds() / 60;
    hourH.rotation.z = -h / 12 * Math.PI * 2; minH.rotation.z = -m / 60 * Math.PI * 2; loopH.rotation.z = -loopFrac * Math.PI * 2;
  };
  void bez; void dial;
  return g;
}

/* ---------- brass stand the mask rests on ---------- */
export function maskStand() {
  const g = new THREE.Group(), brass = toon({ color: PAL.brass }), dark = toon({ color: PAL.brassDark });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  add(new THREE.CylinderGeometry(0.07, 0.08, 0.018, 16), dark, 0, 0.009, 0);
  add(new THREE.CylinderGeometry(0.05, 0.06, 0.012, 16), brass, 0, 0.024, 0);
  add(new THREE.CylinderGeometry(0.007, 0.009, 0.2, 8), brass, 0, 0.13, -0.01);
  add(new THREE.SphereGeometry(0.014, 10, 8), brass, 0, 0.235, -0.01);
  const cradle = add(new THREE.TorusGeometry(0.05, 0.006, 6, 16, Math.PI), brass, 0, 0.17, 0.005);
  cradle.rotation.z = Math.PI;
  g.userData.maskAt = new THREE.Vector3(0, 0.205, 0.035); // where the mask sits (local)
  return g;
}

/* ---------- furniture (KayKit, CC0) ---------- */
const loader = new GLTFLoader();
async function kk(path, s, x, y, z, ry = 0) {
  const gl = await loader.loadAsync(path);
  const o = toonify(gl.scene); o.scale.setScalar(s); o.position.set(x, y, z); o.rotation.y = ry;
  return o;
}

export async function buildRoom(scene, base = '') {
  const room = new THREE.Group(); room.name = 'room'; scene.add(room);
  room.add(floor()); room.add(walls());
  const win = windowPiece(); room.add(win);
  const clock = grandfatherClock(); clock.position.set(-HW + 0.22, 0, -1.3); clock.rotation.y = Math.PI / 2; room.add(clock);

  const K = base + 'assets/kaykit/', HL = base + 'assets/kk_halloween/';
  const parts = await Promise.all([
    kk(K + 'rug_oval_A.gltf', 0.95, 0, 0, -0.5),
    kk(K + 'table_small.gltf', 0.76, 0, 0, -0.75),
    kk(K + 'armchair.gltf', 0.74, 1.75, 0, -2.35, -0.75),
    kk(K + 'lamp_standing.gltf', 0.7, 2.55, 0, -2.95),
    kk(K + 'cabinet_medium_decorated.gltf', 0.74, HW - 0.4, 0, 0.2, -Math.PI / 2),
    kk(K + 'shelf_B_large_decorated.gltf', 0.62, 1.95, 1.55, -HD),
    kk(K + 'pictureframe_large_A.gltf', 0.75, -HW, 1.75, 1.2, Math.PI / 2),
    kk(K + 'pictureframe_medium.gltf', 0.75, -HW, 1.6, 2.4, Math.PI / 2),
    kk(K + 'chair_A_wood.gltf', 0.74, -0.85, 0, -0.55, Math.PI / 2 + 0.25),
    kk(K + 'lamp_table.gltf', 0.36, 0.2, 0.76, -0.95),
    kk(HL + 'candle_triple.gltf', 0.3, HW - 0.45, 0.74, 0.15, -Math.PI / 2),
    kk(HL + 'lantern_hanging.gltf', 0.5, -1.7, ROOM.H, 1.6),
    kk(K + 'pillow_A.gltf', 0.35, -0.12, 0.76, -0.62, 0.3)
  ]);
  parts[0].scale.y = 0.25; // flat rug so table + chair legs stand on the floor
  parts.forEach((p) => room.add(p));

  /* lights */
  scene.add(new THREE.HemisphereLight(0x405585, 0x2a1812, 1.1));
  const moon = new THREE.DirectionalLight(0x8fb0ff, 1.6);
  moon.position.set(-2.2, 4.1, -HD - 5); moon.target.position.set(-0.5, 0, 0.9);
  moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 24 });
  moon.shadow.bias = -0.0015; moon.shadow.normalBias = 0.02;
  scene.add(moon, moon.target);
  const lamps = [];
  const lamp = (color, power, x, y, z, glow, dist = 7) => {
    const L = new THREE.PointLight(color, power, dist, 1.7); L.position.set(x, y, z); scene.add(L);
    const s = glowSprite(color, glow, 0.55); s.position.set(x, y, z); scene.add(s);
    lamps.push({ L, s, base: power, seed: Math.random() * 10 });
  };
  lamp(0xffb36b, 5.5, 0.2, 1.08, -0.95, 0.55);          // table lamp
  lamp(0xffa75c, 4.5, 2.55, 1.66, -2.95, 0.8);          // standing lamp
  lamp(0xff9440, 1.4, HW - 0.45, 1.0, 0.18, 0.35, 3); // candles on the cabinet
  lamp(0xffb062, 1.6, -1.7, ROOM.H - 0.62, 1.6, 0.5, 4); // hanging lantern

  let flash = 0, nextFlash = 6;
  const update = (t, dt, date, loopFrac) => {
    // lightning: rare double flash
    if (t > nextFlash) { flash = 1; nextFlash = t + 9 + Math.random() * 14; }
    flash = Math.max(0, flash - dt * 2.4);
    const f2 = flash > 0.5 ? flash : flash * (0.6 + 0.4 * Math.sin(t * 40));
    moon.intensity = 1.6 + f2 * 5;
    win.userData.update(t, dt, f2);
    clock.userData.update(t, date, loopFrac);
    for (const l of lamps) {
      const k = 1 + Math.sin(t * 7.3 + l.seed) * 0.03 + Math.sin(t * 13.1 + l.seed * 2) * 0.02;
      l.L.intensity = l.base * k; l.s.material.opacity = 0.55 * k;
    }
  };
  return { room, update, setFlash: (v) => { flash = v; } };
}
