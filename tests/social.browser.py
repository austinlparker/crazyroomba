"""Local-only social leaderboard browser/integration checks.
UV_CACHE_DIR=/tmp/crazy-roomba-uv PLAYWRIGHT_BROWSERS_PATH=/tmp/crazy-roomba-promo/browsers \
uv run --no-project --with playwright python tests/social.browser.py
Requires a freshly built local Wrangler on 8788 and Vite on 5173. Uses an isolated browser profile and
removes its local D1 sessions/scores in finally. Never creates production fixtures.
"""

from pathlib import Path
import base64, hashlib, json, os, secrets, subprocess, tempfile, time, uuid
from playwright.sync_api import sync_playwright, expect
from daily_results_browser import check_daily_results

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "http://127.0.0.1:8788"
RULESET = json.loads((ROOT / "package.json").read_text())["version"]
VIEWER = "did:plc:z72i7hdynmk6r22z27h6tvur"  # Public Bluesky account, only a LOCAL session fixture.
MUTUAL = "did:plc:ewvi7nxzyoun6zhxrhs64oiz"
OTHER_MUTUAL = "did:plc:ragtjsm2j2vknwkz3zp4oxrd"
PREFIX = "social-qa-" + str(uuid.uuid4())
OUTSIDER = f"did:web:{PREFIX}.example"
TOKEN = secrets.token_hex(32)
TOKEN_HASH = hashlib.sha256(TOKEN.encode()).hexdigest()
REVERSE_TOKEN = secrets.token_hex(32)
REVERSE_HASH = hashlib.sha256(REVERSE_TOKEN.encode()).hexdigest()
NOW = int(time.time() * 1000)
DAY = time.strftime("%Y-%m-%d", time.gmtime())
AT = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
OUT = Path("/tmp/crazy-roomba-social-qa")
OUT.mkdir(exist_ok=True)
errors = []


def sql(text):
    with tempfile.NamedTemporaryFile(mode="w", suffix=".sql") as file:
        file.write(text)
        file.flush()
        subprocess.run(
            [
                str(ROOT / "node_modules/.bin/wrangler"),
                "d1",
                "execute",
                "crazy-roomba-v2",
                "--local",
                "--file",
                file.name,
                "--yes",
            ],
            cwd=ROOT,
            env={
                **os.environ,
                "WRANGLER_LOG_PATH": str(OUT / "wrangler.log"),
                "WRANGLER_SEND_METRICS": "false",
            },
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=30,
        )


def entry(did, name, score, rank=1):
    return dict(
        did=did,
        name=name,
        handle="driver.example",
        displayName=name,
        avatar=None,
        score=score,
        rank=rank,
        deposited=1,
        created_at=AT,
    )


def response(scope, entries, cursor=None):
    return dict(day=DAY, scope=scope, viewer=VIEWER, entries=entries, nextCursor=cursor)


