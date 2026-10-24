// APEX WIDOW entry point
const q = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
function hideBoot() { const b = document.getElementById('boot'); if (!b) return; if (q.get('shot')) { b.remove(); return; } b.style.opacity = '0'; setTimeout(() => b.remove(), 900); }
window.addEventListener('error', (e) => { const m = document.getElementById('bootmsg'); if (m) m.textContent = 'error: ' + e.message; });
(async () => {
  if (q.get('test') === 'spider') {
    const { spiderLab } = await import('./dev/spiderlab.js');
    await spiderLab(canvas, q); hideBoot(); return;
  }
  const { startGame } = await import('./game/boot.js');
  await startGame(canvas, q, hideBoot);
})();
