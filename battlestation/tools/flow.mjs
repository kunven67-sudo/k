// Plays through the main loop of the game in headless Chromium (no pointer lock there, so we call
// the same handlers the real mouse/keyboard would) and reports anything that breaks.
// usage: node tools/flow.mjs [url]
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const url = process.argv[2] || '/dist/dev.html?q=low&env=0';
const server = await serve(8765);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto('http://localhost:8765' + url);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 300000 }).catch(() => logs.push('timeout'));
const out = await page.evaluate(async () => {
  const g = window.__game, p = g.player, r = [];
  const tick = (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) g.update(dt); };
  const key = (code, down = true, extra = {}) => g.onKey({ code, key: extra.key ?? (code.startsWith('Key') ? code.slice(3).toLowerCase() : ''), repeat: false, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...extra }, down);
  const tap = (code, extra) => { key(code, true, extra); tick(2); key(code, false, extra); tick(1); };
  window.__pause = true;
  const log = (k, v) => r.push(k + ': ' + (typeof v === 'object' ? JSON.stringify(v) : v));
  // start: in bed
  log('state at start', p.state);
  document.getElementById('start').click();
  await new Promise(res => setTimeout(res, 300));
  log('started', g.started);
  tap('KeyW');
  tick(60);
  log('after W', p.state + ' pos=' + p.pos.toArray().map(v => v.toFixed(2)));
  // walk toward the chair
  p.yaw = Math.atan2(-(1.15 - p.pos.x), -(1.2 - p.pos.z)); p.pitch = -0.5;
  g.input.keys.add('KeyW'); tick(45); g.input.keys.delete('KeyW'); tick(10);
  log('walked to', p.pos.toArray().map(v => v.toFixed(2)));
  const it = g.interact.update();
  log('looking at', it ? it.label() : 'nothing');
  p.sitDown(); tick(40);
  log('seated', p.state);
  // power on from the seat: look around, press the button
  g.os.powerButton(); tick(300);
  log('os after boot wait', g.os.state);
  tap('Enter'); tick(20); tap('Enter'); tick(90);
  log('os', g.os.state + ' windows=' + g.os.windows.length);
  // move the mouse over the desktop and double-click an icon
  g.pcMouse(-2000, 0); g.pcMouse(0, -2000); tick(25); g.pcMouse(60, 60); tick(2);
  log('cursor', g.os.cursor);
  g.onMouse(0, true); g.onMouse(0, false); g.onMouse(0, true); g.onMouse(0, false); tick(30);
  log('windows after dbl', g.os.windows.map(w => w.title));
  // type in whatever is focused
  for (const c of 'hello') tap('Key' + c.toUpperCase(), { key: c });
  tick(10);
  // open every app once
  for (const a of ['notepad', 'browser', 'terminal', 'taskmgr', 'settings', 'explorer', 'library', 'mines', 'calc', 'paint', 'scanhelp', 'dustline', 'skirmish']) {
    try { const w = g.os.open(a); tick(20); g.os.close(w); } catch (e) { log('APP FAIL ' + a, e.message); }
  }
  // push the cursor past the top -> seat bar
  g.pcMouse(800 - g.os.cursor.x, 0); g.pcMouse(0, -3000); g.pcMouse(0, -200); tick(2);
  log('seat hud', g.ui.seat.hud);
  g.ui.seatAct('look'); tick(20);
  log('look state', p.state);
  g.ui.seatAct('back'); tick(20);
  log('back', p.state);
  p.standUp(); tick(40);
  log('stood up', p.state + ' pos=' + p.pos.toArray().map(v => v.toFixed(2)));
  // couch, bed, menus
  p.sitCouch(); tick(40); log('couch', p.state); tap('KeyW'); tick(30); log('left couch', p.state);
  p.lieDown(); tick(50); log('bed', p.state); tap('KeyW'); tick(40); log('up again', p.state);
  for (const t of ['resume', 'settings', 'you', 'pc', 'parts', 'controls']) { g.ui.openMenu(t); }
  g.ui.closeMenu();
  // unplug things
  g.rig.plug('routerPower', false); tick(5); log('router unplugged', g.router.status(true));
  g.rig.plug('routerPower', true); tick(60 * 30, 1 / 30); log('router 60s later', g.router.status(true));
  g.rig.plug('pcPower', false); tick(5); log('pc unplugged', g.os.state);
  g.rig.plug('pcPower', true);
  log('fps', Math.round(g.renderer.fps));
  return r;
});
console.log(out.join('\n'));
console.log(logs.filter(l => !/404|favicon/.test(l)).slice(0, 30).join('\n'));
await browser.close(); server.close();
