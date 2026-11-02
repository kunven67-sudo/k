// spawn the car through the real menus, sit in it, drive with real keys
export async function run({ page, shot, wait, key }) {
  await page.getByText('Examples').click();
  await wait(400);
  await page.locator('button.gs3-item').filter({ hasText: /^Car/ }).first().click();
  await wait(2500);
  await shot('car-1-spawned');
  const seat = await page.evaluate(() => { const A = window.__AF; for (const b of A.bodies) for (const p of b.parts) if (p.def.id === 'seat') { A.game.sitIn(p); return true; } return false; });
  console.log('sat', seat);
  await wait(500);
  const pos0 = await page.evaluate(() => { const s = window.__AF.player.seat; return s ? window.__AF.partWorld(s).toArray() : null; });
  await page.keyboard.down('KeyW'); await wait(3500); await shot('car-2-driving'); await page.keyboard.up('KeyW');
  const pos1 = await page.evaluate(() => { const s = window.__AF.player.seat; return s ? window.__AF.partWorld(s).toArray() : null; });
  await page.keyboard.down('KeyW'); await page.keyboard.down('KeyD'); await wait(2500); await page.keyboard.up('KeyD'); await page.keyboard.up('KeyW');
  const pos2 = await page.evaluate(() => { const s = window.__AF.player.seat; return s ? window.__AF.partWorld(s).toArray() : null; });
  await key('KeyV'); await wait(600); await shot('car-3-outside');
  await key('KeyH'); await wait(300);
  console.log('start', pos0 && pos0.map((v) => v.toFixed(2)), 'after W', pos1 && pos1.map((v) => v.toFixed(2)), 'after W+D', pos2 && pos2.map((v) => v.toFixed(2)));
  await key('KeyF'); await wait(600); await shot('car-4-out');
}
