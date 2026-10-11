"""New v1 vehicle-first dashboard regression.

Uses the actual, production-bundled JavaScript and real local illustration assets.
No fake cloud API readings or enabled remote actions.
"""
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
SCRIPT=(ROOT/'dist/xpeng-vehicle-card.js').read_text()
assert SCRIPT==(ROOT/'xpeng-vehicle-card.js').read_text()
assert 'XPENG Vehicle Card v1.0.0-alpha.1' in SCRIPT
assert 'localStorage' not in SCRIPT and 'callService(' not in SCRIPT and 'fetch(' not in SCRIPT
assert '.xs-sidebar' not in SCRIPT and 'studioHeader(' not in SCRIPT
OUT=ROOT/'previews'/'rewrite-v1'
OUT.mkdir(parents=True,exist_ok=True)
HA={'sensor.my_xpeng_api_connection_status':{'state':'not_configured','attributes':{}}}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium') or None,args=['--no-sandbox'])
 for tag,w,h in [('desktop',1200,900),('phone',390,844)]:
  page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
  errors=[];missing=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  def image(route):
   f=ROOT/'assets'/route.request.url.split('/local/xpeng/',1)[-1]
   if not f.exists():missing.append(str(f));return route.fulfill(status=404,body='Image unavailable')
   route.fulfill(status=200,body=f.read_bytes(),content_type='image/webp' if f.suffix=='.webp' else 'image/png' if f.suffix=='.png' else 'image/svg+xml')
  page.route('**/local/xpeng/**',image)
  page.set_content('<html><head><base href="https://ha.local/"><meta charset="utf-8"><style>body{margin:0;padding:8px;background:#141516}xpeng-vehicle-card{display:block;width:100%}</style></head><body><xpeng-vehicle-card></xpeng-vehicle-card></body></html>')
  page.add_script_tag(content=SCRIPT)
  page.evaluate("""states=>{
   const card=document.querySelector('xpeng-vehicle-card');
   card.setConfig({prefix:'my_xpeng',model:'G6',year:'2026',trim:'core_performance_awd',color:'arctic_white',interior:'dark_gray',theme:'dark',dashboard_layout:'cockpit',image_path:'/local/xpeng'});
   card.hass={states};
  }""",HA)
  card=page.locator('xpeng-vehicle-card')
  assert card.locator('.xt-card').count()==1
  assert card.locator('.xt-landing').count()==1
  assert card.locator('.xt-nav-row').count()==4
  assert card.locator('.xt-shortcuts button').count()==4
  assert card.locator('.xt-shortcuts button').first.is_disabled()
  page.wait_for_function("""()=>{const img=document.querySelector('xpeng-vehicle-card').shadowRoot.querySelector('.xt-car-stage img');return img && img.complete && img.naturalWidth>800}""")
  assert '—' in card.locator('.xt-head-details').inner_text()
  assert 'Not connected' in card.locator('.xt-footnote').inner_text()
  assert card.locator('[data-view="appearance"],[data-color],[data-interior]').count()==0
  page.screenshot(path=str(OUT/f'{tag}-home.png'),full_page=True)
  def navigate(section):
   card.locator('.xt-nav-row[data-view="'+section+'"]').click()
   assert card.locator('.xt-panel[data-xpeng-menu-panel="'+section+'"]').count()==1
  navigate('controls')
  assert card.locator('.xt-control-stage').count()==1
  assert card.locator('.xt-car-zones button:not([disabled])').count()==0
  assert card.locator('.xt-control-bar button:not([disabled])').count()==0
  page.screenshot(path=str(OUT/f'{tag}-controls.png'),full_page=True)
  card.locator('[data-view="tires"]').click()
  assert '—' in card.locator('.xt-values').inner_text()
  card.locator('[data-back]').click()
  navigate('climate')
  assert card.locator('.xt-climate-area .xp-cabin-svg').count()==1
  dims=card.locator('.xt-climate-area').evaluate("""el=>{const a=el.getBoundingClientRect();const b=el.querySelector('svg.xp-cabin-svg').getBoundingClientRect();return {parentHeight:a.height,svgHeight:b.height,parentWidth:a.width,svgWidth:b.width}}""")
  assert dims['svgHeight']<=dims['parentHeight']+2,dims
  assert dims['svgWidth']<=dims['parentWidth']+2,dims
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
  navigate('location')
  assert 'Location unavailable' in card.locator('.xt-location-map').inner_text()
  card.locator('[data-back]').click()
  card.locator('[data-expand]').click()
  assert card.get_attribute('data-expanded') is not None
  card.locator('[data-expand]').click()
  assert card.get_attribute('data-expanded') is None
  if tag=='phone':
   sizes=page.evaluate("""()=>({w:innerWidth,scroll:document.body.scrollWidth})""")
   assert sizes['scroll']<=sizes['w']+3,sizes
  # Same editorial configuration drives car appearance across all devices.
  page.evaluate("""()=>{const e=document.createElement('xpeng-vehicle-card-editor');document.body.append(e);e.setConfig({prefix:'my_xpeng',model:'G6',year:'2026',trim:'core_performance_awd',color:'arctic_white',interior:'dark_gray',theme:'dark',image_path:'/local/xpeng'});e.addEventListener('config-changed',ev=>document.querySelector('xpeng-vehicle-card').setConfig(ev.detail.config));}""")
  editor=page.locator('xpeng-vehicle-card-editor')
  editor.locator('[data-key="color"]').select_option('stellar_purple')
  page.wait_for_function("""()=>{let i=document.querySelector('xpeng-vehicle-card').shadowRoot.querySelector('.xt-car-stage img');return i&&i.src.endsWith('g6-2026-stellar_purple.webp')&&i.complete&&i.naturalWidth>800}""")
  editor.locator('[data-key="interior"]').select_option('light_gray')
  card.locator('.xt-nav-row[data-view="climate"]').click()
  assert 'Light Gray' in card.locator('.xt-climate-area .xp-cabin-svg').get_attribute('aria-label')
  assert not errors,errors
  assert not missing,missing
  page.close()
 browser.close()
print('PASS: independent clean XPENG v1 UI, vehicle-first navigation flow, editor-only paint, responsive snapshots, API safety')
