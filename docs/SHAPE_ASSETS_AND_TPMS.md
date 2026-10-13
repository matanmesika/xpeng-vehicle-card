# XPENG model-wide artwork and tire pressure view

Frontend card only. The XPENG Home Assistant backend integration is unchanged.

## Visual policy (owner-approved)
- Exact asset key is **model + year group + exterior paint**, independent of trim. Never substitute another model/year-group/paint to fill a missing file.
- Model is chosen first. Years are limited to valid years for that model. Year changes the **trim name dropdown only**, without changing car artwork, exterior colour, cabin preview, charging photo, overhead photo or any sensor values.
- Trim is informational: no effect on images, paint options, cabin preview, sensor mapping, or background. This means year-old cars may show the newer model's appearance by design.
- The full model/year-group/paint mapping is recorded in `vehicle-art-map.json`; `model-artwork.json` describes the mapping rules.
- Only the G6 2026 colour variants already present on disk are currently marked available; other generation/paint combinations remain pending. Do not claim their artwork is manufacturer-verified.
- Where an exact model/year-group/paint/view cutout does not exist, use a labelled colour-matched placeholder. Never borrow from another year group or paint.
- Charging and top views have their own file keys. If either is missing, it shows an explicitly illustrative fallback instead of reusing the front.
- Approved lake-and-house photo stays pixel-identical in Overview/Charging/TPMS.

## Informational model year / trims
- The year dropdown shows catalogued year groups for the selected model.
- `xpAllowedTrims(model,year)` supplies labels. Different trim options may appear for older years versus newer years; only the labels depend on trim.
- Changing the year group updates generation-specific artwork, paint options, and trim labels. Trim alone must not change artwork; model/year-group/paint change can invalidate an incompatible old image.
- Exterior paint options are previews shared by all model years; availability for a particular historic vehicle is **not guaranteed**.

## Tire pressures
- Click Tire pressure in the existing vehicle-status information panel to replace the main car hero with a larger overhead vehicle image while preserving the original background, XPENG title, Wi-Fi header control and matching dark-glass sensor panel styling; front-left, front-right, rear-left and rear-right live values stay beside their corresponding wheels.
- Tap Back to vehicle to return to Overview. Charging automatically takes priority if the real HA charging sensor reports charging.
- Supports kPa/bar/psi/Pa to bar conversion; missing or invalid wheel data appears as `—`. No fabricated pressures, error limits or TPMS controls.
- The default top view is explicitly illustrative and colour-matched to the model; a user can supply a genuine transparent overhead PNG/WebP via `top_image`.

## Release checklist
1. Run Node regression tests, browser acceptance desktop/mobile, manifest audit, HACS layout tests.
2. Do not claim an illustration is an officially accurate photo or that the model's highest trim has been authenticated.
3. Collect licensed transparent cutouts by model and colour if true top-variant photographic realism is required.
4. No changes to HA integration or user-approved backdrop.

## Network / last-update header

- A **single interactive Wi-Fi icon** in the upper-right is used in Vehicle status, Charging and tire-pressure detail; no separate status text or information icon is displayed.
- The icon colour reflects **only** the mapped HA connection sensor: blue connected, amber error, grey not connected/unknown. A missing entity never silently implies connected.
- Tapping the Wi-Fi icon toggles a small popup containing exactly two fields: `Connection` and `Last vehicle update`. These use the mapped connection and vehicle-update entities; no art/model/cabin metadata.
- A valid ISO timestamp is formatted as an explicit date and time in the viewer's locale. A missing or unavailable vehicle-update sensor displays `Unavailable`; do not substitute HA's generic entity `last_updated` because it can indicate an HA state transition, not a vehicle refresh.
- The popover is closed by default and remains in the header; dashboard background and XPENG backend are untouched.


## Complete mapping
See [ARTWORK_MAPPING.md](ARTWORK_MAPPING.md) for all 83 combinations, pending directories and the asset sync/check command.
