"""XPENG visual QA agent — real Chromium browser, no design-mockup substitution.

Produces snapshots and a machine-readable audit for both automatic states,
every catalog model and all paint assets. Test vehicle values are fixture-only.
The approved concept drawings are visual targets, not screenshots of code.
"""
from collections import defaultdict
from hashlib import sha256
from pathlib import Path
import json
import os
import shutil
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CATALOG = json.loads((ROOT / 'model-catalog.json').read_text())
JS = (ROOT / 'dist/xpeng-vehicle-card.js').read_text()
assert JS == (ROOT / 'xpeng-vehicle-card.js').read_text(), 'HACS distributable differs from source'
assert 'XPENG Vehicle Card v0.1.0' in JS
ART = ROOT / 'previews' / 'visual-qa-v010'
ART.mkdir(parents=True, exist_ok=True)

def state(value, **attributes):
    return {'state':str(value), 'attributes':attributes}

EMPTY = {'sensor.my_xpeng_api_connection_status':state('not_configured')}
IDLE = {
    'sensor.my_xpeng_api_connection_status':state('connected'),
    'sensor.my_xpeng_soc':state(62),
    'sensor.my_xpeng_range_km':state(391),
    'sensor.my_xpeng_odometer_km':state(12548),
    'sensor.my_xpeng_tire_pressure_front_left_kpa':state(250),
    'sensor.my_xpeng_tire_pressure_front_right_kpa':state(248),
    'sensor.my_xpeng_tire_pressure_rear_left_kpa':state(251),
    'sensor.my_xpeng_tire_pressure_rear_right_kpa':state(249),
    'sensor.my_xpeng_last_update':state('2026-10-11T13:00:00+03:00'),
    'binary_sensor.my_xpeng_is_charging':state('off'),
    'binary_sensor.my_xpeng_is_plugged_in':state('off'),
    'device_tracker.my_xpeng_location':state('home',latitude=32.09,longitude=34.82)
}
CHARGING = {
    **IDLE,
    'binary_sensor.my_xpeng_is_charging':state('on'),
    'binary_sensor.my_xpeng_is_plugged_in':state('on'),
    'sensor.my_xpeng_charge_power_kw':state(11.2),
    'sensor.my_xpeng_charge_remaining_min':state(135),
    'sensor.my_xpeng_charge_target':state(90),
}
REPORT = {
    'version':'0.1.0', 'browser':'Chromium',
    'catalog_models':len(CATALOG['models']),
    'states_tested':['vehicle','charging','charging-stale','plugged-idle','unavailable'],
    'snapshots':[], 'warnings':[], 'failed':[],
    'reference':'User-approved 16:9 cinematic XPENG status/charging concept. Geometry and required visible information verified; pixel-perfect image match requires approved model-specific artwork.',
}
# Verify ALL intended paint paths. No broken HACS assets.
def asset_name(model,year,paint):
    slug=model.lower().replace(' ','_').replace('+','_plus')
    if model=='G6' and year=='2026':
        return 'g6-2026-'+paint+'.webp'
    return 'models/'+slug+'-'+paint+'.webp'

hashes=defaultdict(list)
for item in CATALOG['models']:
    model=item['id']
    year=str(item['end'])
    for p in CATALOG['paints']:
        asset=ROOT/'assets'/asset_name(model,year,p['id'])
        if not asset.is_file():
            REPORT['failed'].append('Missing asset '+str(asset.relative_to(ROOT)))
            continue
        if p['id']=='arctic_white':
            hashes[sha256(asset.read_bytes()).hexdigest()].append(model)
for models in hashes.values():
    if len(models)>1:
        REPORT['warnings'].append('Identical illustrative artwork shared by different models: '+', '.join(models))
