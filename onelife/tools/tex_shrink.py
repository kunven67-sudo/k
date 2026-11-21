# Blender: re-export a GLB with every texture scaled down to SIZE and saved as WebP.
# blender -b --factory-startup --python tools/tex_shrink.py -- <in.glb> <out.glb> <size>
import bpy, sys
a = sys.argv[sys.argv.index('--') + 1:]
src, out, size = a[0], a[1], int(a[2])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
for img in bpy.data.images:
    if img.size[0] > size:
        img.scale(size, size)
        print('IMG', img.name, img.size[:])
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='WEBP', export_animations=True,
                          export_animation_mode='ACTIONS', export_skins=True, export_yup=True)
print('DONE', out)
