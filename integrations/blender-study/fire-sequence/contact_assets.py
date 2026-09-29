"""Editable 0.16 placement/woven hose assets; transport and deformation are authored.

Contact-energy samples are read from the shared TypeScript export. They are a
separate reduced hot-patch calculation, never a mutation of the accepted cache.
"""
import math
import random
import bpy
from mathutils import Vector


def xyz(p):
    """Shared Three.js x/up/depth -> Blender x/away/up (cutaway fronts have opposite signs)."""
    return (p[0],-p[2],p[1])


def smooth_points(points,subdivisions=8):
    """Endpoint-clamped Catmull-Rom centerline authored from the shared controls."""
    p=[Vector(v) for v in points];result=[]
    for i in range(len(p)-1):
        a,b,c,d=p[max(0,i-1)],p[i],p[i+1],p[min(len(p)-1,i+2)]
        for j in range(subdivisions):
            t=j/subdivisions
            result.append(tuple(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)))
    return result+[tuple(p[-1])]


def transported_frames(path):
    """Parallel-transport the cloth section through vertical bends without flips."""
    frames=[];previous=None
    for i,p in enumerate(path):
        tangent=Vector(path[min(i+1,len(path)-1)])-Vector(path[max(0,i-1)])
        if tangent.length<1e-10:tangent=Vector((0,0,-1))
        tangent.normalize()
        normal=previous-tangent*previous.dot(tangent) if previous is not None else tangent.cross(Vector((0,0,1)))
        if normal.length<.001:normal=tangent.cross(Vector((0,1,0)))
        normal.normalize();binormal=tangent.cross(normal).normalized();frames.append((normal,binormal));previous=normal
    return frames


def fabric_material(api,mode):
    material=api['mat'](mode+' original procedural ivory woven jacket',(.51,.48,.39),rough=.96)
    nodes=material.node_tree.nodes;links=material.node_tree.links;shader=nodes.get('Principled BSDF')
    tex=nodes.new('ShaderNodeTexCoord');mapping=nodes.new('ShaderNodeVectorMath');mapping.operation='SCALE';mapping.inputs[3].default_value=1
    links.new(tex.outputs['UV'],mapping.inputs[0])
    waves=[]
    for direction in ('X','Y'):
        wave=nodes.new('ShaderNodeTexWave');wave.wave_type='BANDS';wave.bands_direction=direction;wave.inputs['Scale'].default_value=1800 if direction=='X' else 90;wave.inputs['Distortion'].default_value=.5;wave.inputs['Detail'].default_value=2
        links.new(mapping.outputs['Vector'],wave.inputs['Vector']);waves.append(wave)
    weave=nodes.new('ShaderNodeMath');weave.operation='MULTIPLY';links.new(waves[0].outputs['Color'],weave.inputs[0]);links.new(waves[1].outputs['Color'],weave.inputs[1])
    bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.48;bump.inputs['Distance'].default_value=.0017;links.new(weave.outputs[0],bump.inputs['Height']);links.new(bump.outputs[0],shader.inputs['Normal'])
    ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(.23,.22,.175,1);ramp.color_ramp.elements[1].color=(.59,.56,.45,1);links.new(weave.outputs[0],ramp.inputs[0]);links.new(ramp.outputs[0],shader.inputs['Base Color'])
    return material


