#!/usr/bin/env python3
"""Check provenance completeness without inventing authenticity or licensing.

An available WebP must be explicitly classified as either an AI illustration
or a pre-existing file whose origin remains unverified. This audit does not
prove model correctness, angle correctness, source licences or factory paint.
"""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
def read(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))

def run():
    art=read("data/vehicle-art-map.json")
    ai=read("sources/ai-generated-vehicle-art.json")
    unverified=read("sources/unverified-existing-artwork.json")
    derived=read("sources/derived-paint-views.json")
    exact={v["path"] for entry in art["entries"] for v in entry["views"].values() if v["status"]=="available"}
    present={str(p.relative_to(ROOT / "assets")) for p in (ROOT / "assets" / "vehicles").rglob("*.webp")}
    assert exact==present, f"Artwork map/file mismatch: missing={sorted(exact-present)}, extra={sorted(present-exact)}"
    ai_paths=set(ai["paths"])
    unknown=set(unverified["paths"])
    assert len(ai_paths)==len(ai["paths"]), "Duplicate AI provenance paths"
    assert len(unknown)==len(unverified["paths"]), "Duplicate unverified paths"
    assert not ai_paths.intersection(unknown), "Contradictory AI/unverified provenance"
    assert exact==ai_paths|unknown, (
        f"Artwork provenance incomplete: unclassified={sorted(exact-(ai_paths|unknown))}; "
        f"stale={sorted((ai_paths|unknown)-exact)}"
    )
    assert ai["manufacturer_verified"] is False
    assert ai["photographic_source"] is False
    assert unverified["manufacturer_verified"] is False
    assert unverified["classification"]=="origin_unverified"
    derived_paths=set()
    matte_overlays=[]
    for item in derived["items"]:
        dest=item["path"]; source=item["derived_from"]
        assert dest not in derived_paths, f"Duplicate paint provenance: {dest}"
        derived_paths.add(dest)
        assert dest in ai_paths, f"Derived preview missing AI classification: {dest}"
        assert source in exact, f"Missing base artwork for paint preview: {source}"
        d=Path(dest).parts;s=Path(source).parts
        assert len(d)==5 and len(s)==5, f"Bad paint source path: {dest}"
        assert d[:3]==s[:3] and d[-1]==s[-1], f"Cross-generation or cross-view substitution: {dest} <- {source}"
        assert item["manufacturer_verified"] is False
        if "matte" in d[-2] or "black_edition" in d[-2] or "two_tone" in d[-2]:
            matte_overlays.append(dest)
    assert derived_paths.issubset(ai_paths)
    print(f"PASS: {len(exact)} existing WebP files, {len(ai_paths)} AI-classified, {len(unknown)} origin-unverified, {len(derived_paths)} derived previews.")
    if matte_overlays:
        print("REVIEW REQUIRED: matte/special paint cannot be factory-faithfully reproduced by a glossy recolour:")
        for name in matte_overlays:print("  "+name)
    return True

if __name__=="__main__":run()
