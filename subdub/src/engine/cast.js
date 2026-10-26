// The cast: tells characters apart by their voice fingerprint, decides girl/boy, gives each one their own English voice.
// Remembered per show, so a character you flipped stays flipped next episode.
import { GROUPS, groupFor, voiceById } from './voicebank.js';

const COLORS = ['#ff7ab6', '#6ec8ff', '#ffd166', '#8be38b', '#c79bff', '#ff9f5a', '#5ef0d6', '#ff6b6b', '#a3b8ff', '#f2a7ff', '#d4e157', '#80deea'];
const cos = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const norm = (v) => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; return Float32Array.from(v, x => x / s); };

export class Cast {
  constructor(showKey = 'default') { this.showKey = showKey; this.chars = []; this.next = 1; this.listeners = new Set(); this.recent = []; }
  onChange(cb) { this.listeners.add(cb); return () => this.listeners.delete(cb); }
  _changed() { for (const cb of this.listeners) cb(this); this._saveSoon(); }

  // One line of speech -> its character. info: {emb, gLogit, pf, pitch:{median}, dur}, t = time in seconds
  match(info, t = 0) {
    const pitch = info.pitch?.median || 0;
    const lineScore = (info.gLogit ?? (info.pf - 0.5) * 6) + (pitch > 0 ? 6 * (Math.log(pitch) - Math.log(180)) : 0);
    let ch = null;
    if (info.emb) {
      let best = null, bs = -1;
      const isGirlish = lineScore >= 0;
      for (const c of this.chars) {
        if (!c.centroid) continue;
        // closest of: the character's average voice, or any of their recent lines (people sound different when shouting)
        let s = cos(c.centroid, info.emb);
        for (const ex of c.ex || []) s = Math.max(s, cos(ex, info.emb) - 0.03);
        // same girl/boy side and similar pitch makes it more likely to be them
        if ((this.gender(c) === 'girl') === isGirlish) s += 0.03; else s -= 0.04;
        if (pitch && c.pitchAvg && Math.abs(Math.log(pitch / c.pitchAvg)) < 0.2) s += 0.02;
        if (s > bs) { bs = s; best = c; }
      }
      const thr = info.dur >= 2.5 ? 0.40 : info.dur >= 1.2 ? 0.34 : 0.30;
      if (best && bs >= thr) ch = best;
      // a short line is a weak fingerprint: rather than make a new character, give it to someone who just talked
      // with the same kind of voice (a new character needs a longer line to show up)
      if (!ch && info.dur < 1.6) ch = this._recentLike(info, lineScore, t, 0.12);
    } else {
      // too short to fingerprint: reuse a recent character with the same kind of voice
      const isGirlish = lineScore >= 0;
      for (let i = this.recent.length - 1; i >= 0; i--) {
        const c = this.recent[i];
        if (t - c.lastT > 25) break;
        const g = this.gender(c) === 'girl';
        const p = c.pitchAvg, ok = !pitch || !p || Math.abs(Math.log(pitch / p)) < 0.3;
        if (g === isGirlish && ok) { ch = c; break; }
      }
    }
    if (!ch) ch = this._create(info);
    this._update(ch, info, lineScore, t);
    return ch;
  }
  _recentLike(info, lineScore, t, minSim) {
    const pitch = info.pitch?.median || 0, isGirlish = lineScore >= 0;
    let best = null, bs = -1;
    for (let i = this.recent.length - 1; i >= 0; i--) {
      const c = this.recent[i];
      if (t - c.lastT > 25) break;
      if ((this.gender(c) === 'girl') !== isGirlish) continue;
      if (pitch && c.pitchAvg && Math.abs(Math.log(pitch / c.pitchAvg)) > 0.35) continue;
      const s = c.centroid && info.emb ? cos(c.centroid, info.emb) : minSim;
      if (s >= minSim && s > bs) { bs = s; best = c; }
    }
    return best;
  }
  _create(info) {
    const n = this.next++;
    const c = { id: 'c' + n + '_' + Math.random().toString(36).slice(2, 6), name: `Voice ${n}`, color: COLORS[(n - 1) % COLORS.length], centroid: info.emb ? Float32Array.from(info.emb) : null, n: 0, score: 0, pitchAvg: 0, override: null, voiceId: null, pickedByUser: false, lines: 0, lastT: 0, lastText: '' };
    this.chars.push(c);
    return c;
  }
  _update(c, info, lineScore, t) {
    if (info.emb && (info.dur >= 1.0 || !c.centroid)) { // short lines are too noisy to learn the voice from
      const k = Math.min(c.n, 30);
      c.centroid = c.centroid ? norm(c.centroid.map((v, i) => v * k + info.emb[i])) : Float32Array.from(info.emb);
      c.n++;
      c.ex = [...(c.ex || []), Float32Array.from(info.emb)].slice(-8);
    }
    const w = Math.min(1, info.dur / 2);
    c.score += Math.max(-8, Math.min(8, lineScore)) * w;
    const p = info.pitch?.median || 0;
    if (p > 0) c.pitchAvg = c.pitchAvg ? c.pitchAvg * 0.8 + p * 0.2 : p;
    c.lines++; c.lastT = t;
    this.recent = this.recent.filter(x => x !== c); this.recent.push(c);
    if (this.recent.length > 8) this.recent.shift();
    this._pickVoice(c);
  }
  gender(c) { return c.override || (c.score >= 0 ? 'girl' : 'boy'); }
  group(c) { return groupFor(this.gender(c), c.pitchAvg); }
  // keep a voice once chosen; re-pick only if the character's group really changed (and the user didn't choose)
  _pickVoice(c) {
    const g = this.group(c);
    const cur = c.voiceId && voiceById(c.voiceId);
    if (cur && (cur.group === g || c.pickedByUser)) return;
    if (cur && c.lines > 6 && !c.override && Math.abs(c.score) < 6) return; // settled: don't flip-flop
    const used = new Set(this.chars.filter(x => x !== c && x.voiceId).map(x => x.voiceId));
    const list = GROUPS[g];
    c.voiceId = (list.find(v => !used.has(v.id)) || list[(this.chars.indexOf(c)) % list.length]).id;
    this._changed();
  }
  voice(c) { return voiceById(c.voiceId) || GROUPS.girl[0]; }
  flip(c) { c.override = this.gender(c) === 'girl' ? 'boy' : 'girl'; c.pickedByUser = false; c.voiceId = null; this._pickVoice(c); this._changed(); }
  setVoice(c, id) { c.voiceId = id; c.pickedByUser = true; this._changed(); }
  rename(c, name) { c.name = name; this._changed(); }
  byId(id) { return this.chars.find(c => c.id === id); }

