# Packs Rocketbox motion-capture clips (MIT) into one GLB of animations.
#   python convert_anims.py -- <out.glb> <clip.fbx> [<clip.fbx> ...]
# Every Rocketbox avatar uses the same "Bip01" 3ds Max Biped skeleton, so one
# set of clips drives all of them. The first file's armature is kept as the
# carrier; each file's action is renamed after the file ("m_walk_neutral_01").
# The mesh-less armature + actions export as named glTF animations.
import bpy, sys, os

args = sys.argv[sys.argv.index('--') + 1:]
out_path, files = args[0], args[1:]

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)

carrier = None
for i, f in enumerate(files):
    clip = os.path.basename(f).replace('.max.fbx', '').replace('.fbx', '').replace(' ', '_')
    before = set(bpy.data.objects)
    before_actions = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=f, use_anim=True, automatic_bone_orientation=False)
    new_objs = [o for o in bpy.data.objects if o not in before]
    arm = next((o for o in new_objs if o.type == 'ARMATURE'), None)
    if not arm or not arm.animation_data or not arm.animation_data.action:
        print('NO ANIMATION', f)
        for o in new_objs:
            bpy.data.objects.remove(o)
        continue
    act = arm.animation_data.action
    act.name = clip
    act.use_fake_user = True
    # the footsteps helper's own action is not needed
    for a in set(bpy.data.actions) - before_actions:
        if a is not act:
            bpy.data.actions.remove(a)
    if carrier is None:
        carrier = arm
        carrier.name = 'Bip01'
        for o in new_objs:
            if o is not arm:
                bpy.data.objects.remove(o)
    else:
        for o in new_objs:
            bpy.data.objects.remove(o)
    print(f'CLIP {i + 1}/{len(files)} {clip} frames={tuple(act.frame_range)}')

# put every action on its own NLA track so the exporter writes each as an animation
carrier.animation_data.action = None
for act in bpy.data.actions:
    tr = carrier.animation_data.nla_tracks.new()
    tr.name = act.name
    tr.strips.new(act.name, int(act.frame_range[0]), act)
    tr.mute = True

bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    export_animations=True,
    export_animation_mode='NLA_TRACKS',
    export_optimize_animation_size=True,
    export_force_sampling=True,
    export_frame_step=1,
    export_skins=True,
    export_morph=False,
    export_yup=True,
)
print('WROTE', out_path, os.path.getsize(out_path), 'clips', len(bpy.data.actions))