def hose_mesh(api,mode,collection,contract):
    """Surface coils and a lowered tail share an editable continuous cloth mesh."""
    points=contract['hosePoints'];controls=[xyz(p) for p in points];path=[xyz(p)for p in contract['hoseCurve']['placed']]
    radius=contract['geometry']['hoseRadiusM'];sides=16;vertices=[];faces=[];frames=transported_frames(path)
    for i,p in enumerate(path):
        normal,binormal=frames[i]
        # Surface hose is oval and slightly wrinkled; the hanging tail is rounder.
        above=p[2]>-.02;flatten=.52 if above else .84
        for j in range(sides):
            angle=math.tau*j/sides;wrinkle=1+.045*math.sin(i*.84+j*1.7)
            delta=normal*(radius*math.cos(angle)*wrinkle)+binormal*(radius*flatten*math.sin(angle)*wrinkle)
            vertices.append(tuple(Vector(p)+delta))
        if i:
            for j in range(sides):faces.append(((i-1)*sides+j,(i-1)*sides+(j+1)%sides,i*sides+(j+1)%sides,i*sides+j))
    hose=api['mesh'](mode+' flexible woven fire hose',vertices,faces,collection,fabric_material(api,mode))
    uv=hose.data.uv_layers.new(name='Continuous weave')
    for poly in hose.data.polygons:
        poly.use_smooth=True
        for loop in poly.loop_indices:
            index=hose.data.loops[loop].vertex_index;row,col=divmod(index,sides);uv.data[loop].uv=(row/(len(path)-1),col/sides)
    hose.shape_key_add(name='Placed centerline')
    insertion=contract['hoseCurve']['insertionFrames']
    # Story samples are 0.1 s apart, but playback compresses this stage so
    # several samples round to one film frame. Keying every sample overwrites
    # its preceding zero on collision and makes later relative shape keys
    # ramp up prematurely, inflating the hose. Keep one canonical pose for
    # each actual film frame and crossfade only across adjacent frames.
    frame_samples={api['frame'](sample['timeS']):sample for sample in insertion}
    selected=sorted(frame_samples.items())
    assert len(selected)>=2 and selected[0][0]<selected[-1][0]
    for peak,sample in selected[:-1]:
        carried=[xyz(p)for p in sample['points']];carried_frames=transported_frames(carried);shape=hose.shape_key_add(name='Shared hose lowering '+str(sample['timeS']))
        for i,(p,q) in enumerate(zip(path,carried)):
            normal,binormal=carried_frames[i];flatten=.52 if q[2]>-.02 else .84
            for j in range(sides):
                angle=math.tau*j/sides;wrinkle=1+.045*math.sin(i*.84+j*1.7)
                shape.data[i*sides+j].co=Vector(q)+normal*(radius*math.cos(angle)*wrinkle)+binormal*(radius*flatten*math.sin(angle)*wrinkle)
        for keyframe,value in [(1,0),(peak-1,0),(peak,1),(peak+1,0),(864,0)]:
            shape.value=value;shape.keyframe_insert('value',frame=keyframe)
    for curve in hose.data.shape_keys.animation_data.action.fcurves:
        for point in curve.keyframe_points:point.interpolation='LINEAR'
    api['visible'](hose,69);hose['scientific_role']='Original procedural fabric on exact shared centripetal samples and lowering; no pressure-driven hose mechanics'
    seam_mat=api['mat'](mode+' dark stitched hose edge',(.12,.14,.11),rough=1)
    # Sewn longitudinal jacket stripes, visibly distinct from a rigid rubber tube.
    for side in (-1,1):
        seam=[]
        for p,(normal,binormal) in zip(path,frames):seam.append(tuple(Vector(p)+normal*(radius*.82*side)+binormal*(radius*.38)))
        obj=api['curve'](mode+' woven jacket stitched stripe '+str(side),seam,.0018,collection,seam_mat);api['visible'](obj,72)
    coupling=api['cylinder'](mode+' hose inlet metal coupling',controls[0],radius*1.3,.095,collection,api['mat'](mode+' coupling galvanized steel',(.28,.32,.30),rough=.36,metal=.8))
    direction=Vector(controls[1])-Vector(controls[0]);coupling.rotation_euler=direction.to_track_quat('Z','Y').to_euler();api['visible'](coupling,69)
    return hose


