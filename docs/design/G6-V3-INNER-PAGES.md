# G6 owner-approved V3 · inner pages

The presentation is maintained in `src/design/xpeng-vehicle-card.css` and
recompiled into the HACS bundle by `node tools/build_vehicle_card.mjs`.
The independent runtime `src/core/xpeng-vehicle-card.runtime.js` is untouched.

The approved glass palette now reaches Climate, Tire Pressure/Maintenance,
Custom Functions (all seven launch tiles and X-Guard), Diagnostics, Map,
Charging Limit/Schedule and associated modal actions. Native Home Assistant MDI
icons remain source of truth; CSS changes only their displayed proportions.

Sizing contracts: 19–23px MDI glyphs, 40–44px modal touch targets, 48px circular Custom Functions discs (44px on narrow cards), with
transparent full-card hit targets and compact labels (no rectangular backing). Cabin seat hotspots
remain at least 40×42px. The map and diagnostic list continue to scroll/fit
independently. Buttons are disabled based on integration state as before.
No action, sensor, routing or original vehicle artwork has been changed.

Acceptance: run `node --test tests/g6-v3-inner-pages.test.cjs` plus the
existing full tests and real-browser screenshot workflow. Compare the screen
captures before approving beta release. Do not merge the draft PR automatically.

The final compact subpage module intentionally follows the V3 overview
rules. This gives it cascade priority over retained legacy structural rules
without modifying the functional runtime.
