# XPENG G6 — Final stabilization review (post Beta 19)

**Status:** Review branch `fix/g6-beta19-final-stabilization-20261019`, [draft PR #57](https://github.com/matanmesika/xpeng-vehicle-card/pull/57). No stable merge or release is authorized yet.

## Owner-reported defects from the real desktop and iPhone screenshots

1. **Back placement and mobile overlays:** Beta 19 globally offset the Back button to avoid desktop Settings/Wi-Fi. Constrain the offset to desktop. In narrow cards an open modal overlays the dashboard header instead.
2. **GPS map recentering:** Reuse the native HA map on ordinary sensor updates, but on each new Location opening wait for a usable map engine, resize it and recenter on the real `device_tracker` latitude/longitude at zoom 16. Do not invent coordinates. Do not override manual panning on regular HA updates.
3. **Software update information:** Restore the explanatory help block and keep the supported automatic-update switch. Show XOS/OTA live data, never manufacture a manual Check for Updates command.
4. **English-only UI:** Remove the legacy Hebrew translation table. UI, help, error text, editor labels and maintained release documentation must remain English even in a Hebrew HA installation.
5. **Phone TPMS:** Put the tire symbol above the text and live pressure value for all four wheels.
6. **Design continuity:** Preserve the approved nightly lakeside background, original G6 artwork, charging composition, seven home shortcuts and command dispatch.

## Technical quality gates

- [ ] Frontend JavaScript syntax, source/dist parity, HACS and artwork checks.
- [ ] Full maintained Node regression suite and specific tests for English-only locales, map reopening, OTA explanation and responsive overlay behavior.
- [ ] Regenerate **fourteen** real browser PNG screenshots from this branch, not older previews. Check desktop, 320/390/420px cards, mobile scroll, charging, maintenance, updates, map and nested More options.
- [ ] Verify that screenshot gallery and README reference only the current captures.
- [ ] Complete an English-only documentation audit, retaining historical release context and avoiding unnecessary image churn.

## Real hardware acceptance (requires owner)

- [ ] Test Back/overlay stacking in Safari iPhone and desktop Home Assistant.
- [ ] Verify native map marker centering on *every open*, and normal panning after opening.
- [ ] Verify Software updates data and help, both XOS and automatic-update switch.
- [ ] Validate G6 native commands, access controls, charging status and cabin controls.
- [ ] Explicitly approve merging toward stable `v1.0.4`. Current stable `main` has unrelated commits and must be reconciled without force push.

**Automated screenshots use simulated Xpengtk states and a native-map placeholder, so they cannot prove actual GPS or a successful vehicle command.** Until owner acceptance, published Beta 19 remains the fallback.
