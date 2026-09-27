"""Render a representative frame or a full 864-frame scene without editing .blend."""
import argparse
import json
from pathlib import Path
import runpy
import sys
import time
import bpy

parser=argparse.ArgumentParser();parser.add_argument('--mode',choices=['gradual','rapid'],default='gradual');parser.add_argument('--output',type=Path,required=True);parser.add_argument('--still',type=float);parser.add_argument('--samples',type=int,default=24);parser.add_argument('--start',type=int);parser.add_argument('--end',type=int)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
scene=bpy.data.scenes['GRADUAL • accepted source' if args.mode=='gradual' else 'RAPID • illustrative conversion'];bpy.context.window.scene=scene
scene.eevee.taa_render_samples=args.samples;scene.render.filepath=str(args.output.resolve());args.output.parent.mkdir(parents=True,exist_ok=True)
if args.start:scene.frame_start=args.start
if args.end:scene.frame_end=args.end
start=time.perf_counter()
if args.still is not None:
    t=args.still;playback=t/2.8 if t<=55 else 55/2.8+t-55 if t<=61 else 55/2.8+6+(t-61)/2.8
    scene.frame_set(min(864,1+round(playback*24)));scene.render.image_settings.file_format='PNG';bpy.ops.render.render(write_still=True)
else:
    scene.render.image_settings.file_format='FFMPEG';scene.render.ffmpeg.format='MPEG4';scene.render.ffmpeg.codec='H264';scene.render.ffmpeg.constant_rate_factor='HIGH';scene.render.ffmpeg.ffmpeg_preset='GOOD'
    result=bpy.ops.render.render(animation=True)
    if 'CANCELLED' in result:raise RuntimeError('Animation render cancelled; delivery is incomplete')
    if scene.frame_start==1 and scene.frame_end==864:
        verifier=runpy.run_path(str(Path(__file__).with_name('verify_movies.py')))
        verifier['inspect'](args.output)
seconds=time.perf_counter()-start
count=scene.frame_end-scene.frame_start+1
report={'asset':args.output.name,'mode':args.mode,'frames':1 if args.still is not None else count,'presentation_time_s':args.still,'width':scene.render.resolution_x,'height':scene.render.resolution_y,'samples':args.samples,'fps':24,'full_movie_seconds':count/24 if args.still is None else None,'render_wall_seconds':seconds,'renderer':scene.render.engine,'interpretation':'Staged narrative. Solver time, where shown, is separate from presentation time; no validated excavation, crack flow, cap failure or extinguishment claim.'}
args.output.with_suffix('.render.json').write_text(json.dumps(report,indent=2)+'\n');print('FIRE_STORY_RENDER '+json.dumps(report),flush=True)
