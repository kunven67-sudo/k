// Screenshot of the control panel (with one card shown as running).
const path = require('path'), fs = require('fs');
module.exports = async ({ app, getPanel }) => {
  const p = getPanel(); p.show(); await new Promise(r => setTimeout(r, 2500));
  p.webContents.send('effect-state', [{ id: 'fire', left: 3.2, dur: 5 }]);
  await new Promise(r => setTimeout(r, 400));
  fs.writeFileSync(path.join(__dirname, 'shots', 'panel.png'), (await p.webContents.capturePage()).toPNG());
  app.exit(0);
};
