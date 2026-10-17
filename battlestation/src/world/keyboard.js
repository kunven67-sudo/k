import * as THREE from 'three';
import { mesh, box, slab } from './build.js';
import { paint } from './materials.js';

// Full-size (104 key ANSI) mechanical keyboard. Every key is a real keycap that goes down 4 mm
// when you press that key on your real keyboard. One draw call for all caps (key id per vertex).
const U = 0.019; // 1 key unit (19.05 mm)

// [code, legend, width(u), extra] ; '_g' = gap
const ROWS = [
  [['Escape', 'Esc'], ['_g', 1], ['F1'], ['F2'], ['F3'], ['F4'], ['_g', .5], ['F5'], ['F6'], ['F7'], ['F8'], ['_g', .5], ['F9'], ['F10'], ['F11'], ['F12'], ['_g', .25], ['PrintScreen', 'PrtSc'], ['ScrollLock', 'ScrLk'], ['Pause', 'Pause']],
  [['Backquote', '`~'], ['Digit1', '1!'], ['Digit2', '2@'], ['Digit3', '3#'], ['Digit4', '4$'], ['Digit5', '5%'], ['Digit6', '6^'], ['Digit7', '7&'], ['Digit8', '8*'], ['Digit9', '9('], ['Digit0', '0)'], ['Minus', '-_'], ['Equal', '=+'], ['Backspace', 'Backspace', 2], ['_g', .25], ['Insert', 'Ins'], ['Home', 'Home'], ['PageUp', 'PgUp'], ['_g', .25], ['NumLock', 'Num'], ['NumpadDivide', '/'], ['NumpadMultiply', '*'], ['NumpadSubtract', '-']],
  [['Tab', 'Tab', 1.5], ['KeyQ', 'Q'], ['KeyW', 'W'], ['KeyE', 'E'], ['KeyR', 'R'], ['KeyT', 'T'], ['KeyY', 'Y'], ['KeyU', 'U'], ['KeyI', 'I'], ['KeyO', 'O'], ['KeyP', 'P'], ['BracketLeft', '[{'], ['BracketRight', ']}'], ['Backslash', '\\|', 1.5], ['_g', .25], ['Delete', 'Del'], ['End', 'End'], ['PageDown', 'PgDn'], ['_g', .25], ['Numpad7', '7'], ['Numpad8', '8'], ['Numpad9', '9'], ['NumpadAdd', '+', 1, 2]],
  [['CapsLock', 'Caps Lock', 1.75], ['KeyA', 'A'], ['KeyS', 'S'], ['KeyD', 'D'], ['KeyF', 'F'], ['KeyG', 'G'], ['KeyH', 'H'], ['KeyJ', 'J'], ['KeyK', 'K'], ['KeyL', 'L'], ['Semicolon', ';:'], ['Quote', '\'"'], ['Enter', 'Enter', 2.25], ['_g', 3.5], ['Numpad4', '4'], ['Numpad5', '5'], ['Numpad6', '6']],
  [['ShiftLeft', 'Shift', 2.25], ['KeyZ', 'Z'], ['KeyX', 'X'], ['KeyC', 'C'], ['KeyV', 'V'], ['KeyB', 'B'], ['KeyN', 'N'], ['KeyM', 'M'], ['Comma', ',<'], ['Period', '.>'], ['Slash', '/?'], ['ShiftRight', 'Shift', 2.75], ['_g', 1.25], ['ArrowUp', '↑'], ['_g', 1.25], ['Numpad1', '1'], ['Numpad2', '2'], ['Numpad3', '3'], ['NumpadEnter', 'Ent', 1, 2]],
  [['ControlLeft', 'Ctrl', 1.25], ['MetaLeft', 'win', 1.25], ['AltLeft', 'Alt', 1.25], ['Space', '', 6.25], ['AltRight', 'Alt', 1.25], ['MetaRight', 'win', 1.25], ['ContextMenu', 'menu', 1.25], ['ControlRight', 'Ctrl', 1.25], ['_g', .25], ['ArrowLeft', '←'], ['ArrowDown', '↓'], ['ArrowRight', '→'], ['_g', .25], ['Numpad0', '0', 2], ['NumpadDecimal', '.']],
];

