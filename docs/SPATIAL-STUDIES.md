# Spatial studies

Paper relief and Adaptive tiles provide five starters. Each transforms the current image or video frame and supports selections, effect layers, PNG/SVG, GIF, and MP4/WebM through the shared rendering pipeline.

| Technique | Starters | Controls |
| --- | --- | --- |
| Paper relief | Porcelain ridges, Chromatic escarpment, Afterimage terrain | Ridge spacing, height, slant, ridges/wire, shading, source/palette/tonal/single ink |
| Adaptive tiles | City inlay, Patchwork radio | Tile size, image detail, spacing, mixed/chambers/stripes, seed, source/palette/tonal/single ink |

Paper relief lifts source tones into overlapping ridges. Rows are painted from back to front, producing real occlusion. Wire retains fine edges while filled ridges retain the colored faces. Source colors are sampled once per ridge-sized cell; the ridge geometry is sampled more finely. Background brightness determines which source tones rise. Shading is hidden in wire mode, including its motion track; returning to ridges restores the saved setting.

Harmonic field is retired from the Artistic collection, effect picker, and Add effect menu. Its renderer and editable settings remain available to open existing projects without losing their output.

Adaptive tiles subdivide around brightness variation, measured using alpha-weighted summed-area moments. This includes details between the center and corners of a tile. Subdivision has three levels. Each region draws either one solid tile or its children, never overlapping transparent versions of both. Crossing a detail threshold changes the subdivision directly; this intentionally replaces the old opacity crossfade. The layout depends on the current frame, never on frame history. Flat-color boundaries without a brightness change do not trigger subdivision. Small details below the sampled grid remain bounded by the chosen tile size.

The layout seeds stay fixed during video. Motion exposes continuous controls only. Overlapping artwork receives source alpha once; repeated ink and paper do not turn a soft selection opaque. Transparent PNG/SVG retain the source selection. Video and GIF flatten onto the selected background. SVG retains editable paths and shapes for these effects; existing stack and finishing rasterization rules still apply.

## Cleanup

- Pattern names, minimum sizes, and sampling scale now share one definition in `effect-scale.js`. The inspector, imported projects, and renderer agree on the allowed detail level.
- Color mapping eligibility is shared by the palette controls and composition summary. Controls with no effect on the selected treatment are hidden.
- Stopping a gallery preview clears its busy state immediately. Closing or changing the gallery cancels outstanding work. Late results/errors from an older batch cannot overwrite the new frame or filter.
- Technique choices come from the actual collection. New sample cards are rendered ahead of time, adding no work during video playback.
- Soft-selection mask buffers are reused between frames and reallocated only when dimensions change.

## Verification

Regression coverage includes the five current starters and three retired Harmonic field fixtures, solid nonoverlapping adaptive leaves near subdivision thresholds, raster/SVG parity, soft alpha in portrait and landscape, transparent-frame clearing, opaque export flattening, source response, seeking, resize/cache changes, motion, imported settings, contour topology, control visibility, Undo, and stale-preview cancellation. The full existing suite and production build are also run.

The actual codec matrix includes the new families and distinct modes in H.264/AAC MP4 and VP8/Opus WebM. It decodes output to check motion, frame counts, dimensions, trim, audio timing, and cancellation recovery. Native rendering measurements are not browser or physical-device FPS guarantees. Physical iPad/iPhone and Safari testing remain outside this environment.

```sh
npm run test:ci
npm run build
node scripts/check-gif-worker.cjs
node scripts/check-precise-export.mjs --interlace --artistic --all-effects
node scripts/check-artistic.mjs /path/to/review --spatial --quick
node scripts/check-artistic.mjs /path/to/review /path/to/photo.jpg --spatial --preview-only
node scripts/render-style-previews.mjs /path/to/contact-sheet.png --spatial
```
