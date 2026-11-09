# Makes game-ready versions of heavy CC0 models (photo-scanned rocks can have
# over a million triangles). Each mesh is decimated to a triangle budget; the
# textures (incl. normal maps, which carry the fine detail) are kept, so it looks
# nearly the same at a fraction of the cost.
#   python optimize_models.py -- <cc0 dir> <out dir> [max triangles per model]
# Writes <out>/<id>.glb for models over budget and <out>/index.json {id: triangles}.
import bpy, sys, os, json, glob

args = sys.argv[sys.argv.index('--') + 1:]
src, out = args[0], args[1]
budget = int(args[2]) if len(args) > 2 else 20000
os.makedirs(out, exist_ok=True)
index_path = os.path.join(out, 'index.json')
result = json.load(open(index_path)) if os.path.exists(index_path) else {}


def tri_count(objs):
    n = 0
    for o in objs:
        if o.type == 'MESH':
            n += sum(len(p.vertices) - 2 for p in o.data.polygons)
    return n


def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for d in list(coll):
            coll.remove(d)


for gltf in sorted(glob.glob(os.path.join(src, 'models', '*', '*.gltf'))):
    mid = os.path.basename(os.path.dirname(gltf))
    dest = os.path.join(out, f'{mid}.glb')
    if mid in result and os.path.exists(dest):
        continue
    # quick count from the JSON before paying for a Blender import
    j = json.load(open(gltf))
    tris = 0
    for me in j['meshes']:
        for p in me['primitives']:
            a = j['accessors'][p['indices']] if 'indices' in p else j['accessors'][p['attributes']['POSITION']]
            tris += a['count'] // 3
    if tris <= budget:
        continue
    clear()
    bpy.ops.import_scene.gltf(filepath=gltf)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    total = tri_count(meshes)
    for o in meshes:
        share = tri_count([o]) / max(1, total)
        ratio = min(1.0, (budget * share) / max(1, tri_count([o])))
        if ratio >= 1:
            continue
        mod = o.modifiers.new('decimate', 'DECIMATE')
        mod.decimate_type = 'COLLAPSE'
        mod.ratio = ratio
        mod.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.modifier_apply(modifier=mod.name)
        o.select_set(False)
    after = tri_count([o for o in bpy.data.objects if o.type == 'MESH'])
    bpy.ops.export_scene.gltf(filepath=dest, export_format='GLB', export_image_format='WEBP', export_image_quality=88, export_animations=False)
    result[mid] = after
    print(f'OPT {mid}: {total} -> {after} triangles, {os.path.getsize(dest) // 1024} KB')
    json.dump(result, open(index_path, 'w'), indent=1, sort_keys=True)

json.dump(result, open(index_path, 'w'), indent=1, sort_keys=True)
print('optimized', len(result), 'models')
