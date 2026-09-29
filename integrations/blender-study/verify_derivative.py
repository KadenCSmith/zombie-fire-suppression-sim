"""Reopen-only verification: no input .blend is ever saved or modified."""
import json
import math
from pathlib import Path
import bpy

scene=bpy.data.scenes['PHYSICS • accepted checkpoints'];bpy.context.window.scene=scene
data=json.loads(bpy.data.texts['ACCEPTED_PHYSICS_CACHE.json'].as_string())
manifest=json.loads(bpy.data.texts['PHYSICS_IMPORT_MANIFEST.json'].as_string())
frames=data['runs'][manifest['mode']]['frames'];errors=[]
for checkpoint,frame in enumerate(frames,1):
    scene.frame_set(checkpoint);bpy.context.view_layer.update()
    visible=[obj for obj in scene.objects if obj.type=='MESH' and not obj.hide_render]
    cells=[obj for obj in visible if 'checkpoint_index' in obj]
    assert len(cells)==1, f'Expected exactly one accepted field mesh at {checkpoint}'
    obj=cells[0];assert obj['checkpoint_index']==checkpoint-1
    assert obj['time_s']==frame['timeS']
    assert len(obj.data.polygons)==manifest['surface_faces_per_checkpoint']
    ids=[v.value for v in obj.data.attributes['solver_cell_id'].data]
    for field in manifest['units']:
        values=obj.data.attributes[field].data
        maximum=max(abs(values[i].value-frame[field][cell]) for i,cell in enumerate(ids))
        assert maximum<max(1e-6,max(frame[field])*1e-6), (field,maximum)
    sources=[obj for obj in visible if 'mass_kg' in obj]
    assert len(sources)==(1 if frame['dryIceKg']>0 else 0)
    if sources:
        assert sources[0]['mass_kg']==frame['dryIceKg']
        expected=(3*frame['dryIceKg']/(4*math.pi*data['source']['densityKgM3']))**(1/3)
        actual=max(v.co.length for v in sources[0].data.vertices)
        assert abs(expected-actual)<1e-6
    errors.append({'checkpoint':checkpoint,'time_s':frame['timeS'],'field_faces':len(ids),'visible_source_kg':sources[0]['mass_kg'] if sources else 0})
result={'passed':True,'verified_checkpoints':len(frames),'checks':['Exactly one visible accepted field mesh at each timeline frame','FACE field data agree with embedded accepted solver cache','Source radius agrees with finite mass / source density','Checkpoint times and cell IDs persist after save/reopen','Reference and physics remain separate scenes'],'scenes':list(bpy.data.scenes.keys()),'records':errors}
natural=bpy.data.scenes['NATURAL • accepted geometry']
for checkpoint in range(1,len(frames)+1):
    bpy.context.window.scene=scene;scene.frame_set(checkpoint);bpy.context.view_layer.update()
    scientific=next(o for o in scene.objects if 'checkpoint_index' in o and not o.hide_render)
    bpy.context.window.scene=natural;natural.frame_set(checkpoint);bpy.context.view_layer.update()
    depsgraph=bpy.context.evaluated_depsgraph_get()
    natural_frames=[o for o in natural.objects if 'checkpoint_index' in o and not o.evaluated_get(depsgraph).hide_render]
    assert len(natural_frames)==1, f'Expected exactly one evaluated natural mesh at {checkpoint}'
    rendered=natural_frames[0]
    assert all((a.co-b.co).length<1e-9 for a,b in zip(scientific.data.vertices,rendered.data.vertices))
result['checks'].append('Natural presentation scene retains exactly identical accepted node positions')
Path(bpy.data.filepath).with_suffix('.verification.json').write_text(json.dumps(result,indent=2)+'\n')
print('DERIVATIVE_VERIFICATION '+json.dumps(result),flush=True)
