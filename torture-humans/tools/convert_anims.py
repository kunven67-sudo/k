# Converts Rocketbox motion-capture clips (MIT) into one small GLB per clip.
#   python convert_anims.py -- <out dir> <clip.fbx> [<clip.fbx> ...]
# Every Rocketbox avatar uses the same "Bip01" 3ds Max Biped skeleton, so each
# clip drives all of them. One file per clip keeps Blender's memory flat (packing
# 200+ clips into one export needs >11 GB) and lets the game load clips on demand.
# Output: <out dir>/<clip>.glb, e.g. m_walk_neutral_01.glb
import bpy, sys, os

args = sys.argv[sys.argv.index('--') + 1:]
out_dir, files = args[0], args[1:]
os.makedirs(out_dir, exist_ok=True)


def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    for coll in (bpy.data.actions, bpy.data.armatures, bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for d in list(coll):
            coll.remove(d)


for i, f in enumerate(files):
    clip = os.path.basename(f).replace('.max.fbx', '').replace('.fbx', '').replace(' ', '_')
    out = os.path.join(out_dir, f'{clip}.glb')
    if os.path.exists(out) and os.path.getmtime(out) > os.path.getmtime(f):
        print(f'SKIP {clip} (up to date)')
        continue
    clear()
    bpy.ops.import_scene.fbx(filepath=f, use_anim=True, automatic_bone_orientation=False)
    arm = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
    if not arm or not arm.animation_data or not arm.animation_data.action:
        print('NO ANIMATION', f)
        continue
    for o in list(bpy.data.objects):
        if o is not arm:
            bpy.data.objects.remove(o)
    act = arm.animation_data.action
    act.name = clip
    for a in list(bpy.data.actions):
        if a is not act:
            bpy.data.actions.remove(a)
    arm.name = 'Bip01'
    bpy.context.scene.frame_start = int(act.frame_range[0])
    bpy.context.scene.frame_end = int(act.frame_range[1])
    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format='GLB',
        export_animations=True,
        export_animation_mode='ACTIVE_ACTIONS',
        export_optimize_animation_size=True,
        export_force_sampling=True,
        export_skins=True,
        export_morph=False,
        export_yup=True,
    )
    print(f'CLIP {i + 1}/{len(files)} {clip} frames={tuple(act.frame_range)} bytes={os.path.getsize(out)}')
