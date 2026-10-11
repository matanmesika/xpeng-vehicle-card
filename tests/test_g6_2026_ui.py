"""Browser regression tests for G6 2026 facelift trim/color selection.
The test data is synthetic and never claimed to be live XPENG telemetry.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, shutil

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=(ROOT/'dist/xpeng-vehicle-card.js').read_text()
vals={
'sensor.my_xpeng_vehicle_model':'G6',
'sensor.my_xpeng_vehicle_name':'XPENG G6',
'sensor.my_xpeng_api_connection_status':'not_configured',
'sensor.my_xpeng_battery':'unknown',
'sensor.my_xpeng_estimated_range':'unknown',
}
states={k:{'entity_id':k,'state':v,'attributes':{}} for k,v in vals.items()}

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium') or None,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':420,'height':940},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
 page.route('https://ha.local/local/xpeng/**',lambda route: route.fulfill(
  status=200,body=(ROOT/'assets'/route.request.url.split('/')[-1]).read_bytes(),
  content_type=('image/webp' if route.request.url.endswith('.webp') else 'image/png' if route.request.url.endswith('.png') else 'image/svg+xml')))
 page.goto('https://ha.local/',wait_until='domcontentloaded') if False else None
 page.set_content('<html><head><base href="https://ha.local/"><meta charset="utf-8"><style>body{background:#0c0d0e;margin:0;padding:0}xpeng-vehicle-card{display:block;max-width:420px;margin:auto}</style></head><body><xpeng-vehicle-card></xpeng-vehicle-card></body></html>')
 page.add_script_tag(content=SCRIPT)
 page.evaluate('states => { let el=document.querySelector("xpeng-vehicle-card");el.setConfig({prefix:"my_xpeng",model:"G6",year:"2026",trim:"core_plus_rwd",color:"arctic_white",theme:"dark",image_path:"/local/xpeng"});el.hass={states}; }',states)
 scope=page.locator('xpeng-vehicle-card')
 page.wait_for_timeout(300)
 def current_image():
  return page.evaluate('() => {let im=document.querySelector("xpeng-vehicle-card").shadowRoot.querySelector(".hero img");return {src:im.getAttribute("src"),loaded:im.complete&&im.naturalWidth>0}}')
 def wait_for_art(filename):
  # Events update the image asynchronously: only accept the requested new asset.
  page.wait_for_function("""file => {
   const c = document.querySelector('xpeng-vehicle-card');
   const im = c?.shadowRoot?.querySelector('.hero img');
   return !!im && im.getAttribute('src')?.endsWith(file) && im.complete && im.naturalWidth > 0;
  }""", filename, timeout=15000)
 wait_for_art('g6-2026-arctic_white.webp')
 assert current_image()['loaded'],current_image()
 assert 'XPENG API not connected' in scope.locator('.disconnected-note').inner_text()
 page.screenshot(path=str(ROOT/'previews/g6-2026-white-home.png'),full_page=True)
 scope.locator('button[aria-label="Customize vehicle"]').click()
 assert 'Exterior paint' in scope.locator('.content').inner_text()
 assert len(scope.locator('button[data-color]').all())==5
 scope.locator('button[data-color="stellar_purple"]').click()
 wait_for_art('g6-2026-stellar_purple.webp')
 assert current_image()['loaded']
 page.screenshot(path=str(ROOT/'previews/g6-2026-purple-color-picker.png'),full_page=True)
 scope.locator('select[data-appearance="trim"]').select_option('black_edition')
 assert len(scope.locator('button[data-color]').all())==1
 assert scope.locator('button[data-color="jet_black"]').get_attribute('aria-pressed')=='true'
 wait_for_art('g6-2026-jet_black.webp')
 page.screenshot(path=str(ROOT/'previews/g6-2026-black-edition-picker.png'),full_page=True)
 scope.locator('select[data-appearance="trim"]').select_option('core_plus_rwd')
 scope.locator('button[data-color="silver_frost"]').click()
 wait_for_art('g6-2026-silver_frost.webp')
 # settings selection persists after changing view
 scope.locator('button[data-back]').click()
 wait_for_art('g6-2026-silver_frost.webp')
 # visual card editor has trim, year, color controls
 page.evaluate('()=>{const ed=document.createElement("xpeng-vehicle-card-editor");document.body.appendChild(ed);ed.setConfig({prefix:"my_xpeng",model:"G6",year:"2026",trim:"core_performance_awd",color:"jet_black"});}')
 ed=page.locator('xpeng-vehicle-card-editor')
 assert ed.locator('[data-key="year"]').input_value()=='2026'
 assert ed.locator('[data-key="trim"]').input_value()=='core_performance_awd'
 assert ed.locator('[data-key="color"]').input_value()=='jet_black'
 assert not errors,errors
 browser.close()
print('PASS: G6 2026 artwork, image load, 5 paints, Core+/Performance/Black Edition, editor, persistence, no live-data fabrication')
