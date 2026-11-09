// Lists apps with open windows (for the "only these apps" picker) and decides
// whether the app in front is one of the chosen ones.
const { execFile } = require('child_process');
const path = require('path');

const COMMON_APPS = [
  { exe: 'chrome.exe', name: 'Google Chrome' },
  { exe: 'msedge.exe', name: 'Microsoft Edge' },
  { exe: 'firefox.exe', name: 'Firefox' },
  { exe: 'opera.exe', name: 'Opera / Opera GX' },
  { exe: 'discord.exe', name: 'Discord' },
  { exe: 'spotify.exe', name: 'Spotify' },
  { exe: 'steam.exe', name: 'Steam' },
  { exe: 'robloxplayerbeta.exe', name: 'Roblox' },
  { exe: 'javaw.exe', name: 'Minecraft (Java)' },
  { exe: 'minecraft.windows.exe', name: 'Minecraft (Bedrock)' },
  { exe: 'fortniteclient-win64-shipping.exe', name: 'Fortnite' },
  { exe: 'code.exe', name: 'VS Code' },
  { exe: 'explorer.exe', name: 'File Explorer / Desktop' },
  { exe: 'notepad.exe', name: 'Notepad' },
  { exe: 'winword.exe', name: 'Word' },
  { exe: 'excel.exe', name: 'Excel' },
];

function exeName(p) {
  return p ? path.win32.basename(String(p)).toLowerCase() : '';
}

function listRunningApps() {
  if (process.platform !== 'win32') return Promise.resolve([]);
  const cmd = "Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle } | Select-Object ProcessName,MainWindowTitle,Path | ConvertTo-Json -Compress";
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', cmd], { windowsHide: true, timeout: 15000, maxBuffer: 4 << 20 }, (err, stdout) => {
      if (err) { resolve([]); return; }
      let rows;
      try { rows = JSON.parse(stdout || '[]'); } catch { resolve([]); return; }
      if (!Array.isArray(rows)) rows = [rows];
      const seen = new Map();
      for (const r of rows) {
        const exe = exeName(r.Path) || `${String(r.ProcessName || '').toLowerCase()}.exe`;
        if (!exe || exe === '.exe' || seen.has(exe)) continue;
        seen.set(exe, { exe, name: r.MainWindowTitle || r.ProcessName, path: r.Path || null });
      }
      resolve([...seen.values()].sort((a, b) => a.name.localeCompare(b.name)));
    });
  });
}

// target: { mode: 'all'|'apps', apps: [{exe}] }. ownExe = CursorVerse's own exe (always allowed).
function targetAllows(target, foregroundPath, ownExes = []) {
  if (!target || target.mode !== 'apps') return true;
  const exe = exeName(foregroundPath);
  if (!exe) return false;
  if (ownExes.includes(exe)) return true;
  return (target.apps || []).some((a) => exeName(a.exe) === exe);
}

module.exports = { COMMON_APPS, listRunningApps, targetAllows, exeName };
