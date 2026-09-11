# Interlace

Interlace is a local image/video filter inspired by the supplied geometric artworks: broad color fields, repeated narrow stripes, intersecting horizontal and vertical bands, and folded ribbons. The renderer constructs new geometry from the media; it does not overlay or redistribute the supplied artwork.

## Starting looks

| Look | Character |
| --- | --- |
| Signal weave | Saturated red, blue, green, pink, and yellow on charcoal. Coarse interlocking blocks and strong crossings. |
| Color loom | A denser textile rhythm with blue, rust, orange, green, cream, and gray. |
| Night ribbons | Stepped ribbons and crossbars in muted green, red, blue, pink, and gray against black. |

Choose a look in **Looks → Studio**, or choose **Interlace** in the Graphic effect family. The look thumbnails are actual filter output.

## Controls

- **Module size:** controls the normalized grid. Small modules retain finer source detail; larger modules approach the broad geometric blocks in the references.
- **Structure:** Weave adds over/under crossings; Bands emphasizes uninterrupted runs; Ribbons adds alternating stepped turns and crossbars.
- **Image detail:** blends each module's source color toward its region average. High detail keeps the subject clearer; low detail creates broad abstract fields. This does not perform semantic subject detection.
- **Color mapping:** Source colors fits the source to the chosen inks. Tonal inks uses source brightness with spatially assigned colors for a more expressive composition.
- **Pattern details:** thread width, crossing frequency, and a saved seed. Changing the seed rearranges the loom; it does not animate randomly during video.
- **Color:** select one of the three Loom palettes or any existing palette, adjust the image, or combine the filter with existing finishing and selection tools.

For a recognizable photograph, start around module size 12–24 with high Image detail and Source colors. For an abstract poster, try 40–64, lower Image detail, and Tonal inks. Image detail and recognizability depend on the source and chosen palette; the filter reproduces the references' visual language rather than the exact composition of any artwork.

## Rendering and compatibility

The loom is a deterministic partition of a normalized grid. The same seed, aspect ratio, and module size give the same arrangement at preview and export sizes. Local source samples choose two-ink combinations, and their proportions become band widths. Tonal mapping uses a stable primary thread per region. Source alpha weights regional color analysis and remains attached to each module.

All structures use shared raster/vector geometry. Shapes are grouped by ink and alpha into compound paths to avoid seams in flat fields and unnecessary canvas state changes. Palette fits are cached with bounded quantized keys and cleared when the palette changes. Pattern topology is reused until the grid or seed changes. There are no network calls, model downloads, per-frame random seeds, or new runtime dependencies.

The filter supports existing crop, selections, original backdrop, effect mix, grain, and motion processing. PNG and SVG preserve source/selection transparency; opaque outputs flatten onto the chosen background. SVG contains editable paths unless an existing finishing option introduces a raster layer. Small differences in edge antialiasing between SVG viewers and canvas output remain possible.

Image detail, pattern settings, and seeds are saved with projects and presets, remembered per effect, and undoable. Existing project schemas remain compatible through defaulted settings.

## Verification

- 136 automated tests pass, including all three raster/SVG structures, source-color response, deterministic frame order, seed changes, soft alpha, transparent exclusions, opaque flattening, config validation, and control/palette persistence.
- Actual H.264/AAC MP4 and VP8/Opus WebM exports include Interlace. Checks decode the complete output, verify 60 frames over two seconds, inspect dimensions and trimmed audio, and retain cancellation recovery coverage.
- The existing GIF worker check and the production build remain required gates. Interlace uses the same renderer in the GIF path.
- Visual review used actual renderer outputs on the moving studio test image and supplied image material. Browser and physical-device testing were not performed for this addition.
- `node scripts/check-interlace.mjs` reproduces render-only timing checks. Optional arguments are an output directory and a local input image. Native canvas measurements on a supplied image were approximately 1.4 ms per 1080p frame at module size 32, and 21 ms at the finest size 8; 4K measurements were approximately 2.4 ms and 20 ms respectively. These are warm renderer medians on the test host, excluding decoding, encoding, display, and browser overhead—not iPad/iPhone playback guarantees.

The pattern stays fixed across frames, but moving image content can still cross ink thresholds and change color. Dense patterns need sufficient export resolution to avoid undersampling. Physical Safari/device codec support continues to determine available video formats.
