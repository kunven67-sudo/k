// Out-of-focus casino lights: one Points draw call of soft hexagonal discs (aperture-shaped
// bokeh) in warm casino colors, gently twinkling. Sits far behind the subject.

import * as THREE from 'three';
import { canvasTexture } from '../../gfx/textures.js';

function discTexture() {
  return canvasTexture('ui-bokeh-disc', 128, 128, (g, w) => {
    // Hexagonal aperture with a brighter rim (like real lens bokeh) and soft edge.
    const c = w / 2;
    const hex = (r) => {
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        g[i ? 'lineTo' : 'moveTo'](c + Math.cos(a) * r, c + Math.sin(a) * r);
      }
      g.closePath();
    };
    g.filter = 'blur(2.5px)';
    hex(54);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.stroke();
    g.filter = 'none';
  });
}

const PALETTE = [0xffb347, 0xffd27a, 0xff5a5a, 0xff3d8b, 0x7ad7ff, 0xffe9b0, 0xff8f3a, 0xb07bff];

/**
 * @param {object} o  count, radius (spread), depth [near, far] z-range (negative), size range
 * @returns THREE.Points with .update(time)
 */
export function createBokeh({ count = 90, spreadX = 30, spreadY = 12, y = 4, z = [-18, -40], size = [1.2, 3.4], seed = 7, opacity = 0.55 } = {}) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const sz = new Float32Array(count);
  const ph = new Float32Array(count);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rnd() - 0.5) * spreadX;
    pos[i * 3 + 1] = y + (rnd() - 0.5) * spreadY;
    pos[i * 3 + 2] = z[0] + (z[1] - z[0]) * rnd();
    c.setHex(PALETTE[Math.floor(rnd() * PALETTE.length)]);
    col.set([c.r, c.g, c.b], i * 3);
    sz[i] = size[0] + (size[1] - size[0]) * rnd();
    ph[i] = rnd() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: discTexture() }, uTime: { value: 0 }, uOpacity: { value: opacity }, uScale: { value: 300 } },
    vertexShader: /* glsl */ `
      attribute float aSize; attribute float aPhase; varying vec3 vColor; varying float vTw;
      uniform float uTime; uniform float uScale;
      void main() {
        vColor = color;
        vTw = 0.7 + 0.3 * sin(uTime * (0.6 + fract(aPhase) * 1.4) + aPhase);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform float uOpacity; varying vec3 vColor; varying float vTw;
      void main() {
        float a = texture2D(uMap, gl_PointCoord).a;
        gl_FragColor = vec4(vColor * 2.2 * vTw, a * uOpacity * vTw);
      }`,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = -1;
  pts.update = (t, viewportH = 800) => {
    mat.uniforms.uTime.value = t;
    mat.uniforms.uScale.value = viewportH * 0.45;
  };
  return pts;
}
