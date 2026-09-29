"""Build new editable full-story scenes; preserved study is loaded as a library only.

blender --factory-startup -b --python-exit-code 1 --python <this script> -- \
 --output /path/Fire_Sequence.blend --cache /path/accepted-fire.json
90 presentation seconds are played in 36 seconds; all stage times are labeled.
"""
import argparse
import base64
import gzip
import hashlib
import json
import math
from pathlib import Path
import random
import sys
import bpy
from mathutils import Vector

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
STORY=json.loads((HERE/'storyboard.json').read_text())
CONTRACT=json.loads((ROOT/'public/fire-sequence-contract.json').read_text())
G=CONTRACT['geometry'];STORY['geometry']=G
CONTACT=json.loads((ROOT/'public/contact-cooling.json').read_text())
sys.path.insert(0,str(HERE))
from visual_assets import dense_grass,compact_excavator,smooth_peat_outline
from contact_assets import segmented_dome,hose_and_wetting,contact_shading
from rupture_geometry import soil_prisms,animate_shape,debris,cell_for,move_detail,offset as rupture_offset
APPEARANCE=json.loads((ROOT/'public/fire-appearance.json').read_text())
parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);parser.add_argument('--cache',type=Path)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
if args.output.name in ('Dry_Ice_Peat_Study.blend','Materials_Thermal_Stage_2.blend'):raise ValueError('Output must be a new derivative')
SOURCE=HERE.parent/'Dry_Ice_Peat_Study.blend'
SOURCE_HASH=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
USER_ORIGINAL=Path('/Users/kadensmith/.codex/.chatgpt-projects/g-p-6ab74cc545008191a50ed1528f722d46/simulation-integration/docs/review/material-stage2/Materials_Thermal_Stage_2.blend')
USER_ORIGINAL_HASH=hashlib.sha256(USER_ORIGINAL.read_bytes()).hexdigest() if USER_ORIGINAL.exists() else None
if USER_ORIGINAL_HASH:assert USER_ORIGINAL_HASH=='e537ea14a6a75f83329675418bc565f1a4aa672da53011ec168581aa7531a638'
CACHE=json.loads(args.cache.read_text()) if args.cache else None
FRAMES=([state for state in CACHE['frames'] if state.get('phase')=='treatment'] if CACHE and CACHE.get('kind')=='surface-ignition-protocol' else CACHE['runs']['coupled']['frames'] if CACHE else [])
FPS=24;COUNT=864;DURATION=90;RNG=random.Random(67027)
def playback(t):return t/2.8 if t<=55 else 55/2.8+t-55 if t<=61 else 55/2.8+6+(t-61)/2.8
def frame(t):return min(COUNT,1+round(playback(t)*FPS))
def phase(t,a,b):return max(0,min(1,(t-a)/(b-a)))
def ease(t,a,b):p=phase(t,a,b);return p*p*(3-2*p)
def key(obj,path,values,linear=True):
    for t,value in values:setattr(obj,path,value);obj.keyframe_insert(path,frame=frame(t))
    if obj.animation_data and obj.animation_data.action:
        for curve in obj.animation_data.action.fcurves:
            if curve.data_path==path:
                for point in curve.keyframe_points:point.interpolation='LINEAR' if linear else 'BEZIER'
def visible(obj,start,end=90):
    for path in ('hide_render','hide_viewport'):
        for t,value in [(0,True),(max(0,start-.12),True),(start,False),(end,False),(min(90,end+.12),True)]:
            # A terminal visible key remains visible through the last frame.
            if t==90 and value and end==90:continue
            setattr(obj,path,value);obj.keyframe_insert(path,frame=frame(t))
    if obj.animation_data and obj.animation_data.action:
        for curve in obj.animation_data.action.fcurves:
            if curve.data_path in ('hide_render','hide_viewport'):
                for p in curve.keyframe_points:p.interpolation='CONSTANT'
def link(obj,collection):
    for parent in list(obj.users_collection):parent.objects.unlink(obj)
    collection.objects.link(obj)
def mat(name,color,rough=.9,metal=0,emission=0,alpha=1,noise=0):
    material=bpy.data.materials.new(name);material.use_nodes=True;material.diffuse_color=(*color,alpha)
    nodes=material.node_tree.nodes;links=material.node_tree.links;shader=nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value=(*color,1);shader.inputs['Roughness'].default_value=rough;shader.inputs['Metallic'].default_value=metal;shader.inputs['Alpha'].default_value=alpha
    if emission:shader.inputs['Emission Color'].default_value=(*color,1);shader.inputs['Emission Strength'].default_value=emission
    if alpha<1:material.surface_render_method='BLENDED';material.use_transparency_overlap=False
    if noise:
        tex=nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=noise;tex.inputs['Detail'].default_value=3
        ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=tuple(c*.55 for c in color)+(1,);ramp.color_ramp.elements[1].color=tuple(min(1,c*1.35) for c in color)+(1,)
        links.new(tex.outputs['Fac'],ramp.inputs['Fac']);links.new(ramp.outputs['Color'],shader.inputs['Base Color'])
        bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.36;bump.inputs['Distance'].default_value=.025
        links.new(tex.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],shader.inputs['Normal'])
    return material
