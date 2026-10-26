// Clean-up for speech-to-text output: kill hallucinations and repetition loops, detect writing systems.

// Lines Whisper is known to invent on music/silence (credits from YouTube subtitles etc.)
const HALLUCINATIONS = [
  /ご視聴ありがとうございました/, /チャンネル登録/, /字幕/, /^ありがとうございました。?$/,
  /thanks? (you )?for watching/i, /subscribe/i, /^(thank you\.?)$/i, /^[\p{P}\p{S}\s]*$/u, /amara\.org/i, /subtitles by/i,
  /시청해 ?주셔서 감사합니다/, /구독/, /请不吝点赞/, /订阅/, /字幕由/, /感谢观看/, /MBC 뉴스/,
  /^(sous-titres|subtítulos|legendas)/i, /gracias por ver/i, /obrigad[oa] por assistir/i,
];

export function isHallucination(text) {
  const t = text.trim();
  return HALLUCINATIONS.some(r => r.test(t));
}

// Collapse loops like "아, 아, 아, 아, ..." or "the the the" or repeated phrases.
export function fixRepeats(text) {
  let t = text.trim();
  // same character run (CJK laughter etc.): keep at most 6
  t = t.replace(/(.)\1{6,}/gu, '$1$1$1$1$1$1');
  // repeated short chunk (1..20 chars, with optional separators) more than 3 times in a row
  for (let len = 20; len >= 1; len--) {
    const re = new RegExp(`((?:.{${len}}?)[\\s,、，.。!！?？~～]*)(?:\\1){3,}`, 'gu');
    t = t.replace(re, '$1$1');
  }
  return t.trim();
}

export function scriptOf(text) {
  let kana = 0, hangul = 0, han = 0, latin = 0, cyr = 0, other = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if ((c >= 0x3040 && c <= 0x30ff) || (c >= 0x31f0 && c <= 0x31ff) || (c >= 0xff66 && c <= 0xff9d)) kana++;
    else if ((c >= 0xac00 && c <= 0xd7af) || (c >= 0x1100 && c <= 0x11ff) || (c >= 0x3130 && c <= 0x318f)) hangul++;
    else if ((c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3400 && c <= 0x4dbf)) han++;
    else if (/\p{Script=Latin}/u.test(ch)) latin++;
    else if (/\p{Script=Cyrillic}/u.test(ch)) cyr++;
    else if (/\p{L}/u.test(ch)) other++;
  }
  const total = kana + hangul + han + latin + cyr + other;
  return { kana, hangul, han, latin, cyr, other, total };
}

// Best guess of the language from the letters alone (null if it can't tell).
export function langFromScript(text) {
  const s = scriptOf(text);
  if (!s.total) return null;
  if (s.kana / s.total > 0.1) return 'ja';
  if (s.hangul / s.total > 0.3) return 'ko';
  if (s.han / s.total > 0.5) return 'zh';
  if (s.cyr / s.total > 0.5) return 'ru';
  return null;
}

// Is this text English? (letters only Latin and lots of common English words)
const EN_WORDS = new Set('the a an and or but is are was were be been i you he she it we they me him her us them my your his its our their this that what who why how where when do does did not no yes to of in on for with at by from up out just so can will would could should have has had get got go going know like oh hey okay ok right well don\'t i\'m it\'s you\'re that\'s there here now come let\'s please sorry thank thanks'.split(' '));
export function looksEnglish(text) {
  const words = text.toLowerCase().match(/[a-z']+/g) || [];
  if (!words.length) return false;
  const s = scriptOf(text);
  if (s.latin < s.total * 0.9) return false;
  const hits = words.filter(w => EN_WORDS.has(w)).length;
  return words.length <= 2 ? hits === words.length : hits / words.length >= 0.3;
}
