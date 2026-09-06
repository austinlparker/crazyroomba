"""Exercise UTC rollover in the real Vite UI; local response/clock fixtures only."""

import argparse
from datetime import datetime
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--url", default="http://127.0.0.1:5173/")
parser.add_argument("--browser", choices=["chromium", "webkit"], default="chromium")
args = parser.parse_args()
if urlparse(args.url).hostname not in ("localhost", "127.0.0.1"):
    raise SystemExit(
        "Clock/session fixtures are restricted to a local development server."
    )
out = Path("/tmp/roomba-daily-rotation-qa")
out.mkdir(exist_ok=True)


def stamp(value):
    return int(datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp() * 1000)


with sync_playwright() as p:
    browser = getattr(p, args.browser).launch(headless=True)
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        is_mobile=True,
        has_touch=True,
        timezone_id="America/Los_Angeles",
    )
    page = context.new_page()
    errors, reads = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.route("**/api/session", lambda r: r.fulfill(json={"profile": None}))

    def board(route):
        query = parse_qs(urlparse(route.request.url).query)
        day, scope = query["day"][0], query["scope"][0]
        reads.append((day, scope))
        route.fulfill(
            json={
                "day": day,
                "scope": scope,
                "stage": "apartment",
                "viewer": None,
                "entries": [],
                "nextCursor": None,
            }
        )

    page.route("**/api/leaderboard?**", board)
    page.add_init_script("""window.dailyNow=Date.parse('2026-09-06T23:59:59.500Z');
const NativeDate=Date;
window.Date=class extends NativeDate {
  constructor(...args){super(...(args.length?args:[window.dailyNow]));}
  static now(){return window.dailyNow;}
};""")

    def time(value):
        page.evaluate("n=>window.dailyNow=n", stamp(value))

    def settled(stage):
        page.wait_for_function(
            "stage=>roomba.sim.level.id===stage&&!roomba.loadingStage", arg=stage
        )

    page.goto(args.url, wait_until="networkidle")
    page.wait_for_function("window.roomba")
    page.get_by_role("button", name="Daily", exact=True).click()
    settled("culdesac")
    expect(page.locator("#stage-status")).to_have_text("Resets at 00:00 UTC")
    time("2026-09-07T00:00:00Z")
    settled("moon")
    expect(page.locator("#stage-title")).to_have_text("Moonbase")
    assert page.evaluate("roomba.state==='menu'")
    page.screenshot(path=str(out / f"{args.browser}-midnight-menu.png"))
    print(
        "PASS visible Daily menu rotates at 00:00 UTC in a Pacific-time browser",
        flush=True,
    )

    page.evaluate(
        "Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))"
    )
    time("2026-09-08T08:00:00Z")
    page.wait_for_timeout(1200)
    assert page.evaluate("roomba.sim.level.id") == "moon"
    page.evaluate(
        "delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))"
    )
    settled("apartment")
    print("PASS sleeping tab catches the current day on visibility return", flush=True)

    page.get_by_role("button", name="Leaderboard", exact=True).click()
    expect(page.locator(".dialog-subtitle")).to_contain_text("2026-09-08")
    page.get_by_role("button", name="FOLLOWING", exact=True).click()
    page.wait_for_function(
        "document.querySelector('.board-table').getAttribute('aria-busy')==='false'"
    )
    time("2026-09-09T00:00:00Z")
    expect(page.locator(".dialog-subtitle")).to_contain_text("2026-09-09")
    expect(page.get_by_role("button", name="FOLLOWING", exact=True)).to_have_attribute(
        "aria-pressed", "true"
    )
    expect(page.locator(".board-table")).to_have_attribute("aria-busy", "false")
    assert reads[-1] == ("2026-09-09", "following"), reads
    await_count = len(reads)
    page.wait_for_timeout(1200)
    assert len(reads) == await_count
    page.screenshot(path=str(out / f"{args.browser}-midnight-board.png"))
    print(
        "PASS open leaderboard rolls over once, retaining its social filter", flush=True
    )

    # A board opened from an old result remains an explicit historical date.
    page.evaluate("roomba.board('world','2026-09-08')")
    expect(page.locator(".dialog-subtitle")).to_contain_text("2026-09-08")
    time("2026-09-10T00:00:00Z")
    page.wait_for_timeout(1200)
    expect(page.locator(".dialog-subtitle")).to_contain_text("2026-09-08")
    assert reads[-1] == ("2026-09-08", "world")
    page.get_by_role("button", name="Close dialog", exact=True).click()
    settled("culdesac")
    page.get_by_role("button", name="PRACTICE", exact=True).click()
    page.wait_for_function("roomba.state==='playing'", timeout=15000)
    run = page.evaluate(
        "({day:roomba.day,seed:roomba.sim.seed,stage:roomba.sim.level.id})"
    )
    time("2026-09-11T00:00:00Z")
    page.wait_for_timeout(1200)
    assert (
        page.evaluate(
            "({day:roomba.day,seed:roomba.sim.seed,stage:roomba.sim.level.id})"
        )
        == run
    )
    page.get_by_role("button", name="Pause game", exact=True).click()
    page.get_by_role("button", name="End run", exact=True).click()
    page.get_by_role("button", name="Garage", exact=True).click()
    settled("moon")
    print(
        "PASS historical boards and active runs keep their date; Garage moves to today's stage",
        flush=True,
    )

    time("2026-09-12T23:59:59Z")
    settled("apartment")
    page.evaluate(
        "void (roomba.sessionReady=new Promise(resolve=>window.releaseSession=resolve))"
    )
    page.get_by_role("button", name="PRACTICE", exact=True).click()
    page.wait_for_function("roomba.starting")
    time("2026-09-13T00:00:00Z")
    page.evaluate("window.releaseSession()")
    page.wait_for_function("roomba.state==='countdown'", timeout=15000)
    assert page.evaluate("roomba.day") == "2026-09-13"
    assert page.evaluate("roomba.sim.level.id") == "house"
    assert page.evaluate(
        "async()=>roomba.sim.seed===(await import('/src/game/simulation.ts')).seedForDay('2026-09-13')"
    )
    page.get_by_role("button", name="Pause game", exact=True).click()
    assert not errors, errors
    print(
        "PASS practice crossing midnight during startup uses the new day's stage and seed; no JS errors",
        flush=True,
    )
    page.get_by_role("button", name="End run", exact=True).click()
    page.get_by_role("button", name="Garage", exact=True).click()
    time("2026-09-14T23:59:59Z")
    settled("culdesac")
    # Advance the wall clock as a real stage-load promise resolves. The App must
    # re-check both seed and level instead of starting yesterday's practice.
    page.evaluate("""async()=>{
      await roomba.setStage('apartment');
      const setStage=roomba.setStage;
      roomba.setStage=async function(id){
        await setStage.call(this,id);
        if(this.starting&&id==='culdesac') window.dailyNow=Date.parse('2026-09-15T00:00:00Z');
      };
    }""")
    page.get_by_role("button", name="PRACTICE", exact=True).click()
    page.wait_for_function("roomba.state==='countdown'", timeout=15000)
    assert page.evaluate("roomba.day") == "2026-09-15"
    assert page.evaluate("roomba.sim.level.id") == "moon"
    assert page.evaluate(
        "async()=>roomba.sim.seed===(await import('/src/game/simulation.ts')).seedForDay('2026-09-15')"
    )
    page.get_by_role("button", name="Pause game", exact=True).click()
    assert not errors, errors
    print(
        "PASS practice rechecks midnight after an asynchronous stage load", flush=True
    )
    context.close()
    browser.close()
