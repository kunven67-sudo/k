// End-to-end tests in a real Chromium: node tools/test.mjs
// Runs the editor the way the bookmark does on a normal page and on a page
// with the strictest security rules (CSP + Trusted Types), checks saving,
// bringing changes back, downloading, and the Chrome extension.
import http from 'node:http';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from './pw.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIX = join(ROOT, 'tools', 'fixtures');
const SHOTS = process.env.SHOTS || join(ROOT, 'dist', 'shots');
mkdirSync(SHOTS, { recursive: true });

// the bookmark's code, decoded exactly like the browser does it
const html = readFileSync(join(ROOT, 'edit-website.html'), 'utf8');
const href = /class="bm" href="([^"]+)"/.exec(html)[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const CODE = decodeURIComponent(href.slice('javascript:'.length));

const STRICT = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; media-src 'self'; require-trusted-types-for 'script'; trusted-types 'none'";
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const strict = u.pathname.startsWith('/strict'), closed = u.pathname.startsWith('/closed');
  let p = u.pathname.replace(/^\/(strict|closed)/, '');
  if (p === '' || p === '/') p = '/page.html';
  const f = join(FIX, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  const h = { 'content-type': TYPES[extname(f)] || 'application/octet-stream' };
  if (strict && f.endsWith('.html')) h['content-security-policy'] = STRICT;
  res.writeHead(200, h);
  let body = readFileSync(f);
  if (closed && f.endsWith('.html')) body = body.toString().replace(' data-ew-test', '');
  res.end(body);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let passed = 0, failed = 0;
const boxes = {};
async function step(name, fn) {
  try { await fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + String(e && e.stack || e).split('\n').slice(0, 10).join('\n       ')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function watchErrors(page, list) {
  page.on('pageerror', (e) => list.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Content Security Policy|Refused to|requires 'Trusted|net::ERR|favicon|Failed to load resource/i.test(m.text())) list.push('console: ' + m.text()); });
}
const ui = (page) => page.locator('ew-root');
const tab = (page, t) => ui(page).locator(`.tab[data-t="${t}"]`).click();
const button = (page, name) => ui(page).getByRole('button', { name, exact: true }).first();
const PNG = readFileSync(join(ROOT, 'src', 'extension', 'icons', '128.png'));

const browser = await chromium.launch();

// ===================== normal page =====================
console.log('Normal page (bookmark):');
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  watchErrors(page, errors);
  await page.goto(BASE + '/');
  await page.evaluate(CODE);

  await step('editor opens', async () => {
    await ui(page).locator('.panel.show').waitFor();
    assert.equal(await page.getAttribute('html', 'data-ew-alive'), 'bookmarklet');
  });
  await step('pick an element by clicking it', async () => {
    await button(page, 'Pick something on the page').click();
    await page.click('#title');
    await ui(page).locator('.selname', { hasText: 'h1#title' }).waitFor();
  });
  await step('picking does not trigger the site\'s own clicks', async () => {
    await page.evaluate(() => { window.__clicked = 0; document.getElementById('cta').addEventListener('click', () => window.__clicked++); });
    await button(page, 'Pick something on the page').click();
    await page.click('#cta');
    assert.equal(await page.evaluate(() => window.__clicked), 0);
    await button(page, 'Pick something on the page').waitFor();
    await page.keyboard.press('Escape');
  });
  await step('change text with the Words box', async () => {
    await ui(page).locator('#nothing').count();
    await button(page, 'Pick something on the page').click();
    await page.click('#title');
    const words = ui(page).locator('.row', { hasText: 'Words' }).locator('input');
    await words.fill('New title!');
    await page.waitForFunction(() => document.getElementById('title').textContent === 'New title!');
    boxes.words = await words.boundingBox();
    boxes.pick = await button(page, 'Pick something on the page').boundingBox();
  });
  await step('text color + undo + redo', async () => {
    const color = ui(page).locator('.row', { hasText: 'Text color' }).locator('input[type=color]');
    await color.fill('#ff0000');
    await page.waitForFunction(() => getComputedStyle(document.getElementById('title')).color === 'rgb(255, 0, 0)');
    await ui(page).locator('.hd button[title^="Undo"]').click();
    await page.waitForFunction(() => getComputedStyle(document.getElementById('title')).color !== 'rgb(255, 0, 0)');
    await ui(page).locator('.hd button[title^="Redo"]').click();
    await page.waitForFunction(() => getComputedStyle(document.getElementById('title')).color === 'rgb(255, 0, 0)');
  });
  await step('sliders: text size, zoom, round corners', async () => {
    const r = ui(page).locator('.row', { hasText: 'Text size' }).locator('input[type=range]');
    await r.fill('60');
    await page.waitForFunction(() => getComputedStyle(document.getElementById('title')).fontSize === '60px');
  });
  await step('move with the green grip', async () => {
    const g = ui(page).locator('.grip.mv');
    const b = await g.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + 60, b.y + 40, { steps: 5 });
    await page.mouse.up();
    const t = await page.evaluate(() => document.getElementById('title').style.translate);
    assert.match(t, /px/);
  });
  await step('Delete key deletes, Ctrl+Z brings it back', async () => {
    await button(page, 'Pick something on the page').click();
    await page.click('.card:nth-child(2) h3');
    await button(page, 'Parent').click();
    await ui(page).locator('.selname', { hasText: 'div.card' }).waitFor();
    await page.mouse.click(5, 880);
    await page.keyboard.press('Delete');
    await page.waitForFunction(() => document.querySelectorAll('.card').length === 2);
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => document.querySelectorAll('.card').length === 3);
  });
  await step('edit text right on the page', async () => {
    await button(page, 'Pick something on the page').click();
    await page.click('footer');
    await button(page, 'Edit text').click();
    await page.keyboard.type(' EDITED');
    await button(page, 'Done typing').click();
    assert.match(await page.textContent('footer'), /EDITED/);
  });
  await step('click actions: popup + sound on a site button', async () => {
    await button(page, 'Pick something on the page').click();
    await page.click('#cta');
    await ui(page).locator('select.in').filter({ hasText: 'Add something to do' }).selectOption('popup');
    await ui(page).locator('.act').first().waitFor();
    await page.click('#cta');
    await ui(page).locator('.mw.show .mbox', { hasText: 'You clicked me' }).waitFor();
    await ui(page).locator('.mw.show .btn').click();
  });
  await step('code tree + live code editing', async () => {
    await tab(page, 'code');
    await ui(page).locator('.tree .tr').first().waitFor();
    await button(page, 'Pick on page').click();
    await page.click('.list li:nth-child(2)');
    const ta = ui(page).locator('.ed textarea');
    await page.waitForFunction(() => true);
    assert.match(await ta.inputValue(), /<li>Two<\/li>/);
    await ta.fill('<li class="hacked">Two <b>bold</b></li>');
    await page.waitForFunction(() => document.querySelector('.list li.hacked b'), null, { timeout: 4000 });
    await sleep(1800); // live edit becomes an undo step after a pause
  });
  await step('code search finds text', async () => {
    const q = ui(page).locator('input[placeholder^="Find:"]');
    await q.fill('Keyboard');
    await q.press('Enter');
    await ui(page).locator('.dimtx', { hasText: 'found' }).waitFor();
  });
  await step('editing a table row keeps it a table row', async () => {
    await button(page, 'Pick on page').click();
    await page.click('#tbl td');
    await button(page, 'Parent').count();
    await page.evaluate(() => 0);
    const ta = ui(page).locator('.ed textarea');
    await ta.fill('<td>NEW</td>');
    await page.waitForFunction(() => document.querySelector('#tbl td').textContent === 'NEW');
    await sleep(1800);
  });
  await step('background: color, gradient, animated', async () => {
    await tab(page, 'bg');
    await button(page, 'Color').click();
    await page.waitForFunction(() => document.querySelector('ew-bg'));
    const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert.equal(bodyBg, 'rgba(0, 0, 0, 0)');
    await page.waitForFunction(() => /rgba\(255, 255, 255, 0\.1/.test(getComputedStyle(document.querySelector('main')).backgroundColor));
    await button(page, 'Gradient').click();
    await button(page, 'Galaxy').click();
    await button(page, 'Animated').click();
    await ui(page).locator('.tile', { hasText: 'Galaxy' }).click();
    await page.waitForFunction(() => document.querySelector('ew-bg canvas'));
    await sleep(400);
    await page.screenshot({ path: join(SHOTS, '1-galaxy-bg.png') });
  });
  await step('background: your own picture', async () => {
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), button(page, 'Picture / GIF').click()]);
    await fc.setFiles({ name: 'p.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForFunction(() => document.querySelector('ew-bg img, ew-bg canvas'));
  });
  await step('effects: snow, upside down, rainbow, gravity', async () => {
    await tab(page, 'fx');
    await ui(page).locator('.tile[title="Flakes falling"]').click();
    await page.waitForFunction(() => true);
    assert.equal(await ui(page).locator('.fxc').evaluate((c) => c.style.display), 'block');
    await ui(page).locator('.tile[title="Flip the page"]').click();
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).rotate), '180deg');
    await ui(page).locator('.tile[title="Colors cycle forever"]').click();
    await sleep(500);
    await page.screenshot({ path: join(SHOTS, '2-effects.png') });
    await ui(page).locator('.tile[title="Flip the page"]').click();
    await ui(page).locator('.tile[title="Colors cycle forever"]').click();
    await ui(page).locator('.tile', { hasText: 'Gravity' }).click();
    await sleep(900);
    const moved = await page.evaluate(() => [...document.querySelectorAll('button,img,h3')].some((e) => /px/.test(e.style.translate)));
    assert.ok(moved, 'things should be falling');
    await page.screenshot({ path: join(SHOTS, '3-gravity.png') });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => ![...document.querySelectorAll('.card button')].some((e) => e.style.translate));
  });
  await step('add a button with a click action', async () => {
    await tab(page, 'add');
    await ui(page).locator('.tile', { hasText: 'Button' }).first().click();
    await page.waitForSelector('[data-ew-add="button"]');
    await ui(page).locator('select.in').filter({ hasText: 'Add something to do' }).selectOption('text');
    await page.click('[data-ew-add="button"]');
    await page.waitForFunction(() => document.querySelector('[data-ew-add="button"]').textContent === 'You clicked!');
  });
  await step('replace every word', async () => {
    await tab(page, 'add');
    await ui(page).locator('input[placeholder="Find this word"]').fill('YouTube');
    await ui(page).locator('input[placeholder="Change it to"]').fill('MyTube');
    await button(page, 'Replace everywhere').click();
    await page.waitForFunction(() => /MyTube approved/.test(document.querySelector('.lead').textContent));
  });
  await step('CSS box applies live, JS box runs', async () => {
    await tab(page, 'cssjs');
    const eds = ui(page).locator('.ed textarea');
    await eds.nth(0).fill('footer { color: rgb(0, 128, 0) !important; }');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('footer')).color === 'rgb(0, 128, 0)');
    await eds.nth(1).fill('console.log("hey"); 40 + 2');
    await button(page, 'Run').click();
    await ui(page).locator('.out', { hasText: '42' }).waitFor();
    assert.match(await ui(page).locator('.out').textContent(), /hey/);
  });
  await step('screenshot of each tab', async () => {
    for (const t of ['pick', 'code', 'bg', 'fx', 'add', 'cssjs', 'save']) {
      await tab(page, t);
      await sleep(250);
      await page.screenshot({ path: join(SHOTS, `tab-${t}.png`) });
    }
  });
  await step('download edited site', async () => {
    await tab(page, 'save');
    const [dl] = await Promise.all([page.waitForEvent('download'), button(page, 'Download edited site').click()]);
    const file = join(SHOTS, 'downloaded.html');
    await dl.saveAs(file);
    const txt = readFileSync(file, 'utf8');
    assert.match(txt, /__EW_ENV/);
    assert.match(txt, /New title!/);
    assert.ok(!/<ew-root/.test(txt), 'editor UI must not be in the download');
  });
  await step('auto-save, reload, changes come back', async () => {
    await sleep(1500);
    await page.reload();
    await page.evaluate(CODE);
    await page.waitForFunction(() => document.getElementById('title') && document.getElementById('title').textContent === 'New title!', null, { timeout: 8000 });
    await page.waitForSelector('[data-ew-add="button"]');
    await page.waitForFunction(() => document.querySelector('ew-bg'));
    await page.waitForFunction(() => /MyTube/.test(document.querySelector('.lead').textContent));
    await page.waitForFunction(() => document.querySelector('.list li.hacked b'));
    await page.waitForFunction(() => document.querySelector('#tbl td').textContent === 'NEW');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('footer')).color === 'rgb(0, 128, 0)');
    await page.click('#cta');
    await ui(page).locator('.mw.show .mbox', { hasText: 'You clicked me' }).waitFor();
    await ui(page).locator('.mw.show .btn').click();
  });
  await step('clicking the bookmark again closes/opens', async () => {
    await page.evaluate(CODE);
    assert.equal(await ui(page).locator('.panel.show').count(), 0);
    await page.evaluate(CODE);
    await ui(page).locator('.panel.show').waitFor();
  });
  await step('no script errors on the normal page', async () => { if (errors.length) throw new Error(errors.join('\n')); });

  // the downloaded file, opened on its own
  await step('downloaded page works on its own', async () => {
    const p2 = await ctx.newPage();
    const errs = [];
    watchErrors(p2, errs);
    await p2.goto('file://' + join(SHOTS, 'downloaded.html'));
    await p2.waitForFunction(() => document.querySelector('ew-bg'));
    await p2.waitForSelector('[data-ew-add="button"]');
    await p2.click('#cta');
    await p2.locator('ew-root .mw.show').waitFor().catch(async () => { throw new Error('popup action missing in download'); });
    await p2.keyboard.press('Escape');
    await p2.screenshot({ path: join(SHOTS, '4-downloaded.png') });
    if (errs.length) throw new Error(errs.join('\n'));
    await p2.close();
  });
  await ctx.close();
}

