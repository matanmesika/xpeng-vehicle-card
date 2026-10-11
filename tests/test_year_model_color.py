"""Model-year matrix & browser tests for XPENG Vehicle Card; NO real vehicle API calls."""
from pathlib import Path
import json, shutil, threading, socketserver, http.server
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
cat=json.loads((ROOT/'model-catalog.json').read_text())
models=cat['models']; paints=cat['paints']
assert len(models)==16
assert len(paints)==5
assert 2026 in cat['years'] and 2018 in cat['years']
assert next(x for x in models if x['id']=='G6')['start']==2023
assert next(x for x in models if x['id']=='G7')['start']==2025
assert next(x for x in models if x['id']=='Next P7')['start']==2025
for m in models:
 for p in paints:
  slug=m['id'].lower().replace(' ','_').replace('+','_plus')
  assert (ROOT/'assets/models'/f'{slug}-{p["id"]}.webp').is_file(),(m['id'],p['id'])
for p in paints:
 assert (ROOT/'assets'/f'g6-2026-{p["id"]}.webp').is_file()

class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(ROOT),**kwargs)
 def log_message(self,fmt,*args):pass
class Server(socketserver.TCPServer): allow_reuse_address=True
sv=Server(('127.0.0.1',0),Handler)
thread=threading.Thread(target=sv.serve_forever,daemon=True);thread.start()
base=f'http://127.0.0.1:{sv.server_address[1]}'
previews=ROOT/'previews'
previews.mkdir(exist_ok=True)

# Files inside /local/xpeng/ are intentionally mapped to build assets for browser preview.
script=(ROOT/'dist/xpeng-vehicle-card.js').read_text()
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium') or None,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':430,'height':970},device_scale_factor=1)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 def route_asset(route):
  path=route.request.url.split('/local/xpeng/',1)[-1]
  file=ROOT/'assets'/path
  if not file.is_file():return route.fulfill(status=404,body='missing')
  mimetype='image/webp' if file.suffix=='.webp' else 'image/png' if file.suffix=='.png' else 'image/svg+xml'
  return route.fulfill(status=200,body=file.read_bytes(),content_type=mimetype)
 page.route('**/local/xpeng/**',route_asset)
 page.set_content('<html><head><base href="https://ha.local/"><meta charset="utf-8"><style>body{margin:0;background:#0e1012;padding:12px}xpeng-vehicle-card{display:block;max-width:430px;margin:auto}</style></head><body><xpeng-vehicle-card></xpeng-vehicle-card></body></html>')
 page.add_script_tag(content=script)
 states={f'sensor.my_xpeng_api_connection_status':{'state':'not_configured','attributes':{}}}
 def initialize(model='G6',year='2026',trim='core_plus_rwd',color='arctic_white'):
  page.evaluate('''arg=>{
    try {localStorage.clear()}catch(e){}; const c=document.querySelector('xpeng-vehicle-card');
    c.setConfig({prefix:'my_xpeng',model:arg.model,year:arg.year,trim:arg.trim,color:arg.color,image_path:'/local/xpeng',theme:'dark'});
    c.hass={states:arg.states};
  }''',{'model':model,'year':year,'trim':trim,'color':color,'states':states})
  page.wait_for_timeout(350)
 def card():return page.locator('xpeng-vehicle-card')
 def artifact():return page.evaluate('''() => {let c=document.querySelector('xpeng-vehicle-card');let img=c.shadowRoot.querySelector('.hero img');return {src:img.getAttribute('src'),loaded:img.complete&&img.naturalWidth>0, year:c.year(),model:c.model(),trim:c.trim(),paint:c.paint()}}''')
 def change(k,v):
  card().locator('[data-appearance="'+k+'"]').select_option(v)
  page.wait_for_timeout(250)
 initialize()
 assert artifact()['src'].endswith('g6-2026-arctic_white.webp'),artifact()
 assert artifact()['loaded'],artifact()
 assert 'XPENG API not connected' in card().locator('.disconnected-note').inner_text()
 page.screenshot(path=str(previews/'g6-2026-default.png'),full_page=True)
 card().locator('[data-view="appearance"]').first.click()
 assert len(card().locator('[data-appearance="year"] option').all())==9
 assert len(card().locator('[data-appearance="model"] option').all())>=10
 # G6 2026 Performance and Black Edition restrictions
 change('trim','black_edition')
 assert len(card().locator('button[data-color]').all())==1
 assert artifact()['paint']=='jet_black',artifact()
 assert artifact()['loaded']
 # Year 2020: G6 and 2025-launched G7/Next P7 NOT available.
 change('year','2020')
 text=card().locator('select[data-appearance="model"]').inner_text()
 assert 'G6' not in text and 'G7' not in text and 'Next P7' not in text,text
 assert artifact()['model'] in ('G3','P7','Other'),artifact()
 assert artifact()['loaded'],artifact()
 # 2026 G9 with distinct car art, style color selector and model trim.
 change('year','2026');change('model','G9')
 assert artifact()['model']=='G9',artifact()
 assert artifact()['trim']=='unspecified'
 card().locator('button[data-color="stellar_purple"]').click()
 assert artifact()['src'].endswith('models/g9-stellar_purple.webp'),artifact()
 assert artifact()['loaded'],artifact()
 page.screenshot(path=str(previews/'g9-2026-purple-picker.png'),full_page=True)
 card().locator('[data-back]').click()
 page.screenshot(path=str(previews/'g9-2026-purple-home.png'),full_page=True)
 # Year 2025 -> Next P7; year 2024 -> P7 old, not Next P7
 card().locator('[data-view="appearance"]').first.click()
 change('year','2025');change('model','Next P7');assert artifact()['loaded'];assert artifact()['model']=='Next P7'
 page.screenshot(path=str(previews/'next-p7-2025-picker.png'),full_page=True)
 change('year','2024')
 assert 'Next P7' not in card().locator('[data-appearance="model"]').inner_text()
 # Editor contains and cascades year-model-trim-color
 page.evaluate('''()=>{
  let e=document.createElement('xpeng-vehicle-card-editor'); document.body.appendChild(e);
  e.setConfig({prefix:'my_xpeng',model:'G6',year:'2026',trim:'core_plus_rwd',color:'arctic_white',theme:'dark'});
 }''')
 ed=page.locator('xpeng-vehicle-card-editor')
 ed.locator('[data-key="year"]').select_option('2020')
 assert 'G6' not in ed.locator('[data-key="model"]').inner_text()
 ed.locator('[data-key="year"]').select_option('2026')
 ed.locator('[data-key="model"]').select_option('G6')
 ed.locator('[data-key="trim"]').select_option('black_edition')
 assert ed.locator('[data-key="color"] option').count()==1
 assert ed.locator('[data-key="color"]').input_value()=='jet_black'
 # All assets + output status
 assert not errors,errors
 browser.close()
sv.shutdown()
print('PASS: model-year matrix, 16 model profiles, 80 original color assets, G6 facelift, blackout trim, cross-year selection, UI editor, image loading, no JS exceptions')
