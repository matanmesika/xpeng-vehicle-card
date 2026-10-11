"""Browser regression: XPENG 2026 cockpit renders reliably without live vehicle data."""
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
JS=(ROOT/'dist/xpeng-vehicle-card.js').read_text()
assert JS == (ROOT/'xpeng-vehicle-card.js').read_text()
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium') or None,args=['--no-sandbox'])
    for width,height in ((1280,900),(390,844)):
        page=browser.new_page(viewport={'width':width,'height':height})
        errors=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        def route_asset(route):
            rel=route.request.url.split('/local/xpeng/',1)[-1]
            path=ROOT/'assets'/rel
            if not path.is_file(): return route.fulfill(status=404,body='missing')
            typ='image/webp' if path.suffix=='.webp' else 'image/png' if path.suffix=='.png' else 'image/svg+xml'
            return route.fulfill(status=200,body=path.read_bytes(),content_type=typ)
        page.route('**/local/xpeng/**',route_asset)
        page.set_content('<html><head><base href="https://ha.local/"><meta charset="utf-8"><style>body{margin:0;background:#0a121a}xpeng-vehicle-card{display:block;width:100%}</style></head><body><xpeng-vehicle-card></xpeng-vehicle-card></body></html>')
        page.add_script_tag(content=JS)
        page.evaluate("""() => {
          const card=document.querySelector('xpeng-vehicle-card');
          card.setConfig({prefix:'my_xpeng',model:'G6',year:'2026',trim:'core_performance_awd',color:'arctic_white',interior:'dark_gray',theme:'dark',dashboard_layout:'cockpit',image_path:'/local/xpeng'});
          card.hass={states:{'sensor.my_xpeng_api_connection_status':{state:'not_configured',attributes:{}}}};
        }""")
        card=page.locator('xpeng-vehicle-card')
        assert card.get_attribute('data-cockpit') is not None
        assert card.locator('.xp-cockpit').count()==1
        assert card.locator('.xp-side-menu button').count()>=8
        assert card.locator('.hero img').count()==1
        assert 'XPENG API not connected' in card.locator('.disconnected-note').inner_text()
        assert card.locator('.xp-tile').count()==4
        card.locator('.xp-side-menu button[data-view="climate"]').click()
        assert card.locator('.hero[data-hero-view="climate"]').count()==1
        card.locator('button[data-view="comfort"]').first.click()
        assert card.locator('.hero[data-hero-view="comfort"]').count()==1
        assert 'Steering wheel heating' in card.locator('.content').inner_text()
        assert card.locator('.xp-comfort-item button:not([disabled])').count()==0
        card.locator('button[data-expand]').click()
        assert card.get_attribute('data-expanded') is not None
        card.locator('button[data-expand]').click()
        assert card.get_attribute('data-expanded') is None
        assert not errors,errors
        page.close()
    browser.close()
print('PASS: mobile and desktop cockpit, navigation, disabled controls and fullscreen')
