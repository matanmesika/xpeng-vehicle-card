# XPENG Dashboard — Approved design and behaviour lock

**Frontend/dashboard repository only.** Do not edit, delete, merge or release the separate XPENG integration.

## Fixed visual design

1. Keep the owner-approved night lake/house/mountain photographic background as the **single** scene background in Overview, Charging and the Tire pressure overlay. File: `dist/assets/xpeng-approved-lakeside-background.webp` and its byte-identical root copy. Git blob of approved original: `a28766ffcb8607f096077e67fdc3fbb04b79c883`.
2. The vehicle must be a **separate transparent artwork layer**. Do not replace the background, reconstruct mountains with CSS or bake telemetric values into images.
3. There are two primary states only: Vehicle status and Charging. **Charging is sensor-driven.** Tire pressures is a detail view within Vehicle status, replacing the center with a large top-down car and four corner pressure readings, with a back action.
4. Preserve the simplified visual layout and responsive phone/desktop support. Do not add unrequested weather, controls, climate, seat, door, navigation or clock screens.
5. The header top-right contains network connection **plus** adjacent info icon. **Information popup starts closed** and opens only when the icon is clicked. It displays **Connection** and **Last vehicle update**, *nothing else*. Clicking the icon again closes it.
6. Home Assistant values always come from mapped entities. No fabricated sensor data and no vehicle commands.

## Appearance policy — supersedes legacy year-shape mapping

- **Runtime image selection = model + exterior paint only.**
- Every supported year/trim of that model uses one highest-available-trim preview for its paint.
- Model year only filters the list of trim names in the card editor. Selected trim is informational only; changing year/trim must **not** alter the displayed car, any custom cutout URL, paint, cabin finish or telemetry.
- All appearance selectors are editor/YAML only, not visible on the dashboard.
- The editor has no `Data source` image/background/path inputs or automatic prefix input; artwork is bundled, with legacy YAML image overrides supported but hidden.
- A single `Sensor mapping` dropdown defaults to Automatic (registry/prefix lookup, no per-field inputs visible). Manual reveals every telemetry field used by the dashboard, grouped by vehicle, battery, range, charging, status, climate, and tires. Manual entries persist when switching back to Automatic, but automatic lookup takes precedence until Manual is selected again. Older `entities:` configs without an explicit mode remain Manual.
- `model-artwork.json` is the current model+paint inventory; `vehicle-art-inventory.json` is a historical filename inventory, not a runtime per-year selector.
- G6 currently uses existing `core_performance_awd` preview images; G9 uses `performance_awd`. Other models use best available model+paint family imagery. All unverified visuals remain explicitly labelled illustrative. Do not claim photography or a factory highest trim is verified without evidence.
- Manufacturer-accurate rear/overhead cutouts remain pending; the charged view may explicitly reuse front art as a fallback, and TPMS uses an acknowledged colour-matched overhead illustration.

## Release policy

- Current baseline is the `v1.0.0-beta.2` candidate. Keep the owner-approved lakeside background unchanged unless explicitly approved. The G6 front artwork was replaced through PR #28; charging and overhead artwork remain the current baseline. Future work may map additional exterior colours without changing the dashboard background or backend integration.
- Before release: all Node/browser/HACS tests pass; source and dist JavaScript match; approved backdrop remains unchanged; actual Home Assistant desktop/mobile views receive owner approval; image licensing/provenance and advertised photo accuracy are confirmed.
- Automated tests alone do not establish visual equivalence to the owner-approved reference. Historical design explorations are not active UI specifications.
