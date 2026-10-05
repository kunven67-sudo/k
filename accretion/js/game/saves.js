// Save slots in this browser (autosave + three manual slots) and portable
// backup codes you can copy somewhere safe and paste back later.
const PREFIX = 'accretion-v2-';
export const SLOT_IDS = ['auto', 'slot1', 'slot2', 'slot3'];

function read(k) {
  try {
    const s = localStorage.getItem(PREFIX + k);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}
function write(k, v) {
  try {
    localStorage.setItem(PREFIX + k, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
}
function remove(k) {
  try { localStorage.removeItem(PREFIX + k); } catch { /* storage unavailable */ }
}

export class Saves {
  list() {
    return SLOT_IDS.map((id) => {
      const r = read(id);
      return { id, meta: r && r.meta ? r.meta : null };
    });
  }

  load(id) {
    const r = read(id);
    return r && r.data && r.data.v === 2 ? r.data : null;
  }

  save(id, data, meta) {
    return write(id, { meta: { ...meta, date: Date.now() }, data });
  }

  remove(id) {
    remove(id);
  }

  has(id) {
    return !!this.load(id);
  }

  // the most recently written slot, for "Continue"
  latest() {
    let best = null;
    for (const s of this.list()) if (s.meta && (!best || s.meta.date > best.meta.date)) best = s;
    return best;
  }

  getSettings() {
    return read('settings');
  }

  setSettings(s) {
    write('settings', s);
  }

  getProfile() {
    return read('profile') || { achievements: {}, seen: {}, tips: {} };
  }

  setProfile(p) {
    write('profile', p);
  }
}

// ---------------------------------------------------------------- backup codes

function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function pipe(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

export async function makeCode(data) {
  const json = new TextEncoder().encode(JSON.stringify(data));
  if (typeof CompressionStream === 'function') {
    try {
      const z = await pipe(json, new CompressionStream('deflate'));
      return `ACCRETION2Z:${toB64(z)}`;
    } catch { /* fall through to plain */ }
  }
  return `ACCRETION2:${toB64(json)}`;
}

export async function readCode(code) {
  const c = (code || '').trim().replace(/\s+/g, '');
  let bytes;
  if (c.startsWith('ACCRETION2Z:')) {
    if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot unpack compressed codes');
    bytes = await pipe(fromB64(c.slice(12)), new DecompressionStream('deflate'));
  } else if (c.startsWith('ACCRETION2:')) {
    bytes = fromB64(c.slice(11));
  } else throw new Error('That is not an Accretion backup code');
  const data = JSON.parse(new TextDecoder().decode(bytes));
  if (!data || data.v !== 2) throw new Error('That code is from a different version');
  return data;
}
