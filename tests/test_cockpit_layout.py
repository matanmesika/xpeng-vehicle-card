"""XPENG screen flow replicates the Tesla-style *user interaction structure*.

Original implementation, images and business logic. No Tesla source/assets.
Browser shots prove it is not a concept render. Remote commands stay disabled.
"""
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
JS=(ROOT/'dist/xpeng-vehicle-card.js').read_text(encoding='utf-8')
assert JS==(ROOT/'xpeng-vehicle-card.js').read_text(encoding='utf-8')
assert 'localStorage' not in JS
assert 'callService(' not in JS and '.call_service(' not in JS
assert 'v0.8.0-alpha.1' in JS
PREV=ROOT/'previews'/'tesla-flow-v080'
PREV.mkdir(parents=True,exist_ok=True)
STATES={'sensor.my_xpeng_api_connection_status':{'state':'not_configured','attributes':{}}}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium') or None,args=['--no-sandbox'])
 for device,w,h in (('desktop',1200,900),('phone',390,844)):
  page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
  errors=[]
  missing=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  def asset(route):
   rel=route.request.url.split('/local/xpeng/',1)[-1]
   path=ROOT/'assets'/rel
   if not path.exists():
    missing.append(rel)
    return route.fulfill(status=404,body='no image')
   ct='image/webp' if path.suffix=='.webp' else 'image/png' if path.suffix=='.png' else 'image/svg+xml'
   route.fulfill(status=200,body=path.read_bytes(),content_type=ct)
  page.route('**/local/xpeng/**',asset)
  page.set_content('<html><head><base href="https://ha.local/"><meta charset="utf-8"><style>body{background:#161719;margin:0;padding:12px}xpeng-vehicle-card{display:block;width:100%}</style></head><body><xpeng-vehicle-card></xpeng-vehicle-card></body></html>')
  page.add_script_tag(content=JS)
  page.evaluate("""states=>{
   const c=document.querySelector('xpeng-vehicle-card');
   c.setConfig({prefix:'my_xpeng',model:'G6',year:'2026',trim:'core_performance_awd',color:'arctic_white',interior:'dark_gray',theme:'dark',dashboard_layout:'cockpit',image_path:'/local/xpeng'});
   c.hass={states};
  }""",STATES)
  c=page.locator('xpeng-vehicle-card')
  assert c.get_attribute('data-cockpit') is not None
  assert c.locator('.xt-card').count()==1
  assert c.locator('.xt-car-stage img').count()==1
  page.wait_for_function("""()=>{let im=document.querySelector('xpeng-vehicle-card').shadowRoot.querySelector('.xt-car-stage img');return im&&im.complete&&im.naturalWidth>800}""")
  assert c.locator('.xs-sidebar,.xs-rail,.xs-module,.xs-hero').count()==0
  assert c.locator('.xt-shortcuts button').count()==4
  assert c.locator('.xt-shortcuts button').first.is_disabled()
  assert c.locator('.xt-nav-row').count()==4
  assert 'Not connected' in c.locator('.xt-footnote').inner_text()
  assert '—' in c.locator('.xt-head-details').inner_text()
  page.screenshot(path=str(PREV/f'{device}-home.png'),full_page=True)
  def enter(menu):
   c.locator(f'.xt-nav-row[data-view="{menu}"]').click()
   assert c.locator(f'.xt-panel[data-tesla-style-panel="{menu}"]').count()==1
  enter('controls')
  assert c.locator('.xt-control-stage').count()==1
  assert c.locator('.xt-control-bar button:not([disabled])').count()==0
  assert c.locator('.xt-car-zones button:not([disabled])').count()==0
  page.screenshot(path=str(PREV/f'{device}-controls.png'),full_page=True)
  c.locator('button[data-view="tires"]').click()
  assert c.locator('.xt-panel[data-tesla-style-panel="tires"]').count()==1
  assert '—' in c.locator('.xt-values').inner_text()
  c.locator('button[data-back]').click()
  enter('climate')
  assert c.locator('.xt-climate-area svg.xp-cabin-svg').count()==1
  assert c.locator('.xt-seat-functions button:not([disabled])').count()==0
  assert 'Steering wheel heating' in c.locator('.xt-seat-functions').inner_text()
  page.screenshot(path=str(PREV/f'{device}-climate.png'),full_page=True)
  c.locator('button[data-back]').click()
  enter('charging')
  assert c.locator('.xt-charger-image img').count()==1
  assert c.locator('.xt-charging-setting input').is_disabled()
  assert c.locator('.xt-port-button').is_disabled()
  page.screenshot(path=str(PREV/f'{device}-charging.png'),full_page=True)
  c.locator('button[data-back]').click()
  assert c.locator('.xt-landing').count()==1
  c.locator('button[data-expand]').click()
  assert c.get_attribute('data-expanded') is not None
  c.locator('button[data-expand]').click()
  assert c.get_attribute('data-expanded') is None
  if device=='phone':
   metrics=page.evaluate("""()=>({viewport:innerWidth,scroll:document.body.scrollWidth,card:document.querySelector('xpeng-vehicle-card').getBoundingClientRect().width})""")
   assert metrics['scroll']<=metrics['viewport']+3,metrics
  assert not errors,errors
  assert not missing,missing
  page.close()
 browser.close()
print('PASS: compact landing + three vehicle panels, no sidebar, no fake controls, browser screenshots')
