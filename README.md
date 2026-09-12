# Dither Studio — by etovo

A local video, image, and webcam effects studio. A canvas-centered workspace adapts to desktop, tablet, and phone, with matching light and dark appearances.

## Use the studio

1. Open a video or image, enable the camera, or experiment with the built-in moving test signal.
2. Choose a classic starter in **Looks**, or explore **Artistic** for expressive materials and patterns. Tune **Effect**, **Color**, **Select**, and **Frame**, then use **Before / after** to compare. On a phone, expand the controls for detailed editing or hide them to work directly on the canvas.
3. Scrub the timeline. Open **Trim** to drag the range handles, enter **In** and **Out** in seconds, or set either boundary at the playhead. Choose a frame-step rate for fine seeking. The highlighted range shows the export selection; **Full clip** resets it. Arrow keys seek 0.1 seconds (Shift: 1 second), and **I / O** set the trim.
4. Choose **Export**, then select a visible **File type**: **MP4**, **WebM**, **Auto**, **GIF**, **PNG**, or **SVG**. Auto chooses a supported video type and shows its choice before export; selecting MP4 requests an actual `.mp4` file. Your video-type preference is remembered. Choose the resolution and create the file. A completed export stays available behind a Download button, including on iPad. It is labeled as a previous export when relevant edits change. Video export preferences are remembered.

The app never uploads your media. Settings and named presets are stored locally, with validated JSON import/export for backups. Original media is unchanged. Project files and local autosaves also preserve framing, trim, selections, per-effect settings, and the active custom font. Relink the original media when reopening a project on another device. Fonts are embedded in SVG exports.

Video import starts muted decoding and opens on a paused first frame. If the browser requires a gesture, choose **Enable video**; **Cancel** returns to the current workspace. Timeline thumbnails and compatibility-mode color echoes use the same video loader. Cloud-backed files must be available on your device, and input codecs still depend on browser support.

## What is included

