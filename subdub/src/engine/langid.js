// Quick language guess for short subtitle text (no model needed). Returns a code or null.
import { langFromScript, looksEnglish, scriptOf } from './textclean.js';

const STOP = {
  en: 'the and you that what this have with your are was for not but just they it\'s don\'t i\'m he she we me my',
  es: 'que el la los las de del y en un una por para con no es está estás qué yo tú te me mi se lo le pero muy ya eso esto aquí ahora',
  pt: 'que o a os as de do da e em um uma por para com não é está você eu meu minha se lo isso aqui agora muito já então também',
  fr: 'le la les de des et en un une que qui ne pas est je tu il elle nous vous mon ma ce cette mais pour avec',
  it: 'il lo la gli le di e in un una che non è sono io tu lui lei noi voi mio mia questo quello ma per con',
  de: 'der die das und ist nicht ich du er sie wir ihr ein eine zu mit auf für aber was wie mein dein',
  id: 'yang dan di ini itu aku kamu tidak ada untuk dengan dari ke juga saja sudah akan bisa apa',
  tl: 'ang ng sa na at ay mga ko mo siya ako ikaw hindi ito iyan po ba lang naman',
};
const SETS = Object.fromEntries(Object.entries(STOP).map(([k, v]) => [k, new Set(v.split(' '))]));

export function guessLang(text) {
  const byScript = langFromScript(text);
  if (byScript) return byScript;
  const s = scriptOf(text);
  if (!s.total) return null;
  if (/[ăâđêôơư]/i.test(text) && /[ạảấầẩẫậắằẳẵặẹẻẽếềểễệịỉọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(text)) return 'vi';
  if (looksEnglish(text)) return 'en';
  const words = text.toLowerCase().match(/[\p{L}']+/gu) || [];
  let best = null, bestScore = 0;
  for (const [k, set] of Object.entries(SETS)) {
    let sc = 0; for (const w of words) if (set.has(w)) sc++;
    if (k === 'es' && /[ñ¿¡]/.test(text)) sc += 2;
    if (k === 'pt' && /[ãõç]|ção|ções/.test(text)) sc += 2;
    if (k === 'fr' && /[èêëçœ]|\b(c'est|j'ai|qu')/.test(text)) sc += 2;
    if (k === 'de' && /[äöüß]/.test(text)) sc += 2;
    if (sc > bestScore) { bestScore = sc; best = k; }
  }
  return bestScore > 0 ? best : null;
}
