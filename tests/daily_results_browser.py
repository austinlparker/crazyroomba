"""Local browser checks called by social.browser.py while its fixtures exist."""
import time
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import expect


def check_daily_results(context, sql, viewer, day, out):
    worker = "http://127.0.0.1:8788"
    dev = context.new_page()
    errors = []
    dev.on("pageerror", lambda e: errors.append(str(e)))

    def local_api(route):
        request = route.request
        target = worker + urlparse(request.url).path
        if urlparse(request.url).query:
            target += "?" + urlparse(request.url).query
        response = context.request.fetch(
            target, method=request.method,
            headers={"Origin": worker, "Content-Type": "application/json"},
            data=request.post_data,
        )
        route.fulfill(response=response)

    dev.route("**/api/**", local_api)
    ticket = None
    try:
        # The existing Vite DEV hook is not shipped in production. Exercise the
        # actual App.finish -> automatic submit -> standing path with local D1.
        dev.goto("http://127.0.0.1:5173", wait_until="networkidle")
        dev.wait_for_function("window.roomba && roomba.verifiedAccount")
        ticket = dev.evaluate("""async () => {
            await roomba.start('daily');
            roomba.state = 'paused';
            return roomba.ticket;
        }""")
        assert ticket and ticket["did"] == viewer
        # UI integration skips wall-clock waiting; test:api separately waits a real 90s.
        sql(f"UPDATE tickets SET created_at={int(time.time() * 1000)-91000} WHERE id='{ticket['id']}';")
        dev.evaluate("""() => {
            const a = roomba;
            for (let i = 0; i < 5400; i++) a.sim.step(0);
            a.replay = [[0, 5400]];
            a.finish();
        }""")
        expect(dev.locator(".standing-hero > strong")).to_have_text("#2", timeout=30000)
        expect(dev.locator(".standing-hero")).to_contain_text("Your daily best · 4,200")
        expect(dev.locator(".standing-neighbors .board-row")).to_have_count(3)
        assert dev.evaluate("roomba.submitted")
        for width in [1365, 390, 320]:
            dev.set_viewport_size({"width": width, "height": 1000 if width > 500 else 844})
            dev.locator(".daily-standing").scroll_into_view_if_needed()
            dev.wait_for_timeout(300)
            dev.screenshot(path=str(out / f"daily-results-{width}.png"))
            assert dev.locator(".dialog").evaluate("e => e.scrollWidth <= e.clientWidth"), "Results overflow"
            assert dev.locator(".daily-standing").evaluate("e => e.scrollWidth <= e.clientWidth"), "Rank overflow"
        dev.get_by_role("button", name="MUTUALS BOARD →", exact=True).click()
        expect(dev.get_by_role("button", name="MUTUALS", exact=True)).to_have_attribute("aria-pressed", "true")
        expect(dev.locator(".board-you")).to_contain_text("4,200")
        dev.get_by_role("button", name="Close dialog", exact=True).click()
        expect(dev.locator(".standing-hero > strong")).to_have_text("#2")
        print("PASS actual Daily finish, automatic verified submission, best-score rank, neighbors, mobile layouts, mutual board and return", flush=True)

        # Exercise rank-only retries separately from score writes, with isolated
        # response fixtures and the real controller. No fake production identities.
        mode = "failure"
        reads = []
        def standing_api(route):
            query = parse_qs(urlparse(route.request.url).query)
            cursor = query.get("cursor", [None])[0]
            reads.append(cursor)
            if mode == "failure":
                route.fulfill(status=503, json={"error": "unavailable"})
            elif mode == "signin":
                route.fulfill(status=401, json={"error": "Sign in"})
            elif mode == "pages" and len(reads) <= 8:
                route.fulfill(json=dict(day=day, scope="mutuals", viewer=viewer, entries=[], nextCursor=f"page{len(reads)}"))
            else:
                route.fulfill(json=dict(day=day, scope="mutuals", viewer=viewer, entries=[dict(
                    rank=1, did=viewer, score=4200, name="Local QA", displayName="Local QA",
                    handle="qa.example", avatar=None, deposited=1, created_at="",
                )], nextCursor=None))
        dev.route("**/api/leaderboard?**", standing_api)
        dev.evaluate("""async ({day, viewer}) => {
            roomba.closeDialog();
            roomba.dialog('RESULTS', '', '<div id="test-standing"></div>', false);
            const { mountDailyResults } = await import('/src/game/daily-results.ts');
            window.testSaves = 0;
            window.mountStanding = () => {
                window.disposeStanding?.();
                window.disposeStanding = mountDailyResults(document.querySelector('#test-standing'), {
                    day, did: viewer, score: 4200,
                    save: async () => { window.testSaves++; }, openBoard: () => {},
                });
            };
            window.mountStanding();
        }""", dict(day=day, viewer=viewer))
        expect(dev.locator(".standing-status")).to_have_text("Score posted. Rank unavailable.")
        mode = "success"
        dev.get_by_role("button", name="TRY AGAIN", exact=True).click()
        expect(dev.locator(".standing-hero")).to_contain_text("FIRST IN YOUR CIRCLE")
        assert dev.evaluate("window.testSaves") == 1, "Rank retry must not repost"
        mode = "pages"
        reads.clear()
        dev.evaluate("window.mountStanding()")
        expect(dev.get_by_role("button", name="KEEP CHECKING", exact=True)).to_be_visible()
        assert len(reads) == 8
        expect(dev.locator(".standing-hero")).to_have_count(0)
        dev.get_by_role("button", name="KEEP CHECKING", exact=True).click()
        expect(dev.locator(".standing-hero > strong")).to_have_text("#1")
        assert reads[-1] == "page8"
        mode = "signin"
        dev.evaluate("window.mountStanding()")
        expect(dev.locator("#test-standing").get_by_role("button", name="SIGN IN", exact=True)).to_be_visible()
        expect(dev.locator(".standing-hero")).to_have_count(0)
        dev.evaluate("window.disposeStanding()")
        dev.unroute("**/api/leaderboard?**", standing_api)
        context.clear_cookies()
        dev.evaluate("""() => {
            roomba.dailySubmission = null;
            roomba.submitted = false;
            roomba.finish();
        }""")
        expect(dev.locator(".standing-actions").get_by_role("button", name="SIGN IN", exact=True)).to_be_visible()
        expect(dev.locator(".standing-hero")).to_have_count(0)
        assert not errors, errors
        print("PASS rank retry without repost, solo copy, bounded continuation, expired session, no invented rank or runtime errors", flush=True)
    finally:
        dev.close()
        if ticket:
            sql(f"DELETE FROM scores WHERE id='{ticket['id']}'; DELETE FROM tickets WHERE id='{ticket['id']}';")
