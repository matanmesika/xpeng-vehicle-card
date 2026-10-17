# G6 complete pre-merge acceptance checklist

**Gate:** `.github/workflows/g6-full-acceptance.yml` runs one combined test across code validity, model/paint provenance, real owner WebP photos, status-based one-tap actions, Access opt-in, HA read-only schedules, native AUTO / airflow only when advertised, front/rear heated seats and wheel, real responsive Chromium screens at 1400/420/390/320 px, subpage back-only navigation, charge-state transitions and charging visuals.

Screenshots include both direction states for lock/windows/charge port, both approved cabin colours, maintenance, charging and return home. Captures use synthetic **demo values** and an actual browser running the shipped frontend code. The job must be green before any PR is merged.

**Live-car test remains pending:** never assert commands were accepted by a real XPENG G6. Owner will approve the browser pictures before any Home Assistant rollout, and then test the integration's actual services and scene state.

**Visual acceptance blocker:** front G6 artwork and responsive glowing cable are a faithful *implementation direction*, not a pixel-identical replacement for the owner's photorealistic charging reference. Preserve the original live charge data card and lakeside design, but final side-by-side screenshot approval is required.

**Branch chain:** PR #40 -> PR #41 -> PR #42, all drafts; do not merge independently or to main without the owner's explicit approval.
