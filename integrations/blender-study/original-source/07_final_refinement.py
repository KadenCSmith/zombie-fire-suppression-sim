random.seed(894)
scene.frame_set(66)
# Bring the tree and the connecting root to the geological cut plane, so the
# complete continuous connection is visible without a second artificial trench.
for ob in list(treecol.objects):
    if not ob.name.startswith(('Root •','Root char patch')):ob.location.y-=.35
oldroot=next(ob for ob in treecol.objects if ob.name.startswith('Root •'))
oldname=oldroot.name
newpts=[(.65,-.015,-.66),(.98,-.015,-.52),(1.33,-.015,-.37),(1.64,-.015,-.23),(1.96,-.012,-.095),(2.23,0,.06)]
newroot=branch('Root replacement',newpts,[.085,.10,.10,.10,.105,.13],bark,24)
oldroot.data=newroot.data;bpy.data.objects.remove(newroot,do_unlink=True)
for ob in treecol.objects:
    if ob.name.startswith('Root char patch'):ob.location.y=-.100
for nm in ['Root flare 3','Root flare 4']:
    if nm in bpy.data.objects:bpy.data.objects[nm].hide_render=True;bpy.data.objects[nm].hide_viewport=True
# Visible charred lower trunk scar; intact bark remains on most of the trunk.
for i in range(20):
    z=random.uniform(.03,.40);a=random.uniform(2.9,4.4);rad=.15
    x=2.24+math.cos(a)*rad;y=math.sin(a)*rad
    ob=uv('Lower trunk • patchy char %02d'%i,(x,y,z),(.035,.013,.060),rootchar,treecol.name,12,8)
# Fine, irregular bark grooves, narrow twigs, and rounded, curved foliage.
for i in range(48):
    a=random.random()*6.28;z0=random.uniform(.12,1.9);le=random.uniform(.18,.62)
    pts=[]
    for j in range(6):
        z=z0+le*j/5;rad=.16*(1-z/3.15);ang=a+math.sin(j*.7+i)*.04
        pts.append((2.23+math.cos(ang)*rad,math.sin(ang)*rad,z))
    curve('Natural bark groove %02d'%i,pts,random.uniform(.0013,.0028),rootchar,treecol.name)
oldleaf=bpy.data.objects['Sparse green and heat-scorched foliage'];oldleaf.hide_render=True;oldleaf.hide_viewport=True
for ma in leafm:
    p=ma.node_tree.nodes.get('Principled BSDF');p.inputs['Subsurface Weight'].default_value=.025
    n=ma.node_tree.nodes;l=ma.node_tree.links;tc=n.new('ShaderNodeTexCoord');noiseleaf=n.new('ShaderNodeTexNoise');noiseleaf.inputs['Scale'].default_value=11;noiseleaf.inputs['Detail'].default_value=2;l.new(tc.outputs['Generated'],noiseleaf.inputs['Vector']);b=n.new('ShaderNodeBump');b.inputs['Distance'].default_value=.0005;b.inputs['Strength'].default_value=.25;l.new(noiseleaf.outputs['Fac'],b.inputs['Height']);l.new(b.outputs[0],p.inputs['Normal'])
lv=[];lf=[];lm=[]
for at,tip in leaves:
    at=at-Vector((0,.35,0));tip=tip-Vector((0,.35,0))
    for j in range(17):
        center=at.lerp(tip,random.uniform(.3,1.5))+Vector((random.uniform(-.13,.13),random.uniform(-.13,.13),random.uniform(-.07,.17)))
        angle=random.uniform(0,6.28);length=random.uniform(.055,.11);width=length*random.uniform(.34,.52)
        u=Vector((math.cos(angle),math.sin(angle),random.uniform(-.85,.75))).normalized();v=u.cross(Vector((0,0,1))).normalized();normal=u.cross(v).normalized()
        st=len(lv)
        for k in range(7):
            t=k/6;half=math.sin(math.pi*t)**.8*width;spine=center+u*(t-.5)*2*length+normal*(math.sin(t*math.pi)*.016+(t*t)*.008)
            lv.extend([spine-v*half,spine+normal*.006,spine+v*half])
        idx=random.choices([0,1,2],[.55,.32,.13])[0]
        for k in range(6):
            a=st+k*3;b=a+3;lf.extend([(a,a+1,b+1,b),(a+1,a+2,b+2,b+1)]);lm.extend([idx,idx])
