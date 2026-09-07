# Dither — by etovo

A local video, image, and webcam effects studio. The v2 overhaul rebuilds the original camera-effects prototype around video editing and export, with a desktop workspace and a touch layout for iPad.

## Use the studio

1. Open a video or image, enable the camera, or experiment with the built-in moving test signal.
2. Pick a starting look. Adjust **Effects** and **Color**, then use **Before / after** to compare.
3. Scrub the timeline. Set **In** and **Out** in seconds, or use **Set here** at the playhead.
4. Choose **Export**, select the format and resolution, and create the file. A completed export stays available behind a Download button, including on iPad.

The app never uploads your media. Settings and named presets are stored locally, with validated JSON import/export for backups. Original media is unchanged. Imported fonts are session-local and embedded in vector exports.

## What is included

- Six distinct color-aware dithering methods: Bayer, Floyd–Steinberg, Atkinson, Jarvis–Judice–Ninke, Burkes, and Sierra.
- ASCII, dithered ASCII, palette quantization, two tone, binary, color-index labels, number blocks, custom-character blocks, letter palettes, edge detection, and RGB channel views.
- Original palette and character-set collections, plus four concise default palettes and six starting looks.
- Brightness, contrast, saturation, inversion, transparency, chroma keying, and temporal smoothing.
- Video playback, scrubbing, looping, trim controls, audio monitoring, and undo/redo of effect settings.
- Separate preview and export resolutions; 4K landscape and equivalent portrait exports preserve aspect ratio.
- PNG and SVG current-frame exports; looping GIF; native MP4 and/or WebM recording where supported.
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
npm audit
```

`npm start` and `npm run build` first copy the locally installed GIF encoder worker into `public/`. No CDN is needed at runtime. Production output is **build/**. `npm run preview` serves an already-built result.

The checked-in Netlify configuration continues to publish `build/`. Vite uses relative asset paths so a build also works beneath a GitHub Pages repository path. Publishing is separate from the verification workflow; the workflow uploads a build artifact and does not deploy or merge changes.

## Export behavior and limits

| Output | Behavior |
| --- | --- |
| MP4 / WebM | Only browser-supported encoders are offered. The file extension follows the actual container returned by the recorder. WebM duration metadata is repaired for seeking and re-import. Records the trim in real time, at a requested 24 or 30 fps. Source audio is optional. |
| GIF | Deterministic frame-by-frame video seeking; 10–15 fps; up to 720 px on the longest edge. Loops forever. Silent. Up to 30 seconds and 60 million uncompressed frame pixels, whichever is smaller. |
| PNG | Current frame, with alpha where the chosen effect leaves transparent regions. |
| SVG | Vector cells and text. Source underlay, when enabled, is embedded as a raster image. Uploaded font data is embedded. |

- Keep the tab visible during video export. Backgrounding stops the job with a recoverable explanation instead of silently recording stalled frames. A screen wake lock is requested where available.
- Native video recording is device-dependent and is **not** an offline, frame-exact video encoder. Expensive effects or 4K may miss the requested frame rate; the completion screen reports low rendering throughput. Lower resolution or increase cell size in that case.
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
- `src/studio/media.js`: decode/seek lifecycle, cancellation, camera cleanup, and audio routing.
- `src/studio/export.js`: image/vector output, GIF sequencing, and native recorder lifecycle.

See [the complete audit](docs/AUDIT.md) for the original defects, corresponding repairs, test evidence, and verification limits.
