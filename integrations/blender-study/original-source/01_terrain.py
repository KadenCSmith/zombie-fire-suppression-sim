import bpy, math, random, json, os
from mathutils import Vector, noise
from pathlib import Path
random.seed(431)
ROOT=Path('/Users/kadensmith/Documents/Codex/2026-09-25/files-pasted-by-the-user-goal')
OUT=ROOT/'outputs/Dry_Ice_Peat_Study'
scene=bpy.context.scene
# The starting scene is the untouched default scene.
for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
for co in list(bpy.data.collections): bpy.data.collections.remove(co)
scene.name='Dry ice • peat | conceptual transport study'
scene.unit_settings.system='METRIC'; scene.unit_settings.scale_length=1
scene.render.engine='CYCLES'; scene.cycles.samples=48
scene.cycles.use_denoising=True; scene.cycles.preview_samples=16
scene.cycles.max_bounces=7; scene.cycles.volume_bounces=1
scene.cycles.volume_step_rate=1.0
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type='METAL'; prefs.get_devices()
    for d in prefs.devices: d.use=d.type=='METAL'
    scene.cycles.device='GPU'
except: scene.cycles.device='CPU'
scene.render.resolution_x=1600; scene.render.resolution_y=1200; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'
scene.render.fps=30; scene.frame_start=1; scene.frame_end=300
scene.view_settings.view_transform='AgX'
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.48,.58,.70,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.32
scene.render.film_transparent=False
cols={}
for name in ['SOIL','SOIL_FRONT • top view only','PEAT','BOREHOLE','DRY_ICE','CO2','FIRE','SHOCKWAVE','LIGHTING','ANNOTATIONS','SURFACE_DETAIL']:
    c=bpy.data.collections.new(name); scene.collection.children.link(c); cols[name]=c
def move(ob,col):
    for c in list(ob.users_collection): c.objects.unlink(ob)
    cols[col].objects.link(ob); return ob
def mat_basic(name,col,rough=.8):
    m=bpy.data.materials.new(name); m.diffuse_color=(*col,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*col,1); p.inputs['Roughness'].default_value=rough
    return m
def earth_mat(name,c1,c2,scale=8):
    m=mat_basic(name,c1); n=m.node_tree.nodes; l=m.node_tree.links; p=n.get('Principled BSDF')
    t=n.new('ShaderNodeTexCoord'); tex=n.new('ShaderNodeTexNoise'); tex.inputs['Scale'].default_value=scale; tex.inputs['Detail'].default_value=5; tex.inputs['Roughness'].default_value=.77
    l.new(t.outputs['Object'],tex.inputs['Vector'])
    ramp=n.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].position=.2; ramp.color_ramp.elements[0].color=(*c1,1); ramp.color_ramp.elements[1].position=.8; ramp.color_ramp.elements[1].color=(*c2,1)
    l.new(tex.outputs['Fac'],ramp.inputs[0]); l.new(ramp.outputs['Color'],p.inputs['Base Color'])
    fine=n.new('ShaderNodeTexNoise'); fine.inputs['Scale'].default_value=135; fine.inputs['Detail'].default_value=3; l.new(t.outputs['Object'],fine.inputs['Vector'])
    bump=n.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.66; bump.inputs['Distance'].default_value=.028; l.new(fine.outputs['Fac'],bump.inputs['Height'])
    coarse=n.new('ShaderNodeBump'); coarse.inputs['Strength'].default_value=.44; coarse.inputs['Distance'].default_value=.06; l.new(tex.outputs['Fac'],coarse.inputs['Height']); l.new(bump.outputs['Normal'],coarse.inputs['Normal']); l.new(coarse.outputs['Normal'],p.inputs['Normal'])
    return m
soil_mats=[earth_mat('O • fibrous humus',(.017,.012,.007),(.080,.055,.024),13),earth_mat('A • organic loam',(.048,.026,.011),(.16,.097,.042),9),earth_mat('B • iron-stained subsoil',(.12,.066,.028),(.26,.165,.082),6),earth_mat('C • sandy parent material',(.18,.14,.090),(.36,.28,.18),7)]
def h(x,y,i):
    bases=[0,-.19,-.83,-1.75,-3.2]
    if i==4:return bases[i]
    a=[.027,.040,.080,.085][i]
    return bases[i]+a*(math.sin(x*1.6+y*.7)+.55*math.sin(x*3.2-y*1.3))
def layer(name,lo,hi,i,col):
    nx=80; ny=40; verts=[]; faces=[]
    for level in [i,i+1]:
        for j in range(ny+1):
            y=lo+(hi-lo)*j/ny
            for k in range(nx+1):
                x=-4+8*k/nx; verts.append((x,y,h(x,y,level)))
    w=nx+1; N=w*(ny+1)
    for j in range(ny):
        for k in range(nx):
            q=j*w+k; faces.append((q,q+1,q+w+1,q+w)); faces.append((N+q+w,N+q+w+1,N+q+1,N+q))
    ring=list(range(w))+[j*w+nx for j in range(1,ny+1)]+[ny*w+k for k in range(nx-1,-1,-1)]+[j*w for j in range(ny-1,0,-1)]
    for a,b in zip(ring,ring[1:]+ring[:1]): faces.append((a,N+a,N+b,b))
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
    ob=bpy.data.objects.new(name,me); cols[col].objects.link(ob); ob.data.materials.append(soil_mats[i]); return ob
