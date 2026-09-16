# Editorial prints

Four new effects and a new Dot mosaic treatment extend Artistic with eleven looks. The supplied references informed the visual systems: cobalt tiles and orange code, annotated drafting, collages of miniature print techniques, colored bullseyes, and optical interference. No reference artwork is bundled into the application. These effects generate their marks from the current image or video frame.

| Technique | Starters | Main controls |
| --- | --- | --- |
| Signal paths | Cobalt code, Night transmission | Symbol size, trail sweep/angle, density, accent frequency, seed |
| Schematic | Field notes, Cyan draft | Brightness/alpha contours, threshold, levels, dashed lines, construction lines, callouts |
| Print collage | Archive collage, Chromatic type, Toner rouge | Patchwork/type, tile size, print coverage, marks per tile, borders, color mapping |
| Optical press | Opal interference, Solar impression | Rings/rays/waves, line spacing, ink weight, second ink, ripple, phase, center |
| Dot mosaic → Targets | Chromatic orbits, Quiet targets | Cell size, ring count, dot scale, scatter, seed, source/palette/custom inks |

The two Target starters appear in Artistic under Dot mosaic; the existing dot starter stays in Looks. The effect picker retains a single Dot mosaic effect. Two new palettes, Spectral print and Toner red, complement source color and custom ink settings.

## Working with the effects

- Choose a look in Artistic, then use Effect for the pattern and Color for inks and paper. Bigger cells make the printed construction more visible; smaller cells retain more image detail.
- Signal paths uses source brightness to choose tiny marks, disks, letters, and solid code tiles. Its curve and seeded accent layout do not change randomly between frames.
- Schematic contours follow brightness or the source/selection alpha edge. Labels annotate local image detail; they do not identify objects or report measurements. Alpha tracing uses a single contour level to avoid redundant outlines.
- Print collage mixes dots, line screens, drawn letters, and stippled blocks. Unprinted tiles preserve sampled source color. Type mode layers letters over source colors, a palette, or a single ink on the background color. Letter size responds to tone, including in single-ink mode. Selection can isolate a silhouette; this is not automatic segmentation.
- Optical press uses tone to modulate line width. A second plate adds intersecting rings or waves. Phase, ripple, center, and ink weight can be animated in Motion. Trail angle/sweep and Schematic line weight also support animation. Seeds and tile topology remain fixed edits.
- Targets use tone to size each group of concentric rings. Palette and custom-ink modes emphasize the nested colors; source mode samples nearby image colors.

## Rendering and performance

The same renderer is used for the worker preview, compatibility preview, still frames, GIF, and MP4/WebM. Frame-by-frame video export retains every requested frame independently of interactive rendering speed. Automatic preview resolution remains separate from export resolution.

Dense microprint and code trails use one reusable RGBA buffer and one canvas upload per frame. Their drawn alphabet avoids font downloads and worker font differences. Coverage masks are cached independently of ink color and capped at 512; palette lookups have a 32,768-entry upper bound. Optical centerlines are cached until a geometric setting changes. Sparse targets use direct circle geometry rather than allocating a full-frame print buffer.

Minimum cell sizes and bounded detail counts limit geometry cost. Dense optical fields and maximum-detail microprint still require more work than simple pixel effects, especially at 4K. Native-canvas benchmark timings are render-only measurements, not browser or device playback guarantees.

Overlapping ink, glyphs, and paper are composed before source alpha is applied once. Soft selections therefore stay soft. SVG keeps editable mark geometry and vector alpha masks; adjacent mask regions are grouped to prevent hairline seams. Pixel alignment is shared with the raster stamp geometry. Intermediate layers in a stack retain the existing SVG rasterization rules.

## Verification

Automated coverage includes every starter's SVG/raster comparison, source response, deterministic frame seeking, cache changes, transparent input, soft alpha at maximum detail in portrait and landscape, equal-area canvas resizes, opaque video flattening, all three optical motion structures, single-ink typography, settings validation, Artistic discovery, ink controls, and Undo.

The real codec matrix covers the new families, type variants, rays, and Targets alongside the previous effects. It encodes and decodes H.264/AAC MP4 and VP8/Opus WebM, verifies motion, frame count, crop, trim, and audio timing, and checks cancellation recovery.

Reproduce locally:

```sh
npm run test:ci
npm run build
node scripts/check-gif-worker.cjs
node scripts/check-precise-export.mjs --interlace --artistic --all-effects
node scripts/check-artistic.mjs /path/to/review --editorial
node scripts/check-artistic.mjs /path/to/review /path/to/source.jpg --editorial --preview-only
node scripts/render-style-previews.mjs /path/to/contact-sheet.png --editorial
```

`--quick` limits the timing review to 1280 pixels on the long edge. Native tests do not substitute for physical iPad/iPhone playback, touch testing, or Safari codec validation.
