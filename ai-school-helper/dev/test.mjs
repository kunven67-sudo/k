// End-to-end checks for AI School Helper, run in headless Chromium against
// dev/mock-claude.js (a fake claude.ai runtime with canned answers).
//
//   node dev/test.mjs              run every check
//   node dev/test.mjs --shots DIR  also save screenshots into DIR
//   node dev/test.mjs --preview    write dev/preview.html to click around in a browser
//
// Needs Playwright (`npm i -D playwright`, or a global install).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(here, '..', 'index.html'), 'utf8');
const mock = readFileSync(join(here, 'mock-claude.js'), 'utf8');
// The same skeleton claude.ai wraps a published page in.
const RESET = ':root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif;background:#fafafa}img{max-width:100%}[hidden]{display:none!important}';
const page = (withMock = true) => `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${RESET}</style></head><body>${withMock ? `<script>${mock}</script>` : ''}${app}</body></html>`;

const args = process.argv.slice(2);
if (args.includes('--preview')) {
  writeFileSync(join(here, 'preview.html'), page());
  console.log('Wrote dev/preview.html (uses the fake Claude, answers are canned).');
  process.exit(0);
}
const shotDir = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
const realFonts = args.includes('--fonts'); // fetch Google Fonts (via curl) so screenshots show the real type
const fontCache = new Map();
function fetchFont(url) {
  if (!fontCache.has(url)) {
    const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
    fontCache.set(url, execSync(`curl -sS --fail -A "${ua}" "${url}"`, { maxBuffer: 1 << 24 }));
  }
  return fontCache.get(url);
}
if (shotDir) mkdirSync(shotDir, { recursive: true });

let playwright;
try { playwright = await import('playwright'); } catch {
  const req = createRequire(join(execSync('npm root -g').toString().trim(), 'noop.js'));
  playwright = req('playwright');
}
const { chromium } = playwright;

const URL = 'http://ash.test/';
const HTML = page();
const SPEECH_STUB = () => {
  window.__spoken = [];
  const fake = {
    speaking: false, pending: false, paused: false, _cur: null,
    getVoices: () => [], addEventListener() {}, removeEventListener() {}, pause() {}, resume() {},
    cancel() { const u = fake._cur; fake._cur = null; if (u && u.onerror) u.onerror({ error: 'interrupted' }); },
    speak(u) { window.__spoken.push(u.text); fake._cur = u; setTimeout(() => { if (fake._cur === u) { fake._cur = null; if (u.onend) u.onend({}); } }, 15); },
  };
  Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
};

