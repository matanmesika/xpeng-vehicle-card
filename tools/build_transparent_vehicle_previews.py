"""Separate legacy studio car previews from the shared XPENG dashboard scene.

2026-10 preview pipeline: all converted images remain ILLUSTRATIVE, not
manufacturer-authenticated. Alpha masks are derived per model family from its
white reference pose, then reused across colours of the *same* family so dark
paint variants do not accidentally lose the vehicle body. Existing transparent
G6 2026 assets are never touched.
"""
from pathlib import Path
from PIL import Image
import cv2
import json
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'dist/assets'
MAN=json.loads((ROOT/'vehicle-art-inventory.json').read_text(encoding='utf-8'))
FAMILY=MAN['model_family']
EXACT=MAN['exact']
MASKS={}

def family_slug(relative):
    basename=relative.rsplit('/',1)[-1]
    for colour in ('arctic_white','jet_black','silver_frost','space_grey','stellar_purple'):
        suffix='-'+colour+'.webp'
        if basename.endswith(suffix):
            return basename[:-len(suffix)]
    raise ValueError('Unknown existing-family file name: '+relative)

def photo_mask(photo):
    rgb=np.asarray(photo.convert('RGB'),dtype=np.uint8)
    h,w=rgb.shape[:2]
    if min(h,w)<250:raise ValueError('Unreasonably small car art')
    mask=np.full((h,w),cv2.GC_PR_BGD,dtype=np.uint8)
    mask[:int(h*.105),:]=cv2.GC_BGD
    mask[int(h*.925):,:]=cv2.GC_BGD
    mask[:,:int(w*.014)]=cv2.GC_BGD
    mask[:,int(w*.986):]=cv2.GC_BGD
    mask[int(h*.25):int(h*.68),int(w*.22):int(w*.82)]=cv2.GC_PR_FGD
    bright=rgb.max(axis=2)
    y=np.arange(h)[:,None]
    mask[(bright>115)&(y>h*.10)&(y<h*.92)]=cv2.GC_FGD
    bg=np.zeros((1,65),np.float64);fg=np.zeros((1,65),np.float64)
    cv2.grabCut(cv2.cvtColor(rgb,cv2.COLOR_RGB2BGR),mask,None,bg,fg,7,cv2.GC_INIT_WITH_MASK)
    alpha=np.where(np.isin(mask,[cv2.GC_FGD,cv2.GC_PR_FGD]),255,0).astype(np.uint8)
    n,labels,stats,_=cv2.connectedComponentsWithStats(alpha,8)
    if n>1:
        largest=1+int(np.argmax(stats[1:,cv2.CC_STAT_AREA]))
        alpha=np.where(labels==largest,255,0).astype(np.uint8)
    # Restore dark rubber wheels and tinted windows without returning the
    # full rectangular studio background. The source poses share normalized geometry.
    alpha2=alpha.copy()
    cv2.ellipse(alpha2,(int(.568*w),int(.698*h)),(int(.078*w),int(.116*h)),0,0,360,255,-1)
    cv2.ellipse(alpha2,(int(.921*w),int(.654*h)),(int(.059*w),int(.103*h)),0,0,360,255,-1)
    fg=alpha2>100
    for x in range(w):
        ys=np.flatnonzero(fg[:,x])
        if ys.size>0:alpha2[ys[0]:ys[-1]+1,x]=255
    alpha2=cv2.GaussianBlur(alpha2,(3,3),.7)
    fraction=np.mean(alpha2>30)
    if not .27<fraction<.72:
        raise ValueError(f'Unsafe silhouette mask coverage: {fraction:.3f}')
    return Image.fromarray(alpha2,'L')

def transform(relative,mask):
    src=ASSETS/relative
    with Image.open(src) as im:
        im.load()
        if 'A' in im.getbands() and im.getchannel('A').getextrema()[0]<240:
            return False
        rgb=im.convert('RGB')
    if rgb.size!=mask.size:
        raise ValueError(f'Incompatible model-family poses {relative}: {rgb.size} vs {mask.size}')
    image=rgb.convert('RGBA')
    image.putalpha(mask)
    for folder in ('assets','dist/assets'):
        output=ROOT/folder/relative
        output.parent.mkdir(parents=True,exist_ok=True)
        image.save(output,'WEBP',quality=88,method=6)
        with Image.open(output) as check:
            assert check.mode=='RGBA' and check.getchannel('A').getextrema()[0]==0
    print('Transparent car preview:',relative,flush=True)
    return True

converted=0
for relative in FAMILY:
    slug=family_slug(relative)
    if slug not in MASKS:
        white=ASSETS/('models/'+slug+'-arctic_white.webp')
        MASKS[slug]=photo_mask(Image.open(white))
    converted+=int(transform(relative,MASKS[slug]))
for relative in EXACT:
    bits=relative.split('/')
    slug=bits[1]
    if slug=='g6':continue # Previously cut out and tested.
    if slug not in MASKS:
        white=ASSETS/('models/'+slug+'-arctic_white.webp')
        MASKS[slug]=photo_mask(Image.open(white))
    converted+=int(transform(relative,MASKS[slug]))
assert converted==91, ('Unusual number of opaque previews',converted)
print('Converted',converted,'opaque files; preserved transparent G6 files untouched')
