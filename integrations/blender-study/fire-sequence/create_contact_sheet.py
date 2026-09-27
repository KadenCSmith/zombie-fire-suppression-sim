"""Arrange the sixteen native Blender chapter stills into one review sheet."""
import argparse
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

parser=argparse.ArgumentParser();parser.add_argument('directory',type=Path);args=parser.parse_args()
root=args.directory
font_path='/System/Library/Fonts/Supplemental/Arial.ttf'
font=ImageFont.truetype(font_path,24);small=ImageFont.truetype(font_path,19)
chapters=[('01-Ignition',5),('02-Peat-Growth',21),('03-Excavator',30),('04-Dry-Ice',44),('05-Buried-Plate',53),('06-Pressure-Release',55.3),('07-Water-Paths',77),('08-Review',88)]
sheet=Image.new('RGB',(1328,3312),'#142124');draw=ImageDraw.Draw(sheet)
draw.text((20,18),'GRADUAL • accepted finite source',font=font,fill='#e4efed')
draw.text((680,18),'RAPID • illustrative conversion',font=font,fill='#e4efed')
draw.text((20,55),'Both full films: 36 s • 720p • 24 fps. Stage time and solver time are separate.',font=small,fill='#a5c1bc')
for row,(chapter,t) in enumerate(chapters):
    for col,mode in enumerate(('gradual','rapid')):
        x=16+col*664;y=105+row*400
        draw.text((x,y),chapter[3:].replace('-',' ')+'  /  story '+str(t)+' s',font=small,fill='#e0ebe7')
        image=Image.open(root/'chapters'/(mode+'-'+chapter+'.png')).convert('RGB').resize((640,360),Image.Resampling.LANCZOS)
        sheet.paste(image,(x,y+28))
sheet.save(root/'Fire_Sequence_Contact_Sheet.png',optimize=True)
print(root/'Fire_Sequence_Contact_Sheet.png')
