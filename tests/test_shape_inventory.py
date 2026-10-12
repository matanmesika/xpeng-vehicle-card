"""Audit every shape/year/trim/paint selection; no invented or mislabeled photos."""
import json
from pathlib import Path
r=Path(__file__).resolve().parents[1]
m=json.loads((r/'shape-artwork.json').read_text())
p=json.loads((r/'profiles/year-profiles.json').read_text())
a=json.loads((r/'vehicle-art-inventory.json').read_text())
assert len(m['profiles'])==p['profile_count']==53
seen=set()
exact=set(a['exact']);family=set(a['model_family'])
rear=0;count=0
for row in m['profiles']:
    key=(row['model'],row['year'])
    assert key not in seen,key
    seen.add(key)
    assert row['shape_options']
    assert row['default_shape_family'] in [x['id'] for x in row['shape_options']]
    for trim in row['trims']:
        for color in row['colors']:
            item=row['assets'][trim][color]
            front=item['front']
            if front is not None:
                assert front['shape_verified'] is False
                assert front['path'] in exact|family,front['path']
                assert (r/'dist/assets'/front['path']).is_file()
                assert (r/'dist'/('xpeng-asset-'+front['path'].replace('/','-'))).is_file()
            assert item['rear'] is None and item['charging'] is None and item['top'] is None
            assert item['rear_status']=='missing'
            assert item['top_status']=='missing_overhead_packshot_illustrative_preview'
            count+=1
for model in ['G6','G9']:
    previous=next(row for row in m['profiles'] if row['model']==model and row['year']=='2024')
    newer=next(row for row in m['profiles'] if row['model']==model and row['year']=='2026')
    assert previous['default_shape_family']!=newer['default_shape_family']
    both=next(row for row in m['profiles'] if row['model']==model and row['year']=='2025')
    assert len(both['shape_options'])==2
assert count>=400,count
print(f'PASS: {len(seen)} model-years, {count} configurable trim/paint combinations, missing rear images explicitly marked')
