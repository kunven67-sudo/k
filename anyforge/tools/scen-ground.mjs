export async function run({ page, shot, wait }) {
  const info = await page.evaluate(() => {
    const out = [];
    window.__AF.scene.children.forEach((o) => { if (o.isMesh && o.geometry.type === 'PlaneGeometry') out.push({ y: o.position.y, z: o.position.z, w: o.geometry.parameters.width, h: o.geometry.parameters.height, po: o.material.polygonOffset, pof: o.material.polygonOffsetFactor, map: o.material.map && o.material.map.image && o.material.map.image.src ? o.material.map.image.src.slice(-20) : null, vis: o.visible }); });
    return out;
  });
  console.log(JSON.stringify(info, null, 0));
  // hide grass to see the pad alone
  await page.evaluate(() => { const g = window.__AF.scene.children.find((o) => o.isMesh && o.geometry.parameters && o.geometry.parameters.width === 9000); g.visible = false; });
  await wait(500);
  await shot('ground-nograss');
}
