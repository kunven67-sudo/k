// Channel letters: the 3D signage letters on casinos, hotels and the arch.
//
//   channelLetters(ctx, text, { font, weight, height, depth, matrix, face, side, bulbs, spacing,
//                               tracking, chunk })
//     matrix: local frame (letters in its XY plane, extruded toward +Z, centred on x = 0,
//             baseline at y = 0). face/side: materials for the letter faces and returns.
//     bulbs:  a BulbSet → marquee bulbs traced along every glyph contour on the front face.
//   litFaceMat(color, {k, dayColor, metal}) → face material: coloured enamel by day, glowing at
//     night (SIGNS.uNight), with a subtle transformer pulse.

import * as THREE from 'three';
import { textGeometryParts, textShapes } from './text3d.js';
import { SIGNS } from './signs.js';

export function channelLetters(ctx, text, o = {}) {
  const opts = {
    font: o.font || '"Bebas Neue"',
    weight: o.weight ?? 400,
    height: o.height ?? 1,
    depth: o.depth ?? 0.15,
    bevel: o.bevel ?? 0.02,
    align: 'center',
    tracking: o.tracking ?? 0.05,
  };
  const parts = textGeometryParts(text, opts);
  const chunk = o.chunk;
  ctx.batch.add(parts.face, o.face, { matrix: o.matrix, uv: 'keep', chunk, castShadow: o.cast ?? true });
  ctx.batch.add(parts.side, o.side, { matrix: o.matrix, uv: 0.5, chunk, castShadow: o.cast ?? true });
  if (o.bulbs) {
    const { shapes } = textShapes(text, opts);
    const sp = o.spacing ?? opts.height * 0.075;
    let k = o.seq0 ?? 0;
    for (const sh of shapes) {
      for (const path of [sh, ...sh.holes]) {
        const pts = path.getSpacedPoints(Math.max(6, Math.round(path.getLength() / sp)));
        pts.pop();
        for (const p of pts) {
          const v = new THREE.Vector3(p.x, p.y, opts.depth + opts.bevel + 0.03).applyMatrix4(o.matrix);
          o.bulbs.add(v, k++, o.bulbColor ?? 0xfff0d0);
        }
      }
    }
  }
  return { width: parts.width, height: parts.height };
}

const faceCache = new Map();
export function litFaceMat(color, { k = 3, dayColor = null, metal = 0.1, rough = 0.35, pulse = true } = {}) {
  const key = `${color}|${k}|${dayColor}|${metal}|${rough}|${pulse}`;
  if (faceCache.has(key)) return faceCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color: dayColor ?? color, roughness: rough, metalness: metal, emissive: color });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = SIGNS.uNight;
    sh.uniforms.uTime = SIGNS.uTime;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight; uniform float uTime;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance *= uNight * (${k.toFixed(2)} ${pulse ? '+ 0.2 * sin(uTime * 1.7)' : ''});`);
  };
  m.customProgramCacheKey = () => `litface-${k}-${pulse}`;
  m.name = `litface-${new THREE.Color(color).getHexString()}`;
  faceCache.set(key, m);
  return m;
}
