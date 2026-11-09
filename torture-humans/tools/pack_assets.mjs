// Packs the asset folder into one .pak file (so the .exe stays small and starts fast).
//   node tools/pack_assets.mjs <assets dir> <out dir> [name prefix]
// Format: "THPAK001" | uint32 LE index length | index JSON | file bytes back to back.
// Index: { files: [{ path, offset, size }] } (offsets relative to the data start).
// Writes <out>/TortureHumans-assets-<sha12>.pak and <out>/assets-pack.json
// ({ file, size, sha256, files }) which the app bundles to know what to download.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const MAGIC = 'THPAK001';

export function listFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== '.git') walk(p); }
      else if (e.isFile()) out.push(p);
    }
  };
  walk(dir);
  return out;
}

export async function pack(srcDir, outFile) {
  const files = listFiles(srcDir);
  let offset = 0;
  const index = { files: files.map((f) => {
    const size = fs.statSync(f).size;
    const rec = { path: path.relative(srcDir, f).split(path.sep).join('/'), offset, size };
    offset += size;
    return rec;
  }) };
  const indexBuf = Buffer.from(JSON.stringify(index));
  const header = Buffer.alloc(12);
  header.write(MAGIC, 0, 'ascii');
  header.writeUInt32LE(indexBuf.length, 8);
  const hash = crypto.createHash('sha256');
  const out = fs.createWriteStream(outFile);
  const write = (buf) => new Promise((resolve, reject) => {
    hash.update(buf);
    if (out.write(buf)) resolve(); else out.once('drain', resolve);
    out.once('error', reject);
  });
  await write(header);
  await write(indexBuf);
  for (const f of files) {
    for await (const chunk of fs.createReadStream(f, { highWaterMark: 1 << 20 })) await write(chunk);
  }
  await new Promise((r) => out.end(r));
  return { sha256: hash.digest('hex'), size: fs.statSync(outFile).size, files: files.length };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('pack_assets.mjs')) {
  const [src, outDir, prefix = 'TortureHumans-assets'] = process.argv.slice(2);
  if (!src || !outDir) { console.error('usage: pack_assets.mjs <assets dir> <out dir>'); process.exit(2); }
  fs.mkdirSync(outDir, { recursive: true });
  const tmp = path.join(outDir, `${prefix}.tmp.pak`);
  const info = await pack(src, tmp);
  const file = `${prefix}-${info.sha256.slice(0, 12)}.pak`;
  fs.renameSync(tmp, path.join(outDir, file));
  const meta = { file, ...info };
  fs.writeFileSync(path.join(outDir, 'assets-pack.json'), JSON.stringify(meta, null, 1));
  console.log(`packed ${info.files} files, ${(info.size / 1e6).toFixed(1)} MB -> ${file}`);
}
