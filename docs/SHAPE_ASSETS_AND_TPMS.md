# XPENG model-wide artwork and tire pressure view

Frontend card only. The XPENG Home Assistant backend integration is unchanged.

## Visual policy (owner-approved)
- One **highest-available-trim** vehicle preview per model and exterior colour, **regardless of model year or selected trim**.
- Model is chosen first. Years are limited to valid years for that model. Year changes the **trim name dropdown only**, without changing car artwork, exterior colour, cabin preview, charging photo, overhead photo or any sensor values.
- Trim is informational: no effect on images, paint options, cabin preview, sensor mapping, or background. This means year-old cars may show the newer model's appearance by design.
- The model+paint mapping is recorded in `model-artwork.json` (same packaged manifest in `dist/`). Do not use the old shape/year-by-year selection.
- G6 uses the existing `core_performance_awd` art for every year/trim. G9 uses `performance_awd` art for every year/trim. These are **illustrative assets**, not manufacturer-verified packshots.
- Where no identified high-trim cutout exists, the card uses the available model-family image of the chosen colour and *explicitly labels it illustrative*. No false high-trim guarantee. For absent colours/images it displays a labelled colour-matched placeholder.
- Manufacturer-representative rear and top-view photos are **still missing** for all model-colour mappings. The charging view may reuse the front preview until a user-supplied rear cutout exists; the tire-pressure mode uses a labelled top-down illustration unless a matching `top_image` is manually supplied.
- Approved lake-and-house photo stays pixel-identical in Overview/Charging/TPMS.

## Informational model year / trims
- The year dropdown shows known years for the selected model.
- `xpAllowedTrims(model,year)` supplies labels. Different trim options may appear for older years versus newer years.
- Changing year only updates this dropdown. Changing year/trim never clears an exact custom `image`, `charging_image`, `top_image`, or `interior_image`. A model/paint change clears previous vehicle photos to prevent an obviously wrong paint.
- Exterior paint options are previews shared by all model years; availability for a particular historic vehicle is **not guaranteed**.

## Tire pressures
- Click Tire pressure in the existing vehicle-status information panel to replace the main car hero with a larger overhead vehicle image on the same backdrop, with front-left, front-right, rear-left and rear-right live values next to their wheels.
- Tap Back to vehicle to return to Overview. Charging automatically takes priority if the real HA charging sensor reports charging.
- Supports kPa/bar/psi/Pa to bar conversion; missing or invalid wheel data appears as `—`. No fabricated pressures, error limits or TPMS controls.
- The default top view is explicitly illustrative and colour-matched to the model; a user can supply a genuine transparent overhead PNG/WebP via `top_image`.

## Release checklist
1. Run Node regression tests, browser acceptance desktop/mobile, manifest audit, HACS layout tests.
2. Do not claim an illustration is an officially accurate photo or that the model's highest trim has been authenticated.
3. Collect licensed transparent cutouts by model and colour if true top-variant photographic realism is required.
4. No changes to HA integration or user-approved backdrop.

## Network / last-update header

- The header's right-hand side shows the Wi-Fi icon and a real connection state label (`Connected`, `Not connected`, or `Connection error`); it never guesses online status from missing telemetry.
- A small info icon sits directly beside the network status **on the same line**, on desktop and mobile, in Overview, Charging and tire detail.
- Tapping that icon reveals exactly two sensor-derived fields: `Connection` (Connected, Not connected, or Connection error) and `Last vehicle update`. Connection is duplicated intentionally in the on-demand popup for full network information. No cabin imagery, model, trim, paint or artwork metadata is shown.
- The old detached floating info control is removed. The approved background and integrations are unchanged.