  // --- remember per show ---
  _saveSoon() { clearTimeout(this._t); this._t = setTimeout(() => this.save().catch(() => {}), 1500); }
  async save() {
    const data = this.chars.filter(c => c.lines >= 2 || c.override || c.pickedByUser).map(c => ({ ...c, centroid: c.centroid ? Array.from(c.centroid) : null, ex: (c.ex || []).map(e => Array.from(e)) }));
    await kv('put', 'cast:' + this.showKey, { next: this.next, chars: data });
  }
  async load() {
    const d = await kv('get', 'cast:' + this.showKey);
    if (!d) return false;
    this.next = d.next; this.chars = d.chars.map(c => ({ ...c, centroid: c.centroid ? Float32Array.from(c.centroid) : null, ex: (c.ex || []).map(e => Float32Array.from(e)), lastT: -1e9 }));
    this._changed();
    return true;
  }
}

// tiny IndexedDB key-value store for settings and casts
let dbp = null;
export function kv(op, key, val) {
  dbp ??= new Promise((res, rej) => { const q = indexedDB.open('subdub-data', 1); q.onupgradeneeded = () => q.result.createObjectStore('kv'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  return dbp.then(db => new Promise((res, rej) => {
    const t = db.transaction('kv', op === 'get' ? 'readonly' : 'readwrite'), s = t.objectStore('kv');
    const r = op === 'get' ? s.get(key) : op === 'del' ? s.delete(key) : s.put(val, key);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
}

// "Naruto - 012 [1080p].mkv" -> "naruto"  /  tab title "Episode 5 - Show Name - Site" -> "show name"
export function showKeyFrom(name) {
  let s = String(name || '').toLowerCase().replace(/\.[a-z0-9]{2,4}$/, '').replace(/\[[^\]]*\]|\([^)]*\)/g, ' ');
  s = s.replace(/\b(episode|ep|eps|e|s\d+e|season|vol|part|cap[ií]tulo|episodio|epis[oó]dio|第)\s*\d+\b|\b\d{1,4}\b/g, ' ');
  s = s.replace(/\b(1080p|720p|480p|x264|x265|hevc|aac|flac|bd|web-?dl|webrip|dual audio|sub|dub|eng|jpn|raw|hd|full|watch|online|free|anime)\b/g, ' ');
  s = s.replace(/([a-z])\d{1,3}\b/g, '$1');
  s = s.replace(/[_.\-|:–—]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s.split(' ').slice(0, 5).join(' ') || 'default';
}
