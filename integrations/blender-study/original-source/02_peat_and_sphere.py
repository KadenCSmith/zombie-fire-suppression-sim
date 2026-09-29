import bmesh
random.seed(806)
peatmat=earth_mat('Peat • charred fibrous organic matrix',(.006,.004,.003),(.045,.023,.010),21)
peat=uv('Peat lens • exposed planar geological section',(1.40,.72,-.52),(1.66,1.83,.55),peatmat,'PEAT',64,32)
bpy.context.view_layer.objects.active=peat; peat.select_set(True)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
for v in peat.data.vertices:
    v.co*=1+noise.noise_vector(v.co*6.8)[0]*.075
bm=bmesh.new();bm.from_mesh(peat.data)
ret=bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.00001,plane_co=(0,-.72,0),plane_no=(0,1,0),clear_inner=True,clear_outer=False)
edges=[e for e in bm.edges if e.is_boundary]
bmesh.ops.holes_fill(bm,edges=edges,sides=0);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(peat.data);bm.free()
for ob in cols['SOIL'].objects:
    if ob.name.startswith(('01','02','03')):
        mod=ob.modifiers.new('Natural peat lens cavity','BOOLEAN');mod.object=peat;mod.operation='DIFFERENCE';mod.solver='EXACT'
# Flat cut face: coal particles and fibrous roots occur on the exposed face.
char_mats=[earth_mat('Char fragment '+str(i),(.004+i*.002,.003+i*.001,.002),(.025+i*.009,.015+i*.005,.008+i*.003),32) for i in range(3)]
def ember_mat(name,strength):
    m=mat_basic(name,(.075,.007,.001),.86);p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=(1,.065,.004,1);p.inputs['Emission Strength'].default_value=strength
    return m
ember_near=ember_mat('Embers • CO2 contacted zone | animated reduction',3.3)
ember_far=ember_mat('Embers • continuing smolder',2.7)
def key_socket(s,keys):
    for f,v in keys:s.default_value=v;s.keyframe_insert('default_value',frame=f)
