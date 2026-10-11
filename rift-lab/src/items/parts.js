// Shape helpers shared by every catalog file. Units: meters. y = 0 is the floor/bottom of the
// item, centered on x/z. Same parts make the 3D model AND the physics shapes.

export const box = (w, h, d, x, y, z, mat, o = {}) => ({ s: 'box', size: [w, h, d], p: [x, y, z], mat, ...o });
export const cyl = (r, h, x, y, z, mat, o = {}) => ({ s: 'cyl', r, h, p: [x, y, z], mat, ...o });
export const cone = (r, r2, h, x, y, z, mat, o = {}) => ({ s: 'cone', r, r2, h, p: [x, y, z], mat, ...o }); // r = bottom, r2 = top
export const sph = (r, x, y, z, mat, o = {}) => ({ s: 'sphere', r, p: [x, y, z], mat, ...o });
export const cap = (r, h, x, y, z, mat, o = {}) => ({ s: 'capsule', r, h, p: [x, y, z], mat, ...o }); // h = straight middle length
// revolved profile: [[radius, y], ...] from the bottom center up (bottles, apples, jars, bowls)
export const lathe = (profile, x, y, z, mat, o = {}) => ({ s: 'hull', lathe: profile, p: [x, y, z], mat, ...o });
// bent tube along a centerline [[x,y,z]...] with radius r (or rs: one radius per point); rounded ends
export const curve = (pts, r, x, y, z, mat, o = {}) => ({ s: 'curve', pts, r, p: [x, y, z], mat, ...o });
