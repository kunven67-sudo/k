/* Game System 2.0 Save Kit — lets this game continue exactly where you left off.
   Inside Game System 2.0 the real kit is already loaded and this does nothing.
   Outside of it, this small backup version saves to the browser instead. */
window.GameSystem = window.GameSystem || (function () {
  var KEY = 'gs2save:' + location.pathname;
  var getState = null;
  function write() {
    if (!getState) return;
    try { localStorage.setItem(KEY, JSON.stringify(getState())); } catch (e) {}
  }
  window.addEventListener('pagehide', write);
  document.addEventListener('visibilitychange', function () { if (document.hidden) write(); });
  return {
    inSystem: false,
    load: function () { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } },
    hasSave: function () { try { return localStorage.getItem(KEY) !== null; } catch (e) { return false; } },
    save: function (state) { try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch (e) { return false; } },
    autoSave: function (fn, seconds) { getState = fn; setInterval(write, (seconds || 5) * 1000); return this; },
    saveNow: function () { write(); },
    clear: function () { try { localStorage.removeItem(KEY); } catch (e) {} },
    onPause: function () {}, onResume: function () {}, toast: function () {}, quit: function () {}
  };
})();