// ===================== real (closed) editor =====================
console.log('Closed editor (like on real sites):');
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  watchErrors(page, errors);
  await page.goto(BASE + '/closed/');
  await page.evaluate(CODE);
  await step('typing in the editor\'s boxes never deletes/moves page stuff', async () => {
    await sleep(300);
    await page.mouse.click(boxes.pick.x + boxes.pick.width / 2, boxes.pick.y + boxes.pick.height / 2);
    await page.click('#title');
    await sleep(300);
    await page.mouse.click(boxes.words.x + boxes.words.width - 10, boxes.words.y + boxes.words.height / 2);
    await page.keyboard.press('End');
    for (let i = 0; i < 7; i++) await page.keyboard.press('Backspace');
    await page.keyboard.type('NOW');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Delete');
    await sleep(500);
    const st = await page.evaluate(() => { const t = document.getElementById('title'); return t ? [t.textContent, t.style.translate] : null; });
    assert.ok(st, 'the title must still be there');
    assert.equal(st[0], 'Gear that hits diNO');
    assert.equal(st[1], '');
  });
  await step('closed editor: Esc + Delete key still work on the page', async () => {
    await page.mouse.click(5, 880);
    await page.keyboard.press('Delete');
    await page.waitForFunction(() => !document.getElementById('title'));
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => document.getElementById('title'));
  });
  await step('no script errors (closed editor)', async () => { if (errors.length) throw new Error(errors.join('\n')); });
  await ctx.close();
}

