# Approved XPENG G6 lakeside assets — integration instructions

This document describes **frontend-only** manual asset deployment. It does not alter the XPENG backend.

## Files

The owner-approved reference is a night mountain/lake scene with a house on the left, wet pavement and reflections, plus a separately transparent 2026 white G6 foreground.

- `xpeng-approved-lakeside-background.webp`: clean, photoreal 1536×864 background (no car, text, UI or logo).
- `xpeng-g6-2026-white-cutout.webp`: RGBA foreground with the white G6 only.
- `xpeng-g6-2026-white-cutout.png`: PNG equivalent.
- `xpeng-background-car-preview.jpg`: preview of the proposed scene composition.

**Deployment caveat:** these generated binary files are delivered separately and **are not yet bundled in this draft GitHub branch**. Do not advertise the branch as having the new background installed or release it as final. Place the first two WebP files in Home Assistant `/config/www/xpeng/`, making them available as `/local/xpeng/…`, before enabling the configuration below.

## Card configuration

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

The scenic background is a **global card property**: it does not change between Vehicle status and Charging or across vehicle model/year/colour selections. The transparent vehicle remains a separate live image layer. Individual car photos must not be copied across a different model or paint.

There are no CSS-drawn mountains, scenery layers, or simulated photographic floor; CSS only positions a single raster background and the foreground widgets. The charging station/cable are still decorative CSS/SVG elements in the Charging view. Data continues to come solely from Home Assistant.

If `background_image` is omitted, the currently bundled legacy `xpeng-reference-background.webp` is still used. The final release should package the approved image and update the default **only after binary assets are actually present and the real browser screenshot is approved**.
