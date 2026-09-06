"""Exercise every stage and the garage from the production build, without dev hooks."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:4173/')
parser.add_argument('--software-rendering', action='store_true',
                    help='Use Chromium SwiftShader to reproduce CPU-only CI rendering locally.')
args = parser.parse_args()
out = Path('/tmp/roomba-stage-qa')
out.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=[
        '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'
    ] if args.software_rendering else [])
    context = browser.new_context(viewport={'width': 1280, 'height': 800})
    page = context.new_page()
    errors, failed_assets = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: failed_assets.append(response.url)
            if response.status >= 400 and '/assets/' in response.url else None)
    page.route('**/api/session', lambda route: route.fulfill(json={'profile': None}))
    try:
        page.goto(args.url, wait_until='networkidle')
        expect(page.get_by_role('button', name='PLAY', exact=True)).to_be_visible(timeout=20000)
        assert page.evaluate('typeof window.roomba') == 'undefined', 'Dev hook leaked into production'
        for index, stage in enumerate(['Apartment', 'House Party', 'Cul-de-sac', 'Moonbase']):
            if index:
                page.get_by_role('button', name='Next stage', exact=True).click()
            expect(page.locator('#stage-title')).to_have_text(stage)
            expect(page.locator('.stage-select')).to_have_attribute('aria-busy', 'false')
            page.get_by_role('button', name='Free roam', exact=True).click()
            page.get_by_role('button', name='PLAY', exact=True).click()
            expect(page.locator('#hud')).to_be_visible(timeout=20000)
            expect(page.locator('#countdown')).to_be_hidden(timeout=20000)
            page.keyboard.down('w')
            page.wait_for_timeout(500)
            page.keyboard.up('w')
            page.get_by_role('button', name='Pause game', exact=True).click()
            page.screenshot(path=str(out / f'{index}-{stage.lower().replace(" ", "-")}.png'))
            page.get_by_role('button', name='End run', exact=True).click()
            page.get_by_role('button', name='Garage', exact=True).click()
            expect(page.locator('#stage-title')).to_have_text(stage)
            print(f'PASS production {stage}: load, start, drive, pause, finish and return', flush=True)
        page.get_by_role('button', name='Skins', exact=True).click()
        expect(page.locator('.skin-card')).to_have_count(6)
        expect(page.locator('#skin-preview')).to_be_visible()
        page.get_by_role('button', name='Preview Solid Gold', exact=True).click()
        expect(page.locator('#equip-skin')).to_be_disabled()
        page.get_by_role('button', name='Close dialog', exact=True).click()
        expect(page.locator('#skin-preview')).to_have_count(0)
        assert not errors, errors
        assert not failed_assets, failed_assets
        print('PASS production garage: six skin previews, locked equip, disposal; no failed modules or page errors', flush=True)
    except Exception:
        diagnostics = {'pageErrors': errors, 'failedAssets': failed_assets}
        try:
            diagnostics.update(page.evaluate('''() => {
                const gl = document.querySelector('#game-canvas').getContext('webgl2');
                const ext = gl.getExtension('WEBGL_debug_renderer_info');
                return {
                    stage: document.querySelector('#stage-title').textContent,
                    countdown: document.querySelector('#countdown').textContent,
                    hidden: document.hidden,
                    renderer: gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
                };
            }'''))
            page.screenshot(path=str(out / 'failure.png'), timeout=5000)
        except Exception as capture_error:
            diagnostics['captureError'] = str(capture_error)
        (out / 'failure.json').write_text(json.dumps(diagnostics, indent=2))
        raise
    finally:
        context.close()
        browser.close()
