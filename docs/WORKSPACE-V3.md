# Workspace v3

This release implements the approved workspace, performance, selection, and export review. Existing settings and presets migrate without discarding the legacy combined ASCII mode.

## Editing and workspace

The preview and timeline remain above the scrolling inspector on tablet. The desktop inspector scrolls independently. A compact strip offers six starting looks, with all fifteen in a modal library. The library can render the current source frame on demand, rather than competing with video playback continuously.

The timeline has actual source thumbnails, accessible trim handles, and numeric In/Out fields. Numeric controls are also in the Frame inspector. Framing and normalized selection strokes use the same source coordinates in the preview and every export. The original-source eyedropper temporarily shows untreated footage. Brushes, erasing, lasso selection, and imported mattes supplement tonal selection without claiming automatic subject detection.

Per-effect settings survive switching effects, global color/selection choices remain intact, and trim changes participate in undo/redo. Named looks can be updated. Project files contain settings, selections, framing, trim, source metadata, export preferences, and the active custom font. Media is relinked rather than embedded. IndexedDB stores a last-session recovery copy; the untouched initial demo does not immediately overwrite it.

## Rendering and quality

Preview and export share a persistent render service. Worker-capable browsers transfer frames to OffscreenCanvas; one request is in flight per service. Preview and export use separate workers. Cancellation terminates export work, stale preview frames are discarded, and worker failure has a compatibility fallback. Auto preview adjusts moving frames between 320 and 960 px, then refines paused work to 1280 px. These are preview sizes, not export limits or frame-rate guarantees.

Screenprint uses CMYK or duotone separations with registration, rotated screens, and ink spread. Small raster screens integrate coverage across pixels; larger screens use analytic circle coverage. This avoids the very slow compound-path fill found during actual video export testing. SVG keeps vector ink geometry, with normal small-scale antialiasing differences.

Contour type follows marching-square paths with configurable text and contour levels. Color echoes sample a fixed grid of media timestamps, so spacing does not depend on playback speed or export frame rate. Cached 480 px silhouettes bound their memory use. Browsers without a compatible WebCodecs decoder use an independent HTML video element and the same fixed sample times. Paper grain has a fixed normalized texture. Effect mixing, echoes, source backdrops, and grain preserve composition alpha; PNG/SVG preserve transparency. SVG embeds raster layers for these compositing treatments.

A transparent-source defect in Channel study SVG is fixed. Time labels round before splitting minutes and seconds, so they do not display 00:60.0. Already-cancelled still exports reject immediately.

## Export reliability

Preflight checks source decoding, selected audio, encoder support, output dimensions, estimated encoded size, and available browser storage. Precise video output uses an origin-private temporary file when supported, with a guarded in-memory fallback. Completed files are retained while their download is available and removed when released; abandoned export files older than a day are cleaned up. Live recording keeps its separate memory and visibility limits.

Real-codec checks exercise cropped CMYK H.264/AAC output and VP8/Opus color echoes. They decode the files again to verify frame count, dimensions, duration, audible pulse positions, and silence. Cancellation is followed by a successful portrait 60 fps export. Earlier existing-effects export checks also passed during this upgrade.

## Verification and limits

- Unit and integration suite: 116 tests across 12 suites, including the HTML video echo fallback.
- Native codec acceptance: 60 frames / 2 seconds for MP4 and WebM, aligned trimmed audio, and cancellation recovery into a 15-frame portrait export.
- Real Chromium worker checks: new treatments render successfully; raster/vector comparisons, transparent Channel SVG, and worker cancellation are checked.
- Browser UI checks: source import, source-color picking, painting, framing, all fifteen source-based style previews, project and video download controls, a completed 360 × 360 compatibility WebM, and tablet inspector layout.
- The production build and the checked-in GIF worker validation are release gates.

Physical iPad hardware, Safari codec combinations, HDR, and long 4K jobs have not been certified. Browser canvas processing is SDR; CMYK screens are a visual treatment, not color-managed press separations. Worker and disk-storage fallbacks are feature-detected. Live camera echoes require recording and importing the clip first. Frame response remains dependent on preceding rendered frames; fixed-time color echoes do not.

The app branding is Dither Studio. Repository and Netlify host renaming requires account administration capabilities not provided by the connected tools; this release retains the existing repository and production URL.
