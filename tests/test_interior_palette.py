"""Dashboard, steering-wheel, door and seat upholstery share one editor finish."""
from pathlib import Path
import json, shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
script=(ROOT/'dist/xpeng-vehicle-card.js').read_text()
assert 'xpCabinSvg(theme)' in script and 'localStorage' not in script
assert all(k in (ROOT/'README.md').read_text().lower() for k in ('dashboard','wheel','door inserts','console','seats'))
assert {x['id'] for x in json.loads((ROOT/'model-catalog.json').read_text())['interiors']}=={'dark_gray','light_gray'}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium') or None,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':430,'height':930})
 page.set_content('<html><head><base href="https://ha.local/"></head><body><xpeng-vehicle-card></xpeng-vehicle-card></body></html>')
 page.add_script_tag(content=script)
 page.evaluate("""()=>{
  const cfg={prefix:'my_xpeng',model:'G6',year:'2026',trim:'core_performance_awd',color:'arctic_white',interior:'dark_gray',theme:'dark'};
  const c=document.querySelector('xpeng-vehicle-card');c.setConfig(cfg);c.hass={states:{}};
  const e=document.createElement('xpeng-vehicle-card-editor');document.body.appendChild(e);e.setConfig(cfg);
  e.addEventListener('config-changed',ev=>c.setConfig(ev.detail.config));
 }""")
 card=page.locator('xpeng-vehicle-card');ed=page.locator('xpeng-vehicle-card-editor')
 card.locator('button[data-view="interior"]').first.click()
 sv=card.locator('svg.xp-cabin-svg')
 before=sv.evaluate('(e)=>e.outerHTML')
 assert 'Dark Gray' in sv.get_attribute('aria-label')
 for token in ('Entire door inserts','Dash cover','Steering wheel trim','Center console','Front seats','Backrests'):assert token in before
 ed.locator('[data-key="interior"]').select_option('light_gray')
 after=sv.evaluate('(e)=>e.outerHTML')
 assert before!=after and '#d9dbd7' in after and '#424b53' not in after
 assert 'Light Gray' in sv.get_attribute('aria-label')
 assert card.locator('button[data-interior],button[data-color]').count()==0
 ed.locator('[data-key="trim"]').select_option('black_edition')
 assert ed.locator('[data-key="interior"] option').count()==1
 assert ed.locator('[data-key="interior"]').input_value()=='dark_gray'
 assert 'Dark Gray' in sv.get_attribute('aria-label')
 browser.close()
print('PASS: editor controls full interior finish and enforces variant options')
