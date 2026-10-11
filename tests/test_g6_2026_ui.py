"""2026 G6 Performance: color editing in card editor, not on dashboard."""
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
SCRIPT=(ROOT/'dist/xpeng-vehicle-card.js').read_text()
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium') or None,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':420,'height':920})
 page.route('**/local/xpeng/**',lambda r:r.fulfill(status=200,body=(ROOT/'assets'/r.request.url.split('/local/xpeng/')[-1]).read_bytes(),content_type='image/webp'))
 page.set_content('<html><head><base href="https://ha.local/"></head><body><xpeng-vehicle-card></xpeng-vehicle-card></body></html>')
 page.add_script_tag(content=SCRIPT)
 page.evaluate("""()=>{
  let cfg={prefix:'my_xpeng',model:'G6',year:'2026',trim:'core_performance_awd',color:'arctic_white',interior:'dark_gray',image_path:'/local/xpeng',theme:'dark'};
  let c=document.querySelector('xpeng-vehicle-card');c.setConfig(cfg);c.hass={states:{}};
  let e=document.createElement('xpeng-vehicle-card-editor');document.body.appendChild(e);e.setConfig(cfg);
  e.addEventListener('config-changed',v=>c.setConfig(v.detail.config));
 }""")
 card=page.locator('xpeng-vehicle-card')
 ed=page.locator('xpeng-vehicle-card-editor')
 ed.locator('[data-key="color"]').select_option('silver_frost')
 page.wait_for_function("""()=>{const i=document.querySelector('xpeng-vehicle-card').shadowRoot.querySelector('.hero img');return i&&i.src.endsWith('g6-2026-silver_frost.webp')&&i.complete&&i.naturalWidth>0}""")
 ed.locator('[data-key="interior"]').select_option('light_gray')
 card.locator('[data-view="interior"]').first.click()
 assert 'Light Gray' in card.locator('svg.xp-cabin-svg').get_attribute('aria-label')
 assert 'Edit mode' in card.locator('.content').inner_text()
 assert card.locator('button[data-interior],button[data-color]').count()==0
 browser.close()
print('PASS: G6 2026 editor selection and read-only interior display')
