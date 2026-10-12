# XPENG G6 — Mandatory visual reference (owner-approved)

> **This is the ONLY approved design for the Vehicle status screen.** Do not substitute any generated concept, alternative background, layout or colour scheme without explicit owner approval.

## Source of truth

- Original user-supplied image: `A0247C1F-0CF7-4A50-8240-5E89164656B0.jpeg` (conversation attachment, 2026-10-12).
- Resolution: **1536 × 864 pixels (16:9)**.
- SHA-256 of the original JPEG bytes: `4a89cbb0f833da603d2477c76db5c402ffc7624c39ae18389f6245b8a4cf8d6e`.
- **The original reference image is NOT yet installed as a clean production backdrop.** Current `xpeng-reference-background.webp` is a different, earlier approximation. Do not claim visual parity or publish a stable release while this is unresolved.
- The original JPEG has a car and static text baked into it. It **must not** be installed whole as the live card background: numbers and car would be duplicated or frozen. Extract/reconstruct a *clean, pixel-faithful* scenic plate and overlay dynamic car/telemetry independently; submit real browser screenshots for review.

## Frozen layout — 1536 × 864 desktop reference

- **Backdrop:** dark navy/blue mountain range with snowy ridges. A modern home on the **far left** emits warm orange light; trees, lake and warm shoreline lights stretch behind the car. Wet dark pavement reflects warm window lights and the car's cooler blue highlights. Background must be the **same bitmap, crop, position, scale** for both status and charging modes.
- **Header:** white XPENG logomark/wordmark at top left (roughly x 45–249, y 45–76). Top-right has a subtle blue connectivity glyph and a small outlined information icon. **No** Home button, wall clock or fullscreen icon.
- **Title:** `XPENG G6` in white with light-blue G6 letters, left at x≈80–407, y≈174–223; `Vehicle status` beneath at x≈80, y≈238–265.
- **Car:** white **2026 G6 facelift**, three-quarter front view, central area approx x≈418–1154, y≈260–630, wheels touching wet pavement. Preserve its front LED line, grille shape, wheel proportions, paint, orientation and natural reflections. Do not insert an older G6, a silver G6, a rear-view car or a generic SUV.
- **Left telemetry:** small green battery glyph / `Battery` caption at x≈80, y≈475; prominent dynamic SOC percentage at x≈160–290, y≈505–565; thin blue progress indicator around y≈593; `Estimated range` below with prominent dynamic range around x≈130–320, y≈679–717. Missing sensors show an unavailable marker, **never** baked-in `62%` or `391 km`.
- **Right information panel:** dark blue translucent rounded card roughly x≈1160–1500, y≈495–760, with three horizontal rows: Odometer, Tire pressure, Location. Small white line icons on the left, values from HA sensor mappings, chevrons on the right and subtle row dividers. Do not move this panel to the left.
- **Charging view:** same **exact background image**, colour, scene/crop and brand elements; the charging-specific layout approved earlier has the charging info card left, G6 and charging station/cable on right. Charging view appears **only while a charging-state sensor says charging**.

## Functional boundaries

- **Frontend only:** never edit the separately maintained XPENG vehicle/backend integration when working on this design.
- The model/year/trim/exterior/interior choices and optional 15 per-field HA sensor mappings remain **exclusively in the Lovelace card editor**. No settings widgets on dashboard.
- Automatic entity discovery by prefix is the default; manually selected HA entities from **any integration**, including attribute paths, override per-field automatic values.
- All telemetry is live. The original static example values in the screenshot are reference-only test fixtures.
- Exact artwork for other models/year variants is future work, starting only after this G6 2026 scene passes visual acceptance.
- Interior trim presentation should reflect the user's manual choice but never redesign the approved two-view layout.

## Release acceptance

1. Confirm correct production asset files exist, with provenance; remove obsolete background candidates only after exact approved replacements are installed and tested.
2. Render **real** Home Assistant/Chromium screenshots at 1536×864 and at mobile resolution, in both status and charging states; do not present AI-generated concept art as the running card.
3. Compare actual output **side by side** against this reference: background, vehicle silhouette, typography, position, panels, lighting, reflections and asset quality. Same-background CI alone is insufficient.
4. Require owner's explicit signoff before merging, changing version numbers or publishing through HACS.
