"""Acceptance tests for the independent XPENG single-card rebuild.

Uses real HACS JavaScript and shipped XPENG assets. No mocked live vehicle data.
Captures desktop/mobile Home, Controls, Climate and Charging for owner review.
"""
from pathlib import Path
import json
import shutil
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=(ROOT/"dist/xpeng-vehicle-card.js").read_text(encoding="utf-8")
assert SCRIPT==(ROOT/"xpeng-vehicle-card.js").read_text(encoding="utf-8")
assert "v0.9.0-alpha.1" in SCRIPT
assert "localStorage" not in SCRIPT
assert "callService(" not in SCRIPT and ".call_service(" not in SCRIPT
assert "fetch(" not in SCRIPT
CAT=json.loads((ROOT/"model-catalog.json").read_text())
assert len(CAT["models"])==16 and len(CAT["paints"])==5
OUT=ROOT/"previews"/"clean-rebuild-v090"
OUT.mkdir(parents=True, exist_ok=True)

def run():
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=shutil.which("chromium") or None,args=["--no-sandbox"])
  for device,wd,ht in [("desktop",1200,900),("phone",390,844)]:
   page=browser.new_page(viewport={"width":wd,"height":ht},device_scale_factor=1)
   errs=[];missing=[]
   page.on("pageerror",lambda e:errs.append(str(e)))
   def asset(route):
    relative=route.request.url.split("/local/xpeng/",1)[1]
    file=ROOT/"assets"/relative
    if not file.is_file():
     missing.append(relative)
     return route.fulfill(status=404,body="Missing bundled image")
    ct="image/webp" if file.suffix==".webp" else "image/png" if file.suffix==".png" else "image/svg+xml"
    route.fulfill(status=200,body=file.read_bytes(),content_type=ct)
   page.route("**/local/xpeng/**",asset)
   page.set_content('<html><head><base href="https://ha.local/"><meta charset="UTF-8"><style>body{background:#111316;margin:0;padding:12px}xpeng-vehicle-card{display:block;width:100%}</style></head><body><xpeng-vehicle-card></xpeng-vehicle-card></body></html>')
   page.add_script_tag(content=SCRIPT)
   page.evaluate("""() => {
     const c=document.querySelector('xpeng-vehicle-card');
     c.setConfig({prefix:'my_xpeng',model:'G6',year:'2026',trim:'core_performance_awd',color:'arctic_white',interior:'dark_gray',theme:'dark',dashboard_layout:'cockpit',image_path:'/local/xpeng'});
     c.hass={states:{'sensor.my_xpeng_api_connection_status':{state:'not_configured',attributes:{}}}};
   }""")
   card=page.locator("xpeng-vehicle-card")
   assert card.locator(".vehicle-app").count()==1
   assert card.locator(".x-car-stage img").count()==1
   page.wait_for_function("""() => {let i=document.querySelector('xpeng-vehicle-card').shadowRoot.querySelector('.x-car-stage img');return i&&i.complete&&i.naturalWidth>800}""",timeout=16000)
   assert card.locator(".x-quick button").count()==4
   assert card.locator(".x-quick button").first.is_disabled()
   assert card.locator(".x-entry").count()==4
   assert card.locator(".xs-sidebar,.xs-rail,.xs-module,.xs-hero").count()==0
   assert "Not connected" in card.locator(".x-footer").inner_text()
   assert "—" in card.locator(".x-header-meta").inner_text()
   assert card.locator("[data-view='appearance'],[data-color],[data-interior]").count()==0
   page.screenshot(path=str(OUT/f"{device}-home.png"),full_page=True)
   def show(page_name):
    card.locator(f'.x-entry[data-page="{page_name}"]').click()
    assert card.locator(f'.x-main-panel[data-view="{page_name}"]').count()==1
   show("controls")
   assert card.locator(".x-control-car .x-top-svg").count()==1
   assert card.locator(".x-control-pin").count()==4
   assert card.locator(".x-disabled-tools button:not([disabled])").count()==0
   assert "Unavailable" in card.locator(".x-control-car").inner_text()
   page.screenshot(path=str(OUT/f"{device}-controls.png"),full_page=True)
   card.locator('[data-page="tires"]').click()
   assert card.locator('.x-main-panel[data-view="tires"]').count()==1
   assert "—" in card.locator(".x-control-car").inner_text()
   page.screenshot(path=str(OUT/f"{device}-tires.png"),full_page=True)
   card.locator("[data-back]").click()
   show("climate")
   assert card.locator(".x-climate-art svg.xp-cabin-svg").count()==1
   assert card.locator(".x-comfort-list").count()==1
   assert "Steering wheel heating" in card.locator(".x-comfort-list").inner_text()
   assert card.locator(".x-comfort-list button:not([disabled])").count()==0
   page.screenshot(path=str(OUT/f"{device}-climate.png"),full_page=True)
   card.locator("[data-back]").click()
   show("charging")
   assert card.locator(".x-charging-car img").count()==1
   assert card.locator('input[type=range]').is_disabled()
   assert "—" in card.locator(".x-charge-panel").inner_text()
   page.screenshot(path=str(OUT/f"{device}-charging.png"),full_page=True)
   card.locator("[data-back]").click()
   show("location")
   assert "unavailable" in card.locator(".x-location").inner_text().lower()
   card.locator("[data-back]").click()
   card.locator("[data-expanded]").click()
   assert card.get_attribute("data-expanded") is not None
   card.locator("[data-expanded]").click()
   assert card.get_attribute("data-expanded") is None
   if device=="phone":
    size=page.evaluate("""()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth})""")
    assert size["scroll"]<=size["client"]+2,size
   assert not errs,errs
   assert not missing,missing
   page.close()
  browser.close()
 print("PASS: vehicle-first XPENG clean rebuild; authentic Chromium screens; no invented commands")

if __name__=="__main__":run()
