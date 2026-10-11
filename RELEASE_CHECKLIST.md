# Dashboard v0.1.0 release checklist

- [x] Scope separated from XPENG integration (no integration code modified).
- [x] Exactly two render paths: Vehicle status and Charging.
- [x] Screen switches based on `is_charging` state.
- [x] No invented SOC/range/charging readings.
- [x] Retain HACS `dist/xpeng-vehicle-card.js` and existing image assets.
- [x] Responsive styling and full-viewport fallback implemented.
- [ ] GitHub automated checks all green.
- [ ] Compare actual desktop and mobile Home Assistant screenshots with the two supplied reference designs.
- [ ] Test direct HACS custom repository install and resource caching.
- [ ] Test against real XPENG integration entities (if authorized/available).
- [ ] Publish the dashboard-only `v0.1.0` tag after the gates above.

This release changes the dashboard only, not the separate XPENG backend/integration. It is read-only and independent of the manufacturer's official product.