// Which finger presses what (touch typing). L/R + 0 thumb 1 index 2 middle 3 ring 4 pinky
const FINGER = {};
const set = (f, keys) => keys.split(' ').forEach(k => { FINGER[k] = f; });
set('L4', 'Escape Backquote Digit1 Tab KeyQ CapsLock KeyA ShiftLeft KeyZ ControlLeft F1');
set('L3', 'Digit2 KeyW KeyS KeyX F2');
set('L2', 'Digit3 KeyE KeyD KeyC F3');
set('L1', 'Digit4 Digit5 KeyR KeyT KeyF KeyG KeyV KeyB F4 F5');
set('L0', 'Space MetaLeft AltLeft');
set('R1', 'Digit6 Digit7 KeyY KeyU KeyH KeyJ KeyN KeyM F6 F7 Insert Delete ArrowLeft Numpad1 Numpad4 Numpad7 NumLock');
set('R2', 'Digit8 KeyI KeyK Comma F8 Home End ArrowDown ArrowUp Numpad2 Numpad5 Numpad8 NumpadDivide');
set('R3', 'Digit9 KeyO KeyL Period F9 PageUp PageDown ArrowRight Numpad3 Numpad6 Numpad9 NumpadMultiply NumpadDecimal PrintScreen');
set('R4', 'Digit0 Minus Equal Backspace KeyP BracketLeft BracketRight Backslash Semicolon Quote Enter Slash ShiftRight ControlRight F10 F11 F12 NumpadSubtract NumpadAdd NumpadEnter ScrollLock Pause ContextMenu');
set('R0', 'AltRight MetaRight Numpad0');
export { FINGER };

function keycapGeo(w, d, h) {
  // tapered cap with a slightly dished top, built from a subdivided box
  const g = new THREE.BoxGeometry(w, h, d, 8, 2, 8);
  const p = g.attributes.position;
  const hw = w / 2, hd = d / 2;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = (y + h / 2) / h; // 0 bottom .. 1 top
    const taperX = 1 - t * (0.0028 / hw), taperZ = 1 - t * (0.0034 / hd);
    // round the corners (superellipse pull-in)
    const nx = x / hw, nz = z / hd;
    const corner = Math.pow(Math.abs(nx), 6) * Math.pow(Math.abs(nz), 6);
    const pull = 1 - corner * 0.08;
    x *= taperX * pull; z = z * taperZ * pull - t * 0.0006;
    if (t > 0.99) y -= 0.0007 * (1 - nx * nx * 0.9) * (1 - nz * nz * 0.3); // dish
    else if (t > 0.4) y += 0.0;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  g.translate(0, h / 2, 0);
  return g;
}

