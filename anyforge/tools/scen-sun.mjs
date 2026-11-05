export async function run({ page, shot, wait }) {
  const info = await page.evaluate(async () => {
    const R = await window.__AF.sun();
    const s = R.sun;
    return { dir: R.sunDirection().toArray().map((v) => +v.toFixed(3)), pos: s.position.toArray().map((v) => +v.toFixed(1)), target: s.target.position.toArray(), cast: s.castShadow, map: s.shadow.mapSize.x, intensity: s.intensity, inScene: !!s.parent, shadowOn: R.renderer.shadowMap.enabled };
  });
  console.log(JSON.stringify(info));
}
