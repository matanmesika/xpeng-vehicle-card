"""Validate uploaded XPENG WebP overlays at their actual repository locations.

The repo stores art in assets/vehicles. Do not claim that HACS dist/assets
exists unless a release workflow has explicitly packaged it.
"""
from pathlib import Path
from PIL import Image
import json

ROOT = Path(__file__).resolve().parents[1]
MAN = json.loads((ROOT / "vehicle-art-inventory.json").read_text(encoding="utf-8"))
ART = json.loads((ROOT / "vehicle-art-map.json").read_text(encoding="utf-8"))
transparent, opaque, invalid = [], [], []
exact = MAN["exact"]
declared = sorted(
    v["path"] for item in ART["entries"] for v in item["views"].values()
    if v["status"] == "available"
)
assert exact == declared, "Image inventory and model-year-paint map must agree"
assert MAN["trim_affects_artwork"] is False
assert ART["trim_affects_artwork"] is False

for relative in exact:
    name = ROOT / "assets" / relative
    try:
        with Image.open(name) as im:
            im.load()
            has_alpha = "A" in im.getbands()
            extrema = im.getchannel("A").getextrema() if has_alpha else (255, 255)
            if not has_alpha or extrema[0] >= 250:
                opaque.append(relative)
            else:
                transparent.append(relative)
    except Exception as exc:
        invalid.append((relative, str(exc)))

print(f"TRANSPARENT: {len(transparent)}; OPAQUE: {len(opaque)}; INVALID: {len(invalid)}")
for kind, items in (("opaque", opaque), ("invalid", invalid)):
    for item in items:
        print(kind, item)

assert not invalid, "Missing or corrupt mapped images"
assert not opaque, "Images placed over the approved scenic background must have a transparent alpha channel"
assert len(transparent) == len(exact)
print(f"PASS: {len(transparent)} transparent vehicle overlays in assets/, truthful manifest")
