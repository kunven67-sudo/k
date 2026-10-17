// Real-looking product packaging from a product definition: boxes, chip bags, bottles, cans,
// jugs, cartons, jars, trays, or a model from a kit. Labels are drawn on a canvas (brand name,
// product name, colour bands, a little art) so shelves read like a real store.
//
//   const { geometry, material } = packageMesh(product)  // shared per product (instancing)
//   const obj = productObject(product)                   // a fresh Mesh/Group to hold/place

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { assets } from '../gfx/assets.js';
import { floatGeometry } from './builder.js';

const cache = new Map();

function labelCanvas(p, w = 256, h = 256) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const [main, accent] = p.pack.colors || ['#dddddd', '#333333'];
  ctx.fillStyle = main;
  ctx.fillRect(0, 0, w, h);
  // Accent band + swoosh.
  ctx.fillStyle = accent;
  ctx.fillRect(0, h * 0.72, w, h * 0.1);
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.ellipse(w * 0.75, h * 0.25, w * 0.35, h * 0.12, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  const light = luminance(main) > 0.55;
  const ink = light ? '#141414' : '#ffffff';
  // Brand.
  ctx.fillStyle = luminance(accent) > 0.5 === light ? ink : accent;
  ctx.font = `900 ${Math.round(h * 0.17)}px Inter, Arial Black, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const brand = (p.brand || p.name.split(' ')[0]).toUpperCase();
  fitText(ctx, brand, w / 2, h * 0.3, w * 0.9);
  // Product name.
  ctx.fillStyle = ink;
  ctx.font = `700 ${Math.round(h * 0.075)}px Inter, Arial, sans-serif`;
  wrap(ctx, p.name.replace(p.brand || '#', '').trim(), w / 2, h * 0.52, w * 0.86, h * 0.085);
  // Fine print + "barcode".
  ctx.fillStyle = light ? '#ffffff' : '#ffffff';
  ctx.fillRect(w * 0.68, h * 0.84, w * 0.26, h * 0.12);
  ctx.fillStyle = '#111';
  for (let i = 0; i < 22; i++) ctx.fillRect(w * 0.69 + i * w * 0.011, h * 0.85, (i * 7) % 3 === 0 ? 2 : 1, h * 0.08);
  if (p.pack.print === 'bread') {
    ctx.fillStyle = '#f2c94c';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(w * (0.15 + i * 0.14), h * 0.9, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return c;
}

function fitText(ctx, text, x, y, maxW) {
  const m = ctx.measureText(text).width;
  if (m > maxW) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(maxW / m, 1);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  } else ctx.fillText(text, x, y);
}

function wrap(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else line = t;
  }
  if (line) ctx.fillText(line, x, yy);
}

function luminance(hex) {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

function labelMaterial(p, opts = {}) {
  const tex = new THREE.CanvasTexture(labelCanvas(p));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: opts.rough ?? 0.55, metalness: opts.metal ?? 0 });
}

/** Geometry + material for a product (cached; meshes share them). */
/**
 * Geometry + material for a product. lod 'low' = the shelf version (stores show hundreds of
 * them): fewer sides on cans/bottles, flat-edged boxes. Same size, same label.
 */
export function packageMesh(p, lod = 'high') {
  const ck = lod === 'low' ? `${p.id}|low` : p.id;
  if (cache.has(ck)) return cache.get(ck);
  if (lod === 'low' && p.pack.shape === 'model') return packageMesh(p); // models are already light
  const low = lod === 'low';
  const [w, h, d] = p.pack.size;
  const shape = p.pack.shape;
  let geometry;
  let material;
  if (shape === 'model') {
    const obj = assets.model(p.pack.kit, p.pack.model);
    obj.updateMatrixWorld(true);
    const geos = [];
    const mats = [];
    obj.traverse((o) => {
      if (!o.isMesh) return;
      const g = floatGeometry(o.geometry, !!o.material.map).applyMatrix4(o.matrixWorld);
      geos.push(g);
      mats.push(o.material);
    });
    // Keep it simple: one merged geometry, groups per original material.
    const box = new THREE.Box3().setFromObject(obj);
    const merged = mergeGeometries(geos.map((g) => (g.attributes.uv ? g : addUV(g))), true);
    merged.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    geometry = merged;
    material = mats;
  } else {
    material = low ? packageMesh(p).material : labelMaterial(p, { metal: shape === 'can' ? 0.6 : 0, rough: shape === 'can' ? 0.3 : shape === 'bag' ? 0.35 : 0.55 });
    if (shape === 'box' || shape === 'carton' || shape === 'tray') {
      geometry = low ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 1, Math.min(0.004, w / 4, h / 4, d / 4));
      if (shape === 'carton') {
        // Gable top.
        const top = new THREE.CylinderGeometry(0.001, w * 0.72, h * 0.18, 4, 1);
        top.rotateY(Math.PI / 4);
        top.translate(0, h * 0.59, 0);
        geometry = mergeGeometries([geometry.toNonIndexed(), top.toNonIndexed()], false);
      }
      geometry.translate(0, h / 2, 0);
    } else if (shape === 'bag') {
      geometry = new RoundedBoxGeometry(w, h, d, low ? 1 : 2, Math.min(d * 0.45, 0.03));
      // Puff the middle out a little like a chip bag.
      const pos = geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i) / (h / 2);
        const z = pos.getZ(i);
        pos.setZ(i, z * (1 + 0.6 * (1 - y * y)));
      }
      geometry.computeVertexNormals();
      geometry.translate(0, h / 2, 0);
    } else if (shape === 'can' || shape === 'jar') {
      geometry = new THREE.CylinderGeometry(w / 2, w / 2, h, low ? 9 : 18, 1);
      geometry.translate(0, h / 2, 0);
    } else if (shape === 'bottle') {
      const pts = [];
      const r = w / 2;
      pts.push(new THREE.Vector2(0.001, 0));
      pts.push(new THREE.Vector2(r * 0.85, 0));
      pts.push(new THREE.Vector2(r, h * 0.05));
      pts.push(new THREE.Vector2(r, h * 0.62));
      pts.push(new THREE.Vector2(r * 0.42, h * 0.84));
      pts.push(new THREE.Vector2(r * 0.33, h * 0.92));
      pts.push(new THREE.Vector2(r * 0.33, h));
      pts.push(new THREE.Vector2(0.001, h));
      geometry = new THREE.LatheGeometry(pts, low ? 8 : 16);
      if (p.pack.clear) material.transparent = true, (material.opacity = 0.85);
    } else if (shape === 'jug') {
      geometry = new RoundedBoxGeometry(w, h * 0.82, d, 2, 0.02);
      geometry.translate(0, h * 0.41, 0);
      const neck = new THREE.CylinderGeometry(w * 0.16, w * 0.22, h * 0.18, low ? 6 : 12);
      neck.translate(0, h * 0.91, 0);
      geometry = mergeGeometries([geometry.toNonIndexed(), neck.toNonIndexed()], false);
    } else {
      geometry = new THREE.BoxGeometry(w, h, d);
      geometry.translate(0, h / 2, 0);
    }
  }
  geometry.computeBoundingBox();
  const out = { geometry, material };
  cache.set(ck, out);
  return out;
}

function addUV(g) {
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;
}

/** A fresh object for one unit of a product (held in hand, in a bag, placed in a room). */
export function productObject(p) {
  const { geometry, material } = packageMesh(p);
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData.product = p.id;
  return m;
}

/** Real height of the packaged product (metres). */
export function productHeight(p) {
  const g = packageMesh(p).geometry;
  return g.boundingBox.max.y - g.boundingBox.min.y;
}
