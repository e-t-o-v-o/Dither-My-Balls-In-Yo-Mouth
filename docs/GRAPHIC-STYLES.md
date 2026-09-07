# Graphic styles — v2.2

This pass translates the supplied visual references into reusable rendering tools rather than copying the reference artwork into the app.

## Creative range

| Reference direction | Implementation | Useful controls |
| --- | --- | --- |
| Blue beads around a bold silhouette | **Contour beads** follows interpolated marching-square paths, with continuous arc-length spacing and optional interior fill. | Brightness or alpha contour, level, spacing, size, ring width/color, interior color |
| Staggered color dots on an acid ground | **Dot mosaic** samples source or palette colors into separated circular cells. Staggered rows use alpha-weighted interpolation at their shifted sample positions. | Grid or staggered rows, size, source/palette/ink color, shared mask |
| Geometric symbol collage | **Symbol field** maps tone into cached geometric marks. Accent placement is deterministic in image coordinates. | Mixed, orbital, or directional families; ink, source, or palette color; accent frequency |
| Flat silhouettes filled with type | **Letterpress** combines ASCII with a palette-reduced underlay and automatic contrasting type. It extends ASCII rather than duplicating it as a separate effect. | Character ramp, type scale, palette, underlay, shared mask |
| Flat colored cutouts over a photograph | **Mint cutout** combines Threshold with a brightness mask and original-image backdrop. | Brightness/color range, inversion, softness, original backdrop |

There are thirteen effects, organized into Graphic and Digital families, and twelve bundled style starters. The six new featured styles are Cobalt beads, Acid dots, Wayfinding, Letterpress, Mint cutout, and Orbital. Three palettes add Signal pop, Cobalt vermilion, and Acid ink.

Masks select source colors **before grading**, preserve existing source alpha, and operate consistently in preview and export. The mask tab indicates when a selection is active. A transparent PNG provides an exact silhouette. Brightness and color masks are not semantic person/object segmentation, and cannot reliably isolate every subject from a complicated background.

## Rendering and export

Geometric marks use bounded caches of raster coverage and a single image upload per frame. SVG receives actual paths, including ring holes and polygon shapes. Contour interiors are filled as coherent paths to avoid antialias seams between scanlines. Contour sampling is bounded to a minimum six-pixel cell size at the 1920-pixel reference scale.

SVG colors are emitted as integer RGB values for compatibility with vector rasterizers. Original-image backdrops and ASCII underlays are embedded PNGs in otherwise vector SVG files, with a declared XLink namespace for older readers. Such exports intentionally contain bitmap content.

Style thumbnails are actual effect outputs, generated once by `npm run previews`. They are lazy-loaded static images, so the gallery adds no rendering work during video playback. Decorative placeholder thumbnail CSS was removed. The main compressed bundle grew from approximately 86.9 KB to 91.8 KB; the optional video encoder remains separately loaded.

## Measured performance

`npm run benchmark -- 29d0eb0` reproduces the comparison against v2.1. The measured report is [graphic-benchmark.json](graphic-benchmark.json). These are warmed medians using Node and Skia Canvas at cell size 8, excluding video decoding, encoding, browser compositor work, and React.

| New effect | 960 px frame | 1080p frame |
| --- | ---: | ---: |
| Contour beads | 15.39 ms | 38.79 ms |
| Dot mosaic | 17.42 ms | 46.74 ms |
| Symbol field | 15.31 ms | 39.85 ms |

The featured graphic styles use larger cells (20–24). Fine cell sizes cost more and are primarily useful for detailed exports. Bayer remained approximately 1.2 ms at preview size and 2.9 ms at 4K in this run. Other older effects varied by a few milliseconds; the report includes the full comparison context rather than claiming a universal speed improvement. These measurements are not physical iPad frame-rate guarantees.

## Verification

- 83 automated tests cover all thirteen raster effects; raster/SVG comparisons include the new effects, with a small antialias tolerance.
- Additional checks cover closed contours and interior holes, continuous bead spacing, repeatable symbol placement, alpha preservation, mask inversion/feathering, and configuration compatibility.
- The actual production video conversion pipeline encoded Contour beads as MP4/H.264/AAC and masked Dot mosaic as WebM/VP8/Opus. Both outputs independently decoded to 60 video frames over two seconds; audio pulse checks verified trim alignment. Cancellation followed by a masked Symbol field portrait export passed at 60 fps.
- Desktop and 820 × 1180 tablet layouts were inspected in Chromium. The complete SVG cutout with embedded original-image backdrop was rendered in Chromium. Skia's SVG loader omits embedded image elements, so the automated backdrop test checks the embedded PNG separately.
- The production build and existing GIF smoke check remain CI gates. No runtime dependency was added.

Physical iPad/Safari behavior and sustained 4K workloads remain unverified. Existing codec padding and live-recording limitations are documented in [the v2.1 performance review](PERFORMANCE.md).
