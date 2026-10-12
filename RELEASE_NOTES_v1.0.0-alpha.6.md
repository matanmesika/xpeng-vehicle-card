# XPENG Vehicle Card v1.0.0-alpha.6 — dashboard improvements; car images unchanged

This is an **experimental HACS dashboard/frontend update**. It contains the previously reviewed layout and behavior fixes, **but no new or replaced car image binaries**. The existing approved night lakeside background and bundled vehicle assets are unchanged from alpha.5.

### Changes in this update
- Card editor: remove the visible Data source/photo/background/asset-path section.
- Sensor mapping: choose **Automatic** (integration naming, per-sensor controls hidden) or **Manual** (opens all 15 Home Assistant fields). Switching back to Auto ignores but does not delete existing manual assignments; old YAML mapping remains compatible.
- Vehicle model and exterior paint choose the bundled car preview. Model year only filters trim names; trim is informational.
- Header network status next to the info button. A click opens a popover with **Connection** and **Last vehicle update** only; a second click closes it.
- Keep two main views: status and sensor-triggered charging. From status, clicking tire pressure shows a large overhead four-wheel detail with true mapped readings and Back to vehicle.
- Desktop/mobile regression coverage, asset inventory checks and flat HACS bundle validation.

### Images intentionally NOT included
- No new car front/rear/overhead photos, AI renders, paint cutouts, or scene changes were added in this release.
- Existing G6/G9 and other model previews remain **illustrative and not manufacturer-verified**. The top-down tire image is an illustration until licensed real G6 overhead art is available.
- Genuine XPENG image acquisition and licensing are tracked separately. The backend integration was not modified.

### Install / upgrade
Use **HACS > XPENG Vehicle Card > Update** after this release is published, then reload the Home Assistant dashboard and clear cached resources if needed. Make sure the newly installed version is alpha.6; it does not yet include official replacement vehicle photos.

**Not a stable release; actual in-Home-Assistant owner approval and image provenance checks remain pending.**
