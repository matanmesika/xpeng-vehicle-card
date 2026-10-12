# XPENG shape-aware transparent vehicle artwork and four-tire TPMS

Frontend/dashboard only. The XPENG Home Assistant integration/backend is **not modified**.

## Shape and asset indexing

- `shape-artwork.json` contains the exhaustive matrix of 53 configured model-year profiles with available trims and paint choices.
- For each combination, it records `shape_options` (generation / facelift), a transparent `front` image if one has actually been packaged, and a separate `rear` image only if one has actually been verified.
- On this revision there are **37 bundled year/trim/color-specific front-image paths** for G6/G9 2026, plus **80 model-family illustrations**; **zero independently verified rear cutouts**. Naming a file by model/year is not photographic verification. `shape_verified:false` remains explicit.
- G6 and G9 were refreshed in 2025 according to XPENG: https://www.xpeng.com/news/019762f4239996d25db58a02820b01b0 . The dashboard offers both original and refreshed generations for 2025 where a market/year designation may differ, and does not claim the original generation survives into 2026.
- Other model-family images are **illustrative, unverified**. No exact manufacturer packshot is invented or imported from another model year.
- A 2024 G6/G9 currently shows a labelled neutral placeholder rather than reusing a potentially incorrect studio image. 2026 G6/G9 use their specific available front previews. In Charging a front cutout may be reused *only while explicitly labelled as 'front_fallback_rear_pending'*, not represented as a genuine rear photo.
- Designer or user can override `image:` (overview) and `charging_image:` (rear) with **genuinely matching transparent PNG/WebP** served from `/local/` or `/hacsfiles/`; changing model/year/trim/color/generation clears old overrides in the card editor.
- Artwork remains isolated from the fixed approved lakeside background and bundled as HACS-downloadable assets (direct files in `dist/`).

## Adding new official photo cutouts

1. Verify manufacturer variant and market, year, trim, exterior paint and whether exterior shape actually changed.
2. Export a **transparent cutout**, check visible wheel/headlight/rear-light form, and avoid visible checkerboard pixels: checkerboard must be transparency-preview only.
3. Include distinct `front` and `rear` cutouts, or explicitly leave rear as missing. Do not mirror the front shot and claim it is a rear.
4. Add assets to inventory, frontend source index, HACS flat distribution and every matching shape/year/trim/paint manifest record.
5. Validate alpha channel, checksum, backdrop consistency and real Chromium screenshots in both states.

## Tire pressure details

- In the existing Vehicle status information panel, click **Tire pressure** to open a small car-top-view diagram with front-left, front-right, rear-left, rear-right values.
- Uses the existing four read-only HA mappings `tire_fl`, `tire_fr`, `tire_rl`, `tire_rr`, which can each point to a dedicated entity or entity attribute.
- Converts sensor unit `kPa`, `bar`, `psi`, or `Pa` to displayed bar. Unknown unit, invalid, absent or implausible value displays `—`.
- No fictional pressures and no vehicle-specific danger thresholds. Does not add a third screen, doesn't control TPMS, and does not alter charging UI.
