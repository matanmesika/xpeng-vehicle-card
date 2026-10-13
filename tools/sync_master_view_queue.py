#!/usr/bin/env python3
"""Regenerate and validate planned authentic-generation vehicle view masters.

A separate transparent front/rear/top master is needed per model and shape generation.
Existing car artwork is scanned on disk; missing slots stay PENDING.
"""
import json, re, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
cat=json.loads((ROOT/"vehicle-catalog.json").read_text(encoding="utf-8"))
preferred=("arctic_white","nebula_white","everest_white","new_moon_silver","crescent_silver","silver_frost","micro_moon_gray","star_gray","starday_gray","graphite_gray","mirror_gray")
def slug(s):return re.sub(r"[^a-z0-9_]","",s.lower().replace("+","_plus").replace(" ","_"))
def target(g):
    return next((p for p in preferred if p in g["colors"]),None) or next((p for p in g["colors"] if not any(x in p for x in ("black_edition","two_tone","matte"))),g["colors"][0])
items=[]
for model in cat["models"]:
    for group in model["groups"]:
        colour=target(group)
        root=f"assets/vehicles/{slug(model['id'])}/{group['id']}/{colour}"
        views={v:{"path":f"{root}/{v}.webp","status":"available" if (ROOT/root/(v+".webp")).is_file() else "pending"} for v in ("front","charging","top")}
        items.append({
            "model":model["id"],"year_group":group["id"],"years":group["years"],"body_shape":model.get("shape"),
            "master_color":colour,"manufacturer_verified":False,"source_url":group.get("source_url"),
            "views":views,"pending_views":[v for v,x in views.items() if x["status"]=="pending"],
            "prompt_guidance":{
                "front":f"A SINGLE real-world {model['id']} ({group['id']}) body, {colour}, front three-quarter shot, isolated transparent cutout. Correct {model['id']} generation and vehicle proportions. No collage, titles, other cars, backdrop or shadow; never replace with another model.",
                "charging":f"A SINGLE real-world {model['id']} ({group['id']}) body, {colour}, REAR three-quarter shot with visible tail lights, rear hatch/trunk and rear wheels, isolated transparent cutout. Same design and paint as front master. No front fascia, collage, labels, scene or alternate model.",
                "top":f"A SINGLE real-world {model['id']} ({group['id']}) body, {colour}, VERTICAL 90-degree OVERHEAD top-down shot, complete car and roof visible, isolated transparent cutout. Same generation/paint. No side-perspective, collage, typography or background."},
            "geometry_review":"pending_manual_comparison_to_real_manufacturer_references",
        })
ready=sum(not x["pending_views"] for x in items)
out={
    "schema_version":1,"as_of":"2026-10-13","catalog":"vehicle-catalog.json",
    "selection_rules":{"image_selectors":["model","year_group","exterior_color"],"year_selects_palette":True,
    "trim_affects_anything":False,"views":["front","charging","top"],
    "master_must_match_model_and_generation":True,"never_substitute_angle":True},
    "summary":{"models":len(cat["models"]),"year_groups":len(items),"complete_master_groups":ready,
    "incomplete_master_groups":len(items)-ready,"missing_master_views":sum(len(x["pending_views"]) for x in items)},
    "masters":items
}
s=json.dumps(out,ensure_ascii=False,indent=2)+"\n"
p=ROOT/"master-view-queue.json"
if "--check" in sys.argv:
    assert p.read_text(encoding="utf-8")==s,"Master image queue out of sync. Run: python tools/sync_master_view_queue.py"
else:
    p.write_text(s,encoding="utf-8")
print("PASS",len(items),"generation-specific masters;",ready,"trios available; pending views",out["summary"]["missing_master_views"])