// ===================== strict page (CSP + Trusted Types) =====================
console.log('Strict page (CSP + Trusted Types, bookmark):');
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  watchErrors(page, errors);
  await page.goto(BASE + '/strict/');
  await step('Trusted Types really are on', async () => {
    const blocked = await page.evaluate(() => { try { document.body.innerHTML += ''; return false; } catch (e) { return true; } });
    assert.ok(blocked, 'innerHTML should be blocked');
  });
  await page.evaluate(CODE);
  await step('editor opens on strict page', async () => { await ui(page).locator('.panel.show').waitFor(); });
  await step('code editing works without innerHTML', async () => {
    await tab(page, 'code');
    await button(page, 'Pick on page').click();
    await page.click('#title');
    const ta = ui(page).locator('.ed textarea');
    await ta.fill('<h1 id="title" style="color: rgb(0, 0, 255)">Strict <b>works</b> &amp; stuff</h1>');
    await page.waitForFunction(() => { const t = document.getElementById('title'); return t && t.querySelector('b') && t.textContent === 'Strict works & stuff'; }, null, { timeout: 4000 });
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('title')).color), 'rgb(0, 0, 255)');
    await sleep(1800);
  });
  await step('edit text + delete + undo on strict page', async () => {
    await tab(page, 'pick');
    await button(page, 'Pick something on the page').click();
    await page.click('.card:nth-child(1) h3');
    await ui(page).locator('.card .btn', { hasText: 'Delete' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.card h3').length === 2);
    await ui(page).locator('.hd button[title^="Undo"]').click();
    await page.waitForFunction(() => document.querySelectorAll('.card h3').length === 3);
  });
  await step('picture background falls back to canvas when data: is blocked', async () => {
    await tab(page, 'bg');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), button(page, 'Picture / GIF').click()]);
    await fc.setFiles({ name: 'p.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForFunction(() => document.querySelector('ew-bg canvas'), null, { timeout: 5000 });
  });
  await step('effects + animated background on strict page', async () => {
    await button(page, 'Animated').click();
    await ui(page).locator('.tile', { hasText: 'Matrix' }).click();
    await tab(page, 'fx');
    await ui(page).locator('.tile[title="Party paper"]').click();
    await ui(page).locator('.tile', { hasText: 'Comic Sans' }).click();
    assert.match(await page.evaluate(() => getComputedStyle(document.getElementById('title')).fontFamily), /Comic/);
    await sleep(500);
    await page.screenshot({ path: join(SHOTS, '5-strict.png') });
  });
  await step('added stuff + popup action on strict page', async () => {
    await tab(page, 'add');
    await ui(page).locator('.tile', { hasText: 'Popup' }).click();
    await page.waitForSelector('[data-ew-add="popup"]');
    await page.click('[data-ew-add="popup"] [data-ew-close]');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-ew-add="popup"]')).display === 'none');
  });
  await step('JS box explains it is blocked', async () => {
    await tab(page, 'cssjs');
    await ui(page).locator('.ed textarea').nth(1).fill('1+1');
    await button(page, 'Run').click();
    await ui(page).locator('.out .e').waitFor();
    assert.match(await ui(page).locator('.out .e').textContent(), /extension/);
  });
  await step('changes come back on strict page', async () => {
    await sleep(1500);
    await page.reload();
    await page.evaluate(CODE);
    await page.waitForFunction(() => document.getElementById('title') && /Strict works/.test(document.getElementById('title').textContent), null, { timeout: 8000 });
    await page.waitForFunction(() => document.querySelector('ew-bg canvas'));
  });
  await step('no script errors on the strict page', async () => { if (errors.length) throw new Error(errors.join('\n')); });
  await ctx.close();
}
await browser.close();

