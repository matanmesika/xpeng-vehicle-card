"""XPENG appearance is edited only through Home Assistant's card editor."""
from pathlib import Path
import json, shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
assert len(json.loads((ROOT/'model-catalog.json').read_text())['models'])==16
SCRIPT=(ROOT/'dist/xpeng-vehicle-card.js').read_text()
assert SCRIPT==(ROOT/'xpeng-vehicle-card.js').read_text()
assert 'localStorage' not in SCRIPT
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium') or None,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':430,'height':920})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def asset(route):
  f=ROOT/'assets'/route.request.url.split('/local/xpeng/')[-1]
  route.fulfill(status=200 if f.exists() else 404,body=f.read_bytes() if f.exists() else b'',content_type='image/webp' if f.suffix=='.webp' else 'image/png')
 page.route('**/local/xpeng/**',asset)
 page.set_content('<html><head><base href="https://ha.local/"></head><body><xpeng-vehicle-card></xpeng-vehicle-card></body></html>')
 page.add_script_tag(content=SCRIPT)
 page.evaluate("""()=>{
   const cfg={prefix:'my_xpeng',model:'G6',year:'2026',trim:'core_performance_awd',color:'arctic_white',interior:'dark_gray',image_path:'/local/xpeng',theme:'dark'};
   const c=document.querySelector('xpeng-vehicle-card');c.setConfig(cfg);c.hass={states:{}};
   const e=document.createElement('xpeng-vehicle-card-editor');document.body.appendChild(e);e.setConfig(cfg);
   e.addEventListener('config-changed',ev=>c.setConfig(ev.detail.config));
 }""")
 card=page.locator('xpeng-vehicle-card');editor=page.locator('xpeng-vehicle-card-editor')
 def wait_art(f):
  page.wait_for_function("""f=>{let im=document.querySelector('xpeng-vehicle-card').shadowRoot.querySelector('.hero img');return im&&im.src.endsWith(f)&&im.complete&&im.naturalWidth>0}""",arg=f,timeout=15000)
 wait_art('g6-2026-arctic_white.webp')
 assert card.locator('[data-view="appearance"],[data-appearance],[data-color],[data-interior]').count()==0
 assert card.locator('[aria-label="Customize vehicle"]').count()==0
 editor.locator('[data-key="color"]').select_option('stellar_purple')
 wait_art('g6-2026-stellar_purple.webp')
 editor.locator('[data-key="trim"]').select_option('black_edition')
 assert editor.locator('[data-key="color"] option').count()==1
 assert editor.locator('[data-key="color"]').input_value()=='jet_black'
 wait_art('g6-2026-jet_black.webp')
 editor.locator('[data-key="year"]').select_option('2020')
 assert 'G6' not in editor.locator('[data-key="model"]').inner_text()
 editor.locator('[data-key="year"]').select_option('2026')
 editor.locator('[data-key="model"]').select_option('G9')
 editor.locator('[data-key="color"]').select_option('stellar_purple')
 wait_art('models/g9-stellar_purple.webp')
 editor.locator('[data-key="year"]').select_option('2025')
 editor.locator('[data-key="model"]').select_option('Next P7')
 wait_art('models/next_p7-arctic_white.webp')
 assert not errors,errors
 browser.close()
print('PASS: editor-only vehicle appearance, model/trim restrictions and assets')
