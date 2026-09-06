"""Export the code-native social card using the local Vite server.

Start npm run dev, then:
uv run --with playwright python scripts/social-card/render.py
Install Chromium once if needed: uv run --with playwright playwright install chromium
"""
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--origin', default='http://127.0.0.1:5173')
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
output = root / 'public/social/crazy-roomba-v1.jpg'
output.parent.mkdir(parents=True, exist_ok=True)
errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1200, 'height': 630}, device_scale_factor=1)
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(args.origin + '/scripts/social-card/', wait_until='networkidle')
    page.wait_for_function('window.socialCard?.ready', timeout=30000)
    assert not errors, errors
    page.screenshot(path=str(output), type='jpeg', quality=90)
    browser.close()
assert output.stat().st_size < 500_000, 'Keep link previews below 500 KB'
print(f'{output}: 1200 × 630, {output.stat().st_size / 1024:.1f} KiB')
