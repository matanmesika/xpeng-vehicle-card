# G6 HVAC cabin: owner photo requirement

Use only the two exact owner-provided cabin photos for all G6 generations, not a generated replacement or existing schematic SVG.

Required binary image paths once uploaded:
- `assets/interiors/g6/2026/light_gray_photo.webp`
- `assets/interiors/g6/2026/dark_gray_photo.webp`

The `2026` segment is an existing asset namespace, not a model-year filter. Every G6 can use those two assets. Review seat/steering hotspots against the actual photos once received.

The documented Xpengtk integration currently does **not** publish interior upholstery colour. Only a valid, selected-vehicle Xpengtk Entity Registry colour entry can override the explicit card-editor finish; never guess from exterior paint, trim, or another vehicle. Without one, the card editor setting controls the photo.

When either photo is absent, display a missing-asset message, NOT the old synthetic SVG image. Do not release until both photos are actually committed and browser screenshot review passes. This branch must not modify the vehicle status and charging scene compositions.
