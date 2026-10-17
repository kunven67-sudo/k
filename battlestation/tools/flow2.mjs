// Tests the house stuff: holding things, fridge, microwave, trash, toilet, sinks, mirror.
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
const server = await serve(8765);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto('http://localhost:8765/dist/dev.html?q=low&env=0&state=walk&at=8.6,1.4,0,0');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 300000 }).catch(() => logs.push('timeout'));
const out = await page.evaluate(async () => {
  const g = window.__game, p = g.player, r = [], K = g.kitchen, B = g.bathroom, H = g.held;
  window.__pause = true;
  document.getElementById('start')?.click(); g.started = true; g.input.enabled = true;
  const tick = (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) g.update(dt); };
  const log = (k, v) => r.push(k + ': ' + (typeof v === 'object' ? JSON.stringify(v) : v));
  // can from the nightstand
  const can = g.bedroom.cans[0];
  H.take(can); tick(5);
  log('holding', H.item?.name + ' at ' + can.group.position.toArray().map(v => v.toFixed(2)) + ' hand ' + p.avatar.pos('hand_r').toArray().map(v => v.toFixed(2)));
  H.use(); tick(3); log('opened', can.open);
  const t0 = g.needs.v.thirst;
  H.use(); tick(70); log('sip', `thirst ${t0.toFixed(3)} -> ${g.needs.v.thirst.toFixed(3)}, sips ${can.sips}`);
  // put it on the table
  H.putDownAt(can.group.position.clone().set(8.9, K.table.userData.size.y, 2.3)); log('put down', !H.has);
  // fridge + pizza + microwave
  K.fridge.doors[0].target = 1; tick(30);
  const slice = K.items.find(i => i.name === 'pizza slice');
  H.take(slice); log('took', H.item?.name);
  K.micro.target = 1; tick(20);
  const mic = g.interact.items.find(i => i.obj === K.micro.doorPivot);
  log('micro label', mic.label());
  mic.use(); log('in micro', K.micro.food?.name);
  mic.use(); tick(20); // close
  const btn = g.interact.items.find(i => /Start/.test(i.label()));
  log('start label', btn?.label());
  btn.use(); tick(62 * 30, 1 / 30);
  log('hot', slice.hot + ' running ' + K.micro.running);
  K.micro.target = 1; tick(20);
  H.take(slice); log('took hot', slice.hot + ' micro food ' + (K.micro.food?.name || 'none'));
  const h0 = g.needs.v.hunger;
  for (let i = 0; i < 3; i++) { H.use(); tick(50); }
  log('ate', `hunger ${h0.toFixed(3)} -> ${g.needs.v.hunger.toFixed(3)}, holding ${H.has}`);
  // trash an empty milk? take water bottle, throw away
  const water = K.items.find(i => i.name === 'water bottle');
  H.take(water); const tr = g.interact.items.find(i => i.obj === K.trash.lidPivot.parent);
  log('trash label', tr.label()); tr.use(); tick(40); log('trashed', !H.has + ' visible ' + water.obj.visible);
  // burners
  K.burners[0].level = 3; tick(400); log('burner glow', K.burners[0].ringMat.emissiveIntensity.toFixed(2));
  // tap
  const tap = g.interact.items.find(i => /water/.test(i.label()) && /Turn on/.test(i.label()));
  tap.use(); tick(5); log('tap on', K.tap.on);
  // bathroom
  g.bladder = g.needs.v.bladder = 0.7;
  const lid = g.interact.items.find(i => /lid/i.test(i.label()));
  lid.use(); tick(20); log('lid', lid.label()); lid.use(); log('peed', g.needs.v.bladder);
  const fl = g.interact.items.find(i => i.label() === 'Flush'); fl.use(); tick(10); log('flushing', B.toilet.flushT.toFixed(1));
  B.shower.on = true; tick(30); log('shower drops', B.shower.on);
  // mirror visible only in the bathroom
  p.standAt(8.3, 5.2, -Math.PI / 2); tick(10); log('room', g.room + ' mirror ' + B.mirror.visible);
  g.renderer.render(); log('rendered with mirror', true);
  p.standAt(3, 3, 0); tick(10); log('room', g.room + ' mirror ' + B.mirror.visible);
  return r;
});
console.log(out.join('\n'));
console.log(logs.filter(l => !/404|favicon/.test(l)).slice(0, 30).join('\n'));
await browser.close(); server.close();
