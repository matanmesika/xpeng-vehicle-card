# G6 complete pre-merge acceptance checklist

**Gate:** `.github/workflows/g6-full-acceptance.yml` runs one combined test across code validity, model/paint provenance, real owner WebP photos, status-based one-tap actions, Access opt-in, HA read-only schedules, native AUTO / airflow only when advertised, front/rear heated seats and wheel, real responsive Chromium screens at 1400/420/390/320 px, subpage back-only navigation, charge-state transitions and charging visuals.

Screenshots include both direction states for lock/windows/charge port, both approved cabin colours, maintenance, charging and return home. Captures use synthetic **demo values** and an actual browser running the shipped frontend code. The job must be green before any PR is merged.

**Live-car test remains pending:** never assert commands were accepted by a real XPENG G6. Owner will approve the browser pictures before any Home Assistant rollout, and then test the integration's actual services and scene state.

**Visual acceptance blocker:** front G6 artwork and responsive glowing cable are a faithful *implementation direction*, not a pixel-identical replacement for the owner's photorealistic charging reference. Preserve the original live charge data card and lakeside design, but final side-by-side screenshot approval is required.

**Branch chain:** PR #40 -> PR #41 -> PR #42, all drafts; do not merge independently or to main without the owner's explicit approval.

## October 17 — tailgate / location / HVAC coverage
- An eighth Home shortcut opens **or** closes the tailgate based on the selected Xpengtk vehicle's `binary_sensor.trunk` state. Unknown states disable the action. OPEN requires card `enable_access_controls` plus integration Access permissions. The first click sends exactly one verified native button command. Tailgate state feedback is essential; no optimistic display.
- The location page uses a **native HA map** with the selected `device_tracker.location`, dark mode, zoom 11, and two entity-bound finder actions: `button.honk_horn` (צופר) and `button.flash_lights` (הבהוב). Both remain confirmation-gated.
- G6 climate uses native A/C power/temperature/fan (entity-reported range), front defrost, front seats heating/ventilation, independent rear heating and steering heating; real `binary_sensor.climate_auto` and `binary_sensor.mirror_heating` appear as **read-only indicators**. AUTO and airflow are executable only if that **specific HA climate entity** advertises writable auto or swing options. Xpengtk presently documents only `off`/`heat_cool`, so **do not invent remote AUTO, independent rear-window defrost or airflow control**.
- The charging page retains exactly two top-level shortcuts: **הגבלת טעינה** and **תזמונים**. The main English headings are part of the owner-approved picture style; action labels are in Hebrew.
- Tests assert the Hebrew/English action contract, trunk permission gates, dark native map configuration, AUTO non-command safety, and 23 browser screenshots.
- **Browser capture caveat:** The standalone Chromium harness cannot render HA's native map card because it doesn't include Home Assistant's `loadCardHelpers`. That is not proof of a defective map on real HA. Only a live Home Assistant test can confirm map rendering and command reception.

## Desktop Location acceptance
The HOME **Location** shortcut is clicked on a real desktop-sized Chromium card. Native HA map helpers are stubbed **only in the standalone test browser**: config includes `device_tracker.my_xpeng_location`, `dark_mode:true`, `default_zoom:11`. Browser also validates two distinct Horn/Flash actions, no duplicate navigation, a single visible Back button, 1400px stage geometry, and proper return to Home. A new screenshot `docs/screenshots/g6-2026-location-desktop.png` is marked as a simulation, **not** live map tiles. The actual map must be verified in the owner's Home Assistant before production deployment.
