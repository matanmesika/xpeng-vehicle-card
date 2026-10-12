# XPENG visual parity release gate

## Reference authority
The user's supplied `xpeng-dashboard-background.webp` is the only approved background. Do not recreate, recolour, stretch, overlay mountains, or substitute it with an SVG. Both overview and charging must display this exact packaged asset.

## Review roles (instructions, not autonomous workers)
- **Artwork reviewer:** compare the SHA-256 of the original WebP against both packaged copies; confirm dimensions and image decoding.
- **Visual parity reviewer:** inspect 1536×864 screenshots of overview and charging; verify background, vehicle placement, typography, panels and reflections. Flag all differences from the user's approved designs.
- **Home Assistant reviewer:** verify HACS install loads background without any `/local/` or `/config/www/` manual step; check default and configured image paths.
- **Interaction reviewer:** confirm only charging sensor switches screens; info icon toggles Last Update; no home navigation or clock; full-screen toggle still works.
- **Release reviewer:** block merge/tag until all CI checks are green, no missing images/network errors, screenshots manually reviewed, and approved background committed to the root HACS package and dist.

## Required release checks
1. `dist/assets/xpeng-dashboard-background.webp` and `assets/xpeng-dashboard-background.webp` both exist and match original bytes.
2. Background decodes at 1536×864 and loads with HTTP 200 in Playwright; `img.complete && img.naturalWidth > 0`.
3. No synthetic mountain SVG or gradient floor renders over the original background.
4. Compare browser screenshots for both states and mobile layout. A green unit test alone is not visual approval.
5. No manual copy into Home Assistant required. Only then merge PR and publish a version.
