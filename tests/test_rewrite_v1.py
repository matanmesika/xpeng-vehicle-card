"""Chromium acceptance for XPENG Dashboard v0.1.1 (frontend only).

The injected values below are *test fixtures* and must never be hardcoded in
the actual card. The vehicle integration is outside the scope of this test.
"""
from pathlib import Path
import hashlib
import shutil
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = (ROOT / 'dist/xpeng-vehicle-card.js').read_text(encoding='utf-8')
assert SCRIPT == (ROOT / 'src/xpeng-vehicle-card.js').read_text(encoding='utf-8')
assert 'Dashboard v0.1.1' in SCRIPT
assert 'localStorage' not in SCRIPT and 'callService(' not in SCRIPT and 'fetch(' not in SCRIPT
OUT = ROOT / 'previews' / 'dashboard-v011'
OUT.mkdir(parents=True, exist_ok=True)
# Release gate: do not silently validate a placeholder SVG or an outdated image.
EXPECTED_ART = ROOT / 'dist/assets/vehicles/g6/2026/core_performance_awd/arctic_white.webp'
assert EXPECTED_ART.is_file(), (
    f'Missing packaged G6 2026 preview artwork: {EXPECTED_ART}. '
    'Add model-year imagery or mark unverified styling before publishing.'
)


def sensor(value):
    return {'state': str(value), 'attributes': {}}