try:
    sql(
        f"INSERT INTO auth_sessions (token_hash,did,handle,display_name,avatar,created_at,expires_at) VALUES ('{TOKEN_HASH}','{VIEWER}','local-qa.example','Local QA',NULL,{NOW},{NOW + 600000});"
    )
    sql(f"INSERT INTO auth_sessions (token_hash,did,handle,display_name,avatar,created_at,expires_at) VALUES ('{REVERSE_HASH}','{OTHER_MUTUAL}','reverse-qa.example','Reverse QA',NULL,{NOW},{NOW+600000});")
    for i, (did, points, name) in enumerate(
        [
            (VIEWER, 4200, "Local QA"),
            (VIEWER, 800, "Local QA"),
            (MUTUAL, 6500, "Mutual Driver"),
            (OTHER_MUTUAL, 3200, "Another Mutual"),
            (OUTSIDER, 9000, "Outside Your Circle"),
        ]
    ):
        sql(
            f"INSERT INTO scores (id,day,ruleset,name,score,deposited,created_at,did,handle,display_name,avatar) VALUES ('{PREFIX}-{i}','{DAY}','{RULESET}','{name}',{points},1,'{AT}','{did}','driver.example','{name}',NULL);"
        )
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--use-angle=metal"])
        context = browser.new_context(
            viewport={"width": 1365, "height": 1000}, device_scale_factor=1
        )
        context.add_cookies(
            [
                dict(
                    name="roomba-session-local",
                    value=TOKEN,
                    url=ORIGIN,
                    httpOnly=True,
                    sameSite="Lax",
                )
            ]
        )
        config = context.request.get(ORIGIN + "/api/auth-config").json()
        reverse = context.request.get(ORIGIN + f"/api/leaderboard?day={DAY}&scope=mutuals", headers={"Cookie": "roomba-session-local=" + REVERSE_TOKEN})
        assert reverse.status == 200, reverse.text()
        assert any(e["did"] == VIEWER for e in reverse.json()["entries"]), reverse.text()
        print("PASS live Constellation-indexed reciprocal follow and Slingshot hydration via local Worker", flush=True)

        def part(value):
            return (
                base64.urlsafe_b64encode(json.dumps(value).encode())
                .decode()
                .rstrip("=")
            )

        proof = (
            part({"typ": "JWT", "alg": "ES256K"})
            + "."
            + part(
                {
                    "iss": VIEWER,
                    "aud": config["audience"],
                    "lxm": config["lxm"],
                    "iat": int(time.time()),
                    "exp": int(time.time()) + 60,
                    "jti": str(uuid.uuid4()),
                }
            )
            + "."
            + base64.urlsafe_b64encode(bytes(64)).decode().rstrip("=")
        )
        rejected = context.request.post(
            ORIGIN + "/api/session",
            headers={"Origin": ORIGIN, "Authorization": "Bearer " + proof},
            data={},
        )
        assert (
            rejected.status == 401
            and "Unable to verify this sign-in proof" in rejected.json()["error"]
        ), rejected.text()
        print(
            "PASS real DID document lookup and invalid-signature rejection", flush=True
        )
        page = context.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(ORIGIN, wait_until="networkidle")
        page.get_by_role("button", name="Leaderboard", exact=True).click()
        expect(page.locator(".board-you")).to_have_count(1, timeout=15000)
        expect(page.locator(".board-you")).to_contain_text("4,200")
        page.get_by_role("button", name="MUTUALS", exact=True).click()
        expect(page.locator(".board-row:not(.table-head)")).to_have_count(
            3, timeout=20000
        )
        expect(page.locator(".board-entries")).not_to_contain_text(
            "Outside Your Circle"
        )
        expect(page.locator(".board-you")).to_have_count(1)
        expect(
            page.get_by_role("button", name="MUTUALS", exact=True)
        ).to_have_attribute("aria-pressed", "true")
        page.screenshot(path=str(OUT / "mutuals-desktop.png"))
        for width in [390, 320]:
            page.set_viewport_size({"width": width, "height": 844})
            page.screenshot(path=str(OUT / f"mutuals-{width}.png"))
            assert page.evaluate(
                "document.documentElement.scrollWidth <= innerWidth"
            ), "Horizontal page overflow"
            assert page.locator(".board-scopes").evaluate(
                "el => el.scrollWidth <= el.clientWidth"
            ), "Filter overflow"
            for button in page.locator(".board-scopes button").all():
                assert button.evaluate("el => el.scrollWidth <= el.clientWidth"), (
                    "Filter label overflow"
                )
        page.set_viewport_size({"width": 1365, "height": 1000})
        print(
            "PASS real public-graph filtering, self row, best score, desktop/390/320 layouts",
            flush=True,
        )

        # Test delayed and paginated API responses in this isolated browser only.
        mode = "race"
        held = []
        requests = []

        def intercept(route):
            from urllib.parse import urlparse, parse_qs

            query = parse_qs(urlparse(route.request.url).query)
            scope = query.get("scope", ["world"])[0]
            cursor = query.get("cursor", [None])[0]
            requests.append((scope, cursor))
            if mode == "race" and scope == "following":
                held.append(route)
                return
            if mode == "failure":
                route.fulfill(
                    status=503, json={"error": "Bluesky connections are unavailable."}
                )
                return
            if mode == "pages" and not cursor:
                route.fulfill(json=response(scope, [], "next"))
                return
            route.fulfill(json=response(scope, [entry(MUTUAL, "Current Mutual", 500)]))

        page.route("**/api/leaderboard?**", intercept)
        page.get_by_role("button", name="FOLLOWING", exact=True).click()
        page.wait_for_timeout(150)
        page.get_by_role("button", name="MUTUALS", exact=True).click()
        expect(page.locator(".board-entries")).to_contain_text("Current Mutual")
        assert held, "Expected an in-flight following request"
        for route in held:
            try:
                route.fulfill(
                    json=response(
                        "following", [entry(OUTSIDER, "Stale Stranger", 9000)]
                    )
                )
            except Exception:
                pass  # Aborted requests can no longer be fulfilled.
        page.wait_for_timeout(100)
        expect(page.locator(".board-entries")).not_to_contain_text("Stale Stranger")
        mode = "pages"
        requests.clear()
        page.get_by_role("button", name="MUTUALS", exact=True).click()
        expect(page.locator(".board-entries")).to_contain_text("Current Mutual")
        assert requests == [("mutuals", None), ("mutuals", "next")], requests
        mode = "failure"
        page.get_by_role("button", name="FOLLOWING", exact=True).click()
        expect(page.get_by_role("button", name="TRY AGAIN", exact=True)).to_be_visible()
        expect(page.locator(".board-message")).to_contain_text("unavailable")
        expect(page.locator(".board-entries")).to_be_empty()
        mode = "success"
        page.get_by_role("button", name="TRY AGAIN", exact=True).click()
        expect(page.locator(".board-entries")).to_contain_text("Current Mutual")
        mode = "race"
        held.clear()
        page.get_by_role("button", name="FOLLOWING", exact=True).click()
        page.wait_for_timeout(100)
        page.get_by_role("button", name="Close dialog", exact=True).click()
        for route in held:
            try:
                route.fulfill(
                    json=response("following", [entry(OUTSIDER, "Late Result", 9000)])
                )
            except Exception:
                pass
        expect(page.locator("#modal")).not_to_be_visible()
        page.unroute("**/api/leaderboard?**", intercept)
        print(
            "PASS fast filter races, multi-page search, retry, close cancellation",
            flush=True,
        )

        check_daily_results(context, sql, VIEWER, DAY, OUT)
        context.clear_cookies()
        page.reload(wait_until="networkidle")
        page.get_by_role("button", name="Leaderboard", exact=True).click()
        page.get_by_role("button", name="MUTUALS", exact=True).click()
        expect(
            page.locator("#modal").get_by_role("button", name="SIGN IN", exact=True)
        ).to_be_visible()
        expect(page.locator(".board-entries")).to_be_empty()
        page.screenshot(path=str(OUT / "guest-mutuals.png"))
        assert not errors, errors
        print("PASS signed-out prompt; no runtime errors", flush=True)
        browser.close()
finally:
    sql(
        f"DELETE FROM scores WHERE id LIKE '{PREFIX}-%'; DELETE FROM auth_sessions WHERE token_hash IN ('{TOKEN_HASH}','{REVERSE_HASH}');"
    )
    print("Removed local social fixtures", flush=True)
