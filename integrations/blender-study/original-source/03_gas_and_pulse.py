random.seed(908)
co2mat,co2density=volume_mat('CO2 visibility proxy • cold white turbulent mist',(.80,.85,.88),4.2,5)
under,underd=volume_mat('CO2 in pores • section-only concentration proxy',(.83,.90,.94),6.5,6)
surface,surfd=volume_mat('CO2 • low surface gravity-current proxy',(.80,.85,.88),3.7,5)
frost,frostd=volume_mat('Dry-ice boundary fog',(.83,.90,.94),1.3,5)
fog=uv('Cold boundary fog around dry ice',(-1.4,0,-2.15),(.31,.30,.30),frost,'CO2',24,16)
fog.parent=sphere;fog.matrix_parent_inverse=sphere.matrix_world.inverted()
def grow(ob,start,end,fade=None,final=.8):
    base=ob.scale.copy();ob.scale=(.001,.001,.001);ob.keyframe_insert('scale',frame=1);ob.keyframe_insert('scale',frame=start-1)
    ob.scale=base*.25;ob.keyframe_insert('scale',frame=start)
    ob.scale=base;ob.keyframe_insert('scale',frame=end)
    if fade:
        ob.keyframe_insert('scale',frame=fade);ob.scale=base*final;ob.keyframe_insert('scale',frame=300)
    ob['appearance_frame']=start;ob['fully_developed_frame']=end
for i in range(8):
    z=-2.06+i*.30
    ob=uv('CO2 • ascending borehole parcel %02d'%i,(-1.4+random.uniform(-.035,.035),-.012,z),(.28,.27,.39),co2mat,'CO2',24,16)
    grow(ob,76+i*2,86+i*3,190,.65)
for i in range(15):
    a=i*2.4;r=.22+math.sqrt(i)*.42
    x=-1.4+math.cos(a)*r;y=math.sin(a)*r
    z=h(x,y,0)+.15+random.uniform(-.025,.035)
    ob=uv('CO2 • surface spreading lobe %02d'%i,(x,y,z),(.51+i*.018,.43+i*.02,.20+random.random()*.08),surface,'CO2',24,16)
    grow(ob,89+i*3,105+i*4,210,1.23)
key_socket(surfd,[(1,3.7),(180,3.7),(300,1.75)])
# Section-facing density slices: visible proxy for gas occupying pore space.
paths=[(-1.05,-1.94,.31,.29,82),(-.66,-1.69,.41,.32,91),(-.25,-1.42,.43,.33,102),(.18,-1.17,.44,.34,115),(.61,-.96,.45,.31,129),(1.01,-.73,.46,.28,145),(-.96,-1.25,.28,.25,104),(-.50,-.86,.35,.23,123),(.02,-.61,.37,.20,143),(-1.92,-1.77,.28,.26,91),(-2.26,-1.40,.31,.26,107)]
for i,(x,z,sx,sz,f) in enumerate(paths):
    ob=uv('CO2 • porous-soil migration slice %02d'%i,(x,-.11,z),(sx,.17,sz),under,'CO2',24,16);grow(ob,f,f+28,225,1.18)
    ob['Display convention']='Section density slice laid across the exposed plane to reveal gas in otherwise opaque soil; prescribed transport, not a simulation.'
key_socket(underd,[(1,6.5),(190,6.5),(300,3.2)])
# Short-lived translucent pressure front. This ring is the cut-plane
# intersection of an expanding spherical shell, not a combustion fireball.
pm=bpy.data.materials.new('Pressure front • translucent section intersection');pm.use_nodes=True
n=pm.node_tree.nodes;n.clear();l=pm.node_tree.links;o=n.new('ShaderNodeOutputMaterial');tr=n.new('ShaderNodeBsdfTransparent');em=n.new('ShaderNodeEmission');em.inputs['Color'].default_value=(.54,.72,.77,1);em.inputs['Strength'].default_value=.8
mx=n.new('ShaderNodeMixShader');l.new(tr.outputs[0],mx.inputs[1]);l.new(em.outputs[0],mx.inputs[2]);l.new(mx.outputs[0],o.inputs['Surface'])
key_socket(mx.inputs[0],[(1,0),(74,0),(77,.30),(89,.22),(101,.07),(111,0),(300,0)])
N=160;vs=[];fs=[]
for r in [.974,1.0]:
    for i in range(N):
        a=i*2*math.pi/N;vs.append((r*math.cos(a),0,r*math.sin(a)))
