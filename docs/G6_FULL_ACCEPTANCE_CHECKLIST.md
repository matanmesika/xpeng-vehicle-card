# XPENG G6 — Full pre-release acceptance

**Gate:** Never merge to stable `main` before explicit owner approval after real Home Assistant tests.

## Visual and UX
- [ ] Back arrow aligned on phone; Settings/Wi-Fi behind an open mobile modal, visible at their approved desktop locations.
- [ ] Back retains navigation stack; clicking the backdrop exits to Home.
- [ ] TPMS symbol above every tire name and pressure on iPhone.
- [ ] No Hebrew labels or help in the card, editor, notes or errors, regardless of HA locale.
- [ ] Software updates explanation visible with genuine XOS/OTA data and only supported automatic-upgrade controls.
- [ ] Night background, vehicle art, charger cable and seven quick actions preserved on desktop, phone and narrow Sections.

## Live integrations
- [ ] Real tracker marker centered on every map opening; user map panning survives sensor ticks.
- [ ] Native Honk and Flash actions execute once with known entity IDs.
- [ ] Lock/windows/port/trunk commands and Xpengtk permissions validated.
- [ ] HVAC, fan, front/rear seats and steering heating work only when supported.
- [ ] Automatic charging view, live limits, schedules and diagnostics scrolling validated.

## Final engineering checks
- [ ] Frontend, HACS, artwork, regression and fourteen real-Chromium screenshot checks all pass.
- [ ] Owner reviews the refreshed screenshots and checks an actual iPhone and desktop.
- [ ] Stable main-only changes are reviewed and reconciled before any merge.
- [ ] Explicit approval precedes stable tagging and release.

[Current stabilization checklist](G6_FINAL_STABILIZATION.md). [Beta 19](https://github.com/matanmesika/xpeng-vehicle-card/releases/tag/v1.0.4-beta.19) remains the unchanged rollback release.