- Six distinct color-aware dithering methods: Bayer, Floyd–Steinberg, Atkinson, Jarvis–Judice–Ninke, Burkes, and Sierra.
- Twenty-two focused effects, including Marbled ink, Contour atlas, Threadwork, Guilloché, Cut paper, Facet glass, Arc tiles, Interlace, and the classic print, type, dither, and color tools. Dither + ASCII is an ASCII mode, with legacy presets preserved. Artistic, Graphic, Digital, and Utilities families keep the picker compact.
- Thirty-two style starters. The Artistic tab curates twenty-two across twelve techniques and remembers the selected technique while editing. Search by name, material, or description; preview visible results on the current frame and stop a batch at any time.
- Seven procedural artistic renderers: swirling marbled ink, topographic color terraces, directional thread bundles, engraved wave fields, cut-paper leaves and petals, irregular triangular glass, and connected Truchet arc ribbons. Fourteen starters and five curated ink palettes. **New variation** explores another seeded composition with Undo for comparison.
- Interlace reconstructs images and video with interlocking bands and stepped ribbons. Source-color and tonal-ink mapping, three reference-inspired palettes, and stable pattern seeds support both recognizable treatments and abstract graphic compositions.
- Brightness/color selection, original-source eyedropper, paint/erase/lasso corrections, imported mattes, selection overlay, and optional original backdrop. Selection is manual or tonal; there is no automatic subject detection.
- CMYK/duotone screens, contour lettering, fixed-time color echoes, effect/source mixing, and normalized paper grain.
- Original palette and character-set collections. **Keep selection when changing looks** lets you try looks without losing a tuned selection.
- Brightness, contrast, saturation, inversion, transparency, chroma keying, and temporal smoothing.
- Video playback, scrubbing, looping, trim controls, audio monitoring, and undo/redo of effect settings and trim, with separate remembered settings for each effect.
- Worker rendering with a compatibility fallback. Adaptive preview resolution reduces work during playback and refines paused frames. Export resolution stays independent.
- Source-attached selections and shared Original/16:9/9:16/Square/4:5 framing across preview and export; filmstrip trim handles and precise numeric controls.
- Frame-by-frame MP4/WebM at 24, 30, or 60 fps where WebCodecs is available; live recording for compatibility and cameras; looping GIF; PNG and SVG frames.
- Export progress, cancellation, encoding/decode errors, source cleanup, and explicit download/share actions.
- System/light/dark appearance, a resizable desktop inspector, expandable phone and tablet controls, keyboard navigation, and native modal focus management.
- Direct crop editing with staged Apply/Cancel, exact numeric adjustments, one undo step per slider gesture, and canvas zoom/pan independent of rendering.
- Project controls in the document bar, integrated style browsing, and a composition preview in Export; advanced encoding choices expand on demand.

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
node scripts/check-precise-export.mjs --interlace # Also checks Interlace MP4 / WebM
node scripts/check-precise-export.mjs --interlace --artistic --all-effects # Real decoded motion and audio through every effect
node scripts/check-interlace.mjs # Render-only performance review
npm run benchmark -- ebdbb2c
npm audit
```

`npm start` and `npm run build` first copy the locally installed GIF encoder worker into `public/`. No CDN is needed at runtime. Production output is **build/**. `npm run preview` serves an already-built result.

The checked-in Netlify configuration continues to publish `build/`. Vite uses relative asset paths so a build also works beneath a GitHub Pages repository path. Publishing is separate from the verification workflow; the workflow uploads a build artifact and does not deploy or merge changes.

## Export behavior and limits

| Output                      | Behavior                                                                                                                                                                                                                                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| MP4 / WebM · Frame by frame | Independent decoding, rendering, and encoding, with timestamped frames at 24/30/60 fps. Auto checks video and audio encoders; MP4 uses H.264/AAC, WebM uses VP8/Opus (or VP9 for Maximum quality where available). Audio shares the video trim. Missing requested tracks stop the export with an explanation. Requires WebCodecs and a secure context. |
| MP4 / WebM · Live recording | Compatibility fallback and live camera capture. Uses a timed rendering loop and native MediaRecorder; requested frame rate can still be missed. File extensions follow the actual container; WebM duration metadata is repaired.                                                                                                                       |
| GIF                         | Deterministic frame-by-frame video seeking; 10–15 fps; up to 720 px on the longest edge. Cumulative centisecond timing avoids shortened GIFs. Loops forever. Silent. Up to 30 seconds and 60 million uncompressed frame pixels, whichever is smaller.                                                                                                  |
| PNG                         | Current frame, with alpha where the chosen effect leaves transparent regions.                                                                                                                                                                                                                                                                          |
| SVG                         | Vector cells, dots, strokes, and text. Source underlay embeds a raster image; uploaded fonts are embedded. A 250,000-cell limit prevents excessive memory use.                                                                                                                                                                                         |

- Keep the tab visible during live recording; backgrounding stops that job with a recoverable explanation. Frame-by-frame export does not rely on playback or screen refresh. A screen wake lock is requested where available.
- Prefer **Frame by frame** for reliable motion. **High** balances detail and file size; **Maximum** increases bitrate for fine textures. Live recording remains device-dependent; its completion screen reports low rendering throughput. The requested 60 fps can duplicate frames from a slower source; it does not invent motion.
- Video export uses an opaque background. GIF uses the selected background color. Choose PNG/SVG for transparent assets.
- Camera capture is intentionally silent. Camera-to-GIF is not offered: record a video, then import it for a GIF.
- Native export is capped at 4096 px on the longest edge. Imports are limited to 2 GB and live recording data to 512 MB. Precise exports use temporary browser storage when available; a guarded memory buffer is used otherwise. Export preflight checks codecs, dimensions, estimated size, and available storage. Large images still require enough device memory to decode.
- Animated GIF input is an image source, not an editable video timeline. Import video for controlled animated conversion.
- Browser-supported input codecs determine which video files can open. An MP4 or MOV container does not guarantee a decodable codec. H.264 MP4 is a useful interchange format.
- Frame response blends preceding rendered frames. PNG/SVG stills omit that soft trail; video/GIF initialize it at the trim start. Color echoes are separate: they sample fixed source times and are also available in still exports from clips. Echoes use 480 px silhouette samples and are unavailable for live cameras or image sources.
- Screenprint PNG/video uses analytic raster coverage; SVG retains editable ink geometry. Antialiasing can differ at very small screen sizes. Paper grain, original underlays, source mixing, and echo silhouettes embed raster layers in SVG.
- Processing uses the browser’s SDR canvas color pipeline. This is not an HDR or print-proofing color-management tool.

## Structure

- `src/App.jsx`: media/editor orchestration and export UI.
- `src/studio/editor-state.js`, `projects.js`: undo history, per-effect memory, validated project files, and IndexedDB autosave.
- `src/studio/use-preview.js`, `render-service.js`, `render-worker.js`: adaptive preview, worker backpressure, and cancellable rendering.
- `src/studio/selection.js`, `framing.js`: source-attached selections and shared framing.
- `src/studio/print-effects.js`, `finishing.js`, `echo-sampler.js`: print/type treatments, compositing, and fixed media-time echo samples.
- `src/studio/artistic.js`: shared raster/vector geometry for engraving, paper, glass, and arc tiles.
- `src/studio/material-art.js`: cached marbling fields, brightness terraces, and edge-following threadwork.
- `src/studio/interlace.js`: deterministic loom layout and shared raster/vector ink geometry.
- `src/studio/use-appearance.js`, `use-workspace.js`, `use-canvas-gestures.js`: appearance, adaptive layout, and view-only navigation.
- `src/studio/CropEditor.jsx`, `crop-geometry.js`, `TimeField.jsx`: staged source framing and precise committed values.
- `src/studio/Timeline.jsx`, `Filmstrip.jsx`, `StyleBrowser.jsx`: compact video controls and on-demand style previews.
- `src/studio/export-plan.js`, `export-storage.js`: export preflight and temporary disk-backed output.
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

See [Workspace v3](docs/WORKSPACE-V3.md) for the implementation, validation, and remaining platform limits.

See [Design workspace](docs/DESIGN-WORKSPACE.md) for the responsive redesign, interaction decisions, and verification limits.

See [Interlace](docs/INTERLACE.md) for the reference-inspired filter, controls, and validation.

See [Artistic collection](docs/ARTISTIC-COLLECTION.md) for inspiration sources, renderer behavior, and validation. Reproduce the artwork review and timings with `node scripts/check-artistic.mjs /path/to/review`.
