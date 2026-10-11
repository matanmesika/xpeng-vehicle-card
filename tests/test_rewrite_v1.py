"""Real-browser acceptance for dashboard-first XPENG, including live charging.

Data injected into isolated Chromium tests is *test-only*, never a product
fixture. The real card never invents values or calls manufacturer APIs.
"""
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=(ROOT/'dist/xpeng-vehicle-card.js').read_text(encoding='utf-8')
assert SCRIPT==(ROOT/'xpeng-vehicle-card.js').read_text(encoding='utf-8')
assert 'XPENG Vehicle Card v1.0.0-alpha.1' in SCRIPT
assert 'localStorage' not in SCRIPT and 'callService(' not in SCRIPT and 'fetch(' not in SCRIPT
OUT=ROOT/'previews'/'rewrite-v1'
OUT.mkdir(parents=True,exist_ok=True)

def state(value):
    return {'state':str(value),'attributes':{}}

OFFLINE={'sensor.my_xpeng_api_connection_status':state('not_configured')}
CHARGING={
    'sensor.my_xpeng_api_connection_status':state('connected'),
    'sensor.my_xpeng_soc':state(62),
    'sensor.my_xpeng_range_km':state(391),
    'sensor.my_xpeng_charge_target':state(90),
    'sensor.my_xpeng_charge_power_kw':state(11.2),
    'sensor.my_xpeng_charge_remaining_min':state(135),
    'sensor.my_xpeng_charge_session_energy_kwh':state(18.7),
    'binary_sensor.my_xpeng_is_charging':state('on'),
    'binary_sensor.my_xpeng_is_plugged_in':state('on'),
    'binary_sensor.my_xpeng_is_locked':state('on'),
    'binary_sensor.my_xpeng_door_front_left_open':state('off'),
    'binary_sensor.my_xpeng_door_front_right_open':state('off'),
    'binary_sensor.my_xpeng_door_rear_left_open':state('off'),
    'binary_sensor.my_xpeng_door_rear_right_open':state('off'),
    'binary_sensor.my_xpeng_climate_active':state('off'),
    'sensor.my_xpeng_cabin_temperature_c':state(21.5),
    'sensor.my_xpeng_last_update':state('2026-10-11T13:00:00+03:00'),
}
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium') or None,args=['--no-sandbox'])
    for tag,w,h in [('desktop',1200,900),('phone',390,844)]:
        page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
        errors=[];missing=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        def asset(route):
            path=ROOT/'assets'/route.request.url.split('/local/xpeng/',1)[-1]
            if not path.is_file():
                missing.append(str(path))
                return route.fulfill(status=404,body='Image not found')
            content_type='image/webp' if path.suffix=='.webp' else 'image/png' if path.suffix=='.png' else 'image/svg+xml'
            route.fulfill(status=200,body=path.read_bytes(),content_type=content_type)
        page.route('**/local/xpeng/**',asset)
        page.set_content('<html><head><base href="https://ha.local/"><meta charset="utf-8"><style>body{margin:0;padding:8px;background:#141516}xpeng-vehicle-card{display:block;width:100%}</style></head><body><xpeng-vehicle-card></xpeng-vehicle-card></body></html>')
        page.add_script_tag(content=SCRIPT)
        page.evaluate("""states=>{
            const c=document.querySelector('xpeng-vehicle-card');
            c.setConfig({prefix:'my_xpeng',model:'G6',year:'2026',trim:'core_performance_awd',color:'arctic_white',interior:'dark_gray',theme:'dark',dashboard_layout:'cockpit',image_path:'/local/xpeng'});
            c.hass={states};
        }""",OFFLINE)
        card=page.locator('xpeng-vehicle-card')
        assert card.locator('.xd-home').count()==1
        assert card.locator('.xd-car-image').count()==1
        page.wait_for_function("""()=>{let im=document.querySelector('xpeng-vehicle-card').shadowRoot.querySelector('.xd-car-image');return im&&im.complete&&im.naturalWidth>800}""")
        assert card.locator('.xt-nav-row,.xt-shortcuts,.xs-sidebar,.xs-module').count()==0
        assert card.locator('.xd-details-nav button').count()==4
        assert card.locator('.xd-charge-active').count()==0
        assert card.locator('.xd-live-charge-data').count()==0
        assert 'Charging status unavailable' in card.locator('.xd-charge-panel').inner_text()
        assert '—' in card.locator('.xd-main-battery').inner_text()
        assert 'Last vehicle update' in card.locator('.xd-status').inner_text()
        assert 'Unavailable' in card.locator('.xd-status').inner_text()
        page.screenshot(path=str(OUT/f'{tag}-home-offline.png'),full_page=True)

        # New backend's exact keys: charging state must immediately change Home.
        page.evaluate("states=>document.querySelector('xpeng-vehicle-card').hass={states}",CHARGING)
        assert card.locator('.xd-charge-active').count()==1
        assert card.locator('.xd-live-charge-data').count()==1
        assert '62%' in card.locator('.xd-main-battery').inner_text()
        assert '391 km' in card.locator('.xd-main-battery').inner_text()
        assert '11.2 kW' in card.locator('.xd-live-charge-data').inner_text()
        assert '2h 15m' in card.locator('.xd-live-charge-data').inner_text()
        assert '18.7 kWh' in card.locator('.xd-live-charge-data').inner_text()
        assert 'Target 90%' in card.locator('.xd-charge-foot').inner_text()
        assert 'All doors closed' in card.locator('.xd-status').inner_text()
        assert 'Locked' in card.locator('.xd-status').inner_text()
        page.screenshot(path=str(OUT/f'{tag}-home-charging-TEST-DATA.png'),full_page=True)

        # Separate case: plugged in but not charging cannot show active green.
        idle=dict(CHARGING)
        idle['binary_sensor.my_xpeng_is_charging']=state('off')
        page.evaluate("states=>document.querySelector('xpeng-vehicle-card').hass={states}",idle)
        assert card.locator('.xd-charge-active').count()==0
        assert card.locator('.xd-live-charge-data').count()==0
        assert 'Plugged in · not charging' in card.locator('.xd-charge-panel').inner_text()

        # Avoid representing known-stale status as live charging.
        stale=dict(CHARGING)
        stale['sensor.my_xpeng_api_connection_status']=state('stale_vehicle_data')
        page.evaluate("states=>document.querySelector('xpeng-vehicle-card').hass={states}",stale)
        assert card.locator('.xd-charge-active').count()==0
        assert 'data stale' in card.locator('.xd-charge-panel').inner_text()

        # Legacy sensor names continue to resolve for installations upgrading UI.
        legacy={'sensor.my_xpeng_battery':state(48),'sensor.my_xpeng_estimated_range':state(270)}
        page.evaluate("states=>document.querySelector('xpeng-vehicle-card').hass={states}",legacy)
        assert '48%' in card.locator('.xd-main-battery').inner_text()
        assert '270 km' in card.locator('.xd-main-battery').inner_text()

        page.evaluate("states=>document.querySelector('xpeng-vehicle-card').hass={states}",CHARGING)
        def navigate(section):
            card.locator(f'.xd-details-nav button[data-view="{section}"]').click()
            assert card.locator(f'.xt-panel[data-xpeng-menu-panel="{section}"]').count()==1
        navigate('controls')
        assert card.locator('.xt-control-stage').count()==1
        assert card.locator('.xt-control-bar button:not([disabled])').count()==0
        page.screenshot(path=str(OUT/f'{tag}-controls.png'),full_page=True)
        card.locator('[data-view="tires"]').click()
        assert '—' in card.locator('.xt-values').inner_text()
        card.locator('[data-back]').click()
        navigate('climate')
        assert card.locator('.xt-climate-area .xp-cabin-svg').count()==1
        assert 'Steering wheel heating' in card.locator('.xt-seat-functions').inner_text()
        assert card.locator('.xt-seat-functions button:not([disabled])').count()==0
        page.screenshot(path=str(OUT/f'{tag}-climate.png'),full_page=True)
        card.locator('[data-back]').click()
        navigate('charging')
        assert card.locator('.xt-charger-image img').count()==1
        assert card.locator('.xt-charging-setting input').is_disabled()
        assert card.locator('.xt-port-button').is_disabled()
        page.screenshot(path=str(OUT/f'{tag}-charging.png'),full_page=True)
        card.locator('[data-back]').click()
        card.locator('[data-expand]').click()
        assert card.get_attribute('data-expanded') is not None
        card.locator('[data-expand]').click()
        assert card.get_attribute('data-expanded') is None
        if tag=='phone':
            size=page.evaluate("""()=>({viewport:innerWidth,scroll:document.body.scrollWidth})""")
            assert size['scroll']<=size['viewport']+3,size
        # Card editor exclusively changes colours and all cabin surfaces.
        page.evaluate("""()=>{const e=document.createElement('xpeng-vehicle-card-editor');document.body.append(e);e.setConfig({prefix:'my_xpeng',model:'G6',year:'2026',trim:'core_performance_awd',color:'arctic_white',interior:'dark_gray',theme:'dark',image_path:'/local/xpeng'});e.addEventListener('config-changed',ev=>document.querySelector('xpeng-vehicle-card').setConfig(ev.detail.config));}""")
        ed=page.locator('xpeng-vehicle-card-editor')
        ed.locator('[data-key="color"]').select_option('stellar_purple')
        page.wait_for_function("""()=>{let i=document.querySelector('xpeng-vehicle-card').shadowRoot.querySelector('.xd-car-image');return i&&i.src.endsWith('g6-2026-stellar_purple.webp')&&i.complete&&i.naturalWidth>800}""")
        ed.locator('[data-key="interior"]').select_option('light_gray')
        card.locator('.xd-details-nav button[data-view="climate"]').click()
        assert 'Light Gray' in card.locator('.xt-climate-area .xp-cabin-svg').get_attribute('aria-label')
        assert not errors,errors
        assert not missing,missing
        page.close()
    browser.close()
print('PASS: real backend mapping, charging focus states, unknown/stale/plugged, navigation, editor & responsive screens')
