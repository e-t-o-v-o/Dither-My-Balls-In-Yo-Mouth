# Dither v2 audit and overhaul

Audited against main commit `ea7a435ce8215e5f0e1d818af5e2a68a124cec8e`. Scope: all tracked application modules, both dithering workers, build/dependency configuration, export paths, local data handling, and existing tests. Product direction: video and export first; desktop and iPad equally important.

## Findings and resolutions

| Area | Original finding | Resolution |
| --- | --- | --- |
| Video container | WebM fallback was downloaded with an `.mp4` suffix. | Capability-based format choices; suffix derived from `MediaRecorder.mimeType`. Unsupported codecs cannot be selected. |
| WebM metadata | Native recordings can omit duration, preventing timeline use after re-import. | Final WebM duration is repaired locally; a real durationless WebM fixture verifies the resulting duration field. |
| Video audio | Recorder captured only a canvas video stream. Uploaded video audio was lost. | Separate Web Audio export and monitor routes. Optional source audio track is cloned into the output; monitor mute does not mute export. |
| Video timing | Download started at zero without waiting for the decoded frame; no trim, progress, cancellation, or stall recovery. | Awaited seeks, explicit trim, stable export settings/dimensions, progress, abort handling, visibility/stall checks, and bounded recording memory. |
| GIF | GIF recording constructed an encoder without a deployed worker asset and did not feed a complete frame sequence. | Local worker copied during start/build; frame-by-frame sequencing, exact GIF frame delays, progress, memory budget, timeout, cancellation, and worker termination. |
| Dither choices | Public and source workers treated every non-ordered option as Floyd–Steinberg. Other kernels in App were unreachable after the early worker return. | One pure implementation with independently defined and regression-tested diffusion kernels. |
| Dither colors | Workers mapped luminance onto arbitrary palette positions as though palette entries were evenly spaced gray levels. | Actual RGB nearest-color matching and RGB error diffusion. |
| Worker lifecycle | Missing/failed worker could leave `pendingRef` permanently true; old bitmaps were retained and not closed. Root-relative worker path broke repository subpaths. | Removed duplicate bitmap/worker pipeline. Shared, bounded canvas-grid renderer; only GIF encoding uses workers, with a relative asset path and explicit cleanup. |
| Render consistency | Screen, SVG, PNG, and dithered ASCII used divergent implementations. PNG increased raster size rather than re-rendering. | Shared rendering implementation, independent output sizing, vector cells/glyphs, and proper fresh-frame PNG output. |
| ASCII underlay | Source was drawn over completed ASCII and obscured the text. | Underlay is drawn first, text on top. |
| ASCII export selection | Selecting PNG for ASCII silently exported SVG instead. | The requested format is honored. |
| Character controls | Letter-char ignored the custom character; labels and some stored settings disagreed. | Custom character is used by its actual renderer; conditional controls correspond to effects. |
| Resolution | Video 1080p/4K forced 16:9 regardless of source. Canvas dimensions were reset every frame. | Aspect-preserving longest-edge sizing, even video dimensions, and resizing only when dimensions change. |
| Camera | Permission requested automatically in a render loop; errors mostly went to the console. | Explicit camera activation and switching; contextual permission errors; streams released on source change/unmount. |
| Media files | No useful decode errors or size bounds; object URLs leaked; stale asynchronous loads could change the current source. | Abortable load/seek operations, latest-load ownership, format/dimension checks, size limits, and deterministic URL/stream cleanup. |
| Saved state | Unguarded JSON parsing at module load could prevent the whole app from opening. Preset imports trusted arbitrary objects. | Safe reads, bounded values, enum and color validation, legacy migration, import limits, inherited-key rejection, and recovery UI. |
| Presets | Preset management existed as unused App functions without a complete exposed interface. | Save, load, delete, import, and export flows; collision handling and storage failures explained. |
| Fonts | Object URLs were not released; failures were console-only. | ArrayBuffer FontFace loading, validation, visible errors, session cleanup, SVG font embedding, and fallback after reload. |
| UI | Hidden sidebar carried source/effects/settings, with weak keyboard and touch affordances. No useful opening frame without a camera. | Working studio with demo, clear source actions, timeline, before/after, inspector tabs, starting looks, touch-sized main controls, focus styles, modal focus, and undo/redo. |
| Project metadata | React starter branding and a nonfunctional install-prompt scaffold remained. | Product metadata and icon; no misleading install affordance or unused starter assets. |
| Tests | Sole test asserted a React starter link. | Functional model, pixel, renderer, media, recorder, and editor interaction tests; real GIF-worker smoke check; CI. |
| Dependencies | CRA/CRACO, obsolete transitive packages, and unused FFmpeg, TensorFlow, WebGL, SVG, quantization, and deployment libraries. Initial production-classified audit: 60 advisories, including 3 critical and 29 high. | Migrated to Vite/Vitest and removed libraries made obsolete by the rebuilt implementations. Fresh lockfile; final full audit reports zero advisories at audit time. |

