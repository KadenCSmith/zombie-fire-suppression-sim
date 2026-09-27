# User revision: almost entirely buried peat, one surviving 0.20 m root to a tree.
random.seed(736)
ROOT_DIAMETER=.20
scene.frame_set(66)
treecol=bpy.data.collections.new('TREE • partially burned root connection');scene.collection.children.link(treecol);cols[treecol.name]=treecol
hide_prefixes=('Burn scar','Surface char clast','Surface ember','Charred organic fibre • surface')
for ob in list(scene.objects):
    if ob.name.startswith(hide_prefixes):ob.hide_render=True;ob.hide_viewport=True
    if ob.name.startswith(('Peat lens','Exposed peat fragment','Peat fibre','Porous exposed peat','Charred organic fibre • section','Fine smoldering fissure')):ob.location.z-=.16
# Surface cover stays in place. Peat now has a mineral/organic soil cap.
peat['burial_note']='Peat lens upper surface lowered by 0.16 m; surface burn scar removed. Only root/trunk vents connect to surface.'
# Remove old smoke vent sites; recreate restrained seepage at the root/trunk junction.
for ob in list(cols['FIRE'].objects):
    if ob.name.startswith(('Smoke vent','Localized flame')):ob.hide_render=True;ob.hide_viewport=True
bark=earth_mat('Living root and tree • fissured brown bark',(.025,.016,.008),(.17,.10,.048),18)
n=bark.node_tree.nodes;l=bark.node_tree.links;p=n.get('Principled BSDF');tc=n.new('ShaderNodeTexCoord');mapping=n.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(6,6,.65);l.new(tc.outputs['Object'],mapping.inputs[0]);tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=8;tex.inputs['Detail'].default_value=4;l.new(mapping.outputs[0],tex.inputs['Vector']);bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.7;bump.inputs['Distance'].default_value=.017;l.new(tex.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs[0],p.inputs['Normal'])
rootchar=earth_mat('Root • discontinuous char over surviving bark',(.003,.002,.001),(.067,.029,.011),26)
def branch(name,points,radii,mat,sides=14):
    verts=[];faces=[]
    for j,(pt,rad) in enumerate(zip(points,radii)):
        pt=Vector(pt);t=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(0,j-1)]);t.normalize();u=t.cross(Vector((0,1,0)))
        if u.length<.01:u=t.cross(Vector((1,0,0)))
        u.normalize();v=t.cross(u).normalized()
        for k in range(sides):
            a=2*math.pi*k/sides;rr=rad*(1+.10*math.sin(k*3.1+j*.9));q=pt+rr*(math.cos(a)*u+math.sin(a)*v);verts.append(q)
    for j in range(len(points)-1):
        for k in range(sides):q=j*sides+k;qn=j*sides+(k+1)%sides;faces.append((q,qn,qn+sides,q+sides))
    faces.append(tuple(range(sides-1,-1,-1)));faces.append(tuple((len(points)-1)*sides+k for k in range(sides)))
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();ob=bpy.data.objects.new(name,me);treecol.objects.link(ob);me.materials.append(mat)
    for f in me.polygons:f.use_smooth=True
    return ob
rootpts=[(.65,-.035,-.66),(.98,-.038,-.52),(1.33,.012,-.37),(1.64,.09,-.23),(1.96,.23,-.095),(2.23,.35,.06)]
root=branch('Root • Ø 0.20 m nominal | partially charred, continuous to tree',rootpts,[.085,.10,.10,.10,.105,.13],bark,20);root['nominal_diameter_m']=.20;root['condition']='Partially burned; surviving bark and wood remain continuous from peat to the living tree.'
# Irregular dark char covers limited arcs and lengths, leaving warm bark visible.
for i in range(34):
    t=random.uniform(.04,.65);idx=min(4,int(t*5));mix=t*5-idx;a=Vector(rootpts[idx]).lerp(Vector(rootpts[idx+1]),mix)
    a.y-=random.uniform(.066,.090);a.z+=random.uniform(-.05,.05)
    ob=uv('Root char patch %02d'%i,a,(random.uniform(.04,.10),.012,random.uniform(.025,.048)),rootchar,treecol.name,12,8)
trunkpts=[(2.23,.35,.015),(2.25,.36,.34),(2.20,.37,.78),(2.23,.39,1.25),(2.13,.43,1.80),(2.15,.40,2.30),(2.03,.39,2.83)]
trunk=branch('Small tree • surviving trunk and crown',trunkpts,[.16,.145,.121,.10,.073,.042,.012],bark,20)
for j in range(5):
    a=j*1.256+.4;start=Vector((2.23,.35,.08));end=Vector((2.23+math.cos(a)*.39,.35+math.sin(a)*.39,h(2.23+math.cos(a)*.39,.35+math.sin(a)*.39,0)))
    branch('Root flare %d'%j,[start,start.lerp(end,.55)+Vector((0,0,.04)),end],[.09,.048,.011],bark,12)
