"""Native editable visual assets for the 0.16 presentation, not solver geometry."""
import math
import random
import bpy
from mathutils import Vector

def bevel(obj,width=.025,segments=3):
    modifier=obj.modifiers.new('Rounded manufactured edges','BEVEL');modifier.width=width;modifier.segments=segments
    modifier=obj.modifiers.new('Panel normals','WEIGHTED_NORMAL');modifier.keep_sharp=True
    return obj

def dense_grass(api,collection,seed=15027,count=52000):
    """Fine curved ribbons, batched spatially so rapid deformation can follow soil."""
    rng=random.Random(seed);materials=[api['mat']('Living grass '+str(i),c,rough=.86) for i,c in enumerate([(.028,.10,.014),(.052,.16,.018),(.085,.21,.025),(.14,.27,.045),(.045,.115,.025)])]
    batches={};counts={}
    for _ in range(count):
        x=rng.uniform(-3.98,3.98);y=rng.uniform(.015,3.985)
        # A small natural bare patch around the tree trunk; the bore has grass until drilling.
        if (x-1.65)**2+(y-.8)**2<.025:continue
        cell=(min(7,int(x+4)),min(3,int(y)),(x-.4)**2+y*y<api['G']['boreRadiusM']**2);vertices,faces,indices=batches.setdefault(cell,([],[],[]))
        h=rng.uniform(.055,.135)*(1+.10*math.sin(x*2.7+y*3.1));width=rng.uniform(.0015,.0035)
        angle=rng.random()*math.tau;dx=math.cos(angle);dy=math.sin(angle);lean=rng.uniform(.009,.055)
        start=len(vertices)
        for j in range(4):
            p=j/3;shift=lean*p*p;half=width*(1-p*.97)
            vertices.extend([(x+dx*shift-dy*half,y+dy*shift+dx*half,.005+h*p),(x+dx*shift+dy*half,y+dy*shift-dx*half,.005+h*p)])
        faces.extend((start+j*2,start+j*2+1,start+j*2+3,start+j*2+2)for j in range(3));indices.extend([rng.randrange(len(materials))]*3);counts[cell]=counts.get(cell,0)+1
    objects=[]
    for cell,(vertices,faces,indices) in batches.items():
        obj=api['mesh']('Fine lawn strands '+str(cell),vertices,faces,collection,materials[0])
        for material in materials[1:]:obj.data.materials.append(material)
        obj.data.polygons.foreach_set('material_index',indices);obj['blade_count']=counts[cell];obj['over_bore']=cell[2];obj['scientific_role']='Decorative grass; no solver biomass or mechanics';objects.append(obj)
    return objects

