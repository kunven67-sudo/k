// Linux test: real mouse input + screenshots. UG_TEST=$PWD/tests/run.js xvfb-run ... electron .
const fs = require('fs'), path = require('path');
module.exports = async ({ app, win }) => {
  const out = process.env.UG_OUT || path.join(__dirname, 'shots'); fs.mkdirSync(out, { recursive: true });
  const errors = [];
  win.webContents.on('console-message', (e) => { const m = e.message || ''; const lvl = e.level; if (lvl === 'error' || lvl === 3 || /Error|error/.test(m)) errors.push(m.slice(0, 400)); });
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const js = (code) => win.webContents.executeJavaScript(code);
  const shot = async (n) => { const im = await win.webContents.capturePage(); fs.writeFileSync(path.join(out, n + '.png'), im.toPNG()); };
  const mouse = (type, x, y, button = 'left', clickCount = 1) => win.webContents.sendInputEvent({ type, x: Math.round(x), y: Math.round(y), button, clickCount });
  const drag = async (x1, y1, x2, y2, steps = 12, hold = 0) => { mouse('mouseMove', x1, y1); mouse('mouseDown', x1, y1); if (hold) await wait(hold); for (let i = 1; i <= steps; i++) { mouse('mouseMove', x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps); await wait(16); } mouse('mouseUp', x2, y2); };
  const click = async (x, y, n = 1) => { mouse('mouseMove', x, y); mouse('mouseDown', x, y, 'left', n); await wait(30); mouse('mouseUp', x, y, 'left', n); };
  const steps = process.env.UG_STEPS || 'all';
  try {
    for (let i = 0; i < 100; i++) { if (await js('!!window.__ready')) break; await wait(200); }
    await wait(1500); await shot('01-desktop');
    if (steps !== 'world') {
    // Start menu
    const sb = await js(`(()=>{const r=document.querySelector('.tb-start').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
    await click(sb[0], sb[1]); await wait(500); await shot('02-start'); await click(sb[0], sb[1]); await wait(300);
    // calendar
    const ck = await js(`(()=>{const r=document.querySelector('.tray-clock').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
    await click(ck[0], ck[1]); await wait(400); await shot('03-calendar'); await click(900, 400); await wait(300);
    // open an app window (double-click recycle bin)
    const ic = await js(`(()=>{const r=document.querySelector('.dicon').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
    await click(ic[0], ic[1], 2); await wait(600); await shot('04-window');
    // rip a desktop icon off (drag)
    const ic2 = await js(`(()=>{const d=document.querySelectorAll('.dicon');const r=d[Math.min(1,d.length-1)].getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
    await drag(ic2[0], ic2[1], ic2[0] + 400, ic2[1] + 100, 14); await wait(200);
    // rip the start button off the taskbar
    await drag(sb[0], sb[1], sb[0] - 200, sb[1] - 500, 14); await wait(700);
    // tear wallpaper (hold then pull)
    await drag(1300, 300, 1500, 500, 14, 600); await wait(300);
    // yank the window by its title bar
    const tt = await js(`(()=>{const t=document.querySelector('.fwin .title');if(!t)return null;const r=t.getBoundingClientRect();return [r.left+120,r.top+16]})()`);
    if (tt) { mouse('mouseMove', tt[0], tt[1]); mouse('mouseDown', tt[0], tt[1]); for (let i = 1; i <= 6; i++) { mouse('mouseMove', tt[0] + i * 120, tt[1] + i * 30); await wait(8); } mouse('mouseUp', tt[0] + 720, tt[1] + 180); }
    await wait(1500); await shot('05-ripped');
    const st1 = await js(`JSON.stringify({bodies:UG.P.bodies.length, ripped:document.querySelectorAll('.ripped').length})`); console.log('after rip', st1);
    // spawn stuff + stickmen
    await js(`(()=>{const g=UG;['crate','barrel','tv','duck','propane','car','soccer','grenade','pistol','cannon','apple'].forEach((id,i)=>g.spawn(id,300+i*130,200));for(let i=0;i<6;i++)g.spawn(i%3?'stickman':'kid',500+i*120,300);})()`);
    await wait(2500); await shot('06-spawned');
    // explosion near the taskbar
    await js(`void UG.explode(1000, innerHeight-120, 1.6)`); await wait(250); await shot('07-boom'); await wait(2000); await shot('08-after-boom');
    // laser eyes: real input
    await js(`void UG.powers.set('laser')`); await wait(200);
    await drag(1500, 200, 600, 900, 30); await wait(500); await shot('09-laser');
    await js(`void UG.powers.set('blackhole')`); await click(1400, 500); await wait(2500); await shot('10-blackhole'); await click(1400, 500); await wait(800);
    await js(`void UG.powers.set('lightning')`); await click(800, 600); await wait(150); await shot('11-lightning');
    await js(`void UG.powers.set('fire')`); await drag(400, 400, 900, 500, 40); await wait(1200); await shot('12-fire');
    await js(`void UG.powers.set(null)`);
    const st2 = await js(`JSON.stringify({bodies:UG.P.bodies.length, sticks:UG.sticks.length, fx:UG.fx.p.length})`); console.log('after powers', st2);
    }
    // the universe ball
    await js(`void UG.spawn('worldball', 960, 300)`); await wait(1500); await shot('13-ball');
    await js(`void UG.use(UG.worlds.balls[0])`); await wait(1100); await shot('14-zoom'); for (let i = 0; i < 40; i++) { if (await js('!!(UG.worlds.inside && !UG.worlds.anim)')) break; await wait(250); } await wait(500); await shot('15-world');
    await js(`(()=>{const s=UG.worlds.inside;s.cam.tz=1.6;s.cam.tx=0;s.cam.ty=s.terrainY(0)-60;})()`); await wait(1500); await shot('16-world-close');
    await js(`UG.worlds.inside.speed=30`); await wait(25000);
    const st3 = await js(`JSON.stringify((()=>{const s=UG.worlds.inside;return {day:s.sim.day(),hour:s.sim.hour().toFixed(1),pop:s.sim.alive().length,res:s.sim.res,b:s.buildings.map(b=>b.type+':'+b.built.toFixed(2)),feed:s.feed.slice(-6).map(f=>f.text)}})())`); console.log('world', st3);
    await js(`(()=>{const s=UG.worlds.inside;s.speed=1;const p=s.sim.alive()[0];s.cam.tz=1.3;s.cam.tx=p.stick.x;s.cam.ty=p.stick.ground-80;UG.worlds.select(p.stick);})()`); await wait(1500); await shot('17-world-later');
    await js(`(()=>{const s=UG.worlds.inside;s.cam.tz=0.35;})()`); await wait(1500); await shot('18-world-wide');
    await js(`(()=>{const s=UG.worlds.inside;s.sim.time=Math.floor(s.sim.time/24)*24+23;s.cam.tz=1;})()`); await wait(1500); await shot('19-world-night');
    await js(`(()=>{const s=UG.worlds.inside;void s.explode(s.buildings[0]?s.buildings[0].x+100:0, s.terrainY(0)-40, 2)})()`); await wait(1500); await shot('20-world-boom');
    await js(`void UG.worlds.exit()`); await wait(2200); await shot('21-back');
  } catch (e) { errors.push('TEST CRASH ' + e.stack); }
  fs.writeFileSync(path.join(out, 'errors.txt'), errors.join('\n'));
  console.log('ERRORS', errors.length, errors.slice(0, 15).join('\n'));
  app.quit();
};
