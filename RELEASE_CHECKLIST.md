# XPENG Dashboard — alpha.6 UI-only release checklist

**Scope:** XPENG Lovelace frontend only. Nothing in the separate integration/backend is changed. This user-authorized release publishes the tested UI/editor fixes **without new car image files**, as an experimental alpha.6. Confirm actual publication on [Releases](https://github.com/matanmesika/xpeng-vehicle-card/releases).

## Engineering gates

- [x] Fixed approved landscape background in Vehicle status / Charging.
- [x] Single hero artwork per **model + paint**; highest-available-trim preview reused for all model years and selected trims.
- [x] Year only changes trim list; trim selection is informational.
- [x] Network and info icon on one header row; popup closed by default and toggles by click only.
- [x] Info popup has exactly Connection and Last vehicle update. No legacy cabin/artwork details.
- [x] Sensor-driven Charging and live TPMS overhead detail with four corner readings.
- [x] Editor Data source image/path controls removed; only auto/manual sensor mapping selection remains. Manual exposes exactly 15 entity fields, auto hides all and ignores stored manual overrides; legacy YAML mapping remains compatible.
- [x] Source/dist JavaScript synced; flat HACS distribution prepared.
- [ ] Confirm all **current** GitHub CI checks green for the proposed merge SHA. Results may change as commits are added.
- [ ] Verify actual Lovelace/HACS installation, resource refresh and icon/popover interaction against a real HA instance.

## Image, visual and licensing gates

- [ ] Licensed transparent high-trim vehicle packshots for all supported models and selected exterior colours. Current previews are illustrative, not authenticated manufacturer images.
- [ ] Accurate rear/charging and overhead TPMS image assets; distinguish fallback previews from photos.
- [ ] Compare Chromium desktop and phone screenshots with owner-approved status/charging concepts and obtain owner visual approval.
- [ ] Keep the approved background unmodified byte-for-byte.
- [ ] Confirm real XPENG-connected HA sensor names/unit conversions if representative user data is available and permission is given.
- [ ] After UI checks, publish only the **alpha.6 UI prerelease**, then verify its GitHub release and zip artifact. Genuine G6 replacement photos remain blocked by asset provenance/licensing and separate visual owner approval.

See [DESIGN_LOCK.md](DESIGN_LOCK.md), [model artwork mapping](model-artwork.json), and [PR #21](https://github.com/matanmesika/xpeng-vehicle-card/pull/21).
