"""Static regressions for catalogue portability and expanded card."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/"model-catalog.json").read_text())
assert len(data["models"])==16 and len(data["paints"])==5
assert all("Israel" not in t["label"] for group in data["trims"].values() for t in group)
src=(ROOT/"xpeng-vehicle-card.js").read_text()
assert "data-expand" in src and "data-expanded" in src
assert "const XP_CATALOG = Object.freeze(" in src
assert "Israel" not in src and "Israeli" not in src
assert src == (ROOT/"dist/xpeng-vehicle-card.js").read_text()
assert "callService(" not in src
print("PASS: worldwide visual catalogue, expandable card, read-only safety")
