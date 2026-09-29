"""Create a new editable Blender derivative containing accepted solver snapshots.

blender --factory-startup -b --python-exit-code 1 \
  --python integrations/blender-study/import_accepted_physics.py -- \
  --cache coupled-scenario.json --output Unified_Accepted_Physics.blend \
  --reference integrations/blender-study/Dry_Ice_Peat_Study.blend --preview preview.png

One timeline frame = one exact accepted checkpoint; times are stored and labeled.
No interpolated states, smoke simulation, added heat, or amplification by default.
"""
import argparse
import hashlib
import json
import math
import random
from pathlib import Path
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cache_contract import FIELDS, blender_position, node_positions, point_displacement, surface_topology, validate_cache


def arguments():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--reference', type=Path)
    parser.add_argument('--preview', type=Path)
    parser.add_argument('--mode', default='coupled')
    parser.add_argument('--field', choices=list(FIELDS), default='temperatureK')
    parser.add_argument('--full-domain', action='store_true')
    return parser.parse_args(sys.argv[sys.argv.index('--')+1:])


def material(name, color):
    m = bpy.data.materials.new(name); m.use_nodes = True; m.diffuse_color = (*color,1)
    shader=m.node_tree.nodes.get('Principled BSDF'); shader.inputs['Base Color'].default_value=(*color,1)
    shader.inputs['Roughness'].default_value=.78
    return m


def mesh_object(name, vertices, faces, collection, mat):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);collection.objects.link(obj);mesh.materials.append(mat)
    return obj


def hold_visibility(obj, checkpoint, count):
    for key in ('hide_render', 'hide_viewport'):
        setattr(obj,key,True);obj.keyframe_insert(key,frame=0)
        if checkpoint>1:obj.keyframe_insert(key,frame=checkpoint-1)
        setattr(obj,key,False);obj.keyframe_insert(key,frame=checkpoint)
        setattr(obj,key,True);obj.keyframe_insert(key,frame=checkpoint+1)
    for curve in obj.animation_data.action.fcurves:
        for point in curve.keyframe_points:point.interpolation='CONSTANT'


args=arguments();data=json.loads(args.cache.read_text());grid,source,run=validate_cache(data,args.mode)
if args.output.resolve()==args.cache.resolve():raise ValueError('Output must differ from cache')
if args.output.suffix!='.blend':raise ValueError('Output must have .blend extension')
if 'Stage_2' in args.output.name or 'Stage2' in args.output.name:raise ValueError('Historical Stage2 files are protected')
source_hash=None
if args.reference:
    if args.reference.name!='Dry_Ice_Peat_Study.blend':raise ValueError('Reference must be the preserved original study, never Stage2')
    if args.output.resolve()==args.reference.resolve():raise ValueError('Output must be a new derivative')
    source_hash=hashlib.sha256(args.reference.read_bytes()).hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(args.reference.resolve()))
    bpy.context.scene.name='REFERENCE • prescribed illustration'
    bpy.context.scene['Scientific status']='Authored concept animation; mass, timing and geometry differ from solver. Not a prediction.'
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)

