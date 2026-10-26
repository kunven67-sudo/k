// Screams, laughs, gasps and grunts don't need translating: they keep the character's real voice.
const INTERJ = /^[\s\p{P}\p{S}ーぁあぃいぅうぇえぉおっんゃゅょはひふへほわをァアィイゥウェエォオッンハヒフヘホワ啊哈呵嘿哦喔嗯呃唉哇呀嘻哼噢아어오우으이에애응헉흐하히호후흥헤에ah oh uh eh hm um ha he wa wo ya yo huh hmm mmm ugh whoa wow ow ai ay oi ui]+$/iu;
const EN_INTERJ = /^(ah+|oh+|uh+|eh+|h+m+|um+|ha(ha)*|he(he)*|whoa|wow|ow|ugh|huh|aah+|ooh+|eek|gasp|tch|hmph|mm+)[!?.,~\s]*$/i;

// short answers that ARE words (yes / no / yeah / hey): these get dubbed
const WORDS = /^(はい|はーい|いいえ|うん|ううん|いや|いやだ|やだ|おい|ええ|へえ|そう|ほら|네|예|아니|응|어|야|是|对|不|好|嗯嗯)[\p{P}\p{S}ー〜~]*$/u;

export function isNonverbal(text, english = '') {
  const t = text.replace(/\s+/g, '');
  if (!t) return true;
  if (WORDS.test(t)) return false;
  if (t.length <= 6 && INTERJ.test(t)) return true;
  if (english && EN_INTERJ.test(english.trim()) && t.length <= 8) return true;
  return false;
}
