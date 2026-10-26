// Reads the text subtitle tracks inside MKV/WebM files (ASS/SSA/SRT), without decoding any video.
// If the episode has English subtitles, their exact words become the English voice lines.
import { looksEnglish } from './textclean.js';

const ID = { EBML: 0x1a45dfa3, Segment: 0x18538067, Tracks: 0x1654ae6b, TrackEntry: 0xae, TrackNumber: 0xd7, TrackType: 0x83, CodecID: 0x86, Language: 0x22b59c, LanguageBCP47: 0x22b59d, Name: 0x536e, CodecPrivate: 0x63a2, Cluster: 0x1f43b675, Timecode: 0xe7, SimpleBlock: 0xa3, BlockGroup: 0xa0, Block: 0xa1, BlockDuration: 0x9b, Info: 0x1549a966, TimecodeScale: 0x2ad7b1 };
const MASTER = new Set([ID.Segment, ID.Tracks, ID.TrackEntry, ID.Cluster, ID.BlockGroup, ID.Info]);

// buffered reader over a File/Blob
class Reader {
  constructor(file) { this.f = file; this.buf = new Uint8Array(0); this.bufStart = 0; }
  async ensure(pos, n) {
    if (pos >= this.bufStart && pos + n <= this.bufStart + this.buf.length) return true;
    if (pos >= this.f.size) return false;
    const len = Math.max(n, 4 << 20);
    this.buf = new Uint8Array(await this.f.slice(pos, Math.min(this.f.size, pos + len)).arrayBuffer());
    this.bufStart = pos;
    return pos + n <= this.bufStart + this.buf.length;
  }
  byte(pos) { return this.buf[pos - this.bufStart]; }
  bytes(pos, n) { return this.buf.subarray(pos - this.bufStart, pos - this.bufStart + n); }
  async vint(pos, keepMarker) {
    if (!await this.ensure(pos, 8)) { if (!await this.ensure(pos, 1)) return null; }
    const b = this.byte(pos); let len = 1, mask = 0x80;
    while (len <= 8 && !(b & mask)) { len++; mask >>= 1; }
    if (len > 8) return null;
    await this.ensure(pos, len);
    let v = keepMarker ? b : b & (mask - 1), allOnes = (b & (mask - 1)) === mask - 1;
    for (let i = 1; i < len; i++) { const x = this.byte(pos + i); v = v * 256 + x; if (x !== 0xff) allOnes = false; }
    return { v, len, unknown: !keepMarker && allOnes };
  }
}
const uint = (b) => { let v = 0; for (const x of b) v = v * 256 + x; return v; };
const str = (b) => new TextDecoder().decode(b).replace(/\0+$/, '');

