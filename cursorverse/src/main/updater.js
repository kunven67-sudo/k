// One-click updates for the portable exe.
// New versions are published as GitHub Releases (tag "cursorverse-vX.Y.Z" with
// the portable exe attached). We download the exe, check its SHA-256 against
// the one GitHub reports, then start it. The new version takes over from this
// copy and copies itself over the old exe once that file is no longer locked.
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const REPO = 'kunven67-sudo/k';
const TAG_PREFIX = 'cursorverse-v';
const ASSET_RE = /^CursorVerse-[\d.]+-Portable\.exe$/i;

function parseVersion(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(v || '').trim());
  return m ? m.slice(1).map(Number) : null;
}

// >0 when a is newer than b.
function compareVersions(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

// Picks the newest usable CursorVerse release from the GitHub API list.
function pickLatest(releases) {
  let best = null;
  for (const r of releases || []) {
    if (!r || r.draft || r.prerelease || !String(r.tag_name || '').startsWith(TAG_PREFIX)) continue;
    const version = r.tag_name.slice(TAG_PREFIX.length);
    if (!parseVersion(version)) continue;
    const asset = (r.assets || []).find((a) => ASSET_RE.test(a.name));
    if (!asset) continue;
    if (!best || compareVersions(version, best.version) > 0) {
      best = {
        version,
        notes: String(r.body || '').slice(0, 2000),
        url: asset.browser_download_url,
        size: asset.size,
        sha256: /^sha256:([0-9a-f]{64})$/i.exec(asset.digest || '')?.[1]?.toLowerCase() || null,
        page: r.html_url,
      };
    }
  }
  return best;
}

// Downloads url to dest, reporting progress 0..1, and verifies size + hash.
async function downloadVerified(fetchImpl, info, dest, onProgress) {
  const res = await fetchImpl(info.url, { headers: { 'User-Agent': 'CursorVerse-Updater' } });
  if (!res.ok || !res.body) throw new Error(`download failed (HTTP ${res.status})`);
  const total = Number(res.headers.get('content-length')) || info.size || 0;
  const part = `${dest}.part`;
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  const out = fs.createWriteStream(part);
  const hash = crypto.createHash('sha256');
  let got = 0;
  try {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      hash.update(chunk);
      got += chunk.length;
      if (!out.write(chunk)) await new Promise((r) => out.once('drain', r));
      if (total) onProgress?.(Math.min(1, got / total));
    }
    await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
  } catch (err) {
    out.destroy();
    await fs.promises.rm(part, { force: true });
    throw err;
  }
  const digest = hash.digest('hex');
  if (info.size && got !== info.size) {
    await fs.promises.rm(part, { force: true });
    throw new Error(`download was cut off (${got} of ${info.size} bytes)`);
  }
  if (info.sha256 && digest !== info.sha256) {
    await fs.promises.rm(part, { force: true });
    throw new Error('the downloaded file is damaged (checksum does not match), try again');
  }
  await fs.promises.rename(part, dest);
  return { file: dest, sha256: digest, bytes: got };
}

const FINISH_FLAG = '--cv-finish-update=';

