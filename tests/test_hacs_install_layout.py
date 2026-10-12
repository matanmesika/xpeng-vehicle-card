"""Regression: model HACS plugin install search order, and verify every referenced image is downloadable."""
from pathlib import Path
import json

root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'hacs.json').read_text())
filename=manifest['filename']
assert not (root/filename).exists(), "HACS prefers ROOT JavaScript and silently omits nested photos"
assert (root/'dist'/filename).is_file(), "HACS must choose dist directory"
assert (root/'src'/filename).read_bytes()==(root/'dist'/filename).read_bytes()

# This is the subset of the HACS plugin download selection that matters:
# it downloads direct files of the chosen directory, not assets hidden in subfolders.
chosen=[p for p in (root/'dist').iterdir() if p.is_file()]
assert any(p.name==filename for p in chosen)
background=root/'dist'/'xpeng-approved-lakeside-background.webp'
assert background in chosen and background.stat().st_size>50000
cutout=root/'dist'/'xpeng-asset-vehicles-g6-2026-core_plus_rwd-arctic_white.webp'
assert cutout in chosen and cutout.stat().st_size>100000
catalog=json.loads((root/'vehicle-art-inventory.json').read_text())
for relative in catalog['exact']+catalog['model_family']:
    file=root/'dist'/('xpeng-asset-'+relative.replace('/','-'))
    assert file in chosen, f"HACS installer would not download {relative}"
    assert file.read_bytes()==(root/'dist'/'assets'/relative).read_bytes(),relative
js=(root/'dist'/filename).read_text()
assert "XP_HACS_BASE+XP_SCENE_BACKGROUND" in js
assert "xpPackagedUrl(relative)" in js
assert "src:bundled(exact)" in js and "src:bundled(family)" in js
assert "background_image" in js and "XP_SCENE_BACKGROUND" in js
assert "xp-night-photo" in js
assert "class=\"xp-sky\"" not in js
print(f"PASS: HACS installs JS + {len(chosen)-1} direct assets, including background & 117 model images")
