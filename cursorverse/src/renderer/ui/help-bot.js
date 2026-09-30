// Offline help bot: matches a typed question against the built-in help
// (How-do-I answers + every page's explanations). No internet, no AI model.
import { PAGE_HELP, HOW_TO } from './help-data.js';

const STOP = new Set('a an the i me my to do does how can you is it in on of for and or what where why when this that be with it\'s im i\'m please pls bro just get make want need like so up at'.split(' '));
// words people use for the same thing
const SYNONYMS = {
  pointer: 'cursor', mouse: 'cursor', arrow: 'cursor', cursors: 'cursor',
  mic: 'voice', microphone: 'voice', speech: 'voice', talk: 'voice', talking: 'voice', say: 'voice', saying: 'voice',
  sound: 'sounds', typing: 'sounds', keyboard: 'sounds', clicky: 'sounds',
  song: 'music', songs: 'music', mp3: 'music',
  wallpaper: 'background', backgrounds: 'background',
  disable: 'off', stop: 'off', remove: 'off', turn: 'off', kill: 'off',
  enable: 'on', start: 'on',
  shortcut: 'hotkey', shortcuts: 'hotkey', hotkeys: 'hotkey', keybind: 'hotkey', keybinds: 'hotkey',
  bigger: 'size', smaller: 'size', large: 'size', big: 'size',
  trail: 'effects', trails: 'effects', sparkles: 'effects', effect: 'effects',
  website: 'browser', internet: 'browser', search: 'browser', tabs: 'browser', ads: 'browser',
  upgrade: 'update', updates: 'update', version: 'update', newest: 'update',
  quit: 'close', exit: 'close', tray: 'close',
  own: 'custom', draw: 'custom', create: 'custom', gif: 'custom', upload: 'custom',
  letters: 'letter', keys: 'key', buttons: 'button',
  wrong: 'mistake', mixed: 'mistake', misheard: 'mistake',
  slow: 'faster', delay: 'faster', fast: 'faster', lag: 'faster',
  preset: 'presets', combo: 'presets', setup: 'presets',
  colour: 'color', colors: 'color', glow: 'color',
};

function words(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .map((w) => SYNONYMS[w] || w.replace(/(ing|es|s)$/, '') || w);
}

function score(qWords, text, boostText = '') {
  const t = new Set(words(text));
  const b = new Set(words(boostText));
  let sc = 0;
  for (const w of qWords) {
    if (b.has(w)) sc += 3;
    else if (t.has(w)) sc += 1;
  }
  return sc;
}

const GREETINGS = /^(hi|hey|hello|yo|sup|wassup|what'?s up)\b/i;

// Returns { text, related: [{ page, title }], confident }
export function askBot(question) {
  const q = String(question || '').trim();
  if (!q) return { text: 'Ask me anything about CursorVerse, like "how do I make my cursor bigger?" 🙂', related: [], confident: false };
  if (GREETINGS.test(q) && q.split(/\s+/).length <= 3) {
    return { text: 'Yo bro 👋 What do you need help with? Try "how do I turn off typing sounds?" or "voice does not hear me".', related: [], confident: true };
  }
  const qWords = words(q);
  const how = HOW_TO.map(([question, answer]) => ({ question, answer, sc: score(qWords, answer, question) }))
    .sort((a, b) => b.sc - a.sc);
  const pageHits = [];
  for (const [id, p] of Object.entries(PAGE_HELP)) {
    for (const [name, what] of p.items) {
      pageHits.push({ page: id, title: p.title, name, what, sc: score(qWords, `${what} ${p.what}`, `${name} ${p.title}`) });
    }
  }
  pageHits.sort((a, b) => b.sc - a.sc);
  const best = how[0];
  const top = pageHits[0];
  if (best && best.sc >= 3 && best.sc >= (top?.sc || 0) - 1) {
    const related = [...new Map(pageHits.filter((h) => h.sc >= 2).slice(0, 3).map((h) => [h.page, { page: h.page, title: h.title }])).values()];
    return { text: `${best.answer}`, heading: best.question, related, confident: true };
  }
  if (top && top.sc >= 2) {
    const extra = pageHits.slice(1, 3).filter((h) => h.sc >= top.sc - 1 && h.page === top.page);
    return {
      text: `On ${top.title}: **${top.name}**: ${top.what}${extra.map((h) => `\n• ${h.name}: ${h.what}`).join('')}`,
      related: [{ page: top.page, title: top.title }],
      confident: top.sc >= 3,
    };
  }
  return {
    text: "Hmm, I'm not sure about that one 😅 Try different words, or click ❓ Help mode at the top and click the thing you're wondering about.",
    related: [],
    confident: false,
  };
}
