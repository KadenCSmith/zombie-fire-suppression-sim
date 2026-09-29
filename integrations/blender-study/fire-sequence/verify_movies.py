"""Read MP4 container metadata directly; verify complete delivered video streams.

No ffprobe installation is required. This checks the encoded sample count and
duration, not just the requested Blender render settings.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct

def atoms(data,start=0,end=None):
    end=len(data) if end is None else end
    while start+8<=end:
        size,kind=struct.unpack_from('>I4s',data,start);header=8
        if size==1:size=struct.unpack_from('>Q',data,start+8)[0];header=16
        if size==0:size=end-start
        if size<header or start+size>end:raise ValueError('Invalid MP4 atom length')
        yield kind,start+header,start+size
        start+=size

def child(data,container,kind):
    return next(box for box in atoms(data,container[1],container[2]) if box[0]==kind)

def duration(data,box):
    p=box[1];version=data[p]
    if version==0:scale,ticks=struct.unpack_from('>II',data,p+12)
    elif version==1:scale=struct.unpack_from('>I',data,p+20)[0];ticks=struct.unpack_from('>Q',data,p+24)[0]
    else:raise ValueError('Unsupported duration version')
    return ticks/scale

def inspect(path):
    data=path.read_bytes();moov=next(box for box in atoms(data) if box[0]==b'moov')
    movie_duration=duration(data,child(data,moov,b'mvhd'))
    for track in [box for box in atoms(data,moov[1],moov[2]) if box[0]==b'trak']:
        media=child(data,track,b'mdia');handler=child(data,media,b'hdlr')
        if data[handler[1]+8:handler[1]+12]!=b'vide':continue
        tkhd=child(data,track,b'tkhd');width,height=struct.unpack_from('>II',data,tkhd[2]-8)
        table=child(data,child(data,media,b'minf'),b'stbl');sizes=child(data,table,b'stsz')
        count=struct.unpack_from('>I',data,sizes[1]+8)[0]
        descriptions=child(data,table,b'stsd');codec=data[descriptions[1]+12:descriptions[1]+16].decode('ascii')
        video_duration=duration(data,child(data,media,b'mdhd'))
        result={'file':path.name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'width':width//65536,'height':height//65536,'encoded_frame_count':count,'movie_duration_seconds':movie_duration,'video_duration_seconds':video_duration,'average_frames_per_second':count/video_duration,'codec':codec}
        assert result['width']==1280 and result['height']==720
        assert count==864 and abs(video_duration-36)<1e-6 and abs(movie_duration-36)<1e-6
        assert codec=='avc1' and abs(result['average_frames_per_second']-24)<1e-6
        return result
    raise ValueError('No video track')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('directory',type=Path);args=parser.parse_args()
    report={'passed':True,'checks':['Encoded MP4 metadata independently verifies 864 video samples, 36 seconds, 24fps, 1280×720 and H.264 for each film'],'movies':[inspect(args.directory/('Fire_Sequence_'+mode+'.mp4')) for mode in ('Gradual','Rapid')]}
    (args.directory/'Movies.verification.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
