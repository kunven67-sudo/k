// A slot-machine reel: a printed paper band on a drum. Symbols are drawn by a callback into a
// vertical canvas strip; the drum's UVs are laid out so canvas top→bottom reads top→bottom on
// screen. Spinning blends in a pre-smeared copy of the strip (motion blur) by speed.
//
//   const reel = createReel({ count: 8, draw: (g, i, w, h) => {...}, radius: 1, width: 1.2 });
//   reel.spinTo(3, 1.6)  → Promise when it lands (with a mechanical overshoot + settle)
//   reel.update(dt) every frame.

import * as THREE from 'three';
import { canvasTexture } from '../../gfx/textures.js';

const TAU = Math.PI * 2;

function stripCanvas(key, count, cellW, cellH, draw, blur) {
  return canvasTexture(key, cellW, cellH * count, (g, w, h) => {
    // Paper band: warm cream with a faint print grain and fold shadows at the cell borders.
    g.fillStyle = '#f4ecd9';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < count; i++) {
      g.save();
      g.translate(0, i * cellH);
      const sh = g.createLinearGradient(0, 0, 0, cellH);
      sh.addColorStop(0, 'rgba(90,60,30,.16)');
      sh.addColorStop(0.08, 'rgba(90,60,30,0)');
      sh.addColorStop(0.92, 'rgba(90,60,30,0)');
      sh.addColorStop(1, 'rgba(90,60,30,.16)');
      g.fillStyle = sh;
      g.fillRect(0, 0, cellW, cellH);
      draw(g, i, cellW, cellH);
      g.restore();
    }
    if (blur) {
      // Vertical smear: stack offset copies of the sharp strip.
      const copy = document.createElement('canvas');
      copy.width = w;
      copy.height = h;
      copy.getContext('2d').drawImage(g.canvas, 0, 0);
      g.globalAlpha = 0.16;
      for (let k = -6; k <= 6; k++) {
        g.drawImage(copy, 0, (k * cellH) / 10);
        g.drawImage(copy, 0, (k * cellH) / 10 + (k < 0 ? h : -h));
      }
      g.globalAlpha = 1;
    }
  });
}

/**
 * @param o.count     number of symbols around the drum
 * @param o.draw      (ctx, index, cellW, cellH) draws one symbol (origin at the cell's top-left)
 * @param o.key       cache key for the textures (same key = shared textures)
 */
export function createReel({ count, draw, key, radius = 1, width = 1.2, cellW = 256, cellH = 256, segments = 64, roughness = 0.5 }) {
  const sharp = stripCanvas(`${key}|sharp`, count, cellW, cellH, draw, false);
  const smear = stripCanvas(`${key}|blur`, count, cellW, cellH, draw, true);
  const geo = new THREE.CylinderGeometry(radius, radius, width, segments, 1, true);
  // Swap UVs: u (around) → v (canvas vertical), v (along axis) → u.
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    uv.setXY(i, v, 1 - u);
  }
  geo.rotateZ(-Math.PI / 2); // drum axis along x

  const uBlur = { value: 0 };
  const material = new THREE.MeshStandardMaterial({ map: sharp, roughness, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBlurMap = { value: smear };
    shader.uniforms.uBlur = uBlur;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\nuniform sampler2D uBlurMap; uniform float uBlur;')
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          vec4 sampledDiffuseColor = mix(texture2D(map, vMapUv), texture2D(uBlurMap, vMapUv), uBlur);
          diffuseColor *= sampledDiffuseColor;
        #endif`,
      );
  };
  material.customProgramCacheKey = () => 'ui-reel-blur';
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;

  const step = TAU / count;
  // Angle that puts symbol i at the window center.
  const angleFor = (i) => -((i + 0.5) * step);
  const state = { angle: angleFor(0), index: 0, spinning: false, speed: 0, anim: null, kick: 0 };
  mesh.rotation.x = state.angle;

  const reel = {
    mesh,
    material,
    count,
    get index() {
      return state.index;
    },
    get spinning() {
      return state.spinning;
    },
    /** Snap to symbol i. */
    setIndex(i) {
      state.index = ((i % count) + count) % count;
      state.angle = angleFor(state.index);
      mesh.rotation.x = state.angle;
    },
    /**
     * Spin forward (symbols travel downward) and land on symbol `i` after `seconds`, with at
     * least `turns` full revolutions. onStop fires at the clunk.
     */
    spinTo(i, seconds = 1.6, { turns = 2, onStop } = {}) {
      const target = ((i % count) + count) % count;
      // Forward = increasing angle. Find the next equivalent target angle ≥ current + turns.
      let goal = angleFor(target);
      while (goal < state.angle + turns * TAU) goal += TAU;
      state.spinning = true;
      return new Promise((resolve) => {
        state.anim = { from: state.angle, to: goal, t: 0, dur: seconds, resolve, onStop, target };
      });
    },
    /** Roll the shortest way (up or down) to any copy of a symbol in `targets`. */
    rollTo(targets, seconds = 0.45) {
      let best = null;
      for (const i of [].concat(targets)) {
        let goal = angleFor(i);
        goal += Math.round((state.angle - goal) / TAU) * TAU;
        if (!best || Math.abs(goal - state.angle) < Math.abs(best.goal - state.angle)) best = { goal, i };
      }
      state.spinning = true;
      return new Promise((resolve) => {
        state.anim = { from: state.angle, to: best.goal, t: 0, dur: seconds, resolve, target: best.i };
      });
    },
    /** Nudge the drum (e.g. lever pull wobble) — springs back. */
    kick(amount = 0.08) {
      state.kick += amount;
    },
    update(dt) {
      const a = state.anim;
      let prev = state.angle;
      if (a) {
        if (state.prevAnim && state.prevAnim !== a) state.prevAnim.resolve();
        state.prevAnim = a;
        a.t += dt;
        const p = Math.min(1, a.t / a.dur);
        // Quick wind-back, full speed, then a heavy brake with a small overshoot + settle.
        const wind = Math.sin(Math.min(1, p / 0.08) * Math.PI) * -0.06 * (p < 0.08 ? 1 : 0);
        const s = 1.25;
        const e = p < 1 ? 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2) : 1;
        state.angle = a.from + (a.to - a.from) * e + wind;
        if (p >= 1) {
          state.angle = a.to;
          state.index = a.target;
          state.spinning = false;
          state.anim = null;
          a.onStop?.();
          a.resolve();
        }
      }
      state.speed = Math.abs(state.angle - prev) / Math.max(dt, 1e-4);
      uBlur.value += (Math.min(1, state.speed / 14) - uBlur.value) * Math.min(1, dt * 20);
      state.kick *= Math.exp(-dt * 7);
      mesh.rotation.x = state.angle + Math.sin(performance.now() * 0.03) * state.kick;
    },
  };
  return reel;
}
