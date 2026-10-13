#!/usr/bin/env python3
"""Report artwork canvas differences; results require manual visual review."""
import json
from pathlib import Path
from collections import defaultdict
from PIL import Image

root = Path(__file__).resolve().parents[1]
catalog = json.loads((root / "vehicle-art-map.json").read_text())
groups = defaultdict(lambda: defaultdict(list))
warnings = []
count = 0
for entry in catalog["entries"]:
    for view, record in entry["views"].items():
        if record["status"] != "available":
            continue
        count += 1
        path = root / "assets" / record["path"]
        with Image.open(path) as im:
            im.load()
            dims = im.size
            if im.format != "WEBP" or "A" not in im.getbands():
                warnings.append(f"INVALID: {record['path']}")
            elif im.getchannel("A").getextrema()[0] > 0:
                warnings.append(f"OPAQUE: {record['path']}")
        groups[(entry["model"], entry["year_group"], view)].append((entry["exterior_color"], dims))
for key, items in sorted(groups.items()):
    sizes = defaultdict(list)
    for paint, dims in items:
        sizes[dims].append(paint)
    if len(sizes) > 1:
        warnings.append(f"CANVAS MISMATCH {key}: {dict(sizes)}")
lines = ["# XPENG artwork machine review", "",
         "Unapproved imagery: geometry checks do not prove manufacturer fidelity.", "",
         f"Checked {count} available views. Found {len(warnings)} warnings.", "",
         *("- " + w for w in warnings), "",
         "Human review is required for body generation, paint, camera angle and crop.", ""]
output = root / "review-export" / "ARTWORK_GEOMETRY_REVIEW.md"
output.parent.mkdir(exist_ok=True)
output.write_text("\n".join(lines))
print("\n".join(lines))
