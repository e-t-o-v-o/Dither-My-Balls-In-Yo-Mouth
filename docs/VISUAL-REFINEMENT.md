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

Desktop keeps its adjustable inspector. Compact layouts retain the existing editing tray, expanded controls, canvas focus, and activity navigation. Phone typography and spacing are tightened independently of desktop; form fields retain 16 px text and touch controls retain their existing target sizes. Search clearing has a 44 px target. Focus rings remain visible and card motion respects reduced-motion preferences.

Appearance remains available under Project and follows the saved System, Light, or Dark choice. The change does not alter effect definitions, rendering kernels, project data, or export settings.

## Verification

The existing 377 tests across 25 suites and the production build pass. This includes compact navigation, appearance persistence, style and palette browsing, exact adjustments, and export interactions. Release review also checks the deployed preview and the repository's codec and worker gates.
