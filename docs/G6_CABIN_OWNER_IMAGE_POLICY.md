# G6 HVAC cabin: owner photo requirement

Use only the two exact owner-provided cabin photos for all G6 generations, not a generated replacement or existing schematic SVG.

Required binary image paths once uploaded:
- `assets/vehicles/g6/interior_light_gray.webp`
- `assets/vehicles/g6/interior_dark_gray.webp`

Both photos reside directly in `assets/vehicles/g6` as the owner requested. Every G6 year and trim uses the same two images. Review seat/steering hotspots against the actual photos once received.

The documented Xpengtk integration currently does **not** publish interior upholstery colour. Only a valid, selected-vehicle Xpengtk Entity Registry colour entry can override the explicit card-editor finish; never guess from exterior paint, trim, or another vehicle. Without one, the card editor setting controls the photo.

When either photo is absent, display a missing-asset message, NOT the old synthetic SVG image. Do not release until both photos are actually committed and browser screenshot review passes. This branch must not modify the vehicle status and charging scene compositions.

## Consolidated owner feature checklist
- The old synthetic G6 climate cabin SVGs are deprecated; the two user-supplied WebP photos are the only approved G6 cabin images.
- Four home actions: climate opens modal; locks/windows/charge flap send exactly one action on user tap, derived from valid live HA state; unsafe/unknown states stay disabled. Opening locks or windows requires Access permission.
- Maintenance collects TPMS overhead screen, odometer, next service and identity with vin_masked only.
- Existing charging scene and bundled model charge artwork are preserved. Two minimal shortcuts lead to charge-limit and read-only charging schedule data.
- Charging schedule sensors are read-only; the integration does not support changing the charge schedule from the card.
- The PR must remain draft until the two true photo files are present and verified visually.

The owner's exact 752 × 1336 pixel WebP source images were committed and SHA-verified in the branch. Both obsolete G6 cabin SVGs were deleted. Browser capture loads both real variants and verifies natural image width before taking screenshots.

## Rear comfort and fan range QA (demo)
Both rear-seat heat controls are independent and should be shown over the rear seats whenever their corresponding Xpengtk `select` entities are present. The screenshot demonstration includes these as two examples, not live car measurements. Xpengtk's documented `number.fan_speed` range is 1–8; the card reads the actual Home Assistant entity's `min`, `max`, and `step` attributes and can render 1–10 only if that real entity reports 10. Never claim unsupported 10-step remote commands.
