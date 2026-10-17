import { MsgBox, Notepad, Calc, Terminal, TaskMgr, Settings, Explorer, RealApp, ScanHelp, Paint } from './basic.js';
import { Browser } from './browser.js';
import { Library } from './library.js';
import { Dustline } from './dustline.js';
import { Skirmish } from './skirmish.js';
import { Mines } from './mines.js';

export const APPS = {
  msgbox: MsgBox, notepad: Notepad, calc: Calc, terminal: Terminal, taskmgr: TaskMgr, settings: Settings,
  explorer: Explorer, realapp: RealApp, scanhelp: ScanHelp, paint: Paint, browser: Browser, library: Library,
  dustline: Dustline, skirmish: Skirmish, mines: Mines,
};

// Your real apps (from the scan) open the matching in-game app when there is one.
const MAP = [
  [/chrome|edge|firefox|opera|brave|vivaldi|browser|internet explorer|arc\b|duckduckgo/i, 'browser'],
  [/file explorer|^explorer$|this pc/i, 'explorer'],
  [/notepad|wordpad/i, 'notepad'],
  [/calculator/i, 'calc'],
  [/terminal|powershell|command prompt|^cmd/i, 'terminal'],
  [/task manager/i, 'taskmgr'],
  [/^settings$|control panel/i, 'settings'],
  [/^paint/i, 'paint'],
  [/^steam$|epic games launcher|^epic games$/i, 'library'],
];
export function appFor(it) {
  const n = String(it.name || '');
  for (const [re, app] of MAP) if (re.test(n)) return app;
  if (it.steamId || it.kind === 'game') return 'library';
  return 'realapp';
}
