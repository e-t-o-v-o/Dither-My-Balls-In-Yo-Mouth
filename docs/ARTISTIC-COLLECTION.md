# Artistic collection

## Intent and inspiration

The collection explores different materials and visual systems instead of adding more variants of the same dither. These are original procedural interpretations: no downloaded artwork or uploaded reference pixels are shipped with the app. Thumbnails are rendered from Dither's built-in `drawSignal` graphic.

| Technique | Starting point | Interpretation in Dither |
| --- | --- | --- |
| Guilloché | [G. Phil Poirier's account of engine engraving, published by SNAG](https://snagmetalsmith.org/2016/04/guilloche-engraving/) | Smooth wave fields whose ribbon widths reproduce image tone; monochrome engraving or chromatic currents. |
| Cut paper | [MoMA's documentation of Matisse's cut-out process](https://www.moma.org/interactives/exhibitions/2014/matisse/the-cut-outs.html) | Colored leaves and lobed petals, spatially seeded rotations, and genuine negative-space vein cuts. |
| Facet glass | [The V&A stained-glass collection](https://www.vam.ac.uk/collections/stained-glass) | An irregular triangular mesh, sampled image colors, and adjustable seams. This is a graphic interpretation, not an optical glass simulation. |
| Arc tiles | [Wolfram MathWorld's Truchet tilings](https://mathworld.wolfram.com/TruchetTiling.html) | Quarter-circle connections that form wandering paths and closed loops; one to four symmetric ribbon lanes carry image tone and color. |

Research also considered weaving, optical art, and paper marbling. Weaving already has a substantial implementation in Interlace; the four additions were chosen to expand the visual range without duplicating it. The paper treatment samples color into shapes; it does not automatically identify subjects or generate semantic illustrations.

## Finding and shaping a look

**Artistic** is a primary workspace tab on desktop, tablet, and phone. It contains 16 looks across 9 techniques: the four new filters plus Interlace, Screenprint, Contour type, Contour beads, and Symbol field. **Looks** retains 10 classic starters and all saved presets. No existing effect or saved preset was removed.

The technique filter stays selected when moving into controls and back. On-demand previews render only the visible collection, abort on changes, and clean up the rendering service. Applying a look opens Effect at the top of its controls. Arrow keys, Home, and End traverse all six workspace tabs; touch controls remain at least 44 CSS pixels tall and reflow with larger text.

| New looks | Controls |
| --- | --- |
| Banknote / Chromatic current | Line spacing, wave depth, ink weight, seed |
| Paper garden / Petal study | Shape size, leaves or petals, coverage, optional vein cuts, seed |
| Cathedral light / Prism fragments | Shape size, shard irregularity, seam width, seed |
| Serpentine / Candy circuits | Shape size, ribbon lanes, ribbon weight, seed |

Each supports source color, nearest palette color, tonal palette mapping, and a single ink. The Gouache, Cathedral, and Candy lacquer palettes appear in Color alongside the existing collection. Single-ink glass preserves tone through opacity. The regular Color, Select, Frame, finishing, and export workflows remain available.

## Rendering and performance

All four effects use the same polygon geometry in the main renderer, worker, still exports, SVG, and frame-by-frame video exports. Their geometry is spatially seeded and independent of playback order. Video changes colors and ink coverage without reseeding the layout. Intentional temporal smoothing remains a separate existing control.

The renderer caches bounded palette lookups, glass topology, and engraved centerlines. Neighboring engraving segments with the same ink and alpha become continuous ribbons. Independent ribbon fills avoid expensive compound-path intersection work; paper and tile pieces are grouped by ink and alpha. Bilinear source sampling weights RGB by alpha to avoid color bleeding from invisible pixels. Glass uses additional source samples so neighboring shards can represent different colors.

Shape density is normalized to the longest output edge. Paper uses twice the cell size for its visible modules; arc geometry uses a grid half the source-sampling dimensions. Minimum sizes and a maximum of four arc lanes bound geometry growth. Finer settings cost more work; preview resolution remains adaptive, while precise exports render every frame at the requested resolution.

Run `node scripts/check-artistic.mjs /path/to/review` for a contact sheet and measurements at 720p, 1080p, and 4K. The benchmark uses changing, materialized source frames and flushes drawing before stopping the clock. These are native canvas rendering measurements, not browser, iPad, or phone playback FPS. Export encoding and audio are measured separately.

## Verification

- 168 tests across 15 suites: eight new looks compared against their SVG outputs, frame-order independence, source response, cold/warm palette consistency, eight-bit source color, transparent regions, soft selection bounds, monochrome glass tone, input validation, gallery navigation, and undo.
- New effects participate in the existing exact transparent-to-opaque flattening checks, both with and without an original-source selection backdrop.
- SVG tests require editable paths rather than embedded render images, with a mean pixel error below 6/255 against raster output. Native antialiasing at shared colored vertices may round alpha by two levels; tests reject material opacity accumulation.
- The actual export harness covers Banknote and Paper garden in H.264/AAC MP4, and Candy circuits and Cathedral light in VP8/Opus WebM. Each produces 60 decoded frames for a two-second trim, with timed audio verification. Existing effects, Interlace, cancellation recovery, and portrait 60 fps remain covered.
- CI runs the full suite, production build, local GIF worker check, dependency audit, and `node scripts/check-precise-export.mjs --interlace --artistic`.

Hardware-specific playback and Safari codec behavior still require device testing. No new runtime dependencies, external media requests, or cloud image processing were added.
