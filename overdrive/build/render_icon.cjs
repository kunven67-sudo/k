// Render overdrive/ui/logo.svg to a 256x256 PNG for the Windows exe icon (uses the installed Chromium).
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
(async () => {
  const svg = fs.readFileSync(path.join(__dirname, "..", "overdrive", "ui", "logo.svg"), "utf8");
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 256, height: 256 }, deviceScaleFactor: 1 });
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace("<svg ", '<svg width="256" height="256" ')}</body></html>`);
  await p.screenshot({ path: process.argv[2], omitBackground: true, clip: { x: 0, y: 0, width: 256, height: 256 } });
  await b.close();
})();
