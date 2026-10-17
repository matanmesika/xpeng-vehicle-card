# G6 charging design — reference lock (2026-10-17)

The latest owner-provided image depicts a 1536 x 864 night mountain scene, a white XPENG G6 seen from the **front three-quarter** angle (nose pointing left), a left translucent charging-data panel, a right charging pillar and a green glowing cable. These are the visual targets. **Do not substitute the rear-facing car photo in Charging view.**

The original charging hero must stay free of persistent action bars, buttons or settings overlays. A tap on the unchanged-looking Charging now heading opens a separate modal with only verified Home Assistant charging and charge-flap commands. The four quick-action buttons on Vehicle status are A/C, car lock, windows and the charge flap. Climate, door, windows and charge-flap actions are native Home Assistant entity services; missing entities cannot issue commands. Access actions are OFF unless the owner explicitly enables them and the XPENG integration grants permission.

The chosen cabin colour remains an editor-only setting. All displayed telemetry must come from HA or show unavailable.

**Outstanding visual blocker**: the bundled front cutout does not show the exact connected cable / photo-real scene as in the owner's example. This is not pixel-perfect parity. Capture and review screenshot renders and check on an actual iPhone/Home Assistant before merging or releasing.
