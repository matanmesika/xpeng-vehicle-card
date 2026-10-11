"""Generate real transparent cutouts from the repo's OWN licensed/illustrative art.

Removes dark studio backdrops without inventing vehicle geometry.
Requires Pillow, numpy and opencv-python-headless.
The original non-cutout assets are preserved.
"""
from pathlib import Path
import numpy as np
import cv2
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
SOURCES=[p for p in (ROOT/'assets').rglob('*.webp')
         if 'cutouts' not in p.parts and p.name!='g6-studio.webp']

def create_cutout(source:Path,dest:Path):
    im=Image.open(source).convert('RGB')
    W,H=im.size
    factor=0.5 if W>650 else 1.0
    w,h=max(160,int(W*factor)),max(120,int(H*factor))
    src=np.asarray(im.resize((w,h),Image.Resampling.BILINEAR))
    rgb=cv2.cvtColor(src,cv2.COLOR_RGB2BGR)
    mask=np.full((h,w),cv2.GC_PR_BGD,dtype=np.uint8)
    mask[int(.13*h):int(.94*h),int(.02*w):int(.98*w)]=cv2.GC_PR_FGD
    # Likely light body paint is certain foreground, but dark paint still has
    # a centre region seeded so black vehicles do not get removed.
    light=(src.mean(axis=2)>142)&(src.max(axis=2)-src.min(axis=2)<110)
    yy=np.arange(h)[:,None]
    mask[light&(yy>h*.17)&(yy<h*.87)]=cv2.GC_FGD
    if (mask==cv2.GC_FGD).sum()<w*h*.015:
        mask[int(.43*h):int(.61*h),int(.34*w):int(.67*w)]=cv2.GC_FGD
    mask[:int(h*.11),:]=cv2.GC_BGD
    mask[-int(h*.05):,:]=cv2.GC_BGD
    mask[:,:int(w*.015)]=cv2.GC_BGD
    mask[:,-int(w*.015):]=cv2.GC_BGD
    cv2.grabCut(rgb,mask,None,np.zeros((1,65),np.float64),
                np.zeros((1,65),np.float64),4,cv2.GC_INIT_WITH_MASK)
    fg=np.isin(mask,[cv2.GC_FGD,cv2.GC_PR_FGD]).astype(np.uint8)*255
    n,components,stats,_=cv2.connectedComponentsWithStats(fg)
    clean=np.zeros_like(fg)
    for i in range(1,n):
        if stats[i,cv2.CC_STAT_AREA]>w*h*.002:
            clean[components==i]=255
    contours,_=cv2.findContours(clean,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(clean,contours,-1,255,cv2.FILLED)
    clean=cv2.GaussianBlur(clean,(5,5),0.8)
    fraction=(clean>127).mean()
    if not .12<fraction<.85:
        raise ValueError(f'Segmentation could not isolate the car: {source} fraction={fraction:.3f}')
    alpha=Image.fromarray(clean,'L').resize((W,H),Image.Resampling.LANCZOS)
    out=im.convert('RGBA')
    out.putalpha(alpha)
    dest.parent.mkdir(parents=True,exist_ok=True)
    out.save(dest,'WEBP',quality=87,method=5)
    assert Image.open(dest).mode=='RGBA',dest
    return fraction

if __name__=='__main__':
    failures=[]
    for path in SOURCES:
        dest=ROOT/'assets'/'cutouts'/path.relative_to(ROOT/'assets')
        try:
            fraction=create_cutout(path,dest)
            print(f'{dest.relative_to(ROOT)}: retained {fraction:.1%}')
        except Exception as exc:
            failures.append(str(exc))
    if failures:
        raise RuntimeError('Background removal requires review: '+'; '.join(failures))
    print(f'Generated {len(SOURCES)} transparent XPENG vehicle cutouts.')