def mesh(name,verts,faces,collection,material):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update();obj=bpy.data.objects.new(name,data);collection.objects.link(obj);data.materials.append(material);return obj
def cube(name,center,scale,collection,material):
    verts=[(x*scale[0],y*scale[1],z*scale[2]) for x,y,z in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
    obj=mesh(name,verts,[(2,6,4,0),(5,7,3,1),(4,5,1,0),(3,7,6,2),(1,3,2,0),(6,7,5,4)],collection,material);obj.location=center;return obj
def uv(name,center,scale,collection,material,segments=20,rings=12):
    verts=[(math.sin(math.pi*j/rings)*math.cos(math.tau*i/segments),math.sin(math.pi*j/rings)*math.sin(math.tau*i/segments),math.cos(math.pi*j/rings)) for j in range(rings+1) for i in range(segments)]
    faces=[(j*segments+i,(j+1)*segments+i,(j+1)*segments+(i+1)%segments,j*segments+(i+1)%segments) for j in range(rings) for i in range(segments)]
    obj=mesh(name,verts,faces,collection,material);obj.location=center;obj.scale=scale
    for p in obj.data.polygons:p.use_smooth=True
    return obj
def curve(name,points,radius,collection,material):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.resolution_u=8;data.bevel_depth=radius;data.bevel_resolution=2
    spline=data.splines.new('POLY');spline.points.add(len(points)-1)
    for p,co in zip(spline.points,points):p.co=(*co,1)
    obj=bpy.data.objects.new(name,data);collection.objects.link(obj);data.materials.append(material);return obj
def cylinder(name,center,radius,depth,collection,material,vertices=32):
    verts=[(radius*math.cos(math.tau*i/vertices),radius*math.sin(math.tau*i/vertices),z*depth/2) for z in (-1,1) for i in range(vertices)]
    faces=[(i,(i+1)%vertices,(i+1)%vertices+vertices,i+vertices) for i in range(vertices)]+[tuple(reversed(range(vertices))),tuple(range(vertices,2*vertices))]
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update();obj=bpy.data.objects.new(name,data);collection.objects.link(obj);obj.location=center
    if material is not None:data.materials.append(material)
    return obj
def label(name,body,camera,collection,material,x,y,size):
    ratio=camera.data.ortho_scale/12.4
    data=bpy.data.curves.new(name,'FONT');data.body=body;data.size=size*ratio;data.space_character=1.08;data.materials.append(material)
    obj=bpy.data.objects.new(name,data);collection.objects.link(obj);obj.parent=camera;obj.location=(x*ratio,y*ratio,-9);return obj
def scenesettings(scene):
    scene.render.engine='BLENDER_EEVEE_NEXT';scene.eevee.taa_render_samples=24
    scene.render.resolution_x=1280;scene.render.resolution_y=720;scene.render.resolution_percentage=100;scene.render.fps=FPS
    scene.frame_start=1;scene.frame_end=COUNT;scene.render.film_transparent=False
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
    scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
    scene.world=bpy.data.worlds.new(scene.name+' world');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.04,.075,.079,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
    scene['Presentation duration s']=90;scene['Video duration s']=36;scene['Physical interpretation']='Stage time is presentation time. Setup plays at 2.8x; event story 55–61s plays at 1x. Drilling, placement, cap inversion, cracks and water are staged; accepted source/field readouts use a separate clock.'

def char_material(name):
    material=mat(name,(.022,.006,.002),noise=28)
    nodes=material.node_tree.nodes;links=material.node_tree.links;shader=nodes.get('Principled BSDF')
    texture=next(node for node in nodes if node.bl_idname=='ShaderNodeTexNoise')
    ramp=next(node for node in nodes if node.bl_idname=='ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position=.25;ramp.color_ramp.elements[0].color=(.004,.002,.001,1)
    ramp.color_ramp.elements[1].position=.78;ramp.color_ramp.elements[1].color=(.18,.022,.003,1)
    midpoint=ramp.color_ramp.elements.new(.59);midpoint.color=(.027,.007,.003,1)
    mask=nodes.new('ShaderNodeValToRGB');mask.color_ramp.elements[0].position=.59;mask.color_ramp.elements[0].color=(0,0,0,1)
    mask.color_ramp.elements[1].position=.78;mask.color_ramp.elements[1].color=(.82,.82,.82,1)
    shader.inputs['Emission Color'].default_value=(.85,.023,.002,1)
    links.new(texture.outputs['Fac'],mask.inputs['Fac']);links.new(mask.outputs['Color'],shader.inputs['Emission Strength'])
    return material

bpy.ops.wm.read_factory_settings(use_empty=True)
static=bpy.data.collections.new('NATURAL SET • common illustrative geometry')
soil_mats=[mat('Organic surface',(.026,.043,.013),noise=20),mat('Organic loam',(.145,.088,.033),noise=14),mat('Warm mineral subsoil',(.26,.17,.083),noise=11),mat('Sandy parent material',(.43,.37,.24),noise=16)]
peat_mat=mat('Buried organic peat',(.037,.018,.009),noise=22)
bark=mat('Supplemental root bark',(.13,.074,.03),noise=24)
metal=mat('Dark brushed steel plate',(.055,.075,.082),rough=.68,metal=.74,noise=9)
blue=mat('Liquid water • illustrative paths',(.05,.46,.68),rough=.2,metal=.05,emission=.18,alpha=.8)
cyan=mat('CO2 subtle tracer wisps • real gas is invisible',(.15,.42,.44),rough=1,emission=.025,alpha=.026)
ice=mat('Finite dry ice frost',(.69,.88,.97),rough=.65,noise=35)
flame_mats=[mat('Fire outer orange',(1,.13,.012),rough=.5,emission=2.8,alpha=.76),mat('Fire inner gold',(1,.52,.055),rough=.5,emission=3.6,alpha=.88)]
ember=mat('Smoldering visibility',(1,.055,.006),emission=2.5)
smoke=mat('Smoke visibility proxy',(.18,.21,.20),alpha=.13)
white=mat('Caption ivory',(.70,.84,.84),emission=1)
muted=mat('Caption muted',(.33,.52,.53),emission=1)
crack_mat=mat('Assumed opening',(.009,.007,.005),rough=1)

# Reuse only the original native tree collection, preserving original data on disk.
with bpy.data.libraries.load(str(SOURCE),link=False) as (data_from,data_to):
    data_to.collections=[name for name in data_from.collections if name.startswith('TREE •')]
tree_collection=data_to.collections[0]
tree=bpy.data.objects.new('Original Blender tree • repositioned illustrative anatomy',None);tree.instance_type='COLLECTION';tree.instance_collection=tree_collection;tree.scale=(1.25,1.25,1.03);tree.location=(1.65-2.23*1.25,.8-.35*1.25,.015);static.objects.link(tree)
tree['scientific_role']='Preserved authored anatomy; not resolved root geometry in the solver'
for i,points in enumerate([
    [(1.65,.8,.05),(1.53,.3,-.15),(1.28,-.035,-.55),(.9,-.07,-1.1),(.55,-.08,-1.72)],
    [(1.65,.8,.03),(2.02,.35,-.16),(2.2,-.03,-.55),(2.75,-.035,-1.18),(3,-.025,-1.62)],
    [(1.65,.8,.05),(1.8,.15,-.1),(1.7,-.03,-.42),(1.55,-.04,-1.08),(1.3,-.04,-1.82)],
    [(1.65,.8,.03),(1.2,.25,-.13),(.45,-.03,-.38),(-.35,-.035,-.8),(-1,-.03,-1.12)],
]):
    root=curve('Context root '+str(i),points,.037 if i else .052,static,bark)
    root.data.splines[0].type='NURBS';root.data.splines[0].order_u=3;root.data.splines[0].use_endpoint_u=True
    for j,point in enumerate(root.data.splines[0].points):point.radius=1-.78*j/(len(points)-1)
    for j in range(2,5):
        px,py,pz=points[j];direction=1 if (i+j)%2 else -1
        twig_points=[(px,py-.006,pz),(px+direction*.10,py-.016,pz-.08),(px+direction*.22,py-.02,pz-.19),(px+direction*.27,py-.019,pz-.35)]
        twig=curve('Context root '+str(i)+' fine branch '+str(j),twig_points,.009 if j>2 else .014,static,bark)
        twig.data.splines[0].type='NURBS';twig.data.splines[0].order_u=3;twig.data.splines[0].use_endpoint_u=True
        for k,p in enumerate(twig.data.splines[0].points):p.radius=1-.90*k/3
for material in bpy.data.materials:
    if material.name.startswith('Tree leaf') and material.use_nodes:
        shader=material.node_tree.nodes.get('Principled BSDF')
        if shader:shader.inputs['Base Color'].default_value=(.025,.095,.009,1)

# Deterministic organic litter and irregular aggregates, shared by both modes.
rock_mats=[mat('Aggregate '+str(i),color,noise=15) for i,color in enumerate([(.20,.15,.09),(.38,.30,.19),(.51,.44,.30),(.09,.052,.022)])]
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1);template=bpy.context.object
base_verts=[tuple(v.co*(.8+RNG.random()*.38)) for v in template.data.vertices];base_faces=[tuple(p.vertices) for p in template.data.polygons]
base_data=template.data;bpy.data.objects.remove(template,do_unlink=True);bpy.data.meshes.remove(base_data)
rv=[];rf=[];rmi=[]
for index in range(520):
    front=index<460;x=RNG.uniform(-3.96,3.96);y=.006 if front else RNG.uniform(.1,3.9);z=RNG.uniform(-3.13,-.03) if front else RNG.uniform(.005,.035)
    # Keep the drilling visualization readable; decorative stones do not occupy its bore.
    if front and ((abs(x-.4)<G['boreRadiusM']+.03 and z>-1.4) or ((x-.4)/G['cavityRadiusM'])**2+((z-G['cavityCenterY'])/G['cavityHalfHeightM'])**2<1.15):continue
    if not front and (x-.4)**2+y*y<(G['boreRadiusM']+.03)**2:continue
    radius=(.014+RNG.random()**2*.095)*(1 if front else .45);scale=(radius*RNG.uniform(.6,1.5),radius*(.22 if front else .8),radius*(.75 if front else .32));start=len(rv)
    rv.extend((x+v[0]*scale[0],y+v[1]*scale[1]-(.008 if front else 0),z+v[2]*scale[2]) for v in base_verts)
    rf.extend(tuple(start+v for v in f) for f in base_faces);rmi.extend([RNG.randrange(4)]*len(base_faces))
rocks=mesh('Seeded irregular aggregate detail • visual only',rv,rf,static,rock_mats[0])
for m in rock_mats[1:]:rocks.data.materials.append(m)
rocks.data.polygons.foreach_set('material_index',rmi)
static.objects.unlink(rocks)
grass_library=bpy.data.collections.new('Fine grass geometry library')
grass_objects=dense_grass(globals(),grass_library)
context_objects=[obj for obj in static.objects if obj==tree or obj.name.startswith('Context root')]
for obj in context_objects:static.objects.unlink(obj)

def build_mode(mode):
    print('BUILD_MODE '+mode,flush=True);RNG.seed(15027)
    scene=bpy.data.scenes.new('GRADUAL • conserved contact' if mode=='gradual' else 'RAPID • illustrative release');scenesettings(scene);bpy.context.window.scene=scene;scene.collection.children.link(static)
    actors=bpy.data.collections.new(mode+' staged operations');scene.collection.children.link(actors)
    captions=bpy.data.collections.new(mode+' readable scientific captions');scene.collection.children.link(captions)
    scene['Source mode']=mode
    context_motion=bpy.data.objects.new(mode+' root and canopy context motion',None);actors.objects.link(context_motion);context_motion.location=(1.65,.8,0)
    for template in context_objects:
        obj=template.copy();actors.objects.link(obj);obj.parent=context_motion;obj.location=template.location-Vector((1.65,.8,0))
    if mode=='rapid':
        point=(1.65,.8,0);index=cell_for(point[0],point[2]);dp=rupture_offset(point,index);dd=rupture_offset(point,index,True)
        for t in [0,54.9]+[55+i*.08 for i in range(51)]+[61,69,90]:
            a=max(0,t-55);pulse=(1-math.exp(-12*a))*math.exp(-1.35*a)*1.45 if t>=55 else 0;damage=ease(t,55,55.65)
            context_motion.location=tuple(point[k]+dp[k]*pulse+dd[k]*damage for k in range(3));context_motion.rotation_euler=(0,.012*pulse,0)
            context_motion.keyframe_insert('location',frame=frame(t));context_motion.keyframe_insert('rotation_euler',frame=frame(t))
    decorative=[]
    for template in [rocks,*grass_objects]:
        obj=template.copy();obj.data=template.data.copy();actors.objects.link(obj);obj.name=mode+' '+template.name;decorative.append(obj)
        if obj.get('over_bore'):visible(obj,0,27.65)
    # Each layer retains an editable, animated cutter; removed soil is a staged operation.
    cutter=cylinder(mode+' borehole excavation cutter',(.4,0,1),G['boreRadiusM'],2,actors,None,48);cutter.hide_render=True;cutter.display_type='WIRE'
    for t in [0,23.9]+list(range(24,32))+[90]:
        depth=min(1.385,max(0,2.95*ease(t,24,31)-1.55));cutter.location=(.4,0,.01-max(.001,depth)/2);cutter.scale=(1,1,max(.001,depth)/2)
        cutter.keyframe_insert('location',frame=frame(t));cutter.keyframe_insert('scale',frame=frame(t))
    pocket=uv(mode+' authored underreamed pocket cutter',(.4,0,G['cavityCenterY']),(1,1,1),actors,soil_mats[1],48,24);pocket.hide_render=True;pocket.display_type='WIRE'
    pocket.data.attributes.new('rest_depth',type='FLOAT',domain='POINT').data.foreach_set('value',[-(G['cavityCenterY']+v.co.z*G['cavityHalfHeightM'])/3.2 for v in pocket.data.vertices])
    cutter.data.attributes.new('rest_depth',type='FLOAT',domain='POINT').data.foreach_set('value',[.28 for v in cutter.data.vertices])
    for pose in CONTRACT['poseFrames']:
        if pose['timeS'] in (0,90) or 31<=pose['timeS']<=33:
            p=max(.001,pose[mode]['underream']);pocket.scale=(G['cavityRadiusM']*p,G['cavityRadiusM']*p,G['cavityHalfHeightM']*p);pocket.keyframe_insert('scale',frame=frame(pose['timeS']))
    soil_prisms(globals(),mode,actors,cutter,pocket)
    if mode=='rapid':
        for obj in decorative:
            group_size=8 if obj.get('blade_count') else len(base_verts);assignments=[]
            for start in range(0,len(obj.data.vertices),group_size):
                group=obj.data.vertices[start:start+group_size];center=sum((v.co for v in group),Vector())/len(group)
                owner=(cell_for(center.x,center.z),max(0,min(5,int(center.y/(4/6)))))
                assignments.extend([owner]*len(group))
            animate_shape(globals(),obj,assignments)
        debris(globals(),actors)
    # One shared connected arrival field controls both char and ember onset.
    nx,ny=APPEARANCE['nx'],APPEARANCE['ny'];dx=APPEARANCE['width']/nx;dz=APPEARANCE['height']/ny
    pv=[];pf=[];arrival=[];eligible=[];peat_assignments=[];outline=smooth_peat_outline(APPEARANCE)
    for j in range(ny):
        for i in range(nx):
            index=j*nx+i
            if not APPEARANCE['mask'][index]:continue
            v=len(pv);x=APPEARANCE['minX']+i*dx;z=APPEARANCE['minY']+j*dz
            for corner in [(i,j),(i+1,j),(i+1,j+1),(i,j+1)]:
                px,pz=outline.get(corner,(APPEARANCE['minX']+corner[0]*dx,APPEARANCE['minY']+corner[1]*dz));pv.append((px,-.052,pz))
            pf.append((v,v+1,v+2,v+3));arrival.extend([APPEARANCE['arrival'][index]]*4);peat_assignments.extend([cell_for(x+dx/2,z+dz/2)]*4)
            if APPEARANCE['arrival'][index]<=.7:eligible.append(index)
    peat_display=char_material(mode+' irregular connected peat')
    burning=mesh(mode+' connected illustrated peat involvement',pv,pf,actors,peat_display)
    burning['area_fraction_at_treatment']=.7;burning['scientific_role']='Shared seeded connected arrival rank, not numerical fuel consumption'
    burning.data.attributes.new('illustrated_arrival',type='FLOAT',domain='CORNER').data.foreach_set('value',arrival)
    nodes=peat_display.node_tree.nodes;links=peat_display.node_tree.links;shader=nodes.get('Principled BSDF')
    attribute=nodes.new('ShaderNodeAttribute');attribute.attribute_name='illustrated_arrival'
    threshold=nodes.new('ShaderNodeValue');threshold.label='Authored peat involvement fraction'
    for i in range(49):
        t=12+i*.25;threshold.outputs[0].default_value=.7*ease(t,12,24);threshold.outputs[0].keyframe_insert('default_value',frame=frame(t))
    mask=nodes.new('ShaderNodeMath');mask.operation='LESS_THAN';links.new(attribute.outputs['Fac'],mask.inputs[0]);links.new(threshold.outputs[0],mask.inputs[1])
    char_color=shader.inputs['Base Color'].links[0].from_socket
    mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MIX';mix.inputs[1].default_value=(.046,.020,.008,1);links.new(mask.outputs[0],mix.inputs[0]);links.new(char_color,mix.inputs[2]);links.new(mix.outputs[0],shader.inputs['Base Color'])
    ember_amount=shader.inputs['Emission Strength'].links[0].from_socket
    multiply=nodes.new('ShaderNodeMath');multiply.operation='MULTIPLY';links.new(mask.outputs[0],multiply.inputs[0]);links.new(ember_amount,multiply.inputs[1]);links.new(multiply.outputs[0],shader.inputs['Emission Strength'])
    # Clip the display-only peat sheet in the shader. The soil prisms themselves
    # have an actual cylindrical Boolean cut with a visible curved rear wall.
    peat_display.surface_render_method='DITHERED'
    position=nodes.new('ShaderNodeNewGeometry');separate=nodes.new('ShaderNodeSeparateXYZ');links.new(position.outputs['Position'],separate.inputs[0])
    def math_node(operation,a,b=None):
        node=nodes.new('ShaderNodeMath');node.operation=operation
        for socket,value in zip(node.inputs,(a,b)):
            if value is None:continue
            if isinstance(value,(int,float)):socket.default_value=value
            else:links.new(value,socket)
        return node.outputs[0]
    xx=math_node('SUBTRACT',separate.outputs['X'],.4);rr=math_node('ADD',math_node('MULTIPLY',xx,xx),math_node('MULTIPLY',separate.outputs['Y'],separate.outputs['Y']))
    radial=math_node('LESS_THAN',rr,G['boreRadiusM']**2)
    hole_depth=nodes.new('ShaderNodeValue')
    for t in [0,24]+[24+i*.25 for i in range(29)]+[90]:
        hole_depth.outputs[0].default_value=min(1.385,max(0,2.95*ease(t,24,31)-1.55));hole_depth.outputs[0].keyframe_insert('default_value',frame=frame(t))
    within_depth=math_node('LESS_THAN',math_node('MULTIPLY',separate.outputs['Z'],-1),hole_depth.outputs[0]);alpha=math_node('SUBTRACT',1,math_node('MULTIPLY',radial,within_depth));links.new(alpha,shader.inputs['Alpha'])
    pocket_size=nodes.new('ShaderNodeValue')
    for pose in CONTRACT['poseFrames']:
        if pose['timeS'] in (0,90) or 31<=pose['timeS']<=33:
            pocket_size.outputs[0].default_value=pose[mode]['underream']**2;pocket_size.outputs[0].keyframe_insert('default_value',frame=frame(pose['timeS']))
    zz=math_node('DIVIDE',math_node('SUBTRACT',separate.outputs['Z'],G['cavityCenterY']),G['cavityHalfHeightM'])
    pocket_radius=math_node('ADD',math_node('DIVIDE',rr,G['cavityRadiusM']**2),math_node('MULTIPLY',zz,zz))
    pocket_mask=math_node('LESS_THAN',pocket_radius,pocket_size.outputs[0]);final_alpha=math_node('MULTIPLY',alpha,math_node('SUBTRACT',1,pocket_mask));links.new(final_alpha,shader.inputs['Alpha'])
    contact_shading(globals(),mode,peat_display,CONTACT)
    if mode=='rapid':animate_shape(globals(),burning,peat_assignments)
    entry_path=[(1.72,-.065,.04),(1.74,-.065,-.2),(1.67,-.065,-.44),(1.65,-.065,-.72),(1.58,-.065,-1.06)]
    char_path=curve(mode+' scorched entry channel',entry_path,.063,actors,char_material(mode+' scorched entry char'))
    for i,point in enumerate(char_path.data.splines[0].points):point.radius=.83+.22*math.sin(i*2.1)**2
    channel=curve(mode+' connected surface-to-peat entry',[(x,y-.072,z)for x,y,z in entry_path],.005,actors,mat(mode+' entry ember core',(.35,.018,.003),emission=1.0))
    for ob in (channel,char_path):
        ob.data.bevel_factor_end=0;ob.data.keyframe_insert('bevel_factor_end',frame=frame(8));ob.data.bevel_factor_end=1;ob.data.keyframe_insert('bevel_factor_end',frame=frame(12))
    for i,index in enumerate(RNG.sample(eligible,min(160,len(eligible)))):
        row,column=divmod(index,nx);x=APPEARANCE['minX']+(column+.5)*dx;z=APPEARANCE['minY']+(row+.5)*dz
        if (abs(x-.4)<G['boreRadiusM']+.05 and z>-1.43) or ((x-.4)/G['cavityRadiusM'])**2+((z-G['cavityCenterY'])/G['cavityHalfHeightM'])**2<1.10:continue
        lo,hi=12.,24.
        for _ in range(30):
            mid=(lo+hi)/2
            if .7*ease(mid,12,24)<APPEARANCE['arrival'][index]:lo=mid
            else:hi=mid
        ob=curve(mode+' peat ember '+str(i),[(x-.018,-.087,z),(x,-.088,z+.008),(x+.027,-.087,z-.003)],.0028,actors,ember);visible(ob,hi)
        # Ember intensity follows the nearest reduced contact footprint, never a forced global fade.
        local=ember.copy();local.name=mode+' ember contact '+str(i);ob.data.materials[0]=local;strength=local.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength']
        for state in CONTACT['modes'][mode]:
            reduction=0
            for p in state['patches']:
                f=max(0,min(1,(math.hypot(x-p['xM'],z-p['yM'])/p['radiusM']-.30)/.83));influence=1-f*f*(3-2*f)
                glow=max(0,min(1,(p['temperatureK']-550)/max(1,state['initialTemperatureK']-550)))**1.7;reduction=max(reduction,influence*(1-glow))
            strength.default_value=2.5*(1-reduction);strength.keyframe_insert('default_value',frame=frame(state['storyTimeS']))
        if mode=='rapid':move_detail(globals(),ob,(x,-.087,z))
    # Small surface ignition with gently irregular flame geometry and continuous flicker.
    for i in range(18):
        x=1.72+RNG.uniform(-.28,.28);y=RNG.uniform(.12,.5);h=RNG.uniform(.18,.52)
        flame=uv(mode+' surface flame '+str(i),(x,y,h*.45),(.045,.055,h*.52),actors,flame_mats[i%2],12,8)
        if mode=='rapid':move_detail(globals(),flame,(x,y,0))
        for vertex in flame.data.vertices:
            height=(vertex.co.z+1)/2;taper=max(.04,1-.8*height**1.5)
            vertex.co.x=vertex.co.x*taper+.16*height*height*math.sin(i*1.3);vertex.co.y*=taper
        values=[]
        for t in range(0,91):
            growth=ease(t,0,8)*(1-ease(t,20,27));reduction=1;pulse=.8+.2*math.sin(t*3.1+i*1.7)
            values.append((t,(.045*max(.001,growth)*pulse,.055*max(.001,growth),h*.52*max(.001,growth)*reduction*pulse)))
        key(flame,'scale',values);visible(flame,0,27)
    for i in range(14):
        puff=uv(mode+' rising smoke '+str(i),(1.72, .35, .8),(1,1,1),actors,smoke,12,8)
        values=[];scales=[]
        for t in range(0,91):
            age=((t*.2+i*.117)%1);growth=ease(t,2,10)*(1-ease(t,20,27))
            values.append((t,(1.72+age*.35+.13*math.sin(t*.25+i),.35+age*.12,.45+age*2)))
            radius=(.11+age*.26)*growth;scales.append((t,(radius,radius*.8,radius*1.25)))
        key(puff,'location',values);key(puff,'scale',scales);visible(puff,0,27)
    compact_excavator(globals(),mode,actors,G)
    # Finite source geometry. Rapid mode is prescribed conversion and not a solver result.
    source=uv(mode+' dry ice source',(.4,0,2.2),(1,1,1),actors,ice,32,20);visible(source,39)
    key(source,'location',[(t,(.4,0,2.2-3.5*phase(t,39,44)**2)) for t in [37,39,40,41,42,43,44,90]])
    source_scale=[]
    for state in CONTACT['modes'][mode]:
        radius=(3*max(0,state['ledger']['dryIceRemainingKg'])/(4*math.pi*1560))**(1/3)
        source_scale.append((state['storyTimeS'],(radius,)*3))
    key(source,'scale',source_scale)
    if mode=='rapid':
        for fc in source.animation_data.action.fcurves:
            if fc.data_path=='scale':
                for point in fc.keyframe_points:point.interpolation='CONSTANT'
    source['scientific_role']='Finite mass from separate conserved hot-patch contact calculation; accepted field cache remains a separate case'
    cap=segmented_dome(globals(),mode,actors,CONTRACT)
    # Separated low-opacity wisps are a visibility convention; real CO2 is invisible.
    gas_rng=random.Random(550152)
    for i in range(19):
        x=.4-i*.127+gas_rng.uniform(-.045,.045);z=-1.3+gas_rng.uniform(-.24,.24)
        puff=uv(mode+' CO2 faint tracer wisp '+str(i),(x,-.12-gas_rng.random()*.015,z),(1,1,1),actors,cyan,12,8)
        start=55+i*(.16 if mode=='rapid' else .55);size=gas_rng.uniform(.036,.078)
        puff.rotation_euler.y=gas_rng.uniform(-.6,.6)
        key(puff,'scale',[(0,(0,0,0)),(start,(0,0,0)),(start+2,(size*1.3,.012,size*.42)),(85,(size*1.5,.012,size*.5)),(90,(size*1.5,.012,size*.5))])
    hose_and_wetting(globals(),mode,actors,CONTRACT,CONTACT)
    # Wide stable camera preserves stage context and allows clear comparisons.
    cam_data=bpy.data.cameras.new(mode+' camera');camera=bpy.data.objects.new(mode+' camera',cam_data);scene.collection.objects.link(camera)
    camera.location=(8.4,-15.5,7.5);camera.rotation_euler=(Vector((-.15,1,-.15))-camera.location).to_track_quat('-Z','Y').to_euler();cam_data.type='ORTHO';cam_data.ortho_scale=16.4;scene.camera=camera
    for name,location,energy,size in [('Key',(-3,-5,9),1400,7),('Fill',(6,-2,5),750,6),('Rim',(-2,5,7),1700,5)]:
        data=bpy.data.lights.new(mode+' '+name,'AREA');data.energy=energy;data.shape='DISK';data.size=size
        obj=bpy.data.objects.new(data.name,data);scene.collection.objects.link(obj);obj.location=location;obj.rotation_euler=(Vector((0,1,-.3))-obj.location).to_track_quat('-Z','Y').to_euler()
    title='GRADUAL / FINITE CONTACT SOURCE' if mode=='gradual' else 'RAPID / ILLUSTRATIVE RELEASE'
    label(mode+' title',title,camera,captions,white,-5.9,3.0,.22)
    label(mode+' subtitle','FIRE TO SUBSURFACE TREATMENT  /  EDITABLE STORY STUDY',camera,captions,muted,-5.9,2.66,.105)
    involvement=label(mode+' treatment trigger','ILLUSTRATED PEAT INVOLVEMENT 70% / TREATMENT TRIGGER',camera,captions,muted,-5.9,1.98,.098);visible(involvement,24)
    label(mode+' scope','Geometry and wetting are authored. Contact heat is a separate reduced balance; no field validation.',camera,captions,muted,-5.9,-3.14,.104)
    for stage in STORY['stages']:
        stage_title='Finite source / local contact cooling' if mode=='gradual' and stage['id']=='treatment' else stage['title']
        title_obj=label(mode+' chapter '+stage['id'],stage_title.upper(),camera,captions,white,-5.9,-2.57,.19);visible(title_obj,stage['start'],stage['end']-.13 if stage['end']<90 else 90)
        evidence=stage['evidence']
        if stage['id']=='underground':evidence='Illustrated underground spread; the numerical front remains unresolved.'
        if mode=='gradual' and stage['id']=='treatment':evidence='Finite contact source and local heat removal. The plate and ground remain intact.'
        if mode=='rapid' and stage['id']=='treatment':evidence='Prescribed pressure release and soil rupture. CO₂ does not burn; fracture is not calculated.'
        line=label(mode+' evidence '+stage['id'],evidence,camera,captions,muted,-5.9,-2.87,.108);visible(line,stage['start'],stage['end']-.13 if stage['end']<90 else 90)
        scene.timeline_markers.new(stage['title'],frame=frame(stage['start']))
    # Stage-clock labels are independent of the solver clock.
    for t in range(91):
        clock=label(mode+' story clock '+str(t),f'STORY {t:02d} / 90 s',camera,captions,muted,4.12,3.02,.115);visible(clock,t,min(90,t+.88))
    if FRAMES:
        first=FRAMES[0]['timeS'];end=max(1e-9,FRAMES[-1]['timeS']-first)
        for i,state in enumerate(FRAMES):
            start=55+30*(state['timeS']-first)/end;stop=55+30*(FRAMES[i+1]['timeS']-first)/end-.13 if i+1<len(FRAMES) else 90
            text=f'ACCEPTED SOLVER  {state["timeS"]:.3g} s  |  treatment +{state["timeS"]-first:.3g} s  |  field-case dry ice {state["dryIceKg"]:.6g} kg'
            if mode=='rapid':text='RAPID RELEASE: prescribed / no accepted gas calculation'
            readout=label(mode+' accepted readout '+str(i),text,camera,captions,white,-5.9,2.40,.102);visible(readout,start,max(start,stop))
            if mode=='gradual':
                info=f'ACCEPTED GAS  min O2 {100*min(state["oxygen"]):.3g}% / max CO2 {100*max(state["co2"]):.3g}% mol/mol'
                gas_info=label(mode+' accepted gas '+str(i),info,camera,captions,muted,-5.9,2.2,.098);visible(gas_info,start,max(start,stop))
    else:
        readout=label(mode+' no cache','STAGED STUDY  /  NO ACCEPTED SOLVER CACHE ATTACHED',camera,captions,white,-5.9,2.4,.105)
    if CACHE and CACHE.get('kind')=='surface-ignition-protocol':
        # Small true-data inset makes the difference between staged growth and
        # coarse accepted temperature explicit. The rapid branch freezes at
        # insertion: no post-conversion field is fabricated or borrowed.
        domain=CACHE['domain'];nx=domain['nx'];ny=domain['ny'];nz=domain['nz']
        treatment=CACHE.get('treatmentStartS');ignition_end=CACHE.get('ignitionEndS',7200)
        first_treatment=treatment if treatment is not None else CACHE['frames'][-1]['timeS']
        elapsed_end=CACHE['frames'][-1]['timeS']
        states=[state for state in CACHE['frames'] if mode=='gradual' or state.get('phase')!='treatment']
        def presentation_time(state):
            if state.get('phase')=='treatment':return 55+30*(state['timeS']-first_treatment)/max(1e-9,elapsed_end-first_treatment)
            if state['timeS']<=ignition_end:return 10*state['timeS']/max(1,ignition_end)
            return 10+14*(state['timeS']-ignition_end)/max(1,first_treatment-ignition_end)
        panel_mat=mat(mode+' inset background',(.015,.027,.032),emission=.6)
        ratio=cam_data.ortho_scale/12.4
        panel=mesh(mode+' field inset background',[(x*ratio,y*ratio,0) for x,y in [(1.96,1),(5.93,1),(5.93,2.94),(1.96,2.94)]],[(0,1,2,3)],captions,panel_mat);panel.parent=camera;panel.location.z=-9.04
        field_mat=bpy.data.materials.new(mode+' accepted-temperature colors');field_mat.use_nodes=True
        nodes=field_mat.node_tree.nodes;links=field_mat.node_tree.links;nodes.clear()
        attribute=nodes.new('ShaderNodeVertexColor');attribute.layer_name='accepted_temperature_color'
        emission_shader=nodes.new('ShaderNodeEmission');emission_shader.inputs['Strength'].default_value=.85;links.new(attribute.outputs['Color'],emission_shader.inputs['Color'])
        out=nodes.new('ShaderNodeOutputMaterial');links.new(emission_shader.outputs[0],out.inputs['Surface'])
        label(mode+' accepted-field title','TEMPERATURE / K / ACCEPTED MODEL',camera,captions,white,2.10,2.74,.096)
        label(mode+' accepted-field range','283 K                            850 K',camera,captions,muted,2.10,1.13,.084)
        verts=[];quads=[]
        for z in range(nz):
            for x in range(nx):
                start=len(verts);left=2.1+x*3.7/nx;right=2.1+(x+1)*3.7/nx;top=2.57-z*1.32/nz;bottom=2.57-(z+1)*1.32/nz
                verts.extend((a*ratio,b*ratio,0)for a,b in [(left,bottom),(right,bottom),(right,top),(left,top)]);quads.append((start,start+1,start+2,start+3))
        for index,state in enumerate(states):
            start=presentation_time(state);stop=presentation_time(states[index+1])-.13 if index+1<len(states) else 90
            inset=mesh(mode+' accepted temperature checkpoint '+str(index),verts,quads,captions,field_mat);inset.parent=camera;inset.location.z=-9.025
            colors=[]
            for z in range(nz):
                for x in range(nx):
                    value=state['temperatureK'][(z*ny+ny//2)*nx+x];p=max(0,min(1,(value-283.15)/(850-283.15)))
                    if p<.5:a=(.035,.10,.16);b=(.09,.46,.48);f=p*2
                    else:a=(.09,.46,.48);b=(1,.25,.025);f=(p-.5)*2
                    rgba=tuple(a[i]*(1-f)+b[i]*f for i in range(3))+(1,);colors.extend(rgba*4)
            inset.data.color_attributes.new(name='accepted_temperature_color',type='FLOAT_COLOR',domain='CORNER').data.foreach_set('color',colors)
            visible(inset,start,max(start,stop));inset['accepted_physical_time_s']=state['timeS'];inset['display_state']='held accepted cell values, no interpolation'
            text=f'Physical {state["timeS"]/3600:.3f} h / growth unresolved'
            if mode=='rapid' and index==len(states)-1:text='Pre-treatment state held / no rapid field solve'
            stamp=label(mode+' inset timestamp '+str(index),text,camera,captions,muted,2.1,1.02,.078);visible(stamp,start,max(start,stop))
        # Reserve the left gutter for quantitative data so the excavator remains unobscured.
        for ob in captions.objects:
            if any(token in ob.name for token in ('field inset background','accepted temperature checkpoint','accepted-field','inset timestamp')):
                if ob.type=='MESH':
                    for vertex in ob.data.vertices:vertex.co.x=vertex.co.x*.74+(-5.88-1.96*.74)*ratio;vertex.co.y-=1.15*ratio
                else:
                    ob.location.x=ob.location.x*.74+(-5.88-1.96*.74)*ratio;ob.location.y-=1.15*ratio;ob.data.size*=.86
        bpy.data.objects[mode+' accepted-field title'].data.body='ACCEPTED TEMPERATURE / K'
    contact_title=label(mode+' contact ledger title','CONTACT BALANCE / ASSUMED HOT PATCHES',camera,captions,white,-5.88,-.66,.098);visible(contact_title,44)
    contact_scope=label(mode+' contact ledger scope','Separate case / finite energy / wet arrival assumed',camera,captions,muted,-5.88,-.85,.086);visible(contact_scope,44)
    for state in CONTACT['modes'][mode]:
        t=state['storyTimeS']
        if t<44 or abs(t-round(t))>.001:continue
        ledger=state['ledger'];temperatures=[p['temperatureK']-273.15 for p in state['patches']]
        entries=[f'Contact peat {min(temperatures):.0f}–{max(temperatures):.0f} °C',f'Dry ice {ledger["dryIceRemainingKg"]:.3f} kg / water {ledger["waterSuppliedKg"]:.2f} kg',f'Heat removed {(ledger["heatToDryIceJ"]+ledger["heatToWaterJ"])/1000:.1f} kJ']
        for index,body in enumerate(entries):
            ob=label(mode+' contact '+str(t)+' '+str(index),body,camera,captions,muted,-5.88,-1.07-index*.19,.090);visible(ob,t,min(90,t+.89))
    scene.frame_set(frame(64));print('MODE_COMPLETE '+mode,flush=True);return scene

scenes=[build_mode(mode) for mode in ('gradual','rapid')]
bpy.context.window.scene=scenes[0]
manifest={'storyboard':STORY,'fps':FPS,'frames_per_mode':COUNT,'video_seconds_per_mode':COUNT/FPS,'source_blend_sha256':SOURCE_HASH,'preserved_0_15_commit':'223eda6f7a8e29291ebb5844fc2aa3f655f5d1cb','cache_sha256':hashlib.sha256(args.cache.read_bytes()).hexdigest() if args.cache else None,'cache_provenance':CACHE.get('provenance') if CACHE else None,'accepted_checkpoint_count':len(FRAMES),'scientific_scope':'Full staged narrative. Natural source radius and local cooling use a separate conserved reduced contact balance; inset alone uses accepted field history. Rapid release, drilling, enlarged cap bending, fracture paths and liquid infiltration are explicitly illustrative and do not alter solver data. No extinguishment or field validation claim.','render':'720p EEVEE,24 samples,24fps; full sequence for both modes, original source never saved.'}
manifest['preserved_user_original_sha256']=USER_ORIGINAL_HASH
manifest['contact_model_sha256']=hashlib.sha256((ROOT/'public/contact-cooling.json').read_bytes()).hexdigest()
manifest['sequence_contract_sha256']=hashlib.sha256((ROOT/'public/fire-sequence-contract.json').read_bytes()).hexdigest()
manifest['contact_scope']='Finite mass and energy ledger for prescribed hot patches with assumed contact times; no infiltration, oxidation, fracture, tool-design or treatment-validation claim.'
manifest['hose_scope']='Procedural woven ivory jacket with original authored weave; no stock textures copied. Smooth flexible surface centerline lowered through a plate service passage.'
manifest['appearance_sha256']=hashlib.sha256((ROOT/'public/fire-appearance.json').read_bytes()).hexdigest()
manifest['appearance_scope']='Perimeter-only display smoothing; shared 200x80 seeded connected arrival ranks; 70% sampled peat area before treatment, not solved propagation.'
manifest['rupture_scope']='Rapid-only authored pressure-release pulse, 504 irregular prisms, persistent gaps and decorative ballistic fragments; no CO2 detonation or fracture-solver claim.'
manifest['presentation_clock']={'story_seconds':90,'playback_seconds':36,'normal_speed_story_interval':[55,61],'other_speed_multiplier':2.8,'mapping':'t/2.8 to55;55/2.8+t-55 to61;55/2.8+6+(t-61)/2.8 afterwards'}
manifest['buried_plate']={'rim_elevation_m':-G['capDepthM'],'initial_center_elevation_m':-G['capDepthM']-G['capRiseM'],'rapid_final_center_elevation_m':-G['capDepthM']-G['capRiseM']+G['capInversionM'],'radius_m':G['capRadiusM'],'bore_radius_m':G['boreRadiusM'],'folded_radius_m':G['capFoldedRadiusM'],'pocket_radius_m':G['cavityRadiusM'],'wedge_radius_m':G['capWedgeRadiusM'],'deformation':'folded articulated insertion then deployment in visibly underreamed pocket; prescribed rapid-only inversion and shoulder wedging'}
manifest['illustrated_peat_involvement']={'trigger_fraction':.7,'time_story_s':24,'geometry':'Shared irregular mask and connected arrival ranks; 70% sampled 2D peat area, not numerical fuel consumption'}
manifest['embedded_cache_encoding']='base64(gzip(JSON)), stored in ACCEPTED_FIRE_CACHE.json.gz.b64'
if CACHE and CACHE.get('kind')=='surface-ignition-protocol':
    manifest['cache_provenance']={key:CACHE.get(key) for key in ('kind','generatedAt','sourceHashes','config','ignitionSource','treatmentSource','treatmentStartS','propagationResolved','status','stopReason')}
    manifest['field_inset']='Held accepted temperature cross-section through middle-y cells. Rapid mode holds the pre-treatment state; no rapid-release field is supplied.'
    manifest['initial_treatment_mass_kg']=FRAMES[0]['dryIceKg'] if FRAMES else None
    manifest['final_treatment_mass_kg']=FRAMES[-1]['dryIceKg'] if FRAMES else None
text=bpy.data.texts.new('FIRE_SEQUENCE_MANIFEST.json');text.write(json.dumps(manifest,indent=2))
if CACHE:
    payload=base64.b64encode(gzip.compress(json.dumps(CACHE,separators=(',',':')).encode(),mtime=0)).decode()
    bpy.data.texts.new('ACCEPTED_FIRE_CACHE.json.gz.b64').write('\n'.join(payload[i:i+76] for i in range(0,len(payload),76)))
print('EMBED_CONTACT',flush=True)
bpy.data.texts.new('CONTACT_COOLING.json').write(json.dumps(CONTACT,indent=0))
bpy.data.texts.new('FIRE_SEQUENCE_CONTRACT.json').write(json.dumps(CONTRACT,indent=0))
bpy.data.texts.new('ILLUSTRATED_FIRE_APPEARANCE.json').write(json.dumps(APPEARANCE,separators=(',',':')))
bpy.data.texts.new('START HERE').write('Use the scene dropdown to select GRADUAL or RAPID. Both are full staged narratives. Timeline is 90 presentation seconds in 36 playback seconds: setup 2.8x, event story55–61 at1x. Numerical readouts have their own clock. Natural source mass and heat use the embedded separate contact balance. Accepted field inset is unchanged and not the same hot-patch case. Rapid removal, excavation, wetting paths and fracture are illustrative. The buried plate is a downward bowl, inverted upward only in rapid mode. Native geometry and animation are editable. Original study is byte-preserved. Embedded accepted cache is base64(gzip(JSON)) with newlines; use gzip.decompress(base64.b64decode(text)) to recover it, or open the adjacent Accepted-Fire-Cache.json.\n')
for image in bpy.data.images:
    if image.source=='FILE' and not image.packed_file and image.has_data:image.pack()
args.output.parent.mkdir(parents=True,exist_ok=True);bpy.context.preferences.filepaths.save_version=0;print('SAVING_SCENES',flush=True);bpy.ops.wm.save_as_mainfile(filepath=str(args.output.resolve()),compress=True)
args.output.with_suffix('.manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==SOURCE_HASH
if USER_ORIGINAL_HASH:assert hashlib.sha256(USER_ORIGINAL.read_bytes()).hexdigest()==USER_ORIGINAL_HASH
print('FIRE_STORY_BUILT '+json.dumps({'output':str(args.output),'objects':len(bpy.data.objects),'frames':COUNT,'cache_frames':len(FRAMES)}),flush=True)
