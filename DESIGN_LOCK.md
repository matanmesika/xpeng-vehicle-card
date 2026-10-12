# XPENG Dashboard — Approved Design Lock

> **PHOTO ASSETS EMBEDDED IN v1.0.0-alpha.4 (experimental).** The one user-approved 1536×864 screenshot is documented in [VISUAL_REFERENCE_G6_2026.md](VISUAL_REFERENCE_G6_2026.md) by original JPEG file name and SHA-256. That screenshot is the binding acceptance target; never swap it for an AI-generated mockup. This is a frontend-only repository.

## Approved visual baseline

- **Current bundled backdrop**: `dist/assets/xpeng-approved-lakeside-background.webp` (identical root copy). The owner's approved house, lake, mountains, and wet-pavement scene is now a default photograph in both views, with no external uploads needed. This is a clean extracted asset from the approved concept, not a claim that every composite screenshot is pixel-identical.
- New approved background Git blob SHA: `a28766ffcb8607f096077e67fdc3fbb04b79c883`. Original owner reference remains the benchmark for overall layout, despite the new background being packaged.
- `.xp-night-photo` is a full-bleed layer positioned `center center`, sized `cover` in **both** screens. Never create another SVG/CSS approximation, season/weather variation, charger-only background or model-specific background.
- **Two view states only**, no manual navigation or third page. Vehicle status by default; Charging only while the mapped charge sensor reports active charging.
- No Home, wall clock or Full Screen icon. Keep only minimal top-right information/connection indicators, subject to the approved screen reference.
- Vehicle status: white 2026 XPENG G6 visual baseline, SOC/range left, odometer/tires/location right. Charging: same backdrop, dynamic vehicle and station/cable, SOC/range/power/time/limit in left charging panel.
- **Layout and appearance are locked against unsolicited redesigns.** The latest owner-favoured reference and the repository screenshot output still need a direct comparison; don't silently equate the existing asset with a newer generated concept.

## Editing and data boundaries

- Vehicle model, model year, trim, exterior colour and interior finish are **manual options exclusively in the card editor**. No controls on dashboard screens.
- All telemetry comes from Home Assistant states, with individual manual mappings from any integration OR automatic prefix-based mapping. No private XPENG API dependency, no invented live values.
- Use `dist/assets/vehicles/<model>/<year>/<trim>/<colour>.webp` when the **exact asset exists**. Existing G6 2026 and G9 2026 model-year images are previews only, not independently verified manufacturer photos.
- An unsupported year/trim/paint must show an **explicitly illustrative** fallback, never silently reuse another year or colour. Modern models without year-specific art remain unverified; do not relabel generic pictures as current facelifts.
- Interior finish illustration in the optional information popup follows manual selection; do not create a new full-screen cabin page.

## Release and screenshot gates

1. Run Node tests, browser desktop/mobile tests and HACS validation.
2. Compare screenshots from the **actual Lovelace card** in both modes, against the current owner-approved screen references. Pixel-identical shared backgrounds are necessary but not sufficient.
3. Keep this work in **draft PR #18** until the owner approves visual parity. No tag/version increment or release as a substitute for design review.
4. Updating assets requires a deliberate proposal with before/after images. An assistant-generated design mockup is **not** permission to replace the approved baseline.
5. Do not modify the `xpeng-direct-homeassistant` integration/backend for card work.