def segmented_dome(api,mode,collection,contract):
    g=api['G'];radius=g['capRadiusM'];rise=g['capRiseM'];folded=g['capFoldedRadiusM'];expanded=g['capRadiusM']+.065;segments=64;rings=12
    vertices=[];faces=[];petal_indices=[]
    # A narrow service passage lies on the front of the section. Eight petals
    # overlap at their joints; the two visible front sections expose the profile.
    for j in range(rings+1):
        r=j/rings
        for i in range(segments+1):
            a=math.tau*i/segments;vertices.append((radius*r*math.sin(a),-radius*r*math.cos(a),-rise*(1-r*r)))
    for j in range(rings):
        for i in range(segments):
            a=(i+.5)*math.tau/segments
            # 24-degree longitudinal service notch around negative depth axis.
            if abs(a-g['capGapCenterRad'])<g['capGapHalfAngleRad']:continue
            faces.append((j*(segments+1)+i,j*(segments+1)+i+1,(j+1)*(segments+1)+i+1,(j+1)*(segments+1)+i))
    cap=api['mesh'](mode+' metal dome • schematic bend',vertices,faces,collection,api['metal'])
    for poly in cap.data.polygons:poly.use_smooth=True
    solid=cap.modifiers.new('Visible sheet thickness','SOLIDIFY');solid.thickness=.013
    cap.shape_key_add(name='Deployed downward shell')
    fold=cap.shape_key_add(name='Folded articulated petals')
    for vertex in fold.data:
        r=min(1,math.hypot(vertex.co.x,vertex.co.y)/radius);vertex.co.x*=folded/radius;vertex.co.y*=folded/radius;vertex.co.z=.38*(1-r)
    bend=cap.shape_key_add(name='Illustrated deflection, not a failure calculation')
    for vertex in bend.data:
        r=min(1,math.hypot(vertex.co.x,vertex.co.y)/radius);vertex.co.x*=expanded/radius;vertex.co.y*=expanded/radius;vertex.co.z=-rise*(1-r*r)+g['capInversionM']*(1-r*r)**2
    for pose in contract['poseFrames']:
        t=pose['timeS'];state=pose[mode+'Cap']
        if t in (0,90) or 47<=t<=56:
            fold.value=1-state['deployment'];fold.keyframe_insert('value',frame=api['frame'](t));bend.value=state['damage'];bend.keyframe_insert('value',frame=api['frame'](t))
            cap.location=(.4,0,state['rimY']);cap.keyframe_insert('location',frame=api['frame'](t))
    api['visible'](cap,47)
    cap['scientific_role']='Segmented folded shell inserted through bore, deployed into visibly cut underreamed pocket, rapid-only prescribed inversion and shoulder wedging'
    # Separate copper-toned ribs expose changing concavity and petal construction.
    ribmat=api['mat'](mode+' dome stiffening ribs',(.23,.16,.07),rough=.50,metal=.8)
    for index in range(8):
        a=(index+.25)*math.tau/8;points=[(radius*r*math.sin(a),-radius*r*math.cos(a),-rise*(1-r*r)-.005) for r in [i/12 for i in range(13)]]
        rib=api['curve'](mode+' segmented plate radial seam '+str(index),points,.0038,collection,ribmat);rib.parent=cap;api['visible'](rib,47)
        for j,p in enumerate(rib.data.splines[0].points):
            r=j/12
            for pose in contract['poseFrames']:
                t=pose['timeS'];state=pose[mode+'Cap']
                if not(t in (0,90) or 47<=t<=56):continue
                deploy=state['deployment'];rr=state['radiusM'];z=.38*(1-r)*(1-deploy)-rise*(1-r*r)*deploy+state['inversionM']*(1-r*r)**2
                p.co=(rr*r*math.sin(a),-rr*r*math.cos(a),z-.005,1);p.keyframe_insert('co',frame=api['frame'](t))
    # Rim shoes visibly bear into the freshly cut shoulder after the rapid event.
    for side in (-1,1):
        shoe=api['cube'](mode+' dome soil-engagement shoe '+str(side),(0,0,0),(.035,.10,.030),collection,api['metal']);shoe.parent=cap;api['visible'](shoe,51)
        api['key'](shoe,'location',[(t,(side*(folded+(radius-folded)*api['ease'](t,51.5,54)+(g['capWedgeRadiusM']-radius)*(api['ease'](t,55,55.65) if mode=='rapid' else 0)),.025,0)) for t in [51,52,53,54,55,55.15,55.3,55.65,90]])
    return cap


def contact_shading(api,mode,material,contact):
    """Make contact patches reduce visible charcoal incandescence, without editing cache."""
    states=contact['modes'][mode];first=states[0];nodes=material.node_tree.nodes;links=material.node_tree.links;shader=nodes.get('Principled BSDF')
    emission=shader.inputs['Emission Strength'].links[0].from_socket
    geometry=nodes.new('ShaderNodeNewGeometry');cool_total=nodes.new('ShaderNodeValue');cool_total.outputs[0].default_value=0;accum=cool_total.outputs[0]
    for i,patch in enumerate(first['patches']):
        center=nodes.new('ShaderNodeCombineXYZ');center.inputs['X'].default_value=patch['xM'];center.inputs['Y'].default_value=-.052;center.inputs['Z'].default_value=patch['yM']
        distance=nodes.new('ShaderNodeVectorMath');distance.operation='DISTANCE';links.new(geometry.outputs['Position'],distance.inputs[0]);links.new(center.outputs[0],distance.inputs[1])
        scale=nodes.new('ShaderNodeMath');scale.operation='DIVIDE';links.new(distance.outputs['Value'],scale.inputs[0]);scale.inputs[1].default_value=patch['radiusM']
        falloff=nodes.new('ShaderNodeMapRange');falloff.interpolation_type='SMOOTHSTEP';falloff.clamp=True;links.new(scale.outputs[0],falloff.inputs['Value']);falloff.inputs['From Min'].default_value=.30;falloff.inputs['From Max'].default_value=1.13;falloff.inputs['To Min'].default_value=1;falloff.inputs['To Max'].default_value=0
        cooling=nodes.new('ShaderNodeValue');cooling.label='Reduced contact cooling '+patch['id']
        for state in states:
            temperature=state['patches'][i]['temperatureK'];cooling.outputs[0].default_value=1-max(0,min(1,(temperature-550)/max(1,state['initialTemperatureK']-550)))**1.7;cooling.outputs[0].keyframe_insert('default_value',frame=api['frame'](state['storyTimeS']))
        multiply=nodes.new('ShaderNodeMath');multiply.operation='MULTIPLY';links.new(falloff.outputs[0],multiply.inputs[0]);links.new(cooling.outputs[0],multiply.inputs[1])
        maximum=nodes.new('ShaderNodeMath');maximum.operation='MAXIMUM';links.new(accum,maximum.inputs[0]);links.new(multiply.outputs[0],maximum.inputs[1]);accum=maximum.outputs[0]
    remain=nodes.new('ShaderNodeMath');remain.operation='SUBTRACT';remain.inputs[0].default_value=1;links.new(accum,remain.inputs[1])
    final=nodes.new('ShaderNodeMath');final.operation='MULTIPLY';links.new(emission,final.inputs[0]);links.new(remain.outputs[0],final.inputs[1]);links.new(final.outputs[0],shader.inputs['Emission Strength'])


