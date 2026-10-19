# XPENG Vehicle Card — v1.0.4 stable release checklist

This repository packages only the Home Assistant Lovelace frontend. The independently installed Xpengtk integration is not modified.

## Source and storefront
- [x] Shared runtime and stylesheet compiled into identical `src/` and HACS `dist/` JavaScript.
- [x] One shared responsive Charging component on desktop, phone, and narrow Home Assistant Sections.
- [x] Native MDI action icons, common label/ring alignment, preserved vehicle and station artwork.
- [x] `hacs.json` and `render_readme: true` checked against Dashboard plugin conventions.
- [x] One canonical fourteen-image Chromium gallery with simulated Xpengtk data.
- [x] English GitHub README, HACS guide, changelog, installation guide, and release notes updated.
- [x] Redundant beta publishing workflows, duplicate gallery pictures and populated-folder placeholders removed.

## Release gates
- [x] Owner approved the charging layout and requested final release.
- [ ] Confirm latest final commit CI: frontend, HACS, artwork, charging visual acceptance and stable release workflow.
- [ ] Merge PR #59 without rewriting divergent main changes.
- [ ] Confirm GitHub stable tag and release assets `v1.0.4` were created.
- [ ] Check HACS refresh/download of the stable version from the custom repository.

## Limits
Chromium screenshots are genuine renders of the shipped frontend with **simulated data**. They do not validate real Xpengtk commands, live GPS, physical charging, native Home Assistant integration permissions or iPhone Safari behavior. Verify these separately at a safely parked vehicle.

[README](../README.md) · [Store copy](HACS_STORE_GUIDE.md) · [Current gallery](screenshots/README.md)
