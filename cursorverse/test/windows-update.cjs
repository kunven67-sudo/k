// Windows CI only: checks the update swap script waits while the old exe is
// still running (locked), then replaces it and cleans up the download.
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeSwapScript } = require('../src/main/updater');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-swap-'));
  const dst = path.join(dir, 'CursorVerse.exe');
  const src = path.join(dir, 'new.exe');
  fs.copyFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'PING.EXE'), dst);
  fs.writeFileSync(src, 'NEW VERSION BYTES');

  // run the "old" exe so Windows locks the file for a few seconds
  const old = spawn(dst, ['-n', '5', '127.0.0.1'], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 500));
  let lockedEarly = false;
  try { fs.writeFileSync(dst, 'x'); } catch { lockedEarly = true; }
  console.log('old exe locked while running:', lockedEarly);

  const t0 = Date.now();
  const script = writeSwapScript(dir);
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-Src', src, '-Dst', dst, '-NoLaunch'], { stdio: 'inherit' });
  const waited = Date.now() - t0;
  old.kill();

  const now = fs.readFileSync(dst, 'utf8');
  console.log(`swap finished after ${waited} ms; new content: ${JSON.stringify(now)}; download removed: ${!fs.existsSync(src)}`);
  if (now !== 'NEW VERSION BYTES') throw new Error('exe was not replaced');
  if (fs.existsSync(src)) throw new Error('downloaded file was not cleaned up');
  if (lockedEarly && waited < 2000) throw new Error('swap did not wait for the running exe');
  console.log('update swap works');
})().catch((err) => { console.error(err); process.exit(1); });
