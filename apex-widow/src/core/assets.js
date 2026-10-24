// Assets live inside the one HTML file as base64 <script type="text/plain" data-asset="path"> blocks
// (dev build: fetched from ../assets/). Everything decodes lazily and is cached.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const BASE = window.__ASSET_BASE || null;
const blobs = new Map();      // path -> Promise<Blob>
const textures = new Map();   // key -> Texture
const gltfs = new Map();      // path -> Promise<gltf>
const audioBufs = new Map();  // path -> Promise<AudioBuffer>

const MIME = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', glb: 'model/gltf-binary', ogg: 'audio/ogg', mp3: 'audio/mpeg', wav: 'audio/wav' };

export function hasAsset(path) {
  if (BASE) return true;
  return !!document.querySelector(`script[data-asset="${path}"]`);
}

export function listAssets(prefix = '') {
  return [...document.querySelectorAll('script[data-asset]')].map(s => s.dataset.asset).filter(p => p.startsWith(prefix));
}

export function blob(path) {
  if (blobs.has(path)) return blobs.get(path);
  const ext = path.split('.').pop();
  let p;
  if (BASE) {
    p = fetch(BASE + path).then(r => { if (!r.ok) throw new Error('missing asset ' + path); return r.blob(); });
  } else {
    const el = document.querySelector(`script[data-asset="${path}"]`);
    if (!el) p = Promise.reject(new Error('missing asset ' + path));
    else {
      p = (async () => {
        const b64 = el.textContent.trim();
        const r = await fetch(`data:${MIME[ext] || 'application/octet-stream'};base64,${b64}`);
        const b = await r.blob();
        el.textContent = ''; // free the big string
        return b;
      })();
    }
  }
  blobs.set(path, p);
  return p;
}

// colour textures are sRGB, data textures (normal, arm, masks) are linear
export async function texture(path, { srgb = true, repeat = null, aniso = 8, flipY = true, mip = true } = {}) {
  const key = path + (srgb ? '|s' : '|l');
  let base = textures.get(key);
  if (!base) {
    const b = await blob(path);
    const bmp = await createImageBitmap(b, { imageOrientation: flipY ? 'flipY' : 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    base = new THREE.Texture(bmp);
    base.flipY = false; // already flipped by createImageBitmap
    base.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    base.wrapS = base.wrapT = THREE.RepeatWrapping;
    base.anisotropy = aniso;
    base.generateMipmaps = mip;
    base.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    base.needsUpdate = true;
    textures.set(key, base);
  }
  if (!repeat) return base;
  const t = base.clone(); // shares the image; own repeat
  t.repeat.set(repeat[0], repeat[1]);
  t.needsUpdate = true;
  return t;
}

export function gltf(path) {
  if (gltfs.has(path)) return gltfs.get(path);
  const p = (async () => {
    const b = await blob(path);
    const buf = await b.arrayBuffer();
    return await new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej));
  })();
  gltfs.set(path, p);
  return p;
}

export function audioBuffer(ctx, path) {
  if (audioBufs.has(path)) return audioBufs.get(path);
  const p = (async () => {
    const b = await blob(path);
    return await ctx.decodeAudioData(await b.arrayBuffer());
  })();
  audioBufs.set(path, p);
  return p;
}
