// Phone sign-in, end to end (run by phone_test.go with ALTS_E2E=1):
//  A) the real phone page (ui/phone.html, served by the real Go server) in a phone-sized browser
//  B) the real ALTS helper (ui/phone.js) on a fake Claude sign-in page with one box per code digit
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const [url, shots, qrFile] = process.argv.slice(2);
const shot = async (p, name) => { if (shots) await p.screenshot({ path: path.join(shots, name) }); };
const must = (ok, what) => { if (!ok) { console.error('FAIL: ' + what); process.exit(1); } console.log('ok: ' + what); };

const FAKE = `<!doctype html><html><head><title>Sign in - Claude</title><style>
body{font-family:system-ui;background:#faf9f5;display:flex;justify-content:center;padding-top:80px}
.card{width:420px;border:1px solid #ddd;border-radius:18px;padding:28px;background:#fff}
input{width:100%;padding:12px;font-size:16px;border-radius:10px;border:1px solid #ccc;box-sizing:border-box}
.digits input{width:44px;text-align:center;margin-right:6px} button{width:100%;margin-top:12px;padding:12px;border-radius:10px;font-size:16px}
.dark{background:#111;color:#fff}</style></head><body><div class=card id=card>
<button>Continue with Google</button><button>Continue with Apple</button><p style=text-align:center>OR</p>
<input id=em placeholder="Enter your email"><button class=dark id=cont>Continue with email</button></div>
<script>
// like React: the value lives in JS, only 'input' events update it
let email='', digits=['','','','','',''];
document.getElementById('em').addEventListener('input', e => email = e.target.value);
document.getElementById('cont').onclick = () => {
  if (!/@/.test(email)) return;
  const c = document.getElementById('card'); c.textContent = '';
  const p = document.createElement('p'); p.textContent = 'Enter the code sent to ' + email; c.append(p);
  const row = document.createElement('div'); row.className = 'digits';
  digits.forEach((_, i) => { const d = document.createElement('input'); d.maxLength = 1; d.inputMode = 'numeric';
    d.addEventListener('input', e => digits[i] = e.target.value); row.append(d); });
  const v = document.createElement('button'); v.className = 'dark'; v.textContent = 'Verify Email Address';
  v.onclick = () => { if (digits.join('') === '482913') { history.pushState({}, '', '/new'); document.body.textContent = 'Chats'; }
    else { const a = document.createElement('div'); a.setAttribute('role','alert'); a.textContent = 'Invalid code'; c.append(a); } };
  c.append(row, v);
};
</script></body></html>`;

(async () => {
  const browser = await chromium.launch();
  // ---- A) phone page ----
  const phone = await browser.newContext({ ...devices['Pixel 7'] });
  const p = await phone.newPage();
  await p.goto(url);
  await p.getByRole('button', { name: 'alt.one@gmail.com' }).waitFor();
  must(await p.locator('#name').textContent() === 'Main', 'phone page shows the account name');
  must(await p.getByRole('button', { name: 'sam.player@gmail.com' }).isVisible(), 'saved Gmails are buttons');
  await shot(p, 'phone-1-pick.png');
  await p.getByRole('button', { name: 'alt.one@gmail.com' }).tap();
  await p.locator('#s-code').waitFor({ state: 'visible' });
  must((await p.locator('#to').textContent()) === 'alt.one@gmail.com', 'code step names the Gmail');
  await p.waitForFunction(() => /sent the code/.test(document.getElementById('note').textContent));
  await p.locator('#code').fill('482 913');
  await shot(p, 'phone-2-code.png');
  await p.getByRole('button', { name: 'Sign in on my PC' }).tap();
  await p.locator('#s-done').waitFor({ state: 'visible', timeout: 8000 });
  must(true, 'phone shows Signed in');
  await shot(p, 'phone-3-done.png');

  // ---- B) ALTS helper on a fake Claude sign-in page ----
  const pc = await browser.newContext({ viewport: { width: 1280, height: 760 } });
  await pc.route('https://claude.ai/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: FAKE }));
  await pc.addInitScript(() => { window.__msgs = []; window.chrome = { webview: { postMessage: m => window.__msgs.push(JSON.parse(m)) } }; });
  await pc.addInitScript({ content: fs.readFileSync(path.join(__dirname, '..', 'ui', 'phone.js'), 'utf8') });
  const g = await pc.newPage();
  await g.goto('https://claude.ai/login');
  await g.waitForFunction(() => window.__msgs.some(m => m.t === 'phone-login'));
  must(true, 'sign-in page asks ALTS for a QR');
  const qr = qrFile ? fs.readFileSync(qrFile, 'utf8') : '';
  await g.evaluate(([png, u]) => __altsPhone.qr({ png, url: u }), [qr, url]);
  must(await g.locator('[data-alts] img').isVisible(), 'QR card shows on the sign-in page');
  await shot(g, 'pc-1-qr.png');
  await g.evaluate(() => __altsPhone.email('alt.one@gmail.com'));
  await g.waitForFunction(() => window.__msgs.some(m => m.t === 'phone-state' && /sent the code/.test(m.text)));
  must(await g.locator('.digits input').count() === 6, 'helper typed the Gmail and pressed Continue with email');
  await g.evaluate(() => __altsPhone.code('999999'));
  await g.waitForFunction(() => window.__msgs.some(m => m.t === 'phone-state' && /Invalid code/.test(m.text)), null, { timeout: 15000 });
  must(true, 'a wrong code reports Claude\'s error back');
  await g.locator('.digits input').evaluateAll(l => l.forEach(i => { i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); }));
  await g.evaluate(() => __altsPhone.code('482913'));
  await g.waitForFunction(() => window.__msgs.some(m => m.t === 'phone-left'), null, { timeout: 8000 });
  must(await g.evaluate(() => location.pathname) === '/new', 'right code: signed in, ALTS told');
  must(await g.locator('[data-alts]').count() === 0, 'QR card goes away after signing in');
  await browser.close();
  console.log('ALL OK');
})().catch(e => { console.error(e); process.exit(1); });
