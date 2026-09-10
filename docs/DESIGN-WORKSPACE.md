# Design workspace

Implemented September 2026. This redesign keeps media editing, rendering, and exports in the existing local-processing application and Netlify deployment.

## Design direction

The canvas is the visual center. A compact document bar holds media, history, canvas focus, and Export. The former source bar, viewer heading, permanent style strip, and bottom status bar have been consolidated. Surface colors, type, spacing, focus rings, icons, and controls share one light/dark system. The canvas surround remains neutral in both appearances.

System appearance is the default; explicit Light and Dark choices are saved in Project. Appearance applies before first paint and also updates the browser theme color. It does not change media, effect colors, or output.

## Responsive editing

| Workspace | Behavior |
| --- | --- |
| Desktop and wide tablet | Persistent inspector, adjustable from 300–420 px with a pointer or keyboard. Canvas focus leaves the tool dock available to restore editing. |
| Portrait tablet and phone | Bottom tool dock with Canvas, Edit, and expanded Detail states. Numerical entry expands controls; drawing moves the controls aside. |
| Short landscape | Side inspector preserves the available vertical space. |
| Enlarged text | Tool labels reflow into additional rows and transport controls wrap. Scrollable panels retain access to the complete controls. |

Looks contains Studio starters and saved presets. Effect opens directly to the active treatment's parameters, with a categorized picker for changing it. Color, Select, and Frame retain the existing editing capabilities. Project consolidates media replacement, project files, recovery, preview preferences, appearance, and help.

## Precise interaction

- Sliders have editable numeric values. Values commit on blur or Enter; Escape cancels. Merely focusing a rounded display preserves the original precision.
- A continuous slider or trim-handle gesture is one undo step, even when it lasts longer than the previous time-based history window.
- Crop opens a staged editor over the source image with drag handles, aspect ratios, keyboard adjustment, and Apply/Cancel. Only Apply changes the composition.
- Fit and source-based zoom are view operations. Mouse pan and two-pointer navigation do not invalidate the effect renderer. Beginning two-pointer navigation cancels an unfinished selection stroke.
- Trim has an expanded filmstrip, exact times, selectable frame-step intervals, and handles that remain individually accessible for short ranges. Frame-step rate is an explicit seeking grid, not a claim that the source frame rate has been detected.
- Export shows the current composition, format, dimensions, and preflight. Frame rate, recording mode, and encoding details expand under Advanced settings. Completed files remain available for explicit download.

## Verification

- All 124 tests across 13 suites pass. The regression suite covers existing editing/export behavior plus appearance, exact adjustments, gesture history, canvas focus, staged cropping, and crop geometry.
- Production build and local GIF worker integrity check pass.
- Native WebCodecs adapter tests produce H.264/AAC MP4 and VP8/Opus WebM: 60 frames over two seconds with aligned audio. Cancellation recovery and a portrait 60 fps case also pass.
- Browser review covered desktop, 1180×820 and 820×1180 tablet layouts, 390×844 and 375×667 phones, 844×390 landscape, and 200% text. At normal text size, the phone preview region measured 398 px and 221 px high respectively.
- Browser interactions verified effect selection, appearance, numeric editing, crop Apply/Cancel, trim, brush selection and undo, magnification/pan, and the phone export sheet.
- A compatibility recording from a 0.5–2.0 second selection produced the expected 202×360 cropped output with audio. The live recorder produced about 6 fps and 1.64 seconds in the shared browser; the UI reports low throughput. This is not evidence of frame-accurate live recording. The precise export path is verified separately above.

Physical iPhone/iPad gestures, Safari media behavior, and the software keyboard still require device testing. Browser viewport checks do not certify those platform behaviors. The preview host uses HTTP and therefore exercises the live-recording compatibility path; production HTTPS enables frame-by-frame export on supported browsers.

No rendering kernels, effect definitions, encoder dependencies, or saved project schema changed in this redesign. Style thumbnails remain on demand; no continuous preview grid was added. The existing Netlify publication path remains in use.
