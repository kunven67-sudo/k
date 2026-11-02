export async function run({ page, wait }) {
  await page.getByText('Examples').click();
  await wait(400);
  await page.locator('button.gs3-item').filter({ hasText: /^Car/ }).first().click();
  await wait(2500);
  await page.evaluate(() => { const A = window.__AF; for (const b of A.bodies) for (const p of b.parts) if (p.def.id === 'seat') A.game.sitIn(p); });
  await page.keyboard.down('KeyW'); await wait(1500);
  const info = await page.evaluate(() => {
    const A = window.__AF, out = [];
    for (const b of A.bodies) for (const p of b.parts) if (p.def.id === 'wheel' || p.def.id === 'steer') out.push({ id: p.def.id, level: p.st.level, active: p.st.active, ds: p.st.driveSign, joint: !!p.joint, child: !!p.child, key: p.st.motorKey, mass: p.body.rb.mass().toFixed(0), childMass: p.child && p.child.rb.mass().toFixed(1), av: p.child && Object.values(p.child.rb.angvel()).map((v) => v.toFixed(2)) });
    const seat = A.player.seat;
    return { out, bodies: A.bodies.size, seatBody: seat && seat.body.id, frozen: seat && seat.body.frozen };
  });
  console.log(JSON.stringify(info, null, 1));
  await page.keyboard.up('KeyW');
}
