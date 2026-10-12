# XPENG Vehicle Card v1.0.0-alpha.2 — PREVIEW ONLY

**Experimental GitHub-only preview, not a finished visual release.** Do not confuse these screenshots with the photoreal, user-approved XPENG G6 design. The current embedded backdrop is an older flat mountain scene; the approved house, lake and wet-pavement plate still needs to replace it. These screenshots were rendered in Chromium from the actual card code, not generated as design concepts.

## What's in this preview

- Card editor offers model, model year, trim, exterior paint and cabin finish; 15 named XPENG models + an "Other" fallback, across 53 model-year catalogue profiles through 2026.
- One common background bitmap across overview and charging; exterior vehicle is a separate transparent overlay selected from real packaged assets.
- 37 bundled year/trim/paint *illustrations* for 2026 G6/G9, plus 80 generic model-family illustrations. The output is labelled appropriately and is **not manufacturer-verified for every year/colour**.
- Transparent-asset checks cover all 117 bundled car overlays, with paired root and HACS assets.
- Optional editor-side specific car image, rear/charging image and interior photo. Changing model, year, trim, paint or cabin finish clears incompatible custom imagery; multi-vehicle artwork does not leak across profiles.
- Automatic entity mapping and per-field manual overrides from any Home Assistant integration.
- Two dashboard states only; charging state automatically switches screens.
- No Home, wall clock or in-card fullscreen button.

## Known problems — review required before merging to main

1. The background and overall picture are **not yet visually the final user-approved design**. It remains a flat earlier approximation.
2. Some older model-family car cutouts have edge artifacts or are only approximate representations. They are for preview, not proof of the correct model-year styling.
3. Cabin is a colour schematic unless the user supplies a separate interior artwork file.
4. The demonstration screenshots contain synthetic test telemetry; **no live readings are invented in the running card**.
5. This preview tag points to the dashboard feature-branch commit only. The backend XPENG Home Assistant integration is separate and untouched.

### Included visual evidence

Release assets contain real desktop and mobile browser screenshots for overview and charging, and representative model/year/paint combinations.

**GitHub PR:** https://github.com/matanmesika/xpeng-vehicle-card/pull/18

**Do not promote to stable/HACS until the owner accepts visual parity of both states.**
