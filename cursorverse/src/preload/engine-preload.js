// Bridge for the hidden engine window (sounds, music, cursor building).
const { contextBridge, ipcRenderer } = require('electron');

const listen = (ch) => (fn) => ipcRenderer.on(ch, (e, data) => fn(data));

contextBridge.exposeInMainWorld('engine', {
  ready: () => ipcRenderer.send('engine:ready'),
  log: (m) => ipcRenderer.send('engine:log', String(m)),
  cursorBuilt: (msg) => ipcRenderer.send('cursor:built', msg),
  musicState: (st) => ipcRenderer.send('music:state', st),
  onSettings: listen('settings'),
  onMyCursors: listen('mycursors'),
  onKey: listen('key'),
  onKeyUp: listen('keyup'),
  onMouse: listen('mouse'),
  onBuild: listen('cursor:build'),
  onMusic: listen('music:cmd'),
});
