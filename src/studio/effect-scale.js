// One source of truth for the inspector, validated projects, and frame sampler.
// All sizes refer to a 1920 px long edge, so previews and exports agree.
const scales = {
  beads: ["Cell size", 6], "contour-type": ["Cell size", 6],
  screenprint: ["Cell size", 8], interlace: ["Module size", 8, 2],
  guilloche: ["Line spacing", 8], marbling: ["Line spacing", 12],
  topography: ["Contour detail", 12], threadwork: ["Stitch size", 12],
  "cut-paper": ["Shape size", 16, 2], glass: ["Shape size", 16, .5],
  "arc-tiles": ["Shape size", 16], "signal-paths": ["Symbol size", 16, .5],
  schematic: ["Drawing detail", 12], "print-collage": ["Tile size", 24],
  "optical-press": ["Line spacing", 14, .5],
  relief: ["Ridge spacing", 16, .25], harmonics: ["Pattern scale", 32, 1 / 6],
  "adaptive-tiles": ["Tile size", 24, .5],
};
export function effectScale(c) {
  const target = c.effect === "mosaic" && c.mosaicLayout === "targets";
  const [label, min, factor = 1] = target ? ["Cell size", 16] : scales[c.effect] || ["Cell size", 2];
  const size = Math.max(min, c.cellSize);
  return { label, min, sampleSize: size * (c.effect === "print-collage" ? 3 / c.collageDetail : factor) };
}