// The "--cv-finish-update=<old exe>" argument, if this copy was started by an update.
function finishTarget(argv) {
  const arg = (argv || []).find((a) => String(a).startsWith(FINISH_FLAG));
  return arg ? String(arg).slice(FINISH_FLAG.length).replace(/^"|"$/g, '') || null : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Run by the NEW version: copies itself over the old exe. The old exe is locked
// until the old CursorVerse has fully closed, so keep trying for a while.
// Copies to "<target>.new" first, then renames, so the old file is never half-written.
async function replaceExe(src, target, { tries = 360, waitMs = 500, log = () => {} } = {}) {
  const tmp = `${target}.new`;
  let lastErr = null;
  for (let i = 0; i < tries; i++) {
    try {
      await fs.promises.copyFile(src, tmp);
      await fs.promises.rename(tmp, target);
      log(`replaced ${target} (try ${i + 1})`);
      return { ok: true, tries: i + 1 };
    } catch (err) {
      lastErr = err;
      if (!['EBUSY', 'EPERM', 'EACCES', 'ETXTBSY'].includes(err.code)) break; // not a lock: retrying won't help
      await sleep(waitMs);
    }
  }
  await fs.promises.rm(tmp, { force: true }).catch(() => {});
  log(`could not replace ${target}: ${lastErr?.code || ''} ${lastErr?.message || ''}`);
  return { ok: false, error: lastErr };
}

// The env for the new copy: never pass on our own portable paths or test-only overrides.
function childEnv(env) {
  const out = { ...env };
  for (const k of ['PORTABLE_EXECUTABLE_FILE', 'PORTABLE_EXECUTABLE_DIR', 'PORTABLE_EXECUTABLE_APP_FILENAME', 'CV_FAKE_VERSION', 'CV_AUTO_UPDATE', 'ELECTRON_RUN_AS_NODE']) delete out[k];
  return out;
}

class Updater extends EventEmitter {
  // deps: { fetch, currentVersion, exePath (the exe to replace, or null), downloadDir,
  //         spawn?, feedUrl?, log?(line), handoverTimeoutMs?, showFile?(path) }
  constructor(deps) {
    super();
    this.deps = deps;
    this.latest = null;
    this.handoverTimer = null;
    this.state = { status: 'idle', current: deps.currentVersion, latest: null, progress: 0, error: null };
  }

  get supported() {
    return (this.deps.platform || process.platform) === 'win32' && !!this.deps.exePath;
  }

  log(line) {
    try { this.deps.log?.(line); } catch { /* ignore */ }
  }

  set(patch) {
    this.state = { ...this.state, ...patch };
    this.emit('state', this.state);
  }

  async check() {
    if (['downloading', 'installing'].includes(this.state.status)) return this.state;
    this.set({ status: 'checking', error: null });
    try {
      const res = await this.deps.fetch(this.deps.feedUrl || `https://api.github.com/repos/${REPO}/releases?per_page=30`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'CursorVerse-Updater' },
      });
      if (!res.ok) throw new Error(`GitHub said ${res.status}`);
      const latest = pickLatest(await res.json());
      this.latest = latest;
      const newer = latest && compareVersions(latest.version, this.deps.currentVersion) > 0;
      this.log(`check: have ${this.deps.currentVersion}, newest ${latest?.version || 'none'}`);
      this.set({
        status: newer ? 'available' : 'up-to-date',
        latest: latest?.version || null,
        notes: newer ? latest.notes : '',
        checkedAt: Date.now(),
      });
    } catch (err) {
      this.log(`check failed: ${err.message}`);
      this.set({ status: 'error', error: `Could not check for updates: ${err.message}` });
    }
    return this.state;
  }

  async updateNow() {
    if (!this.supported) {
      this.set({ status: 'error', error: 'Updating works from the CursorVerse .exe on Windows.' });
      return this.state;
    }
    if (['downloading', 'installing'].includes(this.state.status)) return this.state;
    if (this.state.status !== 'available') await this.check();
    if (this.state.status !== 'available') return this.state;
    const info = this.latest;
    const target = this.deps.exePath;
    // make sure the new version will be able to replace this file later
    try {
      await fs.promises.access(path.dirname(target), fs.constants.W_OK);
    } catch {
      this.set({ status: 'error', error: `CursorVerse can't write to the folder it's in (${path.dirname(target)}). Move the CursorVerse .exe to your Desktop or Downloads folder, then try again.` });
      return this.state;
    }
    this.set({ status: 'downloading', progress: 0, error: null });
    let result;
    try {
      const dest = path.join(this.deps.downloadDir, `CursorVerse-${info.version}-Portable.exe`);
      result = await downloadVerified(this.deps.fetch, info, dest, (p) => this.set({ progress: p }));
      this.log(`downloaded ${info.version} to ${result.file} (${result.bytes} bytes, sha256 ${result.sha256})`);
    } catch (err) {
      this.log(`download failed: ${err.message}`);
      this.set({ status: 'available', error: `Update download failed: ${err.message}` });
      return this.state;
    }
    this.set({ status: 'installing', progress: 1, file: result.file });
    // Start the new version. It knocks on this copy (second-instance), which
    // then closes, and it copies itself over the old exe. No hidden scripts.
    try {
      const child = (this.deps.spawn || spawn)(result.file, [`${FINISH_FLAG}${target}`], {
        detached: true, stdio: 'ignore', windowsHide: false, cwd: path.dirname(result.file), env: childEnv(process.env),
      });
      child.on?.('error', (err) => this.handoverFailed(result.file, err.message));
      child.unref?.();
      this.log(`started new version ${result.file}`);
    } catch (err) {
      this.handoverFailed(result.file, err.message);
      return this.state;
    }
    // if the new copy never shows up, say so instead of leaving you guessing
    clearTimeout(this.handoverTimer);
    this.handoverTimer = setTimeout(() => this.handoverFailed(result.file, 'it did not start within 90 seconds'), this.deps.handoverTimeoutMs || 90000);
    return this.state;
  }

  // Called when the new version knocked: it's running, so this copy can go.
  handedOver() {
    clearTimeout(this.handoverTimer);
    this.handoverTimer = null;
    this.log('new version is running, closing the old one');
  }

  handoverFailed(file, why) {
    if (this.state.status !== 'installing') return;
    clearTimeout(this.handoverTimer);
    this.handoverTimer = null;
    this.log(`new version did not start: ${why}`);
    this.set({
      status: 'error',
      error: `The new version downloaded fine, but Windows didn't let it start (${why}). Your antivirus may have blocked it. I opened the folder with it: double-click it to finish the update.`,
    });
    try { this.deps.showFile?.(file); } catch { /* ignore */ }
  }
}

module.exports = { Updater, compareVersions, parseVersion, pickLatest, downloadVerified, replaceExe, finishTarget, childEnv, FINISH_FLAG, REPO, TAG_PREFIX };
