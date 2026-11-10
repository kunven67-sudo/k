// ALTS 1.7.0 stickers, in Chromium: the chat-box picker (ui/page.js + ui/extras.js on a fake claude.ai,
// with a fake ALTS answering like page_windows.go) and the Win+V page (ui/clip.html with a fake ALTS Clipboard).
//   node test/stickers_ui.js [shots-dir]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const UI = path.resolve(__dirname, '../ui');
const SHOTS = process.argv[2] || '';
let failures = 0;
const ok = (c, what) => { console.log((c ? '  PASS ' : '  FAIL ') + what); if (!c) failures++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// little solid-color PNGs as sticker pictures (no files needed)
const { execFileSync } = require('child_process');
const png = rgb => 'data:image/png;base64,' + execFileSync('python3', ['-I', '-c',
  'import sys,io,base64\nfrom PIL import Image\nb=io.BytesIO();Image.new("RGB",(96,96),tuple(int(x) for x in sys.argv[1].split(","))).save(b,"PNG");print(base64.b64encode(b.getvalue()).decode())', rgb]).toString().trim();
const RED = png('220,60,60'), BLUE = png('60,100,220'), GREEN = png('60,180,90'), GOLD = png('230,180,40');

const CHAT = `<!doctype html><html><head><title>Test - Claude</title><style>
body{margin:0;background:#262624;color:#e8e6dc;font:15px system-ui}#box{position:fixed;left:300px;right:300px;bottom:30px;background:#30302e;border-radius:20px;padding:14px 14px 50px}
#ed{outline:none;min-height:24px}#att img{width:40px;height:40px}#send{position:absolute;right:10px;bottom:10px}</style></head><body>
<div style="padding:40px">You said: hi<br>Claude responded: hello there</div>
<div id=box><div id=att></div><div id=ed contenteditable=true></div><button id=send aria-label="Send message">^</button></div>
<script>window.__attached=[];document.getElementById('ed').addEventListener('paste',e=>{const f=[...(e.clipboardData&&e.clipboardData.files||[])];
if(f.length){e.preventDefault();for(const x of f){window.__attached.push(x.name+':'+x.type);const i=document.createElement('img');i.src=URL.createObjectURL(x);document.getElementById('att').append(i);}}});</script></body></html>`;

(async () => {
  const browser = await chromium.launch();
  console.log('1) The chat-box picker (ALTS.exe)');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.route('https://claude.ai/**', r => {
    const u = new URL(r.request().url());
    if (u.pathname.startsWith('/api/')) return r.fulfill({ contentType: 'application/json', body: '[]' });
    return r.fulfill({ contentType: 'text/html', body: CHAT });
  });
  await ctx.addInitScript(({ RED, BLUE, GREEN, GOLD }) => {
    const sent = window.__sent = [];
    const stickers = [
      { file: 's1p.png', name: 'mine', thumb: GREEN, kind: 'mine', fav: false },
      { file: 'abc.gif', name: 'anime cry', thumb: GOLD, kind: 'giphy', fav: false },
      { file: '30b1gx.jpg', name: 'drake hotline bling', thumb: RED, kind: 'meme', fav: true },
      { file: '1g8my4.jpg', name: 'two buttons', thumb: BLUE, kind: 'meme', fav: false },
    ];
    const answer = (fn, v) => setTimeout(() => window.__alts && window.__alts[fn](v), 30);
    window.chrome = { webview: { postMessage: s => {
      const m = JSON.parse(s);
      sent.push(m);
      if (m.t === 'emoji-data') answer('emojiData', { emoji: '\u{1F600}\tgrinning\tSmileys', stickers, giphyKey: true });
      if (m.t === 'sticker-fav') { stickers.forEach(x => { if (x.kind === m.kind && x.file === m.file) x.fav = m.on; }); answer('emojiData', { emoji: '\u{1F600}\tgrinning\tSmileys', stickers, giphyKey: true }); }
      if (m.t === 'giphy-search') answer('giphyResults', { q: m.text, list: [{ id: 'giphy-1', name: 'cat wave', thumb: GOLD, url: 'https://media.giphy.com/1.gif' }, { id: 'giphy-2', name: 'cat spin', thumb: BLUE, url: 'https://media.giphy.com/2.gif' }] });
      if (m.t === 'giphy-take' && !m.mine) answer('stickerFile', { name: 'sticker.gif', type: 'image/gif', b64: GOLD.split(',')[1] });
      if (m.t === 'sticker-get') answer('stickerFile', { name: 'meme.jpg', type: 'image/jpeg', b64: RED.split(',')[1] });
    } } };
  }, { RED, BLUE, GREEN, GOLD });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(String(e)));
  await page.goto('https://claude.ai/new');
  await page.evaluate(fs.readFileSync(path.join(UI, 'page.js'), 'utf8') + '\n;\n' + fs.readFileSync(path.join(UI, 'extras.js'), 'utf8'));
  await sleep(900);
  await page.click('button[data-alts][title="Emoji + stickers"]');
  await sleep(300);
  await page.click('[data-alts] button:has-text("Stickers")');
  await sleep(300);
  const heads = await page.evaluate(() => [...document.querySelectorAll('[data-alts] div')].filter(d => d.children.length === 0 && /^(⭐ Favorites|My stickers|Kept from GIPHY|Memes)$/.test(d.textContent)).map(d => d.textContent));
  ok(heads.join('|') === '⭐ Favorites|My stickers|Kept from GIPHY|Memes', 'sections, favorites first: ' + heads.join(', '));
  ok(await page.locator('[data-alts] button:has-text("+ Your pics")').count() === 1 && await page.locator('[data-alts] button:has-text("GIPHY key")').count() === 1, '+ Your pics and the GIPHY key button');
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'pc-picker.png'), clip: { x: 250, y: 330, width: 420, height: 440 } });
  // star the green one (mine)
  const tileGreen = page.locator('[data-alts] img[src="' + GREEN + '"]').first().locator('xpath=..');
  await tileGreen.hover();
  await tileGreen.locator('button').first().click();
  await sleep(200);
  ok((await page.evaluate(() => window.__sent)).some(m => m.t === 'sticker-fav' && m.kind === 'mine' && m.file === 's1p.png' && m.on === true), 'star = favorite sent to ALTS');
  const favCount = await page.evaluate(() => { const h = [...document.querySelectorAll('[data-alts] div')].find(d => d.textContent === '⭐ Favorites' && !d.children.length); return h ? h.nextElementSibling.children.length : 0; });
  ok(favCount === 2, 'favorites row now has 2');
  await page.click('[data-alts] input');
  await page.keyboard.type('cat');
  await sleep(1000);
  ok((await page.evaluate(() => window.__sent)).some(m => m.t === 'giphy-search' && m.text === 'cat'), 'typing searches GIPHY ("cat")');
  ok(await page.locator('[data-alts] img[title="cat wave (sends it)"], [data-alts] div[title="cat wave (sends it)"]').count() === 1, 'GIPHY results show');
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'pc-giphy.png'), clip: { x: 250, y: 330, width: 420, height: 440 } });
  await page.locator('[data-alts] div[title="cat spin (sends it)"] button').click();
  ok((await page.evaluate(() => window.__sent)).some(m => m.t === 'giphy-take' && m.id === 'giphy-2' && m.mine === true), '⬇ keeps it');
  await page.click('[data-alts] div[title="cat wave (sends it)"]');
  await page.waitForFunction(() => window.__attached.length > 0, null, { timeout: 5000 }).catch(() => {});
  ok((await page.evaluate(() => window.__attached)).join() === 'sticker.gif:image/gif', 'click = the GIF goes into the chat');
  ok(page.errors.length === 0, 'no JS errors: ' + JSON.stringify(page.errors));
  await ctx.close();

  console.log('2) Win+V (ALTS-Clip.exe) Stickers tab');
  const c2 = await browser.newContext({ viewport: { width: 380, height: 520 } });
  await c2.addInitScript(() => { window.__sent = []; window.chrome = { webview: { postMessage: s => window.__sent.push(JSON.parse(s)) } }; });
  const p2 = await c2.newPage();
  p2.errors = [];
  p2.on('pageerror', e => p2.errors.push(String(e)));
  await p2.goto('file://' + path.join(UI, 'clip.html'));
  await p2.evaluate(({ RED, BLUE, GREEN, GOLD }) => {
    window.clip.assets({ memes: [{ file: '30b1gx.jpg', name: 'Drake Hotline Bling', src: RED }, { file: '1g8my4.jpg', name: 'Two Buttons', src: BLUE }], emoji: '' });
    window.clip.load({ items: [], mine: [{ file: 's1p.png', src: GREEN }], giphy: [{ file: 'abc.gif', name: 'anime cry', src: GOLD }], favs: ['giphy:abc.gif', 'meme:1g8my4.jpg'] });
  }, { RED, BLUE, GREEN, GOLD });
  await p2.click('button.tab[data-tab="stick"]');
  await sleep(200);
  const h2 = await p2.$$eval('.h', els => els.map(e => e.textContent));
  ok(h2.join('|') === '⭐ Favorites|My stickers|Memes', 'sections: ' + h2.join(', '));
  const favSrcs = await p2.$$eval('.h + .grid', gs => [...gs[0].querySelectorAll('img')].map(i => i.src.slice(-12)));
  ok(favSrcs.length === 2, 'favorites: the kept GIPHY one + Two Buttons');
  await p2.hover('.st >> nth=2');
  await p2.click('.st >> nth=2 >> .fav');
  ok((await p2.evaluate(() => window.__sent)).some(m => m.t === 'fav' && m.kind === 'mine' && m.on === true), 'star in Win+V = favorite');
  await p2.click('.st >> nth=0');
  ok((await p2.evaluate(() => window.__sent)).some(m => m.t === 'sticker' && m.kind === 'giphy' && m.file === 'abc.gif'), 'clicking a kept GIPHY sticker pastes it');
  if (SHOTS) await p2.screenshot({ path: path.join(SHOTS, 'winv-stickers.png') });
  ok(p2.errors.length === 0, 'no JS errors: ' + JSON.stringify(p2.errors));
  await browser.close();
  console.log(failures ? '\n' + failures + ' FAILED' : '\nALL STICKER CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
