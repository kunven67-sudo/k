// Safety guard: a tiny helper process. If MOUSE HAZARD dies for ANY reason, this puts the real cursor back and frees the mouse.
'use strict';
const W = require('./win32')();
const parent = process.ppid;
let done = false;
function fix() {
  if (done) return; done = true;
  try { W.clip(null); } catch (e) {}
  try { W.restoreAll(); } catch (e) {}
  process.exit(0);
}
process.on('disconnect', fix);
setInterval(() => { try { process.kill(parent, 0); } catch (e) { fix(); } }, 300);
process.on('message', m => { if (m === 'bye') { done = true; process.exit(0); } });
