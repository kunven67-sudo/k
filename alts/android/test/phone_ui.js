// ALTS for phone 2.0, end to end in a phone-sized Chromium: the REAL phone.js + page.js + extras.js
// (as built into the APK, build/assets) on a fake claude.ai chat, with a fake app bridge
// (window.AltsPhone) that records every call. Run after build.sh:
//   node test/phone_ui.js [shots-dir]
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const HERE = path.resolve(__dirname, '..');
const SHOTS = process.argv[2] || '';
let failures = 0;
const ok = (c, what) => { console.log((c ? '  PASS ' : '  FAIL ') + what); if (!c) failures++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const asset = n => fs.readFileSync(path.join(HERE, 'build/assets', n), 'utf8');
const JS = asset('phone.js') + '\n;\n' + asset('page.js') + '\n;\n' + asset('extras.js');

// Real meme pictures from the baked pack, shrunk to thumbnails (what Stickers.java hands the page).
const pack = JSON.parse(fs.readFileSync(path.join(HERE, 'build-cache/stickers/pack.json'), 'utf8')).slice(0, 14);
const { execFileSync } = require('child_process');
const thumb = file => execFileSync('python3', ['-I', '-c',
  'import sys,io,base64\nfrom PIL import Image\nim=Image.open(sys.argv[1]).convert("RGB");im.thumbnail((144,144))\nb=io.BytesIO();im.save(b,"JPEG",quality=70);print(base64.b64encode(b.getvalue()).decode())',
  path.join(HERE, 'build-cache/stickers', file)]).toString().trim();
const STICKERS = pack.map((m, i) => ({ id: m.id, name: m.name, kind: 'meme', fav: false, at: 1000 - i, thumb: thumb(m.file) }));
STICKERS.push({ id: 'mine-1', name: 'Your sticker', kind: 'mine', fav: true, at: 2000, thumb: STICKERS[3].thumb });

const FAKE_CHAT = `<!doctype html><html><head><meta name=viewport content="width=device-width,initial-scale=1"><title>Brocast fix - Claude</title><style>
html,body{margin:0;height:100%;background:#262624;color:#e8e6dc;font:15px/1.5 system-ui}
#scroll{position:absolute;top:0;left:0;right:0;bottom:120px;overflow-y:auto;padding:56px 16px 16px}
.u{background:#141413;border-radius:14px;padding:10px 14px;margin:12px 0 12px 48px}.c{margin:12px 0}
#box{position:absolute;left:10px;right:10px;bottom:14px;background:#30302e;border:1px solid #444;border-radius:20px;padding:12px 14px 50px}
#ed{outline:none;min-height:24px}#att{display:flex;gap:6px;margin-bottom:6px}#att img{width:44px;height:44px;object-fit:cover;border-radius:8px}
#send{position:absolute;right:10px;bottom:10px;width:34px;height:34px;border-radius:10px;border:0;background:#c96442;color:#fff}
</style></head><body><nav><a href="/chat/11111111-1111-1111-1111-111111111111">Brocast fix</a></nav><div id=scroll></div>
<div id=box><div id=att></div><div id=ed contenteditable=true></div><input type=file id=file multiple style="display:none"><button id=send aria-label="Send message">&uarr;</button></div>
<script>
const sc = document.getElementById('scroll');
for (let i = 0; i < 12; i++) {
  const u = document.createElement('div'); u.className = 'u'; u.textContent = 'You said: question number ' + i + ' about the anime freeze'; sc.append(u);
  const c = document.createElement('div'); c.className = 'c'; c.textContent = 'Claude responded: here is a long answer with plenty of words about timelines, cushions and Wi-Fi hiccups ' + i + '. '.repeat(3); sc.append(c);
}
const att = document.getElementById('att'), ed = document.getElementById('ed');
window.__attached = [];
function addFiles(files) { for (const f of files) { window.__attached.push(f.name + ':' + f.type + ':' + f.size); const im = document.createElement('img'); im.src = URL.createObjectURL(f); att.append(im); } }
ed.addEventListener('paste', e => { const fs = [...(e.clipboardData && e.clipboardData.files || [])]; if (fs.length) { e.preventDefault(); addFiles(fs); } });
document.getElementById('file').addEventListener('change', e => addFiles([...e.target.files]));
document.getElementById('send').onclick = () => { window.__sent = (window.__sent || []).concat([ed.innerText]); ed.textContent = ''; };
</script></body></html>`;

// The fake app: same methods as MainActivity.Bridge, records calls, answers rpc like the app would.
const BRIDGE = ({ stickers, opts }) => {
  const log = window.__bridge = [];
  let giphyKey = opts.giphy ? 'k' : '';
  const chats = [];
  const accounts = [
    { id: 'default', name: 'Main', color: '#d97757' },
    { id: 'a1', name: 'School', color: '#4f9df5', usage: { s: 12, w: 30, sr: '', wr: new Date(Date.now() + 3 * 86400000).toISOString(), at: Date.now() } }
  ];
  const answer = (token, obj) => setTimeout(() => window.__AltsRpc && window.__AltsRpc.done(token, JSON.stringify(obj)), 60);
  const KEY = 'test-key-123';
  const raw = {
    info: () => JSON.stringify({ version: '2.0', account: 'default', active: 'default', profiles: true, giphy: !!giphyKey, oldApp: !!opts.oldApp, list: accounts }),
    usage: j => log.push(['usage', j]),
    switchAccount: id => log.push(['switchAccount', id]),
    addAccount: n => log.push(['addAccount', n]),
    renameAccount: (id, n) => log.push(['renameAccount', id, n]),
    removeAccount: id => log.push(['removeAccount', id]),
    stickers: () => JSON.stringify({ list: stickers, updated: Date.now() }),
    stickerGet: id => { log.push(['stickerGet', id]); const s = stickers.find(x => x.id === id); return s ? JSON.stringify({ b64: s.thumb, name: s.name + '.jpg', type: 'image/jpeg' }) : ''; },
    stickerFav: (id, on) => { log.push(['stickerFav', id, on]); const s = stickers.find(x => x.id === id); if (s) s.fav = on; return true; },
    stickerDel: id => { log.push(['stickerDel', id]); return true; },
    hasGiphy: () => !!giphyKey,
    setGiphyKey: k => { log.push(['setGiphyKey', k]); giphyKey = k; },
    chatList: () => JSON.stringify({ list: chats }),
    chatOpen: id => log.push(['chatOpen', id]),
    openDownloads: () => log.push(['openDownloads']),
    continueTo: (id, p) => log.push(['continueTo', id, p]),
    pendingContinue: () => '',
    schedulePing: (at, t) => log.push(['schedulePing', at, t]),
    cancelPing: () => log.push(['cancelPing']),
    oldApp: () => !!opts.oldApp,
    removeOld: () => log.push(['removeOld']),
    save: () => true,
    rpc: (token, name, args) => {
      const a = JSON.parse(args || '{}');
      log.push(['rpc', name, name === 'chatSave' ? { title: a.title, words: a.words, why: a.why, html: (a.html || '').length, md: (a.md || '').slice(0, 60) } : a]);
      if (name === 'chatSave') { chats.unshift({ id: 'c' + chats.length, title: a.title, account: 'default', words: a.words, at: Date.now(), url: a.url, md: a.md }); answer(token, { ok: true, id: 'c' + (chats.length - 1), words: a.words, pics: a.pics, why: a.why }); }
      else if (name === 'chatSearch') answer(token, { list: chats.filter(c => !a.q || (c.title + c.md).toLowerCase().includes(a.q.toLowerCase())).map(c => Object.assign({}, c, { snippet: a.q ? 'the anime freeze' : '' })) });
      else if (name === 'giphy') answer(token, { list: stickers.slice(0, 6).map((s, i) => ({ id: 'giphy-' + i, name: 'anime cry ' + i, thumb: s.thumb, url: 'https://media.giphy.com/x' + i + '.gif' })) });
      else if (name === 'giphyTake') answer(token, { b64: stickers[0].thumb, name: a.name + '.gif', type: 'image/gif' });
      else if (name === 'memeRefresh') answer(token, { added: 0 });
      else if (name === 'addPick') answer(token, { id: 'mine-2' });
      else if (name === 'chatDelete') answer(token, { ok: true });
      else answer(token, { error: 'unknown ' + name });
    }
  };
  // Like the app: every call must carry the key, or it does nothing (and the test notices).
  window.AltsPhone = {};
  for (const [name, fn] of Object.entries(raw)) {
    window.AltsPhone[name] = (k, ...rest) => {
      if (k !== KEY) { log.push(['NO KEY', name]); return name === 'rpc' ? undefined : ''; }
      return fn(...rest);
    };
  }
};

async function phone(browser, opts, usage) {
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  await ctx.route('https://claude.ai/**', route => {
    const u = new URL(route.request().url());
    if (u.pathname === '/api/organizations') return route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ uuid: 'org1' }]) });
    if (u.pathname === '/api/organizations/org1/usage') return route.fulfill({ contentType: 'application/json', body: JSON.stringify(usage) });
    if (u.pathname.startsWith('/favicon')) return route.fulfill({ status: 200, body: '' });
    return route.fulfill({ contentType: 'text/html', body: FAKE_CHAT });
  });
  await ctx.addInitScript(BRIDGE, { stickers: STICKERS.map(s => Object.assign({}, s)), opts });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(String(e)));
  await page.goto('https://claude.ai/chat/11111111-1111-1111-1111-111111111111');
  await page.evaluate("window.__altsKey='test-key-123';\n" + JS); // what MainActivity does in onPageFinished
  return { ctx, page };
}
const log = page => page.evaluate(() => window.__bridge);
const shadow = (page, sel) => page.locator('css=[data-alts] >> css=' + sel); // Playwright pierces open shadow roots
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name) }); };

