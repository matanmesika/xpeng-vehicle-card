#!/usr/bin/env python3
"""Export a truthful per-view artwork backlog from the canonical catalogue and manifest."""
import csv
import json
import sys
from pathlib import Path
from io import StringIO

ROOT = Path(__file__).resolve().parents[1]
catalog = json.loads((ROOT / "vehicle-catalog.json").read_text(encoding="utf-8"))
art = json.loads((ROOT / "vehicle-art-map.json").read_text(encoding="utf-8"))
entry_by_key = {(e["model"],e["year_group"],e["exterior_color"]):e for e in art["entries"]}
buf = StringIO(newline="")
writer = csv.writer(buf,lineterminator="\n",quoting=csv.QUOTE_ALL)
writer.writerow(["model","year_group","exterior_color","view","path","status","catalog_status","market"])
for m in catalog["models"]:
    for group in m["groups"]:
        for colour in group["colors"]:
            key=(m["id"],group["id"],colour)
            assert key in entry_by_key, f"Missing manifest entry: {key}"
            item=entry_by_key[key]
            for view in ("front","charging","top"):
                x=item["views"][view]
                writer.writerow([m["id"],group["id"],colour,view,x["path"],x["status"],group["catalog_status"],group.get("market","varies")])
target = ROOT/"artwork-backlog.csv"
if "--check" in sys.argv:
    assert target.read_text(encoding="utf-8")==buf.getvalue(),"Artwork backlog is out of sync; run exporter"
else:
    target.write_text(buf.getvalue(),encoding="utf-8")
print("PASS:",len(art["entries"]),"vehicle-paint combinations =",len(art["entries"])*3,"view slots")
