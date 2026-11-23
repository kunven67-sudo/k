// After the crash: is the mouse free and the cursor visible again?
const W = require('../win32')();
const c = W.getClip(); const pics = W.captureCursors(); let solid = 0;
if (pics.arrow) { const px = Buffer.from(pics.arrow.rgba, 'base64'); for (let i = 3; i < px.length; i += 4) if (px[i] > 128) solid++; }
const free = c.r - c.x > 800; console.log(JSON.stringify({ clip: c, arrowSolidPixels: solid, mouseFree: free, cursorVisible: solid > 30 }));
process.exit(free && solid > 30 ? 0 : 1);
