# Studio visual refinement

September 2026. This pass takes its direction from the supplied Apple Mac and Store references: neutral surfaces, clear type hierarchy, quiet navigation, rounded cards, and selective color. The editing workspace retains its canvas, inspector, timeline, and compact activity dock.

## Visual system

- Use the system font stack, with tighter tracking on headings and tabular figures for exact values. No remote fonts or decorative imagery are loaded.
- Separate the background, panel, card surface, field, and hover tokens. Light mode uses white and silver; dark mode uses black and neutral grays.
- Reserve blue for the primary action, focus, and selected export format. Editing sliders, tabs, and palette selections use neutral emphasis so the artwork remains central.
- Keep the canvas surround and its controls theme-aware. Transparent artwork uses a neutral checkerboard in both appearances.
- Use a consistent radius hierarchy: small fields and tabs, larger effect and gallery cards, rounded dialogs, and pill-shaped primary actions.
- Give the active effect a clear title. Keep contextual layer controls smaller, with the complete effect stack still one action away.
- Use the same search field, clear affordance, and Escape behavior for styles and palettes. Icons live in a separate module so the shared field does not depend on the effect controls.

## Responsive and interaction constraints

Desktop keeps its adjustable inspector. Compact layouts retain the existing editing tray, expanded controls, canvas focus, and activity navigation. Phone typography and spacing are tightened independently of desktop; form fields retain 16 px text and touch controls retain their existing target sizes. Short phone screens use a slimmer filmstrip and omit the redundant range labels, leaving more room for the artwork. Search clearing has a 44 px target. Focus rings remain visible and card motion respects reduced-motion preferences.

Appearance remains available under Project and follows the saved System, Light, or Dark choice. The change does not alter effect definitions, rendering kernels, project data, or export settings.

## Verification

- All 377 tests across 25 suites, the production build, and GIF worker integrity check pass. These cover compact navigation, appearance persistence, style and palette browsing, exact adjustments, and export interactions.
- Live preview review covered light and black themes, the gallery, palette search and selection, and the export dialog. A 1920 × 1080 PNG completed successfully with the selected treatment and palette.
- A temporary same-origin review frame exercised the real responsive app at 390 × 844, 375 × 667, 820 × 1180, 1180 × 820, and 844 × 390. Compact browsing and export remained reachable, with no horizontal page overflow at the measured phone and tablet sizes. The review frame is removed before release.
- Text contrast checks: secondary text is 4.66:1 on the light gallery background and 6.33:1 on the dark elevated surface; the blue primary action has 4.70:1 white-text contrast. Search clearing returns focus to the input; hover keeps the primary action blue.

These are browser layout checks, not physical-device Safari or touch certification. The existing CI codec matrix remains a release gate.
