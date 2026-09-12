# Artistic collection

## Intent and inspiration

The collection explores different materials and visual systems instead of adding more variants of the same dither. These are original procedural interpretations: no downloaded artwork or uploaded reference pixels are shipped with the app. Thumbnails are rendered from Dither's built-in `drawSignal` graphic.

| Technique | Starting point | Interpretation in Dither |
| --- | --- | --- |
| Marbled ink | [Yasutomo's suminagashi process](https://yasutomo.com/suminagashi-instructions/) | Parallel ink ribbons combed through four smooth eddies. The source controls color and coverage inside a repeatable fluid composition. This is a geometric interpretation, not a fluid simulation. |
| Contour atlas | [USGS explanation of topographic contours](https://www.usgs.gov/faqs/what-a-topographic-map) | Image brightness becomes an elevation-like field. Filled terraces and open contour bands expose different levels of the same image. No actual depth is inferred. |
| Threadwork | [V&A documentation of kantha and running-stitch quilting](https://www.vam.ac.uk/articles/kantha-a-south-asian-quilting-tradition) | Bundles of fine strokes turn along image edges, blending into a gently varying ground direction in quiet areas. An original directional textile treatment, not a reconstruction of a particular traditional motif. |
| Guilloché | [G. Phil Poirier's account of engine engraving, published by SNAG](https://snagmetalsmith.org/2016/04/guilloche-engraving/) | Smooth wave fields whose ribbon widths reproduce image tone; monochrome engraving or chromatic currents. |
| Cut paper | [MoMA's documentation of Matisse's cut-out process](https://www.moma.org/interactives/exhibitions/2014/matisse/the-cut-outs.html) | Colored leaves and lobed petals, spatially seeded rotations, and genuine negative-space vein cuts. |
| Facet glass | [The V&A stained-glass collection](https://www.vam.ac.uk/collections/stained-glass) | An irregular triangular mesh, sampled image colors, and adjustable seams. This is a graphic interpretation, not an optical glass simulation. |
| Arc tiles | [Wolfram MathWorld's Truchet tilings](https://mathworld.wolfram.com/TruchetTiling.html) | Quarter-circle connections that form wandering paths and closed loops; one to four symmetric ribbon lanes carry image tone and color. |

Research also considered optical art, woodcuts, cyanotypes, and further weaving systems. Interlace already covers weaving extensively. The selected techniques offer distinct surface structures rather than palette-only variations. None automatically identify subjects or generate semantic illustrations.

## Finding and shaping a look

**Artistic** is a primary workspace tab on desktop, tablet, and phone. It contains 22 looks across 12 techniques: the seven procedural filters plus Interlace, Screenprint, Contour type, Contour beads, and Symbol field. **Looks** retains 10 classic starters and all saved presets. No existing effect or saved preset was removed.

The technique filter stays selected when moving into controls and back. Search matches names, notes, and technique descriptions; multiple words narrow the results together. Escape clears the search, and an empty state restores the full collection. On-demand previews render only visible results, abort on changes, and clean up the rendering service. **Stop previews** cancels a batch while retaining finished thumbnails. Applying a look opens Effect at the top of its controls. **New variation** advances the seed through a repeatable sequence; Undo restores the previous composition. Contour atlas derives its composition from the image and has no unrelated seed control. Arrow keys, Home, and End traverse all six workspace tabs; touch controls remain at least 44 CSS pixels tall and reflow with larger text.

| New looks | Controls |
| --- | --- |
| Floating ink / Agate bloom | Line spacing, swirl depth, ink coverage, seed |
| Chromatic atlas / Contour silk | Contour detail, terraces or isolines, levels, softness, separation or coverage |
| Silk study / Indigo stitch | Stitch size, edge following, length, thread weight, strand count, seed |
| Banknote / Chromatic current | Line spacing, wave depth, ink weight, seed |
| Paper garden / Petal study | Shape size, leaves or petals, coverage, optional vein cuts, seed |
| Cathedral light / Prism fragments | Shape size, shard irregularity, seam width, seed |
| Serpentine / Candy circuits | Shape size, ribbon lanes, ribbon weight, seed |

Each supports source color, nearest palette color, tonal palette mapping, and a single ink. Mineral and Silk join Gouache, Cathedral, and Candy lacquer in Color. Single-ink glass and contour terraces preserve tone through opacity. Topographic isolines mark brightness intervals, so uniform areas can intentionally remain open. The regular Color, Select, Frame, finishing, and export workflows remain available.

## Rendering and performance

All seven effects use the same polygon geometry in the main renderer, worker, still exports, SVG, and frame-by-frame video exports. Each frame can be rendered independently. Spatial seeds fix the procedural layout; image colors and tones remain live. Contour shapes and thread directions intentionally respond to changes in the source. Intentional temporal smoothing remains a separate existing control.

The renderer caches bounded palette lookups, glass topology, and engraved centerlines. Neighboring engraving segments with the same ink and alpha become continuous ribbons. Independent ribbon fills avoid expensive compound-path intersection work; paper and tile pieces are grouped by ink and alpha. Bilinear source sampling weights RGB by alpha to avoid color bleeding from invisible pixels. Glass uses additional source samples so neighboring shards can represent different colors.

Marbling caches centerlines and ribbon banks after composing four localized, invertible rotations; changing the source does not rebuild that field. Contour atlas smooths an alpha-weighted tone field, clips shared triangles against brightness intervals, and merges uniform terrace interiors into horizontal runs. The final terrace includes pure white. Threadwork blends edge tangents as an unoriented line field, places one to three disjoint filaments inside each cell, and reuses unit-circle vertices. Its presets balance visible strands with interactive drawing cost. Native shared polygons were retained after testing more complex raster approaches; no extra full-resolution color or coverage buffers are needed. Source-color mode preserves all eight bits per channel.

Shape density is normalized to the longest output edge. Paper uses twice the cell size for its visible modules; arc geometry uses a grid half the source-sampling dimensions. Minimum sizes, four arc lanes, three thread strands, sixteen contour levels, and three smoothing passes bound geometry growth. The three material effects use a minimum cell size of 12 reference pixels. Finer settings cost more work; preview resolution remains adaptive, while precise exports render every frame at the requested resolution.

Run `node scripts/check-artistic.mjs /path/to/review` for a contact sheet and measurements at 720p, 1080p, and 4K. Add `--materials` to focus on the six newest starters. The sheet grows with the collection. The benchmark uses changing, materialized source frames and flushes drawing before stopping the clock. Run it separately from other CPU-intensive checks. These are native canvas rendering measurements, not browser, iPad, or phone playback FPS. Export encoding and audio are measured separately.

## Verification

- 197 tests across 15 suites: fourteen procedural looks compared against their SVG outputs, frame-order independence, source response, cold/warm palette consistency, eight-bit source color, transparent regions, soft selection bounds, pure-white terraces, maximum-detail portrait/landscape opacity, input validation, gallery search, variations, navigation, and undo.
- New effects participate in the existing exact transparent-to-opaque flattening checks, both with and without an original-source selection backdrop.
- SVG tests require editable paths rather than embedded render images, with a mean pixel error below 6/255 against raster output. High-quality source resampling can ring at hard alpha edges; opacity checks compare against sampled alpha with a three-level native path-rounding allowance. Uniform half-alpha stress cases stay at or below 130/255; tests reject material opacity accumulation.
- The actual export harness covers Banknote, Paper garden, Agate bloom, and Silk study in H.264/AAC MP4, and Candy circuits, Cathedral light, and Chromatic atlas in VP8/Opus WebM. Each produces 60 decoded frames for a two-second trim, with timed audio verification. Existing effects, Interlace, cancellation recovery, and portrait 60 fps remain covered.
- CI runs the full suite, production build, local GIF worker check, dependency audit, and `node scripts/check-precise-export.mjs --interlace --artistic`.

Hardware-specific playback and Safari codec behavior still require device testing. No new runtime dependencies, external media requests, or cloud image processing were added.
