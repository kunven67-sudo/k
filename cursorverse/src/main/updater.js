// One-click updates for the portable exe.
// New versions are published as GitHub Releases (tag "cursorverse-vX.Y.Z" with
// the portable exe attached). We download the exe, check its SHA-256 against
// the one GitHub reports, then a tiny PowerShell script swaps it in once this
// copy has exited and starts the new one.
const { EventEmitter } = require('events');
const fs = require('fs');
const os = require('os');
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

// Replaces dst with src once dst is no longer in use, then starts it.
const SWAP_SCRIPT = `param([string]$Src, [string]$Dst, [switch]$NoLaunch)
$ErrorActionPreference = 'SilentlyContinue'
# The running exe is locked until CursorVerse has fully closed, so keep trying.
$ok = $false
for ($i = 0; $i -lt 240 -and -not $ok; $i++) {
  try { Copy-Item -LiteralPath $Src -Destination $Dst -Force -ErrorAction Stop; $ok = $true }
  catch { Start-Sleep -Milliseconds 500 }
}
if ($ok) { Remove-Item -LiteralPath $Src -Force }
if (-not $NoLaunch) { Start-Process -FilePath $Dst }
`;

function writeSwapScript(dir = os.tmpdir()) {
  const file = path.join(dir, 'cursorverse-update.ps1');
  fs.writeFileSync(file, SWAP_SCRIPT);
  return file;
}

class Updater extends EventEmitter {
  // deps: { fetch, currentVersion, exePath (portable exe or null), downloadDir, quit() }
  constructor(deps) {
    super();
    this.deps = deps;
    this.latest = null;
    this.state = { status: 'idle', current: deps.currentVersion, latest: null, progress: 0, error: null };
  }

  get supported() {
    return process.platform === 'win32' && !!this.deps.exePath;
  }

  set(patch) {
    this.state = { ...this.state, ...patch };
    this.emit('state', this.state);
  }

  async check() {
    if (['downloading', 'installing'].includes(this.state.status)) return this.state;
    this.set({ status: 'checking', error: null });
    try {
      const res = await this.deps.fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'CursorVerse-Updater' },
      });
      if (!res.ok) throw new Error(`GitHub said ${res.status}`);
      const latest = pickLatest(await res.json());
      this.latest = latest;
      const newer = latest && compareVersions(latest.version, this.deps.currentVersion) > 0;
      this.set({
        status: newer ? 'available' : 'up-to-date',
        latest: latest?.version || null,
        notes: newer ? latest.notes : '',
        checkedAt: Date.now(),
      });
    } catch (err) {
      this.set({ status: 'error', error: `Could not check for updates: ${err.message}` });
    }
    return this.state;
  }

  async updateNow() {
    if (!this.supported) {
      this.set({ status: 'error', error: 'Updating works from the CursorVerse .exe on Windows.' });
      return this.state;
    }
    if (this.state.status !== 'available') await this.check();
    if (this.state.status !== 'available') return this.state;
    const info = this.latest;
    this.set({ status: 'downloading', progress: 0, error: null });
    let result;
    try {
      const dest = path.join(this.deps.downloadDir, `CursorVerse-${info.version}-Portable.exe`);
      result = await downloadVerified(this.deps.fetch, info, dest, (p) => this.set({ progress: p }));
    } catch (err) {
      this.set({ status: 'available', error: `Update download failed: ${err.message}` });
      return this.state;
    }
    this.set({ status: 'installing', progress: 1 });
    try {
      const script = writeSwapScript();
      const child = spawn('powershell.exe', [
        '-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden',
        '-File', script, '-Src', result.file, '-Dst', this.deps.exePath,
      ], { detached: true, stdio: 'ignore', windowsHide: true });
      child.unref();
    } catch (err) {
      this.set({ status: 'error', error: `Could not start the update: ${err.message}` });
      return this.state;
    }
    // give the UI a moment to show "restarting", then get out of the way
    setTimeout(() => this.deps.quit(), 800);
    return this.state;
  }
}

module.exports = { Updater, compareVersions, parseVersion, pickLatest, downloadVerified, SWAP_SCRIPT, writeSwapScript, REPO, TAG_PREFIX };
