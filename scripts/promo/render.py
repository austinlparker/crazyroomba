"""Render the current game plus the original promo studio; mix cached speech/music/SFX.

uv run --no-project --with playwright --with pillow --with numpy python scripts/promo/render.py
Use --contact for shot review, --draft for 540p, --reuse-video to remix without recapturing.
"""
from __future__ import annotations
import argparse, base64, hashlib, json, math, subprocess, time, wave
from io import BytesIO
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
WORK=Path('/tmp/crazy-roomba-promo-210-extreme'); OUT=ROOT/'exports/promo'
WORK.mkdir(parents=True,exist_ok=True); OUT.mkdir(parents=True,exist_ok=True)
parser=argparse.ArgumentParser()
parser.add_argument('--draft',action='store_true');parser.add_argument('--contact',action='store_true')
parser.add_argument('--reuse-video',action='store_true');parser.add_argument('--origin',default='http://127.0.0.1:5174')
args=parser.parse_args()
width,height,fps=(540,960,30) if args.draft or args.contact else (1080,1920,60)
label='contact' if args.contact else 'draft' if args.draft else 'master'
video=WORK/(label+'-silent.mp4');capture_file=WORK/(label+'-capture.json')

def run(*cmd):
    return subprocess.run(list(map(str,cmd)),check=True,capture_output=True,text=True)

def contact_sheet(frames,path):
    tw,th=216,384;cols=5;rows=math.ceil(len(frames)/cols)
    sheet=Image.new('RGB',(cols*tw,rows*(th+42)), '#0c1719');draw=ImageDraw.Draw(sheet)
    font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf',15)
    for i,(stamp,name,img) in enumerate(frames):
        x,y=(i%cols)*tw,(i//cols)*(th+42)
        sheet.paste(img.resize((tw,th),Image.Resampling.LANCZOS),(x,y))
        draw.text((x+8,y+th+9),f'{stamp:05.2f}s / {name}',font=font,fill='#ffe52b')
    sheet.save(path,quality=94)

if not args.reuse_video:
    errors=[];frames=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--use-angle=metal','--autoplay-policy=no-user-gesture-required'])
        context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,reduced_motion='no-preference')
        # Capture owns a fixed clock. Ignore development HMR notifications.
        context.route_web_socket('**/*',lambda ws:None)
        page=context.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(f'{args.origin}/scripts/promo/?fps={fps}',wait_until='domcontentloaded')
        page.wait_for_function('window.promo?.ready',timeout=60000)
        info=page.evaluate('({duration:promo.DURATION,shots:promo.SHOTS,ruleset:promo.RULESET})')
        print(json.dumps({'capture':f'{width}x{height}@{fps}',**info}),flush=True)
        samples=[]
        for shot in info['shots']:
            samples += [(shot['start']+min(.65,shot['duration']*.25),shot['id']), (shot['start']+shot['duration']*.72,shot['id'])]
        samples += [(info['duration']-.4,'end')]
        coverage=page.evaluate('promo.COVERAGE')
        for shot in info['shots']:
            for cut in coverage.get(shot['id'], [])[1:]:samples.append((shot['start']+cut['at']+.12,shot['id']))
        samples=sorted(set(samples))
        sample_frames={round(t*fps):(t,name) for t,name in sorted(samples)}
        if args.contact:
            for i,(stamp,name) in sample_frames.items():
                data=base64.b64decode(page.evaluate('(i)=>promo.frame(i)',i));image=Image.open(BytesIO(data)).copy()
                frames.append((stamp,name,image));image.save(WORK/f'contact-{name}-{i}.jpg',quality=94)
                print(f'Contact {stamp:.2f}s / {name}',flush=True)
            contact_sheet(frames,OUT/'storyboard-draft.jpg')
        else:
            command=['ffmpeg','-hide_banner','-loglevel','warning','-y','-f','image2pipe','-vcodec','mjpeg','-framerate',str(fps),'-i','pipe:0','-an','-vf','scale=out_color_matrix=bt709:out_range=tv,format=yuv420p','-c:v','libx264','-preset','fast','-crf','18','-profile:v','high','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-movflags','+faststart',str(video)]
            with open(WORK/'encode.log','w') as log:
                encoder=subprocess.Popen(command,stdin=subprocess.PIPE,stderr=log);started=time.time()
                try:
                    for i in range(round(info['duration']*fps)):
                        data=base64.b64decode(page.evaluate('(i)=>promo.frame(i)',i));encoder.stdin.write(data)
                        if i in sample_frames:
                            stamp,name=sample_frames[i];image=Image.open(BytesIO(data)).copy();frames.append((stamp,name,image))
                            if name=='end' and stamp>info['duration']-.6:image.save(OUT/('poster-draft.jpg' if args.draft else 'poster.jpg'),quality=96)
                        if i%(fps*2)==0:print(f'Rendered {i/fps:.0f}/{info["duration"]:.0f}s · elapsed {time.time()-started:.1f}s',flush=True)
                finally:
                    encoder.stdin.close()
                if encoder.wait()!=0:raise RuntimeError((WORK/'encode.log').read_text())
            contact_sheet(frames,OUT/('storyboard-draft.jpg' if args.draft else 'storyboard.jpg'))
        info.update(width=width,height=height,fps=fps,errors=errors,events=page.evaluate('promo.events'),states=page.evaluate('promo.states'),cuts=page.evaluate('promo.cuts'))
        capture_file.write_text(json.dumps(info,indent=2));browser.close()
    if errors:raise RuntimeError('\n'.join(errors))
    if args.contact:raise SystemExit(0)
