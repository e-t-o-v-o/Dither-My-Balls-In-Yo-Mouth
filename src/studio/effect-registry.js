import { artisticEffects } from "./model";
// Only these settings belong to an effect. Source, selection and finishing
// stay in place while exploring other rendering methods.
export const effectKeys = [
  "cellSize",
  "method",
  "threshold",
  "amount",
  "overlay",
  "char",
  "font",
  "fontScale",
  "characters",
  "dynamic",
  "textColor",
  "underlay",
  "underlayMode",
  "dotScale",
  "lineWidth",
  "shapeColor",
  "accentAmount",
  "mosaicLayout",
  "symbolSet",
  "contourSource",
  "beadSpacing",
  "beadSize",
  "beadRing",
  "contourFill",
  "contourText",
  "contourLevels",
  "screenAngle",
  "inkSpread",
  "registration",
  "screenMode",
  "weavePattern",
  "weaveDetail",
  "weaveWidth",
  "weaveCrossings",
  "weaveSeed",
  "weaveColorMode",
  "artSeed", "artColorMode", "engraveWarp", "engraveWeight", "paperShape",
  "paperFill", "paperVeins", "glassScatter", "glassGap", "arcBands", "arcWeight",
  "marbleSwirl", "marbleWeight", "topoLevels", "topoSoftness", "topoStyle", "topoContour",
  "stitchLength", "stitchWidth", "stitchFollow", "stitchStrands",
  "signalWarp", "signalAngle", "signalDensity", "schematicGrid", "schematicLabels",
  "schematicWeight", "schematicDashed", "collageStyle", "collageCoverage", "collageDetail",
  "collageBorders", "opticalPattern", "opticalInterference", "opticalWeight", "opticalBend",
  "opticalCenterX", "opticalCenterY", "opticalPhase", "targetRings", "targetSpread",
];
export const effectDefaults = {
  "signal-paths": { cellSize: 36 },
  schematic: { cellSize: 20 },
  "print-collage": { cellSize: 52, artColorMode: "source" },
  "optical-press": { cellSize: 28 },
  marbling: { cellSize: 24, artColorMode: "ink" },
  topography: { cellSize: 20, artColorMode: "tone" },
  threadwork: { cellSize: 32, artColorMode: "source" },
  guilloche: { cellSize: 16, artColorMode: "ink" },
  "cut-paper": { cellSize: 40 },
  glass: { cellSize: 44 },
  "arc-tiles": { cellSize: 40 },
  interlace: { cellSize: 32 },
  ascii: { cellSize: 14 },
  "dither-ascii": { cellSize: 14 },
  beads: { cellSize: 20 },
  symbols: { cellSize: 24 },
  mosaic: { cellSize: 22 },
  halftone: { cellSize: 14 },
  screenprint: { cellSize: 16 },
  "contour-type": { cellSize: 14 },
};
export const effectFamily = (id) =>
  artisticEffects.includes(id) ? "Artistic" : id === "channel"
    ? "Utilities"
    : [
          "mosaic",
          "halftone",
          "crosshatch",
          "edge",
        ].includes(id)
      ? "Graphic"
      : "Digital";
export const effectSnapshot = (config) =>
  Object.fromEntries(
    effectKeys
      .filter((key) => config[key] !== undefined)
      .map((key) => [key, config[key]]),
  );
