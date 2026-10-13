#!/usr/bin/env python3
"""Derive labelled AI paint previews from matching model-generation and camera views.

Input is an existing translucent white render for this exact model/year-group.
Never borrow geometry across vehicle models/generations or angles.
Only the separate exterior body paint is recoloured; glass and tyres stay dark.
Generated renders are illustrative previews, NOT XPENG official car photographs.
"""
from pathlib import Path
from PIL import Image
import numpy as np
import json, re

ROOT=Path(__file__).resolve().parents[1]
CAT=json.loads((ROOT/'vehicle-catalog.json').read_text(encoding='utf-8'))
PAINT={p['id']:p['hex'] for p in CAT['paints']}
ROOT_VEHICLES=ROOT/'assets'/'vehicles'
VIEWS=('front','charging','top')
BASE_WHITES=('arctic_white','nebula_white','everest_white')
# Black Edition / two-tone variants can change body parts, wheels or trim;
# a simple colour transformation would misrepresent their appearance.
DO_NOT_SYNTHESIZE=frozenset(('black_edition','two_tone_gray_silver','matte_new_moon_silver'))
def slug(s):return re.sub('[^a-z0-9_]','',s.lower().replace('+','_plus').replace(' ','_'))

def colourise(src,hexcode):
    a=np.asarray(src.convert('RGBA'),dtype=np.float32)
    rgb=a[...,:3]; alpha=a[...,3]
    top=rgb.max(axis=2);low=rgb.min(axis=2)
    chroma=(top-low)/np.maximum(top,1)
    intensity=rgb.mean(axis=2)
    # Keep tinted windows, rubber and dark wheel regions unmodified.
    mask=np.clip((intensity-118.0)/70.0,0,1)*np.clip((.30-chroma)/.17,0,1)*np.clip((alpha-60.0)/125.0,0,1)
    mask=mask**.75
    target=np.array([int(hexcode[k:k+2],16) for k in (1,3,5)],dtype=np.float32)
    illum=np.clip(intensity/223.0,.42,1.21)
    if target.mean()<65:
        target=target*.75+np.array([43,45,48])*0.25
        illum=.75+.28*illum
    transformed=np.clip(target[None,None,:]*illum[...,None],0,255)
    pixels=np.concatenate([rgb*(1-mask[...,None])+transformed*mask[...,None],alpha[...,None]],axis=2)
    return Image.fromarray(np.uint8(np.clip(pixels,0,255)),'RGBA')

def build():
    provenance_file=ROOT/'sources'/'ai-generated-vehicle-art.json'
    provenance=json.loads(provenance_file.read_text(encoding='utf-8'))
    prior=set(provenance['paths'])
    additional=[]
    detail=[]
    for model in CAT['models']:
        for group in model['groups']:
            folder=ROOT_VEHICLES/slug(model['id'])/group['id']
            white=next((x for x in BASE_WHITES if x in group['colors'] and
                        all((folder/x/(view+'.webp')).is_file() for view in VIEWS)),None)
            if not white:
                continue  # Cannot create rear/top out of a front photo.
            for paint in group['colors']:
                if paint==white or paint in DO_NOT_SYNTHESIZE:
                    continue
                if paint not in PAINT:raise ValueError('Paint without swatch: '+paint)
                for view in VIEWS:
                    source=folder/white/(view+'.webp')
                    dest=folder/paint/(view+'.webp')
                    if dest.exists():
                        continue
                    with Image.open(source) as im:
                        im.load()
                        if 'A' not in im.getbands() or im.getchannel('A').getextrema()[0]>=245:
                            raise ValueError('Base image lacks transparency: '+str(source))
                        new=colourise(im,PAINT[paint])
                    dest.parent.mkdir(parents=True,exist_ok=True)
                    new.save(dest,'WEBP',quality=94,method=3)
                    relative=str(dest.relative_to(ROOT/'assets'))
                    additional.append(relative)
                    detail.append(dict(path=relative,derived_from=str(source.relative_to(ROOT/'assets')),
                                       method='illustrative-white-master-paint-overlay',
                                       manufacturer_verified=False,design_review='pending'))
    if additional:
        provenance['paths']=sorted(prior.union(additional))
        note='Programmatically recoloured AI preview paint options; own model/year-group and camera view used, manufacturer fidelity not verified.'
        if note not in provenance['notes']:provenance['notes'].append(note)
        provenance_file.write_text(json.dumps(provenance,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
        index=ROOT/'sources'/'derived-paint-views.json'
        old=json.loads(index.read_text(encoding='utf-8')) if index.exists() else {'schema_version':1,'items':[]}
        old['items'].extend(detail)
        old['items']=sorted({x['path']:x for x in old['items']}.values(),key=lambda x:x['path'])
        index.write_text(json.dumps(old,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print('Generated',len(additional),'new AI paint views from matching 3-view master sets.')
    print('No foreign models, missing angles, Black Edition or two-tone substitutions.')
    return additional

if __name__=='__main__':build()