else:
    info=json.loads(capture_file.read_text());assert video.exists()

# Build distinct stems, keeping narration intelligible and leaving SFX transient headroom.
sr=48000;duration=info['duration'];count=round(duration*sr)
voice=np.zeros((count,2));fx=np.zeros_like(voice)
voiced=[];cues=[];sources={}
def decode(path,filters=None):
    path=Path(path);sources[str(path.relative_to(ROOT))]=hashlib.sha256(path.read_bytes()).hexdigest()
    data=subprocess.run(['ffmpeg','-v','error','-i',str(path)]+(['-af',filters] if filters else [])+['-f','f32le','-ar',str(sr),'-ac','2','pipe:1'],check=True,capture_output=True).stdout
    return np.frombuffer(data,dtype='<f4').reshape(-1,2).copy()
def add(stem,sound,at,gain=1,kind='effect',name=''):
    start=round(at*sr);n=min(len(sound),len(stem)-start)
    if start<0 or n<=0:return
    stem[start:start+n]+=sound[:n]*gain
    cues.append({'at':at,'duration':n/sr,'kind':kind,'name':name,'gain':gain})
    if kind=='voice':voiced.append((at,at+n/sr))
voice_config=json.loads((ROOT/'scripts/promo/voice.json').read_text())
voice_root=OUT/'source'/voice_config.get('cache','voice')
voice_lines=json.loads((voice_root/'cues.json').read_text())['lines']
for line in voice_lines:
    sound=decode(voice_root/line['file'],'highpass=f=280,lowpass=f=2300' if line['id']=='setup' else None)
    # Parallel soft saturation and short word echoes evoke a hot 1990s promo mic.
    if line['id']!='setup':sound=.8*sound+.2*np.tanh(sound*4)/2
    add(voice,sound,line['at'],1.0,'voice',line['text'])
    if line['id'] in ['radical','moon','attitude','challenge','brand']:
        keyword={'radical':'radical','moon':'moon','attitude':'attitude','challenge':'boss','brand':'roomba'}[line['id']]
        word=next(w for w in line['words'] if keyword in w['text'].lower())
        begin=max(0,round((word['at']-line['at'])*sr));finish=min(len(sound),round((word['until']-line['at']+.05)*sr))
        echo=sound[begin:finish].copy()
        echo*=np.array([.7,1.0])
        add(fx,echo,word['at']+.085,.15,'voice effect','announcer slapback')
# One connected announcer owns the story; game effects supply the action punctuation.
cache={};last={}
for event in info['events']:
    name=event['kind'];at=event['at'];path=ROOT/'public/audio'/f'{name}.mp3'
    if not path.exists() or at-last.get(name,-100)<({'pickup':.09,'bump':.32,'turbo':.6}.get(name,.12)):continue
    last[name]=at
    if name not in cache:cache[name]=decode(path)
    add(fx,cache[name],at,1.4 if name in ['hop','land','turbo','deposit'] else 1.0,'game effect',name)
# Handmade edit impacts and stereo sweeps, isolated from narration.
rng=np.random.default_rng(21036)
for cut in info['cuts']:
    at=cut['at'];n=round(.22*sr);t=np.arange(n)/sr
    noise=rng.standard_normal(n);low=np.convolve(noise,np.ones(15)/15,mode='same')
    wavelet=(noise-low)*np.sin(np.pi*t/.22)**2*.04
    sweep=np.stack([wavelet*(1-t/.22),wavelet*(t/.22)],axis=1)
    add(fx,sweep,max(0,at-.075),1,'edit','stereo whoosh')
    n=round(.34*sr);t=np.arange(n)/sr;phase=2*np.pi*(64*t-32*t*t/.34)
    hit=np.sin(phase)*np.exp(-t*15)*.16*np.minimum(t/.004,1)
    add(fx,np.repeat(hit[:,None],2,axis=1),at,1,'edit','low impact')
