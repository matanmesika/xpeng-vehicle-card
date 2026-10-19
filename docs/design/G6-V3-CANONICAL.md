# XPENG G6 · canonical V3 design cleanup

The owner-approved direction is **transparent floating circular controls** over the
original night lakeside artwork, with one responsive card for desktop, Home
Assistant Sections and iPhone widths.

## What changed
- Removed 358 obsolete CSS declarations overwritten by
  later definitions within the same selector and conditional context.
- Retired 53 legacy dock surface declarations:
  rectangular tiles, dock backgrounds, borders, shadows, and blur.
- Removed 59 empty legacy CSS rules, retired the V2
  design-layer markers, and maintained V3 as the final owner-approved skin.
- Kept structural positioning, charging artwork, climate hotspots, sensor
  bindings, original seven quick actions, and command handlers unchanged.
- Regenerated the HACS/browser source and distribution bundles byte-for-byte
  from isolated runtime and CSS sources.

## Visual acceptance gates
- Design-agent tests guard transparent circles and reject legacy rectangles.
- Preserve keyboard focus and disabled states; no invented actions.
- Inspect desktop, compact Sections and mobile screenshots in GitHub Actions.
- Do **not** merge to main or ship a beta without acceptance of the captures.
