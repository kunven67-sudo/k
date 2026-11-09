// Safe bridge between the CursorVerse UI page and the main process.
const { contextBridge, ipcRenderer } = require('electron');

const listen = (ch) => (fn) => {
  const h = (e, data) => fn(data);
  ipcRenderer.on(ch, h);
  return () => ipcRenderer.removeListener(ch, h);
};
const call = (ch) => (...args) => ipcRenderer.invoke(ch, ...args);

contextBridge.exposeInMainWorld('cv', {
  settings: { get: call('settings:get'), set: call('settings:set'), reset: call('settings:reset'), onChange: listen('settings:changed') },
  myCursors: { list: call('mycursors:list'), save: call('mycursors:save'), remove: call('mycursors:delete') },
  library: { import: call('library:import'), remove: call('library:remove') },
  apps: { list: call('apps:list'), pick: call('apps:pick') },
  history: {
    list: call('history:list'), clear: call('history:clear'), remove: call('history:delete'),
    add: (item) => ipcRenderer.send('history:add', item),
    title: (url, title) => ipcRenderer.send('history:title', { url, title }),
  },
  music: { cmd: (c) => ipcRenderer.send('music:cmd', c), state: call('music:state'), onState: listen('music:state') },
  presets: { apply: call('preset:apply'), random: call('random') },
  cursor: { restore: call('cursor:restore'), status: call('cursor:status'), onStatus: listen('cursor:status') },
  voice: {
    status: call('voice:status'), history: call('voice:history'), capturePtt: call('ptt:capture'),
    onStatus: listen('voice:status'), onLevel: listen('voice:level'), onCommand: listen('voice:command'), onHeard: listen('voice:heard'),
  },
  hotkeys: { status: call('hotkeys:status'), onStatus: listen('hotkeys:status'), suspend: call('hotkeys:suspend') },
  update: { state: call('update:state'), check: call('update:check'), install: call('update:install'), onState: listen('update:state') },
  app: { info: call('app:info'), quit: call('app:quit'), openDataFolder: call('app:openDataFolder'), titlebar: call('window:titlebar') },
  on: {
    openTab: listen('browser:open-tab'),
    browserShortcut: listen('browser:shortcut'),
    adblockCount: listen('adblock:count'),
    nav: listen('nav'),
  },
});
