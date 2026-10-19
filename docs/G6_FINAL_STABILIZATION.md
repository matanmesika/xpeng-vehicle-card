# XPENG G6 — Final v1.0.4 Acceptance and HACS Release Checklist

**Current status:** The charging-station alignment changes are under review in `fix/g6-charging-station-alignment-20261019`, derived from publicly released `v1.0.4-beta.21`. The stable tag `v1.0.4` **must remain unpublished** until owner approval. The existing stable `v1.0.3` and past betas remain rollback points.

## Visual acceptance (owner desktop and iPhone)
- [ ] Original night-lakeside photograph and approved car art are unchanged
- [ ] Charging station sits at the marked position: diagonally ahead of the car's front-right side, with realistic dimensions
- [ ] Charging station has a lower z-layer than the car; the complete thin green cable has a higher z-layer; charging information stays above both
- [ ] Green cable runs continuously across the ground from the correct station side to the mapped charge inlet and only shows while charging
- [ ] Charging telemetry is smaller on phones and no longer covers car/station art
- [ ] Same geometry principles at 320, 390, 420 and desktop 1400px; no horizontal overflow
- [ ] Climate, Back, More Options, TPMS, charging navigation and seven shortcut actions remain usable
- [ ] Gallery screenshots are captured from real running JS, not artificially composed screen mockups

## Automated QA
- [ ] Full frontend, HACS and vehicle artwork workflows green at final commit
- [ ] 14 real Chromium captures regenerated from final revision and reviewed, no stale screenshot images
- [ ] Source, `dist/` and HACS downloadable JavaScript are byte-identical
- [ ] Only actual supported Xpengtk commands remain; no permissions/access/control regressions
- [ ] English-only text audit passes on source, screenshots metadata and maintained documentation

## Integration/real-vehicle acceptance
- [ ] Vehicle remains in charging scene on confirmed active charging and returns to Overview when charge stops
- [ ] Map centers on live GPS at each new opening, but ordinary updates do not override manual panning
- [ ] Temperature, fan, front/rear seat and wheel commands work only where supported
- [ ] Lock, windows, trunk, charge port, horn and flash honor permissions and real entity states
- [ ] TPMS, charge data, OTA state and maintenance information are actual reported data, not generated numbers

## HACS storefront and publication
- [ ] [README](../README.md) and [HACS Store guide](HACS_STORE_GUIDE.md) reviewed for feature claims, terminology and compatibility
- [ ] `hacs.json` and resource filename verified
- [ ] GitHub repository About text reviewed (editing metadata requires separate repository settings access)
- [ ] All 14 annotated screenshot links work and show current rendered card
- [ ] No private coordinates, VIN, tokens or actual customer data in screenshots
- [ ] `docs/releases/v1.0.4.md` draft finalized
- [ ] Main branch divergence reviewed and stable merge performed without force
- [ ] Owner explicitly authorizes publishing tag `v1.0.4`

**Automated browser runs use simulated Home Assistant/Xpengtk state and a stub location map. They do not prove actual hardware functions.**
