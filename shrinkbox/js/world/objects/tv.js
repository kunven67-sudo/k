// 50" TV. Get close (or tiny) and you see the REAL pixels: every pixel is three little red,
// green and blue stripes, just like a real LCD. Hollow back housing with vent slots and ports;
// inside: the power board (capacitors), the main board and the speakers.
import * as THREE from 'three';
import { Thing, panel, grille } from '../thing.js';
import { defMat, colorMat } from '../../core/materials.js';

const SW = 1.105, SH = 0.622; // screen size (m)

function screenMaterial(tex) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, on: { value: 0 }, res: { value: new THREE.Vector2(1920, 1080) }, bright: { value: 1.6 } },
    vertexShader: `
      varying vec2 vUv;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `
      uniform sampler2D map; uniform float on; uniform vec2 res; uniform float bright;
      varying vec2 vUv;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      void main() {
        #include <logdepthbuf_fragment>
        vec2 px = vUv * res;
        vec2 cell = floor(px) + 0.5;
        vec3 col = texture2D(map, cell / res).rgb;
        vec2 f = fract(px);
        // subpixel stripes: R | G | B with thin black gaps (the "black matrix")
        float sub = f.x * 3.0;
        vec3 mask = vec3(step(sub, 1.0), step(1.0, sub) * step(sub, 2.0), step(2.0, sub));
        float gap = smoothstep(0.0, 0.08, fract(sub)) * smoothstep(1.0, 0.92, fract(sub)) * smoothstep(0.0, 0.1, f.y) * smoothstep(1.0, 0.9, f.y);
        vec3 pixel = col * mask * 3.0 * gap;
        // far away you can't resolve pixels: blend to the smooth picture (anti-aliasing by distance)
        float w = clamp(max(fwidth(px.x), fwidth(px.y)) * 1.2 - 0.25, 0.0, 1.0);
        vec3 smoothCol = texture2D(map, vUv).rgb;
        vec3 c = mix(pixel, smoothCol, w) * bright * on;
        gl_FragColor = vec4(c + vec3(0.012), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export function buildTV(game, pos, rotY = 0) {
  const tv = new Thing({ name: 'TV', pos, rot: [0, rotY, 0], surface: 'plastic', icon: '📺', tags: ['electronic', 'enterable'] });
  const bez = 0.008, th = 0.028;
  // panel (screen + thin bezel). Screen faces +z in local space.
  tv.box([SW + 2 * bez, SH + 2 * bez, th], [0, SH / 2 + 0.09, 0], 'plasticBlack');
  // stand feet
  for (const sx of [-1, 1]) {
    tv.box([0.03, 0.09, 0.025], [sx * 0.42, 0.045, 0.0], 'plasticBlack');
    tv.box([0.03, 0.012, 0.22], [sx * 0.42, 0.006, 0.0], 'plasticBlack');
  }
  // back housing (hollow) with vents on top and ports on the side
  const hx = 0.32, hy0 = 0.11, hy1 = 0.46, hz0 = -th / 2 - 0.045, hz1 = -th / 2;
  panel(tv, { axis: 'z', at: hz0 + 0.001, rect: [-hx, hy0, hx, hy1], thick: 0.002, m: 'plasticBlack',
    holes: [[0.2, 0.15, 0.215, 0.157], [0.2, 0.17, 0.215, 0.177], [0.23, 0.16, 0.242, 0.165]] });
  tv.box([0.002, hy1 - hy0, hz1 - hz0], [-hx, (hy0 + hy1) / 2, (hz0 + hz1) / 2], 'plasticBlack');
  tv.box([0.002, hy1 - hy0, hz1 - hz0], [hx, (hy0 + hy1) / 2, (hz0 + hz1) / 2], 'plasticBlack');
  tv.box([2 * hx, 0.002, hz1 - hz0], [0, hy0, (hz0 + hz1) / 2], 'plasticBlack');
  grille(tv, { axis: 'y', at: hy1, rect: [-hx, hz0, hx, hz1], bar: 0.003, gap: 0.004, thick: 0.002, m: 'plasticBlack', cross: false });
  // inside: power board with capacitors, main board, speakers
  tv.box([0.2, 0.15, 0.0015], [-0.15, 0.25, hz1 - 0.004], 'pcb');
  for (let i = 0; i < 5; i++) tv.cyl(0.006 + (i % 2) * 0.004, 0.02 + (i % 3) * 0.006, [-0.22 + i * 0.03, 0.22, hz1 - 0.016], 'capBlue', { rot: [Math.PI / 2, 0, 0], hv: true });
  tv.box([0.16, 0.12, 0.0015], [0.12, 0.3, hz1 - 0.004], 'pcb');
  tv.box([0.025, 0.025, 0.003], [0.12, 0.3, hz1 - 0.006], 'chip');
  for (const sx of [-1, 1]) tv.box([0.08, 0.03, 0.035], [sx * 0.26, 0.13, (hz0 + hz1) / 2], colorMat(0x222428, 0.8));
  // LED backlight strip glow at the bottom edge of the panel (inside, seen through the vents)
  tv.box([SW, 0.004, 0.004], [0, 0.1, -0.006], 'ledWhite', { collide: false });
  // screen surface
  const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 270;
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter;
  const smat = screenMaterial(tex);
  const sg = new THREE.PlaneGeometry(SW, SH);
  tv.geo(sg, [0, SH / 2 + 0.09, th / 2 + 0.0004], smat, { collide: false });
  tv.build(game.engine.scene);
  tv.enclosure = new THREE.Box3(new THREE.Vector3(-hx, hy0, hz0), new THREE.Vector3(hx, hy1, hz1));
  tv.screen = { canvas, tex, mat: smat, t: 0, frame: 0 };
  tv.refresh = () => { tv.screen.t = 0; };
  tv.behaviors.push(tvBehavior);
  game.interactables.push({ name: () => (tv.on ? 'Turn TV off' : 'Turn TV on'), thing: tv, local: new THREE.Vector3(0.45, 0.095, th / 2), radius: 0.12, use: () => { tv.on = !tv.on; tv.refresh(); game.sfx.click(0.4); } });
  game.tv = tv;
  return tv;
}

// What's on: Xbox home / a racing game when the console is on, otherwise "No signal".
function drawTV(tv, game) {
  const c = tv.screen.canvas.getContext('2d'), w = 480, h = 270;
  const f = tv.screen.frame++;
  if (game.xbox && game.xbox.on) {
    // a simple racing game: road, hills, sky - animated
    const sky = c.createLinearGradient(0, 0, 0, h * 0.5); sky.addColorStop(0, '#3a7bd5'); sky.addColorStop(1, '#a8d8ff');
    c.fillStyle = sky; c.fillRect(0, 0, w, h * 0.5);
    c.fillStyle = '#3f8f3a'; c.fillRect(0, h * 0.5, w, h * 0.5);
    c.fillStyle = '#2e6b2b'; c.beginPath(); c.moveTo(0, h * 0.5);
    for (let x = 0; x <= w; x += 20) c.lineTo(x, h * 0.42 + Math.sin(x * 0.02 + f * 0.01) * 12);
    c.lineTo(w, h * 0.5); c.fill();
    c.fillStyle = '#555'; c.beginPath(); c.moveTo(w * 0.47, h * 0.5); c.lineTo(w * 0.53, h * 0.5); c.lineTo(w * 0.95, h); c.lineTo(w * 0.05, h); c.fill();
    c.fillStyle = '#fff';
    for (let i = 0; i < 8; i++) { const t = ((i / 8 + f * 0.02) % 1); const y = h * 0.5 + t * t * h * 0.5; c.fillRect(w / 2 - 1 - t * 4, y, 2 + t * 8, 2 + t * 14); }
    c.fillStyle = '#d22'; c.fillRect(w / 2 - 34, h * 0.78, 68, 34); c.fillStyle = '#111'; c.fillRect(w / 2 - 30, h * 0.78 + 6, 60, 10);
    c.fillStyle = '#fff'; c.font = 'bold 16px sans-serif'; c.fillText(`LAP 2/3   ${(120 + Math.sin(f * 0.05) * 20) | 0} MPH`, 12, 22);
  } else {
    c.fillStyle = '#0a0a12'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ddd'; c.font = '20px sans-serif'; c.textAlign = 'center';
    c.fillText('No Signal', w / 2 + Math.sin(f * 0.02) * 120, h / 2 + Math.cos(f * 0.015) * 70); c.textAlign = 'left';
  }
  tv.screen.tex.needsUpdate = true;
}

const tvBehavior = {
  update(tv, dt, game) {
    tv.screen.mat.uniforms.on.value += ((tv.on ? 1 : 0) - tv.screen.mat.uniforms.on.value) * Math.min(1, dt * 8);
    if (!tv.on) return;
    tv.screen.t -= dt;
    if (tv.screen.t <= 0) { tv.screen.t = 1 / 20; drawTV(tv, game); }
  },
};