const browser = await chromium.launch();
let failures = 0, passes = 0;
const problems = [];
function ok(cond, msg) {
  if (cond) { passes++; return; }
  failures++; problems.push(msg); console.log('   ✗ ' + msg);
}
async function open({ config = {}, speech = true, colorScheme = 'light', viewport = { width: 1100, height: 900 }, storage = null } = {}) {
  const ctx = await browser.newContext({ viewport, colorScheme, deviceScaleFactor: 1 });
  await ctx.route('**/*', route => {
    const u = route.request().url();
    if (u === URL) return route.fulfill({ status: 200, contentType: 'text/html', body: HTML });
    if (realFonts && /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)) {
      try { return route.fulfill({ status: 200, contentType: u.includes('googleapis') ? 'text/css' : 'font/woff2', body: fetchFont(u), headers: { 'access-control-allow-origin': '*' } }); } catch { return route.abort(); }
    }
    return route.abort();
  });
  await ctx.addInitScript(cfg => { window.__mockConfig = cfg; window.__ASH_TEST__ = true; }, config);
  if (speech === true) await ctx.addInitScript(SPEECH_STUB);
  if (speech === false) await ctx.addInitScript(() => Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }));
  if (storage) await ctx.addInitScript(s => { if (!sessionStorage.getItem('__seeded')) { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); sessionStorage.setItem('__seeded', '1'); } }, storage);
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', e => p.errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(m.text())) p.errors.push('console: ' + m.text()); });
  await p.goto(URL);
  return { ctx, p };
}
const M = (p, fn, arg) => p.evaluate(fn, arg);
const text = (p, sel) => p.locator(sel).first().innerText();
const idle = p => p.waitForFunction(() => !window.__ASH_TEST__.S.busy, null, { timeout: 8000 });
const settle = p => p.waitForFunction(() => window.__ASH_TEST__.pending() === 0, null, { timeout: 8000 });
const reload = async p => { await settle(p); await p.reload(); };
async function shot(p, name, full = false) { if (shotDir) await p.screenshot({ path: join(shotDir, name + '.png'), fullPage: full }); }
async function onboard(p, name = 'Sam', grade = '3') {
  await p.waitForSelector('#profile-form');
  await p.fill('#pf-name', name);
  await p.click(`[data-act="pf-grade"][data-g="${grade}"]`);
  await p.click('#profile-form button[type="submit"]');
  await p.waitForSelector('#ask-form');
}
async function ask(p, msg) {
  await p.fill('#ask-text', msg);
  await p.click('#ask-form button[type="submit"]');
  await p.waitForSelector('#msgs');
  await idle(p);
}
async function say(p, msg) {
  await p.fill('#chat-text', msg);
  await p.click('#chat-form button[type="submit"]');
  await p.waitForFunction(() => window.__ASH_TEST__.S.busy || window.__ASH_TEST__.S.lastErr, null, { timeout: 3000 }).catch(() => {});
  await idle(p);
}
const lastCall = p => M(p, () => { const c = window.__mock.calls; return c[c.length - 1]; });
const lastUserTurn = call => (Array.isArray(call.input) ? call.input[call.input.length - 1].content : call.input);
async function noOverflow(p, label) {
  const o = await M(p, () => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  ok(o.sw <= o.w, `${label}: page scrolls sideways (${o.sw} > ${o.w})`);
}
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
async function test(name, fn) {
  if (only && !name.includes(only)) return;
  const before = failures;
  try { await fn(); } catch (e) { failures++; problems.push(`${name}: threw ${e.message.split('\n')[0]}`); console.log('   ✗ threw: ' + e.message.split('\n').slice(0, 3).join(' | ')); }
  console.log(`${failures === before ? '✓' : '✗'} ${name}`);
}

// ---------------------------------------------------------------- unit-ish
await test('helpers: markdown, stars, streaks, levels, parsing', async () => {
  const { ctx, p } = await open();
  const r = await M(p, () => {
    const T = window.__ASH_TEST__;
    const out = {};
    out.md1 = T.md('**Bold** and *whirr* and 3 * 4 * 5\n- one\n- two\n\n1. a\n2. b');
    out.md2 = T.md('<img src=x onerror=alert(1)> & "q"');
    out.md3 = T.md('3. third\n\n4. fourth');
    out.clean = [T.cleanStar('Great job! [[STAR]]'), T.cleanStar('Great [[sta'), T.cleanStar('Nice [[ Star ]] there')];
    const p1 = T.normalizeProfile({ id: 'a', name: 'A', grade: '3' });
    const d = (y, m, dd) => new Date(y, m, dd, 12);
    out.s1 = [T.bumpStreak(p1, d(2026, 9, 1)), p1.streak.n];
    out.s2 = [T.bumpStreak(p1, d(2026, 9, 1)), p1.streak.n];
    out.s3 = [T.bumpStreak(p1, d(2026, 9, 2)), p1.streak.n];
    out.s4 = [T.bumpStreak(p1, d(2026, 9, 4)), p1.streak.n, p1.streak.best];
    out.sNow = [T.streakNow(p1, d(2026, 9, 5)), T.streakNow(p1, d(2026, 9, 6))];
    const p2 = T.normalizeProfile({ id: 'b', name: 'B', grade: 'K' });
    out.month = [T.bumpStreak(p2, d(2026, 9, 31)), T.bumpStreak(p2, d(2026, 10, 1)), p2.streak.n];
    out.lv = [T.levelOf(0), T.levelOf(9), T.levelOf(10), T.levelOf(399), T.levelOf(400), T.levelOf(9999)];
    out.words = T.parseWordList('1. because\n2) friend, Friend; necessary\n<b>x</b>\n  ice cream \n\n“said”');
    out.mask = T.maskWord('Because I said so, because!', 'because');
    out.json = [T.parseLooseJSON('```json\n{"a":1}\n```'), T.parseLooseJSON('Sure! {"b":2} hope that helps'), T.parseLooseJSON('nope')];
    out.choices = [T.fixChoices(['A) 12', 'B) 13', 'C) 14', 'D) 15']), T.fixChoices(['A. Lincoln', 'Washington', 'Adams', 'Grant'])];
    let qz; try { qz = T.validateQuiz({ title: 'T', questions: [{ q: 'Q1', choices: ['a', 'b', 'c', 'd'], answer: 2 }, { q: 'Q2', choices: ['x', 'X', 'y'], answer: '1' }, { q: 'Q3', choices: ['1', '2'], answer: 5 }, { q: 'Q4', choices: ['p', 'q', 'r', 's'], answer: 0 }, { q: 'Q5', choices: ['m', 'n', 'o', 'p'], answer: 3 }] }, 5); } catch (e) { qz = e; }
    out.qz = qz;
    try { T.validateQuiz({ questions: [{ q: 'only', choices: ['a', 'b'], answer: 0 }] }, 5); out.qzBad = 'no throw'; } catch (e) { out.qzBad = e.code; }
    out.sp = T.validateSpelling({ words: [{ word: 'friend', sentence: 'My friend is fun.', clue: 'A friend is a pal', tip: 'friend ends in end' }, { word: 'because', clue: 'reason' }] }, 5, ['because', 'friend', 'enough']);
    out.math = [];
    for (const g of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13]) for (let k = 0; k < 60; k++) out.math.push({ g, ...T.mathItem(g) });
    out.chunks = T.chunkText('One. Two? ' + 'word '.repeat(80) + 'end.');
    out.speak = T.speakable('**7 × 8** = 56 🎉 and 5 - 3 and 10 − 2 [[STAR]]');
    out.speak2 = T.speakable('2 × 3 × 4 and 1 + 2 + 3');
    out.subj = ['I need help reading', 'what is 7 x 8', 'help me spell necessary', 'my essay', 'cells and atoms', 'the civil war', 'hello'].map(T.guessSubject);
    return out;
  });
  ok(r.md1.includes('<strong>Bold</strong>') && r.md1.includes('<em>whirr</em>') && r.md1.includes('3 * 4 * 5') && r.md1.includes('<ul><li>one</li><li>two</li></ul>') && r.md1.includes('<ol><li>a</li><li>b</li></ol>'), 'md basic: ' + r.md1);
  ok(!r.md2.includes('<img') && r.md2.includes('&lt;img'), 'md escapes html: ' + r.md2);
  ok(r.md3.includes('<ol start="3">') && r.md3.includes('<ol start="4">'), 'md keeps list numbering: ' + r.md3);
  ok(r.clean[0] === 'Great job!' && r.clean[1] === 'Great' && r.clean[2] === 'Nice there', 'cleanStar: ' + JSON.stringify(r.clean));
  ok(JSON.stringify([r.s1, r.s2, r.s3]) === JSON.stringify([[true, 1], [false, 1], [true, 2]]), 'streak counting: ' + JSON.stringify([r.s1, r.s2, r.s3]));
  ok(r.s4[1] === 1 && r.s4[2] === 2, 'streak resets after a missed day: ' + JSON.stringify(r.s4));
  ok(r.sNow[0] === 1 && r.sNow[1] === 0, 'streakNow shows 0 once a day is missed: ' + JSON.stringify(r.sNow));
  ok(r.month[2] === 2, 'streak carries across a month end: ' + JSON.stringify(r.month));
  ok(r.lv[0].n === 1 && r.lv[1].toNext === 1 && r.lv[2].name === 'Explorer' && r.lv[3].name === 'Legend' && r.lv[4].name === 'Mastermind' && r.lv[4].next === null && r.lv[5].pct === 100, 'levels: ' + JSON.stringify(r.lv.map(l => [l.n, l.name, l.toNext, l.pct])));
  ok(JSON.stringify(r.words) === JSON.stringify(['because', 'friend', 'necessary', 'ice cream', 'said']), 'word list parsing: ' + JSON.stringify(r.words));
  ok(r.mask === '_____ I said so, _____!', 'mask word: ' + r.mask);
  ok(r.json[0].a === 1 && r.json[1].b === 2 && r.json[2] === undefined, 'loose JSON: ' + JSON.stringify(r.json));
  ok(r.choices[0].join() === '12,13,14,15' && r.choices[1][0] === 'A. Lincoln', 'choice letter stripping: ' + JSON.stringify(r.choices));
  ok(r.qz && r.qz.items && r.qz.items.length === 4, 'validateQuiz keeps valid questions: ' + JSON.stringify(r.qz));
  if (r.qz && r.qz.items) {
    for (const it of r.qz.items) ok(it.answer >= 0 && it.answer < it.choices.length, 'answer index in range: ' + JSON.stringify(it));
    const q1 = r.qz.items.find(i => i.q === 'Q1'); ok(q1 && q1.choices[q1.answer] === 'c', 'Q1 answer survives the shuffle');
    const q2 = r.qz.items.find(i => i.q === 'Q2'); ok(q2 && q2.choices.length === 2 && q2.choices[q2.answer].toLowerCase() === 'x', 'Q2 dedupes x/X and keeps the answer: ' + JSON.stringify(q2));
  }
  ok(r.qzBad === 'bad_quiz', 'validateQuiz rejects junk: ' + r.qzBad);
  ok(r.sp.items.map(i => i.word).join() === 'because,friend,enough', 'spelling keeps the kid\'s words in order');
  ok(!r.sp.items[1].clue.toLowerCase().includes('friend') && r.sp.items[1].tip === '', 'spelling clue/tip never shows the word: ' + JSON.stringify(r.sp.items[1]));
  for (const m of r.math) {
    const good = m.choices.length === 4 && new Set(m.choices).size === 4 && m.answer >= 0 && !/NaN|undefined|Infinity/.test(m.q + m.choices.join() + m.explain);
    if (!good) { ok(false, 'bad offline math item: ' + JSON.stringify(m)); break; }
    if (m.g < 6 && m.choices.some(c => c.startsWith('−'))) { ok(false, 'negative choice for a little kid: ' + JSON.stringify(m)); break; }
  }
  const lvl = r.math.map(m => {
    const q = m.q.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/');
    const a = +m.choices[m.answer].replace('−', '-');
    let v;
    if (/^What is (.*)\?$/.test(q) && !/%|of|\^/.test(q)) v = Function('return ' + q.match(/^What is (.*)\?$/)[1])();
    else if (/(\d+)% of (\d+)/.test(q)) { const [, a1, b1] = q.match(/(\d+)% of (\d+)/); v = a1 * b1 / 100; }
    else if (/1\/(\d+) of (\d+)/.test(q)) { const [, a1, b1] = q.match(/1\/(\d+) of (\d+)/); v = b1 / a1; }
    else if (/(\d+)\^(\d+)/.test(q)) { const [, a1, b1] = q.match(/(\d+)\^(\d+)/); v = a1 ** b1; }
    else if (/Solve for x: (\d+)x ([+-]) (\d+) = (-?\d+)/.test(q)) { const [, mm, sg, bb, cc] = q.match(/Solve for x: (\d+)x ([+-]) (\d+) = (-?\d+)/); v = (cc - (sg === '+' ? +bb : -bb)) / mm; }
    return Math.abs(v - a) < 1e-9 ? null : { q: m.q, a, v };
  }).filter(Boolean);
  ok(lvl.length === 0, 'offline math answers are correct: ' + JSON.stringify(lvl.slice(0, 3)));
  ok(r.chunks.length >= 3 && r.chunks.every(c => c.length <= 180), 'speech chunks stay short: ' + JSON.stringify(r.chunks.map(c => c.length)));
  ok(r.speak === '7 times 8 equals 56 and 5 minus 3 and 10 minus 2', 'speakable: ' + r.speak);
  ok(r.speak2 === '2 times 3 times 4 and 1 plus 2 plus 3', 'speakable chains: ' + r.speak2);
  ok(JSON.stringify(r.subj) === JSON.stringify(['reading', 'math', 'spelling', 'writing', 'science', 'social', null]), 'guessSubject: ' + JSON.stringify(r.subj));
  ok(p.errors.length === 0, 'no page errors: ' + p.errors.join(' | '));
  await ctx.close();
});