key_socket(ember_near.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'],[(1,3.3),(145,3.3),(185,.7),(240,.24),(300,.24)])
for i in range(180):
    x=random.uniform(-.05,3.01); z=random.uniform(-1.04,-.13)
    if ((x-1.4)/1.56)**2+((z+.55)/.49)**2>1:continue
    s=random.uniform(.026,.075)
    ob=uv('Exposed peat fragment %03d'%i,(x,-.022,z),(s*1.4,.024,s*.53),random.choice(char_mats),'PEAT',12,8)
    ob.rotation_euler.y=random.uniform(-.8,.8)
    if random.random()<.6:
        pts=[(x-s*.65,-.048,z),(x-s*.12,-.051,z+.010),(x+s*.55,-.048,z+.004)]
        curve('Fine smoldering fissure %03d'%i,pts,random.uniform(.003,.008),ember_near if x<1.45 else ember_far,'FIRE')
for i in range(52):
    x=random.uniform(.0,2.9);z=random.uniform(-.88,-.18)
    if ((x-1.4)/1.5)**2+((z+.53)/.43)**2>1:continue
    pts=[(x+k*.025,-.050,z+math.sin(k*.9+i)*.016) for k in range(7)]
    curve('Peat fibre %03d'%i,pts,.0045,rootmat,'PEAT')
# Burn scar lies on the natural surface; irregular perimeter avoids a circular decal.
vs=[(1.5,.85,h(1.5,.85,0)+.012)];fs=[];N=100
for i in range(N):
    a=i*2*math.pi/N;r=1+.1*math.sin(a*7)+.07*math.sin(a*11+.3)
    x=1.5+1.3*r*math.cos(a);y=.85+1.04*r*math.sin(a)
    y=max(.005,y);vs.append((x,y,h(x,y,0)+.014))
for i in range(N):fs.append((0,i+1,(i+1)%N+1))
me=bpy.data.meshes.new('Irregular burn scar');me.from_pydata(vs,[],fs);me.update();ob=bpy.data.objects.new('Burn scar • localized surface venting',me);cols['PEAT'].objects.link(ob);ob.data.materials.append(peatmat)
for i in range(120):
    x=random.uniform(.17,2.92);y=random.uniform(.02,1.9)
    if ((x-1.5)/1.28)**2+((y-.85)/1.02)**2>1:continue
    s=random.uniform(.018,.075);z=h(x,y,0)+.017
    ob=uv('Surface char clast %03d'%i,(x,y,z),(s*1.8,s,s*.6),random.choice(char_mats),'PEAT',12,8);ob.rotation_euler.z=random.random()*6.28
    if i%5==0:
        curve('Surface ember %03d'%i,[(x-.03,y,z+.025),(x,y+.008,z+.034),(x+.04,y,z+.026)],.005,ember_near if x<1.45 else ember_far,'FIRE')
# Broken, sparse vegetation and organic litter on the surrounding soil.
grass_mats=[mat_basic('Dry sedge',(.13,.105,.04),.92),mat_basic('Moss green',(.054,.075,.025),.95),rootmat]
for i in range(370):
    x=random.uniform(-3.95,3.95);y=random.uniform(-3.9,3.9)
    if (x+1.4)**2+y*y<.28 or ((x-1.5)/1.6)**2+((y-.85)/1.25)**2<1:continue
    z=h(x,y,0);col='SURFACE_DETAIL' if y>=0 else 'SOIL_FRONT • top view only'
    length=random.uniform(.04,.22);ang=random.uniform(0,6.28)
    curve('Sedge or litter %03d'%i,[(x,y,z),(x+math.cos(ang)*length*.3,y+math.sin(ang)*length*.3,z+length*.65),(x+math.cos(ang)*length*.7,y+math.sin(ang)*length*.7,z+length*.8)],random.uniform(.0015,.0035),random.choice(grass_mats),col)
# Exact nominal sphere; all surface relief is shading, preserving its 0.500 m diameter.
ice=earth_mat('Dry ice • white microcrystalline frost',(.60,.70,.74),(.96,.985,1),34)
ip=ice.node_tree.nodes.get('Principled BSDF');ip.inputs['Roughness'].default_value=.7;ip.inputs['Subsurface Weight'].default_value=.045;ip.inputs['Subsurface Radius'].default_value=(.06,.045,.025)
sphere=uv('DRY ICE • Ø 0.500 m | vertical ballistic drop',(-1.4,0,.84),(.25,.25,.25),ice,'DRY_ICE',64,32)
sphere['diameter_m']=.5;sphere['drop_acceleration_m_s2']=9.81;sphere['rest_center_z_m']=-2.19
sphere.keyframe_insert('location',frame=1);sphere.keyframe_insert('location',frame=35)
for f in range(36,60):
    t=(f-35)/30;sphere.location.z=max(-2.19,.84-.5*9.81*t*t);sphere.keyframe_insert('location',frame=f)
sphere.location.z=-2.19;sphere.keyframe_insert('location',frame=59);sphere.keyframe_insert('location',frame=300)
for fc in sphere.animation_data.action.fcurves:
    for k in fc.keyframe_points:k.interpolation='LINEAR'
# Volumes use soft radial falloff multiplied by animated turbulent density.
def volume_mat(name,color,density,scale=5,emission=None):
    m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;n.clear();l=m.node_tree.links
    out=n.new('ShaderNodeOutputMaterial');v=n.new('ShaderNodeVolumePrincipled');v.inputs['Color'].default_value=(*color,1);v.inputs['Anisotropy'].default_value=.15
    v.inputs['Density Attribute'].default_value='';l.new(v.outputs['Volume'],out.inputs['Volume'])
    tc=n.new('ShaderNodeTexCoord');sub=n.new('ShaderNodeVectorMath');sub.operation='SUBTRACT';sub.inputs[1].default_value=(.5,.5,.5);l.new(tc.outputs['Generated'],sub.inputs[0])
    length=n.new('ShaderNodeVectorMath');length.operation='LENGTH';l.new(sub.outputs['Vector'],length.inputs[0])
    ramp=n.new('ShaderNodeMapRange');ramp.clamp=True;ramp.inputs['From Min'].default_value=.12;ramp.inputs['From Max'].default_value=.5;ramp.inputs['To Min'].default_value=1;ramp.inputs['To Max'].default_value=0;l.new(length.outputs['Value'],ramp.inputs['Value'])
    tex=n.new('ShaderNodeTexNoise');tex.noise_dimensions='4D';tex.inputs['Scale'].default_value=scale;tex.inputs['Detail'].default_value=3.0;tex.inputs['Roughness'].default_value=.7;l.new(tc.outputs['Generated'],tex.inputs['Vector'])
    key_socket(tex.inputs['W'],[(1,random.random()*5),(300,5+random.random()*5)])
    cr=n.new('ShaderNodeValToRGB');cr.color_ramp.elements[0].position=.28;cr.color_ramp.elements[1].position=.70;l.new(tex.outputs['Fac'],cr.inputs[0])
    mul=n.new('ShaderNodeMath');mul.operation='MULTIPLY';l.new(ramp.outputs['Result'],mul.inputs[0]);l.new(cr.outputs['Color'],mul.inputs[1])
    den=n.new('ShaderNodeMath');den.name='Density control';den.operation='MULTIPLY';den.inputs[1].default_value=density;l.new(mul.outputs[0],den.inputs[0]);l.new(den.outputs[0],v.inputs['Density'])
    if emission:
        v.inputs['Emission Color'].default_value=(*emission,1);l.new(den.outputs[0],v.inputs['Emission Strength'])
    return m,den.inputs[1]
smoke_near,smoke_d=volume_mat('Smoke • contacted vents | modest reduction',(.29,.27,.24),1.25,5)
smoke_far,_=volume_mat('Smoke • sustained peat smolder',(.29,.27,.24),1.20,5)
key_socket(smoke_d,[(1,1.25),(150,1.25),(240,.85),(300,.85)])
for j,(x,y) in enumerate([(.72,.4),(1.02,1.15),(2.10,.5),(2.55,1.04)]):
    for k in range(4):
        ob=uv('Smoke vent %d • wisp %d'%(j,k),(x+k*.13,y+k*.08,.14+k*.29),(.16+k*.09,.14+k*.075,.29+k*.10),smoke_near if j<2 else smoke_far,'FIRE',20,12)
        ob.keyframe_insert('location',frame=1);ob.location.x+=.22;ob.location.y+=.10;ob.keyframe_insert('location',frame=300)
flames=[]
for j,(x,y) in enumerate([(.69,.28),(1.02,.7),(2.14,.44),(2.42,1.0)]):
    ma,control=volume_mat('Tiny vent flame %d'%j,(.2,.06,.009),3.8,5,(1,.20,.015))
    ob=uv('Localized flame • %d'%j,(x,y,h(x,y,0)+.11),(.055,.04,.14),ma,'FIRE',20,12);flames.append(ob)
    base=ob.scale.copy()
    for f in range(1,301,7):
        fac=random.uniform(.72,1.15)*(1 if f<160 or j>=2 else .28)
        ob.scale=(base.x,base.y,base.z*fac);ob.keyframe_insert('scale',frame=f)
scene.frame_set(66)
save();view_cam()
print('STAGE 2 COMPLETE: peat, char, smoke, small flames, 0.500 m sphere and ballistic drop')
