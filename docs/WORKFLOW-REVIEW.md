# Workflow review — v2.3

This pass focuses on repeated editing and export tasks, following the v2.2 graphic styles release.

## Changes

- **Visible trim selection:** an accent bar shows the export range. Full clip restores the complete source. Left/right seek 0.1 seconds; Shift changes the step to one second; I/O set trim boundaries. Shortcuts do not intercept form controls, dialogs, loading, or active exports.
- **Keep mask:** an opt-in checkbox retains the current brightness/color mask and original-image backdrop when trying another style. Saved presets still restore their full settings.
- **Remember video choices:** validated resolution, frame rate, audio, and quality preferences survive reloads. GIF's smaller dimensions and frame rates do not overwrite them. Camera recording clamps to its live-recording frame rates without overwriting saved video preferences.
- **Honest download state:** completed files retain their effect and frame/range summary. Relevant edits, format changes, or source replacement label the file as a previous export, while keeping its download available. The result stores a source revision number rather than retaining a released media element or file.
- **Camera trails:** live camera rendering now uses a progressing clock. Previously its fixed zero timestamp could freeze temporal smoothing after the first frame.
- **Consistent opaque output:** video and GIF flatten the rendered composition onto the chosen background without forcing the effect's transparency setting off. This preserves transparent negative space and source backdrops in Threshold and Edges, and applies consistently across all render paths. PNG and SVG still preserve alpha.
- **Last-edit persistence:** page exit flushes the latest effect settings without adding storage writes to the animation loop.

## Validation

- 103 tests pass across nine suites, including pixel comparisons for five effects with and without source backdrops, camera trail progression, mask preservation, trim shortcuts, preference restoration, and previous-export labeling.
- Production build passes. No runtime dependencies added. The codec library remains loaded on demand.
- Real MP4 (H.264/AAC) and WebM (VP8/Opus) exports produce 60 frames over two seconds with trimmed audio. Cancellation recovery and a 180 × 320, 60 fps portrait export pass using the native WebCodecs test adapters.
- Desktop and an 820 px tablet-width browser layout reviewed. Checked mask preservation, visible selection, and PNG completion/previous-export state in the browser.
- Physical iPad/Safari and a hardware camera were not available; camera-clock behavior is covered by a rendered regression test. Live recorder throughput remains device-dependent.