// ---------------------------------------------------------------- main flow
await test('first run: onboarding, chat, re-explain, stars, read-aloud, memory, reload', async () => {
  const { ctx, p } = await open();
  await p.waitForSelector('#profile-form');
  await shot(p, '01-onboarding');
  await p.click('#profile-form button[type="submit"]');
  ok((await text(p, '#pf-err')).includes('name'), 'asks for a name first');
  await p.fill('#pf-name', 'Sam');
  await p.click('#profile-form button[type="submit"]');
  ok((await text(p, '#pf-err')).includes('grade'), 'asks for a grade');
  await p.click('[data-act="pf-grade"][data-g="3"]');
  await p.click('[data-act="pf-avatar"][data-a="🦖"]');
  await p.click('#profile-form button[type="submit"]');
  await p.waitForSelector('#ask-form');
  ok((await text(p, 'h1')).includes('Sam'), 'home greets Sam');
  ok((await p.locator('.topic').allInnerTexts()).some(t => t.includes('Multiplication facts')), '3rd grade math topics show');
  ok(await p.locator('.how').count() === 1, 'how-it-works card shows before the first chat');
  ok(await p.locator('[data-act="photo"]').count() === 1, 'photo button shows when images are supported');
  await shot(p, '02-home', true);
  const meta = await M(p, () => window.__mock.dump()['data/users/u_local_test/meta']);
  ok(meta && meta.profiles[0].name === 'Sam' && meta.profiles[0].grade === '3' && meta.profiles[0].avatar === '🦖', 'profile saved to the private db subtree');

  await ask(p, 'I need help with 7 × 8');
  ok(await p.locator('.msg.me').count() === 1 && await p.locator('.msg.tutor').count() === 1, 'one question, one answer');
  ok(await p.locator('.msg.tutor .bubble ul li').count() === 2, 'Bolt\'s markdown list renders');
  ok(await p.locator('.quick [data-k="again"]').count() === 1, '"I still don\'t get it" button shows');
  let call = await lastCall(p);
  ok(Array.isArray(call.input) && call.input[0].content.includes('You are Bolt') && call.input[0].content.includes('3rd grade') && call.input[0].content.includes('Name: Sam'), 'tutor rules + grade + name are sent');
  ok(call.input[0].content.includes('Never give the final answer'), 'no-answers rule is in the prompt');
  ok(call.input[0].content.includes('DIFFERENT problem'), 'similar-example rule is in the prompt');
  ok(call.opts.modelTier === 'quick' && call.opts.cache === false, 'chat uses quick tier, no cache: ' + JSON.stringify(call.opts));
  ok(!call.bad, 'sample input is valid: ' + call.bad);
  ok((await text(p, '.chat-title')).includes('I need help with 7 × 8'), 'chat title from the question');
  await shot(p, '03-chat');

  await p.click('.quick [data-k="again"]');
  await p.waitForFunction(() => window.__ASH_TEST__.S.busy).catch(() => {});
  await idle(p);
  call = await lastCall(p);
  ok(lastUserTurn(call).startsWith('I still don\'t get it') && lastUserTurn(call).includes('totally NEW way'), 're-explain sends the hidden "new way" note');
  ok(call.input.length === 4 && call.input[2].role === 'assistant', 'history is sent in order: ' + call.input.map(t => t.role).join(','));
  ok((await p.locator('.msg.tutor').last().innerText()).includes('new way'), 'Bolt answers the new way');

  await say(p, '56');
  ok(await p.locator('.msg.tutor .sticker').count() === 1, 'star sticker on the winning answer');
  ok(!(await p.locator('#msgs').innerText()).includes('[[STAR]]'), '[[STAR]] marker never shows');
  await p.waitForTimeout(1000);
  ok((await text(p, '#star-count')) === '1', 'star counter is 1: ' + await text(p, '#star-count'));
  call = await lastCall(p);
  ok(call.input.some(t => t.role === 'assistant' && t.content.includes('new way')), 'earlier replies stay in history');

  await p.click('.msg.tutor [data-act="speak"] >> nth=-1');
  await p.waitForTimeout(150);
  const spoken = await M(p, () => window.__spoken);
  ok(spoken.length >= 1 && spoken.join(' ').includes('7 times 8 equals 56') && !/[🎉*]/u.test(spoken.join(' ')), 'read-aloud speaks clean text: ' + JSON.stringify(spoken));

  await p.click('[data-act="back"]');
  await p.waitForSelector('#ask-form');
  await p.waitForFunction(() => document.querySelector('#home-chats') && document.querySelector('#home-chats').innerText.includes('Times tables practice'), null, { timeout: 4000 }).catch(() => {});
  ok((await text(p, '#home-chats')).includes('Times tables practice'), 'summary renames the chat on the home list');
  await p.click('#memory summary');
  ok((await text(p, '#memory')).includes('Skip counting helps them'), 'Bolt remembers notes from the chat');
  const sumCall = await M(p, () => window.__mock.calls.find(c => typeof c.input === 'string' && c.input.includes('memory notes')));
  ok(sumCall && sumCall.opts.modelTier === 'quick' && sumCall.input.includes('Student: 56'), 'summary call gets the transcript');
  await shot(p, '04-home-after', true);

  await reload(p);
  await p.waitForSelector('#ask-form');
  ok((await text(p, '#home-chats')).includes('Times tables practice'), 'chat list survives a reload');
  ok((await text(p, '#star-count')) === '1', 'stars survive a reload');
  await p.click('[data-act="open-chat"]');
  await p.waitForSelector('#msgs');
  ok(await p.locator('.msg').count() === 6, 'all 6 messages come back: ' + await p.locator('.msg').count());
  ok(await p.locator('.msg.tutor .sticker').count() === 1, 'star sticker is saved');
  await p.click('[data-act="back"]');

  await p.click('.topic >> nth=0');
  await p.waitForSelector('#msgs');
  await idle(p);
  call = await lastCall(p);
  ok(lastUserTurn(call).includes('Teach me about Counting') === false && lastUserTurn(call).includes('Teach me about Multiplication facts') && lastUserTurn(call).includes('mini-lesson'), 'topic chip starts a mini-lesson: ' + lastUserTurn(call).slice(0, 80));
  ok(call.input[0].content.includes('Learning the 7 and 8 times tables') && call.input[0].content.includes('Times tables practice'), 'new chats remember notes + past chats');
  ok(p.errors.length === 0, 'no page errors: ' + p.errors.join(' | '));
  const ov = await M(p, () => window.__mock.overlaps);
  ok(ov === 0, 'never two writes at once on one document: ' + ov);
  await ctx.close();
});

