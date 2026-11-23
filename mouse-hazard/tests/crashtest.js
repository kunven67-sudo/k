// Crash check: lock + hide the mouse, then get killed hard. The guard must free the mouse and bring the cursor back.
'use strict';
module.exports = async ({ W }) => {
  await new Promise(r => setTimeout(r, 2500));
  W.hideAll(); W.clip({ x: 10, y: 10, w: 4, h: 4 });
  setTimeout(() => process.kill(process.pid, 'SIGKILL'), 300);
};
