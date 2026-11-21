# Blender: open the CC0 ant, smooth it, export a game-ready GLB with its animations.
# blender -b <ant.blend> --python tools/ant_export.py -- <out.glb>
import bpy, sys
out = sys.argv[sys.argv.index('--') + 1]
print('OBJECTS', [(o.name, o.type, len(o.modifiers)) for o in bpy.data.objects])
print('ACTIONS', [(a.name, tuple(a.frame_range)) for a in bpy.data.actions])
for o in bpy.data.objects:
    if o.type == 'MESH':
        has = any(m.type == 'SUBSURF' for m in o.modifiers)
        if not has:
            m = o.modifiers.new('smooth', 'SUBSURF'); m.levels = 1; m.render_levels = 1
            # keep the armature deform last so the smoothing follows the bones
            arm = [i for i, mm in enumerate(o.modifiers) if mm.type == 'ARMATURE']
            if arm:
                bpy.context.view_layer.objects.active = o
                with bpy.context.temp_override(object=o):
                    bpy.ops.object.modifier_move_to_index(modifier='smooth', index=0)
        for p in o.data.polygons: p.use_smooth = True
        print('MESH', o.name, len(o.data.polygons), [mm.type for mm in o.modifiers])
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, export_apply=True, export_skins=True,
                          export_animation_mode='ACTIONS', export_yup=True)
print('EXPORTED', out)