await test('stop, errors, retry, refusals', async () => {
  const { ctx, p } = await open({ config: { delay: 120, chunk: 6 } });
  await onboard(p);
  await p.fill('#ask-text', 'Help me with fractions');
  await p.click('#ask-form button[type="submit"]');
  await p.waitForSelector('#live-bubble');
  ok(await p.locator('.thinking').count() === 1, 'thinking dots before the first words');
  await p.waitForFunction(() => window.__ASH_TEST__.S.streamText.length > 10);
  await p.click('[data-act="stop"]');
  await idle(p);
  ok((await p.locator('.msg.tutor').last().innerText()).includes('you stopped Bolt'), 'stopped reply is kept and marked');
  await M(p, () => { window.__mock.delay = 5; window.__mock.chunk = 40; window.__mock.fail = { code: 'upstream_error', text: 'Half an answer about frac' }; });
  await say(p, 'what is a denominator');
  ok(await p.locator('.bubble.oops').count() === 1 && (await text(p, '.bubble.oops')).includes('glitched'), 'glitch shows a friendly error');
  ok((await p.locator('#msgs').innerText()).includes('Half an answer'), 'partial answer stays on screen');
  ok(await p.locator('[data-act="retry"]').count() === 1, 'Try again button');
  await p.click('[data-act="retry"]');
  await idle(p);
  ok(!(await p.locator('#msgs').innerText()).includes('Half an answer'), 'retry replaces the cut-off answer');
  ok(await p.locator('.bubble.oops').count() === 0, 'error clears after retry');
  let call = await lastCall(p);
  ok(call.input[call.input.length - 1].content.startsWith('what is a denominator') && !call.bad, 'retry resends the same question: ' + call.bad);
  await M(p, () => { window.__mock.fail = { code: 'rate_limited' }; });
  await say(p, 'next one');
  ok((await text(p, '.bubble.oops')).includes('overheating'), 'rate limit message');
  await M(p, () => { window.__mock.fail = { code: 'refused' }; });
  await say(p, 'something weird');
  ok((await text(p, '.bubble.oops')).includes('can\'t help') && await p.locator('[data-act="retry"]').count() === 0, 'refusal: no retry button');
  await say(p, 'ok, a school question then');
  ok(await p.locator('.bubble.oops').count() === 0, 'sending a new message clears the error');
  call = await lastCall(p);
  ok(!call.bad, 'turns stay valid after failures (user,user is allowed): ' + call.input.map(t => t.role).join(','));
  await M(p, () => { window.__mock.fail = { code: 'not_granted' }; });
  await say(p, 'hello?');
  ok((await text(p, '.bubble.oops')).includes('needs your OK') && await p.locator('.banner [data-act="perm"]').count() === 1, 'declined consent shows the "Let Bolt think" banner');
  ok(await p.locator('#chat-form').count() === 0, 'composer hides while Bolt has no permission');
  await M(p, () => { window.__mock.permAfterManage = 'granted'; window.__mock.perm = 'granted'; });
  await p.click('.banner [data-act="perm"]');
  await p.waitForSelector('#chat-form');
  ok(await p.locator('.banner').count() === 0, 'permission fixed: banner gone');
  ok(p.errors.length === 0, 'no page errors: ' + p.errors.join(' | '));
  await ctx.close();
});

