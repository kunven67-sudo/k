// Every asset lives inside the one HTML file as base64 text in <script type="text/plain" data-asset>.
// In dev (served over http) they're fetched from /assets instead.
const cache = new Map();
const urls = new Map();

function embedded(name) {
  return document.querySelector(`script[data-asset="${CSS.escape(name)}"]`);
}

export async function getBuffer(name) {
  if (cache.has(name)) return cache.get(name);
  const p = (async () => {
    const el = embedded(name);
    if (el) {
      const b64 = el.textContent.trim();
      el.textContent = '';
      return await (await fetch('data:application/octet-stream;base64,' + b64)).arrayBuffer();
    }
    const r = await fetch((window.__ASSET_BASE || 'assets/') + name);
    if (!r.ok) throw new Error('missing asset ' + name);
    return await r.arrayBuffer();
  })();
  cache.set(name, p);
  return p;
}

const MIME = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', glb: 'model/gltf-binary', ogg: 'audio/ogg', mp3: 'audio/mpeg', wav: 'audio/wav' };

export async function getURL(name) {
  if (urls.has(name)) return urls.get(name);
  const buf = await getBuffer(name);
  const ext = name.split('.').pop();
  const url = URL.createObjectURL(new Blob([buf], { type: MIME[ext] || 'application/octet-stream' }));
  urls.set(name, url);
  return url;
}

export function hasAsset(name) {
  return !!embedded(name) || (window.__ASSET_LIST || []).includes(name);
}
