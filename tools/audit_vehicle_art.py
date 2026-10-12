"""Audit transparent vehicle overlays bundled with the XPENG dashboard.

The same background bitmap must remain visible behind every vehicle selection.
Print aggregate alpha/asset quality; do not pretend an opaque illustration is an
exact image cutout or advertise an unsupported factory paint.
"""
from collections import Counter
from pathlib import Path
from PIL import Image
import json

ROOT=Path(__file__).resolve().parents[1]
MAN=json.loads((ROOT/'vehicle-art-inventory.json').read_text())
transparent,opaque,invalid=[],[],[]
for relative in MAN['exact']+MAN['model_family']:
    fn=ROOT/'dist/assets'/relative
    try:
        im=Image.open(fn)
        im.load()
        bands=im.getbands()
        if "A" not in bands:
            opaque.append(relative)
            continue
        ext=im.getchannel("A").getextrema()
        # Having an alpha channel does not mean there is transparent scenery.
        if ext[0]>=250:
            opaque.append(relative)
        else:
            transparent.append(relative)
    except Exception as exc:
        invalid.append((relative,str(exc)))
print('TRANSPARENT:',len(transparent),'OPAQUE:',len(opaque),'INVALID:',len(invalid))
for category,items in [('opaque',opaque),('invalid',invalid)]:
    for item in items[:200]:print(category,item)
assert not invalid,'Corrupt or unreadable vehicle preview'
assert len(transparent)+len(opaque)==len(MAN['exact'])+len(MAN['model_family'])
