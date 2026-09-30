// Safe bridge between the game page and the desktop shell.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('th', {
  desktop: true,
  info: () => ipcRenderer.invoke('app:info'),
  quit: () => ipcRenderer.invoke('app:quit'),
  fullscreen: (on) => ipcRenderer.invoke('app:fullscreen', on),
  assets: {
    ensure: () => ipcRenderer.invoke('assets:ensure'),
    onProgress: (fn) => {
      const h = (e, p) => fn(p);
      ipcRenderer.on('assets:progress', h);
      return () => ipcRenderer.removeListener('assets:progress', h);
    },
  },
  update: {
    state: () => ipcRenderer.invoke('update:state'),
    check: () => ipcRenderer.invoke('update:check'),
    install: () => ipcRenderer.invoke('update:install'),
    onState: (fn) => {
      const h = (e, st) => fn(st);
      ipcRenderer.on('update:state', h);
      return () => ipcRenderer.removeListener('update:state', h);
    },
  },
});