leaves=[]
for i in range(18):
    z=random.uniform(1.0,2.6);base=Vector((2.2,.39,z));a=i*2.399;le=random.uniform(.40,.85)*(1.15-(z-1)/4)
    end=base+Vector((math.cos(a)*le,math.sin(a)*le,random.uniform(.23,.50)));mid=base.lerp(end,.48)+Vector((0,0,.10))
    branch('Tree limb %02d'%i,[base,mid,end],[.030,.018,.004],bark,10)
    for j in range(3):
        t=.48+j*.19;at=base.lerp(end,t);twig=at+Vector((math.cos(a+j+.8)*.19,math.sin(a+j+.8)*.19,.18))
        branch('Tree twig %02d.%d'%(i,j),[at,twig],[.006,.0018],bark,8);leaves.append((at,twig))
leafm=[mat_basic('Tree leaf • muted green',(.055,.10,.021),.76),mat_basic('Tree leaf • olive',(.09,.12,.027),.85),mat_basic('Tree leaf • scorched edge',(.095,.061,.019),.9)]
lv=[];lf=[];lm=[]
for at,tip in leaves:
    for j in range(6):
        center=at.lerp(tip,random.uniform(.25,1.4))+Vector((random.uniform(-.11,.11),random.uniform(-.11,.11),random.uniform(-.04,.13)))
        ang=random.uniform(0,6.28);length=random.uniform(.06,.12);wid=length*.40;u=Vector((math.cos(ang),math.sin(ang),random.uniform(-.35,.35))).normalized()*length;v=Vector((-math.sin(ang),math.cos(ang),.1))*wid
        st=len(lv);lv.extend([center-u,center+v,center+u,center-v,center+Vector((0,0,.012))]);lf.extend([(st,st+1,st+4),(st+1,st+2,st+4),(st+2,st+3,st+4),(st+3,st,st+4)]);lm.extend([random.choices([0,1,2],[.5,.35,.15])[0]]*4)
me=bpy.data.meshes.new('Sparse living canopy');me.from_pydata(lv,[],lf);me.update();ob=bpy.data.objects.new('Sparse green and heat-scorched foliage',me);treecol.objects.link(ob)
for m in leafm:me.materials.append(m)
for f,i in zip(me.polygons,lm):f.material_index=i
for j,(x,y) in enumerate([(1.95,.23),(2.30,.39)]):
    for k in range(4):
        ob=uv('Root connection • subtle smolder seep %d.%d'%(j,k),(x+k*.075,y+k*.03,.08+k*.24),(.12+k*.055,.10+k*.05,.25+k*.07),smoke_near if j==0 else smoke_far,'FIRE',20,12)
flma,flmd=volume_mat('Root vent • tiny localized flame',(.2,.06,.01),2.8,7,(1,.16,.008))
fl=uv('Root vent • restrained flame',(1.95,.23,.045),(.030,.030,.064),flma,'FIRE',20,12)
key_socket(flmd,[(1,2.8),(145,2.8),(220,.75),(300,.65)])
# Revised framing retains the entire borehole and the surviving tree crown.
section.location=(3.7,-15.5,6.5);section.rotation_euler=(Vector((0,.8,-.14))-section.location).to_track_quat('-Z','Y').to_euler();section.data.ortho_scale=11.6
for name in ['Borehole depth label','Peat zone label','Section proxy legend']:bpy.data.objects[name].rotation_euler=section.rotation_euler
bpy.data.objects['Section title'].location=(-5.10,3.76,-10)
bpy.data.objects['Section subtitle'].location=(-5.10,3.44,-10)
bpy.data.objects['Section stage'].location=(-5.10,3.12,-10)
bpy.data.objects['Section disclaimer'].location=(-5.10,-3.95,-10)
bpy.data.objects['Peat zone label'].data.body='BURIED SMOLDERING PEAT';bpy.data.objects['Peat zone label'].location=(.35,-.70,-.18)
bpy.data.objects['Section proxy legend'].location=(-.26,-.23,-2.75)
note=camera_text('Root dimension note','0.20 m root  /  partially burned connection to tree',section,-5.10,-3.69,.098,muted);move(note,'SECTION_LABELS');note.visible_shadow=False
scene['User revision']='Peat almost entirely underground. Nominal 0.20 m diameter partly charred root connects buried deposit to a surviving above-ground tree.'
scene.frame_set(100);save();view_cam()
print('USER REVISION COMPLETE: buried peat, surviving root, above-ground tree')
