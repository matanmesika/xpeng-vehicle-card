#!/usr/bin/env python3
"""Export/check exact-year paint palettes without duplicating body-generation images."""
import json,sys
from pathlib import Path
R=Path(__file__).resolve().parents[1]
C=json.loads((R/"vehicle-catalog.json").read_text(encoding="utf-8"))
rows=[]
for m in C["models"]:
    seen=set()
    for g in m["groups"]:
        for y in g["years"]:
            assert y not in seen,(m["id"],y)
            seen.add(y)
            colors=g["colors_by_year"][str(y)]
            assert colors and len(colors)==len(set(colors)) and all(x in g["colors"] for x in colors)
            src=g["year_palette_sources"][str(y)]
            rows.append(dict(model=m["id"],year=y,year_group=g["id"],colors=colors,confidence=src["confidence"],source=src["source"],notes=src["notes"]))
v=dict(schema_version=1,generated_on="2026-10-13",catalog="vehicle-catalog.json",model_year_count=len(rows),selection_parameters=["model","model_year","exterior_color"],image_geometry=["model","year_group","exterior_color"],trim_affects_artwork=False,years=rows)
p=R/"year-color-matrix.json"
s=json.dumps(v,indent=2,ensure_ascii=False)+"\n"
if "--check" in sys.argv: assert p.read_text(encoding="utf-8")==s,"Year palettes stale"
else: p.write_text(s,encoding="utf-8")
print("PASS",len(rows),"specific model years")
