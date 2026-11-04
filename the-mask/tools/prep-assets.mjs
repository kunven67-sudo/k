// THE MASK - asset prep. Sources (all CC0, Kay Lousberg / KayKit):
//   git clone https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0  (Characters/gltf/*.glb)
//   git clone https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0             (assets/kaykit)
//   git clone https://github.com/KayKit-Game-Assets/KayKit-Halloween-Bits-1.0             (assets/kk_halloween)
// usage: node tools/prep-assets.mjs <path to KayKit-Character-Pack-Adventures .../Characters/gltf>
// Writes game/assets/people/: hooded.glb (your copies' body + every animation the game uses) and
// knight/barbarian/mage/rogue.glb (body only: they all share one skeleton, so they play hooded.glb's animations).
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup, resample } from '@gltf-transform/functions';
import fs from 'fs';
import path from 'path';

const SRC = process.argv[2];
const OUT = path.resolve('game/assets/people');
fs.mkdirSync(OUT, { recursive: true });
export const CLIPS = [
  'Idle', 'Unarmed_Idle', 'Walking_A', 'Walking_B', 'Walking_C', 'Walking_Backwards', 'Running_A', 'Running_B',
  'Running_Strafe_Left', 'Running_Strafe_Right', 'Hit_A', 'Hit_B', 'Death_A', 'Death_A_Pose', 'Death_B', 'Death_B_Pose',
  'Cheer', 'Interact', 'Jump_Idle', 'Jump_Land', 'Lie_Idle', 'Lie_StandUp', 'Lie_Pose', 'Sit_Floor_Idle', 'Sit_Chair_Idle',
  'Unarmed_Melee_Attack_Punch_A', 'Unarmed_Melee_Attack_Punch_B', 'Unarmed_Melee_Attack_Kick', '1H_Melee_Attack_Chop',
  '1H_Melee_Attack_Slice_Diagonal', '2H_Melee_Attack_Chop', 'Spellcast_Shoot', 'Dodge_Backward', 'Block', 'Blocking', 'Throw'
];
const io = new NodeIO();
async function run(file, out, keep) {
  const doc = await io.read(path.join(SRC, file));
  for (const a of doc.getRoot().listAnimations()) {
    if (keep.includes(a.getName())) continue;
    a.listChannels().forEach((c) => c.dispose());
    a.listSamplers().forEach((s) => s.dispose());
    a.dispose();
  }
  await doc.transform(resample({ tolerance: 1e-4 }), dedup(), prune());
  await io.write(path.join(OUT, out), doc);
  console.log(out, (fs.statSync(path.join(OUT, out)).size / 1024).toFixed(0) + ' KB', doc.getRoot().listAnimations().length + ' clips');
}
await run('Rogue_Hooded.glb', 'hooded.glb', CLIPS);
for (const n of ['Knight', 'Barbarian', 'Mage', 'Rogue']) await run(n + '.glb', n.toLowerCase() + '.glb', []);
