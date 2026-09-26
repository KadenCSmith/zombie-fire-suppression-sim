"""Export the approved material review as a portable app asset; source stays read-only.

blender -b docs/review/material-stage2/Materials_Thermal_Stage_2.blend \
  --python-exit-code 1 --python scripts/export_study_asset.py
"""
import hashlib
import json
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
source = Path(bpy.data.filepath)
source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
scene = bpy.data.scenes['01 MATERIALS • Stage 2']
bpy.context.window.scene = scene
bpy.context.window.view_layer = scene.view_layers['MATERIAL_REVIEW']
scene.frame_set(66)
bpy.context.view_layer.update()

# glTF carries standard PBR materials, not Blender procedural node networks.
# Simplify only this in-memory export; preserve UVs and authored geometry.
colors = {
 'O • fibrous humus': (.07,.047,.023,1),
 'A • organic loam': (.18,.12,.058,1),
 'B • iron-stained subsoil': (.29,.21,.13,1),
 'C • sandy parent material': (.40,.35,.26,1),
 'Root • discontinuous char over surviving bark': (.022,.014,.008,1),
}
selected=[]
for obj in bpy.context.view_layer.objects:
    obj.select_set(False)
for obj in bpy.context.view_layer.objects:
    if obj.type not in {'MESH','CURVE'} or not obj.visible_get() or obj.hide_render:
        continue
    if obj.name == 'Neutral ground' or 'editable cutter' in obj.name:
        continue
    if any(c.name in {'CO2','FIRE','SHOCKWAVE','LIGHTING','ANNOTATIONS','SECTION_LABELS','TOP_LABELS'} for c in obj.users_collection):
        continue
    obj.select_set(True)
    selected.append(obj)
assert any(o.name.startswith('DRY ICE') for o in selected)
assert any(o.name.startswith('Peat lens') for o in selected)
materials={m for o in selected for m in o.data.materials if m}
for mat in materials:
    if not mat.use_nodes:continue
    old=mat.node_tree.nodes.get('Principled BSDF')
    color=tuple(old.inputs['Base Color'].default_value) if old else tuple(mat.diffuse_color)
    rough=float(old.inputs['Roughness'].default_value) if old else .9
    for prefix,value in colors.items():
        if mat.name.startswith(prefix):color=value
    if 'frost' in mat.name.lower() or 'dry ice' in mat.name.lower():color=(.78,.86,.91,1)
    images=[n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image]
    mat.node_tree.nodes.clear()
    nodes,links=mat.node_tree.nodes,mat.node_tree.links
    bsdf=nodes.new('ShaderNodeBsdfPrincipled');bsdf.inputs['Base Color'].default_value=color
    bsdf.inputs['Roughness'].default_value=max(.65,min(1,rough))
    out=nodes.new('ShaderNodeOutputMaterial');links.new(bsdf.outputs['BSDF'],out.inputs['Surface'])
    for image in images:
        if '_diff_' in image.name:
            tex=nodes.new('ShaderNodeTexImage');tex.image=image
            links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
        elif '_rough_' in image.name:
            tex=nodes.new('ShaderNodeTexImage');tex.image=image
            links.new(tex.outputs['Color'],bsdf.inputs['Roughness'])
    mat.diffuse_color=color
scene['Scientific status']='Conceptual illustration, not solver output. Thermal palette and animation are defined by the app.'
output=ROOT/'public/models/peat-study.glb'
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,
                         export_animations=False,export_current_frame=True,export_cameras=False,export_lights=False,
                         export_apply=True,export_extras=False,export_yup=True)
assert hashlib.sha256(source.read_bytes()).hexdigest()==source_hash
report={'source':str(source.relative_to(ROOT)),'source_sha256':source_hash,
        'asset':'public/models/peat-study.glb','asset_sha256':hashlib.sha256(output.read_bytes()).hexdigest(),
        'bytes':output.stat().st_size,'selected_objects':len(selected),'materials':len(materials),
        'source_object':next(o.name for o in selected if o.name.startswith('DRY ICE')),
        'peat_object':next(o.name for o in selected if o.name.startswith('Peat lens')),
        'frame':66,'coordinate_mapping':'Blender (x,y,z) -> glTF (x,z,-y), meters',
        'scope':'Approved geometry with simplified web PBR materials; no source edits or exported animation',
        'texture_license':'CC0; Poly Haven Bark Brown 01 and Forrest Ground 03; see THIRD_PARTY_NOTICES.md'}
(ROOT/'public/models/peat-study.manifest.json').write_text(json.dumps(report,indent=2)+'\n')
print('STUDY_ASSET '+json.dumps(report),flush=True)
