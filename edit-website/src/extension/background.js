// Edit Website - extension background.
// Opens/closes the editor on the current tab, and runs "your own JavaScript"
// for the editor in a way strict websites can't block.

async function toggle(tab) {
  if (!tab || tab.id == null) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { ew: 'toggle' });
    return;
  } catch (e) {
    // the page was open before the extension was installed: inject it now
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['core.js'] });
    await chrome.tabs.sendMessage(tab.id, { ew: 'toggle' });
  } catch (e) {
    // chrome:// pages, the Web Store, PDF viewer... Chrome doesn't allow editing those
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#ff5470' });
    chrome.action.setBadgeText({ tabId: tab.id, text: 'NO' });
    chrome.action.setTitle({ tabId: tab.id, title: 'Chrome doesn\'t let extensions edit this page' });
    setTimeout(() => {
      chrome.action.setBadgeText({ tabId: tab.id, text: '' });
      chrome.action.setTitle({ tabId: tab.id, title: 'Edit Website (Alt+Shift+E)' });
    }, 3000);
  }
}

chrome.action.onClicked.addListener(toggle);

chrome.commands.onCommand.addListener(async (cmd, tab) => {
  if (cmd !== 'toggle-editor') return;
  if (!tab) [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  toggle(tab);
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg && msg.ew === 'runjs' && sender.tab) {
    runJS(msg.code || '', { tabId: sender.tab.id, frameIds: [sender.frameId || 0] }).then(reply);
    return true;
  }
});

// Wrap the code so console.log output and errors come back to the editor.
function wrap(code) {
  return '(function(){var __l=[],__o=console.log;' +
    'console.log=function(){try{__l.push([].map.call(arguments,function(x){if(typeof x==="string")return x;try{return JSON.stringify(x)}catch(e){return String(x)}}).join(" "))}catch(e){}return __o.apply(console,arguments)};' +
    'try{var __r=(function(){\n' + code + '\n})();return{r:__r===undefined?undefined:String(__r),l:__l}}' +
    'catch(e){return{e:String(e&&e.message||e),l:__l}}finally{console.log=__o}})()';
}

const BLOCKED = '\n\nThis website blocks normal code. Turn on "Allow User Scripts" for Edit Website: open chrome://extensions, click Details on Edit Website, switch on "Allow User Scripts", then try again.';

async function runJS(code, target) {
  // 1) User scripts: runs on every site, even super strict ones
  if (chrome.userScripts && chrome.userScripts.execute) {
    try {
      const res = await chrome.userScripts.execute({ target, world: 'MAIN', js: [{ code: wrap(code) }] });
      const r = res && res[0] && res[0].result;
      if (r) return r;
    } catch (e) {
      // not allowed yet, fall through
    }
  }
  // 2) Normal way: works on most sites
  try {
    const res = await chrome.scripting.executeScript({
      target,
      world: 'MAIN',
      args: [code],
      func: (c) => {
        const logs = [], orig = console.log;
        console.log = function () {
          logs.push([].map.call(arguments, (x) => { if (typeof x === 'string') return x; try { return JSON.stringify(x); } catch (e) { return String(x); } }).join(' '));
          return orig.apply(console, arguments);
        };
        try {
          const r = (0, eval)(c);
          return { r: r === undefined ? undefined : String(r), l: logs };
        } catch (e) {
          return { e: String(e && e.message || e), l: logs };
        } finally {
          console.log = orig;
        }
      }
    });
    const r = (res && res[0] && res[0].result) || {};
    if (r.e && /unsafe-eval|Content Security Policy|EvalError|TrustedScript|Trusted Type/i.test(r.e)) r.e += BLOCKED;
    return r;
  } catch (e) {
    return { e: String(e && e.message || e), l: [] };
  }
}
