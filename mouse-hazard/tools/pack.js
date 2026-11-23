// Builds the Windows app folder + zip from the Electron Windows zip. Works on Linux and Windows.
// node tools/pack.js <electron-win32-x64.zip> <outDir>
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const [zipIn, outDir] = process.argv.slice(2);
const pkg = require(path.join(ROOT, 'package.json'));
const NAME = 'MOUSE HAZARD';
const dir = path.join(outDir, NAME);
fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
if (process.platform === 'win32') cp.execSync(`tar -xf "${path.resolve(zipIn)}" -C "${dir}"`, { stdio: 'inherit' });
else cp.execSync(`unzip -qo "${zipIn}" -d "${dir}"`);
// only English language file (smaller)
const loc = path.join(dir, 'locales'); fs.readdirSync(loc).forEach(f => { if (!/^en-US\.pak$/.test(f)) fs.rmSync(path.join(loc, f)); });
fs.rmSync(path.join(dir, 'resources', 'default_app.asar'), { force: true });
fs.rmSync(path.join(dir, 'LICENSES.chromium.html'), { force: true });
// the app itself
const app = path.join(dir, 'resources', 'app'); fs.mkdirSync(app, { recursive: true });
const copy = (rel) => fs.cpSync(path.join(ROOT, rel), path.join(app, rel), { recursive: true });
['main.js', 'guard.js', 'win32.js', 'overlay.html', 'overlay.js', 'effects.js', 'panel.html', 'engine', 'assets'].forEach(copy);
fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({ name: 'mouse-hazard', productName: NAME, version: pkg.version, main: 'main.js' }, null, 1));
// koffi: only the Windows 64-bit part
const kSrc = path.join(ROOT, 'node_modules', 'koffi'), kDst = path.join(app, 'node_modules', 'koffi');
fs.mkdirSync(kDst, { recursive: true });
for (const f of fs.readdirSync(kSrc)) { if (f === 'build' || f === 'src' || f === 'vendor' || f === 'doc') continue; fs.cpSync(path.join(kSrc, f), path.join(kDst, f), { recursive: true }); }
fs.cpSync(path.join(kSrc, 'build', 'koffi', 'win32_x64'), path.join(kDst, 'build', 'koffi', 'win32_x64'), { recursive: true });
// exe: name, icon, version info
const exeOld = path.join(dir, 'electron.exe'), exe = path.join(dir, NAME + '.exe');
fs.renameSync(exeOld, exe);
try {
  const ResEdit = require('resedit');
  const data = fs.readFileSync(exe);
  const ex = ResEdit.NtExecutable.from(data, { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(ex);
  const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(ROOT, 'assets', 'icon.ico')));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const gid = groups.length ? groups[0].id : 1, lang = groups.length ? groups[0].lang : 1033;
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, gid, lang, ico.icons.map(i => i.data));
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
  if (vi) {
    const v = pkg.version.split('.').map(Number);
    vi.setFileVersion(v[0], v[1], v[2], 0, 1033); vi.setProductVersion(v[0], v[1], v[2], 0, 1033);
    vi.setStringValues({ lang: 1033, codepage: 1200 }, { FileDescription: NAME, ProductName: NAME, InternalName: NAME, OriginalFilename: NAME + '.exe', CompanyName: 'MOUSE HAZARD', LegalCopyright: '' });
    vi.outputToResourceEntries(res.entries);
  }
  res.outputResource(ex);
  fs.writeFileSync(exe, Buffer.from(ex.generate()));
  console.log('icon + version set');
} catch (e) { console.log('could not set icon:', e.message); }
console.log('built', dir);
