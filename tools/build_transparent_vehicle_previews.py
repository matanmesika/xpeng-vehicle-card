"""Rebuild illustrative car overlays without cropping headlights, bumpers or wheels.

Never change the approved scenic bitmap. All source RGB artwork is fetched from
main: previously-processed transparent variants are intentionally NOT used as
input, because compositing already-clipped previews compounds silhouette damage.

The lower contour is a generous per-body-style envelope; the upper contour is
detected independently for each model from the white source's brightest car
pixels. All results are illustrative until the image owner approves them.
"""
from pathlib import Path
from io import BytesIO
from PIL import Image
import cv2
import json
import numpy as np
import subprocess

ROOT=Path(__file__).resolve().parents[1]
MAN=json.loads((ROOT/'vehicle-art-inventory.json').read_text())
SLUGS=('arctic_white','jet_black','silver_frost','space_grey','stellar_purple')
# y coordinates normalized from 780x585 studio originals.
LOWER={
  'suv':[(10,355),(15,421),(60,445),(79,454),(108,454),(155,424),
         (371,431),(385,456),(420,477),(468,479),(488,461),(500,441),
         (654,411),(689,418),(717,435),(741,429),(764,391),(769,325)],
  'large_suv':[(13,454),(43,469),(67,498),(110,506),(151,476),
         (385,461),(399,482),(416,525),(466,534),(495,522),(516,474),
         (656,438),(679,467),(700,491),(724,491),(746,469),(763,420),(767,349)],
  'mpv':[(12,433),(46,472),(81,494),(116,493),(155,461),
         (370,454),(384,472),(414,508),(467,517),(490,501),(513,455),
         (654,433),(680,460),(705,476),(724,475),(748,451),(765,406)]
}
# Conservative upper contour by body style: stops isolated dark studio
# columns from projecting above a roof/hood and covering the scenic sky.
UPPER={
  'suv':[(10,284),(15,270),(42,229),(98,208),(170,187),(215,164),
         (259,122),(321,84),(399,80),(558,79),(643,87),(706,145),
         (752,189),(765,226)],
  'large_suv':[(13,313),(19,286),(54,251),(116,237),(151,219),
         (184,200),(236,153),(292,134),(331,129),(553,127),
         (645,143),(701,171),(755,233),(767,270)],
  'mpv':[(12,290),(20,262),(58,228),(105,210),(162,190),
         (206,165),(257,126),(311,115),(360,112),(551,111),
         (660,120),(717,144),(755,177),(768,214)]
}
MODEL_BODY={
    'g9':'large_suv','g9l':'large_suv','gx':'large_suv',
    'x9':'mpv',
    'g3':'suv','g3i':'suv','g7':'suv','l03':'suv','mona_m03':'suv',
    'next_p7':'suv','p5':'suv','p7':'suv','p7_plus':'suv','p7i':'suv','other':'suv'
}
MASKS={}

def original(relative):
    cmd=['git','show','origin/main:dist/assets/'+relative]
    p=subprocess.run(cmd,cwd=ROOT,capture_output=True,check=True)
    return Image.open(BytesIO(p.stdout)).convert('RGB')

def family_name(relative):
    filename=relative.rsplit('/',1)[-1]
    for paint in SLUGS:
        if filename.endswith('-'+paint+'.webp'):
            return filename[:-len('-'+paint+'.webp')]
    raise ValueError('Unknown family paint: '+relative)

def mask_from_white(img,slug):
    rgb=np.asarray(img,dtype=np.uint8)
    h,w=rgb.shape[:2]
    if w<400 or h<300:raise ValueError(f'Invalid source dimensions for {slug}: {w}x{h}')
    luma=rgb.max(axis=2).astype(np.float32)
    baseline=np.percentile(luma,10,axis=1)[:,None]
    candidate=(luma>np.maximum(baseline+28,58))
    candidate[:int(h*.10),:]=False
    candidate[int(h*.92):,:]=False
    candidate=cv2.morphologyEx(candidate.astype(np.uint8),cv2.MORPH_OPEN,np.ones((3,3),np.uint8)).astype(bool)
    tops=np.full(w,np.nan,dtype=np.float32)
    valid=[]
    for x in range(w):
        yy=np.flatnonzero(candidate[:,x])
        yy=yy[(yy>=int(h*.09))&(yy<int(h*.87))]
        if len(yy)>10:
            tops[x]=max(0,int(yy.min())-4)
            valid.append(x)
    if len(valid)<w*.60:
        raise ValueError(f'Source is not a recognizable car silhouette: {slug}')
    top=np.interp(np.arange(w),valid,tops[valid]).astype(np.float32)
    top=cv2.medianBlur(top.astype(np.uint8).reshape(1,-1),9)[0].astype(np.float32)
    top=cv2.GaussianBlur(top.reshape(1,-1),(0,0),2)[0]
    upper_points=UPPER[MODEL_BODY.get(slug,'suv')]
    upper_limit=np.interp(np.arange(w)*780/w,
        [p[0] for p in upper_points],[p[1] for p in upper_points])*h/585
    top=np.maximum(top,upper_limit-2)
    points=LOWER[MODEL_BODY.get(slug,'suv')]
    lower=np.interp(np.arange(w)*780/w,
                    [p[0] for p in points],[p[1] for p in points])*h/585
    x0=int(points[0][0]*w/780)
    x1=int(points[-1][0]*w/780)
    mask=np.zeros((h,w),dtype=np.uint8)
    for x in range(x0,x1+1):
        y0=max(0,int(top[x]))
        y1=min(h,int(lower[x]))
        if y1>y0:mask[y0:y1,x]=255
    mask=cv2.GaussianBlur(mask,(5,5),.7)
    fraction=float(np.mean(mask>30))
    if not .22<fraction<.73:
        raise ValueError(f'Unexpected car matte coverage for {slug}: {fraction:.3f}')
    return Image.fromarray(mask,'L')

def save(relative,photo,mask):
    if photo.size!=mask.size:
        raise ValueError(f'Paint variants have different poses: {relative}')
    rgba=photo.convert('RGBA')
    rgba.putalpha(mask)
    for base in ('assets','dist/assets'):
        p=ROOT/base/relative
        p.parent.mkdir(parents=True,exist_ok=True)
        rgba.save(p,'WEBP',quality=90,method=6)
        with Image.open(p) as check:
            assert check.mode=='RGBA' and check.getchannel('A').getextrema()==(0,255)
    print('CUTOUT',relative,flush=True)

for relative in MAN['model_family']:
    slug=family_name(relative)
    if slug not in MASKS:
        MASKS[slug]=mask_from_white(original('models/'+slug+'-arctic_white.webp'),slug)
    save(relative,original(relative),MASKS[slug])

for relative in MAN['exact']:
    model=relative.split('/')[1]
    if model=='g6':continue  # G6 2026 production-cutout previews already have alpha.
    if model not in MASKS:
        MASKS[model]=mask_from_white(original('models/'+model+'-arctic_white.webp'),model)
    save(relative,original(relative),MASKS[model])

print('Rebuilt',len(MAN['model_family'])+len(MAN['exact'])-21,
      'illustrative alpha car assets from unmodified studio originals.')
