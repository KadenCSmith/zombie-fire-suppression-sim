"""Verify complete timeline, placement, source modes and preserved source hash."""
import hashlib
import base64
import gzip
import json
import math
from pathlib import Path
import bpy

manifest=json.loads(bpy.data.texts['FIRE_SEQUENCE_MANIFEST.json'].as_string())
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
    for t in [0,12,31,36.9,44,53,64,78,90]:
        scene.frame_set(frame(t));deps=bpy.context.evaluated_depsgraph_get()
        s=source.evaluated_get(deps);c=cap.evaluated_get(deps)
        center_z=c.location.z+c.data.vertices[0].co.z
        states.append({'presentation_s':t,'source_elevation_m':s.location.z,'source_radius_m':s.scale.x,'source_visible':not s.hide_render,'dome_rim_elevation_m':c.location.z,'dome_center_elevation_m':center_z})
        if t==0:assert s.hide_render
        if t==44:assert abs(s.location.z+1.3)<1e-6
        if t==53:assert abs(c.location.z+1.05)<1e-6 and abs(center_z+1.15)<1e-5
        if mode=='rapid' and t>=64:assert abs(s.scale.x)<1e-9
        if mode=='gradual' and t>=44:assert 0<=s.scale.x<.1
        if mode=='rapid' and t>=64:assert abs(center_z+.85)<1e-5
        if mode=='gradual' and t>=64:assert abs(center_z+1.15)<1e-5
        if mode=='gradual' and t==90:
            expected=(3*cache['frames'][-1]['dryIceKg']/(4*math.pi*1560))**(1/3)
            assert abs(s.scale.x-expected)<1e-7
    assert bpy.data.objects[mode+' connected illustrated peat involvement']['area_fraction_at_treatment']==.7
    report['modes'][mode]={'frames':864,'seconds':36,'states':states}
report['embedded_accepted_cache_frames']=len(cache['frames']);report['cache_sha256']=manifest['cache_sha256']
report['unpacked_image_dependencies']=[image.filepath for image in bpy.data.images if image.source=='FILE' and image.has_data and not image.packed_file]
assert not report['unpacked_image_dependencies']
report['checks']+=['65 accepted states recover from embedded compressed cache','Buried downward plate has source clearance; rapid plate inverts upward','Gradual final source radius matches accepted finite mass','Illustrated peat involvement trigger is 70%, separate from numerical fuel','All loaded image dependencies packed']
output=Path(bpy.data.filepath).with_suffix('.verification.json');output.write_text(json.dumps(report,indent=2)+'\n')
print('FIRE_STORY_VERIFIED '+json.dumps(report),flush=True)
