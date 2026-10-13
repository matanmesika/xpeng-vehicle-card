#!/usr/bin/env python3
"""Build UNAPPROVED same-generation graphite review candidates; never touch assets/.

This is a geometry-consistent alternative to the currently mixed-size G6 2026
Graphite Gray trio, not a manufacturer-verified rendering or catalog completion.
"""
import json
from pathlib import Path
from PIL import Image
from recolor_vehicle_assets import colourise

ROOT = Path(__file__).resolve().parents[1]
CAT = json.loads((ROOT / 'vehicle-catalog.json').read_text(encoding='utf-8'))
HEX = next(p['hex'] for p in CAT['paints'] if p['id'] == 'graphite_gray')
SOURCE = ROOT / 'assets/vehicles/g6/2026/arctic_white'
DEST = ROOT / 'review-export/g6/2026/graphite_gray'
VIEWS = ('front', 'charging', 'top')


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    manifest = {'model': 'G6', 'year_group': '2026', 'paint': 'graphite_gray',
                'review': 'UNAPPROVED - MANUAL MODEL/GEOMETRY REVIEW REQUIRED',
                'method': 'same-generation white master recolor',
                'manufacturer_verified': False, 'files': []}
    for view in VIEWS:
        path = SOURCE / (view + '.webp')
        with Image.open(path) as im:
            im.load()
            if im.format != 'WEBP' or 'A' not in im.getbands() or im.getchannel('A').getextrema()[0] > 0:
                raise ValueError(f'Invalid transparent source: {path}')
            derived = colourise(im, HEX)
            output = DEST / (view + '.webp')
            derived.save(output, 'WEBP', quality=94, method=3)
            with Image.open(output) as check:
                check.load()
                if check.format != 'WEBP' or check.size != im.size or check.getchannel('A').getextrema()[0] > 0:
                    raise ValueError(f'Invalid candidate: {output}')
            manifest['files'].append({'view': view, 'source': str(path.relative_to(ROOT)),
                                      'candidate': str(output.relative_to(ROOT)), 'canvas': list(im.size)})
    (DEST / 'REVIEW_REQUIRED.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print('Created three unapproved review candidate WebPs. No assets/ changed.')


if __name__ == '__main__':
    main()
