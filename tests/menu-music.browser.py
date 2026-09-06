"""Check Overdrive menu playback, autoplay fallback and run transitions in Vite."""

import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--url", default="http://127.0.0.1:5173/")
parser.add_argument("--browser", choices=["chromium", "webkit"], default="chromium")
parser.add_argument("--autoplay", choices=["allowed", "blocked"], default="blocked")
parser.add_argument("--live", action="store_true")
args = parser.parse_args()
out = Path("/tmp/roomba-menu-music-qa")
out.mkdir(exist_ok=True)
with sync_playwright() as p:
    options = {"headless": True}
    if args.browser == "chromium":
        options["args"] = [
            "--autoplay-policy="
            + (
                "no-user-gesture-required"
                if args.autoplay == "allowed"
                else "document-user-activation-required"
            )
        ]
    browser = getattr(p, args.browser).launch(**options)
    context = browser.new_context(
        viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True
    )
    page = context.new_page()
    errors = []
    requests = []
    all_requests = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("request", lambda r: requests.append(r.url))
    page.on("request", lambda r: all_requests.append(r.url))
    if not args.live:
        page.route("**/api/session", lambda r: r.fulfill(json={"profile": None}))
    page.add_init_script("""window.menuPlayers=[];window.menuContexts=[];
 const create=AudioContext.prototype.createMediaElementSource;
 AudioContext.prototype.createMediaElementSource=function(player){window.menuPlayers.push(player);window.menuContexts.push(this);return create.call(this,player)};""")
    page.goto(args.url, wait_until="networkidle")
    expect(page.get_by_role("button", name="PLAY", exact=True)).to_be_visible(
        timeout=20000
    )
    assert not any("/voice/" in u or "/audio/" in u for u in requests)
    assert page.evaluate(
        "menuPlayers.length===1&&menuPlayers[0].src.includes('dust-fm-overdrive.mp3')&&menuPlayers[0].loop"
    )
    if args.browser == "chromium" and args.autoplay == "allowed":
        page.wait_for_function(
            "menuPlayers[0].currentTime>0&&menuContexts[0].state==='running'",
            timeout=6000,
        )
        print(
            "PASS Overdrive autoplays before any gesture when the browser permits it",
            flush=True,
        )
    elif args.browser == "chromium":
        assert page.evaluate(
            "menuPlayers[0].paused||menuContexts[0].state==='suspended'"
        )
    # A normal mode-selection tap unlocks menu music, without starting a run.
    page.get_by_role("button", name="Free roam", exact=True).click()
    page.wait_for_function(
        "!menuPlayers[0].paused&&menuPlayers[0].currentTime>0&&menuContexts[0].state==='running'",
        timeout=10000,
    )
    assert page.evaluate("menuPlayers[0].loop")
    page.screenshot(path=str(out / f"{args.browser}-{args.autoplay}-menu.png"))
    page.get_by_role("button", name="Settings", exact=True).click()
    expect(page.locator("[data-radio-title]")).to_have_text("Dust FM: Overdrive")
    page.locator("#music-volume").fill("23")
    tracks = json.loads(
        (
            Path(__file__).resolve().parents[1] / "scripts/audio/radio-tracks.json"
        ).read_text()
    )["tracks"]
    for track in tracks:
        page.get_by_role("button", name="Next music track", exact=True).click()
        expect(page.locator("[data-radio-title]")).to_have_text(track["title"])
        page.wait_for_function(
            "file=>menuPlayers[0].src.endsWith(file)&&!menuPlayers[0].paused&&menuPlayers[0].currentTime>0.1&&menuContexts[0].state==='running'",
            arg=track["id"] + ".mp3",
            timeout=15000,
        )
        assert abs(page.evaluate("menuPlayers[0].duration") - track["seconds"]) < 0.1
        assert page.evaluate("!menuPlayers[0].loop")
    # Verify the normal-speed clock before advancing to a real ended event.
    # WebKit's media backend can stall at 8x despite a fully buffered MP3.
    # Seek where supported; Chromium streams may expose no seekable range.
    position = page.evaluate("menuPlayers[0].currentTime")
    page.wait_for_function(
        "position=>menuPlayers[0].currentTime>position+2",
        arg=position,
        timeout=10000,
    )
    page.evaluate("""(() => {
        const player = menuPlayers[0], target = player.duration - 2;
        window.menuNativeEnd = false;
        player.addEventListener('ended', event => window.menuNativeEnd = event.isTrusted, {once:true});
        for (let i = 0; i < player.seekable.length; i++) {
            if (player.seekable.start(i) <= target && player.seekable.end(i) >= target) {
                player.currentTime = target;
                return;
            }
        }
        player.playbackRate = 8;
    })()""")
    expect(page.locator("[data-radio-title]")).to_have_text(
        "Dust FM: Overdrive", timeout=25000
    )
    page.evaluate("menuPlayers[0].playbackRate=1")
    assert page.evaluate("menuNativeEnd"), "Playlist must advance from a native ended event"
    page.wait_for_function(
        "!menuPlayers[0].paused&&menuPlayers[0].currentTime>0.1&&menuContexts[0].state==='running'",
        timeout=10000,
    )
    assert page.evaluate("!menuPlayers[0].loop")
    print(
        "PASS all four 90-second songs stream and wrap to Overdrive in the five-track playlist",
        flush=True,
    )
    page.get_by_role("button", name="Close dialog", exact=True).click()
    page.wait_for_function(
        "menuPlayers[0].loop&&menuPlayers[0].src.includes('dust-fm-overdrive.mp3')&&!menuPlayers[0].paused"
    )
    page.get_by_role("button", name="Music", exact=True).click()
    expect(page.get_by_role("button", name="Music", exact=True)).to_have_attribute(
        "aria-pressed", "false"
    )
    assert page.evaluate("menuPlayers[0].paused")
    # Persisted music-off must create no player and issue no music requests on reload.
    requests.clear()
    page.reload(wait_until="networkidle")
    expect(page.get_by_role("button", name="PLAY", exact=True)).to_be_visible(
        timeout=20000
    )
    assert page.evaluate("menuPlayers.length===0")
    assert not any("/music/" in u for u in requests), requests
    page.get_by_role("button", name="Music", exact=True).click()
    page.wait_for_function(
        "menuPlayers.length===1&&!menuPlayers[0].paused&&menuPlayers[0].loop&&menuPlayers[0].currentTime>0",
        timeout=10000,
    )
    page.get_by_role("button", name="Settings", exact=True).click()
    expect(page.locator("#music-volume")).to_have_value("23")
    page.get_by_role("button", name="Close dialog", exact=True).click()
    print(
        "PASS menu tap fallback, preview/return to Overdrive, one player, immediate mute and persisted music/volume settings",
        flush=True,
    )
    if not args.live and args.browser == "chromium":
        # Headless tabs do not model native focus changes. Exercise the lifecycle
        # events explicitly, including a hidden-document guard on focus return.
        page.evaluate("window.dispatchEvent(new Event('blur'))")
        assert page.evaluate("menuPlayers[0].paused")
        page.evaluate(
            "Object.defineProperty(document,'hidden',{configurable:true,value:true});window.dispatchEvent(new Event('focus'))"
        )
        assert page.evaluate("menuPlayers[0].paused")
        page.evaluate("delete document.hidden;window.dispatchEvent(new Event('focus'))")
        page.wait_for_function("!menuPlayers[0].paused", timeout=5000)
        page.evaluate(
            "Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))"
        )
        assert page.evaluate("menuPlayers[0].paused")
        page.evaluate(
            "delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))"
        )
        page.wait_for_function("!menuPlayers[0].paused", timeout=5000)
        print(
            "PASS menu focus/visibility handlers pause and resume without playing while hidden",
            flush=True,
        )
    page.get_by_role("button", name="Free roam", exact=True).click()
    page.get_by_role("button", name="PLAY", exact=True).click()
    expect(page.locator("#hud")).to_be_visible(timeout=20000)
    expect(page.locator("#countdown")).to_be_hidden(timeout=20000)
    assert page.evaluate(
        "menuPlayers.length===1&&!menuPlayers[0].loop&&!menuPlayers[0].paused"
    )
    shift = page.evaluate("menuPlayers[0].src")
    page.get_by_role("button", name="Pause game", exact=True).click()
    assert page.evaluate("menuPlayers[0].paused")
    page.get_by_role("button", name="RESUME", exact=False).click()
    page.wait_for_function("!menuPlayers[0].paused")
    assert page.evaluate("menuPlayers[0].src") == shift
    if not args.live:
        page.get_by_role("button", name="Pause game", exact=True).click()
        page.get_by_role("button", name="End run", exact=True).click()
        page.get_by_role("button", name="Garage", exact=True).click()
        page.wait_for_function(
            "menuPlayers[0].loop&&menuPlayers[0].src.includes('dust-fm-overdrive.mp3')&&!menuPlayers[0].paused"
        )
    else:
        page.get_by_role("button", name="Pause game", exact=True).click()
    assert page.evaluate("menuPlayers.length===1")
    music_files = {
        url.split("/music/")[1].split("?")[0]
        for url in all_requests
        if "/music/" in url and ".mp3" in url
    }
    assert music_files == {"dust-fm-overdrive.mp3", *(t["id"] + ".mp3" for t in tracks)}
    assert not errors, errors
    print(
        "PASS shift playlist transition and pause/resume"
        + (" and Garage restores Overdrive" if not args.live else "")
        + "; no JavaScript errors",
        flush=True,
    )
    context.close()
    browser.close()
