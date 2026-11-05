export async function run({ page, wait }) {
  await page.getByText('Examples').click();
  await wait(400);
  await page.locator('button.gs3-item').filter({ hasText: /^Car/ }).first().click();
  await wait(2500);
  const r = await page.evaluate(async () => {
    const A = window.__AF;
    const wheels = [];
    for (const b of A.bodies) for (const p of b.parts) if (p.def.id === 'wheel') wheels.push(p);
    const chassis = [...A.bodies].find((b) => [...b.parts].some((p) => p.def.id === 'seat'));
    const rel = () => wheels.map((p) => { const a = p.child.rb.angvel(), c = p.body.rb.angvel(); return [(a.x - c.x).toFixed(2), (a.y - c.y).toFixed(2), (a.z - c.z).toFixed(2), p.joint.isValid(), p.child.rb.isSleeping()]; });
    const before = rel();
    for (const p of wheels) { p.joint.configureMotorVelocity(20, 50); p.joint.setMotorMaxForce(1e9); p.child.rb.wakeUp(); p.st.motorKey = 'manual'; p.def.fixedBackup = p.def.fixed; }
    // stop the game from re-setting them for this test
    const fx = wheels[0].def.fixed; wheels[0].def.fixed = () => {};
    await new Promise((r) => setTimeout(r, 2500));
    wheels[0].def.fixed = fx;
    const after = rel();
    const lv = chassis.rb.linvel();
    // count contacts between front tires and chassis
    return { before, after, chassisVel: [lv.x.toFixed(2), lv.y.toFixed(2), lv.z.toFixed(2)], chassisMass: chassis.rb.mass() };
  });
  console.log(JSON.stringify(r));
}