await test('homework photo', async () => {
  const { ctx, p } = await open();
  await onboard(p, 'Ava', '5');
  const png = await p.screenshot({ clip: { x: 0, y: 0, width: 420, height: 300 } });
  const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-act="photo"][data-where="home"]')]);
  await chooser.setFiles({ name: 'homework.png', mimeType: 'image/png', buffer: png });
  await p.waitForSelector('#home-photo img');
  await p.click('#ask-form button[type="submit"]');
  await p.waitForSelector('#msgs');
  await idle(p);
  const call = await lastCall(p);
  ok(call.opts.images && call.opts.modelTier === 'default', 'photo is sent with the careful tier: ' + JSON.stringify(call.opts));
  ok(lastUserTurn(call).includes('📸 I see:'), 'photo note asks Bolt to describe what he sees');
  ok(await p.locator('.msg.me img.thumb').count() === 1, 'thumbnail shows in the chat');
  ok((await p.locator('.msg.tutor').innerText()).includes('I see'), 'Bolt describes the photo');
  const doc = await M(p, () => { const d = window.__mock.dump(); return Object.entries(d).find(([k]) => k.includes('/chat-'))[1]; });
  ok(doc.msgs[0].img && doc.msgs[0].img.startsWith('data:image/jpeg;base64,') && doc.msgs[0].img.length < 40000, 'small thumbnail saved: ' + (doc.msgs[0].img || '').length);
  await say(p, 'is it 28?');
  const call2 = await lastCall(p);
  ok(!call2.opts.images && call2.opts.modelTier === 'quick', 'follow-ups don\'t resend the photo');
  ok(p.errors.length === 0, 'no page errors: ' + p.errors.join(' | '));
  await ctx.close();
});

await test('quiz: build, answer, hints, reveal, results, ask Bolt', async () => {
  const { ctx, p } = await open();
  await onboard(p);
  await p.click('[data-act="quiz-setup"]');
  await p.waitForSelector('#quiz-form');
  await p.click('[data-act="qf-topic"] >> nth=0');
  await shot(p, '05-quiz-setup');
  await p.click('#quiz-form button[type="submit"]');
  await p.waitForSelector('.qcard');
  let call = await lastCall(p);
  ok(call.opts.modelTier === 'default' && call.input.includes('Topic: Multiplication facts') && call.input.includes('exactly 5'), 'quiz prompt has topic, count, careful tier');
  const answerOf = () => M(p, () => { const q = window.__ASH_TEST__.S.quiz, it = q.items[q.i]; return it.answer; });
  let a = await answerOf();
  await p.click(`.choice[data-k="${a}"]`);
  ok((await text(p, '.feedback')).includes('+1'), 'right answer: +1 star');
  await p.waitForTimeout(900);
  ok((await text(p, '#star-count')) === '1', 'star counter updated');
  await shot(p, '06-quiz-right');
  await p.click('#next-btn');
  a = await answerOf();
  const wrong = [0, 1, 2, 3].filter(k => k !== a);
  await p.keyboard.press(String(wrong[0] + 1));
  ok((await text(p, '.feedback')).includes('Hint'), 'first wrong answer shows a hint');
  ok(await p.locator(`.choice[data-k="${wrong[0]}"]`).isDisabled(), 'wrong choice gets crossed out');
  await p.click(`.choice[data-k="${wrong[1]}"]`);
  ok((await text(p, '.feedback')).includes('The answer is'), 'second wrong answer reveals with an explanation');
  await p.click('#next-btn');
  for (let i = 2; i < 5; i++) { a = await answerOf(); await p.click(`.choice[data-k="${a}"]`); await p.click('#next-btn'); }
  await p.waitForSelector('.big-score');
  ok((await text(p, '.big-score')).replace(/\s/g, '') === '4/5', 'score 4/5: ' + await text(p, '.big-score'));
  ok(await p.locator('.missed li').count() === 1, 'one missed question listed');
  await shot(p, '07-results', true);
  const meta = await M(p, () => window.__ASH_TEST__.S.meta.profiles[0]);
  ok(meta.quizzes[0].score === 4 && meta.quizzes[0].total === 5 && meta.stars === 4, 'quiz result + stars saved: ' + JSON.stringify([meta.quizzes[0], meta.stars]));
  await p.click('[data-act="ask-missed"]');
  await p.waitForSelector('#msgs');
  await idle(p);
  call = await lastCall(p);
  ok(lastUserTurn(call).includes('missed these') && lastUserTurn(call).includes('the answer was'), '"Ask Bolt about these" sends the missed questions');
  ok(call.input[0].content.includes('Recent quizzes') && call.input[0].content.includes('4/5'), 'Bolt knows the quiz score');
  ok(p.errors.length === 0, 'no page errors: ' + p.errors.join(' | '));
  await ctx.close();
});

