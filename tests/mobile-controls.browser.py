from pathlib import Path
import argparse
import json
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser(
    description="Real touch and layout checks against a running Vite dev server. Requires Playwright and the selected browser."
)
parser.add_argument("--url", default="http://127.0.0.1:5173/")
parser.add_argument("--screenshots", type=Path, default=Path("/tmp/roomba-mobile-qa"))
parser.add_argument("--browser", choices=["chromium", "webkit"], default="chromium")
parser.add_argument(
    "--width", type=int, action="append", help="Only check selected viewport widths"
)
args = parser.parse_args()
out = args.screenshots
out.mkdir(parents=True, exist_ok=True)


def center(page, selector):
    r = page.locator(selector).bounding_box()
    return {"x": r["x"] + r["width"] / 2, "y": r["y"] + r["height"] / 2}


with sync_playwright() as p:
    browser = getattr(p, args.browser).launch(headless=True)
    for width, height in [(390, 844), (320, 568), (844, 390), (667, 375), (568, 320)]:
        if args.width and width not in args.width:
            continue
        context = browser.new_context(
            viewport={"width": width, "height": height},
            is_mobile=True,
            has_touch=True,
            device_scale_factor=1,
        )
        page = context.new_page()
        errors = []
        voices = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on(
            "request",
            lambda r: (
                voices.append(r.url) if "/voice/" in r.url and ".mp3" in r.url else None
            ),
        )
        page.route(
            "**/api/session", lambda route: route.fulfill(json={"profile": None})
        )
        page.route(
            "**/api/auth-config",
            lambda route: route.fulfill(
                json={
                    "scope": "atproto",
                    "audience": "did:web:example.test",
                    "lxm": "io.aparker.roomba.auth",
                }
            ),
        )
        page.goto(args.url, wait_until="networkidle")
        page.wait_for_function("window.roomba")
        assert not voices, voices
        page.get_by_role("button", name="Free roam", exact=True).click()
        page.get_by_role("button", name="PLAY", exact=True).click()
        page.wait_for_function("roomba.state === 'playing'", timeout=20000)
        expect(page.locator("#countdown")).to_be_hidden(timeout=5000)
        assert len(voices) == 21, voices
        expect(page.locator(".stick-hint")).to_be_visible()
        assert page.locator("#minimap").count() == 0
        expect(page.locator(".boost-card")).to_be_hidden()
        expect(page.locator(".hud-actions .camera-button")).to_be_hidden()
        expect(
            page.locator(".timer-card")
        ).to_be_hidden()  # No redundant infinity clock in Free Roam.
        assert page.locator("#joystick").bounding_box()["width"] == 128
        assert page.locator("#score").evaluate(
            "e=>{const s=getComputedStyle(e);return (s.userSelect||s.webkitUserSelect)==='none'}"
        )
        assert page.locator("#game-canvas").evaluate(
            "e=>getComputedStyle(e).touchAction==='none'"
        )
        if args.browser == "webkit":
            assert page.locator("#score").evaluate(
                "e=>!CSS.supports('-webkit-touch-callout','none') || getComputedStyle(e).webkitTouchCallout==='none'"
            )
        for selector in [
            "#score",
            "#haul-meter",
            '[data-control="boost"]',
            "#game-canvas",
        ]:
            assert page.locator(selector).evaluate(
                "e=>['selectstart','contextmenu','dragstart'].every(type=>!e.dispatchEvent(new Event(type,{bubbles:true,cancelable:true})))"
            )
        # Presentation fixtures use the local development API; no score is submitted.
        page.evaluate(
            "roomba.state='paused';roomba.hudView.stopAudio();roomba.music.pause();roomba.sim.mode='arcade';roomba.sim.score=8750;roomba.sim.remaining=3600"
        )

        def update():
            page.evaluate(
                "roomba.hudView.update(roomba.sim,roomba.view.cameraMode,false)"
            )

        update()
        expect(page.locator("#cargo-count")).to_have_text("0 / 5")
        expect(page.locator("#combo-label")).to_have_text("FULL BIN")
        expect(page.locator("#combo-meter")).to_be_hidden()
        expect(page.locator("#objective")).to_be_hidden()
        page.screenshot(path=str(out / f"{args.browser}-empty-{width}.png"))
        page.evaluate("roomba.sim.bin=[1,1,1]")
        update()
        assert page.locator("#cargo-slots .filled").count() == 3
        expect(page.locator("#objective")).to_be_visible()
        page.screenshot(path=str(out / f"{args.browser}-partial-{width}.png"))
        page.evaluate(
            "roomba.sim.bin=[1,1,1,1,1];roomba.sim.chain.count=3;roomba.sim.chain.expires=roomba.sim.ticks+600"
        )
        update()
        expect(page.locator("#cargo-label")).to_have_text("CASH IT IN!")
        expect(page.locator("#combo-value")).to_have_text("3×")
        expect(page.locator("#combo-meter")).to_have_attribute("aria-valuenow", "10")
        assert page.locator("#combo").evaluate("e=>e.closest('#haul-meter')!==null")
        page.screenshot(path=str(out / f"{args.browser}-full-{width}.png"))
        selectors = [
            "#joystick",
            ".stick-hint",
            ".score-card",
            ".timer-card",
            ".hud-actions",
            "#haul-meter",
            '[data-control="boost"]',
            '[data-control="hop"]',
            '[data-control="drift"]',
        ]
        geometry = {
            selector: page.locator(selector).bounding_box() for selector in selectors
        }
        (out / f"{args.browser}-layout-{width}.json").write_text(
            json.dumps(geometry, indent=2)
        )
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        for selector, r in geometry.items():
            assert r is not None, (width, selector)
            assert (
                r["x"] >= 0
                and r["y"] >= 0
                and r["x"] + r["width"] <= width
                and r["y"] + r["height"] <= height
            ), (width, selector, r)

        def overlaps(a, b):
            return (
                a["x"] < b["x"] + b["width"]
                and a["x"] + a["width"] > b["x"]
                and a["y"] < b["y"] + b["height"]
                and a["y"] + a["height"] > b["y"]
            )

        from itertools import combinations

        for a, b in combinations(selectors, 2):
            assert not overlaps(geometry[a], geometry[b]), (width, a, b)
        # Number glyphs, not just their container, fit at high scores and in Daily practice.
        page.evaluate("roomba.sim.score=999999;roomba.sim.mode='daily'")
        update()
        bounds = page.locator("#score").evaluate(
            "e=>{const r=new Range();r.selectNodeContents(e);return {text:r.getBoundingClientRect().right,clock:document.querySelector('.timer-card').getBoundingClientRect().left}}"
        )
        assert bounds["text"] < bounds["clock"], (width, bounds)
        page.evaluate(
            "roomba.sim.chain.expires=roomba.sim.ticks+180;roomba.sim.boost=25"
        )
        update()
        assert page.locator("#haul-meter").evaluate("e=>e.classList.contains('urgent')")
        assert page.locator("#touch-boost-fill").evaluate(
            "e=>e.style.strokeDashoffset==='75'"
        )
        page.evaluate(
            "roomba.hudView.event({kind:'chain-lost',reason:'collision',value:1},roomba.sim);roomba.sim.chain.count=0"
        )
        update()
        expect(page.locator("#combo-label")).to_have_text("COMBO LOST")
        expect(page.locator("#combo-meter")).to_be_hidden()
        assert page.locator("#cargo-slots .filled").count() == 5
        page.screenshot(path=str(out / f"{args.browser}-lost-{width}.png"))
        page.evaluate(
            "roomba.sim.ticks+=151;roomba.sim.bin=[];roomba.sim.mode='freeroam';roomba.sim.remaining=Infinity"
        )
        update()
        expect(page.locator("#combo-label")).to_have_text("FULL BIN")
        page.evaluate("roomba.state='playing';roomba.input.enabled=true")
        if width == 390 and args.browser == "chromium":
            cdp = context.new_cdp_session(page)
            # A real long press on a HUD label must not select text or open a menu.
            label = center(page, "#score")
            cdp.send(
                "Input.dispatchTouchEvent",
                {"type": "touchStart", "touchPoints": [{"id": 1, **label}]},
            )
            page.wait_for_timeout(800)
            cdp.send(
                "Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []}
            )
            assert page.evaluate("getSelection().toString()") == ""
            stick = center(page, "#joystick")
            boost = center(page, '[data-control="boost"]')

            def touch(kind, points):
                cdp.send(
                    "Input.dispatchTouchEvent", {"type": kind, "touchPoints": points}
                )

            def pt(i, c, dx=0, dy=0):
                return {"id": i, "x": c["x"] + dx, "y": c["y"] + dy}

            def read():
                return page.evaluate("roomba.input.read()")

            def centered():
                assert page.locator(".stick-thumb").evaluate(
                    "e => e.style.transform === ''"
                )

            touch("touchStart", [pt(1, stick)])
            assert read() == 0
            touch("touchMove", [pt(1, stick, 0, -35)])
            assert read() == 1, read()
            expect(page.locator(".stick-hint")).to_be_hidden()
            touch("touchStart", [pt(1, stick, 0, -35), pt(2, boost)])
            assert read() == 17, read()
            # A third finger on the stick cannot take ownership from the first.
            touch(
                "touchStart", [pt(1, stick, 0, -35), pt(2, boost), pt(3, stick, 25, 25)]
            )
            assert read() == 17, read()
            touch(
                "touchMove", [pt(1, stick, 35, 35), pt(2, boost), pt(3, stick, 25, 25)]
            )
            assert read() == 26, read()
            touch("touchCancel", [])
            assert read() == 0
            centered()
            touch("touchStart", [pt(1, stick, 0, -35), pt(2, boost)])
            assert read() == 17
            page.evaluate("roomba.pause()")
            assert read() == 0
            centered()
            assert page.locator(".is-active").count() == 0
            touch("touchEnd", [])
            page.get_by_role("button", name="RESUME", exact=False).click()
            assert read() == 0
            centered()
            touch("touchStart", [pt(1, stick, -35, 0)])
            assert read() == 4
            touch("touchEnd", [])
            assert read() == 0
            centered()
            touch("touchStart", [pt(1, stick, 0, -35)])
            page.evaluate("window.dispatchEvent(new Event('blur'))")
            assert read() == 0
            centered()
            touch("touchEnd", [])
            page.get_by_role("button", name="RESUME", exact=False).click()
            page.emulate_media(reduced_motion="reduce")
            page.locator("#joystick").evaluate("e => e.classList.remove('used')")
            assert (
                page.locator("#joystick").evaluate(
                    "e => getComputedStyle(e).animationName"
                )
                == "none"
            )
            print(
                "PASS pointer ownership, simultaneous boost, forward/reverse/steer, release, cancellation, pause/blur and reduced motion",
                flush=True,
            )
        page.get_by_role("button", name="Pause game", exact=True).click()
        camera = page.get_by_role("button", name="Camera view", exact=True)
        before = page.evaluate("roomba.view.cameraMode")
        camera.click()
        assert page.evaluate("roomba.view.cameraMode") != before
        expect(camera).to_have_text("First person" if before == "chase" else "Chase")
        page.get_by_role("button", name="RESUME", exact=False).click()
        assert page.evaluate("roomba.state==='playing'")
        if width == 390:
            page.evaluate("roomba.home()")
            page.locator(".account-button").click()
            handle = page.locator("#handle")
            expect(handle).to_be_visible(timeout=15000)
            handle.fill("example.test")
            assert handle.evaluate(
                "e=>{const s=getComputedStyle(e);return (s.userSelect||s.webkitUserSelect)==='text'}"
            )
            assert handle.evaluate(
                "e=>e.dispatchEvent(new Event('contextmenu',{bubbles:true,cancelable:true}))"
            )
            handle.evaluate("e=>e.select()")
            assert handle.evaluate("e=>e.selectionEnd-e.selectionStart") == 12
        assert not errors, errors
        print(
            f"PASS {args.browser} {width}x{height}: unified HUD states, no overlap, selection guards, camera/pause and 21 lazy voice cues",
            flush=True,
        )
        context.close()
    browser.close()
