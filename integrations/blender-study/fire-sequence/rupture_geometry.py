"""Prescribed irregular soil separation for the rapid presentation only.

The shared displacement envelope is not a fracture constitutive model, an
explosion calculation, or evidence that carbon dioxide chemically detonates.
"""
import math
import random
import bpy
from mathutils.kdtree import KDTree

def clip(polygon,nx,nz,limit):
    result=[]
    for a,b in zip(polygon,polygon[1:]+polygon[:1]):
        da=a[0]*nx+a[1]*nz-limit;db=b[0]*nx+b[1]*nz-limit
        if da<=1e-10:result.append(a)
        if (da<0)!=(db<0):
            f=da/(da-db);result.append((a[0]+f*(b[0]-a[0]),a[1]+f*(b[1]-a[1])))
    return result

def cells(seed=150315):
    rng=random.Random(seed);points=[(-4+(i+.22+.56*rng.random())*8/12,-3.2+(j+.22+.56*rng.random())*3.2/7)for j in range(7)for i in range(12)]
    result=[]
    for x,z in points:
        polygon=[(-4,-3.2),(4,-3.2),(4,0),(-4,0)]
        for xx,zz in points:
            if (x,z)==(xx,zz):continue
            polygon=clip(polygon,xx-x,zz-z,(xx*xx+zz*zz-x*x-z*z)/2)
            if not polygon:break
        result.append({'center':(x,z),'polygon':polygon})
    return result

CELLS=cells()
TREE=KDTree(len(CELLS))
for index,cell in enumerate(CELLS):TREE.insert((*cell['center'],0),index)
TREE.balance()
def cell_for(x,z):return TREE.find((x,z,0))[1]
def strength(x,y,z):return math.exp(-((x-.4)**2/5.8+y*y/5))*max(0,min(1,(z+3.2)/3.2))**.65
def offset(position,cell_index,permanent=False):
    x,y,z=position;s=strength(x,y,z)
    if isinstance(cell_index,tuple):cell_index,band=cell_index
    else:band=max(0,min(5,int(y/(4/6))))
    cx,cz=CELLS[cell_index]['center'];cy=(band+.5)*4/6
    if not permanent:
        separation=.13*s;tilt=.10*math.sin(cell_index*2.399)*s
        return ((x-.4)*.065*s-(x-cx)*separation+(z-cz)*tilt,.07*s-(y-cy)*separation,.60*s-(z-cz)*separation-(x-cx)*tilt)
    separation=.08*s
    return ((x-.4)*.018*s-(x-cx)*separation,.025*s-(y-cy)*separation,.11*s-(z-cz)*separation)

def animate_shape(api,obj,assignments=None):
    """Keep separate pieces separate while applying a common authored envelope."""
    frame=api['frame'];obj.shape_key_add(name='Undisturbed');pulse=obj.shape_key_add(name='Prescribed pressure-release pulse');pulse.slider_max=1.5;damage=obj.shape_key_add(name='Persistent separated gaps')
    for i,vertex in enumerate(obj.data.vertices):
        position=tuple(vertex.co);cell_index=assignments[i] if assignments is not None else cell_for(position[0],position[2]);dp=offset(position,cell_index);dd=offset(position,cell_index,True)
        pulse.data[i].co=tuple(position[k]+dp[k]for k in range(3));damage.data[i].co=tuple(position[k]+dd[k]for k in range(3))
    samples=[0,54.9]+[55+i*.05 for i in range(81)]+[60,61,64,69,90]
    for t in samples:
        a=max(0,t-55);pulse.value=(1-math.exp(-12*a))*math.exp(-1.35*a)*1.45 if t>=55 else 0
        damage.value=api['ease'](t,55,55.65)
        pulse.keyframe_insert('value',frame=frame(t));damage.keyframe_insert('value',frame=frame(t))
    obj['scientific_role']='Prescribed rapid pressure-release displacement and permanent gaps; not calculated fracture'

