# XPENG Dashboard v1.0.0-alpha.5 — fix missing photos in Home Assistant HACS

**This release fixes the actual HACS installation failure.** Earlier alpha.4 appeared to install but Home Assistant showed a black background and a white vehicle placeholder. Those were image load failures, NOT missing UI design work.

## Root cause
HACS plugin installer prefers a card JavaScript file in the **repository root** over one in `dist`. It then downloads only root JS files and **does not include our nested assets**. Our prior release shipped a root JS AND `dist/assets/`, so the new card ran without any pictures.

## Fix
- Removed the root `xpeng-vehicle-card.js`; developer source is now `src/xpeng-vehicle-card.js`.
- HACS now selects `dist/xpeng-vehicle-card.js`.
- Packaged all 130 existing images as **flat files directly in `dist/`**, with collision-safe `xpeng-asset-...` names (plus the owner-approved lake backdrop at `dist/xpeng-approved-lakeside-background.webp`).
- Bundled card URLs use the direct HACS namespace `/hacsfiles/xpeng-vehicle-card/`, never missing nested `/assets/` paths.
- G6 2026 Core+ RWD Arctic White transparent cutout, all other offered G6/G9 exact-path previews and model-family image variants remain.
- Added HACS-specific package regression tests that fail if root JavaScript is reintroduced or any flat photo is missing.
- Preserved both read-only Vehicle status and Charging screens, all 53 year/model combinations, optional visual customizations and the sensor mappings; independent XPENG integration unmodified.

## Upgrade steps (HACS)
1. Open HACS → XPENG Vehicle Card → Redownload / select `v1.0.0-alpha.5` (or the updated main branch).
2. Wait for installation to finish, and hard-refresh/restart the Home Assistant companion app on iPhone.
3. Edit the card only to remove any legacy explicit `image:`, `background_image:` or nonstandard `image_path:` overrides. They are not required.
4. The expected default is **night house / lake / mountains / wet reflective pavement + separately isolated white G6**. Charging uses the same night photograph.
5. Missing telemetry readings `—` are a separate HA sensor mapping issue; this release does not invent data.

**Experimental prerelease:** automated Chromium screenshot checks protect browser rendering. Exact owner-approved screenshot parity remains pending their final visual signoff.
