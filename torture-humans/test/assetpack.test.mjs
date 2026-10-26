import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pack } from '../tools/pack_assets.mjs';

const require = createRequire(import.meta.url);
const { ensureAssets, unpack } = require('../electron/assetpack.cjs');

function tree() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'th-src-'));
  fs.mkdirSync(path.join(dir, 'anims'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'cc0', 'textures', 'x'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'anims', 'm_walk.glb'), Buffer.from('walk-data'));
  fs.writeFileSync(path.join(dir, 'cc0', 'textures', 'x', 'color.jpg'), Buffer.alloc(300000, 7));
  fs.writeFileSync(path.join(dir, 'empty.txt'), '');
  fs.writeFileSync(path.join(dir, 'manifest.json'), '{"a":1}');
  return dir;
}

test('pack -> unpack gives back the same files', async () => {
  const src = tree();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'th-pak-'));
  const pak = path.join(out, 'a.pak');
  const info = await pack(src, pak);
  assert.equal(info.files, 4);
  const dest = path.join(out, 'assets');
  await unpack(pak, dest);
  for (const rel of ['anims/m_walk.glb', 'cc0/textures/x/color.jpg', 'empty.txt', 'manifest.json']) {
    assert.deepEqual(fs.readFileSync(path.join(dest, rel)), fs.readFileSync(path.join(src, rel)), rel);
  }
});

test('ensureAssets downloads once, verifies, then skips', async () => {
  const src = tree();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'th-pak-'));
  const pakPath = path.join(out, 'served.pak');
  const info = await pack(src, pakPath);
  const bytes = fs.readFileSync(pakPath);
  let downloads = 0;
  const fetchImpl = async (url) => { downloads++; assert.match(url, /\/TH-assets-abc\.pak$/); return new Response(bytes, { headers: { 'content-length': String(bytes.length) } }); };
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'th-home-'));
  const expected = { file: 'TH-assets-abc.pak', size: info.size, sha256: info.sha256 };
  const r1 = await ensureAssets({ fetch: fetchImpl, dir: path.join(home, 'game-assets'), expected, baseUrl: 'https://x/rel' });
  assert.equal(r1.fresh, true);
  assert.equal(fs.readFileSync(path.join(home, 'game-assets', 'anims', 'm_walk.glb'), 'utf8'), 'walk-data');
  assert.ok(!fs.existsSync(path.join(home, 'TH-assets-abc.pak')), 'pack deleted after unpacking');
  const r2 = await ensureAssets({ fetch: fetchImpl, dir: path.join(home, 'game-assets'), expected, baseUrl: 'https://x/rel' });
  assert.equal(r2.fresh, false);
  assert.equal(downloads, 1);
});

test('a damaged download is refused and nothing is unpacked', async () => {
  const src = tree();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'th-pak-'));
  const pakPath = path.join(out, 'served.pak');
  const info = await pack(src, pakPath);
  const bytes = fs.readFileSync(pakPath);
  bytes[bytes.length - 1] ^= 0xff;
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'th-home-'));
  await assert.rejects(ensureAssets({
    fetch: async () => new Response(bytes, { headers: { 'content-length': String(bytes.length) } }),
    dir: path.join(home, 'game-assets'), expected: { file: 'p.pak', size: info.size, sha256: info.sha256 }, baseUrl: 'https://x',
  }), /damaged/);
  assert.ok(!fs.existsSync(path.join(home, 'game-assets')));
});
