// Model file cache. Cache API on http(s) pages; IndexedDB on file:// pages (Cache API can't be used there).
// Works in the page and in workers. Shape matches what transformers.js expects from env.customCache.
const DB = 'subdub-models', STORE = 'files', CACHE = 'subdub-models-v1';

let idbP = null;
function idb() {
  idbP ??= new Promise((res, rej) => {
    const q = indexedDB.open(DB, 1);
    q.onupgradeneeded = () => q.result.createObjectStore(STORE);
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
  return idbP;
}
function tx(mode, fn) {
  return idb().then(db => new Promise((res, rej) => {
    const t = db.transaction(STORE, mode), r = fn(t.objectStore(STORE));
    t.oncomplete = () => res(r?.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  }));
}

const useCacheApi = typeof caches !== 'undefined' && /^https?:/.test(self.location?.protocol || '');
let cacheP = null;
const openCacheApi = () => (cacheP ??= caches.open(CACHE));

export const modelCache = {
  async match(url) {
    try {
      if (useCacheApi) return (await (await openCacheApi()).match(url)) || undefined;
      const blob = await tx('readonly', s => s.get(url));
      return blob ? new Response(blob, { headers: { 'content-length': String(blob.size) } }) : undefined;
    } catch { return undefined; }
  },
  async put(url, response) {
    try {
      if (useCacheApi) { await (await openCacheApi()).put(url, response); return; }
      const blob = await response.blob();
      await tx('readwrite', s => s.put(blob, url));
    } catch (e) { console.warn('cache put failed', url, e); }
  },
  async has(url) { return !!(await this.match(url)); },
  async clear() {
    if (useCacheApi) await caches.delete(CACHE);
    else await tx('readwrite', s => s.clear());
    cacheP = null;
  },
};

// Download a file with progress, store it in the cache, return its bytes.
export async function fetchModel(url, onProgress) {
  const hit = await modelCache.match(url);
  if (hit) { const b = await hit.arrayBuffer(); onProgress?.({ url, loaded: b.byteLength, total: b.byteLength, done: true }); return new Uint8Array(b); }
  let res, tries = 0;
  for (;;) {
    try { res = await fetch(url); if (res.ok) break; throw new Error(`HTTP ${res.status}`); }
    catch (e) { if (++tries >= 4) throw new Error(`Download failed: ${url.split('/').slice(-3).join('/')} (${e.message})`); await new Promise(r => setTimeout(r, 1500 * tries)); }
  }
  const total = +res.headers.get('content-length') || 0;
  const reader = res.body.getReader(), parts = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value); loaded += value.length;
    onProgress?.({ url, loaded, total: Math.max(total, loaded) });
  }
  const bytes = new Uint8Array(loaded);
  let o = 0; for (const p of parts) { bytes.set(p, o); o += p.length; }
  await modelCache.put(url, new Response(bytes, { headers: { 'content-type': 'application/octet-stream', 'content-length': String(loaded) } }));
  onProgress?.({ url, loaded, total: loaded, done: true });
  return bytes;
}
