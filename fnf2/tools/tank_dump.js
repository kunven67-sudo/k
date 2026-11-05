// Tankman's cover songs (BF's part played as Tankman): each one's chart (your notes, the opponent's when one vocal track
// has both singers) + BF's vocal track, out of the built game, for tools/own/tank_voice.py.   node tools/tank_dump.js <dir>
const fs = require('fs'), playwright = require('/opt/node-tools/node_modules/playwright');
const OUT = process.argv[2];
(async () => {
  const b = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await (await b.newContext()).newPage();
  await p.goto('file:///home/user/k/fnf2/build/fnf2.html?dev=screen&name=mainMenu', { waitUntil: 'commit' });
  await p.waitForFunction(() => window.G && G.Songs && G.Packs && G.A, null, { timeout: 120000 });
  await p.waitForTimeout(15000);
  const list = await p.evaluate(() => {
    const ids = new Set(), out = [];
    for (const w of G.WEEK_ORDER) { const L = G.A.json('preload/data/levels/' + w + '.json'); if (L) for (const s of L.songs) ids.add(s); }
    for (const id of ids) {
      const ds = G.Songs.baseDifficulties(id, 'tankman').filter(d => d.cover);
      const byVar = {};
      for (const d of ds) (byVar[d.variation] = byVar[d.variation] || []).push(d.diff);
      for (const v in byVar) {
        let best = null;
        for (const diff of byVar[v]) { const s = G.Songs.build(id, diff, v, false); if (s && (!best || s.notes.filter(n => n.d < 4).length > best.n)) best = { diff, n: s.notes.filter(n => n.d < 4).length }; }
        if (best) out.push({ id, v, diff: best.diff });
      }
    }
    return out;
  });
  console.log(list.length, 'covers');
  for (const e of list) {
    const r = await p.evaluate(async e => {
      const s = G.Songs.build(e.id, e.diff, e.v, false);
      const pv = s.voices.filter(x => x.who === 'p').map(x => x.path);
      const ov = s.voices.filter(x => x.who === 'o').map(x => x.path);
      const need = pv.length ? pv : ov; for (const path of need) { const pk = G.Packs.owner.get(path); if (pk && !pk.bodyLoaded) await G.Packs.needBody(pk); }
      const tc = s.timeChanges || (G.Songs.meta(e.id, e.v) || {}).timeChanges;
      return { id: e.id, v: e.v, diff: e.diff, tc, pv, ov, notes: s.notes.filter(n => n.d < 4).map(n => [n.t, n.d, n.l || 0, n.k || '']), audio: pv.map(x => G.A.raw[x] || null), oaudio: pv.length ? [] : ov.map(x => G.A.raw[x] || null), onotes: pv.length ? [] : s.notes.filter(n => n.d >= 4).map(n => [n.t, n.d, n.l || 0, n.k || '']) };
    }, e);
    const base = OUT + '/' + e.id + '__' + e.v;
    r.audio.forEach((a, i) => { if (a) fs.writeFileSync(base + '.p' + i + '.' + (a.slice(0, 30).includes('ogg') ? 'ogg' : 'mp3'), Buffer.from(a.split(',')[1], 'base64')); });
    r.oaudio.forEach((a, i) => { if (a) fs.writeFileSync(base + '.o' + i + '.' + (a.slice(0, 30).includes('ogg') ? 'ogg' : 'mp3'), Buffer.from(a.split(',')[1], 'base64')); }); delete r.audio; delete r.oaudio; fs.writeFileSync(base + '.json', JSON.stringify(r));
    console.log(e.id, e.v, e.diff, r.notes.length, r.pv.join(','));
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
