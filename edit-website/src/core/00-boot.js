/* Edit Website - the editor itself.
   tools/build.mjs glues every file in src/core/ (in name order) into ONE
   function: (function EW(){ ...all files... })();  so they share one scope.
   The same code runs as the bookmark button, inside the Chrome extension,
   and inside pages you download from the editor ("player" mode). */

var W = window, D = document, HTML = D.documentElement;
var ENV = W.__EW_ENV || {};
var KIND = ENV.kind || (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id ? 'extension' : 'bookmarklet');
var VERSION = '1.0.0';
var SELF = EW; // the wrapper function; downloaded pages get a copy of it

// Clicking the bookmark again just opens/closes the editor.
if (W.__EW && W.__EW.alive) { W.__EW.toggle(); return; }

// Another copy already owns this page from a different JS world (the
// extension, or the editor built into a downloaded page). Don't make a
// second editor, just pass open/close over to it.
if (HTML.getAttribute('data-ew-alive')) {
  W.__EW = { alive: true, remote: true, toggle: function () { D.dispatchEvent(new CustomEvent('ew-toggle')); } };
  if (KIND === 'extension') listenExtension();
  else W.__EW.toggle();
  return;
}
