#!/usr/bin/env python3
"""Check licensed photo leads without accidentally publishing them as cutouts."""
import json
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
CAT = json.loads((ROOT / "vehicle-catalog.json").read_text(encoding="utf-8"))
REGISTER = json.loads((ROOT / "sources/vehicle-photo-candidates.json").read_text(encoding="utf-8"))
MAP = json.loads((ROOT / "vehicle-art-map.json").read_text(encoding="utf-8"))
assert REGISTER["auto_publish"] is False, "No automatic publishing of photos"
options = {(m["id"],g["id"]): set(g["colors"]) for m in CAT["models"] for g in m["groups"]}
mapped = {(e["model"],e["year_group"],e["exterior_color"]):e["views"] for e in MAP["entries"]}
AI_PREVIEWS = set(json.loads((ROOT / "sources/ai-generated-vehicle-art.json").read_text(encoding="utf-8"))["paths"])
ids = set()
for source in REGISTER["sources"]:
    assert source["id"] not in ids, "Duplicate candidate ID"
    ids.add(source["id"])
    key = (source["model"],source["year_group"])
    assert key in options, f"Unknown model and generation: {key}"
    colour = source["exterior_color"]
    if colour is not None:
        assert colour in options[key], f"Unsupported paint: {key} {colour}"
    assert source["view"] in (None,"front","charging","top")
    assert source["license_id"] in ("CC-BY-4.0","CC-BY-SA-4.0","CC0-1.0"), "Unsupported or unverified photo licence"
    assert urlparse(source["page_url"]).hostname == "commons.wikimedia.org", "Only verified Commons source pages"
    assert urlparse(source["license_url"]).hostname == "creativecommons.org"
    assert source["photographer"].strip()
    assert source["photo_name"].strip()
    assert source["asset_ready"] is False, "Curation alone must not mark a file ready"
    if colour and source["view"]:
        record = mapped[(source["model"],source["year_group"],colour)][source["view"]]
        if record["status"] == "available":
            assert record["path"] in AI_PREVIEWS, "A photographic candidate was published without provenance"
            # Existing AI-generated preview is independent of this unapproved source photograph.
print("PASS:",len(ids),"licensed photograph leads; none falsely published as a transparent car view")
