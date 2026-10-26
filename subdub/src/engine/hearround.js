// Reads a group of speech lines fast: the small model finds each line's language, then lines in the same
// language are read together by the big model in one pass (instead of one slow 30-second pass per line).
export async function hearRound(asr, clips, { tier = 'good', lead = null, showLang = null, force = null, stats = null } = {}) {
  const T = (k, t0) => { if (stats) stats[k] = (stats[k] || 0) + performance.now() - t0; };
  const durs = clips.map(c => c.length / 16000);
  let langs;
  if (force) langs = clips.map(() => [force, 1]);
  else {
    const prior = lead ? { [lead]: showLang ? 6 : 3 } : null;
    let t0 = performance.now();
    const tops = await asr.call('detectEach', { clips, prior });
    T('detect', t0);
    langs = tops.map((top, i) => {
      let [l, p] = top[0];
      if (lead && durs[i] < 1.2) return [lead, 1];                       // too short to tell: the show's language
      if (showLang && l !== showLang && l !== 'en' && p < 0.7) l = showLang; // unsure: the show's language
      return [l, p];
    });
  }
  const out = new Array(clips.length);
  for (let i = 0; i < clips.length;) {
    // lines next to each other in the same language go together (one pass holds about 28 s)
    const lang = langs[i][0];
    let j = i, tot = 0;
    while (j < clips.length && langs[j][0] === lang && (j === i || tot + durs[j] + 0.8 <= 28)) { tot += durs[j] + 0.8; j++; }
    const t1 = performance.now();
    const per = await asr.call('hearBatch', { clips: clips.slice(i, j), tier, lang });
    T('read', t1); if (stats) stats.passes = (stats.passes || 0) + 1;
    for (let k = i; k < j; k++) out[k] = { lang, p: langs[k][1], sentences: per[k - i] };
    i = j;
  }
  return out;
}
