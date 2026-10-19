# XPENG G6 — Design Agents (English-only design review)

This document defines **four independent reviewer roles** for coding assistants or human designers working on the `xpeng-vehicle-card` project. GitHub Actions runs deterministic checks named after these roles; Actions jobs are **not autonomous AI design agents**. An AI/coding assistant following this file may suggest and implement visual changes only in an unmerged design branch.

## Non-negotiable product contract

- **Design-only** until the owner explicitly approves a new beta: preserve every Home Assistant/Xpengtk entity mapping, command, permission check, service call, keyboard/click handler, navigation target, screen, seven home shortcuts and state machine.
- **Do not replace, redraw or move the source vehicle art.** Keep the original night-lakeside background and approved G6 exterior/interior photos. In Charging, use the approved real charging car orientation and charging cable; automatic change is driven **only by the live confirmed charging state**. The cable glows green only when charging.
- Do not add made-up pages, car capabilities, min/max values, charging stats, schedules or commands. Do not label a service request as a successfully completed physical car action.
- Place the top-right **gear** immediately beside the connectivity icon to open existing **Custom Functions**. No left sidebar list for Maintenance or Custom Functions; their navigation uses a back arrow.
- Keep **all user-visible dashboard labels, screenshot UI, descriptions and documentation captions in English**. Where the existing UI is localized, English review captures must be taken with an English Home Assistant locale, and no untranslated Hebrew should appear in the English views. Do not silently disable existing locale logic while implementing a visual-only patch.
- Color code existing comfort actions consistently: seat/wheel heating **warm amber/orange**, front-seat ventilation **cool cyan**. Rear seats are heating-only. Controls remain directly on the corresponding physical seat/wheel positions, and each press cycles the real entity level.
- Home and Charging share the same seven action buttons. Action text is state-dependent (`Unlock` when locked, `Lock` when unlocked; `Open Trunk` when closed, `Close Trunk` when open). Unknown means disabled/unavailable, not guessed.
- Use genuine MDI icons rather than ad hoc SVGs for actions; the trunk icon must be a **rear tailgate**, not a front-facing car.
- One responsive card: desktop, narrow Home Assistant Sections, iPhone Safari and compact phones. No fake additional mobile dashboard. Avoid collisions with HA header/bottom navigation and nested scroll traps.

## Role 1 — Visual Design Agent (proposes and codes styling)

**Scope:** design tokens, spacing, typography, surface shadows, contrast, responsive CSS and real MDI icon presentation. Work on a new visual branch from the most recently accepted beta. Keep the JS/HTML logic untouched unless explicit approval is given.

**Deliverable:** before/after *real rendered browser screenshots* of Home, Charging, Climate, Maintenance, Custom Functions; two widths minimum per screen (desktop and phone). Preserve the car art and all text data.

**Pass:** a clearly noticeable premium change, not only border color; desktop battery icon is proportionate to its card; full climate controls are legible, easy to tap and not cut off; all copy in screenshots is English.

## Role 2 — Independent UX / Accessibility Reviewer

**Scope:** review the design without using the Design Agent's own success criteria as proof. Inspect actual screenshots, focus/hover behavior, text size, touch sizes, state feedback, page scroll, visual hierarchy and contrast. No invented screen or shortcut.

**Pass:** usable at 1440px, 420px Sections, 390px phone and 320px phone. Every button remains identifiable and keyboard-focusable; no overlap, clipped labels or obstructed back actions. Record issues as PR comments; do not approve on the basis of mockups alone.

## Role 3 — Integration & Regression Guardian

**Scope:** protect existing vehicle functionality from cosmetic changes, compare the production JavaScript **with CSS removed** to the accepted beta, verify src/dist byte equality, run existing service/permission/mapping tests, real charging transition assertions, action labels, navigation and original asset hashes.

**Pass:** zero behavior or permission regressions; screenshot demos don't execute commands on a real car. Physical vehicle execution must still be confirmed separately while parked.

## Role 4 — English Copy & Documentation Reviewer

**Scope:** English labels, punctuation, casing, accessible names, tooltips, dialogs, responsive wrapping and screenshot captions. Ensure English preview locale yields no leftover Hebrew in user-facing card text. Preserve correct official car labels and accurate unknown states.

**Pass:** English screenshots + no Hebrew in the English preview; no unverified numeric ranges. Explanations and true min/max for Custom Functions belong **inside each existing destination page**, not in its launcher tile; this feature is intentionally postponed until the owner approves the visuals.

## Mandatory review gates

1. `node --test` (existing complete regression suite).
2. `src/xpeng-vehicle-card.js` = `dist/xpeng-vehicle-card.js`.
3. CSS-only design diff from the approved beta (no modified vehicle assets or behavior code).
4. Playwright renders the real card in all test widths (not generated mockups). Keep all screenshots as downloadable workflow artifacts; compare with the accepted release.
5. User views screenshots and explicitly approves before any merge, HACS beta tag or release.

The automated checks in `.github/workflows/g6-design-agents.yml` implement the measurable parts of these gates. **Visual taste and real-vehicle safety remain human signoff items.**
