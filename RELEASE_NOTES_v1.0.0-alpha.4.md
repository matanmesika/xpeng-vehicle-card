# XPENG Dashboard v1.0.0-alpha.4 — built-in approved scene (preview)

**Dashboard/frontend prerelease for HACS.** This is a real installable repository tag. The independent XPENG Home Assistant backend is not changed.

## What's new

- The owner's house/lake/snowy-mountain night scene on reflective wet pavement is **bundled and used by default** in Vehicle status and Charging; no image upload, local path or YAML `background_image` required.
- The owner-selected transparent white XPENG G6 2026 foreground is **bundled at the exact `G6 / 2026 / Core+ RWD / Arctic White` profile path** and selected automatically. Other model/trim/year/colours retain their packaged model-specific or illustrative assets.
- The background is independent of model, exterior/interior colour, Home Assistant telemetry and active charging state. The vehicle remains its own image layer.
- Editor-only optional manual background/car overrides remain for advanced use.
- Retains 15 named XPENG catalogue models plus Other, 53 model/year choices and 117 distinct catalogue paths, as well as 15 read-only HA sensor mappings.
- The old CSS-driven scenic drawing is not present. Station/cable graphics on Charging remain decorative.
- Rendered browser screenshots are attached to this prerelease for owner review.

## Install

Add `https://github.com/matanmesika/xpeng-vehicle-card` to HACS as a custom **Dashboard** repository and choose `v1.0.0-alpha.4` using the three-dot menu → Redownload → Specific version (wording may vary). Reload your HA browser or phone app.

```yaml
type: custom:xpeng-vehicle-card
prefix: my_xpeng
model: G6
year: '2026'
trim: core_plus_rwd
color: arctic_white
interior: light_gray
grid_options:
  columns: full
  rows: auto
```

**No `image:` or `background_image:` needed.** If upgrading a manually customized card, remove older explicit `image`/`background_image` values to allow built-in defaults.

## Release checks

Build must pass Node syntax, profile selection, sensor mapping, HACS bundle checks, image hashes, alpha-channel audits and real Chromium overview/charging desktop+mobile screenshot checks. The visual composition has not yet received final 1:1 review and this release is explicitly a prerelease.

Backend integration and `main` remain untouched pending final approval.
