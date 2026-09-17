# Solid tiles and the color collection

Adaptive tiles now makes a discrete subdivision choice from the current frame's detail. Only leaf tiles are drawn. A large tile never crossfades with its smaller children, so printed shapes retain solid ink and clean negative space. Alpha-weighted detail sampling, source transparency, SVG geometry, and deterministic seeking remain unchanged. Subdivision can change directly as video content crosses the detail threshold.

Harmonic field and its three starters are removed from discovery. Previously saved projects and presets still open with their original renderer, controls, animation, and exports. The main picker and Add effect menu share the same available effect list.

## Color collection

`src/studio/palettes.js` is the single palette catalog. It replaces multiple overlapping definitions, including a spread of five-color variants that silently overwrote larger sets. There is no fixed palette length. Forty-one distinct choices are grouped into Ink & light, Pigment & paper, Graphic & textile, and Electric & screen.

- Existing artistic palettes retain their established inks. Older general-purpose sets have been balanced for shadows, midtones, highlights, and a clearer hue relationship.
- Six new choices add neutral graphite, indigo washes, warm oxide, aubergine/citron, moss/rose, and terracotta/blue combinations.
- Default and Decade were exact duplicates. Old Default settings resolve to Decade without changing colors.
- Every available palette has a full swatch strip, a name, and a color count. Search matches palette names, descriptions, groups, and hex values. Selected colors remain visible while searching.
- Native radio controls support touch, keyboard selection, focus indication, and one tab stop for the collection. Effect and echo palettes use independent instances of the same browser.

## Appearance

Dark mode uses a black canvas and page with near-black panels and neutral gray controls. Browser chrome also switches to black before initial paint and when changing appearance. Light mode keeps its existing contrast; canvas tools and overlay surfaces are neutral in either appearance.

## Verification

Renderer regressions inspect opacity and nonoverlapping tile coverage in the old crossfade band, alongside existing raster/SVG parity, alpha, motion, and seek tests. Interface tests cover every swatch, filtering and recovery, separate effect/echo palettes, Undo/Redo, and retired-effect compatibility. Release checks include the production build, real MP4/WebM codec matrix, and browser visual review.
