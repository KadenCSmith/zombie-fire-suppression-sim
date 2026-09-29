random.seed(221)
scene.frame_set(66)
# Embed darker, angular aggregates rather than bright uniform rounded disks.
for ma in rock_mats:
    for nd in ma.node_tree.nodes:
        if nd.type=='VALTORGB':
            for e in nd.color_ramp.elements:e.color=tuple(v*.40 for v in e.color[:3])+(1,)
for ob in list(scene.objects):
    if ob.name.startswith(('Surface aggregate','Section mineral inclusion')):
        if random.random()<.34:ob.hide_render=True;ob.hide_viewport=True;continue
        for v in ob.data.vertices:v.co*=random.uniform(.74,1.21)
        for p in ob.data.polygons:p.use_smooth=False
        ob.scale*=random.uniform(.38,.85)
        if ob.name.startswith('Surface'):ob.location.z-=.008
        else:ob.location.y+=.004
    if ob.name.startswith(('Surface char clast','Exposed peat fragment')):
        for v in ob.data.vertices:v.co*=random.uniform(.62,1.28)
        for p in ob.data.polygons:p.use_smooth=False
        ob.scale*=random.uniform(.55,.97)
    if ob.name.startswith(('Fine smoldering fissure','Surface ember')):
        # Turn repeated thick neon slits into irregular fine, partially buried fissures.
        if random.random()<.30:ob.hide_render=True;continue
        ob.data.bevel_depth*=random.uniform(.30,.64)
        for sp in ob.data.splines:
            for p in sp.points:p.co.x+=random.uniform(-.018,.018);p.co.z+=random.uniform(-.009,.009)
for m in soil_mats:
    n=m.node_tree.nodes;l=m.node_tree.links;p=n.get('Principled BSDF');old=p.inputs['Base Color'].links[0].from_socket
    tc=n.new('ShaderNodeTexCoord');tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=1.25;tex.inputs['Detail'].default_value=4;l.new(tc.outputs['Object'],tex.inputs['Vector'])
    cr=n.new('ShaderNodeValToRGB');cr.color_ramp.elements[0].position=.25;cr.color_ramp.elements[0].color=(.23,.21,.18,1);cr.color_ramp.elements[1].position=.73;cr.color_ramp.elements[1].color=(1,1,.92,1);l.new(tex.outputs['Fac'],cr.inputs[0])
    mix=n.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=.67;l.new(old,mix.inputs[1]);l.new(cr.outputs['Color'],mix.inputs[2]);l.new(mix.outputs[0],p.inputs['Base Color'])
    p.inputs['Roughness'].default_value=.96
# Rougher, lightly asymmetric soil contacts while preserving the flat cut plane.
for ob in list(cols['SOIL'].objects)+list(cols['SOIL_FRONT • top view only'].objects):
    if ob.name.startswith(('01','02','03','04')):
        for v in ob.data.vertices:
            if v.co.z>-3.1:v.co.z+=noise.noise_vector(Vector((v.co.x*3.2,v.co.y*3.2,2.3)))[2]*.013
# A subtle rough radial silhouette, normalized back to the required 0.500 m bbox.
for v in sphere.data.vertices:v.co*=1+noise.noise_vector(v.co*38)[0]*.007
bpy.context.view_layer.update();sphere.dimensions=(.5,.5,.5)
ip.inputs['Roughness'].default_value=.93
for nd in ice.node_tree.nodes:
    if nd.type=='TEX_NOISE':nd.inputs['Scale'].default_value=12 if nd.inputs['Scale'].default_value<100 else 72
    if nd.type=='BUMP':nd.inputs['Distance'].default_value=.012;nd.inputs['Strength'].default_value=.72
# Break the burn scar into gritty ash / carbon, including a sparse emission mask.
ash=earth_mat('Ash and porous carbon crust',(.007,.006,.004),(.18,.15,.11),48)
for nd in ash.node_tree.nodes:
    if nd.type=='VALTORGB':
        e=nd.color_ramp.elements.new(.66);e.color=(.04,.035,.027,1)
