# Model / year-group / exterior-colour artwork mapping

This repository is the **XPENG Lovelace frontend only**. The Home Assistant integration, sensor data and approved lake/mountain background remain unchanged.

## Three criteria, one asset key

1. Model (`G6`, `G9`, `P7i`, etc.).
2. Exterior generation / year group (`2023-2025` or `2026`; a numeric year resolves to the matching group).
3. Exterior colour (available choices are filtered by model and group).

**Trim is display-only.** Its dropdown is filtered by model and year group; selecting any trim never selects a different asset, alters the cabin palette, or changes telemetry. Interior finish is a visual cabin palette selection and does not select a car exterior image.

The hierarchy is:

```text
assets/vehicles/<model-slug>/<year-group>/<exterior-colour>/
  front.webp       # Vehicle status
  charging.webp    # Charging screen (its own camera view)
  top.webp         # Tire-pressure detail (top-down image)
```

The canonical catalog is `vehicle-catalog.json`. `vehicle-art-map.json` contains every known model/year-group/paint combination, with one explicit path and status (`available` or `pending`) for each view. `vehicle-art-inventory.json` lists only files present on disk; `model-artwork.json` describes selection semantics.

The initial inventory spans **15 catalogue models, 18 generation groups, and 83 exterior-paint combinations**. Only the five 2026 G6 colours already represented by 15 WebP assets have pictures on disk. The other combinations have named folders and `.gitkeep` files, not fabricated renders. A missing view displays a clearly labelled colour-matched illustration, never a picture from a different model/year group/colour, and never a front shot pretending to be the rear or overhead view.

## Add new photos without editing JavaScript

1. Obtain permission to distribute each photo or rendering. For authenticity, check generation, paint, angle, and transparent alpha; avoid copying website images without a licence.
2. Drop each real WebP into its exact matching folder. Each of the three views may be delivered independently.
3. At the repository root run `python tools/sync_vehicle_artwork.py`. It scans the files, validates WebP headers, regenerates both maps and synchronizes the embedded index in `src/` and `dist/`.
4. Validate with `python tools/sync_vehicle_artwork.py --check` and `node --test tests/vehicle-artwork-mapping.test.cjs`.
5. Merge/publish to update the online GitHub raw URLs read by the card, or set `image_path` to an existing Home Assistant local path. The approved background is untouched.

**Limitations:** the presence of a file does not prove manufacturer authenticity. The current default loader reads artwork from the GitHub repository at runtime and therefore requires internet; `image_path` allows an explicitly configured local artwork root. No scraping/undocumented XPENG API and no arbitrary remote user-specified image URL are used.

## Batch 1 — genuine, licensed photograph leads (2026-10-13)

The first set of third-party **photographs** is tracked in `sources/vehicle-photo-candidates.json`. These are real vehicle photos, not AI-generated artwork. Sources include 2023 original G6 Fiery Orange, a CC0 white original G6 photo, 2025 facelift G6 AWD Black Edition, and a 2025 refreshed G9 photo, all with documented author, source and licence.

Their status is `reference_found`. **No photographs were inserted into the live overlay slots**, because the sources are opaque JPEG photographs and cannot yet replace the transparent, angle-matched WebP cutouts. Visual colour verification, model-year/market checking, optional background removal, transparency inspection and attribution are required. Attribution and Share-Alike terms must be preserved on derivative cutouts.

Run `python tools/check_photo_candidates.py` to check that no source record has been misreported as a live image. This register is intentionally independent of runtime loading and cannot change the dashboard layout/background.
