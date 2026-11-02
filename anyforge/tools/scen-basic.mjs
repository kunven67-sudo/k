export async function run({ page, shot, wait, key }) {
  await page.getByText('Start building').click();
  await wait(1500);
  await shot('basic-1-start');
  // look down a little, place a block in front
  await page.mouse.move(640, 360);
  await page.mouse.move(640, 460, { steps: 5 });
  await wait(300);
  await shot('basic-2-ghost');
  await page.mouse.down(); await page.mouse.up();
  await wait(1200);
  await shot('basic-3-placed');
  await key('Tab'); await wait(800);
  await shot('basic-4-parts');
}
