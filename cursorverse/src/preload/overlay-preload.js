// Bridge for the effects overlay and the voice bubble.
const { contextBridge, ipcRenderer } = require('electron');

const listen = (ch) => (fn) => ipcRenderer.on(ch, (e, data) => fn(data));

contextBridge.exposeInMainWorld('fx', {
  onConfig: listen('fx:config'),
  onPos: listen('fx:pos'),
  onClick: listen('fx:click'),
  onVisible: listen('fx:visible'),
  onHud: listen('hud:state'),
});