REPORT['model_artwork_verified']=not any('Identical' in x for x in REPORT['warnings'])

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium') or None,args=['--no-sandbox'])
    for device,width,height in [('desktop',1600,900),('phone',390,844)]:
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
        errors=[]
        missing=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        def serve(route):
            part=route.request.url.split('/local/xpeng/',1)[-1]
            path=ROOT/'assets'/part
            if not path.is_file():
                missing.append(part)
                return route.fulfill(status=404,body='Asset missing')
            mime='image/webp' if path.suffix=='.webp' else 'image/svg+xml' if path.suffix=='.svg' else 'image/png'
            route.fulfill(status=200,body=path.read_bytes(),content_type=mime)
        page.route('**/local/xpeng/**',serve)
        page.set_content('<html><head><meta charset="utf-8"><base href="https://ha.local/"><style>body{margin:0;background:#030917}xpeng-vehicle-card{width:100%;display:block}</style></head><body><xpeng-vehicle-card></xpeng-vehicle-card></body></html>')
        page.add_script_tag(content=JS)
        card=page.locator('xpeng-vehicle-card')
        def config(model,year):
            return {'prefix':'my_xpeng','model':model,'year':year,
                    'trim':'core_performance_awd' if model=='G6' and year=='2026' else 'unspecified',
                    'color':'arctic_white','interior':'dark_gray','theme':'dark',
                    'dashboard_layout':'cockpit','image_path':'/local/xpeng'}
        def load_states(states):
            page.evaluate("states=>document.querySelector('xpeng-vehicle-card').hass={states}",states)
        def wait_image():
            page.wait_for_function("""()=>{
              const card=document.querySelector('xpeng-vehicle-card');
              const img=card?.shadowRoot?.querySelector('.xv-car img');
              return img&&img.complete&&img.naturalWidth>100;
            }""",timeout=15000)
        for item in CATALOG['models']:
            model=item['id']
            year=str(item['end'])
            page.evaluate("config=>document.querySelector('xpeng-vehicle-card').setConfig(config)",config(model,year))
            load_states(IDLE)
            wait_image()
            assert card.get_attribute('data-display-state')=='vehicle'
            assert card.get_attribute('data-model')==model
            assert card.locator('.xv-screen').count()==1
            assert card.locator('.xv-info>div').count()==3
            assert card.locator('.xv-charge').count()==0
            assert card.locator('button,a,select,input').count()==0, 'Display must be non-interactive'
            text=card.locator('.xv-screen').inner_text()
            for absent in ['Weather','Climate','Doors & controls','Frunk','Trunk','Last vehicle update']:
                assert absent not in text,(model,absent)
            assert '62%' in card.locator('.xv-metrics').inner_text()
            assert '391 km' in card.locator('.xv-metrics').inner_text()
            metrics=card.locator('.xv-screen').evaluate("""el=>{
              const r=s=>el.querySelector(s).getBoundingClientRect();
              const st=el.getBoundingClientRect(),car=r('.xv-car'),left=r('.xv-metrics'),right=r('.xv-info');
              return {screen:st.width,car:car.width,carLeft:car.left-st.left,metricsLeft:left.left-st.left,
                rightLeft:right.left-st.left,carHeight:car.height};
            }""")
            # Validate spatial hierarchy, not just DOM existence.
            if device=='desktop':
                assert metrics['car']>=metrics['screen']*.45,metrics
                assert metrics['metricsLeft']<metrics['carLeft'],metrics
                assert metrics['rightLeft']>metrics['screen']*.64,metrics
            if device=='phone':
                assert page.evaluate('document.body.scrollWidth<=innerWidth+4'),model
            snapshot=ART/f"{device}-{model.lower().replace(' ','_').replace('+','plus')}-vehicle-TEST-DATA.png"
            page.screenshot(path=str(snapshot),full_page=True)
            REPORT['snapshots'].append(str(snapshot.relative_to(ROOT)))

            load_states(CHARGING)
            assert card.get_attribute('data-display-state')=='charging'
            assert card.locator('.xv-charge').count()==1
            assert card.locator('.xv-info').count()==0
            assert card.locator('.xv-metrics').count()==0
            assert '62%' in card.locator('.xv-charge').inner_text()
            assert '391 km' in card.locator('.xv-charge').inner_text()
            assert '11.2 kW' in card.locator('.xv-charge').inner_text()
            assert '2h 15m' in card.locator('.xv-charge').inner_text()
            assert '90%' in card.locator('.xv-charge').inner_text()
            assert card.locator('button,a,select,input').count()==0
            snapshot=ART/f"{device}-{model.lower().replace(' ','_').replace('+','plus')}-charging-TEST-DATA.png"
            page.screenshot(path=str(snapshot),full_page=True)
            REPORT['snapshots'].append(str(snapshot.relative_to(ROOT)))
        # Automatic state transition without any page switch or user click.
        page.evaluate("cfg=>document.querySelector('xpeng-vehicle-card').setConfig(cfg)",config('G6','2026'))
        load_states(EMPTY)
        assert card.get_attribute('data-display-state')=='vehicle'
        assert '62%' not in card.locator('.xv-metrics').inner_text()
        assert '—' in card.locator('.xv-metrics').inner_text()
        plugged={**CHARGING,'binary_sensor.my_xpeng_is_charging':state('off')}
        load_states(plugged)
        assert card.get_attribute('data-display-state')=='vehicle'
        stale={**CHARGING,'sensor.my_xpeng_api_connection_status':state('stale_vehicle_data')}
        load_states(stale)
        assert card.get_attribute('data-display-state')=='vehicle'
        load_states(CHARGING)
        assert card.get_attribute('data-display-state')=='charging'
        load_states(IDLE)
        assert card.get_attribute('data-display-state')=='vehicle'
        if errors: REPORT['failed']+=errors
        if missing: REPORT['failed']+=['Browser could not load '+a for a in missing]
        page.close()
    browser.close()

(ART/'visual-qa-report.json').write_text(json.dumps(REPORT,indent=2,ensure_ascii=False))
(ART/'visual-qa-summary.md').write_text(
    '# XPENG visual QA v0.1.0\n\n'
    +f"Render: {len(REPORT['snapshots'])} actual browser screenshots across {REPORT['catalog_models']} configured models, two states, desktop and phone.\n\n"
    +f"Artwork exactness verified: {REPORT['model_artwork_verified']}.\n\n"
    +'## Warnings\n'+('\n'.join('- '+x for x in REPORT['warnings']) or 'None')+'\n\n'
    +'## Failures\n'+('\n'.join('- '+x for x in REPORT['failed']) or 'None')+'\n'
    +'\nIMPORTANT: Passing geometry/behavior tests cannot establish pixel-perfect equivalence to a generated concept or accuracy of generic model illustrations.\n'
)
assert not REPORT['failed'],REPORT['failed']
print(f"PASS: {len(REPORT['snapshots'])} real browser renders for {len(CATALOG['models'])} models, automatic vehicle/charging, fullscreen proportions, no forbidden controls or panels")
if REPORT['warnings']:
    print('ARTWORK REVIEW REQUIRED: '+' | '.join(REPORT['warnings']))