me=bpy.data.meshes.new('Curved ovate foliage');me.from_pydata(lv,[],lf);me.update();ob=bpy.data.objects.new('Living crown • varied curved leaves',me);treecol.objects.link(ob)
for m in leafm:me.materials.append(m)
for p,i in zip(me.polygons,lm):p.material_index=i;p.use_smooth=True
# Wisp locations follow the moved root and remain restrained above the soil.
for ob in cols['FIRE'].objects:
    if ob.name.startswith(('Root connection','Root vent')):ob.location.y-=.30
key_socket(smoke_far.node_tree.nodes['Density control'].inputs[1],[(1,2.4),(300,2.4)])
key_socket(smoke_d,[(1,2.5),(150,2.5),(240,1.7),(300,1.7)])
# Replace world-space text with camera-aligned, unobstructed typography.
bpy.data.objects['Section proxy legend'].hide_render=True;bpy.data.objects['Section proxy legend'].hide_viewport=True
bpy.data.objects['Peat label leader'].hide_render=True;bpy.data.objects['Peat label leader'].hide_viewport=True
pl=bpy.data.objects['Peat zone label'];pl.location=(.45,-.80,-.94);pl.data.size=.085
rootnote=bpy.data.objects['Root dimension note'];rootnote.data.body='Ø 0.20 m root • partially charred, continuous to tree  /  White in soil = conceptual CO2'
# A short attached diameter bracket identifies the root in the section.
rd=world_text('Root diameter label','Ø 0.20 m',(1.13,-.48,-.12),.09);rd.visible_shadow=False
curve('Root diameter leader',[(1.51,-.46,-.13),(1.64,-.13,-.23)],.0028,muted,'SECTION_LABELS').visible_shadow=False
for ob in list(cols['ANNOTATIONS'].objects):move(ob,'SECTION_LABELS')
# Crop pressure-front to slightly inside the cut block boundary, with a softer
# widened band. The front is explicitly labeled as a schematic pressure pulse.
for nd in pm.node_tree.nodes:
    if nd.type=='MATH' and nd.operation=='GREATER_THAN':nd.inputs[1].default_value=-3.04
for v in pulse.data.vertices:
    r=math.hypot(v.co.x,v.co.z)
    if r<.99:v.co*=.975/.974
pulse.location.y=-.010
pn=camera_text('Pulse explanation','Pressure front = schematic section of an expanding shell',section,-5.10,2.82,.090,muted);move(pn,'SECTION_LABELS');pn.visible_shadow=False
pn.hide_render=True;pn.keyframe_insert('hide_render',frame=1);pn.keyframe_insert('hide_render',frame=74);pn.hide_render=False;pn.keyframe_insert('hide_render',frame=75);pn.keyframe_insert('hide_render',frame=110);pn.hide_render=True;pn.keyframe_insert('hide_render',frame=111)
# Clear top-view location labels preserve the revised buried-peat story.
tn=camera_text('Top buried peat location','Buried peat below tree / root vent',top,1.60,-1.0,.11,labelmat);move(tn,'TOP_LABELS');tn.visible_shadow=False
# Ground fog is restrained enough that subsurface transport stays legible.
key_socket(surfd,[(1,2.5),(180,2.5),(240,1.7),(300,1.1)])
scene.frame_set(100);save();view_cam()
print('FINAL REFINEMENT COMPLETE: visible root continuity, richer tree, corrected overlays')