export function buildKeyboard(ctx) {
  const group = new THREE.Group();
  group.name = 'keyboard';
  const keys = {};
  const list = [];
  let y = 0;
  const rowGap = [0, 0.5, 0, 0, 0, 0];
  let maxX = 0;
  ROWS.forEach((row, r) => {
    y += rowGap[r];
    let x = 0;
    for (const k of row) {
      if (k[0] === '_g') { x += k[1]; continue; }
      const [code, legend = code, w = 1, h = 1] = k;
      list.push({ code, legend, x, y, w, h });
      x += w;
    }
    maxX = Math.max(maxX, x);
    y += 1;
  });
  const widthU = maxX, depthU = y;
  const W = widthU * U, D = depthU * U;

  // legend atlas: draw the whole keyboard top-down, each cap's top face samples its own spot
  const px = 64; // pixels per unit
  const cw = Math.ceil(widthU * px), ch = Math.ceil(depthU * px);
  const cnv = document.createElement('canvas');
  cnv.width = cw; cnv.height = ch;
  const g = cnv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, cw, ch);
  g.fillStyle = '#fff'; g.textBaseline = 'middle';
  for (const k of list) {
    const cx = (k.x + k.w / 2) * px, cy = (k.y + k.h / 2) * px;
    const L = k.legend;
    if (L.length === 2 && !/^[A-Z]$/.test(L) && !/^F\d$/.test(L) && L !== 'Ent') {
      g.font = `600 ${px * 0.24}px "Segoe UI", Arial, sans-serif`; g.textAlign = 'left';
      g.fillText(L[1], k.x * px + px * 0.22, k.y * px + px * 0.3);
      g.fillText(L[0], k.x * px + px * 0.22, k.y * px + px * 0.66);
    } else if (L === 'win') {
      const s = px * 0.1, ox = cx - s, oy = cy - s;
      for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) g.fillRect(ox + a * s * 1.1, oy + b * s * 1.1, s, s);
    } else if (L === 'menu') {
      g.fillRect(cx - px * 0.1, cy - px * 0.12, px * 0.2, px * 0.24); g.fillStyle = '#000';
      for (let i = 0; i < 3; i++) g.fillRect(cx - px * 0.06, cy - px * 0.07 + i * px * 0.06, px * 0.12, px * 0.02);
      g.fillStyle = '#fff';
    } else {
      const big = L.length === 1;
      g.font = `600 ${big ? px * 0.34 : px * 0.2}px "Segoe UI", Arial, sans-serif`;
      g.textAlign = big ? 'left' : 'left';
      if (big) g.fillText(L, k.x * px + px * 0.22, k.y * px + px * 0.36);
      else g.fillText(L, k.x * px + px * 0.16, cy);
    }
    if (k.code === 'KeyF' || k.code === 'KeyJ') g.fillRect(cx - px * 0.1, (k.y + 0.82) * px, px * 0.2, px * 0.035); // homing bumps
  }
  const legendTex = new THREE.CanvasTexture(cnv);
  legendTex.colorSpace = THREE.SRGBColorSpace;
  legendTex.anisotropy = 8;

  // merge all caps into one geometry with a keyId attribute
  const geos = [];
  const capH = 0.0095;
  list.forEach((k, i) => {
    const w = k.w * U - 0.0012 - 0.0006, d = k.h * U - 0.0012 - 0.0006;
    const geo = keycapGeo(w, d, capH);
    // top face UV -> atlas position
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let v = 0; v < pos.count; v++) {
      const lx = pos.getX(v) / (k.w * U), lz = pos.getZ(v) / (k.h * U);
      uv.setXY(v, (k.x + k.w / 2 + lx * k.w) / widthU, 1 - (k.y + k.h / 2 + lz * k.h) / depthU);
    }
    const cx = (k.x + k.w / 2) * U - W / 2, cz = (k.y + k.h / 2) * U - D / 2;
    geo.translate(cx, 0, cz);
    const id = new Float32Array(pos.count).fill(i);
    geo.setAttribute('keyId', new THREE.BufferAttribute(id, 1));
    geos.push(geo);
    k.pos = new THREE.Vector3(cx, capH, cz);
    k.index = i;
    keys[k.code] = k;
  });
  const merged = mergeAll(geos);
  const depth = new Float32Array(128);
  const colors = [];
  for (let i = 0; i < 128; i++) colors.push(new THREE.Color(1, 1, 1));
  const capMat = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.62, metalness: 0, emissive: 0xffffff, emissiveMap: legendTex, emissiveIntensity: 1.6 });
  capMat.onBeforeCompile = (sh) => {
    sh.uniforms.keyDepth = { value: depth };
    sh.uniforms.keyColor = { value: colors };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float keyId;\nuniform float keyDepth[128];\nuniform vec3 keyColor[128];\nvarying vec3 vKeyColor;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nint kid = int(keyId + 0.5);\ntransformed.y -= keyDepth[kid];\nvKeyColor = keyColor[kid];');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vKeyColor;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vKeyColor;');
  };
  const caps = mesh(merged, capMat, { parent: group, name: 'keycaps' });

  // case: anodized aluminum top plate, plastic bottom, slight typing angle
  const caseMat = paint(0x1b1c20, 0.42, 0.65);
  const plateMat = paint(0x0d0e10, 0.5, 0.2);
  const bodyW = W + 0.022, bodyD = D + 0.022;
  const body = mesh(slab(bodyW, bodyD, 0.022, 0.006, 0.0025), caseMat, { parent: group });
  body.position.set(0, -0.018, 0);
  mesh(new THREE.BoxGeometry(W + 0.004, 0.002, D + 0.004), plateMat, { parent: group, pos: [0, 0.0035, 0] });
  // underglow strip (switch LEDs light the plate)
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x4060ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  const glow = mesh(new THREE.PlaneGeometry(W, D), glowMat, { parent: group, pos: [0, 0.0047, 0], rot: [-Math.PI / 2, 0, 0], cast: false, receive: false });
  // lock lights
  const lockMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffffff, emissiveIntensity: 0 });
  const locks = {};
  ['NumLock', 'CapsLock', 'ScrollLock'].forEach((n, i) => {
    const l = mesh(new THREE.BoxGeometry(0.003, 0.001, 0.0015), lockMat.clone(), { parent: group, cast: false });
    l.position.set(W / 2 - 0.07 + i * 0.012, 0.0041, -D / 2 - 0.006);
    locks[n] = l;
  });
  group.rotation.x = 0.07; // feet out
  // the cable going to the PC
  const kb = { group, keys, list, depth, colors, W, D, caps, glow, locks, capMat, pressed: new Map(), rgb: 'wave', time: 0, legendTex };

  kb.press = (code, down) => {
    const k = keys[code];
    if (!k) return;
    if (down) kb.pressed.set(code, { t: 0, down: true }); else { const p = kb.pressed.get(code); if (p) p.down = false; }
  };
  // physical key travel: down fast (4mm), spring back
  kb.update = (dt, on = true) => {
    kb.time += dt;
    for (const [code, p] of kb.pressed) {
      const k = keys[code];
      p.t += dt;
      const target = p.down ? 0.0038 : 0;
      const cur = depth[k.index];
      depth[k.index] = cur + (target - cur) * Math.min(1, dt * (p.down ? 60 : 30));
      if (!p.down && depth[k.index] < 1e-5) { depth[k.index] = 0; kb.pressed.delete(code); }
    }
    // RGB backlight effect
    const t = kb.time;
    for (const k of list) {
      const c = colors[k.index];
      if (!on) { c.setRGB(0, 0, 0); continue; }
      if (kb.rgb === 'wave') c.setHSL(((k.x / 24) - t * 0.08) % 1 + 1, 0.95, 0.55);
      else if (kb.rgb === 'white') c.setRGB(0.9, 0.9, 1);
      else c.set(kb.rgb);
      if (kb.pressed.has(k.code)) c.lerp(_white, 0.6);
    }
    glowMat.opacity = on ? 0.07 : 0;
    if (on) glowMat.color.setHSL((0.6 - t * 0.08) % 1 + 1, 0.9, 0.5);
  };
  kb.keyWorld = (code, out = new THREE.Vector3()) => {
    const k = keys[code];
    if (!k) return null;
    out.copy(k.pos);
    out.y -= depth[k.index];
    return group.localToWorld(out);
  };
  kb.setLock = (name, on) => { const l = locks[name]; if (l) l.material.emissiveIntensity = on ? 3 : 0; };
  return kb;
}
const _white = new THREE.Color(1, 1, 1);

function mergeAll(geos) {
  let n = 0, idx = 0;
  for (const g of geos) { n += g.attributes.position.count; idx += g.index.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), kid = new Float32Array(n);
  const index = new Uint32Array(idx);
  let o = 0, io = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    uv.set(g.attributes.uv.array, o * 2);
    kid.set(g.attributes.keyId.array, o);
    for (let i = 0; i < g.index.count; i++) index[io + i] = g.index.array[i] + o;
    o += g.attributes.position.count; io += g.index.count;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  m.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  m.setAttribute('keyId', new THREE.BufferAttribute(kid, 1));
  m.setIndex(new THREE.BufferAttribute(index, 1));
  m.computeBoundingSphere();
  return m;
}
