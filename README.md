# Dither — by etovo

A local video, image, and webcam effects studio. The v2.3 studio rebuilds the original camera-effects prototype around video editing and export, with a desktop workspace and a touch layout for iPad.

## Use the studio

1. Open a video or image, enable the camera, or experiment with the built-in moving test signal.
2. Pick a starting look. Adjust **Effects** and **Color**, then use **Before / after** to compare.
3. Scrub the timeline. Set **In** and **Out** in seconds, or use **Set here** at the playhead. The highlighted range shows the export selection; **Full clip** resets it. Arrow keys seek 0.1 seconds (Shift: 1 second), and **I / O** set the trim.
4. Choose **Export**, select the format and resolution, and create the file. A completed export stays available behind a Download button, including on iPad. It is labeled as a previous export when relevant edits change. Video export preferences are remembered.

The app never uploads your media. Settings and named presets are stored locally, with validated JSON import/export for backups. Original media is unchanged. Imported fonts are session-local and embedded in vector exports.

## What is included

- Six distinct color-aware dithering methods: Bayer, Floyd–Steinberg, Atkinson, Jarvis–Judice–Ninke, Burkes, and Sierra.
- Thirteen focused effects: Contour beads, Dot mosaic, Symbol field, Dither, ASCII, Dither + ASCII, Palette, Threshold, Halftone, Crosshatch, Edges, Channel study, and Pixelate. Binary, number, and character treatments are overlays; letter palettes are ASCII ramps. Existing presets migrate automatically. Graphic and Digital families keep the picker compact.
- Twelve style starters with real rendered previews, three new palettes, palette-backed letterpress type, and reusable brightness/color masks. Masks can isolate a selection or keep the original image behind it; they do not perform automatic subject detection.
- Original palette and character-set collections. **Keep mask when changing styles** lets you try looks without losing a tuned selection.
- Brightness, contrast, saturation, inversion, transparency, chroma keying, and temporal smoothing.
- Video playback, scrubbing, looping, trim controls, audio monitoring, and undo/redo of effect settings.
- Separate preview and export resolutions; 4K landscape and equivalent portrait exports preserve aspect ratio.
- Frame-by-frame MP4/WebM at 24, 30, or 60 fps where WebCodecs is available; live recording for compatibility and cameras; looping GIF; PNG and SVG frames.
- Export progress, cancellation, encoding/decode errors, source cleanup, and explicit download/share actions.
- Keyboard navigation, native modal focus management, dark/light appearance, and responsive inspector layouts.

## Run and verify

Requires Node **24** (minimum 22.12) and npm.

```sh
npm ci
npm start
```

```sh
npm run test:ci
npm run build
node scripts/check-gif-worker.cjs
npm run test:exports # Requires ffmpeg / ffprobe
npm run benchmark -- ebdbb2c
npm audit
```

`npm start` and `npm run build` first copy the locally installed GIF encoder worker into `public/`. No CDN is needed at runtime. Production output is **build/**. `npm run preview` serves an already-built result.

The checked-in Netlify configuration continues to publish `build/`. Vite uses relative asset paths so a build also works beneath a GitHub Pages repository path. Publishing is separate from the verification workflow; the workflow uploads a build artifact and does not deploy or merge changes.

## Export behavior and limits

| Output | Behavior |
| --- | --- |
| MP4 / WebM · Frame by frame | Independent decoding, rendering, and encoding, with timestamped frames at 24/30/60 fps. Auto checks video and audio encoders; MP4 uses H.264/AAC, WebM uses VP8/Opus (or VP9 for Maximum quality where available). Audio shares the video trim. Missing requested tracks stop the export with an explanation. Requires WebCodecs and a secure context. |
| MP4 / WebM · Live recording | Compatibility fallback and live camera capture. Uses a timed rendering loop and native MediaRecorder; requested frame rate can still be missed. File extensions follow the actual container; WebM duration metadata is repaired. |
| GIF | Deterministic frame-by-frame video seeking; 10–15 fps; up to 720 px on the longest edge. Cumulative centisecond timing avoids shortened GIFs. Loops forever. Silent. Up to 30 seconds and 60 million uncompressed frame pixels, whichever is smaller. |
| PNG | Current frame, with alpha where the chosen effect leaves transparent regions. |
| SVG | Vector cells, dots, strokes, and text. Source underlay embeds a raster image; uploaded fonts are embedded. A 250,000-cell limit prevents excessive memory use. |

- Keep the tab visible during live recording; backgrounding stops that job with a recoverable explanation. Frame-by-frame export does not rely on playback or screen refresh. A screen wake lock is requested where available.
- Prefer **Frame by frame** for reliable motion. **High** balances detail and file size; **Maximum** increases bitrate for fine textures. Live recording remains device-dependent; its completion screen reports low rendering throughput. The requested 60 fps can duplicate frames from a slower source; it does not invent motion.
- Video export uses an opaque background. GIF uses the selected background color. Choose PNG/SVG for transparent assets.
- Camera capture is intentionally silent. Camera-to-GIF is not offered: record a video, then import it for a GIF.
- Native export is capped at 4096 px on the longest edge. Imports are limited to 2 GB and recording data to 512 MB. Large images still require enough device memory to decode.
- Animated GIF input is an image source, not an editable video timeline. Import video for controlled animated conversion.
- Browser-supported input codecs determine which video files can open. An MP4 or MOV container does not guarantee a decodable codec. H.264 MP4 is a useful interchange format.
- Temporal trails depend on preceding frames. A PNG/SVG still is intentionally rendered without a temporal trail; a video or GIF initializes its trail at the trim start.

## Structure

- `src/App.jsx`: media/editor orchestration, history, timeline, local presets, and export UI.
- `src/studio/Controls.jsx`: accessible inspector controls and icons.
- `src/studio/model.js`: settings validation, legacy migration, palettes, dimensions, and formatting.
- `src/studio/pixels.js`: pure pixel adjustments, six dithering kernels, and edge detection.
- `src/studio/renderer.js`: shared canvas/vector rendering and the built-in test signal.
- `src/studio/workflow.js`: style-mask preservation, validated video preferences, export freshness, and media clocks.
- `src/studio/media.js`: decode/seek lifecycle, cancellation, camera cleanup, and audio routing.
- `src/studio/export.js`: image/vector output, GIF sequencing, and native recorder lifecycle.
- `src/studio/precise-export.js`: lazy-loaded Mediabunny/WebCodecs decoding, timestamped export, codec checks, cancellation, and audio trim.
- `scripts/benchmark-renderer.mjs`: reproducible render-only comparison with a prior commit.
- `scripts/check-precise-export.mjs`: actual H.264/AAC and VP8/Opus output, frame counts, timed audio pulses, cancellation recovery, and portrait 60 fps using native test adapters.

See [the performance and quality review](docs/PERFORMANCE.md) for measured gains and validation limits.

See [the complete audit](docs/AUDIT.md) for the original defects, corresponding repairs, test evidence, and verification limits.

See [Graphic styles review](docs/GRAPHIC-STYLES.md) for the v2.2 reference-inspired styles, rendering measurements, and validation. Regenerate style thumbnails with `npm run previews` after changing a bundled look.

See [Workflow review](docs/WORKFLOW-REVIEW.md) for v2.3 editing refinements and compositing fixes.