bpy.data.objects['Burn scar • localized surface venting'].data.materials.clear();bpy.data.objects['Burn scar • localized surface venting'].data.materials.append(ash)
for ob in [bpy.data.objects['Burn scar • localized surface venting']]:
    # Dense triangulation supports fine actual surface relief.
    bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.subdivide_edges(bm,edges=list(bm.edges),cuts=3,use_grid_fill=True)
    for v in bm.verts:v.co.z+=noise.noise_vector(v.co*23)[0]*.013
    bm.to_mesh(ob.data);bm.free()
# Fine charred peat fibres and angular crumbs, built as efficient editable meshes.
debris_mats=[soil_mats[0],soil_mats[1],rootmat,ash]+char_mats
def debris_mesh(name,points,col):
    vs=[];fs=[];mi=[]
    for x,y,z,r,mode in points:
        start=len(vs)
        if mode=='surface':
            vs.extend([(x-r,y-r*.3,z),(x+r*.8,y-r*.7,z+.003),(x+r,y+r*.4,z),(x-r*.4,y+r*.7,z+.003),(x,y,z+r*.63)])
        else:
            vs.extend([(x-r,y,z-r*.3),(x+r*.8,y,z-r*.7),(x+r,y,z+r*.4),(x-r*.4,y,z+r*.7),(x,y-r*.6,z)])
        for face in [(0,1,4),(1,2,4),(2,3,4),(3,0,4),(3,2,1,0)]:fs.append(tuple(start+a for a in face));mi.append(random.randrange(len(debris_mats)))
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();ob=bpy.data.objects.new(name,me);cols[col].objects.link(ob)
    for m in debris_mats:me.materials.append(m)
    for p,i in zip(me.polygons,mi):p.material_index=i
    return ob
points=[];front=[]
for i in range(2100):
    x=random.uniform(-3.98,3.98);y=random.uniform(-3.98,3.98)
    if (x+1.4)**2+y*y<.18:continue
    q=(x,y,h(x,y,0)+.007,random.uniform(.008,.026),'surface')
    (points if y>=0 else front).append(q)
debris_mesh('Fine soil and organic surface granules',points,'SURFACE_DETAIL');debris_mesh('Fine soil granules • front half',front,'SOIL_FRONT • top view only')
peatpts=[]
for i in range(850):
    x=random.uniform(.0,3.0);z=random.uniform(-1.05,-.12)
    if ((x-1.4)/1.52)**2+((z+.54)/.48)**2<1:peatpts.append((x,-.045,z,random.uniform(.008,.028),'section'))
debris_mesh('Porous exposed peat texture • angular carbon and ash',peatpts,'PEAT')
for i in range(280):
    x=random.uniform(.10,2.88);y=random.uniform(.03,1.87)
    if ((x-1.5)/1.3)**2+((y-.85)/1.02)**2>1:continue
    z=h(x,y,0)+.025;a=random.random()*6.28;length=random.uniform(.035,.14)
    curve('Charred organic fibre • surface %03d'%i,[(x,y,z),(x+math.cos(a)*length*.5,y+math.sin(a)*length*.5,z+.008),(x+math.cos(a)*length,y+math.sin(a)*length,z+.002)],random.uniform(.002,.006),random.choice(char_mats),'PEAT')
for i in range(180):
    x=random.uniform(.03,2.85);z=random.uniform(-.94,-.19)
    if ((x-1.4)/1.50)**2+((z+.54)/.43)**2>1:continue
    a=random.random()*6.28;length=random.uniform(.035,.12)
    curve('Charred organic fibre • section %03d'%i,[(x,-.065,z),(x+math.cos(a)*length*.5,-.067,z+math.sin(a)*length*.5),(x+math.cos(a)*length,-.063,z+math.sin(a)*length)],random.uniform(.002,.005),random.choice(char_mats),'PEAT')