## Product decisions

- Preserve every previously exposed effect, plus expose the documented RGB channel view. Consolidate the overlapping palette controls into one current-effect palette while retaining the original collections.
- Use a local app with no backend, analytics, API keys, remote font loading, or media uploads.
- Keep the original repository and its history. The overhaul is isolated on a branch for review; existing production is not overwritten by this work.
- Use browser-native video encoding with honest capability detection. Do not promise MP4 where the browser cannot encode it, and do not rename WebM to imitate MP4.
- Prefer a bounded renderer over the old fragile asynchronous dither worker. GIF encoding still runs in locally served workers. Heavy 4K configurations can be limited by CPU and device encoding speed.
- Retain the existing Netlify output directory and deployment identity. Move development/build tooling to Vite; no new hosting service is required.

## Validation evidence

- **56 automated tests pass across 7 suites.** They cover all 13 effects; distinct diffusion patterns; RGB nearest matching; transparency; chroma keying; legacy state migration; corrupted storage; prototype-like enum values; preset imports; portrait/square/native sizing; decoded seeks; cancellation; decode failure; URL/track cleanup; monitor/export audio separation; codec detection; correct file extensions; GIF budgeting; recorder cancellation/setup failure; initial workspace; undo/redo; presets; trim bounds; and export UI.
- A real streaming WebM fixture verifies duration metadata repair. The pending original PR #1 was also reviewed; its missing green-replacement default is resolved by the unified background/keying controls.
- The actual shipped `gif.worker.js` runs inside a Node VM in `scripts/check-gif-worker.cjs`, producing a GIF89a stream with expected dimensions and a valid trailer.
- Production build succeeds with Vite. Static entrypoint and local worker assets are verified. The main compressed JavaScript payload is approximately 82 KB, with GIF orchestration loaded on demand.
- Dependency audit result is checked in as `docs/dependency-audit.json`. It is a point-in-time registry result, not a guarantee against future vulnerabilities.
- CI repeats installation, tests, production build, GIF worker verification, and the high-severity dependency gate. CI uploads a static build artifact; it does not deploy.

## Verification limits and release checks

Automated DOM tests use jsdom and mocked canvas/media platform APIs. They prove control flow and domain behavior, not a real browser's decoder, camera, encoder, audio synchronization, touch behavior, or rendering speed. The GIF smoke check exercises the real encoder, but does not emulate the browser's Worker transport.

Final cloud Chromium review exercised the desktop editor and an 820 × 1180 portrait iframe, including the tablet inspector. The preview now reserves space for playback and trim controls on shorter desktop screens. A generated 640 × 360 H.264/AAC test clip opened successfully. A two-second trimmed MP4 export downloaded and decoded in FFmpeg, with audible Opus audio (mean level −21.1 dB). The browser selected VP9 inside MP4; container support alone does not imply H.264 compatibility. The final codec preference now explicitly tries H.264/AAC before the generic MP4 fallback. Cloud recording throughput was low (about 4 rendered fps), and the app displayed its performance warning; this run does not establish smooth playback or audio/video synchronization on target devices. The native output lasted about 2.18 seconds. A GIF exported through the actual browser worker and downloaded correctly: 480 × 270, 24 frames, 1.92 seconds (GIF centisecond delay rounding).

No physical iPad was available. Before labeling the app as verified on a specific device/browser, run these additional checks there:

1. Import landscape and portrait H.264 MP4 clips with audio. Scrub, loop, switch sources, and compare the original frame with the effect.
2. Export a 3–5 second trim with audio; play the resulting MP4/WebM in a separate player and check duration, sound, frame pacing, and aspect ratio.
3. Cancel a second export; confirm controls recover and the prior completed download remains available. Background a running video export; confirm a recoverable stop message.
4. Export an animated GIF and inspect every frame, timing, and looping. Test PNG transparency and SVG glyph/font output in an external viewer.
5. Deny camera permission, then allow it, switch cameras if available, record, and change sources. Confirm camera indicators turn off when released.
6. On iPad Safari, check portrait/landscape layouts, sliders, native dialog focus, opening media through Files/Photos, downloading, and Share / Save to Files.
7. Measure a representative 4K configuration. Native recording is real time and can drop frames on a slow device; the UI reports low render throughput and supports smaller output settings.

Known functional limits are also presented in the in-app help and README: browser-dependent video formats, real-time video encoding, silent camera capture, opaque video/GIF, bounded GIF and recording memory, session-local uploaded fonts, and still-only treatment of animated GIF inputs.
