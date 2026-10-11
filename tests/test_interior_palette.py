"""Browser-level regressions for visual-only, linked whole-cabin finish; no API/network."""
import json, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = (ROOT/'dist/xpeng-vehicle-card.js').read_text()
assert 'xpCabinSvg(theme)' in SCRIPT
assert 'XP_INTERIORS' in SCRIPT
assert all(token in (ROOT/'README.md').read_text().lower() for token in ('dashboard', 'wheel', 'door inserts', 'console', 'seats'))
assert {i['id'] for i in json.loads((ROOT/'model-catalog.json').read_text())['interiors']} == {'dark_gray','light_gray'}
assert 'callService(' not in SCRIPT and '.call_service(' not in SCRIPT  # no controls

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium') or None,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':430,'height':930},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    def route_asset(route):
        filename=route.request.url.split('/local/xpeng/',1)[-1]
        path=ROOT/'assets'/filename
        if not path.is_file(): return route.fulfill(status=404,body='missing')
        mime='image/webp' if path.suffix=='.webp' else 'image/png' if path.suffix=='.png' else 'image/svg+xml'
        return route.fulfill(status=200,body=path.read_bytes(),content_type=mime)
    page.route('**/local/xpeng/**',route_asset)
    page.set_content('<html><head><base href="https://ha.local/"><meta charset="utf-8"/></head><body style="margin:0;background:#111;padding:8px"><xpeng-vehicle-card></xpeng-vehicle-card></body></html>')
    page.add_script_tag(content=SCRIPT)
    page.evaluate('''() => {const c=document.querySelector('xpeng-vehicle-card');
    c.setConfig({prefix:'my_xpeng',model:'G6',year:'2026',trim:'core_plus_rwd',color:'arctic_white',interior:'dark_gray',image_path:'/local/xpeng',theme:'dark'});
    c.hass={states:{'sensor.my_xpeng_api_connection_status':{state:'not_configured',attributes:{}}}};}''')
    card=page.locator('xpeng-vehicle-card')
    card.locator('button[data-view="interior"]').first.click()
    sv=card.locator('svg.xp-cabin-svg')
    assert sv.count()==1
    assert 'Dark Gray' in sv.get_attribute('aria-label')
    dark_svg=sv.evaluate('(e)=>e.outerHTML')
    for marker in ['Entire door inserts','Dash cover','Steering wheel trim','Center console','Front seats','Backrests']:
        assert marker in dark_svg
    # Changing finish updates the whole cabin, not individual seats or API entities.
    card.locator('button[data-interior="light_gray"]').click()
    light_svg=sv.evaluate('(e)=>e.outerHTML')
    assert dark_svg!=light_svg
    assert 'Light Gray' in sv.get_attribute('aria-label')
    assert '#d9dbd7' in light_svg and '#424b53' not in light_svg
    assert card.locator('button[data-interior="light_gray"]').get_attribute('aria-pressed')=='true'
    assert page.evaluate("()=>document.querySelector('xpeng-vehicle-card')._preferences.interior")=='light_gray' 
    previews=ROOT/'previews'; previews.mkdir(exist_ok=True)
    page.screenshot(path=str(previews/'interior-2026-light-gray.png'),full_page=True)
    card.locator('button[data-interior="dark_gray"]').click()
    assert 'Dark Gray' in sv.get_attribute('aria-label')
    page.screenshot(path=str(previews/'interior-2026-dark-gray.png'),full_page=True)
    # The climate page shares the very same palette and does not simulate controls.
    card.locator('button[data-back]').first.click()
    card.locator('button[data-view="climate"]').first.click()
    assert card.locator('svg.xp-cabin-svg').count()==1
    assert 'Dark Gray' in card.locator('svg.xp-cabin-svg').get_attribute('aria-label')
    assert not card.locator('button[data-action="heat"],button[data-action="massage"],button[data-action="vent"]').count()
    # The editor saves a stable field in config, not a fictitious HA sensor.
    page.evaluate('''() => {let e=document.createElement('xpeng-vehicle-card-editor');document.body.appendChild(e);e.setConfig({prefix:'my_xpeng',year:'2026',model:'G6',trim:'core_plus_rwd',interior:'dark_gray',color:'arctic_white'});}''')
    editor=page.locator('xpeng-vehicle-card-editor')
    editor.locator('[data-key="interior"]').select_option('light_gray')
    assert editor.locator('[data-key="interior"]').input_value()=='light_gray'
    # Black edition only shows a dark finish; regional limitation clearly disclosed.
    editor.locator('[data-key="trim"]').select_option('black_edition')
    assert editor.locator('[data-key="interior"] option').count()==1
    assert editor.locator('[data-key="interior"]').input_value()=='dark_gray'
    assert not errors,errors
    browser.close()
print('PASS: linked full-cabin recolour, separate interior/climate screens, local persistence, editor, 2026 trim constraints, no JS errors or invented controls')