# Surface vegetation clumps are sparse, irregular and well outside the hot patch.
for i in range(62):
    x=random.uniform(-3.8,3.8);y=random.uniform(.3,3.9)
    if (x+1.4)**2+y*y<.5 or ((x-1.5)/1.8)**2+((y-.85)/1.5)**2<1:continue
    z=h(x,y,0)
    for j in range(random.randint(4,7)):
        a=random.random()*6.28;le=random.uniform(.12,.34)
        curve('Sedge tuft %02d blade %d'%(i,j),[(x,y,z),(x+math.cos(a)*le*.20,y+math.sin(a)*le*.20,z+le*.6),(x+math.cos(a)*le*.65,y+math.sin(a)*le*.65,z+le*.82)],.002,random.choice(grass_mats),'SURFACE_DETAIL')
# More continuous, ground-hugging fog: broaden overlap, lower density, add fine breakup.
for ob in cols['CO2'].objects:
    if 'surface spreading lobe' in ob.name:
        if ob.animation_data:
            for fc in ob.animation_data.action.fcurves:
                if fc.data_path=='scale':
                    mul=1.45 if fc.array_index<2 else .60
                    for k in fc.keyframe_points:k.co.y*=mul;k.handle_left.y*=mul;k.handle_right.y*=mul
        ob.location.z=h(ob.location.x,ob.location.y,0)+.095
for ma in [surface,under,co2mat,smoke_far,smoke_near]:
    n=ma.node_tree.nodes;l=ma.node_tree.links;tex=next(nd for nd in n if nd.type=='TEX_NOISE');tex.inputs['Scale'].default_value=8;tex.inputs['Detail'].default_value=5
    # A second turbulent octave avoids a single soft noise frequency.
    extra=n.new('ShaderNodeTexNoise');extra.inputs['Scale'].default_value=22;extra.inputs['Detail'].default_value=2
    tc=next(nd for nd in n if nd.type=='TEX_COORD');l.new(tc.outputs['Generated'],extra.inputs['Vector'])
    mix=n.new('ShaderNodeMath');mix.operation='MULTIPLY';den=n.get('Density control');source=den.inputs[0].links[0].from_socket;l.new(source,mix.inputs[0]);l.new(extra.outputs['Fac'],mix.inputs[1]);l.new(mix.outputs[0],den.inputs[0])
key_socket(surfd,[(1,3.0),(180,3.0),(300,1.3)])
bridge,bridged=volume_mat('CO2 • continuous low boundary blanket',(.80,.87,.90),1.6,11)
ob=uv('CO2 • continuous ground-hugging bridge',(-1.4,0,.10),(1.65,1.45,.15),bridge,'CO2',40,20);grow(ob,92,145,215,1.12)
key_socket(bridged,[(1,1.6),(180,1.6),(300,.65)])
# Pressure front is aligned closely to the actual exposed plane.
pulse.location.y=-.018
for ob in list(cols['SECTION_LABELS'].objects)+list(cols['TOP_LABELS'].objects)+list(cols['ANNOTATIONS'].objects):ob.visible_shadow=False
label=bpy.data.objects['Peat zone label'];label.location=(.52,-.72,.18);label.data.body='SMOLDERING PEAT';label.data.size=.10
leader=curve('Peat label leader',[(1.35,-.64,.16),(1.35,-.10,-.13)],.0035,muted,'SECTION_LABELS');leader.visible_shadow=False
proxy=world_text('Section proxy legend','White in soil = conceptual CO2 concentration',(-.32,-.23,-2.75),.079);proxy.visible_shadow=False
# Soften frontal fill and add grazing overcast directionality.
bpy.data.lights['Overcast softbox'].energy=1750;bpy.data.lights['Overcast softbox'].size=5
bpy.data.lights['Section diffuse fill'].energy=260
bpy.data.lights['Warm sky fill'].energy=900
scene.frame_set(100);save();view_cam()
print('REFINEMENT COMPLETE: rough natural surfaces, fibrous peat, continuous fog and readable labels')
