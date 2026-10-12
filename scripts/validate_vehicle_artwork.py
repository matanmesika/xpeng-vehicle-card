#!/usr/bin/env python3
"""Validate separately rendered XPENG dashboard artwork; no collage slicing."""
import argparse
from pathlib import Path
from PIL import Image

VIEWS = ("front", "charging", "top")

def validate(root: Path):
    failures = []
    groups = sorted(p for p in root.glob("*/*/*/*") if p.is_dir())
    if not groups:
        return ["No model/year/trim/color image sets found"]
    for group in groups:
        for view in VIEWS:
            candidates = [group / f"{view}.{ext}" for ext in ("webp", "png")]
            existing = [p for p in candidates if p.is_file()]
            if len(existing) != 1:
                failures.append(f"{group}: expected one separate {view} image, found {len(existing)}")
                continue
            p = existing[0]
            try:
                with Image.open(p) as im:
                    im.load()
                    if im.width < 800 or im.height < 800:
                        failures.append(f"{p}: image smaller than 800px")
                    if "A" not in im.getbands():
                        failures.append(f"{p}: no alpha channel")
                    else:
                        alpha = im.getchannel("A")
                        lo, hi = alpha.getextrema()
                        if lo != 0 or hi != 255:
                            failures.append(f"{p}: expected fully transparent background and opaque car pixels")
            except Exception as exc:
                failures.append(f"{p}: cannot decode: {exc}")
    return failures

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("root", nargs="?", default="assets/vehicles")
    args = parser.parse_args()
    failures = validate(Path(args.root))
    if failures:
        print("\n".join("FAIL: " + x for x in failures))
        raise SystemExit(1)
    print("PASS: separate front, charging, top artwork files have dimensions and alpha")
