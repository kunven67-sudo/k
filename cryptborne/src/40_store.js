
// ---------- saves: this browser always; your Claude account too when the page runs as a Claude artifact ----------
const Store = {
  KEY: 'cryptborne.saves.v1', mode: 'local', db: null, uid: null, saves: {}, gone: {}, pending: {}, busy: {}, onChange: null,
  init() {
    const raw = LS.get(this.KEY, null);
    if (raw && typeof raw === 'object') { this.saves = raw.saves && typeof raw.saves === 'object' ? raw.saves : {}; this.gone = raw.gone || {}; }
    for (const id in this.saves) if (!this.valid(this.saves[id])) delete this.saves[id];
    this.tryCloud();
  },
  valid(s) { return s && typeof s === 'object' && typeof s.id === 'string' && s.player && Array.isArray(s.player.inv); },
  writeLocal() { LS.set(this.KEY, { saves: this.saves, gone: this.gone }); },
  list() { return Object.values(this.saves).sort((a, b) => Math.max(b.lastLoaded || 0, b.lastSaved || 0) - Math.max(a.lastLoaded || 0, a.lastSaved || 0)); },
  get(id) { return this.saves[id] || null; },
  put(save) {
    this.saves[save.id] = JSON.parse(JSON.stringify(save));
    delete this.gone[save.id];
    this.writeLocal(); this.push(save.id);
    if (this.onChange) this.onChange();
  },
  del(id) {
    delete this.saves[id]; this.gone[id] = Date.now(); this.writeLocal();
    if (this.db && this.uid) { this.pending[id] = 'delete'; this.flush(id); }
    if (this.onChange) this.onChange();
  },
  push(id) { if (this.db && this.uid) { this.pending[id] = 'set'; this.flush(id); } },
  async flush(id) { // one write at a time per save; the newest state wins
    if (this.busy[id]) return; this.busy[id] = true;
    try {
      while (this.pending[id]) {
        const op = this.pending[id]; delete this.pending[id];
        const ref = this.db.collection('data/users/' + this.uid).doc(id);
        try {
          if (op === 'delete') await ref.delete();
          else if (this.saves[id]) await ref.set(this.saves[id]);
        } catch (e) {
          if (e && e.code === 'unavailable') { await new Promise((r) => setTimeout(r, 800 + Math.random() * 800)); try { if (op === 'delete') await ref.delete(); else if (this.saves[id]) await ref.set(this.saves[id]); } catch (e2) {} }
          else if (e && (e.code === 'invalid_argument' || e.code === 'revoked' || e.code === 'not_granted')) { this.mode = 'local'; this.db = null; if (this.onChange) this.onChange(); return; }
        }
      }
    } finally { this.busy[id] = false; }
  },
  async tryCloud() {
    try {
      const c = window.claude; if (!c || typeof c.use !== 'function') return;
      const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
      if (!db || !user) return;
      const uid = await user.id(); if (!uid) return;
      const snap = await db.collection('data/users/' + uid).get();
      this.db = db; this.uid = uid; this.mode = 'cloud';
      const inCloud = {};
      for (const d of snap.docs) {
        const s = d.data(); if (!this.valid(s)) continue; inCloud[s.id] = true;
        if (this.gone[s.id] && this.gone[s.id] > (s.lastSaved || 0)) { this.pending[s.id] = 'delete'; this.flush(s.id); continue; }
        const mine = this.saves[s.id];
        if (!mine || (s.lastSaved || 0) > (mine.lastSaved || 0) || (s.lastLoaded || 0) > (mine.lastLoaded || 0)) this.saves[s.id] = JSON.parse(JSON.stringify(s));
      }
      for (const id in this.saves) if (!inCloud[id]) this.push(id); // saves made before the account answered
      this.writeLocal();
      if (this.onChange) this.onChange();
    } catch (e) { /* stay on browser saves */ }
  },
};