OFFLINE = {'sensor.my_xpeng_api_connection_status': sensor('not_configured')}
BASE = {
    'sensor.my_xpeng_api_connection_status': sensor('connected'),
    'sensor.my_xpeng_soc': sensor(62),
    'sensor.my_xpeng_range_km': sensor(391),
    'sensor.my_xpeng_odometer_km': sensor(12548),
    'sensor.my_xpeng_charge_target': sensor(90),
    'sensor.my_xpeng_charge_power_kw': sensor(11.2),
    'sensor.my_xpeng_charge_remaining_min': sensor(135),
    'sensor.my_xpeng_tire_pressure_front_left_kpa': sensor(250),
    'sensor.my_xpeng_tire_pressure_front_right_kpa': sensor(250),
    'sensor.my_xpeng_tire_pressure_rear_left_kpa': sensor(250),
    'sensor.my_xpeng_tire_pressure_rear_right_kpa': sensor(250),
    'device_tracker.my_xpeng_location': sensor('Ramat Gan, Israel'),
    'binary_sensor.my_xpeng_is_charging': sensor('off'),
}
CHARGING = {**BASE, 'binary_sensor.my_xpeng_is_charging': sensor('on')}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=shutil.which('chromium') or None, args=['--no-sandbox'])
    for tag, width, height in [('desktop', 1536, 864), ('phone', 390, 844)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, device_scale_factor=1)
        errors, missing = [], []
        page.on('pageerror', lambda e: errors.append(str(e)))

        def serve_asset(route):
            url = route.request.url
            if '/local/xpeng/' in url:
                relative=url.split('/local/xpeng/',1)[-1]
                file=ROOT/'dist'/'assets'/relative
            else:
                relative=url.split('/hacsfiles/xpeng-vehicle-card/',1)[-1]
                file=ROOT/'dist'/relative
            if not file.is_file():
                missing.append(str(file))
                return route.fulfill(status=404, body='Missing artwork')
            mime = 'image/webp' if file.suffix == '.webp' else 'image/png' if file.suffix == '.png' else 'image/svg+xml'
            route.fulfill(status=200, body=file.read_bytes(), content_type=mime)

        page.route('**/local/xpeng/**', serve_asset)
        page.route('**/hacsfiles/xpeng-vehicle-card/**', serve_asset)
        assert (ROOT / 'dist/assets/xpeng-approved-lakeside-background.webp').is_file()
        from hashlib import sha256
        original_bg=ROOT/'dist/assets/xpeng-approved-lakeside-background.webp'
        assert original_bg.stat().st_size == 255854
        assert sha256(original_bg.read_bytes()).hexdigest() == 'c0db38e9cd1c1827c53005c874af420563034258eb25444c1698d978277cf1ef'

        page.set_content(
            '<!doctype html><html><head><base href="https://ha.local/"><meta charset="utf-8">'
            '<style>body{margin:0;background:#030e1b;padding:0}xpeng-vehicle-card{display:block;width:100%}</style>'
            '</head><body><xpeng-vehicle-card></xpeng-vehicle-card></body></html>')
        page.add_script_tag(content=SCRIPT)
        page.evaluate("""states => {
            const card = document.querySelector('xpeng-vehicle-card');
            card.setConfig({
                prefix:'my_xpeng',model:'G6',year:'2026',trim:'core_plus_rwd',
                color:'arctic_white'
            });
            card.hass = {states};
        }""", OFFLINE)

        host = page.locator('xpeng-vehicle-card')
        assert host.locator('.xp-overview').count() == 1
        assert host.locator('.xp-brand').is_visible()
        assert '/hacsfiles/xpeng-vehicle-card/xpeng-approved-lakeside-background.webp' in host.locator('.xp-night-photo').get_attribute('style')

        assert host.locator('.xp-charge').count() == 0
        assert '—' in host.locator('.xp-soc').inner_text()
        assert host.locator('.xp-status-panel').count() == 1
        assert host.locator('.xt-panel,.xt-nav-row,.xd-details-nav,.xt-climate-area').count() == 0
        page.wait_for_function("""() => {
            const image = document.querySelector('xpeng-vehicle-card').shadowRoot.querySelector('.xp-car');
            return image && image.complete && image.naturalWidth >= 350;
        }""")
        page.screenshot(path=str(OUT / f'{tag}-overview-UNAVAILABLE.png'), full_page=True)

        # Only the overview: no buttons to enter old detailed control pages.
        page.evaluate("states => document.querySelector('xpeng-vehicle-card').hass = {states}", BASE)
        assert host.locator('.xp-overview').count() == 1
        assert host.locator('[data-view],.xp-clock').count() == 0

        # The background is a single packaged raster file, with no rendering differences
        # across views. Check the *actual Chrome pixels*, not just matching CSS strings.
        # Hide all interactive/vehicle overlays before comparing the same background area.
        def backdrop_snapshot(states, mode):
            page.evaluate("states => document.querySelector('xpeng-vehicle-card').hass = {states}", states)
            layout = page.evaluate("""() => {
                const root = document.querySelector('xpeng-vehicle-card').shadowRoot;
                const photo = root.querySelector('.xp-night-photo');
                const style = getComputedStyle(photo);
                const rect = photo.getBoundingClientRect();
                return {
                  url: style.backgroundImage, size: style.backgroundSize,
                  position: style.backgroundPosition, repeat: style.backgroundRepeat,
                  bounds: [rect.x, rect.y, rect.width, rect.height]
                };
            }""")
            assert 'xpeng-approved-lakeside-background.webp' in layout['url'], layout
            assert layout['size'] == 'cover', layout
            assert layout['position'] == '50% 50%', layout
            page.evaluate("""() => {
                const root = document.querySelector('xpeng-vehicle-card').shadowRoot;
                const layer = document.createElement('style');
                layer.textContent = '.xp-scene > :not(.xp-night-photo){visibility:hidden!important;}';
                root.append(layer);
            }""")
            photo_png = host.screenshot(path=str(OUT / f'{tag}-background-{mode}-ISOLATED.png'))
            return (layout, hashlib.sha256(photo_png).hexdigest())

        overview_layout, overview_pixels = backdrop_snapshot(BASE, 'overview')
        charging_layout, charging_pixels = backdrop_snapshot(CHARGING, 'charging')
        assert overview_layout == charging_layout, (overview_layout, charging_layout)
        assert overview_pixels == charging_pixels, (
            f'Dashboard background changed with charging state: {overview_pixels} != {charging_pixels}')
        # Restore the normal overview scene before the remaining assertions.
        page.evaluate("states => document.querySelector('xpeng-vehicle-card').hass = {states}", BASE)
        assert '62%' in host.locator('.xp-overview-stat').inner_text()
        assert '391 km' in host.locator('.xp-overview-stat').inner_text()
        assert '12,548 km' in host.locator('.xp-status-panel').inner_text()
        assert '2.5 bar' in host.locator('.xp-status-panel').inner_text()
        assert 'Ramat Gan, Israel' in host.locator('.xp-status-panel').inner_text()
        # Info stays inline with network status; only the last update is revealed.
        wifi=host.locator('.xp-header-right .xp-wifi')
        info=host.locator('.xp-header-right [data-meta-toggle]')
        assert wifi.count()==1 and info.count()==1
        assert 'Connected' in wifi.inner_text()
        w=wifi.bounding_box()
        b=info.bounding_box()
        assert abs((w['y']+w['height']/2)-(b['y']+b['height']/2))<=5
        info.click()
        popup=host.locator('.xp-header-right .xp-meta-popover')
        assert popup.is_visible()
        assert 'Last vehicle update' in popup.inner_text()
        assert popup.locator('small').count()==1
        assert popup.locator('strong').count()==1
        assert popup.locator('.xp-cabin-mini').count()==0
        p=popup.bounding_box()
        assert p['x']>=0 and p['x']+p['width']<=width+2
        host.screenshot(path=str(OUT / f'{tag}-header-info-LAST-UPDATE.png'))
        info.click()
        assert host.locator('.xp-meta-popover').count()==0

        page.screenshot(path=str(OUT / f'{tag}-overview-DEMO.png'), full_page=True)

        # The real charging binary entity switches the entire scene, not a secondary details page.
        page.evaluate("states => document.querySelector('xpeng-vehicle-card').hass = {states}", CHARGING)
        assert host.locator('.xp-charge').count() == 1
        assert host.locator('.xp-overview').count() == 0
        assert host.locator('.xp-brand').is_visible()
        assert host.locator('.xp-charge-card').count() == 1
        assert 'Charging now' in host.locator('.xp-charge-heading').inner_text()
        assert '62%' in host.locator('.xp-charge-card').inner_text()
        assert '11.2 kW' in host.locator('.xp-charge-card').inner_text()
        assert '2h 15m' in host.locator('.xp-charge-card').inner_text()
        assert '90 %' in host.locator('.xp-charge-card').inner_text()
        page.screenshot(path=str(OUT / f'{tag}-charging-DEMO.png'), full_page=True)

        # Home and clock are removed from the header. Only charging telemetry changes the view.
        assert host.locator('[data-view],.xp-clock,.xp-head-separator').count() == 0
        assert host.locator('[data-expand]').count() == 0
        page.evaluate("""() => {
            const card=document.querySelector('xpeng-vehicle-card');
            const data={...card.hass.states};
            data['sensor.my_xpeng_soc']={state:'68'};
            card.hass={states:data};
        }""")
        assert host.locator('.xp-charge').count() == 1

        # Idle, paused, plugged-only and unavailable charging status always show Vehicle status.
        for state in ('off','paused','plugged_in','unavailable'):
            page.evaluate("""state => {
                const card=document.querySelector('xpeng-vehicle-card');
                card.hass={states:{...card.hass.states,
                  'binary_sensor.my_xpeng_is_charging':{state}}};
            }""",state)
            assert host.locator('.xp-overview').count() == 1
            assert host.locator('.xp-charge').count() == 0
        # Strict sensor mapping permits other integrations, with charge-state in an attribute.
        page.evaluate("""() => {
            const card=document.querySelector('xpeng-vehicle-card');
            card.setConfig({prefix:'my_xpeng',model:'G6',year:'2026',trim:'core_plus_rwd',
               color:'arctic_white',
               entities:{charging:'select.external_ev|charging_state'}});
            card.hass={states:{...card.hass.states,
               'select.external_ev':{state:'ready',attributes:{charging_state:'charging'}}}};
        }""")
        assert host.locator('.xp-charge').count() == 1
        page.evaluate("""() => {
            const card=document.querySelector('xpeng-vehicle-card');
            card.hass={states:{...card.hass.states,
               'select.external_ev':{state:'ready',attributes:{charging_state:'idle'}}}};
        }""")
        assert host.locator('.xp-overview').count() == 1
        # Restore default sensor mapping before testing unavailable values.
        page.evaluate("""states => {
            const card=document.querySelector('xpeng-vehicle-card');
            card.setConfig({prefix:'my_xpeng',model:'G6',year:'2026',trim:'core_plus_rwd',
               color:'arctic_white'});
            card.hass={states};
        }""",BASE)

        # User-selected Tire pressure replaces the entire central vehicle with overhead view.
        page.evaluate("states => document.querySelector('xpeng-vehicle-card').hass={states}",BASE)
        background_before=host.locator('.xp-night-photo').get_attribute('style')
        host.locator('.xp-info-row[data-tire-toggle]').click()
        tires=host.locator('.xp-tire-screen')
        assert tires.is_visible()
        assert host.locator('img[data-car-art]').count()==0
        assert tires.locator('.xp-top-car').count()==1
        for k in ('tire_fl','tire_fr','tire_rl','tire_rr'):
            assert tires.locator('[data-wheel="'+k+'"]').count()==1
        assert tires.inner_text().count('2.5')>=4
        assert host.locator('.xp-night-photo').get_attribute('style')==background_before
        host.screenshot(path=str(OUT / f'{tag}-tires-DEMO.png'))
        tires.locator('button[data-tire-toggle]').click()
        assert host.locator('.xp-tire-screen').count()==0
        assert host.locator('img[data-car-art]').count()==1

        # Missing data stays unavailable: zero and screenshot demo values are never substituted.
        page.evaluate("states => document.querySelector('xpeng-vehicle-card').hass = {states}", {
            'binary_sensor.my_xpeng_is_charging': sensor('on'),
            'sensor.my_xpeng_soc': sensor('unavailable')
        })
        assert '—' in host.locator('.xp-charge-card .xp-soc').inner_text()
        assert '11.2 kW' not in host.locator('.xp-charge-card').inner_text()

        # No in-card Full Screen button in either screen.
        assert host.locator('[data-expand]').count() == 0

        if tag == 'phone':
            dimensions = page.evaluate('''() => ({
                viewport: innerWidth, scroll: document.documentElement.scrollWidth
            })''')
            assert dimensions['scroll'] <= dimensions['viewport'] + 3, dimensions

        # Appearance editing exists only in the dashboard configuration editor.
        page.evaluate("""() => {
            const editor=document.createElement('xpeng-vehicle-card-editor');
            document.body.append(editor);
            editor.setConfig({prefix:'my_xpeng',model:'G6',year:'2026',trim:'core_plus_rwd',
                              color:'arctic_white'});
        }""")
        editor = page.locator('xpeng-vehicle-card-editor')
        assert editor.locator('[data-key="color"]').count() == 1
        assert editor.locator('[data-key="shape_family"]').count() == 0
        assert editor.locator('[data-key="top_image"]').count() == 1
        assert editor.locator('[data-key="interior"]').count() == 1
        assert editor.locator('[data-entity="soc"]').count() == 1
        assert editor.locator('[data-entity="charging"]').count() == 1
        assert editor.locator('[data-entity="tire_fl"]').count() == 1
        assert host.locator('[data-key="color"],[data-entity]').count() == 0

        # Browser-test representative generations; all use the same scenic bitmap,
        # with a different car render and interior selected in the card editor.
        catalogue=[
            ('G6','2026','core_plus_rwd','arctic_white','light_gray','highest-trim-preview'),
            ('G9','2026','long_range_rwd','graphite_gray','coffee','highest-trim-preview'),
            ('X9','2026','unspecified','silver_frost','light_gray','model-family'),
            ('G7','2025','unspecified','midnight_black','dark_gray','model-family'),
            ('Next P7','2026','unspecified','arctic_white','dark_gray','model-family'),
            ('P7','2020','unspecified','stellar_purple','dark_gray','model-family')
        ]
        for model,year,trim,paint,cabin,tier in catalogue:
            page.evaluate("""arg => {
                const [v,states]=arg;
                const card=document.querySelector('xpeng-vehicle-card');
                card.setConfig({prefix:'my_xpeng',model:v[0],year:v[1],
                  trim:v[2],color:v[3],interior:v[4],image_path:'/local/xpeng'});
                card.hass={states};
            }""",[[model,year,trim,paint,cabin],BASE])
            page.wait_for_function("""() => {
                const img=document.querySelector('xpeng-vehicle-card')
                  .shadowRoot.querySelector('img[data-car-art]');
                return img && img.complete && img.naturalWidth>=250;
            }""")
            image=host.locator('img[data-car-art]')
            assert image.get_attribute('data-art-tier')==tier,(model,year,tier)
            assert image.get_attribute('data-fallback-used') is None
            assert 'xpeng-approved-lakeside-background.webp' in host.locator('.xp-night-photo').get_attribute('style')
            assert host.locator('.xp-overview').count()==1
            if tag=='desktop':
                safe='-'.join((model,year,paint)).lower().replace(' ','_')
                host.screenshot(path=str(OUT/f'catalogue-{safe}.png'))

        # Render invariant: model+paint chooses the same hero image regardless of year/trim.
        for model,old_year,old_trim,new_year,new_trim,paint in [
            ('G6','2023','standard_range_rwd','2026','core_plus_rwd','arctic_white'),
            ('G9','2022','standard_range_rwd','2026','performance_awd','graphite_gray')]:
            images=[]
            for year,trim in [(old_year,old_trim),(new_year,new_trim)]:
                page.evaluate("""arg => {
                  const [model,year,trim,paint,states]=arg;
                  const card=document.querySelector('xpeng-vehicle-card');
                  card.setConfig({prefix:'my_xpeng',model,year,trim,color:paint,image_path:'/local/xpeng'});
                  card.hass={states};
                }""",[model,year,trim,paint,BASE])
                image=host.locator('img[data-car-art]')
                assert image.get_attribute('data-art-tier')=='highest-trim-preview'
                images.append(image.get_attribute('src'))
            assert images[0]==images[1], (model,images)

        assert not errors, errors
        # Release gate: all model/year/colour assets must exist before release.
        assert not missing, f'MISSING MODEL-YEAR ART: {missing}'
        page.close()
    browser.close()
print('PASS: Dashboard v0.1.1 2-screen Chromium acceptance on desktop and phone')
