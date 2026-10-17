# Builds the player's body with MPFB (MakeHuman for Blender, CC0 assets) and exports a GLB.
# Run: blender -b --python tools/avatar/make_avatar.py -- <out.glb>
import sys, bpy

out = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '/tmp/avatar.glb'

from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.locationservice import LocationService

bpy.ops.wm.read_factory_settings(use_empty=True)

info = HumanService._create_default_human_info_dict()
info['name'] = 'Player'
info['phenotype'].update({'gender': 1.0, 'age': 0.5, 'muscle': 0.55, 'weight': 0.47,
                          'proportions': 0.65, 'height': 0.55, 'cupsize': 0.5, 'firmness': 0.5,
                          'race': {'asian': 0.1, 'caucasian': 0.8, 'african': 0.1}})
info['rig'] = 'game_engine'
info['eyes'] = 'high-poly/high-poly.mhclo'
info['eyebrows'] = 'eyebrow001/eyebrow001.mhclo'
info['eyelashes'] = 'eyelashes01/eyelashes01.mhclo'
info['hair'] = 'short02/short02.mhclo'
info['clothes'] = ['male_casualsuit02/male_casualsuit02.mhclo', 'male_casualsuit06/male_casualsuit06.mhclo',
                   'shoes06/shoes06.mhclo']
info['skin_mhmat'] = LocationService.get_user_data('skins/young_caucasian_male/young_caucasian_male.mhmat')
info['skin_material_type'] = 'GAMEENGINE'
info['eyes_material_type'] = 'GAMEENGINE'
info['clothes_material_type'] = 'GAMEENGINE'
info['eyes_material_settings'] = {}

settings = HumanService.get_default_deserialization_settings()
settings['subdiv_levels'] = 0
basemesh = HumanService.deserialize_from_dict(info, settings)

# Clothes normally cut the body out with MASK modifiers. Two outfits share this body, so instead of
# cutting, store "covered by outfit X" in a color attribute and let the game hide those parts.
body = basemesh
groups = {vg.name: vg.index for vg in body.vertex_groups}
print('VGROUPS', [g for g in groups if g.startswith('Delete')])
for m in list(body.modifiers):
    if m.type == 'MASK' and m.vertex_group.startswith('Delete'):
        body.modifiers.remove(m)
chan = {'Delete.male_casualsuit02': 0, 'Delete.male_casualsuit06': 1, 'Delete.shoes06': 2}
mesh = body.data
attr = mesh.color_attributes.new('cover', 'BYTE_COLOR', 'POINT')
idx_of = {groups[k]: c for k, c in chan.items() if k in groups}
for v in mesh.vertices:
    col = [0.0, 0.0, 0.0, 1.0]
    for g in v.groups:
        if g.group in idx_of and g.weight > 0.5:
            col[idx_of[g.group]] = 1.0
    attr.data[v.index].color = col
mesh.color_attributes.active_color = attr

for o in bpy.data.objects:
    print('OBJ', o.name, o.type, [m.type + ':' + m.name for m in getattr(o, 'modifiers', [])])

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_apply=True,
                          export_skins=True, export_animations=False, export_yup=True,
                          export_vertex_color='ACTIVE', export_all_vertex_colors=False,
                          export_image_format='AUTO', export_materials='EXPORT', export_morph=False)
print('EXPORTED', out)