await test('spelling test with my own words + Bolt-picked words', async () => {
  const { ctx, p } = await open();
  await onboard(p, 'Leo', '2');
  ok(await M(p, () => document.documentElement.classList.contains('young')), 'young readers get bigger text');
  await p.click('[data-act="spell-setup"]');
  await p.click('[data-act="sf-mode"][data-m="mine"]');
  await p.fill('#sf-words', 'because\nfriend');
  await shot(p, '08-spell-setup');
  await p.click('#spell-setup-form button[type="submit"]');
  await p.waitForSelector('#spell-in');
  let call = await lastCall(p);
  ok(call.input.includes('Use exactly these 2 words, in this order: because, friend.'), 'my words go to Bolt in order');
  ok((await p.locator('.qcard').innerText()).includes('_____'), 'sentence hides the word');
  await p.click('[data-act="say-word"]');
  await p.waitForTimeout(120);
  ok((await M(p, () => window.__spoken)).join(' ').includes('because'), 'Bolt says the word');
  await p.fill('#spell-in', 'becuase');
  await p.press('#spell-in', 'Enter');
  ok((await text(p, '.feedback')).includes('Close'), 'first miss: a tip');
  await p.fill('#spell-in', 'becos');
  await p.press('#spell-in', 'Enter');
  ok((await text(p, '.feedback')).includes('b-e-c-a-u-s-e'), 'second miss: shows the letters');
  await shot(p, '09-spell-reveal');
  await p.fill('#spell-in', 'Because ');
  await p.press('#spell-in', 'Enter');
  ok((await text(p, '.feedback')).includes('Locked in'), 'copying it right locks it in');
  await p.click('#next-btn');
  await p.fill('#spell-in', 'friend');
  await p.press('#spell-in', 'Enter');
  ok((await text(p, '.feedback')).includes('Nailed'), 'right first try');
  await p.click('#next-btn');
  await p.waitForSelector('.big-score');
  ok((await text(p, '.big-score')).replace(/\s/g, '') === '1/2', 'spelling score 1/2');
  ok((await text(p, '.missed')).includes('because'), 'missed word listed');
  await p.click('[data-act="spell-setup"]');
  await p.click('[data-act="sf-mode"][data-m="bolt"]');
  await p.click('[data-act="sf-n"][data-n="10"]');
  await p.click('#spell-setup-form button[type="submit"]');
  await p.waitForSelector('#spell-in');
  call = await lastCall(p);
  ok(call.input.includes('Pick 10 good spelling words for a 2nd grade student'), 'Bolt picks 10 grade-2 words');
  ok((await M(p, () => window.__ASH_TEST__.S.quiz.items.length)) === 10, '10 words in the test');
  await p.fill('#spell-in', 'zzz');
  await p.press('#spell-in', 'Enter');
  await p.click('[data-act="quiz-quit"]');
  await p.waitForSelector('.modal');
  await p.click('[data-m="no"]');
  ok(await p.locator('#spell-in').count() === 1, 'quit → "keep going" stays in the test');
  await p.click('[data-act="quiz-quit"]');
  await p.click('[data-m="yes"]');
  await p.waitForSelector('#ask-form');
  ok(p.errors.length === 0, 'no page errors: ' + p.errors.join(' | '));
  await ctx.close();
});

await test('settings, auto read-aloud, careful brain, delete, learners', async () => {
  const { ctx, p } = await open();
  await onboard(p);
  await ask(p, 'hi bolt');
  await p.click('[data-act="settings"]');
  await p.waitForSelector('#set-auto');
  await shot(p, '10-settings', true);
  await p.check('#set-auto');
  await p.click('[data-act="set-rate"][data-v="0.8"]');
  await p.click('[data-act="set-brain"][data-v="careful"]');
  const st = await M(p, () => window.__ASH_TEST__.S.meta.profiles[0].settings);
  ok(st.autoRead === true && st.rate === 0.8 && st.brain === 'careful', 'settings saved: ' + JSON.stringify(st));
  await p.click('[data-act="home"] >> nth=0');
  await p.click('[data-act="open-chat"]');
  await M(p, () => { window.__spoken = []; });
  await say(p, 'tell me more');
  const call = await lastCall(p);
  ok(call.opts.modelTier === 'default', 'careful brain uses the default tier');
  await p.waitForTimeout(200);
  ok((await M(p, () => window.__spoken)).length > 0, 'auto read-aloud speaks the new answer');
  await p.click('[data-act="back"]');
  await p.click('[data-act="del-chat"]');
  await p.waitForSelector('.modal');
  await shot(p, '11-confirm');
  await p.click('[data-m="yes"]');
  await p.waitForTimeout(150);
  ok(await p.locator('.chatrow').count() === 0, 'chat removed from the list');
  const keys = await M(p, () => Object.keys(window.__mock.dump()));
  ok(!keys.some(k => k.includes('/chat-')), 'chat document deleted from the db: ' + keys.join(','));
  await p.click('[data-act="settings"]');
  await p.click('[data-act="switch-profile"]');
  await p.click('[data-act="new-profile"]');
  await onboard(p, 'Mia', '9');
  ok((await text(p, 'h1')).includes('Mia') && await p.locator('.chatrow').count() === 0, 'second learner starts fresh');
  ok((await p.locator('.topic').allInnerTexts()).some(t => t.includes('Quadratic')), '9th grade topics');
  await reload(p);
  await p.waitForSelector('#ask-form');
  ok((await text(p, 'h1')).includes('Mia'), 'reload goes back to the last learner');
  await p.click('[data-act="settings"]');
  await p.click('[data-act="edit-profile"]');
  await p.click('[data-act="pf-delete"]');
  await p.click('[data-m="yes"]');
  await p.waitForSelector('.pgrid');
  ok(await p.locator('.pcard:not(.add)').count() === 1, 'learner deleted, Sam is left');
  await p.click('.pcard:not(.add)');
  await p.waitForSelector('#ask-form');
  ok((await text(p, 'h1')).includes('Sam'), 'picked Sam');
  ok(p.errors.length === 0, 'no page errors: ' + p.errors.join(' | '));
  await ctx.close();
});

