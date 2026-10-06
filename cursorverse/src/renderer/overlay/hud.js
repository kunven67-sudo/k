// Voice feedback bubble ("Did you say P?").
const ICONS = { listening: '👂', confirm: '🤔', done: '✅', cancel: '❌', error: '⚠️', unsure: '🤷', info: '🎤' };
window.fx.onHud((s) => {
  const b = document.getElementById('b');
  b.className = `bubble ${s.kind || ''}`;
  void b.offsetWidth; // restart the pop animation
  document.getElementById('i').textContent = ICONS[s.kind] || '🎤';
  document.getElementById('t').textContent = s.text || '';
  document.getElementById('h').textContent = s.hint || '';
});
