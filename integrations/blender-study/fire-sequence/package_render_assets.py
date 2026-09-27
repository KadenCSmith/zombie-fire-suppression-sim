"""Copy verified complete films into the app and record exact delivery hashes."""
import argparse
import hashlib
import json
from pathlib import Path
import runpy
import shutil

HERE=Path(__file__).resolve().parent
REPO=HERE.parents[2]
parser=argparse.ArgumentParser();parser.add_argument('directory',type=Path);args=parser.parse_args()
root=args.directory.resolve();destination=REPO/'public/renders'
verifier=runpy.run_path(str(HERE/'verify_movies.py'))
movies=[]
for mode in ('gradual','rapid'):
    source=root/('Fire_Sequence_'+mode.title()+'.mp4');metadata=verifier['inspect'](source)
    movies.append({'mode':mode,'sourceFilename':source.name,'url':'/renders/peat-fire-'+mode+'.mp4','durationSeconds':metadata['video_duration_seconds'],'fps':metadata['average_frames_per_second'],'width':metadata['width'],'height':metadata['height'],'encodedFrames':metadata['encoded_frame_count'],'sha256':metadata['sha256'],'bytes':metadata['bytes']})
scene=json.loads((root/'Fire_Sequence_Gradual_and_Rapid.manifest.json').read_text())
checked=json.loads((root/'Fire_Sequence_Gradual_and_Rapid.verification.json').read_text());assert checked['passed']
blend=root/'Fire_Sequence_Gradual_and_Rapid.blend'
manifest={'schemaVersion':1,'kind':'zombie-fire-sequence-render-assets','movies':movies,'posterUrl':'/renders/Fire_Sequence_Poster.png','contactSheetUrl':'/renders/Fire_Sequence_Contact_Sheet.png','cacheSha256':scene['cache_sha256'],'originalStudySha256':scene['source_blend_sha256'],'editableScene':{'filename':blend.name,'sha256':hashlib.sha256(blend.read_bytes()).hexdigest(),'bytes':blend.stat().st_size,'texturesPacked':not checked['unpacked_image_dependencies']},'presentationClock':scene['presentation_clock'],'buriedPlate':scene['buried_plate'],'illustratedPeatInvolvement':scene['illustrated_peat_involvement'],'scope':scene['scientific_scope'],'acceptedFieldScope':scene['field_inset'],'undergroundCaption':'Illustrated underground spread; the numerical front remains unresolved.','sourceFilesSha256':{str(p.relative_to(REPO)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(HERE.glob('*')) if p.is_file()}}
assert hashlib.sha256((REPO/'public/fire-sequence-cache.json').read_bytes()).hexdigest()==manifest['cacheSha256']
manifest['ready']=True
manifest['films']={movie['mode']:{'file':Path(movie['url']).name,'sha256':movie['sha256'],'durationS':movie['durationSeconds'],'durationSeconds':movie['durationSeconds'],'frames':movie['encodedFrames']} for movie in movies}
destination.mkdir(parents=True,exist_ok=True)
for movie in movies:shutil.copy2(root/movie['sourceFilename'],destination/Path(movie['url']).name)
shutil.copy2(root/'chapters/gradual-03-Excavator.png',destination/'Fire_Sequence_Poster.png')
shutil.copy2(root/'Fire_Sequence_Contact_Sheet.png',destination/'Fire_Sequence_Contact_Sheet.png')
text=json.dumps(manifest,indent=2)+'\n';(destination/'manifest.json').write_text(text);(root/'Render-Assets.manifest.json').write_text(text)
print(json.dumps({'publicDirectory':str(destination),'movies':movies,'editableScene':manifest['editableScene']},indent=2))
