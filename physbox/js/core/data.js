// Loads the packed Earth data (real topography + climate moisture). Each file is a zlib stream of a
// 2160×1081 uint8 grid (row 0 = 90°N, column 0 = 180°W, 10 arc-minute cells).
// The single-file build embeds the files as base64 in window.__PHYSBOX_DATA__ instead of fetching them.
export const GRID_W = 2160;
export const GRID_H = 1081;

async function inflate(bytes) {
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot unpack the Earth data (no DecompressionStream). Please update your browser.');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function fromBase64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function fetchBytes(name) {
  const embedded = typeof window !== 'undefined' && window.__PHYSBOX_DATA__ && window.__PHYSBOX_DATA__[name];
  if (embedded) return fromBase64(embedded);
  const res = await fetch(new URL(`../../data/${name}`, import.meta.url));
  if (!res.ok) throw new Error(`Could not load data/${name} (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function loadData() {
  const [topoZ, moistZ] = await Promise.all([fetchBytes('earth-topo.bin'), fetchBytes('earth-moist.bin')]);
  const [topo, moist] = await Promise.all([inflate(topoZ), inflate(moistZ)]);
  if (topo.length !== GRID_W * GRID_H || moist.length !== GRID_W * GRID_H) throw new Error('Earth data has the wrong size');
  return { topo, moist, W: GRID_W, H: GRID_H };
}
