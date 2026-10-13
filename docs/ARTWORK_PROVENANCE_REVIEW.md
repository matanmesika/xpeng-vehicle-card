# Vehicle artwork provenance and visual-review limitations

The repository currently contains **64** WebP vehicle views across **113** model/year/paint combinations (**339** possible view slots). File presence and alpha transparency are machine-checkable; **production-body accuracy, camera angle, wheel/trim geometry and factory colour fidelity require human review**.

- **49** current views are explicitly catalogued as AI illustrations in `sources/ai-generated-vehicle-art.json`, including **21** programmatic paint overlays. These are not manufacturer photos.
- **15** pre-existing G6 2026 views are not covered by the current AI source ledger. They are now tracked as `origin_unverified` in `sources/unverified-existing-artwork.json`; no unsupported authenticity claim is made.
- The existing `kaitoke_green_matte` G9 2025–2026 overlays are paint-derived previews, **not verified matte-finish renders**. They require manual replacement/review before claiming visual parity.
- A status of `available` in `vehicle-art-map.json` means the file exists at that exact path; it does **not** mean the file passed manual model/year/paint/angle fidelity review.

`python tools/audit_vehicle_provenance.py` enforces that every present image has exactly one provenance classification, derived previews refer to an existing matching model/year/view source, and unverified artwork is never labelled manufacturer-verified. Both frontend and transparency GitHub workflows run this check. It deliberately does not certify photo licences or image fidelity.

Before publishing any new AI master, append its three exact paths to the AI ledger. Before publishing any licensed real photograph, create a separately documented attribution/licence entry and extend the provenance audit accordingly rather than misclassifying it as AI. Never borrow a top/rear view from another generation.