export async function readSubtitleTracks(file, { maxMs = 25000 } = {}) {
  if (!/\.(mkv|webm|mka|mk3d)$/i.test(file.name || '')) return null;
  const r = new Reader(file), t0 = performance.now();
  const tracks = new Map(); let scale = 1e6, clusterTime = 0;
  // walk elements; descend into the masters we care about, skip everything else by size
  let pos = 0;
  const end = file.size;
  const stack = [];
  while (pos < end) {
    if (performance.now() - t0 > maxMs) break;
    // close containers we have walked past
    while (stack.length && pos >= stack.at(-1).end) finish(stack.pop());
    const id = await r.vint(pos, true); if (!id) break;
    const sz = await r.vint(pos + id.len, false); if (!sz) break;
    const head = id.len + sz.len, dataPos = pos + head, size = sz.unknown ? Infinity : sz.v;
    const eid = id.v;
    if (eid === ID.EBML) { pos = dataPos + size; continue; }
    if (MASTER.has(eid)) {
      if (eid === ID.TrackEntry) stack.push({ entry: {} });
      if (eid === ID.BlockGroup) stack.push({ group: {} });
      pos = dataPos;
      if (eid === ID.Cluster) { while (stack.length) finish(stack.pop()); }
      // close masters when we pass their end (tracked loosely: TrackEntry/BlockGroup only)
      if (eid === ID.TrackEntry || eid === ID.BlockGroup) stack.at(-1).end = dataPos + size;
      continue;
    }
    const needData = [ID.TrackNumber, ID.TrackType, ID.CodecID, ID.Language, ID.LanguageBCP47, ID.Name, ID.Timecode, ID.TimecodeScale, ID.BlockDuration].includes(eid) || ((eid === ID.SimpleBlock || eid === ID.Block) && size < 1e6);
    if (needData && size !== Infinity) {
      if (!await r.ensure(dataPos, size)) break;
      const d = r.bytes(dataPos, size);
      const top = stack.at(-1);
      if (eid === ID.TimecodeScale) scale = uint(d);
      else if (eid === ID.Timecode) clusterTime = uint(d);
      else if (top?.entry) {
        const e = top.entry;
        if (eid === ID.TrackNumber) e.num = uint(d); else if (eid === ID.TrackType) e.type = uint(d);
        else if (eid === ID.CodecID) e.codec = str(d); else if (eid === ID.Language) e.lang = str(d);
        else if (eid === ID.LanguageBCP47) e.bcp = str(d); else if (eid === ID.Name) e.name = str(d);
      } else if (eid === ID.BlockDuration && top?.group) top.group.dur = uint(d);
      else if (eid === ID.SimpleBlock || eid === ID.Block) {
        // track number (vint), int16 relative time, flags, payload
        const tn = await r.vint(dataPos, false);
        const tr = tracks.get(tn.v);
        if (tr) {
          const rel = (d[tn.len] << 24 >> 16) | d[tn.len + 1];
          const blk = { t: (clusterTime + rel) * scale / 1e9, data: d.slice(tn.len + 3) };
          if (top?.group) top.group.blk = { ...blk, tr }; else tr.blocks.push(blk);
        }
      }
    }
    pos = dataPos + (size === Infinity ? 0 : size);
  }
  while (stack.length) finish(stack.pop());
  function finish(x) {
    if (x.entry && x.entry.type === 17 && /^S_TEXT\/(ASS|SSA|UTF8)/.test(x.entry.codec || '')) tracks.set(x.entry.num, { ...x.entry, blocks: [] });
    if (x.group?.blk) { const b = x.group.blk; b.tr.blocks.push({ t: b.t, dur: (x.group.dur || 0) * scale / 1e9, data: b.data }); }
  }
  // blocks -> lines
  const out = [];
  for (const tr of tracks.values()) {
    const lines = [];
    for (const b of tr.blocks) {
      let text = new TextDecoder().decode(b.data);
      if (/ASS|SSA/.test(tr.codec)) {
        const parts = text.split(','); // ReadOrder,Layer,Style,Name,MarginL,MarginR,MarginV,Effect,Text
        if (parts.length >= 9) { const style = parts[2] || ''; text = parts.slice(8).join(','); if (/\\p[1-9]/.test(text) || /sign|^ts|title|song|op|ed|kara/i.test(style)) continue; }
        text = text.replace(/\{[^}]*\}/g, '').replace(/\\[Nn]/g, ' ').replace(/\\h/g, ' ');
      } else text = text.replace(/<[^>]+>/g, '');
      text = text.replace(/\s+/g, ' ').trim();
      if (text) lines.push({ s: b.t, e: b.t + (b.dur || Math.min(6, 1 + text.length / 14)), text });
    }
    lines.sort((a, b) => a.s - b.s);
    const lang = (tr.bcp || tr.lang || '').toLowerCase();
    const sample = lines.slice(0, 40).map(l => l.text).join(' ');
    const isEn = /^en/.test(lang) || /english/i.test(tr.name || '') || ((!lang || lang === 'und') && looksEnglish(sample));
    out.push({ num: tr.num, lang: isEn ? 'en' : (lang.slice(0, 2) || 'und'), name: tr.name || '', lines });
  }
  const english = out.filter(t => t.lang === 'en').sort((a, b) => b.lines.length - a.lines.length)[0];
  return { tracks: out, english: english?.lines || null };
}
