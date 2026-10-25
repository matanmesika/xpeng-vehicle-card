# G6 Climate Status Beta — review candidate

This is an **unreleased beta branch**, not a published HACS release. The existing stable dashboard is untouched.

## Added to the existing Climate screen
Read-only status tiles for Max Cooling, Max Heating, Rear Defrost, Air Refresh, Sterilisation, A/C Cleaning, and Pet Mode. Tiles appear only when a matching switch entity exists for the selected XPENG vehicle. On/off and unknown/unavailable are distinguished. No new remote commands are sent. Existing climate, seats, charging, home artwork, and navigation remain unchanged.

## Before publishing
- Run `node --test` and `node tools/build_vehicle_card.mjs --check`.
- Run existing browser screenshot workflow and compare Climate iPhone and desktop against v1.0.4.
- Test in the owner's Home Assistant, including unknown Pet Mode and stale telemetry.
- Obtain explicit owner approval before tagging a prerelease or merging.

The existing controls remain functional; these new status tiles are not remote switches.
