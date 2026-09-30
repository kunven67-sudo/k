// Game files (humans, animations, textures) come as one .pak next to the release,
// downloaded once into the settings folder, checked against its SHA-256, and
// unpacked. Later starts skip all of this unless the pack changed.
const fs = require('fs');
const path = require('path');
const { downloadVerified } = require('./updater.cjs');

const MAGIC = 'THPAK001';
const MARKER = '.pack-sha256';

function readIndex(fd) {
  const header = Buffer.alloc(12);
  fs.readSync(fd, header, 0, 12, 0);
  if (header.toString('ascii', 0, 8) !== MAGIC) throw new Error('not a game asset pack');
  const len = header.readUInt32LE(8);
  const buf = Buffer.alloc(len);
  fs.readSync(fd, buf, 0, len, 12);
  return { index: JSON.parse(buf.toString('utf8')), dataStart: 12 + len };
}

// Unpacks into dest (via a temp folder, swapped in at the end so a half-unpacked
// folder is never used). Paths can't escape dest.
async function unpack(pakFile, dest, onProgress) {
  const tmp = `${dest}.unpacking`;
  await fs.promises.rm(tmp, { recursive: true, force: true });
  const fd = fs.openSync(pakFile, 'r');
  try {
    const { index, dataStart } = readIndex(fd);
    const total = index.files.reduce((n, f) => n + f.size, 0) || 1;
    let done = 0;
    for (const f of index.files) {
      const out = path.normalize(path.join(tmp, f.path));
      if (!out.startsWith(path.normalize(tmp + path.sep))) throw new Error(`bad path in pack: ${f.path}`);
      await fs.promises.mkdir(path.dirname(out), { recursive: true });
      if (f.size === 0) { await fs.promises.writeFile(out, ''); continue; } // empty file: nothing to read
      await new Promise((resolve, reject) => {
        const rs = fs.createReadStream(null, { fd, autoClose: false, start: dataStart + f.offset, end: dataStart + f.offset + f.size - 1 });
        const ws = fs.createWriteStream(out);
        rs.on('error', reject);
        ws.on('error', reject);
        ws.on('finish', resolve);
        rs.pipe(ws);
      });
      done += f.size;
      onProgress?.(done / total);
    }
  } finally {
    fs.closeSync(fd);
  }
  await fs.promises.rm(dest, { recursive: true, force: true });
  await fs.promises.rename(tmp, dest);
}

// expected: { file, size, sha256 } (bundled assets-pack.json); baseUrl: where the .pak lives
async function ensureAssets({ fetch, dir, expected, baseUrl, onProgress, log = () => {} }) {
  const marker = path.join(dir, MARKER);
  try {
    if (fs.readFileSync(marker, 'utf8').trim() === expected.sha256) return { dir, fresh: false };
  } catch { /* not unpacked yet */ }
  const pak = path.join(path.dirname(dir), expected.file);
  log(`assets: downloading ${expected.file} (${expected.size} bytes)`);
  if (!fs.existsSync(pak) || fs.statSync(pak).size !== expected.size) {
    await downloadVerified(fetch, { url: `${baseUrl}/${expected.file}`, size: expected.size, sha256: expected.sha256 }, pak,
      (p) => onProgress?.({ stage: 'download', progress: p }));
  }
  log('assets: unpacking');
  await unpack(pak, dir, (p) => onProgress?.({ stage: 'unpack', progress: p }));
  fs.writeFileSync(marker, expected.sha256);
  await fs.promises.rm(pak, { force: true });
  log('assets: ready');
  return { dir, fresh: true };
}

module.exports = { ensureAssets, unpack, readIndex, MAGIC };