def hose_and_wetting(api,mode,collection,contract,contact):
    hose_mesh(api,mode,collection,contract)
    paths=contract['crackPaths'];watermat=api['mat'](mode+' restrained liquid at contact',(.095,.19,.20),rough=.18,alpha=.62)
    # Rapid fracture initiation is precisely synchronized with the pressure pulse.
    for i,shared in enumerate(paths):
        points=[(p[0],-.078,p[1]) for p in shared]
        # A fissure is a thin dark surface opening, never a round pipe laid over soil.
        verts=[];opened=[];faces=[]
        for j,(a,b) in enumerate(zip(points,points[1:])):
            delta=Vector((b[0]-a[0],0,b[2]-a[2]));normal=Vector((-delta.z,0,delta.x)).normalized();width=.006*(1-.4*j/max(1,len(points)-2));start=len(verts)
            for point,side in [(a,-1),(a,1),(b,1),(b,-1)]:
                center=Vector((point[0],-.058,point[2]));verts.append(tuple(center));opened.append(center+normal*width*side)
            faces.append((start,start+1,start+2,start+3))
        crack=api['mesh'](mode+' assumed opening '+str(i),verts,faces,collection,api['crack_mat']);crack.shape_key_add(name='Closed surface');opening=crack.shape_key_add(name='Opening width')
        for vertex,position in zip(opening.data,opened):vertex.co=position
        for t in [0,54.8,55,55.1,55.2,55.3,55.45,55.65,90]:
            opening.value=api['ease'](t,55,55.65) if mode=='rapid' else 0;opening.keyframe_insert('value',frame=api['frame'](t))
        api['visible'](crack,55)
        if mode=='gradual':crack.hide_render=True;crack.animation_data_clear()
        crack['scientific_role']='Authored narrow matte surface fissure width; onset synchronized with rapid release; principal rupture is the actual separated soil geometry'
        water=api['curve'](mode+' slow contact water film '+str(i),[(x,y-.008,z)for x,y,z in points],.006,collection,watermat)
        api['visible'](water,72+i*.6)
        for pose in contract['poseFrames']:
            if pose['timeS']<72:continue
            water.data.bevel_factor_end=pose['wetting'][i];water.data.keyframe_insert('bevel_factor_end',frame=api['frame'](pose['timeS']))
    inlet=[xyz(contract['hosePoints'][-1]),(.50,-.055,-1.30),(.4,-.080,-1.30)]
    pour=api['curve'](mode+' hose outlet seepage',inlet,.012,collection,watermat);api['visible'](pour,72)
    states=contact['modes'][mode];rng=random.Random(160912)
    for i,p in enumerate(states[0]['patches']):
        stainmat=api['mat'](mode+' damp peat contact '+p['id'],(.009,.014,.012),rough=.68,alpha=.6,noise=33)
        count=30;verts=[(0,0,0)];faces=[]
        for j in range(count):
            a=math.tau*j/count;r=1+rng.uniform(-.17,.17);verts.append((r*math.cos(a),0,r*.68*math.sin(a)))
        for j in range(count):faces.append((0,j+1,(j+1)%count+1))
        stain=api['mesh'](mode+' progressive wet stain '+p['id'],verts,faces,collection,stainmat);stain.location=(p['xM'],-.083,p['yM'])
        stain.data.attributes.new('wet_edge',type='FLOAT',domain='POINT').data.foreach_set('value',[1]+[0]*count)
        nodes=stainmat.node_tree.nodes;links=stainmat.node_tree.links;attribute=nodes.new('ShaderNodeAttribute');attribute.attribute_name='wet_edge';mult=nodes.new('ShaderNodeMath');mult.operation='MULTIPLY';mult.inputs[1].default_value=.82;links.new(attribute.outputs['Fac'],mult.inputs[0]);links.new(mult.outputs[0],nodes.get('Principled BSDF').inputs['Alpha'])
        for state in states:
            patch=state['patches'][i];wet=patch['wetness'];radius=p['radiusM']*math.sqrt(max(0,wet));stain.scale=(radius,1,radius);stain.keyframe_insert('scale',frame=api['frame'](state['storyTimeS']))
        api['visible'](stain,72);stain['scientific_role']='Assumed localized water arrival and footprint; temperature from separate conserved contact calculation'
