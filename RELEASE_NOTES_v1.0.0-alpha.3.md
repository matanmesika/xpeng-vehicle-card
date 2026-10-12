# XPENG Dashboard v1.0.0-alpha.3 — installable preview

**Experimental dashboard-only preview.** This version is not an approved visual-final release, and it does **not** update or control the XPENG backend/integration. Published from `feature/reference-background-parity-v012`, not merged into `main`.

## Included in HACS / manual ZIP
- Exactly two read-only views: Vehicle status and Charging; auto-switches only while charging is active.
- The full catalog of **15 named XPENG models plus Other**, with **53 model-year combinations** (2018–2026 as applicable), editor-only choice of trim, exterior colour and cabin finish.
- **117 bundled illustrative vehicle images**, with exact-path G6/G9 2026 sample variants and model-family art where exact renders remain unverified.
- Automatic or manual mapping for 15 Home Assistant telemetry fields. Missing sensors display an em dash.
- **New `background_image` option** in the card editor/YAML for one photographic background shared by both views, independent of the foreground car. No CSS-drawn mountain scenery.
- Support for independently configured transparent vehicle `image`; white 2026 G6 cutout positioning tuned for the new reference. CSS-drawn station/cable decorations remain in charging mode.

## Important: approved photo assets are NOT in this GitHub release yet
The approved **house + lake + snowy mountains + rain-wet pavement** background and the separate **white G6 transparent cutout** are provided in the separate asset ZIP supplied in ChatGPT. They cannot be silently substituted with the old bundled scene. To see the approved reference, upload:
- `xpeng-approved-lakeside-background.webp`
- `xpeng-g6-2026-white-cutout.webp`

to `/config/www/xpeng/` on Home Assistant, then use:

```yaml
type: custom:xpeng-vehicle-card
prefix: my_xpeng
model: G6
year: "2026"
trim: core_plus_rwd
color: arctic_white
interior: light_gray
background_image: /local/xpeng/xpeng-approved-lakeside-background.webp
image: /local/xpeng/xpeng-g6-2026-white-cutout.webp
grid_options:
  columns: full
  rows: auto
```

This release's `xpeng-dashboard-v1.0.0-alpha.3-hacs-files.zip` contains the dashboard JS and existing 117 packaged model illustrations. This ZIP **does not contain the two newly approved photo assets**. The standard GitHub source archive also contains `dist/`, so HACS can install the dashboard repository as a **custom Dashboard repository** and choose this prerelease via version selection. After installing, hard-refresh the browser/app. No public XPENG API or live sensor source is bundled.

## QA and release scope
Automated model mapping, charging-screen transitions, basic browser tests, image alpha checks and HACS validation ran successfully on preceding development commit. This prerelease workflow repeats Node/HACS and art inventory tests before publishing. **True visual acceptance in the owner's Home Assistant desktop and phone remains pending.** There is no backend change and no merge to main.
