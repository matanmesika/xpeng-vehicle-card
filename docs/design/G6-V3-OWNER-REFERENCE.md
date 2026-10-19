# G6 owner-approved TPMS / HVAC / Charging pedestal
The original approved lakeside background, top-view vehicle PNG/WEBP, owner cabin interior
images, grey charging car art, and thin live charging cable are **untouched**.
Changes are isolated to `src/design/xpeng-vehicle-card.css` and view markup
in `src/core/xpeng-vehicle-card.runtime.js` needed for presentation.

- **TPMS**: original top-view image with four turquoise wheel markers and four
  glass rectangular pressure readouts adjacent to those wheels; units follow
  card settings. Temperature (°C) and tire air-life (%) appear *only when
  the corresponding mapped pressure sensor actually exposes attributes*.
  Maintenance displays tire-pressure only; odometer/VIN/service were removed
  from this particular page per owner's request.
- **Climate**: photo and seat/steering hotspots unchanged; only the control
  panel is rearranged to target temperature, Power/AUTO modes, segmented
  fan range and optional climate features. Fan min/max/step and supported
  functions still come from Xpengtk/Home Assistant.
- **Charging pedestal**: sculpted dark charging tower using CSS and an official
  MDI station symbol. The existing image of the actual car and cable
  routing remain unchanged.

Avoid fake functions or imaginary states. Run the reference guardian, browser
screenshots on 1400px desktop / 390px mobile / narrow Home Assistant Sections,
and the full regression suite. Do not merge into main without owner approval.

## Acceptance changes
Older tests that expected odometer/model year inside Maintenance are replaced with
a check for **only four mapped TPMS tiles**. Model year remains on its original
integration entity; it is not deleted or synthesized. The station HTML keeps
the native `mdi:ev-station` icon in the new facade. Browser QA verifies that
the tire view scrolls to its real sensor note, not obsolete service details.
