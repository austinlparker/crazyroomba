"""Check countdown timing and pause/resume with real, one-second frame intervals."""

import argparse
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:5173/')
args = parser.parse_args()
if urlparse(args.url).hostname not in ('localhost', '127.0.0.1'):
    raise SystemExit('Frame scheduling fixtures are restricted to a local server.')
out = Path('/tmp/roomba-stage-qa/countdown')
out.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 800, 'height': 600})
    # Slow callbacks without changing performance.now(), game state, or physics.
    # Suspending callbacks also reproduces a browser that stops frames in the background.
    context.add_init_script('''
window.suspendTestFrames = false;
window.requestAnimationFrame = callback => {
  const id = setInterval(() => {
    if (window.suspendTestFrames) return;
    clearInterval(id);
    callback(performance.now());
  }, 1000);
  return id;
};
window.cancelAnimationFrame = id => clearInterval(id);
''')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.route('**/api/session', lambda route: route.fulfill(json={'profile': None}))
    try:
        page.goto(args.url, wait_until='networkidle')
        page.get_by_role('button', name='Free roam', exact=True).click()
        page.get_by_role('button', name='PLAY', exact=True).click()
        expect(page.locator('#countdown')).to_be_visible()
        # Previously this took ~35 seconds: every real second advanced only 0.15 s.
        expect(page.locator('#countdown')).to_be_hidden(timeout=9000)
        print('PASS countdown and GO banner finish on time at one frame per second', flush=True)

        page.get_by_role('button', name='Pause game', exact=True).click()
        page.get_by_role('button', name='Restart', exact=True).click()
        expect(page.locator('#countdown strong')).to_have_text('3', timeout=5000)
        page.get_by_role('button', name='Pause game', exact=True).click()
        page.evaluate('window.suspendTestFrames = true')
        page.wait_for_timeout(5000)
        page.get_by_role('button', name='RESUME', exact=False).click()
        page.evaluate('window.suspendTestFrames = false')
        # A stopped frame loop must not charge the five paused seconds on resume.
        expect(page.locator('#countdown')).to_be_visible()
        page.wait_for_timeout(1200)
        expect(page.locator('#countdown')).to_be_visible()
        expect(page.locator('#countdown strong')).not_to_have_text('GO!')
        expect(page.locator('#countdown')).to_be_hidden(timeout=6000)
        assert not errors, errors
        print('PASS paused time is excluded after frames stop; countdown resumes normally', flush=True)
    except Exception:
        try:
            page.screenshot(path=str(out / 'failure.png'), timeout=5000)
        except Exception as capture_error:
            print(f'Could not capture countdown failure: {capture_error}', flush=True)
        raise
    finally:
        context.close()
        browser.close()
