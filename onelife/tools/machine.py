# Blender: build the respawn machine from scratch (no stitched-together store models).
# blender -b --factory-startup --python tools/machine.py -- <out.glb>
# Parts are named by material: metal_*, glass, glow_*, cable, screen, floor. The game gives them real textures.
import bpy, bmesh, sys, math
out = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)

def finish(o, name, bevel=0.0, seg=3, uv=True):
    o.name = name
    if bevel:
        m = o.modifiers.new('bevel', 'BEVEL'); m.width = bevel; m.segments = seg; m.limit_method = 'ANGLE'; m.angle_limit = math.radians(35); m.harden_normals = False
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    if uv:
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.cube_project(cube_size=1.0); bpy.ops.object.mode_set(mode='OBJECT')
    try: bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
    except Exception: bpy.ops.object.shade_smooth()
    o.select_set(False)
    return o

def cyl(name, r, depth, z, verts=48, bevel=0.0, caps=True):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=(0, 0, z), end_fill_type='NGON' if caps else 'NOTHING')
    return finish(bpy.context.active_object, name, bevel)

def torus(name, R, r, z):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=64, minor_segments=10, location=(0, 0, z))
    return finish(bpy.context.active_object, name, 0, uv=False)

def box(name, sx, sy, sz, loc, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot); o = bpy.context.active_object; o.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, name, bevel)

# ---- base: heavy stepped plinth ----
cyl('metal_dark_skirt', 1.14, 0.08, 0.04, bevel=0.02)
cyl('metal_base', 1.0, 0.26, 0.17, bevel=0.035)
cyl('floor', 0.72, 0.02, 0.305, verts=64)
torus('glow_floor', 0.75, 0.016, 0.31)
# ---- glass tube with a doorway facing front (-Y in Blender = +Z in the game) ----
bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.8, depth=2.05, location=(0, 0, 1.33), end_fill_type='NOTHING')
g = bpy.context.active_object
bm = bmesh.new(); bm.from_mesh(g.data)
gone = [f for f in bm.faces if (lambda c: (math.degrees(math.atan2(c.y, c.x)) % 360))(f.calc_center_median()) > 232 and (math.degrees(math.atan2(f.calc_center_median().y, f.calc_center_median().x)) % 360) < 308]
bmesh.ops.delete(bm, geom=gone, context='FACES'); bm.to_mesh(g.data); bm.free()
sol = g.modifiers.new('thick', 'SOLIDIFY'); sol.thickness = 0.012
finish(g, 'glass', 0, uv=False)
# ---- three pillars (back + both sides of the doorway) ----
for a in (90, 220, 320):
    t = math.radians(a)
    box('metal_pillar', 0.11, 0.17, 2.1, (math.cos(t) * 0.86, math.sin(t) * 0.86, 1.33), (0, 0, t + math.pi / 2), bevel=0.02)
# ---- top: housing, inner glow ring, cap ----
torus('glow_top', 0.75, 0.02, 2.33)
cyl('metal_top', 1.0, 0.3, 2.5, bevel=0.035)
cyl('metal_dark_band', 1.02, 0.06, 2.42, bevel=0.01)
cyl('metal_cap', 0.56, 0.14, 2.72, bevel=0.03)
# vents around the housing
for i in range(16):
    t = math.radians(i * 22.5 + 11)
    if 240 < (i * 22.5 + 11) < 300: continue
    box('metal_dark_vent', 0.03, 0.14, 0.16, (math.cos(t) * 1.0, math.sin(t) * 1.0, 2.53), (0, 0, t), bevel=0.006)
# ---- power cables from the housing down into the ground behind ----
for i, (x, spread) in enumerate(((-0.35, -0.5), (0.0, 0.0), (0.35, 0.5))):
    bpy.ops.curve.primitive_bezier_curve_add(location=(0, 0, 0)); c = bpy.context.active_object
    sp = c.data.splines[0]; p0, p1 = sp.bezier_points
    p0.co = (x * 0.8, 0.95, 2.45); p0.handle_left = (x * 0.8, 0.9, 2.6); p0.handle_right = (x * 0.9, 1.35, 2.3)
    p1.co = (x * 1.6 + spread, 2.1, -0.05); p1.handle_left = (x * 1.4 + spread, 1.95, 0.6); p1.handle_right = (x * 1.6 + spread, 2.2, -0.3)
    c.data.bevel_depth = 0.04 if i == 1 else 0.03; c.data.bevel_resolution = 4; c.data.resolution_u = 24
    bpy.ops.object.convert(target='MESH'); finish(bpy.context.active_object, 'cable', 0, uv=False)
# ---- control post + tilted panel + screen, front right of the doorway ----
box('metal_post', 0.09, 0.09, 1.0, (1.18, -0.62, 0.5), bevel=0.012)
box('metal_panel', 0.46, 0.05, 0.34, (1.18, -0.66, 1.08), (math.radians(-35), 0, 0), bevel=0.012)
bpy.ops.mesh.primitive_plane_add(size=1, location=(1.18, -0.69, 1.085), rotation=(math.radians(90 - 35), 0, 0))
s = bpy.context.active_object; s.scale = (0.38, 0.26, 1); bpy.ops.object.transform_apply(scale=True); s.name = 'screen'
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, export_yup=True, export_materials='NONE')
print('MACHINE DONE', len(bpy.data.objects))
