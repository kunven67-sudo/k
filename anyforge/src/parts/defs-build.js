// Building blocks: the shapes everything is made of. Any size, any real material, any paint.
import * as geo from './geo.js';
import { mk } from './common.js';
import { partMaterial } from '../core/mats.js';

const mat = (p) => partMaterial(p.mat, p.color);
const half = (p) => [p.size.x / 2, p.size.y / 2, p.size.z / 2];
const hullOf = (pts) => ({ t: 'hull', pts: new Float32Array(pts.flat()) });

const block = (id, name, size, desc, extra = {}) => ({
  id, name, cat: 'Blocks', desc, size, resize: 'xyz', mat: 'steel',
  shapes: (p) => [{ t: 'box', h: half(p) }],
  mesh: (p) => mk(geo.box(p.size.x, p.size.y, p.size.z), mat(p)),
  ...extra
});

export const BUILD = [
  block('block', 'Block', [1, 1, 1], 'A solid block. Make it any size.'),
  block('plate', 'Plate', [1, 0.125, 1], 'A flat plate for floors, walls and wings.'),
  block('beam', 'Beam', [0.25, 0.25, 2], 'A long beam for frames and arms.'),
  block('brickwall', 'Brick Wall', [2, 1.5, 0.25], 'Real brick. Breaks apart when something hits it hard.', { mat: 'brick' }),
  block('crate', 'Wood Crate', [1, 1, 1], 'A wooden box. Breaks easy.', { mat: 'planks' }),
  block('pane', 'Glass Pane', [1, 1, 0.05], 'A window. Shatters when it gets hit.', { mat: 'glass' }),
  {
    id: 'wedge', name: 'Ramp', cat: 'Blocks', desc: 'A slope. Great for ramps and pointy noses.', size: [1, 1, 1], resize: 'xyz', mat: 'steel',
    shapes: (p) => [hullOf(geo.wedgePoints(p.size.x, p.size.y, p.size.z))],
    mesh: (p) => mk(geo.wedge(p.size.x, p.size.y, p.size.z), mat(p))
  },
  {
    id: 'corner', name: 'Corner', cat: 'Blocks', desc: 'A corner slope for roofs and noses.', size: [1, 1, 1], resize: 'xyz', mat: 'steel',
    shapes: (p) => [hullOf(geo.cornerPoints(p.size.x, p.size.y, p.size.z))],
    mesh: (p) => mk(geo.corner(p.size.x, p.size.y, p.size.z), mat(p))
  },
  {
    id: 'cylinder', name: 'Cylinder', cat: 'Blocks', desc: 'A round post, pipe or barrel.', size: [1, 1, 1], resize: 'round', mat: 'steel',
    shapes: (p) => [{ t: 'cyl', hh: p.size.y / 2, r: p.size.x / 2 }],
    mesh: (p) => mk(geo.cyl(p.size.x / 2, p.size.y, 32), mat(p))
  },
  {
    id: 'ball', name: 'Ball', cat: 'Blocks', desc: 'A sphere. Rolls.', size: [1, 1, 1], resize: 'uniform', mat: 'steel',
    shapes: (p) => [{ t: 'ball', r: p.size.x / 2 }],
    mesh: (p) => mk(geo.ball(p.size.x / 2, 32), mat(p))
  },
  {
    id: 'cone', name: 'Cone', cat: 'Blocks', desc: 'A cone. Rocket noses and spikes.', size: [1, 1, 1], resize: 'round', mat: 'steel',
    shapes: (p) => [{ t: 'cone', hh: p.size.y / 2, r: p.size.x / 2 }],
    mesh: (p) => mk(geo.cone(p.size.x / 2, p.size.y, 32), mat(p))
  },
  {
    id: 'pipe', name: 'Pipe', cat: 'Blocks', desc: 'A long round tube.', size: [0.25, 2, 0.25], resize: 'round', mat: 'alu',
    shapes: (p) => [{ t: 'cyl', hh: p.size.y / 2, r: p.size.x / 2 }],
    mesh: (p) => mk(geo.cyl(p.size.x / 2, p.size.y, 20), mat(p))
  }
];
