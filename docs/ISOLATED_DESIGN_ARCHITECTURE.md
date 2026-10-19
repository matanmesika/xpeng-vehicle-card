# XPENG Vehicle Card — Isolated Design Architecture (review branch)

The maintained **application runtime** and **visual design** are now two separate sources. No handwritten CSS remains embedded in the maintained runtime file:

```text
src/
  core/xpeng-vehicle-card.runtime.js    ← HA/Xpengtk entities, actions, safety, panels
  design/xpeng-vehicle-card.css          ← all screen styling + responsive layout
  xpeng-vehicle-card.js                 ← GENERATED browser entrypoint, do not edit
dist/
  xpeng-vehicle-card.js                 ← GENERATED single-file HACS package
tools/
  build_vehicle_card.mjs                ← single reproducible build command
```

Edit colors, spacing, backgrounds, icon presentation, desktop/mobile layout and visual guides **only** in `src/design/xpeng-vehicle-card.css`. Edit real data bindings, UI copy, panel structure and controls in `src/core/xpeng-vehicle-card.runtime.js`. Then build:

```bash
node tools/build_vehicle_card.mjs
node tools/build_vehicle_card.mjs --check
node --test tests/g6-isolated-design-help.test.cjs
```

The build injects design CSS into the existing `XP_CSS` constant and writes **byte-identical** frontend bundles to `src/xpeng-vehicle-card.js` and `dist/xpeng-vehicle-card.js`. This is intentionally a one-file HACS installation: Home Assistant does not need a second stylesheet resource.

## Contextual help lives inside the destination screen

The launcher grid stays uncluttered. Each function page has an English explanation at the top, including the active operation, supported states and numeric range **only if Home Assistant exposes real numeric attributes**. Missing values are explicitly reported as unavailable / not provided.

- **X-Guard:** On/Off plus sensitivity number (minimum, maximum and current value from `number.sentinel_sensitivity_control`). Lowest/highest mean the limits made available to the card; specific alarm thresholds depend on the vehicle firmware.
- **Charge limit:** current SOC target and min/max from `number.charge_limit_control`; warns that HA service success does not confirm physical vehicle execution.
- **V2L:** describes switch and the real tailgate power auto-off timer range in minutes. Does not invent a wattage rating.
- **Climate:** explains the current fan, temperature and seat/steering positions, and uses `climate.cabin_climate` min/max temperature attributes when supplied.
- **Climate/charging schedules:** explains whether data is read-only and which toggles are actually writable.
- **Energy, maintenance, update status, entity diagnostics, location:** read-only informational ranges are not mislabeled as editable sliders.
- **Charge port, lock/unlock, windows and trunk:** explains state-dependent real operations, permissions and safety.

The original black/white cabin assets, original night scene, original charging car direction and dynamic charge green cable are preserved. **This branch does not merge into `main` or publish a new HACS release.** Check real desktop/iPhone browser screenshots, all automated gates and owner approval before release.

## QA controls

- Existing Xpengtk entity/service tests continue to execute against the generated JS entrypoint.
- The new `g6-isolated-design-help.test.cjs` proves the design compiler recreates the actual source/dist files and derives bounds from live HA attributes.
- The Design Agents workflows validate responsiveness, all seven main shortcuts, automatic Charging, original photos and English screenshot locale.
- Browser screenshot tests must show the help card without shrinking seat icons below their touch-size threshold. Where guides increase content height, **scroll the modal** rather than scale down the entire UI.
- No simulated data or documented range is evidence of the actual XPENG vehicle capability; verify against the car when safely parked.
