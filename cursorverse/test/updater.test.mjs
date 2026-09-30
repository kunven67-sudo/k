import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { compareVersions, pickLatest, downloadVerified } = require('../src/main/updater.js');

test('version compare', () => {
  assert.ok(compareVersions('1.0.10', '1.0.9') > 0);
  assert.ok(compareVersions('1.1.0', '1.0.99') > 0);
  assert.ok(compareVersions('2.0.0', '10.0.0') < 0);
  assert.equal(compareVersions('1.0.2', 'v1.0.2'), 0);
  assert.equal(compareVersions('junk', '1.0.0'), 0);
});

const asset = (v, extra = {}) => ({ name: `CursorVerse-${v}-Portable.exe`, browser_download_url: `https://x/${v}.exe`, size: 10, digest: `sha256:${'a'.repeat(64)}`, ...extra });

test('picks the newest real CursorVerse release', () => {
  const latest = pickLatest([
    { tag_name: 'cursorverse-v1.0.2', assets: [asset('1.0.2')] },
    { tag_name: 'cursorverse-v1.0.10', assets: [asset('1.0.10')] },
    { tag_name: 'cursorverse-v9.9.9', draft: true, assets: [asset('9.9.9')] },
    { tag_name: 'cursorverse-v8.0.0', prerelease: true, assets: [asset('8.0.0')] },
    { tag_name: 'cursorverse-v7.0.0', assets: [{ name: 'notes.txt' }] },
    { tag_name: 'other-v5.0.0', assets: [asset('5.0.0')] },
    { tag_name: 'cursorverse-build-12', assets: [asset('0.0.1')] },
  ]);
  assert.equal(latest.version, '1.0.10');
  assert.equal(latest.url, 'https://x/1.0.10.exe');
  assert.equal(latest.sha256, 'a'.repeat(64));
  assert.equal(pickLatest([]), null);
  assert.equal(pickLatest(null), null);
});

function serve(body, { truncate = false } = {}) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Length': String(body.length) });
      if (truncate) { res.write(body.subarray(0, body.length / 2)); res.destroy(); return; }
      res.end(body);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, url: `http://127.0.0.1:${srv.address().port}/f.exe` }));
  });
}

test('download is saved only when size and checksum match', async () => {
  const body = crypto.randomBytes(300000);
  const sha = crypto.createHash('sha256').update(body).digest('hex');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-upd-'));
  const { srv, url } = await serve(body);
  try {
    const progress = [];
    const out = await downloadVerified(fetch, { url, size: body.length, sha256: sha }, path.join(dir, 'new.exe'), (p) => progress.push(p));
    assert.equal(out.sha256, sha);
    assert.deepEqual(fs.readFileSync(path.join(dir, 'new.exe')), body);
    assert.equal(progress.at(-1), 1);

    await assert.rejects(
      downloadVerified(fetch, { url, size: body.length, sha256: 'b'.repeat(64) }, path.join(dir, 'bad.exe')),
      /damaged/,
    );
    assert.ok(!fs.existsSync(path.join(dir, 'bad.exe')));
    assert.ok(!fs.existsSync(path.join(dir, 'bad.exe.part')));
  } finally {
    srv.close();
  }
});

test('a cut-off download is rejected', async () => {
  const body = crypto.randomBytes(200000);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-upd-'));
  const { srv, url } = await serve(body, { truncate: true });
  try {
    await assert.rejects(downloadVerified(fetch, { url, size: body.length, sha256: null }, path.join(dir, 'cut.exe')));
    assert.ok(!fs.existsSync(path.join(dir, 'cut.exe')));
  } finally {
    srv.close();
  }
});

const { Updater, replaceExe, finishTarget, childEnv } = require('../src/main/updater.js');

test('finish flag is read from the command line', () => {
  assert.equal(finishTarget(['x.exe', '--cv-finish-update=C:\\Users\\A B\\CursorVerse.exe']), 'C:\\Users\\A B\\CursorVerse.exe');
  assert.equal(finishTarget(['x.exe', '"--cv-finish-update="C:\\a.exe"']), null);
  assert.equal(finishTarget(['x.exe', '--hidden']), null);
  assert.equal(finishTarget(undefined), null);
});