await test('outside claude.ai: offline math practice + my spelling list, local saving', async () => {
  const { ctx, p } = await open({ config: { host: false } });
  await onboard(p, 'Kai', '4');
  ok((await text(p, '.banner')).includes('offline'), 'offline banner');
  ok(await p.locator('[data-act="photo"]').count() === 0, 'no photo button offline');
  await p.fill('#ask-text', 'help');
  await p.click('#ask-form button[type="submit"]');
  ok(await p.locator('#ask-form').count() === 1, 'asking offline stays on home with a toast');
  await p.click('[data-act="quiz-setup"]');
  ok(await p.locator('[data-act="qf-subj"][data-s="reading"]').isDisabled(), 'only math offline');
  await p.click('#quiz-form button[type="submit"]');
  await p.waitForSelector('.qcard');
  ok((await text(p, '.qcard .label')).toLowerCase().includes('offline'), 'offline math quiz runs');
  await p.click('[data-act="quiz-quit"]');
  ok(await p.locator('.modal').count() === 0 && await p.locator('#ask-form').count() === 1, 'quitting with no progress skips the "are you sure?"');
  await p.click('[data-act="quiz-setup"]');
  await p.click('#quiz-form button[type="submit"]');
  await p.waitForSelector('.qcard');
  for (let i = 0; i < 5; i++) { const a = await M(p, () => window.__ASH_TEST__.S.quiz.items[window.__ASH_TEST__.S.quiz.i].answer); await p.click(`.choice[data-k="${a}"]`); await p.click('#next-btn'); }
  await p.waitForSelector('.big-score');
  ok((await text(p, '.big-score')).replace(/\s/g, '') === '5/5', 'perfect offline score');
  ok((await text(p, '#star-count')) === '7', 'stars: 5 + 2 perfect bonus = ' + await text(p, '#star-count'));
  await p.click('[data-act="home"] >> nth=-1');
  await p.click('[data-act="spell-setup"]');
  await p.fill('#sf-words', 'cat, dog');
  await p.click('#spell-setup-form button[type="submit"]');
  await p.waitForSelector('#spell-in');
  await p.fill('#spell-in', 'cat');
  await p.press('#spell-in', 'Enter');
  ok((await text(p, '.feedback')).includes('Nailed'), 'offline spelling works');
  const ls = await M(p, () => Object.keys(localStorage).filter(k => k.startsWith('ash1:')));
  ok(ls.includes('ash1:meta'), 'saved in localStorage: ' + ls.join(','));
  ok(p.errors.length === 0, 'no page errors: ' + p.errors.join(' | '));
  await ctx.close();
});

await test('no read-aloud in this browser, no photo support', async () => {
  const { ctx, p } = await open({ speech: false, config: { images: false } });
  await onboard(p);
  ok(await p.locator('[data-act="photo"]').count() === 0, 'photo button hidden without image support');
  await ask(p, 'hi');
  ok(await p.locator('[data-act="speak"]').count() === 0, 'no read-aloud buttons without speech');
  await p.click('[data-act="settings"]');
  ok((await text(p, '.page')).includes('doesn\'t work in this browser'), 'settings explain read-aloud is missing');
  ok(p.errors.length === 0, 'no page errors: ' + p.errors.join(' | '));
  await ctx.close();
});

await test('db trouble falls back to this device', async () => {
  const { ctx, p } = await open();
  await onboard(p);
  await M(p, () => { window.__mock.dbFail = { code: 'invalid_argument', message: 'view-only' }; });
  await p.click('[data-act="settings"]');
  await p.click('[data-act="set-brain"][data-v="careful"]');
  await p.waitForTimeout(300);
  ok((await M(p, () => window.__ASH_TEST__.S.mode)) === 'local', 'switched to local saving');
  ok((await M(p, () => localStorage.getItem('ash1:meta') || '')).includes('careful'), 'latest settings landed in localStorage');
  ok((await p.locator('.toast').allInnerTexts()).some(t => t.includes('saving on this device')), 'toast explains it');
  ok(p.errors.length === 0, 'no page errors: ' + p.errors.join(' | '));
  await ctx.close();
});

await test('bad wifi: a chat list that fails to load is never overwritten', async () => {
  const { ctx, p } = await open();
  await onboard(p);
  await ask(p, 'first question');
  await p.click('[data-act="back"]');
  await ask(p, 'second question');
  await p.click('[data-act="back"]');
  // Reload with reads of the chat list failing 4 times (boot tries twice, so it gives up, then repair tries again).
  await ctx.addInitScript(() => { window.__mockConfig = Object.assign(window.__mockConfig || {}, { getFail: { match: '/idx-', times: 4 } }); });
  await reload(p);
  await p.waitForSelector('#ask-form');
  ok(await p.locator('.chatrow').count() === 0, 'chat list unreadable at first');
  ok((await p.locator('.toast').allInnerTexts()).some(t => t.includes('Couldn\'t load your old chats')), 'kid is told the old chats are safe');
  await ask(p, 'third question');
  await p.click('[data-act="back"]');
  await p.waitForFunction(() => document.querySelectorAll('.chatrow').length === 3, null, { timeout: 15000 }).catch(() => {});
  ok(await p.locator('.chatrow').count() === 3, 'after the list comes back, all 3 chats are there: ' + await p.locator('.chatrow').count());
  const saved = await M(p, () => { const d = window.__mock.dump(); return Object.entries(d).find(([k]) => k.includes('/idx-'))[1].chats.length; });
  ok(saved === 3, 'saved chat list has all 3 chats: ' + saved);
  await M(p, () => { window.__mock.getFail = { match: '/chat-', times: 1 }; window.__ASH_TEST__.S.chatCache.clear(); });
  await p.click('[data-act="open-chat"] >> nth=1');
  await p.waitForTimeout(200);
  ok(await p.locator('#ask-form').count() === 1 && await p.locator('.chatrow').count() === 3, 'a chat that fails to open stays in the list');
  await p.click('[data-act="open-chat"] >> nth=1');
  await p.waitForSelector('#msgs');
  ok(await p.locator('.msg').count() === 2, 'and opens fine on the next tap');
  ok(p.errors.length === 0, 'no page errors: ' + p.errors.join(' | '));
  await ctx.close();
});