def compact_excavator(api,mode,collection,geometry):
    mesh,cube,cylinder,curve,mat=(api[k]for k in ('mesh','cube','cylinder','curve','mat'))
    key,visible,ease,frame=(api[k]for k in ('key','visible','ease','frame'))
    yellow=mat(mode+' equipment enamel',(.46,.24,.022),rough=.35,metal=.25)
    dark=mat(mode+' track rubber',(.012,.018,.018),rough=.89)
    frame_mat=mat(mode+' cab seals',(.019,.026,.028),rough=.54)
    steel=mat(mode+' hydraulic steel',(.28,.34,.35),rough=.24,metal=.85)
    glass=mat(mode+' cab glass',(.037,.105,.122),rough=.14,metal=.12,alpha=.57)
    seat_mat=mat(mode+' cab interior',(.045,.047,.045),rough=.9)
    rig=bpy.data.objects.new(mode+' compact tracked excavator',None);collection.objects.link(rig)
    offset=lambda t:-6*(1-ease(t,24,27))-6*ease(t,37,40)
    key(rig,'location',[(t,(-1.95+offset(t),1.42,0))for t in range(24,41)])
    parts=[]
    def part(obj):obj.parent=rig;parts.append(obj);return obj
    # Continuous rubber belts, individual pads, idlers and five road wheels per side.
    for side in (-1,1):
        y=side*.44;vertices=[];faces=[];n=48
        for radius,py in [( .255,y-.115),(.255,y+.115),(.195,y-.115),(.195,y+.115)]:
            for i in range(n):
                a=-math.pi/2+math.tau*i/n;cx=.52 if math.cos(a)>=0 else -.52
                vertices.append((cx+radius*math.cos(a),py,.29+radius*math.sin(a)))
        for i in range(n):
            j=(i+1)%n;faces.extend([(i,j,n+j,n+i),(2*n+i,3*n+i,3*n+j,2*n+j),(i,2*n+i,2*n+j,j),(n+i,n+j,3*n+j,3*n+i)])
        part(mesh(mode+' rubber track belt '+str(side),vertices,faces,collection,dark))
        for i in range(36):
            a=-math.pi/2+math.tau*i/36;cx=.52 if math.cos(a)>=0 else -.52;x=cx+.269*math.cos(a);z=.29+.269*math.sin(a)
            pad=bevel(cube(mode+' tread pad '+str(side)+' '+str(i),(x,y,z),(.060,.13,.019),collection,dark),.009,2);pad.rotation_euler.y=-a-math.pi/2;part(pad)
        for i,x in enumerate([-.52,-.26,0,.26,.52]):
            wheel=cylinder(mode+' wheel '+str(side)+' '+str(i),(x,y,.28),.185,.20,collection,steel,24);wheel.rotation_euler.x=math.pi/2;part(wheel)
            hub=cylinder(mode+' hub '+str(side)+' '+str(i),(x,y+side*.114,.28),.072,.012,collection,frame_mat,20);hub.rotation_euler.x=math.pi/2;part(hub)
    part(bevel(cube(mode+' undercarriage',(0,0,.47),(.69,.40,.085),collection,frame_mat),.04))
    part(cylinder(mode+' slew ring',(0,0,.60),.36,.11,collection,steel,48))
    part(bevel(cube(mode+' upper chassis',(.05,0,.73),(.65,.46,.13),collection,yellow),.075,4))
    part(bevel(cube(mode+' rounded counterweight',(-.45,.05,.91),(.28,.44,.21),collection,yellow),.10,5))
    part(bevel(cube(mode+' engine hood',(-.36,.04,1.08),(.28,.38,.08),collection,yellow),.055))
    for i in range(7):part(cube(mode+' engine grille '+str(i),(-.73,-.02+i*.06,.99),(.012,.016,.07),collection,frame_mat))
    part(bevel(cube(mode+' cab floor',(.30,.06,.89),(.32,.36,.065),collection,frame_mat),.025))
    # Sloped, framed glazing; visible seat and controls stop the cab reading as a solid box.
    cabin=[(.02,-.32,.94),(.63,-.32,.94),(.57,-.29,1.73),(.06,-.29,1.77),(.02,.36,.94),(.63,.36,.94),(.57,.32,1.73),(.06,.32,1.77)]
    for face in [(0,1,2,3),(4,7,6,5),(1,5,6,2),(0,3,7,4)]:part(mesh(mode+' framed cab glazing '+str(face),[cabin[i]for i in face],[(0,1,2,3)],collection,glass))
    for a,b in [(0,1),(1,2),(2,3),(3,0),(4,5),(5,6),(6,7),(7,4),(0,4),(1,5),(2,6),(3,7)]:part(curve(mode+' cab frame '+str(a)+' '+str(b),[cabin[a],cabin[b]],.024,collection,frame_mat))
    part(bevel(cube(mode+' cab roof',(.31,.02,1.80),(.34,.38,.045),collection,yellow),.05))
    part(bevel(cube(mode+' operator seat',(.20,.10,1.16),(.13,.16,.08),collection,seat_mat),.045))
    part(bevel(cube(mode+' seat back',(.07,.10,1.35),(.06,.16,.19),collection,seat_mat),.035))
    part(curve(mode+' control stalk',[(.47,-.08,1.0),(.43,-.08,1.3)],.014,collection,steel))
    part(bevel(cube(mode+' step',(.34,-.47,.76),(.17,.10,.022),collection,steel),.014))
    for i in (-1,1):part(bevel(cube(mode+' work light '+str(i),(.61,i*.23,1.72),(.035,.045,.04),collection,mat(mode+' lamp '+str(i),(.55,.62,.57),rough=.3,emission=.3)),.015))
    for obj in parts:visible(obj,24,40)
    tip=lambda t:1.55-2.95*ease(t,24,31)*(1-ease(t,34,36.5))
    pivot=lambda t:(-1.33+offset(t),1.26,.91)
    elbow=lambda t:(-.82+offset(t),.70,2.18+.13*tip(t))
    head=lambda t:(.4+offset(t),0,tip(t)+1.78)
    def beam(name,a,b,radius,material,rectangular=False):
        obj=bevel(cube(mode+' '+name,(0,0,0),(radius,radius*.73,.5),collection,material),radius*.18) if rectangular else cylinder(mode+' '+name,(0,0,0),radius,1,collection,material,24)
        for t in range(24,41):
            pa,pb=Vector(a(t)),Vector(b(t));delta=pb-pa;obj.location=(pa+pb)/2;obj.rotation_euler=delta.to_track_quat('Z','Y').to_euler();obj.scale=(1,1,delta.length)
            for path in ('location','rotation_euler','scale'):obj.keyframe_insert(path,frame=frame(t))
        visible(obj,24,40);return obj
    beam('box section main boom',pivot,elbow,.105,yellow,True);beam('box section dipper',elbow,head,.085,yellow,True)
    a=lambda t:Vector(pivot(t))+Vector((-.22,-.03,.10));b=lambda t:Vector(elbow(t))+Vector((-.12,-.03,-.32))
    beam('main lift hydraulic barrel',a,lambda t:Vector(a(t)).lerp(Vector(b(t)),.66),.060,frame_mat);beam('main lift polished piston',lambda t:Vector(a(t)).lerp(Vector(b(t)),.53),b,.032,steel)
    a2=lambda t:Vector(elbow(t))+Vector((-.12,-.075,-.1));b2=lambda t:Vector(head(t))+Vector((-.16,-.075,.17))
    beam('dipper hydraulic barrel',a2,lambda t:Vector(a2(t)).lerp(Vector(b2(t)),.61),.045,frame_mat);beam('dipper polished piston',lambda t:Vector(a2(t)).lerp(Vector(b2(t)),.54),b2,.023,steel)
    for i in (-1,1):beam('hydraulic hose '+str(i),lambda t:Vector(pivot(t))+Vector((0,i*.12,.08)),lambda t:Vector(elbow(t))+Vector((0,i*.12,.06)),.011,dark)
    assembly=bpy.data.objects.new(mode+' drill assembly',None);collection.objects.link(assembly)
    key(assembly,'location',[(t,(.4+offset(t),0,tip(t)))for t in range(24,41)])
    rotor=bpy.data.objects.new(mode+' rotating auger',None);collection.objects.link(rotor);rotor.parent=assembly
    key(rotor,'rotation_euler',[(24,(0,0,0)),(27,(0,0,0)),(34,(0,0,math.tau*17)),(36,(0,0,math.tau*17))])
    shaft=cylinder(mode+' auger shaft',(0,0,.84),.045,1.68,collection,steel);shaft.parent=rotor;visible(shaft,24,40)
    vertices=[];faces=[];turns=5.8;n=320;outer=geometry['augerRadiusM']
    for i in range(n+1):
        p=i/n;a=math.tau*turns*p;z=.09+1.52*p
        vertices.extend([(.049*math.cos(a),.049*math.sin(a),z),(outer*math.cos(a),outer*math.sin(a),z)])
    for i in range(n):faces.append((2*i,2*i+1,2*i+3,2*i+2))
    flight=mesh(mode+' helical steel auger flight',vertices,faces,collection,steel);flight.parent=rotor;solid=flight.modifiers.new('Auger flight thickness','SOLIDIFY');solid.thickness=.012;visible(flight,24,40)
    tip_obj=api['uv'](mode+' tapered auger tip',(0,0,.045),(.08,.08,.105),collection,steel,16,10);tip_obj.parent=rotor;visible(tip_obj,24,40)
    motor=bevel(cube(mode+' stationary drill motor',(0,0,1.76),(.14,.13,.14),collection,frame_mat),.032);motor.parent=assembly;visible(motor,24,40)
    collar=cylinder(mode+' drive coupling',(0,0,1.57),.073,.13,collection,yellow);collar.parent=assembly;visible(collar,24,40)
    # Fold-out underream cutter opens the displayed pocket before the shell arrives.
    # Its motion is shared with the live presentation, not an excavation solver.
    for side in (-1,1):
        arm=cube(mode+' folding underream arm '+str(side),(0,0,.45),(.1,.045,.025),collection,steel);arm.parent=assembly;visible(arm,31,34)
        tooth=cube(mode+' underream cutting shoe '+str(side),(0,0,.45),(.035,.06,.11),collection,frame_mat);tooth.parent=assembly;visible(tooth,31,34)
        for pose in api['CONTRACT']['poseFrames']:
            t=pose['timeS']
            if 31<=t<=34:
                extension=pose[mode]['cutterExtension'];length=.07+extension*(geometry['cavityRadiusM']-.07)
                arm.location=(side*length/2,0,.45);arm.scale=(length/.2,1,1);tooth.location=(side*length,0,.45)
                for ob in (arm,tooth):ob.keyframe_insert('location',frame=frame(t))
                arm.keyframe_insert('scale',frame=frame(t))
    rig['scientific_role']='Articulated authored equipment; not a solved excavation or vehicle dynamics model'
    return rig

def smooth_peat_outline(field,iterations=8):
    """Relax only the displayed mask perimeter; arrival values stay untouched."""
    from collections import defaultdict
    nx,ny=field['nx'],field['ny'];edges=defaultdict(int)
    for j in range(ny):
        for i in range(nx):
            if not field['mask'][j*nx+i]:continue
            q=[(i,j),(i+1,j),(i+1,j+1),(i,j+1)]
            for a,b in zip(q,q[1:]+q[:1]):edges[tuple(sorted((a,b)))]+=1
    neighbors=defaultdict(set)
    for (a,b),count in edges.items():
        if count==1:neighbors[a].add(b);neighbors[b].add(a)
    positions={p:(field['minX']+p[0]*field['width']/nx,field['minY']+p[1]*field['height']/ny)for p in neighbors}
    for _ in range(iterations):
        positions={p:tuple(.5*position[k]+.5*sum(positions[q][k]for q in neighbors[p])/len(neighbors[p])for k in range(2))for p,position in positions.items()}
    return positions