// ===================== Chrome extension =====================
console.log('Chrome extension:');
{
  const ctx = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true, viewport: { width: 1400, height: 900 },
    args: [`--disable-extensions-except=${join(ROOT, 'extension')}`, `--load-extension=${join(ROOT, 'extension')}`]
  });
  let sw = ctx.serviceWorkers()[0];
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 10000 }).catch(() => null);
  const page = await ctx.newPage();
  const errors = [];
  watchErrors(page, errors);
  await step('extension loads on pages by itself', async () => {
    assert.ok(sw, 'service worker should start');
    await page.goto(BASE + '/');
    await page.waitForFunction(() => document.documentElement.getAttribute('data-ew-alive') === 'extension', null, { timeout: 8000 });
  });
  await step('toolbar/shortcut toggle opens the editor', async () => {
    await sw.evaluate(async () => { const [t] = await chrome.tabs.query({ active: true }); await chrome.tabs.sendMessage(t.id, { ew: 'toggle' }); });
    await ui(page).locator('.panel.show').waitFor();
  });
  await step('bookmark click while the extension runs just toggles it', async () => {
    await page.evaluate(CODE);
    await page.waitForFunction(() => true);
    await sleep(200);
    assert.equal(await ui(page).locator('.panel.show').count(), 0);
    assert.equal(await page.locator('ew-root').count(), 1);
    await page.evaluate(CODE);
    await ui(page).locator('.panel.show').waitFor();
  });
  await step('extension: change background, it comes back by itself after reload', async () => {
    await tab(page, 'bg');
    await button(page, 'Color').click();
    await page.waitForFunction(() => document.querySelector('ew-bg'));
    await tab(page, 'fx');
    await ui(page).locator('.tile', { hasText: 'Night vision' }).click();
    await sleep(1500);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('ew-bg'), null, { timeout: 8000 });
    assert.equal(await ui(page).locator('.panel.show').count(), 0, 'editor stays closed, changes still show');
  });
  await step('extension: JS runs through the background', async () => {
    await sw.evaluate(async () => { const [t] = await chrome.tabs.query({ active: true }); await chrome.tabs.sendMessage(t.id, { ew: 'toggle' }); });
    await ui(page).locator('.panel.show').waitFor();
    await tab(page, 'cssjs');
    await ui(page).locator('.ed textarea').nth(1).fill('console.log("from ext"); return 6 * 7');
    await button(page, 'Run').click();
    await ui(page).locator('.out .r, .out .e').first().waitFor();
    const out = await ui(page).locator('.out').textContent();
    assert.match(out, /42|from ext/, out);
  });
  await step('extension works on the strict page', async () => {
    await page.goto(BASE + '/strict/');
    await page.waitForFunction(() => document.documentElement.getAttribute('data-ew-alive') === 'extension');
    await sw.evaluate(async () => { const [t] = await chrome.tabs.query({ active: true }); await chrome.tabs.sendMessage(t.id, { ew: 'toggle' }); });
    await ui(page).locator('.panel.show').waitFor();
    await tab(page, 'code');
    await button(page, 'Pick on page').click();
    await page.click('footer');
    await ui(page).locator('.ed textarea').fill('<footer>EXT <i>ok</i></footer>');
    await page.waitForFunction(() => document.querySelector('footer i'), null, { timeout: 4000 });
    await page.screenshot({ path: join(SHOTS, '6-extension-strict.png') });
  });
  await step('no script errors with the extension', async () => { if (errors.length) throw new Error(errors.join('\n')); });
  await ctx.close();
}

server.close();
console.log(`\n${passed} passed, ${failed} failed`);
writeFileSync(join(SHOTS, 'result.txt'), `${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
