"""Browser test for updated main visuals, full-screen and unavailable readings."""
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
script=(ROOT/'dist/xpeng-vehicle-card.js').read_text()
states={f'sensor.my_xpeng_{k}':{'state':'unavailable','attributes':{}} for k in ('battery','estimated_range','charging_power')}
states['sensor.my_xpeng_api_connection_status']={'state':'not_configured','attributes':{}}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium') or None,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1280,'height':900})
 page.route('https://ha.local/local/xpeng/**',lambda r:r.fulfill(status=200,body=(ROOT/'assets'/r.request.url.split('/local/xpeng/')[-1]).read_bytes(),content_type='image/webp' if r.request.url.endswith('.webp') else 'image/png'))
 page.set_content('<html><head><base href="https://ha.local/"><style>body{background:#0b1014;margin:0;padding:12px}xpeng-vehicle-card{display:block;max-width:880px;margin:auto}</style></head><body><xpeng-vehicle-card></xpeng-vehicle-card></body></html>')
 page.add_script_tag(content=script)
 page.evaluate('states=>{let e=document.querySelector("xpeng-vehicle-card");e.setConfig({prefix:"my_xpeng",model:"G6",year:"2026",trim:"core_plus_rwd",color:"arctic_white",interior:"dark_gray",theme:"dark",image_path:"/local/xpeng"});e.hass={states};}',states)
 c=page.locator('xpeng-vehicle-card')
 def view(v):
  page.evaluate('v=>{let e=document.querySelector("xpeng-vehicle-card");e._view=v;e.render()}',v)
  assert c.locator('.hero').get_attribute('data-hero-view')==v
 view('overview');assert c.locator('.hero img').count()==1
 view('charging');assert c.locator('.xp-charge-visual').count()==1
 assert '—' in c.locator('.xp-charge-visual').inner_text()
 view('climate');assert c.locator('.hero .xp-cabin-svg').count()==1
 view('interior');assert c.locator('.hero .xp-cabin-svg').count()==1
 view('controls');assert c.locator('.hero .xp-top-car').count()==1
 assert c.locator('.hero .xp-pin-label').count()==4
 view('tires');assert c.locator('.hero .xp-pin-label').count()==4
 view('location');assert c.locator('.hero .xp-pin-visual').count()==1
 view('overview');c.locator('button[data-expand]').click()
 assert c.get_attribute('data-expanded') is not None
 bbox=c.bounding_box();assert bbox and bbox['width']>=1180 and bbox['height']>=840,bbox
 c.locator('button[data-expand]').click()
 assert c.get_attribute('data-expanded') is None
 browser.close()
print('PASS: page illustrations and fullscreen')
