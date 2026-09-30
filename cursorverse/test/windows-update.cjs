// Windows CI only, after the build: a real update, end to end.
// Runs an "old" copy of the built portable exe from a folder with a space in
// its name, serves the "new" exe from a local fake GitHub, lets the old copy
// click Update by itself, then checks that the new version started, the old
// one closed, and the old file on disk was replaced with the new exe.
const { spawn, execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const version = require('../package.json').version;
const built = path.join(__dirname, '..', 'dist', `CursorVerse-${version}-Portable.exe`);
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const logFile = path.join(process.env.APPDATA, 'CursorVerse', 'update.log');
const readLog = () => { try { return fs.readFileSync(logFile, 'utf8'); } catch { return ''; } };

(async () => {
  const newBytes = fs.readFileSync(built);
  const newSha = sha(built);

  // the "old" install: same program plus some trailing bytes, so the file is
  // different and we can tell whether it really got replaced
  const dir = path.join(os.tmpdir(), 'cv update test');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const oldExe = path.join(dir, 'CursorVerse.exe');
  fs.writeFileSync(oldExe, Buffer.concat([newBytes, crypto.randomBytes(4096)]));
  if (sha(oldExe) === newSha) throw new Error('test setup: old and new are the same');
  fs.rmSync(logFile, { force: true });

  const srv = http.createServer((req, res) => {
    const port = srv.address().port;
    if (req.url.startsWith('/releases')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([{
        tag_name: `cursorverse-v${version}`,
        html_url: 'http://example/',
        body: 'test',
        assets: [{ name: `CursorVerse-${version}-Portable.exe`, size: newBytes.length, digest: `sha256:${newSha}`, browser_download_url: `http://127.0.0.1:${port}/exe` }],
      }]));
    } else if (req.url === '/exe') {
      res.writeHead(200, { 'Content-Length': String(newBytes.length) });
      res.end(newBytes);
    } else {
      res.writeHead(404); res.end();
    }
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const feed = `http://127.0.0.1:${srv.address().port}/releases`;

  console.log(`starting old copy: ${oldExe}`);
  const old = spawn(oldExe, [], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, CURSORVERSE_TEST: '1', CV_FAKE_VERSION: '0.0.1', CV_UPDATE_FEED: feed, CV_AUTO_UPDATE: '1' },
  });
  old.unref();

  const t0 = Date.now();
  let log = '';
  while (Date.now() - t0 < 240000) {
    await sleep(1000);
    log = readLog();
    if (/replaced |could not replace|did not start|download failed|check failed|finish failed/.test(log)) break;
  }
  console.log('----- update.log -----\n' + log + '----------------------');
  srv.close();

  const need = [
    [/downloaded /, 'the old copy downloaded the new exe'],
    [/started new version /, 'the old copy started the new exe'],
    [/new version is running, closing the old one/, 'the new copy knocked and the old one stepped aside'],
    [/finishing update: /, 'the new copy started with the finish flag'],
    [/replaced .*CursorVerse\.exe/, 'the new copy replaced the old file'],
  ];
  const missing = need.filter(([re]) => !re.test(log)).map(([, what]) => what);
  if (missing.length) throw new Error(`update did not complete. Missing: ${missing.join('; ')}`);
  if (sha(oldExe) !== newSha) throw new Error('the old exe file was NOT replaced with the new one');
  if (fs.existsSync(`${oldExe}.new`)) throw new Error('temp file left behind');
  console.log(`update worked end to end in ${Math.round((Date.now() - t0) / 1000)} s ✅`);
})()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => {
    try { execSync('taskkill /F /T /IM CursorVerse*', { stdio: 'ignore' }); } catch { /* none left */ }
  });
