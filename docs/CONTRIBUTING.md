# Contributing

Contributions are welcome to the **XPENG Vehicle Card** frontend. Keep API integration work in the separate XPENG Direct project. Do not propose undocumented vehicle commands or unverified model/sensor mappings as production-ready.

Before proposing a pull request:
1. Explain model, year, country and trim scope; link authoritative documentation for any claims about vehicle capability.
2. Keep new UI controls disabled/absent unless a Home Assistant entity with a verified control contract exists.
3. Update tests and document copyright/trademark provenance of all images.
4. Run `node --check dist/xpeng-vehicle-card.js`, `python tests/test_hacs_package.py`, and the browser regression scripts (`pip install playwright; python -m playwright install chromium`).
5. Update `docs/CHANGELOG.md` for user-visible changes. Never include real VINs, tokens, account data or address telemetry in code or screenshots.