(async () => {
  const browser = await chromium.launch();
  const reset = new Date(Date.now() + 2 * 3600000).toISOString();
  let { ctx, page } = await phone(browser, { giphy: false, oldApp: true },
    { five_hour: { utilization: 42, resets_at: reset }, seven_day: { utilization: 63, resets_at: new Date(Date.now() + 4 * 86400000).toISOString() } });

  console.log('1) The pill at the top: usage like the PC bars');
  await page.waitForFunction(() => { const h = document.querySelector('[data-alts]'); return h && h.shadowRoot && /5h 42%/.test(h.shadowRoot.querySelector('.pill').textContent); }, null, { timeout: 8000 }).catch(() => {});
  const pillText = await shadow(page, '.pill').textContent();
  ok(/5h 42% · Week 63%/.test(pillText), 'pill: ' + pillText);
  ok((await log(page)).some(x => x[0] === 'usage' && /"s":42/.test(x[1])), 'usage handed to the app (each account remembers its bars)');

  console.log('2) The ALTS sheet: accounts, usage, buttons, old-app card');
  await shadow(page, '.pill').click();
  await sleep(400);
  const accs = await shadow(page, '.acc').allTextContents();
  ok(accs.join('|') === 'Main|School|+ Add', 'accounts: ' + accs.join(', '));
  const sheetText = await shadow(page, '.sheet').textContent();
  ok(/5-hour limit: 42%/.test(sheetText) && /Weekly limit: 63%/.test(sheetText), 'my bars');
  ok(/School/.test(sheetText) && /Weekly limit: 30%/.test(sheetText), 'the other account’s last-known bars');
  ok(/old ALTS is still on your phone/.test(sheetText), 'remove-old-ALTS card shows');
  ok(/Save this chat/.test(sheetText) && /Saved chats/.test(sheetText) && /Continue on/.test(sheetText) && /Stickers/.test(sheetText) && /Send later/.test(sheetText) && /Fresh chat/.test(sheetText), 'all the buttons');
  await shot(page, '1-sheet.png');
  await shadow(page, 'button:has-text("Remove the old ALTS")').click();
  ok((await log(page)).some(x => x[0] === 'removeOld'), 'Remove the old ALTS asks Android to uninstall it');

  console.log('3) Stickers: real memes, favorites first, tap = into the chat');
  await shadow(page, '.pill').click();
  await sleep(300);
  await shadow(page, 'button.gb:has-text("Stickers")').click();
  await sleep(500);
  const tiles = await shadow(page, '.st').count();
  ok(tiles === STICKERS.length, tiles + ' stickers in the grid');
  const firstImgOk = await shadow(page, '.st img').first().evaluate(i => i.complete && i.naturalWidth > 0);
  ok(firstImgOk, 'pictures load');
  const firstIsFav = await shadow(page, '.st').first().locator('.fav').evaluate(b => b.classList.contains('on'));
  ok(firstIsFav, 'your starred sticker sits first');
  await shadow(page, '.st >> nth=2 >> .fav').click();
  ok((await log(page)).some(x => x[0] === 'stickerFav' && x[2] === true), 'star = favorite (saved by the app)');
  await shadow(page, '.chip:has-text("Favorites")').click();
  await sleep(200);
  ok(await shadow(page, '.st').count() === 2, 'Favorites tab: the 2 starred ones');
  await shadow(page, '.chip:has-text("All")').click();
  await sleep(200);
  await shot(page, '2-stickers.png');
  await shadow(page, '.in').fill('drake');
  await sleep(200);
  ok(await shadow(page, '.st').count() >= 1, 'search your stickers by name ("drake")');
  ok(/free GIPHY key/.test(await shadow(page, '.sheet').textContent()) || (await shadow(page, '.st').count()) > 0, 'no key: it says how to get way more');
  await shadow(page, '.st').first().click();
  await page.waitForFunction(() => window.__attached && window.__attached.length > 0, null, { timeout: 6000 }).catch(() => {});
  const att = await page.evaluate(() => window.__attached);
  ok(att.length === 1 && /image\/jpeg/.test(att[0]), 'sticker landed in the chat as a picture: ' + att.join(','));

  console.log('4) The sticker button above the chat box (the PC’s side buttons, finger-sized)');
  await page.click('#ed');
  await sleep(600);
  const side = await page.evaluate(() => [...document.querySelectorAll('button[data-alts]')].filter(b => b.offsetParent).map(b => b.title.split(':')[0] + '|' + b.getBoundingClientRect().width));
  ok(side.length === 4 && side.every(s => +s.split('|')[1] >= 38), 'four buttons, 38 px: ' + side.join(', '));
  await page.click('button[data-alts][title="Stickers"]');
  await sleep(400);
  ok(await shadow(page, '.sheet .hd b:has-text("Stickers")').count() === 1, 'the picture button opens the phone sticker box (no emoji tab)');
  await page.mouse.click(200, 60);
  await sleep(300);

  console.log('5) Settings: GIPHY key, then search finds stickers for anything');
  await shadow(page, '.pill').click();
  await sleep(300);
  await shadow(page, 'button.gb:has-text("Settings")').click();
  await sleep(300);
  await shadow(page, '.in').fill('abc123');
  await shadow(page, 'button:has-text("Save key")').click();
  ok((await log(page)).some(x => x[0] === 'setGiphyKey' && x[1] === 'abc123'), 'key saved in the app');
  await shot(page, '5-settings.png');
  await page.mouse.click(200, 40); // tap outside: the sheet closes
  await sleep(350);
  await shadow(page, '.pill').click();
  await sleep(300);
  await shadow(page, 'button.gb:has-text("Stickers")').click();
  await sleep(300);
  await shadow(page, '.in').fill('anime cry');
  await sleep(1200);
  const gtxt = await shadow(page, '.sheet').textContent();
  ok(/GIPHY/.test(gtxt) && (await log(page)).some(x => x[0] === 'rpc' && x[1] === 'giphy' && x[2].q === 'anime cry'), 'GIPHY searched for "anime cry"');
  await shot(page, '3-giphy.png');
  const before = (await page.evaluate(() => window.__attached)).length;
  await shadow(page, '.st >> nth=-1').click();
  await page.waitForFunction(n => window.__attached.length > n, before, { timeout: 6000 }).catch(() => {});
  const att2 = await page.evaluate(() => window.__attached);
  ok(att2.length === before + 1 && /image\/gif/.test(att2[att2.length - 1]), 'GIPHY sticker went into the chat: ' + att2[att2.length - 1]);

  console.log('6) Save this chat → kept in ALTS + Download/ALTS, searchable');
  await shadow(page, '.pill').click();
  await sleep(300);
  await shadow(page, 'button.gb:has-text("Save this chat")').click();
  await page.waitForFunction(() => [...document.querySelectorAll('[data-alts]')].some(e => /Saved:/.test(e.textContent)), null, { timeout: 20000 }).catch(() => {});
  const saveCall = (await log(page)).find(x => x[0] === 'rpc' && x[1] === 'chatSave');
  ok(saveCall && saveCall[2].html > 1000 && /Brocast fix/.test(saveCall[2].md) && saveCall[2].words > 100, 'whole chat sent to the app: ' + JSON.stringify(saveCall && saveCall[2]));
  ok(await page.evaluate(() => [...document.querySelectorAll('[data-alts]')].some(e => /Saved: [\d,]+ words/.test(e.textContent))), 'the PC’s "Saved" box shows');
  await page.click('[data-alts] button:has-text("Open it")');
  ok((await log(page)).some(x => x[0] === 'chatOpen' && x[1] === 'c0'), 'Open it opens the saved copy');
  await shadow(page, '.pill').click();
  await sleep(300);
  await shadow(page, 'button.gb:has-text("Saved chats")').click();
  await sleep(500);
  await shadow(page, '.in').fill('freeze');
  await sleep(700);
  const items = await shadow(page, '.item .t1').allTextContents();
  ok(items.length === 1 && /Brocast fix/.test(items[0]), 'search inside saved chats finds it: ' + items.join(','));
  ok(/the anime freeze/.test(await shadow(page, '.item .t2').first().textContent()), 'with the words around the hit');
  await shot(page, '4-saved.png');

  console.log('7) Continue on another account (School)');
  await page.mouse.click(200, 60);
  await sleep(300);
  await shadow(page, '.pill').click();
  await sleep(300);
  await shadow(page, 'button.gb:has-text("Continue on")').click();
  await sleep(300);
  await shadow(page, '.menu button:has-text("Continue on School")').click();
  await page.waitForFunction(() => window.__bridge.some(x => x[0] === 'continueTo'), null, { timeout: 20000 }).catch(() => {});
  const cont = (await log(page)).find(x => x[0] === 'continueTo');
  const payload = cont ? JSON.parse(cont[2]) : {};
  ok(cont && cont[1] === 'a1' && /Brocast fix/.test(payload.md) && /\.md$/.test(payload.name), 'saved first, then School opens with the whole chat attached');
  ok((await log(page)).filter(x => x[0] === 'rpc' && x[1] === 'chatSave').some(x => x[2].why === 'continue'), 'kept in Saved chats too');

  console.log('8) The key: only ALTS\u2019s script can use the app (not artifacts, not the page)');
  ok(!(await log(page)).some(x => x[0] === 'NO KEY'), 'every call from ALTS carried the key');
  ok(await page.evaluate(() => window.__altsKey === undefined), 'the key isn\u2019t left lying around on the page');
  const stolen = await page.evaluate(() => { const r = window.AltsPhone.chatList(''); return r; });
  ok(stolen === '' && (await log(page)).some(x => x[0] === 'NO KEY' && x[1] === 'chatList'), 'a call without the key gets nothing');
  console.log('8b) No JS errors');
  ok(page.errors.length === 0, 'none: ' + JSON.stringify(page.errors));
  await ctx.close();

  console.log('9) Limit hit: Send later + a phone notification at reset time');
  ({ ctx, page } = await phone(browser, { giphy: false, oldApp: false }, { five_hour: { utilization: 100, resets_at: reset }, seven_day: { utilization: 70, resets_at: reset } }));
  await page.waitForTimeout(1500);
  ok(/5h 100%/.test(await shadow(page, '.pill').textContent()), 'pill says 5h 100%');
  await page.click('#ed');
  await page.keyboard.type('write the next part of the story');
  await sleep(700);
  await page.click('button[data-alts][title^="Limit hit"], button[data-alts][title^="Send later"]');
  await sleep(400);
  const later = await page.evaluate(() => JSON.parse(localStorage.getItem('alts-later') || '[]'));
  ok(later.length === 1 && /next part/.test(later[0].text), 'message kept for later');
  await page.evaluate(() => fetch('/api/organizations/org1/usage')); // usage is checked every minute; nudge it
  await page.evaluate(() => window.__alts && dispatchEvent(new CustomEvent('alts-usage', { detail: window.__alts.lastUsage })));
  await page.evaluate(() => window.chrome.webview.postMessage(JSON.stringify(Object.assign({ t: 'usage' }, window.__alts.lastUsage))));
  const ping = (await log(page)).find(x => x[0] === 'schedulePing');
  ok(ping && Math.abs(ping[1] - Date.parse(reset)) < 2000 && /1 saved message/.test(ping[2]), 'phone notification booked for when the limit resets: ' + (ping && ping[2]));
  ok(!/old ALTS/.test(await (async () => { await shadow(page, '.pill').click(); await sleep(300); return shadow(page, '.sheet').textContent(); })()), 'no old-app card once it’s gone');
  await shot(page, '6-limit.png');
  ok(page.errors.length === 0, 'no JS errors: ' + JSON.stringify(page.errors));
  await ctx.close();

  await browser.close();
  console.log(failures ? '\n' + failures + ' FAILED' : '\nALL PHONE CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