test('the new copy gets a clean env', () => {
  const env = childEnv({ PATH: 'p', PORTABLE_EXECUTABLE_FILE: 'old.exe', PORTABLE_EXECUTABLE_DIR: 'd', CV_FAKE_VERSION: '0.0.1', CV_AUTO_UPDATE: '1', ELECTRON_RUN_AS_NODE: '1' });
  assert.deepEqual(env, { PATH: 'p' });
});

test('replaceExe swaps the file in and leaves no temp file', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-rep-'));
  const src = path.join(dir, 'new.exe');
  const dst = path.join(dir, 'CursorVerse.exe');
  fs.writeFileSync(src, 'NEW');
  fs.writeFileSync(dst, 'OLD');
  const lines = [];
  const r = await replaceExe(src, dst, { log: (l) => lines.push(l) });
  assert.equal(r.ok, true);
  assert.equal(fs.readFileSync(dst, 'utf8'), 'NEW');
  assert.equal(fs.readFileSync(src, 'utf8'), 'NEW', 'the running copy is left alone');
  assert.ok(!fs.existsSync(`${dst}.new`));
  assert.match(lines[0], /replaced/);
  // a missing source is not a lock: give up right away instead of retrying for minutes
  const t0 = Date.now();
  const bad = await replaceExe(path.join(dir, 'nope.exe'), dst, { waitMs: 1000 });
  assert.equal(bad.ok, false);
  assert.equal(bad.error.code, 'ENOENT');
  assert.ok(Date.now() - t0 < 500);
});

function fakeUpdater(body, extra = {}) {
  const sha = crypto.createHash('sha256').update(body).digest('hex');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-flow-'));
  const exe = path.join(dir, 'CursorVerse.exe');
  fs.writeFileSync(exe, 'OLD');
  const spawned = [];
  const shown = [];
  const releases = [{ tag_name: 'cursorverse-v2.0.0', assets: [{ name: 'CursorVerse-2.0.0-Portable.exe', browser_download_url: 'mem://exe', size: body.length, digest: `sha256:${sha}` }] }];
  const fetchImpl = async (url) => (url === 'mem://exe'
    ? new Response(body, { headers: { 'content-length': String(body.length) } })
    : new Response(JSON.stringify(releases)));
  const u = new Updater({
    fetch: fetchImpl, currentVersion: '1.0.0', exePath: exe, downloadDir: path.join(dir, 'updates'), platform: 'win32',
    spawn: (file, args, opts) => { spawned.push({ file, args, opts }); return { unref() {}, on() {} }; },
    showFile: (f) => shown.push(f), handoverTimeoutMs: 80, ...extra,
  });
  return { u, exe, spawned, shown, dir };
}

test('update starts the new exe with the old path, and waits for it to knock', async () => {
  const body = crypto.randomBytes(5000);
  const { u, exe, spawned, shown } = fakeUpdater(body);
  const st = await u.updateNow();
  assert.equal(st.status, 'installing');
  assert.equal(spawned.length, 1);
  assert.deepEqual(fs.readFileSync(spawned[0].file), body);
  assert.deepEqual(spawned[0].args, [`--cv-finish-update=${exe}`]);
  assert.equal(spawned[0].opts.detached, true);
  assert.equal(spawned[0].opts.env.PORTABLE_EXECUTABLE_FILE, undefined);
  u.handedOver();
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(u.state.status, 'installing', 'no error once the new copy is running');
  assert.equal(shown.length, 0);
  assert.equal(fs.readFileSync(exe, 'utf8'), 'OLD', 'the old copy never touches its own exe');
});

test('if the new exe never starts, you get told and the file is shown', async () => {
  const { u, spawned, shown } = fakeUpdater(crypto.randomBytes(100));
  await u.updateNow();
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(u.state.status, 'error');
  assert.match(u.state.error, /didn't let it start/);
  assert.deepEqual(shown, [spawned[0].file]);
});

test('a spawn that throws (blocked by antivirus) is reported, not silent', async () => {
  const { u, shown } = fakeUpdater(crypto.randomBytes(100), { spawn: () => { throw new Error('EACCES'); } });
  const st = await u.updateNow();
  assert.equal(st.status, 'error');
  assert.match(st.error, /EACCES/);
  assert.equal(shown.length, 1);
});
