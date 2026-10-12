# Approved XPENG lakeside scene — bundled dashboard assets

**Bundled starting with v1.0.0-alpha.4. No manual image uploads or YAML paths required.**

This is a frontend-only XPENG dashboard. The separate Home Assistant XPENG integration/backend is untouched.

## Actual GitHub/HACS image files

- `dist/assets/xpeng-approved-lakeside-background.webp`: 1536×864 clean house/lake/mountains/wet-pavement background. The root `assets/` copy is byte-identical. This is the **default** scenery in both screens.
- `dist/assets/vehicles/g6/2026/core_plus_rwd/arctic_white.webp`: independently transparent white G6 2026 artwork, auto selected with G6 / 2026 / Core+ RWD / Arctic White. Root copy also byte-identical.
- All other model/year/trim/paint variants keep their existing catalogued images and illustrative fallback.

No CSS mountain, sky or fake pavement backgrounds are generated. CSS positions the one real raster landscape and the independently selected alpha cutout. Charging station/cable elements are still decorative frontend SVG/CSS and should be visually reviewed.

## HACS card setup

Install the repository `matanmesika/xpeng-vehicle-card` in HACS as a custom **Dashboard** repository. Select tag `v1.0.0-alpha.4` and reload the frontend.

```yaml
type: custom:xpeng-vehicle-card
prefix: my_xpeng
model: G6
year: "2026"
trim: core_plus_rwd
color: arctic_white
interior: light_gray
grid_options:
  columns: full
  rows: auto
```

No `background_image`, `image`, local folders or separate ZIP are needed. The owner can still configure optional `background_image` (one global card image) or `image` (specific car) from the editor if desired. Existing explicit overrides take priority until cleared.

## Source checks

- Bundled background SHA-256: `c0db38e9cd1c1827c53005c874af420563034258eb25444c1698d978277cf1ef`.
- White G6 transparent WebP SHA-256: `6372377d3a04469a6c12a76942de253d96b27b1ef7619907a13d46de816a52e7`.

The two dashboard views and responsive mobile layout must be tested with real browser screenshots before claiming final 1:1 design parity. The images are owner-selected illustrative assets, not manufacturer-verified model photos.
