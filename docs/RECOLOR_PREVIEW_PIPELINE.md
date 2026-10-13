# Reproducible XPENG paint preview generator

Run `python tools/recolor_vehicle_assets.py` after adding a matching `front.webp`, `charging.webp`, and `top.webp` **white-car master** for any catalogue model/year group, followed by `python tools/sync_vehicle_artwork.py` and `python tools/export_vehicle_artwork_backlog.py`. The included workflow builds/commits new previews to the open feature branch after comprehensive checks.

The tool never mixes model, generation or view, and never fabricates a rear or top view from a frontal master. It never generates Black Edition, two-tone or matte special-edition variants from a plain paint overlay. Generated files are classified as AI-derived approximations in `sources/ai-generated-vehicle-art.json` and `sources/derived-paint-views.json`.

The swatch hue is an approximate visual colour, not a manufacturer paint measurement. Paint replacement preserves alpha and predominantly changes bright low-chroma panels. Some reflective trim may also be tinted: **visual/manual manufacturer-fidelity review is still required**. The CI transparency audit checks technical validity, not fidelity.

Once a new complete master view trio is manually approved, adding it to the exact generation folder lets the same repeatable pipeline populate the remaining ordinary colours without copying a different car body.