scene=bpy.data.scenes.new('PHYSICS • accepted checkpoints')
bpy.context.window.scene=scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
scene.frame_start=1;scene.frame_end=len(run['frames']);scene.render.fps=2
scene['Timeline convention']='One frame = one exact accepted solver checkpoint. Seconds are in markers and object properties; no interpolation.'
scene['Coordinates']='Solver (x,y,positive depth) -> Blender (x-W/2,y-L/2,-depth), meters. Displacements at true 1x scale.'
scene['Scientific status']='Numerical model with uncalibrated material laws; no field validation. Imported accepted history, not a second simulation.'
scene['Run status']=run['status'];scene['Run stop message']=run.get('message','')
scene['Cell count']=grid['nx']*grid['ny']*grid['nz'];scene['Selected scalar']=args.field
collection=bpy.data.collections.new('Accepted solver checkpoints');scene.collection.children.link(collection)
natural=bpy.data.scenes.new('NATURAL • accepted geometry')
natural.unit_settings.system='METRIC';natural.unit_settings.scale_length=1
natural.frame_start=1;natural.frame_end=len(run['frames']);natural.render.fps=2
natural['Scientific status']='Accepted geometry and finite source; colored strata and seeded aggregates are presentation only, not resolved material heterogeneity.'
natural['Timeline convention']=scene['Timeline convention']
natural_collection=bpy.data.collections.new('Natural presentation • accepted geometry');natural.collection.children.link(natural_collection)
natural_mats=[material('Presentation • organic top',(.072,.046,.023)),material('Presentation • dark loam',(.19,.12,.067)),material('Presentation • mineral subsoil',(.40,.28,.15)),material('Presentation • sandy base',(.54,.43,.27)),material('Peat fraction context',(.042,.025,.015))]
aggregate_mats=[material('Presentation aggregate '+str(i),color) for i,color in enumerate([(.12,.075,.041),(.25,.19,.12),(.42,.35,.26),(.56,.47,.31)])]
# Irregular faceted inclusions are deterministic cosmetic details. Their centers
# follow accepted Q1 displacement; their shape is not a solved aggregate model.
rng=random.Random(46023);aggregate_defs=[]
for index in range(260):
    depth=.04+rng.random()*(grid['depthM']-.08);x=.08+rng.random()*(grid['widthM']-.16)
    y=grid['lengthM']*(grid['ny']//2)/grid['ny'] if not args.full_domain else 0
    radius=.018+rng.random()**2*.11
    aggregate_defs.append(((x,y,depth),(radius*(.7+rng.random()*.7),radius*.22,radius*(.6+rng.random()*.6)),rng.randrange(4)))
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1)
template=bpy.context.object;aggregate_vertices=[tuple(v.co*(.8+rng.random()*.35)) for v in template.data.vertices];aggregate_faces=[tuple(p.vertices) for p in template.data.polygons]
template_mesh=template.data;bpy.data.objects.remove(template,do_unlink=True);bpy.data.meshes.remove(template_mesh)
mat=material('CELL FIELD • change Attribute name to select another field',(.1,.4,.5))
nodes,links=mat.node_tree.nodes,mat.node_tree.links
attribute=nodes.new('ShaderNodeAttribute');attribute.attribute_name=args.field
remap=nodes.new('ShaderNodeMapRange');remap.inputs['From Min'].default_value=FIELDS[args.field][1][0];remap.inputs['From Max'].default_value=FIELDS[args.field][1][1]
links.new(attribute.outputs['Fac'],remap.inputs['Value'])
ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements.remove(ramp.color_ramp.elements[1]);ramp.color_ramp.elements[0].color=(.025,.12,.23,1)
for position,color in [(0.25,(.04,.42,.58,1)),(.5,(.16,.68,.58,1)),(.75,(.93,.62,.19,1)),(1,(.76,.14,.07,1))]:ramp.color_ramp.elements.new(position).color=color
links.new(remap.outputs['Result'],ramp.inputs['Fac']);links.new(ramp.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color'])
ice_mat=material('Finite dry ice inventory',(.66,.86,.94));cap_mat=material('Calculated reduced cap shell',(.33,.39,.42))
used,faces,ids=surface_topology(grid,not args.full_domain)
count=len(run['frames'])
for idx,frame in enumerate(run['frames'],1):
    print(f'IMPORT_CHECKPOINT {idx}/{count} time_s={frame["timeS"]}',flush=True)
    mesh=mesh_object(f'Checkpoint {idx:03d} • t={frame["timeS"]:.9g} s',node_positions(grid,frame,used),faces,collection,mat)
    mesh['time_s']=frame['timeS'];mesh['checkpoint_index']=idx-1;mesh['display_displacement_scale']=1
    for key in FIELDS:
        att=mesh.data.attributes.new(key,'FLOAT','FACE');att.data.foreach_set('value',[frame[key][cell] for cell in ids])
    att=mesh.data.attributes.new('solver_cell_id','INT','FACE');att.data.foreach_set('value',ids)
    mesh['ledger_json']=json.dumps(frame['ledger']);hold_visibility(mesh,idx,count)
    # The natural counterpart shares exactly the accepted node geometry and cell
    # attributes. Material bands are explicitly presentation, never extra cells.
    natural_mesh=mesh.copy();natural_mesh.data=mesh.data.copy();natural_mesh.name=f'Natural accepted geometry {idx:03d}'
    natural_mesh.data.materials.clear()
    for m in natural_mats:natural_mesh.data.materials.append(m)
    material_ids=[];peat_fractions=frame.get('materialPeatFraction',[0]*len(frame['temperatureK']))
    for cell in ids:
        depth=(cell//(grid['nx']*grid['ny'])+.5)*grid['depthM']/grid['nz']
        material_ids.append(4 if peat_fractions[cell]>.5 else 0 if depth<.25 else 1 if depth<.7 else 2 if depth<2.2 else 3)
    natural_mesh.data.polygons.foreach_set('material_index',material_ids)
    natural_collection.objects.link(natural_mesh)
    vertices=[];quads=[];mat_ids=[]
    for point,scale,material_id in aggregate_defs:
        center=blender_position(grid,point,point_displacement(grid,frame,point));start=len(vertices)
        vertices.extend((center[0]+v[0]*scale[0],center[1]+v[1]*scale[1]-.006,center[2]+v[2]*scale[2]) for v in aggregate_vertices)
        quads.extend(tuple(start+v for v in f) for f in aggregate_faces);mat_ids.extend([material_id]*len(aggregate_faces))
    grains=mesh_object(f'Presentation aggregates {idx:03d}',vertices,quads,natural_collection,aggregate_mats[0])
    for m in aggregate_mats[1:]:grains.data.materials.append(m)
    grains.data.polygons.foreach_set('material_index',mat_ids)
    grains['scientific_role']='Seeded decorative aggregate placement, not resolved material properties or failure contacts';hold_visibility(grains,idx,count)
    radius=(3*frame['dryIceKg']/(4*math.pi*source['densityKgM3']))**(1/3)
    # A zero inventory has no rendered sphere; never use a nonzero visibility floor.
    if radius>0:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,radius=radius,location=blender_position(grid,(source['centerXM'],source['centerYM'],source['centerDepthM'])))
        sphere=bpy.context.object;sphere.name=f'Finite source {idx:03d} • {frame["dryIceKg"]:.9g} kg';sphere.data.materials.append(ice_mat)
        sphere['mass_kg']=frame['dryIceKg'];sphere['temperature_K']=frame['dryIceTemperatureK'];hold_visibility(sphere,idx,count)
        natural_collection.objects.link(sphere)
    if frame.get('cap') and data['inputs'].get('cap'):
        state=frame['cap'];radius=data['inputs']['capRadiusM'];rise=data['inputs']['capRiseM'];verts=[];quads=[];segments=48;rings=16
        for ring in range(rings+1):
            r=ring/rings
            elevation=rise*(1-r*r)+state['centerUpM']-state['flexM']+state['flexM']*(1-r*r)**2
            for angle in range(segments):
                a=angle*math.tau/segments
                verts.append((source['centerXM']-grid['widthM']/2+radius*r*math.cos(a),source['centerYM']-grid['lengthM']/2+radius*r*math.sin(a),elevation))
        for ring in range(rings):
            for angle in range(segments):
                nxt=(angle+1)%segments;quads.append((ring*segments+angle,ring*segments+nxt,(ring+1)*segments+nxt,(ring+1)*segments+angle))
        cap=mesh_object(f'Calculated cap {idx:03d}',verts,quads,collection,cap_mat);cap['state_json']=json.dumps(state);hold_visibility(cap,idx,count)
        natural_collection.objects.link(cap)
    scene.timeline_markers.new(f't = {frame["timeS"]:.9g} s • accepted',frame=idx)
    natural.timeline_markers.new(f't = {frame["timeS"]:.9g} s • accepted',frame=idx)

camera_data=bpy.data.cameras.new('PHYSICS camera');camera=bpy.data.objects.new('PHYSICS camera',camera_data);scene.collection.objects.link(camera)
camera.location=(9,-12,7);camera.rotation_euler=(Vector((0,0,-1))-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.type='ORTHO';camera_data.ortho_scale=12.5;scene.camera=camera
world=bpy.data.worlds.new('PHYSICS world');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.035,.055,.065,1);world.node_tree.nodes['Background'].inputs[1].default_value=.5;scene.world=world
for name,loc,energy,size in [('Key',(1,-5,8),1800,7),('Fill',(-5,-1,2),800,5)]:
    light_data=bpy.data.lights.new('PHYSICS '+name,'AREA');light_data.energy=energy;light_data.shape='DISK';light_data.size=size
    light=bpy.data.objects.new(light_data.name,light_data);scene.collection.objects.link(light);light.location=loc;light.rotation_euler=(Vector((0,0,-1))-light.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True
scene.render.resolution_x=1100;scene.render.resolution_y=825;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
natural.camera=camera;natural.collection.objects.link(camera);natural.world=world
for obj in scene.objects:
    if obj.type=='LIGHT':natural.collection.objects.link(obj)
natural.render.engine='CYCLES';natural.cycles.samples=16;natural.cycles.use_denoising=True
natural.render.resolution_x=1100;natural.render.resolution_y=825;natural.render.resolution_percentage=100;natural.view_settings.view_transform='AgX'
label_mat=material('Scientific labels',(.70,.85,.85));label_shader=label_mat.node_tree.nodes.get('Principled BSDF');label_shader.inputs['Emission Color'].default_value=(.70,.85,.85,1);label_shader.inputs['Emission Strength'].default_value=1
def camera_label(name,body,x,y,size,owner=scene):
    curve=bpy.data.curves.new(name,'FONT');curve.body=body;curve.size=size;curve.materials.append(label_mat)
    obj=bpy.data.objects.new(name,curve);owner.collection.objects.link(obj);obj.parent=camera;obj.location=(x,y,-10)
    return obj
camera_label('Accepted physics heading','ACCEPTED PHYSICS  /  CHECKPOINT VIEW',-5.8,3.95,.27)
camera_label('Field legend',f'{args.field}  |  {FIELDS[args.field][0]}  |  fixed color scale {FIELDS[args.field][1][0]} to {FIELDS[args.field][1][1]}',-5.8,-3.75,.18)
camera_label('Scientific scope','True scale 1x  /  No time interpolation  /  Uncalibrated numerical model',-5.8,-4.12,.16)
camera_label('Natural heading','NATURAL CONTEXT  /  ACCEPTED GEOMETRY',-5.8,3.95,.27,natural)
camera_label('Natural scope','Accepted displacement at 1x  /  Fixed decorative aggregate seed 46023',-5.8,-3.75,.18,natural)
camera_label('Natural interpretation','Strata colors and grains are illustrative; source mass and cap state are calculated.',-5.8,-4.12,.16,natural)
for idx,frame in enumerate(run['frames'],1):
    label=camera_label(f'Checkpoint label {idx:03d}',f't = {frame["timeS"]:.6g} s  |  accepted {idx}/{count}  |  {grid["nx"]} x {grid["ny"]} x {grid["nz"]} cells  |  source {frame["dryIceKg"]:.6g} kg',-5.8,3.5,.18)
    hold_visibility(label,idx,count)
    natural.collection.objects.link(label)
cache_text=bpy.data.texts.new('ACCEPTED_PHYSICS_CACHE.json');cache_text.write(json.dumps(data,separators=(',',':')))
info={'cache_sha256':hashlib.sha256(args.cache.read_bytes()).hexdigest(),'reference_sha256':source_hash,'grid':grid,'source':source,'accepted_checkpoints':count,'times_s':[f['timeS'] for f in run['frames']],'mode':args.mode,'status':run['status'],'vertices_per_checkpoint':len(used),'surface_faces_per_checkpoint':len(faces),'field':args.field,'units':{key:value[0] for key,value in FIELDS.items()},'displacement_amplification':1,'timeline':'Held accepted states, not evenly spaced physical seconds. No between-checkpoint inference.','surface':'Exterior and optional north-half cut plane; full volume cell data retained in embedded JSON.','reference':'Reference scene is a separate authored illustration with different geometry, mass and timing.'}
text=bpy.data.texts.new('PHYSICS_IMPORT_MANIFEST.json');text.write(json.dumps(info,indent=2))
readme=bpy.data.texts.new('START HERE • provenance and fields');readme.write('Use scene PHYSICS for accepted solver checkpoints; use REFERENCE only for the historical conceptual animation.\nScrub timeline: each integer frame holds one accepted checkpoint; markers give actual seconds.\nField values are FACE-domain attributes on the checkpoint mesh, including original solver_cell_id. Set the material Attribute name and Map Range limits to change the visible scalar.\nAll scalar arrays, node displacements, source inventories and ledgers are in ACCEPTED_PHYSICS_CACHE.json. Source sphere and calculated cap use actual units and no displacement amplification.\nThe scalar mesh shows only boundary faces; interior data are preserved. No rendering choice changes the solver history.\n')
scene.frame_set(count)
natural.frame_set(count)
args.output.parent.mkdir(parents=True,exist_ok=True);bpy.ops.wm.save_as_mainfile(filepath=str(args.output.resolve()),compress=True)
args.output.with_suffix('.manifest.json').write_text(json.dumps(info,indent=2)+'\n')
if args.preview:
    args.preview.parent.mkdir(parents=True,exist_ok=True);scene.render.filepath=str(args.preview.resolve());bpy.ops.render.render(write_still=True)
    bpy.context.window.scene=natural
    natural.render.filepath=str(args.preview.with_name('accepted-natural-preview.png').resolve());bpy.ops.render.render(write_still=True)
    bpy.context.window.scene=scene
if args.reference:assert hashlib.sha256(args.reference.read_bytes()).hexdigest()==source_hash
print('ACCEPTED_PHYSICS_IMPORT '+json.dumps(info),flush=True)