bpy.ops.mesh.primitive_cylinder_add(vertices=128,radius=.375,depth=2.84,location=(-1.4,0,-1.02))
cutter=move(bpy.context.object,'BOREHOLE'); cutter.name='BOREHOLE • Ø 0.75 m × 2.44 m | editable cutter'; cutter.hide_render=True; cutter.display_type='WIRE'; cutter.hide_set(True)
cutter['diameter_m']=.75; cutter['bottom_elevation_m']=-2.44; cutter['nominal_ground_elevation_m']=0.0
for i in range(4):
    for lo,hi,col,suffix in [(0,4,'SOIL','section'),(-4,0,'SOIL_FRONT • top view only','removable front')]:
        ob=layer(f'{i+1:02d} • {soil_mats[i].name} | {suffix}',lo,hi,i,col)
        mod=ob.modifiers.new('Open borehole to −2.440 m','BOOLEAN'); mod.operation='DIFFERENCE'; mod.solver='EXACT'; mod.object=cutter
def uv(name,loc,scale,mat,col,segments=32,rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1,location=loc)
    ob=move(bpy.context.object,col); ob.name=name; ob.scale=scale
    if mat: ob.data.materials.append(mat)
    for f in ob.data.polygons:f.use_smooth=True
    return ob
def curve(name,pts,radius,mat,col):
    cu=bpy.data.curves.new(name,'CURVE'); cu.dimensions='3D'; cu.resolution_u=2; cu.bevel_depth=radius; cu.bevel_resolution=2
    sp=cu.splines.new('POLY'); sp.points.add(len(pts)-1)
    for p,v in zip(sp.points,pts):p.co=(*v,1)
    ob=bpy.data.objects.new(name,cu); cols[col].objects.link(ob)
    if mat:cu.materials.append(mat)
    return ob
rock_mats=[earth_mat('Pebble • grey umber',(.09,.087,.07),(.29,.28,.22),22),earth_mat('Pebble • ochre',(.17,.11,.055),(.36,.26,.14),20)]
rootmat=earth_mat('Fine roots and litter',(.021,.014,.008),(.13,.085,.032),18)
for i in range(235):
    x=random.uniform(-3.95,3.95); y=random.uniform(-3.95,3.95)
    if (x+1.4)**2+y*y<.23:continue
    z=h(x,y,0); sz=random.uniform(.018,.082)
    ob=uv('Surface aggregate %03d'%i,(x,y,z+.006),(sz,sz*.8,sz*.48),random.choice(rock_mats),'SURFACE_DETAIL' if y>=0 else 'SOIL_FRONT • top view only',12,8)
    ob.rotation_euler=tuple(random.uniform(-.5,.5) for _ in range(3))
for i in range(175):
    x=random.uniform(-3.9,3.9); z=random.uniform(-3.12,-.18)
    if abs(x+1.4)<.41 and z>-2.48:continue
    sz=random.uniform(.013,.054)
    uv('Section mineral inclusion %03d'%i,(x,-.011,z),(sz,sz*.35,sz*.65),random.choice(rock_mats),'SOIL',12,8)
for i in range(48):
    x=random.uniform(-3.8,3.8)
    if abs(x+1.4)<.43:continue
    z=h(x,0,0)-.04; pts=[]
    for k in range(6):pts.append((x+math.sin(k*.8+i)*.035,-.017-k*.001,z-k*random.uniform(.03,.08)))
    curve('Exposed root %02d'%i,pts,random.uniform(.003,.006),rootmat,'SOIL')
def camera(name,loc,target,ortho):
    d=bpy.data.cameras.new(name); o=bpy.data.objects.new(name,d); scene.collection.objects.link(o); o.location=loc; o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler(); d.type='ORTHO';d.ortho_scale=ortho;return o
section=camera('CAM_SECTION',(3.7,-15.5,6.3),(0,.8,-.85),10.9)
top=camera('CAM_TOP',(0,0,13),(0,0,0),10.1)
top.rotation_euler=(0,0,0)
scene.camera=section
for name,loc,power,size,col in [('Overcast softbox',(-3,-4,9),1650,7,(.90,.95,1)),('Warm sky fill',(5,4,7),1150,6,(1,.89,.74)),('Section diffuse fill',(-1,-6,2),550,5,(.89,.94,1))]:
    d=bpy.data.lights.new(name,'AREA'); d.energy=power;d.shape='DISK';d.size=size;d.color=col
    ob=bpy.data.objects.new(name,d);cols['LIGHTING'].objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector((0,0,-.5))-ob.location).to_track_quat('-Z','Y').to_euler()
stage=mat_basic('Backdrop • slate',(.035,.045,.054),.9)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-3.24));ob=move(bpy.context.object,'LIGHTING');ob.name='Neutral ground';ob.data.materials.append(stage)
vl=scene.view_layers[0];vl.name='SECTION';vl.layer_collection.children['SOIL_FRONT • top view only'].exclude=True
vl2=scene.view_layers.new('TOP');vl2.use=False
scene['Scientific status']='CONCEPTUAL VISUALIZATION. Prescribed gas motion and pressure pulse; no thermodynamic, CFD or extinguishment prediction. White gas is a visibility proxy.'
scene['Soil volume']='8 m × 8 m × 3.2 m; north half shown in SECTION, full site in TOP.'
def save():
    scene.render.filepath=str(OUT/'renders/preview.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Dry_Ice_Peat_Study.blend'))
def view_cam():
    area=bpy.context.area
    if area:
        area.type='VIEW_3D';area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.type='MATERIAL'
        area.spaces.active.overlay.show_overlays=False
        area.spaces.active.region_3d.view_camera_zoom=5
scene.frame_set(1)
save();view_cam()
print('STAGE 1 COMPLETE: layered terrain, editable borehole, two cameras, Cycles lighting')
