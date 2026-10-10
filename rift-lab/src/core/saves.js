// Save slots in the browser (many worlds, newest first).

const INDEX = 'riftlab.saves.v1';
const PREFIX = 'riftlab.save.v1.';

function readIndex() {
  try { return JSON.parse(localStorage.getItem(INDEX) || '[]'); } catch { return []; }
}
function writeIndex(list) {
  try { localStorage.setItem(INDEX, JSON.stringify(list)); } catch { /* storage full or blocked */ }
}

export const saves = {
  list() {
    return readIndex().sort((a, b) => b.savedAt - a.savedAt);
  },
  save(info, data) {
    const list = readIndex().filter((s) => s.id !== info.id);
    const meta = { id: info.id, name: info.name, seed: info.seed, mapName: info.mapName, savedAt: Date.now() };
    list.push(meta);
    try {
      localStorage.setItem(PREFIX + info.id, JSON.stringify(data));
      writeIndex(list);
      return true;
    } catch { return false; }
  },
  load(id) {
    try { return JSON.parse(localStorage.getItem(PREFIX + id) || 'null'); } catch { return null; }
  },
  remove(id) {
    writeIndex(readIndex().filter((s) => s.id !== id));
    try { localStorage.removeItem(PREFIX + id); } catch { /* ignore */ }
  },
};
