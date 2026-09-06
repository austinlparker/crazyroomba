"""Verify exported frames, soundtrack, spoken cue timing, and captured gameplay claims."""
import hashlib,json,math,struct,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'exports/promo';WORK=Path('/tmp/crazy-roomba-promo-210-extreme')
def run(*args):return subprocess.run(list(map(str,args)),check=True,capture_output=True,text=True)
def atoms(path):
    found=[]
    with path.open('rb') as f:
        while True:
            header=f.read(8)
            if len(header)<8:break
            size,kind=struct.unpack('>I4s',header)
            if size==1:size=struct.unpack('>Q',f.read(8))[0];head=16
            else:head=8
            found.append(kind.decode('ascii'))
            if not size:break
            f.seek(size-head,1)
    return found
capture=json.loads((WORK/'master-capture.json').read_text())
assert capture['errors']==[]
assert [s['id'] for s in capture['shots']]==['hook','collect','deliver','stairs','crawl','drive','air','crater','launch','skins','daily','end']
assert len(capture['cuts']) >= 25
for shot in ['drive','air','stairs','collect','deliver','launch','daily']:
    samples=[s for s in capture['states'] if s['shot']==shot]
    assert len({s['camera'] for s in samples})>=2, shot
    assert max(s['fov'] for s in samples)-min(s['fov'] for s in samples)>4, shot
assert capture['duration']==30 and capture['fps']==60
assert {s['stage'] for s in capture['shots']}=={'apartment','house','culdesac','moon'}
events=capture['events'];states=capture['states']
for shot in ['air','launch']:
    assert any(e['shot']==shot and e['kind']=='hop' for e in events)
    assert any(e['shot']==shot and e['kind']=='land' and e['value']>=1 for e in events)
assert not any(e['shot']=='air' and e['kind']=='bump' for e in events)
assert any(e['shot']=='stairs' and e['kind']=='stairs' for e in events)
assert any(e['shot']=='crawl' and e['kind']=='pickup' for e in events)
assert any(e['shot']=='collect' and e['kind']=='pickup' and e['bin']==5 for e in events)
assert any(e['shot']=='deliver' and e['kind']=='deposit' and e['value']==1000 for e in events)
assert [s['id'] for s in capture['shots'] if s['camera']=='studio']==['hook','skins','end']
audio=json.loads((OUT/'audio-cues.json').read_text());spoken=sorted((c for c in audio['cues'] if c['kind']=='voice'),key=lambda c:c['at'])
for left,right in zip(spoken,spoken[1:]):assert left['at']+left['duration']<=right['at']+.005,(left,right)
for source,digest in audio['sources'].items():assert hashlib.sha256((ROOT/source).read_bytes()).hexdigest()==digest,source
results={}
for name,w,h,fps in [('crazy-roomba-vertical-promo.mp4',1080,1920,60),('crazy-roomba-vertical-share.mp4',720,1280,30)]:
    path=OUT/name
    probe=json.loads(run('ffprobe','-v','error','-show_format','-show_streams','-of','json',path).stdout)
    v=next(s for s in probe['streams'] if s['codec_type']=='video');a=next(s for s in probe['streams'] if s['codec_type']=='audio')
    assert v['codec_name']=='h264' and v['width']==w and v['height']==h and v['pix_fmt']=='yuv420p'
    assert v['r_frame_rate']==f'{fps}/1' and int(v['nb_frames'])==30*fps
    assert abs(float(probe['format']['duration'])-30)<.03
    assert a['codec_name']=='aac' and a['channels']==2 and a['sample_rate']=='48000'
    order=atoms(path);assert order.index('moov')<order.index('mdat')
    run('ffmpeg','-v','error','-xerror','-i',path,'-f','null','-')
    measured=run('ffmpeg','-hide_banner','-i',path,'-vn','-af','loudnorm=I=-14:TP=-2:LRA=8:print_format=json','-f','null','-').stderr
    loudness=json.JSONDecoder().raw_decode(measured[measured.rfind('{'):])[0]
    assert abs(float(loudness['input_i'])+14)<.6,loudness
    assert float(loudness['input_tp'])<=-1.4,loudness
    results[name]={'width':w,'height':h,'fps':fps,'frames':int(v['nb_frames']),'duration':float(probe['format']['duration']),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'integratedLufs':float(loudness['input_i']),'truePeakDbtp':float(loudness['input_tp']),'loudnessRange':float(loudness['input_lra']),'decode':'passed','fastStart':True}
    print(f"PASS {name}: {w}×{h}, {fps}fps, {v['nb_frames']} frames, {loudness['input_i']} LUFS, {loudness['input_tp']} dBTP",flush=True)
# Supply optional sidecar captions without covering the designed picture.
def stamp(sec,separator):
    ms=round(sec*1000);h,ms=divmod(ms,3600000);m,ms=divmod(ms,60000);s,ms=divmod(ms,1000)
    return f'{h:02}:{m:02}:{s:02}{separator}{ms:03}'
srt=[];vtt=['WEBVTT\n']
for i,cue in enumerate(spoken,1):
    a=cue['at'];b=a+cue['duration'];text=cue['name']
    srt.append(f"{i}\n{stamp(a,',')} --> {stamp(b,',')}\n{text}\n")
    vtt.append(f"{stamp(a,'.')} --> {stamp(b,'.')}\n{text}\n")
(OUT/'captions.srt').write_text('\n'.join(srt)+'\n');(OUT/'captions.vtt').write_text('\n'.join(vtt)+'\n')
validation={'date':'2026-09-06','ruleset':capture['ruleset'],'files':results,'cameraCuts':len(capture['cuts']),'voiceCues':len(spoken),'nonoverlappingSpeech':True,'stuntAndScoreEvidence':'shipping simulation events','pageErrors':capture['errors']}
(OUT/'validation.json').write_text(json.dumps(validation,indent=2)+'\n')
(OUT/'capture.json').write_text(json.dumps(capture,indent=2)+'\n')
print('PASS all four stages, Earth/Moon 360° landings, stairs, shortcut pickup, full-bin 1000-point delivery, speech timing, and source hashes',flush=True)
