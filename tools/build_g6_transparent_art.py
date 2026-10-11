"""Build alpha-cutout previews for the 2026 G6 from existing bundled studio artwork.

This is an illustrative matte pipeline, not a claim of a verified manufacturer
photo or exact vehicle paint. It removes the rectangular studio backdrop so the
dashboard's independent night-mountain background is continuous.
"""
from pathlib import Path
from PIL import Image
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'dist' / 'assets'
W, H = 1536, 1024
MODEL_YEAR = '2026'
TRIMS = ('core_rwd', 'core_plus_rwd', 'core_performance_awd', 'unspecified')
PAINTS = {
    'arctic_white': 'arctic_white',
    'graphite_gray': 'space_grey',
    'midnight_black': 'jet_black',
    'silver_frost': 'silver_frost',
    'stellar_purple': 'stellar_purple',
}
# Silhouette guide, normalized from the model-year target pose.
# This is only an initialization; GrabCut uses the actual pixels to refine it.
GUIDE = [
 (977,371),(964,324),(938,306),(881,187),(794,72),(750,41),
 (555,23),(436,51),(350,116),(305,171),(277,246),(244,231),
 (228,249),(210,311),(152,353),(58,451),(32,524),(14,683),
 (14,763),(36,807),(71,825),(139,825),(186,864),(436,901),
 (499,963),(537,961),(556,916),(728,828),(785,841),(844,812),
 (867,831),(905,825),(946,755),(966,696),(968,612),(984,574),
]

def alpha_from_white(source):
    full = np.asarray(source.convert('RGB'))
    assert full.shape[:2] == (H,W), f'Expected G6 2026 asset 1536×1024; got {full.shape}'
    tw, th = 768,512
    sample = cv2.resize(full,(tw,th),interpolation=cv2.INTER_AREA)
    poly = np.array([[(10+1.51*x)*tw/W,(134+.805*y)*th/H] for x,y in GUIDE], dtype=np.float32).astype(np.int32)
    guide=np.zeros((th,tw),np.uint8)
    cv2.fillPoly(guide,[poly],255)
    eroded=cv2.erode(guide,np.ones((9,9),np.uint8))
    expanded=cv2.dilate(guide,np.ones((23,23),np.uint8))
    flags=np.full((th,tw),cv2.GC_BGD,np.uint8)
    flags[expanded>0]=cv2.GC_PR_BGD
    flags[guide>0]=cv2.GC_PR_FGD
    flags[eroded>0]=cv2.GC_FGD
    bgd=np.zeros((1,65),np.float64)
    fgd=np.zeros((1,65),np.float64)
    cv2.grabCut(cv2.cvtColor(sample,cv2.COLOR_RGB2BGR),flags,None,bgd,fgd,7,cv2.GC_INIT_WITH_MASK)
    matte=np.where((flags==cv2.GC_FGD)|(flags==cv2.GC_PR_FGD),255,0).astype(np.uint8)
    n,labels,stats,_=cv2.connectedComponentsWithStats(matte,8)
    for i in range(1,n):
        if stats[i,cv2.CC_STAT_AREA]<35:matte[labels==i]=0
    matte=cv2.resize(matte,(W,H),interpolation=cv2.INTER_LINEAR)
    matte=cv2.GaussianBlur(matte,(3,3),.7)
    pix=int(np.count_nonzero(matte>32))
    assert W*H*.13 < pix < W*H*.60, f'Unexpected car silhouette area {pix}'
    return Image.fromarray(matte,'L')

def export():
    matte=alpha_from_white(Image.open(ASSETS/'g6-2026-arctic_white.webp'))
    for paint,legacy in PAINTS.items():
        source=Image.open(ASSETS/f'g6-2026-{legacy}.webp').convert('RGBA')
        assert source.size == (W,H)
        source.putalpha(matte)
        trims=TRIMS + (('black_edition',) if paint=='midnight_black' else ())
        for trim in trims:
            for assetdir in ('assets','dist/assets'):
                dest=ROOT/assetdir/'vehicles'/'g6'/MODEL_YEAR/trim/f'{paint}.webp'
                dest.parent.mkdir(parents=True,exist_ok=True)
                source.save(dest,'WEBP',quality=84,method=6)
                check=Image.open(dest)
                assert check.mode=='RGBA' and check.getextrema()[3][0]==0
                print(dest.relative_to(ROOT),dest.stat().st_size,'bytes')
if __name__=='__main__':
    export()
