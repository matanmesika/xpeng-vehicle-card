# XPENG Dashboard — v1.0.0-beta.1 release checklist

**Scope:** XPENG Lovelace frontend only. The separate XPENG Home Assistant integration/backend is not changed by this repository.

## Engineering gates

- [x] `src/xpeng-vehicle-card.js` and `dist/xpeng-vehicle-card.js` are synchronized.
- [x] JavaScript syntax validation passes for source and distribution bundles.
- [x] `hacs.json`, `model-artwork.json` and `vehicle-art-inventory.json` are the current metadata sources.
- [x] The approved lakeside background remains the common dashboard backdrop.
- [x] Current G6 2026 Core Performance AWD front, charging and overhead WebP assets are present.
- [x] The temporary `mix-blend-mode: multiply` workaround has been removed.
- [x] Obsolete per-release note files were removed; `CHANGELOG.md` is the canonical release history.
- [x] Legacy alpha publishing workflows were removed and replaced by one beta prerelease workflow.
- [ ] Confirm the current GitHub Actions validation run is green for the release commit.
- [ ] Verify installation/update through HACS on a real Home Assistant instance.
- [ ] Verify phone and desktop rendering against the approved visual design.

## Beta limitations

- Artwork for all XPENG models and exterior colours is not yet mapped.
- Current G6 artwork is the baseline for the next colour-mapping phase.
- Runtime artwork currently depends on GitHub-hosted assets, so network access is required.
- A documented beta candidate is not the same as a published GitHub Release; confirm publication under [GitHub Releases](https://github.com/matanmesika/xpeng-vehicle-card/releases).

See [DESIGN_LOCK.md](DESIGN_LOCK.md), [model artwork mapping](../model-artwork.json), and [CHANGELOG.md](../CHANGELOG.md).
