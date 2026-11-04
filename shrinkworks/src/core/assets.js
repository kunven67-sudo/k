// Where game files come from. Web build: files sit next to the page in assets/. One-file build: they are packed into
// the page as base64 (window.__AF_ASSETS) and turned into blob URLs the first time they are asked for.
const MIME = { jpg: 'image/jpeg', png: 'image/png', glb: 'model/gltf-binary', ogg: 'audio/ogg', hdr: 'application/octet-stream' };
const urls = new Map();

export function assetURL(path) {
  const packed = window.__AF_ASSETS;
  if (!packed) return 'assets/' + path;
  let u = urls.get(path);
  if (u) return u;
  const b64 = packed[path];
  if (!b64) throw new Error('Missing game file: ' + path);
  const bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  u = URL.createObjectURL(new Blob([bytes], { type: MIME[path.split('.').pop()] || 'application/octet-stream' }));
  urls.set(path, u);
  packed[path] = null; // free the big string
  return u;
}

export async function fetchBytes(path) {
  const r = await fetch(assetURL(path));
  if (!r.ok) throw new Error('Could not load ' + path + ' (' + r.status + ')');
  return r.arrayBuffer();
}

/* loading progress for the start screen */
const progress = { total: 0, done: 0, listeners: [] };
export function track(promise, weight = 1) {
  progress.total += weight;
  const bump = () => { progress.done += weight; progress.listeners.forEach((f) => f(progress.done / progress.total)); };
  promise.then(bump, bump);
  return promise;
}
export function onProgress(f) { progress.listeners.push(f); }
