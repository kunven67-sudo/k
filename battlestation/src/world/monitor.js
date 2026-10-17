import * as THREE from 'three';
import { mesh, box, cyl, slab } from './build.js';
import { paint, smudgeTex } from './materials.js';

// A flat-panel monitor: thin bezels, stand, a real power button with an LED, and a screen
// whose picture comes from the in-game PC (a canvas). The cursor is drawn by the screen shader
// so moving the mouse never has to re-upload the whole picture.
export function buildMonitor(o) {
  const { inches = 27, res = [1600, 900], name = 'monitor', bezel = 0.0065, chinH = 0.016 } = o;
  const diag = inches * 0.0254;
  const sw = diag * 16 / Math.hypot(16, 9), sh = diag * 9 / Math.hypot(16, 9);
  const bez = bezel, chin = chinH, depth = o.depth ?? 0.018;
  const g = new THREE.Group();
  g.name = name;
  const shell = paint(0x0e0f11, 0.48, 0.05, { roughnessMap: smudgeTex() });
  const back = paint(0x16171a, 0.62, 0.0);
  const W = sw + bez * 2, Hh = sh + bez + chin;
  const panel = mesh(box(W, Hh, depth, 0.003), shell, { parent: g });
  panel.position.set(0, chin / 2 - bez / 2, 0);
  // rear hump
  const hump = mesh(box(W * 0.62, Hh * 0.62, 0.03, 0.012), back, { parent: g });
  hump.position.set(0, -0.02, -depth / 2 - 0.012);
  // stand
  if (o.stand !== false) {
    const standMat = paint(0x1a1b1e, 0.38, 0.6);
    const neck = mesh(box(0.05, 0.36, 0.022, 0.006), standMat, { parent: g });
    neck.position.set(0, -0.13, -0.065);
    neck.rotation.x = -0.08;
    const foot = mesh(slab(0.26, 0.2, 0.008, 0.03, 0.002), standMat, { parent: g });
    foot.position.set(0, -sh / 2 - chin - 0.11 - 0.008, -0.05);
    g.userData.footY = foot.position.y;
  }

  // screen
  const canvas = document.createElement('canvas');
  canvas.width = res[0]; canvas.height = res[1];
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  const cursorTex = new THREE.CanvasTexture(makeCursor());
  cursorTex.colorSpace = THREE.SRGBColorSpace;
  const uniforms = {
    screenMap: { value: tex }, cursorMap: { value: cursorTex }, cursorPos: { value: new THREE.Vector2(0.5, 0.5) },
    cursorSize: { value: new THREE.Vector2(32 / res[0], 32 / res[1]) }, cursorOn: { value: 0 }, brightness: { value: 0 },
  };
  const scrMat = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.34, metalness: 0, emissive: 0xffffff, emissiveIntensity: 1 });
  scrMat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D screenMap, cursorMap; uniform vec2 cursorPos, cursorSize; uniform float cursorOn, brightness;`)
      .replace('#include <emissivemap_fragment>', `
        vec3 scr = texture2D(screenMap, vScreenUv).rgb;
        vec2 cuv = (vScreenUv - vec2(cursorPos.x, 1.0 - cursorPos.y)) / cursorSize;
        cuv.y = -cuv.y;
        if (cursorOn > 0.5 && cuv.x >= 0.0 && cuv.x <= 1.0 && cuv.y >= 0.0 && cuv.y <= 1.0) {
          vec4 c = texture2D(cursorMap, vec2(cuv.x, 1.0 - cuv.y));
          scr = mix(scr, c.rgb, c.a);
        }
        // panel pixel grid you only notice up close
        vec2 px = fract(vScreenUv * vec2(${res[0]}.0, ${res[1]}.0));
        float grid = 0.93 + 0.07 * smoothstep(0.0, 0.18, min(px.x, px.y));
        totalEmissiveRadiance = scr * brightness * grid;`);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vScreenUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvScreenUv = uv;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vScreenUv;');
  };
  const screen = mesh(new THREE.PlaneGeometry(sw, sh), scrMat, { parent: g, cast: false, name: name + '_screen' });
  screen.position.set(0, 0, depth / 2 + 0.0004);
  // power button + LED under the bottom right edge
  const btn = mesh(box(0.012, 0.004, 0.006, 0.0015), back, { parent: g, cast: false });
  btn.position.set(W / 2 - 0.03, -sh / 2 - chin + 0.0015, depth / 2 - 0.005);
  const ledMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffffff, emissiveIntensity: 0 });
  const led = mesh(new THREE.BoxGeometry(0.002, 0.0008, 0.001), ledMat, { parent: g, cast: false });
  led.position.set(W / 2 - 0.045, -sh / 2 - chin + 0.004, depth / 2 + 0.0002);
  // light the monitor throws on the desk / your hands / face
  const glow = new THREE.RectAreaLight(0xbfd0ff, 0, sw, sh);
  glow.position.set(0, 0, depth / 2 + 0.01);
  glow.lookAt(0, 0, 1);
  g.add(glow);

  const avg = document.createElement('canvas'); avg.width = 4; avg.height = 4;
  const avgCtx = avg.getContext('2d', { willReadFrequently: true });
  const mon = {
    group: g, canvas, ctx: canvas.getContext('2d'), tex, uniforms, screen, btn, led, ledMat, glow, sw, sh, W, Hh, res,
    on: true, signal: false, power: 0, avgColor: new THREE.Color(0, 0, 0),
  };
  mon.markDirty = () => { tex.needsUpdate = true; mon._avgDirty = true; };
  // brightness 0..1, LED: white = signal, amber = standby (no signal), off
  mon.update = (dt) => {
    const target = mon.on && mon.signal ? 1 : 0;
    mon.power += (target - mon.power) * Math.min(1, dt * (target ? 6 : 14));
    uniforms.brightness.value = mon.power * 1.35;
    ledMat.emissive.set(mon.on ? (mon.signal ? 0xffffff : 0xffa020) : 0x000000);
    ledMat.emissiveIntensity = mon.on ? 1.6 : 0;
    if (mon._avgDirty && mon.power > 0.01) {
      mon._avgDirty = false;
      avgCtx.drawImage(canvas, 0, 0, 4, 4);
      const d = avgCtx.getImageData(0, 0, 4, 4).data;
      let r = 0, gg = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
      const n = d.length / 4 * 255;
      mon.avgColor.setRGB(r / n, gg / n, b / n, THREE.SRGBColorSpace);
    }
    const lum = 0.25 + mon.avgColor.r * 0.3 + mon.avgColor.g * 0.5 + mon.avgColor.b * 0.2;
    glow.color.copy(mon.avgColor).lerp(_w, 0.25);
    glow.intensity = mon.power * 6 * lum;
  };
  mon.setCursor = (x, y, visible) => { uniforms.cursorPos.value.set(x / res[0], y / res[1]); uniforms.cursorOn.value = visible ? 1 : 0; };
  mon.setCursorImage = (img) => { cursorTex.image = img; cursorTex.needsUpdate = true; };
  return mon;
}
const _w = new THREE.Color(1, 1, 1);

export function makeCursor(kind = 'arrow') {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const g = c.getContext('2d');
  g.lineJoin = 'round';
  if (kind === 'arrow') {
    g.beginPath();
    g.moveTo(1, 1); g.lineTo(1, 22); g.lineTo(6, 17.5); g.lineTo(9.5, 25.5); g.lineTo(13, 24); g.lineTo(9.6, 16.2); g.lineTo(16, 16.2); g.closePath();
    g.fillStyle = '#fff'; g.fill(); g.lineWidth = 1.4; g.strokeStyle = '#000'; g.stroke();
  } else if (kind === 'hand') {
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(8, 2); g.lineTo(11, 2); g.lineTo(11, 12); g.lineTo(20, 13); g.quadraticCurveTo(24, 14, 23, 19); g.lineTo(21, 27); g.lineTo(10, 27); g.lineTo(4, 18); g.lineTo(6, 16); g.lineTo(8, 18); g.closePath(); g.fill(); g.stroke();
  } else if (kind === 'text') {
    g.strokeStyle = '#000'; g.lineWidth = 3; g.beginPath(); g.moveTo(8, 4); g.lineTo(8, 26); g.moveTo(5, 4); g.lineTo(11, 4); g.moveTo(5, 26); g.lineTo(11, 26); g.stroke();
    g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.stroke();
  } else if (kind === 'cross') {
    g.strokeStyle = '#000'; g.lineWidth = 3; g.beginPath(); g.moveTo(16, 4); g.lineTo(16, 28); g.moveTo(4, 16); g.lineTo(28, 16); g.stroke();
    g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.stroke();
  } else if (kind === 'busy') {
    g.beginPath(); g.moveTo(1, 1); g.lineTo(1, 18); g.lineTo(5, 14.5); g.lineTo(8, 21); g.lineTo(11, 20); g.lineTo(8, 13.5); g.lineTo(13, 13.5); g.closePath();
    g.fillStyle = '#fff'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = '#000'; g.stroke();
    g.beginPath(); g.arc(20, 20, 6, 0, Math.PI * 2); g.strokeStyle = '#2b88d8'; g.lineWidth = 2.5; g.stroke();
  }
  return c;
}
