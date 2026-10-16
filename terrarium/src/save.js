// Saved worlds: unlimited named worlds in the browser (IndexedDB), each with a picture of its cage,
// plus download/upload of a save file so nothing is ever stuck in one browser.

const DB = 'terrarium', STORE = 'worlds';
let dbp = null;

function db() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    let req;
    try { req = indexedDB.open(DB, 1); } catch (e) { rej(e); return; }
    req.onupgradeneeded = () => { const d = req.result; if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' }); };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  return dbp;
}

async function tx(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(STORE, mode);
    const s = t.objectStore(STORE);
    const r = fn(s);
    t.oncomplete = () => res(r && 'result' in r ? r.result : undefined);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}

// list without the big data blob
export async function listWorlds() {
  try {
    const all = await tx('readonly', (s) => s.getAll());
    return (all || []).map((w) => ({ id: w.id, name: w.name, mode: w.mode, updated: w.updated, created: w.created, thumb: w.thumb, day: w.day, people: w.people })).sort((a, b) => b.updated - a.updated);
  } catch (e) { return []; }
}

export async function getWorld(id) {
  try { return await tx('readonly', (s) => s.get(id)); } catch (e) { return null; }
}

export async function putWorld(rec) {
  rec.updated = Date.now();
  rec.created = rec.created || rec.updated;
  try { await tx('readwrite', (s) => s.put(rec)); return true; } catch (e) { console.warn('save failed', e); return false; }
}

export async function deleteWorld(id) {
  try { await tx('readwrite', (s) => s.delete(id)); return true; } catch (e) { return false; }
}

export function newId() { return 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

export function downloadWorld(rec) {
  const blob = new Blob([JSON.stringify({ terrarium: 1, name: rec.name, mode: rec.mode, thumb: rec.thumb, data: rec.data })], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `TERRARIUM-${(rec.name || 'world').replace(/[^a-z0-9-_ ]/gi, '').trim() || 'world'}.json`;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export function readWorldFile(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const j = JSON.parse(r.result);
        if (!j || !j.data) throw new Error('Not a TERRARIUM save file.');
        res({ id: newId(), name: j.name || 'Uploaded world', mode: j.mode || j.data.mode || 'creative', thumb: j.thumb || null, data: j.data });
      } catch (e) { rej(e); }
    };
    r.onerror = () => rej(r.error);
    r.readAsText(file);
  });
}
