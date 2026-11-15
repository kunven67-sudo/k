// Convert raw Sketchfab glTF downloads into small game-ready .glb files.
// node tools/process.mjs <rawDir> <outDir> [name...]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { metalRough, prune, dedup, resample, textureCompress, meshopt, simplify, weld, compactPrimitive } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs'; import path from 'node:path';
const [raw, out, ...only] = process.argv.slice(2);
// name: [source file, max texture size, animations to keep (substring match, renamed)]
const M = {
  wolf:   ['wolf/scene.gltf', 1024, null],
  bear:   ['bear/scene.gltf', 1024, { idle: 'BlackBear_Idle', walk: 'A_WalkMedium_F', run: 'A_RunFast_F', roar: 'A_Bear_Calling_1', bite: 'A_Bear_ClackTeeth_x3', hurt: 'A_HitHead2Frighten_F', die: 'A_WalkSlowWounded2Lying', dead: 'A_LyingBreathing' }],
  tiger:  ['tiger/scene.gltf', 1024, null],
  hyena:  ['hyena/scene.gltf', 1024, { idle: 'Hyena_Idle', walk: 'Hyena_WalkFast_F' }],
  rhino:  ['rhino/scene.gltf', 1024, null],
  elk:    ['elk/Deer.gltf', 1024, { idle: 'Stand_Breathing_01', walk: 'Sneak', run: 'Run', sprint: 'Sprint', hurt: 'Hit_Stand_L01', die: 'Death_Stand_R01', jump: 'JumpStand', eat: 'Stand_Eating_01' }],
  trex:   ['trex/scene.gltf', 1024, null],
  raptor: ['raptor/scene.gltf', 1024, { idle: 'Idle_01', walk: 'Walk', run: 'Sprint', jog: 'Jog', bite: 'Bite_01', leap: 'Leap_01', roar: 'Roar_01', hurt: 'Hurt_01', die: 'Death_01' }],
  trike:  ['trike/scene.gltf', 1024, null],
  ptero:  ['ptero/scene.gltf', 1024, null],
  dragon: ['dragon/scene.gltf', 1024, null],
  alien:  ['alienw/scene.gltf', 1024, { walk: 'mixamo.com' }],
  zombie: ['zombie/scene.gltf', 1024, { attack: 'Attack1.001', idle: 'Idle', walk: 'Walk1' }],
  fossil: ['fossil/scene.gltf', 1024, null],
  anims: ['soldier.glb', 256, null],
  player: ['swatop/scene.gltf', 1024, null, true], // S.W.A.T. Operator (CC-BY), built-in rifle removed
};
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
fs.mkdirSync(out, { recursive: true });
for (const [name, [src, size, keep, dropStatic]] of Object.entries(M)) {
  if (only.length && !only.includes(name)) continue;
  const doc = await io.read(path.join(raw, src));
  const root = doc.getRoot();
  if (dropStatic) for (const n of root.listNodes()) if (n.getMesh() && !n.getSkin()) n.setMesh(null);
  if (keep) {
    for (const a of root.listAnimations()) {
      const base = a.getName().split('|').pop();
      const hit = Object.entries(keep).find(([, sub]) => base === sub || base.startsWith('A A A_') && base.includes(sub));
      if (hit) a.setName(hit[0]); else { a.listChannels().forEach(c => c.dispose()); a.listSamplers().forEach(s => s.dispose()); a.dispose(); }
    }
  }
  await doc.transform(metalRough(), resample(), dedup(), prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size], quality: 85 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const file = path.join(out, name + '.glb');
  await io.write(file, doc);
  console.log(name, (fs.statSync(file).size / 1e6).toFixed(1) + 'MB', root.listAnimations().map(a => a.getName() + ':' + a.listSamplers().reduce((m, s) => Math.max(m, s.getInput().getMax([])[0]), 0).toFixed(1)).join(' '));
}

// Poly Haven static models (weapons, props, nature): name -> [id, simplify ratio]
const PH = {
  katana: ['antique_katana_01'], machete: ['machete'], hatchet: ['hatchet'], warhammer: ['ornate_war_hammer'], mace: ['ornate_medieval_mace'],
  dagger: ['ornate_medieval_dagger'], axe: ['wooden_axe'], pistol: ['service_pistol'], rifle: ['bolt_action_rifle_7_62'], grenade: ['stick_grenade'],
  shield: ['kite_shield'], barrel: ['barrel_03'], box: ['cardboard_box_01'], crate: ['old_military_crate'], car: ['covered_car'],
  log: ['dead_tree_trunk', 0.1, 0.05], boulder: ['boulder_01', 0.12, 'sloppy'], fern: ['fern_02', 0.3], ammo: ['ammo_box'],
};
await MeshoptSimplifier.ready;
for (const [name, [id, ratio, err = 0.05]] of Object.entries(PH)) {
  if (only.length && !only.includes(name)) continue;
  const doc = await io.read(path.join(raw, 'ph', id, id + '.gltf'));
  const steps = [dedup(), prune()];
  if (ratio && err === 'sloppy') {
    // scans with thousands of UV seams: cluster triangles by position only
    for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
      const idx = new Uint32Array(p.getIndices().getArray()), pos = p.getAttribute('POSITION').getArray();
      // weld by position only (ignore UV seams), simplify, then map back to an original vertex for its UV
      const key = new Map(), remap = new Uint32Array(pos.length / 3), first = [], up = [];
      for (let i = 0; i < pos.length / 3; i++) {
        const k = Math.round(pos[i * 3] * 1e4) + ',' + Math.round(pos[i * 3 + 1] * 1e4) + ',' + Math.round(pos[i * 3 + 2] * 1e4);
        let u = key.get(k); if (u === undefined) { u = first.length; key.set(k, u); first.push(i); up.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); }
        remap[i] = u;
      }
      const wi = idx.map(i => remap[i]);
      const [si] = MeshoptSimplifier.simplify(wi, new Float32Array(up), 3, Math.floor(idx.length * ratio / 3) * 3, 0.05);
      const out = si.map(u => first[u]);
      p.getIndices().setArray(out); compactPrimitive(p);
    }
  } else if (ratio) steps.unshift(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: err, lockBorder: false }));
  await doc.transform(...steps, textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 85 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const file = path.join(out, name + '.glb'); await io.write(file, doc);
  console.log(name, (fs.statSync(file).size / 1e6).toFixed(2) + 'MB');
}