def soil_prisms(api,mode,collection,cutter):
    vertices=[];faces=[];assigned=[];cut_parts=[]
    for cell_index,cell in enumerate(CELLS):
        polygon=cell['polygon'];n=len(polygon)
        for band in range(6):
            near=band*4/6;far=(band+1)*4/6
            local_vertices=[(x,y,z)for y in (near,far)for x,z in polygon]
            local_faces=[tuple(reversed(range(n))),tuple(n+i for i in range(n))]
            for i in range(n):j=(i+1)%n;local_faces.append((i,j,n+j,n+i))
            if band==0 and min(p[0]for p in polygon)<.64 and max(p[0]for p in polygon)>.16 and max(p[1]for p in polygon)>-1.39:
                cut_parts.append((cell_index,local_vertices,local_faces));continue
            start=len(vertices);vertices.extend(local_vertices);assigned.extend([(cell_index,band)]*n*2);faces.extend(tuple(start+i for i in f)for f in local_faces)
    material=api['mat']('Soil strata attached to irregular prisms '+mode,(.25,.17,.08),noise=16)
    nodes=material.node_tree.nodes;links=material.node_tree.links;shader=nodes.get('Principled BSDF');attribute=nodes.new('ShaderNodeAttribute');attribute.attribute_name='rest_depth'
    ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.interpolation='CONSTANT'
    colors=[(0,(.025,.042,.012,1)),(.18/3.2,(.145,.088,.033,1)),(.65/3.2,(.26,.17,.083,1)),(2.2/3.2,(.43,.37,.24,1))]
    ramp.color_ramp.elements.remove(ramp.color_ramp.elements[1])
    for index,(p,color)in enumerate(colors):
        element=ramp.color_ramp.elements[0]if index==0 else ramp.color_ramp.elements.new(p);element.position=p;element.color=color
    texture=next(node for node in nodes if node.bl_idname=='ShaderNodeTexNoise')
    mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=.48
    links.new(attribute.outputs['Fac'],ramp.inputs['Fac']);links.new(ramp.outputs['Color'],mix.inputs[1]);links.new(texture.outputs['Fac'],mix.inputs[2]);links.new(mix.outputs[0],shader.inputs['Base Color'])
    obj=api['mesh'](mode+' irregular layered soil prisms',vertices,[tuple(reversed(face))for face in faces],collection,material)
    obj.data.attributes.new('rest_depth',type='FLOAT',domain='POINT').data.foreach_set('value',[-p[2]/3.2 for p in vertices])
    if mode=='rapid':animate_shape(api,obj,assigned)
    for cell_index,verts,polys in cut_parts:
        part=api['mesh'](mode+' bore-adjacent prism '+str(cell_index),verts,[tuple(reversed(f))for f in polys],collection,material)
        part.data.attributes.new('rest_depth',type='FLOAT',domain='POINT').data.foreach_set('value',[-p[2]/3.2 for p in verts])
        if mode=='rapid':animate_shape(api,part,[(cell_index,0)]*len(verts))
        boolean=part.modifiers.new('Cylindrical excavation only','BOOLEAN');boolean.operation='DIFFERENCE';boolean.object=cutter;boolean.solver='EXACT'
    obj['prism_count']=len(CELLS)*6;return obj

def move_detail(api,obj,center):
    base=tuple(obj.location);index=cell_for(center[0],center[2]);dp=offset(center,index);dd=offset(center,index,True)
    for t in [0,54.9]+[55+i*.06 for i in range(71)]+[61,69,90]:
        a=max(0,t-55);pulse=(1-math.exp(-12*a))*math.exp(-1.35*a)*1.45 if t>=55 else 0;damage=api['ease'](t,55,55.65)
        obj.location=tuple(base[k]+dp[k]*pulse+dd[k]*damage for k in range(3));obj.keyframe_insert('location',frame=api['frame'](t))

def debris(api,collection):
    rng=random.Random(55015);earth=api['mat']('Airborne soil fragments',(.09,.05,.019),rough=1,noise=18)
    dust=api['mat']('Brief dust visibility',(.15,.12,.077),rough=1,alpha=.075)
    for i in range(30):
        x=.4+rng.uniform(-.70,.70);y=rng.uniform(.04,.8);r=rng.uniform(.016,.050)
        piece=api['uv']('Rapid ejected soil fragment '+str(i),(x,y,.035),(r*1.2,r*.8,r),collection,earth,8,4)
        velocity=(rng.uniform(-1.1,1.1),rng.uniform(-.15,.65),rng.uniform(2.8,4.0));start=55+rng.uniform(.04,.17)
        samples=[]
        for j in range(31):
            t=j*.06;samples.append((start+t,(x+velocity[0]*t,y+velocity[1]*t,max(.11,.30+velocity[2]*t-4.905*t*t))))
        api['key'](piece,'location',samples);api['key'](piece,'rotation_euler',[(start,(0,0,0)),(start+1.8,(rng.random()*8,rng.random()*8,rng.random()*8))]);api['visible'](piece,start,start+1.8)
    for i in range(14):
        x=.4+rng.uniform(-.8,.8);y=rng.uniform(.03,.8);puff=api['uv']('Rapid dust puff '+str(i),(x,y,.15),(1,1,1),collection,dust,14,9)
        api['key'](puff,'location',[(55,(x,y,.04)),(55.7,(x+(x-.4)*.2,y+.1,.40+rng.random()*.3)),(57.2,(x+(x-.4)*.3,y+.25,.75))])
        api['key'](puff,'scale',[(54.99,(0,0,0)),(55.15,(.08,.06,.07)),(55.7,(.30,.24,.23)),(57.2,(0,0,0))]);api['visible'](puff,55,57.2)
