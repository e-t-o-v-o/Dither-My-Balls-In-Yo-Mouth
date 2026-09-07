# Performance and quality review — v2.1

Baseline: `ebdbb2c` (the previously deployed v2 overhaul). This revision focuses on rendering cost, trustworthy exports, correct tonal behavior, and fewer overlapping controls.

## Rendering

- Block effects upload one image per frame instead of issuing a rectangle command per cell. Palette conversion runs only where required, with reusable buffers and cached palette values.
- ASCII uses cached glyph coverage and a single bitmap text layer. Source colors, opacity, and character ramps remain supported. SVG keeps actual text and vector geometry.
- Ordered dithering no longer allocates an unused full-frame error buffer. Diffusion uses three rolling rows instead of a full-image float buffer.
- Halftone rasterizes coverage directly, avoiding expensive path tessellation. Crosshatch groups strokes in bounded batches, including dense solid regions.
- Preview skips duplicate decoded video frames. Settings writes are debounced; playhead UI updates are limited to four per second. Motion response uses elapsed time, so a 60 fps export does not halve the trail length.

The reproducible benchmark is `npm run benchmark -- ebdbb2c`. Results are saved in [performance-benchmark.json](performance-benchmark.json). These are warmed medians of 12 frames using Node and Skia Canvas at cell size 8. They exclude decoding, encoding, browser compositor work, and React, and are not iPad frame-rate guarantees.

| Case | Before | After | Speedup |
| --- | ---: | ---: | ---: |
| Bayer, 960 px preview | 65.00 ms | 1.89 ms | 34.3× |
| Bayer, 1080p | 59.12 ms | 1.29 ms | 45.7× |
| Bayer, 4K | 67.98 ms | 3.23 ms | 21.1× |
| Floyd–Steinberg, 1080p | 61.66 ms | 5.29 ms | 11.7× |
| ASCII, 1080p | 175.33 ms | 33.78 ms | 5.2× |
| Edges, 1080p | 53.25 ms | 6.70 ms | 8.0× |

New-effect measurements at the same fine cell size were 44.4 ms for 1080p halftone and 28.3 ms for crosshatch. These effects remain more expensive than block dithering. The smaller preview surface and frame-by-frame export avoid requiring full-resolution effects to sustain playback speed.

## Effect correctness and consolidation

- Bayer now spans the full quantization interval. Tests verify 0%, 25%, 50%, 75%, and 100% coverage over a 4 × 4 tile for a black/white palette.
- Diffusion preserves signed error beyond the RGB endpoints instead of clipping it away. The published Floyd, Atkinson, Jarvis, Burkes, and Sierra kernels remain distinct; alpha boundaries are respected.
- Halftone uses area-based dot radii and complementary holes above 50%, preserving pure black, pure white, and transparent negative space. Raster coverage is antialiased; SVG exports vector circles and even-odd paths.
- Crosshatch adds progressively more strokes in darker regions and solid ink in the deepest shadows. Channel study correctly samples each panel's source alpha.
- Color index is a Palette overlay. Binary, Number blocks, and Character blocks are Threshold overlays. Letter palette becomes an ASCII ramp. Green screen becomes Pixelate with the global Remove green modifier. Legacy preset IDs migrate automatically.
- The final selection contains ten effects, including the new Halftone and Crosshatch. Palette controls are hidden where they have no effect. Effect cards include visual examples and a short explanation.

## Export changes and evidence

**Frame by frame** uses a lazily loaded Mediabunny/WebCodecs pipeline. Frames have explicit timestamps and are encoded independently of playback and screen refresh. Auto checks video/audio encoder capability; MP4 uses H.264/AAC, while WebM favors VP8/Opus for High quality and VP9 when available for Maximum. Missing requested tracks cause an error instead of silently losing audio. Video and audio use the same trim. Explicit progress, cancellation, resource disposal, bitrate controls, and memory limits are included.

`npm run test:exports` exercises the actual production conversion and rendering code using native WebCodecs and canvas adapters in Node. FFmpeg independently decodes and inspects the files:

- A two-second selection from a three-second H.264 source produced **60 frames** in both MP4/H.264/AAC and WebM/VP8/Opus, with a **2.000-second** container duration.
- Audio pulses at known source times moved to the expected output times. Both audible pulses and silent intervals were checked from decoded PCM.
- Cancelling an active conversion rejected with `AbortError`. A subsequent portrait export succeeded at **180 × 320**, **60 fps**, **15 frames**, **0.25 seconds**.
- Native codec adapters are test-only dependencies and are not included in the browser bundle. Their AAC padding can generate a duplicate-tail-DTS warning in FFmpeg; the audio pulse and duration checks pass. This is not a substitute for native Safari codec testing. VP9 Maximum quality has not been independently validated on a physical device.

**Live recording** remains available for cameras and browsers without WebCodecs. A timed loop replaces dependence on animation-frame callbacks. In the same cloud Chromium environment, the previous approximately 4 rendered fps improved to approximately 25. The downloaded two-second sample contained 47 video frames, 640 × 360 output, and source audio. Live recording still cannot guarantee the requested frame count or sample-exact audio; the UI reports this distinction and low throughput.

**GIF** now rounds cumulative centisecond timestamps. A browser-generated two-second GIF downloaded with 24 frames and **2,000 ms** of total delay, correcting the previous 1,920 ms output. PNG and SVG share the effect model; real raster/vector comparisons exercise the block, dot, and line effects. SVG is bounded to 250,000 cells to prevent excessive output memory.

## Interface and verification limits

The dark/light workspace retains its familiar layout with quieter surfaces, rounded controls, readable effect names, illustrated effect cards, clearer export choices, and improved slider and touch targets. Desktop and an 820 × 1180 tablet-width iframe were reviewed in Chromium. No physical iPad was available.

The internal browser preview is HTTP and does not expose WebCodecs, so browser checks covered the live compatibility path and GIF; precise encoding was exercised with the native Node adapters described above. On-device HTTPS Safari testing, camera permission flows, and sustained large 4K workloads remain necessary before claiming certification for those environments.

CI runs the automated suite, real codec integration check, GIF worker smoke check, production build, and dependency audit. The point-in-time dependency audit is stored in [dependency-audit.json](dependency-audit.json).

Implementation references: [Mediabunny conversion API](https://mediabunny.dev/guide/converting-media-files), [CanvasSource timestamps](https://mediabunny.dev/api/CanvasSource), and the [native WebCodecs test adapter](https://github.com/Brooooooklyn/webcodecs-node).
