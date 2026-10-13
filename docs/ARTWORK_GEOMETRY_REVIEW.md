# XPENG artwork geometry review — 2026-10-13

> Structural checks only; no manufacturer design approval is implied. All imagery remains subject to human visual review.

Verified mapped image inventory: **64 / 339**, with **275 missing**. This review does not add any image to the catalog.

## Existing canvas inconsistency requiring attention

The **G6 2026 graphite_gray** trio differs in canvas size from the same-generation 2026 white and other ordinary paints:

| View | graphite_gray existing | other G6 2026 paints |
| --- | --- | --- |
| front | 1536 × 1024 | 1448 × 1086 |
| charging | 1110 × 634 | 1448 × 1086 |
| top | 479 × 957 | 887 × 1774 |

The separate candidate-generation script builds three **unapproved** WebP previews from the matching **G6 2026 arctic_white** trio; it does not overwrite or add anything under assets/.

## Additional possible edge-crop issues (manual review)

A local alpha-boundary scan flagged nine views for possible edge clipping: G6 2023–2025 fiery_orange front; G6 2026 silver_frost charging; all six G7 2025 top views; and G9 2025–2026 graphite_gray front. These are review flags, not confirmed visible defects.

## Limits

Automated WebP decoding, alpha validation and canvas comparisons cannot prove that a rendered vehicle matches the manufacturer body generation, exact paint, camera angle, wheels or trim. Preserve the approved scenic background and the separate backend integration. Do not merge without user review.
