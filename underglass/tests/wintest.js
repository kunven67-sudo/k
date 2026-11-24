// Windows check: runs inside the real exe on a real Windows machine (GitHub Actions)
const fs = require('fs'), path = require('path');
module.exports = async ({ app, win }) => {
  const out = process.env.UG_OUT; fs.mkdirSync(out, { recursive: true });
  const R = { ok: true, errors: [], steps: {} };
  win.webContents.on('console-message', (e) => { const m = e.message || ''; if (/rror|TypeError|ReferenceError/.test(m) && !/Security Warning|deprecated/.test(m)) R.errors.push(m.slice(0, 300)); });
  const wait = (ms) => new Promise(r => setTimeout(r, ms)); const js = (c) => win.webContents.executeJavaScript(c);
  const shot = async (n) => { const im = await win.webContents.capturePage(); fs.writeFileSync(path.join(out, n + '.png'), im.resize({ width: Math.min(1280, im.getSize().width) }).toPNG()); };
  const mouse = (type, x, y, n = 1) => win.webContents.sendInputEvent({ type, x: Math.round(x), y: Math.round(y), button: 'left', clickCount: n });
  const step = async (name, fn) => { try { R.steps[name] = await fn(); } catch (e) { R.ok = false; R.steps[name] = 'FAIL ' + e.message; } };
  try {
    let ready = false; for (let i = 0; i < 150; i++) { if (await js('!!window.__ready')) { ready = true; break; } await wait(200); }
    R.steps.ready = ready; if (!ready) R.ok = false;
    await wait(2000);
    await step('pclook', () => js(`(()=>{const L=UG.look;return {user:!!L.user, light:L.light, wallpaper:!!L.wallpaper, desktop:L.desktop.length, desktopIcons:L.desktop.filter(d=>d.icon).length, pinned:L.pinned.length, start:L.start.length, startIcons:L.start.filter(d=>d.icon).length, recycle:!!L.recycle, cursors:Object.keys(L.cursors||{}).length, align:L.taskbarAlign, search:L.searchMode, error:L.error||null}})()`));
    await step('iconSize', () => js(`new Promise(r=>{const L=UG.look;const it=L.start.find(d=>d.icon)||L.desktop.find(d=>d.icon);if(!it)return r(null);const im=new Image();im.onload=()=>r([im.width,im.height]);im.onerror=()=>r('bad');im.src=it.icon;})`));
    await step('font', () => js(`(()=>{const c=document.createElement('canvas').getContext('2d');const w=(f)=>{c.font=f;return c.measureText('\\uE721\\uE995').width};return {fluent: w('32px "Segoe Fluent Icons", monospace')!==w('32px monospace'), glyphs: document.querySelectorAll('.gi').length, svgs: document.querySelectorAll('.si').length}})()`));
    await shot('w1-desktop');
    const sb = await js(`(()=>{const r=document.querySelector('.tb-start').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
    mouse('mouseMove', sb[0], sb[1]); mouse('mouseDown', sb[0], sb[1]); await wait(40); mouse('mouseUp', sb[0], sb[1]); await wait(700); await shot('w2-start');
    mouse('mouseDown', sb[0], sb[1]); await wait(40); mouse('mouseUp', sb[0], sb[1]); await wait(300);
    await step('rip', async () => { mouse('mouseMove', sb[0], sb[1]); mouse('mouseDown', sb[0], sb[1]); for (let i = 1; i <= 12; i++) { mouse('mouseMove', sb[0] - i * 15, sb[1] - i * 40); await wait(20); } mouse('mouseUp', sb[0] - 180, sb[1] - 480); await wait(1500); return js(`({bodies:UG.P.bodies.length, ripped:document.querySelectorAll('.ripped').length})`); });
    await step('spawn', async () => { await js(`(()=>{['crate','barrel','tv','duck','car'].forEach((id,i)=>UG.spawn(id,300+i*200,200));for(let i=0;i<4;i++)UG.spawn('stickman',500+i*150,300);})()`); await wait(2500); return js(`({bodies:UG.P.bodies.length, sticks:UG.sticks.length})`); });
    await shot('w3-stuff');
    await step('boom', async () => { await js(`void UG.explode(innerWidth/2, innerHeight-150, 1.6)`); await wait(2500); return js(`({bodies:UG.P.bodies.length, ripped:document.querySelectorAll('.ripped').length})`); });
    await shot('w4-boom');
    await step('fps', () => js(`new Promise(r=>{let n=0;const t0=performance.now();const f=()=>{n++;if(performance.now()-t0<3000)requestAnimationFrame(f);else r(Math.round(n/3));};requestAnimationFrame(f);})`));
    await step('world', async () => { await js(`void UG.spawn('worldball', innerWidth/2, 200)`); await wait(500); await js(`void UG.use(UG.worlds.balls[0])`); for (let i = 0; i < 40; i++) { if (await js('!!(UG.worlds.inside && !UG.worlds.anim)')) break; await wait(250); } await js('UG.worlds.inside.speed=10'); await wait(15000); return js(`(()=>{const m=UG.worlds.inside.sim;return {day:m.day(), pop:m.alive().length, buildings:UG.worlds.inside.buildings.length}})()`); });
    await shot('w5-world');
    await step('worldFps', () => js(`new Promise(r=>{let n=0;const t0=performance.now();const f=()=>{n++;if(performance.now()-t0<3000)requestAnimationFrame(f);else r(Math.round(n/3));};requestAnimationFrame(f);})`));
    await js('void UG.worlds.exit()'); await wait(2500); await js('UG.save()'); await wait(800);
    await step('saved', () => js(`require('fs').readdirSync(require('path').join(process.env.APPDATA,'underglass')).filter(f=>f.endsWith('.json'))`));
  } catch (e) { R.ok = false; R.errors.push('TEST CRASH ' + e.stack); }
  if (R.errors.length) R.ok = false;
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(R, null, 1));
  app.quit();
};
