# G6 owner review — Beta 15 maintenance, climate and map follow-up

The night lakeside background, vehicle and cabin artwork, charging pedestal, thin green
active cable, mapped vehicle entities and command handlers must stay unchanged.

## Maintenance
- Four genuine pressure sensors remain alongside the original G6 overhead photo.
- Remove turquoise decorative *wheel outline overlays*, not the four real tire pressure readings.
- Move the tire MDI glyph toward the right side within the two left-hand readouts.
- Restore next service, next date, remaining days/km, odometer, model year, and masked VIN
  **only** if those sensor states/attributes are available. Never guess a service date.
- Wide desktop: two side-by-side areas — TPMS image and vehicle maintenance.
  Narrow Sections/iPhone: the same areas stack with independent scrolling.
- Tire units come from the card editor; optional temperature/air-life only if reported.

## Climate
- Preserve approved cabin photo, seat/steering action hotspots, HVAC power/AUTO and
  available controls. The fan slider alone loses its outer blue glowing pill and is
  presented as an open, minimal strip. Min/max/step remain integration-driven.

## Home, location, and viewport
- Unify seven real MDI quick-action glyphs; make them slightly larger including Climate.
- XPENG wordmark has no rounded background badge.
- Map uses only the real tracker entity, default zoom 16, auto-fit on the car,
  and no invented location or extra zone.
- On desktop expand the scene height without forcing a separate phone dashboard.

## QA and release boundaries
Validate the generated source and `dist` bytes, JS syntax, regression suites,
real Chromium desktop/phone/Sections captures and full screenshot ZIP for Beta 15.
Screenshots in the earlier committed gallery are NOT proof of the Beta 15 output.
Keep stable `main` and the car's real command flow unchanged; before stable merge
obtain explicit owner acceptance and perform Home Assistant/physical-car testing.
