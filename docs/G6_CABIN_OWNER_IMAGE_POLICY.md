# G6 HVAC cabin: owner photo requirement

Use only the two exact owner-provided cabin photos for all G6 generations, not a generated replacement or existing schematic SVG.

Required binary image paths once uploaded:
- `assets/vehicles/g6/interior_light_gray.webp`
- `assets/vehicles/g6/interior_dark_gray.webp`

Both photos reside directly in `assets/vehicles/g6` as the owner requested. Every G6 year and trim uses the same two images. Review seat/steering hotspots against the actual photos once received.

The documented Xpengtk integration currently does **not** publish interior upholstery colour. Only a valid, selected-vehicle Xpengtk Entity Registry colour entry can override the explicit card-editor finish; never guess from exterior paint, trim, or another vehicle. Without one, the card editor setting controls the photo.

When either photo is absent, display a missing-asset message, NOT the old synthetic SVG image. Do not release until both photos are actually committed and browser screenshot review passes. This branch must not modify the vehicle status and charging scene compositions.