for i in range(N):j=(i+1)%N;fs.append((i,j,N+j,N+i))
me=bpy.data.meshes.new('Spherical pulse section');me.from_pydata(vs,[],fs);me.update();pulse=bpy.data.objects.new('Pressure pulse • expanding shell intersection',me);cols['SHOCKWAVE'].objects.link(pulse);pulse.data.materials.append(pm);pulse.location=(-1.4,-.30,-2.19)
for f,r in [(1,.01),(74,.25),(80,.55),(90,1.12),(100,1.75),(111,2.4),(300,2.4)]:pulse.scale=(r,r,r);pulse.keyframe_insert('scale',frame=f)
pulse['Display convention']='Translucent section intersection of a conceptual spherical pressure front; fade duration is chosen for legibility.'
# Suppress ring portions beyond the soil section's top or bottom.
geo=n.new('ShaderNodeNewGeometry');sep=n.new('ShaderNodeSeparateXYZ');l.new(geo.outputs['Position'],sep.inputs[0]);gt=n.new('ShaderNodeMath');gt.operation='GREATER_THAN';gt.inputs[1].default_value=-3.19;l.new(sep.outputs['Z'],gt.inputs[0]);lt=n.new('ShaderNodeMath');lt.operation='LESS_THAN';lt.inputs[1].default_value=.03;l.new(sep.outputs['Z'],lt.inputs[0]);mask=n.new('ShaderNodeMath');mask.operation='MULTIPLY';l.new(gt.outputs[0],mask.inputs[0]);l.new(lt.outputs[0],mask.inputs[1]);fac=n.new('ShaderNodeValue');fac.name='Animated pressure opacity';key_socket(fac.outputs[0],[(1,0),(74,0),(77,.30),(89,.22),(101,.07),(111,0),(300,0)]);masked=n.new('ShaderNodeMath');masked.operation='MULTIPLY';l.new(fac.outputs[0],masked.inputs[0]);l.new(mask.outputs[0],masked.inputs[1]);l.new(masked.outputs[0],mx.inputs[0])
dust,dustd=volume_mat('Transient loose soil dust',(.34,.25,.15),1.9,8)
key_socket(dustd,[(1,0),(87,0),(96,1.9),(115,.8),(140,0),(300,0)])
for i in range(7):
    a=i*6.28/7;x=-1.4+math.cos(a)*.4;y=math.sin(a)*.4
    ob=uv('Dust disturbance %02d'%i,(x,y,.07),(.27,.25,.19),dust,'SHOCKWAVE',20,12);grow(ob,90,109)
    ob.location.z=.07;ob.keyframe_insert('location',frame=90);ob.location.z=.28;ob.keyframe_insert('location',frame=125)
for i in range(24):
    a=random.random()*6.28;r=random.uniform(.39,.53);x=-1.4+math.cos(a)*r;y=math.sin(a)*r;z=h(x,y,0)+.008;s=random.uniform(.009,.026)
    ob=uv('Loose soil fragment • pulse %02d'%i,(x,y,z),(s,s*.7,s*.5),soil_mats[0],'SHOCKWAVE',10,6)
    ob.keyframe_insert('location',frame=1);ob.keyframe_insert('location',frame=89);ob.location+=Vector((math.cos(a)*.07,math.sin(a)*.07,.10+random.random()*.1));ob.keyframe_insert('location',frame=97);ob.location=(x+math.cos(a)*.14,y+math.sin(a)*.14,h(x,y,0)+.008);ob.keyframe_insert('location',frame=110);ob.keyframe_insert('location',frame=300)
