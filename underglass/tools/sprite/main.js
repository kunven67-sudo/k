// Photographs real CC0 3D models (Poly Haven) from the side into game sprites.
// electron tools/sprite/main.js <modelsDir> <hdr> <outDir> <jobs.json>
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs'), path = require('path');
const [modelsDir, hdr, outDir, jobsFile] = process.argv.slice(-4);
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.whenReady().then(() => {
  fs.mkdirSync(outDir, { recursive: true });
  const w = new BrowserWindow({ show: false, width: 1100, height: 1100, webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false } });
  ipcMain.handle('cfg', () => ({ modelsDir, hdr, outDir, jobs: JSON.parse(fs.readFileSync(jobsFile, 'utf8')), three: path.join(__dirname, '../../node_modules/three') }));
  ipcMain.on('save', (e, f, b64) => fs.writeFileSync(path.join(outDir, f), Buffer.from(b64, 'base64')));
  ipcMain.on('log', (e, m) => console.log(m));
  ipcMain.on('done', () => app.quit());
  w.loadFile(path.join(__dirname, 'render.html'));
});
