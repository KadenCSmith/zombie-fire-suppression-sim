"""Render both complete films and chapter stills from the newly generated blend."""
import argparse
from pathlib import Path
import runpy
import sys
import bpy

parser=argparse.ArgumentParser();parser.add_argument('--output-directory',type=Path,required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);root=args.output_directory.resolve();root.mkdir(parents=True,exist_ok=True)
scripts=Path(__file__).resolve().parent
runpy.run_path(str(scripts/'verify_fire_sequence.py'),run_name='__main__')
chapters=[('01-Ignition',5),('02-Peat-Growth',21),('03-Excavator',30),('04-Dry-Ice',44),('05-Buried-Plate',53),('06-Gas-Inversion',58),('07-Water-Paths',77),('08-Review',88)]
for mode in ('gradual','rapid'):
    output=root/('Fire_Sequence_'+mode.title()+'.mp4')
    sys.argv=['render_fire_sequence.py','--','--mode',mode,'--output',str(output)]
    runpy.run_path(str(scripts/'render_fire_sequence.py'),run_name='__main__')
    for chapter,t in chapters:
        sys.argv=['render_fire_sequence.py','--','--mode',mode,'--output',str(root/'chapters'/(mode+'-'+chapter+'.png')),'--still',str(t)]
        runpy.run_path(str(scripts/'render_fire_sequence.py'),run_name='__main__')
print('COMPLETE_FIRE_DELIVERY '+str(root),flush=True)
