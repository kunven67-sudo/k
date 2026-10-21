# Converts one Microsoft Rocketbox avatar (MIT) into a game-ready GLB.
#   python convert_avatar.py -- <avatar folder> <out.glb> [texture size]
# - uses the *_facial.fbx (80-bone Biped rig + 176 face shape keys); keeps the
#   15 visemes (lip sync) and the 52 ARKit expressions, drops the rest
# - relinks the textures (the FBX points at the author's D:\ drive)
# - turns the specular maps into roughness maps (glTF has no specular-gloss)
# - WebP textures, no animations (those are converted separately)
import bpy, sys, os, glob
import numpy as np

args = sys.argv[sys.argv.index('--') + 1:]
src_dir, out_path = args[0], args[1]
tex_size = int(args[2]) if len(args) > 2 else 2048
name = os.path.basename(os.path.normpath(src_dir))

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)

fbx = os.path.join(src_dir, 'Export', f'{name}_facial.fbx')
if not os.path.exists(fbx):
    fbx = os.path.join(src_dir, 'Export', f'{name}.fbx')
bpy.ops.import_scene.fbx(filepath=fbx, use_anim=False)

tex_dir = os.path.join(src_dir, 'Textures')
textures = {os.path.basename(p).lower(): p for p in glob.glob(os.path.join(tex_dir, '*'))}


def relink(img):
    base = os.path.basename(img.filepath.replace('\\', '/')).lower()
    if base in textures:
        img.filepath = textures[base]
        img.reload()
        return True
    print('MISSING TEXTURE', img.name, img.filepath)
    return False


def resized(img):
    if img.size[0] > tex_size:
        img.scale(tex_size, tex_size)
    return img


def roughness_from_specular(spec):
    # Rocketbox specular maps: bright = shiny. Roughness = 1 - shininess, kept
    # inside a skin-friendly range so faces don't look plastic or chalky.
    w, h = spec.size
    px = np.empty(w * h * 4, dtype=np.float32)
    spec.pixels.foreach_get(px)
    px = px.reshape(-1, 4)
    lum = px[:, 0] * 0.3 + px[:, 1] * 0.59 + px[:, 2] * 0.11
    # the maps are dark (mostly < 0.15), so scale by the bright end first
    shine = np.clip(lum / max(np.percentile(lum, 98), 1e-3), 0, 1)
    rough = np.clip(0.88 - shine * 0.45, 0.4, 0.9).astype(np.float32)
    out = bpy.data.images.new(spec.name + '_rough', w, h, alpha=False)
    out.colorspace_settings.name = 'Non-Color'
    pix = np.stack([rough, rough, rough, np.ones_like(rough)], axis=1).ravel()
    out.pixels.foreach_set(pix)
    out.update()
    out.pack()  # otherwise the exporter sees an empty (black = mirror-shiny) image
    return out


for img in list(bpy.data.images):
    if img.source == 'FILE':
        relink(img)

for mat in bpy.data.materials:
    if not mat.node_tree:
        continue
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not bsdf:
        continue
    bsdf.inputs['Metallic'].default_value = 0.0
    for n in list(nodes):
        # (images load lazily: reading .size loads them)
        if n.type != 'TEX_IMAGE' or not n.image or n.image.size[0] == 0:
            continue
        fname = os.path.basename(n.image.filepath).lower()
        resized(n.image)
        if 'specular' in fname:
            # replace the specular hookup with a roughness map
            for l in list(n.outputs[0].links):
                links.remove(l)
            rough = roughness_from_specular(n.image)
            n.image = rough
            links.new(n.outputs['Color'], bsdf.inputs['Roughness'])
            bsdf.inputs['Specular IOR Level'].default_value = 0.5
        elif 'normal' in fname:
            n.image.colorspace_settings.name = 'Non-Color'
    if 'opacity' in mat.name.lower():
        # hair cards, eyelashes: color + alpha from the same map
        color = next((n for n in nodes if n.type == 'TEX_IMAGE' and n.image and 'opacity' in os.path.basename(n.image.filepath).lower()), None)
        if color:
            links.new(color.outputs['Alpha'], bsdf.inputs['Alpha'])
        # hair is soft and only a little shiny (the FBX asks for 2x specular = plastic)
        bsdf.inputs['Specular IOR Level'].default_value = 0.25
        bsdf.inputs['Roughness'].default_value = 0.6

# keep only visemes (AA_VI_*) and ARKit (AK_*) shape keys
KEEP = ('AA_VI_', 'AK_')
for o in bpy.data.objects:
    if o.type == 'MESH' and o.data.shape_keys:
        for kb in list(o.data.shape_keys.key_blocks):
            if kb.name != 'Basis' and not kb.name.startswith(KEEP):
                o.shape_key_remove(kb)

# drop helper objects and unused materials
for o in list(bpy.data.objects):
    if o.type not in ('MESH', 'ARMATURE'):
        bpy.data.objects.remove(o)

bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    export_image_format='WEBP',
    export_image_quality=90,
    export_animations=False,
    export_morph=True,
    export_morph_normal=False,
    export_skins=True,
    export_yup=True,
    export_apply=False,
)
print('WROTE', out_path, os.path.getsize(out_path))
