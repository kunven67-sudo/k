export async function run({ page, shot, wait }) {
  await page.getByText('Start building').click();
  await wait(1000);
  await page.mouse.move(640, 360); await page.mouse.move(640, 470, { steps: 5 });
  await wait(300);
  await page.mouse.down(); await page.mouse.up();
  await wait(1500);
  // step back and to the side, look at the block
  await page.evaluate(() => { const p = window.__AF.player; p.pos.set(-4, 0, 9); p.yaw = -0.6; p.pitch = -0.35; p.body.setTranslation({ x: -4, y: 0.9, z: 9 }, true); });
  await wait(1200);
  await shot('shadow-1');
  const info = await page.evaluate(() => { const b = [...window.__AF.bodies][0]; const t = b.rb.translation(); let cs = []; b.group.traverse((o) => { if (o.isMesh) cs.push(o.castShadow); }); return { pos: [t.x, t.y, t.z], cs }; });
  console.log(JSON.stringify(info));
}
