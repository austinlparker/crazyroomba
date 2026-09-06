"""Exercise real Web Audio in a Vite development build (local fixtures only).

Run: uv run --with playwright python tests/game-audio.browser.py --url http://127.0.0.1:5173/
Requires Playwright Chromium. It does not sign in or submit scores.
"""

import argparse, json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--url", default="http://127.0.0.1:5173/")
parser.add_argument("--screenshots", type=Path, default=Path("/tmp/roomba-expanded-qa"))
args = parser.parse_args()
out = args.screenshots
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        is_mobile=True,
        has_touch=True,
        device_scale_factor=1,
    )
    page = context.new_page()
    errors = []
    requests = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("request", lambda r: requests.append(r.url))
    page.route("**/api/session", lambda r: r.fulfill(json={"profile": None}))
    page.add_init_script("""
 window.audioEvents=[]; const arrays=new WeakMap(), buffers=new WeakMap();
 const fetchOriginal=window.fetch;
 window.fetch=async function(...args){const response=await fetchOriginal.apply(this,args);const read=response.arrayBuffer.bind(response);response.arrayBuffer=async()=>{const data=await read();arrays.set(data,response.url);return data};return response};
 const decode=AudioContext.prototype.decodeAudioData;
 AudioContext.prototype.decodeAudioData=async function(data,...rest){const buffer=await decode.call(this,data,...rest);buffers.set(buffer,arrays.get(data));return buffer};
 const start=AudioBufferSourceNode.prototype.start, stop=AudioBufferSourceNode.prototype.stop;
 AudioBufferSourceNode.prototype.start=function(...args){const record={url:buffers.get(this.buffer),at:this.context.currentTime,duration:this.buffer?.duration,ended:false,stopped:false};this._record=record;this.addEventListener('ended',()=>record.ended=true);window.audioEvents.push(record);return start.apply(this,args)};
 AudioBufferSourceNode.prototype.stop=function(...args){if(this._record)this._record.stopped=true;return stop.apply(this,args)};
 """)
    page.goto(args.url, wait_until="networkidle")
    page.wait_for_function("window.roomba")
    assert not any(
        "/voice/" in u or "/audio/" in u for u in requests
    ), requests
    page.evaluate("roomba.music.index=0")
    page.get_by_role("button", name="Free roam", exact=True).click()
    page.get_by_role("button", name="PLAY", exact=True).click()
    page.wait_for_function("roomba.state==='playing'", timeout=20000)
    expect(page.locator("#countdown")).to_be_hidden(timeout=6000)
    assert page.evaluate("roomba.hudView.sounds.voice.buffers.size") == 21
    assert page.evaluate("roomba.hudView.sounds.samples.buffers.size") == 11
    voice = [
        e
        for e in page.evaluate("audioEvents")
        if e.get("url") and "/voice/" in e["url"]
    ]
    assert len(voice) == 5, voice
    for a, b in zip(voice, voice[1:]):
        assert a["at"] + a["duration"] <= b["at"] + 0.03, voice
    assert page.evaluate(
        "roomba.music.track.file==='dust-fm-overdrive.mp3' && roomba.music.player.currentTime > 0"
    )
    assert any(
        "/audio/shift-start.mp3" in e.get("url", "")
        for e in page.evaluate("audioEvents")
    )
    assert len([u for u in requests if "/voice/" in u]) == 21
    assert len([u for u in requests if "/audio/" in u]) == 11
    page.screenshot(path=str(out / "playing-390.png"))
    print(
        "PASS no initial voice/effect downloads; 21 voices + 11 samples decoded; Overdrive streams; countdown and start sting play",
        flush=True,
    )
    page.get_by_role("button", name="Pause game", exact=True).click()
    assert page.evaluate(
        """(()=>{const a=roomba.hudView.sounds;return !a.voice.source&&!a.samples.sting&&a.samples.effects.size===0&&roomba.audio.sources.size===0&&!roomba.music.active})()"""
    )
    page.get_by_role("button", name="RESUME", exact=False).click()
    page.evaluate("roomba.state='paused';roomba.hudView.sounds.reset()")
    page.wait_for_function(
        "roomba.audio.context.currentTime > roomba.hudView.sounds.voice.nextComment",
        timeout=10000,
    )
    page.evaluate(
        """window.testState={...roomba.sim,ticks:1000,remaining:3600,bin:[1,1,1,1,1],boosting:false,score:0};roomba.hudView.sounds.update(testState)"""
    )
    assert page.evaluate("audioEvents.at(-1).url.includes('/voice/full-bin.mp3')")
    count = page.evaluate("audioEvents.length")
    page.evaluate("roomba.hudView.sounds.update(testState)")
    assert page.evaluate("audioEvents.length") == count
    page.evaluate("testState.remaining=599;roomba.hudView.sounds.update(testState)")
    assert page.evaluate("audioEvents.at(-1).url.includes('/voice/low-time.mp3')")
    assert page.evaluate("audioEvents.at(-2).stopped")
    page.evaluate(
        "testState.remaining=1000;roomba.hudView.sounds.update(testState);testState.remaining=599;roomba.hudView.sounds.update(testState)"
    )
    assert (
        page.evaluate(
            "audioEvents.filter(e=>e.url?.includes('/voice/low-time.mp3')).length"
        )
        == 1
    )
    page.evaluate(
        """for(const kind of ['pickup','deposit','bump','boost','hop','land','near-miss'])roomba.hudView.sounds.samples.effect(kind);roomba.hudView.sounds.samples.effect('turbo')"""
    )
    assert page.evaluate("roomba.hudView.sounds.samples.effects.size") <= 4
    page.evaluate("roomba.hudView.sounds.stop()")
    assert page.evaluate(
        """roomba.hudView.sounds.samples.effects.size===0&&audioEvents.every(e=>e.ended||e.stopped)"""
    )
    print(
        "PASS full-bin transition, one low-time warning, priority interruption, bounded effects and complete pause cleanup",
        flush=True,
    )
    page.wait_for_function(
        "roomba.audio.context.currentTime > roomba.hudView.sounds.voice.nextComment",
        timeout=10000,
    )
    page.evaluate(
        """testState.bin=[];testState.remaining=3600;testState.ticks+=1000;roomba.hudView.event({kind:'land',x:0,y:0,z:0,value:1},testState)"""
    )
    assert page.evaluate("audioEvents.some(e=>e.url?.includes('/voice/stunt-a.mp3'))")
    assert page.evaluate(
        "roomba.music.ducking.has('voice')&&roomba.music.ducking.has('sting')"
    )
    page.wait_for_function("!roomba.music.ducking.has('voice')", timeout=5000)
    assert page.evaluate("roomba.music.ducking.has('sting')")
    page.evaluate(
        "roomba.storage.settings.music=false;roomba.music.configure(false,0.35);roomba.hudView.syncAudio()"
    )
    assert page.evaluate("roomba.hudView.sounds.samples.sting===null")
    page.evaluate('roomba.hudView.sounds.samples.effect("pickup")')
    assert page.evaluate("roomba.hudView.sounds.samples.effects.size") == 1
    page.evaluate(
        "roomba.storage.settings.sound=false;roomba.audio.enabled=false;roomba.hudView.syncAudio()"
    )
    assert page.evaluate("roomba.hudView.sounds.samples.effects.size") == 0
    page.evaluate(
        'roomba.storage.settings.music=true;roomba.storage.settings.musicVolume=0.6;roomba.hudView.sounds.samples.playSting("shift-end")'
    )
    volume = page.evaluate("roomba.hudView.sounds.samples.sting.gain.gain.value")
    assert abs(volume - 0.6) < 0.000001, volume
    page.evaluate("roomba.storage.settings.musicVolume=0;roomba.hudView.syncAudio()")
    assert page.evaluate("roomba.hudView.sounds.samples.sting===null")
    print(
        "PASS clean-spin callout and sting, independent duck reasons, sound/music mute independence and zero-volume sting cancellation",
        flush=True,
    )
    page.evaluate(
        "roomba.storage.settings.sound=true;roomba.audio.enabled=true;roomba.storage.settings.music=true;roomba.storage.settings.musicVolume=0.35;roomba.state='playing';roomba.sim.ended=true;roomba.finish()"
    )
    assert page.evaluate(
        "audioEvents.slice(-2).some(e=>e.url?.includes('/voice/times-up.mp3'))"
    )
    assert page.evaluate("audioEvents.at(-1).url.includes('/audio/shift-end.mp3')")
    page.get_by_role("button", name="Garage", exact=True).click()
    assert page.evaluate(
        """(()=>{const a=roomba.hudView.sounds;return !a.voice.source&&!a.samples.sting&&a.samples.effects.size===0})()"""
    )
    assert not errors, errors
    assert not any("api.elevenlabs.io" in u for u in requests)
    (out / "events.json").write_text(json.dumps(page.evaluate("audioEvents"), indent=2))
    print(
        "PASS real results/home path cancels all audio; no JavaScript errors or synthesis-service calls",
        flush=True,
    )
    context.close()
    browser.close()
