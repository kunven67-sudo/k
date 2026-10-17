// Builds everything from src/:
//   edit-website.html            the page with the bookmark button (+ practice site)
//   extension/                   the Chrome extension folder
//   edit-website-extension.zip   the same folder, zipped for downloading
//   dist/core.js, dist/core.min.js
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { transformSync } from 'esbuild';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (...p) => join(ROOT, 'src', ...p);
const out = (...p) => join(ROOT, ...p);

const pkg = JSON.parse(readFileSync(out('package.json'), 'utf8'));
const files = readdirSync(src('core')).filter((f) => f.endsWith('.js')).sort();
const body = files.map((f) => `// ===== ${f} =====\n` + readFileSync(src('core', f), 'utf8')).join('\n');
if (!body.includes(`var VERSION = '${pkg.version}'`)) throw new Error('VERSION in 00-boot.js does not match package.json');

const core = `(function EW() {\n'use strict';\n${body}\n})();\n`;
const min = transformSync(core, { minify: true, target: 'es2019', charset: 'ascii', legalComments: 'none' }).code.trim();

mkdirSync(out('dist'), { recursive: true });
writeFileSync(out('dist', 'core.js'), core);
writeFileSync(out('dist', 'core.min.js'), min + '\n');

// A bookmark is a "javascript:" link. Browsers strip raw newlines/tabs from
// links and turn %xx into characters, so those get escaped.
const bookmarklet = 'javascript:' + min.replace(/[%\n\r\t]/g, (c) => encodeURIComponent(c)) + 'void 0';
const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const page = readFileSync(src('install.html'), 'utf8')
  .replaceAll('{{BOOKMARKLET}}', attr(bookmarklet))
  .replaceAll('{{VERSION}}', pkg.version)
  .replaceAll('{{SIZE_KB}}', String(Math.round(bookmarklet.length / 1024)));
writeFileSync(out('edit-website.html'), page);

// Chrome extension
const ext = out('extension');
rmSync(ext, { recursive: true, force: true });
mkdirSync(join(ext, 'icons'), { recursive: true });
const manifest = JSON.parse(readFileSync(src('extension', 'manifest.json'), 'utf8'));
manifest.version = pkg.version;
writeFileSync(join(ext, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
copyFileSync(src('extension', 'background.js'), join(ext, 'background.js'));
writeFileSync(join(ext, 'core.js'), core);
for (const s of [16, 32, 48, 128]) copyFileSync(src('extension', 'icons', `${s}.png`), join(ext, 'icons', `${s}.png`));

// zip it so the folder inside is called edit-website-extension/
const zipPath = out('edit-website-extension.zip');
const tmp = out('dist', 'zip');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(join(tmp, 'edit-website-extension', 'icons'), { recursive: true });
for (const f of ['manifest.json', 'background.js', 'core.js']) copyFileSync(join(ext, f), join(tmp, 'edit-website-extension', f));
for (const s of [16, 32, 48, 128]) copyFileSync(join(ext, 'icons', `${s}.png`), join(tmp, 'edit-website-extension', 'icons', `${s}.png`));
if (existsSync(zipPath)) rmSync(zipPath);
execFileSync('zip', ['-q', '-r', '-X', zipPath, 'edit-website-extension'], { cwd: tmp });
rmSync(tmp, { recursive: true, force: true });

console.log(`core: ${(core.length / 1024).toFixed(0)} KB, minified: ${(min.length / 1024).toFixed(0)} KB, bookmark: ${(bookmarklet.length / 1024).toFixed(0)} KB`);
console.log('built edit-website.html, extension/, edit-website-extension.zip');
