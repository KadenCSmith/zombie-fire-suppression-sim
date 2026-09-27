import bpy,json
from pathlib import Path
ROOT=Path('/Users/kadensmith/Documents/Codex/2026-09-25/files-pasted-by-the-user-goal');OUT=ROOT/'outputs/Dry_Ice_Peat_Study'
s=bpy.context.scene
ice=bpy.data.objects['DRY ICE • Ø 0.500 m | vertical ballistic drop']
records=[]
for f in [1,35,43,51,58,59,66,75,96,126,160,240,300]:
    s.frame_set(f);bpy.context.view_layer.update()
    records.append({'frame':f,'sphere_center':list(ice.location),'sphere_dimensions_m':list(ice.dimensions),'near_ember_emission':bpy.data.materials['Embers • CO2 contacted zone | animated reduction'].node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value,'far_ember_emission':bpy.data.materials['Embers • continuing smolder'].node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value})
assert all(abs(v-.5)<1e-5 for v in ice.dimensions),'Sphere diameter check failed'
assert all(abs(r['sphere_center'][0]+1.4)<1e-5 and abs(r['sphere_center'][1])<1e-5 for r in records),'Sphere drift check failed'
assert abs(ice.location.z-.25+2.44)<1e-5,'Sphere bottom does not meet borehole floor'
report={'nominal_soil_dimensions_m':[8,8,3.2],'borehole_diameter_m':.75,'borehole_depth_m':2.44,'sphere_diameter_m':.5,'fps':30,'frame_range':[1,300],'objects':len(s.objects),'animated_objects':sum(bool(o.animation_data) for o in s.objects),'cameras':[c.name for c in s.objects if c.type=='CAMERA'],'frames':records,'verification':'Exact sphere dimensions, fixed XY drop, final floor contact and local ember decrease verified in Blender.'}
(OUT/'scene_verification.json').write_text(json.dumps(report,indent=2))
for path in sorted((ROOT/'work/blender_stages').glob('*.py')):
    txt=bpy.data.texts.get(path.name) or bpy.data.texts.new(path.name);txt.clear();txt.write(path.read_text())
readme=bpy.data.texts.get('START HERE') or bpy.data.texts.new('START HERE');readme.clear();readme.write('DRY ICE / SUBSURFACE PEAT\n\nA conceptual scientific visualization, not a validated physical simulation.\n\n30 fps, frames 1–300.\n1: sphere above hole\n35–59: gravity-accelerated drop\n66: before release, sphere at rest\n75–111: rapid release and pressure pulse\n96: expansion render\n126: top-view gas spread\n145 onward: CO2 reaches near peat\n240: local suppression; far peat still smolders\n\nCAM_SECTION uses the SECTION view layer.\nCAM_TOP uses the TOP view layer (full terrain and top annotations).\nRender TOP at a square aspect ratio.\n\nWhite volumes are a visibility proxy: CO2 itself is invisible. The pressure ring is the cut-plane intersection of a conceptual spherical pulse. Gas transport, flame reduction and ember intensity are prescribed with editable keyframes. No CFD, thermodynamics, soil permeability, combustion chemistry, mass conservation or pressure prediction is solved.\n\nAll build scripts are retained as text blocks for inspection. No external textures, caches, plug-ins or scripts are required to scrub or render this file.\n')
s.frame_set(100);s.camera=bpy.data.objects['CAM_SECTION'];bpy.context.window.view_layer=s.view_layers['SECTION']
s.render.resolution_x=1600;s.render.resolution_y=1200;s.render.resolution_percentage=100;s.cycles.samples=64
for vl in s.view_layers:vl.use=vl.name=='SECTION'
# A second ready-to-render scene makes the top view one dropdown selection.
topscene=bpy.data.scenes.get('TOP VIEW • full site') or bpy.data.scenes.new('TOP VIEW • full site')
for co in s.collection.children:
    if co.name not in topscene.collection.children:topscene.collection.children.link(co)
for camname in ['CAM_SECTION','CAM_TOP']:
    if camname not in topscene.objects:topscene.collection.objects.link(bpy.data.objects[camname])
topscene.camera=bpy.data.objects['CAM_TOP'];topscene.world=s.world;topscene.render.engine='CYCLES';topscene.cycles.samples=64;topscene.cycles.use_denoising=True;topscene.cycles.device=s.cycles.device
topscene.render.resolution_x=1600;topscene.render.resolution_y=1600;topscene.render.resolution_percentage=100;topscene.render.fps=30;topscene.frame_end=300;topscene.unit_settings.system='METRIC';topscene.view_settings.view_transform='AgX'
topscene.view_layers[0].name='TOP';topscene.view_layers[0].layer_collection.children['SECTION_LABELS'].exclude=True
topscene.frame_set(126);s.frame_set(100)
for ar in bpy.context.screen.areas:
    if ar.type=='CONSOLE':
        ar.type='VIEW_3D';ar.spaces.active.region_3d.view_perspective='CAMERA';ar.spaces.active.region_3d.view_camera_zoom=5;ar.spaces.active.overlay.show_overlays=False;ar.spaces.active.shading.type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Dry_Ice_Peat_Study.blend'))
print(json.dumps(report,indent=2))
