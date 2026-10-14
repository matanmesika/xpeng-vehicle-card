"""Verify model+paint artwork inventory; year and trim do not select artwork."""
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
m=json.loads((root/'data/model-artwork.json').read_text())
copy=json.loads((root/'dist/data/model-artwork.json').read_text())
assert m==copy
cat=json.loads((root/'model-catalog.json').read_text())
inv=json.loads((root/'data/vehicle-art-inventory.json').read_text())
assert m['selection']=='model + exterior paint ONLY'
assert len(m['models'])==len(cat['models'])==16
exact=set(inv['exact'])
family=set(inv['model_family'])
seen=set()
checked=0
for model in m['models']:
  assert model['model'] not in seen
  seen.add(model['model'])
  assert model['visual_year_policy']=='shared-across-all-years'
  assert model['visual_trim_policy']=='shared-across-all-selected-trims'
  for paint,item in model['colors'].items():
    front=item['front']
    if front:
      path=front['path']
      assert path in exact|family
      assert front['manufacturer_verified'] is False
      assert (root/'assets'/path).is_file()
      assert (root/'dist/assets'/path).is_file()
      assert (root/'dist'/('xpeng-asset-'+path.replace('/','-'))).is_file()
      if front['tier']=='highest-trim-preview':
        assert model['visual_trim_source'] is not None
        assert f"/{model['visual_trim_source']}/" in path
    assert item['rear'] is None
    assert item['top'] is None
    checked+=1
assert checked>=75
print(f"PASS: {len(seen)} model-wide vehicle profiles and {checked} model+paint mappings")
