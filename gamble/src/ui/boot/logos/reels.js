// Logo D: a wide six-reel slot window. The reels spin up together and clunk to a stop one by
// one on G-A-M-B-L-E; the last one rings the jackpot — bulbs go wild, bell ding.

import * as THREE from 'three';
import { mat } from '../../../gfx/materials.js';
import { bevelBox } from '../../../gfx/geom.js';
import { Stage, loadFonts, fitDistance } from '../../three/stage.js';
import { createReel } from '../../three/reel.js';
import { createBulbs, rectPoints } from '../../three/bulbs.js';
import { createBokeh } from '../../three/bokeh.js';
import { drawSymbol, letter, SYMBOL_NAMES } from '../../three/symbols.js';
import { uiSound, vary } from '../../sfx.js';

const WORD = ['G', 'A', 'M', 'B', 'L', 'E'];
const PER = 10; // symbols per reel (letter + 9 classics)
const REEL_W = 1.05;
const GAP = 0.12;

export async function runLogo(engine, root, skip, host) {
  await loadFonts();
  const stage = new Stage(engine, { fov: 30, background: 0x050304, envIntensity: 0.45 });
  host.stage = stage;
  const { scene, camera, tier } = stage;

  const bokeh = createBokeh({ count: Math.round(60 * tier.particlesScale) + 20, y: 0, spreadY: 16, z: [-12, -30], spreadX: 40 });
  scene.add(bokeh);
  stage.own(bokeh.material);
  scene.add(new THREE.HemisphereLight(0x8a7060, 0x080506, 0.25));
  const key = new THREE.DirectionalLight(0xffe8cc, 0.9);
  key.position.set(-3, 5, 8);
  scene.add(key);

  // Cabinet face: oxblood lacquer slab, chrome window frame, inner shadow box.
  const totalW = WORD.length * REEL_W + (WORD.length - 1) * GAP;
  const lacquer = mat('car-paint', { color: 0x5a0a12 });
  const face = bevelBox(totalW + 2.2, 3.6, 0.6, lacquer, { radius: 0.18, segments: 4 });
  face.position.z = -0.55;
  scene.add(face);
  const chrome = mat('chrome');
  const frameT = 0.14;
  const winH = 1.2; // the slab face (z = -0.25) crops the drums to exactly this window
  for (const [w, h, x, y] of [[totalW + 0.5, frameT, 0, winH / 2 + 0.06], [totalW + 0.5, frameT, 0, -winH / 2 - 0.06], [frameT, winH + 0.26, totalW / 2 + 0.18, 0], [frameT, winH + 0.26, -totalW / 2 - 0.18, 0]]) {
    const b = bevelBox(w, h, 0.22, chrome, { radius: 0.05, segments: 3 });
    b.position.set(x, y, -0.05);
    scene.add(b);
  }
  // Dark well behind the reels so the drums read as round.
  const well = new THREE.Mesh(new THREE.PlaneGeometry(totalW + 0.4, winH + 0.2), new THREE.MeshBasicMaterial({ color: 0x050303 }));
  well.position.z = -0.7;
  scene.add(well);
  stage.own(well.material);

  // Reels: same symbol set on each, with the reel's own letter at index 0.
  const reels = WORD.map((ch, r) => {
    const reel = createReel({
      key: `logo-reel-${ch}`,
      count: PER,
      radius: 1.0,
      width: REEL_W,
      cellW: 256,
      cellH: 240,
      draw: (g, i, w, h) => (i === 0 ? letter(g, ch, w, h, { color: r % 2 ? '#14110f' : '#b5121b' }) : drawSymbol(g, SYMBOL_NAMES[(i + r) % SYMBOL_NAMES.length], w, h)),
    });
    reel.mesh.position.set(-totalW / 2 + REEL_W / 2 + r * (REEL_W + GAP), 0, -1.05);
    reel.setIndex(3 + r);
    scene.add(reel.mesh);
    return reel;
  });
  // Glass over the window with a faint reflection streak.
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(totalW + 0.3, winH), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.08, metalness: 0 }));
  glass.position.z = 0.02;
  scene.add(glass);
  stage.own(glass.material);
  // Payline.
  const line = new THREE.Mesh(new THREE.PlaneGeometry(totalW + 0.3, 0.025), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.4, 0.4), transparent: true, opacity: 0.6 }));
  line.position.z = 0.03;
  scene.add(line);
  stage.own(line.material);

  const bulbs = createBulbs(rectPoints(0, 0, totalW + 1.3, winH + 1.0, 0.32, -0.22), { radius: 0.075 });
  scene.add(bulbs.group);
  stage.own(bulbs);

  stage.onUpdate((dt, time) => {
    for (const r of reels) r.update(dt);
    bulbs.update(time);
    bokeh.update(time, engine.height);
    const d = Math.max(10.5, fitDistance(camera, (totalW + 2.4) / 2, 2.3));
    camera.position.set(Math.sin(time * 0.3) * 0.35, 0.25, d);
    camera.lookAt(0, 0, 0);
  });

  await stage.wait(450, skip);
  uiSound('slot.lever', { bus: 'sfx' });
  const spin = uiSound('slot.reel-spin', { loop: true, bus: 'sfx', gain: 0.5 });
  bulbs.setPattern('chase', 14);
  const landed = reels.map((r, i) =>
    r.spinTo(0, 1.3 + i * 0.32, {
      turns: 2 + i,
      onStop: () => uiSound('logo.reels', { rate: vary(0.06), bus: 'sfx' }),
    }),
  );
  await Promise.race([Promise.all(landed), stage.wait(1e9, skip)]);
  spin?.stop?.(0.1);
  if (!skip.requested) {
    uiSound('slot.ding', { bus: 'sfx' });
    uiSound('slot.win-big', { bus: 'sfx', gain: 0.6 });
    bulbs.setPattern('alternate', 8);
    setTimeout(() => bulbs.setPattern('sparkle', 12), 900);
  }
  await stage.wait(2200, skip);
  await engine.fade(true, skip.requested ? 250 : 700);
  stage.dispose();
}
