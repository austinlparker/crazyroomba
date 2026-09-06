"""Menus and full runs must remain usable when Web Audio is unavailable."""

import argparse
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--url", default="http://127.0.0.1:5173/")
args = parser.parse_args()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for failure in ["missing", "constructor-throws"]:
        context = browser.new_context(viewport={"width": 390, "height": 844})
        page = context.new_page()
        errors, requests = [], []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("request", lambda request: requests.append(request.url))
        page.route("**/api/session", lambda route: route.fulfill(json={"profile": None}))
        page.add_init_script(
            "window.AudioContext = undefined;"
            if failure == "missing"
            else "window.AudioContext = class { constructor() { throw new DOMException('Audio unavailable', 'NotSupportedError'); } };"
        )
        page.goto(args.url, wait_until="networkidle")
        expect(page.get_by_role("button", name="PLAY", exact=True)).to_be_visible(timeout=20000)
        page.get_by_role("button", name="Free roam", exact=True).click()
        page.get_by_role("button", name="Settings", exact=True).click()
        page.get_by_role("button", name="Play preview", exact=True).click()
        page.get_by_role("button", name="Next music track", exact=True).click()
        expect(page.locator("[data-radio-status]")).to_contain_text("unavailable")
        expect(page.get_by_role("button", name="Play preview", exact=True)).to_be_visible()
        page.get_by_role("button", name="Close dialog", exact=True).click()
        page.get_by_role("button", name="Sound + voice", exact=True).click()
        page.get_by_role("button", name="Sound + voice", exact=True).click()
        page.get_by_role("button", name="PLAY", exact=True).click()
        expect(page.locator("#hud")).to_be_visible(timeout=20000)
        expect(page.locator("#countdown")).to_be_hidden(timeout=20000)
        page.get_by_role("button", name="Pause game", exact=True).click()
        page.get_by_role("button", name="RESUME", exact=False).click()
        expect(page.get_by_role("button", name="Pause game", exact=True)).to_be_visible()
        page.get_by_role("button", name="Pause game", exact=True).click()
        page.get_by_role("button", name="End run", exact=True).click()
        page.get_by_role("button", name="Garage", exact=True).click()
        expect(page.get_by_role("button", name="PLAY", exact=True)).to_be_visible()
        assert not errors, (failure, errors)
        assert not any(
            group in url for url in requests for group in ["/voice/", "/audio/", "/music/"]
        ), (failure, requests)
        print(f"PASS {failure}: settings/preview, gameplay, pause/resume and Garage; no audio downloads or JavaScript errors", flush=True)
        context.close()
    browser.close()
