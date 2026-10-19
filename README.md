# XPENG Vehicle Card for Home Assistant

A responsive **English-only** Lovelace card for XPENG vehicles. One card fits desktop, iPhone and Home Assistant Sections automatically. It preserves the original night-lakeside scene, separately approved vehicle artwork and native Xpengtk entities.

**Published preview:** [v1.0.4-beta.19](https://github.com/matanmesika/xpeng-vehicle-card/releases/tag/v1.0.4-beta.19). **Stable HACS release:** [v1.0.3](https://github.com/matanmesika/xpeng-vehicle-card/releases/tag/v1.0.3). The [post-beta stabilization PR](https://github.com/matanmesika/xpeng-vehicle-card/pull/57) is under review and has not been released.

[HACS installation](https://my.home-assistant.io/redirect/hacs_repository/?owner=matanmesika&repository=xpeng-vehicle-card&category=plugin) · [Final acceptance](docs/G6_FINAL_STABILIZATION.md) · [Screenshot gallery](docs/screenshots/README.md) · [Artwork status](docs/ARTWORK_STATUS.md)

## Screenshots — real card in browser, simulated XPENG sensors

All captures are from the **running card JavaScript in Chromium**, with synthetic Home Assistant/Xpengtk entity states; they are not AI-generated UI mockups and do not represent the owner's live vehicle. **The Location map in standalone tests uses a stub**; real map tiles can be verified only inside Home Assistant. These are the 14 curated screenshots for current release-review UI.

| Screen | Desktop | Mobile |
| --- | --- | --- |
| Home · seven shortcuts | ![Home desktop](docs/screenshots/home-desktop.png) | ![Home mobile](docs/screenshots/home-mobile.png) |
| Automatic charging · dedicated G6 charging scene | ![Charging desktop](docs/screenshots/charging-desktop.png) | ![Charging mobile](docs/screenshots/charging-mobile.png) |
| Climate · seats and steering wheel | ![Climate desktop](docs/screenshots/climate-desktop.png) | ![Climate mobile](docs/screenshots/climate-mobile.png) |
| Maintenance · four TPMS wheel readings | ![Maintenance desktop](docs/screenshots/maintenance-desktop.png) | ![Maintenance mobile](docs/screenshots/maintenance-mobile.png) |
| Location · HA native map / horn / flash | ![Location desktop (map stub)](docs/screenshots/map-desktop.png) | ![Location mobile (map stub)](docs/screenshots/map-mobile.png) |
| Custom Functions · compact 21px/19px MDI icons in floating 48px/44px glass circles | ![Functions desktop](docs/screenshots/functions-desktop.png) | ![Functions mobile](docs/screenshots/functions-mobile.png) |

**Other relevant views:** [charging limits and schedules](docs/screenshots/charge-controls-mobile.png) · [Xpengtk entity diagnostics](docs/screenshots/diagnostics-mobile.png). The direct vehicle actions (doors/lock, windows, charge flap and tailgate) are interactive buttons rather than separate permanent navigation screens; they are covered by functional QA. See [the gallery guide](docs/screenshots/README.md) for the complete set and limitations.

## Installation and configuration

In **HACS → Custom repositories**, add `https://github.com/matanmesika/xpeng-vehicle-card` with category **Dashboard**. Install the latest stable release or explicitly select a beta under **Redownload → Need a different version?**. Refresh Home Assistant and clear the app/browser cache after updating.

```yaml
type: custom:xpeng-vehicle-card
model: G6
year: "2026"
prefix: my_xpeng  # Replace with your actual Xpengtk entity prefix
color: graphite_gray
interior: dark_gray
show_controls: true
enable_access_controls: false
grid_options:
  columns: full
  rows: auto
```

The card is **a frontend**, not the Xpengtk backend integration. It does not install or update the vehicle integration. Real commands require Xpengtk service entities; opening/unlocking actions additionally require explicit **Access** permissions in both the integration and card settings. Unknown/unavailable sensor values never trigger guessed actions.

## Sensor mapping

The XPENG Vehicle Card reads **existing Home Assistant/Xpengtk entities**; it does not query the vehicle or create sensors. For a one-car G6 setup it can discover the vehicle's mapped entities and honour Home Assistant Entity Registry renames. Existing YAML entity mappings remain supported. Check **Developer Tools → States** and the card's **Entity diagnostics** view to identify the actual IDs and their current states before relying on an action.

Unknown or unavailable sensor data stays unknown; the card cannot repair an upstream Xpengtk or vehicle connectivity issue. Buttons may be stateless. A successful `hass.callService` invocation only confirms that Home Assistant accepted the service call, **not** that the physical vehicle executed it. Confirm the relevant state or command feedback at the parked vehicle before signing off a release.

## Seven shortcuts and responsive screens

| Shortcut | What it does |
| --- | --- |
| Climate | Live cabin temperature, fan, supported HVAC, seat heating/cooling and steering-wheel heating using real integration entities; seat actions only at their physical positions in the cabin photo |
| Lock | State-dependent lock/unlock with duplicate-command suppression |
| Windows | State-dependent open/close, official `mdi:car-door` icon |
| Charge flap | State-dependent flap, refusing unsafe close with connected cable |
| Tailgate | State-dependent open/close, official the approved raised-hatch side-profile icon icon; English **Open Trunk** label |
| Maintenance | Four wheel-positioned TPMS readings, odometer, identity/maintenance data |
| Location | Native Home Assistant GPS map, preloaded map helpers, horn and flash when available |

The same seven actions appear on the Home and charging scenes. The charging scene is chosen **automatically** only from confirmed active charging; it uses its own rear-three-quarter photo and a thin **green cable only during charging**. There is no manual Charging navigation button.

All modal screens fit **within the available card scene** in tested desktop and 320–420px-wide responsive layouts. **Only the compact sensor list within Entity diagnostics scrolls**, keeping the note and status summary visible. The Wi-Fi symbol is centered in its square, and the cog has deliberate spacing. `getGridOptions()` follows the HA Sections card sizing API; there is no second mobile dashboard.

The UI supports **Hebrew RTL** and **English LTR**, automatically following the Home Assistant user's language; controls and artwork are shared. Cabin color is an **editor setting only**, not a Climate-screen selector. In G6 Climate, the owner-provided light/dark interior photos have **no captions over the photo**; images retain screen-reader alt descriptions.

## Owner screenshot fixes — in testing only

The current development branch `fix/g6-visual-live-feedback-20261018` is under visual acceptance: a larger status-dependent official MDI battery icon, properly aligned maintenance tire geometry and details, narrow-screen climate controls without horizontal spill, transparent seat/wheel hotspots, centered one-row-per-entity diagnostics, English OTA “Update details,” and silence after routine successful commands. These fixes are backed by simulated browser QA and still require real Home Assistant/iPhone confirmation.

**Black Edition:** the UI now selects the dark G6 cabin and an all-black appearance treatment. Approved dedicated Black Edition front/charging/overhead imagery has **not** been uploaded; the card must show an honest missing-image fallback rather than borrowing Graphite Gray charging artwork.

## G6 mapping finished; model artwork remains to be specified

**G6 functional mapping status: COMPLETE for the current card.** The G6 screen structure, auto charge status, core sensors, entity diagnostics, available Xpengtk operations, vehicle photos selected by model/year/paint, TPMS and localized labels are implemented and regression-tested. Real vehicle/HA/iPhone approval is still a **release gate**, not something automated testing can replace.

**Artwork catalogue status is separate from functional mapping.** The checked-in inventory currently records **G6: 30/33 camera views across 10/11 paint combinations**, with **3 views still missing for one 2026 color**. Do not mark those missing assets as completed. The **other 14 vehicle families still require image characterization, approval and completion** by model, body generation, exterior paint and camera angle. Some currently have partial illustrative previews; they are not production-approved manufacturer photos. Missing artwork must never be falsely substituted with a different model or angle.

See [current artwork status](docs/ARTWORK_STATUS.md), [generation/paint mapping](docs/ARTWORK_MAPPING.md), [master-view queue](data/master-view-queue.json) and [photo provenance](docs/ARTWORK_PROVENANCE_REVIEW.md). Source images and all `assets/vehicles/` subdirectories are intentionally retained until those gaps are closed.

## Testing, privacy and full-release gate

Automated QA validates JavaScript source/distribution parity, HACS metadata, true MDI icons, telemetry aliases, permission-gated actions, responsive desktop/mobile/Sections layouts, all subpage content fitting, map-host reuse, bilingual UI and curated Chromium screenshots. Fake Xpengtk states are used in tests; no vehicle actions are sent to the physical car.

**Before stable release:** install the candidate in the owner's real HA, verify the native map tiles, iPhone Safari rendering, real lock/window/port/TPMS entities, climate/seat controls, charging transition and image quality. Obtain explicit approval before merging to `main` or changing stable HACS. [Hebrew acceptance checklist](docs/G6_BETA_LIVE_ACCEPTANCE_HE.md) · [Draft pull request #44](https://github.com/matanmesika/xpeng-vehicle-card/pull/44).

## Developer layout / folders

`src/` is the maintained source, `dist/` the byte-identical HACS frontend. `assets/` holds approved backgrounds, owner cabin images and the model/year/paint artwork collection. `data/`, `profiles/` and `sources/` hold the **still-active** generation/asset inventories, provenance and pending-image queue; `tools/` rebuild and audit them. `tests/` contains maintained regression suites and simulator fixtures, `scripts/` capture actual browser visuals, `docs/screenshots/` holds **only 14 curated gallery images**, and `docs/releases/` is historical documentation. Historical pre-v1 test suites and obsolete alpha publishing workflows have been removed from this maintenance branch; release history/tags remain available on GitHub.
