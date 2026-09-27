"""Render a short labeled review clip from the saved natural checkpoint scene.

This does not overwrite the .blend or interpolate the accepted checkpoints.
blender -b integrations/blender-study/Unified_Accepted_Physics.blend \
  --python-exit-code 1 --python integrations/blender-study/render_checkpoint_clip.py
"""
import json
from pathlib import Path
import bpy

source=Path(bpy.data.filepath)
scene=bpy.data.scenes['NATURAL • accepted geometry'];bpy.context.window.scene=scene
manifest=json.loads(bpy.data.texts['PHYSICS_IMPORT_MANIFEST.json'].as_string())
scene.render.fps=2;scene.render.resolution_x=960;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.cycles.samples=12
scene.render.image_settings.file_format='FFMPEG';scene.render.ffmpeg.format='MPEG4';scene.render.ffmpeg.codec='H264';scene.render.ffmpeg.constant_rate_factor='MEDIUM'
output=source.with_name('accepted-checkpoint-review.mp4');scene.render.filepath=str(output)
bpy.ops.render.render(animation=True)
report={'asset':output.name,'format':'H.264 MP4','fps':2,'seconds':(scene.frame_end-scene.frame_start+1)/2,'accepted_times_s':manifest['times_s'],'scope':'Labeled held accepted checkpoints in the natural presentation scene. Each checkpoint is held for 0.5 playback seconds; this is a review clip, not continuous physical-time integration. Decorative aggregates do not affect physics.'}
output.with_suffix('.manifest.json').write_text(json.dumps(report,indent=2)+'\n')
print('CHECKPOINT_CLIP '+json.dumps(report),flush=True)
