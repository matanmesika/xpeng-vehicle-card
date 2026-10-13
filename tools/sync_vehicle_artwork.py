#!/usr/bin/env python3
"""Rebuild repository artwork inventory and embedded frontend asset index.

Run after adding correctly labelled WebP files to assets/vehicles/ in the canonical folders.
Use --check in CI to detect out-of-date mapping artifacts.
"""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VIEWS = ("front", "charging", "top")


def slug(model: str) -> str:
    return re.sub(r"[^a-z0-9_]", "", model.lower().replace("+", "_plus").replace(" ", "_"))


def build():
    catalog = json.loads((ROOT / "vehicle-catalog.json").read_text(encoding="utf-8"))
    entries = []
    for model in catalog["models"]:
        for group in model["groups"]:
            for color in group["colors"]:
                views = {}
                for view in VIEWS:
                    path = f"vehicles/{slug(model['id'])}/{group['id']}/{color}/{view}.webp"
                    f = ROOT / "assets" / path
                    if f.is_file():
                        header = f.read_bytes()[:12]
                        if f.stat().st_size < 100 or header[:4] != b"RIFF" or header[8:12] != b"WEBP":
                            raise ValueError(f"Invalid WebP: {f}")
                    views[view] = {"path": path, "status": "available" if f.is_file() else "pending"}
                entries.append({"model": model["id"], "year_group": group["id"], "exterior_color": color, "views": views})
    exact = sorted(v["path"] for e in entries for v in e["views"].values() if v["status"] == "available")
    if len(exact) != len(set(exact)):
        raise ValueError("Duplicate artwork asset path")
    pending = sum(any(v["status"] == "pending" for v in e["views"].values()) for e in entries)
    art_map = {
        "schema_version": 1, "as_of": "2026-10-13", "catalog": "vehicle-catalog.json",
        "selection_key": ["model", "year_group", "exterior_color"], "trim_affects_artwork": False,
        "asset_root": "assets", "views": list(VIEWS),
        "description": "Model year filters paints, shared body-generation groups select assets; missing views are pending.",
        "entries": entries,
    }
    inventory = {
        "schema_version": 3, "as_of": "2026-10-13", "catalog": "vehicle-catalog.json",
        "artwork_map": "vehicle-art-map.json",
        "path_pattern": "vehicles/{model}/{year_group}/{exterior_color}/{front,charging,top}.webp",
        "backdrop": "xpeng-approved-lakeside-background.webp", "backdrop_is_common": True,
        "trim_affects_artwork": False, "exact": exact, "model_family": [],
        "known_uploaded_now": exact, "model_count": len(catalog["models"]),
        "year_group_count": sum(len(m["groups"]) for m in catalog["models"]),
        "paint_combination_count": len(entries), "pending_combination_count": pending,
        "caveats": [
            "Available means a WebP file exists, not that it has manufacturer-verified provenance or accuracy.",
            "G6 2023-2025, G7 2025 and G9 2025-2026 are AI-generated illustrations, not official manufacturer photography; see sources/ai-generated-vehicle-art.json.",
            "Missing combinations display a labelled color-matched fallback, never images borrowed from other model/year/paint.",
            "Runtime default artwork uses GitHub main branch URLs after merging and needs internet access.",
            "Color palette HEX values are approximations for the UI, not manufacturer-certified paint codes; color availability differs by market.",
        ],
    }
    return art_map, inventory, exact


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--check", action="store_true", help="Check generated metadata and JS without writing")
    args = p.parse_args()
    art_map, inventory, exact = build()
    provenance = json.loads((ROOT / "sources/ai-generated-vehicle-art.json").read_text(encoding="utf-8"))
    illustrative = sorted(provenance["paths"])
    if len(illustrative) != len(set(illustrative)) or not set(illustrative).issubset(set(exact)):
        raise ValueError("Provenance paths must be unique existing artwork paths")
    files = {
        ROOT / "vehicle-art-map.json": json.dumps(art_map, indent=2, ensure_ascii=False) + "\n",
        ROOT / "vehicle-art-inventory.json": json.dumps(inventory, indent=2, ensure_ascii=False) + "\n",
    }
    old = re.compile(r"^const XP_ARTWORK_INDEX = new Set\(.*\);$", re.M)
    ai_pattern = re.compile(r"^const XP_ILLUSTRATIVE_ARTWORK_INDEX = new Set\(.*\);$", re.M)
    index = "const XP_ARTWORK_INDEX = new Set(" + json.dumps(exact, separators=(",", ":")) + ");"
    ai_index = "const XP_ILLUSTRATIVE_ARTWORK_INDEX = new Set(" + json.dumps(illustrative, separators=(",", ":")) + ");"
    for path in (ROOT / "src/xpeng-vehicle-card.js", ROOT / "dist/xpeng-vehicle-card.js"):
        content = path.read_text(encoding="utf-8")
        if len(old.findall(content)) != 1:
            raise ValueError(f"Missing or repeated asset index in {path}")
        if len(ai_pattern.findall(content)) != 1:
            raise ValueError(f"Missing or repeated illustration index in {path}")
        files[path] = ai_pattern.sub(lambda _: ai_index, old.sub(lambda _: index, content))
    for path, content in files.items():
        if args.check:
            if not path.exists() or path.read_text(encoding="utf-8") != content:
                raise SystemExit(f"OUT OF SYNC: {path.relative_to(ROOT)}. Run python tools/sync_vehicle_artwork.py")
        else:
            path.write_text(content, encoding="utf-8")
    print(f"PASS: {len(art_map['entries'])} combinations; {len(exact)} actual WebP views; {inventory['pending_combination_count']} pending combinations")


if __name__ == "__main__":
    main()
