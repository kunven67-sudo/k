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
