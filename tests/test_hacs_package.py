"""Validate deliverable structure, HACS asset paths, and read-only safety."""
from pathlib import Path
import json
r = Path(__file__).resolve().parents[1]
m = json.loads((r/'hacs.json').read_text())
assert m['filename'] == 'xpeng-vehicle-card.js'
assert m['name'] == 'XPENG Vehicle Card'
js = (r/'dist'/m['filename']).read_text()
assert js == (r/m['filename']).read_text(), 'Root and dist copies must match'
assert "/hacsfiles/xpeng-vehicle-card/assets" in js
assert 'callService(' not in js and '.call_service(' not in js, 'No unverified vehicle commands'
assert 'fetch(' not in js, 'The card must not use an XPENG cloud API'
assert 'XP_INVALID' in js and 'unavailable' in js
images = list((r/'assets').rglob('*.*'))
assert images
for p in images:
    target = r/'dist/assets'/p.relative_to(r/'assets')
    assert target.is_file(), f'Missing HACS-distributed asset: {p}'
    assert p.read_bytes() == target.read_bytes(), f'Mismatched HACS asset: {p}'
print(f'PASS: HACS dist and {len(images)} images complete, no invented commands')