await test('quiz guards: avatar mid-quiz asks first; offline spelling uses my list', async () => {
  const { ctx, p } = await open();
  await onboard(p);
  await p.click('[data-act="quiz-setup"]');
  await p.click('#quiz-form button[type="submit"]');
  await p.waitForSelector('.qcard');
  const a = await M(p, () => window.__ASH_TEST__.S.quiz.items[0].answer);
  await p.click(`.choice[data-k="${a}"]`);
  await p.click('.who');
  await p.waitForSelector('.modal');
  await p.click('[data-m="no"]');
  ok(await p.locator('.qcard').count() === 1, 'tapping the avatar mid-quiz asks before leaving');
  await p.click('.who');
  await p.click('[data-m="yes"]');
  await p.waitForSelector('#set-auto');
  ok(true, 'went to settings after confirming');
  await p.click('[data-act="home"] >> nth=0');
  await p.click('[data-act="spell-setup"]');
  await M(p, () => { const S = window.__ASH_TEST__.S; S.ai.ok = false; S.ai.why = 'blocked'; });
  await p.click('[data-act="sf-mode"][data-m="mine"]');
  await M(p, () => { window.__ASH_TEST__.S.sform.mode = 'bolt'; });
  await p.fill('#sf-words', 'sun, moon');
  await p.click('#spell-setup-form button[type="submit"]');
  await p.waitForSelector('#spell-in');
  ok((await M(p, () => window.__ASH_TEST__.S.quiz.items.map(i => i.word).join())) === 'sun,moon', 'offline spelling uses the typed list even if the old mode was "Bolt picks"');
  ok(p.errors.length === 0, 'no page errors: ' + p.errors.join(' | '));
  await ctx.close();
});

await test('safety: html in messages is shown, never run', async () => {
  const { ctx, p } = await open();
  await onboard(p, '<b>x</b>"\'><img src=x onerror=window.__xss=1>');
  await M(p, () => { window.__mock.replies.push('<img src=x onerror="window.__xss=2"> **ok** <script>window.__xss=3</script>'); });
  await ask(p, '<img src=x onerror="window.__xss=4">');
  await p.waitForTimeout(200);
  ok(!(await M(p, () => window.__xss)), 'no injected script ran');
  ok((await p.locator('.msg.me').innerText()).includes('<img'), 'kid\'s text shows literally');
  ok(await p.locator('#msgs img:not(.thumb)').count() === 0, 'no injected <img> elements');
  ok(p.errors.length === 0, 'no page errors: ' + p.errors.join(' | '));
  await ctx.close();
});

await test('phone width + dark mode look', async () => {
  const { ctx, p } = await open({ viewport: { width: 375, height: 760 }, colorScheme: 'dark' });
  await onboard(p, 'Zoe', 'K');
  await noOverflow(p, 'home (phone)');
  await shot(p, '12-phone-home-dark', true);
  await M(p, () => { window.__mock.replies.push('Beep boop! Let\'s count together! 🍎🍎🍎\n\n1. Point to each apple\n2. Say a number for each one\n\nHow many apples? [[STAR]]'); });
  await ask(p, 'help me count');
  await noOverflow(p, 'chat (phone)');
  await shot(p, '13-phone-chat-dark');
  await p.click('[data-act="back"]');
  await p.click('[data-act="quiz-setup"]');
  await p.click('#quiz-form button[type="submit"]');
  await p.waitForSelector('.qcard');
  await noOverflow(p, 'quiz (phone)');
  await shot(p, '14-phone-quiz-dark');
  const bg = await M(p, () => getComputedStyle(document.body).backgroundColor);
  ok(bg === 'rgb(17, 24, 39)', 'dark paper background: ' + bg);
  ok(p.errors.length === 0, 'no page errors: ' + p.errors.join(' | '));
  await ctx.close();
});

await test('long chats stay under the db size cap', async () => {
  const { ctx, p } = await open();
  await onboard(p);
  const r = await M(p, () => {
    const T = window.__ASH_TEST__;
    const img = 'data:image/jpeg;base64,' + 'A'.repeat(20000);
    const c = { id: 'x', pid: 'p', subj: null, title: 't', createdAt: 1, updatedAt: 1, sumN: 50, summary: '', msgs: [] };
    for (let i = 0; i < 160; i++) c.msgs.push({ r: i % 2 ? 'a' : 'u', t: '🤖'.repeat(700) + i, at: i, ...(i % 2 ? {} : { img }) });
    T.fitChat(c);
    const turns = T.buildTurns(c, T.normalizeProfile({ id: 'p', name: 'Sam', grade: '3' }));
    return { bytes: new Blob([JSON.stringify(c)]).size, first: c.msgs[0].t.endsWith('0'), n: c.msgs.length, turns: turns.length, hidden: turns[0].content.includes('older messages are hidden'), endsUser: turns[turns.length - 1].role === 'user' };
  });
  ok(r.bytes <= 200 * 1024 && r.first, 'trimmed under 200 KiB and kept the first message: ' + JSON.stringify(r));
  ok(r.turns <= 41 && r.hidden && r.endsUser, 'prompt keeps the last 40 turns, mentions hidden ones, ends on the student: ' + JSON.stringify(r));
  await ctx.close();
});

await browser.close();
console.log(`\n${passes} checks passed, ${failures} failed`);
if (failures) { console.log(problems.map(x => ' - ' + x).join('\n')); process.exit(1); }