# Camera-linked type provides unobtrusive, editable scientific framing.
labelmat=mat_basic('Annotation • soft ivory',(.7,.79,.81),.8);lp=labelmat.node_tree.nodes.get('Principled BSDF');lp.inputs['Emission Color'].default_value=(.70,.79,.81,1);lp.inputs['Emission Strength'].default_value=.7
muted=mat_basic('Annotation • muted',(.36,.48,.53),.8);mp=muted.node_tree.nodes.get('Principled BSDF');mp.inputs['Emission Color'].default_value=(.36,.48,.53,1);mp.inputs['Emission Strength'].default_value=.6
def camera_text(name,text,cam,x,y,size,mat):
    cu=bpy.data.curves.new(name,'FONT');cu.body=text;cu.size=size;cu.extrude=0;cu.space_character=1.12
    ob=bpy.data.objects.new(name,cu);cols['ANNOTATIONS'].objects.link(ob);ob.parent=cam;ob.location=(x,y,-10);cu.materials.append(mat);return ob
header=camera_text('Section title','DRY ICE / SUBSURFACE PEAT',section,-4.8,3.38,.22,labelmat)
subtitle=camera_text('Section subtitle','CONCEPTUAL TRANSPORT STUDY     /     VERTICAL SECTION',section,-4.8,3.04,.105,muted)
footer=camera_text('Section disclaimer','Prescribed gas and pressure visualization  •  No validated suppression prediction',section,-4.8,-3.67,.103,muted)
status=camera_text('Section stage','01   |   SPHERE AT REST • BEFORE RELEASE',section,-4.8,2.70,.115,labelmat)
# Text bodies are changed for the four still renders by render script; in animation
# the static scientific caption is used and timeline markers identify each phase.
status.data.body='0.50 m dry ice     /     0.75 m borehole     /     2.44 m depth'
top_text=[]
top_text.append(camera_text('Top title','DRY ICE / SURFACE DISPERSAL',top,-4.65,3.49,.20,labelmat))
top_text.append(camera_text('Top subtitle','PLAN VIEW    /    CONCEPTUAL CO2 VISIBILITY PROXY',top,-4.65,3.18,.105,muted))
top_text.append(camera_text('Top footer','8 m × 8 m soil footprint  •  Gas transport is prescribed for illustration',top,-4.65,-3.6,.10,muted))
# Separate camera annotations by view layer.
for c in ['SECTION_LABELS','TOP_LABELS']:
    co=bpy.data.collections.new(c);scene.collection.children.link(co);cols[c]=co
for ob in [header,subtitle,footer,status]:move(ob,'SECTION_LABELS')
for ob in top_text:move(ob,'TOP_LABELS')
scene.view_layers['SECTION'].layer_collection.children['TOP_LABELS'].exclude=True
scene.view_layers['TOP'].layer_collection.children['SECTION_LABELS'].exclude=True
# A 1 m scale along the bottom of the section and depth bracket adjacent to shaft.
curve('Depth guide • 2.44 m',[(-2.14,-.08,0),(-2.14,-.08,-2.44)],.006,muted,'ANNOTATIONS')
for z in [0,-2.44]:curve('Depth tick '+str(z),[(-2.22,-.08,z),(-2.06,-.08,z)],.006,muted,'ANNOTATIONS')
def world_text(name,body,loc,size):
    cu=bpy.data.curves.new(name,'FONT');cu.body=body;cu.size=size;ob=bpy.data.objects.new(name,cu);cols['SECTION_LABELS'].objects.link(ob);ob.location=loc;ob.rotation_euler=section.rotation_euler;cu.materials.append(labelmat);return ob
world_text('Borehole depth label','2.44 m\n8 ft',(-3.03,-.15,-1.32),.13)
world_text('Peat zone label','SMOLDERING PEAT',(.25,-.16,-.06),.095)
for f,name in [(1,'01 • Initial sphere above hole'),(35,'02 • Release / ballistic drop'),(59,'03 • Sphere rests at −2.19 m'),(75,'04 • Conceptual rapid release'),(95,'05 • Pressure + borehole expansion'),(145,'06 • CO2 reaches near peat'),(240,'07 • Partial local suppression')]:scene.timeline_markers.new(name,frame=f)
scene.frame_set(100);save();view_cam()
print('STAGE 3 COMPLETE: gas, pressure, dust, local suppression, labeled cameras')
