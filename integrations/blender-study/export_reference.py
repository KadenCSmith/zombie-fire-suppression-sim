"""Export a compact, explicitly illustrative animation without editing a .blend.

blender -b integrations/blender-study/Dry_Ice_Peat_Study.blend \
  --python-exit-code 1 --python integrations/blender-study/export_reference.py
"""
import hashlib
import json
import math
import struct
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
source = Path(bpy.data.filepath)
assert source.name == 'Dry_Ice_Peat_Study.blend', 'Use the preserved study, never a historical Stage2 file.'
source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
scene = bpy.context.scene
bpy.context.window.view_layer = scene.view_layers['SECTION']
scene.frame_set(66)
selected = []
omitted = {'LIGHTING', 'ANNOTATIONS', 'SECTION_LABELS', 'TOP_LABELS', 'SHOCKWAVE'}
for obj in bpy.context.view_layer.objects:
    obj.select_set(False)
for obj in list(bpy.context.view_layer.objects):
    if obj.type not in {'MESH', 'CURVE'} or not obj.visible_get() or obj.hide_render:
        continue
    if obj.name == 'Neutral ground' or 'editable cutter' in obj.name:
        continue
    if any(c.name in omitted for c in obj.users_collection):
        continue
    # Blender volumetric shading cannot survive glTF: fog is instead a clearly
    # labeled transparent surface proxy; smoke/flames are omitted, not fabricated.
    if any(c.name == 'FIRE' for c in obj.users_collection):
        continue
    obj.select_set(True)
    selected.append(obj)

palette = {
    'O •': (.065, .045, .025, 1), 'A •': (.16, .10, .047, 1),
    'B •': (.31, .21, .115, 1), 'C •': (.41, .34, .23, 1),
}
materials = {m for obj in selected for m in obj.data.materials if m}
for mat in materials:
    old = mat.node_tree.nodes.get('Principled BSDF') if mat.use_nodes else None
    color = tuple(old.inputs['Base Color'].default_value) if old else tuple(mat.diffuse_color)
    for prefix, rgba in palette.items():
        if mat.name.startswith(prefix): color = rgba
    if 'dry ice' in mat.name.lower() or 'frost' in mat.name.lower(): color = (.72, .85, .91, 1)
    proxy = any(n.bl_idname == 'ShaderNodeVolumePrincipled' for n in mat.node_tree.nodes) if mat.use_nodes else False
    if proxy: color = (.37, .72, .76, .17)
    mat.use_nodes = True
    mat.node_tree.animation_data_clear()
    mat.node_tree.nodes.clear()
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.new('ShaderNodeBsdfPrincipled')
    shader.inputs['Base Color'].default_value = color
    shader.inputs['Alpha'].default_value = color[3]
    shader.inputs['Roughness'].default_value = .9
    out = nodes.new('ShaderNodeOutputMaterial')
    links.new(shader.outputs['BSDF'], out.inputs['Surface'])
    mat.diffuse_color = color
    if proxy:
        mat.surface_render_method = 'DITHERED'

for obj in selected:
    obj['scientific_role'] = 'conceptual_reference'
    if any(c.name == 'CO2' for c in obj.users_collection):
        obj['scientific_role'] = 'prescribed_visible_gas_proxy'
    if obj.name.startswith('DRY ICE'):
        obj['scientific_role'] = 'prescribed_source_trajectory'

# Merge immutable context by material to keep browser draw calls proportional to
# material count. Keep every animated object/descendant separate for exact motion.
source_object_count = len(selected)
def has_motion(obj):
    return bool(obj.animation_data or (obj.parent and has_motion(obj.parent)))
animated = [obj for obj in selected if has_motion(obj)]
static = [obj for obj in selected if not has_motion(obj)]
for obj in selected: obj.select_set(False)
for obj in static: obj.select_set(True)
bpy.context.view_layer.objects.active = static[0]
bpy.ops.object.convert(target='MESH')
groups = {}
for obj in bpy.context.selected_objects:
    key = tuple(m.name if m else '' for m in obj.data.materials)
    groups.setdefault(key, []).append(obj)
merged = []
for index, objects in enumerate(groups.values()):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1: bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = f'Concept context material group {index:02d}'
    obj['scientific_role'] = 'static_conceptual_context'
    merged.append(obj)
selected = merged + animated
bpy.ops.object.select_all(action='DESELECT')
for obj in selected: obj.select_set(True)

output = ROOT / 'public/models/dry-ice-reference-animation.glb'
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(output), export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='ACTIVE_ACTIONS',
    export_nla_strips_merged_animation_name='Conceptual study • prescribed motion',
    export_force_sampling=True, export_frame_step=3, export_frame_range=True,
    export_anim_slide_to_zero=True, export_cameras=False, export_lights=False,
    export_apply=True, export_extras=True, export_yup=True,
)
assert hashlib.sha256(source.read_bytes()).hexdigest() == source_hash
binary = output.read_bytes()
gltf = json.loads(binary[20:20 + struct.unpack_from('<I', binary, 12)[0]])
clip_seconds = max(gltf['accessors'][sampler['input']]['max'][0]
                   for animation in gltf.get('animations', []) for sampler in animation['samplers'])
points = [obj.matrix_world @ Vector(v) for obj in selected for v in obj.bound_box]
report = {
    'source_repository': 'https://github.com/KadenCSmith/dry-ice-peat-study',
    'source_commit': '596bf84a32ed92d7dcddd7ba15001cb2fe258b0c',
    'source': str(source.relative_to(ROOT)), 'source_sha256': source_hash,
    'asset': str(output.relative_to(ROOT)), 'asset_sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
    'bytes': output.stat().st_size, 'objects': len(selected), 'source_objects': source_object_count,
    'static_material_groups': len(merged), 'animation_duration_s': clip_seconds,
    'coordinate_mapping': 'Blender (x,y,z) -> glTF (x,z,-y); meters; Y-up',
    'fps': scene.render.fps, 'first_frame': 1, 'last_frame': 300,
    'source_duration_s': (scene.frame_end - scene.frame_start) / scene.render.fps,
    'recommended_camera': [8, 6, 10], 'recommended_target': [0, -.3, 0],
    'blender_bounds_at_frame_66': [[min(p[i] for p in points), max(p[i] for p in points)] for i in range(3)],
    'source_sphere': {'diameter_m': .5, 'rest_position_blender_m': [-1.4, 0, -2.19],
                      'mass_kg_at_density_1560': 1560 * 4 / 3 * math.pi * .25 ** 3},
    'scope': 'Conceptual prescribed animation, not accepted solver output. Timeline phase may be compared, never equated to solver seconds. Source placement/mass and peat geometry differ from coupled model.',
    'conversion': 'Surface PBR colors simplify procedural shading. CO2 volumes become transparent geometric visibility proxies. Shader-only density/combustion changes, flames, smoke and pressure graphics are not exported. Object transforms sampled every 3 frames.',
    'license': 'Original authored-geometry licensing unchanged; no project license selected.',
}
(output.with_suffix('.manifest.json')).write_text(json.dumps(report, indent=2) + '\n')
print('REFERENCE_EXPORT ' + json.dumps(report), flush=True)