# Follow the actual delivery after the faster editorial playback.
deposit=next(e['at'] for e in info['events'] if e['kind']=='deposit')
add(fx,decode(ROOT/'public/audio/big-score.mp3')[:round(1.1*sr)],deposit,.22,'sting','big-score')
# Curbside Riot supplies faster skate-punk guitars; keep its final 30 seconds.
music_offset=90-duration
music_source=ROOT/'public/music/curbside-riot.mp3'
raw_music=decode(music_source)
music=raw_music[round(music_offset*sr):round(90*sr)].copy()
assert len(music)>=count-100
music=np.pad(music,((0,max(0,count-len(music))),(0,0)))[:count]
# The dry household instruction starts like a small TV speaker, then snaps wide.
lofi=decode(music_source,'highpass=f=220,lowpass=f=1800')[round(music_offset*sr):round(90*sr)]
mono=np.mean(lofi,axis=1)
change=round(3.24*sr)
music[:change]=np.repeat(mono[:change,None],2,axis=1)*.55
# Tape braking and two brief vinyl scrubs use our own instrumental source.
brake_start=round(2.98*sr);brake_len=change-brake_start
r=np.arange(brake_len)/sr
travel=(r-r*r/(2*(brake_len/sr)))*sr
source_index=brake_start+travel
for channel in range(2):music[brake_start:change,channel]=np.interp(source_index,np.arange(len(music)),music[:,channel])
music[brake_start:change]*=np.linspace(1,0,brake_len)[:,None]
for at,length in [(3.03,.23),(15.42,.22),(25.77,.16)]:
    n=round(length*sr);t=np.arange(n)/sr
    position=(music_offset+.7)*sr+np.sin(t/length*np.pi*3.2)*sr*.07
    scratch=np.stack([np.interp(position,np.arange(len(raw_music)),raw_music[:,c]) for c in range(2)],axis=1)
    scratch=np.tanh(scratch*5)*.35
    scratch*=np.sin(np.pi*np.arange(n)/n)[:,None]**.6
    add(fx,scratch,at,.6,'edit','instrumental vinyl scratch')
# A bright, short sub hit marks the jump from chores to full-band attitude.
n=round(.25*sr);t=np.arange(n)/sr
slam=np.sin(2*np.pi*(88*t-55*t*t))*np.exp(-18*t)*.22
add(fx,np.repeat(slam[:,None],2,axis=1),3.24,1,'edit','attitude slam')
duck=np.ones(count)
for a,b in voiced:
    start=max(0,round((a-.07)*sr));on=max(start,round(a*sr));off=min(count,round(b*sr));end=min(count,round((b+.28)*sr))
    duck[start:on]=np.minimum(duck[start:on],np.linspace(1,.34,on-start))
    duck[on:off]=np.minimum(duck[on:off],.34)
    duck[off:end]=np.minimum(duck[off:end],np.linspace(.34,1,end-off))
music*=duck[:,None]
music[:2400]*=np.linspace(0,1,2400)[:,None]
# Preserve the CTA while the mix resolves naturally over the final fraction of a second.
fade=round(.18*sr);music[-fade:]*=np.linspace(1,0,fade)[:,None]

def save_wav(path,sound):
    with wave.open(str(path),'wb') as w:
        w.setnchannels(2);w.setsampwidth(3);w.setframerate(sr)
        values=(np.clip(sound,-.999999,.999999)*8388607).astype('<i4').reshape(-1)
        packed=values.view(np.uint8).reshape(-1,4)[:,:3].tobytes();w.writeframes(packed)
for name,stem in [('voice',voice),('effects',fx),('music',music)]:save_wav(WORK/f'{name}-stem.wav',stem)
mix=music+voice+fx;peak=float(np.max(np.abs(mix)));mix*=min(1,.95/peak)
mixfile=WORK/'mix.wav';save_wav(mixfile,mix)
measurement=run('ffmpeg','-hide_banner','-i',mixfile,'-af','loudnorm=I=-14:TP=-2:LRA=8:print_format=json','-f','null','-')
levels=json.JSONDecoder().raw_decode(measurement.stderr[measurement.stderr.rfind('{'):])[0]
filters=f"loudnorm=I=-14:TP=-2:LRA=8:measured_I={levels['input_i']}:measured_TP={levels['input_tp']}:measured_LRA={levels['input_lra']}:measured_thresh={levels['input_thresh']}:offset={levels['target_offset']}:linear=true,aresample=48000"
final=OUT/('draft.mp4' if args.draft else 'crazy-roomba-vertical-promo.mp4')
run('ffmpeg','-hide_banner','-loglevel','warning','-y','-i',video,'-i',mixfile,'-af',filters,'-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','256k','-t',duration,'-movflags','+faststart','-metadata','title=Crazy Roomba — All Guts. No Dust.','-metadata',f'comment=Current Crazy Roomba {info["ruleset"]} gameplay with original promo set. Music: Curbside Riot. Voice: Charlie. Generated with ElevenLabs.',final)
print(f'Finished {final}: {final.stat().st_size/1024/1024:.1f} MiB',flush=True)
(OUT/'audio-cues.json').write_text(json.dumps({'duration':duration,'music':'Curbside Riot','sourceOffset':music_offset,'cues':cues,'sources':sources},indent=2))
if not args.draft:
    share=OUT/'crazy-roomba-vertical-share.mp4'
    run('ffmpeg','-hide_banner','-loglevel','error','-y','-i',final,'-vf','scale=720:1280:flags=lanczos,fps=30','-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',share)
    print(f'Share copy {share}: {share.stat().st_size/1024/1024:.1f} MiB',flush=True)
